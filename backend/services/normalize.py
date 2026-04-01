"""
DataFrame normalization and column finalization functions.
Extracted from server.py to remove duplication across endpoints.
"""

import math
import re
from typing import Dict, List, Optional

import pandas as pd
from fastapi import HTTPException

from schemas.api_models import PeptideRow
from schemas.peptide import PeptideSchema
from schemas.provider_status import PeptideProviderStatus
from services.logger import get_logger, log_info, log_warning
from services.provider_tracking import create_provider_status_for_row

logger = get_logger()

# Accept many UniProt header variants and collapse to canonical keys
HEADER_SYNONYMS: Dict[str, List[str]] = {
    "entry": [
        "entry",
        "accession",
        "ac",
        "uniprotkb",
        "uniprot id",
        "id",
        "primary accession",
        "primary (accession no.)",
        "entry id",
    ],
    "sequence": ["sequence", "seq"],
    "length": ["length", "len"],
    "organism": ["organism", "organism name", "species"],
    "name": ["protein names", "protein name", "entry name", "recommended name", "name"],
    "Gene Names": ["gene names", "gene name", "genes"],
    "Function [CC]": ["function [cc]", "function", "cc_function"],
    "Annotation": ["annotation", "annotation score", "annotation_score"],
}


def _norm(s: str) -> str:
    """Normalize string for header comparison."""
    return str(s).strip().lower().replace("\ufeff", "").strip("\"'")


def canonicalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column headers using explicit matching with priority order.
    Raises HTTPException 400 if multiple columns match the same canonical name.
    """
    # Normalize all column names for comparison
    normalized = {orig: _norm(orig) for orig in df.columns}
    rename = {}
    ambiguous = {}  # Track which canonical names have multiple matches

    for canon, opts in HEADER_SYNONYMS.items():
        matches = []

        # Step 1: Try exact match (highest priority)
        for orig, normed in normalized.items():
            if normed == canon:
                matches.append(orig)
                break  # Exact match wins, stop searching

        # Step 2: If no exact match, try exact match against synonym list
        if not matches:
            for orig, normed in normalized.items():
                if normed in opts:
                    matches.append(orig)
                    break  # First exact match in synonym list wins

        # Step 3: If still no match, try word-boundary substring matching (lower priority)
        if not matches:
            for opt in opts:
                # Use word boundaries to avoid false matches
                pattern = re.compile(r"\b" + re.escape(opt) + r"\b", re.IGNORECASE)
                for orig, normed in normalized.items():
                    if pattern.search(normed):
                        matches.append(orig)
                        break  # First match wins
                if matches:
                    break

        # Check for ambiguous matches
        if len(matches) > 1:
            ambiguous[canon] = matches
        elif len(matches) == 1:
            rename[matches[0]] = canon

    # Raise error if ambiguous matches found
    if ambiguous:
        error_details = []
        for canon, cols in ambiguous.items():
            synonyms = HEADER_SYNONYMS[canon]
            error_details.append(
                f"Ambiguous header '{canon}': multiple columns matched: {cols}. "
                f"Expected one of: {synonyms}"
            )

        raise HTTPException(
            status_code=400,
            detail=f"Ambiguous column headers detected. {'; '.join(error_details)}. "
            f"Available columns: {list(df.columns)}",
        )

    return df.rename(columns=rename)


def normalize_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize column names to expected format.
    Calls canonicalize_headers which may raise HTTPException 400 for ambiguous headers.
    """
    # canonicalize_headers may raise HTTPException 400 - let it propagate
    df = canonicalize_headers(df)

    # Ensure required columns exist
    if "entry" in df.columns:
        df = df.rename(columns={"entry": "Entry"})
    if "sequence" in df.columns:
        df = df.rename(columns={"sequence": "Sequence"})
    if "length" in df.columns:
        df = df.rename(columns={"length": "Length"})
    if "organism" in df.columns:
        df = df.rename(columns={"organism": "Organism"})
    if "name" in df.columns:
        df = df.rename(columns={"name": "Protein name"})

    return df


