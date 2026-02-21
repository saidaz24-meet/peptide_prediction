# PVL Deployment Guide

**Last Updated**: 2026-02-13
**Audience**: You (Said) deploying PVL on the DESY VM

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

## Step-by-Step: VM Deployment

### 1. Prerequisites on the VM

```bash
# Install Docker + Docker Compose (if not already)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in for group change

# Verify
docker --version    # >= 24.x
docker compose version  # >= 2.x
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
The `tools/` directory at the repo root contains all platform binaries — just copy the whole thing.

```bash
# Create tools directory on the VM
sudo mkdir -p /opt/pvl-tools

# Copy entire tools directory from your local machine:
scp -r tools/s4pred tools/tango user@vm:/opt/pvl-tools/

# Ensure Linux binary is executable
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
    ├── tango_darwin_x86_64    (961 KB, macOS — not needed on VM)
    ├── tango_linux_x86_64     (211 KB, Linux 64-bit — used by Docker)
    ├── tango_linux_i386        (191 KB, Linux 32-bit — fallback)
    └── tango_win32.exe         (332 KB, Windows — not needed on VM)
```

**How binary resolution works**: The backend uses `_resolve_tango_bin()` which checks:
1. `TANGO_BINARY_PATH` env var (Docker sets this to `/opt/tools/tango/bin/tango_linux_x86_64`)
2. Platform-specific binary in `tools/tango/bin/` (auto-detects OS + architecture)
3. Legacy `backend/Tango/bin/tango` fallback
4. System PATH lookup

### 4. Create Production .env

```bash
# In the project root on the VM:
cat > .env << 'EOF'
# Domain — Caddy auto-provisions HTTPS via Let's Encrypt
DOMAIN=pvl.desy.de

# Providers
USE_TANGO=1
USE_S4PRED=1

# Tool paths (host path, mounted into container at /opt/tools)
TOOLS_HOST_PATH=/opt/pvl-tools

# Sentry (optional — get DSN from sentry.io)
SENTRY_DSN=

# Frontend Sentry (optional)
VITE_SENTRY_DSN=
EOF
```

### 5. Open Firewall Ports

Caddy needs ports 80 (HTTP) and 443 (HTTPS):

```bash
# If using ufw:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp   # SSH (should already be open)

# If using iptables directly, ask DESY IT
```

### 6. DNS Record

Ask DESY IT to create a DNS A record:
```
pvl.desy.de  →  <VM IP address>
```

Caddy will automatically provision Let's Encrypt HTTPS certificates once DNS resolves.

### 7. Deploy

```bash
cd /opt/pvl

# Build and start all services
DOMAIN=pvl.desy.de docker compose -f docker/docker-compose.caddy.yml up -d --build

# Watch logs (Ctrl+C to stop watching)
docker compose -f docker/docker-compose.caddy.yml logs -f

# Check health
curl https://pvl.desy.de/api/health
```

### 8. Verify Everything Works

```bash
# Backend health
curl -s https://pvl.desy.de/api/health | python3 -m json.tool

# Provider status (should show s4pred available, tango depends on binary)
curl -s https://pvl.desy.de/api/health/dependencies | python3 -m json.tool

# Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://pvl.desy.de/
# Should return 200
```

---

## Architecture on the VM

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

## Common Operations

### Update Code

```bash
cd /opt/pvl
git pull origin main
docker compose -f docker/docker-compose.caddy.yml up -d --build
```

### View Logs

```bash
# All services
docker compose -f docker/docker-compose.caddy.yml logs -f

# Backend only
docker compose -f docker/docker-compose.caddy.yml logs -f backend

# Last 100 lines
docker compose -f docker/docker-compose.caddy.yml logs --tail=100 backend
```

### Restart a Single Service

```bash
docker compose -f docker/docker-compose.caddy.yml restart backend
```

### Check Resource Usage

```bash
docker stats --no-stream
```

### Clean Up Old Images

```bash
docker image prune -f
docker system prune -f  # More aggressive (removes stopped containers too)
```

---

## Things to Do Outside the Codebase

### 1. Sentry Error Tracking (Already Configured in Code)

The code already has Sentry integration (backend + frontend). You just need a DSN.

1. Go to https://sentry.io → Sign up (free tier: 5K errors/month)
2. Create organization → Create project (Python/FastAPI)
3. Copy the DSN (looks like `https://xxx@o123.ingest.de.sentry.io/456`)
4. Create a second project (JavaScript/React) → copy that DSN too
5. Add to your `.env`:
   ```
   SENTRY_DSN=https://your-backend-dsn@sentry.io/123
   VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/456
   ```
6. Redeploy: `docker compose -f docker/docker-compose.caddy.yml up -d --build`
7. Verify: visit the site, errors will appear in Sentry dashboard

**Note**: You already have a Sentry DSN from development (`o4510730454499328.ingest.de.sentry.io`). You can reuse that same project for production — just add `ENVIRONMENT=production` to differentiate in the Sentry dashboard.

### 2. Domain Name (Ask DESY IT)

**What to ask**: "Can I get a DNS A record pointing `pvl.desy.de` to my VM's IP address?"

Caddy handles everything else automatically:
- Provisions Let's Encrypt TLS certificate
- Auto-renews every 60 days
- HTTP/2 + HTTP/3 out of the box

### 3. TANGO Linux Binary (RESOLVED)

All 4 TANGO platform binaries are now in `tools/tango/bin/` and the Docker config points to `tango_linux_x86_64`. No action needed — TANGO is ready for deployment.

If you ever need to update the binary:
```bash
scp new_tango_binary user@vm:/opt/pvl-tools/tango/bin/tango_linux_x86_64
ssh user@vm "chmod +x /opt/pvl-tools/tango/bin/tango_linux_x86_64"
docker compose -f docker/docker-compose.caddy.yml restart backend
```

### 4. Zenodo DOI (After Live URL)

1. Go to https://zenodo.org → Log in with GitHub
2. Go to https://zenodo.org/account/settings/github/ → Enable your repo
3. Create a GitHub release (e.g., `v1.0.0`)
4. Zenodo automatically archives it and mints a DOI
5. Update `CITATION.cff` with the DOI:
   ```yaml
   identifiers:
     - type: doi
       value: 10.5281/zenodo.XXXXXXX
   ```

### 5. bio.tools Registration (After Live URL)

1. Go to https://bio.tools/register → Create account
2. Fill in:
   - **Name**: Peptide Visual Lab (PVL)
   - **Homepage**: `https://pvl.desy.de`
   - **Description**: Web tool combining aggregation propensity (TANGO), secondary structure prediction (S4PRED), and fibril-forming helix detection (FF-Helix) with interactive visualizations
   - **EDAM Topic**: Proteomics (topic_0121), Protein structure analysis (topic_2814)
   - **EDAM Operation**: Protein sequence analysis (operation_2479)
   - **Input**: Protein sequence (FASTA, CSV)
   - **Output**: Sequence report (visualization, CSV, PDF)
3. Submit — appears in ELIXIR registry within days

### 6. GitHub Repository Settings

Before going public:
- [ ] Add a `LICENSE` file (MIT) if not already present
- [ ] Set repository visibility to Public
- [ ] Enable GitHub Pages (optional, for docs)
- [ ] Add repository topics: `peptide`, `bioinformatics`, `aggregation`, `secondary-structure`, `visualization`
- [ ] Create a GitHub Release (`v1.0.0`) — triggers Zenodo if linked

### 7. Uptime Monitoring (Simple Cron)

On the VM, set up a basic health check:

```bash
# Add to crontab (crontab -e)
*/5 * * * * curl -sf https://pvl.desy.de/api/health > /dev/null || echo "PVL DOWN at $(date)" >> /var/log/pvl-health.log
```

Or use a free external monitor:
- https://uptimerobot.com (free tier: 50 monitors, 5-min intervals)
- Add monitor → HTTP(s) → `https://pvl.desy.de/api/health`

---

## Troubleshooting

### Caddy Can't Get TLS Certificate

```
ERROR: obtaining certificate: ACME challenge failed
```
- DNS not pointing to VM yet → check `dig pvl.desy.de`
- Ports 80/443 blocked by firewall → check `sudo ufw status`
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
# Check if binary exists and is executable
docker compose -f docker/docker-compose.caddy.yml exec backend ls -la /opt/tools/tango/bin/tango_linux_x86_64

# Check architecture (must be Linux ELF, not macOS Mach-O)
docker compose -f docker/docker-compose.caddy.yml exec backend file /opt/tools/tango/bin/tango_linux_x86_64

# Check which binary the resolver picks
docker compose -f docker/docker-compose.caddy.yml exec backend python -c "import tango; print(tango._resolve_tango_bin())"
```
- `Mach-O` means wrong binary is mounted → check `TANGO_BINARY_PATH` in compose
- `Permission denied` → `chmod +x` the binary on the host
- System still works without TANGO (S4PRED + FF-Helix + biochem all work)

### Disk Full

```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -f
docker volume prune -f  # WARNING: removes unused volumes (data!)
```

---

## Performance Notes

| Dataset Size | Expected Time | Notes |
|-------------|---------------|-------|
| 1 peptide | 3-5s | Quick Analyze |
| 10 peptides | 20-30s | Small CSV |
| 100 peptides | 3-4 min | Standard batch |
| 500 peptides | 15-20 min | Large batch |
| 1000 peptides | 25-30 min | May need async (B1) |

Current bottleneck is TANGO (~2-5s per peptide, sequential). S4PRED batches efficiently.

For >5 concurrent users, increase workers:
```bash
# In docker-compose.caddy.yml, change backend command to:
command: ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## Kubernetes Deployment (Long-Term — Awaiting DESY Details)

**Status**: Confirmed as long-term deployment target (2026-02-22). DESY will provide managed K8s cluster access. Helm chart work is parked until we receive cluster details.

### What DESY Needs to Provide
- [ ] K8s namespace allocation
- [ ] Ingress Controller type (nginx-ingress, Traefik, etc.)
- [ ] Container registry access (can pods pull from GHCR? Or use DESY-internal registry?)
- [ ] Resource quotas (CPU/memory limits per namespace)
- [ ] Persistent volume provisioner (for tool assets: S4PRED weights, TANGO binary)
- [ ] cert-manager availability (for automatic TLS on Ingress)
- [ ] Network policies (can pods reach UniProt API for outbound calls?)

### What PVL Already Has (K8s-Ready)
- OCI-compliant Docker images (published to GHCR)
- Health check endpoints (`/api/health`, `/api/health/dependencies`)
- Resource limits defined (2 CPU / 4GB for backend, 0.5 CPU / 256MB for frontend)
- All config via environment variables (maps directly to ConfigMaps/Secrets)
- Graceful degradation (works without TANGO, works without S4PRED)

### K8s Architecture (Planned)
```
Internet
    │
    ▼
[DESY Ingress Controller]  ── TLS via cert-manager
    │
    ├── pvl.desy.de/api/*  →  [backend Service]  →  [backend Deployment (N replicas)]
    │                                                    │
    │                                                    └── /opt/tools (PVC, ReadOnlyMany)
    │
    └── pvl.desy.de/*      →  [frontend Service]  →  [frontend Deployment (nginx)]
```

### Key Differences from VM Deployment
| Aspect | VM (Docker Compose) | K8s |
|--------|-------------------|-----|
| Reverse proxy | Caddy (our config) | DESY Ingress Controller (cluster-level) |
| TLS | Caddy auto-provisions Let's Encrypt | cert-manager (cluster-level) |
| Scaling | Single worker, manual `--workers N` | HPA (Horizontal Pod Autoscaler) |
| Tool assets | Host volume mount | PersistentVolumeClaim (ReadOnlyMany) |
| Config | `.env` file | ConfigMap + Secret |
| Logs | Docker json-file driver | kubectl logs / cluster logging (EFK/Loki) |

### What We'll Build When Unblocked
- `k8s/` directory with Helm chart or raw manifests
- Deployment (backend, frontend), Service, Ingress
- ConfigMap for non-sensitive env vars, Secret for Sentry DSN
- PVC for S4PRED weights + TANGO binary
- Optional: CronJob for proteome precomputation (Phase C1)
- CI/CD: GitHub Actions deploys to K8s via `kubectl apply` or Helm

---

## Deployment Checklist (VM — Current Target)

- [ ] VM provisioned (Ubuntu 24.04, 4 cores, 8GB RAM, 100GB disk)
- [ ] Docker installed
- [ ] S4PRED weights copied to `/opt/pvl-tools/s4pred/models/`
- [ ] TANGO binaries copied to `/opt/pvl-tools/tango/bin/` (Linux x86_64 used by Docker)
- [ ] `.env` created with `DOMAIN`, `USE_TANGO`, `USE_S4PRED`, `TOOLS_HOST_PATH`
- [ ] DNS A record: `pvl.desy.de → VM IP`
- [ ] Firewall: ports 80, 443, 22 open
- [ ] `docker compose -f docker/docker-compose.caddy.yml up -d --build`
- [ ] `curl https://pvl.desy.de/api/health` returns 200
- [ ] Sentry DSN added (optional but recommended)
- [ ] Zenodo linked to GitHub (after first release)
- [ ] bio.tools registration submitted (after live URL)
