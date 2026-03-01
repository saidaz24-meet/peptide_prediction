# PVL Master Development Document

> **Role**: CEO + CTO consolidated strategic and technical reference.
> **Last updated**: 2026-02-22
> **Scope**: Decisions, priorities, and new insights NOT covered by other active docs.
> **Other active docs**: ACTIVE_CONTEXT.md (architecture), CONTRACTS.md (API), TESTING_GUIDE.md (tests),
> KNOWN_ISSUES.md (bugs), DEPLOYMENT.md (deploy), ROADMAP.md (strategy + features)

---

## 1. Executive Decisions (Resolved Contradictions)

These are CTO-level calls on topics where the corpus had conflicting or unclear direction.

### D1: Reverse Proxy — Caddy (DECIDED)

Both Nginx and Caddy configs exist in `docker/`. **Use Caddy for production** (auto-TLS, zero-config HTTPS).
Nginx stays as a development fallback only. No further work on Nginx config.

- Production: `docker-compose.caddy.yml` + `Caddyfile`
- Dev: `docker-compose.yml` (Nginx frontend image, no TLS)

### D2: Database Strategy — Phased (DECIDED)

The corpus mentions Supabase, PostgreSQL, DuckDB, SQLite, and Redis. **Decision**:

| Phase | Storage | Purpose |
|-------|---------|---------|
| **Now** | localStorage (frontend) | Result persistence across page refresh. Already implemented. |
| **Next** | DuckDB (backend, single file) | Result cache keyed by `(sequence, configHash)`. Zero-config, no server. B6 feature. |
| **Later** | PostgreSQL (if multi-user) | Only if PVL goes public with auth. Not before deployment is stable. |
| **Never (for now)** | Supabase/Railway | Adds vendor dependency. PVL is MIT open-source; keep it self-hostable. |
| **Later** | Redis | Only when async job queue (Celery) is needed for 500+ peptide batches. |

**Key principle**: No database until the pipeline contract is stable and researchers validate outputs.

### D3: Hosting — VM Now, DESY K8s Long-Term (DECIDED, updated 2026-02-22)

- **Now**: Single DESY VM with Docker Compose + Caddy. First deployment target.
- **Medium-term**: Same VM + Celery worker + Redis (if batch sizes exceed timeout before K8s is ready).
- **Long-term**: DESY Kubernetes (confirmed 2026-02-22). DESY will provide managed K8s cluster details (namespace, Ingress Controller, quotas). PVL creates Helm chart with Deployment/Service/Ingress manifests. Docker images are already K8s-ready.
- **K8s Ingress**: The cluster's Ingress Controller (likely nginx-ingress) replaces Caddy/nginx entirely. PVL just defines routing rules in Ingress resources. TLS handled by cert-manager at the cluster level.
- **Cloud PaaS** (Railway/Vercel): Parked permanently. PVL needs TANGO binary + S4PRED weights — not suited for serverless.

### D4: GitHub vs GitLab — GitHub Primary (DECIDED)

Stay on GitHub until DESY explicitly requires GitLab. Reasons:
- GHCR already works, Actions configured
- JOSS paper reviewers expect GitHub
- Open-source community visibility
- If GitLab needed later: set up mirror (GitLab has built-in mirroring to GitHub)

### D5: FF-Helix 0%/100% — Not a Bug, Needs Better UI (DECIDED)

The corpus flags concern about FF-Helix showing 0% or 100%. **This is correct behavior**:

- FF-Helix measures **intrinsic amino acid propensity** (context-free, sliding window)
- 0% = no 6-residue window has mean helix propensity >= 1.0
- 100% = all residues participate in qualifying windows
- This is NOT experimental helicity (CD spectroscopy gives 15-50% for membrane peptides)
- **Action**: Add explanation card in UI (tooltip + Help page). Do NOT change the calculation.
- **Peleg's thresholds**: RESOLVED (2026-02-18). Weights and scales match reference repo exactly.

### D6: PSIPRED/JPred — Fully Removed (DECIDED)

