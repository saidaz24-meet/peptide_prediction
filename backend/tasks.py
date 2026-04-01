"""
Celery task definitions for PVL background processing.

Tasks wrap the existing prediction pipeline functions and add:
- Progress reporting via self.update_state()
- Trace ID propagation for structured logging
- Graceful error handling with Sentry integration
"""

import uuid
from typing import Any, Dict, List, Optional

import pandas as pd
import sentry_sdk

from celery_app import celery_app
from services.logger import log_error, log_info, set_trace_id


@celery_app.task(bind=True, name="tasks.process_batch", queue="batch")
def process_batch(
    self,
    df_records: List[Dict[str, Any]],
    threshold_config_requested: Optional[Dict[str, Any]],
    threshold_config_resolved: Dict[str, Any],
    trace_entry: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process a batch upload through the full prediction pipeline.

    This task wraps process_upload_dataframe() with progress reporting.
    The result is a RowsResponse dict: { "rows": [...], "meta": {...} }.

    Args:
        df_records: DataFrame serialized as list of dicts (from df.to_dict('records'))
        threshold_config_requested: Parsed threshold config from user, or None
        threshold_config_resolved: Resolved config with mode/version/custom
        trace_entry: Optional entry ID for detailed tracing
        trace_id: Trace ID from the originating HTTP request
    """
    # Set trace context for structured logging inside the worker
    task_trace_id = trace_id or str(uuid.uuid4())
    set_trace_id(task_trace_id)

    log_info(
        "task_start",
        f"Starting batch task {self.request.id} with {len(df_records)} peptides",
        stage="task",
    )

    # Report initial progress
    self.update_state(
        state="PROGRESS",
        meta={"stage": "parsing", "percent": 5, "peptide_count": len(df_records)},
    )

    # Reconstruct DataFrame from JSON records
    df = pd.DataFrame.from_records(df_records)

    # Progress callback — invoked at each pipeline stage
    def on_progress(stage: str, percent: int) -> None:
        self.update_state(
            state="PROGRESS",
            meta={"stage": stage, "percent": percent, "peptide_count": len(df_records)},
        )

    try:
        # Import here to avoid circular imports at module level
        from services.upload_service import process_upload_dataframe

        result = process_upload_dataframe(
            df=df,
            threshold_config_requested=threshold_config_requested,
            threshold_config_resolved=threshold_config_resolved,
            trace_entry=trace_entry,
            sentry_initialized=True,
            progress_callback=on_progress,
        )

        log_info(
            "task_complete",
            f"Batch task {self.request.id} completed: {len(result.get('rows', []))} rows",
            stage="task",
        )

        return result

    except Exception as e:
        log_error("task_failed", f"Batch task {self.request.id} failed: {e}", stage="task")
        sentry_sdk.capture_exception(e)
        # Re-raise so Celery marks task as FAILURE with the error info
        raise


@celery_app.task(bind=True, name="tasks.process_quick", queue="quick")
def process_quick(
    self,
    sequence: str,
    entry: Optional[str],
    threshold_config_requested: Optional[Dict[str, Any]],
    threshold_config_resolved: Dict[str, Any],
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process a single sequence prediction (Quick Analyze).

    Currently a placeholder — /api/predict remains synchronous because single
    predictions complete in <3s. This task exists for future use when we want
    to fully decouple all predictions from the request lifecycle.
    """
    task_trace_id = trace_id or str(uuid.uuid4())
    set_trace_id(task_trace_id)

    log_info("task_start", f"Quick task {self.request.id} for entry={entry}", stage="task")

    try:
        from services.predict_service import process_single_sequence

        df = pd.DataFrame([{"Entry": entry or "QUICK", "Sequence": sequence}])
        df["Length"] = df["Sequence"].str.len()

        result = process_single_sequence(
            df=df,
            threshold_config_requested=threshold_config_requested,
            threshold_config_resolved=threshold_config_resolved,
        )

        log_info("task_complete", f"Quick task {self.request.id} completed", stage="task")
        return result

    except Exception as e:
        log_error("task_failed", f"Quick task {self.request.id} failed: {e}", stage="task")
        sentry_sdk.capture_exception(e)
        raise
