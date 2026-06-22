"""
Main FastAPI application setup and router registration.
"""

# PERF-2026-06-18: must be the FIRST local import — pins OMP / MKL / OpenBLAS
# thread counts BEFORE torch / numpy / scipy load via any downstream import.
# See `backend/_perf_init.py` for the why.
import _perf_init  # noqa: F401

import asyncio
import concurrent.futures
import logging
import os
import uuid

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from starlette.middleware.base import BaseHTTPMiddleware

# Import routers
from api.routes import (
    cohorts,
    example,
    feedback,
    health,
    jobs,
    peptides,
    predict,
    providers,
    uniprot,
    upload,
)
from config import settings
from services.logger import get_logger, log_error, log_info, log_warning, set_trace_id

# ---------------------------------------------------------------------------
# Sentry before_send filter (V6-1)
# ---------------------------------------------------------------------------
# Module-level so tests can exercise the filter without needing a real DSN.
# Drops the noisy 4xx classes that aren't real errors:
#   - 422 — request-contract validation failures (Wave B made these LOUD on
#           purpose; they're user input bugs, not server bugs).
#   - 404 — expected "not found" (e.g. polling a job that's been cleaned up).
# Keeps 400/401/403 (real-ish client errors) and 5xx (genuine server errors).
# Also drops asyncio.CancelledError / KeyboardInterrupt (client disconnect /
# Ctrl-C — see UNIPROT_TIMEOUT_INVESTIGATION.md).
_NOISY_HTTP_STATUSES = frozenset({404, 422})


def _sentry_before_send(event, hint):
    """Filter out expected noise from Sentry events.

    Returns ``None`` to drop the event, otherwise returns it unchanged.
    """
    exc_info = hint.get("exc_info") if hint else None
    if exc_info:
        exc_type, exc_value, _tb = exc_info

        # Cancellation / shutdown — never an error.
        if exc_type is not None and issubclass(
            exc_type, (asyncio.CancelledError, KeyboardInterrupt)
        ):
            return None

        # 4xx HTTPException noise.
        if isinstance(exc_value, HTTPException):
            status_code = getattr(exc_value, "status_code", None)
            if status_code in _NOISY_HTTP_STATUSES:
                return None

    return event


# ---------------------------------------------------------------------------

# Initialize Sentry before FastAPI app creation
# Skip Sentry during test runs — test-triggered errors (invalid sort, missing columns,
# TANGO binding) are expected and should not pollute the Sentry dashboard.
SENTRY_INITIALIZED = False
_running_under_pytest = "pytest" in os.environ.get("_", "") or "pytest" in " ".join(os.sys.argv)
if settings.SENTRY_DSN and not _running_under_pytest:
    try:
        # Resolve release: explicit env var → git SHA fallback
        release = settings.SENTRY_RELEASE
        if not release:
            import subprocess

            try:
                release = (
                    subprocess.check_output(
                        ["git", "rev-parse", "--short", "HEAD"],
                        stderr=subprocess.DEVNULL,
                        timeout=5,
                    )
                    .decode()
                    .strip()
                )
            except Exception:
                release = None

        # Environment-aware sampling rates
        is_production = settings.ENVIRONMENT == "production"
        traces_rate = 0.1 if is_production else 1.0
        profiles_rate = 0.1 if is_production else 1.0

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[
                FastApiIntegration(),
                AsyncioIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,
                    event_level=logging.ERROR,
                ),
            ],
            send_default_pii=False,
            before_send=_sentry_before_send,
            traces_sample_rate=traces_rate,
            profiles_sample_rate=profiles_rate,
            environment=settings.ENVIRONMENT,
            release=release,
            debug=settings.SENTRY_DEBUG,
        )
        SENTRY_INITIALIZED = True
        log_info(
            "sentry_init",
            f"Initialized successfully (environment={settings.ENVIRONMENT}, release={release or 'not set'}, traces_rate={traces_rate})",
        )
    except Exception as e:
        log_error("sentry_init", f"Failed to initialize: {e}")
        SENTRY_INITIALIZED = False
else:
    log_info("sentry_init", "No DSN provided (SENTRY_DSN env var not set), Sentry disabled")

# Create FastAPI app
app = FastAPI(title="Peptide Prediction Service")


# PERF-2026-06-22: pre-load the S4PRED 5-model BiLSTM ensemble at import
# time, before any gunicorn worker forks. With gunicorn's --preload flag
# (set in Dockerfile.backend CMD), the master loads the model once,
# workers fork inheriting the weights via Linux copy-on-write. Result:
# zero per-worker cold-start latency AND zero duplicated RAM across
# workers.
#
# Without --preload (uvicorn dev server, single-worker gunicorn): the
# load runs once when api.main is first imported, before the first
# request hits. Same correctness, slightly different timing.
#
# This REPLACES the old async fire-and-forget _warmup_s4pred startup
# hook, which raced with first-request handling and didn't help with
# the per-worker RAM problem.
from _app_preload import check_tango_binary_at_boot as _check_tango_binary_at_boot
from _app_preload import preload_models as _preload_models

