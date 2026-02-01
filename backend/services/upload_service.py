"""
Upload processing service.

Core DataFrame processing logic for file uploads.
HTTP-specific concerns (file validation, UploadFile handling) remain in server.py.
"""
import os
import json
import time
import uuid
import hashlib
from typing import Optional, Dict, Any, List, Tuple

import pandas as pd
import sentry_sdk

import auxiliary
import tango
from config import settings
from calculations.biochem import calculate_biochemical_features as calc_biochem
from services.logger import log_info, log_warning, log_error, get_trace_id
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
    fill_percent_from_tango_if_missing as _fill_percent_from_tango_if_missing,
)

# Provider flags from config
USE_JPRED = settings.USE_JPRED
USE_TANGO = settings.USE_TANGO
USE_PSIPRED = settings.USE_PSIPRED

# Global state for provider status tracking (shared with server.py)
_last_provider_status: Dict[str, Any] = {}
_last_run_dir: Optional[str] = None


def get_last_provider_status() -> Optional[Dict[str, Any]]:
    """Get the last provider status (for /api/providers/last-run endpoint)."""
    return _last_provider_status.copy() if _last_provider_status else None


def get_last_run_dir() -> Optional[str]:
    """Get the last TANGO run directory."""
    return _last_run_dir


def set_last_provider_status(status: Dict[str, Any]) -> None:
    """Set the last provider status (called by both upload and uniprot flows)."""
    global _last_provider_status
    _last_provider_status = status.copy()


def set_last_run_dir(run_dir: Optional[str]) -> None:
    """Set the last TANGO run directory."""
    global _last_run_dir
    _last_run_dir = run_dir


