# Next Steps After Docker

This document outlines the remaining tasks and infrastructure roadmap after completing Docker setup.

---

## Current State (Completed)

- ✅ Docker Infrastructure (Phase D)
  - Multi-stage Dockerfiles (backend + frontend)
  - docker-compose for dev and prod
  - Volume-mounted assets (Strategy A)
  - Health checks and proper init system

- ✅ GitHub Actions CI/CD (Phase F)
  - Backend tests + linting
  - Frontend build + linting
  - Docker image builds

- ✅ Repository Polish
  - README with Docker quick start
  - CONTRIBUTING.md
  - .env.example

---

## Remaining Tasks (In Order)

### Phase 1: Immediate Fixes (This Week)

| Task | Priority | Effort | Description |
|------|----------|--------|-------------|
| **#4: SSW Badge Fix** | High | 1-2 hrs | Fix "Uncertain" showing instead of "Missing" for ~30% of badges |
| **#3: Schema Migration** | Medium | 4-6 hrs | Canonical schema in api_models.py, sync TypeScript types |

**Gate:** Complete before adding any new features.

### Phase 2: UI Polish (Next Week)

| Task | Priority | Effort | Description |
|------|----------|--------|-------------|
| **#2: Results Table** | Medium | 4-6 hrs | Column visibility, advanced filtering, export selected |
| **#1: Upload Flow** | Low | 2-3 hrs | Remove 3-step wizard, auto-detect columns |

**Gate:** Complete before public deployment.

---

## Infrastructure Roadmap

### Now: Single Server Deployment

**Stack:**
- Ubuntu VPS (Hetzner/DigitalOcean)
- Docker Compose (production)
- Nginx reverse proxy
- Let's Encrypt SSL
- Sentry for error tracking

**Commands:**
```bash
# On server
git clone <repo>
cd peptide-prediction
cp backend/.env.example backend/.env
# Edit .env with production values
docker compose -f docker/docker-compose.prod.yml up -d
```

### Later: When to Scale

| Trigger | Solution | When |
|---------|----------|------|
| >100 concurrent users | Add Redis for caching | When response times >2s |
| >1000 daily predictions | Add Postgres for persistence | When need query history |
| Multi-region needed | Kubernetes + ArgoCD | When have dedicated DevOps |
| Team >3 developers | Vercel (frontend) + Railway (backend) | When need preview deploys |

---

## Tool Decision Matrix

### Use Now ✅

| Tool | Purpose | Why Now |
|------|---------|---------|
| **Docker Compose** | Deployment | Already set up, simple |
| **Sentry** | Error tracking | Already integrated |
| **GitHub Actions** | CI/CD | Already configured |
| **Nginx** | Reverse proxy | Simple, well-documented |

### Use When Needed ⏳

| Tool | Purpose | Trigger | Alternative Until Then |
|------|---------|---------|------------------------|
| **Redis** | Caching, rate limiting | Response times >2s, need rate limiting | In-memory cache |
| **Postgres/Supabase** | Persistence | Need query history, user accounts | File-based / stateless |
| **Vercel** | Frontend hosting | Need preview deploys, edge caching | Docker + Nginx |
| **Railway** | Backend hosting | Need auto-scaling, managed infra | Docker Compose |

### Use Later (Not Now) 🔮

| Tool | Purpose | When | Why Wait |
|------|---------|------|----------|
| **Kubernetes** | Orchestration | >10 services, multi-region | Overkill for <5 services |
| **ArgoCD** | GitOps | Using K8s | Not needed without K8s |
| **Terraform** | IaC | Multi-cloud, complex infra | Manual setup is fine for now |

---

## Deployment Options

### Option A: Simple VPS (Recommended for Now)

```
┌─────────────────────────────────────────────┐
│                Ubuntu VPS                    │
│  ┌─────────────────────────────────────┐    │
│  │           Nginx (SSL)                │    │
│  │  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │ Frontend │  │ Backend (Docker) │ │    │
│  │  │ (Docker) │  │   - FastAPI      │ │    │
│  │  │  Nginx   │  │   - S4PRED       │ │    │
│  │  └──────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

**Pros:** Simple, cheap (~$10/mo), full control
**Cons:** Manual scaling, single point of failure

### Option B: Managed Services (When Scaling)

```
┌───────────┐     ┌─────────────┐     ┌──────────┐
│  Vercel   │────▶│   Railway   │────▶│ Supabase │
│ (Frontend)│     │  (Backend)  │     │ (Postgres)│
└───────────┘     └─────────────┘     └──────────┘
```

**Pros:** Auto-scaling, preview deploys, managed DB
**Cons:** Higher cost (~$50+/mo), less control

### Option C: Kubernetes (Future)

```
┌──────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Frontend │  │ Backend  │  │  Redis   │  ArgoCD   │
│  │ Replicas │  │ Replicas │  │ Cluster  │  GitOps   │
│  └──────────┘  └──────────┘  └──────────┘           │
└──────────────────────────────────────────────────────┘
```

**Pros:** Auto-scaling, self-healing, multi-region
**Cons:** Complex, needs dedicated DevOps, expensive

---

## CI Verification Commands

### What CI Runs

```bash
# Backend (in CI)
cd backend
pip install -r requirements.txt
ruff check .                           # Linting (continue on error)
mypy . --ignore-missing-imports        # Type check (continue on error)
USE_TANGO=0 USE_S4PRED=0 pytest tests/ -v --tb=short  # Tests (must pass)

# Frontend (in CI)
cd ui
npm ci
npm run lint                           # Linting (continue on error)
npm run build                          # Build (must pass)

# Docker (in CI)
docker build -f docker/Dockerfile.backend -t pvl-backend .
docker build -f docker/Dockerfile.frontend -t pvl-frontend .
```

### Local Verification (Parity)

```bash
# Run same checks locally
make test           # Backend tests
make lint           # Linting (may have warnings)
cd ui && npm run build  # Frontend build

# Docker verification
make docker-build   # Build images
make docker-smoke   # Run smoke tests in containers
```

---

## Checklist Before Production

- [ ] All CI checks passing
- [ ] SSW badge fix deployed (#4)
- [ ] Schema migration complete (#3)
- [ ] Environment variables configured
- [ ] Sentry DSN set
- [ ] CORS origins configured
- [ ] SSL certificate installed
- [ ] Backup strategy defined
- [ ] Monitoring alerts configured

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `make test` | Run backend tests |
| `make lint` | Run linters |
| `make docker-build` | Build Docker images |
| `make docker-up` | Start dev containers |
| `make docker-smoke` | Verify containers work |
| `make docker-prod-up` | Start production |

---

*Last updated: 2026-02-02*
