---
description: Scan all UI text for terminology that needs simplification per Peleg's review. Reports current text vs suggested replacement, grouped by file.
---

# Terminology Scan

Scan the entire UI for terms that should be simplified for non-researcher users (per PELEG_REVIEW_TASKS.md Chunk 3).

## Known replacements (apply everywhere):
| Current | Replacement | Reason |
|---------|------------|--------|
| species | organisms | Peleg directive |
| SSW negative / SSW- | No SSW | Clearer for users |
| SSW positive / SSW+ | SSW | Simpler |
| FF SSW (without context) | Fibril Forming SSW | Full phrase or ensure legend visible |
| FF Helix (without context) | Fibril Forming Helix | Full phrase or ensure legend visible |
| aa (as unit) | amino acids | Spell out |
| muH / μH (unlabeled) | Hydrophobic Moment (μH) | Full name first, abbreviation in parens |
| CF propensity | Remove or replace | Per Peleg: not needed |

## Scan process

### Step 1: Find all user-visible text
Search for string literals, JSX text content, labels, tooltips, and placeholder text:
```
grep -rn "species\|SSW.negative\|SSW.positive\|SSW-\|SSW+\|\baa\b\|CF propensity\|muH" ui/src/
grep -rn "title=\|label=\|placeholder=\|tooltip\|description=" ui/src/components/ ui/src/pages/
```

### Step 2: Check abbreviations on first use
For each page, verify that technical abbreviations (SSW, FF, μH, S4PRED, TANGO) are either:
- Spelled out on first use, OR
- Defined in a visible legend/glossary

### Step 3: Check warning badges
Per Peleg (Chunk 3.4): Warnings should lead with NUMBER + urgency, then title.
Scan for warning/alert components and check if they follow this pattern.

### Step 4: Accessibility check
Would a non-researcher understand each piece of text in 3 seconds?
Flag anything that requires domain knowledge to parse.

## Output format
Group findings by file:
```
## ui/src/components/PeptideTable.tsx
- Line 45: "SSW-" → "No SSW"
- Line 78: "species" → "organisms"
- Line 120: "15aa" → "15 amino acids"

## ui/src/pages/Results.tsx
- Line 30: "Agg Hotspots" → consider removing (Peleg: don't trust aggregation)
```

Provide a count of total replacements needed and suggest implementation order (safest first).