def create_single_sequence_df(sequence: str, entry: Optional[str] = None) -> pd.DataFrame:
    """
    Create and validate a DataFrame for a single peptide sequence.
    Validates sequence is non-empty and creates proper column structure.

    Args:
        sequence: Raw peptide sequence string
        entry: Optional entry/ID string (defaults to "adhoc")

    Returns:
        DataFrame with columns: Entry, Sequence, Length

    Raises:
        HTTPException 400 if sequence is empty or invalid
    """
    import auxiliary

    if not sequence or not sequence.strip():
        raise HTTPException(status_code=400, detail="Sequence is required and cannot be empty")

    # Get corrected sequence with substitution tracking (ISSUE-024)
    raw_sequence = sequence.strip()
    seq, substitutions, sequence_notes = auxiliary.get_corrected_sequence_with_notes(raw_sequence)

    # Validate sequence is not empty after correction
    if not seq or len(seq) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"Sequence became empty after correction. Original: {sequence[:50]}",
        )

    # Create DataFrame with canonical column names (same as CSV path)
    row_data = {"Entry": (entry or "adhoc").strip(), "Sequence": seq, "Length": len(seq)}
    # Add substitution notes if sequence was modified (ISSUE-024)
    if sequence_notes:
        row_data["sequenceNotes"] = sequence_notes
    if raw_sequence.upper() != seq:
        row_data["originalSequence"] = raw_sequence
    df = pd.DataFrame([row_data])

    return df


def finalize_ui_aliases(df: pd.DataFrame) -> None:
    """
    Add UI-friendly alias columns for compatibility.
    Creates: FF Helix % (alias for FF-Helix %), FF Helix fragments
    """

    # FF-Helix alias: some UIs use "FF Helix %" (no hyphen)
    if "FF-Helix %" in df.columns:
        df["FF Helix %"] = pd.to_numeric(df["FF-Helix %"], errors="coerce")
        # Ensure alias is also clamped to [0.0, 100.0]
        mask_valid = df["FF Helix %"].notna()
        if mask_valid.any():
            df.loc[mask_valid, "FF Helix %"] = df.loc[mask_valid, "FF Helix %"].clip(
                lower=0.0, upper=100.0
            )
    elif "FF Helix %" in df.columns:
        # normalize to the hyphen name too, just in case other parts expect it
        df["FF-Helix %"] = pd.to_numeric(df["FF Helix %"], errors="coerce")
        # Ensure normalized column is clamped to [0.0, 100.0]
        mask_valid = df["FF-Helix %"].notna()
        if mask_valid.any():
            df.loc[mask_valid, "FF-Helix %"] = df.loc[mask_valid, "FF-Helix %"].clip(
                lower=0.0, upper=100.0
            )
    else:
        # Use NaN instead of -1 to indicate missing data
        df["FF-Helix %"] = pd.NA
        df["FF Helix %"] = pd.NA

    # Ensure fragments column exists (empty list per row if missing)
    if "FF Helix fragments" not in df.columns:
        df["FF Helix fragments"] = pd.Series([[] for _ in range(len(df))], dtype=object)


def finalize_ff_fields(df: pd.DataFrame) -> None:
    """
    Finalize FF-Helix fields for UI display.
    Ensures FF-Helix % and FF Helix fragments columns exist with proper types.
    Clamps FF-Helix % to valid range [0.0, 100.0] and replaces invalid values with NaN.
    """
    if "FF-Helix %" not in df.columns:
        df["FF-Helix %"] = pd.NA
    else:
        # Convert to numeric, replace invalid values with NaN (not -1)
        df["FF-Helix %"] = pd.to_numeric(df["FF-Helix %"], errors="coerce")
        # Clamp valid values to [0.0, 100.0] range
        mask_valid = df["FF-Helix %"].notna()
        if mask_valid.any():
            df.loc[mask_valid, "FF-Helix %"] = df.loc[mask_valid, "FF-Helix %"].clip(
                lower=0.0, upper=100.0
            )

    if "FF Helix fragments" not in df.columns:
        df["FF Helix fragments"] = pd.Series([[] for _ in range(len(df))], dtype=object)


