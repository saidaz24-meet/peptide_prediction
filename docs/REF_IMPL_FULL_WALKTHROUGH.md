# Reference Implementation Full Walkthrough

**Date:** 2026-02-02
**Purpose:** Document the end-to-end execution flow of the reference implementation (`260120_Alpha_and_SSW_FF_Predictor`) as the canonical source of truth for correctness validation.

---

## 1. Entry Point: `main.py`

The reference implementation has a single entry point that orchestrates the entire pipeline.

### 1.1 High-Level Flow

```python
# main.py execution order:
1. create_database(file_path)           # Parse input CSV
2. run_and_analyse_tango(database)      # TANGO binary execution + SSW analysis
3. run_and_analyse_s4pred(database)     # S4PRED neural network + SSW analysis
4. calculate_biochemical_features(db)   # μH, charge, hydrophobicity
5. fibril_formation_prediction(db)      # FF flags based on thresholds
6. calc_ssw_prediction_by_database_avg_value(db, column)  # SSW prediction
7. database.to_excel(output_path)       # Write results
```

### 1.2 Input Requirements

```python
# Expected CSV columns (config.py):
KEY = 'Entry'           # Peptide identifier
SEQUENCE = 'Sequence'   # Amino acid sequence
LENGTH = 'Length'       # Optional, computed if missing
```

---

## 2. TANGO Execution: `tango.py`

### 2.1 Input File Creation

```python
def create_tango_input(database: DataFrame, path: str) -> None:
    """
    Creates a .bat/.csh file that calls TANGO binary for each peptide.

    Format (fmt2): One line per peptide
    <entry>\t<sequence>

    Each line becomes a TANGO command:
    tango <entry> nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="<seq>"
    """
```

**TANGO Parameters (HARDCODED):**
| Parameter | Value | Meaning |
|-----------|-------|---------|
| `nt` | "N" | N-terminus: not acetylated |
| `ct` | "N" | C-terminus: not amidated |
| `ph` | "7" | pH 7.0 |
| `te` | "298" | Temperature 298K (25°C) |
| `io` | "0.1" | Ionic strength 0.1M |
| `tf` | "0" | TFE concentration 0% |

### 2.2 TANGO Binary Execution

```python
def run_tango(input_path: str, output_path: str) -> None:
    """
    Runs TANGO binary via subprocess.

    Creates per-peptide .txt output files in output_path directory.
    Each file named: <entry>.txt
    """
    subprocess.call(f"cd {input_path} && ./tango.bat", shell=True)
```

### 2.3 Output Parsing

```python
def process_tango_output(database: DataFrame, output_path: str) -> DataFrame:
    """
    Parses per-peptide .txt files from TANGO.

    TANGO output format (whitespace-separated, first row is header):
    res AA  Beta    Helix   Turn    Aggregation
    1   A   0.000   0.000   0.000   0.000
    2   K   0.123   0.456   0.000   0.000
    ...

    Extracts columns:
    - Beta: beta-sheet propensity per residue
    - Helix: alpha-helix propensity per residue
    - Turn: turn propensity per residue
    - Aggregation: aggregation propensity per residue
    """
    for entry in database[KEY]:
        file_path = f"{output_path}/{entry}.txt"
        if os.path.exists(file_path):
            # Parse file and extract curves
            beta_curve, helix_curve, turn_curve, agg_curve = parse_tango_file(file_path)

            # Analyze SSW
            analysis = __analyse_tango_results(beta_curve, helix_curve, sequence)

            # Add to database
            database.loc[database[KEY] == entry, 'Beta curve'] = beta_curve
            database.loc[database[KEY] == entry, 'Helix curve'] = helix_curve
            # ... etc
```

### 2.4 SSW Analysis (`__analyse_tango_results`)

