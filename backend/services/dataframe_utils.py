"""
DataFrame utility functions for data processing.
"""

import io
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import HTTPException

from auxiliary import ff_helix_cores, ff_helix_percent
from config import settings

# Column constants
TANGO_COLS = ["SSW prediction", "SSW score"]
BIOCHEM_COLS = ["Charge", "Hydrophobicity", "Full length uH"]


def has_any(df: pd.DataFrame, cols: List[str]) -> bool:
    """Check if DataFrame has any of the specified columns."""
    return any(c in df.columns for c in cols)


def has_all(df: pd.DataFrame, cols: List[str]) -> bool:
    """Check if DataFrame has all of the specified columns."""
    return all(c in df.columns for c in cols)


def ensure_ff_cols(df: pd.DataFrame) -> None:
    """Ensure FF-Helix columns exist in DataFrame."""
    df["FF-Helix %"] = df["Sequence"].astype(str).apply(ff_helix_percent)
    df["FF Helix fragments"] = df["Sequence"].astype(str).apply(ff_helix_cores)


def ensure_cols(df: pd.DataFrame) -> None:
    """Ensure all required columns exist with default values."""
    required_cols = [
        "Charge",
        "Hydrophobicity",
        "Full length uH",
        "Helix (Jpred) uH",
        "Beta full length uH",
        "SSW prediction",
        "SSW score",
        "SSW diff",
        "SSW helix percentage",
        "SSW beta percentage",
        "FF-Secondary structure switch",
        "FF-Helix (Jpred)",
    ]

    for col in required_cols:
        if col not in df.columns:
            if col == "Helix fragments (Jpred)":
                df[col] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[col] = None  # Use None instead of -1 for missing data


def ff_flags(df: pd.DataFrame) -> None:
    """Calculate FF flags based on existing data."""
    # This function should compute your final FF flags
    # For now, just ensure the columns exist
    if "FF-Helix (Jpred)" not in df.columns:
        df["FF-Helix (Jpred)"] = None  # Use None instead of -1 for missing data
    if "FF-Secondary structure switch" not in df.columns:
        df["FF-Secondary structure switch"] = None  # Use None instead of -1 for missing data


def ensure_computed_cols(df: pd.DataFrame) -> None:
    """Ensure computed columns exist with default values."""
    for c in [
        "Charge",
        "Hydrophobicity",
        "Full length uH",
        "Helix (Jpred) uH",
        "Helix fragments (Jpred)",
        "Helix score (Jpred)",
        "SSW prediction",
        "SSW score",
        "Beta full length uH",
    ]:
        if c not in df.columns:
            if c == "Helix fragments (Jpred)":
                # object dtype column of empty lists
                df[c] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[c] = None  # Use None instead of -1 for missing data


