"""
Provider status and diagnostic endpoints.
"""

import asyncio
import os
import subprocess

from fastapi import APIRouter

import tango
from config import settings
from services.provider_state import get_last_provider_status, get_last_run_dir

router = APIRouter()


@router.get("/api/debug/providers")
async def debug_providers():
    """
    Debug endpoint to quickly see provider status and sample counts.
    Returns current dataset provider status if available, or empty response.
    """
    return {
        "note": "This endpoint shows provider status from the last processed dataset. Load a dataset first via /api/upload-csv or /api/uniprot/execute",
        "sample_structure": {
            "tango": {
                "status": "OFF | UNAVAILABLE | PARTIAL | AVAILABLE",
                "reason": "string | null",
                "stats": {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
            }
        },
    }


@router.get("/api/providers/last-run")
async def providers_last_run():
    """
    Returns the last provider status metadata from the most recent dataset processing.
    Includes provider status, reasons, stats, and run directory paths for debugging.
    """
    last_status = get_last_provider_status()

    if last_status is None:
        return {
            "note": "No dataset processed yet. Load a dataset via /api/upload-csv or /api/uniprot/execute first.",
            "tango": None,
            "s4pred": None,
            "run_dirs": {
                "tango": None,
            },
        }

    latest_tango_dir = get_last_run_dir() or tango._latest_run_dir()

    return {
        "tango": last_status.get("tango"),
        "s4pred": last_status.get("s4pred"),
        "run_dirs": {
            "tango": latest_tango_dir,
        },
        "sample_counts": {
            "total_rows": last_status.get("total_rows", 0),
            "ssw_rows_with_data": last_status.get("ssw_rows_with_data", 0),
        },
    }


def _diagnose_tango_sync():
    """Synchronous TANGO diagnostic — runs in thread pool to avoid blocking event loop."""
    use_docker = settings.TANGO_MODE != "simple"
    docker_image = os.getenv("TANGO_DOCKER_IMAGE", "desy-tango")

    result = {
        "status": "unknown",
        "path": None,
        "version": None,
        "reason": None,
    }

    # Docker mode: check if image exists
    if use_docker:
        try:
            proc = subprocess.run(
                ["docker", "image", "inspect", docker_image],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if proc.returncode == 0:
                result["status"] = "found"
                result["path"] = f"docker:{docker_image}"
                try:
                    version_proc = subprocess.run(
                        ["docker", "run", "--rm", docker_image, "tango", "--version"],
                        capture_output=True,
                        text=True,
                        timeout=2,
                    )
                    if version_proc.returncode == 0:
                        result["version"] = version_proc.stdout.strip()[:100]
                except Exception:
                    pass
            else:
                result["status"] = "container-missing"
                result["reason"] = f"Docker image '{docker_image}' not found"
        except FileNotFoundError:
            result["status"] = "container-missing"
            result["reason"] = "Docker not installed or not in PATH"
        except subprocess.TimeoutExpired:
            result["status"] = "container-missing"
            result["reason"] = "Docker image check timed out"
        except Exception as e:
            result["status"] = "container-missing"
            result["reason"] = f"Docker check failed: {str(e)}"
        return result

    # Native mode: use centralized platform-aware resolver
    bin_path_abs = tango._resolve_tango_bin()

    if not bin_path_abs:
        result["status"] = "missing"
        result["reason"] = (
            "TANGO binary not found (checked TANGO_BINARY_PATH, tools/tango/bin/, backend/Tango/bin/, and PATH)"
        )
        return result

    result["path"] = bin_path_abs

    if not os.access(bin_path_abs, os.X_OK):
        result["status"] = "no-exec-permission"
        result["reason"] = f"TANGO binary at {bin_path_abs} is not executable"
        return result

    try:
        version_proc = subprocess.run(
            [bin_path_abs, "--version"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if version_proc.returncode == 0:
            result["version"] = version_proc.stdout.strip()[:100]
        else:
            try:
                version_proc = subprocess.run(
                    [bin_path_abs, "-v"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                if version_proc.returncode == 0:
                    result["version"] = version_proc.stdout.strip()[:100]
            except Exception:
                pass
    except subprocess.TimeoutExpired:
        result["reason"] = "Version check timed out (binary may be slow to start)"
    except Exception as e:
        result["reason"] = f"Version check failed: {str(e)}"

    result["status"] = "found"
    return result


@router.get("/api/providers/diagnose/tango")
async def diagnose_tango():
    """
    Diagnose TANGO binary/container availability.
    Returns actionable status for debugging TANGO execution failures.
    """
    return await asyncio.to_thread(_diagnose_tango_sync)
