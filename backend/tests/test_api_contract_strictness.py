"""
Wave B (B.5) — API contract strictness regression tests.

Source: docs/active/UNIPROT_TIMEOUT_INVESTIGATION.md (root cause #4) +
        T2-INSTRUCTIONS.md Wave B (B.1, B.2).

Two invariants this file pins:

1.  Every request schema rejects unknown fields with HTTP 422 (Pydantic v2
    `extra="forbid"`). This is the systemic fix for the silent contract bug
    where the user's curl ``"max_results": 5`` was dropped on the floor.

2.  ``UniProtQueryExecuteRequest`` accepts both the canonical snake_case names
    AND a documented set of camelCase / legacy aliases (``max_results``,
    ``maxResults``, ``runTango``, ``runS4pred``, ``lengthMin``, ``lengthMax``,
    ``includeIsoforms``, ``maxProviderSequences``) via ``AliasChoices``.
"""

from __future__ import annotations

import os
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

# Disable providers before importing the FastAPI app so request handlers can
# be exercised without running TANGO/S4PRED.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

from api.main import app  # noqa: E402
from schemas.feedback import FeedbackRequest  # noqa: E402
from schemas.uniprot_query import (  # noqa: E402
    UniProtQueryExecuteRequest,
    UniProtQueryParseRequest,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1) Schema-level: extra="forbid" rejects unknown fields on all request models
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "schema_cls,base_payload",
    [
        (UniProtQueryExecuteRequest, {"query": "amyloid"}),
        (UniProtQueryParseRequest, {"query": "amyloid"}),
        (FeedbackRequest, {"message": "hi"}),
    ],
    ids=lambda v: getattr(v, "__name__", str(v)[:30]),
)
def test_request_schema_rejects_unknown_field(
    schema_cls: type, base_payload: Dict[str, Any]
) -> None:
    """A typo in a request body must surface as a ValidationError, not be silently dropped."""
    bad = {**base_payload, "bogus_field_does_not_exist": True}
    with pytest.raises(ValidationError) as excinfo:
        schema_cls.model_validate(bad)
    err = str(excinfo.value).lower()
    assert "extra" in err or "bogus_field_does_not_exist" in err, (
        f"{schema_cls.__name__} should reject unknown field with a clear message; got: {excinfo.value}"
    )


# ---------------------------------------------------------------------------
# 2) HTTP-level: same invariant via the live FastAPI app (returns 422)
# ---------------------------------------------------------------------------


def test_uniprot_execute_unknown_field_returns_422() -> None:
    """The route should reject unknown fields with HTTP 422 instead of silently ignoring."""
    response = client.post(
        "/api/uniprot/execute",
        json={"query": "amyloid", "totally_made_up_field": 99},
    )
    assert response.status_code == 422, response.text
    body = response.json()
    detail = str(body).lower()
    assert "totally_made_up_field" in detail or "extra" in detail, (
        f"422 response should name the offending field; got: {body}"
    )


def test_feedback_unknown_field_returns_422() -> None:
    response = client.post(
        "/api/feedback",
        json={"message": "hello", "totally_made_up_field": "x"},
    )
    assert response.status_code == 422, response.text


# ---------------------------------------------------------------------------
# 3) UniProtQueryExecuteRequest — alias coverage
#    Every alias must route to the canonical snake_case attribute.
# ---------------------------------------------------------------------------


def test_size_canonical_name_works() -> None:
    """Canonical 'size' field still works after AliasChoices wiring."""
    m = UniProtQueryExecuteRequest.model_validate({"query": "amyloid", "size": 3})
    assert m.size == 3


def test_max_results_alias_routes_to_size() -> None:
    """The headline silent-contract fix: 'max_results' → size."""
    m = UniProtQueryExecuteRequest.model_validate({"query": "amyloid", "max_results": 5})
    assert m.size == 5


def test_max_results_camelcase_alias_routes_to_size() -> None:
    """camelCase variant 'maxResults' is also accepted."""
    m = UniProtQueryExecuteRequest.model_validate({"query": "amyloid", "maxResults": 7})
    assert m.size == 7


@pytest.mark.parametrize(
    "alias_payload,attr,expected",
    [
        ({"run_tango": True}, "run_tango", True),
        ({"runTango": True}, "run_tango", True),
        ({"run_s4pred": True}, "run_s4pred", True),
        ({"runS4pred": True}, "run_s4pred", True),
        ({"length_min": 10}, "length_min", 10),
        ({"lengthMin": 10}, "length_min", 10),
        ({"length_max": 50}, "length_max", 50),
        ({"lengthMax": 50}, "length_max", 50),
        ({"include_isoforms": True}, "include_isoforms", True),
        ({"includeIsoforms": True}, "include_isoforms", True),
        ({"max_provider_sequences": 25}, "max_provider_sequences", 25),
        ({"maxProviderSequences": 25}, "max_provider_sequences", 25),
    ],
    ids=lambda v: str(v)[:60],
)
def test_alias_choices_route_to_canonical_attr(
    alias_payload: Dict[str, Any], attr: str, expected: Any
) -> None:
    """Each AliasChoices entry must populate the canonical snake_case attribute."""
    m = UniProtQueryExecuteRequest.model_validate({"query": "amyloid", **alias_payload})
    assert getattr(m, attr) == expected


# ---------------------------------------------------------------------------
# 4) HTTP-level: live route accepts the silently-dropped 'max_results'
# ---------------------------------------------------------------------------


def test_uniprot_execute_max_results_does_not_422() -> None:
    """
    The user's literal curl payload must no longer be silently dropped.

    With Wave B (B.2), 'max_results' is an explicit alias for 'size'. We can't
    assert the upstream UniProt response in unit tests (network), so we just
    assert the request validates: any non-422 response means the field is no
    longer being silently dropped (it's been recognised and routed to size).
    """
    response = client.post(
        "/api/uniprot/execute",
        json={"query": "amyloid", "max_results": 1, "run_tango": False, "run_s4pred": False},
    )
    assert response.status_code != 422, (
        f"max_results alias should be accepted (Wave B B.2); got {response.status_code}: {response.text}"
    )
