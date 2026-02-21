# Active Context: Architecture Overview

**Last Updated**: 2026-02-16
**Purpose**: Single entry point for developers and AI agents working on this codebase.

---

## Quick Start

**What is PVL?** Peptide Visual Lab — a web app for predicting fibril-forming properties of peptides. Upload sequences, get biophysical calculations (charge, hydrophobicity, muH) and structural predictions (TANGO, S4PRED).

**Run locally:**
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000

# Frontend (separate terminal)
cd ui && npm install && npm run dev
```

**Verify:** `curl http://localhost:8000/api/health` → `{"ok": true}`

---

## Entry Points

### Backend Entry Point

**File**: `backend/api/main.py`
**Command**: `uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload`

**Startup Flow**:
1. `api/main.py` creates FastAPI app, initializes Sentry, registers routers
2. Routers are in `backend/api/routes/` (health, upload, predict, uniprot, providers, example, feedback)
3. All business logic lives in `backend/services/` (server.py is a 15-line compatibility shim)

**Key Files**:
- `backend/api/main.py` - FastAPI app creation, middleware, router registration
- `backend/server.py` - Compatibility shim (~15 lines, deprecated)
- `backend/config.py` - Settings and environment variable loading

### Frontend Entry Point

**File**: `ui/src/main.tsx`
**Command**: `npm run dev` (from `ui/` directory)

**Startup Flow**:
1. Initializes Sentry (if `VITE_SENTRY_DSN` set)
2. Renders React app with ErrorBoundary
3. React Router handles routing to pages

**Key Files**:
- `ui/src/App.tsx` - Main React component with routing
- `ui/src/main.tsx` - Entry point with Sentry initialization

---

## Major Data Flow

### Upload Pipeline (POST `/api/upload-csv`)

```
1. File Upload (CSV/TSV/XLSX)
   ↓
2. services/upload_service.py - Parse file, validate, compute FF-Helix
   ↓
3. services/normalize.py:_resolve_header_synonyms() - Normalize column names
   ↓
4. Validate Entry/Sequence columns exist
   ↓
5. biochem_calculation.py - Compute Charge, Hydrophobicity, muH
   ↓
6. auxiliary.py:ff_helix_percent() - Compute FF-Helix% (always computed)
   ↓
7. tango.py:run_tango_simple() - Run TANGO predictions (if USE_TANGO=1)
   ↓
8. s4pred.py:run_s4pred_database() - Run S4PRED predictions (if USE_S4PRED=1)
   ↓
9. services/normalize.py:normalize_rows_for_ui() - Convert to camelCase, add providerStatus
   ↓
10. Response: {rows: PeptideRow[], meta: Meta}
```

### UniProt Query Pipeline (POST `/api/uniprot/execute`)

```
1. Query String (e.g., "P53_HUMAN" or "organism:9606")
   ↓
2. services/uniprot_query.py:parse_uniprot_query() - Detect mode
   ↓
3. services/uniprot_service.py:build_uniprot_export_url() - Build UniProt API URL
   ↓
4. httpx.get() - Fetch from UniProt API
   ↓
5. Parse TSV response, create DataFrame
   ↓
6. (Same as upload pipeline steps 5-10)
```

### Single Sequence Prediction (POST `/api/predict`)

```
1. Form data: {sequence: string, entry?: string}
   ↓
2. services/predict_service.py - Create single-row DataFrame
   ↓
3. (Same as upload pipeline steps 5-9, but single row)
   ↓
4. Response: {row: PeptideRow, meta: Meta}
```

---

## Key Modules and Ownership

### Backend Core

| Module | Location | Owns |
|--------|---------|------|
| **API Routes** | `backend/api/routes/` | FastAPI route handlers (thin wrappers) |
| **Services** | `backend/services/` | Business logic, data processing |
| **Schemas** | `backend/schemas/` | Pydantic models for request/response validation |
| **Calculations** | `backend/calculations/` | Biochemical feature calculations |
| **Legacy Shim** | `backend/server.py` | Compatibility shim (~15 lines). All logic extracted to services/. |

### Services Module Breakdown

| Service | File | Responsibility |
|---------|------|----------------|
| **normalize** | `services/normalize.py` | Column normalization, camelCase conversion, UI aliases |
| **upload_service** | `services/upload_service.py` | Upload processing (CSV parsing, validation, provider orchestration) |
| **predict_service** | `services/predict_service.py` | Single sequence prediction pipeline |
| **uniprot_service** | `services/uniprot_service.py` | UniProt API integration, query execution |
| **uniprot_query** | `services/uniprot_query.py` | UniProt query string parsing, mode detection |
| **provider_tracking** | `services/provider_tracking.py` | TANGO/S4PRED status tracking |
| **provider_status_builder** | `services/provider_status_builder.py` | Shared provider status dict builder |
| **thresholds** | `services/thresholds.py` | FF flag threshold resolution |
| **logger** | `services/logger.py` | Structured JSON logging |
| **trace_helpers** | `services/trace_helpers.py` | Trace ID management |

