from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator
import pandas as pd
import math
from .provider_status import PeptideProviderStatus


def _snake_to_camel(s: str) -> str:
    parts = s.split('_')
    return parts[0] + ''.join(p.title() for p in parts[1:])


class PeptideSchema(BaseModel):
    # identity & metadata (snake_case) — aliases are the exact CSV header strings
    entry: str = Field(..., alias="Entry")
    name: Optional[str] = Field(None, alias="Protein name")
    species: Optional[str] = Field(None, alias="Organism")
    
    @classmethod
    def parse_obj(cls, obj):
        """Override parse_obj to handle NaN values in optional fields (strings, floats, ints)"""
        # Convert NaN/None to None for optional fields
        if isinstance(obj, dict):
            obj = obj.copy()
            import math
            # Handle aliases (CSV column names) and field names
            field_mappings = {
                "name": ["Protein name", "name"],
                "species": ["Organism", "species"]
            }
            for field_name, aliases in field_mappings.items():
                for key in aliases:
                    if key in obj:
                        val = obj[key]
                        # Handle pandas NaN, numpy NaN, Python None, or string "nan"
                        if val is None:
                            obj[key] = None
                        elif isinstance(val, float):
                            if pd.isna(val) or str(val).lower() == "nan" or math.isnan(val) or not math.isfinite(val):
                                obj[key] = None
                        elif isinstance(val, str) and val.lower() == "nan":
                            obj[key] = None
            
            # Sanitize SSW-related fields: convert NaN/inf to None
            ssw_fields = ["SSW prediction", "SSW score", "SSW diff", "SSW helix percentage", "SSW beta percentage"]
            for field in ssw_fields:
                if field in obj:
                    val = obj[field]
                    if val is None:
                        obj[field] = None
                    elif isinstance(val, float):
                        if pd.isna(val) or math.isnan(val) or not math.isfinite(val):
                            obj[field] = None
                    elif isinstance(val, (int, float)) and math.isnan(float(val)):
                        obj[field] = None
        return super().parse_obj(obj)

    # sequence
    sequence: str = Field(..., alias="Sequence")
    length: Optional[int] = Field(None, alias="Length")

    # basic biophysics
    hydrophobicity: Optional[float] = Field(None, alias="Hydrophobicity")
    charge: Optional[float] = Field(None, alias="Charge")
    mu_h: Optional[float] = Field(None, alias="Full length uH")

    # SSW / Chameleon (exact CSV headers)
    ssw_prediction: Optional[int] = Field(None, alias="SSW prediction")
    ssw_score: Optional[float] = Field(None, alias="SSW score")
    ssw_diff: Optional[float] = Field(None, alias="SSW diff")
    ssw_helix_percentage: Optional[float] = Field(None, alias="SSW helix percentage")
    ssw_beta_percentage: Optional[float] = Field(None, alias="SSW beta percentage")

    @field_validator('ssw_score', 'ssw_diff', 'ssw_helix_percentage', 'ssw_beta_percentage', 'ff_helix_percent', 'hydrophobicity', 'charge', 'mu_h', mode='before')
    @classmethod
    def coerce_nan_to_none(cls, v: Any) -> Optional[float]:
        """Coerce NaN/inf to None for Optional[float] fields."""
        if v is None:
            return None
        if isinstance(v, float):
            if math.isnan(v) or not math.isfinite(v):
                return None
        if isinstance(v, (int, float)):
            try:
                fv = float(v)
                if math.isnan(fv) or not math.isfinite(fv):
                    return None
                return fv
            except (ValueError, TypeError):
                return None
        return v

    @field_validator('ssw_prediction', 'length', mode='before')
    @classmethod
    def coerce_nan_to_none_int(cls, v: Any) -> Optional[int]:
        """Coerce NaN/inf to None for Optional[int] fields."""
        if v is None:
            return None
        if isinstance(v, float):
            if math.isnan(v) or not math.isfinite(v):
                return None
        if isinstance(v, (int, float)):
            try:
                iv = int(v)
                if isinstance(v, float) and (math.isnan(v) or not math.isfinite(v)):
                    return None
                return iv
            except (ValueError, TypeError):
                return None
        return v

    # FF-Helix
    ff_helix_percent: Optional[float] = Field(None, alias="FF-Helix %")
    ff_helix_fragments: Optional[List[Any]] = Field(None, alias="FF Helix fragments")
    
    # Provider status (Principle B: mandatory provider status)
    # Note: provider_status is NOT in CSV/DataFrame - it's added during normalization
    provider_status: Optional[PeptideProviderStatus] = Field(None)

    class Config:
        allow_population_by_field_name = True
        extra = "allow"

    def to_camel_dict(self) -> dict:
        """
        Convert validated model to camelCase keys used by the frontend types.
        Keeps base names identical (e.g. ff_helix_percent -> ffHelixPercent).
        
        Canonical fields:
        - sswPrediction: -1/0/1 classification (from ssw_prediction)
        - sswHelixPercentage: numeric helix percentage (from ssw_helix_percentage)
        - sswBetaPercentage: numeric beta percentage (from ssw_beta_percentage)
        """
        d = self.dict(by_alias=False, exclude_none=True)
        out = {}
        for k, v in d.items():
            # explicit exceptions that should map to different frontend key names
            if k == "entry":
                out["id"] = v
                continue
            if k == "mu_h":
                out["muH"] = v
                continue
            if k == "ssw_prediction":
                # Canonical field: sswPrediction (-1/0/1 classification)
                out["sswPrediction"] = v
                # Backward compatibility: also include chameleonPrediction (deprecated)
                out["chameleonPrediction"] = v
                continue
            
            if k == "provider_status":
                # Convert PeptideProviderStatus to dict (camelCase keys)
                if v is not None:
                    if hasattr(v, "dict"):
                        provider_dict = v.dict()
                        # Convert nested keys to camelCase if needed
                        out["providerStatus"] = provider_dict
                    else:
                        out["providerStatus"] = v
                continue

            # generic snake_case -> camelCase
            out[_snake_to_camel(k)] = v
        return out