def compute_dataset_ff_thresholds(database: pd.DataFrame) -> Dict[str, Any]:
    """Dataset-derived FF thresholds, matching Peleg ``main.py:147-150``.

    Computes the per-batch mean of two POSITIVE-class metrics:

    * ``ssw_avg_H``    — mean ``Hydrophobicity`` over rows where either TANGO
      or S4PRED called SSW positive (== 1). Mirrors
      ``database[database["SSW prediction"] != -1]["Hydrophobicity"].mean()``
      from her ``perform_fibril_formation_prediction`` step.
    * ``helix_avg_uH`` — mean helix-segment μH over rows where the S4PRED
      helix predictor was positive (``!= -1``). Mirrors her
      ``database[database["Helix score (Jpred)"] != -1]["Helix (Jpred) uH"].mean()``
      (we substitute S4PRED for Jpred).

    Single-sequence runs (``len(database) <= 1``) degenerate to the trivial
    single-row mean — in that case every SSW-positive row would trivially
    clear its own per-row mean, so we fall back to the documented Peleg
    single-sequence constants (``PELEG_DEFAULT_HYDRO_THRESHOLD`` = 0.417,
    ``PELEG_DEFAULT_HELIX_UH_THRESHOLD`` = 0.388) and mark
    ``single_sequence_fallback`` so the UI can surface that the threshold
    was a fallback, not a dataset mean.

    Returns:
        dict with keys:
            - ``ssw_avg_H``: float — hydrophobicity threshold used for FF-SSW
            - ``helix_avg_uH``: float — μH threshold used for FF-Helix
            - ``n_ssw_positive``: int — rows used to compute ``ssw_avg_H``
            - ``n_helix_positive``: int — rows used to compute ``helix_avg_uH``
            - ``single_sequence_fallback``: bool — True when Peleg constants
              were substituted in place of a dataset mean.
    """
    n_rows = len(database)
    fallback_ssw = float(settings.PELEG_DEFAULT_HYDRO_THRESHOLD)
    fallback_helix = float(settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD)

    if n_rows == 0:
        return {
            "ssw_avg_H": fallback_ssw,
            "helix_avg_uH": fallback_helix,
            "n_ssw_positive": 0,
            "n_helix_positive": 0,
            "single_sequence_fallback": True,
        }

    tango_col = "SSW prediction"
    s4pred_ssw_col = "SSW prediction (S4PRED)"
    tango_series = (
        pd.to_numeric(database[tango_col], errors="coerce")
        if tango_col in database.columns
        else pd.Series(np.nan, index=database.index)
    )
    s4pred_ssw_series = (
        pd.to_numeric(database[s4pred_ssw_col], errors="coerce")
        if s4pred_ssw_col in database.columns
        else pd.Series(np.nan, index=database.index)
    )
    ssw_pos_mask = (tango_series == 1) | (s4pred_ssw_series == 1)
    n_ssw_positive = int(ssw_pos_mask.sum())

    # Resolve helix prediction + uH columns (S4PRED-first, Jpred-fallback).
    helix_pred_col: Optional[str] = None
    helix_uh_col: Optional[str] = None
    if "Helix prediction (S4PRED)" in database.columns:
        helix_pred_col = "Helix prediction (S4PRED)"
        if "Helix (s4pred) uH" in database.columns:
            helix_uh_col = "Helix (s4pred) uH"
        elif "Helix (Jpred) uH" in database.columns:
            helix_uh_col = "Helix (Jpred) uH"
    elif "Helix score (Jpred)" in database.columns:
        helix_pred_col = "Helix score (Jpred)"
        if "Helix (Jpred) uH" in database.columns:
            helix_uh_col = "Helix (Jpred) uH"

    if helix_pred_col is not None:
        helix_pred_series = pd.to_numeric(database[helix_pred_col], errors="coerce")
        helix_pos_mask = helix_pred_series.notna() & (helix_pred_series != -1)
    else:
        helix_pos_mask = pd.Series(False, index=database.index)
    n_helix_positive = int(helix_pos_mask.sum())

    # Single-sequence degenerates: mean over 1 positive row equals that row,
    # so the FF gate would trivially pass — substitute Peleg constants instead.
    if n_rows <= 1:
        return {
            "ssw_avg_H": fallback_ssw,
            "helix_avg_uH": fallback_helix,
            "n_ssw_positive": n_ssw_positive,
            "n_helix_positive": n_helix_positive,
            "single_sequence_fallback": True,
        }

    if n_ssw_positive > 0 and "Hydrophobicity" in database.columns:
        ssw_avg_H_raw = pd.to_numeric(
            database.loc[ssw_pos_mask, "Hydrophobicity"], errors="coerce"
        ).mean()
        ssw_avg_H = float(ssw_avg_H_raw) if pd.notna(ssw_avg_H_raw) else fallback_ssw
    else:
        ssw_avg_H = fallback_ssw

    if n_helix_positive > 0 and helix_uh_col is not None and helix_uh_col in database.columns:
        helix_avg_uH_raw = pd.to_numeric(
            database.loc[helix_pos_mask, helix_uh_col], errors="coerce"
        ).mean()
        helix_avg_uH = float(helix_avg_uH_raw) if pd.notna(helix_avg_uH_raw) else fallback_helix
    else:
        helix_avg_uH = fallback_helix

    return {
        "ssw_avg_H": ssw_avg_H,
        "helix_avg_uH": helix_avg_uH,
        "n_ssw_positive": n_ssw_positive,
        "n_helix_positive": n_helix_positive,
        "single_sequence_fallback": False,
    }


