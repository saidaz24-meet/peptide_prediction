# Peleg follow-up — technical packet for Said's external humanization

**Purpose**: Said hands this packet to Claude chat / external editor to produce the warm, scientific-peer email to Peleg. This file contains the factual content; do not send raw.

**Status as of 2026-05-20**:
- Original response draft: `docs/active/RESPONSES/peleg_2026_05_18_response.md` (not sent yet)
- 4 parallel audits ran today refining what we know
- One new omission found (Q5)
- Two response claims need softening before sending

---

## What to tell Peleg — the structured content

### 1. Greeting + framing (Said writes the warm version)

Acknowledge two rounds of careful review. The "ליקויים" framing was correct: round 2 caught real defects, and one of them led us to a P0 structural bug that explains the helix% / FF oddness she'd been flagging across both rounds. Her FF-SSW Slack question was the catalyst.

### 2. What's done since round 2 (factual list — humanize the tone)

Between her 2026-05-18 PowerPoint and now (2026-05-20):

- **ISSUE-032 P0 fixed**: dual-source desync. `sswPrediction` was shipping the TANGO-only column while `ffSswFlag` used the unified TANGO ∪ S4PRED mask. P85089 and P0C005 (and any peptide with TANGO-negative-S4PRED-positive SSW + hydrophobicity above threshold) now have consistent SSW + FF-SSW. Three layers: unified column in `dataframe_utils.py`, API-boundary axiom enforcement in `normalize.py`, 9 invariant tests in `test_axiom_invariants.py`.
- **ISSUE-033 P1 fixed**: perf regression. ESM-2 8M vector indexing was running inline in the predict pipeline (3-5s per peptide). Moved to a daemon background thread. Restoration target: 12 peptides back from ≈60s toward the TANGO+S4PRED baseline.
- **AUDIT-2 KPI gating fixed**: after the canonical OR definition (SSW = TANGO ∪ S4PRED), the UI was hiding S4PRED-only-positive SSW stats whenever TANGO was off. Gate removed.
- **22 frontend tests fixed**: Node 25 `localStorage` shadowing jsdom's shim. Polyfill in vitest setup + explicit storage in jobStore.
- **UniProtQueryInput**: fully migrated to V10-3 unified progress UI (so the in-page progress block + sidebar pill behave the same for UniProt searches as for CSV uploads).
- **MetricDetail BarChart** type narrowing — `tsc --noEmit` clean.
- **Paper figure pack** wired into the Results Export dropdown — single click bundles cover + classification table + radar + aggregation profile + methods panel, with the live URL embedded as a reproducibility permalink.
- **LICENSE switched to MIT** today (was inconsistently labeled).

### 3. Claims from the original response that we are softening

Two items in the response draft were over-confident and should be corrected before sending:

- **F1 "cohort" → "database"**: We claimed "fixing this week." Audit found 48 instances still in `ui/src/` (mostly EvidencePanel). Honest ETA: 2-3 days from start of Wave 2.5 dispatch. Update phrasing in the email.
- **F10 Beta % calculation**: We listed it as "needing adjustment" but never proposed a concrete fix. Two options for Peleg to choose between:
  - **(A)** Compute Beta % using segment-based logic (require N consecutive residues with P(Beta) ≥ 0.5), matching how Helix % is computed.
  - **(B)** Drop the Beta % subcard entirely — her own slide 18 note said "showing the graph without calculating the percentages is enough."
  - We recommend (B). Ask her to confirm.

### 4. New question we missed in the response (Q5)

**PPT slide 5 line 5** — "Everything that is SSW needs to be also of helix."

This is a profound axiom that we did not address in our response. We enforced two axioms (FF-Helix ⊆ Helix, FF-SSW ⊆ SSW), but Peleg's statement implies a third one: SSW ⊆ Helix.

If that's correct, our 4-class Venn diagram is wrong — SSW should be drawn as a subset of Helix, not as a sibling circle. Or Peleg may have meant something subtler about how SSW is defined (e.g. SSW is a *kind* of helix-classified peptide where the helix prediction is uncertain, so by definition it's still helix-labeled).

**Ask her to confirm**: should SSW always imply Helix-positive in the data layer? If yes, we update the Venn diagram + classification logic accordingly. This is a single email round-trip.

### 5. Reaffirm the 4 questions from §4 of the original response (still open)

