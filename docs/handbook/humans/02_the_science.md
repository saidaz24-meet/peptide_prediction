# The science behind PVL

> **Read this first.** PVL (Peptide Visual Lab) is a research instrument, not a feature collection. Every number it shows comes from a published algorithm or a biochemical formula with a citation, run deterministically. This page explains what each predictor does, exactly where in the code it lives, and — just as important — what each result does **not** mean. It is the readable companion to the citation-ready [`PAPER_METHODS_REFERENCE.md`](../../active/PAPER_METHODS_REFERENCE.md); where the two disagree, the code (cited here by `file:line`) is authoritative and the discrepancy is flagged.
>
> For how PVL compares to other tools in the field, see [the landscape survey](../research/01_landscape.md). For where each module lives in the tree, see the [repo map](../agents/01_repo_map.md).

## Contents

- [1. The four-class system — what each class means, what it does NOT mean](#1-the-four-class-system--what-each-class-means-what-it-does-not-mean)
- [2. TANGO — aggregation propensity](#2-tango--aggregation-propensity)
- [3. S4PRED — secondary structure prediction](#3-s4pred--secondary-structure-prediction)
- [4. Biochemistry — Fauchère-Pliska, Eisenberg μH, charge at pH 7.4](#4-biochemistry--fauchère-pliska-eisenberg-μh-charge-at-ph-74)
- [5. FF-Helix — the first candidacy classifier](#5-ff-helix--the-first-candidacy-classifier)
- [6. SSW — the structural switch zone](#6-ssw--the-structural-switch-zone)
- [7. FF-SSW — the second candidacy classifier](#7-ff-ssw--the-second-candidacy-classifier)
- [8. The axioms (and why they matter)](#8-the-axioms-and-why-they-matter)
- [9. AlphaFold + Mol* — the 3D overlay](#9-alphafold--mol--the-3d-overlay)
- [10. UniProt + ChEMBL — peptide metadata](#10-uniprot--chembl--peptide-metadata)
- [11. The deterministic-output guarantee](#11-the-deterministic-output-guarantee)
- [12. Known scientific limitations](#12-known-scientific-limitations)
- [Validation](#validation)
- [References](#references)

---

## 1. The four-class system — what each class means, what it does NOT mean

PVL assigns every peptide up to four **independent boolean flags**. They are not five mutually-exclusive buckets; they are two base classes, each with a fibril-formation **candidacy** layer nested inside it:

| Class | Subset of | Computed from | Flag field |
|---|---|---|---|
| **Helix** | — | S4PRED secondary structure | `s4predHelixPrediction` |
| **FF-Helix** | ⊆ Helix | Helix **AND** helix-segment hydrophobic moment (μH) ≥ threshold | `ffHelixFlag` |
| **SSW** | — | TANGO ∪ S4PRED structure-switch detection | `sswPrediction` |
| **FF-SSW** | ⊆ SSW | SSW **AND** mean hydrophobicity ≥ threshold | `ffSswFlag` |

The two subset relations are enforced as hard axioms in code (see §8). The field names above are the canonical camelCase keys in the API contract (`backend/schemas/api_models.py:74,154,161,171`).

**What "FF-Helix" and "FF-SSW" mean.** They are *candidacy* classifiers — they flag a peptide whose helix or switch region carries the amphipathic signature associated with fibril formation in the α-sheet / chameleon-amyloid framing of Ragonis-Bachar et al. 2022[^rb2022] and the helical-amyloid lineage of Hamodrakas 2007[^hamodrakas]. "FF" stands for **fibril-forming candidate**, decided from sequence-derived structure and hydrophobicity.

**What they do NOT mean.** A positive FF flag is **not** an experimental claim that the peptide forms fibrils. PVL has run no wet-lab assay. It is **not** a probability or an affinity. It is **not** a statement about kinetics, concentration, or conditions. The base classes are equally narrow: "Helix" means *S4PRED predicted at least one qualifying helical segment*, not that an experimental helix exists; "SSW" means *two sequence predictors flagged a helix/β indecision zone*, not that a conformational switch was observed. PVL surfaces predictions to prioritise candidates for experiment — nothing more. This framing is fixed in ADR-001 (`docs/active/DECISIONS.md`).

The flag convention is uniform across the pipeline: **`1`** = candidate / positive, **`-1`** = data present but not a candidate, **`null`** = the provider produced no data. The value `-1` is a *real verdict*, never a "missing data" sentinel — that is reserved exclusively for JSON `null` (see §11).

---

## 2. TANGO — aggregation propensity

**What it does (plain English).** TANGO is a statistical-mechanics algorithm that reads a bare amino-acid sequence and computes, residue by residue, the propensity to sit in a β-aggregated (cross-β) conformation, alongside β-turn and α-helix occupancy. It models the partition function over conformational states and reports the population of the aggregating state as a percentage. It answers exactly one question — *how aggregation-prone is this stretch?* — and it answers it from sequence alone.[^tango]

**Where in PVL.** TANGO is the original Fortran binary, run as a subprocess one peptide per call. The invocation is built in `backend/tango.py:287`:

```
"$BIN" <id> nt="N" ct="N" ph="7" te="298" io="0.1" tf="0" seq="<SEQ>"
```

That is: N-/C-terminal protection off, **pH 7**, temperature **298 K**, ionic strength **0.1 M**. (Note the divergence: TANGO runs at `ph="7"`, while PVL's separate charge calculation uses pH 7.4 — see §4. `PAPER_METHODS_REFERENCE.md` §1.1 states pH 7.4 for TANGO; the binary call says 7. Flag for the scientific lead.) Runs are parallelised at most 4-wide (`tango.py:255`) with a batch timeout of `max(120, 120 + N)` seconds (`tango.py:489`). Sequences shorter than 5 aa are never submitted (`tango.py:207`). Output parsing and the per-residue β-aggregation / helix / turn curves land in `process_tango_output` (`tango.py:888`). The aggregation-hotspot threshold — residues above which a stretch counts as an aggregation-prone region — defaults to **5.0%** (`settings.DEFAULT_AGG_THRESHOLD`, `backend/config.py:373`), following the TANGO publication default; this 5% value is internally flagged for citation justification (`PELEG-Q-FIX-012`).

**What it does NOT mean.** TANGO output is aggregation propensity, **not fibril formation**. PVL never claims TANGO predicts fibrils — it folds the β-aggregation signal into the SSW and FF-SSW classes and onto the 3D overlay, but the aggregation score stands on its own (`SPECIALS.md` §2).

---

## 3. S4PRED — secondary structure prediction

**What it does (plain English).** S4PRED predicts three-state secondary structure — helix (H), β-strand (E), coil (C) — for each residue, from a **single sequence** (no multiple-sequence alignment required). It is a deep semi-supervised model: an **ensemble of five BiLSTM networks** whose per-residue softmax outputs are averaged into calibrated probabilities P(H), P(E), P(C).[^s4pred] In PVL it is the **primary** helix predictor (PSIPRED was used in early prototypes and removed; ADR-001/ADR-003).

**Where in PVL.** Availability and the 5-model ensemble are checked in `backend/s4pred.py:55-61` (`weights_1.pt … weights_5.pt`). Inference runs through a single batched forward pass, `predict_sequences_batched` (`s4pred.py:541`), with a per-sequence fallback loop if the batch fails (`s4pred.py:567`); single-sequence Quick Analyze stays bit-equivalent by sharing that path. Per-residue P(H)/P(E)/P(C) curves are carried out at `s4pred.py:375-376,549-551`. Helical **segments** are detected by `_get_secondary_structure_segments` (`s4pred.py:131`) using the Peleg-canonical thresholds in `config.py`: a residue counts as helical at P(H) ≥ **0.5** (`MIN_S4PRED_SCORE`, `config.py:198`), a segment needs ≥ **5** contiguous residues (`MIN_SEGMENT_LENGTH`, `config.py:201`) and may bridge a gap of ≤ **3** (`MAX_GAP`, `config.py:204`). "Helix %" is the **segment-based** coverage (`_get_segment_percentage`, `s4pred.py:223`), which ADR-003 fixes as the single canonical definition of helix percentage in the UI — never a probability mean.

**Length cap.** S4PRED is only run on sequences ≤ **40 aa** (`S4PRED_MAX_LENGTH`, `config.py:216`); longer sequences are skipped with a `s4pred_skipped_long_seq` warning and their S4PRED fields stay `null`. Peleg set 40 aa as the pipeline ceiling (2026-06-03): above it, the helix / SSW logic becomes a surface-vs-structure problem and loses meaning.

**Citation discrepancy (resolved).** The repository README acknowledgements reference a "Moffat et al. 2022" form of the S4PRED reference. The **canonical** S4PRED paper is the 2021 single-sequence work, Moffat & Jones, *Bioinformatics* **37**(21):3744–3751, doi:10.1093/bioinformatics/btab491[^s4pred]. Cite the 2021 `btab491` reference; the 2022 string in the README should be reconciled before paper submission.

**What it does NOT mean.** A predicted helix is a *prediction*, calibrated but fallible, and weakest exactly where PVL operates (short peptides — see §12).

---

## 4. Biochemistry — Fauchère-Pliska, Eisenberg μH, charge at pH 7.4

**What it does (plain English).** Three sequence-only biochemical descriptors feed the FF gates and the dashboard.

- **Hydrophobicity** — the per-residue mean on the **Fauchère & Pliska 1983** octanol/water partition scale[^fp]. The 20-residue table is hard-coded in `backend/biochem_calculation.py:5-26` (e.g. W = +2.25, R = −1.01), and the mean is `hydrophobicity()` (`biochem_calculation.py:103`). Range roughly −1.0 to +2.5 (`SPECIALS.md` §1). This value drives the **FF-SSW** gate.
- **Hydrophobic moment (μH)** — the **Eisenberg, Weiss & Terwilliger 1982** helical hydrophobic moment[^eisenberg], a measure of a helix's amphipathicity: it sums the Fauchère-Pliska values as vectors stepped by a fixed angle around the helical wheel and takes the magnitude, normalised by length. The formula `μH = √(Σ Hᵢcos(iδ))² + (Σ Hᵢsin(iδ))² / n` is implemented in `hydrophobic_moment()` (`biochem_calculation.py:52`) with **δ = 100°** (α-helix geometry) by default. A separate "β μH" reuses the same routine with **angle = 160°** (`backend/services/dataframe_utils.py:448`). *Note: the docstring says 180° for β-sheet but the code passes 160° — code wins; flag for review.* μH is computed over the supplied sequence or **helix segment**, not via a fixed 11-residue sliding window (`PAPER_METHODS_REFERENCE.md` §1.6 describes an 11-residue window that the code does not implement). The helix-segment μH drives the **FF-Helix** gate.
- **Net charge at pH 7.4** — `total_charge()` (`biochem_calculation.py:80`) sums fixed contributions: K, R = +1; D, E = −1; **H = +0.1** (partial protonation, pKa ≈ 6.0). Sign is biologically meaningful and preserved (do not abs(); `PELEG-Q-FIX-022`).

**Where in PVL.** Orchestrated in `backend/calculations/biochem.py:calculate_biochemical_features` (`Charge`, `Hydrophobicity`, `Full length uH`, helix-segment μH, β μH) and exposed as `charge`, `hydrophobicity`, `muH` in the API contract.

**What it does NOT mean.** These are first-order sequence descriptors. Charge uses a fixed reduced pKa set, not full Henderson-Hasselbalch titration; hydrophobicity ignores position and environment.

---

## 5. FF-Helix — the first candidacy classifier

**What it does (plain English).** FF-Helix flags a peptide whose predicted helix is *amphipathic enough* to be a fibril-forming candidate. A peptide is **FF-Helix** if **both**: (1) S4PRED called it Helix (§3), **and** (2) the hydrophobic moment of its helix segment(s) clears a μH threshold. The biological intuition (Hamodrakas 2007[^hamodrakas]; Ragonis-Bachar 2022[^rb2022]): an amphipathic helix can self-associate and convert toward the β/α-sheet packing of a fibril.

**Where in PVL.** The per-peptide reference is `compute_4category_flags` (`backend/auxiliary.py:398-409`); the vectorised batch equivalent is `apply_ff_flags` (`dataframe_utils.py:374-407`) — the two must agree exactly (ADR-001). The μH threshold is **dataset-derived by default**: the mean helix-segment μH over the helix-positive rows of the uploaded cohort (`compute_dataset_ff_thresholds`, `dataframe_utils.py:92`). For a single sequence there is no cohort, so it falls back to the Peleg constant **0.388** (`PELEG_DEFAULT_HELIX_UH_THRESHOLD`, `config.py:185`). In custom/recommended threshold mode the user override defaults to **0.5** (`DEFAULT_MU_H_CUTOFF`, `config.py:360`).

> **Discrepancy to flag for Peleg.** `PAPER_METHODS_REFERENCE.md` §1.3 defines FF-Helix as "S4PRED %H ≥ threshold AND **mean hydrophobicity ≥ 0.7**". The **code** gates on **hydrophobic moment (μH)**, not mean hydrophobicity, with a default of 0.388 (single) / dataset-mean (batch) / 0.5 (custom) — not 0.7. The code is authoritative; the paper text needs reconciling.

A distinct sequence-only **"FF-Helix %"** metric also exists — a Chou-Fasman-style helix-propensity coverage (`ff_helix_percent`, `auxiliary.py:60`, propensity table `auxiliary.py:21`, window 6 / threshold 1.0 at `config.py:159,162`). This is a *descriptor*, not the classification flag; do not confuse it with `ffHelixFlag`.

**What it does NOT mean.** Because FF-Helix needs **both** a predicted helix and amphipathicity, a non-amphipathic single-domain helix will **not** flag, even if it is genuinely helical. Absence of FF-Helix is not absence of helicity.

---

## 6. SSW — the structural switch zone

**What it does (plain English).** SSW (secondary-structure switch) marks peptides containing a region of *conformational indecision* — where helical and β-aggregating propensities coincide, the hallmark of a chameleon / switch sequence that can flip between folds (the conceptual basis of AMYLPRED-style switch zones, Hamodrakas 2007[^hamodrakas]; `backend/consensus.py:1-9`).

**Where in PVL.** SSW is a **canonical OR over the two predictors**, computed entirely from prediction, **never from experimental data**:

- **TANGO-side SSW**: from TANGO's own per-residue helix and β tracks, helix and β segments are found and overlapped (`find_secondary_structure_switch_segments`, `auxiliary.py:278`; driven in `tango.py:836-856`).
- **S4PRED-side SSW**: from S4PRED's P(H) and P(E) curves, helix and β segments are overlapped (`analyse_s4pred_result`, `s4pred.py:342`).
- **Unified SSW** = TANGO-SSW **OR** S4PRED-SSW: `ssw_pos_mask = (tango == 1) | (s4pred == 1)` (`dataframe_utils.py:291`), written to the `SSW prediction (unified)` column (`dataframe_utils.py:321`) and serialised as `sswPrediction`. The combine rule is `compute_ssw_combined_flag` (`auxiliary.py:338`): positive if **either** predictor says yes; `-1` if at least one has data and neither is positive; `null` if neither ran. The raw per-tool verdict is preserved as `tangoSswPrediction` for the UI's per-predictor breakdown (`api_models.py`).

This unified-OR replaced an earlier inconsistent definition (ISSUE-032 fix). The framing — *symmetry of treatment of the two predictors, not a subset relation* — is Peleg's (2026-06-03).

**What it does NOT mean.** SSW is a union of two **predictors**, not an experimental observation of switching, and not a consensus that both tools agree (either alone suffices).

---

## 7. FF-SSW — the second candidacy classifier

**What it does (plain English).** FF-SSW narrows SSW to fibril-forming candidates: a peptide is **FF-SSW** if it is **SSW AND** its **mean Fauchère-Pliska hydrophobicity** clears a threshold — a hydrophobic switch zone is more likely to drive self-assembly.

**Where in PVL.** `compute_4category_flags` (`auxiliary.py:413-424`) and vectorised `apply_ff_flags` (`dataframe_utils.py:307-314`). Note the deliberate asymmetry with FF-Helix: **FF-Helix gates on μH; FF-SSW gates on plain hydrophobicity** (`auxiliary.py:380` documents this explicitly). The hydrophobicity threshold defaults to the cohort mean over SSW-positive rows (`dataframe_utils.py:92`); single-sequence fallback is **0.417** (`PELEG_DEFAULT_HYDRO_THRESHOLD`, `config.py:180`); custom override default **0.5** (`DEFAULT_HYDRO_CUTOFF`, `config.py:363`).

**What it does NOT mean.** Same caveats as FF-Helix: it is candidacy from sequence, not an experimental fibril claim.

---

## 8. The axioms (and why they matter)

Two subset relations must hold for the classification to be coherent:

```
ffHelixFlag == 1  ⇒  s4predHelixPrediction == 1
ffSswFlag   == 1  ⇒  sswPrediction        == 1
```

You cannot be a fibril-forming-helix candidate without being a helix; you cannot be a fibril-forming-switch candidate without being a switch. These are enforced **twice** — defence in depth:

1. **By construction** in `apply_ff_flags`: the FF gate is computed from the *same* mask as the base class, so a positive FF flag implies a positive base flag (`dataframe_utils.py:307-322`).
2. **At the serialization boundary** in `_enforce_ff_axioms` (`backend/services/normalize.py:489-529`): every row is re-checked just before it becomes JSON. If an upstream bug ever emits `ffSswFlag == 1` with `sswPrediction != 1`, the FF flag is forced to `-1` and a structured `ff_*_axiom_violation` warning is logged. **A researcher never sees "FF-SSW candidate" on a peptide the data says is not SSW.**

Why it matters: in a scientific tool, a silently incoherent classification is worse than a loud error. The axiom guard guarantees the [contract](../agents/02_contracts_and_invariants.md) holds even when upstream code is broken (ADR-001/ADR-003).

---

## 9. AlphaFold + Mol* — the 3D overlay

**What it does (plain English).** For peptides with a UniProt accession, PVL fetches the **AlphaFold**-predicted monomer structure[^alphafold] and renders it in **Mol\***[^molstar], a consortium-maintained (RCSB PDB / EBI / ETH) web viewer. The predictions from the sections above — TANGO aggregation peaks, S4PRED helix segments, FF-Helix and SSW zones — are painted **directly onto the 3D structure**, so a researcher can see *where* on the fold the flagged regions sit.

**Where in PVL.** AlphaFold DB fetch: `ui/src/lib/alphafold.ts` (`fetchAlphaFoldEntry`), consumed by `ui/src/components/BackboneViewer.tsx:148` and the main `Mol3DViewer.tsx`. Overlay painting helpers live in `ui/src/lib/molstarOverlays.ts`. Mol\* is the canonical and only 3D layer (ADR-008) — pLDDT confidence is surfaced alongside the structure.

**Residue colour code (verified against code).** The four-class colours come from CSS tokens in `ui/src/index.css` and the SSW residue constant in `ui/src/lib/sswColor.ts`:

| Class | Colour in code | Source |
|---|---|---|
| Helix | **blue** `hsl(211 96% 68%)` (chart `#0072B2`) | `index.css:54`, `chartConfig.ts:47` |
| FF-Helix | **green** `hsl(142 71% 45%)` | `index.css:70` |
| SSW (per-residue switch highlight) | **magenta `#E040FB`** (chameleon convention) | `sswColor.ts:17` |
| SSW (classification badge) | **blue** `hsl(211 80% 50%)` | `index.css:68` |
| FF-SSW | **dark green** `hsl(142 58% 36%)` (same family as FF-Helix) | `index.css:72` |

The magenta `#E040FB` SSW residue colour was explicitly confirmed by Peleg (ADR-021, OQ5, 2026-06-29) and is applied consistently across plots, badges, the Mol\* viewer, the sequence track, and exports. **One correction for accuracy:** FF-SSW renders as **dark green** (a deeper shade of the FF-Helix green family), **not red** — there is no red four-class residue colour in the code. The Mol\* panel title was renamed from "AlphaFold-predicted structure" to "Predicted Secondary Structure" per Peleg's 2026-06-18 decision (ADR-021, OQ8).

---

## 10. UniProt + ChEMBL — peptide metadata

**What it does (plain English).** When a peptide is identified by accession (or pulled in via a UniProt query), PVL enriches it with curated metadata — protein name, organism, gene name, function annotation, UniProt annotation score[^uniprot] — so a flagged candidate arrives with biological context attached.

**Where in PVL.** UniProt is fully integrated: query execution in `backend/services/uniprot_execute_service.py`, parsing in `uniprot_parser.py`, with the metadata surfaced through `api_models.py` fields `name`, `species`, `geneName`, `proteinFunction`, `annotationScore`.

**ChEMBL — honest status.** ChEMBL[^chembl] is **not currently wired into the prediction pipeline.** A repository-wide search finds it only as a *future* API-design inspiration in a research brief (`docs/active/RESEARCH_BRIEFS/_INDEX.md`), not as a live data source. PVL today enriches from **UniProt only**; bioactivity cross-referencing against ChEMBL is a roadmap item, not a shipped feature. This page does not describe ChEMBL behaviour because there is none to describe.

---

## 11. The deterministic-output guarantee

PVL guarantees: **same input + same predictor versions + same thresholds → byte-identical output**, and identical results whether a sequence is submitted via Quick Analyze (N=1) or inside a CSV batch.

How this is achieved:

- **No RNG in the predict path.** TANGO is a deterministic partition-function binary; the S4PRED ensemble is a fixed forward pass over frozen weights. There is no sampling, no seed, no time-dependence in any computed value.
- **Single source of truth.** Classification flags are computed once on the backend (`apply_ff_flags`) and the frontend never re-derives them (ADR-001). The N=1 path shares the batched S4PRED routine to stay bit-equivalent (`s4pred.py:486-491`).
- **`null` is the only "no data".** Every column uses `None`/`null` for "provider did not run"; `-1` is a real verdict, `0`/`-1`/`"N/A"`/`""` are never overloaded as sentinels (`backend/CLAUDE.md` DataFrame conventions; enforced through `none_if_nan`, `tango.py:765`).
- **Threshold changes re-classify client-side** without re-running TANGO/S4PRED — the expensive predictions are computed once; moving a threshold only re-applies the gate.
- **Reproducibility-as-permalink** (ADR-004): input sequences, thresholds, predictor flags, and PVL version encode into a URL that reproduces the exact analysis on any deployment.

This determinism is the precondition for everything else: a classification you cannot reproduce is not a scientific result.

---

## 12. Known scientific limitations

Stated plainly, because reviewers forgive disclosed limits and reject hidden ones.

1. **SSW is prediction, not observation.** SSW (and therefore FF-SSW) is computed from **TANGO ∪ S4PRED**, never from experimental switching data. It is the union of two sequence predictors' switch-zone calls, not a measured conformational change.
2. **FF-Helix requires BOTH amphipathicity AND a predicted helix.** A genuinely helical but **non-amphipathic** single-domain helix will not flag FF-Helix (`auxiliary.py:398-409`). Absence of the flag is not absence of helicity.
3. **Threshold presets are cohort-derived, not a literature meta-analysis.** The lenient/strict and single-sequence fallback constants (μH 0.388, hydrophobicity 0.417; `config.py:180,185`) come from the **Peleg-118** experimentally-validated cohort, not a broad literature consensus. They are reasonable defaults, not universal cutoffs.
4. **TANGO is sequence-only.** It accounts for no post-translational modifications, no solvent/membrane environment, no concentration, no chaperones, and its accuracy is for monomeric peptides — it is aggregation *propensity*, not a fibril assay (§2).
5. **The tool's valid window is short (≤ 40 aa).** S4PRED is skipped above 40 aa and is least reliable on very short peptides — exactly PVL's operating range. Consensus certainty is explicitly capped for sequences < 20 aa (`consensus.py:157`).
6. **Bundled precomputed datasets use literature-default thresholds.** The shipped example artifacts (Peleg-118, Staphylococcus-2023, Uperin) were computed once with default thresholds; re-tuning thresholds in the UI re-classifies them client-side, but the cached numerical predictions reflect the build-time configuration.
7. **PVL is not state-of-the-art on raw aggregation accuracy.** Against 2024–2026 ML predictors (AggreProt, ANuPP, CORDAX), TANGO is not the most accurate aggregation engine — see the [landscape survey](../research/01_landscape.md). PVL's contribution is *integration, the helix/switch taxonomy, visualization, and reproducibility*, not a better aggregation score.
8. **Open code-vs-paper discrepancies** (flagged above for the scientific lead): FF-Helix gates on μH not mean-hydrophobicity (paper says 0.7 hydrophobicity); TANGO is invoked at pH 7 (paper says 7.4); β μH uses 160° (docstring says 180°); the μH calculation has no 11-residue sliding window (paper §1.6 implies one). The code is authoritative; the paper Methods text needs reconciling before submission.

---

## Validation

The evidence base for these predictions — the **Staphylococcus 2023** blind benchmark (N = 2,916; 66 experimentally labelled) and **Peleg-118** recall (118 experimentally-validated fibril-forming peptides ≤ 40 aa) — is documented in [`../research/02_validation_evidence.md`](../research/02_validation_evidence.md). Predictor disagreement and gold-standard sensitivity are surfaced in-UI (ADR-014). Read the four-class results as *prioritised hypotheses for experiment*, calibrated against those datasets — not as settled fact.

---

## References

[^tango]: Fernandez-Escamilla, A.-M., Rousseau, F., Schymkowitz, J. & Serrano, L. "Prediction of sequence-dependent and mutational effects on the aggregation of peptides by proteins." *Nature Biotechnology* **22**, 1302–1306 (2004). doi:[10.1038/nbt1012](https://doi.org/10.1038/nbt1012). Tool: <https://tango.switchlab.org/>.
[^s4pred]: Moffat, L. & Jones, D. T. "Increasing the accuracy of single-sequence prediction methods using a deep semi-supervised learning framework." *Bioinformatics* **37**(21), 3744–3751 (2021). doi:[10.1093/bioinformatics/btab491](https://doi.org/10.1093/bioinformatics/btab491). Code: <https://github.com/psipred/s4pred>. (Canonical reference; supersedes the "Moffat et al. 2022" string in the repo README.)
[^hamodrakas]: Hamodrakas, S. J. "Protein aggregation and amyloid fibril formation prediction." *IUBMB Life* **59**, 519–522 (2007). doi:[10.1080/15216540701597681](https://doi.org/10.1080/15216540701597681). (FF-Helix / switch-zone lineage. DOI could not be machine-verified via Crossref/doi.org at time of writing — confirm against publisher of record.)
[^fp]: Fauchère, J.-L. & Pliska, V. "Hydrophobic parameters π of amino-acid side chains from the partitioning of N-acetyl-amino-acid amides." *European Journal of Medicinal Chemistry* **18**(4), 369–375 (1983). (No DOI; cite by full reference.)
[^eisenberg]: Eisenberg, D., Weiss, R. M. & Terwilliger, T. C. "The helical hydrophobic moment: a measure of the amphiphilicity of a helix." *Nature* **299**, 371–374 (1982). doi:[10.1038/299371a0](https://doi.org/10.1038/299371a0). (Verified via Crossref.)
[^rb2022]: Ragonis-Bachar, P., Rayan, B., Barnea, E., Engelberg, Y., Upcher, A. & Landau, M. "Natural Antimicrobial Peptides Self-assemble as α/β Chameleon Amyloids." *Biomacromolecules* **23**(9), 3713–3727 (2022). doi:[10.1021/acs.biomac.2c00582](https://doi.org/10.1021/acs.biomac.2c00582). (Verified via Crossref; note the verified title differs from the "α-sheet conformations" phrasing in some internal docs.)
[^alphafold]: Jumper, J. *et al.* "Highly accurate protein structure prediction with AlphaFold." *Nature* **596**, 583–589 (2021). doi:[10.1038/s41586-021-03819-3](https://doi.org/10.1038/s41586-021-03819-3).
[^molstar]: Sehnal, D., Bittrich, S., Deshpande, M., Svobodová, R., Berka, K., Bazgier, V., Velankar, S., Burley, S. K., Koča, J. & Rose, A. S. "Mol\* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures." *Nucleic Acids Research* **49**(W1), W431–W437 (2021). doi:[10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314). (Verified via Crossref.)
[^uniprot]: The UniProt Consortium. UniProt release notes: <https://www.uniprot.org/release-notes>.
[^chembl]: ChEMBL bioactivity database (EMBL-EBI): <https://www.ebi.ac.uk/chembl/>. (Roadmap cross-reference; not yet integrated into PVL.)
[^joss]: Journal of Open Source Software — about: <https://joss.theoj.org/about>.
