# Peptide Visual Lab (PVL) - Master Guide

**Last Updated**: 2026-02-07
**Audience**: Developers, scientists, and onboarding collaborators
**Branch**: `ref-impl-replacement`

---

## Table of Contents

1. [What is PVL?](#1-what-is-pvl)
2. [User Journey](#2-user-journey)
3. [Architecture Overview](#3-architecture-overview)
4. [File-by-File Explanation](#4-file-by-file-explanation)
5. [Code Flow Walkthrough](#5-code-flow-walkthrough)
6. [The Science](#6-the-science)
7. [Configuration & Deployment](#7-configuration--deployment)
8. [Testing](#8-testing)
9. [Future Roadmap](#9-future-roadmap)

---

## 1. What is PVL?

Peptide Visual Lab is a web application for predicting **fibril-forming properties** of peptides. It combines:

- **Biophysical calculations**: Charge, hydrophobicity, hydrophobic moment (muH)
- **Secondary structure prediction**: S4PRED (neural network ensemble)
- **Aggregation prediction**: TANGO (binary tool)
- **Fibril-forming classification**: FF-Helix and FF-SSW binary flags

Users upload peptide sequences (CSV/XLSX or UniProt query) and receive a results dashboard with per-peptide predictions, charts, and export options.

---

## 2. User Journey

### Path A: Upload CSV

1. **Upload page** (`/upload`) - User uploads a CSV/TSV/XLSX file with columns: `Entry`, `Sequence`
2. Backend parses the file, runs all predictions
3. **Results page** (`/results`) - Dashboard with:
   - KPI cards (total peptides, SSW positive %, mean hydrophobicity, mean charge)
   - Scatter charts (hydrophobicity vs charge, SSW distribution)
   - Sortable/filterable data table
4. **Peptide Detail** (`/peptide/:id`) - Click any row for deep-dive:
   - Per-residue probability curves (S4PRED helix/beta/coil)
   - Sliding-window profiles (hydrophobicity, muH)
   - TANGO aggregation curves

### Path B: Quick Analyze

1. **Quick Analyze page** (`/quick-analyze`) - Paste a single sequence
2. Backend runs all predictions for that one sequence
3. Results shown immediately (same detail view)

### Path C: UniProt Query

1. **Upload page** - Enter a UniProt query (e.g., `P53_HUMAN`, `organism:9606`, `keyword:antimicrobial`)
2. Backend fetches sequences from UniProt API
3. Same results pipeline as CSV upload

---

## 3. Architecture Overview

```
                    +-----------+
                    |  Browser  |
                    |  (React)  |
                    +-----+-----+
                          |
                    REST API (JSON)
                          |
                    +-----+-----+
                    |  FastAPI   |
                    |  Backend   |
                    +-----+-----+
                          |
              +-----------+-----------+
              |           |           |
         +----+---+  +---+----+  +---+----+
         | biochem |  | S4PRED |  | TANGO  |
         | (pure)  |  | (torch)|  | (binary|
         +---------+  +--------+  +--------+
```

### Technology Stack

| Layer | Technology | Key Details |
|-------|-----------|-------------|
| **Frontend** | React 18 + TypeScript | Vite, Zustand state, Recharts |
| **Backend** | FastAPI (Python 3.13) | Pydantic v2, pandas, PyTorch (CPU) |
| **S4PRED** | PyTorch GRU ensemble | 5x 86MB weight files, CPU inference |
| **TANGO** | Native binary | Runs as subprocess |
| **Docker** | Multi-stage builds | ~800MB target, CPU-only torch |
| **CI** | GitHub Actions | Lint + typecheck + 202 tests |

---

## 4. File-by-File Explanation

### Backend Core

| File | Lines | Purpose |
|------|-------|---------|
| `backend/server.py` | ~1500 | Main orchestrator. Contains legacy endpoint implementations for upload, predict, UniProt, and example flows. Routes to services. |
| `backend/api/main.py` | ~60 | FastAPI app creation, CORS, Sentry init, router registration. |
| `backend/api/routes/*.py` | ~50 each | Thin route handlers that call service functions. |
| `backend/config.py` | ~210 | Centralized settings loaded from environment variables. `USE_TANGO`, `USE_S4PRED`, paths, thresholds. |
| `backend/schemas/api_models.py` | ~200 | **CANONICAL** API contract. Pydantic models: `PeptideRow`, `Meta`, `RowsResponse`, `PredictResponse`. **PROTECTED - do not modify without coordination.** |
| `backend/schemas/peptide.py` | ~190 | Internal `PeptideSchema` with DataFrame column aliases (e.g., `"FF-Helix %"` -> `ff_helix_percent`). Handles snake_case -> camelCase conversion. |

### Prediction Modules

| File | Lines | Purpose |
|------|-------|---------|
| `backend/s4pred.py` | ~670 | S4PRED integration: `run_s4pred_database()` runs neural network, `analyse_s4pred_result()` extracts helix/SSW segments, `filter_by_s4pred_diff()` computes database-average SSW threshold. |
| `backend/tango.py` | ~1300 | TANGO integration: runs binary, parses output, extracts aggregation/helix/beta curves, `filter_by_avg_diff()` for SSW classification. |
| `backend/auxiliary.py` | ~370 | Shared helpers: `ff_helix_percent()` (Chou-Fasman propensity), `get_secondary_structure_segments()` (segment detection with gap merging), `find_secondary_structure_switch_segments()` (SSW overlap), `get_corrected_sequence()`. |
| `backend/biochem_calculation.py` | ~200 | Pure Python biochemistry: `total_charge()`, `hydrophobicity()`, `hydrophobic_moment()`. |
| `backend/tools/s4pred/` | ~330 total | S4PRED neural network: `network.py` (GRUnet + ensemble), `model.py` (singleton predictor), `utilities.py` (sequence encoding). |

### Services

| File | Lines | Purpose |
|------|-------|---------|
| `services/normalize.py` | ~740 | The data pipeline: `normalize_rows_for_ui()` converts DataFrame columns -> PeptideSchema -> camelCase API response. Handles null semantics, fake defaults, S4PRED/TANGO curves. |
| `services/upload_service.py` | ~790 | Upload CSV processing: file parsing, validation, FF-Helix computation, provider orchestration. |
| `services/predict_service.py` | ~250 | Single-sequence prediction: creates DataFrame, runs providers, normalizes response. |
| `services/dataframe_utils.py` | ~270 | DataFrame helpers: `ensure_ff_cols()`, `apply_ff_flags()`, `read_any_table()`. |
| `services/thresholds.py` | ~230 | Threshold resolution: default, recommended (data-driven), custom modes. |
| `services/provider_tracking.py` | ~100 | TANGO/S4PRED status tracking (AVAILABLE/UNAVAILABLE/PARTIAL/OFF). |

### Frontend Core

| File | Purpose |
|------|---------|
| `ui/src/pages/Results.tsx` | Main results dashboard with KPIs, charts, data table |
| `ui/src/pages/PeptideDetail.tsx` | Per-peptide deep-dive with per-residue curves |
| `ui/src/pages/Upload.tsx` | File upload and UniProt query interface |
| `ui/src/pages/QuickAnalyze.tsx` | Single-sequence analysis |
| `ui/src/stores/datasetStore.ts` | Zustand store: manages peptide data, metadata, API calls |
| `ui/src/lib/peptideMapper.ts` | Maps backend `ApiPeptideRow` -> frontend `Peptide` type |
| `ui/src/types/peptide.ts` | Core domain model: `Peptide`, `ProviderStatus`, `DatasetStats` |
| `ui/src/types/api.ts` | API response types: `ApiPeptideRow`, `ApiMeta` |
| `ui/src/components/ResultsKpis.tsx` | KPI card components |
| `ui/src/components/ResultsCharts.tsx` | Chart components (Recharts) |

---

## 5. Code Flow Walkthrough

### CSV Upload Flow (the main path)

```
browser: POST /api/upload-csv (multipart form)
   |
server.py:upload_csv()
   |
   +-- read_any_table(file_bytes, filename)    # Parse CSV/TSV/XLSX
   |   returns pd.DataFrame
   |
   +-- require_cols(df, ["Entry", "Sequence"])  # Validate columns
   |
   +-- ensure_ff_cols(df)                       # Compute FF-Helix % for each sequence
   |   calls auxiliary.ff_helix_percent(seq)    # Chou-Fasman sliding window
   |   calls auxiliary.ff_helix_cores(seq)      # Extract helix segments
   |
   +-- calc_biochem(df)                         # Charge, hydrophobicity, muH
   |
   +-- IF USE_TANGO:
   |   tango.run_tango_simple(records)          # Run binary on all sequences
   |   tango.process_tango_output(df)           # Parse output, add curves
   |   tango.filter_by_avg_diff(df)             # SSW classification
   |
   +-- IF USE_S4PRED:
   |   s4pred.run_s4pred_database(df)           # Run neural network
   |   s4pred.filter_by_s4pred_diff(df)         # SSW classification (database-avg)
   |
   +-- apply_ff_flags(df)                       # FF-SSW and FF-Helix binary flags
   |
   +-- normalize_rows_for_ui(df)                # DataFrame -> camelCase JSON
   |   PeptideSchema.model_validate(row)        # Validate through Pydantic
   |   PeptideSchema.to_camel_dict()            # Convert to camelCase
   |
   +-- return RowsResponse(rows=..., meta=...)  # Final API response
```

### S4PRED Prediction Flow (per sequence)

```
s4pred.run_s4pred_database(df)
   |
   for each row:
   |   predictor.predict_from_sequence(entry, seq)
   |   |
   |   +-- S4PRED ensemble (5 GRU models)
   |   |   Each: embedding(22,128) -> GRU(128,1024,3,bidirectional) -> Linear(2048,3)
   |   |   Average predictions with 0.2 weighting
   |   |
   |   returns {P_H: [...], P_E: [...], P_C: [...], ss_prediction: [...]}
   |
   s4pred.analyse_s4pred_result(prediction)
   |
   +-- _get_secondary_structure_segments(P_H, min_score=0.5)  # Helix segments
   +-- _get_secondary_structure_segments(P_E, min_score=0)     # Beta segments
   +-- _find_ssw_segments(swapped_helix, beta)                 # SSW overlap (helix/beta SWAPPED)
   +-- _calc_ssw_score_and_diff(helix, beta, ssw_segments)     # SSW score = H+B, diff = |H-B|
   |
   returns dict with 15+ columns per sequence

s4pred.filter_by_s4pred_diff(df)
   |
   +-- Compute avg_diff from rows WHERE ssw_diff >= 0
   +-- For each row: diff < avg_diff -> SSW positive (1), else -> negative (-1)
   +-- Sequences without data -> None
```

### Normalization Pipeline (DataFrame -> API JSON)

```
normalize_rows_for_ui(df)
   |
   for each row in df:
   |
   +-- PeptideSchema.model_validate(row_dict)
   |   Uses Field(alias="...") to map DataFrame columns:
   |   "FF-Helix %" -> ff_helix_percent
   |   "SSW prediction" -> ssw_prediction
   |   "Helix prediction (S4PRED)" -> s4pred_helix_prediction
   |
   +-- PeptideSchema.to_camel_dict()
   |   ff_helix_percent -> ffHelixPercent
   |   ssw_prediction -> sswPrediction
   |
   +-- _convert_fake_defaults_to_null(dict)
   |   -1.0 scores -> null (but NOT -1 predictions, which are valid)
   |
   +-- _sanitize_for_json(dict)
   |   NaN -> null, Inf -> null
   |
   returns list of camelCase dicts
```

---

## 6. The Science

### Fibril-Forming Peptide Classification

PVL predicts whether peptides can form fibrillar (amyloid-like) structures. This is relevant for:
- Identifying toxic/virulent peptides
- Understanding antimicrobial peptide mechanisms
- Designing peptide-based therapeutics

### Two Independent Classification Axes

**FF-Helix** (Fibril-Forming via Helix):
- Peptides with helical structure AND high hydrophobic moment (muH)
- Uses S4PRED helix prediction + database-average muH threshold
- Biological basis: amphipathic helices can stack to form fibrils

**FF-SSW** (Fibril-Forming via Secondary Structure Switch):
- Peptides with overlapping helix AND beta regions
- Uses TANGO or S4PRED to detect SSW regions
- Biological basis: sequences that switch between helix and beta are prone to aggregation

### Key Metrics Explained

| Metric | Source | Range | Meaning |
|--------|--------|-------|---------|
| **Charge** | Biochem calc | any float | Net charge at pH 7.4 |
| **Hydrophobicity** | Kyte-Doolittle | [-4.5, 4.5] | Average hydrophobicity |
| **muH** (hydrophobic moment) | Eisenberg formula | [0, ~5] | Amphipathicity as helix (angle=100) |
| **FF-Helix %** | Chou-Fasman propensity | [0, 100] | % of sequence in helix-prone windows |
| **SSW prediction** | TANGO/S4PRED | -1/0/1/null | Structural switch propensity |
| **SSW diff** | TANGO/S4PRED | float/null | |helix_score - beta_score| in SSW regions |
| **S4PRED helix %** | S4PRED neural net | [0, 100] | % predicted as helical by ML model |

### S4PRED Neural Network

- **Architecture**: Ensemble of 5 GRU networks (bidirectional, 3 layers)
- **Input**: Amino acid sequence (integer-encoded, 22 possible values)
- **Output**: Per-residue P(helix), P(beta), P(coil) probabilities
- **Weights**: 5 x 86MB files (`weights_1.pt` through `weights_5.pt`)
- **Inference**: CPU-only, ~1-2 seconds per sequence

---

## 7. Configuration & Deployment

### Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```bash
# Provider flags
USE_TANGO=0              # 1 to enable TANGO (requires binary)
USE_S4PRED=1             # 1 to enable S4PRED (requires weights)

# Server
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=development  # development | staging | production
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Tool paths (only needed when provider is enabled)
# TANGO_BINARY_PATH=/path/to/tango/binary
# S4PRED_MODEL_PATH=/path/to/s4pred/weights

# Observability (optional)
SENTRY_DSN=
LOG_LEVEL=INFO
```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (separate terminal)
cd ui
npm install
npm run dev
```

### Docker Deployment

```bash
# Development (hot reload)
docker compose -f docker/docker-compose.yml up

# Production with Nginx
docker compose -f docker/docker-compose.prod.yml up -d

# Production with Caddy (auto-HTTPS)
# 1. Set DOMAIN=your.domain.de in .env
# 2. Run:
docker compose -f docker/docker-compose.caddy.yml up -d
```

### S4PRED Weight Setup

S4PRED requires 5 weight files (~430MB total):
1. Set `S4PRED_MODEL_PATH=/path/to/weights/` in `.env`
2. Ensure files exist: `weights_1.pt` through `weights_5.pt`
3. Reference weights: `260120_Alpha_and_SSW_FF_Predictor/S4PRED/weights/`

---

## 8. Testing

```bash
# All tests (202 passing, deterministic, no network)
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v

# Or via Makefile
make test        # All tests
make test-unit   # Fast unit tests
make lint        # Python linting
make typecheck   # Type checking
make ci          # Full pipeline
```

### Test Categories

| Category | File | Tests | Coverage |
|----------|------|-------|----------|
| API contracts | `test_api_contracts.py` | ~40 | Endpoint shapes, status codes |
| S4PRED golden | `test_s4pred_golden.py` | 24 | Segment detection, SSW, filter_by_diff |
| FF-Helix golden | `test_ff_helix_golden.py` | 34 | Propensity calc, FF flags, helix uH |
| SSW golden | `test_ssw_golden.py` | ~20 | SSW segment merge, score/diff |
| Golden pipeline | `test_golden_pipeline.py` | ~30 | End-to-end DataFrame processing |
| Biochem | `test_biochem.py` | ~15 | Charge, hydrophobicity, muH |
| Preprocessing | `test_preprocessing.py` | ~10 | Sequence cleaning, validation |
| Trace ID | `test_trace_id.py` | 7 | Request tracing |
| UniProt | `test_uniprot_*.py` | ~10 | Query parsing, sorting |

---

## 9. Future Roadmap

### Completed (2026-02-07)

| Phase | What | Status |
|-------|------|--------|
| Phase 1 | PSIPRED/JPred cleanup | DONE |
| Phase 2 | Docker optimization (3GB -> ~800MB) | DONE |
| Phase 3 | Caddy auto-HTTPS (ready to switch) | DONE |
| Phase 4 | Comprehensive ROADMAP rewrite | DONE |
| Step 1 | S4PRED full verification + golden tests | DONE |
| Step 2 | FF-Helix verification + golden tests | DONE |

### Upcoming

| Step | What | Priority |
|------|------|----------|
| Step 3 | Documentation consolidation (this guide) | HIGH |
| Step 4 | Meeting walkthrough document | MEDIUM |
| Phase 7 | Kubernetes deployment | MEDIUM |
| Phase 8 | CI/CD with ArgoCD | MEDIUM |
| Phase 9 | UI polish (search/filter, mobile) | MEDIUM |
| Phase 10 | Advanced visualizations | LOW (post-paper) |
| Phase 11 | Precomputed proteome (250M seqs) | FUTURE |

### Architecture Constraints

| Rule | Detail |
|------|--------|
| Cost | Free only. DESY K8s = yes. |
| Database | Postgres (future, on DESY K8s). None currently. |
| Predictors | S4PRED = primary. TANGO = secondary. |
| API contract | `backend/schemas/api_models.py` = single source of truth |
| Null semantics | JSON `null` only. Never `-1`, `"N/A"`, or empty string as sentinel. |

---

*This document is the comprehensive reference for PVL. For detailed API shapes, see `docs/active/CONTRACTS.md`. For known issues, see `docs/active/KNOWN_ISSUES.md`.*
