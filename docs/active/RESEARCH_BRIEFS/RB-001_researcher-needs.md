# What Bench Scientists / Computational Biologists / Structural Biologists Actually Need from a Peptide Prediction Platform — Research Brief

**Brief ID**: RB-001
**Date**: 2026-05-08
**Author**: T-RES (research terminal)
**Mission**: Identify the top researcher-facing needs for a peptide prediction platform like PVL, covering workflow integration, reproducibility, discovery gaps, data ingestion, output formats, trust signals, collaboration, and education.
**Reading time**: ~12 minutes

---

## §1 — TL;DR (5 bullets)

- The single biggest unmet need across existing tools (TANGO web, PASTA 2.0, AGGRESCAN, Waltz, APD3) is **multi-algorithm comparison with visual disagreement scoring in one session** — none of them do this; PVL already partially does it and should make it the explicit headline feature.
- **Reproducible exports beat "download CSV"**: researchers in 2026 expect a shareable permalink that re-runs their exact analysis AND a supplementary-table-ready CSV with all method parameters embedded as metadata columns. Neither exists in any competitor.
- **Jupyter notebook export with re-runnable code** is the highest-leverage single feature for computational biology adoption — it converts a web session into a citable, pipeable artefact. Effort moderate (16–24 h), wave slot Wave 2/3.
- **Trust signals are glaringly absent** from every existing aggregation predictor: no tool shows confidence intervals, predictor disagreement bands, or in-UI gold-standard validation accuracy numbers. PVL can own this niche in one sprint.
- ChimeraX / PyMOL handoff via mmCIF + annotation JSON bundle is wanted by structural biologists but has LOW demand urgency vs reproducibility features — park it at Wave 4.

---

## §2 — Context

This brief was commissioned on 2026-05-08 by Said (M-007 in the T-RES mission queue), triggered by the directive that the research terminal investigate product-direction improvements for PVL — not just AI workflow. PVL is pre-JOSS-paper, heading toward bio.tools registration and Zenodo DOI (Phase A roadmap). Said heads to MIT in September 2026 with ~2 hrs/month available for PVL afterward. The brief must produce a top-5 feature list implementable solo in 8–40 hour chunks.

---

## §3 — Options Evaluated (Feature Categories)

### Category A — Workflow Integration (ChimeraX / PyMOL / Mol* / Jupyter / AlphaFold DB)

- **What it is**: Mechanisms for a researcher to take PVL's per-residue prediction data and continue analysis in a 3D visualization tool or notebook without manual re-entry.
- **License / cost**: OSS tools involved (ChimeraX, PyMOL open-source, Mol*, Jupyter) — no licensing cost to PVL.
- **Maturity**: Mol* is the current RCSB/PDB standard viewer (2020–present); ChimeraX has active Python bundle ecosystem; Jupyter notebook export is standard in Galaxy (2024 update) and cellxgene.
- **Fit for PVL**: Python + TypeScript stack fits well. mmCIF is pure-text; ChimeraX session bundles are binary but well-documented.
- **Pros**: High visibility for structural biologists. ChimeraX bundle export is a rare differentiator — AggreProt (2024, Oxford NAR) emphasizes 3D visualization as novel, but does not offer session export. AlphaFold DB API enables auto-fetch of the full-protein structure matching a UniProt accession already in PVL's pipeline.
- **Cons**: ChimeraX `.cxs` session format is versioned and can break across ChimeraX releases. Mol* embedding in-browser is feasible but adds 2–3 MB to bundle. PyMOL open-source lacks session save API without commercial license.
- **Migration cost**: Mol* in-browser embed: 16 h. mmCIF + annotation JSON bundle export: 8 h. ChimeraX session: 24 h. AlphaFold DB auto-link (already partial): 4 h.

**Verdict**: mmCIF + JSON bundle export is high-value, low-effort. Mol* in-browser is medium-effort and currently planned (Wave 2). ChimeraX `.cxs` is nice-to-have but low urgency. Recommend prioritizing mmCIF/JSON bundle at Wave 2.

