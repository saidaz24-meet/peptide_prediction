# Issue Register — Peptide Visual Lab (PVL)

**Last Updated**: 2026-02-02
**Auditor**: Claude Opus 4.5 (Architecture/Refactor Lead)
**Status**: Active development - Phase 3.2 (TANGO Runtime Triage)

---

## Summary

| Priority | Count | Status |
|----------|-------|--------|
| **P0** | 3 | 2 resolved, 1 instrumented (ISSUE-022 needs prod verification) |
| **P1** | 8 | 4 resolved, 4 pending (ISSUE-023 blocked by prod verification) |
| **P2** | 7 | 6 resolved, 1 pending |
| **P3** | 3 | 1 resolved, 2 pending |
| **Phase 0B** | 2 | ✅ ALL RESOLVED |
| **Phase 1** | 2 | ✅ ALL RESOLVED |
| **Phase 3.2** | 3 | ✅ ISSUE-024 resolved, ISSUE-022 instrumented, ISSUE-023 blocked |
| **UX** | 1 | ✅ ISSUE-021 RESOLVED |

---

## P0 — Critical / Blocks Phase 0A

### ISSUE-000: `-1` Sentinel Values Used Instead of `null` for Missing Data — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P0 (Blocks Phase 0A) |
| **Category** | Data Contract Violation |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | Frontend receives `-1` for missing data instead of `null`. Violates JSON semantics. Causes display bugs ("Helix: -1%" instead of "N/A"). |
| **Files** | 15+ files across backend |
| **Resolution** | Replaced `-1` with `None` in dataframe_utils.py, auxiliary.py, tango.py, psipred.py. Updated normalize.py to convert any remaining `-1` to `null` (except sswPrediction where -1 is a valid semantic value). |
| **Tests** | All 54 tests pass |

---

## P1 — High Impact / Should Fix Soon

### ISSUE-001: Monolithic `server.py` — ⏸️ PARTIALLY ADDRESSED

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | Technical Debt |
| **Status** | ⏸️ Partially addressed (1,454 lines, 12 functions remaining) |
| **Impact** | Still has core endpoint logic that should be in services |
| **Evidence** | `wc -l server.py` → 1,454 lines; 12 endpoint functions still in file |
| **Remaining functions** | `upload_csv`, `predict`, `process_row`, `debug_providers`, `providers_last_run`, `diagnose_tango`, `uniprot_ping`, `parse_uniprot_query_endpoint`, `window_sequences_endpoint`, `execute_uniprot_query`, `_check_rate_limit`, `submit_feedback` |
| **Suggested Fix** | Move remaining functions to services (after TANGO/S4Pred integration) |
| **Effort** | HIGH (4-6 hours) |
| **Risk** | MEDIUM (deferred until after integration) |

---

### ISSUE-002: Dead JPred Code — ✅ ALREADY RESOLVED

| Field | Value |
|-------|-------|
| **Status** | ✅ **ALREADY RESOLVED** — Files already deleted |

---

### ISSUE-003: Stub Service Files — ✅ OUTDATED

| Field | Value |
|-------|-------|
| **Status** | ✅ **OUTDATED** — Service files now have real implementations |

---

### ISSUE-004: Run-Cache Directory Accumulation — ✅ ALREADY RESOLVED

| Field | Value |
|-------|-------|
| **Status** | ✅ **ALREADY RESOLVED** — .gitignore already contains run-cache entries |

---

### ISSUE-014: Duplicate `FeedbackRequest` Class — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | Code Duplication |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Resolution** | Removed duplicate from server.py; added import from schemas/feedback.py |
| **Tests** | All 54 tests pass |

---

### ISSUE-015: Using `.dict()` Instead of `model_dump()` — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | Pydantic v2 Deprecation |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Resolution** | Replaced all `.dict()` with `.model_dump()` in schemas/peptide.py and services/normalize.py |
| **Tests** | All 54 tests pass |

---

## P2 — Medium Impact / Backlog

### ISSUE-005: Deprecated `chameleonPrediction` Field — ✅ ALREADY RESOLVED

| Field | Value |
|-------|-------|
| **Status** | ✅ **ALREADY RESOLVED** — Field has been removed |

---

### ISSUE-006: Excessive Archived Docs — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | Documentation Bloat |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | 28 doc files reduced to 10 essential docs |
| **Resolution** | Archived `docs/reference/`, `docs/user/`, and 8 non-essential root docs to `docs/_archive/`. Kept `docs/active/` (6 files) and 4 essential root docs. |
| **Remaining Docs** | `docs/active/` (6), root: DEV_CONTEXT.md, ISSUE_REGISTER.md, KNOWLEDGE_INDEX.md, REFACTOR_PLAN.md |
| **Tests** | All 54 tests pass |

---

### ISSUE-007: Confusing UniProt Service Naming — Pending

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | Pending (low priority) |

