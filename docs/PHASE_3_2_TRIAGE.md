# Phase 3.2 Triage: TANGO Runtime Failure

**Date**: 2026-02-02
**Status**: TRIAGE COMPLETE - Ready for fix implementation
**Symptom**: Sentry error "TANGO produced 0 outputs for N inputs", UI shows "Tango = N/A"

---

## Executive Summary

**Root Cause**: TANGO binary execution fails at runtime, producing no output files. The tests pass because they run with `USE_TANGO=0`, bypassing real TANGO execution.

**Impact**:
- All TANGO/SSW fields show `null` in API responses
- UI displays "N/A" for Tango-dependent columns
- Provider status shows `UNAVAILABLE` with reason

---

## 1. Exact Runtime Path Producing "0 Outputs"

### Call Stack

```
server.py:upload_csv() or execute_uniprot_query()
  └── services/upload_service.py or services/predict_service.py
        └── tango.run_tango_pipeline() (line ~1200)
              └── tango.run_tango_simple() (line ~700-900)
                    └── subprocess.run(TANGO_BIN, ...)
              └── tango.process_tango_output() (line ~1070-1120)
                    └── ValueError: "tango produced 0 outputs for N inputs" (line 1115)
```

### Error Origin

**File**: `backend/tango.py`, lines 1103-1117

```python
# process_tango_output() counts successful parses
ok_ctr = 0
for entry in df["Entry"]:
    # ... attempt to parse TANGO output file for entry ...
    if parse_success:
        ok_ctr += 1

# Error raised here if no outputs parsed
if ok_ctr == 0:
    raise ValueError(f"tango produced 0 outputs for {requested} inputs")
```

### Error Handling

**File**: `backend/server.py`, lines 720-754

When this error is caught:
1. TANGO provider status set to `UNAVAILABLE`
2. Reason captured: `"tango produced 0 outputs"`
3. `run_meta.json` written with diagnostics (if available)
4. HTTPException 500 raised with error details

---

## 2. TANGO Binary vs Docker

### Current Configuration

**TANGO runs as a native binary, NOT Docker**.

Evidence from `backend/tango.py`:

```python
# Line ~60-80: Binary path determination
TANGO_BIN = os.getenv("TANGO_BIN", "/path/to/tango")  # Native binary
TANGO_TIMEOUT = int(os.getenv("TANGO_TIMEOUT", "120"))

# Line ~750-800: Execution via subprocess
result = subprocess.run(
    [TANGO_BIN, ...args...],
    cwd=work_dir,
    timeout=TANGO_TIMEOUT,
    capture_output=True
)
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `USE_TANGO` | Enable/disable TANGO processing | `0` (disabled) |
| `TANGO_BIN` | Path to TANGO executable | Platform-dependent |
| `TANGO_TIMEOUT` | Execution timeout in seconds | `120` |

---

## 3. Where "TANGO is N/A" Decision is Made

### Three decision points:

#### A. Provider Status Creation (`services/provider_tracking.py`)

```python
def create_provider_status_for_row(row, tango_enabled, tango_output_available, ...):
    if not tango_enabled:
        status = "OFF"
    elif not tango_output_available:
        status = "UNAVAILABLE"
    else:
        status = "AVAILABLE"
```

#### B. Nullification in Normalize (`services/normalize.py`, lines 259-276)

```python
def _convert_fake_defaults_to_null(row_dict, provider_status):
    if provider_status.tango.status != "AVAILABLE":
        # ALL TANGO fields become null
        tango_fields = ["sswPrediction", "sswScore", "sswDiff", ...]
        for field in tango_fields:
            result[field] = None
