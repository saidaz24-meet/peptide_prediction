"""
Feedback submission endpoint.
"""
from fastapi import APIRouter, Request, Body
from schemas.feedback import FeedbackRequest

router = APIRouter()


@router.post("/api/feedback")
async def submit_feedback(request: Request, feedback_data: FeedbackRequest = Body(...)):
    """
    Submit user feedback. Sends to Sentry as an INFO-level event that can trigger email alerts.
    Returns {ok: true} even if Sentry is not initialized.
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import submit_feedback as submit_feedback_service
    return await submit_feedback_service(request, feedback_data)

