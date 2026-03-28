# Claude Code Workflow Cheatsheet — PVL

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/plan-chunk N` | Plan implementation for Peleg review chunk N |
| `/review-pr` | Review staged changes against safety rules |
| `/test-peptide SEQUENCE` | Trace a sequence through the entire pipeline |
| `/audit-ff` | Scan UI for missing FF data |
| `/terminology-scan` | Find UI text needing simplification |
| `/checkpoint` | Summarize session, list changes, suggest next steps |
| `/design-audit [scope]` | Full UI/UX audit: data accuracy, visualization, responsive, a11y |
| `/pvl-peleg-review [chunk]` | Load Peleg review workflow for a specific chunk |

## Agents (invoked automatically when relevant)

| Agent | Model | Purpose |
|-------|-------|---------|
| `code-reviewer` | Sonnet | Reviews diffs for safety (API contract, null semantics, single/batch) |
| `research-agent` | Sonnet | Investigates UX/bioinformatics/architecture questions (read-only) |
| `test-writer` | Sonnet | TDD specialist — writes failing test first, then implementation |

## Skills (auto-triggered by context)

| Skill | Triggers when... |
|-------|-----------------|
| `pvl-backend-patterns` | Editing Python backend files |
| `pvl-frontend-patterns` | Editing React/TypeScript files |
| `pvl-testing` | Writing or running tests |
| `pvl-data-pipeline` | Working on prediction pipeline |
| `ui-design-research` | Editing UI components or pages (research-first design) |
| `auto-detect` | Always active — proactive quality + workflow detection |

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
| Sentry | Error tracking queries (authenticate on first use) |
| Figma | Design-to-code workflow (global, always available) |

### Recommended MCPs to Install
| Server | Install Command |
|--------|----------------|
| Refero | `claude mcp add refero -- npx -y @anthropic-ai/mcp-remote https://refero.design/mcp` |
| Playwright | `claude mcp add playwright -- npx @playwright/mcp@0.0.41` |
| Magic UI | `npx -y @21st-dev/magic@latest` (needs API key) |

## Quick Make Commands

```bash
make test          # All backend tests
make test-unit     # Fast unit tests
make lint          # Ruff check
make typecheck     # mypy
make fmt           # Ruff format + isort
make ci            # Full pipeline (lint + typecheck + test)
make smoke-tango   # TANGO integration smoke test
make contract-check # Verify API contract
```

## Frontend Commands

```bash
cd ui
npx vitest run                          # All frontend tests
npx vitest run src/lib/__tests__/FILE   # Specific test
npx tsc --noEmit                        # Type check
npx prettier --check "src/**/*.{ts,tsx}" # Format check
```

## Key File Locations

```
.claude/
├── settings.json          # Team hooks (shared)
├── settings.local.json    # Personal permissions (gitignored)
├── WORKFLOW.md            # This file
├── agents/                # code-reviewer, research-agent, test-writer
├── commands/              # Slash commands
├── hooks/                 # Git + format hooks
└── skills/                # Context-aware patterns

docs/active/               # All authoritative documentation
backend/CLAUDE.md           # Python/FastAPI patterns
ui/CLAUDE.md                # React/TypeScript patterns
docs/CLAUDE.md              # Documentation file map
~/.claude/CLAUDE.md         # Global user preferences
```

## Common Workflows

### Starting a Peleg review chunk
```
/plan-chunk 3        → reads chunk, creates plan
/pvl-peleg-review 3  → loads review context
```

### Before committing
```
/review-pr           → safety check staged changes
/checkpoint          → summarize session
```

### Debugging a peptide result
```
/test-peptide MRWQEMGYIFYPRKLR   → traces through pipeline
```

### After significant changes
```
make ci              → full backend pipeline
cd ui && npx vitest run && npx tsc --noEmit   → full frontend check
```
