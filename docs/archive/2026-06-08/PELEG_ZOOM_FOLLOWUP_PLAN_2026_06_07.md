# Peleg Zoom follow-up — root-cause fix plan (2026-06-07)

**Source**: Peleg's call comments delivered through Said.
**Approach**: every issue gets a root-cause analysis + a file-level fix list. Grouped into 4 terminal chunks (T1/T2/T3/T5). Each chunk is independently runnable.

**Hard rule from Peleg, baked into every fix**: *"We always go back to what she originally did, not what the classy way of implementing TANGO and S4PRED is."* — Peleg's repo at `~/Desktop/DESY/Expanding-_the_amyloid_landscape-main` is the source of truth; PVL is its productionisation. Where we drifted, we revert.

> Note for T1: Said hasn't granted me filesystem-list permission on Peleg's repo. Cross-checking her source requires either (a) Said granting permission, or (b) Said pasting key files (her notebook / her threshold scripts / her segment finder).

---

## §0 — The positioning shift that frames everything

Peleg's central correction: **PVL is about fibril formation, not aggregation.** TANGO's aggregation score is an *input we don't trust at face value*. Peleg's whole research was building threshold rules + segment logic that re-interpret TANGO+S4PRED output through a **fibril-formation lens** — specifically self-assembly via α-helix and SSW pathways, NOT cross-β amyloid. That's our unique value.

This reframes a lot of the smaller issues. Wherever we currently lead with "aggregation prediction" or treat TANGO's raw aggregation score as the headline, we drift. The fix is positioning + terminology + ranking + KPI ordering — all flow from §0.

**Single sentence we use everywhere**: *"PVL predicts non-amyloid fibril formation by re-interpreting TANGO and S4PRED outputs through threshold rules calibrated by the Ragonis-Bachar / Rayan work — surfacing α-helix and SSW self-assembly candidates that classical aggregation tools miss."*

---

## §1 — Root-cause issue map

| # | Issue (Peleg's words) | Root cause | Fix at the root | Affected files |
|---|---|---|---|---|
| R1 | "Platform is fibril formation, not aggregation" | Copy treats TANGO aggregation as the product; FF logic positioned as add-on | Rewrite positioning across landing, About, Help, tooltips. Aggregation → "input signal we re-interpret" | `HowItWorks.tsx`, `Index.tsx`, `About.tsx`, `Help.tsx`, `EvidencePanel.tsx`, `Results.tsx` hero copy, every tooltip mentioning "aggregation prediction" |
| R2 | "Black G is coil despite being inside helix run" | `SequenceTrack` colours per-residue from raw S4PRED classification — bypasses Peleg's fragment-with-gap-smoothing | Re-base residue colour on `s4predHelixFragments` / `s4predSswFragments` / `ffHelixFragments` ranges with MAX_GAP=3 smoothing | `SequenceTrack.tsx`, `DualStructureTrack.tsx`, `BackboneViewer.tsx`, `Mol3DViewer.tsx` |
| R3 | "Active thresholds at top shouldn't be pre-determined — they're per-dataset" | UI's `ActiveThresholdsPanel` shows static `config.py` defaults; backend correctly computes dataset-derived mean (`tango.py:1655`) but UI doesn't surface it | UI reads `meta.thresholds.sswDiffS4predUsed` / `sswDiffTangoUsed` (per-dataset mean) and labels them as "auto-derived from dataset (mean ≈ X)". Defaults only show for single-sequence mode and are clearly labelled "fallback" | `ActiveThresholdsPanel.tsx`, `thresholdStore.ts`, backend `meta.thresholds` schema in `api_models.py` |
| R4 | "Correlation matrix should use S4PRED helix SCORE, not %" + "must include TANGO + FF-class as tested" | Matrix currently uses derived percent fields, classical interpretation | Reframe matrix metrics list: S4PRED helix score, TANGO helix score, TANGO beta score, TANGO aggregation max, μH, hydrophobicity, charge — plus FF-Helix flag and FF-SSW flag as binary correlation targets | `CorrelationMatrix.tsx`, `CorrelationCard.tsx`, `ResultsCharts.tsx` |
| R5 | "Whenever there's an SSW card, there must be an FF card too — symmetry" | KPI row is `[Total, %FF-Helix, %SSW, %FF-SSW]` — missing Helix card | New 4-card layout: `[%Helix, %FF-Helix, %SSW, %FF-SSW]`. Total Peptides moves to a ribbon strip above the cards (or under the page title) | `ResultsKpis.tsx`, `Results.tsx` |
| R6 | "Why does FF-Helix always have a %? Drop it" | UI shows `ffHelixPercent` as a number badge in several places, treating it as a class-percent like Helix % | Drop "FF-Helix %" as a *displayed* feature label. The `ffHelixPercent` field stays in the data for ranking, but UI never shows it as a "%" badge | `PeptideTable.tsx` (line 400-403 badge), `PeptideDetail.tsx` (scatter X-axis), `Smart Ranking` slider label, `ranking.ts` METRIC_LABELS |
| R7 | "Length should be on the right with bio features" + "Helix % shouldn't be default" | PeptideTable column order leads with identity then jumps to length, then classification, then bio features | Reorder: identity → classification flags → bio features (length, charge, hydrophobicity, μH). Helix % becomes optional toggle | `PeptideTable.tsx` column definitions |
| R8 | "Ranking should have fibril-formation as a default — that's what researchers come for" | Current ranking presets don't lead with FF | Add "Fibril-Formation" preset that weights FF-Helix flag + FF-SSW flag + SSW + μH heavily. Set this preset as the default for Recommended mode | `ranking.ts` RANKING_PRESETS, `ThresholdConfigPanel.tsx`, `thresholdStore.ts` |
| R9 | "FF-Helix is downstream of TANGO+S4PRED — diagram order is wrong" | Landing-page `HowItWorks` step 2 lists "TANGO + S4PRED + FF-Helix + biochem" as parallel | Restructure into two sub-steps: (2a) TANGO + S4PRED + biochem run as inputs; (2b) Peleg's threshold rules derive FF-Helix / SSW / FF-SSW from those outputs | `HowItWorks.tsx`, `AlgorithmShowcase.tsx`, `FirstVisitModal.tsx` |
| R10 | "Are we drifting from her repo?" | Suspected drift in segment-finder, threshold logic, scoring rules | Diagnostic delta: file-by-file compare `backend/auxiliary.py`, `backend/s4pred.py`, `backend/tango.py` segment + threshold code against her repository. Document where we follow, where we diverge, why | `auxiliary.py`, `s4pred.py`, `tango.py`, new `docs/active/PELEG_REPO_DELTA.md` |

