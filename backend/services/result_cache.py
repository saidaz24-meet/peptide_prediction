"""
Disk-backed prediction cache using DuckDB.

Key: SHA256(sequence + threshold_config_hash)
Value: serialized prediction result (JSON)
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

import duckdb

CACHE_DIR = Path("/data/cache") if Path("/data/cache").exists() else Path(".run_cache")
DB_PATH = CACHE_DIR / "predictions.duckdb"

# Singleton connection — DuckDB is thread-safe for reads, and we serialize writes.
# Avoids creating a new connection (+ table check) per call.
_conn: Optional[duckdb.DuckDBPyConnection] = None
_conn_path: Optional[str] = None


def _reset_conn() -> None:
    """Reset singleton connection (used by tests when CACHE_DIR/DB_PATH change)."""
    global _conn, _conn_path
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
    _conn = None
    _conn_path = None


def _get_conn() -> duckdb.DuckDBPyConnection:
    global _conn, _conn_path
    current_path = str(DB_PATH)
    if _conn is not None and _conn_path == current_path:
        try:
            _conn.execute("SELECT 1")
            return _conn
        except Exception:
            _conn = None
    # Path changed or connection dead — create new connection
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _conn = duckdb.connect(str(DB_PATH))
    _conn_path = str(DB_PATH)
    _conn.execute("""
        CREATE TABLE IF NOT EXISTS prediction_cache (
            cache_key VARCHAR PRIMARY KEY,
            sequence VARCHAR NOT NULL,
            result_json VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            threshold_hash VARCHAR
        )
    """)
    return _conn


def cache_key(sequence: str, threshold_config: Optional[Dict[str, Any]] = None) -> str:
    """Generate a deterministic cache key from sequence + threshold config."""
    payload = sequence.upper().strip()
    if threshold_config:
        payload += json.dumps(threshold_config, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def get_cached(key: str) -> Optional[Dict[str, Any]]:
    """Look up a cached prediction result. Returns None on miss or error."""
    try:
        conn = _get_conn()
        result = conn.execute(
            "SELECT result_json FROM prediction_cache WHERE cache_key = ?", [key]
        ).fetchone()
        if result:
            return json.loads(result[0])
    except Exception:
        pass
    return None


def set_cached(
    key: str,
    sequence: str,
    result: Dict[str, Any],
    threshold_hash: str = "",
) -> None:
    """Store a prediction result in the cache. Silently fails on lock errors."""
    try:
        conn = _get_conn()
        conn.execute(
            """INSERT OR REPLACE INTO prediction_cache
               (cache_key, sequence, result_json, threshold_hash)
               VALUES (?, ?, ?, ?)""",
            [key, sequence, json.dumps(result), threshold_hash],
        )
    except Exception:
        pass


def cache_stats() -> Dict[str, Any]:
    """Return basic cache statistics."""
    try:
        conn = _get_conn()
        row = conn.execute("SELECT COUNT(*) FROM prediction_cache").fetchone()
        return {"total_entries": row[0] if row else 0}
    except Exception:
        return {"total_entries": 0, "error": "cache unavailable"}
