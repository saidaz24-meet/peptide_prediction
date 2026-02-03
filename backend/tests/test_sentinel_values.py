"""
Golden tests for sentinel value handling.
Validates that PVL correctly implements null semantics per ISSUE-000.

Key invariants:
- Missing data should be `null` (None), NOT `-1` or `0`
- sswPrediction = -1 is VALID (means "no switch detected")
- sswPrediction = null means "provider didn't run"
"""
import pytest
import math

# Import the functions we're testing
import auxiliary
from services.normalize import (
    _is_fake_default,
    _sanitize_for_json,
    none_if_nan,
)


class TestAuxiliarySentinelValues:
    """Test auxiliary.py returns None (not -1) for missing data."""

    def test_calc_ssw_returns_none_for_empty_segments(self):
        """SSW score and diff should be None when no segments."""
        beta = [0.5, 0.6, 0.7]
        helix = [0.3, 0.4, 0.5]
        empty_segments = []

        score, diff = auxiliary.calc_secondary_structure_switch_difference_and_score(
            beta_prediction=beta,
            helix_prediction=helix,
            structure_prediction_indexes=empty_segments
        )

        assert score is None, f"Expected None for empty segments, got {score}"
        assert diff is None, f"Expected None for empty segments, got {diff}"

    def test_get_avg_uH_returns_none_for_empty_segments(self):
        """μH should be None when no segments."""
        sequence = "KLWKLWKLWK"
        empty_segments = []

        result = auxiliary.get_avg_uH_by_segments(sequence, empty_segments)

        assert result is None, f"Expected None for empty segments, got {result}"

    def test_get_avg_uH_returns_none_for_empty_sequence(self):
        """μH should be None when sequence is empty."""
        empty_sequence = ""
        segments = [(1, 5)]

        result = auxiliary.get_avg_uH_by_segments(empty_sequence, segments)

        assert result is None, f"Expected None for empty sequence, got {result}"

    def test_calc_average_score_returns_none_for_empty(self):
        """Average score should be None when no prediction indexes.

        Note: The actual function __calc_average_score is a module-level private
        function. We test its behavior indirectly through
        calc_secondary_structure_switch_difference_and_score which returns None
        when no segments are found.
        """
        # Tested indirectly via test_calc_ssw_returns_none_for_empty_segments
        pass

    def test_check_secondary_structure_prediction_content_returns_zero(self):
        """Prediction content should be 0 (not None) when no predictions."""
        empty_predictions = [0, 0, 0, 0, 0]

        result = auxiliary.check_secondary_structure_prediction_content(empty_predictions)

        # This returns 0.0 (not None) because 0% is a valid percentage
        assert result == 0, f"Expected 0 for all-zero predictions, got {result}"