_preload_models()
_check_tango_binary_at_boot()


# Add exception handler to capture HTTPExceptions to Sentry
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Capture HTTPExceptions to Sentry.
    By default, FastApiIntegration only captures 5xx errors.
    This handler captures the *interesting* 4xx errors too — but skips 404
    and 422, which are filtered as noise by ``_sentry_before_send`` (V6-1).
    """
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc, level="error")
    elif exc.status_code in (400, 401, 403):
        sentry_sdk.capture_exception(exc, level="warning")

    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# Structured logging setup
logger = get_logger()


# Middleware to attach traceId to each request
class TraceIdMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that:
    - Generates traceId if missing (from X-Trace-Id header or new UUID)
    - Attaches traceId to request.state for handler access
    - Adds traceId to response headers (X-Trace-Id)
    - Ensures traceId is available in logger context for all log events
    """

    async def dispatch(self, request: Request, call_next):
        import time as _t

        trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
        set_trace_id(trace_id)
        request.state.trace_id = trace_id

        # V6-1: tag the current Sentry scope so any event captured during this
        # request correlates with the same trace_id used by the frontend SDK
        # and by structured logs. No-op when Sentry is not initialised.
        sentry_sdk.set_tag("trace_id", trace_id)

        log_info(
            "request_start",
            f"{request.method} {request.url.path}",
            **{
                "method": request.method,
                "path": request.url.path,
                "stage": "request",
            },
        )

        t0 = _t.perf_counter()
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id

            # PERF-2026-06-21: request-level wall time so we can pair the
            # per-stage timings emitted by services.perf_logger with the
            # full end-to-end number a client would see.
            elapsed_ms = round((_t.perf_counter() - t0) * 1000, 2)
            response.headers["X-Elapsed-Ms"] = str(elapsed_ms)

            log_info(
                "request_end",
                f"{request.method} {request.url.path} {response.status_code} {elapsed_ms}ms",
                **{
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "stage": "request",
                    "elapsed_ms": elapsed_ms,
                },
            )
            return response
        except Exception as e:
            elapsed_ms = round((_t.perf_counter() - t0) * 1000, 2)
            log_error(
                "request_error",
                f"{request.method} {request.url.path} failed after {elapsed_ms}ms: {e}",
                **{
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "stage": "request",
                    "elapsed_ms": elapsed_ms,
                },
            )
            sentry_sdk.capture_exception(e, level="error")
            raise


# CORS configuration from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Trace-Id"],
)

# Add TraceIdMiddleware last (so it executes first/outermost and captures all requests)
app.add_middleware(TraceIdMiddleware)

# Register routers
app.include_router(health.router)
app.include_router(example.router)
app.include_router(upload.router)
app.include_router(predict.router)
app.include_router(providers.router)
app.include_router(uniprot.router)
app.include_router(feedback.router)
app.include_router(jobs.router)
app.include_router(peptides.router)
app.include_router(cohorts.router)


# Configure thread pool for asyncio.to_thread() — allows concurrent analysis requests.
# 4 threads = 2 concurrent full pipelines on 4 vCPU VPS.
@app.on_event("startup")
def _configure_thread_pool():
    loop = asyncio.get_running_loop()
    loop.set_default_executor(
        concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="pvl")
    )


@app.on_event("startup")
def _check_redis():
    """Check Redis connectivity on startup. Disable Celery if Redis is unreachable."""
    if not settings.CELERY_ENABLED:
        log_info("redis_skip", "CELERY_ENABLED=0, skipping Redis check")
        return
    try:
        import redis

        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
        r.ping()
        log_info("redis_ok", f"Redis connected at {settings.REDIS_URL}")
    except Exception as e:
        log_info("redis_fail", f"Redis unavailable: {e} — falling back to sync mode")
        settings.CELERY_ENABLED = False


# PERF-2026-06-22: the old fire-and-forget ``_warmup_s4pred`` startup
# hook was removed here. It was replaced by the module-level
# ``_preload_models()`` call above, which (combined with gunicorn
# --preload) loads the ensemble once in the master process before any
# worker forks. Strictly better — no race with first request, no
# per-worker duplicated RAM.


@app.on_event("shutdown")
async def _graceful_shutdown():
    """Handle SIGTERM for graceful K8s pod shutdown."""
    log_info("shutdown", "Graceful shutdown initiated")


# Log boot message
log_info(
    "boot",
    f"USE_TANGO={settings.USE_TANGO} • USE_S4PRED={settings.USE_S4PRED} • CELERY={settings.CELERY_ENABLED}",
)

# Export app and SENTRY_INITIALIZED for use in server.py
__all__ = ["app", "SENTRY_INITIALIZED"]
