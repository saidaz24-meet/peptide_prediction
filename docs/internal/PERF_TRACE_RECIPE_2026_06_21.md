# PERF trace recipe — 2026-06-21

> Goal: see EXACTLY which stage of the predict path takes the 10 seconds
> Quick Analyze burns on ONE peptide. No flame graph guessing. Real elapsed-ms
> per stage, paired with a total request time. Switched on with one env var.

## What's instrumented

Every stage of `process_single_sequence` is wrapped in a `timed()` context
manager that emits a structured JSON log when the stage finishes:

```
{"event": "perf.tango",  "elapsed_ms": 612.3,  "entry": "Uperin", "seq_len": 17, ...}
{"event": "perf.s4pred", "elapsed_ms": 4821.7, "entry": "Uperin", "seq_len": 17, ...}
{"event": "perf.normalize", "elapsed_ms": 12.4, ...}
{"event": "perf.cache_store", "elapsed_ms": 1.1, ...}
```

The HTTP middleware also emits a request-level total:

```
{"event": "request_end", "method": "POST", "path": "/api/predict",
 "status_code": 200, "elapsed_ms": 5447.2}
```

The math should add up: sum of `perf.*` ≈ `request_end.elapsed_ms`. Any
unexplained gap is overhead in the framework / serialization / network layer.

## How to turn it on

Opt-in via env var. Default is OFF — zero log overhead in normal operation.

### Local

```bash
cd backend
PVL_PERF_LOGS=1 USE_TANGO=1 USE_S4PRED=1 .venv/bin/python -m uvicorn api.main:app --port 8000
```

Then hit it:

```bash
./scripts/perf_trace.sh                            # default: Uperin 3.5, 3 runs
./scripts/perf_trace.sh GIGAVLKVLTTGLPALISWIKRKRQQ 5   # custom seq, 5 runs
```

### Hetzner prod

```bash
ssh root@94.130.178.182
cd /opt/pvl

# 1. Add PVL_PERF_LOGS to the backend env
cat >> .env.deploy <<'ENV'
PVL_PERF_LOGS=1
ENV

# 2. Restart the backend container (keeps the same image — just re-reads env)
docker compose -f docker/docker-compose.prod.yml up -d --no-deps --force-recreate backend

# 3. Watch the per-stage timings
docker compose -f docker/docker-compose.prod.yml logs -f backend | grep --line-buffered -E '"event":\s*"perf\.|"event":\s*"request_end"'

# 4. From your laptop or a second shell on the box, fire a single Quick Analyze
curl -sS -X POST http://94.130.178.182:8000/api/predict \
  -F sequence=GVGDLIRKAVSVIKNIV -F entry=Uperin \
  -o /tmp/trace.json -w '\nclient total: %{time_total}s\n'

# 5. Read off the per-stage lines.
#    To turn it back off:
sed -i '/^PVL_PERF_LOGS=/d' .env.deploy
docker compose -f docker/docker-compose.prod.yml up -d --no-deps --force-recreate backend
```

### DESY VM

Same as Hetzner but `ssh -l root landau-webapp-dev` after the maxwell hop;
container name is `pvl-backend-test` per the bootstrap script.

## What we expect to see (testable predictions)

### Hypothesis A — Cold worker model load
If the first request after container restart shows `perf.s4pred` ~5–8 seconds
but subsequent requests show <500 ms, then S4PRED's 5 BiLSTM `.pt` files are
loading per-worker. The fix is to load them once at boot (not lazily on first
request) using the `lifespan` hook in `api/main.py`.

### Hypothesis B — S4PRED is slow per peptide regardless of warmup
If `perf.s4pred` consistently shows 2–5 seconds even on warm workers, the
bottleneck is the BiLSTM forward pass being run on a tiny tensor with
sequential ensemble dispatch. Fix: **batch all 5 ensemble models into one
forward call OR use `torch.jit.script`** the model.

### Hypothesis C — TANGO subprocess overhead
If `perf.tango` shows 2–4 seconds, the Fortran binary spawn-and-parse cost
dominates. T4 already noted TANGO isn't even running on prod (`tangoHasData:
false`) — fixing that first is a correctness gate, AND will give us the real
TANGO timing to optimize against.

### Hypothesis D — Pydantic / JSON validation
If `perf.validate_response` shows >500 ms, the `PredictResponse.model_validate`
call is the cost. Fix: drop the strict validation on this path, or switch to
`pydantic-core`'s faster validators.

### Hypothesis E — Vector indexing (was off the hot path, but verify)
If `perf.vector_index_submit` shows >100 ms, the "submit to background" isn't
actually backgrounding. ISSUE-033 was supposed to fix this — confirm it
stayed fixed.

### Hypothesis F — Cold gunicorn worker
If the FIRST request after a worker recycle (gunicorn `--max-requests 1000`)
is always slow but #2 onward is fast, the worker-restart cost is the issue.
Fix: bump `--max-requests` or warm the model on `lifespan`.

## Diagnostic flow

```
                  ┌─────────────────────────────────────────┐
                  │ Run perf_trace.sh — read 3 runs of      │
                  │ per-stage elapsed_ms                    │
                  └────────────────┬────────────────────────┘
                                   │
       ┌───────────────────────────┼─────────────────────────────┐
       │                           │                             │
  s4pred dominates           tango dominates           normalize / validate
       │                           │                             │
       ▼                           ▼                             ▼
  Hypothesis A or B          Hypothesis C                  Hypothesis D
  → check: is run #1         → first fix the              → check: pydantic
    much slower than #2?       TANGO-missing               version + remove
    if yes: lifespan hook      issue T4 flagged            redundant validation
    if no:  batched fwd        (path mismatch)
```

## Tracking the work

After you capture the trace, file the result here:

```bash
# Copy the relevant log lines into a markdown summary
docker compose logs backend --since 5m | grep '"perf\.\|"request_end"' > /tmp/trace.jsonl
```

Then update `docs/internal/PERF_PROFILE_2026_06_18.md` with the stage
breakdown and which hypothesis got confirmed.

## Files involved

- `backend/services/perf_logger.py` — the `timed()` context manager
- `backend/services/predict_service.py` — wrappers around each stage
- `backend/api/main.py::TraceIdMiddleware` — request-level elapsed_ms
- `scripts/perf_trace.sh` — fire one request, capture timings

## What is NOT instrumented (by design)

- The model-loading inside `get_predictor()` — happens once per worker
  lifetime, not per request. If you suspect this is the culprit, add a
  `timed("s4pred_init")` block around the call in `tools/s4pred/__init__.py`.
- The CSV parser path. Quick Analyze doesn't use it; batch does. Wrap
  separately if batch perf becomes a concern.
- Sub-stages inside `_run_s4pred_provider` or `_run_tango_for_single_sequence`.
  Wrap at finer grain ONLY after the outer stage points to one of them as
  the culprit — don't pre-instrument what we don't need.
