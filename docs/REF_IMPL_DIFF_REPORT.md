# Reference Implementation vs PVL Diff Report

**Date:** 2026-02-01
**Reference:** `260120_Alpha_and_SSW_FF_Predictor`
**Target:** Peptide Visual Lab (PVL)

---

## Summary

| Aspect | Reference | PVL | Status |
|--------|-----------|-----|--------|
| TANGO integration | Full subprocess | Subprocess | ✅ Similar |
| S4PRED integration | Full subprocess | Not integrated | ❌ Missing |
| SSW algorithm | `auxiliary.py` | `auxiliary.py` | ⚠️ Needs validation |
| Biochem calculations | `biochemCalculation.py` | `calculations/biochem.py` | ⚠️ Needs validation |
| Sentinel values | `-1` for missing | `null` for missing | ⚠️ Mapping needed |
| Threshold config | Hardcoded in `config.py` | Dynamic via API | ✅ Enhanced |

---

## 1. TANGO Integration

### Reference Implementation

```python
# tango.py
def create_tango_input(db, filepath):
    with open(filepath, 'w') as f:
        for entry, seq in db.items():
            f.write(f"{entry}\t{seq}\n")

def run_tango(config, input_file):
    subprocess.run([
        "tango", input_file,
        f"-ph={config.TANGO_PH}",
        f"-temp={config.TANGO_TEMP}",
        f"-ionic={config.TANGO_IONIC}"
    ])
```

### PVL Implementation (`backend/tango.py`)

```python
def run_tango_for_sequences(sequences: list, ...):
    # Similar subprocess approach
    # Creates temp input, runs TANGO, parses output
```

### Differences

| Aspect | Reference | PVL | Action |
|--------|-----------|-----|--------|
| Input format | `entry\tsequence` | Same | ✅ OK |
| Parameters | `ph=7, temp=298, ionic=0.1` | Same | ✅ OK |
| Output parsing | Per-entry .txt files | Same | ✅ OK |
| SSW calculation | In `auxiliary.py` | In `auxiliary.py` | ⚠️ Validate algorithm |
| Error handling | Basic | More robust | ✅ OK |

**Verdict:** TANGO integration is **largely aligned**. Validate SSW algorithm matches reference.

---

## 2. S4PRED Integration

### Reference Implementation

```python
# s4pred.py
def run_s4pred_database(db, config):
    # Create FASTA input
    fasta_path = write_fasta(db)

    # Run neural network
    subprocess.run([
        "python", "run_model.py",
        "-f", fasta_path,
        "-o", config.S4PRED_OUTPUT_DIR
    ])

def analyse_s4pred_database(db, config):
    for entry in db:
        ss2_file = f"{config.S4PRED_OUTPUT_DIR}/{entry}.ss2"
        helix_scores, beta_scores = parse_ss2(ss2_file)
        # ... compute SSW and helix%
```

### PVL Implementation

**Not integrated.** PVL uses PSIPRED instead of S4PRED.

### Differences

| Aspect | Reference | PVL | Action |
|--------|-----------|-----|--------|
| Secondary structure | S4PRED | PSIPRED | Different tool |
| Output format | `.ss2` | PSIPRED format | Different parsing |
| Helix % calculation | From S4PRED | From PSIPRED | ⚠️ Validate formula |

**Verdict:** S4PRED integration is **not applicable** unless user wants to add it alongside PSIPRED.

---

## 3. SSW Algorithm (`auxiliary.py`)

### Reference Implementation

```python
def get_secondary_structure_segments(scores, threshold=0.5, min_len=5, max_gap=3):
    segments = []
    in_segment = False
    start = 0
    for i, score in enumerate(scores):
        if score >= threshold:
            if not in_segment:
                start = i
                in_segment = True
        else:
            if in_segment:
                if i - start >= min_len:
                    segments.append((start, i - 1))
                in_segment = False
    # Handle last segment
    if in_segment and len(scores) - start >= min_len:
        segments.append((start, len(scores) - 1))

    # Merge segments within max_gap
    return merge_segments(segments, max_gap)

def find_secondary_structure_switch_segments(helix_segs, beta_segs):
    overlaps = []
    for h in helix_segs:
        for b in beta_segs:
            if ranges_overlap(h, b):
                overlaps.append(merge_range(h, b))
    return overlaps
```

### PVL Implementation (`backend/auxiliary.py`)

Need to validate:
1. Same threshold default (0.5)?
2. Same min segment length (5)?
3. Same max gap for merging (3)?
4. Same overlap detection logic?

### Action Items

- [ ] Read PVL `auxiliary.py` and compare line-by-line
- [ ] Verify threshold/length/gap parameters match
- [ ] Add unit tests for SSW edge cases

---

## 4. Biochemical Calculations

### Reference (`biochemCalculation.py`)

