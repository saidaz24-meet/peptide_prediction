---
description: Start-of-session briefing — what changed, what's pending, what to do next
allowed-tools: Bash, Read, Grep, Glob
---

# Session Catch-Up — PVL

Run these in parallel and present a concise briefing:

1. **Recent commits**: `git log --oneline -10`
2. **Uncommitted changes**: `git status` and `git diff --stat`
3. **Branch state**: `git branch -a` and remote sync status
4. **Build health backend**: `cd /Users/saidazaizah/Desktop/DESY/peptide_prediction && make test 2>&1 | tail -10`
5. **Build health frontend**: `cd /Users/saidazaizah/Desktop/DESY/peptide_prediction/ui && npx tsc --noEmit 2>&1 | tail -10`
6. **Open issues**: Read `docs/active/KNOWN_ISSUES.md` for current bug count
7. **Roadmap position**: Read `docs/active/ROADMAP.md` summary section

Present as:
```
## PVL Session Briefing — [date]
- **Last 5 commits**: ...
- **Uncommitted**: X files modified / clean
- **Backend tests**: passing/failing (N tests)
- **Frontend types**: clean/errors
- **Open issues**: N known issues
- **Current phase**: [phase from roadmap]
- **Suggested next task**: [based on priority]
```

Keep it under 20 lines. Be direct.
