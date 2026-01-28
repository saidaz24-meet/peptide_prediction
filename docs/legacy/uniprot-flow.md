# UniProt Query Flow Documentation

## Overview

This document describes the complete flow from UI input to UniProt API call, including parameter mapping, URL building, error handling, and fallback mechanisms.

## Flow Diagram

```
┌─────────────────┐
│  UI Component   │
│ UniProtQueryInput│
│ - Sort mapping  │
│ - Length guard  │
│ - Centralized   │
│   API call      │
└────────┬────────┘
         │ POST /api/uniprot/execute
         │ {query, sort: "length asc"|null, length_min: number|null, ...}
         ▼
┌─────────────────┐
│  API Layer      │
│ ui/src/lib/api.ts│
│ executeUniProt  │
│ Query()         │
│ - Error parsing │
│ - HTML stripping│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend        │
│ server.py       │
│ execute_...()   │
│ - Parse query   │
│ - Validate sort │
│ - Build URL     │
│ - Log full URL  │
│ - 400 fallback  │
└────────┬────────┘
         │ build_uniprot_export_url()
         │ Returns: httpx.URL (encoded)
         ▼
┌─────────────────┐
│  URL Builder    │
│ uniprot_query.py│
│ - Single length  │
│   clause [min TO max]
│ - Omit if null   │
│ - Proper encoding│
└────────┬────────┘
         │ Full encoded URL logged
         ▼
┌─────────────────┐
│  UniProt API    │
│ rest.uniprot.org│
└────────┬────────┘
         │ Returns 200 or 400
         ▼
┌─────────────────┐
│  Error Handler  │
│ - 400 → fallback│
│ - Parse HTML    │
│ - Return JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UI             │
│ - Auto-retry    │
│ - Show toast    │
└─────────────────┘
```

## 1. UI Request Building

**File**: `ui/src/components/UniProtQueryInput.tsx`

**Function**: `handleExecute()`

### Sort Mapping

The UI uses human-readable sort labels that map to UniProt API format:

```typescript
const UNIPROT_SORT_MAP: Record<string, string | null> = {
  'best': null,                       // Best Match → omit `sort` parameter
  'length-asc': 'length asc',
  'length-desc': 'length desc',
  'protein-asc': 'protein_name asc',
  'protein-desc': 'protein_name desc',
  'organism-asc': 'organism_name asc',
  'organism-desc': 'organism_name desc',
  'reviewed-asc': 'reviewed asc',
  'reviewed-desc': 'reviewed desc',
};
```

**Key Points**:
- "Best Match" (`best`) maps to `null` → sort parameter is **omitted** from request
- All other sorts map to UniProt format: `"field_name direction"` (e.g., `"length asc"`)
- Legacy `"score"` value is treated as `"best"` (omitted)

### Length Serialization

Length parameters are only sent if explicitly set by the user:

```typescript
// Only include if at least one is explicitly set
if (controls.lengthMin !== null && controls.lengthMin !== undefined) {
  requestBody.length_min = controls.lengthMin;
}
if (controls.lengthMax !== null && controls.lengthMax !== undefined) {
  requestBody.length_max = controls.lengthMax;
}
// If both null/undefined → omit length entirely
```

**Key Points**:
- No default values (initialized as `null`)
- Only sent if user explicitly sets a value
- Backend will format as `length:[min TO max]`, `length:[min TO *]`, or `length:[* TO max]`

### Request Body Structure

```typescript
{
  query: string,                    // User input (e.g., "9606")
  mode: QueryMode,                  // "auto" | "accession" | "keyword" | ...
  reviewed: boolean | null,         // true = Swiss-Prot, false = TrEMBL, null = both
  length_min: number | null,        // Only if user set it
  length_max: number | null,        // Only if user set it
  sort: string | null,              // UniProt format or null (best match)
  include_isoforms: boolean,
  size: number,
  run_tango: boolean,
  run_psipred: boolean,
  max_provider_sequences: number,
}
```

### Centralized API Call

**File**: `ui/src/lib/api.ts`

**Function**: `executeUniProtQuery()`

- Centralizes error handling
- Strips HTML from error messages
- Throws `ApiError` with status code for retry logic
- Used by `UniProtQueryInput` component

### Auto-Retry Logic

If a 400 error occurs and sort/length were included, the UI automatically retries without them:

```typescript
if (is400Error && !retryWithoutSort && !retryWithoutLength) {
  // Retry without sort and length
  return handleExecute(true, true);
}
```

Shows toast: `"Adjusted query (removed unsupported sort/length). Retrying..."`

## 2. Backend Request Handling

**File**: `backend/server.py`

**Function**: `execute_uniprot_query()`

### Query Parsing

If `mode` is `"auto"` (default), the backend calls `parse_uniprot_query()` to detect:
- Accession (e.g., "P12345")
- Keyword (e.g., "amyloid")
- Organism ID (e.g., "9606")
- Combinations (e.g., "amyloid organism_id:9606")

### Sort Validation

Backend validates sort against strict allowlist:

