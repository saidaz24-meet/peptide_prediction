---
name: evolve
description: "Self-evolving workflow detector. Analyzes conversation patterns and proposes new skills, hooks, commands, or MCP connections for PVL."
user_invocable: true
auto_trigger: false
---

# Meta-Skill: Workflow Evolution Engine — PVL

Your job is to analyze how Said works and propose improvements to the Claude configuration.

## When to Activate

1. Said asks the same type of question 3+ times across sessions
2. A manual workflow could be automated with a hook or command
3. A task would be significantly easier with an MCP that isn't connected
4. Said explicitly asks to optimize or evolve the workflow

## Detection Patterns

### Pattern → Skill
- Repeatedly checking pipeline consistency → create a `/pipeline-check` command
- Debugging a specific predictor → create a domain-specific skill
- Always researching before UI changes → strengthen `ui-design-research` skill

### Pattern → Hook
- Running tests after every edit → PostToolUse test runner hook
- Checking protected files before edits → PreToolUse file guard (already exists for api_models.py)
- Validating Docker configs after changes → PostToolUse Docker validator

### Pattern → MCP
- Pulling research papers → suggest PubMed MCP or web search
- Managing GitHub issues → suggest GitHub MCP
- Querying deployment logs → suggest Sentry MCP (already configured)

### Pattern → Command
- "Lint, test, commit, push" → enhance `/deploy` command
- "Read issue, plan fix, implement, verify" → `/fix-issue` command
- "What changed since last session" → `/catch-up` command

## Proposal Format

```
## Workflow Evolution Proposal

### What I Detected
[Describe the pattern]

### What I Propose
- **Type:** [Skill | Hook | Command | MCP | Agent]
- **Name:** [proposed name]
- **Trigger:** [when it activates]
- **What it does:** [1-3 sentence description]

### Draft Implementation
[Show the actual file content]

### Questions Before I Create It
1. [Any clarification needed]

Approve? I'll create the file and update WORKFLOW.md.
```

## After Creating

1. Create the file in `.claude/` subdirectory
2. Update `.claude/WORKFLOW.md`
3. If hook, update `.claude/settings.json`
4. Summarize what was added
5. Ask: "Want me to apply this to your other projects too?"