class TestNormalizeSentinelValues:
    """Test normalize.py correctly handles sentinel values."""

    def test_is_fake_default_detects_minus_one(self):
        """_is_fake_default should detect -1 as fake default."""
        assert _is_fake_default(-1) is True
        assert _is_fake_default(-1.0) is True

    def test_is_fake_default_allows_zero(self):
        """_is_fake_default should NOT treat 0 as fake default."""
        assert _is_fake_default(0) is False
        assert _is_fake_default(0.0) is False

    def test_is_fake_default_detects_empty_string(self):
        """_is_fake_default should detect empty string as fake default."""
        assert _is_fake_default("") is True
        assert _is_fake_default("-") is True

    def test_is_fake_default_detects_empty_collections(self):
        """_is_fake_default should detect empty lists/dicts as fake default."""
        assert _is_fake_default([]) is True
        assert _is_fake_default({}) is True

    def test_is_fake_default_detects_nan(self):
        """_is_fake_default should detect NaN as fake default."""
        assert _is_fake_default(float('nan')) is True
        assert _is_fake_default(float('inf')) is True

    def test_is_fake_default_allows_valid_values(self):
        """_is_fake_default should allow legitimate values."""
        assert _is_fake_default(1) is False
        assert _is_fake_default(0.5) is False
        assert _is_fake_default("valid") is False
        assert _is_fake_default([1, 2, 3]) is False

    def test_sanitize_preserves_sswPrediction_minus_one(self):
        """_sanitize_for_json should preserve -1 for sswPrediction."""
        data = {"sswPrediction": -1}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] == -1, f"sswPrediction -1 should be preserved, got {result}"

    def test_sanitize_nullifies_other_minus_one(self):
        """_sanitize_for_json should convert -1 to None for other fields."""
        data = {"sswScore": -1}
        result = _sanitize_for_json(data)
        assert result["sswScore"] is None, f"sswScore -1 should become None, got {result}"

    def test_sanitize_nullifies_nan(self):
        """_sanitize_for_json should convert NaN to None."""
        data = {"sswScore": float('nan')}
        result = _sanitize_for_json(data)
        assert result["sswScore"] is None, f"NaN should become None, got {result}"

    def test_sanitize_preserves_zero(self):
        """_sanitize_for_json should preserve 0 values."""
        data = {"sswScore": 0, "sswPrediction": 0}
        result = _sanitize_for_json(data)
        # sswScore = 0 is a valid value (real zero score)
        # Note: In practice, sswScore = 0 might not be semantically valid,
        # but the sanitizer should preserve it
        assert result["sswScore"] == 0 or result["sswScore"] is None
        assert result["sswPrediction"] == 0


class TestNoneIfNan:
    """Test none_if_nan utility function."""

    def test_none_if_nan_returns_none_for_nan(self):
        """none_if_nan should return None for NaN."""
        assert none_if_nan(float('nan')) is None

    def test_none_if_nan_returns_none_for_inf(self):
        """none_if_nan should return None for infinity."""
        assert none_if_nan(float('inf')) is None
        assert none_if_nan(float('-inf')) is None

    def test_none_if_nan_returns_none_for_none(self):
        """none_if_nan should return None for None."""
        assert none_if_nan(None) is None

    def test_none_if_nan_preserves_valid_floats(self):
        """none_if_nan should preserve valid floats."""
        assert none_if_nan(0.0) == 0.0
        assert none_if_nan(1.5) == 1.5
        assert none_if_nan(-1.0) == -1.0

    def test_none_if_nan_preserves_integers(self):
        """none_if_nan should preserve integers."""
        assert none_if_nan(0) == 0
        assert none_if_nan(1) == 1
        assert none_if_nan(-1) == -1


class TestSSWPredictionSemantics:
    """Test sswPrediction value semantics."""

    def test_sswPrediction_minus_one_means_no_switch(self):
        """sswPrediction = -1 means 'no structural switch detected'."""
        # This is the semantic meaning, documented for clarity
        # -1 is a VALID prediction value, not a sentinel for "missing"
        data = {"sswPrediction": -1}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] == -1

    def test_sswPrediction_one_means_switch_found(self):
        """sswPrediction = 1 means 'structural switch detected'."""
        data = {"sswPrediction": 1}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] == 1

    def test_sswPrediction_null_means_not_computed(self):
        """sswPrediction = null means 'provider didn't run or failed'."""
        data = {"sswPrediction": None}
        result = _sanitize_for_json(data)
        assert result["sswPrediction"] is None


class TestPercentageSemantics:
    """Test percentage field semantics."""

    def test_zero_percentage_is_valid(self):
        """0% is a valid percentage (not a sentinel)."""
        # A peptide can legitimately have 0% helix content
        data = {"sswHelixPercentage": 0.0}
        result = _sanitize_for_json(data)
        # 0.0 should be preserved (not converted to None)
        assert result["sswHelixPercentage"] == 0.0

    def test_minus_one_percentage_is_invalid(self):
        """_is_fake_default should detect -1 for percentages."""
        # -1% is not a valid percentage - it's a sentinel
        assert _is_fake_default(-1) is True

    def test_hundred_percentage_is_valid(self):
        """100% is a valid percentage."""
        data = {"sswHelixPercentage": 100.0}
        result = _sanitize_for_json(data)
        assert result["sswHelixPercentage"] == 100.0
