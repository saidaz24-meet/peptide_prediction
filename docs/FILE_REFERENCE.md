# File Reference: Purpose, Dependencies, Gotchas

## 📁 Backend Files

### `backend/server.py`

**Purpose**: FastAPI entry point, handles all HTTP endpoints.

**Key Functions**:
- `upload_csv()` — POST `/api/upload-csv` (CSV/TSV/XLSX upload)
- `predict()` — POST `/api/predict` (single sequence)
- `load_example()` — GET `/api/example` (precomputed dataset)
- `execute_uniprot_query()` — POST `/api/uniprot/execute` (UniProt API)

**Dependencies**:
- `tango.py`, `psipred.py` (providers)
- `services/normalize.py` (normalization)
- `calculations/biochem.py` (biochem features)
- `auxiliary.py` (FF-Helix calc)

**Gotchas**:
- `/api/predict` returns **capitalized keys** (Entry, Sequence, etc.), not camelCase (different from `/api/upload-csv`)
- `ensure_cols()` fills `-1` as default (should use `pd.NA` per Principle C)
- Uses `print()` for logging (should use structured logging)
- `EXAMPLE_PATH` hardcoded (should use env var)

**TODOs**:
- Replace `print()` with structured logging
- Use `pd.NA` instead of `-1` in `ensure_cols()`
- Move `EXAMPLE_PATH` to env var

---

### `backend/tango.py`

**Purpose**: TANGO runner (host macOS binary or Docker), output parsing.

**Key Functions**:
- `run_tango_simple()` — Host runner (macOS binary)
- `run_tango_docker()` — Docker runner (fallback)
- `process_tango_output()` — Parse TANGO output files, merge into DataFrame
- `filter_by_avg_diff()` — Compute SSW prediction from TANGO results
- `_start_new_run_dir()` — Create timestamped run directory

**Dependencies**:
- `auxiliary.py` (sequence sanitization)
- `subprocess` (execution)
- `pandas` (DataFrame operations)

**Gotchas**:
- Per-run dirs: `Tango/out/run_YYYYMMDD_HHMMSS/` (guaranteed unique)
- Timeout: 3600s (1 hour) hardcoded (should be env var)
- Fills `-1` for missing SSW scores (should use `pd.NA`)
- `Tango_run.sh` may reference global paths (audit needed)

**TODOs**:
- Move timeout to env var
- Use `pd.NA` instead of `-1`
- Audit `Tango_run.sh` for per-run dir compliance

---

### `backend/psipred.py`

**Purpose**: PSIPRED runner (Docker only), output parsing, SSW proxy.

**Key Functions**:
- `run_psipred()` — Docker runner (best-effort skip if Docker/image/DB missing)
- `process_psipred_output()` — Parse PSIPRED `.ss2` files, merge into DataFrame
- `_ssw_from_psipred()` — Compute SSW-like prediction from PSIPRED H/E curves (fallback)
- `_segments()` — Find helix segments from probability series

**Dependencies**:
- `subprocess` (Docker execution)
- `pandas` (DataFrame operations)
- `numpy` (array operations)

**Gotchas**:
- Per-run dirs: `Psipred/out/run_YYYYMMDD_HHMMSS/` (guaranteed unique)
- Timeout: 600s (10 min) per sequence (hardcoded, should be env var)
- Always tries Docker (no host runner option)
- Fills `0.0` for missing percentages (should use `pd.NA`)
- Window sizes (`wmins=8, wmaxs=20`) hardcoded (should be env vars)
- SSW thresholds (`ph>=0.35, pe>=0.35, diff<=0.15`) hardcoded (should be env vars)

**TODOs**:
- Move timeouts/thresholds to env vars
- Use `pd.NA` instead of `0.0`
- Add host runner option (or document why Docker-only)

---

### `backend/services/normalize.py`

**Purpose**: DataFrame normalization, column canonicalization, fake default conversion.

**Key Functions**:
- `canonicalize_headers()` — Normalize CSV headers (Entry, Sequence, etc.)
- `normalize_cols()` — Ensure required columns exist
- `normalize_rows_for_ui()` — Convert DataFrame rows to camelCase dicts for UI
- `_convert_fake_defaults_to_null()` — Convert `-1`/`0`/`"-"` to `null` (Principle C)
- `create_provider_status_for_row()` — Determine provider status (Principle B)

**Dependencies**:
- `schemas/peptide.py` (PeptideSchema)
- `services/provider_tracking.py` (provider status)
- `pandas` (DataFrame operations)

**Gotchas**:
- `normalize_rows_for_ui(is_single_row=True)` returns **capitalized keys** (for `/api/predict` compatibility)
- `normalize_rows_for_ui(is_single_row=False)` returns **camelCase keys** (for `/api/upload-csv`)
- Fake defaults converted to `null` during normalization (but DataFrame still has `-1`/`0`/`"-"`)

**TODOs**:
- Document why `/api/predict` uses capitalized keys
- Consider unifying format (camelCase everywhere)

---

### `backend/services/provider_tracking.py`

**Purpose**: Determine provider status (available/failed/unavailable/not_configured).

