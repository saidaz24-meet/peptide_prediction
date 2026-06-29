# 06 — Failure Modes: What an Agent Does When the Lights Go Red

This is the runbook for when an automated gate fails: GitHub Actions CI, the
local pre-push ruff hook, CodeRabbit, CodeQL, the Stop test-gate, or the
Pydantic contract guard. The rule for all of them: **diagnose the root cause,
fix it, never silence the gate to make it green.** Commits stay authored by
**Said Azaizah** with no AI traces in messages, code, or docs.

Related: [contracts & invariants](../agents/02_contracts_and_invariants.md) ·
[doing a safe change](../agents/03_doing_a_safe_change.md).

## Contents

- [1. CI gate failed (GitHub Actions)](#1-ci-gate-failed-github-actions)
- [2. Pre-push hook failed (ruff)](#2-pre-push-hook-failed-ruff)
- [3. CodeRabbit posted Major findings](#3-coderabbit-posted-major-findings)
- [4. CodeQL flagged a security issue](#4-codeql-flagged-a-security-issue)
- [5. A test that "shouldn't be related" fails](#5-a-test-that-shouldnt-be-related-fails)
- [6. The Pydantic contract guard fired](#6-the-pydantic-contract-guard-fired)
- [Also worth knowing — the Stop test-gate](#also-worth-knowing--the-stop-test-gate)

---

## 1. CI gate failed (GitHub Actions)

CI is `.github/workflows/ci.yml`. Jobs: **Detect Changes** → **Backend Tests**,
**Frontend Build**, **Docker Build**. On a PR all of them run regardless of
paths.

Read the log:

```bash
gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --limit 5
gh run view <run-id>                 # job summary, see which job is red
gh run view <run-id> --log-failed    # only the failing step's output
gh run view <run-id> --job <job-id> --log   # full log for one job
```

The **five most common causes**:

1. **Test failure (Backend Tests).** CI runs `pytest tests/ -v --tb=short` with
   `USE_TANGO=0 USE_S4PRED=0`. Reproduce locally with the same env:
   ```bash
   make test
   ```
2. **Lint (ruff).** CI step `ruff check .` in `backend/`. Fix:
   ```bash
   cd backend && .venv/bin/python -m ruff check --fix .
   ```
3. **Type check (tsc).** Frontend `npm run build` fails on TS errors, or
   `make typecheck` (`npx tsc --noEmit`). Note backend mypy is
   `continue-on-error: true` in CI — it won't fail the gate, but `make
   typecheck` still surfaces it locally.
4. **Contract-check drift.** Backend `api_models.py` and
   `ui/src/types/peptide.ts` fell out of sync. Run:
   ```bash
   make contract-check
   ```
   See [contracts & invariants](../agents/02_contracts_and_invariants.md) — the
   fix is to re-align the two, not to delete the check.
5. **Flaky network test.** A test that hit the network slipped in (CI is meant
   to be deterministic, no network). Confirm by re-running locally with
   `USE_TANGO=0 USE_S4PRED=0`; if it only fails in CI, the test is reaching out
   and must be mocked or marked, not retried until green.

Reproduce the whole pipeline before pushing again:

```bash
make ci    # = lint typecheck test
```

---

## 2. Pre-push hook failed (ruff)

`.git/hooks/pre-push` mirrors CI's ruff invocation. It only runs when
`backend/` changed in the push range and prints exactly what to do. The fix:

```bash
cd backend && .venv/bin/python -m ruff check --fix .
```

For formatting (separate from lint), the Makefile `fmt` target is:

```bash
make fmt    # cd backend && ruff format .   +   prettier on ui/src
```

Note the PostToolUse hook `.claude/hooks/format-python.sh` already runs
`ruff format` on every backend `.py` you Edit/Write, so format drift is rare —
lint *rules* (unused imports, etc.) are what `--fix` resolves.

The hook is bypassable with `git push --no-verify`, but **don't** — CI runs the
identical `ruff check` and will reject it anyway. Bypass only loses you the
fast local signal.

---

## 3. CodeRabbit posted Major findings

[CodeRabbit](../humans/09_glossary.md#c) (`.coderabbit.yaml`, `chill` profile, `request_changes_workflow:
false`) is an AI pair-reviewer. It does **not** block merge — it advises. Triage
each finding:

```
Finding
  ├─ Correctness bug / contract risk?  ──► ADDRESS now, then reply on the thread.
  │     (e.g. "api_models.py modified" → major flag by config; treat as real)
  ├─ Style / nit / subjective?          ──► DROP if it fights house style;
  │     leave a one-line reason so the thread resolves.
  └─ Ambiguous / scope-expanding?       ──► DISCUSS WITH USER before acting.
        Don't silently refactor beyond the PR's intent.
```

CodeRabbit is configured to flag specific PVL hazards: backend `||` numeric
fallbacks (must be `??`), `any` casts, hardcoded colors, and **any edit to
`api_models.py`**. Those are real — address them. The agent never resolves a
Major thread by deleting the offending test or weakening the type; it fixes the
code or escalates.

---

## 4. CodeQL flagged a security issue

[CodeQL](../humans/09_glossary.md#c) (`.github/workflows/codeql.yml`, `security-extended` queries, Python +
TS) is the security gate. Findings land in the repo **Security** tab.

**Escalation path — NEVER silently suppress:**

1. Read the alert. Common PVL hits: command injection in `subprocess.run`
   (TANGO/S4PRED runners), path traversal on uploaded files, SSRF in the
   UniProt fetch path.
2. If it's a **true positive**, fix the root cause (sanitize input, pin the
   subprocess args list, validate paths). Reproduce the reasoning in the PR.
3. If you believe it's a **false positive**, do **not** add a `// codeql` /
   `# nosec` suppression on your own judgment. Surface it to the user with the
   alert link and your reasoning, and wait for explicit approval before
   dismissing or suppressing.
4. Never dismiss an alert in the GitHub UI as an agent. Dismissal is a human
   decision.

Suppressing a security finding to make a check green is the single worst thing
an agent can do here. When in doubt, stop and ask.

---

## 5. A test that "shouldn't be related" fails

When an unrelated test goes red after your change, walk it down instead of
retrying:

1. **Confirm it's your change.** Stash and re-run:
   ```bash
   git stash && make test ; git stash pop
   ```
   Green on stash = your diff caused it. Red on stash = pre-existing, flag it.
2. **Run just that test for a real traceback:**
   ```bash
   cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_<file>.py::<name> -vv --tb=long
   ```
3. **Suspect shared state.** Most "unrelated" failures in PVL trace to a shared
   contract: `api_models.py` field change, a normalization default in
   `services/normalize.py`, or a fixture both tests import. The single/batch
   identity invariant means one pipeline change ripples into many tests — that
   is the gate working, not a flake.
4. **Suspect env.** Forgot `USE_TANGO=0 USE_S4PRED=0`? The test may be trying to
   spawn a binary. The Makefile targets set these for you — prefer `make test`.
5. **Fix the cause, not the test.** Only edit the test if the *contract*
   legitimately changed and the user approved it — see
   [doing a safe change](../agents/03_doing_a_safe_change.md).

---

## 6. The Pydantic contract guard fired

Two guards protect the API contract; know which one fired.

**The PreToolUse hook `.claude/hooks/protect-api-contract.sh`** blocks any
Edit/Write whose path contains `schemas/api_models.py` (exit 2):

```
BLOCKED: schemas/api_models.py is the protected API contract.
Changes to response schemas require explicit user approval.
```

**The runtime/test contract** is ADR-002: every request schema sets
`model_config = ConfigDict(extra="forbid")`, so an unknown field raises a loud
**422** instead of silently defaulting (the `max_results→size=500` incident).
`test_api_contract_strictness.py` enforces it.

**When override is allowed:** only with an **explicit, specific user OK** to
change the response schema. Until then:

- Do not work around the hook by writing to a temp path and `mv`-ing over it.
- Do not relax `extra="forbid"` to `extra="ignore"` to make a request pass.
- Propose the schema change, get the user's confirmation, then make it — and
  keep `backend` ↔ `ui/src/types/peptide.ts` in sync (`make contract-check`).

The guard existing means the contract is load-bearing. Treat a fired guard as a
prompt to confirm intent, never as an obstacle to route around.

---

## Also worth knowing — the Stop test-gate

`.claude/hooks/stop-test-gate.sh` (ADR-019) runs fast unit tests when the
session touched `backend/**/*.py` or `ui/**/*.{ts,tsx}` and **blocks the session
from closing** (exit 2) if they fail. You can't end on red. Either fix the
tests, or state explicitly why the session intentionally leaves them red. It
skips cleanly on docs-only sessions and fresh clones (no `.venv` /
`node_modules`).

**Verify before you hand back:**

```bash
make ci              # lint + typecheck + test
make contract-check  # backend ↔ UI type sync
```
