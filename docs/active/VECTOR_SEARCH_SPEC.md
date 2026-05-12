# Vector Similarity Search — PVL Spec

> **Status**: Wave 2 §D landed (2026-05-08). §D-fix (2026-05-12) replaced the provisional all-MiniLM-L6-v2 embedder with **ESM-2 8M** (320-dim) per [ADR-017](DECISIONS.md) — MiniLM produced biologically invalid embeddings ([RB-003](RESEARCH_BRIEFS/RB-003_embedding-model-evaluation.md)). Backend route + LanceDB store + auto-indexing are live behind `VECTOR_INDEX_ENABLED` (default ON). Frontend (`SimilarPeptidesInspector.tsx`, V9-1) is wired and consumes this contract directly.

This is the operator-and-scientist guide for the "Find similar peptides" feature. For the high-level rationale, see [ADR-016](DECISIONS.md) (vector store), [ADR-017](DECISIONS.md) (embedding model), and the comparison briefs [`RB-002`](RESEARCH_BRIEFS/RB-002_vector-store-evaluation.md) + [`RB-003`](RESEARCH_BRIEFS/RB-003_embedding-model-evaluation.md).

---

## 1. Architecture

```
                                          ┌──────────────────────────┐
upload-csv / predict ──────► PVL pipeline ┤                          │
                                          │  index_rows / index_peptide
                                          │      (best-effort)        │
                                          ▼                          │
                          ┌─────────────────────────────────────┐    │
                          │     services/vector_store.py        │    │
                          │  ┌──────────────┐  ┌─────────────┐  │    │
                          │  │  embedder    │  │  LanceDB    │  │    │
                          │  │ ESM-2 8M 320 │─▶│  ./data/    │  │    │
                          │  └──────────────┘  │   lance/    │  │    │
                          │                    └─────────────┘  │    │
                          └────────────▲────────────────────────┘    │
                                       │ find_similar                │
                          ┌────────────┴───────────────────────────┐ │
                          │  POST /api/peptides/similar (route)    │◀┘
                          └────────────▲───────────────────────────┘
                                       │
            SimilarPeptidesInspector  ─┴── pvl_mcp.find_similar_peptides
            (UI V9-1)                       (MCP tool 6)
```

**Key design choices** (from ADR-016 + ADR-017):

- **LanceDB embedded.** No daemon, no port, no Docker sidecar. The FastAPI process imports `lancedb` like any other library. Lance files live alongside the existing DuckDB cache (D2 alignment).
- **ESM-2 8M as the embedder** (`facebook/esm2_t6_8M_UR50D`, 320-dim, MIT, peer-reviewed in *Science* 2023). Trained on 250M UniRef50 sequences — embeddings encode evolutionary conservation and biochemical structure, not character frequencies. The provisional all-MiniLM-L6-v2 choice was rejected as a correctness failure (RB-003).
- **Lazy-loaded.** The embedder is built on the first `index_peptide` / `find_similar` call, not at FastAPI startup. Avoids a 1–2 s health-check delay; readiness probes are unaffected. ~150–250 MB RAM, ~30 MB on disk after first download.
- **Best-effort indexing.** If the embedder fails to load (no internet on first model download, disk full, broken weights) we log and continue — the analysis API contract is "analysis succeeded"; the index is observability infrastructure, not a critical path.
- **Single seam.** `services/vector_store.py` exposes only `index_peptide`, `index_rows`, `find_similar`, `is_enabled`, `stats`. Tests inject a fake embedder via `set_embedder(...)` and a tmpdir Lance path; nothing else needs to know about LanceDB.
- **Narrow stored shape.** We don't mirror the entire `PeptideRow` into Lance — only the small subset of fields the UI's classification pills + reference card render. The route synthesizes a partial `PeptideRow` shape on read so the frontend's `Peptide` type can render directly.

---

## 2. API contract

### `POST /api/peptides/similar`

Request body — strict (`extra="forbid"`), accepts both snake_case and camelCase aliases:

```json
{
  "reference_id": "P0C1Q4",     // OR "referenceId" — required, 1..128 chars
  "k": 10,                       // optional, 1..100, default 10
  "dataset_id": "ds-abc"         // OR "datasetId" — optional, restricts to one dataset
}
```

Response:

```json
{
  "reference_id": "P0C1Q4",
  "results": [
    {
      "peptide": {
        "id": "P0C1Q5",
        "sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ",
        "ffHelixFlag": 1,
        "sswPrediction": 1,
        "ffSswFlag": -1,
        "muH": 0.42,
        "tangoAggMax": 7.3
      },
      "distance": 0.13
    }
  ],
  "method": "lancedb+local-esm2-8m",
  "elapsed_ms": 12
}
```

**Behaviour:**

