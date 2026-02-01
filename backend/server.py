# backend/server.py
import io, os, json, re
import time
import uuid
import hashlib
import base64
from typing import Optional, Dict, List
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

import auxiliary, biochemCalculation, tango
# JPred module kept for reference only - not used functionally
# import jpred
from auxiliary import ff_helix_percent, ff_helix_cores
import math
from schemas.peptide import PeptideSchema
from schemas.api_models import RowsResponse, PredictResponse
from calculations.biochem import calculate_biochemical_features as calc_biochem
from services.normalize import (
    canonicalize_headers,
    normalize_cols,
    create_single_sequence_df,
    finalize_ui_aliases as _finalize_ui_aliases,
    finalize_ff_fields,
    normalize_rows_for_ui,
)
from services.thresholds import resolve_thresholds, parse_threshold_config
from services.upload_service import (
    process_upload_dataframe,
    UploadProcessingError,
    get_last_provider_status,
    get_last_run_dir,
    set_last_provider_status,
    set_last_run_dir,
)
from services.uniprot_query import parse_uniprot_query, build_uniprot_export_url
from schemas.uniprot_query import UniProtQueryParseRequest, UniProtQueryParseResponse, UniProtQueryExecuteRequest
from services.logger import get_logger, set_trace_id, log_info, log_warning, log_error
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response
from services.dataframe_utils import (
    has_any,
    has_all,
    ensure_ff_cols,
    ensure_cols,
    ff_flags,
    require_cols,
    read_any_table,
    ensure_computed_cols,
    apply_ff_flags,
    fill_percent_from_tango_if_missing as _fill_percent_from_tango_if_missing,
    ssw_positive_percent as _ssw_positive_percent,
)
import httpx

# Import config first (loads .env files)
from config import settings

# Note: Sentry initialization and FastAPI app setup moved to api/main.py
# SENTRY_INITIALIZED will be imported from api/main.py at the end of this file

# Provider flags from config
USE_JPRED = settings.USE_JPRED
USE_TANGO = settings.USE_TANGO
USE_PSIPRED = settings.USE_PSIPRED
DEBUG_ENTRY = settings.DEBUG_ENTRY
use_simple = settings.TANGO_MODE == "simple"

# Note: FastAPI app creation, exception handlers, and middleware moved to api/main.py
# Endpoint functions are kept here for backward compatibility and service imports
# The actual app will be imported from api/main.py at the end of this file

# Structured logging setup
logger = get_logger()

# DataFrame utility functions are imported from services.dataframe_utils:
# ensure_ff_cols, has_any, has_all, ensure_cols, ff_flags, require_cols,
# read_any_table, ensure_computed_cols, apply_ff_flags,
# _fill_percent_from_tango_if_missing, _ssw_positive_percent

# --- Example dataset config ---
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent  # adjust one/two levels as needed
EXAMPLE_PATH = BASE_DIR / "ui" / "public" / "Final_Staphylococcus_2023_new.xlsx"

# Column constants for checking pre-existing results
JPRED_COLS = ["Helix fragments (Jpred)", "Helix score (Jpred)"]
TANGO_COLS = ["SSW prediction", "SSW score"]
BIOCHEM_COLS = ["Charge", "Hydrophobicity", "Full length uH"]

# Note: CORS and TraceIdMiddleware are configured in api/main.py
# Note: _finalize_ui_aliases imported from services.normalize
# Note: normalize_cols imported from services.normalize
# Note: canonicalize_headers imported from services.normalize

# ---------- Endpoints ----------

