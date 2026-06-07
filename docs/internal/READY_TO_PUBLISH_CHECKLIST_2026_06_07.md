# Ready-to-publish checklist — what to test, what's parked, what blocks Peleg's final review (2026-06-07)

This is the single document Said reads before pinging Peleg "please test this last time." Three sections:

1. **§A — Manual tests, ordered.** What Said clicks through on live VPS + locally after the merge wave. Each item has a pass/fail criterion. ~20 minutes total.
2. **§B — Parked tasks.** What's NOT in v0.3.0. Said + Peleg both know up front.
3. **§C — What we tell Peleg in the "please test" email.** Pre-canned message.

---

## §A — Manual test suite (do AFTER the merge wave)

### Pre-flight (once before testing)

Merge the open PRs in this order. Each merge auto-deploys.

```
gh pr merge 79 --merge --delete-branch     # KPI symmetric, UniProt default ON, provider badge fix
gh pr merge 81 --merge --delete-branch     # T2 backend FF threshold dataset-derived
gh pr merge 82 --merge --delete-branch     # Help 4 sections, HowItWorks 2a/2b, ranking, correlation matrix
gh pr merge 80 --merge --delete-branch     # Residue colour sweep, table reorder, FF-% drop, validation skeleton
gh pr merge 78 --merge --delete-branch     # Original KPI symmetry alt branch (redundant w/ #79, merge clean)
gh pr merge 77 --merge --delete-branch     # Original residue-colour alt branch (redundant w/ #80, merge clean)
gh pr merge 76 --merge --delete-branch     # Pre-Zoom Wave 2.6 follow-ups (SSW track + 4-track consolidation)
```

After all 7 merges, wait ~5 min for auto-deploy. Verify backend health:

```bash
curl -fsS http://94.130.178.182/api/health
# expect: {"ok": true}
```

If health endpoint fails: deploy is still running. Watch with `gh run watch`.

---

### Test 1 — black-G residue colouring (Peleg's exact bug)

**URL**: `http://94.130.178.182:3000/peptides/P01501`

**What you're verifying**: Peleg's flagship complaint that a G residue in the middle of a clear helix run was being coloured coil because S4PRED's per-residue argmax tied to coil. The fix routes residue colour through her gap-smoothed fragment columns instead.

**Pass criteria**:
- The G residue inside the helix run is **helix-coloured** (the same colour as the surrounding H residues).
- Sequence Track shows residue colours derived from helix fragments, not from raw `ssPrediction` argmax.

**Fail signal**: G stays coil-coloured. If you see this, the residue-colour sweep didn't land or didn't extend to this view. File an issue.

---

### Test 2 — SSW track on a "No SSW" peptide

**URL**: `http://94.130.178.182:3000/peptides/P80955`

**What you're verifying**: a peptide explicitly classified as `No SSW` at the top must NOT show a full SSW bar in the per-peptide track view. Earlier the fallback was rendering S4PRED beta-segments under an "SSW (TANGO)" label.

**Pass criteria**:
- Class flags row at top says `No SSW`.
- DualStructureTrack shows either NO SSW row at all, OR an honest empty bar — never a full-coverage SSW bar that contradicts the class flag.

**Fail signal**: full SSW bar with `No SSW` flag is the old bug.

---

### Test 3 — KPI cards symmetric

**URL**: `http://94.130.178.182:3000/results` (after running ANY analysis — Quick Analyze on `ACDEFGHIKLMNPQRSTVWY` works as a one-sequence smoke).

**Pass criteria**:
- 4 KPI cards visible: **% Helix · % FF-Helix · % SSW · % FF-SSW**. In that order.
- "Total Peptides" is NOT a card. It appears as a small sub-header line above the card row ("1 peptide analysed" for Quick Analyze).
- Clicking each card filters the table to that class.

**Fail signal**: still see `[Total, FF-Helix, SSW, FF-SSW]` 4-card row — the redesign hasn't landed.

---

### Test 4 — UniProt search defaults predictors ON

**URL**: `http://94.130.178.182:3000/database-search` → enter `keyword:KW-0929 length:[10 TO 40]` → run.

**Pass criteria**:
- TANGO and S4PRED toggles in the UniProt form default to **ON** (visible in the Advanced/Predictor section).
- Results page header shows TANGO and S4PRED status badges as "OK" or "Available" — NOT "OFF".

