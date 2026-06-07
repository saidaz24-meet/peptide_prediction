# Response to Peleg — Round 2 PowerPoint (Likoiim)

**Date**: 2026-05-18
**Reviewing**: `Peleg note (1).pptx` — 41 slides, sent 2026-05-18 with the Slack note "I still see some issues with the helix%, which still seems weird to me." (Hebrew: ליקויים — defects/shortcomings)
**Live URL**: http://94.130.178.182:3000
**Live commit at time of response**: `4534033` (Wave 2 merged 2026-05-18, includes V10-1 About hero, V10-3 progress unification, MCP route gaps, FASTA bulk upload, plus prior Wave 2 §A-§H fixes)

---

## TL;DR — read this first

The version of PVL you reviewed last week (2026-05-12) is **6 days older** than what's currently on the live URL. Many of the ליקויים you flagged in the PPT were caught in fixes that landed in between and are no longer present on the live site. **Please do a hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) before re-checking the helix% pages.**

Specifically:
- **§1 — already fixed in the current live build** (≈25 items): scientific-definition corrections (Fauchère-Pliska/CD spectroscopy/aggregation-vs-fibril), 4-class classification surfaced (Helix, FF-Helix, SSW, FF-SSW), KPI titles, terminology in most components, threshold panel re-grouped into 4 sections, Venn axiom enforced, Smart Ranking defaults fixed, **and a P0 dual-source desync bug your FF-SSW Slack question surfaced today — `SSW`/`FF-SSW` axiom violation on P85089 and P0C005, fixed at three layers with 9 invariant tests** (full detail in §1). Refresh and re-check.
- **§2 — caught from your PPT audit, fixing this week** (≈3 confirmed misses + a small set of UI polish items): "cohort" still appearing in the Evidence Panel, "Cutoff" suffix still on µH/Hydrophobicity threshold labels, a few chart axis labels missing.
- **§3 — items for our discussion** (5 items): Interpretation Notes co-design, Tier 1 / 80% certainty derivation, Smart Candidate Ranking parameters, P27 4-class labeling/ordering sign-off, P29 candidate ranking metric scope.
- **§4 — questions back to you** (4 items): citations and clarifications we can't answer without your input.
- **§5 — items needing your live-URL verification** (≈5 items): things that may have been resolved by Cowork but where we want your eyes before claiming victory.

---

## §1 — Already addressed in the current live build

Below: your verbatim concern (quoted), what we did, and where to verify. All of these landed in commits between 2026-05-12 and 2026-05-18.

### Scientific definitions

> **(slide 26, 30, 41)** "There is no connection to the Fauchère, J., and Pliska." / "The Fauchere-Pliska is a hydrophobicity scale. NOT secondary structure related at all." / "This note needs to be verified."

**Done.** Fauchère-Pliska is now correctly attributed as a hydrophobicity scale in 6 files (`ui/src/types/metrics.ts:66`, `ui/src/lib/profile.ts:3`, `ui/src/lib/ranking.ts:93`, `ui/src/lib/peptideReportPanels/biochem.ts:33`, `ui/src/lib/peptideReportPanels/methods.ts:53`, `Help.tsx`). The FF-Helix definition no longer claims helix propensity comes from Fauchère-Pliska — it now correctly says FF-Helix = s4pred helix prediction + µH threshold (matching your slide 27 4-class definition).
**Verify**: `/help` page, FF-Helix section.

> **(slide 26, 29, 30, 41)** "Again, why did you mention the CD here? We should not say anything about CD anywhere."

**Done.** All circular-dichroism / CD-spectroscopy framing has been removed from the UI. Only one comment remains in `Help.tsx:44` noting the removal — no user-facing text mentions CD.
**Verify**: `/help` and the FF-Helix interpretation notes anywhere in the app.

> **(slide 19, 22, 29)** "Aggregation is not equivalent to fibril or amyloid formation." / "There is a difference between aggregation and fibrillation."

**Done.** TANGO Aggregation Profile description now reads as per-residue aggregation propensity (per your suggested wording). Tier-1 "High-Confidence Switch Zone" text was rewritten. FF-SSW classification text no longer conflates aggregation with fibril formation.
**Verify**: PeptideDetail TANGO Aggregation Profile card and the Tier 1 panel.

> **(slide 18)** "The prediction here is in capitals where it shouldn't."

