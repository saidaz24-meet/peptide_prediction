"""
Global state for provider tracking.

Single canonical store for last-run provider status and TANGO run directory.
All mutations are protected by a threading.Lock to ensure thread safety.
"""
import threading
from typing import Optional, Dict

# Global state to track last provider status (for /api/providers/last-run)
_last_provider_status: Optional[Dict] = None
_last_run_dir: Optional[str] = None
_lock = threading.Lock()


def get_last_provider_status() -> Optional[Dict]:
    """Get the last provider status (returns a defensive copy)."""
    with _lock:
        return _last_provider_status.copy() if _last_provider_status else None


def set_last_provider_status(status: Dict, run_dir: Optional[str] = None) -> None:
    """Set the last provider status. Optionally set run_dir at the same time."""
    global _last_provider_status, _last_run_dir
    with _lock:
        _last_provider_status = status.copy()
        if run_dir is not None:
            _last_run_dir = run_dir


def get_last_run_dir() -> Optional[str]:
    """Get the last run directory."""
    with _lock:
        return _last_run_dir


def set_last_run_dir(run_dir: Optional[str]) -> None:
    """Set the last TANGO run directory."""
    global _last_run_dir
    with _lock:
        _last_run_dir = run_dir

