# Peptide Visual Lab (PVL) - Developer Reference

**Audience**: Developers working on or integrating with PVL
**Last Updated**: 2026-03-01
**Prerequisites**: Python familiarity, basic understanding of REST APIs
**Quick overview**: See [ACTIVE_CONTEXT.md](ACTIVE_CONTEXT.md) for architecture summary and entry points.

---

## Table of Contents

1. [File Interaction Map](#1-file-interaction-map)
2. [Data Pipeline Deep Dive](#2-data-pipeline-deep-dive)
3. [Header Matching Algorithm](#3-header-matching-algorithm)
4. [Provider Error Isolation](#4-provider-error-isolation)
5. [Trace ID System](#5-trace-id-system)
6. [Null Semantics & Sanitization](#6-null-semantics--sanitization)
7. [FF Flag Computation](#7-ff-flag-computation)
8. [Debugging Workflows](#8-debugging-workflows)
9. [Key Function Signatures](#9-key-function-signatures)
10. [Frontend Data Flow](#10-frontend-data-flow)

---

## 1. File Interaction Map

### Backend Call Graph (CSV Upload Path)

```
browser POST /api/upload-csv
  │
  ├─► api/routes/upload.py                      # Thin route handler
  │     │
  │     ├─► services/upload_service.py           # File parsing + validation + orchestration
  │     │     ├─► services/dataframe_utils.py    # read_any_table(), ensure_ff_cols()
  │     │     │     ├─► auxiliary.py              # ff_helix_percent(), ff_helix_cores()
  │     │     │     └─► biochem_calculation.py    # hydrophobic_moment() [for beta uH]
  │     │     └─► calculations/biochem.py         # calculate_biochemical_features()
  │     │           └─► biochem_calculation.py    # total_charge(), hydrophobicity(), hydrophobic_moment()
  │     │
  │     ├─► tango.py (if USE_TANGO=1)            # TANGO binary execution
  │     │     ├─► run_tango_simple()             # Subprocess call to binary
  │     │     ├─► process_tango_output()          # Parse output files
  │     │     └─► filter_by_avg_diff()            # SSW classification (database-avg)
  │     │
  │     ├─► s4pred.py (if USE_S4PRED=1)          # S4PRED neural network
  │     │     ├─► run_s4pred_database()           # Run ensemble on all rows
  │     │     │     └─► tools/s4pred/model.py     # S4PredPredictor.predict_from_sequence()
  │     │     │           └─► tools/s4pred/network.py  # GRUnet ensemble inference
  │     │     ├─► analyse_s4pred_result()          # Extract segments, compute scores
  │     │     └─► filter_by_s4pred_diff()          # SSW classification (database-avg)
  │     │
  │     ├─► services/dataframe_utils.py           # apply_ff_flags() — FF-Helix + FF-SSW flags
  │     │     ├─► auxiliary.py                     # get_corrected_sequence()
  │     │     └─► biochem_calculation.py           # hydrophobic_moment()
  │     │
  │     ├─► services/normalize.py                 # normalize_rows_for_ui()
  │     │     ├─► schemas/peptide.py               # PeptideSchema.model_validate()
  │     │     ├─► schemas/provider_status.py       # PeptideProviderStatus
  │     │     └─► services/provider_tracking.py    # create_provider_status_for_row()
  │     │
  │     └─► schemas/api_models.py                 # RowsResponse validation (final gate)
  │
  └─► browser receives JSON { rows: [...], meta: {...} }
```

### Schema Chain (Data Transformation)

```
DataFrame columns (PascalCase/legacy names)
  │  "Entry", "Sequence", "FF-Helix %", "SSW prediction"
  │
  ▼
PeptideSchema (backend/schemas/peptide.py)
  │  Uses Field(alias="...") to map column names to snake_case
  │  "FF-Helix %" → ff_helix_percent
  │  "SSW prediction" → ssw_prediction
  │  Validates types, coerces NaN→None
  │
  ▼
PeptideSchema.to_camel_dict()
  │  snake_case → camelCase
  │  ff_helix_percent → ffHelixPercent
  │  entry → id (special case)
  │  mu_h → muH (special case)
  │
  ▼
_convert_fake_defaults_to_null() + _sanitize_for_json()
  │  -1.0 scores → null (BUT -1 predictions preserved)
  │  NaN/Inf → null
  │
  ▼
PeptideRow (backend/schemas/api_models.py)
  │  Final Pydantic validation gate
  │  Unknown fields → extras dict
  │
  ▼
JSON response (camelCase keys)
  │  { "id": "P123", "ffHelixPercent": 45.2, "sswPrediction": 1, ... }
  │
  ▼
Frontend: ApiPeptideRow → peptideMapper → Peptide type
```

---

## 2. Data Pipeline Deep Dive

### normalize_rows_for_ui() — The Central Pipeline

**Location**: `backend/services/normalize.py`
**Purpose**: Convert DataFrame rows to API-ready JSON dicts

```python
def normalize_rows_for_ui(
    df: pd.DataFrame,
    use_tango: bool,
    use_s4pred: bool,
    tango_status: str,      # "AVAILABLE" | "UNAVAILABLE" | "PARTIAL" | "OFF"
    s4pred_status: str,
    trace_id: str,
) -> list[dict]:
```

**Pipeline stages** (in order):

1. **Header synonym resolution** — Map column names to canonical names
2. **Per-row iteration** — For each DataFrame row:
   a. Build row dict from DataFrame
   b. Add S4PRED per-residue curves (if available in `s4pred_results` column)
   c. Add TANGO per-residue curves (if available in `tango_*` columns)
   d. Validate through `PeptideSchema.model_validate(row_dict)`
   e. Convert to camelCase via `PeptideSchema.to_camel_dict()`
   f. Run `_convert_fake_defaults_to_null()` — scores of -1.0 → null
   g. Run `_sanitize_for_json()` — NaN/Inf → null (preserving prediction -1 values)
   h. Attach `providerStatus` from `create_provider_status_for_row()`
3. **Return** list of clean camelCase dicts

### Key Invariant: prediction_fields

```python
# In _sanitize_for_json():
prediction_fields = {
    "sswPrediction",          # -1/0/1 are all valid
    "s4predSswPrediction",    # -1/1 are valid
    "s4predHelixPrediction",  # -1/1 are valid
    "ffHelixFlag",            # -1/1 are valid
    "ffSswFlag",              # -1/1 are valid
}
```

These fields are **excluded** from the `-1 → null` conversion because `-1` is a meaningful value (= "not a candidate").

---

## 3. Header Matching Algorithm

**Location**: `backend/services/normalize.py` — `HEADER_SYNONYMS` dict and `_resolve_header_synonyms()`

PVL accepts CSVs with various column naming conventions. The matching uses a **3-tier priority system**:

### Tier 1: Exact Canonical Match (Highest Priority)
```python
# If the column name exactly matches the canonical name:
"Entry" → "Entry"
"Sequence" → "Sequence"
"Hydrophobicity" → "Hydrophobicity"
```

### Tier 2: Exact Synonym Match
```python
HEADER_SYNONYMS = {
    "Entry": ["entry", "Accession", "accession", "ID", "id", "Entry name", ...],
    "Sequence": ["sequence", "Seq", "seq", "Peptide sequence", ...],
    "Length": ["length", "Sequence length", "seq_length", ...],
    "Hydrophobicity": ["hydrophobicity", "Hydro", "hydro", "GRAVY", ...],
    "Charge": ["charge", "Net charge", "net_charge", ...],
    "Full length uH": ["mu_h", "muH", "Hydrophobic moment", ...],
    # ... ~20 more canonical fields
}
```

Each canonical column name maps to a list of known synonyms. If a CSV column name exactly matches any synonym, it's mapped to the canonical name.

### Tier 3: Word-Boundary Regex (Lowest Priority)
```python
# For columns that don't match tiers 1-2, a fuzzy match is attempted:
# "Protein_Name" → matches "Protein name" via word-boundary pattern
# "my_hydrophobicity_score" → matches "Hydrophobicity" via word-boundary pattern
```

This uses `re.search(r'\b' + re.escape(synonym) + r'\b', column_name, re.IGNORECASE)`.

### Resolution Order

```python
def _resolve_header_synonyms(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {}
    for canonical, synonyms in HEADER_SYNONYMS.items():
        if canonical in df.columns:
            continue  # Already have canonical name, skip
        for synonym in synonyms:
            if synonym in df.columns:
                rename_map[synonym] = canonical
                break  # First match wins
            # Fuzzy fallback
            for col in df.columns:
                if re.search(r'\b' + re.escape(synonym) + r'\b', col, re.IGNORECASE):
                    rename_map[col] = canonical
                    break
    return df.rename(columns=rename_map)
```

**Important**: First match wins within each canonical group. If your CSV has both `"Seq"` and `"Peptide sequence"`, whichever appears first in the synonyms list gets priority.

---

## 4. Provider Error Isolation

### Architecture

Each prediction provider (TANGO, S4PRED) is **completely isolated** — one provider's failure never affects another or crashes the pipeline.

```python
# services/upload_service.py — simplified
try:
    if use_tango:
        tango_result = run_tango_simple(records)
        process_tango_output(df, tango_result)
        filter_by_avg_diff(df)
        tango_status = "AVAILABLE"
except Exception as e:
    logger.error(f"TANGO failed: {e}", extra={"trace_id": trace_id})
    tango_status = "UNAVAILABLE"
    _nullify_tango_columns(df)

try:
    if use_s4pred:
        run_s4pred_database(df)
        filter_by_s4pred_diff(df)
        s4pred_status = "AVAILABLE"
except Exception as e:
    logger.error(f"S4PRED failed: {e}", extra={"trace_id": trace_id})
    s4pred_status = "UNAVAILABLE"
    _nullify_s4pred_columns(df)
```

### Status Determination

**Location**: `backend/services/provider_tracking.py`

```python
def determine_tango_status(use_tango: bool, tango_ran: bool, parsed_ok: int, parsed_bad: int) -> str:
    if not use_tango:
        return "OFF"           # Config disabled
    if not tango_ran:
        return "UNAVAILABLE"   # Enabled but failed to run
    if parsed_bad > 0 and parsed_ok > 0:
        return "PARTIAL"       # Some sequences failed
    if parsed_ok > 0:
        return "AVAILABLE"     # All good
    return "UNAVAILABLE"       # Ran but produced no results
```

### Row-Level Provider Status

Each row in the response includes its own `providerStatus`:

```python
# services/provider_tracking.py
def create_provider_status_for_row(row_dict, tango_status, s4pred_status):
    return {
        "tango": {
            "status": tango_status,
            "enabled": use_tango,
            "ran": tango_ran,
        },
        "s4pred": {
            "status": s4pred_status,
            "enabled": use_s4pred,
            "ran": s4pred_ran,
        }
    }
```

### Nullification on Failure

When a provider fails, its columns are set to `None`/`NaN` in the DataFrame:

```python
def _nullify_tango_columns(df):
    tango_cols = ["SSW prediction", "SSW score", "SSW diff",
                  "SSW helix percentage", "SSW beta percentage",
                  "Tango Aggregation max", "Tango Beta max", "Tango Helix max"]
    for col in tango_cols:
        if col in df.columns:
            df[col] = None
```

This ensures downstream code never sees stale/corrupt data from a failed provider.

---

## 5. Trace ID System

### Overview

Every request gets a unique trace ID that propagates through the entire stack for debugging.

### Implementation

**Location**: `backend/api/main.py` (middleware), `backend/services/trace_id.py`

```
Request arrives
  │
  ├─► TraceIdMiddleware checks X-Trace-Id header
  │     │
  │     ├─ If present: use it
  │     └─ If absent: generate UUID4
  │
  ├─► Sets ContextVar (thread-local storage)
  │     trace_id_var = ContextVar("trace_id", default="no-trace")
  │
  ├─► All service functions call get_trace_id()
  │     │
  │     ├─► logger.info("Processing", extra={"trace_id": trace_id})
  │     ├─► logger.error("Failed", extra={"trace_id": trace_id})
  │     └─► Included in response meta
  │
  └─► Response includes:
        ├─ X-Trace-Id header (echo back)
        └─ meta.traceId field in JSON body
```

### Usage in Code

```python
# Any service file:
from services.trace_id import get_trace_id

def some_service_function():
    trace_id = get_trace_id()
    logger.info("Processing peptides", extra={"trace_id": trace_id})
```

### Structured Logging

```python
# backend/api/main.py — StructuredFormatter
class StructuredFormatter(logging.Formatter):
    def format(self, record):
        # Includes trace_id in every log line
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "trace_id": getattr(record, "trace_id", "no-trace"),
            "module": record.module,
        }
        return json.dumps(log_data)
```

### Debugging with Trace IDs

1. User reports an issue → ask for the trace ID (visible in browser DevTools response headers or in the JSON meta)
2. Search logs: `grep "trace_id.*abc123" backend.log`
3. Follow the full request lifecycle through all services

---

## 6. Null Semantics & Sanitization

### The Rules

| Value | Meaning | JSON Output |
|-------|---------|-------------|
| `None` / `NaN` | No data available | `null` |
| `0` / `0.0` | Valid zero | `0` / `0.0` |
| `-1` (prediction field) | Valid prediction: "not a candidate" | `-1` |
| `-1.0` (score field) | Fake default: "no data" | `null` |
| `Inf` / `-Inf` | Invalid | `null` |

### Where Sanitization Happens

```
DataFrame (may contain NaN, Inf, -1.0 fake defaults)
  │
  ├─► PeptideSchema validators (coerce_nan_to_none, coerce_nan_to_none_int)
  │     NaN → None, Inf → None for typed fields
  │
  ├─► _convert_fake_defaults_to_null()
  │     -1.0 scores (like ssw_score=-1.0 when no SSW) → null
  │     EXCEPT: prediction fields (-1 is valid) are SKIPPED
  │
  └─► _sanitize_for_json()
        Final pass: any remaining NaN/Inf → null
        prediction_fields set: -1 values preserved
```

### The prediction_fields Set

These fields use `-1` as a **valid semantic value** (not a sentinel):

```python
prediction_fields = {
    "sswPrediction",          # -1 = no structural switch
    "s4predSswPrediction",    # -1 = no SSW detected
    "s4predHelixPrediction",  # -1 = no helix detected
    "ffHelixFlag",            # -1 = not a FF-Helix candidate
    "ffSswFlag",              # -1 = not a FF-SSW candidate
}
```

---

## 7. FF Flag Computation

**Location**: `backend/services/dataframe_utils.py:apply_ff_flags()`

### FF-SSW Flag

```python
# Simplified logic:
def compute_ff_ssw(row, avg_hydro, avg_beta_uh, avg_full_uh):
    ssw_pred = row["SSW prediction"]  # From TANGO or S4PRED

    if ssw_pred is None or pd.isna(ssw_pred):
        return None, None  # No data → null flag, null score

    if ssw_pred == -1:
        return -1, None    # SSW says no switch → not a candidate

    # SSW says yes (1) — check thresholds
    score = (row["Hydrophobicity"] + row["Beta full length uH"]
             + row["Full length uH"] + ssw_pred)

    if (row["Hydrophobicity"] > avg_hydro
        and row["Beta full length uH"] > avg_beta_uh
        and row["Full length uH"] > avg_full_uh):
        return 1, score    # Candidate
    else:
        return -1, score   # Didn't meet thresholds
```

**Key detail**: "Beta full length uH" is computed as `hydrophobic_moment(sequence, angle=160)` — beta-sheet geometry (vs 100 for alpha-helix).

### FF-Helix Flag

```python
# Simplified logic:
def compute_ff_helix(row, avg_helix_uh):
    helix_pred = row.get("Helix prediction (S4PRED)")

    if helix_pred is None or pd.isna(helix_pred):
        return None, None  # No S4PRED data → null

    if helix_pred == -1:
        return -1, None    # No helix → not a candidate

    helix_uh = row["Helix (s4pred) uH"]  # muH of helix segments only
    helix_score = row.get("Helix score (S4PRED)", 0)

    score = helix_uh + helix_score

    if helix_uh > avg_helix_uh:
        return 1, score    # Candidate
    else:
        return -1, score   # Helix not amphipathic enough
```

### Database-Level Thresholds

Both flags use **database-average thresholds** — the average is computed from the current upload batch, not a fixed constant. This means the same peptide might be flagged in one dataset but not another.

---

## 8. Debugging Workflows

### "A peptide has null sswPrediction but S4PRED shows AVAILABLE"

**Check path**:
1. Was `filter_by_s4pred_diff()` called? → Check `s4pred.py:filter_by_s4pred_diff()`
2. Does the row have S4PRED SSW data? → Check `s4predSswDiff` in the response
3. If `s4predSswDiff` is null → `analyse_s4pred_result()` couldn't find SSW segments
4. Check the sequence: very short sequences (< 6 aa) produce no segments

### "FF-Helix flag is null but FF-Helix % has a value"

**Why**: FF-Helix % (Chou-Fasman) has no dependencies — it always computes. The FF-Helix *flag* requires S4PRED helix prediction. If S4PRED didn't run or found no helix, the flag is null.

**Check**: Look at `s4predHelixPrediction` — if it's null or -1, the FF-Helix flag can't be 1.

### "normalize_rows_for_ui produces fewer rows than the DataFrame"

**Check path**:
1. Does `PeptideSchema.model_validate()` throw for some rows? → Check for missing required fields (`Entry`, `Sequence`)
2. Are there rows with `Entry = NaN`? → These will fail validation
3. Check logs for `trace_id` to find the specific error

### "A column from my CSV is missing in the response"

**Check path**:
1. Is the column in `HEADER_SYNONYMS`? → If not, it goes into `extras` dict
2. Check tier matching: print `df.columns` before and after `_resolve_header_synonyms()`
3. Common issue: column name has leading/trailing whitespace

### "Scores are all null but flags are -1"

**Expected behavior**: When a flag is -1 (not a candidate), the score may be null (not computed) or a valid number. The score is only guaranteed when the flag is 1 (candidate met all thresholds).

### Running Tests Locally

```bash
# All tests (235 passing, no external tools needed)
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/ -v --tb=short

# Specific test file
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_ff_helix_golden.py -v

# Single test
cd backend && USE_TANGO=0 USE_S4PRED=0 .venv/bin/python -m pytest tests/test_ff_helix_golden.py::TestFfSswScore::test_ssw_score_basic -v

# With Makefile
make test         # All tests
make test-unit    # Fast unit tests only
make lint         # Python linting
make ci           # Full pipeline (lint + typecheck + test)
```

---

## 9. Key Function Signatures

### Prediction Functions

```python
# backend/s4pred.py
def run_s4pred_database(df: pd.DataFrame) -> None:
    """Run S4PRED on all rows. Modifies df in-place, adding ~15 columns."""

def analyse_s4pred_result(prediction: dict) -> dict:
    """Extract helix/beta segments, compute SSW. Returns dict with all S4PRED columns."""

def filter_by_s4pred_diff(df: pd.DataFrame) -> None:
    """Compute database-avg SSW threshold, set SSW prediction to 1/-1."""
```

```python
# backend/tango.py
def run_tango_simple(records: list[dict]) -> dict:
    """Run TANGO binary. Returns {entry: output_lines}."""

def process_tango_output(df: pd.DataFrame, tango_result: dict) -> None:
    """Parse TANGO output, add SSW/aggregation columns to df."""

def filter_by_avg_diff(df: pd.DataFrame) -> None:
    """Compute database-avg SSW threshold, set SSW prediction to -1/0/1."""
```

### Biochem Functions

```python
# backend/biochem_calculation.py
def total_charge(sequence: str) -> float:
    """Net charge at pH 7.4 using Henderson-Hasselbalch."""

def hydrophobicity(sequence: str) -> float:
    """Average Kyte-Doolittle hydrophobicity."""

def hydrophobic_moment(sequence: str, angle: int = 100, window: int = 11) -> float:
    """Eisenberg hydrophobic moment. angle=100 for helix, angle=160 for beta."""
```

### FF-Helix Functions

```python
# backend/auxiliary.py
def ff_helix_percent(sequence: str) -> float:
    """Chou-Fasman sliding-window helix propensity (0-100%). Pure Python, no deps."""

def ff_helix_cores(sequence: str) -> list[tuple[int, int]]:
    """Extract helix-prone segments. Returns 1-indexed (start, end) tuples."""

def get_corrected_sequence(sequence: str) -> str:
    """Replace non-standard amino acids (B→N, Z→Q, X→A, etc.)."""
```

```python
# backend/services/dataframe_utils.py
def apply_ff_flags(df: pd.DataFrame) -> None:
    """Compute FF-Helix and FF-SSW flags + scores. Modifies df in-place.
    Adds: 'FF-Helix (Jpred)', 'FF-Helix score',
          'FF-Secondary structure switch', 'FF-SSW score'."""

def ensure_ff_cols(df: pd.DataFrame) -> None:
    """Ensure FF-Helix % and fragments columns exist. Adds them if missing."""
```

### Normalization Functions

```python
# backend/services/normalize.py
def normalize_rows_for_ui(df, use_tango, use_s4pred, tango_status, s4pred_status, trace_id) -> list[dict]:
    """Convert DataFrame → list of camelCase dicts ready for API response."""

def _resolve_header_synonyms(df: pd.DataFrame) -> pd.DataFrame:
    """Map CSV column names to canonical names using 3-tier matching."""

def _convert_fake_defaults_to_null(row_dict: dict) -> dict:
    """Convert -1.0 sentinel scores to None (but preserve -1 predictions)."""

def _sanitize_for_json(row_dict: dict) -> dict:
    """Final NaN/Inf → None pass. Preserves -1 in prediction_fields."""
```

---

## 10. Frontend Data Flow

### Store Architecture

```
Upload.tsx / QuickAnalyze.tsx
  │  User triggers analysis
  │
  ▼
datasetStore.ts (Zustand)
  │  POST /api/upload-csv or /api/predict
  │  Receives { rows: ApiPeptideRow[], meta: ApiMeta }
  │
  ├─► peptideMapper.ts: mapApiRowToPeptide(row) → Peptide
  │     Maps backend camelCase → frontend Peptide type
  │     Handles optional fields, tango/s4pred curve extraction
  │
  ├─► Store state updated:
  │     peptides: Peptide[]
  │     metadata: DatasetMetadata
  │     stats: DatasetStats (computed from peptides)
  │
  ▼
Results.tsx
  │  Reads from store: peptides, stats, metadata
  │
  ├─► ResultsKpis.tsx (KPI cards from stats)
  ├─► ResultsCharts.tsx (scatter plots from peptides)
  └─► Data table (sortable/filterable from peptides)
        │
        └─► Click row → PeptideDetail.tsx
              │  Per-residue curves from peptide.s4pred / peptide.tango
              └─► Recharts line charts
```

### Type Mapping (Backend → Frontend)

| Backend (api_models.py) | Frontend (peptide.ts) | Notes |
|---|---|---|
| `PeptideRow.id` | `Peptide.id` | Required |
| `PeptideRow.sswPrediction` | `Peptide.sswPrediction` | SSWPrediction type: -1\|0\|1\|null |
| `PeptideRow.ffHelixFlag` | `Peptide.ffHelixFlag` | number \| null |
| `PeptideRow.ffHelixScore` | `Peptide.ffHelixScore` | number \| null |
| `PeptideRow.ffSswFlag` | `Peptide.ffSswFlag` | number \| null |
| `PeptideRow.ffSswScore` | `Peptide.ffSswScore` | number \| null |
| `PeptideRow.providerStatus` | `Peptide.providerStatus` | ProviderStatus type |
| `PeptideRow.extras` | Not mapped | Extra fields dropped at frontend |

### Provider Badge Logic

```typescript
// ui/src/components/ProviderBadge.tsx
// Renders colored badge based on provider status:
// "AVAILABLE"   → green badge
// "PARTIAL"     → yellow badge
// "UNAVAILABLE" → red badge
// "OFF"         → gray badge
```

---

*For high-level architecture decisions, see `docs/active/MASTER_DEV_DOC.md`.
For non-technical explanation, see `README_EXPLAINER.md`.
For API contracts, see `docs/active/CONTRACTS.md`.*