**Done.** "Single Sequence Secondary Structure PREDiction" → normal-case heading. Title is just "S4PRED Secondary Structure Probabilities."
**Verify**: PeptideDetail S4PRED card header.

> **(slide 18)** "No need to write on s4pred that is a neural network. Just s4pred is enough."

**Done.** "neural network" suffix removed from s4pred references.

### Classification scheme — the P27 4-class redefinition + the bug your Slack question caught

> **(slide 27)** "Instead of only these two we need to have 4 :  Alpha-helix secondary structure / Fibril-forming alpha helix / Secondary structure switch / Fibril-forming secondary structure switch."

**Done in code.** The 4 classes are first-class surfaces:
- `ui/src/components/charts/EulerDiagram.tsx` (Results Overview Venn): 4 sets — Helix, FF-Helix, SSW, FF-SSW.
- `ui/src/lib/setDiagram.ts:328-365`: enforces visually that FF-Helix ⊆ Helix and FF-SSW ⊆ SSW.
- `ui/src/components/ResultsKpis.tsx:199-298`: 4 KPI cards (Total, FF-Helix, SSW, FF-SSW). [Note: we currently show Total + 3 classifications. See §3 item D2 — we want your sign-off on whether to add a 5th card for the standalone Helix base class.]

> **(your Slack 2026-05-19)** "How is it possible that the peptide is predicted to be FF-SSW, but not predicted to be SSW? Is it because two predictions come from Tango and S4PRED and they don't correspond?"

**You were exactly right.** P85089 (len 14) and P0C005 (len 10) led us to a dual-source desync bug we missed during Wave 2. The reference function in `backend/auxiliary.py` enforced the axiom correctly, but the production path was:

- `sswPrediction` (what the "SSW" pill reads) → shipped the **TANGO-only** column
- `ffSswFlag` (what the "FF-SSW" pill reads) → computed from the **unified TANGO ∪ S4PRED mask**

Whenever TANGO said "no SSW" but S4PRED said "yes" and hydrophobicity met the cutoff, the API emitted `sswPrediction = -1` alongside `ffSswFlag = 1` — the axiom-violating row you saw.

Filed as **ISSUE-032 (P0)** and fixed today (2026-05-19) at three layers:

1. **`backend/services/dataframe_utils.py`** — one unified SSW column drives both pills. The raw TANGO column is preserved for audit + provider-status detection, but is no longer the API source of truth for `sswPrediction`.
2. **`backend/services/normalize.py`** — new `_enforce_ff_axioms()` runs at the API serialization boundary. If any upstream regression produces a row with `ffSswFlag=1` and `sswPrediction≠1` (or the mirror for FF-Helix), it logs the violation and clamps the FF flag to `-1`. Defense in depth — the API contract is honored even if upstream regresses.
3. **`backend/tests/test_axiom_invariants.py`** — 9 tests pinning both axioms (`FF-SSW → SSW`, `FF-Helix → Helix`). Suite passed (535 tests).

The canonical SSW definition now matches your slide 27 verbatim: **SSW = TANGO or S4PRED predicts a structure switch** (OR, never AND). This is also documented as a formal API contract in `docs/active/CONTRACTS.md`.

This is almost certainly the structural defect downstream of the helix%/FF oddness you flagged across both review rounds. Please re-check P85089 and P0C005 on the live URL after a hard refresh — the `SSW` and `FF-SSW` columns should now agree (both true, or both false). If you still see an axiom violation, that's a new bug and we want it.

**Verify**: `/results` — the Results Overview Venn now has 4 circles; the KPI strip across the top; check P85089 and P0C005 specifically.

### Terminology + wording

> **(slide 32)** "Use Results and not pipeline"

**Done.** "Pipeline Overview" → "Results Overview", "Pipeline Intersections" → "Results Intersections" (`EulerDiagram.tsx:33`, `UpsetMatrix.tsx`).
**Verify**: `/results` chart headings.

> **(slide 10)** "the helix shouldn't be all capitals" / "the uH should be the Greek letter mu and not capital U" / "The title should be first % then the FF-something."

**Done.** KPI subtitles now use "Helical + μH above threshold" (Greek mu, normal case). KPI titles are `% FF-Helix`, `% SSW`, `% FF-SSW` (percent-prefix).
**Verify**: `/results` KPI cards (top of page).

