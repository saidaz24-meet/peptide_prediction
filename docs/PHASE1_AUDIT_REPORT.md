# Phase 1.1 + 1.2 Audit Report

**Date**: 2024-01-14  
**Scope**: UniProt pipeline + Provider Status UI + smoke test alignment  
**Status**: Pre-patch analysis

## 1. File Locations

### ✅ Located Components

- **Backend UniProt endpoints**:
  - `backend/server.py:1072-1090` - `/api/uniprot/parse`
  - `backend/server.py:1128-1564` - `/api/uniprot/execute`

- **UniProt query parsing logic**:
  - `backend/services/uniprot_query.py:153-220` - `parse_uniprot_query()`
  - `backend/services/uniprot_query.py:117-150` - `extract_keyword()` (prevention logic)

- **Tango runner + parser**:
  - `backend/tango.py:287-636` - `run_tango_simple()` (execution)
  - `backend/tango.py:710-850` - `process_tango_output()` (parsing/merging)
  - `backend/server.py:1342-1476` - Tango integration in `/api/uniprot/execute`

- **Frontend UniProt query component**:
  - `ui/src/components/UniProtQueryInput.tsx:47-558` - Main component
  - `ui/src/components/UniProtQueryInput.tsx:120-269` - `handleExecute()` (calls parse/execute)

- **Dataset store**:
  - `ui/src/stores/datasetStore.ts:34-329` - Global Zustand store
  - `ui/src/stores/datasetStore.ts:95-146` - `ingestBackendRows()` (used by CSV/Example/UniProt)

- **Results page header pills**:
  - `ui/src/pages/Results.tsx:171-196` - Provider status display logic
  - `ui/src/components/ProviderBadge.tsx:22-69` - ProviderBadge component

## 2. Implementation Status

### ✅ 9606 Parsing Fix
**Status**: ✅ **FIXED** (but needs verification)

**Evidence**:
- `backend/services/uniprot_query.py:142-144` checks if normalized text is purely numeric
- `extract_keyword()` returns `None` if `normalized.isdigit()` is True
- Prevents "9606" from being extracted as both keyword AND organism_id

**Issue**: Logic exists but needs end-to-end test to verify it doesn't produce `keyword:9606 AND organism_id:9606`

---

### ✅ /api/uniprot/execute Runs Analysis Pipeline
**Status**: ✅ **IMPLEMENTED**

**Evidence**:
- `backend/server.py:1267-1271` - FF-Helix computation via `ensure_ff_cols()`
- `backend/server.py:1482-1487` - Biochemical features via `calc_biochem()`
- `backend/server.py:1489-1498` - Normalization via `normalize_rows_for_ui()`
- Returns computed fields in `rows_out` (1545)

---

### ✅ Provider Status Exists in Meta
**Status**: ✅ **IMPLEMENTED**

**Evidence**:
- `backend/server.py:1274-1295` - `provider_status_meta` dict initialized
- `backend/server.py:1342-1476` - Tango status tracking with stats
- `backend/server.py:1562` - `provider_status` included in meta response
- Structure: `{tango: {status, reason, stats, enabled, ran, ...}, psipred: {...}}`

---

### ⚠️ UI Reads Provider Status from Backend (with fallback inconsistency)
**Status**: ⚠️ **PARTIAL** - Has fallback that causes inconsistency

**Evidence**:
- `ui/src/pages/Results.tsx:184-192` - Uses `meta.provider_status?.tango` when available
- **BUG**: Falls back to `meta.use_tango` (line 190) when `provider_status.tango` missing
- `backend/server.py:1558` sets `meta.use_tango = tango_actually_ran` (not env USE_TANGO)
- This causes UI to show "Tango: OFF" even when backend runs TANGO (if provider_status missing)

**Root Cause**: 
- Results.tsx prefers `provider_status.tango` but falls back to legacy `use_tango`
- Backend sometimes sets `use_tango = tango_actually_ran` (runtime flag) instead of `USE_TANGO` (env flag)
- UI toggle indicators don't reflect `USE_TANGO` env setting

---

### ✅ Smoke Scripts Exist
**Status**: ✅ **IMPLEMENTED**

**Evidence**:
- `scripts/smoke_phase1.sh` - Main orchestrator
- `scripts/smoke_uniprot_pipeline.sh` - UniProt endpoint tests
- `scripts/smoke_provider_status.sh` - Provider status verification

---

## 3. Bug Analysis

### Bug 1: UI Shows "Tango OFF" but Backend Still Runs TANGO
**Root Cause**: 
- `Results.tsx:190` uses `meta.use_tango` fallback when `meta.provider_status?.tango` is missing
- `server.py:1558` sets `use_tango = tango_actually_ran` (what ran) not `USE_TANGO` (env setting)
- If provider_status structure is incomplete, UI shows wrong status