**Key Functions**:
- `determine_tango_status()` — Check TANGO status from DataFrame row
- `determine_psipred_status()` — Check PSIPRED status from DataFrame row
- `determine_jpred_status()` — Always returns "not_configured" (JPred disabled)
- `create_provider_status_for_row()` — Create PeptideProviderStatus object

**Dependencies**:
- `schemas/provider_status.py` (ProviderStatus schemas)
- `pandas` (DataFrame operations)

**Gotchas**:
- Status determination is simplified (checks DataFrame values, not output files)
- Should check if output files exist for more accurate status

**TODOs**:
- Add file existence checks for more accurate status

---

### `backend/auxiliary.py`

**Purpose**: FF-Helix calculation, sequence utilities, filtering.

**Key Functions**:
- `ff_helix_percent()` — Calculate FF-Helix percentage (always-on baseline)
- `ff_helix_cores()` — Find FF-Helix core segments
- `get_corrected_sequence()` — Handle non-standard amino acids

**Dependencies**:
- `pandas` (DataFrame operations)
- `numpy` (array operations)

**Gotchas**:
- `MINIMAL_PEPTIDE_LENGTH = 40` hardcoded (should be env var)
- `MIN_LENGTH`, `MAX_GAP`, etc. hardcoded (should be env vars)
- `PATH = os.getcwd()` (should use `__file__`-relative paths)

**TODOs**:
- Move thresholds to env vars
- Use `__file__`-relative paths

---

### `backend/calculations/biochem.py`

**Purpose**: Biochemical feature calculation (Charge, Hydrophobicity, μH).

**Key Functions**:
- `calculate_biochemical_features()` — Compute Charge, Hydrophobicity, μH for DataFrame

**Dependencies**:
- `pandas` (DataFrame operations)
- `numpy` (array operations)

**Gotchas**:
- Uses `iterrows()` (slow for large DataFrames, should vectorize)

**TODOs**:
- Vectorize operations for performance

---

### `backend/schemas/peptide.py`

**Purpose**: Pydantic schema for peptide data validation and serialization.

**Key Functions**:
- `PeptideSchema.parse_obj()` — Validate and parse DataFrame row
- `PeptideSchema.to_camel_dict()` — Convert to camelCase for UI

**Dependencies**:
- `pydantic` (validation)
- `schemas/provider_status.py` (provider status)

**Gotchas**:
- Uses aliases for CSV column names (Entry, Sequence, etc.)
- `parse_obj()` handles NaN values in optional string fields
- `to_camel_dict()` includes backward compat aliases (`chameleonPrediction`)

**TODOs**:
- None (well-structured)

---

## 📁 Frontend Files

### `ui/src/App.tsx`

**Purpose**: React Router setup, route definitions.

**Key Functions**:
- Route definitions for all pages
- Floating chips (About, QuickAnalyze)

**Dependencies**:
- `react-router-dom` (routing)
- All page components

**Gotchas**:
- None

**TODOs**:
- None

---

### `ui/src/stores/datasetStore.ts`

**Purpose**: Zustand store for dataset state (peptides, stats, meta).

**Key Functions**:
- `ingestBackendRows()` — Map backend rows to Peptide[], compute stats
- `calculateStats()` — Compute dataset-level stats (totalPeptides, sswPositivePercent, etc.)
- `getPeptideById()` — Get peptide by ID

**Dependencies**:
- `lib/mappers.ts` (mapBackendRowToPeptide)
- `types/peptide.ts` (Peptide, DatasetStats types)

**Gotchas**:
- `calculateStats()` correctly filters undefined values (only counts defined `ffHelixPercent`)
- `sswPositivePercent` computed from `sswPrediction === 1` (strict equality)
- Backward compat aliases (`chameleonPositivePercent`, `chameleonAvailable`)

**TODOs**:
- None (well-structured)

---

### `ui/src/lib/mappers.ts`

**Purpose**: Map backend row (Record<string, any>) to Peptide (TypeScript type).

**Key Functions**:
- `mapBackendRowToPeptide()` — Main mapper function

**Dependencies**:
- `types/peptide.ts` (Peptide type)

**Gotchas**:
- **MISSING**: Does NOT include `providerStatus` from backend row
- Handles backward compat aliases (`chameleonPrediction`)
- Uses `getAny()` helper to try multiple key names

**TODOs**:
- **CRITICAL**: Add `providerStatus` to mapper output

---

### `ui/src/lib/api.ts`

**Purpose**: API client functions (uploadCSV, predictOne, fetchExampleDataset).

**Key Functions**:
- `uploadCSV()` — POST `/api/upload-csv`
- `predictOne()` — POST `/api/predict`
- `fetchExampleDataset()` — GET `/api/example`

**Dependencies**:
- None (pure fetch calls)

**Gotchas**:
- **DUPLICATE**: `callPredict()` exists but `predictOne()` is canonical
- **DUPLICATE**: `normalizeRow()` exists but `mappers.ts:mapBackendRowToPeptide()` is canonical
- `handleResponse()` and `handle()` are nearly identical (consolidate)

**TODOs**:
- Remove `callPredict()` and `normalizeRow()`
- Consolidate `handleResponse()` and `handle()`

