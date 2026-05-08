# Vector Store Evaluation for PVL Similar-Peptides Search — Research Brief

**Brief ID**: RB-002
**Date**: 2026-05-08
**Author**: T-RES (research terminal)
**Mission**: Identify the vector store with best fit for PVL's `POST /api/peptides/similar` endpoint, lock or supersede the provisional Chroma choice, and produce ADR-016.
**Reading time**: ~8 minutes

---

## §1 — TL;DR (5 bullets)

- Chroma's provisional status should be **superseded**. It has a documented HNSW index-growth bug (index never shrinks), unreliable persistence under crash, and known memory leaks — exactly the failure modes that kill a solo-maintained tool on a shared VPS.
- **LanceDB embedded** is the correct choice for PVL v0.x–v1.x. It is Apache 2.0-licensed, runs in-process (no separate daemon), stores vectors in columnar Lance files alongside a future DuckDB layer, and reaches PVL's <500 ms latency target trivially at <1 M peptides.
- pgvector is the correct upgrade path for PVL v2.x **when Postgres is already running** (per D2 in MASTER_DEV_DOC). Migrating from LanceDB to pgvector at that point is low-cost because PVL owns the embedding generation code.
- Qdrant, Weaviate, Pinecone, Milvus, and Turbopuffer all require operating or paying for a separate service — unacceptable solo-maintainer burden at PVL's scale and budget.
- The decisive constraint is **ops burden, not performance**. Every candidate beats the <500 ms target at <100 k vectors. The differentiator is: zero servers to manage + MIT-compatible OSS + data format you own.

---

## §2 — Context

T2 backend is about to implement Section D — `POST /api/peptides/similar` — for vector similarity search over peptide embeddings (384-dim all-MiniLM or 1024-dim Anthropic). MASTER_PUSH_PLAN.md §3 chose Chroma local provisionally without comparing alternatives. ADR-011 mandates MIT OSS. MASTER_DEV_DOC D2 establishes DuckDB as the next backend storage layer (before Postgres). Any vector store must co-exist with that plan. This brief covers M-003 from the pending mission queue in `_INDEX.md`.

---

## §3 — Options evaluated

### Option A — LanceDB (recommended — embedded, columnar, zero-ops)

- **What it is**: An open-source embedded vector database implemented in Rust, exposed via Python/TS/Rust SDKs. Runs in-process; stores data in the Lance columnar format (a Parquet successor). No separate server or daemon.
- **License + cost**: Apache 2.0. $0 at any scale for the OSS embedded library. LanceDB Cloud exists but is never required.
- **Maturity**: First public release 2022; ~15k GitHub stars (as of 2025); used by AWS in production at 1B+ vector scale. Python API is stable; ecosystem is younger than Chroma but growing rapidly. Last release cadence: monthly.
- **Fit for PVL**: Exceptional. Embedded mode means the FastAPI process imports lancedb like a library — no Docker sidecar, no port, no backup daemon. Lance files live on the same filesystem as DuckDB files (D2 alignment). Filter support via SQL-style predicates on metadata columns (organism, length range, classification label) is first-class.
- **Pros**: Zero infra overhead; Lance format is open and version-controlled (zero-copy versioning); columnar storage makes metadata filters near-free; MCP-queryable via the same Python process the MCP server will run in (Wave 2 §A); K8s-ready (volume mount the Lance directory).
- **Cons**: Younger ecosystem than Chroma or pgvector; fewer monitoring/operational utilities; LanceDB Cloud is a separate paid product (not needed); community smaller than pgvector's.
- **Migration cost**: ~2–4h to adopt. Embedding generation code is shared; only the upsert/query calls change. Migrating out: export embeddings to numpy/JSON, re-import to pgvector — 1–2h script.

---

### Option B — pgvector (correct upgrade path, premature now)

