#!/usr/bin/env bash
# scripts/publish_v0_3_0.sh
#
# PVL v0.3.0 publish-day script. Runs the entire publish sequence in ~15
# minutes of human time, with explicit pauses + confirmation prompts at
# each step so nothing fires unintentionally.
#
# Prereqs (verified before any destructive op):
#   - You're on main + main is clean + main is up to date with origin
#   - CITATION.cff version field says 0.3.0
#   - You're logged into gh + have a Sentry auth token in backend/.env
#   - Peleg has signed off on her monthly review (you confirm at prompt)
#
# Steps:
#   1. Pre-flight verification
#   2. Tag + create GitHub release (mints Zenodo DOI within ~2 min)
#   3. Wait for Zenodo to mint the DOI
#   4. Patch CITATION.cff + README with the freshly-minted DOI
#   5. Push the DOI patch commit
#   6. Open bio.tools submission page in browser
#   7. Open JOSS submission page in browser
#   8. Final status report
#
# Usage:
#   chmod +x scripts/publish_v0_3_0.sh
#   ./scripts/publish_v0_3_0.sh
#
# At any prompt, Ctrl-C aborts.

set -euo pipefail

VERSION="0.3.0"
TAG="v${VERSION}"
RELEASE_TITLE="v${VERSION} — Peleg-aligned algorithm + 5-surface ecosystem"
RELEASE_NOTES="docs/active/RELEASE_NOTES_v0.3.0.md"

# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────

bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
hr()     { printf '%s\n' "────────────────────────────────────────────────────────────────────"; }

confirm() {
  local prompt="$1"
  local resp
  read -r -p "$(yellow "$prompt [y/N]: ")" resp
  case "$resp" in
    y|Y|yes|YES) return 0 ;;
    *) red "Aborted."; exit 1 ;;
  esac
}

# ────────────────────────────────────────────────────────────────────
# Step 1: Pre-flight
# ────────────────────────────────────────────────────────────────────

hr
bold "STEP 1 — Pre-flight checks"
hr

cd "$(git rev-parse --show-toplevel)"

# 1a. On main
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  red "ERROR: not on main (you're on $branch). Switch to main first."
  exit 1
fi
green "  ✓ On main branch"

# 1b. Clean working tree
if [ -n "$(git status --porcelain)" ]; then
  red "ERROR: working tree dirty. Commit or stash changes first."
  git status --short
  exit 1
fi
green "  ✓ Working tree clean"

# 1c. Up to date with origin
git fetch origin main --quiet
local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse origin/main)
if [ "$local_head" != "$remote_head" ]; then
  red "ERROR: local main is not up to date with origin/main."
  red "  local:  $local_head"
  red "  remote: $remote_head"
  red "Run 'git pull --ff-only' first."
  exit 1
fi
green "  ✓ Local main matches origin/main"

# 1d. CITATION.cff version matches
cff_version=$(grep -E '^version:' CITATION.cff | awk '{print $2}' | tr -d '"')
if [ "$cff_version" != "$VERSION" ]; then
  red "ERROR: CITATION.cff version ($cff_version) does not match expected ($VERSION)."
  red "Update CITATION.cff version field + push, then re-run."
  exit 1
fi
green "  ✓ CITATION.cff version = $VERSION"

# 1e. Release notes file exists
if [ ! -f "$RELEASE_NOTES" ]; then
  red "ERROR: release notes file not found: $RELEASE_NOTES"
  exit 1
fi
green "  ✓ Release notes file exists"

# 1f. gh CLI authenticated
if ! gh auth status > /dev/null 2>&1; then
  red "ERROR: gh CLI is not authenticated. Run 'gh auth login' first."
  exit 1
fi
green "  ✓ gh CLI authenticated"

# 1g. Sentry auth token present (used by the .github/workflows/release.yml
#     that fires post-tag; without it the release workflow will fail silently
#     and source maps won't upload).
if [ -z "${SENTRY_AUTH_TOKEN:-}" ] && [ -f "backend/.env" ]; then
  # shellcheck disable=SC1091
  SENTRY_AUTH_TOKEN=$(grep -E '^SENTRY_AUTH_TOKEN=' backend/.env | cut -d= -f2- | tr -d '"' || echo "")
fi
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  yellow "  ! WARNING: SENTRY_AUTH_TOKEN not set. Release will tag, but source maps won't upload."
  yellow "    Set SENTRY_AUTH_TOKEN in repository secrets so .github/workflows/release.yml can complete."
  confirm "Proceed anyway?"
else
  green "  ✓ SENTRY_AUTH_TOKEN present"
fi

# 1h. Tag must not already exist
if gh release view "$TAG" > /dev/null 2>&1; then
  red "ERROR: release $TAG already exists on GitHub."
  red "Either delete it ('gh release delete $TAG') or bump VERSION in this script."
  exit 1
fi
green "  ✓ Release tag $TAG does not exist yet"

# 1i. Peleg sign-off confirmation (HUMAN GATE)
hr
yellow "Peleg sign-off check"
bold "Has Dr. Peleg Ragonis-Bachar signed off on her monthly review of v$VERSION?"
yellow "(She receives a 'please test' email with 4 specific flows — see"
yellow " docs/internal/READY_TO_PUBLISH_CHECKLIST §C. Her sign-off is the"
yellow " gating event for publish.)"
confirm "Has Peleg confirmed v$VERSION is ready?"

# ────────────────────────────────────────────────────────────────────
# Step 2: Tag + GitHub release (mints Zenodo DOI within ~2 min)
# ────────────────────────────────────────────────────────────────────

hr
bold "STEP 2 — Create GitHub release"
hr

bold "About to create: $TAG titled '$RELEASE_TITLE'"
bold "Release notes: $RELEASE_NOTES"
confirm "Create the release?"

