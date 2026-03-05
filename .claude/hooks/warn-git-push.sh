#!/bin/bash
# PreToolUse hook: Inject reminder context before git push commands
# Does NOT block — just adds context for Claude to consider

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -q "git push"; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  echo "Pushing to remote on branch: $BRANCH. Verify this is intentional." >&2
fi

exit 0