def apply_ff_flags(
    df: pd.DataFrame,
    resolved_thresholds: Optional[Dict[str, float]] = None,
    threshold_mode: str = "default",
) -> Dict[str, Any]:
    """
    Apply fibril-forming (FF) flags and scores based on computed metrics.

    Reference: 260120_Alpha_and_SSW_FF_Predictor/main.py
    - ssw_fibril_formation_prediction_by_method (FF-SSW)
    - helix_fibril_formation_prediction_by_method (FF-Helix)

    Args:
        df: DataFrame with peptide data (modified in place).
        resolved_thresholds: Optional dict with user thresholds:
            - hydroCutoff: overrides data-average hydrophobicity for FF-SSW
            - muHCutoff: overrides data-average helix uH for FF-Helix
        threshold_mode: "default" uses data-average, "custom"/"recommended"
            uses resolved_thresholds values.

    Returns:
        Dict with actual thresholds used:
            - ssw_hydro_threshold: float (hydrophobicity threshold for FF-SSW)
            - helix_uH_threshold: float (uH threshold for FF-Helix)

    Outputs (DataFrame columns):
    - FF-Secondary structure switch: 1 (candidate) / -1 (not candidate) / None (no data)
    - FF-SSW score: Hydrophobicity + Beta_full_length_uH + Full_length_uH + SSW_prediction
    - FF-Helix (Jpred): 1 (candidate) / -1 (not candidate) / None (no data)
    - FF-Helix score: helix_uH + helix_score

    Flag semantics (matching sswPrediction convention):
    -  1 = peptide IS a fibrillar candidate
    - -1 = peptide is NOT a fibrillar candidate (data available but below threshold)
    - None/null = data unavailable (provider didn't run)
    """
    use_custom = threshold_mode in ("custom", "recommended") and resolved_thresholds is not None

    # --- Compute Beta full length uH if not present ---
    # Beta uH = hydrophobic_moment(seq, angle=160) — beta-sheet geometry
    # Needed for FF-SSW score formula
    if "Beta full length uH" not in df.columns and "Sequence" in df.columns:
        _compute_beta_uh(df)

    # --- Ensure S4PRED helix-segment uH is present BEFORE thresholds run ---
    # ``compute_dataset_ff_thresholds`` reads ``Helix (s4pred) uH``; the legacy
    # inline path used to materialize it lazily inside the FF-Helix block.
    # Hoisting it here lets the new helper see the same data the inline
    # block would have seen, so single-vs-batch produces identical answers.
    if "Helix prediction (S4PRED)" in df.columns and "Helix (s4pred) uH" not in df.columns:
        _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")

    # --- Peleg main.py:147-150 — dataset-derived FF thresholds ---
    # In default mode these drive both FF-SSW and FF-Helix gates. In
    # custom/recommended mode they are still computed for the meta payload
    # but the per-row gates use the user-supplied overrides.
    ff_thresholds = compute_dataset_ff_thresholds(df)
    fallback_active = bool(ff_thresholds["single_sequence_fallback"])

    # --- FF-SSW flag and score (Peleg FIX-001 categories 3 + 4) ---
    # Category 3 (SSW)    = TANGO OR S4PRED says ssw=1 (Peleg: must be OR, not AND).
    # Category 4 (FF-SSW) = SSW AND hydrophobicity >= hydrophobicity-threshold.
    tango_ssw_col = "SSW prediction"
    s4pred_ssw_col = "SSW prediction (S4PRED)"
    has_tango_ssw_col = tango_ssw_col in df.columns
    has_s4pred_ssw_col = s4pred_ssw_col in df.columns
    ssw_hydro_threshold = float("nan")

    if has_tango_ssw_col or has_s4pred_ssw_col:
        tango_series = (
            pd.to_numeric(df[tango_ssw_col], errors="coerce")
            if has_tango_ssw_col
            else pd.Series(np.nan, index=df.index)
        )
        s4pred_ssw_series = (
            pd.to_numeric(df[s4pred_ssw_col], errors="coerce")
            if has_s4pred_ssw_col
            else pd.Series(np.nan, index=df.index)
        )

        # Unified SSW classification: positive if either provider says yes;
        # negative if at least one provider has data but neither is positive;
        # None when no provider produced data for the row.
        ssw_pos_mask = (tango_series == 1) | (s4pred_ssw_series == 1)
        ssw_data_mask = tango_series.notna() | s4pred_ssw_series.notna()

        # Choose threshold: custom overrides dataset-derived Peleg mean.
        if use_custom and "hydroCutoff" in resolved_thresholds:
            ssw_hydro_threshold = float(resolved_thresholds["hydroCutoff"])
        else:
            ssw_hydro_threshold = float(ff_thresholds["ssw_avg_H"])

        hydro_col = "Hydrophobicity"
        hydro_series = (
            pd.to_numeric(df[hydro_col], errors="coerce")
            if hydro_col in df.columns
            else pd.Series(float("nan"), index=df.index)
        )

        is_candidate = (
            ssw_pos_mask
            & pd.notna(ssw_hydro_threshold)
            & hydro_series.notna()
            & (hydro_series >= ssw_hydro_threshold)
        )
        flags_arr = np.where(is_candidate, 1, np.where(ssw_data_mask, -1, None))
        ff_ssw_flags = [int(v) if v is not None else None for v in flags_arr]

        # Unified SSW classification (Peleg canonical: SSW = TANGO OR S4PRED).
        # This is the SAME mask that drives FF-SSW above, so by construction the
        # axiom FF-SSW=1 ⇒ SSW=1 holds. The raw "SSW prediction" column is left
        # untouched (TANGO-only audit trail); the API serializes this unified
        # column as sswPrediction. See ADR-003 + ISSUE-032.
        unified_arr = np.where(ssw_pos_mask, 1, np.where(ssw_data_mask, -1, None))
        df["SSW prediction (unified)"] = [int(v) if v is not None else None for v in unified_arr]

        # PELEG-Q-FIX-013: SSW score retained from TANGO formula
        # (Hydrophobicity + Beta_uH + Full_length_uH + TANGO SSW flag).
        # Peleg flagged the SSW score itself as questionable in FIX-013;
        # awaiting decision before changing the score basis.
        beta_uh = (
            pd.to_numeric(df["Beta full length uH"], errors="coerce")
            if "Beta full length uH" in df.columns
            else pd.Series(float("nan"), index=df.index)
        )
        full_uh = (
            pd.to_numeric(df["Full length uH"], errors="coerce")
            if "Full length uH" in df.columns
            else pd.Series(float("nan"), index=df.index)
        )
        score_basis = tango_series  # TANGO ssw flag drives the score formula
        all_valid = score_basis.notna() & hydro_series.notna() & beta_uh.notna() & full_uh.notna()
        raw_scores = hydro_series + beta_uh + full_uh + score_basis
        ff_ssw_scores = [
            float(raw_scores.iloc[i]) if all_valid.iloc[i] else None for i in range(len(df))
        ]

        df["FF-Secondary structure switch"] = ff_ssw_flags
        df["FF-SSW score"] = ff_ssw_scores
    else:
        df["FF-Secondary structure switch"] = None
        df["FF-SSW score"] = None
        df["SSW prediction (unified)"] = None

    # --- FF-Helix flag and score ---
    # Prefer S4PRED helix data; fall back to Jpred columns if present.
    # Reference: uses helix segment uH vs database-average uH threshold.
    helix_pred_col = None
    helix_uh_col = None
    helix_score_col = None
    helix_uH_threshold = float("nan")

    # Check for S4PRED helix data
    if "Helix prediction (S4PRED)" in df.columns:
        helix_pred_col = "Helix prediction (S4PRED)"
        # Compute S4PRED helix uH if not already present (defensive — hoisted
        # call earlier in this function normally covers it).
        if "Helix (s4pred) uH" not in df.columns:
            _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")
        helix_uh_col = "Helix (s4pred) uH"
        helix_score_col = "Helix score (S4PRED)" if "Helix score (S4PRED)" in df.columns else None
    elif "Helix (Jpred) uH" in df.columns:
        helix_pred_col = "Helix score (Jpred)" if "Helix score (Jpred)" in df.columns else None
        helix_uh_col = "Helix (Jpred) uH"
        helix_score_col = "Helix score (Jpred)" if "Helix score (Jpred)" in df.columns else None

    if helix_pred_col and helix_uh_col and helix_uh_col in df.columns:
        # Choose threshold: custom overrides dataset-derived Peleg mean.
        if use_custom and "muHCutoff" in resolved_thresholds:
            helix_uH_threshold = float(resolved_thresholds["muHCutoff"])
        else:
            helix_uH_threshold = float(ff_thresholds["helix_avg_uH"])

        pred_series = pd.to_numeric(df[helix_pred_col], errors="coerce")
        uh_series = pd.to_numeric(df[helix_uh_col], errors="coerce")
        has_helix_data = pred_series.notna()

        # Flag: pred != -1 AND uH >= threshold
        is_helix_candidate = (
            has_helix_data
            & (pred_series != -1)
            & pd.notna(helix_uH_threshold)
            & uh_series.notna()
            & (uh_series >= helix_uH_threshold)
        )

        flags_arr = np.where(is_helix_candidate, 1, np.where(has_helix_data, -1, None))
        ff_helix_flags = [int(v) if v is not None else None for v in flags_arr]

        # Score: helix_uH + helix_score
        ff_helix_scores = [None] * len(df)
        if helix_score_col and helix_score_col in df.columns:
            score_series = pd.to_numeric(df[helix_score_col], errors="coerce")
            both_valid = uh_series.notna() & score_series.notna()
            raw_scores = uh_series + score_series
            ff_helix_scores = [
                float(raw_scores.iloc[i]) if both_valid.iloc[i] else None for i in range(len(df))
            ]

        df["FF-Helix (Jpred)"] = ff_helix_flags
        df["FF-Helix score"] = ff_helix_scores
    else:
        df["FF-Helix (Jpred)"] = None
        df["FF-Helix score"] = None

    return {
        "ssw_hydro_threshold": (
            ssw_hydro_threshold
            if pd.notna(ssw_hydro_threshold)
            else settings.PELEG_DEFAULT_HYDRO_THRESHOLD
        ),
        "helix_uH_threshold": (
            helix_uH_threshold
            if pd.notna(helix_uH_threshold)
            else settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD
        ),
        # Peleg main.py:147-150 provenance — surfaced verbatim into
        # Meta.thresholds (camelCase to match the rest of the API contract)
        # so the UI can render "FF threshold derived from N=23 helix-positive
        # peptides, μH = 0.42" honestly. New additive keys — never rename.
        "sswAvgHUsed": float(ff_thresholds["ssw_avg_H"]),
        "helixAvgUhUsed": float(ff_thresholds["helix_avg_uH"]),
        "nSswPositive": int(ff_thresholds["n_ssw_positive"]),
        "nHelixPositive": int(ff_thresholds["n_helix_positive"]),
        "singleSequenceFallback": bool(fallback_active),
    }


