# Peptide Visual Lab (PVL) - Development Roadmap

**Last Updated**: 2026-02-13
**Status**: Active Development (pre-paper, deployment-ready)
**Branch**: `ref-impl-replacement`

---

## Strategic Position

PVL occupies a unique niche: the **only web tool** combining aggregation propensity (TANGO), secondary structure prediction (S4PRED), fibril-forming helix detection (FF-Helix), and SSW prediction with interactive visualizations. Nearest competitors (PASTA 2.0, Waltz, AGGRESCAN) are single-algorithm, non-visual, or offline-only.

**Open source path**: MIT license → CITATION.cff (done) → Zenodo DOI → bio.tools → JOSS paper
**Deployment path**: VM (current target) → VM + Queue → K8s (long-term)

---

## Current Status Summary

### What's Complete
- FastAPI backend with TANGO + S4PRED integration
- React/TypeScript frontend with full analysis dashboard
- Biochemical calculations (Charge, Hydrophobicity, muH, FF-Helix%)
- SSW detection pipeline (TANGO-based and S4PRED-based)
- UniProt query integration (search, parse, window)
- Provider status tracking (TANGO, S4PRED)
- Docker multi-stage builds with CPU-only PyTorch (~800MB target)
- CI/CD pipeline (GitHub Actions, strict gates)
- Caddy auto-HTTPS configuration (ready, pending domain)
- Smart candidate ranking with adjustable weights
- Per-residue sliding-window profiles (hydrophobicity, muH)
- S4PRED per-residue probability curves + colored SequenceTrack
- CSV/PDF/FASTA export (single + bulk)
- Helical wheel projection (HeliQuest colors, Eisenberg μH arrow)
- Collapsible sidebar navigation (desktop + mobile)
- Classification summary with FF-Helix/SSW breakdown
- UniProt & AlphaFold quick links (gated to valid accessions)
- CITATION.cff (CFF 1.2.0)
- Sentry error tracking (frontend + backend, full configuration)
- Pinned Python dependencies with bounded version ranges
- Tightened CORS (explicit methods + headers)
- DEPLOYMENT_SPEC.md (Phase 1: 4-core/8GB, Phase 2: 8-core/16GB)
- PSIPRED/JPred fully removed from active codebase
- 214 passing tests (all deterministic, no network)

### Waiting for DESY Team
| Item | Contact | Notes |
|------|---------|-------|
| TANGO Linux binary | Peleg | License + binary (macOS works locally) |
| Domain name | DESY IT | Caddy config ready, just needs `DOMAIN=x.desy.de` |
| VM SSH access | DESY IT | DEPLOYMENT_SPEC.md ready |
| GitLab migration | DESY IT | Mirror strategy documented |
| Peleg's FF-Helix changes | Peleg | May change scoring parameters |

---

## Phase A: Paper-Ready (Immediate)

Items that can be done independently, no DESY input needed.

| ID | Task | Effort | Status |
|----|------|--------|--------|
| A1 | UniProt cross-links (clickable IDs) | 2h | DONE |
| A2 | Publication-ready SVG/PNG export | 4h | DONE |
| A3 | Example datasets ("Try example data") | 3h | DONE |
| A4 | bio.tools registration | 1h | TODO (needs live URL) |
| A5 | Zenodo DOI | 1h | TODO (needs GitHub release) |

---

## Phase B: User Adoption (3-6 months)

| ID | Task | Effort | Notes |
|----|------|--------|-------|
| B1 | Async job queue (Celery + Redis) | 24h | Needs VM; unlocks 500+ peptide batches |
| B2 | Cohort comparison dashboard | 16h | DONE (overlay charts + delta table) |
| B3 | Plotly.js scientific charts | 12h | Heatmaps, 3D scatter (alongside Recharts) |
| B4 | AlphaFold DB integration + Mol* viewer | 16h | DONE (iframe viewer, pLDDT metrics) |
| B5 | server.py refactor (~1500 → ~500 lines) | 16h | High risk, needs test coverage first |
| B6 | DuckDB result cache | 12h | Persist results across restarts |
| B7 | Progressive disclosure (Simple/Advanced) | 8h | DONE (3-tab layout) |
| B8 | Ranked shortlist PDF report | 8h | DONE (data-driven PDF) |

