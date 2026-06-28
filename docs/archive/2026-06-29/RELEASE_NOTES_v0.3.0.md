# PVL v0.3.0 — release notes draft

**Status**: Draft. Goes live as the GitHub release body when `gh release create v0.3.0` runs after Peleg's monthly review sign-off.

**Date**: 2026-06-08 (target; may shift on Peleg's review timeline).

**Headline**: First publish-ready release. Implements [Ragonis-Bachar et al. 2022](https://doi.org/10.1021/acs.biomac.2c00582)'s four-category classification verbatim, ships across five surfaces (web · Python · CLI · MCP · self-host), and is now ready for citation via Zenodo DOI + JOSS submission.

---

## Highlights

### Scientific alignment with Peleg's algorithm

Several rounds of review with Dr. Peleg Ragonis-Bachar produced a much tighter mapping between PVL's pipeline and the original `main.py` from her 2022 paper. Specifically:

- **Helix-positive count** now derives from the gap-smoothed segment finder (`Helix fragments (Jpred)` column), matching `main.py:219-220` exactly. Previously a single-field check could surface N/A on datasets where one alternate signal was missing.
- **FF-Helix and FF-SSW gates** are now derived from the dataset mean over the class-positive subset (μH-positive mean for FF-Helix; hydrophobicity-positive mean for FF-SSW), matching `main.py:147-170`. Previously these used fixed constants that drifted from the dataset.
- **Symmetric four-category KPI cards** — `% Helix · % FF-Helix · % SSW · % FF-SSW` — replace the prior asymmetric `Total · FF-Helix · SSW · FF-SSW` layout. Peleg's symmetry-of-treatment rule (Drive comment 22 / Q5).
- **FF-Helix score** label replaces the prior `FF-Helix %` label. Per Peleg's "% is a feature, not a class" direction — only the S4PRED Helix percent (which IS a true coverage percentage) keeps the `%` suffix.
- **Help page** rewritten with four verbatim Peleg sections (Helix → FF-Helix → SSW → FF-SSW), text taken word-for-word from her Drive review.

### Frontend redesign

- **Default ranking preset** is now "Fibril-Formation Focus" (Peleg's terminology), not "Equal". Researchers come for fibril formation; that's the landing experience.
- **HowItWorks** step 2 split into 2a (raw predictors: S4PRED + TANGO + biochem in parallel) and 2b (Peleg's classification rules downstream of the predictors). Fixes the prior visual error that implied FF-Helix runs in parallel.
- **Residue colouring** unified across SequenceTrack, Mol3DViewer, BackboneViewer, ResidueHover, and PDF report. All views now read from Peleg's gap-smoothed fragment columns first; raw S4PRED argmax is the per-residue fallback only. This fixes the "black G" bug Peleg flagged where a G residue inside a clear helix run was being coloured coil.
- **Correlation Matrix** rewritten to expose S4PRED helix SCORE (raw probability) instead of percent, plus TANGO helix max / β max / aggregation max, plus FF-Helix and FF-SSW as binary correlation targets.
- **Provider badges** ("TANGO: OK / S4PRED: OK") now read from server state symmetrically. Fixes the Slack-reported "TANGO: OFF S4PRED: OFF" confusion on UniProt single-entry analyses.
- **UniProt search** defaults both TANGO and S4PRED toggles to ON. Researchers get a complete analysis on first run, no need to find the toggles.

### Backend

- **Dataset-derived FF thresholds** (PR #81) — `sswAvgH` and `helixAvgUh` thresholds now compute from the dataset positive class instead of fixed constants. Matches Peleg's `perform_fibril_formation_prediction` (`main.py:147-170`).
- **Validation skeleton** — `backend/scripts/rerun_validation_2026_06_07.py` runs the Ragonis-Bachar 2022 cohort (14/26 ffAMPs) and Staphylococcus 2023 through the pipeline and emits a confusion matrix vs experimental truth. The 12 negative-class peptides from Supplementary Table 2 still need to be sourced; a warning surfaces when the cohort is incomplete.
- **TANGO SSW fragments** wired through the API (PR #80). The 3rd track in `DualStructureTrack` now reads from the canonical TANGO SSW fragment column instead of inferring from beta segments — fixing the bug where "No SSW" peptides showed a full SSW bar.

### Repository hygiene

- **Three-bucket doc layout** (PR #86) — `docs/active/` (24 publishable files) · `docs/internal/` (18 process docs) · `docs/archive/2026-06-08/` (12 historical artifacts). Repo root cleaned from 27 files to 5 essential ones.
- **CITATION.cff** bumped to v0.3.0 with the correct author order (Ragonis-Bachar → Azaizah → Golubev → Landau, corresponding).
- **JOSS paper draft** (`paper/paper.md`) ready for submission. Anchors on Ragonis-Bachar 2022 and cites the 7 external tools PVL builds on.

### CodeRabbit + CI quality

This release closed 11 of 16 CodeRabbit review comments across 6 PRs:
- Defensive type guards in `fragmentClassification.ts` (B + L)
- Bounds + numeric type guards in `readRange` (#77)
- Defensive access + cohort-completeness warning + try/except in validation script (D + H + I)
- Tightened SequenceTrack test selectors with exact counts (J + K)
- PeptideTable column labels for the 3 new columns (A)
- PeptideDetail scatter axis/tooltip consistency (F)

Mypy noise from `peptide_compare.py` type signature drift fixed at root.

---

## How to upgrade

```bash
git pull origin main
make docker-up   # rebuilds backend + frontend + redeploys
```

Or download the [v0.3.0 source tarball from GitHub](https://github.com/saidaz24-meet/peptide_prediction/releases/tag/v0.3.0).

The API contract did not change in v0.3.0 — existing consumers (Python package, CLI, MCP) continue to work without modification.

---

## Acknowledgements

This release would not exist without Dr. Peleg Ragonis-Bachar's monthly review cycles and Drive comments on every aspect of the scientific pipeline. Thanks also to Dr. Aleksandr Golubev for direction, lab adoption, and DESY infrastructure access; and to Prof. Meytal Landau for paper guidance and corresponding-author duties.

---

## Citing this release

```bibtex
@software{pvl_v0_3_0,
  author    = {Ragonis-Bachar, Peleg and Azaizah, Said and Golubev, Aleksandr and Landau, Meytal},
  title     = {Peptide Visual Lab (PVL) v0.3.0},
  year      = {2026},
  url       = {https://github.com/saidaz24-meet/peptide_prediction/releases/tag/v0.3.0},
  doi       = {10.5281/zenodo.PENDING},
  license   = {MIT}
}
```

Also cite the underlying algorithm:

```bibtex
@article{ragonis_bachar_2022,
  author  = {Ragonis-Bachar, Peleg and Rayan, Bader and Barnea, Eilon and Engelberg, Yizhaq and Upcher, Alexander and Landau, Meytal},
  title   = {Natural Antimicrobial Peptides Self-assemble as α-Sheet Conformations as Defined by a Linear Motif},
  journal = {Biomacromolecules},
  year    = {2022},
  volume  = {24},
  pages   = {413--425},
  doi     = {10.1021/acs.biomac.2c00582}
}
```
