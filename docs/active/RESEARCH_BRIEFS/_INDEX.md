# Research Briefs — Index

Living index of all research briefs produced by T-RES (research terminal). Each brief is a structured comparative analysis of a strategic decision PVL is making.

**Format**: `RB-NNN_topic-slug.md` (sequential numbering, kebab-case slug)
**Template**: `_TEMPLATE.md`
**Decision protocol**: T-RES writes brief → T1 reviews → Said + T1 decide → T1 commits approved changes to canonical docs (ROADMAP, DECISIONS, TECH_PLATFORM_VISION, MASTER_PUSH_PLAN).

---

## Briefs (newest first)

| ID | Date | Topic | Status | Recommendation | Affects |
|---|---|---|---|---|---|
| [RB-001](RB-001_researcher-needs.md) | 2026-05-08 | What researchers actually need from a peptide prediction platform (M-007) | DRAFT — awaiting Said review of 5 open questions in §11 | Top 5: (1) BibTeX export, (2) metadata-in-CSV, (3) FASTA bulk upload, (4) disagreement score + accuracy badge, (5) Jupyter notebook export | ROADMAP Phase A/B/H; ADR-013, ADR-014 PROPOSED |
| [RB-COWORK-AUDIT](RB-COWORK-AUDIT.md) | 2026-05-08 | PRE-FLIGHT compliance audit V5-V9 | COMPLETE | Keep PRE-FLIGHT in PROMPT 0; add v2 environmental-friction rule | COWORK_PROMPTS_PELEG.md, M-006 |

---

## Pending mission queue (T-RES picks one at a time)

These are the first 5 missions Said + T1 set for T-RES on 2026-05-08. T-RES picks one, completes it, indexes it here, then moves to the next.

### M-001 — MCP alternatives + competitive landscape
- **Question**: Is Anthropic's MCP genuinely the best AI-tool-calling protocol for PVL, or are there better options (LangGraph state machines, OpenAI Tool Calling, Cohere agents, IBM Granite, emerging open standards)?
- **Why now**: ADR-009 marks MCP as PROPOSED based on T1's synthesis, not comparative research. Wave 2 G1 builds on this assumption.
- **Decision impact**: confirms or supersedes ADR-009; affects Phase G1 scope.

### M-002 — Hosting platforms for scientific ML APIs
- **Question**: Which platform should host PVL's MCP server + future Phase I multi-predictor service for global low-latency access? Options: Modal, Replicate, HuggingFace Inference, Fly.io, Cloudflare Workers AI, Vercel, Render, Railway. Plus DESY K8s as the bare-metal option.
- **Why now**: Wave 2 ships MCP server; needs a hosting story beyond `localhost:8765`. Wave 5 K8s is blocked on DESY.
- **Decision impact**: new ADR for hosting strategy; affects Phase E + Phase O.

### M-003 — Vector store evaluation
- **Question**: For PVL's similar-peptides search feature, which vector store has the best fit? Chroma local, Qdrant, pgvector, Pinecone managed, Weaviate, Turbopuffer.
- **Why now**: Wave 2 Section D (vector embedding similarity search) is being implemented.
- **Decision impact**: new ADR for vector store; affects implementation in T2-INSTRUCTIONS Section D.

### M-004 — Peptide-domain embeddings
- **Question**: For computing peptide similarity, which embedding model gives best results? Generic (sentence-transformers all-MiniLM, Anthropic embeddings, OpenAI ada-002), or protein-domain-specific (ESM-2, ProtBert, ProtGPT, ESM-1b)? Cost vs quality vs ops burden.
- **Why now**: Wave 2 vector search needs an embedding choice. Generic might miss biological meaning; domain-specific might be too heavy for solo ops.
- **Decision impact**: implementation detail in Wave 2 Section D; possible new ADR if domain-specific chosen.

### M-005 — Adoption playbook for scientific OSS tools
- **Question**: What concrete tactics worked for analogous scientific OSS tools (cellxgene, BioPython, Mol\*, AlphaFold DB, Galaxy)? Beyond what's in TOP_CEO_RECOMMENDATIONS — actionable adoption funnels, citation accumulation, lab partnerships, conference strategies.
- **Why now**: PVL's adoption matters for sustainability. v0.1 is shipped on GitHub; what next?
- **Decision impact**: extends Phase H roadmap; possibly new sub-phases.