---

## Phase C: Platform Scale (1-2 years)

| ID | Task | Effort | Blocked By |
|----|------|--------|------------|
| C1 | Proteome precomputation (top 10 organisms) | 40h | K8s access |
| C2 | Kubernetes deployment (Helm chart) | 24h | K8s namespace |
| C3 | ESMFold/AlphaFold on-demand prediction | 24h | GPU access |
| C4 | Plugin architecture (provider interface) | 16h | — |
| C5 | Mol* 3D full integration (MolViewSpec) | 20h | — |

---

## Completed Steps (2026-02-07 — 2026-02-12)

### Algorithm Verification (Feb 7)
- [x] **S4PRED**: Verified against reference, 24 golden tests
- [x] **FF-Helix**: Verified, 34 golden tests, apply_ff_flags bugfix
- [x] **FF Flags in API**: ffHelixFlag, ffHelixScore, ffSswFlag, ffSswScore

### Infrastructure Hardening (Feb 11)
- [x] Pinned all Python deps (bounded version ranges)
- [x] Fixed CI gates (removed all continue-on-error)
- [x] Tightened CORS (explicit methods + headers)
- [x] Aligned proxy timeouts (120s → 600s nginx + Caddy)
- [x] Sentry full setup (LoggingIntegration, build args)
- [x] DEPLOYMENT_SPEC.md (VM sizing, 2-phase plan)
- [x] Strategic analysis (competitive landscape, open source path)

### UI Batch 1 (Feb 12)
- [x] S4PRED SequenceTrack (colored residues + hover probabilities)
- [x] Collapsible sidebar navigation (desktop + mobile responsive)
- [x] Classification summary (replacing broken threshold tuner)
- [x] Help page: FF-Helix docs + Scientific Notes section

### UI Batch 2 (Feb 12)
- [x] FASTA export (single + bulk)
- [x] Removed debug endpoints (/api/debug/config, /api/test-sentry)
- [x] TANGO subprocess timeout (3600s → 300s)
- [x] CITATION.cff (CFF 1.2.0)
- [x] Tooltip decimal precision fix

### UI Batch 3 (Feb 12)
- [x] Helical wheel diagram (SVG, HeliQuest colors, μH arrow)
- [x] CSS --beta/--coil variables (fixed invisible P(Beta) chart line)
- [x] UniProt accession validation (gates AlphaFold button + links)
- [x] About page updated (new features, fixed broken Sentry test button)
- [x] FUTURE_IMPLEMENTATIONS.md (comprehensive roadmap with effort estimates)

### UI Batch 4 (Feb 13)
- [x] SSW labeling: all SSW references labeled with source (TANGO vs S4PRED)
- [x] EvidencePanel: shows BOTH TANGO + S4PRED SSW with disagreement warning
- [x] Radar chart tooltip spacing fix + μH uses actual cohort mean
- [x] S4PRED Helix % added to: PositionBars, RadarChart, EvidencePanel
- [x] meanMuH + meanS4predHelixPercent added to DatasetStats
- [x] SSW pie chart: fixed "Not available" → "Uncertain" for sswPrediction=0
- [x] CSV exports: added S4PRED Helix, S4PRED SSW, FF-Helix flag, FF-SSW flag
- [x] Production debug cleanup: removed 20+ console.log/DEBUG_TRACE statements
- [x] Removed unused SSWPrediction import from Results.tsx