- No active execution code anywhere. Only cosmetic comments remain in ~8 files.
- `peptideMapper.ts` still handles legacy CSV column names for backward compatibility — this is correct.
- Archive at `backend/_archive/`. Do not reference in new code.
- S4PRED is the sole secondary structure predictor.

### D7: Threshold Strategy — Three Modes (DECIDED)

| Mode | Threshold Source | Implementation Status |
|------|-----------------|----------------------|
| Single sequence (QuickAnalyze) | User explicitly sets thresholds | Partially implemented (default values used) |
| CSV upload | Auto-computed from cohort OR user-provided OR default | Auto-compute works; UI for user override needs work |
| UniProt query | Same as CSV (user chooses default vs custom) | Uses CSV path internally |

Shared `thresholdConfig` object used across all three flows. Backend `services/thresholds.py` (236 LOC) handles resolution.

### D8: UniProt API — Yes, It's External (DECIDED)

PVL is NOT fully local when UniProt queries are used. The `/api/uniprot/execute` endpoint:
1. Calls UniProt REST API to fetch sequences
2. Then runs local predictions (TANGO, S4PRED, biochem)

This is documented and expected. CSV upload and QuickAnalyze are fully local (no network needed).

---

## 2. Researcher Metric Importance (Column Analysis)

This section captures product insight about what scientists actually care about, organized by decision-making priority. Use this to guide UI emphasis and visualization investment.

### Tier 1: Core Decision-Making Metrics (MUST be prominent)

| Metric | Why Researchers Care | Visualization Priority |
|--------|---------------------|----------------------|
| **SSW Prediction** (TANGO) | The yes/no answer: does this peptide undergo alpha-to-beta structural switch? Determines "investigate further" pile. | Binary heatmaps, traffic-light badges |
| **SSW Score** (TANGO + S4PRED) | Confidence level. Score of 0.9 vs 0.3 determines where to spend limited wet lab resources. | Ranked bar charts, threshold sliders |
| **FF-Helix Flag / FF-SSW Flag** | Direct fibril formation indicators. Fibril formation is the disease endpoint researchers ultimately care about. | Decision tree visualizer, Venn diagrams |
| **Helix Curve + S4PRED P_H** | Per-residue helix probability. Shows exactly WHICH residues are helical and where the structure disappears in aggregation-prone regions. | **HIGHEST-VALUE VISUALIZATION**: Interactive sequence viewer with color-coded probabilities |

### Tier 2: Mechanistic Understanding (HIGH value for analysis)

| Metric | Why Researchers Care |
|--------|---------------------|
| **SSW Fragments** (start/end positions) | WHERE the structural switch happens — enables targeted mutations/drug design |
| **SSW Helix % / Beta %** | MAGNITUDE of structural change — 80% helix converting to beta is more dramatic than 20% |
| **Beta Curve + S4PRED P_E** | Where beta-sheet (= fibril) structure emerges. Overlay with helix curve reveals transition zones. |
| **SSW Diff** | Not all switches are equal. Large diff = dramatic conformational change = more pathogenic. |

### Tier 3: Biophysical Context (Used for filtering and context)

| Metric | Why Researchers Care |
|--------|---------------------|
| **Hydrophobicity** | Hydrophobic residues drive aggregation. Used for initial filtering of large datasets. |
| **Charge** | Highly charged peptides resist aggregation (electrostatic repulsion). Affects drug formulation. |
| **Full-length muH** | Amphipathicity measure. High muH = distinct hydrophobic face = membrane-interacting or amyloid-forming. |
| **Length / Sequence** | Context. Length affects aggregation kinetics. Sequence needed for downstream analysis. |

### Key UI Implication

**Lead with amyloid/aggregation (TANGO)**. It's the most validated, most scientifically impactful output. Show aggregation scores prominently. Present S4PRED as "predicted structure" with confidence note. Label SSW as "Exploratory."

---

## 3. UI Vision: Dashboard Redesign Direction

Current state: Results page shows everything at once (KPIs + table + charts). This is overwhelming.

### Proposed Architecture: Card-Based Progressive Disclosure

