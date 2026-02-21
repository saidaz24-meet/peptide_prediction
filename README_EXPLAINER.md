# How Peptide Visual Lab Works: A Non-Technical Guide

> **Audience**: Biologists, PhD supervisors, collaborators, and anyone who wants to understand
> what PVL does without reading code.
> **Reading time**: 15 minutes

---

## What Is PVL?

Peptide Visual Lab (PVL) is a web application that helps researchers answer one fundamental question:

**"Will this peptide aggregate, form fibrils, or undergo a dangerous structural switch?"**

Think of it as a digital laboratory instrument. You give it peptide sequences, and it runs multiple
prediction algorithms simultaneously, then shows you the results as interactive charts, tables,
and exportable figures — all in your browser.

### Why Does This Matter?

Proteins can misfold. When they do, they sometimes stick together into tiny threads called
**fibrils**. This process is linked to diseases like Alzheimer's and Parkinson's. Researchers
need to know which peptides (short protein fragments) are likely to:

1. **Aggregate** — clump together in harmful ways
2. **Switch structure** — flip from a healthy spiral (alpha-helix) to a flat sheet (beta-sheet)
3. **Form fibrils** — create the ordered threads associated with disease

PVL combines three prediction tools that each look at different aspects of this problem,
runs them all at once, and presents everything in one place.

---

## The Three Prediction Engines

### 1. TANGO — Aggregation Prophet

**What it does**: Predicts which parts of a peptide are likely to aggregate (stick together).

**How it works**: TANGO is an external program (a compiled binary, like a calculator app). PVL sends
it your peptide sequence, TANGO crunches the numbers using thermodynamic models, and sends back
a score for every position in the sequence.

**What you see**: An "aggregation heatmap" — a bar chart where each bar represents one amino acid
position. Tall bars = high aggregation risk. This tells you exactly WHERE in the peptide the
trouble spots are.

**Key outputs**:
- **SSW Prediction** (yes/no): Does this peptide undergo a "Secondary Structure Switch"?
  Think of it as: "Does this peptide act like a chameleon, changing its shape depending on
  the environment?"
- **SSW Score**: How confident is that prediction? Higher = more confident.
- **Aggregation curves**: Per-residue risk profiles.

### 2. S4PRED — Structure Predictor

**What it does**: Predicts the secondary structure of each amino acid — is it part of a
spiral (helix), a flat sheet (strand), or a flexible loop (coil)?

**How it works**: S4PRED is a neural network (AI model) trained on thousands of known protein
structures. It looks at your sequence and outputs three probabilities for each position:
P(Helix), P(Strand), P(Coil). The highest probability wins.

**What you see**: A colored sequence track — each amino acid is colored by its predicted structure:
- Red/pink = helix (spiral)
- Blue = strand (flat sheet)
- Gray = coil (flexible)

Hover over any amino acid to see the exact probabilities.

**Key outputs**:
- **S4PRED Helix %**: What fraction of the peptide is predicted to be helical.
- **Per-residue probabilities**: The raw P(H), P(E), P(C) values at each position.
- **Dominant structure**: Overall classification (mostly helix, mostly strand, mixed, etc.).

### 3. FF-Helix — Fibril Formation Detector

**What it does**: Estimates what percentage of the peptide has the intrinsic tendency to form
fibril-forming helices.

**How it works**: This is a pure math calculation (no AI, no external tool). It slides a window
of 6 amino acids across the sequence. For each window, it looks up each amino acid's known
helix-forming propensity (from published experimental data). If the average propensity
exceeds a threshold, that window "qualifies."

**What you see**: A single percentage:
- 0% = no part of the peptide has strong helix-forming tendency
- 100% = the entire peptide has strong helix-forming tendency

**Important**: This is a propensity score, NOT experimental helicity. A CD spectroscopy
experiment on the same peptide in a membrane might show 40-50% helicity because the
environment matters. FF-Helix ignores environment — it only looks at the amino acid sequence.