### UI Batch 5 (Feb 13)
- [x] Table header tooltips: info-icon tooltips on 7 scientific columns
- [x] S4PRED Helix KPI card: 5th KPI card with "context-dependent" subtitle
- [x] FF-Helix vs S4PRED interpretation: amber alert explaining discrepancy
- [x] S4PRED dominant structure summary: avg composition in PeptideDetail header
- [x] FF-Helix "intrinsic propensity" subtitle on KPI card and PeptideDetail

### UI Batch 6 (Feb 13)
- [x] Table column overflow fix: overflow-x-auto + column visibility toggle
- [x] Column visibility defaults: Species and S4PRED SSW hidden by default
- [x] SSW predictor agreement stats: TANGO vs S4PRED agreement note under pie chart

### UI Batch 7 (Feb 13)
- [x] Progressive disclosure: 3-tab layout (Data Table default | Ranking | Charts)
- [x] Data Table is now the default view (was hidden behind Charts tab)
- [x] Smart Ranking + Classification Summary moved to dedicated Ranking tab
- [x] Percentile labels fixed: "Above/Below Average" → "Above/Below median"
- [x] Percentile interpretation clarified: "within this dataset (not absolute)"

### Backend Hardening (Feb 13)
- [x] Fix case sensitivity bug: S4PRED availability check always returned 0 (uppercase vs lowercase)
- [x] Fix hydrophobicity KeyError crash on non-standard amino acids (X, O, J)
- [x] Fix hydrophobic moment TypeError on unknown residues (None * float)
- [x] Add O→K (pyrrolysine) and J→L (Leu/Ile) to `get_corrected_sequence()`
- [x] TANGO Linux hardening: platform-gate macOS xattr calls
- [x] TANGO run dir collision prevention: microsecond precision in timestamps
- [x] TANGO explicit UTF-8 encoding on all file I/O
- [x] 21 new tests for non-standard amino acid handling (235 total)

### Scientist Features (Feb 13)
- [x] Result persistence: peptides, stats, meta survive page refresh (Zustand persist)
- [x] TANGO per-residue curves added to API schema (tangoAggCurve, tangoBetaCurve, tangoHelixCurve)
- [x] Aggregation heatmap: per-residue TANGO aggregation bar chart in PeptideDetail
- [x] Beta + Helix overlay (expandable) with peak/hotspot summary stats
- [x] S4PRED pre-sanitization: non-standard AAs corrected before PyTorch model

### Phase B Features (Feb 13)
- [x] B8: Ranked shortlist PDF report (data-driven jsPDF with summary, top-N table, methodology)
- [x] B2: Cohort comparison dashboard (overlay histograms, scatter, KPI delta table)
- [x] B4: AlphaFold DB integration (pLDDT metrics, Mol* iframe viewer, PDB download)

### Deep Audit Hardening (Feb 13)
- [x] Fix TANGO segment slicing off-by-one: `prediction[start:end]` → `prediction[start:end+1]`
- [x] Fix `__check_subsegment` inclusive end convention (was returning exclusive end)
- [x] Fix hydrophobic moment NaN/inf guard (returns 0.0 instead of propagating NaN)
- [x] Fix normalize.py: PARTIAL TANGO status no longer nullifies valid data
- [x] Fix `check_secondary_structure_prediction_content` NaN in denominator
- [x] Fix AggregationHeatmap `Math.max(...arr)` stack overflow → safe `.reduce()`
- [x] Fix radar chart NaN from null charge/length values
- [x] Fix localStorage data resurrection on `resetData()`
- [x] Add Zustand persist version migration (v1→v2)
- [x] Add localStorage QuotaExceededError handling (graceful curve-stripping fallback)

---

## Architecture Constraints (Do Not Violate)

| Constraint | Rule |
|------------|------|
| Cost | Free only. DESY K8s = yes. Supabase = no. |
| Database | DuckDB (near-term cache). Postgres (future, K8s). |
| Predictors | S4PRED = primary. TANGO = secondary. PSIPRED = removed. |
| Auth | Not needed (open source, public tool). |
| API contract | `backend/schemas/api_models.py` is single source of truth |
| Null semantics | JSON `null` only. Never `-1`, `"N/A"`, or empty string as sentinel. |

