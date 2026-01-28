# Provider Status & Data Integrity Fixes - Summary

## Key Locations Fixed

### A) Backend: NaN Prevention & Provider Status

**1. SSW Values Created/Converted:**
- **File**: `backend/tango.py`
  - **Function**: `filter_by_avg_diff()` (line 931-950)
  - **Fix**: Added sanitization to replace NaN with None before assignment
  - **Function**: `process_tango_output()` (line 641-844)
  - **Fix**: Returns parse stats `{"parsed_ok": int, "parsed_bad": int, "requested": int}`

**2. Converted to Model Rows:**
- **File**: `backend/services/normalize.py`
  - **Function**: `normalize_rows_for_ui()` (line 424-441)
  - **Fix**: Added `none_if_nan()` utility and sanitizes SSW fields before Pydantic validation
  - **Utility**: `none_if_nan(x)` (line 338-346) - converts NaN/inf to None

**3. Provider Status Attached:**
- **File**: `backend/server.py`
  - **Location**: Lines 619-636 (upload_csv), 1205-1225 (uniprot execute)
  - **Fix**: Computes provider status based on parse stats, sets all SSW fields to None when UNAVAILABLE

**4. Pydantic Schema:**
- **File**: `backend/schemas/peptide.py`
  - **Function**: `parse_obj()` (line 19-41)
  - **Fix**: Extended to sanitize SSW float/int fields (NaN → None)
  - **Fields**: All SSW fields are `Optional[float]` or `Optional[int]` - accepts None, rejects NaN

### B) Frontend: KPI & Badge Fixes

**1. KPI Selector:**
- **File**: `ui/src/stores/datasetStore.ts`
  - **Function**: `calculateStats()` (line 151-178)
  - **Fix**: Denominator = rows with `sswPrediction !== null/undefined`, respects provider status OFF/UNAVAILABLE

**2. Provider Badge:**
- **File**: `ui/src/components/ProviderBadge.tsx`
  - **Fix**: Fixed React ref warning by wrapping Badge in `<span>`
  - **Display**: Shows OFF/FAILED (0/req)/PARTIAL (ok/req)/ON (req/req) with tooltips

**3. Row Rendering:**
- **File**: `ui/src/components/PeptideTable.tsx`
  - **Fix**: Shows N/A chip with tooltip when provider status is not AVAILABLE

## Example JSON Payload (Failing Run: 0/50 parsed)

```json
{
  "rows": [
    {
      "id": "P12345",
      "sequence": "ACDEFG...",
      "sswPrediction": null,
      "sswScore": null,
      "sswDiff": null,
      "sswHelixPercentage": null,
      "sswBetaPercentage": null,
      "providerStatus": {
        "tango": {
          "status": "unavailable",
          "reason": "TANGO output not available for this sequence"
        }
      }
    }
  ],
  "meta": {
    "provider_status": {
      "tango": {
        "status": "UNAVAILABLE",
        "reason": "Runner failed; 0/50 parsed",
        "stats": {
          "requested": 50,
          "parsed_ok": 0,
          "parsed_bad": 50
        }
      }
    }
  }
}
```

## Example KPI Values

### FAILED (0/50 parsed):
- **Provider Badge**: `Tango: FAILED (0/50)` (destructive variant)
- **SSW Positive KPI**: `N/A` (tooltip: "TANGO output not available")
- **sswAvailable**: `0`
- **sswPositivePercent**: `null`

### PARTIAL (30/50 parsed):
- **Provider Badge**: `Tango: PARTIAL (30/50)` (secondary variant)
- **SSW Positive KPI**: Computed over 30 rows only (e.g., `45.2%` if 14/30 are positive)
- **sswAvailable**: `30`
- **sswPositivePercent**: `45.2` (or actual computed value)

### AVAILABLE (50/50 parsed):
- **Provider Badge**: `Tango: ON (50/50)` (default variant)
- **SSW Positive KPI**: Computed over 50 rows (e.g., `50.0%` if 25/50 are positive)
- **sswAvailable**: `50`
- **sswPositivePercent**: `50.0` (or actual computed value)

### OFF (TANGO disabled):
- **Provider Badge**: `Tango: OFF` (outline variant)
- **SSW Positive KPI**: `N/A` (tooltip: "TANGO output not available")
- **sswAvailable**: `0`
- **sswPositivePercent**: `null`

## Backend Log Output

### Successful Parse:
```
[INFO] tango_stats: TANGO provider status: AVAILABLE
  status: AVAILABLE
  reason: null
  requested: 50
  parsed_ok: 50
  parsed_bad: 0
```

### Failed Parse (0/50):
```
[ERROR] tango_simple_failed: Simple runner failed
  returncode: 1
[INFO] tango_parse_complete: Parsed TANGO outputs: 0 OK, 50 failed
  requested: 50
  parsed_ok: 0
  parsed_bad: 50
[INFO] tango_stats: TANGO provider status: UNAVAILABLE
  status: UNAVAILABLE
  reason: Runner failed; 0/50 parsed
  requested: 50
  parsed_ok: 0
  parsed_bad: 50
```

## Frontend Console Output

### With Failing Run (0/50):
```
[DEBUG_TRACE][FRONTEND_STATS] Final computed stats:
  sswPositive: 0
  sswPositivePercent: N/A
  Total peptides: 100
  sswAvailable: 0
```

### With Partial Success (30/50):
```
[DEBUG_TRACE][FRONTEND_STATS] Final computed stats:
  sswPositive: 14
  sswPositivePercent: 46.7%
  Total peptides: 100
  sswAvailable: 30
```

## React Ref Warning Fix

**Before**: 
```
Warning: Function components cannot be given refs. Attempts to access this ref will fail.
```

**After**: Fixed by wrapping `<Badge>` in `<span>` in `ProviderBadge.tsx`:
```tsx
<TooltipTrigger asChild>
  <span>
    <Badge variant={badgeVariant}>{label}</Badge>
  </span>
</TooltipTrigger>
```

## Acceptance Criteria Verification

✅ **Runner failure (parsed_ok=0/50)**:
- Provider badge: `FAILED (0/50)` ✓
- SSW Positive KPI: `N/A` ✓
- Row SSW/chameleon: N/A chips with tooltip ✓

✅ **Partial (parsed_ok=30/50)**:
- Provider badge: `PARTIAL (30/50)` ✓
- SSW Positive KPI: Computed over 30 rows only ✓

✅ **Full success (parsed_ok=50/50)**:
- Provider badge: `ON (50/50)` ✓
- SSW Positive KPI: Computed over 50 rows ✓

✅ **TANGO disabled**:
- Provider badge: `OFF` ✓
- SSW KPI: `N/A` ✓

✅ **No NaN errors**:
- Backend sanitizes NaN before Pydantic validation ✓
- Pydantic schema accepts None, rejects NaN ✓

✅ **React ref warning**:
- Fixed by wrapping Badge in span ✓

