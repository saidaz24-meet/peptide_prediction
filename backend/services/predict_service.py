"""
Single sequence prediction service.

Core processing logic for single sequence predictions.
HTTP-specific concerns (Form params, HTTPException) remain in server.py.
"""
import json
import uuid
import hashlib
from typing import Optional, Dict, Any

import pandas as pd

import auxiliary
import tango
from config import settings
from calculations.biochem import calculate_biochemical_features as calc_biochem
from services.logger import get_trace_id, log_info, log_warning
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response
from services.thresholds import resolve_thresholds
from services.normalize import (
    finalize_ui_aliases as _finalize_ui_aliases,
    finalize_ff_fields,
    normalize_rows_for_ui,
)
from services.dataframe_utils import (
    ensure_ff_cols,
    ensure_computed_cols,
    apply_ff_flags,
    fill_percent_from_tango_if_missing as _fill_percent_from_tango_if_missing,
)
from schemas.api_models import PredictResponse, PeptideRow, Meta
from services.provider_status_builder import build_provider_meta

# Provider flags are read dynamically from settings to avoid caching issues
# Use settings.USE_TANGO, settings.USE_S4PRED directly


def _run_tango_for_single_sequence(df: pd.DataFrame, entry_id: str, seq: str) -> None:
    """
    Run TANGO processing for a single sequence.

    Updates the DataFrame in place with TANGO results.
    Logs warnings on errors but doesn't raise exceptions.
    """
    try:
        tango_records = [(entry_id, seq)]
        run_dir = tango.run_tango_simple(tango_records)

        try:
            tango.process_tango_output(df, run_dir=run_dir)
        except ValueError as e:
            log_warning("tango_parse_error", f"TANGO parse error: {e}")
        except Exception as e:
            log_warning("tango_parse_unexpected", f"Unexpected error during TANGO output processing: {e}")

        _fill_percent_from_tango_if_missing(df)

        try:
            tango.filter_by_avg_diff(df, "single", {"single": {}})
        except ValueError as e:
            log_warning("tango_filter_error", f"SSW prediction computation failed: {e}")
        except Exception as e:
            log_warning("tango_filter_unexpected", f"TANGO filter failed: {e}")
    except Exception as e:
        log_warning("tango_run_error", f"TANGO execution failed: {e}")


def _run_s4pred_provider(df: pd.DataFrame) -> None:
    """Run S4PRED secondary structure prediction and generate SSW predictions."""
    import s4pred
    try:
        success, stats = s4pred.run_s4pred_database(df, "predict", trace_id=get_trace_id())
        log_info("s4pred_complete", f"S4PRED completed: {stats.get('parsed_ok', 0)}/{stats.get('requested', 0)}", **stats)

        if success:
            # Generate SSW predictions using database-average threshold
            try:
                s4pred_predictions = s4pred.filter_by_s4pred_diff(df)
                df[s4pred.SSW_PREDICTION_S4PRED] = s4pred_predictions
                df["S4PRED has data"] = [pred is not None for pred in s4pred_predictions]
            except Exception as e:
                log_warning("s4pred_filter_error", f"Error computing S4PRED SSW predictions: {e}")
    except Exception as e:
        log_warning("s4pred_error", f"S4PRED provider error: {e}", **{"error": str(e)})


def _build_provider_status_meta(ssw_hits: int, tango_ran: bool, s4pred_ran: bool = False) -> Dict[str, Any]:
    """Build provider status metadata for single sequence prediction."""
    tango_status = "AVAILABLE" if ssw_hits > 0 else ("OFF" if not settings.USE_TANGO else "UNAVAILABLE")
    tango_reason = None if ssw_hits > 0 else ("TANGO not enabled" if not settings.USE_TANGO else "No TANGO output")
    s4pred_status = "AVAILABLE" if s4pred_ran else ("OFF" if not settings.USE_S4PRED else "UNAVAILABLE")
    s4pred_reason = None if s4pred_ran else ("S4PRED not enabled" if not settings.USE_S4PRED else "No S4PRED output")

    return build_provider_meta(
        tango_enabled=settings.USE_TANGO,
        tango_ran=tango_ran,
        tango_status=tango_status,
        tango_reason=tango_reason,
        tango_stats={"requested": 1 if settings.USE_TANGO else 0, "parsed_ok": ssw_hits, "parsed_bad": 0},
        s4pred_enabled=settings.USE_S4PRED,
        s4pred_ran=s4pred_ran,
        s4pred_status=s4pred_status,
        s4pred_reason=s4pred_reason,
    )


