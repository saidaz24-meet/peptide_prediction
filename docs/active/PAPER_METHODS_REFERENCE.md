# PVL — Paper Methods Reference

> **Purpose**: a single, citation-ready reference for the Methods section of the PVL paper.
> Every algorithm, dataset, tool, and piece of infrastructure used to build and validate PVL is listed here with version, parameters, and provenance.
> Hand this document to Peleg as the source of truth while she drafts.

**Maintained by**: Said Azaizah (lead developer)
**Last updated**: 2026-06-18
**PVL version covered**: v0.3.0 (main HEAD as of 2026-06-08)

---

## 1. Scientific pipeline

### 1.1 TANGO — aggregation propensity

- **Source**: Fernandez-Escamilla et al., *Nat. Biotechnol.* **22**, 1302–1306 (2004).
- **Implementation**: original Fortran binary, vendored at `backend/external/tango/`.
- **Invocation**: `backend/tango.py` runs TANGO as a subprocess, one peptide per call, deterministic (no RNG seed).
- **Parameters used**: pH 7.4, temperature 298 K, ionic strength 0.1 M, N-/C-terminal protection off.
- **Stretch detection**: contiguous residues whose β-aggregation score crosses `agg_threshold = 5.0` (TANGO standard) with `avg_limit = 0` (Peleg authoritative answer 2026-06-03).
- **Outputs surfaced**: per-residue β-aggregation profile, mean/max stretch scores, stretch ranges.
- **Note for paper**: TANGO outputs are aggregation propensity, not fibril formation. PVL never claims TANGO predicts fibrils.

### 1.2 S4PRED — secondary structure

- **Source**: Moffat & Jones, *Bioinformatics* **37**, 3744–3751 (2021).
- **Implementation**: PyTorch ensemble of 5 BiLSTM models, vendored at `backend/external/s4pred/`.
- **Invocation**: `backend/s4pred.py`, batched per request.
- **Model**: `weights_s4pred.pt` (ensemble) — the published checkpoint.
- **Outputs surfaced**: 3-state secondary structure (H / E / C) per residue + per-residue confidence.
- **Role**: **primary** helix predictor (PSIPRED was used in early prototypes but removed; see ADR-001 in `docs/active/DECISIONS.md`).

### 1.3 FF-Helix — fibril-forming helix classification

- **Definition**: a peptide is **FF-Helix** if it satisfies BOTH:
  1. S4PRED predicts ≥ `helix_pct_threshold` of residues as H (default 50%).
  2. Fauchère-Pliska mean hydrophobicity ≥ `mu_h_threshold` (default 0.7).
- **Provenance**: per Peleg's 2026-06-03 authoritative answer + Hamodrakas 2007 framing.
- **Implementation**: `backend/auxiliary.py::compute_ff_helix()`.
- **Axiom enforced**: `FF-Helix ⊆ Helix` at the normalize layer (`backend/services/normalize.py`).

### 1.4 SSW — secondary structure switching

- **Definition**: residue positions where TANGO predicts β-aggregation AND S4PRED predicts helix (H). Canonical OR over residues, flagged at peptide level if any residue qualifies.
- **Provenance**: Peleg 2026-06-03 — "axiom of symmetry of treatment", NOT a subset relation.
- **Implementation**: `backend/auxiliary.py::compute_ssw()`, unified column at the dataframe layer (ISSUE-032 fix).
- **Outputs surfaced**: SSW boolean, SSW residue mask, SSW % (positions in switch / length).

### 1.5 FF-SSW — fibril-forming SSW

- **Definition**: SSW = true AND mean hydrophobicity ≥ `mu_h_threshold`.
- **Axiom enforced**: `FF-SSW ⊆ SSW`.

### 1.6 Biochemistry

- **Charge at pH 7.4**: Henderson-Hasselbalch with Lehninger pKa table. `backend/biochem_calculation.py::net_charge()`.
- **Hydrophobicity**: Fauchère-Pliska octanol scale (1983). Used both for FF-Helix gating and for the µH calculation.
- **Hydrophobic moment (µH)**: Eisenberg helical-wheel formula with periodicity 100°, sliding window of 11 residues (default), `backend/biochem_calculation.py::hydrophobic_moment()`.

### 1.7 4-class classification

Every peptide is assigned to one of four mutually-non-exclusive flags:

| Class    | Subset of | Definition |
|----------|-----------|------------|
| Helix    | —         | S4PRED %H ≥ threshold |
| FF-Helix | Helix     | Helix AND µH ≥ threshold |
| SSW      | —         | ∃ residue with both H (S4PRED) and β-agg (TANGO) |
| FF-SSW   | SSW       | SSW AND µH ≥ threshold |

Venn diagram in the Results dashboard renders these four sets with the FF-* ⊆ * axioms enforced.

---

## 2. Reference datasets

### 2.1 Peleg's experimentally validated fibril-forming peptides (≤40 aa)

