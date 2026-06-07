# UniProt Timeout Investigation

**Reported by**: Said (2026-05-02)
**Investigated by**: T2 (backend)
**Branch**: `planning/wave-0-prep` — diagnosis only, no fix yet, no commits.
**Status**: Reproduced. Root cause identified. Fix proposals at the bottom.

---

## TL;DR

`/api/uniprot/execute` with `query="amyloid"`, `size=5`, `run_tango=true`, `run_s4pred=true` takes **615 seconds** end-to-end on a warm process — 30× the user's 30 s expectation, 3× the user-observed 3 min timeout. Of that, **S4PRED alone is 615 s for the same five sequences**.

Why: the UniProt search keyword `amyloid` returns *full proteins*, not peptides. The five top hits sum to 1,179 residues, dominated by **P05067 (APP, 770 aa)**. S4PRED runs a 5-model BiLSTM ensemble on CPU with no thread cap and no length cap; on a 770-aa protein each forward pass is multi-second, ×5 ensemble members, ×5 sequences, plus contention from a second concurrent request running in parallel = ~10 minutes.

The user's mental model is "5 short peptides, each ~20 aa". The pipeline is being asked to do something very different and is silently obliging.

This is **not** a queue, Celery, httpx-pool, `_sync_cancel_events`, ContextVar, or "hung" issue. It's: S4PRED is genuinely slow on protein-length sequences, the route doesn't cancel on client disconnect, and the schema lets `max_results` be silently dropped.

---

## Reproduction

Two backend processes were already running on port 8000 (`server:app --reload`, pids 40260+40272). Investigation server started on port 8765 with stage logs captured to `/tmp/pvl-uniprot-investigation.log`.

```bash
USE_TANGO=1 USE_S4PRED=1 CELERY_ENABLED=0 SENTRY_DSN= LOG_LEVEL=INFO \
  .venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8765 \
  > /tmp/pvl-uniprot-investigation.log 2>&1 &
```

Three curl variants, each capped at 200 s:

| # | Payload | Wall | Result | Rows processed |
|---|---|---|---|---|
| **A** | `{"query":"amyloid","max_results":5}` | **13 s** | `200 OK` | **500** rows |
| **B** | `{"query":"amyloid","size":5,"run_tango":true,"run_s4pred":true}` | 200 s | `curl 28 timeout` | server kept running and finished at **615 s** |
| **C** | same as B (warm process, run-back-to-back) | 200 s | `curl 28 timeout` | still running when curl gave up |

**Variant A is the literal user payload.** `max_results` is not a schema field. Pydantic v2 silently drops unknown fields → `size` defaults to **500**, `run_tango`/`run_s4pred` default to **False**, so 500 protein rows are fetched and only biochem runs. Total 13 s — fast, but not what the user thought they asked for.

**Variants B and C** are what the frontend actually sends (size=5 + both providers). This is the failing case.

---

## Stage timeline — Variant B (the failing case)

Trace `9acdb89e-…`:

| Wallclock | Δ | Stage | Note |
|---|---|---|---|
| 20:08:27.496 | — | `request_start` | |
| 20:08:27.509 | +13 ms | `uniprot_request_params` | `size=5, run_tango=True, run_s4pred=True` |
| 20:08:28.107 | +598 ms | `uniprot_fetch_success` | 5 rows fetched from UniProt |
| 20:08:28.117 | +10 ms | `FF-Helix` | 6 ms |
| 20:08:28.153 | +36 ms | `provider_cache_get_error` | DuckDB lock held by other uvicorn (PID 40272) |
| 20:08:28.159 | +6 ms | `tango_run_start` | |
| 20:08:58.139 | **+29.98 s** | `tango_simple_complete` | 5 sequences |
| 20:08:58.877 | +738 ms | `uniprot_stage_time TANGO: 30,719 ms` | |
| 20:09:21.305 | **+22.43 s** | `s4pred_run_start` | gap = S4PRED model cold-load (5 weight files via `torch.load`) |
| **20:19:13.727** | **+9 m 52 s** | `s4pred_run_complete` | 5/5 parsed |
| 20:19:13.946 | +219 ms | `uniprot_stage_time S4PRED: 615,068 ms` | |
| 20:19:16.777 | +2.83 s | `Biochem+flags: 2,826 ms` | |
| 20:19:18.057 | +1.28 s | `Normalize: 1,275 ms` | |
| 20:19:18.442 | +385 ms | `request_end 200` | total **~10 m 51 s** |

Curl gave up at 200 s but the server didn't notice — request kept running for another 8 minutes.

### Sequence-length distribution from UniProt (the actual workload)

```
Entry    Length
P0DJI8     122
P0DJI9     122
P05067     770   ← APP, dominant cost
P10997      89
P29216      76
sum       1179
```