**Fail signal**: `TANGO: OFF S4PRED: OFF` badges. This is the exact thing Peleg flagged in Slack.

---

### Test 5 — Help page 4 verbatim sections

**URL**: `http://94.130.178.182:3000/help`

**Pass criteria**:
- 4 distinct sections in this order: **Helix → FF-Helix → SSW → FF-SSW**.
- Each section uses Peleg's verbatim text from her Drive comments. Check the SSW section reads: *"Determined by Tango and/or s4pred. Peptide will be predicted as secondary structure switch if the difference between averaged scores of helicity and extended beta are lower than the maximum gap threshold."*

**Fail signal**: only 2 sections (FF-Helix + SSW Prediction). The verbatim sections didn't land.

---

### Test 6 — HowItWorks step 2 split

**URL**: `http://94.130.178.182:3000/` (landing page → "How It Works" section).

**Pass criteria**:
- 5 step cards visible: **Step 1 · Step 2a · Step 2b · Step 3 · Step 4**.
- Step 2a title: "Run S4PRED + TANGO + biochem"
- Step 2b title: "Apply Ragonis-Bachar / Rayan classification rules"

**Fail signal**: only 4 steps with the old "Multi-Algorithm Analysis" lumped step 2.

---

### Test 7 — Ranking defaults to Fibril-Formation

**URL**: `http://94.130.178.182:3000/results` (after any analysis) → switch to **Candidate Ranking** tab.

**Pass criteria**:
- Preset dropdown shows **"Fibril-Formation Focus"** as the currently-selected option (NOT "Equal").
- Weights distribution shows μH + hydrophobicity weighted higher than the others.

**Fail signal**: "Equal" preset is default. The new default didn't ship.

---

### Test 8 — Correlation matrix shows scores not %

**URL**: `http://94.130.178.182:3000/results` → **Charts & Analysis** tab → Correlation Matrix.

**Pass criteria**:
- Axes include: Hydrophobicity, μH, Charge, Length, **S4PRED Helix Score** (NOT "S4PRED Helix %"), **TANGO Helix Max**, **TANGO β Max**, **TANGO Aggregation Max**, **FF-Helix candidate**, **FF-SSW candidate**.
- FF-Helix / FF-SSW are binary correlation TARGETS (you can see correlations against being an FF candidate).

**Fail signal**: matrix still uses helix % and missing TANGO + FF axes.

---

### Test 9 — PDF report renames FF-Helix score (not %)

**URL**: `http://94.130.178.182:3000/peptides/P01501` → click "PDF Report" in header.

**Pass criteria**:
- Generated PDF biochem panel says "FF-Helix score (sliding-window propensity)" — NOT "FF-Helix %".
- Summary panel same.

---

### Test 10 — Provider badge no-longer-hardcoded-OFF

**URL**: `http://94.130.178.182:3000/database-search` → search WITHOUT toggling predictors (after default-ON fix, both should already be on). Pick any UniProt entry → analyze.

**Pass criteria**:
- Results page top-right badges show "TANGO: OK" + "S4PRED: OK" — NOT "TANGO: OFF S4PRED: OFF" (the issue Peleg reported in Slack).
- If you DO explicitly toggle one off in the search, the badge says "Available" with a tooltip explaining the predictor is server-side enabled but your request didn't include it.

---

### Test 11 — Active Thresholds shows dataset-derived (NEW after T2's PR)

**URL**: `http://94.130.178.182:3000/results` → Active Thresholds panel (collapsible at top).

