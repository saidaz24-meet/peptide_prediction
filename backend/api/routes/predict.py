"""
Single sequence prediction endpoint.
"""
from typing import Optional
from fastapi import APIRouter, Form
from schemas.api_models import PredictResponse

router = APIRouter()


@router.post("/api/predict", response_model=PredictResponse)
async def predict(
    sequence: str = Form(...),
    entry: Optional[str] = Form(None),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    """Predict properties for a single peptide sequence."""
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import predict as process_prediction
    return await process_prediction(sequence, entry, thresholdConfig)