---

## §2 — Chunks for terminal dispatch

Each chunk is independently runnable. Said prompts each terminal individually, runs `/compact` between, and merges results back through T1.

### Chunk A → T1 (orchestrator + positioning copy + landing diagram)

**Owner**: T1 (this terminal).
**Scope**: R1 (positioning), R9 (landing diagram order). Pure copy + sequencing — no algorithm logic.

**Deliverables**:
1. Rewrite landing hero copy (the "blue part" Said called out) — leads with fibril formation, not aggregation. Use the single positioning sentence from §0.
2. Restructure `HowItWorks.tsx` step 2 into two sub-steps:
   - 2a: "Run TANGO + S4PRED + biochem" (the *raw* inputs)
   - 2b: "Apply Ragonis-Bachar / Rayan threshold rules to derive FF-Helix, SSW, FF-SSW" (the *re-interpretation*)
3. Update `AlgorithmShowcase.tsx` to put FF-Helix tab visually downstream of TANGO + S4PRED tabs (arrow flow or separator).
4. Audit and rewrite every "aggregation prediction" / "predicts aggregation" string in the codebase. Grep:
   ```
   grep -rn "predict.*aggregation\|aggregation.*prediction\|aggregation.*tool\|aggregation propensity" ui/src docs/active --include="*.tsx" --include="*.ts" --include="*.md"
   ```
   Each hit → reframe to fibril-formation language.
5. Update `About.tsx`, `Help.tsx` Methods section, `FirstVisitModal.tsx`, all tooltips.
6. New doc: `docs/active/PVL_POSITIONING_v2.md` — the canonical positioning page that all marketing/paper copy derives from.

**Acceptance**:
- `grep -rn "predict.*aggregation\|aggregation.*prediction" ui/src` returns 0 hits.
- HowItWorks step 2 visually shows TANGO+S4PRED above/before FF-Helix derivation.
- Hero copy leads with the §0 single sentence (or its humanised variant).
- `npx tsc --noEmit` clean; visual smoke on `/`, `/about`, `/help`.

**Risk**: copy changes can ripple into test snapshot diffs. Run the full vitest suite, accept snapshot updates only where appropriate.

---

### Chunk B → T2 (backend scientific core + Peleg repo audit)

