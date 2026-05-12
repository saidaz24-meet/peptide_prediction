#!/bin/bash
# Stop hook — regenerates docs/active/SESSION_LOG.md surfacing the last 7
# days of commits + their 🎨 "For your taste" blocks. Said reads this
# end-of-day to know what needs his eyes (per RB-005 §4.1 #1 and
# feedback_manual_test_means_browser.md).
#
# Non-blocking: failures are silent so a broken make target never blocks
# a session close. Skipped if no git commits in last 7 days.

INPUT=$(cat)
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')

[[ -z "$PROJECT_DIR" ]] && exit 0
cd "$PROJECT_DIR" || exit 0

# Skip if no commits this week (research-only or doc-only repos)
if ! git log --since="7 days ago" --oneline 2>/dev/null | head -1 | grep -q .; then
  exit 0
fi

# Run silently; capture stderr only if the user wants to debug.
make session-log >/dev/null 2>&1 || true

exit 0
