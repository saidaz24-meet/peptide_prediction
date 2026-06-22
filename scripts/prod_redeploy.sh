#!/usr/bin/env bash
# scripts/prod_redeploy.sh
#
# Full prod redeploy: rebuild + recreate BOTH backend and frontend
# containers, plus celery workers. Use this after `git pull` to push
# code changes (backend + UI + perf fixes) live to the public site.
#
# This is the script you actually want for the public-facing stack.
# `desy_perf_redeploy.sh` only touched `pvl-backend-test` — that's a
# side-car perf instrumentation container, NOT what users hit. When
# you saw the UI on 94.130.178.182:3000 looking stale even after a
# backend rebuild, that's because the frontend container was untouched.
# This script rebuilds everything users actually see.
#
# Usage (on the host where docker compose lives):
#   cd /opt/pvl
#   bash scripts/prod_redeploy.sh
#
# Idempotent. Safe to re-run. About 2-4 min total.

set -euo pipefail

PVL_DIR=${PVL_DIR:-/opt/pvl}
cd "$PVL_DIR"

COMPOSE="docker compose -f docker/docker-compose.prod.yml"

echo "=========================================="
echo "  PVL prod redeploy"
echo "  branch:  $(git rev-parse --abbrev-ref HEAD)"
echo "  HEAD:    $(git rev-parse --short HEAD)"
echo "  message: $(git log -1 --pretty=%s | head -c 80)"
echo "=========================================="

echo
echo "→ Step 1/4: rebuild backend image"
$COMPOSE build backend

echo
echo "→ Step 2/4: rebuild frontend image"
$COMPOSE build frontend

echo
echo "→ Step 3/4: recreate containers (backend, frontend, celery workers)"
# --force-recreate ensures the new images are picked up even if the
# container spec didn't change. --no-deps avoids recreating redis,
# which is stateful and doesn't need to bounce.
$COMPOSE up -d --no-deps --force-recreate \
  backend \
  frontend \
  celery-batch \
  celery-quick

echo "  waiting 15s for healthchecks to settle..."
sleep 15

echo
echo "→ Step 4/4: smoke checks"
$COMPOSE ps backend frontend celery-batch celery-quick

echo
echo "  backend health:"
docker exec pvl-backend curl -fsSL http://localhost:8000/api/health 2>/dev/null \
  | head -1 || echo "    (health endpoint not yet responding)"

echo
echo "  perf env vars on backend container:"
docker exec pvl-backend env 2>/dev/null \
  | grep -E '^(OMP|MKL|OPENBLAS|VECLIB|NUMEXPR)_NUM_THREADS|^PVL_PERF_LOGS|^TANGO_BINARY_PATH' \
  | sort

echo
echo "  TANGO binary at the configured path:"
docker exec pvl-backend ls -la "$(docker exec pvl-backend printenv TANGO_BINARY_PATH)" 2>/dev/null \
  || echo "    (TANGO_BINARY_PATH not set or file missing — check docker-compose.prod.yml env)"

echo
echo "=========================================="
echo "  Done. Public URL: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo "=========================================="