```

#### C. UI Display (`ui/src/lib/peptideMapper.ts`, lines 150-159)

```typescript
// sswPrediction: null = no prediction available (provider didn't run)
if (sswPredictionRaw === null || sswPredictionRaw === undefined) {
    sswPrediction = null;  // Displayed as "N/A" in table
}
```

---

## 4. Diagnostic Information

### Available Diagnostics

When TANGO fails, `run_meta.json` is created with:

```json
{
  "traceId": "abc123",
  "cmd": "/path/to/tango args...",
  "cwd": "/work/dir",
  "bin_path": "/path/to/tango",
  "exit_code": 1,
  "stderr_tail": "last 500 chars of stderr",
  "reason": "tango produced 0 outputs for 3 inputs"
}
```

**Location**: `run-cache/{run_id}/run_meta.json`

### Logging

Structured logs capture:
- `[tango_start]` - Beginning TANGO execution
- `[tango_cmd]` - Full command being executed
- `[tango_timeout]` - If execution times out
- `[tango_error]` - If binary fails
- `[tango_parse_fail]` - If output parsing fails

---

## 5. Why Tests Pass But Production Fails

### Test Configuration

**File**: `backend/tests/` - All test files

```bash
# Tests run with external providers disabled
USE_TANGO=0 USE_PSIPRED=0 python -m pytest tests/
```

### What Tests Exercise

| Test File | TANGO Coverage |
|-----------|----------------|
| `test_golden_pipeline.py` | Uses `USE_TANGO=0` - skips real TANGO |
| `test_preprocessing_golden.py` | Tests preprocessing, not TANGO execution |
| `test_api_contracts.py` | Tests response format, not TANGO integration |

### Gap

There is **no runtime smoke test** that:
1. Starts the server with `USE_TANGO=1`
2. Submits a real sequence
3. Verifies TANGO output is produced
4. Validates non-null SSW values in response

---

## 6. Probable Root Causes

### Most Likely

1. **TANGO binary not found or not executable**
   - `TANGO_BIN` env var not set or points to invalid path
   - Binary missing execute permissions

2. **Binary execution fails silently**
   - Exit code 0 but no output files produced
   - TANGO expects specific input format not being provided

3. **Output file parsing mismatch**
   - TANGO outputs files but `process_tango_output()` can't find them
   - Entry ID mismatch between input and output filenames

### Less Likely

4. **Timeout** - Would show in logs as `[tango_timeout]`
5. **Permission issues** - Would show as subprocess error
6. **Disk full** - Would show as write error

---

## 7. Required Information for Fix

Before implementing fix, need to confirm:

1. **Environment check**:
   ```bash
   echo $USE_TANGO        # Should be 1
   echo $TANGO_BIN        # Should be valid path
   ls -la $TANGO_BIN      # Should be executable
   ```

2. **Manual TANGO test**:
   ```bash
   cd backend
   python -c "from tango import run_tango_simple; print(run_tango_simple('ACDEFGHIK', 'test'))"
   ```

3. **Check run_meta.json** after a failed request:
   ```bash
   cat run-cache/*/run_meta.json | jq .
   ```

---

## 8. New Issues to Add

### ISSUE-022: TANGO Binary Produces 0 Output Files at Runtime

- **Priority**: P0 (blocks production use of TANGO)
- **Category**: Provider Execution
- **Impact**: All TANGO/SSW features non-functional in production
- **Evidence**: Sentry error "tango produced 0 outputs for N inputs"

### ISSUE-023: UI Shows "N/A" Despite USE_TANGO=1

- **Priority**: P1 (dependent on ISSUE-022)
- **Category**: User Experience
- **Impact**: Users see "N/A" for Tango columns when expecting predictions
- **Root Cause**: ISSUE-022 - if TANGO fails, status becomes UNAVAILABLE

### ISSUE-024: Missing Runtime Smoke Test for TANGO

- **Priority**: P1 (testing gap)
- **Category**: Test Coverage
- **Impact**: Tests pass but production fails - no runtime TANGO validation
- **Suggested Fix**: Add `make smoke-tango` that runs with `USE_TANGO=1`

---

## 9. Recommended Fix Order

1. **ISSUE-022** - Fix TANGO binary execution (investigate environment first)
2. **ISSUE-024** - Add `make smoke-tango` to prevent regression
3. **ISSUE-023** - Will auto-resolve when ISSUE-022 is fixed

---

## 10. Files to Modify (After Triage Approval)

| File | Change |
|------|--------|
| `backend/tango.py` | Add diagnostic logging around binary execution |
| `Makefile` | Add `smoke-tango` target |
| `scripts/smoke_tango.py` | New: runtime TANGO validation script |
| `docs/ISSUE_REGISTER.md` | Add ISSUE-022, ISSUE-023, ISSUE-024 |

---

**TRIAGE COMPLETE - Awaiting approval to proceed with fixes**