---

### Category B — Reproducibility Provenance (RO-Crate, Bioschemas, Snakemake/Nextflow, FAIR metadata)

- **What it is**: Mechanisms for a researcher to attach machine-readable provenance to an analysis so that it can be re-run identically by a peer reviewer or submitted as supplementary material with a paper.
- **License / cost**: RO-Crate spec is open (CC BY 4.0). Bioschemas is a Schema.org extension, no cost. Snakemake/Nextflow integration would require a wrapper workflow; no licensing cost.
- **Maturity**: Galaxy platform exports histories as RO-Crate objects as of 2024 update [6]. ACM REP '25 (July 2025) hosted a tutorial on "Improving FAIRability with RO-Crates and Bioschemas" [7]. RO-Crate 1.1 is stable. Workflow Run Crate profile (extends RO-Crate) is under active PLOS One-cited development [3].
- **Fit for PVL**: Solo-maintainer risk is real. Full RO-Crate is 16–32 h to implement properly. A simpler near-term proxy: embed all tool versions, thresholds, sequence input, and timestamps as metadata columns in the export CSV/JSON. That satisfies peer-reviewer needs without full RO-Crate overhead.
- **Pros**: JOSS reviewers and ELIXIR bio.tools registration both look for FAIR compliance signals. Embedding metadata in exports is a first step that requires no external spec dependency.
- **Cons**: Full RO-Crate requires a JSON-LD context file and spec conformance testing. Snakemake/Nextflow wrapper is a separate product (low value for web-server users; high value for HPC users). Risk of over-engineering vs. what most researchers actually use.
- **Migration cost**: Metadata-in-export (pragmatic FAIR proxy): 8 h. Full RO-Crate: 32 h. Snakemake wrapper: 40 h (separate repo, out of scope for solo MIT semester).

**Verdict**: Implement metadata-in-export now (Wave 1/2), add Bioschemas markup to public pages for bio.tools/ELIXIR (4 h, Phase A/B). Defer RO-Crate and Snakemake to post-MIT or community contribution.

---

### Category C — Discovery Features Missing in Competitors

- **What it is**: Feature gaps in PASTA 2.0, Waltz, AGGRESCAN, TANGO web, AlphaFold DB, PEP-FOLD, APD3 that PVL can own.
- **Gap analysis** (literature + tool inspection):

| Tool | What it does | What it lacks |
|---|---|---|
| TANGO web | β-aggregation propensity per residue | No visualization, no S4PRED, no batch, no comparison, no export |
| AGGRESCAN | APR identification | Single-algorithm, ~2008 methodology, no inter-tool comparison |
| PASTA 2.0 | Energy-based aggregation + β-sheet pairing | No secondary structure, no fibrils, no visualization |
| Waltz | Amyloid prediction | Single algorithm, non-visual |
| AggreProt (2024) | Deep-learning APR predictor, up to 3 sequences comparison | No secondary structure, no FF-Helix, no batch CSV, no Jupyter export |
| AlphaFold DB | 3D structure, pLDDT, AlphaMissense heatmap | Not a peptide aggregation predictor; downstream tool |
| PEP-FOLD | Peptide structure prediction | No aggregation; complementary, not competitor |
| APD3 | Antimicrobial peptide database | Different niche |

  - **PVL's unique position**: Only tool combining TANGO + S4PRED + FF-Helix + SSW + biochemical metrics + interactive visualization + CSV batch.
  - **Unowned gap #1**: Multi-predictor disagreement score. When TANGO says "aggregate" but AGGRESCAN says "clean", no tool surfaces this conflict to the user. PVL's consensus pipeline is the closest existing implementation.
  - **Unowned gap #2**: In-UI benchmark accuracy display. No competitor shows "this predictor has X% sensitivity on the Staphylococcus 2023 dataset (N=2916, 66 validated)" next to its results. PVL has this dataset internally.
  - **Unowned gap #3**: Per-residue profile overlays across multiple peptides from the same analysis session. AggreProt allows 3 sequences; PVL allows N but does not yet offer side-by-side profile overlays.

