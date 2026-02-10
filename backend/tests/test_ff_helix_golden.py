"""
Golden tests for FF-Helix calculation functions.

Tests the local helix propensity calculation (ff_helix_percent, ff_helix_cores)
and the database-level FF flags (apply_ff_flags).

Our ff_helix_percent uses a Chou-Fasman sliding-window propensity scale.
This is distinct from the reference's FF-Helix binary classification
(which uses S4PRED helix segments + database-average μH threshold).
"""
import pytest
import pandas as pd
import numpy as np

from auxiliary import ff_helix_percent, ff_helix_cores, _HELIX_PROP, get_avg_uH_by_segments
from services.dataframe_utils import apply_ff_flags, _compute_helix_uh


# ============================================================
# ff_helix_percent tests
# ============================================================

class TestFfHelixPercent:
    """Test auxiliary.ff_helix_percent (Chou-Fasman sliding-window propensity)."""

    def test_alanine_rich_high_propensity(self):
        """Alanine (prop=1.42) should produce high helix percent."""
        seq = "AAAAAAAAAAAA"  # 12 alanines, all prop=1.42 > thr=1.0
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        assert pct == 100.0

    def test_glycine_low_propensity(self):
        """Glycine (prop=0.57) should produce 0% helix."""
        seq = "GGGGGGGGGGGG"  # 12 glycines, all prop=0.57 < thr=1.0
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        assert pct == 0.0

    def test_proline_low_propensity(self):
        """Proline (prop=0.57) should produce 0% helix."""
        seq = "PPPPPPPPPPPP"
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        assert pct == 0.0

    def test_mixed_sequence(self):
        """Mixed sequence: helix core surrounded by low-propensity flanks."""
        # 6 G (low, 0.57) + 6 A (high, 1.42) + 6 G (low)
        seq = "GGGGGG" + "AAAAAA" + "GGGGGG"  # 18 residues
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        # Sliding window of 6 includes overlap at boundaries
        # Only windows fully in the A-region or with enough A's to hit 1.0 qualify
        assert 0.0 < pct < 100.0  # Partially helical

    def test_short_sequence_below_core_len(self):
        """Sequence shorter than core_len should return 0."""
        pct = ff_helix_percent("AAA", core_len=6, thr=1.0)
        assert pct == 0.0

    def test_empty_sequence(self):
        """Empty sequence should return 0."""
        assert ff_helix_percent("", core_len=6, thr=1.0) == 0.0

    def test_nan_sequence(self):
        """NaN sequence should return 0 (safe handling)."""
        assert ff_helix_percent(float("nan"), core_len=6, thr=1.0) == 0.0

    def test_none_sequence(self):
        """None sequence should return 0 (safe handling)."""
        assert ff_helix_percent(None, core_len=6, thr=1.0) == 0.0

    def test_result_range(self):
        """Result must always be in [0.0, 100.0]."""
        seqs = ["AAAAAA", "GGGGGG", "AELQKR", "AAAAAAGGGGGGG", ""]
        for seq in seqs:
            pct = ff_helix_percent(seq, core_len=6, thr=1.0)
            assert 0.0 <= pct <= 100.0, f"Out of range for '{seq}': {pct}"

    def test_exact_core_len(self):
        """Sequence exactly core_len long with high propensity → 100%."""
        seq = "AAAAAA"  # 6 alanines, mean=1.42 >= 1.0
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        assert pct == 100.0

    def test_threshold_sensitivity(self):
        """Lower threshold should produce higher percentage."""
        seq = "AELQKRMFVW"  # Mixed propensities
        pct_strict = ff_helix_percent(seq, core_len=6, thr=1.2)
        pct_relaxed = ff_helix_percent(seq, core_len=6, thr=0.8)
        assert pct_relaxed >= pct_strict

    def test_melittin_has_helix(self):
        """Melittin (known helix-former) should have significant helix percent."""
        melittin = "GIGAVLKVLTTGLPALISWIKRKRQQ"
        pct = ff_helix_percent(melittin, core_len=6, thr=1.0)
        assert pct > 0.0, "Melittin should have some helical propensity"

    def test_propensity_scale_coverage(self):
        """All 20 standard amino acids should have propensity values."""
        standard_aas = "ACDEFGHIKLMNPQRSTVWY"
        for aa in standard_aas:
            assert aa in _HELIX_PROP, f"Missing propensity for {aa}"

    def test_unknown_residue_uses_default(self):
        """Unknown residues (e.g., 'X') use default propensity of 1.0."""
        seq = "XXXXXX"  # 6 unknowns, default=1.0, mean=1.0 >= thr=1.0
        pct = ff_helix_percent(seq, core_len=6, thr=1.0)
        assert pct == 100.0  # mean of 1.0 == threshold of 1.0 → included


