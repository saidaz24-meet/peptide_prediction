# Active Context: Architecture Overview

**Last Updated**: 2026-02-05
**Purpose**: Single entry point for developers and AI agents working on this codebase.

---

## Quick Start

**What is PVL?** Peptide Visual Lab — a web app for predicting fibril-forming properties of peptides. Upload sequences, get biophysical calculations (charge, hydrophobicity, μH) and structural predictions (TANGO, S4PRED).

**Run locally:**
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (separate terminal)
cd ui && npm install && npm run dev
```

**Verify:** `curl http://localhost:8000/api/health` → `{"ok": true}`

---

## Entry Points

### Backend Entry Point

**File**: `backend/server.py`  
**Command**: `uvicorn server:app --host 0.0.0.0 --port 8000 --reload`

**Startup Flow**:
1. `server.py` imports `app` from `api/main.py` (at end of file)
2. `api/main.py` creates FastAPI app, initializes Sentry, registers routers
3. Routers are in `backend/api/routes/` (health, upload, predict, uniprot, providers, example, feedback)
4. Legacy endpoint functions remain in `server.py` for backward compatibility

**Key Files**:
- `backend/api/main.py` - FastAPI app creation, middleware, router registration
- `backend/server.py` - Legacy endpoint implementations (2,526 lines - needs refactoring)
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
2. backend/server.py:read_any_table() - Parse file, handle BOM, detect delimiter
   ↓
3. backend/services/normalize.py:canonicalize_headers() - Normalize column names
   ↓
4. backend/server.py:require_cols() - Validate Entry/Sequence columns exist
   ↓
5. backend/calculations/biochem.py:calculate_biochemical_features() - Compute Charge, Hydrophobicity, μH
   ↓
6. backend/auxiliary.py:ff_helix_percent() - Compute FF-Helix% (always computed)
   ↓
7. backend/tango.py:run_tango() - Run TANGO predictions (if USE_TANGO=1)
   ↓
8. backend/s4pred.py:run_s4pred_database() - Run S4PRED predictions (if USE_S4PRED=1)
   ↓
9. backend/services/normalize.py:normalize_rows_for_ui() - Convert to camelCase, add providerStatus
   ↓
10. Response: {rows: PeptideRow[], meta: Meta}
```

### UniProt Query Pipeline (POST `/api/uniprot/execute`)

```
1. Query String (e.g., "P53_HUMAN" or "organism:9606")
   ↓
2. backend/services/uniprot_query.py:parse_uniprot_query() - Detect mode (accession/keyword/organism)
   ↓
3. backend/services/uniprot_service.py:build_uniprot_export_url() - Build UniProt API URL
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
2. backend/server.py:create_single_sequence_df() - Create single-row DataFrame
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
| **Legacy Endpoints** | `backend/server.py` | Original endpoint implementations (being migrated) |

### Services Module Breakdown

| Service | File | Responsibility |
|---------|------|----------------|
| **normalize** | `services/normalize.py` | Column normalization, camelCase conversion, UI aliases |
| **upload_service** | `services/upload_service.py` | Upload processing (currently imports from server.py) |
| **predict_service** | `services/predict_service.py` | Single sequence prediction (currently imports from server.py) |
| **uniprot_service** | `services/uniprot_service.py` | UniProt API integration, query execution |
| **uniprot_query** | `services/uniprot_query.py` | UniProt query string parsing, mode detection |
| **provider_tracking** | `services/provider_tracking.py` | TANGO/S4PRED status tracking |
| **provider_state** | `services/provider_state.py` | Global provider state management |
| **thresholds** | `services/thresholds.py` | FF flag threshold resolution |
| **logger** | `services/logger.py` | Structured JSON logging |
| **trace_helpers** | `services/trace_helpers.py` | Trace ID management |

### External Tools Integration

| Tool | Module | Location | Status |
|------|--------|---------|--------|
| **TANGO** | `backend/tango.py` | `backend/Tango/bin/tango` | Active (USE_TANGO=1) |
| **S4PRED** | `backend/s4pred.py` | PyTorch model weights | Primary (USE_S4PRED=1) |

### Frontend Core

| Module | Location | Owns |
|--------|---------|------|
| **API Client** | `ui/src/lib/api.ts` | HTTP client, API calls |
| **Data Mapping** | `ui/src/lib/peptideMapper.ts` | Backend → UI model conversion |
| **Schema** | `ui/src/lib/peptideSchema.ts` | CSV header → camelCase mapping |
| **Validation** | `ui/src/lib/apiValidator.ts` | Development-only API response validation |
| **Pages** | `ui/src/pages/` | React page components |
| **Components** | `ui/src/components/` | Reusable UI components |
| **Stores** | `ui/src/stores/` | Zustand state management |

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

**Column Mapping**: UI allows manual mapping via `ColumnMapper.tsx`

---

## Configuration

**File**: `backend/config.py`  
**Source**: Environment variables (`.env` file or system env)

**Key Flags**:
- `USE_TANGO=1` - Enable TANGO predictions
- `USE_S4PRED=1` - Enable S4PRED secondary structure prediction (primary)
- `TANGO_MODE=simple` - TANGO runner mode (simple/host/docker)
- `CORS_ORIGINS` - Allowed frontend origins
- `SENTRY_DSN` - Sentry error tracking (optional)

---

## Important Invariants

1. **Entry ID Alignment**: Entry IDs must match between input and output
2. **Response Format**: All API responses use camelCase keys (not capitalized)
3. **FF-Helix%**: Always computed (no external dependency)
4. **Provider Status**: Every row includes `providerStatus` (TANGO/PSIPRED/JPRED availability)
5. **Trace IDs**: All requests have trace IDs for logging correlation

---

## Migration Status

**Current State**: Route handlers migrated; business logic extraction in progress.

| Component | Status | Notes |
|-----------|--------|-------|
| Route handlers (`api/routes/`) | ✅ Complete | All endpoints have thin route handlers |
| App setup (`api/main.py`) | ✅ Complete | Middleware, CORS, Sentry configured |
| Upload service | 🔄 Partial | Still imports from `server.py` |
| Predict service | 🔄 Partial | Still imports from `server.py` |
| `server.py` cleanup | ⏳ Pending | ~2,500 lines → target ~500 |

---

## Deep Dive Resources

| Resource | Purpose |
|----------|---------|
| `docs/BACKEND_LEARNING_PLAN.md` | 8-lesson curriculum to master the backend |
| `docs/learning/` | Reference implementation docs (for understanding TANGO/S4PRED algorithms) |
| `docs/active/CONTRACTS.md` | API request/response shapes |
| `docs/active/TESTING_GUIDE.md` | Test commands and setup |
| `docs/active/KNOWN_ISSUES.md` | Issue backlog |
| `docs/DOCKER_RUNBOOK.md` | Container deployment |