- **Migration cost**: Disagreement score in UI: 8 h (data already computed). In-UI accuracy badge from gold standard: 12 h. Side-by-side per-residue overlays: 16 h.

---

### Category D — Data Ingestion Gaps

- **Current PVL**: FASTA single, CSV bulk, UniProt accession query.
- **Gaps**:
  - **FASTA bulk** with multi-entry `.fasta` files: PVL accepts CSV but not direct FASTA upload. Bioinformaticians always have FASTA files. Effort: 8 h.
  - **Mass spec .mzML**: low-priority, high-effort, narrow niche.
  - **PDB-derived peptide extraction**: Given a PDB ID, extract flexible/disordered loop regions and analyze them. Effort: 24–32 h. Niche but real (crystallographers, cryo-EM).
  - **UniProt keyword/organism batch**: partially supported by PVL's UniProt query already.
- **Verdict**: FASTA bulk is low-effort, high-demand, do it at Wave 1. .mzML and PDB extraction are Wave 3/4 or community-contributed.

---

### Category E — Output Formats Researchers Ask For

- **Supplementary-table CSV with metadata columns**: 4 h, dramatic increase in scientific reusability.
- **Publication-ready figure pack**: PVL has SVG/PNG; needs "all charts as one multi-panel figure". 12 h (already on roadmap as A6).
- **BibTeX of methods** (`.bib` for TANGO, S4PRED, Hamodrakas 2007, PVL itself): 2 h. Not implemented in any competitor.
- **Jupyter notebook export** (`.ipynb` re-running against pvl-py): 16–24 h. Single highest-leverage adoption move.
- **ChimeraX session bundle** (`.cxs` + annotation `.tsv`): 24 h. Park at Wave 4.
- **Verdict**: BibTeX (2 h) + metadata-in-CSV (4 h) ship in Wave 1.

---

### Category F — Trust Signals in Scientific UIs

- **Literature context**: 2021 Briefings in Bioinformatics benchmark [1] evaluated 9 aggregation prediction tools — accuracy CIs ranged 68–87.6% across datasets. No tool surfaces these numbers in-UI. AggreProt (2024) improved deep-learning accuracy but does not show prediction confidence bands.
- **Features**:
  - **Predictor disagreement score**: surface "predicted by 2 of 3 algorithms" as confidence signal. Partially implemented in PVL's consensus.
  - **Gold-standard validation badge**: "On Staphylococcus 2023 (N=66 validated), PVL classified X% correctly at these thresholds." 12 h.
  - **Per-predictor uncertainty note**: tooltip explaining TANGO confidence depends on length/composition; FF-Helix has known polyglutamine FP rate. ~4 h.
  - **Error bands on position bars**: requires uncertainty quantification model — low priority without one.
- **Verdict**: Disagreement score (8 h) + gold-standard accuracy badge (12 h) = highest trust impact per hour. Both Wave 2.

---

### Category G — Collaboration

- **What PVL needs**: Read-only shareable permalink encoding sequences + threshold settings. Server-side session store keyed to UUID. Effort: 24 h. Wave 3.
- **Group workspaces + embargo**: Niche; permalink covers 90% of collaboration use case.
- **Verdict**: Permalink share-links are Wave 3. Group workspaces post-MIT.

---

### Category H — Educational Use

- **Demand signal**: RCSB PDB explicitly supports educational use; Galaxy has 366 tutorials (2024). Educational adoption drives citation accumulation (BLAST → undergrad bioinformatics).
- **Gap**: No guided interpretation text. A student looking at a peptide radar chart doesn't know what "high μH score means for membrane-active aggregation" without a reference card. In-UI "interpretation guide" panel (collapsible, 500 words, threshold explanations). Effort: 8 h doc + 4 h UI.
- **Verdict**: Low cost (12 h), high citation yield. Add to Wave 2 Help/About.

---