# ============================================================
# ff_helix_cores tests
# ============================================================

class TestFfHelixCores:
    """Test auxiliary.ff_helix_cores (segment detection)."""

    def test_single_core(self):
        """Single high-propensity region → 1 segment."""
        seq = "GGGGAAEEAAGGGG"
        cores = ff_helix_cores(seq, core_len=6, thr=1.0)
        assert len(cores) >= 1
        # Segments are 1-indexed
        for start, end in cores:
            assert start >= 1
            assert end <= len(seq)
            assert end >= start

    def test_two_cores(self):
        """Two separated high-propensity regions → 2 segments."""
        seq = "AAAAAA" + "GGGGGGGGGGG" + "AAAAAA"  # 6+11+6 = 23
        cores = ff_helix_cores(seq, core_len=6, thr=1.0)
        assert len(cores) == 2

    def test_no_cores(self):
        """All-glycine → no segments."""
        seq = "GGGGGGGGGGGG"
        cores = ff_helix_cores(seq, core_len=6, thr=1.0)
        assert cores == []

    def test_short_sequence(self):
        """Sequence shorter than core_len → empty."""
        cores = ff_helix_cores("AAA", core_len=6, thr=1.0)
        assert cores == []

    def test_segments_are_1_indexed(self):
        """Segments should be 1-indexed (not 0-indexed)."""
        seq = "AAAAAA"  # All helix
        cores = ff_helix_cores(seq, core_len=6, thr=1.0)
        assert len(cores) == 1
        assert cores[0][0] == 1  # 1-indexed start
        assert cores[0][1] == 6  # 1-indexed end

    def test_nan_returns_empty(self):
        """NaN input → empty list."""
        assert ff_helix_cores(float("nan"), core_len=6, thr=1.0) == []

    def test_empty_returns_empty(self):
        """Empty input → empty list."""
        assert ff_helix_cores("", core_len=6, thr=1.0) == []

    def test_contiguous_merge(self):
        """Adjacent qualifying windows should merge into one segment."""
        # All high propensity → single merged segment
        seq = "AAAAAAAAAAAA"  # 12 residues
        cores = ff_helix_cores(seq, core_len=6, thr=1.0)
        assert len(cores) == 1
        assert cores[0] == [1, 12]


# ============================================================
# apply_ff_flags tests
# ============================================================

