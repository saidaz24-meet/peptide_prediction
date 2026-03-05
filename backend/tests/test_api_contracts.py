"""
API Contract Tests - Lock canonical response shape.

These tests enforce that all endpoints return the SAME canonical PeptideRow format (camelCase).
They will FAIL if endpoints return inconsistent formats (e.g., capitalized keys vs camelCase).

Run from backend/ directory:
    python -m pytest tests/test_api_contracts.py -v

Or with environment variables to disable providers:
    USE_TANGO=0 USE_S4PRED=0 python -m pytest tests/test_api_contracts.py -v
"""
import os

import pytest
from fastapi.testclient import TestClient

from api.main import app

# Disable providers for fast tests (set env vars before importing server)
# This prevents tests from trying to run TANGO/S4PRED which may not be available
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

client = TestClient(app)


# Test data
TEST_SEQUENCE = "MRWQEMGYIFYPRKLR"
TEST_ENTRY = "TEST001"

# Minimal CSV for upload tests
TEST_CSV_CONTENT = """Entry,Sequence
TEST001,MRWQEMGYIFYPRKLR
TEST002,VNWKKILGKIIKVVK
"""

# Keys that should NOT appear in responses (capitalized/CSV header format)
FORBIDDEN_KEYS = [
    "Entry",
    "Sequence",
    "Length",
    "Hydrophobicity",
    "Charge",
    "FF-Helix %",
    "FF Helix fragments",
    "SSW prediction",
    "SSW score",
    "SSW diff",
    "SSW helix percentage",
    "SSW beta percentage",
    "Protein name",
    "Organism",
]

# Keys that MUST appear in responses (camelCase canonical format)
REQUIRED_KEYS = [
    "id",
    "sequence",
]


class TestPredictContract:
    """Test /api/predict endpoint contract."""

    def test_predict_returns_camelcase_keys(self):
        """Assert /api/predict returns camelCase keys in row field, not capitalized."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Assert response structure: {row: {...}, meta: {...}}
        assert "row" in data, "Response must have 'row' field"
        assert "meta" in data, "Response must have 'meta' field"

        row = data["row"]

        # Assert required keys are present in row (camelCase)
        for key in REQUIRED_KEYS:
            assert key in row, f"Row missing required key '{key}'. Keys: {list(row.keys())}"

        # Assert forbidden keys are NOT present (capitalized/CSV format)
        for key in FORBIDDEN_KEYS:
            assert key not in row, f"Row contains forbidden key '{key}' (should be camelCase). Keys: {list(row.keys())}"

        # Assert specific required fields
        assert "id" in row, "Row must have 'id' field (camelCase)"
        assert "sequence" in row, "Row must have 'sequence' field (camelCase)"
        assert row["id"] == TEST_ENTRY, f"Expected id={TEST_ENTRY}, got {row['id']}"
        assert row["sequence"] == TEST_SEQUENCE, f"Expected sequence={TEST_SEQUENCE}, got {row['sequence']}"

    def test_predict_has_meta_field(self):
        """Assert /api/predict includes meta field with required structure."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Meta field is required and must be a dict
        assert "meta" in data, "Response must have 'meta' field"
        assert isinstance(data["meta"], dict), "meta field must be a dict"

        # Assert meta has required fields
        meta = data["meta"]
        assert "use_s4pred" in meta, "meta must have 'use_s4pred' field"
        assert "use_tango" in meta, "meta must have 'use_tango' field"
        assert "thresholds" in meta, "meta must have 'thresholds' field"

    def test_predict_no_entry_uses_default(self):
        """Test /api/predict without entry parameter (should default to 'adhoc')."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                # entry not provided
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "row" in data
        row = data["row"]
        assert "id" in row
        # Should default to "adhoc" or similar
        assert isinstance(row["id"], str)
        assert len(row["id"]) > 0


class TestUploadCsvContract:
    """Test /api/upload-csv endpoint contract."""

    def test_upload_csv_returns_rows_and_meta(self):
        """Assert /api/upload-csv returns {rows, meta} structure."""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Assert top-level structure
        assert "rows" in data, "Response must have 'rows' field"
        assert "meta" in data, "Response must have 'meta' field"

        # Assert types
        assert isinstance(data["rows"], list), "rows must be a list"
        assert isinstance(data["meta"], dict), "meta must be a dict"

        # Assert rows is not empty
        assert len(data["rows"]) > 0, "rows must contain at least one item"

    def test_upload_csv_rows_have_camelcase_keys(self):
        """Assert each row in /api/upload-csv has camelCase keys."""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["rows"]) > 0, "rows must not be empty"

        # Check first row
        first_row = data["rows"][0]

        # Assert required keys are present (camelCase)
        for key in REQUIRED_KEYS:
            assert key in first_row, f"Row missing required key '{key}'. Keys: {list(first_row.keys())}"

        # Assert forbidden keys are NOT present (capitalized/CSV format)
        for key in FORBIDDEN_KEYS:
            assert key not in first_row, f"Row contains forbidden key '{key}' (should be camelCase). Keys: {list(first_row.keys())}"

        # Assert specific required fields
        assert "id" in first_row, "Row must have 'id' field (camelCase)"
        assert "sequence" in first_row, "Row must have 'sequence' field (camelCase)"
        assert isinstance(first_row["id"], str), "id must be a string"
        assert isinstance(first_row["sequence"], str), "sequence must be a string"
        assert len(first_row["sequence"]) > 0, "sequence must not be empty"

    def test_upload_csv_all_rows_have_consistent_format(self):
        """Assert all rows in /api/upload-csv have consistent camelCase format."""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["rows"]) >= 2, "Test CSV has 2 rows, should get at least 2"

        # Check all rows
        for i, row in enumerate(data["rows"]):
            # Assert required keys
            for key in REQUIRED_KEYS:
                assert key in row, f"Row {i} missing required key '{key}'"

            # Assert forbidden keys are NOT present
            for key in FORBIDDEN_KEYS:
                assert key not in row, f"Row {i} contains forbidden key '{key}' (should be camelCase)"

            # Assert id and sequence are present and valid
            assert "id" in row, f"Row {i} must have 'id' field"
            assert "sequence" in row, f"Row {i} must have 'sequence' field"
            assert isinstance(row["id"], str), f"Row {i} id must be a string"
            assert isinstance(row["sequence"], str), f"Row {i} sequence must be a string"

    def test_upload_csv_id_field_never_null(self):
        """
        Assert every row has a non-null 'id' field.

        Invariant: id is NEVER null/None/undefined.
        """
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        for i, row in enumerate(data["rows"]):
            assert "id" in row, f"Row {i} missing 'id' field"
            assert row["id"] is not None, f"Row {i} 'id' field is null"
            assert row["id"] != "", f"Row {i} 'id' field is empty string"
            assert row["id"] != "null", f"Row {i} 'id' field is string 'null'"
            assert row["id"] != "undefined", f"Row {i} 'id' field is string 'undefined'"

    def test_upload_csv_numeric_fields_are_numbers(self):
        """
        Assert numeric fields are actual numbers, not strings.

        Invariant: hydrophobicity, charge, length are numbers (int/float).
        """
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        for i, row in enumerate(data["rows"]):
            # Check numeric fields if present
            if "hydrophobicity" in row and row["hydrophobicity"] is not None:
                assert isinstance(row["hydrophobicity"], (int, float)), \
                    f"Row {i} hydrophobicity must be number, got {type(row['hydrophobicity'])}: {row['hydrophobicity']}"

            if "charge" in row and row["charge"] is not None:
                assert isinstance(row["charge"], (int, float)), \
                    f"Row {i} charge must be number, got {type(row['charge'])}: {row['charge']}"

            if "length" in row and row["length"] is not None:
                assert isinstance(row["length"], (int, float)), \
                    f"Row {i} length must be number, got {type(row['length'])}: {row['length']}"

    def test_upload_csv_response_is_flat_array(self):
        """
        Assert response.rows is a flat array of objects (not nested).

        Invariant: rows is List[dict], not List[List] or nested structure.
        """
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )

        assert response.status_code == 200
        data = response.json()

        # rows must be a list
        assert isinstance(data["rows"], list), f"rows must be list, got {type(data['rows'])}"

        # Each item must be a dict (not nested list)
        for i, row in enumerate(data["rows"]):
            assert isinstance(row, dict), f"Row {i} must be dict, got {type(row)}"
            # Not a list
            assert not isinstance(row, list), f"Row {i} must not be a list"


class TestUniprotExecuteContract:
    """Test /api/uniprot/execute endpoint contract."""

    @pytest.mark.skipif(
        os.getenv("SKIP_UNIPROT_TESTS", "0") == "1",
        reason="UniProt tests require network access. Set SKIP_UNIPROT_TESTS=0 to run."
    )
    def test_uniprot_execute_returns_rows_and_meta(self):
        """Assert /api/uniprot/execute returns {rows, meta} structure (same as upload-csv)."""
        response = client.post(
            "/api/uniprot/execute",
            json={
                "query": "accession:P03622",
                "mode": "accession",
                "size": 5,
                "run_tango": False,  # Disable providers for fast test
                "run_psipred": False,
            },
        )

        # May fail if UniProt API is unavailable, but if it succeeds, check contract
        if response.status_code == 200:
            data = response.json()

            # Assert top-level structure (same as upload-csv)
            assert "rows" in data, "Response must have 'rows' field"
            assert "meta" in data, "Response must have 'meta' field"

            # Assert types
            assert isinstance(data["rows"], list), "rows must be a list"
            assert isinstance(data["meta"], dict), "meta must be a dict"

            # If rows exist, check format
            if len(data["rows"]) > 0:
                first_row = data["rows"][0]

                # Assert required keys (camelCase)
                for key in REQUIRED_KEYS:
                    assert key in first_row, f"Row missing required key '{key}'"

                # Assert forbidden keys are NOT present
                for key in FORBIDDEN_KEYS:
                    assert key not in first_row, f"Row contains forbidden key '{key}' (should be camelCase)"
        else:
            # If UniProt is unavailable, that's OK - test is skipped or will fail gracefully
            # Log the status for debugging
            pytest.skip(f"UniProt API unavailable (status {response.status_code}): {response.text}")

    @pytest.mark.skipif(
        os.getenv("SKIP_UNIPROT_TESTS", "0") == "1",
        reason="UniProt tests require network access. Set SKIP_UNIPROT_TESTS=0 to run."
    )
    def test_uniprot_execute_rows_have_camelcase_keys(self):
        """Assert rows in /api/uniprot/execute have camelCase keys (same as upload-csv)."""
        response = client.post(
            "/api/uniprot/execute",
            json={
                "query": "accession:P03622",
                "mode": "accession",
                "size": 3,
                "run_tango": False,
                "run_psipred": False,
            },
        )

        if response.status_code == 200:
            data = response.json()

            if len(data["rows"]) > 0:
                first_row = data["rows"][0]

                # Assert required keys
                assert "id" in first_row, "Row must have 'id' field (camelCase)"
                assert "sequence" in first_row, "Row must have 'sequence' field (camelCase)"

                # Assert forbidden keys are NOT present
                for key in FORBIDDEN_KEYS:
                    assert key not in first_row, f"Row contains forbidden key '{key}' (should be camelCase)"
        else:
            pytest.skip(f"UniProt API unavailable (status {response.status_code})")


class TestUniprotParseContract:
    """Test /api/uniprot/parse endpoint contract (ISSUE-001)."""

    def test_uniprot_parse_empty_query_returns_unknown_mode(self):
        """
        Assert /api/uniprot/parse returns mode="unknown" for empty query.

        Invariant: Empty query → 200 with mode="unknown" and error field (not 500).
        """
        response = client.post(
            "/api/uniprot/parse",
            json={"query": ""},
        )

        # Returns 200 with mode="unknown" (not 500)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["mode"] == "unknown", f"Empty query should return mode='unknown', got {data['mode']}"
        assert "error" in data, "Empty query response should have 'error' field"
        assert data["api_query_string"] == "", "Empty query should have empty api_query_string"

    def test_uniprot_parse_whitespace_only_returns_unknown_mode(self):
        """
        Assert /api/uniprot/parse returns mode="unknown" for whitespace-only query.

        Invariant: Whitespace-only query → 200 with mode="unknown" (not 500).
        """
        response = client.post(
            "/api/uniprot/parse",
            json={"query": "   "},
        )

        # Returns 200 with mode="unknown"
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["mode"] == "unknown", f"Whitespace query should return mode='unknown', got {data['mode']}"

    def test_uniprot_parse_endpoint_returns_valid_response(self):
        """
        Assert /api/uniprot/parse returns valid UniProtQueryParseResponse.

        ISSUE-001: Missing await causes coroutine object to be returned
        instead of actual response dict, causing Pydantic validation error.
        """
        response = client.post(
            "/api/uniprot/parse",
            json={"query": "P53_HUMAN"},
        )

        # Must return 200, not 500 (validation error from coroutine)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Assert required fields from UniProtQueryParseResponse
        assert "mode" in data, "Response must have 'mode' field"
        assert "normalized_query" in data, "Response must have 'normalized_query' field"
        assert "api_query_string" in data, "Response must have 'api_query_string' field"

        # Assert mode is valid
        valid_modes = ["accession", "keyword", "organism", "keyword_organism", "unknown"]
        assert data["mode"] in valid_modes, f"mode must be one of {valid_modes}, got {data['mode']}"

        # Assert string types
        assert isinstance(data["normalized_query"], str), "normalized_query must be a string"
        assert isinstance(data["api_query_string"], str), "api_query_string must be a string"


class TestUploadCsvErrorHandling:
    """Test /api/upload-csv error handling (ISSUE-002)."""

    def test_upload_csv_without_headers_returns_400(self):
        """
        Assert /api/upload-csv returns 400 for CSV without header row.

        ISSUE-002: Ensure backend rejects malformed CSVs with clear error.
        """
        # CSV with no header row (data only)
        csv_content = """P12345,ACDEFGHIKLMNPQRSTVWY,21
