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

import asyncio
import hashlib
import json
import re
import threading
import uuid
from typing import Any, Dict, Optional, Tuple

import httpx
import pandas as pd
from fastapi import HTTPException

import tango
from calculations.biochem import calculate_biochemical_features as calc_biochem
from config import settings
from schemas.uniprot_query import UniProtQueryExecuteRequest
from services.dataframe_utils import (
    apply_ff_flags,
    ensure_computed_cols,
    ensure_ff_cols,
    read_any_table,
    require_cols,
)
from services.logger import log_error, log_info, log_warning
from services.normalize import (
    finalize_ff_fields,
    normalize_cols,
    normalize_rows_for_ui,
)
from services.normalize import (
    finalize_ui_aliases as _finalize_ui_aliases,
)
from services.provider_status_builder import build_provider_meta
from services.thresholds import resolve_thresholds
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response
from services.uniprot_parser import build_uniprot_export_url, parse_uniprot_query
from services.upload_service import (
    UploadProcessingError,
    run_s4pred_processing,
    run_tango_processing,
    set_last_provider_status,
    set_last_run_dir,
)

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

        log_info(
            "uniprot_parse",
            f"Parsed query: mode={detected_mode}",
            **{"input": request.query, "mode": detected_mode, "api_query": api_query},
        )

        if parsed.error:
            raise HTTPException(status_code=400, detail=f"Query parsing error: {parsed.error}")
    else:
        api_query = request.query
        detected_mode = request.mode
        log_info(
            "uniprot_parse",
            f"Using provided mode: {detected_mode}",
            **{"mode": detected_mode, "api_query": api_query},
        )

    return api_query, detected_mode


_ALLOWED_SORTS = {
    "length asc",
    "length desc",
    "protein_name asc",
    "protein_name desc",
    "organism_name asc",
    "organism_name desc",
}


def _validate_sort(sort: Optional[str]) -> Optional[str]:
    """
    Validate and normalize the sort parameter.

    Returns:
        Normalized sort string in UniProt format, or None to omit.

    Raises:
        HTTPException 400 on invalid sort value.
    """
    log_info(
        "uniprot_sort_received",
        f"Received sort: {sort}",
        **{"received_sort": sort, "sort_type": type(sort).__name__},
    )

    if not sort:
        log_info("uniprot_sort_omitted", "No sort provided, using default (best match)")
        return None

    sort_str = str(sort).strip().lower()

    # Reject legacy "score" silently
    if sort_str == "score":
        log_warning(
            "uniprot_invalid_sort",
            "Received legacy 'score' sort, omitting",
            **{"received_sort": sort},
        )
        return None

    # Normalize underscore to space (length_asc -> length asc)
    normalized = re.sub(r"_asc$", " asc", sort)
    normalized = re.sub(r"_desc$", " desc", normalized)

    if normalized not in _ALLOWED_SORTS:
        log_warning(
            "uniprot_invalid_sort",
            f"Invalid sort: '{sort}'",
            **{"received_sort": sort, "allowed": sorted(_ALLOWED_SORTS)},
        )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort value: '{sort}'. Allowed: {sorted(_ALLOWED_SORTS)} or omit for best match",
        )

    log_info("uniprot_sort_valid", f"Using sort: {normalized}", **{"sort": normalized})
    return normalized


def _build_url(
    api_query: str,
    request: UniProtQueryExecuteRequest,
    sort_value: Optional[str],
    requested_size: int = 500,
    endpoint: str = "search",
) -> str:
    """Build the UniProt REST API export URL.

    Args:
        endpoint: "search" (paginated, max 500/page) or "stream" (single response).
    """
    # For search endpoint, cap at 500 per page (UniProt limit).
    # For stream endpoint, pass the full requested size.
    size = requested_size if endpoint == "stream" else min(max(requested_size, 1), 500)
    return build_uniprot_export_url(
        api_query,
        format="tsv",
        reviewed=request.reviewed,
        length_min=request.length_min,
        length_max=request.length_max,
        sort=sort_value,
        include_isoforms=request.include_isoforms or False,
        size=size,
        endpoint=endpoint,
    )


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------

_USER_AGENT = "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"


