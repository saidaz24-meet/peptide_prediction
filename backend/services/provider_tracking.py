"""
Provider status tracking utilities.

Principle B: Every result must indicate provider availability.
Tracks whether TANGO, PSIPRED, JPRED succeeded, failed, or were unavailable.
"""
from typing import Optional
import pandas as pd
from schemas.provider_status import (
    ProviderStatus,
    PeptideProviderStatus,
    ProviderStatusValue
)


def determine_tango_status(
    row: pd.Series,
    tango_enabled: bool,
    tango_output_available: bool
) -> ProviderStatus:
    """
    Determine TANGO provider status for a single peptide row.
    
    Args:
        row: DataFrame row with TANGO columns
        tango_enabled: Whether TANGO is enabled/configured
        tango_output_available: Whether TANGO output files exist for this peptide
    
    Returns:
        ProviderStatus indicating availability
    """
    if not tango_enabled:
        return ProviderStatus.not_configured("TANGO not enabled")
    
    # Check if TANGO columns have real values (not fake defaults)
    # Fake defaults are: -1, 0, 0.0, "-", empty strings, empty lists
    ssw_pred = row.get("SSW prediction", None)
    ssw_score = row.get("SSW score", None)
    ssw_fragments = row.get("SSW fragments", None)
    ssw_helix_pct = row.get("SSW helix percentage", None)
    ssw_beta_pct = row.get("SSW beta percentage", None)

    # Real TANGO output would have:
    # - ssw_prediction: -1, 0, or 1 (ALL are valid prediction values!)
    #   Note: -1 means "no switch predicted", NOT "not available"
    # - ssw_score: float (valid if not -1.0)
    # - ssw_fragments: string (valid if not "-" or empty)
    # - ssw_helix_percentage / ssw_beta_percentage: valid float values

    has_valid_data = False
    # SSW prediction can be -1, 0, or 1 - all are valid prediction values
    # -1 = no switch, 0 = uncertain, 1 = switch predicted
    if ssw_pred is not None and ssw_pred in [-1, 0, 1]:
        has_valid_data = True
    elif ssw_score is not None and ssw_score != -1.0:
        has_valid_data = True
    elif ssw_fragments is not None and ssw_fragments != "-" and ssw_fragments != "":
        has_valid_data = True
    elif ssw_helix_pct is not None and not pd.isna(ssw_helix_pct) and ssw_helix_pct >= 0:
        has_valid_data = True
    elif ssw_beta_pct is not None and not pd.isna(ssw_beta_pct) and ssw_beta_pct >= 0:
        has_valid_data = True
    
    if has_valid_data:
        return ProviderStatus.available()
    elif tango_output_available:
        # Output files exist but no valid data in row - parsing may have failed
        return ProviderStatus.failed("TANGO output files found but parsing failed")
    else:
        return ProviderStatus.unavailable("TANGO output not available for this sequence")


def determine_psipred_status(
    row: pd.Series,
    psipred_enabled: bool,
    psipred_output_available: bool
) -> ProviderStatus:
    """
    Determine PSIPRED provider status for a single peptide row.
    
    Args:
        row: DataFrame row with PSIPRED columns
        psipred_enabled: Whether PSIPRED is enabled/configured
        psipred_output_available: Whether PSIPRED output files exist for this peptide
    
    Returns:
        ProviderStatus indicating availability
    """
    if not psipred_enabled:
        return ProviderStatus.not_configured("PSIPRED not enabled")
    
    # Check if PSIPRED columns have real values
    helix_frags = row.get("Helix fragments (Psipred)", None)
    helix_pct = row.get("Psipred helix %", None)
    
    # Real PSIPRED output would have non-empty helix_frags or non-zero helix_pct
    has_valid_data = False
    if helix_frags is not None:
        if isinstance(helix_frags, list) and len(helix_frags) > 0:
            has_valid_data = True
        elif isinstance(helix_frags, str) and helix_frags.strip():
            has_valid_data = True
    if helix_pct is not None and not pd.isna(helix_pct) and helix_pct != 0.0:
        has_valid_data = True
    
    if has_valid_data:
        return ProviderStatus.available()
    elif psipred_output_available:
        return ProviderStatus.failed("PSIPRED output files found but parsing failed")
    else:
        return ProviderStatus.unavailable("PSIPRED output not available for this sequence")


