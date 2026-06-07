# PVL Coverage Audit — Peleg + Alex Feedback

**Date**: 2026-05-07
**Branch**: `planning/wave-0-prep`
**Scope**: every FIX-001 → FIX-032 from `PELEG_FEEDBACK_INSTRUCTIONS.md` + PELEG-CRITICAL-001 + every entry in `ALEX_BACKLOG.md`.
**Total**: 79 items (33 Peleg + 46 Alex). **Status**: 56 done · 9 partial · 13 todo · 1 awaiting confirmation.

---

## Summary table — Peleg

| ID | Title | Status | Evidence |
|---|---|---|---|
| CRITICAL-001 | Helix-% audit | ✅ | `HELIX_PERCENTAGE_AUDIT.md` + commits 2958db1, 68339b9 |
| FIX-001 | 4-category classification | ✅ | `backend/auxiliary.py:342-376` (cat 1-4) + 57724c5 |
| FIX-002 | Threshold panel restructure | ✅ | `ThresholdConfigPanel.tsx:7-78`, `backend/config.py:191-272` + c42edd4 |
| FIX-003 | Terminology sweep (cohort→database etc.) | ⚠️ | `BiochemComparison.tsx:8`, test enforces no "cohort" in DOM (`BiochemComparison.test.tsx:94`); prop names intentionally kept |
| FIX-004 | KPI reorder + rename | ✅ | `ResultsKpis.tsx:199-204` + 71a0c24 |
| FIX-005 | Badge colors / consistency | ✅ | `PeptideTable.tsx:331,395,422` + 71a0c24 |
| FIX-006 | Consistent table columns | ✅ | `PeptideTable.tsx:179` + 71a0c24 |
| FIX-007 | Venn bug + FF-SSW nesting | ✅ | `EulerDiagram.tsx:8`, `SetDiagram.tsx:24` |
| FIX-008 | Pipeline → Results rename | ✅ | `EulerDiagram.tsx:33`, `UpsetMatrix.tsx:103` |
| FIX-009 | Two helix percentages clarified | ✅ | HELIX_PERCENTAGE_AUDIT fixes #1-3 + 2958db1 |
| FIX-010 | Sequence residue coloring legend | ❌ | no legend added in `PeptideDetail.tsx` sequence display |
| FIX-011 | Remove "Avg composition" line | ✅ | `__tests__/S4PredChart.test.tsx:40-42` locks absence + 2958db1 |
| FIX-012 | TANGO chart corrections | ⚠️ | subtitle/footer fixed; y-axis still "Peak TANGO aggregation (%)" `ResultsCharts.tsx:266` |
| FIX-013 | Remove Consensus tier system | ✅ | `PeptideViewer.tsx:9`, `RankedTable.tsx:7-113`, `PeptidePreviewSheet.tsx:23-90`, `PeptideMiniCard.tsx:7` |
| FIX-014 | Evidence Summary fixes | ✅ | `EvidencePanel.tsx:72` (MODERATE labels gone, Chou-Fasman row dropped) + 71a0c24 |
| FIX-015 | Interpretation notes review | ❌ | `PeptideViewer.tsx:170`, `EvidencePanel.tsx:222` still render auto-generated notes |
| FIX-016 | Biochemical feature comparison | ✅ | `BiochemComparison.tsx:8-12,121,271`, `PeptideDetail.tsx:430` + 56d30c2 |
| FIX-017 | Sliding-window profile fixes | ✅ | `WindowProfileChart.tsx:428` (Residue position axis); Fauchere-Pliska moved to Help only |
| FIX-018 | FF-Helix vs Agg scatter | ⚠️ | axes labeled; chart still rendered, no remove-or-keep decision |
| FIX-019 | Distribution Y-axes + summary notes | ✅ | `DistributionChart.tsx:6-14,244,421`; `ResultsCharts.tsx:145,168,196,267` |
| FIX-020 | AA composition info tooltip | ✅ | `AACompositionGrouped.tsx:138` |
| FIX-021 | Aggregation distribution style consistency | ✅ | `DistributionChart.tsx:14` (FIX-021 ref, unified bar style) |
| FIX-022 | Comparison chart improvements | ⚠️ | colors/spacing/Y-axis fixed `ClassificationComparison.tsx:90`; Helix-version + FF-SSW group + signed-charge still TODO |
| FIX-023 | Correlation matrix improvements | ✅ | `CorrelationMatrix.tsx:14,51,61-65` (one-triangle, exclusions, no `%`); `dataframe_utils.py:364` |
| FIX-024 | Smart ranking parameter changes | ✅ | `ranking.ts:7-147`, `Help.tsx:283`; "Helix Focus" + "Fibril-formation Focus" presets |
| FIX-025 | Threshold provenance | ✅ | `ThresholdTuner.tsx:230,251`; legacy aggregation thresholds removed (PELEG-PEL-G) |
| FIX-026 | Metric definitions rewrite | ✅ | `Help.tsx:10,34`, `metricRegistry.ts:86-91` (ranges + pH 7.4 corrected) |
| FIX-027 | FF-Helix + SSW definitions | ✅ | `Help.tsx:43,55,142`; Fauchere-Pliska/CD framing removed |
| FIX-028 | FF-Helix info note rewrite | ✅ | `Results.tsx:748` (verbatim FIX-028 copy) |
| FIX-029 | Visualization guide text | ✅ | `Help.tsx:66,82` (verbatim) |
| FIX-030 | Classification help fixes | ✅ | `Help.tsx:259,279,287` (FIX-001 OR-logic + drop SSW score) |
| FIX-031 | S4PRED length warning | ⚠️ | `Upload.tsx:646` simplified to one line; 15aa-cutoff citation TODO (Q-FIX-031) |
| FIX-032 | Display threshold values | ✅ | `Results.tsx:544`, `ResultsCharts.tsx:125` |

