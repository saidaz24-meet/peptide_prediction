"""Tests for Wave 2.5 §LD2 — large-dataset resilience.

Three budget paths pinned end-to-end through the upload route:

- ``len(df) <= MAX_PEPTIDES_PER_RUN_WITH_TANGO``       → no warnings, TANGO requested as usual.
- ``MAX_PEPTIDES_PER_RUN_WITH_TANGO < len(df) <= MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO``
  → ``tango_auto_disabled`` warning, ``meta.runMetadata.predictorsUsed`` lacks TANGO.
- ``len(df) > MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO``      → ``dataset_truncated`` + ``tango_auto_disabled``,
  response rows capped at the cap.

Plus a B4a hook-registration test (backend/api/main.py warm-up).
"""

from __future__ import annotations

import os

import pytest  # noqa: F401 — keep for future xfail markers
from fastapi.testclient import TestClient

# Tests run with providers disabled — the budget logic is pure pandas + meta
# wiring; we don't need a real TANGO run to verify it.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")
os.environ.setdefault("VECTOR_INDEX_ENABLED", "0")

from api.main import app  # noqa: E402
from config import settings  # noqa: E402

client = TestClient(app)


def _csv_body(n_rows: int) -> bytes:
    """Build a CSV body with ``n_rows`` synthetic peptides — minimal valid input."""
    lines = ["Entry,Sequence"]
    for i in range(n_rows):
        lines.append(f"pep_{i:05d},GIGAVLKVL")
    return ("\n".join(lines) + "\n").encode("utf-8")


# ---------------------------------------------------------------------------
# Small / normal datasets — no LD2 intervention
# ---------------------------------------------------------------------------


