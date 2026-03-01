---
description: Summarize what was done in this session, list files changed, suggest verification commands, and recommend what to prompt next.
---

# Session Checkpoint

## Step 1: Summarize work done
Review the conversation history and summarize:
- What tasks were completed
- What decisions were made
- What questions were answered

## Step 2: List files changed
Run `git diff --name-only` and `git diff --cached --name-only` to show all modified files.
Also check `git status` for untracked files that were created.

Group by category:
- **Backend**: Python files changed
- **Frontend**: TypeScript/React files changed
- **Config**: Settings, configs, docs changed
- **Tests**: Test files changed or created

## Step 3: Verification commands
Based on what changed, suggest the exact commands to verify:
```bash
make test        # If backend logic changed
make lint        # If any code changed
make typecheck   # If types changed
make ci          # For significant changes
npx vitest run   # If frontend tests changed
```

## Step 4: Check for uncommitted work
If there are changes that should be committed, suggest a commit message following the project's conventional commit style (feat/fix/refactor/docs).

## Step 5: Recommend next steps
Based on what was done and what's pending:
- What's the logical next task?
- Any follow-up items discovered during this session?
- Should the user run `/compact` to free context?
- Reference specific chunks from PELEG_REVIEW_TASKS.md if applicable

## Step 6: Update memory (if needed)
If any significant patterns, bugs, or decisions were discovered in this session, note them for potential memory updates. Do NOT auto-write to memory — just flag what might be worth remembering.
