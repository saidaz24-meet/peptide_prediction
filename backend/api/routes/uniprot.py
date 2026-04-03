"""
UniProt query endpoints.
"""

import asyncio
import threading
from typing import Dict

from typing import Optional

from fastapi import APIRouter, Query, Request

from schemas.api_models import RowsResponse
from schemas.uniprot_query import (
    UniProtQueryExecuteRequest,
    UniProtQueryParseRequest,
    UniProtQueryParseResponse,
)
from services.logger import log_info
from services.uniprot_service import (
    parse_query as parse_uniprot_query_service,
)
from services.uniprot_service import (
    ping_uniprot,
)
from services.uniprot_service import (
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
async def execute_uniprot_query(
    request: UniProtQueryExecuteRequest,
    cancelToken: Optional[str] = Query(None, description="Token for cancelling this request"),
):
    """Execute a UniProt query and return results with full analysis pipeline.

    Supports cancellation via cancel token: frontend generates a UUID,
    passes it as ?cancelToken=xxx, and calls POST /api/jobs/cancel-sync/{token} to cancel.
    """
    from api.main import SENTRY_INITIALIZED
    from api.routes.jobs import _sync_cancel_events
    from services.uniprot_execute_service import execute_uniprot_query as execute

    cancel_event = threading.Event()

    if cancelToken:
        _sync_cancel_events[cancelToken] = cancel_event

    try:
        result = await execute(request, SENTRY_INITIALIZED, cancel_event=cancel_event)
        if cancel_event.is_set():
            raise asyncio.CancelledError()
        return result
    except asyncio.CancelledError:
        cancel_event.set()
        log_info("uniprot_client_disconnect", "Analysis cancelled")
        raise
    finally:
        if cancelToken:
            _sync_cancel_events.pop(cancelToken, None)
