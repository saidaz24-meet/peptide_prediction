# Peleg Review — 2026-06-18 triage

> Source decks:
> - **PDF 1** — `260608_Peleg_notes_HomePage_QuickAnalysis.pptx` (24 pages, homepage + Quick Analyze flow). **Verified page-by-page 2026-06-18.**
> - **PDF 2** — `260615_Peleg_notes_Start_Analysis.pptx` (47 pages, Start Analysis / batch upload flow). Verified visually 2026-06-18.
>
> Each item below has: severity (P0/P1/P2/P3), owner, status, and reference to PDF/page.

**Legend**:
- **P0** — wrong science, wrong claim, or hard bug. Fix before next Peleg sync.
- **P1** — misleading UX, mislabel, or wrong default. Fix this wave.
- **P2** — polish, wording, layout drift.
- **P3** — opinion / nice-to-have.
- **OQ** — open question / needs clarification from Peleg before acting.

---

## Section A — Bugs (P0)

### A1. DELETE TANGO aggregation threshold input
- **Source**: PDF 1 page 16 (Peleg strikes through "TANGO aggregation threshold").
- **Why**: "We are not screening anything by that; we are only showing it as part of the analysis."
- **Change**: remove the slider from Quick Analyze AND Results threshold tuner. Internally we keep TANGO's `agg_threshold = 5.0` default.
- **Owner**: T2 (frontend) + T3 (backend normalize)
- **Files**: `ui/src/components/ThresholdTuner.tsx`, `ui/src/stores/thresholdStore.ts`, `backend/services/normalize.py`

### A2. Threshold input fields do not accept typed numbers — BUG
- **Source**: PDF 1 page 17.
- **Symptom**: only up/down arrows change the value; typing a number doesn't update state.
- **Owner**: T2
- **Files**: `ui/src/components/ui/input.tsx`, threshold-input component.

### A3. "Leave Anyway" from Quick Analyze lands on stale Start Analysis results — BUG
- **Source**: PDF 1 page 24.
- **Symptom**: Peleg analyzed Uperin-3.5; pressed "Leave anyway"; saw Phylloseptin-O2 (P84570) results from a previous batch run.
- **Root cause hypothesis**: `datasetStore` retains stale state; "Leave anyway" should navigate to `/` (home), not `/results`.
- **Owner**: T2
- **Files**: `ui/src/pages/Quick.tsx` leave dialog handler; verify `datasetStore.reset()` on Quick exit.

### A4. Hero tagline order — drop "aggregation"
- **Source**: PDF 1 page 3.
- **Current**: "Multi-algorithm prediction and visualization for peptide aggregation, structural switching, and fibril formation."
- **Fix**: "… for peptide secondary structure switching and fibril formation."
- **Why**: PVL does not predict aggregation as an endpoint; TANGO is an input to SSW + FF classification.
- **Owner**: T2
- **Files**: `ui/src/pages/Home.tsx` hero block.

### A5. Workflow diagram — "FF-Helix" → "Fibril-formation prediction" AND repositioning
- **Source**: PDF 1 page 8.
- **Changes**:
  1. Rename node label "FF-Helix" → "Fibril-formation prediction".
  2. Reposition: this node depends on S4PRED + TANGO, so it sits BELOW them (not parallel) and ABOVE "Rank & Merge".
  3. Clarify "Rank & Merge" — Peleg asks "what does the merge mean here?" Probably drop "Merge" or rename to "Rank".
- **Owner**: T2

### A6. Homepage example sequence — switch to Uperin 3.5
- **Source**: PDF 1 page 4 (homepage hero example), page 13 (Quick Analyze example chips).
- **Current**: 40-aa or 42-aa Amyloid-β.
- **Fix**: Uperin 3.5 (`GVGDLIRKAVSVIKNIV`, 17 aa) or Aurein 3.3.
- **Owner**: T2
- **Files**: `ui/src/pages/Home.tsx`, `ui/src/pages/Quick.tsx` (default prefill + example chips).

### A7. Delete "Amyloid-β(25-35)" example chip from Quick Analyze
- **Source**: PDF 1 page 13.
- **Why**: cross-beta amyloid is the exact opposite of what PVL is built for.
- **Fix**: drop the `Amyloid-β(25-35)` chip. Keep `LL-37`, `KLVFF` (or replace with Uperin/Aurein per A6).
- **Owner**: T2
- **Files**: `ui/src/pages/Quick.tsx` example chips array.

