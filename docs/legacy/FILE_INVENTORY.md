# Complete File Inventory

## File Inventory Table

| Path | Type | What it does | Who depends on it | What it depends on | Runtime Risk | Reason |
|------|------|--------------|-------------------|-------------------|--------------|--------|
| **Backend - Core** |
| `backend/server.py` | route | FastAPI application with /api/upload-csv, /api/predict, /api/example endpoints. Orchestrates peptide processing pipeline. | Entry point (uvicorn), no callers | FastAPI, pandas, auxiliary, biochemCalculation, jpred, tango, psipred, PeptideSchema, dotenv | High | Main API server, critical path for all requests, contains security vulnerabilities (no auth, input validation gaps) |
| `backend/main.py` | script | Legacy batch processing script for offline dataset analysis. Processes multiple database files sequentially. | Called directly (if __name__ == "__main__"), imported by jpred.py (write_to_excel), Analysing_final_results.py | auxiliary, biochemCalculation, jpred, tango, pandas, warnings | Med | Duplicates server.py logic, unclear when to use, but still referenced by other scripts |
| `backend/auxiliary.py` | util | Utility functions: sequence sanitization, FF-helix calculations, filtering, Jpred result processing. Mixed responsibilities. | server.py, main.py, jpred.py, tango.py | pandas, numpy, biochemCalculation, statistics | Med | Large catch-all file (487 lines), critical utilities but poorly organized |
| `backend/biochemCalculation.py` | util | Calculates biochemical properties: hydrophobic moment, total charge, hydrophobicity using Fauchere-Pliska scale. | server.py, main.py, auxiliary.py | math, statistics | Low | Pure calculation functions, well-isolated, no external dependencies |
| `backend/tango.py` | service | Manages Tango prediction tool: creates input files, executes binary/Docker, parses outputs, computes SSW predictions. | server.py, main.py | subprocess, os, re, pandas, auxiliary, shutil, datetime | High | Executes external binaries with user input, potential security risk, complex file I/O |
| `backend/psipred.py` | service | Manages PSIPRED predictions via Docker: prepares FASTAs, runs hhblits+PSIPRED, parses SS2 outputs. | server.py (optional, feature-flagged) | subprocess, os, re, pandas, datetime | Med | Docker execution, optional feature, has timeout protection |
| `backend/jpred.py` | service | Manages JPred predictions: creates FASTA inputs, submits jobs (if configured), parses helix fragment results. | server.py, main.py | os, pandas, numpy, auxiliary, main, subprocess, math | Med | Legacy subprocess usage, optional feature, depends on external JPred service |
| `backend/schemas/peptide.py` | util | Pydantic schema for peptide data validation and camelCase conversion for frontend. | server.py | pydantic | Low | Data validation schema, pure transformation logic |
| `backend/Analysing_final_results.py` | script | Analysis script for final results: finds duplicates, calculates accuracy statistics. Incomplete (syntax error at line 25). | Called directly (if __name__ == "__main__") | pandas, main | Low | Utility script, not part of main application flow, has bugs |
| `backend/requirements.txt` | config | Python dependencies: FastAPI, uvicorn, pandas, numpy, openpyxl, python-multipart | pip install, deployment scripts | - | Low | Dependency specification |
| **Backend - Tools & Scripts** |
| `backend/Tango/Tango_run.sh` | script | Shell script to run Tango binary. Legacy wrapper, may not be used by tango.py. | Potentially tango.py (legacy path) | Tango binary | Med | May be unused, unclear integration |
| `backend/Tango/Tango_run.bat` | script | Windows batch script for Tango. Legacy wrapper. | Potentially tango.py (legacy path) | Tango binary | Low | Windows-specific, likely unused on macOS |
| `backend/Tango/build_tango_docker.sh` | script | Builds Docker image for Tango. Optional deployment helper. | Manual execution | Docker | Low | Build script, not runtime |
| `backend/Tango/Dockerfile` | config | Docker configuration for Tango containerization. | build_tango_docker.sh, Docker | - | Low | Build config |
| `backend/Jpred/prepareInputs.csh` | script | C-shell script to prepare JPred inputs. Legacy integration script. | jpred.py (commented out) | JPred service | Low | Likely unused, code is commented |
| `backend/Jpred/massSubmitScheduler.csh` | script | C-shell script for batch JPred job submission. Legacy integration. | jpred.py (commented out) | JPred service | Low | Likely unused, code is commented |
| `backend/Jpred/jpredapi` | data | JPred API documentation or reference file. | None (documentation) | - | Low | Reference/documentation |
| `massSubmitScheduler.csh` | script | Root-level copy of massSubmitScheduler.csh. Appears duplicated. | None | - | Low | Duplicate, likely accidental |
| **Frontend - Entry & Core** |
| `ui/src/main.tsx` | route | React application entry point. Renders App component into DOM root. | Vite bundler | react-dom/client, App.tsx, index.css | Low | Standard React entry point |
| `ui/src/App.tsx` | route | Main application router and layout. Defines routes, providers, floating navigation chips. | main.tsx | react-router-dom, QueryClient, all page components, ScreenTransition | Med | Central routing, orchestrates entire app |
| `ui/src/index.css` | config | Global CSS styles and Tailwind base layer. | main.tsx | - | Low | Stylesheet |
| `ui/src/App.css` | config | Application-specific CSS (if any). | App.tsx (if imported) | - | Low | Stylesheet |
| **Frontend - Pages** |
| `ui/src/pages/Index.tsx` | component | Landing page with feature overview and navigation to upload. | App.tsx (route "/") | react-router-dom, lucide-react, ui components | Low | Marketing/landing page |
| `ui/src/pages/Upload.tsx` | component | File upload interface with multi-step wizard (upload → preview → mapping). | App.tsx (route "/upload") | UploadDropzone, ColumnMapper, DataPreview, datasetStore, api, react-router | High | Critical user entry point, handles file uploads |
| `ui/src/pages/Results.tsx` | component | Main results dashboard: charts, KPIs, peptide table, ranking sliders. | App.tsx (route "/results") | ResultsCharts, ResultsKpis, PeptideTable, datasetStore, many UI components | Med | Complex component, many dependencies |
| `ui/src/pages/PeptideDetail.tsx` | component | Individual peptide detail page with metrics, segment tracks, evidence panel. | App.tsx (route "/peptides/:id") | SegmentTrack, PositionBars, EvidencePanel, datasetStore, many UI components | Med | Complex visualization component |
| `ui/src/pages/QuickAnalyze.tsx` | component | Single-sequence quick analysis interface. | App.tsx (route "/quick") | api, datasetStore, UI components | Med | Alternative entry point |
| `ui/src/pages/About.tsx` | component | About/acknowledgements page. | App.tsx (route "/about") | UI components | Low | Static content |
| `ui/src/pages/Help.tsx` | component | Help/documentation page. | App.tsx (route "/help") | UI components | Low | Static content |
| `ui/src/pages/NotFound.tsx` | component | 404 error page. | App.tsx (route "*") | react-router-dom, UI components | Low | Error page |
| **Frontend - Components** |
| `ui/src/components/UploadDropzone.tsx` | component | Drag-and-drop file upload component with progress tracking. | Upload.tsx | react-dropzone, papaparse, xlsx, datasetStore, UI components, toast | Med | File handling, complex state management |
| `ui/src/components/ColumnMapper.tsx` | component | Interactive column mapping interface for CSV headers. | Upload.tsx | UI components, datasetStore | Low | Form component |
| `ui/src/components/DataPreview.tsx` | component | Table preview of uploaded data before analysis. | Upload.tsx | UI components (table) | Low | Display component |
| `ui/src/components/ResultsCharts.tsx` | component | Chart visualizations: hydrophobicity distribution, scatter plots, chameleon distribution. | Results.tsx | recharts, UI components | Med | Complex chart logic |
| `ui/src/components/ResultsKpis.tsx` | component | Key performance indicator cards (chameleon %, avg FF-helix %, etc.). | Results.tsx | datasetStore, UI components | Low | Display component |
| `ui/src/components/PeptideTable.tsx` | component | Sortable, filterable table of all peptides with ranking. | Results.tsx | @tanstack/react-table, datasetStore, UI components | Med | Complex table with sorting/filtering |
| `ui/src/components/PeptideRadarChart.tsx` | component | Radar chart for peptide property comparison. | Results.tsx, PeptideDetail.tsx | recharts, UI components | Low | Chart component |
| `ui/src/components/SegmentTrack.tsx` | component | Visual track showing helix segments and positions. | PeptideDetail.tsx | UI components | Low | Visualization component |
| `ui/src/components/PositionBars.tsx` | component | Bar chart showing property values across sequence positions. | PeptideDetail.tsx | recharts, UI components | Low | Chart component |
| `ui/src/components/EvidencePanel.tsx` | component | Panel showing evidence and interpretation for peptide predictions. | PeptideDetail.tsx | UI components | Low | Display component |
| `ui/src/components/CorrelationCard.tsx` | component | Card showing correlations between properties. | Results.tsx (possibly) | UI components | Low | Display component |
| `ui/src/components/Legend.tsx` | component | Legend component for charts. | ResultsCharts.tsx, other chart components | UI components | Low | Display component |
| `ui/src/components/ScreenTransition.tsx` | component | Animated screen transition effect for navigation. | App.tsx | framer-motion | Low | Animation component |
| `ui/src/components/ScrollToTop.tsx` | component | Scrolls to top on route changes. | App.tsx | react-router-dom | Low | Utility component |
| `ui/src/components/AppFooter.tsx` | component | Application footer with links/credits. | Various pages | UI components | Low | Static component |
| `ui/src/components/ui/*.tsx` | component | 40+ shadcn/ui base components (button, card, dialog, etc.). Reusable UI primitives. | All pages and components | @radix-ui/*, class-variance-authority, clsx, tailwind-merge | Low | Well-tested library components, but many files to maintain |
| **Frontend - State & Logic** |
| `ui/src/stores/datasetStore.ts` | util | Zustand store for global application state: peptides, metadata, stats, column mapping. | All pages, UploadDropzone, ColumnMapper, Results components | zustand, peptide types, mappers | High | Central state management, critical for data flow |
| `ui/src/lib/api.ts` | util | API client functions: uploadCSV, predictOne, fetchExampleDataset. Handles HTTP requests to backend. | Upload.tsx, QuickAnalyze.tsx, Results.tsx | fetch API | High | All backend communication, error handling |
| `ui/src/lib/mappers.ts` | util | Data transformation functions mapping backend responses to frontend types. | datasetStore.ts | peptide types | Med | Data transformation logic |
| `ui/src/lib/peptideSchema.ts` | util | Zod schema for peptide validation (if used). | Possibly mappers.ts or api.ts | zod | Low | Validation schema (may be unused) |
| `ui/src/lib/profile.ts` | util | Profile-related utilities (sliding window calculations, etc.). | PositionBars.tsx, other visualization components | - | Med | Complex calculations |
| `ui/src/lib/report.ts` | util | PDF report generation utilities. | Results.tsx, PeptideDetail.tsx | jspdf, html2canvas | Med | External library dependencies |
| `ui/src/lib/utils.ts` | util | General utilities: cn() function for class merging. | Many components | clsx, tailwind-merge | Low | Simple utility function |
| `ui/src/types/peptide.ts` | util | TypeScript type definitions for peptide data structures. | All components, stores, lib files | - | Low | Type definitions |
| `ui/src/hooks/use-mobile.tsx` | util | React hook to detect mobile devices. | Various components (if used) | react | Low | Simple hook |
| `ui/src/hooks/use-toast.ts` | util | Toast notification hook (shadcn pattern). | Components using toasts | - | Low | Hook utility |
| `ui/src/components/ui/use-toast.ts` | util | Toast hook implementation (duplicate?). | Toast components | - | Low | Possible duplicate of hooks/use-toast.ts |
| `ui/src/vite-env.d.ts` | config | Vite TypeScript environment declarations. | TypeScript compiler | - | Low | Type definitions |
| **Frontend - Configuration** |
| `ui/vite.config.ts` | config | Vite build configuration: dev server, proxy, path aliases. | Vite bundler | vite, @vitejs/plugin-react-swc | Low | Build configuration |
| `ui/tsconfig.json` | config | TypeScript compiler configuration. | TypeScript compiler | - | Low | Compiler config |
| `ui/tsconfig.node.json` | config | TypeScript config for Node.js scripts (Vite config). | TypeScript compiler | - | Low | Compiler config |
| `ui/eslint.config.js` | config | ESLint linting configuration. | ESLint | eslint, @eslint/js | Low | Linter config |
| `ui/tailwind.config.ts` | config | Tailwind CSS configuration: theme, plugins. | Tailwind processor | tailwindcss | Low | CSS framework config |
| `ui/postcss.config.js` | config | PostCSS configuration for CSS processing. | PostCSS | postcss, autoprefixer | Low | CSS processor config |
| `ui/package.json` | config | NPM package manifest: dependencies, scripts. | npm/yarn/bun | - | Low | Dependency management |
| `ui/components.json` | config | shadcn/ui component configuration. | shadcn CLI | - | Low | Tooling config |
| `ui/index.html` | config | HTML entry point for Vite. | Vite | - | Low | HTML template |
| **Root Configuration & Docs** |
| `README.md` | data | Project documentation: purpose, features, setup instructions. | Developers, users | - | Low | Documentation |
| `DEPLOYMENT.md` | data | Deployment guide: server setup, Cloudflare Tunnel, Docker. | DevOps, developers | - | Low | Documentation |
| `CODEBASE_ANALYSIS.md` | data | Code analysis report with issues and recommendations. | Developers | - | Low | Documentation |
| `LICENSE-DESY-RESEARCH.md` | data | Research license terms. | Legal, users | - | Low | Legal document |
| `REPO_TREE.txt` | data | Repository tree structure (if auto-generated). | Documentation | - | Low | Reference |
| `.gitignore` | config | Git ignore patterns. | Git | - | Low | Version control config |
| **Runtime Data (excluded from source inventory but present)** |
| `backend/Tango/bin/tango` | data | Tango binary executable (runtime dependency, not source). | tango.py | - | High | External binary, required for Tango predictions |
| `backend/Tango/work/*.txt` | data | Tango input files (generated at runtime). | tango.py | - | Low | Runtime data |
| `backend/Tango/out/run_*/` | data | Tango output directories (generated at runtime). | tango.py | - | Low | Runtime data |
| `backend/Psipred/work/*.fa` | data | PSIPRED input FASTA files (generated at runtime). | psipred.py | - | Low | Runtime data |
| `backend/Psipred/out/run_*/` | data | PSIPRED output directories (generated at runtime). | psipred.py | - | Low | Runtime data |
| `backend/Jpred/Jpred_input_*.txt` | data | JPred input files (generated at runtime). | jpred.py | - | Low | Runtime data |
| `backend/Jpred/*_dir_output/` | data | JPred output directories (generated at runtime). | jpred.py | - | Low | Runtime data |
| `ui/public/Final_Staphylococcus_2023_new.xlsx` | data | Example dataset file served to frontend. | server.py (/api/example), UploadDropzone.tsx | - | Low | Example data |
| `ui/public/example/peptide_data.csv` | data | Example CSV file (if used). | Possibly frontend | - | Low | Example data |
| `ui/public/favicon*.png` | data | Favicon images. | index.html | - | Low | Static assets |
| `ui/public/robots.txt` | data | Robots.txt for search engines. | Web crawlers | - | Low | Web config |
| `ui/public/placeholder.svg` | data | Placeholder image. | Components (if used) | - | Low | Static asset |

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│  (Upload CSV/TSV/XLSX or Single Sequence via Web UI)            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Pages      │→ │   Components │→ │   Store      │         │
│  │ (Upload,     │  │ (Dropzone,   │  │ (Zustand)    │         │
│  │  Results,    │  │  Charts,     │  │              │         │
│  │  Detail)     │  │  Table)      │  │              │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                     │
│                            ▼                                     │
│                    ┌──────────────┐                             │
│                    │  lib/api.ts  │  HTTP requests              │
│                    └──────┬───────┘                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP (fetch)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              server.py (Entry Point)                     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │
│  │  │ /api/      │  │ /api/      │  │ /api/      │        │  │
│  │  │ upload-csv │  │ predict    │  │ example    │        │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │  │
│  └────────┼───────────────┼───────────────┼───────────────┘  │
│           │               │               │                    │
│           ▼               ▼               ▼                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              PARSING LAYER                             │   │
│  │  • read_any_table() - CSV/TSV/XLSX parsing            │   │
│  │  • canonicalize_headers() - Header normalization      │   │
│  │  • sanitize_seq() - Sequence validation               │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                        │
│                       ▼                                        │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           PROCESSING PIPELINE                          │   │
│  │                                                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐          │   │
│  │  │ biochemCalculation│  │  auxiliary.py    │          │   │
│  │  │ • Charge         │  │ • FF-Helix %     │          │   │
│  │  │ • Hydrophobicity │  │ • Fragments      │          │   │
│  │  │ • μH (moment)    │  │ • Filtering      │          │   │
│  │  └────────┬─────────┘  └────────┬─────────┘          │   │
│  │           │                     │                      │   │
│  │           └──────────┬──────────┘                      │   │
│  │                      │                                  │   │
│  │  ┌───────────────────┼───────────────────┐            │   │
│  │  │                   ▼                   │            │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────┐│            │   │
│  │  │  │ tango.py │  │psipred.py│  │jpred.││            │   │
│  │  │  │ (SSW)    │  │ (Docker) │  │py    ││  Optional  │   │
│  │  │  │          │  │          │  │      ││            │   │
│  │  │  │ • Run    │  │ • Run    │  │ • Run││            │   │
│  │  │  │   binary │  │   Docker │  │   API││            │   │
│  │  │  │ • Parse  │  │ • Parse  │  │ • Parse│           │   │
│  │  │  │   output │  │   SS2    │  │   helix│           │   │
│  │  │  └────┬─────┘  └────┬─────┘  └──────┘│            │   │
│  │  │       │             │              │              │   │
│  │  │       └─────────────┴──────────────┘              │   │
│  │  │                      │                            │   │
│  │  │                      ▼                            │   │
│  │  │         apply_ff_flags() - Final predictions     │   │
│  │  └──────────────────────┬────────────────────────────┘   │
│  └─────────────────────────┼─────────────────────────────────┘
│                            │
│                            ▼
│  ┌────────────────────────────────────────────────────────┐   │
│  │           NORMALIZATION LAYER                          │   │
│  │  • PeptideSchema.parse_obj() - Validation             │   │
│  │  • to_camel_dict() - Frontend format                  │   │
│  │  • _sanitize_for_json() - NaN/inf handling            │   │
│  └────────────────────┬───────────────────────────────────┘   │
│                       │                                        │
│                       ▼                                        │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              RESPONSE (JSON)                           │   │
│  │  { rows: [...], meta: {...} }                         │   │
│  └────────────────────┬───────────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE (In-Memory/File System)               │
│  • No database - state in Zustand store (frontend)              │
│  • File outputs: Tango/out/, Psipred/out/, Jpred/ (runtime)     │
│  • Example data: ui/public/Final_Staphylococcus_2023_new.xlsx   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         UI RENDERING                             │
│  • Results page: Charts, KPIs, Table, Ranking                   │
│  • Detail page: Segment tracks, Position bars, Evidence         │
│  • Export: CSV, PDF reports                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Source of Truth Entry Points

### Backend Entry Point
- **File**: `backend/server.py`
- **How to start**: `uvicorn server:app --host 0.0.0.0 --port 8000 --reload`
- **Entry symbol**: `app = FastAPI(...)`
- **Alternative script**: `backend/main.py` (batch processing, not web server)

### Frontend Entry Point
- **File**: `ui/src/main.tsx`
- **How to start**: `npm run dev` (which runs `vite`)
- **Entry symbol**: `createRoot(document.getElementById("root")!).render(<App />)`
- **Bundler**: Vite (configured in `ui/vite.config.ts`)

## Problematic Files

### Misleading Files

1. **`backend/main.py`**
   - **Why misleading**: Name suggests it's the main entry point, but actual server is `server.py`. This is a batch processing script.
   - **Evidence**: Imported by `jpred.py` and `Analysing_final_results.py` for utility functions, but serves different purpose than server.py
   - **Recommendation**: Rename to `batch_process.py` or `offline_analysis.py`

2. **`ui/src/components/ui/use-toast.ts`** and **`ui/src/hooks/use-toast.ts`**
   - **Why misleading**: Two files with similar names/purposes. Unclear which is used.
   - **Evidence**: shadcn/ui pattern typically uses `components/ui/use-toast.ts`, but hooks folder suggests alternative
   - **Recommendation**: Consolidate to one location, check actual usage

3. **`massSubmitScheduler.csh` (root level)**
   - **Why misleading**: Duplicate of `backend/Jpred/massSubmitScheduler.csh`. Unclear which is canonical.
   - **Recommendation**: Remove root-level duplicate if not used

### Dead/Legacy Files

1. **`backend/Jpred/prepareInputs.csh`** and **`backend/Jpred/massSubmitScheduler.csh`**
   - **Why dead**: Referenced in `jpred.py` but all code using them is commented out (lines 51-68)
   - **Evidence**: Commented subprocess calls to these scripts
   - **Recommendation**: Remove if JPred integration moved to API-only, or uncomment if still needed

2. **`backend/Analysing_final_results.py`**
   - **Why problematic**: Has syntax error at line 25 (`ff =` incomplete assignment). Incomplete code.
   - **Evidence**: Line 25 is incomplete, file appears unfinished
   - **Recommendation**: Fix or remove

3. **`backend/Tango/Tango_run.sh`** and **`backend/Tango/Tango_run.bat`**
   - **Why legacy**: `tango.py` uses direct binary execution (`run_tango_simple`) rather than these wrapper scripts
   - **Evidence**: `tango.py` has `_resolve_tango_bin()` and direct subprocess calls, not script invocations
   - **Recommendation**: Remove if confirmed unused, or document if needed for manual runs

### Duplicated Code

1. **Biochemical calculations**: `server.py::calc_biochem()` vs `main.py::calculate_biochemical_features()`
   - **Impact**: Two implementations doing similar work, risk of divergence
   - **Recommendation**: Extract to shared module

2. **Response handlers**: `ui/src/lib/api.ts` has both `handle()` and `handleResponse()` functions
   - **Impact**: Code duplication, unclear which to use
   - **Recommendation**: Consolidate to one function

3. **API functions**: `ui/src/lib/api.ts` has both `predictOne()` and `callPredict()`
   - **Impact**: Duplicate functionality, `callPredict` uses different env var (`VITE_API_BASE` vs `VITE_API_BASE_URL`)
   - **Recommendation**: Remove `callPredict`, standardize on `predictOne`

### Legacy/Unclear Integration

1. **`backend/main.py`**
   - **Status**: Still imported by other files but unclear if actively used for web server flow
   - **Dependencies**: `jpred.py` imports `write_to_excel`, `Analysing_final_results.py` imports `write_to_excel`
   - **Recommendation**: Clarify role or extract shared utilities to separate module

2. **JPred integration in `jpred.py`**
   - **Status**: Has commented-out subprocess code, unclear if API-based or script-based integration is current
   - **Evidence**: Large blocks of commented code suggest transition in progress
   - **Recommendation**: Clean up comments, document current integration method

---

**Summary**: The codebase has clear entry points (`server.py`, `main.tsx`) but suffers from legacy code, duplicates, and misleading filenames. The main architectural risk is the dual processing paths (`server.py` web API vs `main.py` batch script) with overlapping functionality.

