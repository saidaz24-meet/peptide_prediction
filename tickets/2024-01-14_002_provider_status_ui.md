# Ticket 002: Provider Status Visibility

**Date**: 2024-01-14
**Phase**: 1.2
**Priority**: High
**Status**: COMPLETED (2026-02-01)

## Resolution

Provider status is now visible in the UI:

- ✅ Backend returns `providerStatus` in API responses (upload_service.py, predict_service.py)
- ✅ Provider status includes TANGO/PSIPRED/JPred status, reason, and stats
- ✅ Frontend displays provider status in Results page via meta data
- ✅ SSW badge shows availability based on provider status

## Implementation Notes

The provider status is tracked in:
- `services/upload_service.py` - Global state with getters/setters
- Response meta includes `provider_status` with status/reason/stats for each provider
- Frontend uses `meta.provider_status` to display status badges

## Files Changed

- `backend/services/upload_service.py`
- `backend/services/predict_service.py`
- `backend/server.py`
- `ui/src/components/ResultsKpis.tsx`
- `ui/src/components/Legend.tsx`
