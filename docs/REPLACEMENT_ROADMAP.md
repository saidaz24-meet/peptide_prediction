# Replacement Roadmap: Reference → PVL Alignment

**Date:** 2026-02-02
**Purpose:** Step-by-step plan to align PVL calculations with reference implementation.

---

## Executive Summary

Based on the correctness delta analysis, there are **4 discrepancies** that require decisions:

| # | Discrepancy | Recommendation | Effort |
|---|-------------|----------------|--------|
| 1 | SSW threshold comparison (`<=` vs `<`) | FIX to match reference | Low |
| 2 | μH averaging method | KEEP PVL (weighted) | None |
| 3 | Histidine charge | KEEP PVL (H=0.1) | None |
| 4 | B/Z preprocessing | FIX to match reference | Low |

**Null semantics** (PVL's `null` vs reference's `-1`) is NOT a discrepancy to fix — it's an intentional improvement.

---

## Phase 0: Decision Points (REQUIRED BEFORE IMPLEMENTATION)

### Decision 1: SSW Threshold Comparison

**Question:** Should the SSW prediction threshold use `<` (reference) or `<=` (PVL)?

| Option | Behavior at boundary (diff == avg) | Pros | Cons |
|--------|-----------------------------------|------|------|
| A: Match reference (`<`) | diff == avg → -1 (NOT SSW) | Matches reference exactly | Minor breaking change |
| B: Keep PVL (`<=`) | diff == avg → 1 (IS SSW) | No code change | Differs from reference |

**My Recommendation:** Option A — match reference for reproducibility.

**Action Required:** Approve or reject Option A.

---

### Decision 2: μH Averaging Method

**Question:** Should μH for segments use simple mean (reference) or weighted average (PVL)?

| Option | Formula | Pros | Cons |
|--------|---------|------|------|
| A: Match reference | `mean([μH1, μH2, ...])` | Matches reference exactly | Arguably less accurate |
| B: Keep PVL (weighted) | `Σ(μH_i × len_i) / Σ len_i` | Scientifically better | Differs from reference |

**My Recommendation:** Option B — weighted average is more accurate (longer segments contribute more residues).

**Action Required:** Approve or reject Option B.

---

### Decision 3: Histidine Charge

**Question:** Should charge calculation include histidine (H=0.1 at pH 7.4)?

| Option | Effect on "HHHH" | Pros | Cons |
|--------|------------------|------|------|
| A: Match reference (omit H) | charge = 0.0 | Matches reference exactly | Chemically incorrect |
| B: Keep PVL (H=0.1) | charge = 0.4 | Chemically accurate | Differs from reference |

**My Recommendation:** Option B — H=0.1 is chemically accurate.

**Action Required:** Approve or reject Option B.

---

### Decision 4: B/Z Preprocessing

**Question:** Should ambiguous amino acid codes resolve to acid (reference) or amide (PVL) forms?

| Option | B mapping | Z mapping | Pros | Cons |
|--------|-----------|-----------|------|------|
| A: Match reference | B → D (aspartate) | Z → E (glutamate) | Matches reference | Breaks TANGO edge cases |
| B: Keep PVL | B → N (asparagine) | Z → Q (glutamine) | TANGO compatibility | Differs from reference |
| C: Unify all to reference | B → D, Z → E everywhere | Consistent | Requires TANGO sanitizer change |

**My Recommendation:** Option C — unify for consistency.

**Action Required:** Approve or reject Option C.

---

## Phase 1: SSW Threshold Fix (if Decision 1 = Option A)

### Step 1.1: Modify threshold comparison

**File:** `backend/tango.py`

**Current code (lines ~1345-1360):**
```python
comparison_op = os.getenv("SSW_DIFF_COMPARISON", "<=")  # Default: <=

if comparison_op == "<=":
    preds.append(1 if ssw_diff_val <= avg_diff else -1)
elif comparison_op == "<":
    preds.append(1 if ssw_diff_val < avg_diff else -1)
```