```
Results Dashboard
├── Summary Cards (click to expand)
│   ├── Aggregation Risk (TANGO scores, hotspot count)
│   ├── Structural Prediction (S4PRED helix/beta/coil distribution)
│   ├── Fibril Formation (FF-Helix %, FF-SSW flags)
│   ├── Biophysical Properties (hydrophobicity, charge, muH)
│   └── SSW Analysis (chameleon prediction summary)
│
├── Click any card → Opens:
│   ├── Full visualization for that category
│   ├── Relevant chart/graph
│   └── Per-peptide breakdown table for that metric
│
└── Full Data Table (always accessible, separate tab)
```

### Design Principles

1. **Cards with titles only** on the main dashboard — click to open analysis and graphs
2. **Scrolling experience** — professional, modern, research-tool aesthetic
3. **Sidebar**: Icons only (hover for labels), collapsible. Already exists but needs polish.
4. **Theme**: Lock on a final dark/light theme. Use shadcn/ui design system consistently.
5. **No feature before function**: Know exactly what to show before designing how to show it.

### Shared PeptideViewer Component (Priority: HIGH)

QuickAnalyze and PeptideDetail show identical visualizations (~200 lines duplicated).
Extract `<PeptideViewer peptide={p} />` containing:
- SequenceTrack
- HelicalWheel
- S4PRED probability chart
- TANGO aggregation heatmap
- AlphaFold viewer

Effort: 4h. Reduces maintenance burden, ensures consistency.

---

## 4. Highest-Value Visualization Investments

Ranked by researcher impact (CEO decision):

### 1. Per-Residue Profile Viewer (HIGHEST PRIORITY)

Interactive dual-line plot showing P_H and P_E (or TANGO helix/beta curves) across the sequence.
Hover for exact values. Highlight SSW fragments as shaded regions.
**This is the "revealing transitions" visualization.** Researchers literally SEE where helix converts to beta.

Status: Partially exists (SequenceTrack for S4PRED, AggregationHeatmap for TANGO). Needs unification into one interactive multi-track viewer.

### 2. Aggregation Risk Scatter Plot

X = hydrophobicity, Y = muH, color = SSW prediction, size = SSW score.
Click a point to see full peptide details.
Status: Eisenberg scatter exists. Needs SSW score sizing and click-through.

### 3. Cohort Comparison Dashboard

Side-by-side distributions (mutant vs wild-type). Statistical significance indicators.
Status: Compare.tsx exists (B2 DONE). Needs polish.

### 4. Ranked Shortlist with Adjustable Weights

Researchers adjust sliders (SSW score importance: 40%, hydrophobicity: 20%, etc.).
Output: ranked list of top N candidates for experimental validation.
Status: PDF report exists (B8 DONE). Needs interactive weight adjustment.

### 5. FF-Flag Decision Tree Visualizer

Shows how FF-Helix and FF-SSW flags are computed. Which thresholds were crossed?
Builds researcher trust in the algorithm.
Status: Not started. Effort: 4h.

---

## 5. Infrastructure Hardening Checklist (Pre-Production)

### Must-Have Before DESY Deployment

- [x] Multi-stage Dockerfiles (builder + runtime)
- [x] .dockerignore exists (149 lines)
- [x] Non-root container user (`pvl` UID 1000)
- [x] Health checks on all services
- [x] Caddy reverse proxy + auto-TLS
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- [x] SPA fallback routing
- [x] Gzip compression
- [x] Resource limits in compose (CPU/memory)
- [x] JSON access logging
- [x] Sentry error tracking (frontend + backend)
- [x] CORS configured per environment
- [x] Tini init system (proper signal handling)
- [x] BuildKit + build cache
- [x] CI pipeline (lint + typecheck + test + Docker build)
- [x] GHCR image publishing with attestations
- [ ] Pin base images by digest (currently by tag — low risk)
- [ ] Secrets injection via env file (not committed) — `.env.example` exists
- [ ] Image promotion workflow (dev → staging → prod tags)

### Nice-to-Have (Post-Deployment)

