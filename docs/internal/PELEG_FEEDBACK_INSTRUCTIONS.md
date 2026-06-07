# Peleg Feedback — Complete Instruction Set

> **Source**: `Peleg note.pptx` (44 slides), reviewed April 2026
> **Author**: Peleg Ragonis-Bachar (biologist/collaborator)
> **Purpose**: Every fix below must be executed. Work through them in order (Tier 0 → Tier 3).
> **Key principle**: Peleg is a biologist. When she says something is wrong, it IS wrong scientifically. Trust her domain expertise completely.

---

## ⚠️ PELEG-CRITICAL-001 — Helix % calculation audit (TOP PRIORITY)

**Source**: Peleg message in Hebrew, 2026-04-26: *"אני רוצה שנבין את הסיפור הזה עם האחוז הליקויים שנראה שבאופן עקבי מחושב או נשלף מהחישוב לא בצורה נכונה"* — "I want us to understand the helix percentage which seems to be consistently miscalculated or extracted from the calculation incorrectly."

**Owner**: T4 (Peleg terminal). Must be done BEFORE other P-wave fixes — touches the same metric they all depend on.

**Investigation output expected**:
A short audit report (`docs/active/HELIX_PERCENTAGE_AUDIT.md` or inline section here) listing:

1. **Every place a "helix percentage" is computed** in the codebase. As of 2026-04-26 we know about 4 — verify and find any others:
   - `backend/s4pred.py:383` — `_get_segment_percentage(helix_segments, sequence_length)` — segment-based (% residues inside helix segments)
   - `ui/src/components/S4PredChart.tsx:51,57` — `meanH * 100` — probability mean (average P(Helix) per residue × 100)
   - `backend/tango.py:796` — `Helix_pct` — TANGO's helix percentage (different algorithm)
   - `backend/s4pred.py:424` — `SSW_HELIX_PERCENTAGE_S4PRED` — same value as `:383`, copied for SSW context
   - Any others surfaced by `grep -rn "helix.*[Pp]ercent\|helixPct\|helixPercent\|helix_percent" backend/ ui/src` (excluding test files)

2. **For each computation site**: scientifically what does it actually measure? Match against Peleg's 4-category definitions (FIX-001):
   - Category 1 "Helix": "S4PRED predicts helix segments meeting (a) minimal continuous residues threshold AND (b) minimal helix score threshold"
   - That definition is **segment-based**, NOT probability-mean-based
   - So site `:383` is correct; site `S4PredChart.tsx` ("Avg composition") is showing a DIFFERENT metric without saying so

3. **For each user-facing display**: which calculation is shown, and is the label honest about what it's showing?
   - Search: `grep -rn "Helix.*%\|helix.*%\|% Helix" ui/src --include="*.tsx" | grep -v node_modules`
   - For each match: which calculation feeds it? Is the label clear about which?

4. **Decision**: which ONE definition is canonical for user-facing "Helix %"?
   - Recommendation (verify with Peleg): the **segment-based** percentage (matches FIX-001 category 1 definition). The probability-mean is a different scientific concept (overall structure-prediction confidence) and either (a) gets removed per FIX-011, or (b) is shown ONLY with a different name like "Average S4PRED helix confidence".

5. **Fix list**: concrete file + line edits to:
   - Make the canonical definition the only one labeled "Helix %"
   - Rename or remove others (per FIX-011: REMOVE the "Avg composition" line in S4PredChart.tsx entirely)
   - Add inline tooltips explaining EXACTLY which definition is used
   - Verify backend → API → frontend chain doesn't quietly substitute one for another

**Definition of Done for the audit**:
- [ ] All compute sites identified
- [ ] All display sites identified
- [ ] Matched against Peleg's definitions
- [ ] Bug list of mislabeled / wrong-source displays
- [ ] Concrete fix proposed for each (with file paths + line numbers)
- [ ] Posted as `docs/active/HELIX_PERCENTAGE_AUDIT.md`
- [ ] T1 reviews → if approved, T4 (or T3) executes the fixes
- [ ] Includes a unit test asserting the canonical definition is used (e.g., test that asserts segment-based result == display value)

**Why this is P0 (blocks the rest of P-waves)**:
- FIX-009, FIX-011, FIX-014, FIX-027, FIX-028 all touch helix % displays
- If we don't standardize the definition first, those fixes cement the inconsistency
- Peleg explicitly flagged this as urgent — it's a scientific correctness issue, not a UX one