def determine_jpred_status(
    row: pd.Series,
    jpred_enabled: bool,
    jpred_output_available: bool
) -> ProviderStatus:
    """
    Determine JPred provider status for a single peptide row.

    Args:
        row: DataFrame row with JPred columns
        jpred_enabled: Whether JPred is enabled/configured
        jpred_output_available: Whether JPred output files exist for this peptide

    Returns:
        ProviderStatus indicating availability
    """
    # JPred is always disabled currently
    if not jpred_enabled:
        return ProviderStatus.not_configured("JPred disabled")

    # Check if JPred columns have real values
    helix_frags = row.get("Helix fragments (Jpred)", None)
    helix_score = row.get("Helix score (Jpred)", None)

    has_valid_data = False
    if helix_frags is not None:
        if isinstance(helix_frags, list) and len(helix_frags) > 0:
            has_valid_data = True
    if helix_score is not None and not pd.isna(helix_score) and helix_score != -1:
        has_valid_data = True

    if has_valid_data:
        return ProviderStatus.available()
    elif jpred_output_available:
        return ProviderStatus.failed("JPred output files found but parsing failed")
    else:
        return ProviderStatus.unavailable("JPred output not available for this sequence")


def determine_s4pred_status(
    row: pd.Series,
    s4pred_enabled: bool,
    s4pred_output_available: bool
) -> ProviderStatus:
    """
    Determine S4PRED provider status for a single peptide row.

    Args:
        row: DataFrame row with S4PRED columns
        s4pred_enabled: Whether S4PRED is enabled/configured
        s4pred_output_available: Whether S4PRED output is available for this peptide

    Returns:
        ProviderStatus indicating availability
    """
    if not s4pred_enabled:
        return ProviderStatus.not_configured("S4PRED not enabled")

    # Check if S4PRED columns have real values
    # Reference column names from s4pred.py
    helix_pred = row.get("Helix prediction (S4PRED)", None)
    helix_pct = row.get("Helix percentage (S4PRED)", None)
    ssw_pred = row.get("SSW prediction (S4PRED)", None)

    has_valid_data = False
    # Helix prediction can be -1 (no helix) or 1 (helix found) - both are valid
    if helix_pred is not None and helix_pred in [-1, 1]:
        has_valid_data = True
    elif helix_pct is not None and not pd.isna(helix_pct) and helix_pct >= 0:
        has_valid_data = True
    elif ssw_pred is not None and ssw_pred in [-1, 1]:
        has_valid_data = True

    if has_valid_data:
        return ProviderStatus.available()
    elif s4pred_output_available:
        return ProviderStatus.failed("S4PRED ran but parsing failed")
    else:
        return ProviderStatus.unavailable("S4PRED output not available for this sequence")


def create_provider_status_for_row(
    row: pd.Series,
    tango_enabled: bool = False,
    psipred_enabled: bool = False,
    jpred_enabled: bool = False,
    s4pred_enabled: bool = False,
    tango_output_available: bool = False,
    psipred_output_available: bool = False,
    jpred_output_available: bool = False,
    s4pred_output_available: bool = False,
) -> PeptideProviderStatus:
    """
    Create PeptideProviderStatus for a DataFrame row.

    This is a helper that determines status for all providers and returns
    a PeptideProviderStatus object.
    """
    return PeptideProviderStatus(
        tango=determine_tango_status(row, tango_enabled, tango_output_available),
        psipred=determine_psipred_status(row, psipred_enabled, psipred_output_available),
        jpred=determine_jpred_status(row, jpred_enabled, jpred_output_available),
        s4pred=determine_s4pred_status(row, s4pred_enabled, s4pred_output_available),
    )

