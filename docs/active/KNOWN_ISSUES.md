# Known Issues — Prioritized Backlog

**Last Updated**: 2026-04-26

> **Status**: 17 original issues FIXED. ISSUE-018 to ISSUE-024 historic. ISSUE-025 to ISSUE-029 open (Wave 0 + Wave A + Wave B from team feedback 2026-04-26).

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
| ISSUE-024 | **P1** | No notification on non-standard AA substitutions | `backend/auxiliary.py`, UI | MEDIUM | — | ✅ FIXED (verified 2026-06-07): backend `get_corrected_sequence_with_notes` populates `sequenceNotes` + `originalSequence`; UI surfaces in PeptideTable (per-row ⚠), PeptideViewer (warning banner with original-sequence reveal), QuickAnalyze (inline alert), and Results aggregate banner |
| ISSUE-025 | **P0** | Backend test failures: `test_trace_id.py` (2 tests) | `backend/tests/test_trace_id.py` | LOW | already exists | ✅ FIXED — 7/7 tests pass (verified 2026-05-19); doc was stale |
| ISSUE-026 | **P0** | Frontend type errors: 8 in stores (Zustand storage drift + Meta↔DatasetMetadata) | `ui/src/stores/datasetStore.ts`, `ui/src/stores/jobStore.ts` | LOW | tsc clean | ✅ FIXED — store errors gone; 2 unrelated Cowork V10-3 leftovers (UniProtQueryInput AnalysisProgress props + MetricDetail chart data narrowing) cleaned up 2026-05-19. `npx tsc --noEmit` clean. |
| ISSUE-027 | **P1** | `crypto.randomUUID is not a function` on Safari at `/quick` and `/database-search` (HTTP, older Safari) | `ui/src/components/UniProtQueryInput.tsx`, `ui/src/pages/Upload.tsx` | MEDIUM | jsdom test | 🟠 OPEN (Wave A) |
| ISSUE-028 | **P2** | TANGO profile tooltip MISSING in Quick Analyze (present elsewhere). T3 to verify all TANGO charts | `ui/src/pages/QuickAnalyze.tsx` and TANGO chart components | LOW | manual | 🟠 OPEN (Wave B) |
| ISSUE-029 | **P2** | Dark menu component shows in light mode (theme leak) | TBD via grep | LOW | manual | ✅ FIXED (2026-04-26) |
| ISSUE-030 | **P1** | Sentry session-replay quota burn (sample rate at 1.0) | `ui/src/main.tsx` | LOW | — | ✅ FIXED (2026-04-26, replay rate → 0, error replay kept at 1.0) |
| ISSUE-031 | **P2** | Stale Sentry errors: `HTTPException: No active job with this cancel token` (11/18 errors/month) | `backend/api/routes/jobs.py` | LOW | — | ✅ FIXED (commit 2ed386d 2026-04-03 — returns 200 ALREADY_COMPLETE; old VPS builds will stop firing after next deploy) |
| ISSUE-032 | **P0** | FF-SSW axiom violation: peptides display `FF-SSW=true` while `SSW=false` (P85089, P0C005). Root cause: dual-source desync — `sswPrediction` shipped TANGO-only column; `ffSswFlag` used TANGO ∪ S4PRED mask. | `backend/services/dataframe_utils.py:apply_ff_flags`, `backend/schemas/peptide.py`, `backend/services/normalize.py` | **HIGH** — affects scientific integrity of 4-class classification | `backend/tests/test_axiom_invariants.py` | ✅ FIXED (2026-05-19) |
| ISSUE-033 | **P1** | Perf regression — 12 peptides ≈ 1 min (Alex flag 2026-05-19). Root cause: Wave 2 §D added `vector_store.index_peptide` (ESM-2 8M CPU forward pass) inline-synchronous in the predict pipeline, adding 3-5s per peptide. | `backend/services/predict_service.py:330`, `backend/services/vector_store.py` | **MEDIUM** — degrades UX, makes paper-push demos slow | `backend/tests/test_vector_store.py::test_submit_index_background_returns_immediately_and_indexes` | ✅ FIXED (2026-05-19) — moved to `submit_index_background` daemon-thread executor; predict no longer waits on embedding |

---

# P0 — Breaks Core Workflow

## ISSUE-032: FF-SSW axiom violation — `ffSswFlag=1` with `sswPrediction=-1`

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | ✅ **FIXED** (2026-05-19) |
| **Surfaced by** | Peleg (Slack 2026-05-19): "How is it possible that the peptide is predicted to be FF-SSW, but not predicted to be SSW?" |
| **Reproducible peptides** | P85089 (len 14), P0C005 (len 10) |
| **Mirror axiom** | `ffHelixFlag=1 ⇒ s4predHelixPrediction=1` — enforced by the same boundary check |

### Axiom (now a contract)

Per ADR-003 + Peleg P27 canonical definition:
- **SSW** = TANGO **or** S4PRED predicts a structure-switch (canonical OR, never AND)
- **FF-SSW** = SSW **AND** hydrophobicity ≥ threshold
- Therefore: `ffSswFlag == 1 ⇒ sswPrediction == 1`
- Mirror: `ffHelixFlag == 1 ⇒ s4predHelixPrediction == 1`

### Root cause

Dual-source desync.

- `sswPrediction` was aliased to the raw `"SSW prediction"` column — **TANGO-only**.
- `ffSswFlag` was computed in `apply_ff_flags` from `ssw_pos_mask = (tango == 1) | (s4pred == 1)` — **TANGO ∪ S4PRED**.
- Whenever TANGO said "no SSW" but S4PRED said "SSW", and hydrophobicity met the cutoff, the API emitted `sswPrediction=-1` alongside `ffSswFlag=1`. Axiom violated.

### Fix

1. `backend/services/dataframe_utils.py:apply_ff_flags` now writes a new column `"SSW prediction (unified)"` from the **same** mask that drives FF-SSW. The raw TANGO column is preserved for audit and for provider-status detection.
2. `backend/schemas/peptide.py` — `ssw_prediction` uses `AliasChoices("SSW prediction (unified)", "SSW prediction")`, preferring the unified column and falling back to TANGO-only for paths that never ran `apply_ff_flags`.
3. `backend/services/normalize.py` — new `_enforce_ff_axioms()` runs at the serialization boundary: if a row violates the axiom (upstream bug), it logs `ff_ssw_axiom_violation` / `ff_helix_axiom_violation` and clamps the FF flag to `-1`. The API contract is honored even if upstream regresses.
4. The fallback row constructors at `normalize.py:619` and `:790` prefer the unified column.

### Regression test

`backend/tests/test_axiom_invariants.py` — fails on pre-fix code, passes after. Covers:
- P85089/P0C005 scenario (S4PRED-only SSW + hydro above threshold)
- TANGO-only SSW
- Both providers negative
- SSW positive but hydro below threshold (axiom holds: SSW=1, FF-SSW=-1)
- Batch with mixed provider signals — axiom per row
- Defense-layer (`_enforce_ff_axioms`) zeros out violating FF flags

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
| **Status** | **FIXED** (2026-04-02) |
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

### Fix Applied
- Removed broken "Load Example Dataset" button from UploadDropzone (was loading non-existent file)
- Example CSV buttons in Upload.tsx call `handleLocalPreview(file)` which sets `localFile` (enables button) and advances to step 1 via async callbacks
- Gold standard XLSX button (2916 peptides) also works via same flow
- Button at `disabled={!localFile || isAnalyzing}` is correctly enabled after any example load

### Success Criteria
- [x] Load example dataset → "Analyze Dataset" button becomes clickable
- [x] Analysis completes successfully with example data

---

## ISSUE-020: Numbers and invalid characters silently pass through sequence validation

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | **FIXED** (2026-04-02) |
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

