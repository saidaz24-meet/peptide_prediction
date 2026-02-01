# SSW Algorithm Comparison: Reference vs PVL

**Date:** 2026-02-02
**Phase:** 1 of Reference Implementation Integration

---

## Executive Summary

| Function | Reference | PVL | Status |
|----------|-----------|-----|--------|
| `get_secondary_structure_segments()` | `min_score` param | `prediction_method` lookup | ✅ Same algorithm |
| `find_secondary_structure_switch_segments()` | identical | identical | ✅ Match |
| `calc_secondary_structure_switch_difference_and_score()` | returns `-1, -1` | returns `None, None` | ✅ Null semantics |
| `get_avg_uH_by_segments()` | simple mean | **weighted average** | ⚠️ **DISCREPANCY** |
| SSW prediction threshold | `diff >= avg → -1` | `diff > avg → -1` | ⚠️ Boundary differs |

---

## Thresholds

| Threshold | Reference | PVL | Status |
|-----------|-----------|-----|--------|
| MIN_SEGMENT_LENGTH | 5 | 5 | ✅ Match |
| MAX_GAP | 3 | 3 | ✅ Match |
| MIN_TANGO_SCORE | 0 | 0 | ✅ Match |
| MIN_JPRED_SCORE | 7 | 7 | ✅ Match |
| MIN_S4PRED_SCORE | 0.5 | 0.5 | ✅ Match |

---

## Detailed Function Comparison

### 1. `get_secondary_structure_segments()`

**Purpose:** Find contiguous segments with secondary structure prediction above threshold.

**Reference (`260120.../auxiliary.py` lines 87-127):**
```python
def get_secondary_structure_segments(prediction: list, min_score: int) -> list:
    segments = []
    i = 0
    while i < len(prediction):
        if prediction[i] > 0:
            start = i
            gap = 0
            i += 1
            while i < len(prediction) and gap <= config.MAX_GAP:
                if prediction[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1
            end = i - 1 - gap
            segment_length = end - start + 1
            good_segment = segment_length >= config.MIN_SEGMENT_LENGTH and \
                          (mean(prediction[start:end]) >= min_score or
                           median(prediction[start:end]) >= min_score)
            if good_segment:
                segments.append(tuple((start, end)))
            # ... subsegment fallback logic
        i += 1
    return segments
```

**PVL (`backend/auxiliary.py` lines 207-252):**
```python
def get_secondary_structure_segments(prediction: list, prediction_method: str) -> list:
    min_score = -np.inf
    if prediction_method == "Tango":
        min_score = MIN_TANGO_SCORE
    elif prediction_method == "Jpred":
        min_score = MIN_JPRED_SCORE
    # ... same algorithm as reference
```

**Assessment:** ✅ **MATCH** - Same algorithm, different API signature.

---

### 2. `find_secondary_structure_switch_segments()`

**Purpose:** Find overlapping regions between helix and beta segments.

**Both implementations are IDENTICAL** (lines 170-227 in reference, 295-352 in PVL).

The algorithm:
1. Walk through sorted helix and beta segments
2. Find overlapping regions
3. Extract the overlap as SSW segment

**Assessment:** ✅ **EXACT MATCH**

---

### 3. `calc_secondary_structure_switch_difference_and_score()`

**Purpose:** Calculate SSW score (sum) and diff (|helix - beta|).

**Reference (lines 148-167):**
```python
def calc_secondary_structure_switch_difference_and_score(...) -> tuple:
    if len(ssw_indexes) == 0:
        return -1, -1  # ← Sentinel value
    beta_score = __calc_average_score(beta_prediction, ssw_indexes)
    helix_score = __calc_average_score(helix_prediction, ssw_indexes)
    ssw_score = beta_score + helix_score
    ssw_diff = abs(beta_score - helix_score)
    return ssw_score, ssw_diff
```

**PVL (lines 273-292):**
```python
def calc_secondary_structure_switch_difference_and_score(...) -> tuple:
    if len(structure_prediction_indexes) == 0:
        return None, None  # ← Null semantics
    # ... same calculation
```

**Assessment:** ✅ **MATCH** - Same algorithm, null semantics difference (already documented in Phase 4).

---

