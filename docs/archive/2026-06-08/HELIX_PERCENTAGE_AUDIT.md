# Helix Percentage Audit — Findings

**Trigger**: Peleg (Hebrew, 2026-04-26) — *"the helix percentage seems to be consistently miscalculated or extracted incorrectly"*.
**Owner**: T4. **Branch**: `planning/wave-0-prep`. **Status**: Audit only — no code changes yet.
**Source rule**: Peleg FIX-001 cat 1 — *"Helical = S4PRED segments meeting (a) ≥ minimal continuous residues threshold AND (b) ≥ minimal helix score threshold"* → **segment-based**.

---

## Summary

PVL produces **four physically distinct** "helix percentages" and labels them ambiguously across ~20 UI sites. The canonical metric (matching Peleg cat 1) exists, is correctly computed, and is plumbed end-to-end. The bug Peleg flagged is **not a math error in the canonical pipeline**; it is **mislabeling and silent substitution** at display time:

1. The S4PRED probability-mean (`meanH * 100`) is rendered with the same `% Helix` label as the canonical segment-based value, in two places (`S4PredChart.tsx:67-81`, `PeptideTable.tsx:75`).
2. The Chou-Fasman propensity score (`ffHelixPercent`) is labelled "FF-Helix %" but its UI copy claims it uses the **Fauchere-Pliska scale** (it does not — `auxiliary.py:21-42` is the Chou-Fasman P_α table).
3. A phantom field `peptide.helixPercent` is documented as a fallback on the type, never assigned by the mapper, but read at `PeptideDetail.tsx:397, 408` with `?? 0` — silently rendering null as 0%.
4. TANGO produces its own "SSW helix percentage" (count of helix-track residues > 0) — distinct algorithm, exposed as API field `sswHelixPercentage`. Not currently rendered as "Helix %" in the UI but the API name conflates them.

---

## Compute sites (4 distinct algorithms, 6 call sites)

| File:Line | Calculation | Algorithm | Output column → API field | Verdict |
|---|---|---|---|---|
| `backend/s4pred.py:383` | `_get_segment_percentage(helix_segments, sequence_length)` | **Segment-based**: % residues inside S4PRED helix segments. Segments = ≥`MIN_SEGMENT_LENGTH` (default 5) consecutive residues with `P_H ≥ MIN_S4PRED_SCORE` (default 0.5), gap tolerance ≤ `MAX_GAP` (default 3). Rounded to 2 dp. | `Helix percentage (S4PRED)` → `s4predHelixPercent` | ✅ **CANONICAL** — matches Peleg cat 1 verbatim |
| `backend/s4pred.py:424` | `result[SSW_HELIX_PERCENTAGE_S4PRED] = helix_percentage` | Identical value to `:383`, copied to a second column when an SSW segment is detected. Same number, different field. | `SSW helix percentage (S4PRED)` → `s4predSswHelixPercent` | ✅ Same value as canonical, but **redundant**. Not consumed by UI — recommend removing or stop exposing. |
| `backend/auxiliary.py:60` (`ff_helix_percent`) | Sliding-window of **Chou-Fasman P_α** propensity. % residues that participate in any 6-residue window with mean propensity ≥ 1.0. | `FF-Helix %` → `ffHelixPercent` | ⚠️ **DIFFERENT METRIC.** Plus: every UI string calls this "Fauchere-Pliska" — that is **factually wrong**. Code at `auxiliary.py:21-42` is the Chou-Fasman P_α table (1978). |
| `backend/auxiliary.py:465` (`check_secondary_structure_prediction_content`) | Count of TANGO helix-track residues with score > 0, ÷ length. **Not** segment-based, **not** mean confidence. | TANGO `Helix_percentage` (per-peptide) → DataFrame column `SSW helix percentage` → `sswHelixPercentage` | ⚠️ **DIFFERENT METRIC.** TANGO-derived "% positive helix-track residues". The API field name `sswHelixPercentage` is misleading — it is *not* "% of the SSW segment that is helix"; it is "% of all residues with TANGO helix > 0". Used internally by `tangoDisplaySemantics.ts` to classify SSW negative reasons; not displayed as "Helix %" in UI. |
| `ui/src/components/S4PredChart.tsx:51-57` | `meanH = pH.reduce(+) / n; pct = meanH * 100` | **Mean of per-residue P(Helix) probabilities × 100**. Frontend-only computation. | shown inline as `Avg composition: Helix N%` | ❌ **DIFFERENT METRIC, MISLABELED.** Per FIX-011 — Peleg explicitly said this line is "performing another prediction"; **REMOVE**. |
| `ui/src/components/PeptideTable.tsx:75` (`formatS4predDominant`) | Same probability-mean as S4PredChart, applied to the per-row `peptide.s4pred.pH/pE/pC` curves. | Probability mean × 100 | shown inline in S4PRED dominant cell as `X% Helix · Y% Beta · Z% Coil` | ❌ **DIFFERENT METRIC, MISLABELED.** Same `% Helix` label as the column header (which uses canonical `s4predHelixPercent`). Two values in the same row labeled identically. |