These are unchanged from the response draft — re-list them so she has them all in one inbox:

- **Q1 (slide 9)** — S4PRED <15aa lower-bound citation: where is this stated? Our offer: if she can point to the source, we cite it; if not, we soften the language to "recommended minimum from the pipeline."
- **Q2 (slide 14)** — PeptideDetail dual helix percentage labels: which two numbers does she mean? Our best guess: upper = S4PRED average helix probability across all residues; lower = helix segment coverage (residues in detected segments / total length). She'll confirm the right framing.
- **Q3 (slide 39)** — "%" meaning in Smart Candidate Ranking: per-metric weight (sums to 100) vs final percentile-aggregated score (0-100). We're proposing to rename slider labels to "Weight (out of 100)" and the final column to "Score (0-100)" to remove the ambiguity. Does that work for her?
- **Q4 (slides 23 + 30)** — Modern alternative to Chou-Fasman for helix propensity: we recommend dropping all propensity-scale references and using only S4PRED. Does she agree?

### 6. Reaffirm the 5 co-design items from §3 of the original response

These need a conversation (Zoom or written), not a one-shot answer:

- **D1 (slide 24)** — Interpretation Notes decision tree co-design. We're hiding the block until we co-design.
- **D2 (slide 27)** — 4-class labeling + ordering. Open questions: (a) standalone Helix base-class card on /results? (b) verbose labels ("Alpha-helix secondary structure") or short labels ("Helix") with tooltips?
- **D3 (slide 22)** — Tier 1 / 80% certainty derivation. We recommend dropping the % bar in favor of qualitative tier labels only.
- **D4 (slide 39)** — Smart Candidate Ranking presets: Equal / Helix Focus / Switch Focus / Amyloid Focus. Each has proposed weights — we need her validation.
- **D5 (slide 29)** — Drop SSW Score from ranking metrics entirely, or keep available but never default? We recommend full removal.

### 7. Quick Analyze policy question for Peleg (new — comes out of B3)

In single-peptide mode (Quick Analyze, no cohort), the UI currently shows the "No SSW" pill but not Helix / FF-Helix / FF-SSW. We have three options and want her preference:

- **(1)** Hide all FF-flags in single-peptide mode (clean Peleg-aligned interpretation since FF normally requires cohort-derived thresholds).
- **(2)** Show all four flags using literature-default thresholds (µH > 0.5 from Eisenberg 1984 amphipathic helix scoring; hydrophobicity > 0.5 from PVL config defaults).
- **(3)** Show the base classes (Helix + SSW) always; show FF-Helix + FF-SSW with a "default thresholds — upload a cohort for data-derived thresholds" pill.

We recommend **(3)** — most informative without misleading. Wait for her confirm before T3 ships the change.

### 8. Research-blocked items — one-shot questions to bundle

These are minor but block specific tasks. Easy to answer in one email:

- **T11** — Which Peleg/Bader paper is the source for the threshold defaults? Help us cite it correctly.
- **AF1** — For signal peptide annotation in the AlphaFold 3D viewer: any reference for the signal-cleavage prediction we should be using?
- **P7-P8** — Hamodrakas 2007 — is the helix-to-beta conformational switch diagram from this paper? Confirm so we can attribute correctly in the Tier 1 panel.
- **CH7** — "Helic West" — is this a term we should adopt or was it a one-off in conversation? Spelling/intent confirm.

### 9. Optional — license question

Said may want to add: "do you have a preference for the open-source license? We're MIT now (as of today). If DESY policy requires a research-only license alongside MIT we can dual-license — let us know."

### 10. Closing

Said writes the personal close. Suggested elements: thanks for rigor, the round-2 catch (FF-SSW axiom) was the most important single thing in the review, expected Wave 2.5 deployment timeline (1-2 weeks), Zoom availability for the D1-D5 conversation, link to the live VPS for verification (`http://94.130.178.182:3000`).

---

## 11. NEW (2026-05-21) — Validation findings against Staphylococcus 2023 benchmark

**This section should lead the email.** The findings are paper-grade and Peleg needs to weigh in on framing before we ship the UI disclosure.

### 11.1 — What we did

After Peleg flagged P0C005 (Anoplin) showing as FF-SSW positive in conversation with Said, we ran the full Staphylococcus 2023 dataset (`Final_Staphylococcus_2023_new.xlsx` — 2916 peptides, 36 columns) through the PVL prediction pipeline and computed a confusion matrix against the experimental TEM Fibrils labels (47 V / 19 X = 66 labeled subset). Full details in `docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` (318 lines, will be on GitHub once T6 lands the PR).