---

### `ui/src/pages/Upload.tsx`

**Purpose**: CSV/TSV/XLSX upload page with preview and column mapping.

**Key Functions**:
- File upload via `UploadDropzone`
- Data preview via `DataPreview`
- Column mapping via `ColumnMapper`
- Submit via `uploadCSV()`

**Dependencies**:
- `lib/api.ts` (uploadCSV)
- `stores/datasetStore.ts` (ingestBackendRows)
- `components/UploadDropzone`, `DataPreview`, `ColumnMapper`

**Gotchas**:
- Uses `Papa.parse()` for CSV parsing (client-side preview only)
- Validates sequences (20-AA check) in preview
- Exports rejected rows as CSV

**TODOs**:
- None

---

### `ui/src/pages/QuickAnalyze.tsx`

**Purpose**: Single sequence analysis page.

**Key Functions**:
- Form input (sequence, optional entry)
- Submit via `predictOne()`
- Display results inline

**Dependencies**:
- `lib/api.ts` (predictOne)
- Direct fetch (not using `api.ts`)

**Gotchas**:
- Uses **capitalized keys** (Entry, Sequence, etc.) from `/api/predict` response
- Different format than `/api/upload-csv` (camelCase)

**TODOs**:
- Consider using `api.ts:predictOne()` instead of direct fetch
- Document why capitalized keys are used

---

### `ui/src/pages/Results.tsx`

**Purpose**: Main results page (KPIs, charts, table, ranking).

**Key Functions**:
- Renders `ResultsKpis`, `ResultsCharts`, `PeptideTable`
- Smart ranking (weighted scoring)
- Export CSV/PDF

**Dependencies**:
- `stores/datasetStore.ts` (peptides, stats, meta)
- `components/ResultsKpis`, `ResultsCharts`, `PeptideTable`
- `lib/report.ts` (PDF export)

**Gotchas**:
- **DEAD CODE**: `CorrelationCard` imported but not rendered
- `normalizePeptide()` function normalizes types (fixes shape mismatches)
- Export CSV shows empty strings for missing values (should show "N/A")

**TODOs**:
- Remove `CorrelationCard` import or wire up component
- Fix CSV export to show "N/A" instead of empty strings

---

### `ui/src/components/ResultsKpis.tsx`

**Purpose**: KPI cards (Total, SSW+, Avg H, Avg FF-Helix).

**Key Functions**:
- Renders 4 KPI cards
- Handles N/A display correctly

**Dependencies**:
- `types/peptide.ts` (DatasetStats)
- `react-router-dom` (navigation)

**Gotchas**:
- Shows "Not available" if `ffHelixAvailable === 0` (correct)
- Uses backward compat aliases (`chameleonPositivePercent`)

**TODOs**:
- None

---

### `ui/src/components/PeptideTable.tsx`

**Purpose**: Sortable, filterable table of peptides.

**Key Functions**:
- Table rendering via `@tanstack/react-table`
- Sorting, filtering, pagination
- Row click → navigate to `/peptides/:id`

**Dependencies**:
- `@tanstack/react-table` (table logic)
- `types/peptide.ts` (Peptide type)
- `react-router-dom` (navigation)

**Gotchas**:
- None

**TODOs**:
- None

---

### `ui/src/components/CorrelationCard.tsx`

**Purpose**: Correlation visualization (imported but not rendered).

**Status**: ✂️ Dead Code

**Gotchas**:
- Imported in `Results.tsx` but never used in JSX

**TODOs**:
- Remove import or wire up component

---

### `ui/src/components/EvidencePanel.tsx`

**Purpose**: Evidence panel (exists but unused).

**Status**: ✂️ Unused

**Gotchas**:
- Not imported anywhere

**TODOs**:
- Remove or document intended use

---

### `ui/src/components/PositionBars.tsx`

**Purpose**: Position bars visualization (exists but unused).

**Status**: ✂️ Unused

**Gotchas**:
- Not used in `PeptideDetail.tsx`

**TODOs**:
- Remove or wire up in `PeptideDetail.tsx`

---

## 📋 Summary: Critical Issues

### High Priority

1. **`lib/mappers.ts`**: Missing `providerStatus` mapping
2. **`lib/api.ts`**: Duplicate functions (`callPredict()`, `normalizeRow()`)
3. **`pages/Results.tsx`**: Dead code (`CorrelationCard` import)
4. **CSV Export**: Shows empty strings instead of "N/A"

### Medium Priority

1. **DataFrame Fake Defaults**: Use `pd.NA` instead of `-1`/`0`/`"-"`
2. **Structured Logging**: Replace `print()` with `logging` module
3. **Magic Thresholds**: Move to env vars
4. **Per-Run Dir Audit**: Verify `Tango_run.sh` compliance

### Low Priority

1. **Unused Components**: Remove `EvidencePanel`, `PositionBars` or document
2. **Format Unification**: Consider camelCase everywhere (not capitalized keys in `/api/predict`)

---

**Next**: See [CONTINUATION_PLAN.md](./CONTINUATION_PLAN.md) for concrete PRs to fix these issues.

