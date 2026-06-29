# PVL — Architectural Decision Records (ADRs)

**Living document.** Each entry documents a load-bearing project decision: the choice, the reasoning, the date, and the implication for future contributors. Future-you reads this before changing direction; future contributors read this before proposing changes that would conflict.

See also: `TECH_PLATFORM_VISION.md` for the longer-form platform thesis and technology radar.

---

## ADR-001 — 4-category classification at the data layer

**Date**: 2026-04-26 · **Status**: ACCEPTED · **Authors**: Said + Peleg
**Context**: Peleg's holistic review (FIX-001) defined four canonical peptide categories: Helix, FF-Helix, SSW, FF-SSW. Each has a precise definition involving S4PRED segments + biochemical thresholds. PVL had ad-hoc flag computation scattered across modules.
**Decision**: classification flags (`helixFlag`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag`) are computed once on the backend in `apply_ff_flags`. The frontend never re-derives them.
**Reasoning**: single-source-of-truth. Single-sequence and batch inputs MUST produce identical results — only achievable when classification is centralized.
**Implication**: any new classification (Phase I multi-predictor consensus) must follow the same pattern: data-layer computation, never recomputed in UI.
**Evidence**: `backend/auxiliary.py:apply_ff_flags`, `backend/tests/test_4category_classification.py`.

---

## ADR-002 — Pydantic v2 `extra="forbid"` on request schemas

**Date**: 2026-05-02 · **Status**: ACCEPTED · **Authors**: Said + T2 audit
**Context**: A silent contract bug surfaced where the frontend sent `{"max_results": 5}` but the backend silently coerced to `size=500` defaults because `max_results` was not a known field. Pydantic's default `extra="ignore"` was the root cause. Users believed they queried 5 peptides; the server processed 500.
**Decision**: every request schema sets `model_config = ConfigDict(extra="forbid")` and uses `AliasChoices` for legacy field-name backwards-compat.
**Reasoning**: in scientific tools, silent contract drift is catastrophic — users trust the result. Loud 422 errors are strictly better than silent default substitution.
**Implication**: every new endpoint inherits the same strictness. Contract regression tests in `test_api_contract_strictness.py` enforce.
**Evidence**: `backend/schemas/uniprot_query.py`, `backend/schemas/feedback.py`, commit referencing the discovery.

---

## ADR-003 — Helix % canonical definition = segment-based S4PRED

**Date**: 2026-04-26 · **Status**: ACCEPTED · **Authors**: Said + Peleg
**Context**: Peleg flagged in Hebrew that "the helix percentage seems to be consistently miscalculated or extracted incorrectly". An audit (`HELIX_PERCENTAGE_AUDIT.md`) found four physically distinct "helix percentages" all displayed under the same label.
**Decision**: `s4predHelixPercent` (segment-based, computed by `_get_segment_percentage`) is the single canonical definition of "Helix %" in the UI. All probability-mean displays were removed (S4PredChart "Avg composition" line gone; `formatS4predDominant` no longer uses `% Helix` form).
**Reasoning**: aligns with Peleg's category-1 definition. Eliminates the cognitive load of users seeing `100%` and `77%` next to each other both labeled "Helix %".
**Implication**: any new helix-related metric must use a distinct label that names its algorithm (e.g., `Avg P(H)`, `TANGO helix-track %`, `Chou-Fasman propensity`). Never bare `Helix %`.
**Evidence**: `docs/active/HELIX_PERCENTAGE_AUDIT.md`, `backend/s4pred.py:_get_segment_percentage`.

---

## ADR-004 — Reproducibility-as-permalink

**Date**: 2026-05-06 · **Status**: ACCEPTED · **Authors**: Said
**Context**: peer reviewers, paper readers, Slack collaborators, bio.tools curators all need to see the same view Said is looking at. Static screenshots aren't enough.
**Decision**: every analysis state is encodable into a URL via `lib/permalink.ts`. URL = state. Pasting a permalink reproduces the exact view (query, thresholds, peptide selection, drill-down state).
**Reasoning**: reproducibility-as-feature, not reproducibility-as-extra-effort. The `<ReproducibilityRibbon>` exposes the permalink + version + build SHA persistently at the top of every analysis page.
**Implication**: any new piece of analysis state must round-trip through `lib/permalink.ts`. Forward-compatibility schema is documented in that file.
**Evidence**: `ui/src/components/ReproducibilityRibbon.tsx`, `ui/src/lib/permalink.ts`.

---

## ADR-005 — Hover-everywhere via central `metricRegistry`

**Date**: 2026-05-04 · **Status**: ACCEPTED · **Authors**: Said
**Context**: every chart had its own tooltip with slightly different copy, definition, formatter. Drift was inevitable.
**Decision**: every numeric/metric exposed in UI registers in `lib/metricRegistry.ts` with: definition, units, formatter, value-getter, related metrics. The `<MetricHover>` wrapper is the standard hover envelope.
**Reasoning**: scattered tooltips drift. One registry = one source of truth = consistent hover content + scientific definitions stay synchronized with Peleg's input.
**Implication**: new metrics REQUIRE a registry entry before they can be displayed. Reviewer scientific changes (Peleg/Alex) flow into one file.
**Evidence**: `ui/src/lib/metricRegistry.ts`, `ui/src/components/hover/MetricHover.tsx`.

---

## ADR-006 — DrillDown as universal slide-over (not modal)

**Date**: 2026-05-04 · **Status**: ACCEPTED · **Authors**: Said + Cowork V3-2
**Context**: every chart on the dashboard needs a full-screen-ish view for deep inspection. Modal dialogs lose context (the user can't see the dashboard behind).
**Decision**: every chart's `↗` icon launches a right-side slide-over `<DrillDown>` (Stripe Dashboard pattern) — not a centered modal. Built on shadcn `<Sheet>`. Layout: chart fills view at top, peptide table sits at the bottom with drag-handle resizer.
**Reasoning**: preserves context. User can see the dashboard behind the slide-over. Esc closes; cmd+K switches metrics; arrows navigate peptides.
**Implication**: any new chart adopts the same `useDrillDown().open(...)` pattern. New deep-inspection surfaces register inspector views via the existing `ChartInspector` / `MetricInspector` / `PeptideInspector` modes.
**Evidence**: `ui/src/components/drilldown/DrillDown.tsx`, `DrillDownProvider.tsx`.

---

## ADR-007 — Sentry release-tagged + rich-context observability

**Date**: 2026-05-07 · **Status**: ACCEPTED · **Authors**: Said + Cowork V6-1
**Context**: PVL is solo-maintained. During MIT semesters, the maintainer has minimum bandwidth. Production errors must reach the maintainer with enough context to triage in <2 minutes.
**Decision**: every Sentry event carries `release` (PVL version + build SHA), anonymous `user.id` (per-session UUID), custom tags (peptide_count, predictors, dataSource, viewport, theme), full context (threshold preset, dataset hash, route). Backend FastAPI integration correlates trace_id between frontend and backend.
**Reasoning**: rich context = root cause in seconds, not hours. Source maps in CI mean stack traces are readable. Slack alerts get only real errors (not 422 contract validations).
**Implication**: every new feature that affects analysis state extends `setPVLSentryContext` so its errors are triagable. New routes inherit the trace_id propagation pattern.
**Evidence**: `ui/src/lib/sentryContext.ts`, `docs/active/SENTRY_RUNBOOK.md`, `backend/api/main.py`.

---

## ADR-008 — Mol\* (mol-star) as canonical 3D structure layer

**Date**: 2026-05-06 · **Status**: ACCEPTED · **Authors**: Said
**Context**: PVL needs a 3D structure viewer. Options: NGL Viewer (stagnant), JSMol (legacy), 3Dmol.js (limited), Mol\* (institutional consortium maintained by RCSB PDB + EBI + ETH).
**Decision**: Mol\* is the canonical 3D layer. PVL adopts its API for all structure visualization, including the AlphaFold overlay system that renders TANGO peaks + S4PRED helix segments + FF-Helix + SSW zones directly on the protein structure.
**Reasoning**: ecosystem alignment. Researchers already know Mol\* controls (used by RCSB PDB, AlphaFold DB, EBI). A consortium-maintained viewer outlives any single team. Future overlay types (multi-predictor consensus in Phase I) plug in via the same `molstarOverlays.ts` helpers.
**Implication**: do not introduce alternative 3D viewers. Custom structural-biology annotations should extend the existing overlay system, not bypass it.
**Evidence**: `ui/src/components/Mol3DViewer.tsx`, `ui/src/lib/molstarOverlays.ts`.

---

## ADR-009 — MCP server as the AI-platform front door

**Date**: 2026-05-07 · **Accepted**: 2026-05-08 · **Status**: ACCEPTED (Wave 2 §A) · **Local SHA**: 80a514f
**Context**: Anthropic's MCP (Model Context Protocol) is being adopted by Claude Desktop, Cursor, Windsurf, Continue, and other major LLM clients. The protocol defines how an LLM agent calls external tools. PVL has a REST API that maps cleanly to MCP tools.
**Decision**: when AI agent integration matures (Phase G1), expose PVL as an MCP server, NOT as a custom chat UI built into the web app. Researchers already use Claude Desktop / Cursor / their own agents — they don't need another chatbot, they need a tool their existing agent can call.
**Reasoning**: standardize on the protocol the ecosystem converges on. Don't build a chatbot when the user already has one. Future-proof: MCP becoming the cross-vendor standard means PVL is automatically available to whichever LLM the researcher prefers.
**Implication**: every PVL REST endpoint should map cleanly to an MCP tool. Endpoints designed with this in mind from now on (clean inputs, structured outputs, no UI-specific fields). The MCP server lives in `mcp_server/` at repo root and ships seven tools: `search_uniprot`, `analyze_sequences`, `get_peptide_detail`, `rank_candidates`, `compare_cohorts`, `find_similar_peptides`, `get_pvl_version`. Three are LIVE today (`search_uniprot`, `analyze_sequences`, `get_pvl_version`); the remaining four wrap documented backend paths that ship in subsequent waves.
**Evidence**: `mcp_server/`, `docs/active/MCP_RUNBOOK.md`, roadmap Phase G1, `TECH_PLATFORM_VISION.md` §4.

---

## ADR-010 — Demo Mode auto-load on first visit

**Date**: 2026-05-06 · **Status**: ACCEPTED · **Authors**: Said + Cowork V5-1
**Context**: bio.tools curators, paper reviewers, conference attendees all need to see PVL working in <30 seconds, not in 30 seconds plus an upload step. Static screenshots don't convey the interactivity.
**Decision**: first-time visitor (no localStorage flag) gets the Staphylococcus 2023 example dataset auto-loaded into datasetStore. A `<DemoModeChip>` floats in the corner: "Demo data — use your own data →". An optional `<FirstVisitModal>` offers a tour or "let me explore".
**Reasoning**: first-impression conversion is everything for an open-source scientific tool. Researchers landing on PVL should see the dashboard light up, drill into a peptide, see the 3D overlay — all before they decide to upload their own data.
**Implication**: any future feature must work in demo mode without breaking. The demo dataset must remain in-repo + small. Sentry tagging via `data_source: demo` lets us measure conversion analytics later.
**Evidence**: `ui/src/hooks/useDemoMode.ts`, `ui/src/components/DemoModeChip.tsx`.

---

## ADR-011 — Strictly open-source MIT, no commercial features (until usage warrants)

**Date**: 2026-05-07 · **Status**: ACCEPTED · **Authors**: Said
**Context**: research tools have several monetization paths (open-core, paid hosting, foundation, freemium). Each has tradeoffs.
**Decision**: PVL is 100% open-source MIT-licensed. No commercial features, no paid tier, no upsells. Re-evaluate only when ≥2 of these signals turn hot: ≥200 daily active users, ≥20 citations/year, time-on-support >5h/week, pharma asks for SLA, Said wants this full-time post-MIT.
**Reasoning**: pre-monetizing kills young scientific tools. Adoption requires zero friction. If PVL gets traction, monetization options remain open; if it doesn't, we lose nothing.
**Implication**: every feature ships free + OSS. Future paid features are gated behind explicit ADR amending this one, only after the signals trigger.
**Evidence**: `LICENSE`, `TOP_CEO_RECOMMENDATIONS.md` §3 + §8.

---

## ADR-012 — Maintenance hedge via AI tooling, not contributors

**Date**: 2026-05-07 · **Status**: ACCEPTED · **Authors**: Said
**Context**: Said starts MIT in ~3 weeks. Solo maintainer with limited semester bandwidth. Building a community of human contributors requires part-time community management Said cannot provide.
**Decision**: hedge maintenance with AI tooling, not contributors. Adopt: CodeRabbit (PR review), Sentry Seer (AI issue triage), Dependabot (deps), Anthropic Claude Code + Cowork (Said's primary dev partners). One-time setup; compounds during semesters.
**Reasoning**: a contributor base requires active management; an AI tool doesn't. The two are complementary — contributors are welcome via CONTRIBUTING.md but never required.
**Implication**: CONTRIBUTING.md sets clear "no expectations" tone — responses in 1-4 weeks, suggestions accepted without commitment. Said does NOT actively recruit contributors.
**Evidence**: `.github/dependabot.yml`, `.coderabbit.yaml`, `CONTRIBUTING.md`.

---

## ADR-013 — PVL exports include FAIR metadata + BibTeX

**Date**: 2026-05-08 · **Status**: ACCEPTED · **Authors**: Said + T-RES + T1
**Context**: Researchers using PVL in publications need citable, reproducible output. No competitor (TANGO web, PASTA 2.0, AGGRESCAN, Waltz, AggreProt) provides metadata-stamped exports or pre-filled citations. RB-001 §5 ranked these as the top-3 highest-leverage features (impact × 1/cost).
**Decision**: All CSV/JSON exports SHALL include: predictor name + version, threshold values per predictor, run date (ISO 8601), sequence source (FASTA / UniProt / manual). A "Download BibTeX" button on Results.tsx SHALL produce a `.bib` file pre-filled for TANGO + S4PRED + Hamodrakas 2007 + PVL itself. BibTeX is FRONTEND-STATIC for v0.x — predictor versions don't change often enough to need backend round-trip.
**Reasoning**: Pragmatic FAIR compliance without full RO-Crate overhead. Aligns with JOSS paper-readiness + ELIXIR bio.tools registration. Total effort < 14 h (2h BibTeX + 4h metadata-CSV + 8h FASTA bulk).
**Implication**: `backend/schemas/api_models.py` receives a NEW NULLABLE `run_metadata: Optional[RunMetadata]` field (backwards-compatible — null for clients that don't request it). Frontend `ui/src/lib/exportBibtex.ts` is a static string builder, no API call. FASTA bulk parser added to backend ingestion path. Wave assignment: Wave 1 quick-wins, ship pre-MIT (before Sept 2026).
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-001_researcher-needs.md` §3 categories B+D+E, §5 features 1-3.

---

## ADR-014 — Predictor disagreement + gold-standard accuracy in UI

**Date**: 2026-05-08 · **Status**: ACCEPTED · **Authors**: Said + Peleg + T-RES + T1 · **Peleg cleared dataset**: 2026-05-08
**Context**: Researchers cannot tell from any existing peptide prediction tool whether to trust a prediction. The 2021 Briefings in Bioinformatics benchmark (Table 1) showed wide accuracy variance across 9 tools (CIs 68–87.6%). PVL's consensus module already computes multi-predictor agreement; the Staphylococcus 2023 dataset (N=2916, 66 validated) is owned by Peleg.
**Decision**: Results dashboard SHALL display:
  (a) **Consensus confidence indicator** showing how many predictors agree on each classification (e.g. "2 of 3 algorithms agree — moderate confidence"). UI-only change, ships in this wave.
  (b) **Gold-standard accuracy badge** showing PVL's sensitivity on the Staphylococcus 2023 benchmark (N=66 validated) at current threshold settings. **Peleg cleared 2026-05-08** — dataset can be displayed publicly with attribution to Peleg (Technion). Citation in About page + accuracy card.
**Reasoning**: Strongest trust signal in the aggregation prediction space. Competitor gap (no tool surfaces predictor disagreement or accuracy in-UI).
**Implication**: Disagreement score: 8h, Wave 2, files `ui/src/components/ResultsKpis.tsx` + `ui/src/lib/consensus.ts`, new `ui/src/components/TrustSignalCard.tsx`. Accuracy badge: 12h, also Wave 2, requires precomputed accuracy curves per threshold combination as static JSON (build-time artifact, runtime cost zero). Peleg credited in About page + dataset README.
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-001_researcher-needs.md` §3 category F, §5 feature 4. Memory: `project_peleg_columns.md`.

---

## ADR-020 — Phase G2 Scientific RAG architecture (agentic PaperQA2-pattern, zero hallucinated citations)

**Date**: 2026-05-12 · **Status**: PROPOSED · **Authors**: T5 (RB-005) + T1 + Said
**Pending**: Peleg axiom registry review (~1-2 weeks) + Alex sign-off on hallucination-guard rules
**Context**: Phase G1 (MCP server) is LIVE; Phase G2 (scientific RAG with PubMed citations) is the next AI surface per ROADMAP Phase G. RB-005 evaluated naive RAG vs agentic RAG vs ChemCrow vs PaperQA2 patterns. PaperQA2 (Future House, Apache 2.0, peer-reviewed *arXiv 2409.13740*) achieves 0% citation hallucination on scientific QA vs 40-60% for raw LLMs. Said's directive 2026-05-12 (A.14): ZERO tolerance for AI-generated text without retrieved-paper backing. Peleg's FIX-013 (killing ConsensusTier for unjustified math) defines her line: any domain claim must derive from a tool-call to her axiom registry.
**Decision**: Adopt PaperQA2-pattern agentic RAG for Phase G2. Five tools: (1) `query_pvl`, (2) `search_pubmed`, (3) `retrieve_paper_chunk`, (4) `lookup_peleg_axiom`, (5) `compute_disagreement`. ReAct loop with Anthropic Claude Sonnet 4.6 default, Helmholtz Blablador (`helmholtz-blablador.fz-juelich.de`) as on-prem opt-in via `LLM_PROVIDER=helmholtz`. Extend LanceDB (ADR-016) with new `papers` table — no new infrastructure. Anthropic Citations API for per-passage attribution (`cited_text` field, generally available since Jan 2025). Five hallucination guards: tool-call gate + citation round-trip + axiom-shield + system prompt invariant + 6-month audit log (EU AI Act Article 12 compliance).
**Reasoning**: Naive RAG fails 40% on multi-hop scientific questions. PaperQA2 pattern is the only architecture that survives Peleg's zero-tolerance rule. Helmholtz Blablador gives DESY-hosted PVL on-prem LLM option without new infra work. Audit log is EU AI Act compliance + JOSS-paper-ready provenance.
**Implication**: New `backend/services/g2_agent.py`. Extended LanceDB schema with `papers` table. New `data/axioms.json` (Peleg-reviewed). New `backend/api/routes/g2.py` (`POST /api/g2/explain`). MCP tool 8 (`explain_peptide`). Frontend `ExplainPanel.tsx` with cite-hover (NotebookLM-style). G2 MVP scope: explain one peptide at a time with PubMed citations. ~40h, target Wave 3, 4-6 weeks wall-clock. Peleg axiom review is critical-path gate.
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-005_workflow-and-ai-platform-deep.md` §5, FutureHouse PaperQA2 [arXiv 2409.13740], Anthropic Citations API docs (Jan 2025), EU AI Act Article 12 (Aug 2026 deadline), Helmholtz Blablador (helmholtz-blablador.fz-juelich.de).

---

## ADR-018 — Multi-terminal orchestration protocol (AGENTS.md + STATUS.md as canonical surfaces)

**Date**: 2026-05-12 · **Status**: ACCEPTED · **Authors**: Said + T-RES (RB-004) + T1
**Context**: PVL uses 4-6 Claude Code terminals (T1 CEO, T2 backend, T3 frontend, T5 research, Cowork visual, T-PEL Peleg-feedback). No committed file legibly described which terminal does what, what's forbidden, and how they coordinate. Said had to invent the multi-terminal pattern, the CEO role, and the T5 distinction — symptom of T1 not proposing infrastructure proactively (`feedback_t1_proactive_workflow_evolution.md`). Without this protocol committed at repo root, a future maintainer or Said-after-MIT-absence cannot rebuild context.
**Decision**: Adopt **`AGENTS.md`** at project root (committed, public) as the canonical role map. Every terminal reads it at session start. Adopt **`docs/active/STATUS.md`** as the always-up-to-date dispatch dashboard — T1 updates it after every cycle. Per-terminal instructions (`TX-INSTRUCTIONS.md`) stay gitignored — those are working specs, not canonical roles.
**Reasoning**: AGENTS.md is the legible map; STATUS.md is the live state. Together they let a fresh terminal — or Said after a 3-month gap — re-enter the project without T1 context. Addy Osmani's multi-agent research (RB-004 §3) confirms human-curated AGENTS.md files improve agent success vs AI-written ones. The 3-5 effective-terminal sweet spot matches PVL's persistent set (T1/T2/T3/T5).
**Implication**: T1 maintains AGENTS.md (proactive review quarterly) + updates STATUS.md after every dispatch. Sub-terminal instructions docs reference AGENTS.md rather than re-declaring roles. Any new terminal role (e.g., future T-OPS for observability) requires an AGENTS.md update first.
**Evidence**: `AGENTS.md` (this commit), `docs/active/STATUS.md`, RB-004 §3 Domain 3, RB-COWORK-AUDIT.

---

## ADR-019 — Claude Code hook quality gates (Stop+test, future TS typecheck + npm guard)

**Date**: 2026-05-12 · **Status**: ACCEPTED (Stop hook); PROPOSED (TS typecheck + npm guard — Wave 0.3 follow-up) · **Authors**: Said + T-RES (RB-004) + T1
**Context**: `.claude/settings.json` had 4 hooks: API contract guard (PreToolUse Write), git-push warning (PreToolUse Bash), ruff format (PostToolUse), prettier format (PostToolUse). All hooks were correctness-adjacent (formatting + critical-file protection) but none verified that tests still pass. Per Said directive 2026-05-12 (`feedback_simplicity_and_testability.md`), the #1 friction is "I couldn't make sure it worked" — that's exactly what a Stop+test gate addresses.
**Decision**: Add a `Stop` hook (`.claude/hooks/stop-test-gate.sh`) that runs `backend/.venv/bin/python -m pytest -q tests/` + `npx vitest run` if code changes are present in this session, and exits 2 on any failure. Future Wave 0.3 follow-up: TS typecheck on PostToolUse (Hook A from RB-004) and npm install guard on PreToolUse Bash (Hook C). Those ship when their value is observed (i.e., when type regressions or supply-chain hallucinations actually occur).
**Reasoning**: Said's biggest friction is verification. Stop+test gate is the cheapest, highest-leverage automation to ensure no session closes with red tests. Per Anthropic's documented Stop+exit-2 pattern, Claude sees stderr and self-corrects within the same session.
**Implication**: Sessions that introduce failing tests cannot close cleanly — Claude must fix or explicitly explain the intentional red state. Hook gracefully skips if `backend/.venv` or `ui/node_modules` aren't present (fresh-clone friendly). Skips if no code diffs in the session (docs-only / research sessions don't trigger tests).
**Evidence**: `.claude/hooks/stop-test-gate.sh`, `.claude/settings.json`, RB-004 §3 Domain 1.

