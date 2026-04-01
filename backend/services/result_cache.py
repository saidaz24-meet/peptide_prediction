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


def _get_conn() -> duckdb.DuckDBPyConnection:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prediction_cache (
            cache_key VARCHAR PRIMARY KEY,
            sequence VARCHAR NOT NULL,
            result_json VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            threshold_hash VARCHAR
        )
    """)
    return conn


def cache_key(sequence: str, threshold_config: Optional[Dict[str, Any]] = None) -> str:
    """Generate a deterministic cache key from sequence + threshold config."""
    payload = sequence.upper().strip()
    if threshold_config:
        payload += json.dumps(threshold_config, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def get_cached(key: str) -> Optional[Dict[str, Any]]:
    """Look up a cached prediction result. Returns None on miss."""
    conn = _get_conn()
    try:
        result = conn.execute(
            "SELECT result_json FROM prediction_cache WHERE cache_key = ?", [key]
        ).fetchone()
        if result:
            return json.loads(result[0])
        return None
    finally:
        conn.close()


def set_cached(
    key: str,
    sequence: str,
    result: Dict[str, Any],
    threshold_hash: str = "",
) -> None:
    """Store a prediction result in the cache."""
    conn = _get_conn()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO prediction_cache
               (cache_key, sequence, result_json, threshold_hash)
               VALUES (?, ?, ?, ?)""",
            [key, sequence, json.dumps(result), threshold_hash],
        )
    finally:
        conn.close()


def cache_stats() -> Dict[str, Any]:
    """Return basic cache statistics."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT COUNT(*) FROM prediction_cache").fetchone()
        return {"total_entries": row[0] if row else 0}
    finally:
        conn.close()
