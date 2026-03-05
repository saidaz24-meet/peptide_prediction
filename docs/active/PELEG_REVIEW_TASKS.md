# Peleg's Holistic Review — Structured Task Document

## Completion Status (as of 2026-03-02)

| Chunk | Status | Notes |
|-------|--------|-------|
| 1: FF Data Layer | DONE | FF-Helix + FF-SSW flags in API & UI, Peleg's pipeline replicated |
| 2: Threshold Controls | DONE | CF propensity + helix min removed, aggregation flagging added, recalculate button |
| 3: Terminology & UX | DONE | Organisms, No SSW, Abbr tooltips, legend overlay, warning badges |
| 4: Graphs & Visualizations | DONE | Charts deleted/repositioned, Venn diagram, pipeline pies, AA composition, correlation matrix, lollipop chart, brush zoom |
| 5: Table & Filtering | DONE | FF filter categories, all columns sortable, sticky headers, KPI-to-table click filtering |
| 6: Candidate Ranking | DONE | 0-100 scale, weight sliders 0-1, presets, FF metrics included |
| 7: Peptide Detail | DONE | FF badges, feature comparison biochem-only, full-length μH, proline simplified |
| 8: Parked Items | PARKED | Compare 5+ tables, UI redesign, K8s — deferred per plan |
| 9: Cross-Cutting | ONGOING | FF shown everywhere, aggregation demoted, user-friendly language |

---

## ⚠️ HOW TO USE THIS DOCUMENT (READ FIRST)

This document contains the complete, organized notes from Peleg's holistic review of PVL. Every word from the original review is preserved because **each phrase carries implementation intent** — do not skip or paraphrase anything.

### Workflow Protocol

1. **PLAN MODE FIRST** — Before touching any code, go through this entire document in plan mode.
2. **ASK QUESTIONS** — If ANY item is ambiguous, unclear, or could be interpreted multiple ways, **stop and ask the user before assuming**. Do not guess intent. Do not infer meaning. Ask.
3. **Research before deciding** — Many items below are marked `[DECIDE AFTER RESEARCH]`. For these, you MUST:
   - Search the web for best practices, UX research, or scientific context
   - Examine the codebase to understand current implementation
   - Present your findings and recommendation to the user
   - Wait for approval before implementing
4. **Chunk execution** — Each section below is designed to be a manageable prompt session. Do NOT attempt to do everything in one pass. After finishing a chunk, summarize what was done and what's next.
5. **Think deeply** — For every task, consider: Does this also affect FF (fibril formation) data? Does this touch the peptide detail page AND the main results page? Does this conflict with another task in this document?

### Priority Tiers

| Tier | Meaning | When |
|------|---------|------|
| 🟢 DO NOW | Can be done immediately, low risk, clear intent | Current sprint |
| 🟡 INVESTIGATE FIRST | Needs codebase + web research before implementation | Prompt in focused chunks |
| 🔴 PARK FOR LATER | Depends on UI redesign or is a large standalone feature | After UI redesign phase |
| 🔵 DECISION NEEDED | Claude Code must research and propose, user must approve | Before implementation |

---

## CHUNK 1: New Data Layer — Fibril Formation (FF) Columns

> **This is the highest-priority structural change. Everything else depends on understanding and integrating FF data correctly.**

### 1.1 🟡 Investigate Peleg's Output Table

**Original notes (preserved exactly):**
> "investigate again the final table that peleg's folder is returning, it has fibril formation columns which are the most important ones, we need to always prioritize for them…not only show the ssw+-, and the s4pred per residue predictions, but use her specific tested way to calculate fibril formation, and treat it as a very important part of our project. and show it where it needs to be in the ui in all different places but watch out for repetitiveness. from now on you have a new type of data to show and work with, all the comments below you need to think if they are also relevant to the ff or not and act accordingly."

