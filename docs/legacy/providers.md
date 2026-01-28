# Provider Status & Data Integrity

## Overview

This document describes the provider status system and data integrity guarantees for TANGO, PSIPRED, and other analysis providers in Peptide Visual Lab.

## Provider Status Enum

Provider status is one of four states:

- **OFF**: Provider is disabled by configuration (e.g., `USE_TANGO=0`)
- **UNAVAILABLE**: Provider execution or parsing failed (e.g., `parsed_ok = 0`)
- **PARTIAL**: Provider partially succeeded (e.g., `0 < parsed_ok < requested`)
- **AVAILABLE**: Provider fully succeeded (e.g., `parsed_ok == requested`)

## Data Contract

### Row Fields Dependent on TANGO

The following fields depend on TANGO and must be `null` when provider status is not `AVAILABLE`:

- `sswPrediction`: Secondary Structure Switch prediction (-1/0/1 classification)
- `sswScore`: SSW average score
- `sswDiff`: Helix and beta difference
- `sswHelixPercentage`: Helix percentage from TANGO
- `sswBetaPercentage`: Beta percentage from TANGO
- `sswFragments`: SSW fragment residues

**Invariant**: If `providerStatus.tango.status !== "AVAILABLE"`, these fields must be `null` (not `-1`, not `0`, not empty string).

### API Response Structure

The API response includes provider status metadata:

```json
{
  "meta": {
    "provider_status": {
      "tango": {
        "status": "AVAILABLE" | "OFF" | "UNAVAILABLE" | "PARTIAL",
        "reason": "string | null",
        "stats": {
          "requested": 50,
          "parsed_ok": 50,
          "parsed_bad": 0
        }
      },
      "psipred": { ... },
      "jpred": { ... }
    }
  }
}
```

## Backend Implementation

### TANGO Parse Stats

After TANGO parsing, the backend computes:

- `requested`: Number of sequences scheduled for TANGO (e.g., 50)
- `parsed_ok`: Number of sequences with valid parsed TANGO outputs
- `parsed_bad`: `requested - parsed_ok`

### Provider Status Computation

```python
if parsed_ok == 0:
    status = "UNAVAILABLE"
    reason = "No valid TANGO outputs parsed"
elif parsed_ok < requested:
    status = "PARTIAL"
    reason = f"Only {parsed_ok}/{requested} sequences parsed successfully"
else:
    status = "AVAILABLE"
    reason = None
```

### SSW Prediction Gating

SSW prediction is only computed for rows with valid TANGO metrics:

```python
if row["SSW diff"] == -1:
    # No valid TANGO metrics → set to None
    preds.append(None)
else:
    # Compute prediction based on threshold
    preds.append(1 if row["SSW diff"] <= avg_diff else -1)
```

Rows without valid TANGO metrics have `sswPrediction = null` (not `-1`, not `0`).

## Frontend Implementation

### SSW Positive % KPI

**Numerator**: Rows with `sswPrediction === 1`

**Denominator**: Rows with `sswPrediction !== null && sswPrediction !== undefined`

**Result**: If denominator == 0 → show "N/A" with tooltip "TANGO output not available"

### Provider Badge

The `ProviderBadge` component displays provider status:

- **OFF**: `Tango: OFF` (outline variant)
- **UNAVAILABLE**: `Tango: FAILED (0/50)` (destructive variant)
- **PARTIAL**: `Tango: PARTIAL (30/50)` (secondary variant)
- **AVAILABLE**: `Tango: ON (50/50)` (default variant)

Tooltip shows `reason` when present.

### Row-Level Rendering

If `providerStatus.tango.status !== "AVAILABLE"`, render N/A chips for SSW/chameleon fields with tooltip "TANGO output not available".

## Acceptance Criteria

### Runner Failure (parsed_ok=0/50)

- Provider badge: `FAILED (0/50)`
- SSW Positive KPI: `N/A` (tooltip: "TANGO output not available")
- Row SSW/chameleon: N/A chips with tooltip

### Partial Success (parsed_ok=30/50)

- Provider badge: `PARTIAL (30/50)`
- SSW Positive KPI: Computed over 30 rows only
- Row SSW/chameleon: N/A chips for rows without TANGO metrics

### Full Success (parsed_ok=50/50)

- Provider badge: `ON (50/50)`
- SSW Positive KPI: Computed over 50 rows
- Row SSW/chameleon: All rows have valid predictions

### TANGO Disabled

- Provider badge: `OFF`
- SSW KPI: `N/A` (no denominator)
- Row SSW/chameleon: N/A chips

## Logging

Backend logs include `tango_stats` object:

```python
log_info("tango_stats", f"TANGO provider status: {status}", **{
    "status": status,
    "reason": reason,
    "requested": requested,
    "parsed_ok": parsed_ok,
    "parsed_bad": parsed_bad,
})
```

## Testing

### Unit Tests

- KPI denominator logic: `rowsWithSSW = rows.filter(r => r.sswPrediction != null)`
- Provider status computation: `parsed_ok=0 → UNAVAILABLE`
- Row field gating: `sswPrediction = null` when provider status is not AVAILABLE

### Backend Test Fixture

```python
# Simulate parsed_ok=0 scenario
parse_stats = {"requested": 50, "parsed_ok": 0, "parsed_bad": 50}
# Verify: provider_status.tango.status == "UNAVAILABLE"
# Verify: all rows have sswPrediction == None
```

