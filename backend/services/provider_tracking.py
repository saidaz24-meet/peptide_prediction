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
    
    # Real TANGO output would have:
    # - ssw_prediction: -1, 0, or 1 (valid if not default -1 from initialization)
    # - ssw_score: float (valid if not -1.0)
    # - ssw_fragments: string (valid if not "-" or empty)
    
    has_valid_data = False
    if ssw_pred is not None and ssw_pred != -1:  # -1 is the "not available" default
        has_valid_data = True
    elif ssw_score is not None and ssw_score != -1.0:
        has_valid_data = True
    elif ssw_fragments is not None and ssw_fragments != "-" and ssw_fragments != "":
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


def create_provider_status_for_row(
    row: pd.Series,
    tango_enabled: bool = False,
    psipred_enabled: bool = False,
    jpred_enabled: bool = False,
    tango_output_available: bool = False,
    psipred_output_available: bool = False,
    jpred_output_available: bool = False,
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
    )

