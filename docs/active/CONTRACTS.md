# API Contracts

**Last Updated**: 2025-01-14  
**Purpose**: Exact request/response shapes for all API endpoints.

---

## Response Format Standard

**All endpoints return camelCase keys** (e.g., `id`, `sequence`, `sswPrediction`).  
**Forbidden**: Capitalized keys (e.g., `Entry`, `Sequence`, `FF-Helix %`) - these are CSV format only.

**Schema**: `backend/schemas/api_models.py:PeptideRow`  
**Validation**: `ui/src/lib/apiValidator.ts` (development mode only)

---

## Endpoints

### POST `/api/upload-csv`

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `file`: File (CSV/TSV/XLSX)
  - `debug_entry?`: string (Query param) - Entry ID to trace
  - `thresholdConfig?`: string (Form param) - JSON threshold config

**Response**: `RowsResponse`
```json
{
  "rows": [
    {
      "id": "P12345",
      "sequence": "MKTAY...",
      "length": 150,
      "hydrophobicity": 0.45,
      "charge": 2.0,
      "muH": 0.32,
      "sswPrediction": 1,
      "sswScore": 0.85,
      "sswDiff": 0.12,
      "sswHelixPercentage": 35.2,
      "sswBetaPercentage": 28.1,
      "ffHelixPercent": 42.5,
      "ffHelixFragments": [[5, 12], [20, 28]],
      "providerStatus": {
        "tango": {"status": "available"},
        "psipred": {"status": "unavailable", "reason": "Docker not configured"},
        "jpred": {"status": "not_configured"}
      },
      "name": "Protein name",
      "species": "Homo sapiens"
    }
  ],
  "meta": {
    "use_jpred": false,
    "use_tango": true,
    "jpred_rows": 0,
    "ssw_rows": 120,
    "valid_seq_rows": 150,
    "provider_status": {...},
    "providerStatusSummary": {
      "tango": {"status": "available", "requested": 150, "parsed_ok": 120, "parsed_bad": 0},
      "psipred": {"status": "unavailable"},
      "jpred": {"status": "not_configured"}
    },
    "runId": "uuid4",
    "traceId": "uuid4",
    "inputsHash": "sha256-first-16-chars",
    "configHash": "sha256-first-16-chars",
    "thresholdConfigRequested": {...},
    "thresholdConfigResolved": {...},
    "thresholds": {...}
  }
}
```

**Required Input Columns**:
- `Entry` (or `Accession`, `ID`) - Unique identifier
- `Sequence` - Amino acid sequence

**Optional Input Columns**:
- `Length` - Sequence length (computed if missing)
- `Protein name` - Protein name
- `Organism` - Species/organism
- Others: Computed server-side if missing

---

### POST `/api/predict`

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `sequence`: string (required) - Amino acid sequence
  - `entry?`: string (optional) - Entry ID
  - `thresholdConfig?`: string (optional) - JSON threshold config

**Response**: `PredictResponse`
```json
{
  "row": {
    "id": "P12345",
    "sequence": "MKTAY...",
    "length": 150,
    "hydrophobicity": 0.45,
    "charge": 2.0,
    "muH": 0.32,
    "sswPrediction": 1,
    "sswScore": 0.85,
    "sswDiff": 0.12,
    "sswHelixPercentage": 35.2,
    "sswBetaPercentage": 28.1,
    "ffHelixPercent": 42.5,
    "ffHelixFragments": [[5, 12], [20, 28]],
    "providerStatus": {...}
  },
  "meta": {
    "use_jpred": false,
    "use_tango": true,
    "jpred_rows": 0,
    "ssw_rows": 1,
    "valid_seq_rows": 1,
    "provider_status": {...},
    "providerStatusSummary": {...},
    "runId": "uuid4",
    "traceId": "uuid4",
    "inputsHash": "sha256-first-16-chars",
    "configHash": "sha256-first-16-chars",
    "thresholdConfigRequested": {...},
    "thresholdConfigResolved": {...},
    "thresholds": {...}
  }
}
```

**Note**: Single row format (not array).

---

### GET `/api/example`

**Request**:
- Method: `GET`
- Query params:
  - `recalc?`: int (default: 0) - Set to 1 to recompute results

**Response**: `RowsResponse` (same as `/api/upload-csv`)

**Source**: `ui/public/Final_Staphylococcus_2023_new.xlsx`

---

### POST `/api/uniprot/execute`

**Request**:
- Method: `POST`
- Content-Type: `application/json`
- Body: `UniProtQueryExecuteRequest`
```json
{
  "query": "P53_HUMAN",
  "mode": "auto",
  "size": 100,
  "run_tango": true
}
```

**Response**: `RowsResponse` (same as `/api/upload-csv`, with additional meta fields):
```json
{
  "rows": [...],
  "meta": {
    ...standard meta fields...,
    "source": "uniprot_api",
    "query": "P53_HUMAN",
    "api_query_string": "accession:P53_HUMAN",
    "mode": "accession",
    "url": "https://rest.uniprot.org/uniprotkb/...",
    "row_count": 1,
    "size_requested": 100,
    "size_returned": 1,
    "run_tango": true
  }
}
```

---

### POST `/api/uniprot/parse`