**Pass criteria** (only if T2's meta.thresholds API extension landed):
- SSW diff threshold rows show "auto-derived from dataset (mean of N rows)" sub-label with actual computed values, NOT static `0.03 / 3`.
- FF-Helix μH cutoff and FF-SSW hydrophobicity cutoff show actual dataset-derived values with N-positive sub-label.

**Fail signal**: rows still show `0.03 / 3 / 0.5 / 0.5`. T2's PR #81 didn't ship the meta.thresholds extension — file as follow-up.

---

### Test 12 — Black-G fix EVERYWHERE, not just SequenceTrack

After confirming Test 1, also click into:
- The 3D Mol* viewer on P01501 — check the G residue is helix-coloured in the 3D structure too.
- The BackboneViewer 2D outline.

**Pass criteria**: residue colouring derives from fragments in ALL three views (SequenceTrack + Mol3DViewer + BackboneViewer). Same G residue, same helix colour everywhere.

---

### Test 13 — FF-Helix % display completely gone from classification pills

**URL**: `http://94.130.178.182:3000/peptides/P01501`

**Pass criteria**:
- Classification pills row at top of page shows class flags only: **No SSW / FF-Helix: No / FF-SSW: No** (or candidate badges where applicable).
- NO "FF-Helix X%" pill in that row anymore.
- The FF-Helix sliding-window propensity value (when displayed elsewhere) reads as "FF-Helix score" — not "FF-Helix %".

---

### Test 14 — Length cap on Quick Analyze with a 50-aa sequence

**URL**: `http://94.130.178.182:3000/quick` → paste a 50-aa sequence (e.g. `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`).

**Pass criteria**:
- Destructive warning appears: "exceeds the 40-aa pipeline limit" with explanation about secondary-structure vs surface-vs-structure problem.
- Run button either disabled or accompanied by a clear "above 40 aa, S4PRED will be skipped" notice.

---

### Test 15 — Quick smoke on TANGO tooltip

**URL**: `http://94.130.178.182:3000/quick` → run any 20-aa sequence.

**Pass criteria**: hover the "TANGO Aggregation Profile" title card → see the detailed explanation tooltip (was missing before, ISSUE-028 fix).

---

## §B — Parked tasks (NOT in v0.3.0)

These are explicitly deferred. Listed so Said + Peleg both know what's NOT being tested. Most will be picked up in January at MIT.

### Parked: Big infrastructure / blocked on external

1. **DESY VM migration to `landau-webapp-dev`** — blocked on Maxwell SSH (Alex needs to add `azaizahs` to the login-allowed group). Hetzner VPS continues to serve PVL fine.
2. **Phase C — K8s deployment manifests** for multi-node clusters. Blocked on DESY K8s namespace allocation.
3. **Phase E.6 — multi-arch Docker build** (linux/amd64 + linux/arm64). Blocked on DESY VM arch knowledge.
4. **Phase G2 — PubMed/PMC RAG citation grounding** for the MCP server. Blocked on Peleg co-design on what "good cite-grounded answer" looks like in our domain.
5. **Phase G3 — generic AI/MCP platform**. Separate Alex project; not PVL scope.
6. **Phase O.3 — multi-region resilience**. Single-region is fine for >99% of use cases; revisit at scale.
7. **Phase O.7 — status page**. Only matters at >100 concurrent users.

### Parked: Big-feature visual / design work

8. **Phase D5 — V4 transformative differentiators** (cross-α/β switch visualiser, time-dependent transition viewer, cryo-EM density overlay). Paper-grade visual work, post-publish.
9. **Phase D3 — advanced visualisations parked items** (multi-scale browsers, ribbon-trace heatmaps). Cowork capacity dependent.
10. **Cowork V10-1 — About page wave-background redesign**.
11. **Cowork V10-2 — DrillDown panel polish**.
12. **Cowork V10-3 — scroll-triggered card animations**.
13. **Cowork V10-4 — route-transition smoothness audit**.
14. **Cowork V10-7 — Landing page quality push** (hero refresh + 40-sec demo loop above fold + 5-surface ecosystem bar).
15. **Cowork V10-8 — Background design system** (scene-sequence-motif, scene-helix-mesh, scene-aggregate-cluster tokens).
16. **AI navigation assistant** (Task #73 — "how do I tune thresholds" guided answers).

### Parked: Scientific extension work (post-publish)

17. **Phase I — Multi-Predictor Consensus** (Galagos-inspired multi-predictor framework). Bigger architectural shift.
18. **Phase F — UniProt search enrichment** (save searches, better filters).
19. **B14 — Cohort Comparison: support 5+ tables side-by-side**.
20. **B16 — Load testing infrastructure** (50/100/1000 concurrent on Hetzner). Only matters at real concurrent load.
21. **B12-B13 — Upload guidance + 2D Backbone (atom2svg)**. Polish, not publish-blocker.

### Parked: Publishing / paper / community

22. **NAR Web Server 2027 paper**. Long arc; targets the 2027 issue. JOSS comes first.
23. **PVL rename** — Said deprioritized 2026-06-04. Stays as "PVL" for v0.3.0. Revisit if reach numbers underwhelm post-publish.
24. **B17/B18 — pvl-cli + pvl-py PyPI release** (`pip install pvl-py`). The code works; publishing to PyPI is the missing step. Quick once we have time.
25. **MCP client guides per assistant** (Claude Desktop, Cursor, Continue, Cline, Windsurf install snippets).

### Parked: Awaiting Peleg sign-off (not code-blocking, but flagged so we don't ship without her OK)

26. **"Regression canaries" naming for what we used to call negative controls**. Awaiting her confirm; Q3 in V2 doc.
27. **Help-page minor confirmations** (Q2 in V2 doc: SSW reference both gap and min-SS-content thresholds? FF-SSW gate is hydrophobicity not μH?). The Help text already shipped with her verbatim; these confirms only change tweaks.
28. **Paper framing yes/nos** (Q3 in V2 doc: regression canaries term, Staphylococcus 2023 as exploratory section, AMP framing in paper intro, α-helix→β-sheet switch as differentiator). Don't block code; do block paper submission.

---

## §C — "Please test" email to Peleg (paste-ready, Said sends after merge wave + Tests 1-15)

```
Subject: PVL v0.3.0-rc1 ready for your last review

Hi Peleg,

The full batch of fixes from your Drive comments, the Zoom direction, and the
Slack TANGO/S4PRED OFF question is now live at http://94.130.178.182:3000.

I'd be grateful if you could do a final pass on the items you flagged, focused
on the live instance rather than the code. You don't need to read the diffs —
just confirm the platform now does what you expected.

Specifically, four flows to walk through (each takes ~2 min):

1. /peptides/P01501 → check that the G residue in the middle of the helix run
   is helix-coloured, not coil-coloured. This was your "black G" bug; the fix
   reads from your `Helix fragments (S4PRED)` column (which our backend was
   already producing) instead of the raw S4PRED argmax.

2. /results (after running any small dataset) → check the KPI row has FOUR
   symmetric class cards (Helix, FF-Helix, SSW, FF-SSW) and that Total
   Peptides is now a sub-header line above the cards, not a 5th card. This is
   the symmetry-of-treatment fix from your Q5 Drive comment.

3. /help → confirm the 4 sections appear in your verbatim wording (Alpha-helix
   secondary structure, Fibril-forming alpha helix, Secondary structure switch,
   Fibril-forming secondary structure switch). I pasted your text exactly as
   you wrote it; let me know if anything needs editing.

4. /database-search → run a UniProt query and confirm TANGO + S4PRED toggles
   default to ON. This was your Slack confusion ("TANGO: OFF S4PRED: OFF" on
   a UniProt single-entry analysis) — the toggles now default ON so a
   researcher gets a complete analysis without having to find them.

After your sign-off I'll:
  - Tag v0.3.0 → Zenodo DOI mints
  - Submit bio.tools registration
  - Submit the JOSS software paper (Methods section anchored on Ragonis-Bachar
    et al. 2022, your DOI 10.1021/acs.biomac.2c00582)

If you spot anything broken or off, please tell me what you saw — same as the
TANGO/S4PRED OFF report, the more specific the better.

Thanks for everything,
Said
```

---

## §D — What blocks the "publish" verb after the test pass

Everything below MUST be true for v0.3.0 to ship:

- [ ] All 15 manual tests in §A pass
- [ ] Peleg's sign-off email response received OR she explicitly says "looks good, go"
- [ ] CI green on main (after all 7 PRs merge)
- [ ] Live VPS healthy and serving (`/api/health` returns `{"ok": true}`)
- [ ] No P0 issues open in KNOWN_ISSUES.md
- [ ] CITATION.cff version bumped to 0.3.0 + date-released updated
- [ ] README has the Zenodo DOI badge (once tagged) + the Ragonis-Bachar paper citation
- [ ] Tag created: `gh release create v0.3.0 --title "v0.3.0" --notes-file docs/active/A5_ZENODO_RELEASE.md --target main`
- [ ] bio.tools entry submitted at https://bio.tools/contribute
- [ ] JOSS submission opened at https://joss.theoj.org/papers/new

After those: PVL v0.3.0 is published. Anything in §B is January MIT work.