**Change to:**
```python
comparison_op = os.getenv("SSW_DIFF_COMPARISON", "<")  # Default: < (match reference)

if comparison_op == "<":
    preds.append(1 if ssw_diff_val < avg_diff else -1)  # Reference behavior
elif comparison_op == "<=":
    preds.append(1 if ssw_diff_val <= avg_diff else -1)  # Legacy PVL behavior
```

### Step 1.2: Add golden test for boundary case

**File:** `backend/tests/test_ssw_golden.py`

**Add test:**
```python
def test_ssw_threshold_boundary_matches_reference():
    """
    When diff == avg, reference returns -1 (NOT SSW).
    PVL should match this behavior.
    """
    # Create dataset where one peptide has diff exactly at average
    # Verify it gets prediction = -1
```

### Step 1.3: Verify no regression

```bash
make test
```

---

## Phase 2: B/Z Preprocessing Unification (if Decision 4 = Option C)

### Step 2.1: Modify TANGO sanitizer

**File:** `backend/tango.py`

**Current code (around line ~50):**
```python
AMBIGUOUS_MAP = {
    "B": "N",   # → asparagine (DIFFERS FROM REFERENCE)
    "Z": "Q",   # → glutamine (DIFFERS FROM REFERENCE)
    "X": "",
    "U": "C",
    "O": "K",
    "*": "",
}
```

**Change to:**
```python
AMBIGUOUS_MAP = {
    "B": "D",   # → aspartate (MATCHES REFERENCE)
    "Z": "E",   # → glutamate (MATCHES REFERENCE)
    "X": "",    # drop unknown
    "U": "C",   # selenocysteine → cysteine
    "O": "K",   # pyrrolysine → lysine
    "*": "",    # drop stop
}
```

### Step 2.2: Add golden test

**File:** `backend/tests/test_preprocessing_golden.py` (NEW FILE)

```python
"""
Golden tests for sequence preprocessing.
Validates that PVL matches reference implementation's handling of ambiguous codes.
"""
import pytest
import auxiliary
from tango import _sanitize_seq

class TestPreprocessingMatchesReference:
    """Verify ambiguous amino acid handling matches reference."""

    def test_b_maps_to_aspartate(self):
        """B (Asx) should map to D (aspartate), matching reference."""
        assert auxiliary.get_corrected_sequence("ABCD") == "ADCD"
        assert _sanitize_seq("ABCD") == "ADCD"

    def test_z_maps_to_glutamate(self):
        """Z (Glx) should map to E (glutamate), matching reference."""
        assert auxiliary.get_corrected_sequence("AZCD") == "AECD"
        assert _sanitize_seq("AZCD") == "AECD"

    def test_x_handling(self):
        """X (unknown) handling."""
        # Reference: X → A
        assert auxiliary.get_corrected_sequence("AXCD") == "AACD"
        # TANGO sanitizer: X → '' (drop)
        assert _sanitize_seq("AXCD") == "ACD"

    def test_u_maps_to_cysteine(self):
        """U (selenocysteine) should map to C (cysteine)."""
        assert auxiliary.get_corrected_sequence("AUCD") == "ACCD"
        assert _sanitize_seq("AUCD") == "ACCD"
```

### Step 2.3: Verify no regression

```bash
make test
```

---

## Phase 3: Documentation Updates

### Step 3.1: Update KNOWLEDGE_INDEX.md

Add section documenting intentional differences from reference:

```markdown
## Intentional Differences from Reference Implementation

### 1. Null Semantics (CORRECT)
- Reference uses `-1` as sentinel for missing data
- PVL uses `null` (JSON null) for missing data
- Rationale: `null` is semantically correct for "no data available"

### 2. μH Averaging (IMPROVEMENT)
- Reference uses simple mean of segment μH values
- PVL uses weighted average by segment length
- Rationale: Longer segments contribute more residues, so weighted is more accurate

### 3. Histidine Charge (IMPROVEMENT)
- Reference omits histidine from charge calculation
- PVL includes H = +0.1 (10% protonated at pH 7.4)
- Rationale: Chemically accurate
```

### Step 3.2: Update TESTING_GUIDE.md

