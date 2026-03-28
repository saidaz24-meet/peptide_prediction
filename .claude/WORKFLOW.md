# PVL — Workflow Cheatsheet

## Terminal Orchestration

| Terminal | Domain | Focus |
|----------|--------|-------|
| **T1 (CEO)** | Orchestration | Plans waves, writes TX-INSTRUCTIONS.md, coordinates commits, reviews |
| **T2** | Backend & Pipeline | Python, FastAPI, TANGO, S4PRED, tests, API routes |
| **T3** | Frontend & UI | React, TypeScript, components, pages, Zustand stores |
| **T4+** | Feature-specific | Docker, CI, infrastructure, or self-contained features |
| **Cowork** | Visual design | Multi-file UI generation, page layouts, design system changes |

### Cowork Decision Rule
Before any multi-file frontend task, ask: **"Is this a Cowork job?"**

| Use Cowork for... | Use Claude Code for... |
|-------------------|------------------------|
| New page/component from scratch | Bug fixes, refactors |
| Visual redesign (3+ files) | Backend logic, API, pipeline |
| Design system changes | Single-file edits |
| Complex CSS/animation | Tests, debugging, infrastructure |

When Cowork wins → generate a structured prompt (see `/terminal-orchestration` skill).

### Wave Protocol
Each wave: **Plan → Execute → Verify → Checkpoint → Push**
- Group 3-5 related tasks per wave
- Never mix unrelated changes
- CEO terminal owns commits

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/catch-up` | Session briefing: recent commits, build health, what to do next |
| `/plan-chunk N` | Plan implementation for Peleg review chunk N |
| `/fix-issue ISSUE-XXX` | Fetch issue → explore → plan → implement → verify |
| `/review-pr` | Review staged changes against safety rules |
| `/deploy` | Full pipeline check: lint + typecheck + test + Docker build |
| `/test-peptide SEQUENCE` | Trace a sequence through the entire pipeline |
| `/audit-ff` | Scan UI for missing FF data |
| `/terminology-scan` | Find UI text needing simplification |
| `/checkpoint` | Summarize session, list changes, suggest next steps |
| `/design-audit [scope]` | Full UI/UX audit: data accuracy, visualization, responsive, a11y |
| `/evolve` | Detect workflow patterns → propose new skills/hooks/commands |
| `/terminal-orchestration` | Plan terminal assignments and generate instruction docs |

## Agents

| Agent | Model | Purpose | Can Write? |
|-------|-------|---------|-----------|
| `code-reviewer` | Sonnet | Reviews diffs for safety (API contract, null semantics, single/batch) | No |
| `research-agent` | Sonnet | Investigates UX/bioinformatics/architecture questions | No |
| `test-writer` | Sonnet | TDD specialist — writes failing test first, then implementation | Yes |

## Skills (auto-triggered by context)

| Skill | Triggers when... |
|-------|-----------------|
| `pvl-backend-patterns` | Editing Python backend files |
| `pvl-frontend-patterns` | Editing React/TypeScript files |
| `pvl-testing` | Writing or running tests |
| `pvl-data-pipeline` | Working on prediction pipeline |
| `frontend-design` | Editing UI components or pages |
| `ui-design-research` | Designing new UI (research-first methodology) |
| `auto-detect` | Always active — proactive quality + workflow detection |
| `terminal-orchestration` | Multi-terminal coordination |
| `evolve` | Self-improving workflow detection |

## Hooks (automatic)

| Hook | When | Effect |
|------|------|--------|
| `protect-api-contract` | Any edit to `schemas/api_models.py` | **BLOCKS** the edit |
| `format-python` | After editing `.py` files in `backend/` | Runs `ruff format` |
| `format-frontend` | After editing `.ts/.tsx` files in `ui/` | Runs `prettier --write` |
| `warn-git-push` | Before `git push` | Prints branch reminder |

## MCP Servers

| Server | Purpose |
|--------|---------|
| Puppeteer | Visual debugging, screenshot verification |
| Playwright | Browser automation, E2E testing |
| Figma | Design-to-code workflow |
| Magic Patterns | Design system generation |
| Sentry | Error tracking (authenticate on first use) |

## Quick Commands

```bash
# Backend
make test          # All backend tests
make test-unit     # Fast unit tests
make lint          # Ruff check
make typecheck     # mypy
make fmt           # Ruff format + isort
make ci            # Full pipeline (lint + typecheck + test)
make smoke-tango   # TANGO integration smoke test
make contract-check # Verify API contract

# Frontend
cd ui
npx vitest run                          # All frontend tests
npx vitest run src/lib/__tests__/FILE   # Specific test
npx tsc --noEmit                        # Type check
npx prettier --check "src/**/*.{ts,tsx}" # Format check
```

## Common Workflows

### Starting a session
```
/catch-up                 → briefing
```

### Starting a wave
```
/terminal-orchestration   → plan terminal assignments
/plan-chunk N             → if working on Peleg review
```

### Before committing
```
/review-pr                → safety check
/checkpoint               → summarize session
```

### Fixing a bug
```
/fix-issue ISSUE-020      → guided fix workflow
```

### Full deploy check
```
/deploy                   → lint + test + Docker build
```

### Debugging a result
```
/test-peptide MRWQEMGYIFYPRKLR   → traces through pipeline
```

### Optimizing workflow
```
/evolve                   → detect patterns, propose improvements
```

## Key File Locations

```
.claude/
├── settings.json          # Team hooks (shared)
├── settings.local.json    # Personal permissions (gitignored)
├── WORKFLOW.md            # This file
├── agents/                # code-reviewer, research-agent, test-writer
├── commands/              # Slash commands (catch-up, fix-issue, deploy, etc.)
├── hooks/                 # Git + format hooks
└── skills/                # Context-aware patterns + orchestration

docs/active/               # All authoritative documentation
├── ROADMAP.md             # Strategic phases + task lists
├── ALEX_BACKLOG.md        # All Alex/Peleg feedback (70+ items)
├── KNOWN_ISSUES.md        # Tracked bugs
├── CONTRACTS.md           # API contract reference
├── PELEG_REVIEW_TASKS.md  # Holistic review chunks
└── ...

backend/CLAUDE.md          # Python/FastAPI patterns
ui/CLAUDE.md               # React/TypeScript patterns
```

## Priority Queue (Current)

See `docs/active/ROADMAP.md` for full roadmap. Quick reference:

1. **Bug fixes**: ISSUE-019 (example button), ISSUE-020 (number validation)
2. **Features**: B11 (FASTA upload), B12 (upload guidance)
3. **Phase F**: UniProt search fixes (F1-F3)
4. **Phase D**: UI redesign (Alex/Peleg backlog)
5. **Phase E**: Docker, CI, deployment
6. **Phase G**: AI/LLM integration
