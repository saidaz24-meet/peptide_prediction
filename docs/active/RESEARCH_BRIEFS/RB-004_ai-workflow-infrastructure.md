# AI-Native Development Workflow Infrastructure — Research Brief

**Brief ID**: RB-004
**Date**: 2026-05-12
**Author**: T-RES (background research-agent — Tier 1 baseline; deeper Tier 2 follow-up reserved for manual T5 terminal if Said wants iteration)
**Mission**: What does a top-tier AI-native workflow look like for a solo OSS scientific founder (Said/PVL)? Concrete enhancements across `.claude/`, Cowork, multi-terminal orchestration, academic collaboration, and productivity rituals.
**Reading time**: ~12 minutes

---

## §1 — TL;DR (5 bullets)

- PVL's current `.claude/` hooks (4: API contract guard, push warning, ruff format, prettier format) miss three high-value gates: TypeScript type-check on write, a `Stop` hook enforcing test passage before session close, and a `PreToolUse` block on `npm install` (supply-chain guard).
- Cowork PRE-FLIGHT is proven to work (5 of 6 rounds clean per RB-COWORK-AUDIT). Next upgrade: token-cost framing line + parallel-file soft-warning rule — not a redesign.
- Multi-terminal map (T1/T2/T3/T-RES/Cowork/T-PEL) is structurally sound. Missing roles: **T-OPS** (VPS observability, deploy cadence) and a lightweight `AGENTS.md` shared across terminals.
- Peleg/Alex collaboration needs one artifact: `docs/active/COLLAB.md` + biweekly `make changelog-peleg` ritual auto-fed from git log. Converts verbal feedback to async-traceable decisions.
- "CEO of YC" distinction: treats workflow infrastructure as a product with sprint allocations, not a tooling side task. Said's Wave approach is already correct. Gap is ritual cadence enforcement and documented protocols that survive MIT semester bandwidth cuts.

---

## §2 — Context

Said directive 2026-05-08: *"like the CEO of Y Combinator would do... top tier AI workflow,"* immediately after RB-COWORK-AUDIT finding that PRE-FLIGHT works but needs iteration. PVL enters a phase where Said's bandwidth shrinks toward MIT September 2026. Workflow infrastructure choices made now compound over 12+ months of solo maintenance.

---

## §3 — Options evaluated

### Domain 1: `.claude/` hooks and config

**Current state** (`.claude/settings.json`):
- `PreToolUse [Edit|Write]` — blocks writes to `schemas/api_models.py` (exit 2). Correct.
- `PreToolUse [Bash]` — warns on `git push`. Informational only.
- `PostToolUse [Edit|Write]` — ruff format on Python.
- `PostToolUse [Edit|Write]` — prettier on TS/TSX.

**Missing hooks** (ranked by bug-catching value):

**Hook A — TypeScript typecheck on PostToolUse Write** — catches type regressions the moment a file is saved. `npx tsc --noEmit 2>&1 | head -30` restricted to `ui/**/*.ts[x]`. Non-blocking; Claude sees stderr and self-corrects.

**Hook B — Stop hook: test gate before session close** — `Stop` hook running `cd backend && make test-unit` and exit 2 on failure. Forces Claude to keep working until tests pass. **Highest-leverage single hook pattern** (Anthropic docs, blakecrosley.com).

**Hook C — npm install supply-chain guard (PreToolUse Bash)** — Block `npm install <package>` (production deps) with exit 2. Two-line regex prevents AI-hallucinated package names ("slopsquatting" — pixelmojo.io). Cheap, catches catastrophic failure mode.

**Hook D — Parallel-file soft audit (PostToolUse Write)** — automated version of T1's pre-merge audit from RB-COWORK-AUDIT §5. ~20-line shell script using `find`+`awk`.

**Hook E — SessionStart context injector** — write current branch, last commit, active wave from MASTER_PUSH_PLAN to `.claude/session-context.txt`. Eliminates first-turn "what are we working on" overhead.

**Custom slash commands** (`.claude/commands/`):
- `/pvl-status` — active wave, open KNOWN_ISSUES count, last VPS deploy
- `/pvl-test` — runs `make test-unit`, surfaces first failure
- `/pvl-contract-check` — runs `make contract-check`
- `/pvl-new-issue` — scaffolds KNOWN_ISSUES entry

