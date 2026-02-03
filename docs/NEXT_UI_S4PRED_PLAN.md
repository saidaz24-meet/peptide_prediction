# S4PRED Integration & UI Alignment Plan

**Created**: 2026-02-02
**Status**: Planning

---

## A. Biochemical Calculation Sources in PVL

| Feature | PVL File/Function | PeptideRow Field | DataFrame Column |
|---------|-------------------|------------------|------------------|
| **Hydrophobicity** | `biochem_calculation.hydrophobicity()` | `hydrophobicity` | `Hydrophobicity` |
| **μH (Hydrophobic moment)** | `biochem_calculation.hydrophobic_moment(angle=100)` | `muH` | `Full length uH` |
| **Charge** | `biochem_calculation.total_charge()` | `charge` | `Charge` |
| **FF-Helix %** | `auxiliary.ff_helix_percent()` | `ffHelixPercent` | `FF-Helix %` |
| **FF-Helix fragments** | `auxiliary.ff_helix_cores()` | `ffHelixFragments` | `FF Helix fragments` |
| **SSW Prediction** | `tango.filter_by_avg_diff()` | `sswPrediction` | `SSW prediction` |
| **SSW Score** | `tango.__analyse_tango_results()` | `sswScore` | `SSW score` |
| **SSW Diff** | `tango.__analyse_tango_results()` | `sswDiff` | `SSW diff` |
| **SSW Helix %** | `tango.__analyse_tango_results()` | `sswHelixPercentage` | `SSW helix percentage` |
| **SSW Beta %** | `tango.__analyse_tango_results()` | `sswBetaPercentage` | `SSW beta percentage` |
| **SSW Positive %** | `upload_service._compute_ssw_stats()` | N/A (meta) | `meta.ssw_positive_percent` |

---

## B. Reference Implementation Comparison

| Feature | Reference File/Function | PVL Counterpart | Match Status |
|---------|-------------------------|-----------------|--------------|
| **Fauchere-Pliska scale** | `biochemCalculation.py` | `biochem_calculation.py` | ✅ ALIGNED |
| **Hydrophobic moment (Eisenberg 1982)** | `biochemCalculation.hydrophobic_moment()` | `biochem_calculation.hydrophobic_moment()` | ✅ ALIGNED |
| **Charge calculation** | `biochemCalculation.total_charge()` | `biochem_calculation.total_charge()` | ⚠️ **MISMATCH** |
| **Sequence correction** | `auxiliary.get_corrected_sequence()` | `auxiliary.get_corrected_sequence()` | ✅ ALIGNED |
| **TANGO parameters** | `tango.create_tango_input()` | `tango._write_simple_bat()` | ✅ ALIGNED |
| **TANGO segment detection** | `auxiliary.get_secondary_structure_segments()` | `auxiliary.get_secondary_structure_segments()` | ✅ ALIGNED |
| **SSW fragment merging** | `auxiliary.find_secondary_structure_switch_segments()` | `auxiliary.find_secondary_structure_switch_segments()` | ✅ ALIGNED |
| **S4PRED execution** | `s4pred.run_s4pred_database()` | N/A (not implemented) | ❌ MISSING |
| **S4PRED parsing** | `s4pred.__get_s4pred_sequence_result()` | N/A | ❌ MISSING |
| **FF-Helix** | N/A (uses JPred/S4PRED) | `auxiliary.ff_helix_percent()` | N/A (different concept) |

### Mismatch Details

#### CHARGE CALCULATION — **CONTRACT-CRITICAL**
```
Reference: aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1}  # Returns int
PVL:       aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1, 'H': 0.1}  # Returns float
```

**Impact**: PVL includes partial Histidine charge (0.1 at pH 7.4). This is scientifically defensible but differs from reference.

**Decision**: Keep PVL implementation (more accurate). Document the difference.

---

## C. FF-Helix: Scientific Evaluation

### What FF-Helix Is
- **Local propensity calculation** based on Chou-Fasman-like helix propensity scale
- Sliding window (default 6 residues) identifies regions with mean propensity ≥ threshold
- **No external tool required** — pure sequence-based prediction

### Pros
1. **Always available** — no external tool dependency
2. **Fast** — O(n) sliding window algorithm
3. **Deterministic** — same input always produces same output
4. **Independent** — provides helix estimate when TANGO/S4PRED unavailable

### Cons
1. **Not neural network** — less accurate than S4PRED or JPred
2. **Single scale** — only uses Chou-Fasman propensities, not context
3. **No confidence scores** — binary in/out of helix region
4. **Not in reference** — makes comparison difficult