**Owner**: T2 (backend dev terminal).
**Scope**: R3 backend half, R10, plus surfacing the data T3 needs for R2 and R4.

**Deliverables**:

1. **R10 — Peleg repo delta diagnostic** (mandatory first step):
   - Read Peleg's repo at `/Users/saidazaizah/Desktop/DESY/Expanding-_the_amyloid_landscape-main` (Said: grant Read permission on this path before dispatching T2).
   - Locate her segment-finder function(s) — likely named something like `find_segments`, `find_fragments`, `secondary_structure_switch`, or similar.
   - Locate her threshold-calibration code — how she computed the SSW diff thresholds on her training datasets.
   - Locate her residue-colouring / fragment-with-gap-smoothing code.
   - For each of `backend/auxiliary.py`, `backend/s4pred.py:_calc_ssw_score_and_diff`, `backend/tango.py:_mark_ssw_predictions`, write a side-by-side comparison: her algorithm vs ours. Output: `docs/active/PELEG_REPO_DELTA.md`.
   - **Critical**: identify any place where PVL's algorithm differs from hers. List the divergences explicitly.

2. **R3 backend** — `meta.thresholds` honest reporting:
   - In `backend/services/normalize.py` (or wherever `meta.thresholds` is assembled): ensure it carries `sswDiffS4predUsed` (the actual mean-of-dataset value applied), `sswDiffTangoUsed`, `muHCutoffUsed`, `hydroCutoffUsed`, `sswDiffStrategy` (mean/median/fixed/multiplier), `sswDiffNValidRows` (how many rows contributed to the dataset mean).
   - Single-sequence mode: explicitly mark these as `single_sequence_fallback: true`.
   - `backend/schemas/api_models.py`: add the new fields to the `MetaThresholds` schema. **DO NOT** change any existing field names — additive only.

3. **R2 backend** — fragment surfacing:
   - Verify `s4predHelixFragments`, `s4predSswFragments`, `ffHelixFragments`, `tangoSswFragments` (TANGO-derived, NOT S4PRED beta-segments) all reach the per-peptide API response.
   - If `tangoSswFragments` exists in the DataFrame (column `SSW fragments (Tango)` or similar) but isn't being serialised, add it to the per-peptide payload in `normalize.py`.

4. **R4 backend** — correlation data surface:
   - Audit the columns the correlation matrix consumes via the frontend. Per Peleg, it must compare: S4PRED helix score, TANGO helix score, TANGO beta score, TANGO aggregation max, μH, hydrophobicity, charge, FF-Helix flag (0/1), FF-SSW flag (0/1).
   - If S4PRED helix *score* (raw probability, not the %) isn't on the API response, surface it. Peleg distinguishes: % = derived feature, score = the actual S4PRED output probability we should correlate against.

**Acceptance**:
- `docs/active/PELEG_REPO_DELTA.md` exists, lists every algorithmic divergence (or affirms parity).
- `meta.thresholds` API response carries the new "used" + "strategy" + "n_valid" fields.
- Per-peptide response includes `s4predHelixScore` (raw), `tangoSswFragments`, all four fragment columns.
- Existing tests pass (606 backend). New tests: `test_meta_thresholds_actual_values.py`, `test_tango_ssw_fragments_surfaced.py`.

**Risk**: schema changes need contract-check pass (`make contract-check`). Additive-only changes should be safe.

---

### Chunk C → T3 (frontend scientific surface)

**Owner**: T3 (frontend dev terminal). Waits on T2 chunk B completion for the new backend fields.
**Scope**: R2 frontend, R3 frontend, R4 frontend, R5, R6, R7, R8.

**Deliverables**:

1. **R2 — Residue colour from fragments + gap-smoothing**:
   - Rewrite `SequenceTrack.tsx` so the per-residue colour is determined by *fragment ranges*, not per-residue S4PRED class.
   - For each residue index `i`:
     - If `i` falls inside any range in `s4predHelixFragments` → helix colour.
     - Else if inside any range in `s4predSswFragments` → SSW colour.
     - Else if inside any range in `ffHelixFragments` → FF-Helix colour.
     - Else if inside any range in `tangoSswFragments` (new from T2) → SSW (TANGO) colour.
     - Otherwise → coil/disordered colour.
   - Gap smoothing: if two adjacent fragments of the *same* type are separated by ≤ MAX_GAP (3) residues, treat the gap residues as inside the fragment (this is what fixes "black G in middle of helix run").
   - Update `DualStructureTrack.tsx` to read these directly too (no need for fallbacks).
   - Update `BackboneViewer.tsx` and `Mol3DViewer.tsx` overlays to use the same fragment-based colour logic.