S4PRED on CPU is roughly linear-to-quadratic in sequence length per ensemble pass, and the ensemble is 5 forward passes per sequence. P05067 alone is the bulk of S4PRED's 615 s.

---

## What's actually happening, ranked by contribution

### 1. S4PRED is fundamentally slow on protein-length sequences (≈ 95% of the latency)

`backend/tools/s4pred/model.py:30` — `S4PREDPredictor.__init__` accepts an optional `threads` arg; `backend/s4pred.py:472` calls `get_predictor(weights_path)` with **no threads arg** → `torch.set_num_threads()` is never called → torch uses *all* logical cores by default. This is ironic: it means a single S4PRED call already saturates the box, so concurrent requests fight tooth-and-nail for the same cores. With two uvicorn processes running and request B + C concurrent, four S4PRED forward passes try to use all cores at once → 4× slowdown vs single-call baseline.

Even with no contention, S4PRED on a 770-aa protein × 5-model ensemble on CPU is plausibly 60–120 s. With contention, 600 s.

### 2. The route lacks client-disconnect detection (10× user-perceived blast radius)

`backend/api/routes/upload.py:138-149` has an `asyncio.create_task(_detect_disconnect())` loop that polls `request.is_disconnected()` and flips `cancel_event` so the worker thread can bail.

`backend/api/routes/uniprot.py:54-84` has *no equivalent*. When the curl client (or the browser/frontend) gives up at its own timeout, the `cancel_event` is never set, and `_run_analysis_pipeline` keeps grinding through TANGO and S4PRED for the full natural duration — even though no one is listening. From the user's seat: "I cancelled at 3 minutes and the next request was still slow." (Server is still finishing the previous one and CPU-saturating.)

### 3. S4PRED model cold-load is a 22-second blocker on first call per process

The 22 s gap from `tango_stage_time` end (20:08:58) → `s4pred_run_start` (20:09:21) is `get_predictor()` running `torch.load` on five `.pt` weight files (`backend/tools/s4pred/model.py:53-69`). Every fresh uvicorn worker eats this on its first request. The singleton (`_predictor`) is per-process, so reload-on-code-change throws it away.

### 4. `max_results` is silently dropped (root cause of variant A confusion)

`backend/schemas/uniprot_query.py:36` declares `UniProtQueryExecuteRequest(BaseModel)` without `model_config = ConfigDict(extra="forbid")`. Pydantic v2 default is `extra="ignore"`. The user's literal curl `'{"query":"amyloid","max_results":5}'` *thinks* it asked for 5; the server saw `size=500, run_tango=False, run_s4pred=False` and politely processed 500 rows of biochem-only in 13 s. The user's mental model and the server's behaviour have been quietly diverging.

### 5. DuckDB provider-cache contention (low impact, but loud in logs)

`backend/services/provider_cache.py` opens the cache file with default DuckDB locking. With two uvicorn processes running locally, the second one always loses the lock and logs `provider_cache_get_error` / `provider_cache_set_error`. Each error costs ~30–500 ms of retry-and-fallback. Net effect: small additive slowdown plus log spam. **Not** the cause of the 615 s, but masks the signal in the logs.

### 6. Default ThreadPoolExecutor + torch all-cores = thrashing

`backend/services/uniprot_execute_service.py:1002` does:

```python
analysis_task = asyncio.get_event_loop().run_in_executor(
    None, lambda: _run_analysis_pipeline(...)
)
```

Default `None` executor = `ThreadPoolExecutor(max_workers=min(32, os.cpu_count() + 4))`. On an M-series Mac with 8–10 cores, that's ~12 workers. Each worker can spawn a torch-saturating S4PRED. Concurrent UniProt requests stack and compete on the same cores. There's no provider-level concurrency cap.

---

## What was *checked and ruled out* per the brief

| Hypothesis | Verdict | Evidence |
|---|---|---|
| `subprocess.run` TANGO blocking the event loop | ❌ ruled out | TANGO runs inside `run_in_executor`; logs show `request_start`/`request_end` for other endpoints flow during TANGO. |
| Celery worker not picking up the job | ❌ N/A | `CELERY_ENABLED=0` in `.env`; `/api/uniprot/execute` does not use Celery at all. |
| httpx connection-pool exhaustion | ❌ ruled out | UniProt fetch is `async with httpx.AsyncClient(...)` per request, not a shared pool. Curl→server is direct. |
| Stale `_sync_cancel_events` registry blocking new tokens | ❌ ruled out | Cleaned in `finally:` block at `backend/api/routes/uniprot.py:82-84`. No leak observed. |
| Job-status polling stuck | ❌ N/A | UniProt path is sync, no job polling. The user's "queued" wording probably refers to a frontend in-flight badge. |
| S4PRED cold-load (model load) | ✅ contributes | First-call 22 s gap. Subsequent calls in same process are warm. |
| S4PRED slow on long sequences | ✅ **dominant** | 615 s for 5 sequences, dominated by 770-aa APP. |
| Concurrent-request CPU contention | ✅ contributes | Two uvicorn processes + back-to-back curl variants → torch saturates and contends. |
| Schema silently dropping `max_results` | ✅ user-confusion contributor | Variant A processed 500 rows when the user thought 5. |
| Route lacks disconnect detection | ✅ amplifies blast radius | Request keeps running after curl/UI gives up. |