```python
def __analyse_tango_results(beta: list, helix: list, sequence: str) -> dict:
    """
    Analyzes TANGO output to detect Secondary Structure Switch (SSW) regions.

    RETURNS DEFAULT VALUES WHEN NO SSW DETECTED:
    {
        SSW_FRAGMENTS_TANGO: [],          # Empty list
        SSW_SCORE_TANGO: -1,              # SENTINEL: -1 means "no data"
        SSW_DIFF_TANGO: -1,               # SENTINEL: -1 means "no data"
        SSW_HELIX_PERCENTAGE_TANGO: 0,    # SENTINEL: 0 means "no data"
        SSW_BETA_PERCENTAGE_TANGO: 0,     # SENTINEL: 0 means "no data"
        SSW_PERCENTAGE_TANGO: 0           # SENTINEL: 0 means "no data"
    }

    Steps:
    1. get_secondary_structure_segments(helix, MIN_TANGO_SCORE) → helix_segments
    2. get_secondary_structure_segments(beta, MIN_TANGO_SCORE) → beta_segments
    3. find_secondary_structure_switch_segments(beta_segments, helix_segments) → ssw_segments
    4. If ssw_segments is empty → return defaults
    5. calc_secondary_structure_switch_difference_and_score() → (score, diff)
    6. get_avg_uH_by_segments() → μH for SSW regions
    7. Return full analysis dict
    """
```

---

## 3. S4PRED Execution: `s4pred.py`

### 3.1 Neural Network Architecture

```python
# S4PRED/network.py
class S4PRED(nn.Module):
    """
    Ensemble of 5 AWD-GRU models.

    Architecture per model:
    - Input: One-hot encoded amino acid sequence
    - Hidden: 512-unit bidirectional GRU
    - Output: 3 classes (Coil, Helix, Sheet)

    Ensemble averaging:
    y_out = y_1*0.2 + y_2*0.2 + y_3*0.2 + y_4*0.2 + y_5*0.2
    """
    def __init__(self):
        self.gru_1 = GRUnet(21, 512, 3, 2, 0.5)
        self.gru_2 = GRUnet(21, 512, 3, 2, 0.5)
        self.gru_3 = GRUnet(21, 512, 3, 2, 0.5)
        self.gru_4 = GRUnet(21, 512, 3, 2, 0.5)
        self.gru_5 = GRUnet(21, 512, 3, 2, 0.5)

    def forward(self, x):
        # Equal weighting of 5 models
        return (y_1 + y_2 + y_3 + y_4 + y_5) * 0.2
```

### 3.2 Input/Output Format

```python
# Input: FASTA file with sequences
>entry1
MKVLWAALLVTFLAGCQAKVEQ...

# Output: .ss2 file per sequence
# Index  AA  SS  P_C    P_H    P_E
  1      M   C   0.823  0.102  0.075
  2      K   C   0.756  0.089  0.155
  ...
```

### 3.3 S4PRED SSW Analysis

```python
def process_s4pred_output(database: DataFrame, output_path: str) -> DataFrame:
    """
    Parses S4PRED .ss2 files and performs SSW analysis.

    Uses config.MIN_S4PRED_SCORE = 0.5 as threshold.

    Steps:
    1. Parse .ss2 file → P_H (helix prob), P_E (sheet prob), P_C (coil prob)
    2. get_secondary_structure_segments(P_H, MIN_S4PRED_SCORE) → helix_segments
    3. get_secondary_structure_segments(P_E, MIN_S4PRED_SCORE) → beta_segments
    4. find_secondary_structure_switch_segments() → ssw_segments
    5. calc_secondary_structure_switch_difference_and_score() → (score, diff)
    """
```

---

## 4. SSW Algorithm: `auxiliary.py`

### 4.1 Segment Detection