**Request**:
- Method: `POST`
- Content-Type: `application/json`
- Body: `UniProtQueryParseRequest`
```json
{
  "query": "P53_HUMAN"
}
```

**Response**: `UniProtQueryParseResponse`
```json
{
  "mode": "accession",
  "components": {
    "accession": "P53_HUMAN"
  },
  "api_query_string": "accession:P53_HUMAN",
  "confidence": "high"
}
```

**Modes**: `accession`, `keyword`, `organism`, `keyword_organism`, `unknown`

---

### POST `/api/uniprot/window`

**Request**:
- Method: `POST`
- Content-Type: `application/json`
- Body:
```json
{
  "sequences": [
    {"id": "P53_HUMAN", "sequence": "MEEPQSDPSV..."}
  ],
  "windowSize": 20,
  "stepSize": 5
}
```

**Response**:
```json
{
  "peptides": [
    {
      "id": "P53_HUMAN_1-20",
      "name": "P53_HUMAN (1-20)",
      "sequence": "MEEPQSDPSVEPPLSQETFS",
      "start": 1,
      "end": 20
    }
  ]
}
```

---

### GET `/api/uniprot/ping`

**Request**: `GET`

**Response**:
```json
{
  "status": "ok",
  "message": "UniProt API is reachable"
}
```

---

### GET `/api/health`

**Request**: `GET`

**Response**:
```json
{
  "ok": true
}
```

---

### GET `/api/providers/last-run`

**Request**: `GET`

**Response**:
```json
{
  "tango": {
    "status": "available",
    "reason": null,
    "stats": {
      "requested": 150,
      "parsed_ok": 120,
      "parsed_bad": 0
    }
  },
  "psipred": {
    "status": "unavailable",
    "reason": "Docker not configured"
  },
  "jpred": {
    "status": "not_configured"
  },
  "run_dirs": {
    "tango": "/path/to/latest/run"
  },
  "sample_counts": {
    "total_rows": 150,
    "ssw_rows_with_data": 120
  }
}
```

---

### GET `/api/providers/diagnose/tango`

**Request**: `GET`

**Response**:
```json
{
  "status": "found",
  "path": "/absolute/path/to/tango",
  "version": "TANGO version string",
  "reason": null
}
```

**Status Values**: `found`, `missing`, `no-exec-permission`, `container-missing`, `unknown`

---

### POST `/api/feedback`

**Request**:
- Method: `POST`
- Content-Type: `application/json`
- Body: `FeedbackRequest`
```json
{
  "message": "User feedback text",
  "screenshot": "base64-encoded-image" (optional)
}
```

**Response**:
```json
{
  "ok": true
}
```

**Note**: Sends feedback to Sentry as INFO-level event (if Sentry configured).

---

## UI Requirements

### Required Fields

**From API Response**:
- `id` (string) - Entry/accession ID (required)
- `sequence` (string) - Amino acid sequence (required)

**Mapping**: UI accepts `id`, `Entry`, `entry`, `Accession`, `accession` as ID sources (see `ui/src/lib/peptideMapper.ts:109`)

### Field Mapping (CSV → API → UI)

**CSV Headers** → **API Keys** → **UI Properties**:
- `Entry` → `id` → `id`
- `Sequence` → `sequence` → `sequence`
- `Length` → `length` → `length`
- `Protein name` → `name` → `name`
- `Organism` → `species` → `species`
- `Hydrophobicity` → `hydrophobicity` → `hydrophobicity`
- `Charge` → `charge` → `charge`
- `Full length uH` → `muH` → `muH`
- `SSW prediction` → `sswPrediction` → `sswPrediction`
- `SSW score` → `sswScore` → `sswScore`
- `SSW diff` → `sswDiff` → `sswDiff`
- `SSW helix percentage` → `sswHelixPercentage` → `sswHelixPercentage`
- `SSW beta percentage` → `sswBetaPercentage` → `sswBetaPercentage`
- `FF-Helix %` → `ffHelixPercent` → `ffHelixPercent`
- `FF Helix fragments` → `ffHelixFragments` → `ffHelixFragments`

**Source**: `ui/src/lib/peptideSchema.ts:CSV_TO_FRONTEND`

### Provider Status

**Every row must include `providerStatus`**:
```json
{
  "providerStatus": {
    "tango": {
      "status": "available" | "unavailable" | "partial" | "not_configured",
      "reason": string | null
    },
    "psipred": {
      "status": "available" | "unavailable" | "not_configured",
      "reason": string | null
    },
    "jpred": {
      "status": "not_configured"
    }
  }
}
```

**Source**: `backend/services/provider_tracking.py:create_provider_status_for_row()`

---

## Error Responses

**Format**: Standard FastAPI HTTPException

**400 Bad Request**:
```json
{
  "detail": "Missing required column(s): ['Entry', 'Sequence']. Available columns: [...]"
}
```

**422 Validation Error**:
```json
{
  "detail": [
    {
      "loc": ["body", "sequence"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**500 Internal Server Error**:
```json
{
  "detail": "Internal server error message"
}
```

---

## Trace IDs

**All responses include `X-Trace-Id` header** for request correlation.

**Meta field includes `traceId`**:
```json
{
  "meta": {
    "traceId": "uuid4-string"
  }
}
```

**Source**: `backend/api/main.py:TraceIdMiddleware`

