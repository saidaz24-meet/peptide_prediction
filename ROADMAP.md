# PVL Web — Development Roadmap

Translated from proposal docs into actionable phases with crisp scope, acceptance tests, and demo steps.

## 🎯 Overview

This roadmap breaks down the proposed features into phases, prioritizing:
1. **Phase 1**: Core enhancements (UniProt integration, provider status, observability)
2. **Phase 2**: Advanced visualizations (single-sequence drawer, PSIPRED curves)
3. **Phase 3**: Cloud features (Auth + Firestore, dataset persistence)

Each phase includes:
- **Goal**: What we're building
- **Impacted Files**: Exact files to modify
- **New API/DB**: New endpoints or schema changes
- **Acceptance Tests**: How to verify it works
- **Demo Steps**: How to show it to stakeholders

---

## 📦 Phase 1: Core Enhancements (Weeks 1-2)

**Goal**: Improve existing workflows with UniProt integration, provider status visibility, and better observability.

### 1.1 UniProt Query → Analysis Pipeline

**Goal**: Complete the UniProt query flow from input → fetch → window → analyze → display.

**Impacted Files**:
- `backend/server.py` (enhance `/api/uniprot/execute`)
- `backend/services/uniprot.py` (new: windowing logic)
- `ui/src/components/UniProtQueryInput.tsx` (wire to results page)
- `ui/src/pages/Index.tsx` (add UniProt query button)

**New API**:
- `POST /api/uniprot/window` — Window protein sequences into peptides
  - Input: `{ sequences: [{id, sequence}], windowSize: number, stepSize: number }`
  - Output: `{ peptides: [{id, name, sequence, start, end}] }`

**Acceptance Tests**:
1. Query UniProt for "P53_HUMAN" → returns protein sequence
2. Window sequence (windowSize=20, stepSize=5) → returns 50+ peptides
3. Click "Analyze" → redirects to `/results` with peptides loaded
4. Results page shows all peptides with TANGO/PSIPRED results

**Demo Steps**:
1. Open app → click "Query UniProt" on landing page
2. Enter "P53_HUMAN" → click "Fetch"
3. Adjust windowing params (20/5) → click "Window & Analyze"
4. Show results page with peptides → click one to show detail

**Ticket**: `tickets/2024-01-14_001_uniprot_pipeline.md`

---

### 1.2 Provider Status Visibility

**Goal**: Show provider status (TANGO/PSIPRED ON/OFF) in UI with clear indicators.

**Impacted Files**:
- `ui/src/lib/mappers.ts` (add `providerStatus` mapping)
- `ui/src/types/peptide.ts` (add `providerStatus` type)
- `ui/src/components/ProviderStatusBadge.tsx` (new component)
- `ui/src/pages/Results.tsx` (add status pills)
- `ui/src/pages/PeptideDetail.tsx` (show status in header)

**New API**: None (uses existing `providerStatus` from backend)

**Acceptance Tests**:
1. Upload CSV → Results page shows "TANGO: ON (50 hits)" pill
2. Disable TANGO (`USE_TANGO=0`) → Results page shows "TANGO: OFF"
3. Peptide detail page shows provider status in header
4. Export CSV includes provider status column

**Demo Steps**:
1. Upload dataset → show provider status pills in Results header
2. Click peptide → show provider status in detail page
3. Toggle `USE_TANGO=0` in `.env` → restart → show "TANGO: OFF" status

**Ticket**: `tickets/2024-01-14_002_provider_status_ui.md`

---

### 1.3 Enhanced Observability

**Goal**: Add structured logging for runner selection, path resolution, and output counts.

**Impacted Files**:
- `backend/tango.py` (add logging in `run_tango_simple`, `_resolve_tango_binary`)
- `backend/psipred.py` (add logging in `run_psipred`)
- `backend/server.py` (add logging in upload/predict endpoints)
- `backend/services/logging.py` (new: structured logging helper)

**New API**: None (logging only)

