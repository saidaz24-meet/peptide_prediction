"""
Canonical Pydantic Models for Peptide Analysis

These models define the single source of truth for all data structures.
All API responses MUST conform to these schemas.

Naming Conventions:
- Python: snake_case for field names
- JSON/API: camelCase (via model config)
- No abbreviations (except established: pH, uH)
- null for missing values (NOT -1, NOT "N/A", NOT empty string)

Created: 2026-02-01
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class PredictionClass(int, Enum):
    """
    Classification result from aggregation prediction.

    Values:
        NEGATIVE (-1): Predicted NOT to undergo structural switch
        UNCERTAIN (0): Uncertain / borderline
        POSITIVE (1): Predicted to undergo structural switch
    """
    NEGATIVE = -1
    UNCERTAIN = 0
    POSITIVE = 1


class ProviderStatusValue(str, Enum):
    """
    Status of an external prediction provider.

    Values:
        OFF: Provider is disabled in configuration
        UNAVAILABLE: Provider enabled but not reachable/working
        PARTIAL: Provider ran but some results failed
        AVAILABLE: Provider ran successfully
    """
    OFF = "OFF"
    UNAVAILABLE = "UNAVAILABLE"
    PARTIAL = "PARTIAL"
    AVAILABLE = "AVAILABLE"


# =============================================================================
# Provider Status Models
# =============================================================================

class ProviderStats(BaseModel):
    """Statistics for a provider run."""
    model_config = ConfigDict(populate_by_name=True)

    requested: int = Field(..., description="Number of sequences submitted")
    parsed_ok: int = Field(..., description="Number successfully parsed")
    parsed_bad: int = Field(0, description="Number that failed parsing")


class SingleProviderStatus(BaseModel):
    """Status of a single prediction provider."""
    model_config = ConfigDict(populate_by_name=True)

    status: ProviderStatusValue = Field(..., description="Current status")
    reason: Optional[str] = Field(None, description="Reason if unavailable")
    stats: Optional[ProviderStats] = Field(None, description="Run statistics if available")


class ProviderStatus(BaseModel):
    """
    Combined status for all prediction providers.

    Every peptide row MUST include this to indicate data provenance.
    """
    model_config = ConfigDict(populate_by_name=True)

    tango: SingleProviderStatus = Field(..., description="TANGO aggregation predictor status")
    # Note: PSIPRED and JPred are disabled in current deployment
    # Keeping fields for future extensibility
    psipred: Optional[SingleProviderStatus] = Field(None, description="PSIPRED secondary structure (disabled)")
    jpred: Optional[SingleProviderStatus] = Field(None, description="JPred secondary structure (disabled)")


# =============================================================================
# Result Models
# =============================================================================

class AggregationResult(BaseModel):
    """
    Results from aggregation prediction (TANGO).

    Contains the classification, scores, and per-residue curves
    from the TANGO aggregation predictor.

    All fields are Optional because:
    - Provider may be disabled
    - Provider may have failed for this sequence
    - Per-residue curves may not be requested
    """
    model_config = ConfigDict(
        populate_by_name=True,
        # Convert snake_case to camelCase in JSON
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    # Classification
    prediction: Optional[PredictionClass] = Field(
        None,
        description="Classification: -1 (no switch), 0 (uncertain), 1 (switch)"
    )

    # Scores
    score: Optional[float] = Field(
        None,
        ge=0,
        description="Aggregation score (higher = more aggregation-prone)"
    )
    diff: Optional[float] = Field(
        None,
        description="Score differential used for classification"
    )

    # Percentages (0-100)
    helix_percentage: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="Percentage of sequence predicted as helix (0-100)"
    )
    beta_percentage: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="Percentage of sequence predicted as beta (0-100)"
    )

    # Per-residue curves (optional, for visualization)
    aggregation_curve: Optional[List[float]] = Field(
        None,
        description="Per-residue aggregation propensity (length = sequence length)"
    )
    helix_curve: Optional[List[float]] = Field(
        None,
        description="Per-residue helix propensity"
    )
    beta_curve: Optional[List[float]] = Field(
        None,
        description="Per-residue beta propensity"
    )
    turn_curve: Optional[List[float]] = Field(
        None,
        description="Per-residue turn propensity"
    )


class SecondaryStructureResult(BaseModel):
    """
    Secondary structure prediction results.

    Contains FF-Helix (local calculation) and optional PSIPRED results.
    FF-Helix is always computed (no external dependency).
    PSIPRED requires Docker and is optional.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    # FF-Helix (always computed locally)
    ff_helix_percent: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="FF-Helix percentage (0-100), locally computed from propensity scale"
    )
    ff_helix_segments: Optional[List[List[int]]] = Field(
        None,
        description="Helix segments as [[start, end], ...], 1-indexed"
    )

    # Derived boolean flag
    is_structure_switch: Optional[bool] = Field(
        None,
        description="Whether peptide is predicted to undergo structure switch"
    )

    # PSIPRED results (optional - requires Docker)
    psipred_helix_percent: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="PSIPRED helix percentage (if available)"
    )
    psipred_beta_percent: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="PSIPRED beta percentage (if available)"
    )
    psipred_coil_percent: Optional[float] = Field(
        None,
        ge=0,
        le=100,
        description="PSIPRED coil percentage (if available)"
    )
    psipred_helix_segments: Optional[List[List[int]]] = Field(
        None,
        description="PSIPRED helix segments (if available)"
    )