### M-006 — Best-in-class AI development workflow infrastructure
- **Question**: What does a top-tier AI-native development workflow look like for a solo OSS scientific founder? Concretely:
  - `.claude/` enhancements (hooks, custom skills, MCP servers, scheduled tasks) Said should adopt
  - Cowork prompt-engineering discipline (memory files, pre-flight audits, anti-duplication patterns)
  - Multi-terminal orchestration (T1 / T2 / T3 / T-RES / Cowork — what's missing?)
  - Communication patterns Said ↔ Peleg ↔ Alex (async-via-repo vs Slack vs email)
  - Productivity rituals (weekly review, monthly tech-radar, quarterly vision recheck)
  - Cursor / VS Code multi-window setups for AI-pair-programming
- **Why now**: Said directive 2026-05-08 — *"like the CEO of Y Combinator would do... top tier AI workflow"*. Plus he flagged Cowork trust issues (creates new files when refactor would suffice). This is a meta-decision affecting how every future wave is executed.
- **Decision impact**: produces concrete enhancement plan for `.claude/` config + workflow protocol. May spawn a new wave entry in MASTER_PUSH_PLAN (Wave 8 — Workflow Infrastructure?).
- **Inspiration sources to research**: Sindre Sorhus's solo-OSS workflow, Anthropic engineers' internal Claude Code patterns, Vercel/Guillermo Rauch, the Cursor team's own workflows, supermaven, Phind, top y-combinator OSS founders.

### M-007 — What researchers actually need from a peptide prediction platform
- **Question**: Beyond "predict TANGO + S4PRED + FF-Helix", what do bench scientists, computational biologists, and structural biologists actually want from a tool like PVL? Concretely:
  - **Workflow integration**: how do researchers move between PVL → ChimeraX / PyMOL / Jupyter / Mol* / AlphaFold DB? What handoff formats matter (PDB? mmCIF? JSON? CSV? notebook export?)
  - **Reproducibility expectations**: what counts as "publication-ready provenance" in 2026 — Snakemake/Nextflow integration? RO-Crate? Bioschemas markup?
  - **Discovery features missing in competitors**: what do PASTA 2.0 / Waltz / AGGRESCAN / TANGO web / AlphaFold DB / PEP-FOLD / APD3 NOT do well that PVL could own?
  - **Data ingestion gaps**: FASTA bulk, UniProt accession lists, mass spec output (.mzML?), structure-derived peptides (PDB → flexible-loop extraction?)
  - **Output formats researchers ask for**: heatmaps for figures, supplementary table CSVs, BibTeX of methods, ChimeraX session files, Jupyter notebook export with re-runnable code
  - **Trust signals**: confidence intervals, predictor disagreement scoring, error bands, validation against gold-standard datasets surfaced in-UI
  - **Collaboration patterns**: do researchers want share-links? group workspaces? embargo until paper accepted?
  - **Educational use**: undergrad teaching labs, MOOCs — does PVL's pedagogical clarity matter for adoption?
- **Why now**: Said directive 2026-05-08 — *"make sure that t5 is also researching ways to make the platform itself also better not only my workflow with ai (what researchers need)"*. Half of T5's value is workflow, the other half is **product-direction research**.
- **Decision impact**: feeds Phase H (research integrations) and possible new Phase M (researcher onboarding kit). May produce ADR for handoff format standards (e.g., "PVL exports ChimeraX-compatible session bundle").
- **Inspiration sources to research**: cellxgene's user feedback channels, AlphaFold DB's most-requested features, Mol*'s API for downstream tools, Galaxy's tool-integration model, RCSB PDB's workflows, ELIXIR research-software-engineering surveys, Bioconductor user studies, ChEMBL's API design, BioStars threads about peptide prediction frustrations, Reddit r/bioinformatics power-user complaints.

---

## Recurring missions (T-RES runs these on schedule)

### M-WEEKLY — Competitive scan
**Frequency**: weekly Sunday.
**Scope**: any new releases, papers, blog posts, or tool launches in: peptide aggregation prediction, secondary structure, fibril formation, AI-platform-for-science, MCP ecosystem, AlphaFold DB, Mol\*. Output: `RB-NNN_weekly-scan-YYYY-MM-DD.md` brief if anything notable; otherwise short index entry.

### M-QUARTERLY — Tech radar review
**Frequency**: quarterly (3 months).
**Scope**: re-evaluate every entry in `TECH_PLATFORM_VISION.md` §2 Technology Radar (adopt-now / plan-next / parked). Has anything moved? New tech to add? Output: `RB-NNN_tech-radar-review-YYYY-Q.md` with proposed radar moves.

### M-ANNUAL — Vision recheck
**Frequency**: annual.
**Scope**: re-evaluate `TECH_PLATFORM_VISION.md` §0 success criteria. Has the vision shifted? Are we still building toward the same target?

---

## How T-RES uses this index

1. On each session start, T-RES reads `_INDEX.md` to know what's been done and what's queued.
2. Picks the next mission in order (or one Said specifies).
3. Reads relevant docs (`MASTER_PUSH_PLAN.md`, `TECH_PLATFORM_VISION.md`, `DECISIONS.md`, `ROADMAP.md`).
4. Researches via WebSearch + WebFetch.
5. Writes `RB-NNN_topic-slug.md` using `_TEMPLATE.md`.
6. Updates this index with the new entry.
7. Stops. T1 reviews + summarizes for Said.

T-RES never commits directly to canonical docs. All proposed changes are in the brief; T1 + Said decide what to commit.
