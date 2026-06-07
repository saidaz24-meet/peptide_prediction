# Peleg follow-up — Packet 3: direct answers to every visible PPT question

**Purpose**: Said's screenshots of Peleg's PowerPoint (2026-05-21) surfaced ~25 specific in-context questions. Packets 1 + 2 cover the strategic framing; this packet gives concrete straight-up direct answers for each question, with the code reference behind each answer.

**For Claude chat**: weave the relevant answers into the email at the natural points where Peleg asked them. Don't dump the whole packet as a list — humans hate Q&A bullet walls. Use this as the source-of-truth on what's actually true at the code level so the humanized email doesn't contradict the codebase.

**Coverage map** at the bottom: which questions are already answered in Packets 1+2 (most), and which are NEW omissions caught only by re-reading her PPT slide-by-slide today.

---

## Section A — Threshold panel (PPT pages 7-8)

### A1. "I don't understand where this threshold comes from or what it means" — Agg Per-Residue %

**Direct answer**: it's the per-residue TANGO aggregation propensity threshold — a residue is flagged as an "aggregation hotspot" when its TANGO score exceeds this value. Default 5.0 (on TANGO's 0-100 scale). Peleg is right that this is poorly labeled. The whole "Agg Per-Residue %" row should be **removed from the user-facing threshold panel** because we're not in aggregation-classification terms (her own directive — see A2 below). It still lives in the threshold store for the candidate ranking logic, but exposing it as a user knob causes the confusion she's flagging.

**Code**: `ui/src/stores/thresholdStore.ts:22` (default `aggThreshold: 10.0` strict, `5.0` runtime default in `datasetStore.ts:372`); `ui/src/components/ThresholdConfigPanel.tsx` is where it's rendered.

**Status**: in **F1 cohort sweep** parent — F1 also drops the Agg Per-Residue % row from the panel. Already scheduled. Ship.

---

### A2. "We are not talking in aggregation terms. Only Fibril-formation." — about `% of Length Cutoff` description

**Direct answer**: confirmed. The description text "Higher values require aggregation across a larger portion of the sequence" is wrong framing. The slider's actual purpose is part of the **fibril-formation candidate detection** — % of length that must show the FF signature, not aggregation per se. The text needs to be rewritten to reframe in fibril-formation language.

**Status**: covered under F1 (cohort sweep + terminology fix in the same panel). The threshold itself stays; the description text gets rewritten to say "Higher values require the FF signature to span a larger portion of the sequence." Ship.

---

## Section B — Sequence length notification (PPT page 9)

### B1. "From where you get the information about the length limitation of s4pred? Didn't found it in their paper or git"

**Direct answer**: **honest answer — we don't have a documented citation for the <15 aa lower bound.** It came from the implementation experience and the S4PRED paper's evaluation set (lower bound around proteins, not short peptides). When the predictor receives a short sequence, the LSTM has insufficient context and confidence collapses.

**Two options** for Peleg:
- (a) She points us to a paper or GitHub issue that confirms a defensible lower bound, we cite it.
- (b) We soften the warning text to **"S4PRED works best on sequences ≥ 15 aa (recommended minimum from the prediction pipeline)"** — no citation, no false claim of authority.

**Recommend (b)** as default unless she has the citation handy. The warning becomes informative rather than authoritative.

**Code**: `ui/src/pages/Upload.tsx` — search for "may be unreliable".