### Recommendation for Researchers
FF-Helix should be presented as:
> **"Sequence-based helix propensity estimate"** — A fast, deterministic estimate of helical regions based on amino acid propensity scales. For higher-accuracy predictions, use S4PRED or JPred results when available.

**UI Framing**: Show FF-Helix % as a fallback metric. When S4PRED is available, prioritize `Helix percentage (S4PRED)` in summary displays.

---

## D. TANGO Alignment Verification

### Parameters — ✅ ALIGNED
| Parameter | Reference | PVL |
|-----------|-----------|-----|
| N-terminus | `nt="N"` (free) | `nt="N"` |
| C-terminus | `ct="N"` (free) | `ct="N"` |
| pH | `ph="7"` | `ph="7"` |
| Temperature | `te="298"` (298K) | `te="298"` |
| Ionic strength | `io="0.1"` (0.1M) | `io="0.1"` |
| TF | `tf="0"` | `tf="0"` |

### Preprocessing — ✅ ALIGNED
Both use identical sequence correction:
```python
X → A, Z → E, U → C, B → D
```

### Segment Detection Thresholds
| Config | Reference | PVL |
|--------|-----------|-----|
| `MIN_SEGMENT_LENGTH` | 5 | Uses reference via `auxiliary.py` |
| `MAX_GAP` | 3 | Uses reference via `auxiliary.py` |
| `MIN_TANGO_SCORE` | 0 | Uses 0 |

---

## E. S4PRED Implementation Plan

### Phase 1: Backend Execution (Priority: HIGH)

**Files to create/modify:**
- `backend/s4pred.py` — S4PRED runner (mirror reference structure)
- `backend/calculations/s4pred.py` — Parsing and analysis functions

**S4PRED Command:**
```python
cmd = [sys.executable, "run_model.py",
       "--silent",
       "--save-by-idx",
       "--save-files", "--outdir", result_dir,
       fasta_filepath]
```

**Output format (.ss2):**
```
# S4PRED prediction
  1 M C 0.847 0.021 0.132
  2 R C 0.621 0.178 0.201
  ...
```
Columns: Index, AA, SS, P_C (coil), P_H (helix), P_E (beta)

### Phase 2: Parsing & Analysis

**Parse .ss2 files:**
```python
def parse_ss2(filepath: str) -> dict:
    """Returns dict with aa_list, ss_prediction, P_C, P_H, P_E arrays"""
    df = pd.read_csv(filepath, comment="#", header=None, sep=r"\s+",
                     names=["Index", "AA", "SS", "P_C", "P_H", "P_E"])
    return {
        'aa_list': df["AA"].tolist(),
        'ss_prediction': df["SS"].tolist(),
        'P_C': df["P_C"].tolist(),
        'P_H': df["P_H"].tolist(),
        'P_E': df["P_E"].tolist()
    }
```

**Apply reference thresholds:**
```python
MIN_S4PRED_SCORE = 0.5  # Reference config.py
MIN_SEGMENT_LENGTH = 5
MAX_GAP = 3
```

### Phase 3: PeptideRow Summary Fields

Add to `PeptideRow`:
```python
# S4PRED summary fields
s4predHelixPercent: Optional[float] = None      # Helix percentage (S4PRED)
s4predBetaPercent: Optional[float] = None       # Beta percentage (S4PRED)
s4predHelixFragments: Optional[List] = None     # Helix segment tuples
s4predBetaFragments: Optional[List] = None      # Beta segment tuples
s4predSswPrediction: Optional[int] = None       # SSW prediction from S4PRED (-1/0/1)
s4predSswScore: Optional[float] = None          # SSW score
s4predSswDiff: Optional[float] = None           # SSW diff
```

### Phase 4: PeptideDetail Expansion

Add to detail response:
```python
{
    "s4pred": {
        "available": true,
        "curves": {
            "P_H": [0.021, 0.178, ...],  # Per-residue helix probability
            "P_E": [0.132, 0.201, ...],  # Per-residue beta probability
            "P_C": [0.847, 0.621, ...]   # Per-residue coil probability
        },
        "prediction": ["C", "C", "H", ...],  # Per-residue SS prediction
        "helixSegments": [[5, 12], [20, 28]],
        "betaSegments": [[35, 42]],
        "sswSegments": [[8, 12]]  # Overlap regions
    }
}
```

### Phase 5: UI Integration

