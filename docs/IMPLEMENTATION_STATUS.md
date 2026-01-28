# Implementation Status: What's Implemented vs Missing

## 📊 Feature Matrix

### Pages

| Page | Status | What Works | What's Missing/Partial |
|------|--------|------------|----------------------|
| **Index** (`/`) | ✅ Complete | Landing page, example dataset button | None |
| **Upload** (`/upload`) | ✅ Complete | CSV/TSV/XLSX upload, preview, column mapping, validation | None |
| **QuickAnalyze** (`/quick`) | ✅ Complete | Single sequence input, inline results | Provider status display |
| **Results** (`/results`) | ✅ Complete | KPIs, charts, table, ranking, exports | CorrelationCard imported but not rendered |
| **PeptideDetail** (`/peptides/:id`) | ✅ Complete | Segment track, metrics, interpretations | PositionBars exists but may not be used |
| **MetricDetail** (`/metrics/:metricId`) | ⚠️ Partial | Route exists | Implementation unclear |
| **Help** (`/help`) | ✅ Complete | Help page | None |
| **About** (`/about`) | ✅ Complete | About page | None |

### Components

| Component | Status | Used In | Notes |
|-----------|--------|---------|-------|
| **ResultsKpis** | ✅ Complete | Results.tsx | Shows 4 KPIs, handles N/A correctly |
| **ResultsCharts** | ✅ Complete | Results.tsx | Distribution, scatter, radar charts |
| **PeptideTable** | ✅ Complete | Results.tsx | Sortable, filterable, row click → detail |
| **SegmentTrack** | ✅ Complete | PeptideDetail.tsx | Visual segment overlay |
| **ColumnMapper** | ✅ Complete | Upload.tsx | Optional column remapping |
| **UploadDropzone** | ✅ Complete | Upload.tsx | File drag-and-drop |
| **DataPreview** | ✅ Complete | Upload.tsx | Shows parsed headers/rows |
| **CorrelationCard** | ✂️ Dead Code | Results.tsx (imported but not rendered) | Remove or wire up |
| **EvidencePanel** | ✂️ Unused | None | Exists but not imported anywhere |
| **PositionBars** | ✂️ Unused | None | Exists but not used in PeptideDetail |
| **UniProtQueryInput** | ⚠️ Unknown | Unknown | Exists but route integration unclear |

### Backend Services

| Service | Status | What Works | What's Missing |
|---------|--------|------------|---------------|
| **server.py** | ✅ Core Complete | Upload, predict, example endpoints, normalization | Structured logging, Postgres integration |
| **tango.py** | ✅ Complete | Host runner (macOS), Docker fallback, per-run dirs, parsing | None |
| **psipred.py** | ✅ Complete | Docker runner, best-effort skip, per-run dirs, parsing | None |
| **normalize.py** | ✅ Complete | Column normalization, fake default conversion, provider status | None |
| **provider_tracking.py** | ✅ Complete | Provider status determination | None |
| **cache.py** | ⚠️ Infrastructure Ready | Sequence hash, cache get/set | Not integrated into endpoints |
| **biochemCalculation.py** | ✅ Complete | Charge, Hydrophobicity, μH | None |
| **auxiliary.py** | ✅ Complete | FF-Helix calc, sequence utils | None |

### API Endpoints

| Endpoint | Status | What Works | What's Missing |
|----------|--------|------------|---------------|
| `POST /api/upload-csv` | ✅ Complete | File upload, normalization, TANGO/PSIPRED, biochem, provider status | Structured logs |
| `POST /api/predict` | ✅ Complete | Single sequence, TANGO, biochem, provider status | Structured logs |
| `GET /api/example` | ✅ Complete | Example dataset, optional recalc | Structured logs |
| `GET /api/health` | ✅ Complete | Health check | None |
| `POST /api/uniprot/parse` | ✅ Complete | Query parsing | None |
| `POST /api/uniprot/execute` | ✅ Complete | UniProt API fetch | None |

### Data Flow