async def _fetch_uniprot_tsv(url: str, timeout: float = 60.0) -> Tuple[pd.DataFrame, int]:
    """
    Fetch a single page of TSV data from UniProt (max 500 rows).

    For requests >500, use ``_fetch_uniprot_paginated`` instead.

    Returns:
        (DataFrame, total_available) where total_available is from
        the ``X-Total-Results`` header (-1 if missing).
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        headers = {"User-Agent": _USER_AGENT}
        response = await client.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()
        total_available = int(response.headers.get("X-Total-Results", -1))
        df = read_any_table(response.content, "uniprot_export.tsv")
        return df, total_available


async def _fetch_uniprot_stream(url: str, timeout: float = 300.0) -> Tuple[pd.DataFrame, int]:
    """
    Fetch results from UniProt's ``/uniprotkb/stream`` endpoint.

    The stream endpoint returns all matching results in a single response
    (no pagination, up to 10M rows).  Ideal for bulk downloads >500 rows.

    Args:
        url: Full stream URL built by ``_build_url(endpoint="stream")``.
        timeout: Read timeout — generous for large result sets.

    Returns:
        (DataFrame, total_available) where total_available is from
        the ``X-Total-Results`` header (-1 if missing).
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        headers = {"User-Agent": _USER_AGENT}
        response = await client.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()
        total_available = int(response.headers.get("X-Total-Results", -1))
        df = read_any_table(response.content, "uniprot_stream.tsv")
        log_info(
            "uniprot_stream_fetched",
            f"Stream returned {len(df)} rows (total available: {total_available})",
            fetched=len(df),
            total_available=total_available,
        )
        return df, total_available


def _parse_link_header(link_header: str) -> Optional[str]:
    """Extract 'next' URL from UniProt Link header.

    UniProt returns: <https://rest.uniprot.org/...?cursor=xxx>; rel="next"
    """
    for part in link_header.split(","):
        part = part.strip()
        if 'rel="next"' in part:
            url_match = re.match(r"<(.+?)>", part)
            if url_match:
                return url_match.group(1)
    return None


async def _fetch_uniprot_paginated(
    url: str,
    max_results: int,
) -> Tuple[pd.DataFrame, int]:
    """
    Fetch multiple pages from UniProt using cursor-based pagination.

    UniProt API returns max 500 results per page for TSV format.
    For larger requests, follows the ``Link: <url>; rel="next"`` header
    to fetch subsequent pages until *max_results* is reached or no more
    pages are available.

    Rate limiting: 200 ms delay between pages (~5 req/s).  On HTTP 429
    we honour the ``Retry-After`` header and retry once.

    Returns:
        (combined DataFrame, total_available) where total_available comes
        from the first page's ``X-Total-Results`` header (-1 if absent).
    """
    all_dfs: list[pd.DataFrame] = []
    total_available = -1
    fetched = 0
    page = 0
    next_url: Optional[str] = url

    # Per-page timeout: 60 s should be generous for 500 rows of TSV
    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {"User-Agent": _USER_AGENT}

        while next_url and fetched < max_results:
            page += 1
            if page > 1:
                await asyncio.sleep(0.2)

            try:
                response = await client.get(next_url, headers=headers, follow_redirects=True)
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = int(e.response.headers.get("Retry-After", "5"))
                    log_warning(
                        "uniprot_rate_limited",
                        f"Rate limited on page {page}, waiting {retry_after}s",
                        page=page,
                    )
                    await asyncio.sleep(retry_after)
                    response = await client.get(next_url, headers=headers, follow_redirects=True)
                    response.raise_for_status()
                else:
                    raise

            if page == 1:
                total_available = int(response.headers.get("X-Total-Results", -1))

            page_df = read_any_table(response.content, f"uniprot_page_{page}.tsv")
            if len(page_df) == 0:
                break

            all_dfs.append(page_df)
            fetched += len(page_df)

            log_info(
                "uniprot_page_fetched",
                f"Page {page}: {len(page_df)} rows (total so far: {fetched}/{max_results})",
                page=page,
                fetched=fetched,
                target=max_results,
            )

            # Last page: fewer than 500 rows means no more data
            if len(page_df) < 500:
                break

            # Follow cursor via Link header
            link_header = response.headers.get("link", response.headers.get("Link", ""))
            next_url = _parse_link_header(link_header) if link_header else None

            log_info(
                "uniprot_pagination_debug",
                f"Page {page} Link header: {'found' if next_url else 'MISSING'}",
                link_header_present=bool(link_header),
                link_header_value=link_header[:200] if link_header else "",
                next_url_found=bool(next_url),
            )

            if not next_url:
                log_warning(
                    "uniprot_no_link_header",
                    f"No Link header on page {page} — stopping pagination "
                    f"({fetched}/{max_results} fetched, {total_available} available)",
                    fetched=fetched,
                    target=max_results,
                )
                break

    if not all_dfs:
        return pd.DataFrame(), total_available

    combined = pd.concat(all_dfs, ignore_index=True)
    if len(combined) > max_results:
        combined = combined.head(max_results)

    log_info(
        "uniprot_pagination_complete",
        f"Fetched {len(combined)} rows across {page} page(s)",
        total_fetched=len(combined),
        pages=page,
        total_available=total_available,
    )
    return combined, total_available


