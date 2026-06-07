# Wave C — Email Draft to Alex + Peleg

**Status**: Draft. Said reviews + sends. Not committed to repo as final until reviewed.
**Audience**: Dr. Alexander Golubev (DESY scientific advisor) + Dr. Peleg Ragonis-Bachar (Technion, algorithms).
**Tone**: Warm, scientifically precise, decisive on what's done, asking sharp focused questions on what needs their input.
**Goal**: capture all open scientific questions in one round so we don't drag the review out.

---

## Subject line options

- "PVL — full implementation update + scientific decisions we need from you"
- "Peptide Visual Lab — round 1 of your feedback shipped, 11 open questions for you"
- "PVL update — your feedback is implemented, looking for your final calls on a few items"

(Said pick one.)

---

## EMAIL BODY (paste-ready, edit names/dates as needed)

---

Dear Peleg, Alex,

Thank you both — your feedback over the last weeks has been the single biggest reason PVL has gone from a prototype to something that's starting to feel like a research instrument. The 32-fix review document Peleg sent has been the spec we built against; Alex's earlier concurrency, queue, and UX notes shaped the foundation. **Please keep this kind of feedback coming — it's gold.**

I'm writing with two things:

1. **A status update** — what's now in the application based on your feedback
2. **A focused set of open questions** that need your scientific decision before we lock down the v0.1 release and prepare the JOSS submission

---

### Part 1 — What's now shipped (your feedback → working features)

