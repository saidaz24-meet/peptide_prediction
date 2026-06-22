# -*- coding: utf-8 -*-
"""
Eager-load heavy ML models at module import time.

PROBLEM: every gunicorn worker independently lazy-loaded the S4PRED
5-model BiLSTM ensemble (~500 MB of weights) on its FIRST user
request. The first user paid 5-10 seconds for that load; the worker
also held its own 500 MB copy of the weights. With 2 workers ⇒ 1 GB
RAM duplicated. The existing startup hook was async fire-and-forget,
which races with the first request.

SOLUTION: load the model HERE, at module import time. Combined with
gunicorn's ``--preload`` flag (set in Dockerfile.backend CMD), this
runs ONCE in the master process before any worker forks. Workers
inherit the loaded weights via Linux copy-on-write — zero per-worker
RAM cost, zero cold-start latency.

For non-gunicorn runs (uvicorn dev server, pytest), it still works:
the model loads once when ``api.main`` is first imported.

GRACEFUL FAILURE: if weights aren't installed or the predictor
import fails, log a warning and continue. The API still works, just
without S4PRED — same behaviour as today when ``USE_S4PRED=0``.
"""

from __future__ import annotations

import os
import time
from typing import Optional

from config import settings
from services.logger import log_info, log_warning


def preload_models() -> None:
    """Eager-load S4PRED ensemble (~500 MB) into the module-global
    predictor cache. Idempotent: re-running is a fast no-op.

    Skips itself when ``USE_S4PRED=0`` or when weights aren't present
    on disk. Errors are logged at warning level and swallowed —
    a failed preload must NEVER take the API down.
    """
    if not settings.USE_S4PRED:
        log_info("preload_skip", "USE_S4PRED=0, skipping S4PRED preload")
        return

    if _running_under_pytest():
        # Tests typically set USE_S4PRED=0 and don't want a model load;
        # this is belt-and-braces in case they don't.
        log_info("preload_skip", "pytest detected, skipping S4PRED preload")
        return

    started = time.perf_counter()
    try:
        from s4pred import get_s4pred_weights_path, is_s4pred_available
        from tools.s4pred import get_predictor

        available, reason = is_s4pred_available()
        if not available:
            log_info(
                "preload_skip",
                f"S4PRED not available: {reason}",
                reason=reason,
            )
            return

        weights_path = get_s4pred_weights_path()
        if not weights_path or not os.path.isdir(weights_path):
            log_info(
                "preload_skip",
                f"S4PRED weights not at {weights_path!r}",
                weights_path=weights_path,
            )
            return

        log_info(
            "preload_started",
            f"Loading S4PRED 5-model ensemble from {weights_path}",
            weights_path=weights_path,
        )
        predictor = get_predictor(weights_path)
        # Tiny inference exercises every layer in the ensemble so PyTorch
        # JIT / autograd state caches are also primed. Cleared from the
        # response — we only care about the side effect (warm caches).
        predictor.predict_from_sequence("warmup", "ACDEF")
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        log_info(
            "preload_done",
            f"S4PRED preload + warm-up complete in {elapsed_ms}ms",
            elapsed_ms=elapsed_ms,
            weights_path=weights_path,
        )
    except Exception as e:  # pragma: no cover — defensive
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        log_warning(
            "preload_failed",
            f"S4PRED preload failed after {elapsed_ms}ms: {e}",
            elapsed_ms=elapsed_ms,
            error=str(e),
        )


def _running_under_pytest() -> bool:
    """True when imported during a pytest run.

    Belt-and-braces against tests that forget to set ``USE_S4PRED=0``.
    """
    return "PYTEST_CURRENT_TEST" in os.environ or "pytest" in os.environ.get("_", "")


def check_tango_binary_at_boot() -> None:
    """PVL-perf-05: boot-time sanity check for the TANGO binary.

    T4's 2026-06-18 perf report found ``tangoHasData: false`` on Hetzner
    prod despite ``USE_TANGO=1``. Root cause: the TANGO binary checked
    into the repo at ``backend/Tango/bin/tango`` is a macOS Mach-O
    executable. Linux containers can't run Mach-O — exec returns
    ENOEXEC, which the route handler swallows (because TANGO failures
    are tolerated; we don't want one bad peptide to kill the whole
    batch). Result: the whole SSW / FF-SSW classification silently
    degrades to FF-Helix-only.

    Make this LOUD at boot. Log an error every time a Linux container
    starts with a Mach-O TANGO binary, so it shows up in Sentry and in
    container start-up logs. A real fix needs a Linux x86_64 binary
    placed at ``backend/Tango/bin/tango_linux_x86_64`` (or wherever
    TANGO_BINARY_PATH points). The TANGO source isn't in this repo
    for licensing reasons — Said has the binary in his TANGO 2.0
    download from http://tango.crg.es/.
    """
    if not settings.USE_TANGO:
        return

    bin_path = os.environ.get("TANGO_BINARY_PATH")
    if not bin_path:
        log_warning(
            "tango_binary_check",
            "USE_TANGO=1 but TANGO_BINARY_PATH is unset — TANGO will not run.",
        )
        return

    if not os.path.isfile(bin_path):
        log_warning(
            "tango_binary_check",
            f"USE_TANGO=1 but TANGO binary not found at {bin_path}. "
            "TANGO will be skipped; SSW classification degraded.",
            bin_path=bin_path,
        )
        return

    if not os.access(bin_path, os.X_OK):
        log_warning(
            "tango_binary_check",
            f"TANGO binary not executable: {bin_path}. Run "
            f"`chmod +x {bin_path}` inside the container.",
            bin_path=bin_path,
        )
        return

    # Read the first few bytes to detect the architecture. Mach-O magic
    # bytes are 0xCFFAEDFE (64-bit LE) or 0xFEEDFACF (64-bit BE); Linux
    # ELF magic is 0x7F 'E' 'L' 'F'.
    try:
        with open(bin_path, "rb") as f:
            head = f.read(4)
    except OSError as e:
        log_warning(
            "tango_binary_check",
            f"Cannot read TANGO binary header: {e}",
            bin_path=bin_path,
        )
        return

    import platform

    system = platform.system()  # 'Linux' / 'Darwin' / 'Windows'
    is_macho = head[:4] in (b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe")
    is_elf = head[:4] == b"\x7fELF"

    if system == "Linux" and is_macho:
        log_warning(
            "tango_binary_check",
            "CRITICAL: TANGO binary at "
            f"{bin_path} is a Mach-O (macOS) executable but the host is "
            "Linux. exec() will return ENOEXEC and TANGO predictions will "
            "silently fail. Drop a Linux x86_64 binary at "
            "backend/Tango/bin/tango_linux_x86_64 (or wherever "
            "TANGO_BINARY_PATH points) and rebuild the image.",
            bin_path=bin_path,
            host_system=system,
        )
        return

    if system == "Darwin" and is_elf:
        log_warning(
            "tango_binary_check",
            f"TANGO binary at {bin_path} is ELF (Linux) but the host is macOS. TANGO will fail.",
            bin_path=bin_path,
            host_system=system,
        )
        return

    log_info(
        "tango_binary_ok",
        f"TANGO binary at {bin_path} is a {'Mach-O' if is_macho else ('ELF' if is_elf else 'unknown')} "
        f"executable; host is {system}.",
        bin_path=bin_path,
        host_system=system,
        is_elf=is_elf,
        is_macho=is_macho,
    )
