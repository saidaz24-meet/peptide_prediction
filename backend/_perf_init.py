# -*- coding: utf-8 -*-
"""
Performance init — set CPU thread caps BEFORE torch / numpy / openblas import.

PVL prod (Hetzner CX33, 4 vCPU, 8 GB) was ~22× slower than a Mac terminal
run on the same code. Root cause: PyTorch's S4PRED ensemble has 5 BiLSTM
networks, and torch + OpenMP + MKL + OpenBLAS all default their intra-op
thread count to `os.cpu_count()`. Stacked across an asyncio thread pool
(max_workers=4) and uvicorn workers (--workers 2), that produces
order-of-100 threads contending for 4 cores. Context-switch and
cache-thrash dominate runtime.

Fix: pin every numeric thread pool to 1. Each prediction is still parallel
across the asyncio thread pool; the numeric work inside each thread runs
single-threaded, which is the right shape for short-peptide BiLSTM
inference on a small VM.

This module MUST be imported before torch, numpy, scipy, or pandas
(they pull in OpenMP / MKL / OpenBLAS as a side effect of import).
Import it as the FIRST line of `api/main.py` and any script entry point.
"""

import os

_THREAD_ENVS = (
    "OMP_NUM_THREADS",
    "MKL_NUM_THREADS",
    "OPENBLAS_NUM_THREADS",
    "VECLIB_MAXIMUM_THREADS",
    "NUMEXPR_NUM_THREADS",
)

for _key in _THREAD_ENVS:
    os.environ.setdefault(_key, "1")


def applied() -> dict:
    """Return the actual env-var state — handy for `/api/health` reporting."""
    return {k: os.environ.get(k) for k in _THREAD_ENVS}
