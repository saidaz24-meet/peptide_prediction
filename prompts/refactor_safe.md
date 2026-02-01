# Safe Refactor Template

## Goal
Refactor: [DESCRIBE SCOPE - what code, why (readability/performance/maintainability)]

## Constraints
- Do not read `docs/` except `docs/DEV_CONTEXT.md`
- **No behavior changes**: Same inputs → same outputs
- **No public API changes**: Schemas, endpoints unchanged
- **Preserve invariants**: Entry alignment, camelCase keys, FF-Helix computation

## File-Gating Rule
Read only:
- `docs/DEV_CONTEXT.md` (invariants)
- Files being refactored
- All tests that cover refactored code
- Dependencies of refactored code

## TDD Loop
1. **Tests first**: Ensure all existing tests pass (`make test`)
2. **Refactor**: Change structure, not behavior
3. **Verify**: Tests still pass (no regressions)
4. **Lint/Typecheck**: `make lint` and `make typecheck` must pass

## Required Verification
```bash
make test        # All tests must pass (no regressions)
make lint        # Code quality check
make typecheck   # Type safety verification
```

## Output Format
```
Files changed: [list files]
Refactoring scope: [what changed, why]
Verify: make test && make lint && make typecheck
```