---

## CRITICAL CONCEPTUAL CORRECTION (Read First)

**Aggregation ≠ Fibril-formation.** This distinction runs through the ENTIRE review. TANGO predicts *aggregation propensity*, which is NOT the same as amyloid/fibril formation. PVL's pipeline detects *fibril-forming potential*, which requires additional criteria (hydrophobicity, uH) beyond aggregation. Every place in the UI, tooltips, help text, and code comments that conflates these two must be corrected.

**Fauchere-Pliska is a hydrophobicity scale, NOT a helix propensity scale.** The current FF-Helix metric description incorrectly frames it as measuring helix propensity. This is scientifically wrong. The sliding window over Fauchere-Pliska values measures hydrophobicity of helical segments, not helix propensity itself.

**CD spectroscopy must NEVER be mentioned anywhere in the app.** It appears in several tooltips and help text. Remove every single reference. It is irrelevant to computational prediction and confuses users.

---

## Tier 0 — Foundational (Must be done first; other fixes depend on these)

### FIX-001: Implement 4-Category Classification System
**Slides**: 27, 29, 30
**Current state**: PVL has a binary system (FF-Helix, SSW) with inconsistent definitions.
**Peleg's proposed system** (4 canonical prediction categories):

1. **Alpha-helix (secondary structure)**
   - Determined by S4PRED predictions and threshold
   - A peptide is "helical" if S4PRED predicts helix segments meeting the minimal continuous residues threshold AND the minimal helix score threshold

2. **Fibril-forming alpha helix (FF-Helix)**
   - Determined by the uH threshold
   - If a peptide is predicted to be helical (category 1 above) AND its uH is higher than the uH threshold → predicted as potential alpha-helical fibril-forming peptide
   - Note: the determination uses uH (hydrophobic moment), NOT hydrophobicity

3. **Secondary structure switch (SSW)**
   - Determined by TANGO and/or S4PRED
   - A peptide is SSW if the difference between averaged scores of helicity and extended beta are lower than the maximum gap threshold
   - Meaning: the prediction tools were indecisive or predicted similar scores for both secondary structures
   - Logic: TANGO **or** S4PRED (not "and" — fix this in the FF-SSW classification help text too)

4. **Fibril-forming secondary structure switch (FF-SSW)**
   - Determined by the hydrophobicity threshold
   - If a peptide is SSW (category 3 above) AND its hydrophobicity is higher than the hydrophobicity threshold → predicted as fibril-forming SSW
   - Note: the determination uses hydrophobicity, NOT uH

**Action**: Update the classification logic in `backend/auxiliary.py` and/or wherever FF-Helix/SSW flags are computed. Update `ui/src/types/peptide.ts` if type definitions need changing. Update all help text, tooltips, and metric explanation pages to use these exact 4 categories with Peleg's definitions.

**Key distinction**: FF-Helix uses **uH** threshold. FF-SSW uses **hydrophobicity** threshold. Do not mix these up.

### FIX-002: Restructure Threshold Configuration Panel
**Slides**: 2, 3, 4, 5, 6, 7, 8
**Current grouping** (WRONG):
- SSW Thresholds: Min SSW Residues, SSW Max Difference
- FF-Helix Thresholds: uH Cutoff, Hydrophobicity Cutoff
- General Thresholds: Agg Per-Residue %, % of Length Cutoff, Min Prediction %, Min S4PRED Helix Score, Max TANGO Difference

