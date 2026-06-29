# Existing Tooling — Don't Reinvent It

> Audience: an AI agent (Claude / Cowork / Opus) about to "just write a quick script."
> PVL is solo-maintained. AI tooling is the maintenance hedge (ADR-012): the more
> work that flows through skills, hooks, and the MCP surface, the less Said has to
> hand-hold. Before you build anything, check whether it already exists here.

This is a reference page. Skim the tables, then read the decision tree at the
bottom before adding a new script. Everything below was verified to exist on
`wave-2.8/peleg-pdf-followups`.

---

## 1. Skills (`.claude/skills/`) — 10 project skills

These auto-trigger or run via the Skill tool. Domain knowledge lives here so you
don't have to re-derive PVL conventions.

| Skill | Purpose |
|---|---|
| `auto-detect` | Proactively flags quality gaps, missing tools, stale docs. |
| `evolve` | Detects repeated workflow patterns and proposes new skills/hooks/commands. |
| `frontend-design` | Production-grade scientific-visualization UI direction. |
| `pvl-backend-patterns` | FastAPI / DataFrame / service-layer / error-handling conventions. |
| `pvl-data-pipeline` | TANGO → S4PRED → FF-Helix → normalize flow; single-vs-batch debugging. |
| `pvl-frontend-patterns` | Zustand, shadcn/ui, Recharts, type-safety rules. |
| `pvl-peleg-review` | Manages Peleg review tasks / chunks / FF data. |
| `pvl-testing` | pytest + vitest TDD patterns. |
| `terminal-orchestration` | Multi-terminal CEO/sub-terminal + Cowork coordination. |
| `ui-design-research` | Research-first methodology for new UI components. |

