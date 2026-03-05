# Testing Guide

**Last Updated**: 2026-03-05

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
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_api_contracts.py tests/test_uniprot_query_parsing.py tests/test_uniprot_sort.py tests/test_trace_id.py -v --tb=short
```

**Or via Makefile**:
```bash
make test-unit
```

### All Tests (323 passing)

```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short
```

**Or via Makefile**:
```bash
make test
```

**Note**: Tests run with `USE_TANGO=0 USE_S4PRED=0` to avoid external tool dependencies.

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `test_api_contracts.py` | ~40 | API endpoint shapes, status codes, upload validation |
| `test_s4pred_golden.py` | 24 | S4PRED segment detection, SSW, filter_by_diff |
| `test_ff_helix_golden.py` | 34 | FF-Helix propensity calc, FF flags, helix muH |
| `test_ssw_golden.py` | ~20 | SSW segment merge, overlap detection, score/diff |
| `test_golden_pipeline.py` | ~30 | End-to-end DataFrame processing |
| `test_biochem_golden.py` | ~15 | Charge, hydrophobicity, muH calculations |
| `test_preprocessing_golden.py` | ~10 | Sequence cleaning, B/Z/X substitution |
| `test_sentinel_values.py` | ~10 | Null semantics for missing data |
| `test_nonstandard_aa.py` | 21 | Non-standard amino acids (X, O, J handling) |
| `test_trace_id.py` | 7 | Request tracing and correlation |
| `test_uniprot_query_parsing.py` | ~10 | UniProt query mode detection |
| `test_uniprot_sort.py` | ~5 | UniProt result sorting |
| `test_tango_scaling.py` | ~5 | TANGO runner scaling |

### Golden Tests (Reference Implementation Validation)

Golden tests validate PVL against the reference implementation.

```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_*_golden.py -v
```

**What They Validate**:
- SSW threshold: `diff < avg -> 1` (IS SSW), `diff >= avg -> -1` (NOT SSW)
- SSW fallback threshold (0.0) when single peptide (avoids self-referential mean)
- Segment detection thresholds: MIN_SEGMENT_LENGTH=5, MAX_GAP=3
- B/Z ambiguous codes: B->N, Z->Q, X->A, O->K, J->L
- Null semantics: Missing data returns `null` (not `-1`)
- FF-Helix % Chou-Fasman sliding window (core=6, threshold=1.0)
- S4PRED per-residue probability extraction + segment detection

---

## Frontend Tests

**Status**: 77 tests passing via Vitest + jsdom + @testing-library/react.

### Run Frontend Tests

```bash
cd ui
npx vitest run          # All tests (77 passing)
npx vitest run --watch  # Watch mode
```

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `src/lib/__tests__/normalization.test.ts` | ~15 | Numeric normalization, edge cases |
| `src/lib/__tests__/ranking.test.ts` | ~25 | Multi-metric ranking, weight sliders |
| `src/lib/__tests__/spearman.test.ts` | ~10 | Spearman rank correlation |
| `src/lib/__tests__/consensus.test.ts` | ~15 | Consensus pipeline logic |
| `src/lib/__tests__/peptideMapper.test.ts` | ~12 | API → frontend type mapping |

### Manual Testing

1. Start dev server: `cd ui && npm run dev`
2. Open `http://localhost:5173`
3. Test Upload, Quick Analyze, Results, PeptideDetail pages

---

## Running the App Locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Start server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify**: `curl http://127.0.0.1:8000/api/health` → `{"ok": true}`

### Frontend

```bash
cd ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

**Verify**: Open `http://127.0.0.1:5173` → Should see upload page

---

## Smoke Tests

**Docker smoke tests** (requires running containers):
```bash
make docker-smoke
```

This runs:
1. Backend health check
2. API contract tests inside container
3. Trace ID tests inside container
4. Frontend health check

**Manual smoke scripts** (requires backend running locally):
```bash
scripts/smoke_test_backend.py    # Backend endpoints
checks/smoke_uniprot.sh          # UniProt pipeline
```

---

## Tango Display Semantics Verification

**Manual check after any SSW display change:**

1. Start frontend and backend
2. Load example dataset (click "Load Example")
3. Navigate to Results page
4. Verify badge meanings in SSW column:
   - **Positive** (green) = `sswPrediction === 1` (switch predicted)
   - **Negative** (gray) = `sswPrediction === -1` (no switch predicted)
   - **Uncertain** (outline) = `sswPrediction === 0` (rare edge case)
   - **Missing** (outline) = `sswPrediction === null` (TANGO didn't run)
5. Verify NO "Unknown" badges appear
6. Click on a row to open PeptideDetail — verify badge renders correctly

---

## Known Test Failures

**Status**: No known failures. All 323 backend tests + 77 frontend tests pass deterministically.

**If tests fail**:
1. Check `USE_TANGO=0 USE_S4PRED=0` is set (tests don't require external tools)
2. Verify Python dependencies: `pip install -r requirements.txt`
3. Check pytest version: `pytest --version` (should be 7.0+)
4. Ensure running from `backend/` directory (or use `make test` from root)

---

## Linting and Type Checking

### Backend

```bash
cd backend && ruff check .       # Lint
cd backend && ruff format .      # Format
cd backend && mypy . --ignore-missing-imports --no-strict-optional  # Type check
```

### Frontend

```bash
cd ui && npm run lint            # ESLint
cd ui && npx tsc --noEmit        # TypeScript type check
cd ui && npx prettier --write "src/**/*.{ts,tsx}"  # Format
```

### Via Makefile

```bash
make lint      # Lint Python + TypeScript
make fmt       # Format Python + TypeScript
make typecheck # Type check Python + TypeScript
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

```bash
# Verbose output
pytest tests/ -v -s  # -s shows print statements

# Run single test
pytest tests/test_api_contracts.py::test_upload_response_format -v

# Debug with PDB
pytest tests/ --pdb  # Drops into debugger on failure
```

### Frontend

- React DevTools browser extension
- Network tab: Check API calls and response shapes
- Console: Check for validation errors (dev mode only)

---

## Test Data

**Golden Inputs**: `backend/tests/golden_inputs/`
- `normal.csv` - Standard valid input
- `ambiguous_headers.csv` - Header name variations
- `missing_headers.csv` - Missing optional columns
- `nans_empty.csv` - Empty/NaN handling
- `nonstandard_aa.csv` - Non-standard amino acids
- `weird_delimiter.csv` - Delimiter detection

**Example Datasets** (served via `GET /api/example` and UI "Try example data"):
- `ui/public/Final_Staphylococcus_2023_new.xlsx` - Staphylococcus dataset
- `ui/public/example/antimicrobial_peptides.csv` - 12 well-known AMPs
- `ui/public/example/amyloid_peptides.csv` - 9 amyloid-forming peptides
