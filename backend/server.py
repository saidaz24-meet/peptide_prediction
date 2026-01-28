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
from calculations.biochem import calculate_biochemical_features as calc_biochem
from services.normalize import (
    canonicalize_headers,
    normalize_cols,
    create_single_sequence_df,
    finalize_ui_aliases as _finalize_ui_aliases,
    finalize_ff_fields,
    normalize_rows_for_ui,
)
from services.thresholds import resolve_thresholds
from services.uniprot_query import parse_uniprot_query, build_uniprot_export_url
from schemas.uniprot_query import UniProtQueryParseRequest, UniProtQueryParseResponse, UniProtQueryExecuteRequest
from services.logger import get_logger, set_trace_id, log_info, log_warning, log_error
import httpx

from dotenv import load_dotenv
# Explicitly point to backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# If you use python-dotenv, make sure .env is loaded before reading env vars:
from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
except Exception:
    pass

# Initialize Sentry before FastAPI app creation
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

# Sentry DSN must be provided via SENTRY_DSN environment variable
# Never hardcode DSNs in source code
SENTRY_DSN = os.getenv("SENTRY_DSN")
SENTRY_INITIALIZED = False
if SENTRY_DSN:
    try:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[FastApiIntegration()],
            # Add data like request headers and IP for users
            send_default_pii=True,
            # Set traces_sample_rate to 1.0 to capture 100% of transactions for performance monitoring
            # Adjust this value in production
            traces_sample_rate=0.1,
            # Set profiles_sample_rate to profile 10% of sampled transactions
            profiles_sample_rate=0.1,
            # Environment for filtering in Sentry dashboard
            environment=os.getenv("ENVIRONMENT", "development"),
            # Enable debug mode to see what Sentry is doing (disable in production)
            debug=os.getenv("SENTRY_DEBUG", "false").lower() == "true",
        )
        SENTRY_INITIALIZED = True
        print("[SENTRY] Initialized successfully")
        # Send a test message to verify connection
        sentry_sdk.capture_message("Sentry backend initialized", level="info")
    except Exception as e:
        print(f"[SENTRY] Failed to initialize: {e}")
        SENTRY_INITIALIZED = False
else:
    print("[SENTRY] No DSN provided (SENTRY_DSN env var not set), Sentry disabled")

def env_true(name: str, default: bool = True) -> bool:
    """Treat 1/true/yes/on (case-insensitive) as True; 0/false/no/off as False."""
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")

# Debug entry for tracing specific peptide through pipeline
DEBUG_ENTRY = os.getenv("DEBUG_ENTRY", "").strip()

# JPred disabled - kept for reference only, not used functionally
USE_JPRED = False  # Always disabled
# Use env_true for consistent environment variable parsing (accepts 1/true/yes/on)
USE_TANGO = env_true("USE_TANGO", True)
USE_PSIPRED = env_true("USE_PSIPRED", True)

use_simple = os.getenv("TANGO_MODE", "simple").lower() == "simple"

app = FastAPI(title="Peptide Prediction Service")

