# Merge Conflict Resolution Log

**Date:** 2026-02-01
**Merge:** `origin/main` (88708d5) → `chore/docs-hygiene` (01e5389)
**Conflicts:** 37 files

## Resolution Strategy

Preserved our branch (`chore/docs-hygiene`) changes because they contain:
- ISSUE-000: Null semantics (no -1 sentinels except sswPrediction)
- ISSUE-014: Removed duplicate FeedbackRequest
- ISSUE-015: model_dump() instead of deprecated dict()
- ISSUE-017/018: Pydantic response model validation
- ISSUE-019: Uppercase provider status values (AVAILABLE, not available)

## Layer 1: Schemas / Normalize / Provider Tracking / Thresholds

| File | Resolution | Reason |
|------|------------|--------|
| `schemas/provider_status.py` | OURS | Uppercase status values (ISSUE-019) |
| `schemas/peptide.py` | OURS | Removed chameleonPrediction, use model_dump() |
| `services/normalize.py` | OURS | Uppercase status checks, PeptideRow validation |
| `services/provider_tracking.py` | OURS | -1 is valid prediction, not sentinel |
| `services/thresholds.py` | OURS | Added parse_threshold_config helper |

## Layer 2: Server / Tango / Biochem

| File | Resolution | Reason |
|------|------------|--------|
| `server.py` | OURS | Removed biochem_calculation import (renamed), dynamic settings |
| `tango.py` | OURS | Null semantics for missing SSW data |
| `auxiliary.py` | OURS | Null semantics (return None instead of -1) |
| `psipred.py` | OURS | Null semantics |
| `calculations/biochem.py` | OURS | Clean version |

## Layer 3: Tests

| File | Resolution | Reason |
|------|------------|--------|
| `tests/test_golden_pipeline.py` | OURS | Contract tests for null semantics |
| `tests/test_uniprot_*.py` | OURS | Updated tests |
| `tests/golden_inputs/*` | OURS | Test fixtures |

## Layer 4: JPred / Reference Scripts

| File | Resolution | Reason |
|------|------------|--------|
| `jpred.py` | DELETED | Dead code (archived to _archive/Jpred/) |
| `batch_process.py` | DELETED | Archived to _archive/ |
| `Analysing_final_results.py` | DELETED | Unused script |

## Layer 5: Docs / Tickets

| File | Resolution | Reason |
|------|------------|--------|
| `docs/*.md` (17 files) | DELETED | Archived to docs/_archive/ |
| `docs/legacy/*` | DELETED | Archived |
| `docs/KNOWLEDGE_INDEX.md` | OURS | Updated references |
| `tickets/*` | OURS | Our version |

## Layer 6: UI Components

| File | Resolution | Reason |
|------|------------|--------|
| `ui/src/types/peptide.ts` | OURS | Null semantics (fields can be null) |
| `ui/src/lib/api.ts` | OURS | Updated API types |
| `ui/src/lib/mappers.ts` | DELETED | Replaced by peptideMapper.ts |
| `ui/src/components/*` | OURS | Updated for null handling |
| `ui/src/pages/*` | OURS | Updated for null handling |
| `ui/src/stores/*` | OURS | Updated store types |

## Other Files

| File | Resolution | Reason |
|------|------------|--------|
| `.gitignore` | OURS | Includes new entries |
| `requirements.txt` | OURS | Updated dependencies |

## Verification

- ✅ `make test`: 54 tests passing
- ✅ `npm run build`: UI builds successfully
- ✅ No API contract changes (preserved camelCase keys, null semantics)

## Key Invariants Preserved

1. **Null semantics**: Missing data is `null`, not `-1` (except `sswPrediction` where -1 means "no switch predicted")
2. **Provider status**: Uppercase values (`AVAILABLE`, `UNAVAILABLE`, `PARTIAL`, `OFF`)
3. **API contracts**: camelCase keys, Entry ID alignment, response structure
4. **Pydantic v2**: Using `model_dump()` not deprecated `dict()`