**Action required:**
- Look at Peleg's returned Excel file in her folder. Find ALL columns.
- **Show the user every single column name and its values** so we can map them together.
- Research what each column means biochemically.
- Identify which columns relate to: SSW, α-helix, FF SSW, FF α-helix, hydrophobicity/μH, confidence/diff scores.

### 1.2 🟡 Understand the Four Core Categories

**Original notes (preserved exactly):**
> "everything needs fibril formation ( not just ssw+ or - ) we need to take it from another column, fibril forming a helical and fibril forming ssw."
>
> "she uses both a helix prediction and ssw, then she uses with the biochemical calculations to see if muh is above average then we say its a helix fibril formation ( so we have 4 things, ssw, a helix, ff a helix, ff ssw that is connected with hydrophobicity/muh )"

**The four core data categories are now:**
1. **SSW** — Switching peptides (from TANGO)
2. **α-Helix** — Helix predictions (from S4PRED)
3. **FF α-Helix** — Fibril-forming helical (calculated using μH/hydrophobicity thresholds)
4. **FF SSW** — Fibril-forming switching (calculated using biochemical thresholds)

**Action required:**
- Map each of these four categories to specific columns in Peleg's output.
- Understand the calculation pipeline: How does Peleg go from SSW → FF SSW? From α-helix → FF α-helix?
- Document the biochemical calculation that uses μH (hydrophobic moment) to determine FF status.
- **ASK THE USER**: Confirm your understanding of the pipeline before building anything.

### 1.3 🟡 FF Threshold Controls (New, Replaces Old Thresholds)

**Original notes (preserved exactly):**
> "here there is another option for threshold control in those calculations but these ones really need careful investigation, and get a warning for changing them from peleg's defaults, because peleg's ones are really tested so let user change only if he has been warned."

**Action required:**
- Identify which calculations have configurable thresholds (μH average, hydrophobicity cutoffs, etc.).
- These thresholds REPLACE the old CF propensity and helix minimum thresholds (see Chunk 2).
- Implement a warning system: If user changes from Peleg's defaults, show a clear warning explaining these are rigorously tested values.
- **[DECIDE AFTER RESEARCH]**: What is the best UX pattern for "expert-only" threshold controls with warnings? Research how other scientific tools handle this (e.g., BLAST advanced parameters).

### 1.4 🟡 Analyze ALL Columns — The "Diff" and Last Columns

**Original notes (preserved exactly):**
> "she has alot of columns, show me all of them, the diff one is basically tells us how confident it is"
>
> "the last columns in her table, lets analyze each one of them, they are very important everything that has to do with ff helix and ff she is looking at all of them and using biocalcs to get out with results that are important."
>
> "there is no ff helix jpred score value, it doesnt help, but the ff helix does."
>
> "please go over all of the columns she returns, research how helpful they are, and research the best way for us to show them and give them attention or maybe additions, but also see if this is the ultimate way to show them if not lets add additions or edits."

**Action required:**
- List every column from Peleg's output Excel.
- For each column: What does it mean? How is it calculated? Is it useful for the UI?
- The "diff" column = confidence indicator. Research how to best visualize confidence.
- FF Helix JPred score → NOT useful, skip it. FF Helix itself → VERY useful.
- **Present findings to user**: For each column, recommend: show prominently / show in details / hide / needs further research.

### 1.5 🟡 Hydrophobic Moment (μH) — Full Length vs S4PRED Calc

**Original notes (preserved exactly):**
> "instead of hydrophobic moment we can show according to the full length or s4pred calc, it is calculated according to the average of hydrop in the uploaded csv, then if its one sequence we can either set a default threshold, or have the user able to change it."

**Action required:**
- Understand the two ways μH is calculated: full-length average vs S4PRED-based.
- For batch uploads (CSV): μH threshold = average from the uploaded dataset.
- For single sequence: Need either a default threshold OR let user set it.
- **[DECIDE AFTER RESEARCH]**: What default μH threshold is scientifically reasonable? Research literature values.
- **ASK THE USER**: Should single-sequence mode use a hardcoded default or require user input?