---

### ISSUE-008: Legacy `batch_process.py` Script — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | Dead/Legacy Code |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | 320-line standalone script; not imported by any production code |
| **Files** | `backend/batch_process.py` → `backend/_archive/batch_process.py` |
| **Resolution** | Archived to `backend/_archive/` (recoverable if needed) |
| **Tests** | All 54 tests pass |

---

### ISSUE-016: Routes Still Import from server.py — 🆕 NEW

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | Architecture / Circular Import Risk |
| **Impact** | api/routes/*.py import endpoint functions from server.py (circular import workaround) |
| **Files** | `api/routes/upload.py`, `api/routes/predict.py`, `api/routes/uniprot.py`, `api/routes/feedback.py` |
| **Evidence** | `grep -rn "from server import" --include="*.py"` |
| **Suggested Fix** | Move endpoint logic to services; routes import from services, not server.py |
| **Effort** | MEDIUM (tied to ISSUE-001) |
| **Risk** | MEDIUM (deferred until after integration) |

---

## P3 — Low Impact / Nice to Have

### ISSUE-009: Multiple TODO Comments

| Field | Value |
|-------|-------|
| **Priority** | P3 |
| **Status** | 4 TODOs remaining |
| **Evidence** | `grep -rn "TODO" --include="*.py"` |
| **Files** | `schemas/canonical.py:453`, `tests/test_golden_pipeline.py:98`, `batch_process.py:273,281` |

---

### ISSUE-011: `biochemCalculation.py` Naming Convention — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Status** | ✅ Already renamed to `biochem_calculation.py` |

---

## Phase 0B Candidates (Schema Enforcement)

### ISSUE-017: normalize.py Uses Manual Dict Shaping — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P1 (Phase 0B) |
| **Category** | Schema Enforcement |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | Response dicts built manually instead of via Pydantic model_dump() |
| **Files** | `services/normalize.py` |
| **Resolution** | Added `PeptideRow.model_validate()` and `model_dump(exclude_none=True, exclude={'extras'})` after normalization in both single-row and multi-row paths. Validation failures log warnings and fall back to sanitized dict. |
| **Tests** | All 54 tests pass |

---

### ISSUE-018: Endpoints Don't Use Pydantic Response Models — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P1 (Phase 0B) |
| **Category** | Schema Enforcement |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | /api/predict and /api/upload-csv now return validated Pydantic models |
| **Files** | `services/upload_service.py`, `services/predict_service.py` |
| **Resolution** | Updated Meta model to use `extra="ignore"`. Services now construct `RowsResponse`/`PredictResponse` and return `.model_dump()`. Validation failures log warnings and fall back to unvalidated dict. |
| **Tests** | All 54 tests pass |

---

### ISSUE-019: Provider Status Case Mismatch — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P0 (UI Bug) |
| **Category** | Data Contract Violation |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | Frontend showed "TANGO: UNKNOWN" because backend returned lowercase status ("available") but frontend expected uppercase ("AVAILABLE") |
| **Files** | `schemas/provider_status.py`, `services/normalize.py` |
| **Resolution** | Updated `ProviderStatusValue` to use uppercase: `"AVAILABLE"`, `"UNAVAILABLE"`, `"PARTIAL"`, `"OFF"`. Updated all status checks in normalize.py. |
| **Tests** | All 54 tests pass |

---

### ISSUE-020: TANGO Produces 0 Outputs — 🆕 NEW (Investigation Needed)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | Provider Execution |
| **Status** | 🔍 Investigation needed |
| **Impact** | Sentry alerts: "TANGO produced 0 outputs for N inputs" - TANGO binary/container fails to produce output files |
| **Files** | `tango.py:1103-1115`, `services/upload_service.py:198-227` |
| **Evidence** | Error raised when `run_meta.json` is missing or TANGO outputs directory is empty |
| **Possible Causes** | 1. TANGO binary not found/executable, 2. Docker container issues, 3. Timeout, 4. Disk/permission issues |
| **Suggested Fix** | Investigate TANGO setup; this is tied to TANGO/S4Pred integration (deferred) |
| **Effort** | HIGH (depends on environment) |
| **Risk** | HIGH |

---

### ISSUE-021: CSV Column Mapping UX — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | User Experience |
| **Status** | ✅ **RESOLVED** (2026-02-01) |
| **Impact** | Simplified upload flow from 3 steps to 2 steps |
| **Files** | `ui/src/pages/Upload.tsx` |
| **Resolution** | Removed manual column mapping step. New flow: (1) Upload file → (2) Preview & Analyze. Columns are auto-detected by backend. Threshold config moved to collapsible "Advanced" section. ColumnMapper component no longer used. |
| **Tests** | Frontend builds, all 54 backend tests pass |

---

## Phase 3.2 — TANGO Runtime Investigation

### ISSUE-022: TANGO Binary Produces 0 Output Files at Runtime — ✅ INSTRUMENTED

| Field | Value |
|-------|-------|
| **Priority** | P0 (blocks production TANGO use) |
| **Category** | Provider Execution |
| **Status** | ✅ **INSTRUMENTED** (2026-02-02) - Diagnostics added, local verification passes |
| **Impact** | All TANGO/SSW features non-functional in production. API returns `null` for all SSW fields. |
| **Symptom** | Sentry error: "TANGO produced 0 outputs for N inputs" |
| **Files** | `backend/tango.py`, `backend/server.py`, `backend/scripts/smoke_tango.py` |
| **Resolution** | Added: 1) `smoke_test_tango()` function for runtime verification, 2) Enhanced error logging with directory contents and expected files, 3) `make smoke-tango` target, 4) `/api/providers/diagnose/tango?run_smoke_test=true` endpoint |
| **Local Test** | `make smoke-tango` passes - TANGO works locally |
| **Production** | Requires deployment and running `smoke-tango` in production to verify environment |
| **Triage Doc** | `docs/PHASE_3_2_TRIAGE.md` |
| **Tests** | All 140 tests pass |

---

### ISSUE-023: UI Shows "N/A" Despite USE_TANGO=1 — 🟡 BLOCKED

| Field | Value |
|-------|-------|
| **Priority** | P1 (dependent on ISSUE-022) |
| **Category** | User Experience |
| **Status** | 🟡 **BLOCKED** by ISSUE-022 |
| **Impact** | Users see "N/A" for Tango columns when expecting predictions |
| **Symptom** | UI table shows "N/A" for sswPrediction, sswScore, sswDiff columns |
| **Files** | `ui/src/lib/peptideMapper.ts:150-159`, `backend/services/normalize.py:259-276` |
| **Root Cause** | ISSUE-022 - when TANGO binary fails, provider status becomes UNAVAILABLE, and normalize.py nullifies all TANGO fields |
| **Resolution** | Will auto-resolve when ISSUE-022 is fixed |
| **Effort** | N/A (blocked) |

---

### ISSUE-024: Missing Runtime Smoke Test for TANGO — ✅ RESOLVED

| Field | Value |
|-------|-------|
| **Priority** | P1 (testing gap) |
| **Category** | Test Coverage |
| **Status** | ✅ **RESOLVED** (2026-02-02) |
| **Impact** | Tests pass but production fails - no runtime TANGO validation |
| **Resolution** | Added `make smoke-tango` target that: 1) Runs `smoke_test_tango()` function, 2) Executes TANGO binary with test sequence, 3) Verifies output file creation and parsing, 4) Returns SSW values on success |
| **Files Changed** | `backend/tango.py`, `backend/scripts/smoke_tango.py`, `Makefile` |
| **Usage** | `make smoke-tango` (local), or `/api/providers/diagnose/tango?run_smoke_test=true` (API) |
| **Tests** | All 140 tests pass, smoke test passes locally |

---

## Deferred

### TANGO/S4Pred Integration — ⏸️ DEFERRED

| Field | Value |
|-------|-------|
| **Status** | ⏸️ **DEFERRED: Waiting for repo access** |
| **Reason** | External reference repo is private; cannot lock to exact upstream version yet |
| **Files** | `backend/tango.py`, `backend/psipred.py` |
| **Resume When** | User provides access to external TANGO/S4Pred repository |

---

## Quick Reference: What to Fix Next

| Issue | Priority | Effort | Safe to Fix Now? |
|-------|----------|--------|------------------|
| **ISSUE-022** | P0 | HIGH | ✅ **INSTRUMENTED** - Deploy & verify in production |
| **ISSUE-024** | P1 | MEDIUM | ✅ **RESOLVED** - `make smoke-tango` added |
| **ISSUE-023** | P1 | N/A | 🟡 **BLOCKED** by ISSUE-022 (verify production) |
| **ISSUE-020** | P1 | HIGH | 🔍 Merged into ISSUE-022 |
| **ISSUE-014** | P1 | LOW | ✅ RESOLVED |
| **ISSUE-015** | P1 | LOW | ✅ RESOLVED |
| **ISSUE-017** | P1 | MEDIUM | ✅ RESOLVED |
| **ISSUE-018** | P1 | MEDIUM | ✅ RESOLVED |
| **ISSUE-008** | P2 | LOW | ✅ RESOLVED |
| **ISSUE-001** | P1 | HIGH | ⏸️ After integration |
| **ISSUE-016** | P2 | MEDIUM | ⏸️ After integration |

---

## Verification Commands

```bash
# Run all tests
make test

# Check for deprecated .dict() usage
grep -rn "\.dict\(" --include="*.py" backend/

# Check for duplicate classes
grep -rn "class FeedbackRequest" --include="*.py" backend/

# Check server.py function count
grep -c "^def \|^async def " backend/server.py
```