### A8. Delete "AlphaFold prediction structure" title
- **Source**: meeting notes 2026-06-18.
- **Why**: Mol* overlay shows the actual structure; the heading mis-claims AlphaFold ran for every peptide.
- **Owner**: T2
- **Files**: `ui/src/pages/PeptideDetail.tsx`.

### A9. Remove "comparison" wording from Quick Analyze
- **Source**: meeting notes 2026-06-18.
- **Why**: Quick Analyze is single-peptide. "Comparison" implies cohort behavior.
- **Owner**: T2

---

## Section H — Homepage copy (PDF 1 pages 5–11)

### H1. "How It Works" — drop "FF" shortcut, write full phrasing
- **Source**: PDF 1 page 5.
- **Change**: "Classify FF Candidates" → "Classify Fibril-formation candidates". This is the general/marketing page; no shortcuts.
- **Owner**: T2

### H2. "How It Works" — "classification sets" → "classification analysis"
- **Source**: PDF 1 page 5.
- **Owner**: T2

### H3. "How It Works" — Paste-or-Upload step copy
- **Source**: PDF 1 page 5.
- **Change**: "What does 'raw input only' mean? Not clear. Maybe just delete?" → drop the "raw input only" phrasing.
- **Owner**: T2

### H4. "How It Works" — Run Predictors step
- **Source**: PDF 1 page 5.
- **Changes**:
  1. Replace "Gets =" wording with "thresholds".
  2. Delete the parenthetical `(…)` listing specific threshold names — not needed at this overview level.
  3. Renumber: drop the 2a/2b sub-steps. Just step 2 (Run Predictors), then step 3 (Classify), then step 4 (Dashboard), then step 5 (Export).
- **Owner**: T2

### H5. Homepage feature card — Secondary Structure Prediction
- **Source**: PDF 1 page 6.
- **Current**: "S4PRED predicts helix, beta-sheet, and coil conformation at every residue…"
- **Fix**: "Utilizing S4PRED, Tango and internal threshold to determine secondary structure."
- **Owner**: T2

### H6. "Analyze Peptide Datasets at Scale" subtitle rewrite
- **Source**: PDF 1 page 7.
- **Current**: "Upload hundreds of peptides via CSV. Every sequence gets the full prediction workflow — secondary structure, aggregation scoring, fibril-forming helix detection — ranked and ready to filter."
- **Fix**: "Upload hundreds of peptides via CSV. Every sequence receives the full workflow: secondary structure prediction, biochemical calculations, and fibril formation potential, with thresholds determined according to the given database."
- **Owner**: T2

### H7. "The Prediction Workflow" tab — surface PVL's states, not S4PRED's
- **Source**: PDF 1 page 9.
- **Change A**: title says "four algorithms" but body text only mentions S4PRED. Add brief Tango sentence + a fibril-formation sentence: "Fibril formation potential calculated by integrating the secondary structure prediction and hydrophobicity and hydrophobic moment."
- **Change B**: replace the H/E/C 3-state bullet ("Three-state prediction: helix (H), sheet (E), coil (C)") with PVL's 4 output states:
  - **Helix**
  - **Secondary structure switch (SSW)**
  - **Fibril-forming helix (FF-Helix)**
  - **Fibril-forming secondary structure switch (FF-SSW)**
- **Why**: "we don't need to advertise S4PRED's states; show OUR tool's outputs."
- **Owner**: T2

### H8. "Built for Researchers" testimonial rewrite
- **Source**: PDF 1 page 10.
- **Current**: "PVL replaced three separate tools in our peptide aggregation workflow…"
- **Peleg's challenge**: "Which three tools?" — vague.
- **Fix**: emphasize PVL's actual differentiation:
  - (a) Secondary structure switch prediction (no other tool does this).
  - (b) Fibril-formation potential for non-beta structures.
  - (c) Extensive database analysis + visualization under one roof.
- **Owner**: T2 (Peleg may want to draft the final wording).

### H9. Screenshot mosaic — strip personal browser tabs
- **Source**: PDF 1 page 11.
- **Issue**: hero screenshots show Said's personal browser tabs.
- **Fix**: retake screenshots in a clean Chrome profile.
- **Owner**: Said.

---

## Section Q — Quick Analyze (PDF 1 pages 12–24)

### Q1. Drop "Amyloid-beta" placeholder from Name (optional) field
- **Source**: PDF 1 page 13.
- **Fix**: use Uperin-3.5 as placeholder.
- **Owner**: T2

