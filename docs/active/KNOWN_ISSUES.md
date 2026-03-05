# Known Issues — Prioritized Backlog

**Last Updated**: 2026-03-05

> **Status**: All 17 issues from the original backlog are FIXED. No open P0/P1/P2 issues.
> This file is kept for historical reference and as a template for future issues.

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
| ISSUE-003 | **P2** | CONTRACTS.md missing S4PRED fields | `docs/active/CONTRACTS.md` | LOW | — | ✅ FIXED |
| ISSUE-004 | **P2** | DEV_CONTEXT.md duplicate of ACTIVE_CONTEXT | `docs/DEV_CONTEXT.md` | LOW | — | ✅ FIXED (deleted) |
| ISSUE-005 | **P2** | REFACTOR_PLAN.md stale migration status | `docs/REFACTOR_PLAN.md` | LOW | — | ✅ FIXED (deleted) |
| ISSUE-006 | **P2** | ROADMAP.md uncommitted changes | `docs/active/ROADMAP.md` | LOW | — | ✅ FIXED (kept) |
| ISSUE-007 | **P2** | Switch Nginx → Caddy for auto-HTTPS | `docker/Caddyfile` | MEDIUM | — | ✅ READY (set DOMAIN in .env) |
| ISSUE-008 | **P1** | Remove PSIPRED/JPred dead code | 49 files | LOW | — | ✅ DONE |
| ISSUE-009 | **P1** | Simplify tango.py (1527 → 1306 lines) | `backend/tango.py` | MEDIUM | — | ✅ DONE |
| ISSUE-010 | **P1** | Simplify auxiliary.py (540 → 377 lines) | `backend/auxiliary.py` | LOW | — | ✅ DONE |
| ISSUE-011 | **P2** | Optimize Docker image (3GB → <1GB) | `docker/Dockerfile.*` | LOW | — | ✅ DONE (CPU-only torch + split deps) |
| ISSUE-012 | **P2** | Data table filter button is decorative | `ui/src/components/PeptideTable.tsx` | LOW | — | ✅ FIXED |
| ISSUE-013 | **P1** | normalize.py blanket -1.0 conversion | `backend/services/normalize.py` | MEDIUM | — | ✅ FIXED |
| ISSUE-014 | **P1** | JS \|\| vs ?? for numeric 0 | `ui/src/lib/peptideMapper.ts` | MEDIUM | — | ✅ FIXED |
| ISSUE-015 | **P1** | SSW self-referential threshold | `backend/tango.py`, `backend/s4pred.py` | MEDIUM | — | ✅ FIXED |
| ISSUE-016 | **P1** | S4PRED availability check case sensitivity | `backend/server.py` | HIGH | — | ✅ FIXED |
| ISSUE-017 | **P1** | Non-standard amino acid crashes | `backend/biochem_calculation.py` | MEDIUM | `test_nonstandard_aa.py` | ✅ FIXED |

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

_No open P1 issues._

---

## ISSUE-013: normalize.py blanket -1.0 conversion broke charge = -1.0

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-02-13) |
| **Blast Radius** | MEDIUM |
| **Root Module** | `backend/services/normalize.py` |

### Fix Applied
- `_sanitize_for_json()` was converting ALL float `-1.0` to `None` — broke legitimate `charge = -1.0`
- Removed blanket conversion. Field-specific `-1 → null` already handled by `_convert_fake_defaults_to_null()`
- **Rule**: Never use blanket sentinel conversion. Always use field-specific logic.

---

## ISSUE-014: JS `||` vs `??` for numeric 0 in peptideMapper.ts

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-02-13) |
| **Blast Radius** | MEDIUM |
| **Root Module** | `ui/src/lib/peptideMapper.ts` |

### Fix Applied
- Used `||` for `ffHelixPercent` fallback — JS treats `0` as falsy, so `ffHelixPercent: 0` was lost (showed "–")
- Changed to `??` (nullish coalescing) — only treats null/undefined as missing
- **Rule**: ALWAYS use `??` for numeric fallback chains in TypeScript.

---

## ISSUE-015: SSW self-referential threshold for single peptide

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-02-13) |
| **Blast Radius** | MEDIUM |
| **Root Module** | `backend/tango.py`, `backend/s4pred.py` |

### Fix Applied
- Single peptide: SSW threshold = mean([x]) = x, so x < x always False → always returned -1
- Both `tango.py:filter_by_avg_diff()` and `s4pred.py:filter_by_s4pred_diff()` now use fallback_threshold (0.0) when len(valid_diffs) <= 1
- Also fixed: `predict_service.py` SSW hit detection used `!= -1` (wrong for None), now uses `notna()` check
- Also fixed: `health.py` missing `import time`