def _compute_beta_uh(df: pd.DataFrame) -> None:
    """
    Compute beta-sheet hydrophobic moment (μH with angle=160°) for each row.
    Used in FF-SSW score formula: Hydrophobicity + Beta_uH + Full_uH + SSW_prediction.
    """
    from auxiliary import get_corrected_sequence
    from biochem_calculation import hydrophobic_moment

    def _calc(seq):
        if not seq or not isinstance(seq, str) or pd.isna(seq) or len(seq) == 0:
            return None
        try:
            return hydrophobic_moment(get_corrected_sequence(seq), angle=160)
        except Exception:
            return None

    df["Beta full length uH"] = df["Sequence"].map(_calc)


def _compute_helix_uh(df: pd.DataFrame, fragments_col: str, uh_col: str) -> None:
    """
    Compute average hydrophobic moment (μH) of helix segments for each row.

    Reference: main.py calculate_biochemical_features (lines 104-105):
        uH_helix_s4pred.append(auxiliary.get_avg_uH_by_segments(sequence, row[HELIX_FRAGMENTS_S4PRED]))
    """
    from auxiliary import get_avg_uH_by_segments, get_corrected_sequence

    if fragments_col not in df.columns:
        df[uh_col] = None
        return

    sequences = df["Sequence"]
    fragments = df[fragments_col]
    uh_values = []
    for seq, frags in zip(sequences, fragments):
        if (
            seq
            and isinstance(seq, str)
            and not pd.isna(seq)
            and frags is not None
            and not (isinstance(frags, float) and pd.isna(frags))
            and isinstance(frags, list)
            and len(frags) > 0
        ):
            uh_values.append(get_avg_uH_by_segments(get_corrected_sequence(seq), frags))
        else:
            uh_values.append(None)
    df[uh_col] = uh_values


