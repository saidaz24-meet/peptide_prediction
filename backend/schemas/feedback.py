"""
Feedback request schema.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict


class FeedbackRequest(BaseModel):
    """Request model for feedback submission."""

    # Wave B (B.1): reject unknown fields so typos surface as 422 instead of being
    # silently dropped (cf. UNIPROT_TIMEOUT_INVESTIGATION.md root cause #4).
    model_config = ConfigDict(extra="forbid")

    message: str
    pageUrl: Optional[str] = None
    userAgent: Optional[str] = None
    screenshot: Optional[str] = None  # Base64 encoded image
