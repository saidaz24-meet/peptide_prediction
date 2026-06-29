# Use cases — does PVL fit your workflow?

You already have a real task in front of you. This page maps five common research situations onto the exact PVL screens, buttons, and outputs you'd touch — so you can decide whether PVL fits *before* you paste a single sequence. Each narrative is self-contained: read only the one that matches you.

Throughout, routes are written as the live app shows them. The public demo is at **http://94.130.178.182:3000** (this will be replaced by the DESY-hosted URL once that DNS resolves — the routes below stay identical). If you want the unhurried tour of every panel first, read the [UI walkthrough](04_the_ui_walkthrough.md).

One concept underlies all five: **every analysis in PVL is a shareable permalink** that encodes the sequence(s), the thresholds, and the software version. And every peptide is sorted into the [four-class system](02_the_science.md#1-the-four-class-system) — **Helix**, **FF-Helix** (⊆ Helix), **SSW**, **FF-SSW** (⊆ SSW). Keep both in mind as you read.

## Contents

- [1. "I have a UniProt accession — is it likely to form fibrils?"](#1-i-have-a-uniprot-accession--is-it-likely-to-form-fibrils)
- [2. "I have a CSV of 500 designed peptides — rank them by aggregation risk + helix candidacy."](#2-i-have-a-csv-of-500-designed-peptides--rank-them-by-aggregation-risk--helix-candidacy)
- [3. "I have a single sequence and a target structure — does the predicted aggregation overlap with helical regions?"](#3-i-have-a-single-sequence-and-a-target-structure--does-the-predicted-aggregation-overlap-with-helical-regions)
- [4. "I want to compare two cohorts — my designs vs a published reference."](#4-i-want-to-compare-two-cohorts--my-designs-vs-a-published-reference)
- [5. "I'm writing a paper and need a citable URL for the analysis."](#5-im-writing-a-paper-and-need-a-citable-url-for-the-analysis)
- [What we don't yet support](#what-we-dont-yet-support)

---

## 1. "I have a UniProt accession — is it likely to form fibrils?"

**The scenario.** A reviewer flagged that a protein in your study (you only have its UniProt accession, say `P0DTC2`) might contain a self-assembling segment. You don't have the sequence handy and you don't want to copy-paste from a FASTA file. You want to know, in one sitting, whether PVL classifies any part of it as fibril-forming.

**Page sequence:** Database Search (`/search`) → Results (`/results`) → Peptide Detail (`/peptides/:id`).

**What you touch.**
1. Go to **Database Search** (`/search`). In the **UniProt query** box, type the accession (the field accepts an accession like `P0DTC2`, a protein name, or a free-text query) and run the search.
2. The result table appears with an **annotation-evidence score (1–5)** per row. Tick the checkbox on your entry and click **Analyze selected**. If predictions are toggled off, click the **enable-predictions** banner first.
3. You land on **Results**. Open the row to go to **Peptide Detail** (`/peptides/:id`), where the four-class verdict sits at the top: is it **Helix**, **FF-Helix**, **SSW**, or **FF-SSW** — or none?

**Screenshot worth taking:** the Peptide Detail header showing the four-class chip strip with FF-Helix lit up, directly above the per-residue prediction track.

> **What to put in the paper.** Cite the UniProt accession *and* paste the PVL permalink (copy it from the Reproducibility ribbon on Results). The permalink re-runs the exact classification on any deployment, so a reader can confirm the FF call without re-entering anything.

---

## 2. "I have a CSV of 500 designed peptides — rank them by aggregation risk + helix candidacy."

**The scenario.** Your lab designed a 500-member peptide library and wants to pick the top dozen to synthesize. You need a defensible, reproducible ranking that blends aggregation propensity ([TANGO](02_the_science.md#2-tango)) with helix / FF-Helix candidacy — not a single-algorithm sort that ignores structure.

**Page sequence:** Upload (`/upload`) → Results (`/results`).

**What you touch.**
1. Go to **Upload** (`/upload`) and drag your CSV in (one sequence per row; an optional name column). A **progress bar with ETA** tracks the batch; any unparseable rows surface in a **failed-row** panel rather than silently dropping.
2. On **Results**, open the **weighted ranking** control (the weight bar). Each metric shows its share out of 100 — push weight toward **aggregation** and toward **helix / FF-Helix candidacy**, and the table re-ranks live. The weights are proportional, never TANGO-only.
3. Use the **Venn region counts** and click a region to filter the table to just FF-Helix candidates. Export your shortlist; the CSV/TSV/XLSX carries a four-line provenance header (`# Method = …`) so the ranking is self-documenting.

**Screenshot worth taking:** the Results table re-sorted by the custom weight blend, with the weight bar visible above it and the FF-Helix Venn region selected.

> **What to put in the paper.** Report the weight vector you used (it's encoded in the permalink) and attach the exported CSV — its provenance header records the thresholds and PVL version, so the ranking is reproducible to the row.

Single-sequence and batch results are guaranteed identical in PVL, so a top candidate you later re-check via Quick Analyze will show the same numbers.

---

## 3. "I have a single sequence and a target structure — does the predicted aggregation overlap with helical regions?"

**The scenario.** You're studying one peptide and you suspect it's a **secondary-structure switch**: a stretch that [S4PRED](02_the_science.md#3-s4pred) calls helix but TANGO also flags as aggregation-prone. That overlap is precisely PVL's **[SSW](02_the_science.md#6-ssw)** class. You want to see, residue by residue, where the helix and the β-aggregation prediction collide — and where that sits on the 3D fold.

**Page sequence:** Quick Analyze (`/quick`) → Results (`/results`) → Peptide Detail (`/peptides/:id`).

**What you touch.**
1. Go to **Quick Analyze** (`/quick`). Paste the sequence in the sequence field (placeholder `e.g. MRWQEMGYIFYPRKLR`), optionally name it, and analyze.
2. On **Peptide Detail**, read the **sliding-window profile**: the TANGO aggregation curve with the **SSW band** marked where helix and aggregation overlap. The verdict chip tells you if it's classified **SSW** / **FF-SSW**.
3. Open the **Mol\* 3D viewer** (live AlphaFold structure). Toggle the **SSW residue overpaint** to paint the switch residues directly onto the molecule, then rotate to see where they fall on the fold.

**Screenshot worth taking:** the Mol\* structure with SSW residues overpainted, beside the sliding-window profile showing the same residues under the SSW band.

> **What to put in the paper.** A figure of the overlap region plus the permalink is enough for a reader to reproduce the exact view. Note in the caption that TANGO supplies aggregation propensity and S4PRED supplies secondary structure — PVL computes the SSW overlap; TANGO does not itself predict fibrils.

---

## 4. "I want to compare two cohorts — my designs vs a published reference."

**The scenario.** You want to know whether your designed set is enriched for fibril-forming candidates relative to an established benchmark — not by eyeballing two tables, but with a statistic you can quote.

**Page sequence:** Upload (`/upload`) → Compare (`/compare`).

**What you touch.**
1. Upload your cohort at **Upload** (`/upload`) as in case 2.
2. Go to **Compare** (`/compare`). Click the **one-click compare** chip to load the built-in published reference cohort (the 118-peptide fibril-forming reference set). Your cohort and the reference render side by side.
3. Read the **percentile bars** for each metric, and — where the precomputed reference is available — the **[Welch's t-test](09_glossary.md#w)** p-value and effect size next to them. The comparison scope is cohort-only, so the statistics describe these two sets, not the whole database.

**Screenshot worth taking:** the Compare view with both cohort distributions overlaid and the p-value / effect-size readout visible for the aggregation metric.

> **What to put in the paper.** Quote the test, the p-value, and the effect size exactly as shown, name the reference cohort, and paste the Compare permalink so a reviewer re-loads both distributions and the statistic in one click.

---

## 5. "I'm writing a paper and need a citable URL for the analysis."

**The scenario.** Your figure is made, your candidates are chosen, and now you need the methods sentence and a link a reviewer can open. PVL is built so that "reproducible" is a button, not a chore — **reproducibility-as-permalink** is a headline feature, not an afterthought.

**Page sequence:** any analysis → Results (`/results`) → Reproducibility ribbon.

**What you touch.**
1. From any **Results** view, open the **Reproducibility ribbon**. Click **Copy permalink** — the URL encodes the sequence(s), thresholds, predictor flags, and PVL version, so re-opening it reproduces the exact analysis.
2. Open the **citation dialog** for the auto-generated **BibTeX** entry.
3. For figures, use **Export figure pack** (SVG/PNG) — the export captures the current permalink alongside the images.

**Screenshot worth taking:** the citation dialog showing the BibTeX entry with the permalink field populated.

> **What to put in the paper.** Cite the **Zenodo DOI** for the PVL version you used (the concept DOI for always-latest, or the versioned DOI for the exact release — both in `CITATION.cff`) and paste the **permalink** for the specific analysis. Together they pin both the tool and the result. The full citable-record procedure is in the [publication path](../research/04_publication_path.md).

---

## What we don't yet support

The same honesty the [science page](02_the_science.md) keeps: PVL's predictors are **sequence-only**, so several real-world factors are outside its scope today.

- **Post-translational modifications (PTMs).** Phosphorylation, glycosylation, acetylation and the like are invisible to PVL — it sees the bare amino-acid sequence, not the modified residue.
- **Non-ribosomal peptides.** Sequences built by non-ribosomal peptide synthetases (with D-amino acids, unusual monomers, or cyclic backbones) are not modeled.
- **Peptidemimetics.** Synthetic backbones and non-natural residues fall outside the 20-amino-acid alphabet the predictors are trained on.
- **Concentration and environment effects.** TANGO here is run sequence-only — pH, temperature, ionic strength, crowding, and peptide concentration are **not** inputs. Two peptides that behave differently only because of their buffer will look identical to PVL.

If your question depends on any of these, treat PVL's output as a sequence-level prior, not a final answer. When in doubt about the science, the [science page](02_the_science.md) and the [landscape](../research/01_landscape.md) explain exactly what each predictor does and does not claim.