### Q2. Threshold tooltips — add explanatory direction + range
- **Source**: PDF 1 page 14.
- **Pattern**: every threshold tooltip ends with "To make [outcome] more strict, this number should be closer to [X]. Value range [A]-[B]."
- **Examples Peleg called out**:
  - "Minimal S4PRED helix score" → "To make secondary structure prediction more strict, this number should be closer to 1. Value range 0-1."
  - "Minimal % helix content" → "To make secondary structure prediction more strict, this number should be closer to 100. Value range 0-100."
- **Owner**: T2

### Q3. SSW threshold tooltips — note batch-mode auto-tuning
- **Source**: PDF 1 page 15.
- **Add to tooltips for**: "S4PRED maximum helix and beta difference" + "TANGO maximum helix and beta difference".
- **Text**: "Note: In batch mode, this value is determined automatically according to the input database."
- **Owner**: T2

### Q4. Rename label "µH (Hydrophobic moment)" → "Hydrophobic moment (µH)"
- **Source**: PDF 1 page 16.
- **Owner**: T2

### Q5. Add Fauchère-Pliska 1983 citation to µH + Hydrophobicity tooltips
- **Source**: PDF 1 page 16.
- **Text**: "Hydrophobic parameters by Fauchère, J., and Pliska, V. 1983."
- **Owner**: T2

### Q6. Quick Analyze results — add 4-class KPI strip above the sequence
- **Source**: PDF 1 page 18.
- **Strip contents** (mirroring batch Results dashboard):
  - % Helix
  - % FF-Helix
  - % SSW
  - % FF-SSW
- **For a single peptide**: each KPI shows boolean + sub-label (e.g. "Helix ✓ — S4PRED helix segment detected", "FF-Helix ✗ — µH below threshold"). N/A for fields not applicable.
- **Owner**: T2
- **Files**: `ui/src/pages/Quick.tsx` results area, new `QuickKpiStrip` component.

### Q7. Sequence residue coloring — Helix / SSW / Coil (pipeline-derived)
- **Source**: PDF 1 pages 2, 19.
- **Change**: replace S4PRED H/E/C raw coloring with pipeline-derived 3-class:
  - **Helix** — S4PRED H
  - **SSW** — positions in switch (TANGO β-agg AND S4PRED H)
  - **Coil** — everything else
- **Peleg typo**: she wrote "Colid-coil"; this is a typo for "Coiled-coil". **OQ**: scientifically a "coil" (irregular C-state) is NOT a "coiled-coil" (two-helix motif). Need to confirm: is she using "coiled-coil" loosely, or asking us to predict coiled-coil motifs? — **flag for next Peleg sync**.
- **Owner**: T2 + Peleg confirm OQ.

### Q8. Residue hover tooltip — add TANGO propensity row if feasible
- **Source**: PDF 1 page 19.
- **Current hover**: `I (Helix) pos 6 ic 0.977 0.001 0.022 P(H) P(E) P(C)` (S4PRED row only).
- **Add**: second row with TANGO Helix / Beta / Coil / Aggregation propensities.
- **If implemented**: update the "values extracted from the pipeline (not directly from S4PRED or TANGO)" disclaimer to also mention TANGO.
- **Owner**: T2

### Q9. Per-tool result strip between sequence and biochem block
- **Source**: PDF 1 page 20.
- **Add**: "the same as you show in other type of analysis, with colors for each result of each tool" — a row of color-coded result chips from each tool (S4PRED state, TANGO state, FF-Helix flag, SSW flag).
- **Owner**: T2

### Q10. Biochemical feature comparison — drop S4PRED helix %
- **Source**: PDF 1 page 20.
- **Why**: "S4PRED% helix is not a biochemical trait."
- **Fix**: remove that KPI from the biochem block; keep Hydrophobicity, µH, Charge.
- **Owner**: T2

### Q11. Biochemical comparison — clickable database targets
- **Source**: PDF 1 page 20 + meeting notes.
- **Current**: "Biochemical feature comparison — How this peptide compares to the database" (single implicit database).
- **Fix**: move the comparison title up, bold; add clickable tabs/chips below it:
  - **UniProt short peptides**
  - **Fibril-forming short peptides** (Peleg-118 dataset)
- **Click action**: comparison panel below updates to show the selected database's distribution.
- **Owner**: T2 + T3 (backend reference distributions endpoint).