**MCP servers worth adding** (all OSS):
- `@modelcontextprotocol/server-github` — query PVL's own GitHub issues/PRs/Actions
- `pvl-mcp` (Wave G1) is a product feature, not a workflow tool

**Not adding**: CronCreate scheduled tasks — premature at PVL scale. Calendar reminders + manual T-RES dispatch suffice.

---

### Domain 2: Cowork (Cursor) prompt engineering

**Current state**: PRE-FLIGHT checklist works (5/6 clean per RB-COWORK-AUDIT).

**Option A — Incremental PRE-FLIGHT v2 (Recommended)**:
1. Token-cost framing: *"This session is billed by token. Refactor in place unless replacement is clearly justified."*
2. Environment escalation: *"If a native module / sandbox error repeats after one fix attempt, STOP and report to T1. Do not reinstall."*
3. Parallel-file warning: *"Before creating any file, check whether a file with a similar name exists in any sibling directory. State justification."*

**Option B — `.cowork/CONTEXT.md` persistent memory** — design system tokens + component conventions loaded as `@file` reference in every Cowork session. ~500 tokens, eliminates style drift. Equivalent to Cursor's `.cursorrules` pattern.

**Option C — `.cursor/rules/ui-visual.mdc`** — Project Rule that fires on `.tsx` files in `ui/src/components/`. Persistent design system context without polluting non-visual sessions. ~15 min to write.

**Anti-duplication patterns beyond PRE-FLIGHT**:
- Pre-merge audit script before every Cowork commit
- Naming convention enforcement (PascalCase.tsx, use[Name].ts)
- "One feature, one PR" discipline

---

### Domain 3: Multi-terminal orchestration

**Current map**: T1 (CEO), T2 (backend), T3 (frontend), T-RES/T5 (research), Cowork (visual), T-PEL (Peleg).

Assessment against Addy Osmani's 3-5 teammate sweet spot: 4 persistent terminals (T1/T2/T3/T-RES) — inside sweet spot. Cowork/T-PEL are session-scoped, not persistent.

**Missing role — T-OPS (observability + deployment)**:
Owns: `ssh root@94.130.178.182`, Sentry DSN review, `docker compose ps` health summaries, weekly VPS deploy checklist. One session/week, 30-45 min. **Highest-leverage missing role** given MIT transition — if VPS goes down at 2am MIT time, T-OPS instructions mean future maintainer (or Said in 15 min) can execute without T1 context.