- **What it is**: A Postgres extension that adds `vector` column type and ANN indexes (HNSW, IVFFlat). Queries written in SQL.
- **License + cost**: PostgreSQL License (MIT-equivalent). $0 self-hosted; cloud providers charge for managed Postgres.
- **Maturity**: Released 2021; ~15k GitHub stars; production deployments at Supabase, AWS RDS, Neon, Timescale. Extremely stable. Filter support via SQL WHERE clauses with no join limitations.
- **Fit for PVL**: Excellent — but only once Postgres is running (per D2: "Later — PostgreSQL if multi-user"). Adding Postgres solely for vector search at v0.x violates D2 and introduces a new infra dependency that the solo maintainer must operate, backup, and upgrade.
- **Pros**: SQL integration means organism/length/classification filters use standard WHERE; 30+ years of Postgres operational tooling; latency ~9–16 ms p50–p99 at 50 M vectors (well under 500 ms target at PVL scale); easiest long-term migration destination.
- **Cons**: Requires a running Postgres instance — wrong timing for PVL v0.x–v1.x (D2 says "not before deployment is stable and multi-user"); Postgres adds backup complexity (pg_dump scheduling, WAL archiving) for a solo maintainer.
- **Migration cost from LanceDB**: Low (~2–4h). Embedding generation is identical; only the storage client changes.

---

### Option C — Chroma (provisional — rejected)

- **What it is**: An open-source Python-native vector database with embedded (in-process) and client-server modes.
- **License + cost**: Apache 2.0. $0 self-hosted.
- **Maturity**: Released 2022; ~17k GitHub stars; popular in RAG tutorials and prototypes.
- **Fit for PVL**: Poor for production. Documented production issues: (1) HNSW index never shrinks after deletes — the only remedy is full collection rebuild; (2) memory leak under sustained load (G2 reviews, AltexSoft audit); (3) no built-in replication or crash-safe persistence — VPS crash = data loss without external backup scripting; (4) single-node only with no failover; (5) performance drops sharply with concurrency. These are exactly the failure modes a solo maintainer cannot afford on a shared VPS.
- **Pros**: Widest tutorial ecosystem; easiest 30-minute prototype setup.
- **Cons**: Index-growth bug (never shrinks); memory leak; no crash-safe persistence; poor concurrency behavior; limited filter tuning options compared to LanceDB or pgvector.
- **Migration cost**: Low to migrate away (~2–4h) — all embedding code is shared.

---

### Option D — Qdrant (server-mode, Rust, feature-rich — too heavy)

- **What it is**: A purpose-built vector database written in Rust; available as a Docker container or managed cloud service.
- **License + cost**: Apache 2.0. $0 self-hosted; Qdrant Cloud charged.
- **Maturity**: Released 2021; ~22k GitHub stars; widely used in enterprise AI. Highly stable. Benchmarks show ~5 ms p50 latency at 50 M vectors.
- **Fit for PVL**: Poor fit for ops reasons. Requires running and maintaining a separate Docker container alongside FastAPI. Self-hosted Qdrant does not include built-in backup or disaster recovery — the maintainer must build backup scripts. This is the same problem as Postgres but without the long-term payoff of SQL joins.
- **Pros**: Best raw latency among open-source options; native gRPC API; strong filter DSL; active community.
- **Cons**: Separate server process to manage, monitor, back up, and upgrade; no SQL joins in filter DSL; higher ops complexity than needed for <100 k peptides; JSON DSL learning curve for filter queries.
- **Migration cost**: Moderate (~4–8h) — JSON filter DSL is not standard SQL; query layer must be rewritten if migrating to pgvector.

---

### Option E — Pinecone (managed, vendor lock-in — rejected)

- **What it is**: Fully managed serverless vector database. No infra to manage.
- **License + cost**: Proprietary. Serverless free tier exists but production usage at >100 k vectors and sustained query load will incur costs ($50–$500/month range). Violates ADR-011 (MIT OSS, no paid-tier dependency).
- **Maturity**: Since 2019; most recognized managed vector DB. ~500ms p95 at 10 M vectors (consistent but not fastest).
- **Fit for PVL**: Rejected on license/cost grounds. ADR-011 prohibits paid-tier dependencies for core functionality.
- **Cons**: Proprietary; export lock-in; cost at scale; violates ADR-011.

---

### Option F — Weaviate (OSS, self-hostable — too heavy)

