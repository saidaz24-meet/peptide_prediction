#!/bin/bash
# PostToolUse hook: Auto-format Python files with ruff after Edit/Write
# Only runs on .py files under backend/. Silent no-op if ruff not found.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process .py files under backend/
if [[ "$FILE_PATH" == *.py ]] && [[ "$FILE_PATH" == */backend/* ]]; then
  PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
  RUFF="${PROJECT_DIR}/backend/.venv/bin/ruff"

  if [[ -x "$RUFF" ]]; then
    "$RUFF" format "$FILE_PATH" 2>/dev/null
  fi
fi

exit 0
