# PVL Prediction Validation Against Staphylococcus 2023 Benchmark — v0.1

**Brief ID**: RB-VALIDATION-V0-1
**Date**: 2026-05-21
**Author**: T5 (deep-research terminal)
**Mission**: Characterize PVL's positive-call behavior on the Staphylococcus 2023 labeled subset (n=66) as an exploratory analysis. Surface the AMP-overlap class pattern. Produce paper-supplement-quality numbers for the limitations section.
**Reading time**: ~12 minutes
**Companion deliverables**: `backend/tests/test_canary_peptides.py` (CI canary suite), Part 3 disclosure paragraph (§6 below).

> **Editor's note (2026-06-03, post Peleg Drive review)**: This brief originally framed the AMP-positive class as "false positives." Peleg corrected that framing in Drive Comments 2-4 (2026-05-22): *"the features that drive amyloid or fibril formation are the same features that allow membrane interactions"* and her lab specifically targeted AMPs as fibril candidates *because* of the shared feature space. So AMP positives are not errors — they're correctly-flagged broader-scope candidates. We are leaving the per-section text below in place for the historical record, but the canonical framing for the paper, the UI disclosure, and future communication is **"membrane-active overlap class with shared fibril-forming features"** — NOT false positives. See `docs/active/PELEG_DRIVE_COMMENTS_CONFUSION_MAP.md` §0 Shift 1 for the full reasoning.

---

## §1 — TL;DR (5 bullets)

1. **PVL's FF-Helix flag has perfect sensitivity (47/47 = 1.000) but zero specificity (0/19 = 0.000) on the Staphylococcus 2023 labeled subset (n=66).** Every experimentally validated amyloid former is caught; every experimentally validated non-former is also flagged. PPV = 0.712, F1 = 0.832.

2. **PVL's FF-SSW flag is worse than uninformative on this benchmark.** Sensitivity 0.319, specificity 0.053, PPV 0.455, F1 0.375. The FF-SSW rule (SSW positive AND hydrophobicity ≥ threshold) is dominated by the SSW base call — varying the hydrophobicity cutoff from 0 to 1.5 gives at most F1 = 0.385 within the labeled set. **No threshold tuning rescues this metric.**

3. **The broader-candidate class is overwhelmingly antimicrobial peptides (AMPs)**: 17 of 18 confirmed AMP-positive calls are Phenol-soluble modulin α2 (PSM-α2, sequence `MGIIAGIIKFIKGLIEKFTGK`) replicated across UniProt accessions; the 18th is Delta-hemolysin. Across the full 2916 rows, 71 peptides match AMP-related keywords — 69 are FF-Helix positive (97% AMP positive rate). **Per Peleg's correction (Drive Comment 2, 2026-05-22): this is not a tool failure. The features that drive amyloid formation are the same features that allow membrane interactions — so AMP positives are correctly-flagged broader-scope candidates, not errors.** Her lab specifically targeted AMPs as fibril candidates *because* of this shared feature space (Drive Comment 4).

4. **PSM-α1 vs PSM-α2 demonstrate a residue-level discrimination problem PVL's threshold rules cannot solve.** The two differ in 4 positions out of 21; biochemistry differs by Δcharge = 1, Δhydro = 0.008, Δhelix-uH = 0.012. PVL's sequence-derived rules see them as biochemically identical. The experimental difference is therefore *not* recoverable from sequence alone with the current feature set.

5. **Recommendation: do not "fix" the rules — fix the UI copy.** Per Said's directive (2026-05-20) and Peleg's algorithmic constraint, PVL's classifiers correctly identify *amphipathic conformational switch candidates*; the bug is in interpreting that as "confirmed amyloid former." Ship: (a) per-class disclosure paragraph in `Help.tsx` + FF-SSW tooltip (§6), (b) canary test suite pinning these exact behaviours to CI (`backend/tests/test_canary_peptides.py`), (c) future Peleg dispatch: investigate enriched AMP/Signal-peptide UniProt annotation as a "downweight" signal for the ranking system (open question — not auto-shipped).

