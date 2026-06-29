# PVL — Single Canonical Backlog

> **Status as of 2026-06-29.** This is the ONE place to look for "what's left." All older backlogs (`ROADMAP.md` Phase A/B, scattered `HANDOFF.md §13` tiers, `KNOWN_ISSUES.md` open items, `PRODUCTION_LOCKDOWN.md` unchecked boxes) feed into this list.
>
> Each item links to the source doc that has the deep detail. The point of this file is to **rank everything in one place so the next developer can pick the top item and start**.

---

## Tier 0 — Ship-blocking (right now)

| ID | Item | Effort | Source |
|----|------|--------|--------|
| T0.1 | Cut v1.0.0 GitHub release + Zenodo DOI | 30 min | [PUBLICATION_PATH §1–3](PUBLICATION_PATH.md) |
| T0.2 | Resolve Alex ORCID (Peleg + Said already have theirs) | 1 email | [PUBLICATION_PATH §0](PUBLICATION_PATH.md) |
| T0.3 | DESY VM browser verification + Caddy DNS handover with Alex | 1 day | [DEPLOYMENT.md](DEPLOYMENT.md) + Alex |
| T0.4 | Resolve open Peleg scientific questions OQ1–OQ4 | Peleg's call | `docs/internal/EMAIL_PELEG_WAVE_2_8_CLOSEOUT.md` |

**Definition of done for Tier 0:** PVL is citable (DOI), reachable from a stable DESY URL with HTTPS, and the four open scientific questions have decisions recorded in `DECISIONS.md`.

---

## Tier 1 — High-impact upgrades (next 4 weeks)

### Science loop
- **Mol\* Phase 2.** The B16 SSW residue overpaint is a Phase-1 stub (`pvl:ssw-overpaint` CustomEvent dispatcher). Install molstar npm, uncomment the Phase-2 block in `ui/src/lib/molstarSswOverpaint.ts`, replace the iframe in `Mol3DViewer.tsx` with a programmatic `PluginContext`. Spec: [MOL3D_OVERLAY_SPEC.md](MOL3D_OVERLAY_SPEC.md). **Effort: 3 days.** Unblocks per-residue overlay for all four predictors.
- **B19 cohort statistics UI wiring.** Welch's t-test backend is built (`backend/api/routes/cohorts.py`) and the precomputed Peleg-118 + gold-standard JSONs now exist. Wire the Compare page chip → call `/api/cohorts/compare` → render p-value + Cliff's δ next to the existing percentile bars. **Effort: 1 day.**
- **Progressive results.** Batch upload blocks until full pipeline finishes. Add SSE streaming to `POST /api/predict/batch` so the table fills row-by-row. Frontend has the B8 sync-job + progress-bar plumbing; the missing piece is replacing the JSON response with an `EventSource` stream. **Effort: 2 days.**
- ~~**ISSUE-034 — precompute TANGO subprocess**~~ **✅ FIXED 2026-06-29 in `55ee37a`.** Was a provider-cache lock + budget-gate issue; precompute now bypasses both via opt-in flags. Both bundled artifacts have full TANGO curves.

