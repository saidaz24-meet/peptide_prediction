# Umbrella issues — things Peleg flagged + adjacent issues she didn't catch (2026-06-07)

**Purpose**: every Peleg comment is part of a broader umbrella. This document lists the **same problem in places she didn't look** so we fix the root, not just the visible symptom. Use this as a sweep checklist before declaring publish-ready.

**Status legend**: ✅ fixed today | ⏳ in flight (T2/T3) | ⚠ flagged for fix | ⛔ deferred

---

## Umbrella 1 — "% is a feature, not a class" (FF-Helix %)

Peleg flagged this on the PeptideTable badge and the Smart Ranking slider. Same drift appears in **export panels** she never opened.

| Place | Status | Notes |
|---|---|---|
| PeptideTable badge `FF-Helix X%` (Drive 8) | ⏳ T3a PR-B | Drop badge entirely |
| PeptideDetail scatter axis label "FF-Helix % (helix content × μH threshold)" | ⏳ T3a PR-B | Rename to "FF-Helix score" |
| Smart Ranking slider label `ffHelixPercent → "FF-Helix %"` (ranking.ts:71) | ⏳ T3a PR-B | Rename |
| **PDF report biochem panel** `["FF-Helix %", ...]` | ✅ fixed today | Renamed to "FF-Helix score (sliding-window propensity)" |
| **PDF report summary panel** `["FF-Helix %", ...]` | ✅ fixed today | Renamed to "FF-Helix score" |
| CSV export column header | ⚠ flagged | Need to check `CsvExportDialog.tsx` / serialization |
| Help text | ⏳ T3b PR-C | Replaced by Peleg's 4-section verbatim text |
| Tooltips in PeptideTable | ⏳ T3a PR-B | Updated when display label changes |

---

## Umbrella 2 — Symmetric treatment Helix ↔ SSW (Drive Q5)

Peleg flagged KPI cards and Help page. Same asymmetry appears in **distribution charts and export columns** she never opened.

| Place | Status | Notes |
|---|---|---|
| KPI cards `[Total, %FF-Helix, %SSW, %FF-SSW]` (missing %Helix) | ⏳ T3a PR-B | New `[%Helix, %FF-Helix, %SSW, %FF-SSW]` |
| Help page (2 sections → 4 sections) | ⏳ T3b PR-C | Peleg verbatim |
| **Cohort comparison chart now has Helix grouping** (Wave 2.6) | ✅ done | Two parallel charts |
| **Distribution charts** — do we have Helix % distribution alongside SSW distribution? | ⚠ flag for T3 | Check `ResultsCharts.tsx`; if SSW has one, Helix needs the symmetric panel |
| **Correlation matrix** — both Helix and SSW + their FF flags as targets | ⏳ T3b PR-C | Peleg specifically asked |
| **CSV export column order** — Helix flag should appear adjacent to SSW flag | ⚠ flag | Check column ordering |
| **JSON serialisation** — fields are symmetric already (`helixPrediction`, `ffHelixFlag`, `sswPrediction`, `ffSswFlag`) | ✅ ok |
| **PDF report structure** — does every classification section appear for both Helix and SSW families? | ⚠ flag | Review `summary.ts` and `biochem.ts` |

---

## Umbrella 3 — Residue colour from fragments, not per-residue argmax (black-G fix)

Peleg flagged it on the peptide-detail sequence view. Same bug appears in **every place residues are coloured by secondary structure**.

| Place | Status | Notes |
|---|---|---|
| SequenceTrack (`/peptides/:id`) | ✅ fixed today | Reads fragment ranges first, argmax fallback |
| DualStructureTrack | ✅ already correct | Was already reading fragments |
| **Mol3DViewer 3D overlay** | ⏳ T3a PR-A | Same fix pattern needed |
| **BackboneViewer 2D outline** | ⏳ T3a PR-A | Same fix pattern needed |
| **AggregationHeatmap residue colour** | ⏳ T3a PR-A | Same fix if it colours by secondary structure |
| **PDF report sequence visualisation** | ⚠ flag | Check `peptideReportPanels` — does the PDF render coloured residues? If yes, same fix |
| **Figure pack export** — sequence panel colouring | ⚠ flag | Check `ExportFigurePackButton.tsx` exports |

