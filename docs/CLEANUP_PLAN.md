# Cleanup Plan

Authoritative list of all markdown files and cache/temp directories with classification and actions.

## Protection Rules

**NEVER DELETE** these docs (created in last pass):
- `docs/SYSTEM_MAP.md`
- `docs/EXECUTION_PATHS.md`
- `docs/WORKFLOWS.md`
- `docs/CONFIG_MATRIX.md`
- `docs/FAILURE_MODES.md`
- `docs/OBSERVABILITY.md`
- `docs/TODO_TRIAGE.md`
- `docs/README.md` (index)
- `docs/CLEANUP_PLAN.md` (this file)
- `docs/KNOWLEDGE_INDEX.md` (single entry point)

## MD Inventory Table

| Path | Purpose | Last Meaningful Change | Referenced By | Action | Rationale |
|------|---------|------------------------|---------------|--------|-----------|
| **Root Level** | | | | | |
| `README.md` | Main project README | 2024-01-13 | GitHub, onboarding | **Keep** | Primary entry point |
| `LICENSE-DESY-RESEARCH.md` | License file | Unknown | Legal | **Keep** | Required legal file |
| `DEPLOYMENT.md` | Deployment guide | Unknown | README.md:163 | **Keep** | Referenced in main README |
| `CHANGES_CSV_PARSING_FIX.md` | Historical change log | Unknown | None | **Archive** | Historical; info in FAILURE_MODES.md |
| `CHANGES_RESULT_ALIGNMENT_FIX.md` | Historical change log | Unknown | None | **Archive** | Historical; info in FAILURE_MODES.md |
| `CHANGES_UI_NUMERIC_NORMALIZATION_FIX.md` | Historical change log | Unknown | None | **Archive** | Historical; info in FAILURE_MODES.md |
| `CODEBASE_ANALYSIS.md` | Code analysis report | Unknown | None | **Archive** | Historical analysis; see TODO_TRIAGE.md |
| `SEMANTIC_CORRECTNESS_ISSUES.md` | Issue tracking | Unknown | None | **Archive** | Historical; see FAILURE_MODES.md |
| `FILE_INVENTORY.md` | File inventory | Unknown | None | **Archive** | Superseded by FILE_REFERENCE.md |
| `REPO_TREE.txt` | Repo tree dump | Unknown | None | **Delete** | Auto-generated, not useful |
| `PRINCIPLES_IMPLEMENTATION.md` | Implementation principles | Unknown | None | **Archive** | Historical; principles in code |
| `PRINCIPLES_IMPLEMENTATION_STATUS.md` | Implementation status | Unknown | None | **Archive** | Historical; see IMPLEMENTATION_STATUS.md |
| **docs/** | | | | | |
| `docs/README.md` | Docs index | 2024-01-13 | Main README | **Keep** | Documentation index |
| `docs/SYSTEM_MAP.md` | System architecture | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/EXECUTION_PATHS.md` | Execution flows | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/WORKFLOWS.md` | Operator cookbook | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/CONFIG_MATRIX.md` | Config reference | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/FAILURE_MODES.md` | Failure documentation | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/OBSERVABILITY.md` | Logging reference | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/TODO_TRIAGE.md` | Code smells | 2024-01-13 | docs/README.md | **Keep** | Protected, core doc |
| `docs/CLEANUP_PLAN.md` | This file | 2024-01-14 | clean_repo.sh | **Keep** | Cleanup reference |
| `docs/KNOWLEDGE_INDEX.md` | Single entry point | 2024-01-14 | README.md | **Keep** | New unified index |
| `docs/ARCHITECTURE.md` | Frontend architecture | Unknown | README.md:169, docs/README.md | **Keep** | Detailed frontend docs |
| `docs/IMPLEMENTATION_STATUS.md` | Feature matrix | Unknown | README.md:170, docs/README.md | **Keep** | Useful status tracking |
| `docs/ACCURACY_FALLBACKS.md` | Provider fallbacks | Unknown | README.md:171, docs/README.md | **Keep** | Provider mapping still relevant |
| `docs/FILE_REFERENCE.md` | File-by-file reference | Unknown | README.md:174, docs/README.md | **Keep** | Useful reference |
| `docs/DEV_ERGONOMICS.md` | Dev setup | Unknown | README.md:173, docs/README.md | **Archive** | Overlaps with WORKFLOWS.md |
| `docs/CONTINUATION_PLAN.md` | PR plan | Unknown | README.md:172, docs/README.md | **Archive** | Historical; see TODO_TRIAGE.md |
| `docs/uniprot-flow.md` | UniProt flow | Unknown | docs/README.md | **Archive** | Overlaps with EXECUTION_PATHS.md |
| `docs/providers.md` | Provider status | Unknown | docs/README.md | **Archive** | Overlaps with CONFIG_MATRIX.md |
| `docs/provider-fixes-summary.md` | Provider fixes | Unknown | docs/README.md | **Archive** | Historical; see FAILURE_MODES.md |

## Cache/Temp Inventory

| Path | Purpose | Runtime Only? | Referenced By | Action | Rationale |
|------|---------|---------------|---------------|--------|-----------|
| `backend/.run_cache/` | TANGO/PSIPRED runtime outputs | ✅ Yes | `tango.py:33`, `psipred.py:13` | **Ignore** | Runtime cache, created at runtime |
| `backend/Tango/out/` | Legacy TANGO outputs | ⚠️ Mixed | Legacy code | **Ignore** | Legacy outputs, swept into .run_cache |
| `backend/Tango/work/` | Legacy TANGO inputs | ⚠️ Mixed | Legacy code | **Ignore** | Legacy inputs, moved to .run_cache |
| `backend/Psipred/out/` | Legacy PSIPRED outputs | ⚠️ Mixed | Legacy code | **Ignore** | Legacy outputs, moved to .run_cache |
| `backend/Psipred/work/` | Legacy PSIPRED inputs | ⚠️ Mixed | Legacy code | **Ignore** | Legacy inputs, moved to .run_cache |
| `ui/dist/` | Frontend build output | ✅ Yes | Vite build | **Ignore** | Build artifact |
| `ui/node_modules/` | Node dependencies | ✅ Yes | npm install | **Ignore** | Dependencies (already ignored) |
| `backend/__pycache__/` | Python bytecode | ✅ Yes | Python runtime | **Ignore** | Already in .gitignore |
| `backend/**/__pycache__/` | Python bytecode | ✅ Yes | Python runtime | **Ignore** | Already in .gitignore |
| `backend/.venv/` | Python virtualenv | ✅ Yes | Python setup | **Ignore** | Already in .gitignore |

## .gitignore Updates Needed

**Add to .gitignore:**
```
# Runtime caches (already present but verify)
backend/.run_cache/

