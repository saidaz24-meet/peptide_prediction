"""
Main FastAPI application setup and router registration.
"""
import os
import uuid
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from config import settings
from services.logger import get_logger, set_trace_id, log_info, log_error
from services.trace_helpers import get_trace_id_for_response

# Import routers
from api.routes import health, example, upload, predict, providers, uniprot, feedback

# Initialize Sentry before FastAPI app creation
SENTRY_INITIALIZED = False
if settings.SENTRY_DSN:
    try:
        release = settings.SENTRY_RELEASE
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[
                FastApiIntegration(),
            ],
            send_default_pii=True,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            environment=settings.ENVIRONMENT,
            release=release,
            debug=settings.SENTRY_DEBUG,
        )
        SENTRY_INITIALIZED = True
        print(f"[SENTRY] Initialized successfully (environment={settings.ENVIRONMENT}, release={release or 'not set'})")
    except Exception as e:
        print(f"[SENTRY] Failed to initialize: {e}")
        SENTRY_INITIALIZED = False
else:
    print("[SENTRY] No DSN provided (SENTRY_DSN env var not set), Sentry disabled")

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
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

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
        
        log_info("request_start", f"{request.method} {request.url.path}", **{
            "method": request.method,
            "path": request.url.path,
            "stage": "request",
        })
        
        try:
            response = await call_next(request)
            response.headers["X-Trace-Id"] = trace_id
            
            log_info("request_end", f"{request.method} {request.url.path} {response.status_code}", **{
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "stage": "request",
            })
            return response
        except Exception as e:
            log_error("request_error", f"{request.method} {request.url.path} failed: {e}", **{
                "method": request.method,
                "path": request.url.path,
                "error": str(e),
                "stage": "request",
            })
            sentry_sdk.capture_exception(e, level="error")
            raise

# CORS configuration from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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

# Log boot message
log_info("boot", f"USE_JPRED={settings.USE_JPRED} • USE_TANGO={settings.USE_TANGO}")

# Export app and SENTRY_INITIALIZED for use in server.py
__all__ = ["app", "SENTRY_INITIALIZED"]