- The reference peptide itself is never included in `results`.
- If the reference is not in the index → `results: []` (NOT a 404). The UI shows the empty state.
- If the index is disabled (`VECTOR_INDEX_ENABLED=0` or model load failed) → `results: []` and `method: "disabled"`.
- Errors during search are caught and surfaced as empty results with `method` still set; an error log line is emitted.

### `GET /api/peptides/similar/stats`

Diagnostic shape — used by the runbook + readiness scripts:

```json
{
  "enabled": true,
  "disabled_reason": null,
  "method": "lancedb+local-esm2-8m",
  "lance_path": "/data/lance",
  "vector_dim": 320,
  "row_count": 1248
}
```

---

## 3. Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VECTOR_INDEX_ENABLED` | `1` | Master switch. Set to `0` to disable both auto-indexing and search (route returns empty + `method="disabled"`). |
| `LANCE_DB_PATH` | `<repo_root>/data/lance` | Filesystem path for Lance files. In Docker, the named volume `pvl-lance` is mounted here at `/data/lance`. |
| `EMBEDDING_PROVIDER` | `local-esm2-8m` | Embedder selector. Only `local-esm2-8m` is wired today (ADR-017). Future PepBERT / 35M variants are tracked in §10. |
| `EMBEDDING_MODEL_NAME` | `facebook/esm2_t6_8M_UR50D` | HuggingFace model id. Override only if a domain-specific protein LM is already cached on disk. |
| `VECTOR_DIM` | `320` | Embedding dimension (matches ESM-2 8M). Lance schema is dimension-locked; changing this requires reindexing — use `python -m scripts.reindex_lance`. |

---

## 4. Storage layout

- **Filesystem**: `<LANCE_DB_PATH>/peptides.lance/` — Apache Arrow / Lance columnar files.
- **Schema** (inferred from the seed record on first write):
  - `accession: str` (primary key by convention)
  - `sequence: str`
  - `embedding: list[float]` (length = `VECTOR_DIM`)
  - `dataset_id: str | None`
  - `indexed_at: float` (epoch seconds)
  - `organism, length, helix_flag, ff_helix_flag, ssw_prediction, ssw_score, ff_ssw_flag, s4pred_helix_prediction, s4pred_ssw_prediction, tango_agg_max, mu_h, hydrophobicity, charge` — all nullable.
- **Upsert** is implemented as `delete-where-accession-matches` then `add` — LanceDB <0.6 didn't ship `merge_insert` and the explicit two-step is portable across the version range PVL pins.
- **Filesystem versioning**: Lance keeps versioned manifests (zero-copy). Disk usage grows linearly with peptide count; pruning old manifests is a future concern (see §8).

---

## 5. Growth bounds

At default config (320-dim float32 embeddings + ~14 metadata columns):

| Peptide count | Embedding storage | Metadata storage | Total |
| --- | --- | --- | --- |
| 1k | ~1.3 MB | ~0.3 MB | ~1.6 MB |
| 10k | ~13 MB | ~3 MB | ~16 MB |
| 100k | ~125 MB | ~30 MB | ~155 MB |
| 1M | ~1.25 GB | ~300 MB | ~1.55 GB |

PVL's expected ceiling for the v0.x–v1.x era is <500k peptides per VPS. At 100k the index is well under 200 MB; the named Docker volume can stay on the existing CX33 disk without provisioning changes.

The ESM-2 model itself adds a one-time ~30 MB to disk (HuggingFace cache directory) and ~150–250 MB to resident RAM after the first embed call.

---

## 6. Privacy

When `EMBEDDING_PROVIDER=local-esm2-8m` (default) **embeddings never leave the VPS** — ESM-2 runs in-process via the local PyTorch + transformers stack, the vectors are stored on local disk, and no third-party endpoint is contacted at search time. The only outbound call is the one-time HuggingFace model download on first start (~30 MB from `huggingface.co`); after that the cache at `~/.cache/huggingface/` is reused.

Any future hosted-API provider (e.g. an `anthropic` option pending M-004) would surface in the route response's `method` field (`lancedb+<provider>`) so the user can decide whether to opt in. Provider switches will always be opt-in, never default.

---

## 7. K8s migration path

Lance files are plain on-disk artifacts. Migration to Kubernetes is mechanical:

- Map `pvl-lance` → a `PersistentVolumeClaim` with `ReadWriteOnce` access mode.
- A single backend pod owns the writer; replicas would need either (a) one writer + many readers via a shared PVC with read-only mounts, or (b) routing similarity calls to the writer pod by a service selector.
- The DESY K8s storage class supports `ReadWriteOnce`; verified during Wave 5 planning.

When PVL transitions to Postgres (per `MASTER_DEV_DOC` D2 — multi-user auth phase), migrate to `pgvector`:

- Re-embed every peptide and `INSERT ... ON CONFLICT` into a `peptide_embeddings` table.
- RB-002 estimates the migration at 2–4h; the embedding generation code is shared.
- Decommission `LANCE_DB_PATH` once both stores agree on row counts.