def _compute_reproducibility_primitives(
    entry_id: str,
    seq: str,
    ssw_hits: int
) -> tuple:
    """
    Compute reproducibility primitives for single sequence prediction.

    Returns:
        Tuple of (repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary)
    """
    # Generate run_id
    repro_run_id = str(uuid.uuid4())

    # Get trace_id from context
    trace_id = get_trace_id_for_response()

    # Compute inputs_hash from cleaned sequence + ID
    seq_cleaned = auxiliary.get_corrected_sequence(seq) if seq else ""
    inputs_str = f"{entry_id}:{seq_cleaned}"
    inputs_hash = hashlib.sha256(inputs_str.encode('utf-8')).hexdigest()[:16]

    # Compute config_hash from configuration flags
    config_dict = {
        "USE_TANGO": settings.USE_TANGO,
        "USE_S4PRED": settings.USE_S4PRED,
    }
    config_str = json.dumps(config_dict, sort_keys=True, separators=(',', ':'))
    config_hash = hashlib.sha256(config_str.encode('utf-8')).hexdigest()[:16]

    # Build provider status summary
    provider_status_summary = {
        "tango": {
            "status": "AVAILABLE" if ssw_hits > 0 else ("OFF" if not settings.USE_TANGO else "UNAVAILABLE"),
            "requested": 1 if settings.USE_TANGO else 0,
            "parsed_ok": ssw_hits,
            "parsed_bad": 0,
        } if settings.USE_TANGO else None,
        "s4pred": {
            "status": "AVAILABLE" if settings.USE_S4PRED else "OFF",
        },
    }

    return repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary


def process_single_sequence(
    df: pd.DataFrame,
    threshold_config_requested: Optional[Dict[str, Any]],
    threshold_config_resolved: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Process a single sequence through the prediction pipeline.

    This is the core processing logic extracted from predict().
    HTTP-specific concerns (Form params, HTTPException) remain in server.py.

    Args:
        df: DataFrame with a single row containing Entry and Sequence columns
        threshold_config_requested: Parsed threshold config from JSON, or None
        threshold_config_resolved: Resolved config dict with mode/version/custom

    Returns:
        Dict with 'row' (peptide data) and 'meta' (metadata dict)
    """
    # Extract sequence and entry for downstream processing
    seq = df.iloc[0]["Sequence"]
    entry_id = df.iloc[0]["Entry"]

    # Compute FF-Helix %
    ensure_ff_cols(df)
    ensure_computed_cols(df)

    # Run TANGO if enabled
    if settings.USE_TANGO:
        _run_tango_for_single_sequence(df, entry_id, seq)

    # Secondary structure prediction
    _run_s4pred_provider(df)

    # Compute biochemical features
    calc_biochem(df)

    # Resolve thresholds BEFORE apply_ff_flags so user thresholds are wired in
    resolved_thresholds = resolve_thresholds(threshold_config_requested, df)
    threshold_mode = (threshold_config_requested or {}).get("mode", "default")
    ff_thresholds_used = apply_ff_flags(df, resolved_thresholds=resolved_thresholds, threshold_mode=threshold_mode)

    _finalize_ui_aliases(df)
    finalize_ff_fields(df)

    # Normalize single row for UI
    row_data = normalize_rows_for_ui(
        df,
        is_single_row=True,
        tango_enabled=settings.USE_TANGO,
        s4pred_enabled=settings.USE_S4PRED
    )

    # Compute provider status
    tango_ran = settings.USE_TANGO and "SSW prediction" in df.columns
    ssw_val = df.iloc[0].get("SSW prediction") if tango_ran else None
    ssw_hits = 1 if tango_ran and ssw_val is not None and not (isinstance(ssw_val, float) and pd.isna(ssw_val)) else 0
    s4pred_ran = settings.USE_S4PRED and "Helix prediction (S4PRED)" in df.columns

    provider_status_meta = _build_provider_status_meta(ssw_hits, tango_ran, s4pred_ran)

    # Compute reproducibility primitives
    repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary = _compute_reproducibility_primitives(
        entry_id, seq, ssw_hits
    )

    # Build complete meta structure
    meta_dict = ensure_trace_id_in_meta({
        "use_tango": settings.USE_TANGO,
        "use_s4pred": settings.USE_S4PRED,
        "ssw_rows": ssw_hits,
        "valid_seq_rows": 1,
        "provider_status": provider_status_meta,
        "runId": repro_run_id,
        "traceId": trace_id,
        "inputsHash": inputs_hash,
        "configHash": config_hash,
        "providerStatusSummary": provider_status_summary,
        "thresholdConfigRequested": threshold_config_requested,
        "thresholdConfigResolved": threshold_config_resolved,
        "thresholds": {**resolved_thresholds, **ff_thresholds_used},
    })

    # ISSUE-018: Validate response through Pydantic model
    # This ensures the response matches the PredictResponse schema
    try:
        validated_meta = Meta.model_validate(meta_dict)
        validated_row = PeptideRow.model_validate(row_data)

        response = PredictResponse(
            row=validated_row,
            meta=validated_meta
        )
        return response.model_dump(exclude_none=True)
    except Exception as e:
        # Graceful fallback: log warning and return unvalidated dict
        log_warning("response_validation_failed", f"PredictResponse validation failed: {e}")
        return {
            "row": row_data,
            "meta": meta_dict,
        }