# ---------------------------------------------------------------------------
# Analysis pipeline (reuses upload_service functions)
# ---------------------------------------------------------------------------


class CancelledError(Exception):
    """Raised when analysis is cancelled due to client disconnect."""

    pass


def _check_cancelled(cancel_event: Optional[threading.Event], stage: str) -> None:
    """Check if the analysis has been cancelled. Raises CancelledError if so."""
    if cancel_event and cancel_event.is_set():
        log_info("analysis_cancelled", f"Analysis cancelled before {stage}")
        raise CancelledError(f"Cancelled before {stage}")


def _run_analysis_pipeline(
    df: pd.DataFrame,
    run_tango: bool,
    run_s4pred: bool,
    sentry_initialized: bool,
    cancel_event: Optional[threading.Event] = None,
) -> Dict[str, Any]:
    """
    Run the full analysis pipeline on a DataFrame of UniProt sequences.

    Args:
        cancel_event: If set, pipeline checks this between stages and aborts early.

    Returns dict with keys:
        rows_out, tango_stats, tango_status, tango_reason, tango_ran, run_dir,
        s4pred_stats, s4pred_status, s4pred_reason, s4pred_ran, ssw_hits
    """
    import time as _time

    n_rows = len(df)

    # Normalize columns
    try:
        df_normalized = normalize_cols(df)
    except Exception as e:
        log_warning("uniprot_normalize_warning", f"Normalization warning: {e}", **{"error": str(e)})
        df_normalized = df

    require_cols(df_normalized, ["Entry", "Sequence"])
    if "Length" not in df_normalized.columns:
        df_normalized["Length"] = df_normalized["Sequence"].astype(str).str.len()

    _check_cancelled(cancel_event, "ff_helix")

    # FF-Helix
    t0 = _time.time()
    ensure_ff_cols(df_normalized)
    ensure_computed_cols(df_normalized)
    log_info(
        "uniprot_stage_time",
        f"FF-Helix: {(_time.time() - t0) * 1000:.0f}ms for {n_rows} rows",
        stage="ff_helix",
    )

    # --- Provider cache: split hits/misses ---
    _cache_active = False
    _df_hits = pd.DataFrame(columns=df_normalized.columns)
    try:
        from services.provider_cache import split_cached_uncached, write_computed_to_cache

        _df_hits, df_normalized = split_cached_uncached(df_normalized, run_tango, run_s4pred)
        _cache_active = True
        if not _df_hits.empty:
            log_info(
                "provider_cache_split",
                f"Cache: {len(_df_hits)} hits, {len(df_normalized)} misses out of {len(_df_hits) + len(df_normalized)}",
            )
    except Exception as e:
        log_warning("provider_cache_split_error", f"Cache error, running full pipeline: {e}")

    _check_cancelled(cancel_event, "tango")

    # TANGO (misses only)
    tango_stats: Dict[str, Any] = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
    tango_status = "OFF"
    tango_reason: Optional[str] = "No sequences to process"
    tango_ran = False
    run_dir: Optional[str] = None

    if not df_normalized.empty:
        t0 = _time.time()
        tango_stats, tango_status, tango_reason, tango_ran, run_dir = run_tango_processing(
            df_normalized,
            trace_entry=None,
            sentry_initialized=sentry_initialized,
            tango_requested=run_tango,
            cancel_event=cancel_event,
        )
        log_info(
            "uniprot_stage_time",
            f"TANGO: {(_time.time() - t0) * 1000:.0f}ms for {len(df_normalized)} rows",
            stage="tango",
        )

    _check_cancelled(cancel_event, "s4pred")

    # S4PRED (misses only)
    s4pred_stats: Dict[str, Any] = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
    s4pred_status = "OFF"
    s4pred_reason: Optional[str] = "No sequences to process"
    s4pred_ran = False

    if not df_normalized.empty:
        t0 = _time.time()
        s4pred_stats, s4pred_status, s4pred_reason, s4pred_ran = run_s4pred_processing(
            df_normalized,
            trace_entry=None,
            sentry_initialized=sentry_initialized,
            s4pred_requested=run_s4pred,
            cancel_check=cancel_event,
        )
        log_info(
            "uniprot_stage_time",
            f"S4PRED: {(_time.time() - t0) * 1000:.0f}ms for {len(df_normalized)} rows",
            stage="s4pred",
        )

    # --- Cache: merge hits back + write misses ---
    _miss_indices = set(df_normalized.index) if not df_normalized.empty else set()

    if not _df_hits.empty:
        df_normalized = pd.concat([_df_hits, df_normalized]).sort_index()
        if tango_ran or (run_tango and not _df_hits.empty):
            tango_ran = True
            tango_status = "AVAILABLE" if run_tango else "OFF"
            tango_reason = None if run_tango else "TANGO not requested"
        if s4pred_ran or (run_s4pred and not _df_hits.empty):
            s4pred_ran = True
            s4pred_status = "AVAILABLE" if run_s4pred else "OFF"
            s4pred_reason = None if run_s4pred else "S4PRED not requested"
        n_rows = len(df_normalized)  # update for downstream logging

        # Re-run cohort-dependent SSW predictions on full merged dataset
        if run_tango and "SSW diff" in df_normalized.columns:
            try:
                tango.filter_by_avg_diff(df_normalized, "uniprot", {"uniprot": {}})
            except Exception as e:
                log_warning("tango_refilter_error", f"SSW re-filter failed: {e}")
        if run_s4pred and "SSW diff (S4PRED)" in df_normalized.columns:
            try:
                import s4pred as _s4pred_mod

                s4pred_preds = _s4pred_mod.filter_by_s4pred_diff(df_normalized)
                df_normalized[_s4pred_mod.SSW_PREDICTION_S4PRED] = s4pred_preds
                df_normalized["S4PRED has data"] = [p is not None for p in s4pred_preds]
            except Exception as e:
                log_warning("s4pred_refilter_error", f"S4PRED SSW re-filter failed: {e}")

    _check_cancelled(cancel_event, "biochem")

    # Biochem + finalize (UniProt queries use default thresholds)
    t0 = _time.time()
    calc_biochem(df_normalized)

    # Write misses to cache (after biochem)
    if _cache_active and _miss_indices:
        try:
            write_computed_to_cache(df_normalized.loc[df_normalized.index.isin(_miss_indices)])
        except Exception:
            pass  # non-blocking
    apply_ff_flags(df_normalized)  # default mode, no user thresholds
    _finalize_ui_aliases(df_normalized)
    finalize_ff_fields(df_normalized)
    log_info(
        "uniprot_stage_time",
        f"Biochem+flags: {(_time.time() - t0) * 1000:.0f}ms for {n_rows} rows",
        stage="biochem",
    )

    # Normalize rows for UI
    t0 = _time.time()
    rows_out = normalize_rows_for_ui(
        df_normalized,
        is_single_row=False,
        tango_enabled=run_tango,
        s4pred_enabled=run_s4pred,
    )
    log_info(
        "uniprot_stage_time",
        f"Normalize: {(_time.time() - t0) * 1000:.0f}ms for {n_rows} rows",
        stage="normalize",
    )

    # SSW stats
    ssw_hits = (
        int(df_normalized["SSW prediction"].notna().sum())
        if "SSW prediction" in df_normalized.columns
        else 0
    )

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
    total_available: int = -1,
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
    inputs_hash = hashlib.sha256(inputs_str.encode("utf-8")).hexdigest()[:16]

    config_dict = {"USE_TANGO": settings.USE_TANGO, "USE_S4PRED": settings.USE_S4PRED}
    config_str = json.dumps(config_dict, sort_keys=True, separators=(",", ":"))
    config_hash = hashlib.sha256(config_str.encode("utf-8")).hexdigest()[:16]

    provider_status_summary = {
        "tango": {
            "status": result["tango_status"],
            "requested": result["tango_stats"].get("requested", 0),
            "parsed_ok": result["tango_stats"].get("parsed_ok", 0),
            "parsed_bad": result["tango_stats"].get("parsed_bad", 0),
        }
        if request.run_tango
        else None,
        "s4pred": {
            "status": result["s4pred_status"],
            "requested": result["s4pred_stats"].get("requested", 0),
            "parsed_ok": result["s4pred_stats"].get("parsed_ok", 0),
            "parsed_bad": result["s4pred_stats"].get("parsed_bad", 0),
        }
        if request.run_s4pred
        else None,
    }

    # Thresholds (UniProt uses defaults)
    resolved_thresholds = resolve_thresholds(None, df)

    meta = ensure_trace_id_in_meta(
        {
            "source": "uniprot_api",
            "query": request.query,
            "api_query_string": api_query,
            "mode": detected_mode,
            "url": uniprot_url,
            "row_count": len(df),
            "size_requested": request.size or 500,
            "size_returned": len(df),
            "total_available": total_available,
            "use_s4pred": request.run_s4pred,
            "use_tango": request.run_tango,
            "run_tango": request.run_tango,
            "run_s4pred": request.run_s4pred,
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
        }
    )

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
        "size": min(max(request.size or 500, 1), 500),  # Fallback is JSON, keep at 500 per page
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
    log_info("uniprot_fallback_url", "Trying minimal fallback", **{"url": minimal_url})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"User-Agent": _USER_AGENT}
            fallback_response = await client.get(minimal_url, headers=headers)
            fallback_response.raise_for_status()

            fallback_data = fallback_response.json()
            results = fallback_data.get("results", [])

            log_info(
                "uniprot_fallback_success",
                f"Fallback got {len(results)} results",
                **{"result_count": len(results)},
            )

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
                log_warning(
                    "uniprot_fallback_analysis_error",
                    f"Error analyzing fallback: {analysis_error}",
                    **{"error": str(analysis_error)},
                )
                # Return raw results
                return {
                    "rows": [
                        {
                            "Entry": r.get("accession", ""),
                            "Entry Name": r.get("id", ""),
                            "Length": r.get("length", 0),
                        }
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
        log_error(
            "uniprot_fallback_failed",
            f"Fallback also failed: {fallback_error}",
            **{"fallback_error": str(fallback_error)},
        )
        # Re-raise the original 400 error
        raise HTTPException(
            status_code=400, detail=json.dumps({"source": "uniprot", "error": error_text})
        ) from fallback_error


# ---------------------------------------------------------------------------
# HTTP error handling
# ---------------------------------------------------------------------------


def _extract_error_text(response_text: str, status_code: int) -> str:
    """Extract a clean error message from UniProt HTML/text error response."""
    # Remove all HTML tags
    error_text = re.sub(r"<[^>]+>", "", response_text)
    error_text = re.sub(r"\s+", " ", error_text).strip()

    # Try to extract meaningful message
    error_patterns = [
        r"Bad Request[:\s]+(.+?)(?:\.|$)",
        r"Invalid query[:\s]+(.+?)(?:\.|$)",
        r"Error[:\s]+(.+?)(?:\.|$)",
        r"HTTP Status \d+[:\s]+(.+?)(?:\.|$)",
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
    cancel_event: Optional[threading.Event] = None,
) -> Dict[str, Any]:
    """
    Execute a UniProt query: fetch → analyze → build response.

    Args:
        cancel_event: If set by the route handler on client disconnect,
            the analysis pipeline will abort between stages.

    Raises:
        HTTPException on errors (400, 500, 502, 504).
    """
    # Log exactly what the frontend sent so toggles/sizes are visible in logs
    log_info(
        "uniprot_request_params",
        f"Request: size={request.size}, run_tango={request.run_tango}, "
        f"run_s4pred={request.run_s4pred}, reviewed={request.reviewed}",
        **{
            "size": request.size,
            "run_tango": request.run_tango,
            "run_s4pred": request.run_s4pred,
            "reviewed": request.reviewed,
            "length_min": request.length_min,
            "length_max": request.length_max,
            "sort": request.sort,
            "include_isoforms": request.include_isoforms,
        },
    )

    # 1. Parse query
    api_query, detected_mode = _parse_query(request)

    # 2. Validate sort
    sort_value = _validate_sort(request.sort)

    # 3. Build URL
    #    UniProt TSV does NOT return Link headers, so cursor pagination fails.
    #    Strategy: search endpoint for <=500, stream endpoint for >500.
    #    Stream returns ALL matching results (ignores size), so we trim after.
    requested_size = min(request.size or 500, 10000)

    if requested_size <= 500:
        use_endpoint = "search"
    else:
        use_endpoint = "stream"

    uniprot_url = _build_url(
        api_query,
        request,
        sort_value,
        requested_size=requested_size,
        endpoint=use_endpoint,
    )

    log_info(
        "uniprot_execute_start",
        "Executing UniProt query",
        **{
            "query": api_query,
            "requested_size": requested_size,
            "endpoint": use_endpoint,
            "reviewed": request.reviewed,
            "sort": sort_value,
        },
    )
    log_info("uniprot_url", f"UniProt URL: {uniprot_url}", **{"url": uniprot_url})

    try:
        # 4. Fetch from UniProt
        if use_endpoint == "stream":
            # Stream returns ALL matching results — we trim to requested_size after.
            # Timeout is generous: large queries can take 30-60s to stream.
            stream_timeout = max(60.0, 30.0 + (requested_size / 500) * 10.0)
            df, total_available = await _fetch_uniprot_stream(uniprot_url, timeout=stream_timeout)
            # Trim to requested size
            if len(df) > requested_size:
                df = df.head(requested_size)
        else:
            fetch_timeout = 30.0 + (requested_size / 500) * 5.0
            df, total_available = await _fetch_uniprot_tsv(uniprot_url, timeout=fetch_timeout)

        log_info(
            "uniprot_fetch_success",
            f"Retrieved {len(df)} rows (total available: {total_available})",
            **{
                "row_count": len(df),
                "columns": list(df.columns),
                "total_available": total_available,
            },
        )

        if len(df) == 0:
            log_warning(
                "uniprot_no_results",
                "Query returned 0 rows",
                **{"query": api_query, "url": uniprot_url},
            )
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

        # 5. Run analysis pipeline with cancellation support
        log_info("uniprot_analysis_start", "Running analysis pipeline")

        _cancel = cancel_event or threading.Event()

        # Run analysis in thread with cancellation support
        analysis_task = asyncio.get_event_loop().run_in_executor(
            None,
            lambda: _run_analysis_pipeline(
                df,
                run_tango=request.run_tango,
                run_s4pred=request.run_s4pred,
                sentry_initialized=sentry_initialized,
                cancel_event=_cancel,
            ),
        )

        try:
            result = await analysis_task
        except CancelledError:
            log_info("uniprot_analysis_cancelled", "Analysis cancelled by client disconnect")
            raise HTTPException(499, detail="Client disconnected, analysis cancelled")

        log_info(
            "uniprot_analysis_complete",
            "Analysis complete",
            **{
                "total_rows": len(result["df"]),
                "ssw_hits": result["ssw_hits"],
                "tango_ran": result["tango_ran"],
                "s4pred_ran": result["s4pred_ran"],
            },
        )

        # 6. Build response
        return _build_response(
            result, request, api_query, detected_mode, uniprot_url, total_available
        )

    except UploadProcessingError as e:
        # Convert service errors to HTTP errors (e.g., TANGO zero outputs)
        raise HTTPException(
            status_code=e.status_code, detail=json.dumps(e.detail) if e.detail else e.message
        ) from e

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        try:
            error_text = _extract_error_text(e.response.text, status_code)
        except Exception:
            error_text = f"Bad Request (HTTP {status_code})"

        if status_code == 400:
            log_warning(
                "uniprot_400_error",
                f"UniProt 400: {error_text}",
                **{"status_code": 400, "original_url": uniprot_url},
            )
            return await _handle_400_fallback(api_query, request, detected_mode, error_text)

        elif status_code >= 500:
            error_msg = f"UniProt API server error ({status_code}): {error_text}"
            log_error("uniprot_api_error", error_msg, **{"status_code": status_code})
            raise HTTPException(status_code=502, detail=error_msg) from e
        else:
            error_msg = f"UniProt API error ({status_code}): {error_text}"
            log_warning("uniprot_client_error", error_msg, **{"status_code": status_code})
            raise HTTPException(
                status_code=400, detail=json.dumps({"source": "uniprot", "error": error_msg})
            ) from e

    except httpx.TimeoutException as e:
        error_msg = "UniProt API request timed out. Try reducing the result size or removing length/sort filters."
        log_error("uniprot_timeout", error_msg)
        raise HTTPException(
            status_code=504, detail=json.dumps({"source": "uniprot", "error": error_msg})
        ) from e

    except HTTPException:
        raise  # Re-raise FastAPI HTTP exceptions as-is

    except Exception as e:
        error_msg = f"Failed to fetch from UniProt: {str(e)}"
        log_error("uniprot_error", error_msg, **{"error": str(e)})
        raise HTTPException(status_code=500, detail=error_msg) from e
