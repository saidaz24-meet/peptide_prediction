# Knowledge Index

Quick reference table for all documentation. Agents should read Tier 1 by default; Tier 2 when needed; Tier 3 is blocked.

| Document | Tier | Purpose | Last Updated |
|----------|------|---------|--------------|
| **DEV_CONTEXT.md** | 1 | Primary context: project overview, folder map, invariants, tests | 2025-01-31 |
| **SYSTEM_MAP.md** | 1 | Architecture diagram and module overview | 2024-01-14 |
| **EXECUTION_PATHS.md** | 1 | End-to-end execution flows | 2024-01-14 |
| **FAILURE_MODES.md** | 1 | Silent failure modes with fixes | 2024-01-14 |
| **CONFIG_MATRIX.md** | 1 | All environment variables/flags | 2024-01-14 |
| reference/WORKFLOWS.md | 2 | Operator cookbook (setup, running, troubleshooting) | 2024-01-14 |
| reference/ARCHITECTURE.md | 2 | Detailed frontend architecture | 2024-01-13 |
| reference/OBSERVABILITY.md | 2 | Logging and monitoring | 2024-01-14 |
| reference/FILE_REFERENCE.md | 2 | File-by-file commentary | Unknown |
| user/TODO_TRIAGE.md | 2 | Code smells and quick wins | 2024-01-13 |
| user/ACCURACY_FALLBACKS.md | 2 | Provider mapping rules | Unknown |
| user/SENTRY_TESTING.md | 3 | User-specific testing procedures | Unknown |
| user/SENTRY_TROUBLESHOOTING.md | 3 | User-specific debugging | Unknown |
| user/learn/OBSERVABILITY_ELI5.md | 3 | Teaching materials | Unknown |
| _archive/** | 3 | Historical snapshots, legacy docs, audit reports, refactor notes | Various |

## Tier Definitions

- **Tier 1 (MUST_READ)**: Essential for understanding the codebase. Read by default.
- **Tier 2 (OPTIONAL)**: Useful reference material. Read when relevant to task.
- **Tier 3 (IGNORE)**: Historical, user-specific, or bulky. Blocked by `.claudeignore`.

## Quick Access

**For agents starting work:**
1. Read `DEV_CONTEXT.md` (always)
2. Read relevant Tier 1 docs based on task
3. Consult Tier 2 docs if needed
4. Never read Tier 3 (blocked)

**For developers:**
- Setup: `reference/WORKFLOWS.md`
- Architecture: `SYSTEM_MAP.md` + `reference/ARCHITECTURE.md`
- Debugging: `FAILURE_MODES.md` + `reference/OBSERVABILITY.md`
- Configuration: `CONFIG_MATRIX.md`
