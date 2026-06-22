#!/usr/bin/env bash
# scripts/open_peleg_issues.sh
#
# M9 from MEETING_2026_06_18.md — turn the still-open items in
# PELEG_NOTES_2026_06_18.md into trackable GitHub Issues.
#
# Why: 30 commits closed ~64 PELEG items in flight. The remaining ~8 active
# items are spread across Cowork + T3 + open questions. Without Issues we
# can't link PRs ←→ items, and Said keeps re-discovering the same backlog.
#
# This script is INTENTIONALLY interactive — you review each draft Issue
# before it's filed. No blast-create.
#
# Usage:
#   bash scripts/open_peleg_issues.sh           # interactive prompt per item
#   bash scripts/open_peleg_issues.sh --dry     # print drafts, do not file
#
# Requires: gh (logged in), bash, sed, awk.

set -euo pipefail

REPO=${REPO:-saidaz24-meet/peptide_prediction}
MILESTONE=${MILESTONE:-Wave 2.9}
DRY=0
for arg in "$@"; do
  case "$arg" in
    --dry|--dry-run) DRY=1 ;;
  esac
done

# ──────────────────────────────────────────────────────────────────────
# The 8 items in active flight, plus the 8 OQs.
# Format: ID | Title | Section | Labels (comma) | Body (heredoc tag)
# ──────────────────────────────────────────────────────────────────────

emit_issue() {
  local id="$1"
  local title="$2"
  local labels="$3"
  local body="$4"

  echo "────────────────────────────────────────────"
  echo "  $id — $title"
  echo "  labels: $labels"
  echo "────────────────────────────────────────────"
  echo "$body" | head -10
  echo "  ..."
  echo

  if [ "$DRY" = "1" ]; then
    return
  fi

  read -r -p "Open this Issue? [y/N/q] " ans
  case "$ans" in
    y|Y)
      gh issue create \
        --repo "$REPO" \
        --title "[$id] $title" \
        --body "$body" \
        --label "$labels" \
        --milestone "$MILESTONE"
      ;;
    q|Q)
      echo "stopping"
      exit 0
      ;;
    *)
      echo "  skipped"
      ;;
  esac
}

PELEG_DOC="docs/active/PELEG_NOTES_2026_06_18.md"

# ── ACTIVE FLIGHT ────────────────────────────────────────────────────

emit_issue "Q7" "Residue coloring — Helix / SSW / Coil from pipeline (not raw S4PRED)" \
  "peleg-pdf,frontend,blocked-on-OQ1" \
  "Per PELEG_NOTES Q7 (PDF1 p2 + p19): the sequence-display residue colors
should come from the pipeline-derived 3-class (Helix / SSW / Coil), not the
raw S4PRED H/E/C states.

**Blocked on OQ1** — Peleg's note 'Colid-coil' is a typo. Need her to confirm
whether she means 3-state coil (irregular C) or 'coiled-coil' motif (two-helix
wrap). The visual is different.

Source: $PELEG_DOC §Q7."

emit_issue "Q11" "Quick Analyze biochem block — clickable database tabs" \
  "peleg-pdf,frontend,cowork" \
  "Per PELEG_NOTES Q11 (PDF1 p20): the Biochemical feature comparison block
on Quick Analyze should expose 2-3 reference databases as clickable tabs
(default: Peleg-118 fibril-validated; UniProt short peptides) instead of an
implicit single 'database'.

Cowork prompt has been dispatched. Track here for the PR link.

Source: $PELEG_DOC §Q11."

emit_issue "Q13-Q17" "TANGO panel rework — line view, toggle row, label dashed line, helix series, distinct agg color" \
  "peleg-pdf,frontend,cowork" \
  "Per PELEG_NOTES Q13–Q17 (PDF1 p22-23): refresh the TANGO Aggregation
panel — switchable line-graph view, unified hide/show toggle row above
both plots, label the y=0.5 dashed line, add a TANGO helix series in the
overlay, pick an aggregation series color distinct from helix-blue +
beta-orange.