---

## ADR-017 — Embedding model: ESM-2 8M (supersedes provisional all-MiniLM-L6-v2)

**Date**: 2026-05-12 · **Status**: ACCEPTED · **Authors**: Said + T-RES + T1
**Context**: ADR-016 locked LanceDB as the vector store but left the embedding model open. T2 Section D shipped (commit `8e907fc`) using provisional `sentence-transformers/all-MiniLM-L6-v2` (384-dim). RB-003 found this is a **correctness failure**, not a tradeoff — MiniLM is trained on 1B English sentence pairs with no amino acid vocabulary; embeddings of peptide sequences capture letter-frequency patterns, not biological signal. Any nearest-neighbor result is biologically meaningless.
**Decision**: Replace all-MiniLM-L6-v2 with **ESM-2 8M** (`facebook/esm2_t6_8M_UR50D`, MIT license) as the production embedding model. Output: 320-dim sequence embedding via mean-pooled residue embeddings. Compute: CPU-only (no GPU). Model loaded lazily at first embed call (~150–250 MB RAM, ~30 MB disk). One-time LanceDB table drop + recreate to switch schema dim 384 → 320. Reindex of all existing peptides via `python -m backend.scripts.reindex_lance`.
**Reasoning**: ESM-2 (Lin et al., *Science* 2023, doi:10.1126/science.ade2574) is the smallest peer-reviewed protein language model trained on 250M UniRef50 sequences with biologically grounded representations of evolutionary conservation, structural context, and biochemical properties. 8M variant fits CX33 RAM budget with ~3 GB headroom; CPU inference ~10–50 ms for 5–100 AA peptides. PepBERT (peptide-specific, April 2025) would be marginally better scientifically but has no stable HuggingFace release and is too immature for solo-maintained production. Paid API embeddings violate ADR-011's offline-first requirement.
**Implication**: T2 must (1) replace SentenceTransformer call in `backend/services/vector_store.py` with `transformers.AutoModel` + `AutoTokenizer` for `facebook/esm2_t6_8M_UR50D`; (2) change LanceDB schema embedding dim 384 → 320; (3) implement lazy-load pattern (avoid FastAPI cold-start health check timeout); (4) run one-time reindex script. `transformers` is already transitively available via `sentence-transformers`. Future upgrade path: PepBERT if it stabilizes, or ESM-2 35M if latency degrades at >500k peptides. **Priority interrupt**: this work happens BEFORE T2 §G — every peptide currently being indexed produces biologically invalid vectors.
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-003_embedding-model-evaluation.md`, Lin et al. Science 2023, PepBERT bioRxiv 2025.

---

## ADR-016 — Vector store: LanceDB embedded (supersedes provisional Chroma)

**Date**: 2026-05-08 · **Status**: ACCEPTED · **Authors**: Said + T-RES + T1
**Context**: Wave 2 §D implements `POST /api/peptides/similar`. MASTER_PUSH_PLAN.md §3 chose Chroma local provisionally without comparative research. RB-002 (T-RES, M-003) evaluated 8 candidates against PVL's binding constraints: MIT-compatible OSS (ADR-011), solo-maintainer ops burden (~2h/month after Sept 2026), no paid services, Hetzner CX33 VPS (8 GB RAM), <500 ms latency for k=10 at <1 M peptides, future portability to DESY K8s.
**Decision**: Adopt LanceDB (Apache 2.0) in embedded mode as the vector store for PVL v0.x and v1.x. Store Lance files at `./data/lance` (volume-mounted in Docker). Migrate to pgvector when Postgres is introduced per MASTER_DEV_DOC D2 (multi-user auth phase — RB-002 estimates 2-4h migration effort).
**Reasoning**: LanceDB is the only candidate satisfying all three binding constraints — zero-infra embedded mode, MIT-compatible OSS, crash-safe columnar persistence. Chroma has a documented HNSW index-growth bug (index never shrinks after deletes), known memory leaks under sustained load, and no crash-safe persistence — exactly the failure modes that kill a solo-maintained tool on a shared VPS. Qdrant/Weaviate/Milvus require a separate server process the solo maintainer cannot reliably operate. pgvector is the correct long-term answer but premature — adding Postgres solely for vector search violates D2. At <1 M peptides and 384-dim embeddings, LanceDB exceeds the <500 ms latency target by ~100x.
**Implication**: T2 implements §D using `lancedb` Python package — single new backend dependency. Chroma never enters the codebase. New files: `backend/services/vector_store.py`, `backend/migrations/init_lance.py`. Modified: `backend/api/routes/peptides.py` (POST /api/peptides/similar route), `backend/config.py` (LANCE_DB_PATH setting, default `./data/lance`), `docker-compose.yml` (volume mount). Lance files are plain on-disk artifacts — VPS rsync/snapshot backup covers them automatically. Tech radar: LanceDB moves untracked → "adopt now". DESY K8s migration: volume mount maps to ReadWriteOnce PVC.
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-002_vector-store-evaluation.md`, AltexSoft Chroma audit, TigerData pgvector vs Qdrant benchmark, LanceDB embedded docs.

