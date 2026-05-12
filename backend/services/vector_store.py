"""LanceDB-backed vector similarity store for PVL peptides (Wave 2 §D, ADR-016).

This module is the only seam between PVL and the embedding/vector tooling. The
rest of the codebase calls three functions:

- ``index_peptide(row)`` — best-effort upsert of a peptide row's embedding.
  Called from the analysis pipeline after a row has been classified. Failures
  here NEVER raise to the caller — the API contract is "analysis succeeded";
  the index is observability infrastructure, not a critical path.
- ``find_similar(reference_id, k, dataset_id=None)`` — return the k peptides
  most similar to the reference, ordered by cosine distance ascending.
- ``is_enabled()`` — quick check for routes/tests that need to know whether
  the index is available (or has been disabled via env var).

Storage: Apache 2.0 LanceDB embedded — no separate process, no port, no Docker
sidecar. Lance files live under ``settings.LANCE_DB_PATH`` (default
``<repo_root>/data/lance``) and survive container restarts via volume mount.

Embedding: ESM-2 8M via HuggingFace ``transformers`` (default
``facebook/esm2_t6_8M_UR50D``, 320-dim, CPU). The model is loaded lazily on
the first ``index_peptide`` / ``find_similar`` call and cached as a
module-level singleton (~150-250 MB RAM, ~30 MB on disk after first download).
Tests should call ``set_embedder(...)`` to inject a deterministic fake
embedder so they don't download HuggingFace weights at CI time. See ADR-017
and RB-003 for the rationale behind the protein-LM choice.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable, Dict, List, Optional

from config import settings
from services.logger import log_error, log_info, log_warning

# ---------------------------------------------------------------------------
# Internal state — guarded by a single lock so concurrent FastAPI requests
# can't race on the lazy-init path. LanceDB itself is process-local; we don't
# need cross-process locking here (each uvicorn worker initializes its own
# handle and Lance files use atomic rename for writes).
# ---------------------------------------------------------------------------

_LOCK = threading.Lock()
_TABLE: Optional[Any] = None
_EMBEDDER: Optional[Callable[[str], List[float]]] = None
_DISABLED_REASON: Optional[str] = None  # if non-None, indexing/search short-circuit

_TABLE_NAME = "peptides"

# Schema-stored metadata fields (kept narrow on purpose — at <100k peptides
# we don't need the entire PeptideRow shape, just what the UI's
# SimilarPeptidesInspector pills + reference card render).
_METADATA_FIELDS: tuple[str, ...] = (
    "organism",
    "length",
    "helix_flag",
    "ff_helix_flag",
    "ssw_prediction",
    "ssw_score",
    "ff_ssw_flag",
    "s4pred_helix_prediction",
    "s4pred_ssw_prediction",
    "tango_agg_max",
    "mu_h",
    "hydrophobicity",
    "charge",
    "dataset_id",
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def is_enabled() -> bool:
    """Whether the vector index is available for reads/writes.

    Returns False when ``VECTOR_INDEX_ENABLED=0`` or a previous lazy-init
    attempt failed (missing dependency, model download error, disk full).
    """
    if not settings.VECTOR_INDEX_ENABLED:
        return False
    return _DISABLED_REASON is None


def disabled_reason() -> Optional[str]:
    """Why the index is not currently usable (None = it is usable)."""
    if not settings.VECTOR_INDEX_ENABLED:
        return "VECTOR_INDEX_ENABLED=0"
    return _DISABLED_REASON


def set_embedder(fn: Optional[Callable[[str], List[float]]]) -> None:
    """Override the embedder — used by tests to inject a deterministic fake.

    Pass ``None`` to clear the override and fall back to the configured
    sentence-transformers model on the next call.
    """
    global _EMBEDDER
    with _LOCK:
        _EMBEDDER = fn


def reset_for_tests() -> None:
    """Drop the cached LanceDB handle + embedder + disabled-state.

    Tests that point ``LANCE_DB_PATH`` at a tmpdir must call this so the
    next operation re-opens against the new path.
    """
    global _TABLE, _EMBEDDER, _DISABLED_REASON
    with _LOCK:
        _TABLE = None
        _EMBEDDER = None
        _DISABLED_REASON = None


def index_peptide(row: Dict[str, Any], dataset_id: Optional[str] = None) -> bool:
    """Upsert a peptide row into the vector index. Best-effort.

    Returns True on success, False if anything went wrong (missing fields,
    embedder failure, LanceDB write error). Errors are logged but never
    raised — the analysis API response is the contract; indexing is not.

    The row is the camelCase PVL row shape (PeptideRow); we read the small
    subset of fields LanceDB stores. Re-indexing the same accession overwrites.
    """
    if not is_enabled():
        return False

    accession = _str_field(row, "id", "Entry", "accession")
    sequence = _str_field(row, "sequence", "Sequence")
    if not accession or not sequence:
        log_warning(
            "vector_index_skip_missing_keys",
            "Skipping vector index — row missing id/sequence",
            id=accession,
        )
        return False

    try:
        embedder = _ensure_embedder()
        if embedder is None:
            return False
        embedding = embedder(sequence)
        if len(embedding) != settings.VECTOR_DIM:
            log_warning(
                "vector_index_dim_mismatch",
                f"Embedder returned {len(embedding)} dims, expected {settings.VECTOR_DIM}",
                id=accession,
            )
            return False

        record = {
            "accession": accession,
            "sequence": sequence,
            "embedding": list(embedding),
            "dataset_id": dataset_id or _str_field(row, "datasetId", "dataset_id"),
            "indexed_at": time.time(),
            **{
                field: _coerce_metadata_value(row, field)
                for field in _METADATA_FIELDS
                if field != "dataset_id"
            },
        }

        table = _ensure_table(record)
        if table is None:
            return False

        # Upsert: LanceDB <0.6 doesn't ship merge_insert, so emulate via
        # delete-then-add. Quote the accession defensively because Lance's
        # SQL filter doesn't tolerate embedded apostrophes; PVL accessions
        # are alphanumeric + underscore + hyphen so escaping is sufficient.
        safe_accession = accession.replace("'", "''")
        try:
            table.delete(f"accession = '{safe_accession}'")
        except Exception:
            # Empty table or deletion-not-supported edge — proceed to add.
            pass
        table.add([record])
        return True
    except Exception as exc:
        log_warning(
            "vector_index_failed",
            f"Indexing peptide failed (best-effort): {exc}",
            id=accession,
            error=str(exc),
        )
        return False


def index_rows(rows: List[Dict[str, Any]], dataset_id: Optional[str] = None) -> int:
    """Best-effort batch upsert. Returns the number of rows successfully indexed."""
    if not is_enabled():
        return 0
    indexed = 0
    for row in rows:
        if index_peptide(row, dataset_id=dataset_id):
            indexed += 1
    return indexed


def find_similar(
    reference_id: str,
    k: int = 10,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Return up to k peptides most similar to ``reference_id``.

    Response shape:
        {
            "results": [
                {"accession": str, "sequence": str, "distance": float, "metadata": {...}},
                ...
            ],
            "method": str,                # e.g. "lancedb+local-esm2-8m"
            "elapsed_ms": int,
            "disabled_reason": str | None,
        }

    The reference peptide itself is never returned. If the reference is not
    in the index, ``results`` is empty (not an error). If the index is
    disabled, ``disabled_reason`` is set and ``results`` is empty.
    """
    started = time.perf_counter()
    if not is_enabled():
        return {
            "results": [],
            "method": "disabled",
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "disabled_reason": disabled_reason(),
        }

    method = _method_string()

    try:
        table = _ensure_table()
        if table is None:
            return {
                "results": [],
                "method": method,
                "elapsed_ms": int((time.perf_counter() - started) * 1000),
                "disabled_reason": disabled_reason(),
            }

        safe_ref = reference_id.replace("'", "''")
        ref_rows = table.search().where(f"accession = '{safe_ref}'").limit(1).to_list()
        if not ref_rows:
            return {
                "results": [],
                "method": method,
                "elapsed_ms": int((time.perf_counter() - started) * 1000),
                "disabled_reason": None,
            }
        ref_embedding = ref_rows[0]["embedding"]

        query = table.search(ref_embedding).where(f"accession != '{safe_ref}'").limit(k)
        if dataset_id is not None:
            safe_ds = dataset_id.replace("'", "''")
            query = query.where(f"dataset_id = '{safe_ds}'")

        rows = query.to_list()
        results: List[Dict[str, Any]] = []
        for row in rows:
            metadata = {field: row.get(field) for field in _METADATA_FIELDS if field in row}
            results.append(
                {
                    "accession": row["accession"],
                    "sequence": row["sequence"],
                    "distance": float(row.get("_distance", 0.0)),
                    "metadata": metadata,
                }
            )
        return {
            "results": results,
            "method": method,
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "disabled_reason": None,
        }
    except Exception as exc:
        log_error(
            "vector_search_failed",
            f"Vector search failed: {exc}",
            reference_id=reference_id,
            error=str(exc),
        )
        return {
            "results": [],
            "method": method,
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "disabled_reason": f"search_error: {exc}",
        }