> **(slide 15)** "I would use the name database instead of a cohort."

**Partial — see §2 below.** The Biochemical Feature Comparison title was renamed (`BiochemComparison.tsx`), and the radar chart heading is now "Biochemical feature comparison" (per your slide 15 + 16). But the word "cohort" still appears in **EvidencePanel.tsx** (6+ instances) — this is one of our confirmed misses, fixing this week.

### Threshold panel restructure (slides 2-8)

> **(slides 2-8)** Re-partition into 4 groups: General secondary structure / Helical / Secondary structure switch / Fibril-formation.

**Done.** `ui/src/components/ThresholdConfigPanel.tsx` now has the 4 groups with your exact section names. Labels are full words ("Minimal") not abbreviations ("Min"), per your slide 2 directive.
**Verify**: Upload page → Advanced: Threshold Configuration.

### Charts and rankings

> **(slide 38)** "The SSW score and diff should not be values in this correlation since these numbers do not have real meaning… Also the aggregation max."

**Done.** `ui/src/lib/correlationMatrix.ts` — SSW Score, SSW Diff, and Agg Max are excluded from the default correlation matrix (`DEFAULT_CORRELATION_METRICS`).
**Verify**: `/results` Correlation Matrix.

> **(slide 39)** "The Tango aggregation should not be in the default for sure. And the hydrophobicity must be in the default. If there is a switch focused, then there should also be helix focus."

**Done.** `ui/src/lib/ranking.ts:57`: default metrics are `s4predHelixPercent`, `muH`, `hydrophobicity` (TANGO Agg Max is in OPTIONAL_METRICS, not default). A "Helix Focus" preset exists alongside "Switch Focus" (`ranking.ts:167`).
**Verify**: `/results` Smart Candidate Ranking — check the default sliders + presets.

### Wave 0 confirmations (so you know what's still in place)

All 6 items from your first feedback batch (PELEG-CRITICAL-001) remain in place:
- Average composition removed from S4PredChart
- No phantom `helixPercent` field
- EvidencePanel has no Chou-Fasman row
- Help.tsx uses the correct framing for FF-Helix (s4pred + µH, not propensity scales)
- `sswHelixPercentage` documented as a TANGO-side metric

---

## §2 — Caught from your PPT, fixing this week

These are real misses from the audit. We will dispatch a fix-pack ("Wave 2.5") with these items.

| # | Slide | Your concern | What we'll do | ETA |
|---|---|---|---|---|
| F1 | 15, 16, 23, 29, 34 | "cohort" → "database" | EvidencePanel.tsx still uses "cohort mean" in 6+ places. We'll sweep the remaining 48 instances across `ui/src/`. | 2 days |
| F2 | 7 | "Cutoff" suffix on µH / Hydrophobicity labels | Drop the "Cutoff" word from threshold label rendering (the internal variable names `muHCutoff` / `hydroCutoff` stay; only the visible UI text changes). | 1 day |
| F3 | 19 | "The tango score is not %." | Y-axis label and tooltip on TANGO Aggregation Profile to drop the "%" symbol. | 1 day |
| F4 | 33, 35, 36, 38 | Missing axis titles + correlation matrix Helix Match coloring | Add y-axis titles to Hydrophobic Moment Distribution, Sequence Length Distribution, AA Composition; verify correlation matrix renders as upper-triangle only. | 2 days |
| F5 | 37 | Aggregation Propensity Distribution should match other histograms (not lollipop) | Re-style the lollipop chart as a histogram for visual consistency. | 1 day |
| F6 | 31 | Venn diagram: "if 4 are SSW, and all of them are also Helixes, the circle of 1 FF-SSW should be included in the SSW and Helix" | The data model already enforces subset axiom — we need to verify the *visual rendering* matches. Likely a SetDiagram positioning bug. | 1 day |
| F7 | 16 | "Above median" badge: green not gold-brown | Color-token swap in Legend.tsx / percentile pill. | 30 min |
| F8 | 12, 13 | Color collision: purple used for TANGO:OK badge AND SSW pill | Re-assign one of the two to a distinct color (likely SSW → blue, FF-SSW → green, keep helix/positive markers green). | 1 day |
| F9 | 28 | Sequence length notification: "Maybe saying 4/8 sequences too short" instead of two lines | Rewrite Upload.tsx warning to single-line form. | 30 min |