# Add exception handler to capture HTTPExceptions to Sentry
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Capture HTTPExceptions to Sentry.
    By default, FastApiIntegration only captures 5xx errors.
    This handler captures important 4xx errors too.
    """
    # Capture 5xx errors as errors, important 4xx as warnings
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc, level="error")
    elif exc.status_code in [400, 401, 403, 404, 422]:
        # Capture common 4xx errors as warnings (optional - remove if too noisy)
        sentry_sdk.capture_exception(exc, level="warning")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Structured logging setup
logger = get_logger()

# Middleware to attach traceId to each request
class TraceIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Generate or use existing traceId from header (full uuid4 for uniqueness)
        trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
        set_trace_id(trace_id)
        
        # Store trace_id in request state for access in handlers
        request.state.trace_id = trace_id
        
        # Log request start
        log_info("request_start", f"{request.method} {request.url.path}", **{
            "method": request.method,
            "path": request.url.path,
            "stage": "request",
        })
        
        try:
            response = await call_next(request)
            log_info("request_end", f"{request.method} {request.url.path} {response.status_code}", **{
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "stage": "request",
            })
            return response
        except Exception as e:
            log_error("request_error", f"{request.method} {request.url.path} failed: {e}", **{
                "method": request.method,
                "path": request.url.path,
                "error": str(e),
                "stage": "request",
            })
            # Capture exception to Sentry (will be filtered by FastApiIntegration for HTTPExceptions)
            sentry_sdk.capture_exception(e, level="error")
            raise

def ensure_ff_cols(df):
    df["FF-Helix %"] = df["Sequence"].astype(str).apply(ff_helix_percent)
    df["FF Helix fragments"] = df["Sequence"].astype(str).apply(ff_helix_cores)

# --- Example dataset config ---
BASE_DIR = Path(__file__).resolve().parent.parent  # adjust one/two levels as needed
EXAMPLE_PATH = BASE_DIR / "ui" / "public" / "Final_Staphylococcus_2023_new.xlsx"

# columns that mean “we already have results” so don’t recompute
JPRED_COLS = ["Helix fragments (Jpred)", "Helix score (Jpred)"]
TANGO_COLS = ["SSW prediction", "SSW score"]
BIOCHEM_COLS = ["Charge", "Hydrophobicity", "Full length uH"]

def has_any(df: pd.DataFrame, cols: list[str]) -> bool:
    return any(c in df.columns for c in cols)

def has_all(df: pd.DataFrame, cols: list[str]) -> bool:
    return all(c in df.columns for c in cols)

# CORS for local dev (Vite on :5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add TraceIdMiddleware last (so it executes first/outermost and captures all requests)
app.add_middleware(TraceIdMiddleware)

log_info("boot", f"USE_JPRED={USE_JPRED} • USE_TANGO={USE_TANGO}")



# --- UI compatibility shims (naming + per-row flags) ---
# _finalize_ui_aliases is now imported from services.normalize as finalize_ui_aliases



# Add these functions to your server.py file

# normalize_cols is now imported from services.normalize

def ensure_cols(df: pd.DataFrame):
    """Ensure all required columns exist with default values."""
    required_cols = [
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Beta full length uH", "SSW prediction", "SSW score", "SSW diff",
        "SSW helix percentage", "SSW beta percentage",
        "FF-Secondary structure switch", "FF-Helix (Jpred)"
    ]
    
    for col in required_cols:
        if col not in df.columns:
            if col == "Helix fragments (Jpred)":
                df[col] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[col] = -1

def ff_flags(df: pd.DataFrame):
    """Calculate FF flags based on existing data."""
    # This function should compute your final FF flags
    # For now, just ensure the columns exist
    if "FF-Helix (Jpred)" not in df.columns:
        df["FF-Helix (Jpred)"] = -1
    if "FF-Secondary structure switch" not in df.columns:
        df["FF-Secondary structure switch"] = -1


@app.get("/api/example")
def load_example(recalc: int = 0):
    """
    Serve the presentation dataset with JPred/Tango already computed.
    By default (recalc=0) we DO NOT recompute biochem/JPred/Tango.
    Set recalc=1 if you explicitly want to recompute locally.
    """
    if not os.path.exists(EXAMPLE_PATH):
        raise HTTPException(status_code=404, detail=f"Example file not found at {EXAMPLE_PATH}")

    try:
        df = pd.read_excel(EXAMPLE_PATH)  # needs openpyxl
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed reading example xlsx: {e}")

    # Normalize essential columns but DO NOT drop precomputed fields
    try:
        df = normalize_cols(df)  # your existing helper: maps Entry/Sequence/Length
    except HTTPException:
        # for legacy sheets, derive Length if missing
        if "Sequence" in df.columns and "Length" not in df.columns:
            df["Length"] = df["Sequence"].astype(str).str.len()

    # Decide what to compute based on what's already present
    already_has_biochem = has_all(df, BIOCHEM_COLS)
    already_has_jpred  = has_any(df, JPRED_COLS)
    already_has_tango  = has_any(df, TANGO_COLS)

    # Recompute only if asked (recalc=1) or missing
    if recalc or not already_has_biochem:
        ensure_cols(df)     # creates missing cols with -1
        calc_biochem(df)    # computes Charge, Hydrophobicity, uH
    else:
        # ensure numeric types for charts
        for c in BIOCHEM_COLS:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")

    # JPred disabled - kept for reference only
    # Secondary structure predictions will be handled by a flexible interface in the future
    already_has_jpred = False

    if recalc or (USE_TANGO and not already_has_tango):
        try:
            # whichever Tango flow you use; if you switched to run_and_attach, call that
            if hasattr(tango, "run_and_attach"):
                tango.run_and_attach(df)
            else:
                try:
                    # For example dataset, use latest run (backward compatibility)
                    tango.process_tango_output(df, run_dir=None)
                except ValueError as e:
                    print(f"[TANGO][ERROR] {e}")
                    print("[TANGO] Provider status: FAILED - continuing without Tango results")
                except Exception as e:
                    print(f"[TANGO][WARN] Unexpected error during output processing: {e}")
                
                try:
                    tango.filter_by_avg_diff(df, "Example", {"Example": {}})
                except ValueError as e:
                    print(f"[TANGO][ERROR] {e}")
                    print("[TANGO] Provider status: FAILED - SSW prediction computation failed")
                except Exception as e:
                    print(f"[WARN] Tango filter failed (example): {e}")
        except Exception as e:
            print(f"[WARN] Tango parse failed (example): {e}")

    # Always compute final FF flags on the DataFrame we’re returning
    ensure_cols(df)
    ff_flags(df)

    # build meta so the UI can show provenance pills
    meta = {
            "use_jpred": False,  # JPred disabled - kept for reference only
        "use_tango": USE_TANGO or already_has_tango,
        "jpred_rows": int((df.get("Helix fragments (Jpred)", pd.Series([-1]*len(df))) != -1).sum()),
        "ssw_rows":   int((df.get("SSW prediction", pd.Series([-1]*len(df))) != -1).sum()),
        "valid_seq_rows": int(df["Sequence"].notna().sum())
    }
    print(f"[EXAMPLE] rows={len(df)} • JPred rows={meta['jpred_rows']} • Tango rows={meta['ssw_rows']} • recalc={recalc}")

    # Normalize to canonical camelCase using PeptideSchema (with provider status - Principle B)
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=USE_TANGO or already_has_tango,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=False  # JPred disabled
    )

    return {"rows": rows_out, "meta": meta}

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/test-sentry")
async def test_sentry():
    """
    Test endpoint to verify Sentry connection.
    Sends different types of test events to Sentry.
    """
    import sentry_sdk
    
    results = {
        "sentry_initialized": SENTRY_INITIALIZED,
        "sentry_dsn_configured": bool(SENTRY_DSN),  # Don't expose actual DSN
        "tests": {}
    }
    
    if not SENTRY_INITIALIZED:
        return {
            **results,
            "error": "Sentry not initialized. Check DSN and initialization logs."
        }
    
    # Test 1: Send a simple message
    try:
        sentry_sdk.capture_message("Test message from /api/test-sentry", level="info")
        results["tests"]["message"] = "sent"
    except Exception as e:
        results["tests"]["message"] = f"failed: {str(e)}"
    
    # Test 2: Send an exception
    try:
        test_error = ValueError("Test exception from /api/test-sentry")
        sentry_sdk.capture_exception(test_error, level="error")
        results["tests"]["exception"] = "sent"
    except Exception as e:
        results["tests"]["exception"] = f"failed: {str(e)}"
    
    # Test 3: Trigger an HTTPException (5xx)
    try:
        raise HTTPException(status_code=500, detail="Test 500 error from /api/test-sentry")
    except HTTPException as e:
        # This will be caught by the exception handler and sent to Sentry
        results["tests"]["http_500"] = "triggered"
        raise
    
    return results

@app.get("/api/test-sentry-simple")
async def test_sentry_simple():
    """
    Simple test that just sends a message to Sentry.
    Check your Sentry dashboard after calling this.
    """
    import sentry_sdk
    
    if not SENTRY_INITIALIZED:
        raise HTTPException(status_code=503, detail="Sentry not initialized")
    
    # Send a test message
    event_id = sentry_sdk.capture_message(
        f"Test from backend at {time.time()}",
        level="info"
    )
    
    return {
        "status": "sent",
        "event_id": event_id,
        "message": "Check your Sentry dashboard for this event",
        "sentry_configured": True,
    }

# sanitize_seq is now in calculations.biochem

# canonicalize_headers is now imported from services.normalize

def require_cols(df: pd.DataFrame, cols: List[str]):
    """
    Validate that required columns exist in the DataFrame.
    
    Args:
        df: DataFrame to validate
        cols: List of required column names
    
    Raises:
        HTTPException 400: If any required columns are missing
    """
    missing = [c for c in cols if c not in df.columns]
    if missing:
        available = list(df.columns)
        # Provide helpful suggestions for common column name variations
        suggestions = {}
        for col in missing:
            col_lower = col.lower()
            matches = [c for c in available if c.lower() == col_lower or col_lower in c.lower() or c.lower() in col_lower]
            if matches:
                suggestions[col] = matches[:3]  # Top 3 matches
        
        suggestion_text = ""
        if suggestions:
            suggestion_parts = []
            for req_col, matches in suggestions.items():
                # Build quoted matches list to avoid nested f-string syntax issues
                quoted_matches = ', '.join(f"'{m}'" for m in matches)
                suggestion_parts.append(f"  '{req_col}' might be: {quoted_matches}")
            suggestion_text = "\n" + "\n".join(suggestion_parts)
        
        detail_msg = (
            f"Missing required column(s): {missing}. "
            f"Available columns: {available}. "
            f"Required columns: {cols}. "
            f"Ensure your file contains at least an ID field (Entry/Accession/ID) and 'Sequence'. "
            f"Accepted file formats: .csv, .tsv, .xlsx, .xls, .txt."
        )
        if suggestion_text:
            detail_msg += suggestion_text
        
        raise HTTPException(400, detail=detail_msg)

def read_any_table(raw: bytes, filename: str) -> pd.DataFrame:
    """
    Read CSV/TSV/XLS(X) with intelligent delimiter detection and BOM handling.
    
    Supported formats:
    - .csv, .txt (comma-separated)
    - .tsv (tab-separated)
    - .xlsx, .xls (Excel files)
    
    Normalization:
    - Strips UTF-8 BOM if present (utf-8-sig encoding)
    - Normalizes line endings (handled by pandas)
    - Auto-detects delimiter when file extension is ambiguous
    
    Args:
        raw: File contents as bytes
        filename: Original filename (used for extension-based detection)
    
    Returns:
        DataFrame with parsed data
    
    Raises:
        ValueError: If file format is not supported or parsing fails
    """
    fn = filename.lower() if filename else ""
    
    # Normalize input: strip BOM and normalize line endings
    # utf-8-sig encoding automatically strips BOM
    # pandas handles line ending normalization internally
    
    # Excel files (.xlsx, .xls)
    if fn.endswith((".xlsx", ".xls")):
        try:
            bio = io.BytesIO(raw)
            return pd.read_excel(bio, engine='openpyxl' if fn.endswith('.xlsx') else None)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file {filename}: {e}. "
                           f"Ensure file is a valid .xlsx or .xls file. "
                           f"If using .xlsx, openpyxl must be installed.")

    # TSV files (.tsv) - tab-separated
    if fn.endswith(".tsv"):
        try:
            return pd.read_csv(
                io.BytesIO(raw),
                sep="\t",
                encoding="utf-8-sig",  # Strips BOM
                engine="python"  # More lenient with malformed files
            )
        except Exception as e:
            raise ValueError(f"Failed to parse TSV file {filename}: {e}. "
                           f"Ensure file uses tab-separated values.")

    # CSV or TXT files - try extension-based detection, then auto-detect
    if fn.endswith((".csv", ".txt")):
        # First try comma-separated (most common for .csv)
        if fn.endswith(".csv"):
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=",",  # Explicit comma for .csv
                    encoding="utf-8-sig",  # Strips BOM
                    engine="python"
                )
            except Exception:
                # Fallback: let pandas auto-detect delimiter
                try:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep=None,  # Auto-detect
                        engine="python",
                        encoding="utf-8-sig"
                    )
                except Exception as e:
                    raise ValueError(f"Failed to parse CSV file {filename}: {e}. "
                                   f"Ensure file uses comma-separated values.")

        # .txt files - auto-detect delimiter (could be CSV or TSV)
        else:
            # Try auto-detection first
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=None,  # Auto-detect delimiter
                    engine="python",
                    encoding="utf-8-sig"
                )
            except Exception:
                # Fallback: try tab, then comma
                try:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep="\t",
                        encoding="utf-8-sig",
                        engine="python"
                    )
                except Exception:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep=",",
                        encoding="utf-8-sig",
                        engine="python"
                    )

    # Unknown extension - try auto-detection
    try:
        return pd.read_csv(
            io.BytesIO(raw),
            sep=None,  # Auto-detect delimiter
            engine="python",
            encoding="utf-8-sig"
        )
    except Exception as e:
        raise ValueError(f"Unsupported file format: {filename}. "
                       f"Accepted formats: .csv, .tsv, .xlsx, .xls, .txt. "
                       f"Error: {e}")

# ---------- NEW: small utilities for FF + percents ----------
def ensure_computed_cols(df: pd.DataFrame):
    for c in [
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Helix fragments (Jpred)", "Helix score (Jpred)",
        "SSW prediction", "SSW score", "Beta full length uH"
    ]:
        if c not in df.columns:
            if c == "Helix fragments (Jpred)":
                # object dtype column of empty lists
                df[c] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[c] = -1

# _to_segments is now in calculations.biochem
# _sanitize_for_json is now in services.normalize
# calc_biochem is now imported from calculations.biochem

def apply_ff_flags(df: pd.DataFrame):
    ssw_avg_H = df[df["SSW prediction"] != 1]["Hydrophobicity"].mean()
    jpred_avg_uH = df[df["Helix (Jpred) uH"] != -1]["Helix (Jpred) uH"].mean()
    df["FF-Secondary structure switch"] = [
        1 if r["SSW prediction"] == 1 and r["Hydrophobicity"] >= ssw_avg_H else -1
        for _, r in df.iterrows()
    ]
    df["FF-Helix (Jpred)"] = [
        1 if r["Helix (Jpred) uH"] != -1 and r["Helix (Jpred) uH"] >= jpred_avg_uH else -1
        for _, r in df.iterrows()
    ]

def _fill_percent_from_tango_if_missing(df: pd.DataFrame) -> None:
    """
    If PSIPRED is off, ensure percent content fields exist using Tango merges.
    (Your tango.process_tango_output already sets these for each row.)
    We just guarantee presence + numeric dtype so the UI cards can compute means.
    """
    for col in ["SSW helix percentage", "SSW beta percentage"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

def _chameleon_percent(df: pd.DataFrame) -> float:
    """Percent of rows that are chameleon-positive (SSW prediction == 1)."""
    if "SSW prediction" not in df.columns or len(df) == 0:
        return 0.0
    pos = int((df["SSW prediction"] == 1).sum())
    return round(100.0 * pos / len(df), 1)

# ---------- Endpoints ----------

@app.post("/api/upload-csv")
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
    """
    # Use env var or query param for debug entry
    trace_entry = debug_entry or DEBUG_ENTRY
    if trace_entry:
        log_info("upload_trace_entry", f"Tracing entry: {trace_entry}", entry=trace_entry)
    
    # Parse thresholdConfig if provided
    threshold_config_requested = None
    if thresholdConfig:
        try:
            threshold_config_requested = json.loads(thresholdConfig)
        except json.JSONDecodeError:
            # Invalid JSON, log warning but continue with defaults
            log_warning("threshold_config_invalid", f"Invalid thresholdConfig JSON: {thresholdConfig}", **{"error": "JSON decode failed"})
    
    # Resolve threshold config (use defaults for now, no behavior changes)
    threshold_config_resolved = {
        "mode": "default",
        "version": "1.0.0"
    }
    if threshold_config_requested:
        # Echo requested config structure (validation/resolution to be added later)
        threshold_config_resolved = {
            "mode": threshold_config_requested.get("mode", "default"),
            "version": threshold_config_requested.get("version", "1.0.0"),
            "custom": threshold_config_requested.get("custom") if threshold_config_requested.get("mode") == "custom" else None,
        }
    
    # Validate file format upfront
    if not file.filename:
        raise HTTPException(400, detail="File must have a filename. "
                                       "Accepted formats: .csv, .tsv, .xlsx, .xls, .txt")
    
    file_ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ""
    if file_ext not in ["csv", "tsv", "xlsx", "xls", "txt"]:
        raise HTTPException(400, detail=f"Unsupported file format: '{file_ext}'. "
                                       "Accepted formats: .csv (comma-separated), .tsv (tab-separated), "
                                       ".xlsx/.xls (Excel), .txt (auto-detect delimiter).")
    
    log_info("upload_parse_start", f"Parsing file: {file.filename}", stage="parse")
    raw = await file.read()
    
    # Validate file is not empty
    if len(raw) == 0:
        raise HTTPException(400, detail="Uploaded file is empty. "
                                       "Please upload a non-empty file with at least one data row.")
    
    try:
        df = read_any_table(raw, file.filename)
        log_info("upload_parse_complete", f"Parsed {len(df)} rows from {file.filename}", 
                stage="parse", **{"row_count": len(df), "upload_filename": file.filename})
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

    log_info("normalize_start", "Normalizing column headers", stage="normalize")
    df = normalize_cols(df)
    log_info("normalize_complete", f"Normalized columns: {list(df.columns)[:5]}...", 
            stage="normalize", **{"column_count": len(df.columns)})
    # normalize_cols already converts lowercase to capitalized (entry->Entry, sequence->Sequence)
    require_cols(df, ["Entry", "Sequence"])

    # if Length absent, derive from sequence
    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    # Step 2 (already present): compute FF-Helix %
    log_info("ff_helix_compute_start", "Computing FF-Helix % for all sequences")
    ensure_ff_cols(df)
    ensure_computed_cols(df)
    log_info("ff_helix_complete", f"Computed FF-Helix for {len(df)} peptides")

    # Secondary structure prediction via provider interface
    # See backend/services/secondary_structure.py for provider abstraction
    from services.secondary_structure import get_provider
    try:
        provider = get_provider()
        log_info("secondary_structure_start", f"Starting {provider.get_name()} processing")
        provider.run(df)
        log_info("secondary_structure_complete", f"{provider.get_name()} processing complete")
    except Exception as e:
        log_warning("secondary_structure_error", f"Secondary structure provider error: {e}", **{"error": str(e)})

    # JPred disabled - kept for reference only
    # Secondary structure predictions will be handled by a flexible interface in the future

    # --- TANGO (simple mac runner) -----------------------------------------
    # Provider toggle precedence: ENV USE_TANGO (if False, always skip) > request flag
    # For /api/upload-csv: Always run if USE_TANGO=true (no request flag, consistent behavior)
    tango_stats = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
    tango_provider_status = "OFF"
    tango_provider_reason = None
    tango_enabled_flag = USE_TANGO  # Env flag (primary gate)
    tango_requested_flag = True  # Upload CSV always requests Tango if enabled
    tango_ran = False
    try:
        if tango_enabled_flag:
            # Build fresh records (Entry, Sequence) from df
            existed = tango.get_all_existed_tango_results_entries()
            records = tango.create_tango_input(df, existed_tango_results=existed, force=True)
            requested = len(records) if records else 0
            tango_stats["requested"] = requested

            if records:
                log_info("tango_run_start", f"Running TANGO for {len(records)} sequences", 
                        stage="tango_run", **{"sequence_count": len(records)})
                run_dir = tango.run_tango_simple(records)  # creates out/run_*/<ID>.txt
                tango_ran = True
                run_id = os.path.basename(run_dir) if run_dir else None
                log_info("tango_run_complete", f"TANGO run completed, outputs in {run_dir}", 
                        stage="tango_run", run_id=run_id, **{"run_dir": run_dir})
            else:
                log_info("tango_skip", "No records to run (possibly all already processed).")
                run_dir = None
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = "No records to process"
                # Set all SSW fields to None for all rows when no records
                n = len(df)
                df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)

            # Parse the specific run_* back into the DataFrame
            parse_stats = None
            run_id = os.path.basename(run_dir) if run_dir else None
            try:
                log_info("tango_parse_start", "Parsing TANGO output files", 
                        stage="tango_parse", run_id=run_id)
                parse_stats = tango.process_tango_output(df, run_dir=run_dir)
                if parse_stats:
                    tango_stats["parsed_ok"] = parse_stats.get("parsed_ok", 0)
                    tango_stats["parsed_bad"] = parse_stats.get("parsed_bad", 0)
                    tango_stats["requested"] = parse_stats.get("requested", requested)
                log_info("tango_parse_complete", f"Parsed TANGO outputs: {tango_stats['parsed_ok']} OK, {tango_stats['parsed_bad']} failed", 
                        stage="tango_parse", run_id=run_id, **tango_stats)
                
                # If parse_ok == 0 and requested > 0, runner likely failed
                # Use reason from parse_stats (which reads from run_meta.json if available)
                if parse_stats and parse_stats.get("parsed_ok", 0) == 0 and parse_stats.get("requested", 0) > 0:
                    tango_provider_status = "UNAVAILABLE"
                    # Use reason from parse_stats (extracted from run_meta.json by process_tango_output)
                    meta_reason = parse_stats.get("reason")
                    if meta_reason:
                        tango_provider_reason = meta_reason
                    else:
                        tango_provider_reason = f"Runner failed; {parse_stats.get('parsed_ok', 0)}/{parse_stats.get('requested', 0)} parsed"
                    # Ensure all SSW fields are None for all rows
                    n = len(df)
                    if "SSW prediction" in df.columns:
                        df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
                    if "SSW score" in df.columns:
                        df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                    if "SSW diff" in df.columns:
                        df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                    if "SSW helix percentage" in df.columns:
                        df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                    if "SSW beta percentage" in df.columns:
                        df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
            except ValueError as e:
                # ✅ Check if this is a fatal "0 outputs" error
                if "TANGO produced 0 outputs" in str(e):
                    log_error("tango_zero_outputs_ui", f"TANGO zero outputs error: {e}", entry=trace_entry, **{"error": str(e), "run_dir": run_dir})
                    # Extract run_dir from error message if available
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
                
                # Catch alignment errors and report clearly
                log_error("tango_parse_failed", f"TANGO parse error: {e}", entry=trace_entry, **{"error": str(e)})
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Parse error: {str(e)}"
                # Set all SSW fields to None (not -1, not 0) when parse fails
                n = len(df)
                df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
            except Exception as e:
                log_warning("tango_parse_error", f"Unexpected error during output processing: {e}", **{"error": str(e)})
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Unexpected error: {str(e)}"
                # Set all SSW fields to None when unexpected error occurs
                n = len(df)
                df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)

            # Step 3: ensure %Helix / %β present from Tango if PSIPRED is off
            _fill_percent_from_tango_if_missing(df)

            # Produce SSW prediction column used by the SSW badge
            try:
                log_info("tango_filter_start", "Computing SSW predictions from TANGO results")
                stats = {"upload": {}}
                tango.filter_by_avg_diff(df, "upload", stats)
                log_info("tango_filter_complete", "SSW predictions computed")
            except ValueError as e:
                # Catch alignment errors and report clearly
                log_error("tango_filter_failed", f"SSW prediction computation failed: {e}", entry=trace_entry, **{"error": str(e)})
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"SSW prediction computation failed: {str(e)}"
                # Fill default to prevent downstream errors
                n = len(df)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
            except Exception as e:
                log_warning("tango_filter_error", f"Could not compute SSW prediction: {e}", **{"error": str(e)})
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"SSW prediction error: {str(e)}"
            
            # Compute provider status based on parse stats (canonical rules)
            # Rules:
            # - If feature flag disabled → OFF
            # - If enabled and run attempted:
            #   - parsed_ok == 0 → UNAVAILABLE
            #   - 0 < parsed_ok < requested → PARTIAL
            #   - parsed_ok == requested → AVAILABLE
            parsed_ok = tango_stats.get("parsed_ok", 0)
            requested = tango_stats.get("requested", 0)
            
            if not env_true("USE_TANGO", True):
                tango_provider_status = "OFF"
                tango_provider_reason = "TANGO disabled in environment (USE_TANGO=0)"
            elif parsed_ok == 0 and requested > 0:
                # Runner failed or parse failed: set status to UNAVAILABLE
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Runner failed; {parsed_ok}/{requested} parsed"
                # When provider status is not AVAILABLE, set all dependent row fields to None
                n = len(df)
                df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
                df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
            elif 0 < parsed_ok < requested:
                tango_provider_status = "PARTIAL"
                tango_provider_reason = f"Only {parsed_ok}/{requested} sequences processed successfully"
                # For PARTIAL: rows without valid TANGO metrics already have None from filter_by_avg_diff
                # Ensure rows without valid metrics have all SSW fields set to None
                if "SSW diff" in df.columns:
                    mask_no_valid = df["SSW diff"].isna()
                    if mask_no_valid.any():
                        df.loc[mask_no_valid, "SSW prediction"] = None
                        df.loc[mask_no_valid, "SSW score"] = None
                        df.loc[mask_no_valid, "SSW diff"] = None
                        df.loc[mask_no_valid, "SSW helix percentage"] = None
                        df.loc[mask_no_valid, "SSW beta percentage"] = None
            elif parsed_ok == requested and requested > 0:
                tango_provider_status = "AVAILABLE"
                tango_provider_reason = None
            else:
                # Default: OFF if no run attempted
                tango_provider_status = "OFF"
                tango_provider_reason = "No TANGO run attempted"
            
            log_info("tango_stats", f"TANGO provider status: {tango_provider_status}", **{
                "status": tango_provider_status,
                "reason": tango_provider_reason,
                **tango_stats,
            })

        else:
            # ENV USE_TANGO=false: Always skip (primary gate)
            log_info("tango_disabled", "TANGO disabled by USE_TANGO env (USE_TANGO=0)", **{"run_tango": False, "reason": "TANGO disabled in environment (USE_TANGO=0)"})
            tango_provider_status = "OFF"
            tango_provider_reason = "TANGO disabled in environment (USE_TANGO=0)"
    except Exception as e:
        log_warning("tango_error", f"TANGO error: {e} (continuing without Tango)", **{"error": str(e)})
        tango_provider_status = "UNAVAILABLE"
        tango_provider_reason = f"TANGO execution error: {str(e)}"
    # -----------------------------------------------------------------------

    # JPred disabled - kept for reference only
    jpred_hits = 0
    # Count rows with valid TANGO metrics (sswPrediction is not None/null)
    if "SSW prediction" in df.columns:
        ssw_hits = int(df["SSW prediction"].notna().sum())
    else:
        ssw_hits = 0

    # Debug: Log DataFrame values after Tango merge
    if trace_entry:
        trace_row = df[df["Entry"].astype(str).str.strip() == str(trace_entry).strip()]
        if not trace_row.empty:
            idx = trace_row.index[0]
            log_info("trace_dataframe_merge", f"DataFrame merge for entry {trace_entry}", entry=trace_entry, **{
                "index": int(idx),
                "sequence_length": len(str(trace_row.iloc[0].get('Sequence', ''))),
            })
            for col in ["SSW prediction", "SSW score", "SSW diff", "SSW helix percentage", "SSW beta percentage", 
                       "FF-Helix %", "FF Helix %"]:
                if col in df.columns:
                    val = trace_row.iloc[0][col]
                    log_info("trace_field", f"{col}: {val}", entry=trace_entry, **{"field": col, "value": str(val), "type": type(val).__name__})
        else:
            log_warning("trace_entry_not_found", f"Entry {trace_entry} not found in DataFrame", entry=trace_entry)

    # Compute biochemical features and flags
    log_info("biochem_compute_start", "Computing biochemical features (Charge, Hydrophobicity, μH)")
    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df)
    finalize_ff_fields(df)
    log_info("biochem_complete", f"Computed biochemical features for {len(df)} peptides")
    
    # Debug: Log after finalize_ui_aliases
    if trace_entry:
        trace_row = df[df["Entry"].astype(str).str.strip() == str(trace_entry).strip()]
        if not trace_row.empty:
            log_info("trace_after_finalize", f"After finalize for entry {trace_entry}", entry=trace_entry)
            for col in ["SSW prediction", "FF-Helix %"]:
                if col in df.columns:
                    val = trace_row.iloc[0][col]
                    log_info("trace_field", f"{col}: {val}", entry=trace_entry, **{"field": col, "value": str(val), "type": type(val).__name__})
    
    # Normalize rows for UI (with provider status tracking - Principle B)
    run_id = os.path.basename(run_dir) if 'run_dir' in locals() and run_dir else None
    log_info("normalize_ui_start", "Normalizing rows for UI output", 
            stage="normalize_rows_for_ui", run_id=run_id)
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=USE_TANGO,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=USE_JPRED
    )
    log_info("normalize_ui_complete", f"Normalized {len(rows_out)} rows for UI", 
            stage="normalize_rows_for_ui", run_id=run_id, **{"row_count": len(rows_out)})
    
    # Schema assert: When provider status is not AVAILABLE, ensure all dependent row fields are null
    # This fails fast in dev with a clear error if the invariant is violated
    if os.getenv("ENABLE_PROVIDER_STATUS_ASSERT", "0") == "1":
        for row_dict in rows_out:
            provider_status = row_dict.get("providerStatus", {})
            tango_status = provider_status.get("tango", {}).get("status") if isinstance(provider_status, dict) else None
            if tango_status and tango_status != "AVAILABLE":
                # Check that all TANGO-dependent fields are null
                tango_fields = ["sswPrediction", "sswScore", "sswDiff", "sswHelixPercentage", "sswBetaPercentage"]
                for field in tango_fields:
                    if field in row_dict and row_dict[field] is not None:
                        raise ValueError(
                            f"Provider status invariant violated: TANGO status is {tango_status} but {field} is not null. "
                            f"Row ID: {row_dict.get('id', 'unknown')}"
                        )

    # Debug: Log final serialized JSON for traced entry
    if trace_entry:
        trace_row_out = [r for r in rows_out if str(r.get("id", "")).strip() == str(trace_entry).strip()]
        if trace_row_out:
            row_json = trace_row_out[0]
            log_info("trace_api_response", f"API response for entry {trace_entry}", entry=trace_entry, **{
                "ssw_keys": [k for k in row_json.keys() if 'ssw' in k.lower() or 'helix' in k.lower() or 'beta' in k.lower()]
            })
            for key in ["id", "sswPrediction", "sswHelixPercentage", "sswBetaPercentage", 
                       "ffHelixPercent", "sswScore", "sswDiff"]:
                if key in row_json:
                    val = row_json[key]
                    log_info("trace_field", f"{key}: {val}", entry=trace_entry, **{"field": key, "value": str(val), "type": type(val).__name__})
        else:
            log_warning("trace_entry_not_found", f"Entry {trace_entry} not found in normalized rows", entry=trace_entry)
    
    # Compute SSW positive % from final normalized rows (what UI actually receives)
    # Gate: Only count rows with valid TANGO metrics (sswPrediction !== null/undefined)
    # Use strict boolean coercion to match UI logic (sswPrediction === 1)
    # Use canonical sswPrediction field (from PeptideSchema.to_camel_dict())
    ssw_positives = 0
    ssw_valid_count = 0
    ssw_positive_entries = []
    for row_dict in rows_out:
        # Use canonical sswPrediction field
        ssw_val = row_dict.get("sswPrediction") or row_dict.get("chameleonPrediction")  # Backward compat
        # Only count rows with valid TANGO metrics (not null/undefined)
        if ssw_val is not None and ssw_val != "null":
            ssw_valid_count += 1
            # Strict boolean coercion: only count as positive if exactly 1 (int/float, not "1", True, etc.)
            if isinstance(ssw_val, (int, float)) and ssw_val == 1:
                ssw_positives += 1
                ssw_positive_entries.append(row_dict.get("id", "unknown"))
    # Only compute percent if we have valid TANGO data (denominator > 0)
    ssw_percent = round(100.0 * ssw_positives / ssw_valid_count, 1) if ssw_valid_count > 0 else None
    
    # Debug: Show which entries are counted as positive
    if trace_entry:
        print(f"[DEBUG_TRACE][SSW_COUNT] Total positives: {ssw_positives}/{len(rows_out)} ({ssw_percent}%)")
        print(f"  Positive entries: {ssw_positive_entries[:10]}{'...' if len(ssw_positive_entries) > 10 else ''}")
        if trace_entry in ssw_positive_entries:
            print(f"  ✓ Entry {trace_entry} IS counted as positive")
        else:
            trace_row_out = [r for r in rows_out if str(r.get("id", "")).strip() == str(trace_entry).strip()]
            if trace_row_out:
                ssw_val = trace_row_out[0].get("sswPrediction") or trace_row_out[0].get("chameleonPrediction")
                print(f"  ✗ Entry {trace_entry} NOT counted as positive (value: {ssw_val}, type: {type(ssw_val).__name__})")
    
    ff_avail = int((pd.to_numeric(df.get("FF-Helix %", pd.Series([-1]*len(df))), errors="coerce") != -1).sum())
    
    # Determine TANGO run_dir basename for logging (separate from reproducibility run_id)
    tango_run_dir_basename = os.path.basename(run_dir) if 'run_dir' in locals() and run_dir else None
    
    log_info("upload_complete", f"Upload processing complete", stage="response", run_id=tango_run_dir_basename, **{
        "total_rows": len(df),
        "jpred_hits": jpred_hits,
        "ssw_hits": ssw_hits,
        "ssw_positive_percent": ssw_percent,
        "ssw_positives": ssw_positives,
        "ff_helix_available": ff_avail,
    })

    # Build provider status metadata (with deterministic flags)
    provider_status_meta = {
        "tango": {
            "enabled": tango_enabled_flag,
            "requested": tango_requested_flag,
            "ran": tango_ran,
            "status": tango_provider_status,
            "reason": tango_provider_reason,
            "stats": tango_stats,
        },
        "psipred": {
            "status": "OFF",
            "reason": "PSIPRED not enabled",
            "stats": {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
        },
        "jpred": {
            "status": "OFF",
            "reason": "JPred disabled",
            "stats": {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
        },
    }
    
    # Update global state for /api/providers/last-run endpoint
    global _last_provider_status, _last_run_dir
    _last_provider_status = provider_status_meta.copy()
    _last_provider_status["total_rows"] = len(df)
    _last_provider_status["ssw_rows_with_data"] = ssw_hits
    _last_run_dir = tango._latest_run_dir()
    
    # Compute reproducibility primitives
    # 1. Generate run_id (uuid4) for this request (distinct from TANGO run directory)
    repro_run_id = str(uuid.uuid4())
    
    # 2. Get traceId from context (set by middleware)
    from services.logger import get_trace_id
    trace_id = get_trace_id()
    
    # 3. Compute inputs_hash from cleaned sequences + IDs (stable, deterministic)
    # Sort entries for deterministic hash regardless of input order
    inputs_data = []
    for _, row in df.iterrows():
        entry_id = str(row.get("Entry", "")).strip()
        seq_raw = str(row.get("Sequence", "")).strip()
        # Clean sequence using same method as pipeline
        seq_cleaned = auxiliary.get_corrected_sequence(seq_raw) if seq_raw else ""
        if entry_id and seq_cleaned:
            inputs_data.append(f"{entry_id}:{seq_cleaned}")
    
    # Sort for deterministic hash (same inputs -> same hash regardless of order)
    inputs_data.sort()
    inputs_str = "\n".join(inputs_data)
    inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]  # First 16 chars for readability
    
    # 4. Compute config_hash from configuration flags/options
    # Include config options that affect output (provider flags, thresholds)
    config_dict = {
        "USE_TANGO": USE_TANGO,
        "USE_PSIPRED": USE_PSIPRED,
        "USE_JPRED": USE_JPRED,
        # Add threshold config if present in future
        # "FF_HELIX_THRESHOLD": os.getenv("FF_HELIX_THRESHOLD", "1.0"),
        # "FF_HELIX_CORE_LEN": os.getenv("FF_HELIX_CORE_LEN", "6"),
    }
    # Sort keys for deterministic hash
    config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
    config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]  # First 16 chars
    
    # 5. Compute provider status summary counts
    provider_status_summary = {
        "tango": {
            "status": tango_provider_status,
            "requested": tango_stats.get("requested", 0),
            "parsed_ok": tango_stats.get("parsed_ok", 0),
            "parsed_bad": tango_stats.get("parsed_bad", 0),
        } if tango_enabled_flag else None,
        "psipred": {
            "status": "OFF" if not USE_PSIPRED else "UNKNOWN",
        },
        "jpred": {
            "status": "OFF",
        },
    }
    
    # 6. Resolve thresholds (deterministic computation based on mode)
    resolved_thresholds = resolve_thresholds(threshold_config_requested, df)
    
    return {
        "rows": rows_out,
        "meta": {
            "use_jpred": False, "use_tango": USE_TANGO,  # JPred disabled
            "jpred_rows": jpred_hits, "ssw_rows": ssw_hits,
            "valid_seq_rows": int(df["Sequence"].notna().sum()),
            "provider_status": provider_status_meta,
            # Reproducibility primitives
            "runId": repro_run_id,
            "traceId": trace_id,
            "inputsHash": inputs_hash,
            "configHash": config_hash,
            "providerStatusSummary": provider_status_summary,
            # Threshold configuration (plumbing only, no behavior changes)
            "thresholdConfigRequested": threshold_config_requested,
            "thresholdConfigResolved": threshold_config_resolved,
            "thresholds": resolved_thresholds,
        }
    }


