---
name: terminal-orchestration
description: Manage multi-terminal development workflow for PVL. CEO terminal plans, creates instruction docs, coordinates sub-terminals and Cowork prompts.
user_invocable: true
---

# Terminal Orchestration Skill — PVL

## When to Use
- Starting a new development wave
- After completing a milestone and planning next steps
- When adding/removing/reassigning sub-terminals
- When evaluating if a task should go to Cowork instead of Claude Code

## Terminal Roles

| Terminal | Domain | Owns |
|----------|--------|------|
| **T1 (CEO)** | Orchestration, planning, docs, coordination | PLAN.md, TX-INSTRUCTIONS.md, commits, merges |
| **T2** | Backend & Pipeline | Python, FastAPI, TANGO, S4PRED, tests |
| **T3** | Frontend & UI | React, TypeScript, components, pages, stores |
| **T4+** | Feature-specific | Self-contained features, infrastructure, Docker |

## Cowork Decision Protocol

Before any multi-file frontend task, evaluate:

| Cowork is better when... | Claude Code is better when... |
|--------------------------|-------------------------------|
| New page/component design from scratch | Bug fixes in existing code |
| Visual redesign (colors, layout, spacing) | Backend logic, API routes, pipeline |
| Multi-component generation (3+ files) | Single-file edits, refactors |
| Design system changes | Test writing, debugging |
| Complex CSS/animation work | Infrastructure, Docker, CI |

**If Cowork wins**, generate a prompt like:
```
## Cowork Prompt: [Task Name]

### Context
[What exists now, key files, screenshots]

### Goal
[Exact deliverable with acceptance criteria]

### Constraints
- Use shadcn/ui components from ui/src/components/ui/
- Follow PVL design tokens (see ui/src/index.css)
- TypeScript strict mode
- Must integrate with existing Zustand stores

### Files to Create/Modify
[Exact file paths]

### Reference
[Screenshots, existing code patterns, design specs]
```

## Workflow — CEO Terminal

### 1. Start of Session
```
/catch-up          → What changed since last session
git status         → Any uncommitted work?
```

### 2. Plan the Wave
- Read ROADMAP.md + ALEX_BACKLOG.md for priorities
- Group 3-5 tasks by domain
- Identify Cowork vs Claude Code split
- Write TX-INSTRUCTIONS.md for each sub-terminal

### 3. Execute the Wave
- Sub-terminals work in parallel on independent tasks
- CEO monitors, reviews, resolves conflicts
- Cowork handles visual/design tasks via prompts from CEO

### 4. Wave Checkpoint
```
/review-pr         → Safety check all changes
/checkpoint        → Summarize wave results
git commit + push  → Clean push
```

### 5. Plan Next Wave
- Update PLAN.md with completed items
- Write next TX-INSTRUCTIONS.md
- Repeat

## Instruction Doc Template

Each `TX-INSTRUCTIONS.md` contains:

```markdown
# T[N] — [Terminal Name]

## Role
[1-sentence focus area]

## Current Wave: [Wave Name]

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Key Files
- file1.py
- file2.tsx

## Rules
- Do NOT modify [protected files]
- Do NOT commit — CEO terminal handles commits
- Ask CEO before [specific decisions]

## Context
[Any relevant docs, screenshots, decisions]
```

## Adding a New Terminal
Warranted when:
1. Self-contained feature with own frontend + backend
2. Deep context that would pollute other terminals
3. Parallel work with no blocking dependencies

Create TX-INSTRUCTIONS.md, reference in PLAN.md.