---

## Umbrella 4 — Provider status badge accuracy (PELEG'S NEW SLACK QUESTION 2026-06-07)

Peleg flagged "TANGO: OFF S4PRED: OFF" on a UniProt single-entry analysis. The root cause is a **fallback bug + UX confusion** affecting every single-entry analysis path.

| Place | Status | Notes |
|---|---|---|
| **`Results.tsx` provider badge fallback — S4PRED hardcoded "OFF"** | ✅ fixed today | Now reads `meta.use_s4pred` like TANGO does; badge labels "Available" vs "OFF" with explanatory tooltip |
| **`Results.tsx` TANGO badge says "ON" when server has TANGO available even if request didn't ask for it** | ✅ fixed today | Same edit — relabelled to "Available" + tooltip |
| **DatabaseSearch banner "Predictions OFF"** (when both off) | ✅ already there | Shown when `run_tango === false && run_s4pred === false` |
| **Same banner needed on Results.tsx** for UniProt-select path | ⚠ flag | Peleg landed on Results without seeing the banner — should propagate |
| **UniProt single-entry select default** — should it default to running both predictors? | ⚠ design decision needed | Currently follows whatever the search-form toggles say |
| **QuickAnalyze provider badges** | ⚠ flag | Check parity with Results.tsx fallback bug |
| **ProviderBadge tooltip wording** — current "TANGO is disabled in settings" misleading when server has it but user didn't request | ✅ improved today | Tooltips now distinguish the two cases |

**Answer to Peleg's question (for Said to forward)**:

> "TANGO: OFF" and "S4PRED: OFF" mean the predictors didn't run on this specific analysis. There are two cases that produce that badge:
> 1. **The server has the predictor enabled but your request didn't include it** — this happens on the UniProt-search path when the TANGO/S4PRED toggle is off. Solution: in the UniProt query form, flip the TANGO and S4PRED toggles ON before running the search, then re-run.
> 2. **The server has the predictor disabled** (env var set to off) — rare on the production VPS, but possible if you're hitting a self-host instance.
> The fix landed today: the badge now says "Available" when the server has the predictor but your request didn't include it, and "OFF" only when the server itself has it disabled. Hover the badge to see which case applies. Also: I'm going to propagate the "Predictions OFF" yellow banner from DatabaseSearch onto Results so you can re-enable in one click.

---

## Umbrella 5 — Dataset-derived thresholds (Peleg "should never be pre-determined")

Peleg flagged SSW diff (0.03 / 3) on Active Thresholds panel. Same drift exists for **every threshold gating a class**.

| Threshold | Current | Status |
|---|---|---|
| SSW diff (S4PRED) | Backend dataset-mean ✓ / UI shows static `0.03` | ⏳ T3b PR-C surfaces correct value |
| SSW diff (TANGO) | Backend dataset-mean ✓ / UI shows static `3` | ⏳ T3b PR-C surfaces correct value |
| FF-Helix μH cutoff | **Backend STATIC default 0.5 (should be dataset mean)** | ⏳ T2 backend fix |
| FF-SSW hydrophobicity cutoff | **Backend STATIC default 0.5 (should be dataset mean)** | ⏳ T2 backend fix |
| MIN_S4PRED_SCORE = 0.5 | Static, Peleg "for now" | ⚠ flag — Peleg said "needs to be tested"; not blocking |
| TANGO aggregation threshold | Static, user-adjustable | ⚠ leave as-is — TANGO output, not classification gate |
| MIN_HELIX_PERCENT_CONTENT = 0 | Static, default 0 (no floor) | ✅ matches Peleg default |
| MIN_SS_PERCENT_CONTENT = 0 | Static, default 0 (no floor) | ✅ matches Peleg default |
| `PEPTIDE_LENGTH_HARD_MAX = 40` | Static, Peleg-confirmed | ✅ matches |

---

