# PVL Deployment Guide & Specification

**Last Updated**: 2026-03-01
**Audience**: Said deploying PVL on the DESY VM

---

## Quick Reference

```bash
# On the VM — full production deployment:
DOMAIN=pvl.desy.de docker compose -f docker/docker-compose.caddy.yml up -d --build

# Check status:
docker compose -f docker/docker-compose.caddy.yml ps
docker compose -f docker/docker-compose.caddy.yml logs -f backend

# Restart after code changes:
docker compose -f docker/docker-compose.caddy.yml up -d --build
```

---

## VM Specification

PVL is a FastAPI + React web application with two external predictors (S4PRED neural network, TANGO binary). The system is **I/O-bound and memory-bound**, not CPU-bound.

| Resource | Recommended | Minimum Viable | Justification |
|----------|-------------|----------------|---------------|
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 | Better Docker/K8s ecosystem |
| **CPU** | 4 cores | 2 cores | S4PRED inference + TANGO subprocess + uvicorn |
| **Memory** | 8 GB | 4 GB | S4PRED model (~800MB RSS) + DataFrames + OS |
| **Disk** | 100 GB | 50 GB | Docker images + tools + run cache + logs |
| **Network** | DMZ (external) | DMZ | UniProt API access + user-facing HTTPS |

### Memory Budget (8 GB total)

| Component | Resident Memory | Notes |
|-----------|----------------|-------|
| OS + system services | ~500 MB | Ubuntu minimal |
| Docker daemon | ~200 MB | Container management |
| Backend container (idle) | ~150 MB | Python + FastAPI + deps |
| S4PRED model loaded | ~800 MB | 5 ensemble models, PyTorch CPU tensors |
| TANGO binary (during run) | ~50-100 MB | Transient, per-batch |
| DataFrame processing (peak) | ~200-500 MB | Depends on batch size |
| Frontend container (nginx) | ~20 MB | Static file serving |
| Caddy reverse proxy | ~30 MB | TLS + proxy |
| **Total (peak)** | **~2.0-2.3 GB** | Leaves ~5.7 GB headroom |

### Performance Expectations

| Batch Size | S4PRED Time | TANGO Time | Total (estimated) |
|------------|-------------|------------|-------------------|
| 1 peptide | ~1s | ~2s | ~3-5s |
| 10 peptides | ~5s | ~15s | ~20-30s |
| 100 peptides | ~30s | ~2 min | ~3-4 min |
| 1000 peptides | ~5 min | ~20 min | ~25-30 min |

Current bottleneck is TANGO (~2-5s per peptide, sequential). For >5 concurrent users, increase workers:
```bash
# In docker-compose.caddy.yml, change backend command:
command: ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

**Current limitation**: `--workers 1` (single-process). Each additional worker adds ~800MB for S4PRED model.

---

## Architecture

```
Internet
    │
    ▼
