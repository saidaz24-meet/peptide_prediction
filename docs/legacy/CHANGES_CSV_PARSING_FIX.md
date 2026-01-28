# CSV Parsing Fix - Summary of Changes

## Problem Fixed

The original `canonicalize_headers()` function used substring matching (`low in opts`), which could cause:
1. False matches (e.g., "Entry ID (Primary)" matching "entry" because "entry" is a substring)
2. Silent data loss when multiple columns matched the same canonical name (only first match kept)
3. Ambiguous header situations going undetected

## Files Changed

### 1. `backend/server.py`

**Function: `canonicalize_headers()` (lines 276-338)**

**Changes:**
- Replaced substring matching with priority-based explicit matching:
  1. **Exact match** with canonical name (highest priority)
  2. **Exact match** with synonym from HEADER_SYNONYMS list
  3. **Word-boundary substring match** (lowest priority, only if no exact match)
  
- Added **ambiguous match detection**: If multiple columns match the same canonical name, raises `HTTPException 400` with clear error message listing:
  - Which canonical name is ambiguous
  - Which columns matched
  - Expected synonym names

**Function: `normalize_cols()` (lines 344-360)**

**Changes:**
- Updated docstring to note that `canonicalize_headers()` may raise HTTPException 400
- Exception now propagates correctly (no change needed to exception handling)

**Impact:**
- `/api/upload-csv` - Now properly rejects ambiguous headers with HTTP 400
- `/api/example` - Already has try/except HTTPException, so ambiguous headers will be caught
- All parsing paths are now consistent

### 2. `backend/tests/test_golden_pipeline.py`

**Changes:**
- Added import for `HTTPException` from fastapi
- Added new test function `test_ambiguous_headers()` that:
  - Loads CSV with ambiguous headers ("Entry" and "Entry ID (Primary)")
  - Verifies HTTPException 400 is raised
  - Verifies error message contains "Ambiguous"
- Added test to test suite list

### 3. `backend/tests/golden_inputs/ambiguous_headers.csv` (NEW FILE)

**Purpose:**
- Test file with ambiguous headers: "Entry" and "Entry ID (Primary)" both match canonical "entry"
- Used by `test_ambiguous_headers()` to verify the fix works

## Verification

### Run Tests:
```bash
cd backend
python tests/test_golden_pipeline.py
```

### Expected Behavior:

**Before fix:**
- "Entry" and "Entry ID (Primary)" would both match "entry"
- Only "Entry" would be renamed to "entry", "Entry ID (Primary)" would be lost
- No error raised

**After fix:**
- Both columns match "entry" → Ambiguous match detected
- HTTPException 400 raised with message:
  ```
  Ambiguous column headers detected. Ambiguous header 'entry': multiple columns matched: ['Entry', 'Entry ID (Primary)']. Expected one of: ['entry', 'accession', 'ac', 'uniprotkb', 'uniprot id', 'id', 'primary accession', 'primary (accession no.)', 'entry id']
  ```

### Test Normal CSV Still Works:
The normal CSV should still work correctly - exact matches are prioritized, so "Entry" matches "entry" exactly and no ambiguity occurs.

## Backward Compatibility

✅ **Backward compatible**: Files with non-ambiguous headers continue to work as before.

⚠️ **Breaking change**: Files with ambiguous headers that previously silently lost data will now raise an error. This is **intentional** - it prevents silent data corruption.

