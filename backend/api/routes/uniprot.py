"""
UniProt query endpoints.
"""
from typing import Dict
from fastapi import APIRouter
from schemas.api_models import RowsResponse
from schemas.uniprot_query import UniProtQueryParseRequest, UniProtQueryParseResponse, UniProtQueryExecuteRequest
from services.uniprot_service import (
    ping_uniprot,
    parse_query as parse_uniprot_query_service,
    window_protein_sequences as window_sequences_service,
)

router = APIRouter()


@router.get("/api/uniprot/ping")
async def uniprot_ping():
    """Debug endpoint to test UniProt API connectivity."""
    return await ping_uniprot()


@router.post("/api/uniprot/parse", response_model=UniProtQueryParseResponse)
async def parse_uniprot_query_endpoint(request: UniProtQueryParseRequest):
    """Parse a UniProt query string and detect its mode."""
    return parse_uniprot_query_service(request)


@router.post("/api/uniprot/window")
async def window_sequences_endpoint(request: Dict):
    """Window protein sequences into peptides."""
    sequences = request.get("sequences", [])
    window_size = int(request.get("windowSize", 20))
    step_size = int(request.get("stepSize", 5))
    return window_sequences_service(sequences, window_size, step_size)


@router.post("/api/uniprot/execute", response_model=RowsResponse)
async def execute_uniprot_query(request: UniProtQueryExecuteRequest):
    """Execute a UniProt query and return results with full analysis pipeline."""
    # Lazy import to avoid circular import (SENTRY_INITIALIZED set during app init)
    from api.main import SENTRY_INITIALIZED
    from services.uniprot_execute_service import execute_uniprot_query as execute
    return await execute(request, SENTRY_INITIALIZED)
