# Principles Implementation Plan

## Principle A: Outputs-first, UI-second
**Status**: Already satisfied - UI consumes backend outputs via PeptideSchema contract.

## Principle B: "Provider status" is mandatory
**Status**: IN PROGRESS

### Changes Required:
1. ✅ Created `backend/schemas/provider_status.py` with ProviderStatus and PeptideProviderStatus schemas
2. ✅ Updated `PeptideSchema` to include optional `provider_status` field
3. ⏳ Update normalization to add provider status to each row
4. ⏳ Update server endpoints to track and include provider status
5. ⏳ Update frontend types to include providerStatus

### Implementation Details:
- Each peptide response must include `providerStatus` object with:
  - `tango: {status: "available"|"failed"|"unavailable"|"not_configured", reason?: string}`
  - `psipred: {status: ..., reason?: string}`
  - `jpred: {status: ..., reason?: string}`

## Principle C: Add caching early + Remove fake defaults
**Status**: IN PROGRESS

### Changes Required:
1. ✅ Created `backend/services/cache.py` with sequence hash caching
2. ⏳ Update tango.py to NOT fill fake defaults (use pd.NA instead of -1, 0, "-")
3. ⏳ Update psipred.py to NOT fill fake defaults
4. ⏳ Update server.py to NOT fill fake defaults
5. ⏳ Update normalization to convert fake defaults to null before sending to UI
6. ⏳ Integrate caching into server endpoints (optional for now, infrastructure is ready)
7. ⏳ Update golden pipeline tests to assert provider status contract

### Fake Defaults to Remove:
- `-1` for numeric "not available" markers → use `null`
- `0.0` for percentages when provider didn't run → use `null`
- `"-"` for string "not available" markers → use `null`
- Empty lists `[]` for "not available" → use `null` (if provider didn't run)

### Note:
DataFrame columns still need to exist (to avoid KeyError), but values should be `pd.NA` or `None`. During normalization to UI format, convert `pd.NA` and fake defaults to `null` (JSON null = Python None).

