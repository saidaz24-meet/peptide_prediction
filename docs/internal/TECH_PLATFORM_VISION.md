# PVL — Technical Platform Vision

**Author**: Said Azaizah · **Date**: 2026-05-07 · **Status**: Living document.

> "My job is to create the best and most long-term vision and AI platform" — Said, 2026-05-07.
>
> Peleg owns the science, Alex advises. Said owns the **platform**: architecture, AI integration, observability, scalability, developer experience, and the technology choices that determine whether PVL becomes a once-published paper artifact or a sustained research instrument that keeps shipping for years.

---

## 1 — What kind of platform is PVL becoming

**Today (v0.1)**: a peptide-aggregation prediction dashboard that combines TANGO + S4PRED + biochemical metrics + AlphaFold structure overlay in one UI, with reproducibility-as-permalink and hover-everywhere drill-down.

**Where it goes (v0.x → v1.0)**: a multi-surface scientific AI platform.
- Web app (current)
- Python package (`pvl-py`, scaffolded)
- CLI (`pvl-cli`, scaffolded)
- MCP server (Phase G1) — Claude / GPT / any LLM can query PVL natively
- Self-hostable Docker (current)
- Embeddable widget (future) — drop PVL into other lab dashboards

The platform thesis: every researcher's workflow is multi-tool. PVL succeeds when it's the connective tissue between UniProt + AlphaFold + their notebook + their LLM agent — not a destination, but a hub.

---

## 2 — Technology Radar (what we use, what we plan, what we park)

### 2.1 — Adopt now (in this v0.1 cycle)
| Tech | Where | Why |
|---|---|---|
| **Sentry production-grade** (S1-S10 from roadmap Phase S) | both | Self-monitoring during semesters. ✅ partly wired. |
| **Sentry source maps via vite plugin** | frontend | Readable stack traces in production. ✅ Cowork V6-1 wired. |
| **OpenTelemetry-style trace_id correlation** | backend ↔ frontend | Single trace ID flows from button click to TANGO subprocess. ✅ partly wired. |
| **Pydantic v2 strict request schemas** (extra="forbid") | backend | Silent contract bugs caught loudly. ✅ Wave B. |
| **Zustand persist middleware** with proper StorageValue typing | frontend | Correct localStorage migration. ✅ Wave 0. |
| **Mol\* viewer with PVL overlays** | PeptideDetail | Killer differentiator. ✅ Wave V4-2. |
| **Reproducibility permalink** | frontend | Every analysis is citable. ✅ Wave V4-1. |
| **Dependabot weekly batched PRs** | repo | Auto-deps during MIT semesters. ⏳ Guide F to do. |

### 2.2 — Plan next (v0.2, post-launch)
| Tech | Where | Why |
|---|---|---|
| **MCP server (FastMCP / mcp-python SDK)** | new `mcp_server/` | Roadmap Phase G1. Expose every PVL endpoint as a tool any MCP-aware LLM (Claude Desktop, Cursor, custom agents) can call. The transformative AI integration. |
| **LangGraph or LlamaIndex agent** | optional service | Let researchers write prompts like "find top 10 amyloid candidates from S.aureus" and PVL coordinates UniProt → predict → rank → respond. |
| **pgvector (Postgres extension) or Chroma** | optional service | Vector store for "find peptides similar to this one" semantic search. Embeddings via Anthropic / OpenAI / OSS models. |
| **TanStack Query** | frontend | Better caching of UniProt + AlphaFold API responses. Replace ad-hoc fetch with proper query layer. |
| **Zod schemas mirrored from Pydantic** | frontend | Runtime validation of API responses. Catches contract drift on the client too. |
| **Playwright E2E in CI** | CI | Browser-level smoke test on every push. |
| **Biome (Rust-based linter+formatter)** | frontend | Faster than ESLint+Prettier. Lower CI time. |
| **AlphaFold 3 (when open weights available)** | backend | Better structure prediction; current AlphaFold DB is v2. |
| **ESMFold integration** | backend | On-demand structure prediction for sequences not in AlphaFold DB. Roadmap C3. |