```python
ALLOWED_SORTS = {
    "length asc", "length desc",
    "reviewed asc", "reviewed desc",
    "protein_name asc", "protein_name desc",
    "organism_name asc", "organism_name desc",
}
```

- If `sort` is `None` or `"score"` → omitted (best match)
- If `sort` not in allowlist → raises 400
- Frontend sends UniProt format directly (e.g., `"length asc"`)

### URL Building

**File**: `backend/services/uniprot_query.py`

**Function**: `build_uniprot_export_url()`

Uses `httpx.URL` for proper encoding:

```python
import httpx
url = httpx.URL(base_url, params=params)
return str(url)
```

### Full URL Logging

Backend logs the **complete encoded URL** (no placeholders):

```python
logger.info({"event": "uniprot_url", "url": uniprot_url})
print(f"[UNIPROT][URL] Full encoded URL: {uniprot_url}")
```

This URL can be copied and pasted into a browser to test directly.

### Length Clause Building

Length filters are combined into a single clause:

```python
if length_min is not None and length_max is not None:
    query_parts.append(f"length:[{length_min} TO {length_max}]")
elif length_min is not None:
    query_parts.append(f"length:[{length_min} TO *]")
elif length_max is not None:
    query_parts.append(f"length:[* TO {length_max}]")
# If both are None: DO NOT append length clause
```

**Key Points**:
- Single clause when both bounds set: `length:[10 TO 100]`
- Wildcard when one bound: `length:[10 TO *]` or `length:[* TO 100]`
- Omitted entirely if both `None`

## 3. Error Handling & 400 Fallback

### Standard Error Handling

UniProt errors are parsed and returned with correct status codes:

- **400 (Bad Request)**: Invalid query/sort/length → returned as 400
- **500+ (Server Error)**: UniProt server issues → returned as 502
- **Timeout**: Request timeout → returned as 504

HTML error pages are parsed to extract readable messages.

### 400 Fallback Mechanism

If UniProt returns 400, the backend automatically tries a **minimal fallback**:

1. **Minimal Parameters**:
   - `format=json` (instead of `tsv`)
   - `fields=accession,id,length` (minimal fields)
   - No `sort` parameter
   - No `length` clause in query
   - Keep `reviewed` filter if set

2. **Fallback URL**:
   ```python
   minimal_params = {
       "query": api_query,  # Base query only
       "format": "json",
       "fields": "accession,id,length",
       "size": size,
   }
   minimal_url = httpx.URL("https://rest.uniprot.org/uniprotkb/search", params=minimal_params)
   ```

3. **Response Handling**:
   - If fallback succeeds → returns results with `"note": "uniprot-minimal-fallback"` in meta
   - If fallback fails → returns original 400 error
   - Logs indicate which attempt succeeded/failed

4. **Purpose**:
   - Helps identify which parameter caused the 400
   - Provides partial results even if full query fails
   - UI can show a message that query was adjusted

## 4. Parameter Mapping Reference

### UI → Backend → UniProt

| UI Label | UI Value | Backend Receives | UniProt Parameter |
|----------|----------|------------------|-------------------|
| Best Match | `"best"` | `null` (omitted) | (omitted - default) |
| Length (Shortest First) | `"length-asc"` | `"length asc"` | `sort=length asc` |
| Length (Longest First) | `"length-desc"` | `"length desc"` | `sort=length desc` |
| Protein Name (A-Z) | `"protein-asc"` | `"protein_name asc"` | `sort=protein_name asc` |
| Protein Name (Z-A) | `"protein-desc"` | `"protein_name desc"` | `sort=protein_name desc` |
| Organism Name (A-Z) | `"organism-asc"` | `"organism_name asc"` | `sort=organism_name asc` |
| Organism Name (Z-A) | `"organism-desc"` | `"organism_name desc"` | `sort=organism_name desc` |
| Reviewed Status (Asc) | `"reviewed-asc"` | `"reviewed asc"` | `sort=reviewed asc` |
| Reviewed Status (Desc) | `"reviewed-desc"` | `"reviewed desc"` | `sort=reviewed desc` |

### Length Parameters

| UI State | Backend Receives | UniProt Query Clause |
|----------|------------------|----------------------|
| Both null | `length_min: null, length_max: null` | (omitted) |
| Min=10, Max=null | `length_min: 10, length_max: null` | `length:[10 TO *]` |
| Min=null, Max=100 | `length_min: null, length_max: 100` | `length:[* TO 100]` |
| Min=10, Max=100 | `length_min: 10, length_max: 100` | `length:[10 TO 100]` |

## 5. Smoke Tests

### Test 1: Default Query (Best Match, No Length)

**Request**:
```json
{
  "query": "9606",
  "mode": "auto",
  "sort": null,
  "length_min": null,
  "length_max": null,
  "size": 10
}
```

**Expected Backend Log**:
```
[UNIPROT][URL] Full encoded URL: https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

**Expected Result**: `200 OK` with 10 rows

**Manual Test URL** (copy from logs):
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

### Test 2: Valid Sort (Length Descending)

**Request**:
```json
{
  "query": "9606",
  "mode": "auto",
  "sort": "length desc",
  "length_min": null,
  "length_max": null,
  "size": 10
}
```

**Expected Backend Log**:
```
[UNIPROT][URL] Full encoded URL: https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&sort=length+desc&size=10
```

**Expected Result**: `200 OK` with 10 rows, sorted by length (descending)

**Manual Test URL**:
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&sort=length+desc&size=10
```

