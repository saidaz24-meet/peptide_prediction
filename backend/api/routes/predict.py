"""
Single sequence prediction endpoint.
"""
from typing import Optional
from fastapi import APIRouter, Form, HTTPException
from schemas.api_models import PredictResponse
from services.thresholds import parse_threshold_config
from services.normalize import create_single_sequence_df
from services.predict_service import process_single_sequence

router = APIRouter()


@router.post("/api/predict", response_model=PredictResponse)
async def predict(
    sequence: str = Form(...),
    entry: Optional[str] = Form(None),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    """Predict properties for a single peptide sequence."""
    # Parse threshold config (shared helper)
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    # Use shared function to create and validate single-sequence DataFrame
    df = create_single_sequence_df(sequence, entry)
    seq = df.iloc[0]["Sequence"]

    # Validate sequence is not empty
    if not seq or len(seq) == 0:
        raise HTTPException(status_code=400, detail="Sequence is empty after validation")

    # Process the single sequence through the prediction pipeline
    return process_single_sequence(
        df=df,
        threshold_config_requested=threshold_config_requested,
        threshold_config_resolved=threshold_config_resolved
    )
