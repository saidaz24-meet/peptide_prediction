#!/usr/bin/env python3
"""
precompute_dataset.py — pre-run the PVL pipeline on a curated reference
dataset and save the normalized API response as a JSON artifact so the
"Try example" UX is instant.

M2 (Peleg 2026-06-18 meeting): Peleg-118 + gold + Uperin should load
in <2s instead of waiting for live TANGO + S4PRED runs.

Usage::

    cd backend
    USE_TANGO=1 USE_S4PRED=1 python scripts/precompute_dataset.py peleg_118

The dataset_id maps to a *reference* JSON in
``backend/data/reference_datasets/<dataset_id>_fibril_validated.json``
(input peptides) and the output is written to
``backend/data/precomputed/<dataset_id>.json`` (same shape as
``POST /api/predict/batch`` returns).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Ensure backend/ is on sys.path so we can import the same modules the API uses.
HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

# Pin numeric thread counts BEFORE torch / numpy import.
import pandas as pd  # noqa: E402

import _perf_init  # noqa: F401, E402
from services.dataframe_utils import require_cols  # noqa: E402
from services.normalize import normalize_cols  # noqa: E402
from services.upload_service import process_upload_dataframe  # noqa: E402

# ── Dataset registry ──────────────────────────────────────────────────────

DATASETS: Dict[str, Dict[str, Any]] = {
    "peleg_118": {
        "title": "Peleg-118 — Experimentally validated fibril-forming peptides (≤40 aa)",
        "source": HERE / "data" / "reference_datasets" / "peleg_118_fibril_validated.json",
        "output": HERE / "data" / "precomputed" / "peleg_118.json",
    },
    # Gold-standard benchmark — the 2,916-peptide Staphylococcus aureus 2023
    # set the demo flow auto-loads on first visit. Without this precompute the
    # demo path runs TANGO + S4PRED live on 2,916 sequences (~20 min on a
    # warm VPS, 30+ min cold). The artifact is also served as
    # /api/precomputed/gold_standard and surfaced via a Compare-page chip.
    "gold_standard": {
        "title": "Gold-standard benchmark — Staphylococcus aureus 2023 (2,916 peptides)",
        "source": HERE.parent / "ui" / "public" / "Final_Staphylococcus_2023_new.xlsx",
        "output": HERE / "data" / "precomputed" / "gold_standard.json",
    },
}


# ── Loader ────────────────────────────────────────────────────────────────


def load_reference(path: Path) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Load a reference dataset and return (DataFrame, meta).

    Supports two input formats — chosen by suffix:
      - ``.json``  → schema described in
        ``backend/data/reference_datasets/README.md`` (peptides list with
        id / sequence / uniprot_id / organism / general_category fields).
      - ``.xlsx``  → arbitrary Excel with at minimum an ``Entry`` /
        ``Sequence`` column pair (or any of normalize_cols's synonyms).

    The DataFrame has Entry / Sequence / Length columns, matching what
    ``process_upload_dataframe`` expects.
    """
    suffix = path.suffix.lower()

    if suffix == ".xlsx":
        df = pd.read_excel(path)
        df = normalize_cols(df)
        require_cols(df, ["Entry", "Sequence"])
        if "Length" not in df.columns:
            df["Length"] = df["Sequence"].astype(str).str.len()
        meta = {
            "source_title": path.stem,
            "dataset_id": path.stem,
            "n_peptides": len(df),
        }
        return df, meta

    with path.open() as f:
        data = json.load(f)
    peptides: List[Dict[str, Any]] = data.get("peptides", [])
    if not peptides:
        raise ValueError(f"Reference dataset {path} contains no peptides.")

    rows = []
    for p in peptides:
        raw_seq = p.get("sequence")
        # Treat explicit null / missing as empty so we skip rather than
        # ingesting the literal string "NONE" via str(None).
        if raw_seq is None:
            continue
        seq = str(raw_seq).strip().upper()
        if not seq:
            continue
        rows.append(
            {
                "Entry": p.get("name") or p["id"],
                "Sequence": seq,
                "Length": int(p.get("length", len(seq))),
                "UniProt": p.get("uniprot_id") or "",
                "Organism": p.get("organism") or "",
                "Category": p.get("general_category") or "",
            }
        )

    df = pd.DataFrame(rows)
    df = normalize_cols(df)
    require_cols(df, ["Entry", "Sequence"])
    meta = {
        "source_title": data.get("title"),
        "curator": data.get("curator"),
        "dataset_id": data.get("dataset_id"),
        "n_peptides": len(rows),
    }
    return df, meta


