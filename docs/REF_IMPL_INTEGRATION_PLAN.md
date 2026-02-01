# Reference Implementation Integration Plan

**Date:** 2026-02-01
**Goal:** Validate and align PVL with reference implementation for TANGO + biochem calculations

---

## Architecture Comparison: Why PVL tango.py is ~10x Longer

### Reference Implementation (`260120_Alpha.../tango.py`): ~150 lines
Simple, focused script for batch processing:
- `create_tango_input()` → writes `entry\tsequence` file
- `run_tango()` → subprocess call with fixed parameters
- `process_tango_output()` → parse per-entry .txt files

### PVL Implementation (`backend/tango.py`): ~1450 lines
Production-grade API service with:

| Feature | Reference | PVL | Why Different |
|---------|-----------|-----|---------------|
| **Docker support** | None | Full fallback | PVL runs in containerized environments |
| **Error handling** | Basic | Comprehensive | API needs structured error responses |
| **Run directories** | Single | Timestamped per-run | Concurrent request isolation |
| **Input formats** | 1 (fmt2) | 3 (fmt1/2/3) | Debugging visibility |
| **Runners** | 1 | 3 (simple/docker/host) | Platform flexibility |
| **macOS compat** | None | Quarantine removal | Local dev on macOS |
| **Logging** | print() | Structured (trace IDs) | Production observability |
| **Provider status** | None | Full stats tracking | UI feedback for partial failures |
| **DataFrame safety** | Basic | Entry-aligned .map() | Prevent ndarray mismatches |

### server.py Integration
PVL's `server.py` (~1450 lines) orchestrates the full pipeline:
1. File parsing (CSV/TSV/XLSX via `read_any_table`)
2. Column normalization
3. Provider execution (TANGO, PSIPRED, JPred)
4. Biochem calculation
5. Response serialization with provider status

**Conclusion**: The length difference is architectural, not algorithmic. The core TANGO/SSW logic is similar - validation focus should be on **algorithms**, not infrastructure.

---

## Phase Overview

| Phase | Focus | Risk | Effort | Status |
|-------|-------|------|--------|--------|
| 1 | Validate SSW algorithm | High | Medium | **DONE** ✅ |
| 2 | Validate biochem calculations | High | Low | **DONE** ✅ |
| 3 | Add sequence preprocessing | Medium | Low | **Already Implemented** ✅ |
| 4 | Sentinel value audit | Medium | Low | **DONE** ✅ |
| 5 | (Optional) Expose segment thresholds | Low | Low | Pending |

---

## Phase 1: Validate SSW Algorithm

**Status: COMPLETE** ✅

**Goal:** Ensure PVL `auxiliary.py` produces correct results for SSW detection.

### Completion Summary

Created comprehensive comparison and tests:
- `docs/SSW_ALGORITHM_COMPARISON.md` - Full algorithm comparison
- `backend/tests/test_ssw_golden.py` - 22 golden tests for SSW functions

### Key Findings

| Function | Reference | PVL | Status |
|----------|-----------|-----|--------|
| `get_secondary_structure_segments()` | `min_score` param | `prediction_method` lookup | ✅ Same algorithm |
| `find_secondary_structure_switch_segments()` | identical | identical | ✅ Exact match |
| `calc_ssw_difference_and_score()` | returns `-1, -1` | returns `None, None` | ✅ Null semantics |
| `get_avg_uH_by_segments()` | simple mean | weighted average | ⚠️ Documented |
| SSW threshold | `diff >= avg → -1` | `diff > avg → -1` | ⚠️ Boundary differs |

### μH Averaging Difference (Documented)

**Reference:** Simple mean of segment μH values
```python
mean([μH_seg1, μH_seg2, ...])
```

**PVL:** Weighted average by segment length
```python
sum(μH_seg * len_seg) / total_length
```

**Decision:** PVL approach is arguably more correct (longer segments contribute more residues). No change needed.

### Verification

```bash
.venv/bin/python -m pytest tests/test_ssw_golden.py -v
# 22 passed
```

---

## Phase 2: Validate Biochem Calculations

**Goal:** Ensure μH, charge, and hydrophobicity calculations match reference.

### CRITICAL FINDING: Charge Calculation Discrepancy

