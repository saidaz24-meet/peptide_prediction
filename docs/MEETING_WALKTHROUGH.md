# Peptide Visual Lab - Meeting Walkthrough

**Audience**: Biologists, PhD supervisors, collaborators (non-developer)
**Duration**: ~15 minutes
**Prepared for**: Project status review

---

## What Does PVL Do?

PVL (Peptide Visual Lab) predicts whether short proteins ("peptides") are likely to form **fibrillar structures** - ordered aggregates associated with diseases like Alzheimer's and Parkinson's, but also found in antimicrobial defense.

**Input**: A list of peptide sequences (from a CSV file, or queried from UniProt)
**Output**: For each peptide:
- Biophysical properties (charge, hydrophobicity, amphipathicity)
- Secondary structure prediction (helix vs beta content)
- Fibril-forming classification (FF-Helix, FF-SSW)
- Interactive visualizations

---

## The Science Behind PVL

### Why Fibril Formation Matters

Many natural peptides can switch between helical and beta-sheet structures. This "structural switching" makes them prone to forming amyloid-like fibrils. PVL identifies these peptides by combining:

1. **Biophysical screening**: Hydrophobic moment (muH) as a helical amphipathicity measure
2. **Structure prediction**: Per-residue helix/beta probabilities from neural networks
3. **Database-level thresholds**: Comparing each peptide to the population average

### Two Prediction Axes

| Axis | Question | Method | Result |
|------|----------|--------|--------|
| **FF-Helix** | "Is this peptide a helix-forming fibrillar candidate?" | S4PRED helix segments + muH threshold | Yes (1) / No (-1) |
| **FF-SSW** | "Does this peptide undergo helix-to-beta switching?" | Overlapping helix + beta regions + hydrophobicity | Yes (1) / No (-1) |

A peptide flagged on **either** axis is a candidate for experimental validation.

### How S4PRED Works

S4PRED is a machine learning model (5 neural networks in ensemble) that predicts, for each amino acid in a sequence, the probability of being in:
- **Helix** (alpha-helix)
- **Beta** (beta-sheet)
- **Coil** (unstructured)

From these probabilities, PVL extracts segments, computes overlap (SSW), and classifies fibril-forming propensity.

---

## Demo Walkthrough

### Step 1: Upload Data

- Go to the **Upload** page
- Upload a CSV with columns: `Entry` (ID), `Sequence` (amino acids)
- Or enter a UniProt query (e.g., `organism:9606 keyword:antimicrobial`)
- Click "Analyze"

### Step 2: Results Dashboard

The main results page shows:

**KPI Cards** (top row):
| Card | What It Shows |
|------|--------------|
| Total Peptides | Number of sequences analyzed |
| SSW Positive % | Percentage predicted to have structural switching |
| Mean Hydrophobicity | Average hydrophobicity across all sequences |
| Mean Charge | Average net charge at pH 7.4 |

**Charts**:
- Scatter plot: Hydrophobicity vs Charge, colored by SSW prediction
- Distribution histograms for key metrics

**Data Table**:
- Sortable by any column
- Click any row to see the peptide detail page

### Step 3: Peptide Detail

For each peptide, the detail page shows:

**Summary Section**:
- Sequence with colored residue annotations
- Key metrics at a glance (charge, hydrophobicity, muH, FF-Helix %)

**Per-Residue Curves** (if S4PRED ran):
- Helix probability curve (blue)
- Beta probability curve (red)
- Coil probability curve (gray)
- SSW regions highlighted (where helix and beta overlap)

**Aggregation Profile** (if TANGO ran):
- Aggregation propensity per residue
- Peak regions indicate aggregation-prone segments

### Step 4: Export

- Download results as CSV (all columns)
- Download as PDF report (summary + charts)

---

## Output Column Dictionary

### Core Properties

| Column | Unit | Description |
|--------|------|-------------|
| `id` | text | UniProt Entry ID or user-provided ID |
| `sequence` | text | Amino acid sequence (one-letter code) |
| `length` | count | Number of amino acids |
| `charge` | charge units | Net charge at pH 7.4 |
| `hydrophobicity` | Kyte-Doolittle | Average hydrophobicity (-4.5 to 4.5) |
| `muH` | Eisenberg scale | Hydrophobic moment assuming helical geometry (angle=100) |

### FF-Helix (Local Propensity)

| Column | Unit | Description |
|--------|------|-------------|
| `ffHelixPercent` | % (0-100) | Percentage of sequence with helix-forming propensity (Chou-Fasman sliding window, core=6 residues, threshold=1.0) |
| `ffHelixFragments` | segment list | Helix-prone regions as [start, end] pairs (1-indexed) |

### S4PRED Predictions

| Column | Unit | Description |
|--------|------|-------------|
| `s4predHelixPrediction` | -1 or 1 | -1 = no helix detected, 1 = helix found |
| `s4predHelixPercent` | % (0-100) | Percentage of residues in predicted helix segments |
| `s4predHelixScore` | score | Average helix probability in helix segments |
| `s4predHelixFragments` | segment list | Helix segments as [start, end] tuples |
| `s4predSswPrediction` | -1 or 1 | -1 = no structural switch, 1 = switch predicted |
| `s4predSswScore` | score | Sum of avg helix + avg beta probabilities in SSW regions |
| `s4predSswDiff` | score | |avg helix - avg beta| in SSW regions (lower = more switching) |
| `s4predSswHelixPercent` | % (0-100) | Helix content in SSW overlap regions |
| `s4predSswBetaPercent` | % (0-100) | Beta content in SSW overlap regions |

### TANGO SSW Predictions

| Column | Unit | Description |
|--------|------|-------------|
| `sswPrediction` | -1/0/1/null | -1 = no switch, 0 = uncertain, 1 = switch predicted, null = TANGO didn't run |
| `sswScore` | score | TANGO-based SSW score |
| `sswDiff` | score | TANGO-based SSW difference |

### Provider Status

Each row includes `providerStatus` indicating which prediction tools ran:

| Status | Meaning |
|--------|---------|
| `AVAILABLE` | Tool ran and produced results |
| `UNAVAILABLE` | Tool was enabled but failed |
| `PARTIAL` | Some results available |
| `OFF` | Tool not enabled in configuration |

---

## Current Status

### What's Working
- CSV/XLSX upload with automatic column detection
- UniProt query integration (accession, keyword, organism ID)
- Full biochemical calculations (charge, hydrophobicity, muH)
- S4PRED helix/beta prediction with per-residue curves
- FF-Helix % computation (always available, no dependencies)
- SSW detection from S4PRED (with database-average threshold)
- TANGO integration (when binary is available)
- Docker deployment with CPU-only PyTorch
- Caddy auto-HTTPS ready (pending domain assignment)

### Test Coverage
- 202 automated tests (all pass, no network required)
- Golden tests for S4PRED analysis, FF-Helix, SSW pipeline
- API contract validation

### What's Next
1. Verify with Peleg's suggested FF-Helix changes
2. Kubernetes deployment on DESY infrastructure
3. UI polish (data table search/filter)
4. Advanced visualizations (post-paper)
5. Precomputed proteome database (long-term)

---

## Questions for Discussion

1. **S4PRED weights**: Are the current weights (from reference repo) the final ones, or should we retrain?
2. **FF-Helix threshold**: Current Chou-Fasman propensity threshold is 1.0. Should this be adjusted?
3. **Domain name**: What DESY domain should we use for the Caddy HTTPS setup?
4. **Peleg's changes**: Are there specific FF-Helix modifications from Peleg that need to be applied?
5. **Publication timeline**: When is the target submission? This affects prioritization of UI polish vs core verification.