### User-facing surfaces
- **Export redesign Tier 1.** Shortlist PDF — row-count dropdown (10 / 25 / 50 / all), provenance footer, legend appendix, composite-score sparkline per row. Full brief: [EXPORT_REDESIGN_BRIEF.md](EXPORT_REDESIGN_BRIEF.md). **Effort: 1 day.**
- **Doc consolidation finish.** `docs/active/` is down from 34 → 23 files this session. Remaining merge candidates: HOSTING_MAP → DEPLOYMENT, MCP_CLIENT_GUIDES → MCP_RUNBOOK (decided against — they're complementary). Target ~12 canonical docs. **Effort: 2 hours.**
- **ISSUE-028 — TANGO profile tooltip missing on Quick Analyze.** Wave B item. Other TANGO charts have it; Quick Analyze doesn't. **Effort: 2 hours.**

### Production hardening (PRODUCTION_LOCKDOWN unchecked boxes)
- **§2.1 Secrets audit.** Run `gh secret list` and verify `SENTRY_DSN`, `HETZNER_SSH_KEY`, `DESY_VM_KEY` are set. Grep history for accidental DSN/SECRET/TOKEN/API_KEY leaks. **Effort: 30 min.**
- **§2.2 CORS allowlist explicit.** Verify `backend/api/main.py` `allow_origins` is the FRONTEND_URL list, not `["*"]`. **Effort: 5 min verification.**
- **§2.2 Request size cap.** Cap `/api/upload` at 10 MB to prevent OOM via malicious CSV. **Effort: 30 min.**
- **§2.3 Server hardening (per host).** `ufw` allowing only 22/80/443, `PasswordAuthentication no` in sshd, `fail2ban` enabled, `unattended-upgrades` running, Caddy TLS verified. **Effort: 1 hour per host.**
- **§2.4 Repo hardening.** GitHub branch protection on `main` (1 review + CI green + no force-push), CodeQL default, Dependabot alerts on. **Effort: 30 min.**

---

## Tier 2 — Production scale (next 1–3 months)

- **DESY K8s migration.** Docker Compose → Kustomize → DESY K8s namespace. Manifest skeleton in `DEPLOYMENT.md §K8s plan`. Blocked on DESY IT providing namespace + Ingress quota.
- **Async job queue activation.** Celery + Redis are wired (`B1` shipped) but prod containers run sync. Route batches > N peptides to the queue, surface progress via existing `jobStore.ts`. **Effort: 2 days.** ~95% already done.
- **Observability — OpenTelemetry traces.** Sentry catches errors but no APM, no per-route latency histogram. Add OTLP spans around predict pipeline → Grafana dashboard. **Effort: 3 days.**
- **Auth layer.** Public deploy has zero auth. Add API-key middleware (FastAPI dependency) before bio.tools listing. Keep UI unauth — only gate the API. **Effort: 1 day.**
- **DuckDB result cache** (ROADMAP B6). Materialize predict results to a host-local DuckDB so repeated queries on the same sequences skip re-prediction. **Effort: 3 days.**

---

## Tier 3 — Research velocity (next 3–6 months)

- **Phase I multi-predictor.** Add Waltz → AGGRESCAN3D → PASTA 2.0 (in that order). PVL becomes the only tool that runs them side-by-side. Overlay contract in `ui/src/lib/molstarOverlays.ts` is already forward-compatible (`OverlayType` union). **Effort: 3 days per provider.**
- **G2 RAG + PubMed.** Per-peptide UniProt context + relevant abstracts in a side panel. Spec: [VECTOR_SEARCH_SPEC.md](VECTOR_SEARCH_SPEC.md). LanceDB + ESM-2 architecture chosen (ADR-016, ADR-017). Build as sidecar, don't pollute predict path. **Effort: 2 weeks.**
- **Phase G3 Scientific OpenClaw / agentic interpreter.** Long-term — AI assistant that explains classification decisions with literature evidence. Pre-req: G2.
- **`pvl-cli`** — pip-installable CLI for headless predict from notebooks. Stub exists. Promote to v0.1. **Effort: 3 days.**
- **`pvl-py`** — importable Python package wrapping the same backend service. Stub exists. **Effort: 2 days after `pvl-cli`.**

---

## Tier 4 — Quality + housekeeping (continuous)

- **Test coverage to 80%.** Today: 197 backend pytest functions + 672 frontend vitest. Coverage uneven — `services/normalize.py` < 60%, `lib/peptideMapper.ts` 0%. Block JOSS submission on this.
- **Export redesign Tiers 2–4.** Per-peptide PDF (Mol3D embed, full charts), HTML report (print stylesheet + comparison context), Figure pack (PNG/TIFF companions, captions). Detail: [EXPORT_REDESIGN_BRIEF.md](EXPORT_REDESIGN_BRIEF.md).
- **`server.py` deletion.** 15-line legacy shim with no real callers. Delete.
- **Doc consolidation — Opus 4.8 handbook.** A dedicated documentation terminal is producing `docs/handbook/{humans,agents,research}/` (Wave 1 already landed). When Wave 11 completes, it supersedes most of `docs/active/`. Brief: `docs/internal/OPUS_DOCS_TERMINAL_PROMPT.md`.
- **Code TODOs.** Two remaining inline:
  - `backend/scripts/rerun_validation_2026_06_07.py:251` — load Staphylococcus 2023 cohort into validation pipeline.
  - `ui/src/components/drilldown/DrillDown.tsx:292` — wire export handlers for SVG and CSV.

---

## Recently shipped (Wave 2.8 + 2.9 close-out, June 2026)

For context — everything below is **DONE** as of `main@HEAD`:

- 4-class KPI strip (Q6) · Per-tool result chips (Q9) · Pipeline residue colouring (Q7) · Hover tooltip (Q8) · S4PRED helix-% dedup (Q10) · Database-tabbed biochem comparison (Q11) · TANGO panel reorder (Q12) · HTML report export (Q15)
- Magenta token consolidation · Aggregation series → magenta (OQ3) · Per-plot toggles (OQ6) · Y-axis labels (F4) · "cohort" → "database" terminology (F1) · "Cutoff" suffix (F2) · Smart Ranking labels (F11) · Window-profile SSW band (B17)
- Mol\* SSW residue overpaint Phase-1 stub (B16) · Venn region counts + click-to-filter (B12+B13) · KPI hover-help (B11) · Threshold preset chips (B14) · Failed-row UI (B9) · Batch progress + ETA (B8) · Default sort (B10) · Correlation matrix scope (B18) · Welch's t-test backend (B19) · One-click fibril-118 + gold-standard split button (B20)
- Per-peptide HTML report (Q15) · Provenance header on tabular exports (B15+E4) · M3 UniProt accession-list upload mode
- PERF: gunicorn `--preload` lifespan (#119) · S4PRED batched forward (#117) · OMP/MKL thread fix (#105) · TANGO restored on prod image (#118) · stage timers wired (#115)
- Precompute endpoint + frontend fallback · `gold_standard` registry entry · slowapi rate limiter on `/api/predict/batch` + `/api/uniprot/execute`
- Stripped "Peleg" from user-facing strings (credits only) · CSV renamed `fibril_forming_peptides_118.csv`
- DESY VM bootstrap script + SSH access path verified · Pre-push ruff hook + CI watcher
- 11 dated docs archived · A4+A5 merged → PUBLICATION_PATH · DEVELOPER_REFERENCE renamed → ARCHITECTURE · PRODUCTION_LOCKDOWN.md written · EXPORT_REDESIGN_BRIEF.md written · this BACKLOG.md written
- 646/646 backend pytest · 672/672 frontend vitest · ruff + tsc clean

---

## How to use this list

1. **You are a new contributor.** Read `HANDOFF.md` first, then start at Tier 0 and walk down. The Tier 0 items unlock everything else — there's no point shipping a Tier 1 item before PVL has a DOI.
2. **You are Said deciding what to ship next week.** Walk down Tier 1, pick the item where you can credibly say "this would change a researcher's day for the better." Mol\* Phase 2, Tier-1 export redesign, and B19 UI wiring all qualify.
3. **You are an agent (Claude / Cowork / Opus).** Pick the highest-tier item with **(Effort: ≤ 1 day)** and that does NOT need new architectural decisions. Tier 1 has six of those. Ship one per session.

---

## When this file is updated

Update this file when:
- A Tier 0 item ships → move to Recently shipped, re-evaluate Tier 0
- A new high-priority item surfaces from Peleg / Alex / a paper review
- An item proves bigger than estimated → bump the tier
- A spec doc gets a major rewrite → re-link

Do NOT update for individual minor commits — `git log` is for that.