---

## ADR-015 — Jupyter notebook export targets public REST API (not pvl-py local install)

**Date**: 2026-05-08 · **Status**: ACCEPTED · **Authors**: Said + T-RES + T1
**Context**: RB-001 §5 ranks Jupyter notebook export as the top single adoption-leverage move for computational biology labs (PLOS Comp Biol 2024 BioConda + Jupyter benchmark). Two implementation options: (a) generated `.ipynb` calls the public PVL REST API directly — no local install needed; (b) generated `.ipynb` requires `pip install pvl-py` first.
**Decision**: Notebook export uses option (a) — frictionless for the researcher (no install). Notebook includes a commented-out cell at the top showing how to swap to pvl-py for offline / batch use.
**Reasoning**: Adoption matters more than offline correctness for v0.x. A notebook that "just works" when downloaded is a citable artefact; a notebook that requires `pip install` first creates a friction step that loses 50% of users at the first cell. pvl-py remains the alternative for power users.
**Implication**: 20h effort, Wave 2-3. New `ui/src/lib/exportNotebook.ts` generates JSON. No new backend endpoint required (notebook calls existing public REST endpoints). API stability becomes more important — breaking changes to REST will break shipped notebooks. Versioning convention: notebook embeds the PVL version it was generated against; PVL keeps backwards compatibility for at least 12 months.
**Evidence**: `docs/active/RESEARCH_BRIEFS/RB-001_researcher-needs.md` §5 feature 5, §11 question 4.

