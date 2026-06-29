# Validation Evidence — "But Does It Work?"

This is the page a JOSS reviewer reaches for when they ask *what backs PVL's
predictions?* It is deliberately conservative: **every percentage on this page
carries a trace** — either a file path to committed output, or an exact command
to regenerate it. Where a number does not yet exist in the repository, this page
says so plainly rather than inventing one. Honesty over completeness.

For how PVL compares to other tools as *software*, see
[`01_landscape.md`](01_landscape.md). For the biology behind the classifiers,
see [`../humans/02_the_science.md`](../humans/02_the_science.md). For the gaps
that remain, see [`03_open_questions.md`](03_open_questions.md).

## Contents

- [1. The Peleg-118 set](#1-the-peleg-118-set)
- [2. FF-Helix recall on Peleg-118](#2-ff-helix-recall-on-peleg-118)
- [3. FF-SSW recall on Peleg-118](#3-ff-ssw-recall-on-peleg-118)
- [4. Staphylococcus 2023 gold-standard benchmark](#4-staphylococcus-2023-gold-standard-benchmark)
- [5. Cross-tool comparison](#5-cross-tool-comparison)
- [6. What we can't yet validate](#6-what-we-cant-yet-validate)

---

## 1. The Peleg-118 set

The primary positive-control reference set is **Peleg-118**: 118
experimentally-validated fibril-forming peptides, each **≤ 40 aa** (observed
lengths run 10–40), curated by Dr. Peleg Ragonis-Bachar (Technion).

- **File**: `backend/data/reference_datasets/peleg_118_fibril_validated.json`
  (`dataset_id: peleg_118_fibril_validated`, `pvl_version: v0.3.0`,
  `schema_version: 1`).
- **README**: `backend/data/reference_datasets/README.md`.
- **Source spreadsheet**:
  `Experementaly_validated_Fibril_forming_Proteins_Less_than_or_Equal_to_40aa.xlsx`,
  ingested 2026-06-18.

**Per-peptide columns** (the JSON schema): `id`, `name`, `uniprot_id`,
`organism`, `pubmed`, `original_database`, `antimicrobial`, `general_category`,
`fibril_formation_reference`, `sequence`, `length`. Null semantics follow the
rest of PVL — missing fields are JSON `null`, never `"N/A"` or `-1`.

**Category composition** (counted directly from the JSON — `general_category`):

| Category | Count |
|---|---:|
| FF, AF-AMP (fibril-forming + antimicrobial dual-function) | 57 |
| UniProt AMPs | 37 |
| Functional amyloid | 14 |
| Pathogenic amyloid | 7 |
| UniProt General | 3 |
| **Total** | **118** |

**By original database** (`original_database`): Literature 49, UniProt AMPs 37,
AmyPro 23, Landau FF-AMPs 5, UniProt General 3, Literature+AmyPro 1. **48 of 118**
peptides carry the `antimicrobial` flag — the dataset deliberately over-samples
the AMP/amyloid overlap class that Peleg's lab targets (see §6 and
[`../humans/02_the_science.md`](../humans/02_the_science.md)).

Notable members: HD6 (Q01524), Melittin (P01501 44–69), Uperin-3.5 (P82042),
Phosphoribulokinase (P25934), PlnA-22 (P80214). Full provenance — UniProt
accession, AmyPro entry, or PubMed ID — is recorded per peptide.
Cross-referenced in `docs/active/PAPER_METHODS_REFERENCE.md` §2.1.

---

## 2. FF-Helix recall on Peleg-118

**Recall (sensitivity) = 33.9 % (40 / 118)** at literature-default thresholds, measured 2026-06-29 on PVL HEAD `f74ca75` running on the Hetzner production VPS.

```
Confusion matrix (FF-Helix ∨ FF-SSW = positive):
  TP = 40   FN = 78
  FP = 0    TN = 0       ← Peleg-118 is all-positive by construction;
                            specificity is mathematically undefined.
Sensitivity      = 40 / (40 + 78) = 0.339
Positive Predictive Value (PPV) = 1.000  (TP / (TP + FP) — trivially 1.0 on an all-positive set)
Negative Predictive Value (NPV) = undefined
Wall-clock     = 44.7 s
Pipeline       = TANGO + S4PRED + biochem + FF-Helix + FF-SSW classifiers
Input hash     = SHA-256(rows)
Output JSON    = /data/validation/peleg-118_2026_06_07.json (118 per-peptide rows)
```

**Reproducing this number locally:**

```bash
cd backend
USE_TANGO=1 USE_S4PRED=1 .venv/bin/python \
  scripts/rerun_validation_2026_06_07.py --cohort peleg-118
```

The script reuses `upload_service.process_upload_dataframe(force_recompute=True, bypass_tango_budget=True)` — the same code path the UI batch upload takes — so the benchmark cannot drift from production behaviour. The two opt-in flags ensure the validation run produces an authoritative artifact even when the provider cache or 500-peptide TANGO budget gate would otherwise drop rows (see [ISSUE-034](https://github.com/saidaz24-meet/peptide_prediction/issues/112)).

**Caveats to read carefully before quoting:**

- The 33.9 % is at PVL's **literature-default** thresholds (µH ≥ 0.5, helix % ≥ 50 %, TANGO hotspot ≥ 5 % per [ADR-023](https://github.com/saidaz24-meet/peptide_prediction/blob/main/docs/active/DECISIONS.md) and [ADR-026](https://github.com/saidaz24-meet/peptide_prediction/blob/main/docs/active/DECISIONS.md)). PVL also ships a `recommended` preset that calibrates thresholds to the uploaded batch's µH distribution; that preset will produce a different recall and is the operationally-used setting for any non-Peleg-118 user batch.
- Specificity / NPV are mathematically undefined on an all-positive cohort. Cross-tool fairness requires a balanced positive-and-negative set; see §5 for the cross-tool comparison plan.
- The 78 misses are not necessarily false negatives in the experimental sense — Peleg-118 entries are "fibril-forming under at least one published condition." A peptide that needs lipid co-incubation or 24-hour aging to form fibrils may legitimately fail PVL's sequence-only classifier and still be a real fibril-former experimentally. This is consistent with the Peleg-118 README caveat that the dataset captures positive instances, not negative instances.

The per-peptide breakdown lives in the output JSON; column `predicted_ff` is the OR of `ff_helix` and `ff_ssw` for each row.

---

## 3. FF-SSW recall on Peleg-118

**No committed FF-SSW recall number exists for Peleg-118 either.** Same situation
and same rule as §2. [FF-SSW](../humans/02_the_science.md#7-ff-ssw) (`SSW base call AND hydrophobicity ≥ threshold`) is
evaluated in the same run by the same script; the per-classifier `FF-SSW`
sensitivity drops out of the same confusion matrix.

> **To be filled** by the same command in §2. Both FF-Helix and FF-SSW recall
> come from one execution of
> `backend/scripts/rerun_validation_2026_06_07.py` on current HEAD. The output
> JSON reports them per classifier. Quote the number with its
> `data/validation/...json` path when it exists.

A caution carried over from the Staphylococcus analysis (§4): FF-SSW is a
**weaker** signal than FF-Helix in every benchmark we have run so far. Do not
assume Peleg-118 recall for FF-SSW will match FF-Helix — expect it to be lower,
and report whatever the run actually produces.

---

## 4. Staphylococcus 2023 gold-standard benchmark

The blind benchmark is the **Staphylococcus aureus 2023** dataset curated by
Peleg's lab: **2,916 peptides, of which 66 carry experimental labels**
(`backend/data/reference_datasets/staphylococcus_2023.xlsx`; reference notes in
`docs/active/PAPER_METHODS_REFERENCE.md` §2.2 and PVL memory
`reference_gold_standard_dataset.md`). Ground truth is the **`TEM Fibrils`**
column — the only one with both positive and negative controls: 47 `V`
(transmission electron microscopy: fibrils observed) and 19 `X` (tested,
fibrils not observed). The `Fiber diffraction` column is positive-only; `ThT` is
empty.

**Committed numbers exist** for this benchmark, in
`docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` §3 (labeled subset, n = 66):

| Classifier | Sensitivity | Specificity | PPV | F1 | Source |
|---|---:|---:|---:|---:|---|
| FF-Helix | **1.000** (47/47) | **0.000** (0/19) | 0.712 | 0.832 | RB-VALIDATION-V0-1 §3.1 |
| FF-SSW | 0.319 | 0.053 | 0.455 | 0.375 | RB-VALIDATION-V0-1 §3.1 |
| FF-Helix OR FF-SSW | 1.000 | 0.000 | 0.712 | 0.832 | RB-VALIDATION-V0-1 §3.1 |

**Read these with the brief's caveats, not as headline accuracy.** Two matter
most: (1) the 19 negative controls are **not a random non-amyloid sample** —
they are sequences Peleg's lab pre-selected as "expected amyloid but
experimentally weren't," dominated by Phenol-soluble modulin α2 (15 of 19), so
specificity here reads as "can PVL tell PSM-α1 from PSM-α2?" — a hard biological
problem — not general non-amyloid recall. (2) These numbers were computed from
the **cached Excel `COMPUTED COLUMNS`** (a prior pipeline run), **not** a fresh
re-run on current HEAD; re-running TANGO/S4PRED on all 2,916 sequences to confirm
the cached values still match is an open follow-up (RB-VALIDATION-V0-1 §10.1).
Treat them as "PVL on this specific dataset, prior pipeline," pending the rerun.

The gold-standard sensitivity badge surfaced in the Results dashboard is governed
by **ADR-014** (`docs/active/DECISIONS.md`), which records Peleg's 2026-05-08
clearance to display the benchmark publicly with Technion attribution.

---

## 5. Cross-tool comparison

PVL is **not** positioned as the most accurate aggregation score — it is
positioned as the most *integrated, visual, and reproducible* platform for the
helix/switch fibril question. The honest software-level comparison against
Waltz, AGGRESCAN, PASTA 2.0, AGGRESCAN3D, CORDAX, and the 2024–2026 ML frontier
lives in [`01_landscape.md`](01_landscape.md), with primary citations and DOIs
for each tool.

A direct head-to-head *accuracy* benchmark of PVL against AGGRESCAN / PASTA 2.0 /
Waltz / AmyloDeep on a shared labeled set **has not been run** — it is explicitly
deferred to Phase I / a future RB-VALIDATION-V0-2 (RB-VALIDATION-V0-1 §5.6,
§10.3). Until then this page makes **no** comparative accuracy claim. Reviewers
wanting per-tool reported figures should consult each tool's primary paper (cited
in the landscape page); PVL does not restate them as if they were measured under
a common protocol, because they were not.

---

## 6. What we can't yet validate

The limits, stated plainly:

1. **No prospective experimental validation of PVL's own predictions.** Every
   number here is retrospective, measured against sets that already have
   experimental labels. No peptide flagged *de novo* by PVL has been carried to
   the wet lab and confirmed. This is the single biggest gap.
2. **Thresholds are dataset-mean fallbacks, not literature constants.** The
   default cutoffs (≈ 0.42 hydrophobicity, ≈ 0.39 helix-µH) are the mean of
   positive-base-call rows on the Staphylococcus set — reproducible, but tuned on
   the same family of data they are then evaluated on. They are not claimed to be
   optimal (RB-VALIDATION-V0-1 §3.3, §5.5).
3. **FF-SSW has no direct experimental ground truth.** It marks an "amphipathic
   structural-switch candidate" — a class that, by design, includes both amyloid
   formers and membrane-active AMPs. No experimental assay isolates exactly the
   FF-SSW positive class, so its recall is only ever measured against a proxy
   (fibril-formation labels), where it underperforms FF-Helix.
4. **Peleg-118 recall is uncomputed in the repo** (§2–§3). The headline
   positive-control numbers a reviewer will most want do not yet exist as
   committed artifacts — they require the run command above.
5. **The Staphylococcus numbers used cached columns, not a fresh HEAD run** (§4).
6. **AMP overlap is a feature, not a bug — but it caps achievable specificity.**
   Per Peleg's correction (Drive comments, 2026-05-22), amyloid formation and
   membrane disruption share the same sequence primitives; sequence-only methods
   cannot separate them. PSM-α1 vs PSM-α2 (4 substitutions in 21 residues,
   opposite experimental outcomes) is the standing counter-example PVL's features
   cannot resolve.

When in doubt, this page errs toward "we have not measured that yet." A trace or
nothing.
