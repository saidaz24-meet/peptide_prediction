from typing import Optional, List, Any
from pydantic import BaseModel, Field


def _snake_to_camel(s: str) -> str:
    parts = s.split('_')
    return parts[0] + ''.join(p.title() for p in parts[1:])


class PeptideSchema(BaseModel):
    # identity & metadata (snake_case) — aliases are the exact CSV header strings
    entry: str = Field(..., alias="Entry")
    name: Optional[str] = Field(None, alias="Protein name")
    species: Optional[str] = Field(None, alias="Organism")

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

    # FF-Helix
    ff_helix_percent: Optional[float] = Field(None, alias="FF-Helix %")
    ff_helix_fragments: Optional[List[Any]] = Field(None, alias="FF Helix fragments")

    class Config:
        allow_population_by_field_name = True
        extra = "allow"

    def to_camel_dict(self) -> dict:
        """
        Convert validated model to camelCase keys used by the frontend types.
        Keeps base names identical (e.g. ff_helix_percent -> ffHelixPercent).
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

            # generic snake_case -> camelCase
            out[_snake_to_camel(k)] = v
        return out