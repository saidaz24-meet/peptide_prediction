"""
Service for loading example dataset.
"""
import os
import uuid
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

import tango
from calculations.biochem import calculate_biochemical_features as calc_biochem
from config import settings
from services.dataframe_utils import (
    BIOCHEM_COLS,
    TANGO_COLS,
    ensure_cols,
    ff_flags,
    has_all,
    has_any,
)
from services.logger import log_error, log_info, log_warning
from services.normalize import normalize_cols, normalize_rows_for_ui
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response

# Example dataset config
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/ -> project root
EXAMPLE_PATH = BASE_DIR / "ui" / "public" / "Final_Staphylococcus_2023_new.xlsx"

# Provider flags are read dynamically from settings to avoid caching issues
# Use settings.USE_TANGO, settings.USE_S4PRED directly


def load_example_data(recalc: int = 0) -> dict:
    """
    Serve the presentation dataset with pre-computed predictions.
    By default (recalc=0) we DO NOT recompute biochem/TANGO.
    Set recalc=1 if you explicitly want to recompute locally.
    """
    if not os.path.exists(EXAMPLE_PATH):
        raise HTTPException(status_code=404, detail=f"Example file not found at {EXAMPLE_PATH}")

    try:
        df = pd.read_excel(EXAMPLE_PATH)  # needs openpyxl
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed reading example xlsx: {e}") from e

    # Normalize essential columns but DO NOT drop precomputed fields
    try:
        df = normalize_cols(df)  # your existing helper: maps Entry/Sequence/Length
    except HTTPException:
        # for legacy sheets, derive Length if missing
        if "Sequence" in df.columns and "Length" not in df.columns:
            df["Length"] = df["Sequence"].astype(str).str.len()

    # Decide what to compute based on what's already present
    already_has_biochem = has_all(df, BIOCHEM_COLS)
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

    if recalc or (settings.USE_TANGO and not already_has_tango):
        try:
            # whichever Tango flow you use; if you switched to run_and_attach, call that
            if hasattr(tango, "run_and_attach"):
                tango.run_and_attach(df)
            else:
                try:
                    # For example dataset, use latest run (backward compatibility)
                    tango.process_tango_output(df, run_dir=None)
                except ValueError as e:
                    log_error("tango_output", str(e), stage="example")
                    log_error("tango_output", "Provider status: FAILED - continuing without Tango results", stage="example")
                except Exception as e:
                    log_warning("tango_output", f"Unexpected error during output processing: {e}", stage="example")

                try:
                    tango.filter_by_avg_diff(df, "Example", {"Example": {}})
                except ValueError as e:
                    log_error("tango_filter", str(e), stage="example")
                    log_error("tango_filter", "Provider status: FAILED - SSW prediction computation failed", stage="example")
                except Exception as e:
                    log_warning("tango_filter", f"Tango filter failed (example): {e}", stage="example")
        except Exception as e:
            log_warning("tango_parse", f"Tango parse failed (example): {e}", stage="example")

    # Always compute final FF flags on the DataFrame we're returning
    ensure_cols(df)
    ff_flags(df)

    # build meta so the UI can show provenance pills
    ssw_rows = int((df.get("SSW prediction", pd.Series([-1]*len(df))) != -1).sum())
    meta = ensure_trace_id_in_meta({
        "use_tango": settings.USE_TANGO or already_has_tango,
        "use_s4pred": settings.USE_S4PRED,
        "ssw_rows": ssw_rows,
        "valid_seq_rows": int(df["Sequence"].notna().sum()),
        "provider_status": {},
        "runId": str(uuid.uuid4()),
        "traceId": get_trace_id_for_response(),
        "inputsHash": "",
        "configHash": "",
        "providerStatusSummary": {"tango": None, "s4pred": None},
        "thresholdConfigRequested": None,
        "thresholdConfigResolved": {"mode": "default", "version": "1.0.0"},
        "thresholds": {},
    })
    log_info("example_loaded", f"rows={len(df)} • Tango rows={ssw_rows} • recalc={recalc}", stage="example")

    # Normalize to canonical camelCase using PeptideSchema (with provider status - Principle B)
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=settings.USE_TANGO or already_has_tango,
        s4pred_enabled=settings.USE_S4PRED
    )

    return {"rows": rows_out, "meta": meta}

