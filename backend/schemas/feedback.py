"""
Feedback request schema.
"""
from typing import Optional

from pydantic import BaseModel


class FeedbackRequest(BaseModel):
    """Request model for feedback submission."""
    message: str
    pageUrl: Optional[str] = None
    userAgent: Optional[str] = None
    screenshot: Optional[str] = None  # Base64 encoded image

