"""
Provider status tracking for PSIPRED, TANGO, JPRED.

Principle B: Every result must indicate provider availability.
No fake defaults - missing outputs become null + providerStatus explains why.
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field

# Provider status values
ProviderStatusValue = Literal["available", "failed", "unavailable", "not_configured"]


class ProviderStatus(BaseModel):
    """Status for a single prediction provider"""
    status: ProviderStatusValue = Field(..., description="Provider availability status")
    reason: Optional[str] = Field(None, description="Explanation if status is not 'available'")
    
    @classmethod
    def available(cls) -> "ProviderStatus":
        """Provider is available and has results"""
        return cls(status="available")
    
    @classmethod
    def failed(cls, reason: str) -> "ProviderStatus":
        """Provider attempted to run but failed"""
        return cls(status="failed", reason=reason)
    
    @classmethod
    def unavailable(cls, reason: str) -> "ProviderStatus":
        """Provider could not be used (e.g., missing input data)"""
        return cls(status="unavailable", reason=reason)
    
    @classmethod
    def not_configured(cls, reason: str = "Provider not configured") -> "ProviderStatus":
        """Provider is disabled or not configured"""
        return cls(status="not_configured", reason=reason)


class PeptideProviderStatus(BaseModel):
    """Provider statuses for all prediction tools for a single peptide"""
    tango: ProviderStatus = Field(default_factory=lambda: ProviderStatus.not_configured("TANGO not enabled"))
    psipred: ProviderStatus = Field(default_factory=lambda: ProviderStatus.not_configured("PSIPRED not enabled"))
    jpred: ProviderStatus = Field(default_factory=lambda: ProviderStatus.not_configured("JPred disabled"))
    
    class Config:
        json_schema_extra = {
            "example": {
                "tango": {"status": "available", "reason": None},
                "psipred": {"status": "failed", "reason": "Docker image not found"},
                "jpred": {"status": "not_configured", "reason": "JPred disabled"}
            }
        }