---

## Technical Debt

| ID | Issue | Priority | When to Fix |
|----|-------|----------|-------------|
| TD-01 | JPred column names in dataframe_utils.py, biochem.py | LOW | B5 refactor |
| TD-02 | server.py ~1500 lines | MEDIUM | B5 (dedicated) |
| TD-03 | normalize.py duplicate fallback logic ~700 lines | MEDIUM | B5 (dedicated) |
| TD-04 | canonical.py orphaned (462 LOC, unused) | LOW | Confirm + delete |
| TD-05 | Global mutable state (provider_tracking) not thread-safe | MEDIUM | B1 (Celery) |

---

## Key Files Reference

### Backend Core
| File | Purpose | Lines |
|------|---------|-------|
| `backend/server.py` | Main orchestrator | ~1500 |
| `backend/tango.py` | TANGO runner/parser | ~1300 |
| `backend/s4pred.py` | S4PRED runner/analyzer | ~670 |
| `backend/auxiliary.py` | FF-Helix + SSW helpers | ~370 |
| `backend/biochem_calculation.py` | Charge, hydrophobicity, muH | ~200 |
| `backend/config.py` | Centralized settings | ~210 |
| `backend/services/normalize.py` | Response normalization | ~740 |
| `backend/schemas/api_models.py` | **CANONICAL** API contract | Protected |

### Frontend Core
| File | Purpose |
|------|---------|
| `ui/src/pages/Results.tsx` | Main dashboard with FASTA bulk export |
| `ui/src/pages/PeptideDetail.tsx` | Peptide deep-dive with helical wheel |
| `ui/src/pages/Upload.tsx` | Upload workflow |
| `ui/src/pages/QuickAnalyze.tsx` | Single sequence analysis |
| `ui/src/components/HelicalWheel.tsx` | HeliQuest helical wheel (pure SVG) |
| `ui/src/components/SequenceTrack.tsx` | S4PRED colored residues |
| `ui/src/components/AppSidebar.tsx` | Collapsible sidebar navigation |
| `ui/src/stores/datasetStore.ts` | Zustand state management |

### Infrastructure
| File | Purpose |
|------|---------|
| `docker/Dockerfile.backend` | Backend image (CPU-only PyTorch) |
| `docker/Dockerfile.frontend` | Frontend image (nginx) |
| `docker/docker-compose.caddy.yml` | Production (Caddy + auto-HTTPS) |
| `docker/Caddyfile` | Caddy config |
| `.github/workflows/ci.yml` | CI pipeline (strict gates) |
| `CITATION.cff` | Citation metadata (CFF 1.2.0) |
| `docs/active/DEPLOYMENT_SPEC.md` | VM sizing and deployment plan |
| `docs/active/FUTURE_IMPLEMENTATIONS.md` | Detailed future roadmap |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-01 | api_models.py = canonical schema | Single source of truth |
| 2026-02-01 | Volume-mounted tools (not baked in) | Flexibility, smaller images |
| 2026-02-01 | Null semantics: JSON null only | No sentinel values |
| 2026-02-07 | CPU-only PyTorch in Docker | Saves ~1.8GB, no GPU needed |
| 2026-02-07 | Caddy ready, nginx default | Switch when domain assigned |
| 2026-02-11 | Reverse proxy: Caddy (auto-TLS) | No DESY preference stated |
| 2026-02-11 | No auth needed | Open source, public tool |
| 2026-02-11 | GHCR for images (no Harbor) | DMZ VM can pull from GitHub |
| 2026-02-12 | Helical wheel: pure React SVG | No npm libs exist; zero deps |
| 2026-02-12 | HeliQuest color scheme | Publication standard for AMP |

---

*For detailed implementation notes on each future item, see `docs/active/FUTURE_IMPLEMENTATIONS.md`.*
