# Peptide Visual Lab (PVL) - System Overview

**Audience**: Technical stakeholders, CTOs, infrastructure architects, reviewers
**Last Updated**: 2026-02-07
**Status**: Pre-paper, active development

---

## Executive Summary

Peptide Visual Lab (PVL) is a web-based analysis platform for predicting fibril-forming properties of peptide sequences. It combines biophysical calculations with machine-learning structure prediction to classify peptides as fibrillar candidates.

**Key numbers**:
- 214 automated tests, all passing
- ~800MB Docker image (optimized from ~3GB)
- Sub-minute analysis for typical datasets (100-500 peptides)
- Zero external paid dependencies — runs entirely on free infrastructure

---

## 1. Design Decisions & Rationale

### Why FastAPI + React?

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| **FastAPI** (Python) | Flask, Django, Go | S4PRED is PyTorch-based → Python mandatory. FastAPI gives async, auto-docs, Pydantic validation. |
| **React + TypeScript** | Vue, Svelte, plain JS | Team familiarity, strong typing for complex data model (~50 fields per peptide), Recharts for scientific visualization. |
| **Zustand** (state) | Redux, Context API | Minimal boilerplate for a medium-complexity app. One store, no provider nesting. |
| **No database** (current) | Postgres, SQLite | Pre-paper: stateless is simpler. Each upload is independent. Database planned for post-paper (precomputed proteome). |

### Why S4PRED Over Alternatives?

| Predictor | Status | Rationale |
|-----------|--------|-----------|
| **S4PRED** | Primary | PyTorch ensemble (5 GRU models). Runs in-process, no binary dependency. ~430MB weights. Provides per-residue probabilities needed for SSW detection. |
| **TANGO** | Secondary | External binary. Provides aggregation predictions that S4PRED cannot. Required for TANGO-based SSW (the original method). |
| **PSIPRED** | Removed (2026-02-07) | Required network calls to external server. Unreliable, slow, and redundant with S4PRED. Fully removed from codebase. |
| **JPred** | Removed (2026-02-07) | Similar issues to PSIPRED. Column name aliases remain in code (cosmetic debt). |

### Stateless Architecture (Current Phase)

```
User → Upload CSV → Process in memory → Return JSON → Done
         │                                    │
         └────── Nothing persisted ───────────┘
```

**Why**: Simplicity. No database migrations, no state management, no stale data. Each analysis is independent and reproducible (given same inputs + config).

**Tradeoff**: Users can't retrieve past analyses. This is acceptable pre-paper. Post-paper, a Postgres database will cache precomputed results.

### Provider Isolation Pattern

Each external prediction tool is isolated in a try-catch with independent status tracking. This was a deliberate architectural choice:

**Problem**: TANGO binary crashes on malformed sequences. S4PRED can OOM on very long sequences. Either failure previously crashed the entire upload.

**Solution**: Independent error boundaries per provider:
```
try: run_tango() → status = AVAILABLE
except: status = UNAVAILABLE, nullify tango columns

try: run_s4pred() → status = AVAILABLE
except: status = UNAVAILABLE, nullify s4pred columns

# Both results merged. Partial data is better than no data.
```

**Result**: If TANGO fails, users still get S4PRED predictions, biochem calculations, and FF-Helix %. The provider status badges communicate exactly what ran and what didn't.

---

## 2. System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                     │
│  Upload.tsx │ Results.tsx │ PeptideDetail.tsx │ ...      │
│  Zustand store │ peptideMapper │ Recharts                │
└───────────────────────┬─────────────────────────────────┘
                        │ REST (JSON)
                        │ POST /api/upload-csv
                        │ POST /api/predict
                        │ POST /api/uniprot/execute
                        │ GET  /api/example
                        │ GET  /api/health
