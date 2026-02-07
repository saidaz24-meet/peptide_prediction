"""
Health check and diagnostic endpoints.
"""
import os
import shutil
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from config import settings
import sentry_sdk
import time

router = APIRouter()


def _check_tango_availability() -> Dict[str, Any]:
    """Check if TANGO binary is available and configured."""
    result = {
        "enabled": settings.USE_TANGO,
        "available": False,
        "path": None,
        "reason": None,
    }

    if not settings.USE_TANGO:
        result["reason"] = "TANGO disabled (USE_TANGO=0)"
        return result

    # Import here to avoid circular imports
    import tango as tango_module

    # Check binary path
    bin_path = os.path.join(tango_module.TANGO_DIR, "bin", "tango")
    tango_bin_env = os.getenv("TANGO_BIN")

    if tango_bin_env and os.path.exists(tango_bin_env):
        bin_path = tango_bin_env
    elif not os.path.exists(bin_path):
        which_path = shutil.which("tango")
        if which_path:
            bin_path = which_path
        else:
            result["reason"] = f"TANGO binary not found (checked {bin_path} and PATH)"
            return result

    result["path"] = os.path.abspath(bin_path)

    if not os.path.exists(bin_path):
        result["reason"] = f"TANGO binary not found at {bin_path}"
        return result

    if not os.access(bin_path, os.X_OK):
        result["reason"] = f"TANGO binary not executable at {bin_path}"
        return result

    result["available"] = True
    return result


def _check_s4pred_availability() -> Dict[str, Any]:
    """Check if S4PRED is available and configured."""
    import s4pred

    result = {
        "enabled": settings.USE_S4PRED,
        "available": False,
        "path": None,
        "reason": None,
        "weights_found": [],
        "weights_missing": [],
    }

    if not settings.USE_S4PRED:
        result["reason"] = "S4PRED disabled (USE_S4PRED=0)"
        return result

    weights_path = s4pred.get_s4pred_weights_path()
    if not weights_path:
        result["reason"] = "S4PRED_MODEL_PATH not configured"
        return result

    result["path"] = weights_path

    if not os.path.isdir(weights_path):
        result["reason"] = f"S4PRED weights directory not found: {weights_path}"
        return result

    required_files = ['weights_1.pt', 'weights_2.pt', 'weights_3.pt', 'weights_4.pt', 'weights_5.pt']
    for f in required_files:
        if os.path.exists(os.path.join(weights_path, f)):
            result["weights_found"].append(f)
        else:
            result["weights_missing"].append(f)

    if result["weights_missing"]:
        result["reason"] = f"Missing weight files: {result['weights_missing']}"
        return result

    # Check PyTorch
    try:
        import torch  # noqa: F401
    except ImportError:
        result["reason"] = "PyTorch not installed (required for S4PRED)"
        return result

    result["available"] = True
    return result


def _check_uniprot_connectivity() -> Dict[str, Any]:
    """Check UniProt API connectivity (optional external dependency)."""
    import urllib.request
    import urllib.error

    result = {
        "available": False,
        "reason": None,
        "response_time_ms": None,
    }

    try:
        start = time.time()
        req = urllib.request.Request(
            "https://rest.uniprot.org/uniprotkb/search?query=P53_HUMAN&size=1",
            headers={"Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                result["available"] = True
                result["response_time_ms"] = int((time.time() - start) * 1000)
            else:
                result["reason"] = f"UniProt returned status {response.status}"
    except urllib.error.URLError as e:
        result["reason"] = f"Network error: {str(e.reason)}"
    except Exception as e:
        result["reason"] = f"Error: {str(e)}"

    return result

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
            "USE_S4PRED": settings.USE_S4PRED,
            "TANGO_MODE": settings.TANGO_MODE,
            "ENVIRONMENT": settings.ENVIRONMENT,
            "PORT": settings.PORT,
            "HOST": settings.HOST,
        },
        "env_vars": {
            "USE_TANGO": os.getenv("USE_TANGO"),
            "USE_S4PRED": os.getenv("USE_S4PRED"),
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


@router.get("/api/health/dependencies")
async def health_dependencies(check_uniprot: bool = False):
    """
    Comprehensive dependency health check endpoint.

    Returns status of all external dependencies required for full functionality:
    - TANGO: Aggregation propensity prediction (requires binary)
    - S4PRED: Secondary structure prediction (requires PyTorch + weights)
    - UniProt: External API for fetching sequences (optional, requires internet)
    - FF-Helix: Always available (pure Python, no dependencies)

    Args:
        check_uniprot: If True, test UniProt API connectivity (adds ~1-2s latency)

    Returns:
        JSON with status of each dependency and overall readiness
    """
    tango_status = _check_tango_availability()
    s4pred_status = _check_s4pred_availability()

    # FF-Helix is always available (pure Python)
    ff_helix_status = {
        "enabled": True,
        "available": True,
        "reason": None,
    }

    # UniProt check is optional (external network call)
    uniprot_status = None
    if check_uniprot:
        uniprot_status = _check_uniprot_connectivity()

    # Determine overall status
    # "ready" = at least one prediction provider available
    # "degraded" = some providers missing but can still function
    # "unavailable" = no providers available
    providers_available = sum([
        tango_status["available"],
        s4pred_status["available"],
        ff_helix_status["available"],
    ])

    if providers_available >= 2:
        overall_status = "ready"
    elif providers_available == 1:
        overall_status = "degraded"
    else:
        overall_status = "unavailable"

    result = {
        "status": overall_status,
        "providers_available": providers_available,
        "tango": tango_status,
        "s4pred": s4pred_status,
        "ff_helix": ff_helix_status,
    }

    if uniprot_status is not None:
        result["uniprot"] = uniprot_status

    # Add helpful messages for common issues
    issues = []
    if not tango_status["available"] and settings.USE_TANGO:
        issues.append({
            "provider": "tango",
            "fix": "Place TANGO binary at backend/Tango/bin/tango or set TANGO_BIN env var"
        })
    if not s4pred_status["available"] and settings.USE_S4PRED:
        issues.append({
            "provider": "s4pred",
            "fix": "Set S4PRED_MODEL_PATH to directory containing weights_1.pt through weights_5.pt"
        })

    if issues:
        result["issues"] = issues

    return result