```python
def get_secondary_structure_segments(prediction: list, min_score: int) -> list:
    """
    Finds contiguous segments of secondary structure above threshold.

    THRESHOLDS (from config.py):
    - MIN_SEGMENT_LENGTH = 5     # Minimum segment length
    - MAX_GAP = 3                # Maximum gap to bridge
    - MIN_TANGO_SCORE = 0        # Threshold for TANGO
    - MIN_JPRED_SCORE = 7        # Threshold for JPred
    - MIN_S4PRED_SCORE = 0.5     # Threshold for S4PRED

    Algorithm:
    1. Scan for regions where prediction[i] > 0
    2. Bridge gaps up to MAX_GAP (3 residues)
    3. Reject segments shorter than MIN_SEGMENT_LENGTH (5)
    4. Validate: mean(segment) >= min_score OR median(segment) >= min_score

    Returns: List of (start, end) tuples (0-indexed, inclusive)
    """
    segments = []
    i = 0
    while i < len(prediction):
        if prediction[i] > 0:
            start = i
            gap = 0
            i += 1
            while i < len(prediction) and gap <= MAX_GAP:
                if prediction[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1
            end = i - 1 - gap
            segment_length = end - start + 1

            # Validation: length AND (mean OR median) threshold
            good_segment = (
                segment_length >= MIN_SEGMENT_LENGTH and
                (mean(prediction[start:end]) >= min_score or
                 median(prediction[start:end]) >= min_score)
            )
            if good_segment:
                segments.append((start, end))
        i += 1
    return segments
```

### 4.2 SSW Overlap Detection

```python
def find_secondary_structure_switch_segments(
    beta_segments: list,
    helix_segments: list
) -> list:
    """
    Finds overlapping regions between helix and beta segments.

    This is the core SSW detection: regions where both helix AND beta
    propensity are above threshold are potential structural switch regions.

    Algorithm:
    1. Sort both segment lists by start position
    2. Walk through segments in parallel
    3. For each pair, compute overlap region
    4. If overlap exists, add to SSW list

    Returns: List of (start, end) tuples for SSW regions
    """
    ssw_segments = []
    i, j = 0, 0

    while i < len(beta_segments) and j < len(helix_segments):
        beta_start, beta_end = beta_segments[i]
        helix_start, helix_end = helix_segments[j]

        # Compute overlap
        overlap_start = max(beta_start, helix_start)
        overlap_end = min(beta_end, helix_end)

        if overlap_start <= overlap_end:
            ssw_segments.append((overlap_start, overlap_end))

        # Advance the segment that ends first
        if beta_end < helix_end:
            i += 1
        else:
            j += 1

    return ssw_segments
```

### 4.3 SSW Score and Diff Calculation

```python
def calc_secondary_structure_switch_difference_and_score(
    beta_prediction: list,
    helix_prediction: list,
    ssw_indexes: list
) -> tuple:
    """
    Calculates SSW score and difference for given SSW regions.

    CRITICAL: Returns (-1, -1) when no SSW segments exist!
    This is a SENTINEL value meaning "no data available".

    For each SSW segment:
    - beta_score = mean(beta_prediction[start:end+1])
    - helix_score = mean(helix_prediction[start:end+1])

    Final calculation (averaged across segments):
    - ssw_score = beta_score_avg + helix_score_avg
    - ssw_diff = |beta_score_avg - helix_score_avg|

    Returns: (ssw_score, ssw_diff) or (-1, -1) if empty
    """
    if len(ssw_indexes) == 0:
        return -1, -1  # SENTINEL: no data

    beta_score = __calc_average_score(beta_prediction, ssw_indexes)
    helix_score = __calc_average_score(helix_prediction, ssw_indexes)

    ssw_score = beta_score + helix_score
    ssw_diff = abs(beta_score - helix_score)

    return ssw_score, ssw_diff
```

### 4.4 μH Calculation for Segments

```python
def get_avg_uH_by_segments(sequence: str, secondary_structure_idx: list) -> float:
    """
    Calculates average hydrophobic moment for SSW segments.

    CRITICAL: Returns -1 when no segments exist!

    IMPORTANT: Uses SIMPLE MEAN (not weighted by segment length):

        result = mean([μH(segment1), μH(segment2), ...])

    For each segment:
    1. Extract subsequence: sequence[start:end+1]
    2. Calculate μH using Eisenberg formula
    3. Average all segment μH values

    Returns: Average μH or -1 if no segments
    """
    if len(secondary_structure_idx) == 0:
        return -1  # SENTINEL: no data

    segments_uH = []
    for start, end in secondary_structure_idx:
        sub_seq = sequence[start:(end + 1)]
        uH = biochemCalculation.hydrophobic_moment(sub_seq)
        segments_uH.append(uH)

    return mean(segments_uH)  # SIMPLE MEAN (not weighted!)
```

