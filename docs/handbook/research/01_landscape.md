# The landscape: peptide aggregation, amyloid, and fibril prediction tools

> **For paper and grant authors.** This page surveys the tools PVL sits among — what each predicts, whether it's still alive, and where PVL is differentiated versus where a competitor is genuinely stronger. Every tool has a primary citation with a resolvable link. The page ends with a feature matrix.
>
> **Framing for the paper.** The aggregation-prediction field is crowded but *narrow*: almost every established tool answers one question (is this stretch aggregation-prone / amyloidogenic?) through one interface (a single-algorithm web form that emits a static plot or a flat file). PVL's claim to novelty is **not** "a better aggregation score." It is **integration** (multiple analyses in one dashboard), **a different scientific question** (helix and secondary-structure-switch fibril formation, per Ragonis-Bachar et al. 2022[^rb2022], not classic cross-β hexapeptide amyloidogenicity), and **reproducibility + structure visualization** as first-class features. Read the comparisons below with that thesis in mind.

## Contents

- [How to read this](#how-to-read-this)
- [1. TANGO](#1-tango)
- [2. Waltz / WALTZ-DB](#2-waltz--waltz-db)
- [3. AGGRESCAN](#3-aggrescan)
- [4. AGGRESCAN3D (A3D) 2.0](#4-aggrescan3d-a3d-20)
- [5. PASTA 2.0](#5-pasta-20)
- [6. FoldAmyloid](#6-foldamyloid)
- [7. ZipperDB / the 3D-profile method](#7-zipperdb--the-3d-profile-method)
- [8. AmylPred2](#8-amylpred2)
- [9. MetAmyl](#9-metamyl)
- [10. AggreProt](#10-aggreprot)
- [11. CORDAX — the most direct modern competitor](#11-cordax--the-most-direct-modern-competitor)
- [12. The 2021–2026 machine-learning frontier](#12-the-20212026-machine-learning-frontier)
- [13. Curated databases (the field's ground truth)](#13-curated-databases-the-fields-ground-truth)
- [Where PVL's own predictors come from](#where-pvls-own-predictors-come-from)
- [Feature matrix](#feature-matrix)
- [References](#references)

---

## How to read this

The tools cluster into four groups:

1. **Aggregation-propensity predictors** — score how aggregation-prone each residue/stretch is. *TANGO, AGGRESCAN, PASTA 2.0, AGGRESCAN3D, AggreProt.*
2. **Amyloid-specific / cross-β predictors** — answer the narrower "will this form an amyloid fibril?" question, often hexapeptide-trained. *Waltz, FoldAmyloid, ZipperDB (3D profile).*
3. **Consensus / meta predictors** — combine several of the above. *AmylPred2, MetAmyl.*
4. **Curated databases** (not predictors, but the field's ground truth) — *AmyPro, WALTZ-DB.*

PVL uses **[TANGO](../humans/02_the_science.md#2-tango)** as a vendored input and its own **[FF-Helix / SSW / FF-SSW](../humans/02_the_science.md#1-the-four-class-system)** classification on top — so TANGO is both an ancestor and a component, not purely a competitor.

---

## 1. TANGO

- **Predicts:** per-residue β-aggregation propensity (and β-turn / α-helix occupancy) from sequence, using a statistical-mechanics partition-function model.
- **Primary citation:** Fernandez-Escamilla, A.-M., Rousseau, F., Schymkowitz, J. & Serrano, L. "Prediction of sequence-dependent and mutational effects on the aggregation of peptides by proteins." *Nature Biotechnology* **22**, 1302–1306 (2004). doi:[10.1038/nbt1012](https://doi.org/10.1038/nbt1012)[^tango]
- **Interface / availability:** web server at <https://tango.switchlab.org/> (registration required) + downloadable binary. The original Fortran binary is what PVL vendors and runs as a subprocess.
- **Maintained:** the algorithm is stable and still widely cited; the web server is up but the method itself has not materially changed since the mid-2000s.
- **License:** academic-use, not open-source / not redistributable freely.
- **vs PVL:** TANGO answers exactly one question — aggregation propensity — and returns a plot. PVL *consumes* TANGO as one of several inputs and never claims TANGO predicts fibrils; it folds TANGO's β-aggregation signal into the SSW and FF-SSW classifications and overlays it on the 3D structure. TANGO is stronger as a pure, peer-validated aggregation engine with a long citation record; PVL is stronger at turning that signal into an interpreted, comparable, shareable classification.

## 2. Waltz / WALTZ-DB

- **Predicts:** amyloid-forming propensity using a position-specific scoring matrix (PSSM) trained to distinguish *true* amyloid sequences from amorphous β-aggregates — a sharper question than generic aggregation.
- **Primary citation:** Maurer-Stroh, S. *et al.* "Exploring the sequence determinants of amyloid structure using position-specific scoring matrices." *Nature Methods* **7**, 237–242 (2010). doi:[10.1038/nmeth.1432](https://doi.org/10.1038/nmeth.1432)[^waltz]
- **Companion database:** WALTZ-DB (Beerten, Van Durme, *et al.*, *Bioinformatics* 2015) and WALTZ-DB 2.0 — a benchmark set of experimentally tested amyloidogenic and non-amyloidogenic hexapeptides. WALTZ-DB: *Bioinformatics* **31**, 1698–1700 (2015), [academic.oup.com/bioinformatics/article/31/10/1698/177770](https://academic.oup.com/bioinformatics/article/31/10/1698/177770).[^waltzdb]
- **Interface / availability:** web server (waltz.switchlab.org) + database.
- **Maintained:** database updated through ~2020 (WALTZ-DB 2.0); still a standard benchmark.
- **vs PVL:** Waltz is the gold standard for the *classic cross-β amyloid hexapeptide* question — the exact question PVL deliberately does **not** specialize in. PVL targets helix-based and switch-based fibril formation in the Ragonis-Bachar framing. They are complementary, not substitutes; a thorough study might run both. Waltz is stronger and better-validated for short cross-β motifs; PVL is stronger for longer amphipathic/AMP-style peptides and for visualization + cohort comparison.

## 3. AGGRESCAN

- **Predicts:** aggregation "hot spots" in a sequence using an aggregation-propensity scale derived from in-vivo experiments.
- **Primary citation:** Conchillo-Solé, O. *et al.* "AGGRESCAN: a server for the prediction and evaluation of 'hot spots' of aggregation in polypeptides." *BMC Bioinformatics* **8**, 65 (2007). doi:[10.1186/1471-2105-8-65](https://doi.org/10.1186/1471-2105-8-65)[^aggrescan]
- **Interface / availability:** web server.
- **Maintained:** original server is ~2007-era; superseded for active work by AGGRESCAN3D (below).
- **License:** free web service; open-access paper.
- **vs PVL:** sequence-only, single-output, no structure, no comparison, no reproducible state. PVL covers the aggregation question with TANGO and adds the structural + classification layers AGGRESCAN never had.

## 4. AGGRESCAN3D (A3D) 2.0

- **Predicts:** **structure-based** aggregation propensity — it reads a 3D structure (PDB) and accounts for which aggregation-prone residues are actually surface-exposed, plus the effect of mutations on solubility and stability.
- **Primary citations:** original — Zambrano, R. *et al.* "AGGRESCAN3D (A3D): server for prediction of aggregation properties of protein structures." *Nucleic Acids Research* **43**(W1), W306–W313 (2015). doi:[10.1093/nar/gkv359](https://doi.org/10.1093/nar/gkv359). 2.0 — Kuriata, A. *et al.* "Aggrescan3D (A3D) 2.0: prediction and engineering of protein solubility." *Nucleic Acids Research* **47**(W1), W300–W307 (2019). doi:[10.1093/nar/gkz321](https://doi.org/10.1093/nar/gkz321)[^a3d]
- **Interface / availability:** web server at <http://biocomp.chem.uw.edu.pl/A3D2/> + a REST API for pipelines. The lab has since extended the family with Aggrescan4D (dynamic) and AggrescanAI (language-model; see §12).
- **Maintained:** actively maintained (2.0 in 2019, ongoing) by the Ventura/Kmiecik groups.
- **vs PVL:** A3D is the closest competitor on the *structure-aware aggregation* axis and is genuinely strong there — it does dynamic, mutation-aware, structure-based solubility prediction that PVL does not attempt. But A3D is about **solubility/aggregation engineering of folded proteins**, not peptide fibril *classification*; it has no helix/SSW category system, no S4PRED-style secondary-structure switching, and no peptide-cohort dashboard. A3D has a REST API (an integration advantage); PVL counters with an MCP server, a permalink reproducibility model, and a unified multi-tool dashboard. This is the comparison the paper should treat most carefully.

## 5. PASTA 2.0

- **Predicts:** aggregation-prone regions and the most likely cross-β pairing, via an energy function for inter-strand β-pairing; also reports intrinsic disorder and secondary structure.
- **Primary citation:** Walsh, I., Seno, F., Tosatto, S. C. E. & Trovato, A. "PASTA 2.0: an improved server for protein aggregation prediction." *Nucleic Acids Research* **42**(W1), W301–W307 (2014). doi:[10.1093/nar/gku399](https://doi.org/10.1093/nar/gku399)[^pasta]
- **Interface / availability:** web server (protein.bio.unipd.it/pasta2).
- **Maintained:** 2.0 from 2014; still referenced and online.
- **vs PVL:** PASTA 2.0 is one of the more *integrative* classic tools — it bundles disorder + secondary structure alongside aggregation, which is conceptually similar to PVL's multi-signal idea. But it is still a static single-page server with no interactive dashboard, no 3D overlay, no classification taxonomy, and no reproducible/shareable state. PVL's differentiation is interface and integration depth, not the underlying aggregation physics (which PASTA arguably models more explicitly via its pairing energy).

## 6. FoldAmyloid

- **Predicts:** amyloidogenic regions using expected packing density and expected probability of backbone–backbone hydrogen-bond formation.
- **Primary citation:** Garbuzynskiy, S. O., Lobanov, M. Y. & Galzitskaya, O. V. "FoldAmyloid: a method of prediction of amyloidogenic regions from protein sequence." *Bioinformatics* **26**(3), 326–332 (2010). doi:[10.1093/bioinformatics/btp691](https://doi.org/10.1093/bioinformatics/btp691)[^foldamyloid]
- **Interface / availability:** web server (bioinfo.protres.ru/fold-amyloid).
- **Maintained:** stable since 2010; server historically up but lightly maintained.
- **vs PVL:** a single-signal, sequence-only amyloid-region predictor. It is a useful *input-class* method (the kind of thing PVL could one day add as an extra provider) but offers none of PVL's integration, classification, structure, or reproducibility.

## 7. ZipperDB / the 3D-profile method

- **Predicts:** whether 6-residue segments can form the cross-β "steric zipper" spine of an amyloid fibril, by threading each hexapeptide onto a known zipper template structure and computing Rosetta energy.
- **Primary citation:** Goldschmidt, L., Teng, P. K., Riek, R. & Eisenberg, D. "Identifying the amylome, proteins capable of forming amyloid-like fibrils." *PNAS* **107**(8), 3487–3492 (2010). doi:[10.1073/pnas.0915166107](https://doi.org/10.1073/pnas.0915166107)[^zipperdb]
- **Interface / availability:** ZipperDB is a precomputed genome-scale database of zipper-forming segments; the underlying method is structure/energy-based.
- **Maintained:** the database is a static resource; the Eisenberg lab has since moved to newer structure-based steric-zipper predictors.
- **vs PVL:** the most *structurally rigorous* amyloid predictor here, and the closest to "ground truth" for cross-β zippers — a genuine strength PVL does not match. But it answers only the steric-zipper question for hexapeptides, with no helix/switch concept, no live dashboard, and no peptide-level interpretation workflow. Orthogonal to PVL's scientific focus.

## 8. AmylPred2

- **Predicts:** consensus amyloidogenic determinants by combining **eleven** individual sequence-based methods and reporting where they agree.
- **Primary citation:** Tsolis, A. C., Papandreou, N. C., Iconomidou, V. A. & Hamodrakas, S. J. "A consensus method for the prediction of 'aggregation-prone' peptides in globular proteins." *PLOS ONE* **8**(1), e54175 (2013). doi:[10.1371/journal.pone.0054175](https://doi.org/10.1371/journal.pone.0054175)[^amylpred2]
- **Interface / availability:** web server.
- **Maintained:** ~2013-era; still online, lightly maintained.
- **vs PVL:** AmylPred2 pioneered the *consensus* idea PVL shares in spirit (PVL also reasons over multiple signals). The Hamodrakas group's work is also part of PVL's own scientific lineage — Hamodrakas 2007 is cited for the FF-Helix framing. AmylPred2 is stronger as a breadth-of-methods amyloid consensus; PVL is stronger at structure, interactivity, classification taxonomy, and reproducibility, and is scoped to a different (helix/switch) fibril question.

## 9. MetAmyl

- **Predicts:** a meta-predictor for amyloid regions built on a logistic-regression combination of existing predictors (including PAFIG, SALSA, Waltz, FoldAmyloid).
- **Primary citation:** Emily, M., Talvas, A. & Delamarche, C. "MetAmyl: a METa-predictor for AMYLoid proteins." *PLOS ONE* **8**(11), e79722 (2013). [journals.plos.org/plosone/article?id=10.1371/journal.pone.0079722](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0079722)[^metamyl]
- **Interface / availability:** web server.
- **Maintained:** ~2013-era.
- **vs PVL:** same story as AmylPred2 — a consensus amyloid predictor with no structure, no interactivity, no classification taxonomy, no reproducible state.

## 10. AggreProt

- **Predicts:** aggregation-prone regions (APRs) via an **ensemble of deep neural networks** trained on experimentally evaluated hexapeptides; also supports engineering APRs out of a protein.
- **Primary citation:** Planas-Iglesias, J. *et al.* "AggreProt: a web server for predicting and engineering aggregation prone regions in proteins." *Nucleic Acids Research* **52**(W1), W159–W169 (2024). [academic.oup.com/nar/article/52/W1/W159/7683054](https://academic.oup.com/nar/article/52/W1/W159/7683054)[^aggreprot]
- **Interface / availability:** web server at <https://loschmidt.chemi.muni.cz/aggreprot/>.
- **Maintained:** the newest tool here (2024), actively maintained by the Loschmidt Laboratories group.
- **vs PVL:** AggreProt represents the *modern deep-learning* direction of the aggregation field and is a strong, current APR predictor with an engineering workflow. It is still, however, a single-question server (APRs in / annotated sequence out) without PVL's multi-tool dashboard, structural overlay, peptide classification taxonomy, or reproducibility model. It is the tool whose ML approach PVL's roadmap (Phase I multi-predictor) would most plausibly learn from or add as a provider.

## 11. CORDAX — the most direct modern competitor

- **Predicts:** structure-based aggregation **motifs** and the topology/orientation/architecture of the putative fibril core, using machine learning trained on experimentally solved amyloid fibril core structures — and renders the predicted steric zipper in 3D.
- **Primary citation:** Louros, N., Rousseau, F. & Schymkowitz, J. "CORDAX web server: an online platform for the prediction and 3D visualization of aggregation motifs in protein sequences." *Bioinformatics* **40**(5), btae279 (2024). doi:[10.1093/bioinformatics/btae279](https://doi.org/10.1093/bioinformatics/btae279)[^cordax]
- **Interface / availability:** web server at <https://cordax.switchlab.org/> with an integrated 3D viewer (JSmol) — click a residue to see the modeled zipper.
- **Maintained:** new and active (2024), from the VIB-KU Leuven Switch Laboratory — the same group behind TANGO and Waltz.
- **vs PVL:** **This is the comparison the paper must address head-on.** CORDAX is the only other recent tool that pairs aggregation prediction with 3D structural visualization in a web interface, and it carries the scientific authority of the TANGO/Waltz lab. But the two answer different structural questions: CORDAX visualizes *what the fibril core would look like* (a docked β-strand pair for a predicted hexapeptide motif), whereas PVL overlays predictions *on the full monomeric AlphaFold structure* of the submitted peptide and adds S4PRED secondary structure, the helix/SSW classification taxonomy, batch CSV/UniProt input, permalinks, and an MCP interface. CORDAX is stronger on cross-β core structural rigor and lab pedigree; PVL is stronger on multi-signal integration, the helix/switch question, cohort workflows, and open-source + programmatic access. Both were developed in the same 2024 window — treat CORDAX as PVL's closest peer, not a predecessor.

## 12. The 2021–2026 machine-learning frontier

The field is moving toward deep-learning and protein-language-model predictors. These matter for the paper's "future work" framing and for PVL's Phase I multi-predictor roadmap. Citations here were surfaced during research but several need re-verification before paper use (flagged):

- **ANuPP** — Prabakaran, R., Rawat, P., Kumar, S. & Gromiha, M. M. "ANuPP: a versatile tool to predict aggregation nucleating regions in peptides and proteins." *Journal of Molecular Biology* **433**(1), 166707 (2021). doi:[10.1016/j.jmb.2020.166707](https://doi.org/10.1016/j.jmb.2020.166707)[^anupp] — ensemble classifier on hexapeptide atomic features; reported to outperform TANGO/Waltz/PASTA/AGGRESCAN on its own benchmark. Web server (IIT Madras). Sequence-only, no visualization. *PVL uses TANGO rather than ANuPP for biological + reproducibility reasons (the scientific lead's choice); ANuPP is a candidate future provider, not a competitor on interface.*
- **AggrescanAI** (2026) — ProtT5 protein-language-model embeddings for residue-level APR prediction, from the Ventura group (UAB Barcelona). Released as a Colab notebook + GitLab code (open). Algorithmically ahead of TANGO on benchmarks but **not a deployed platform** — no web UI, batch mode, 3D, or API. *Author list / DOI not fully confirmed in research — re-verify before citing.*
- **RibbonFold** (2025, *PNAS*) — an AlphaFold2 adaptation that predicts full amyloid fibril **polymorph structures**. Operates at a different level than PVL (atomic fibril structure vs. aggregation/structure annotation); a natural downstream tool, not a competitor. *DOI [10.1073/pnas.2501321122](https://doi.org/10.1073/pnas.2501321122) reported but author list unconfirmed.*
- **Amylo-Pipe** (2026, bioRxiv preprint) — an integrated multi-tool aggregation + kinetics web server from the ANuPP lab; the closest tool to PVL's "integrated pipeline" positioning, but focused on aggregation rate/mechanism + gatekeeper scanning, not the helix/SSW taxonomy. Not yet peer-reviewed.
- **Cross-Beta DB** (2025) and **AggNet** (2025) — an ML benchmark+predictor for natural cross-β amyloids, and an ESM2+AlphaFold2 deep-learning APR predictor, respectively. Research tools; web deployment unconfirmed.

**Why this section matters for the paper:** PVL's TANGO-based aggregation scoring is not state-of-the-art on raw benchmark accuracy versus 2024–2026 ML predictors — and the paper should say so honestly. PVL's contribution is **not** "the best aggregation score." It is the *integration, the helix/switch scientific question, the visualization, and the reproducibility/ecosystem story*. The ML frontier is a roadmap opportunity (add a modern provider behind the existing forward-compatible overlay contract), not a threat to the thesis.

## 13. Curated databases (the field's ground truth)

- **AmyPro** — Varadi, M. *et al.* "AmyPro: a database of proteins with validated amyloidogenic regions." *Nucleic Acids Research* **46**(D1), D387–D392 (2018). doi:[10.1093/nar/gkx950](https://doi.org/10.1093/nar/gkx950)[^amypro] — curated, experimentally validated amyloid regions across all kingdoms. PVL draws on AmyPro (and UniProt + literature) to assemble its **Peleg-118** reference set (see [validation evidence](02_validation_evidence.md)).
- **WALTZ-DB** (above) — the hexapeptide amyloid benchmark.

These are not competitors; they are the datasets a paper benchmarks against.

---

## Where PVL's own predictors come from

For completeness, PVL's two vendored predictors:

- **TANGO** — see §1 above.
- **[S4PRED](../humans/02_the_science.md#3-s4pred)** — Moffat, L. & Jones, D. T. "Increasing the accuracy of single-sequence prediction methods using a deep semi-supervised learning framework." *Bioinformatics* **37**(21), 3744–3751 (2021). doi:[10.1093/bioinformatics/btab491](https://doi.org/10.1093/bioinformatics/btab491)[^s4pred] — a single-sequence 3-state secondary-structure predictor (helix/sheet/coil) using a BiLSTM ensemble. (Note: the repo's README acknowledgements and `PAPER_METHODS_REFERENCE.md` cite slightly different S4PRED bibliographic details; this should be reconciled before paper submission — flagged in [open questions](03_open_questions.md).)

---

## Feature matrix

| Tool | Year | What it predicts | Interface | Open source | Maintained | Visual / 3D | API / programmatic |
|------|------|------------------|-----------|-------------|------------|-------------|--------------------|
| **PVL** | 2026 | Helix · SSW · FF-Helix · FF-SSW classification + aggregation + biochem | Web dashboard + Python + CLI + MCP | **Yes (MIT)** | Active | **Yes — Mol\* overlay on AlphaFold** | **Yes — REST + MCP** |
| TANGO | 2004 | β-aggregation propensity | Web + binary | No (academic) | Stable | Plot only | Binary |
| Waltz | 2010 | Cross-β amyloid (hexapeptide PSSM) | Web + DB | No | Stable | Plot only | No |
| AGGRESCAN | 2007 | Aggregation hot spots | Web | Free service | Legacy | Plot only | No |
| AGGRESCAN3D 2.0 | 2019 | Structure-based aggregation + solubility | Web | Free service | Active | Structure-aware | **REST API** |
| PASTA 2.0 | 2014 | Cross-β pairing + disorder + SS | Web | Free service | Stable | Plot only | No |
| FoldAmyloid | 2010 | Amyloidogenic regions | Web | Free service | Legacy | Plot only | No |
| ZipperDB / 3D profile | 2010 | Steric-zipper (hexapeptide) | Precomputed DB | Free DB | Static | Structure templates | No |
| AmylPred2 | 2013 | Consensus amyloid (11 methods) | Web | Free service | Legacy | Plot only | No |
| MetAmyl | 2013 | Meta amyloid predictor | Web | Free service | Legacy | Plot only | No |
| ANuPP | 2021 | Aggregation nucleating regions (ML) | Web | No | Active | Plot only | No |
| AggreProt | 2024 | APRs (deep-learning ensemble) | Web | Free service | Active | Seq + struct viewer | No |
| **CORDAX** | 2024 | Aggregation motifs + fibril-core topology | Web | Free service | Active | **JSmol 3D zipper** | No |
| AggrescanAI | 2026 | APRs (ProtT5 language model) | Colab + GitLab | Yes (code) | Active | No | No |
| AmyPro (DB) | 2018 | Validated amyloid regions (database) | Web DB | Open data | Active | — | Download |

**One-line synthesis for the paper:** No existing tool combines (a) multi-algorithm analysis, (b) a helix/secondary-structure-switch fibril-formation taxonomy, (c) interactive 3D structural overlay *on the full AlphaFold monomer*, and (d) reproducibility-as-permalink + an AI-callable (MCP) interface in a single open-source instrument. Individual competitors beat PVL on individual axes — A3D on structure-based aggregation engineering, Waltz/ZipperDB on cross-β rigor, AggreProt/ANuPP/AggrescanAI on modern ML accuracy, and **CORDAX on 3D fibril-core visualization with TANGO/Waltz-lab pedigree** — but none occupy PVL's integration niche, and none answer PVL's specific helix/switch scientific question. CORDAX (2024) is the closest peer and should be named explicitly in the paper; PVL's defensible differentiators against it are the helix/SSW taxonomy, S4PRED integration, cohort/batch workflows, open-source licensing, and the MCP/ecosystem surface.

---

## References

[^rb2022]: Ragonis-Bachar, P., Rayan, B., Barnea, E., Engelberg, Y., Upcher, A. & Landau, M. "Natural antimicrobial peptides self-assemble as α-sheet conformations." *Biomacromolecules* (2022). doi:[10.1021/acs.biomac.2c00582](https://doi.org/10.1021/acs.biomac.2c00582)
[^tango]: <https://doi.org/10.1038/nbt1012> — *Nature Biotechnology* 22, 1302–1306 (2004). Tool: <https://tango.switchlab.org/>
[^waltz]: <https://doi.org/10.1038/nmeth.1432> — *Nature Methods* 7, 237–242 (2010). PubMed: <https://pubmed.ncbi.nlm.nih.gov/20154676/>
[^waltzdb]: <https://academic.oup.com/bioinformatics/article/31/10/1698/177770> — *Bioinformatics* 31, 1698–1700 (2015).
[^aggrescan]: <https://doi.org/10.1186/1471-2105-8-65> — *BMC Bioinformatics* 8, 65 (2007).
[^a3d]: 2.0 — <https://doi.org/10.1093/nar/gkz321>, *Nucleic Acids Research* 47(W1), W300–W307 (2019); original — <https://doi.org/10.1093/nar/gkv359>, *Nucleic Acids Research* 43(W1), W306–W313 (2015). Server: <http://biocomp.chem.uw.edu.pl/A3D2/>
[^pasta]: <https://doi.org/10.1093/nar/gku399> — *Nucleic Acids Research* 42(W1), W301–W307 (2014).
[^foldamyloid]: <https://doi.org/10.1093/bioinformatics/btp691> — *Bioinformatics* 26(3), 326–332 (2010).
[^zipperdb]: <https://doi.org/10.1073/pnas.0915166107> — *PNAS* 107(8), 3487–3492 (2010).
[^amylpred2]: <https://doi.org/10.1371/journal.pone.0054175> — *PLOS ONE* 8(1), e54175 (2013).
[^metamyl]: <https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0079722> — *PLOS ONE* 8(11), e79722 (2013).
[^aggreprot]: <https://academic.oup.com/nar/article/52/W1/W159/7683054> — *Nucleic Acids Research* 52(W1), W159–W169 (2024). Server: <https://loschmidt.chemi.muni.cz/aggreprot/>
[^cordax]: <https://doi.org/10.1093/bioinformatics/btae279> — *Bioinformatics* 40(5), btae279 (2024). Server: <https://cordax.switchlab.org/>
[^anupp]: <https://doi.org/10.1016/j.jmb.2020.166707> — *Journal of Molecular Biology* 433(1), 166707 (2021). Server: IIT Madras bioinformatics group.
[^amypro]: <https://doi.org/10.1093/nar/gkx950> — *Nucleic Acids Research* 46(D1), D387–D392 (2018).
[^s4pred]: <https://doi.org/10.1093/bioinformatics/btab491> — *Bioinformatics* 37(21), 3744–3751 (2021). Code: <https://github.com/psipred/s4pred>

> **Verification note.** DOIs for TANGO, Waltz, AGGRESCAN, AGGRESCAN3D (2015 + 2.0), PASTA 2.0, FoldAmyloid, ZipperDB, AmylPred2, AmyPro, CORDAX, and ANuPP were verified against the publisher pages during research (June 2026). For AggreProt and MetAmyl the resolvable publisher article URL is given in place of an unverified DOI string. The 2025–2026 frontier tools (AggrescanAI, RibbonFold, Amylo-Pipe, Cross-Beta DB, AggNet) were surfaced by search but their author lists / DOIs are **not** fully confirmed — re-resolve and verify every one before including it in the paper's reference list. Confirm author lists and page numbers against the publisher of record in all cases.
