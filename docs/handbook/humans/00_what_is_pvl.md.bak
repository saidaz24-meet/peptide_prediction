# What is PVL?

**Peptide Visual Lab (PVL)** is a free, open-source website that helps scientists study short protein fragments — peptides — and predict whether they are likely to misbehave in two specific ways: by **switching their shape** and by **forming fibrils** (long, ordered protein threads associated with both disease and useful biological structures).

You paste a sequence of amino acids, or upload a spreadsheet of hundreds of them, and within seconds PVL shows you an interactive dashboard: which peptides are interesting, why, and how they compare to one another — with charts, a 3D structure you can rotate, and a link you can paste into a paper so anyone can reproduce exactly what you saw.

That's the whole idea. The rest of this page explains why it exists and what makes it different.

## Contents

- [The problem PVL solves](#the-problem-pvl-solves)
- [What PVL actually does](#what-pvl-actually-does)
- [The four categories — the heart of PVL](#the-four-categories--the-heart-of-pvl)
- [What makes PVL different](#what-makes-pvl-different)
- [What PVL is *not*](#what-pvl-is-not)
- [Who built it](#who-built-it)

---

## The problem PVL solves

A peptide is just a chain of amino acids — the same building blocks proteins are made of, but short. Some peptides are harmless. Some clump together. Some fold into a helix (a spiral); some flip between shapes depending on their environment; some assemble into **[amyloid fibrils](09_glossary.md#a)**. Fibrils matter on both sides of biology: they show up in diseases like Alzheimer's, and they also show up as *functional* structures that organisms build on purpose — including in antimicrobial peptides that kill bacteria.

To study this today, a researcher has to visit several different websites, each running a single algorithm:

- one tool to estimate how "sticky" / aggregation-prone a sequence is,
- another to guess its secondary structure (helix vs. sheet vs. coil),
- a third for some biochemical numbers,
- and then a structure viewer, opened separately, to see the shape.

Each tool speaks a slightly different dialect, exports a different file, and none of them talks to the others. You end up merging CSVs in Excel and taking screenshots you hope stay accurate. There is **no single place** that runs these analyses together, overlays them on the molecule, and lets you share the result as something a reviewer can re-open.

PVL is that single place.

---

## What PVL actually does

Give PVL one or many peptide sequences, and it runs four analyses and combines them:

1. **Aggregation propensity** — using **[TANGO](02_the_science.md#2-tango)**, a well-established algorithm for predicting which stretches of a sequence want to aggregate into β-structure.
2. **Secondary structure** — using **[S4PRED](02_the_science.md#3-s4pred)**, a modern neural-network predictor that labels each residue as helix, sheet, or coil.
3. **Fibril-forming classification** — PVL's own pipeline combines those two signals with biochemistry (charge, hydrophobicity, and the "hydrophobic moment" that measures how lopsided a helix is) to sort each peptide into a small, precise set of categories.
4. **Biochemistry and structure** — net charge, hydrophobicity, and a live 3D model pulled from the [AlphaFold](02_the_science.md#9-alphafold--mol) structure database, with the predictions painted directly onto the molecule.

The result is a dashboard, not a text file. You can click a region of a chart to filter the table, rank candidates by a weighted blend of signals, drill into any single peptide, and rotate its structure with the predicted helix and switch regions highlighted.

---

## The four categories — the heart of PVL

Every peptide PVL analyzes is checked against four classifications. You don't need the math yet (it's in [The science](02_the_science.md)); you need the shape of the idea:

| Category | Plain-English meaning |
|----------|-----------------------|
| **Helix** | The peptide is predicted to form a helix. |
| **FF-Helix** | A helix that is *also* lopsided enough (amphipathic) to be a fibril-forming-helix candidate. Every FF-Helix is a Helix. |
| **SSW** (secondary-structure switch) | The peptide has a region that could flip between a helix and an aggregation-prone β-form. |
| **FF-SSW** | An SSW that *also* meets the fibril-forming threshold. Every FF-SSW is an SSW. |

The two "every X is a Y" rules — **FF-Helix is always a Helix**, and **FF-SSW is always an SSW** — are treated as ironclad laws inside PVL. They are checked on every result. This is the kind of correctness discipline that makes PVL a scientific instrument rather than a demo.

These categories come from the research of Dr. Peleg Ragonis-Bachar (Technion), whose published work on how antimicrobial peptides self-assemble is the scientific foundation of the tool.

---

## What makes PVL different

- **Everything in one dashboard.** TANGO, S4PRED, fibril classification, biochemistry, AlphaFold structure, and UniProt lookup — together, talking to each other, instead of five separate tabs.
- **Predictions painted on the 3D molecule.** PVL renders the predicted helix segments and switch regions directly on the AlphaFold structure using Mol*, the same viewer used by the major structure databases.
- **Reproducibility built in.** Every analysis becomes a shareable link that encodes the sequence, the thresholds, and the software version. Paste it into a paper and reviewers see exactly what you saw.
- **It runs anywhere.** PVL is MIT-licensed and ships as Docker containers. You can run the whole thing on your laptop — your sequences never leave your machine.
- **Built for honesty.** When a predictor fails or is turned off, PVL says so per row rather than quietly substituting a fake value. "No data" is always shown as *no data*, never as a zero or a guess.

---

## What PVL is *not*

- It is **not** a cross-β amyloid hexapeptide predictor in the style of Waltz or ZipperDB. PVL's focus is helix and secondary-structure-switch fibril formation, not the classic amyloid steric-zipper question. (See [The landscape](../research/01_landscape.md) for how it sits among those tools.)
- It does **not** claim TANGO predicts fibrils. TANGO predicts aggregation; PVL uses that as one input to its own classification.
- It is **not** a full-protein folding tool. It is a peptide instrument, tuned for short sequences (its neural predictor is capped at 40 residues by default).

---

## Who built it

PVL is a collaboration: the scientific algorithms and review come from Dr. Peleg Ragonis-Bachar (Technion); the entire software platform — backend, frontend, deployment, and ecosystem — was built by Said Azaizah (MIT incoming + DESY); with scientific advising from Dr. Aleksandr Golubev (DESY) and lab direction from Prof. Meytal Landau (Technion + EMBL Hamburg). Full attribution is in [Credits and license](10_credits_and_license.md).

---

**Next:** you now know what PVL is and why it exists. To get it running yourself, read **[01 — First run](01_first_run.md)**.
