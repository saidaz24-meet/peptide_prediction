# Handbook build status

> Living status board for the `docs/handbook/` build. Updated at the end of every wave. One commit per wave: `docs(handbook): wave N — <summary>`.

**PVL version covered:** v0.3.0 (main HEAD as of the branch this work sits on, `wave-2.8/peleg-pdf-followups`).
**Last updated:** end of Wave 2 (2026-06-29).

---

## Page status

Legend: ✅ written · 🟡 stub/partial · ⬜ not started

### `humans/`
| Page | Status | Notes |
|------|--------|-------|
| 00_what_is_pvl.md | ✅ | 5-minute orientation, no jargon. |
| 01_first_run.md | ✅ | 12-min walkthrough — clone, backend venv, frontend dev server, smoke test, troubleshooting. |
| 02_the_science.md | ⬜ | TANGO/S4PRED/FF-Helix/SSW/FF-SSW with primary citations. Source: PAPER_METHODS_REFERENCE, DECISIONS ADR-001/003, biochem_calculation.py, auxiliary.py. |
| 03_the_pipeline.md | ✅ | 11 ordered stages from HTTP parse → Pydantic response. Includes deterministic guarantee + precompute path + null-state semantics. |
| 04_the_ui_walkthrough.md | ⬜ | Every page. Source: App.tsx routes, ui/src/pages/, PELEG_NOTES (page-by-page). |
| 05_use_cases.md | ⬜ | Real research stories. Source: README use cases, MEETING, project_paper_case_studies memory. |
| 06_deploying.md | ⬜ | VPS / DESY VM / K8s. Source: DEPLOYMENT, docker/. |
| 07_extending.md | ⬜ | Add predictor/chart/dataset. Source: ADR-008/015, molstarOverlays.ts, ROADMAP Phase I. |
| 08_troubleshooting.md | ⬜ | Common failures. Source: KNOWN_ISSUES, DEVELOPER_REFERENCE §8, DEPLOYMENT troubleshooting. |
| 09_glossary.md | ⬜ | Every term/acronym. Build incrementally as other pages are written. |
| 10_credits_and_license.md | ⬜ | Authors, MIT, citations. Source: README authors, CITATION.cff, feedback_credits memories. |

### `agents/`
| Page | Status | Notes |
|------|--------|-------|
| 00_read_me_first.md | ✅ | Ground rules + commit identity + before-you-touch matrix. |
| 01_repo_map.md | ✅ | Every directory + key file with 🔥/🛡️/🧊 heat markers. Backend (90+ entries), frontend (50+), docs/three-bucket map, scripts, .github, conventions. |
| 02_contracts_and_invariants.md | ⬜ | Protected surfaces + axioms. Source: CONTRACTS, api_models.py, ISSUE-032. |
| 03_doing_a_safe_change.md | ⬜ | Plan→test→diff→verify. Source: CLAUDE.md TDD, HANDOFF §7–8. |
| 04_when_to_ask_humans.md | ⬜ | Escalation list. Source: feedback memories, safety rules. |
| 05_existing_tooling.md | ⬜ | Skills/MCPs/hooks. Source: .claude/, ADR-018/019, MCP_RUNBOOK. |
| 06_failure_modes.md | ⬜ | Red CI/lint/CodeRabbit recovery. Source: TESTING_GUIDE, ADR-019. |
| 07_artifacts_index.md | ⬜ | Binaries, precomputed JSON, example CSVs. Source: DEPLOYMENT §3, backend/data/, tools/. |

### `research/`
| Page | Status | Notes |
|------|--------|-------|
| 01_landscape.md | ✅ | 14+ tools, citations verified, feature matrix, CORDAX flagged as closest peer. |
| 02_validation_evidence.md | ⬜ | Peleg-118 recall/precision, Staph 2023 benchmark. Source: backend/scripts/rerun_validation_*, reference_datasets, ADR-014. NEEDS DATA (see below). |
| 03_open_questions.md | ⬜ | OQ1–OQ8 + scientific unresolved. Source: PELEG_NOTES §OQ, project_peleg_drive_review memory. |
| 04_publication_path.md | ⬜ | Zenodo→bio.tools→JOSS. Source: A4_BIO_TOOLS_SUBMISSION, A5_ZENODO_RELEASE, paper/paper.md. |

---

## Wave log

### Wave 2 — done (2026-06-29)
- humans/01_first_run.md — clone → UI in 12 min, with smoke test + troubleshooting matrix.
- humans/03_the_pipeline.md — end-to-end 11-stage walkthrough including provider cache split, TANGO + S4PRED, normalize, Pydantic envelope. Locks the deterministic-output invariant.
- agents/01_repo_map.md — every dir + ~140 key files with 🔥/🛡️/🧊 heat markers, edit conventions, "how to use this map" footer.

### Wave 1 — done
- Read all 20 ground-truth sources + walked backend (`api/main.py`, routes/, services/) and frontend (`App.tsx`, pages/) entrypoints.
- Created `README.md` (the three-doors entry map), this `_status.md`, `humans/00_what_is_pvl.md`, `agents/00_read_me_first.md`, `research/01_landscape.md`.
- Verified competitive-tool citations against publisher pages via web research.

---

## Open research questions / things still needed

These block specific pages and should be resolved (mostly by asking Said) before those pages can be written accurately:

1. **Validation numbers (blocks `research/02`).** Need the actual recall/precision output of `backend/scripts/rerun_validation_*` on Peleg-118 and the Staphylococcus 2023 set. Are these committed anywhere, or must they be re-run? The B19 Welch's-t-test path is also noted as needing `make precompute-datasets` on the VM (HANDOFF Task #123).
2. **S4PRED citation discrepancy.** README acknowledgements cite "Moffat et al. 2022, *Bioinformatics* 38:4647–4653"; `PAPER_METHODS_REFERENCE.md` cites "Moffat & Jones 2021, *Bioinformatics* 37:3744–3751". The handbook landscape page used the 2021 single-sequence S4PRED paper (btab491). Confirm the canonical citation before paper submission.
3. **Live screenshots.** The human UI walkthrough (`humans/04`) wants one image per page. PELEG_NOTES H9 says hero screenshots must be retaken in a clean Chrome profile. Do we have a clean screenshot set, or should the handbook use ASCII/mermaid diagrams for Wave-1 durability and add images later?
4. **OQ1–OQ8 current state.** `research/03` needs to know which of Peleg's open questions are still open vs. resolved at the next sync (e.g. OQ8 — "AlphaFold-predicted structure" title: keep or delete? — has conflicting records).
5. **FF-Helix % algorithm provenance.** `DEVELOPER_REFERENCE.md` describes FF-Helix % as a Chou-Fasman sliding window; `PAPER_METHODS_REFERENCE.md` frames FF-Helix via Hamodrakas 2007 + Fauchère-Pliska µH gating. `02_the_science.md` must reconcile "FF-Helix %" (the local propensity number) vs. "FF-Helix flag" (the classification) precisely — they are different things and the docs use overlapping language.

---

## Proposed next wave

**Wave 2 (recommended):** the human on-ramp — `humans/01_first_run.md`, `humans/02_the_science.md`, and start `humans/09_glossary.md` (seeded from terms introduced in 00/01/02). The science page is the highest-value, highest-risk page in the handbook and deserves a full wave; it depends on resolving research questions #2 and #5 above.

Alternative if Said prefers the agent track first: `agents/01_repo_map.md` + `agents/02_contracts_and_invariants.md` (both fully derivable from sources already read — no human input needed).