### 4.5 SSW Prediction by Database Average

```python
def calc_ssw_prediction_by_database_avg_value(
    database: DataFrame,
    diff_column: str
) -> list:
    """
    Calculates SSW prediction for each peptide based on dataset average.

    ALGORITHM:
    1. Filter out rows where diff == -1 (sentinel for no data)
    2. Calculate average diff across valid rows
    3. For each row:
       - If diff >= avg_diff: prediction = -1 (NOT SSW candidate)
       - If diff < avg_diff: prediction = 1 (SSW candidate)

    CRITICAL THRESHOLD LOGIC:
    - diff >= avg → -1 (NOT a structural switch)
    - diff < avg → 1 (IS a structural switch)

    Note: diff == avg is treated as NOT a switch (boundary case)
    """
    # Filter out sentinel values
    valid_rows = database[database[diff_column] != -1]
    avg_diff = valid_rows[diff_column].mean()

    ssw_predictions = []
    for _, row in database.iterrows():
        if row[diff_column] >= avg_diff:
            ssw_predictions.append(-1)  # NOT SSW candidate
        else:
            ssw_predictions.append(1)   # SSW candidate

    return ssw_predictions
```

---

## 5. Biochemical Calculations: `biochemCalculation.py`

### 5.1 Hydrophobicity Scale

```python
# Fauchere-Pliska hydrophobicity scale
Fauchere_Pliska = {
    'A': 0.31, 'R': -1.01, 'N': -0.60, 'D': -0.77, 'C': 1.54,
    'Q': -0.22, 'E': -0.64, 'G': 0.00, 'H': 0.13, 'I': 1.80,
    'L': 1.70, 'K': -0.99, 'M': 1.23, 'F': 1.79, 'P': 0.72,
    'S': -0.04, 'T': 0.26, 'W': 2.25, 'Y': 0.96, 'V': 1.22
}
```

### 5.2 Hydrophobic Moment (μH)

```python
def hydrophobic_moment(sequence: str, angle: int = 100) -> float:
    """
    Calculates hydrophobic moment using Eisenberg 1982 formula.

    Formula:
    μH = (1/N) * sqrt(
        (Σ H_i * sin(i * θ))² +
        (Σ H_i * cos(i * θ))²
    )

    Where:
    - θ = angle in degrees (default 100° for ideal α-helix)
    - H_i = hydrophobicity of residue i (Fauchere-Pliska scale)
    - N = sequence length

    Returns: μH value (higher = more amphipathic)
    """
    angle_rad = math.radians(angle)
    sin_sum = 0.0
    cos_sum = 0.0

    for i, aa in enumerate(sequence):
        H = Fauchere_Pliska.get(aa, 0.0)
        sin_sum += H * math.sin((i + 1) * angle_rad)
        cos_sum += H * math.cos((i + 1) * angle_rad)

    moment = math.sqrt(sin_sum**2 + cos_sum**2)
    return moment / len(sequence)  # Normalized by length
```

### 5.3 Charge Calculation

```python
def total_charge(sequence: str) -> float:
    """
    Calculates net charge at pH 7.0.

    CHARGE VALUES:
    - K (Lysine): +1
    - R (Arginine): +1
    - D (Aspartate): -1
    - E (Glutamate): -1

    NOTE: Reference implementation does NOT include H (Histidine)!
    (Some sources give H = +0.1 at pH 7.4, but reference omits it)
    """
    aa_charge = {'E': -1, 'D': -1, 'K': 1, 'R': 1}

    return sum(aa_charge.get(aa, 0) for aa in sequence)
```

### 5.4 Average Hydrophobicity

