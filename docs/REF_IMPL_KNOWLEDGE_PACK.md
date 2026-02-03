# Reference Implementation Knowledge Pack

**Source:** `/Users/saidazaizah/Desktop/desy_internship/260120_Alpha_and_SSW_FF_Predictor`
**Date:** 2026-02-01
**Purpose:** Document TANGO + S4PRED integration logic for PVL adoption

---

## 1. Execution Flow

### Main Entry Point (`main.py`)

```
1. create_database(db, config)           # Load sequences from FASTA
2. run_and_analyse_tango(db, config)     # TANGO → SSW predictions
3. run_and_analyse_s4pred(db, config)    # S4PRED → helix predictions
4. calculate_biochemical_features(db)    # Charge, H, μH
5. Export to CSV
```

### TANGO Flow (`tango.py`)

```
create_tango_input(db, filepath)
    → Writes: entry\tsequence\n for each peptide

run_tango(config, input_file)
    → Subprocess: tango {input} -ph=7 -temp=298 -ionic=0.1
    → Creates: {entry}.txt per peptide in output dir

process_tango_output(db, config)
    → For each {entry}.txt:
        1. Parse columns: res, AA, Helix, Beta, Turn, Aggregation
        2. get_secondary_structure_segments(helix_scores, threshold=0.5, min_len=5, max_gap=3)
        3. get_secondary_structure_segments(beta_scores, threshold=0.5, min_len=5, max_gap=3)
        4. find_secondary_structure_switch_segments(helix_ranges, beta_ranges)
        5. calc_secondary_structure_switch_difference_and_score(ssw_ranges, helix, beta)
    → Returns: SSW_PREDICTION (-1/0/1), SSW_SCORE, SSW_DIFF
```

### S4PRED Flow (`s4pred.py`)

```
run_s4pred_database(db, config)
    → Creates FASTA: >{entry}\n{sequence}\n per peptide
    → Subprocess: python run_model.py -f {fasta} -o {output_dir}
    → Creates: {entry}.ss2 per peptide

analyse_s4pred_database(db, config)
    → For each {entry}.ss2:
        1. Parse columns: pos, AA, SS, P_C, P_H, P_E
        2. get_secondary_structure_segments(P_H, threshold=0.5, min_len=5, max_gap=3)
        3. get_secondary_structure_segments(P_E, threshold=0.5, min_len=5, max_gap=3)
        4. find_secondary_structure_switch_segments(helix_ranges, beta_ranges)
        5. helix_percent = len(helix_residues) / sequence_length * 100
    → Returns: SSW_PREDICTION, HELIX_PERCENT
```

---

## 2. Function Signatures & IO Shapes

### Core SSW Functions (`auxiliary.py`)

```python
def get_secondary_structure_segments(
    scores: List[float],
    threshold: float = 0.5,
    min_segment_length: int = 5,
    max_gap: int = 3
) -> List[Tuple[int, int]]:
    """
    Find contiguous segments where score >= threshold.
    Merges segments separated by <= max_gap residues.
    Returns: [(start, end), ...] 0-indexed, inclusive
    """

def find_secondary_structure_switch_segments(
    helix_segments: List[Tuple[int, int]],
    beta_segments: List[Tuple[int, int]]
) -> List[Tuple[int, int]]:
    """
    Find ranges where helix and beta segments overlap.
    Returns: [(start, end), ...] of overlapping regions
    """

def calc_secondary_structure_switch_difference_and_score(
    ssw_segments: List[Tuple[int, int]],
    helix_scores: List[float],
    beta_scores: List[float]
) -> Tuple[float, float]:
    """
    For each SSW segment, compute:
      - max_diff = max(|helix - beta|) across segment
      - score = sum of (helix + beta) / 2 across segment
    Returns: (ssw_diff, ssw_score)
    """

def get_corrected_sequence(sequence: str) -> str:
    """
    Replace non-standard amino acids:
      X → A, Z → E, B → D, U → C
    """
```

### Biochemical Functions (`biochemCalculation.py`)

```python
def hydrophobic_moment(sequence: str, angle: int = 100) -> float:
    """
    Eisenberg 1982 formula:
      μH = sqrt(sum_i(H_i * sin(i*angle))^2 + sum_i(H_i * cos(i*angle))^2) / N
    Uses Eisenberg consensus scale.
    """

def total_charge(sequence: str) -> float:
    """
    Net charge at pH 7.4:
      K, R → +1
      D, E → -1
      H → +0.1 (partially protonated)
    """

def hydrophobicity(sequence: str) -> float:
    """
    Average Fauchere-Pliska hydrophobicity per residue.
    """
```

---

