"""
Feedback submission endpoint.
"""
from fastapi import APIRouter, Request, Body, HTTPException
from schemas.feedback import FeedbackRequest
from services.feedback_service import check_rate_limit, process_feedback

router = APIRouter()


@router.post("/api/feedback")
async def submit_feedback(request: Request, feedback_data: FeedbackRequest = Body(...)):
    """
    Submit user feedback. Sends to Sentry as an INFO-level event that can trigger email alerts.
    Returns {ok: true} even if Sentry is not initialized.
    """
    client_ip = request.client.host if request.client else "unknown"

    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many feedback submissions. Please wait a few minutes.")

    # Lazy import to avoid circular import (SENTRY_INITIALIZED set during app init)
    from api.main import SENTRY_INITIALIZED

    try:
        return await process_feedback(client_ip, feedback_data, SENTRY_INITIALIZED)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
