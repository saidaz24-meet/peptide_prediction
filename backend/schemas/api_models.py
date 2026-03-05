"""
Strict Pydantic models for API responses.

These models enforce the canonical response shape (camelCase) for all endpoints.
Unknown fields must go into `extras: dict` field.

All models use strict validation - extra fields are collected into extras dict.
"""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .provider_status import PeptideProviderStatus


class PeptideRow(BaseModel):
    """
    Canonical PeptideRow schema - strict camelCase output format.

    This is the exact shape returned by all endpoints that return peptide data.
    All fields are camelCase (id, sequence, charge, etc.) - NOT capitalized (Entry, Sequence).

    Source: backend/schemas/peptide.py:PeptideSchema.to_camel_dict()
    Normalization: backend/services/normalize.py:normalize_rows_for_ui()
    """
    model_config = ConfigDict(
        # Allow extra fields (they will be collected into extras dict by validator)
        extra="allow",
        # Use enum values in JSON
        use_enum_values=True,
    )

    # Identity & metadata
    id: str = Field(..., description="Entry/accession ID (from 'entry' field, alias: 'Entry')")
    name: Optional[str] = Field(None, description="Protein name (from 'name' field, alias: 'Protein name')")
    species: Optional[str] = Field(None, description="Organism/species (from 'species' field, alias: 'Organism')")

    # Sequence
    sequence: str = Field(..., description="Peptide sequence (from 'sequence' field, alias: 'Sequence')")
    length: Optional[int] = Field(None, description="Sequence length (from 'length' field, alias: 'Length')")

    # Basic biophysics
    # Produced by: backend/calculations/biochem.py:calculate_biochemical_features()
    hydrophobicity: Optional[float] = Field(None, description="Hydrophobicity score (from 'hydrophobicity' field, alias: 'Hydrophobicity')")
    charge: Optional[float] = Field(None, description="Net charge (from 'charge' field, alias: 'Charge')")
    muH: Optional[float] = Field(None, description="Full length μH (from 'mu_h' field, alias: 'Full length uH')")

    # SSW / TANGO predictions
    # Produced by: backend/tango.py:process_tango_output() and filter_by_avg_diff()
    sswPrediction: Optional[int] = Field(None, description="SSW prediction (-1/0/1) (from 'ssw_prediction' field, alias: 'SSW prediction')")
    sswScore: Optional[float] = Field(None, description="SSW score (from 'ssw_score' field, alias: 'SSW score')")
    sswDiff: Optional[float] = Field(None, description="SSW diff (from 'ssw_diff' field, alias: 'SSW diff')")
    sswHelixPercentage: Optional[float] = Field(None, description="SSW helix percentage (from 'ssw_helix_percentage' field, alias: 'SSW helix percentage')")
    sswBetaPercentage: Optional[float] = Field(None, description="SSW beta percentage (from 'ssw_beta_percentage' field, alias: 'SSW beta percentage')")

    # Canonical TANGO summary fields (derived from parsed curves)
    # These provide a single source of truth for UI display, avoiding need to check extras
    # Produced by: backend/tango.py:process_tango_output() when curves are parsed
    tangoAggMax: Optional[float] = Field(None, description="Max value of Tango Aggregation curve (aggregation risk indicator)")
    tangoBetaMax: Optional[float] = Field(None, description="Max value of Tango Beta curve")
    tangoHelixMax: Optional[float] = Field(None, description="Max value of Tango Helix curve")
    tangoHasData: Optional[bool] = Field(None, description="True if any Tango curves are available (non-empty)")
    # TANGO per-residue curves (for aggregation heatmap visualization)
    tangoAggCurve: Optional[List[float]] = Field(None, description="TANGO per-residue aggregation prediction curve")
    tangoBetaCurve: Optional[List[float]] = Field(None, description="TANGO per-residue beta prediction curve")
    tangoHelixCurve: Optional[List[float]] = Field(None, description="TANGO per-residue helix prediction curve")

    # FF-Helix (local propensity)
    # Produced by: backend/auxiliary.py:ff_helix_percent() and ff_helix_cores()
    ffHelixPercent: Optional[float] = Field(None, description="FF-Helix percentage (from 'ff_helix_percent' field, alias: 'FF-Helix %')")
    ffHelixFragments: Optional[List[Any]] = Field(None, description="FF Helix fragments (from 'ff_helix_fragments' field, alias: 'FF Helix fragments')")

    # FF flags and scores (database-level binary classification)
    # Produced by: backend/services/dataframe_utils.py:apply_ff_flags()
    # Reference: 260120_Alpha_and_SSW_FF_Predictor/main.py
    # Thresholds verified against Peleg's reference dataset (2026-02-26). Fallback: H=0.417, uH=0.388.
    ffHelixFlag: Optional[int] = Field(None, description="FF-Helix flag: 1 (candidate), -1 (not candidate), null (no data). S4PRED-based.")
    ffHelixScore: Optional[float] = Field(None, description="FF-Helix score: helix_uH + helix_score")
    ffSswFlag: Optional[int] = Field(None, description="FF-SSW flag: 1 (candidate), -1 (not candidate), null (no data)")
    ffSswScore: Optional[float] = Field(None, description="FF-SSW score: Hydrophobicity + Beta_uH + Full_length_uH + SSW_prediction")

    # S4PRED secondary structure predictions
    # Produced by: backend/s4pred.py:analyse_s4pred_result() - matches reference implementation
    # Reference column names in parentheses (from 260120_Alpha_and_SSW_FF_Predictor/s4pred.py)
    s4predHelixPrediction: Optional[int] = Field(None, description="S4PRED helix prediction (-1 no helix, 1 helix found) (alias: 'Helix prediction (S4PRED)')")
    s4predHelixFragments: Optional[List[Any]] = Field(None, description="S4PRED helix segment tuples [(start, end), ...] (alias: 'Helix fragments (S4PRED)')")
    s4predHelixScore: Optional[float] = Field(None, description="S4PRED average helix score (-1.0 if no helix) (alias: 'Helix score (S4PRED)')")
    s4predHelixPercent: Optional[float] = Field(None, description="S4PRED helix percentage 0-100 (alias: 'Helix percentage (S4PRED)')")

    # S4PRED SSW (Secondary Structure Switch) predictions
    s4predSswPrediction: Optional[int] = Field(None, description="S4PRED SSW prediction (-1/1) (alias: 'SSW prediction (S4PRED)')")
    s4predSswFragments: Optional[List[Any]] = Field(None, description="S4PRED SSW segment tuples (alias: 'SSW fragments (S4PRED)')")
    s4predSswScore: Optional[float] = Field(None, description="S4PRED SSW score (helix + beta avg) (alias: 'SSW score (S4PRED)')")
    s4predSswDiff: Optional[float] = Field(None, description="S4PRED SSW diff |helix - beta| (alias: 'SSW diff (S4PRED)')")
    s4predSswHelixPercent: Optional[float] = Field(None, description="S4PRED SSW helix percentage (alias: 'SSW helix percentage (S4PRED)')")
    s4predSswBetaPercent: Optional[float] = Field(None, description="S4PRED SSW beta percentage (alias: 'SSW beta percentage (S4PRED)')")
    s4predSswPercent: Optional[float] = Field(None, description="S4PRED SSW overlap percentage (alias: 'SSW percentage (S4PRED)')")

    # S4PRED has data flag (similar to tangoHasData)
    s4predHasData: Optional[bool] = Field(None, description="True if S4PRED ran and produced results")

    # S4PRED per-residue curves (for PeptideDetail view)
    s4predPHCurve: Optional[List[float]] = Field(None, description="S4PRED per-residue helix probability curve")
    s4predPECurve: Optional[List[float]] = Field(None, description="S4PRED per-residue beta probability curve")
    s4predPCCurve: Optional[List[float]] = Field(None, description="S4PRED per-residue coil probability curve")
    s4predSsPrediction: Optional[List[str]] = Field(None, description="S4PRED per-residue SS prediction ('C', 'H', 'E')")

    # Provider status (Principle B: mandatory provider status)
    # Produced by: backend/services/provider_tracking.py:create_provider_status_for_row()
    # Added during normalization: backend/services/normalize.py:normalize_rows_for_ui()
    providerStatus: Optional[PeptideProviderStatus] = Field(None, description="Provider status for TANGO/S4PRED")

    # Unknown/extra fields
    # Any fields not in the canonical schema go here
    extras: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional fields not in canonical schema"
    )

    @model_validator(mode='before')
    @classmethod
    def collect_extras(cls, data: Any) -> Any:
        """
        Collect unknown fields into extras dict.

        This allows the model to accept extra fields (for backward compatibility)
        while still enforcing the canonical schema.
        """
        if not isinstance(data, dict):
            return data

        # Known fields in the canonical schema
        known_fields = {
            'id', 'name', 'species', 'sequence', 'length',
            'hydrophobicity', 'charge', 'muH',
            'sswPrediction', 'sswScore', 'sswDiff', 'sswHelixPercentage', 'sswBetaPercentage',
            'tangoAggMax', 'tangoBetaMax', 'tangoHelixMax', 'tangoHasData',
            'tangoAggCurve', 'tangoBetaCurve', 'tangoHelixCurve',
            'ffHelixPercent', 'ffHelixFragments',
            'ffHelixFlag', 'ffHelixScore', 'ffSswFlag', 'ffSswScore',
            # S4PRED fields
            's4predHelixPrediction', 's4predHelixFragments', 's4predHelixScore', 's4predHelixPercent',
            's4predSswPrediction', 's4predSswFragments', 's4predSswScore', 's4predSswDiff',
            's4predSswHelixPercent', 's4predSswBetaPercent', 's4predSswPercent', 's4predHasData',
            's4predPHCurve', 's4predPECurve', 's4predPCCurve', 's4predSsPrediction',
            'providerStatus', 'extras'
        }

        # Separate known and unknown fields
        known_data = {}
        extras = {}

        for key, value in data.items():
            if key in known_fields:
                known_data[key] = value
            else:
                extras[key] = value

        # Put extras into the extras field
        if extras:
            known_data['extras'] = {**(known_data.get('extras', {})), **extras}

        return known_data


