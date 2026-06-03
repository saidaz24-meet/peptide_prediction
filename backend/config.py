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
    # Build / Version Identity (Cowork V4-1 reproducibility ribbon)
    # ============================================================================

    VERSION: str = os.getenv("VERSION", "0.1.0")
    """Application version string. Override via VERSION env var (default: 0.1.0)."""

    BUILD_SHA: Optional[str] = os.getenv("BUILD_SHA") or None
    """Build commit SHA — populated from BUILD_SHA env var at deploy time. None in dev."""

    BUILD_TIMESTAMP: Optional[str] = os.getenv("BUILD_TIMESTAMP") or None
    """Build timestamp (ISO-8601) — populated from BUILD_TIMESTAMP env var at deploy time. None in dev."""

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
        ],
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

    # Reference dataset-average fallbacks for single-sequence mode
    # When there is no cohort to compute data-average, use reference values.
    PELEG_DEFAULT_HYDRO_THRESHOLD: float = float(
        os.getenv("PELEG_DEFAULT_HYDRO_THRESHOLD", "0.417")
    )
    """Reference dataset-average hydrophobicity (fallback for single-sequence FF-SSW)"""

    PELEG_DEFAULT_HELIX_UH_THRESHOLD: float = float(
        os.getenv("PELEG_DEFAULT_HELIX_UH_THRESHOLD", "0.388")
    )
    """Reference dataset-average helix uH (fallback for single-sequence FF-Helix)"""

    # ============================================================================
    # Peleg's 9 canonical thresholds (PELEG_FEEDBACK FIX-002)
    # Source: docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md (Tier 0, slides 2-8)
    # ============================================================================

    # Group 1: General secondary-structure thresholds
    # MIN_SEGMENT_LENGTH = "Minimal continuous residues"
    # MAX_GAP            = "Maximum gap"
    MIN_S4PRED_SCORE: float = float(os.getenv("MIN_S4PRED_SCORE", "0.5"))
    """Minimum S4PRED helix score (Peleg default: 0.5 — "for now", flagged for testing)"""

    MIN_SEGMENT_LENGTH: int = int(os.getenv("MIN_SEGMENT_LENGTH", "5"))
    """Minimum continuous residues for secondary-structure segment detection (Peleg default: 5)"""

    MAX_GAP: int = int(os.getenv("MAX_GAP", "3"))
    """Maximum gap to merge across in segment detection (Peleg default: 3)"""

    # Wave B (B.4): per-sequence S4PRED length cap.
    # Source: docs/active/UNIPROT_TIMEOUT_INVESTIGATION.md — APP (770 aa) on the
    # 5-model BiLSTM ensemble takes ~2 minutes alone; PVL is a peptide tool, so
    # any sequence longer than this is skipped with a warning surfaced via meta.
    #
    # Wave 2.6 (2026-06-03): Peleg confirmed via Drive that the pipeline's
    # appropriate maximum is 40 aa — above that the secondary-structure prediction
    # becomes a surface-vs-structure problem and the FF-Helix / SSW logic loses
    # meaning. Default dropped 100 → 40 to align with the peptide-tool framing.
    S4PRED_MAX_LENGTH: int = int(os.getenv("S4PRED_MAX_LENGTH", "40"))
    """Maximum sequence length S4PRED will run on (Wave 2.6 default: 40 aa, per Peleg). Sequences exceeding this are skipped with a `s4pred_skipped_long_seq` warning and the row's S4PRED fields stay null."""

    # ============================================================================
    # Wave 2.5 §LD2 — Large-dataset resilience
    # ============================================================================
    # Two budgets gate the upload pipeline against unbounded TANGO costs:
    #
    # - MAX_PEPTIDES_PER_RUN_WITH_TANGO: when ``len(df) > this``, TANGO is
    #   auto-disabled for this run and a ``tango_auto_disabled`` warning is
    #   appended to ``meta.warnings``. S4PRED + FF-Helix still run.
    # - MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO: a hard cap — when exceeded, the
    #   input DataFrame is truncated and a ``dataset_truncated`` warning is
    #   surfaced. Better than a silent OOM on a 50k-row paste.
    #
    # Both defaults come from Alex's concurrency-feedback backlog (LD2). Raise
    # via env var if your VPS has the headroom; lower it on shared hardware.

    MAX_PEPTIDES_PER_RUN_WITH_TANGO: int = int(os.getenv("MAX_PEPTIDES_PER_RUN_WITH_TANGO", "500"))
    """Budget for TANGO inclusion in a single upload run (default: 500).
    Above this, TANGO is auto-disabled and a ``tango_auto_disabled`` warning
    is surfaced — S4PRED + FF-Helix still run."""

    MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO: int = int(
        os.getenv("MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO", "5000")
    )
    """Hard cap on the total rows processed in a single upload run (default:
    5000). Above this, the input is truncated and a ``dataset_truncated``
    warning is surfaced. Tune downward on shared / low-memory hosts."""

    TANGO_PER_PEPTIDE_TIMEOUT_S: float = float(os.getenv("TANGO_PER_PEPTIDE_TIMEOUT_S", "60.0"))
    """Per-peptide TANGO wall-clock budget (default: 60 s). Effective only as
    a per-row guard inside the batch wrapper — the existing batch-level
    timeout (``tango_timeout`` in ``tango.py``) still applies."""

    # Group 2: Helical thresholds
    MIN_HELIX_PERCENT_CONTENT: float = float(os.getenv("MIN_HELIX_PERCENT_CONTENT", "0"))
    """Minimum % helix content (residues predicted helical) for helix classification (Peleg default: 0, range 0-100)"""

    # Group 3: Secondary-structure switch thresholds
    S4PRED_MAX_HELIX_BETA_DIFF: float = float(os.getenv("S4PRED_MAX_HELIX_BETA_DIFF", "0.03"))
    """S4PRED maximum helix-beta difference for SSW classification (Peleg default: 0.03 — "needs to be tested")"""

    TANGO_MAX_HELIX_BETA_DIFF: float = float(os.getenv("TANGO_MAX_HELIX_BETA_DIFF", "3"))
    """TANGO maximum helix-beta difference for SSW classification (Peleg default: 3 — "needs to be tested")"""

    MIN_SS_PERCENT_CONTENT: float = float(os.getenv("MIN_SS_PERCENT_CONTENT", "0"))
    """Minimum % secondary-structure content for SSW classification (Peleg default: 0, range 0-100)"""

    # ============================================================================
    # Sequence Length Guidance (from TANGO/S4PRED literature)
    # Advisory constants for frontend warnings — not hard enforcement.
    # ============================================================================

    PEPTIDE_LENGTH_WARN_MIN: int = 15
    """S4PRED unreliable below this length"""

    PEPTIDE_LENGTH_WARN_MAX: int = 40
    """TANGO accuracy degrades above this length. Wave 2.6 (2026-06-03): dropped 100 → 40 per Peleg — above 40 aa the calculation becomes a surface problem and the FF-Helix / SSW logic loses meaning."""

    PEPTIDE_LENGTH_OPTIMAL: int = 40
    """S4PRED supervised training minimum / pipeline upper bound (Peleg-confirmed 2026-06-03)."""

    PEPTIDE_LENGTH_TANGO_MIN: int = 5
    """TANGO absolute minimum sequence length"""

    # Wave 2.6 (2026-06-03): pipeline-appropriate sequence-length window per
    # Peleg's Drive answer. Hard upper bound = 40 aa (above this the secondary
    # structure prediction becomes a surface problem; FF-Helix / SSW logic loses
    # meaning). User-customisable override allowed only within [10, 40].
    PEPTIDE_LENGTH_HARD_MAX: int = int(os.getenv("PEPTIDE_LENGTH_HARD_MAX", "40"))
    """Hard upper bound on a single peptide sequence length (default: 40 aa, Peleg-set)."""

    PEPTIDE_LENGTH_USER_OVERRIDE_MIN: int = 10
    """Lowest value the user is allowed to set as their own length cap."""

    PEPTIDE_LENGTH_USER_OVERRIDE_MAX: int = 40
    """Highest value the user is allowed to set as their own length cap."""

    # ============================================================================
    # Celery / Redis Configuration
    # ============================================================================

    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    """Redis URL for Celery message broker (default: redis://localhost:6379/0)"""

    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
    """Redis URL for Celery result backend (default: redis://localhost:6379/1)"""

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    """Redis URL for general use (job tracking, etc.)"""

    CELERY_ENABLED: bool = _env_bool("CELERY_ENABLED", False)
    """Enable Celery async job processing (default: False — sync fallback)"""

    # ============================================================================
    # Debug Configuration
    # ============================================================================

    DEBUG_ENTRY: Optional[str] = os.getenv("DEBUG_ENTRY", "").strip() or None
    """Debug entry ID for tracing specific peptide through pipeline (optional)"""

    # ============================================================================
    # Vector similarity search — Wave 2 §D (ADR-016: LanceDB embedded)
    # ============================================================================
    # The vector store is an in-process LanceDB. Auto-indexing is best-effort:
    # any failure (missing model, no internet on first model download, disk full,
    # etc.) is logged and analysis still succeeds. Disable entirely via
    # VECTOR_INDEX_ENABLED=0 — useful for environments with no GPU/internet
    # where the sentence-transformers model can't be loaded.

    VECTOR_INDEX_ENABLED: bool = _env_bool("VECTOR_INDEX_ENABLED", True)
    """Master switch for the LanceDB vector index. When False, both auto-indexing
    on ingest and the /api/peptides/similar route short-circuit (route returns an
    empty result list with method="disabled"). Set to 0 in environments where the
    embedding model cannot be loaded."""

    LANCE_DB_PATH: str = os.getenv("LANCE_DB_PATH", "").strip() or str(
        _REPO_ROOT / "data" / "lance"
    )
    """Filesystem path for the LanceDB Lance files. Default: <repo_root>/data/lance/.
    Volume-mount this directory in Docker so embeddings survive container restarts."""

    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local-esm2-8m").strip().lower()
    """Embedding provider for vector search. Currently supported: 'local-esm2-8m'
    (ESM-2 8M protein LM, 320-dim, CPU-fast). ADR-017 supersedes the provisional
    'local-minilm' choice (RB-003 showed generic English LMs produce biologically
    invalid embeddings for peptide sequences)."""

    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "facebook/esm2_t6_8M_UR50D")
    """HuggingFace model id for the local embedding provider. Default is
    Meta AI's ESM-2 8M (Lin et al., Science 2023). Override only if you have
    a domain-specific protein LM already cached on disk."""

    VECTOR_DIM: int = int(os.getenv("VECTOR_DIM", "320"))
    """Embedding vector dimension. Must match the provider; ESM-2 8M = 320.
    Changing this requires reindexing — Lance schema is dimension-locked.
    Use ``python -m backend.scripts.reindex_lance`` to migrate after swap."""

    # ============================================================================
    # Default Threshold Values (for threshold resolution service)
    # ============================================================================

    # Group 4: Fibril-formation thresholds (Peleg FIX-002)
    DEFAULT_MU_H_CUTOFF: float = float(os.getenv("DEFAULT_MU_H_CUTOFF", "0.5"))
    """Default uH (hydrophobic moment) threshold for FF-Helix classification (Peleg default: 0.5, range 0 to 3.26)"""

    DEFAULT_HYDRO_CUTOFF: float = float(os.getenv("DEFAULT_HYDRO_CUTOFF", "0.5"))
    """Default hydrophobicity threshold for FF-SSW classification (Peleg default: 0.5, range -1.01 to 2.25)"""

    DEFAULT_FF_HELIX_PERCENT_THRESHOLD: float = float(
        os.getenv("DEFAULT_FF_HELIX_PERCENT_THRESHOLD", "50.0")
    )
    """Default FF-Helix % threshold (default: 50.0)"""

    # PELEG-Q-FIX-002: "Agg Per-Residue %" threshold — keep or remove? Awaiting decision.
    # PELEG-Q-FIX-012: TANGO 5% threshold justification — citation needed or remove characterization.
    DEFAULT_AGG_THRESHOLD: float = float(os.getenv("DEFAULT_AGG_THRESHOLD", "5.0"))
    """Default TANGO aggregation hotspot threshold (default: 5.0%)"""

    DEFAULT_S4PRED_HELIX_MINIMUM: float = float(os.getenv("DEFAULT_S4PRED_HELIX_MINIMUM", "0"))
    """Default S4PRED helix % minimum for candidate filtering (default: 0)"""

    @property
    def default_thresholds(self) -> dict:
        """Get default threshold values as dict."""
        return {
            "muHCutoff": self.DEFAULT_MU_H_CUTOFF,
            "hydroCutoff": self.DEFAULT_HYDRO_CUTOFF,
            "ffHelixPercentThreshold": self.DEFAULT_FF_HELIX_PERCENT_THRESHOLD,
            "aggThreshold": self.DEFAULT_AGG_THRESHOLD,
            "s4predHelixMinimum": self.DEFAULT_S4PRED_HELIX_MINIMUM,
        }


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance."""
    return settings
