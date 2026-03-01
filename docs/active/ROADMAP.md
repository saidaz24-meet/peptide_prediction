# Peptide Visual Lab (PVL) — Development Roadmap

**Last Updated**: 2026-03-01
**Status**: Active Development (pre-paper, deployment-ready)
**Branch**: `ref-impl-replacement`

---

## Strategic Position

PVL occupies a unique niche: the **only web tool** combining aggregation propensity (TANGO), secondary structure prediction (S4PRED), fibril-forming helix detection (FF-Helix), and SSW prediction with interactive visualizations. Nearest competitors (PASTA 2.0, Waltz, AGGRESCAN) are single-algorithm, non-visual, or offline-only.

**Open source path**: MIT license → CITATION.cff (done) → Zenodo DOI → bio.tools → JOSS paper
**Deployment path**: DESY VM + Docker Compose (now) → DESY Kubernetes (confirmed long-term)

---

## Current Status

### What's Complete
- FastAPI backend with TANGO + S4PRED integration
- React/TypeScript frontend with full analysis dashboard
- Biochemical calculations (Charge, Hydrophobicity, muH, FF-Helix%)
- SSW detection pipeline (TANGO-based and S4PRED-based)
- UniProt query + AlphaFold DB integration
- Docker multi-stage builds (~800MB), CI/CD, Caddy auto-HTTPS
- Smart ranking, per-residue profiles, CSV/PDF/FASTA export
- Helical wheel projection, collapsible sidebar, progressive disclosure (3-tab)
- Sentry error tracking, CITATION.cff, pinned dependencies
- 270+ passing tests (all deterministic, no network)

### Waiting for DESY
| Item | Contact | Notes |
|------|---------|-------|
| Domain name | DESY IT | Caddy config ready |
| VM SSH access | DESY IT | DEPLOYMENT.md ready |
| K8s cluster details | DESY IT | Namespace, Ingress, quotas |
| GitLab migration | DESY IT | Mirror strategy documented |

---

## Phase A: Paper-Ready (Immediate)

| ID | Task | Effort | Status | Details |
|----|------|--------|--------|---------|
| A1 | UniProt cross-links | 2h | DONE | Clickable IDs → uniprot.org |
| A2 | SVG/PNG export | 4h | DONE | Publication-ready charts + helical wheel |
| A3 | Example datasets | 3h | DONE | 3 curated sets with "Try example data" |
| A4 | bio.tools registration | 1h | TODO | Needs live URL |
| A5 | Zenodo DOI | 1h | TODO | Needs GitHub release |

---

## Phase B: User Adoption (3-6 months)

### B1. Async Job Queue (Celery + Redis)
**Status**: NOT STARTED | **Effort**: 24h | **Blocked**: Needs VM
Replace synchronous prediction with background jobs. `POST /api/upload-csv` returns `{jobId, status: "queued"}`, poll `GET /api/jobs/{jobId}`.
**Why**: Current architecture caps at ~30s (proxy timeout). 500+ peptide batches need async.
**Files**: New `backend/worker.py`, `backend/api/routes/jobs.py`, add Redis + worker to compose.

### B2. Cohort Comparison Dashboard
**Status**: DONE | **Effort**: 16h
Side-by-side comparison (mutant vs wild-type) with overlay distributions, KPI delta table.

### B3. Plotly.js Scientific Charts
**Status**: NOT STARTED | **Effort**: 12h
Advanced visualizations: per-residue heatmaps, 3D scatter (H × μH × FF-Helix%), interactive plots.
Use alongside Recharts for visualizations Recharts can't do.

### B4. AlphaFold DB Integration
**Status**: DONE | **Effort**: 16h
pLDDT metrics, Mol* iframe viewer, PDB download for valid UniProt accessions.

### B5. Server.py Refactor
**Status**: PARTIAL (1293 → 15 LOC) | **Effort**: 16h
**Done**: Extracted to `services/`, broke circular imports, fixed duplicate S4PRED bug.
**Remaining**: `execute_uniprot_query` monolith (814 lines) needs dedicated plan.

### B6. DuckDB Result Cache
**Status**: NOT STARTED | **Effort**: 12h
Persist predictions to disk (DuckDB, serverless, zero-config). Serve cached responses for repeats.

### B7. Progressive Disclosure
**Status**: DONE | **Effort**: 8h
3-tab layout: Data Table (default) | Ranking | Charts.

### B8. Ranked Shortlist PDF Report
**Status**: DONE | **Effort**: 8h
Data-driven jsPDF with summary, top-N table, methodology notes.

### B9. QuickAnalyze Upgrade
**Status**: DONE | **Effort**: 4h
Full PeptideDetail-parity: SequenceTrack, HelicalWheel, S4PRED chart, TANGO heatmap, AlphaFold, KPI tiles.

**Phase B summary**: 6/8 done. B1 (async) and B6 (cache) blocked on deployment.

---

## Phase C: Platform Scale — DESY Kubernetes

