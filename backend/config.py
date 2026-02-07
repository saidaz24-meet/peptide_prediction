"""
Centralized configuration management for backend.

All configuration is loaded from environment variables with sane defaults for development.
This ensures consistent configuration across the application and makes it easy to
override settings for different environments (dev, staging, production).

Usage:
    from config import settings
    
    # Access config values
    port = settings.PORT
    use_tango = settings.USE_TANGO
"""

import os
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Load .env file from backend directory (if it exists)
_BACKEND_DIR = Path(__file__).parent
_ENV_FILE = _BACKEND_DIR / ".env"
if _ENV_FILE.exists():
    load_dotenv(_ENV_FILE)

# Also try loading from repo root (for convenience)
_REPO_ROOT = _BACKEND_DIR.parent
_ROOT_ENV_FILE = _REPO_ROOT / ".env"
if _ROOT_ENV_FILE.exists():
    load_dotenv(_ROOT_ENV_FILE, override=False)  # Don't override backend/.env


def _env_bool(name: str, default: bool = False) -> bool:
    """Parse environment variable as boolean.
    
    Treats 1/true/yes/on (case-insensitive) as True; 0/false/no/off as False.
    """
    v = os.getenv(name)
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str, default: List[str]) -> List[str]:
    """Parse environment variable as comma-separated list."""
    v = os.getenv(name)
    if v is None:
        return default
    return [item.strip() for item in v.split(",") if item.strip()]