**Key outputs**:
- **FF-Helix %**: The headline number.
- **FF-Helix Fragments**: Which specific windows qualified.
- **FF-Helix Flag**: Binary indicator (1 = has qualifying regions, -1 = does not).

---

## What Happens When You Use PVL (A to Z)

### Path 1: Upload a CSV File

This is the most common workflow for batch analysis.

```
You have a CSV file with peptide sequences
         |
         v
[Upload Page] — Drag and drop your file
         |
         v
Browser sends file to backend server
         |
         v
Backend: Parse CSV headers
  - Recognizes "Entry" (peptide ID) and "Sequence" columns
  - Handles different naming conventions automatically
         |
         v
Backend: For each peptide in the file:
  1. Calculate biochemistry (hydrophobicity, charge, muH)
  2. Run FF-Helix calculation (pure math, instant)
  3. Run TANGO (if available) — may take 1-30 seconds
  4. Run S4PRED (if available) — neural network inference
  5. Compute SSW flags (structural switch detection)
         |
         v
Backend: Normalize all results
  - Convert internal names to standard format
  - Apply null semantics (missing data = null, not -1 or "N/A")
  - Attach provider status (which tools ran successfully)
         |
         v
Backend sends JSON response to browser
         |
         v
[Results Page] — Dashboard appears with:
  - KPI cards (top-level summary numbers)
  - Data table (every peptide, every metric)
  - Charts (aggregation risk, scatter plots, distributions)
  - Export buttons (CSV, PDF, SVG/PNG)
         |
         v
Click any peptide row → [Peptide Detail Page]
  - Sequence track (colored by structure)
  - Helical wheel diagram (amphipathic visualization)
  - Aggregation heatmap (per-residue TANGO scores)
  - S4PRED probability chart
  - AlphaFold 3D viewer (if UniProt ID available)
```

### Path 2: Quick Analyze (Single Sequence)

For when you have just one peptide to check.

```
[Quick Analyze Page] — Type or paste a sequence
         |
         v
Backend runs all three predictors on that one sequence
         |
         v
Full Peptide Detail view appears immediately
  - Same visualizations as clicking a row in batch results
  - No table (just one peptide)
```

### Path 3: UniProt Query

For when you want to fetch sequences from the UniProt protein database.

```
[Upload Page] — Enter UniProt query (organism ID, keyword, etc.)
         |
         v
Backend calls UniProt REST API to fetch matching sequences
         |
         v
Backend runs predictions on all fetched sequences
         |
         v
Same Results Dashboard as CSV upload
```

---

## Every Chart and Visualization Explained

### Results Dashboard (Batch View)

#### KPI Cards (Top Row)

Small cards showing the most important numbers at a glance:

- **Total Peptides**: How many sequences were analyzed
- **SSW Positive**: How many peptides show structural switching behavior
- **Agg Hotspots**: How many peptides have TANGO aggregation peaks above 5%
- **Mean FF-Helix %**: Average fibril-forming helix percentage across the cohort

#### Data Table

A spreadsheet-like view of all peptides. Every row is one peptide. Columns include:

| Column | What It Means |
|--------|---------------|
| Entry | The peptide's name/ID |
| Sequence | The amino acid letters |
| Length | Number of amino acids |
| Hydrophobicity | How much the peptide avoids water (higher = more water-shy) |
| muH | Hydrophobic moment — whether the peptide has a "wet side" and a "dry side" when coiled into a spiral |
| Charge | Net electrical charge at pH 7 (positive repels positive, negative repels negative) |
| FF-Helix % | Percentage of residues in fibril-forming helix windows |
| SSW Prediction | 1 = structural switch detected, -1 = not detected |
| SSW Score | Confidence in the SSW prediction |
| S4PRED Helix % | Percentage of residues predicted as helical by the neural network |

You can sort by any column, toggle columns on/off, and filter by ranges.

#### Eisenberg Scatter Plot

**What it shows**: Each peptide as a dot on a hydrophobicity (x-axis) vs muH (y-axis) plot.

**Why it exists**: This is a classic biophysics visualization. Peptides in the upper-right
quadrant (high hydrophobicity AND high amphipathicity) are more likely to interact with
membranes and potentially form fibrils. Reference lines from the Eisenberg classification
help categorize peptides as surface-seeking, transmembrane, or globular.

