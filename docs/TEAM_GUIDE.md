# Peptide Visual Lab (PVL) - Team Guide

**Audience**: Non-technical team members, collaborators, project managers
**Last Updated**: 2026-02-07

---

## What is PVL?

Think of PVL as a **specialized laboratory assistant** that analyzes short proteins (peptides) and predicts whether they're likely to form fibrillar structures — ordered molecular "ropes" linked to diseases like Alzheimer's and to antimicrobial defense mechanisms.

Instead of running expensive wet-lab experiments on every peptide, researchers upload their sequences and get instant predictions.

---

## The Restaurant Metaphor

Imagine PVL as a restaurant:

### The Front of House (What You See)

The **React frontend** is your dining room — the web interface where you interact with PVL. You can:
- **Upload a menu** (CSV file with peptide sequences)
- **Order à la carte** (paste a single sequence on Quick Analyze)
- **Browse the supplier catalog** (search UniProt for sequences)

When your "order" is ready, you see a **results dashboard**: summary cards, charts, and a detailed table — like a nicely plated dish with all the information arranged clearly.

### The Kitchen (Where the Work Happens)

The **FastAPI backend** is the kitchen. When an order comes in:

1. **The host** (`server.py`) receives your request and coordinates everything
2. **Prep cooks** (`biochem_calculation.py`, `auxiliary.py`) compute basic properties — charge, hydrophobicity, helix propensity — like washing and chopping ingredients
3. **Specialist chefs** work in parallel:
   - **Chef S4PRED** (`s4pred.py`) — A neural network that predicts secondary structure (helix/beta/coil probabilities for each amino acid). Like an expert who can taste a raw ingredient and tell you what dish it'll become.
   - **Chef TANGO** (`tango.py`) — An external binary tool that predicts aggregation tendency. Like a specialist consultant called in for a second opinion.
4. **The expeditor** (`normalize.py`) takes all the outputs, formats them consistently, and sends them to the dining room

### The Supply Chain (External Dependencies)

- **UniProt** — A global protein database. When you search for sequences, PVL fetches them from UniProt's API (like ordering ingredients from a supplier).
- **S4PRED weights** — Pre-trained neural network files (430MB). Like a chef's years of training condensed into recipe books.
- **TANGO binary** — A compiled program that runs aggregation predictions. Like a specialized kitchen appliance.

---

## What Happens When You Upload a File?

Here's the journey of your data, step by step:

### Step 1: You Upload
You drag a CSV/Excel file onto the Upload page. The file needs at minimum an `Entry` column (peptide ID) and a `Sequence` column (amino acid letters).

### Step 2: Column Detection
PVL automatically detects which columns correspond to which data fields. It uses a smart matching system that recognizes many common column name formats. For example, your column called `"Protein Name"`, `"protein_name"`, or `"Protein name"` will all be correctly recognized.

### Step 3: Basic Calculations (Always Runs)
For every peptide, PVL computes:
| Property | What It Tells You |
|----------|------------------|
| **Charge** | Net electrical charge at pH 7.4 (positive = cationic, negative = anionic) |
| **Hydrophobicity** | How much the peptide avoids water (higher = more hydrophobic) |
| **Hydrophobic moment (muH)** | How "lopsided" the hydrophobicity is when arranged as a helix — a measure of amphipathicity |
| **FF-Helix %** | What percentage of the sequence has helix-forming propensity (Chou-Fasman method) |

### Step 4: Structure Prediction (If Available)
If S4PRED is enabled (it usually is), PVL runs the neural network to predict secondary structure:
- Per-residue helix/beta/coil probabilities
- Helix and beta segments
- SSW (Secondary Structure Switch) — regions where helix and beta overlap

If TANGO is enabled, it provides a second opinion on aggregation and SSW.

### Step 5: Classification
Based on all the above, PVL classifies each peptide:
- **FF-Helix flag**: Is this a helix-forming fibrillar candidate? (Yes/No)
- **FF-SSW flag**: Does this peptide undergo structural switching? (Yes/No)

### Step 6: Results
Everything is packaged into a dashboard with:
- **KPI cards** at the top (totals, averages, percentages)
- **Charts** (scatter plots, distributions)
- **Data table** (sortable, click any row for details)

---

## Understanding the Results

### The Dashboard Cards

| Card | What It Shows | Why It Matters |
|------|--------------|----------------|
| **Total Peptides** | How many sequences were analyzed | Sanity check — matches your input count? |
| **SSW Positive %** | Percentage with structural switching | Higher % = more potential fibril-formers in your dataset |
| **Mean Hydrophobicity** | Average water-avoidance score | Context for your dataset's overall character |
| **Mean Charge** | Average electrical charge | Context for electrostatic properties |

### The Classification Flags

| Flag | Value | Meaning |
|------|-------|---------|
| **FF-Helix** | 1 | Candidate: has helical structure AND high amphipathicity |
| **FF-Helix** | -1 | Not a candidate: doesn't meet helix + muH criteria |
| **FF-Helix** | null (empty) | No data: S4PRED didn't run or couldn't process this sequence |
| **FF-SSW** | 1 | Candidate: shows helix-to-beta switching AND meets hydrophobicity criteria |
| **FF-SSW** | -1 | Not a candidate: doesn't show structural switching |
| **FF-SSW** | null (empty) | No data: predictors didn't produce SSW results |