def test_small_dataset_emits_no_warnings(monkeypatch):
    """50 rows is well under both budgets — no LD2 intervention expected."""
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITH_TANGO", 500)
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO", 5000)

    resp = client.post(
        "/api/upload-csv",
        files={"file": ("small.csv", _csv_body(50), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    meta = resp.json()["meta"]
    # Either omitted entirely or explicitly None — both are valid "no warnings".
    assert not meta.get("warnings"), f"unexpected warnings: {meta.get('warnings')}"


# ---------------------------------------------------------------------------
# TANGO auto-disable — len(df) > MAX_*_WITH_TANGO but ≤ MAX_*_WITHOUT_TANGO
# ---------------------------------------------------------------------------


def test_large_dataset_auto_disables_tango(monkeypatch):
    """Above MAX_PEPTIDES_PER_RUN_WITH_TANGO, TANGO is auto-disabled and the
    response surfaces a ``tango_auto_disabled`` warning. S4PRED + FF-Helix
    still run — the response is valid, just narrower."""
    # Lower the bar so a 25-row CSV is "large" — keeps the test fast.
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITH_TANGO", 10)
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO", 100)

    resp = client.post(
        "/api/upload-csv",
        files={"file": ("medium.csv", _csv_body(25), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # All 25 rows still ship — TANGO is the only thing dropped.
    assert len(body["rows"]) == 25

    warnings = body["meta"].get("warnings") or []
    codes = {w["code"] for w in warnings}
    assert "tango_auto_disabled" in codes
    # ``count`` reflects the dataset size at decision time.
    auto_disabled = next(w for w in warnings if w["code"] == "tango_auto_disabled")
    assert auto_disabled["count"] == 25
    assert "TANGO auto-disabled" in auto_disabled["message"]


# ---------------------------------------------------------------------------
# Hard cap — len(df) > MAX_*_WITHOUT_TANGO triggers truncation
# ---------------------------------------------------------------------------


def test_huge_dataset_truncates_with_warning(monkeypatch):
    """Above MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO, the upload is truncated.
    Both ``dataset_truncated`` AND ``tango_auto_disabled`` warnings fire
    because the truncation cap is by definition larger than the TANGO
    budget — the truncated-but-still-large run is still over the TANGO budget."""
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITH_TANGO", 5)
    monkeypatch.setattr(settings, "MAX_PEPTIDES_PER_RUN_WITHOUT_TANGO", 20)

    # 35 rows submitted → truncated to 20 → still over the TANGO budget (5).
    resp = client.post(
        "/api/upload-csv",
        files={"file": ("huge.csv", _csv_body(35), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Response is capped at the hard limit.
    assert len(body["rows"]) == 20

    warnings = body["meta"].get("warnings") or []
    codes = {w["code"] for w in warnings}
    assert {"dataset_truncated", "tango_auto_disabled"} <= codes

    truncated = next(w for w in warnings if w["code"] == "dataset_truncated")
    assert truncated["count"] == 15  # 35 submitted - 20 kept
    assert "truncated" in truncated["message"].lower()


# ---------------------------------------------------------------------------
# Schema strictness — MetaWarning + warnings field
# ---------------------------------------------------------------------------


def test_meta_warning_schema_validates_minimal_payload():
    from schemas.api_models import MetaWarning

    w = MetaWarning(code="dataset_truncated", message="dropped 5 rows", count=5)
    assert w.level == "warning"  # default
    assert w.code == "dataset_truncated"


def test_meta_warning_rejects_unknown_field():
    """ADR-002: every new schema sets extra='forbid'."""
    from pydantic import ValidationError

    from schemas.api_models import MetaWarning

    with pytest.raises(ValidationError):
        MetaWarning.model_validate(
            {
                "code": "x",
                "message": "y",
                "rogue_field": "leak-me",
            }
        )


def test_meta_warning_rejects_invalid_level():
    from pydantic import ValidationError

    from schemas.api_models import MetaWarning

    with pytest.raises(ValidationError):
        MetaWarning.model_validate(
            {"code": "x", "message": "y", "level": "fatal"}  # not in Literal
        )


def test_meta_accepts_warnings_list_and_none():
    """``meta.warnings`` is NEW NULLABLE per ADR-013 conventions — clients
    that don't expect it must keep working when it's absent."""
    from schemas.api_models import Meta

    base = {
        "use_tango": False,
        "use_s4pred": False,
        "ssw_rows": 0,
        "valid_seq_rows": 0,
        "provider_status": {},
        "runId": "r",
        "traceId": "t",
        "inputsHash": "h",
        "configHash": "c",
        "providerStatusSummary": {},
        "thresholdConfigResolved": {"mode": "default"},
        "thresholds": {},
    }

    # Without warnings → field is None.
    m_none = Meta.model_validate(base)
    assert m_none.warnings is None

    # With warnings → field is populated.
    m_warned = Meta.model_validate(
        {
            **base,
            "warnings": [
                {"code": "tango_auto_disabled", "message": "...", "count": 1000},
                {"code": "dataset_truncated", "message": "...", "count": 5},
            ],
        }
    )
    assert m_warned.warnings is not None
    assert {w.code for w in m_warned.warnings} == {
        "tango_auto_disabled",
        "dataset_truncated",
    }


# ---------------------------------------------------------------------------
# B4a — S4PRED warm-up hook registration
# ---------------------------------------------------------------------------


def test_s4pred_preload_path_exists():
    """The S4PRED ensemble must be pre-loadable at import time so the
    first user request doesn't pay the cold-load cost.

    PERF-2026-06-22 replaced the old async fire-and-forget ``_warmup_s4pred``
    startup hook (which raced with the first request and duplicated RAM
    per gunicorn worker) with module-level ``_preload_models()`` invoked at
    ``api.main`` import. Combined with gunicorn ``--preload``, this loads
    once in the master process and workers inherit the weights via
    copy-on-write.

    This test pins the preload path so a stray refactor doesn't silently
    re-introduce the cold-load + per-worker duplication problem.
    """
    # The preload module must exist and expose a callable preload_models().
    import _app_preload  # noqa: F401

    assert callable(getattr(_app_preload, "preload_models", None)), (
        "_app_preload.preload_models() must exist — this is the eager-load "
        "entry point invoked at api.main import time."
    )

    # The api.main module must call preload_models() at module top, not
    # via on_event("startup"). Grep the source to enforce this — startup
    # hooks run AFTER fork in each gunicorn worker, defeating --preload.
    import inspect

    import api.main as _main

    src = inspect.getsource(_main)
    assert "_preload_models()" in src, (
        "api/main.py must invoke _preload_models() at module level so "
        "gunicorn --preload runs it in the master process before forking."
    )