### 2.3 — Parked (re-evaluate at each milestone)
| Tech | Why parked |
|---|---|
| **Cloudflare Pages / Workers as fallback host** | DESY VPS is fine for now; multi-region only matters if traction warrants it. (Roadmap O3.) |
| **Liveblocks / Yjs real-time collaboration** | Compelling but complex. Wait for user requests. |
| **Bun runtime** | Production maturity still climbing; revisit in 6 months. |
| **React 19 / Vite 7 / Tailwind 4** | Adopt when stable + ecosystem catches up. |
| **Three.js custom globe (replacing COBE)** | Visual flourish; not a differentiator. Roadmap D3.5 stays parked. |
| **WebGPU / GPU-accelerated TANGO** | TANGO runs on CPU; GPU port would require algorithm rewrite — not in scope unless Peleg requests. |

---

## 3 — Architecture decisions log (ADR-style)

Each decision in this section is a load-bearing choice that affects all future development. Future contributors read this before changing the architecture.

### ADR-001 — 4-category classification at the data layer (2026-04-26)
**Decision**: classification flags (`helixFlag`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag`) are computed on the backend via `apply_ff_flags`. Frontend never re-derives.
**Rationale**: single-source-of-truth for Peleg's category definitions; single+batch consistency guarantee.
**Implication**: any new classification (Phase I multi-predictor) must follow the same pattern.

### ADR-002 — Pydantic v2 `extra="forbid"` on request schemas (2026-05-02)
**Decision**: every request schema rejects unknown fields. Aliases via `AliasChoices` for legacy field names.
**Rationale**: silent contract bugs (e.g., `max_results: 5` → `size: 500` default) are catastrophic in scientific tools where users trust the result.
**Implication**: every new endpoint adds the same `model_config = ConfigDict(extra="forbid")`.

### ADR-003 — Helix % canonical = segment-based S4PRED (2026-04-26)
**Decision**: `s4predHelixPercent` (segment-based, computed by `_get_segment_percentage`) is the ONE definition of "Helix %" in the UI. All probability-mean displays were removed.
**Rationale**: Peleg flagged the field was being miscalculated; audit found 4 different "helix %" all displayed identically. Picking one definition per Peleg's category-1 spec.
**Implication**: any new helix metric must use a distinct label.

### ADR-004 — Reproducibility-as-permalink (2026-05-06)
**Decision**: every analysis state is encodable into a URL. URL = state. State = URL.
**Rationale**: paper citations + Slack sharing + reviewer reproducibility require this primitive.
**Implication**: any new piece of analysis state must round-trip through `lib/permalink.ts`.

### ADR-005 — Hover-everywhere via central `metricRegistry` (2026-05-04)
**Decision**: every numeric/metric exposed in UI registers in `lib/metricRegistry.ts` with: definition, units, formatter, value-getter, related metrics.
**Rationale**: scattered tooltips drift. One registry = one source of truth = consistent hover content.
**Implication**: new metrics require registry entries.

### ADR-006 — Drill-down as universal slide-over, not modal (2026-05-04)
**Decision**: every chart's `↗` icon launches a right-side slide-over `<DrillDown>` (Stripe-style), not a centered modal.
**Rationale**: preserves context. User can see the dashboard behind the slide-over.
**Implication**: any new chart adopts the same `useDrillDown().open(...)` pattern.

### ADR-007 — Sentry release-tagged + rich-context observability (2026-05-07)
**Decision**: every Sentry event carries `release`, anonymous `user.id`, custom tags (peptide_count, predictors, dataSource, viewport), full context (threshold preset, dataset hash).
**Rationale**: one-person-maintained scientific tool requires zero-effort triage. Rich context = sub-2-minute root cause.
**Implication**: every new feature that affects analysis state extends `setPVLSentryContext`.

### ADR-008 — Mol\* (mol-star) for 3D structure viewing (2026-05-06)
**Decision**: Mol\* is the de facto open-source structure viewer (used by RCSB PDB, AlphaFold DB, EBI). PVL adopts it as the canonical 3D layer.
**Rationale**: ecosystem alignment. Researchers already know Mol\* controls.
**Implication**: future overlays (multi-predictor, structural biology annotations) plug in via the same `molstarOverlays.ts` helpers.

### ADR-009 — MCP server as the AI-platform front door (proposed, v0.2)
**Decision**: when AI agent integration matures (Phase G1), expose PVL as an MCP server, not a custom REST chat UI.
**Rationale**: standardize on the protocol Anthropic + OSS LLMs converge on. Avoid building a chatbot when the user already has Claude Desktop / Cursor / their own agent.
**Implication**: every PVL REST endpoint should map cleanly to an MCP tool. Endpoints designed with this in mind from now on.

### ADR-010 — Demo mode auto-load on first visit (2026-05-06)
**Decision**: first-time visitor sees the Staphylococcus 2023 dataset auto-loaded. Real conversion comes from "this thing works immediately", not "this thing requires upload".
**Rationale**: bio.tools curators, paper reviewers, conference attendees all need to see the dashboard light up in <30s.
**Implication**: any future feature must work in demo mode without breaking; the demo dataset must remain in-repo + small.

---

## 4 — AI Platform vision (what makes PVL the "AI platform" Said wants)

PVL has three AI dimensions:

### 4.1 — AI for the user (Phase G — "ask PVL anything")
**Status**: planned, v0.2 summer.
- **G1 MCP server**: PVL becomes a tool any LLM can call. User says "find amyloid candidates from S.aureus length 10-50 with high FF-Helix" → LLM calls PVL's `search_uniprot` + `analyze_sequences` + `rank_candidates` tools and synthesizes a response with citations.
- **G2 RAG with PubMed**: when the LLM explains why a peptide matters, it cites real papers (PubMed API + verified citations, no hallucinated DOIs).
- **G5 Auto-PDF report** (Galagos-inspired): LLM generates a 12-page publication-style PDF for a peptide, including methods, parameters, biological interpretation. Driven by structured prompts + verified data — no inventing.

### 4.2 — AI for the developer (the maintenance hedge)
**Status**: in progress.
- **Anthropic Claude Code + Claude Cowork** as Said's primary dev partners — already in use.
- **CodeRabbit / Greptile** in CI for AI code review on every PR (post-v0.1 setup, ~10 min). Catches drift Said misses during MIT semesters.
- **Sentry Seer (AI-assisted issue triage)** — already available in Sentry MCP integration. Auto-suggest root-cause + fix PR for new errors.
- **GitHub Copilot Workspace / Cursor Agent** — when Said works on PVL during MIT, AI-pair-programming compresses any 4h task to 30 min.

### 4.3 — AI in the science (Phase I)
**Status**: parked v0.2 summer.
- **Phase I multi-predictor consensus** (Galagos-inspired): 8 amyloid algorithms (AGGRESCAN, FoldAmyloid, CamSol Intrinsic, Zyggregator, Pafig, AmyloDeep, Beta-contiguity, Packing density) — predictions aggregated, consensus visualized.
- **ESMFold / AlphaFold-3 integration**: structure prediction for novel sequences not in AlphaFold DB.
- **Vector embedding-based similarity search**: "show me peptides like this one" semantic search across the proteome. pgvector or Chroma.

---

## 5 — Long-term sustainability (the "MIT semesters" plan)

### 5.1 — Self-healing infrastructure (Phase O.1-O.6)
- Dependabot weekly PRs ⏳ (Guide F)
- Daily VPS backup with Sentry cron monitor ⏳ (Phase O.2)
- Caddy auto-TLS ✅
- Docker compose restart-always ✅
- CI/CD on every push ✅

### 5.2 — Self-healing observability
- Sentry release tags ✅ wired
- Rich context per event ✅ wired (V6-1)
- Slack/email alerts on real errors only ⏳ (Guide E)
- Cron monitoring on `/api/health` ⏳ (Guide E)
- Performance budgets (LCP, FID, CLS) ⏳ (Phase S.6)

### 5.3 — Self-onboarding for contributors
- README polish ⏳ (this round)
- CONTRIBUTING.md polish ⏳ (Phase O.4)
- Issue templates + good-first-issue labels ⏳ (Phase O.4)
- Code-of-conduct (Contributor Covenant) ⏳ (Phase O.4)

### 5.4 — The summer-vacation upgrade cycle
Every 6 months, Said does ONE major release with batched features:
- v0.2 (summer 2026): MCP server (G1), multi-predictor consensus (Phase I), pgvector similarity search.
- v0.3 (winter 2026): RAG (G2), auto-PDF reports (G5), Phase L landing polish.
- v0.4 (summer 2027): plugin architecture (Phase C4), AlphaFold-3 integration (Phase C3).

---

## 6 — Technology decisions Said hasn't made yet

These are open architectural questions that affect v0.2+. Listed here so Said + Peleg + Alex can decide together when each comes due.

| Question | Options | Recommendation |
|---|---|---|
| **MCP transport** | stdio (local Claude Desktop) / SSE (web) / both | **Both**, via FastMCP wrapping current FastAPI. |
| **Vector store** | pgvector (Postgres extension) / Chroma (Python OSS) / Weaviate / Pinecone (managed) | **pgvector** if PVL adopts Postgres anyway; **Chroma** for now (zero infra). |
| **Auth model** | open / API key / OAuth via ORCID | **Open for v0.x**; **API key** when Phase G MCP exposes write endpoints. |
| **Multi-tenancy** | single-instance / per-lab subdomains / SaaS | **Single instance** until adoption warrants. |
| **Backend language for new services** | extend FastAPI Python / introduce Rust (Axum) for hot paths | **Stick with Python**; AI/data-science ecosystem dominates. Only introduce Rust if performance benchmarks force it. |
| **Hosting evolution** | DESY VPS (current) → Cloudflare Pages + Render (frontend split) → Kubernetes (DESY confirmed) | **K8s when DESY assigns namespace** (Phase C2 unblocks). |
| **Agent framework** | LangGraph / LlamaIndex / Agency Swarm / build-from-scratch | **LangGraph** (Anthropic-aligned, mature). |

---

## 7 — Documentation philosophy

Said's directive: *"document the technical stuff, not the paper publishing".*

PVL has THREE doc audiences, each with their own files:

### 7.1 — User-facing (in-app + README)
- `README.md`: hero, quick start, self-host, license. ⏳ polish this round.
- In-app `Help.tsx` page: scientific definitions (Peleg-verbatim), threshold meanings, classification logic.
- In-app tooltip system (`metricRegistry`): every metric self-explains.

### 7.2 — Contributor-facing (`docs/active/`)
- `ACTIVE_CONTEXT.md` — entrypoints, data flow, key modules
- `CONTRACTS.md` — API endpoints, request/response shapes
- `DEVELOPER_REFERENCE.md` — pipeline internals, debugging
- `TESTING_GUIDE.md` — test patterns
- `DECISIONS.md` (NEW, this round) — ADR-001 through ADR-010 from §3
- `TECH_PLATFORM_VISION.md` (this file)
- `PUSH_READINESS.md` — manual guides for Said
- `SENTRY_RUNBOOK.md` — observability ops

### 7.3 — Strategic (project-history)
- `ROADMAP.md` — the full phase plan
- `KNOWN_ISSUES.md` — bug log
- `ALEX_BACKLOG.md` — Alex feedback history
- `PELEG_FEEDBACK_INSTRUCTIONS.md` — Peleg PDF extraction
- `WAVE_C_EMAIL_DRAFT.md` — communication record

**No paper-writing docs in this repo.** That's Peleg's job; her output (the paper) cites PVL via the Zenodo DOI (auto-generated on release) and the bio.tools listing.

---

## 8 — What Said does this month (the platform-vision-focused queue)

In priority order, with time estimates:

1. **Wire current state into a clean push** (~1 day, mostly T1/T3 finishing this week's batches).
2. **Set up Dependabot + Sentry alerts** (Guides E + F, ~50 min total).
3. **Polish README.md + write DECISIONS.md** (T1 produces, Said reviews, ~30 min review).
4. **Cut v0.1.0 release + Zenodo DOI auto-archive** (Guides A + B, ~15 min). Peleg uses the DOI in her paper; that's her work, not Said's.
5. **bio.tools registration** (Guide C, ~30 min). Said-led because it's a platform decision (categories, formats, target audience), not a paper.
6. **Set up CodeRabbit or Greptile in CI** (~30 min) — AI code review during MIT semesters. Platform investment.
7. **Start Phase I (multi-predictor) research spike** (summer 2026) — biggest v0.2 deliverable. Said does this when bandwidth allows; the platform is stable enough to absorb feature additions.

---

## 9 — Living document protocol

This file gets updated whenever:
- An ADR is added to §3.
- A technology in §2 transitions between adopt / plan / parked.
- A new architectural question opens in §6.

Said reviews quarterly during MIT semesters (15 min calendar block).
