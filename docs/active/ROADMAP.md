# Peptide Visual Lab (PVL) — Development Roadmap

**Last Updated**: 2026-03-05
**Status**: Active Development (pre-paper, deployment-ready)
**Branch**: `main` (merged from `ref-impl-replacement`)

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
- 323 backend tests + 77 frontend tests = 400 total (all deterministic, no network)
- Peleg holistic review: Chunks 1-7 DONE, Chunk 8 PARKED, Chunk 9 ONGOING

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

### B10. Chemical Modification Support
**Status**: NOT STARTED | **Effort**: 16-24h | **Requested by**: Alex (2026-03-25)
Parse peptide sequences with chemical modifications (e.g., `MWDDDAD-NH2`, terminal amide, formyl groups). TANGO and S4PRED only accept standard amino acids, so modifications must be stripped before prediction but preserved as metadata.
**Scope**: Input parsing (inline notation like `-NH2`, `Ac-` + optional flag/dropdown), adjusted biochem calculations (charge, hydrophobicity affected by terminal modifications), UI display of detected modifications, validation rules.
**Key constraint**: Predictors run on clean sequences; modifications only affect our own biochem calculations.

**Phase B summary**: 6/9 done. B1 (async), B6 (cache), B10 (modifications) blocked on deployment or later priority.

---

## Peleg Holistic Review

| Chunk | Scope | Status |
|-------|-------|--------|
| 1 | FF data layer (flags, scores, thresholds) | DONE |
| 2 | FF frontend (badges, KPIs, charts) | DONE |
| 3 | Terminology & UX patterns | DONE |
| 4 | Chart architecture stabilization | DONE |
| 5 | Ranking system | DONE |
| 6 | Ranking redesign (multi-metric) | DONE |
| 7 | Polish & edge cases | DONE |
| 8 | UI/UX Redesign | PARKED (→ Phase D) |
| 9 | Documentation & cleanup | ONGOING |

---

## Phase D: UI/UX Redesign (Next)

**Prerequisites**: Chunks 1-7 complete, 400 tests safety net, clean main branch.

| ID | Task | Effort | Status | Details |
|----|------|--------|--------|---------|
| D1 | Extract PeptideViewer component | 4h | TODO | ~200 LOC duplicated between QuickAnalyze and PeptideDetail |
| D2 | Card-based progressive disclosure | 16h | TODO | Summary cards on dashboard, click-to-expand |
| D3 | Per-residue profile viewer | 12h | TODO | Unified multi-track viewer (P_H, P_E, TANGO curves) |
| D4 | Code-splitting / lazy routes | 4h | TODO | Main bundle is 2.4MB (warning threshold 500KB) |
| D5 | Sidebar polish (icons-only, hover labels) | 4h | TODO | Already exists, needs refinement |
| D6 | Theme finalization | 4h | TODO | Lock dark/light theme with consistent shadcn/ui tokens |

---

## Phase E: Docker & Infrastructure Optimization

**Goal**: Production-grade Docker workflow — pull GHCR images locally, optimize builds, prepare K8s migration path.

### Current State (2026-03-05)
- **GHCR images**: `ghcr.io/saidaz24-meet/peptide_prediction/backend:main` and `frontend:main` auto-published on every push to main
- **Local images**: `pvl-backend:test` (3.41GB, 1 month old), `pvl-frontend:test` (105MB) — STALE
- **3 compose files**: `docker-compose.yml` (dev), `docker-compose.prod.yml` (production/Nginx), `docker-compose.caddy.yml` (production/Caddy+HTTPS)
- **Backend image**: ~800MB (CPU-only PyTorch), multi-stage build
- **Frontend image**: ~105MB (Nginx + static assets), 3-stage build
- **Tools**: Volume-mounted at `/opt/tools` (TANGO binary + S4PRED weights)

### E1. Local GHCR Pull & Run (Immediate)
**Effort**: 2h | **Status**: TODO

Replace stale local builds with fresh GHCR images:
```bash
# Pull latest images from GHCR
docker pull ghcr.io/saidaz24-meet/peptide_prediction/backend:main
docker pull ghcr.io/saidaz24-meet/peptide_prediction/frontend:main

# Tag for local use
docker tag ghcr.io/saidaz24-meet/peptide_prediction/backend:main pvl-backend:latest
docker tag ghcr.io/saidaz24-meet/peptide_prediction/frontend:main pvl-frontend:latest
```

**Tasks**:
- Add `docker-compose.ghcr.yml` that uses `image:` instead of `build:` — pulls from GHCR
- Add `make docker-pull` target to Makefile
- Clean stale local images (`pvl-backend:test`, `pvl-frontend:test`, dangling `<none>`)
- Verify health check passes after pull

### E2. Compose File Consolidation
**Effort**: 4h | **Status**: TODO

Current: 3 separate compose files with duplicated service definitions.
Target: 1 base compose + override files.

