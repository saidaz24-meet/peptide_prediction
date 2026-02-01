# Refactor Plan — Prioritized Sequence

**Last Updated**: 2026-02-01
**Approach**: Smallest safe wins first; one issue at a time; tests after each patch.
**Current Phase**: Phase 0B (Schema Enforcement)

---

## Guiding Principles

1. **Delete before abstract** — Remove dead code rather than refactoring it
2. **Small diffs** — Each PR should be <100 lines of meaningful change
3. **Test after each patch** — Run `make test` (or `make ci`) after every change
4. **Rollback-safe** — Every commit should be independently revertable
5. **No big bang** — Never batch multiple unrelated changes
6. **Don't touch TANGO/S4Pred** — Integration deferred until repo access granted

---

## Phase 0A: Canonical Contracts — ✅ COMPLETE

- [x] ISSUE-000: Replace `-1` sentinels with `null`
- [x] Phase 0A.2: Update TypeScript types to match API contracts
- [x] Phase 0A.3: Add contract tests for sentinel values

---

## Phase 0B: Schema Enforcement (CURRENT)

### Step 0B.1: Fix duplicate FeedbackRequest class (ISSUE-014) — ✅ COMPLETE

**Status**: ✅ RESOLVED (2026-02-01)

**Changes**:
- [x] Duplicate class removed from `server.py`
- [x] Import added from `schemas/feedback.py`
- [x] All tests pass

---

### Step 0B.2: Replace .dict() with model_dump() (ISSUE-015) — ✅ COMPLETE

**Status**: ✅ RESOLVED (2026-02-01)

**Changes**:
- [x] All `.dict()` calls replaced with `.model_dump()` in `services/normalize.py` and `schemas/peptide.py`
- [x] All tests pass

---

### Step 0B.3: Use Pydantic models for response serialization (ISSUE-017, ISSUE-018) — 🔄 PARTIAL

**Status**: ISSUE-017 ✅ RESOLVED, ISSUE-018 ⏸️ PENDING

#### ISSUE-017: Row validation through PeptideRow — ✅ COMPLETE

**Changes**:
- [x] Added `PeptideRow.model_validate()` after normalization in `normalize_rows_for_ui()`
- [x] Return `model_dump(exclude_none=True, exclude={'extras'})` for validated dicts
- [x] Validation failures log warnings and fall back to sanitized dict (graceful degradation)
- [x] Applied to both single-row and multi-row paths, including fallback paths
- [x] All 54 tests pass

#### ISSUE-018: Full response model validation — ⏸️ PENDING

**Why pending**: The `Meta` model in `api_models.py` has `extra="forbid"` which would reject some fields currently in responses. Updating the Meta model to include all fields requires careful alignment.

**Remaining work**:
1. Update `Meta` model to include all response fields (or change to `extra="allow"`)
2. Update `upload_service.py` to construct `RowsResponse` and call `model_dump()`
3. Update `predict_service.py` to construct `PredictResponse` and call `model_dump()`
4. Update `server.py:execute_uniprot_query` to construct `RowsResponse`

**Definition of Done**:
- [ ] Meta model aligned with actual response structure
- [ ] Endpoints construct response models and use `.model_dump()`
- [ ] All tests pass

---

## Phase 1: Quick Wins — ✅ COMPLETE

### Step 1.1: Archive batch_process.py (ISSUE-008) — ✅ COMPLETE

**Status**: ✅ RESOLVED (2026-02-01)

**Changes**:
- [x] Archived to `backend/_archive/batch_process.py` (recoverable if needed)
- [x] No imports found in production code
- [x] All tests pass

---

### Step 1.2: Clean up docs directory (ISSUE-006) — ✅ COMPLETE

**Status**: ✅ RESOLVED (2026-02-01)

**Changes**:
- [x] Reduced from 28 docs to 10 essential docs
- [x] Archived `docs/reference/`, `docs/user/` and 8 non-essential root docs to `docs/_archive/`
- [x] Kept `docs/active/` (6 files) and 4 essential root docs
- [x] All tests pass

---

## Phase 2: Deferred (After TANGO/S4Pred Integration)

### Step 2.1: Extract remaining server.py functions (ISSUE-001)

**Deferred**: Wait until TANGO/S4Pred integration is complete.

**Remaining functions to extract**:
- `upload_csv` → `services/upload_service.py`
- `predict` → `services/predict_service.py`
- `execute_uniprot_query` → `services/uniprot_service.py`
- `submit_feedback` → `services/feedback_service.py`
- Debug endpoints → `api/routes/debug.py`

---

### Step 2.2: Fix circular imports (ISSUE-016)

**Deferred**: Tied to ISSUE-001.

**Target**: Routes import from services, not server.py.

---

## Deferred: TANGO/S4Pred Integration

**Status**: ⏸️ DEFERRED: Waiting for repo access

**Reason**: External reference repo is private; cannot lock to exact upstream version yet.

**Resume when**: User provides access to external TANGO/S4Pred repository.

---

## Verification Checkpoints

After each step, verify:

```bash
# Backend
make test       # All tests pass
make lint       # No lint errors (if configured)

# Frontend (if schema changes)
cd ui && npm run build  # Builds successfully

# Smoke test
curl http://localhost:8000/api/health  # Returns {"ok": true}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking API contract | Contract tests catch regressions |
| Breaking frontend | Run `npm run build` after schema changes |
| Losing functionality | Run full test suite after each commit |
| TANGO/S4Pred conflicts | Deferred until integration phase |

---

## Current Status

| Phase | Status | Next Action |
|-------|--------|-------------|
| Phase 0A | ✅ Complete | — |
| Phase 0B | 🔄 In Progress (80%) | ISSUE-018 (Meta model alignment) |
| Phase 1 | ✅ Complete | — |
| Phase 2 | ⏸️ Deferred | After TANGO/S4Pred |

**Progress Summary (2026-02-01)**:
- ✅ ISSUE-014: Duplicate FeedbackRequest removed
- ✅ ISSUE-015: .dict() → model_dump() migration complete
- ✅ ISSUE-017: Row validation through PeptideRow added
- ✅ ISSUE-019: Provider status case mismatch fixed (AVAILABLE vs available)
- ✅ ISSUE-006: Docs cleanup (28 → 10 docs)
- ✅ ISSUE-008: batch_process.py archived
- ✅ ISSUE-021: CSV column mapping UX simplified (3 steps → 2 steps)
- ⏸️ ISSUE-018: Full response model validation (pending Meta model update)
- 🔍 ISSUE-020: TANGO 0 outputs (investigation needed)
