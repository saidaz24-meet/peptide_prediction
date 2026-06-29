# Handbook build status

> Living status board for the `docs/handbook/` build. Updated at the end of every wave. One commit per wave: `docs(handbook): wave N — <summary>`.

**PVL version covered:** v0.3.0 (main HEAD as of the branch this work sits on, `wave-2.8/peleg-pdf-followups`).
**Last updated:** Waves 3–10 complete (2026-06-29). Remaining: 09_glossary (in progress), cross-link sweep, Wave 11 polish.

---

## Page status

Legend: ✅ written · 🟡 stub/partial · ⬜ not started · 🔄 in progress

### `humans/`
| Page | Status | Notes |
|------|--------|-------|
| 00_what_is_pvl.md | ✅ | 5-minute orientation, no jargon. |
| 01_first_run.md | ✅ | 12-min walkthrough — clone, backend venv, frontend dev server, smoke test, troubleshooting. |
| 02_the_science.md | ✅ | 12 sections, 11 primary citations; resolves S4PRED cite; flags 5 code-vs-paper discrepancies (see below). |
| 03_the_pipeline.md | ✅ | 11 ordered stages from HTTP parse → Pydantic response. Deterministic guarantee + precompute path + null semantics. |
| 04_the_ui_walkthrough.md | ✅ | All 10 pages; route + sketch + two-elements + not-here + power-user. Honest on Phase-1 Mol* stub + real colour tokens. |
| 05_use_cases.md | ✅ | Five real-route narratives; Compare stats noted pending precompute deploy. |
| 06_deploying.md | ✅ | VPS / DESY-VM / K8s; every command quoted verbatim from a real repo file. |
| 07_extending.md | ✅ | Three verified walkthroughs (predictor, reference cohort, export) each with invariants-you-must-not-break. |
| 08_troubleshooting.md | ✅ | Nine symptoms, each grounded in a real KNOWN_ISSUES/config cause + see-also into agents/06. |
| 09_glossary.md | 🔄 | In progress — ~80 terms harvested from all written pages. |
| 10_credits_and_license.md | ✅ | Authors (CITATION.cff), MIT, dual-citation BibTeX, funding, tools-we-build-on. |

### `agents/`
| Page | Status | Notes |
|------|--------|-------|
| 00_read_me_first.md | ✅ | Ground rules + commit identity + before-you-touch matrix. |
| 01_repo_map.md | ✅ | Every dir + ~140 key files with 🔥/🛡️/🧊 heat markers, edit conventions. |
| 02_contracts_and_invariants.md | ✅ | Seven invariants; every enforcing test/hook verified to exist. |
| 03_doing_a_safe_change.md | ✅ | Paste-able 12-step TDD-to-CI playbook with real Makefile targets. |
| 04_when_to_ask_humans.md | ✅ | Escalation tree: 10 triggers → Said/Peleg/Alex. |
| 05_existing_tooling.md | ✅ | 10 skills, 6 hooks, 20 scripts, MCP (4/7 live), pvl-cli stub; stale ones flagged. |
| 06_failure_modes.md | ✅ | CI/hook/CodeRabbit/CodeQL red-light runbook, real commands, never-suppress rule. |
| 07_artifacts_index.md | ✅ | Every binary/weight/JSON/cache/dataset with regen rule; paths verified. |

### `research/`
| Page | Status | Notes |
|------|--------|-------|
| 01_landscape.md | ✅ | 14+ tools, citations verified, feature matrix, CORDAX flagged as closest peer. |
| 02_validation_evidence.md | ✅ | Committed Staph-2023 sens/spec (with caveats); Peleg-118 recall marked pending the exact validation run. |
| 03_open_questions.md | ✅ | OQ1–OQ8 ledger (5 resolved per ADR-021, 3 deferred), F10, Q-FIX-022, Tier-3 avenues. |
| 04_publication_path.md | ✅ | Researcher-framed Zenodo→bio.tools→JOSS with EDAM IDs; points at operator checklist. |

**21 of 21 pages drafted** (09_glossary finishing). Remaining structural work: cross-link sweep + Wave 11 polish.

---

## Wave log

