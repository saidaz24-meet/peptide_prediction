"""
Celery application instance for PVL background task processing.

Shared between FastAPI (task dispatch) and Celery workers (task execution).
Import this module from both sides to ensure consistent configuration.

Usage:
    from celery_app import celery_app
    result = celery_app.send_task("tasks.process_batch", args=[...])
"""

from celery import Celery

from config import settings

celery_app = Celery("pvl")

celery_app.conf.update(
    # Broker & result backend (both Redis)
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    # Task routing: separate queues for batch vs quick
    task_routes={
        "tasks.process_batch": {"queue": "batch"},
        "tasks.process_quick": {"queue": "quick"},
    },
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Result expiry (24 hours)
    result_expires=86400,
    # Track task start time
    task_track_started=True,
    # Don't hijack root logger — keep structured logging
    worker_hijack_root_logger=False,
    # Prefetch one task at a time (heavy tasks)
    worker_prefetch_multiplier=1,
    # Late ack — task acknowledged after completion (safer for crashes)
    task_acks_late=True,
    # Reject tasks on worker shutdown so they can be redelivered
    task_reject_on_worker_lost=True,
    # Timezone
    timezone="UTC",
    enable_utc=True,
)

# Auto-discover tasks in the tasks module
celery_app.autodiscover_tasks(["tasks"])