# ── Runner ────────────────────────────────────────────────────────────────


def precompute(dataset_id: str) -> Path:
    spec = DATASETS.get(dataset_id)
    if not spec:
        raise SystemExit(f"Unknown dataset_id {dataset_id!r}. Known: {list(DATASETS)}")

    src: Path = spec["source"]
    out: Path = spec["output"]
    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"→ Loading reference dataset from {src.relative_to(HERE.parent)}")
    df, ref_meta = load_reference(src)
    print(f"  loaded {len(df)} peptides — {ref_meta.get('dataset_id')}")

    t0 = time.perf_counter()
    print("→ Running PVL pipeline (TANGO + S4PRED + classification)...")
    # The Pydantic Meta model requires thresholdConfigResolved to be a dict,
    # not None. The pipeline still resolves real thresholds from the data and
    # writes them into meta.thresholds — this default just keeps the response
    # schema valid for downstream Pydantic ingestion.
    default_threshold_config = {"mode": "default", "source": "precompute"}

    response = process_upload_dataframe(
        df=df,
        threshold_config_requested=default_threshold_config,
        threshold_config_resolved=default_threshold_config,
        trace_entry=None,
        sentry_initialized=False,
        cancel_event=None,
        # api_models.RunMetadata.sequenceSource is a closed enum; "demo" is
        # the closest semantic fit for a bundled reference artifact (and is
        # already understood by the frontend). The dataset_id field on the
        # response carries the true provenance.
        sequence_source="demo",
    )
    elapsed = time.perf_counter() - t0
    print(f"  done in {elapsed:.1f}s")

    pvl_version = _detect_pvl_version()
    artifact = {
        "dataset_id": dataset_id,
        "title": spec["title"],
        "precomputed_at": datetime.now(timezone.utc).isoformat(),
        "pvl_version": pvl_version,
        "ref_meta": ref_meta,
        "elapsed_seconds": round(elapsed, 1),
        "response": _to_jsonable(response),
    }

    with out.open("w") as f:
        json.dump(artifact, f, indent=2, ensure_ascii=False)
    print(f"→ Wrote {out.relative_to(HERE.parent)} ({out.stat().st_size // 1024} KB)")
    return out


# ── Helpers ───────────────────────────────────────────────────────────────


def _detect_pvl_version() -> str:
    """Read pvl_version from CITATION.cff so the artifact stays in sync with
    the release tag. Fall back to git HEAD if CITATION can't be read."""
    citation = HERE.parent / "CITATION.cff"
    if citation.exists():
        for line in citation.read_text().splitlines():
            if line.startswith("version:"):
                return line.split(":", 1)[1].strip().strip('"')
    try:
        import subprocess

        return (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=HERE.parent)
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def _to_jsonable(obj: Any) -> Any:
    """Recursively coerce Pydantic models, numpy scalars, pandas types to
    JSON-serializable Python primitives."""
    if hasattr(obj, "model_dump"):  # Pydantic v2
        return _to_jsonable(obj.model_dump())
    if hasattr(obj, "dict") and callable(obj.dict):  # Pydantic v1
        return _to_jsonable(obj.dict())
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_jsonable(v) for v in obj]
    # numpy scalars
    if hasattr(obj, "item") and callable(obj.item):
        try:
            return obj.item()
        except Exception:
            pass
    return obj


# ── CLI ───────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "dataset_id",
        nargs="?",
        default="peleg_118",
        choices=sorted(DATASETS),
        help="Which dataset to precompute (default: peleg_118)",
    )
    args = parser.parse_args()

    # Sanity-check predictor flags. process_upload_dataframe degrades gracefully
    # if these are off, but the artifact would be useless without TANGO + S4PRED.
    # Treat "0"/"false"/"no"/"off" as disabled — env-var presence alone is not
    # a useful signal because "0" is truthy in shell.
    def _truthy(name: str) -> bool:
        return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}

    if not _truthy("USE_TANGO"):
        print(
            "⚠  USE_TANGO is not enabled — TANGO won't run. Set USE_TANGO=1 to produce a real artifact.",
            file=sys.stderr,
        )
    if not _truthy("USE_S4PRED"):
        print(
            "⚠  USE_S4PRED is not enabled — S4PRED won't run. Set USE_S4PRED=1 to "
            "produce a real artifact.",
            file=sys.stderr,
        )

    precompute(args.dataset_id)


if __name__ == "__main__":
    main()