- [ ] ufw firewall rules on VM (allow 22, 80, 443 only)
- [ ] SSH key-only auth (disable password)
- [ ] fail2ban for SSH
- [ ] Log rotation (logrotate config)
- [ ] Uptime monitoring (UptimeRobot or similar)
- [ ] Automated backups (not critical — results are regeneratable)
- [ ] Rate limiting on API endpoints
- [ ] CSP (Content Security Policy) header

### Explicitly NOT Needed Now (but K8s is confirmed long-term)

- PostgreSQL / any database
- Redis / job queue
- K8s manifests / Helm charts — parked until DESY provides cluster details (confirmed as long-term target 2026-02-22)
- ArgoCD — evaluate when K8s is active
- systemd units (Docker Compose handles service management)
- PgBouncer / connection pooling
- Blue-green deployment
- Vault / External Secrets
- GitLab CI (GitHub Actions sufficient)

---

## 6. What's Next: Prioritized Sprint Plan

### Sprint 1: Polish Before Deployment (10h)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | README overhaul (screenshots, quick start) | 2h | First impression for JOSS reviewers |
| 2 | FF-Helix explanation card in Results UI | 2h | Prevents scientist confusion |
| 3 | QuickAnalyze back-to-batch navigation | 2h | UX gap |
| 4 | Toast consolidation (sonner only) | 1h | Code hygiene |
| 5 | Stale PSIPRED/JPred comments cleanup | 3h | Code hygiene |

### Sprint 2: Scientist Features (20h)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 6 | Extract shared PeptideViewer component | 4h | Reduces 200 lines duplication |
| 7 | S4PRED visualization improvements (larger interactive view) | 8h | Tier 1 metric visibility |
| 8 | Frontend test setup (Vitest: peptideMapper, datasetStore) | 8h | Quality foundation |

### Sprint 3: Backend Robustness (28h)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 9 | B6: DuckDB result cache | 12h | Results survive backend restart |
| 10 | normalize.py cleanup (700 LOC → ~400 LOC) | 8h | Technical debt |
| 11 | provider_tracking thread safety | 4h | Correctness under concurrency |
| 12 | Error propagation (replace print→log_error) | 4h | Debuggability |

### Sprint 4: Differentiation (28h, post-deployment)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 13 | Shareable result URLs (/results/:runId) | 8h | Collaboration (needs B6) |
| 14 | Plotly.js selective (3D scatter only) | 12h | Publication-quality viz |
| 15 | Batch progress indicator | 4h | UX for large uploads |
| 16 | UI card-based dashboard redesign | 4h | Modern research-tool feel |

### When Unblocked (External Dependencies)

| Blocker | Action When Resolved |
|---------|---------------------|
| DESY VM access | Follow DEPLOYMENT.md step by step |
| Domain (pvl.desy.de) | Set `DOMAIN=pvl.desy.de` in docker/.env |
| bio.tools registration | 1h task after live URL exists |
| Zenodo DOI | 1h task after first GitHub release (v1.0.0) |
| Async job queue | Only when batch sizes exceed 30s timeout (Celery + Redis, 24h) |

---

## 7. Explicitly Parked (Do NOT Build)

These items appeared in the corpus but are explicitly deferred:

| Item | Reason |
|------|--------|
| Supabase auth/DB | No auth needed (open source, public tool). No DB until pipeline is validated. |
| Railway/Vercel deployment | PVL needs binary tools — not suited for serverless. VM is correct. |
| K8s Helm chart | Parked until DESY provides cluster details. Confirmed as long-term target (2026-02-22). |
| ArgoCD | Evaluate when K8s is active. Not before. |
| ESMFold / on-demand structure prediction | Phase C (12+ months). |
| Plugin architecture for external predictors | Phase C. |
| Proteome precomputation | Phase C (needs GPU, K8s CronJobs). |
| LLM-in-the-loop features | Too many failure modes. Doesn't help correctness. |
| Monetization ("sell precalculations") | Long-term vision, not actionable now. |
| Full Plotly.js migration | Only add for charts Recharts genuinely can't do (3D scatter, heatmapgl). |
| Dark mode | Nice-to-have, not before core functionality is polished. |