Cowork prompt dispatched. OQ3 (color preference) + OQ4 (y=0.5 meaning)
gate the final visual.

Source: $PELEG_DOC §Q13–§Q17."

emit_issue "B7-M4" "NDJSON streaming UI hook — progressive batch results" \
  "peleg-pdf,frontend,backend-done,cowork" \
  "T3 already shipped the backend NDJSON endpoint. Need the frontend hook
that subscribes and renders rows as they arrive instead of waiting for the
full batch response. Unlocks the perceived-speed win on 1,000+ peptide
runs.

Source: PELEG_NOTES §B7 + MEETING_2026_06_18 M3/M4."

emit_issue "B16" "Mol* SSW residue overlay toggle in 3D viewer" \
  "peleg-pdf,frontend,cowork" \
  "Per PELEG_NOTES B16 (PDF2 + meeting): when viewing a peptide's 3D
structure, toggling 'Show SSW residues' should overlay magenta on the
residues flagged as secondary structure switches.

Mol* config + magenta color (#E040FB) already chosen. Cowork prompt
dispatched.

Source: $PELEG_DOC §B16."

emit_issue "B20" "Peleg-118 as built-in cohort comparison option" \
  "peleg-pdf,frontend,cowork" \
  "Per PELEG_NOTES B20 (PDF2): one-click 'Compare against Peleg-118
fibril-forming dataset' from the Compare page. The dataset itself is
already in the repo at
backend/data/reference_datasets/peleg_118_fibril_validated.json.

Cowork prompt dispatched. Wired to the multi-DB tabs work (Q11) — same
data path.

Source: $PELEG_DOC §B20."

emit_issue "E4" "Export header — method line ('Method = TANGO + S4PRED + FF-Helix')" \
  "peleg-pdf,backend,t3" \
  "Per PELEG_NOTES E4 (PDF1 + PDF2): every CSV / XLSX export should
include a comment-style header line declaring the predictor stack used,
so reviewers can verify the analysis was run with the expected providers.

T3 owns the implementation. Format will look like:
    # Method = TANGO + S4PRED + FF-Helix
    # PVL version = 0.3.0
    # Thresholds = {...}
    # Exported at = 2026-06-22T22:00Z

Source: $PELEG_DOC §E4."

# ── OPEN QUESTIONS (for the Peleg sync, not auto-shippable) ──────────

for oq_pair in \
  "OQ1|Coiled-coil terminology — 3-state coil or coiled-coil motif?|PDF1 p2, p19" \
  "OQ2|'Rank & Merge' — what does Merge mean to the user?|PDF1 p8" \
  "OQ3|Aggregation series color preference (red / magenta / other)|PDF1 p23" \
  "OQ4|y=0.5 dashed line in Aggregation-Structure Overlay — what does it mean?|PDF1 p23" \
  "OQ5|SSW residue color in Mol* 3D viewer — amber or other?|meeting + PDF2" \
  "OQ6|Hide-show options unified — single row above both plots, or per-plot under title?|PDF1 p23" \
  "OQ7|Beta % calculation flagged 'too aggressive' (F10) — desired threshold?|Wave 2.5 Likoiim" \
  "OQ8|'AlphaFold-predicted structure' title — approved 2026-06-03 OR delete per 2026-06-18 meeting?|PDF1 + meeting"; do
  IFS='|' read -r oq_id oq_q oq_src <<< "$oq_pair"
  emit_issue "$oq_id" "[Peleg sync] $oq_q" \
    "peleg-pdf,peleg-sync,blocked" \
    "Blocked on Peleg's answer at the next sync.

**Question**: $oq_q
**Source**: $oq_src

Once resolved, this Issue gets closed and the implementation issue (if any)
moves to active flight."
done

echo
echo "Done. Open Issues with --milestone='$MILESTONE'."
