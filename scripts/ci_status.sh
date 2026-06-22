#!/usr/bin/env bash
# scripts/ci_status.sh
#
# One-line summary of every open PR's CI status, so you don't need to
# rely on email notifications. Run it whenever you want a current view.
#
# Usage:
#   bash scripts/ci_status.sh              # all open PRs
#   bash scripts/ci_status.sh 102          # just PR #102

set -euo pipefail

PR=${1:-}

if [ -n "$PR" ]; then
  gh pr view "$PR" --json number,title,state,mergeable,statusCheckRollup,url \
    --jq '"PR #\(.number) — \(.title)\n  state: \(.state)  mergeable: \(.mergeable)\n  url: \(.url)\n  checks:\n" + (.statusCheckRollup | map("    [\(.state // .conclusion // "?")] \(.context // .name // "?")") | join("\n"))'
  echo
  echo "→ Recent runs:"
  BRANCH=$(gh pr view "$PR" --json headRefName --jq .headRefName)
  gh run list --branch "$BRANCH" --limit 5 --json status,conclusion,name,createdAt,databaseId \
    --jq '.[] | "  [\(.conclusion // .status)] \(.name)  (id=\(.databaseId))"'
else
  gh pr list --state open --json number,title,headRefName,statusCheckRollup,url \
    --jq '.[] | "PR #\(.number) — \(.title)\n  branch: \(.headRefName)\n  url: \(.url)\n  checks:\n" + (.statusCheckRollup | map("    [\(.state // .conclusion // "?")] \(.context // .name // "?")") | join("\n")) + "\n"'
fi