# @app.post("/api/upload-csv", response_model=RowsResponse)  # Moved to api/routes/upload.py
async def upload_csv(
    file: UploadFile = File(...),
    debug_entry: Optional[str] = Query(None, description="Entry ID to trace through pipeline"),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    """
    Accept a UniProt export as CSV/TSV/XLSX.
    debug_entry: Optional entry ID to enable detailed tracing for that specific peptide.
    Only 'Entry/Accession' and 'Sequence' are required; 'Length' is computed if missing.
    Computed fields (Hydrophobicity, Charge, μH, FF flags) are added server-side.

    Core processing logic is in services/upload_service.py.
    This function handles HTTP-specific concerns (file validation, UploadFile handling).
    """
    # Use env var or query param for debug entry
    trace_entry = debug_entry or DEBUG_ENTRY
    if trace_entry:
        log_info("upload_trace_entry", f"Tracing entry: {trace_entry}", entry=trace_entry)

    # Parse threshold config (shared helper)
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    # Validate file format upfront
    if not file.filename:
        raise HTTPException(400, detail="File must have a filename. "
                                       "Accepted formats: .csv, .tsv, .xlsx, .xls, .txt")

    file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ""
    if file_ext not in ["csv", "tsv", "xlsx", "xls", "txt"]:
        raise HTTPException(400, detail=f"Unsupported file format: '{file_ext}'. "
                                       "Accepted formats: .csv (comma-separated), .tsv (tab-separated), "
                                       ".xlsx/.xls (Excel), .txt (auto-detect delimiter).")

    # Performance timing: Parse stage
    parse_start_time = time.time()
    log_info("upload_parse_start", f"Parsing file: {file.filename}", stage="parse")
    raw = await file.read()

    # Validate file is not empty
    if len(raw) == 0:
        raise HTTPException(400, detail="Uploaded file is empty. "
                                       "Please upload a non-empty file with at least one data row.")

    try:
        df = read_any_table(raw, file.filename)
        parse_elapsed = (time.time() - parse_start_time) * 1000  # Convert to ms
        log_info("upload_parse_complete", f"Parsed {len(df)} rows from {file.filename}",
                stage="parse", **{"row_count": len(df), "upload_filename": file.filename, "parse_time_ms": round(parse_elapsed, 2)})
    except ValueError as e:
        # ValueError from read_any_table with detailed format/parsing error
        log_error("upload_parse_failed", f"Failed to parse table: {e}", stage="parse", **{"error": str(e)})
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        # Other exceptions (e.g., missing openpyxl for .xlsx)
        log_error("upload_parse_failed", f"Failed to parse table: {e}", stage="parse", **{"error": str(e)})
        raise HTTPException(400, detail=f"Failed to parse file '{file.filename}': {e}. "
                                       "Ensure file is a valid .csv, .tsv, .xlsx, or .xls file. "
                                       "Required columns: Entry/Accession (or ID) and Sequence.")

    # Validate we got some data
    if len(df) == 0:
        raise HTTPException(400, detail="Parsed file contains no data rows. "
                                       "Ensure file has at least one row with data (excluding headers).")

    # Performance timing: Normalize stage
    normalize_start_time = time.time()
    log_info("normalize_start", "Normalizing column headers", stage="normalize")
    df = normalize_cols(df)
    normalize_elapsed = (time.time() - normalize_start_time) * 1000
    log_info("normalize_complete", f"Normalized columns: {list(df.columns)[:5]}...",
            stage="normalize", **{"column_count": len(df.columns), "normalize_time_ms": round(normalize_elapsed, 2)})
    # normalize_cols already converts lowercase to capitalized (entry->Entry, sequence->Sequence)
    require_cols(df, ["Entry", "Sequence"])

    # if Length absent, derive from sequence
    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    # Process the DataFrame through the full pipeline
    # Core logic is in services/upload_service.py
    from api.main import SENTRY_INITIALIZED
    try:
        return process_upload_dataframe(
            df=df,
            threshold_config_requested=threshold_config_requested,
            threshold_config_resolved=threshold_config_resolved,
            trace_entry=trace_entry,
            sentry_initialized=SENTRY_INITIALIZED
        )
    except UploadProcessingError as e:
        # Convert service errors to HTTP errors
        raise HTTPException(status_code=e.status_code, detail=json.dumps(e.detail) if e.detail else e.message)

# @app.post("/api/predict", response_model=PredictResponse)  # Moved to api/routes/predict.py
async def predict(
    sequence: str = Form(...), 
    entry: Optional[str] = Form(None),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    # Parse threshold config (shared helper)
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    # Use shared function to create and validate single-sequence DataFrame
    df = create_single_sequence_df(sequence, entry)
    seq = df.iloc[0]["Sequence"]  # Get validated sequence for downstream processing
    entry_id = df.iloc[0]["Entry"]  # Get validated entry for downstream processing
    
    # Debug: verify sequence is not empty
    if not seq or len(seq) == 0:
        raise HTTPException(status_code=400, detail="Sequence is empty after validation")

    # Step 2 (already present): compute FF-Helix %
    ensure_ff_cols(df)
    ensure_computed_cols(df)

    # Optional enrichments for single sequence
    if USE_TANGO:
        try:
            # prefer simple runner; fallback to generic if not present
            tango_records = [(entry_id, seq)]
            if hasattr(tango, "run_tango_simple"):
                print("running tango simple")
                run_dir = tango.run_tango_simple(tango_records)
            else:
                print("not running tango simple, but run_tango instead because the other one failed")
                run_dir = tango.run_tango(records=tango_records)

            try:
                tango.process_tango_output(df, run_dir=run_dir)
            except ValueError as e:
                print(f"[TANGO][ERROR] {e}")
                print("[TANGO] Provider status: FAILED - continuing without Tango results")
            except Exception as e:
                print(f"[TANGO][WARN] Unexpected error during output processing: {e}")
            
            _fill_percent_from_tango_if_missing(df)
            
            try:
                tango.filter_by_avg_diff(df, "single", {"single": {}})
            except ValueError as e:
                print(f"[TANGO][ERROR] {e}")
                print("[TANGO] Provider status: FAILED - SSW prediction computation failed")
            except Exception as e:
                print(f"[PREDICT][WARN] Tango filter failed: {e}")
        except Exception as e:
            print(f"[PREDICT][WARN] Tango failed: {e}")

    # Secondary structure prediction via provider interface
    from services.secondary_structure import get_provider
    try:
        provider = get_provider()
        provider.run(df)
    except Exception as e:
        log_warning("secondary_structure_error", f"Secondary structure provider error: {e}", **{"error": str(e)})

    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df)
    finalize_ff_fields(df)
    
    # Resolve thresholds (deterministic computation based on mode)
    resolved_thresholds = resolve_thresholds(threshold_config_requested, df)
    
    # Normalize single row for UI (with provider status tracking - Principle B)
    # This now returns camelCase dict (id, sequence, etc.) - NOT capitalized keys
    row_data = normalize_rows_for_ui(
        df,
        is_single_row=True,
        tango_enabled=USE_TANGO,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=USE_JPRED
    )
    
    # Build provider status metadata (similar to upload-csv)
    # Check if TANGO ran and produced results
    tango_ran = USE_TANGO and "SSW prediction" in df.columns
    ssw_hits = 1 if tango_ran and df.iloc[0].get("SSW prediction", -1) != -1 else 0
    jpred_hits = 0  # JPred always disabled
    
    # Build provider status meta (simplified for single row)
    provider_status_meta = {
        "tango": {
            "enabled": USE_TANGO,
            "requested": USE_TANGO,
            "ran": tango_ran,
            "status": "AVAILABLE" if ssw_hits > 0 else ("OFF" if not USE_TANGO else "UNAVAILABLE"),
            "reason": None if ssw_hits > 0 else ("TANGO not enabled" if not USE_TANGO else "No TANGO output"),
            "stats": {"requested": 1 if USE_TANGO else 0, "parsed_ok": ssw_hits, "parsed_bad": 0}
        },
        "psipred": {
            "enabled": USE_PSIPRED,
            "requested": USE_PSIPRED,
            "ran": USE_PSIPRED,  # Simplified - assume ran if enabled
            "status": "UNKNOWN",  # Would need to check actual output
            "reason": None,
        },
        "jpred": {
            "enabled": False,
            "requested": False,
            "ran": False,
            "status": "OFF",
            "reason": "JPred disabled",
        }
    }
    
    # Compute reproducibility primitives (same as upload-csv)
    repro_run_id = str(uuid.uuid4())
    trace_id = get_trace_id_for_response()
    
    # Compute inputs_hash from cleaned sequence + ID
    seq_cleaned = auxiliary.get_corrected_sequence(seq) if seq else ""
    inputs_str = f"{entry_id}:{seq_cleaned}"
    inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]
    
    # Compute config_hash from configuration flags
    config_dict = {
        "USE_TANGO": USE_TANGO,
        "USE_PSIPRED": USE_PSIPRED,
        "USE_JPRED": USE_JPRED,
    }
    config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
    config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]
    
    # Build provider status summary
    provider_status_summary = {
        "tango": {
            "status": "AVAILABLE" if ssw_hits > 0 else ("OFF" if not USE_TANGO else "UNAVAILABLE"),
            "requested": 1 if USE_TANGO else 0,
            "parsed_ok": ssw_hits,
            "parsed_bad": 0,
        } if USE_TANGO else None,
        "psipred": {
            "status": "OFF" if not USE_PSIPRED else "UNKNOWN",
        },
        "jpred": {
            "status": "OFF",
        },
    }
    
    # Build complete meta structure (matching Meta model)
    meta = ensure_trace_id_in_meta({
        "use_jpred": False,  # JPred always disabled
        "use_tango": USE_TANGO,
        "jpred_rows": jpred_hits,
        "ssw_rows": ssw_hits,
        "valid_seq_rows": 1,  # Single row, always valid if we got here
        "provider_status": provider_status_meta,
        "runId": repro_run_id,
        "traceId": trace_id,
        "inputsHash": inputs_hash,
        "configHash": config_hash,
        "providerStatusSummary": provider_status_summary,
        "thresholdConfigRequested": threshold_config_requested,
        "thresholdConfigResolved": threshold_config_resolved,
        "thresholds": resolved_thresholds,
    })
    
    # Return PredictResponse format: {row: PeptideRow, meta: Meta}
    return {
        "row": row_data,
        "meta": meta,
    }

def process_row(row_dict):
    # row_dict contains keys that are the CSV headers (exact strings)
    peptide = PeptideSchema.parse_obj(row_dict)
    return peptide.to_camel_dict()


# ---------- UniProt Query Endpoints ----------

# Global state is now in services/upload_service.py
# Use get_last_provider_status(), set_last_provider_status(),
# get_last_run_dir(), set_last_run_dir()

# @app.get("/api/debug/providers")  # Moved to api/routes/providers.py
async def debug_providers():
    """
    Debug endpoint to quickly see provider status and sample counts.
    Returns current dataset provider status if available, or empty response.
    Note: This is a placeholder - in production, you'd track the last processed dataset.
    """
    return {
        "note": "This endpoint shows provider status from the last processed dataset. Load a dataset first via /api/upload-csv or /api/uniprot/execute",
        "sample_structure": {
            "tango": {
                "status": "OFF | UNAVAILABLE | PARTIAL | AVAILABLE",
                "reason": "string | null",
                "stats": {
                    "requested": 0,
                    "parsed_ok": 0,
                    "parsed_bad": 0
                }
            }
        }
    }

# @app.get("/api/providers/last-run")  # Moved to api/routes/providers.py
async def providers_last_run():
    """
    Returns the last provider status metadata from the most recent dataset processing.
    Includes provider status, reasons, stats, and run directory paths for debugging.
    """
    last_status = get_last_provider_status()
    last_run_dir = get_last_run_dir()

    if last_status is None:
        return {
            "note": "No dataset processed yet. Load a dataset via /api/upload-csv or /api/uniprot/execute first.",
            "tango": None,
            "psipred": None,
            "jpred": None,
            "run_dirs": {
                "tango": None,
            }
        }

    # Get latest TANGO run directory
    latest_tango_dir = last_run_dir or tango._latest_run_dir()

    return {
        "tango": last_status.get("tango"),
        "psipred": last_status.get("psipred"),
        "jpred": last_status.get("jpred"),
        "run_dirs": {
            "tango": latest_tango_dir,
        },
        "sample_counts": {
            "total_rows": last_status.get("total_rows", 0),
            "ssw_rows_with_data": last_status.get("ssw_rows_with_data", 0),
        }
    }