### Waves 3–10 — done (2026-06-29)
Parallel build: 16 pages drafted by focused subagents (one file each, no cross-races), each committed individually in the main loop with verified identity (`Said Azaizah`, zero AI traces). Pages: humans/02,04,05,06,07,08,10; agents/02,03,04,05,06,07; research/02,03,04.
- **humans/02_the_science.md** is the JOSS-critical page — read + spot-checked in the main loop before commit.

### Wave 2 — done (2026-06-29)
- humans/01_first_run.md, humans/03_the_pipeline.md, agents/01_repo_map.md.

### Wave 1 — done
- README (three-doors map), _status.md, humans/00, agents/00, research/01. Competitive citations verified.

---

## Code-vs-paper discrepancies surfaced during the build (FLAG FOR PELEG)

The science page (humans/02) was written against the **code as authoritative** and found these gaps vs `PAPER_METHODS_REFERENCE.md`. The paper Methods text needs reconciling before submission:

1. **FF-Helix gate.** Paper §1.3: "mean hydrophobicity ≥ 0.7". Code (`backend/auxiliary.py:398-409`): gates on **hydrophobic moment (μH)**, default **0.388** single (`config.py:185`) / dataset-mean batch / **0.5** custom (`config.py:360`). Both the quantity (μH vs hydrophobicity) and the value (0.388/0.5 vs 0.7) differ.
2. **TANGO pH.** Paper §1.1: pH 7.4. Binary call (`backend/tango.py:287`): `ph="7"`. PVL's separate charge calc does use 7.4.
3. **β hydrophobic moment angle.** Docstring says 180°; code passes **160°** (`dataframe_utils.py:448`).
4. **μH sliding window.** Paper §1.6 implies an 11-residue sliding window; code computes μH over the sequence/helix-segment with **no** fixed window.
5. **Ragonis-Bachar 2022 citation.** Crossref-verified title is "Natural Antimicrobial Peptides Self-assemble as α/β **Chameleon** Amyloids", *Biomacromolecules* **23**(9):3713–3727 — differs from the "α-Sheet Conformations / 24:413–425" phrasing in the README, CITATION.cff acknowledgement, and landscape page. Reconcile the canonical citation across all docs.

Also confirmed/resolved during the build:
- **S4PRED citation** = Moffat & Jones 2021, *Bioinformatics* 37(21):3744–3751, `btab491` (canonical). README's "Moffat et al. 2022" string should be corrected.
- **Four-class residue colours** (verified against `ui/src/index.css` + `sswColor.ts`): Helix=blue, FF-Helix=green, **FF-SSW=dark green (NOT red)**, SSW badge=blue, **SSW per-residue highlight=magenta #E040FB**. Earlier briefs that said "FF-SSW=red" were wrong.

---

## Open research questions / things still needed (for Said/Peleg)

1. **Validation numbers (research/02).** No committed Peleg-118 FF-Helix/FF-SSW recall exists; `backend/scripts/rerun_validation_2026_06_07.py` needs a Peleg-118 cohort loader added (currently a TODO) before it produces those numbers. Staphylococcus-2023 sens/spec IS committed (`docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md`). Run: `cd backend && USE_TANGO=1 USE_S4PRED=1 .venv/bin/python scripts/rerun_validation_2026_06_07.py`.
2. **The 5 code-vs-paper discrepancies above** — Peleg to confirm which is authoritative (almost certainly the code, with the paper text to be corrected).
3. **Live screenshots.** humans/04 uses ASCII sketches; real screenshots deferred to a later pass (PELEG_NOTES H9: retake in a clean Chrome profile).
4. **Compare-page Welch's t-test** still pending the precomputed `peleg_118.json` drop on the VM (HANDOFF Task #123) — a live-demo visitor may not see the statistic yet.

---

## Remaining work

- **Wave 8a** — humans/09_glossary.md (in progress).
- **Wave 8c** — cross-link sweep across all 21 pages (≥50 new internal links).
- **Wave 11** — README persona-aware rewrite · TOC sweep on multi-section pages · dead-link sweep (WebFetch every external URL) · doc-coverage critique (write findings here, don't auto-fix) · repo-root README handbook pointer.