## §4 — Comparison Matrix (Top Features by Impact × 1/Cost)

| Feature | Researcher Impact | Effort (h) | Wave | Competitor gap? |
|---|---|---|---|---|
| BibTeX of methods export | High | 2 | 1 | Yes — no competitor |
| Metadata columns in CSV export | High | 4 | 1 | Yes |
| FASTA bulk upload | High | 8 | 1 | Partial gap |
| Predictor disagreement score (UI) | High | 8 | 2 | No competitor |
| In-UI gold-standard accuracy badge | High | 12 | 2 | No competitor |
| Interpretation guide panel | Medium-High | 12 | 2 | No competitor |
| Jupyter notebook export | High | 20 | 2-3 | No competitor |
| Permalink share-links | Medium-High | 24 | 3 | Galaxy has it; no peptide tool |
| mmCIF + JSON bundle export | Medium | 8 | 2 | No competitor |
| One-click figure pack | High | 12 | 2 | No competitor |
| PDB-derived peptide extraction | Medium | 28 | 3-4 | No competitor |
| Full RO-Crate export | Low-Medium | 32 | Post-MIT | Galaxy yes; not peptide-specific |
| ChimeraX session bundle | Low-Medium | 24 | 4 | No competitor |
| .mzML mass spec input | Low | 40+ | Post-MIT | No competitor |
| Group workspaces + embargo | Low | 60+ | Post-MIT | — |

---

## §5 — Recommendation

**Top 5 features for the next 6 months, ordered by impact × (1/cost):**

**1. BibTeX of methods export** (Wave 1, 2 h) — Click to download a `.bib` with TANGO, S4PRED, Hamodrakas 2007, and PVL itself pre-filled. Removes the #1 friction between "used the tool" and "cited it correctly." Pure static file.

**2. Metadata columns in CSV export** (Wave 1, 4 h) — Add predictor version, threshold values per predictor, run date (ISO 8601), sequence source as metadata columns/header. Pragmatic FAIR without RO-Crate overhead.

**3. FASTA bulk upload** (Wave 1, 8 h) — Multi-entry `.fasta` directly. Removes biggest input barrier for proteomics/bioinformatics users. CSV format is friction many wet-lab researchers won't bother with.

**4. Predictor disagreement score + in-UI gold-standard accuracy badge** (Wave 2, 20 h combined) — Surface consensus disagreement as visual trust indicator ("2 of 3 agree — moderate confidence"). Add static accuracy card from Staphylococcus 2023 (N=66 validated). Strongest trust signal in the aggregation prediction space, owned by no competitor.

**5. Jupyter notebook export** (Wave 2-3, 20 h) — Generate `.ipynb` using pvl-py. Pre-filled cells with input sequences, threshold config, result tables. Converts PVL from web form into citable, pipeable research instrument. Highest single adoption-leverage move for computational biology labs (PLOS Comp Biol 2024 [8]).

**Rejected (for now):**
- Full RO-Crate: 32 h exceeds benefit pre-paper; defer to community contribution
- ChimeraX session: niche, 24 h, Wave 4
- Permalink share-links: correct feature, wrong time — needs Celery/Redis (Phase B1) stable; Wave 3
- .mzML input: different research community, heavy dependency, post-MIT

---

## §6 — Implementation Plan

### Feature 1 — BibTeX export
- Effort: 2 h
- Wave: 1 (Phase A quick-win)
- Files: `ui/src/pages/Results.tsx` (button), new `ui/src/lib/exportBibtex.ts`. Backend: none.
- New ADR: No
- Roadmap edit: A6.5 in Phase A

### Feature 2 — Metadata columns in CSV export
- Effort: 4 h
- Wave: 1
- Files: backend export service, `backend/schemas/api_models.py` may need `run_metadata` field (CHECK WITH SAID — protected schema)
- New ADR: ADR-013 (proposed below)
- Roadmap edit: A6.6

### Feature 3 — FASTA bulk upload
- Effort: 8 h
- Wave: 1
- Files: `ui/src/pages/Upload.tsx`, backend FASTA parser, input validation
- New ADR: No

