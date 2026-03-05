---
description: Audit all UI components to verify FF (fibril formation) data is shown everywhere it should be. Cross-references with PELEG_REVIEW_TASKS.md chunk 9 cross-cutting concerns.
---

# FF Data Audit

Scan all UI components and pages to check if FF data is properly displayed.

## What to check

### FF fields that should appear in the UI:
- `ffHelixPercent` — FF-Helix percentage
- `ffHelixFlag` — FF-Helix classification flag (1/-1/null)
- `ffHelixFragments` — FF-Helix segment positions
- `ffSswFlag` — FF-SSW flag (from apply_ff_flags)
- `ffSswScore` — FF-SSW score

### Pages to audit:
1. **Results.tsx** — Main dashboard: Are FF percentages in KPI cards? FF in charts?
2. **PeptideDetail.tsx** — Detail view: FF data in evidence panel? FF in per-residue view?
3. **PeptideTable.tsx** — Table: FF columns visible? FF in filters?
4. **ResultsCharts.tsx** — Charts: FF represented in visualizations?
5. **ResultsKpis.tsx** — KPI cards: FF % of helical? FF % of SSW?
6. **RankedTable.tsx** — Ranking: FF included in ranking metrics?
7. **Compare.tsx** — Comparison: FF data in side-by-side view?

## How to audit
For each page/component:
1. Grep for `ffHelix`, `ffSsw`, `fibril` in the file
2. Check if the component receives peptide data but doesn't display FF fields
3. Check if related non-FF fields (like `sswPrediction`, `s4pred*`) are shown but FF equivalents are missing

## Scan commands
```
grep -rn "ffHelix\|ffSsw\|fibril\|FF.Helix\|FF.SSW" ui/src/
grep -rn "sswPrediction\|s4pred" ui/src/components/ ui/src/pages/
```

## Output format
Report as a table:
| Component | Has FF data? | Missing FF fields | Action needed |
|-----------|-------------|-------------------|---------------|
| Results.tsx | Partial | ffSswFlag not shown | Add FF SSW KPI |
| ... | ... | ... | ... |

Flag components where SSW or S4PRED data is shown but the corresponding FF data is absent.

Per Peleg's review (Chunk 9.1): "from now on you have a new type of data to show and work with, all the comments below you need to think if they are also relevant to the ff or not and act accordingly."
