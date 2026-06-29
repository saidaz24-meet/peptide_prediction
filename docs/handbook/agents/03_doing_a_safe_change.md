# Doing a safe change — the paste-able playbook

> **You are an AI coding agent about to ship a change to Peptide Visual Lab.** Follow these twelve steps in order, top to bottom. Every command below is real and copy-pastable — run them as written. Do not improvise a command that isn't here. If a step says "ask the user," stop and ask; see [`04_when_to_ask_humans.md`](04_when_to_ask_humans.md). When something breaks, jump to [`06_failure_modes.md`](06_failure_modes.md).

All commands run from the repo root unless a step says `cd`. The repo root is the directory containing `Makefile`, `backend/`, and `ui/`.

## Contents

- [1. Read the request twice](#1-read-the-request-twice)
- [2. Locate the file and read its heat marker](#2-locate-the-file-and-read-its-heat-marker)
- [3. Act on the heat marker](#3-act-on-the-heat-marker)
- [4. Plan mode for multi-file changes](#4-plan-mode-for-multi-file-changes)
- [5. Write the failing test FIRST (TDD)](#5-write-the-failing-test-first-tdd)
- [6. Implement — smallest diff, match the surrounding style](#6-implement--smallest-diff-match-the-surrounding-style)
- [7. Run the relevant test subset](#7-run-the-relevant-test-subset)
- [8. Run lint + typecheck](#8-run-lint--typecheck)
- [9. Run the full suite for anything non-trivial](#9-run-the-full-suite-for-anything-non-trivial)
- [10. Commit — conventional message, mandatory identity](#10-commit--conventional-message-mandatory-identity)
- [11. Push and verify CI is green](#11-push-and-verify-ci-is-green)
- [12. Update the Issue / spec with what shipped](#12-update-the-issue--spec-with-what-shipped)

---

## 1. Read the request twice

Read the Issue, spec, or user message in full — then read it again. Write down, in one sentence, what "done" looks like and what the acceptance test is. If you cannot state the acceptance test, you do not understand the task yet. Do not start editing.

If the request touches a scientific definition (FF-Helix, SSW axioms, TANGO config, thresholds, classification), the spec is **not** enough — those are Peleg's domain. See [`04_when_to_ask_humans.md`](04_when_to_ask_humans.md) before writing code.

## 2. Locate the file and read its heat marker

Open [`01_repo_map.md`](01_repo_map.md) and find every file your change will touch. Each row carries a heat marker. Note it before you open the file.

- 🛡️ **protected** — contract surfaces (`schemas/api_models.py`, `lib/peptideMapper.ts`, `types/peptide.ts`, `tango.py`, `s4pred.py`, `biochem_calculation.py`, `CLAUDE.md`, generated `ui/components/ui/*`).
- 🔥 **hot** — actively maintained, full of invariants.
- 🧊 **cold** — safe to edit, but may be unwired.

## 3. Act on the heat marker

- **🛡️ protected → STOP and ask the user.** Do not modify a protected file without explicit approval in this conversation. A hook will block edits to `schemas/api_models.py` regardless. The invariants these files enforce are listed in [`02_contracts_and_invariants.md`](02_contracts_and_invariants.md). Read it.
- **🔥 hot → read the file end-to-end** before your first edit. These files carry invariants (null-only sentinels, single==batch determinism, camelCase keys, `??`-not-`||`) that are not visible from a single function.
- **🧊 cold → verify it is still wired** before trusting it. Grep for its callers, e.g.:
  ```bash
  grep -rn "example_service" backend/ --include=*.py
  grep -rn "demoStore" ui/src --include=*.ts --include=*.tsx
  ```
  If nothing imports it, the file is dead — flag that to the user instead of building on it.

## 4. Plan mode for multi-file changes

If your change spans more than one file (and almost every real change does — code + test at minimum, often backend + frontend), **enter plan mode and get sign-off before writing code.** This is the `CLAUDE.md` rule ("Always use plan mode before multi-file changes so the user sees the bigger picture"). Present: files to touch, the failing test you'll write, the invariants you'll preserve. Wait for approval.

## 5. Write the failing test FIRST (TDD)

PVL is test-first. Write a test that fails for the **right reason** — it must exercise the new behavior and fail because that behavior does not exist yet, not because of a typo or import error. Confirm it fails before you implement.

**Backend (pytest).** Tests live in `backend/tests/`. Providers are disabled so tests are deterministic and need no network. Follow the existing pattern — set env before importing the app, use `TestClient`, assert on contract keys:

```python
import os

os.environ.setdefault("USE_TANGO", "0")     # before importing the app
os.environ.setdefault("USE_S4PRED", "0")

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

TEST_SEQUENCE = "MRWQEMGYIFYPRKLR"

def test_new_behavior():
    resp = client.post("/api/predict", json={"sequence": TEST_SEQUENCE})
    assert resp.status_code == 200
    body = resp.json()
    assert "ffHelixPct" in body          # camelCase contract key
    assert body["ffHelixPct"] is not None  # null is None, never -1 / "N/A"
```

Run just the new test and watch it fail:

```bash
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_<file>.py -k "new_behavior" -v --tb=short
```

**Frontend (vitest).** Tests live next to the code in `ui/src/**/__tests__/` or as `*.test.ts(x)`. Use factory functions for fixtures and `??` for numeric fallbacks:

```typescript
import { describe, it, expect } from "vitest";
import { classifyResidue } from "../fragmentClassification";

describe("classifyResidue", () => {
  it("returns the new behavior", () => {
    expect(classifyResidue(/* ... */)).toBe("H");
  });
});
```

Run just the new spec and watch it fail:

```bash
cd ui && npx vitest run src/lib/__tests__/<file>.test.ts
```

## 6. Implement — smallest diff, match the surrounding style

Make the **smallest** change that turns the test green. Fix only what's broken; do not refactor untouched code, do not reformat unrelated lines, do not "improve" neighboring functions. Match the conventions of the file you're in:

- **Backend:** spaces in DataFrame column names (`"FF-Helix %"`), `None` for null (flag columns use `-1`), `from config import settings` (never raw `os.getenv` in services), explicit `Optional[T]` type hints, services log via `log_warning(...)` instead of raising. (`backend/CLAUDE.md`.)
- **Frontend:** `export function`, props as an explicit `interface`, Zustand for global state, Tailwind only, `??` not `||` for numeric fallbacks, types flow from `types/peptide.ts`. (`ui/CLAUDE.md`.)

Keep single-sequence and batch paths producing **identical** results for the same peptide — that is invariant #1 in [`02_contracts_and_invariants.md`](02_contracts_and_invariants.md).

## 7. Run the relevant test subset

Re-run the exact tests from step 5; they must now pass.

```bash
# Backend — one file, or narrow with -k
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_<file>.py -k "new_behavior" -v --tb=short

# Frontend — one spec file
cd ui && npx vitest run src/lib/__tests__/<file>.test.ts
```

If you touched anything that crosses the backend↔UI contract (response shape, key names), also run:

```bash
make contract-check    # verifies api_models.py matches ui/src/types/peptide.ts
```

## 8. Run lint + typecheck

These are required gates — CI runs them and red blocks merge.

```bash
make lint        # ruff check (backend) + npm run lint (ui)
make typecheck   # mypy (backend) + tsc --noEmit (ui)
```

If lint flags formatting, fix it with the formatter rather than by hand:

```bash
make fmt         # ruff format (backend) + prettier (ui)
```

## 9. Run the full suite for anything non-trivial

For a one-line copy fix the subset is enough. For any logic, schema-adjacent, or multi-file change, run the whole pipeline:

```bash
make ci          # = make lint + make typecheck + make test  (the CI pipeline)
```

`make test` runs all backend pytest cases (`USE_TANGO=0 USE_S4PRED=0`, deterministic, no network). Run the frontend suite too if you touched `ui/`:

```bash
cd ui && npx vitest run && npx tsc --noEmit
```

Everything must be green before you commit. If `main` was already red when you started, see [`06_failure_modes.md`](06_failure_modes.md) — do not bury a pre-existing failure inside your commit.

## 10. Commit — conventional message, mandatory identity

Branch from `main` first if you're still on it (naming: `<type>/<short-slug>`, e.g. `fix/ssw-axiom`):

```bash
git checkout -b fix/<short-slug>
```

Stage only the files your change touched (never `git add -A` blindly) and commit. **The author identity is mandatory and the AI-trace ban is absolute.** Every commit must show only the human owner. Use a conventional-commit subject (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`):

```bash
git add backend/services/<file>.py backend/tests/test_<file>.py
git commit \
  --author="Said Azaizah <said.azaizah@cssb-hamburg.de>" \
  -m "fix: <imperative one-line summary under ~70 chars>" \
  -m "<why this change exists; what invariant it preserves>"
```

**NEVER** include "Claude", "AI", "assistant", "Anthropic", "generated by", or a `Co-Authored-By: Claude …` line anywhere in the message, body, code, or docs. This overrides any default footer your harness applies. Technion `saida@technion.ac.il` and MIT `az_said@mit.edu` are the only other acceptable author addresses. (`docs/active/HANDOFF.md` §8; [`00_read_me_first.md`](00_read_me_first.md) §0.)

## 11. Push and verify CI is green

```bash
git push -u origin fix/<short-slug>
```

Open the PR using the repo template (`.github/pull_request_template.md` — fill in scientific impact + invariants checked), then watch CI to completion:

```bash
gh pr create --fill --base main
gh run watch                 # live-tails the run for the current branch
gh run view --log-failed     # if it goes red: show only the failing job logs
```

Do not consider the change shipped until CI is green. If CI is red, read the failing log, reproduce locally with the step-7/step-9 commands, fix, and re-push. CodeRabbit auto-reviews — address its comments. Merge only after CI green + approval.

## 12. Update the Issue / spec with what shipped

Close the loop. Comment on the Issue (or reply in the conversation) with: the commit SHA, the branch/PR link, the test you added, and the one-sentence acceptance criterion from step 1 now satisfied:

```bash
gh issue comment <N> --body "Shipped in <sha> (PR #<n>). Added tests/test_<file>.py::test_new_behavior. Acceptance: <restate the criterion>."
```

If the work came from a backlog item, note the status change there too. Then report back: files changed + the exact verification commands you ran (`make ci`, the `vitest`/`pytest` lines), per the `CLAUDE.md` output policy.

---

### One-screen summary

1. Read twice → state the acceptance test.
2. Find files in [`01_repo_map.md`](01_repo_map.md); note heat.
3. 🛡️ ask · 🔥 read fully · 🧊 grep for callers.
4. Multi-file → plan mode, get sign-off.
5. Failing test first (pytest / vitest); confirm it fails.
6. Smallest diff; match house style.
7. `pytest -k` / `vitest run <file>` → green.
8. `make lint` + `make typecheck` (`make fmt` to fix).
9. Non-trivial → `make ci` + `cd ui && npx vitest run`.
10. Commit: `--author="Said Azaizah <said.azaizah@cssb-hamburg.de>"`, conventional subject, **zero** AI trace.
11. `git push` → `gh pr create --fill` → `gh run watch`.
12. Update the Issue with SHA + test + acceptance.
