# Peptide Visual Lab (PVL) - Complete Development Roadmap

**Last Updated**: 2026-02-01
**Status**: Active Development
**Target**: Production-ready Kubernetes deployment with CI/CD

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Ultimate Vision](#ultimate-vision)
3. [Current State](#current-state)
4. [Phase 0: Canonical Contracts](#phase-0-canonical-contracts)
5. [External Repository Integration](#external-repository-integration)
6. [Phase A: Immediate Fixes & Stabilization](#phase-a-immediate-fixes--stabilization)
7. [Phase B: Prediction Tool Integration](#phase-b-prediction-tool-integration)
8. [Phase C: UI/UX Improvements](#phase-c-uiux-improvements)
9. [Phase D: Dockerization](#phase-d-dockerization)
10. [Phase E: Kubernetes Deployment](#phase-e-kubernetes-deployment)
11. [Phase F: CI/CD with ArgoCD](#phase-f-cicd-with-argocd)
12. [Phase G: Observability & Maintenance](#phase-g-observability--maintenance)
13. [Architecture Vision](#architecture-vision)
14. [File Reference](#file-reference)
15. [Testing Strategy](#testing-strategy)
16. [Risk Mitigation](#risk-mitigation)
17. [Execution Workflow (Claude Code)](#execution-workflow-claude-code)
18. [Decisions Needed](#decisions-needed)

---

## Executive Summary

Peptide Visual Lab (PVL) is a bioinformatics web application for predicting fibril-forming properties of peptides. The application consists of:

- **Backend**: FastAPI Python server with prediction pipelines (TANGO, S4Pred)
- **Frontend**: React/TypeScript UI for data visualization and interaction
- **Prediction Tools**: TANGO (aggregation propensity), S4Pred (secondary structure)

---

## Ultimate Vision

### Near-Term: On-Demand Prediction Service

A fully containerized, Kubernetes-native application with:
- GitOps deployment via ArgoCD
- Automated CI/CD pipeline (GitHub Actions)
- Real-time prediction capabilities
- Interactive visualization dashboards
- Multi-environment support (dev/staging/production)

### Long-Term: Precomputed Structural Proteome

The ultimate goal is a **precomputed structural proteome database**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRECOMPUTED STRUCTURAL PROTEOME                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 1 (Current): On-Demand Prediction                                 │
│  ├── User uploads peptides → Run TANGO/S4Pred → Return results          │
│  └── Latency: seconds to minutes depending on batch size                │
│                                                                          │
│  Phase 2 (Future): Hybrid Mode                                           │
│  ├── Check precomputed cache first → Run prediction only if miss        │
│  ├── Background job to precompute common organisms/keywords             │
│  └── Latency: milliseconds for cache hits, seconds for misses           │
│                                                                          │
│  Phase 3 (Vision): Full Proteome Coverage                                │
│  ├── Precompute all UniProt sequences (scheduled batch jobs)            │
│  ├── Real-time prediction only for novel/custom sequences               │
│  ├── API serves from indexed database (PostgreSQL/ElasticSearch)        │
│  └── Latency: milliseconds for all queries                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architectural Implications for Precomputation

1. **Database Layer** (Future)
   - PostgreSQL for structured peptide data
   - ElasticSearch for fast sequence similarity search
   - Redis for hot cache of frequent queries

2. **Batch Processing** (Future)
   - Kubernetes CronJobs for scheduled precomputation
   - Queue-based processing (Redis/RabbitMQ) for large batches
   - Checkpointing for resumable computation

3. **API Design** (Current consideration)
   - Design response schemas to be source-agnostic (precomputed vs on-demand)
   - Include `computedAt` timestamp and `source` field in responses
   - Provider status must distinguish "cached" vs "computed" vs "unavailable"

4. **Storage Estimates** (Planning)
   - ~250M sequences in UniProt → ~50TB raw prediction data
   - Compression + indexing → ~5-10TB practical storage
   - Start with top 10 organisms (~10% of UniProt)

**Current Focus**: Build the on-demand system correctly first. The precomputation layer will be added on top without breaking existing APIs.

---

## Current State

### What Works
- FastAPI backend with structured JSON logging
- File upload (CSV/TSV/XLSX) with peptide parsing
- UniProt query integration (search, parse, window)
- Biochemical calculations (Charge, Hydrophobicity, μH)
- FF-Helix % computation (deterministic, no external dependency)
- Provider status tracking and reporting
- Trace ID propagation for request correlation
- Sentry integration for error tracking
- React frontend with results table and filtering

### Recent Fixes (2026-02-01)

1. **Environment Variable Caching Fix**
   - Problem: `USE_TANGO=1` in `.env` was ignored; showed "disabled"
   - Root cause: Provider flags cached at module load time
   - Solution: Changed all files to read `settings.USE_*` dynamically
   - Files changed:
     - `backend/services/upload_service.py`
     - `backend/services/predict_service.py`
     - `backend/services/example_service.py`
     - `backend/server.py`

2. **Circular Import Fix**
   - Problem: Tests failed with circular import error
   - Root cause: `api/routes/*.py` → `server.py` → `api/main.py` cycle
   - Solution: Changed to local imports in route handlers
   - Files changed:
     - `backend/api/routes/upload.py`
     - `backend/api/routes/predict.py`
     - `backend/api/routes/uniprot.py`
     - `backend/api/routes/feedback.py`

3. **Debug Configuration Endpoint**
   - Added `/api/debug/config` endpoint for diagnosing configuration issues
   - Shows: current settings, raw env vars, .env file contents
   - File: `backend/api/routes/health.py`

### What's Not Working / Incomplete
- TANGO binary execution (Docker/host mode) - needs proper binary
- PSIPRED disabled - being replaced by S4Pred
- SSW predictions showing N/A when TANGO unavailable
- UI has unnecessary 3-step mapping wizard
- No meaningful visualization graphs
- **Schema inconsistencies** (see Phase 0)

---

## Phase 0: Canonical Contracts

**Timeline**: BEFORE any Phase A-G work
**Priority**: CRITICAL (Hard Gate)
**Goal**: Single source of truth for all data shapes

### Why This Phase Exists

The codebase currently has:
- Mixed naming: `chameleon_positive` vs `chameleonPositive` vs `FF-Helix %`
- Inconsistent null handling: `None` vs `"N/A"` vs `-1` vs `null`
- Schema defined in multiple places (`api_models.py`, `normalize.py`, inline dicts)
- Frontend TypeScript types that may not match backend Pydantic models

**No feature work should proceed until contracts are locked.**

### 0.1 Schema Location Decision

**DECISION REQUIRED**: Canonical schemas live in ONE place only.

**Recommendation**: `backend/schemas/api_models.py`

```
backend/schemas/
├── api_models.py      # ← CANONICAL: All Pydantic response models
├── peptide.py         # Internal DataFrame column definitions (snake_case)
├── uniprot_query.py   # UniProt-specific request/response models
└── feedback.py        # Feedback request model
```

**Rules**:
- `api_models.py` defines the **external API contract** (camelCase)
- `peptide.py` defines **internal DataFrame columns** (snake_case)
- `normalize.py` transforms internal → external using `api_models.py` as source of truth
- Frontend TypeScript types are **generated from** or **manually synced with** `api_models.py`

### 0.2 Document All Inconsistencies

Before fixing, audit and document:

| Field | Current Variants | Canonical Name | Type | Null Representation |
|-------|-----------------|----------------|------|---------------------|
| Entry ID | `Entry`, `id`, `ID`, `Accession` | `id` | `str` | Never null |
| Sequence | `Sequence`, `sequence` | `sequence` | `str` | Never null |
| SSW Prediction | `SSW prediction`, `sswPrediction` | `sswPrediction` | `int \| null` | `null` (not -1, not "N/A") |
| FF-Helix % | `FF-Helix %`, `ffHelixPercent`, `FF Helix %` | `ffHelixPercent` | `float \| null` | `null` |
| Hydrophobicity | `Hydrophobicity`, `hydrophobicity` | `hydrophobicity` | `float \| null` | `null` |
| Charge | `Charge`, `charge` | `charge` | `float \| null` | `null` |
| μH | `μH`, `muH`, `uH` | `muH` | `float \| null` | `null` |
| Chameleon | `chameleon_positive`, `chameleonPositive` | `chameleonPositive` | `bool \| null` | `null` |

### 0.3 Define Canonical Pydantic Models

```python
# backend/schemas/api_models.py

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PeptideRow(BaseModel):
    """Canonical peptide row schema. This is the contract with frontend."""

    # Required fields (never null)
    id: str = Field(..., description="Entry/Accession ID")
    sequence: str = Field(..., description="Amino acid sequence")
    length: int = Field(..., description="Sequence length")

    # Biochemical properties (nullable)
    hydrophobicity: Optional[float] = Field(None, description="Kyte-Doolittle hydrophobicity")
    charge: Optional[float] = Field(None, description="Net charge at pH 7")
    muH: Optional[float] = Field(None, description="Hydrophobic moment (μH)")

    # FF-Helix prediction (always computed, never null)
    ffHelixPercent: float = Field(..., description="FF-Helix percentage (0-100)")

    # SSW/TANGO predictions (nullable when provider unavailable)
    sswPrediction: Optional[int] = Field(None, description="SSW prediction (1=positive, 0=negative, null=unavailable)")
    sswScore: Optional[float] = Field(None, description="SSW score")
    sswDiff: Optional[float] = Field(None, description="SSW diff value")
    sswHelixPercentage: Optional[float] = Field(None, description="SSW helix %")
    sswBetaPercentage: Optional[float] = Field(None, description="SSW beta %")

    # Secondary structure (nullable when provider unavailable)
    helixPercent: Optional[float] = Field(None, description="Helix % from S4Pred")
    betaPercent: Optional[float] = Field(None, description="Beta % from S4Pred")

    # Derived flags
    chameleonPositive: Optional[bool] = Field(None, description="Chameleon sequence flag")

    # Provider status (per-row, when relevant)
    providerStatus: Optional[Dict[str, Any]] = Field(None, description="Provider status for this row")

    class Config:
        # Enforce camelCase in JSON output
        populate_by_name = True
```

### 0.4 Migrate normalize.py

`normalize.py` currently does ad-hoc dict construction. It must be refactored to:

1. **Use Pydantic models for serialization**
2. **Remove all inline field name mappings**
3. **Single mapping table** from internal (snake_case) to external (camelCase)

```python
# backend/services/normalize.py (target state)

from schemas.api_models import PeptideRow

# Single source of truth for column mapping
INTERNAL_TO_EXTERNAL = {
    "Entry": "id",
    "Sequence": "sequence",
    "Length": "length",
    "Hydrophobicity": "hydrophobicity",
    "Charge": "charge",
    "μH": "muH",
    "FF-Helix %": "ffHelixPercent",
    "SSW prediction": "sswPrediction",
    "SSW score": "sswScore",
    "SSW diff": "sswDiff",
    "SSW helix percentage": "sswHelixPercentage",
    "SSW beta percentage": "sswBetaPercentage",
    # ... complete mapping
}


def normalize_row(row: pd.Series) -> PeptideRow:
    """Convert internal DataFrame row to canonical Pydantic model."""
    data = {}
    for internal_name, external_name in INTERNAL_TO_EXTERNAL.items():
        if internal_name in row:
            value = row[internal_name]
            # Normalize null representations
            if pd.isna(value) or value == -1 or value == "N/A":
                data[external_name] = None
            else:
                data[external_name] = value

    return PeptideRow(**data)


def normalize_rows_for_ui(df: pd.DataFrame, **kwargs) -> List[dict]:
    """Convert DataFrame to list of canonical dicts."""
    rows = []
    for _, row in df.iterrows():
        peptide = normalize_row(row)
        rows.append(peptide.model_dump(by_alias=True, exclude_none=False))
    return rows
```

### 0.5 Sync TypeScript Types

After Pydantic models are canonical, sync TypeScript:

```typescript
// ui/src/types/peptide.ts (must match api_models.py)

export interface PeptideRow {
  // Required
  id: string;
  sequence: string;
  length: number;

  // Biochemical (nullable)
  hydrophobicity: number | null;
  charge: number | null;
  muH: number | null;

  // FF-Helix (never null)
  ffHelixPercent: number;

  // SSW/TANGO (nullable)
  sswPrediction: number | null;  // 1, 0, or null
  sswScore: number | null;
  sswDiff: number | null;
  sswHelixPercentage: number | null;
  sswBetaPercentage: number | null;

  // Secondary structure (nullable)
  helixPercent: number | null;
  betaPercent: number | null;

  // Derived
  chameleonPositive: boolean | null;

  // Provider status
  providerStatus?: Record<string, unknown>;
}
```

### 0.6 Migration Plan (One File at a Time)

**HARD GATE**: Each step requires explicit approval before proceeding.

1. **Step 0.6.1**: Update `api_models.py` with canonical `PeptideRow`
   - [ ] Approval to proceed
   - [ ] Tests pass after change

2. **Step 0.6.2**: Update `normalize.py` to use `PeptideRow`
   - [ ] Approval to proceed
   - [ ] Tests pass after change

3. **Step 0.6.3**: Update `/api/upload-csv` to use new normalize
   - [ ] Approval to proceed
   - [ ] Tests pass after change

4. **Step 0.6.4**: Update `/api/predict` to use new normalize
   - [ ] Approval to proceed
   - [ ] Tests pass after change

5. **Step 0.6.5**: Update `/api/uniprot/execute` to use new normalize
   - [ ] Approval to proceed
   - [ ] Tests pass after change

6. **Step 0.6.6**: Update TypeScript types to match
   - [ ] Approval to proceed
   - [ ] Frontend builds without errors

---

## External Repository Integration

### Critical: Finalized Prediction Tools Repository

There exists a **separate finalized repository** containing:
- Working TANGO binary and execution scripts
- Working S4Pred implementation (replaces PSIPRED)
- Correct output parsing for both tools
- Validated input/output formats

### Integration Strategy Decision

**DECISION REQUIRED**: How to include external tools.

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Vendor (copy into repo)** | Simple, no external deps | Large repo size, manual updates | **Use for S4Pred model** |
| **Git Submodule** | Version controlled, smaller repo | Complex workflow, submodule hell | Not recommended |
| **Download at build time** | Smallest repo, always latest | Requires network, version drift | **Use for TANGO binary** |

**Recommended Approach**:
- **TANGO binary**: Download at Docker build time from a release URL
- **S4Pred model**: Vendor into `backend/tools/s4pred/` (models change rarely)
- **Both**: Define clear interface contracts (see below)

### Tool Runner Interface Contract

All prediction tools must implement this interface:

```python
# backend/services/tool_interface.py

from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ToolResult:
    """Result from a prediction tool."""
    entry_id: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class ToolStats:
    """Statistics from a tool run."""
    requested: int
    success: int
    failed: int
    runtime_ms: int


class PredictionTool(ABC):
    """Abstract base class for prediction tools."""

    @abstractmethod
    def get_name(self) -> str:
        """Return tool name (e.g., 'TANGO', 'S4Pred')."""
        pass

    @abstractmethod
    def is_available(self) -> Tuple[bool, Optional[str]]:
        """Check if tool is available. Returns (available, reason_if_not)."""
        pass

    @abstractmethod
    def run(self, sequences: List[Tuple[str, str]]) -> Tuple[List[ToolResult], ToolStats]:
        """
        Run prediction on sequences.

        Args:
            sequences: List of (entry_id, sequence) tuples

        Returns:
            Tuple of (results, stats)
        """
        pass
```

### Provider Status Contract

Provider status must follow this structure:

```python
# Provider status shape (for API responses)
{
    "tango": {
        "status": "AVAILABLE" | "UNAVAILABLE" | "OFF" | "PARTIAL",
        "reason": str | None,  # Human-readable reason if not AVAILABLE
        "stats": {
            "requested": int,
            "success": int,  # Renamed from parsed_ok
            "failed": int,   # Renamed from parsed_bad
            "runtime_ms": int
        }
    },
    "s4pred": {
        "status": "AVAILABLE" | "UNAVAILABLE" | "OFF" | "PARTIAL",
        "reason": str | None,
        "stats": {
            "requested": int,
            "success": int,
            "failed": int,
            "runtime_ms": int
        }
    }
}
```

### Integration Tasks

```
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL REPO (Finalized)          CURRENT REPO (This)         │
├─────────────────────────────────────────────────────────────────┤
│  tango/                      →      Downloaded at build time    │
│    ├── tango_binary                   via Dockerfile            │
│    ├── run_tango.sh                                             │
│    └── parse_output.py       →      backend/tango.py (adapt)    │
│                                                                 │
│  s4pred/                     →      backend/tools/s4pred/       │
│    ├── s4pred_model/                  ├── model/ (vendored)     │
│    ├── run_s4pred.py                  ├── runner.py             │
│    └── parse_output.py                └── parser.py             │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Steps

1. **Audit external repo structure**
   - Document file locations and dependencies
   - Identify required system libraries
   - Note Python version requirements

2. **Implement tool interface**
   - Create `backend/services/tool_interface.py`
   - Implement `TangoTool(PredictionTool)`
   - Implement `S4PredTool(PredictionTool)`

3. **Update Dockerfile for TANGO**
   - Add download step for TANGO binary
   - Set `TANGO_BINARY_PATH` environment variable

4. **Vendor S4Pred model**
   - Copy model files to `backend/tools/s4pred/model/`
   - Add to `.gitignore` if >100MB (use Git LFS)

5. **Test integration**
   - Unit tests for tool interface
   - Integration tests with sample sequences
   - End-to-end API tests

---

## Phase A: Immediate Fixes & Stabilization

**Timeline**: Week 1 (AFTER Phase 0 complete)
**Priority**: Critical
**Goal**: Stable foundation for further development

### A.1 Verify Current Fixes

- [x] Environment variable caching fix verified
- [x] Circular import fix verified
- [x] All 49 tests passing
- [x] Debug endpoint working

### A.2 Configuration Cleanup

```python
# backend/config.py additions needed:

# S4Pred Configuration (NEW)
USE_S4PRED: bool = _env_bool("USE_S4PRED", True)
"""Enable S4Pred provider (replaces PSIPRED)"""

S4PRED_MODEL_PATH: Optional[str] = os.getenv("S4PRED_MODEL_PATH")
"""Path to S4Pred model directory"""

S4PRED_RUNTIME_DIR: Optional[str] = os.getenv("S4PRED_RUNTIME_DIR")
"""S4Pred runtime directory (default: backend/.run_cache/S4Pred)"""

# TANGO Configuration (verify/update)
TANGO_BINARY_PATH: Optional[str] = os.getenv("TANGO_BINARY_PATH")
"""Path to TANGO binary executable"""
```

### A.3 Environment Template

Create/update `backend/.env.example`:

```bash
# Provider Flags
USE_TANGO=1
USE_S4PRED=1
USE_JPRED=0  # Deprecated, always disabled

# TANGO Configuration
TANGO_MODE=simple  # 'simple' or 'docker'
TANGO_BINARY_PATH=/path/to/tango/binary
TANGO_RUNTIME_DIR=.run_cache/Tango

# S4Pred Configuration
S4PRED_MODEL_PATH=/path/to/s4pred/model
S4PRED_RUNTIME_DIR=.run_cache/S4Pred

# Server Configuration
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=development

# Observability
SENTRY_DSN=
LOG_LEVEL=INFO
```

### A.4 Deprecation Cleanup

Remove or deprecate:
- `USE_PSIPRED` → Replace with `USE_S4PRED`
- `PSIPRED_*` config options → Replace with `S4PRED_*`
- JPred references → Already marked as deprecated

---

## Phase B: Prediction Tool Integration

**Timeline**: Weeks 2-3
**Priority**: High
**Goal**: Working TANGO and S4Pred predictions

### B.1 TANGO Integration

#### Current State
- `backend/tango.py` exists with parsing logic
- `run_tango_simple()` function expects binary
- Output parsing expects specific file format

#### Tasks

1. **Implement TangoTool class**
   ```python
   # backend/tools/tango_tool.py

   class TangoTool(PredictionTool):
       def get_name(self) -> str:
           return "TANGO"

       def is_available(self) -> Tuple[bool, Optional[str]]:
           binary_path = settings.TANGO_BINARY_PATH
           if not binary_path:
               return False, "TANGO_BINARY_PATH not configured"
           if not os.path.exists(binary_path):
               return False, f"Binary not found at {binary_path}"
           return True, None

       def run(self, sequences: List[Tuple[str, str]]) -> Tuple[List[ToolResult], ToolStats]:
           # Implementation using existing tango.py logic
           pass
   ```

2. **Update Dockerfile**
   ```dockerfile
   # Download TANGO binary at build time
   ARG TANGO_VERSION=2.3.1
   RUN curl -L "https://releases.example.com/tango/${TANGO_VERSION}/tango-linux-amd64" \
       -o /usr/local/bin/tango && chmod +x /usr/local/bin/tango
   ENV TANGO_BINARY_PATH=/usr/local/bin/tango
   ```

### B.2 S4Pred Integration

#### Overview
S4Pred replaces PSIPRED for secondary structure prediction.

#### Tasks

1. **Implement S4PredTool class**
   ```python
   # backend/tools/s4pred_tool.py

   class S4PredTool(PredictionTool):
       def get_name(self) -> str:
           return "S4Pred"

       def is_available(self) -> Tuple[bool, Optional[str]]:
           model_path = settings.S4PRED_MODEL_PATH
           if not model_path:
               return False, "S4PRED_MODEL_PATH not configured"
           if not os.path.exists(model_path):
               return False, f"Model not found at {model_path}"
           return True, None

       def run(self, sequences: List[Tuple[str, str]]) -> Tuple[List[ToolResult], ToolStats]:
           # Implementation based on external repo
           pass
   ```

2. **Vendor model files**
   - Copy from external repo to `backend/tools/s4pred/model/`

### B.3 Testing

1. **Unit tests for tool interface**
2. **Integration tests with mock tools**
3. **E2E tests with real binaries (CI only)**

---

## Phase C: UI/UX Improvements

**Timeline**: Weeks 3-4
**Priority**: Medium
**Goal**: Streamlined user experience with meaningful visualizations

### C.1 Remove 3-Step Mapping Wizard

#### Current Flow (To Remove)
```
Upload → Step 1: Select Entry Column → Step 2: Select Sequence Column → Step 3: Confirm → Results
```

#### New Flow
```
Upload → Auto-detect columns → Results (with validation banner if issues)
```

### C.2 Add Visualization Graphs

1. Hydrophobicity Distribution (histogram)
2. FF-Helix % vs SSW Prediction (scatter)
3. Sequence Length Distribution (bar chart)
4. Provider Status Dashboard

### C.3 Results Table Improvements

1. Column visibility toggle
2. Advanced filtering
3. Sorting indicators
4. Row selection for batch operations
5. Export selected rows

---

## Phase D: Dockerization

**Timeline**: Week 5
**Priority**: High
**Goal**: Fully containerized application

### D.1 Directory Structure

```
docker/
├── Dockerfile.backend      # FastAPI backend
├── Dockerfile.frontend     # React frontend (nginx)
├── docker-compose.yml      # Local development
├── docker-compose.prod.yml # Production stack
└── nginx.conf              # Frontend nginx config
```

### D.2 Backend Dockerfile

```dockerfile
# docker/Dockerfile.backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Download TANGO binary
ARG TANGO_URL
RUN if [ -n "$TANGO_URL" ]; then \
    curl -L "$TANGO_URL" -o /usr/local/bin/tango && \
    chmod +x /usr/local/bin/tango; \
    fi
ENV TANGO_BINARY_PATH=/usr/local/bin/tango

# Copy requirements first (layer caching)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Copy S4Pred model (vendored)
COPY backend/tools/s4pred/model /app/tools/s4pred/model
ENV S4PRED_MODEL_PATH=/app/tools/s4pred/model

# Set environment
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### D.3 Docker Compose (Development)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ..
      dockerfile: docker/Dockerfile.backend
      args:
        TANGO_URL: ${TANGO_DOWNLOAD_URL:-}
    ports:
      - "8000:8000"
    volumes:
      - ../backend:/app
      - run-cache:/app/.run_cache
    environment:
      - USE_TANGO=1
      - USE_S4PRED=1
      - ENVIRONMENT=development
      - LOG_LEVEL=DEBUG
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build:
      context: ..
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  run-cache:
```

---

## Phase E: Kubernetes Deployment

**Timeline**: Weeks 6-7
**Priority**: High
**Goal**: Production-ready Kubernetes manifests

(See full K8s manifests in original document - unchanged)

---

## Phase F: CI/CD with ArgoCD

**Timeline**: Week 8
**Priority**: High
**Goal**: GitOps workflow with automated deployments

### CI Platform: GitHub Actions (Canonical)

**Note**: All CI/CD uses GitHub Actions. No GitLab configuration.

### F.1 GitHub Actions Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests
        run: |
          cd backend
          USE_TANGO=0 USE_S4PRED=0 pytest tests/ -v

      - name: Lint
        run: |
          cd backend
          ruff check .

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:latest

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.frontend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:latest
```

### F.2 ArgoCD Application

(See original document - unchanged)

---

## Phase G: Observability & Maintenance

(See original document - unchanged)

---

## Architecture Vision

(See original document - unchanged)

---

## File Reference

### Canonical Schema Location

**SINGLE SOURCE OF TRUTH**: `backend/schemas/api_models.py`

| File | Purpose | Authority |
|------|---------|-----------|
| `backend/schemas/api_models.py` | **CANONICAL** API response schemas | Defines external contract |
| `backend/schemas/peptide.py` | Internal DataFrame column names | Defines internal naming |
| `backend/services/normalize.py` | Transforms internal → external | Uses api_models.py |
| `ui/src/types/peptide.ts` | TypeScript types | Must match api_models.py |

### Critical Files (Do Not Modify Without Approval)

| File | Purpose | Notes |
|------|---------|-------|
| `backend/schemas/api_models.py` | API response schemas | **CANONICAL CONTRACT** |
| `backend/config.py` | Centralized configuration | All env vars |
| `backend/server.py` | Main endpoint implementations | Core logic |
| `backend/services/normalize.py` | Response normalization | Must use api_models.py |

### Hot Files (Frequently Modified)

| File | Purpose |
|------|---------|
| `backend/tango.py` | TANGO execution and parsing |
| `backend/tools/s4pred_tool.py` | S4Pred execution (NEW) |
| `backend/services/upload_service.py` | Upload processing |
| `backend/services/predict_service.py` | Single sequence prediction |
| `ui/src/pages/Results.tsx` | Results display |
| `ui/src/pages/QuickAnalyze.tsx` | File upload UI |

---

## Testing Strategy

### Test Levels

1. **Unit Tests** (`backend/tests/test_*.py`)
   - Fast, no external dependencies
   - Run with `USE_TANGO=0 USE_S4PRED=0`
   - Target: 80% code coverage

2. **Contract Tests** (NEW)
   - Verify API responses match `api_models.py` schemas
   - Run after any schema change

3. **Integration Tests**
   - Test with mock providers
   - Verify API contracts
   - Test error handling

4. **End-to-End Tests**
   - Full pipeline with real tools
   - Run in CI with Docker
   - Slower, comprehensive

### Running Tests

```bash
# Unit tests (fast)
cd backend && USE_TANGO=0 USE_S4PRED=0 pytest tests/ -v

# Contract tests
pytest tests/test_api_contracts.py -v

# With coverage
pytest tests/ --cov=. --cov-report=html
```

---

## Risk Mitigation

(See original document - unchanged)

---

## Execution Workflow (Claude Code)

### Core Principles

1. **Issue Register First**: Every change starts with documenting what will change
2. **Approval Gates**: No code changes without explicit user approval
3. **One Issue at a Time**: Complete and verify each change before starting next
4. **Tests After Each Change**: Run tests immediately after each modification

### Workflow Steps

```
┌──────────────────────────────────────────────────────────────────────┐
│                    EXECUTION WORKFLOW                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. ISSUE REGISTER                                                    │
│     ├── Document: What file(s) will change                           │
│     ├── Document: What the change does                               │
│     ├── Document: Why it's needed                                    │
│     └── Document: What tests will verify it                          │
│                                                                       │
│  2. APPROVAL GATE                                                     │
│     ├── Present issue register to user                               │
│     ├── WAIT for explicit "approved" or "proceed"                    │
│     └── If rejected: revise and re-present                           │
│                                                                       │
│  3. SINGLE FILE CHANGE                                                │
│     ├── Make the smallest possible change                            │
│     ├── Prefer Edit over Write (preserve existing code)              │
│     └── NO other files modified in same step                         │
│                                                                       │
│  4. IMMEDIATE VERIFICATION                                            │
│     ├── Run: python3 -m py_compile <file>                            │
│     ├── Run: pytest tests/ (relevant tests)                          │
│     └── Report: pass/fail status                                     │
│                                                                       │
│  5. CHECKPOINT                                                        │
│     ├── If tests pass: report success, ask about next issue          │
│     └── If tests fail: fix immediately before any new work           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Example Issue Register

```markdown
## Issue Register: Update PeptideRow schema

**File**: `backend/schemas/api_models.py`

**Change**: Add `computedAt` field to PeptideRow model

**Reason**: Support future precomputation feature; need to track when predictions were made

**Tests**:
- `test_api_contracts.py::test_peptide_row_schema`
- `test_upload_csv_rows_have_camelcase_keys`

**Dependencies**: None (additive change)

**Approval**: [ ] Pending
```

### What Claude Code Must NOT Do

- **NO** changing multiple files without approval between each
- **NO** "while I'm here" refactoring
- **NO** skipping tests after changes
- **NO** proceeding after test failures
- **NO** guessing at requirements—ask instead

### What Claude Code Must ALWAYS Do

- **ALWAYS** read file before editing
- **ALWAYS** present issue register before code changes
- **ALWAYS** wait for approval
- **ALWAYS** run tests after changes
- **ALWAYS** report test results

---

## Decisions (RESOLVED 2026-02-01)

### 1. Schema Canonical Location ✅

**Decision**: `backend/schemas/api_models.py` is the **single source of truth** for external API contracts.
- Internal models may live separately if needed
- External API contract lives ONLY in `api_models.py`

### 2. External Tool Integration Strategy ✅

**TANGO Binary**:
- Download at Docker build time for production
- Use `TANGO_BINARY_PATH` env var for local dev (fallback to tools cache)
- Do NOT commit large binaries

**S4Pred Model**:
- Do NOT commit large models unless using Git LFS
- Use `S4PRED_MODEL_PATH` env var for local dev
- Production: download at build time from artifact location OR Git LFS if accepted

**Both tools**: Must follow consistent runner/parser interface, map strictly to canonical schemas.

### 3. Null Representation ✅

**Decision**: Use JSON `null` with `Optional` fields.
- Never use `"N/A"` strings
- Never use `-1` as sentinel
- Avoid mixed representations

### 4. Phase 0 Execution ✅

**Decision**: **HARD GATE**
- No parallel tool/UI work until Phase 0 complete
- Canonical contracts + TS types + normalize migration path must be stable first

### 5. CI/CD Platform ✅

**Decision**: GitHub Actions for now, but **portable**:
- Real CI steps live in `Makefile` + `scripts/ci/`
- YAML wrapper can be rewritten for GitLab later
- Only YAML changes needed to switch platforms

---

*This document is the single source of truth for PVL development. Last updated: 2026-02-01*