---

## 8. Operational runbook

### 8.1 — Inspect index health

```bash
curl http://localhost:8000/api/peptides/similar/stats | jq
```

Look for `enabled: true`, `disabled_reason: null`, and a non-zero `row_count` after at least one analysis has run.

### 8.2 — Disable the index without rebuilding

```bash
VECTOR_INDEX_ENABLED=0 uvicorn api.main:app
```

The route returns `method="disabled"` and the UI shows the empty state.

### 8.3 — Reindex after an embedding-model swap (ADR-017 migration)

Lance is dimension-locked — you can't shrink an existing column from 384 → 320 in-place. The shipped reindex script snapshots every row, drops the table, and re-embeds with the current model:

```bash
cd backend
python -m scripts.reindex_lance
```

The script is idempotent (safe to re-run), best-effort (per-row failures log but don't abort), and prints a summary count when done. Run it once after upgrading past commit `8e907fc` so the on-disk Lance files match the new 320-dim ESM-2 schema.

### 8.4 — Wipe and rebuild from scratch

```bash
rm -rf $LANCE_DB_PATH/peptides.lance
# Then re-run a representative dataset through /api/upload-csv.
```

The first peptide auto-indexed after wipe re-creates the table with the current schema. Prefer §8.3 over this if you have existing peptides worth keeping.

### 8.5 — Tail Sentry / structured logs for indexing failures

Search for these event keys:

- `vector_embedder_disabled` — model load failure (no internet, missing weights).
- `vector_index_failed` — per-row write failure.
- `vector_search_failed` — search-side failure (route still returns 200, surfaced via `disabled_reason`).
- `vector_index_dim_mismatch` — embedder returned the wrong dimension; reindex required.

---

## 9. Test coverage

Backend tests added in this wave:

- `backend/tests/test_vector_store.py` — 11 tests pinning the LanceDB seam: index/upsert/search/exclude-self/k-limit/unknown-id/disabled/dim-mismatch/metadata-translation/dataset-filter/stats.
- `backend/tests/test_similar_route.py` — 10 tests pinning the HTTP shape: 200 path, alias acceptance, 422 on unknown fields / missing id / out-of-range k, dataset_id passthrough, disabled-index passthrough, stats GET.
- `backend/tests/test_esm2_embedder.py` — 7 tests pinning the real-model behaviour (D-fix.5): default settings match ADR-017, 320-dim output, L2-normalized, KKKKK vs EEEEE separation, IKRKR↔IKRKRQ homology clustering closer than GGGGG, <5 s CPU latency for 50 AA, unknown-provider graceful disable.

The `test_vector_store.py` + `test_similar_route.py` suites inject a deterministic fake embedder via `vector_store.set_embedder(...)` so CI never downloads HuggingFace weights. `test_esm2_embedder.py` does load the real ESM-2 model — it auto-skips via `pytest.importorskip("transformers")` on machines without the ML deps.

---

## 10. Roadmap (future waves)

- **PepBERT watch**: ADR-017 §"When to revisit" — track `dzjxzyd/PepBERT` for a stable HuggingFace release. RB-003 §3 Option I notes it would be marginally better on short peptides than ESM-2 8M but is too immature today (April 2025 bioRxiv preprint, no pip release). Run a head-to-head on the Staphylococcus 2023 dataset when it stabilizes.
- **ESM-2 35M swap**: drop-in upgrade path if PVL exceeds ~500k peptides and latency degrades. 480-dim output → another reindex. Already proven to fit CX33 RAM (RB-003 §4).
- **Late Wave 2 / Wave 3**: surface `find_similar_peptides` MCP tool 6 in production-grade Claude Desktop integration tests once the index is populated with a representative dataset.
- **Wave 5**: pgvector migration alongside Postgres rollout (RB-002 §3 Option B). Embedder code is shared — only the storage client changes.

---

## 11. Reference

- [`backend/services/vector_store.py`](../../backend/services/vector_store.py) — implementation (LanceDB + ESM-2 embedder)
- [`backend/scripts/reindex_lance.py`](../../backend/scripts/reindex_lance.py) — one-shot migration script
- [`backend/api/routes/peptides.py`](../../backend/api/routes/peptides.py) — route
- [`backend/schemas/peptides.py`](../../backend/schemas/peptides.py) — Pydantic schemas
- [`ui/src/components/drilldown/SimilarPeptidesInspector.tsx`](../../ui/src/components/drilldown/SimilarPeptidesInspector.tsx) — frontend consumer
- [`RB-002`](RESEARCH_BRIEFS/RB-002_vector-store-evaluation.md) — vector-store comparison brief
- [`RB-003`](RESEARCH_BRIEFS/RB-003_embedding-model-evaluation.md) — embedding-model comparison brief
- [ADR-016 + ADR-017 in `DECISIONS.md`](DECISIONS.md) — load-bearing decisions