class BiophysicalProperties(BaseModel):
    """
    Basic biophysical properties of a peptide.

    These are always computed (no external dependencies).
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    charge: Optional[float] = Field(
        None,
        description="Net charge at pH 7.4"
    )
    hydrophobicity: Optional[float] = Field(
        None,
        description="Mean hydrophobicity (Fauchere-Pliska scale)"
    )
    hydrophobic_moment: Optional[float] = Field(
        None,
        description="Hydrophobic moment (μH) for alpha-helix geometry"
    )


class ToxicityResult(BaseModel):
    """
    Toxicity prediction results.

    Note: Toxicity prediction is not currently implemented.
    This model is a placeholder for future functionality.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    is_toxic: Optional[bool] = Field(
        None,
        description="Whether peptide is predicted to be toxic"
    )
    toxicity_score: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Toxicity probability (0-1)"
    )
    toxicity_type: Optional[str] = Field(
        None,
        description="Type of predicted toxicity (if any)"
    )


# =============================================================================
# Peptide Models
# =============================================================================

class PeptideIdentity(BaseModel):
    """
    Identity and metadata for a peptide.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique identifier (UniProt accession or user-provided)")
    sequence: str = Field(..., min_length=1, description="Amino acid sequence (1-letter code)")
    length: int = Field(..., ge=1, description="Sequence length")
    name: Optional[str] = Field(None, description="Protein name")
    species: Optional[str] = Field(None, description="Organism/species")


class PeptideAnalysis(BaseModel):
    """
    Complete analysis results for a single peptide.

    This is the canonical model for peptide analysis output.
    Combines identity, biophysics, and all prediction results.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    # Identity (required)
    id: str = Field(..., description="Unique identifier")
    sequence: str = Field(..., description="Amino acid sequence")
    length: int = Field(..., description="Sequence length")
    name: Optional[str] = Field(None, description="Protein name")
    species: Optional[str] = Field(None, description="Organism/species")

    # Biophysical properties (always computed)
    charge: Optional[float] = Field(None, description="Net charge")
    hydrophobicity: Optional[float] = Field(None, description="Mean hydrophobicity")
    hydrophobic_moment: Optional[float] = Field(
        None,
        alias="muH",  # Keep muH for backward compatibility
        description="Hydrophobic moment (μH)"
    )

    # Aggregation prediction (TANGO)
    aggregation: Optional[AggregationResult] = Field(
        None,
        description="TANGO aggregation prediction results"
    )

    # Secondary structure
    secondary_structure: Optional[SecondaryStructureResult] = Field(
        None,
        description="Secondary structure prediction results"
    )

    # Toxicity (future)
    toxicity: Optional[ToxicityResult] = Field(
        None,
        description="Toxicity prediction results (not yet implemented)"
    )

    # Provider status (required for data provenance)
    provider_status: ProviderStatus = Field(
        ...,
        description="Status of prediction providers for this peptide"
    )


# =============================================================================
# Request/Response Models
# =============================================================================

class AnalysisRequest(BaseModel):
    """
    Request for peptide analysis.

    Can be used for single sequence or batch analysis.
    """
    model_config = ConfigDict(populate_by_name=True)

    sequence: str = Field(
        ...,
        min_length=1,
        description="Amino acid sequence (1-letter code)"
    )
    entry: Optional[str] = Field(
        None,
        description="Entry/ID (defaults to 'adhoc')"
    )
    run_tango: bool = Field(
        True,
        description="Whether to run TANGO aggregation prediction"
    )
    include_curves: bool = Field(
        False,
        description="Whether to include per-residue curves in response"
    )


class AnalysisResponse(BaseModel):
    """
    Response from peptide analysis.

    Contains the analysis results and metadata about the run.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    # Analysis result
    result: PeptideAnalysis = Field(..., description="Analysis results")

    # Run metadata
    run_id: str = Field(..., description="Unique run identifier (UUID)")
    trace_id: str = Field(..., description="Trace ID for request correlation")

    # Provider summary
    provider_summary: Optional[ProviderStatus] = Field(
        None,
        description="Summary of provider status for the run"
    )


class BatchAnalysisResponse(BaseModel):
    """
    Response from batch peptide analysis (upload-csv, uniprot query).
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=lambda s: ''.join(
            word.capitalize() if i else word
            for i, word in enumerate(s.split('_'))
        )
    )

    # Analysis results
    results: List[PeptideAnalysis] = Field(..., description="List of analysis results")

    # Run metadata
    run_id: str = Field(..., description="Unique run identifier")
    trace_id: str = Field(..., description="Trace ID for request correlation")
    inputs_hash: str = Field(..., description="Hash of input data for reproducibility")
    config_hash: str = Field(..., description="Hash of configuration for reproducibility")

    # Counts
    total_rows: int = Field(..., description="Total number of peptides processed")
    successful_rows: int = Field(..., description="Number of successfully analyzed peptides")

    # Provider summary
    provider_summary: ProviderStatus = Field(
        ...,
        description="Summary of provider status for the batch"
    )


# =============================================================================
# Backward Compatibility Aliases (for migration period)
# =============================================================================

# These types maintain backward compatibility during migration
# TODO: Remove after 2026-04-01

# Old name -> New model mapping for documentation
_DEPRECATED_ALIASES = {
    "sswPrediction": "aggregation.prediction",
    "sswScore": "aggregation.score",
    "sswDiff": "aggregation.diff",
    "sswHelixPercentage": "aggregation.helix_percentage",
    "sswBetaPercentage": "aggregation.beta_percentage",
    "ffHelixPercent": "secondary_structure.ff_helix_percent",
    "ffHelixFragments": "secondary_structure.ff_helix_segments",
}