```python
# Hydrophobic moment - Eisenberg 1982
def hydrophobic_moment(sequence, angle=100):
    h_scale = {...}  # Eisenberg consensus
    sin_sum = sum(h_scale[aa] * sin(radians(i * angle)) for i, aa in enumerate(seq))
    cos_sum = sum(h_scale[aa] * cos(radians(i * angle)) for i, aa in enumerate(seq))
    return sqrt(sin_sum**2 + cos_sum**2) / len(seq)

# Charge at pH 7.4
def total_charge(sequence):
    charge = {
        'K': 1, 'R': 1, 'H': 0.1,  # Positive
        'D': -1, 'E': -1,           # Negative
    }
    return sum(charge.get(aa, 0) for aa in sequence)

# Hydrophobicity - Fauchere-Pliska
def hydrophobicity(sequence):
    fp_scale = {...}
    return sum(fp_scale[aa] for aa in sequence) / len(sequence)
```

### PVL (`backend/calculations/biochem.py`)

Need to validate:
1. Same hydrophobicity scale (Fauchere-Pliska)?
2. Same μH angle (100°)?
3. Same charge calculation (pH 7.4, H=0.1)?

### Action Items

- [ ] Compare hydrophobicity scales
- [ ] Verify μH formula matches Eisenberg 1982
- [ ] Verify charge includes H = 0.1

---

## 5. Sentinel Value Handling

### Reference Approach

```python
# Missing prediction = -1
SSW_PREDICTION = -1  # Not available
SSW_SCORE = -1       # Not available

# Valid prediction
SSW_PREDICTION = 0   # No switch
SSW_PREDICTION = 1   # Switch found
```

### PVL Approach (Null Semantics)

```python
# Missing prediction = null
sswPrediction = None  # Not available (becomes null in JSON)

# Valid prediction
sswPrediction = -1    # No switch predicted (VALID VALUE)
sswPrediction = 0     # Ambiguous
sswPrediction = 1     # Switch found
```

### Conflict

| Value | Reference Meaning | PVL Meaning |
|-------|-------------------|-------------|
| `-1` | Not available | No switch predicted |
| `null` | N/A | Not available |
| `0` | No switch | No switch |
| `1` | Switch found | Switch found |

### Resolution

PVL interpretation is correct per ISSUE-000 (null semantics):
- `sswPrediction = null` → provider didn't run or failed
- `sswPrediction = -1` → TANGO ran, no switch predicted
- `sswPrediction = 0` → Not used (ambiguous)
- `sswPrediction = 1` → TANGO ran, switch found

**Action:** When integrating reference code, map:
- Reference `-1` (not available) → PVL `null`
- Reference `0` (no switch) → PVL `-1`
- Reference `1` (switch) → PVL `1`

---

## 6. Threshold Configuration

### Reference (Hardcoded)

```python
# config.py
MIN_SEGMENT_LENGTH = 5
MAX_GAP = 3
MIN_S4PRED_SCORE = 0.5
MAXIMAL_PEPTIDE_LENGTH = 40
```

### PVL (Dynamic)

```python
# API accepts ThresholdConfig
class ThresholdConfig(BaseModel):
    mode: str  # 'default' | 'recommended' | 'custom'
    muHCutoff: float
    hydroCutoff: float
    ffHelixPercentThreshold: float
```

### Gap Analysis

| Threshold | Reference | PVL | Notes |
|-----------|-----------|-----|-------|
| Segment length | 5 | Not exposed | Add to config? |
| Gap merge | 3 | Not exposed | Add to config? |
| SS score | 0.5 | Not exposed | Add to config? |
| Max peptide length | 40 | None | Consider adding |
| μH cutoff | N/A | Configurable | ✅ |
| H cutoff | N/A | Configurable | ✅ |
| FF-Helix % | N/A | Configurable | ✅ |

**Recommendation:** Consider exposing `minSegmentLength`, `maxGap`, `ssScoreThreshold` in advanced threshold config.

---

## 7. Sequence Preprocessing

### Reference

```python
def get_corrected_sequence(sequence):
    corrections = {'X': 'A', 'Z': 'E', 'B': 'D', 'U': 'C'}
    return ''.join(corrections.get(aa, aa) for aa in sequence.upper())
```

### PVL

Check if similar preprocessing exists in:
- `backend/services/normalize.py`
- `backend/auxiliary.py`

**Action:** Verify PVL handles non-standard amino acids (X, Z, B, U).

---

## Summary of Actions

### Critical (Must Fix)

1. **Validate SSW algorithm** - Compare PVL `auxiliary.py` with reference
2. **Validate biochem formulas** - Ensure μH, charge, H scales match
3. **Sentinel value mapping** - Document and enforce null semantics

### Important (Should Fix)

4. **Add sequence preprocessing** - Handle X, Z, B, U amino acids
5. **Expose segment thresholds** - Add to advanced config if needed

### Nice to Have

6. **S4PRED integration** - Only if PSIPRED is insufficient
7. **Max peptide length** - Consider adding validation

---

## File Mapping

| Reference File | PVL Equivalent | Status |
|---------------|----------------|--------|
| `main.py` | `server.py` + services | Different architecture |
| `tango.py` | `backend/tango.py` | ⚠️ Validate |
| `s4pred.py` | N/A (uses PSIPRED) | Not applicable |
| `config.py` | `backend/config.py` + API | Enhanced |
| `auxiliary.py` | `backend/auxiliary.py` | ⚠️ Validate |
| `biochemCalculation.py` | `backend/calculations/biochem.py` | ⚠️ Validate |
