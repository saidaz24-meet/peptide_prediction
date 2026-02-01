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
from services.logger import log_warning
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

# Provider flags from config
USE_JPRED = settings.USE_JPRED
USE_TANGO = settings.USE_TANGO
USE_PSIPRED = settings.USE_PSIPRED


def _run_tango_for_single_sequence(df: pd.DataFrame, entry_id: str, seq: str) -> None:
    """
    Run TANGO processing for a single sequence.

    Updates the DataFrame in place with TANGO results.
    Logs warnings on errors but doesn't raise exceptions.
    """
    try:
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


def _run_secondary_structure_provider(df: pd.DataFrame) -> None:
    """Run secondary structure prediction via provider interface."""
    from services.secondary_structure import get_provider
    try:
        provider = get_provider()
        provider.run(df)
    except Exception as e:
        log_warning("secondary_structure_error", f"Secondary structure provider error: {e}", **{"error": str(e)})


def _build_provider_status_meta(ssw_hits: int, tango_ran: bool) -> Dict[str, Any]:
    """Build provider status metadata for single sequence prediction."""
    return {
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
    if USE_TANGO:
        _run_tango_for_single_sequence(df, entry_id, seq)

    # Secondary structure prediction
    _run_secondary_structure_provider(df)

    # Compute biochemical features
    calc_biochem(df)
    apply_ff_flags(df)
    _finalize_ui_aliases(df)
    finalize_ff_fields(df)

    # Resolve thresholds
    resolved_thresholds = resolve_thresholds(threshold_config_requested, df)

    # Normalize single row for UI
    row_data = normalize_rows_for_ui(
        df,
        is_single_row=True,
        tango_enabled=USE_TANGO,
        psipred_enabled=USE_PSIPRED,
        jpred_enabled=USE_JPRED
    )

    # Compute provider status
    tango_ran = USE_TANGO and "SSW prediction" in df.columns
    ssw_hits = 1 if tango_ran and df.iloc[0].get("SSW prediction", -1) != -1 else 0
    jpred_hits = 0  # JPred always disabled

    provider_status_meta = _build_provider_status_meta(ssw_hits, tango_ran)

    # Compute reproducibility primitives
    repro_run_id, trace_id, inputs_hash, config_hash, provider_status_summary = _compute_reproducibility_primitives(
        entry_id, seq, ssw_hits
    )

    # Build complete meta structure
    meta = ensure_trace_id_in_meta({
        "use_jpred": False,
        "use_tango": USE_TANGO,
        "jpred_rows": jpred_hits,
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
        "thresholds": resolved_thresholds,
    })

    return {
        "row": row_data,
        "meta": meta,
    }