```
docker/
  docker-compose.yml          # Base: service definitions, volumes, networks
  docker-compose.override.yml # Dev: source mounts, hot reload, debug logging
  docker-compose.prod.yml     # Prod: resource limits, JSON logging, restart: always
  docker-compose.caddy.yml    # Prod+HTTPS: Caddy reverse proxy, auto-TLS
```

**Key changes**:
- Base compose uses `image:` pointing to GHCR (default = pull from registry)
- Dev override adds `build:` context for local development
- Prod override adds resource limits, logging, restart policy
- `make dev` = `docker compose up` (uses base + override)
- `make prod` = `docker compose -f ... -f docker-compose.prod.yml up`

### E3. Image Size Optimization
**Effort**: 4h | **Status**: TODO

Backend is 800MB — target 600MB:
- Audit installed packages: `pip list --format=freeze | wc -l`
- Split heavy deps (pandas, torch) into requirements layers
- Use `--no-cache-dir` explicitly (already done via BuildKit cache mount)
- Consider Alpine base for frontend nginx (already using `nginx:alpine`)
- Pin base images by SHA digest (currently by tag — TD in ROADMAP)

### E4. Docker Workflow for K8s Readiness
**Effort**: 8h | **Status**: TODO

Prepare Docker images for seamless K8s migration:

| Item | Current | Target |
|------|---------|--------|
| Image registry | GHCR (github) | GHCR + optional Harbor (DESY) |
| Image tagging | `main`, `sha-xxx` | `main`, `sha-xxx`, semver `v1.0.0` |
| Config injection | ENV vars in compose | ENV vars → ConfigMap/Secret compatible |
| Health probes | `curl` in HEALTHCHECK | Liveness + readiness endpoints (`/api/health`, `/api/ready`) |
| Graceful shutdown | `tini` init | SIGTERM handler, connection draining |
| Secrets | `.env` file | `.env` → K8s Secret (no code change) |
| Volume mounts | Host bind mounts | Named volumes → PVC (no code change) |
| Logging | JSON to stdout | Same (K8s collects stdout natively) |

**Tasks**:
- Add `/api/ready` endpoint (checks S4PRED model loaded, TANGO binary accessible)
- Add SIGTERM graceful shutdown handler in `api/main.py`
- Add `GHCR_REGISTRY` variable to compose for easy registry swaps
- Document image promotion workflow: `sha-xxx` → `main` → `v1.0.0`
- Test: `docker run --rm pvl-backend:latest python -c "from api.main import app; print('OK')"`

### E5. Local Development Docker Experience
**Effort**: 4h | **Status**: TODO

Make `docker compose up` just work for new developers:

```bash
# One-command setup
make docker-dev    # Builds + starts with hot reload
make docker-prod   # Builds + starts production mode
make docker-pull   # Pulls latest from GHCR (no build needed)
make docker-clean  # Remove old images, volumes, build cache
make docker-logs   # Tail logs
make docker-shell  # Shell into backend container
```

- Add `docker/.env.example` with all required vars documented
- Add `scripts/docker-setup.sh` that checks: Docker installed? Tools dir exists? .env created?
- Add compose `profiles` for optional services (future: Redis, DuckDB)

### E6. Multi-Architecture Build (Future)
**Effort**: 8h | **Status**: BLOCKED (needs DESY VM arch info)

Current images are `linux/amd64` only. For Apple Silicon dev + Linux prod:
- Add `docker buildx build --platform linux/amd64,linux/arm64`
- TANGO binary is x86_64 only → ARM builds skip TANGO or use Rosetta
- S4PRED/PyTorch works on both architectures

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

### C6. Guided Onboarding Tour
**Status**: NOT STARTED | **Effort**: 8h
Step-by-step walkthrough for first-time users (react-joyride or similar). Highlights KPI cards, chart tabs, ranking system, threshold controls. Pairs with existing Legend overlay (first-visit dialog).

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

<details>
<summary>Feb 22 – Mar 5: Peleg Holistic Review (Chunks 1-7)</summary>

- FF data layer: flags, scores, Peleg thresholds verified against reference
- FF frontend: badges, KPIs, charts for FF-Helix and FF-SSW
- Terminology: SSW labeling (TANGO/S4PRED), consistent naming
- Chart architecture: ChartFrame, ExpandableChart, ZoomableChart
- Ranking: multi-metric scoring, weight sliders, consensus pipeline
- Polish: edge cases, threshold tuner, aggregation flagging
- Tests: 235 → 323 backend, 0 → 77 frontend (vitest)

</details>

<details>
<summary>Mar 5: Pre-Redesign Cleanup</summary>

- Deleted backend/_archive/ (4 dead files), stale Excel files, unused components
- Removed JPRED_COLS constant, favicon duplicates, docs/CLAUDE.md
- Fixed tsconfig.json (baseUrl, removed ignoreDeprecations)
- Fixed README broken link (DEPLOYMENT_GUIDE.md → DEPLOYMENT.md)
- Updated all docs to reflect 400 tests, Peleg review status
- Squash-merged ref-impl-replacement into main

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