DESY K8s confirmed long-term (2026-02-22). Docker images already K8s-ready. Details pending.

### C1. Proteome Precomputation
**Effort**: 40h | **Blocked**: K8s namespace
Precompute top 10 organisms (~101K sequences, ~12-15h compute) via K8s CronJobs → Parquet → DuckDB.

### C2. Kubernetes Deployment (Helm Chart)
**Effort**: 24h | **Blocked**: K8s details from DESY
Helm chart: Deployment, Service, Ingress, ConfigMap/Secret, PVC for tools.

### C3. ESMFold/AlphaFold On-Demand Prediction
**Effort**: 24h | **Blocked**: GPU access
On-demand structure prediction for novel sequences not in AlphaFold DB.

### C4. Plugin Architecture
**Effort**: 16h
Standardized provider interface for external prediction tools.

### C5. Mol* 3D Full Integration
**Effort**: 20h
MolViewSpec annotations, custom coloring by PVL predictions.

---

## Technical Debt

| ID | Issue | Priority | When to Fix |
|----|-------|----------|-------------|
| TD-01 | JPred column names in dataframe_utils.py, biochem.py | LOW | During B5 |
| TD-03 | normalize.py duplicate fallback logic ~700 lines | MEDIUM | Dedicated task |
| TD-05 | Global mutable state (provider_tracking) not thread-safe | MEDIUM | B1 (Celery) |

---

## Architecture Constraints

| Constraint | Rule |
|------------|------|
| Cost | Free only. DESY VM + K8s = yes. Supabase = no. |
| Deployment | VM + Docker Compose (now). DESY K8s (long-term). |
| Database | DuckDB (near-term). Postgres (future, K8s). |
| Predictors | S4PRED = primary. TANGO = secondary. PSIPRED = removed. |
| Auth | Not needed (open source, public tool). |
| API contract | `backend/schemas/api_models.py` is single source of truth |
| Null semantics | JSON `null` only. Never `-1`, `"N/A"`, or empty string. |

---

## Completed Work History

<details>
<summary>Feb 7-13: Algorithm Verification + UI Batches 1-7 + Backend Hardening</summary>

- S4PRED verified (24 golden tests), FF-Helix verified (34 golden tests)
- FF Flags in API (ffHelixFlag, ffHelixScore, ffSswFlag, ffSswScore)
- Infrastructure: pinned deps, CI gates, CORS, proxy timeouts, Sentry, DEPLOYMENT_SPEC
- UI Batch 1: SequenceTrack, sidebar, classification, Help page
- UI Batch 2: FASTA export, debug endpoints removed, CITATION.cff
- UI Batch 3: Helical wheel, CSS variables, UniProt validation, About page
- UI Batch 4: SSW labeling (TANGO/S4PRED), S4PRED Helix %, CSV enrichment, debug cleanup
- UI Batch 5: Table tooltips, S4PRED Helix KPI, FF vs S4PRED interpretation
- UI Batch 6: Column visibility toggle, SSW agreement stats
- UI Batch 7: Progressive disclosure (3-tab), percentile labels fixed
- Backend: Case sensitivity fix, non-standard AA handling, TANGO Linux hardening, 21 new tests
- Scientist: Result persistence, TANGO per-residue curves, aggregation heatmap, S4PRED pre-sanitization
- Deep Audit: Segment off-by-one, muH NaN guard, normalize.py PARTIAL fix, localStorage quota
- Phase B: B8 PDF report, B2 cohort comparison, B4 AlphaFold, B5 server.py refactor, B9 QuickAnalyze

</details>

<details>
<summary>Feb 16: Sprint 1 — Documentation & Cleanup</summary>

- README overhaul (removed stale references, Docker-only quick start)
- Stale docs cleanup (deleted DOCKER_RUNBOOK, updated 9 docs)
- Toast consolidation (kept Sonner, removed 2 packages)
- FF-Helix demotion (S4PRED promoted to primary helix metric)
- S4PredChart extraction (~90 LOC deduplicated)
- Table hover preview (S4PRED composition tooltip)
- Dead code removal (duplicate S4PRED blocks)

</details>

<details>
<summary>Feb 22: Docs Consolidation</summary>

- Deleted 7 stale/redundant docs
- Merged security/risk/cost into MASTER_DEV_DOC.md
- Updated all cross-references

</details>

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-01 | api_models.py = canonical schema | Single source of truth |
| 2026-02-01 | Volume-mounted tools | Flexibility, smaller images |
| 2026-02-01 | Null semantics: JSON null only | No sentinel values |
| 2026-02-07 | CPU-only PyTorch in Docker | Saves ~1.8GB, no GPU needed |
| 2026-02-11 | Caddy (auto-TLS) for VM | Production reverse proxy |
| 2026-02-22 | K8s confirmed long-term | DESY managed cluster |
| 2026-02-22 | Cluster ingress (not our proxy) | PVL creates Ingress manifests only |
