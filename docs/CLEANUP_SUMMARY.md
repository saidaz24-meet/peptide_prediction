# Cleanup Summary

Quick reference for the repository cleanup completed on 2024-01-14.

## What Was Done

### 1. Documentation Consolidation

**Created:**
- `docs/KNOWLEDGE_INDEX.md` — Single entry point to all documentation
- `docs/CLEANUP_PLAN.md` — Authoritative cleanup inventory
- `docs/legacy/README.md` — Explanation of archived docs

**Protected (Never Delete):**
- `docs/SYSTEM_MAP.md`
- `docs/EXECUTION_PATHS.md`
- `docs/WORKFLOWS.md`
- `docs/CONFIG_MATRIX.md`
- `docs/FAILURE_MODES.md`
- `docs/OBSERVABILITY.md`
- `docs/TODO_TRIAGE.md`
- `docs/README.md`
- `docs/CLEANUP_PLAN.md`
- `docs/KNOWLEDGE_INDEX.md`

**Kept (Still Useful):**
- `docs/ARCHITECTURE.md` — Detailed frontend architecture
- `docs/IMPLEMENTATION_STATUS.md` — Feature matrix
- `docs/ACCURACY_FALLBACKS.md` — Provider fallback rules
- `docs/FILE_REFERENCE.md` — File-by-file reference

**Archived (Moved to `docs/legacy/`):**
- Root-level: `CHANGES_*.md`, `CODEBASE_ANALYSIS.md`, `SEMANTIC_CORRECTNESS_ISSUES.md`, `FILE_INVENTORY.md`, `PRINCIPLES_*.md`
- Docs-level: `DEV_ERGONOMICS.md`, `CONTINUATION_PLAN.md`, `uniprot-flow.md`, `providers.md`, `provider-fixes-summary.md`

**Deleted:**
- `REPO_TREE.txt` — Auto-generated, not useful

### 2. Cache/Temp Directory Management

**Updated `.gitignore` to ignore:**
- `backend/.run_cache/` (already present)
- `backend/Tango/out/` (legacy)
- `backend/Tango/work/` (legacy)
- `backend/Psipred/out/` (legacy)
- `backend/Psipred/work/` (legacy)
- `ui/dist/` (build output)
- Test/coverage artifacts (`.coverage`, `htmlcov/`, `.pytest_cache/`, etc.)

**Runtime-Only Directories:**
- Created at runtime, not committed to VCS
- Use `scripts/clean_repo.sh --only-cache --apply` to clean

### 3. Cleanup Script

**Created:** `scripts/clean_repo.sh`
- Dry-run by default (safe)
- Flags: `--apply`, `--only-md`, `--only-cache`
- Implements actions from `docs/CLEANUP_PLAN.md`
- Never deletes outside the plan

## How to Use

### Run Cleanup (Dry-Run)
```bash
./scripts/clean_repo.sh
```

### Execute Cleanup
```bash
./scripts/clean_repo.sh --apply
```

### Clean Only MD Files
```bash
./scripts/clean_repo.sh --only-md --apply
```

### Clean Only Cache Directories
```bash
./scripts/clean_repo.sh --only-cache --apply
```

## Before/After

### Before Cleanup
- **Root MD files**: 11 files (many historical/change logs)
- **docs/ MD files**: 16 files (some overlapping)
- **Total**: 27 MD files
- **Cache dirs**: Mixed committed/uncommitted state

### After Cleanup
- **Root MD files**: 3 files (README.md, LICENSE-DESY-RESEARCH.md, DEPLOYMENT.md)
- **docs/ active**: 14 files (7 protected core + 4 useful + 3 indexes)
- **docs/legacy/**: 13 archived files
- **Total active**: 17 MD files (37% reduction)
- **Cache dirs**: All in `.gitignore`, runtime-only

## Verification

After cleanup, verify:
- ✅ `docs/KNOWLEDGE_INDEX.md` is the single entry point
- ✅ All protected docs remain in `docs/`
- ✅ Archived docs in `docs/legacy/` with `README.md` explaining why
- ✅ `.gitignore` includes all runtime caches
- ✅ App builds: `cd ui && npm run build`
- ✅ Smoke test passes: `./checks/smoke_uniprot.sh`

## Next Steps

1. **Review and execute cleanup:**
   ```bash
   ./scripts/clean_repo.sh  # Review plan
   ./scripts/clean_repo.sh --apply  # Execute
   ```

2. **Update any external links** that reference archived docs (if any)

3. **Verify app still works:**
   ```bash
   ./checks/preflight.sh
   ./checks/smoke_uniprot.sh
   ```

## Notes

- **Safe by default**: Script is dry-run by default
- **Idempotent**: Can run multiple times safely
- **Preserves knowledge**: Archived docs kept for reference
- **Single entry point**: `docs/KNOWLEDGE_INDEX.md` replaces fragmented docs

