#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 INPUT_FMT2.txt OUT_DIR"
  exit 1
fi

IN="$1"
OUT="$2"
mkdir -p "$OUT"

# Tango binary resolution (prefer Tango/bin/tango, else Tango/tango)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TANGO_BIN=""
if [[ -x "${SCRIPT_DIR}/bin/tango" ]]; then
  TANGO_BIN="${SCRIPT_DIR}/bin/tango"
elif [[ -x "${SCRIPT_DIR}/tango" ]]; then
  TANGO_BIN="${SCRIPT_DIR}/tango"
else
  echo "[TANGO_RUN] No tango binary found (expected Tango/bin/tango or Tango/tango)"
  exit 2
fi

# de-quarantine on macOS, ignore errors elsewhere
xattr -d com.apple.quarantine "$TANGO_BIN" >/dev/null 2>&1 || true
chmod +x "$TANGO_BIN" || true

# Process each line of fmt2
# Columns: id nt ct pH te io tf seq
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  id=$(echo "$line" | awk '{print $1}')
  seq=$(echo "$line" | awk '{for (i=8;i<=NF;i++) printf $i""FS; print ""}' | sed 's/[[:space:]]//g')

  # prepare a single-input file for this peptide (fmt2 again)
  tmp="${SCRIPT_DIR}/work/single_input.txt"
  echo "$line" > "$tmp"

  # Run tango in interactive file mode: “Y” (per-residue) + input filename
  # NOTE: tango writes to stdout; we capture it per peptide.
  set +e
  ( printf "Y\n%s\n" "work/single_input.txt" | "$TANGO_BIN" ) > "${OUT}/${id}.txt" 2>/dev/null
  rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    echo "[TANGO_RUN] ${id}: tango exited with code $rc"
  fi
done < "$IN"
