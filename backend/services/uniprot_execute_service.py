"""
UniProt query execution service.

Handles the full lifecycle of a UniProt query:
  1. Parse query string → detect mode
  2. Validate sort parameter
  3. Build UniProt export URL
  4. Fetch results via HTTP
  5. Run analysis pipeline (FF-Helix, TANGO, S4PRED, biochem)
  6. Build response (normalize, reproducibility primitives, meta)

Extracted from server.py to break the circular import chain.
"""
import io
import json
import os
import re
import hashlib
import uuid
from typing import Optional, Dict, Any, Tuple

import httpx
import pandas as pd

from config import settings
from fastapi import HTTPException
from schemas.uniprot_query import UniProtQueryExecuteRequest
from services.uniprot_parser import parse_uniprot_query, build_uniprot_export_url
from services.logger import log_info, log_warning, log_error
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response
from services.thresholds import resolve_thresholds
from services.normalize import (
    normalize_cols,
    finalize_ui_aliases as _finalize_ui_aliases,
    finalize_ff_fields,
    normalize_rows_for_ui,
)
from services.dataframe_utils import (
    require_cols,
    ensure_ff_cols,
    ensure_computed_cols,
    apply_ff_flags,
    read_any_table,
    fill_percent_from_tango_if_missing as _fill_percent_from_tango_if_missing,
)
from services.upload_service import (
    run_tango_processing,
    run_s4pred_processing,
    UploadProcessingError,
    set_last_provider_status,
    set_last_run_dir,
)
from services.provider_status_builder import build_provider_meta
from calculations.biochem import calculate_biochemical_features as calc_biochem
import tango


# ---------------------------------------------------------------------------
# Query parsing + validation helpers
# ---------------------------------------------------------------------------

def _parse_query(request: UniProtQueryExecuteRequest) -> Tuple[str, str]:
    """
    Parse the query and detect mode.

    Returns:
        (api_query, detected_mode)

    Raises:
        HTTPException 400 on parse error.
    """
    if request.mode == "auto" or request.mode is None:
        parsed = parse_uniprot_query(request.query)
        api_query = parsed.api_query_string
        detected_mode = parsed.mode.value

        log_info("uniprot_parse", f"Parsed query: mode={detected_mode}",
                 **{"input": request.query, "mode": detected_mode, "api_query": api_query})

        if parsed.error:
            raise HTTPException(status_code=400, detail=f"Query parsing error: {parsed.error}")
    else:
        api_query = request.query
        detected_mode = request.mode
        log_info("uniprot_parse", f"Using provided mode: {detected_mode}",
                 **{"mode": detected_mode, "api_query": api_query})

    return api_query, detected_mode


_ALLOWED_SORTS = {
    "length asc", "length desc",
    "protein_name asc", "protein_name desc",
    "organism_name asc", "organism_name desc",
}


def _validate_sort(sort: Optional[str]) -> Optional[str]:
    """
    Validate and normalize the sort parameter.

    Returns:
        Normalized sort string in UniProt format, or None to omit.

    Raises:
        HTTPException 400 on invalid sort value.
    """
    log_info("uniprot_sort_received", f"Received sort: {sort}",
             **{"received_sort": sort, "sort_type": type(sort).__name__})

    if not sort:
        log_info("uniprot_sort_omitted", "No sort provided, using default (best match)")
        return None

    sort_str = str(sort).strip().lower()

    # Reject legacy "score" silently
    if sort_str == "score":
        log_warning("uniprot_invalid_sort", "Received legacy 'score' sort, omitting",
                     **{"received_sort": sort})
        return None

    # Normalize underscore to space (length_asc -> length asc)
    normalized = re.sub(r'_asc$', ' asc', sort)
    normalized = re.sub(r'_desc$', ' desc', normalized)

    if normalized not in _ALLOWED_SORTS:
        log_warning("uniprot_invalid_sort", f"Invalid sort: '{sort}'",
                     **{"received_sort": sort, "allowed": sorted(_ALLOWED_SORTS)})
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort value: '{sort}'. Allowed: {sorted(_ALLOWED_SORTS)} or omit for best match"
        )

    log_info("uniprot_sort_valid", f"Using sort: {normalized}", **{"sort": normalized})
    return normalized


