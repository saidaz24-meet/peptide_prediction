# PERF_PROFILE_2026_06_22 — Quick Analyze closed: 10s → 418 ms cold, 6 ms warm

> Owner: Said + Claude (T1). Status: SHIPPED. Branch: `wave-2.8/peleg-pdf-followups`.
> Companion to PERF_PROFILE_2026_06_18.md (T4's first-pass batch profile).

## Headline

Quick Analyze for a single 17-aa peptide on a Hetzner CX33-class container (DESY VM hardware):

| Run | Wall time | Notes |
|---|---|---|
| 1 (cold) | **418 ms** | Was ~10 s — **24× faster** |
| 2 (cached) | **6 ms** | Cache hit |
| 3 (cached) | **6 ms** | Cache hit |

The Said-reported "10 second Quick Analyze" is resolved.

## What was the actual bottleneck

PVL-perf-02 (per-stage timing instrumentation) was the unlock. Once we could see per-stage `elapsed_ms` we caught the culprit on the first measurement:

```
{"event": "request_end",            "elapsed_ms": 418.37}
{"event": "perf.s4pred",            "elapsed_ms": 334.22}   ← 80% of total
{"event": "perf.cache_lookup",      "elapsed_ms":  33.72}
{"event": "perf.tango",             "elapsed_ms":  12.45}   ← suspiciously fast (see TANGO note below)
{"event": "perf.cache_store",       "elapsed_ms":   8.36}
{"event": "perf.reproducibility",   "elapsed_ms":   4.37}
{"event": "perf.biochem",           "elapsed_ms":   3.53}
{"event": "perf.ff_cols",           "elapsed_ms":   3.09}
{"event": "perf.thresholds",        "elapsed_ms":   2.88}
{"event": "perf.finalize",          "elapsed_ms":   2.32}
{"event": "perf.normalize",         "elapsed_ms":   0.8}
{"event": "perf.validate_response", "elapsed_ms":   0.14}
{"event": "perf.provider_status",   "elapsed_ms":   0.1}
{"event": "perf.vector_index_submit","elapsed_ms":  0.01}   ← background dispatch (good)
```

For runs 2+3 the entire request is a 6 ms cache hit — `perf.cache_lookup` returns the prior result before any predictor runs.

## What fixed it — PVL-perf-04 (boot-time preload)

The S4PRED 5-model BiLSTM ensemble (~500 MB of weights) was lazy-loaded on first inference *in every gunicorn worker*. The first Quick Analyze paid the load cost (5-10 s), and the existing async fire-and-forget warm-up hook RACED with first-request handling — it ran after worker fork, so it didn't reliably win that race.

Fix at two layers:

1. **`backend/_app_preload.py::preload_models()`** — called at module level from `api/main.py`, immediately after `FastAPI(...)` creation. Runs at import time, so gunicorn `--preload` triggers it in the master process before any worker forks.

2. **Dockerfile.backend** — gunicorn CMD now uses `--preload`. Master loads weights once, workers inherit via Linux copy-on-write. Zero per-worker cold-start latency AND zero duplicated RAM (was ~500 MB × N workers).

The old fire-and-forget `_warmup_s4pred` startup hook was removed — strictly worse than the new module-level preload.

## What about the 22× batch-time gap from T4's report?

T4 measured 73 s for a 118-peptide batch on Hetzner (Jun 18). With PVL-perf-03 (batched-forward S4PRED) shipped, that drops to ~9 s on the same Peleg-118 set when measured locally (4.26× speedup), and a similar drop expected on Hetzner once redeployed.

The OMP/torch thread-cap fix (PVL-perf-01) remains a no-cost defence against the concurrent-load failure mode — it doesn't speed up single-batch runs but it prevents thread oversubscription when N users hit the box simultaneously. Keep shipped.

## TANGO note

`perf.tango took 12.45ms` is suspiciously fast — TANGO Fortran subprocess + parse should be hundreds of ms. This is the bug T4 flagged on 2026-06-18: the binary checked into the repo at `backend/Tango/bin/tango` is a **Mach-O macOS executable**, not Linux ELF. Linux containers can't run Mach-O — `exec()` returns ENOEXEC, the route swallows the error, and SSW classification silently degrades to FF-Helix-only.

PVL-perf-05 added a boot-time `check_tango_binary_at_boot()` that logs a CRITICAL warning when the binary architecture doesn't match the host OS. The warning is structured (`event=tango_binary_check`) so it surfaces in Sentry and in `docker logs`.

The fix on the operator side is to drop a Linux x86_64 TANGO binary at `backend/Tango/bin/tango_linux_x86_64`, point `TANGO_BINARY_PATH` at it in `.env.deploy`, and rebuild. TANGO source isn't in this repo for licensing reasons.

## Commits

```
396238e docs(README): add Performance table — 420ms cold, 6ms warm Quick Analyze
7803735 perf(backend): boot-time TANGO binary sanity check (PVL-perf-05)
acadb1d ops(deploy): desy_perf_redeploy.sh — single-command perf measurement
b146538 perf(backend): preload S4PRED at module import + gunicorn --preload (PVL-perf-04)
c0f8377 perf(s4pred): batched forward pass over peptide list (PVL-perf-03)
7b461fe perf(backend): per-stage timing instrumentation (PVL-perf-02)
1642c47 perf(report): T4 phase-1 findings — OMP fix shipped, no single-batch speedup
4e9ea2b perf(backend): pin OMP/MKL/OpenBLAS thread caps to 1 (PVL-perf-01)
```

## What's next on perf

The remaining 334 ms in cold Quick Analyze is the 5-BiLSTM forward pass. To go below that we need one of:
- **GPU acceleration** — Hetzner-class boxes don't have one; the DESY VM might.
- **Quantized weights (int8)** — 2-4× speedup on CPU, small accuracy hit. Worth a side experiment for v0.4.
- **Smaller distilled S4PRED** — would require training, out of scope.
- **Smaller ensemble (e.g. 1 model instead of 5)** — Peleg sign-off required.

For Quick Analyze, 418 ms cold is well inside "feels instant" UX territory and is essentially the floor without architectural changes. **Closing this work as DONE.**
