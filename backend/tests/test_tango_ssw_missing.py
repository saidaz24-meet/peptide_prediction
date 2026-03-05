"""
Tests for TANGO SSW "Missing" bug fix.

Verifies that filter_by_avg_diff correctly distinguishes:
  - TANGO ran and has data → SSW prediction is 1 or -1
  - TANGO attempted but empty output → SSW prediction is -1 (not None)
  - TANGO not attempted → SSW prediction is None
  - Valid SSW diff → SSW prediction computed normally
"""
import math
import pandas as pd
import numpy as np
import pytest

# Import from tango module
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import tango


def _is_missing(val):
    """Check if a value represents missing data (None or NaN).

    pandas may convert None → NaN when mixing numeric and None values
    in a Series/DataFrame column. Both represent "missing" semantically.
    """
    if val is None:
        return True
    if isinstance(val, float) and (math.isnan(val) or not math.isfinite(val)):
        return True
    try:
        return pd.isna(val)
    except (TypeError, ValueError):
        return False


def _make_df(rows):
    """Build a DataFrame with required columns for filter_by_avg_diff."""
    df = pd.DataFrame(rows)
    # Ensure all required columns exist
    for col in ["SSW diff", "SSW helix percentage", "SSW beta percentage",
                "Tango has data", "Tango attempted"]:
        if col not in df.columns:
            df[col] = None
    return df


class TestFilterByAvgDiffTangoAttempted:
    """Test that 'Tango attempted' flag is respected."""

    def test_tango_has_data_gets_prediction(self):
        """Entry with TANGO data should get -1 or 1 (never None)."""
        df = _make_df([{
            "Entry": "P12345",
            "SSW diff": 0.5,
            "SSW helix percentage": 30.0,
            "SSW beta percentage": 20.0,
            "Tango has data": True,
            "Tango attempted": False,
        }])
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)
        pred = df["SSW prediction"].iloc[0]
        assert pred is not None, "TANGO with data should produce a prediction"
        assert pred in (1, -1), f"Expected 1 or -1, got {pred}"

    def test_tango_attempted_empty_output_gets_minus_one(self):
        """Entry where TANGO ran but output was empty → -1 (not None)."""
        df = _make_df([{
            "Entry": "P99999",
            "SSW diff": None,
            "SSW helix percentage": None,
            "SSW beta percentage": None,
            "Tango has data": False,
            "Tango attempted": True,
        }])
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)
        pred = df["SSW prediction"].iloc[0]
        assert pred == -1, f"TANGO attempted (empty output) should be -1, got {pred}"

    def test_tango_not_attempted_gets_none(self):
        """Entry where TANGO didn't run → None/NaN (Missing)."""
        df = _make_df([{
            "Entry": "NORUN",
            "SSW diff": None,
            "SSW helix percentage": None,
            "SSW beta percentage": None,
            "Tango has data": False,
            "Tango attempted": False,
        }])
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)
        pred = df["SSW prediction"].iloc[0]
        assert _is_missing(pred), f"TANGO not attempted should be missing, got {pred}"

    def test_valid_ssw_diff_gets_prediction(self):
        """Entry with valid SSW diff should get 1 or -1 based on threshold."""
        df = _make_df([
            {
                "Entry": "A1",
                "SSW diff": 0.1,
                "SSW helix percentage": 40.0,
                "SSW beta percentage": 30.0,
                "Tango has data": True,
                "Tango attempted": False,
            },
            {
                "Entry": "A2",
                "SSW diff": 0.9,
                "SSW helix percentage": 20.0,
                "SSW beta percentage": 50.0,
                "Tango has data": True,
                "Tango attempted": False,
            },
        ])
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)
        # Both should have predictions (not None)
        for i in range(2):
            pred = df["SSW prediction"].iloc[i]
            assert pred is not None, f"Row {i}: expected prediction, got None"
            assert pred in (1, -1), f"Row {i}: expected 1 or -1, got {pred}"

    def test_mixed_batch(self):
        """Batch with has-data, attempted, and not-attempted entries."""
        df = _make_df([
            {
                "Entry": "HAS_DATA",
                "SSW diff": 0.3,
                "SSW helix percentage": 50.0,
                "SSW beta percentage": 25.0,
                "Tango has data": True,
                "Tango attempted": False,
            },
            {
                "Entry": "ATTEMPTED",
                "SSW diff": None,
                "SSW helix percentage": None,
                "SSW beta percentage": None,
                "Tango has data": False,
                "Tango attempted": True,
            },
            {
                "Entry": "NO_RUN",
                "SSW diff": None,
                "SSW helix percentage": None,
                "SSW beta percentage": None,
                "Tango has data": False,
                "Tango attempted": False,
            },
        ])
        stats = {"test": {}}
        tango.filter_by_avg_diff(df, "test", stats)

        pred_has_data = df["SSW prediction"].iloc[0]
        pred_attempted = df["SSW prediction"].iloc[1]
        pred_no_run = df["SSW prediction"].iloc[2]

        assert pred_has_data in (1, -1), f"HAS_DATA: expected 1/-1, got {pred_has_data}"
        assert pred_attempted == -1, f"ATTEMPTED: expected -1, got {pred_attempted}"
        assert _is_missing(pred_no_run), f"NO_RUN: expected missing (None/NaN), got {pred_no_run}"