2. **R3 — Active thresholds UI**:
   - `ActiveThresholdsPanel.tsx`: read `meta.thresholds.sswDiffS4predUsed` / `sswDiffTangoUsed` from the dataset; display as the actual current value with a small "auto-derived from N rows (mean)" sub-label.
   - For single-sequence mode (`meta.thresholds.single_sequence_fallback === true`): show the default value with a clear "single-sequence fallback — no dataset mean to compute against" tooltip.
   - Threshold sliders for these two fields: disable by default in batch mode (auto-derived), enable only when user clicks "Override" — making it obvious that overriding the dataset-derived value is unusual.

3. **R4 — Correlation matrix metrics**:
   - In `CorrelationMatrix.tsx`: replace S4PRED helix *percent* with S4PRED helix *score* (raw probability from backend, surfaced in chunk B).
   - Add TANGO helix score, TANGO beta score, TANGO aggregation max as correlation metrics.
   - Add FF-Helix flag and FF-SSW flag as binary correlation targets (so researchers see "which metrics correlate with being an FF candidate?" — Peleg's "as something we are testing" framing).
   - Drop any presented metric that's just a derived percent of another (Peleg's "% is a feature not a class" applied to correlation).

4. **R5 — KPI cards symmetry**:
   - `ResultsKpis.tsx`: replace "Total Peptides" card with "% Helix" card. New layout: `[%Helix, %FF-Helix, %SSW, %FF-SSW]`.
   - "Helix %" card reads `stats.helixPositivePercent` (or the equivalent — confirm with backend).
   - Move "Total Peptides" out of the card row entirely. Put it as a small text line right above the card row: `"2,916 peptides analysed"` styled like a sub-header, not a card.

5. **R6 — Drop FF-Helix % display**:
   - `PeptideTable.tsx` lines 400-403: remove the `FF-Helix X%` badge in the classification pills row.
   - `PeptideDetail.tsx` scatter X-axis: rename from "FF-Helix % (helix content × μH threshold)" to "FF-Helix score" (no percent symbol).
   - `Smart Ranking` slider for `ffHelixPercent`: rename label from "FF-Helix %" to "FF-Helix score" in `ranking.ts:71` METRIC_LABELS.
   - The underlying field `ffHelixPercent` stays — this is purely a *display label* sweep.

6. **R7 — PeptideTable column reorder**:
   - Column order goes: `[Identity (id, sequence, length-NO-MOVE-TO-RIGHT, sourceDb)] → [Classification (Helix, FF-Helix, SSW, FF-SSW flags)] → [BioFeatures (Length, Charge, Hydrophobicity, μH)] → [Predictor outputs (TANGO agg max, S4PRED helix score)]`.
   - Length moves from identity group into the BioFeatures group (right side).
   - Helix % column: hidden by default, available via column-visibility toggle. Tooltip explains it's an S4PRED feature, not a class.

7. **R8 — Fibril-Formation ranking default**:
   - In `ranking.ts`: add a new preset `FIBRIL_FORMATION` that weights FF-Helix flag (binary, 1 if candidate) × 30, FF-SSW flag × 30, SSW (binary) × 20, μH × 10, helix-content × 10.
   - In `ThresholdConfigPanel.tsx` or `thresholdStore.ts`: set `FIBRIL_FORMATION` as the default preset for the "Recommended" mode.
   - Existing presets (`HELIX_FOCUS`, `SWITCH_FOCUS`, `AMYLOID_FOCUS`, `EQUAL`) stay as alternatives. `FIBRIL_FORMATION` becomes the new top of the list.

