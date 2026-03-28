---
description: "Fetch a known issue, explore the code, plan the fix, implement, verify"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Agent
---

# Fix Issue — PVL

Given issue ID (e.g., `ISSUE-020`), execute this workflow:

## 1. Load Issue
- Read `docs/active/KNOWN_ISSUES.md`
- Find the issue by ID
- Extract: symptom, root cause, affected files, proposed fix

## 2. Explore
- Read all affected files mentioned in the issue
- Identify the exact lines that need changing
- Check if there are related tests

## 3. Plan
- Propose the minimal fix (smallest diff)
- List files to modify
- List new tests needed
- Present plan to user for approval

## 4. Implement (after approval)
- Write failing test first (TDD)
- Apply the fix
- Run `make test` to verify
- Run `make lint` if Python changed
- Run `npx tsc --noEmit` if TypeScript changed

## 5. Report
```
## Fix Complete: ISSUE-XXX

### Changes
- file1.py: [what changed]
- file2.tsx: [what changed]

### Tests
- test_file.py: [new test added]

### Verify
make ci
```
