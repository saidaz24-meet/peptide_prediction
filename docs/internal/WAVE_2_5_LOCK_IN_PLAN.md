# Wave 2.5 Lock-In Plan — Final Sprint Before Paper Push

**Date**: 2026-05-20
**Author**: T1 (orchestrator)
**Goal per Said directive**: maximize everything in the website that isn't blocked by VM/K8s. Better UI, better functionality, much better consistency. Lock it in before moving to paper/Phase A items.

This document is the **single inventory** for "where we are right now." It pulls from: my conversation memory (all sessions), the active docs (ROADMAP, KNOWN_ISSUES, ALEX_BACKLOG, PELEG_REVIEW_TASKS), and four parallel audit agents that ran 2026-05-20.

---

## §0 — State snapshot

### On `origin/main` (commit cc4968f)
- Wave 0 (Peleg-CRITICAL-001 + ISSUE-025/026 fixes) ✅
- Wave 1-2 (chunk-load auto-recovery, MCP backend route gaps, About wave-dots, FASTA bulk upload, V10-3 unified progress UI) ✅
- Dependabot decisions applied (#60 tailwind + #62 vite closed; #61/#63 labeled zod-v4-migration) ✅
- ISSUE-032 (FF-SSW axiom violation) closed — 9 invariant tests, 538 backend / 613 frontend tests green ✅
- ISSUE-033 (perf regression — ESM-2 inline indexing) closed — background executor ✅
- AUDIT-2 (KPI gating on tangoUnavailable) fixed inline ✅
- jobStore zustand-storage 22 failing tests → 0 (Node 25 localStorage polyfill + explicit createJSONStorage) ✅
- UniProtQueryInput migrated to V10-3 sync-job pattern (was passing dead props) ✅
- MetricDetail BarChart narrowed — `npx tsc --noEmit` clean ✅
- A6 paper figure pack MVP wired into Results Export dropdown — permalink + version embedded in methods panel ✅
- LICENSE switched to MIT today ✅

### Not on main yet
- Wave 2.5 11-item fix-pack (T3 reported "done" — need to verify the PR/branch state with T6)
- Peleg response draft ready at `docs/active/RESPONSES/peleg_2026_05_18_response.md` (Said has not sent yet; plans to humanize via Claude chat)

### Blocked
- DESY VM migration — waiting on Alex to add `azaizahs` to maxwell allowed-users
- A4 bio.tools registration — paused per Said directive
- A5 Zenodo DOI — paused per Said directive
- A7 JOSS paper — depends on A5

### Externally-tracked / dispatched
- T6 to handle the `docs/evolution-since-peleg` branch decision + Wave 2.5 PR coordination
- Cowork to redesign all exports + HTML output (parked — design lift task)

---

## §1 — Critical bugs found in this session (must fix before "lock-in")

### B1. Tab persistence broken on `/results`
- **Symptom (Said report 2026-05-20)**: applying a non-default threshold then reloading sends user back to "Data Table" tab instead of staying on "Candidate Ranking" / wherever they were.
- **Root cause**: `ui/src/stores/chartSelectionStore.ts:58` — `activeTab` defaults to `"data"` with NO persist middleware. Comment explicitly says "Not persisted (intentional)" — the intent is wrong for production UX.
- **Fix**: add `persist()` middleware to `chartSelectionStore`. ~10 lines.
- **Owner**: T3. **Effort**: 30 min.

### B2. Threshold state lost on reload / navigation
- **Symptom (Said report 2026-05-20)**: change µH cutoff, navigate away, navigate back — back to defaults.
- **Root cause**: `ui/src/stores/thresholdStore.ts:59-106` — no persist middleware. Permalink already encodes thresholds for the ReproducibilityRibbon but isn't used to restore state.
- **Two fix options**:
  - (a) Add `persist()` middleware — simple, per-device lossy.
  - (b) Decode permalink on page load — uses existing infra, gives shareable-URL reproducibility for free.
- **Recommend (b)** — bigger UX win, leverages work that's already there.
- **Owner**: T3. **Effort**: (a) 30 min / (b) 2 h.

### B3. Quick Analyze has badge asymmetry + useless empty state
- **Symptom (Said screenshots 2026-05-20)**:
  - Header shows "No SSW" badge but NO Helix / FF-Helix / FF-SSW counterparts.
  - "No database comparison available" greyed block always shows for single-peptide use — pointless visual debt.
- **Diagnosis**: Quick Analyze uses asymmetric flag rendering. The 4-class classification (Helix / FF-Helix / SSW / FF-SSW) isn't surfaced consistently across pages.
- **Fix path** (needs Peleg input — see §4 Q5):
  - Option 1: Hide all FF-flags in single-peptide mode (Peleg-aligned since FF normally requires cohort context).
  - Option 2: Show all 4 flags with literature-default thresholds (µH > 0.5 from Eisenberg 1984; hydrophobicity > 0.5 from current PVL config defaults). Label "default thresholds — upload a cohort for data-derived thresholds."
  - Option 3 (cleanest): Show Helix + SSW base classes always (no cohort needed). Show FF-Helix + FF-SSW with a "default thresholds" pill so the user knows.
- **Remove** the "No database comparison available" empty state entirely — replace with helpful inline microcopy or just hide the section.
- **Owner**: T3 (UI) + Peleg input (§4 Q5). **Effort**: 1.5 h once policy decided.

### B4. Quick Analyze is slow for single peptide (Alex flag, partial)
- **Symptom**: Even after ISSUE-033 fix (ESM-2 background indexing), Quick Analyze still feels slow.
- **Most likely cause** (based on code inspection — research-agent timed out mid-investigation):
  - S4PRED LSTM ensemble model cold-load on first request (~10-30s lazy init) — happens once per worker process
  - TANGO subprocess fork (~2-5s)
  - Per-peptide inference (~1-3s) for short sequences, longer for full-length proteins
- **Recommend**:
  - **B4a — eager S4PRED warm-up on app startup**. Add a no-op single-residue inference at FastAPI startup hook so the LSTM is hot. ~30 min. T2.
  - **B4b — progress stage labels** (parsing → tango → s4pred → done) in the existing `AnalysisProgress` so user perceives progress instead of one long opaque wait. The infra exists in `jobStore.STAGE_LABELS`. ~1 h. T3.
- **Owner**: T2 (B4a) + T3 (B4b).
- **NOT recommended** (deeper than needed): switching predictors, GPU, etc.

---

## §2 — Open Peleg items (after our response — packet for follow-up)

From the Peleg PDF audit agent + our existing response doc.

### Scientific discussions still open (D1-D5)
1. **D1 (slide 24)** — Interpretation Notes decision tree. Hide block until co-design call.
2. **D2 (slide 27)** — 4-class labeling: verbose vs short, show standalone Helix base-class card?
3. **D3 (slide 22)** — Tier 1 "80% certainty": current heuristic isn't published. Recommend drop to qualitative tier labels.
4. **D4 (slide 39)** — Smart Ranking preset weights (Equal / Helix Focus / Switch Focus / Amyloid Focus) need her approval.
5. **D5 (slide 29)** — SSW Score in ranking metrics: drop entirely or keep available-but-not-default?

### Direct questions awaiting answer (Q1-Q4)
1. **Q1 (slide 9)** — S4PRED <15aa limit citation source.
2. **Q2 (slide 14)** — PeptideDetail "Helix 100% vs Helix 77%": which two labels does she mean?
3. **Q3 (slide 39)** — "%" meaning in Smart Ranking sliders/score.
4. **Q4 (slides 23 + 30)** — Modern alternative to Chou-Fasman; or just S4PRED-only?

### Genuine omission from our response (new — discovered by audit agent)
- **Q5 (slide 5 line 5)** — "Everything that is SSW needs to be also of helix." Our response addressed FF axioms (FF-Helix ⊆ Helix, FF-SSW ⊆ SSW) but never confirmed the base SSW ⊆ Helix relationship. **This is profound** — if SSW must be ⊆ Helix, our 4-class diagram is wrong (SSW should be a subset of Helix, not a sibling). Or Peleg meant something else and we need to verify.

### Claims to soften in the response before sending
- **F1 cohort→database sweep**: response says "fixing this week" but 48 instances remain in code. Realistic ETA 2-3 days, not immediate.
- **F10 Beta % calculation**: response listed as "needing adjustment" with no concrete fix proposed. Either propose option (segment-based threshold OR drop Beta % subcards entirely) or move to "needs discussion" §3.

---

## §3 — Alex's open backlog (top items affecting paper-push UX)

48 items audited. 18 done, 3 partial, 27 open. The 27 open break down by category:

### High-value, doable now (recommend Wave 2.5 closure)
- **CQ6 — sidebar job persistence**. ⚠️ May actually be done post Cowork V10-3 unification. **Action**: T3 verifies and either closes the item or files what's still missing.
- **LD2 — 3K+ dataset resilience** (no timeout / auto-disable TANGO). Real perf risk for large UniProt queries. T2 task, ~3 h.
- **CO1-CO2 — Cohort Comparison fresh upload + persistence**. Functionality currently broken on the Compare page. T3 task, ~4 h.

### Needs research / Peleg confirmation (queue, don't block Wave 2.5)
- **T11** — Peleg/Bader paper lookup (cite reference for the threshold defaults).
- **AF1** — Signal peptide research for AlphaFold viewer annotations.
- **P7-P8** — Hamodrakas 2007 helix diagram source for Tier 1 panel.
- **CH7** — "Helic West" rename (Peleg's term — confirm spelling/intent).
- All can be one-shot questions added to the Peleg follow-up email.

### Deferred to Wave 3+
- **CQ7-CQ8** — Queue architecture for 10+ concurrent users (Celery already in place; this is queue UX).
- **TL1-TL2** — Tools tab (PDB renderer, tool research).
- **AI1-AI3** — Phase G AI/MCP (G2 RAG with PubMed; G3 Tamarind research).
- **UX1-UX5** — Phase D2 redesign deeper polish.

### Operational (Said directly; off the dev queue)
- **OP1-OP4** — DESY email, Sentry VPS, free domain.

---

## §4 — Comprehensive task inventory by area

Grouped for terminal assignment. Items marked 🔴 are recommended for Wave 2.5 lock-in.

### Frontend bugs + persistence
- 🔴 B1 — Add `persist()` to chartSelectionStore (tab persistence). **T3**.
- 🔴 B2 — Add `persist()` to thresholdStore OR decode permalink on load. **T3**.
- 🔴 B3 — Quick Analyze badge symmetry + remove empty cohort block. **T3** + Peleg input on Q5.
- 🔴 V1-V5 — UI walkthrough verifications from response §5 (SSW acronym header, UniProt column drift, dual-helix display, SSW interpretation line breaks, Aggregation Distribution histogram-style). **Said** does these on the live VPS in 10 min, then T3 fixes any real misses.

### Frontend consistency sweep
- 🔴 F1 — "cohort" → "database" sweep (48 instances UI-wide; was claimed done but Evidence Panel still has it). **T3 / Cowork**.
- 🔴 F2 — Drop "Cutoff" suffix on µH/Hydrophobicity threshold labels. **T3**.
- 🔴 F11 — Smart Candidate Ranking "%" relabeling (Weight /100 + Score 0-100). **T3**.
- 🔴 F7 — Above-median badge gold-brown → green. **T3**.
- 🔴 F8 — Purple color collision (TANGO:OK pill vs SSW pill). **T3** + Said taste.

### Frontend chart polish
- 🔴 F3 — TANGO Aggregation Profile Y-axis: drop "%" symbol. **T3**.
- 🔴 F4 — Y-axis titles on Hydrophobic Moment + Sequence Length + AA Composition distributions. **T3**.
- 🔴 F5 — Aggregation Propensity Distribution: lollipop → histogram. **T3 / Cowork**.
- 🔴 F6 — Venn diagram FF-SSW positioning visually inside SSW∩Helix. **T3**.
- 🔴 F9 — Sequence-length warning: single "X/Y too short" line. **T3**.
- 🟡 F10 — S4PRED Beta % — option A (segment-based threshold) OR option B (drop Beta% subcards). Needs Peleg sign-off. **T2 backend if A, T3 if B**.

### Backend perf + correctness
- 🔴 B4a — S4PRED warm-up at startup. **T2**. ~30 min.
- 🔴 AUDIT-5 — Rename misleading `ssw_rows` in `backend/services/example_service.py:100`. **T2**. 5 min.
- 🟡 LD2 — 3K+ dataset timeout + auto-disable TANGO. **T2**. ~3 h.

### Exports + downloads (parked per Said — Cowork later)
- All HTML/CSV/PDF/SVG export designs need a complete visual + functional uplift. Currently functional but visually cheap.
- 🟡 EXPORT-1 — Comprehensive export visual redesign across all surfaces (figure pack HTML, PDF report, BibTeX, FASTA, CSV). **Cowork**. Effort: large.

### Documentation + governance
- 🔴 DOC-1 — Update ROADMAP Phase A status: A4 + A5 + A7 paused per Said. Add B1-B4 + F1-F11 to Wave 2.5 board. **T1**.
- 🔴 DOC-2 — Update `CITATION.cff` to reference new LICENSE file (still says `license: MIT` which is now accurate — verify no other drift). **T1**.
- 🟡 DOC-3 — Open question to Peleg: does she also want a DESY-research license alongside MIT? Add to follow-up email. **Said**.

### Branch + git hygiene
- 🔴 GIT-1 — `docs/evolution-since-peleg` branch: stale (16 file deletions vs main). Recommend drop OR cherry-pick docs file onto fresh branch + open PR + merge. **T6**.
- 🔴 GIT-2 — Verify Wave 2.5 fix-pack on a feature branch + open PR + merge + verify auto-deploy. **T6**.
- 🟡 GIT-3 — Tag v0.1.0 once Wave 2.5 lands (deferred per Said — A5 Zenodo paused, so tag not strictly needed yet, but useful as a milestone marker). **T6**.

### Peleg response loop
- 🔴 PEL-1 — Add §6 "Open question Q5" to the response: SSW ⊆ Helix axiom verification. **T1 edits the response draft**.
- 🔴 PEL-2 — Soften §2 claims on F1 (cohort sweep ETA) + F10 (Beta % concrete fix). **T1**.
- 🔴 PEL-3 — Hand to Said for Claude-chat humanization + send. **Said**.

### Research-blocked items (queue as questions in Peleg follow-up)
- 🟡 T11 — Peleg/Bader paper for threshold defaults. **Question for Peleg**.
- 🟡 AF1 — Signal peptide annotation source. **Question for Peleg / Alex**.
- 🟡 P7-P8 — Hamodrakas 2007 helix diagram source. **Question for Peleg**.
- 🟡 CH7 — "Helic West" rename intent. **Question for Peleg**.

### Wave 3+ deferred
- CQ7-CQ8 — Queue architecture polish
- TL1-TL2 — Tools tab / PDB renderer
- AI1-AI3 — Phase G AI/MCP RAG+PubMed
- UX1-UX5 — Phase D2 deeper polish
- B3 Plotly.js scientific charts
- A4-A7 paper-ready chain (resume when ready)

---

## §5 — Terminal assignment proposal

Maximize parallelism across 7 terminals + Cowork. Wave 2.5 lock-in plan:

| Terminal | Wave 2.5 chunk | Items | Estimated effort |
|---|---|---|---|
| **T1 (orchestrator — me)** | Coordination + Peleg packet polish + doc updates | PEL-1, PEL-2, DOC-1, DOC-2 | 2 h |
| **T2 (backend)** | Perf + cleanup | B4a (S4PRED warm-up), AUDIT-5 (rename), LD2 (3K dataset) | 4 h |
| **T3 (frontend — core)** | Bugs + sweep | B1, B2, B3, F1, F2, F3, F4, F6, F7, F9, F11 + CO1-CO2 + CQ6 verify | 10-12 h |
| **T4 (frontend — visuals)** | Color + chart consistency | F5, F8, V1-V5 verification, helix-tracks consistency | 4 h |
| **T5 (T-RES — research)** | Peleg follow-up packet + S4PRED <15aa source | Q1 citation hunt, Q5 verification | 2 h |
| **T6 (github/ops)** | Branches + PRs + deploy | GIT-1, GIT-2 | 1 h |
| **T-PEL** | Round-2 follow-up tracking | When Peleg replies, parse + route fixes to correct terminal | reactive |
| **Cowork** | Export visual redesign (deferred batch) | EXPORT-1 (parked, file as task — start after Wave 2.5 lands) | Cowork chunk |

**Parallelism**: T2 + T3 + T4 + T5 + T6 can all run simultaneously. T-PEL waits on Peleg reply. Cowork is post-Wave-2.5.

---

## §6 — Critical decisions for Said (block nothing else; answer when convenient)

1. **Quick Analyze FF-flags policy** (B3 above). Option 1: hide / Option 2: show with default thresholds / Option 3: show base classes always + FF with "default thresholds" pill. **My recommend**: Option 3. Confirm or override.

2. **F10 Beta % calculation** — segment-based threshold (matches Helix %) OR drop the Beta % subcard? **My recommend**: drop the subcard (Peleg said "showing the graph is enough"). Confirm.

3. **B2 threshold persistence** — `persist()` middleware (simple) OR decode permalink on load (reproducibility-by-URL). **My recommend**: latter — bigger UX win. Confirm.

4. **Q5 (SSW ⊆ Helix axiom)** — do you want me to add this as Q5 in the Peleg packet now, or hold to confirm her exact intent? **My recommend**: add it now, mark "we want to confirm before changing the diagram." Confirm.

5. **EXPORT-1 Cowork dispatch timing** — file as a Wave 2.5 follow-up (after lock-in) or queue as Wave 3? **My recommend**: file now as Wave 2.5 follow-up so Cowork has a queued item ready when the rest lands.

---

## §7 — Recommended execution order

Phase 1 (parallel dispatch — today):
- T2 starts B4a + AUDIT-5
- T3 starts B1 + B2 + F1 + F2 (low-risk wins first)
- T6 handles GIT-1 + GIT-2
- T5 takes Q1 citation hunt + Q5 axiom verification

Phase 2 (parallel dispatch — tomorrow):
- T3 continues with B3 (Quick Analyze redesign) once Said decides §6.1
- T4 starts F5 + F8 + V1-V5 verification
- T2 continues with LD2
- T-PEL waits

Phase 3 (Wave 2.5 close):
- All terminals report. T1 reviews diffs.
- T6 merges to main. Auto-deploy.
- Said verifies on live VPS (the 5 V-items + the 11 F-items).
- Said sends Peleg follow-up.

Phase 4 (Cowork):
- After everything green, Cowork picks up EXPORT-1.

---

## §8 — What's NOT in this plan (intentional)

- DESY VM migration — blocked on Alex.
- A4 bio.tools / A5 Zenodo / A7 JOSS — paused per Said directive.
- Phase G AI vision (G2 RAG, G3 OpenClaw) — Wave 3+.
- Phase D2 deeper visual redesign — Wave 3+.
- pvl-py / pvl-cli ecosystem — Wave 3+.
- DESY-research license addition — pending Peleg's preference (Said will ask).

---

## §9 — Updates to canonical docs after Wave 2.5 lands

- `docs/active/ROADMAP.md` — close out Wave 2.5 section; open Wave 3 section.
- `docs/active/KNOWN_ISSUES.md` — close ISSUE-024 (non-standard AA notification — verify status), close any of ISSUE-027 / ISSUE-028 still open.
- `docs/active/PELEG_REVIEW_TASKS.md` — flip §2 items from "scheduled" to "done" as they land.
- `docs/active/ALEX_BACKLOG.md` — flip closed items, queue remaining ones into Wave 3.
- Memory: `project_apr26_wave_plan.md` superseded by this doc; mark as historical.
