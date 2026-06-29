# Repo Map — Every Directory, One Line

> Audience: an AI agent (Claude / Cowork / Opus) about to make a change. Hot files are flagged with 🔥 — touch carefully. Cold files are flagged with 🧊 — safe to assume nobody read them recently. Protected files are 🛡️ — do not modify without explicit approval.

## Contents

- [Top-level](#top-level)
- [`backend/` — leaf-level map](#backend--leaf-level-map)
- [`ui/src/` — leaf-level map](#uisrc--leaf-level-map)
- [`docs/` — the three buckets](#docs--the-three-buckets)
- [`scripts/`](#scripts)
- [`.github/`](#github)
- [Conventions to know](#conventions-to-know)
- [How to use this map](#how-to-use-this-map)

## Top-level

| Path | What | Heat |
|---|---|---|
| `backend/` | FastAPI + Pydantic + pandas service | 🔥 |
| `ui/` | React + Vite + Tailwind + Zustand frontend | 🔥 |
| `docs/` | Three-bucket doc system (active / internal / archive / handbook) | 🔥 |
| `scripts/` | Bash + Python ops scripts (deploy, precompute, bootstrap, diagnostics) | 🔥 |
| `tools/` | Volume-mounted predictor assets (TANGO binary, S4PRED weights) | 🛡️ |
| `paper/` | JOSS paper draft (`paper.md` + `paper.bib`) | 🧊 |
| `mcp_server/` | MCP-protocol bridge so AI assistants can drive PVL | 🧊 |
| `pvl-cli/` | Planned pip-installable CLI (stub) | 🧊 |
| `_external/` | Vendored copies of Peleg's repo + the source paper PDFs | 🛡️ DO NOT REDISTRIBUTE |
| `.github/` | Issue templates / PR template / CI / CodeQL / Dependabot | 🔥 |
| `docker/` | Compose files (`docker-compose.base.yml`, `docker-compose.prod.yml`, `docker-compose.caddy.yml`) + Dockerfiles | 🔥 |
| `CLAUDE.md` | Project-level instructions for Claude (architectural principles, doc-access rules) | 🛡️ |
| `CITATION.cff` | Authors + version + Zenodo DOI metadata | 🔥 |
| `README.md` | Public face — Stripe-grade install guide | 🔥 |

## `backend/` — leaf-level map

| Path | What | Notes |
|---|---|---|
| `api/main.py` | FastAPI app instantiation + Sentry + perf init + router registration | 🛡️ Edit only via additive router include |
| `api/routes/` | One file per route group: `predict.py`, `upload.py`, `uniprot.py`, `cohorts.py`, `precomputed.py`, `peptides.py`, `jobs.py`, `feedback.py`, `health.py`, `example.py`, `providers.py` | 🔥 |
| `schemas/api_models.py` | **THE** API contract — every request/response Pydantic model | 🛡️ Hook blocks edits without user OK |
| `schemas/peptide.py` | Internal `PeptideRow` shape (separate from `api_models`) | 🔥 |
| `schemas/uniprot_query.py` | UniProt query parsing schemas | 🔥 |
| `services/upload_service.py` | The canonical pipeline orchestrator. `process_upload_dataframe` is the one function every route eventually calls | 🔥 |
| `services/normalize.py` | Column canonicalization + UI-row normalization. The `null`-only invariant lives here | 🔥 |
| `services/dataframe_utils.py` | FF-Helix + FF-SSW classifier rules, column ensure helpers | 🔥 |
| `services/predict_service.py` | Single-peptide convenience wrapper around `process_upload_dataframe` | 🔥 |
| `services/uniprot_execute_service.py` | UniProt query → fetch peptides → run pipeline | 🔥 |
| `services/uniprot_service.py` | UniProt query parser + cache | 🔥 |
| `services/provider_cache.py` | DuckDB-backed predictor result cache (split / merge / write) | 🔥 |
| `services/provider_state.py` | Per-provider status tracking (AVAILABLE / OFF / UNAVAILABLE) | 🔥 |
| `services/cohort_stats.py` | Welch's t-test for B19 cohort compare | 🔥 |
| `services/example_service.py` | `/api/example` static demo loader (Staphylococcus xlsx with precomputed columns) | 🧊 |
| `services/export.py` | Tabular export — provenance header + format dispatch (CSV / TSV / XLSX) | 🔥 |
| `services/thresholds.py` | Threshold preset resolution (original / strict / lenient / custom) | 🔥 |
| `services/logger.py` | Structured logger that emits to stdout for Docker log collection + Sentry breadcrumbs | 🔥 |
| `services/trace_helpers.py` | Trace ID generation + propagation | 🔥 |
| `tango.py` | [TANGO](../humans/02_the_science.md#2-tango) binary subprocess + output parser + budget gate | 🛡️ |
| `s4pred.py` | S4PRED ensemble loader + batched forward + output parser | 🛡️ |
| `auxiliary.py` | FF-Helix scoring + sequence sanitization (non-standard AA → standard with note) | 🔥 |
| `biochem_calculation.py` | Charge / Hydrophobicity / µH — deterministic, reused by tests + paper | 🛡️ |
| `consensus.py` | Per-residue consensus calculation (4-class pipeline output) | 🔥 |
| `config.py` | `settings` object — env-driven, single source of truth for tunables | 🔥 |
| `_perf_init.py` | Pins OMP/MKL/OpenBLAS/VECLIB thread counts BEFORE torch loads. Must import first | 🛡️ Order matters |
| `_app_preload.py` | Pre-loads S4PRED weights at gunicorn import (`--preload`) | 🔥 |
| `calculations/biochem.py` | Helper module wrapped by `biochem_calculation.py` | 🔥 |
| `Tango/bin/tango` | macOS dev TANGO binary (checked into repo so `make smoke-tango` works on a fresh clone) | 🛡️ |
| `tools/s4pred/` | S4PRED Python wrapper module | 🛡️ |
| `data/reference_datasets/` | Curated input JSON for `peleg_118` + bundled XLSX for `gold_standard` | 🔥 |
| `data/precomputed/` | Output JSON artifacts from the precompute pipeline (gitignored — regenerated per host) | 🧊 |
| `scripts/precompute_dataset.py` | The script that produces `data/precomputed/*.json` | 🔥 |
| `scripts/diagnose_tango.py` | Walks every TANGO gate, reports where rows drop. Use after any precompute regression | 🔥 |
| `tests/` | 646 pytest cases — deterministic, no network. CI gate | 🔥 |
| `celery_app.py` + `tasks.py` | Celery worker (wired but currently runs sync in prod) | 🧊 |

## `ui/src/` — leaf-level map

| Path | What | Notes |
|---|---|---|
| `pages/` | Route components — one file per route. `QuickAnalyze.tsx`, `Upload.tsx`, `Results.tsx`, `PeptideDetail.tsx`, `Compare.tsx`, `About.tsx`, `Help.tsx` | 🔥 |
| `pages/Results.tsx` | The big dashboard. KPI strip + Venn + threshold tuner + ranked shortlist + correlation matrix + sliding-window profile + peptide table | 🔥 |
| `pages/PeptideDetail.tsx` | Deep-dive per peptide — sequence track + biochem comparison + S4PRED chart + aggregation heatmap + helical wheel + Mol* 3D viewer | 🔥 |
| `pages/Compare.tsx` | A vs B database comparison + reference-dataset split button (Peleg-118 / Gold-standard) | 🔥 |
| `components/SequenceTrack.tsx` | Colored sequence strip with hover tooltip (Q7/Q8) | 🔥 |
| `components/PeptideViewer.tsx` | Shared per-peptide layout used by Quick Analyze + Peptide Detail | 🔥 |
| `components/PerToolResultChips.tsx` | The Q9 per-tool color-coded chip strip | 🔥 |
| `components/QuickKpiStrip.tsx` | The Q6 4-class KPI strip with reason text | 🔥 |
| `components/AggregationHeatmap.tsx` | TANGO + S4PRED per-residue overlay (the magenta agg bars + the toggle row) | 🔥 |
| `components/S4PredChart.tsx` | P(H)/P(E)/P(C) per-residue curves | 🔥 |
| `components/HelicalWheel.tsx` | Schiffer-Edmundson wheel + µH arrow | 🔥 |
| `components/AlphaFoldViewer.tsx` | Mol* iframe or stub renderer for 3D structure | 🔥 |
| `components/Mol3DViewer.tsx` | The B16 Mol* overlay component (Phase 1 — programmatic plugin in `MOL3D_OVERLAY_SPEC.md`) | 🔥 |
| `components/BiochemComparison.tsx` | Database tabs (Q11) + percentile bars + radar | 🔥 |
| `components/PeptideTable.tsx` | The big peptide table with sort + filter + column visibility | 🔥 |
| `components/ThresholdTuner.tsx` | The threshold tuner panel (B14 preset chips) | 🔥 |
| `components/ranking/` | Smart ranking weights + composite score | 🔥 |
| `components/Venn4.tsx` | The 4-class Venn (Helix / FF-Helix / SSW / FF-SSW) | 🔥 |
| `components/correlation/` | The correlation matrix (B18) | 🔥 |
| `components/charts/WindowProfileChart.tsx` | The sliding-window profile (B17 — SSW band) | 🔥 |
| `components/UniProtBatchPreview.tsx` | The M3 accession-list preview table | 🔥 |
| `components/AnalysisProgress.tsx` | The B8 progress bar with ETA | 🔥 |
| `components/ui/` | shadcn-generated primitives (`button.tsx`, `card.tsx`, `dropdown-menu.tsx`, etc.) | 🛡️ Don't edit — generated |
| `stores/datasetStore.ts` | Zustand: peptides + stats + filters + table state | 🔥 |
| `stores/thresholdStore.ts` | Threshold presets + active values + re-classification | 🔥 |
| `stores/chartSelectionStore.ts` | Chart filter state (which Venn region is selected, etc.) | 🔥 |
| `stores/jobStore.ts` | Async job tracker (Celery hooks + sync job fallback) | 🔥 |
| `stores/demoStore.ts` | First-visit demo dataset state | 🔥 |
| `lib/api.ts` | `fetch` wrappers with `ApiError` class. `uploadCSV`, `predictOne`, `executeUniProtQuery`, `loadPrecomputedDataset` | 🔥 |
| `lib/peptideMapper.ts` | API → frontend `Peptide` type mapping | 🛡️ |
| `lib/sswColor.ts` | Single source of truth for SSW magenta (`#E040FB`) | 🛡️ |
| `lib/molstarOverlays.ts` | Overlay descriptor builder for Mol* (forward-compatible for Phase I multi-predictor) | 🔥 |
| `lib/molstarSswOverpaint.ts` | B16 Mol* SSW overpaint helper (Phase 1 stub) | 🔥 |
| `lib/report.ts` | Shortlist PDF generator | 🔥 |
| `lib/peptideReport.ts` | Per-peptide PDF report (panel architecture) | 🔥 |
| `lib/peptideHtmlReport.ts` | Q15 self-contained HTML report | 🔥 |
| `lib/figurePack.ts` + `lib/figurePackPanels/` | Publication-ready figure pack (ZIP of SVGs + methods) | 🔥 |
| `lib/exportProvenance.ts` | The 4-line `# Method = …` block | 🔥 |
| `lib/referenceDistributions.ts` | Reference dataset metadata + comparison configs | 🔥 |
| `lib/chartConfig.ts` | Chart color tokens + legend formatters | 🔥 |
| `lib/csvExport.ts` | Frontend CSV/TSV/XLSX writers | 🔥 |
| `lib/permalink.ts` | Reproducibility-as-permalink encoding | 🔥 |
| `lib/uuid.ts` | Safe UUID v4 (Safari + HTTP fallback) — see ISSUE-027 | 🔥 |
| `lib/uniprot.ts` + `lib/uniprotMode.ts` | UniProt query + mode helpers | 🔥 |
| `types/peptide.ts` | Canonical frontend `Peptide` type. Mirror of `PeptideRow` from `api_models.py` | 🛡️ |
| `types/api.ts` | `RowsResponse`, `Meta`, `PredictResponse` mirrors | 🛡️ |
| `types/metrics.ts` | Smart Ranking metric definitions | 🔥 |
| `hooks/useDemoMode.ts` | First-visit auto-load orchestrator | 🔥 |
| `hooks/use-nav-guard.ts` | Browser nav guard for unsaved-changes warnings (A3) | 🔥 |

## `docs/` — the three buckets

| Path | What | Heat |
|---|---|---|
| `docs/active/` | Publishable architecture + scientific reference. ALWAYS readable | 🔥 |
| `docs/active/HANDOFF.md` | Single-page on-ramp for a new dev | 🔥 |
| `docs/active/BACKLOG.md` | The canonical Tier 0 → Tier 4 backlog | 🔥 |
| `docs/active/ARCHITECTURE.md` | The deep technical reference (renamed from DEVELOPER_REFERENCE) | 🔥 |
| `docs/active/CONTRACTS.md` | API contract spec | 🛡️ |
| `docs/active/DECISIONS.md` | ADR log | 🔥 |
| `docs/active/KNOWN_ISSUES.md` | Open bugs + limitations | 🔥 |
| `docs/active/PAPER_METHODS_REFERENCE.md` | Methods section source for the JOSS paper | 🔥 |
| `docs/active/PUBLICATION_PATH.md` | Zenodo → bio.tools → JOSS workflow | 🔥 |
| `docs/active/PRODUCTION_LOCKDOWN.md` | Security + hardening checklist | 🔥 |
| `docs/active/HANDOVER_CHECKLIST.md` | Said's tick-list to hand the project over | 🔥 |
| `docs/active/EXPORT_REDESIGN_BRIEF.md` | 4-tier export upgrade plan for the next dev | 🔥 |
| `docs/active/GITLAB_MIRROR.md` | Mirror runbook for the day DESY demands it | 🔥 |
| `docs/active/FINAL_REPORT_2026_06_29.md` | State-of-the-project closing summary | 🔥 |
| `docs/active/MOL3D_OVERLAY_SPEC.md` | Mol* B16 overlay spec (Phase 1 + Phase 2) | 🔥 |
| `docs/active/UNIPROT_ENRICHMENT_SPEC.md` | UniProt integration spec | 🔥 |
| `docs/active/VECTOR_SEARCH_SPEC.md` | G2 RAG + LanceDB architecture | 🔥 |
| `docs/active/DEPLOYMENT.md` | Hetzner + DESY deploy + Kerberos access | 🔥 |
| `docs/active/DESIGN_SYSTEM.md` | Tailwind + shadcn conventions | 🔥 |
| `docs/active/ECOSYSTEM_GUIDE.md` | 5-surface reference (web / MCP / CLI / pkg / docker) | 🔥 |
| `docs/active/MCP_RUNBOOK.md` + `MCP_CLIENT_GUIDES.md` | MCP server + per-client install | 🔥 |
| `docs/active/SENTRY_RUNBOOK.md` | Observability runbook | 🔥 |
| `docs/active/SPECIALS.md` | PVL calculations reference | 🔥 |
| `docs/active/ROADMAP.md` | Strategic position + phase plan (older — see BACKLOG for current truth) | 🧊 |
| `docs/active/TESTING_GUIDE.md` | Test gates + commands | 🔥 |
| `docs/active/SESSION_LOG.md` | Working notes (overwritten frequently) | 🧊 |
| `docs/active/RESEARCH_BRIEFS/` | Scientific brief artifacts | 🧊 |
| `docs/active/RESPONSES/` | Peleg / Alex response log | 🧊 |
| `docs/active/cowork-dispatches/` | Active Cowork-AI dispatch (V11 only — older are archived) | 🔥 |
| `docs/internal/` | Process docs — ask before reading | 🧊 |
| `docs/internal/EMAIL_PELEG_FINAL.md` + `EMAIL_ALEX_FINAL.md` | Paste-ready handoff emails | 🔥 |
| `docs/internal/OPUS_DOCS_TERMINAL_PROMPT.md` | The prompt for this very handbook generation | 🔥 |
| `docs/archive/` | Frozen historical artifacts. READ ONLY for the why-trail | 🧊 |
| `docs/handbook/` | THIS handbook — humans / agents / research subtrees | 🔥 |

## `scripts/`

| Path | What |
|---|---|
| `desy_vm_bootstrap.sh` | Idempotent DESY VM setup — Docker + clone + S4PRED weights + build + start |
| `prod_redeploy.sh` | Hetzner full redeploy (rebuild all images + restart all containers) |
| `desy_perf_redeploy.sh` | Performance instrumentation side-car redeploy |
| `open_peleg_issues.sh` | Interactive scaffolding for the GitHub OQ issues |
| `precompute_dataset.py` | Generate `data/precomputed/*.json` for a dataset id |
| `diagnose_tango.py` | TANGO gate diagnostic (used to root-cause ISSUE-034) |
| `publish_v0_3_0.sh` | Older release script (kept for the why-trail; new releases use `gh release create`) |

## `.github/`

| Path | What |
|---|---|
| `workflows/ci.yml` | Backend pytest + frontend vitest + Docker build + Detect Changes |
| `workflows/codeql.yml` | Python + TypeScript static analysis, weekly cron + per-PR |
| `workflows/deploy.yml` | Host-agnostic deploy workflow (currently parameterized for Hetzner) |
| `workflows/docker-publish.yml` | Image publish to GHCR |
| `workflows/release.yml` | Release tag handler |
| `ISSUE_TEMPLATE/` | bug / feature / scientific_question templates + config |
| `pull_request_template.md` | Invariants checklist + scientific impact + test plan |
| `dependabot.yml` | Weekly dep update PRs |

## Conventions to know

- **All Python column names use spaces**: `"SSW prediction"`, not `"ssw_prediction"`.
- **All Python null = `None`**: never `-1`, `"N/A"`, empty string. Exception: flag columns use `-1` for "not assigned".
- **All TypeScript numeric fallbacks use `??`**: never `||` (it treats `0` as falsy).
- **All commits show**: `Said Azaizah <said.azaizah@cssb-hamburg.de>`. Never add "Claude / AI / assistant / Anthropic" anywhere.
- **All routes follow REST + JSON**: no GraphQL, no streaming (yet — SSE is a Tier-1 backlog item).
- **All state is Zustand on the frontend**: no Redux, no Context API for global state.

## How to use this map

When you're about to change a thing:
1. Find it here. Note its heat.
2. 🛡️ → ask the user first.
3. 🔥 → read the file end-to-end before editing.
4. 🧊 → safe to edit but verify it's still wired (sometimes it isn't).

When you're learning the repo:
1. Read this file.
2. Pick the lightest 🔥 file in your area and read it end-to-end.
3. Then pick a 🛡️ file and read it — those tend to teach the most because they're the [contract surfaces](02_contracts_and_invariants.md).