**New grouping** (from Peleg's slides 3-6):

**Group 1: "General secondary structure thresholds"**
- **Minimal continuous residues** — Default = 5 — Tooltip: "The minimal length of consecutive residues predicted to have the same secondary structure. To make secondary structure prediction longer, this value should be increased. Only integer numbers allowed."
- **Maximum gap** — Default = 3 — Tooltip: "Maximum number of residues with mismatched secondary-structure prediction score allowed within a predicted segment stretch. To make secondary structure prediction more strict, this number should be closer to 0. Only integer numbers allowed."

**Group 2: "Helical thresholds"**
- **Minimal S4PRED helix score** — Default = 0.5 (for now) — Tooltip: "The minimal average reliability score of α-helical prediction by S4PRED."
- **Minimal % helix content** — Default = 0 — Tooltip: "Minimum percentage of residues predicted to be helical so that the sequence will be defined as helical."

**Group 3: "Secondary structure switch thresholds"**
- **S4PRED maximum helix and beta difference** — Default = 0.03 (need to be tested) — Tooltip: "The maximal difference between α-helix and β prediction scores by S4PRED. To increase the potential for secondary structure, this value should be lower."
- **TANGO maximum helix and beta difference** — Default = 3 (need to be tested) — Tooltip: "The maximal difference between α-helix and β prediction scores by TANGO. To increase the potential for secondary structure, this value should be lower."
- **Minimal % secondary structure content** — Default = 0 — Tooltip: "Minimum percentage of residues predicted to be secondary structure switch so that the sequence will be defined as such. To make secondary structure prediction more strict, this number should be closer to 100. Value range 0-100."

**Group 4: "Fibril-formation thresholds"**
- **uH (Hydrophobic moment)** — Default = 0.5 — Tooltip: "Minimum hydrophobic moment to predict fibril formation potential of α-helical fibrils. To perform a more strict prediction, this value should be higher. Value range 0 to 3.26"
- **Hydrophobicity** — Default = 0.5 — Tooltip: "Minimum hydrophobicity to predict fibril formation potential of secondary structure switch fibrils. To perform a more strict prediction, this value should be higher. Value range -1.01 to 2.25"

**Rules**:
- No acronyms in titles (spell out fully, no "Min", no "SSW" without expansion, no "Agg")
- Remove the word "Cutoff" everywhere — just use the parameter name
- The "Agg Per-Residue %" and "% of Length Cutoff" thresholds from current "General" group: Peleg does not understand these. They need to be re-evaluated. If they are TANGO aggregation-related, they likely belong removed or moved into an "Advanced/TANGO" sub-section with clear explanations

**Files to modify**: The threshold UI components (search for `ThresholdConfig`, `thresholdStore`, threshold-related components in `ui/src/`). Backend threshold config in `backend/config.py`.

### FIX-003: Global Terminology Replacements
**Slides**: 1, 2, 7, 8, 15, 16, 19, 22, 32, and throughout
**Search-and-replace across the entire codebase** (UI labels, tooltips, help text — NOT variable names in code):

| Find (in UI text) | Replace with |
|---|---|
| "cohort" | "database" |
| "Pipeline Overview" | "Results Overview" |
| "Pipeline Intersections" | "Results Intersections" |
| "pipeline" (in UI headings) | "results" |
| "neural network prediction" / "neural network ensemble" | remove entirely, just say "S4PRED" |
| "Cutoff" (in threshold labels) | remove or use "threshold" |
| "Agg" (abbreviation) | "Aggregation" (if kept at all) |
| "Min " (in labels) | "Minimal " or "Minimum " |
| All CD spectroscopy references | DELETE entirely |
| "PREDiction" (odd caps in S4PRED footer) | "Prediction" (normal case) |
| "aggregation hotspot" / "amyloid-forming regions" (when describing TANGO) | "aggregation-prone regions" or "regions with higher aggregation propensity" |

**Important**: Do NOT rename code variables/functions — only user-facing text (labels, tooltips, descriptions, help pages).

---

## Tier 1 — Results Dashboard & KPI Cards

### FIX-004: Reorder and Rename KPI Summary Cards
**Slide**: 10
**Current order**: Total Peptides → FF-Helix % → FF-SSW % → % SSW
**New order**: Total Peptides → **% FF-Helix** → **% SSW** → **% FF-SSW**

**Naming changes**:
- "FF-Helix %" → "% FF-Helix" (percent sign first)
- "FF-SSW %" → "% FF-SSW" (percent sign first)
- "% SSW" → "% SSW" (already correct format)

**Subtitle fixes**:
- Current "HELIX + UH > AVG" → Fix: "helix" not all-caps, use Greek μ not capital U. Should read something like: "Helix + μH > avg" or better: use Peleg's 4-category definitions as subtitles
- Current "SSW AND H >> AVG" → Similar fix: proper case, proper symbols

**Icon changes**: Peleg wants scientifically meaningful icons instead of generic ones (flask, document, chart). She provided 3 reference illustrations:
- **For SSW**: An alpha-helix with a double-headed arrow showing structural switch (helix ↔ beta transition)
- **For FF-Helix**: A helix transitioning into fibrillar arrangement (helix + fibril lines)
- **For FF-SSW**: Structural switch combined with fibril formation

**Action**: Since we can't embed complex scientific illustrations as icons easily, use distinct simple SVG icons that suggest these concepts. At minimum, make the icons visually distinct and meaningful. Consider using Unicode symbols or simple line drawings. The key is each card should have a DIFFERENT, recognizable icon — not generic UI icons.

**Files**: Look for the KPI/summary card components in `ui/src/components/` or `ui/src/pages/Results.tsx`.

### FIX-005: Fix Badge Colors and Consistency in Results Table
**Slides**: 12, 13
**Problem 1 — Color collision**: Purple is used for BOTH:
- Provider status badges (TANGO: OK, S4PRED: OK) in the toolbar
- SSW positive badge in the data table

**Fix**: Change one of them to a different color. Suggestion: keep provider badges as-is, change the SSW badge to a distinct color.

**Problem 2 — Inconsistent positive-result badges**: Currently mixed:
- Helix column: "Yes" (green)
- SSW column: "SSW" (purple text)
- FF-Helix column: "No" / "Yes"
- FF-SSW column: "Yes" (green)

**Peleg's preference**: Make ALL positive badges consistent. Use the feature name as badge text:
- Helix positive → show "Helix" badge
- SSW positive → show "SSW" badge
- FF-Helix positive → show "FF-Helix" badge
- FF-SSW positive → show "FF-SSW" badge

Each feature type should have its own distinct color. Suggested mapping:
- Helix: blue
- SSW: a color different from purple (maybe teal or amber)
- FF-Helix: green (positive/fibril-forming)
- FF-SSW: green variant or distinct color

Negative results: show "—" or empty, not "No" or "Yes" with red.

**Files**: Table components in `ui/src/components/` — search for badge/pill rendering in the results table.

### FIX-006: Consistent Table Columns Regardless of Data Source
**Slide**: 11
**Problem**: When uploading from UniProt, the default table columns change (gene name column appears). The results table must ALWAYS show the same base columns regardless of whether data comes from CSV upload, single-sequence Quick Analyze, or UniProt query.
**Action**: Find where column configuration differs by data source and unify it. Gene name can be an optional column the user adds, but it should NOT be in the default view.

### FIX-007: Venn Diagram Data Bug
**Slide**: 31
**Problem**: The Venn diagram shows "Both (SSW ∩ Helix) = 4" but the summary table below shows "SSW ∩ Helix = 3". These must match.
**Additional issues**:
- The FF-SSW circle should be visually nested INSIDE both the SSW and Helix circles (since FF-SSW requires both SSW and Helix)
- The "Neither" label (count outside all circles) is too faint — make it black text for visibility

**Files**: Venn diagram component — search for `Venn` or `PipelineOverview` (which should be renamed to `ResultsOverview` per FIX-003).

### FIX-008: Rename "Pipeline" → "Results" in Overview Sections
**Slide**: 32
- "Pipeline Overview" → "Results Overview"
- "Pipeline Intersections" → "Results Intersections"
- Any other "pipeline" references in section headings

---

## Tier 2 — Peptide Detail Page

### FIX-009: Clarify Two Different Helix Percentages
**Slide**: 14
**Problem**: The Peptide Detail "Sequence & Structure" section shows TWO different helix percentages:
- Top badge: "Helix (100%)" — this is the structure track coverage
- Legend row: "Helix (77%)" — this appears to be something else (maybe S4PRED average confidence?)

**Fix**: Add clear labels differentiating these. For example:
- "Helix coverage: 100% of residues" (how many residues are in helix segments)
- "Average helix confidence: 77%" (mean S4PRED P(Helix) across the sequence)

Or if they represent different things, label them precisely so a biologist understands.

### FIX-010: Explain Residue Coloring in Sequence Display
**Slide**: 14
**Problem**: In the sequence display "GIGAVLKVLTTGLPALISWIKRKRQQ", the first G is black while all other residues are blue. There is no legend explaining the color scheme.
**Fix**: Either add a legend explaining what the colors mean, or make all residues the same color if there's no meaningful distinction. If the color represents secondary structure assignment (e.g., coil=black, helix=blue), add a clear legend row.

### FIX-011: S4PRED Probability Chart — Remove Composition Percentages
**Slide**: 18
**Problem**: The line "Avg composition: Helix 68% / Coil 30% / Beta 1%" is problematic:
- Peleg says: "Putting % like this is like performing another prediction"
- The Beta 1% is questionable when P(Beta) values are all below 0.25
- Just showing the probability graph is sufficient

**Fix**: Remove the "Avg composition" line entirely. The probability curves speak for themselves.
**Also**: Remove "neural network" from the subtitle and footer. Just say "S4PRED" or "S4PRED secondary structure prediction".
**Also**: Fix "PREDiction" capitalization in the footer to normal "Prediction".

### FIX-012: TANGO Aggregation Profile — Scientific Corrections
**Slide**: 19
**Multiple issues**:

1. **Subtitle wrong**: "High scores indicate amyloid-forming regions" → WRONG. Aggregation ≠ amyloid.
   **Fix**: Change to "Per-residue aggregation propensity. Higher scores indicate higher propensity."

2. **Y-axis label wrong**: "TANGO score (%)" → The TANGO score is NOT a percentage.
   **Fix**: Change to "TANGO score" (remove the %)

3. **Link text**: "Show Aggregation-Structure Overlay" → Change to "Show Aggregation-Secondary Structure Overlay"

4. **Threshold explanation**: "Scores >5% indicate aggregation-prone regions" — Peleg questions where the 5 threshold came from. On a 0-100 scale, 5 is low.
   **Fix**: Either justify the 5% threshold with a citation, make it configurable, or remove the characterization. At minimum change "5%" to "5" (not a percentage).

5. **Footer text**: "High peaks suggest amyloid-forming stretches" → Change to "Higher peaks indicate regions with higher aggregation propensity" (no mention of amyloid)

### FIX-013: Remove/Rethink Consensus Tier System
**Slide**: 22
**Problem**: The "Tier 1 — High-Confidence Switch Zone" card with 80% certainty is entirely unexplained:
- What does "Tier 1" mean? No documentation.
- Where does "80% certainty" come from? Seems arbitrary.
- The text conflates aggregation with amyloid formation.
- Peleg: "I would like more explanation on how you derived this statement from the data"

**Fix**: Either:
- (a) Remove the consensus tier system entirely until it can be properly justified and documented, OR
- (b) Add extensive documentation explaining the tier derivation logic, make the certainty calculation transparent, and fix the scientific language

**Recommendation**: Option (a) for now — hide/remove the consensus card. It cannot ship without scientific justification.

### FIX-014: Evidence Summary Improvements
**Slide**: 23
**Multiple issues**:

1. **Add Helix and FF-Helix status indicators**: Currently only SSW has a green checkmark status. Add similar positive/negative indicators for Helix and FF-Helix predictions.

2. **Label delta values**: The delta numbers (+1.1, +8.7%, etc.) have no label. Add a small title: "Difference from database mean" or "Δ from database mean"

3. **Remove Chou-Fasman Propensity**: Peleg says it's outdated and she's "not convinced this is important here." Remove this metric from the Evidence Summary.

4. **Fix MODERATE aggregation label**: Peleg says the TANGO values shown are "relatively low, actually" — the MODERATE classification is wrong. Either recalibrate the thresholds or make them transparent and configurable.

5. **Fix hydrophobic moment interpretation**: Current text just says "Moderate amphipathic character". Peleg suggests: "Higher hydrophobicity means more than stronger membrane affinity. Can also indicate higher propensity for self-assembly or aggregation."

### FIX-015: Interpretation Notes — Requires Manual Review
**Slide**: 24
**Problem**: Peleg's exact words: "If we are making a biological interpretation, we need to be super careful, have a deep discussion between us on the meaning of things, and go over very carefully the decision tree of this section and the different notes that can be inferred and generated at this part."

**Current interpretation notes** (auto-generated):
- "Higher hydrophobicity suggests stronger membrane affinity"
- "Positive charge can enhance membrane interaction"
- "Helical structure often correlates with biological activity" ← Peleg says this is "very vague and can be dropped"
- "uH > 0.5 indicates strong amphipathic character"

**Fix**: For now, REMOVE the interpretation notes section entirely OR replace with a disclaimer: "Biological interpretation requires expert review. See Help page for metric definitions." The auto-generated notes are too risky scientifically to ship without Peleg's explicit approval of each one.

**FLAG**: This needs a meeting with Peleg and Alex to define the exact decision tree for interpretation notes.

### FIX-016: Biochemical Feature Comparison — Rename and Restructure
**Slides**: 15, 16, 21

1. **Rename "Feature Comparison"** → "Biochemical feature comparison"
2. **Rename "Cohort Position"** → remove or give small subtitle, merge with radar chart
3. **Layout**: Combine the radar chart (slide 15) and percentile bars (slide 16) into ONE section titled "Biochemical feature comparison" with two sub-panels:
   - Sub-panel 1: Radar/spider chart (small subtitle: current gray subtitle)
   - Sub-panel 2: Percentile ranking bars (small subtitle: current gray subtitle)
4. **Move summary stat cards** (slide 21: Hydrophobicity 0.51, uH 0.39, Charge +5.0, S4PRED Helix 100%) INTO this combined biochemical section
5. **Replace "cohort"** with "database" in all labels, legends, subtitles
6. **Fix "Above median" badge color**: Change from gold/brown to GREEN
7. **Percentile interpretation text**: Add before the second sentence: "Note: if a peptide is at the..." (Peleg wanted additional clarifying text — use: "Note: percentiles are relative to this dataset only.")
8. **Remove "neural network prediction"** subtitle from the S4PRED Helix stat card

### FIX-017: Sliding-Window Profiles — Multiple Fixes
**Slide**: 17
Peleg said: "I didn't understand these graphs." This is a serious UX failure. Fixes:

1. **Add X-axis label**: "Residue position" (currently missing)
2. **Fix legend mismatch**: The shared legend shows S4PRED helix segments (pink), FF-Helix candidate regions (green), and TANGO aggregation (orange dashed) — but these overlays are NOT visible in the actual charts. Either show the overlays or remove them from the legend.
3. **Remove "Fauchere-Pliska"** from the subtitle/description. Peleg says: "No need to mention the hydrophobic metric, we will write it in another place, so that all the hydrophobic metrics are based on Fauchere-Pliska." It should just say "Hydrophobicity" and document Fauchere-Pliska as the scale elsewhere (e.g., Help/Metrics page).
4. **Explain TANGO aggregation % overlay**: If keeping the orange dashed TANGO line overlaid on the hydrophobicity chart, add a clear explanation of what it represents. If it cannot be explained simply, remove it.

### FIX-018: FF-Helix vs Aggregation Max Scatter Plot
**Slide**: 20
Peleg said: "I didn't understand this graph." Fixes:

1. **Add axis labels**: X-axis and Y-axis currently have NO labels. Add them (presumably X = "FF-Helix %" and Y = "Aggregation Max" or similar).
2. **Add legend**: Clarify what gray dots vs the red/orange highlighted dot represent.
3. Consider whether this chart should even exist given Peleg's concerns about conflating aggregation with fibril-formation.

---

## Tier 3 — Charts, Distributions, and Rankings

### FIX-019: Distribution Charts — Axis Labels and Notes
**Slides**: 33, 35, 36

**All distribution histograms need Y-axis labels** (currently missing on ALL of them):
- Hydrophobicity Distribution → Y: "Count" or "Frequency"
- Hydrophobic Moment Distribution → Y: "Count" or "Frequency"
- Sequence Length Distribution → Y: "Count", X: "Sequence length (amino acids)"
- Amino Acid Composition → Y: "Percentage (%)"

**Hydrophobicity chart**: Add a summary note below it, similar to what the uH chart has. E.g., "X of 12 peptides (Y%) above hydrophobicity threshold (H > Z)"

**uH chart**: Replace hardcoded "0.5" with the actual configurable uH threshold value.

**Layout change** (slide 35): Put Hydrophobicity, uH, and Sequence Length distribution histograms in the SAME row (3-column layout instead of current 2-column).

### FIX-020: Amino Acid Composition Chart — Add Info Tooltip
**Slide**: 36
Add an (i) info icon/tooltip that lists which specific amino acids belong to each biochemical group:
- Hydrophobic: A, V, L, I, M, F, W, P (or whatever grouping PVL uses)
- Aromatic: F, Y, W, H
- Basic (+): K, R, H
- Acidic (-): D, E
- Polar: S, T, N, Q
- Small: G, A, S
- Helix breaker: P, G
(Verify these against PVL's actual groupings in the backend code)

### FIX-021: Aggregation Propensity Distribution — Visual Consistency
**Slide**: 37
**Problem**: This chart uses a lollipop/dot style with color gradients, while all other distribution charts use plain bar charts.
**Peleg**: "On one hand, I love how this graph looks. On the other hand, it should look like all the other distribution graphs."
**Fix**: Convert to the same bar chart style as the other distributions, OR convert all distributions to the lollipop style. Consistency is key.

### FIX-022: Cohort Comparison Chart Improvements
**Slide**: 34
Six issues:

1. **Add spacing**: More space between bar groups on the x-axis
2. **Swap colors**: SSW (positive finding) should be GREEN, No SSW should be brown/orange (currently backwards)
3. **Add Y-axis label**: Currently missing
4. **Create Helix-based version**: Duplicate this chart for No Helix vs Helix vs FF-Helix comparison
5. **Add FF-SSW as third group**: Consider showing No SSW vs SSW vs FF-SSW
6. **Rethink |Charge|**: Using absolute charge removes biological information. Positive vs negative charge matters. Consider showing signed charge or splitting into separate positive/negative metrics.

### FIX-023: Correlation Matrix Improvements
**Slide**: 38
Six issues:

1. **Show only one triangle**: The matrix is symmetric — showing both halves is redundant. Display upper or lower triangle only.
2. **Remove unexplained vertical lines**: There are visual divider lines between some columns (e.g., between FF-Helix % and S4PRED Helix %) that seem arbitrary. Remove them.
3. **Remove inappropriate metrics from matrix**: SSW Score, SSW Diff, and Agg Max should be REMOVED from the correlation matrix. Peleg says: "The SSW score and diff should not be values in this correlation since these numbers do not have real meaning or are going to be fairly similar because of the threshold."
4. **Remove % from FF-Helix label** in the matrix
5. **Fix absolute charge**: Same concern as FIX-022 — |Charge| loses biological information
6. **Handle missing values**: Clarify that missing values are NOT treated as 0. If they are, fix the implementation. This is a scientific validity issue.

### FIX-024: Smart Candidate Ranking — Parameter Changes
**Slide**: 39
Three issues:

1. **Change default parameters**: TANGO Agg Max (currently 35% weight by default) should NOT be in the default ranking. Hydrophobicity (currently an optional add-on) MUST be a default metric.
2. **Add "Helix Focus" preset**: Currently there are "Equal", "Amyloid Focus", and "Switch Focus" presets. Add a "Helix Focus" preset. (Also rename "Amyloid Focus" — amyloid is not the right term per Peleg's corrections.)
3. **Clarify weight percentages**: Add tooltips explaining what the % weights mean and which underlying data columns/results feed into the ranking calculation.

### FIX-025: Threshold Controls Panel Improvements
**Slide**: 40
Two issues:

1. **Document threshold origin**: Are the threshold values (e.g., uH=0.51, Hydrophobicity=0.50) calculated by the tool from the dataset? Show this clearly. Add text like: "Thresholds computed from dataset median" or similar.
2. **Rethink aggregation flagging parameters**: Per-Residue Threshold, % of Length Cutoff, Min SSW Residues — Peleg questions whether these are the right parameters. This may need a discussion with Peleg, but at minimum add (i) tooltips explaining what each does and why.

---

## Tier 4 — Help/Metrics Pages & Definitions

### FIX-026: Peptide Metrics Explained — Correct All Definitions
**Slide**: 25
**Hydrophobicity**:
- Current definition: "Measure of how water-repelling the peptide is" → Too informal
- New definition: "Property quantifying the molecule or surface ability to repel water"
- Current range: "-2.0 to +2.0" → WRONG. Correct range: **-1.01 to 2.25**
- Add: "Here used as a feature to determine fibril-formation potential of secondary structure switch peptides."

**Hydrophobic Moment (uH)**:
- Current definition: "Quantifies amphipathic character of the peptide" → Too vague
- New definition: "Quantitative measurement of the amphiphilicity (asymmetry of hydrophobicity) of a peptide structure, representing the vector sum of hydrophobicity for amino acids in a helical arrangement"
- Current range: "0.0 to 1.0" → WRONG. Correct range: **0 to 3.26**
- Add: "Here used as a feature to determine fibril-formation potential of alpha-helical peptides."

**Charge**:
- Add "(pH = 7.4)" after "physiological pH"
- Make interpretation consistent with Evidence Summary interpretations

### FIX-027: FF-Helix and SSW Metric Definitions — Major Rewrite
**Slides**: 26, 30

**FF-Helix**:
- Remove "%" from the name everywhere it appears
- Remove ALL Fauchere-Pliska references from FF-Helix definition (it's a hydrophobicity scale, not a helix predictor)
- Remove ALL CD spectroscopy references
- Rewrite using Peleg's definition from FIX-001 (category 2): "Fibril-forming alpha helix — determined by the uH threshold. If a peptide is predicted to be helical and its uH is higher than the threshold, it is predicted as a potential alpha-helical fibril-forming peptide."

**SSW**:
- Remove "aggregation" from "TANGO aggregation analysis" → just "TANGO analysis"
- Fix interpretation format: put Positive, Negative, N/A on separate lines
- Remove "potential amyloid/fibril former" from Positive interpretation
- Add: "There is no connection between the SSW prediction and the fibril-forming potential. Only after taking hydrophobicity into account." (Peleg's exact words from slide 26)

### FIX-028: FF-Helix % Info Note Verification
**Slide**: 41
The info tooltip that says "FF-Helix % measures intrinsic amino acid helix propensity using a sliding window (Fauchere-Pliska scale)..." needs to be COMPLETELY REWRITTEN.
- Fauchere-Pliska is a hydrophobicity scale, not helix propensity
- Remove CD spectroscopy mention
- Replace with scientifically accurate description per FIX-027

### FIX-029: Visualization Guide Text Corrections
**Slide**: 28
1. **Scatter Plot description**: Change "Identify peptides with optimal amphipathic properties" to something like "Identifies correlation between hydrophobicity and amphipathic nature of the peptide"
2. **Radar Charts Key Insights**: Change "Compare SSW vs No SSW cohorts" to "Compare No SSW vs SSW vs FF-SSW and No Helix vs Helix vs FF-Helix" (all 6 classification groups)

### FIX-030: Classification Help Panel Fixes
**Slide**: 29
1. Move FF-Helix classification explanation to the Peptide Metrics Explained page
2. Remove all CD spectroscopy mentions
3. FF-SSW Classification: Change "TANGO and S4PRED" to "TANGO **or** S4PRED"
4. Remove TANGO aggregation and SSW score from the Candidate Ranking System description. Peleg says: "We shouldn't look on the SSW score at all. It does not mean anything."
5. Clarify which aggregation thresholds are used in the Threshold Presets card

---

## Tier 5 — Minor UI Polish & Warnings

### FIX-031: S4PRED Length Warning — Simplify and Cite
**Slide**: 9
1. Peleg asks: "From where you get the information about the length limitation of S4PRED? Didn't find it in their paper or git" → Provide a citation or remove the claim.
2. Simplify the 2-line warning into 1 line: "4/12 sequences too short (<15 aa) for reliable S4PRED prediction" (show ratio, remove the second line about "optimal range")

### FIX-032: Display Threshold Values Separately
**Slide**: 33
Peleg suggests: "Maybe we should find a place to mention the uH and H mean values that were determined as a threshold in a way that is separate from all the analysis"
**Action**: Add a small info panel or section (perhaps at the top of the Results page or in the sidebar) that shows the current threshold values being used:
- uH threshold: 0.51 (computed from dataset median)
- Hydrophobicity threshold: 0.50 (computed from dataset median)
This gives users transparency about what values drive the classifications.

---

## Summary of Positive Feedback (Keep These!)

Peleg also noted things she LIKES — do NOT change these:
1. **"The AlphaFold part is amazing!"** (slide 1) — Keep the AlphaFold integration
2. **"I love that there is an option to open things and that not everything is exposed from the beginning"** (slide 1) — Keep the progressive disclosure UI pattern
3. **"I love how this graph looks"** about the Aggregation Propensity lollipop chart (slide 37) — She likes the design, just wants consistency

---

## Execution Order for Claude Code

1. Read this entire file first
2. Start with FIX-001 (4-category classification) — this is foundational and affects everything
3. Then FIX-002 (threshold restructuring) — depends on understanding the 4 categories
4. Then FIX-003 (terminology sweep) — do this as a global pass
5. Then work through Tier 1 fixes (FIX-004 through FIX-008) — dashboard/table
6. Then Tier 2 (FIX-009 through FIX-018) — peptide detail page
7. Then Tier 3 (FIX-019 through FIX-025) — charts and rankings
8. Then Tier 4 (FIX-026 through FIX-030) — help/metrics text
9. Finally Tier 5 (FIX-031 through FIX-032) — polish

**After each fix**: Run `make ci` to ensure nothing breaks. Commit with descriptive messages.

**Items requiring discussion with Peleg/Alex** (flag but don't block):
- FIX-002: "Agg Per-Residue %" threshold — keep or remove?
- FIX-012: TANGO 5% threshold justification
- FIX-013: Consensus tier system — remove or document?
- FIX-015: Interpretation notes decision tree
- FIX-022: How to handle charge (absolute vs signed)
- FIX-023: How to handle missing values in correlation