---

## How to add a new ADR

When you (or a future contributor) make a load-bearing decision:

1. Add a new entry below the most recent one.
2. Format: `## ADR-NNN — Short title`, `**Date**`, `**Status**` (PROPOSED / ACCEPTED / DEPRECATED / SUPERSEDED), `**Authors**`.
3. Fill: Context, Decision, Reasoning, Implication, Evidence.
4. Keep entries tight: 5-10 lines each.
5. Cross-link from `ROADMAP.md` and `TECH_PLATFORM_VISION.md` where relevant.

ADRs may be SUPERSEDED but never deleted — the record matters for project history.

---

## ADR-021 — Peleg's Wave 2.8/2.9 close-out scientific decisions (2026-06-29)

**Context.** Six open scientific questions (OQ1–OQ8, minus the two already answered in earlier waves) needed Peleg's call before tagging v1.0.0. Filed as GitHub Issues #106–#111 with paste-ready context.

**Decision.** Peleg replied 2026-06-29 with:

| Issue | Question | Decision | Code state |
|---|---|---|---|
| #106 (OQ1) | Coiled-coil terminology — 3-state coil vs coiled-coil motif | **Coiled-coil motif.** Pipeline class label uses the motif convention end-to-end. | Already matches. S4PRED's `P(Coil)` chart curve stays as-is (semantically the per-residue 3-state SS probability, not the motif). |
| #107 (OQ2) | "Rank & Merge" — what does Merge mean to the user | Deferred to next dev. | Current wording retained. |
| #108 (OQ4) | y=0.5 dashed line in Aggregation-Structure Overlay | Deferred to next dev. | Current line retained. |
| #109 (OQ5) | SSW residue color in Mol* 3D viewer | **Magenta confirmed.** | Already shipped — `sswColor.ts` SSW_RESIDUE_HEX = `#E040FB` applied across plots, badges, Mol* viewer, sequence track, exports (Wave 2.8). |
| #110 (OQ7) | Beta % calculation flagged "too aggressive" (F10) | Deferred to next dev. | Current threshold retained. |
| #111 (OQ8) | "AlphaFold-predicted structure" title — keep or delete | **Delete per 2026-06-18 meeting.** | Already shipped — A8 (`PeptideDetail.tsx:430`, commit 2026-06-23) replaced the title with "Predicted Secondary Structure". |

**Reasoning.** Peleg's verbatim guidance: "*the motif one. make sure its good for researchers. magenta confirmed. delete per meeting. other than that, keep everything as is. its fine. next dev will take care of the specifics.*"

**Implication.** PVL is scientifically locked at Wave 2.8/2.9 close-out. No code changes required (every "decision" landed on already-shipped behaviour). The three deferred items (OQ2, OQ4, OQ7) stay open as Tier-4 polish entries in `BACKLOG.md` for the next developer if they want to revisit; Peleg does NOT consider them publication-blocking.

**Evidence.** GitHub Issues #106–#111 closed 2026-06-29 with this ADR linked.