---

## 8. Competitive Positioning (Locked)

**Tagline**: "The interactive workbench for peptide aggregation research"

**Unique niche**: Only open-source web tool combining TANGO + S4PRED + FF-Helix + SSW with interactive visualization, batch processing, and publication-ready exports.

**Competitors and PVL advantage**:
- TANGO CLI → PVL wraps it in interactive web UI with batch processing
- CamSol → Narrow focus; PVL integrates multiple predictors
- UniProt → No fibril-specific predictions
- AlphaFold DB → No aggregation analysis
- AGGRESCAN → Single algorithm, no visualization

**Target users**: Peptide drug researchers (~5K globally), structural biologists (~50K), bioinformaticians (~200K).

**Publication path**: MIT license (done) → CITATION.cff (done) → Zenodo DOI (after v1.0.0) → JOSS paper → bio.tools registration.

---

## 9. Codebase Vital Signs (2026-02-22 Snapshot)

| Metric | Value |
|--------|-------|
| Backend LOC | ~9,000 (18 services, 8 routes, 5 schemas) |
| Frontend LOC | ~15,000 (10 pages, 27 custom components, 74 UI kit) |
| Tests | 235 passing (deterministic, no network) |
| Docker image | ~800MB backend, ~150MB frontend |
| Config env vars | 28 (all in config.py) |
| Predictors | S4PRED (primary), TANGO (secondary) |
| State management | Zustand (1 store, 389 LOC) |
| Charts | Recharts (primary), custom SVG |
| CI/CD | GitHub Actions (lint + typecheck + test + Docker build + GHCR publish) |

---

## 10. Security Posture

| Concern | Status | Detail |
|---------|--------|--------|
| **Authentication** | None | Open source tool, public access. Not needed. |
| **CORS** | Configured | Allowed origins set via `CORS_ORIGINS` env var. |
| **Input validation** | Active | Pydantic validates all inputs. File size limits in upload. |
| **SQL injection** | N/A | No database. |
| **File upload** | Sandboxed | Files parsed in memory, never written to disk. |
| **TANGO subprocess** | Controlled | Arguments sanitized. No user-controlled shell commands. |
| **Secrets** | Env vars | Sentry DSN via environment. No hardcoded credentials. |
| **HTTPS** | Ready | Caddy auto-HTTPS configured, pending domain. |
| **Rate limiting** | Not implemented | Low risk for research tool. Add in K8s phase if needed. |
| **CSP** | Not implemented | Nice-to-have post-deployment. |

---

## 11. Cost Model

| Resource | Cost | Notes |
|----------|------|-------|
| **Compute** | Free | DESY VM (now) + DESY K8s (long-term) |
| **Storage** | Free | DESY VM disk / K8s PVC |
| **HTTPS certificates** | Free | Caddy + Let's Encrypt (VM) / cert-manager (K8s) |
| **CI/CD** | Free | GitHub Actions (free tier sufficient) |
| **Container registry** | Free | GitHub Container Registry (GHCR) |
| **Monitoring** | Free | Sentry free tier (5000 errors/month) |
| **External APIs** | Free | UniProt API (public, no auth required) |
| **ML models** | Free | S4PRED weights (open source) |
| **TANGO** | Free | Academic license |

**Total operational cost: $0/month**

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S4PRED weights corrupted/lost | Low | High | Backup in reference repo. PVC with snapshots (K8s). |
| TANGO binary incompatible | Medium | Low | Pin Docker base image. TANGO is secondary predictor. |
| UniProt API downtime | Medium | Medium | Graceful error message. CSV upload unaffected. |
| Large upload OOM | Medium | Medium | Docker memory limits. K8s HPA (future). |
| S4PRED slow for large datasets | High | Low | Future: GPU inference, result caching, precompute. |
| Schema drift (backend/frontend) | Low | High | `api_models.py` is protected. 40+ contract tests. |
| Single VM failure | Medium | High | Acceptable for Phase 1. K8s multi-replica (Phase 2). |
