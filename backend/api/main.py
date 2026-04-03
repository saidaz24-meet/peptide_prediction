"""
Main FastAPI application setup and router registration.
"""

import asyncio
import concurrent.futures
import logging
import os
import uuid

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from starlette.middleware.base import BaseHTTPMiddleware

# Import routers
from api.routes import example, feedback, health, jobs, predict, providers, uniprot, upload
from config import settings
from services.logger import get_logger, log_error, log_info, set_trace_id

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

        def _before_send(event, hint):
            """Filter out expected noise from Sentry."""
            exc_info = hint.get("exc_info")
            if exc_info:
                exc_type = exc_info[0]
                # CancelledError is expected on client disconnect / server shutdown
                if exc_type and issubclass(exc_type, (asyncio.CancelledError, KeyboardInterrupt)):
                    return None
            return event

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(
                    level=logging.WARNING,
                    event_level=logging.ERROR,
                ),
            ],
            send_default_pii=False,
            before_send=_before_send,
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


# Add exception handler to capture HTTPExceptions to Sentry
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Capture HTTPExceptions to Sentry.
    By default, FastApiIntegration only captures 5xx errors.
    This handler captures important 4xx errors too.
    """
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc, level="error")
    elif exc.status_code in [400, 401, 403, 404, 422]:
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
        trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
        set_trace_id(trace_id)
        request.state.trace_id = trace_id

        log_info(
            "request_start",
            f"{request.method} {request.url.path}",
            **{
                "method": request.method,
                "path": request.url.path,
                "stage": "request",
            },
        )

        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id

            log_info(
                "request_end",
                f"{request.method} {request.url.path} {response.status_code}",
                **{
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "stage": "request",
                },
            )
            return response
        except Exception as e:
            log_error(
                "request_error",
                f"{request.method} {request.url.path} failed: {e}",
                **{
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "stage": "request",
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
