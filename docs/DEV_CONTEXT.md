# Developer Context

## What This Project Is

Interactive web app for exploring peptide properties and fibril-forming predictions. Backend (FastAPI) computes biophysical features (Hydrophobicity, Charge, μH) and integrates Tango/JPred results. Frontend (React + Vite) provides upload, visualization, and export capabilities. Designed for internal use at DESY (Landau Lab).

## Folder Map

- `backend/` — FastAPI server, calculation modules, Tango/JPred integration
- `backend/api/` — API routes (upload, predict, uniprot, providers, health)
- `backend/services/` — Core business logic (normalize, predict, upload, secondary_structure)
- `backend/calculations/` — Biochemical feature calculations
- `backend/tests/` — Pytest test suite (test_*.py files)
- `ui/` — React frontend (Vite, TypeScript, shadcn/ui)
- `ui/src/pages/` — Main application pages (Upload, Results, QuickAnalyze)

## How to Run

**Install:**
```bash
cd backend && pip install -r requirements.txt
cd ../ui && npm install
```

**Test:**
```bash
make test       # All tests (deterministic, no network)
make test-unit  # Fast unit tests only
make ci         # Full CI pipeline (lint + typecheck + test)
```

## "Do Not Break" Invariants

**Public APIs:**
- `/api/upload-csv` — Returns `RowsResponse` with camelCase keys (not capitalized)
- `/api/predict` — Returns `PredictResponse` with same schema
- `/api/uniprot/execute` — Returns normalized DataFrame with Entry/Sequence alignment preserved
- Response schemas defined in `backend/schemas/api_models.py` (must remain stable)

**Key Flows:**
- Upload → Normalize headers → Compute biochem → Apply FF flags → Return camelCase JSON
- Entry IDs must align between input CSV and output (no shuffling)
- Tango/JPred results merged by Entry ID, not sequence (handles duplicates)
- FF-Helix% always computed (no external tool dependency)

## Tests & Naming

**Location:** `backend/tests/`
- `test_api_contracts.py` — API response schema validation
- `test_golden_pipeline.py` — End-to-end pipeline with golden inputs
- `test_uniprot_*.py` — UniProt query parsing and execution
- `test_trace_id.py` — Observability/logging tests

**Conventions:**
- Test files: `test_*.py`
- Test classes: `Test*`
- Test functions: `test_*`
- Run with: `make test` (sets `USE_TANGO=0 USE_PSIPRED=0` for speed)

