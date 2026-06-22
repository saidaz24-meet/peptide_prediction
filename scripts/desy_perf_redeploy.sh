#!/usr/bin/env bash
# desy_perf_redeploy.sh — restart pvl-backend-test with PVL_PERF_LOGS=1
# and fire 3 Quick Analyze runs.
#
# Designed for the DESY landau-webapp-dev VM where bootstrap has already
# put /opt/pvl, docker, and pvl-backend:latest in place.
#
# Said's SSH terminal wraps long docker commands across lines and breaks
# them. This script keeps each shell command short enough to survive
# any pasting, but only the script itself is run — no pasting risk for
# the actual docker invocation.
#
# Usage (from inside /opt/pvl or anywhere with PVL_DIR set):
#   bash scripts/desy_perf_redeploy.sh

set -euo pipefail

PVL_DIR=${PVL_DIR:-/opt/pvl}
cd "$PVL_DIR"

echo "=== 1. Ensure PVL_PERF_LOGS=1 + correct TANGO_BINARY_PATH in .env.deploy ==="
grep -q '^PVL_PERF_LOGS=' .env.deploy 2>/dev/null \
  || echo "PVL_PERF_LOGS=1" >> .env.deploy

# PVL-perf-05: point TANGO at the volume-mounted Linux ELF binary, NOT the
# Mach-O macOS binary baked into the image at /app/Tango/bin/tango.
# Re-writing in place to be idempotent.
sed -i '/^TANGO_BINARY_PATH=/d' .env.deploy 2>/dev/null || true
echo "TANGO_BINARY_PATH=/opt/tools/tango/bin/tango_linux_x86_64" >> .env.deploy

grep -E 'PVL_PERF_LOGS|TANGO_BINARY_PATH' .env.deploy

echo
echo "=== 2. Remove old pvl-backend-test container (if any) ==="
docker rm -f pvl-backend-test 2>/dev/null || true

echo
echo "=== 3. Start backend container ==="
docker run -d \
  --name pvl-backend-test \
  --env-file "$PVL_DIR/.env.deploy" \
  -p 8000:8000 \
  -v "$PVL_DIR/tools:/opt/tools:ro" \
  pvl-backend:latest \
  python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

echo "  waiting 12s for startup..."
sleep 12

docker ps --filter name=pvl-backend-test

echo
echo "=== 4. Fire 3 Quick Analyze runs ==="
for i in 1 2 3; do
  echo "--- run $i ---"
  curl -sS -X POST http://localhost:8000/api/predict \
    -F sequence=GVGDLIRKAVSVIKNIV \
    -F entry="Uperin-$i" \
    -o "/tmp/qa_$i.json" \
    -w "  HTTP %{http_code}  total=%{time_total}s\n"
done

echo
echo "=== 5. Per-stage perf logs (copy this whole block to Said's chat) ==="
docker logs pvl-backend-test 2>&1 \
  | grep -E '"perf\.|"request_end"|"preload_' \
  | tail -80
