"""
Example dataset endpoint.
"""
from fastapi import APIRouter
from schemas.api_models import RowsResponse
from services.example_service import load_example_data

router = APIRouter()


@router.get("/api/example", response_model=RowsResponse)
def load_example(recalc: int = 0):
    """
    Serve the presentation dataset with JPred/Tango already computed.
    By default (recalc=0) we DO NOT recompute biochem/JPred/Tango.
    Set recalc=1 if you explicitly want to recompute locally.
    """
    return load_example_data(recalc=recalc)

