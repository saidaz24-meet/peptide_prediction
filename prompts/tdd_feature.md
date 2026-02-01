# TDD Feature Template

## Goal
Add feature: [DESCRIBE FEATURE - what it does, where it fits]

## Constraints
- Do not read `docs/` except `docs/DEV_CONTEXT.md`
- Do not break existing public APIs
- Follow existing patterns (see `docs/DEV_CONTEXT.md` for folder map)
- Incremental: smallest working implementation first

## File-Gating Rule
Read only:
- `docs/DEV_CONTEXT.md` (context)
- Similar existing features (for pattern matching)
- Test files for the feature area
- Relevant service/route files

## TDD Loop
1. **Test first**: Write failing test for feature behavior
2. **Minimal impl**: Smallest code to pass test
3. **Refactor**: Clean up while tests green
4. **Edge tests**: Boundary cases, error handling

## Required Verification
```bash
make test        # All tests must pass
make lint        # Code quality check
make typecheck   # Type safety (if types added)
```

## Output Format
```
Files changed: [list files]
Verify: make test && make lint && make typecheck
```

