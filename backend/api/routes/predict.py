"""Single + batch prediction endpoints."""

import asyncio
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, Query, Request

from schemas.api_models import PredictResponse, RowsResponse
from services.dataframe_utils import parse_fasta, read_any_table, require_cols
from services.logger import log_info
from services.normalize import create_single_sequence_df, normalize_cols
from services.predict_service import process_single_sequence
from services.thresholds import parse_threshold_config
from services.upload_service import UploadProcessingError, process_upload_dataframe

router = APIRouter()


@router.post("/api/predict", response_model=PredictResponse)
async def predict(
    sequence: str = Form(...),
    entry: Optional[str] = Form(None),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON"),
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
    return await asyncio.to_thread(
        process_single_sequence,
        df=df,
        threshold_config_requested=threshold_config_requested,
        threshold_config_resolved=threshold_config_resolved,
    )


# Content-Type aliases the route accepts for FASTA payloads. Standardized
# header is ``text/x-fasta``; ``application/x-fasta`` and ``chemical/x-fasta``
# are common in older bioinformatics tooling and biopython examples — accept
# them to stay friendly to existing scripts. We also accept anything containing
# the substring ``fasta`` so CLI users typing ``-H 'Content-Type: fasta'``
# (technically invalid but common) still hit the right parser.
_FASTA_CONTENT_TYPES = ("text/x-fasta", "application/x-fasta", "chemical/x-fasta")
_CSV_CONTENT_TYPES = ("text/csv", "application/csv", "text/tab-separated-values")


@router.post("/api/predict/batch", response_model=RowsResponse)
async def predict_batch(
    request: Request,
    thresholdConfig: Optional[str] = Query(
        None,
        description="JSON threshold configuration. Passed as a query param so the request body "
        "stays a clean raw FASTA / CSV payload — keeps the curl ergonomic.",
    ),
):
    """Run the PVL pipeline on a batch of peptides in one request.

    Accepts raw FASTA or CSV in the request body. The parser is selected by
    ``Content-Type``:

    - ``text/x-fasta`` (or ``application/x-fasta`` / ``chemical/x-fasta``) →
      multi-entry FASTA, parsed via :func:`services.dataframe_utils.parse_fasta`.
    - ``text/csv`` / ``application/csv`` / ``text/tab-separated-values`` →
      CSV / TSV with ``Entry,Sequence`` columns.

    Response is identical to ``POST /api/upload-csv`` (the canonical batch
    response) — same ``rows`` shape, same ``meta`` envelope, same
    ``run_metadata`` stamp. The only difference is the route is curl-friendly
    (raw body instead of multipart upload) and the metadata stamp records
    ``sequenceSource="fasta"`` when the input was FASTA.

    Example::

        curl -X POST http://localhost:8000/api/predict/batch \\
          -H "Content-Type: text/x-fasta" \\
          --data-binary @example.fasta
    """
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    raw = await request.body()
    if not raw:
        raise HTTPException(
            status_code=400,
            detail=(
                "Empty request body. POST raw FASTA or CSV with --data-binary "
                "and a Content-Type header (text/x-fasta or text/csv)."
            ),
        )

    content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    is_fasta = (
        content_type in _FASTA_CONTENT_TYPES
        or "fasta" in content_type
        or raw.lstrip(b"\xef\xbb\xbf").lstrip().startswith(b">")
    )
    is_csv = (not is_fasta) and (content_type in _CSV_CONTENT_TYPES or "csv" in content_type)

    if not (is_fasta or is_csv):
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported Content-Type: {content_type!r}. "
                "Supported: text/x-fasta (FASTA), text/csv / application/csv (CSV/TSV)."
            ),
        )

    pseudo_filename = "request.fasta" if is_fasta else "request.csv"
    sequence_source = "fasta" if is_fasta else "csv"

    log_info(
        "predict_batch_start",
        f"format={'fasta' if is_fasta else 'csv'} bytes={len(raw)}",
        stage="parse",
        content_type=content_type,
        body_bytes=len(raw),
        sequence_source=sequence_source,
    )

    try:
        if is_fasta:
            df = parse_fasta(raw, pseudo_filename)
        else:
            df = read_any_table(raw, pseudo_filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Failed to parse {'FASTA' if is_fasta else 'CSV'} body: {exc}. "
                "FASTA expects '>' header lines + sequence lines; "
                "CSV expects an 'Entry,Sequence' header row."
            ),
        ) from exc

    if len(df) == 0:
        raise HTTPException(
            status_code=422,
            detail="Parsed body contains no peptide rows.",
        )

    df = normalize_cols(df)
    require_cols(df, ["Entry", "Sequence"])
    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    from api.main import SENTRY_INITIALIZED

    try:
        return await asyncio.to_thread(
            process_upload_dataframe,
            df=df,
            threshold_config_requested=threshold_config_requested,
            threshold_config_resolved=threshold_config_resolved,
            trace_entry=None,
            sentry_initialized=SENTRY_INITIALIZED,
            cancel_event=None,
            sequence_source=sequence_source,
        )
    except UploadProcessingError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc
