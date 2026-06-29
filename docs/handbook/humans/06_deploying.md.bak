# Deploying PVL — Host It Yourself

> For the devops/ops person who wants PVL running on their own iron. Three scenarios, in order of how much we actually run them: a single VPS via Docker Compose (production today), an institutional VM behind a firewall (the DESY pattern), and Kubernetes (gestural — pointers only).

Every command on this page is quoted verbatim from a real file in the repo, with the source annotated. If a command here differs from what you see in the repo, the repo wins — these scripts evolve.

## Contents

- [What you're deploying](#what-youre-deploying)
- [Scenario 1 — Single VPS via Docker Compose (the Hetzner pattern, live now)](#scenario-1--single-vps-via-docker-compose-the-hetzner-pattern-live-now)
- [Scenario 2 — Institutional VM behind a firewall (the DESY pattern)](#scenario-2--institutional-vm-behind-a-firewall-the-desy-pattern)
- [Scenario 3 — Kubernetes (future, gestural only)](#scenario-3--kubernetes-future-gestural-only)
- [When something breaks](#when-something-breaks)

## What you're deploying

PVL backend is **FastAPI + [S4PRED](02_the_science.md#3-s4pred) (PyTorch CPU, ~800 MB RSS) + a [TANGO](02_the_science.md#2-tango) subprocess**. It is **I/O-bound and memory-bound, not CPU-bound** (`docs/active/DEPLOYMENT.md`). The two predictors are optional at runtime: the system degrades gracefully — without TANGO you lose aggregation, without S4PRED you lose secondary structure, and biochem + FF-Helix still compute. That property is what makes a firewalled VM with no outbound binary download survivable.

The tool assets (S4PRED weights, TANGO binaries) live **outside** the Docker image and are volume-mounted from the host. That keeps the image small and lets you swap binaries without a rebuild.

---

## Scenario 1 — Single VPS via Docker Compose (the Hetzner pattern, live now)

This is what serves the citable public URL today: a [Hetzner](09_glossary.md#h) CX33 at `94.130.178.182:3000`.

### VM spec

| Resource | Recommended | Minimum | Why (`docs/active/DEPLOYMENT.md`) |
|---|---|---|---|
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 | Docker/K8s ecosystem |
| CPU | 4 cores | 2 cores | S4PRED + TANGO subprocess + uvicorn |
| Memory | 8 GB | 4 GB | S4PRED model ~800 MB RSS + DataFrames |
| Disk | 100 GB | 50 GB | Images + tools + run cache + logs |

Peak resident memory is ~2.0–2.3 GB, leaving ~5.7 GB headroom on an 8 GB box. The single-worker uvicorn is the deliberate constraint — each extra worker adds ~800 MB for another copy of the S4PRED model.

### Ports

The prod compose file (`docker/docker-compose.prod.yml`) maps the frontend container to both `80` and `3000`:

```yaml
    ports:
      - "80:80"
      - "3000:80"
```

The backend listens on `8000` inside the network; nginx (frontend container) proxies `/api/*` to it. Open `80`, `443`, `22` at the firewall (`docs/active/DEPLOYMENT.md`):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
```

### The env file

The prod stack is configured by environment variables. For a from-scratch Caddy/TLS deploy, `docs/active/DEPLOYMENT.md` uses a root `.env`:

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

`TOOLS_HOST_PATH` is the host directory bind-mounted to `/opt/tools:ro` (`docker/docker-compose.base.yml`). For local backend dev the full annotated reference is `backend/.env.example` — copy it to `backend/.env` and adjust. The key flags from that file:

```bash
USE_TANGO=1
USE_S4PRED=1
```

> `USE_TANGO=0` and `USE_S4PRED=0` are valid — they trigger the graceful-degradation paths. Use them when you can't ship the binaries.

### The prod redeploy

After `git pull`, run the one script that rebuilds **everything users hit** — backend, frontend, and both Celery workers (`docs/active/DEPLOYMENT.md`, daily-ops section):

```bash
cd /opt/pvl && \
git pull --ff-only origin main && \
bash scripts/prod_redeploy.sh
```

`scripts/prod_redeploy.sh` is idempotent and takes ~2–4 min. Internally it does the work verbatim as (`scripts/prod_redeploy.sh`):

```bash
COMPOSE="docker compose -f docker/docker-compose.prod.yml"
$COMPOSE build backend
$COMPOSE build frontend
$COMPOSE up -d --no-deps --force-recreate \
  backend \
  frontend \
  celery-batch \
  celery-quick
```

`--no-deps` deliberately avoids bouncing Redis (stateful). The script ends with a backend health probe (`scripts/prod_redeploy.sh`):

```bash
docker exec pvl-backend curl -fsSL http://localhost:8000/api/health 2>/dev/null
```

The original sin this script fixes: rebuilding only the backend left a stale frontend container, so the UI on `:3000` looked unchanged. Always use `prod_redeploy.sh`, not a backend-only rebuild.

### The precompute step (and WHY it matters)

The example datasets (`peleg_118`, `gold_standard`) load **instantly** in the UI only because their full TANGO + S4PRED results are precomputed to host-generated JSON. Those artifacts live in the container at `data/precomputed/` and **are wiped on every image rebuild**. So after any redeploy, regenerate them (`docs/active/DEPLOYMENT.md`):

```bash
docker compose -f docker/docker-compose.prod.yml exec -T backend python scripts/precompute_dataset.py peleg_118
docker compose -f docker/docker-compose.prod.yml exec -T backend python scripts/precompute_dataset.py gold_standard
```

`peleg_118` takes ~10s; `gold_standard` (2,916 peptides) is ~10–15 min on the VM. Skip this and the first visitor triggers the live pipeline (~20 min) instead of an instant load. The same artifacts can be built locally before deploy via (`Makefile`, target `precompute-datasets`):

```bash
USE_TANGO=1 USE_S4PRED=1 .venv/bin/python scripts/precompute_dataset.py peleg_118
```

Output shape matches `POST /api/predict/batch`. See `../agents/07_artifacts_index.md` for what each artifact is and where it's checked in.

### Caddy + DNS (once you have a hostname)

The Hetzner stack runs HTTP today. When a real hostname exists, switch to the Caddy stack for auto-HTTPS. Caddy reads `DOMAIN` and auto-provisions Let's Encrypt on first hit. Full from-scratch deploy (`docs/active/DEPLOYMENT.md`):

```bash
cd /opt/pvl
DOMAIN=pvl.desy.de docker compose -f docker/docker-compose.caddy.yml up -d --build
```

If you're already on the prod stack and only want to flip the hostname (`docs/active/DEPLOYMENT.md`):

```bash
nano /opt/pvl/docker/Caddyfile      # change "localhost:3000" → "pvl.desy.de"
docker compose -f docker/docker-compose.prod.yml restart frontend
curl -I https://pvl.desy.de/api/health
```

The `Caddyfile` already sets a `100MB` upload cap and a `600s` read/write timeout so long TANGO batches don't get cut off mid-prediction. Ask DESY IT for the DNS A record (`pvl.desy.de → VM IP`); Caddy fails to get a cert until DNS resolves.

### Observability

Sentry integration is already in the code — it activates when you supply DSNs. Per `docs/active/DEPLOYMENT.md`: create Python + JavaScript projects at sentry.io, then set `SENTRY_DSN` and `VITE_SENTRY_DSN` in `.env` and redeploy. Add `ENVIRONMENT=production` to differentiate from the dev DSN. Uptime is a curl cron (`docs/active/DEPLOYMENT.md`):

```bash
*/5 * * * * curl -sf https://pvl.desy.de/api/health > /dev/null || echo "PVL DOWN at $(date)" >> /var/log/pvl-health.log
```

---

## Scenario 2 — Institutional VM behind a firewall (the DESY pattern)

The DESY VM (`landau-webapp-dev`, internal `131.169.4.163`) is the long-term DESY-owned production target. It is **firewalled — reachable only from inside the DESY network**.

### The access path (Kerberos, two hops)

From a Mac on any network (`docs/active/DEPLOYMENT.md`):

```bash
ssh azaizahs@max-display.desy.de   # Hop 1 — Maxwell login (password + OTP)
kinit                              # Hop 2 — Kerberos ticket
ssh -l root landau-webapp-dev      # Hop 3 — root login on the VM
```

Once your Mac's SSH public key is in the VM's `authorized_keys`, you can tunnel the UI to your laptop (`docs/active/DEPLOYMENT.md`):

```bash
ssh -J azaizahs@max-display.desy.de -L 8080:localhost:3000 root@landau-webapp-dev
# Then open http://localhost:8080
```

### Bootstrap a fresh box

`scripts/desy_vm_bootstrap.sh` takes a clean Ubuntu 24.04 root box to a running backend. It's safe to re-run. The one-liner from the box (`scripts/desy_vm_bootstrap.sh`):

```bash
curl -fsSL https://raw.githubusercontent.com/saidaz24-meet/peptide_prediction/wave-2.8/peleg-pdf-followups/scripts/desy_vm_bootstrap.sh | bash
```

Its eight stages: sanity check → install Docker engine + compose plugin → clone to `/opt/pvl` → download S4PRED weights → write a minimal `.env.deploy` → build the backend image locally → start the container → validate perf env vars. It builds from source rather than pulling from a registry because the feature branch isn't on GHCR yet.

The `.env.deploy` it writes (`scripts/desy_vm_bootstrap.sh`) is the canonical firewalled-VM env — note `CELERY_ENABLED=0`, `VECTOR_INDEX_ENABLED=0`, and the thread pins that keep PyTorch from oversubscribing CPU:

```bash
USE_TANGO=1
USE_S4PRED=1
TANGO_BINARY_PATH=/opt/tools/tango/bin/tango_linux_x86_64
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
```

### S4PRED weight download (the firewall-sensitive step)

The bootstrap pulls the five ensemble weights into `/opt/pvl/tools/s4pred/models`, trying two mirrors per file (`scripts/desy_vm_bootstrap.sh`):

```bash
S4PRED_WEIGHT_URLS=(
  "https://github.com/psipred/s4pred/releases/download/v1.2.4/weights_%d.pt"
  "https://bioinfadmin.cs.ucl.ac.uk/downloads/s4pred/weights_%d.pt"
)
```

If both mirrors are blocked by the institutional firewall, the script prints "Copy it manually to … and re-run" and exits 1. On a locked-down VM, `scp` the five `weights_*.pt` (~86 MB each) in from a machine that can reach the mirrors, then re-run. This is exactly why the assets are host-mounted, not baked into the image.

### Daily redeploy on the VM

Inside the SSH-from-Maxwell session (`docs/active/DEPLOYMENT.md`):

```bash
cd /opt/pvl && \
git pull --ff-only origin main && \
docker compose -f docker/docker-compose.prod.yml --env-file .env.deploy build backend && \
docker compose -f docker/docker-compose.prod.yml --env-file .env.deploy up -d
```

### Why the precompute / budget gate matters here

On the DESY VM the precompute step is not a nicety — it's the throughput gate. The box is single-worker by design (each worker = another ~800 MB S4PRED copy against an 8 GB budget), and TANGO is sequential at ~2–5s/peptide. A live `gold_standard` run is ~25–30 min and pins the one worker the whole time, blocking real users. Precomputing to JSON (same commands as Scenario 1) moves that cost off the request path entirely. Regenerate after every backend rebuild — the artifacts are wiped with the image.

---

## Scenario 3 — Kubernetes (future, gestural only)

K8s is the confirmed long-term DESY target; the Helm chart is parked until DESY supplies cluster details. **Do not hand-roll manifests from this page** — read the canonical section instead: `docs/active/DEPLOYMENT.md` → **"Kubernetes Deployment (Long-Term — Awaiting DESY Details)."**

What PVL already brings that makes it K8s-ready (per that section): OCI images, health endpoints (`/api/health`, `/api/health/dependencies`), declared resource limits, all-config-via-env, and graceful degradation. The substitutions to expect: Caddy → DESY Ingress Controller, Caddy TLS → cert-manager, host volume mounts → PersistentVolumeClaim, `.env` → ConfigMap + Secret, manual workers → HPA.

---

## When something breaks

Backend won't start, TANGO returns the wrong binary (`Mach-O` instead of an ELF), Caddy can't get a cert — these are catalogued with fixes in `docs/active/DEPLOYMENT.md` (Troubleshooting) and, for the handbook-level version, `../humans/08_troubleshooting.md`. Remember the escape hatch: the system runs without TANGO or S4PRED, so a degraded `/api/health` beats a dead box while you sort the tools out.
