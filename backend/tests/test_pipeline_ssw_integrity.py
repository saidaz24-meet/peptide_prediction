"""
Comprehensive pipeline integrity test for SSW prediction flow.

Tests the FULL data path:
  DataFrame → filter_by_avg_diff → normalize_rows_for_ui → API response

Ensures that:
  1. Successfully parsed TANGO entries → sswPrediction is -1 or 1 (never null)
  2. TANGO attempted but empty output → sswPrediction is -1 (never null)
  3. TANGO not attempted → sswPrediction is absent (null/missing in API)
  4. Mixed batch: all 3 scenarios produce correct API responses
  5. Normalize layer doesn't drop valid SSW predictions
  6. The _sanitize_for_json function preserves -1 for prediction fields
"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import tango
from services.normalize import (
    _sanitize_for_json,
    normalize_rows_for_ui,
)
from services.provider_tracking import create_provider_status_for_row


def _build_mock_tango_dataframe(n_ok=5, n_empty=2, n_norun=1):
    """
    Build a DataFrame simulating post-TANGO processing:
    - n_ok entries: Valid TANGO output (helix/beta percentages, curves)
    - n_empty entries: TANGO attempted but empty output (Tango attempted=True)
    - n_norun entries: TANGO not attempted (no data at all)
    """
    rows = []

    for i in range(n_ok):
        rows.append({
            "Entry": f"OK_{i:03d}",
            "Sequence": "AAGGVVLLIIAA" * 2,  # 24-aa peptide
            "Length": 24,
            "Hydrophobicity": 0.5 + i * 0.1,
            "Charge": float(i),
            "Full length uH": 0.3 + i * 0.05,
            "FF-Helix %": 50.0 + i,
            "FF Helix fragments": [[0, 5]],
            "SSW fragments": [[2, 8]] if i % 2 == 0 else "-",
            "SSW score": 0.5 + i * 0.1 if i % 2 == 0 else None,
            "SSW diff": 0.1 * i if i % 2 == 0 else None,
            "SSW helix percentage": 30.0 + i * 5,
            "SSW beta percentage": 20.0 + i * 3,
            "Tango Beta curve": [0.1, 0.2, 0.15] * 8,
            "Tango Helix curve": [0.3, 0.25, 0.4] * 8,
            "Tango Turn curve": [0.05, 0.1, 0.08] * 8,
            "Tango Aggregation curve": [0.02, 0.05, 0.03] * 8,
            "Tango has data": True,
            "Tango attempted": False,
            "Tango Aggregation max": 0.05 + i * 0.01,
            "Tango Beta max": 0.2 + i * 0.05,
            "Tango Helix max": 0.4 + i * 0.03,
        })

    for i in range(n_empty):
        rows.append({
            "Entry": f"EMPTY_{i:03d}",
            "Sequence": "KVFGRCELAAAM" * 2,
            "Length": 24,
            "Hydrophobicity": 0.4,
            "Charge": 2.0,
            "Full length uH": 0.2,
            "FF-Helix %": 40.0,
            "FF Helix fragments": [],
            "SSW fragments": "-",
            "SSW score": None,
            "SSW diff": None,
            "SSW helix percentage": None,
            "SSW beta percentage": None,
            "Tango Beta curve": [],
            "Tango Helix curve": [],
            "Tango Turn curve": [],
            "Tango Aggregation curve": [],
            "Tango has data": False,
            "Tango attempted": True,  # KEY: TANGO ran but output was empty
            "Tango Aggregation max": None,
            "Tango Beta max": None,
            "Tango Helix max": None,
        })

    for i in range(n_norun):
        rows.append({
            "Entry": f"NORUN_{i:03d}",
            "Sequence": "MKTAYIAK" * 3,
            "Length": 24,
            "Hydrophobicity": 0.3,
            "Charge": 1.0,
            "Full length uH": 0.15,
            "FF-Helix %": 30.0,
            "FF Helix fragments": [],
            "SSW fragments": "-",
            "SSW score": None,
            "SSW diff": None,
            "SSW helix percentage": None,
            "SSW beta percentage": None,
            "Tango Beta curve": [],
            "Tango Helix curve": [],
            "Tango Turn curve": [],
            "Tango Aggregation curve": [],
            "Tango has data": False,
            "Tango attempted": False,  # TANGO didn't run at all
            "Tango Aggregation max": None,
            "Tango Beta max": None,
            "Tango Helix max": None,
        })

    return pd.DataFrame(rows)


def _is_missing(val):
    """Check if a value is missing (None or NaN)."""
    if val is None:
        return True
    try:
        return pd.isna(val)
    except (TypeError, ValueError):
        return False


class TestFilterByAvgDiffIntegrity:
    """Test that filter_by_avg_diff produces correct predictions for all scenarios."""

    def test_ok_entries_get_valid_prediction(self):
        """Entries with valid TANGO data → sswPrediction is 1 or -1."""
        df = _build_mock_tango_dataframe(n_ok=10, n_empty=0, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        for _idx, row in df.iterrows():
            pred = row["SSW prediction"]
            entry = row["Entry"]
            assert not _is_missing(pred), f"{entry}: expected valid prediction, got {pred}"
            assert pred in (1, -1), f"{entry}: expected 1 or -1, got {pred}"

    def test_empty_output_entries_get_minus_one(self):
        """Entries where TANGO attempted but empty → sswPrediction is -1."""
        df = _build_mock_tango_dataframe(n_ok=0, n_empty=5, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        for _idx, row in df.iterrows():
            pred = row["SSW prediction"]
            entry = row["Entry"]
            assert pred == -1, f"{entry}: TANGO attempted but empty → expected -1, got {pred}"

    def test_norun_entries_get_missing(self):
        """Entries where TANGO didn't run → sswPrediction is None/NaN."""
        df = _build_mock_tango_dataframe(n_ok=0, n_empty=0, n_norun=5)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        for _idx, row in df.iterrows():
            pred = row["SSW prediction"]
            entry = row["Entry"]
            assert _is_missing(pred), f"{entry}: TANGO not run → expected missing, got {pred}"

    def test_mixed_batch_69_peptides(self):
        """Simulate the 69-peptide scenario: 66 OK, 3 bad output."""
        df = _build_mock_tango_dataframe(n_ok=66, n_empty=3, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        ok_entries = df[df["Entry"].str.startswith("OK_")]
        empty_entries = df[df["Entry"].str.startswith("EMPTY_")]

        # All OK entries should have valid predictions
        for _idx, row in ok_entries.iterrows():
            pred = row["SSW prediction"]
            assert not _is_missing(pred), f"{row['Entry']}: expected valid, got {pred}"

        # All empty entries should be -1 (not Missing)
        for _idx, row in empty_entries.iterrows():
            pred = row["SSW prediction"]
            assert pred == -1, f"{row['Entry']}: expected -1, got {pred}"

    def test_mixed_with_norun(self):
        """66 OK + 2 empty + 1 norun → 68 valid predictions, 1 Missing."""
        df = _build_mock_tango_dataframe(n_ok=66, n_empty=2, n_norun=1)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        valid_count = 0
        missing_count = 0
        for _idx, row in df.iterrows():
            pred = row["SSW prediction"]
            if _is_missing(pred):
                missing_count += 1
            else:
                valid_count += 1
                assert pred in (1, -1)

        assert valid_count == 68, f"Expected 68 valid predictions, got {valid_count}"
        assert missing_count == 1, f"Expected 1 missing, got {missing_count}"


class TestNormalizePipelineIntegrity:
    """Test that normalize_rows_for_ui preserves SSW predictions correctly."""

    def test_ok_entries_normalized(self):
        """Entries with valid TANGO data → sswPrediction present in API response."""
        df = _build_mock_tango_dataframe(n_ok=5, n_empty=0, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        rows = normalize_rows_for_ui(df, is_single_row=False, tango_enabled=True, s4pred_enabled=False)

        for row in rows:
            entry = row.get("id", "?")
            ssw = row.get("sswPrediction")
            assert ssw is not None, f"{entry}: sswPrediction should not be None after normalize"
            assert ssw in (-1, 0, 1), f"{entry}: sswPrediction={ssw}, expected -1/0/1"

    def test_empty_output_entries_normalized(self):
        """TANGO attempted but empty → sswPrediction = -1 in API response."""
        df = _build_mock_tango_dataframe(n_ok=0, n_empty=3, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        rows = normalize_rows_for_ui(df, is_single_row=False, tango_enabled=True, s4pred_enabled=False)

        for row in rows:
            entry = row.get("id", "?")
            ssw = row.get("sswPrediction")
            # After the Tango attempted fix, these should have sswPrediction = -1
            assert ssw == -1, f"{entry}: expected sswPrediction=-1 (TANGO attempted, empty), got {ssw}"

    def test_norun_entries_normalized(self):
        """TANGO not run → sswPrediction absent or null in API response."""
        df = _build_mock_tango_dataframe(n_ok=0, n_empty=0, n_norun=3)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        rows = normalize_rows_for_ui(df, is_single_row=False, tango_enabled=True, s4pred_enabled=False)

        for row in rows:
            entry = row.get("id", "?")
            ssw = row.get("sswPrediction")
            # sswPrediction should be absent (exclude_none=True in PeptideSchema) or null
            assert ssw is None, f"{entry}: expected sswPrediction=None (TANGO not run), got {ssw}"

    def test_full_69_batch_normalized(self):
        """Full 69-peptide batch: every OK/attempted entry has sswPrediction in response."""
        df = _build_mock_tango_dataframe(n_ok=66, n_empty=3, n_norun=0)
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        rows = normalize_rows_for_ui(df, is_single_row=False, tango_enabled=True, s4pred_enabled=False)

        assert len(rows) == 69, f"Expected 69 rows, got {len(rows)}"

        missing_count = 0
        valid_count = 0
        for row in rows:
            ssw = row.get("sswPrediction")
            if ssw is None:
                missing_count += 1
            else:
                valid_count += 1
                assert ssw in (-1, 0, 1), f"sswPrediction={ssw}, expected -1/0/1"

        assert valid_count == 69, f"Expected 69 valid sswPredictions (66 OK + 3 attempted), got {valid_count}"
        assert missing_count == 0, f"Expected 0 missing sswPredictions, got {missing_count}"


class TestSanitizeForJson:
    """Test _sanitize_for_json preserves prediction fields."""

    def test_ssw_prediction_minus_one_preserved(self):
        """sswPrediction = -1 should be preserved (not converted to None)."""
        data = {"sswPrediction": -1, "sswScore": -1, "someOther": -1}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] == -1, "sswPrediction=-1 must be preserved"
        assert result["sswScore"] is None, "sswScore=-1 should be converted to None"
        assert result["someOther"] is None, "non-prediction -1 should be converted to None"

    def test_ssw_prediction_one_preserved(self):
        """sswPrediction = 1 should be preserved."""
        data = {"sswPrediction": 1}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] == 1

    def test_all_prediction_fields_preserved(self):
        """All prediction fields with -1 should be preserved."""
        prediction_fields = {
            "sswPrediction": -1,
            "s4predSswPrediction": -1,
            "s4predHelixPrediction": -1,
            "ffHelixFlag": -1,
            "ffSswFlag": -1,
        }
        result = _sanitize_for_json(prediction_fields)
        for key, val in prediction_fields.items():
            assert result[key] == val, f"{key}=-1 must be preserved, got {result[key]}"


class TestProviderStatusDetection:
    """Test that provider status correctly detects TANGO availability."""

    def test_valid_ssw_prediction_detected(self):
        """Row with SSW prediction = -1 → TANGO available."""
        row = pd.Series({
            "SSW prediction": -1,
            "SSW score": None,
            "SSW fragments": "-",
            "SSW helix percentage": 30.0,
            "SSW beta percentage": 20.0,
        })
        status = create_provider_status_for_row(
            row, tango_enabled=True, s4pred_enabled=False,
            tango_output_available=True, s4pred_output_available=False,
        )
        assert status.tango.status == "AVAILABLE", f"Expected AVAILABLE, got {status.tango.status}"

    def test_null_ssw_prediction_unavailable(self):
        """Row with SSW prediction = None → TANGO unavailable."""
        row = pd.Series({
            "SSW prediction": None,
            "SSW score": None,
            "SSW fragments": "-",
            "SSW helix percentage": None,
            "SSW beta percentage": None,
        })
        status = create_provider_status_for_row(
            row, tango_enabled=True, s4pred_enabled=False,
            tango_output_available=False, s4pred_output_available=False,
        )
        assert status.tango.status == "UNAVAILABLE", f"Expected UNAVAILABLE, got {status.tango.status}"

    def test_nan_ssw_prediction_unavailable(self):
        """Row with SSW prediction = NaN → TANGO unavailable."""
        row = pd.Series({
            "SSW prediction": float("nan"),
            "SSW score": None,
            "SSW fragments": "-",
            "SSW helix percentage": None,
            "SSW beta percentage": None,
        })
        status = create_provider_status_for_row(
            row, tango_enabled=True, s4pred_enabled=False,
            tango_output_available=False, s4pred_output_available=False,
        )
        assert status.tango.status == "UNAVAILABLE", f"Expected UNAVAILABLE, got {status.tango.status}"