**Slash commands (`.claude/commands/`) — 11 ready workflows.** Prefer these over
ad-hoc steps: `audit-ff`, `catch-up`, `checkpoint`, `cleanup`, `deploy`,
`design-audit`, `fix-issue`, `plan-chunk`, `review-pr`, `terminology-scan`,
`test-peptide`. (e.g. `test-peptide` traces one sequence through the whole
pipeline — don't write a throwaway tracer.)

**Subagents (`.claude/agents/`) — 3.** `code-reviewer`, `research-agent`,
`test-writer`. Use these instead of doing review/research/test-authoring inline.

---

## 2. Hooks (`.claude/hooks/`) — 6, wired in `settings.json`

Hooks are enforced by the harness, not by you. They are the safety net that lets
a solo maintainer trust AI edits (ADR-019).

| Hook | Event | What it does |
|---|---|---|
| `protect-api-contract.sh` | PreToolUse (Edit/Write) | **Blocks** any edit to `schemas/api_models.py` (exit 2). The contract guard. |
| `warn-git-push.sh` | PreToolUse (Bash) | Injects a "you're pushing branch X" reminder — non-blocking. |
| `format-python.sh` | PostToolUse (Edit/Write) | Runs `ruff` on edited `backend/**.py`. Silent no-op if ruff absent. |
| `format-frontend.sh` | PostToolUse (Edit/Write) | Runs `prettier` on edited `ui/**.ts(x)`. Silent no-op if prettier absent. |
| `stop-test-gate.sh` | Stop | Runs fast unit tests before a session can close; **exit 2 keeps Claude working** if they fail. Skipped on docs-only sessions. |
| `session-log.sh` | Stop | Regenerates `docs/active/SESSION_LOG.md` (last 7 days of commits + "For your taste" blocks). Non-blocking. |

Implication for you: you do **not** need to manually run prettier/ruff after an
edit, and you do **not** need to remember to run unit tests before stopping — the
Stop gate does it. You **cannot** edit `api_models.py` without explicit approval;
the hook will block you.

---

## 3. MCP server (`mcp_server/`, package `pvl-mcp`)

A stateless wrapper that exposes the PVL REST API as MCP tools for any MCP-aware
client (Claude Desktop, Cursor, Continue, Cline, Windsurf). **Zero analysis
logic** — it forwards to the FastAPI backend, which stays the single source of
truth. Peleg's category definitions ship baked into the system prompt.

Status: `v0.0.1`, Development Status 3 - Alpha. **The surface is fixed at 7 tools**
so client configs don't drift. 4 are live; 3 wrap backend routes that don't exist
yet and return a clean backend error when called.

| Tool | Backend route | Status |
|---|---|---|
| `search_uniprot` | `POST /api/uniprot/execute` | LIVE |
| `analyze_sequences` | `POST /api/predict` + `/api/upload-csv` | LIVE |
| `find_similar_peptides` | `POST /api/peptides/similar` | LIVE |
| `get_pvl_version` | `GET /api/version` | LIVE |
| `get_peptide_detail` | `GET /api/peptide/{accession}` | ⚠️ route ships in §I |
| `rank_candidates` | `POST /api/rank` | ⚠️ route ships in §I |
| `compare_cohorts` | `POST /api/compare` | ⚠️ route ships in §I |

Reference docs: `docs/active/MCP_RUNBOOK.md` (operator guide, architecture,
troubleshooting) and `docs/active/MCP_CLIENT_GUIDES.md` (per-client install:
Claude Desktop, Cursor, Continue, etc.). Tool source: `mcp_server/pvl_mcp/tools.py`.

**Stale flag:** the 3 ⚠️ tools have been "ships in §I" since Wave 2; if you need
that capability, check whether the backend route landed before assuming the tool
works.

---

## 4. CLI (`pvl-cli/`, package `pvl-cli`)

**Status: scaffold/stub** (`v0.0.1`, last real change to `cli.py` on May 7). Only
the `analyze` subcommand is wired end-to-end (POSTs to `/api/upload-csv`,
pretty-prints with `rich`, `--json` for piping). Threshold presets, progress bars,
output formats, and auth are planned for "Wave H" and do not exist. Don't assume
any flag beyond `--sequence/--entry/--base-url/--json` works — read
`pvl-cli/pvl/cli.py` first.

---

## 5. Scripts (`scripts/` = 14, `backend/scripts/` = 6)

**`scripts/` (ops / deploy / smoke):**

| Script | Purpose | Note |
|---|---|---|
| `ci_status.sh` | One-line CI status of every open PR. | current |
| `prod_redeploy.sh` | Redeploy prod (Hetzner VPS). | current |
| `desy_perf_redeploy.sh` | Redeploy + perf check on the DESY VM. | current |
| `desy_vm_bootstrap.sh` | Bootstrap a fresh DESY Ubuntu VM. | current |
| `install_pre_push_hook.sh` | Install the git pre-push hook locally. | current |
| `perf_trace.sh` | Per-stage perf trace for one peptide (needs `PVL_PERF_LOGS=1`). | current |
| `open_peleg_issues.sh` | Turn open Peleg notes into GitHub Issues (M9). | dated one-shot |
| `publish_v0_3_0.sh` | Release helper for v0.3.0. | ⚠️ version-pinned one-shot |
| `clean_repo.sh` | Repo hygiene sweep. | ⚠️ last touched Jan |
| `smoke_logging.sh` | Smoke-test structured logging. | ⚠️ Jan |
| `smoke_phase1.sh` | Smoke-test Phase-1 predictors. | ⚠️ Jan |
| `smoke_provider_status.sh` | Smoke-test provider-status endpoint. | ⚠️ Jan |
| `smoke_uniprot_pipeline.sh` | Smoke-test UniProt pipeline. | ⚠️ Jan |
| `smoke_test_backend.py` | Broad backend smoke test. | ⚠️ Dec — verify before trusting |

**`backend/scripts/`:**

| Script | Purpose | Note |
|---|---|---|
| `check_contract_sync.py` | Verify backend↔UI contract (`make contract-check`). | current, via Make |
| `smoke_tango.py` | Verify the TANGO binary works (`make smoke-tango`). | current, via Make |
| `diagnose_tango.py` | Deeper TANGO diagnostics. | current |
| `precompute_dataset.py` | Pre-run pipeline on a reference dataset → JSON artifact for instant "Try example". | current |
| `reindex_lance.py` | Reindex LanceDB after an embedding-model swap. | occasional |
| `rerun_validation_2026_06_07.py` | One-shot validation rerun. | ⚠️ dated one-shot — historical |

The `⚠️` smoke scripts predate Wave 2 and may reference endpoints that have since
moved; treat them as starting points, not guaranteed-green. Prefer `make` targets
(`make smoke-tango`, `make contract-check`, `make test`) which are kept current.

---

## 6. Cowork dispatch system (`docs/active/cowork-dispatches/`)

Cowork is the parallel agent worker. Dispatches are paste-ready prompts.
Currently one standing template: **`V11_FINAL_POLISH.md`** — the quality-only
sweep run before a branch opens a PR to `main` (tests, lint, no new features). It
carries the mandatory `WORKING DIRECTORY:` header that redirects Cowork into the
real repo (Cowork otherwise writes to a scratch dir — see memory
`project_cowork_workspace.md`). Use it as the template when dispatching Cowork
work; the `terminal-orchestration` skill drives the coordination.

---

## Before you write a new script — decision tree

Run top to bottom. Stop at the first "yes."

1. **Does a slash command or skill already cover this?**
   Pipeline trace → `test-peptide`. Dead-code/stale-doc sweep → `cleanup`.
   Pre-commit review → `review-pr` / `code-reviewer`. FF coverage → `audit-ff`.
   Deploy → `deploy`. → **Use it.**

2. **Is it formatting / testing / contract enforcement?**
   Already automated by hooks + `make` (ruff, prettier, stop-test-gate,
   `make contract-check`). → **Don't script it; let the hook/Make target run.**

3. **Is it "drive the PVL API from an assistant"?**
   That's the MCP server. Add/extend a tool in `mcp_server/pvl_mcp/tools.py`
   (surface stays at 7 — extend an existing tool or wait for the backend route).
   → **Use/extend MCP, don't write a one-off client.**

4. **Is it a multi-file polish/cleanup sweep that can run in parallel?**
   → **Dispatch Cowork** with `V11_FINAL_POLISH.md` as the template.

5. **Is it deploy / smoke / ops?**
   Check `scripts/` and `backend/scripts/` first — a current script probably
   exists (and a stale one may need updating rather than replacing).

6. **Only if all of the above are "no":** write a new script. Put ops scripts in
   `scripts/`, backend-coupled ones in `backend/scripts/`, add a one-line header
   comment stating its purpose, and prefer wiring it behind a `make` target so it
   stays discoverable and current.

Whatever you write, follow the safe-change discipline in
[../agents/03_doing_a_safe_change.md](../agents/03_doing_a_safe_change.md) — small
diffs, contract-safe, tests green before Stop.
