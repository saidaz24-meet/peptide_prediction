# System Map

High-level architecture diagram and module overview for the Peptide Prediction Service.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (UI)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Upload     │  │ QuickAnalyze │  │   Results    │         │
│  │   Page       │  │    Page      │  │    Page      │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └─────────────────┴──────────────────┘                  │
│                            │                                     │
│                    ┌───────▼────────┐                           │
│                    │   api.ts       │                           │
│                    │  (HTTP client) │                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP (CORS)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    server.py                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ /api/upload  │  │ /api/predict │  │/api/uniprot  │  │   │
│  │  │   -csv       │  │              │  │  /execute    │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │
│  └────────┼──────────────────┼──────────────────┼──────────┘   │
│           │                  │                  │                │
│  ┌────────▼──────────────────▼──────────────────▼──────────┐   │
│  │              Analysis Pipeline                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  normalize   │  │  biochem    │  │  secondary   │  │   │
│  │  │  _cols()     │  │  calc()     │  │  structure   │  │   │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘  │   │
│  └──────────────────────────────────────────────┼──────────┘   │
│                                                 │                │
│  ┌──────────────────────────────────────────────▼──────────┐   │
│  │              TANGO Runner                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   simple     │  │    host      │  │   docker     │  │   │
│  │  │  (default)   │  │  (fallback)  │  │  (fallback)  │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │
│  └─────────┼──────────────────┼──────────────────┼──────────┘   │
│            │                  │                  │                │
│  ┌─────────▼──────────────────▼──────────────────▼──────────┐   │
│  │         TANGO Binary Execution                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  backend/Tango/bin/tango                          │   │   │
│  │  │  (macOS binary, requires Rosetta on Apple Silicon)│   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Output Parsing & Merging                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ process_     │  │ filter_by_   │  │ normalize_   │  │   │
│  │  │ tango_output │  │ avg_diff()   │  │ rows_for_ui  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DATA STORES & CACHES                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Runtime Directories (backend/.run_cache/Tango/)         │   │
│  │  ├── work/          (input files: fmt1, fmt2, fmt3)      │   │
│  │  └── out/            (per-run outputs: run_YYYYMMDD_*/)   │   │
│  │      └── run_*/     (per-peptide .txt files)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PSIPRED Directories (backend/Psipred/)                 │   │
│  │  ├── work/          (FASTA inputs)                      │   │
│  │  └── out/            (PSIPRED outputs: .ss2, .a3m)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Example Dataset (ui/public/Final_Staphylococcus_*.xlsx) │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## Main Modules/Services

### Backend API (`backend/server.py`)

**Entry Points:**
- `POST /api/upload-csv` - Upload CSV/TSV/XLSX file
- `POST /api/predict` - Single sequence prediction
- `POST /api/uniprot/execute` - Execute UniProt query
- `GET /api/example` - Load example dataset
- `GET /api/health` - Health check
- `GET /api/providers/last-run` - Provider status metadata
- `GET /api/providers/diagnose/tango` - TANGO binary diagnostics

**Key Functions:**
- `upload_csv()` - Main upload handler, orchestrates pipeline
- `predict()` - Single sequence handler
- `execute_uniprot_query()` - UniProt API integration
- `read_any_table()` - CSV/TSV/XLSX parser with BOM handling

### Tango Runners (`backend/tango.py`)

**Runner Types:**
1. **Simple Runner** (default, `run_tango_simple()`)
   - Generates bash script `Tango_run.sh` in run directory
   - Uses absolute path to `backend/Tango/bin/tango`
   - Executes per-peptide predictions inline
   - Outputs: `run_dir/<ENTRY>.txt` per peptide

2. **Host Runner** (`run_tango_host()`)
   - Uses `backend/Tango/Tango_run.sh` wrapper
   - Processes fmt2 input file
   - Fallback when simple runner unavailable

3. **Docker Runner** (`run_tango_docker()`)
   - Requires Docker image `desy-tango`
   - Volume mounts `backend/Tango/` into container
   - Fallback when native binary unavailable

**Key Functions:**
- `create_tango_input()` - Builds input files (fmt1, fmt2, fmt3)
- `run_tango_simple()` - Simple runner (default)
- `process_tango_output()` - Parses per-peptide `.txt` files
- `filter_by_avg_diff()` - Computes SSW prediction flags
- `_resolve_tango_bin()` - Resolves absolute path to tango binary

### UniProt Client (`backend/services/uniprot_query.py`)

**Functions:**
- `parse_uniprot_query()` - Classifies query mode (accession/keyword/organism)
- `build_uniprot_export_url()` - Builds REST API URL with filters
- `detect_accession()` - Detects UniProt accession pattern
- `detect_organism_id()` - Detects taxonomy ID

**Query Modes:**
- `accession` - Single UniProt accession (e.g., `P12345`)
- `keyword` - Keyword search (e.g., `amyloid`)
- `organism` - Organism ID (e.g., `9606`)
- `keyword_organism` - Combined (e.g., `amyloid organism_id:9606`)

### Analysis Pipeline

**Normalization** (`backend/services/normalize.py`):
- `canonicalize_headers()` - Maps UniProt headers to canonical names
- `normalize_cols()` - Ensures required columns (Entry, Sequence, Length)
- `normalize_rows_for_ui()` - Converts DataFrame rows to camelCase JSON