[Caddy :80/:443]  ── auto-HTTPS via Let's Encrypt
    │
    ├── /api/*  →  [Backend :8000]  ── FastAPI + S4PRED + TANGO
    │                    │
    │                    ├── /opt/tools/s4pred/models/  (volume mount)
    │                    └── /opt/tools/tango/bin/       (volume mount)
    │
    └── /*      →  [Static files /srv]  ── Built React app
```

Three containers:
1. **pvl-backend** — FastAPI + uvicorn (1 worker)
2. **pvl-caddy** — Caddy reverse proxy + static file server
3. **pvl-frontend-builder** — Builds React app, copies to shared volume, exits

---

## Step-by-Step VM Deployment

### 1. Prerequisites

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in for group change

docker --version          # >= 24.x
docker compose version    # >= 2.x
```

### 2. Clone the Repository

```bash
cd /opt
sudo mkdir pvl && sudo chown $USER:$USER pvl
git clone https://github.com/<your-org>/peptide-prediction.git pvl
cd pvl
```

### 3. Set Up Tool Assets

S4PRED weights and TANGO binaries live outside the Docker image (volume-mounted).

```bash
sudo mkdir -p /opt/pvl-tools
scp -r tools/s4pred tools/tango user@vm:/opt/pvl-tools/
ssh user@vm "chmod +x /opt/pvl-tools/tango/bin/tango_linux_x86_64"
```

Verify the structure:
```
/opt/pvl-tools/
├── s4pred/models/
│   ├── weights_1.pt           (86 MB)
│   ├── weights_2.pt           (86 MB)
│   ├── weights_3.pt           (86 MB)
│   ├── weights_4.pt           (86 MB)
│   └── weights_5.pt           (86 MB)
└── tango/bin/
    ├── tango_linux_x86_64     (211 KB, used by Docker)
    ├── tango_darwin_x86_64    (961 KB, macOS)
    ├── tango_linux_i386       (191 KB, fallback)
    └── tango_win32.exe        (332 KB, Windows)
```

**Binary resolution**: `_resolve_tango_bin()` checks: `TANGO_BINARY_PATH` env var → platform-specific binary in `tools/tango/bin/` → legacy fallback → system PATH.

### 4. Create Production .env

```bash
cat > .env << 'EOF'
DOMAIN=pvl.desy.de
USE_TANGO=1
USE_S4PRED=1
TOOLS_HOST_PATH=/opt/pvl-tools
SENTRY_DSN=
VITE_SENTRY_DSN=
EOF
```

### 5. Open Firewall Ports

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### 6. DNS Record

Ask DESY IT: "Create DNS A record `pvl.desy.de → <VM IP>`". Caddy auto-provisions Let's Encrypt certificates once DNS resolves.

### 7. Deploy

```bash
cd /opt/pvl
DOMAIN=pvl.desy.de docker compose -f docker/docker-compose.caddy.yml up -d --build
docker compose -f docker/docker-compose.caddy.yml logs -f
```

### 8. Verify

```bash
curl -s https://pvl.desy.de/api/health | python3 -m json.tool
curl -s https://pvl.desy.de/api/health/dependencies | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}" https://pvl.desy.de/   # Should return 200
```

---

## Common Operations

```bash
# Update code
git pull origin main && docker compose -f docker/docker-compose.caddy.yml up -d --build

# View logs
docker compose -f docker/docker-compose.caddy.yml logs -f backend
docker compose -f docker/docker-compose.caddy.yml logs --tail=100 backend

# Restart a service
docker compose -f docker/docker-compose.caddy.yml restart backend

# Resource usage
docker stats --no-stream

# Clean up old images
docker image prune -f
```

---

## Monitoring

```bash
# Docker health check (every 30s, already configured)
docker inspect pvl-backend --format='{{.State.Health.Status}}'

# Dependencies check
curl -s https://pvl.desy.de/api/health/dependencies | jq .

# Simple uptime cron (add to crontab -e):
*/5 * * * * curl -sf https://pvl.desy.de/api/health > /dev/null || echo "PVL DOWN at $(date)" >> /var/log/pvl-health.log
```

| Tool | Purpose | Priority |
|------|---------|----------|
| **Sentry** (free tier) | Error tracking, alerts | HIGH |
| Docker logs | Application logs | Built-in |
| Uptime check (cron + curl) | Availability | HIGH |
| Prometheus + node_exporter | System metrics (future) | MEDIUM |

---

## Troubleshooting

### Caddy Can't Get TLS Certificate
- DNS not pointing to VM → check `dig pvl.desy.de`
- Ports 80/443 blocked → check `sudo ufw status`
- Workaround: use `DOMAIN=localhost` for HTTP-only until DNS is ready

### Backend Won't Start
```bash
docker compose -f docker/docker-compose.caddy.yml logs backend
```
- `ModuleNotFoundError` → Image needs rebuild: `--build`
- `S4PRED weights not found` → Check `/opt/pvl-tools/s4pred/models/` has `weights_*.pt`
- `Permission denied` → Container runs as user `pvl` (UID 1000). Check volume permissions.

### TANGO Not Working
```bash
docker compose -f docker/docker-compose.caddy.yml exec backend ls -la /opt/tools/tango/bin/tango_linux_x86_64
docker compose -f docker/docker-compose.caddy.yml exec backend file /opt/tools/tango/bin/tango_linux_x86_64
```
- `Mach-O` = wrong binary → check `TANGO_BINARY_PATH`
- `Permission denied` → `chmod +x` on host
- System still works without TANGO (S4PRED + FF-Helix + biochem all work)

---

## Things to Do Outside the Codebase

### Sentry Error Tracking
Code already has Sentry integration. You just need DSN values:
1. https://sentry.io → Create Python + JavaScript projects
2. Copy DSNs to `.env` as `SENTRY_DSN` and `VITE_SENTRY_DSN`
3. Redeploy

**Note**: Existing dev DSN (`o4510730454499328.ingest.de.sentry.io`) can be reused — add `ENVIRONMENT=production` to differentiate.

### Zenodo DOI
1. https://zenodo.org → Log in with GitHub → Enable repo
2. Create GitHub release (`v1.0.0`) → Zenodo mints DOI automatically
3. Update `CITATION.cff` with DOI

### bio.tools Registration
1. https://bio.tools/register → Fill in: PVL, homepage URL, EDAM topic (topic_0121: Proteomics), operation (operation_2479)
2. Submit — appears in ELIXIR registry within days

### GitHub Repository (Before Going Public)
- [ ] `LICENSE` file (MIT)
- [ ] Repository visibility → Public
- [ ] Topics: `peptide`, `bioinformatics`, `aggregation`, `secondary-structure`, `visualization`
- [ ] Create release (`v1.0.0`) — triggers Zenodo

---

## Risk Assessment

| SPOF | Impact | Mitigation |
|------|--------|-----------|
| Single VM | Total outage | Acceptable for Phase 1. DESY K8s (confirmed) provides HA. |
| Single uvicorn worker | Request queuing | Increase to 2-4 workers (costs ~800MB RAM each) |
| TANGO binary crash | Degraded (no aggregation) | Graceful fallback: biochem + S4PRED still work |
| S4PRED model load failure | Degraded (no SS prediction) | Graceful fallback: biochem still works |
| Disk full | Service crash | Monitor disk, rotate logs, clean `.run_cache` |

| Scaling Trigger | Upgrade Action |
|-----------------|----------------|
| Concurrent users > 5 | Increase `--workers` to 2-4 (needs 12-16 GB RAM) |
| Response time > 60s for small batches | Add workers or async queue |
| Disk > 80% | Expand disk or add cleanup cron |
| Memory > 90% sustained | Upgrade to 16 GB VM |

---

## Deployment Checklist

- [ ] VM provisioned (Ubuntu 24.04, 4 cores, 8GB RAM, 100GB disk)
- [ ] Docker installed
- [ ] S4PRED weights at `/opt/pvl-tools/s4pred/models/`
- [ ] TANGO Linux binary at `/opt/pvl-tools/tango/bin/` (chmod +x)
- [ ] `.env` created (DOMAIN, USE_TANGO, USE_S4PRED, TOOLS_HOST_PATH)
- [ ] DNS A record: `pvl.desy.de → VM IP`
- [ ] Firewall: ports 80, 443, 22 open
- [ ] `docker compose -f docker/docker-compose.caddy.yml up -d --build`
- [ ] `curl https://pvl.desy.de/api/health` returns 200
- [ ] Sentry DSN added
- [ ] Zenodo linked (after first release)
- [ ] bio.tools registration (after live URL)

