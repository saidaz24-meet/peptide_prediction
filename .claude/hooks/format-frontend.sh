#!/bin/bash
# PostToolUse hook: Auto-format TypeScript/TSX files with prettier after Edit/Write
# Only runs on .ts/.tsx files under ui/. Silent no-op if prettier not found.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process .ts/.tsx files under ui/
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]]; then
  if [[ "$FILE_PATH" == */ui/* ]]; then
    PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
    cd "${PROJECT_DIR}/ui" 2>/dev/null && npx prettier --write "$FILE_PATH" 2>/dev/null
  fi
fi

exit 0
