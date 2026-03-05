---
name: pvl-peleg-review
description: Peleg review task management. Use when user mentions Peleg, review tasks, fibril formation, FF data, chunk work, threshold controls, terminology scan, or any task from the holistic review document.
user-invocable: true
argument-hint: [chunk-number]
---

# Peleg Review Task System

## Source Document
`docs/active/PELEG_REVIEW_TASKS.md` — Read this FIRST for any Peleg-related work.

## Workflow Protocol (MANDATORY)
1. **PLAN MODE FIRST** — before touching any code
2. **ASK QUESTIONS** — if ANY item is ambiguous, stop and ask. Do not guess intent.
3. **Research before deciding** — items marked `[DECIDE AFTER RESEARCH]` require web search + codebase analysis + user approval
4. **Chunk execution** — do ONE chunk per session. Summarize at end.
5. **FF-everywhere check** — for EVERY UI element you touch: "Should FF data also be shown here?"

## The Four Core Data Categories
1. **SSW** — Switching peptides (from TANGO)
2. **α-Helix** — Helix predictions (from S4PRED)
3. **FF α-Helix** — Fibril-forming helical (μH/hydrophobicity thresholds)
4. **FF SSW** — Fibril-forming switching (biochemical thresholds)

## Cross-Cutting Rules (apply to EVERY change)
- **FF Data Everywhere**: Ask "Should FF data also be shown here?" for every UI element
- **Aggregation Trust**: TANGO aggregation is SECONDARY. Not in dashboard summaries, not as primary chart metrics. OK in peptide detail pages.
- **User-as-Stupid Principle**: Every UI must pass "would a confused first-time user understand this in 3 seconds?"
- **Repetitiveness Guard**: FF data everywhere relevant BUT each view shows it in the way most useful for THAT context

## Chunk Summary
| Chunk | Topic | Priority |
|-------|-------|----------|
| 1 | FF Data Layer — new columns, 4 categories, thresholds | Phase 1 |
| 2 | Threshold Controls — remove old, add smart flagging | Phase 2 |
| 3 | Terminology & UX — simplify for non-researchers | Phase 3 |
| 4 | Graphs & Visualizations — delete/replace/add | Phase 4 |
| 5 | Results Table & Filtering — FF categories in filters | Phase 3 |
| 6 | Candidate Ranking — deep research + redesign | Phase 5 |
| 7 | Peptide Detail Page — feature comparison, sliding windows | Phase 6 |
| 8 | Parked Items — compare 5+ tables, UI redesign, VM/K8s | Later |
| 9 | Cross-Cutting Concerns — FF everywhere, agg trust, UX | Always |

## Starting a Chunk
If user says "chunk N" or provides $ARGUMENTS:
1. Read the specific chunk from `docs/active/PELEG_REVIEW_TASKS.md`
2. List ALL questions and ambiguities before writing code
3. For `[DECIDE AFTER RESEARCH]` items: search web, analyze codebase, present findings
4. Get user approval on the plan
5. Implement
6. Summarize: files changed, verification commands, what's next

## Terminology Quick Reference
- "species" → "organisms" (across all UI)
- "SSW negative" / "SSW-" → "No SSW"
- "SSW positive" / "SSW+" → "SSW"
- "FF SSW" → "Fibril Forming SSW" (where space allows, or use legend)
- "15aa" → "15 amino acids" (spell out for non-researchers)