def _build_url(api_query: str, request: UniProtQueryExecuteRequest, sort_value: Optional[str]) -> str:
    """Build the UniProt REST API export URL."""
    return build_uniprot_export_url(
        api_query,
        format="tsv",
        reviewed=request.reviewed,
        length_min=request.length_min,
        length_max=request.length_max,
        sort=sort_value,
        include_isoforms=request.include_isoforms or False,
        size=min(max(request.size or 500, 1), 500),
    )


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------

_USER_AGENT = "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"


async def _fetch_uniprot_tsv(url: str) -> pd.DataFrame:
    """
    Fetch TSV data from UniProt and parse into a DataFrame.

    Raises:
        httpx.HTTPStatusError, httpx.TimeoutException on network errors.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {"User-Agent": _USER_AGENT}
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return read_any_table(response.content, "uniprot_export.tsv")


# ---------------------------------------------------------------------------
# Analysis pipeline (reuses upload_service functions)
# ---------------------------------------------------------------------------

def _run_analysis_pipeline(
    df: pd.DataFrame,
    run_tango: bool,
    sentry_initialized: bool,
) -> Dict[str, Any]:
    """
    Run the full analysis pipeline on a DataFrame of UniProt sequences.

    Returns dict with keys:
        rows_out, tango_stats, tango_status, tango_reason, tango_ran, run_dir,
        s4pred_stats, s4pred_status, s4pred_reason, s4pred_ran, ssw_hits
    """
    # Normalize columns
    try:
        df_normalized = normalize_cols(df)
    except Exception as e:
        log_warning("uniprot_normalize_warning", f"Normalization warning: {e}",
                     **{"error": str(e)})
        df_normalized = df

    require_cols(df_normalized, ["Entry", "Sequence"])
    if "Length" not in df_normalized.columns:
        df_normalized["Length"] = df_normalized["Sequence"].astype(str).str.len()

    # FF-Helix
    ensure_ff_cols(df_normalized)
    ensure_computed_cols(df_normalized)

    # TANGO (reuse upload_service's function, with opt-in gate)
    tango_stats, tango_status, tango_reason, tango_ran, run_dir = run_tango_processing(
        df_normalized, trace_entry=None, sentry_initialized=sentry_initialized,
        tango_requested=run_tango,
    )

    # S4PRED (reuse upload_service's function)
    s4pred_stats, s4pred_status, s4pred_reason, s4pred_ran = run_s4pred_processing(
        df_normalized, trace_entry=None, sentry_initialized=sentry_initialized,
    )

    # Biochem + finalize (UniProt queries use default thresholds)
    calc_biochem(df_normalized)
    apply_ff_flags(df_normalized)  # default mode, no user thresholds
    _finalize_ui_aliases(df_normalized)
    finalize_ff_fields(df_normalized)

    # Normalize rows for UI
    rows_out = normalize_rows_for_ui(
        df_normalized,
        is_single_row=False,
        tango_enabled=settings.USE_TANGO,
        s4pred_enabled=settings.USE_S4PRED,
    )

    # SSW stats
    ssw_hits = int(df_normalized["SSW prediction"].notna().sum()) if "SSW prediction" in df_normalized.columns else 0

    return {
        "df": df_normalized,
        "rows_out": rows_out,
        "tango_stats": tango_stats,
        "tango_status": tango_status,
        "tango_reason": tango_reason,
        "tango_ran": tango_ran,
        "run_dir": run_dir,
        "s4pred_stats": s4pred_stats,
        "s4pred_status": s4pred_status,
        "s4pred_reason": s4pred_reason,
        "s4pred_ran": s4pred_ran,
        "ssw_hits": ssw_hits,
    }


# ---------------------------------------------------------------------------
# Response construction
# ---------------------------------------------------------------------------

def _build_response(
    result: Dict[str, Any],
    request: UniProtQueryExecuteRequest,
    api_query: str,
    detected_mode: str,
    uniprot_url: str,
) -> Dict[str, Any]:
    """Build the final RowsResponse dict."""
    df = result["df"]
    rows_out = result["rows_out"]

    # Provider status meta (consistent with upload endpoint)
    provider_status_meta = build_provider_meta(
        tango_enabled=settings.USE_TANGO,
        tango_ran=result["tango_ran"],
        tango_status=result["tango_status"],
        tango_reason=result["tango_reason"],
        tango_stats=result["tango_stats"],
        tango_requested=request.run_tango,
        s4pred_enabled=settings.USE_S4PRED,
        s4pred_ran=result["s4pred_ran"],
        s4pred_status=result["s4pred_status"],
        s4pred_reason=result["s4pred_reason"],
        s4pred_stats=result["s4pred_stats"],
    )

    # Update global state for /api/providers/last-run
    provider_to_save = provider_status_meta.copy()
    provider_to_save["total_rows"] = len(df)
    provider_to_save["ssw_rows_with_data"] = result["ssw_hits"]
    set_last_provider_status(provider_to_save)
    set_last_run_dir(result["run_dir"] if result["run_dir"] else tango._latest_run_dir())

    # Reproducibility primitives
    repro_run_id = str(uuid.uuid4())
    trace_id = get_trace_id_for_response()

    inputs_str = f"{request.query}:{request.size or 500}"
    inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]

    config_dict = {"USE_TANGO": settings.USE_TANGO, "USE_S4PRED": settings.USE_S4PRED}
    config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
    config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]

    provider_status_summary = {
        "tango": {
            "status": result["tango_status"],
            "requested": result["tango_stats"].get("requested", 0),
            "parsed_ok": result["tango_stats"].get("parsed_ok", 0),
            "parsed_bad": result["tango_stats"].get("parsed_bad", 0),
        } if settings.USE_TANGO else None,
        "s4pred": {
            "status": result["s4pred_status"],
            "requested": result["s4pred_stats"].get("requested", 0),
            "parsed_ok": result["s4pred_stats"].get("parsed_ok", 0),
            "parsed_bad": result["s4pred_stats"].get("parsed_bad", 0),
        } if settings.USE_S4PRED else None,
    }

    # Thresholds (UniProt uses defaults)
    resolved_thresholds = resolve_thresholds(None, df)

    meta = ensure_trace_id_in_meta({
        "source": "uniprot_api",
        "query": request.query,
        "api_query_string": api_query,
        "mode": detected_mode,
        "url": uniprot_url,
        "row_count": len(df),
        "size_requested": request.size or 500,
        "size_returned": len(df),
        "use_s4pred": settings.USE_S4PRED,
        "use_tango": settings.USE_TANGO,
        "run_tango": request.run_tango,
        "ssw_rows": result["ssw_hits"],
        "valid_seq_rows": len(df),
        "provider_status": provider_status_meta,
        "runId": repro_run_id,
        "traceId": trace_id,
        "inputsHash": inputs_hash,
        "configHash": config_hash,
        "providerStatusSummary": provider_status_summary,
        "thresholdConfigRequested": None,
        "thresholdConfigResolved": {"mode": "default", "version": "1.0.0"},
        "thresholds": resolved_thresholds,
    })

    return {"rows": rows_out, "meta": meta}


# ---------------------------------------------------------------------------
# 400 fallback: retry with minimal JSON query
# ---------------------------------------------------------------------------

async def _handle_400_fallback(
    api_query: str,
    request: UniProtQueryExecuteRequest,
    detected_mode: str,
    error_text: str,
) -> Dict[str, Any]:
    """
    When the original TSV query fails with 400, retry with minimal JSON query.

    Returns a response dict or raises HTTPException if fallback also fails.
    """
    minimal_fields = "accession,id,length"
    minimal_params: Dict[str, Any] = {
        "query": api_query,
        "format": "json",
        "fields": minimal_fields,
        "size": min(max(request.size or 500, 1), 500),
    }

    # Add reviewed filter if set
    if request.reviewed is True:
        mq = api_query
        if "reviewed:" not in mq.lower():
            mq = f"{api_query} AND reviewed:true" if api_query else "reviewed:true"
        minimal_params["query"] = mq
    elif request.reviewed is False:
        mq = api_query
        if "reviewed:" not in mq.lower():
            mq = f"{api_query} AND reviewed:false" if api_query else "reviewed:false"
        minimal_params["query"] = mq

    minimal_url = str(httpx.URL("https://rest.uniprot.org/uniprotkb/search", params=minimal_params))
    log_info("uniprot_fallback_url", f"Trying minimal fallback", **{"url": minimal_url})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"User-Agent": _USER_AGENT}
            fallback_response = await client.get(minimal_url, headers=headers)
            fallback_response.raise_for_status()

            fallback_data = fallback_response.json()
            results = fallback_data.get("results", [])

            log_info("uniprot_fallback_success", f"Fallback got {len(results)} results",
                     **{"result_count": len(results)})

            if not results:
                return {
                    "rows": [],
                    "meta": {
                        "source": "uniprot_api",
                        "query": request.query,
                        "api_query_string": api_query,
                        "mode": detected_mode,
                        "url": minimal_url,
                        "row_count": 0,
                        "note": "uniprot-minimal-fallback-empty",
                        "original_error": error_text[:200],
                    },
                }

            # Convert JSON results to DataFrame
            df_minimal = pd.DataFrame(results)
            column_mapping = {
                "accession": "Entry",
                "id": "Entry Name",
                "length": "Length",
            }
            df_minimal = df_minimal.rename(columns=column_mapping)

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
                    s4pred_enabled=False,
                )

                return {
                    "rows": rows_out,
                    "meta": {
                        "source": "uniprot_api",
                        "query": request.query,
                        "api_query_string": api_query,
                        "mode": detected_mode,
                        "url": minimal_url,
                        "row_count": len(df_minimal),
                        "note": "uniprot-minimal-fallback",
                        "original_error": error_text[:200],
                    },
                }
            except Exception as analysis_error:
                log_warning("uniprot_fallback_analysis_error",
                            f"Error analyzing fallback: {analysis_error}",
                            **{"error": str(analysis_error)})
                # Return raw results
                return {
                    "rows": [
                        {"Entry": r.get("accession", ""), "Entry Name": r.get("id", ""), "Length": r.get("length", 0)}
                        for r in results
                    ],
                    "meta": {
                        "source": "uniprot_api",
                        "query": request.query,
                        "api_query_string": api_query,
                        "mode": detected_mode,
                        "url": minimal_url,
                        "row_count": len(results),
                        "note": "uniprot-minimal-fallback-raw",
                        "original_error": error_text[:200],
                    },
                }

    except Exception as fallback_error:
        log_error("uniprot_fallback_failed", f"Fallback also failed: {fallback_error}",
                  **{"fallback_error": str(fallback_error)})
        # Re-raise the original 400 error
        raise HTTPException(
            status_code=400,
            detail=json.dumps({"source": "uniprot", "error": error_text})
        )


# ---------------------------------------------------------------------------
# HTTP error handling
# ---------------------------------------------------------------------------

def _extract_error_text(response_text: str, status_code: int) -> str:
    """Extract a clean error message from UniProt HTML/text error response."""
    # Remove all HTML tags
    error_text = re.sub(r'<[^>]+>', '', response_text)
    error_text = re.sub(r'\s+', ' ', error_text).strip()

    # Try to extract meaningful message
    error_patterns = [
        r'Bad Request[:\s]+(.+?)(?:\.|$)',
        r'Invalid query[:\s]+(.+?)(?:\.|$)',
        r'Error[:\s]+(.+?)(?:\.|$)',
        r'HTTP Status \d+[:\s]+(.+?)(?:\.|$)',
    ]

    for pattern in error_patterns:
        match = re.search(pattern, error_text, re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            if extracted:
                return extracted[:200]

    if not error_text or len(error_text) < 5:
        return f"Bad Request (HTTP {status_code})"

    return error_text[:200]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def execute_uniprot_query(
    request: UniProtQueryExecuteRequest,
    sentry_initialized: bool,
) -> Dict[str, Any]:
    """
    Execute a UniProt query: fetch → analyze → build response.

    This is the main entry point called by the route handler.

    Raises:
        HTTPException on errors (400, 500, 502, 504).
    """
    # 1. Parse query
    api_query, detected_mode = _parse_query(request)

    # 2. Validate sort
    sort_value = _validate_sort(request.sort)

    # 3. Build URL
    uniprot_url = _build_url(api_query, request, sort_value)

    log_info("uniprot_execute_start", "Executing UniProt query", **{
        "query": api_query,
        "reviewed": request.reviewed,
        "length_min": request.length_min,
        "length_max": request.length_max,
        "sort": sort_value,
        "size": request.size or 500,
    })
    log_info("uniprot_url", f"UniProt URL: {uniprot_url}", **{"url": uniprot_url})

    try:
        # 4. Fetch from UniProt
        df = await _fetch_uniprot_tsv(uniprot_url)
        log_info("uniprot_fetch_success", f"Retrieved {len(df)} rows",
                 **{"row_count": len(df), "columns": list(df.columns)})

        if len(df) == 0:
            log_warning("uniprot_no_results", "Query returned 0 rows",
                        **{"query": api_query, "url": uniprot_url})
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

        # 5. Run analysis pipeline
        log_info("uniprot_analysis_start", "Running analysis pipeline")

        result = _run_analysis_pipeline(
            df, run_tango=request.run_tango, sentry_initialized=sentry_initialized,
        )

        log_info("uniprot_analysis_complete", "Analysis complete", **{
            "total_rows": len(result["df"]),
            "ssw_hits": result["ssw_hits"],
            "tango_ran": result["tango_ran"],
            "s4pred_ran": result["s4pred_ran"],
        })

        # 6. Build response
        return _build_response(result, request, api_query, detected_mode, uniprot_url)

    except UploadProcessingError as e:
        # Convert service errors to HTTP errors (e.g., TANGO zero outputs)
        raise HTTPException(status_code=e.status_code, detail=json.dumps(e.detail) if e.detail else e.message)

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        try:
            error_text = _extract_error_text(e.response.text, status_code)
        except Exception:
            error_text = f"Bad Request (HTTP {status_code})"

        if status_code == 400:
            log_warning("uniprot_400_error", f"UniProt 400: {error_text}",
                        **{"status_code": 400, "original_url": uniprot_url})
            return await _handle_400_fallback(api_query, request, detected_mode, error_text)

        elif status_code >= 500:
            error_msg = f"UniProt API server error ({status_code}): {error_text}"
            log_error("uniprot_api_error", error_msg, **{"status_code": status_code})
            raise HTTPException(status_code=502, detail=error_msg)
        else:
            error_msg = f"UniProt API error ({status_code}): {error_text}"
            log_warning("uniprot_client_error", error_msg, **{"status_code": status_code})
            raise HTTPException(status_code=400,
                                detail=json.dumps({"source": "uniprot", "error": error_msg}))

    except httpx.TimeoutException:
        error_msg = "UniProt API request timed out. Try reducing the result size or removing length/sort filters."
        log_error("uniprot_timeout", error_msg)
        raise HTTPException(status_code=504,
                            detail=json.dumps({"source": "uniprot", "error": error_msg}))

    except HTTPException:
        raise  # Re-raise FastAPI HTTP exceptions as-is

    except Exception as e:
        error_msg = f"Failed to fetch from UniProt: {str(e)}"
        log_error("uniprot_error", error_msg, **{"error": str(e)})
        raise HTTPException(status_code=500, detail=error_msg)
