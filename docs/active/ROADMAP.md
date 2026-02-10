# Peptide Visual Lab (PVL) - Development Roadmap

**Last Updated**: 2026-02-07
**Status**: Active Development (pre-paper)
**Branch**: `ref-impl-replacement`

---

## Current Status Summary

### What's Complete
- FastAPI backend with TANGO + S4PRED integration
- React/TypeScript frontend with full analysis dashboard
- Biochemical calculations (Charge, Hydrophobicity, muH, FF-Helix%)
- SSW detection pipeline (TANGO-based and S4PRED-based)
- UniProt query integration (search, parse, window)
- Provider status tracking (TANGO, S4PRED)
- Docker multi-stage builds with CPU-only PyTorch optimization
- CI/CD pipeline (GitHub Actions)
- Caddy auto-HTTPS configuration (ready to switch, pending domain)
- Smart candidate ranking with adjustable weights
- Per-residue sliding-window profiles (hydrophobicity, muH)
- S4PRED per-residue probability curves
- CSV/PDF export functionality
- PSIPRED/JPred fully removed from active codebase

### What's Missing
- No Kubernetes manifests
- No database layer (Postgres planned)
- Data table search/filter not fully functional
- Cloud save/load not implemented
- Per-residue profile viewer as standalone visualization (partially in PeptideDetail)

---

## Immediate Next Steps (Priority Order)

### Step 1: S4PRED Full Verification
**Priority**: HIGHEST | **Status**: DONE (2026-02-07)

S4PRED fully verified against reference implementation. Key changes:
- Rewrote `filter_by_s4pred_diff` to use database-average threshold (matching reference `calc_ssw_prediction_by_database_avg_value`), with bugfix for diff=-1 misclassification
- Added SSW prediction generation to `predict_service.py` (was missing)
- Fixed missing `get_trace_id` import in `predict_service.py`
- Verified E2E with Melittin, alanine-rich, and glycine test sequences
- 24 golden tests added (`test_s4pred_golden.py`)
- Removed duplicate `s4pred?` property in UI `peptide.ts`
- S4PRED weights path documented in `.env.example`

- [x] Copy model weights from reference repo to deployment location
- [x] Verify S4PRED output matches reference for known test sequences
- [x] Run end-to-end test: upload CSV -> S4PRED predictions appear
- [x] Verify SSW detection from S4PRED matches reference (swapped helix/beta params)
- [x] Add golden test for S4PRED analysis functions

**Files changed**: `backend/s4pred.py`, `backend/services/predict_service.py`, `backend/tests/test_s4pred_golden.py`, `backend/.env.example`, `ui/src/types/peptide.ts`

### Step 2: FF-Helix Verification
**Priority**: HIGH | **Status**: DONE (2026-02-07)

FF-Helix verified. Key findings and changes:

**Algorithm comparison**: Our `ff_helix_percent` (Chou-Fasman sliding-window propensity) is NOT the same as the reference's FF-Helix (database-level binary classification using S4PRED helix segments + μH threshold). They are complementary:
- Our `ff_helix_percent`: per-sequence, no dependencies, always computable
- Reference FF-Helix: database-level, requires S4PRED helix prediction + database average μH

**Bugs fixed in `apply_ff_flags`** (dataframe_utils.py):
- SSW threshold used wrong filter (`!= 1` → `!= -1`), computing avg of wrong population
- Updated to use S4PRED helix data (computes `Helix (s4pred) uH` from fragments)
- Falls back to JPred columns if S4PRED not available

**34 golden tests** added (`test_ff_helix_golden.py`):
- ff_helix_percent: propensity, edge cases, NaN/None, range validation, Melittin
- ff_helix_cores: segments, 1-indexing, merging, empty input
- apply_ff_flags: SSW threshold, S4PRED integration, missing data
- _compute_helix_uh: segment μH computation, edge cases

