# Glossary

*Every acronym and piece of jargon in this handbook, defined in plain English — the page to open mid-meeting when someone says "FF-SSW" and you need a one-line answer. Each entry links to the page that uses it most.*

---

## A

**4-class system (four-class system).** The four boolean labels PVL assigns every peptide: **Helix**, **FF-Helix**, **SSW**, **FF-SSW**. They are two base classes (Helix, SSW), each with a fibril-forming candidacy layer nested inside it — not five exclusive buckets. See [the science](02_the_science.md#1-the-four-class-system).

**ADR (Architecture Decision Record).** A short numbered note that freezes one design decision and the reasoning behind it (e.g. ADR-001 "classifications are computed once on the backend"). They live in `docs/active/DECISIONS.md` and are cited throughout as the authority for why the code looks the way it does. See [contracts & invariants](../agents/02_contracts_and_invariants.md).

**AGGRESCAN3D (A3D).** A competing, structure-based aggregation/solubility predictor — PVL's closest rival on the structure-aware-aggregation axis. It engineers solubility of folded proteins rather than classifying peptide fibril type. See [the landscape](../research/01_landscape.md).

**AlphaFold.** DeepMind's deep-learning protein-structure predictor. PVL fetches the AlphaFold-predicted 3D model for any peptide with a UniProt accession and paints its predictions onto it. Models for peptides under ~30 residues are unreliable. See [the science](02_the_science.md#9-alphafold--mol).

**amphipathic.** Describes a helix (or region) with a hydrophobic face and a hydrophilic face — "lopsided". Amphipathicity, measured by the hydrophobic moment (μH), is the property the FF-Helix gate tests for. See [the science](02_the_science.md#5-ff-helix).

**amyloid.** An ordered, β-sheet-rich protein aggregate. Amyloid fibrils appear both in disease (Alzheimer's) and as functional structures organisms build on purpose (including antimicrobial peptides). See [what is PVL](00_what_is_pvl.md).

**AMP (antimicrobial peptide).** A short peptide that kills bacteria, often by disrupting membranes. AMPs and amyloids share sequence features, so PVL deliberately cannot fully separate them — an overlap Peleg treats as a feature, not a false positive. See [validation evidence](../research/02_validation_evidence.md).

**annotation score.** UniProt's 1–5 rating of how much curated evidence backs an entry. Surfaced per row in Database Search so you know how well-characterised a hit is. See [the UI walkthrough](04_the_ui_walkthrough.md).

## B

**biochem.** Shorthand for PVL's three sequence-only biochemical descriptors: net charge, hydrophobicity, and hydrophobic moment (μH). They run instantly, never fail, and feed the FF gates. See [the science](02_the_science.md#4-biochemistry).

**BibTeX.** The plain-text bibliography format LaTeX uses. PVL auto-generates BibTeX entries (software + algorithm citations) so you can paste them straight into a paper. See [credits & license](10_credits_and_license.md).

**BiLSTM (bidirectional long short-term memory).** A neural-network layer that reads a sequence in both directions. S4PRED is an ensemble of five BiLSTM networks whose outputs are averaged into calibrated per-residue structure probabilities. See [the science](02_the_science.md#3-s4pred).

**bio.tools.** The ELIXIR registry of European bioinformatics software. Registering PVL there (tagged with EDAM ontology terms) makes it discoverable to the right researchers. See [the publication path](../research/04_publication_path.md).

## C

**Caddy.** A web server that auto-provisions HTTPS certificates (Let's Encrypt) on first request. PVL switches to the Caddy stack once it has a real hostname. See [deploying](06_deploying.md).

**camelCase.** The naming style for API response keys (`ffHelixFlag`, `sswPrediction`) — first word lowercase, each subsequent word capitalised. Response keys must stay camelCase; this is a protected contract rule. See [contracts & invariants](../agents/02_contracts_and_invariants.md).

**Celery.** A background task queue. PVL can run heavy batch/quick predictions in Celery workers; on the firewalled DESY VM it is disabled (`CELERY_ENABLED=0`) to save memory. See [deploying](06_deploying.md).

**ChEMBL.** A bioactivity database (EMBL-EBI). **Not yet integrated** into PVL — it appears only as a future API-design inspiration in a research brief. PVL enriches from UniProt only today. See [the science](02_the_science.md#10-uniprot--chembl).

**Chou-Fasman.** A classic propensity-table method for estimating secondary structure. PVL's sequence-only "FF-Helix %" descriptor uses a Chou-Fasman-style helix-propensity coverage — distinct from the `ffHelixFlag` classification. See [the science](02_the_science.md#5-ff-helix).

**CodeQL.** GitHub's automated security-scanning engine (`security-extended` queries). It flags potential vulnerabilities in PVL's Python and JavaScript on every push. See [failure modes](../agents/06_failure_modes.md).

**CodeRabbit.** An automated AI code-reviewer that comments on pull requests. A change is not shipped until CI is green and CodeRabbit's comments are addressed. See [doing a safe change](../agents/03_doing_a_safe_change.md).

**coiled-coil motif.** A two-helix wrap structure. Per Peleg (OQ1), the pipeline's class label uses the "coiled-coil motif" convention, which is different from S4PRED's per-residue 3-state "coil" probability — the two coexist correctly. See [open questions](../research/03_open_questions.md).

**Concept DOI (Zenodo).** The DOI that always points at "the latest version of PVL" — it rolls forward as new releases land. Cite this one in papers and grants; the versioned DOI pins one exact release. See [the publication path](../research/04_publication_path.md).

**CORDAX.** PVL's closest modern competitor (2024, from the TANGO/Waltz lab). It predicts and renders the 3D fibril-core steric zipper. PVL differs by overlaying predictions on the full AlphaFold monomer and adding the helix/SSW taxonomy. See [the landscape](../research/01_landscape.md).

**Cowork.** The parallel AI agent worker used for multi-file polish/cleanup sweeps. Dispatches are paste-ready prompts; the `WORKING DIRECTORY:` header redirects Cowork into the real repo. See [existing tooling](../agents/05_existing_tooling.md).

**cross-β.** The structural signature of an amyloid fibril: β-strands stacked perpendicular to the fibril axis. TANGO scores cross-β aggregation propensity; PVL deliberately does *not* specialise in the classic cross-β hexapeptide question. See [what is PVL](00_what_is_pvl.md).

## D

**DESY (Deutsches Elektronen-Synchrotron).** The German research centre (CSSB Hamburg) that hosts the Landau lab and provides PVL's development VM and deployment infrastructure. See [deploying](06_deploying.md).

**determinism.** PVL's guarantee that the same input + same predictor versions + same thresholds produces byte-identical output, every time. No randomness lives in the predict path. The precondition for everything else. See [the science](02_the_science.md#11-the-deterministic-output-guarantee).

**DuckDB cache.** A local analytical database (`provider_cache.duckdb`) keyed by sequence hash. Peptides whose TANGO + S4PRED + biochem are already cached skip the predictor calls. See [the pipeline](03_the_pipeline.md).

## E

**EDAM ontology.** A controlled vocabulary of bioinformatics operations and topics. PVL is tagged with EDAM terms (e.g. `operation_0473`, protein secondary-structure prediction) so bio.tools can route it to the right audience. See [the publication path](../research/04_publication_path.md).

**Eisenberg μH.** The hydrophobic-moment formalism (Eisenberg, Weiss & Terwilliger 1982) that measures a helix's amphipathicity by summing residue hydrophobicities as vectors around the helical wheel. Drives the FF-Helix gate. See [the science](02_the_science.md#4-biochemistry).

**ESM-2.** A protein language model that turns a sequence into an embedding vector. Used with LanceDB for "Find Similar" vector search; the inline-embedding version that once slowed predictions was removed (ISSUE-033). See [open questions](../research/03_open_questions.md).

## F

**FASTA.** The standard plain-text format for sequences (`>name` header line, then residues). One of the file types PVL accepts on upload. See [the pipeline](03_the_pipeline.md).

**Fauchère-Pliska.** The 1983 octanol/water hydrophobicity scale PVL uses (e.g. W = +2.25, R = −1.01). The per-residue mean is PVL's hydrophobicity value, which drives the FF-SSW gate. See [the science](02_the_science.md#4-biochemistry).

**FF (fibril-forming candidate).** What "FF" stands for in FF-Helix / FF-SSW. It is a *candidacy* flag decided from sequence-derived structure and hydrophobicity — **not** an experimental claim that the peptide forms fibrils. See [the science](02_the_science.md#1-the-four-class-system).

**FF-Helix.** Candidacy class: a peptide is FF-Helix if S4PRED calls it Helix **AND** its helix-segment hydrophobic moment (μH) clears a threshold. Every FF-Helix is a Helix. Residue colour is green. See [the science](02_the_science.md#5-ff-helix).

**FF-Helix %.** A *separate*, sequence-only Chou-Fasman-style helix-propensity descriptor — a number, not the `ffHelixFlag` classification. Do not confuse the two. See [the science](02_the_science.md#5-ff-helix).

**FF-SSW.** Candidacy class: a peptide is FF-SSW if it is SSW **AND** its mean Fauchère-Pliska hydrophobicity clears a threshold. Every FF-SSW is an SSW. Note the asymmetry — FF-Helix gates on μH, FF-SSW gates on plain hydrophobicity. Residue colour is **dark green** (never red). See [the science](02_the_science.md#7-ff-ssw).

**fibril.** A long, ordered protein thread (often amyloid). Associated with both disease and useful functional biology. Predicting fibril-formation candidacy is PVL's core question. See [what is PVL](00_what_is_pvl.md).

**four-class axioms.** Two hard subset rules enforced in code: `ffHelixFlag == 1 ⇒ Helix == 1`, and `ffSswFlag == 1 ⇒ SSW == 1`. You cannot be a fibril-forming-helix candidate without being a helix. Re-checked just before output. See [the science](02_the_science.md#8-the-axioms).

## G

**GHCR (GitHub Container Registry).** Where PVL's Docker images are published. The DESY VM builds from source instead because the feature branch isn't on GHCR yet. See [the repo map](../agents/01_repo_map.md).

**Gold-standard benchmark (Staph 2023).** The blind validation set: 2,916 *Staphylococcus aureus* 2023 peptides, 66 experimentally labelled (the `TEM Fibrils` column). PVL's FF-Helix scored sensitivity 1.000 / specificity 0.000 on the labelled subset — read with the brief's caveats. See [validation evidence](../research/02_validation_evidence.md).

## H

**Helix candidacy.** The Helix base class: S4PRED predicted at least one qualifying helical *segment* (≥5 contiguous residues at P(H) ≥ 0.5). It means a prediction, not an experimentally observed helix. Residue colour is blue. See [the science](02_the_science.md#3-s4pred).

**helical wheel.** A Schiffer-Edmundson diagram that plots a helix's residues around a circle to reveal its hydrophobic face. Shown on PeptideDetail for short helical peptides. See [the UI walkthrough](04_the_ui_walkthrough.md).

**Hetzner.** The cloud host (a CX33 VPS at `94.130.178.182`) that serves PVL's live public demo via Docker Compose. See [deploying](06_deploying.md).

**hydrophobic moment (μH).** A measure of how amphipathic ("lopsided") a helix is — see Eisenberg μH. Computed over the supplied sequence or helix segment, at δ = 100° for α-helix geometry. See [the science](02_the_science.md#4-biochemistry).

**hydrophobicity.** The per-residue mean on the Fauchère-Pliska scale (range roughly −1.0 to +2.5). Position- and environment-independent. Drives the FF-SSW gate. See [the science](02_the_science.md#4-biochemistry).

## I

**ISSUE-0xx.** PVL's bug/limitation tracking IDs, recorded in `docs/active/KNOWN_ISSUES.md` (e.g. ISSUE-032 the SSW union fix, ISSUE-034 the precompute TANGO-skip fix). Troubleshooting entries cite these for the authoritative record. See [troubleshooting](08_troubleshooting.md).

## J

**JOSS (Journal of Open Source Software).** A peer-reviewed journal for research software. PVL's `paper/paper.md` is destined for JOSS open review — the final step that gives the tool indexed, peer-reviewed credibility. See [the publication path](../research/04_publication_path.md).

## K

**Kerberos.** The network authentication protocol guarding the DESY network. Reaching the firewalled DESY VM means a `kinit` ticket plus an SSH jump through the Maxwell login. See [deploying](06_deploying.md).

**KPI strip.** The four headline cards on the Results dashboard (Helix / FF-Helix / SSW / FF-SSW counts) — the dataset's symmetric overview, click-to-filter. See [the UI walkthrough](04_the_ui_walkthrough.md).

## L

**LanceDB.** An embedded vector database. Stores ESM-2 peptide embeddings to power the "Find Similar" vector-similarity drill-down; reindexed when the embedding model changes. See [existing tooling](../agents/05_existing_tooling.md).

## M

**MCP (Model Context Protocol).** The open standard that lets AI clients (Claude Desktop, Cursor, Cline) call tools. PVL ships a stateless `pvl-mcp` server (7 fixed tools) that forwards to the FastAPI backend — zero analysis logic of its own. See [existing tooling](../agents/05_existing_tooling.md).

**Mol\*.** A consortium-maintained (RCSB PDB / EBI / ETH) in-browser 3D structure viewer. PVL renders the AlphaFold model in Mol\* and overlays its predictions on the fold. See [the science](02_the_science.md#9-alphafold--mol).

**μH.** Shorthand for the hydrophobic moment (Eisenberg) — the amphipathicity measure that gates FF-Helix. See [the science](02_the_science.md#4-biochemistry).

## N

**normalize.** The backend stage (`services/normalize.py`) that converts pandas types to JSON-safe Python, maps headers to canonical names, and enforces the FF axioms just before output. See [the pipeline](03_the_pipeline.md).

**null-only invariant.** PVL's rule that "no data" is *always* JSON `null` — never `-1`, `"N/A"`, `0`, or empty string. A `-1` is a real verdict (e.g. charge −1.0, or "data present but not a candidate"), never a missing-data sentinel. See [the science](02_the_science.md#11-the-deterministic-output-guarantee).

## O

**OQ (Open Question).** A numbered scientific question from Peleg's review (OQ1–OQ8) that needed her sign-off before tagging. As of 2026-06-29, 5 are resolved and 3 are deferred-but-non-blocking. See [open questions](../research/03_open_questions.md).

**ORCID.** A persistent unique researcher ID. Each PVL author lists one in the credits so attribution is machine-readable and unambiguous. See [credits & license](10_credits_and_license.md).

## P

**Peleg-118.** PVL's primary positive-control set: 118 experimentally-validated fibril-forming peptides, each ≤ 40 aa, curated by Dr. Peleg Ragonis-Bachar. The single-sequence fallback thresholds derive from this cohort. See [validation evidence](../research/02_validation_evidence.md).

**permalink.** A URL that encodes the sequence(s), thresholds, predictor flags, and PVL version — so re-opening it reproduces the exact analysis on any deployment. "Reproducibility-as-permalink" is a headline feature, copied from the Reproducibility ribbon. See [use cases](05_use_cases.md).

**Phase I multi-predictor.** The roadmap track for adding more aggregation predictors (Waltz, AGGRESCAN3D, PASTA 2.0) side by side. The overlay contract is already forward-compatible for it. See [extending](07_extending.md).

**pLDDT.** AlphaFold's per-residue confidence score (0–100). Surfaced alongside the 3D structure so you know how much to trust each region of the model. See [the science](02_the_science.md#9-alphafold--mol).

**precompute path.** A script that runs the full pipeline once on a reference dataset and saves the result as JSON, so example-button loads are instant (< 1 s) instead of triggering the live ~20-min pipeline. Artifacts are wiped on every image rebuild and must be regenerated. See [deploying](06_deploying.md).

**provider status.** The per-predictor state reported in response metadata: `AVAILABLE`, `OFF` (env flag off), or `UNAVAILABLE` (runner failed). It tells the UI whether TANGO/S4PRED actually ran, so a half-empty result reads as a missing predictor, not a bug. See [the pipeline](03_the_pipeline.md).

**PSIPRED.** An earlier secondary-structure predictor used in PVL prototypes and **removed** (ADR-003/006). S4PRED is now the sole, primary helix predictor. See [the science](02_the_science.md#3-s4pred).

**Pydantic.** The Python library that validates PVL's API request/response models (`extra="forbid"` — strict). Every output row must match the `PeptideRow` schema in the protected `api_models.py`. See [the pipeline](03_the_pipeline.md).

## Q

**Quick Analyze.** The single-sequence path (`/quick`) — paste one peptide, pick a threshold mode, analyze. It shares the same `PeptideViewer` component as the detail page, guaranteeing single and batch produce identical numbers. See [the UI walkthrough](04_the_ui_walkthrough.md).

## R

**RAG (retrieval-augmented generation).** An AI pattern that feeds retrieved documents (e.g. PubMed abstracts) into a model's context. A roadmap item (G2: LanceDB + ESM-2 + PaperQA2) gated on a zero-citation-hallucination guarantee — not yet shipped. See [open questions](../research/03_open_questions.md).

**Reproducibility ribbon.** The bar on Results that shows active thresholds and copies the permalink. The in-app face of PVL's "reproducible is a button, not a chore" design. See [use cases](05_use_cases.md).

**residue.** A single amino acid within a peptide chain. PVL reports many values "per residue" (aggregation, helix probability, switch zones), painted along the sequence track and the 3D structure. See [the science](02_the_science.md#2-tango).

**RowsResponse.** The top-level API envelope returned for both single and batch requests: a list of peptide rows plus `meta` (run metadata, provider status, warnings, thresholds, trace ID). The contract is identical in both directions. See [the pipeline](03_the_pipeline.md).

## S

**S4PRED.** PVL's primary secondary-structure predictor — a single-sequence deep model (5-BiLSTM ensemble) that labels each residue helix (H) / strand (E) / coil (C). Only run on sequences ≤ 40 aa. See [the science](02_the_science.md#3-s4pred).

**secondary structure.** The local 3D shape of a protein backbone — helix, β-strand, or coil. S4PRED predicts it per residue; the per-residue colours are blue (helix), orange (strand), grey (coil). See [the science](02_the_science.md#3-s4pred).

**Sentry.** The error-monitoring and performance-tracing service. PVL's stage timings and crashes report to Sentry once DSNs are supplied; it stays silent otherwise. See [deploying](06_deploying.md).

**single-vs-batch invariant.** PVL's core promise: the same sequence yields identical values whether submitted via Quick Analyze or inside a CSV batch. New predictors must be wired into *both* code paths or neither. See [the science](02_the_science.md#11-the-deterministic-output-guarantee).

**Smart Ranking.** The Candidate Ranking engine on Results: percentile-weighted, proportional, multi-signal scoring with presets (e.g. "Fibril-Formation Focus"). By rule it is *never* a single-predictor (TANGO-only) sort. See [the repo map](../agents/01_repo_map.md).

**SSW (secondary-structure switch).** Base class marking a region of conformational indecision — where helical and β-aggregating propensities coincide (a chameleon/switch sequence). Computed as **TANGO ∪ S4PRED** (either predictor suffices). The per-residue switch highlight is magenta `#E040FB`. See [the science](02_the_science.md#6-ssw).

**steric zipper.** The tightly interdigitated cross-β spine of an amyloid fibril core. ZipperDB and CORDAX specialise in predicting it for hexapeptides — a question PVL deliberately does not target. See [the landscape](../research/01_landscape.md).

## T

**TANGO.** A statistical-mechanics Fortran algorithm that scores per-residue β-aggregation propensity from sequence alone. Run as a subprocess at pH 7, 298 K. It predicts *aggregation*, **not** fibril formation — PVL folds its signal into SSW/FF-SSW. See [the science](02_the_science.md#2-tango).

**ThresholdConfig.** The frontend object that carries the active threshold values (μH cutoff, hydrophobicity cutoff, threshold mode) through the UI. Moving a threshold re-classifies client-side without re-running TANGO/S4PRED. See [the UI walkthrough](04_the_ui_walkthrough.md).

## U

**UniProt.** The curated protein-sequence and annotation database. PVL enriches accession-identified peptides with name, organism, gene, function, and annotation score, and can pull peptides in via a UniProt query. See [the science](02_the_science.md#10-uniprot--chembl).

## V

**VPS (virtual private server).** A rented cloud machine. PVL's live demo runs on a single Hetzner VPS via Docker Compose, deliberately single-worker to fit the S4PRED model in memory. See [deploying](06_deploying.md).

## W

**Waltz.** The gold-standard predictor for the *classic cross-β amyloid hexapeptide* question — exactly the question PVL does not specialise in. Complementary to PVL, not a substitute. See [the landscape](../research/01_landscape.md).

**Welch's t-test.** A statistical test for whether two groups' means differ when their variances differ. Used in Cohort Compare (where a precomputed reference exists) to put a quotable p-value and effect size on a comparison. See [use cases](05_use_cases.md).

## Z

**Zenodo.** A CERN-backed archive that mints a permanent DOI from each tagged GitHub release. It gives PVL a citable, forever-resolving software archive. See [the publication path](../research/04_publication_path.md).

**ZipperDB.** A precomputed genome-scale database of amyloid steric-zipper-forming hexapeptide segments (Eisenberg lab). The most structurally rigorous cross-β predictor, orthogonal to PVL's helix/switch focus. See [the landscape](../research/01_landscape.md).

**Zustand.** The lightweight React state-management library holding PVL's dataset in the browser. There is no login — your data lives in a persisted Zustand store, which is why a reload survives but a cache-clear wipes results. See [the UI walkthrough](04_the_ui_walkthrough.md).