class TestApplyFfFlags:
    """Test dataframe_utils.apply_ff_flags (database-level FF classification)."""

    def _make_df(self, rows):
        """Helper to create DataFrame from list of dicts."""
        return pd.DataFrame(rows)

    def test_ssw_flag_positive(self):
        """Row with SSW prediction=1 and high hydrophobicity → FF-SSW = 1."""
        df = self._make_df([
            {"SSW prediction": 1, "Hydrophobicity": 0.8, "Sequence": "AELQKRMFVW"},
            {"SSW prediction": -1, "Hydrophobicity": 0.2, "Sequence": "GGGGGGGGG"},
        ])
        apply_ff_flags(df)
        # Only row with SSW prediction != -1 contributes to avg → avg_H = 0.8
        # Row 0: SSW=1 and H=0.8 >= 0.8 → 1
        assert df.iloc[0]["FF-Secondary structure switch"] == 1

    def test_ssw_flag_negative(self):
        """Row with SSW prediction=-1 → FF-SSW = -1 (not candidate)."""
        df = self._make_df([
            {"SSW prediction": -1, "Hydrophobicity": 0.8, "Sequence": "AELQKRMFVW"},
        ])
        apply_ff_flags(df)
        assert df.iloc[0]["FF-Secondary structure switch"] == -1

    def test_ssw_flag_null_when_no_data(self):
        """Row with SSW prediction=None → FF-SSW = None (no data)."""
        df = self._make_df([
            {"SSW prediction": None, "Hydrophobicity": 0.8, "Sequence": "AELQKRMFVW"},
        ])
        apply_ff_flags(df)
        val = df.iloc[0]["FF-Secondary structure switch"]
        assert val is None

    def test_ssw_threshold_uses_ssw_positive_rows(self):
        """SSW avg hydrophobicity threshold computed from SSW-positive rows only."""
        df = self._make_df([
            {"SSW prediction": 1, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
            {"SSW prediction": 1, "Hydrophobicity": 0.9, "Sequence": "AELQKRMFVW"},
            {"SSW prediction": -1, "Hydrophobicity": 100.0, "Sequence": "GGGGGGGGG"},
        ])
        apply_ff_flags(df)
        # avg_H from SSW=1 rows: (0.5 + 0.9) / 2 = 0.7
        # Row 0: SSW=1, H=0.5 < 0.7 → -1 (below avg)
        # Row 1: SSW=1, H=0.9 >= 0.7 → 1
        # Row 2: SSW=-1 → -1
        assert df.iloc[0]["FF-Secondary structure switch"] == -1
        assert df.iloc[1]["FF-Secondary structure switch"] == 1
        assert df.iloc[2]["FF-Secondary structure switch"] == -1

    def test_ff_helix_with_s4pred_data(self):
        """FF-Helix should use S4PRED data when available."""
        df = self._make_df([
            {
                "Sequence": "AELQKRAAELQKR",
                "SSW prediction": -1, "Hydrophobicity": 0.5,
                "Helix prediction (S4PRED)": 1,
                "Helix fragments (S4PRED)": [(1, 10)],
            },
            {
                "Sequence": "GGGGGGGGGGGGGG",
                "SSW prediction": -1, "Hydrophobicity": 0.3,
                "Helix prediction (S4PRED)": -1,
                "Helix fragments (S4PRED)": [],
            },
        ])
        apply_ff_flags(df)
        # Row 0 has helix prediction=1 → should get FF-Helix evaluated
        # Row 1 has helix prediction=-1 → FF-Helix = -1 (no helix)
        assert df.iloc[1]["FF-Helix (Jpred)"] == -1

    def test_no_helix_data_gives_none(self):
        """No helix prediction columns → all FF-Helix = None/NaN."""
        df = self._make_df([
            {"SSW prediction": 1, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
        ])
        apply_ff_flags(df)
        val = df.iloc[0]["FF-Helix (Jpred)"]
        assert val is None or pd.isna(val)

    def test_columns_always_created(self):
        """apply_ff_flags always creates all FF flag and score columns."""
        df = self._make_df([
            {"SSW prediction": -1, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
        ])
        apply_ff_flags(df)
        assert "FF-Secondary structure switch" in df.columns
        assert "FF-Helix (Jpred)" in df.columns
        assert "FF-SSW score" in df.columns
        assert "FF-Helix score" in df.columns


# ============================================================
# _compute_helix_uh tests
# ============================================================

class TestComputeHelixUh:
    """Test dataframe_utils._compute_helix_uh."""

    def test_computes_uh_from_segments(self):
        """Should compute μH from helix segments."""
        df = pd.DataFrame([
            {"Sequence": "AELQKRMFVWAELQKR", "Helix fragments (S4PRED)": [(1, 10)]},
        ])
        _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")
        assert "Helix (s4pred) uH" in df.columns
        assert df.iloc[0]["Helix (s4pred) uH"] is not None

    def test_no_fragments_gives_none(self):
        """Empty fragments → None μH."""
        df = pd.DataFrame([
            {"Sequence": "AELQKR", "Helix fragments (S4PRED)": []},
        ])
        _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")
        assert df.iloc[0]["Helix (s4pred) uH"] is None

    def test_nan_sequence_gives_none(self):
        """NaN sequence → None μH."""
        df = pd.DataFrame([
            {"Sequence": float("nan"), "Helix fragments (S4PRED)": [(1, 5)]},
        ])
        _compute_helix_uh(df, "Helix fragments (S4PRED)", "Helix (s4pred) uH")
        assert df.iloc[0]["Helix (s4pred) uH"] is None


# ============================================================
# get_avg_uH_by_segments tests (our implementation)
# ============================================================

class TestGetAvgUhBySegments:
    """Test auxiliary.get_avg_uH_by_segments (our null-returning version)."""

    def test_empty_segments_returns_none(self):
        """No segments → None (not -1 like reference)."""
        result = get_avg_uH_by_segments("AELQKR", [])
        assert result is None

    def test_empty_sequence_returns_none(self):
        """Empty sequence → None."""
        result = get_avg_uH_by_segments("", [(1, 5)])
        assert result is None

    def test_valid_segment_returns_float(self):
        """Valid segment → float μH value."""
        result = get_avg_uH_by_segments("AELQKRMFVW", [(1, 5)])
        assert isinstance(result, float)
        assert result >= 0


# ============================================================
# FF-SSW score tests
# ============================================================

class TestFfSswScore:
    """Test FF-SSW score computation in apply_ff_flags."""

    def _make_df(self, rows):
        return pd.DataFrame(rows)

    def test_ssw_score_formula(self):
        """FF-SSW score = Hydrophobicity + Beta_uH + Full_length_uH + SSW_prediction."""
        df = self._make_df([
            {
                "SSW prediction": 1,
                "Hydrophobicity": 0.5,
                "Full length uH": 0.3,
                "Sequence": "AELQKRMFVW",
            },
        ])
        apply_ff_flags(df)
        score = df.iloc[0]["FF-SSW score"]
        assert score is not None
        # Score = 0.5 + Beta_uH + 0.3 + 1
        # Beta_uH is computed from sequence with angle=160
        assert isinstance(score, float)
        # Verify components: H=0.5, Full_uH=0.3, SSW=1, Beta_uH > 0
        beta_uh = df.iloc[0]["Beta full length uH"]
        expected = 0.5 + beta_uh + 0.3 + 1.0
        assert abs(score - expected) < 1e-9

    def test_ssw_score_null_when_no_data(self):
        """FF-SSW score = None when SSW prediction is None."""
        df = self._make_df([
            {"SSW prediction": None, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
        ])
        apply_ff_flags(df)
        assert df.iloc[0]["FF-SSW score"] is None

    def test_ssw_score_null_when_missing_components(self):
        """FF-SSW score = None when a required component is missing."""
        df = self._make_df([
            {"SSW prediction": 1, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
            # No "Full length uH" column
        ])
        apply_ff_flags(df)
        assert df.iloc[0]["FF-SSW score"] is None

    def test_ssw_score_with_negative_ssw(self):
        """FF-SSW score computed even when SSW prediction = -1."""
        df = self._make_df([
            {
                "SSW prediction": -1,
                "Hydrophobicity": 0.5,
                "Full length uH": 0.3,
                "Sequence": "AELQKRMFVW",
            },
        ])
        apply_ff_flags(df)
        score = df.iloc[0]["FF-SSW score"]
        assert score is not None
        beta_uh = df.iloc[0]["Beta full length uH"]
        expected = 0.5 + beta_uh + 0.3 + (-1.0)
        assert abs(score - expected) < 1e-9


# ============================================================
# FF-Helix score tests
# ============================================================

class TestFfHelixScore:
    """Test FF-Helix score computation in apply_ff_flags."""

    def _make_df(self, rows):
        return pd.DataFrame(rows)

    def test_helix_score_formula(self):
        """FF-Helix score = helix_uH + helix_score."""
        df = self._make_df([
            {
                "Sequence": "AELQKRMFVWAELQKR",
                "SSW prediction": -1,
                "Hydrophobicity": 0.5,
                "Helix prediction (S4PRED)": 1,
                "Helix fragments (S4PRED)": [(1, 10)],
                "Helix score (S4PRED)": 0.85,
            },
        ])
        apply_ff_flags(df)
        score = df.iloc[0]["FF-Helix score"]
        assert score is not None
        helix_uh = df.iloc[0]["Helix (s4pred) uH"]
        expected = helix_uh + 0.85
        assert abs(score - expected) < 1e-9

    def test_helix_score_null_when_no_helix(self):
        """FF-Helix score = None when no helix detected."""
        df = self._make_df([
            {
                "Sequence": "GGGGGGGGGGGGGG",
                "SSW prediction": -1,
                "Hydrophobicity": 0.3,
                "Helix prediction (S4PRED)": -1,
                "Helix fragments (S4PRED)": [],
            },
        ])
        apply_ff_flags(df)
        assert df.iloc[0]["FF-Helix score"] is None

    def test_helix_score_null_without_helix_score_col(self):
        """FF-Helix score = None when Helix score column missing."""
        df = self._make_df([
            {
                "Sequence": "AELQKRAAELQKR",
                "SSW prediction": -1,
                "Hydrophobicity": 0.5,
                "Helix prediction (S4PRED)": 1,
                "Helix fragments (S4PRED)": [(1, 10)],
                # No "Helix score (S4PRED)" column
            },
        ])
        apply_ff_flags(df)
        assert df.iloc[0]["FF-Helix score"] is None


# ============================================================
# Beta full length uH computation tests
# ============================================================

class TestBetaUhComputation:
    """Test _compute_beta_uh (beta-sheet hydrophobic moment, angle=160)."""

    def _make_df(self, rows):
        return pd.DataFrame(rows)

    def test_beta_uh_computed(self):
        """Beta full length uH should be computed for valid sequences."""
        from services.dataframe_utils import _compute_beta_uh
        df = self._make_df([{"Sequence": "AELQKRMFVW"}])
        _compute_beta_uh(df)
        assert "Beta full length uH" in df.columns
        assert df.iloc[0]["Beta full length uH"] is not None
        assert isinstance(df.iloc[0]["Beta full length uH"], float)
        assert df.iloc[0]["Beta full length uH"] >= 0

    def test_beta_uh_different_from_alpha(self):
        """Beta uH (angle=160) should differ from alpha uH (angle=100)."""
        from biochem_calculation import hydrophobic_moment
        seq = "AELQKRMFVW"
        alpha_uh = hydrophobic_moment(seq, angle=100)
        beta_uh = hydrophobic_moment(seq, angle=160)
        assert alpha_uh != beta_uh  # Different angles → different moments

    def test_beta_uh_none_for_empty(self):
        """Empty/NaN sequence → None Beta uH."""
        from services.dataframe_utils import _compute_beta_uh
        df = self._make_df([{"Sequence": ""}])
        _compute_beta_uh(df)
        assert df.iloc[0]["Beta full length uH"] is None

    def test_beta_uh_auto_computed_by_apply_ff_flags(self):
        """apply_ff_flags should auto-compute Beta uH if missing."""
        df = self._make_df([
            {"SSW prediction": 1, "Hydrophobicity": 0.5, "Sequence": "AELQKRMFVW"},
        ])
        assert "Beta full length uH" not in df.columns
        apply_ff_flags(df)
        assert "Beta full length uH" in df.columns
        assert df.iloc[0]["Beta full length uH"] is not None