### Feature 4 — Predictor disagreement + accuracy badge
- Effort: 20 h combined
- Wave: 2
- Files: `ui/src/components/ResultsKpis.tsx`, `ui/src/lib/consensus.ts`, `ui/src/components/EvidencePanel.tsx`, possibly new `TrustSignalCard.tsx`
- New ADR: ADR-014 (proposed below)

### Feature 5 — Jupyter notebook export
- Effort: 20 h
- Wave: 2-3
- Files: new `ui/src/lib/exportNotebook.ts`, optional `/api/export/notebook` (could be purely frontend), pvl-py as re-runnable kernel

---

## §7 — Proposed ADR Drafts

```markdown
## ADR-013 — PVL exports include FAIR metadata + BibTeX
**Date**: 2026-05-08 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: Researchers using PVL in publications need citable, reproducible output. No competitor provides this. Current CSV exports lack provenance metadata.
**Decision**: All CSV/JSON exports SHALL include: predictor name + version, threshold values per predictor, run date (ISO 8601), sequence source (FASTA / UniProt / manual), and a BibTeX download endpoint for methods used in that run.
**Reasoning**: Pragmatic FAIR compliance without full RO-Crate. Aligns with JOSS paper-readiness. Total < 8 h.
**Implication**: backend export service receives run metadata from analysis pipeline. api_models.py RunResult carries `run_metadata` object (new field, backwards-compatible if nullable).
**Evidence**: RB-001
```

```markdown
## ADR-014 — Predictor disagreement + gold-standard accuracy in UI
**Date**: 2026-05-08 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: Researchers cannot tell from any existing peptide prediction tool whether to trust a prediction. PVL's consensus module already computes multi-predictor agreement; Staphylococcus 2023 benchmark (N=2916, 66 validated) is available.
**Decision**: Results dashboard SHALL display (a) a "consensus confidence" indicator showing how many predictors agree on each classification, and (b) a static accuracy card derived from gold-standard benchmark at current threshold settings.
**Reasoning**: Strongest trust signal in the aggregation predictor space. Directly addresses reviewer skepticism about computational predictions.
**Implication**: Consensus confidence is UI-only. Accuracy badge requires precomputing accuracy curves per threshold combination as static JSON lookup. Static precomputation keeps runtime cost zero.
**Evidence**: RB-001, Staphylococcus 2023 dataset (internal)
```

---

## §8 — Sources Cited