Add section on golden tests:

```markdown
## Golden Tests (Reference Validation)

Golden tests validate PVL against the reference implementation:

- `test_ssw_golden.py` — SSW algorithm validation
- `test_biochem_golden.py` — Biochemical calculations
- `test_sentinel_values.py` — Null semantics
- `test_preprocessing_golden.py` — Sequence preprocessing

Run all golden tests:
```bash
pytest backend/tests/test_*_golden.py -v
```
```

---

## Phase 4: Deletions (if any)

Based on the analysis, **NO FILES NEED TO BE DELETED**. The integration is about aligning algorithms, not removing code.

However, the following can be removed from the **previous Phase 1-4 work** if it's deemed redundant:

### Files created in previous phases (now superseded):
- `docs/SSW_ALGORITHM_COMPARISON.md` — Content merged into CORRECTNESS_DELTA_REPORT.md
- `docs/SENTINEL_VALUE_AUDIT.md` — Content merged into CORRECTNESS_DELTA_REPORT.md
- `docs/REF_IMPL_INTEGRATION_PLAN.md` — Superseded by this roadmap

**Decision Required:** Delete old docs or keep for reference?

---

## Implementation Checklist

### Phase 0: Decisions
- [ ] Decision 1: SSW threshold — Option A (match reference `<`) or Option B (keep `<=`)?
- [ ] Decision 2: μH averaging — Option A (match reference simple mean) or Option B (keep weighted)?
- [ ] Decision 3: Histidine — Option A (omit H) or Option B (keep H=0.1)?
- [ ] Decision 4: B/Z preprocessing — Option A/B/C?
- [ ] Decision 5: Delete old Phase 1-4 docs?

### Phase 1: SSW Threshold (conditional)
- [ ] Modify `tango.py` default from `<=` to `<`
- [ ] Add boundary test to `test_ssw_golden.py`
- [ ] Verify `make test` passes

### Phase 2: B/Z Preprocessing (conditional)
- [ ] Modify `AMBIGUOUS_MAP` in `tango.py`
- [ ] Create `test_preprocessing_golden.py`
- [ ] Verify `make test` passes

### Phase 3: Documentation
- [ ] Update KNOWLEDGE_INDEX.md with intentional differences
- [ ] Update TESTING_GUIDE.md with golden test info
- [ ] (Optional) Delete superseded docs

### Phase 4: Final Verification
- [ ] Run full test suite: `make ci`
- [ ] Manual smoke test with sample data
- [ ] Review all changes before merge

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| SSW threshold `<=` → `<` | Low | Env var allows reverting to `<=` |
| B/Z mapping change | Low | Only affects sequences with B/Z codes |
| Documentation updates | None | No code changes |

---

## Rollback Plan

All changes are isolated and reversible:

1. **SSW threshold:** Set `SSW_DIFF_COMPARISON=<=` env var
2. **B/Z preprocessing:** Revert `AMBIGUOUS_MAP` changes
3. **Each phase is a separate commit** for easy revert

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 0 (Decisions) | 0h (user input) | None |
| Phase 1 (SSW threshold) | 30 min | Decision 1 |
| Phase 2 (B/Z preprocessing) | 30 min | Decision 4 |
| Phase 3 (Documentation) | 1h | Phases 1-2 |
| Phase 4 (Verification) | 30 min | Phases 1-3 |

**Total: ~2.5 hours** (assuming all decisions are Option A/C)

---

## STOP: User Approval Required

**I have completed the three documentation deliverables:**

1. ✅ `docs/REF_IMPL_FULL_WALKTHROUGH.md` — End-to-end reference implementation flow
2. ✅ `docs/CORRECTNESS_DELTA_REPORT.md` — Detailed comparison with evidence
3. ✅ `docs/REPLACEMENT_ROADMAP.md` — Step-by-step implementation plan

**Before implementing any code changes, please review and approve:**

1. The four decision points in Phase 0
2. The overall replacement roadmap
3. Which old docs (if any) to delete

**Awaiting your approval to proceed with implementation.**