def _is_fake_default(value) -> bool:
    """
    Check if a value is a fake default (placeholder for missing data).

    Fake defaults include:
    - -1 for numeric fields (not available marker)
    - Empty string or "-" for string fields
    - Empty lists/dicts when provider didn't run
    - NaN/inf values
    """
    if value is None:
        return True
    if isinstance(value, (int, float)):
        if value == -1:
            return True
        if isinstance(value, float):
            if math.isnan(value) or not math.isfinite(value):
                return True
    if isinstance(value, str):
        if value == "" or value == "-":
            return True
    if isinstance(value, (list, dict)):
        if len(value) == 0:
            return True
    return False


def _convert_fake_defaults_to_null(row_dict: dict, provider_status: PeptideProviderStatus) -> dict:
    """
    Convert fake defaults to null based on provider status.

    Principle C: Missing provider outputs become null, not fake defaults.
    Strict null semantics at API boundary: if provider didn't run or is unavailable,
    ALL provider-owned fields must be null (not -1, not empty string, not 0).

    Logic:
    - If provider is NOT available: nullify ALL provider-owned fields (regardless of value)
    - If provider IS available: only nullify fake defaults (-1, empty string, "-", empty lists), preserve legitimate zeros

    Fake defaults:
    - -1 for numeric fields (not available marker)
    - Empty string ("") or "-" for string fields
    - Empty lists [] or empty dicts {} when provider didn't run
    - NaN/inf values

    Preserve legitimate values when provider ran:
    - 0.0 for percentages (real zero percentage, not missing)
    - -1 for sswPrediction when provider available (valid: means "no switch")
    """
    result = row_dict.copy()

    # TANGO fields: if TANGO is OFF or UNAVAILABLE, nullify ALL TANGO fields
    # PARTIAL means some peptides have data — preserve it, let per-row nulls handle the rest
    if provider_status.tango.status in ("OFF", "UNAVAILABLE"):
        # All TANGO/SSW fields must be null when provider not available
        tango_fields = [
            "sswPrediction",
            "sswScore",
            "sswDiff",
            "sswHelixPercentage",
            "sswBetaPercentage",
            "sswHelixPct",
            "sswBetaPct",
            # Nested tango object fields
            "tangoAgg",
            "tangoBeta",
            "tangoHelix",
            "tangoTurn",
            "tangoAggregationCurve",
            "tangoBetaCurve",
            "tangoHelixCurve",
            "tangoTurnCurve",
            "tangoAggCurve",  # camelCase versions (post-normalization)
            "sswFragments",
            "tangoFragments",
        ]
        for field in tango_fields:
            if field in result:
                result[field] = None

        # Handle nested tango object
        if "tango" in result and isinstance(result["tango"], dict):
            result["tango"] = None
    else:
        # Provider is available: only nullify fake defaults, preserve real zeros
        # Note: -1 for sswPrediction is valid (means "no switch"), so we preserve it
        # But -1 for percentages/score/diff is invalid, so we nullify it
        tango_fake_defaults = {
            # sswPrediction: -1 is valid (no switch), so don't nullify it when available
            "sswScore": [-1, None, "", "-"],
            "sswDiff": [-1, None, "", "-"],
            "sswHelixPercentage": [
                -1
            ],  # -1 is invalid for percentages, but preserve 0.0 (real zero)
            "sswBetaPercentage": [
                -1
            ],  # -1 is invalid for percentages, but preserve 0.0 (real zero)
            "sswHelixPct": [-1],
            "sswBetaPct": [-1],
            "sswFragments": [-1, None, "", "-", []],
            "tangoFragments": [-1, None, "", "-", []],
        }
        for field, fake_values in tango_fake_defaults.items():
            if field in result:
                value = result[field]
                if value in fake_values or _is_fake_default(value):
                    result[field] = None

        # Handle nested tango object: nullify if all curves are empty/None/fake defaults
        if "tango" in result and isinstance(result["tango"], dict):
            tango_obj = result["tango"]
            has_real_data = False
            for k in ["agg", "beta", "helix", "turn"]:
                val = tango_obj.get(k)
                if val is not None and not _is_fake_default(val):
                    has_real_data = True
                    break
            if not has_real_data:
                result["tango"] = None

    # S4PRED fields: if S4PRED is not available/failed/not_configured, nullify ALL S4PRED fields
    if provider_status.s4pred.status != "AVAILABLE":
        # All S4PRED fields must be null when provider not available
        s4pred_fields = [
            "s4predHelixPrediction",
            "s4predHelixFragments",
            "s4predHelixScore",
            "s4predHelixPercent",
            "s4predSswPrediction",
            "s4predSswFragments",
            "s4predSswScore",
            "s4predSswDiff",
            "s4predSswHelixPercent",
            "s4predSswBetaPercent",
            "s4predSswPercent",
            "s4predHasData",
        ]
        for field in s4pred_fields:
            if field in result:
                result[field] = None
    else:
        # Provider is available: only nullify fake defaults, preserve real values
        # Note: -1 for s4predHelixPrediction and s4predSswPrediction is valid (means "no helix/no switch")
        s4pred_fake_defaults = {
            "s4predHelixFragments": [-1, None, "", "-", []],
            "s4predHelixScore": [-1],  # -1 is invalid for score
            "s4predHelixPercent": [-1],  # -1 is invalid for percentages, but preserve 0.0
            "s4predSswFragments": [-1, None, "", "-", []],
            "s4predSswScore": [-1],
            "s4predSswDiff": [-1],
            "s4predSswHelixPercent": [-1],
            "s4predSswBetaPercent": [-1],
            "s4predSswPercent": [-1],
        }
        for field, fake_values in s4pred_fake_defaults.items():
            if field in result:
                value = result[field]
                if value in fake_values or _is_fake_default(value):
                    result[field] = None

    return result