1. [Evaluation of in silico tools for prediction of protein and peptide aggregation on diverse datasets — Briefings in Bioinformatics, 2021](https://academic.oup.com/bib/article/22/6/bbab240/6309925) — Benchmark showing wide variance in accuracy across 9 aggregation prediction tools; CI ranges cited for APPNN (68–87.6%).
2. [AggreProt: a web server for predicting and engineering aggregation prone regions in proteins — Nucleic Acids Research, 2024](https://academic.oup.com/nar/article/52/W1/W159/7683054) — Most recent competing tool; deep-learning APR + 3-sequence comparison; lacks secondary structure, FF-Helix, batch CSV, Jupyter export.
3. [Recording provenance of workflow runs with RO-Crate — PLOS One, 2024](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0309210) — Establishes RO-Crate as FAIR provenance standard for computational workflow outputs; adopted in Galaxy 2024.
4. [AlphaFold Protein Structure Database 2025: a redesigned interface and updated structural coverage — Nucleic Acids Research, 2025](https://academic.oup.com/nar/advance-article/doi/10.1093/nar/gkaf1226/8340156) — 2025 redesign added BLAST sequence search (most-requested feature), Foldseek, AlphaMissense heatmap.
5. [PASTA 2.0: an improved server for protein aggregation prediction — Nucleic Acids Research, 2014](https://academic.oup.com/nar/article/42/W1/W301/2437190) — Closest competitor for energy-based aggregation; lacks visualization, batch, secondary structure, export beyond text.
6. [Galaxy platform for accessible, reproducible, and collaborative data analyses: 2024 update — Nucleic Acids Research, 2024](https://academic.oup.com/nar/article/52/W1/W83/7676834) — Galaxy 2024 added RO-Crate history export, permanent shareable links, Zenodo/S3 integration.
7. [Improving FAIRability of your research outcomes with RO-Crates and Bioschemas — ACM REP '25](https://philreeddata.github.io/acmrep25/) — July 2025 tutorial; community push for RO-Crate + Bioschemas in research software.
8. [Using interactive Jupyter Notebooks and BioConda for FAIR and reproducible biomolecular simulation workflows — PLOS Computational Biology, 2024](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1012173) — Establishes Jupyter + BioConda as standard for FAIR biomolecular workflows; 17 community workflows in 2024.1 release.
9. [Computational methods to predict protein aggregation — ScienceDirect / Current Opinion in Structural Biology, 2022](https://www.sciencedirect.com/science/article/pii/S0959440X22000161) — Review confirming single-algorithm, non-visual nature of major aggregation prediction methods.
10. [Computational reproducibility of Jupyter notebooks from biomedical publications — GigaScience, 2024](https://academic.oup.com/gigascience/article/doi/10.1093/gigascience/giad113/7516267) — Audit showing most published notebooks fail to re-run; validates that pre-validated notebooks (PVL + pvl-py) is a real differentiator.

General domain knowledge (no single source): standard peptide analysis workflow (FASTA → web tool → CSV → figure → paper), demand for BibTeX in LaTeX-heavy structural biology, PyMOL OSS license limitations on session save.

---

## §9 — Open Questions / Things to Revisit

- **Reassess .mzML input in 12 months** — proteomics-to-aggregation pipeline interest may grow as cryo-EM-resolved amyloid structures increase in PDB. Check late 2026.
- **PDB-derived peptide extraction** — feasible at Wave 4 if DESY K8s stable by Q1 2027 (PDB REST + DSSP disorder scoring).
- **RO-Crate community contribution** — open as "good first issue" once PVL has GitHub community post-bio.tools registration.
- **AlphaFold DB sequence-based search integration** — AF DB added BLAST search 2025. PVL could auto-link UniProt → AF DB BLAST page; 2 h, revisit Wave 2.
- **ChimeraX 1.x session format stability** — verify `.cxs` is stable before investing 24 h. Check changelog at Wave 4 planning.

---

## §10 — Cross-References

- Affects: ADR-013 (PROPOSED — FAIR export formats), ADR-014 (PROPOSED — trust signals)
- Affects: ROADMAP.md Phase A (A6.5 BibTeX, A6.6 metadata CSV), Phase B (FASTA upload), Phase H (research integrations)
- Affects: MASTER_PUSH_PLAN.md Wave 1 (quick wins), Wave 2 (trust signals + Jupyter notebook)
- Related: M-003 (vector store, similar-peptides search — informs session state for permalink share-links)
- Supersedes: none (first brief)

---

## §11 — Decisions Said needs to make before implementation

1. Is `backend/schemas/api_models.py` allowed to receive a new nullable `run_metadata` field for the metadata-in-CSV feature, or must this be handled purely at the export layer without schema changes?
2. Should BibTeX export be a frontend-only static download (no new endpoint) or a backend-generated endpoint so the BibTeX stays in sync with predictor versions automatically?
3. Gold-standard accuracy badge: is the Staphylococcus 2023 dataset (N=2916, 66 validated) cleared for display in the public UI, or is it embargoed pending Peleg's paper?
4. Jupyter notebook export: use pvl-py (in `pvl-py/`) as the re-runnable kernel, or target the public PVL API directly so the notebook works without installing pvl-py locally?
5. Wave assignment: are Wave 1 quick-wins (BibTeX, metadata-CSV, FASTA upload) targeted for pre-MIT (before Sept 2026), and Wave 2 features (trust signals, Jupyter) for the community-contribution window after MIT?
