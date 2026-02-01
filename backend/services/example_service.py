"""
Service for loading example dataset.
"""
import os
import uuid
import pandas as pd
from pathlib import Path
from fastapi import HTTPException
from config import settings
import tango
from calculations.biochem import calculate_biochemical_features as calc_biochem
from services.normalize import normalize_cols, normalize_rows_for_ui
from services.dataframe_utils import (
    has_all, has_any, ensure_cols, ff_flags,
    BIOCHEM_COLS, JPRED_COLS, TANGO_COLS
)
from services.trace_helpers import ensure_trace_id_in_meta, get_trace_id_for_response


# Example dataset config
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/ -> project root
EXAMPLE_PATH = BASE_DIR / "ui" / "public" / "Final_Staphylococcus_2023_new.xlsx"

# Provider flags are read dynamically from settings to avoid caching issues
# Use settings.USE_TANGO, settings.USE_PSIPRED, settings.USE_JPRED directly


def load_example_data(recalc: int = 0) -> dict:
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

    # Always compute final FF flags on the DataFrame we're returning
    ensure_cols(df)
    ff_flags(df)

    # build meta so the UI can show provenance pills
    meta = ensure_trace_id_in_meta({
        "use_jpred": False,  # JPred disabled - kept for reference only
        "use_tango": settings.USE_TANGO or already_has_tango,
        "jpred_rows": int((df.get("Helix fragments (Jpred)", pd.Series([-1]*len(df))) != -1).sum()),
        "ssw_rows":   int((df.get("SSW prediction", pd.Series([-1]*len(df))) != -1).sum()),
        "valid_seq_rows": int(df["Sequence"].notna().sum()),
        "provider_status": {},
        "runId": str(uuid.uuid4()),
        "traceId": get_trace_id_for_response(),
        "inputsHash": "",
        "configHash": "",
        "providerStatusSummary": {"tango": None, "psipred": None, "jpred": None},
        "thresholdConfigRequested": None,
        "thresholdConfigResolved": {"mode": "default", "version": "1.0.0"},
        "thresholds": {},
    })
    print(f"[EXAMPLE] rows={len(df)} • JPred rows={meta['jpred_rows']} • Tango rows={meta['ssw_rows']} • recalc={recalc}")

    # Normalize to canonical camelCase using PeptideSchema (with provider status - Principle B)
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=settings.USE_TANGO or already_has_tango,
        psipred_enabled=settings.USE_PSIPRED,
        jpred_enabled=False  # JPred disabled
    )

    return {"rows": rows_out, "meta": meta}