class UploadProcessingError(Exception):
    """Custom exception for upload processing errors."""
    def __init__(self, message: str, detail: Optional[Dict[str, Any]] = None, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.detail = detail or {}
        self.status_code = status_code


def _run_secondary_structure_provider(df: pd.DataFrame, trace_entry: Optional[str], sentry_initialized: bool) -> None:
    """Run secondary structure prediction via provider interface."""
    psipred_start_time = time.time()
    from services.secondary_structure import get_provider
    try:
        provider = get_provider()
        log_info("secondary_structure_start", f"Starting {provider.get_name()} processing")
        provider.run(df)
        psipred_elapsed = (time.time() - psipred_start_time) * 1000
        log_info("secondary_structure_complete", f"{provider.get_name()} processing complete",
                **{"psipred_time_ms": round(psipred_elapsed, 2)})
    except Exception as e:
        trace_id = get_trace_id()
        log_error("secondary_structure_error", f"Secondary structure provider error: {e}",
                stage="psipred", **{"error": str(e), "entry": trace_entry})

        if sentry_initialized:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("provider", "psipred")
                scope.set_tag("stage", "execution")
                scope.set_tag("endpoint", "upload-csv")
                scope.set_context("psipred_error", {
                    "trace_id": trace_id,
                    "entry": trace_entry,
                })
                sentry_sdk.capture_exception(e, level="error")


def _set_ssw_fields_to_none(df: pd.DataFrame) -> None:
    """Set all SSW fields to None for all rows."""
    n = len(df)
    df["SSW fragments"] = pd.Series(["-"] * n, index=df.index, dtype=object)
    df["SSW score"] = pd.Series([None] * n, index=df.index, dtype=object)
    df["SSW diff"] = pd.Series([None] * n, index=df.index, dtype=object)
    df["SSW helix percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
    df["SSW beta percentage"] = pd.Series([None] * n, index=df.index, dtype=object)
    df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)


def _run_tango_processing(
    df: pd.DataFrame,
    trace_entry: Optional[str],
    sentry_initialized: bool
) -> Tuple[Dict[str, Any], str, Optional[str], bool, Optional[str]]:
    """
    Run TANGO processing pipeline.

    Returns:
        Tuple of (tango_stats, tango_provider_status, tango_provider_reason, tango_ran, run_dir)
    """
    tango_stats = {"requested": 0, "parsed_ok": 0, "parsed_bad": 0}
    tango_provider_status = "OFF"
    tango_provider_reason = None
    tango_enabled_flag = USE_TANGO
    tango_requested_flag = True  # Upload CSV always requests Tango if enabled
    tango_ran = False
    run_dir = None

    try:
        if tango_enabled_flag:
            # Build fresh records (Entry, Sequence) from df
            existed = tango.get_all_existed_tango_results_entries()
            records = tango.create_tango_input(df, existed_tango_results=existed, force=True)
            requested = len(records) if records else 0
            tango_stats["requested"] = requested

            if records:
                # Performance timing: TANGO execution
                tango_run_start_time = time.time()
                log_info("tango_run_start", f"Running TANGO for {len(records)} sequences",
                        stage="tango_run", **{"sequence_count": len(records)})
                run_dir = tango.run_tango_simple(records)
                tango_ran = True
                run_id = os.path.basename(run_dir) if run_dir else None
                tango_run_elapsed = (time.time() - tango_run_start_time) * 1000
                log_info("tango_run_complete", f"TANGO run completed, outputs in {run_dir}",
                        stage="tango_run", run_id=run_id, **{"run_dir": run_dir, "tango_run_time_ms": round(tango_run_elapsed, 2)})
            else:
                log_info("tango_skip", "No records to run (possibly all already processed).")
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = "No records to process"
                _set_ssw_fields_to_none(df)

            # Parse the specific run_* back into the DataFrame
            parse_stats = None
            run_id = os.path.basename(run_dir) if run_dir else None
            try:
                # Performance timing: TANGO parsing
                tango_parse_start_time = time.time()
                log_info("tango_parse_start", "Parsing TANGO output files",
                        stage="tango_parse", run_id=run_id)
                parse_stats = tango.process_tango_output(df, run_dir=run_dir)
                if parse_stats:
                    tango_stats["parsed_ok"] = parse_stats.get("parsed_ok", 0)
                    tango_stats["parsed_bad"] = parse_stats.get("parsed_bad", 0)
                    tango_stats["requested"] = parse_stats.get("requested", requested)
                tango_parse_elapsed = (time.time() - tango_parse_start_time) * 1000
                log_info("tango_parse_complete", f"Parsed TANGO outputs: {tango_stats['parsed_ok']} OK, {tango_stats['parsed_bad']} failed",
                        stage="tango_parse", run_id=run_id, **{**tango_stats, "tango_parse_time_ms": round(tango_parse_elapsed, 2)})

                # If parse_ok == 0 and requested > 0, runner likely failed
                if parse_stats and parse_stats.get("parsed_ok", 0) == 0 and parse_stats.get("requested", 0) > 0:
                    tango_provider_status = "UNAVAILABLE"
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
                # Check if this is a fatal "0 outputs" error
                if "TANGO produced 0 outputs" in str(e):
                    trace_id = get_trace_id()
                    log_error("tango_zero_outputs_ui", f"TANGO zero outputs error: {e}", entry=trace_entry,
                            stage="tango_parse", **{"error": str(e), "run_dir": run_dir})

                    if sentry_initialized:
                        with sentry_sdk.push_scope() as scope:
                            scope.set_tag("provider", "tango")
                            scope.set_tag("stage", "parse")
                            scope.set_tag("error_type", "zero_outputs")
                            scope.set_context("tango_parse", {
                                "run_dir": run_dir if run_dir else None,
                                "trace_id": trace_id,
                                "entry": trace_entry,
                            })
                            sentry_sdk.capture_exception(e, level="error")

                    error_detail = {
                        "source": "tango",
                        "error": str(e),
                        "run_dir": run_dir if run_dir else None,
                        "suspected_cause": parse_stats.get("reason", "Unknown") if parse_stats else "Unknown",
                    }
                    raise UploadProcessingError(
                        message="TANGO produced 0 outputs",
                        detail=error_detail,
                        status_code=500
                    )

                # Catch alignment errors and report clearly
                trace_id = get_trace_id()
                log_error("tango_parse_failed", f"TANGO parse error: {e}", entry=trace_entry,
                        stage="tango_parse", **{"error": str(e), "run_dir": run_dir})

                if sentry_initialized:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("provider", "tango")
                        scope.set_tag("stage", "parse")
                        scope.set_context("tango_parse", {
                            "run_dir": run_dir if run_dir else None,
                            "trace_id": trace_id,
                            "entry": trace_entry,
                        })
                        sentry_sdk.capture_exception(e, level="error")

                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Parse error: {str(e)}"
                _set_ssw_fields_to_none(df)

            except Exception as e:
                trace_id = get_trace_id()
                log_error("tango_parse_error", f"Unexpected error during output processing: {e}",
                        entry=trace_entry, stage="tango_parse", **{"error": str(e), "run_dir": run_dir})

                if sentry_initialized:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("provider", "tango")
                        scope.set_tag("stage", "parse")
                        scope.set_context("tango_parse", {
                            "run_dir": run_dir if run_dir else None,
                            "trace_id": trace_id,
                            "entry": trace_entry,
                        })
                        sentry_sdk.capture_exception(e, level="error")

                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Unexpected error: {str(e)}"
                _set_ssw_fields_to_none(df)

            # Step 3: ensure %Helix / %β present from Tango if PSIPRED is off
            _fill_percent_from_tango_if_missing(df)

            # Produce SSW prediction column used by the SSW badge
            try:
                log_info("tango_filter_start", "Computing SSW predictions from TANGO results")
                stats = {"upload": {}}
                tango.filter_by_avg_diff(df, "upload", stats)
                log_info("tango_filter_complete", "SSW predictions computed")
            except ValueError as e:
                trace_id = get_trace_id()
                log_error("tango_filter_failed", f"SSW prediction computation failed: {e}",
                        entry=trace_entry, stage="tango_filter", **{"error": str(e)})

                if sentry_initialized:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("provider", "tango")
                        scope.set_tag("stage", "filter")
                        scope.set_context("tango_filter", {
                            "trace_id": trace_id,
                            "entry": trace_entry,
                        })
                        sentry_sdk.capture_exception(e, level="error")

                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"SSW prediction computation failed: {str(e)}"
                n = len(df)
                df["SSW prediction"] = pd.Series([None] * n, index=df.index, dtype=object)
            except Exception as e:
                trace_id = get_trace_id()
                log_error("tango_filter_error", f"Could not compute SSW prediction: {e}",
                        entry=trace_entry, stage="tango_filter", **{"error": str(e)})

                if sentry_initialized:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("provider", "tango")
                        scope.set_tag("stage", "filter")
                        scope.set_context("tango_filter", {
                            "trace_id": trace_id,
                            "entry": trace_entry,
                        })
                        sentry_sdk.capture_exception(e, level="error")

                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"SSW prediction error: {str(e)}"

            # Compute provider status based on parse stats (canonical rules)
            parsed_ok = tango_stats.get("parsed_ok", 0)
            requested = tango_stats.get("requested", 0)

            if not settings.USE_TANGO:
                tango_provider_status = "OFF"
                tango_provider_reason = "TANGO disabled in environment (USE_TANGO=0)"
            elif parsed_ok == 0 and requested > 0:
                tango_provider_status = "UNAVAILABLE"
                tango_provider_reason = f"Runner failed; {parsed_ok}/{requested} parsed"
                _set_ssw_fields_to_none(df)
            elif 0 < parsed_ok < requested:
                tango_provider_status = "PARTIAL"
                tango_provider_reason = f"Only {parsed_ok}/{requested} sequences processed successfully"
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
                tango_provider_status = "OFF"
                tango_provider_reason = "No TANGO run attempted"

            log_info("tango_stats", f"TANGO provider status: {tango_provider_status}", **{
                "status": tango_provider_status,
                "reason": tango_provider_reason,
                **tango_stats,
            })

        else:
            # ENV USE_TANGO=false: Always skip (primary gate)
            log_info("tango_disabled", "TANGO disabled by USE_TANGO env (USE_TANGO=0)",
                    **{"run_tango": False, "reason": "TANGO disabled in environment (USE_TANGO=0)"})
            tango_provider_status = "OFF"
            tango_provider_reason = "TANGO disabled in environment (USE_TANGO=0)"

    except UploadProcessingError:
        # Re-raise our custom errors
        raise
    except Exception as e:
        trace_id = get_trace_id()
        log_error("tango_error", f"TANGO error: {e} (continuing without Tango)",
                entry=trace_entry, stage="tango", **{"error": str(e)})

        if sentry_initialized:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("provider", "tango")
                scope.set_tag("stage", "general")
                scope.set_context("tango_error", {
                    "trace_id": trace_id,
                    "entry": trace_entry,
                })
                sentry_sdk.capture_exception(e, level="error")

        tango_provider_status = "UNAVAILABLE"
        tango_provider_reason = f"TANGO execution error: {str(e)}"

    return tango_stats, tango_provider_status, tango_provider_reason, tango_ran, run_dir


def _compute_ssw_stats(rows_out: List[Dict[str, Any]], trace_entry: Optional[str]) -> Tuple[int, int, float]:
    """
    Compute SSW positive statistics from final normalized rows.

    Returns:
        Tuple of (ssw_positives, ssw_valid_count, ssw_percent)
    """
    ssw_positives = 0
    ssw_valid_count = 0
    ssw_positive_entries = []

    for row_dict in rows_out:
        ssw_val = row_dict.get("sswPrediction")
        if ssw_val is not None and ssw_val != "null":
            ssw_valid_count += 1
            if isinstance(ssw_val, (int, float)) and ssw_val == 1:
                ssw_positives += 1
                ssw_positive_entries.append(row_dict.get("id", "unknown"))

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
                trace_row = trace_row_out[0]
                ssw_val = trace_row.get("sswPrediction")
                print(f"  ✗ Entry {trace_entry} NOT counted as positive (value: {ssw_val}, type: {type(ssw_val).__name__})")

    return ssw_positives, ssw_valid_count, ssw_percent


def _compute_reproducibility_primitives(
    df: pd.DataFrame,
    threshold_config_requested: Optional[Dict[str, Any]],
    tango_stats: Dict[str, Any],
    tango_enabled_flag: bool,
    tango_provider_status: str
) -> Tuple[str, str, str, str, Dict[str, Any], Dict[str, float]]:
    """
    Compute reproducibility primitives for the response.

    Returns:
        Tuple of (repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary, resolved_thresholds)
    """
    # 1. Generate run_id (uuid4) for this request
    repro_run_id = str(uuid.uuid4())

    # 2. Get traceId from context (set by middleware)
    trace_id = get_trace_id_for_response()

    # 3. Compute inputs_hash from cleaned sequences + IDs
    inputs_data = []
    for _, row in df.iterrows():
        entry_id = str(row.get("Entry", "")).strip()
        seq_raw = str(row.get("Sequence", "")).strip()
        seq_cleaned = auxiliary.get_corrected_sequence(seq_raw) if seq_raw else ""
        if entry_id and seq_cleaned:
            inputs_data.append(f"{entry_id}:{seq_cleaned}")

    inputs_data.sort()
    inputs_str = "\n".join(inputs_data)
    inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]

    # 4. Compute config_hash from configuration flags/options
    config_dict = {
        "USE_TANGO": USE_TANGO,
        "USE_PSIPRED": USE_PSIPRED,
        "USE_JPRED": USE_JPRED,
    }
    config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
    config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]

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

    return repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary, resolved_thresholds