**Colors**: Dots are colored by SSW prediction status (positive, negative, or no data).

#### FF-Helix vs TANGO Aggregation Scatter

**What it shows**: Each peptide plotted by its FF-Helix % (x-axis) vs its maximum TANGO
aggregation score (y-axis).

**Why it exists**: Peptides in the upper-right (high helix propensity AND high aggregation)
are the most concerning — they have both the structural tendency and the aggregation drive
to form pathological fibrils.

#### Aggregation Risk Overview (Bar Chart)

**What it shows**: Top 30 peptides ranked by TANGO aggregation maximum, colored by risk level
(red = high risk, yellow = moderate, green = low).

**Why it exists**: Quick visual answer to "which peptides should I worry about most?"

#### Grouped Bar Chart (SSW+ vs SSW-)

**What it shows**: Average values of key metrics, split into two groups: peptides with
positive SSW prediction vs negative.

**Why it exists**: Reveals whether structural-switching peptides differ systematically
from non-switching ones. If SSW+ peptides have significantly higher hydrophobicity,
that's a meaningful biological pattern.

### Peptide Detail View (Single Peptide)

#### Sequence Track

**What it shows**: The amino acid sequence displayed as a row of colored blocks. Each block
is one amino acid, colored by its predicted secondary structure (helix = red, strand = blue,
coil = gray).

**How the backend calculates it**: S4PRED neural network outputs P(H), P(E), P(C) for each
position. The highest probability determines the color. Hover to see exact values.

**Why it exists**: Researchers can immediately see the structural landscape of their peptide —
where helices start and end, where flexible loops exist, where beta-strand regions might
indicate aggregation-prone zones.

#### Helical Wheel Diagram

**What it shows**: A top-down view of the peptide as if you were looking down a spiral staircase.
Each amino acid is placed at its position around the helix (100 degrees apart). Colors indicate
hydrophobic (yellow/orange) vs hydrophilic (blue/green) residues.

**How the backend calculates it**: Pure geometry. Each residue is placed at angle = position x 100
degrees. Colors come from the Fauchere-Pliska hydrophobicity scale. An arrow shows the
hydrophobic moment (muH) direction and magnitude.

**Why it exists**: If all the hydrophobic residues line up on one side of the wheel,
the peptide is "amphipathic" — it has a distinct wet side and dry side. This is critical
for understanding membrane interaction and fibril nucleation. Researchers use helical wheels
in publications regularly.

#### Aggregation Heatmap (TANGO Per-Residue)

**What it shows**: A bar chart where each bar represents one amino acid position. Bar height
shows the TANGO-predicted aggregation propensity at that position.

**How the backend calculates it**: TANGO binary processes the sequence and returns per-residue
aggregation scores. PVL receives the raw curve data and displays it.

**Why it exists**: Tells researchers exactly WHERE aggregation hotspots are in the sequence.
This guides decisions about which residues to mutate in experiments.

#### S4PRED Probability Chart

**What it shows**: Three overlapping line plots — P(Helix), P(Strand), P(Coil) — across
the sequence length.

**How the backend calculates it**: S4PRED neural network. Five independently trained models
(ensemble) each predict probabilities, then the results are averaged for robustness.

**Why it exists**: More nuanced than the colored sequence track. Shows regions of uncertainty
(where two structure types have similar probability) and regions of confidence (where one
type dominates). Transition zones — where helix probability drops and strand probability
rises — are the most scientifically interesting regions.

#### AlphaFold 3D Viewer

**What it shows**: An interactive 3D model of the predicted protein structure, colored by
confidence (pLDDT score). Blue = high confidence, orange/red = low confidence.

**How it works**: If the peptide has a UniProt ID, PVL fetches the predicted structure from
the AlphaFold Database (maintained by DeepMind/EBI). The 3D viewer uses Mol*, a web-based
molecular visualization tool.