### 1.6 🟢 Dashboard Summary — FF Percentages at the Top

**Original notes (preserved exactly):**
> "% ff a helical, % ff ssw peptides in the main one main dashboard in the top. no need for agg hotspot or whatever because we dont trust them. how much a helics, how much ssw."

**Action required:**
- In the main results dashboard, the top summary cards should show:
  - % FF α-helical peptides
  - % FF SSW peptides
  - How many are α-helix
  - How many are SSW
- REMOVE aggregation hotspot from the dashboard summary (we don't trust TANGO aggregation enough for top-level display).
- Keep aggregation data available in peptide details but not as a headline metric.

---

## CHUNK 2: Threshold Controls — Remove Old, Add New

### 2.1 🟢 Remove CF Propensity % from Threshold Control

**Original notes (preserved exactly):**
> "CF propensity % threshold, we dont need it in the threshold control"

**Action required:**
- Remove CF propensity percentage threshold from the threshold control panel.

### 2.2 🟢 Remove Helix Minimum from Threshold Control

**Original notes (preserved exactly):**
> "helix minimum we also dont need it in thresholds control"

**Action required:**
- Remove helix minimum threshold from the threshold control panel.

### 2.3 🟡 Aggregation Hotspot Thresholds — Replace with Smart Flagging

**Original notes (preserved exactly):**
> "agg hotspot thresholds, if one exceeds something that shouldnt be exceeded we will flag it and not do it ( warn him on the spot )"
>
> "or one residue that doesnt have gaps with 5%+ aggregation, or percent of aggregation from the length ( if length is 20 and its 5% then if more than 4 residues are aggregation then its aggregate )."
>
> "if we have 40 aa, only 5 have ssw then we would just delete the fact that this is switchness and the threshold is larger then we say its not aggregate. ( control the percent of aa that would make it aggregate or anything…this is what i meant by giving the user threshold for aggregation, same as s4pred if there is something we can let it control. so replace thresholds with those comments)."

**Action required:**
- The OLD threshold controls are being REPLACED with these new intelligent flagging rules:
  1. **Absolute flag**: If any single value exceeds a dangerous threshold → flag immediately and warn on the spot.
  2. **Contiguous residue rule**: If one residue has no gaps and 5%+ aggregation → flag.
  3. **Percentage-of-length rule**: If (aggregation residues / total length) exceeds threshold → flag as aggregate. Example: length=20, threshold=5% → if >4 residues are aggregation → flag.
  4. **SSW deletion rule**: If only a small fraction of residues show SSW and the threshold says it's too few → remove the SSW classification entirely.
- Let user control the PERCENTAGE threshold for what makes something "aggregate" (similar to how we'd let them control S4PRED thresholds if applicable).
- **[DECIDE AFTER RESEARCH]**: What are sensible default percentages? Research TANGO documentation and aggregation literature.
- **ASK THE USER**: Confirm the exact flagging logic before implementing. The notes describe several overlapping rules — clarify priority and interaction between them.

### 2.4 🟡 Recalculate Button in Threshold Control

**Original notes (preserved exactly):**
> "do the threshold again, with a recalculate option that shows only in the card of control ( and then actually send it back to calculation or see how does it work client side and is it helpful ) and keep the same filters in the threshold what it shows (or just have the same controls as the one we did earlier with the filters in the main table also present in the main threshold control in the main results page at the bottom )"

**Action required:**
- Add a "Recalculate" button to the threshold control card.
- **[DECIDE AFTER RESEARCH]**: Does recalculation happen client-side (re-filtering/re-scoring existing data) or server-side (re-running the pipeline with new thresholds)? Investigate what's feasible and what adds real value.
- The threshold control should have the same filter controls that exist in the main results table.
- Or: the main results table filters should also appear in the threshold control panel at the bottom of the results page.
- **ASK THE USER**: These are two different UX approaches — which one do you prefer? Or should both exist?

---

## CHUNK 3: Terminology & UX — Making It Easy for Non-Researchers

### 3.1 🟡 Full Terminology Scan & Simplification

**Original notes (preserved exactly):**
> "( instead of 15aa show for sequences shorter than 15 amino acids …do a whole scan of the terminology used during the app, and lets make it a bit easier where its difficult to understand for non researchers to understand in a fun way) ( phrase straight forward )"

**Action required:**
- Do a COMPLETE scan of every piece of text in the entire app.
- For each technical term, evaluate: Would a non-researcher understand this immediately?
- Replace abbreviations with full phrases where they appear for the first time.
- Example: "15aa" → "sequences shorter than 15 amino acids"
- Keep it "fun" and "straightforward" — not dumbed down, but accessible.
- **[DECIDE AFTER RESEARCH]**: Research UX writing best practices for scientific tools. How do tools like Galaxy Project, UniProt, or AlphaFold handle terminology for mixed audiences?

### 3.2 🟡 Legend / Glossary for First-Time Users

**Original notes (preserved exactly):**
> "for first time users show the legend as soon as they enter the website, then have ff = fibril forming, and ssw = switching…"

**Action required:**
- Create an onboarding legend/glossary that shows automatically for first-time users.
- Key abbreviations to define: FF = Fibril Forming, SSW = Switching, μH = Hydrophobic Moment, etc.
- **[DECIDE AFTER RESEARCH]**: What's the best UX pattern for this? Options include:
  - A one-time overlay/modal on first visit
  - A persistent sidebar glossary
  - Tooltips on every abbreviation
  - A combination
  - Research how Notion, Figma, or scientific tools do onboarding glossaries.

### 3.3 🟢 Terminology Replacements (Specific)

**Original notes (preserved exactly):**
> "instead of species do organisms across all ui."
>
> "write no ssw instead of ssw negative"
>
> "always remember that we are trying to make it easy for user so write fibril forming ssw or have a clear legend"

**Action required:**
- Global find-and-replace across all UI:
  - "species" → "organisms"
  - "SSW negative" / "SSW-" → "No SSW"
  - "SSW positive" / "SSW+" → "SSW"
  - Where space allows, write "Fibril Forming SSW" instead of "FF SSW" (or ensure legend is visible).

### 3.4 🟡 Warning Badges — Instant Brain Wiring

**Original notes (preserved exactly):**
> "sequence length summary —> warning and then the title ( show terminology in context )."
>
> "( 4 sequences problematic!!, then title, no need for alot of text in warning badges cards, lets make it wire with the user's brain instantly when he sees it and make our user experience as easy as possible…I want you to research how to upgrade UX elements and understand the psychology behind how users will use our website, then always remember to look at our users as stupid, and help them navigate everything the right way without too much cognitive need from them)"

**Action required:**
- Redesign warning badges/cards across the app:
  - Lead with the NUMBER and urgency: "4 sequences problematic!!" FIRST, then the title/explanation.
  - Minimize text. No paragraphs in warning cards.
  - The warning should "wire with the user's brain instantly."
- For sequence length summary: Show as warning → then title → then show terminology in context.
- **[DECIDE AFTER RESEARCH]**: Research the psychology of warning design:
  - How do users scan warning badges? (F-pattern, Z-pattern?)
  - What color/size/position creates instant recognition?
  - Research how Stripe, Linear, or Datadog design their alert cards.
  - Research cognitive load theory and how to minimize it in data-heavy UIs.
- Treat users as if they need maximum hand-holding — every interaction should be self-explanatory.

---

## CHUNK 4: Graphs & Visualizations — Overhaul

### 4.1 🟢 Graphs to DELETE (Clear Removals)

**Original notes (preserved exactly):**
> "hydro vs muh is not good, delete it."
>
> "net charge vs sequence length graph is not good just delete."
>
> "Aggregation Risk by Peptide : delete."
>
> "FF-Helix % vs Aggregation Max graph we dont need it, again agg tango we dont trust it that much this is why we developed an alternative, so keep it in the peptide page but in the main charts delete it."

**Action required — DELETE these graphs from the main charts page:**
- Hydrophobicity vs μH graph
- Net charge vs sequence length graph
- Aggregation Risk by Peptide graph
- FF-Helix % vs Aggregation Max graph (DELETE from main charts, but KEEP in individual peptide detail page)

### 4.2 🟢 Graph Repositioning

**Original notes (preserved exactly):**
> "put muh near muhs graphs ( in the same row )"
>
> "sequence length distribution should go down ( shouldn't be at the top of the charts page."

**Action required:**
- Move μH graph to be in the same row as related μH graphs.
- Move sequence length distribution chart DOWN — it should not be at the top of the charts page.

### 4.3 🟡 Venn Diagram — Replace SSW+/- Graph

**Original notes (preserved exactly):**
> "instead of having ssw+/- graph, lets have venn diagram, when clicking on one of them we will see ( ssw+, ssw-, ff helixes, ff ssw, etc )."

**Action required:**
- Remove the current SSW+/SSW- graph.
- Replace with an interactive Venn diagram showing the overlap between categories.
- Clicking on a segment should filter/show the peptides in that category.
- Categories to show: SSW, No SSW, FF Helix, FF SSW, α-Helix, etc.
- **[DECIDE AFTER RESEARCH]**: What's the best library for interactive Venn diagrams in React? Research: d3-venn, venn.js, recharts custom, or a completely different visualization that shows set overlaps better (UpSet plot? Euler diagram?). Consider what is most intuitive for users.

### 4.4 🟡 Pie Charts — FF Integration

**Original notes (preserved exactly):**
> "write no ssw instead of ssw negative, then also have ff and everything in the same one pie, who got out of the ssw, then who showed in the ff ssw and got to the second part."
>
> "no helix, helix, then ff a helix."
>
> "and then the same for ff ssw, but again always remember that we are trying to make it easy for user so write fibril forming ssw or have a clear legend"

**Action required:**
- Redesign pie charts to show the full pipeline:
  - **SSW Pie**: No SSW → SSW → (of those SSW) → FF SSW. Show the funnel: how many started as SSW, how many made it to FF SSW.
  - **Helix Pie**: No Helix → α-Helix → (of those Helix) → FF α-Helix. Same funnel logic.
- Use clear labels: "No SSW" (not "SSW Negative"), "Fibril Forming SSW" (not "FF SSW") or have legend visible.
- **[DECIDE AFTER RESEARCH]**: Is a nested pie / sunburst chart better than separate pies for showing this funnel? Research which visualization best shows "subset of a subset" relationships.

### 4.5 🟡 Amino Acid Composition — Comparative Graph

**Original notes (preserved exactly):**
> "do amino acid composition according to the ( no ssw, ssw, ff ssw , no helix, a helix, ff a helix ) do one graph that compares their amino acid."

**Action required:**
- Create a NEW amino acid composition chart that compares composition across all six categories:
  - No SSW, SSW, FF SSW, No Helix, α-Helix, FF α-Helix
- This should be a single comparative visualization (not six separate charts).
- **[DECIDE AFTER RESEARCH]**: Best chart type for comparing amino acid distributions across 6 groups? Options: grouped bar chart, heatmap, radar chart, stacked bar, parallel coordinates. Research what proteomics tools use.

### 4.6 🟡 Correlation Matrix — Major Upgrade

**Original notes (preserved exactly):**
> "correlation matrix, change those values, then also lets make it alot more upgraded to useful, and try our best to find correlations and do it in a very informative way ( research gpt claude code to see how to do it exactly in the backend in the best highest top tier level correlation no need for heatmap unless its the best way)."

**Action required:**
- The current correlation matrix values need to be changed (likely to include FF-related metrics).
- Upgrade the correlation analysis to be genuinely informative and top-tier.
- **[DECIDE AFTER RESEARCH]**: This is a major research task:
  - What correlations are scientifically meaningful for peptide researchers? (SSW vs FF, μH vs FF, length vs aggregation, etc.)
  - What's the best statistical method? Pearson? Spearman? Mutual information?
  - What's the best visualization? Heatmap might be fine if done well. Or: interactive correlation explorer, scatterplot matrix, network graph of correlations?
  - Research how tools like CorrelationAnalyzer, seaborn, or Plotly handle this.
  - Research if there's a way to highlight "surprising" or "important" correlations automatically.
- **ASK THE USER**: What specific values/metrics should be in the correlation matrix now that FF data exists?

### 4.7 🟡 Expanded Graph — Zoom & Axis Labels

**Original notes (preserved exactly):**
> "the expanded graph is cut as you can see in the screenshots i cant see the namings of the x & y lines, lets also upgrade the zoom functionality, it isnt smooth, it is very messy, and i cant understand it."

**Action required:**
- Fix the expanded graph: axis labels (x & y) are being cut off / not visible.
- Zoom functionality needs a complete overhaul — currently "messy" and confusing.
- **[DECIDE AFTER RESEARCH]**: Research smooth zoom implementations:
  - Scroll-to-zoom with smooth animation?
  - Pinch-to-zoom on mobile?
  - Zoom slider control?
  - Reset zoom button?
  - Research how Plotly, Highcharts, or Observable handle graph zoom. What feels most natural?

### 4.8 🟡 TANGO SSW Residue Counts (Table, Not Graph)

**Original notes (preserved exactly):**
> "how much from the residues showed tango ssw and how much didn't ( this one we can show it in the table, but no need for graphs )"

**Action required:**
- Add to the results table: count/percentage of residues that showed TANGO SSW vs didn't.
- Do NOT create a separate graph for this — table column only.

---

## CHUNK 5: Results Table & Filtering

### 5.1 🟢 Filter Separation — FF Categories

**Original notes (preserved exactly):**
> "no need for cf propensity in the filters."
>
> "separate in the filters for also ff a helix, and ff helix and separate them from the ssw its different ( this is for filtering the table in the main results page )"
>
> "a helix ff helix, ssw, ssw helix."

**Action required:**
- Remove CF propensity from the table filters.
- Add new filter categories that are SEPARATED:
  - α-Helix (separate filter)
  - FF α-Helix (separate filter)
  - SSW (separate filter)
  - FF SSW (separate filter)
- These must be separate filters, not grouped together — they are different things.

### 5.2 🟡 Show FF Data in Existing Visualizations

**Original notes (preserved exactly):**
> "i would show them together, bottom line everything that has ff with it is important fibril forming is what is important. lets add visualizations. (keep full length muh in the bottom of each peptide with the full length )…a helix, then ff a helix, etc. we can also show percentage."

**Action required:**
- Everywhere we currently show SSW or α-helix data, also show the FF versions.
- Show them together but clearly differentiated.
- Keep full-length μH visible at the bottom of each peptide view.
- Show progression: α-helix → FF α-helix, with percentages.
- **Watch out for repetitiveness** — the data should appear where it's useful but not be duplicated unnecessarily across views.

---

## CHUNK 6: Candidate Ranking — Deep Overhaul

### 6.1 🟡 Research & Redesign the Ranking System

**Original notes (preserved exactly):**
> "do the ranking easier for user, do from 0.1, or % out of 100. delete the ff flag from the ranking and add only what should be added ( this is for the candidate ranking tab in the results page we need to deeply research it, what it does, and is it the ultimate way to do it? if not, lets work on making it as advanced easy to use and navigate as a user, and clear as possible )."
>
> "do it more easy, separate it visually beautiful for the users from 0-100 add ff a / ssw to the ranking ( maybe one option would be to have it all in one bar, or have it another type of bars for ranking..whatever you think is best ( research top companies and ranking systems how do they do it and make it clear for the user."

**Action required:**
- This is a DEEP RESEARCH task before any implementation:
  1. Understand what the current ranking system does — every metric, every weight, every formula.
  2. Evaluate: Is it the ultimate way to rank peptide candidates? If not, what's better?
  3. Research how top companies do ranking/scoring systems:
     - How does Google PageRank visualize scores?
     - How do financial tools show risk scores?
     - How do drug discovery platforms rank candidates?
     - How do gaming leaderboards make ranking intuitive?
  4. Redesign the ranking to be:
     - Scale: 0-100 (percentage) or 0.0-1.0 (decimal) — user-friendly, not raw scores.
     - Visually beautiful and separated.
     - Include FF α-helix and FF SSW as ranking factors.
     - Remove the current "ff flag" from ranking (whatever that is currently — investigate).
  5. Consider visualization options: single composite bar, multi-bar breakdown, radar chart per peptide, ranked list with visual scores.
- **ASK THE USER**: After research, present 2-3 ranking design options with mockup descriptions. Let user choose direction.

---

## CHUNK 7: Peptide Detail Page

### 7.1 🟡 Feature Comparison Scope

**Original notes (preserved exactly):**
> "in peptide details, feature comparison should compare only for biochemical calcs ( unless you think something else could be compared )"

**Action required:**
- The feature comparison in peptide details should default to comparing biochemical calculations only.
- **[DECIDE AFTER RESEARCH]**: Is there anything else worth comparing? Examine the data available per peptide and propose if any non-biochem comparisons would add value. If yes, present to user. If no, keep it biochem-only.

### 7.2 🟡 Proline / Amino Acid Display

**Original notes (preserved exactly):**
> "proline no need for helix breaker ( in the amino acids ) lets examine if the amino acid right now is the ultimate way and the most descriptive and useful way to show it and upgrade if not."

**Action required:**
- Remove "helix breaker" label/annotation from Proline in the amino acid display.
- **[DECIDE AFTER RESEARCH]**: Evaluate the current amino acid visualization:
  - Is it the most descriptive and useful way to show amino acid properties?
  - Research how UniProt, PDB, or other protein databases display amino acid annotations.
  - If the current way isn't optimal, propose upgrades.
- **ASK THE USER**: Present current state vs proposed improvement.

### 7.3 🔵 Sliding Windows — Evaluate Value

**Original notes (preserved exactly):**
> "sliding windows either upgrade or delete them think of how…lets examine how much they add, lets see what value researchers might use this for, and think if we can upgrade it dramatically to actually add a lot of value, if not delete it."

**Action required:**
- This is a DECISION task, not an implementation task:
  1. Examine the current sliding window feature — what does it show? How is it used?
  2. Research: Do peptide researchers actually use sliding window analysis? For what?
  3. Can it be upgraded dramatically to add real value? (e.g., interactive window size, overlay with FF data, comparative windows)
  4. If it can't be made dramatically valuable → recommend deletion.
- **ASK THE USER**: Present your research findings and recommendation (upgrade plan OR delete). Do not implement until approved.

### 7.4 🟢 Keep Full-Length μH in Peptide View

**Original notes (preserved exactly):**
> "(keep full length muh in the bottom of each peptide with the full length)"

**Action required:**
- Ensure full-length μH value is displayed at the bottom of each individual peptide detail view.

---

## CHUNK 8: Items to Park for Later

### 8.1 🔴 Compare Feature (5+ Tables)

**Original notes (preserved exactly):**
> "upgrade the list of parked items to include: compare feature with 5+ tables, this needs a serious upgrade with actual comparisons, but for now keep it as is parked list."

**Action required:**
- Add to the parked/roadmap list: "Compare feature upgrade — support 5+ tables with actual side-by-side comparisons."
- Do NOT implement now. This is for after the UI redesign.

### 8.2 🔴 UI Redesign (Entire Application)

Per the original plan: All functionality changes happen FIRST. The final UI redesign happens AFTER all functional tasks in this document are complete. Only then do we move to visual polish.

### 8.3 🔴 VM & K8s Connection

Per the original plan: After UI redesign, connect to VM and Kubernetes and continue with the expanding roadmap.

---

## CHUNK 9: Cross-Cutting Concerns

These apply to EVERY task above. Claude Code must check these for every change:

### 9.1 FF Data Everywhere

> "from now on you have a new type of data to show and work with, all the comments below you need to think if they are also relevant to the ff or not and act accordingly."

**Rule**: For EVERY UI element you touch, ask yourself: "Should FF data also be shown here?" If yes, add it. If unsure, **ASK THE USER**.

### 9.2 Aggregation Trust Level

> "no need for agg hotspot or whatever because we dont trust them."
> "agg tango we dont trust it that much this is why we developed an alternative"

**Rule**: TANGO aggregation data is secondary/low-trust. It can appear in:
- Individual peptide detail pages (for reference)
- NOT in dashboard summaries
- NOT as a primary metric in charts
- The FF-based calculations are the trusted alternative.

### 9.3 User-as-Stupid Principle

> "always remember to look at our users as stupid, and help them navigate everything the right way without too much cognitive need from them"
> "I want you to research how to upgrade UX elements and understand the psychology behind how users will use our website"

**Rule**: Every piece of UI must pass the "would a confused first-time user understand this in 3 seconds?" test. If not, simplify.

### 9.4 Repetitiveness Guard

> "show it where it needs to be in the ui in all different places but watch out for repetitiveness"

**Rule**: FF data should appear everywhere relevant BUT not be copy-pasted identically across views. Each view should show the data in the way that's most useful for THAT context.

---

## Execution Order (Recommended)

| Phase | Chunks | Rationale |
|-------|--------|-----------|
| **Phase 1** | Chunk 1 (FF Data Investigation) | Must understand the data before any UI changes |
| **Phase 2** | Chunk 2 (Threshold Overhaul) | New thresholds depend on understanding FF data |
| **Phase 3** | Chunk 5 (Table & Filters) + Chunk 3 (Terminology) | Can be done in parallel, medium effort |
| **Phase 4** | Chunk 4 (Charts Overhaul) | Largest visual change, needs FF data integrated |
| **Phase 5** | Chunk 6 (Ranking Redesign) | Deep research + implementation |
| **Phase 6** | Chunk 7 (Peptide Detail) | Refinements after main pages are done |
| **Phase 7** | Chunk 8 (Parked Items) | After all above + UI redesign |

---

## Before Starting Each Chunk

Claude Code MUST:
1. ✅ Read `CLAUDE.md` and `docs/active/*` per the documentation access rule.
2. ✅ Read this file's relevant chunk carefully.
3. ✅ Look at Peleg's screenshots and Excel files in the screenshots folder.
4. ✅ List all questions and ambiguities BEFORE writing any code.
5. ✅ Get user approval on the plan for that chunk.
6. ✅ For `[DECIDE AFTER RESEARCH]` items: do the research, present findings, wait for approval.
7. ✅ After completing a chunk: summarize files changed, verification commands, and what's next.

## Questions Claude Code Should Ask Before Starting

These are questions that MUST be answered before implementation begins. Claude Code should ask these (and any others it identifies) in its first plan-mode response:

1. Where exactly is Peleg's output Excel file? What is the file path?
2. Can you walk me through one example peptide's journey from raw sequence → SSW classification → FF classification? I want to make sure I understand the pipeline.
3. For the μH threshold: When it's a single sequence (no CSV average available), what default value should I use?
4. The aggregation flagging rules (Chunk 2.3) describe several conditions — should they ALL trigger independently, or is there a priority order?
5. For the correlation matrix: What specific metrics should I correlate? All available numeric columns? Or a curated subset?
6. The current ranking system — are there documented weights/formulas, or do I need to reverse-engineer them from code?
7. For terminology changes: Should "organisms" replace "species" everywhere including API response fields, or only in UI labels?
8. The Venn diagram (Chunk 4.3): How many peptides are we typically visualizing? This affects which library/approach works best.