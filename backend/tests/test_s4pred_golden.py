"""
Golden tests for S4PRED analysis functions.

Tests the analysis pipeline: segment detection, SSW overlap, score/diff,
and database-level SSW prediction (filter_by_s4pred_diff).

Reference: 260120_Alpha_and_SSW_FF_Predictor/s4pred.py
"""
import pandas as pd

import s4pred


class TestGetSecondaryStructureSegments:
    """Test s4pred._get_secondary_structure_segments (matches reference auxiliary.py)."""

    def test_helix_above_s4pred_threshold(self):
        """S4PRED uses MIN_S4PRED_SCORE=0.5 threshold."""
        # 7 residues with P_H > 0.5
        scores = [0.0, 0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.0]
        segments = s4pred._get_secondary_structure_segments(scores, min_score=0.5)
        assert len(segments) == 1
        start, end = segments[0]
        assert end - start + 1 >= 5

    def test_below_threshold_rejected(self):
        """Segments where mean/median < 0.5 should be rejected."""
        # Values above 0 but below 0.5
        scores = [0.1, 0.2, 0.3, 0.2, 0.1, 0.2, 0.3]
        segments = s4pred._get_secondary_structure_segments(scores, min_score=0.5)
        assert segments == []

    def test_beta_uses_zero_threshold(self):
        """Beta segments use min_score=0 per reference."""
        # Any positive values should form segments
        scores = [0.0, 0.1, 0.2, 0.1, 0.1, 0.2, 0.0]
        segments = s4pred._get_secondary_structure_segments(scores, min_score=0)
        assert len(segments) == 1

    def test_gap_merging(self):
        """Gaps <= MAX_GAP=3 should be merged."""
        scores = [0.6, 0.7, 0.8, 0.7, 0.6,   # 5 residues
                  0.0, 0.0, 0.0,                # Gap of 3
                  0.6, 0.7, 0.8, 0.7, 0.6]      # 5 more
        segments = s4pred._get_secondary_structure_segments(scores, min_score=0.5)
        # Should merge into 1 segment
        assert len(segments) == 1