## Summary table — Alex backlog

| ID | Item | Status | Evidence |
|---|---|---|---|
| T1-T10 | Threshold restructure (Dangerous Max, groups, info icons, helicity, Min S4PRED, TANGO/SSW max diff, FF section) | ✅ | covered by FIX-002 implementation in `ThresholdConfigPanel.tsx` |
| T11 | Peleg/Bader paper threshold citations | ❌ | no citations added to Help/Threshold panel |
| C1-C5 | S4PRED column, drop TANGO/S4PRED labels, helix yes/no, column order, drop disagree warning | ✅ | `PeptideTable.tsx:179,331,395,422` |
| P1-P6 | Helix+SSW tracks, expandable titles, helix agg graphs, drop "concerns", calmer agg colors | ✅ | per backlog (commits 6a04685, 1b55ab5) |
| P7 | Hamodrakas 2007 research for switch zone | ⚠️ | `consensus.py:5` + `AlgorithmShowcase.tsx:151` cite it; warning text still vague |
| P8 | Helix up/down diagram counterpart to SSW | ❌ | no helix variant in `PeptideDetail.tsx` |
| CH1 | Pipeline-overview region color summary table | ❌ | not implemented |
| CH2 | Dynamic Venn no-overlap | ✅ | `EulerDiagram.tsx:8` |
| CH3 | Clickable diagram → table filter | ❌ | no chart-to-table cross-filter |
| CH4 | Customizable top charts (combined view) | ❌ | charts still fixed layout |
| CH5 | Peptide markers in table below charts | ❌ | not implemented |
| CH6 | Doolittle → Fauchere-Pliska rename | ✅ | `profile.ts:3`, `biochem_calculation.py:30` |
| CH7 | "Helic West" rename | ❌ | name not yet in code; verify with Peleg |
| AF1 | Why AlphaFold has longer sequence | ❌ | no investigation logged |
| AF2 | Signal-peptide warning | ✅ | `AlphaFoldViewer.tsx:141` |
| CO1 | Fresh dual cohort upload | ❌ | per backlog |
| CO2 | Save analysis for later compare | ❌ | per backlog |
| QA1 | Quick Analyze example buttons | ✅ | per backlog |
| TL1-TL2 | Tools tab (PDB→PNG, others) | ❌ | per backlog |
| LD1 | nginx 413 fix | ✅ | per backlog |
| LD2 | 3K+ entry handling | ❌ | per backlog |
| LD3 | Entry-count warning | ✅ | per backlog |
| LT1 | Load testing 50/100/1000 concurrent | ❌ | per backlog |
| UX1-UX5 | Sidebar/scroll/theme/minimizable polish | ⚠️ | sidebar redesigned 6a04685; theme + minimizable bars not finalized |
| INF1-INF4 | Docker compose / GHCR / multi-arch / git workflow | ❌ | Phase E roadmap |
| AI1-AI3 | MCP / RAG / Tamarind | ❌ | Phase G roadmap |
| CQ1-CQ3, CQ5 | asyncio.to_thread, workers=2, nav guard, blocking-pipeline fix | ✅ | 393232e, 4c74643, 8b6e8e6, cb2472b, 97b344f |
| CQ4 | Reconnect to ghost jobs | ⚠️ | abort-on-nav done; reconnect TODO |
| CQ6-CQ9 | Job sidebar UI / Celery+Redis / 6000-entry timing | ❌ | `jobApi.ts:132` API exists but no UI sidebar |
| UU1-UU3 | Upload UX confusion | ✅ | 97b344f Upload redesign |
| QU1 | "Label" → "Name" | ✅ | per backlog |
| OP1-OP4 | DESY email + Sentry + domain | ⚠️ | Sentry done (50e096a); DESY email + domain still TODO |