---

## Kubernetes Deployment (Long-Term — Awaiting DESY Details)

**Status**: Confirmed as long-term deployment target (2026-02-22). Helm chart parked until DESY provides cluster details.

### What DESY Needs to Provide
- K8s namespace allocation
- Ingress Controller type (nginx-ingress, Traefik, etc.)
- Container registry access (GHCR pull OK, or internal?)
- Resource quotas, persistent volume provisioner
- cert-manager availability, network policies

### What PVL Already Has (K8s-Ready)
- OCI-compliant Docker images
- Health check endpoints (`/api/health`, `/api/health/dependencies`)
- Resource limits defined (2 CPU / 4GB backend, 0.5 CPU / 256MB frontend)
- All config via environment variables
- Graceful degradation (works without TANGO or S4PRED)

### Key Differences from VM
| Aspect | VM (Docker Compose) | K8s |
|--------|-------------------|-----|
| Reverse proxy | Caddy (our config) | DESY Ingress Controller |
| TLS | Caddy auto-provisions | cert-manager (cluster-level) |
| Scaling | Single worker, manual | HPA (Horizontal Pod Autoscaler) |
| Tool assets | Host volume mount | PersistentVolumeClaim |
| Config | `.env` file | ConfigMap + Secret |

---

## Phase 2: Precomputed Proteome Database (Future)

**When**: After paper, when user demand justifies complexity.

| Resource | Phase 1 (Current) | Phase 2 (Hybrid) |
|----------|-------------------|-------------------|
| VM Spec | 4 cores, 8 GB, 100 GB | 8 cores, 16 GB, 500 GB |
| Complexity | Docker Compose | + PostgreSQL + Redis + CronJob |
| User Experience | Seconds-minutes | Milliseconds for cached |

Top 10 organisms (~101K reviewed sequences) = ~12-15 hours compute, ~2.5 GB storage.
Full proteome (250M TrEMBL sequences) requires cluster (DESY K8s).
