# Sentinel Value Audit: Reference vs PVL

**Date:** 2026-02-02
**Phase:** 4 of Reference Implementation Integration

---

## Executive Summary

| Aspect | Reference | PVL | Status |
|--------|-----------|-----|--------|
| Missing SSW score/diff | `-1` | `null` | ✅ PVL is correct |
| Missing percentages | `0` | `null` | ✅ PVL is correct |
| SSW prediction "no switch" | `-1` | `-1` | ✅ Match |
| SSW prediction "switch found" | `1` | `1` | ✅ Match |
| SSW prediction "not available" | N/A (always computed) | `null` | ✅ PVL is correct |
| μH when no segments | `-1` | `null` | ✅ PVL is correct |
| Threshold comparison | `diff < avg` → 1 | `diff <= avg` → 1 | ⚠️ Minor difference |

**Conclusion:** PVL's null semantics are correct and MORE ROBUST than reference's -1 sentinel approach.

---

## Detailed Comparison

### 1. SSW Score and Diff (when no SSW fragments detected)

**Reference (`260120.../auxiliary.py` lines 148-167):**
```python
def calc_secondary_structure_switch_difference_and_score(...):
    if len(ssw_indexes) == 0:
        return -1, -1  # ← Uses -1 as sentinel for "no data"
```

**PVL (`backend/auxiliary.py` lines 273-292):**
```python
def calc_secondary_structure_switch_difference_and_score(...):
    if len(structure_prediction_indexes) == 0:
        return None, None  # ← Uses None (becomes null in JSON)
```

**Assessment:** PVL is CORRECT. Using `null` is semantically clearer than `-1` for "no data available".

---

### 2. SSW Analysis Default Values

**Reference (`260120.../tango.py` lines 116-118):**
```python
result_analysis_dict = {
    SSW_FRAGMENTS_TANGO: [],
    SSW_SCORE_TANGO: -1,           # ← -1 sentinel
    SSW_DIFF_TANGO: -1,            # ← -1 sentinel
    SSW_HELIX_PERCENTAGE_TANGO: 0, # ← 0 for percentage
    SSW_BETA_PERCENTAGE_TANGO: 0,  # ← 0 for percentage
    SSW_PERCENTAGE_TANGO: 0        # ← 0 for percentage
}
```

**PVL (`backend/tango.py` lines 856-864):**
```python
return {
    "SSW_residues": [],
    "SSW_avg_score": None,      # ← null
    "Helix_and_beta_diff": None, # ← null
    "Helix_percentage": None,    # ← null (not 0!)
    "Beta_percentage": None,     # ← null (not 0!)
}
```

**Assessment:** PVL is CORRECT. Using `null` for missing percentages is better because:
- `0%` and "no data" are semantically different
- UI can distinguish between "calculated as 0%" vs "not calculated"

---

### 3. Hydrophobic Moment (μH) for Segments

**Reference (`260120.../auxiliary.py` lines 230-243):**
```python
def get_avg_uH_by_segments(sequence: str, secondary_structure_idx: list) -> float:
    if len(secondary_structure_idx) == 0:
        return -1  # ← -1 sentinel
```

**PVL (`backend/auxiliary.py` lines 356-382):**
```python
def get_avg_uH_by_segments(sequence: str, segments: list) -> Optional[float]:
    if not sequence or not segments:
        return None  # ← null
```

**Assessment:** PVL is CORRECT.

---

### 4. SSW Prediction Values

**Reference (`260120.../auxiliary.py` lines 513-519):**
```python
for _, row in database.iterrows():
    if row[diff_column] >= avg_diff:
        ssw_predictions.append(-1)  # ← -1 = "high diff, not SSW candidate"
    else:
        ssw_predictions.append(1)   # ← 1 = "low diff, SSW candidate"
```

**PVL (`backend/tango.py` lines 1349-1366):**
```python
if ssw_diff_val is None or (isinstance(ssw_diff_val, float) and ...):
    preds.append(None)  # ← null = "no data" (reference doesn't handle this!)
elif comparison_op == "<=":
    preds.append(1 if ssw_diff_val <= avg_diff else -1)
```

**Assessment:** PVL adds a THIRD state (`null`) that reference doesn't have:

| Value | Reference Meaning | PVL Meaning |
|-------|-------------------|-------------|
| `1` | SSW candidate (low diff) | SSW candidate (low diff) |
| `-1` | Not SSW candidate (high diff) | Not SSW candidate (high diff) |
| `null` | N/A | Provider didn't run / failed |

