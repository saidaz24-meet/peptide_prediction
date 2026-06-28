# Cowork V11 — final polish before merge to main

**Goal.** Wave 2.8 / 2.9 is feature-complete. This dispatch is the last sweep before the branch `wave-2.8/peleg-pdf-followups` opens a PR to `main`. No new features. Quality only.

---

## Standing header (always include at the top of your first message)

```
WORKING DIRECTORY: /Users/saidazaizah/Desktop/DESY/peptide_prediction
BRANCH: wave-2.8/peleg-pdf-followups (currently 30+ commits ahead of main)

Before writing any file, run:
  cd /Users/saidazaizah/Desktop/DESY/peptide_prediction
  git fetch origin && git log --oneline -10
to see recent commits. Read the existing file with the Read tool before
editing — never blind-write over an existing file. Shared modules live at:
  ui/src/lib/sswColor.ts        (SSW magenta constants — DO NOT duplicate)
  ui/src/lib/peptideHtmlReport.ts (HTML report — import, don't reinvent)
  ui/src/components/UniProtBatchPreview.tsx (M3 helper — already wired)
```

---

## Tasks (in order — finish each one fully before starting the next)

### T1. Write the M3 component tests
File to create: `ui/src/components/__tests__/UniProtBatchPreview.test.tsx`

Cases:
- `parseAccessionList("P12345\nQ9UHC3-2\nfoo\nP12345")` → 4 entries with valid=[true,true,false,true] and duplicate=[false,false,false,true]
- `parseAccessionList("P12345, Q9UHC3, # comment\n\n  A0A0K9RCN8")` → 3 valid entries (whitespace + comma + comment-line stripped)
- `isValidAccession("P12345")` true; `isValidAccession("Q9UHC3-2")` true; `isValidAccession("foo")` false; `isValidAccession("p12345")` true (case-insensitive)
- Render: with 3 entries (1 valid, 1 invalid, 1 duplicate) the summary bar shows the exact counts "1 valid", "1 invalid", "1 duplicate". The "Remove invalid & duplicates" button shows.
- Render: clicking the X button on row 0 calls onRemove with 0.
- Render: clicking "Remove invalid & duplicates" calls onCleanup once.

Use existing test patterns from `ui/src/components/__tests__/PerToolResultChips.test.tsx` (vitest + @testing-library/react). Run `npx vitest run UniProtBatchPreview` to verify all green.

### T2. Run the full UI test suite — fix any reds
```bash
cd ui
npx vitest run 2>&1 | tail -40
```
If any test fails, read the failure, fix the test OR the code (whichever is correct), commit. If a test was already red on `main` (check with `git stash && git checkout main -- ui && npx vitest run <file>`), leave it and add a one-line note to the PR description.

### T3. Backend test sweep
```bash
make test 2>&1 | tail -30
```
Same rule: fix reds, leave pre-existing reds with a note.

### T4. Lint + type sweep
```bash
cd ui && npx tsc --noEmit && npm run lint 2>&1 | tail -20
cd .. && make lint && make typecheck 2>&1 | tail -20
```
Fix every error. Warnings: fix if trivial, leave if scope-creep.

### T5. Dead-code grep — small wins only
Search for any of these and delete if truly unused (confirm via grep across `ui/src/` and `backend/`):
- imports of `psipred`, `PSIPRED` anywhere
- references to `// removed` comments older than 30 days
- functions in `ui/src/lib/` with zero callers (use `grep -r "<funcName>" ui/src/ --include="*.ts*"`)

Don't go beyond this list. No refactors. If you're not sure something is dead, leave it.

### T6. README sweep
Read `README.md`. If the "Getting started" section is stale relative to `docs/active/HANDOFF.md` §2, update it to point at HANDOFF as the canonical start (one-line nudge, don't duplicate content). Do not touch anything else in README without flagging.

### T7. Final PR description
Write `docs/internal/PR_BODY_WAVE_2_8.md` containing:
- One-sentence summary of the branch
- Bulleted list of every feature/fix in the order of `git log main..HEAD --oneline` (compress related commits into one bullet)
- Test counts before/after (run the suites; report numbers)
- Manual verification checklist (the one in §"Browser checks" below — copy verbatim)
- Any pre-existing test reds you found and left alone, with one-line each on why

---

## Browser checks (paste into the PR body — do NOT run yourself)

Quick Analyze:
- [ ] LKLLKLLLKLLLKLL → legend "Helix 100% · SSW 0% · Coiled-coil 0%", residues blue
- [ ] Hover any residue → tooltip shows S4PRED row + TANGO row
- [ ] Card title "Predicted Secondary Structure" (not "AlphaFold-predicted structure")
- [ ] Back arrow returns to /upload (not /results)
- [ ] Per-tool chip strip under the sequence
- [ ] TANGO panel titled "Tango Secondary Structure and Aggregation Probabilities"; toggles under title; agg bars magenta
- [ ] Biochem block has "Compare with database:" tabs; "Fibril-forming short peptides" tab loads percentile bars
- [ ] Mol3D card shows "Show SSW residues" Toggle with magenta dot
- [ ] Action row: Copy · FASTA · Report (.html); Report downloads a working HTML file

Upload:
- [ ] "Upload file" / "Paste accessions" tabs above the dropzone
- [ ] Paste mode: textarea + preview table + per-row X + "Run analysis (N accessions)" button
- [ ] Submit with 2-3 valid accessions → progress bar → /results table

Compare:
- [ ] "Compare current dataset vs Peleg-118 fibril-forming peptides →" chip above the upload zone; click → Database B loads
- [ ] Both distribution histograms have "Number of peptides" Y-axis title

Peptide Detail:
- [ ] "Report (.html)" button alongside the PDF Report button

Export:
- [ ] CSV/TSV/XLSX downloads have a 4-line `# Method = ... # PVL version = ... # Thresholds = ... # Exported at = ...` prelude

---

## Hard rules

- **No new features.** Anything not in T1–T7 is out of scope.
- **No file renames or moves.**
- **No backend schema changes** (`backend/schemas/api_models.py` is locked).
- **No deletions outside T5.**
- **Commit identity**: `Said Azaizah <said.azaizah@cssb-hamburg.de>`. Never add Claude / AI / assistant / Anthropic anywhere.
- **One commit per task.** Use commit messages like `test(ui): T1 UniProtBatchPreview vitest coverage`, `chore: T4 lint sweep`, etc.

When done: report each task's outcome in a numbered list. If any task is blocked, stop and report — do not skip ahead.
