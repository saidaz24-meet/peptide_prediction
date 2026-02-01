# Documentation Reorganization Summary

## Classification

### Tier 1: MUST_READ (Essential for agents)
- `DEV_CONTEXT.md` - Primary context: project overview, folder map, invariants, tests
- `SYSTEM_MAP.md` - Architecture diagram and module overview
- `EXECUTION_PATHS.md` - End-to-end execution flows
- `FAILURE_MODES.md` - Silent failure modes with fixes
- `CONFIG_MATRIX.md` - All environment variables/flags

### Tier 2: OPTIONAL (Useful but not essential)
- `reference/WORKFLOWS.md` - Operator cookbook
- `reference/ARCHITECTURE.md` - Detailed frontend architecture
- `reference/OBSERVABILITY.md` - Logging and monitoring
- `reference/FILE_REFERENCE.md` - File-by-file commentary
- `user/TODO_TRIAGE.md` - Code smells and quick wins
- `user/ACCURACY_FALLBACKS.md` - Provider mapping rules

### Tier 3: IGNORE (Historical, bulky, or user-specific)
- `_archive/archive/**` - Historical snapshots
- `_archive/legacy/**` - Old documentation
- `_archive/audit/**` - Historical analysis reports
- `_archive/refactor/**` - Historical refactoring notes
- `user/SENTRY_TESTING.md` - User-specific testing
- `user/SENTRY_TROUBLESHOOTING.md` - User-specific debugging
- `user/learn/**` - Teaching materials

## Files Moved

### Tier 1 files moved to docs/ root:
- `docs/active/SYSTEM_MAP.md` → `docs/SYSTEM_MAP.md`
- `docs/active/EXECUTION_PATHS.md` → `docs/EXECUTION_PATHS.md`
- `docs/active/FAILURE_MODES.md` → `docs/FAILURE_MODES.md`
- `docs/active/CONFIG_MATRIX.md` → `docs/CONFIG_MATRIX.md`

### Tier 2 files moved to docs/reference/:
- `docs/active/WORKFLOWS.md` → `docs/reference/WORKFLOWS.md`
- `docs/active/ARCHITECTURE.md` → `docs/reference/ARCHITECTURE.md`
- `docs/active/OBSERVABILITY.md` → `docs/reference/OBSERVABILITY.md`
- `docs/active/FILE_REFERENCE.md` → `docs/reference/FILE_REFERENCE.md`

### Tier 3 folders moved to docs/_archive/:
- `docs/archive/` → `docs/_archive/archive/`
- `docs/legacy/` → `docs/_archive/legacy/`
- `docs/audit/` → `docs/_archive/audit/`
- `docs/refactor/` → `docs/_archive/refactor/`

### Removed:
- `docs/active/` (empty after moves)
- `docs/README.md` (replaced by KNOWLEDGE_INDEX.md)

## Final Structure

```
docs/
├── DEV_CONTEXT.md              # Tier 1
├── KNOWLEDGE_INDEX.md           # Tier 1 (index table)
├── SYSTEM_MAP.md                # Tier 1
├── EXECUTION_PATHS.md           # Tier 1
├── FAILURE_MODES.md             # Tier 1
├── CONFIG_MATRIX.md             # Tier 1
├── reference/                   # Tier 2
│   ├── WORKFLOWS.md
│   ├── ARCHITECTURE.md
│   ├── OBSERVABILITY.md
│   └── FILE_REFERENCE.md
├── user/                        # Tier 2/3
│   ├── TODO_TRIAGE.md           # Tier 2
│   ├── ACCURACY_FALLBACKS.md    # Tier 2
│   ├── SENTRY_TESTING.md       # Tier 3 (blocked)
│   ├── SENTRY_TROUBLESHOOTING.md # Tier 3 (blocked)
│   └── learn/                   # Tier 3 (blocked)
└── _archive/                    # Tier 3 (blocked)
    ├── archive/
    ├── legacy/
    ├── audit/
    └── refactor/
```

## Git Commands (to preserve history)

To preserve Git history, run these commands:

```bash
# Tier 1 moves
git mv docs/active/SYSTEM_MAP.md docs/SYSTEM_MAP.md
git mv docs/active/EXECUTION_PATHS.md docs/EXECUTION_PATHS.md
git mv docs/active/FAILURE_MODES.md docs/FAILURE_MODES.md
git mv docs/active/CONFIG_MATRIX.md docs/CONFIG_MATRIX.md

# Tier 2 moves
git mv docs/active/WORKFLOWS.md docs/reference/WORKFLOWS.md
git mv docs/active/ARCHITECTURE.md docs/reference/ARCHITECTURE.md
git mv docs/active/OBSERVABILITY.md docs/reference/OBSERVABILITY.md
git mv docs/active/FILE_REFERENCE.md docs/reference/FILE_REFERENCE.md

# Tier 3 moves
git mv docs/archive docs/_archive/archive
git mv docs/legacy docs/_archive/legacy
git mv docs/audit docs/_archive/audit
git mv docs/refactor docs/_archive/refactor

# Cleanup
git rm docs/active/README.md
git rm docs/README.md
```

