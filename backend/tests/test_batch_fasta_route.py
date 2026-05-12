"""Tests for ``POST /api/predict/batch`` + FASTA-source plumbing on
``POST /api/upload-csv`` (Wave 2 §H).

The route is a thin raw-body wrapper around the existing batch pipeline; the
parser layer (``services.dataframe_utils.parse_fasta``) is already covered
by ``test_fasta_parser.py``. These tests pin the HTTP-level behaviour:

- Content-Type detection picks the right parser.
- ``run_metadata.sequenceSource`` correctly reflects the input format
  (``fasta`` vs ``csv``) so peer reviewers can distinguish them.
- Same sequence in via FASTA vs CSV → identical PVL output rows
  (CLAUDE.md principle 1 — single/batch parity holds across input formats).
- Error paths produce 4xx with helpful messages, not 5xx.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest  # noqa: F401 — keep for future xfail markers
from fastapi.testclient import TestClient

# Disable providers BEFORE importing the app so tests stay fast + deterministic.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")
os.environ.setdefault("VECTOR_INDEX_ENABLED", "0")

from api.main import app  # noqa: E402

client = TestClient(app)

FIXTURE_FASTA = (Path(__file__).parent / "fixtures" / "example.fasta").read_bytes()


# ---------------------------------------------------------------------------
# Content-Type detection
# ---------------------------------------------------------------------------


def test_batch_route_accepts_fasta_by_content_type():
    resp = client.post(
        "/api/predict/batch",
        content=b">s1\nGIGAVLKVLTTGLPALISWIKRKRQQ\n>s2\nAAKKAA\n",
        headers={"Content-Type": "text/x-fasta"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["rows"]) == 2
    assert body["meta"]["runMetadata"]["sequenceSource"] == "fasta"


def test_batch_route_accepts_fasta_via_chemical_subtype_alias():
    """Old bioinformatics tools (and BioPython examples) use
    ``chemical/x-fasta``. Accepted alongside ``text/x-fasta``."""
    resp = client.post(
        "/api/predict/batch",
        content=b">s1\nACDEFG\n",
        headers={"Content-Type": "chemical/x-fasta"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["runMetadata"]["sequenceSource"] == "fasta"


def test_batch_route_sniffs_fasta_body_when_content_type_is_generic():
    """If a script sends ``Content-Type: application/octet-stream`` but the
    body starts with ``>``, treat it as FASTA. Curl users often forget the
    explicit header; PVL is more useful when it tolerates that."""
    resp = client.post(
        "/api/predict/batch",
        content=b">s1\nACDEFG\n",
        headers={"Content-Type": "application/octet-stream"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["runMetadata"]["sequenceSource"] == "fasta"


def test_batch_route_accepts_csv_by_content_type():
    resp = client.post(
        "/api/predict/batch",
        content=b"Entry,Sequence\nA,GIGAVL\nB,AAKKAA\n",
        headers={"Content-Type": "text/csv"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["rows"]) == 2
    assert body["meta"]["runMetadata"]["sequenceSource"] == "csv"


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------


def test_batch_route_415_on_unsupported_content_type():
    resp = client.post(
        "/api/predict/batch",
        content=b"some weird bytes",
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 415
    assert "Unsupported Content-Type" in resp.json()["detail"]


def test_batch_route_400_on_empty_body():
    resp = client.post(
        "/api/predict/batch",
        content=b"",
        headers={"Content-Type": "text/x-fasta"},
    )
    assert resp.status_code == 400
    assert "Empty request body" in resp.json()["detail"]


def test_batch_route_422_on_malformed_fasta():
    """No ``>`` header anywhere → parser raises, route surfaces as 422."""
    resp = client.post(
        "/api/predict/batch",
        content=b"ACDEFG\nKLMN\n",
        headers={"Content-Type": "text/x-fasta"},
    )
    assert resp.status_code == 422
    assert "FASTA" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Invariants — CSV vs FASTA parity, run_metadata round-trip
# ---------------------------------------------------------------------------


def test_batch_fasta_csv_parity_for_same_sequences():
    """CLAUDE.md principle 1: same input sequences → same PVL output rows,
    regardless of input format. The only thing that changes between the
    two responses is ``run_metadata.sequenceSource``."""
    sequences = [("alpha", "GIGAVLKVL"), ("beta", "AAKKAAKK")]

    fasta_body = (
        b"".join(f">{eid}\n{seq}\n".encode() for eid, seq in sequences)
    )
    csv_body = b"Entry,Sequence\n" + b"".join(
        f"{eid},{seq}\n".encode() for eid, seq in sequences
    )

    f_resp = client.post(
        "/api/predict/batch", content=fasta_body, headers={"Content-Type": "text/x-fasta"}
    )
    c_resp = client.post(
        "/api/predict/batch", content=csv_body, headers={"Content-Type": "text/csv"}
    )
    assert f_resp.status_code == 200 and c_resp.status_code == 200

    f_rows = {r["id"]: r for r in f_resp.json()["rows"]}
    c_rows = {r["id"]: r for r in c_resp.json()["rows"]}
    assert set(f_rows.keys()) == set(c_rows.keys()) == {"alpha", "beta"}

    # Compare a deterministic subset of fields that the FF-only pipeline
    # populates without TANGO/S4PRED (which are off in tests).
    for eid in ("alpha", "beta"):
        for field in ("sequence", "length", "ffHelixPercent", "muH", "charge"):
            assert f_rows[eid].get(field) == c_rows[eid].get(field), (
                f"Mismatch on {eid}.{field}: fasta={f_rows[eid].get(field)} "
                f"csv={c_rows[eid].get(field)}"
            )


def test_batch_fasta_run_metadata_round_trip():
    """The run_metadata block under ``meta`` must be present, have the
    canonical PVL field shape, and pin ``sequenceSource=fasta`` for FASTA
    input."""
    resp = client.post(
        "/api/predict/batch",
        content=FIXTURE_FASTA,
        headers={"Content-Type": "text/x-fasta"},
    )
    assert resp.status_code == 200, resp.text
    rm = resp.json()["meta"]["runMetadata"]
    assert rm is not None
    assert rm["sequenceSource"] == "fasta"
    assert rm["pvlVersion"]
    assert "ff_helix" in rm["predictorsUsed"]
    assert "ff_ssw" in rm["predictorsUsed"]
    assert isinstance(rm["datasetId"], str) and len(rm["datasetId"]) > 0


def test_batch_route_processes_example_fixture():
    """The shipped fixture (used in the manual curl in the dispatch report)
    must round-trip 5 known peptides."""
    resp = client.post(
        "/api/predict/batch",
        content=FIXTURE_FASTA,
        headers={"Content-Type": "text/x-fasta"},
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["rows"]
    assert len(rows) == 5
    ids = {r["id"] for r in rows}
    assert ids == {
        "amyloid_beta_1_42",
        "islet_amyloid_polypeptide_iapp",
        "alpha_synuclein_NAC_region",
        "tau_PHF_R3",
        "magainin_2",
    }


# ---------------------------------------------------------------------------
# /api/upload-csv FASTA-source plumbing (existing multipart route, §H.1)
# ---------------------------------------------------------------------------


def test_upload_csv_with_fasta_filename_stamps_fasta_source():
    """A .fasta uploaded via the multipart route must produce
    ``sequenceSource=fasta`` — Wave 2 §H plumbing fix. Previously the route
    hardcoded ``"csv"`` regardless of the actual input format."""
    resp = client.post(
        "/api/upload-csv",
        files={"file": ("seqs.fasta", b">a\nGIGAVL\n>b\nAAKKAA\n", "text/x-fasta")},
    )
    assert resp.status_code == 200, resp.text
    rm = resp.json()["meta"]["runMetadata"]
    assert rm["sequenceSource"] == "fasta"


def test_upload_csv_with_fa_extension_also_stamps_fasta_source():
    resp = client.post(
        "/api/upload-csv",
        files={"file": ("seqs.fa", b">x\nKKKK\n", "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["runMetadata"]["sequenceSource"] == "fasta"


def test_upload_csv_with_csv_extension_keeps_csv_source():
    """Regression — adding the FASTA detection above must not change the
    CSV path."""
    resp = client.post(
        "/api/upload-csv",
        files={"file": ("seqs.csv", b"Entry,Sequence\nA,GIGAVL\n", "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["runMetadata"]["sequenceSource"] == "csv"
