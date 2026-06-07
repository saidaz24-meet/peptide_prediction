# Peleg Drive-comments — Confusion Map

**Source**: `~/Desktop/PVL_update_for_Peleg_May_2026.pdf` (13 pages, 27 inline comments dated 22 May 2026 by Peleg Ragonis-Bachar)
**Read by**: T1 (Claude Code) 2026-05-22
**Downstream consumers**:
1. **Said → Claude Chat** for per-comment reply text (humanized), then posts back into Drive
2. **Cowork V11-1 through V11-7** for Phase D6 redesign brief (her confusion = our design opportunity)
3. **T2/T3** for code follow-ups (where the answer needs a code change, not just a doc change)

---

## §0 — TL;DR for Said + 3 scientific shifts that change everything

**The big three** (don't miss these — they re-shape Wave 2.6 + the paper framing):

### Shift 1 — AMPs are not "false positives." They are legitimate broader-scope fibril candidates.

> **Comment 2** (verbatim): "This is incorrect! The reason is because the features that drive amyloid or fibril formation are the same features that allow membrane interactions."
> **Comment 3**: "AND with that being said, it is perfectly fine that we report or call name for fibril dormation potential only, it is fine if other biological functionalities might also happen."
> **Comment 4**: "This thing you just point out is why initially when we were looking for new fibril-forming sequences we were testing AMPs and toxic peptides, that because of their membran-active function will have greater potential to fibril formation."

**What this means for us**: every place we've called the AMP positives "false positives" needs to be rewritten. They're correctly flagged candidates — they share the features amyloid formers have *because the same biophysics drives both*. The framing was wrong, not the math.

**Action**:
- Rewrite the Confusion Map §6 disclosure paragraph (Packet 1).
- Rewrite RB-VALIDATION-V0-1.md §3 — "false-positive class" → "broader-scope fibril candidate class with membrane-active dual potential."
- Update Help.tsx FF-SSW explanation accordingly when D6.2 lands.
- Strip "false positive" language from the canary suite descriptions — keep the `_KNOWN_FALSE_POSITIVE` flag name for code clarity but document that the biological framing is "membrane-active overlap, not error."

### Shift 2 — Peleg endorses our approach AND clarifies Q5 (the omission).

> **Comment 5**: "In addition, to try and be more flexible and allow the prediction for other functional groups of proteins, the thresholds are set automatically in relation to the specific database that is being sent as input."
> **Comment 15** (re Q5): "What I meant was that any analysis made, or the way you address SSW and FF-SSW, should also apply to Helix and FF-Helix. because in some cases, you are only related to the FF-Helix and not the Helix or vice versa. So actually, none of the things you wrote here was my intention."

**What this means**: Q5 is NOT a subset axiom (SSW ⊆ Helix). It's a **symmetry-of-analysis requirement** — every analysis surface that treats SSW/FF-SSW should also treat Helix/FF-Helix the same way. We've been asymmetric: some panels mention only SSW or only FF-Helix; she wants both sides covered everywhere.

**Action**:
- Audit every panel that surfaces classification: does it cover all 4 (Helix + FF-Helix + SSW + FF-SSW) consistently? If not, file as F-item under D2 4-class labeling.
- Venn diagram stays as 4-sibling circles (4-class), NOT subset. My recommendation to update the Venn was based on a misread of her comment 5 line 5.
- Update Packet 1 §11.8 — drop Q5 "SSW ⊆ Helix" interpretation.

### Shift 3 — Rename the tool.

> **Comment 25**: "I think we need to think on a better name, that is less generic and will represent the tool more accurately. I am thinking on the young student, that starts his Msc for example and looking for tools to use in his research I would like that anyone who will clic amyloid or fibril and peptides will get this web as a first result. We need the young scientists to be able to easly find this."

**What this means**: "Peptide Visual Lab" is too generic for SEO discovery. She wants a name that surfaces in searches for "amyloid", "fibril", "peptide prediction." This is a brand-level question, not a code change.

**Action**: open a brainstorm task. Name candidates need to evoke (amyloid OR fibril) AND (predict OR scan) AND (peptide). E.g. "FibrilScan", "AmyloPath", "AmyloCast", "PepAmyloid", "FibrilLens" — Said + Peleg + Alex propose options, paper title decides.

Plus **directly-answered Q4** (long-time open):

> **Comment 27** (re Q4): "We should just use the basic predetermined thresholds, not from Eisenberg, but from Ragonis-Bachar and Rayan."

**Action**: Help.tsx + threshold tooltip needs to cite Ragonis-Bachar and Rayan as the threshold source, not Eisenberg 1984. T-RES task: find the Ragonis-Bachar and Rayan paper, verify threshold values, update citation in Help.tsx + methods text.

---

## §1 — Slide-numbering issue (Said directive: fix)

> **Comment 26** (verbatim): "Lets discuss in Zoom maybe? I am having trouble following the notes since I dont see correlation between the slides numbers."

**Diagnosis**: Said's "slide 9 / 14 / 18 / 22 / 23 / 24 / 27 / 29 / 30 / 39" references match the PDF page numbers of `New_Feedback/Peleg note (1).pdf` (I have the file — page numbers match content). Peleg likely has a DIFFERENT version of the deck — possibly her original PowerPoint where page numbers differ from the PDF conversion (e.g., a title-slide shift, or hidden slides included in numbering).

**Two fixes** (Said picks):

**(A) Content-based references everywhere (recommended)**.
Replace "slide 9" with "the slide where you wrote about the S4PRED length warning (the X/Y too short note)." Drops slide numbers entirely, names the content instead. Robust to any version drift. ~15 min update in Said's doc.

**(B) Embed slide thumbnails next to each question**.
Cleaner visually but more work — extract each slide from her PPT as PNG, paste into the response doc inline near each Q/D item. Said exports thumbnails, I tell him which PPT page to grab for each. ~45 min.

**My recommendation: (A) for the v2 of the response document Said sends back via Claude chat.** Plus a one-liner at the top: "I have re-referenced your slides by content rather than number — your version's slide numbering differed from mine. If you'd like a Zoom to walk through any item, I am available."

### Slide-reference fix table (use for content-based rewrites)

| Said wrote | Actual content (PPT) | Recommended phrasing |
|---|---|---|
| Slide 5 line 5 | Page 1 summary list, item 5: "Everything that is SSW needs to be also of helix." | "your summary slide, item 5 about SSW/Helix" |
| Slide 9 | Page 9 — S4PRED length warning | "the slide on the S4PRED length warning (4/8 sequences)" |
| Slide 14 | Page 14 — Sequence & Structure dual helix % | "the Sequence & Structure slide with the Helix 100% and Helix 77% lines" |
| Slide 18 | Page 18 — S4PRED Probabilities + Beta % | "the S4PRED Secondary Structure Probabilities slide (where you flagged the Beta %)" |
| Slide 22 | Page 22 — Tier 1 panel + 80% certainty | "the Tier 1 / High-Confidence Switch Zone slide" |
| Slide 23 | Page 23 — Evidence Summary with Chou-Fasman | "the Evidence Summary slide where you flagged the Chou-Fasman row" |
| Slide 24 | Page 24 — Interpretation Notes | "the Interpretation Notes slide" |
| Slide 27 | Page 27 — 4-class redefinition | "your slide proposing the 4 classes (Alpha-helix, FF-helix, SSW, FF-SSW)" |
| Slide 29 | Page 29 — Classification details + SSW Score | "the FF-Helix / FF-SSW classification details slide" |
| Slide 30 | Page 30 — FF-Helix vs S4PRED Helix definitions | "the FF-Helix % vs S4PRED Helix % comparison slide" |
| Slide 39 | Page 39 — Smart Candidate Ranking | "the Smart Candidate Ranking slide" |

---

## §2 — Per-comment Confusion Map (all 27)

Format per comment:
**What she said**, **What it points at**, **Technical answer**, **Draft reply** (for Claude Chat to humanize → Said pastes in Drive), **Code/Doc implication**.

---

### Comment 1 — General "don't over-claim validation"

**What she said**: "It is perfectly fine and nice testing a bit the prediction, BUT we cannot relay too much on this type of validation since we dont realy have enough data to support either secondary structure switch or the fibril formation."

**Technical answer**: She's right — n=66 labeled subset (47 V + 19 X) is small, and the 19 X are not a random non-amyloid sample (heavy PSM-α2 enrichment). The validation tells us *something* (the AMP-overlap class confusion), but should not be presented as definitive scoring of PVL.

**Draft reply**: "Agreed and noted. I will reframe the validation in the brief and paper as an exploratory analysis on a small labeled subset, not a statistical scoring of PVL — and I will state the dataset limitations explicitly (n=66, the 19 non-amyloid rows are not a random sample). The value of the analysis is in catching the AMP-overlap class pattern, not in producing a sensitivity number that can be cited."

**Code/Doc implication**:
- Rewrite RB-VALIDATION-V0-1.md §1 TL;DR with this framing.
- Help.tsx + paper Methods: never present sensitivity 1.0 / specificity 0.0 as a "scoring" of PVL — frame as exploratory.

---

### Comment 2 — "This is incorrect! AMPs share features with amyloid formers"

**What she said**: "This is incorrect! The reason is because the features that drive amyloid or fibril formation are the same features that allow membrane interactions."

**Technical answer**: This is the most important comment in the whole document. We had been calling the AMP positives "false positives." Peleg is correcting us — they're not errors; they're correctly flagged because the biophysics is genuinely shared. Amphipathicity → membrane interaction → potential for self-assembly → potential for fibril formation. AMPs are *one* expression of this shared feature space; amyloid is *another*.

**Draft reply**: "You are right — I had the framing wrong. The AMP positives are not false positives, they are legitimate broader-scope candidates because the features that drive amyloid formation are the same features that allow membrane interactions. PVL is correctly capturing this. I will rewrite the disclosure paragraph to say so plainly, and I will update the validation brief to drop 'false positive' language for these cases. Thank you — this changes the framing significantly."

**Code/Doc implication**:
- Rewrite Help.tsx FF-SSW explanation (D6.2 task).
- Rewrite RB-VALIDATION-V0-1.md §3 — "false-positive class" → "membrane-active overlap class with shared fibril-forming features."
- Strip "false positive" from public-facing copy (keep `_KNOWN_FALSE_POSITIVE` internal flag name, document that the bio meaning is "membrane-active overlap").
- Packet 1 §11.7 disclosure paragraph: rewrite with the membrane-active overlap framing instead of false-positive framing.

---

### Comment 3 — Endorses fibril-only naming

**What she said**: "AND with that being said, it is perfectly fine that we report or call name for fibril formation potential only, it is fine if other biological functionalities might also happen."

**Technical answer**: She's saying it's fine that PVL's flag is "FF-SSW" (fibril-forming candidate) even though that flag will also catch peptides whose primary biological function is membrane-disruption. We don't need to split the class or rename FF-SSW. Just disclose that fibril-forming candidate includes peptides whose primary function may be membrane-active.

**Draft reply**: "Good — I will keep the FF-SSW name and add a sentence in the help text that the flag is 'fibril-forming potential, recognizing that some peptides flagged here may have membrane-active as their primary biological function.'"

**Code/Doc implication**: Help.tsx FF-SSW explanation gets the membrane-active disclaimer. No code logic change, no flag rename.

---

### Comment 4 — Confirms our case: AMPs WERE targeted by Peleg's lab

**What she said**: "This thing you just point out is why initially when we were looking for new fibril-forming sequences we were testing AMPs and toxic peptides, that because of their membran-active function will have greater potential to fibril formation."

**Technical answer**: This is a critical piece of context for the paper. Peleg's lab specifically targeted AMPs and toxic peptides as candidates *because of* the shared feature space. So PVL flagging AMPs is *exactly the behavior her research strategy expected*. The PSM-α2 case isn't a tool failure — it's a tool success that surfaced the membrane-active-vs-amyloid distinction question.

**Draft reply**: "Thank you for confirming this — your lab's strategy of targeting AMPs and toxic peptides because of the shared feature space is now what justifies PVL's behavior. The PSM-α2 case (flagged as FF-SSW positive despite being an AMP) is not a tool failure — it surfaces exactly the membrane-active vs amyloid distinction question that your work has been investigating. I will frame this clearly in the paper."

**Code/Doc implication**:
- Paper methods/intro: include this framing — PVL's positive class is designed around the shared feature space her lab targets.
- RB-VALIDATION-V0-1.md: add this as the scientific motivation for why AMP-positive is NOT a false positive.

---

### Comment 5 — Endorses automatic threshold derivation from dataset

**What she said**: "In addition, to try and be more flexible and allow the prediction for other functional groups of proteins, the thresholds are set automatically in relation to the specific database that is being sent as input."

**Technical answer**: She's confirming PVL's current default behavior (thresholds = dataset median when in `Recommended` mode) is correct and intentional. This is good — we don't need to retune. The automatic-threshold approach is the design.

**Draft reply**: "Confirmed — keeping the automatic threshold derivation (cohort median in Recommended mode) as the default. I will state this explicitly in the methods so the design intent is clear to readers."

**Code/Doc implication**: Help.tsx threshold explanation gets a sentence explicitly stating thresholds are dataset-derived by default for flexibility across functional groups.

---

### Comment 6 — Canary peptides too long for pipeline

**What she said**: "how did you do this?? there are longer than 40 amino acids therefore should not go through the pipeline. should be screened out at the beginning."

**Technical answer**: Aβ42 = 42 residues. α-synuclein NAC core (residues 71-82) = 12 residues — that's fine. But Aβ42 is technically beyond the canonical PVL pipeline length (we typically focus on shorter peptides). She's flagging that running Aβ42 through PVL is methodologically questionable.

**Action options**:
- (a) Remove Aβ42 from canary suite, replace with a shorter amyloid control (e.g., Aβ16-22 KLVFFAE — the classic amyloid fragment).
- (b) Keep Aβ42 but add a length-check in the pipeline that warns when peptides exceed the recommended length (Peleg's other request: "screened out at the beginning").

**Draft reply**: "You are right — Aβ42 at 42 residues is past the canonical pipeline length. Two fixes I am proposing: (1) replace Aβ42 in the canary suite with Aβ16-22 (KLVFFAE), the classic amyloid-forming fragment that fits the pipeline range; (2) add an upfront length-screen warning in the pipeline so any peptide longer than the recommended length is flagged before processing. Does this match your intent, and is there a recommended maximum length you would like to set?"

**Code/Doc implication**:
- T5 task: replace Aβ42 in `backend/tests/test_canary_peptides.py` with Aβ16-22 (KLVFFAE) or another short amyloid control.
- T2 task: add length-check pre-screen in upload pipeline (`backend/services/upload_service.py`) — warn if any peptide exceeds 40 residues, suggest user filter before submit.
- **Open question for Peleg**: what is the recommended maximum length? 40? 50?

---

### Comment 7 — Negative controls in fibril field are hard to define

**What she said**: "which negative controls? In the field of fibril or amyloid formation it is very hard to define a negative control, since fibril or amyloid formation is very depended on environmental conditions. Meaning, the fact that a specific sequence didnt formed fibril in a specific contion (or multiple conditions) doesnt mean that it wont do it in slightly different conditions. This is why when we wrote the papers describing the methods we said that the peptides did not form fibrils in the tested conditions."

**Technical answer**: Our canary suite has Poly-GS linker and Poly-E as "negative controls." Peleg's point: these aren't rigorous negative controls in the amyloid field. Calling them that overstates our confidence in PVL's negative predictions.

**Draft reply**: "Understood — I will reframe the canary 'negative controls' as 'unstructured / non-amphipathic baselines' rather than negative controls in the amyloid sense. The point of those entries in the suite is to detect regressions in the FF-Helix % calculation (Poly-E flagging 100% FF-Helix despite −16 charge is the canary), not to assert they don't form fibrils. I will rename them and document the regression-detection purpose."

**Code/Doc implication**:
- T5 task: rename `_NEGATIVE_CONTROL` → `_REGRESSION_CANARY` (or similar) in `test_canary_peptides.py`. Update docstrings.
- RB-VALIDATION-V0-1.md: remove "negative controls" framing.

---

### Comment 8 — UniProt-keyword AMP enrichment as ranking (not classification)

**What she said**: "Not sure about using the UniProt keywords as ranking (unless the user wants to) but definitely adding this information will be beneficial regardless of ranking."

**Technical answer**: She's saying: don't auto-downweight AMPs in ranking by default (the user might want them). But surfacing the UniProt keyword annotations *as data* on each peptide is valuable. The display, not the ranking, is the right place.

**Draft reply**: "Agreed — I will surface UniProt keyword annotations as a column / chip on each peptide row (the user sees 'this peptide is annotated as Antimicrobial / Defensin / Signal' alongside the FF-SSW flag). I will NOT auto-downweight by default in the ranker, but I will expose a user-toggle for those who want to filter AMPs out. Does that match your intent?"

**Code/Doc implication**:
- T2 task: add `uniprotKeywords: string[]` to the peptide row schema (already partially present — check).
- T3 task: surface UniProt keywords as a row chip on PeptideTable + as a filter toggle.
- Ranking system: add an *optional* user-controlled AMP-downweight toggle (default OFF).

---

### Comment 9 — New scoring rule infeasible

**What she said**: "at this point this is realy not feasible. in order to test a new set of features we need much much more examples than what we have."

**Technical answer**: She's rejecting Option B from Packet 2 §5 ("different scoring rule entirely: a multi-feature linear or learned combination"). Reason: not enough labeled training data to fit a new model.

**Draft reply**: "Confirmed — dropping the multi-feature linear/learned-combination idea for this paper. It would require labeled training data we don't have. PVL stays with the current sequence-derived heuristic + threshold approach. We can revisit if a larger validation set becomes available."

**Code/Doc implication**: None. Just close out Packet 2 §5 option B as "rejected by Peleg."

---

### Comment 10 — Class-splitting doesn't differ from current behavior

**What she said**: "Not sure how it is different than what we already have. we already provide a secondary structure switch flag, and an fibril forming secondary structure switch flag."

**Technical answer**: She's pointing out that I (T1) proposed "split FF-SSW into 'amphipathic switch candidate' vs 'amyloid switch candidate'" but we ALREADY have SSW (broader) and FF-SSW (narrower, with hydrophobicity gate). The class-splitting I proposed is what we already do. I was duplicating an existing structure.

**Draft reply**: "Good catch — you're right, PVL already has this structure (SSW is the broader flag, FF-SSW is the narrower fibril-forming flag with the hydrophobicity gate). My proposal was duplicating what's already there. Dropping the class-split suggestion."

**Code/Doc implication**: None. Close out Packet 2 §5 option C as "already present in the codebase."

---

### Comment 11 — No other validation dataset

**What she said** [paraphrased from full text]: "validation of this tool is not super trivial. (1) Most research doesn't try to see multiple secondary structure switch behaviour. (2) Fibril formation can happen in different conditions. So - there is no othe[r] dataset."

**Technical answer**: Staph 2023 is what we have. She's confirming we can't go shop for another labeled set. This anchors the paper's validation strategy as exploratory analysis on the one labeled set she has access to.

**Draft reply**: "Understood — Staphylococcus 2023 is the validation set we use, and the paper will frame the analysis as exploratory rather than a definitive scoring. The two reasons you cite (SSW under-researched in the literature; fibril formation conditional on environmental conditions) will go in the limitations section explicitly."

**Code/Doc implication**:
- RB-VALIDATION-V0-1.md §10 follow-ups: drop the "head-to-head benchmark vs AGGRESCAN/PASTA 2.0/AmyloDeep" — Peleg's framing in comment 14 says they'll miss these sequences anyway (different prediction basis: β-sheet propensity).
- Paper limitations section: cite both reasons (SSW under-researched, conditional fibril formation).

---

### Comment 12 — "Still not convinced we need to change cohort → database"

**What she said**: "Still not convinced we need to change the terminology. what is the problem with FF-a-helix and FF-SSW?"

**Technical answer**: She's pushing back on the cohort→database sweep (F1). The original ask came from HER on slide 15 ("I would use the name database instead of a cohort"). Now she's saying "what is the problem with FF-a-helix and FF-SSW?" — this is about *flag naming*, not the cohort/database swap.

Misreading on her part: Said's "database" in the disclosure paragraph refers to the cohort terminology she ASKED us to change. She's now questioning whether the flag name change ("FF-α-helix" vs "FF-Helix"?) is needed.

**Draft reply**: "To clarify — the 'database' wording in this paragraph is the cohort → database rename you asked for in your slide 15 PDF feedback (where you wrote 'I would use the name database instead of a cohort'). I am not proposing to rename the flag itself. FF-Helix and FF-SSW are staying as is. Does that resolve the concern?"

**Code/Doc implication**: None. Just clarify in reply.

---

### Comment 13 — "Only in the longer version"

**What she said** (re: "Of note, some sequence functionalities also present the same biochemical features such as membrane-active peptides"): "only in the longer version"

**Technical answer**: She's saying the membrane-active disclosure detail should appear in the longer Help.tsx text, not in the compact FF-SSW column tooltip. Two-level disclosure: short tooltip, longer Help.

**Draft reply**: "Got it — the tooltip stays short ('FF-SSW: candidate fibril-forming peptide; see Help for full criteria and limitations'), with the membrane-active overlap detail in the longer Help.tsx page only."

**Code/Doc implication**:
- T3 task: tooltip text in FF-SSW column header → short version.
- Help.tsx FF-SSW section → long version with membrane-active overlap framing (per Comment 2).

---

### Comment 14 — Approves omitting competitor names from disclosure

**What she said**: "totally fine. And I am almost sure they will miss these sequences since they are basing their prediction on the propensity to form b-sheets, which is the opposite of what we are doing. And basically, the whole reason and motivation for this project begins with."

**Technical answer**: She approves keeping AGGRESCAN/PASTA/AmyloDeep out of the disclosure paragraph. Plus important paper context: those tools predict β-sheet propensity, PVL predicts the helix → β switch — different problems. This is paper-positioning gold.

**Draft reply**: "Approved — keeping competitor names out of the disclosure paragraph. And the framing you just gave — that competing tools predict β-sheet propensity while PVL predicts the α-helix to β-sheet switch — is the right paper positioning. I will use this framing in the intro and the differentiator section."

**Code/Doc implication**:
- Paper intro/methods: PVL's differentiator = "predicts the switch transition, not just β-sheet propensity."
- Drop head-to-head competitor benchmark task (per Comment 11 + 14).

---

### Comment 15 — Q5 clarified: symmetry, not subset

**What she said**: "What I meant was that any analysis made, or the way you address SSW and FF-SSW, should also apply to Helix and FF-Helix. because in some cases, you are only related to the FF-Helix and not the Helix or vice versa. So actually, none of the things you wrote here was my intention."

**Technical answer**: Q5 ≠ subset axiom. It's symmetry-of-treatment. Wherever the UI/code treats SSW one way, it should treat Helix the same way (and vice versa). We've been asymmetric in some places — e.g. Quick Analyze showed "No SSW" badge but not "No Helix" or "No FF-Helix".

**Draft reply**: "Thank you for clarifying — I misread your original line. The Venn diagram stays as 4-sibling circles (not subset). What you want is symmetric treatment: whatever surface shows SSW, also shows FF-SSW, Helix, and FF-Helix consistently. I will audit every page that surfaces classification and file the asymmetric cases for fix in the next cycle. The Quick Analyze badge symmetry change is already in flight for this cycle."

**Code/Doc implication**:
- T3 audit task: every classification surface — does it cover all 4 (Helix, FF-Helix, SSW, FF-SSW)? File asymmetric cases as F-items.
- Drop the Packet 1 §11.8 paragraph about "Venn diagram is wrong; SSW should be drawn as subset of Helix."

---

### Comment 16 — "which PDF?"

**What she said**: "which PDF?"

**Technical answer**: Said referenced "your PDF" — Peleg is confused which PDF. He means her round-2 PowerPoint (her PDF feedback with the Likoiim comments). Clarify.

**Draft reply**: "Sorry for the ambiguity — 'your PDF' refers to the PowerPoint with the Likoiim feedback you sent me on 2026-05-18 (Peleg note.pptx, the 41-slide deck with red and blue annotations)."

**Code/Doc implication**: None.

---

### Comment 17 — "AlphaFold3 predicted, emphasize in paper"

**What she said**: "Just in title, AlphaFold3 predicted 3d structure. In the paper we will emphasize this"

**Technical answer**: Confirmed — we should label "AlphaFold-predicted structure" prominently in the UI title (not just a footnote), and emphasize the "predicted, not experimental" caveat in the paper.

**Draft reply**: "Will do — the title of the AlphaFold 3D card will read 'AlphaFold-predicted structure' (not just 'Structure'). The paper methods will emphasize this is a prediction, not experimental coordinates."

**Code/Doc implication**:
- T3 task: rename the AlphaFold 3D viewer card title to "AlphaFold-predicted structure" or "AlphaFold3 — predicted structure."
- Help.tsx + paper methods: add the "predicted not experimental" emphasis.

---

### Comment 18 — Reproducibility-as-permalink endorsement

**What she said**: "This is SUPER COOL and indeed no other tool I know have this and we will emphasize this in the paper."

**Technical answer**: Strong positive feedback. The reproducibility permalink is paper-worthy and unique.

**Draft reply**: "Glad this lands — I will give it a dedicated paragraph in the paper methods (along with the figure pack's permalink-in-methods-panel which uses the same infrastructure)."

**Code/Doc implication**: None for code; flag for paper writing.

---

### Comment 19 — "you mean a different paper??"

**What she said**: "you mean a different paper??"

**Technical answer**: Said wrote "I think it is paper-worthy on its own merits" about the reproducibility feature. Peleg read this as "we should publish a separate paper about it." Clarify: he meant "it's worth a dedicated section in the main paper," not a separate publication.

**Draft reply**: "No, I meant a dedicated section in the main paper, not a separate publication. The reproducibility permalink is one of our differentiators and deserves its own paragraph in the methods + differentiators section of the main PVL paper."

**Code/Doc implication**: None.

---

### Comment 20 — "What does the % mean?"

**What she said** (on "FF-Helix %"): "Also here, what the % mean?"

**Technical answer**: Same ambiguity she flagged in her PPT slide 39. FF-Helix % = "percentage of residues in 6-residue sliding-window segments where the mean Fauchère-Pliska helix propensity exceeds threshold." Said hasn't surfaced this consistently in copy.

**Draft reply**: "FF-Helix % is the percentage of residues that fall inside 6-residue sliding-window segments where the mean Fauchère-Pliska helix propensity exceeds 1.0. So a peptide with FF-Helix = 60% means 60% of its residues are part of helix-propensity-positive windows. I will surface this definition consistently in the column header tooltip and Help.tsx."

**Code/Doc implication**: T3 task — clarify FF-Helix % tooltip + Help.tsx text. Part of D6.2.

---

### Comment 21 — "what do you mean by Tango aggregation max?"

**What she said**: "what do you mean by Tango aggregation max?"

**Technical answer**: TANGO aggregation max = peak per-residue TANGO aggregation propensity score across the sequence (the maximum value of the TANGO curve, on 0-100 scale).

**Draft reply**: "TANGO aggregation max = the peak per-residue TANGO aggregation propensity across the sequence (highest point on the TANGO curve, scored 0-100). It's how we summarize a peptide's aggregation hotspot into one number for ranking/correlation purposes. I will add this to the column tooltip + Help.tsx so it's not ambiguous."

**Code/Doc implication**: T3 task — TANGO aggregation max tooltip + Help.tsx definition. Part of D6.2.

---

### Comment 22 — Endorses no-SaaS, no-auth approach

**What she said**: "You are right, this is very uncommon and even in the publication journals they require that the server will be an open access and that there will be no need for creating an account or leave your email unless you are interested in."

**Technical answer**: Confirms our distribution model. Journals require open-access, no-auth. We're aligned.

**Draft reply**: "Confirmed — open access, no account required, no email gating. The journal requirement reinforces the cultural choice."

**Code/Doc implication**: None.

---

### Comment 23 — "So... this is already implemented?" (MCP)

**What she said**: "So.. if I am understanding correctly this is something you already implemented?"

**Technical answer**: YES — MCP server is shipped in Wave 2 §I (commit aab979d, 2026-05-12). Phase G1 done. Routes live: `get_peptide_detail`, `rank_candidates`, `compare_cohorts`, `find_similar`, `analyse_sequence`. Live on the VPS for any researcher who configures their AI assistant.

**Draft reply**: "Yes — MCP server is shipped and live. Phase G1 complete. The endpoints (get_peptide_detail, rank_candidates, compare_cohorts, find_similar, analyse_sequence) are accessible from any AI assistant that speaks MCP (Claude Desktop, Cursor, Continue). A researcher with PVL configured in their assistant can drive the science via natural language. I can demo this on a Zoom if useful."

**Code/Doc implication**: None — already shipped. Update Packet 2 §4 wording to be clearer that this is shipped not future.

---

### Comment 24 — "Not sure I fully understood this point" (PubMed RAG)

**What she said**: "Not sure I fully understood this point"

**Technical answer**: PubMed/PMC federation = RAG (Retrieval-Augmented Generation) over the published literature. The AI assistant, when answering a question about a peptide, retrieves relevant papers from PubMed/PMC + cites them. So instead of the AI saying "this peptide may be amyloidogenic" with no source, it says "amyloidogenic per Smith et al. 2024 (PMID 12345)" with a real citation. The hard problems are: (a) building the vector DB over PubMed, (b) preventing hallucinated citations.

**Draft reply**: "RAG = the AI fetches relevant papers from PubMed/PMC before answering, then cites them in its response. So instead of the AI saying 'this peptide is amyloidogenic' with no source, it says 'amyloidogenic per Smith et al. 2024 (PMID 12345)' with a verified citation. This is Alex's long-term vision (Phase G2 in the roadmap). Why it's queued: building the vector DB over PubMed is significant engineering, and we need scientific co-design (especially with you) on what 'good cite-grounded answers' look like — confidently mis-cited papers would be worse than no citation at all. We will revisit after the MCP base proves itself and Maxwell access lands."

**Code/Doc implication**: None for now — Phase G2 queued.

---

### Comment 25 — RENAME THE TOOL

**What she said**: "My honest opinion regarding the distribution of this tool is that what you already did is more then enough! ... I think we need to think on a better name, that is less generic and will represent the tool more accurately. I am thinking on the young student, that starts his Msc for example and looking for tools to use in his research I would like that anyone who will clic amyloid or fibril and peptides will get this web as a first result. We need the young scientists to be able to easly find this."

**Technical answer**: PVL = Peptide Visual Lab. Too generic for SEO. Peleg wants discoverability via "amyloid", "fibril", "peptide" searches.

**Action — open brainstorm**:

Candidate name buckets:

- **Amyloid-anchored**: AmyloPath, AmyloCast, AmyloScan, AmyloLens, AmyloSwitch, AmyloFinder
- **Fibril-anchored**: FibrilScan, FibrilPath, FibrilSwitch, FibrilSeer, FibrilLens, FibrilSpy
- **Switch-anchored**: SwitchScan, ChameleonPep (chameleon peptides — peptides that switch fold), Helix2Sheet, FoldSwitch
- **Method-anchored**: PepFold, PepCast, PepLens, PepPredict, SeqAmyloid, SeqFibril

**My favorites for shortlist**:
- **FibrilLens** — evokes both fibril prediction + visualization (PVL's USP). SEO-friendly.
- **AmyloPath** — amyloid + pathway/path. Clinical-adjacent feel.
- **ChameleonPep** — peptides that switch fold; the SSW story is right in the name. Memorable.
- **Helix2Sheet** — the α-to-β transition is literally in the name. Educational.

**Draft reply**: "Strongly agree — let's open the rename brainstorm. My favorites from a first pass: FibrilLens (fibril + visualization, the differentiator), AmyloPath (amyloid + pathway), ChameleonPep (peptides that switch fold — the SSW story is in the name), Helix2Sheet (the α→β transition explicitly). Open to your suggestions too. Once we agree on a shortlist of 3-4, I will check SEO and domain availability. Renaming the GitHub repo is reversible and low cost; renaming the deployed URL is the same once Maxwell access lands."

**Code/Doc implication**: Open a task — Said + Peleg + Alex propose names, shortlist 3-4, decide. Big strategic question.

---

### Comment 26 — Slide numbering issue (covered in §1 above)

Already addressed in §1. Reply already drafted there. Recommendation: content-based references in v2 of Said's response document.

---

### Comment 27 — Q4 answered: Ragonis-Bachar and Rayan

**What she said**: "We should just use the basic predetermined thresholds, not from Eisenberg, but from Ragonis-Bachar and Rayan."

**Technical answer**: Directly answers Q4 (modern alternative to Chou-Fasman). The thresholds should be cited as **Ragonis-Bachar and Rayan**, not Eisenberg 1984. Need to find the specific Ragonis-Bachar / Rayan paper that defines the threshold values used in PVL's reference implementation.

**Draft reply**: "Got it — citing Ragonis-Bachar and Rayan for the threshold defaults, not Eisenberg. Could you point me to the specific Ragonis-Bachar and Rayan paper that defines the threshold values? I will update Help.tsx + paper methods + tooltip with the correct citation as soon as I have the reference."

**Code/Doc implication**:
- **Open question for Peleg**: which Ragonis-Bachar and Rayan paper? Need the DOI/citation.
- T5 / T-RES task: once we have the reference, update Help.tsx + threshold tooltip + paper methods.

---

## §3 — Summary of action items

### Code changes (for Wave 2.6 or Cowork V11)

| # | Task | Owner | Effort |
|---|---|---|---|
| 1 | Rename `_NEGATIVE_CONTROL` → `_REGRESSION_CANARY` in test_canary_peptides.py + docstrings | T5 | 30 min |
| 2 | Replace Aβ42 in canary suite with Aβ16-22 (KLVFFAE) OR shorter amyloid control | T5 | 30 min |
| 3 | Add length-pre-screen warning in upload pipeline (warn if any peptide > recommended length) | T2 | 1 h |
| 4 | Surface UniProt keyword annotations on PeptideTable as chip + filter toggle | T3 | 2 h |
| 5 | Add optional user-controlled AMP-downweight toggle in ranking system (default OFF) | T3 | 2 h |
| 6 | AlphaFold 3D card title → "AlphaFold-predicted structure" | T3 | 15 min |
| 7 | FF-Helix % tooltip + Help.tsx definition (6-residue window, Fauchère-Pliska ≥ 1.0) | T3 | 30 min |
| 8 | TANGO aggregation max tooltip + Help.tsx definition (peak score 0-100) | T3 | 30 min |
| 9 | Help.tsx FF-SSW explanation rewrite with membrane-active overlap framing | T3 + Cowork | 2 h |
| 10 | Audit every classification surface for 4-flag symmetry (Helix, FF-Helix, SSW, FF-SSW) | T3 | 2 h audit + ~per-finding fix |
| 11 | Update Help.tsx threshold tooltip with Ragonis-Bachar and Rayan citation (once Peleg provides the paper) | T-RES + T3 | 30 min once cited |

### Doc changes

| # | Task | Owner | Effort |
|---|---|---|---|
| 12 | Rewrite Packet 1 §11.7 disclosure paragraph: "false positive" → "membrane-active overlap" framing | T1 | 30 min |
| 13 | Rewrite RB-VALIDATION-V0-1.md §1 + §3: exploratory framing, "false positive class" → "membrane-active overlap class" | T1 | 1 h |
| 14 | Drop Packet 2 §5 option B (multi-feature scoring rule) and option C (class splitting) — both rejected by Peleg | T1 | 15 min |
| 15 | Update Packet 2 §4 — MCP server is *shipped* not future (clarify wording) | T1 | 15 min |
| 16 | Drop Packet 1 §11.8 paragraph about "SSW ⊆ Helix" subset axiom — Peleg's clarification is symmetry-of-treatment, not subset | T1 | 15 min |
| 17 | Drop head-to-head competitor benchmark task (Comment 14 says they'll miss these sequences anyway) | T1 | 5 min |
| 18 | Paper limitations section draft: incorporate Comment 11 reasons (SSW under-researched, conditional fibril formation) | Said + T1 | 1 h |
| 19 | Re-cite slide references in the Drive doc using content-based phrasing per §1 table | Said + T1 | 30 min |

### Open questions to Peleg (one-shot replies)

| # | Question |
|---|---|
| OQ1 | What is the recommended maximum peptide length for the pipeline? 40? 50? (Comment 6) |
| OQ2 | Which Ragonis-Bachar and Rayan paper defines the threshold values? DOI / citation? (Comment 27) |
| OQ3 | Rename brainstorm — shortlist of 3-4 names from: FibrilLens, AmyloPath, ChameleonPep, Helix2Sheet, or others you propose. (Comment 25) |
| OQ4 | Zoom for D1-D5 (Interpretation Notes, 4-class labeling, Tier 1 certainty, Ranking presets, SSW Score) — what slot works? (her offer in Comment 26) |

### For Cowork (Phase D6 redesign brief)

- D6.2 Help.tsx — rewrite FF-SSW + FF-Helix sections with membrane-active-overlap framing (Comment 2-4)
- D6.2 Help.tsx — add Ragonis-Bachar / Rayan threshold citation (Comment 27)
- D6.4 QuickAnalyze — 4-flag symmetry per Comment 15
- D6.5 PeptideDetail — UniProt keyword chips per Comment 8
- All D6 surfaces: "AlphaFold-predicted structure" emphasis per Comment 17

---

## §4 — How to reply in Drive (workflow for Said)

1. **Said hands this Confusion Map to Claude Chat** with instruction: "humanize the 'Draft reply' field per comment into Peleg's voice; keep technical content, lose internal jargon."
2. **Claude Chat returns humanized replies** organized by comment number.
3. **Said pastes each reply into Drive** as a comment-thread response to the corresponding Peleg comment.
4. **For Comments 19, 23 — Said embeds screenshots** when posting (live VPS / MCP server config). Screenshots:
   - Comment 17 (AlphaFold) — screenshot of `/peptides/<example>` AlphaFold card
   - Comment 18 (permalink) — screenshot of `/results` URL + the reproducibility ribbon
   - Comment 23 (MCP shipped) — screenshot of Claude Desktop with PVL MCP server configured (if Said has this set up)
5. **Said posts OQ1-OQ4 as new top-level questions** in Drive (or save for Zoom if she takes that offer).
6. **In parallel**: Said updates Cowork V11-2 (Help.tsx redesign) brief with the membrane-active overlap framing from §0 Shift 1.

---

## §5 — What I'm not doing here (intentional)

- **Not changing code yet** — every change above is filed as a task, executed by appropriate terminal after Said reviews this Confusion Map.
- **Not posting in Drive** — read-only MCP, Said handles posting after Claude Chat humanizes.
- **Not deciding the rename** — this is a strategic call for Said + Peleg + Alex; I provided candidates only.
- **Not running head-to-head competitor benchmark** — explicitly dropped per Comment 14.
