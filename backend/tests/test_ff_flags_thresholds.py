"""
Tests for apply_ff_flags() threshold wiring.

Verifies that user-configurable thresholds (muHCutoff, hydroCutoff)
are correctly passed through to apply_ff_flags() and override
data-average defaults when threshold_mode is "custom" or "recommended".
"""
import pandas as pd
import pytest

from services.dataframe_utils import apply_ff_flags


def _make_df(rows: list[dict]) -> pd.DataFrame:
    """Build a small DataFrame with the columns apply_ff_flags needs."""
    df = pd.DataFrame(rows)
    # Ensure required columns exist
    for col in [
        "Sequence", "Hydrophobicity", "Full length uH",
        "SSW prediction", "SSW diff", "SSW score",
        "SSW helix percentage", "SSW beta percentage",
        "Beta full length uH",
    ]:
        if col not in df.columns:
            df[col] = None
    return df


def _simple_batch():
    """Two peptides with known hydrophobicity and helix data."""
    return _make_df([
        {
            "Sequence": "AAAAAA",
            "Hydrophobicity": 0.5,
            "Full length uH": 0.3,
            "Beta full length uH": 0.1,
            "SSW prediction": 1,
            "SSW diff": -0.2,
            "SSW helix percentage": 10.0,
            "SSW beta percentage": 20.0,
            "Helix prediction (S4PRED)": 1,
            "Helix (s4pred) uH": 0.4,
            "Helix score (S4PRED)": 0.8,
            "Helix fragments (S4PRED)": [[0, 5]],
        },
        {
            "Sequence": "LLLLLL",
            "Hydrophobicity": 0.2,
            "Full length uH": 0.1,
            "Beta full length uH": 0.05,
            "SSW prediction": 1,
            "SSW diff": -0.1,
            "SSW helix percentage": 15.0,
            "SSW beta percentage": 25.0,
            "Helix prediction (S4PRED)": 1,
            "Helix (s4pred) uH": 0.2,
            "Helix score (S4PRED)": 0.5,
            "Helix fragments (S4PRED)": [[0, 5]],
        },
    ])


class TestApplyFFFlags_DefaultMode:
    """Default mode (no thresholds passed) — backward compatible."""

    def test_backward_compatible_no_args(self):
        """Calling apply_ff_flags(df) with no extra args still works."""
        df = _simple_batch()
        result = apply_ff_flags(df)
        # Should return a dict with thresholds used
        assert isinstance(result, dict)
        assert "ssw_hydro_threshold" in result
        assert "helix_uH_threshold" in result

    def test_default_uses_data_average_hydro(self):
        """In default mode, ssw_hydro_threshold equals mean hydrophobicity of SSW+ rows."""
        df = _simple_batch()
        result = apply_ff_flags(df)
        # Both rows have SSW prediction = 1, so avg H = (0.5 + 0.2) / 2 = 0.35
        assert abs(result["ssw_hydro_threshold"] - 0.35) < 1e-6

    def test_default_uses_data_average_helix_uH(self):
        """In default mode, helix_uH_threshold equals mean uH of helix-predicted rows."""
        df = _simple_batch()
        result = apply_ff_flags(df)
        # Both rows have helix prediction = 1, avg uH = (0.4 + 0.2) / 2 = 0.3
        assert abs(result["helix_uH_threshold"] - 0.3) < 1e-6


class TestApplyFFFlags_CustomMode:
    """Custom mode — user thresholds override data-average."""

    def test_custom_hydro_overrides_data_avg(self):
        """When custom hydroCutoff is provided, it overrides ssw_avg_H."""
        df = _simple_batch()
        thresholds = {"hydroCutoff": 0.6, "muHCutoff": 0.0, "ffHelixPercentThreshold": 50.0}
        result = apply_ff_flags(df, resolved_thresholds=thresholds, threshold_mode="custom")
        assert abs(result["ssw_hydro_threshold"] - 0.6) < 1e-6
        # With threshold 0.6, both rows (H=0.5, H=0.2) should be below → FF-SSW = -1
        assert df["FF-Secondary structure switch"].tolist() == [-1, -1]

    def test_custom_muH_overrides_data_avg(self):
        """When custom muHCutoff is provided, it overrides helix_avg_uH."""
        df = _simple_batch()
        thresholds = {"hydroCutoff": 0.0, "muHCutoff": 0.5, "ffHelixPercentThreshold": 50.0}
        result = apply_ff_flags(df, resolved_thresholds=thresholds, threshold_mode="custom")
        assert abs(result["helix_uH_threshold"] - 0.5) < 1e-6
        # With threshold 0.5, both rows (uH=0.4, uH=0.2) are below → FF-Helix = -1
        assert df["FF-Helix (Jpred)"].tolist() == [-1, -1]

    def test_custom_low_thresholds_let_everything_pass(self):
        """Very low custom thresholds make all candidates pass."""
        df = _simple_batch()
        thresholds = {"hydroCutoff": -10.0, "muHCutoff": -10.0, "ffHelixPercentThreshold": 0.0}
        result = apply_ff_flags(df, resolved_thresholds=thresholds, threshold_mode="custom")
        # Both should be candidates (1)
        assert df["FF-Secondary structure switch"].tolist() == [1, 1]
        assert df["FF-Helix (Jpred)"].tolist() == [1, 1]


