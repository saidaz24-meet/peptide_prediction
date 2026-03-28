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

### B11. FASTA Upload Support
**Status**: NOT STARTED | **Effort**: 4-6h | **Requested by**: Alex (2026-03-25)
Accept `.fasta` and `.fa` files as input. FASTA is the most common bioinformatics sequence format — researchers expect it.
**Scope**: Backend FASTA parser (header line `>entry_name` + sequence lines → DataFrame), frontend dropzone update (add `.fasta`, `.fa` to accepted types), auto-detect format by file extension or content sniffing (lines starting with `>`).
**Key detail**: FASTA files contain only entry names + sequences. No organism, no metadata columns. Backend should create a minimal DataFrame with `Entry` and `Sequence` columns.

### B12. Upload Guidance & Limits
**Status**: NOT STARTED | **Effort**: 2-3h | **Requested by**: Alex (2026-03-25)
Improve the upload experience with better information:
- Show practical entry limits during upload: "Up to ~500 sequences. Larger batches may take several minutes with TANGO enabled."
- Add info tooltip on Upload page: "How to export from UniProt" — step-by-step guide (search → Download → choose TSV/CSV → include 'Sequence' column)
- Show required columns: "Your file must include a 'Sequence' column. Optional: 'Entry', 'Organism', 'Length'."
- Currently only shows "50MB max" with no guidance on entry counts or required format.

### B13. Cohort Comparison: Dual Upload
**Status**: NOT STARTED | **Effort**: 6-8h | **Requested by**: Alex (2026-03-28)
Currently Cohort Comparison requires a dataset already loaded (Cohort A) and then uploading Cohort B. Alex requests:
- **Option 1** (current): Upload B, compare with already-loaded A
- **Option 2** (new): Upload both A and B fresh from the Compare page — no need to go through Upload first
- **Option 3** (new): Save previous analysis results and load them later for comparison without recalculation
**Scope**: Add dual dropzone to Compare page, add result persistence (localStorage or DuckDB), add "Load saved analysis" picker.

