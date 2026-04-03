"""
Provider-level result cache using DuckDB.

Caches per-sequence provider outputs (TANGO, S4PRED, biochem, FF-Helix)
independently of threshold configuration. Thresholds are cohort-dependent
and always recomputed — the cache stores raw provider results only.

Concurrency: DuckDB is single-writer. Reads use a per-worker read-only
singleton. Writes acquire a FileLock and open a fresh connection.
Cache failures never block the pipeline.

Migration path: DuckDB now → PostgreSQL for K8s.
Only SQL change: INSERT OR REPLACE → INSERT ... ON CONFLICT DO UPDATE.
"""

import hashlib
import json
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from services.logger import log_info, log_warning

try:
    import duckdb
except ImportError:
    duckdb = None  # type: ignore[assignment]

try:
    from filelock import FileLock
except ImportError:
    FileLock = None  # type: ignore[assignment,misc]

# ---------------------------------------------------------------------------
# Cache directory (same as result_cache.py)
# ---------------------------------------------------------------------------
CACHE_DIR = Path("/data/cache") if Path("/data/cache").exists() else Path(".run_cache")
DB_PATH = CACHE_DIR / "provider_cache.duckdb"
LOCK_PATH = CACHE_DIR / "provider_cache.lock"

# ---------------------------------------------------------------------------
# Column groups — exact DataFrame column names per provider
# ---------------------------------------------------------------------------
TANGO_CACHE_COLS: List[str] = [
    "SSW fragments",
    "SSW score",
    "SSW diff",
    "SSW helix percentage",
    "SSW beta percentage",
    "Tango Beta curve",
    "Tango Helix curve",
    "Tango Turn curve",
    "Tango Aggregation curve",
    "Tango has data",
    "Tango Beta max",
    "Tango Helix max",
    "Tango Aggregation max",
    "Tango attempted",
]

S4PRED_CACHE_COLS: List[str] = [
    "Helix prediction (S4PRED)",
    "Helix fragments (S4PRED)",
    "Helix score (S4PRED)",
    "Helix percentage (S4PRED)",
    "SSW fragments (S4PRED)",
    "SSW score (S4PRED)",
    "SSW diff (S4PRED)",
    "SSW helix percentage (S4PRED)",
    "SSW beta percentage (S4PRED)",
    "SSW percentage (S4PRED)",
    "S4PRED P_H curve",
    "S4PRED P_E curve",
    "S4PRED P_C curve",
    "S4PRED SS prediction",
]

BIOCHEM_CACHE_COLS: List[str] = [
    "Charge",
    "Hydrophobicity",
    "Full length uH",
    "Helix (Jpred) uH",
    "Beta full length uH",
]

FF_HELIX_CACHE_COLS: List[str] = [
    "FF-Helix %",
    "FF Helix fragments",
]

ALL_PROVIDER_GROUPS = [
    ("tango", TANGO_CACHE_COLS),
    ("s4pred", S4PRED_CACHE_COLS),
    ("biochem", BIOCHEM_CACHE_COLS),
    ("ff_helix", FF_HELIX_CACHE_COLS),
]

# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------
_read_local = threading.local()