### Fix Applied
- **Frontend** (`QuickAnalyze.tsx:177`): Hard validation `!/^[A-Za-z]+$/.test(trimmed)` rejects non-letter input with clear error: "Sequence must contain only amino acid letters (A-Z). Remove numbers, spaces, or symbols."
- **Backend** (`auxiliary.py:433`): `re.sub(r"[^A-Za-z-]", "", sequence)` strips non-letter characters before substitution. Numbers, symbols, spaces all removed.
- **Upload page** (`Upload.tsx:isValidSeq()`): Already had `^[A-Za-z]+$` regex for QC indicator on upload preview.

### Success Criteria
- [x] `XXXX11111` → rejected with clear error in QuickAnalyze; stripped to `AAAA` in backend
- [x] `FOFJJJFFOOO` → accepted, O→K, J→L substitutions applied (notification via ISSUE-024)
- [x] Pure letter sequences continue to work normally

---

## ISSUE-021: Large file upload fails with "413 Request Entity Too Large"

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | **FIXED** (2026-03-25, commit ae58cf7) |
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

## ISSUE-023: Results page crashes with "React.Children.only" on VPS

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | **FIXED** (2026-03-29) |
| **Blast Radius** | HIGH — Results page completely unusable |
| **Root Module** | `ui/src/components/Legend.tsx` |
| **Reported by** | Alex (via VPS at 94.130.178.182:3000) |

### Symptom
After clicking "Analyze Dataset", navigating to `/results` crashes with:
```
React.Children.only expected to receive a single React element child.
```

### Root Cause
`Legend.tsx` line 102 used `<DialogContent asChild>` to wrap a `<motion.div>` for animation. The shadcn/ui `DialogContent` wrapper adds a close button (`<DialogPrimitive.Close>`) as a second child inside `DialogPrimitive.Content`. When `asChild` is passed, Radix uses `Slot` → `React.Children.only()`, which crashes because it receives 2 children (the motion.div + the close button).

### Fix
Removed `asChild` and the `<motion.div>` wrapper from `DialogContent`. The Dialog already has CSS enter/exit animations via Tailwind's `animate-in`/`animate-out`.

---

## ISSUE-024: No user notification when non-standard amino acids are substituted

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | Open |
| **Blast Radius** | MEDIUM — affects scientific transparency |
| **Root Module** | `backend/auxiliary.py`, `backend/services/predict_service.py`, `ui/src/pages/QuickAnalyze.tsx`, `ui/src/components/PeptideTable.tsx` |
| **Reported by** | Said (2026-04-01) |

### Symptom
When a user submits a sequence containing non-standard amino acids (X, Z, B, U, O, J), the pipeline silently substitutes them (X→A, Z→E, B→D, U→C, O→K, J→L) and also strips non-letter characters and terminal modifications (e.g., `-NH2`). The user sees the corrected sequence in results with no indication that modifications were made.

### Root Cause
`auxiliary.py:get_corrected_sequence()` performs substitutions correctly, but:
1. The original sequence is not preserved in the API response
2. No substitution details are returned (which letters were changed)
3. Frontend has no mechanism to display substitution warnings

### Fix (Proposed)

**Backend** (`predict_service.py` and `upload_service.py`):
- Compare original sequence vs corrected sequence
- If different, add `sequenceNotes` field to the response row:
  ```json
  "sequenceNotes": "Non-standard residues substituted: X→A (pos 3, 7), O→K (pos 15). Terminal '-NH2' removed."
  ```
- Also add `originalSequence` field (the raw input before correction)

**Frontend** (QuickAnalyze + PeptideViewer + PeptideTable):
- When `sequenceNotes` is present, show a subtle amber info banner:
  "Some non-standard amino acids were substituted for compatibility with prediction tools. [Show details]"
- On "Show details": list each substitution with position

### Success Criteria
- [ ] API response includes `sequenceNotes` when substitutions occur
- [ ] API response includes `originalSequence` when different from `sequence`
- [ ] QuickAnalyze shows substitution notice
- [ ] PeptideTable shows an indicator icon on rows with substitutions
- [ ] No notification when sequence is already clean (standard AAs only)