**Why it exists**: Gives spatial context to the per-residue predictions. Researchers can
see how aggregation-prone regions relate to the 3D fold of the protein.

#### Evidence Panel

**What it shows**: A summary card comparing predictions from different tools for the same
peptide. Shows agreement or disagreement between TANGO SSW and S4PRED SSW predictions.

**Why it exists**: When two independent prediction methods agree, researchers have higher
confidence. When they disagree, the panel flags it with a warning, prompting closer
investigation.

### Compare Page (Cohort Comparison)

**What it shows**: Two datasets loaded side by side. Distribution histograms, summary
statistics, and key metric comparisons for each dataset.

**Why it exists**: Researchers often compare mutant vs wild-type peptides, or disease-associated
vs control sets. This page lets them see at a glance whether one group has systematically
higher aggregation risk.

### Export Capabilities

| Format | What You Get | Use Case |
|--------|-------------|----------|
| CSV | All data, all columns | Further analysis in Excel/R/Python |
| PDF | Summary report with ranked shortlist, methodology section | Sharing with colleagues, lab meetings |
| SVG | Vector graphics of any chart | Publication figures (infinite zoom, editable in Illustrator) |
| PNG | Raster images of any chart (2x resolution) | Presentations, quick sharing |
| FASTA | Sequences in standard bioinformatics format | Input for other tools |

---

## The Backend: What Actually Runs

When you submit peptides, here is exactly what the server does, in order:

### Step 1: Parse Input

The backend receives your file (CSV) or sequence (text). It:
- Identifies the "Entry" and "Sequence" columns (handles many naming variations)
- Validates that sequences contain valid amino acid letters
- Replaces non-standard amino acids: O (pyrrolysine) to K, J (Xle) to L, X (unknown) to A

### Step 2: Biochemical Calculations (instant, always runs)

For each peptide, calculate:
- **Hydrophobicity**: Average of each amino acid's water-avoidance score (Kyte-Doolittle scale)
- **Charge at pH 7**: Sum of positive charges (K, R, H-terminus) minus negative charges (D, E, C-terminus)
- **muH (hydrophobic moment)**: Mathematical measure of amphipathicity. Imagine the peptide
  as a helix and calculate the vector sum of hydrophobicity contributions — the magnitude
  of that vector is muH.

### Step 3: FF-Helix Calculation (instant, always runs)

Slide a window of 6 amino acids across the sequence. For each window, look up each amino acid's
helix propensity (Fauchere-Pliska scale). If the average exceeds 1.0, that window qualifies.
FF-Helix % = (number of residues in qualifying windows / total residues) x 100.

### Step 4: TANGO Prediction (1-10 seconds per peptide, if available)

The server calls the TANGO binary (an external compiled program). TANGO uses statistical
mechanics models to predict:
- Per-residue aggregation propensity
- Per-residue helix/beta/turn probabilities
- Overall aggregation score

From these raw outputs, PVL computes:
- SSW prediction (does a structural switch exist?)
- SSW score (how strong is the switch?)
- SSW fragments (where exactly is the switch?)
- SSW diff (how dramatic is the transition?)

### Step 5: S4PRED Prediction (0.5-2 seconds per peptide, if available)

The server loads a PyTorch neural network (5 model ensemble, ~430MB of weights) and runs
inference on the sequence. Output: P(Helix), P(Strand), P(Coil) for every position.

From these probabilities, PVL computes:
- Dominant structure classification
- S4PRED Helix % (fraction of residues with P(H) > 0.5)
- S4PRED-based SSW analysis (independent from TANGO)

### Step 6: Normalize and Return

All results are:
- Converted to a standard format (camelCase JSON keys)
- Sanitized (missing data = null, never -1 or empty string)
- Tagged with provider status (which tools ran, which failed)
- Returned as a JSON response to the browser

---

## Glossary of Scientific Terms

