# Result Alignment Fix - Summary of Changes

## Problem Fixed

The original `process_tango_output()`, `process_psipred_output()`, and `process_jpred_output()` functions used row-order-based alignment:
1. Iterated DataFrame rows with `iterrows()` in order
2. Built lists by appending results
3. Assigned lists to columns, assuming list order matched DataFrame row order

**Critical Bug**: If DataFrame rows were filtered, sorted, or shuffled between input creation and output processing, results would be misaligned - wrong results assigned to wrong peptides.

## Files Changed

### 1. `backend/tango.py`

**Function: `process_tango_output()` - Per-peptide file path (lines 641-699)**

**Changes:**
- Replaced list-building pattern with direct index-based assignment
- Initialize all result columns with default values upfront (aligned by DataFrame index)
- Changed from `append to list → assign list` to `assign directly via .loc[idx, column]`
- Results now matched by Entry ID (via file lookup), then assigned to correct row index
- This ensures alignment is stable regardless of DataFrame row order

**Function: `process_tango_output()` - Batch file fallback path (lines 722-747)**

**Changes:**
- Same fix: initialize columns with defaults, assign by index using `.loc[idx, column]`
- Batch file path already matched by Entry ID (`m = df_out[df_out[name_col] == entry]`), but list appending could still misalign
- Now uses direct assignment for consistency

### 2. `backend/psipred.py`

**Function: `process_psipred_output()` (lines 219-263)**

**Changes:**
- Replaced list-building pattern with direct index-based assignment
- Initialize all result columns with default values upfront
- Changed from `append to list → assign list` to `assign directly via .loc[idx, column]`
- Preserves existing SSW values if present (from Tango), else fills from PSIPRED

### 3. `backend/jpred.py`

**Function: `process_jpred_output()` (lines 206-233)**

**Changes:**
- Replaced list-building pattern with direct index-based assignment
- Initialize all result columns with default values upfront
- Changed from `append to list → assign list` to `assign directly via .loc[idx, column]`
- Added defensive check: `if entry not in jpred_results_dict: continue` (handles missing entries gracefully)
- This fixes the KeyError risk mentioned in semantic correctness analysis

### 4. `backend/tests/test_golden_pipeline.py`

**Added: `test_result_alignment_after_shuffle()` (new function)**

**Purpose:**
- Regression test that would fail if order-based alignment were reintroduced
- Creates DataFrame, shuffles rows, assigns test results by Entry ID
- Verifies each Entry gets its correct results regardless of row position

## Key Technical Change

**Before (broken):**
```python
results = []
for _, row in df.iterrows():
    entry = row["Entry"]
    result = lookup_result(entry)  # by Entry ID
    results.append(result)  # assumes order matches df rows
df["Result"] = results  # assigns in order - breaks if df was filtered/sorted!
```

**After (fixed):**
```python
# Initialize with defaults (aligned by index)
df["Result"] = pd.Series([-1] * len(df), index=df.index)

# Assign by index, not order
for idx, row in df.iterrows():
    entry = row["Entry"]
    result = lookup_result(entry)  # by Entry ID
    df.loc[idx, "Result"] = result  # assigns to correct row regardless of df order
```

## Verification

### Run Tests:
```bash
cd backend
python tests/test_golden_pipeline.py
```

### Expected Behavior:

**Before fix:**
- If DataFrame rows were shuffled/filtered, results could be assigned to wrong peptides
- Example: Entry "P67890" at row 1 gets results for Entry "P12345" (from row 0)

**After fix:**
- Results are always assigned to the correct Entry, regardless of DataFrame row order
- Each Entry gets its own results by ID lookup, then assigned to correct row index

## Backward Compatibility

✅ **Fully backward compatible**: Same function signatures, same column names, same default values.

✅ **Behavior improvement**: Handles edge cases better (missing entries, shuffled DataFrames).

