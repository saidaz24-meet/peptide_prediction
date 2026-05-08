# PVL — Master Push Plan

**Author**: T1, drafted 2026-05-07. **For**: Said Azaizah.
**Status**: Living document. Updated after every push.
**Scope**: PVL's path from current-state (50% of the vision per Said) to **full-on platform**, sequenced as N major pushes. Not "good enough", not "minimum viable", **the actual vision**.

> "Take all plannings that we do, prioritize them by results, and actually run on them one by one until we have a full on platform — not only a 'ready and good enough' one." — Said, 2026-05-07.

---

## §0 — The "full-on platform" success criteria

PVL is "the actual vision" when ALL of the following are true:

### Surface coverage (multi-channel ecosystem)
- ✅ Web app — production-grade dashboard
- ✅ Self-hostable Docker — `docker compose up`
- ⏳ **`pvl-py`** — `import pvl; pvl.analyze(df)` Jupyter-native, used by labs
- ⏳ **`pvl-cli`** — `pip install pvl-cli && pvl analyze seqs.fasta` used in pipelines
- ⏳ **MCP server** — Claude Desktop / Cursor / any LLM agent calls PVL natively
- ⏳ **Embeddable widget** — `<iframe>` block other lab dashboards drop in

### Scientific authority
- ✅ 4-category classification (Peleg's verbatim definitions)
- ✅ Live 3D structure overlay (Mol\* + AlphaFold)
- ⏳ **Multi-predictor consensus** — 8 amyloid algorithms (AGGRESCAN, FoldAmyloid, CamSol, Zyggregator, Pafig, AmyloDeep, Beta-contiguity, Packing density) with consensus visualization
- ⏳ **PubMed RAG citations** — every interpretation backed by real papers
- ⏳ **ESMFold integration** — structure prediction for novel sequences not in AlphaFold DB
- ⏳ **Predictor benchmarking** — accuracy/sensitivity/specificity per predictor on labeled datasets

### Research instrument quality
- ✅ Reproducibility-as-permalink (every analysis citable)
- ✅ Hover-everywhere drill-down
- ✅ Sentry release-tagged observability
- ⏳ **Galagos-style auto-PDF** — multi-page scientific report per peptide
- ⏳ **Vector embedding similarity search** — "find peptides like this one"
- ⏳ **Real-time collaboration** — multiple researchers in one analysis (Yjs / Liveblocks)
- ⏳ **One-click paper figure pack** — Nature/Science-supplement-ready SVG export

### Long-term sustainability
- ✅ Test coverage 880+ deterministic
- ✅ AI code review on every PR (CodeRabbit)
- ✅ Auto-PRs for deps (Dependabot)
- ⏳ **Daily VPS backup** — automated to Cloudflare R2 / Backblaze B2
- ⏳ **Public status page** — uptime visible to citers
- ⏳ **OBF / NumFOCUS fiscal sponsorship** — donation infrastructure

### Adoption signals
- ⏳ Listed on **bio.tools**
- ⏳ **Zenodo DOI** for every release
- ⏳ ≥3 external citations (organic, post-launch)
- ⏳ ≥1 lab using daily

**Right now**: 12 of ~30 criteria met = ~40%. Said's "50%" estimate is generous. We have plenty of work.

---

## §1 — The 7-wave master plan (sequenced by results)

Each wave is sized 1-3 months wall-clock (parallel agents make many items concurrent). The order is **results-prioritized**: each wave delivers a specific platform-level capability that makes the next wave more valuable.

### Wave 1 — Foundation + UI Quality (✅ PUSHED 2026-05-07)

**Status**: ✅ **merged to `main` 2026-05-07 via PR #4 — merge commit `5d2ad3f`**. 28 commits delivered.
**CI verification**: all 5 checks green — Detect Changes (7s) · CodeRabbit (review skipped, file-count limit hit on 192-file PR) · Backend Tests (2m34s) · Frontend Build (36s) · Docker Build (5m56s).
**Result delivered**: PVL is a clean, scientifically correct, observable, reproducible web app with 887 tests, on GitHub `main`, ready for Wave 2 build-out.

**What landed**:
- 4-category classification (Peleg foundation)
- Hover-everywhere + drill-down architecture
- Live 3D structure overlay (Mol\*)
- Reproducibility permalinks
- Demo mode auto-load
- Sentry release-tagged observability
- AI code review (CodeRabbit) + Dependabot configured
- 12 ADRs documenting architectural decisions
- Comprehensive coverage audit
- README + CONTRIBUTING + DECISIONS + TECH_PLATFORM_VISION + TOP_CEO_RECOMMENDATIONS docs

**What's deferred to v0.1.1** (small follow-ups):
- P8 helix up/down direction visualization
- ORCID iDs for Peleg + Alex (when they reply to Wave C)
- Final visual polish based on review screenshots

**Push trigger**: this wave does NOT push to main yet per Said directive (2026-05-07). The work continues; v0.1.0 release tag waits until at least Wave 2 closes so the release reflects "AI-platform-ready", not "dashboard with monitoring".

---

### Wave 2 — AI Platform Surfaces (NEXT — start now)

**Estimated wall-clock**: 6-10 weeks at part-time pace; 3-4 weeks if Said + Cowork hammer it.
**Result delivered**: PVL becomes the first peptide tool any LLM agent natively calls. Multi-surface ecosystem real (not scaffolded).

**Headline deliverables**:
1. **MCP server (Phase G1)** — FastMCP wrapping every PVL endpoint, Claude Desktop tested
2. **`pvl-py` real package** — Jupyter-native, used in 1+ test notebook
3. **`pvl-cli` real package** — `pvl analyze` + `pvl rank` + `pvl export` working
4. **Vector embedding similarity search** — Chroma local, "find peptides like this one"
5. **Galagos-style auto-PDF** — multi-page scientific report per peptide via jsPDF + LLM-templated copy
6. **Demo mode polish** — first-visit modal active, dataset auto-loaded, conversion measured via Sentry tag

**Detailed task breakdown**: see §3 below.

**Why this wave first**: every subsequent wave (multi-predictor, RAG, scaling) is more valuable when PVL is already AI-callable. MCP + multi-surface = the 10× leverage move.

**Push trigger**: when MCP server + pvl-py + pvl-cli + auto-PDF are all working AND reviewed by Peleg/Alex (who might use Wave C email reply window to test the LLM integration).

---

### Wave 3 — Multi-Predictor Consensus (Phase I)

**Estimated wall-clock**: 2-3 months. Heavy backend work.
**Result delivered**: PVL is the only tool with 8-algorithm amyloid consensus visualization.

**Headline deliverables**:
1. **Predictor plugin architecture** — `BasePredictor` interface in `backend/predictors/`
2. **AGGRESCAN integration** (REST API, well-documented)
3. **FoldAmyloid integration** (server, parseable HTML)
4. **CamSol Intrinsic integration**
5. **Zyggregator integration**
6. **Pafig integration** (local binary like TANGO)
7. **AmyloDeep integration** (NN model, weights downloadable)
8. **Beta-contiguity + Packing density** (algorithmic, implement directly)
9. **Consensus aggregation logic** — per-peptide vote summary
10. **Consensus visualization UI** — per-predictor verdict table + headline ("7/8 flag amyloid propensity")
11. **Predictor benchmarking** — run all 8 on labeled datasets (AmyloGraph, WALTZ-DB, S. aureus 2023), report sensitivity/specificity per predictor
12. **Consensus filter on data table** — filter peptides by consensus level

**Why this wave next**: scientific authority. Once PVL has 8 predictors + benchmarks, no competitor matches. JOSS paper essentially writes itself (Peleg's job, not Said's).

**Push trigger**: all 8 predictors integrated + benchmarks documented + UI shipped.

---

### Wave 4 — RAG + Literature Integration (Phase G2)

**Estimated wall-clock**: 6-8 weeks.
**Result delivered**: PVL explains its predictions with real PubMed citations. AI agents calling PVL get scientific context, not just numbers.

**Headline deliverables**:
1. **PubMed integration** — query API, fetch abstracts
2. **Vector embedding store** — Chroma or pgvector for paper abstracts (extends Wave 2 vector store)
3. **Domain axiom library** — structured definitions of amyloid / SSW / FF-Helix / aggregation (Peleg-reviewed)
4. **Citation verification** — never hallucinate DOIs; only cite papers PubMed returned
5. **Per-peptide interpretation** — "P02743 (Serum amyloid P-component) shows 78% FF-Helix and high TANGO. Consistent with Pepys et al., Nature 2006…" with verified citation
6. **Citation export** — copy as BibTeX from any auto-generated paragraph
7. **MCP integration** — RAG callable from Claude / Cursor as a tool

**Why this wave**: turns PVL from "tool" into "research collaborator." Researchers don't have to go to Google Scholar after using PVL — PVL hands them citations.

**Push trigger**: ≥10 peptide test cases produce non-hallucinated citation paragraphs; Peleg verifies each.

---

### Wave 5 — Scale + Deployment (Phase C)

**Estimated wall-clock**: 4-8 weeks. Blocked on DESY (K8s namespace).
**Result delivered**: PVL runs on DESY infrastructure at production scale. Proteome-precomputation ready.

**Headline deliverables**:
1. **DESY K8s migration** (C2) — Helm chart, Ingress, ConfigMap, PVCs
2. **Proteome precomputation** (C1) — top 10 organisms (~101K sequences) precomputed via K8s CronJobs → Parquet → DuckDB
3. **ESMFold integration** (C3) — on-demand structure prediction for sequences not in AlphaFold DB. GPU access required.
4. **Plugin architecture polish** (C4) — third parties can register new predictors via `entry_points`
5. **Multi-region resilience** (O3) — Cloudflare Pages + Render as fallback frontend hosts
6. **Public status page** (O7) — Cloudflare status / Better Stack
7. **Daily VPS backup automation** (O2) — Backblaze B2 / Cloudflare R2 + Sentry Cron monitor

**Why this wave**: PVL becomes infrastructure, not a tool. When the whole human proteome is queryable in <1s, every researcher's workflow shifts.

**Push trigger**: 101K-sequence S. aureus precomputed lookup loads in <500ms; DESY K8s namespace assigned and working.

---

### Wave 6 — Marketing, Content & Adoption (Phase H)

**Estimated wall-clock**: ongoing, batched in summer breaks.
**Result delivered**: PVL is *known*. Citations + adoption signals.

**Headline deliverables**:
1. **bio.tools registration** (A4) — listed and curated
2. **Zenodo DOI** (A5) — auto-archived per release; cite-able
3. **JOSS paper draft** (A7) — Peleg writes; Said provides platform docs
4. **OBF / NumFOCUS fiscal sponsorship application** — donation infrastructure
5. **Mozilla Open Source Awards application** — $20-100K
6. **CZI Essential Open Source for Science application** — $50-250K
7. **DESY internal grant** (Alex-led) — part-time RA funding
8. **LinkedIn / Bluesky animated demo videos** (H2) — passive citation accrual
9. **ISMB July 2027 poster + abstract** — peptide community first impression
10. **Demo / talk decks reusable** (H4) — for events
11. **One-click paper figure pack** (A6) — Nature-supplement export

**Why this wave**: 1000-test platform is wasted if nobody knows. Adoption signals trigger funding, partnerships, contributors.

**Push trigger**: continuous; no single end. Re-evaluate after each milestone.

---

### Wave 7 — Long-Term Operations (Phase O + S full)

**Estimated wall-clock**: 2-4 weeks of focused work, then ongoing.
**Result delivered**: PVL self-monitors, self-heals, self-recovers without Said's daily attention.

**Headline deliverables**:
1. **Sentry full dashboard** — all 10 sub-tasks (S1-S10) configured + runbook live
2. **Sentry Seer AI triage** — auto-PR proposals on new issues
3. **Performance budgets** — LCP / FID / CLS gates in CI
4. **Daily backup with Sentry Cron monitoring** (O2)
5. **Multi-region resilience** (O3)
6. **Status page public** (O7)
7. **Monthly maintenance protocol document** (O.6) + Said's calendar block

**Why this wave** (last in sequence): only sustainable when there's a real platform to operate. Premature ops automation = wasted setup time.

**Push trigger**: PVL survives a 30-day Said-untouched stretch with no incidents.

---

## §2 — How we execute (terminals + agents + Cowork)

**Said's role**: CEO + product + scientific QA + final reviewer. Commits go through Said.

**T1 (this Claude Code main terminal)**: orchestration, doc writing, ADR additions, audit reviews, small surgical fixes, prompt drafting.

**T2 (backend terminal)**: Python / FastAPI / pipeline / tests / MCP server / predictor plugins. Big-chunk batches, reports back at end.

**T3 (frontend terminal)**: React / TypeScript / Vite / chart components / wiring Cowork outputs. Big-chunk batches.

**T-PEL (Peleg-feedback terminal)**: dedicated to Peleg-flagged scientific corrections. Activated when Wave C reply arrives.

**Cowork**: visual / system-design tasks where polished generated code beats hand-written. V4-V6 prompts proven this works. New prompts written ahead of each wave.

**Background research agents**: launched for: market research, competitive analysis, scientific literature reviews, audits. Output to `docs/active/`.

**Sentry Seer + CodeRabbit**: AI hedges in CI/CD. Catch issues before T1 reviews.

---

## §3 — Wave 2 detailed plan (NEXT WAVE)

**Theme**: AI Platform Surfaces. Make PVL real on every channel an LLM-aware researcher uses.

### 3.1 — Goals (results-prioritized)

| Priority | Goal | Why first |
|---|---|---|
| **P0** | MCP server (Phase G1) | Differentiator. Makes PVL discoverable in every Claude Desktop / Cursor instance globally. |
| **P0** | `pvl-py` real (B18) | Researchers in Jupyter notebooks don't switch to a browser. Critical for adoption. |
| **P1** | `pvl-cli` real (B17) | Pipeline integration for batch labs. |
| **P1** | Vector similarity search | "Find peptides like this one" is the #1 ask researchers have. Chroma local; small infra. |
| **P2** | Auto-PDF report (G5) | Galagos-style scientific PDF. High wow-factor for paper reviewers + bio.tools curators. |
| **P2** | Demo mode polish + first-visit modal active | Conversion. v0.1.0 release-readiness. |

### 3.2 — Concrete tasks per goal

#### G1 MCP server (~16-24h)
- G1.1 Scaffold `mcp_server/` directory at repo root using FastMCP (or `mcp` Python SDK)
- G1.2 Define MCP tools mapping every public PVL endpoint:
  - `search_uniprot(query, organism?, length_min?, length_max?, reviewed?)` → browse rows
  - `analyze_sequences(accessions_or_sequences)` → full PVL pipeline result
  - `get_peptide_detail(accession)` → single peptide deep-dive
  - `rank_candidates(dataset_id, weights?, preset?)` → top-N
  - `compare_cohorts(dataset_a, dataset_b)` → cohort comparison
  - `find_similar_peptides(reference_sequence, k=10)` → vector similarity (depends on vector store)
- G1.3 Domain axioms as MCP system prompt — paste Peleg's 4-category definitions verbatim
- G1.4 Transport: stdio (Claude Desktop) AND SSE (web)
- G1.5 Integration test: run Claude Desktop with PVL MCP server, verify it can answer "find me top 5 amyloid candidates from S.aureus length 10-50"
- G1.6 Document config in `docs/active/MCP_RUNBOOK.md`
- G1.7 Update README with "Use PVL from Claude Desktop" section
- G1.8 Add to ADR-009 status: ACCEPTED (was PROPOSED)

#### B18 pvl-py polish (~12-16h)
- B18.1 Replace placeholder with real `pvl.analyze(df_or_fasta_path) -> pd.DataFrame`
- B18.2 Real `pvl.rank(df, weights=...)` → ranked DataFrame
- B18.3 Real `pvl.search_uniprot(query, **kwargs) -> pd.DataFrame`
- B18.4 Wraps the REST API (configurable base URL: `pvl.set_base_url(...)`)
- B18.5 Async support: `pvl.aanalyze(...)` returns awaitable for notebooks doing concurrent calls
- B18.6 Test notebook in `pvl-py/notebooks/quickstart.ipynb` showing the workflow
- B18.7 Type stubs (`py.typed` already exists; add `*.pyi` if needed)
- B18.8 Publish to test PyPI (`testpypi`) under `pvl-py` package name

#### B17 pvl-cli polish (~8-12h)
- B17.1 `pvl analyze <path-to-fasta-or-csv>` → results to stdout (or `--output file.csv`)
- B17.2 `pvl rank <results.csv> --top 10 --preset helix-focus`
- B17.3 `pvl export <results.csv> --format pdf|svg|csv|fasta`
- B17.4 `pvl search <query> --organism 1280 --length 10-50`
- B17.5 `pvl mcp` → starts the MCP server (alias for the G1 entry point)
- B17.6 `--server-url` flag overriding the default (allows local dev + DESY VPS)
- B17.7 Smoke tests
- B17.8 Publish to test PyPI under `pvl-cli`

#### VEC vector similarity search (~12-16h)
- VEC.1 Pick: Chroma local (zero infra) — start here
- VEC.2 Embedding model: Anthropic / OpenAI API for v0.x; later swap for local sentence-transformers
- VEC.3 On peptide ingestion, compute embeddings for sequence + metadata; store in Chroma
- VEC.4 New API endpoint `POST /api/peptides/similar` — `{accession, k}` → list of similar peptides with scores
- VEC.5 UI surface: "Find similar peptides" button on PeptideDetail → opens drill-down with results
- VEC.6 MCP tool `find_similar_peptides` (already in G1.2 list)
- VEC.7 Document in `docs/active/VECTOR_SEARCH_SPEC.md`

#### G5 Auto-PDF report (~16-24h)
- G5.1 Multi-page jsPDF template based on Galagos sample (`New_Feedback/tango_viral_peptides_report.pdf`)
- G5.2 Page 1: cover (peptide ID, sequence, classification pills, timestamp, permalink)
- G5.3 Page 2: TANGO + S4PRED summary + per-residue arrays
- G5.4 Page 3: biochem comparison radar + percentile bars
- G5.5 Page 4: helical wheel + 2D backbone
- G5.6 Page 5: 3D structure snapshot (Mol\* renderToCanvas)
- G5.7 Pages 6-N: scientific interpretation paragraph (Anthropic Claude API templated, NOT free-form; uses domain axioms)
- G5.8 Page N+1: methods + parameters + threshold values (auto-generated from current state)
- G5.9 Trigger: button on PeptideDetail "Export auto-PDF report"
- G5.10 Embedded permalink + version + Zenodo DOI placeholder
- G5.11 Test fixture: M melittin reference report

#### Demo mode polish + first-visit (~4-6h)
- DM.1 First-visit modal active by default (currently optional)
- DM.2 5-step coachmark walkthrough (KPI cards → drill-down → classification pills → 3D viewer → permalink copy)
- DM.3 Sentry tag `data_source: demo` analytics
- DM.4 "Start over with fresh demo" link in DemoModeChip
- DM.5 Loading skeleton during demo dataset fetch (replace blank state)

### 3.3 — Wave 2 prompts (terminals + Cowork)

These get written into `T2-INSTRUCTIONS.md` / `T3-INSTRUCTIONS.md` / `COWORK_PROMPTS_PELEG.md` when Wave 2 starts. Order:

**T2 batch — Backend** (Wave 2 backend, big-chunk):
1. Scaffold `mcp_server/` with FastMCP
2. Implement G1.2 tool definitions
3. Add `POST /api/peptides/similar` endpoint
4. Polish `pvl-py` and `pvl-cli` real commands

**T3 batch — Frontend wiring** (Wave 2 UI):
1. Wire VEC vector search button + drill-down view
2. Demo mode first-visit-modal default ON
3. 5-step coachmark
4. "Find similar peptides" button on PeptideDetail
5. Auto-PDF export button on PeptideDetail toolbar

**Cowork V7 round — Auto-PDF report layout**:
1. Multi-page PDF template (cover, summary, biochem, structure, interpretation)
2. Page-styling polish for paper-supplement quality

**Cowork V8 round — Demo + onboarding visual polish**:
1. First-visit-modal redesign (Stripe-style restraint)
2. Coachmark visual style
3. Empty / loading states

### 3.4 — Wave 2 success criteria

**Status as of 2026-05-08 PM (local branch `wave-2-ai-platform`, 14 commits ahead of main, NOT pushed):**

- [x] **MCP server scaffold** — `mcp_server/` with 7 tools, 33 tests. ADR-009 ACCEPTED. Commit `80a514f`.
- [x] **Auto-PDF report renderer** — 6 panels, 42 tests. Commit `18b8e49`. **Wired in toolbar** `707426b`.
- [x] **First-visit demo modal + coachmark walkthrough** — V8-1 refactor in place. Commits `1028891` + `707426b`.
- [x] **SimilarPeptidesInspector frontend + button** — Commits `4bca7e9` + `707426b`. Backend route pending (Section D).
- [x] **BibTeX export (RB-001 #1, ADR-013)** — `7cf6ee9`. 10 tests.
- [x] **Peleg cleared Staphylococcus 2023 dataset for public display** — ADR-014 fully ACCEPTED `6225810`. Accuracy badge feature unblocked.
- [ ] `claude` running locally with PVL MCP server can answer: "find me top 5 amyloid candidates from S.aureus length 10-50" — **manual test pending** (Said local box, see `MCP_RUNBOOK.md` §2.3)
- [ ] `pip install pvl-py` works from test PyPI; quickstart notebook runs — **T2 §B in queue**
- [ ] `pvl analyze test.fasta` outputs results — **T2 §C in queue**
- [ ] "Find similar peptides" returns 5+ semantically similar entries — **T2 §D priority #1, blocked on RB-002 vector store brief (T-RES running)**
- [ ] FASTA bulk upload (RB-001 #3, ADR-013) — **T2 §H + T3 §F**
- [ ] `run_metadata` in CSV/JSON exports (RB-001 #2, ADR-013) — **T2 §G + T3 §I**
- [ ] About page Peleg credit + Staphylococcus 2023 dataset card (ADR-014) — **T3 §E priority #1**
- [ ] Gold-standard accuracy badge (RB-001 #4b, ADR-014) — **T2 produces threshold-curve JSON, T3 §H**
- [x] **All prior tests still pass** — 1002/1002 passing (463 backend + 33 MCP + 506 frontend; +115 from baseline 887)
- [ ] Sentry has zero new error fingerprints attributed to Wave 2 work — **measured after deploy**
- [ ] Wave C email goes out with Wave 2 demo links — **after push**

**Predictor disagreement score (RB-001 #4a)**: SKIPPED per Said directive 2026-05-08 — Peleg killed `ConsensusCard`/`ConsensusTier` in FIX-013 (2026-05-06) for unjustified tier math. Said: skip entirely, move on.

### 3.5 — Current dispatch state (2026-05-08 PM)

T1 has dispatched all sub-terminals; T1 is now in orchestration mode (per `feedback_t1_role_ceo.md`):

| Terminal | Status | Working on |
|---|---|---|
| **T2 (backend)** | DISPATCHED | Pick D (similar backend) → G (run_metadata) → H (FASTA bulk) → I (MCP route gaps) → B (pvl-py) → C (pvl-cli). See updated `T2-INSTRUCTIONS.md`. |
| **T3 (frontend)** | DISPATCHED | Pick E (About page Peleg credit + dataset card) first — pure-frontend, ready now. Then F/G/H/I as T2 unblocks them. See updated `T3-INSTRUCTIONS.md`. |
| **T-RES (research)** | RUNNING | M-003 vector store evaluation (RB-002). Brief informs T2 §D. Background async. |
| **Cowork** | IDLE | Wait for T1 next round (likely V10 polish or content prompts after Wave 2 ships). |
| **T-PEL** | IDLE | Wait for next batch of Peleg feedback to process. |

---

## §4 — Beyond Wave 2 (high-level only — detail at the time)

Each subsequent wave gets the same level of detail (§3-style) when it starts. Sketch only here:

### Wave 3 detail outline
- Predictor plugin interface
- 8 predictor integrations (likely 1-2 per week, parallelizable across T2 + Cowork research-agents)
- Consensus visualization v1 (per-peptide table) → v2 (per-cohort summary)
- Benchmarking script + results doc

### Wave 4 detail outline
- PubMed wrapper service
- Vector store extension to paper abstracts
- LLM template prompts for citation paragraphs
- Citation verification (deny if not in PubMed)
- MCP tool integration

### Wave 5 detail outline
- Helm chart authoring
- ESMFold service
- DESY namespace coordination
- Cloudflare/Render fallback hosts
- Status page

### Wave 6 detail outline
- bio.tools form
- Zenodo workflow
- 3-4 grant applications
- LinkedIn video templates

### Wave 7 detail outline
- All Sentry S1-S10 done
- Performance budgets in CI
- Backup automation
- Monthly protocol calendar block

---

## §5 — Decision rules (when to deviate from this plan)

1. **If a wave produces unexpected user demand** (e.g., Wave 2 MCP gets 100 stars in a week) — accelerate that wave, defer the next.
2. **If a wave reveals a scientific blocker** (e.g., predictor X doesn't license for redistribution) — drop that sub-task, document, move on.
3. **If Said's bandwidth changes** (MIT semester, family event, etc.) — pause work; do NOT decompose into smaller worse versions. The plan respects time.
4. **If a major external technology shift happens** (e.g., MCP protocol gets superseded) — re-evaluate the affected wave; update ADR-009.
5. **If a competitor ships something equivalent** (e.g., another peptide tool ships MCP) — accelerate differentiation in adjacent waves (Phase I multi-predictor, RAG citations).

---

## §6 — Living-document protocol

- **After every push**: update §1 wave status, add new ADRs to DECISIONS.md.
- **Before every wave start**: write the §3-style detail for that wave; update terminal-instruction files.
- **Quarterly review**: scan ROADMAP for items moved between waves; check Wave 7 sustainability has no degradation.
- **Annual review**: re-evaluate the §0 success criteria — has the vision shifted?

---

## §7 — Right now (immediate next actions)

**This wave (Wave 1) — finalize, no push yet**:
1. T1 produces this MASTER_PUSH_PLAN.md (DONE — you're reading it)
2. T1 commits everything; clean tree
3. Said reviews this plan; tweaks priorities if any
4. **No release tag** (per Said directive — wait for at least Wave 2 close)

**Wave 2 — start now**:
1. T1 writes Wave 2 detailed prompts (T2-INSTRUCTIONS, T3-INSTRUCTIONS, Cowork V7/V8)
2. Said pastes T2 first (MCP server scaffolding) — biggest leverage
3. T3 + Cowork run in parallel as Wave 2 progresses
4. Background research-agent: market research on MCP-aware tools to learn from
5. Wave C email STILL goes out this month (with Wave 2 in-progress disclosure) so Peleg/Alex test as we build

**Said's continuous role**:
- Review each commit
- Decide priority shifts when needed
- Run smoke tests on each delivery
- Send Wave C when Wave 2 has 1-2 working demos