def stats() -> Dict[str, Any]:
    """Return basic stats about the index — exposed by routes for diagnostics."""
    info: Dict[str, Any] = {
        "enabled": is_enabled(),
        "disabled_reason": disabled_reason(),
        "method": _method_string(),
        "lance_path": settings.LANCE_DB_PATH,
        "vector_dim": settings.VECTOR_DIM,
        "row_count": None,
    }
    if not is_enabled():
        return info
    try:
        table = _ensure_table()
        if table is not None:
            info["row_count"] = table.count_rows()
    except Exception as exc:
        info["row_count_error"] = str(exc)
    return info


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _method_string() -> str:
    return f"lancedb+{settings.EMBEDDING_PROVIDER}"


def _str_field(row: Dict[str, Any], *keys: str) -> Optional[str]:
    """Return the first non-empty string under any of the given keys."""
    for key in keys:
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _coerce_metadata_value(row: Dict[str, Any], field: str) -> Any:
    """Look up a metadata field by snake_case OR PVL camelCase alias."""
    camel_aliases = {
        "helix_flag": ("helixFlag",),
        "ff_helix_flag": ("ffHelixFlag",),
        "ssw_prediction": ("sswPrediction",),
        "ssw_score": ("sswScore",),
        "ff_ssw_flag": ("ffSswFlag",),
        "s4pred_helix_prediction": ("s4predHelixPrediction",),
        "s4pred_ssw_prediction": ("s4predSswPrediction",),
        "tango_agg_max": ("tangoAggMax",),
        "mu_h": ("muH",),
        "hydrophobicity": ("hydrophobicity",),
        "charge": ("charge",),
        "organism": ("organism", "species", "Organism"),
        "length": ("length", "Length"),
        "dataset_id": ("datasetId",),
    }
    candidates = (field,) + camel_aliases.get(field, ())
    for key in candidates:
        if key in row and row[key] is not None:
            return row[key]
    return None


