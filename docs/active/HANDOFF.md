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

**Commit identity**: all commits must show `Said Azaizah <az.said2007@gmail.com>` as author. Never add "Claude", "AI", "assistant", or "Anthropic" anywhere in commits, code, comments, or docs.

---

## 9. People

| Role | Person | Domain |
|------|--------|--------|
| Lead developer | Said Azaizah (Technion + DESY) | Architecture, build, deploy. Code peer. |
| Scientific algorithms | Dr. Peleg Ragonis-Bachar (Technion) | TANGO config, FF-Helix definition, SSW axioms, paper. |
| Scientific advisor | Dr. Aleksandr Golubev (DESY CSSB) | DESY infra, scientific direction. Not a developer. |

When in doubt about a scientific decision: ask Peleg. When in doubt about infrastructure: ask Alex. When in doubt about the code: ask Said.

---

## 10. The current state of the work

**Active wave**: closing out v0.3.0 follow-ups from Peleg's 2026-06-08 + 2026-06-15 review decks. See `docs/active/PELEG_NOTES_2026_06_18.md` for the triaged item list and `docs/active/MEETING_2026_06_18.md` for the strategic discussion.

**Top priorities**:
1. **22× perf gap** — local 1 min vs prod 22 min for 1k peptides. Profile pending. (M1)
2. **Pre-computed datasets** — Peleg-118 / gold / Uperin. (M2)
3. **Progressive results loading** — SSE-based streaming for big batches. (M3 + M4)
4. **P0 scientific corrections** — delete TANGO threshold tunable, rename FF-Helix label, switch example sequence. (A1, A3, A4)

**Blocked**:
- DESY VM migration — waiting on Alex's SSH access fix.

**The paper**:
- Peleg is drafting now.
- Hand her `PAPER_METHODS_REFERENCE.md` as the source-of-truth Methods section.

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

**Welcome to PVL. The bar is correctness > usability > features. In that order.**
