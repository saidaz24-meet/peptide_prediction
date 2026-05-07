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

## ADR-009 — MCP server as the AI-platform front door (proposed)

**Date**: 2026-05-07 · **Status**: PROPOSED (target v0.2 summer 2026)
**Context**: Anthropic's MCP (Model Context Protocol) is being adopted by Claude Desktop, Cursor, Windsurf, Continue, and other major LLM clients. The protocol defines how an LLM agent calls external tools. PVL has a REST API that maps cleanly to MCP tools.
**Decision**: when AI agent integration matures (Phase G1), expose PVL as an MCP server, NOT as a custom chat UI built into the web app. Researchers already use Claude Desktop / Cursor / their own agents — they don't need another chatbot, they need a tool their existing agent can call.
**Reasoning**: standardize on the protocol the ecosystem converges on. Don't build a chatbot when the user already has one. Future-proof: MCP becoming the cross-vendor standard means PVL is automatically available to whichever LLM the researcher prefers.
**Implication**: every PVL REST endpoint should map cleanly to an MCP tool. Endpoints designed with this in mind from now on (clean inputs, structured outputs, no UI-specific fields). The MCP server lives in a new `mcp_server/` directory at repo root.
**Evidence**: roadmap Phase G1, `TECH_PLATFORM_VISION.md` §4.

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

## How to add a new ADR

When you (or a future contributor) make a load-bearing decision:

1. Add a new entry below the most recent one.
2. Format: `## ADR-NNN — Short title`, `**Date**`, `**Status**` (PROPOSED / ACCEPTED / DEPRECATED / SUPERSEDED), `**Authors**`.
3. Fill: Context, Decision, Reasoning, Implication, Evidence.
4. Keep entries tight: 5-10 lines each.
5. Cross-link from `ROADMAP.md` and `TECH_PLATFORM_VISION.md` where relevant.

ADRs may be SUPERSEDED but never deleted — the record matters for project history.
