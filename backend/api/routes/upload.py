"""
File upload endpoint.
"""
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, Form, HTTPException
from schemas.api_models import RowsResponse

router = APIRouter()


@router.post("/api/upload-csv", response_model=RowsResponse)
async def upload_csv(
    file: UploadFile = File(...),
    debug_entry: Optional[str] = Query(None, description="Entry ID to trace through pipeline"),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON")
):
    """
    Accept a UniProt export as CSV/TSV/XLSX.
    debug_entry: Optional entry ID to enable detailed tracing for that specific peptide.
    Only 'Entry/Accession' and 'Sequence' are required; 'Length' is computed if missing.
    Computed fields (Hydrophobicity, Charge, μH, FF flags) are added server-side.
    """
    # Local import to avoid circular import (server.py imports from api/main.py)
    from server import upload_csv as process_upload
    return await process_upload(file, debug_entry, thresholdConfig)

