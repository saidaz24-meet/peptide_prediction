"""
Health check and diagnostic endpoints.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from config import settings
import sentry_sdk
import time

router = APIRouter()

# Import SENTRY_INITIALIZED from main (will be set in api/main.py)
# For now, we'll check settings directly
def _is_sentry_initialized():
    """Check if Sentry is initialized."""
    return bool(settings.SENTRY_DSN)


@router.get("/api/health")
def health():
    """Health check endpoint."""
    return {"ok": True}


@router.get("/api/test-sentry")
async def test_sentry():
    """
    Test endpoint to verify Sentry connection.
    Sends different types of test events to Sentry.
    """
    results = {
        "sentry_initialized": _is_sentry_initialized(),
        "sentry_dsn_configured": bool(settings.SENTRY_DSN),
        "tests": {}
    }
    
    if not _is_sentry_initialized():
        return {
            **results,
            "error": "Sentry not initialized. Check DSN and initialization logs."
        }
    
    # Test 1: Send a simple message
    try:
        sentry_sdk.capture_message("Test message from /api/test-sentry", level="info")
        results["tests"]["message"] = "sent"
    except Exception as e:
        results["tests"]["message"] = f"failed: {str(e)}"
    
    # Test 2: Send an exception
    try:
        test_error = ValueError("Test exception from /api/test-sentry")
        sentry_sdk.capture_exception(test_error, level="error")
        results["tests"]["exception"] = "sent"
    except Exception as e:
        results["tests"]["exception"] = f"failed: {str(e)}"
    
    # Test 3: Trigger an HTTPException (5xx)
    try:
        raise HTTPException(status_code=500, detail="Test 500 error from /api/test-sentry")
    except HTTPException as e:
        # This will be caught by the exception handler and sent to Sentry
        results["tests"]["http_500"] = "triggered"
        raise
    
    return results


@router.get("/api/test-sentry-simple")
async def test_sentry_simple():
    """
    Simple test that just sends a message to Sentry.
    Check your Sentry dashboard after calling this.
    """
    if not _is_sentry_initialized():
        raise HTTPException(status_code=503, detail="Sentry not initialized")
    
    # Send a test message
    event_id = sentry_sdk.capture_message(
        f"Test from backend at {time.time()}",
        level="info"
    )
    
    return {
        "status": "sent",
        "event_id": event_id,
        "message": "Check your Sentry dashboard for this event",
        "sentry_configured": True,
    }


@router.get("/api/debug/config")
async def debug_config():
    """
    Debug endpoint to show current configuration values.
    Useful for diagnosing environment variable loading issues.
    """
    backend_dir = Path(__file__).parent.parent.parent
    env_file = backend_dir / ".env"

    # Read raw .env file contents (if exists)
    env_file_contents = {}
    if env_file.exists():
        try:
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_file_contents[key.strip()] = value.strip()
        except Exception as e:
            env_file_contents = {"error": str(e)}

    return {
        "settings": {
            "USE_TANGO": settings.USE_TANGO,
            "USE_PSIPRED": settings.USE_PSIPRED,
            "USE_JPRED": settings.USE_JPRED,
            "TANGO_MODE": settings.TANGO_MODE,
            "ENVIRONMENT": settings.ENVIRONMENT,
            "PORT": settings.PORT,
            "HOST": settings.HOST,
        },
        "env_vars": {
            "USE_TANGO": os.getenv("USE_TANGO"),
            "USE_PSIPRED": os.getenv("USE_PSIPRED"),
            "TANGO_USE_DOCKER": os.getenv("TANGO_USE_DOCKER"),
            "TANGO_SIMPLE": os.getenv("TANGO_SIMPLE"),
            "TANGO_MODE": os.getenv("TANGO_MODE"),
        },
        "env_file": {
            "path": str(env_file),
            "exists": env_file.exists(),
            "contents": env_file_contents,
        },
        "notes": [
            "If settings.USE_TANGO differs from env_vars.USE_TANGO, restart the server",
            "The .env file is read once when the config module is imported",
            "Settings are class attributes evaluated at import time",
        ]
    }

