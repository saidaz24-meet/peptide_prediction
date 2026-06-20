#!/usr/bin/env bash
# Capture a per-stage perf trace for ONE peptide via the PVL backend.
#
# Set up:
#   1. The backend container must be running with PVL_PERF_LOGS=1 set.
#      Easiest path:
#          docker compose -f docker/docker-compose.prod.yml stop backend
#          # Add `- PVL_PERF_LOGS=1` to the `environment:` block of
#          # docker/docker-compose.prod.yml AND/OR pass via .env.deploy.
#          docker compose -f docker/docker-compose.prod.yml up -d backend
#   2. This script just fires one curl and tails the matching log lines.
#
# Usage:
#   ./scripts/perf_trace.sh                              # default: Uperin 3.5
#   ./scripts/perf_trace.sh GIGAVLKVLTTGLPALISWIKRKRQQ   # custom sequence
#   ./scripts/perf_trace.sh GIGAVL... 5                  # custom seq, 5 runs
#
# Output is grouped by run, showing:
#   - per-stage elapsed_ms (perf.cache_lookup, perf.tango, perf.s4pred, ...)
#   - total request elapsed_ms (request_end)

set -euo pipefail

SEQ=${1:-GVGDLIRKAVSVIKNIV}
ENTRY=${ENTRY:-Uperin-3.5}
RUNS=${2:-3}
HOST=${PVL_HOST:-http://localhost:8000}
CONTAINER=${PVL_CONTAINER:-pvl-backend}

# Are we on the host that runs the container? If so, tail docker logs.
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  TAIL="docker logs --since 1s -f $CONTAINER"
else
  TAIL=""
fi

for i in $(seq 1 "$RUNS"); do
  echo
  echo "════════════════════════ run $i / $RUNS ════════════════════════"
  echo "  sequence: $SEQ  (entry: $ENTRY, length: ${#SEQ})"
  echo

  if [ -n "$TAIL" ]; then
    # Start log tail in background, capture pid so we can kill it.
    ($TAIL 2>&1 | grep --line-buffered -E '"event": "(perf\.|request_end|request_start)"' | head -25 &)
    TAIL_PID=$!
  fi

  t0=$(date +%s%N)
  curl -sS -X POST "$HOST/api/predict" \
    -F "sequence=$SEQ" \
    -F "entry=$ENTRY" \
    -o /tmp/perf_trace_run_$i.json \
    -w '\n  client-side: HTTP %{http_code}  total=%{time_total}s  ttfb=%{time_starttransfer}s\n'
  t1=$(date +%s%N)

  if [ -n "$TAIL" ]; then
    sleep 1   # give the log tail time to flush
    kill "$TAIL_PID" 2>/dev/null || true
  fi

  echo
  size=$(stat -c%s /tmp/perf_trace_run_$i.json 2>/dev/null || stat -f%z /tmp/perf_trace_run_$i.json 2>/dev/null || echo "?")
  echo "  response: ${size} bytes saved to /tmp/perf_trace_run_$i.json"
done

echo
echo "Done. To compare timings across runs:"
echo "  jq '.row.id, .meta.runId, .meta.providerStatus' /tmp/perf_trace_run_*.json"