┌───────────────────────┴─────────────────────────────────┐
│                  FastAPI Backend                         │
│                                                         │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │ server.py│  │ services/  │  │ schemas/           │   │
│  │ (routes) │→ │ upload_    │→ │ api_models.py      │   │
│  │          │  │ normalize  │  │ peptide.py         │   │
│  │          │  │ predict    │  │ provider_status.py │   │
│  └──────────┘  └─────┬──────┘  └────────────────────┘   │
│                       │                                  │
│           ┌───────────┼───────────┐                      │
│           │           │           │                      │
│    ┌──────┴───┐ ┌─────┴────┐ ┌───┴──────┐               │
│    │ biochem  │ │ s4pred.py│ │ tango.py │               │
│    │ calc.py  │ │ +tools/  │ │ (binary) │               │
│    │ auxil.py │ │ s4pred/  │ │          │               │
│    └──────────┘ └──────────┘ └──────────┘               │
│                                                         │
│  Pure Python    PyTorch CPU    Subprocess                │
│  (always runs)  (~1-2s/seq)    (~3-5s/seq)              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow (CSV Upload)

```
CSV file
  → parse (pandas read_csv/read_excel)
  → validate (require Entry + Sequence columns)
  → header synonym resolution (map column names to canonical)
  → biochem calculations (charge, hydrophobicity, muH)
  → FF-Helix % (Chou-Fasman, pure Python, no deps)
  → [if enabled] S4PRED neural network (helix/beta/coil per-residue)
  → [if enabled] TANGO binary (aggregation curves)
  → SSW classification (database-average threshold)
  → FF flag computation (FF-Helix + FF-SSW binary flags)
  → normalization (DataFrame → PeptideSchema → camelCase JSON)
  → API response validation (PeptideRow Pydantic model)
  → JSON response to browser
```

### API Contract

The canonical response schema is defined in `backend/schemas/api_models.py` and is **protected** — changes require coordination.

```json
{
  "rows": [
    {
      "id": "P12345",
      "sequence": "GIGAVLKVLTTGLPALISWIK",
      "length": 21,
      "charge": 2.0,
      "hydrophobicity": 0.85,
      "muH": 0.62,
      "ffHelixPercent": 76.2,
      "ffHelixFlag": 1,
      "ffHelixScore": 1.45,
      "ffSswFlag": -1,
      "ffSswScore": null,
      "sswPrediction": -1,
      "s4predHelixPrediction": 1,
      "s4predHelixPercent": 52.4,
      "providerStatus": {
        "tango": { "status": "OFF" },
        "s4pred": { "status": "AVAILABLE" }
      }
    }
  ],
  "meta": {
    "use_tango": false,
    "use_s4pred": true,
    "ssw_rows": 15,
    "valid_seq_rows": 20,
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "traceId": "abc123",
    "inputsHash": "a1b2c3d4e5f6g7h8",
    "configHash": "i9j0k1l2m3n4o5p6",
    "providerStatusSummary": { "tango": {...}, "s4pred": {...} },
    "thresholds": { "muHCutoff": 0.5, "hydroCutoff": 0.3, "ffHelixPercentThreshold": 10 },
    "thresholdConfigResolved": { "mode": "default", "version": "1.0" }
  }
}
```

---

## 3. Scalability Analysis

### Current Performance Profile

| Operation | Time (100 peptides) | Time (1000 peptides) | Bottleneck |
|-----------|--------------------|--------------------|------------|
| File parsing | <100ms | <500ms | pandas I/O |
| Biochem calculations | <50ms | <200ms | Pure Python, fast |
| FF-Helix % | <100ms | <500ms | Pure Python, per-sequence |
| S4PRED inference | ~2-5s | ~20-50s | PyTorch CPU, sequential |
| TANGO execution | ~5-10s | ~50-100s | Subprocess, sequential |
| Normalization | <200ms | <1s | Pydantic validation |
| **Total (S4PRED only)** | **~5-10s** | **~30-60s** | S4PRED dominates |

### Scaling Bottleneck: S4PRED

S4PRED runs **sequentially** (one sequence at a time) on CPU. For large datasets:

**Short-term mitigations** (current):
- CPU-only PyTorch (no GPU overhead on machines without GPU)
- Batch processing within a single request

**Medium-term options** (post-paper):
- Batch parallelism: Split sequences across worker processes
- GPU inference: Single-GPU inference would be ~10-50x faster
- Result caching: Postgres cache by sequence hash

**Long-term vision** (precomputed proteome):
- Precompute all 250M UniProt sequences offline
- Serve from database (millisecond lookup)
- Only run inference for novel sequences not in database

### Memory Profile

| Component | Memory Usage |
|-----------|-------------|
| FastAPI base | ~50MB |
| S4PRED model (5 GRU ensemble) | ~450MB |
| Per-request DataFrame (1000 peptides) | ~10-50MB |
| PyTorch overhead | ~200MB |
| **Total (with S4PRED)** | **~800MB-1GB** |

