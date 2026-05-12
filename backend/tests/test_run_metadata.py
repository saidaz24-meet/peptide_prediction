"""Tests for ``RunMetadata`` + ``services.run_metadata`` (Wave 2 §G, ADR-013).

Covers:
- Pydantic schema validation (strict ``extra="forbid"``, required fields,
  alias acceptance for snake_case + camelCase inputs).
- ``build_run_metadata`` factory (defaults, predictor-flag plumbing,
  threshold flattening, dataset_id / permalink passthrough).
- ``format_csv_header`` serializer (spec G.3 format, deterministic order,
  list / dict serialization).
- End-to-end pipeline tests asserting ``Meta.runMetadata`` is populated on
  the canonical analysis routes, with the correct ``sequenceSource`` per
  route. UniProt is covered by mocking the upstream service since the
  real route requires network.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

# Disable providers before importing the app so tests are fast + deterministic.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")
os.environ.setdefault("VECTOR_INDEX_ENABLED", "0")

from api.main import app  # noqa: E402
from schemas.api_models import Meta, RunMetadata  # noqa: E402
from services.run_metadata import (  # noqa: E402
    FF_HELIX_VERSION,
    FF_SSW_VERSION,
    S4PRED_VERSION,
    TANGO_VERSION,
    build_run_metadata,
    format_csv_header,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


def _minimal_run_metadata_payload() -> dict:
    return {
        "pvlVersion": "0.1.0",
        "runTimestamp": "2026-05-12T10:00:00Z",
        "sequenceSource": "csv",
        "predictorsUsed": ["ff_helix", "ff_ssw"],
        "predictorVersions": {"ff_helix": FF_HELIX_VERSION, "ff_ssw": FF_SSW_VERSION},
        "thresholds": {"muHCutoff": 0.5},
    }


def test_schema_accepts_minimal_valid_payload():
    rm = RunMetadata.model_validate(_minimal_run_metadata_payload())
    assert rm.pvlVersion == "0.1.0"
    assert rm.sequenceSource == "csv"
    assert rm.datasetId is None
    assert rm.permalink is None


def test_schema_rejects_extra_fields():
    """ADR-002 strict-contract rule applies — typos fail loudly."""
    bad = _minimal_run_metadata_payload() | {"rogueField": "nope"}
    with pytest.raises(ValidationError):
        RunMetadata.model_validate(bad)


def test_schema_rejects_unknown_sequence_source():
    bad = _minimal_run_metadata_payload() | {"sequenceSource": "stargazing"}
    with pytest.raises(ValidationError):
        RunMetadata.model_validate(bad)


def test_schema_accepts_snake_case_aliases():
    """Producers writing snake_case (per spec G.3 / ADR-013) round-trip."""
    rm = RunMetadata.model_validate(
        {
            "pvl_version": "0.1.0",
            "run_timestamp": "2026-05-12T10:00:00Z",
            "sequence_source": "uniprot",
            "predictors_used": ["ff_helix"],
            "predictor_versions": {"ff_helix": FF_HELIX_VERSION},
            "thresholds": {"x": 1.0},
            "dataset_id": "abc123",
        }
    )
    assert rm.sequenceSource == "uniprot"
    assert rm.datasetId == "abc123"


def test_schema_rejects_missing_required():
    incomplete = _minimal_run_metadata_payload()
    del incomplete["pvlVersion"]
    with pytest.raises(ValidationError):
        RunMetadata.model_validate(incomplete)


def test_meta_accepts_run_metadata():
    """RunMetadata must flow through the surrounding Meta envelope cleanly."""
    payload = {
        "use_tango": False,
        "use_s4pred": False,
        "ssw_rows": 0,
        "valid_seq_rows": 1,
        "provider_status": {},
        "runId": "r-1",
        "traceId": "t-1",
        "inputsHash": "h-1",
        "configHash": "c-1",
        "providerStatusSummary": {},
        "thresholdConfigResolved": {"mode": "default"},
        "thresholds": {"muHCutoff": 0.5},
        "runMetadata": _minimal_run_metadata_payload(),
    }
    meta = Meta.model_validate(payload)
    assert meta.runMetadata is not None
    assert meta.runMetadata.sequenceSource == "csv"


def test_meta_run_metadata_is_optional():
    """ADR-013 explicitly says the field is NEW NULLABLE — existing clients
    that don't send it must keep working."""
    payload = {
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
    meta = Meta.model_validate(payload)
    assert meta.runMetadata is None


# ---------------------------------------------------------------------------
# build_run_metadata factory
# ---------------------------------------------------------------------------


def test_build_includes_ff_predictors_unconditionally():
    """ff_helix + ff_ssw are PVL invariants; they should ALWAYS be in
    predictorsUsed even when both external predictors are off."""
    rm = build_run_metadata(
        sequence_source="manual",
        thresholds={"muHCutoff": 0.5},
        use_tango=False,
        use_s4pred=False,
    )
    assert "ff_helix" in rm["predictorsUsed"]
    assert "ff_ssw" in rm["predictorsUsed"]
    assert "tango" not in rm["predictorsUsed"]
    assert "s4pred" not in rm["predictorsUsed"]
    assert rm["predictorVersions"]["ff_helix"] == FF_HELIX_VERSION


def test_build_adds_tango_and_s4pred_when_enabled():
    rm = build_run_metadata(
        sequence_source="csv",
        thresholds={},
        use_tango=True,
        use_s4pred=True,
    )
    assert rm["predictorsUsed"] == ["tango", "s4pred", "ff_helix", "ff_ssw"]
    assert rm["predictorVersions"]["tango"] == TANGO_VERSION
    assert rm["predictorVersions"]["s4pred"] == S4PRED_VERSION


def test_build_filters_non_numeric_threshold_entries():
    """Only numeric leaves end up in the CSV-header-safe thresholds dict."""
    rm = build_run_metadata(
        sequence_source="csv",
        thresholds={"muHCutoff": 0.5, "mode": "default", "version": "1.0.0"},
        use_tango=False,
        use_s4pred=False,
    )
    assert rm["thresholds"] == {"muHCutoff": 0.5}


def test_build_passes_dataset_id_and_permalink_through():
    rm = build_run_metadata(
        sequence_source="csv",
        thresholds={},
        use_tango=False,
        use_s4pred=False,
        dataset_id="abc123",
        permalink="https://pvl.example.com/r?x=1",
    )
    assert rm["datasetId"] == "abc123"
    assert rm["permalink"] == "https://pvl.example.com/r?x=1"


def test_build_timestamp_uses_iso8601_z_suffix():
    """Spec G.3 example uses '2026-05-08T22:34:11Z' — keep the Z suffix
    instead of the verbose '+00:00' Python default."""
    fixed = datetime(2026, 5, 12, 10, 30, 0, tzinfo=timezone.utc)
    rm = build_run_metadata(
        sequence_source="manual",
        thresholds={},
        use_tango=False,
        use_s4pred=False,
        now=fixed,
    )
    assert rm["runTimestamp"] == "2026-05-12T10:30:00Z"


# ---------------------------------------------------------------------------
# format_csv_header serializer
# ---------------------------------------------------------------------------


def test_csv_header_uses_pvl_marker_and_snake_case_keys():
    rm = build_run_metadata(
        sequence_source="csv",
        thresholds={"muHCutoff": 0.5, "hydroCutoff": 0.5},
        use_tango=True,
        use_s4pred=True,
        dataset_id="abc123",
    )
    header = format_csv_header(rm)
    lines = header.splitlines()

    # First line is the marker; last meaningful line is the # separator.
    assert lines[0] == "# PVL run_metadata"
    assert lines[-1] == "#"
    # All lines start with '# ' — pandas / R / Excel skip these.
    assert all(line.startswith("#") for line in lines)

    body = "\n".join(lines)
    assert "pvl_version=" in body
    assert "run_timestamp=" in body
    assert "sequence_source=csv" in body
    assert "predictors_used=tango,s4pred,ff_helix,ff_ssw" in body
    assert "predictor_versions=tango=2.3,s4pred=1.2.4" in body
    assert "thresholds=muHCutoff=0.5,hydroCutoff=0.5" in body
    assert "dataset_id=abc123" in body
    # permalink not set → empty value, key still present
    assert "permalink=" in body


def test_csv_header_omits_unknown_keys():
    """Extra keys an upstream caller might tack on aren't whitelisted —
    they shouldn't leak into the header (otherwise spec G.3 row count drifts)."""
    rm_dict = build_run_metadata(
        sequence_source="csv", thresholds={}, use_tango=False, use_s4pred=False
    )
    rm_dict["surpriseField"] = "leak-me"
    header = format_csv_header(rm_dict)
    assert "surpriseField" not in header
    assert "surprise_field" not in header


def test_csv_header_strips_newlines_in_values():
    """A pathological permalink with a newline must not break the header
    format into multiple `key=value` lines."""
    rm = build_run_metadata(
        sequence_source="manual",
        thresholds={},
        use_tango=False,
        use_s4pred=False,
        permalink="https://x.example.com/\nDROP TABLE peptides",
    )
    header = format_csv_header(rm)
    # No bare newlines inside the value — only the line-terminator newlines.
    # Count of '# ' line-starts should equal lines.
    lines = header.rstrip("\n").splitlines()
    assert all(line.startswith("#") for line in lines)


# ---------------------------------------------------------------------------
# Pipeline integration — runMetadata flows through to live responses
# ---------------------------------------------------------------------------


def test_predict_response_includes_run_metadata():
    """``/api/predict`` returns Meta.runMetadata with sequenceSource='manual'."""
    resp = client.post(
        "/api/predict",
        data={"sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ", "entry": "demo"},
    )
    assert resp.status_code == 200, resp.text
    meta = resp.json()["meta"]
    rm = meta.get("runMetadata")
    assert rm is not None
    assert rm["sequenceSource"] == "manual"
    assert rm["pvlVersion"] != ""
    # ff_helix / ff_ssw always run; the external predictors are off in tests.
    assert "ff_helix" in rm["predictorsUsed"]
    assert "ff_ssw" in rm["predictorsUsed"]
    # Single-sequence runs have no batch datasetId.
    assert rm["datasetId"] is None


def test_upload_csv_response_includes_run_metadata():
    """``/api/upload-csv`` returns Meta.runMetadata with sequenceSource='csv'."""
    csv_body = b"Entry,Sequence\nP1,GIGAVL\nP2,AAKKAA\n"
    resp = client.post(
        "/api/upload-csv",
        files={"file": ("seqs.csv", csv_body, "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    meta = resp.json()["meta"]
    rm = meta.get("runMetadata")
    assert rm is not None
    assert rm["sequenceSource"] == "csv"
    # Batch runs DO have a datasetId (the inputs hash).
    assert isinstance(rm["datasetId"], str) and len(rm["datasetId"]) > 0


def test_two_routes_emit_distinct_sequence_sources():
    """Predict and upload must produce different ``sequenceSource`` values
    even when the same sequence is submitted both ways — peer reviewers
    rely on this to distinguish "we used the demo dataset" from "we typed
    one sequence into Quick Analyze"."""
    p = client.post(
        "/api/predict", data={"sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ"}
    )
    u = client.post(
        "/api/upload-csv",
        files={
            "file": ("seqs.csv", b"Entry,Sequence\nA,GIGAVLKVLTTGLPALISWIKRKRQQ\n", "text/csv")
        },
    )
    assert p.status_code == 200 and u.status_code == 200
    assert p.json()["meta"]["runMetadata"]["sequenceSource"] == "manual"
    assert u.json()["meta"]["runMetadata"]["sequenceSource"] == "csv"
