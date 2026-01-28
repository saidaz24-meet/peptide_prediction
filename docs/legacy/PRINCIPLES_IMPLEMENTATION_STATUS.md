# Principles Implementation Status

## ✅ Completed

### Principle B: "Provider status" is mandatory

1. **Created Provider Status Schemas** (`backend/schemas/provider_status.py`)
   - `ProviderStatus`: Status for a single provider (available/failed/unavailable/not_configured)
   - `PeptideProviderStatus`: Status for all providers (tango/psipred/jpred) for a peptide

2. **Updated PeptideSchema** (`backend/schemas/peptide.py`)
   - Added optional `provider_status` field
   - Updated `to_camel_dict()` to include `providerStatus` in camelCase output

3. **Created Provider Tracking Utilities** (`backend/services/provider_tracking.py`)
   - `determine_tango_status()`: Determines TANGO status from DataFrame row
   - `determine_psipred_status()`: Determines PSIPRED status from DataFrame row
   - `determine_jpred_status()`: Determines JPred status from DataFrame row
   - `create_provider_status_for_row()`: Creates PeptideProviderStatus for a row

4. **Integrated Provider Status into Normalization** (`backend/services/normalize.py`)
   - Updated `normalize_rows_for_ui()` to accept `tango_enabled`, `psipred_enabled`, `jpred_enabled` params
   - Added provider status determination for each row
   - Added `providerStatus` to normalized output

5. **Updated Server Endpoints** (`backend/server.py`)
   - `/api/upload-csv`: Uses `normalize_rows_for_ui()` with provider status
   - `/api/predict`: Uses `normalize_rows_for_ui()` with provider status
   - `/api/example`: Uses `normalize_rows_for_ui()` with provider status

### Principle C: Remove fake defaults + Add caching

1. **Created Caching Infrastructure** (`backend/services/cache.py`)
   - `sequence_hash()`: SHA256 hash of sequence (16 chars)
   - `cache_key()`: Generate cache key for sequence + optional provider
   - `cache_get()` / `cache_set()`: Get/set cached results
   - `cache_clear()`: Clear cache entries
   - Cache directory: `backend/cache/` (created on first use)

2. **Added Fake Default Conversion** (`backend/services/normalize.py`)
   - `_convert_fake_defaults_to_null()`: Converts fake defaults to null based on provider status
   - Fake defaults removed:
     - `-1` for numeric "not available" → `null`
     - `0.0` for percentages when provider didn't run → `null`
     - `"-"` for string "not available" → `null`
     - Empty lists when provider didn't run → `null`
   - Applied during normalization before sending to UI

## ⏳ Remaining Tasks

### Principle B (Provider Status)
- [ ] Update frontend TypeScript types to include `providerStatus` field
- [ ] Update UI components to display provider status (optional, for debugging/transparency)

### Principle C (Fake Defaults)
- [ ] Update `tango.py` to NOT fill fake defaults in DataFrame (use `pd.NA` instead of `-1`, `0`, `"-"`)
  - Currently, fake defaults are still in DataFrame but converted to null during normalization
  - For complete compliance, should use `pd.NA` at source
- [ ] Update `psipred.py` to NOT fill fake defaults in DataFrame
- [ ] Update `server.py` helper functions to NOT fill fake defaults

### Principle C (Caching)
- [ ] Integrate caching into server endpoints (optional - infrastructure is ready)
- [ ] Add cache TTL support (currently cache persists until manually cleared)

### Testing
- [ ] Update `backend/tests/test_golden_pipeline.py` to assert provider status contract
  - Verify `providerStatus` is present in all responses
  - Verify fake defaults are `null` when provider is not available
  - Verify `providerStatus` accurately reflects provider availability

## Notes

### Current Behavior
- Provider status is **mandatory** - every response includes `providerStatus`
- Fake defaults are converted to `null` during normalization (Principle C partial compliance)
- DataFrame columns may still contain fake defaults (e.g., `-1`, `0`, `"-"`), but these are converted to `null` before sending to UI
- Caching infrastructure is ready but not yet integrated into endpoints

### Next Steps
1. Update frontend types (quick)
2. Update golden tests to assert provider status contract (important)
3. Optionally: Update DataFrame-level code to use `pd.NA` instead of fake defaults (complete Principle C compliance)
4. Optionally: Integrate caching into endpoints for performance

