# Claude Agent Instructions

## Project Context

**Peptide Visual Lab (PVL)**: Web tool for peptide aggregation prediction.
- **Primary predictor**: S4PRED (secondary structure). NOT PSIPRED (deprecated, delete all references).
- **Secondary predictor**: TANGO (aggregation via SSW detection).
- **Deployment**: DESY Kubernetes (free). No paid cloud services.
- **Status**: Preparing for paper publication, then public release.

## Current Priorities

1. **S4PRED full implementation** — Match Tango outputs (SSW fragments, score, diff, curves, thresholds)
2. **Documentation consolidation** — Merge learning docs into one MASTER_GUIDE.md
3. **FF-Helix verification** — Confirm biochemical calculations match Peleg's requirements
4. **Visualizations** — Per-residue profile viewer is highest value (after core complete)

## Documentation Access Rule

**STRICT**: Read only `CLAUDE.md` + `docs/active/*` by default.

**Active Context Pack** (docs/active/):
- **ACTIVE_CONTEXT.md** — Architecture, entrypoints, data flow
- **TESTING_GUIDE.md** — Test commands, setup, known failures
- **CONTRACTS.md** — API endpoints, request/response shapes
- **KNOWN_ISSUES.md** — Bugs, limitations, workarounds
- **FILES_TO_TOUCH.md** — Hot files for current work

**DO NOT READ** without permission:
- `docs/_archive/**`, `docs/legacy/**`, `docs/reference/**`, `docs/user/**`
- Any markdown outside `docs/active/`

**Before opening new files**: Propose top 3, explain why, wait for approval.

## Architecture Constraints

| Constraint | Rule |
|------------|------|
| Database | Postgres on DESY K8s (free). No Supabase (cost). |
| Auth/caching | Parked until paper published. |
| Predictors | S4PRED = primary. TANGO = secondary. PSIPRED = DELETE. |
| Execution | Tango has 3 modes: simple (dev), docker (deploy), host (DESY pre-installed). |
| Precompute | Future goal: 250M UniProt sequences. Not implemented yet. |

## TDD Workflow

1. **Write failing test first** — Must fail for the right reason
2. **Minimal implementation** — Smallest change to pass
3. **Refactor** — Clean up, keep tests green
4. **Edge tests** — Boundary cases and error paths

## Output Policy

After every change:
```
Files changed:
- backend/services/normalize.py
- backend/tests/test_normalize.py

Verify:
make test
make lint
```

## Safety Rules

1. **Public APIs protected** — Do not change:
   - `backend/schemas/api_models.py`
   - API endpoint signatures
   - Response formats (camelCase, Entry alignment)

2. **Smallest diffs** — Fix only what's broken, add features incrementally

3. **Invariants**:
   - Entry IDs must align input/output
   - Response keys = camelCase
   - FF-Helix% always computed (no external dependency)
   - S4PRED is primary predictor (not PSIPRED)

## Key Files Reference

| File | Purpose | Lines | Notes |
|------|---------|-------|-------|
| `backend/server.py` | Main orchestrator | ~1470 | HTTP + business logic |
| `backend/tango.py` | TANGO runner/parser | ~1600 | 3 execution modes |
| `backend/s4pred.py` | S4PRED runner/parser | ~??? | PRIMARY predictor |
| `backend/auxiliary.py` | FF-Helix + helpers | ~??? | Biochemical calcs |
| `backend/biochemCalculation.py` | Charge, hydrophobicity, μH | ~??? | Core metrics |

## Quick Reference
```bash
# Development
make test       # All tests (deterministic, no network)
make test-unit  # Fast unit tests
make lint       # Code quality
make typecheck  # Type checking
make fmt        # Format code
make ci         # Full pipeline

# Predictor flags
USE_TANGO=1     # Enable TANGO
USE_S4PRED=1    # Enable S4PRED (primary)
USE_JPRED=0     # Deprecated, always off
```

## Context Management

- Read only necessary files, not entire directories
- Summarize after completing logical units
- Recommend `/compact` for large operations