### 4. `get_avg_uH_by_segments()` ⚠️ DISCREPANCY

**Purpose:** Calculate average hydrophobic moment for segments.

**Reference (lines 230-243):**
```python
def get_avg_uH_by_segments(sequence: str, secondary_structure_idx: list) -> float:
    if len(secondary_structure_idx) == 0:
        return -1
    segments_uH = []
    for start, end in secondary_structure_idx:
        segments_uH.append(biochemCalculation.hydrophobic_moment(sequence[start:(end + 1)]))
    return mean(segments_uH)  # ← SIMPLE MEAN
```

**PVL (lines 356-382):**
```python
def get_avg_uH_by_segments(sequence: str, segments: list) -> Optional[float]:
    if not sequence or not segments:
        return None
    total_muH = 0.0
    total_length = 0
    for segment in segments:
        start, end = segment[0] - 1, segment[1]  # Convert to 0-indexed
        seg_seq = sequence[start:end]
        muH = biochem_calculation.hydrophobic_moment(seg_seq)
        total_muH += muH * len(seg_seq)  # ← WEIGHTED BY LENGTH
        total_length += len(seg_seq)
    return total_muH / total_length  # ← WEIGHTED AVERAGE
```

**Differences:**

| Aspect | Reference | PVL |
|--------|-----------|-----|
| Empty segments | returns `-1` | returns `None` |
| Segment indexing | 0-indexed | 1-indexed (converts internally) |
| **Averaging method** | **Simple mean** | **Weighted by segment length** |

**Example:**
```
Segments: [(0, 4), (10, 14)]  # Two segments, 5 residues each
Sequence: "AAAAA.....WWWWW"
μH(AAAAA) = 0.1
μH(WWWWW) = 0.5

Reference: mean([0.1, 0.5]) = 0.30
PVL: (0.1*5 + 0.5*5) / 10 = 0.30  # Same in this case

But if segments have different lengths:
Segments: [(0, 2), (10, 19)]  # 3 + 10 = 13 residues
μH(AAA) = 0.1
μH(WWWWWWWWWW) = 0.5

Reference: mean([0.1, 0.5]) = 0.30
PVL: (0.1*3 + 0.5*10) / 13 = 0.41
```

**Impact:** When segments have unequal lengths, results differ.

**Recommendation:** The weighted average (PVL) is arguably more correct because longer segments contribute more residues. However, to match reference behavior, we should consider aligning with simple mean.

---

### 5. SSW Prediction Threshold ⚠️ Boundary Difference

**Reference (lines 514-518):**
```python
if row[diff_column] >= avg_diff:
    ssw_predictions.append(-1)  # Not SSW candidate
else:
    ssw_predictions.append(1)   # SSW candidate
```

**PVL (`tango.py` comparison_op = "<="):**
```python
preds.append(1 if ssw_diff_val <= avg_diff else -1)
```

**Comparison:**
- Reference: `diff < avg` → 1 (SSW), `diff >= avg` → -1 (not SSW)
- PVL: `diff <= avg` → 1 (SSW), `diff > avg` → -1 (not SSW)

**Edge case when `diff == avg`:**
- Reference: -1 (not SSW)
- PVL: 1 (SSW)

**Impact:** Minor - only affects samples exactly at the threshold.

**PVL Config:** Controlled by `SSW_DIFF_COMPARISON` env var (defaults to `<=`).

---

## Action Items

### Must Fix
1. **μH Calculation:** Decide whether to use simple mean (reference) or weighted average (PVL)

### Already Correct
1. Null semantics (Phase 4 ✅)
2. Core segment detection algorithm ✅
3. SSW overlap detection ✅

### Optional
1. Make threshold comparison operator configurable (already done via `SSW_DIFF_COMPARISON`)

---

## Verification Tests

Created: `backend/tests/test_ssw_golden.py`

```bash
.venv/bin/python -m pytest tests/test_ssw_golden.py -v
```

---

## Phase 1 Status: IN PROGRESS

**Findings:**
- Core SSW algorithm matches reference ✅
- μH calculation uses different averaging method ⚠️
- Threshold boundary differs slightly ⚠️

**Next Steps:**
1. Create golden tests for SSW functions
2. Decide on μH averaging approach
3. Document decision and update if needed