**Biochemical Calculations** (`backend/calculations/biochem.py`):
- `calculate_biochemical_features()` - Computes Charge, Hydrophobicity, μH
- `ff_helix_percent()` - Computes FF-Helix % (from `auxiliary.py`)

**Secondary Structure** (`backend/services/secondary_structure.py`):
- Provider interface for PSIPRED/S4PRED
- `get_provider()` - Factory function (returns PsipredProvider or NullProvider)
- `PsipredProvider.run()` - Executes PSIPRED via Docker

### UI Components (`ui/src/`)

**Pages:**
- `pages/Upload.tsx` - File upload and UniProt query input
- `pages/QuickAnalyze.tsx` - Single sequence prediction
- `pages/Results.tsx` - Dataset visualization and ranking
- `pages/PeptideDetail.tsx` - Per-peptide deep dive

**API Client** (`lib/api.ts`):
- `uploadCSV()` - Upload file endpoint
- `predictOne()` - Single sequence endpoint
- `executeUniProtQuery()` - UniProt query endpoint
- `handleResponse()` - Centralized error handling

## Data Stores

### Runtime Directories

**TANGO Runtime** (`backend/.run_cache/Tango/`):
- **Work Directory**: `backend/.run_cache/Tango/work/`
  - `Tango_input_fmt1.txt` - Inline parameter format
  - `Tango_input_fmt2.txt` - Space-separated format
  - `Tango_input_fmt3.txt` - TSV format
  - `single_input.txt` - Single sequence input

- **Output Directory**: `backend/.run_cache/Tango/out/`
  - `run_YYYYMMDD_HHMMSS/` - Per-run directory
    - `<ENTRY>.txt` - Per-peptide TANGO output
    - `Tango_run.sh` - Generated runner script
    - `run_meta.json` - Run metadata (diagnostics)

**PSIPRED Runtime** (`backend/Psipred/`):
- `work/` - FASTA input files
- `out/` - PSIPRED outputs (`.ss2`, `.a3m`, `.hhblits`)

**Legacy TANGO Directory** (`backend/Tango/`):
- `bin/tango` - TANGO binary (macOS)
- `Tango_run.sh` - Host runner script
- `Tango_run.bat` - Legacy Windows script (not used on macOS)
- `Dockerfile` - Docker image definition
- `out/` - Legacy outputs (swept into run directories)

### Example Dataset

- **Path**: `ui/public/Final_Staphylococcus_2023_new.xlsx`
- **Purpose**: Pre-computed example dataset with TANGO/JPred results
- **Access**: `GET /api/example?recalc=0` (default: no recomputation)

## Binaries/Externals

### TANGO Binary

**Location**: `backend/Tango/bin/tango`
- **Type**: macOS binary (x86_64, requires Rosetta on Apple Silicon)
- **Requirements**:
  - Executable permissions (`chmod +x`)
  - macOS quarantine removal (`xattr -d com.apple.quarantine`)
  - Rosetta 2 (Apple Silicon only)

**Resolution Order**:
1. `TANGO_BIN` environment variable (absolute path)
2. `backend/Tango/bin/tango` (relative to backend/)
3. `which tango` (system PATH)

### Docker Images

**TANGO Image**: `desy-tango`
- **Base**: `debian:bookworm-slim`
- **Volume Mount**: `backend/Tango/` → `/app/Tango`
- **Entrypoint**: `/bin/bash -lc`

**PSIPRED Image**: `psipred-hhblits` (optional)
- **Volume Mount**: `backend/Psipred/` → `/app/Psipred`
- **Environment**: `PSIPRED_DB` (Uniclust database path)

### External Dependencies

**Python Packages** (see `backend/requirements.txt`):
- `fastapi` - Web framework
- `pandas` - DataFrame operations
- `httpx` - HTTP client (UniProt API)
- `openpyxl` - Excel file support
- `pydantic` - Data validation

**Node.js Packages** (see `ui/package.json`):
- `react` - UI framework
- `vite` - Build tool
- `recharts` - Charting library
- `shadcn/ui` - UI components

## Environment Variables

See `CONFIG_MATRIX.md` for complete list of environment variables and their defaults.

**Key Variables:**
- `USE_TANGO` - Enable/disable TANGO (default: `true`)
- `USE_PSIPRED` - Enable/disable PSIPRED (default: `true`)
- `TANGO_MODE` - Runner mode: `simple` (default), `host`, `docker`
- `TANGO_SIMPLE` - Force simple runner (default: `1`)
- `TANGO_RUNTIME_DIR` - Override runtime directory (default: `backend/.run_cache/Tango`)
- `TANGO_BIN` - Override TANGO binary path
- `PSIPRED_IMAGE` - Docker image name (default: `psipred-hhblits`)
- `PSIPRED_DB` - Uniclust database path

## Path Resolution

**Absolute Paths (Recommended):**
- TANGO binary: Resolved via `os.path.abspath()` in `_resolve_tango_bin()`
- Run directories: Created with absolute paths in `_start_new_run_dir()`
- Generated scripts: Use absolute binary path in `_write_simple_bat()`

**Relative Paths (Legacy):**
- Some legacy code uses `../..` from transient run directories (see `FAILURE_MODES.md`)

## Logging

**Structured Logging** (`backend/services/logger.py`):
- Trace ID per request (via `TraceIdMiddleware`)
- Log levels: `INFO`, `WARNING`, `ERROR`
- Key events: `tango_run_start`, `tango_parse_complete`, `upload_complete`

See `OBSERVABILITY.md` for complete log event catalog.