gh release create "$TAG" \
  --title "$RELEASE_TITLE" \
  --notes-file "$RELEASE_NOTES" \
  --target main \
  --verify-tag

green "  ✓ Release $TAG created"
green "  ✓ Zenodo will auto-mint DOI from this tag (configured at zenodo.org/settings/github)"
green "  ✓ .github/workflows/release.yml will upload Sentry source maps for this release"

# ────────────────────────────────────────────────────────────────────
# Step 3: Wait for Zenodo
# ────────────────────────────────────────────────────────────────────

hr
bold "STEP 3 — Wait for Zenodo to mint DOI"
hr

yellow "Zenodo typically takes 60-120 seconds after the release is published."
yellow "Open Zenodo in a browser:"
echo "  open https://zenodo.org/account/settings/github/"
echo ""
yellow "Wait for the new $TAG entry to appear with a DOI like '10.5281/zenodo.XXXXXXX'."
yellow "When you see it, copy the DOI (the part after '10.5281/zenodo.')."
echo ""
read -r -p "$(yellow 'Paste the Zenodo DOI (e.g. 10.5281/zenodo.12345678): ')" ZENODO_DOI

if [ -z "$ZENODO_DOI" ]; then
  red "ERROR: empty DOI. Aborting before patching CITATION + README."
  exit 1
fi

# basic sanity check
if [[ ! "$ZENODO_DOI" =~ ^10\.5281/zenodo\.[0-9]+$ ]]; then
  yellow "WARNING: DOI doesn't match expected pattern '10.5281/zenodo.<digits>'."
  confirm "Proceed with this value anyway?"
fi

green "  ✓ DOI captured: $ZENODO_DOI"

# ────────────────────────────────────────────────────────────────────
# Step 4 + 5: Patch CITATION + README, commit, push
# ────────────────────────────────────────────────────────────────────

hr
bold "STEP 4 — Patch CITATION.cff + README.md with the DOI"
hr

# CITATION.cff: replace 10.5281/zenodo.PENDING with the real DOI
sed -i.bak "s|10\.5281/zenodo\.PENDING|$ZENODO_DOI|g" CITATION.cff
rm -f CITATION.cff.bak
green "  ✓ Patched CITATION.cff"

# README: replace the DOI badge placeholder + the bibtex DOI
sed -i.bak "s|10\.5281/zenodo\.PENDING|$ZENODO_DOI|g" README.md
sed -i.bak "s|DOI--pending|DOI--$(echo "$ZENODO_DOI" | sed 's|/|%2F|g' | sed 's|\.|%2E|g')|g" README.md
rm -f README.md.bak
green "  ✓ Patched README.md"

git diff --stat CITATION.cff README.md
confirm "Commit these changes + push to main?"

git add CITATION.cff README.md
git commit -m "$(cat <<EOF
docs: wire Zenodo DOI $ZENODO_DOI for v$VERSION

Auto-generated by scripts/publish_v0_3_0.sh after the GitHub release
minted the Zenodo archive.

- CITATION.cff: 10.5281/zenodo.PENDING → $ZENODO_DOI
- README.md: DOI badge + BibTeX DOI updated

The release tag $TAG remains unchanged; this is the metadata follow-up.
EOF
)"

git push origin main

green "  ✓ DOI patch committed + pushed"

# ────────────────────────────────────────────────────────────────────
# Step 6 + 7: Open bio.tools + JOSS submission pages
# ────────────────────────────────────────────────────────────────────

hr
bold "STEP 5 — Open bio.tools + JOSS submission pages"
hr

yellow "Two browser tabs will open (use docs/active/A4_BIO_TOOLS_SUBMISSION.md + paper/paper.md as the source material):"
echo ""
echo "  1. bio.tools — https://bio.tools/contribute"
echo "     Paste packet content from docs/active/A4_BIO_TOOLS_SUBMISSION.md"
echo "     Include the DOI $ZENODO_DOI in 'Publications'"
echo ""
echo "  2. JOSS    — https://joss.theoj.org/papers/new"
echo "     Upload paper/paper.md + paper/paper.bib"
echo "     Repository URL: https://github.com/saidaz24-meet/peptide_prediction"
echo "     Software DOI: https://doi.org/$ZENODO_DOI"
echo ""

if command -v open >/dev/null 2>&1; then  # macOS
  confirm "Open both pages now?"
  open "https://bio.tools/contribute"
  open "https://joss.theoj.org/papers/new"
elif command -v xdg-open >/dev/null 2>&1; then  # linux
  confirm "Open both pages now?"
  xdg-open "https://bio.tools/contribute"
  xdg-open "https://joss.theoj.org/papers/new"
else
  yellow "Open these URLs in your browser:"
  echo "  https://bio.tools/contribute"
  echo "  https://joss.theoj.org/papers/new"
fi

# ────────────────────────────────────────────────────────────────────
# Step 8: Final status report
# ────────────────────────────────────────────────────────────────────

hr
bold "PUBLISH-DAY STATUS"
hr

echo "Release:        $TAG"
echo "Zenodo DOI:     $ZENODO_DOI"
echo "GitHub:         https://github.com/saidaz24-meet/peptide_prediction/releases/tag/$TAG"
echo "Sentry release: https://desycssb.sentry.io/releases/pvl@$VERSION/"
echo ""
green "Done. Watch the JOSS + bio.tools tabs for next steps."
echo ""
yellow "Don't forget to:"
yellow "  - Email Peleg, Alex, Landau that v$VERSION is published"
yellow "  - Update the project's Slack channel (if any)"
yellow "  - Check the live VPS at http://94.130.178.182:3000 to confirm deploy"
yellow "  - Monitor Sentry for the first 24h of post-publish error traffic"