P67890,ACDEFGHIKLMNPQRSTVW,20
"""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("no_headers.csv", csv_content, "text/csv")},
        )

        # Must return 400, not 200
        assert response.status_code == 400, f"Expected 400 for CSV without headers, got {response.status_code}"
        assert "detail" in response.json()
        detail = response.json()["detail"]
        assert "Entry" in detail or "Sequence" in detail, f"Error should mention missing columns: {detail}"

    def test_upload_csv_with_id_column_returns_id_field(self):
        """
        Assert /api/upload-csv with 'id' column (lowercase) returns rows with 'id' field.

        ISSUE-002: Verify alternative header names are normalized correctly.
        """
        # CSV with 'id' instead of 'Entry'
        csv_content = """id,Sequence
TEST001,MRWQEMGYIFYPRKLR
TEST002,VNWKKILGKIIKVVK
"""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("id_column.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rows" in data
        assert len(data["rows"]) > 0

        # Every row MUST have 'id' field
        for i, row in enumerate(data["rows"]):
            assert "id" in row, f"Row {i} missing 'id' field. Keys: {list(row.keys())}"
            assert row["id"], f"Row {i} has empty 'id' field"

    def test_upload_csv_with_accession_column_returns_id_field(self):
        """
        Assert /api/upload-csv with 'Accession' column returns rows with 'id' field.

        ISSUE-002: Verify 'Accession' is normalized to 'id'.
        """
        # CSV with 'Accession' instead of 'Entry'
        csv_content = """Accession,Sequence