- **File**: `Experementaly_validated_Fibril_forming_Proteins_Less_than_or_Equal_to_40aa.xlsx`.
- **Curator**: Dr. Peleg Ragonis-Bachar (Technion).
- **N**: 118 peptides.
- **Sources**: UniProt General, AmyPro, AmyPro literature, UniProt AMP collection.
- **Categories**: FF (fibril-forming), AF-AMP (antimicrobial + amyloid), Pathogenic amyloid, Functional amyloid, UniProt AMPs.
- **Columns**: Entry · UniProt ID · Organism · PubMed · Original database · Antimicrobial flag · General Category · Fibril formation reference · Sequence · Length.
- **Role in paper**: positive control set for FF-Helix and FF-SSW recall benchmarks.
- **Where it lives in PVL**: shipped as a pre-computed example dataset (see §6 below).
- **Notable members**: HD6 (Q01524), Melittin (P01501 44-69), Uperin-3.5 (P82042) — all dual AMP+fibril.

### 2.2 Staphylococcus 2023 gold-standard

- **Reference**: see `memory/reference_gold_standard_dataset.md`.
- **N**: 2,916 peptides; 66 with experimental labels.
- **Role**: blind benchmark for ranking + classification.

### 2.3 Paper case-study peptides

- **Uperin frog AMPs** (5 members).
- **Short UniProt** — sequences ≤40 aa.
- **Nature 2026 microproteins**.
- **EMBL extremophile collection**.
- See `memory/project_paper_case_studies.md` for the exact UniProt accessions.

---

## 3. Web platform

### 3.1 Stack

| Layer          | Technology                              | Version |
|----------------|------------------------------------------|---------|
| Backend        | Python 3.11 + FastAPI + Uvicorn          | 0.115 / 0.30 |
| Async pool     | `asyncio.to_thread` over subprocess calls | — |
| Frontend       | React 18 + TypeScript 5 + Vite           | 18.3 / 5.4 / 5.4 |
| Styling        | Tailwind CSS + shadcn/ui                 | 3.4 |
| State          | Zustand (3 stores)                       | 4.5 |
| Charts         | Recharts + raw SVG                       | 2.13 |
| 3D viewer      | Mol* (molstar)                           | 4.0 |
| Animation      | Framer Motion                            | 11 |
| Routing        | react-router-dom                         | 6 |

### 3.2 Surfaces

1. **Quick Analyze** — single sequence input.
2. **Start Analysis (Upload)** — CSV / TSV / XLSX / FASTA.
3. **UniProt query** — accession / keyword / organism / cross-search.
4. **Results dashboard** — KPIs · Venn (4-class) · threshold tuner · Smart Candidate Ranking.
5. **PeptideDetail** — Mol* AlphaFold overlay · sliding-window profiles · correlation matrix.
6. **Cohort/Database comparison** — paired biochem distributions.

### 3.3 Determinism guarantees

- Same sequence + same config → identical numerical output across single-sequence and batch paths (enforced by 538 backend pytest cases).
- No RNG in the prediction path.
- Threshold changes re-classify peptides client-side without re-running TANGO/S4PRED.

---

## 4. Multi-surface ecosystem

PVL is not just a web app. The same scientific pipeline is exposed through 5 surfaces:

1. **Web app** — https://pvl-domain (Hetzner CX33, DESY VM migration queued).
2. **MCP server** — Wave 2 §I, routes `get_peptide_detail`, `rank_candidates`, `compare_cohorts`. Lets agents (Claude, Cursor, ChatGPT) query PVL natively.
3. **pvl-py** — Python client library (`pip install pvl-py`), wraps the HTTP API.
4. **pvl-cli** — command-line interface (`pvl analyze peptides.csv`).
5. **REST API** — documented at `/api/docs` (FastAPI auto-generated OpenAPI 3.1).

This ecosystem reference is the basis for the §"PVL Ecosystem" subsection of the paper.

---

## 5. AI tools used during development

This section is for the paper's **Acknowledgements** + the **Author Contributions** clarification. Every AI tool that materially helped is named here with its role.

### 5.1 LLM-assisted development

| Tool | Role | Boundaries |
|------|------|------------|
| **Claude Code (Anthropic)** | Pair-programmer for backend services, frontend components, test scaffolding, documentation generation. Multi-terminal CEO/sub-terminal orchestration pattern. | All scientific algorithm choices (TANGO parameters, FF-Helix definition, axioms) were made by Peleg + Said. AI wrote no scientific decisions. |
| **Cursor (VS Code fork)** | Editor with inline AI completion for refactoring + boilerplate. | Same as above. |
| **CodeRabbit** | Automated AI code review on every PR. | Advisory only; humans merge. |

### 5.2 Specialized agents (subagents)

PVL's `.claude/` config defines specialized subagents that run inside Claude Code sessions:

- **Explore** — read-only search agent for "where is X defined" queries.
- **Plan** — software-architect agent for multi-file change planning.
- **code-reviewer** — PVL-specific reviewer that knows API contract rules, null semantics, single/batch consistency.
- **research-agent** — UX best-practice + bioinformatics convention research.
- **test-writer** — pytest + vitest test scaffolding.

### 5.3 Multi-terminal orchestration

Said's development workflow uses a **CEO-terminal / sub-terminal** pattern:

- **T1 (CEO)** — maintains `PLAN.md`, writes per-terminal instruction docs, coordinates merges.
- **T2, T3, T4** — focused-scope worker terminals, each reading its instruction doc.
- **T5** — manually-prompted deep research terminal (Tier 2 — for hard scientific questions).

This is a process methodology, not a runtime architecture. Worth a footnote in the paper.

### 5.4 MCP servers in dev loop

- **claude.ai Figma** — design → code sync.
- **claude.ai Sentry** — production error triage.
- **claude.ai Supabase** — auxiliary database (auth + analytics, not the prediction pipeline).
- **playwright / puppeteer** — automated browser testing.

### 5.5 Cowork

Cowork (cowork.ai) was used to dispatch design-implementation prompts (V10-7, V10-8, V10-9 dispatches). Output reviewed by Said before merge.

### 5.6 Galagos.ai

Reference inspiration for Phase I multi-predictor UX and G5 auto-PDF report generation. No code shared.

---

## 6. Pre-computed example datasets

To eliminate first-load latency (the gold-standard set was previously taking 5+ min to compute live), PVL ships pre-computed JSON artifacts:

- **Peleg-118** — `backend/data/precomputed/peleg_118.json`
- **Staphylococcus 2023 gold-standard** — `backend/data/precomputed/gold_2023.json`
- **Uperin frog AMPs** — `backend/data/precomputed/uperin.json`

Each artifact contains the full normalized response (same shape as the live `/predict` endpoint) plus a `precomputed_at` ISO-8601 timestamp and `pvl_version` for provenance. The frontend loads these directly when a user clicks "Try example".

---

## 7. Reproducibility

### 7.1 Code

- **Repository**: https://github.com/saidaz24-meet/peptide_prediction
- **License**: MIT
- **Tag for the paper**: `v0.3.0` (matches `CITATION.cff`).
- **Concept DOI** (Zenodo, always-latest): mints on first release; see `CITATION.cff`.
- **Versioned DOI** (Zenodo, v0.3.0): mints on first release; see `CITATION.cff`.

### 7.2 Citation

```bibtex
@software{azaizah2026pvl,
  author       = {Azaizah, Said and Ragonis-Bachar, Peleg and Golubev, Aleksandr},
  title        = {Peptide Visual Lab (PVL): v0.3.0},
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v0.3.0},
  doi          = {10.5281/zenodo.XXXXXXX},
  url          = {https://github.com/saidaz24-meet/peptide_prediction}
}
```

### 7.3 Permalinks

Every analysis can be exported as a **permalink URL** that encodes: input sequence(s), thresholds, predictor flags, and PVL version. Re-opening the URL on any PVL deployment reproduces the exact analysis (assuming same predictor versions).

### 7.4 Observability

- **Sentry** — production error tracking with release tagging + source maps. Runbook: `docs/active/SENTRY_RUNBOOK.md`.
- **CI** — GitHub Actions on every PR: lint + typecheck + 538 backend pytest + 611 frontend vitest. Green required to merge.

---

## 8. Quality gates at v0.3.0

| Gate                        | Count   | Status |
|-----------------------------|---------|--------|
| Backend tests (pytest)      | 538     | Green  |
| Frontend tests (vitest)     | 611     | Green  |
| TypeScript strict (`tsc --noEmit`) | —       | Clean  |
| Ruff lint                   | —       | Clean  |
| Backend↔UI contract check   | —       | Synced |
| Sentry release tagged       | v0.3.0  | Done   |

---

## 9. Acknowledgements (suggested wording for the paper)

> PVL was developed by Said Azaizah (lead developer; Technion / DESY) with scientific algorithms and review by Dr. Peleg Ragonis-Bachar (Technion) and scientific advising and deployment infrastructure by Dr. Aleksandr Golubev (DESY CSSB). Hosting provided by DESY CSSB Hamburg. Implementation used AI-assisted development tools (Claude Code, Cursor, CodeRabbit) under direct human review; all scientific decisions, parameter choices, and validation were made by the authors.

---

## 10. Open items for Peleg

- [ ] Confirm exact wording of the FF-Helix definition for the paper.
- [ ] Confirm whether the µH threshold (currently 0.7) should be reported as the default in the paper or left as a tunable.
- [ ] Provide PubMed IDs for any fibril-formation references missing from the 118-peptide spreadsheet.
- [ ] Confirm whether the paper should cite the Hamodrakas 2007 framing as the FF-Helix origin.

---

**End of paper reference doc.** Update as v0.4.0 lands.