**Key insight**: A peptide flagged on *either* axis is worth investigating experimentally.

### The Provider Pills

At the top of the results page, you'll see status indicators for each prediction tool:

| Status | What It Means |
|--------|--------------|
| **AVAILABLE** (green) | Tool ran successfully for all sequences |
| **PARTIAL** (yellow) | Tool worked for some sequences but not all |
| **UNAVAILABLE** (red) | Tool was enabled but encountered errors |
| **OFF** (gray) | Tool is not enabled in the current configuration |

---

## What Happens When Things Go Wrong?

### "Some predictions are missing (null values)"

**What you see**: Some cells in the results table are empty or show "—"

**What it means**: The prediction tool couldn't process that specific sequence. Common reasons:
- The sequence is too short (< 5 amino acids)
- The sequence contains unusual characters
- The external tool timed out

**What to do**: Check the provider status pill. If it shows "PARTIAL," this is expected for a few sequences. If "UNAVAILABLE," the tool itself had a problem.

### "TANGO shows as OFF"

**What you see**: The TANGO provider pill is gray

**What it means**: TANGO is disabled in the server configuration. The TANGO binary may not be installed in the deployment environment.

**Impact**: SSW predictions will come only from S4PRED (which is usually sufficient). The `sswPrediction` field will still be populated if S4PRED is available.

### "S4PRED shows as UNAVAILABLE"

**What you see**: The S4PRED provider pill is red

**What it means**: S4PRED is enabled but failed to run. Possible causes:
- Weight files not found at the configured path
- Memory issues (S4PRED uses ~1GB RAM)
- Corrupted weight files

**Impact**: No per-residue probability curves, no S4PRED-based helix/beta segments, no ML-based SSW detection. FF-Helix flags will be null. Basic properties (charge, hydrophobicity, FF-Helix %) still work.

### "The upload failed entirely"

**What you see**: Error message on the upload page

**Common causes**:
1. **File format**: Must be CSV, TSV, or XLSX. Check for corrupted files.
2. **Missing columns**: File must have `Entry` and `Sequence` columns (or recognizable variants like `Accession`, `ID`, `Seq`).
3. **Empty sequences**: Rows without valid amino acid sequences will be skipped.
4. **Server unreachable**: Check if the backend is running.

---

## Glossary

| Term | Simple Definition |
|------|------------------|
| **Peptide** | A short protein (typically 5-100 amino acids) |
| **Fibril** | Ordered molecular "rope" formed by stacked proteins |
| **Secondary structure** | The local 3D shape: helix (spiral), beta-sheet (flat), or coil (unstructured) |
| **SSW** | Secondary Structure Switch — a region where helix and beta predictions overlap |
| **muH** | Hydrophobic moment — measures how "lopsided" a helix is (one side water-loving, the other water-avoiding) |
| **S4PRED** | A neural network (5 models in ensemble) that predicts secondary structure |
| **TANGO** | An external tool that predicts protein aggregation tendency |
| **FF-Helix** | Fibril-Forming via Helix — one of two classification axes |
| **FF-SSW** | Fibril-Forming via SSW — the other classification axis |
| **Provider** | A prediction tool (S4PRED or TANGO) that can be enabled/disabled independently |
| **Null** | "No data available" — the tool didn't run or couldn't process this sequence |
| **UniProt** | A global protein sequence database (uniprot.org) |
| **Chou-Fasman** | A classical method for estimating helix propensity from amino acid sequence |
| **Kyte-Doolittle** | A scale for measuring amino acid hydrophobicity |

---

## Frequently Asked Questions

**Q: How long does analysis take?**
A: For a typical CSV (100-500 peptides): 10-60 seconds with S4PRED, under 5 seconds without. TANGO adds additional time per sequence.

**Q: Can I re-analyze with different settings?**
A: Yes — re-upload the same file. Each analysis is independent. The system doesn't save previous runs (no database yet).

**Q: What file formats are supported?**
A: CSV (comma-separated), TSV (tab-separated), and XLSX (Excel). The file must have at least `Entry` and `Sequence` columns.

**Q: Is my data stored on the server?**
A: No. PVL processes your data in memory and returns the results. Nothing is saved after the response is sent. Each upload is a fresh analysis.

**Q: What's the difference between FF-Helix % and the FF-Helix flag?**
A: FF-Helix % is a per-sequence score (0-100%) measuring helix propensity using a classical algorithm — it always computes, no dependencies. The FF-Helix *flag* (1/-1/null) is a binary classification that also requires S4PRED data and compares against the database average — it's a more sophisticated, ML-enhanced verdict.

**Q: Why do some peptides have S4PRED data but no TANGO data (or vice versa)?**
A: The tools run independently. If one fails for a specific sequence, the other can still succeed. The provider status shows which tools are active.

---

*For the science behind PVL's predictions, see `docs/MEETING_WALKTHROUGH.md`.
For developer documentation, see `docs/DEVELOPER_REFERENCE.md`.
For system architecture decisions, see `docs/SYSTEM_OVERVIEW.md`.*