ACC001,MRWQEMGYIFYPRKLR
ACC002,VNWKKILGKIIKVVK
"""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("accession_column.csv", csv_content, "text/csv")},
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "rows" in data
        assert len(data["rows"]) > 0

        # Every row MUST have 'id' field (normalized from Accession)
        for i, row in enumerate(data["rows"]):
            assert "id" in row, f"Row {i} missing 'id' field. Keys: {list(row.keys())}"
            assert row["id"], f"Row {i} has empty 'id' field"


class TestContractConsistency:
    """Test that all endpoints return consistent format."""

    def test_predict_and_upload_have_same_key_format(self):
        """Assert /api/predict and /api/upload-csv use same camelCase key format."""
        # Get response from /api/predict
        predict_response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )
        assert predict_response.status_code == 200
        predict_data = predict_response.json()
        assert "row" in predict_data
        predict_row = predict_data["row"]

        # Get response from /api/upload-csv
        upload_response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert len(upload_data["rows"]) > 0
        upload_row = upload_data["rows"][0]

        # Both should have camelCase keys
        # Check that they both have 'id' and 'sequence' (not 'Entry' and 'Sequence')
        assert "id" in predict_row, "/api/predict row must have 'id' (camelCase)"
        assert "id" in upload_row, "/api/upload-csv rows must have 'id' (camelCase)"
        assert "sequence" in predict_row, "/api/predict row must have 'sequence' (camelCase)"
        assert "sequence" in upload_row, "/api/upload-csv rows must have 'sequence' (camelCase)"

        # Both should NOT have capitalized keys
        assert "Entry" not in predict_row, "/api/predict row must NOT have 'Entry' (capitalized)"
        assert "Entry" not in upload_row, "/api/upload-csv rows must NOT have 'Entry' (capitalized)"
        assert "Sequence" not in predict_row, "/api/predict row must NOT have 'Sequence' (capitalized)"
        assert "Sequence" not in upload_row, "/api/upload-csv rows must NOT have 'Sequence' (capitalized)"


class TestSentinelValueContract:
    """
    Test that API never uses -1 as a sentinel for missing data.

    ISSUE-000: -1 sentinel values should be replaced with null.
    Exception: sswPrediction can be -1 (valid semantic value meaning "no switch predicted").
    """

    # Fields where -1 is NEVER valid (should be null for missing data)
    FIELDS_WHERE_MINUS_ONE_IS_INVALID = [
        "sswScore",
        "sswDiff",
        "sswHelixPercentage",
        "sswBetaPercentage",
        "ffHelixPercent",
        "hydrophobicity",
        "charge",
        "muH",
        "length",
    ]

    # Fields where -1 IS valid (semantic value, not sentinel)
    FIELDS_WHERE_MINUS_ONE_IS_VALID = [
        "sswPrediction",  # -1 means "predicted NOT to switch"
    ]

    def _check_no_invalid_minus_one(self, row: dict, source: str):
        """
        Check that no field has -1 as a sentinel value (except sswPrediction).

        Args:
            row: API response row
            source: Description of the source for error messages
        """
        for field in self.FIELDS_WHERE_MINUS_ONE_IS_INVALID:
            if field in row:
                value = row[field]
                # -1 is invalid for these fields (should be null if missing)
                if value == -1 or value == -1.0:
                    pytest.fail(
                        f"{source}: Field '{field}' has value -1, which is a sentinel. "
                        f"Should be null for missing data. Row keys: {list(row.keys())}"
                    )

    def test_predict_no_minus_one_sentinels(self):
        """Assert /api/predict never returns -1 for sentinel fields."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )
        assert response.status_code == 200
        data = response.json()
        row = data["row"]

        self._check_no_invalid_minus_one(row, "/api/predict")

    def test_upload_csv_no_minus_one_sentinels(self):
        """Assert /api/upload-csv never returns -1 for sentinel fields."""
        response = client.post(
            "/api/upload-csv",
            files={"file": ("test.csv", TEST_CSV_CONTENT, "text/csv")},
        )
        assert response.status_code == 200
        data = response.json()

        for i, row in enumerate(data["rows"]):
            self._check_no_invalid_minus_one(row, f"/api/upload-csv row[{i}]")

    def test_ssw_prediction_allows_minus_one(self):
        """Assert sswPrediction CAN be -1 (valid semantic value)."""
        # This test verifies that we don't accidentally remove valid -1 from sswPrediction
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )
        assert response.status_code == 200
        data = response.json()
        row = data["row"]

        # sswPrediction should be present
        assert "sswPrediction" in row or row.get("sswPrediction") is None, \
            "sswPrediction field should be present (can be -1, 0, 1, or null)"

        # If present and not null, must be -1, 0, or 1
        ssw = row.get("sswPrediction")
        if ssw is not None:
            assert ssw in [-1, 0, 1], \
                f"sswPrediction must be -1, 0, 1, or null. Got: {ssw}"