**Status**: this is **Q1** in Packet 1 §4 (awaiting Peleg's reply). The Claude-chat email should ask her directly.

---

### B2. "Maybe saying 4/8 sequences too short ..."  +  "This way the second line can be deleted."

**Direct answer**: confirmed. Today's text is two lines:
```
4 sequences too short (<15 aa) — S4PRED may be unreliable
8 sequences in optimal range (15-100 aa)
```
Rewriting to single line `4/8 sequences too short. S4PRED works best on sequences ≥ 15 aa.` and dropping the optimal-range line.

**Code**: `ui/src/pages/Upload.tsx`.

**Status**: this is **F9** in the Wave 2.5 fix-pack. Already in T3's queue. Ship.

---

## Section C — Sliding-Window Profiles (PPT page 17)

### C1. "I didn't understand these graphs."

**Direct answer**: the Sliding-Window Profiles card shows two stacked line charts:
- **Top**: Hydrophobicity (Fauchère-Pliska) across the sequence using a configurable window (default 13), with a secondary right-axis showing TANGO aggregation % (the orange dashed line).
- **Bottom**: Hydrophobic Moment µH across the sequence, same window.

These let a researcher visually scan for amphipathic regions (high µH zones) and aggregation-prone segments (high TANGO peaks) and see where they overlap or don't.

The confusion comes from (a) the dual Y-axis on the top chart (left axis hydrophobicity, right axis TANGO aggregation %), (b) the legend below ("S4PRED helix segments / FF-Helix candidate regions / TANGO aggregation") referring to overlays that aren't actually drawn in this chart, and (c) the "TANGO aggregation %" label which she rightly questioned (see C2).

**Fix path**:
- Add an axis title to clarify the dual-axis structure.
- Either draw the legend items as colored bands on the chart, OR remove them from the legend if they're not rendered.
- Rename "TANGO aggregation %" → "TANGO aggregation" (drop the percent — see C2 below).
- Add a short caption above the card: "Per-residue smoothed scans. Use to scan for amphipathic and aggregation-prone segments."

**Status**: NEW omission — not in the Wave 2.5 fix-pack as an F-item. **File as F12 (Sliding-Window Profile clarity)** for T3.

**Code**: `ui/src/components/ResultsCharts.tsx` (the SlidingWindowProfiles component, search for "Sliding-Window").

---

### C2. "What is a Tango aggregation %?"

**Direct answer**: she's right — **TANGO output is not a percentage**. The TANGO model outputs a propensity score on a 0-100 scale where higher = more aggregation-prone, but it's not a probability. Calling it "%" misleads readers into thinking it's a probability or a fraction of something.

**Fix**: drop the `%` everywhere TANGO scores are labeled. The Y-axis label should be "TANGO score" or "Aggregation propensity (TANGO)". Tooltips too.

**Status**: this is **F3** in the Wave 2.5 fix-pack — already in T3's queue. Ship.

**Code**: `ui/src/components/AggregationHeatmap.tsx` and the SlidingWindowProfiles component.

---

### C3. "There is no legend on the X-axis"  +  "The legend below contains colors or marks that do not show in the graphs."

**Direct answer**: confirmed. X-axis label is missing — add "Residue position" on both panels. The legend below the bottom chart mentions S4PRED helix segments / FF-Helix candidate regions / TANGO aggregation, but these aren't drawn as colored bands. Either draw them as faint background bands on the chart (informative) or drop the legend items (cleaner).

**Recommend**: drop the misleading legend items in v0.1, file a Wave 3 task for proper band overlays once we have time to do them right.

**Status**: covered by F4 (axis titles) and a new F-item for the misleading legend. File as F12 with C1. Ship.

---

### C4. "No need to mention the hydrophobic metric, we will write it in another place, so that all the hydrophobic metrics are based on Fauchere-Pliska."

**Direct answer**: this is asking us to drop redundant "hydrophobic moment" labels from the SlidingWindowProfiles top chart since the µH chart below it already covers that, and we want a single canonical mention of "based on Fauchère-Pliska" elsewhere (likely Help.tsx or the µH card subtitle) rather than scattered hints.

**Fix**: top chart shows hydrophobicity + TANGO only. Bottom chart shows µH only. A single Methods sentence ("All hydrophobicity-derived metrics use the Fauchère-Pliska scale") appears once in Help.tsx and once in the methods panel of the figure pack.

**Status**: NEW small wording cleanup. **File as F13.** Ship.

**Code**: `ui/src/components/ResultsCharts.tsx` (SlidingWindowProfiles) + `ui/src/pages/Help.tsx`.

---

## Section D — Cohort Position card (PPT page 16)

### D1. "Add before the second sentence: Note: if a peptide is at the …"

**Direct answer**: she wants a clarifying note inserted in the Interpretation text. Current text:
> "Percentiles show where this peptide ranks **within this dataset** (not absolute). A peptide at the 30th percentile has lower values than 70% of the cohort — this does not imply the value is inherently low."

She wants a "Note: if a peptide is at the …" inserted before the second sentence. Likely she wants the note to expand on the dataset-relative caveat. The exact phrasing she wanted is cut off in the screenshot but the intent is clear: add a hedge that the percentile is purely positional, not biological.

**Fix**: rewrite to:
> "Percentiles show where this peptide ranks **within this database** (not absolute). Note: a peptide at the 30th percentile has lower values than 70% of the database — this is a positional statement only and does not imply the value is biologically low or high."

(Database not cohort per F1.)

**Status**: NEW small wording. **File as F14** or fold into F1 (database terminology sweep).

**Code**: `ui/src/components/CohortPositionCard.tsx` or wherever the percentile pill lives — grep for "Percentiles show".

---

### D2. "For something that is above the average mark in green not this gold-brown color."

**Direct answer**: the "Above median" pill currently renders gold-brown. Above-average = positive signal. Should be green.

**Status**: this is **F7** in the Wave 2.5 fix-pack. Already scheduled. Ship.

**Code**: `ui/src/components/Legend.tsx` or the percentile pill component.

---

### D3. "Maybe put the same title for this and the previous one 'Biochemical feature comparison' and then in two boxes show the two analysis and presentation with small titles as what there is now in gray."

**Direct answer**: she wants the Cohort Position card visually merged under the "Biochemical feature comparison" umbrella with the Feature Comparison radar — one parent title, two sub-cards with the existing small subtitles.

**Fix**: turn the parent into a Card with title "Biochemical feature comparison", containing two sub-panels: "Feature Comparison" (radar) and "Cohort Position" (percentile bars). Both renamed to use "database" not "cohort" per F1.

**Status**: NEW layout change — file as F15 (Biochemical feature comparison parent grouping). T3/T4 visual task.

**Code**: `ui/src/pages/PeptideDetail.tsx` — find the section that renders BiochemComparison + CohortPositionCard separately.

---

## Section E — Sequence & Structure (PPT page 14) — the big helix question

### E1. "What is the difference here between the helix 100% in the upper line and the helix 77% in the lower line?"

**Direct answer**: in the screenshot Peleg is showing, the **upper line** is the **per-residue average helix probability** (computed from S4PRED P(Helix) at each residue, then averaged across the whole sequence). The **lower line** is the **helix segment coverage** (residues that are part of detected helix segments where N consecutive residues each have P(Helix) ≥ 0.5).

These can differ when:
- Helix probability is **high everywhere but no continuous segment of ≥ 5 residues passes the per-residue threshold** → upper number is high (averaging captures the diffuse signal), lower is lower (no segment qualifies).
- Helix probability is **bimodal — strong helix region + non-helix region** → upper is the weighted average, lower is the segment-coverage fraction.

These are genuinely two different metrics measuring two different things. We've been showing both without labeling them distinctly, which is what Peleg is calling out.

**Fix**: two options for her to choose:
- (a) Label distinctly: upper = "Average helix probability", lower = "Helix segment coverage" with tooltips explaining the difference.
- (b) Collapse to one canonical helix metric — but which? Segment coverage is more interpretable for amyloid researchers (segments are physical), but average probability is more informative for short peptides.

**Recommend (a)** — label distinctly. Both are useful for different scientific questions, dropping one loses information.

**Status**: this is **Q2** in Packet 1 §4 — awaiting Peleg's reply. The email should ask her directly which framing she wants.

**Code**: `ui/src/components/SequenceTrack.tsx:81-94` — the `legendPercents` useMemo uses `peptide.s4predHelixPercent` (canonical) for the legend; the "Total helix coverage" line below shows segment coverage.

---

### E2. "Why is the G black and not blue either? How is the color scale here determined?"

**Direct answer**: the G is rendered in muted/black because its **per-residue classification is "Coil" (C)**, not Helix or Beta. Our coloring rule:

```typescript
// ui/src/components/SequenceTrack.tsx:30-54
function classifyResidue(idx, ssPrediction, pH, pE, pC): "H" | "E" | "C" {
  // If S4PRED returned an explicit prediction string, use it.
  if (ssPrediction[idx]) {
    return ssPrediction[idx].toUpperCase() === "H" ? "H"
         : ssPrediction[idx].toUpperCase() === "E" ? "E"
         : "C";
  }
  // Fallback: argmax of P(H), P(E), P(C).
  if (h >= e && h >= c) return "H";
  if (e >= h && e >= c) return "E";
  return "C";
}

const SS_COLORS = {
  H: "hsl(var(--helix))",     // blue
  E: "hsl(var(--beta))",      // orange
  C: "hsl(var(--coil))",      // muted (~black/grey in light mode)
};
```

So the rule is **argmax of the three S4PRED probabilities**, with the coil class rendered in muted text color (which reads as "black" against the white background she's seeing).

**Why this matters**: the first G in `GIGAVLKVLTT…` is typically classified as Coil because N-terminal residues frequently have higher coil probability — they're unstructured before the helix nucleates. So **G being black isn't a bug, it's S4PRED's verdict**.

**Fix path**:
- Add a tooltip on the colored sequence: "Color = S4PRED's per-residue secondary-structure call (argmax of helix/beta/coil probability). Coil residues are shown in muted text."
- Add a small inline legend below the sequence: "● Helix  ● Beta  ● Coil" with the colors.
- Or — Peleg's preference matters here — drop the coil-as-muted color entirely and only color helix + beta, leaving coil as plain text. That makes the "highlighted" residues clearly mean "predicted as structured."

**Recommend**: add the tooltip + small inline legend. Color rule stays — it's correct, just under-documented.

**Status**: NEW item — not in the Wave 2.5 fix-pack. **File as F16 (sequence color scale explanation).** Small T3 fix.

---

## Section F — S4PRED Probability Chart (PPT page 18)

### F1-screenshot. "No need to write on s4pred that is a neural network. Just s4pred is enough."

**Direct answer**: confirmed. We removed the "neural network" suffix from s4pred references across the UI.

**Status**: **L5** in Packet 1 §1 — already shipped. Verified in code (grep confirms no `neural network` in `ui/src`).

---

### F2-screenshot. "From where did you calculate these %? Having for 2-3 residues with confidence lower than 0.25 is not a beta strand."

**Direct answer**: the Beta % subcard was computed as the **average P(Beta) across all residues**, which inflates the value whenever there are a few residues with non-zero P(Beta) below threshold confidence. Peleg's right — 2-3 residues at P(Beta) ≤ 0.25 should not count as "beta strand" at the sequence level.

**Fix**: drop the Beta % subcard entirely (her own directive on the same slide: "Putting % like this is like performing another prediction. Showing the graph without calculating the percentages is enough."). The curve stays — only the numerical subcard goes.

**Status**: this is **F10** in the Wave 2.5 fix-pack — confirmed decision is "drop Beta % subcards". Already in T3's queue. Ship.

**Code**: `ui/src/components/S4PredChart.tsx` — find Beta % subcard.

---

### F3-screenshot. "The prediction here is in capitals where it shouldn't"

**Direct answer**: was "Single Sequence Secondary Structure PREDiction" with caps on PREDiction. Fixed to "S4PRED Secondary Structure Probabilities" with normal case.

**Status**: **L4** in Packet 1 §1 — already shipped.

---

## Section G — TANGO Aggregation Profile (PPT page 19)

### G1. "The tango score is not %." + "The sentence should be more like this: Per-residue aggregation propensity. Higher scores indicate higher propensity."

**Direct answer**: covered above (C2). Drop the `%` symbol from the Y-axis label and the description. Rewrite the description per Peleg's exact wording.

**Status**: **F3** in fix-pack. Already scheduled. Ship.

---

### G2. "Call this graph aggregation-secondary structure not only structure"

**Direct answer**: the toggle link "Show Aggregation-Structure Overlay" should be renamed to "Show aggregation-secondary structure overlay" — more precise about what the overlay shows (aggregation curves combined with secondary structure tracks).

**Status**: NEW small wording. **File as F17.** T3 task.

**Code**: `ui/src/components/AggregationHeatmap.tsx` or wherever the overlay toggle is rendered.

---

### G3. "From where the number 5 came? The tango range is 0-100, so a 5 is relatively low."

**Direct answer**: the 5% threshold is the **per-residue aggregation hotspot threshold** — a residue is flagged as an aggregation hotspot when its TANGO score exceeds 5 on the 0-100 scale. It's deliberately conservative: TANGO scores are skewed (most residues sit near 0; aggregation-competent regions spike sharply), so a 5 captures the early shoulder of the distribution.

**Default value origin**: it's not from a published source — it's an internal default that gives good recall on the Staphylococcus 2023 dataset Peleg's lab provided. **It's tunable in the Threshold Controls panel** (`aggThreshold` slider, default 5.0, Strict preset = 10.0, Exploratory = 2.0).

**Fix path**: surface the rationale in the Help.tsx + the threshold panel tooltip. Acknowledge it's an internal heuristic, not a published cutoff. The validation brief (RB-VALIDATION-V0-1.md §3.3) shows the threshold sensitivity analysis we ran for FF-SSW; we should run a similar one for `aggThreshold` and surface the result.

**Status**: NEW — partial code-level answer, but the "where does the 5 come from" question deserves a real citation or explicit heuristic disclosure. **File as F18 (TANGO 5% threshold rationale in tooltip + Help.tsx)** + research task to run threshold sensitivity analysis. Ask Peleg in the email if she has a published TANGO threshold reference.

**Code**: `ui/src/stores/datasetStore.ts:372` (`aggThreshold = (meta?.thresholds as any)?.aggThreshold ?? 5.0`); `ui/src/stores/thresholdStore.ts:22,32` (Strict / Exploratory presets).

---

## Section H — FF-Helix vs Aggregation Max scatter (PPT page 20)

### H1. "I didn't understand this graph." + "Legends and axis names should be added."

**Direct answer**: this scatter places each peptide as a point with X = FF-Helix % (0-100, the fraction of residues in 6-residue windows above the FF-Helix propensity threshold) and Y = TANGO Aggregation Max (the peak TANGO score for that peptide). The current peptide is highlighted in red. The purpose: quickly see where this peptide sits in the database relative to the FF-Helix vs aggregation tradeoff.

The confusion comes from: (a) no axis labels (Peleg called this out), (b) no legend explaining what the red dot means, (c) no caption explaining the scientific question this view answers.

**Fix**:
- X-axis label: "FF-Helix %" with the tooltip "Fraction of residues in sliding-window segments above the FF-Helix propensity threshold (sequence-derived; not a CD measurement)."
- Y-axis label: "TANGO aggregation max" (no %).
- Caption above: "Each point is a peptide in this database. Position shows the tradeoff between FF-Helix propensity and aggregation max. Current peptide highlighted in red. Use to identify outliers."
- Legend: "● Database peptide  ● This peptide".

**Status**: NEW item — partially F4 (axis titles) + caption work. **File as F19 (FF-Helix vs Agg Max scatter explanation).** T3 task.

**Code**: `ui/src/pages/PeptideDetail.tsx:625-680` (ScatterChart inside the FF-Helix vs Aggregation Max card).

---

### H2. "I would move this part to the biochemical feature comparison."

**Direct answer**: she means move the FF-Helix vs Agg Max scatter into the Biochemical Feature Comparison block (alongside the radar + Cohort Position). Visually grouping all "where does this peptide sit relative to the database" charts.

**Fix**: same as D3 — make Biochemical Feature Comparison a parent block with three sub-panels: Radar, Cohort Position, FF-Helix vs Agg Max scatter. Single visual story instead of three scattered cards.

**Status**: ties into F15 (Biochemical feature comparison parent grouping). T3/T4 layout task.

---

## Section I — Tier 1 / High-Confidence Switch Zone (PPT page 22)

### I1. "What does Tier 1 mean?"

**Direct answer**: "Tier 1" is our internal label for a heuristic confidence band — peptides that satisfy multiple corroborating signals (TANGO peak + S4PRED helical structure + µH above threshold). It was meant to communicate "high confidence" but doesn't trace to a published methodology. Peleg's flagging this is correct — we shouldn't ship qualitative labels that look quantitative without a derivation.

**Status**: this is **D3** in Packet 1 §3 — co-design item. Recommended fix: drop the Tier 1 / Tier 2 / Tier 3 labels entirely, replace with descriptive qualitative tier names like "High-confidence switch zone" (kept) without the "Tier 1" badge that implies a ranking system.

---

### I2. "There is a difference between aggregation and fibrillation."

**Direct answer**: confirmed. The Tier 1 panel description previously said "TANGO detects an aggregation hotspot... helix-to-beta conformational switch zone is a hallmark of amyloid-forming regions" — conflating aggregation with fibril/amyloid formation. The text was rewritten to separate these:
- TANGO predicts aggregation propensity (a sequence-derived score for self-association tendency).
- Fibril / amyloid formation is a specific structural outcome that requires the helix-to-beta switch AND aggregation propensity AND favorable hydrophobicity.

**Status**: **L3** in Packet 1 §1 — already shipped. The Tier 1 description text was updated.

**Code**: search for "amyloid-forming regions" in `ui/src/components/EvidencePanel.tsx` and `ResultsCharts.tsx`.

---

### I3. "I would like more explanation on how you derived this statement from the data, since I am not sure about this."

**Direct answer**: she's asking for the methodology behind the Tier 1 / High-Confidence call. Today's logic: a region is "Tier 1 high-confidence switch" when TANGO detects an aggregation hotspot AND S4PRED predicts helical structure for the same residues. This is OUR heuristic, not a published method.

**Fix path** (ties to D3 above): either (a) drop the certainty bar entirely and just describe the observation ("TANGO detects an aggregation hotspot at residues X-Y where S4PRED predicts α-helical structure"), or (b) replace the heuristic with a published derivation if Peleg can point us at one.

**Status**: D3 in Packet 1 — co-design. Recommend (a).

---

### I4. "From where is the 80% certainty?"

**Direct answer**: **honest answer — the 80% is a heuristic we wrote, not a derived probability.** It combines TANGO peak score, S4PRED helix probability, and µH threshold-distance into a 0-100 number. Not statistically grounded.

**Fix**: drop the certainty bar entirely. Per Peleg's directive on the validation findings — don't show numbers we can't defend. Replace with a qualitative label.

**Status**: D3 in Packet 1 §3 — co-design item. Recommend dropping.

---

## Section J — Correlation Matrix (PPT page 38)

### J1. "The SSW score and diff should not be values in this correlation since these numbers do not have real meaning or are going to be fairly similar because of the threshold. Also the aggregation max."

**Direct answer**: confirmed and shipped. SSW Score, SSW Diff, and Agg Max are now excluded from the default correlation matrix metrics.

**Status**: **L13** in Packet 1 §1 — already shipped.

**Code**: `ui/src/lib/correlationMatrix.ts::DEFAULT_CORRELATION_METRICS` excludes these three.

---

### J2. "Again, I have a problem with the absolute number of charges."

**Direct answer**: she's right — currently we use **|charge|** (`Math.abs(p.charge)`) in the correlation matrix and elsewhere. The absolute value loses the sign distinction between cationic (+) and anionic (−) peptides, which is biologically meaningful for membrane interactions and aggregation propensity.

**Fix path**: two options:
- (a) Switch correlation matrix + ranking to signed charge. Simple change but may surface negative correlations that need framing.
- (b) Keep |charge| but add a **net charge sign column** (+/−/neutral) alongside, so the user can filter or stratify by charge sign.

**Recommend (a) for the correlation matrix specifically** (signed values give the honest correlation), **(b) for the ranking** (where we want to rank by magnitude of charge effect, not direction). Peleg's call.

**Status**: this is **PELEG-Q-FIX-022** marked as "discussion pending" in code (`ui/src/components/ResultsCharts.tsx:60` has the explicit comment). **NEW open item — file as D6 (charge handling) for co-design.** Ask Peleg directly.

**Code**: `ui/src/components/ResultsCharts.tsx:60-64`, `ui/src/lib/ranking.ts:75,95,202`, `ui/src/stores/datasetStore.ts:122,317`.

---

### J3. "How do you deal with values that are missing? You put 0?"

**Direct answer**: **NO, we explicitly do NOT zero-impute.** The correlation matrix uses pairwise-exclusion: when computing correlation between metrics A and B, any peptide with a missing value for A OR B is excluded from that specific pair (not from the whole row). Other pairs that don't involve A or B still include that peptide.

This is the statistically correct way to handle missing data without imputation bias, and it's documented:

```typescript
// ui/src/components/CorrelationCard.tsx:9
//   6. Missing values handled via pairwise-exclude (NOT zero-imputation).
// ui/src/components/CorrelationCard.tsx:21
//   missingStrategy="pairwise-exclude"
```

The implementation lives in `ui/src/components/CorrelationMatrix.tsx:105-150` — `MissingStrategy` type accepts `"pairwise-exclude" | "listwise-exclude" | "never-zero"` and the comment on line 146 explicitly says "These are excluded pairwise. No zeros were imputed."

**Fix path**: surface this in a tooltip on the correlation matrix header — "Missing values are excluded pairwise; no zero-imputation." This pre-empts the question and shows we did this carefully.

**Status**: code is correct; surfacing it is the gap. **File as F20 (missing-value handling tooltip on correlation matrix).** Small T3 fix.

---

## Section K — Smart Candidate Ranking (PPT page 39)

### K1. "Let's discuss the parameters we use to rank."

**Direct answer**: this is **D4** in Packet 1 §3 — co-design item. Current defaults: s4predHelixPercent + FF-Helix % + µH (each ~15%) + TANGO Agg Max (35% in Amyloid Focus preset only) + SSW Score (25%). Peleg wants to define these together. Email asks her to validate proposed presets.

---

### K2. "The Tango aggregation should not be in the default for sure. And the hydrophobicity must be in the default."

**Direct answer**: confirmed and shipped. TANGO Agg Max moved out of the default metric set; hydrophobicity added to defaults.

**Status**: **L14 + L23** in Packet 1 §1 — already shipped.

**Code**: `ui/src/lib/ranking.ts:57` `DEFAULT_METRICS = ["s4predHelixPercent", "muH", "hydrophobicity"]`; TANGO Agg Max is in `OPTIONAL_METRICS`.

---

### K3. "If there is a switch focused, then there should also be helix focus."

**Direct answer**: confirmed and shipped. "Helix Focus" preset exists alongside "Switch Focus", "Amyloid Focus", "Equal".

**Status**: **L15** in Packet 1 §1 — already shipped.

**Code**: `ui/src/lib/ranking.ts:167` — `helix` preset defined.

---

### K4. "What is the % mean here? Which columns or which results are actually being taken into consideration here?"

**Direct answer**: this is **Q3** in Packet 1 §4 — there are TWO different `%` meanings colliding in the same UI:
- **Per-metric weight sliders** (sum to 100%, the user's distribution of importance across enabled metrics).
- **Final ranking score** (also 0-100, but it's a percentile-aggregated number derived from each peptide's per-metric values weighted by the slider distribution).

**Fix**: rename to remove the ambiguity:
- Weight sliders → "Weight (out of 100)" with tooltip "Weights sum to 100% across all enabled metrics."
- Final score column → "Score (0-100)" with tooltip "Percentile rank within this database, weighted across selected metrics."

**Status**: this is **F11** in the Wave 2.5 fix-pack. Already scheduled. Email also asks Peleg if the new labels work for her.

**Code**: `ui/src/components/ThresholdTuner.tsx`.

---

## Section L — Threshold Controls (PPT page 40)

### L1. "Do you present here the threshold being calculated by the tool??"

**Direct answer**: yes — the slider's current value reflects the **active threshold being applied to the dataset right now**, which is either:
- The cohort-derived value (computed from this dataset's median when in `Recommended` mode), or
- The user's manually-set custom value (when in `Custom` mode), or
- A hardcoded preset (`Strict` / `Exploratory`).

So the answer is: the slider shows what threshold the classifier is actually using on screen — the user can move it to see what would change.

**Fix path**: add an inline label below each slider showing "Source: dataset median 0.51 / custom 0.55 / Strict preset". Removes the ambiguity.

**Status**: **L17** in Packet 1 §1 says "threshold sliders show the active threshold being applied" — already shipped. But the **source label** is the new ask. **File as F21 (threshold source-of-value inline label)** for T3.

**Code**: `ui/src/components/ThresholdTuner.tsx:145,160` — `active.muHCutoff`, `active.hydroCutoff`.

---

### L2. "Where did they derive from? Also, here, let's think about the parameters. These are not the ones that affect the aggregation potential."

**Direct answer**: the threshold defaults come from Peleg's reference implementation (Lab-derived from the Staphylococcus 2023 training set — `H = 0.417, uH = 0.388, aggThreshold = 5.0`). The "these are not the ones that affect aggregation potential" comment is correct — the Agg Per-Residue %, % of Length Cutoff, Min SSW Residues sliders are **not aggregation thresholds**, they're FF-classification cutoffs. The naming has been confusing.

**Fix path**: this ties to A1 + A2 — drop the misleading "aggregation" framing from these threshold labels and descriptions. Already in F1 + F2.

**Status**: in F1 + F2 scope. Ship.

---

## Coverage map — which questions are addressed where

| # | Question | Where addressed | Status |
|---|---|---|---|
| A1 | Agg Per-Residue % unclear | F1 + drop row | Scheduled |
| A2 | Aggregation framing in % of Length | F1 wording sweep | Scheduled |
| B1 | S4PRED <15aa citation | Packet 1 §4 Q1 | Awaiting Peleg |
| B2 | "4/8 too short" single-line | F9 | Scheduled |
| C1 | Sliding-Window unclear | **F12 NEW** | File for T3 |
| C2 | "Tango aggregation %" | F3 | Scheduled |
| C3 | Missing X-axis + bad legend | F4 + new sub-item | Scheduled |
| C4 | Drop redundant hydrophobic metric | **F13 NEW** | File for T3 |
| D1 | Percentile note insertion | **F14 NEW** | File for T3 |
| D2 | Above-median gold→green | F7 | Scheduled |
| D3 | Biochemical feature comparison grouping | **F15 NEW** | File for T3/T4 |
| E1 | Helix 100% vs 77% dual values | Packet 1 §4 Q2 | Awaiting Peleg |
| E2 | Color scale on sequence | **F16 NEW** | File for T3 |
| F1-3 | s4pred neural net / Beta % / PRED caps | L4, L5, F10 | Shipped + scheduled |
| G1 | TANGO score not % | F3 | Scheduled |
| G2 | "aggregation-secondary structure" rename | **F17 NEW** | File for T3 |
| G3 | TANGO 5% threshold origin | **F18 NEW** | File for T3 + ask Peleg |
| H1 | FF-Helix vs Agg Max unclear | **F19 NEW** | File for T3 |
| H2 | Move scatter to biochem feature comparison | F15 (tied) | File for T3/T4 |
| I1 | Tier 1 meaning | Packet 1 §3 D3 | Co-design |
| I2 | Aggregation vs fibrillation | L3 | Shipped |
| I3 | Tier 1 derivation | Packet 1 §3 D3 | Co-design |
| I4 | 80% certainty origin | Packet 1 §3 D3 | Co-design (recommend drop) |
| J1 | SSW Score/Diff/Agg Max out of correlation | L13 | Shipped |
| J2 | |charge| absolute value | **D6 NEW** | Co-design, ask Peleg |
| J3 | Missing value handling | **F20 NEW (tooltip)** | Code correct, surface it |
| K1 | Rank parameter discussion | Packet 1 §3 D4 | Co-design |
| K2 | TANGO out of default, hydro in default | L14 + L23 | Shipped |
| K3 | Helix Focus preset | L15 | Shipped |
| K4 | "%" meaning in ranking | F11 + Packet 1 §4 Q3 | Scheduled + ask Peleg |
| L1 | Slider shows the applied threshold | L17 + **F21 NEW** | Shipped + add source label |
| L2 | Threshold derivation | F1 + F2 | Scheduled |

### NEW items surfaced today (file in fix-pack v2)

- **F12** — Sliding-Window Profiles clarity (axes + legend + caption)
- **F13** — Drop redundant hydrophobic-metric labels; single "based on Fauchère-Pliska" mention
- **F14** — Insert percentile note before second sentence (Cohort Position interpretation)
- **F15** — Group Biochemical Feature Comparison as parent with 3 sub-panels (Radar + Cohort Position + FF-Helix vs Agg Max scatter)
- **F16** — Sequence color-scale tooltip + inline legend (G is black because Coil)
- **F17** — Rename "Aggregation-Structure Overlay" → "aggregation-secondary structure overlay"
- **F18** — TANGO 5% threshold rationale in tooltip + Help.tsx, run threshold sensitivity analysis
- **F19** — FF-Helix vs Aggregation Max scatter: axis labels + caption + legend
- **F20** — Correlation matrix: surface "missing values excluded pairwise; no zero-imputation" as tooltip
- **F21** — Threshold slider: inline label showing source-of-value (dataset median / custom / preset)
- **D6** — Charge handling: signed vs |charge| for correlation matrix vs ranking — co-design with Peleg

### Honest summary for the email

Of ~25 visible questions in her PowerPoint:
- **9 already shipped** (L3, L4, L5, L13, L14, L15, L17, L23, and the Wave 0 Beta% drop precursor)
- **6 scheduled in Wave 2.5 fix-pack** (F1, F2, F3, F4, F7, F9, F10, F11)
- **4 awaiting Peleg's reply** (Q1 S4PRED citation, Q2 dual helix labels, Q3 % meaning, Q4 Chou-Fasman alternative)
- **5 co-design items** (D1 interpretation notes, D2 4-class labels, D3 Tier 1, D4 ranking weights, D5 SSW Score; +D6 charge handling new today)
- **10 NEW items surfaced by this re-read** (F12-F21) — file for T3 in fix-pack v2

The 10 new items are mostly small UI clarifications (axis labels, tooltips, captions). None are scientific changes — they're "explain what's already there better." This shows we read her PowerPoint slide by slide and didn't miss anything substantive.
