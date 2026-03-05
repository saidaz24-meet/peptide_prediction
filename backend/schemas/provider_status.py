"""
Provider status tracking for TANGO and S4PRED.

Principle B: Every result must indicate provider availability.
No fake defaults - missing outputs become null + providerStatus explains why.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Provider status values - MUST match frontend types/peptide.ts ProviderStatus type
# Frontend expects: 'OFF' | 'UNAVAILABLE' | 'PARTIAL' | 'AVAILABLE'
# ISSUE-019: Fixed case mismatch - must be uppercase
ProviderStatusValue = Literal["AVAILABLE", "UNAVAILABLE", "PARTIAL", "OFF"]


class ProviderStatus(BaseModel):
    """Status for a single prediction provider"""
    status: ProviderStatusValue = Field(..., description="Provider availability status")
    reason: Optional[str] = Field(None, description="Explanation if status is not 'AVAILABLE'")

    @classmethod
    def available(cls) -> "ProviderStatus":
        """Provider is available and has results"""
        return cls(status="AVAILABLE")

    @classmethod
    def failed(cls, reason: str) -> "ProviderStatus":
        """Provider attempted to run but failed"""
        return cls(status="UNAVAILABLE", reason=reason)

    @classmethod
    def unavailable(cls, reason: str) -> "ProviderStatus":
        """Provider could not be used (e.g., missing input data)"""
        return cls(status="UNAVAILABLE", reason=reason)

    @classmethod
    def not_configured(cls, reason: str = "Provider not configured") -> "ProviderStatus":
        """Provider is disabled or not configured"""
        return cls(status="OFF", reason=reason)


class PeptideProviderStatus(BaseModel):
    """Provider statuses for all prediction tools for a single peptide"""
    tango: ProviderStatus = Field(default_factory=lambda: ProviderStatus.not_configured("TANGO not enabled"))
    s4pred: ProviderStatus = Field(default_factory=lambda: ProviderStatus.not_configured("S4PRED not enabled"))

    class Config:
        json_schema_extra = {
            "example": {
                "tango": {"status": "AVAILABLE", "reason": None},
                "s4pred": {"status": "AVAILABLE", "reason": None}
            }
        }
