# Small Repo Audit Template

## Goal
Audit: [SCOPE - e.g., "test coverage", "unused imports", "type safety gaps"]

## Constraints
- Do not read `docs/` except `docs/DEV_CONTEXT.md`
- Read-only analysis: no code changes
- Focus on actionable findings
- Use `/compact` mode if scanning large areas

## File-Gating Rule
Read only:
- `docs/DEV_CONTEXT.md` (context)
- Files relevant to audit scope
- Test files (if auditing coverage)
- Configuration files (if auditing setup)

## Analysis Process
1. **Scope**: Identify files/directories to analyze
2. **Search**: Use codebase_search for patterns
3. **Read**: Minimal file reading (short lists)
4. **Summarize**: Findings with file:line references
5. **Recommend**: Prioritized action items

## Required Commands
```bash
# Optional: understand current state
make test && make lint && make typecheck
```

## Output Format
```
Audit scope: [what was analyzed]
Findings:
1. [finding] - `file:line` - [severity: high/medium/low]
2. [finding] - `file:line` - [severity]
Recommendations: [prioritized action items]
```

