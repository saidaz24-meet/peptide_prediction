# The publication path: Zenodo → bio.tools → JOSS

> **For grant writers, lab PIs, and paper authors.** This page explains how PVL becomes a *citable, discoverable, peer-reviewed* scientific artifact — and what you can put in a methods section or a grant once each milestone lands. It is a map, not a how-to; the operator's checklist lives in [`docs/active/PUBLICATION_PATH.md`](../../active/PUBLICATION_PATH.md).

## Contents

- [The five steps](#the-five-steps)
- [What each step gets you](#what-each-step-gets-you)
- [What it costs in time](#what-it-costs-in-time)
- [What you cite once they all land](#what-you-cite-once-they-all-land)
- [Long-term: keeping the DOI fresh](#long-term-keeping-the-doi-fresh)

---

## The five steps

The path is sequential — each step depends on the one before it.

1. **Cut a tagged release.** A `v0.3.0` release is tagged on GitHub. This freezes a specific, immutable state of the code as "the version that was published."
2. **[Zenodo](../humans/09_glossary.md#z) mints a DOI.** A standing GitHub↔Zenodo link means the release event automatically deposits a snapshot in Zenodo's CERN-backed archive and issues a Digital Object Identifier within a minute or two — no manual upload.
3. **Wire the DOI back in.** The minted DOI is written into `CITATION.cff` and the README badge row, so anyone landing on the repo gets the correct citation.
4. **Register on [bio.tools](../humans/09_glossary.md#b).** PVL is submitted to the ELIXIR bio.tools registry with a structured description, EDAM ontology terms, authors, and license.
5. **Submit the [JOSS](../humans/09_glossary.md#j) paper.** The software paper at [`paper/paper.md`](../../../paper/paper.md) goes to the *Journal of Open Source Software* for open peer review.

---

## What each step gets you

| Milestone | What it gives you |
|-----------|-------------------|
| **Zenodo DOI** | A permanent, citable archive. The DOI resolves forever even if GitHub disappears — this is the citation a reviewer or a grant committee expects for software. |
| **bio.tools entry** | Discoverability. PVL appears in the ELIXIR registry that European bioinformatics infrastructure indexes, tagged by what it does so the right researchers find it. |
| **JOSS paper** | Peer-reviewed credibility. A real, indexed publication with its own DOI that asserts the software builds, runs, is documented, and is scientifically sound. |

The Zenodo concept DOI is the canonical **software** citation; the JOSS DOI is the canonical **paper** citation. Both point at the same tool.

For bio.tools, PVL is classified under EDAM ontology terms — primarily **`operation_0473`** (protein secondary structure prediction, via S4PRED), with **`operation_0269`** (protein property prediction), **`operation_0245`** (protein architecture recognition, for FF-Helix/SSW), and **`operation_0570`** (structure visualisation). Topics include **`topic_0078`** (proteins), **`topic_0166`** (protein structural motifs), and **`topic_2275`** (molecular modelling). These are how the registry routes the tool to the right audience.

---

## What it costs in time

The hands-on work is small; the waiting is where the calendar goes.

- **Zenodo DOI** — *minutes.* Automatic on the release tag.
- **bio.tools registration** — *~20 minutes* to fill the form; *~1–2 weeks* for curator approval.
- **JOSS review** — *about 3 weeks elapsed* of open review (can stretch to several weeks depending on reviewer load). Active author effort is an hour or two.

End to end: roughly **two hours of real work** spread across **~3 weeks of elapsed time**, almost all of it waiting on reviewers.

---

## What you cite once they all land

When all five steps complete, the README carries a badge row and the project ships two BibTeX entries — **cite both the software and the underlying algorithm:**

```bibtex
@software{pvl_2026,
  author  = {Ragonis-Bachar, Peleg and Azaizah, Said and Golubev, Aleksandr and Landau, Meytal},
  title   = {Peptide Visual Lab (PVL)},
  year    = {2026},
  doi     = {10.5281/zenodo.XXXXXXX},  % Zenodo concept DOI
  license = {MIT}
}

@article{ragonis_bachar_2022,
  author  = {Ragonis-Bachar, Peleg and Rayan, Bader and Barnea, Eilon
             and Engelberg, Yizhaq and Upcher, Alexander and Landau, Meytal},
  title   = {Natural Antimicrobial Peptides Self-assemble as
             α-Sheet Conformations as Defined by a Linear Motif},
  journal = {Biomacromolecules},
  year    = {2022},
  doi     = {10.1021/acs.biomac.2c00582}
}
```

Authorship across all surfaces is **Ragonis-Bachar, Azaizah, Golubev, and Landau (PI)**, under the **MIT** license. See [credits and license](../humans/10_credits_and_license.md) for roles and ORCIDs, and [validation evidence](../research/02_validation_evidence.md) for what the JOSS reviewers will check the science against.

PVL also exposes a per-analysis citation: every analysis URL is a stable permalink encoding the version, thresholds, and dataset. Paste it in a paper and a reader reproduces the exact view you cited.

---

## Long-term: keeping the DOI fresh

Zenodo issues **two** DOIs, and the distinction matters for every release after the first:

- **Versioned DOI** — points at one exact release (`v0.3.0`). Immutable; never changes.
- **Concept DOI** — points at "the latest version of PVL." It rolls forward automatically as new releases land.

**Cite the concept DOI in papers and grants.** It does not drift when `v0.4.0` ships, so a citation written today still resolves to a maintained, current tool a year from now. Each new tagged release mints a fresh versioned DOI under the same concept DOI for free — no re-registration, no broken links. Update the version string and the JOSS paper only if the science itself changes.