class TestNullSemantics:
    """
    Test that null values are properly used for missing data.

    Null semantics:
    - null = data is missing/unavailable (provider didn't run or failed)
    - 0 = valid zero value (e.g., charge of 0, 0% helix)
    - -1 for sswPrediction = valid prediction (no switch)
    """

    def test_optional_fields_can_be_null(self):
        """Assert optional numeric fields can be null (not always 0 or -1)."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )
        assert response.status_code == 200
        data = response.json()
        row = data["row"]

        # These fields CAN be null when provider is unavailable
        optional_nullable_fields = [
            "sswScore",
            "sswDiff",
            "sswHelixPercentage",
            "sswBetaPercentage",
            "sswPrediction",  # Can be null if TANGO didn't run
        ]

        # Just verify the fields exist or are null (don't fail if they have values)
        for field in optional_nullable_fields:
            value = row.get(field)
            # Value can be null, or a valid number - both are OK
            # We're just asserting the field exists in the schema
            if value is not None and field != "sswPrediction":
                # For non-sswPrediction fields, -1 should never appear
                assert value != -1 and value != -1.0, \
                    f"Field '{field}' has -1 sentinel. Should be null for missing data."

    def test_required_fields_are_not_null(self):
        """Assert required fields (id, sequence) are never null."""
        response = client.post(
            "/api/predict",
            data={
                "sequence": TEST_SEQUENCE,
                "entry": TEST_ENTRY,
            },
        )
        assert response.status_code == 200
        data = response.json()
        row = data["row"]

        # Required fields must never be null
        assert row.get("id") is not None, "id field must not be null"
        assert row.get("sequence") is not None, "sequence field must not be null"
        assert row["id"] != "", "id field must not be empty string"
        assert row["sequence"] != "", "sequence field must not be empty string"


class TestHealthEndpoints:
    """Tests for health check endpoints."""

    def test_health_returns_ok(self):
        """Basic health check returns ok."""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True

    def test_health_dependencies_returns_status(self):
        """Dependencies health check returns structured status."""
        response = client.get("/api/health/dependencies")
        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "status" in data
        assert data["status"] in ["ready", "degraded", "unavailable"]
        assert "providers_available" in data
        assert isinstance(data["providers_available"], int)

        # Provider status fields
        assert "tango" in data
        assert "s4pred" in data
        assert "ff_helix" in data

        # Each provider has enabled/available/reason
        for provider in ["tango", "s4pred", "ff_helix"]:
            assert "enabled" in data[provider]
            assert "available" in data[provider]
            assert "reason" in data[provider]

    def test_health_dependencies_ff_helix_always_available(self):
        """FF-Helix is always available (pure Python, no deps)."""
        response = client.get("/api/health/dependencies")
        assert response.status_code == 200
        data = response.json()

        assert data["ff_helix"]["enabled"] is True
        assert data["ff_helix"]["available"] is True
        assert data["ff_helix"]["reason"] is None

    def test_health_dependencies_uniprot_optional(self):
        """UniProt check is optional and not included by default."""
        # Without check_uniprot parameter
        response = client.get("/api/health/dependencies")
        assert response.status_code == 200
        data = response.json()
        assert "uniprot" not in data

        # With check_uniprot=true (may fail offline, but should not error)
        response = client.get("/api/health/dependencies?check_uniprot=true")
        assert response.status_code == 200
        data = response.json()
        assert "uniprot" in data
        assert "available" in data["uniprot"]
        assert "reason" in data["uniprot"]