@app.post("/api/predict")
async def predict(
    sequence: str = Form(...), 
    entry: Optional[str] = Form(None),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    # Parse thresholdConfig if provided
    threshold_config_requested = None
    if thresholdConfig:
        try:
            threshold_config_requested = json.loads(thresholdConfig)
        except json.JSONDecodeError:
            # Invalid JSON, log warning but continue with defaults
            log_warning("threshold_config_invalid", f"Invalid thresholdConfig JSON: {thresholdConfig}", **{"error": "JSON decode failed"})
    
    # Resolve threshold config (use defaults for now, no behavior changes)
    threshold_config_resolved = {
        "mode": "default",
        "version": "1.0.0"
    }
    if threshold_config_requested:
        # Echo requested config structure (validation/resolution to be added later)
        threshold_config_resolved = {
            "mode": threshold_config_requested.get("mode", "default"),
            "version": threshold_config_requested.get("version", "1.0.0"),
            "custom": threshold_config_requested.get("custom") if threshold_config_requested.get("mode") == "custom" else None,
        }
    
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
    result = normalize_rows_for_ui(
        df,
        is_single_row=True,
        tango_enabled=USE_TANGO,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=USE_JPRED
    )
    
    # Add meta field with thresholds (for consistency with upload-csv response structure)
    # normalize_rows_for_ui returns a dict for is_single_row=True
    result["meta"] = {
        "thresholds": resolved_thresholds,
    }
    
    return result

def process_row(row_dict):
    # row_dict contains keys that are the CSV headers (exact strings)
    peptide = PeptideSchema.parse_obj(row_dict)
    return peptide.to_camel_dict()


# ---------- UniProt Query Endpoints ----------

# Global state to track last provider status (for /api/providers/last-run)
_last_provider_status: Optional[Dict] = None
_last_run_dir: Optional[str] = None

@app.get("/api/debug/providers")
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

@app.get("/api/providers/last-run")
async def providers_last_run():
    """
    Returns the last provider status metadata from the most recent dataset processing.
    Includes provider status, reasons, stats, and run directory paths for debugging.
    """
    global _last_provider_status, _last_run_dir
    
    if _last_provider_status is None:
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
    latest_tango_dir = _last_run_dir or tango._latest_run_dir()
    
    return {
        "tango": _last_provider_status.get("tango"),
        "psipred": _last_provider_status.get("psipred"),
        "jpred": _last_provider_status.get("jpred"),
        "run_dirs": {
            "tango": latest_tango_dir,
        },
        "sample_counts": {
            "total_rows": _last_provider_status.get("total_rows", 0),
            "ssw_rows_with_data": _last_provider_status.get("ssw_rows_with_data", 0),
        }
    }

@app.get("/api/providers/diagnose/tango")
async def diagnose_tango():
    """
    Diagnose TANGO binary/container availability.
    Returns actionable status for debugging TANGO execution failures.
    """
    import shutil
    import subprocess
    
    # Check if Docker mode is enabled
    use_docker = os.getenv("TANGO_MODE", "simple").lower() != "simple"
    docker_image = os.getenv("TANGO_DOCKER_IMAGE", "desy-tango")
    
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

@app.get("/api/uniprot/ping")
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

@app.post("/api/uniprot/parse", response_model=UniProtQueryParseResponse)
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


@app.post("/api/uniprot/window")
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


@app.post("/api/uniprot/execute")
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
            ALLOWED_SORTS = {
                "length asc", "length desc",
                "reviewed asc", "reviewed desc",
                "protein_name asc", "protein_name desc",
                "organism_name asc", "organism_name desc",
            }
            if request.sort not in ALLOWED_SORTS:
                log_warning("uniprot_invalid_sort", f"Invalid sort value received: '{request.sort}'", **{"received_sort": request.sort, "allowed": sorted(ALLOWED_SORTS)})
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid sort value: '{request.sort}'. Allowed values: {sorted(ALLOWED_SORTS)} or omit for best match"
                )
            sort_value = request.sort
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
                            # ✅ Check if this is a fatal "0 outputs" error
                            if "TANGO produced 0 outputs" in str(e):
                                log_error("uniprot_tango_zero_outputs_ui", f"TANGO zero outputs error: {e}", **{"error": str(e), "run_dir": run_dir})
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
                            
                            log_error("uniprot_tango_parse_failed", f"TANGO parse error: {e}", **{"error": str(e)})
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
                            log_warning("uniprot_tango_parse_error", f"Unexpected error during output processing: {e}", **{"error": str(e)})
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
                            log_error("uniprot_tango_filter_failed", f"SSW prediction computation failed: {e}", **{"error": str(e)})
                            provider_status_meta["tango"]["status"] = "UNAVAILABLE"
                            provider_status_meta["tango"]["skipped_reason"] = f"Filter error: {str(e)}"
                            n = len(df)
                            if "SSW prediction" not in df.columns:
                                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
                        except Exception as e:
                            log_warning("uniprot_tango_filter_error", f"Could not compute SSW prediction: {e}", **{"error": str(e)})
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
                ssw_val = row_dict.get("sswPrediction") or row_dict.get("chameleonPrediction")
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
            global _last_provider_status, _last_run_dir
            _last_provider_status = provider_status_meta.copy()
            _last_provider_status["total_rows"] = len(df)
            _last_provider_status["ssw_rows_with_data"] = ssw_hits
            _last_run_dir = run_dir if run_dir else tango._latest_run_dir()
            
            return {
                "rows": rows_out,
                "meta": {
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
                },
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


@app.post("/api/feedback")
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

