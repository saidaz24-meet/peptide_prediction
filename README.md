# Peptide Visual Lab (PVL)

**Comprehensive peptide analysis combining aggregation propensity, secondary structure prediction, and fibril-forming helix detection — with interactive visualizations.**

Built at [DESY](https://www.desy.de/) / [CSSB](https://www.cssb-hamburg.de/) (Landau Lab).

[![CI](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml/badge.svg)](https://github.com/saidaz24-meet/peptide_prediction/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests: 235 passing](https://img.shields.io/badge/tests-235%20passing-brightgreen)](#running-tests)

---

## What It Does

PVL is a web-based research tool for studying peptide aggregation, structural switching, and fibril formation. Upload a dataset of peptide sequences and get:

- **Aggregation propensity** via [TANGO](https://tango.switchlab.org/) — per-residue aggregation, beta-aggregation, and helix curves
- **Secondary structure prediction** via [S4PRED](https://github.com/psipred/s4pred) — helix/beta/coil probabilities for each residue
- **Fibril-forming helix detection** (FF-Helix) — intrinsic helical propensity scoring (always available, no external tools)
- **Secondary Structure Switch (SSW)** prediction — identifies chameleon sequences from both TANGO and S4PRED
- **Biochemical properties** — charge, hydrophobicity, hydrophobic moment (muH)
- **Smart candidate ranking** — adjustable metric weights with top-N shortlist export

> **Deployed at DESY.** PVL runs on a DESY VM with Docker Compose + Caddy auto-HTTPS. Kubernetes deployment planned as long-term scaling target. You can also run it locally with Docker.

---

## Quick Start

PVL runs as two Docker containers (backend + frontend). This is the supported deployment method.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- (Optional) TANGO binary — placed in `tools/tango/bin/tango`
- (Optional) S4PRED model weights — placed in `tools/s4pred/models/` (5 files, ~86 MB each)

### Run

```bash
git clone https://github.com/saidaz24-meet/peptide_prediction.git
cd peptide_prediction

# Copy and edit environment config
cp backend/.env.example backend/.env

# Start services
make docker-build
make docker-up
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Try Quick Analyze** — paste a single peptide sequence on the home page to see results instantly, no file upload needed.

### Prediction Tools

PVL uses external prediction tools that are **volume-mounted** (not baked into the Docker image):

| Tool | Purpose | Required? | Path |
|------|---------|-----------|------|
| **S4PRED** | Secondary structure (helix/beta/coil) | Optional | `tools/s4pred/models/` |
| **TANGO** | Aggregation propensity | Optional | `tools/tango/bin/tango` |
| **FF-Helix** | Fibril-forming helix detection | Always available | Built-in (pure Python) |

Without S4PRED or TANGO, PVL still computes FF-Helix%, charge, hydrophobicity, muH, and all biochemical properties.

---

## Features

### Analysis

- Upload peptide datasets (CSV/TSV/XLSX) or paste a single sequence (Quick Analyze)
- UniProt search integration — query by protein name, organism, or accession
- Per-residue sliding-window profiles (hydrophobicity, muH) with helix overlays
- S4PRED per-residue probability curves with colored sequence track
- TANGO per-residue aggregation heatmap with beta and helix overlays
- Helical wheel projection (HeliQuest color scheme, Eisenberg muH arrow)
- AlphaFold DB integration with pLDDT metrics and Mol* 3D viewer
- Cohort comparison dashboard (overlay two datasets side-by-side)

### Visualization & Export

- Interactive charts (distribution, scatter, radar, bar)
- Publication-ready SVG and PNG export for all charts
- CSV export with full computed properties
- FASTA export (single or bulk)
- PDF report with ranked shortlist and methodology summary

### Data Management

- Smart candidate ranking with adjustable metric weights
- Column visibility toggle and data table filters
- Progressive disclosure (Data Table | Ranking | Charts tabs)
- Result persistence across page refreshes
- Example datasets (antimicrobial peptides, amyloid peptides) for quick exploration

---

## For Developers

### Local Development Setup

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Start the server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
cd ui
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment Variables

Key backend settings (see `backend/.env.example` for the full list):

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_TANGO` | `0` | Enable TANGO aggregation prediction |
| `USE_S4PRED` | `1` | Enable S4PRED secondary structure prediction |
| `TANGO_BINARY_PATH` | — | Path to TANGO binary |
| `S4PRED_MODEL_PATH` | — | Path to S4PRED model weights directory |
| `CORS_ORIGINS` | `localhost:3000,5173` | Allowed CORS origins |
| `SENTRY_DSN` | — | Sentry error tracking (optional) |

### Running Tests

```bash
make test          # All tests (fast, deterministic, no network)
make test-unit     # Fast unit tests only
make lint          # Linters (Python + TypeScript)
make typecheck     # Type checkers (Python + TypeScript)
make fmt           # Format code
make ci            # Full pipeline (lint + typecheck + test)
```

### Project Structure

```
backend/
  api/routes/        # FastAPI endpoint definitions
  services/          # Business logic (normalize, predict, etc.)
  schemas/           # API models (single source of truth)
  server.py          # Compatibility shim (15 LOC, deprecated)
  tango.py           # TANGO runner and parser
  s4pred.py          # S4PRED runner and analyzer
  auxiliary.py       # FF-Helix and SSW helpers
  biochem_calculation.py  # Charge, hydrophobicity, muH
  config.py          # Settings (loaded from env vars)
  tests/             # pytest test suite

ui/
  src/pages/         # React pages (Results, PeptideDetail, Upload, etc.)
  src/components/    # Reusable components (HelicalWheel, SequenceTrack, etc.)
  src/stores/        # Zustand state management
  src/types/         # TypeScript type definitions
  src/lib/           # Utilities (export, AlphaFold client, etc.)

docker/
  Dockerfile.backend    # Backend image (CPU-only PyTorch)
  Dockerfile.frontend   # Frontend image (nginx)
  docker-compose.yml    # Development
  docker-compose.prod.yml   # Production (nginx)
  docker-compose.caddy.yml  # Production (Caddy auto-HTTPS)

tools/               # External tools (gitignored, volume-mounted into Docker)
  tango/bin/tango     # TANGO binary
  s4pred/models/      # S4PRED model weights
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, pandas, PyTorch (CPU) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts |
| State | Zustand (with persistence) |
| Testing | pytest, Vitest |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose + Caddy (VM), DESY K8s (long-term) |

---

## Documentation

| Document | Audience | What It Covers |
|----------|----------|----------------|
| [README_EXPLAINER.md](README_EXPLAINER.md) | Biologists, collaborators | Non-technical A-to-Z guide: every chart explained, full user flow, glossary |
| [docs/active/ACTIVE_CONTEXT.md](docs/active/ACTIVE_CONTEXT.md) | Developers | Architecture overview, entry points, data flow, key modules |
| [docs/active/CONTRACTS.md](docs/active/CONTRACTS.md) | Developers | API endpoints, request/response shapes, SSW semantics |
| [docs/active/TESTING_GUIDE.md](docs/active/TESTING_GUIDE.md) | Developers | Test commands, golden tests, debugging strategies |
| [docs/active/DEPLOYMENT_GUIDE.md](docs/active/DEPLOYMENT_GUIDE.md) | DevOps | Step-by-step VM deployment with Docker + Caddy |
| [docs/active/MASTER_DEV_DOC.md](docs/active/MASTER_DEV_DOC.md) | Tech leads | Strategic decisions, roadmap priorities, infrastructure checklist |

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch from `main`
3. Run `make ci` before submitting a pull request
4. Keep changes focused — one feature or fix per PR

For bug reports and feature requests, open an issue on GitHub.

---

## Citation

If you use PVL in your research, please cite:

```bibtex
@software{pvl2026,
  author    = {Azaizah, Said},
  title     = {Peptide Visual Lab (PVL)},
  version   = {1.0.0},
  year      = {2026},
  url       = {https://github.com/saidaz24-meet/peptide_prediction},
  license   = {MIT}
}
```

See [CITATION.cff](CITATION.cff) for machine-readable citation metadata.

---

## Acknowledgements

- **[TANGO](https://tango.switchlab.org/)** — Fernandez-Escamilla et al., *Nat Biotechnol* 22, 1302-1306 (2004)
- **[S4PRED](https://github.com/psipred/s4pred)** — Moffat et al., *Bioinformatics* 38, 4647-4653 (2022)
- **DESY / CSSB (Landau Lab)** — Prof. Meytal Landau, Dr. Aleksandr Golubev

---

## License

[MIT](https://opensource.org/licenses/MIT)