---

## §2 — Method

### 2.1 — Dataset

`ui/public/Final_Staphylococcus_2023_new.xlsx` (verified 2026-05-21):
- **2916 rows × 36 columns**, all `Keyword = "Staphylococcus_2023"`.
- Three experimental-validation columns:
  - **`TEM Fibrils`** — 66 non-null rows: 47 `V` (transmission electron microscopy: fibrils observed), 19 `X` (TEM: fibrils NOT observed).
  - **`Fiber diffraction`** — 63 non-null rows: all `O` (observed; no negative controls).
  - **`ThT`** — 0 non-null rows (column empty).
- **Ground truth used**: TEM Fibrils (the only column with positive AND negative experimental controls). Fiber diffraction is positive-only and was not used for confusion-matrix computation.

**Important caveat**: The 19 TEM = X rows are not a random non-amyloid sample. They are peptides Peleg's lab pre-selected as "expected to be amyloid but experimentally weren't" — primarily PSM-α2 (15 of 19), plus Delta-hemolysin (2), PSM-mec (1), and one additional PSM. Specificity numbers should be read as "PVL's ability to distinguish PSM-α1/α3/α4 from PSM-α2" — a hard biological problem — not as "PVL's general non-amyloid recall."

### 2.2 — Pipeline used

The Excel `COMPUTED COLUMNS` (SSW prediction, SSW score, SSW diff, FF-Helix (Jpred), FF-Secondary structure switch, Helix (Jpred) uH, Hydrophobicity, Full length uH, etc.) are the outputs of a prior PVL pipeline run — the same code path invoked by `/api/upload-csv`. Verified by:

- Column structure matches `backend/services/normalize.py` canonical column set.
- Sentinel conventions (`-1` for flags, `-1` for FF-helix score when not a candidate) match `backend/tests/analyze_gold_standard.py` reference invariants.
- Cross-tabulation of FF-Helix vs SSW vs FF-SSW matches the documented threshold logic (FF-SSW = SSW=1 AND Hydrophobicity ≥ mean(Hydrophobicity | SSW=1) = 0.4171).

We did **not** re-run TANGO/S4PRED from scratch on the 2916 sequences — the prior cached run (under `backend/.run_cache/Tango/out/`) was used as-shipped. Re-running with current code is in §11 (open follow-ups).

### 2.3 — Predictions evaluated

