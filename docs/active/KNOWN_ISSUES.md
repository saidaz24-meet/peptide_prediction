# Known Issues — Prioritized Backlog

**Last Updated**: 2025-01-31

## Priority Definitions

| Priority | Meaning | Action |
|----------|---------|--------|
| **P0** | Breaks core workflow | Fix immediately |
| **P1** | Incorrect results | Fix this sprint |
| **P2** | Cleanup/refactor | Backlog |

---

# Backlog Summary

| ID | Priority | Issue | Root Module | Blast Radius | Test to Add | Status |
|----|----------|-------|-------------|--------------|-------------|--------|
| ISSUE-001 | **P0** | Missing `await` breaks UniProt parse endpoint | `backend/api/routes/uniprot.py` | LOW | `test_uniprot_parse_endpoint` | ✅ FIXED |
| ISSUE-002 | **P2** | Double-mapping + undefined var in frontend | `ui/src/stores/datasetStore.ts` | LOW | `TestUploadCsvErrorHandling` | ✅ FIXED |

---

# P0 — Breaks Core Workflow

## ISSUE-001: Missing `await` on `parse_uniprot_query_service`

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | **FIXED** (2025-01-31) |
| **Blast Radius** | LOW |
| **Root Module** | `backend/api/routes/uniprot.py:35` |
| **Test to Add** | `test_uniprot_parse_endpoint` in `test_api_contracts.py` |

### Symptom
```
POST /api/uniprot/parse failed: 1 validation errors:
{'type': 'model_attributes_type', 'loc': ('response',),
'msg': 'Input should be a valid dictionary or object to extract fields from',
'input': <coroutine object parse_uniprot_query_service at 0x10f01b6b0>}
```

### Reproduction
```bash
curl -X POST http://localhost:8000/api/uniprot/parse \
  -H "Content-Type: application/json" \
  -d '{"query": "P53_HUMAN"}'
```

### Analysis
- **Expected**: Returns parsed UniProt query with `mode`, `components`, `query` fields
- **Actual**: Returns coroutine object → Pydantic validation fails → 500 error
- **Cause**: `uniprot.py:35` calls async function without `await`

### Affected Files
1. `backend/api/routes/uniprot.py` (line 35) — **FIX HERE**
2. `backend/services/uniprot_service.py` (lines 13-16) — async function definition

### Fix (Proposed)
```python
# backend/api/routes/uniprot.py line 35
return await parse_uniprot_query_service(request)  # Add await
```

### Success Criteria
- [x] `POST /api/uniprot/parse` returns 200
- [x] Response validates against `UniProtQueryParseResponse`
- [x] No Sentry errors

### Workaround
~~None — endpoint is completely broken.~~ **FIXED**

---

## ISSUE-002: Missing `id`/`Entry` field on CSV upload

| Field | Value |
|-------|-------|
| **Priority** | P0 → **P2** (downgraded) |
| **Status** | **FIXED** (2025-01-31) |
| **Blast Radius** | LOW |
| **Root Module** | `ui/src/stores/datasetStore.ts`, `ui/src/pages/Results.tsx`, `ui/src/pages/MetricDetail.tsx` |
| **Test Added** | `TestUploadCsvErrorHandling` in `test_api_contracts.py` |

### Symptom
```
"Something went wrong Cannot map row: missing required field "id" or "Entry" Try again."
```

### Root Cause (IDENTIFIED)

**Two bugs found in frontend:**

1. **Undefined `input` variable** in `datasetStore.ts:142`
   ```typescript
   // BUG: 'input' was undefined in this scope
   const source = typeof input === 'object' && 'sequence' in input ...
   ```

2. **Double-mapping** in `Results.tsx:133` and `MetricDetail.tsx:49`
   - `peptides` from store is already `Peptide[]` (mapped by `ingestBackendRows`)
   - Code was calling `mapApiRowsToPeptides()` again on already-mapped data
   - This could fail if mapped objects lost fields during serialization

### Fix Applied (2025-01-31)

**Files changed:**
- `ui/src/stores/datasetStore.ts` — Fixed undefined `input` reference
- `ui/src/pages/Results.tsx` — Removed double-mapping, use `peptides` directly
- `ui/src/pages/MetricDetail.tsx` — Removed double-mapping, use `peptides` directly

**Backend tests added:**
- `test_upload_csv_without_headers_returns_400`
- `test_upload_csv_with_id_column_returns_id_field`
- `test_upload_csv_with_accession_column_returns_id_field`

### Success Criteria
- [x] CSV with "Entry" header uploads successfully (backend verified)
- [x] CSV with "id" header uploads successfully (backend verified)
- [x] CSV with "Accession" header uploads successfully (backend verified)
- [x] Frontend double-mapping removed
- [x] Frontend undefined variable fixed
- [x] Frontend builds successfully

### Verification
```bash
cd ui && npm run build  # Should succeed
```

---

# P1 — Incorrect Results

_No issues documented yet._

---

# P2 — Cleanup/Refactor

_No issues documented yet._

---

# How to Add Issues

Use this template:

```markdown
## ISSUE-XXX: [Short description]

| Field | Value |
|-------|-------|
| **Priority** | P0/P1/P2 |
| **Status** | Open |
| **Blast Radius** | LOW/MEDIUM/HIGH |
| **Root Module** | `path/to/file.py` |
| **Test to Add** | `test_name` in `test_file.py` |

### Symptom
[Exact error message]

### Reproduction
[Steps or curl command]

### Analysis
- **Expected**: ...
- **Actual**: ...
- **Cause**: ...

### Affected Files
1. `file1.py` — description
2. `file2.ts` — description

### Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Workaround
[Temporary fix or "None"]
```