```python
def hydrophobicity(sequence: str) -> float:
    """
    Calculates average hydrophobicity.

    Formula:
    H_avg = (1/N) * Σ H_i

    Where H_i is from Fauchere-Pliska scale.
    """
    total = sum(Fauchere_Pliska.get(aa, 0.0) for aa in sequence)
    return total / len(sequence)
```

---

## 6. Sequence Preprocessing: `auxiliary.py`

```python
def get_corrected_sequence(sequence: str) -> str:
    """
    Corrects non-standard amino acid codes.

    MAPPING:
    - X → A (unknown → alanine)
    - Z → E (glutamate/glutamine ambiguous → glutamate)
    - U → C (selenocysteine → cysteine)
    - B → D (aspartate/asparagine ambiguous → aspartate)
    - '-' in sequence → split and take first part

    All output is uppercase.
    """
    s = sequence.upper()
    s = s.replace('X', 'A')
    s = s.replace('Z', 'E')
    s = s.replace('U', 'C')
    s = s.replace('B', 'D')
    if '-' in s:
        s = s.split('-')[0]
    return s
```

---

## 7. Output Columns

The reference implementation outputs these columns:

| Column Name | Source | Description |
|-------------|--------|-------------|
| Entry | Input | Peptide identifier |
| Sequence | Input | Amino acid sequence |
| Length | Computed | Sequence length |
| Hydrophobicity | biochemCalculation | Average hydrophobicity |
| Charge | biochemCalculation | Net charge at pH 7.0 |
| Full length uH | biochemCalculation | Full sequence μH |
| SSW fragments (Tango) | tango.py | SSW region coordinates |
| SSW score (Tango) | tango.py | SSW score (-1 if no SSW) |
| SSW diff (Tango) | tango.py | SSW diff (-1 if no SSW) |
| SSW helix % (Tango) | tango.py | Helix content % in SSW (0 if no SSW) |
| SSW beta % (Tango) | tango.py | Beta content % in SSW (0 if no SSW) |
| SSW prediction (Tango) | auxiliary | -1 or 1 based on dataset avg |
| Helix curve (Tango) | tango.py | Per-residue helix propensity |
| Beta curve (Tango) | tango.py | Per-residue beta propensity |
| S4PRED P_H | s4pred.py | Per-residue helix probability |
| S4PRED P_E | s4pred.py | Per-residue sheet probability |
| SSW fragments (S4PRED) | s4pred.py | SSW region coordinates |
| SSW score (S4PRED) | s4pred.py | SSW score |
| SSW diff (S4PRED) | s4pred.py | SSW diff |
| FF-Helix flag | auxiliary | Fibril formation flag (1 or -1) |
| FF-SSW flag | auxiliary | SSW fibril formation flag (1 or -1) |

---

## 8. Key Invariants

1. **Entry ID Alignment**: All operations preserve Entry ID as the join key
2. **Sentinel Values**: -1 for missing numeric data, 0 for missing percentages
3. **SSW Prediction Threshold**: `diff >= avg → -1`, `diff < avg → 1`
4. **Segment Indexing**: 0-indexed, inclusive end
5. **μH Averaging**: Simple mean across segments (NOT weighted by length)
6. **Charge Calculation**: K/R = +1, D/E = -1, H = 0 (not included)
7. **TANGO Parameters**: Fixed (nt="N", ct="N", ph="7", te="298", io="0.1", tf="0")

---

## 9. Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| main.py | ~100 | Entry point, orchestration |
| config.py | ~50 | Thresholds, column names |
| tango.py | ~150 | TANGO execution and parsing |
| s4pred.py | ~100 | S4PRED execution and parsing |
| auxiliary.py | ~530 | SSW algorithm, FF prediction |
| biochemCalculation.py | ~80 | μH, charge, hydrophobicity |
| S4PRED/run_model.py | ~100 | S4PRED model loading |
| S4PRED/network.py | ~50 | S4PRED neural network |

**Total Reference Implementation: ~1,160 lines** (excluding S4PRED dependencies)