## 3. Parameter Defaults & Thresholds (`config.py`)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MIN_SEGMENT_LENGTH` | 5 | Minimum residues for valid helix/beta segment |
| `MAX_GAP` | 3 | Max gap to merge adjacent segments |
| `MIN_S4PRED_SCORE` | 0.5 | Threshold for secondary structure confidence |
| `MAXIMAL_PEPTIDE_LENGTH` | 40 | Skip peptides longer than this |
| `TANGO_PH` | 7 | pH for TANGO simulation |
| `TANGO_TEMP` | 298 | Temperature (Kelvin) for TANGO |
| `TANGO_IONIC` | 0.1 | Ionic strength for TANGO |

---

## 4. Binary/Model Locations

### TANGO
- **Binary:** Expects `tango` in PATH or configured path
- **Input:** Tab-separated file: `entry\tsequence\n`
- **Output:** Creates `{entry}.txt` with per-residue scores in output directory

### S4PRED
- **Script:** `run_model.py` (Python, uses trained neural network)
- **Input:** Standard FASTA format
- **Output:** Creates `{entry}.ss2` files:
  ```
  # S4PRED output
  pos  AA  SS  P_C  P_H  P_E
  1    M   C   0.85 0.10 0.05
  2    R   H   0.15 0.80 0.05
  ...
  ```

---

## 5. Output Structures

### Per-Peptide Columns Produced

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `SSW_PREDICTION_TANGO` | int | TANGO | -1=not predicted, 0=no switch, 1=switch found |
| `SSW_SCORE_TANGO` | float | TANGO | SSW strength score (0 if no switch) |
| `SSW_DIFF_TANGO` | float | TANGO | Max helix-beta difference in SSW region |
| `SSW_PREDICTION_S4PRED` | int | S4PRED | -1=not predicted, 0=no switch, 1=switch found |
| `HELIX_PERCENT` | float | S4PRED | % residues in helix regions |

### Sentinel Values

| Value | Meaning |
|-------|---------|
| `-1` (int) | Prediction not available / provider failed |
| `0` (int) | No secondary structure switch detected |
| `1` (int) | Secondary structure switch detected |

---

## 6. Non-Negotiable Correctness Requirements

1. **Segment Detection Algorithm**
   - Must use threshold ≥ 0.5 for secondary structure confidence
   - Must enforce min segment length of 5 residues
   - Must merge segments separated by ≤ 3 residues

2. **SSW Definition**
   - SSW exists IFF helix segment overlaps with beta segment
   - Overlap = any shared residue positions between ranges

3. **Sequence Preprocessing**
   - Non-standard AAs must be substituted: X→A, Z→E, B→D, U→C
   - Sequence must be uppercase

4. **μH Calculation**
   - Must use angle = 100° (ideal helix)
   - Must use Eisenberg consensus hydrophobicity scale
   - Formula: `sqrt(sin_sum² + cos_sum²) / N`

5. **Charge Calculation**
   - Must use pH 7.4 assumptions
   - Histidine = +0.1 (not +1)

---

## 7. Performance Considerations

1. **Batch Processing**
   - TANGO: Creates one file per peptide → many small files
   - S4PRED: Single FASTA → parallel processing internally

2. **Timeout Risks**
   - TANGO: ~1-2 sec per short peptide, scales with length
   - S4PRED: Neural network, faster but needs GPU for large batches

3. **Memory**
   - Both tools load models into memory
   - S4PRED particularly heavy if running on CPU

---

## 8. What to Ignore (Not Relevant to PVL)

1. **Database persistence logic** - PVL uses in-memory DataFrame
2. **Aggregation scores from TANGO** - PVL focuses on SSW, not aggregation propensity
3. **Turn predictions** - Not used in SSW calculation
4. **File-based result caching** - PVL uses API responses
5. **Batch job scheduling** - PVL is on-demand API

---

## Key Takeaways for PVL Integration

1. **TANGO integration** requires:
   - Creating temp input file
   - Running subprocess with correct parameters
   - Parsing per-residue output files
   - Computing SSW from helix/beta segments

2. **S4PRED integration** (if desired) requires:
   - Creating FASTA input
   - Running neural network model
   - Parsing .ss2 output format
   - Computing helix% and SSW

3. **Shared algorithms** (already in PVL `auxiliary.py`):
   - `get_secondary_structure_segments()` ← needs validation
   - `find_secondary_structure_switch_segments()` ← needs validation
   - Biochem calculations ← already implemented

4. **Sentinel values**:
   - Reference uses `-1` for "not available"
   - PVL uses `null` for missing (except sswPrediction where -1 = valid "no switch predicted")
   - **Mapping needed**: Reference -1 → PVL null (when appropriate)