---

## Display sites (~20 surfaces)

Grouped by source field. ✅ = label is honest about what is shown. ⚠️ = label is technically defensible but misleading. ❌ = label collides with another definition or text is factually wrong.

### Sites driven by `s4predHelixPercent` (canonical, segment-based)

| Component:Line | Label | Honest? | Notes |
|---|---|---|---|
| `PeptideTable.tsx:476` (column header) | `Helix %` | ✅ | Column value is canonical. But cell tooltip / sub-content uses a different metric — see below. |
| `PeptideTable.tsx:894` (CSV export) | `Helix %` | ✅ | Could be tightened to "S4PRED Helix %" for export. |
| `PeptideDetail.tsx:350` (classification pill) | `Helix X.X%` | ✅ | |
| `PeptideDetail.tsx:725-728` (S4PRED stat tile in chart card) | `Helix %` | ✅ | |
| `PeptideDetail.tsx:903-907` (4-tile feature grid) | `S4PRED Helix` | ✅ | |
| `PeptidePreviewSheet.tsx:134` | `S4PRED Helix %` | ✅ | |
| `PeptideViewer.tsx:78-80, 149-150` | `S4PRED Helix: X%` | ✅ | |
| `EvidencePanel.tsx:90-97` | `S4PRED Helix` | ✅ | |
| `Legend.tsx:53` | `S4PRED Helix: 0% to 100%` | ✅ | |
| `report.ts:133, 305` | `Mean S4PRED Helix %` / `S4PRED Helix %: Deep-learning…` | ✅ | |
| `ranking.ts:58` | `S4PRED Helix %` | ✅ | |
| `CorrelationCard.tsx:34, 74` | `S4PRED Helix %` | ✅ | |
| `Compare.tsx:378` | `Mean S4PRED Helix %` | ✅ | |

### Sites driven by `ffHelixPercent` (Chou-Fasman propensity, mislabeled)