**Total estimated effort**: ≈5-6 days of focused frontend work, dispatched as Wave 2.5 fix-pack.

---

## §3 — Items for our discussion before we touch the code

These are explicitly things you flagged for co-design — we want to align with you before changing anything.

### D1. Interpretation Notes co-design (slide 24)

> "If we are making a biological interpretation, we need to be super careful, have a deep discussion between us on the meaning of things, and go over very carefully the decision tree of this section and the different notes that can be inferred and generated at this part."

**Our take**: agreed. The current Interpretation Notes block (PeptideDetail) auto-generates statements like "Higher hydrophobicity suggests stronger membrane affinity" and "Helical structure often correlates with biological activity." You flagged the second as too vague (slide 23). We'd like to schedule a 30-minute call to design the decision tree together — what statements are valid, under what conditions, with what hedging language. Until that call, we propose **hiding the Interpretation Notes block entirely** so users don't see auto-generated biological claims.

### D2. P27 4-class labeling and ordering (slide 27)

The 4 classes exist in code, but you wrote them in this order: Alpha-helix → Fibril-forming alpha helix → Secondary structure switch → Fibril-forming SSW. Currently the UI displays them as: FF-Helix → SSW → FF-SSW (without showing the Helix base class as a standalone KPI). Two open questions for you:

1. Should the **Alpha-helix secondary structure** (s4pred-positive, regardless of µH) be a 4th KPI card on `/results`, so the user sees both the "predicted helical" set and the "helical + amphipathic" subset?
2. Canonical labels: do you want "Alpha-helix secondary structure" / "Fibril-forming alpha helix" verbatim, or shorter forms like "Helix" / "FF-Helix" with the long names in tooltips? (The former is more rigorous; the latter is more compact in tables.)

### D3. Tier 1 / 80% certainty derivation (slide 22)

> "From where is the 80% certainty?"

**Honest answer**: this number is currently a heuristic we wrote, not derived from a published method. It combines TANGO peak score, S4PRED helix probability, and µH threshold-distance into a single 0-100 confidence. We don't want to keep it if it doesn't trace to something defensible. Options:

1. Remove the "Certainty %" bar entirely and just label the tier qualitatively ("High-confidence Switch Zone" with no number).
2. Replace the heuristic with a derivation we can document and defend (e.g. min-confidence across the contributing predictors).
3. Keep it but expose the underlying components in the UI so the user sees how it's built.

**Recommend option 1** unless you want us to invest in option 2. Your call.

### D4. Smart Candidate Ranking parameters (slide 39)

> "Let's discuss the parameters we use to rank."

**Current defaults**: s4predHelixPercent (10%), FF-Helix % (15%), µH (15%), SSW Score (25%), TANGO Agg Max (35%). [Already moved TANGO out of default per slide 39 — those weights apply only in "Amyloid Focus" preset.]

Open questions for you:

1. For the **Equal** preset, what should the 5 weighted-equal metrics be? (Currently: s4predHelix, FF-Helix, µH, SSW Score, hydrophobicity — note hydrophobicity now in default per your slide 39 directive.)
2. For **Helix Focus**, what's the canonical recipe? Right now we use: s4predHelix 35% + FF-Helix 25% + µH 25% + hydrophobicity 15%.
3. For **Switch Focus**: SSW Score 40% + SSW Diff 25% + µH 20% + hydrophobicity 15%. Same question.

### D5. Candidate Ranking metric scope (slide 29)

> "We shouldn't look on the SSW score at all. It does not mean anything. We don't need to add the tango aggregation here."

This contradicts the current ranking which uses SSW Score as one of the 6 base metrics. Should we:

1. **Remove SSW Score from the ranking entirely** (your slide 29 directive), or
2. **Keep it but down-weight to 0 in defaults** (so it's available for advanced users but doesn't drive default rankings)?

Recommend option 1 (cleaner). Same question for TANGO Agg Max — drop entirely from the ranking metric list, or keep available but never default?

---

## §4 — Direct questions back to you

These are clarifications we can't resolve without your input.

### Q1. S4PRED <15aa length limit citation (slide 9)

> "From where you get the information about the length limitation of s4pred? Didn't found it in their paper or git."

**Honest answer**: we may have inferred the 15-aa minimum from the S4PRED paper's evaluation set rather than from an explicit statement. Two options:

