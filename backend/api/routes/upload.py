"""
File upload endpoint.
"""

import asyncio
import json
import threading
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from config import settings
from schemas.api_models import RowsResponse
from services.dataframe_utils import read_any_table, require_cols
from services.logger import log_error, log_info
from services.normalize import normalize_cols
from services.thresholds import parse_threshold_config
from services.upload_service import (
    UploadProcessingError,
    process_upload_dataframe,
)

router = APIRouter()

DEBUG_ENTRY = settings.DEBUG_ENTRY


@router.post("/api/upload-csv", response_model=RowsResponse)
async def upload_csv(
    file: UploadFile = File(...),
    debug_entry: Optional[str] = Query(None, description="Entry ID to trace through pipeline"),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON"),
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

    # Parse threshold config (shared helper)
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    # Validate file format upfront
    if not file.filename:
        raise HTTPException(
            400, detail="File must have a filename. Accepted formats: .csv, .tsv, .xlsx, .xls, .txt"
        )

    file_ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
    if file_ext not in ["csv", "tsv", "xlsx", "xls", "txt", "fasta", "fa"]:
        raise HTTPException(
            400,
            detail=f"Unsupported file format: '{file_ext}'. "
            "Accepted formats: .csv (comma-separated), .tsv (tab-separated), "
            ".xlsx/.xls (Excel), .txt (auto-detect delimiter), "
            ".fasta/.fa (FASTA sequences).",
        )

    # Performance timing: Parse stage
    parse_start_time = time.time()
    log_info("upload_parse_start", f"Parsing file: {file.filename}", stage="parse")
    raw = await file.read()

    # Validate file is not empty
    if len(raw) == 0:
        raise HTTPException(
            400,
            detail="Uploaded file is empty. "
            "Please upload a non-empty file with at least one data row.",
        )

    try:
        df = read_any_table(raw, file.filename)
        parse_elapsed = (time.time() - parse_start_time) * 1000
        log_info(
            "upload_parse_complete",
            f"Parsed {len(df)} rows from {file.filename}",
            stage="parse",
            **{
                "row_count": len(df),
                "upload_filename": file.filename,
                "parse_time_ms": round(parse_elapsed, 2),
            },
        )
    except ValueError as e:
        log_error(
            "upload_parse_failed", f"Failed to parse table: {e}", stage="parse", **{"error": str(e)}
        )
        raise HTTPException(400, detail=str(e)) from e
    except Exception as e:
        log_error(
            "upload_parse_failed", f"Failed to parse table: {e}", stage="parse", **{"error": str(e)}
        )
        raise HTTPException(
            400,
            detail=f"Failed to parse file '{file.filename}': {e}. "
            "Ensure file is a valid .csv, .tsv, .xlsx, or .xls file. "
            "Required columns: Entry/Accession (or ID) and Sequence.",
        ) from e

    # Validate we got some data
    if len(df) == 0:
        raise HTTPException(
            400,
            detail="Parsed file contains no data rows. "
            "Ensure file has at least one row with data (excluding headers).",
        )

    # Performance timing: Normalize stage
    normalize_start_time = time.time()
    log_info("normalize_start", "Normalizing column headers", stage="normalize")
    df = normalize_cols(df)
    normalize_elapsed = (time.time() - normalize_start_time) * 1000
    log_info(
        "normalize_complete",
        f"Normalized columns: {list(df.columns)[:5]}...",
        stage="normalize",
        **{"column_count": len(df.columns), "normalize_time_ms": round(normalize_elapsed, 2)},
    )
    require_cols(df, ["Entry", "Sequence"])

    # if Length absent, derive from sequence
    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    # Process the DataFrame through the full pipeline
    from api.main import SENTRY_INITIALIZED

    cancel_event = threading.Event()
    try:
        task = asyncio.get_event_loop().run_in_executor(
            None,
            lambda: process_upload_dataframe(
                df=df,
                threshold_config_requested=threshold_config_requested,
                threshold_config_resolved=threshold_config_resolved,
                trace_entry=trace_entry,
                sentry_initialized=SENTRY_INITIALIZED,
                cancel_event=cancel_event,
            ),
        )
        return await task
    except asyncio.CancelledError:
        cancel_event.set()
        log_info("upload_client_disconnect", "Client disconnected, cancelling upload analysis")
        raise
    except UploadProcessingError as e:
        raise HTTPException(
            status_code=e.status_code, detail=json.dumps(e.detail) if e.detail else e.message
        ) from e