### Q12. TANGO panel — title + structure rewrite
- **Source**: PDF 1 page 21.
- **Changes**:
  1. Title: "TANGO Aggregation Profile" → "Tango Secondary Structure and Aggregation Probabilities".
  2. Subtitle: "Per-residue helix (H), beta (E), Coil (C), and aggregation probabilities from Tango prediction. Higher scores indicate regions with better propensity."
  3. Order: secondary structure plot FIRST, aggregation plot SECOND (currently aggregation is on top).
  4. Y-axis: extend to 0-100. "Up to 1 is very bad" — the current 0-1 scale exaggerates low scores.
- **Owner**: T2
- **Files**: `ui/src/components/TangoProfile.tsx`.

### Q13. TANGO secondary structure plot — match S4PRED line-graph style
- **Source**: PDF 1 pages 21, 22.
- **Target**: line graph with three series P(Helix) blue, P(Beta) orange, P(Coil) dashed, x = residue position, y = probability, matching `S4PREDSecondaryStructureProbabilities` component style.
- **Owner**: T2

### Q14. Aggregation–Structure Overlay — unify hide/show toggles
- **Source**: PDF 1 page 23.
- **Issue**: hide/show controls for the two plots are inconsistent.
- **Fix**: either single row of toggles above both plots, OR per-plot toggles directly under each plot title.
- **Owner**: T2

### Q15. Aggregation–Structure Overlay — label the y=0.5 dashed line
- **Source**: PDF 1 page 23.
- **Add**: legend or label explaining what the dotted reference line at y=0.5 represents (likely the TANGO 5% / 0.05 threshold? — confirm with Peleg).
- **Owner**: T2 + OQ for Peleg.

### Q16. Aggregation–Structure Overlay — add TANGO Helix series
- **Source**: PDF 1 page 23.
- **Issue**: currently shows only Aggregation + TANGO Beta. Add TANGO Helix series too for parity.
- **Owner**: T2

### Q17. Aggregation–Structure Overlay — distinct aggregation color
- **Source**: PDF 1 page 23.
- **Rule**: beta is consistently orange across PVL → pick a different color for the aggregation series.
- **Suggestion**: red or magenta.
- **Owner**: T2 + Peleg sign-off.

### Q18. "Back to Batch results" — fix capitalization
- **Source**: PDF 1 page 24.
- **Fix**: "Back to Batch results" → "Back to batch results" (lowercase b).
- **Owner**: T2

### Q19. "Leave Quick Analyze?" dialog wording
- **Source**: PDF 1 page 24.
- **Current**: "Your prediction results will be lost. This analysis hasn't been saved to a dataset."
- **Peleg**: "What does 'this analysis hasn't been saved to a dataset' mean??" — confusing.
- **Fix**: drop the second sentence; "Your prediction results will be lost. Are you sure?"
- **Owner**: T2

---

## Section B — Start Analysis / batch upload (PDF 2)

### B1. Upload dropzone — label all 4 formats
- **Source**: PDF 2.
- **Current**: "CSV/TSV".
- **Fix**: "CSV · TSV · XLSX · FASTA".
- **Owner**: T2

### B2. Sample dataset chip — peptide-domain examples
- **Source**: PDF 2.
- **Fix**: replace generic sample CSV with Peleg-118 / Uperin frog AMPs.
- **Owner**: T2

### B3. Column auto-detection — case-insensitive sequence-column heuristic
- **Source**: PDF 2.
- **Fix**: match "peptide", "Sequence", "seq" automatically; prompt only on no-match.
- **Owner**: T3 + T2

### B4. XLSX header-row skip — handle Peleg's 118-peptide sheet
- **Source**: PDF 2.
- **Fix**: backend XLSX loader skips row 1 if its first cell is non-sequence text.
- **Owner**: T3
- **Files**: `backend/services/dataframe_utils.py`.

### B5. Length filter default — [4, 40] aa
- **Source**: PDF 2.
- **Owner**: T2

### B6. Length warning — > 80 aa
- **Source**: PDF 2.
- **Owner**: T2

### B7. Progressive results loading (SSE stream)
- **Source**: PDF 2 + meeting notes M3/M4.
- **Owner**: T3 (SSE endpoint) + T2 (streaming hook).
- **Files**: `backend/api/routes/predict.py`, new `ui/src/lib/streamPredict.ts`.

### B8. Batch progress bar — % + ETA
- **Source**: PDF 2.
- **Owner**: T2

