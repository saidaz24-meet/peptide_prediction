# Testing Guide

**Last Updated**: 2025-01-14

---

## Quick Start: Run All Tests

```bash
# From project root
make test       # All tests (fast, deterministic, no network)
make test-unit  # Fastest unit tests only
make ci         # Full CI pipeline (lint + typecheck + test)
```

---

## Backend Tests

### Unit Tests

**Location**: `backend/tests/test_*.py`

**Run Fast Unit Tests**:
```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 python -m pytest tests/test_api_contracts.py tests/test_uniprot_query_parsing.py tests/test_uniprot_sort.py tests/test_trace_id.py -v --tb=short
```

**Or via Makefile**:
```bash
make test-unit
```

**Test Files**:
- `test_api_contracts.py` - API response schema validation
- `test_uniprot_query_parsing.py` - UniProt query string parsing
- `test_uniprot_sort.py` - UniProt result sorting
- `test_trace_id.py` - Trace ID generation and propagation

### Integration Tests

**Run All Tests**:
```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 python -m pytest tests/ -v --tb=short
```

**Or via Makefile**:
```bash
make test
```

**Additional Test Files**:
- `test_golden_pipeline.py` - End-to-end pipeline with golden inputs
- `test_tango_scaling.py` - TANGO runner scaling tests

**Note**: Tests run with `USE_TANGO=0 USE_S4PRED=0` to avoid external dependencies.

### Golden Tests (Reference Implementation Validation)

Golden tests validate PVL against the reference implementation (`260120_Alpha_and_SSW_FF_Predictor`).

**Run Golden Tests**:
```bash
cd backend
python -m pytest tests/test_*_golden.py -v
```

**Golden Test Files**:
| File | Coverage |
|------|----------|
| `test_ssw_golden.py` | SSW algorithm (segment detection, overlap, score/diff) |
| `test_biochem_golden.py` | μH, charge, hydrophobicity calculations |
| `test_sentinel_values.py` | Null semantics for missing data |
| `test_preprocessing_golden.py` | Sequence preprocessing (B→D, Z→E mapping) |

**What They Validate**:
- SSW threshold: `diff < avg → 1` (IS SSW), `diff >= avg → -1` (NOT SSW)
- Segment detection thresholds: MIN_SEGMENT_LENGTH=5, MAX_GAP=3
- B/Z ambiguous codes: B→D (aspartate), Z→E (glutamate)
- Null semantics: Missing data returns `null` (not `-1`)

---

## Frontend Tests

**Status**: No automated tests currently configured.

**Manual Testing**:
1. Start dev server: `cd ui && npm run dev`
2. Open `http://localhost:5173`
3. Test upload, analysis, and results pages

**Future**: Add Vitest/Jest for component and API client tests.

---

## Running the App Locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Feature flags (optional)
export USE_TANGO=1          # Enable TANGO
export USE_S4PRED=1         # Enable S4PRED (primary predictor)

# Start server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Verify**: `curl http://127.0.0.1:8000/api/health` → `{"ok": true}`

### Frontend

```bash
cd ui
npm install

# Set API base URL
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local

# Start dev server
npm run dev
```

**Verify**: Open `http://127.0.0.1:5173` → Should see upload page

---

## Smoke Tests

**Location**: `scripts/` and `checks/`

**Run Smoke Tests**:
```bash
# Backend smoke test
./scripts/smoke_test_backend.py

# UniProt pipeline
./checks/smoke_uniprot.sh

# Provider status
./scripts/smoke_provider_status.sh

# Structured logging
./scripts/smoke_logging.sh
```

**Prerequisites**: Backend and frontend must be running.

---

## Tango Display Semantics Verification

**Manual check after any `tangoDisplaySemantics.ts` change:**

1. Start frontend and backend
2. Load example dataset (click "Load Example")
3. Navigate to Results page
4. Verify badge meanings in SSW column:
   - **Positive** (green) = `sswPrediction === 1` (switch predicted)
   - **Negative** (gray) = `sswPrediction === -1` (no switch predicted)
   - **Uncertain** (outline) = `sswPrediction === 0` (rare edge case)
   - **Missing** (outline) = `sswPrediction === null` (TANGO didn't run)
5. Verify NO "Unknown" badges appear
6. Click on a row to open PeptideDetail — verify TangoBadge renders correctly

**Known regression (2026-02-02)**: If "Uncertain" appears for ~30% of results when it shouldn't, check `tangoDisplaySemantics.ts` for buggy `hasTangoData` logic.

---

## Known Test Failures

**Status**: No known failures documented.

**If tests fail**:
1. Check `USE_TANGO=0 USE_S4PRED=0` is set (tests don't require external tools)
2. Verify Python dependencies: `pip install -r requirements.txt`
3. Check pytest version: `pytest --version` (should be 7.0+)

---

## Linting and Type Checking

### Backend

```bash
# Lint
cd backend && ruff check .

# Format
cd backend && ruff format .

# Type check (optional, requires mypy)
cd backend && mypy . --ignore-missing-imports --no-strict-optional
```

**Or via Makefile**:
```bash
make lint      # Lint Python + TypeScript
make fmt       # Format Python + TypeScript
make typecheck # Type check Python + TypeScript
```

### Frontend

```bash
cd ui
npm run lint        # ESLint
npx tsc --noEmit    # TypeScript type check
npx prettier --write "src/**/*.{ts,tsx}"  # Format
```

---

## Pre-commit Hooks

**Install**:
```bash
pip install pre-commit
pre-commit install
```

**What Runs on Commit**:
- Python formatting (ruff format)
- Python linting (ruff check)
- TypeScript formatting (prettier)
- TypeScript linting (eslint)
- Fast unit tests (test-unit subset)

**Run Manually**:
```bash
pre-commit run --all-files  # All files
pre-commit run              # Staged files only
```

**Skip Hooks** (not recommended):
```bash
git commit --no-verify
```

---

## CI Pipeline

**Command**: `make ci`

**What It Does**:
1. Lint Python code (`ruff check .`)
2. Lint TypeScript code (`npm run lint`)
3. Type check Python (`mypy .`)
4. Type check TypeScript (`tsc --noEmit`)
5. Run all tests (`pytest tests/`)

**Expected**: All checks pass with exit code 0

---

## Debugging Tests

### Backend

**Verbose Output**:
```bash
pytest tests/ -v -s  # -s shows print statements
```

**Run Single Test**:
```bash
pytest tests/test_api_contracts.py::test_upload_response_format -v
```

**Debug with PDB**:
```bash
pytest tests/ --pdb  # Drops into debugger on failure
```

### Frontend

**Dev Tools**:
- React DevTools browser extension
- Network tab: Check API calls
- Console: Check for validation errors (dev mode only)

**API Validation**:
- Development mode validates API responses automatically
- Check browser console for validation errors
- See `ui/src/lib/apiValidator.ts` for validation rules

---

## Test Data

**Golden Inputs**: `backend/tests/golden_inputs/`
- `normal.csv` - Standard valid input
- `ambiguous_headers.csv` - Header name variations
- `missing_headers.csv` - Missing optional columns
- `nans_empty.csv` - Empty/NaN handling
- `nonstandard_aa.csv` - Non-standard amino acids
- `weird_delimiter.csv` - Delimiter detection

**Example Dataset**: `ui/public/Final_Staphylococcus_2023_new.xlsx`
- Served via `GET /api/example`
- Pre-computed results (no recalculation by default)