| Flow | Status | What Works | What's Missing |
|------|--------|------------|---------------|
| **Upload → Store → Results** | ✅ Complete | Full pipeline works | Provider status not mapped in frontend |
| **QuickAnalyze → Display** | ✅ Complete | Single sequence works | Provider status display |
| **Example Dataset** | ✅ Complete | Loads precomputed data | None |
| **Export CSV** | ✅ Complete | Shortlist export | Missing fields show as empty (not "N/A") |
| **Export PDF** | ⚠️ Unknown | `lib/report.ts` exists | Not audited in detail |

### Provider Integration

| Provider | Status | What Works | What's Missing |
|----------|--------|-----------|---------------|
| **TANGO** | ✅ Complete | Host runner (macOS), Docker fallback, parsing, SSW prediction | None |
| **PSIPRED** | ✅ Complete | Docker runner, best-effort skip, parsing, H/E/C curves | None |
| **FF-Helix** | ✅ Complete | Always computed (no provider dependency) | None |
| **JPred** | ✂️ Disabled | Code exists but disabled (`USE_JPRED = False`) | Kept for reference only |

## 🔍 Dead Code Paths

### Backend

1. **`backend/jpred.py`** — JPred module kept for reference, not used functionally
   - `USE_JPRED = False` in `server.py:L51`
   - Comment: "JPred disabled - kept for reference only"

2. **`backend/batch_process.py`** — Legacy batch processing script
   - Purpose unclear, may duplicate `server.py` functionality
   - Recommendation: Document or remove

3. **`backend/Analysing_final_results.py`** — Incomplete file
   - Line 25 has syntax error
   - Recommendation: Fix or remove

4. **`backend/Tango/Tango_run.bat`** — Windows batch script
   - May reference global paths
   - Recommendation: Verify per-run dir usage

5. **`backend/Tango/Tango_run.sh`** — Shell script
   - Used by `run_tango_host()` but may have global path assumptions
   - Recommendation: Audit for per-run dir compliance

### Frontend

1. **`components/CorrelationCard.tsx`** — Imported but not rendered
   - Imported in `Results.tsx:L26` but never used in JSX
   - Recommendation: Remove import or wire up component

2. **`components/EvidencePanel.tsx`** — Exists but unused
   - Not imported anywhere
   - Recommendation: Remove or document intended use

3. **`components/PositionBars.tsx`** — Exists but unused
   - Not used in `PeptideDetail.tsx`
   - Recommendation: Remove or wire up

4. **`lib/api.ts:normalizeRow()`** — Duplicate mapper
   - `normalizeRow()` exists but `mappers.ts:mapBackendRowToPeptide()` is canonical
   - Recommendation: Remove `normalizeRow()` or consolidate

5. **`lib/api.ts:callPredict()`** — Duplicate API function
   - `predictOne()` is canonical
   - Recommendation: Remove `callPredict()`

## ⚠️ Partial Implementations

### Provider Status (Principle B)

- ✅ **Backend**: Sends `providerStatus` in all responses
- ✅ **Types**: `types/peptide.ts` includes `providerStatus?`
- ❌ **Mapper**: `lib/mappers.ts:mapBackendRowToPeptide()` does NOT include `providerStatus`
- ❌ **UI Display**: No components show provider status (optional for debugging)

**Fix Required**: Update `mappers.ts` to include `providerStatus` from backend row.

### Fake Defaults (Principle C)

- ✅ **Normalization**: `normalize.py:_convert_fake_defaults_to_null()` converts `-1`/`0`/`"-"` to `null`
- ⚠️ **DataFrame Level**: Still uses `-1`, `0`, `"-"` as defaults in:
  - `tango.py`: Fills `-1` for missing SSW scores
  - `psipred.py`: Fills `0.0` for missing percentages
  - `server.py:ensure_cols()`: Fills `-1` for missing columns

**Fix Required**: Use `pd.NA` instead of fake defaults at DataFrame level.

### Structured Logging

- ❌ **Current**: Uses `print()` statements throughout
- ❌ **Missing**: Structured JSON logs, log levels, request IDs

**Fix Required**: Replace `print()` with `logging` module, add structured format.

### Postgres Integration

- ✅ **Infrastructure**: `services/cache.py` ready (sequence hash, cache get/set)
- ❌ **Integration**: Not used in endpoints
- ❌ **Schema**: No Postgres schema defined

**Fix Required**: Define schema, integrate caching into endpoints (optional).

### Docker Toggle