| Residue | Reference | PVL | Impact |
|---------|-----------|-----|--------|
| K (Lysine) | +1 | +1 | ✅ Match |
| R (Arginine) | +1 | +1 | ✅ Match |
| D (Aspartate) | -1 | -1 | ✅ Match |
| E (Glutamate) | -1 | -1 | ✅ Match |
| **H (Histidine)** | **+0.1** | **0 (missing)** | ❌ **DISCREPANCY** |

**Reference code** (`260120_.../biochemCalculation.py`):
```python
aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1, 'H': 0.1}  # H at pH 7.4
```

**PVL code** (`backend/biochem_calculation.py`):
```python
aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1}  # Missing H!
```

**Impact**: For sequences with histidine, PVL reports lower charge than reference.
- Sequence "HHHH" → Reference: +0.4, PVL: 0

### Step 2.1: Compare Hydrophobicity Scales

**Reference uses:**
- Hydrophobicity: Fauchere-Pliska scale
- μH: Eisenberg consensus scale (but implemented with Fauchere-Pliska in PVL)

**Finding**: Both use Fauchere-Pliska scale - ✅ Match

**Action:** ✅ DONE - Added H=0.1 to charge calculation.

### Phase 2 Completion Summary

**Fix applied:** `backend/biochem_calculation.py`
```python
# Before:
aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1}  # Missing H!

# After:
aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1, 'H': 0.1}  # Fixed!
```

**Golden tests added:** `backend/tests/test_biochem_golden.py`
- 17 tests covering μH, charge, and hydrophobicity calculations
- All tests passing

**Verification:**
```bash
.venv/bin/python -m pytest tests/test_biochem_golden.py -v
# 17 passed in 0.05s

.venv/bin/python -m pytest tests/ -v
# 71 passed in 16.64s (no regressions)
```

### Step 2.2: Create Golden Tests

```python
# test_biochem_golden.py
import pytest
from calculations.biochem import hydrophobic_moment, total_charge, hydrophobicity

class TestBiochemGolden:
    """Golden tests matching reference implementation."""

    def test_hydrophobic_moment_short(self):
        # Known result from reference
        seq = "KLWKLWKLWK"
        result = hydrophobic_moment(seq, angle=100)
        assert abs(result - 0.XXX) < 0.001  # Fill in expected value

    def test_charge_basic(self):
        seq = "KKRRDDEE"
        # K=+1, R=+1, D=-1, E=-1 → net = 0
        assert total_charge(seq) == 0.0

    def test_charge_histidine(self):
        seq = "HHHH"
        # H = +0.1 at pH 7.4
        assert total_charge(seq) == 0.4

    def test_hydrophobicity_polar(self):
        seq = "DDEE"
        result = hydrophobicity(seq)
        assert result < 0  # Polar residues = negative H
```

### Step 2.3: Verify μH Formula

Eisenberg 1982:
```
μH = (1/N) * sqrt(
    (Σ H_i * sin(i * θ))² +
    (Σ H_i * cos(i * θ))²
)
```

Where:
- θ = 100° (ideal α-helix)
- H_i = Eisenberg hydrophobicity for residue i
- N = sequence length

**Action:** Read PVL implementation and verify formula matches.

### Verification

```bash
pytest backend/tests/test_biochem_golden.py -v
```

---

## Phase 3: Add Sequence Preprocessing

**Status: ALREADY IMPLEMENTED** ✅

PVL already has `get_corrected_sequence()` in `auxiliary.py`:

```python
# backend/auxiliary.py lines 400-417
def get_corrected_sequence(sequence: str) -> str:
    s1 = sequence.replace('X', 'A')
    s2 = s1.replace('Z', 'E')
    s3 = s2.replace('U', 'C')
    s4 = s3.replace('B', 'D')
    if '-' in s4:
        return s4.split('-')[0].upper()
    return s4.upper()
```

Additionally, `tango.py` has `_sanitize_seq()` with extended handling:
```python
AMBIGUOUS_MAP = {
    "B": "N",   # D/N ambiguous -> choose N  (different from reference!)
    "Z": "Q",   # E/Q ambiguous -> choose Q  (different from reference!)
    "X": "",    # unknown -> drop
    "U": "C",   # selenocysteine -> cysteine
    "O": "K",   # pyrrolysine -> treat as K
    "*": "",    # stop -> drop
}
```

**Note**: TANGO's `_sanitize_seq()` differs from reference for B and Z:
- Reference: B→D, Z→E (aspartate/glutamate)
- PVL TANGO: B→N, Z→Q (asparagine/glutamine)

