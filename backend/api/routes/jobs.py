"""
Job management endpoints for async task processing.

POST /api/jobs/upload  — Submit a batch analysis job (returns jobId)
GET  /api/jobs/{id}    — Poll job status and progress
POST /api/jobs/{id}/cancel — Cancel a running job
GET  /api/jobs         — List active jobs
"""

import asyncio
import json
import threading
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from config import settings
from services.dataframe_utils import read_any_table, require_cols
from services.logger import get_trace_id, log_error, log_info
from services.normalize import normalize_cols
from services.thresholds import parse_threshold_config
from services.upload_service import AnalysisCancelledError, UploadProcessingError, process_upload_dataframe

router = APIRouter()

# In-memory store for sync job cancel events (keyed by cancel token)
_sync_cancel_events: dict[str, threading.Event] = {}


@router.post("/api/jobs/cancel-sync/{cancel_token}")
async def cancel_sync_job(cancel_token: str):
    """Cancel a running sync job by its cancel token."""
    event = _sync_cancel_events.get(cancel_token)
    if event:
        event.set()
        log_info("job_cancel_requested", f"Cancel requested for sync job {cancel_token[:8]}")
        return {"status": "CANCELLED", "cancelToken": cancel_token}
    raise HTTPException(404, detail="No active job with this cancel token")


@router.post("/api/jobs/upload")
async def submit_upload_job(
    file: UploadFile = File(...),
    debug_entry: Optional[str] = Query(None, description="Entry ID to trace through pipeline"),
    thresholdConfig: Optional[str] = Form(None, description="Threshold configuration JSON"),
    cancelToken: Optional[str] = Query(None, description="Token for cancelling sync jobs"),
):
    """
    Submit a batch analysis job. Returns a job ID for polling.

    When CELERY_ENABLED=True: dispatches to Celery worker, returns jobId for async polling.
    When CELERY_ENABLED=False: processes synchronously, returns result directly.
    """
    trace_entry = debug_entry or settings.DEBUG_ENTRY
    trace_id = get_trace_id()

    # Parse threshold config
    threshold_config_requested, threshold_config_resolved = parse_threshold_config(thresholdConfig)

    # Validate file
    if not file.filename:
        raise HTTPException(400, detail="File must have a filename.")

    file_ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
    if file_ext not in ["csv", "tsv", "xlsx", "xls", "txt", "fasta", "fa"]:
        raise HTTPException(400, detail=f"Unsupported file format: '{file_ext}'.")

    # Read and parse file
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(400, detail="Uploaded file is empty.")

    try:
        df = read_any_table(raw, file.filename)
    except (ValueError, Exception) as e:
        raise HTTPException(400, detail=str(e)) from e

    if len(df) == 0:
        raise HTTPException(400, detail="Parsed file contains no data rows.")

    df = normalize_cols(df)
    require_cols(df, ["Entry", "Sequence"])

    if "Length" not in df.columns:
        df["Length"] = df["Sequence"].astype(str).str.len()

    peptide_count = len(df)

    # Async path: dispatch to Celery
    if settings.CELERY_ENABLED:
        try:
            from tasks import process_batch

            # Serialize DataFrame to JSON-safe records
            df_records = df.where(df.notna(), None).to_dict("records")

            result = process_batch.delay(
                df_records=df_records,
                threshold_config_requested=threshold_config_requested,
                threshold_config_resolved=threshold_config_resolved,
                trace_entry=trace_entry,
                trace_id=trace_id,
            )

            # Track job in Redis
            _track_job(result.id, file.filename, peptide_count)

            log_info(
                "job_submitted",
                f"Job {result.id} submitted for {peptide_count} peptides",
                stage="job",
            )

            return {
                "jobId": result.id,
                "status": "PENDING",
                "mode": "async",
                "peptideCount": peptide_count,
            }

        except Exception as e:
            log_error(
                "celery_dispatch_failed", f"Celery dispatch failed: {e}, falling back to sync"
            )
            # Fall through to sync path

    # Sync fallback path — with cancellation support
    log_info("job_sync", f"Processing {peptide_count} peptides synchronously", stage="job")

    from api.main import SENTRY_INITIALIZED

    cancel_event = threading.Event()

    # Register cancel event so the cancel endpoint can find it
    if cancelToken:
        _sync_cancel_events[cancelToken] = cancel_event

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: process_upload_dataframe(
                df=df,
                threshold_config_requested=threshold_config_requested,
                threshold_config_resolved=threshold_config_resolved,
                trace_entry=trace_entry,
                sentry_initialized=SENTRY_INITIALIZED,
                cancel_event=cancel_event,
            ),
        )

        if cancel_event.is_set():
            log_info("job_cancelled", "Upload analysis cancelled by user")
            return {"jobId": None, "status": "CANCELLED", "mode": "sync", "result": None}

        return {
            "jobId": None,
            "status": "SUCCESS",
            "mode": "sync",
            "result": result,
        }
    except asyncio.CancelledError:
        cancel_event.set()
        log_info("job_client_disconnect", "Client disconnected, cancelling upload analysis")
        raise
    except AnalysisCancelledError:
        log_info("job_cancelled", "Upload analysis cancelled by user")
        return {"jobId": None, "status": "CANCELLED", "mode": "sync", "result": None}
    except UploadProcessingError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=json.dumps(e.detail) if e.detail else e.message,
        ) from e
    finally:
        if cancelToken:
            _sync_cancel_events.pop(cancelToken, None)


