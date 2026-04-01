"""
Health check and dependency status endpoints.
"""

import os
import time
from typing import Any, Dict

from fastapi import APIRouter

from config import settings

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

    # Use centralized platform-aware resolver
    bin_path = tango_module._resolve_tango_bin()

    if not bin_path:
        result["reason"] = (
            "TANGO binary not found (checked TANGO_BINARY_PATH, tools/tango/bin/, backend/Tango/bin/, and PATH)"
        )
        return result

    result["path"] = os.path.abspath(bin_path)

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

    required_files = [
        "weights_1.pt",
        "weights_2.pt",
        "weights_3.pt",
        "weights_4.pt",
        "weights_5.pt",
    ]
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
    import urllib.error
    import urllib.request

    result = {
        "available": False,
        "reason": None,
        "response_time_ms": None,
    }

    try:
        start = time.time()
        req = urllib.request.Request(
            "https://rest.uniprot.org/uniprotkb/search?query=P53_HUMAN&size=1",
            headers={"Accept": "application/json"},
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


@router.get("/api/health")
def health():
    """Health check endpoint."""
    return {"ok": True}


@router.get("/api/live")
def live():
    """Liveness probe — always 200 if process is running."""
    return {"status": "alive"}


@router.get("/api/ready")
def ready():
    """
    Readiness probe — returns 200 if at least one prediction provider is available.
    Returns 503 if no providers are ready.
    """
    from fastapi.responses import JSONResponse

    checks = {}

    # TANGO check
    if settings.USE_TANGO:
        tango_info = _check_tango_availability()
        checks["tango"] = tango_info["available"]
    else:
        checks["tango"] = False

    # S4PRED check
    if settings.USE_S4PRED:
        s4pred_info = _check_s4pred_availability()
        checks["s4pred"] = s4pred_info["available"]
    else:
        checks["s4pred"] = False

    # FF-Helix is always available (pure Python)
    checks["ff_helix"] = True

    is_ready = any(checks.values())
    payload = {"ready": is_ready, "checks": checks}

    if not is_ready:
        return JSONResponse(status_code=503, content=payload)
    return payload


@router.get("/api/live")
def liveness():
    """
    Kubernetes liveness probe.
    Always returns 200 — if this fails, the pod is restarted.
    """
    return {"status": "alive"}


@router.get("/api/ready")
def readiness():
    """
    Kubernetes readiness probe.
    Returns 200 when at least one prediction provider is available.
    Returns 503 if no providers are ready (pod removed from Service endpoints).
    """
    from fastapi.responses import JSONResponse

    tango_status = _check_tango_availability()
    s4pred_status = _check_s4pred_availability()

    providers_available = sum(
        [
            tango_status["available"],
            s4pred_status["available"],
            True,  # FF-Helix is always available
        ]
    )

    ready = providers_available >= 1
    body = {
        "ready": ready,
        "providers_available": providers_available,
        "tango": tango_status["available"],
        "s4pred": s4pred_status["available"],
        "ff_helix": True,
    }

    if not ready:
        return JSONResponse(status_code=503, content=body)
    return body


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
    providers_available = sum(
        [
            tango_status["available"],
            s4pred_status["available"],
            ff_helix_status["available"],
        ]
    )

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
        issues.append(
            {
                "provider": "tango",
                "fix": "Place platform binary in tools/tango/bin/ or set TANGO_BINARY_PATH env var",
            }
        )
    if not s4pred_status["available"] and settings.USE_S4PRED:
        issues.append(
            {
                "provider": "s4pred",
                "fix": "Set S4PRED_MODEL_PATH to directory containing weights_1.pt through weights_5.pt",
            }
        )

    if issues:
        result["issues"] = issues

    return result