**Coordination gaps**:
- No `TERMINAL_STATUS.md` (gitignored, T1's live dispatch board)
- No `AGENTS.md` at project root (committed, defines each terminal's role/scope/forbidden-actions/output-format)

**Not adding**: complex orchestration platforms (Gas Town, Ruflo). Said's wave-based dispatch is already correct. Claude Code's experimental Agent Teams: revisit at Wave 4+.

---

### Domain 4: Communication Said ↔ Peleg ↔ Alex

**Recommended (Options A + B)**:

**Option A — Biweekly `CHANGELOG_PELEG.md`**: `make changelog-peleg` → 3-line shell script generates readable git-log summary. T1 adds one paragraph of plain-language commentary. Sent to Peleg + Alex. 10 min/biweek. Converts lossy verbal loop to traceable written.

**Option B — `docs/active/COLLAB.md` cadence document**: specifies (1) Peleg's feedback delivery format, (2) Alex's feedback format, (3) biweekly changelog ritual, (4) pre-paper freeze protocol (30 days before submission: freeze API). ELIXIR RSEng 2024 surveys identify this as highest-leverage single artifact for small academic software teams.

**Option C — Loom milestone debriefs**: only for major releases (v0.2, v1.0), not weekly cadence.

---

### Domain 5: Productivity rituals

Minimum viable cadence for solo MIT-semester maintainer:
- **Weekly (15 min Sunday)**: M-WEEKLY scan, update TERMINAL_STATUS.md, push commits, check Sentry.
- **Biweekly (30 min)**: Generate + send CHANGELOG_PELEG.md, review ALEX_BACKLOG.md.
- **Monthly (45 min)**: ROADMAP review, T-RES queue update, `make ci` baseline.
- **Quarterly (90 min)**: M-QUARTERLY tech radar, wave boundary review.
- **Pre-MIT (August 2026)**: `docs/active/HANDOFF.md` — every undocumented assumption.

Tools: plain markdown wins. Linear/Sunsama/Reflect add SaaS dependencies. Said's existing pattern is correct; gap is ritual enforcement.

**Guillermo Rauch "exposure hours"**: 20 min/week watching a researcher use PVL from cold start. Taste compounds; more valuable than any tool switch.

---

### Domain 6: Cursor / VS Code multi-window setup

**Geoff Huntley spec-driven approach**: specs + strict TypeScript = compiler as continuous feedback. Applied: `"strict": true` + Hook A typecheck gate = every AI-written TS file compiler-validated before session ends.

**Concrete layout (macOS, two monitors)**:
- Monitor 1, left: Cursor (Cowork or T3)
- Monitor 1, right: iTerm2 + tmux, T1 top / T2 bottom
- Monitor 2, left: Browser (localhost:5173, Sentry)
- Monitor 2, right: T-RES + documentation viewer

tmux over iTerm2 splits — survives ssh disconnects, scriptable restoration. `~/.tmux-pvl.conf` restores 4-pane layout with one command.

---

### Domain 7: Compound tooling beyond Claude Code

**Recommendation: standardize on Claude Code + Cursor (visual only). Reject second AI tool now.**

- **Aider**: tighter commit granularity, but "two captains" problem — split architectural decisions
- **Codex CLI**: not competitive for multi-file project understanding
- **Cline / Continue**: redundant with Cursor's native Claude
- **Codebuff**: async PR review — revisit when PVL has external contributors

Add a second AI tool only when a specific capability gap is demonstrated, not speculatively.

---

### Domain 8: What "CEO of YC" does differently

Three habits (Guillermo Rauch / Lenny's Podcast May 2025):

1. **Clearly defined product intent before implementation** — "a researcher running 500 peptides should see their top 10 in <3 seconds with one-click CSV" beats "add a feature." Said's wave prompts move this direction; gap is per-task success metrics.

2. **Iterative coaching with references, not prescriptions** — provide AI with examples of "what good looks like" (RCSB PDB result pages) instead of step-by-step instructions. Said does this for Cowork; should be standard for T2/T3.

3. **Verification as the bottleneck, not generation** — Hook B (Stop+test gate) automates mechanical verification. Said's attention reserved for architectural decisions.

What YC-tier solo founders do:
- **Workflow infrastructure as product sprint**, not side task. (M-006 mission itself is this pattern.)
- **Ship to users before features polished.** GitHub presence + JOSS paper are right instinct.
- **Pre-allocate maintenance budget.** 2h/month at MIT is only viable if system is designed for it. HANDOFF.md is structural response.
- **Keep research → product loop tight.** T-RES is right mechanism. Gap: T-RES briefs should explicitly drive wave priorities, not just inform them.

---

## §4 — Comparison matrix

| Enhancement | Impact (1-5) | Cost (h) | Risk | Reversible? |
|---|---|---|---|---|
| Hook B: Stop+test gate | 5 | 0.5 | Low | Yes |
| Hook A: TS typecheck on write | 4 | 0.5 | Low | Yes |
| Hook C: npm install guard | 3 | 0.5 | Low | Yes |
| Hook D: parallel-file audit | 3 | 1.0 | Low | Yes |
| Hook E: SessionStart injector | 2 | 0.5 | Low | Yes |
| PRE-FLIGHT v2 (Cowork) | 4 | 0.25 | Low | Yes |
| `.cowork/CONTEXT.md` | 3 | 1.0 | Low | Yes |
| `.cursor/rules/ui-visual.mdc` | 3 | 0.25 | Low | Yes |
| AGENTS.md | 4 | 1.5 | Low | Yes |
| TERMINAL_STATUS.md | 3 | 0.25 | Low | Yes |
| T-OPS terminal spec | 4 | 2.0 | Low | Yes |
| COLLAB.md | 4 | 1.0 | Low | Yes |
| CHANGELOG_PELEG make target | 4 | 0.5 | Low | Yes |
| Weekly ritual (15 min/wk) | 3 | 0.25/wk | Low | Yes |
| Pre-MIT HANDOFF.md | 5 | 4.0 | Low | Yes |
| Aider (second AI tool) | 1 | 3.0 | Medium | Yes |
| Agent Teams (Claude built-in) | 2 | 1.0 | Medium | Yes |

---

## §5 — Recommendation

**Top 5 enhancements for next 4 weeks (impact × 1/cost)**:

1. **Hook B: Stop+test gate** (0.5h) — `.claude/hooks/stop-test-gate.sh` exits 2 on `make test-unit` failure. Converts session close from "I think I'm done" to "I am done AND tests pass." Highest bug-catch ROI.

2. **PRE-FLIGHT v2 + `.cursor/rules/ui-visual.mdc`** (0.5h total) — three PROMPT 0 additions (token framing, env escalation, parallel-file warning) + Cursor rule encoding design system. Permanent ROI.

3. **`AGENTS.md` + `TERMINAL_STATUS.md`** (1.75h) — `AGENTS.md` committed at root makes multi-terminal legible to future contributor or Said-after-3-month-MIT-absence. `TERMINAL_STATUS.md` (gitignored) is T1's live dispatch board.

4. **Hook A: TS typecheck PostToolUse + Hook C: npm install guard** (1h total) — completes the quality gate layer. Type regressions caught in-session; supply-chain guard blocks slopsquatting class.

5. **`docs/active/COLLAB.md` + `make changelog-peleg`** (1.5h) — explicit co-author working agreement + auto-generated biweekly git log summary. Converts verbal feedback loop to async-traceable written protocol. Critical before MIT.

**Not in top 5 but plan before MIT**: `docs/active/HANDOFF.md` (4h). Without it, any 2h/month mode means Said spends first hour re-learning his own system.

---

## §6 — Implementation plan

**Total**: ~5.5h for top-5
**Wave slot**: Wave 0.3 — Workflow Infrastructure (or fold into existing Wave 0)

**Files affected**:
- `.claude/settings.json` — add Stop hook entry
- `.claude/hooks/stop-test-gate.sh`, `typecheck-frontend.sh`, `guard-npm-install.sh` — new
- `COWORK_PROMPTS_PELEG.md` — PROMPT 0 additions
- `.cursor/rules/ui-visual.mdc` — new
- `AGENTS.md` — new (committed, root)
- `docs/active/TERMINAL_STATUS.md` — new (gitignored)
- `docs/active/COLLAB.md` — new
- `Makefile` — add `changelog-peleg` target

**New ADRs**: ADR-018 (multi-terminal protocol), ADR-019 (hook quality gates). Drafts §7.

**Tech-radar**: Claude Code hooks "plan-next" → "adopt-now". `AGENTS.md` "plan-next" → "adopt-now". Aider/second AI: remain "parked".

---

## §7 — Proposed ADR drafts

```markdown
## ADR-018 — Multi-terminal orchestration protocol
**Date**: 2026-05-12 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: PVL uses 4-6 Claude Code terminals but has no written protocol for role boundaries, coordination, or handoff. Terminals start cold and re-read context independently. Addy Osmani's research confirms human-curated AGENTS.md files improve agent success rates.
**Decision**: Adopt AGENTS.md (committed, root) defining each terminal's role, scope, forbidden actions, output contract. Add TERMINAL_STATUS.md (gitignored) as T1's live coordination surface. Add T-OPS terminal spec for VPS/deploy/observability work.
**Reasoning**: Multi-terminal PVL works well; gap is legibility and survivability — AGENTS.md makes the system comprehensible without T1's context, critical for MIT transition.
**Implication**: Every new terminal session begins with reading AGENTS.md. T1 updates TERMINAL_STATUS.md after every dispatch. AGENTS.md reviewed quarterly.
**Evidence**: RB-004 §3 Domain 3, Addy Osmani multi-agent post, RB-COWORK-AUDIT.
```

```markdown
## ADR-019 — Claude Code hook quality gates
**Date**: 2026-05-12 · **Status**: PROPOSED · **Author**: T-RES + Said
**Context**: PVL's .claude/settings.json has 4 hooks (API guard, push warning, ruff, prettier). Missing: type checking, test gate, supply-chain guard. Claude Code's Stop + exit 2 pattern is canonical mechanism for forcing session completion only after tests pass.
**Decision**: Add 3 hooks: (1) PostToolUse TS typecheck on ui/**/*.tsx writes, (2) Stop hook running make test-unit + exit 2 on failure, (3) PreToolUse Bash guard blocking npm install (production deps).
**Reasoning**: Current hooks catch formatting drift but not type regressions or test failures. Stop gate is highest-leverage addition: eliminates "T2/T3 declares done but CI is red."
**Implication**: Sessions introducing type errors or breaking tests don't close cleanly. Claude self-corrects before stopping. Marginal token cost: ~200 tokens/session.
**Evidence**: RB-004 §3 Domain 1, pixelmojo.io hooks patterns, alexop.dev hooks guide.
```

---

## §8 — Sources cited

1. https://blakecrosley.com/guides/claude-code — Complete Claude Code guide: hooks, MCP, skills, model tiering
2. https://alexop.dev/posts/understanding-claude-code-full-stack/ — Full hook lifecycle events (12 events), PostToolUse oxlint example
3. https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns — Production hook patterns: TypeScript typecheck, critical file protection, npm install guard, exit code semantics
4. https://addyosmani.com/blog/code-agent-orchestra/ — Multi-agent orchestration: role separation, 3-5 teammate sweet spot, AGENTS.md finding, "verification is the bottleneck"
5. https://ghuntley.com/specs/ — Geoff Huntley spec-driven workflow: specs + stdlib + compiler soundness as AI pair-programming feedback loop
6. https://www.lennysnewsletter.com/p/everyones-an-engineer-now-guillermo-rauch — Guillermo Rauch: exposure hours for taste, iterative coaching with references not prescriptions
7. https://shipyard.build/blog/claude-code-multi-agent/ — Multi-agent Claude Code: Agent Teams vs manual multi-terminal, tmux/iTerm2 split panes
8. https://github.com/hesreallyhim/awesome-claude-code — Curated hooks, slash commands, skills, MCP servers
9. RB-COWORK-AUDIT (internal, 2026-05-08) — Empirical PRE-FLIGHT validation

---

## §9 — Open questions / things to revisit

- **Agent Teams (Claude built-in)**: re-evaluate Wave 4+ when task documentation is dense enough to delegate fully.
- **CronCreate for M-WEEKLY**: once weekly scan is routinized (3+ runs), evaluate scheduling.
- **Aider for commit granularity**: revisit October 2026 if Said finds himself making large unstructured commits in MIT mode.
- **DESY K8s timeline**: T-OPS scope depends on whether K8s materializes. If it does, T-OPS grows; if not, stays VPS-only.
- **Cursor `.cursor/rules/` stability**: syntax changed from `.cursorrules` to `.cursor/rules/*.mdc` in 2025. Recheck at next Cursor major version.

---

## §10 — Cross-references

- Proposes: ADR-018, ADR-019
- Affects: ROADMAP.md — add Wave 0.3 Workflow Infrastructure
- Affects: `COWORK_PROMPTS_PELEG.md` PROMPT 0 (PRE-FLIGHT v2)
- Extends: RB-COWORK-AUDIT
- Informs: M-001 (don't add pvl-mcp to .claude/ workflow until MCP protocol settles)

---

## §11 — Said decisions needed before implementation

1. Wave 0.3 added to ROADMAP/MASTER_PUSH_PLAN, or tag enhancements to existing Wave 0?
2. ADR-018 + ADR-019 committed now as ACCEPTED, or held as PROPOSED until hooks implemented?
3. `AGENTS.md` at root (committed/public) — are terminal role descriptions ready to be public?
4. `TERMINAL_STATUS.md` — gitignore (local-only) or commit (shared if Said adds collaborator)?
5. `COLLAB.md` — `docs/active/` (canonical, read by all terminals) or outside canonical structure?
6. Loom milestone debriefs — Said willing to invest in Loom free-tier, or screen recording → Drive suffices?
7. T-OPS terminal — should T-RES draft `T-OPS-INSTRUCTIONS.md` as the next mission, or Said defines T-OPS scope manually?