@router.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll job status and progress."""
    if not settings.CELERY_ENABLED:
        raise HTTPException(503, detail="Async job processing is not enabled.")

    from celery.result import AsyncResult

    from celery_app import celery_app

    result = AsyncResult(job_id, app=celery_app)

    response = {
        "jobId": job_id,
        "status": result.state,
        "progress": None,
        "result": None,
        "error": None,
    }

    if result.state == "PROGRESS":
        response["progress"] = result.info
    elif result.state == "SUCCESS":
        response["result"] = result.result
        _untrack_job(job_id)
    elif result.state == "FAILURE":
        response["error"] = str(result.info) if result.info else "Unknown error"
        _untrack_job(job_id)
    elif result.state == "REVOKED":
        _untrack_job(job_id)

    return response


@router.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    if not settings.CELERY_ENABLED:
        raise HTTPException(503, detail="Async job processing is not enabled.")

    from celery_app import celery_app

    celery_app.control.revoke(job_id, terminate=True, signal="SIGTERM")

    log_info("job_cancelled", f"Job {job_id} cancellation requested", stage="job")
    _untrack_job(job_id)

    return {"jobId": job_id, "status": "REVOKED"}


@router.get("/api/jobs")
async def list_jobs():
    """List active jobs."""
    if not settings.CELERY_ENABLED:
        return {"jobs": []}

    try:
        import redis as redis_lib
        from celery.result import AsyncResult

        from celery_app import celery_app

        r = redis_lib.from_url(settings.REDIS_URL)
        job_data = r.hgetall("pvl:active_jobs")

        jobs = []
        for job_id_bytes, meta_bytes in job_data.items():
            job_id = job_id_bytes.decode() if isinstance(job_id_bytes, bytes) else job_id_bytes
            try:
                meta = json.loads(meta_bytes)
            except (json.JSONDecodeError, TypeError):
                meta = {}

            result = AsyncResult(job_id, app=celery_app)
            status = result.state

            # Clean up completed jobs
            if status in ("SUCCESS", "FAILURE", "REVOKED"):
                r.hdel("pvl:active_jobs", job_id)
                continue

            progress = result.info if status == "PROGRESS" else None

            jobs.append(
                {
                    "jobId": job_id,
                    "status": status,
                    "progress": progress,
                    "fileName": meta.get("fileName"),
                    "peptideCount": meta.get("peptideCount"),
                    "createdAt": meta.get("createdAt"),
                }
            )

        return {"jobs": jobs}

    except Exception as e:
        log_error("jobs_list_failed", f"Failed to list jobs: {e}")
        return {"jobs": []}


def _track_job(job_id: str, filename: str, peptide_count: int) -> None:
    """Track an active job in Redis."""
    try:
        import redis as redis_lib

        r = redis_lib.from_url(settings.REDIS_URL)
        meta = json.dumps(
            {
                "fileName": filename,
                "peptideCount": peptide_count,
                "createdAt": time.time(),
            }
        )
        r.hset("pvl:active_jobs", job_id, meta)
    except Exception:
        pass  # Non-critical — job still works without tracking


def _untrack_job(job_id: str) -> None:
    """Remove a job from the active tracking set."""
    try:
        import redis as redis_lib

        r = redis_lib.from_url(settings.REDIS_URL)
        r.hdel("pvl:active_jobs", job_id)
    except Exception:
        pass