### B9. Failed-peptide UI — separate "TANGO failed", "S4PRED failed", "skipped"
- **Source**: PDF 2.
- **Owner**: T2

### B10. Default sort — FF-Helix flag, then µH descending
- **Source**: PDF 2.
- **Owner**: T2
- **Files**: `ui/src/pages/Results.tsx`, `ui/src/lib/ranking.ts`.

### B11. KPI cards — hover-help for acronyms
- **Source**: PDF 2.
- **Owner**: T2

### B12. Venn diagram — counts inside each region
- **Source**: PDF 2.
- **Owner**: T2

### B13. Venn diagram — click region → filter table
- **Source**: PDF 2.
- **Owner**: T2 + chartSelectionStore wiring.

### B14. Threshold tuner — preset chips ("Peleg default", "Strict", "Lenient")
- **Source**: PDF 2.
- **Owner**: T2

### B15. Export — include thresholds + PVL version in CSV
- **Source**: PDF 2.
- **Owner**: T3

### B16. Mol* 3D viewer — SSW residue coloring parallel to Helix
- **Source**: PDF 2 + meeting notes.
- **Proposed color**: amber (Peleg sign-off).
- **Owner**: T2
- **Files**: `ui/src/components/Mol3DViewer.tsx`.

### B17. Sliding-window profile — add SSW track
- **Source**: PDF 2.
- **Owner**: T2

### B18. Correlation matrix — across-peptide only
- **Source**: PDF 2.
- **Owner**: T2

### B19. Cohort comparison — paired t-test annotation
- **Source**: PDF 2.
- **Owner**: T3 (compute) + T2 (display).

### B20. Cohort comparison — Peleg-118 built-in
- **Source**: PDF 2.
- **Owner**: T2

---

## Section D — Wording + copy (P2)

### D1. Quick Analyze subtitle
- "Single sequence. Full prediction profile in seconds."

### D2. Start Analysis subtitle
- "Batch upload. CSV, XLSX, or FASTA. Up to 5,000 peptides per run."

### D3. Help — "What is SSW?" plain-language section (Peleg drafts)

### D4. Help — "Why no aggregation class?" (Peleg drafts)

### D5. Footer credits — verify wording per `memory/feedback_credits_roles.md`

### D6. README — link the Peleg-118 dataset

---

## Section E — Provenance / citations (P1)

### E1. Cite Hamodrakas 2007 for FF-Helix (paper + Help + tooltip)
### E2. Cite Fauchère-Pliska 1983 for hydrophobicity (Q5 above + Help)
### E3. Cite Eisenberg for µH
### E4. Display "Method = TANGO + S4PRED + FF-Helix" in export header

---

## Section OQ — Open questions for next Peleg sync

| ID | Question | Source |
|----|----------|--------|
| OQ1 | "Colid-coil" — typo for "Coiled-coil"? If so, do we mean 3-state coil (irregular) or coiled-coil motif (two-helix wrap)? | PDF 1 p2, p19 |
| OQ2 | "Rank & Merge" → "Rank"? What does "Merge" mean to the user? | PDF 1 p8 |
| OQ3 | Aggregation series color preference (red / magenta / other)? | PDF 1 p23 |
| OQ4 | What does the y=0.5 dashed line in Aggregation-Structure Overlay represent? | PDF 1 p23 |
| OQ5 | SSW residue color in Mol* 3D viewer (amber / other)? | meeting + PDF 2 |
| OQ6 | "Hide-show options should be unified" — single row above both plots, or per-plot under title? | PDF 1 p23 |
| OQ7 | F10 — Beta % calculation flagged as "too aggressive" in 2026-05-19 Likoiim review. Algorithm change requires scientific sign-off. What's the desired threshold? | Wave 2.5 |
| OQ8 | A8 — "AlphaFold-predicted structure" title was approved 2026-06-03 Drive comment 17. 2026-06-18 meeting note says delete. Which is current? | PDF 1 + meeting |

---

## Section F (Wave 2.5 fix-pack from Likoiim PowerPoint) — landed 2026-06-22

Items I'd missed in the original triage. Surfaced by 2026-06-23 doc audit.