def none_if_nan(x):
    """
    Utility to convert NaN/inf to None for SSW-related fields.
    Returns None if x is None, NaN, or inf; otherwise returns x.
    """
    if x is None:
        return None
    if isinstance(x, float):
        if math.isnan(x) or not math.isfinite(x):
            return None
    return x


def _sanitize_for_json(obj, field_name: str = None):
    """
    Recursively replace NaN/inf values, pandas NA, empty strings, and -1 markers
    with None so the resulting structure is JSON-serializable and follows strict
    null semantics.

    IMPORTANT: -1 is converted to None for all fields EXCEPT sswPrediction,
    where -1 is a valid semantic value meaning "no structural switch predicted".

    Note: This runs AFTER _convert_fake_defaults_to_null, so most fake defaults
    should already be None. This function handles edge cases that might slip through.
    """
    # pandas has an isna util available as pd.isna
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass

    # primitives
    if isinstance(obj, float):
        if math.isfinite(obj):
            # NOTE: Do NOT convert -1.0 to None here.
            # Legitimate floats can be -1.0 (e.g., charge, hydrophobicity).
            # Field-specific fake-default handling is done by _convert_fake_defaults_to_null.
            return obj
        return None  # NaN/inf -> None
    if isinstance(obj, int):
        # Preserve -1 for prediction fields where it's a valid semantic value:
        # - sswPrediction (TANGO): -1 = "no structural switch predicted"
        # - s4predSswPrediction (S4PRED): -1 = "no SSW detected"
        # - s4predHelixPrediction (S4PRED): -1 = "no helix detected"
        # All other -1 values are fake defaults and should be None
        prediction_fields = {
            "sswPrediction",
            "s4predSswPrediction",
            "s4predHelixPrediction",
            "ffHelixFlag",
            "ffSswFlag",
        }
        if obj == -1 and field_name not in prediction_fields:
            return None
        return obj
    if isinstance(obj, str):
        # Convert empty strings and "-" to None (should already be handled, but defensive)
        if obj == "" or obj == "-":
            return None
        return obj
    if isinstance(obj, bool):
        return obj

    # dict-like
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            # Pass field name to allow sswPrediction exception
            sanitized = _sanitize_for_json(v, field_name=k)
            # Preserve None values in dicts for JSON serialization
            out[k] = sanitized
        return out

    # list/tuple/series-like
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]

    # pandas Series / numpy arrays -> convert to list then sanitize
    try:
        if hasattr(obj, "tolist"):
            return _sanitize_for_json(obj.tolist())
    except Exception:
        pass

    # fallback: return as-is (will often be json-serializable)
    return obj


