#!/usr/bin/env bash
# DESY landau-webapp-dev bootstrap for PVL.
#
# Run as root on a fresh Ubuntu 24.04 box. Safe to re-run.
#
# One-liner from the box:
#   curl -fsSL https://raw.githubusercontent.com/saidaz24-meet/peptide_prediction/wave-2.8/peleg-pdf-followups/scripts/desy_vm_bootstrap.sh | bash
#
# Stages:
#   1. Sanity (Ubuntu 24.04 + github reachable)
#   2. Install docker engine + compose plugin via the official repo
#   3. Clone the public PVL repo to /opt/pvl
#   4. Download S4PRED ensemble weights into /opt/pvl/tools/s4pred/models
#   5. Write a minimal .env.deploy
#   6. Build the backend image locally (NOT pull from registry — feature branch
#      isn't on ghcr yet)
#   7. Start backend container with the perf fix baked in
#   8. Validate the OMP/torch env vars are live in the container

set -euo pipefail

PVL_DIR=/opt/pvl
BRANCH=wave-2.8/peleg-pdf-followups
REPO_URL=https://github.com/saidaz24-meet/peptide_prediction.git
S4PRED_WEIGHT_URLS=(
  "http://bioinfadmin.cs.ucl.ac.uk/downloads/s4pred/weights_%d.pt"
  "https://github.com/psipred/s4pred/releases/download/v1.2.4/weights_%d.pt"
)

log() { printf '\n=== %s ===\n' "$*"; }

# ── 1. Sanity ─────────────────────────────────────────────────────────────
log "1/8 Sanity"
lsb_release -a 2>/dev/null || true
curl -sS -m 5 -o /dev/null -w "github.com reachable → HTTP %{http_code}\n" https://github.com/

# ── 2. Docker engine + compose plugin ─────────────────────────────────────
log "2/8 Install docker (idempotent)"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME=$(. /etc/os-release && printf '%s' "$VERSION_CODENAME")
  ARCH=$(dpkg --print-architecture)
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$ARCH" "$CODENAME" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker --version
docker compose version

# ── 3. Clone PVL ──────────────────────────────────────────────────────────
log "3/8 Clone PVL"
mkdir -p /opt
if [ ! -d "$PVL_DIR/.git" ]; then
  git clone "$REPO_URL" "$PVL_DIR"
fi
cd "$PVL_DIR"
git fetch --all --quiet
git checkout "$BRANCH"
git pull --ff-only

# ── 4. S4PRED weights ─────────────────────────────────────────────────────
log "4/8 S4PRED weights"
WEIGHTS_DIR=/opt/pvl/tools/s4pred/models
mkdir -p "$WEIGHTS_DIR"
for n in 1 2 3 4 5; do
  dest="$WEIGHTS_DIR/weights_${n}.pt"
  if [ -s "$dest" ]; then
    printf '  weights_%d.pt already present (%s bytes)\n' "$n" "$(stat -c%s "$dest")"
    continue
  fi
  ok=0
  for tpl in "${S4PRED_WEIGHT_URLS[@]}"; do
    url=$(printf "$tpl" "$n")
    printf '  → fetching %s\n' "$url"
    if curl -fL --connect-timeout 15 -o "$dest.tmp" "$url"; then
      mv "$dest.tmp" "$dest"
      ok=1
      break
    fi
    rm -f "$dest.tmp"
  done
  if [ "$ok" -ne 1 ]; then
    printf '\n⚠ Could not fetch weights_%d.pt from any mirror. Copy it manually to %s and re-run.\n' \
      "$n" "$dest"
    exit 1
  fi
done
ls -la "$WEIGHTS_DIR"

# ── 5. .env.deploy ────────────────────────────────────────────────────────
log "5/8 .env.deploy"
cat > "$PVL_DIR/.env.deploy" <<'ENV'
USE_TANGO=1
USE_S4PRED=1
TANGO_BINARY_PATH=/app/Tango/bin/tango
S4PRED_MODEL_PATH=/opt/tools/s4pred/models
ENVIRONMENT=production
CELERY_ENABLED=0
VECTOR_INDEX_ENABLED=0
CORS_ORIGINS=http://localhost,http://landau-webapp-dev
OMP_NUM_THREADS=1
MKL_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
VECLIB_MAXIMUM_THREADS=1
PVL_PERF_LOGS=1
NUMEXPR_NUM_THREADS=1
ENV
cat "$PVL_DIR/.env.deploy"

# ── 6. Build backend ──────────────────────────────────────────────────────
log "6/8 Build backend (from feature branch source)"
cd "$PVL_DIR"
docker compose -f docker/docker-compose.prod.yml --env-file .env.deploy build backend

# ── 7. Start backend container ────────────────────────────────────────────
log "7/8 Start backend"
docker rm -f pvl-backend-test 2>/dev/null || true
docker run -d --name pvl-backend-test \
  --env-file "$PVL_DIR/.env.deploy" \
  -p 8000:8000 \
  -v "$PVL_DIR/tools:/opt/tools:ro" \
  pvl-backend:latest \
  python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
sleep 8
docker ps --filter name=pvl-backend-test

# ── 8. Validate perf fix ──────────────────────────────────────────────────
log "8/8 Validate perf fix"
docker exec pvl-backend-test python -c "import torch; print('threads=', torch.get_num_threads(), 'interop=', torch.get_num_interop_threads())"
docker exec pvl-backend-test env | grep -E 'OMP|MKL|OPENBLAS|VECLIB|NUMEXPR'
echo
curl -sS -m 5 http://localhost:8000/api/health | head -30 || true

log "Done — backend container 'pvl-backend-test' running on :8000"