class TestApplyFFFlags_ReturnDict:
    """Return dict contains actual thresholds used."""

    def test_returns_thresholds_used_default(self):
        """Default mode returns data-computed thresholds."""
        df = _simple_batch()
        result = apply_ff_flags(df)
        assert "ssw_hydro_threshold" in result
        assert "helix_uH_threshold" in result
        assert isinstance(result["ssw_hydro_threshold"], float)
        assert isinstance(result["helix_uH_threshold"], float)

    def test_returns_thresholds_used_custom(self):
        """Custom mode returns the user-provided values."""
        df = _simple_batch()
        thresholds = {"hydroCutoff": 0.42, "muHCutoff": 0.33, "ffHelixPercentThreshold": 50.0}
        result = apply_ff_flags(df, resolved_thresholds=thresholds, threshold_mode="custom")
        assert abs(result["ssw_hydro_threshold"] - 0.42) < 1e-6
        assert abs(result["helix_uH_threshold"] - 0.33) < 1e-6

    def test_none_thresholds_falls_back_to_default(self):
        """Passing None thresholds is equivalent to default mode."""
        df = _simple_batch()
        result_default = apply_ff_flags(df.copy())
        result_none = apply_ff_flags(df.copy(), resolved_thresholds=None, threshold_mode="default")
        assert abs(result_default["ssw_hydro_threshold"] - result_none["ssw_hydro_threshold"]) < 1e-6


class TestApplyFFFlags_EdgeCases:
    """Edge cases for threshold wiring."""

    def test_empty_dataframe(self):
        """Empty DataFrame doesn't crash."""
        df = _make_df([])
        result = apply_ff_flags(df)
        assert isinstance(result, dict)

    def test_no_ssw_data(self):
        """Rows without SSW data get None flags."""
        df = _make_df([
            {"Sequence": "AAAAAA", "Hydrophobicity": 0.5, "Full length uH": 0.3},
        ])
        result = apply_ff_flags(df)
        assert df["FF-Secondary structure switch"].iloc[0] is None

    def test_recommended_mode_same_as_default(self):
        """Recommended mode with no custom overrides behaves like default."""
        df = _simple_batch()
        result = apply_ff_flags(df, resolved_thresholds=None, threshold_mode="recommended")
        # Should use data-average (same as default when no custom thresholds)
        assert isinstance(result["ssw_hydro_threshold"], float)


class TestApplyFFFlags_PelegFallback:
    """Single-sequence / no-cohort fallback uses Peleg dataset-average constants."""

    def test_no_ssw_data_falls_back_to_peleg_hydro(self):
        """When no valid SSW rows exist, ssw_hydro_threshold uses Peleg default (0.417)."""
        df = _make_df([
            {
                "Sequence": "AAAAAA",
                "Hydrophobicity": 0.5,
                "Full length uH": 0.3,
                "SSW prediction": None,  # No SSW data
            },
        ])
        result = apply_ff_flags(df)
        assert abs(result["ssw_hydro_threshold"] - 0.417) < 1e-6

    def test_no_helix_data_falls_back_to_peleg_helix_uh(self):
        """When no valid helix rows exist, helix_uH_threshold uses Peleg default (0.388)."""
        df = _make_df([
            {
                "Sequence": "AAAAAA",
                "Hydrophobicity": 0.5,
                "Full length uH": 0.3,
                "Helix prediction (S4PRED)": None,  # No helix data
                "Helix (s4pred) uH": None,
                "Helix score (S4PRED)": None,
                "Helix fragments (S4PRED)": None,
            },
        ])
        result = apply_ff_flags(df)
        assert abs(result["helix_uH_threshold"] - 0.388) < 1e-6

    def test_empty_df_uses_peleg_defaults(self):
        """Empty DataFrame returns Peleg defaults instead of 0.0."""
        df = _make_df([])
        result = apply_ff_flags(df)
        assert abs(result["ssw_hydro_threshold"] - 0.417) < 1e-6
        assert abs(result["helix_uH_threshold"] - 0.388) < 1e-6

    def test_batch_with_data_uses_data_average_not_peleg(self):
        """Batch with valid data uses data-average, NOT Peleg fallback."""
        df = _simple_batch()
        result = apply_ff_flags(df)
        # Data average = (0.5 + 0.2) / 2 = 0.35 (not 0.417)
        assert abs(result["ssw_hydro_threshold"] - 0.35) < 1e-6
        # Data average uH = (0.4 + 0.2) / 2 = 0.3 (not 0.388)
        assert abs(result["helix_uH_threshold"] - 0.3) < 1e-6