class ProviderStatusSummary(BaseModel):
    """
    Provider status summary in meta responses.

    Source: backend/server.py:upload_csv() and execute_uniprot_query()
    Produced at: backend/server.py:1133-1146 (upload-csv) and similar for uniprot
    """
    model_config = ConfigDict(extra="forbid")

    tango: Optional[Dict[str, Any]] = Field(None, description="TANGO provider status summary with keys: status, requested, parsed_ok, parsed_bad")
    s4pred: Optional[Dict[str, Any]] = Field(None, description="S4PRED provider status summary with keys: status, requested, parsed_ok, parsed_bad")


class Meta(BaseModel):
    """
    Metadata included in all responses that return peptide rows.

    Source: backend/server.py:upload_csv() (lines 1153-1168), execute_uniprot_query() (lines 2020-2037)
    """
    # Use extra="ignore" to silently ignore unknown fields rather than failing
    # This allows backward compatibility while still validating known fields
    model_config = ConfigDict(extra="ignore")

    # Provider flags
    use_tango: bool = Field(..., description="TANGO enabled flag (from USE_TANGO env var)")
    use_s4pred: bool = Field(default=True, description="S4PRED enabled flag (from USE_S4PRED env var)")
    ssw_rows: int = Field(..., description="Number of rows with SSW/TANGO data")
    valid_seq_rows: int = Field(..., description="Number of rows with valid sequences")

    # Provider status metadata
    # Produced by: backend/server.py:upload_csv() (provider_status_meta dict)
    provider_status: Dict[str, Any] = Field(..., description="Detailed provider status per provider")

    # Reproducibility primitives
    # Produced by: backend/server.py:upload_csv() (lines 1095-1130)
    runId: str = Field(..., description="Run ID (UUID4) for reproducibility")
    traceId: str = Field(..., description="Trace ID for request tracing")
    inputsHash: str = Field(..., description="SHA256 hash of inputs (first 16 chars)")
    configHash: str = Field(..., description="SHA256 hash of configuration (first 16 chars)")

    # Provider status summary
    # Produced by: backend/server.py:upload_csv() (lines 1133-1146)
    providerStatusSummary: ProviderStatusSummary = Field(..., description="Provider status summary counts")

    # Threshold configuration
    # Produced by: backend/services/thresholds.py:resolve_thresholds()
    thresholdConfigRequested: Optional[Dict[str, Any]] = Field(None, description="Requested threshold configuration")
    thresholdConfigResolved: Dict[str, Any] = Field(..., description="Resolved threshold configuration")
    thresholds: Dict[str, Any] = Field(..., description="Resolved thresholds for FF flags")

    # UniProt-specific fields (only present in /api/uniprot/execute responses)
    source: Optional[Literal["uniprot_api"]] = Field(None, description="Data source (only for UniProt queries)")
    query: Optional[str] = Field(None, description="Original query string (only for UniProt queries)")
    api_query_string: Optional[str] = Field(None, description="UniProt API query string (only for UniProt queries)")
    mode: Optional[str] = Field(None, description="Query mode (only for UniProt queries)")
    url: Optional[str] = Field(None, description="UniProt API URL (only for UniProt queries)")
    row_count: Optional[int] = Field(None, description="Total rows from UniProt (only for UniProt queries)")
    size_requested: Optional[int] = Field(None, description="Requested result size (only for UniProt queries)")
    size_returned: Optional[int] = Field(None, description="Actual result size (only for UniProt queries)")
    run_tango: Optional[bool] = Field(None, description="Whether TANGO was requested (only for UniProt queries)")


class RowsResponse(BaseModel):
    """
    Response format for endpoints that return multiple peptide rows.

    Used by:
    - POST /api/upload-csv (backend/server.py:1151-1169)
    - POST /api/uniprot/execute (backend/server.py:2018-2038)
    - GET /api/example (backend/server.py:331)
    """
    model_config = ConfigDict(extra="forbid")

    rows: List[PeptideRow] = Field(..., description="List of peptide rows in canonical camelCase format")
    meta: Meta = Field(..., description="Metadata about the request and processing")


class PredictResponse(BaseModel):
    """
    Response format for POST /api/predict endpoint.

    Returns a single peptide row with metadata.
    Source: backend/server.py:1262-1276

    Note: For consistency with RowsResponse, we use {row, meta} structure
    instead of flat dict with meta field.
    """
    model_config = ConfigDict(extra="forbid")

    row: PeptideRow = Field(..., description="Single peptide row in canonical camelCase format")
    meta: Meta = Field(..., description="Metadata about the prediction")


# Health check and diagnostic endpoints use simple dict responses
# These are intentionally not modeled here to keep them flexible