### 11.2 — Headline metrics

| Classifier | Sensitivity | Specificity | PPV | F1 |
|---|---|---|---|---|
| **FF-Helix** | 1.000 (47/47) | 0.000 (0/19) | 0.712 | 0.832 |
| **FF-SSW**   | 0.319 | 0.053 | 0.455 | 0.375 |

### 11.3 — What these numbers actually mean

- **FF-Helix has perfect amyloid recall, zero discrimination.** Every experimentally validated TEM-positive amyloid is caught. But every experimentally validated TEM-negative is *also* flagged. The FF-Helix rule (S4PRED helix + µH > threshold) is satisfied by the entire labeled set.
- **FF-SSW is worse than uninformative.** F1 = 0.375. Threshold sweeps from hydrophobicity = 0 to 1.5 give at most F1 = 0.385 — **no hydrophobicity cutoff rescues this metric on this benchmark.**
- **17 of 18 confirmed false positives are PSM-α2** (sequence `MGIIAGIIKFIKGLIEKFTGK`), an antimicrobial peptide replicated across multiple UniProt accessions. The 18th is Delta-hemolysin.
- **Across all 2916 rows, 71 peptides match AMP-related keywords — 69 are FF-Helix positive (97% AMP positive rate).** This is a systematic class-level confusion, not noise.

### 11.4 — Why this is a biology problem, not a code bug

- **PSM-α1 (amyloid, TEM=V) vs PSM-α2 (NOT amyloid, TEM=X)** differ at 4 of 21 positions.
- Their biochemistry differs by: **Δcharge = 1, Δhydrophobicity = 0.008, Δhelix-uH = 0.012**.
- PVL's sequence-derived thresholds **cannot resolve this**. The experimental difference between α1 and α2 is real but not encoded in any feature PVL currently extracts. This needs richer inputs (structural, environmental, or evolutionary signals) — not threshold tuning.
- **No threshold change inside the search space {hydro ∈ [0, 1.5], µH ∈ [0, 1.5]} produces F1 > 0.385.** We verified this empirically in §3.3 of the brief.

### 11.5 — Recommendation: disclose, don't retune

Three concrete actions:

1. **Ship a per-class disclosure paragraph** in `Help.tsx` and as a hover tooltip on the FF-SSW column header. The proposed wording is in §11.7 below — we want Peleg's sign-off on framing before T3 wires it in.
2. **Lock the current behavior to CI via a canary suite** so any future "improvement" surfaces a visible diff requiring scientific review (not a silent threshold drift). 13 tests landed today in `backend/tests/test_canary_peptides.py`:
   - **Positive amyloid controls** (must stay positive): PSM-α1, PSM-α3, Aβ42, α-synuclein NAC core.
   - **Known false-positive AMPs** (pinned as `_KNOWN_FALSE_POSITIVE = True`): PSM-α2, Delta-hemolysin, Anoplin, Magainin-2, Melittin. Documented with literature citations (PMID/DOI/UniProt) per canary.
   - **Negative controls**: Poly-GS linker (random), Poly-E (curiosity — FF-Helix% = 100 despite −16 charge, pinned to detect any future `ff_helix_percent` regression).
3. **Do NOT retune thresholds** (per Said directive 2026-05-20). The current rules correctly identify amphipathic conformational-switch candidates; the misinterpretation lives in the UI label, not the math.

### 11.6 — Open follow-ups (not in this cycle)

Three optional paths, all queued for Peleg's input:

- **AMP-discrimination feature** (~6 h backend): join the dataset against UniProt keyword annotations (`Antimicrobial`, `Antibiotic`, `Defensin`, `Signal`, etc.) and surface a "downweight" signal in the candidate-ranking system. Would not change classification flags — just down-weights AMPs in the ranked candidate list. Wave 3 candidate.
- **TANGO/S4PRED-enabled canary integration suite** (~4 h, cron-driven nightly): the current canary tests run with `USE_TANGO=0 USE_S4PRED=0` so they're fast for PR-level CI. A nightly cron pass with providers enabled would catch true regressions in the prediction subprocesses themselves. Cheap insurance.
- **Head-to-head benchmark vs AGGRESCAN, PASTA 2.0, AmyloDeep** (Wave 3+, new RB): the paper-reviewer question "how do you compare to existing tools" needs this. Will require downloading each tool's predictions on the same 2916-peptide benchmark and computing the same confusion matrices.

