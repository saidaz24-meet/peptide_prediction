"""
DataFrame utility functions for data processing.
"""
import io
from typing import List
import pandas as pd
from fastapi import HTTPException
from auxiliary import ff_helix_percent, ff_helix_cores


# Column constants
JPRED_COLS = ["Helix fragments (Jpred)", "Helix score (Jpred)"]
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
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Beta full length uH", "SSW prediction", "SSW score", "SSW diff",
        "SSW helix percentage", "SSW beta percentage",
        "FF-Secondary structure switch", "FF-Helix (Jpred)"
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
        "Charge", "Hydrophobicity", "Full length uH", "Helix (Jpred) uH",
        "Helix fragments (Jpred)", "Helix score (Jpred)",
        "SSW prediction", "SSW score", "Beta full length uH"
    ]:
        if c not in df.columns:
            if c == "Helix fragments (Jpred)":
                # object dtype column of empty lists
                df[c] = pd.Series([[] for _ in range(len(df))], dtype=object)
            else:
                df[c] = None  # Use None instead of -1 for missing data


def apply_ff_flags(df: pd.DataFrame) -> None:
    """
    Apply fibril-forming (FF) flags and scores based on computed metrics.

    Reference: 260120_Alpha_and_SSW_FF_Predictor/main.py
    - ssw_fibril_formation_prediction_by_method (FF-SSW)
    - helix_fibril_formation_prediction_by_method (FF-Helix)

    Outputs (DataFrame columns):
    - FF-Secondary structure switch: 1 (candidate) / -1 (not candidate) / None (no data)
    - FF-SSW score: Hydrophobicity + Beta_full_length_uH + Full_length_uH + SSW_prediction
    - FF-Helix (Jpred): 1 (candidate) / -1 (not candidate) / None (no data)
    - FF-Helix score: helix_uH + helix_score

    Flag semantics (matching sswPrediction convention):
    -  1 = peptide IS a fibrillar candidate
    - -1 = peptide is NOT a fibrillar candidate (data available but below threshold)
    - None/null = data unavailable (provider didn't run)

    TODO: FF-Helix threshold parameters pending verification with Peleg before paper submission.
    """
    # --- Compute Beta full length uH if not present ---
    # Beta uH = hydrophobic_moment(seq, angle=160) — beta-sheet geometry
    # Needed for FF-SSW score formula
    if "Beta full length uH" not in df.columns and "Sequence" in df.columns:
        _compute_beta_uh(df)

    # --- FF-SSW flag and score ---
    # Reference: avg hydrophobicity of rows WITH valid SSW prediction (not -1)
    ssw_col = "SSW prediction"
    if ssw_col in df.columns:
        valid_ssw_mask = df[ssw_col].notna() & (df[ssw_col] != -1)
        if valid_ssw_mask.any() and "Hydrophobicity" in df.columns:
            ssw_avg_H = pd.to_numeric(
                df.loc[valid_ssw_mask, "Hydrophobicity"], errors="coerce"
            ).mean()
        else:
            ssw_avg_H = float("nan")

        ff_ssw_flags = []
        ff_ssw_scores = []
        for _, r in df.iterrows():
            ssw_val = r.get(ssw_col)

            # No SSW data → null
            if ssw_val is None or (isinstance(ssw_val, float) and pd.isna(ssw_val)):
                ff_ssw_flags.append(None)
                ff_ssw_scores.append(None)
                continue

            # SSW data available — compute flag
            if ssw_val != -1 and pd.notna(ssw_avg_H):
                h = r.get("Hydrophobicity")
                if pd.notna(h) and h >= ssw_avg_H:
                    ff_ssw_flags.append(1)
                else:
                    ff_ssw_flags.append(-1)
            else:
                ff_ssw_flags.append(-1)

            # Score: Hydrophobicity + Beta_uH + Full_length_uH + SSW_prediction
            h = r.get("Hydrophobicity")
            beta_uh = r.get("Beta full length uH")
            full_uh = r.get("Full length uH")
            components = [h, beta_uh, full_uh]
            if all(x is not None and not (isinstance(x, float) and pd.isna(x)) for x in components):
                try:
                    ff_ssw_scores.append(
                        float(h) + float(beta_uh) + float(full_uh) + float(ssw_val)
                    )
                except (TypeError, ValueError):
                    ff_ssw_scores.append(None)
            else:
                ff_ssw_scores.append(None)

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
        # Reference: avg uH of rows where helix_prediction != -1
        valid_helix_mask = df[helix_pred_col].notna() & (df[helix_pred_col] != -1)
        valid_uh_mask = valid_helix_mask & df[helix_uh_col].notna()
        if valid_uh_mask.any():
            helix_avg_uH = pd.to_numeric(
                df.loc[valid_uh_mask, helix_uh_col], errors="coerce"
            ).mean()
        else:
            helix_avg_uH = float("nan")

        ff_helix_flags = []
        ff_helix_scores = []
        for _, r in df.iterrows():
            pred_val = r.get(helix_pred_col)
            uh_val = r.get(helix_uh_col)

            # No helix data → null
            if pred_val is None or (isinstance(pred_val, float) and pd.isna(pred_val)):
                ff_helix_flags.append(None)
                ff_helix_scores.append(None)
                continue

            # Helix data available — compute flag
            if pred_val != -1 and pd.notna(helix_avg_uH) and pd.notna(uh_val):
                if uh_val >= helix_avg_uH:
                    ff_helix_flags.append(1)
                else:
                    ff_helix_flags.append(-1)
            else:
                ff_helix_flags.append(-1)

            # Score: helix_uH + helix_score
            score_val = r.get(helix_score_col) if helix_score_col else None
            if (uh_val is not None and not (isinstance(uh_val, float) and pd.isna(uh_val))
                    and score_val is not None and not (isinstance(score_val, float) and pd.isna(score_val))):
                try:
                    ff_helix_scores.append(float(uh_val) + float(score_val))
                except (TypeError, ValueError):
                    ff_helix_scores.append(None)
            else:
                ff_helix_scores.append(None)

        df["FF-Helix (Jpred)"] = ff_helix_flags
        df["FF-Helix score"] = ff_helix_scores
    else:
        df["FF-Helix (Jpred)"] = None
        df["FF-Helix score"] = None