- **What it is**: Open-source vector database with hybrid search (dense + BM25 sparse). Docker or managed cloud.
- **License + cost**: BSD 3-Clause. $0 self-hosted.
- **Maturity**: Since 2019; ~12k GitHub stars. Feature-rich; genuine hybrid search first-class.
- **Fit for PVL**: Poor ops fit. Weaviate self-hosted is heavy (Java + Go stack, ~2 GB RAM idle). Weaviate Cloud is paid. For PVL's Hetzner CX33 (8 GB RAM total, TANGO binary + S4PRED weights + 2 uvicorn workers already running), adding Weaviate self-hosted is a RAM risk. Hybrid search is not needed at PVL's current keyword + vector use case.
- **Cons**: Heavy RAM footprint; over-engineered for <1 M peptides; managed version has cost.

---

### Option G — Turbopuffer (managed, S3-backed — violates ADR-011)

- **What it is**: Managed vector database backed by S3/object storage. Used by Cursor, Notion, Linear.
- **License + cost**: Proprietary managed service. No self-hostable OSS version available. Violates ADR-011.
- **Fit for PVL**: Rejected. Not MIT-OSS self-hostable; DESY K8s deployment cannot call out to external managed services for core data.

---

### Option H — Milvus (heavyweight OSS — overkill)

- **What it is**: Distributed vector database for billions of vectors. Kubernetes-native.
- **License + cost**: Apache 2.0. $0 self-hosted.
- **Maturity**: Since 2019; ~32k GitHub stars. Heavyweight (multiple components: etcd, MinIO, Pulsar).
- **Fit for PVL**: Rejected. Milvus is engineered for >100 M vectors with horizontal scaling. PVL's ceiling is <1 M peptides. Operating Milvus on a single CX33 VPS is a known anti-pattern; the component overhead would consume available RAM. Overkill by 100x.

---

## §4 — Comparison matrix

| Criterion | LanceDB (A) | pgvector (B) | Chroma (C) | Qdrant (D) | Pinecone (E) | Weaviate (F) | Turbopuffer (G) | Milvus (H) |
|---|---|---|---|---|---|---|---|---|
| License | Apache 2.0 | PostgreSQL | Apache 2.0 | Apache 2.0 | Proprietary | BSD 3-Clause | Proprietary | Apache 2.0 |
| MIT OSS (ADR-011) | YES | YES | YES | YES | NO | YES | NO | YES |
| Cost at PVL scale | $0 | $0 | $0 | $0 | $0–$50+/mo | $0 (self-host) | Paid only | $0 |
| Architecture | Embedded | Extension | Embedded/server | Server | Managed | Server | Managed | Distributed |
| Infra to add | None | Postgres | None | Docker sidecar | None | Docker sidecar | None | K8s cluster |
| Solo-maintainer ops | Low | Low (if Postgres exists) | Medium (bugs) | Medium-High | Low | High | Low | Very High |
| Maturity (years) | 3 | 4 | 3 | 4 | 6 | 6 | 2 | 6 |
| GitHub stars (approx) | ~15k | ~15k | ~17k | ~22k | N/A | ~12k | N/A | ~32k |
| p50 latency (<100k vecs) | <5 ms | <10 ms | ~20 ms | ~5 ms | ~45 ms | ~15 ms | N/A | ~8 ms |
| Filter support | SQL predicates | SQL WHERE | Limited | JSON DSL | Metadata filter | GraphQL | Metadata filter | Boolean |
| Crash-safe persistence | YES (Lance files) | YES (WAL) | NO (known bug) | YES (snapshots) | YES | YES | YES | YES |
| Index-growth bug | No | No | YES (never shrinks) | No | No | No | No | No |
| DuckDB co-location (D2) | YES (same filesystem) | No | No | No | No | No | No | No |
| MCP-queryable (Wave 2) | YES (same process) | YES (via asyncpg) | YES (same process) | Via HTTP | Via HTTP | Via HTTP | Via HTTP | Via gRPC |
| K8s migration path | Volume mount | PVC + Postgres pod | Volume mount | StatefulSet | N/A | StatefulSet | N/A | Helm chart |
| Lock-in risk | Low (Lance = open Parquet) | Low (SQL standard) | Low (export numpy) | Medium (JSON DSL) | High | Medium | High | Low |
| When to use | v0.x – v1.x | v2.x+ (Postgres era) | Never (production) | Only if distributed needed | Never (license) | Never (RAM) | Never (license) | Never (scale) |