| ID | Item | Status | Commit / Note |
|----|------|--------|---------------|
| F1 | "cohort" → "database" terminology scan | ✅ shipped | `d122fe0` — PeptideViewer tooltips + About credit (rest were already migrated) |
| F2 | "Cutoff" suffix on µH + Hydrophobicity threshold labels | ✅ shipped | `d122fe0` — ThresholdConfigPanel + ActiveThresholdsPanel |
| F3 | TANGO Y-axis remove "%" suffix | ✅ already done | ResultsCharts comment 2026-05-19; AggregationHeatmap uses bare "TANGO score" |
| F4 | Y-axis titles on distribution charts | ✅ shipped | `35d45e1` — Compare-page overlay histograms got "Number of peptides" |
| F5 | Aggregation Propensity lollipop → histogram | ✅ already done | ResultsCharts L271 — re-styled 2026-05-19 |
| F6 | Venn FF-SSW positioning verification | ✅ already done | SetDiagram L453 — 2026-05-19 layout fix |
| F7 | "Above median" badge gold → green | ✅ already done | BiochemComparison L113 — FIX-016 |
| F8 | Purple collision TANGO vs SSW pill | ✅ already done | 2026-05-21 decision: SSW=blue (`--ssw: 211 80% 50%`), TANGO:OK=`--primary` purple |
| F9 | Sequence length warning simplification | ✅ shipped | `35d45e1` — bulleted, bold counts |
| F10 | Beta % calculation "too aggressive" | ⏸ Peleg sync | OQ7 above. Scientific algorithm question. |
| F11 | "% mean" ambiguity in Smart Ranking | ✅ shipped | `d122fe0` — RankedTable column headers get "(pctile)" suffix + tooltip |

---

## Section R (ROADMAP audit, items not in my prior triage)

Items from `docs/active/ROADMAP.md` cross-checked 2026-06-23.

| ID | Item | Status |
|----|------|--------|
| B-CONTRACT | Pydantic `extra="forbid"` on every request schema | ✅ done — every Request class in `backend/schemas/` already has it |
| B-COMPLEX-SEQ | Complex sequence notation (multi-chain, linker, dashes) | ⏸ deferred to v0.2; needs Alex's lab-convention survey |
| B-S4PRED-CAP | S4PRED length cap with clear error | ✅ done — cap = 40 aa (`S4PRED_MAX_LENGTH`), banner shipped in B9 |
| B11 | FASTA upload support | ✅ done — `parse_fasta` + dropzone accept `.fasta` + `.fa` |
| B12 | Upload guidance & limits | 🟡 partial — 5,000-peptide line shipped (D2); "How to export from UniProt" tooltip pending |
| B13 | 2D backbone visualization (atom2svg) | ⏸ Alex request 2026-03-28, parked v0.2+ |
| B14 (dual) | Cohort Comparison dual upload | ⏸ Alex request, parked v0.2 |
| B14 (tools) | "Tools" sidebar tab | ⏸ Alex request, parked v0.2 |
| B15 | Large dataset support (>500 entries) | 🟡 partial — nginx body-size + B9 progress bar shipped; B-1 async queue still v0.2 |
| B16 | Load testing infra (locust / k6) | ⏸ Alex request, parked v0.2 |

---

## Tally (revised 2026-06-23)

| Section | Total | Done | Open | Blocked |
|---------|-------|------|------|---------|
| A — bugs / critical | 9 | 7 | 0 | 2 (A8, A9 superseded) |
| H — homepage copy | 9 | 8 | 0 | 1 (H9 manual screenshots) |
| Q — Quick Analyze | 19 | 13 | 3 | 3 (Q7/Q15 OQ, Q11 Cowork) |
| B — batch / Start Analysis | 20 | 13 | 4 | 3 (B7/B16/B20 Cowork) |
| D — wording | 6 | 6 | 0 | 0 |
| E — provenance | 4 | 3 | 1 | 0 (E4 T3) |
| F — Wave 2.5 fix-pack | 11 | 10 | 0 | 1 (F10 OQ) |
| R — ROADMAP cross-check | 10 | 4 | 0 | 6 (parked v0.2) |
| OQ — open questions | 8 | 0 | 0 | 8 (pending Peleg) |

**Total open across all categories**: 8 items in active flight + 14 blocked / parked.
**Shipped this wave**: 64 items.

---

## Next step

1. Schedule Peleg Zoom to clear OQ1–OQ8.
2. Cowork to ship Q7, Q11, Q13–Q17, B7, B16, B20.
3. Said to open GitHub Issues from this doc and tag with the wave.
4. T3 to ship E4 export header.
5. After Peleg sync — close OQ1–OQ8 and revisit any P3 items still showing red on the live VPS.