# @app.get("/api/providers/diagnose/tango")  # Moved to api/routes/providers.py
async def diagnose_tango():
    """
    Diagnose TANGO binary/container availability.
    Returns actionable status for debugging TANGO execution failures.
    """
    import shutil
    import subprocess
    
    # Check if Docker mode is enabled
    use_docker = settings.TANGO_MODE != "simple"
    docker_image = os.getenv("TANGO_DOCKER_IMAGE", "desy-tango")  # Not in config yet (optional)
    
    result = {
        "status": "unknown",
        "path": None,
        "version": None,
        "reason": None,
    }
    
    # Docker mode: check if image exists
    if use_docker:
        try:
            proc = subprocess.run(
                ["docker", "image", "inspect", docker_image],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if proc.returncode == 0:
                result["status"] = "found"
                result["path"] = f"docker:{docker_image}"
                # Try to get version from image
                try:
                    version_proc = subprocess.run(
                        ["docker", "run", "--rm", docker_image, "tango", "--version"],
                        capture_output=True,
                        text=True,
                        timeout=2,
                    )
                    if version_proc.returncode == 0:
                        result["version"] = version_proc.stdout.strip()[:100]
                except Exception:
                    pass
            else:
                result["status"] = "container-missing"
                result["reason"] = f"Docker image '{docker_image}' not found"
        except FileNotFoundError:
            result["status"] = "container-missing"
            result["reason"] = "Docker not installed or not in PATH"
        except subprocess.TimeoutExpired:
            result["status"] = "container-missing"
            result["reason"] = "Docker image check timed out"
        except Exception as e:
            result["status"] = "container-missing"
            result["reason"] = f"Docker check failed: {str(e)}"
        return result
    
    # Native mode: check binary
    bin_path = os.path.join(tango.TANGO_DIR, "bin", "tango")
    bin_path_abs = os.path.abspath(bin_path)
    
    # Check if configured TANGO_BIN exists
    tango_bin_env = os.getenv("TANGO_BIN")
    if tango_bin_env and os.path.exists(tango_bin_env):
        bin_path_abs = os.path.abspath(tango_bin_env)
    elif not os.path.exists(bin_path):
        # Try which tango
        which_path = shutil.which("tango")
        if which_path:
            bin_path_abs = os.path.abspath(which_path)
        else:
            result["status"] = "missing"
            result["reason"] = f"TANGO binary not found at {bin_path_abs} and not in PATH"
            return result
    
    result["path"] = bin_path_abs
    
    # Check if file exists
    if not os.path.exists(bin_path_abs):
        result["status"] = "missing"
        result["reason"] = f"TANGO binary not found at {bin_path_abs}"
        return result
    
    # Check if executable
    if not os.access(bin_path_abs, os.X_OK):
        result["status"] = "no-exec-permission"
        result["reason"] = f"TANGO binary at {bin_path_abs} is not executable"
        return result
    
    # Try to get version (timeboxed to 2s)
    try:
        version_proc = subprocess.run(
            [bin_path_abs, "--version"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if version_proc.returncode == 0:
            result["version"] = version_proc.stdout.strip()[:100]
        else:
            # Some binaries don't support --version, try alternative
            try:
                version_proc = subprocess.run(
                    [bin_path_abs, "-v"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                if version_proc.returncode == 0:
                    result["version"] = version_proc.stdout.strip()[:100]
            except Exception:
                pass
    except subprocess.TimeoutExpired:
        result["reason"] = "Version check timed out (binary may be slow to start)"
    except Exception as e:
        result["reason"] = f"Version check failed: {str(e)}"
    
    result["status"] = "found"
    return result

# @app.get("/api/uniprot/ping")  # Moved to api/routes/uniprot.py
async def uniprot_ping():
    """
    Debug endpoint to test UniProt API connectivity.
    Executes a simple known-good query and returns status.
    """
    try:
        # Simple test query: get one reviewed human protein
        test_url = build_uniprot_export_url(
            query_string="organism_id:9606",
            format="tsv",
            reviewed=True,
            size=1,
        )
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "User-Agent": "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"
            }
            response = await client.get(test_url, headers=headers)
            response.raise_for_status()
            
            # Parse response
            import io
            raw_data = response.content
            df = read_any_table(raw_data, "uniprot_test.tsv")
            
            return {
                "status": "ok",
                "message": "UniProt API is reachable",
                "test_query": "organism_id:9606",
                "rows_returned": len(df),
                "sample_columns": list(df.columns) if len(df) > 0 else [],
            }
    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "message": f"UniProt API returned {e.response.status_code}",
            "error": str(e),
        }
    except httpx.TimeoutException:
        return {
            "status": "error",
            "message": "UniProt API request timed out",
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to connect to UniProt API: {str(e)}",
        }

# @app.post("/api/uniprot/parse", response_model=UniProtQueryParseResponse)  # Moved to api/routes/uniprot.py
async def parse_uniprot_query_endpoint(request: UniProtQueryParseRequest):
    """
    Parse a UniProt query string and detect its mode.
    
    Returns the detected mode (accession/keyword/organism/keyword_organism),
    extracted components, and the final API query string that will be executed.
    """
    parsed = parse_uniprot_query(request.query)
    
    return UniProtQueryParseResponse(
        mode=parsed.mode.value,
        accession=parsed.accession,
        keyword=parsed.keyword,
        organism_id=parsed.organism_id,
        normalized_query=parsed.normalized_query,
        api_query_string=parsed.api_query_string,
        error=parsed.error,
    )


# @app.post("/api/uniprot/window")  # Moved to api/routes/uniprot.py
async def window_sequences_endpoint(request: Dict):
    """
    Window protein sequences into peptides.
    
    Request body:
    {
        "sequences": [{"id": "P53_HUMAN", "sequence": "MEEPQSDPSV..."}],
        "windowSize": 20,
        "stepSize": 5
    }
    
    Response:
    {
        "peptides": [{"id": "...", "name": "...", "sequence": "...", "start": 1, "end": 20}]
    }
    """
    from services.uniprot import window_sequences
    
    sequences = request.get("sequences", [])
    window_size = int(request.get("windowSize", 20))
    step_size = int(request.get("stepSize", 5))
    
    peptides = window_sequences(sequences, window_size, step_size)
    
    log_info("uniprot_windowed", 
             f"Windowed {len(sequences)} sequences into {len(peptides)} peptides",
             sequences=len(sequences),
             peptides=len(peptides),
             window_size=window_size,
             step_size=step_size)
    
    return {"peptides": peptides}


# @app.post("/api/uniprot/execute", response_model=RowsResponse)  # Moved to api/routes/uniprot.py
async def execute_uniprot_query(request: UniProtQueryExecuteRequest):
    """
    Execute a UniProt query and return results as DataFrame-ready data.
    
    Parses the query (if mode is 'auto'), builds the UniProt API URL,
    fetches results, and returns them in a format compatible with the upload endpoint.
    """
    # Parse query if mode is auto or not provided
    if request.mode == "auto" or request.mode is None:
        parsed = parse_uniprot_query(request.query)
        api_query = parsed.api_query_string
        detected_mode = parsed.mode.value
        
        # Log the parsing result
        print(f"[UNIPROT][PARSE] Input: '{request.query}'")
        print(f"[UNIPROT][PARSE] Detected mode: {detected_mode}")
        print(f"[UNIPROT][PARSE] API query string: {api_query}")
        
        if parsed.error:
            raise HTTPException(status_code=400, detail=f"Query parsing error: {parsed.error}")
    else:
        # Use provided mode (simplified - for future enhancement)
        api_query = request.query
        detected_mode = request.mode
        print(f"[UNIPROT][EXECUTE] Using provided mode: {detected_mode}")
        print(f"[UNIPROT][EXECUTE] API query string: {api_query}")
    
    # Validate and normalize sort parameter
    # Frontend now sends UniProt format directly (e.g., "length asc"), but we validate against allowlist
    # Defensive: reject legacy "score" value explicitly and log what we receive
    log_info("uniprot_sort_received", f"Received sort parameter: {request.sort}", **{"received_sort": request.sort, "sort_type": type(request.sort).__name__})
    
    sort_value = None
    if request.sort:
        # Explicitly reject "score" (legacy value, should never be sent)
        # Handle both string "score" and any case variations
        sort_str = str(request.sort).strip().lower()
        if sort_str == "score":
            log_warning("uniprot_invalid_sort", f"Received invalid sort value 'score' (legacy), omitting sort", **{"received_sort": request.sort})
            # Don't raise error, just omit sort (treat as best match)
            sort_value = None
        else:
            # Strict allowlist for UniProt sort format: "fieldName asc|desc"
            # Accept both underscore format (length_asc) and space format (length asc)
            # Note: "reviewed" is NOT a valid sort field (it's a filter, not sortable)
            ALLOWED_SORTS = {
                "length asc", "length desc",
                "protein_name asc", "protein_name desc",
                "organism_name asc", "organism_name desc",
            }

            # Normalize underscore to space (length_asc -> length asc)
            import re as re_sort
            normalized_sort = request.sort
            normalized_sort = re_sort.sub(r'_asc$', ' asc', normalized_sort)
            normalized_sort = re_sort.sub(r'_desc$', ' desc', normalized_sort)

            if normalized_sort not in ALLOWED_SORTS:
                log_warning("uniprot_invalid_sort", f"Invalid sort value received: '{request.sort}'", **{"received_sort": request.sort, "allowed": sorted(ALLOWED_SORTS)})
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid sort value: '{request.sort}'. Allowed values: {sorted(ALLOWED_SORTS)} or omit for best match"
                )
            sort_value = normalized_sort  # Use normalized format for UniProt API
            log_info("uniprot_sort_valid", f"Using sort: {sort_value}", **{"sort": sort_value})
    else:
        log_info("uniprot_sort_omitted", "No sort parameter provided, using default (best match)")
    # If sort is None or empty, omit it (UniProt defaults to score/best match)
    
    # Build UniProt API URL with query controls
    # Only include length bounds if at least one is set (build_uniprot_export_url handles None correctly)
    uniprot_url = build_uniprot_export_url(
        api_query,
        format="tsv",
        reviewed=request.reviewed,
        length_min=request.length_min if request.length_min is not None else None,
        length_max=request.length_max if request.length_max is not None else None,
        sort=sort_value,  # None if not provided, otherwise validated sort value in UniProt format
        include_isoforms=request.include_isoforms or False,
        size=min(max(request.size or 500, 1), 500),  # Clamp between 1 and 500
    )
    
    # Log query controls and final URL (for debugging)
    log_info("uniprot_execute_start", "Executing UniProt query", **{
        "query": api_query,
        "reviewed": request.reviewed,
        "length_min": request.length_min,
        "length_max": request.length_max,
        "sort": sort_value,
        "size": request.size or 500,
    })
    # Log full encoded URL (no placeholder) - this is the exact URL that will be called
    log_info("uniprot_url", f"Full encoded UniProt URL: {uniprot_url}", **{"url": uniprot_url})
    print(f"[UNIPROT][URL] Full encoded URL: {uniprot_url}")
    
    try:
        # Fetch from UniProt REST API with User-Agent header
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "User-Agent": "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"
            }
            response = await client.get(uniprot_url, headers=headers)
            response.raise_for_status()
            
            # Parse TSV response
            import io
            raw_data = response.content
            
            # Use existing read_any_table function to parse TSV
            df = read_any_table(raw_data, "uniprot_export.tsv")
            
            # Log success
            log_info("uniprot_fetch_success", f"Retrieved {len(df)} rows from UniProt", **{"row_count": len(df), "columns": list(df.columns)})
            
            if len(df) == 0:
                log_warning("uniprot_no_results", "UniProt query returned 0 rows", **{"query": api_query, "url": uniprot_url})
                return {
                    "rows": [],
                    "meta": {
                        "source": "uniprot_api",
                        "query": request.query,
                        "api_query_string": api_query,
                        "mode": detected_mode,
                        "url": uniprot_url,
                        "row_count": 0,
                    },
                }
            
            # Run the same analysis pipeline as /api/upload-csv
            # This ensures computed metrics (FF-Helix, Charge, Hydrophobicity, μH, TANGO, PSIPRED) are available
            log_info("uniprot_analysis_start", "Running analysis pipeline on UniProt results")
            
            # Normalize columns first
            try:
                df = normalize_cols(df)
                log_info("uniprot_normalize_complete", f"Normalized columns: {list(df.columns)[:5]}...", **{"column_count": len(df.columns)})
            except Exception as e:
                log_warning("uniprot_normalize_warning", f"Column normalization warning: {e}", **{"error": str(e)})
            
            # Ensure required columns exist
            require_cols(df, ["Entry", "Sequence"])
            
            # If Length absent, derive from sequence
            if "Length" not in df.columns:
                df["Length"] = df["Sequence"].astype(str).str.len()
            
            # Compute FF-Helix %
            log_info("uniprot_ff_helix_start", "Computing FF-Helix % for UniProt sequences")
            ensure_ff_cols(df)
            ensure_computed_cols(df)
            log_info("uniprot_ff_helix_complete", f"Computed FF-Helix for {len(df)} peptides")
            
            # Provider execution tracking (initialize with deterministic flags)
            provider_status_meta = {
                "tango": {
                    "enabled": USE_TANGO,  # Will be updated if tango processing happens
                    "requested": False,  # Will be updated based on request.run_tango
                    "ran": False,
                    "status": "OFF",
                    "reason": None,
                    "stats": {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
                    "skipped_reason": None,
                    "runtime_ms": None,
                    "sequences_processed": 0,
                },
                "psipred": {
                    "status": "OFF",
                    "reason": None,
                    "stats": {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
                    "enabled": False,
                    "ran": False,
                    "skipped_reason": None,
                    "runtime_ms": None,
                    "sequences_processed": 0,
                },
            }
            
            # Secondary structure prediction via provider interface (only if explicitly requested)
            if request.run_psipred and USE_PSIPRED:
                start_time = time.time()
                try:
                    provider_status_meta["psipred"]["enabled"] = True
                    from services.secondary_structure import get_provider
                    provider = get_provider()
                    
                    # Limit sequences for provider processing
                    max_seqs = request.max_provider_sequences or 50
                    if len(df) > max_seqs:
                        log_info("uniprot_psipred_limit", f"Limiting PSIPRED to first {max_seqs} sequences (requested {len(df)})", **{"requested": len(df), "limited": max_seqs})
                        df_for_provider = df.head(max_seqs).copy()
                    else:
                        df_for_provider = df
                    
                    log_info("uniprot_secondary_structure_start", f"Starting {provider.get_name()} processing for UniProt results", **{"sequence_count": len(df_for_provider)})
                    provider.run(df_for_provider)
                    
                    # Merge results back if we processed a subset
                    if len(df) > max_seqs:
                        # Copy computed columns back to full dataframe
                        for col in ["Helix fragments (Psipred)", "Psipred helix %", "Psipred beta %", "FF-Helix %"]:
                            if col in df_for_provider.columns:
                                df[col] = df_for_provider[col].reindex(df.index, fill_value=df_for_provider[col].iloc[0] if len(df_for_provider) > 0 else None)
                    
                    provider_status_meta["psipred"]["ran"] = True
                    provider_status_meta["psipred"]["sequences_processed"] = len(df_for_provider)
                    log_info("uniprot_secondary_structure_complete", f"{provider.get_name()} processing complete")
                except Exception as e:
                    provider_status_meta["psipred"]["skipped_reason"] = str(e)
                    log_warning("uniprot_secondary_structure_error", f"Secondary structure provider error: {e}", **{"error": str(e)})
                finally:
                    provider_status_meta["psipred"]["runtime_ms"] = int((time.time() - start_time) * 1000)
            else:
                if not request.run_psipred:
                    provider_status_meta["psipred"]["skipped_reason"] = "Not requested (run_psipred=false)"
                elif not USE_PSIPRED:
                    provider_status_meta["psipred"]["skipped_reason"] = "PSIPRED disabled in environment"
                log_info("uniprot_psipred_skip", f"PSIPRED skipped: {provider_status_meta['psipred']['skipped_reason']}")
            
            # TANGO processing with deterministic toggle precedence:
            # 1. ENV USE_TANGO (if False, always skip regardless of request - PRIMARY GATE)
            # 2. Request flag (run_tango): False=skip, True=run
            # Note: Pydantic defaults run_tango=False (opt-in behavior for UniProt to ensure fast response)
            # To enable Tango for UniProt queries, client must explicitly set run_tango=True
            run_dir = None
            tango_start_time = None
            tango_enabled_flag = USE_TANGO
            tango_requested_flag = request.run_tango  # Use request flag directly (False=opt-in, True=run)
            try:
                # Primary gate: ENV must be True
                # Secondary gate: request flag must allow it (True or defaulted True)
                should_run_tango = tango_enabled_flag and tango_requested_flag
                if should_run_tango:
                    tango_start_time = time.time()
                    provider_status_meta["tango"]["enabled"] = tango_enabled_flag
                    provider_status_meta["tango"]["requested"] = tango_requested_flag
                    # Process all sequences - no limit for TANGO
                    log_info("uniprot_tango_start", f"Running TANGO for UniProt sequences", **{"sequence_count": len(df), "total_sequences": len(df)})
                    existed = tango.get_all_existed_tango_results_entries()
                    records = tango.create_tango_input(df, existed_tango_results=existed, force=True)
                    
                    if records:
                        log_info("uniprot_tango_run_start", f"Running TANGO for {len(records)} sequences", **{"sequence_count": len(records)})
                        # Add timeout protection: Tango should complete within reasonable time
                        # If it takes too long, we'll catch it and continue
                        try:
                            run_dir = tango.run_tango_simple(records)
                            log_info("uniprot_tango_run_complete", f"TANGO run completed, outputs in {run_dir}", **{"run_dir": run_dir})
                            provider_status_meta["tango"]["ran"] = True
                            provider_status_meta["tango"]["sequences_processed"] = len(records)
                        except Exception as e:
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"TANGO execution failed: {str(e)}"
                            provider_status_meta["tango"]["stats"] = {"requested": len(records) if records else 0, "parsed_ok": 0, "parsed_bad": len(records) if records else 0}
                            log_warning("uniprot_tango_execution_failed", f"TANGO execution failed: {e}", **{"error": str(e)})
                            run_dir = None
                    else:
                        log_info("uniprot_tango_skip", "No records to run (possibly all already processed).")
                        provider_status_meta["tango"]["skipped_reason"] = "No records to process"
                        run_dir = None
                    
                    # Parse TANGO outputs (only if we have a run_dir)
                    parse_stats = None
                    if run_dir:
                        try:
                            log_info("uniprot_tango_parse_start", "Parsing TANGO output files")
                            # Parse directly into the full dataframe
                            parse_stats = tango.process_tango_output(df, run_dir=run_dir)
                            
                            if parse_stats:
                                provider_status_meta["tango"]["stats"] = parse_stats
                            log_info("uniprot_tango_parse_complete", f"Parsed TANGO outputs: {parse_stats.get('parsed_ok', 0) if parse_stats else 0} OK, {parse_stats.get('parsed_bad', 0) if parse_stats else 0} failed" if parse_stats else f"Parsed TANGO outputs for {len(df)} peptides")
                        except ValueError as e:
                            from services.logger import get_trace_id
                            trace_id = get_trace_id()
                            
                            # ✅ Check if this is a fatal "0 outputs" error
                            if "TANGO produced 0 outputs" in str(e):
                                log_error("uniprot_tango_zero_outputs_ui", f"TANGO zero outputs error: {e}", 
                                        stage="tango_parse", **{"error": str(e), "run_dir": run_dir})
                                
                                # Capture to Sentry with context
                                if SENTRY_INITIALIZED:
                                    with sentry_sdk.push_scope() as scope:
                                        scope.set_tag("provider", "tango")
                                        scope.set_tag("stage", "parse")
                                        scope.set_tag("error_type", "zero_outputs")
                                        scope.set_tag("endpoint", "uniprot")
                                        scope.set_context("tango_parse", {
                                            "run_dir": run_dir if run_dir else None,
                                            "trace_id": trace_id,
                                        })
                                        sentry_sdk.capture_exception(e, level="error")
                                
                                error_detail = {
                                    "source": "tango",
                                    "error": str(e),
                                    "run_dir": run_dir if run_dir else None,
                                    "suspected_cause": parse_stats.get("reason", "Unknown") if parse_stats else "Unknown",
                                }
                                raise HTTPException(
                                    status_code=500,
                                    detail=json.dumps(error_detail)
                                )
                            
                            log_error("uniprot_tango_parse_failed", f"TANGO parse error: {e}", 
                                    stage="tango_parse", **{"error": str(e), "run_dir": run_dir})
                            
                            # Capture to Sentry with context
                            if SENTRY_INITIALIZED:
                                with sentry_sdk.push_scope() as scope:
                                    scope.set_tag("provider", "tango")
                                    scope.set_tag("stage", "parse")
                                    scope.set_tag("endpoint", "uniprot")
                                    scope.set_context("tango_parse", {
                                        "run_dir": run_dir if run_dir else None,
                                        "trace_id": trace_id,
                                    })
                                    sentry_sdk.capture_exception(e, level="error")
                            
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"Parse error: {str(e)}"
                            provider_status_meta["tango"]["stats"] = {"requested": len(records) if records else 0, "parsed_ok": 0, "parsed_bad": len(records) if records else 0}
                            # When provider status is UNAVAILABLE, set all dependent row fields to None (not -1/0)
                            n = len(df)
                            df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                            df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                            df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                            df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                            df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                        except Exception as e:
                            from services.logger import get_trace_id
                            trace_id = get_trace_id()
                            log_error("uniprot_tango_parse_error", f"Unexpected error during output processing: {e}", 
                                    stage="tango_parse", **{"error": str(e), "run_dir": run_dir})
                            
                            # Capture to Sentry with context
                            if SENTRY_INITIALIZED:
                                with sentry_sdk.push_scope() as scope:
                                    scope.set_tag("provider", "tango")
                                    scope.set_tag("stage", "parse")
                                    scope.set_tag("endpoint", "uniprot")
                                    scope.set_context("tango_parse", {
                                        "run_dir": run_dir if run_dir else None,
                                        "trace_id": trace_id,
                                    })
                                    sentry_sdk.capture_exception(e, level="error")
                            
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"Unexpected error: {str(e)}"
                            provider_status_meta["tango"]["stats"] = {"requested": len(records) if records else 0, "parsed_ok": 0, "parsed_bad": len(records) if records else 0}
                        
                        # Ensure %Helix / %β present from Tango if PSIPRED is off
                        _fill_percent_from_tango_if_missing(df)
                        
                        # Produce SSW prediction column
                        try:
                            log_info("uniprot_tango_filter_start", "Computing SSW predictions from TANGO results")
                            stats = {"uniprot": {}}
                            tango.filter_by_avg_diff(df, "uniprot", stats)
                            log_info("uniprot_tango_filter_complete", "SSW predictions computed")
                        except ValueError as e:
                            from services.logger import get_trace_id
                            trace_id = get_trace_id()
                            log_error("uniprot_tango_filter_failed", f"SSW prediction computation failed: {e}", 
                                    stage="tango_filter", **{"error": str(e)})
                            
                            # Capture to Sentry with context
                            if SENTRY_INITIALIZED:
                                with sentry_sdk.push_scope() as scope:
                                    scope.set_tag("provider", "tango")
                                    scope.set_tag("stage", "filter")
                                    scope.set_tag("endpoint", "uniprot")
                                    scope.set_context("tango_filter", {
                                        "trace_id": trace_id,
                                    })
                                    sentry_sdk.capture_exception(e, level="error")
                            
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"Filter error: {str(e)}"
                            n = len(df)
                            if "SSW prediction" not in df.columns:
                                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
                        except Exception as e:
                            from services.logger import get_trace_id
                            trace_id = get_trace_id()
                            log_error("uniprot_tango_filter_error", f"Could not compute SSW prediction: {e}", 
                                    stage="tango_filter", **{"error": str(e)})
                            
                            # Capture to Sentry with context
                            if SENTRY_INITIALIZED:
                                with sentry_sdk.push_scope() as scope:
                                    scope.set_tag("provider", "tango")
                                    scope.set_tag("stage", "filter")
                                    scope.set_tag("endpoint", "uniprot")
                                    scope.set_context("tango_filter", {
                                        "trace_id": trace_id,
                                    })
                                    sentry_sdk.capture_exception(e, level="error")
                            
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"SSW prediction error: {str(e)}"
                        
                        # Compute provider status based on parse stats (canonical rules)
                        if parse_stats:
                            parsed_ok = parse_stats.get("parsed_ok", 0)
                            requested = parse_stats.get("requested", 0)
                            if parsed_ok == 0 and requested > 0:
                                provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                                provider_status_meta["tango"]["reason"] = f"Runner failed; {parsed_ok}/{requested} parsed"
                                # When provider status is UNAVAILABLE, set all dependent row fields to None
                                n = len(df)
                                df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                                df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                                df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                                df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                                df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
                            elif 0 < parsed_ok < requested:
                                provider_status_meta["tango"]["status"] = "PARTIAL"
                                provider_status_meta["tango"]["reason"] = f"Only {parsed_ok}/{requested} sequences processed successfully"
                            elif parsed_ok == requested and requested > 0:
                                # All requested sequences processed successfully
                                provider_status_meta["tango"]["status"] = "AVAILABLE"
                                provider_status_meta["tango"]["reason"] = None
                            else:
                                provider_status_meta["tango"]["status"] = "OFF"
                                provider_status_meta["tango"]["reason"] = "No TANGO run attempted"
                else:
                    # Tango skipped - determine reason with deterministic precedence
                    provider_status_meta["tango"]["enabled"] = tango_enabled_flag
                    provider_status_meta["tango"]["requested"] = tango_requested_flag
                    provider_status_meta["tango"]["ran"] = False
                    
                    if not tango_enabled_flag:
                        # Primary gate: ENV USE_TANGO=false always wins
                        provider_status_meta["tango"]["status"] = "OFF"
                        provider_status_meta["tango"]["skipped_reason"] = "TANGO disabled in environment (USE_TANGO=0)"
                    elif not tango_requested_flag:
                        # Secondary gate: request explicitly disabled
                        provider_status_meta["tango"]["status"] = "OFF"
                        provider_status_meta["tango"]["skipped_reason"] = "Not requested (run_tango=false)"
                    else:
                        # Should not happen, but defensive
                        provider_status_meta["tango"]["status"] = "OFF"
                        provider_status_meta["tango"]["skipped_reason"] = "TANGO skipped (unknown reason)"
                    
                    log_info("uniprot_tango_skip", f"TANGO skipped: {provider_status_meta['tango']['skipped_reason']}", **{
                        "run_tango": tango_requested_flag,
                        "USE_TANGO": tango_enabled_flag,
                        "reason": provider_status_meta["tango"]["skipped_reason"]
                    })
                    
                    # Set stats for OFF case
                    if "stats" not in provider_status_meta["tango"]:
                        provider_status_meta["tango"]["stats"] = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
            except Exception as e:
                provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                provider_status_meta["tango"]["skipped_reason"] = f"Exception: {str(e)}"
                if "stats" not in provider_status_meta["tango"]:
                    provider_status_meta["tango"]["stats"] = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
                log_warning("uniprot_tango_error", f"TANGO error: {e} (continuing without Tango)", **{"error": str(e)})
            finally:
                if tango_start_time:
                    provider_status_meta["tango"]["runtime_ms"] = int((time.time() - tango_start_time) * 1000)
            
            # Compute biochemical features and flags
            log_info("uniprot_biochem_start", "Computing biochemical features (Charge, Hydrophobicity, μH)")
            calc_biochem(df)
            apply_ff_flags(df)
            _finalize_ui_aliases(df)
            finalize_ff_fields(df)
            log_info("uniprot_biochem_complete", f"Computed biochemical features for {len(df)} peptides")
            
            # Normalize rows for UI (with provider status tracking)
            log_info("uniprot_normalize_ui_start", "Normalizing rows for UI output")
            rows_out = normalize_rows_for_ui(
                df,
                is_single_row=False,
                tango_enabled=USE_TANGO,
                psipred_enabled=USE_PSIPRED,
                jpred_enabled=USE_JPRED
            )
            log_info("uniprot_normalize_ui_complete", f"Normalized {len(rows_out)} rows for UI", **{"row_count": len(rows_out)})
            
            # Calculate metadata (similar to upload-csv)
            jpred_hits = 0
            # Count rows with valid TANGO metrics (sswPrediction is not None/null)
            if "SSW prediction" in df.columns:
                ssw_hits = int(df["SSW prediction"].notna().sum())
                ssw_positives = int((df["SSW prediction"] == 1).sum())
            else:
                ssw_hits = 0
                ssw_positives = 0
            
            # Compute SSW positive % from final normalized rows (gate: only count rows with valid TANGO metrics)
            ssw_valid_count = 0
            ssw_positive_count = 0
            for row_dict in rows_out:
                # Use canonical sswPrediction field
                ssw_val = row_dict.get("sswPrediction")
                if ssw_val is not None and ssw_val != "null":
                    ssw_valid_count += 1
                    if isinstance(ssw_val, (int, float)) and ssw_val == 1:
                        ssw_positive_count += 1
            ssw_percent = round(100.0 * ssw_positive_count / ssw_valid_count, 1) if ssw_valid_count > 0 else None
            ff_avail = int((pd.to_numeric(df.get("FF-Helix %", pd.Series([-1]*len(df))), errors="coerce") != -1).sum())
            
            # Determine what actually ran (not just env flags)
            tango_actually_ran = provider_status_meta["tango"]["ran"]
            psipred_actually_ran = provider_status_meta["psipred"]["ran"]
            
            log_info("uniprot_analysis_complete", f"UniProt analysis complete", **{
                "total_rows": len(df),
                "jpred_hits": jpred_hits,
                "ssw_hits": ssw_hits,
                "ssw_positive_percent": ssw_percent,
                "ssw_positives": ssw_positives,
                "ff_helix_available": ff_avail,
                "tango_ran": tango_actually_ran,
                "psipred_ran": psipred_actually_ran,
            })
            
            # Update global state for /api/providers/last-run endpoint
            provider_status_to_save = provider_status_meta.copy()
            provider_status_to_save["total_rows"] = len(df)
            provider_status_to_save["ssw_rows_with_data"] = ssw_hits
            set_last_provider_status(provider_status_to_save)
            set_last_run_dir(run_dir if run_dir else tango._latest_run_dir())
            
            # Threshold config not supported in UniProt endpoint (use defaults)
            threshold_config_requested = None
            threshold_config_resolved = {
                "mode": "default",
                "version": "1.0.0"
            }
            
            # Compute reproducibility primitives (same as upload-csv)
            repro_run_id = str(uuid.uuid4())
            trace_id = get_trace_id_for_response()
            
            # Compute inputs_hash from query + size (deterministic)
            inputs_str = f"{request.query}:{request.size or 500}"
            inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]
            
            # Compute config_hash from configuration flags
            config_dict = {
                "USE_TANGO": USE_TANGO,
                "USE_PSIPRED": USE_PSIPRED,
                "USE_JPRED": USE_JPRED,
            }
            config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
            config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]
            
            # Build provider status summary
            provider_status_summary = {
                "tango": {
                    "status": provider_status_meta["tango"]["status"],
                    "requested": provider_status_meta["tango"].get("stats", {}).get("requested", 0),
                    "parsed_ok": provider_status_meta["tango"].get("stats", {}).get("parsed_ok", 0),
                    "parsed_bad": provider_status_meta["tango"].get("stats", {}).get("parsed_bad", 0),
                } if provider_status_meta["tango"]["enabled"] else None,
                "psipred": {
                    "status": "OFF" if not USE_PSIPRED else "UNKNOWN",
                },
                "jpred": {
                    "status": "OFF",
                },
            }
            
            # Resolve thresholds (deterministic computation based on mode)
            resolved_thresholds = resolve_thresholds(threshold_config_requested, df)
            
            return {
                "rows": rows_out,
                "meta": ensure_trace_id_in_meta({
                    "source": "uniprot_api",
                    "query": request.query,
                    "api_query_string": api_query,
                    "mode": detected_mode,
                    "url": uniprot_url,
                    "row_count": len(df),
                    "size_requested": request.size or 500,
                    "size_returned": len(df),
                    "use_jpred": USE_JPRED,
                    "jpred_rows": jpred_hits,
                    # Meta flags: use_tango reflects env setting, provider_status reflects actual runtime state
                    "use_tango": USE_TANGO,  # Env setting (for UI fallback compatibility)
                    "run_tango": request.run_tango,  # What was requested
                    "ssw_rows": ssw_hits,
                    "valid_seq_rows": len(df),
                    "provider_status": provider_status_meta,
                    # Reproducibility primitives
                    "runId": repro_run_id,
                    "traceId": trace_id,
                    "inputsHash": inputs_hash,
                    "configHash": config_hash,
                    "providerStatusSummary": provider_status_summary,
                    # Threshold configuration
                    "thresholdConfigRequested": threshold_config_requested,
                    "thresholdConfigResolved": threshold_config_resolved,
                    "thresholds": resolved_thresholds,
                }),
            }
            
    except httpx.HTTPStatusError as e:
        # Surface UniProt errors with correct status codes
        status_code = e.response.status_code
        try:
            # Try to parse error message from response
            error_text = e.response.text
            
            # Strip HTML tags and extract clean error message
            import re
            # Remove all HTML tags
            error_text = re.sub(r'<[^>]+>', '', error_text)
            # Collapse multiple whitespace into single space
            error_text = re.sub(r'\s+', ' ', error_text)
            error_text = error_text.strip()
            
            # Try to extract meaningful error message from common patterns
            # Look for error messages in various formats
            error_patterns = [
                r'Bad Request[:\s]+(.+?)(?:\.|$)',
                r'Invalid query[:\s]+(.+?)(?:\.|$)',
                r'Error[:\s]+(.+?)(?:\.|$)',
                r'HTTP Status \d+[:\s]+(.+?)(?:\.|$)',
            ]
            
            extracted_error = None
            for pattern in error_patterns:
                match = re.search(pattern, error_text, re.IGNORECASE)
                if match:
                    extracted_error = match.group(1).strip()
                    break
            
            if extracted_error and len(extracted_error) > 0:
                error_text = extracted_error
            elif not error_text or len(error_text) < 5:
                # Fallback to generic message if extraction failed
                error_text = f"Bad Request (HTTP {status_code})"
            
            # Limit error message length (keep first 200 chars for UI toast)
            error_text = error_text[:200] if len(error_text) > 200 else error_text
        except Exception:
            error_text = f"Bad Request (HTTP {status_code})"
        
        if status_code == 400:
            # UniProt returned 400 - try minimal fallback to narrow the culprit
            log_warning("uniprot_400_error", f"UniProt API returned 400: {error_text}", **{"status_code": 400, "original_url": uniprot_url})
            print(f"[UNIPROT][400] Original request failed. Trying minimal fallback...")
            
            # Build minimal fallback URL: format=json, minimal fields, no sort, no length
            minimal_fields = "accession,id,length"
            minimal_params = {
                "query": api_query,
                "format": "json",
                "fields": minimal_fields,
                "size": min(max(request.size or 500, 1), 500),
            }
            # Add reviewed filter if set (this is usually safe)
            if request.reviewed is True:
                # Add reviewed:true to query if not already present
                minimal_query = api_query
                if "reviewed:" not in minimal_query.lower():
                    minimal_query = f"{api_query} AND reviewed:true" if api_query else "reviewed:true"
                minimal_params["query"] = minimal_query
            elif request.reviewed is False:
                minimal_query = api_query
                if "reviewed:" not in minimal_query.lower():
                    minimal_query = f"{api_query} AND reviewed:false" if api_query else "reviewed:false"
                minimal_params["query"] = minimal_query
            
            minimal_url = httpx.URL("https://rest.uniprot.org/uniprotkb/search", params=minimal_params)
            minimal_url_str = str(minimal_url)
            log_info("uniprot_fallback_url", f"Minimal fallback URL: {minimal_url_str}", **{"url": minimal_url_str})
            print(f"[UNIPROT][FALLBACK] Minimal URL: {minimal_url_str}")
            
            try:
                # Try minimal request
                async with httpx.AsyncClient(timeout=30.0) as client:
                    headers = {
                        "User-Agent": "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"
                    }
                    fallback_response = await client.get(minimal_url_str, headers=headers)
                    fallback_response.raise_for_status()
                    
                    # Parse JSON response
                    fallback_data = fallback_response.json()
                    results = fallback_data.get("results", [])
                    
                    log_info("uniprot_fallback_success", f"Minimal fallback succeeded with {len(results)} results", **{"result_count": len(results)})
                    print(f"[UNIPROT][FALLBACK] Success! Got {len(results)} results. Original request likely had invalid sort/length/fields.")
                    
                    # Convert JSON results to DataFrame format
                    import io
                    # pandas is already imported at top of file as pd
                    
                    # Create DataFrame from minimal results
                    if results:
                        df_minimal = pd.DataFrame(results)
                        # Map fields to expected column names
                        column_mapping = {
                            "accession": "Entry",
                            "id": "Entry Name",
                            "length": "Length",
                        }
                        df_minimal = df_minimal.rename(columns=column_mapping)
                        
                        # Add missing required columns with defaults
                        if "Sequence" not in df_minimal.columns:
                            df_minimal["Sequence"] = ""
                        if "Entry" not in df_minimal.columns:
                            df_minimal["Entry"] = df_minimal.index
                        
                        # Run minimal analysis pipeline
                        try:
                            df_minimal = normalize_cols(df_minimal)
                            require_cols(df_minimal, ["Entry"])
                            if "Length" not in df_minimal.columns:
                                df_minimal["Length"] = 0
                            if "Sequence" not in df_minimal.columns:
                                df_minimal["Sequence"] = ""
                                df_minimal["Length"] = df_minimal["Sequence"].astype(str).str.len()
                            
                            ensure_ff_cols(df_minimal)
                            ensure_computed_cols(df_minimal)
                            calc_biochem(df_minimal)
                            apply_ff_flags(df_minimal)
                            _finalize_ui_aliases(df_minimal)
                            finalize_ff_fields(df_minimal)
                            
                            rows_out = normalize_rows_for_ui(
                                df_minimal,
                                is_single_row=False,
                                tango_enabled=False,
                                psipred_enabled=False,
                                jpred_enabled=False,
                            )
                            
                            return {
                                "rows": rows_out,
                                "meta": {
                                    "source": "uniprot_api",
                                    "query": request.query,
                                    "api_query_string": api_query,
                                    "mode": detected_mode,
                                    "url": minimal_url_str,
                                    "row_count": len(df_minimal),
                                    "note": "uniprot-minimal-fallback",
                                    "original_error": error_text[:200],
                                },
                            }
                        except Exception as analysis_error:
                            log_warning("uniprot_fallback_analysis_error", f"Error analyzing fallback results: {analysis_error}", **{"error": str(analysis_error)})
                            # Return raw results even if analysis fails
                            return {
                                "rows": [{"Entry": r.get("accession", ""), "Entry Name": r.get("id", ""), "Length": r.get("length", 0)} for r in results],
                                "meta": {
                                    "source": "uniprot_api",
                                    "query": request.query,
                                    "api_query_string": api_query,
                                    "mode": detected_mode,
                                    "url": minimal_url_str,
                                    "row_count": len(results),
                                    "note": "uniprot-minimal-fallback-raw",
                                    "original_error": error_text[:200],
                                },
                            }
                    else:
                        # Empty results from fallback
                        return {
                            "rows": [],
                            "meta": {
                                "source": "uniprot_api",
                                "query": request.query,
                                "api_query_string": api_query,
                                "mode": detected_mode,
                                "url": minimal_url_str,
                                "row_count": 0,
                                "note": "uniprot-minimal-fallback-empty",
                                "original_error": error_text[:200],
                            },
                        }
            except Exception as fallback_error:
                # Minimal fallback also failed - return original 400 error
                log_error("uniprot_fallback_failed", f"Minimal fallback also failed: {fallback_error}", **{"fallback_error": str(fallback_error)})
                print(f"[UNIPROT][FALLBACK] Minimal fallback also failed: {fallback_error}")
                # Return original 400 error
            raise HTTPException(
                status_code=400,
                detail=json.dumps({"source": "uniprot", "error": error_text})
            )
        elif status_code >= 500:
            # UniProt server errors (5xx) - return as 502 (bad gateway)
            error_msg = f"UniProt API server error ({status_code}): {error_text}"
            log_error("uniprot_api_error", error_msg, **{"status_code": status_code})
            raise HTTPException(status_code=502, detail=error_msg)
        else:
            # Other client errors (401, 403, etc.) - return as 400
            error_msg = f"UniProt API error ({status_code}): {error_text}"
            log_warning("uniprot_client_error", error_msg, **{"status_code": status_code})
            raise HTTPException(status_code=400, detail=json.dumps({"source": "uniprot", "error": error_msg}))
    except httpx.TimeoutException:
        error_msg = "UniProt API request timed out. Try reducing the result size or removing length/sort filters."
        log_error("uniprot_timeout", error_msg)
        raise HTTPException(status_code=504, detail=json.dumps({"source": "uniprot", "error": error_msg}))
    except Exception as e:
        error_msg = f"Failed to fetch from UniProt: {str(e)}"
        log_error("uniprot_error", error_msg, **{"error": str(e)})
        raise HTTPException(status_code=500, detail=error_msg)


# ---------------------------------------------------------------------
# Feedback endpoint
# ---------------------------------------------------------------------

# In-memory rate limiting for feedback (simple, per-IP)
_feedback_rate_limit: Dict[str, List[float]] = {}

def _check_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded rate limit (5 requests per 10 minutes)."""
    now = time.time()
    window_start = now - 600  # 10 minutes in seconds
    
    # Clean old entries
    if ip in _feedback_rate_limit:
        _feedback_rate_limit[ip] = [t for t in _feedback_rate_limit[ip] if t > window_start]
    
    # Check limit
    if ip not in _feedback_rate_limit:
        _feedback_rate_limit[ip] = []
    
    request_times = _feedback_rate_limit[ip]
    
    # Allow at most 5 requests
    if len(request_times) >= 5:
        return False
    
    # Add current request time
    request_times.append(now)
    return True


class FeedbackRequest(BaseModel):
    message: str
    pageUrl: Optional[str] = None
    userAgent: Optional[str] = None
    screenshot: Optional[str] = None  # Base64 encoded image


# @app.post("/api/feedback")  # Moved to api/routes/feedback.py
async def submit_feedback(request: Request, feedback_data: FeedbackRequest = Body(...)):
    """
    Submit user feedback. Sends to Sentry as an INFO-level event that can trigger email alerts.
    Returns {ok: true} even if Sentry is not initialized.
    """
    # Get client IP for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    
    # Rate limiting check
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many feedback submissions. Please wait a few minutes.")
    
    # Validate message
    message = feedback_data.message.strip()
    if len(message) < 5:
        raise HTTPException(status_code=400, detail="Message must be at least 5 characters")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message must not exceed 2000 characters")
    
    # Validate and decode screenshot if provided
    screenshot_bytes = None
    screenshot_filename = None
    screenshot_content_type = None
    
    if feedback_data.screenshot:
        try:
            # Validate base64 format and extract image data
            if not feedback_data.screenshot.startswith('data:image/'):
                raise HTTPException(status_code=400, detail="Invalid screenshot format. Must be a valid image.")
            
            # Parse data URL: data:image/png;base64,<data>
            parts = feedback_data.screenshot.split(',', 1)
            if len(parts) != 2:
                raise HTTPException(status_code=400, detail="Invalid screenshot data format.")
            
            header = parts[0]  # data:image/png;base64
            base64_data = parts[1]
            
            # Extract content type
            if 'image/png' in header:
                screenshot_content_type = 'image/png'
                screenshot_filename = 'feedback_screenshot.png'
            elif 'image/jpeg' in header or 'image/jpg' in header:
                screenshot_content_type = 'image/jpeg'
                screenshot_filename = 'feedback_screenshot.jpg'
            elif 'image/gif' in header:
                screenshot_content_type = 'image/gif'
                screenshot_filename = 'feedback_screenshot.gif'
            elif 'image/webp' in header:
                screenshot_content_type = 'image/webp'
                screenshot_filename = 'feedback_screenshot.webp'
            else:
                screenshot_content_type = 'image/png'  # default
                screenshot_filename = 'feedback_screenshot.png'
            
            # Check size (max 5MB base64)
            if len(feedback_data.screenshot) > 7 * 1024 * 1024:  # ~5MB when decoded
                raise HTTPException(status_code=400, detail="Screenshot too large. Maximum size is 5MB.")
            
            # Decode base64 to bytes
            screenshot_bytes = base64.b64decode(base64_data)
            
            # Verify decoded size
            if len(screenshot_bytes) > 5 * 1024 * 1024:  # 5MB
                raise HTTPException(status_code=400, detail="Screenshot too large. Maximum size is 5MB.")
                
        except HTTPException:
            raise
        except base64.binascii.Error:
            raise HTTPException(status_code=400, detail="Invalid base64 screenshot data.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid screenshot data: {str(e)}")
    
    # Send to Sentry as INFO-level event (creates an issue and can trigger alerts)
    if SENTRY_INITIALIZED:
        try:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("kind", "user_feedback")
                scope.set_tag("source", "feedback_button")
                if feedback_data.pageUrl:
                    scope.set_extra("pageUrl", feedback_data.pageUrl)
                if feedback_data.userAgent:
                    scope.set_extra("userAgent", feedback_data.userAgent)
                
                # Use the actual user message as the Sentry message (truncate to 200 chars for title)
                message_title = message[:200] + "..." if len(message) > 200 else message
                scope.set_extra("full_message", message)  # Full message in extra data
                
                # Add screenshot as attachment if provided (this makes it display as image, not text)
                # Python SDK's add_attachment requires a file path, so we create a temp file
                temp_file_path = None
                if screenshot_bytes and screenshot_filename:
                    try:
                        # Create temporary file for attachment
                        import tempfile
                        temp_fd, temp_file_path = tempfile.mkstemp(suffix='.png' if 'png' in screenshot_filename else '.jpg')
                        with os.fdopen(temp_fd, 'wb') as temp_file:
                            temp_file.write(screenshot_bytes)
                        
                        # Add attachment using file path (Python SDK uses file paths)
                        # The file must exist when capture_message is called
                        if hasattr(scope, 'add_attachment'):
                            try:
                                # Try with file path (most common Python SDK API)
                                scope.add_attachment(
                                    path=temp_file_path,
                                    filename=screenshot_filename,
                                    content_type=screenshot_content_type or 'image/png'
                                )
                                scope.set_extra("has_screenshot", True)
                            except (TypeError, ValueError) as e:
                                # If path doesn't work, try bytes
                                try:
                                    scope.add_attachment(
                                        bytes=screenshot_bytes,
                                        filename=screenshot_filename,
                                        content_type=screenshot_content_type or 'image/png'
                                    )
                                    scope.set_extra("has_screenshot", True)
                                except Exception:
                                    log_warning("feedback_attachment_failed", f"add_attachment failed: {e}")
                                    scope.set_extra("has_screenshot", False)
                        else:
                            log_warning("feedback_attachment_api", "add_attachment method not available on scope")
                            scope.set_extra("has_screenshot", False)
                    except Exception as attach_error:
                        # If attachment fails, log warning but continue without attachment
                        log_warning("feedback_attachment_failed", f"Failed to add screenshot attachment: {attach_error}", **{"error": str(attach_error)})
                        scope.set_extra("has_screenshot", False)
                        scope.set_extra("screenshot_error", str(attach_error))
                
                # Capture with user's actual message as the title
                # The temp file must still exist at this point for attachment to work
                sentry_sdk.capture_message(f"User Feedback: {message_title}", level="info")
                
                # Clean up temp file after capture
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.unlink(temp_file_path)
                    except Exception:
                        pass  # Ignore cleanup errors
        except Exception as e:
            # If Sentry fails, log warning but don't fail the request
            log_warning("feedback_sentry_failed", f"Failed to send feedback to Sentry: {e}", **{"error": str(e)})
    else:
        log_warning("feedback_sentry_disabled", "Feedback submitted but Sentry not initialized (SENTRY_DSN not set)")
    
    return {"ok": True}

# Import app from api/main.py at the end so uvicorn can find it
# This must be at the end after all function definitions
from api.main import app, SENTRY_INITIALIZED