### External Tools Integration

| Tool | Module | Location | Status |
|------|--------|---------|--------|
| **TANGO** | `backend/tango.py` | `tools/tango/bin/tango` (volume-mounted) | Secondary (USE_TANGO=1) |
| **S4PRED** | `backend/s4pred.py` | `tools/s4pred/models/` (volume-mounted) | Primary (USE_S4PRED=1) |

### Frontend Core

| Module | Location | Owns |
|--------|---------|------|
| **API Client** | `ui/src/lib/api.ts` | HTTP client, API calls |
| **Data Mapping** | `ui/src/lib/peptideMapper.ts` | Backend → UI model conversion |
| **Schema** | `ui/src/lib/peptideSchema.ts` | CSV header → camelCase mapping |
| **SVG Export** | `ui/src/lib/svgExport.ts` | SVG/PNG export utility |
| **AlphaFold** | `ui/src/lib/alphafold.ts` | AlphaFold DB API client |
| **Pages** | `ui/src/pages/` | React page components (9 pages) |
| **Components** | `ui/src/components/` | Reusable UI components (21+ components) |
| **Stores** | `ui/src/stores/` | Zustand state management (with persistence) |

---

## Data Formats

### Backend → Frontend (API Response)

**Format**: camelCase (e.g., `id`, `sequence`, `sswPrediction`, `ffHelixPercent`)
**Schema**: `backend/schemas/api_models.py:PeptideRow`
**Normalization**: `backend/services/normalize.py:normalize_rows_for_ui()`

**Required Fields**:
- `id` (string) - Entry/accession ID
- `sequence` (string) - Amino acid sequence

**Forbidden Fields** (in API responses):
- Capitalized keys (e.g., `Entry`, `Sequence`, `FF-Helix %`)
- These are CSV format, not API format

### Frontend → Backend (File Upload)

**Format**: CSV/TSV/XLSX with headers
**Required Columns**: `Entry` (or `Accession`, `ID`) and `Sequence`
**Optional Columns**: `Length`, `Protein name`, `Organism`, etc.

---

## Configuration

**File**: `backend/config.py`
**Source**: Environment variables (`.env` file or system env)

**Key Flags**:
- `USE_TANGO=1` - Enable TANGO predictions (secondary)
- `USE_S4PRED=1` - Enable S4PRED secondary structure prediction (primary)
- `TANGO_MODE=simple` - TANGO runner mode (simple/host/docker)
- `CORS_ORIGINS` - Allowed frontend origins
- `SENTRY_DSN` - Sentry error tracking (optional)

---

## Important Invariants

1. **Entry ID Alignment**: Entry IDs must match between input and output
2. **Response Format**: All API responses use camelCase keys (not capitalized)
3. **FF-Helix%**: Always computed (no external dependency)
4. **Provider Status**: Every row includes `providerStatus` (TANGO/S4PRED availability)
5. **Trace IDs**: All requests have trace IDs for logging correlation
6. **Null Semantics**: JSON `null` only — never `-1`, `"N/A"`, or empty string as sentinel
7. **Prediction -1**: `-1` is a valid value for sswPrediction, s4pred*Prediction, ffHelixFlag, ffSswFlag

---

## Migration Status

**Current State**: COMPLETE. All business logic extracted to services/. server.py is a 15-line shim.

| Component | Status | Notes |
|-----------|--------|-------|
| Route handlers (`api/routes/`) | Done | All endpoints have thin route handlers |
| App setup (`api/main.py`) | Done | Middleware, CORS, Sentry configured |
| Upload service | Done | `services/upload_service.py` |
| Predict service | Done | `services/predict_service.py` |
| UniProt service | Done | `services/uniprot_execute_service.py` (635 LOC) |
| Feedback service | Done | `services/feedback_service.py` (~160 LOC) |
| Provider status builder | Done | `services/provider_status_builder.py` |
| `server.py` | Done | Gutted from 1293 → 15 LOC (2026-02-16) |

---

## Deep Dive Resources

| Resource | Purpose |
|----------|---------|
| `docs/active/CONTRACTS.md` | API request/response shapes |
| `docs/active/TESTING_GUIDE.md` | Test commands and setup |
| `docs/active/KNOWN_ISSUES.md` | Issue backlog (all 17 issues resolved) |
| `docs/active/DEVELOPER_REFERENCE.md` | Deep technical reference (data pipeline, null semantics, debugging) |
| `docs/active/DEPLOYMENT_GUIDE.md` | Step-by-step VM + K8s deployment |
| `docs/active/DEPLOYMENT_SPEC.md` | VM sizing and resource analysis |
| `docs/active/FUTURE_IMPLEMENTATIONS.md` | Detailed future roadmap |
| `docs/active/MASTER_DEV_DOC.md` | Strategic decisions, security, risk register |
| `docs/active/ROADMAP.md` | Development roadmap and completed work |
| `README_EXPLAINER.md` | Non-technical A-Z team guide |