def fill_percent_from_tango_if_missing(df: pd.DataFrame) -> None:
    """
    If S4PRED is off, ensure percent content fields exist using Tango merges.
    (Your tango.process_tango_output already sets these for each row.)
    We just guarantee presence + numeric dtype so the UI cards can compute means.

    # PELEG-Q-FIX-023: Correlation matrix missing-value treatment — must NOT
    # default to 0. The fillna(0) here is for UI display percentages (means
    # 0% structural content), NOT for correlation inputs. The correlation
    # matrix builder (UI-side) must drop NaN, not coerce to 0. Documented
    # here so the contract is explicit.
    """
    for col in ["SSW helix percentage", "SSW beta percentage"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)


def ssw_positive_percent(df: pd.DataFrame) -> float:
    """Percent of rows that are SSW-positive under the canonical definition
    (TANGO ∪ S4PRED). Prefers the unified column written by apply_ff_flags
    and falls back to the raw TANGO column for DataFrames that pre-date the
    unified-SSW fix. See ISSUE-032."""
    if len(df) == 0:
        return 0.0
    if "SSW prediction (unified)" in df.columns:
        col = "SSW prediction (unified)"
    elif "SSW prediction" in df.columns:
        col = "SSW prediction"
    else:
        return 0.0
    pos = int((df[col] == 1).sum())
    return round(100.0 * pos / len(df), 1)