class Settings:
    """Application settings loaded from environment variables."""
    
    # ============================================================================
    # Server Configuration
    # ============================================================================
    
    PORT: int = int(os.getenv("PORT", "8000"))
    """Server port (default: 8000)"""
    
    HOST: str = os.getenv("HOST", "127.0.0.1")
    """Server host (default: 127.0.0.1)"""
    
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    """Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL (default: INFO)"""
    
    # ============================================================================
    # CORS Configuration
    # ============================================================================
    
    CORS_ORIGINS: List[str] = _env_list(
        "CORS_ORIGINS",
        [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:8080",
            "http://localhost:8080",
        ]
    )
    """Allowed CORS origins (comma-separated, default: local dev origins)"""
    
    # ============================================================================
    # Sentry Configuration
    # ============================================================================
    
    SENTRY_DSN: Optional[str] = os.getenv("SENTRY_DSN")
    """Sentry DSN for error tracking (optional - only initializes if set)"""
    
    SENTRY_DEBUG: bool = _env_bool("SENTRY_DEBUG", False)
    """Enable Sentry debug mode (default: False)"""
    
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    """Environment name for Sentry (default: development)"""
    
    SENTRY_RELEASE: Optional[str] = os.getenv("SENTRY_RELEASE")
    """Release version for Sentry (optional - e.g., 'peptide-prediction@1.2.3' or git commit hash)"""
    
    # ============================================================================
    # Provider Configuration
    # ============================================================================
    
    USE_TANGO: bool = _env_bool("USE_TANGO", True)
    """Enable TANGO provider (default: True)"""

    USE_S4PRED: bool = _env_bool("USE_S4PRED", True)
    """Enable S4PRED secondary structure prediction (default: True)"""

    TANGO_MODE: str = os.getenv("TANGO_MODE", "simple").lower()
    """TANGO execution mode: 'simple' or 'host' (default: simple)"""

    S4PRED_MODEL_PATH: Optional[str] = os.getenv("S4PRED_MODEL_PATH")
    """Path to S4PRED model weights directory (required for S4PRED to run)"""
    
    # ============================================================================
    # Provider Runtime Directories
    # ============================================================================
    
    TANGO_RUNTIME_DIR: Optional[str] = os.getenv("TANGO_RUNTIME_DIR")
    """TANGO runtime directory (default: backend/.run_cache/Tango)"""

    S4PRED_RUNTIME_DIR: Optional[str] = os.getenv("S4PRED_RUNTIME_DIR")
    """S4PRED runtime directory (default: backend/.run_cache/S4Pred)"""

    @property
    def tango_runtime_dir(self) -> str:
        """Get TANGO runtime directory with default fallback."""
        if self.TANGO_RUNTIME_DIR:
            return self.TANGO_RUNTIME_DIR
        return str(_BACKEND_DIR / ".run_cache" / "Tango")

    @property
    def s4pred_runtime_dir(self) -> str:
        """Get S4PRED runtime directory with default fallback."""
        if self.S4PRED_RUNTIME_DIR:
            return self.S4PRED_RUNTIME_DIR
        return str(_BACKEND_DIR / ".run_cache" / "S4Pred")

    # ============================================================================
    # Threshold Configuration
    # ============================================================================
    
    # FF-Helix thresholds
    FF_HELIX_THRESHOLD: float = float(os.getenv("FF_HELIX_THRESHOLD", "1.0"))
    """FF-Helix propensity threshold (default: 1.0)"""
    
    FF_HELIX_CORE_LEN: int = int(os.getenv("FF_HELIX_CORE_LEN", "6"))
    """FF-Helix core window length (default: 6)"""
    
    # SSW diff thresholds (for TANGO)
    SSW_DIFF_THRESHOLD_STRATEGY: str = os.getenv("SSW_DIFF_THRESHOLD_STRATEGY", "mean").lower()
    """SSW diff threshold strategy: 'mean', 'fixed', 'multiplier' (default: mean)"""
    
    SSW_DIFF_THRESHOLD_FIXED: float = float(os.getenv("SSW_DIFF_THRESHOLD_FIXED", "0.0"))
    """Fixed SSW diff threshold (used when strategy='fixed', default: 0.0)"""
    
    SSW_DIFF_THRESHOLD_MULTIPLIER: float = float(os.getenv("SSW_DIFF_THRESHOLD_MULTIPLIER", "1.0"))
    """SSW diff threshold multiplier (used when strategy='multiplier', default: 1.0)"""
    
    SSW_DIFF_THRESHOLD_FALLBACK: float = float(os.getenv("SSW_DIFF_THRESHOLD_FALLBACK", "0.0"))
    """Fallback SSW diff threshold when no valid diffs (default: 0.0)"""

    # S4PRED thresholds (from reference config.py)
    MIN_S4PRED_SCORE: float = float(os.getenv("MIN_S4PRED_SCORE", "0.5"))
    """Minimum S4PRED probability score for segment detection (default: 0.5)"""

    MIN_SEGMENT_LENGTH: int = int(os.getenv("MIN_SEGMENT_LENGTH", "5"))
    """Minimum segment length for secondary structure detection (default: 5)"""

    MAX_GAP: int = int(os.getenv("MAX_GAP", "3"))
    """Maximum gap to merge across in segment detection (default: 3)"""

    # ============================================================================
    # Debug Configuration
    # ============================================================================
    
    DEBUG_ENTRY: Optional[str] = os.getenv("DEBUG_ENTRY", "").strip() or None
    """Debug entry ID for tracing specific peptide through pipeline (optional)"""
    
    # ============================================================================
    # Default Threshold Values (for threshold resolution service)
    # ============================================================================
    
    DEFAULT_MU_H_CUTOFF: float = float(os.getenv("DEFAULT_MU_H_CUTOFF", "0.0"))
    """Default μH cutoff threshold (default: 0.0)"""
    
    DEFAULT_HYDRO_CUTOFF: float = float(os.getenv("DEFAULT_HYDRO_CUTOFF", "0.0"))
    """Default hydrophobicity cutoff threshold (default: 0.0)"""
    
    DEFAULT_FF_HELIX_PERCENT_THRESHOLD: float = float(os.getenv("DEFAULT_FF_HELIX_PERCENT_THRESHOLD", "50.0"))
    """Default FF-Helix % threshold (default: 50.0)"""
    
    @property
    def default_thresholds(self) -> dict:
        """Get default threshold values as dict."""
        return {
            "muHCutoff": self.DEFAULT_MU_H_CUTOFF,
            "hydroCutoff": self.DEFAULT_HYDRO_CUTOFF,
            "ffHelixPercentThreshold": self.DEFAULT_FF_HELIX_PERCENT_THRESHOLD,
        }


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance."""
    return settings