---

## Detailed notes (PARTIAL / TODO only)

- **FIX-003** — user-visible text scrubbed of "cohort"/"Pipeline" (test `BiochemComparison.test.tsx:94` enforces). Code identifiers (`cohortStats` prop, `cohortA/B` keys in `chartConfig.ts:68-70`) intentionally kept per Peleg's "do NOT rename code variables" rule.
- **FIX-010** — sequence in `PeptideDetail.tsx` has mixed colors with no legend. ~30 LOC fix.
- **FIX-012** — subtitle/footer fixed; `ResultsCharts.tsx:266` Y-axis still "(%)". 5% threshold wording: Q-FIX-012.
- **FIX-015** — auto-generated notes still in `PeptideViewer.tsx:170` and `EvidencePanel.tsx:222`. Replace with disclaimer until Peleg sign-off.
- **FIX-018** — axes labeled; remove-or-keep decision on the FF-Helix vs Agg scatter still pending.
- **FIX-022** — Helix-version duplicate, FF-SSW group, signed-charge: all blocked on Peleg.
- **FIX-031** — one-line warning shipped; 15aa citation pending (Q-FIX-031).
- **P7** — `consensus.py:5` and `AlgorithmShowcase.tsx:151` cite Hamodrakas 2007; the dedicated "high-confidence switch zone" callout was dropped with FIX-013.
- **P8** — SSW has up/down switch diagram; helix has wheel/Mol3D/WindowProfile but no parallel up/down diagram.
- **CH1/CH3/CH4/CH5** — Phase D2.8 visualization redesign work; not v0.1 scope.
- **CH7** — "Helic West" not in source; need exact name from Peleg.
- **CQ4** — nav guard + abort done (393232e); job reconnection (CQ6 sidebar) not built.
- **T11 / OP1-OP4** — threshold citations (T11), DESY email (OP1-OP2), free domain (OP4) outstanding. Sentry (OP3) done in 50e096a.

---

## Items needing Peleg / Alex confirmation

- **Resolved offline 2026-05-06**: Q1 (drop Chou-Fasman → option A), Q5 (per-residue %), Q6 (% of length), Q7 (Consensus tier).
- **Wave C email draft**: Q2 (drop `s4predSswHelixPercent`), Q3 (TANGO `sswHelixPercentage` rename or doc), Q4 (legend null handling), Q-FIX-012 (TANGO 5% citation), Q-FIX-022 (signed vs abs charge), Q-FIX-023 (correlation missing values), Q-FIX-025 (Min SSW residues), Q-FIX-031 (15aa citation), CH7 (Helic West name).
- **Live meeting**: Q-FIX-015 interpretation-notes decision tree.

---

## Recommended next actions (v0.1 push blockers)

1. **FIX-010** — add a sequence-coloring legend in `PeptideDetail.tsx`. ~30 LOC.
2. **FIX-012** — drop `(%)` suffix from TANGO y-axis at `ResultsCharts.tsx:266`. 1-line edit.
3. **FIX-015** — replace auto-generated interpretation notes with disclaimer until Peleg sign-off (`PeptideViewer.tsx:170`, `EvidencePanel.tsx:222`).
4. **P8** — duplicate SSW up/down diagram for helix in `PeptideDetail.tsx`. Small lift if SSW component is parameterized.
5. **T11 / Q-FIX-031** — citation block in `Help.tsx` Scientific Notes for Peleg/Bader thresholds + S4PRED 15aa source; ask Peleg in Wave C email to confirm the references.

Everything else (CH1, CH3-CH5, CO1-CO2, TL1-TL2, AF1, INF*, AI*, LT1, LD2, CQ6-CQ9) is post-v0.1 and lives in ROADMAP.md Wave D-J.
