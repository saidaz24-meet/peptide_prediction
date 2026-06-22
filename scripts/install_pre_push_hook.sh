#!/usr/bin/env bash
# scripts/install_pre_push_hook.sh
#
# Install a git pre-push hook that catches lint + import-order failures
# locally so we never push CI-failing commits again. Said was getting a
# storm of email notifications because every red build pings him —
# we shut that off at the source.
#
# Run once: `bash scripts/install_pre_push_hook.sh`
# After that, every `git push` will:
#   1. Run `ruff check` on backend/. Fail-fast on lint errors.
#   2. Optionally skip via `git push --no-verify` for emergencies.
#
# The hook is fast (~2 s on a warm cache) so it doesn't slow you down.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-push"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "ERROR: $REPO_ROOT is not a git repo." >&2
  exit 1
fi

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
# Auto-installed by scripts/install_pre_push_hook.sh.
# Bypass with `git push --no-verify`.

set -e

REPO=$(git rev-parse --show-toplevel)

# Fast path: only run if backend/ has changes in this push range.
ORIGIN_BRANCH="origin/$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
if git rev-parse --verify "$ORIGIN_BRANCH" >/dev/null 2>&1; then
  CHANGED=$(git diff --name-only "$ORIGIN_BRANCH"...HEAD -- backend/ 2>/dev/null || echo "")
else
  CHANGED=$(git diff --name-only HEAD~1...HEAD -- backend/ 2>/dev/null || echo "all")
fi

if [ -z "$CHANGED" ]; then
  exit 0
fi

echo "→ pre-push: ruff check backend/"
cd "$REPO/backend"
if [ -x .venv/bin/python ]; then
  RUFF=".venv/bin/python -m ruff"
elif command -v ruff >/dev/null 2>&1; then
  RUFF="ruff"
else
  echo "  ruff not installed locally; skipping lint check"
  echo "  (CI will catch it — install with `pip install ruff` to fail-fast)"
  exit 0
fi

# Mirror the CI invocation. --extend-exclude handles the macOS `* 2.py`
# duplicate files that aren't in git but exist on Said's disk.
if ! $RUFF check --extend-exclude '* 2.py' . 2>&1; then
  echo
  echo "❌ ruff check failed. Push aborted."
  echo "   Fix: cd backend && .venv/bin/python -m ruff check --fix ."
  echo "   Bypass (not recommended): git push --no-verify"
  exit 1
fi

echo "✅ ruff check passed"
HOOK

chmod +x "$HOOK_PATH"
echo "✅ Installed pre-push hook at $HOOK_PATH"
echo "   Runs ruff check on backend/ before every push."
echo "   Bypass with: git push --no-verify"