def require_cols(df: pd.DataFrame, cols: List[str]) -> None:
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
            matches = [
                c
                for c in available
                if c.lower() == col_lower or col_lower in c.lower() or c.lower() in col_lower
            ]
            if matches:
                suggestions[col] = matches[:3]  # Top 3 matches

        suggestion_text = ""
        if suggestions:
            suggestion_parts = []
            for req_col, matches in suggestions.items():
                # Build quoted matches list to avoid nested f-string syntax issues
                quoted_matches = ", ".join(f"'{m}'" for m in matches)
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


def parse_fasta(raw: bytes, filename: str) -> pd.DataFrame:
    """
    Parse FASTA-formatted bytes into a DataFrame.

    Args:
        raw: File contents as bytes
        filename: Original filename (for error messages)

    Returns:
        DataFrame with columns: Entry, Sequence, Length

    Raises:
        ValueError: If no valid FASTA entries are found
    """
    text = raw.decode("utf-8-sig")
    entries = []
    current_entry = None
    current_seq_parts: List[str] = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            # Save previous entry
            if current_entry is not None:
                seq = "".join(current_seq_parts)
                entries.append({"Entry": current_entry, "Sequence": seq, "Length": len(seq)})
            # Parse header: first word after >
            header = line[1:].strip()
            current_entry = header.split()[0] if header else ""
            current_seq_parts = []
        else:
            if current_entry is not None:
                current_seq_parts.append(line)

    # Save last entry
    if current_entry is not None:
        seq = "".join(current_seq_parts)
        entries.append({"Entry": current_entry, "Sequence": seq, "Length": len(seq)})

    if not entries:
        raise ValueError("No valid FASTA entries found")

    return pd.DataFrame(entries, columns=["Entry", "Sequence", "Length"])


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

    # FASTA files (.fasta, .fa, or .txt starting with >)
    if fn.endswith((".fasta", ".fa")):
        return parse_fasta(raw, filename)
    if fn.endswith(".txt") and raw.lstrip(b"\xef\xbb\xbf").lstrip().startswith(b">"):
        return parse_fasta(raw, filename)

    # Excel files (.xlsx, .xls)
    if fn.endswith((".xlsx", ".xls")):
        try:
            bio = io.BytesIO(raw)
            return pd.read_excel(bio, engine="openpyxl" if fn.endswith(".xlsx") else None)
        except Exception as e:
            raise ValueError(
                f"Failed to parse Excel file {filename}: {e}. "
                f"Ensure file is a valid .xlsx or .xls file. "
                f"If using .xlsx, openpyxl must be installed."
            ) from e

    # TSV files (.tsv) - tab-separated
    if fn.endswith(".tsv"):
        try:
            return pd.read_csv(
                io.BytesIO(raw),
                sep="\t",
                encoding="utf-8-sig",  # Strips BOM
                engine="python",  # More lenient with malformed files
            )
        except Exception as e:
            raise ValueError(
                f"Failed to parse TSV file {filename}: {e}. Ensure file uses tab-separated values."
            ) from e

    # CSV or TXT files - try extension-based detection, then auto-detect
    if fn.endswith((".csv", ".txt")):
        # First try comma-separated (most common for .csv)
        if fn.endswith(".csv"):
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=",",  # Explicit comma for .csv
                    encoding="utf-8-sig",  # Strips BOM
                    engine="python",
                )
            except Exception:
                # Fallback: let pandas auto-detect delimiter
                try:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep=None,  # Auto-detect
                        engine="python",
                        encoding="utf-8-sig",
                    )
                except Exception as e:
                    raise ValueError(
                        f"Failed to parse CSV file {filename}: {e}. "
                        f"Ensure file uses comma-separated values."
                    ) from e

        # .txt files - auto-detect delimiter (could be CSV or TSV)
        else:
            # Try auto-detection first
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=None,  # Auto-detect delimiter
                    engine="python",
                    encoding="utf-8-sig",
                )
            except Exception:
                # Fallback: try tab, then comma
                try:
                    return pd.read_csv(
                        io.BytesIO(raw), sep="\t", encoding="utf-8-sig", engine="python"
                    )
                except Exception:
                    return pd.read_csv(
                        io.BytesIO(raw), sep=",", encoding="utf-8-sig", engine="python"
                    )

    # Unknown extension - try auto-detection
    try:
        return pd.read_csv(
            io.BytesIO(raw),
            sep=None,  # Auto-detect delimiter
            engine="python",
            encoding="utf-8-sig",
        )
    except Exception as e:
        raise ValueError(
            f"Unsupported file format: {filename}. "
            f"Accepted formats: .csv, .tsv, .xlsx, .xls, .txt. "
            f"Error: {e}"
        ) from e
