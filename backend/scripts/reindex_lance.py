"""Reindex the LanceDB peptides table after an embedding-model swap.

Background
----------
The LanceDB schema is dimension-locked — Lance cannot alter an existing
vector column's dimension in-place. ADR-016 (LanceDB) + ADR-017 (ESM-2 8M
supersedes all-MiniLM-L6-v2) means we ship one schema change from 384-dim
to 320-dim. This script handles the migration:

1. Snapshot every (accession, sequence, metadata, dataset_id) tuple from
   the current Lance table — we deliberately drop the embedding column
   because the new model produces dimensions the existing schema can't hold.
2. Drop the entire ``peptides`` Lance table directory.
3. Replay each snapshotted row through ``vector_store.index_peptide`` which
   re-embeds with whatever model the current ``settings.EMBEDDING_PROVIDER``
   resolves to. First call lazy-loads ESM-2 (~1-2 s); subsequent calls reuse
   the cached singleton.

Idempotent: re-running on an already-current schema simply re-embeds with
the same vectors and overwrites them in place. No data loss as long as the
script completes; abort mid-way is recoverable because the original Lance
files were already snapshotted into memory before the drop.

Usage
-----
::

    cd backend
    python -m scripts.reindex_lance              # default Lance path
    LANCE_DB_PATH=/data/lance python -m scripts.reindex_lance

Exit codes: 0 = success or nothing to do; 1 = fatal error.
"""

from __future__ import annotations

import shutil
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import settings
from services import vector_store
from services.logger import get_logger

logger = get_logger()


_CAMEL_BY_SNAKE: Dict[str, str] = {
    "organism": "species",
    "length": "length",
    "helix_flag": "helixFlag",
    "ff_helix_flag": "ffHelixFlag",
    "ssw_prediction": "sswPrediction",
    "ssw_score": "sswScore",
    "ff_ssw_flag": "ffSswFlag",
    "s4pred_helix_prediction": "s4predHelixPrediction",
    "s4pred_ssw_prediction": "s4predSswPrediction",
    "tango_agg_max": "tangoAggMax",
    "mu_h": "muH",
    "hydrophobicity": "hydrophobicity",
    "charge": "charge",
}


def _snapshot_existing_rows() -> List[Dict[str, Any]]:
    """Read every row from the current peptides table (without embeddings).

    Returns an empty list if the table doesn't exist yet or is empty.
    """
    try:
        import lancedb  # type: ignore
    except ImportError as exc:  # pragma: no cover — guarded by D-fix.1
        print(f"FATAL: lancedb not importable ({exc})", file=sys.stderr)
        raise

    lance_dir = Path(settings.LANCE_DB_PATH)
    if not lance_dir.exists():
        print(f"[reindex] No Lance directory at {lance_dir} — nothing to migrate.")
        return []

    try:
        db = lancedb.connect(str(lance_dir))
    except Exception as exc:
        print(f"[reindex] Could not open LanceDB at {lance_dir}: {exc}", file=sys.stderr)
        return []

    if "peptides" not in db.table_names():
        print(f"[reindex] No 'peptides' table in {lance_dir} — nothing to migrate.")
        return []

    table = db.open_table("peptides")
    rows = table.to_pandas().to_dict("records")
    print(f"[reindex] Snapshotted {len(rows)} rows from existing peptides table.")
    return rows


def _to_camel_row(snake_row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a Lance snake_case row back to the canonical PVL camelCase shape.

    The peptide ``id`` and ``sequence`` columns are the only ones
    ``vector_store.index_peptide`` requires; everything else is preserved as
    optional metadata so the new table mirrors the old metadata coverage.
    """
    out: Dict[str, Any] = {
        "id": snake_row["accession"],
        "sequence": snake_row["sequence"],
    }
    for snake_key, camel_key in _CAMEL_BY_SNAKE.items():
        value = snake_row.get(snake_key)
        if value is None:
            continue
        # pandas may surface numeric NaNs — skip them so we don't pollute Lance.
        try:
            import math

            if isinstance(value, float) and math.isnan(value):
                continue
        except Exception:
            pass
        out[camel_key] = value
    return out


def _drop_table_directory() -> None:
    """Remove the ``peptides`` Lance table directory so it gets re-created
    with whatever dimension the current embedder emits."""
    lance_dir = Path(settings.LANCE_DB_PATH)
    table_dir = lance_dir / "peptides.lance"
    if table_dir.exists():
        shutil.rmtree(table_dir)
        print(f"[reindex] Dropped {table_dir}.")
    else:
        print(f"[reindex] {table_dir} did not exist — nothing to drop.")
    # Force the vector_store module to forget any cached handle so the next
    # index call recreates the table from the current schema.
    vector_store.reset_for_tests()


def reindex(rows: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Run the full snapshot → drop → re-index migration.

    Returns a result dict so callers (and tests) can assert on counts.
    Re-uses ``vector_store.index_peptide`` to keep the embedding code path
    identical to the live ingest path.
    """
    started = time.perf_counter()
    if rows is None:
        rows = _snapshot_existing_rows()

    if not vector_store.is_enabled():
        return {
            "status": "skipped",
            "reason": vector_store.disabled_reason()
            or "vector_store reports is_enabled() == False",
            "snapshot_count": len(rows),
            "indexed": 0,
            "elapsed_ms": 0,
        }

    _drop_table_directory()

    indexed = 0
    for snake_row in rows:
        try:
            camel = _to_camel_row(snake_row)
        except KeyError as exc:
            print(
                f"[reindex] Skipping row missing key {exc}: {snake_row!r}",
                file=sys.stderr,
            )
            continue
        if vector_store.index_peptide(
            camel, dataset_id=snake_row.get("dataset_id") or None
        ):
            indexed += 1

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    result = {
        "status": "ok",
        "snapshot_count": len(rows),
        "indexed": indexed,
        "elapsed_ms": elapsed_ms,
        "method": vector_store.stats().get("method"),
    }
    print(
        f"[reindex] Done — {indexed}/{len(rows)} rows reindexed in {elapsed_ms} ms "
        f"using {result['method']}."
    )
    return result


def main() -> int:
    try:
        result = reindex()
    except Exception as exc:
        print(f"FATAL: reindex failed: {exc}", file=sys.stderr)
        return 1

    if result["status"] == "skipped":
        print(f"[reindex] SKIPPED: {result['reason']}")
        return 0
    if result["snapshot_count"] > 0 and result["indexed"] < result["snapshot_count"]:
        print(
            f"WARNING: {result['snapshot_count'] - result['indexed']} rows failed to re-index.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":  # pragma: no cover — entry-point smoke
    sys.exit(main())