**Acceptance**:
- `npx tsc --noEmit` clean.
- All 608 vitest specs pass; update snapshots only where intentional.
- Manual smoke on `/results` (KPI row, correlation matrix, active thresholds), `/peptides/:id` (residue colouring with the black-G test peptide P01501).
- Smoke peptide for black-G fix: P01501 (Said's screenshot) — the G residue between helical runs should now be coloured helix because it's within MAX_GAP of the surrounding helix fragment.

**Risk**: KPI card change might break snapshot tests + dashboard-summary tests. Re-baseline only where the change is intentional, not where it masks a bug.

---

### Chunk D → T5 (research / verification — non-code)

**Owner**: T5 (research terminal).
**Scope**: deep-dive verification — produces docs that T1/T2/T3 consume.

**Deliverables**:

1. **Peleg repo deep read** — produces `docs/active/RESEARCH_BRIEFS/RB-PELEG-REPO-AUDIT.md`:
   - Map every function in Peleg's repository to the corresponding PVL function (or note "not in PVL").
   - For each: side-by-side pseudocode, identified divergences, recommendation (port-as-is / port-with-changes / keep-our-version).
   - Highlight her FIBRIL FORMATION framing: where in her notebook does she explicitly distinguish fibril formation from aggregation? Quote her language.

2. **Threshold provenance audit** — produces `docs/active/THRESHOLD_PROVENANCE.md`:
   - For each threshold in `config.py`: trace back to either (a) Peleg's repo / paper, (b) PVL-specific empirical choice, (c) inherited from TANGO/S4PRED defaults.
   - Flag anywhere PVL uses a TANGO/S4PRED "classical" default that Peleg's work specifically rejects.

3. **Cross-references**:
   - Note any threshold or formula in Peleg's repo that PVL doesn't currently implement.
   - Note any threshold or formula in PVL that has no Peleg-repo basis.

**Acceptance**:
- Both docs exist with concrete file/line references.
- Every divergence flagged.
- Said reviews + greenlights before T2 implements any algorithmic change.

**Risk**: this is the slowest chunk because it requires reading Peleg's actual code. Said needs to grant Read permission on the directory.

---

## §3 — Sequencing + dispatch order

```
T5 (chunk D) ──┐
T1 (chunk A) ──┼──► T2 (chunk B) ──► T3 (chunk C) ──► land batch as one PR
               │                                       (or 3 sub-PRs)
T5 also feeds ─┘
```

- **T5 first**: produces the diagnostic docs T1/T2 rely on. Said reviews before any code lands.
- **T1 in parallel with T5**: copy + landing diagram changes don't need T5 outputs.
- **T2 next**: needs T5 done (so algorithm changes are evidence-based) + grants the data fields T3 will consume.
- **T3 last**: depends on T2's new fields.

**Estimated wall-clock**:
- T5: 4-6 hours of focused reading + writing.
- T1: 3-4 hours (copy sweep + landing diagram).
- T2: 6-8 hours (repo audit + backend changes + tests).
- T3: 8-10 hours (it's the biggest chunk — KPI redesign + correlation matrix + sequence-track rewrite + table reorder + ranking).

Total: ~3-4 days of focused work across the 4 terminals.

---

## §4 — Non-negotiables across all chunks

- **Single source of truth for residue colour**: fragment columns, with MAX_GAP=3 smoothing. Per-residue raw S4PRED class is *only* used for the AlphaFold structural-overlay tooltips, not for the primary visualization.
- **Single source of truth for SSW diff threshold**: dataset mean (or median per strategy). UI never displays a "default" value for batch mode without labelling it as fallback.
- **"% is a feature, not a class"** applies to every display surface (Peleg's hard rule).
- **Fibril formation, not aggregation**, applies to all user-facing copy.
- **Symmetry of treatment** — every place we show SSW, we show Helix; every place we show FF-SSW, we show FF-Helix.

---

## §5 — What this plan deliberately doesn't include

- **AI navigation assistant** (Task #73) — future, not pre-publish blocker.
- **5-surface ecosystem docs polish** — separate Wave 2.7 work.
- **Rename PVL** — needs naming brainstorm independent of the algorithm fixes.
- **Phase D6 round-3 redesign** — visual polish, post these scientific fixes.

These are all real but they sit *after* the scientific honesty fixes in this plan. Per Said's guidance: get the platform doing the job correctly first, publish, then polish.

---

## §6 — Said's manual gates before dispatch

Before sending any chunk to its terminal:

1. **Grant T2 + T5 Read permission** on `/Users/saidazaizah/Desktop/DESY/Expanding-_the_amyloid_landscape-main`. (T1 just hit "Operation not permitted" on this path.)
2. **Confirm sequencing** — T5 + T1 in parallel is the recommended kickoff, but if you want T1 to wait until you've reviewed T5's output, say so.
3. **Lock the §0 positioning sentence** — minor copy edits welcome, but the structural claim (*"PVL re-interprets TANGO + S4PRED through Ragonis-Bachar / Rayan thresholds for non-amyloid fibril formation"*) is what every downstream change derives from.
4. **Decide on KPI Total-Peptides placement** — sub-header line vs ribbon strip vs a small chip in the page title row. I default to a sub-header line above the 4-card row; flag if you'd prefer different.