This is CORRECT - PVL properly distinguishes "prediction ran and found no switch" from "prediction didn't run".

---

### 5. Filter for Average Diff Calculation

**Reference (`260120.../auxiliary.py` line 510):**
```python
avg_diff = database[database[diff_column] != -1][diff_column].mean()
```

**PVL (`backend/tango.py` lines 1320-1322):**
```python
valid_diffs = database[database["SSW diff"].notna()]["SSW diff"]
valid_diffs = valid_diffs[valid_diffs.apply(lambda x: x is not None and ...)]
```

**Assessment:** Both correctly filter out missing values before computing average.
- Reference: filters out `-1` sentinels
- PVL: filters out `None`/`NaN` values

---

### 6. Threshold Comparison Operator

**Reference:** `if diff >= avg_diff: -1 else: 1`
- `diff < avg` → 1 (SSW candidate)
- `diff >= avg` → -1 (not SSW candidate)

**PVL:** `if diff <= avg_diff: 1 else: -1`
- `diff <= avg` → 1 (SSW candidate)
- `diff > avg` → -1 (not SSW candidate)

**Assessment:** ⚠️ Minor difference at boundary:
- Reference: diff == avg → -1
- PVL: diff == avg → 1

This is a MINOR edge case. The default PVL behavior is configurable via `SSW_DIFF_COMPARISON` env var.

---

## PVL's Null Semantics Implementation

### normalize.py: `_convert_fake_defaults_to_null()`

PVL has robust null handling at the API boundary:

```python
# When provider is NOT available: nullify ALL provider fields
if provider_status.tango.status != "AVAILABLE":
    tango_fields = ["sswPrediction", "sswScore", "sswDiff", ...]
    for field in tango_fields:
        if field in result:
            result[field] = None

# When provider IS available: only nullify -1/empty (preserve real zeros)
# EXCEPTION: -1 for sswPrediction is VALID (means "no switch")
tango_fake_defaults = {
    "sswScore": [-1, None, "", "-"],      # -1 is invalid
    "sswDiff": [-1, None, "", "-"],       # -1 is invalid
    "sswHelixPercentage": [-1],           # -1 is invalid, but preserve 0.0
    "sswBetaPercentage": [-1],            # -1 is invalid, but preserve 0.0
}
```

### normalize.py: `_sanitize_for_json()`

Additional sanitization preserves `sswPrediction = -1`:

```python
if isinstance(obj, int):
    # Preserve -1 ONLY for sswPrediction (valid semantic value: "no switch")
    if obj == -1 and field_name != "sswPrediction":
        return None
    return obj
```

---

## UI Contract (CONTRACTS.md)

From `docs/active/CONTRACTS.md`, the API contract specifies:

```typescript
interface PeptideRow {
  sswPrediction: number | null;  // -1, 0, 1, or null
  sswScore: number | null;
  sswDiff: number | null;
  // ...
}
```

**Interpretation:**
- `sswPrediction = -1`: TANGO ran, no structural switch detected
- `sswPrediction = 1`: TANGO ran, structural switch detected
- `sswPrediction = 0`: Ambiguous (rarely used)
- `sswPrediction = null`: TANGO didn't run or failed

---

## Test Verification

### Existing Tests That Validate Null Semantics

1. **`test_golden_pipeline.py::test_no_zero_becomes_neg_one`**
   - Ensures 0 values are not incorrectly converted to -1

2. **`test_golden_pipeline.py::test_ssw_percent_matches_table`**
   - Validates SSW percentage calculation

3. **`test_golden_pipeline.py::test_tango_entry_aligned_assignment`**
   - Validates TANGO results are aligned by Entry ID

### Additional Tests Needed

See `test_sentinel_values.py` for comprehensive sentinel value tests.

---

## Recommendations

1. **No changes needed** - PVL's null semantics are correct and more robust than reference

2. **Document the sswPrediction special case** - `-1` is valid for sswPrediction (means "no switch")

3. **Consider adding env var for threshold comparison** - Already implemented via `SSW_DIFF_COMPARISON`

4. **Add golden test for boundary case** - Test when diff == avg_diff

---

## Phase 4 Status: COMPLETE ✅

PVL correctly implements null semantics:
- Missing data → `null` (not `-1` or `0`)
- Valid predictions → `-1` or `1`
- Provider status determines nullification at API boundary