def _ensure_embedder() -> Optional[Callable[[str], List[float]]]:
    """Return the active embedder (test-injected or lazy-loaded model)."""
    global _EMBEDDER, _DISABLED_REASON
    if _EMBEDDER is not None:
        return _EMBEDDER
    with _LOCK:
        if _EMBEDDER is not None:
            return _EMBEDDER
        provider = settings.EMBEDDING_PROVIDER
        try:
            if provider in ("local-esm2-8m", "local-esm2"):
                _EMBEDDER = _build_local_esm2_embedder()
            else:
                raise ValueError(
                    f"Unsupported EMBEDDING_PROVIDER: {provider!r}. "
                    "Currently supported: 'local-esm2-8m' (ADR-017)."
                )
        except Exception as exc:
            _DISABLED_REASON = f"embedder_init_failed: {exc}"
            log_warning(
                "vector_embedder_disabled",
                f"Vector index disabled — embedder init failed: {exc}",
                provider=provider,
            )
            return None
        return _EMBEDDER


def _build_local_esm2_embedder() -> Callable[[str], List[float]]:
    """Lazy-load ESM-2 from HuggingFace transformers (ADR-017).

    Default model is ``facebook/esm2_t6_8M_UR50D`` — Meta AI's smallest ESM-2
    checkpoint (Lin et al., Science 2023), 320-dim residue embeddings, ~30 MB
    on disk, ~150-250 MB RAM loaded, CPU inference ~10-50 ms per 5-100 AA
    peptide. Sequence embedding is the mean over residue embeddings excluding
    the special ``<cls>`` / ``<eos>`` tokens; the result is L2-normalized so
    Lance's default L2 vector index behaves like cosine similarity.

    Loaded once and cached as a module-level singleton (the ``_EMBEDDER`` slot
    in ``_ensure_embedder``); first call pays the ~1-2 s model-load cost,
    subsequent calls reuse the in-memory model.
    """
    import torch  # type: ignore
    from transformers import AutoModel, AutoTokenizer  # type: ignore

    model_name = settings.EMBEDDING_MODEL_NAME
    log_info("vector_embedder_load_start", f"Loading {model_name}", model=model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()
    log_info("vector_embedder_load_ok", f"{model_name} ready", model=model_name)

    def _encode(text: str) -> List[float]:
        # ESM-2 expects raw single-letter AA sequences. ``add_special_tokens``
        # wraps with <cls> at index 0 and <eos> at the last position; we strip
        # both before mean-pooling so the embedding represents only the
        # peptide residues. ``torch.no_grad`` skips autograd bookkeeping for
        # CPU-only inference speed.
        inputs = tokenizer(text, return_tensors="pt", add_special_tokens=True)
        with torch.no_grad():
            outputs = model(**inputs)
        hidden = outputs.last_hidden_state[0]  # [seq_len, hidden_dim]
        # ``hidden[1:-1]`` drops <cls> and <eos>. For a single-residue peptide
        # this slice would be empty — extremely rare in PVL (min peptide
        # length is 2) but guard anyway by falling back to the full hidden.
        residue_hidden = hidden[1:-1] if hidden.shape[0] > 2 else hidden
        mean_embedding = residue_hidden.mean(dim=0)
        # Normalize so cosine ≡ L2 on the unit sphere (Lance default index).
        norm = mean_embedding.norm(p=2)
        if norm > 0:
            mean_embedding = mean_embedding / norm
        return mean_embedding.cpu().tolist()

    return _encode


def _ensure_table(seed_record: Optional[Dict[str, Any]] = None) -> Optional[Any]:
    """Open or create the Lance table. Returns None on any setup failure."""
    global _TABLE, _DISABLED_REASON
    if _TABLE is not None:
        return _TABLE
    with _LOCK:
        if _TABLE is not None:
            return _TABLE
        try:
            import lancedb  # type: ignore
        except Exception as exc:
            _DISABLED_REASON = f"lancedb_import_failed: {exc}"
            log_warning(
                "vector_lancedb_disabled",
                f"Vector index disabled — lancedb import failed: {exc}",
            )
            return None

        try:
            import os

            os.makedirs(settings.LANCE_DB_PATH, exist_ok=True)
            db = lancedb.connect(settings.LANCE_DB_PATH)
            if _TABLE_NAME in db.table_names():
                _TABLE = db.open_table(_TABLE_NAME)
            else:
                # Lance needs at least one record to infer the schema. If the
                # caller supplied a real record (the indexing path), seed with
                # it; if not (the search path on a fresh db), we have nothing
                # to read and ``_TABLE`` stays None.
                if seed_record is None:
                    return None
                _TABLE = db.create_table(_TABLE_NAME, data=[seed_record])
            log_info(
                "vector_table_ready",
                f"Lance table {_TABLE_NAME!r} ready at {settings.LANCE_DB_PATH}",
                lance_path=settings.LANCE_DB_PATH,
            )
            return _TABLE
        except Exception as exc:
            _DISABLED_REASON = f"lance_table_init_failed: {exc}"
            log_warning(
                "vector_table_disabled",
                f"Vector index disabled — lance table init failed: {exc}",
            )
            return None


__all__ = [
    "disabled_reason",
    "find_similar",
    "index_peptide",
    "index_rows",
    "is_enabled",
    "reset_for_tests",
    "set_embedder",
    "stats",
]