**Results Table columns:**
- `S4PRED Helix %` — from `s4predHelixPercent`
- `S4PRED SSW` — badge from `s4predSswPrediction`

**PeptideDetail view:**
- Residue probability plot (P_H, P_E, P_C curves)
- Segment annotation track
- Download raw `.ss2` button

---

## F. UI Fixes Required

### Issue 1: "Missing" Badge When Data Exists
**Root cause**: `sswPrediction = null` when TANGO ran but no SSW fragments found.
**Fix**: ✅ DONE (2026-02-02) — Changed `filter_by_avg_diff()` to return `-1` when TANGO ran but no fragments.

### Issue 2: Null-unsafe Table Cells
**Root cause**: `hydrophobicity.toFixed(2)` crashes when null.
**Fix**: ✅ DONE (2026-02-02) — Added null checks to `PeptideTable.tsx`.

### Issue 3: Metrics Page Denominator Mismatch
**Problem**: Summary shows "SSW 64.4% (66/69)" but metrics page shows "(0/0)".
**Fix**: ✅ DONE (2026-02-02) — Fixed `MetricDetail.tsx` pie chart logic:
- Correctly categorizes `null`/`undefined` as "Not available" (was checking `=== 0`)
- Groups "Uncertain" (0) with "Negative" for display simplicity
- SSW semantics: 1=positive, -1=negative, 0=uncertain, null=missing

### Issue 4: Pie Chart Black Rendering
**Problem**: Categories render as black when only one category.
**Fix**: ✅ DONE (2026-02-02) — Fixed `MetricDetail.tsx` COLORS object:
- Changed `--ssw-positive` (undefined) → `--success` (green, defined)
- Changed `--ssw-negative` (undefined) → `--chameleon-negative` (gray, defined)

---

## G. Verification Commands

After each change:
```bash
make test           # 140 tests must pass
make smoke-tango    # TANGO smoke test
npm --prefix ui run build  # Frontend builds
```

After S4PRED implementation:
```bash
make smoke-s4pred   # New smoke test (to be created)
```

---

## H. Execution Order

1. ✅ Fix sswPrediction null bug (DONE)
2. ✅ Fix PeptideTable null crashes (DONE)
3. ✅ Fix Metrics page denominator logic (DONE)
4. ✅ Fix pie chart colors (DONE)
5. ✅ Copy S4PRED directory from reference (DONE)
6. ✅ Implement `backend/s4pred.py` (DONE)
7. ✅ Add S4PRED fields to PeptideRow (DONE)
8. ✅ Add S4PRED to upload pipeline (DONE 2026-02-02)
9. ✅ Implement PeptideDetail S4PRED curves (DONE 2026-02-02)
10. ✅ UI: Results table S4PRED columns (DONE 2026-02-02)
11. ✅ UI: Detail view probability plots (DONE 2026-02-02)

### Implementation Notes (2026-02-02):
- Aligned S4PRED implementation EXACTLY with reference `260120_Alpha_and_SSW_FF_Predictor/`:
  - `_get_secondary_structure_segments()` matches reference gap tracking + mean/median validation
  - `_calc_average_score()` calculates mean of segment means (not mean of all residues)
  - `_calc_ssw_score_and_diff()` uses SUM (not average): `ssw_score = beta_score + helix_score`
  - `_find_ssw_segments()` matches reference pointer-based merging algorithm
  - Replicated reference parameter swap in SSW fragment detection (line 197-198)
- Added `S4PredBadge` component for consistent SSW badge display
- Added S4PRED SSW and S4PRED Helix % columns to Results table
- CSV export includes S4PRED columns

---

## I. Reference Files Location

```
/Users/saidazaizah/Desktop/desy_internship/260120_Alpha_and_SSW_FF_Predictor/
├── S4PRED/
│   ├── network.py      # GRU model architecture
│   ├── run_model.py    # Entry point for predictions
│   └── utilities.py    # Helper functions
├── s4pred.py           # Database-level runner
├── tango.py            # TANGO runner
├── auxiliary.py        # Segment detection, scoring
├── biochemCalculation.py  # Hydrophobicity, charge
└── config.py           # Thresholds and settings
```

---

## J. Contract Changes Required

If S4PRED is added, update:
1. `backend/schemas/api_models.py` — Add S4PRED fields to PeptideRow
2. `ui/src/types/peptide.ts` — Mirror backend changes
3. `backend/scripts/check_contract_sync.py` — Update CONTRACT_FIELDS set
4. Run `make contract-check` to verify sync
