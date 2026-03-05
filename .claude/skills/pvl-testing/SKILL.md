---
name: pvl-testing
description: Testing patterns and TDD workflow for PVL. Use when writing tests, modifying tests, debugging test failures, or discussing test strategy. Covers pytest backend tests and vitest frontend tests.
user-invocable: false
---

# PVL Testing Guide

## TDD Workflow (from CLAUDE.md)
1. **Write failing test first** — must fail for the right reason
2. **Minimal implementation** — smallest change to make test pass
3. **Refactor** — clean up while keeping tests green
4. **Edge tests** — add boundary cases and error paths

## Backend Tests (pytest)

### Setup
```python
# ALWAYS disable providers before importing app
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

from fastapi.testclient import TestClient
from api.main import app
client = TestClient(app)
```

### Test Data Constants
```python
TEST_SEQUENCE = "MRWQEMGYIFYPRKLR"
TEST_ENTRY = "TEST001"
TEST_CSV = "Entry,Sequence\nTEST001,MRWQEMGYIFYPRKLR\n"
```

### Assertion Patterns
```python
# Contract keys
assert response.status_code == 200
data = response.json()
assert "row" in data   # single sequence
assert "rows" in data   # batch upload
for key in REQUIRED_CAMEL_CASE_KEYS:
    assert key in row

# Null semantics: never -1 for percentages
assert row.get("ffHelixPercent") is None or isinstance(row["ffHelixPercent"], (int, float))

# SSW prediction: -1 IS valid (means "not switching")
assert row["sswPrediction"] in (-1, 0, 1, None)
```

### Run Commands
```bash
cd backend
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short     # All
USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_FILE.py -v     # Single file
make test          # All via Makefile
make test-unit     # Fast subset only
make ci            # lint + typecheck + test
```

### Key Test Files
- `test_api_contracts.py` — Response schema validation
- `test_golden_pipeline.py` — End-to-end pipeline verification
- `test_consensus.py` — Consensus logic
- `test_ff_flags_thresholds.py` — FF flag computation
- `test_pipeline_ssw_integrity.py` — SSW data integrity

## Frontend Tests (vitest)

### Setup
```typescript
// vitest.config.ts: globals: true, environment: "jsdom"
import { describe, it, expect } from 'vitest';
```

### Factory Functions
```typescript
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: 'AAAA', length: 4, hydrophobicity: 0.5,
    charge: 1.0, sswPrediction: null, ...overrides,
  };
}
```

### Run Commands
```bash
cd ui
npx vitest run                                    # All tests
npx vitest run src/lib/__tests__/ranking.test.ts  # Single file
npx vitest --watch                                # Watch mode
```

## Known Test Issues (check KNOWN_ISSUES.md)
- TANGO tests require `USE_TANGO=1` + binary in `tools/tango/bin/`
- S4PRED tests require `USE_S4PRED=1` + weights in `tools/s4pred/models/`
- Single-peptide SSW threshold: fallback_threshold = 0.0 when n <= 1
- `notna()` not `!= -1` for SSW hit detection

## Visual Regression Debugging
Reference screenshots of the current UI are stored locally (path in MEMORY.md `External Resources`). After UI changes, read screenshots to compare expected vs actual appearance. Claude can view PNG/JPG images directly via the Read tool.

## Single vs Batch Consistency Rule
If you add a test for single sequence, also verify the same peptide through batch upload produces identical results. This is architectural principle #1.