- ✅ **TANGO**: Has `TANGO_MODE=simple|docker` env flag
- ⚠️ **PSIPRED**: Always tries Docker (no host runner option)
- ❌ **Unified**: No single `USE_DOCKER` flag for all tools

**Fix Required**: Add `USE_DOCKER` flag, make PSIPRED respect it.

## 🎯 Magic Thresholds (Should Be Configurable)

| Location | Threshold | Current Value | Recommendation |
|----------|-----------|---------------|----------------|
| `auxiliary.py:L12` | `MINIMAL_PEPTIDE_LENGTH` | 40 | Move to env var |
| `auxiliary.py:L15-18` | `MIN_LENGTH`, `MAX_GAP`, `MIN_JPRED_SCORE`, etc. | Various | Move to config file |
| `psipred.py:L180` | Window sizes (`wmins`, `wmaxs`) | 8, 20 | Move to env vars |
| `psipred.py:L187` | SSW thresholds (`ph>=0.35`, `pe>=0.35`, `diff<=0.15`) | Hardcoded | Move to env vars |
| `tango.py` | Timeout | 3600s (1h) | Move to env var |
| `psipred.py:L117` | Per-sequence timeout | 600s (10min) | Move to env var |

## 📝 Old Global Paths / Hardcoded Assumptions

1. **`backend/Tango/Tango_run.sh`** — May reference global paths
   - Recommendation: Audit for per-run dir compliance

2. **`backend/Tango/Tango_run.bat`** — Windows batch script
   - Recommendation: Verify per-run dir usage or remove if macOS-only

3. **`backend/server.py:L65`** — `EXAMPLE_PATH` hardcoded
   - `BASE_DIR = Path(__file__).resolve().parent.parent`
   - Recommendation: Use env var or config

4. **`backend/auxiliary.py:L10`** — `PATH = os.getcwd()`
   - Recommendation: Use `__file__`-relative paths

## 🔗 Cross-Reference Issues

### Type Consistency

- ✅ **Backend → Frontend**: Backend sends camelCase (via `PeptideSchema.to_camel_dict()`)
- ⚠️ **Exception**: `/api/predict` returns capitalized keys (Entry, Sequence, etc.)
- ✅ **Frontend Types**: `types/peptide.ts` matches backend shape
- ❌ **Mapper**: `mappers.ts` does NOT include `providerStatus`

### Store Consistency

- ✅ **Store**: `datasetStore.ts` uses `mapBackendRowToPeptide()` consistently
- ✅ **Stats**: `calculateStats()` correctly filters undefined values
- ⚠️ **N/A Display**: Some components show "Not available", others show empty strings

### API Consistency

- ⚠️ **Format Mismatch**: `/api/predict` returns capitalized keys, `/api/upload-csv` returns camelCase
- ✅ **Provider Status**: Both endpoints include `providerStatus`
- ✅ **Fake Defaults**: Both endpoints convert fake defaults to `null`

## 📋 Summary: What to Fix

### High Priority (Short-term PRs)

1. **Mapper Missing `providerStatus`** — Update `lib/mappers.ts` to include `providerStatus`
2. **Remove Dead Code** — Remove unused components (CorrelationCard, EvidencePanel, PositionBars)
3. **Consolidate API Functions** — Remove duplicate `callPredict()` and `normalizeRow()`
4. **Per-Run Dir Audit** — Verify `Tango_run.sh` and `Tango_run.bat` use per-run dirs
5. **Export N/A Handling** — Show "N/A" instead of empty strings in CSV export

### Medium Priority (Medium-term PRs)

1. **DataFrame Fake Defaults** — Use `pd.NA` instead of `-1`/`0`/`"-"` at source
2. **Structured Logging** — Replace `print()` with `logging` module
3. **Magic Thresholds** — Move to env vars or config file
4. **Docker Toggle** — Add unified `USE_DOCKER` flag
5. **Postgres Schema** — Define schema, integrate caching (optional)

### Low Priority (Future)

1. **Provider Status UI** — Optional display for debugging/transparency
2. **PositionBars Component** — Wire up or remove
3. **MetricDetail Page** — Complete implementation
4. **UniProtQueryInput** — Verify route integration

---

**Next**: See [ACCURACY_FALLBACKS.md](./ACCURACY_FALLBACKS.md) for provider mapping and fallback rules.