---

## ISSUE-016: S4PRED availability check case sensitivity

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-02-13) |
| **Blast Radius** | HIGH |
| **Root Module** | `backend/server.py` |

### Fix Applied
- S4PRED availability check compared uppercase vs lowercase status strings, always returned 0
- Fixed string comparison to be case-consistent

---

## ISSUE-017: Non-standard amino acid crashes (X, O, J)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-02-13) |
| **Blast Radius** | MEDIUM |
| **Root Module** | `backend/biochem_calculation.py`, `backend/auxiliary.py` |

### Fix Applied
- Hydrophobicity raised `KeyError` on non-standard amino acids (X, O, J)
- Hydrophobic moment raised `TypeError` (None * float) on unknown residues
- Added O→K (pyrrolysine) and J→L (Leu/Ile) to `get_corrected_sequence()`
- 21 new tests added for non-standard amino acid handling

---

## ISSUE-012: Data table filter button is decorative (non-functional)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ **FIXED** (2026-02-07) |
| **Blast Radius** | LOW |
| **Root Module** | `ui/src/components/PeptideTable.tsx` |

### Fix Applied
- Added collapsible filter panel with 10 column filters:
  - 4 categorical dropdowns: SSW Prediction, FF-Helix Flag, FF-SSW Flag, S4PRED Helix
  - 5 numeric range inputs: Charge, Hydrophobicity, μH, FF-Helix %, Length
  - 1 text search: Species
- Pre-filters data before TanStack table (handles hidden columns like ffHelixFlag)
- Filter button shows active count badge, "Clear all" resets all filters
- Animated panel open/close with framer-motion

---

# P2 — Cleanup/Refactor

## ISSUE-003: CONTRACTS.md missing S4PRED fields

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ **FIXED** (2026-02-05) |
| **Blast Radius** | LOW |
| **Root Module** | `docs/active/CONTRACTS.md` |

### Fix Applied
- Added S4PRED fields to PeptideRow example
- Added SSW Semantics section explaining 1/-1/0/null values
- Updated providerStatus to use UPPERCASE status values
- Added s4pred to providerStatusSummary example

---

## ISSUE-004: DEV_CONTEXT.md is duplicate of ACTIVE_CONTEXT.md

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ **FIXED** (2026-02-05) |
| **Blast Radius** | LOW |
| **Root Module** | `docs/DEV_CONTEXT.md` |

### Fix Applied
- Deleted `docs/DEV_CONTEXT.md` (duplicate)
- ACTIVE_CONTEXT.md is now the single authoritative source

---

## ISSUE-005: REFACTOR_PLAN.md may have stale migration status

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ **FIXED** (2026-02-05) |
| **Blast Radius** | LOW |
| **Root Module** | `docs/REFACTOR_PLAN.md` |

### Fix Applied
- Deleted `docs/REFACTOR_PLAN.md` (superseded by ROADMAP.md)
- Migration status now tracked in ACTIVE_CONTEXT.md

---

## ISSUE-006: ROADMAP.md has uncommitted changes

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ **FIXED** (2026-02-05) |
| **Blast Radius** | LOW |
| **Root Module** | `docs/active/ROADMAP.md` |

### Fix Applied
- Kept ROADMAP.md as authoritative project roadmap
- Deleted redundant task files (NEXT_10_STEPS.md, etc.)

---

## ISSUE-007: Switch Nginx → Caddy for automatic HTTPS

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | **READY** (2026-02-07) — Set DOMAIN in .env to activate |
| **Blast Radius** | MEDIUM |
| **Root Module** | `docker/nginx.conf`, `docker/docker-compose.prod.yml` |

### Problem
- Current setup uses Nginx with manual HTTPS configuration required
- Certificate renewal requires certbot + cron setup
- More operational overhead for research deployment

### Proposed Fix
1. Create `docker/Caddyfile` (~15 lines)
2. Replace nginx container with caddy in `docker-compose.prod.yml`
3. Caddy auto-provisions Let's Encrypt certs + handles renewal

### Benefits
- Automatic HTTPS with zero configuration
- Built-in HTTP/2, HTTP/3 support
- Simpler config (15 lines vs 58)

### Risks
- Slightly larger image (~40MB vs ~25MB)
- Different config syntax (learning curve)

### Implementation Checklist
- [x] Create `docker/Caddyfile` (uses $DOMAIN env var)
- [x] Create `docker/docker-compose.caddy.yml` (separate from nginx prod)
- [ ] Set DOMAIN=x.desy.de in .env
- [ ] Test with staging domain
- [ ] Update DOCKER_RUNBOOK.md

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