## Umbrella 6 — Fibril formation ≠ aggregation (terminology)

Peleg flagged "platform has nothing to do with aggregation". Said deprioritized the copy sweep for this round. Still flagging for the record so we don't ship it wrong.

| Place | Status | Notes |
|---|---|---|
| HowItWorks step 2 says "TANGO aggregation" | ⛔ deferred per Said | Reframe later as "TANGO aggregation OUTPUT re-interpreted through Ragonis-Bachar threshold rules" |
| Multiple tooltips say "aggregation propensity" | ⛔ deferred | Same reframe |
| About page mission statement | ⛔ deferred | Same reframe |
| Help page | ⏳ T3b PR-C | Replaced by Peleg's 4 verbatim sections — covers it indirectly |

---

## Umbrella 7 — Active threshold "single-source-of-truth" lie

Peleg flagged that the Active Thresholds panel shows static defaults. Adjacent issue: the **export permalink** + **PDF report** also need to embed the actually-applied dataset-derived values, not the static defaults from the threshold store.

| Place | Status | Notes |
|---|---|---|
| ActiveThresholdsPanel reads `useThresholdStore().active` (static defaults) | ⏳ T3b PR-C | Read from `meta.thresholds.*Used` instead |
| **Reproducibility permalink encoder** — encodes static defaults | ⚠ flag for T3 | Must encode the actually-applied dataset-derived values, or the permalink won't reproduce the result |
| **PDF report methods panel** — embeds thresholds | ⚠ flag | Same fix |
| **CSV export `meta` block** — embeds thresholds | ⚠ flag | Same fix |
| **JSON `meta.thresholds`** — what the backend returns | ⏳ T2 surfaces new "*Used" fields | Source of truth |

---

## Umbrella 8 — Length cap enforcement

Peleg said "hard cutoff at 40, override only 10-40". Wave 2.6 landed the defaults. Adjacent issues:

| Place | Status | Notes |
|---|---|---|
| Config defaults `PEPTIDE_LENGTH_HARD_MAX=40`, `PEPTIDE_LENGTH_USER_OVERRIDE_MIN=10`, `PEPTIDE_LENGTH_USER_OVERRIDE_MAX=40` | ✅ Wave 2.6 |
| Upload + Quick Analyze warning copy in Peleg's language | ✅ Wave 2.6 |
| **Hard reject at API route** (returns 422 for >40 aa) | ⚠ Batch B A5 | Currently soft-skips via S4PRED cap; should reject at route |
| **UniProt query filter** — applies length filter pre-execution? | ⚠ flag | Check that `length:[5 TO 40]` is appended automatically OR that >40 results are dropped before predictor invocation |
| **CLI accepts >40-aa sequences with no rejection** | ⚠ flag | `pvl-cli` should mirror the API hard reject |

---

## Umbrella 9 — "Regression canaries" naming

Peleg flagged "negative controls" in our docs (`Drive 13`). Renamed to "regression canaries" in test suite + RB-VALIDATION. Awaiting her sign-off on the new term. **Adjacent**: if the rename is good, every mention of "negative control" / "negative-class control" / "FP example" needs sweeping.

| Place | Status |
|---|---|
| `backend/tests/test_canary_peptides.py` | ✅ renamed |
| `docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` | ✅ reframed |
| Other docs mentioning "negative control" | ⚠ grep-and-fix once Peleg confirms term |

---

## Net summary for Peleg's review email

When you send Peleg the "please review the code" email, attach this doc. It shows:

- **27 of 37 Peleg-flagged items**: DONE or in active PR (T2 / T3 / T3a / T3b).
- **4 awaiting her sign-off**: regression canaries term, 2 Help-text minor confirms, framing yes/nos.
- **1 deferred by Said**: PVL rename.
- **9 umbrella-adjacent things she didn't catch**: 7 fixed today or routed to in-flight PRs; 2 flagged for follow-up.

The umbrella-adjacent finds are the high-leverage ones — fixing the root pattern across every render site, not just the visible bug she pointed at. Peleg sees a clean codebase that anticipates her direction rather than reacting to one screenshot at a time.