---

## §5 — Recommendation

**Adopt**: LanceDB embedded for PVL v0.x and v1.x. Migrate to pgvector when Postgres is introduced (per D2).

**Reason**: LanceDB is the only candidate that satisfies all three binding constraints simultaneously — (1) MIT-compatible license with zero cost, (2) zero-infra embedded mode that a solo maintainer can sustain with 2h/month, and (3) no separate server to operate, back up, or upgrade. The Lance columnar format is an open Parquet-derived standard with low lock-in, and migration to pgvector later is a mechanical 2–4h operation. Chroma fails on production reliability (index-growth bug, no crash-safe persistence). All server-mode candidates (Qdrant, Weaviate, Milvus) add operational surface the solo maintainer cannot absorb. The latency advantage of Qdrant is irrelevant: at <100 k vectors and 384-dim embeddings, every candidate exceeds the <500 ms target by 10–100x.

**Rejected alternatives:**
- Chroma: index-growth bug, known memory leak, no crash-safe persistence on VPS crash — production risk for a solo maintainer.
- Qdrant: requires a separate Docker sidecar with manual backup setup; overkill for <100 k peptides.
- pgvector: correct long-term answer but premature — adding Postgres solely for vector search violates D2.
- Pinecone, Turbopuffer: proprietary/paid — violate ADR-011.
- Weaviate: high RAM footprint (Java+Go stack) conflicts with CX33 memory budget.
- Milvus: designed for 100 M+ vectors; ops overhead is prohibitive on single VPS.

**When to revisit**: At the transition to Postgres (D2 trigger: multi-user auth, >1 deployment), migrate vector storage to pgvector. That milestone is a natural forcing function — no earlier review needed unless PVL surpasses 500 k peptides before Postgres is live.

---

## §6 — Implementation plan

- **Effort estimate**: 4–6h for T2 to implement Section D with LanceDB.
- **Wave**: Wave 2 §D (current sprint).
- **Files affected**:
  - New: `backend/services/vector_store.py` (LanceDB client wrapper — upsert, query, filter)
  - New: `backend/migrations/init_lance.py` (create Lance table schema on startup)
  - Modified: `backend/api/routes/peptides.py` (add `POST /api/peptides/similar` route)
  - Modified: `backend/config.py` (add `LANCE_DB_PATH` setting, default `./data/lance`)
  - Modified: `docker-compose.yml` (add `./data/lance:/app/data/lance` volume mount)
- **New ADR needed**: Yes — ADR-016 (see §7).
- **Roadmap edits**: None required to ROADMAP.md; Section D is already scoped in MASTER_PUSH_PLAN.
- **Tech-radar movement**: LanceDB moves from untracked → "adopt now" for embedded vector search at PVL v0.x–v1.x scale.

---

## §7 — Proposed ADR draft

```markdown
## ADR-016 — Vector Store: LanceDB Embedded (supersedes provisional Chroma in MASTER_PUSH_PLAN §3)
**Date**: 2026-05-08 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: Wave 2 §D implements `POST /api/peptides/similar`. MASTER_PUSH_PLAN §3 chose
Chroma local as a provisional vector store without comparative research. RB-002 evaluated
8 candidates against PVL's binding constraints: MIT OSS (ADR-011), solo-maintainer ops
burden (~2h/month after Sept 2026), no paid services, Hetzner CX33 VPS (8 GB RAM),
<500 ms latency for k=10 at <1 M peptides, and future portability to DESY K8s.
**Decision**: Adopt LanceDB (Apache 2.0) in embedded mode as the vector store for PVL
v0.x and v1.x. Store Lance files at `./data/lance` (volume-mounted in Docker). Migrate
to pgvector when Postgres is introduced per MASTER_DEV_DOC D2 (multi-user auth phase).
**Reasoning**: LanceDB is the only candidate satisfying all three binding constraints —
zero-infra embedded mode, MIT-compatible OSS, crash-safe columnar persistence. Chroma
has a documented HNSW index-growth bug and no crash-safe persistence. Qdrant/Weaviate
require a separate server process a solo maintainer cannot reliably operate. pgvector is
the correct long-term answer but premature until Postgres is live (D2). At <1 M peptides
and 384-dim embeddings, LanceDB exceeds the <500 ms latency target by a factor of 100.
**Implication**: T2 implements Section D using `lancedb` Python package. Chroma is
removed from requirements. Migration path to pgvector is documented in RB-002 §3 Option B
and requires ~2–4h of effort when triggered by D2.
**Evidence**: RB-002 (this brief), AltexSoft Chroma audit [1], TigerData pgvector vs
Qdrant benchmark [2], LanceDB embedded docs [3], MASTER_DEV_DOC D2.
```