# Legacy runtime directories (should be ignored)
backend/Tango/out/
backend/Tango/work/
backend/Psipred/out/
backend/Psipred/work/

# Build outputs
ui/dist/
ui/.next/

# Coverage and test artifacts
.coverage
htmlcov/
.pytest_cache/
*.cover
.hypothesis/
```

**Already in .gitignore (verify):**
- `backend/.run_cache/` ✅
- `ui/node_modules/` ✅
- `__pycache__/` ✅
- `backend/.venv/` ✅

## Archive Strategy

**Move to `docs/legacy/`:**
- Historical change logs (CHANGES_*.md)
- Historical analysis (CODEBASE_ANALYSIS.md, SEMANTIC_CORRECTNESS_ISSUES.md)
- Superseded docs (FILE_INVENTORY.md, PRINCIPLES_*.md)
- Overlapping docs (DEV_ERGONOMICS.md, CONTINUATION_PLAN.md, uniprot-flow.md, providers.md, provider-fixes-summary.md)

**Delete:**
- `REPO_TREE.txt` (auto-generated, not useful)

## Implementation Notes

1. **Archive preserves links**: 
   - Files moved to `docs/legacy/` maintain their content
   - Links in `docs/README.md` and `README.md` should be updated to point to `docs/legacy/` or removed if superseded
   - `KNOWLEDGE_INDEX.md` serves as the new single entry point
2. **Cache cleanup**: 
   - Runtime caches are in `.gitignore` (created at runtime)
   - Use `scripts/clean_repo.sh --only-cache --apply` to clean existing cache files
3. **Test fixtures**: 
   - If any test relies on committed cache files, move minimal fixtures to `tests/fixtures/`
   - Current tests use `tests/golden_inputs/` for test data (not cache)

## Verification

After cleanup:
- ✅ `docs/KNOWLEDGE_INDEX.md` is the single entry point
- ✅ All protected docs remain in `docs/`
- ✅ Archived docs in `docs/legacy/` with updated links
- ✅ `.gitignore` includes all runtime caches
- ✅ App builds and passes smoke tests

