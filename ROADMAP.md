# PVL Web — Development Roadmap

## Overview

Peptide Visual Lab (PVL) combines aggregation propensity (TANGO), secondary structure prediction (S4PRED), and fibril-forming helix detection (FF-Helix) in one web interface with publication-ready visualizations.

**Status**: Phase A complete, Phase B 6/8 done. Deployed on DESY VM with Caddy reverse proxy.

---

## Completed Phases

### Phase A: Paper-Ready (DONE)
- UniProt cross-links (clickable accessions)
- Publication-ready SVG/PNG export
- Example datasets (3 curated sets)
- CITATION.cff (DOI pending live URL)
- A4 (bio.tools) and A5 (Zenodo DOI) need live URL

### Phase B: User Adoption Features (6/8 DONE)
| Item | Status | Description |
|------|--------|-------------|
| B1. Async Job Queue | NOT STARTED | Celery + Redis for batch > 500 peptides |
| B2. Cohort Comparison | DONE | Side-by-side dataset analysis |
| B3. Plotly.js Charts | NOT STARTED | Advanced scientific visualizations |
| B4. AlphaFold DB | DONE | pLDDT metrics + Mol* 3D viewer |
| B5. Backend Cleanup | PARTIAL | Dead code removed, full extract deferred |
| B6. DuckDB Cache | NOT STARTED | Persist predictions to disk |
| B7. Progressive Disclosure | DONE | 3-tab layout (Data Table / Ranking / Charts) |
| B8. PDF Report | DONE | Ranked shortlist with summary stats |
| B9. QuickAnalyze Upgrade | DONE | Full PeptideDetail-parity visualization |

### Infrastructure
- S4PRED integration (primary predictor, replaces PSIPRED)
- TANGO integration with per-residue curve exposure
- Docker multi-stage build (~800MB target)
- Caddy reverse proxy with auto-TLS
- Sentry error tracking (frontend + backend)
- 235 passing tests

---

## Remaining Work

### Phase B Remaining
- **B1**: Async job queue — blocked on DESY VM resources
- **B3**: Plotly.js charts — low priority (Recharts handles current needs)
- **B5**: Full server.py refactor — 814-line `execute_uniprot_query` monolith needs dedicated plan
- **B6**: DuckDB cache — blocked on deployment stability

### Phase C: Platform Scale (1-2 years)
- C1. Proteome precomputation (K8s CronJobs)
- C2. Kubernetes deployment (Helm chart)
- C3. ESMFold/AlphaFold on-demand prediction (GPU)
- C4. Plugin architecture for external predictors
- C5. Full Mol* 3D viewer integration

See `docs/active/FUTURE_IMPLEMENTATIONS.md` for detailed specs and effort estimates.

---

## Technical Debt

| ID | Issue | Priority | When to Fix |
|----|-------|----------|-------------|
| TD-01 | JPred column names in dataframe_utils.py, biochem.py | LOW | During B5 refactor |
| TD-02 | server.py ~1300 lines (after cleanup) | MEDIUM | B5 (dedicated task) |
| TD-03 | normalize.py duplicate fallback logic ~700 lines | MEDIUM | B5 (dedicated task) |
| TD-07 | Global mutable state (provider_tracking) not thread-safe | MEDIUM | B1 (Celery migration) |

---

## Blocked Items

| Item | Waiting For | Notes |
|------|-------------|-------|
| TANGO Linux binary | Peleg | macOS binary works, need Linux for VM |
| Domain name | DESY IT | Caddy config ready |
| K8s namespace | DESY IT | Phase C only |

---

**Last Updated**: 2026-02-13
