# Cowork merge audit — Q7 / Q11 / B16 / B20 / OQ6 (2026-06-23)

> Cowork did NOT push to the branch. They wrote files in their own workspace and
> handed back `cp PVL/...` commands. **Do not paste their files directly** — three
> of them are full-file rewrites that would clobber work shipped this week.

## What Cowork delivered

| PR | File | Lines (Cowork) | Lines (current main) | Risk |
|---|---|---|---|---|
| Q11 | `ui/src/components/BiochemComparison.tsx` | 608 | 590 | 🔴 full rewrite |
| Q11 | `ui/src/components/PeptideViewer.tsx` | 254 | 195 | 🔴 full rewrite |
| Q11 | `ui/src/lib/referenceDistributions.ts` | 224 | NEW | 🟡 duplicates backend biochem formula |
| Q11 | `ui/src/components/__tests__/BiochemComparison.test.tsx` | 293 | existing | ✅ tests, additive |
| Q7  | `ui/src/components/SequenceTrack.tsx` | 325 | ~290 | 🔴 full rewrite |
| Q7  | `ui/src/components/__tests__/SequenceTrack.test.tsx` | 217 | existing | ✅ tests |
| B16 | `ui/src/components/Mol3DViewer.tsx` | 541 | 510 | 🟢 surgical +31 lines |
| B16 | `ui/src/lib/molstarSswOverpaint.ts` | 228 | NEW | ✅ clean separation from molstarOverlays.ts |
| OQ6 | `ui/src/components/AggregationHeatmap.tsx` | 402 | 283 | 🔴 full rewrite |
| B20 | `ui/src/pages/Compare.tsx` | 688 | 720 | ⚠️ net -32 lines (suspicious) |
| Tests | `B16-OQ6-B20-tests.tsx` | 136 | NEW | ✅ additive |

## What's at risk on each file

### `SequenceTrack.tsx` (Q7 rewrite)
At-risk recent work:
- **Q8 hover TANGO row** (commit `2e8d4a7`) — Cowork says "Popover TANGO row: Helix, β, Agg — completely untouched" → ✅ probably safe but verify
- **`hideTitle` prop** added 2026-06-23 in `b936c8f` for A8 fix — Cowork says "hideTitle prop — all unchanged" → ✅ probably safe but verify
- Default H/E/C SS_COLORS still used in popover — Cowork says preserved

### `AggregationHeatmap.tsx` (OQ6 rewrite)
At-risk recent work — **NONE of these mentioned in Cowork's writeup**:
- **Q12 panel title rename** to "Tango Secondary Structure and Aggregation Probabilities"
- **Q12 panel reorder** (structure first, aggregation second)
- **Q12 y-axis 0-100**
- **OQ3 magenta aggregation gradient** shipped in `b936c8f` (replaces teal/amber/red `aggBarColor`)
- ⚠️ All four likely clobbered if pasted directly

### `BiochemComparison.tsx` (Q11 rewrite)
At-risk recent work:
- **Q10 drop S4PRED helix%** — likely preserved (Cowork only modifies the tab UI, not the metric list)
- **F1 "cohort" → "database"** comment in file header — verify

### `Compare.tsx` (B20 rewrite, net -32 lines)
At-risk recent work:
- **F4 Y-axis labels** ("Number of peptides") on hydro + length histograms shipped in `35d45e1`
- **F1 cohort wording** in user-facing strings (Cohort A → Database A) — already migrated, verify preserved
- The net -32 lines is suspicious — what got dropped?

### `PeptideViewer.tsx` (Q11 modification)
At-risk recent work:
- **Q9 `<PerToolResultChips />`** mounted between sequence and biochem (commit `e5157b5`)
- **F1 "Upload a database for data-derived thresholds"** tooltip (commit `d122fe0`)
- Cowork says only props + forwarding added — sounds surgical but verify

### `Mol3DViewer.tsx` (B16 surgical)
✅ +31 lines, matches the documented additions (Toggle button + 2 useEffects + separator). Probably safe to apply.

## Duplicate-of-existing-code concerns

### `molstarSswOverpaint.ts` (NEW lib)
NOT a duplicate of `molstarOverlays.ts`. Cowork uses `extractSSWOverlay` from the existing lib, and the new file is just the Mol*-API wrapper for `setStructureOverpaint`. Clean separation.

### `referenceDistributions.ts` (NEW lib)
🟡 Duplicates the Fauchère-Pliska + Eisenberg biochem formula from `backend/biochem_calculation.py` on the client side. If Peleg ever changes the µH scale or hydrophobicity table, the client copy will silently drift. Long-term fix: expose a `/api/biochem-formula-constants` endpoint or generate a shared TS constants file from the Python source.

## Safe merge process

For each file with 🔴 risk:

1. Cowork pastes the FULL file content into Said's chat (or into `/tmp/cowork/<filename>` on disk)
2. Said pastes it to Claude
3. Claude diffs against current `main` HEAD, identifies what's preserved vs clobbered
4. Claude produces a merged version
5. Said `cp` from a clean location

For 🟢 (`Mol3DViewer.tsx`) — probably safe to apply directly after a quick diff.

For NEW libs — review the duplicate-formula concern; the magenta SSW overpaint is fine.

## Rules to paste at top of every future Cowork prompt

```
RULES FOR THIS REPO:
1. Do NOT replace whole files. Apply changes as targeted edits.
2. Before editing any file, run `git log --oneline main..HEAD -- <file>`
   to see what's been changed recently and preserve all of it.
3. Look for existing helpers before creating new ones — especially:
   - ui/src/lib/molstarOverlays.ts (SSW overlay extraction)
   - backend/biochem_calculation.py (Fauchère-Pliska + Eisenberg formulas)
   - ui/src/lib/profile.ts (helix range expansion)
4. List EVERYTHING you delete from the file in your delivery summary,
   not just what you add.
5. If you're tempted to duplicate a backend formula client-side, expose
   it via an API endpoint or import a shared TypeScript constant instead.
```

## Order to merge

When Said sends Cowork's actual file contents:
1. **`SequenceTrack.tsx`** (Q7) first — biggest payoff, resolves OQ1 too
2. **`AggregationHeatmap.tsx`** (OQ6) — most at-risk (Q12 + OQ3 work)
3. **`Compare.tsx`** (B20) — Y-axis labels at risk
4. **`BiochemComparison.tsx` + `PeptideViewer.tsx`** (Q11) — together
5. **`Mol3DViewer.tsx` + `molstarSswOverpaint.ts`** (B16) — likely paste-safe
6. **`referenceDistributions.ts`** — last, with the dup-formula note

## Current branch state (snapshot at audit time)

- Branch: `wave-2.8/peleg-pdf-followups`
- HEAD: `b936c8f` (back-arrow → /upload, A8 title restore, OQ3 magenta)
- 33 commits ahead of `main`
- Pre-push hook installed locally — Cowork's PRs (if they ever push) will hit the same hook
- CI green on latest push
