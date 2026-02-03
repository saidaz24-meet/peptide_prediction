# Docker Runbook - Peptide Visual Lab

This document explains how to run PVL in Docker for development and production.

## Asset Strategy: Volume-Mounted (Strategy A)

Tool assets (S4PRED models, TANGO binary) are **mounted at runtime**, not baked into images.

**Benefits:**
- Small images (~200MB vs ~2GB)
- Fast rebuilds (no re-downloading assets)
- Easy model updates without rebuilding
- Reproducible deployments

---

## Quick Start

### Prerequisites

- Docker 20.10+ with Compose V2
- BuildKit enabled (default in modern Docker)

### Development Mode

```bash
# Build and start
make docker-build
make docker-up

# Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/api/health

# Verify everything works
make docker-smoke

# View logs
make docker-logs

# Stop
make docker-down
```

### Production Mode

```bash
# Create tools directory with assets (see below)
mkdir -p ./tools/tango/bin ./tools/s4pred/models

# Set environment variables
export TOOLS_HOST_PATH=./tools
export USE_TANGO=1
export USE_S4PRED=1

# Start production stack
docker compose -f docker/docker-compose.prod.yml up -d

# Access at http://localhost (port 80)
```

---

## Volume Structure

```
/data/runs        # Prediction run outputs (persisted)
/data/uploads     # Uploaded files (persisted)
/opt/tools        # Mounted tool assets (read-only in prod)
/app/.run_cache   # Runtime cache (can be ephemeral)
```

---

## Tool Asset Setup

### Option 1: Named Docker Volume (Development)

For development, tools are stored in a Docker named volume:

```bash
# Create the volume
docker volume create pvl-tools

# Copy TANGO binary into volume
docker run --rm -v pvl-tools:/opt/tools -v $(pwd)/backend/Tango:/src alpine \
  sh -c "mkdir -p /opt/tools/tango/bin && cp /src/bin/tango /opt/tools/tango/bin/"

# Copy S4PRED models into volume
docker run --rm -v pvl-tools:/opt/tools -v $(pwd)/path/to/s4pred:/src alpine \
  sh -c "mkdir -p /opt/tools/s4pred && cp -r /src/models /opt/tools/s4pred/"
```

### Option 2: Host Directory (Production)

For production, mount a host directory:

```bash
# Create directory structure
mkdir -p ./tools/tango/bin
mkdir -p ./tools/s4pred/models

# Place your assets
cp /path/to/tango ./tools/tango/bin/tango
chmod +x ./tools/tango/bin/tango
cp -r /path/to/s4pred/models/* ./tools/s4pred/models/

# Set in docker-compose.prod.yml or environment
export TOOLS_HOST_PATH=./tools
```

### Directory Structure

```
tools/
├── tango/
│   └── bin/
│       └── tango          # TANGO binary (executable)
└── s4pred/
    └── models/
        ├── model.pt       # S4PRED model weights
        └── config.json    # Model configuration
```

---

## Environment Variables

### Required for Production

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_TANGO` | Enable TANGO predictions | `0` |
| `USE_S4PRED` | Enable S4PRED predictions | `1` |
| `TOOLS_HOST_PATH` | Host path to tools directory | `./tools` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry error tracking DSN | (empty) |
| `LOG_LEVEL` | Logging level | `INFO` (prod), `DEBUG` (dev) |

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `make docker-build` | Build images with BuildKit |
| `make docker-up` | Start dev containers |
| `make docker-down` | Stop containers |
| `make docker-smoke` | Run smoke tests |
| `make docker-logs` | Tail logs |
| `make docker-clean` | Remove all PVL resources |
| `make docker-prod-up` | Start production stack |
| `make docker-prod-down` | Stop production stack |

---

## Health Checks

Both services have built-in health checks:

```bash
# Backend
curl http://localhost:8000/api/health

# Frontend
curl http://localhost:3000/health
```

---

## Troubleshooting

### Backend won't start

1. Check logs: `docker compose -f docker/docker-compose.yml logs backend`
2. Verify health: `docker compose exec backend curl localhost:8000/api/health`
3. Check tool paths: Ensure `/opt/tools` contains expected files

### Frontend can't reach backend

1. Check backend health first
2. Verify nginx config proxies `/api/` correctly
3. Check CORS_ORIGINS includes frontend URL

### S4PRED/TANGO not working

1. Check provider is enabled: `USE_S4PRED=1` or `USE_TANGO=1`
2. Verify tool files exist in `/opt/tools`:
   ```bash
   docker compose exec backend ls -la /opt/tools/
   ```
3. Check backend logs for tool errors

### Permission errors

If running on Linux with different UID/GID:
```bash
# Build with matching UID/GID
docker compose build --build-arg APP_UID=$(id -u) --build-arg APP_GID=$(id -g)
```

---

## Image Sizes

With volume-mounted strategy (Strategy A):

| Image | Size |
|-------|------|
| pvl-backend | ~250MB |
| pvl-frontend | ~25MB |

---

## Reproducibility

Each run logs tool versions and asset hashes in `run_meta`:

```json
{
  "run_id": "abc123",
  "tools": {
    "tango": {
      "version": "2.3.1",
      "binary_hash": "sha256:..."
    },
    "s4pred": {
      "model_hash": "sha256:..."
    }
  }
}
```

To ensure reproducibility:
1. Pin tool versions in your `tools/` directory
2. Track `tools/` checksums in version control or artifact registry
3. Use specific image tags in production (not `:latest`)
