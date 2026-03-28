# Known Issues — Prioritized Backlog

**Last Updated**: 2026-03-28

> **Status**: 17 original issues FIXED. 5 new issues open (ISSUE-018 to ISSUE-022) from Alex's testing.

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

# Open Issues

## ISSUE-018: TANGO fails in Docker on Apple Silicon Macs

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | Open (workaround available) |
| **Blast Radius** | LOW (graceful degradation — everything else works) |
| **Root Module** | `docker/docker-compose.yml`, `backend/tango.py` |
| **Reported by** | Alex (2026-03-25) |

### Symptom
TANGO shows "Failed" for all entries when running PVL in Docker on an Apple Silicon Mac (M1/M2/M3/M4). S4PRED also fails for the same reason (PyTorch under x86 emulation). Both predictors are independent — neither depends on the other.

### Root Cause
Docker Desktop on Apple Silicon runs Linux containers via x86_64 emulation (Rosetta/QEMU). The `tango_linux_x86_64` binary and PyTorch CPU inference may not execute correctly under this emulation layer.

Additionally, `docker-compose.yml` had `TANGO_BINARY_PATH=/opt/tools/tango/bin/tango` (wrong — file doesn't exist). This fell through to platform-specific resolution which found `tango_linux_x86_64`, but the binary then failed to execute under emulation.

### Fix Applied (Partial)
- Fixed `TANGO_BINARY_PATH` in `docker-compose.yml` to use correct filename `tango_linux_x86_64`
- Long-term fix: Multi-arch Docker build (Phase E6) or native ARM TANGO binary

### Workaround
Set `USE_TANGO=0` and `USE_S4PRED=0` in `docker-compose.yml`. All other features work: FF-Helix%, biochem calculations (charge, hydrophobicity, muH), charts, ranking, exports. Both predictors work on native Linux (the actual deployment target).

### Verification
On a Linux server or x86 Mac: `USE_TANGO=1 USE_S4PRED=1 make docker-up` should show both providers as OK.

---

## ISSUE-019: "Analyze Dataset" button not clickable after loading example dataset

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | Open |
| **Blast Radius** | LOW |
| **Root Module** | `ui/src/pages/Upload.tsx` |
| **Reported by** | Alex (2026-03-25) |

### Symptom
User clicks "Load Example Dataset" on the Upload page. Data loads and preview appears, but the "Analyze Dataset" button stays disabled/not clickable.

### Analysis
- Button disabled condition: `!localFile || isAnalyzing` (line ~474)
- Example loader (lines 314-331) fetches CSV, creates File object, calls `handleLocalPreview(file)`
- `handleLocalPreview` calls `setLocalFile(file)` — but possible timing issue with async fetch + state update
- May also be a race condition between `setLocalFile` and the render cycle

### Affected Files
1. `ui/src/pages/Upload.tsx` — example loader flow + button disabled condition

### Success Criteria
- [ ] Load example dataset → "Analyze Dataset" button becomes clickable
- [ ] Analysis completes successfully with example data

---

## ISSUE-020: Numbers and invalid characters silently pass through sequence validation

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | Open |
| **Blast Radius** | MEDIUM |
| **Root Module** | `backend/auxiliary.py`, `ui/src/pages/QuickAnalyze.tsx` |
| **Reported by** | Alex (2026-03-25) |

### Symptom
User enters `XXXX11111` in Quick Analyze → gets analyzed as `AAAA11111`. Numbers pass through to the backend and appear in the corrected sequence. Similarly, `FOFJJJFFOOO` was accepted and processed (O→K, J→L substitutions applied, but the input should have been flagged).

### Root Cause
**Backend** (`auxiliary.py:get_corrected_sequence()`): Substitutes non-standard AAs (X→A, O→K, J→L, etc.) but does NOT validate or strip non-letter characters. Numbers, symbols, spaces all pass through silently.

**Frontend** (`Upload.tsx:isValidSeq()`): Has proper regex `^[A-Za-z]+$` that rejects numbers — but this validation is only used for the upload preview QC indicator, not as a hard block on QuickAnalyze submission.

### Fix (Proposed)
1. **Backend**: Add character stripping/validation in `get_corrected_sequence()`:
   ```python
   # Strip non-letter characters
   sequence = re.sub(r'[^A-Za-z]', '', sequence)
   if not sequence:
       return ""
   ```
2. **Frontend QuickAnalyze**: Add hard validation before submission — reject sequences with non-letter characters with clear error message: "Sequence must contain only amino acid letters (A-Z). Numbers and symbols are not allowed."

### Success Criteria
- [ ] `XXXX11111` → rejected with clear error (or stripped to `AAAA` with warning)
- [ ] `FOFJJJFFOOO` → accepted with substitution notice: "Non-standard amino acids corrected: O→K, J→L"
- [ ] Pure letter sequences continue to work normally

---

## ISSUE-021: Large file upload fails with "413 Request Entity Too Large"

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | Open |
| **Blast Radius** | HIGH — blocks any dataset > 1MB |
| **Root Module** | `docker/nginx.conf` |
| **Reported by** | Alex (2026-03-28) |

### Symptom
Uploading a UniProt TSV with ~6,000 entries (5MB file) returns:
```
413 Request Entity Too Large — nginx/1.29.7
```
The error is an HTML page from nginx, not a JSON error from the backend. The "Analyze Dataset" button shows a raw HTML error toast.

Also reported: a 3,000-entry dataset (376KB) — this may pass the nginx limit but could fail due to backend timeout or memory when running TANGO/S4PRED on 3K sequences.

### Root Cause
`docker/nginx.conf` has **no `client_max_body_size` directive**. Nginx defaults to **1MB**. Any file larger than 1MB is rejected before reaching the FastAPI backend.

### Fix
Add to `docker/nginx.conf` inside the `server` block:
```nginx
# Allow uploads up to 100MB (our stated limit is 50MB, add headroom)
client_max_body_size 100M;
```

### Additional Considerations
- The 50MB limit advertised in the UI should match the nginx config
- Large datasets (3K+ entries) will also need backend timeout adjustments — TANGO runs ~2-5 seconds per peptide, so 3K entries = ~2-4 hours. This is a separate issue addressed by B1 (async job queue).
- Frontend should show a clear progress indicator for large uploads and warn about expected processing time
- Consider: reject datasets > 500 entries when TANGO is enabled, or auto-disable TANGO for large batches

### Success Criteria
- [ ] 5MB file uploads without 413 error
- [ ] 50MB file uploads without 413 error
- [ ] Files > 100MB rejected with clear error message from backend (not nginx HTML)

---

## ISSUE-022: No example dataset on Quick Analyze page

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | Open |
| **Blast Radius** | LOW |
| **Root Module** | `ui/src/pages/QuickAnalyze.tsx` |
| **Reported by** | Alex (2026-03-28) |

### Symptom
Quick Analyze page has no "Try example" button. The Upload page has example datasets (Venom Peptides, Antimicrobial Peptides, etc.), but Quick Analyze requires the user to know a peptide sequence to type in.

### Proposed Fix
Add a "Try example" button below the sequence input that pre-fills with a well-known peptide sequence (e.g., Amyloid-beta 1-42: `DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVVIA`) and auto-triggers analysis.

### Success Criteria
- [ ] Quick Analyze has at least one example peptide button
- [ ] Clicking it fills the sequence field and optionally auto-runs analysis

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

