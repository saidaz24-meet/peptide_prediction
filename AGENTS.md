# PVL — Multi-Terminal Agent Roles

> **For future contributors and for Said after a multi-month MIT absence.** This file is the legible map of how PVL is built using multiple Claude Code terminals + Cursor. Read this BEFORE opening any terminal.

PVL is developed by Said Azaizah using a multi-terminal AI-orchestration pattern. Different terminals have different scopes, hold different context, and produce different artifacts. T1 (the CEO terminal) coordinates. Don't conflate roles — that's where over-complication and duplication start.

---

## T1 — CEO / Orchestration

**Role**: Holds full project context. Dispatches sub-terminals with concrete specs. Reviews their output. Commits accepted work. Updates canonical docs (ROADMAP, MASTER_PUSH_PLAN, DECISIONS, STATUS, MEMORY).

**Scope**:
- Writes `TX-INSTRUCTIONS.md` (gitignored) and `docs/active/RESEARCH_BRIEFS/T5_PROMPTS/*.md` specs
- Commits sub-terminal output after review (atomic logical commits)
- Updates ADRs in `docs/active/DECISIONS.md`
- Updates the dispatch state in `docs/active/STATUS.md` after every cycle
- Saves memory feedback in `~/.claude/projects/.../memory/`
- Proposes workflow upgrades proactively (hooks, slash commands, new memory files) without waiting for permission — opt-out model
- Makes architectural decisions when evidence supports them; surfaces explicitly when human-touch input needed

**Does NOT**: write production code (>~15 minute fixes excepted), commit untested work, refactor outside the current task, change response schemas in `backend/schemas/api_models.py` without explicit Said approval.

**Output**: commits + spec files + memory updates.

---

## T2 — Backend

**Role**: FastAPI + Python work. Owns predictors, services, schemas, MCP tools, tests in `backend/tests/`.

**Scope**:
- `backend/` everything except `backend/schemas/api_models.py` (protected — extend with new nullable fields only via ADR-013 pattern)
- `mcp_server/` — MCP tool definitions and server code
- Backend tests with pytest
- Embedding model, vector store, LanceDB

**Reads**: `T2-INSTRUCTIONS.md` at session start. Latest priority + spec section is at the top.

**Does NOT**: commit, touch frontend, modify `api_models.py`, add dependencies without flagging T1.

**Output**: code diffs that T1 reviews + commits.

---

## T3 — Frontend

**Role**: React + TypeScript + Vite + Tailwind + shadcn. Owns `ui/src/` everything.

**Scope**:
- React components, pages, stores (Zustand), routes
- Vitest tests in `ui/src/**/__tests__/`
- API client in `ui/src/lib/api.ts`
- Type definitions in `ui/src/types/`

**Reads**: `T3-INSTRUCTIONS.md` at session start.

**Does NOT**: commit, touch backend, add npm dependencies without flagging T1, use `any` types, hardcode colors (use theme tokens).

**Output**: code diffs that T1 reviews + commits.

---

## T5 — T-RES (Research / Strategy)

**Role**: Deep web research for strategic decisions. Tier 2 manual terminal — Said opens it, pastes a prompt file, lets it work 1-3 hours.

**Scope**:
- Reads canonical docs + briefs in `docs/active/RESEARCH_BRIEFS/`
- Performs 50-200 web queries, primary-source verification
- Writes briefs to `docs/active/RESEARCH_BRIEFS/RB-NNN_topic.md`
- Updates `docs/active/RESEARCH_BRIEFS/_INDEX.md`
- Proposes ADRs in brief §7

**Reads**: `T-RES-INSTRUCTIONS.md` + the specific T5 prompt at `docs/active/RESEARCH_BRIEFS/T5_PROMPTS/T5-DEEP-NNN_topic.md`.

**Does NOT**: commit, modify canonical docs (MASTER_PUSH_PLAN, ROADMAP, DECISIONS, TECH_PLATFORM_VISION), write code, chain to a second mission in the same session.

**Tier 1 background scans** (NOT a substitute for T5): T1 may spawn background research-agents for quick factual lookups (~30 min, 5-8 web queries) — these go to `docs/active/RESEARCH_BRIEFS/RB-NNN.md` labeled as Tier 1 baseline. Tier 2 deep dives are always manual T5 terminal.

**Output**: research briefs that T1 reviews + commits.

---

## Cowork — Visual / Design (Cursor)

**Role**: Heavy visual design work in Cursor. UI polish, component redesigns, complex chart layouts.

**Scope**:
- Reads `COWORK_PROMPTS_PELEG.md` (gitignored, in repo root) at session start
- Each prompt has a `PROMPT 0` mandatory PRE-FLIGHT checklist enforcing refactor-over-duplicate discipline (per `RB-COWORK-AUDIT.md`)
- Produces frontend code in `ui/src/`

**Does NOT**: commit, work on backend, ignore PRE-FLIGHT (T1 rejects diffs that skip the explicit existence-check step).

**Output**: code diffs in Cursor that T1 reviews + commits.

---

## T-PEL — Peleg Feedback Processor

**Role**: Session-scoped (spawned when Peleg sends a new feedback batch). Processes her PDFs/notes into actionable system-design tasks for Cowork or T2/T3.

**Scope**:
- Reads the full Peleg feedback document end-to-end
- Translates symptoms into root-cause tasks (per `feedback_root_cause_workflow.md`)
- Updates `docs/active/PELEG_REVIEW_TASKS.md` and `docs/active/ALEX_BACKLOG.md` if relevant

**Reads**: the feedback artifact + `PELEG_REVIEW_TASKS.md` history.

**Output**: task breakdown + Cowork prompt drafts that T1 reviews.

---

## Operating principles

1. **One file per session start**: every terminal reads its instructions doc + AGENTS.md first.
2. **One concrete live test per chunk** (per `feedback_simplicity_and_testability.md`): every commit T1 makes ends with a `🧪 Manual test` block. If a chunk can't be tested live, that's a planning failure.
2b. **Global-provider integration check**: when a page or component introduces a `useXxx()` context hook (e.g., `useDrillDown`), confirm the matching `<XxxProvider>` is mounted in `ui/src/App.tsx` BEFORE committing. Unit tests wrap providers manually, so a missing app-shell mount passes tests but crashes the live page. Reference: the `useDrillDown` regression caught only via Said's browser test 2026-05-12.
3. **Bias to simplest implementation**: solutions Said can audit beat solutions that look clever.
4. **T1 proposes workflow upgrades proactively**: hooks, skills, slash commands, memory files — ship inline, opt-out model.
5. **PRE-FLIGHT before any new file**: search for existing equivalents, decide extend / refactor / replace / leave alone, justify before writing.
6. **Branch protection**: feature work on `wave-N-name` branches. `main` only receives reviewed merge commits.
7. **No emojis in production UI or commit messages unless Said explicitly requests** — they leak "AI generated" feel.

---

## Reference files

- `docs/active/STATUS.md` — current dispatch state + manual test plan + per-readiness work queue
- `docs/active/MASTER_PUSH_PLAN.md` — 7-wave plan to full-platform vision
- `docs/active/ROADMAP.md` — Phases A-O detailed tasks
- `docs/active/DECISIONS.md` — all ADRs
- `docs/active/RESEARCH_BRIEFS/_INDEX.md` — research brief log
- `CLAUDE.md` (project root) — authoritative agent instructions
- `~/.claude/projects/-Users-saidazaizah-Desktop-DESY-peptide-prediction/memory/MEMORY.md` — Said's running memory of feedback + project state

When in doubt, read STATUS.md first. It tells you what's doing-now, what's blocked, what's next.