**Foundational (Tier 0 of Peleg's review)**
- ✅ 4-category classification (Helix / FF-Helix / SSW / FF-SSW) with the corrected uH-vs-hydrophobicity split. SSW logic is now `TANGO OR S4PRED` (was AND).
- ✅ Threshold panel restructured into your 4 groups (General SS / Helical / SSW / Fibril-formation). All 9 default values match your table. Tooltip text uses your verbatim language.
- ✅ Terminology sweep: "cohort" → "database" everywhere in user-facing text (code identifiers untouched). "Pipeline" → "Results". "Min" → "Minimal". CD spectroscopy references removed entirely. "neural network prediction" subtitle removed. Acronyms spelled out in titles.

**Dashboard + tables (Tier 1)**
- ✅ KPI cards reordered (Total → % FF-Helix → % SSW → % FF-SSW). Scientific icons replace generic flask/chart icons. Subtitles use your category definitions.
- ✅ Badge colors deconflicted (SSW positive moved off purple → teal). Negative cells render as `—` not "No"/red.
- ✅ Default table columns identical across CSV / Quick Analyze / UniProt sources.
- ✅ Set Diagram (Venn) now mathematically correct: FF-Helix nests inside Helix; FF-SSW nests inside SSW ∩ Helix. Counts in diagram and summary table are guaranteed in sync.
- ✅ "Pipeline Overview" → "Results Overview" everywhere.

**Peptide detail (Tier 2)**
- ✅ Helix percentage reported once per metric (we ran a full audit — there had been four different "helix %" computations being labeled identically; report at `docs/active/HELIX_PERCENTAGE_AUDIT.md`).
- ✅ S4PRED chart "Avg composition" line removed (the duplicate prediction).
- ✅ Consensus tier card removed from PeptideDetail and Quick Analyze (per your option a recommendation in FIX-013).
- ✅ Sequence display legend hides "0%" for missing data instead of silent zero.
- ✅ Chou-Fasman propensity row removed from Evidence Summary.
- ✅ TANGO chart subtitle: "aggregation propensity" not "amyloid-forming". Y-axis no longer says "%".
- ✅ Biochemical Feature Comparison: stat cards + radar + percentile bars unified into one section with green "Top X%" badges. "Above median" badge color changed gold → green.
- ✅ Sliding-window profile redesign in flight (more on this below).

**Charts and rankings (Tier 3)**
- ✅ All distribution histograms have Y-axis labels.
- ✅ Aggregation Propensity distribution converted to bar style for consistency with siblings.
- ✅ Cohort comparison now shows two charts side-by-side: SSW (No SSW / SSW / FF-SSW) AND Helix (No Helix / Helix / FF-Helix).
- ✅ Correlation matrix shows a single triangle, excludes SSW Score / SSW Diff / Agg Max (per your FIX-023.3), uses pairwise-exclude (never zero-fills missing values), color-coded with hover showing "r = X (n = N)".
- ✅ Smart Candidate Ranking: TANGO Agg Max removed from defaults; Hydrophobicity is now a default. New "Helix Focus" preset added. "Amyloid Focus" renamed to "Fibril-formation Focus".

**Help / metrics text (Tier 4)**
- ✅ Hydrophobicity range corrected to **−1.01 to 2.25** (was wrong); μH range corrected to **0 to 3.26** (was wrong). Definitions rewritten verbatim from your text.
- ✅ FF-Helix definition no longer mentions Fauchere-Pliska (the code uses Chou-Fasman; we corrected the documentation, not the code).
- ✅ SSW interpretation: Positive / Negative / N/A on separate lines, with your exact line: *"There is no connection between the SSW prediction and the fibril-forming potential. Only after taking hydrophobicity into account."*
- ✅ FF-SSW Classification: "TANGO **or** S4PRED" (was AND).
- ✅ Candidate Ranking System description: removed SSW score reference (per your "we shouldn't look on the SSW score at all").

**Polish (Tier 5)**
- ✅ S4PRED short-sequence warning simplified to one ratio line.
- ✅ Active Thresholds panel above KPIs showing live values + "User-set" badges.

**Plus a critical reliability fix Said discovered last week**
- ✅ The UniProt query endpoint had a silent contract bug: requests with the wrong field name (e.g., `max_results: 5`) were silently coerced to `size: 500` defaults. The user thought they queried 5 peptides; the server processed 500. Fixed by enforcing strict request schemas (`extra="forbid"`) and adding proper aliases for legacy field names.
- ✅ S4PRED is now restricted to peptides ≤ 100 aa (was running the 5-model BiLSTM ensemble on full proteins like APP at 770 aa, which took 600+ seconds). PVL is a peptide tool; protein-length sequences now skip S4PRED with a clear message.

**Currently being added (V4 round)**
- 🔄 Reproducibility ribbon at top of every analysis page (citable permalink — paste a URL, get the same view back).
- 🔄 Mol\* 3D structure viewer overlaying TANGO peaks, S4PRED helix segments, FF-Helix candidate regions, and SSW zones directly on the AlphaFold structure. No competing peptide tool offers this.
- 🔄 Sliding-window profile redesigned with proper multi-channel color encoding (you'll like the new one — Said felt the previous version wasn't visual enough).
- 🔄 One-click "paper figure pack" export — multi-panel SVG/PDF ready for a Nature/Science supplement.

---

### Already resolved between us (Said + Peleg, 2026-05-06)

A few of the questions you'd flagged earlier — Said and I went through them with your previous review notes in hand:

- **Q1 Drop `ffHelixPercent` from UI** — yes, dropped everywhere. We retain the backend field for backwards-compat but the UI never displays it again. The "FF-Helix" name is now reserved exclusively for your category-2 flag.
- **Q5 Remove "Aggregation per-residue %" threshold** — yes, removed entirely. It had no scientific anchor.
- **Q6 TANGO 5% threshold** — exposed as configurable for now (default 5, range 0-50). When you confirm the citation or value, we'll lock it.
- **Q7 Consensus tier system** — fully deleted (`ConsensusCard.tsx` + `getConsensusSS` + types). The advantages of having a single-glance summary are preserved by the existing classification pills.

We also extended your "I don't understand this threshold" feedback to remove **"% of length cutoff"** — same reasoning, no scientific anchor we could find. If we missed something there and it was actually load-bearing, please flag in your reply.

---

### Part 2 — Open questions where we need your decision

We've parked these in the code (`# PELEG-Q-FIX-XXX` TODO comments) so we don't ship implementations of things you'd want differently. Each has a recommended option but the call is yours.

#### Q-NEW — Complex sequence notation handling (raised by Said 2026-05-06)

Researchers sometimes write peptide sequences with internal dashes — could be:
- Chemical modifications (`Ac-PEPTIDE-NH2`) — already supported by PVL.
- Multi-chain notation (`Chain1-Chain2`) — currently treated as a single sequence with the dash stripped.
- Disulfide / linker notation — varies by lab.
- Single-letter with dashes between for readability (`M-V-G-L-K`).

Alex — you might have a clearer sense of which conventions your collaborators use. Would PVL benefit from a smarter parser (with a popup explaining what was detected and how it was handled)? Or is the current "strip and warn" behaviour fine? Lower priority — added to the v0.2 roadmap but flagged for your input.

---

#### Q1 — Drop or rename `ffHelixPercent` (Chou-Fasman propensity) — RESOLVED

Currently PVL exposes a metric called "FF-Helix %" that is a Chou-Fasman P_α sliding-window value — a *helix-propensity* score, not the FF-Helix flag from your category 2.

Two options:
- **(a) Recommended**: drop the column from the UI everywhere. The "FF-Helix" name is reserved for your category-2 flag (`ffHelixFlag`). Backend keeps the column for backwards compat but stops labeling it FF-Helix.
- **(b)** keep it, rename in UI to "Chou-Fasman propensity %" so it's never confused with the cat-2 flag.

You already removed it from Evidence Summary (FIX-014.3) and called Chou-Fasman "outdated" — extending that to the rest of the UI feels consistent.

#### Q2 — Drop the `s4predSswHelixPercent` API field

It is bit-for-bit identical to `s4predHelixPercent` (just copied into a second column when an SSW segment is detected). No UI consumer reads it. Recommend: remove from the API response. Are any external scripts of yours using this field? If yes, we keep it.

#### Q3 — TANGO `sswHelixPercentage` API field name

The field name implies "% of the SSW segment that is helix" but the actual computation is "% TANGO helix-track residues with score > 0" — a different concept. We left the field name unchanged (it's in the protected response schema) but documented in Help that this is the TANGO-side metric for SSW negative classification only.

OK to leave the field name as-is and just clarify in Help text? Or do you want it renamed (which is a breaking API change)?

#### Q4 — Sequence & Structure legend null handling

When `s4predHelixPercent === null` (e.g., short peptide < 15 aa, or S4PRED skipped), the legend currently hides the row entirely. Alternative: render `—` so users see the row exists but has no data.

Recommend: hide the row (current behavior). Alex, you've used the tool more than anyone — does the hidden row feel like missing data, or correct behavior?

#### Q5 — "Aggregation per-residue %" threshold — RESOLVED

This is a leftover threshold in the panel (now in an "Advanced (TANGO aggregation)" sub-section). Peleg, in your review you said you don't understand where it comes from. Three options:
- **(a)** Remove entirely. This was likely an early Said implementation choice that didn't survive your scientific review.
- **(b)** Keep but document where it came from + when to use it. Recommend: only if you can name a use case for it.
- **(c)** Move to a "developer mode" hidden panel.

Recommend: (a). But this needs your decision since removing a threshold may affect any analyses you've already run.

#### Q6 — TANGO 5% threshold justification — PARTIAL (need your citation)

The TANGO chart annotation says "scores >5% indicate aggregation-prone regions". Where did 5% come from? Either:
- **(a)** Cite the source (Fernandez-Escamilla et al. 2004 Nat Biotechnol? Or another paper?) — we'll add the citation in a footnote.
- **(b)** Make the threshold configurable per analysis.
- **(c)** Remove the characterization entirely.

Recommend: (b) — make it a configurable threshold in the panel, default 5, with the citation in a tooltip.

#### Q7 — Consensus tier system — RESOLVED

Already removed from PeptideDetail and Quick Analyze (per your FIX-013 option a recommendation). The component file (`ConsensusCard.tsx`) is retained for now in case you want a redesigned version later. Confirm: delete the component file and `getConsensusSS` function entirely?

#### Q8 — Evidence Summary interpretation notes

Currently auto-generated lines like "Higher hydrophobicity suggests stronger membrane affinity" — Peleg, you said: *"If we are making a biological interpretation, we need to be super careful, have a deep discussion between us on the meaning of things, and go over very carefully the decision tree of this section."*

We've removed the most speculative ones. Open question: do you want to define a precise decision tree for which interpretation notes are scientifically defensible (and only show those), or remove the auto-generated notes entirely? We've parked this with a TODO until your call.

#### Q9 — Charge: signed vs absolute

The cohort comparison chart and correlation matrix currently use `|charge|` (absolute value). You flagged that this loses biological signal — positive charge ≠ negative charge for membrane interactions, aggregation propensity, etc. Three options:
- **(a)** Use signed charge everywhere, remove `|charge|`.
- **(b)** Show both in different visualizations: signed in correlation, absolute in cohort comparison (since it's the magnitude that matters for some compares).
- **(c)** Split into "positive charge sum" and "negative charge sum" as two separate metrics.

Recommend: (a) for scientific honesty. (c) is the most informative but adds complexity.

#### Q10 — Correlation matrix: missing-value strategy

Implementation note: we use **pairwise-exclude** (each pair's correlation only computed over rows where both values are non-null). We never fill missing with 0. Confirming this matches your scientific expectation. The other options would be **listwise-exclude** (drop entire rows with any null) or **never-zero** (require all metrics present per row, error if not). All three are scientifically defensible; pairwise-exclude is the standard choice.

#### Q11 — S4PRED 100 aa cap

We added a hard cap at 100 amino acids: any longer sequence skips S4PRED with a message. Reasoning: PVL is a peptide tool; running S4PRED on 770-residue proteins produced 600+s timeouts.

Reasonable cap, or should we raise/lower? If you sometimes need predictions on 100-300 aa "miniproteins", we can bump the cap to 300 (S4PRED still runs, just slower).

#### Q12 — Strategic: multi-predictor consensus (Phase I)

Last month Said attended a demo of Galagos.ai. Their AI agent ran 8 amyloid predictors on a single sequence (AGGRESCAN, FoldAmyloid, CamSol Intrinsic, Zyggregator, Pafig, AmyloDeep, Beta-contiguity, Packing density) and produced a consensus verdict ("7/8 flag amyloid propensity — HIGH overall").

PVL today runs only TANGO. Adding 7 more predictors would make PVL the only tool with a multi-predictor consensus visualization — strong scientific differentiator and citation magnet.

The cost: ~60-100 hours of integration work (each predictor has its own interface, some are servers, some local binaries, some Python packages). Alex, Peleg — is this strategically worth pursuing for v0.2? Or should we focus the 100 hours elsewhere (3D structure overlay, MCP integration, paper writing)?

---

### Part 3 — What we'd like from you

**Highest priority** (please):
- Answers to Q1, Q2, Q5, Q9, Q11 — these block the v0.1 release.

**Medium priority**:
- Q3, Q4, Q6, Q7, Q8 — these block specific UI sections but don't block the release.

**Strategic**:
- Q10 (just confirm), Q12 (Phase I go/no-go).

**General**:
- Anything else you've noticed that didn't make it into your review document — every fix you flag pays for itself many times over.

We're aiming to:
1. Lock the v0.1 codebase by **end of next week**.
2. Cut a GitHub release + Zenodo DOI.
3. Submit to bio.tools registry once we have a stable URL.
4. Begin the JOSS paper draft (target submission within 6-8 weeks).

If you can reply with answers to Q1-Q12 (even one-liners — "Q1: option a, Q2: drop it, Q11: 100 aa is fine") in the next 1-2 weeks, that's perfect. If a question needs a meeting, let me know which.

Thank you again. PVL is going to be the first peptide-prediction web server with an integrated multi-tool dashboard, reproducible permalinks, and live structure overlays — something the field needs and that simply doesn't exist today. That's because of your scientific input.

Best,
Said

---

## Notes for Said before sending

- **Subject line**: I'd go with the second option ("round 1 of your feedback shipped, 11 open questions for you") — it sets the tone that you're delivering, not just asking.
- **Personalize**: Hebrew/Russian salutation if you have a habit with them.
- **Attachments to include**:
  - Maybe a ZIP or link to a 5-7 screenshot summary showing the before/after on the biggest wins (SetDiagram, ClassificationComparison, BiochemComparison, CorrelationMatrix). Tell them "see attached for the visual change" if you do.
  - The link to the running app on VPS so they can click around.
- **CC**: don't CC anyone unless there's a third advisor (Meytal? someone at Technion?).
- **Sign-off**: "Best" works for academic peers; "Warmest" if you want softer.

After sending, capture the email content (cleaned of personal details) into a `docs/active/WAVE_C_EMAIL_SENT.md` so we have a project record.
