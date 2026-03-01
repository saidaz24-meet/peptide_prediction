#!/bin/bash
# PreToolUse hook: Block edits to api_models.py (protected API contract)
# Exit 2 = block, exit 0 = allow

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *"schemas/api_models.py"* ]]; then
  echo "BLOCKED: schemas/api_models.py is the protected API contract." >&2
  echo "Changes to response schemas require explicit user approval." >&2
  echo "If intentional, ask the user to confirm before proceeding." >&2
  exit 2
fi

exit 0