- [x] Document exact algorithm (window size=6, threshold=1.0, Chou-Fasman propensity scale)
- [x] Compare output to reference implementation for test cases
- [ ] Verify Peleg's suggested changes are applied (pending: user to specify)
- [x] Confirm FF-Helix works independently of TANGO/S4PRED (invariant: pure Python)
- [x] Add golden tests for ff_helix_percent() and ff_helix_cores()

**Files changed**: `backend/services/dataframe_utils.py`, `backend/tests/test_ff_helix_golden.py`

### Step 3: Documentation Consolidation
**Priority**: HIGH | **Status**: DONE (2026-02-07)

Created `docs/MASTER_GUIDE.md` (~420 lines) with:
1. User Journey (3 paths: CSV upload, Quick Analyze, UniProt query)
2. File-by-File Explanation (all backend + frontend core files)
3. Code Flow Walkthrough (upload pipeline, S4PRED flow, normalization pipeline)
4. The Science (FF-Helix, FF-SSW, S4PRED neural network)
5. Configuration & Deployment guide (env vars, Docker, S4PRED weights)
6. Testing section (214 tests, categories)
7. Future Roadmap summary

### Step 4: Meeting Walkthrough Document
**Priority**: MEDIUM | **Status**: DONE (2026-02-07)

Created `docs/MEETING_WALKTHROUGH.md` (~200 lines) for biologist/PhD audience:
- What PVL does (non-technical)
- The science (SSW, FF-Helix biological meaning, S4PRED explanation)
- Demo walkthrough (Upload → Results → Detail → Export)
- Output column dictionary (all metrics explained)
- Discussion questions for supervisor meeting

### Step 5: FF Flags/Scores in API
**Priority**: HIGH | **Status**: DONE (2026-02-07)

Added 4 new fields to API response:
- `ffHelixFlag`: 1 (candidate), -1 (not candidate), null (no data). S4PRED-based.
- `ffHelixScore`: helix_uH + helix_score
- `ffSswFlag`: 1 (candidate), -1 (not candidate), null (no data)
- `ffSswScore`: Hydrophobicity + Beta_uH(160°) + Full_length_uH(100°) + SSW_prediction

**Files changed**: `dataframe_utils.py`, `peptide.py`, `api_models.py`, `normalize.py`, `peptide.ts`, `test_ff_helix_golden.py`

### Step 6: Documentation Suite
**Priority**: MEDIUM | **Status**: DONE (2026-02-07)

Created 3 audience-specific docs:
- `docs/TEAM_GUIDE.md` — Non-technical (restaurant metaphor, troubleshooting, glossary)
- `docs/DEVELOPER_REFERENCE.md` — Developers (call graphs, debugging workflows, function signatures)
- `docs/SYSTEM_OVERVIEW.md` — Technical stakeholders (design decisions, scalability, deployment)

---

## Infrastructure Phases

### Phase 5: Docker Optimization
**Status**: DONE (2026-02-07)

| Task | Status | Impact |
|------|--------|--------|
| Split requirements.txt (prod/dev) | Done | Dev deps removed from image |
| CPU-only PyTorch via --extra-index-url | Done | ~1.8GB saved |
| Remove USE_JPRED from compose files | Done | Cleanup |
| Multi-stage build | Done (existing) | Minimal runtime image |
| **Target**: ~800MB-1GB | Ready to verify | Was ~3GB |

### Phase 6: Caddy Auto-HTTPS
**Status**: READY TO SWITCH (2026-02-07)

| Task | Status | Notes |
|------|--------|-------|
| Create docker/Caddyfile | Done | Uses $DOMAIN env var |
| Create docker-compose.caddy.yml | Done | Full prod config |
| **To activate**: Set `DOMAIN=x.desy.de` in `.env` | Pending | One step |
| Test with staging domain | Pending | After domain assigned |
| Update deployment docs | Pending | After testing |

### Phase 7: Kubernetes Deployment
**Status**: NOT STARTED

