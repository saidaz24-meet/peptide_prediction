# -*- coding: utf-8 -*-
"""
Per-stage performance instrumentation.

PHILOSOPHY: simple — no DI framework, no metrics backend, no decorators.
A single `timed()` context manager that records elapsed wall time and writes
it as a structured log line. Opt-in via the PVL_PERF_LOGS=1 env var so it
doesn't bloat prod logs by default.

USAGE:

    from services.perf_logger import timed

    with timed("tango", entry=entry_id):
        run_tango(...)

    with timed("s4pred", entry=entry_id, seq_len=len(seq)):
        run_s4pred(...)

When enabled, this emits a JSON log line per stage:

    {"event": "perf.tango", "elapsed_ms": 612.3, "entry": "Uperin", ...}

DEPLOY RECIPE:

    # On the box where the backend runs
    docker compose -f docker/docker-compose.prod.yml exec backend \
        sh -c 'export PVL_PERF_LOGS=1 && pkill -HUP gunicorn'   # or restart

    # Then in another shell, watch the per-stage timings:
    docker compose logs -f backend | grep -F '"event": "perf.'

    # Fire one Quick Analyze and read the line trace:
    curl -X POST http://localhost:8000/api/predict \
        -F sequence=GVGDLIRKAVSVIKNIV -F entry=Uperin

The 10 lines that come back tell us EXACTLY which stage dominates.
"""

from __future__ import annotations

import os
import time
from contextlib import contextmanager
from typing import Any, Iterator

from services.logger import log_info


def _enabled() -> bool:
    """True when PVL_PERF_LOGS env var is set to a truthy value.

    Cheap to call — re-reads the env var each invocation so an operator can
    toggle it without a process restart (e.g. by writing a sidecar config).
    """
    v = os.environ.get("PVL_PERF_LOGS", "")
    return v.lower() in ("1", "true", "yes", "on")


@contextmanager
def timed(stage: str, **extra: Any) -> Iterator[None]:
    """Time a block of code and emit a structured perf log when it exits.

    Args:
        stage: Short stage name (e.g. "tango", "s4pred", "normalize").
            Becomes part of the event key as ``perf.<stage>``.
        **extra: Arbitrary structured fields to attach to the log line.
            Common: ``entry`` (peptide id), ``seq_len`` (sequence length),
            ``count`` (number of peptides processed in this stage).

    Notes:
        - Uses time.perf_counter() — monotonic, microsecond resolution, the
          right tool for elapsed-time measurement.
        - When PVL_PERF_LOGS is unset, the with-block runs without logging.
          The context-manager overhead is one boolean check + one perf_counter
          call (~1 µs total) — safe to leave in hot paths.
    """
    if not _enabled():
        yield
        return

    t0 = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        log_info(
            f"perf.{stage}",
            f"{stage} took {elapsed_ms}ms",
            elapsed_ms=elapsed_ms,
            stage=stage,
            **extra,
        )


def perf_log(stage: str, elapsed_ms: float, **extra: Any) -> None:
    """Emit a perf log without using the context manager.

    Useful when timing logic is wrapped around async/await or coroutine
    boundaries the context manager can't span cleanly.
    """
    if not _enabled():
        return
    log_info(
        f"perf.{stage}",
        f"{stage} took {round(elapsed_ms, 2)}ms",
        elapsed_ms=round(elapsed_ms, 2),
        stage=stage,
        **extra,
    )