def _compute_beta_uh(df: pd.DataFrame) -> None:
    """
    Compute beta-sheet hydrophobic moment (μH with angle=160°) for each row.
    Used in FF-SSW score formula: Hydrophobicity + Beta_uH + Full_uH + SSW_prediction.
    """
    from biochem_calculation import hydrophobic_moment
    from auxiliary import get_corrected_sequence

    beta_uh_values = []
    for _, row in df.iterrows():
        seq = row.get("Sequence", "")
        if seq and isinstance(seq, str) and not pd.isna(seq) and len(seq) > 0:
            try:
                corrected = get_corrected_sequence(seq)
                beta_uh_values.append(hydrophobic_moment(corrected, angle=160))
            except Exception:
                beta_uh_values.append(None)
        else:
            beta_uh_values.append(None)
    df["Beta full length uH"] = beta_uh_values


def _compute_helix_uh(df: pd.DataFrame, fragments_col: str, uh_col: str) -> None:
    """
    Compute average hydrophobic moment (μH) of helix segments for each row.

    Reference: main.py calculate_biochemical_features (lines 104-105):
        uH_helix_s4pred.append(auxiliary.get_avg_uH_by_segments(sequence, row[HELIX_FRAGMENTS_S4PRED]))
    """
    from auxiliary import get_avg_uH_by_segments, get_corrected_sequence

    uh_values = []
    for _, row in df.iterrows():
        seq = row.get("Sequence", "")
        fragments = row.get(fragments_col)
        if (seq and isinstance(seq, str) and not pd.isna(seq)
                and fragments is not None
                and not (isinstance(fragments, float) and pd.isna(fragments))
                and isinstance(fragments, list) and len(fragments) > 0):
            corrected_seq = get_corrected_sequence(seq)
            uh = get_avg_uH_by_segments(corrected_seq, fragments)
            uh_values.append(uh)
        else:
            uh_values.append(None)
    df[uh_col] = uh_values


def fill_percent_from_tango_if_missing(df: pd.DataFrame) -> None:
    """
    If PSIPRED is off, ensure percent content fields exist using Tango merges.
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
            matches = [c for c in available if c.lower() == col_lower or col_lower in c.lower() or c.lower() in col_lower]
            if matches:
                suggestions[col] = matches[:3]  # Top 3 matches
        
        suggestion_text = ""
        if suggestions:
            suggestion_parts = []
            for req_col, matches in suggestions.items():
                # Build quoted matches list to avoid nested f-string syntax issues
                quoted_matches = ', '.join(f"'{m}'" for m in matches)
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
    
    # Excel files (.xlsx, .xls)
    if fn.endswith((".xlsx", ".xls")):
        try:
            bio = io.BytesIO(raw)
            return pd.read_excel(bio, engine='openpyxl' if fn.endswith('.xlsx') else None)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file {filename}: {e}. "
                           f"Ensure file is a valid .xlsx or .xls file. "
                           f"If using .xlsx, openpyxl must be installed.")

    # TSV files (.tsv) - tab-separated
    if fn.endswith(".tsv"):
        try:
            return pd.read_csv(
                io.BytesIO(raw),
                sep="\t",
                encoding="utf-8-sig",  # Strips BOM
                engine="python"  # More lenient with malformed files
            )
        except Exception as e:
            raise ValueError(f"Failed to parse TSV file {filename}: {e}. "
                           f"Ensure file uses tab-separated values.")

    # CSV or TXT files - try extension-based detection, then auto-detect
    if fn.endswith((".csv", ".txt")):
        # First try comma-separated (most common for .csv)
        if fn.endswith(".csv"):
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=",",  # Explicit comma for .csv
                    encoding="utf-8-sig",  # Strips BOM
                    engine="python"
                )
            except Exception:
                # Fallback: let pandas auto-detect delimiter
                try:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep=None,  # Auto-detect
                        engine="python",
                        encoding="utf-8-sig"
                    )
                except Exception as e:
                    raise ValueError(f"Failed to parse CSV file {filename}: {e}. "
                                   f"Ensure file uses comma-separated values.")

        # .txt files - auto-detect delimiter (could be CSV or TSV)
        else:
            # Try auto-detection first
            try:
                return pd.read_csv(
                    io.BytesIO(raw),
                    sep=None,  # Auto-detect delimiter
                    engine="python",
                    encoding="utf-8-sig"
                )
            except Exception:
                # Fallback: try tab, then comma
                try:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep="\t",
                        encoding="utf-8-sig",
                        engine="python"
                    )
                except Exception:
                    return pd.read_csv(
                        io.BytesIO(raw),
                        sep=",",
                        encoding="utf-8-sig",
                        engine="python"
                    )

    # Unknown extension - try auto-detection
    try:
        return pd.read_csv(
            io.BytesIO(raw),
            sep=None,  # Auto-detect delimiter
            engine="python",
            encoding="utf-8-sig"
        )
    except Exception as e:
        raise ValueError(f"Unsupported file format: {filename}. "
                       f"Accepted formats: .csv, .tsv, .xlsx, .xls, .txt. "
                       f"Error: {e}")

