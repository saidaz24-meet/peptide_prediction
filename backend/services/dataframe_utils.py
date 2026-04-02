"""
DataFrame utility functions for data processing.
"""

import io
from typing import Dict, List, Optional

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


def apply_ff_flags(
    df: pd.DataFrame,
    resolved_thresholds: Optional[Dict[str, float]] = None,
    threshold_mode: str = "default",
) -> Dict[str, float]:
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

    # --- FF-SSW flag and score ---
    # Reference: avg hydrophobicity of rows WITH valid SSW prediction (not -1)
    ssw_col = "SSW prediction"
    ssw_hydro_threshold = float("nan")

    if ssw_col in df.columns:
        # Compute data-average hydrophobicity (always, for reference)
        valid_ssw_mask = df[ssw_col].notna() & (df[ssw_col] != -1)
        if valid_ssw_mask.any() and "Hydrophobicity" in df.columns:
            data_avg_H = pd.to_numeric(
                df.loc[valid_ssw_mask, "Hydrophobicity"], errors="coerce"
            ).mean()
        else:
            data_avg_H = float("nan")

        # Choose threshold: custom overrides data-average, reference fallback for NaN
        if use_custom and "hydroCutoff" in resolved_thresholds:
            ssw_hydro_threshold = float(resolved_thresholds["hydroCutoff"])
        elif pd.notna(data_avg_H):
            ssw_hydro_threshold = data_avg_H
        else:
            ssw_hydro_threshold = settings.PELEG_DEFAULT_HYDRO_THRESHOLD

        ssw_series = pd.to_numeric(df[ssw_col], errors="coerce")
        has_data = ssw_series.notna()

        # Flag: SSW != -1 AND hydrophobicity >= threshold
        hydro_col = "Hydrophobicity"
        hydro_series = pd.to_numeric(df[hydro_col], errors="coerce") if hydro_col in df.columns else pd.Series(float("nan"), index=df.index)
        is_candidate = (
            has_data
            & (ssw_series != -1)
            & pd.notna(ssw_hydro_threshold)
            & (hydro_series >= ssw_hydro_threshold)
        )
        # Build flags: None (no data), -1 (not candidate), 1 (candidate)
        # Use numpy for fast vectorized logic, then convert to Python types
        import numpy as np
        flags_arr = np.where(is_candidate, 1, np.where(has_data, -1, None))
        ff_ssw_flags = [int(v) if v is not None else None for v in flags_arr]

        # Score: Hydrophobicity + Beta_uH + Full_length_uH + SSW_prediction
        beta_uh = pd.to_numeric(df["Beta full length uH"], errors="coerce") if "Beta full length uH" in df.columns else pd.Series(float("nan"), index=df.index)
        full_uh = pd.to_numeric(df["Full length uH"], errors="coerce") if "Full length uH" in df.columns else pd.Series(float("nan"), index=df.index)
        all_valid = has_data & hydro_series.notna() & beta_uh.notna() & full_uh.notna()
        raw_scores = hydro_series + beta_uh + full_uh + ssw_series
        ff_ssw_scores = [float(raw_scores.iloc[i]) if all_valid.iloc[i] else None for i in range(len(df))]

        df["FF-Secondary structure switch"] = ff_ssw_flags
        df["FF-SSW score"] = ff_ssw_scores
    else:
        df["FF-Secondary structure switch"] = None
        df["FF-SSW score"] = None

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
        # Compute S4PRED helix uH if not already present
        if "Helix (s4pred) uH" not in df.columns:
            _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")
        helix_uh_col = "Helix (s4pred) uH"
        helix_score_col = "Helix score (S4PRED)" if "Helix score (S4PRED)" in df.columns else None
    elif "Helix (Jpred) uH" in df.columns:
        helix_pred_col = "Helix score (Jpred)" if "Helix score (Jpred)" in df.columns else None
        helix_uh_col = "Helix (Jpred) uH"
        helix_score_col = "Helix score (Jpred)" if "Helix score (Jpred)" in df.columns else None

    if helix_pred_col and helix_uh_col and helix_uh_col in df.columns:
        # Compute data-average uH (always, for reference)
        valid_helix_mask = df[helix_pred_col].notna() & (df[helix_pred_col] != -1)
        valid_uh_mask = valid_helix_mask & df[helix_uh_col].notna()
        if valid_uh_mask.any():
            data_avg_uH = pd.to_numeric(df.loc[valid_uh_mask, helix_uh_col], errors="coerce").mean()
        else:
            data_avg_uH = float("nan")

        # Choose threshold: custom overrides data-average, reference fallback for NaN
        if use_custom and "muHCutoff" in resolved_thresholds:
            helix_uH_threshold = float(resolved_thresholds["muHCutoff"])
        elif pd.notna(data_avg_uH):
            helix_uH_threshold = data_avg_uH
        else:
            helix_uH_threshold = settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD

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
        import numpy as np
        flags_arr = np.where(is_helix_candidate, 1, np.where(has_helix_data, -1, None))
        ff_helix_flags = [int(v) if v is not None else None for v in flags_arr]

        # Score: helix_uH + helix_score
        ff_helix_scores = [None] * len(df)
        if helix_score_col and helix_score_col in df.columns:
            score_series = pd.to_numeric(df[helix_score_col], errors="coerce")
            both_valid = uh_series.notna() & score_series.notna()
            raw_scores = uh_series + score_series
            ff_helix_scores = [float(raw_scores.iloc[i]) if both_valid.iloc[i] else None for i in range(len(df))]

        df["FF-Helix (Jpred)"] = ff_helix_flags
        df["FF-Helix score"] = ff_helix_scores
    else:
        df["FF-Helix (Jpred)"] = None
        df["FF-Helix score"] = None

    return {
        "ssw_hydro_threshold": ssw_hydro_threshold
        if pd.notna(ssw_hydro_threshold)
        else settings.PELEG_DEFAULT_HYDRO_THRESHOLD,
        "helix_uH_threshold": helix_uH_threshold
        if pd.notna(helix_uH_threshold)
        else settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD,
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
    """
    for col in ["SSW helix percentage", "SSW beta percentage"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)


def ssw_positive_percent(df: pd.DataFrame) -> float:
    """Percent of rows that are SSW-positive (SSW prediction == 1)."""
    if "SSW prediction" not in df.columns or len(df) == 0:
        return 0.0
    pos = int((df["SSW prediction"] == 1).sum())
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