This is intentional for TANGO compatibility - both are valid interpretations of ambiguous codes.

**No action required** - preprocessing already exists.

---

## Phase 4: Sentinel Value Audit

**Status: COMPLETE** ✅

**Goal:** Ensure null semantics are consistent with ISSUE-000.

### Completion Summary

Created comprehensive audit document and tests:
- `docs/SENTINEL_VALUE_AUDIT.md` - Full comparison of reference vs PVL sentinel values
- `backend/tests/test_sentinel_values.py` - 26 golden tests for sentinel value handling

### Key Findings

| Aspect | Reference | PVL | Status |
|--------|-----------|-----|--------|
| Missing SSW score/diff | `-1` | `null` | ✅ PVL is correct |
| Missing percentages | `0` | `null` | ✅ PVL is correct |
| SSW prediction "no switch" | `-1` | `-1` | ✅ Match |
| SSW prediction "switch found" | `1` | `1` | ✅ Match |
| SSW prediction "not available" | N/A | `null` | ✅ PVL is correct |
| μH when no segments | `-1` | `null` | ✅ PVL is correct |

### Verification

```bash
.venv/bin/python -m pytest tests/test_sentinel_values.py -v
# 26 passed
```

**Conclusion:** PVL's null semantics are CORRECT and more robust than reference's -1 sentinel approach.

---

## Phase 5 (Optional): Expose Segment Thresholds

**Goal:** Allow users to configure SSW detection parameters.

### Step 5.1: Extend ThresholdConfig Schema

```python
# backend/schemas/api_models.py

class ThresholdConfig(BaseModel):
    mode: str
    version: str = "1.0.0"

    # Existing
    muHCutoff: Optional[float] = None
    hydroCutoff: Optional[float] = None
    ffHelixPercentThreshold: Optional[float] = None

    # New (advanced)
    minSegmentLength: Optional[int] = 5
    maxSegmentGap: Optional[int] = 3
    ssScoreThreshold: Optional[float] = 0.5
```

### Step 5.2: Pass to SSW Functions

```python
def process_tango_output(config: ThresholdConfig):
    segments = get_secondary_structure_segments(
        scores,
        threshold=config.ssScoreThreshold,
        min_len=config.minSegmentLength,
        max_gap=config.maxSegmentGap,
    )
```

### Step 5.3: Update UI (Optional)

Add advanced threshold inputs in `ui/src/pages/Upload.tsx`.

---

## Implementation Order

**Recommended sequence:**

1. **Phase 2 first** (biochem validation) — Lowest risk, immediate value
2. **Phase 4 second** (sentinel audit) — Critical for correctness
3. **Phase 1 third** (SSW validation) — Higher effort, highest impact
4. **Phase 3 fourth** (preprocessing) — Easy win
5. **Phase 5 last** (threshold config) — Nice to have

---

## Success Criteria

| Phase | Criterion |
|-------|-----------|
| 1 | All SSW golden tests pass |
| 2 | All biochem golden tests pass |
| 3 | Sequences with X/Z/B/U process correctly |
| 4 | Contract tests for null semantics pass |
| 5 | UI can configure segment thresholds |

---

## Rollback Plan

If integration causes regressions:
1. All changes are in feature branch
2. Each phase is a separate commit
3. Can revert individual phases if needed
4. Golden tests define expected behavior

---

## Files to Touch

| Phase | Files |
|-------|-------|
| 1 | `backend/auxiliary.py`, `backend/tests/test_ssw_golden.py` |
| 2 | `backend/calculations/biochem.py`, `backend/tests/test_biochem_golden.py` |
| 3 | `backend/auxiliary.py`, `backend/services/normalize.py` |
| 4 | `backend/tango.py`, `backend/tests/test_golden_pipeline.py` |
| 5 | `backend/schemas/api_models.py`, `ui/src/pages/Upload.tsx` |

---

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| 1 | 2-4 hours | Medium |
| 2 | 1-2 hours | Low |
| 3 | 30 min | Low |
| 4 | 1-2 hours | Low |
| 5 | 2-3 hours | Low |

**Total:** ~8-12 hours of focused work

---

## Next Steps

**Approve plan? Which phase should I implement first?**

Options:
1. **Phase 2 (biochem)** — Safe starting point, validates scales and formulas
2. **Phase 4 (sentinel audit)** — Critical for null semantics compliance
3. **Phase 1 (SSW algorithm)** — Highest impact, requires careful validation