def normalize_rows_for_ui(
    df: pd.DataFrame,
    is_single_row: bool = False,
    tango_enabled: bool = True,
    s4pred_enabled: bool = True,
):
    """
    Normalize DataFrame rows for UI consumption.

    ALWAYS returns camelCase format through PeptideSchema.to_camel_dict().
    This ensures /api/predict and /api/upload-csv return the SAME canonical format.

    Args:
        df: DataFrame with peptide data
        is_single_row: If True, return single dict with camelCase keys (for /api/predict);
                       If False, return list of dicts with camelCase keys (for CSV upload)

    Returns:
        Single dict (if is_single_row=True) or list of dicts (if is_single_row=False)
        Both use camelCase keys (id, sequence, charge, etc.) - NOT capitalized (Entry, Sequence)
    """

    # Shared normalization logic for both single and multi-row paths
    def normalize_single_row(row: pd.Series) -> dict:
        """
        Normalize a single DataFrame row to camelCase dict.

        Uses PeptideSchema.parse_obj() and to_camel_dict() to ensure canonical format.
        """
        try:
            # Convert row to dict with CSV header keys (PeptideSchema expects these aliases)
            row_dict = row.to_dict()

            # Sanitize SSW-related fields: convert NaN/inf to None before Pydantic validation
            ssw_fields = [
                "SSW prediction",
                "SSW score",
                "SSW diff",
                "SSW helix percentage",
                "SSW beta percentage",
            ]
            for field in ssw_fields:
                if field in row_dict:
                    row_dict[field] = none_if_nan(row_dict[field])

            # Use PeptideSchema to validate and normalize
            peptide_obj = PeptideSchema.parse_obj(row_dict)

            # Convert to camelCase for UI (canonical format)
            normalized = peptide_obj.to_camel_dict()

            # Add provider status (Principle B: mandatory provider status)
            # Determine status based on data presence in DataFrame row
            # Note: SSW prediction can be -1 (no switch), 0 (uncertain), or 1 (switch predicted)
            # All three are valid prediction values. None means TANGO didn't run or no data available.
            ssw_pred = row.get("SSW prediction", None)
            tango_output_available = ssw_pred is not None and not pd.isna(ssw_pred)
            s4pred_helix_pred = row.get("Helix prediction (S4PRED)", None)
            s4pred_output_available = s4pred_helix_pred is not None and s4pred_helix_pred in [-1, 1]

            provider_status = create_provider_status_for_row(
                row,
                tango_enabled=tango_enabled,
                s4pred_enabled=s4pred_enabled,
                tango_output_available=tango_output_available,
                s4pred_output_available=s4pred_output_available,
            )
            normalized["providerStatus"] = provider_status.model_dump()

            # Convert fake defaults to null (Principle C: no fake defaults)
            normalized = _convert_fake_defaults_to_null(normalized, provider_status)

            # Sanitize for JSON serialization
            sanitized = _sanitize_for_json(normalized)

            # Validate through PeptideRow model (ISSUE-017: schema enforcement)
            try:
                validated_row = PeptideRow.model_validate(sanitized)
                # Return validated dict, excluding extras to maintain flat structure
                return validated_row.model_dump(exclude_none=True, exclude={"extras"})
            except Exception as e:
                log_warning(
                    "peptide_row_validation_failed",
                    f"Row validation failed: {e}",
                    entry=str(row.get("Entry", "unknown")),
                    **{"error": str(e)},
                )
                # Fall back to sanitized dict on validation failure
                return sanitized
        except Exception as e:
            entry_id = str(row.get("Entry", "unknown"))
            log_warning(
                "normalize_row_failed",
                f"Failed to normalize row {entry_id}: {e}",
                entry=entry_id,
                **{"error": str(e)},
            )
            # Fallback: manually map common fields to ensure ID is present
            # Create minimal provider status for fallback (assume no provider output available)
            fallback_provider_status = create_provider_status_for_row(
                row,
                tango_enabled=tango_enabled,
                s4pred_enabled=s4pred_enabled,
                tango_output_available=False,  # Fallback assumes no provider output
                s4pred_output_available=False,
            )

            # Fallback: ensure FF-Helix % is properly converted (handle both -1 and None)
            ff_helix_raw = row.get("FF-Helix %")
            ff_helix_val = None
            if ff_helix_raw is not None and not pd.isna(ff_helix_raw):
                try:
                    ff_helix_val = float(ff_helix_raw)
                    # Clamp to [0, 100] range (percent units)
                    if ff_helix_val < 0 or ff_helix_val > 100:
                        ff_helix_val = None
                except (ValueError, TypeError):
                    ff_helix_val = None

            fallback = {
                "id": str(row.get("Entry", "")),
                "sequence": str(row.get("Sequence", "")),
                "length": int(row.get("Length", 0)),
                "hydrophobicity": float(row.get("Hydrophobicity", 0))
                if not pd.isna(row.get("Hydrophobicity", None))
                else None,
                "charge": float(row.get("Charge", 0))
                if not pd.isna(row.get("Charge", None))
                else None,
                "muH": row.get("Full length uH"),
                "ffHelixPercent": ff_helix_val,  # Use converted value (None if invalid, not -1)
                "ffHelixFragments": row.get("FF Helix fragments", []),
                "sswPrediction": none_if_nan(row.get("SSW prediction", None)),
                "sswScore": none_if_nan(row.get("SSW score", None)),
                "sswDiff": none_if_nan(row.get("SSW diff", None)),
                "sswHelixPercentage": none_if_nan(row.get("SSW helix percentage", None)),
                "sswBetaPercentage": none_if_nan(row.get("SSW beta percentage", None)),
                "providerStatus": fallback_provider_status.model_dump(),
            }
            # Apply nullification to fallback as well
            fallback = _convert_fake_defaults_to_null(fallback, fallback_provider_status)
            sanitized_fallback = _sanitize_for_json(
                {k: v for k, v in fallback.items() if v is not None}
            )

            # Validate fallback through PeptideRow model (ISSUE-017: schema enforcement)
            try:
                validated_row = PeptideRow.model_validate(sanitized_fallback)
                return validated_row.model_dump(exclude_none=True, exclude={"extras"})
            except Exception as e:
                log_warning(
                    "peptide_row_fallback_validation_failed",
                    f"Fallback row validation failed: {e}",
                    entry=entry_id,
                    **{"error": str(e)},
                )
                return sanitized_fallback

    if is_single_row:
        # Single row normalization (for /api/predict)
        # Use same normalization path as multi-row to ensure canonical camelCase format
        row = df.iloc[0]
        return normalize_single_row(row)
    else:
        # Multiple rows normalization (for /api/upload-csv, /api/example)
        # OPTIMIZATION: Use to_dict('records') instead of iterrows() - much faster
        # This converts DataFrame to list of dicts in one operation, avoiding Series creation per row
        rows_dict_list = df.to_dict("records")
        rows_out = []

        # Check for debug entry (avoid circular import)
        import os

        debug_entry = os.getenv("DEBUG_ENTRY", "").strip()

        # Log first 3 rows after normalization for CSV FF-Helix debugging
        log_first_n = 3
        rows_logged = 0

        # OPTIMIZATION: Pre-compute column access patterns to avoid repeated lookups
        # Get column indices for faster access (if needed)
        {col: i for i, col in enumerate(df.columns)}

        for idx, row_dict in enumerate(rows_dict_list):
            # OPTIMIZATION: row_dict is already a dict, no need to call to_dict()
            # Convert to Series only when needed for provider status calculation
            # (create_provider_status_for_row expects a Series, so we create it lazily)
            row_series = None  # Lazy creation

            def get_row_series(_idx=idx):
                """Lazy creation of Series for provider status calculation"""
                nonlocal row_series
                if row_series is None:
                    row_series = df.iloc[_idx]
                return row_series

            # Use row_dict directly for normalization (faster than Series)
            try:
                # Sanitize SSW-related fields: convert NaN/inf to None before Pydantic validation
                ssw_fields = [
                    "SSW prediction",
                    "SSW score",
                    "SSW diff",
                    "SSW helix percentage",
                    "SSW beta percentage",
                ]
                for field in ssw_fields:
                    if field in row_dict:
                        row_dict[field] = none_if_nan(row_dict[field])

                # Use PeptideSchema to validate and normalize
                peptide_obj = PeptideSchema.parse_obj(row_dict)

                # Convert to camelCase for UI (canonical format)
                normalized = peptide_obj.to_camel_dict()

                # Add provider status (Principle B: mandatory provider status)
                # Determine status based on data presence in DataFrame row
                # Note: SSW prediction can be -1 (no switch), 0 (uncertain), or 1 (switch predicted)
                # All three are valid prediction values. None means TANGO didn't run or no data available.
                ssw_pred = row_dict.get("SSW prediction", None)
                tango_output_available = ssw_pred is not None and not (
                    isinstance(ssw_pred, float) and pd.isna(ssw_pred)
                )
                s4pred_helix_pred = row_dict.get("Helix prediction (S4PRED)", None)
                s4pred_output_available = s4pred_helix_pred is not None and s4pred_helix_pred in [
                    -1,
                    1,
                ]

                # OPTIMIZATION: Only create Series when needed for provider status
                row_for_status = get_row_series()
                provider_status = create_provider_status_for_row(
                    row_for_status,
                    tango_enabled=tango_enabled,
                    s4pred_enabled=s4pred_enabled,
                    tango_output_available=tango_output_available,
                    s4pred_output_available=s4pred_output_available,
                )
                normalized["providerStatus"] = provider_status.model_dump()

                # Convert fake defaults to null (Principle C: no fake defaults)
                normalized = _convert_fake_defaults_to_null(normalized, provider_status)

                # Sanitize for JSON serialization
                normalized = _sanitize_for_json(normalized)

                # Validate through PeptideRow model (ISSUE-017: schema enforcement)
                try:
                    validated_row = PeptideRow.model_validate(normalized)
                    normalized = validated_row.model_dump(exclude_none=True, exclude={"extras"})
                except Exception as e:
                    entry_id = str(row_dict.get("Entry", "unknown"))
                    log_warning(
                        "peptide_row_validation_failed",
                        f"Row validation failed: {e}",
                        entry=entry_id,
                        **{"error": str(e)},
                    )
                    # Continue with sanitized dict on validation failure
            except Exception as e:
                entry_id = str(row_dict.get("Entry", "unknown"))
                log_warning(
                    "normalize_row_failed",
                    f"Failed to normalize row {entry_id}: {e}",
                    entry=entry_id,
                    **{"error": str(e)},
                )
                # Fallback: manually map common fields to ensure ID is present
                row_for_status = get_row_series()
                fallback_provider_status = create_provider_status_for_row(
                    row_for_status,
                    tango_enabled=tango_enabled,
                    s4pred_enabled=s4pred_enabled,
                    tango_output_available=False,
                    s4pred_output_available=False,
                )

                # Fallback: ensure FF-Helix % is properly converted
                ff_helix_raw = row_dict.get("FF-Helix %")
                ff_helix_val = None
                if ff_helix_raw is not None and not pd.isna(ff_helix_raw):
                    try:
                        ff_helix_val = float(ff_helix_raw)
                        if ff_helix_val < 0 or ff_helix_val > 100:
                            ff_helix_val = None
                    except (ValueError, TypeError):
                        ff_helix_val = None

                fallback = {
                    "id": str(row_dict.get("Entry", "")),
                    "sequence": str(row_dict.get("Sequence", "")),
                    "length": int(row_dict.get("Length", 0)),
                    "hydrophobicity": float(row_dict.get("Hydrophobicity", 0))
                    if not pd.isna(row_dict.get("Hydrophobicity", None))
                    else None,
                    "charge": float(row_dict.get("Charge", 0))
                    if not pd.isna(row_dict.get("Charge", None))
                    else None,
                    "muH": row_dict.get("Full length uH"),
                    "ffHelixPercent": ff_helix_val,
                    "ffHelixFragments": row_dict.get("FF Helix fragments", []),
                    "sswPrediction": none_if_nan(row_dict.get("SSW prediction", None)),
                    "sswScore": none_if_nan(row_dict.get("SSW score", None)),
                    "sswDiff": none_if_nan(row_dict.get("SSW diff", None)),
                    "sswHelixPercentage": none_if_nan(row_dict.get("SSW helix percentage", None)),
                    "sswBetaPercentage": none_if_nan(row_dict.get("SSW beta percentage", None)),
                    "providerStatus": fallback_provider_status.model_dump(),
                }
                fallback = _convert_fake_defaults_to_null(fallback, fallback_provider_status)
                sanitized_fallback = _sanitize_for_json(
                    {k: v for k, v in fallback.items() if v is not None}
                )

                # Validate fallback through PeptideRow model (ISSUE-017: schema enforcement)
                try:
                    validated_row = PeptideRow.model_validate(sanitized_fallback)
                    normalized = validated_row.model_dump(exclude_none=True, exclude={"extras"})
                except Exception as e:
                    entry_id = str(row_dict.get("Entry", "unknown"))
                    log_warning(
                        "peptide_row_fallback_validation_failed",
                        f"Fallback row validation failed: {e}",
                        entry=entry_id,
                        **{"error": str(e)},
                    )
                    normalized = sanitized_fallback

            # Debug logging for first N rows
            entry_id = str(row_dict.get("Entry", "")).strip()
            if rows_logged < log_first_n:
                # OPTIMIZATION: row_dict already exists, no need to call to_dict()
                ff_helix_val = row_dict.get("FF-Helix %")
                ff_helix_type = type(ff_helix_val).__name__ if ff_helix_val is not None else "None"
                log_info(
                    "csv_normalize_sample",
                    f"CSV normalization sample row {rows_logged + 1}/{log_first_n}",
                    entry=entry_id,
                    ffHelixPercent_raw=str(ff_helix_val) if ff_helix_val is not None else "None",
                    ffHelixPercent_type=ff_helix_type,
                    ffHelixPercent_is_na=pd.isna(ff_helix_val)
                    if ff_helix_val is not None
                    else True,
                    all_ff_keys=[
                        k
                        for k in row_dict.keys()
                        if "FF" in k or "Helix" in k or "helix" in k.lower()
                    ],
                )

                ff_helix_camel = normalized.get("ffHelixPercent")
                ff_helix_camel_type = (
                    type(ff_helix_camel).__name__ if ff_helix_camel is not None else "None"
                )
                log_info(
                    "csv_normalize_after",
                    f"After PeptideSchema normalization (sample {rows_logged + 1}/{log_first_n})",
                    entry=entry_id,
                    ffHelixPercent=str(ff_helix_camel) if ff_helix_camel is not None else "None",
                    ffHelixPercent_type=ff_helix_camel_type,
                    ffHelixPercent_is_na=pd.isna(ff_helix_camel)
                    if ff_helix_camel is not None
                    else True,
                    all_ff_keys_camel=[
                        k for k in normalized.keys() if "ff" in k.lower() or "helix" in k.lower()
                    ],
                )
                rows_logged += 1

            # Debug: Log before/after PeptideSchema normalization for debug entry
            if debug_entry and entry_id == debug_entry:
                # OPTIMIZATION: row_dict already exists, no need to call to_dict()
                log_info(
                    "normalize_before",
                    f"Before PeptideSchema normalization for entry {entry_id}",
                    entry=entry_id,
                    **{
                        "ssw_keys": [
                            k
                            for k in row_dict.keys()
                            if "SSW" in k or "Helix" in k or "Beta" in k or "FF" in k
                        ]
                    },
                )
                for key in ["SSW prediction", "SSW helix percentage", "SSW beta percentage"]:
                    if key in row_dict:
                        log_info(
                            "normalize_field",
                            f"{key}: {row_dict[key]}",
                            entry=entry_id,
                            **{
                                "field": key,
                                "value": str(row_dict[key]),
                                "type": type(row_dict[key]).__name__,
                            },
                        )

                log_info(
                    "normalize_after",
                    f"After PeptideSchema normalization for entry {entry_id}",
                    entry=entry_id,
                    **{
                        "ssw_keys": [
                            k
                            for k in normalized.keys()
                            if "ssw" in k.lower() or "helix" in k.lower() or "beta" in k.lower()
                        ]
                    },
                )
                for key in ["id", "sswPrediction", "sswHelixPercentage", "sswBetaPercentage"]:
                    if key in normalized:
                        log_info(
                            "normalize_field",
                            f"{key}: {normalized[key]}",
                            entry=entry_id,
                            **{
                                "field": key,
                                "value": str(normalized[key]),
                                "type": type(normalized[key]).__name__,
                            },
                        )

            rows_out.append(normalized)

        return rows_out