**Implication**: Each worker process needs ~1GB. On a machine with 8GB RAM, run at most 4-6 workers.

---

## 4. Deployment Architecture

### Current: Docker Compose

```
┌──────────────────────────────────────────┐
│            docker-compose                │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │   Caddy /   │  │    Backend       │   │
│  │   Nginx     │→ │    (FastAPI)     │   │
│  │   :443/:80  │  │    :8000         │   │
│  └──────┬──────┘  └──────────────────┘   │
│         │                                │
│  ┌──────┴──────┐                         │
│  │  Frontend   │  Volumes:               │
│  │  (static)   │  - S4PRED weights       │
│  │             │  - TANGO binary         │
│  └─────────────┘  - .env config          │
└──────────────────────────────────────────┘
```

**Three compose profiles available**:
- `docker-compose.yml` — Development (hot reload, CORS open)
- `docker-compose.prod.yml` — Production with Nginx
- `docker-compose.caddy.yml` — Production with Caddy (auto-HTTPS)

**Caddy activation** (one step): Set `DOMAIN=your.desy.de` in `.env`, switch to `docker-compose.caddy.yml`.

### Planned: Kubernetes (DESY Infrastructure)

```
┌──────────────────────────────────────────────────────┐
│                  DESY Kubernetes                     │
│                                                      │
│  ┌───────────────┐                                   │
│  │    Ingress     │ (HTTPS termination)               │
│  │    Controller  │                                   │
│  └───────┬───────┘                                   │
│          │                                           │
│  ┌───────┴───────┐  ┌───────────────┐                │
│  │   Frontend    │  │   Backend     │                │
│  │   Deployment  │  │   Deployment  │                │
│  │   (Nginx)     │  │   (FastAPI)   │                │
│  │   replicas: 2 │  │   replicas: 2 │                │
│  └───────────────┘  └───────┬───────┘                │
│                             │                        │
│                     ┌───────┴───────┐                │
│                     │   PVC         │                │
│                     │   S4PRED      │                │
│                     │   weights     │                │
│                     └───────────────┘                │
│                                                      │
│  Future:                                             │
│  ┌───────────────┐  ┌───────────────┐                │
│  │  PostgreSQL   │  │    Redis      │                │
│  │  (results     │  │  (hot cache)  │                │
│  │   cache)      │  │               │                │
│  └───────────────┘  └───────────────┘                │
└──────────────────────────────────────────────────────┘
```

**K8s requirements** (Phase 7, not started):
- Backend Deployment with HPA (CPU-based scaling)
- PersistentVolumeClaim for S4PRED weights (430MB, read-only)
- ConfigMap for environment variables
- Secret for Sentry DSN
- No GPU resources needed (CPU-only PyTorch)

---

## 5. Reliability & Observability

### Error Handling Strategy

| Layer | Strategy | Example |
|-------|----------|---------|
| **API entry** | FastAPI exception handlers → JSON error responses | Invalid file format → 400 |
| **Provider** | Independent try-catch per provider → graceful degradation | TANGO crash → UNAVAILABLE, rest continues |
| **Per-row** | Pydantic validation → skip invalid rows, log warning | Missing sequence → row skipped |
| **Sanitization** | NaN/Inf → null conversion → valid JSON guaranteed | Float overflow → null |

### Observability Stack

| Component | Tool | Status |
|-----------|------|--------|
| **Error tracking** | Sentry (optional) | Configured, requires DSN |
| **Request tracing** | Custom trace ID (ContextVar) | Active |
| **Structured logging** | JSON formatter with trace_id | Active |
| **Health check** | `GET /api/health` → provider status | Active |
| **Metrics** | None (Prometheus planned for K8s) | Not started |

### Reproducibility

Every response includes reproducibility primitives:

| Field | Purpose |
|-------|---------|
| `runId` | UUID4 unique to this analysis run |
| `traceId` | Request trace ID for log correlation |
| `inputsHash` | SHA256 of input data (first 16 chars) — same input → same hash |
| `configHash` | SHA256 of configuration — same config → same hash |
| `thresholdConfigResolved` | Exact thresholds used for FF flags |

If two runs produce different results, compare `inputsHash` and `configHash` to determine if inputs or configuration changed.