- [ ] Create `k8s/` directory with manifests
- [ ] Backend Deployment + Service + HPA
- [ ] Frontend Deployment + Service
- [ ] Caddy/Ingress configuration
- [ ] PersistentVolumeClaim for tools/models
- [ ] ConfigMap for environment variables
- [ ] Secret for Sentry DSN
- [ ] DESY K8s namespace setup

### Phase 8: CI/CD with ArgoCD
**Status**: NOT STARTED (depends on Phase 7)

- [ ] ArgoCD Application manifest
- [ ] GitHub Actions: build -> push GHCR -> update manifest tag
- [ ] GitOps workflow: commit to k8s/ triggers deploy
- [ ] Multi-environment support (dev/staging/prod)

---

## Feature Phases

### Phase 9: UI Polish & Missing Features
**Status**: Partially complete

| Feature | Current State | Priority |
|---------|--------------|----------|
| Data table search | Working (globalFilter in PeptideTable.tsx) | DONE |
| Data table filters | Button renders, not functional | MEDIUM |
| ColumnMapper component | Exists unused (auto-detect works) | LOW |
| Cloud save/load | Listed in About, not implemented | LOW (post-paper) |
| FeedbackDialog integration | Component exists, unclear usage | LOW |
| Mobile responsive polish | Basic responsive, needs testing | LOW |

### Phase 10: Advanced Visualizations
**Status**: NOT STARTED (document only, implement after paper)

**Highest Value (in order)**:
1. **Per-Residue Profile Viewer** (standalone page)
   - Helix/Beta probability curves with SSW region highlights
   - Interactive: hover for residue details, zoom/pan
   - Currently partially in PeptideDetail.tsx (gated to <200 residues)

2. **Cohort Comparison Dashboard**
   - Side-by-side comparison of two datasets (e.g., mutant vs control)
   - Shared axes, overlay distributions

3. **Aggregation Risk Scatter Plot**
   - Hydrophobicity vs muH, colored by SSW prediction
   - Click to navigate to peptide detail

4. **Ranked Shortlist Generator**
   - Weighted scoring with adjustable sliders (partially done in Results)
   - Export as formatted report

5. **FF-Flag Decision Tree**
   - Visual explanation of why a peptide was flagged
   - Shows which criteria triggered the flag

### Phase 11: Precomputed Proteome (Long-Term Vision)
**Status**: FUTURE (not until paper published)

Architecture for 250M UniProt sequences:
```
Phase 1 (Current): On-demand prediction (seconds-minutes)
Phase 2 (Future):  Hybrid mode (check cache first, predict on miss)
Phase 3 (Vision):  Full proteome coverage (milliseconds for all queries)
```

Required infrastructure:
- PostgreSQL on DESY K8s for structured data
- Redis for hot cache of frequent queries
- K8s CronJobs for scheduled precomputation
- Start with top 10 organisms (~10% of UniProt)

---

## Architecture Constraints (Do Not Violate)

| Constraint | Rule |
|------------|------|
| Cost | Free only. DESY K8s = yes. Supabase = no. |
| Database | Postgres (future, on DESY K8s). No database currently. |
| Predictors | S4PRED = primary. TANGO = secondary. PSIPRED = removed. |
| Auth/Cache | Parked until paper published. |
| Precompute | 250M UniProt sequences = future goal, not now. |
| API contract | `backend/schemas/api_models.py` is single source of truth |
| Null semantics | JSON `null` only. Never `-1`, `"N/A"`, or empty string as sentinel. |

---

## Key Files Reference

### Backend Core
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `backend/server.py` | Main orchestrator, endpoints | ~1500 | Active |
| `backend/tango.py` | TANGO runner/parser | ~1300 | Active |
| `backend/s4pred.py` | S4PRED runner/analyzer | ~670 | Active |
| `backend/auxiliary.py` | FF-Helix + SSW helpers | ~370 | Active |
| `backend/biochem_calculation.py` | Charge, hydrophobicity, muH | ~200 | Active |
| `backend/config.py` | Centralized settings | ~210 | Active |
| `backend/services/normalize.py` | Response normalization | ~740 | Active |
| `backend/schemas/api_models.py` | **CANONICAL** API contract | - | Protected |
| `backend/tools/s4pred/` | S4PRED neural network | - | Active |

