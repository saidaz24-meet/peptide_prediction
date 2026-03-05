---
description: Audit dead code, stale docs, and test count drift for milestone transitions.
---

# Milestone Cleanup Audit

Run this at the end of a major milestone (feature branch merge, sprint end, review chunk completion) to ensure the codebase is clean.

## Step 1: Dead code audit (backend)

Search for unused imports, unimported files, and stale archive directories:
- Check `backend/_archive/` — should be empty or deleted
- Search for files with zero imports: `grep -rL "import" backend/*.py` (excluding __init__)
- Check for unused constants: grep for JPRED, PSIPRED, or other removed feature references
- Verify `backend/services/cache.py` status (intentionally empty, preparatory)

## Step 2: Dead code audit (frontend)

Search for unused components, libs, and types:
- Check each file in `ui/src/components/` and `ui/src/components/charts/` for imports
- Check each file in `ui/src/lib/` for imports (exclude test files)
- Check `ui/src/types/` for unused type definitions
- Check `ui/public/` for unused assets (favicon duplicates, placeholder files)

## Step 3: Doc freshness check

- Verify test counts in TESTING_GUIDE.md match actual: `cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ --co -q | tail -1` and `cd ui && npx vitest run 2>&1 | grep "Tests"`
- Verify ROADMAP.md "Current Status" section is accurate
- Verify KNOWN_ISSUES.md reflects actual open issues
- Check MASTER_DEV_DOC.md "Codebase Vital Signs" section
- Verify MEMORY.md test counts and architecture notes

## Step 4: Cross-reference validation

- Check for broken doc links: search for `.md)` references and verify targets exist
- Verify CLAUDE.md file references still point to real files
- Check that Key Files Reference table in CLAUDE.md matches reality

## Step 5: Build and test verification

Run the full verification suite:
```bash
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short
cd ui && npx vitest run
cd ui && npm run build
```

## Step 6: Merge strategy recommendation

Based on current branch state:
- Count commits ahead of main: `git rev-list --count main..HEAD`
- If >10 commits with fix-fix chains: recommend squash merge
- If clean atomic commits: recommend regular merge
- Always recommend keeping the feature branch for history

## Output

Provide a summary table:
| Category | Issues Found | Action Needed |
|----------|-------------|---------------|
| Backend dead code | ... | ... |
| Frontend dead code | ... | ... |
| Doc staleness | ... | ... |
| Cross-references | ... | ... |
| Tests | ... | ... |
| Merge readiness | ... | ... |
