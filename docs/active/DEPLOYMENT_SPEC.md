# DESY VM Deployment Specification — Peptide Visual Lab

**Date**: 2026-02-11
**Author**: Auto-generated from codebase analysis
**Status**: Draft for review

---

## Executive Summary

PVL is a FastAPI + React web application with two external predictors (S4PRED neural network, TANGO binary). The system is **I/O-bound and memory-bound**, not CPU-bound, under normal workloads. The primary resource consumers are:

1. **S4PRED model weights** (5 x ~100MB = ~500MB loaded into RAM at startup)
2. **TANGO subprocess** (spawns a binary per batch, writes temp files to disk)
3. **Pandas DataFrames** (in-memory data processing, ~10-50MB for 1000 peptides)

---

# PART 1: SHORT-TERM PLAN (Current System — On-Demand Prediction)

## Recommended VM Specification

| Resource | Recommended | Minimum Viable | Justification |
|----------|-------------|----------------|---------------|
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 | Better Docker/K8s ecosystem, more packages |
| **CPU** | 4 cores | 2 cores | S4PRED inference + TANGO subprocess + uvicorn |
| **Memory** | 8 GB | 4 GB | S4PRED model (~800MB RSS) + DataFrames + OS |
| **Disk** | 100 GB | 50 GB | Docker images + tools + run cache + logs |
| **Network** | DMZ (external) | DMZ | UniProt API access + user-facing HTTPS |
| **SLA** | Important | Testing (initial) | Research tool, not mission-critical |

## Resource Breakdown

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
| **Headroom for growth** | ~5.7 GB | Sufficient for concurrent users |

### CPU Usage Profile

| Operation | CPU Intensity | Duration | Pattern |
|-----------|--------------|----------|---------|
| **S4PRED inference** | Medium (single-threaded PyTorch) | ~0.5-2s per sequence | Sequential per batch |
| **TANGO execution** | Medium (native binary) | ~1-5s per sequence | Subprocess, blocking |
| **Biochem calculations** | Low (pure Python loops) | <100ms per sequence | Fast |
| **DataFrame operations** | Low-Medium | <1s for 1000 rows | Pandas vectorized |
| **HTTP serving** | Very Low | <1ms per request | Async uvicorn |
| **Nginx/Caddy** | Negligible | — | Static files |

**Key insight**: The system runs **1 uvicorn worker** (single-process). Requests are processed sequentially for predictions. 2 cores handle the app + OS comfortably; 4 cores allow the OS, Docker, and monitoring to run without contention.

### Disk Usage

| Component | Size | Growth Rate |
|-----------|------|-------------|
| Backend Docker image | ~800 MB - 1 GB | Static (per build) |
| Frontend Docker image | ~25 MB | Static (per build) |
| Caddy Docker image | ~40 MB | Static |
| S4PRED weights (volume-mounted) | ~500 MB | Static |
| TANGO binary (volume-mounted) | ~10 MB | Static |
| `.run_cache/` (TANGO temp files) | ~1-50 MB | Per batch, auto-cleaned |
| Docker volumes (uploads, runs) | ~100 MB-1 GB | Grows with usage |
| Docker layer cache | ~2-5 GB | Build artifacts |
| OS + logs | ~5 GB | Slow growth |
| **Total at deployment** | **~10-12 GB** | |
| **Total after 6 months** | **~15-20 GB** | Conservative estimate |

## Performance Expectations

### Throughput by Batch Size

| Batch Size | S4PRED Time | TANGO Time | Biochem Time | Total (estimated) |
|------------|-------------|------------|-------------|-------------------|
| 1 peptide | ~1s | ~2s | <0.1s | ~3-5s |
| 10 peptides | ~5s | ~15s | <0.5s | ~20-30s |
| 100 peptides | ~30s | ~2 min | ~2s | ~3-4 min |
| 1000 peptides | ~5 min | ~20 min | ~15s | ~25-30 min |

**Note**: TANGO runs sequentially per peptide (subprocess per batch). S4PRED runs per-sequence through the PyTorch model. These are the dominant bottlenecks.

### Concurrent User Capacity

| Scenario | With 4 cores / 8 GB | Notes |
|----------|---------------------|-------|
| 1 user, small batch (10) | Excellent | ~20s response |
| 1 user, large batch (1000) | OK | ~25 min, ties up worker |
| 2-3 concurrent users, small | Good | Requests queue behind each other |
| 5+ concurrent users | Degraded | Single worker = serial processing |
| 10+ concurrent users | Poor | Need worker scaling |

**Current limitation**: `--workers 1` in Dockerfile. For multi-user scenarios, increase to `--workers 2-4` (each worker adds ~800MB for S4PRED model).

## Deployment Architecture

```
                    ┌─────────────────────┐
                    │    Internet / DMZ    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Caddy (port 443)  │  Auto-HTTPS
                    │   Static files +    │  Let's Encrypt
                    │   Reverse proxy     │
                    └──────────┬──────────┘
                               │ /api/*
                    ┌──────────▼──────────┐
                    │  FastAPI Backend     │  Port 8000
                    │  (uvicorn, 1 worker) │
                    │                     │
                    │  ┌─────────────┐    │
                    │  │ S4PRED      │    │  Volume: /opt/tools/s4pred
                    │  │ (PyTorch)   │    │  5 x ~100MB weights
                    │  └─────────────┘    │
                    │  ┌─────────────┐    │
                    │  │ TANGO       │    │  Volume: /opt/tools/tango
                    │  │ (binary)    │    │  ~10MB executable
                    │  └─────────────┘    │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Docker Volumes      │
                    │  - pvl-runs          │
                    │  - pvl-uploads       │
                    │  - pvl-cache         │
                    │  - caddy-data (TLS)  │
                    └─────────────────────┘
```

## Production Deployment Checklist

### Pre-Deployment

- [ ] VM provisioned: Ubuntu 24.04, 4 cores, 8 GB RAM, 100 GB disk
- [ ] Domain assigned: `pvl.desy.de` (or similar)
- [ ] DNS A record pointing to VM IP
- [ ] Port 80 and 443 open in firewall (DMZ)
- [ ] Port 22 open for SSH management
- [ ] Docker Engine installed (`apt install docker.io docker-compose-plugin`)

### Tool Assets Preparation

- [ ] S4PRED weights downloaded (5 x ~100MB `.pt` files)
- [ ] TANGO binary obtained and made executable
- [ ] Create tools directory structure:
  ```
  /opt/pvl-tools/
  ├── s4pred/models/
  │   ├── weights_1.pt
  │   ├── weights_2.pt
  │   ├── weights_3.pt
  │   ├── weights_4.pt
  │   └── weights_5.pt
  └── tango/bin/
      └── tango
  ```
- [ ] Set `chmod +x /opt/pvl-tools/tango/bin/tango`

### Environment Configuration

Create `.env` file:
```bash
# Domain (Caddy auto-HTTPS)
DOMAIN=pvl.desy.de

# Provider flags
USE_TANGO=1
USE_S4PRED=1

# Tool host path (mounted into container)
TOOLS_HOST_PATH=/opt/pvl-tools

# Optional: Sentry error tracking
SENTRY_DSN=

# Optional: Log level
LOG_LEVEL=INFO
```

### Launch

```bash
# Clone repo
git clone https://github.com/desy-landau/peptide-prediction.git
cd peptide-prediction

# Create .env (see above)
cp .env.example .env
# Edit .env with your settings

# Start with Caddy (auto-HTTPS)
docker compose -f docker/docker-compose.caddy.yml up -d --build

# Verify
curl -f https://pvl.desy.de/api/health
curl -f https://pvl.desy.de/api/health/dependencies
```

### Post-Deployment Verification

- [ ] `GET /api/health` returns `{"ok": true}`
- [ ] `GET /api/health/dependencies` shows TANGO + S4PRED available
- [ ] HTTPS certificate auto-provisioned (check Caddy logs)
- [ ] Upload a test CSV and verify predictions return
- [ ] Test single-sequence prediction via Quick Analyze
- [ ] Test UniProt query (requires outbound internet)

## Monitoring Recommendations

### Built-in Health Checks

```bash
# Docker health check (every 30s, already configured)
docker inspect pvl-backend --format='{{.State.Health.Status}}'

# Dependencies check
curl -s https://pvl.desy.de/api/health/dependencies | jq .

# Container resource usage
docker stats pvl-backend pvl-caddy
```

### Recommended External Monitoring

| Tool | Purpose | Priority |
|------|---------|----------|
| **Sentry** (free tier) | Error tracking, alerts | HIGH |
| **Docker logs** (`json-file` driver) | Application logs | Built-in |
| `htop` / `top` | Manual resource check | LOW |
| Prometheus + node_exporter | System metrics (future) | MEDIUM |
| Uptime check (e.g., cron + curl) | Availability | HIGH |

### Simple Uptime Monitor (cron)

```bash
# Add to crontab -e
*/5 * * * * curl -sf https://pvl.desy.de/api/health > /dev/null || echo "PVL DOWN at $(date)" >> /var/log/pvl-uptime.log
```

## Risk Assessment

### Single Points of Failure

| SPOF | Impact | Mitigation |
|------|--------|-----------|
| Single VM | Total outage | Acceptable for Phase 1. DESY K8s (confirmed long-term) provides multi-replica HA. |
| Single uvicorn worker | Request queuing | Increase to 2-4 workers (costs ~800MB RAM each) |
| TANGO binary crash | Degraded (no aggregation) | Graceful fallback: biochem + S4PRED still work |
| S4PRED model load failure | Degraded (no SS prediction) | Graceful fallback: biochem still works |
| Disk full | Service crash | Monitor disk, rotate logs, clean `.run_cache` |

### Resource Exhaustion Scenarios

| Scenario | Trigger | Effect | Prevention |
|----------|---------|--------|-----------|
| OOM kill | Large batch + S4PRED | Backend container killed, auto-restart | Set `deploy.resources.limits.memory: 4G` |
| Disk full | Accumulated run cache | Write failures | Cron cleanup: `find /data/runs -mtime +7 -delete` |
| CPU saturation | Multiple large batches | Slow responses | Queue system (future) or worker limits |
| TANGO timeout | Sequence >10,000 residues | 3600s timeout, then fail | Input validation: max sequence length |

### Backup Strategy

```bash
# Weekly backup of Docker volumes
docker run --rm -v pvl-uploads:/data -v /backup:/backup alpine \
  tar czf /backup/pvl-uploads-$(date +%Y%m%d).tar.gz /data

# Caddy TLS certificates (auto-renewed, but backup anyway)
docker run --rm -v caddy-data:/data -v /backup:/backup alpine \
  tar czf /backup/caddy-data-$(date +%Y%m%d).tar.gz /data
```

## Scaling Triggers

| Metric | Current Limit | Upgrade Action |
|--------|--------------|----------------|
| Concurrent users > 5 | Worker queuing | Increase `--workers` to 2-4 (needs 12-16 GB RAM) |
| Response time > 60s for small batches | Worker busy | Add workers or separate TANGO to async queue |
| Disk > 80% | 80 GB used | Expand disk or add cleanup cron |
| Memory > 90% sustained | ~7.2 GB | Upgrade to 16 GB VM |

---

# PART 2: LONG-TERM PLAN (Precomputed Proteome Database)

## Vision

Precompute predictions for 250M UniProt sequences so queries return in **milliseconds** instead of seconds/minutes.

```
Phase 1 (Current):  On-demand prediction     (seconds-minutes per query)
Phase 2 (Next):     Hybrid cache + predict    (ms for cached, seconds for miss)
Phase 3 (Vision):   Full proteome coverage    (ms for all queries)
```

## Phase 2: Hybrid Mode — Recommended VM Specification

| Resource | Recommended | Justification |
|----------|-------------|---------------|
| **OS** | Ubuntu 24.04 LTS | Same as Phase 1 |
| **CPU** | 8 cores | Background precomputation + serving |
| **Memory** | 16 GB | PostgreSQL + Redis + S4PRED + app |
| **Disk** | 500 GB SSD | PostgreSQL data + precomputed results |
| **Network** | DMZ | External access + UniProt bulk download |
| **SLA** | Important | Users depend on cached results |

### Additional Components

```
┌──────────────────────────────────┐
│           Same as Phase 1        │
│  Caddy → FastAPI → S4PRED/TANGO │
└──────────────┬───────────────────┘
               │
    ┌──────────▼──────────┐
    │   PostgreSQL 16     │  Structured results storage
    │   (DESY K8s free)   │  ~50-200 GB for top organisms
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Redis 7           │  Hot cache: recent queries
    │   (~512 MB)         │  TTL-based eviction
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   K8s CronJob       │  Scheduled precomputation
    │   (batch worker)    │  Start with top 10 organisms
    └─────────────────────┘
```

### Memory Budget (Phase 2, 16 GB)

| Component | Resident Memory |
|-----------|----------------|
| OS + Docker | ~700 MB |
| Backend (FastAPI + S4PRED) | ~1.5 GB |
| PostgreSQL | ~1-4 GB (shared_buffers) |
| Redis | ~512 MB |
| Batch worker (during precompute) | ~2-3 GB |
| **Total (peak)** | **~6-10 GB** |
| **Headroom** | ~6-10 GB |

### Disk Budget (Phase 2, 500 GB)

| Component | Size | Notes |
|-----------|------|-------|
| Docker images + system | ~15 GB | Same as Phase 1 |
| PostgreSQL data (top 10 organisms) | ~50-200 GB | ~10% of UniProt |
| PostgreSQL WAL + indexes | ~20-50 GB | Depends on query patterns |
| Redis dump | ~1 GB | Periodic snapshots |
| TANGO run cache | ~5-10 GB | With cleanup rotation |
| **Total estimated** | **~100-280 GB** | |

### Precomputation Strategy

**Start small**: Top 10 organisms cover ~10% of UniProt (~25M sequences).

| Organism | Sequences | Est. Compute Time | Est. Storage |
|----------|-----------|-------------------|-------------|
| Homo sapiens | ~20K reviewed | ~2-3 hours | ~500 MB |
| Mus musculus | ~17K reviewed | ~2 hours | ~400 MB |
| Arabidopsis thaliana | ~16K reviewed | ~2 hours | ~400 MB |
| E. coli (K12) | ~4.5K reviewed | ~30 min | ~100 MB |
| S. cerevisiae | ~6.7K reviewed | ~45 min | ~150 MB |
| D. melanogaster | ~14K reviewed | ~1.5 hours | ~350 MB |
| C. elegans | ~4K reviewed | ~30 min | ~100 MB |
| D. rerio | ~5K reviewed | ~40 min | ~120 MB |
| R. norvegicus | ~8K reviewed | ~1 hour | ~200 MB |
| B. taurus | ~6K reviewed | ~45 min | ~150 MB |
| **Total (reviewed)** | **~101K** | **~12-15 hours** | **~2.5 GB** |

**Full proteome (TrEMBL)**: 250M sequences would need ~50 TB storage and months of compute on a single VM. This requires a cluster approach (DESY K8s).

### Database Schema (PostgreSQL)

```sql
-- Core precomputed results
CREATE TABLE peptide_predictions (
    uniprot_id VARCHAR(20) PRIMARY KEY,
    sequence TEXT NOT NULL,
    organism_id INTEGER,
    -- Biochemical
    charge FLOAT,
    hydrophobicity FLOAT,
    mu_h FLOAT,
    ff_helix_percent FLOAT,
    -- S4PRED
    ss_prediction TEXT,  -- 'CCHHHEEECC...'
    s4pred_diff FLOAT,
    ssw_prediction INTEGER,
    -- TANGO
    tango_ssw_score FLOAT,
    tango_ssw_prediction INTEGER,
    -- FF flags
    ff_helix_flag INTEGER,
    ff_ssw_flag INTEGER,
    -- Metadata
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    model_version VARCHAR(20)
);

CREATE INDEX idx_organism ON peptide_predictions(organism_id);
CREATE INDEX idx_ssw ON peptide_predictions(ssw_prediction);
```

### API Changes for Hybrid Mode

```
POST /api/upload-csv
  → Check DB for each sequence hash
  → Return cached results instantly for hits
  → Run predictions only for cache misses
  → Store new results in DB

POST /api/predict
  → Check DB first (hash lookup)
  → Cache hit: return in <50ms
  → Cache miss: predict + store + return

GET /api/precomputed/{uniprot_id}
  → New endpoint: direct DB lookup
  → Returns precomputed results or 404
```

## Phase 3: Full Proteome (Future Vision — DESY K8s)

DESY K8s cluster access confirmed as long-term target (2026-02-22). Details pending.
This phase requires DESY K8s cluster resources:

| Resource | Requirement |
|----------|-------------|
| **Compute** | 10-50 K8s pods for batch prediction |
| **Storage** | ~50 TB PostgreSQL or object storage |
| **Timeline** | Months for initial computation |
| **Maintenance** | Monthly re-computation for new UniProt releases |

**Not recommended on a single VM.** This is a cluster workload.

---

## Decision Matrix: Phase 1 vs Phase 2

| Factor | Phase 1 (Current) | Phase 2 (Hybrid) |
|--------|-------------------|-------------------|
| **When** | Now (paper publication) | After paper, when users request it |
| **VM Spec** | 4 cores, 8 GB, 100 GB | 8 cores, 16 GB, 500 GB |
| **Complexity** | Low (Docker Compose) | Medium (+ PostgreSQL + Redis + CronJob) |
| **User Experience** | Seconds-minutes per query | Milliseconds for cached, seconds for new |
| **Maintenance** | Minimal | Database backups, precompute jobs |
| **Cost** | Free (DESY VM) | Free (DESY VM, larger) |

**Recommendation**: Deploy Phase 1 immediately. Phase 2 when user demand justifies the complexity.

---

## Appendix: Docker Compose Resource Limits (Already Configured)

From `docker-compose.caddy.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '0.5'
        memory: 512M

caddy:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
```

These limits are appropriate for the 4-core/8 GB Phase 1 VM.
