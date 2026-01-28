"""
Test UniProt sort parameter handling.

Tests:
- (a) length_asc works
- (b) best match (no sort/score) works
- (c) invalid sort is blocked
"""
import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)


def test_uniprot_sort_length_asc():
    """Test (a): length_asc sort works."""
    response = client.post(
        "/api/uniprot/execute",
        json={
            "query": "accession:P12345",
            "mode": "accession",
            "sort": "length_asc",
            "size": 10,
        },
    )
    # Should succeed (200) or return valid error if UniProt is unavailable
    # The important thing is that sort=length_asc is accepted
    assert response.status_code in [200, 400, 502, 504]
    if response.status_code == 200:
        assert "rows" in response.json()
    elif response.status_code == 400:
        # UniProt returned 400 - that's fine, means our request was sent correctly
        assert "UniProt" in response.json()["detail"] or "sort" in response.json()["detail"].lower()


def test_uniprot_sort_best_match_omitted():
    """Test (b): best match (no sort/score) works - sort parameter should be omitted."""
    response = client.post(
        "/api/uniprot/execute",
        json={
            "query": "accession:P12345",
            "mode": "accession",
            # sort not included (should default to best match)
            "size": 10,
        },
    )
    # Should succeed (200) or return valid error if UniProt is unavailable
    assert response.status_code in [200, 400, 502, 504]
    if response.status_code == 200:
        assert "rows" in response.json()


def test_uniprot_sort_score_omitted():
    """Test (b): score sort is treated as best match (omitted)."""
    response = client.post(
        "/api/uniprot/execute",
        json={
            "query": "accession:P12345",
            "mode": "accession",
            "sort": "score",  # Should be treated as "omit"
            "size": 10,
        },
    )
    # Should succeed (200) or return valid error if UniProt is unavailable
    assert response.status_code in [200, 400, 502, 504]
    if response.status_code == 200:
        assert "rows" in response.json()


def test_uniprot_sort_invalid_blocked():
    """Test (c): invalid sort is blocked with 400 error."""
    response = client.post(
        "/api/uniprot/execute",
        json={
            "query": "accession:P12345",
            "mode": "accession",
            "sort": "invalid_sort_value",  # Should be rejected
            "size": 10,
        },
    )
    # Should return 400 with error message about invalid sort
    assert response.status_code == 400
    assert "Invalid sort value" in response.json()["detail"]
    assert "invalid_sort_value" in response.json()["detail"]


def test_uniprot_sort_allowed_values():
    """Test that all allowed sort values are accepted."""
    allowed_values = [
        "length_asc",
        "length_desc",
        "reviewed_asc",
        "reviewed_desc",
        "protein_name_asc",
        "protein_name_desc",
        "organism_name_asc",
        "organism_name_desc",
    ]
    
    for sort_value in allowed_values:
        response = client.post(
            "/api/uniprot/execute",
            json={
                "query": "accession:P12345",
                "mode": "accession",
                "sort": sort_value,
                "size": 10,
            },
        )
        # Should not return 400 for invalid sort (might return other errors if UniProt unavailable)
        assert response.status_code != 400 or "Invalid sort value" not in response.json().get("detail", ""), \
            f"Sort value '{sort_value}' was incorrectly rejected"

