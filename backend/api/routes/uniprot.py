"""
UniProt query endpoints.
"""
from typing import Dict
from fastapi import APIRouter, HTTPException
from schemas.api_models import RowsResponse
from schemas.uniprot_query import UniProtQueryParseRequest, UniProtQueryParseResponse, UniProtQueryExecuteRequest

router = APIRouter()


@router.get("/api/uniprot/ping")
async def uniprot_ping():
    """
    Debug endpoint to test UniProt API connectivity.
    Executes a simple known-good query and returns status.
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import uniprot_ping as ping_uniprot
    return await ping_uniprot()


@router.post("/api/uniprot/parse", response_model=UniProtQueryParseResponse)
async def parse_uniprot_query_endpoint(request: UniProtQueryParseRequest):
    """
    Parse a UniProt query string and detect its mode.

    Returns the detected mode (accession/keyword/organism/keyword_organism),
    extracted components, and the final API query string that will be executed.
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import parse_uniprot_query_endpoint as parse_uniprot_query_service
    return await parse_uniprot_query_service(request)


@router.post("/api/uniprot/window")
async def window_sequences_endpoint(request: Dict):
    """
    Window protein sequences into peptides.

    Request body:
    {
        "sequences": [{"id": "P53_HUMAN", "sequence": "MEEPQSDPSV..."}],
        "windowSize": 20,
        "stepSize": 5
    }

    Response:
    {
        "peptides": [{"id": "...", "name": "...", "sequence": "...", "start": 1, "end": 20}]
    }
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import window_sequences_endpoint as window_sequences_service
    return window_sequences_service(request)


@router.post("/api/uniprot/execute", response_model=RowsResponse)
async def execute_uniprot_query(request: UniProtQueryExecuteRequest):
    """
    Execute a UniProt query and return results as DataFrame-ready data.

    Parses the query (if mode is 'auto'), builds the UniProt API URL,
    fetches results, and returns them in a format compatible with the upload endpoint.
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import execute_uniprot_query as execute_uniprot_query_service
    return await execute_uniprot_query_service(request)