### 11.7 — Proposed UI disclosure paragraph (Help.tsx + FF-SSW tooltip)

**Rewritten 2026-06-03 per Peleg's Drive Comments 2-4 (2026-05-22)** — the original "false-positive" framing was wrong. PVL's FF-SSW positive class is, by design, the broader set that captures the shared biophysics between amyloid-forming and membrane-active peptides. Peleg's lab specifically targeted AMPs as fibril candidates because of this shared feature space. The disclosure paragraph reflects that framing:

> **FF-SSW (Fibril-Forming Secondary Structure Switch)**
>
> PVL classifies a peptide as FF-SSW positive when two sequence-derived criteria are met: (1) at least one predictor (TANGO or S4PRED) sees structural switching potential between α-helix and β-sheet, and (2) hydrophobicity is above the database threshold. The same biophysics — amphipathicity and structural-switching potential — drives both amyloid formation and antimicrobial activity, so the FF-SSW class is intentionally the broader set that captures both. Membrane-disrupting amphipathic peptides such as antimicrobial peptides (AMPs), signal peptides, and pore-formers will also be flagged. On our Staphylococcus 2023 validation benchmark (n=66), 17 of 18 broader-candidate calls are PSM-α2, an amphipathic AMP. If your peptide is annotated as an AMP in UniProt or shows a signal-peptide cleavage site, treat the FF-SSW flag as indicating shared fibril-forming biophysics rather than a confirmation of amyloid behavior in vivo. Distinguishing the two functional outcomes from sequence alone is an open scientific problem — and is the reason we keep the flag broad rather than narrowing it.

**Status**: framing approved by Peleg in Comments 2-3 ("it is perfectly fine that we report or call name for fibril formation potential only, it is fine if other biological functionalities might also happen"). Comment 13 says the membrane-active detail belongs in the longer Help.tsx text, not the compact tooltip — so the tooltip stays short (one sentence) and the Help.tsx page carries the long version above.

### 11.8 — Q5 axiom and the rest of the email (REVISED 2026-06-03)

**Q5 was NOT a subset axiom.** Per Peleg's Drive Comment 15 (2026-05-22): she meant *symmetric treatment* — wherever the UI/code surfaces SSW/FF-SSW, it should also surface Helix/FF-Helix in the same way. The 4-class Venn stays as 4 sibling circles. The earlier "SSW ⊆ Helix subset axiom" interpretation was a misread of her slide 1 line 5 and is dropped.

**Other Wave 2.5 → Wave 2.6 framing shifts** (all confirmed by Peleg in Drive):
- **D3** (Tier 1 / 80% certainty): drop the certainty bar entirely. The validation says we don't have the discrimination power to assign confidence scores meaningfully — and Peleg's framing on AMP overlap supports this (you can't meaningfully claim confidence on a positive call that's intentionally broad).
- **Q4** (modern alternative to Chou-Fasman): directly answered by Peleg in Drive Comment 27 — *"We should just use the basic predetermined thresholds, not from Eisenberg, but from Ragonis-Bachar and Rayan."* Awaiting her DOI for the citation.
- **D2** (4-class labeling): verbose labels stay strongly preferred — "FF-SSW: candidate fibril-forming peptide (broad)" reads safer than just "FF-SSW" in a column header where a clinical reader might over-read it as confirmed amyloid.

---

## What NOT to put in the Peleg email

- Internal task IDs (B1-B4, F1-F11, AUDIT-2, etc.) — convert to descriptions she can verify.
- Terminal names (T1-T6, Cowork, T-PEL) — internal.
- Codebase file paths (`backend/services/dataframe_utils.py`, etc.) — too low-level.
- Status badges (🔴/🟡/✅) — internal tracking.
- Wave numbers internal to PVL ("Wave 2.5") unless contextually needed — just say "the current cycle."

---

## Length target

The original response draft is ~2500 words. After the softening + Q5 + Quick Analyze policy item + research-blocked questions, the new email should be roughly the same length or slightly longer (~2700-3000 words). If Claude chat humanizes it down to 1800-2200 words while preserving the structure, that's ideal — scientific peer audience.
