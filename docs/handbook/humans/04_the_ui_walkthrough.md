# 04 — The UI Walkthrough

*What each page on PVL does, and what your eye should land on first.*

PVL is a single-page React app. The landing page (`/`) uses a top navigation bar; every other page uses a fixed left sidebar. There is no login — your dataset lives in the browser (a persisted Zustand store), which is why a detail page can survive a reload but a hard cache-clear wipes your results.

> **Screens are sketches.** The ASCII captions below approximate layout. Real screenshots land in Wave 11.

### A note on colour (verified against `ui/src/lib/sswColor.ts` + `ui/src/index.css`)

Colour means different things in different places — don't over-read it:

- **Per-residue secondary structure** (Sequence Track, [S4PRED](./02_the_science.md#3-s4pred) chart): Helix = **blue**, Beta strand = **orange**, Coil = **grey**.
- **[SSW](./02_the_science.md#6-ssw) residue highlight** (Sequence Track, Aggregation Heatmap, [Mol*](./02_the_science.md#9-alphafold--mol) overlay): **magenta `#E040FB`** (chameleon-sequence convention).
- **Class badges:** FF-Helix = **green**, SSW = **medium blue**, FF-SSW = **dark green** (same family as FF-Helix). FF-SSW is *not* red in the shipped build — the only reds are the [TANGO](./02_the_science.md#2-tango) aggregation overlay and the "current peptide" scatter dot.

The [four classes](./02_the_science.md#1-the-four-class-system) are **Helix / FF-Helix / SSW / FF-SSW**. See [`./03_the_pipeline.md`](./03_the_pipeline.md) for how they're computed and [`./05_use_cases.md`](./05_use_cases.md) for task → page-sequence recipes.

## Contents

- [1. Landing](#1-landing)
- [2. Quick Analyze](#2-quick-analyze)
- [3. Upload](#3-upload)
- [4. Results dashboard](#4-results-dashboard)
- [5. PeptideDetail](#5-peptidedetail)
- [6. Compare (A vs B)](#6-compare-a-vs-b)
- [7. MetricDetail](#7-metricdetail)
- [8. About](#8-about)
- [9. Help](#9-help)
- [10. NotFound (catch-all)](#10-notfound-catch-all)

---

## 1. Landing

`/`

```
[ Peptide Visual Lab ]      ( molecular globe )
 One paste, full profile.
 [ Start Analysis ]  [ Try Quick Analyze ]
 ┌ Sequence Input ─────────────┐
 │ GVGDLIRKAVSVIKNIV  (typing) │
 │ ▆▆▆▆▆▆▆▆▆▆ helix track      │
 └─────────────────────────────┘
```

**What the user does here.** Reads the pitch, watches the hero animate a live Uperin 3.5 sequence + helix track, then picks a path: **Start Analysis** (batch) or **Try Quick Analyze** (single sequence). Below the fold are How-It-Works, feature/algorithm showcases, a pipeline diagram, and the citation block.

**The two most important elements.** (1) The two hero CTAs — they fork the entire product into batch vs. single. (2) The animated Sequence Input card: it's a working preview of the core output (residue-coloured structure track), so a researcher knows in three seconds what they'll get.

**What's NOT here.** No analysis runs on this page — the hero is pre-baked mock data, not a live predictor.

**For power users.** "Start Analysis" → `/upload`; "Try Quick Analyze" → `/quick`. You can deep-link straight to either and skip the landing entirely.

---

## 2. Quick Analyze

`/quick`

```
 Quick Analyze
 [ Sequence: MRWQEMGYIFYPRKLR ] [ Name (opt) ]
 Threshold mode: ( Default | Recommended* | Custom )
 Try: [Uperin 3.5] [LL-37] [KLVFF]   [ Analyze ▸ ] [ Batch mode ]
 ─ results ─ KPI strip + PeptideViewer
```

**What the user does here.** Pastes one peptide, optionally names it, picks a threshold mode (Recommended is default), and hits Analyze. Length is validated live: under 5 aa is rejected, 5–15 aa warns that S4PRED is unreliable, over 40 aa warns the row falls outside the pipeline's design range. Chemical modifications (e.g. `Ac-…-NH2`) are detected and stripped with a note.

**The two most important elements.** (1) The **Threshold mode selector** — "Recommended" silently swaps in single-sequence reference μH/hydrophobicity gates, so a researcher must know which thresholds produced a class call. (2) The result **`PeptideViewer`** + 4-class KPI strip, which is the same component QuickAnalyze and the detail page share — guaranteeing single and batch produce identical numbers.

**What's NOT here.** No ranking, no cohort comparison, no multi-peptide table — one sequence only. A navigation guard blocks you from leaving with unsaved results.

**For power users.** Example chips (Uperin 3.5, LL-37, KLVFF) one-click-fill the form. "Batch mode" animates a circular wipe to `/upload`.

---

## 3. Upload

`/upload`

```
 Start Analysis        Step ①Upload ──② Preview
 [ Upload file | Paste accessions ]
 Examples: (Fibril 118) (AMP 12) (Amyloid 9)
 [★ Gold Standard — Staphylococcus 2023 (2,916) ]
 ┌ drag & drop CSV·TSV·XLSX·FASTA ┐
```

**What the user does here.** Three entry modes. (a) **Upload a file** — CSV/TSV/XLSX/FASTA; columns are auto-detected (only `Sequence` is required), with a preview step, a QC banner that exports rejected rows, and a length-distribution warning. (b) **Paste accessions** — a textarea of UniProt IDs, validated/de-duped before fetching live from UniProt. (c) **Example / gold-standard demos** — one-click loaders.

**The two most important elements.** (1) The **example / Gold-Standard buttons** — the fastest way to see a populated dashboard with zero data prep; they hit a precomputed endpoint for instant loads when the artifact exists. (2) The **two-step indicator + Data Preview** — preview is where you catch a mis-mapped column or invalid sequences *before* spending compute.

**What's NOT here.** No per-row editing — fix data in your spreadsheet and re-upload. Pasted accessions go straight to fetch (no preview step like file upload has).

**For power users.** Upload cross-links to **`/search`** (Database Search) for querying UniProt directly. Precomputed example IDs (`peleg_118`, `gold_standard`) skip the live pipeline entirely.

---

## 4. Results dashboard

`/results`

```
 Analysis Results · 118 peptides    [TANGO][S4PRED][Legend][Re-run][Export▾]
 Reproducibility ribbon · Active thresholds
 [ KPI: Helix | FF-Helix | SSW | FF-SSW ]
 ( Data Table | Candidate Ranking | Charts & Analysis )
```

**What the user does here.** The command centre after any batch. Three tabs: **Data Table** (searchable/sortable/filterable, click a row → detail), **Candidate Ranking** (percentile-weighted scoring with presets, direction toggles, weight bars, Top-N shortlist export), and **Charts & Analysis** (distributions + correlation matrix). Provider badges show whether TANGO/S4PRED actually ran; quality banners flag partial/unavailable runs.

**The two most important elements.** (1) The **4-card KPI strip** (Helix / FF-Helix / SSW / FF-SSW) — the symmetric overview is the dataset's headline, and the cards are click-to-filter. (2) **Candidate Ranking** with the *Fibril-Formation Focus* preset — this is the "which peptides should I look at first" engine; weights are proportional and never TANGO-only.

**What's NOT here.** No second-dataset overlay — that's the Compare page. Empty store auto-redirects to `/upload`.

**For power users.** The URL is the citation: threshold + view state mirror live into a `?pv=…&t=…` permalink, so copying the address bar reproduces the exact view. Export yields FASTA, a PDF report, an HTML/SVG figure pack (permalink embedded), and methods BibTeX. "Re-run" repeats the last run with identical parameters.

---

## 5. PeptideDetail

`/peptides/:id`

```
 ← Back to Results    [Copy][FASTA][JSON][PDF][HTML][✦ Find Similar]
 P82042 ↗uniprot   ★★★★☆
 [SSW badge] [FF-Helix Candidate] [FF-SSW: No]
 Predicted Secondary Structure ▸ Sequence Track + legends
 Biochem comparison · Helical Wheel · Window Profiles · S4PRED · TANGO heatmap · 3D
```

**What the user does here.** The single-peptide deep dive. Classification pills sit first, then the residue-coloured Sequence Track with explicit colour legends, a biochemical comparison vs. the cohort, a Schiffer-Edmundson helical wheel (short helical peptides only), sliding-window profiles, the S4PRED chart, the TANGO aggregation heatmap, a cohort-context scatter, and the 3D structure card.

**The two most important elements.** (1) The **classification pill row** (SSW / FF-Helix / FF-SSW) directly under the ID — these are the binary class calls a researcher came for; the per-class % is deliberately a *feature*, shown in charts, not a pill. (2) The **"Predicted Secondary Structure" card** with the Sequence Track + dual legend — it ties residue colour to meaning and is the page's scientific anchor.

**What's NOT here.** The 3D card is **Phase 1**: an embedded EBI Mol* viewer (iframe) plus a local "prediction overlay map" residue bar. Programmatic per-residue overpaint/transparency and hover-sync are **Phase 2 — not shipped** (see [`../active/MOL3D_OVERLAY_SPEC.md`](../active/MOL3D_OVERLAY_SPEC.md)). The SSW-overpaint toggle is wired but inert until a plugin ref exists.

**For power users.** UniProt-format IDs become deep links to uniprotkb. "Find Similar" opens a vector-similarity drill-down. The page reads from the persisted store, so a `/peptides/:id` link survives a reload as long as the dataset is still loaded; otherwise you get "Peptide Not Found."

---

## 6. Compare (A vs B)

`/compare`

```
 Database Comparison
 [● Compare current dataset vs fibril-forming peptides (118) ▾]
 ┌ Database A (drop) ┐ ┌ Database B (drop) ┐
 ── A → B · Summary table (Δ) · Hydro/Length histograms · μH scatter ──
```

**What the user does here.** Compares two cohorts. Database A defaults to your current dataset (or upload one here); Database B comes from a dropped file or a bundled reference. A split-button loads **fibril-forming peptides (118)** in one click, and its chevron menu offers other references (e.g. the 2,916-peptide gold standard). Output: a side-by-side summary table with deltas, overlaid histograms (hydrophobicity, length), and a hydrophobicity-vs-μH scatter.

**The two most important elements.** (1) The **reference-dataset split button** — comparing your set against the validated fibril-forming 118 is the single highest-value action; it routes through the precomputed endpoint so it's instant. (2) The **Summary Comparison table's Δ (B−A) column** — colour-coded deltas are where the actual finding lives.

**What's NOT here.** Only **two** cohorts at a time — to compare three sets, run Compare twice. A size-mismatch banner warns when A and B differ by >20%. *Caveat:* the empty-state "Quick Analyze" nudge currently points at `/quick-analyze`, which 404s — use the sidebar's Quick Analyze (`/quick`) instead.

**For power users.** The chevron menu exposes every registered reference; references fall back to the live pipeline if no precompute artifact exists (the gold standard intentionally errors rather than run 20 minutes).

---

## 7. MetricDetail

`/metrics/:metricId`

```
 ← Results   FF-Helix %
 Definition card
 Distribution (histogram) or proportion (pie)
 Full peptide table
```

**What the user does here.** Drills into one metric (e.g. `ff-helix`, `hydrophobicity`, `charge`, `ssw-positive`). Shows the metric's definition, a distribution histogram or proportion pie across the dataset, and the full peptide table.

**The two most important elements.** (1) The **Definition card** — plain-language wording for exactly what the number means, so nobody mis-reads a column. (2) The **distribution chart** — where this metric sits across your whole cohort, the context the Data Table can't show at a glance.

**What's NOT here.** Not every metric has a chart — unrecognised IDs show "Metric not found." Some pie breakdowns are simplified placeholders. Requires a loaded dataset.

**For power users.** Reachable by direct URL `/metrics/<id>`; jump straight to a metric without going through Results.

---

## 8. About

`/about`

```
 Peptide Visual Lab · DESY — Landau Group
 About PVL · Credits (Peleg, Said, Golubev, Landau + ORCIDs)
 Dataset credit · Key Features (5 surfaces) · Providers
```

**What the user does here.** Reads what PVL is, who built it, and how to cite it. Credits list authors in citation order with ORCIDs; the Key Features panel describes the five surfaces (web, Python, CLI, MCP, Docker), and a providers card explains the `USE_TANGO` / `USE_S4PRED` env flags.

**The two most important elements.** (1) The **Credits block** — the canonical attribution (algorithms = Peleg Ragonis-Bachar, software = Said Azaizah, advisor = Golubev, corresponding = Landau). (2) The **Key Features list** — the honest scope statement of what the platform actually does.

**What's NOT here.** No interactive analysis. A Sentry test panel only appears in development mode.

**For power users.** ORCID links and the Ragonis-Bachar 2022 DOI are live; the README's Acknowledgements has the full external-predictor reference list.

---

## 9. Help

`/help`

```
 Help & Documentation
 Peptide Metrics (Peleg-verbatim) · Classification Definitions
 Visualization Guide · Colour Conventions · Pro Tips · Scientific Notes + references
```

**What the user does here.** Learns to interpret everything: metric definitions (hydrophobicity, μH, charge), the four classes (Helix / FF-Helix / SSW / FF-SSW) in Peleg's verbatim wording, a chart-reading guide, colour conventions, and a Scientific Notes section with the reference list and threshold provenance.

**The two most important elements.** (1) The **Classification Definitions card** — verbatim, accent-bordered class definitions; the authoritative source for what each class means. (2) The **"Why no aggregation class?" note** — it explains that TANGO is an *input*, not a class endpoint, which is the single most common conceptual mistake.

**What's NOT here.** No how-to-upload tutorial (that's this handbook) and no live data — Help is reference text only.

**For power users.** Results links here for the FF-Helix explanation; the References list cites Fauchère-Pliska, Eisenberg, Hamodrakas, S4PRED, and TANGO for methods sections.

---

## 10. NotFound (catch-all)

`*`  (any unmatched path)

```
        404
   Page not found
 [ ← Return to Home ]
```

**What the user does here.** Lands here on any unknown route and clicks back to `/`. The attempted path is logged to the console.

**The two most important elements.** (1) The **Return to Home** button — the only escape. (2) The **404 label** — confirms it's a routing miss, not a crashed analysis.

**What's NOT here.** There is **no dedicated `PermalinkRedirect` route** in the current build — despite the page name in older plans, permalinks are decoded inline on `/results`, not by a separate redirect page. Unknown paths simply fall through to this catch-all.

**For power users.** Nothing actionable — but if a saved `/peptides/:id` or permalink lands you here, it usually means the route was mistyped (`/quick-analyze` instead of `/quick`) rather than missing data.

---

*Next: [`./05_use_cases.md`](./05_use_cases.md) — end-to-end task recipes mapping a research goal to the exact page sequence.*
