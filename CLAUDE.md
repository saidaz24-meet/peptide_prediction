# Claude Agent Instructions

## Documentation Access Rule

**STRICT**: Default read only `CLAUDE.md` + `docs/active/*`. These are the ONLY authoritative documentation files.

**Active Context Pack** (docs/active/):
- **ACTIVE_CONTEXT.md** — Architecture overview, entrypoints, data flow, key modules
- **TESTING_GUIDE.md** — Test commands, local setup, known failures
- **CONTRACTS.md** — API endpoints, request/response shapes, UI requirements
- **KNOWN_ISSUES.md** — Known bugs, limitations, workarounds
- **FILES_TO_TOUCH.md** — Hot files most likely to be edited

**DO NOT READ**:
- `docs/_archive/**` — Historical/archived docs (ignored)
- `docs/legacy/**` — Legacy docs (ignored)
- `docs/reference/**` — Reference docs (use active context instead)
- `docs/user/**` — User-specific docs (ignored)
- Any markdown files outside `docs/active/` (unless explicitly requested)

**Before opening new files outside docs/active/**:
1. Propose top 3 files you want to read
2. Explain why each is needed for the task
3. Wait for user approval before reading

## TDD Workflow

1. **Write failing test first** — Test must fail for the right reason
2. **Minimal implementation** — Smallest change to make test pass
3. **Refactor** — Clean up while keeping tests green
4. **Edge tests** — Add boundary cases and error paths

**Test commands:**
- `make test` — All tests (deterministic, no network)
- `make test-unit` — Fast unit tests only
- `make ci` — Full pipeline (lint + typecheck + test)

## Output Policy

After every change, provide:

1. **Files changed** — List all modified/created files
2. **Verification commands** — Exact commands to verify:
   ```bash
   make test        # If tests changed
   make lint        # If code changed
   make typecheck   # If types changed
   make ci          # For significant changes
   ```

**Example:**
```
Files changed:
- backend/services/normalize.py
- backend/tests/test_normalize.py

Verify:
make test
```

## Context Management

- **Short file lists** — Read only necessary files, not entire directories
- **Summarize after milestones** — After completing a logical unit, summarize what was done
- **Recommend `/compact`** — Suggest using compact mode for large codebases when appropriate

## Safety Rules

1. **Public APIs are protected** — Do not change:
   - `backend/schemas/api_models.py` (response schemas)
   - API endpoint signatures in `backend/api/routes/`
   - Response formats (camelCase keys, Entry alignment)

2. **Smallest diffs** — Prefer minimal changes:
   - Fix only what's broken
   - Add features incrementally
   - Avoid refactoring unless requested

3. **Invariants** (from DEV_CONTEXT.md):
   - Entry IDs must align between input and output
   - Response keys must be camelCase
   - FF-Helix% always computed (no external dependency)

## Code Quality

- **Linting**: `make lint` must pass
- **Type checking**: `make typecheck` should pass (warnings acceptable for existing code)
- **Tests**: `make test` must pass before considering work complete

## File Organization

- Backend: `backend/` (FastAPI, services, calculations, tests)
- Frontend: `ui/` (React, TypeScript, pages, components)
- Tests: `backend/tests/test_*.py`
- Schemas: `backend/schemas/api_models.py`

## Quick Reference

```bash
# Setup
cd backend && pip install -r requirements.txt
cd ../ui && npm install

# Development
make test       # Run tests
make lint       # Check code quality
make fmt        # Format code
make ci         # Full CI pipeline

# Context
docs/active/ACTIVE_CONTEXT.md  # Architecture overview
docs/active/CONTRACTS.md       # API contracts
docs/active/TESTING_GUIDE.md  # Testing commands
docs/active/FILES_TO_TOUCH.md # Hot files reference
docs/active/KNOWN_ISSUES.md    # Known issues
```

