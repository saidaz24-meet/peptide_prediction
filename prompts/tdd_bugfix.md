# TDD Bugfix Template

## Goal
Fix bug: [DESCRIBE BUG - symptoms, expected vs actual behavior]

## Constraints
- Do not read `docs/` except `docs/DEV_CONTEXT.md`
- Do not change public APIs (`backend/schemas/api_models.py`, endpoint signatures)
- Preserve Entry ID alignment and camelCase response keys
- Minimal diff: fix only the bug, no refactoring

## File-Gating Rule
Read only:
- `docs/DEV_CONTEXT.md` (context)
- Files directly related to the bug (use codebase_search first)
- Test files that will verify the fix

## TDD Loop
1. **Reproduce**: Write/update test that fails due to bug
2. **Fix**: Minimal implementation to make test pass
3. **Verify**: Run `make test` - must pass
4. **Edge cases**: Add tests for boundary conditions if applicable

## Required Verification
```bash
make test        # All tests must pass
make lint        # Code quality check
```

## Output Format
```
Files changed:
- [list files]

Verify:
make test
make lint
```