### B14. Tools Tab — PDB Visualization & More
**Status**: NOT STARTED | **Effort**: 12-16h | **Requested by**: Alex (2026-03-28)
New sidebar tab "Tools" with standalone utilities for amyloid researchers:
- **PDB Structure Renderer**: Drag-and-drop a PDB file → generate publication-ready PNG image showing peptide chain with colored residues (like Alex's example: N-term markers, charged residues in red/green/blue). Uses a Python script Alex has.
- **Future tools**: Sequence format converter, FASTA↔CSV, batch accession lookup, etc.
**Key decision**: Should this be part of PVL or a separate micro-app? Recommendation: Start as a PVL tab, extract later if it grows.

### B15. Large Dataset Support (>500 entries)
**Status**: NOT STARTED | **Effort**: 8-12h | **Requested by**: Alex (2026-03-28)
Current blockers for large datasets:
1. **Nginx 413 error** (ISSUE-021): `client_max_body_size` defaults to 1MB — fixed with one line
2. **Backend timeout**: TANGO runs 2-5s/peptide → 3K entries = hours. Need async queue (B1) or auto-disable TANGO for large batches
3. **No progress feedback**: User sees nothing while 3K entries process
**Immediate fix**: Increase nginx body size limit, show entry count warning ("3,088 entries detected — analysis without TANGO will take ~5 minutes, with TANGO ~2-4 hours")
**Long-term fix**: B1 (async job queue) + chunked processing + progress WebSocket

### B16. Load Testing / Smoke Testing Infrastructure
**Status**: NOT STARTED | **Effort**: 4-6h | **Requested by**: Alex (2026-03-28)
Simulate concurrent load: 50, 100, 1000 simultaneous analyses. Tools: `locust` or `k6` for HTTP load testing against the Hetzner VPS. Helps determine when to scale workers or add async queue.
**Deliverables**: Load test script, baseline numbers (requests/sec, p95 latency), breaking point identification.

**Phase B summary**: 6/15 done. B1 (async), B6 (cache), B10-B16 planned.

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
| D7 | UniProt Database Search page | 10h | TODO | Dedicated `/search` route + sidebar entry. See Phase F. |

---

## Phase F: UniProt Search Enrichment

**Full spec**: `docs/active/UNIPROT_ENRICHMENT_SPEC.md`
**Requested by**: Alex (2026-03-25) — "one of the most useful features"
**Goal**: Elevate UniProt from a secondary input method to a first-class research workflow.

**Why this matters**: PVL is the only peptide tool with integrated UniProt search + analysis. No competitor (PASTA 2.0, Waltz, AGGRESCAN, CamSol) offers this. But the current implementation has result count discrepancies, missing metadata, and no search transparency — which erodes researcher trust.

| Step | Scope | Effort | Status | Details |
|------|-------|--------|--------|---------|
| F1 | Search query fix | 3-4h | TODO | Full-text default (not `keyword:`), parse X-Total-Results, fix slider/cap mismatch |
| F2 | Search summary banner | 2h | TODO | "Found 204 of 12,345 entries" + filters + "View on UniProt" link |
| F3 | Metadata enrichment | 5-6h | TODO | Add gene_names, cc_function, annotation_score to fetch + display |
| F4 | Dedicated `/search` page | 8-10h | TODO | Own sidebar tab, browse table with checkboxes, "Analyze Selected" (ties into D7) |
| F5 | Browse-then-analyze | 6-8h | TODO | Lightweight browse first (metadata only), user-triggered analysis on selection |
| F6 | Advanced search | 6-8h | TODO | "Search in" selector, raised caps, smart suggestions, pagination |

**Step order**: F1 → F2 → F3 can be done independently of Phase D. F4 → F5 should be planned alongside Phase D (same design language, card patterns, progressive disclosure). F6 is polish.

**Key dependencies**:
- F3 requires `api_models.py` change (protected file, needs approval)
- F4/F5 pair well with B1 (async jobs) — "Analyze Selected" becomes a background job
- F5 pairs with B6 (DuckDB cache) — cache browse results and per-accession analyses

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

## Phase G: AI/LLM Integration Layer

**Proposed by**: Alex (2026-03-25) — "bind AI to PVL so you can prompt for analysis"
**Prerequisites**: Phase F (UniProt enrichment) + deployed instance + precomputed database (C1)
**Why**: PVL already has a REST API. Wrapping it as AI-callable tools turns every analysis workflow into a natural language prompt. No competitor offers this.

### G1. PVL MCP Server — Natural Language Queries (Near-term)
**Effort**: 16-24h | **Status**: NOT STARTED | **After**: Deployment + Phase F

Build an MCP (Model Context Protocol) server that exposes PVL's API as tools for Claude or any LLM.

**What it enables**:
```
User: "Find me top 10 amyloid candidates from S.aureus with length 10-50"
AI:   → calls PVL /api/uniprot/execute (query: "amyloid", organism: 1280, length: 10-50)
      → calls PVL ranking with FF-Helix + SSW weights
      → returns: "Here are the top 10 candidates ranked by aggregation propensity..."
```

**Implementation**:
- MCP server in Python (uses `mcp` SDK) exposing tools:
  - `search_uniprot(query, organism, length_min, length_max, reviewed)` → browse results
  - `analyze_sequences(accessions_or_sequences)` → full PVL pipeline
  - `get_peptide_detail(accession)` → single peptide deep-dive
  - `rank_candidates(dataset_id, weights)` → ranked shortlist
  - `compare_cohorts(dataset_a, dataset_b)` → cohort comparison
- Each tool maps directly to existing PVL API endpoints
- Add domain context as system prompt: amyloid definitions, SSW meaning, FF-Helix interpretation, aggregation thresholds
- Returns structured data that the LLM can interpret and explain

**Architecture**:
```
Claude / ChatGPT / Any LLM
    |
    v
[PVL MCP Server] — tool definitions + domain axioms
    |
    v
[PVL REST API] — existing endpoints, no changes needed
    |
    v
[TANGO + S4PRED + FF-Helix + biochem]
```

**Key files**: New `mcp_server/` directory at repo root with `server.py`, `tools.py`, `prompts.py`

### G2. Scientific Context & RAG — AI-Generated Annotations (Medium-term)
**Effort**: 40-60h | **Status**: NOT STARTED | **After**: G1 + C1 (precomputed DB)

Add retrieval-augmented generation (RAG) so the AI can cite real papers when explaining results.

**What it enables**:
```
User: "Explain why P02743 is a strong amyloid candidate"
AI:   → queries PVL for P02743 predictions
      → retrieves relevant papers from PubMed (amyloid P-component, SAP)
      → generates: "P02743 (Serum amyloid P-component) shows 78% FF-Helix content
        and high aggregation propensity (TANGO score 42.3). This is consistent with
        its known role in amyloid fibril stabilization (Pepys et al., 2006, Nature).
        The SSW region at positions 15-28 suggests a structural switching zone..."
```

**Implementation**:
- PubMed/PMC API integration for paper retrieval (free, no API key needed)
- Vector embedding store for paper abstracts (ChromaDB or similar, local)
- Domain axiom library: structured definitions of amyloids, SSW, FF-Helix, aggregation propensity, helical wheels — "unbreakable truths" the AI must respect
- Citation verification: cross-check that cited papers actually exist and contain claimed information
- Output format: scientific paragraph with inline citations, exportable to LaTeX/BibTeX

**Risk**: AI hallucination of citations is the #1 concern. Mitigation: only cite papers returned by PubMed API search, never generate citation details from memory.

**Key challenge**: Getting the "axioms" right. These are domain-specific rules:
- "A peptide is an amyloid candidate if FF-Helix% > X AND SSW is detected AND aggregation propensity > Y"
- "SSW (Structural Switching Window) is a region where the peptide switches between helix and beta-sheet conformations"
- "FF-Helix (Fibril-Forming Helix) is a helical region that may participate in amyloid fibril formation"
- These must be reviewed and approved by Peleg before deployment

### G3. Generalized Scientific AI Platform (Long-term, Separate Project)
**Effort**: 200+ hours | **Status**: IDEA | **Separate repo/project**

Alex's vision: a scientific version of OpenClaw where researchers can connect their own data sources, define domain axioms, and use AI for analysis.

**What it would be**:
- Pluggable data sources: UniProt, PDB, PubMed, local CSV/databases, lab instruments
- Pluggable analysis tools: PVL, BLAST, InterPro, custom scripts
- Domain axiom editor: define "unbreakable truths" for your field
- AI orchestrator: takes natural language queries, plans multi-step analysis workflows, executes them, explains results with citations

**This is a startup, not a feature.** Companies like Elicit, Consensus, and Semantic Scholar are working on pieces of this with significant funding. PVL can be the proof-of-concept: "we built AI-assisted peptide analysis, and the architecture generalizes to any scientific domain."

**Decision**: Park as separate project. PVL is the MVP that proves the concept. If it works well (G1 + G2), spin out the generalized platform as a separate initiative.

---



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
