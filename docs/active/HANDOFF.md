# PVL — Developer Handoff

> **Read this first.** If you're a new developer joining PVL, this file is your single-page on-ramp. Everything else linked from here is authoritative.

---

## 1. What PVL is, in 60 seconds

**Peptide Visual Lab (PVL)** is a web platform for peptide aggregation + secondary-structure-switching + fibril-formation prediction. It wraps three scientific tools (TANGO · S4PRED · FF-Helix classifier) behind one UI with publication-ready visualizations.

- **Stack**: React 18 + TypeScript + Vite (frontend) · Python 3.11 + FastAPI (backend) · TANGO Fortran binary + S4PRED PyTorch ensemble (predictors).
- **License**: MIT.
- **Repo**: https://github.com/saidaz24-meet/peptide_prediction
- **Production**: Hetzner VPS at the moment; DESY VM migration queued (see `memory/project_desy_vm_access.md`).

---

## 2. Day-1 setup

```bash
# Clone
git clone https://github.com/saidaz24-meet/peptide_prediction.git
cd peptide_prediction

# Backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
make smoke-tango           # verifies the TANGO binary works

# Frontend
cd ui
npm install
npm run dev                # http://localhost:5173

# Backend dev server (separate terminal)
cd ..
uvicorn backend.api.main:app --reload --port 8000

# Verify
curl http://localhost:8000/api/health
```

If `make smoke-tango` fails: the TANGO binary at `backend/external/tango/` needs to be built for your platform. See `docs/active/DEPLOYMENT.md` §"Building TANGO".

---

## 3. Where the code lives

| Layer | Path | Read first |
|-------|------|------------|
| Backend API routes | `backend/api/routes/` | `predict.py`, `peptide.py` |
| Prediction pipeline | `backend/tango.py`, `backend/s4pred.py`, `backend/auxiliary.py` | tango.py |
| Response normalization | `backend/services/normalize.py` | top half |
| **API contract (PROTECTED)** | `backend/schemas/api_models.py` | all of it |
| Frontend pages | `ui/src/pages/` | Results.tsx, PeptideDetail.tsx |
| Frontend state | `ui/src/stores/` | datasetStore.ts |
| API → frontend types | `ui/src/lib/peptideMapper.ts` | all of it |

**Golden rule**: do not change `backend/schemas/api_models.py` without explicit approval from Said + Peleg. It is the contract between backend and frontend; every change risks breaking determinism guarantees.

---

## 4. The four documents you must read

1. **`docs/active/ACTIVE_CONTEXT.md`** — architecture overview, data flow, entrypoints.
2. **`docs/active/PAPER_METHODS_REFERENCE.md`** — every algorithm, dataset, and dependency with versions and provenance. The paper's methods section will be built from this.
3. **`docs/active/CONTRACTS.md`** — API endpoint shapes; the "what's allowed to change" spec.
4. **`docs/active/DECISIONS.md`** — ADR log. Why FF-Helix is defined this way. Why PSIPRED was removed. Why µH uses Fauchère-Pliska.

After those: `KNOWN_ISSUES.md`, `TESTING_GUIDE.md`, `DEPLOYMENT.md`, `DEVELOPER_REFERENCE.md`.

---

## 5. The architectural principles you must internalize

These come from `CLAUDE.md` and are non-negotiable:

1. **Single sequence and batch MUST produce identical results.** Same peptide via Quick Analyze and via CSV upload must produce byte-identical numbers.
2. **`api_models.py` is the single source of truth.** Never change response schemas without explicit approval.
3. **JSON `null` only.** Never `-1`, `"N/A"`, or empty string as sentinel values.
4. **Every calculation is deterministic and reproducible.** Same input + same config → same output.
5. **Foundation before features.** Never ship new features on top of inconsistent pipelines. Fix correctness first.
6. **Always use plan mode** before multi-file changes.

---

## 6. The 4-class scientific model