### Frontend Core
| File | Purpose | Status |
|------|---------|--------|
| `ui/src/pages/Results.tsx` | Main dashboard | Complete |
| `ui/src/pages/PeptideDetail.tsx` | Peptide deep-dive | Complete |
| `ui/src/pages/Upload.tsx` | Upload workflow | Complete |
| `ui/src/pages/QuickAnalyze.tsx` | Single sequence | Complete |
| `ui/src/stores/datasetStore.ts` | State management | Complete |
| `ui/src/types/peptide.ts` | Domain model | Complete |

### Infrastructure
| File | Purpose | Status |
|------|---------|--------|
| `docker/Dockerfile.backend` | Backend image (optimized) | Ready |
| `docker/Dockerfile.frontend` | Frontend image (nginx) | Ready |
| `docker/docker-compose.yml` | Dev environment | Ready |
| `docker/docker-compose.prod.yml` | Production (nginx) | Ready |
| `docker/docker-compose.caddy.yml` | Production (Caddy + HTTPS) | Ready |
| `docker/Caddyfile` | Caddy config | Ready |
| `docker/nginx.conf` | Nginx config | Ready |
| `.github/workflows/ci.yml` | CI pipeline | Ready |
| `.github/workflows/docker-publish.yml` | Docker image publishing | Ready |

---

## Testing Strategy

### Current Test Coverage
- 214 tests passing (all deterministic, no network)
- Golden tests for SSW algorithm, biochem calculations, preprocessing
- S4PRED golden tests (24 tests: segments, analysis, SSW, filter_by_diff)
- API contract tests for response schema validation
- Trace ID propagation tests
- UniProt query parsing tests

### Missing Tests
- [ ] Integration tests with mocked S4PRED/TANGO
- [ ] Frontend component tests (Vitest/Jest)
- [ ] E2E tests with Playwright

### Test Commands
```bash
make test        # All tests (fast, deterministic)
make test-unit   # Fast unit tests only
make lint        # Python + TypeScript linting
make typecheck   # Type checking
make ci          # Full pipeline
```

---

## Technical Debt Register

| ID | Issue | Priority | Impact |
|----|-------|----------|--------|
| TD-01 | JPred column names still in dataframe_utils.py, biochem.py | LOW | Cosmetic, doesn't affect function |
| TD-02 | server.py is ~1500 lines (target ~500) | MEDIUM | Maintainability |
| TD-03 | normalize.py has duplicate fallback logic (~700 lines) | MEDIUM | Maintainability |
| TD-04 | Mixed import patterns (some local, some top-level) | LOW | Consistency |
| TD-05 | Data table filter button non-functional in Results.tsx | MEDIUM | User experience |
| TD-06 | ColumnMapper component unused but still in codebase | LOW | Cleanup |
| TD-07 | Cloud save/load removed from About.tsx (was unimplemented) | LOW | ✅ DONE |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-01 | api_models.py = canonical schema | Single source of truth |
| 2026-02-01 | Volume-mounted tools (not baked in) | Flexibility, smaller images |
| 2026-02-01 | GitHub Actions for CI | Portable, team preference |
| 2026-02-01 | Null semantics: JSON null only | No sentinel values (-1, "N/A") |
| 2026-02-07 | CPU-only PyTorch in Docker | Saves ~1.8GB, no GPU needed |
| 2026-02-07 | Caddy ready, nginx default | Switch when domain assigned |
| 2026-02-07 | requirements split (prod/dev) | Dev tools out of Docker image |
| 2026-02-07 | Keep _archive/ for reference | Historical context preserved |

---

*This document is the single source of truth for PVL development.*
