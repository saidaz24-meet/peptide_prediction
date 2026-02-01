# Files to Touch: Hot Files

**Last Updated**: 2025-01-14  
**Purpose**: Quick reference for files most likely to be edited during common tasks.

---

## API Endpoints

### Adding/Modifying Endpoints

**Route Handlers**:
- `backend/api/routes/upload.py` - File upload endpoint
- `backend/api/routes/predict.py` - Single sequence prediction
- `backend/api/routes/uniprot.py` - UniProt query endpoints
- `backend/api/routes/example.py` - Example dataset endpoint
- `backend/api/routes/providers.py` - Provider status endpoints
- `backend/api/routes/health.py` - Health check endpoints
- `backend/api/routes/feedback.py` - User feedback endpoint

**Legacy** (being migrated):
- `backend/server.py` - Original endpoint implementations (2,526 lines)

---

## Request/Response Schemas

**Pydantic Models**:
- `backend/schemas/api_models.py` - API response models (PeptideRow, RowsResponse, PredictResponse, Meta)
- `backend/schemas/uniprot_query.py` - UniProt query request/response models
- `backend/schemas/peptide.py` - Peptide data models
- `backend/schemas/feedback.py` - Feedback request model

**Frontend Types**:
- `ui/src/types/api.ts` - TypeScript API response types
- `ui/src/types/peptide.ts` - UI peptide model types

---

## Data Processing

### File Parsing

**CSV/TSV/XLSX Parsing**:
- `backend/server.py:read_any_table()` - Main file parser (BOM handling, delimiter detection)

**Column Normalization**:
- `backend/services/normalize.py` - Column name canonicalization, camelCase conversion
  - `canonicalize_headers()` - Normalize CSV headers
  - `normalize_cols()` - Standardize column names
  - `normalize_rows_for_ui()` - Convert to camelCase API format

**Frontend Mapping**:
- `ui/src/lib/peptideMapper.ts` - Backend → UI model conversion
- `ui/src/lib/peptideSchema.ts` - CSV header → camelCase mapping
- `ui/src/components/ColumnMapper.tsx` - UI column mapping component

---

## Calculations

**Biochemical Features**:
- `backend/calculations/biochem.py` - Charge, Hydrophobicity, μH calculations
  - `calculate_biochemical_features()` - Main calculation function

**FF-Helix**:
- `backend/auxiliary.py` - FF-Helix% and fragment calculations
  - `ff_helix_percent()` - Compute FF-Helix percentage
  - `ff_helix_cores()` - Compute helix fragments

**Thresholds**:
- `backend/services/thresholds.py` - FF flag threshold resolution
  - `resolve_thresholds()` - Resolve threshold configuration

---

## External Tool Integration

### TANGO

**Runner**:
- `backend/tango.py` - TANGO execution and output parsing
  - `run_tango()` - Main entry point
  - `run_tango_simple()` - Simple runner (default)
  - `process_tango_output()` - Parse TANGO output files

**Binary Path**:
- `backend/Tango/bin/tango` - TANGO binary location

### PSIPRED

**Provider**:
- `backend/services/secondary_structure.py` - PSIPRED provider interface
  - `PsipredProvider` - PSIPRED implementation
  - `get_provider()` - Factory function

---

## Provider Status

**Tracking**:
- `backend/services/provider_tracking.py` - Provider status creation
  - `create_provider_status_for_row()` - Create status for single row

**State Management**:
- `backend/services/provider_state.py` - Global provider state
  - `get_last_provider_status()` - Get last status
  - `set_last_provider_status()` - Set last status

---

## API Client (Frontend)

**HTTP Client**:
- `ui/src/lib/api.ts` - API client functions
  - `uploadFile()`, `predictSequence()`, `executeUniprotQuery()`, etc.

**Validation**:
- `ui/src/lib/apiValidator.ts` - Development-only API response validation
  - `validateApiRow()` - Validate single row
  - `validateApiResponse()` - Validate response array

---

## Logging

**Structured Logging**:
- `backend/services/logger.py` - JSON logging
  - `get_logger()` - Get logger instance
  - `log_info()`, `log_warning()`, `log_error()` - Log functions

**Trace IDs**:
- `backend/services/trace_helpers.py` - Trace ID management
- `backend/api/main.py:TraceIdMiddleware` - Trace ID middleware

---

## Configuration

**Settings**:
- `backend/config.py` - Environment variable loading and settings
  - `Settings` class - All configuration options

**Environment Variables**:
- `.env` file in `backend/` directory
- See `docs/CONFIG_MATRIX.md` for complete list

---

## UI Components

**Pages**:
- `ui/src/pages/UploadPage.tsx` - File upload page
- `ui/src/pages/ResultsPage.tsx` - Results display page
- `ui/src/pages/QuickAnalyze.tsx` - Single sequence analysis

**Key Components**:
- `ui/src/components/ColumnMapper.tsx` - Column mapping UI
- `ui/src/components/DataTable.tsx` - Results table
- `ui/src/components/StatsCards.tsx` - Statistics cards

**State**:
- `ui/src/stores/datasetStore.ts` - Zustand dataset store

---

## Testing

**Backend Tests**:
- `backend/tests/test_api_contracts.py` - API contract tests
- `backend/tests/test_uniprot_query_parsing.py` - UniProt parsing tests
- `backend/tests/test_golden_pipeline.py` - End-to-end pipeline tests

**Test Data**:
- `backend/tests/golden_inputs/` - Golden test inputs

---

## Common Edit Patterns

### Adding a New API Endpoint

1. Add route handler in `backend/api/routes/`
2. Add request/response models in `backend/schemas/`
3. Implement business logic in `backend/services/`
4. Register router in `backend/api/main.py`
5. Add TypeScript types in `ui/src/types/api.ts`
6. Add API client function in `ui/src/lib/api.ts`

### Modifying Response Format

1. Update `backend/schemas/api_models.py` (Pydantic models)
2. Update `backend/services/normalize.py` (normalization logic)
3. Update `ui/src/types/api.ts` (TypeScript types)
4. Update `ui/src/lib/peptideMapper.ts` (mapping logic)
5. Run `make test` to verify contracts

### Adding a New Calculation

1. Add calculation function in `backend/calculations/`
2. Call from `backend/server.py` or service module
3. Add to normalization in `backend/services/normalize.py`
4. Add to API response schema in `backend/schemas/api_models.py`
5. Add to UI types and mapping

### Fixing Column Mapping

1. Update `backend/services/normalize.py:canonicalize_headers()` (backend)
2. Update `ui/src/lib/peptideSchema.ts:CSV_TO_FRONTEND` (frontend)
3. Update `ui/src/components/ColumnMapper.tsx` (UI component)