This is the heart of PVL. Memorize it.

| Class    | Definition                                                | Subset of |
|----------|-----------------------------------------------------------|-----------|
| Helix    | S4PRED predicts ≥ `helix_pct_threshold` residues as H     | —         |
| FF-Helix | Helix AND Fauchère-Pliska µH ≥ `mu_h_threshold`           | Helix     |
| SSW      | ∃ residue where S4PRED=H AND TANGO predicts β-aggregation | —         |
| FF-SSW   | SSW AND µH ≥ `mu_h_threshold`                             | SSW       |

The two subset relations (**FF-Helix ⊆ Helix** and **FF-SSW ⊆ SSW**) are axioms enforced at the normalize layer. Breaking them breaks the Venn diagram and is a P0 bug.

---

## 7. The dev loop

```bash
make test           # pytest, deterministic, no network
make test-unit      # fast subset
make lint           # ruff
make typecheck      # mypy
make ci             # full pipeline
make fmt            # ruff format
make contract-check # backend↔UI contract sync

# Frontend
cd ui
npx vitest run      # all tests
npx tsc --noEmit    # type check
npm run build       # production build
```

**Test gates**:
- 538 backend pytest cases — all must pass.
- 611 frontend vitest cases — all must pass.
- `tsc --noEmit` clean.
- ruff clean.

If any of these are red on `main`, fix it before doing anything else.

---

## 8. The PR loop

1. Branch from `main`. Naming: `<type>/<short-slug>` (e.g. `fix/ssw-axiom`, `feat/progressive-results`).
2. **Always plan mode for multi-file changes.** Get sign-off before coding.
3. Write the failing test first (TDD — see `CLAUDE.md` §"TDD Workflow").
4. Implement.
5. `make ci` green before pushing.
6. PR template is at `.github/pull_request_template.md`. Fill in scientific impact + invariants checked.
7. CodeRabbit auto-reviews. Address comments. Merge after CI green + 1 approval.

**Commit identity**: all commits must show `Said Azaizah <said.azaizah@cssb-hamburg.de>` as author (DESY CSSB primary). Technion `saida@technion.ac.il` and MIT `az_said@mit.edu` are also acceptable for context-specific work. Never add "Claude", "AI", "assistant", or "Anthropic" anywhere in commits, code, comments, or docs.

---

## 9. People

| Role | Person | Domain |
|------|--------|--------|
| Lead developer | Said Azaizah (Technion + DESY) | Architecture, build, deploy. Code peer. |
| Scientific algorithms | Dr. Peleg Ragonis-Bachar (Technion) | TANGO config, FF-Helix definition, SSW axioms, paper. |
| Scientific advisor | Dr. Aleksandr Golubev (DESY CSSB) | DESY infra, scientific direction. Not a developer. |

When in doubt about a scientific decision: ask Peleg. When in doubt about infrastructure: ask Alex. When in doubt about the code: ask Said.

---

## 10. The current state of the work (last verified 2026-06-29)

**Active wave**: Wave 2.8 + Wave 2.9 follow-ups from Peleg's two PDF review decks (2026-06-08 + 2026-06-15) are shipped. Closing out the last polish items + wiring batch UniProt uploads.

**Shipped since 2026-06-18** (one-line each):
- Perf: S4PRED batched forward · OMP thread fix · gunicorn `--preload` lifespan · TANGO restore on prod image · stage timers.
- 4-class system: Q6 KPI strip · Q7 pipeline residue colouring · Q8 hover tooltip · Q9 per-tool chips · Q10 biochem block dedup · Q11 database-tabbed biochem comparison · Q12 TANGO panel rename · Q15 self-contained per-peptide HTML report.
- Tracks + plots: B10 sort defaults · B11 KPI hover-help · B12 Venn region counts · B13 Venn → table filter · B14 threshold preset chips · B16 Mol* SSW residue overpaint toggle · B17 SSW band in sliding-window profile · B18 cohort-only correlation scope · B19 Welch's t-test backend (see "Pending" below) · B20 Peleg-118 one-click compare chip.
- Exports: B15 + E4 provenance header on CSV/TSV/XLSX (4-line `# Method = …` prelude).
- Upload: B8 progress bar + ETA · B9 failed-row UI · B-CONTRACT Pydantic `extra="forbid"` · M3 UniProt accession-list paste flow.
- Backend: F1–F11 + OQ3/OQ6 terminology + colour fixes from Peleg's review · pre-push hook + CI watcher to silence email noise.
- Tests: 197 backend pytest functions · 620 frontend vitest calls · all deterministic, no network.