---

## 6. Security Considerations

### Current Posture

| Concern | Status | Detail |
|---------|--------|--------|
| **Authentication** | None | Pre-paper, internal use only. Planned for post-paper. |
| **CORS** | Configured | Allowed origins set via `CORS_ORIGINS` env var. |
| **Input validation** | Active | Pydantic validates all inputs. File size limits in upload. |
| **SQL injection** | N/A | No database. |
| **File upload** | Sandboxed | Files parsed in memory, never written to disk. |
| **TANGO subprocess** | Controlled | Arguments sanitized. No user-controlled shell commands. |
| **Secrets** | Env vars | Sentry DSN via environment. No hardcoded credentials. |
| **HTTPS** | Ready | Caddy auto-HTTPS configured, pending domain. |

### Risks

1. **No authentication**: Anyone with network access can upload and analyze. Acceptable for internal DESY deployment behind VPN.
2. **No rate limiting**: A flood of requests could exhaust memory (S4PRED at ~1GB per worker). Mitigated by K8s resource limits (future).
3. **TANGO binary**: External binary runs as subprocess. Attack surface is limited (input is amino acid sequences, max ~10KB).

---

## 7. Cost Model

| Resource | Cost | Notes |
|----------|------|-------|
| **Compute** | Free | DESY Kubernetes cluster (institutional) |
| **Storage** | Free | DESY PVC (institutional) |
| **HTTPS certificates** | Free | Caddy + Let's Encrypt |
| **CI/CD** | Free | GitHub Actions (free tier sufficient) |
| **Container registry** | Free | GitHub Container Registry (GHCR) |
| **Monitoring** | Free | Sentry free tier (5000 errors/month) |
| **External APIs** | Free | UniProt API (public, no auth required) |
| **ML models** | Free | S4PRED weights (open source) |
| **TANGO** | Free | Academic license |

**Total operational cost: $0/month**

All infrastructure runs on DESY institutional resources. The only external dependency (UniProt API) is public and free.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S4PRED weights corrupted/lost | Low | High (no ML predictions) | Backup in reference repo. PVC with snapshots. |
| TANGO binary incompatible with new OS | Medium | Low (S4PRED is primary) | Pin Docker base image. TANGO is secondary. |
| UniProt API downtime | Medium | Medium (no UniProt queries) | Graceful error message. CSV upload unaffected. |
| Large upload OOM | Medium | Medium (request fails) | K8s memory limits + HPA. Log trace_id for debugging. |
| S4PRED slow for large datasets | High | Low (user waits longer) | Future: GPU inference, result caching, precompute. |
| Schema drift (backend/frontend) | Low | High (broken UI) | `api_models.py` is protected. Contract tests (40+). |

---

## 9. Technology Decisions Log

| Date | Decision | Rationale | Reversibility |
|------|----------|-----------|---------------|
| 2026-01 | FastAPI over Flask | Async support, Pydantic v2 integration, auto-docs | Low (significant rewrite) |
| 2026-01 | CPU-only PyTorch | No GPU available at DESY K8s. Saves ~1.8GB in Docker image. | Easy (add GPU index) |
| 2026-01 | Volume-mounted tools | S4PRED weights (430MB) and TANGO binary not baked into image. Flexibility for updates. | Easy (bake in instead) |
| 2026-02 | Remove PSIPRED/JPred | External server dependencies, unreliable, redundant with S4PRED | Medium (would need to re-add integration code) |
| 2026-02 | Caddy over Nginx for HTTPS | Auto-certificate management, simpler config, zero-downtime renewal | Easy (Nginx config also available) |
| 2026-02 | No database (pre-paper) | Simplicity. Stateless = fewer bugs, easier deployment | Easy (add Postgres layer) |
| 2026-02 | Database-avg thresholds for FF flags | Matches reference implementation. Thresholds adapt to each dataset. | N/A (scientific decision) |
| 2026-02 | `null` only for missing data | No sentinel values (-1, "N/A", empty string). Except: -1 is valid for prediction fields. | N/A (API contract locked) |

---

*For detailed code-level reference, see `docs/DEVELOPER_REFERENCE.md`.
For non-technical explanation, see `docs/TEAM_GUIDE.md`.
For the full technical guide, see `docs/MASTER_GUIDE.md`.*