def _ensure_table(conn: "duckdb.DuckDBPyConnection") -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS provider_cache (
            seq_hash      VARCHAR PRIMARY KEY,
            sequence      VARCHAR NOT NULL,
            tango_json    VARCHAR,
            s4pred_json   VARCHAR,
            biochem_json  VARCHAR,
            ff_helix_json VARCHAR,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def _get_read_conn() -> "duckdb.DuckDBPyConnection":
    """Thread-local read connection. Reopened if stale."""
    conn = getattr(_read_local, "conn", None)
    path = getattr(_read_local, "path", None)
    current = str(DB_PATH)

    if conn is not None and path == current:
        try:
            conn.execute("SELECT 1")
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(current, read_only=False)
    _ensure_table(conn)
    _read_local.conn = conn
    _read_local.path = current
    return conn


def _write_locked(statements: List[Tuple[str, list]]) -> None:
    """Execute SQL statements under a file lock with a fresh connection."""
    if FileLock is None:
        # No filelock available — use read conn with best-effort
        conn = _get_read_conn()
        for sql, params in statements:
            conn.execute(sql, params)
        return

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(LOCK_PATH), timeout=10)
    with lock:
        conn = duckdb.connect(str(DB_PATH))
        try:
            _ensure_table(conn)
            for sql, params in statements:
                conn.execute(sql, params)
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# Key generation
# ---------------------------------------------------------------------------
def seq_hash(sequence: str) -> str:
    """Deterministic cache key from normalized sequence. No threshold dependency."""
    return hashlib.sha256(sequence.strip().upper().encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# JSON serialization helpers
# ---------------------------------------------------------------------------
def _to_json_safe(val: Any) -> Any:
    """Convert numpy/pandas types to native Python for JSON serialization."""
    if val is None:
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, np.bool_):
        return bool(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    if isinstance(val, (list, tuple)):
        return [_to_json_safe(v) for v in val]
    if isinstance(val, float) and (val != val or val == float("inf") or val == float("-inf")):
        return None
    return val


def _serialize_provider(df_row: pd.Series, cols: List[str], all_cols: pd.Index) -> Optional[str]:
    """Serialize provider columns from a DataFrame row to JSON string."""
    data: Dict[str, Any] = {}
    for col in cols:
        if col in all_cols:
            data[col] = _to_json_safe(df_row[col])
    return json.dumps(data) if data else None


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------
def bulk_get_provider_cache(
    sequences: List[str],
) -> Dict[str, Dict[str, Optional[Dict[str, Any]]]]:
    """
    Look up cached provider results for a batch of sequences.

    Returns dict mapping seq_hash -> {
        "tango": {col: val, ...} or None,
        "s4pred": {...} or None,
        "biochem": {...} or None,
        "ff_helix": {...} or None,
    }
    Missing sequences are absent from the dict.
    """
    if not sequences or duckdb is None:
        return {}

    try:
        # Deduplicate
        unique_seqs = list(set(s.strip().upper() for s in sequences if s))
        if not unique_seqs:
            return {}

        hashes = [seq_hash(s) for s in unique_seqs]

        conn = _get_read_conn()
        placeholders = ",".join(["?"] * len(hashes))
        rows = conn.execute(
            f"SELECT seq_hash, tango_json, s4pred_json, biochem_json, ff_helix_json "
            f"FROM provider_cache WHERE seq_hash IN ({placeholders})",
            hashes,
        ).fetchall()

        result: Dict[str, Dict[str, Optional[Dict[str, Any]]]] = {}
        for row in rows:
            h, tango_j, s4pred_j, biochem_j, ff_j = row
            result[h] = {
                "tango": json.loads(tango_j) if tango_j else None,
                "s4pred": json.loads(s4pred_j) if s4pred_j else None,
                "biochem": json.loads(biochem_j) if biochem_j else None,
                "ff_helix": json.loads(ff_j) if ff_j else None,
            }
        return result
    except Exception as e:
        log_warning("provider_cache_get_error", f"Cache read error: {e}")
        return {}


def bulk_set_provider_cache(entries: List[Dict[str, Any]]) -> int:
    """
    Write provider results for multiple sequences.

    Each entry: {
        "sequence": str,
        "tango_json": Optional[str],
        "s4pred_json": Optional[str],
        "biochem_json": Optional[str],
        "ff_helix_json": Optional[str],
    }

    Uses INSERT OR REPLACE for simplicity. Returns number of rows written.
    """
    if not entries or duckdb is None:
        return 0

    try:
        statements: List[Tuple[str, list]] = []
        for entry in entries:
            seq = entry["sequence"]
            h = seq_hash(seq)
            statements.append(
                (
                    """INSERT OR REPLACE INTO provider_cache
                   (seq_hash, sequence, tango_json, s4pred_json, biochem_json, ff_helix_json, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
                    [
                        h,
                        seq,
                        entry.get("tango_json"),
                        entry.get("s4pred_json"),
                        entry.get("biochem_json"),
                        entry.get("ff_helix_json"),
                    ],
                )
            )
        _write_locked(statements)
        return len(entries)
    except Exception as e:
        log_warning("provider_cache_set_error", f"Cache write error: {e}")
        return 0


# ---------------------------------------------------------------------------
# DataFrame split/merge helpers
# ---------------------------------------------------------------------------
def split_cached_uncached(
    df: pd.DataFrame,
    need_tango: bool,
    need_s4pred: bool,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split DataFrame into cache-hit rows and cache-miss rows.
    Hit rows get cached provider columns injected.

    A row is a "hit" only if ALL requested providers have cached data.
    FF-Helix and biochem are always required for a hit.

    Returns (df_hits, df_misses) with original index preserved.
    """
    if duckdb is None or df.empty:
        return pd.DataFrame(columns=df.columns), df

    sequences = df["Sequence"].astype(str).str.strip().str.upper().tolist()
    cache_map = bulk_get_provider_cache(sequences)

    if not cache_map:
        return pd.DataFrame(columns=df.columns), df

    # Build hash series for the df
    hashes = [seq_hash(s) for s in sequences]

    hit_indices = []
    miss_indices = []

    for i, (idx, h) in enumerate(zip(df.index, hashes)):
        entry = cache_map.get(h)
        if entry is None:
            miss_indices.append(idx)
            continue

        is_hit = True
        if need_tango and entry.get("tango") is None:
            is_hit = False
        if need_s4pred and entry.get("s4pred") is None:
            is_hit = False
        if entry.get("biochem") is None:
            is_hit = False
        # ff_helix is fast, don't gate on it

        if is_hit:
            hit_indices.append(idx)
        else:
            miss_indices.append(idx)

    if not hit_indices:
        return pd.DataFrame(columns=df.columns), df

    df_hits = df.loc[hit_indices].copy()
    df_misses = df.loc[miss_indices].copy() if miss_indices else pd.DataFrame(columns=df.columns)

    # Ensure all provider columns exist with object dtype (needed for list values like curves)
    all_cache_cols: List[str] = []
    for _, cols in ALL_PROVIDER_GROUPS:
        all_cache_cols.extend(cols)
    for col in all_cache_cols:
        if col not in df_hits.columns:
            df_hits[col] = pd.Series([None] * len(df_hits), index=df_hits.index, dtype=object)

    # Inject cached columns into df_hits
    hit_hashes = {idx: hashes[list(df.index).index(idx)] for idx in hit_indices}

    for idx in hit_indices:
        h = hit_hashes[idx]
        entry = cache_map[h]
        for provider_key, cols in ALL_PROVIDER_GROUPS:
            pdata = entry.get(provider_key)
            if pdata:
                for col in cols:
                    if col in pdata:
                        # Use object-typed column to safely store lists/arrays
                        df_hits.at[idx, col] = pdata[col]

    return df_hits, df_misses


def write_computed_to_cache(df: pd.DataFrame) -> None:
    """
    Extract provider columns from a computed DataFrame and write to cache.
    Called after TANGO + S4PRED + biochem have run on the miss subset.
    """
    if duckdb is None or df.empty:
        return

    try:
        entries: List[Dict[str, Any]] = []
        all_cols = df.columns

        for _, row in df.iterrows():
            seq = str(row.get("Sequence", "")).strip().upper()
            if not seq:
                continue

            entry: Dict[str, Any] = {"sequence": seq}
            entry["tango_json"] = _serialize_provider(row, TANGO_CACHE_COLS, all_cols)
            entry["s4pred_json"] = _serialize_provider(row, S4PRED_CACHE_COLS, all_cols)
            entry["biochem_json"] = _serialize_provider(row, BIOCHEM_CACHE_COLS, all_cols)
            entry["ff_helix_json"] = _serialize_provider(row, FF_HELIX_CACHE_COLS, all_cols)
            entries.append(entry)

        if entries:
            written = bulk_set_provider_cache(entries)
            log_info("provider_cache_write", f"Cached {written} sequences")
    except Exception as e:
        log_warning("provider_cache_write_error", f"Cache write error: {e}")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
def provider_cache_stats() -> Dict[str, Any]:
    """Return provider cache statistics."""
    if duckdb is None:
        return {"total_entries": 0, "error": "duckdb not available"}

    try:
        conn = _get_read_conn()
        total = conn.execute("SELECT COUNT(*) FROM provider_cache").fetchone()
        with_tango = conn.execute(
            "SELECT COUNT(*) FROM provider_cache WHERE tango_json IS NOT NULL"
        ).fetchone()
        with_s4pred = conn.execute(
            "SELECT COUNT(*) FROM provider_cache WHERE s4pred_json IS NOT NULL"
        ).fetchone()
        with_biochem = conn.execute(
            "SELECT COUNT(*) FROM provider_cache WHERE biochem_json IS NOT NULL"
        ).fetchone()

        db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0

        return {
            "total_entries": total[0] if total else 0,
            "entries_with_tango": with_tango[0] if with_tango else 0,
            "entries_with_s4pred": with_s4pred[0] if with_s4pred else 0,
            "entries_with_biochem": with_biochem[0] if with_biochem else 0,
            "db_size_bytes": db_size,
        }
    except Exception as e:
        return {"total_entries": 0, "error": str(e)}