**Pending** (small, well-scoped — pick any and ship):
1. **Task #93** — open GitHub Issues from the triaged Peleg items. Script ready: `scripts/open_peleg_issues.sh`. Set up Project board column flow.
2. **Task #123 (M2 deployment)** — SSH into DESY VM and run `make precompute-datasets`. Drops `backend/data/precomputed/peleg_118.json` so the B19 Welch's t-test endpoint stops 404-ing. Needs Said's SSH (Alex's access blocker is now cleared per `memory/project_desy_vm_access.md`).
3. **Task #156** — perf regression diagnosis (Quick Analyze 1 peptide reported at 13s on dev). Curl timing test pending; likely cold-start.
4. **Browser verification of Wave 2.8/2.9** — single full pass through Quick Analyze · Compare · Peptide Detail · exports. Checklist lives in `docs/internal/STATUS.md`.

**Blocked**: none (DESY VM SSH now works).

**The paper**: Peleg is drafting. Methods section sourced from `PAPER_METHODS_REFERENCE.md`. The repo's `paper/paper.md` is a JOSS-format draft to submit after Peleg signs off on figures.

---

## 11. Don't touch without permission

- `backend/schemas/api_models.py`
- `backend/external/tango/` and `backend/external/s4pred/` (vendored predictors).
- `CITATION.cff` (changes ripple to Zenodo DOI).
- Anything under `_external/` (Peleg's repo + paper copy — do not redistribute).

---

## 12. Where to find help

- **All docs**: `docs/active/`.
- **Process docs (ask first)**: `docs/internal/`.
- **History**: `docs/archive/`.
- **MCP servers + AI tooling**: `docs/active/MCP_RUNBOOK.md`.
- **Sentry runbook**: `docs/active/SENTRY_RUNBOOK.md`.

---

## 13. Make it better — improvement backlog

Order is rough priority. None of these is blocking publication; all are real upgrades.

### Tier 1 — export surfaces (highest user-facing visibility)
- **Shortlist PDF + per-peptide reports + figure pack redesign.** Said flagged 2026-06-29 that the current shortlist PDF is "basic" and only emits 10 rows (the rank slider's default). Full brief at `docs/active/EXPORT_REDESIGN_BRIEF.md` — 4 tiers in priority order. Start with §3 Tier 1 (Shortlist PDF) — single-file edit at `ui/src/lib/report.ts`, row-count dropdown + provenance footer + legend appendix. ~1 day of work for the highest-visibility user win.

### Tier 1 — close the science loop
- **Mol* Phase 2.** The B16 SSW residue overpaint is wired as a Phase-1 stub that dispatches a `pvl:ssw-overpaint` CustomEvent. Install molstar npm, uncomment the Phase-2 block in `ui/src/lib/molstarSswOverpaint.ts`, replace the iframe in `Mol3DViewer.tsx` with a programmatic `PluginContext`. Spec: `docs/active/MOL3D_OVERLAY_SPEC.md`. Unblocks per-residue overlay for all four predictors, not just SSW.
- **B19 cohort statistics.** Backend Welch's t-test endpoint is built but requires precomputed cohort JSON under `backend/data/precomputed/`. Run `make precompute-datasets` on the VM (Task #123), then wire the "Compare current dataset vs Peleg-118" chip on `/compare` to surface p-values + Cliff's δ next to the existing percentile bars. Spec: `docs/active/CONTRACTS.md` §"Cohort statistics".
- **Progressive results.** Batch upload currently blocks until the whole pipeline is done. Add SSE streaming to `POST /api/predict/batch` so the table fills row-by-row. Frontend already has the sync-job + progress-bar plumbing (B8); the missing piece is replacing the JSON response with an `EventSource` stream from the backend.

### Tier 2 — make it production-grade
- **DESY K8s migration.** Currently on Hetzner CX33. DESY VM is bootstrapped (`scripts/desy_vm_bootstrap.sh`) and accessible. Path forward: Docker Compose → Kustomize → DESY K8s namespace. `docs/active/DEPLOYMENT.md` §"K8s plan" has the manifest skeleton. Needs a DNS record + TLS cert from DESY IT.
- **Async job queue at scale.** Celery + Redis is wired (B1) but the prod containers run sync only. Flip the worker on, route batches > N peptides to the queue, surface progress in the existing `jobStore.ts`. Already 95% done; just needs prod config + smoke test.
- **Observability.** Sentry is live (DSN in `docs/active/SENTRY_RUNBOOK.md`) but there is no APM, no structured logs, no per-route latency histogram. Add OpenTelemetry traces around the predict pipeline so the 22× perf gap that took two days to bisect is visible in one Grafana panel next time.
- **Auth + rate limiting.** Public deploy has zero auth. Researchers fine for now; before a public bio.tools listing, add a simple API-key middleware (FastAPI dependency) and an IP-based rate limiter on `/api/predict/batch`. Keep the UI unauth — only gate the API.

### Tier 3 — research velocity
- **Phase I multi-predictor.** PVL is locked to TANGO + S4PRED. The overlay contract in `ui/src/lib/molstarOverlays.ts` is already forward-compatible (`OverlayType` union); add Waltz, AGGRESCAN3D, or PASTA 2.0 as a provider behind the same shape and PVL becomes the only tool that runs them side-by-side. Each provider takes ~3 days of vendoring + wrapping. Order of likely value: Waltz → AGGRESCAN3D → PASTA.
- **G2 RAG + PubMed.** Long-running Phase G goal: feed per-peptide UniProt context + relevant abstracts into a side panel so researchers see "what's known about this protein" inline. `docs/active/VECTOR_SEARCH_SPEC.md` has the LanceDB + ESM-2 architecture. Build it as a sidecar service that the frontend hits — don't pollute the predict pipeline.
- **CLI / Python package.** `pvl-cli` exists as a stub. Promote it to a real installable so the headless predict pipeline is usable from notebooks: `pip install pvl-cli && pvl predict peptides.csv -o results.json`. Reuses the same FastAPI service code; no new science.

### Tier 4 — quality + housekeeping
- **Test coverage**: backend is 197 functions, frontend 620 — both deterministic. Coverage is uneven: `services/normalize.py` has < 60% line cov; `lib/peptideMapper.ts` has none. Target 80% on both before the JOSS submission.
- **`server.py` is a 15-line shim.** Delete it. It only exists for legacy import compat that no longer matters.
- **Doc consolidation.** `docs/active/` is 30+ files. Many are accurate but overlap (MASTER_DEV_DOC vs DEVELOPER_REFERENCE vs ACTIVE_CONTEXT). One pass to merge into 8–10 canonical docs would save every new developer half a day.
- **CITATION + Zenodo.** Packets are ready (`A4_BIO_TOOLS_SUBMISSION.md`, `A5_ZENODO_RELEASE.md`). Cut `v0.3.0` release tag → Zenodo auto-mints DOI → submit to bio.tools. 1 hour of work for permanent scientific citability.

When you ship anything from this list, delete the entry. The shorter this section gets, the better.

---

**Welcome to PVL. The bar is correctness > usability > features. In that order.**