### Note from Peleg
These substitutions are intentional — chosen to get results most likely to predict fibril formation correctly. The user should know they happened but should NOT be blocked from analysis.

---

## ISSUE-025: Backend test failures — `test_trace_id.py`

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | Open (Wave 0) |
| **Blast Radius** | LOW |
| **Root Module** | `backend/tests/test_trace_id.py` |
| **Owner** | T2 |

### Symptom
```
FAILED tests/test_trace_id.py::test_trace_id_in_meta_upload_csv
  - aff00e9e-f90f-401b-973d-b0958dbced41
  + a34f52bd-44dc-48e0-8249-2dd9af7bcf87
FAILED tests/test_trace_id.py::test_trace_id_in_meta_predict
  - e3ff818a-272a-4283-9d0b-1d191fa27e48
  + 5955f93e-0ebd-4bcd-84cc-105b464c6b27
```
Two UUIDs being compared for equality — but the response trace_id is independently generated, not predicted by the test.

### Reproduction
```bash
make test 2>&1 | grep -A2 "test_trace_id"
```

### Analysis
- **Expected**: `meta.trace_id` matches the trace_id propagated from the request (response header `x-trace-id` or request context)
- **Actual**: Test generates one UUID and compares against an independently-generated server UUID → never equal
- **Cause**: Either (a) the test should set `x-trace-id` request header and assert echo, OR (b) trace_id propagation through the meta object regressed, OR (c) the test is asserting a stale snapshot

### Fix path (T2 to investigate)
1. Read `backend/tests/test_trace_id.py` end-to-end
2. Read `backend/api/main.py` (or middleware) to see how `trace_id` is generated and where it's stored on the response
3. Read `backend/schemas/api_models.py` `Meta` model — confirm `trace_id` field
4. Three possible fixes:
   - If trace_id should be echoed from header: test must send `x-trace-id` header with a known UUID
   - If trace_id should match between meta and response header: assert equality between the two, not against a hard-coded value
   - If trace_id is purely server-generated: assert UUID format only (regex), drop equality check
5. **DO NOT modify `api_models.py`** (protected file) — only touch the test or the middleware

### Success Criteria
- [ ] `make test` exits 0
- [ ] All 409 tests pass (407 + the 2 fixed)
- [ ] No new tests added unless trace_id propagation logic was actually broken
- [ ] If middleware logic changed, add 1 test asserting trace_id is propagated correctly

---

## ISSUE-026: Frontend type errors — Zustand storage drift + Meta↔DatasetMetadata

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Status** | Open (Wave 0) |
| **Blast Radius** | LOW (types only, runtime works) |
| **Root Module** | `ui/src/stores/datasetStore.ts`, `ui/src/stores/jobStore.ts` |
| **Owner** | T3 |

### Symptom
```
src/stores/datasetStore.ts(263,58): error TS2367: comparison number vs string
src/stores/datasetStore.ts(343,62): error TS2367: comparison number vs string
src/stores/datasetStore.ts(397,61): error TS2367: comparison number vs string
src/stores/datasetStore.ts(535,9):  error TS2322: storage adapter returns string, expected StorageValue<any>
src/stores/datasetStore.ts(544,40): error TS2345: StorageValue<any> not assignable to string
src/stores/datasetStore.ts(549,43): error TS2345: StorageValue<any> not assignable to string
src/stores/jobStore.ts(191,60):     error TS2345: Meta thresholds (Record<string,any>) ↔ DatasetMetadata thresholds ({muHCutoff,hydroCutoff})
```

### Reproduction
```bash
cd ui && npx tsc --noEmit
```

### Analysis
**Errors 263/343/397** — `number === string` comparisons. Likely an ID field changed type. Open lines and read context.

**Errors 535/544/549** — Zustand `persist` middleware API change. Custom storage adapter is returning `string` but Zustand now expects `StorageValue<T>` (a structured object). Either:
- Update adapter to return `{ state, version }` structure, OR
- Use Zustand's `createJSONStorage` helper which handles serialization

