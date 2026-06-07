# T6 dispatch — Wave 2.6 batch landing (2026-06-03, pre-Zoom)

## Mission
Land the Wave 2.6 Peleg-Drive-comments batch as a **single PR** before tomorrow's Zoom with Peleg (2026-06-04). She should see the changes live on `http://94.130.178.182:3000` during the call.

## Branch + scope
- Base: `main`
- New branch: `wave-2.6-peleg-drive-batch`
- 14 files. Mix of code (frontend + backend config) + docs.

## What's in this batch

**Backend** (2 files):
- `backend/config.py` — `S4PRED_MAX_LENGTH` 100→40 default; new `PEPTIDE_LENGTH_HARD_MAX=40` + `PEPTIDE_LENGTH_USER_OVERRIDE_MIN=10` + `PEPTIDE_LENGTH_USER_OVERRIDE_MAX=40`; `PEPTIDE_LENGTH_WARN_MAX` 100→40. All per Peleg's Drive answer (2026-06-03): above 40 aa the SS prediction becomes a surface-vs-structure problem.
- `backend/tests/test_canary_peptides.py` — Aβ16-22 (KLVFFAE) added as pipeline-appropriate amyloid control; Aβ42 kept with "past pipeline length" note; "negative controls" comment rewritten as "regression canaries".

**Frontend** (4 files):
- `ui/src/components/PeptideTable.tsx` — 7 column tooltip rewrites (Helix / SSW / FF-Helix / FF-SSW / S4PRED Helix % / Charge pH 7.0→7.4 / Hydrophobicity / μH).
- `ui/src/components/charts/ClassificationComparison.tsx` — Cohort Comparison colour swap (No SSW = brown-orange, SSW = green, FF-SSW = darker green); applied symmetrically to Helix grouping; `barCategoryGap` 20% → 35% for cluster spacing.
- `ui/src/pages/PeptideDetail.tsx` — AlphaFold-predicted structure title rename; FF-Helix vs Aggregation Max scatter now has visible axis labels + static legend (Current peptide / Database) below the chart.
- `ui/src/pages/Upload.tsx` + `ui/src/pages/QuickAnalyze.tsx` — length-warning copy rewritten in Peleg's language: above 40 aa = surface-vs-structure problem, S4PRED skipped (not "reduced accuracy").

**Docs** (8 files):
- `docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` — "shared fibril-forming biophysics" framing replaces "false-positive class".
- `docs/active/PELEG_FOLLOWUP_TECHNICAL_PACKET.md` §11.7 + §11.8 — Q5 symmetry-of-treatment reinterpretation.
- `docs/active/PELEG_FOLLOWUP_PACKET_2_FULL_UPDATE.md` §4 + §5 — MCP shipped status + multi-feature scoring REJECTED per Peleg Drive comments 9-11.
- `docs/active/PELEG_FOLLOWUP_PACKET_3_DIRECT_QA.md` — NEW. Direct Q&A per visible PPT question.
- `docs/active/PELEG_DRIVE_COMMENTS_CONFUSION_MAP.md` — NEW. Per-comment breakdown of 27 Drive comments + 3 scientific shifts.
- `docs/active/PELEG_FOLLOWUP_DOC_V2.md` — NEW. V2 follow-up with Hebrew opener, latest Peleg answers folded in (Q1 length-cap answered, Q4 TANGO stretch, Q5 black-G, Q6 DOI), trimmed open questions.
- `docs/active/ROADMAP.md` — Wave 2.6 section added above Wave 2.5 with Round 1 shipped + Round 2 queued.
- `docs/active/SESSION_LOG.md` — Wave 2.6 entry.

## T6 steps

1. `git checkout -b wave-2.6-peleg-drive-batch` from current `main`.
2. Stage all 14 files (`git add -A` is fine here; double-check `git status` shows no surprise paths).
3. **Commit in 4 logical chunks** so the merge log stays readable:
   - **C1 — backend length cap + canary**: `backend/config.py`, `backend/tests/test_canary_peptides.py`. Title: `feat(backend): 40-aa pipeline cap default + KLVFFAE canary (Peleg Drive 2026-06-03)`
   - **C2 — frontend tooltips + AlphaFold title + length warnings**: `ui/src/components/PeptideTable.tsx`, `ui/src/pages/PeptideDetail.tsx`, `ui/src/pages/Upload.tsx`, `ui/src/pages/QuickAnalyze.tsx`. Title: `feat(frontend): tooltip + warning copy aligned to Peleg Drive answers`
   - **C3 — cohort chart polish**: `ui/src/components/charts/ClassificationComparison.tsx`. Title: `feat(chart): cohort comparison colour swap + spacing (Peleg Drive 2026-06-03)`
   - **C4 — doc updates**: 8 doc files. Title: `docs: Peleg Drive comments folded into V2 follow-up + Wave 2.6 ROADMAP + packets 1/2/3 framing`

4. **Local verify before push** (all from repo root):
   - `cd ui && npx tsc --noEmit` → must exit 0
   - `cd ui && npx vitest run src/components/charts/__tests__/ClassificationComparison.test.tsx` → must pass
   - `cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_canary_peptides.py tests/test_axiom_invariants.py tests/test_4category_classification.py -q` → must pass
   - If any fails: STOP and ping T1.

5. `git push -u origin wave-2.6-peleg-drive-batch`.

6. **Open PR against `main`** with this body:
   ```
   ## Summary
   - Wave 2.6 Peleg-Drive-comments batch (27 inline comments from 2026-05-22 + authoritative answers 2026-06-03)
   - Round 1 of 2: tooltip + framing + chart polish + 40-aa pipeline cap default
   - Round 2 (hard-reject route, Help.tsx 4 sections, FF-Helix % rename, black-G fragment derivation, TANGO stretch) queued for Wave 2.7 post-Zoom

   ## Why land now
   Zoom with Peleg 2026-06-04 — she should see these changes live during the call.

   ## Verification
   - `npx tsc --noEmit` clean
   - 50 backend tests + canary + axiom + 4-class all green
   - ClassificationComparison vitest green

   ## Files
   2 backend + 4 frontend + 8 docs (3 new)
   ```

7. **Watch CI** (`gh pr checks --watch`). If any check red: report the failure to T1, do NOT force-merge.

8. **Merge** with `gh pr merge --merge --delete-branch` (merge commit, preserve the 4-chunk log).

9. **Watch auto-deploy** to `94.130.178.182`. Expected ~3 min via the existing deploy workflow.

10. **Smoke-test live VPS** once deploy is green:
    - `curl -fsS http://94.130.178.182:8000/health` → 200
    - Open `http://94.130.178.182:3000` in browser, hard refresh
    - Verify on `/peptides/P0C005`: card title reads "AlphaFold-predicted structure"; the FF-Helix vs Aggregation Max scatter has axis labels and the legend strip underneath
    - Verify on `/results` (after running any dataset): the two cohort-comparison charts are present, "No SSW" / "No Helix" bars are brown-orange, "SSW" / "Helix" bars green, with more space between feature clusters than before
    - Verify on Quick Analyze: paste a 50-aa sequence — destructive alert appears stating "exceeds the 40-aa pipeline limit"

11. **Report back to T1** with: PR number, merge SHA, deploy run ID, smoke-test results. One concise message.

## Hard rules
- No `--no-verify`. No `--force`. No amending.
- If CI fails: fix the underlying issue or report — never bypass.
- Do NOT touch files outside this batch.
- If you see uncommitted changes you didn't make (e.g. someone else also has the repo open), STOP and ping T1.