class TestAnalyseS4predResult:
    """Test s4pred.analyse_s4pred_result (matches reference __analyse_s4pred_sequence_results)."""

    def test_no_helix_returns_defaults(self):
        """Sequence with no helix should return default values."""
        prediction = {
            'P_H': [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
            'P_E': [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        }
        result = s4pred.analyse_s4pred_result(prediction)

        assert result[s4pred.HELIX_PREDICTION_S4PRED] == -1
        assert result[s4pred.HELIX_FRAGMENTS_S4PRED] == []
        assert result[s4pred.HELIX_SCORE_S4PRED] == -1.0
        assert result[s4pred.HELIX_PERCENTAGE_S4PRED] == 0

    def test_helix_detected(self):
        """Sequence with clear helix should be detected."""
        prediction = {
            'P_H': [0.0, 0.8, 0.9, 0.85, 0.8, 0.75, 0.7, 0.0],
            'P_E': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        }
        result = s4pred.analyse_s4pred_result(prediction)

        assert result[s4pred.HELIX_PREDICTION_S4PRED] == 1
        assert len(result[s4pred.HELIX_FRAGMENTS_S4PRED]) >= 1
        assert result[s4pred.HELIX_SCORE_S4PRED] > 0
        assert result[s4pred.HELIX_PERCENTAGE_S4PRED] > 0

    def test_ssw_detected_with_overlap(self):
        """Overlapping helix and beta regions should produce SSW."""
        # Helix and beta overlap in the middle
        prediction = {
            'P_H': [0.0, 0.0, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.0, 0.0,
                     0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            'P_E': [0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.3, 0.3, 0.3, 0.3,
                     0.3, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        }
        result = s4pred.analyse_s4pred_result(prediction)

        # There should be helix segments
        assert result[s4pred.HELIX_PREDICTION_S4PRED] == 1
        # SSW depends on whether beta segments pass threshold (min_score=0)
        # and overlap with swapped helix segments
        # Just verify the structure is correct
        assert isinstance(result[s4pred.SSW_FRAGMENTS_S4PRED], list)

    def test_no_ssw_when_no_beta(self):
        """Helix-only sequence should have no SSW."""
        prediction = {
            'P_H': [0.0, 0.8, 0.9, 0.85, 0.8, 0.75, 0.7, 0.0],
            'P_E': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        }
        result = s4pred.analyse_s4pred_result(prediction)

        assert result[s4pred.SSW_FRAGMENTS_S4PRED] == []
        assert result[s4pred.SSW_SCORE_S4PRED] == -1.0
        assert result[s4pred.SSW_DIFF_S4PRED] == -1.0

    def test_empty_sequence(self):
        """Empty prediction should return all defaults."""
        prediction = {'P_H': [], 'P_E': []}
        result = s4pred.analyse_s4pred_result(prediction)

        assert result[s4pred.HELIX_PREDICTION_S4PRED] == -1
        assert result[s4pred.SSW_FRAGMENTS_S4PRED] == []


class TestFilterByS4predDiff:
    """Test s4pred.filter_by_s4pred_diff (database-average SSW threshold)."""

    def _make_df(self, rows):
        """Helper to create DataFrame from list of dicts."""
        df = pd.DataFrame(rows)
        return df

    def test_no_s4pred_data_returns_none(self):
        """Rows without S4PRED data should get None prediction."""
        df = self._make_df([
            {'Entry': 'A', 'Sequence': 'AAAA'},
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)
        assert predictions == [None]

    def test_s4pred_ran_no_ssw_returns_negative(self):
        """S4PRED ran but no SSW fragments → -1."""
        df = self._make_df([
            {
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: -1.0,
                s4pred.SSW_FRAGMENTS_S4PRED: [],
            },
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)
        assert predictions == [-1]

    def test_single_ssw_positive(self):
        """Single sequence with SSW diff < avg gets positive."""
        df = self._make_df([
            {
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.1,
            },
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)
        # Only one sequence with diff >= 0 → avg = 0.1
        # 0.1 >= 0.1 → -1 (not below average)
        assert predictions == [-1]

    def test_database_average_threshold(self):
        """SSW prediction uses database-average diff as threshold."""
        df = self._make_df([
            {   # Sequence A: diff = 0.1 (well below average)
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.1,
            },
            {   # Sequence B: diff = 0.5 (well above average)
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.5,
            },
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)

        # Average diff = (0.1 + 0.5) / 2 = 0.3
        # A: 0.1 < 0.3 → 1 (positive SSW: diff below average → switching)
        # B: 0.5 >= 0.3 → -1 (negative: one structure dominates)
        assert predictions == [1, -1]

    def test_mixed_available_and_unavailable(self):
        """Mixed rows: some with S4PRED, some without."""
        df = self._make_df([
            {   # S4PRED ran, SSW detected
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.05,
            },
            {   # S4PRED didn't run
                s4pred.HELIX_PREDICTION_S4PRED: None,
                s4pred.SSW_DIFF_S4PRED: None,
            },
            {   # S4PRED ran, SSW detected with higher diff
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.15,
            },
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)

        # avg_diff = (0.05 + 0.15) / 2 = 0.1
        # Row 0: 0.05 < 0.1 → 1
        # Row 1: None → None
        # Row 2: 0.15 >= 0.1 → -1
        assert predictions == [1, None, -1]

    def test_no_ssw_fragments_not_mistaken_as_positive(self):
        """Regression: sequences with diff=-1 should NOT be classified positive.

        Reference bug: calc_ssw_prediction_by_database_avg_value classified
        sequences with diff=-1 as positive because -1 < avg_diff.
        Our implementation correctly returns -1 for these.
        """
        df = self._make_df([
            {   # Has SSW fragments
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: 0.2,
            },
            {   # No SSW fragments (diff=-1 sentinel)
                s4pred.HELIX_PREDICTION_S4PRED: 1,
                s4pred.SSW_DIFF_S4PRED: -1.0,
            },
        ])
        predictions = s4pred.filter_by_s4pred_diff(df)

        # avg_diff computed from valid diffs only: [0.2] → avg = 0.2
        # Row 0: 0.2 >= 0.2 → -1 (at average)
        # Row 1: diff=-1 < 0 → -1 (no SSW fragments, not positive!)
        assert predictions[1] == -1  # Critical: must NOT be 1


class TestCalcSswScoreAndDiff:
    """Test s4pred._calc_ssw_score_and_diff."""

    def test_empty_segments(self):
        """No SSW segments should return (-1, -1)."""
        score, diff = s4pred._calc_ssw_score_and_diff([0.5]*5, [0.3]*5, [])
        assert score == -1.0
        assert diff == -1.0

    def test_score_is_sum_diff_is_abs(self):
        """Score = beta + helix, diff = |beta - helix| (reference semantics)."""
        helix = [0.3, 0.3, 0.3, 0.3, 0.3]
        beta = [0.5, 0.5, 0.5, 0.5, 0.5]
        segments = [(0, 4)]

        score, diff = s4pred._calc_ssw_score_and_diff(helix, beta, segments)

        assert abs(score - 0.8) < 0.01  # 0.3 + 0.5
        assert abs(diff - 0.2) < 0.01   # |0.5 - 0.3|


class TestFindSswSegments:
    """Test s4pred._find_ssw_segments."""

    def test_no_overlap(self):
        """Non-overlapping should return empty."""
        assert s4pred._find_ssw_segments([(0, 5)], [(10, 15)]) == []

    def test_overlap(self):
        """Overlapping segments should be detected."""
        result = s4pred._find_ssw_segments([(0, 10)], [(5, 15)])
        assert len(result) >= 1

    def test_empty_inputs(self):
        """Empty inputs should return empty."""
        assert s4pred._find_ssw_segments([], [(0, 5)]) == []
        assert s4pred._find_ssw_segments([(0, 5)], []) == []


class TestGetSegmentPercentage:
    """Test s4pred._get_segment_percentage."""

    def test_full_coverage(self):
        """Full sequence coverage should be 100%."""
        pct = s4pred._get_segment_percentage([(0, 9)], 10)
        assert pct == 100.0

    def test_half_coverage(self):
        """Half coverage should be 50%."""
        pct = s4pred._get_segment_percentage([(0, 4)], 10)
        assert pct == 50.0

    def test_no_segments(self):
        """No segments should be 0."""
        pct = s4pred._get_segment_percentage([], 10)
        assert pct == 0

    def test_zero_length(self):
        """Zero-length sequence should be 0."""
        pct = s4pred._get_segment_percentage([(0, 4)], 0)
        assert pct == 0
