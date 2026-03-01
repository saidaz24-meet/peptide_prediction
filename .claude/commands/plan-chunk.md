---
description: Enter plan mode for a specific Peleg review chunk. Reads the chunk from PELEG_REVIEW_TASKS.md, lists all questions, and waits for answers before any implementation.
argument-hint: <chunk-number>
---

# Plan Chunk $ARGUMENTS from Peleg Review

## Step 1: Read the chunk
Read `docs/active/PELEG_REVIEW_TASKS.md` and extract CHUNK $ARGUMENTS completely. Show the user the full chunk content.

## Step 2: Read cross-cutting concerns
Also read CHUNK 9 (Cross-Cutting Concerns) since these rules apply to EVERY chunk.

## Step 3: Identify all questions and ambiguities
For this chunk, list:
1. **Clarification questions** — anything ambiguous or could be interpreted multiple ways
2. **[DECIDE AFTER RESEARCH] items** — list each one and what research is needed
3. **FF-everywhere check** — which existing UI elements might need FF data added
4. **Dependencies** — does this chunk depend on another chunk being done first?

## Step 4: ASK the user
Present all questions using AskUserQuestion. Do NOT proceed until answered.

## Step 5: Research phase
For any [DECIDE AFTER RESEARCH] items:
- Search the web for best practices, UX patterns, scientific tool examples
- Examine the current codebase implementation
- Present findings with 2-3 options, each with tradeoffs
- Recommend one option with reasoning
- Wait for user approval

## Step 6: Create implementation plan
After all questions are answered and research is approved:
- List every file that will be modified
- List every new file that will be created
- Estimate the order of changes
- Flag any changes that touch protected files (api_models.py)

Enter plan mode now and begin with Step 1.