| Component:Line | Label | Honest? | Required action |
|---|---|---|---|
| `PeptideTable.tsx:555-562` (column) | `FF-Helix %` + tooltip "Chou-Fasman (1978) helix propensity… Not comparable to S4PRED or experimental CD." | ⚠️ | CD reference must go (FIX-027). Decide column fate per FIX-001/027. |
| `PeptideDetail.tsx:371-375` (pill) | `FF-Helix X%` | ⚠️ | Per Peleg cat 2, "FF-Helix" should be the cat-2 flag (Helix AND uH > thr), not Chou-Fasman %. Currently `ffHelixFlag` covers this — pill name collides with flag. |
| `PeptidePreviewSheet.tsx:132` | `FF-Helix %` | ⚠️ | Same. |
| `EvidencePanel.tsx:60-67` (row) | `Chou-Fasman Propensity: X%` | ✅ honest, but **REMOVE entirely** per FIX-014.3 (Peleg said it's outdated). |
| `EvidencePanel.tsx:220-231` (note) | "Chou-Fasman propensity (X%)… S4PRED (X%)" comparison note | ✅ honest, but goes away when EvidencePanel row is removed. |
| `S4PredChart.tsx:144-152` (warning) | uses `s4predHelixPercent < 5` as gate; references "P(Helix) ≥ 0.5" copy | ✅ canonical | None |
| `Help.tsx:34-39` | `FF-Helix % (Fibril-Forming Helix Propensity)` — text says "Fauchere-Pliska helix propensity" | ❌ | Code uses Chou-Fasman, not Fauchere-Pliska. Rewrite per FIX-027/028. |
| `Help.tsx:304-321` (Scientific Notes) | "FF-Helix % … Fauchere-Pliska helix propensity scale with a 6-residue sliding window" | ❌ | Same — wrong scale name. Rewrite per FIX-027. |
| `Results.tsx:752-761` (Alert) | "FF-Helix % measures intrinsic amino acid helix propensity using a sliding window (Fauchere-Pliska scale)… Do not compare to CD spectroscopy" | ❌ | Wrong scale **and** CD spectroscopy is a forbidden term per project rule + FIX-027. |
| `types/metrics.ts:50-53` | `Chou-Fasman Propensity (legacy)` | ✅ honest | Per FIX-001/027, decide whether the legacy metric stays at all (flag for Peleg/Alex). |
| `report.ts:304` | `FF-Helix %: Chou-Fasman (1978) context-free helix propensity.` | ✅ | None |
| `ranking.ts:58, 122-139` | `FF-Helix %` as ranking metric | ⚠️ | Decide fate; `s4predHelixPercent` already covered separately. |
| `CorrelationCard.tsx:33, 69` | row label `FF-Helix %` | ⚠️ | Per FIX-023.4 drop the `%` suffix in matrix; per FIX-027 verify we still want this row. |
| `PeptideTable.tsx:898` (CSV export) | `FF-Helix %` | ⚠️ | Match decision from #7 below. |

### Sites that mix metrics under one label (the actual bug Peleg flagged)

| Component:Line | Label | Source | Verdict |
|---|---|---|---|
| `S4PredChart.tsx:67-81` | `Avg composition: Helix N% / Beta N% / Coil N%` | `meanH/E/C × 100` (probability mean) | ❌ **REMOVE** per FIX-011. Same `% Helix` label as the canonical metric in the same page; the two values can disagree by tens of points. |
| `PeptideTable.tsx:75` (helper `formatS4predDominant`) | cell text `X% Helix · Y% Beta · Z% Coil` (used wherever the helper is called) | probability mean | ❌ Same `% Helix` collision as the column. Either remove the `%` suffix or relabel as `P̄(H)=0.62…`. |
| `PeptideDetail.tsx:393-411` (Sequence & Structure legend) | `Helix (X%)` | `peptide.s4predHelixPercent ?? peptide.helixPercent ?? 0` | ⚠️ The fallback is dead code (see below) but the `?? 0` silently renders **null as 0%**, masking missing data. |

### Phantom field — `peptide.helixPercent`

| Site | Behavior |
|---|---|
| `types/peptide.ts:98` | Documented: *"preferred: S4PRED helix %; fallback: SSW helix percentage"* — no such logic exists. |
| `peptideMapper.ts:165` | Used as a **fallback source for `sswHelixPct`**, not assigned to `helixPercent` on the output object. |
| `peptideMapper.ts:279-339` (build) | `helixPercent` is **never set** on the Peptide object. |
| `PeptideDetail.tsx:393, 397, 408` | Reads `peptide.helixPercent` — **always undefined**, so the `??` chain falls through to 0. |

This is silent data corruption: legend reads "Helix (0%)" when S4PRED data is missing, instead of "—" or hiding the row.

### TANGO `sswHelixPercentage` (FYI — not displayed as "Helix %")

| Site | Use |
|---|---|
| `tangoDisplaySemantics.ts:182-186` | Classify SSW-negative detail: `helixPct === 0` → "no_helical_content". This is correct *for that algorithm* (TANGO threshold-count), but the field name suggests "helix segment %" which it is not. |

API contract: `sswHelixPercentage` is in `api_models.py:86`. **Do not change the field name** without explicit approval (protected file). Document in Help that this is the TANGO-side "% positive helix-track residues" and is distinct from `s4predHelixPercent`.

---

## Recommended canonical definition

> **"Helix %" = `s4predHelixPercent`** (alias `'Helix percentage (S4PRED)'`) computed by `_get_segment_percentage` at `backend/s4pred.py:383` — segment-based, matches Peleg FIX-001 category 1.

Every user-facing label `Helix %` (or `% Helix`, `Helix (X%)`, etc.) must read from this single field. Any other helix-related percentage must use a **distinct label** that names its algorithm (e.g. `Avg P(H)`, `Chou-Fasman propensity`, `TANGO helix-track %`) — never bare `Helix %`.

---

## Required fixes (before any P-wave fix that touches helix display)

Numbered fixes are concrete code edits. Items marked **FLAG** require Peleg/Alex sign-off before implementation.

1. **REMOVE** `S4PredChart.tsx:67-81` — the entire `Avg composition: …` `<div>`. Also remove the now-dead `meanH/meanE/meanC` and `parts` constants on lines 51-58. (Per FIX-011.)
2. **FIX `PeptideTable.tsx:71-77`** (`formatS4predDominant`) — drop the `% Helix · % Beta · % Coil` form and replace with non-colliding text. Two acceptable patterns:
   - `Dominant: H 0.62 · E 0.10 · C 0.28` (mean probabilities, no %)
   - `Dominant class: Helix` (top class only, no number)
   The current "%" form must not stand next to the "Helix %" column.
3. **REMOVE** `peptide.helixPercent` from `types/peptide.ts:98` and all readers:
   - `PeptideDetail.tsx:393` — guard on `peptide.s4predHelixPercent != null` only.
   - `PeptideDetail.tsx:397` — read `peptide.s4predHelixPercent` directly; if null, render `—` (or hide the legend block — preferred).
   - `PeptideDetail.tsx:408` — same.
   - `peptideMapper.ts:165` — drop the `row.helixPercent` fallback (the column never reaches that field anyway).
4. **REMOVE** `EvidencePanel.tsx:50-77` (Chou-Fasman Propensity row) and `:220-231` (the comparison note). Per FIX-014.3.
5. **REWRITE** all FF-Helix copy that mentions "Fauchere-Pliska" (it is Chou-Fasman) and all CD-spectroscopy references (forbidden):
   - `Help.tsx:34-39` — the metrics card definition.
   - `Help.tsx:304-321` — the FF-Helix % vs S4PRED Helix % scientific note.
   - `Results.tsx:749-762` — the FF-Helix Alert; remove "Do not compare to CD spectroscopy" entirely (FIX-027).
   - `PeptideTable.tsx:556` — column tooltip; remove "or experimental CD".
   - Anywhere else `Fauchere-Pliska` appears in FF-Helix context (use Chou-Fasman or remove the scale name per FIX-017.3).
6. **DOCUMENT** `sswHelixPercentage` in Help as "% TANGO helix-track residues > 0; used for SSW negative classification only — not the canonical Helix %". Do not rename the API field.
7. **FLAG for Peleg/Alex** — fate of the `ffHelixPercent` (Chou-Fasman propensity) metric. Two options:
   - (a) Drop the legacy column from the UI everywhere (column header, classification pill, ranking metric, correlation matrix, Help, exports). Keep the backend column for backwards-compat, but stop labelling it "FF-Helix %". Cat 2 FF-Helix is then represented only by `ffHelixFlag`.
   - (b) Keep it, but rename it everywhere to `Chou-Fasman propensity %` and never call it `FF-Helix %`. The "FF-Helix" name is reserved for the cat-2 flag.
   - **Recommendation**: option (a). Peleg already removed it from Evidence Summary (FIX-014.3) and called Chou-Fasman "outdated" — extending that to the rest of the UI is consistent. But the call is hers.
8. **FLAG for Peleg/Alex** — `s4predSswHelixPercent` (s4pred.py:424 / API field `s4predSswHelixPercent`). It is bit-for-bit identical to `s4predHelixPercent`. Recommend: stop emitting it in the API row dict (no UI reads it). This requires touching `api_models.py` only to drop the field — flag T1, do not modify the protected file unilaterally.

---

## Test plan

Backend (pytest):

- [ ] `test_helix_percentage_canonical.py::test_segment_percentage_arithmetic` — for a fixture sequence with known helix segments `[(0, 4), (10, 16)]` and length 20, assert `_get_segment_percentage` returns `round((5+7)/20*100, 2) == 60.0`.
- [ ] `test_helix_percentage_canonical.py::test_api_field_matches_compute_site` — run the S4PRED analyzer end-to-end on a fixture with stubbed `P_H/P_E/P_C` arrays; assert `peptide_dict["s4predHelixPercent"] == _get_segment_percentage(helix_segments, len(seq))` to within 0.01.
- [ ] `test_helix_percentage_canonical.py::test_null_when_s4pred_unavailable` — peptide row with `s4pred_has_data == False` → `s4predHelixPercent is None` (not 0).

Frontend (vitest):

- [ ] `PeptideDetail.test.tsx` — render with `s4predHelixPercent: 42.7`; assert badge, legend, and S4PRED summary tile all show "42.7%" (or 43% per their respective rounding) with no other "% Helix" string in the DOM.
- [ ] `S4PredChart.test.tsx` — render with full `s4pred.pH/pE/pC` arrays; assert the DOM does **not** contain the substring `Avg composition`.
- [ ] `PeptideTable.test.tsx` — render row with `s4predHelixPercent: 30.0` and a non-trivial `s4pred.pH` whose mean differs (e.g. 0.65); assert the "Helix %" column cell shows `30.0%` and no other `% Helix` collision in the row.
- [ ] `peptideMapper.test.ts` — round-trip API row `{ s4predHelixPercent: 55.5 }` and assert `peptide.helixPercent === undefined` (field is removed) and `peptide.s4predHelixPercent === 55.5`.

Manual:

- [ ] Pick a peptide with non-trivial helix segments (e.g. melittin `GIGAVLKVLTTGLPALISWIKRKRQQ`). Verify badge, legend, S4PRED tile, 4-tile feature grid, table column, Compare-page mean **all share the same number** down to display rounding.
- [ ] Pick a peptide with `s4predHelixPercent === null` (TANGO-only or short sequence) — confirm no "0%" appears anywhere; confirm "—" or hidden state.

---

## Open questions (for Peleg/Alex)

- Q1 — Drop `ffHelixPercent` (Chou-Fasman) from UI entirely (recommended), or rename to "Chou-Fasman propensity %"? (See fix #7.)
- Q2 — Is `s4predSswHelixPercent` (the SSW-context duplicate of helix %) consumed anywhere downstream by Peleg's collaborators? If not, drop from API. (See fix #8.)
- Q3 — TANGO `sswHelixPercentage` keeps the misleading API name (protected file). OK to clarify in Help text only?
- Q4 — Sequence & Structure legend `Helix (X%)` currently masks null as 0%. Confirm: hide the legend block when `s4predHelixPercent == null` (preferred), or render `—`?