| Term | Plain English |
|------|---------------|
| **Amino acid** | One building block of a protein. There are 20 standard types. |
| **Peptide** | A short chain of amino acids (typically 5-50). |
| **Protein** | A long chain of amino acids (typically 50-30,000) that folds into a 3D shape. |
| **Alpha-helix** | A spiral shape, like a corkscrew. Common in healthy proteins. |
| **Beta-sheet** | A flat, pleated shape. When peptides aggregate into fibrils, they often form beta-sheets. |
| **Coil** | A flexible, unstructured region. Neither helix nor sheet. |
| **Fibril** | A tiny, ordered thread formed by many peptides sticking together in beta-sheet arrangements. |
| **Amyloid** | A specific type of fibril associated with diseases (Alzheimer's, Parkinson's). |
| **Aggregation** | The process of peptides clumping together. Can be ordered (fibrils) or disordered (amorphous). |
| **SSW (Secondary Structure Switch)** | When a peptide changes from one shape (e.g., helix) to another (e.g., beta-sheet) under different conditions. |
| **Hydrophobicity** | How much a molecule avoids water. Oil is hydrophobic. |
| **Hydrophobic moment (muH)** | A measure of how one-sided the water-avoidance is. High muH = one face is oily, the other is watery. |
| **Amphipathic** | Having both a hydrophobic (oily) face and a hydrophilic (watery) face. |
| **Propensity** | An amino acid's natural tendency toward a certain structure, based on statistics from known proteins. |
| **Per-residue** | "For each amino acid position in the sequence." |
| **Sliding window** | A technique where you look at a few amino acids at a time and slide along the sequence. |
| **Ensemble** | Running multiple models and averaging their predictions for robustness. |
| **pLDDT** | AlphaFold's confidence score (0-100). Higher = more confident in the predicted 3D position. |
| **UniProt** | The world's largest protein sequence database (maintained by EBI/SIB/PIR). |
| **TANGO** | A thermodynamic model for predicting aggregation (developed at CRG Barcelona). |
| **S4PRED** | A neural network for predicting secondary structure (helix/strand/coil). |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BROWSER                          │
│                                                          │
│  React App (TypeScript)                                  │
│  ├── Upload page (CSV / UniProt query)                   │
│  ├── Quick Analyze page (single sequence)                │
│  ├── Results dashboard (table + charts)                  │
│  ├── Peptide Detail (per-peptide deep dive)              │
│  ├── Compare page (two datasets side by side)            │
│  └── Help / About pages                                  │
│                                                          │
│  State: Zustand store (persisted to localStorage)        │
│  Charts: Recharts + custom SVG                           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (JSON)
                       v
┌─────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                         │
│                                                          │
│  FastAPI (Python)                                        │
│  ├── /api/upload-csv    → batch processing               │
│  ├── /api/predict       → single sequence                │
│  ├── /api/uniprot/*     → UniProt database queries       │
│  ├── /api/health        → status check                   │
│  ├── /api/providers/*   → predictor status               │
│  └── /api/feedback      → user feedback                  │
│                                                          │
│  Services layer (18 modules):                            │
│  ├── upload_service.py    → CSV parsing + orchestration  │
│  ├── predict_service.py   → single sequence pipeline     │
│  ├── normalize.py         → result formatting            │
│  └── thresholds.py        → threshold resolution         │
│                                                          │
│  Predictors:                                             │
│  ├── tango.py       → TANGO binary wrapper               │
│  ├── s4pred.py      → S4PRED neural network              │
│  ├── auxiliary.py   → FF-Helix + SSW calculation         │
│  └── biochem_calculation.py → charge, hydrophobicity     │
└─────────────────────────────────────────────────────────┘
                       │
              ┌────────┴────────┐
              v                 v
     ┌──────────────┐  ┌──────────────┐
     │ TANGO Binary │  │ S4PRED Model │
     │ (compiled C) │  │ (PyTorch)    │
     │ ~200KB       │  │ ~430MB       │
     └──────────────┘  └──────────────┘
```

---

*This document describes PVL as of February 2026. For technical details, see the [Developer Reference](docs/active/DEVELOPER_REFERENCE.md). For API specifications, see [Contracts](docs/active/CONTRACTS.md). For deployment, see the [Deployment Guide](docs/active/DEPLOYMENT_GUIDE.md).*
