"""Tests for the 7 MCP tools registered by ``pvl_mcp.tools``.

These tests stand up a fake FastMCP and a fake httpx client (see conftest)
so we can drive every tool's coroutine directly without needing the real
SDK or a running PVL backend.
"""

from __future__ import annotations

import csv
import io
import json

import pytest

from pvl_mcp.tools import TOOL_NAMES


def test_all_seven_tools_register(registered_tools):
    """Every documented tool name must register with FastMCP.

    Pin the surface so a future contributor can't silently drop one — the
    PVL ↔ MCP API contract is the seven tools listed in MCP_RUNBOOK.md.
    """
    assert set(registered_tools.keys()) == set(TOOL_NAMES)
    assert len(TOOL_NAMES) == 7


# ---------------------------------------------------------------------------
# search_uniprot
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_uniprot_posts_to_execute(registered_tools, fake_client):
    fake_client.response = {"rows": [{"id": "P0C1Q4", "Sequence": "GIGAVL"}], "stats": {}}
    result = await registered_tools["search_uniprot"](
        query="amyloid",
        organism_id="1280",
        length_min=10,
        length_max=50,
        reviewed=True,
        max_results=25,
        run_tango=False,
        run_s4pred=False,
    )

    assert result == fake_client.response
    assert len(fake_client.calls) == 1
    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/uniprot/execute"
    payload = call["json"]
    assert payload["query"] == "amyloid"
    assert payload["organism_id"] == "1280"
    assert payload["length_min"] == 10
    assert payload["length_max"] == 50
    assert payload["reviewed"] is True
    assert payload["size"] == 25
    assert payload["run_tango"] is False
    assert payload["run_s4pred"] is False


@pytest.mark.asyncio
async def test_search_uniprot_omits_optional_filters_when_unset(
    registered_tools, fake_client
):
    await registered_tools["search_uniprot"](query="P0C1Q4")
    payload = fake_client.calls[0]["json"]
    assert "organism_id" not in payload
    assert "length_min" not in payload
    assert "length_max" not in payload


# ---------------------------------------------------------------------------
# analyze_sequences
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_analyze_sequences_single_uses_predict_form(
    registered_tools, fake_client
):
    fake_client.response = {"rows": [{"id": "demo", "Sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ"}]}

    await registered_tools["analyze_sequences"](
        sequences=[{"id": "demo", "sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ"}],
    )

    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/predict"
    assert call["data"] == {"sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ", "entry": "demo"}
    assert call["files"] is None


@pytest.mark.asyncio
async def test_analyze_sequences_batch_uses_upload_csv(registered_tools, fake_client):
    fake_client.response = {"rows": [], "stats": {}}

    await registered_tools["analyze_sequences"](
        sequences=[
            {"id": "a", "sequence": "GIGAVL"},
            {"id": "b", "sequence": "AAKKAA"},
        ],
    )

    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/upload-csv"
    assert call["data"] is None  # no thresholds
    files = call["files"]
    assert files is not None
    name, body, mime = files["file"]
    assert name == "pvl_mcp_batch.csv"
    assert mime == "text/csv"
    rows = list(csv.DictReader(io.StringIO(body.decode("utf-8"))))
    assert rows == [
        {"Entry": "a", "Sequence": "GIGAVL"},
        {"Entry": "b", "Sequence": "AAKKAA"},
    ]


@pytest.mark.asyncio
async def test_analyze_sequences_threshold_config_passed_through(
    registered_tools, fake_client
):
    cfg = {"DEFAULT_AGG_THRESHOLD": 5.0}
    await registered_tools["analyze_sequences"](
        sequences=[{"id": "x", "sequence": "AAAA"}],
        threshold_config=cfg,
    )
    assert fake_client.calls[0]["data"]["thresholdConfig"] == json.dumps(cfg)


@pytest.mark.asyncio
async def test_analyze_sequences_empty_returns_empty_without_calling_backend(
    registered_tools, fake_client
):
    out = await registered_tools["analyze_sequences"](sequences=[])
    assert out == {"rows": [], "stats": {"row_count": 0}}
    assert fake_client.calls == []


# ---------------------------------------------------------------------------
# get_peptide_detail / rank_candidates / compare_cohorts / find_similar_peptides
# (backend endpoints not yet implemented — assert correct path + payload shape.)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_peptide_detail_calls_get_with_accession(
    registered_tools, fake_client
):
    fake_client.response = {"id": "P0C1Q4"}
    await registered_tools["get_peptide_detail"](accession="P0C1Q4")
    call = fake_client.calls[0]
    assert call["method"] == "GET"
    assert call["path"] == "/api/peptide/P0C1Q4"


@pytest.mark.asyncio
async def test_rank_candidates_with_sequences(registered_tools, fake_client):
    seqs = [{"id": "a", "ffHelixFlag": 1}]
    await registered_tools["rank_candidates"](
        sequences=seqs, preset="helix-focus", top_n=5
    )
    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/rank"
    assert call["json"] == {"preset": "helix-focus", "top_n": 5, "sequences": seqs}


@pytest.mark.asyncio
async def test_rank_candidates_with_dataset_id(registered_tools, fake_client):
    await registered_tools["rank_candidates"](
        dataset_id="ds-123", preset="equal", weights={"helix": 1.0}
    )
    call = fake_client.calls[0]
    assert call["json"] == {
        "preset": "equal",
        "top_n": 10,
        "dataset_id": "ds-123",
        "weights": {"helix": 1.0},
    }


@pytest.mark.asyncio
async def test_rank_candidates_rejects_both_inputs(registered_tools, fake_client):
    from pvl_mcp._client import PVLAPIError

    with pytest.raises(PVLAPIError):
        await registered_tools["rank_candidates"](
            sequences=[{"id": "a"}], dataset_id="ds-1"
        )
    assert fake_client.calls == []


@pytest.mark.asyncio
async def test_rank_candidates_rejects_neither_input(registered_tools, fake_client):
    from pvl_mcp._client import PVLAPIError

    with pytest.raises(PVLAPIError):
        await registered_tools["rank_candidates"]()
    assert fake_client.calls == []


@pytest.mark.asyncio
async def test_compare_cohorts_posts_both_lists(registered_tools, fake_client):
    a = [{"id": "x"}]
    b = [{"id": "y"}]
    await registered_tools["compare_cohorts"](
        cohort_a=a, cohort_b=b, label_a="Mut", label_b="WT"
    )
    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/compare"
    assert call["json"] == {
        "cohort_a": a,
        "cohort_b": b,
        "label_a": "Mut",
        "label_b": "WT",
    }


@pytest.mark.asyncio
async def test_find_similar_peptides_posts_reference_and_k(
    registered_tools, fake_client
):
    await registered_tools["find_similar_peptides"](
        reference_sequence="GIGAVLKVLTTGLPALISWIKRKRQQ", k=15
    )
    call = fake_client.calls[0]
    assert call["method"] == "POST"
    assert call["path"] == "/api/peptides/similar"
    assert call["json"] == {
        "reference_sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ",
        "k": 15,
    }


# ---------------------------------------------------------------------------
# get_pvl_version
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_pvl_version_calls_version_endpoint(registered_tools, fake_client):
    fake_client.response = {"version": "0.1.0", "build_sha": "abc1234"}
    out = await registered_tools["get_pvl_version"]()
    assert out == fake_client.response
    call = fake_client.calls[0]
    assert call["method"] == "GET"
    assert call["path"] == "/api/version"