---

## Proposed fixes (DO NOT implement yet — flagged for T1 + Wave decisions)

Listed in order of impact / minimum-diff. **All require T1 sign-off** because they touch the protected route surface or change provider behaviour.

### A. Cap S4PRED-eligible sequence length (smallest fix, highest impact)

PVL is a *peptide* tool. S4PRED was trained on residues that fit short peptides. The current pipeline silently runs S4PRED on 770-aa proteins because the UniProt fetch returns full proteins. Per `backend/config.py:194`, `PEPTIDE_LENGTH_WARN_MAX = 100` already exists as advisory.

Proposal: in `run_s4pred_processing`, skip any sequence with `len > PEPTIDE_LENGTH_WARN_MAX` and record `s4pred_skipped_long` per row. The skip should be visible in `meta.providerStatus` so the UI can show "S4PRED skipped: sequence longer than 100 aa". TANGO has its own scaling, decide separately.

This single change drops the 615 s case to ≈ 10–30 s for the same query.

### B. Add disconnect detection to `/api/uniprot/execute` (mirror upload.py)

Copy the `_detect_disconnect()` task pattern from `backend/api/routes/upload.py:138-149` into `backend/api/routes/uniprot.py`. When the client gives up, the worker thread sees `cancel_event.is_set()` between stages and aborts. Independent of (A) — fixes the "the server kept running for 8 minutes after I cancelled" failure mode.

### C. Pin S4PRED to a single torch thread (1-line config)

`backend/s4pred.py:472` should call `get_predictor(weights_path, threads=1)` (or read from a new `S4PRED_TORCH_THREADS` setting). Combined with a process-level `asyncio.Semaphore(1)` around `run_s4pred_processing`, this prevents two S4PRED jobs from saturating the same cores. Pairs well with (A); without (A) it just makes the 600 s case become a sequential 600 s.

### D. Pre-warm S4PRED model at startup

Move `get_predictor(...)` into the FastAPI `@app.on_event("startup")` so the 22 s cold-load happens once at boot, not on the user's first request. Cheap; high UX value if (A) ships first.

### E. Move long-running UniProt analyses to Celery + job polling

If T1 wants to keep S4PRED running on full proteins (or wants 10,000-row UniProt queries), the right architecture is the same as `/api/jobs/upload`: dispatch to a Celery worker, return `jobId` immediately, frontend polls. This is a Wave-level decision, not a P0 patch.

### F. Make `extra="forbid"` on the request schema (defensive)

So `max_results` produces a 422 instead of being silently ignored. Catches user misunderstandings at the door. One-line addition to `UniProtQueryExecuteRequest`.

---

## Files referenced

| Path | Lines | Why it matters |
|---|---|---|
| `backend/api/routes/uniprot.py` | 54–84 | No disconnect detection, route entry. |
| `backend/api/routes/upload.py` | 138–149 | Reference pattern for disconnect detection. |
| `backend/services/uniprot_execute_service.py` | 387–580, 884–1081 | Pipeline + dispatch. |
| `backend/services/upload_service.py` | 491–620 | `run_s4pred_processing` — common to UniProt + upload. |
| `backend/s4pred.py` | 435–525, 614–694 | Sequence-by-sequence S4PRED loop, no length cap. |
| `backend/tools/s4pred/model.py` | 23–70, 158–177 | `S4PREDPredictor` ensemble, `get_predictor` singleton. |
| `backend/tango.py` | 460–560, 1585–1742 | TANGO subprocess + SSW classification. |
| `backend/services/provider_cache.py` | (whole) | DuckDB lock contention on dual-uvicorn dev setups. |
| `backend/schemas/uniprot_query.py` | 36–70 | `extra="ignore"` lets `max_results` slip through. |
| `backend/config.py` | 192–203 | `PEPTIDE_LENGTH_WARN_MAX = 100` — already exists, currently advisory only. |

---

## Artefacts

- Reproduction script: `/tmp/pvl-uniprot-time.sh`
- Stage-time log (Variants A + B + C interleaved): `/tmp/pvl-uniprot-investigation.log`
- Curl summary: `/tmp/pvl-uniprot-curl.log`
- Variant A response (500 rows of biochem-only): `/tmp/varA.json`
- Variants B/C: empty (curl timed out before server completed)