**Affected Files**:
- `ui/src/pages/Results.tsx:184-192` - Fallback logic
- `backend/server.py:1558` - `use_tango` assignment

---

### Bug 2: UI Toggle Indicators Don't Reflect USE_TANGO Env
**Root Cause**:
- Results.tsx reads `meta.provider_status.tango.status` or `meta.use_tango`
- Backend doesn't expose `USE_TANGO` env flag in meta
- UI can't distinguish "OFF because env disabled" vs "OFF because not requested"

**Affected Files**:
- `ui/src/pages/Results.tsx:184-192` - Needs to read `provider_status.tango.status` (should be "OFF" when env disabled)

---

### Bug 3: UniProt Length Filter Can Cause 400 Error
**Root Cause**:
- `uniprot_query.py:272` builds `length:[* TO {length_max}]` when only max set
- UniProt API may reject `[* TO 6]` (wildcard lower bound with small max)
- Frontend doesn't validate length bounds before sending

**Evidence**:
- `backend/services/uniprot_query.py:267-272` - Length filter construction
- Error handling in `server.py:1591-1610` (400 fallback) exists but reactive

**Affected Files**:
- `backend/services/uniprot_query.py:267-272` - Length filter logic
- `ui/src/components/UniProtQueryInput.tsx:176-187` - No client-side validation

---

### Bug 4: Charts Show Misleading 0 Values / Empty Graph
**Root Cause**: Not analyzed in detail (requires chart component inspection)

**Likely Causes**:
- Zero values passed to charts when provider_status is OFF
- Missing null/undefined filtering in chart data prep

**Affected Files** (suspected):
- `ui/src/components/ResultsCharts.tsx` - Chart data preparation

---

### Bug 5: Long Running Pipeline Causes Reload/Interruptions
**Root Cause**: Not analyzed in detail (requires timeout/instrumentation review)

**Likely Causes**:
- Frontend timeout (30s in UniProtQueryInput.tsx:134)
- No progress indicators for long Tango runs
- Browser reloads page during long waits

**Affected Files** (suspected):
- `ui/src/components/UniProtQueryInput.tsx:130-134` - 30s timeout
- `backend/server.py:1354-1356` - Tango execution (no progress reporting)

---

## 4. Patch Plan

### File 1: `backend/server.py`
**Change**: Fix `meta.use_tango` assignment to reflect env USE_TANGO, not runtime flag  
**Reason**: UI fallback needs correct env-based flag when provider_status is incomplete

**Line**: 1558  
**Current**: `"use_tango": tango_actually_ran`  
**Fix**: `"use_tango": USE_TANGO` (or remove if provider_status always present)

---

### File 2: `ui/src/pages/Results.tsx`
**Change**: Remove fallback to `meta.use_tango`, use only `meta.provider_status`  
**Reason**: Provider status is canonical source; fallback causes inconsistency

**Lines**: 184-192  
**Current**: Conditional `meta.provider_status?.tango` OR `meta.use_tango` fallback  
**Fix**: Always use `meta.provider_status?.tango`, show "UNKNOWN" if missing

---

### File 3: `backend/services/uniprot_query.py`
**Change**: Validate length bounds before building query (reject `[* TO 6]` pattern)  
**Reason**: Prevents UniProt API 400 errors from invalid length range queries

**Lines**: 263-273  
**Fix**: Add validation: if `length_max < 10`, require `length_min >= 1` (no wildcard lower bound)

---

### File 4: `backend/server.py` (provider_status structure)
**Change**: Ensure provider_status always present in meta, even when OFF  
**Reason**: UI should never need fallback to legacy `use_tango` flag

**Lines**: 1274-1295, 1544-1563  
**Fix**: Verify provider_status_meta structure is always returned (already seems correct)

---

### File 5: `scripts/smoke_uniprot_pipeline.sh` (if needed)
**Change**: Verify smoke tests check provider_status keys  
**Reason**: Ensure tests validate new provider_status structure

**Status**: Review existing tests - may already pass

---

## Summary

**Critical Issues**:
1. ✅ UI fallback inconsistency (Results.tsx uses `use_tango` instead of `provider_status`)
2. ✅ Backend `use_tango` reflects runtime, not env (server.py:1558)
3. ⚠️ Length filter validation missing (uniprot_query.py)

**Medium Priority**:
4. Charts/empty graph issue (needs component analysis)
5. Long-running timeout handling (needs instrumentation)

**Next Steps**:
1. Apply patches to Files 1-3 (surgical fixes)
2. Test with smoke scripts
3. Verify provider status UI shows correct state
4. Verify UniProt length filter doesn't cause 400