1. We dig into the S4PRED paper + GitHub issues for the exact citation, or
2. You tell us what you'd accept as a defensible lower bound, and we update the warning to match.

If you don't have a strong source either, **we'll drop the "may be unreliable" claim entirely** and just say "S4PRED works best on sequences ≥15 aa (recommended minimum from the prediction pipeline)" — softer phrasing, no false citation.

### Q2. PeptideDetail dual helix lines (slide 14)

> "What is the difference here between the helix 100% in the upper line and the helix 77% in the lower line?"

We need to see exactly which two elements you're pointing at. Our best guess: the upper "Helix (100%)" is the S4PRED average helix probability for the whole sequence; the lower "Helix (77%)" is the helix segment coverage (residues in detected helix segments / total length). They legitimately differ for peptides where helix probability is high everywhere but no continuous segment of ≥5 residues passes the threshold.

**Can you confirm?** And: should we keep both values but label them clearly ("Avg helix probability" vs "Helix segment coverage"), or collapse to one canonical helix metric?

### Q3. Smart Candidate Ranking "%" meaning (slide 39)

> "What is the % mean here? Which columns or which results are actually being taken into consideration here?"

We use **percentile normalization** (each peptide's value mapped to 0-100 across the dataset, then weighted-summed). So the final ranking score IS a percentile-aggregated number, but the per-metric weights also sum to 100%. Two different "%" meanings collide.

**Plan**: rename the weight sliders to "Weight (out of 100)" and the score to "Score (0-100)" so there's no overlap. Does that match what you want?

### Q4. Modern alternatives to Chou-Fasman (slide 23)

> "Chou Fasman propensity for which secondary structure? There much more updated ways to determine this. I am not convinced this is important here."

The Chou-Fasman row was already removed from EvidencePanel during Wave 0. But you raised a broader question: **is there a modern helix-propensity reference we should be using anywhere, or do you prefer we use only s4pred (a modern neural predictor) and drop all propensity-scale references?**

Our recommendation: drop all propensity-scale references. S4PRED is the canonical helix prediction in PVL (ADR-003). Let us know if you disagree.

---

## §5 — Items needing your live-URL verification

These were flagged in your PPT but our audit can't tell whether they're now fixed or still present without you checking on the live URL. Brief eye-test would help us close the loop.

| # | Slide | Item to verify |
|---|---|---|
| V1 | 8 | Threshold panel section header — does it say "Secondary Structure Switch (SSW) thresholds" with the acronym expanded? |
| V2 | 11 | UniProt upload — do the default columns still drift when uploading from UniProt vs CSV? |
| V3 | 14 | PeptideDetail Sequence & Structure card — do you still see two separate helix percentages without an explanation? (See Q2 above.) |
| V4 | 26 | SSW Prediction interpretation block on Help page — does it now show one option per line (positive / negative / N/A)? |
| V5 | 28 | Aggregation Propensity Distribution — does it look like the other histogram-style distributions on `/results`? |

---

## §6 — Closing

A few things to know:

1. **Live URL anchor**: everything in §1 can be verified at `http://94.130.178.182:3000` with a hard refresh. The DESY VM target is being set up in parallel (Alex is processing the access list); we'll move to a more stable URL after Wave 5.
2. **Wave 2.5 ETA**: the §2 fix-pack should land within 5-6 working days. We'll send you the diff list when it deploys.
3. **For §3 discussion items**: a 30-60 minute zoom with you, Said, and (optionally) Alex would close the loop on D1-D5 in one session. Let us know what works.
4. **For §4 questions**: written reply is fine — no need for a call unless any of them are larger than they look.

Thank you for the second pass. The PPT was rigorous and caught real issues we needed to find. The ליקויים framing is correct: these are defects, and they get fixed.

— Said

---

## Internal notes (NOT for Peleg — strip before sending)

- **Live commit referenced**: `4534033` (post-Wave-2 merge)
- **Verified by**: Explore agent audit + targeted grep spot-check 2026-05-18
- **Tracking doc**: `docs/internal/PELEG_REVIEW_TASKS.md` (to be created with Round 2 audit table)
- **Wave 2.5 dispatch**: §2 items become individual T2/T3/Cowork tasks
- **Co-design items**: §3 D1-D5 need scheduling with Peleg + Alex
- **Open**: confirm with Said which items he wants to add/remove before sending
