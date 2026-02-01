"""
Global state for provider tracking.
"""
from typing import Optional, Dict

# Global state to track last provider status (for /api/providers/last-run)
_last_provider_status: Optional[Dict] = None
_last_run_dir: Optional[str] = None


def get_last_provider_status() -> Optional[Dict]:
    """Get the last provider status."""
    return _last_provider_status


def set_last_provider_status(status: Dict, run_dir: Optional[str] = None) -> None:
    """Set the last provider status."""
    global _last_provider_status, _last_run_dir
    _last_provider_status = status.copy()
    _last_run_dir = run_dir


def get_last_run_dir() -> Optional[str]:
    """Get the last run directory."""
    return _last_run_dir