def process_upload_dataframe(
    df: pd.DataFrame,
    threshold_config_requested: Optional[Dict[str, Any]],
    threshold_config_resolved: Dict[str, Any],
    trace_entry: Optional[str] = None,
    sentry_initialized: bool = False
) -> Dict[str, Any]:
    """
    Process an uploaded DataFrame through the full pipeline.

    This is the core processing logic extracted from upload_csv.
    HTTP-specific concerns (file validation, HTTPException) remain in server.py.

    Args:
        df: Parsed and normalized DataFrame with Entry and Sequence columns
        threshold_config_requested: Parsed threshold config from JSON, or None
        threshold_config_resolved: Resolved config dict with mode/version/custom
        trace_entry: Optional entry ID for detailed tracing
        sentry_initialized: Whether Sentry is initialized for error reporting

    Returns:
        Dict with 'rows' (list of peptide dicts) and 'meta' (metadata dict)

    Raises:
        UploadProcessingError: For processing errors that should be returned as HTTP errors
    """
    global _last_provider_status, _last_run_dir

    # Performance timing: FF-Helix computation
    ff_helix_start_time = time.time()
    log_info("ff_helix_compute_start", "Computing FF-Helix % for all sequences")
    ensure_ff_cols(df)
    ensure_computed_cols(df)
    ff_helix_elapsed = (time.time() - ff_helix_start_time) * 1000
    log_info("ff_helix_complete", f"Computed FF-Helix for {len(df)} peptides",
            **{"ff_helix_time_ms": round(ff_helix_elapsed, 2)})

    # Secondary structure prediction via provider interface
    _run_secondary_structure_provider(df, trace_entry, sentry_initialized)

    # --- TANGO processing ---
    tango_stats, tango_provider_status, tango_provider_reason, tango_ran, run_dir = _run_tango_processing(
        df, trace_entry, sentry_initialized
    )
    tango_enabled_flag = USE_TANGO
    tango_requested_flag = True

    # JPred disabled - kept for reference only
    jpred_hits = 0
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
    biochem_start_time = time.time()
    log_info("biochem_compute_start", "Computing biochemical features (Charge, Hydrophobicity, μH)")
    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df)
    finalize_ff_fields(df)
    biochem_elapsed = (time.time() - biochem_start_time) * 1000
    log_info("biochem_complete", f"Computed biochemical features for {len(df)} peptides",
            **{"biochem_time_ms": round(biochem_elapsed, 2)})

    # Debug: Log after finalize_ui_aliases
    if trace_entry:
        trace_row = df[df["Entry"].astype(str).str.strip() == str(trace_entry).strip()]
        if not trace_row.empty:
            log_info("trace_after_finalize", f"After finalize for entry {trace_entry}", entry=trace_entry)
            for col in ["SSW prediction", "FF-Helix %"]:
                if col in df.columns:
                    val = trace_row.iloc[0][col]
                    log_info("trace_field", f"{col}: {val}", entry=trace_entry, **{"field": col, "value": str(val), "type": type(val).__name__})

    # Normalize rows for UI
    normalize_ui_start_time = time.time()
    run_id_for_log = os.path.basename(run_dir) if run_dir else None
    log_info("normalize_ui_start", "Normalizing rows for UI output",
            stage="normalize_rows_for_ui", run_id=run_id_for_log)
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=USE_TANGO,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=USE_JPRED
    )
    normalize_ui_elapsed = (time.time() - normalize_ui_start_time) * 1000
    log_info("normalize_ui_complete", f"Normalized {len(rows_out)} rows for UI",
            stage="normalize_rows_for_ui", run_id=run_id_for_log, **{"row_count": len(rows_out), "normalize_ui_time_ms": round(normalize_ui_elapsed, 2)})

    # Schema assert: When provider status is not AVAILABLE, ensure all dependent row fields are null
    if os.getenv("ENABLE_PROVIDER_STATUS_ASSERT", "0") == "1":
        for row_dict in rows_out:
            provider_status = row_dict.get("providerStatus", {})
            tango_status = provider_status.get("tango", {}).get("status") if isinstance(provider_status, dict) else None
            if tango_status and tango_status != "AVAILABLE":
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

    # Compute SSW positive stats
    ssw_positives, ssw_valid_count, ssw_percent = _compute_ssw_stats(rows_out, trace_entry)

    ff_avail = int((pd.to_numeric(df.get("FF-Helix %", pd.Series([-1]*len(df))), errors="coerce") != -1).sum())

    tango_run_dir_basename = os.path.basename(run_dir) if run_dir else None

    log_info("upload_complete", f"Upload processing complete", stage="response", run_id=tango_run_dir_basename, **{
        "total_rows": len(df),
        "jpred_hits": jpred_hits,
        "ssw_hits": ssw_hits,
        "ssw_positive_percent": ssw_percent,
        "ssw_positives": ssw_positives,
        "ff_helix_available": ff_avail,
    })

    # Build provider status metadata
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
    _last_provider_status = provider_status_meta.copy()
    _last_provider_status["total_rows"] = len(df)
    _last_provider_status["ssw_rows_with_data"] = ssw_hits
    _last_run_dir = tango._latest_run_dir()

    # Compute reproducibility primitives
    repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary, resolved_thresholds = _compute_reproducibility_primitives(
        df, threshold_config_requested, tango_stats, tango_enabled_flag, tango_provider_status
    )

    return {
        "rows": rows_out,
        "meta": ensure_trace_id_in_meta({
            "use_jpred": False, "use_tango": USE_TANGO,
            "jpred_rows": jpred_hits, "ssw_rows": ssw_hits,
            "valid_seq_rows": int(df["Sequence"].notna().sum()),
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
        })
    }