### Test 3: Max Length Only

**Request**:
```json
{
  "query": "9606",
  "mode": "auto",
  "sort": null,
  "length_min": null,
  "length_max": 100,
  "size": 10
}
```

**Expected Backend Log**:
```
[UNIPROT][URL] Full encoded URL: https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue+AND+length%3A%5B*+TO+100%5D&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

**Expected Result**: `200 OK` with rows where length ≤ 100

**Manual Test URL**:
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue+AND+length%3A%5B*+TO+100%5D&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

### Test 4: 400 Error with Fallback

**Request** (with invalid parameter that triggers 400):
```json
{
  "query": "9606",
  "mode": "auto",
  "sort": "invalid_sort",
  "length_min": null,
  "length_max": null,
  "size": 10
}
```

**Expected Flow**:
1. Backend validates sort → rejects `"invalid_sort"` → returns 400
2. UI receives 400 → auto-retries without sort
3. Second request succeeds → returns 200
4. Toast shown: `"Adjusted query (removed unsupported sort/length). Retrying..."`

**Alternative**: If backend receives invalid sort and UniProt returns 400:
1. Backend tries minimal fallback
2. Fallback succeeds → returns results with `"note": "uniprot-minimal-fallback"`
3. UI shows results (may be limited fields)

## 6. Debugging Guide

### Check Backend Logs

Look for these log entries:

```
[UNIPROT][PARSE] Input: '9606'
[UNIPROT][PARSE] Detected mode: organism
[UNIPROT][PARSE] API query string: organism_id:9606
[UNIPROT][URL] Full encoded URL: https://rest.uniprot.org/uniprotkb/search?query=...
[UNIPROT][FETCH] Retrieved 10 rows from UniProt
```

### Copy-Paste Test

1. Copy the full encoded URL from backend logs
2. Paste into browser or curl:
   ```bash
   curl "<paste_url_here>"
   ```
3. Compare response with backend behavior

### Common Issues

**Issue**: `toast.info is not a function`
- **Cause**: `react-hot-toast` doesn't have `toast.info()`
- **Fix**: Use `toast()` for info messages (already fixed)

**Issue**: UniProt returns 400 even with valid parameters
- **Check**: Backend logs for full URL
- **Action**: Try minimal fallback manually
- **Solution**: May be UniProt API issue - check their status

**Issue**: Length filter not working
- **Check**: Backend logs show `length:[...]` in query
- **Verify**: Both `length_min` and `length_max` are `null` if not set
- **Test**: Copy URL from logs and test in browser

**Issue**: Sort not applied
- **Check**: UI sends `sort: "length asc"` (not `"length-asc"`)
- **Verify**: Backend logs show `sort=length+asc` in URL
- **Test**: Copy URL and verify sort parameter

## 7. Files Modified

### UI Files

1. **`ui/src/components/UniProtQueryInput.tsx`**
   - Sort mapping (`UNIPROT_SORT_MAP`)
   - Length serialization (only if not null)
   - Auto-retry logic for 400 errors
   - Fixed `toast.info()` → `toast()`

2. **`ui/src/lib/api.ts`**
   - Added `executeUniProtQuery()` function
   - Centralized error handling
   - HTML stripping from errors
   - `ApiError` class with status code

### Backend Files

1. **`backend/server.py`**
   - Full URL logging (no placeholders)
   - 400 fallback with minimal params
   - Proper error status codes (400 → 400, not 502)
   - HTML error parsing

2. **`backend/services/uniprot_query.py`**
   - Uses `httpx.URL` for proper encoding
   - Returns full encoded URL string
   - Fixed length clause logic (single clause)

3. **`backend/schemas/uniprot_query.py`**
   - Updated `sort` field: `Optional[str]` (was `Optional[Literal[...]]`)
   - Accepts UniProt format directly (e.g., `"length asc"`)

## 8. Example URLs

These URLs are examples of what the backend generates. Copy the exact URL from backend logs for testing.

### Basic Query
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

### With Sort
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&sort=length+desc&size=10
```

### With Length Filter
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue+AND+length%3A%5B*+TO+100%5D&format=tsv&fields=accession%2Cid%2Cprotein_name%2Corganism_name%2Corganism_id%2Csequence%2Clength&size=10
```

### Minimal Fallback (JSON)
```
https://rest.uniprot.org/uniprotkb/search?query=organism_id%3A9606+AND+reviewed%3Atrue&format=json&fields=accession%2Cid%2Clength&size=10
```

## Summary

- ✅ **UI**: Strict sort mapping, no phantom length, "Best Match" = no sort
- ✅ **Backend**: Full encoded URL logging, 400 fallback with minimal params
- ✅ **Error Handling**: Clean messages, auto-retry, proper status codes
- ✅ **Documentation**: Complete flow with examples and smoke tests
