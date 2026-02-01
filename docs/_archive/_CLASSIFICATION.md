# Documentation Classification

## Tier 1: MUST_READ (Essential for agents)

- `DEV_CONTEXT.md` - Primary context: project overview, folder map, invariants, tests
- `active/SYSTEM_MAP.md` - Architecture diagram and module overview (essential for understanding structure)
- `active/EXECUTION_PATHS.md` - End-to-end execution flows (critical for understanding how code works)
- `active/FAILURE_MODES.md` - Silent failure modes with fixes (prevents breaking things)
- `active/CONFIG_MATRIX.md` - All environment variables/flags (needed for configuration)

## Tier 2: OPTIONAL (Useful but not essential)

- `active/WORKFLOWS.md` - Operator cookbook (setup guide, useful but not critical)
- `active/ARCHITECTURE.md` - Detailed frontend architecture (helpful for frontend work)
- `active/OBSERVABILITY.md` - Logging and monitoring (useful for debugging)
- `active/FILE_REFERENCE.md` - File-by-file commentary (reference material)
- `user/TODO_TRIAGE.md` - Code smells and quick wins (useful for maintenance)
- `user/ACCURACY_FALLBACKS.md` - Provider mapping rules (useful for understanding data flow)

## Tier 3: IGNORE (Historical, bulky, or user-specific)

- `archive/**` - Historical snapshots (not needed for current work)
- `legacy/**` - Old documentation (historical reference only)
- `audit/**` - Historical analysis reports (bulky, not actionable)
- `refactor/**` - Historical refactoring notes (completed work)
- `user/SENTRY_TESTING.md` - User-specific testing procedures
- `user/SENTRY_TROUBLESHOOTING.md` - User-specific debugging
- `user/learn/**` - Teaching materials (not for agents)
- `README.md` (subdirectories) - Navigation files only
- `KNOWLEDGE_INDEX.md` - Will be replaced with new index

## Proposed Final Layout

```
docs/
├── DEV_CONTEXT.md              # Tier 1 (root)
├── KNOWLEDGE_INDEX.md          # Tier 1 (new index table)
├── SYSTEM_MAP.md               # Tier 1 (moved from active/)
├── EXECUTION_PATHS.md          # Tier 1 (moved from active/)
├── FAILURE_MODES.md            # Tier 1 (moved from active/)
├── CONFIG_MATRIX.md            # Tier 1 (moved from active/)
├── reference/                  # Tier 2 (renamed from active/)
│   ├── WORKFLOWS.md
│   ├── ARCHITECTURE.md
│   ├── OBSERVABILITY.md
│   └── FILE_REFERENCE.md
├── user/                       # Tier 2/3 (keep as-is, but in .claudeignore)
│   ├── TODO_TRIAGE.md          # Tier 2
│   ├── ACCURACY_FALLBACKS.md   # Tier 2
│   └── [other user docs]      # Tier 3
└── _archive/                   # Tier 3 (renamed, blocked)
    ├── archive/
    ├── legacy/
    ├── audit/
    └── refactor/
```