**Acceptance Tests**:
1. Upload CSV → logs show `{"event": "tango_runner_selected", "runner": "simple", "reason": "TANGO_SIMPLE=1"}`
2. Upload CSV → logs show `{"event": "tango_path_resolved", "path": "/abs/path/to/Tango/bin/tango"}`
3. Upload CSV → logs show `{"event": "tango_outputs_produced", "count": 50, "requested": 50}`
4. TANGO fails → logs show `{"event": "tango_fatal_zero_outputs", "run_dir": "...", "reason": "..."}`

**Demo Steps**:
1. Start backend with `--log-level=INFO`
2. Upload CSV → show structured JSON logs in console
3. Filter logs by `event` → show runner selection, path resolution, output counts

**Ticket**: `tickets/2024-01-14_003_observability_logging.md`

---

## 📦 Phase 2: Advanced Visualizations (Weeks 3-4)

**Goal**: Add single-sequence drawer with PSIPRED curves and Tango β-aggregation tracks.

### 2.1 Single-Sequence Drawer

**Goal**: Expandable drawer in PeptideDetail showing PSIPRED curves (P(H)/P(E)/P(C)) and Tango β-aggregation track.

**Impacted Files**:
- `ui/src/components/SequenceDrawer.tsx` (new component)
- `ui/src/pages/PeptideDetail.tsx` (add drawer toggle)
- `backend/server.py` (add `/api/peptides/:id/secondary-structure` endpoint)
- `backend/services/secondary_structure.py` (enhance with PSIPRED curve data)

**New API**:
- `GET /api/peptides/:id/secondary-structure` — Get PSIPRED curves and Tango track
  - Output: `{ psipred: { positions: number[], pHelix: number[], pSheet: number[], pCoil: number[] }, tango: { positions: number[], aggregation: number[] } }`

**Acceptance Tests**:
1. Click peptide → detail page shows "Show Secondary Structure" button
2. Click button → drawer opens with PSIPRED curves (3 lines: H/E/C)
3. Drawer shows Tango β-aggregation track below curves
4. Curves align with sequence positions (1-indexed)

**Demo Steps**:
1. Upload dataset → click peptide → show detail page
2. Click "Show Secondary Structure" → drawer slides up
3. Show PSIPRED curves (H/E/C) with sequence positions
4. Show Tango β-aggregation track below curves

**Ticket**: `tickets/2024-01-14_004_sequence_drawer.md`

---

### 2.2 Segment Ribbons Overlay

**Goal**: Visual ribbon overlay on sequence track showing helix segments from JPred.

**Impacted Files**:
- `ui/src/components/SegmentTrack.tsx` (enhance with ribbon rendering)
- `ui/src/pages/PeptideDetail.tsx` (integrate ribbons)

**New API**: None (uses existing `jpred` data)

**Acceptance Tests**:
1. Peptide with JPred helix segments → ribbons render on sequence track
2. Ribbons align with sequence positions
3. Hover ribbon → tooltip shows segment range (e.g., "Helix: 5-12")

**Demo Steps**:
1. Click peptide with JPred data → show detail page
2. Show sequence track with ribbon overlays
3. Hover ribbon → show tooltip with segment info

**Ticket**: `tickets/2024-01-14_005_segment_ribbons.md`

---

## 📦 Phase 3: Cloud Features (Weeks 5-6)

**Goal**: Add authentication and Firestore integration for dataset persistence.

### 3.1 Firebase Auth Integration

**Goal**: Sign-in with Google/Firebase, protect routes, show user info.

**Impacted Files**:
- `ui/src/services/auth.ts` (new: Firebase Auth wrapper)
- `ui/src/components/AuthButton.tsx` (new component)
- `ui/src/pages/Index.tsx` (add sign-in button)
- `ui/src/App.tsx` (add auth route guards)
- `backend/server.py` (add `/api/auth/verify` endpoint)

**New API**:
- `POST /api/auth/verify` — Verify Firebase token
  - Input: `{ token: string }`
  - Output: `{ uid: string, email: string }`