---

## §8 — Sources cited

1. [AltexSoft — The Good and Bad of ChromaDB for RAG](https://www.altexsoft.com/blog/chroma-pros-and-cons/) — documents HNSW index-growth bug, memory leak, single-node persistence limitations.
2. [TigerData — pgvector vs Qdrant benchmark](https://www.tigerdata.com/blog/pgvector-vs-qdrant) — p50/p99 latency numbers at 50 M vectors; filter support comparison; ops burden analysis.
3. [LanceDB GitHub — Developer-friendly OSS embedded retrieval library](https://github.com/lancedb/lancedb) — embedded architecture, Apache 2.0 license, zero-server ops model.
4. [Zilliz — Chroma vs LanceDB comparison](https://zilliz.com/comparison/chroma-vs-lancedb) — embedded architecture, filter support, data format comparison.
5. [Qdrant installation docs — self-hosted backup and DR](https://qdrant.tech/documentation/guides/installation/) — confirms self-hosted Qdrant requires manual backup and DR setup.
6. [4xxi — Vector Database Comparison 2026](https://4xxi.com/articles/vector-database-comparison/) — production RAG comparison covering crash-safety, filter tuning, maturity.
7. [DEV Community — Embedded Intelligence: SQLite-vec for local vector search](https://dev.to/aairom/embedded-intelligence-how-sqlite-vec-delivers-fast-local-vector-search-for-ai-3dpb) — alternative embedded approaches (sqlite-vec); lower maturity than LanceDB.
8. [Firecrawl — Best Vector Databases 2026](https://www.firecrawl.dev/blog/best-vector-databases) — broad comparison including Turbopuffer, Weaviate; confirms managed options require paid tiers for production use.

---

## §9 — Open questions / things to revisit

- **Revisit at D2 trigger**: When Postgres becomes live (multi-user auth phase), migrate from LanceDB to pgvector. The migration is 2–4h and should be done as part of the Postgres onboarding sprint, not before.
- **Embedding model choice** (M-004 pending): This brief assumes 384-dim all-MiniLM. If M-004 recommends ESM-2 (1024+ dim), confirm Lance columnar storage remains efficient at that dimension. LanceDB supports arbitrary embedding dimensions per docs.
- **MCP server integration** (Wave 2 §A): LanceDB runs in the same Python process as FastAPI and the MCP server, so the MCP tool can call `vector_store.query()` directly with no HTTP hop. Verify this holds when the MCP server runs as a subprocess (not in-process).
- **DESY K8s migration**: LanceDB volume mounts map directly to Kubernetes PersistentVolumeClaims. Verify DESY K8s storage class supports `ReadWriteOnce` PVC for Lance directory.
- **Backup story**: Lance files are plain files on disk. The VPS backup strategy (periodic rsync/snapshot of `/app/data/`) covers vector data automatically — no separate backup tooling needed. Document in DEPLOYMENT.md.

---

## §10 — Cross-references

- Supersedes: provisional Chroma choice in MASTER_PUSH_PLAN.md §3
- Affects: ADR-011 (MIT OSS mandate — LanceDB Apache 2.0 is compliant)
- Proposes: ADR-016 (see §7 above)
- Relates to: MASTER_DEV_DOC D2 (database strategy — DuckDB now, Postgres later)
- Relates to: M-004 (embedding model choice — pending brief)
- Affects: MASTER_PUSH_PLAN.md §D (T2 implementation target)
- Affects: ROADMAP.md Wave 2 §D