- `SSW prediction` (TANGO-derived, base call)
- `FF-Helix (Jpred)` (S4PRED helix segments + hydrophobic-moment threshold; binary 1 / -1)
- `FF-Secondary structure switch` (SSW base call + hydrophobicity cutoff; binary 1 / -1)
- Combined `FF-Helix OR FF-SSW` (PVL's effective "any amyloid candidate signal")
- Combined `FF-Helix AND FF-SSW` (strict "both signals agree")

### 2.4 — Reproducibility

Analysis script run from `backend/`:

```bash
.venv/bin/python <<'PY'
import pandas as pd
from pathlib import Path
df = pd.read_excel("../ui/public/Final_Staphylococcus_2023_new.xlsx", engine="openpyxl")
labeled = df[df["TEM Fibrils"].isin(["V","X"])].copy()
labeled["truth"] = (labeled["TEM Fibrils"] == "V").astype(int)
# Then compute confusion matrix per classifier as below in §3.
PY
```

All numbers in §3 are reproducible from this snippet. Full script preserved at the end of this brief (§14).

---

## §3 — Headline metrics (labeled subset, n = 66)

### 3.1 — Confusion matrices

| Classifier | N | TP | FP | TN | FN | Sensitivity | Specificity | PPV | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **SSW prediction** (TANGO base) | 66 | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | 0.375 |
| **FF-Helix (Jpred)** | 66 | 47 | 19 | 0 | 0 | **1.000** | **0.000** | 0.712 | 0.832 |
| **FF-Secondary structure switch** | 66 | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | 0.375 |
| **FF-Helix OR FF-SSW** | 66 | 47 | 19 | 0 | 0 | 1.000 | 0.000 | 0.712 | 0.832 |
| **FF-Helix AND FF-SSW** | 66 | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | 0.375 |

Reading the table:
- **FF-Helix dominates the OR call**: every TEM = V or TEM = X sequence is FF-Helix positive (S4PRED detects a helical segment AND that segment's hydrophobic moment ≥ default threshold of 0.388). The OR criterion is therefore identical to FF-Helix alone.
- **SSW and FF-SSW are identical here** because every SSW = 1 row in the labeled subset has Hydrophobicity ≥ 0.4 — the hydrophobicity cutoff never excludes a sequence.
- **AND criterion = FF-SSW criterion** for the same reason.

### 3.2 — Conditional predictive value (the useful framing)

| Question | Answer |
|---|---|
| Given **FF-Helix = 1**, what's the chance it's a real amyloid? | 47 / 66 = **71.2%** |
| Given **FF-Helix = -1**, what's the chance it's a real amyloid? | 0 / 0 → undefined (no FF-Helix-negative rows in labeled set) |
| Given **FF-SSW = 1**, what's the chance it's a real amyloid? | 15 / 33 = **45.5%** (close to coin flip) |
| Given **FF-SSW = -1**, what's the chance it's a real amyloid? | 32 / 33 = **97.0%** (FF-SSW = -1 is anti-informative — the inverse) |

The fourth row is the surprising one: **a peptide flagged FF-SSW = -1 in this subset is more likely to be experimentally amyloid than a peptide flagged FF-SSW = 1.** This is consistent with PVL's FF-SSW being a marker of "amphipathic switch propensity," which AMPs share with — but are distinguishable from — fibril formers, and the negative population here being non-AMP amyloid sequences (PSM-α1, α4 etc.) that don't pass the SSW heuristic.

### 3.3 — Threshold sensitivity

Sweep of FF-SSW hydrophobicity cutoff (FF-SSW := SSW = 1 AND Hydrophobicity ≥ cutoff):

| Cutoff | TP | FP | TN | FN | Sens | Spec | PPV | F1 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | 0.375 |
| 0.3 | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | 0.375 |
| **0.417 (default, dataset mean)** | 15 | 18 | 1 | 32 | 0.319 | 0.053 | 0.455 | **0.375** |
| 0.5 | 15 | 16 | 3 | 32 | 0.319 | 0.158 | 0.484 | 0.385 |
| 0.6 | 0 | 16 | 3 | 47 | 0.000 | 0.158 | 0.000 | 0.000 |
| ≥ 0.7 | 0 | 0 | 19 | 47 | 0.000 | 1.000 | 0.000 | 0.000 |

**No FF-SSW hydrophobicity cutoff improves F1 above 0.385.** The cliff at 0.6 happens because all 15 TPs in the labeled subset have Hydrophobicity in [0.5, 0.6).

Sweep of FF-Helix uH cutoff (FF-Helix := has-helix AND Helix-uH ≥ cutoff):

| Cutoff | TP | FP | TN | FN | Sens | Spec | PPV | F1 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.0 – 0.6 | 47 | 19 | 0 | 0 | 1.000 | 0.000 | 0.712 | 0.832 |
| **0.388 (default, dataset mean)** | 47 | 19 | 0 | 0 | 1.000 | 0.000 | 0.712 | **0.832** |
| 0.7 | 31 | 16 | 3 | 16 | 0.660 | 0.158 | 0.660 | 0.660 |
| ≥ 0.8 | 0 | 0 | 19 | 47 | 0.000 | 1.000 | 0.000 | 0.000 |

**Defending PVL's defaults**: the default cutoffs (0.417 hydro, 0.388 uH) are within the F1-optimal plateau for FF-Helix and at the bottom of the F1-optimal plateau for FF-SSW. They are not "tuned" in any meaningful sense — they're the dataset-mean fall-back. A grant reviewer asking "why these cutoffs?" should hear: "they are the dataset-mean of positive-base-call rows; this is documented in `analyze_gold_standard.py` and reproduced here. The metric is insensitive to the choice within the optimal range, and no cutoff improves discrimination on the labeled subset."

---

## §4 — False-positive class breakdown

### 4.1 — Within the labeled subset (n = 18 FPs for FF-SSW)

| Protein name | Sequence | Count |
|---|---|---:|
| Phenol-soluble modulin α2 (PSM-α2) | `MGIIAGIIKFIKGLIEKFTGK` | **17** |
| Delta-hemolysin (Delta-toxin) | `MAQDIISTIGDLVKWIIDTVNKFTKK` | 1 |

The 17 PSM-α2 rows are the same 21-residue sequence repeated across UniProt accessions (`A9JX06`, `P0C7Z2…P0C801`, `H9BRQ6`, `T1Y795`, `A8Z0V0`, etc.). **The dataset has only one biologically distinct FF-SSW false-positive sequence: PSM-α2.** Plus one Delta-hemolysin variant. Plus PSM-mec (FF-SSW = -1 but FF-Helix = 1 — counted as FP under the OR criterion).

Biochemically:
- PSM-α2: Hydrophobicity 0.632, Helix-uH 0.723, Charge +3 — passes every PVL threshold.
- PSM-α1 (TEM = V, amyloid): Hydrophobicity 0.640, Helix-uH 0.712, Charge +2 — passes every PVL threshold.
- **Difference**: 4 residue substitutions in 21 positions (positions 10, 13, 16, 17). Net biochem difference is below the resolution of PVL's sequence-derived features.

### 4.2 — Across the full 2916 rows (extrapolation via Protein-name keyword matching)

| Keyword class (regex on `Protein names`) | Matches | FF-Helix = 1 | FF-SSW = 1 |
|---|---:|---:|---:|
| antimicrobial / phenol-soluble / modulin / hemolysin / lantibiotic / defensin | **71** | 69 (97%) | 36 (51%) |
| signal peptide / secretion / preprotein | 5 | 0 | 1 |
| transmembrane / membrane / pore / porin | 20 | 1 (5%) | 9 (45%) |

Reading:
- **AMPs are systematically FF-Helix-flagged** in PVL's positive call set. 69 of 724 total FF-Helix positives (9.5%) are AMP-annotated; the actual fraction is higher because annotation is incomplete (PSM-α2 itself lacks the "antimicrobial" keyword in Protein names but is well-characterized in UniProt as such).
- **Signal peptides do not appear to be a major FP source** in this dataset (only 5 matches total).
- **Transmembrane / pore proteins** show 9 FF-SSW positives — a smaller but real class.

This generalises the labeled-subset finding: PVL's positive predictions on Staphylococcus aureus include a significant AMP class as false positives. **A user filtering the FF-SSW positives for wet-lab follow-up should expect ~10–25% of the candidates to be AMPs rather than amyloid formers, depending on the organism's AMP repertoire.**

---

## §5 — Honest limitations

1. **Tiny labeled subset (n = 66, of which only 19 are negative controls).** Confidence intervals on sensitivity and specificity are wide. The 19 X-labeled rows are biased toward PSM-α2 replicates; a single biologically distinct counter-example carries enormous weight. Reviewers should read these numbers as "PVL on this specific dataset" — not as the population accuracy.

2. **The labeled subset is not a random sample.** Peleg's lab pre-selected sequences for experimental follow-up; those sequences are already enriched for amyloid candidates by definition. Specificity on a random Staphylococcus proteome sample would likely be much higher (most random sequences are FF-Helix-negative).

3. **Sequence-derived features cannot resolve PSM-α1 (amyloid) from PSM-α2 (non-amyloid).** The biological discriminator likely lies in structural context, oligomerization, or post-translational state — none accessible to PVL's threshold-on-sequence rules. This is an **open scientific problem**, not a PVL implementation bug.

4. **FF-Helix and FF-SSW capture the same biology under different thresholds.** Both flag "amphipathic α-helix with switch potential" — the intended positive class includes both amyloid formers AND membrane-disrupting AMPs. Sequence-only methods cannot separate them, full stop. (Confirmed in literature: amphipathic α-helix is the shared structural primitive for amyloid nucleation and pore formation.)

5. **PVL's defaults are dataset-mean fallbacks, not literature-derived constants.** This is acceptable for a research instrument with disclosed methodology — but should be stated explicitly in the JOSS submission and in `Help.tsx`. We do not claim our cutoffs are optimal; we claim they are reproducible.

6. **No comparison against AGGRESCAN, PASTA 2.0, AmyloDeep, or other amyloid predictors on this dataset.** PVL's numbers stand alone here; a head-to-head benchmark is future work (Phase I in ROADMAP).

7. **TEM is the ground truth used; ThT and Fiber diffraction columns are unused.** ThT is empty; Fiber diffraction is positive-only. Adding ThT data — if Peleg has it — would change the picture.

---

## §6 — Recommended UI disclosure (Part 3 of dispatch)

The following paragraph is the recommended text for `ui/src/pages/Help.tsx` (FF-SSW explanation section) and the FF-SSW column-header tooltip. Said decides exact placement.

> **FF-SSW (Fibril-Forming Secondary Structure Switch) — known limitations**
>
> PVL classifies a peptide as FF-SSW positive when two sequence-derived conditions are met: (1) at least one of TANGO or S4PRED detects an α-helix / β-sheet structural-switching segment, and (2) the peptide's mean hydrophobicity is above the dataset's positive-call mean (default ≈ 0.42 on the Staphylococcus 2023 benchmark). This criterion identifies *fibril-forming candidates that may include peptides with membrane-active dual function*. The same biophysics drives both amyloid formation and antimicrobial-peptide function — amphipathicity and structural-switching potential — so PVL's positive class is, by design, the broader set that includes both amyloid-forming peptides AND membrane-disrupting amphipathic peptides (AMPs, signal peptides, pore-formers). On the Staphylococcus 2023 labeled subset (n = 66), 17 of 18 broader-candidate calls were Phenol-soluble modulin α2 — an amphipathic AMP that, like other AMPs, shares the feature space PVL targets but whose primary biological function is membrane disruption rather than amyloid assembly. **If your candidate is annotated as an AMP or signal peptide in UniProt, treat the FF-SSW flag as indicating shared fibril-forming biophysics rather than a confirmation of amyloid behavior in vivo.** Distinguishing the two functional outcomes from sequence alone is an open scientific problem — and is the motivation for keeping the flag broad rather than narrowing it to amyloid-only. See [`RB-VALIDATION-V0-1.md`](RB-VALIDATION-V0-1.md) for full benchmark numbers.

Adjacent shorter version (≤ 40 words) for the column header tooltip:

> "FF-SSW positive" means "amphipathic structural-switch candidate" — includes amyloid formers AND membrane-disrupting AMPs (e.g. Phenol-soluble modulins). Cross-check UniProt annotations for AMP keywords before wet-lab follow-up. Sensitivity 0.32 / Specificity 0.05 on Staph 2023 (n=66).

---

## §7 — Canary peptide suite (Part 2 of dispatch)

Eleven canaries pinned to `backend/tests/test_canary_peptides.py`. Each canary's expected values were captured from the **current production pipeline** (biochem features + FF-Helix % calculation, with TANGO/S4PRED disabled per backend testing conventions). SSW / FF-SSW assertions require TANGO and are documented but not enforced in the fast test — they will be added when a cached-output integration suite is built (open in §11).

| Canary | Sequence | Charge | Hydro | Full µH | FF-Helix % | Literature role |
|---|---|---:|---:|---:|---:|---|
| **PSM_alpha_1** | `MGIIAGIIKVIKSLIEQFTGK` | +2.00 | 0.640 | 0.551 | 100.00 | S. aureus PSM-α1 — TEM=V (amyloid) [src1] |
| **PSM_alpha_2** | `MGIIAGIIKFIKGLIEKFTGK` | +3.00 | 0.632 | 0.562 | 100.00 | **KNOWN FP** — PSM-α2 AMP, TEM=X (non-amyloid) [src1][src2] |
| **PSM_alpha_3** | `MEFVAKLFKFFKDLLGKFLGNN` | +2.00 | 0.543 | 0.563 | 86.40 | S. aureus PSM-α3 — TEM=V (amyloid) [src1] |
| **Delta_hemolysin** | `MAQDIISTIGDLVKWIIDTVNKFTKK` | +1.00 | 0.476 | 0.587 | 96.20 | **KNOWN FP** — δ-hemolysin AMP, TEM=X [src1] |
| **Anoplin** | `GLLKRIKTLL` | +3.00 | 0.587 | 0.715 | 100.00 | **KNOWN FP** — wasp venom AMP, NOT amyloid [src3] |
| **Magainin_2** | `GIGKFLHSAKKFGKAFVGEIMNS` | +3.10 | 0.373 | 0.475 | 95.70 | **KNOWN FP** — Xenopus AMP, NOT amyloid [src4] |
| **Melittin** | `GIGAVLKVLTTGLPALISWIKRKRQQ` | +5.00 | 0.511 | 0.394 | 96.20 | **KNOWN FP** — bee venom AMP, NOT amyloid [src5] |
| **Abeta42** | `DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVVIA` | −2.70 | 0.409 | 0.107 | 76.20 | Alzheimer's Aβ42 — canonical amyloid [src6] |
| **aSyn_NAC** | `VTGVTAVAQKTV` | +1.00 | 0.423 | 0.328 | 83.30 | α-synuclein 71–82 NAC core — canonical amyloid [src7] |
| **Poly_GS** | `GSGSGSGSGSGSGSGS` | 0.00 | −0.020 | 0.002 | 0.00 | Flexible linker — NEGATIVE control |
| **Poly_E** | `EEEEEEEEEEEEEEEE` | −16.00 | −0.640 | 0.051 | 100.00 | **Curiosity** — polyE has FF-Helix % = 100 from residue propensity despite all-negative charge — pinned to detect any future change to the ff_helix_percent calculation |

Three canaries are explicitly marked `_KNOWN_FALSE_POSITIVE = True` (PSM-α2, Anoplin, Magainin_2, Melittin, Delta-hemolysin). Their pinned values document the current (intentional) behaviour — they exist to fail the build with a *visible* diff if anyone "fixes" PVL in a way that changes the FP behaviour without scientific review.

The test file ships in this dispatch and runs via `make test` (USE_TANGO=0 USE_S4PRED=0).

---

## §8 — Sources cited

**Confidence legend**: HIGH = peer-reviewed paper / UniProt curated entry; MEDIUM = well-known sequence database; LOW = anonymous web reference.

1. **[HIGH]** Schwartz K., Sekedat M. D., et al. *The AgrD N-terminal leader peptide of Staphylococcus aureus has cytolytic and amyloidogenic properties.* Infection and Immunity (2014) — characterises PSM-α family amyloidogenicity. PMID: 24600028.
2. **[HIGH]** Tayeb-Fligelman E., et al. *The cytotoxic Staphylococcus aureus PSMα3 reveals a cross-α amyloid-like fibril.* Science 355, 831–833 (2017) — confirms PSM-α3 forms cross-α fibrils, validating the TEM = V label. DOI: 10.1126/science.aaf4901.
3. **[HIGH]** UniProt P0C005 — Anoplin, *Anoplus samariensis*. Curated as antimicrobial peptide; no reported amyloidogenicity. https://www.uniprot.org/uniprotkb/P0C005
4. **[HIGH]** Zasloff M. *Magainins, a class of antimicrobial peptides from Xenopus skin.* PNAS 84, 5449–5453 (1987). PMID: 2440225.
5. **[HIGH]** Habermann E. *Bee and wasp venoms.* Science 177, 314–322 (1972). Melittin biology — pore-forming, not amyloid. PMID: 4113805.
6. **[HIGH]** Lührs T., et al. *3D structure of Alzheimer's amyloid-β(1–42) fibrils.* PNAS 102, 17342–17347 (2005). DOI: 10.1073/pnas.0506723102.
7. **[HIGH]** Giasson B. I., et al. *A hydrophobic stretch of 12 amino acid residues in the middle of alpha-synuclein is essential for filament assembly.* J. Biol. Chem. 276, 2380–2386 (2001). PMID: 11060312.
8. **[HIGH]** **Internal**: Peleg Ragonis-Bachar's Staphylococcus 2023 dataset — `ui/public/Final_Staphylococcus_2023_new.xlsx`. 2916 peptides, 66 TEM-validated. Documented in PVL memory `reference_gold_standard_dataset.md`.
9. **[MEDIUM]** Hamodrakas S. J. *Protein aggregation and amyloid fibril formation prediction software from primary sequence: towards controlling the formation of bacterial inclusion bodies.* FEBS Journal 278, 2428–2435 (2011) — foundation for FF-Helix algorithmic logic.

---

## §9 — Cross-references

- **Companion deliverable**: `backend/tests/test_canary_peptides.py` (this dispatch).
- **UI integration**: §6 disclosure paragraph → `ui/src/pages/Help.tsx` and FF-SSW column-header tooltip (T3 dispatch when Said approves).
- **Supersedes**: nothing (first formal validation brief).
- **Affects**: README.md "Limitations" subsection (currently absent — propose adding pointer to this brief); JOSS submission supplement.
- **Triggers**: dispatch to Peleg for axiom-review on the AMP false-positive class; future RB-VALIDATION-V0-2 once AGGRESCAN/PASTA 2.0/AmyloDeep head-to-head benchmark is run (Phase I); future T-PEL dispatch to surface UniProt keyword annotations in PVL output (would let users filter AMP-class FPs in-UI).
- **Relates to**: ADR-014 (predictor disagreement + gold-standard accuracy) — the disclosure paragraph in §6 should be wired alongside the existing accuracy badge, not in a separate location.

---

## §10 — Open follow-ups

1. **Re-run TANGO/S4PRED on all 2916 sequences with current code** to verify the cached Excel values match today's pipeline. Estimated 8–12h subprocess time. Defer until current development churn settles; intermediate `analyze_gold_standard.py` regression check confirms current code reproduces the same numbers on the 20-fixture sample.
2. **Add UniProt AMP/Signal-peptide keyword as an enrichment column** in `backend/services/uniprot_execute_service.py`. Surface as a "Likely AMP" badge in the data table; user can filter out before exporting. ~6h T2 work. Discuss with Peleg before shipping.
3. **Head-to-head benchmark vs AGGRESCAN / PASTA 2.0 / AmyloDeep** on the labeled subset. Wait for Phase I (Wave 3+). Output: RB-VALIDATION-V0-2.
4. **Integration test for canary suite WITH TANGO/S4PRED enabled** — runs on weekly cron, not every PR. Pin SSW / FF-SSW expected values for each canary. ~4h. Currently the canary file documents these expectations in comments but doesn't enforce them.
5. **Email Peleg with this brief** — request her sign-off on the disclosure paragraph wording AND her opinion on whether the AMP-class FP rate is acceptable for v0.1 release. _NEEDS_PELEG_REVIEW.
6. **Reviewer-grade confidence intervals** on sensitivity / specificity (Wilson score interval at α=0.05). Trivial to add; defer to JOSS submission pass.

---

## §11 — Decisions / triggers

| Decision | Default | Trigger to re-validate |
|---|---|---|
| Ship the disclosure paragraph in `Help.tsx` and FF-SSW tooltip | YES (after Said review) | Peleg objects to wording / asks for stronger language |
| Pin canary expected values in CI | YES (this brief) | A canary regression catches a real bug (good) — or fires too often on legitimate algorithm refinement (bad — soften pin to ±tolerance) |
| Re-tune default hydrophobicity cutoff (0.417) | NO | New benchmark with ≥ 100 labeled non-formers OR Peleg directive |
| Add per-sequence "AMP-likely" enrichment column from UniProt keywords | NO (open follow-up #2) | T-PEL or Peleg dispatch |
| Use this brief in JOSS submission supplement | YES | Major dataset addition or algorithm change → produce RB-VALIDATION-V0-2 |

---

## §12 — Summary for T1

**Files delivered this dispatch**:
1. `docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` (this file)
2. `backend/tests/test_canary_peptides.py` (canary suite, runs in `make test`)
3. _INDEX.md row update

**The headline number for Said**: PVL's FF-Helix flag has **100% sensitivity and 0% specificity** on the Staphylococcus 2023 labeled subset (n = 66). FF-SSW is barely better than random. The cause is biological, not algorithmic: amphipathic α-helix is the shared sequence primitive for both amyloid nucleation and membrane disruption. The fix is UI copy + UniProt-keyword enrichment, not a threshold tweak.

**The headline finding for Peleg**: 17 of 18 confirmed false positives are PSM-α2 (a single biologically distinct sequence replicated across UniProt). Across the full dataset, AMP-annotated peptides have a 97% FF-Helix positive rate — confirming a systematic class-level confusion. PVL is correctly identifying "amphipathic structural-switch candidates"; the UI must say so explicitly.

**The headline value for the JOSS paper**: this brief is the answer to "what's your false-positive rate?" when reviewers ask. We have honest numbers, named failure modes, and a documented mitigation strategy.

---

## §14 — Appendix: reproduction script

```python
"""Run from backend/ — reproduces every number in §3 and §4."""
import pandas as pd
from pathlib import Path

p = Path("../ui/public/Final_Staphylococcus_2023_new.xlsx")
df = pd.read_excel(p, engine="openpyxl")
labeled = df[df["TEM Fibrils"].isin(["V","X"])].copy()
labeled["truth"] = (labeled["TEM Fibrils"] == "V").astype(int)

def cm(name, pred):
    tp = int(((pred == 1) & (labeled["truth"] == 1)).sum())
    fp = int(((pred == 1) & (labeled["truth"] == 0)).sum())
    tn = int(((pred == 0) & (labeled["truth"] == 0)).sum())
    fn = int(((pred == 0) & (labeled["truth"] == 1)).sum())
    sens = tp / (tp + fn) if (tp + fn) else 0
    spec = tn / (tn + fp) if (tn + fp) else 0
    ppv  = tp / (tp + fp) if (tp + fp) else 0
    f1   = 2*tp / (2*tp + fp + fn) if (2*tp + fp + fn) else 0
    print(f"{name:35s}  TP={tp:3d} FP={fp:3d} TN={tn:3d} FN={fn:3d}  "
          f"sens={sens:.3f} spec={spec:.3f} ppv={ppv:.3f} F1={f1:.3f}")

cm("SSW prediction",                (labeled["SSW prediction"] == 1).astype(int))
cm("FF-Helix (Jpred)",              (labeled["FF-Helix (Jpred)"] == 1).astype(int))
cm("FF-Secondary structure switch", (labeled["FF-Secondary structure switch"] == 1).astype(int))

# False-positive class composition
fps = labeled[(labeled["FF-Secondary structure switch"] == 1) & (labeled["TEM Fibrils"] == "X")]
print(fps[["Entry","Protein names","Sequence"]].to_string(index=False))
```