---

## Resolution — Wave B (2026-05-03)

Two of the six fix proposals (A and F) shipped in Wave B. The rest (B, C, D, E) remain queued behind T1's call.

### What changed

| Fix | Status | Where |
|---|---|---|
| **A.** Cap S4PRED at `S4PRED_MAX_LENGTH=100` | ✅ shipped | `backend/config.py` (new setting); `backend/s4pred.py` (skip-and-warn loop) |
| **F.** `extra="forbid"` on every request schema | ✅ shipped | `backend/schemas/feedback.py`, `backend/schemas/uniprot_query.py` |
| Bonus: AliasChoices for `max_results` / camelCase variants | ✅ shipped | `backend/schemas/uniprot_query.py` (`UniProtQueryExecuteRequest`) |
| **B.** Disconnect detection on `/api/uniprot/execute` | ⏳ deferred | T1 sign-off |
| **C.** `torch.set_num_threads(1)` + provider semaphore | ⏳ deferred | T1 sign-off |
| **D.** Pre-warm S4PRED at startup | ⏳ deferred | T1 sign-off |
| **E.** Celery + jobId polling for long queries | ⏳ deferred | Wave decision |

### Effect on the silent contract bug

Before Wave B, the user's literal curl payload `{"query":"amyloid","max_results":5}` was accepted with HTTP 200 because Pydantic v2's default is `extra="ignore"` — `max_results` was silently dropped, `size` defaulted to 500, and the server processed 500 rows of biochem-only.

After Wave B, the same payload is **also** accepted with HTTP 200, but now `max_results` is a recognised alias for `size` via `AliasChoices`, so the request actually queries 5 rows. Anyone sending an *unknown* field (e.g. `max_resultz=5`) gets a clean HTTP 422 naming the offending field instead of a quiet success.

### Effect on the S4PRED hang

Sequences longer than `settings.S4PRED_MAX_LENGTH` (default 100 aa) are skipped at the top of `run_s4pred_sequences`. The skip is recorded as `stats["skipped_long"]` and emits a `logger.warning(... > S4PRED_MAX_LENGTH=...)` line. Concretely, for the original failing case (`amyloid`, size=5):

| Sequence | Length | Behaviour after Wave B |
|---|---|---|
| P0DJI8 | 122 aa | **skipped** (122 > 100) |
| P0DJI9 | 122 aa | **skipped** (122 > 100) |
| P05067 (APP) | 770 aa | **skipped** (770 > 100) — the dominant cost |
| P10997 | 89 aa | runs normally |
| P29216 | 76 aa | runs normally |

Expected new runtime: TANGO ~30 s (TANGO is unchanged; remaining proposals B/C still relevant) + S4PRED ~5 s (only 2 short sequences) + biochem/normalize ~3 s ≈ **~40 s end-to-end**, down from 615 s. Out of a curl 200 s budget, comfortably within reach.

### How to verify the silent contract bug is now loud

```bash
# OLD silent-success (returned 200, processed 500 rows): now still 200, but routes to size=5
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/uniprot/execute \
  -H 'Content-Type: application/json' \
  -d '{"query":"amyloid","max_results":5}'
# → 200 (max_results is now an alias)

# Typo / removed field: now LOUD 422 instead of silent success
curl -s -X POST http://localhost:8000/api/uniprot/execute \
  -H 'Content-Type: application/json' \
  -d '{"query":"amyloid","run_psipred":false}'
# → 422 with detail naming `run_psipred`
```

Or run the regression suite:

```bash
cd backend
.venv/bin/python -m pytest tests/test_api_contract_strictness.py -v
```

### Test count delta

`make test`: **436 → 457** passed.
- +21 new tests in `tests/test_api_contract_strictness.py` (extra="forbid" parametrised over all three request schemas, alias coverage parametrised over 12 combinations, plus HTTP-level 422 + max_results round-trip).
- +2 previously-skipped tests in `tests/test_api_contracts.py` now pass (their stale `run_psipred` field was renamed to `run_s4pred`, so the schema accepts the payload again).

### Frontend impact

None. The frontend (`ui/src/components/UniProtQueryInput.tsx:201-213`) already sends snake_case (`run_tango`, `run_s4pred`, `length_min`, `length_max`, `include_isoforms`). Aliases were added defensively for curl and any non-UI clients. T3 follow-ups: (a) optionally render a banner when `meta.warnings` includes the long-sequence skip note (not yet emitted by the backend — depends on future work), (b) `s4predSkipped`-style row-level UI is unchanged because backend still returns null S4PRED fields for skipped sequences, which the UI already renders as `—`.

The investigation uvicorn (pid 13348, port 8765) has been stopped. The user's regular dev server (port 8000) was untouched.