**Error 191** — Two `thresholds` types in different files. `Meta.thresholds: Record<string,any>` (loose, server-generic) vs `DatasetMetadata.thresholds: { muHCutoff, hydroCutoff }` (strict, frontend-specific). When converting `Meta → DatasetMetadata`, need explicit destructure with default fallbacks.

### Fix path (T3)
1. **263/343/397**: open each line, identify the variable types, fix at the source (don't `String()`-cast unless the underlying types are genuinely both valid forms)
2. **535/544/549**: refactor the persist storage adapter — wrap with `createJSONStorage(() => localStorage)` or update return shapes. Reference: https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
3. **191**: in `jobStore.ts:191`, when building `DatasetMetadata` from `Meta`, do:
   ```ts
   const thresholds = {
     muHCutoff: Number(meta.thresholds?.muHCutoff ?? DEFAULT_MUH),
     hydroCutoff: Number(meta.thresholds?.hydroCutoff ?? DEFAULT_HYDRO),
   };
   ```

### Success Criteria
- [ ] `cd ui && npx tsc --noEmit` exits 0
- [ ] No new `any` casts (use real types)
- [ ] Persist storage still serializes/deserializes correctly (test by reloading the app)

---

## ISSUE-027: `crypto.randomUUID is not a function` on Safari (`/quick` + `/database-search`)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | Open (Wave A) |
| **Blast Radius** | MEDIUM — Quick Analyze + DatabaseSearch crash on HTTP / older Safari (Said reproduced on Safari 2026-04-07 at `/quick`) |
| **Root Module** | `ui/src/components/UniProtQueryInput.tsx:165` and `ui/src/pages/Upload.tsx:308` (the only call sites) |
| **Owner** | T3 |
| **Reported by** | Sentry + Said Safari repro (2026-04-07, 2026-04-26) |

### Symptom
```
TypeError: crypto.randomUUID is not a function. (In 'crypto.randomUUID()', 'crypto.randomUUID' is undefined)
  at None (/assets/DatabaseSearch-B4xKaaFo.js:21:3924)
```

### Root Cause
`window.crypto.randomUUID()` requires a **secure context** (HTTPS or localhost). The VPS is served over `http://94.130.178.182:3000`. On non-secure contexts, `crypto.randomUUID` is `undefined`. Also unavailable in Safari < 15.4.

### Fix
Create `ui/src/lib/uuid.ts`:
```ts
export function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

Then:
```bash
grep -rn "crypto\.randomUUID" ui/src
```
Replace every call with `uuid()` from `@/lib/uuid`.

### Success Criteria
- [ ] No `crypto.randomUUID()` calls remain in `ui/src/`
- [ ] DatabaseSearch loads on HTTP without console error
- [ ] Add a vitest unit test that asserts `uuid()` returns a v4-shaped string when crypto is unavailable

---

## ISSUE-028: TANGO profile tooltip MISSING in Quick Analyze

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | Open (Wave B) |
| **Blast Radius** | LOW (UX) |
| **Root Module** | `ui/src/pages/QuickAnalyze.tsx` + the TANGO chart component(s) it embeds |
| **Owner** | T3 |
| **Reported by** | User feedback (Gmail), 2026-04-26 — clarified by Said: "tango tooltip is missing in quick analyze / other ones please check" |

### Symptom
Quick Analyze TANGO profile chart does NOT show the rich tooltip (residue number + amino acid letter) that the other TANGO charts show (e.g., PeptideDetail). User feedback: when hovering over a peak, they want to know "Residue 5 — V" but only see the bar value.

### Fix path (T3)
1. Open Quick Analyze in browser, hover over the TANGO chart, confirm tooltip is missing/poor
2. Find the TANGO chart in QuickAnalyze: `grep -n "TangoProfile\|Tango\|tango" ui/src/pages/QuickAnalyze.tsx`
3. Find the rich tooltip used on other pages (PeptideDetail, Results) — it likely has a `customTooltip` formatter on the Recharts chart
4. Port that formatter to the QuickAnalyze chart instance
5. While there: verify ALL TANGO chart instances across the app have the same tooltip (Quick Analyze, PeptideDetail, Results, Compare). Standardize to one shared `<TangoTooltip>` component if there's drift

### Success Criteria
- [ ] Quick Analyze TANGO chart shows `Residue N — X` tooltip on hover
- [ ] All TANGO charts app-wide use the same tooltip component
- [ ] No regression in other charts

---

## ISSUE-029: Dark menu in light mode (theme leak)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ FIXED (2026-04-26 — Said confirmed already resolved) |
| **Blast Radius** | LOW (visual) |
| **Root Module** | TBD — T3 to identify |
| **Owner** | T3 |
| **Reported by** | Said, 2026-04-26 |

### Symptom
> "the dark menu which is still showing in a bright mode still"

A menu component renders with dark colors regardless of the active theme.

### Fix path (T3)
1. Ask Said which menu (sidebar? top nav? dropdown? mobile menu?)
2. Switch to light mode locally, find the offending element
3. `grep -rn "bg-zinc-900\|bg-slate-900\|bg-gray-900\|bg-black\|bg-neutral-900" ui/src/components` to find hardcoded dark backgrounds
4. Replace with theme tokens: `bg-card`, `bg-popover`, `bg-background`, etc.
5. Test in both light and dark modes

### Success Criteria
- [x] Menu uses theme tokens, not hardcoded colors
- [x] Visually correct in both light and dark mode
- [x] No regression in dark mode appearance

---

## ISSUE-030: Sentry session-replay quota burn (sample rate at 1.0)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Status** | ✅ FIXED (2026-04-26) |
| **Blast Radius** | LOW (operational, no user impact) |
| **Root Module** | `ui/src/main.tsx` |
| **Owner** | T1 |
| **Reported by** | Sentry alert, 2026-04-26 (relayed by Cowork) |

### Symptom
Sentry quota alert. Session replay was recording 100% of sessions (`replaysSessionSampleRate: 1.0`). With 3 active VPS users, the free-tier replay quota is hit fast.

### Fix
`ui/src/main.tsx`: change `replaysSessionSampleRate: 1.0` → `0`. Keep `replaysOnErrorSampleRate: 1.0` so we still get full replays of sessions that hit errors. Tracks/profile rates unchanged (they're cheaper).

### Success Criteria
- [x] Sentry replay quota stops growing during normal traffic
- [x] Replays still captured when errors occur
- [x] Performance/trace coverage unchanged

---

## ISSUE-031: Stale Sentry errors — "No active job with this cancel token"

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Status** | ✅ FIXED (commit 2ed386d, 2026-04-03) |
| **Blast Radius** | LOW (operational noise only) |
| **Root Module** | `backend/api/routes/jobs.py` |
| **Reported by** | Sentry alert, 2026-04-26 |

### Symptom
11 of 18 monthly Sentry errors are `HTTPException: No active job with this cancel token`. This fires when `sendBeacon` triggers `/api/jobs/cancel-sync/{token}` after the job has already completed and the token was cleaned up.

### Resolution
**Already fixed in commit 2ed386d** (2026-04-03): the endpoint now returns `200 {"status": "ALREADY_COMPLETE"}` instead of raising `HTTPException`. Verified via `git show 2ed386d` — that commit changed `backend/api/routes/jobs.py` to return 200 silently.

The 11 captured Sentry errors are stale — produced by old VPS builds before commit 2ed386d deployed. They will stop accumulating once VPS pulls the latest image (currently running 1cc07ed which post-dates the fix).

No additional code change required. If errors continue accumulating after the next VPS deploy, investigate whether a stale build is somehow still serving traffic.

### Success Criteria
- [x] Code path returns 200, not raises
- [ ] (Operational) Verify error count stops growing on Sentry after next VPS deploy

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