**Acceptance Tests**:
1. Click "Sign In" → Firebase auth popup appears
2. Sign in with Google → user info appears in header
3. Protected routes redirect to sign-in if not authenticated
4. Sign out → redirects to landing page

**Demo Steps**:
1. Open app → click "Sign In"
2. Sign in with Google → show user info in header
3. Navigate to protected route → show auth guard

**Ticket**: `tickets/2024-01-14_006_firebase_auth.md`

---

### 3.2 Firestore Dataset Persistence

**Goal**: Save/load datasets to Firestore, show "Previous Datasets" list.

**Impacted Files**:
- `ui/src/services/firestore.ts` (new: Firestore wrapper)
- `ui/src/pages/Datasets.tsx` (new: dataset list page)
- `ui/src/pages/Results.tsx` (add "Save Dataset" button)
- `backend/server.py` (add `/api/datasets` endpoints)
- `backend/schemas/firestore.py` (new: Firestore schema)

**New API**:
- `POST /api/datasets` — Save dataset
  - Input: `{ name: string, peptides: Peptide[], userId: string }`
  - Output: `{ id: string }`
- `GET /api/datasets` — List user datasets
  - Output: `[{ id, name, createdAt, peptideCount }]`
- `GET /api/datasets/:id` — Load dataset
  - Output: `{ name, peptides: Peptide[] }`

**Acceptance Tests**:
1. Upload dataset → click "Save Dataset" → prompts for name
2. Save dataset → appears in "Previous Datasets" list
3. Click dataset → loads into Results page
4. Delete dataset → removes from list

**Demo Steps**:
1. Upload dataset → click "Save Dataset" → enter name
2. Navigate to "Previous Datasets" → show saved dataset
3. Click dataset → load into Results page

**Ticket**: `tickets/2024-01-14_007_firestore_persistence.md`

---

## 🧪 Testing Strategy

### Smoke Tests

See `SMOKE_TESTS.md` for one-command smoke tests:
- Phase 1: UniProt upload → Tango → results page
- Phase 2: Sequence drawer → PSIPRED curves → segment ribbons
- Phase 3: Auth → save dataset → load dataset

### Acceptance Tests

Each phase includes acceptance tests in ticket files. Run before marking ticket complete.

### Integration Tests

- `backend/tests/test_uniprot_pipeline.py` (new)
- `backend/tests/test_provider_status.py` (new)
- `ui/src/tests/integration/SequenceDrawer.test.tsx` (new)

---

## 📋 Phase 1 Quick Start

**Prerequisites**:
- Backend running (`cd backend && uvicorn server:app --reload`)
- Frontend running (`cd ui && npm run dev`)
- TANGO binary available (`USE_TANGO=1`)

**Steps**:
1. Run smoke test: `./scripts/smoke_uniprot.sh`
2. Open app → test UniProt query flow
3. Verify provider status appears in Results page
4. Check logs for structured logging events

**See**: `SMOKE_TESTS.md` for detailed test commands.

---

## 🎯 Success Criteria

**Phase 1 Complete When**:
- ✅ UniProt query → analysis → results works end-to-end
- ✅ Provider status visible in UI
- ✅ Structured logging shows runner selection, paths, output counts
- ✅ Smoke tests pass

**Phase 2 Complete When**:
- ✅ Sequence drawer opens with PSIPRED curves
- ✅ Tango β-aggregation track renders
- ✅ Segment ribbons overlay on sequence track

**Phase 3 Complete When**:
- ✅ Users can sign in with Firebase
- ✅ Datasets can be saved/loaded from Firestore
- ✅ "Previous Datasets" list works

---

## 📝 Notes

- **Prefer additive changes**: Avoid refactors unless blocking
- **Small commits**: Label with `feat:`, `fix:`, `chore:`, `docs:`
- **Every feature includes tests**: Acceptance tests + demo steps
- **Observability first**: Log new failure modes immediately

---

**Last Updated**: 2024-01-14  
**Next Review**: After Phase 1 completion

