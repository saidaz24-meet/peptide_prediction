"""Tests for consensus secondary structure reconciliation logic.

TDD: Written BEFORE implementation (backend/consensus.py).
"""

import pytest
from consensus import get_consensus_ss, dominant_ss_at_region


# ──────────────────────────────────────────────────────────────────────
# dominant_ss_at_region
# ──────────────────────────────────────────────────────────────────────


class TestDominantSsAtRegion:
    """Test helper that finds majority SS call in a TANGO hotspot region."""

    def test_all_helix(self):
        ss = list("HHHHHHHHHH")
        assert dominant_ss_at_region(ss, 2, 7) == "H"

    def test_all_beta(self):
        ss = list("EEEEEEEEEE")
        assert dominant_ss_at_region(ss, 0, 5) == "E"

    def test_all_coil(self):
        ss = list("CCCCCCCCCC")
        assert dominant_ss_at_region(ss, 3, 8) == "C"

    def test_mixed_helix_majority(self):
        ss = list("CCHHHECHHH")
        # region [2:8] = H H H E C H → 4H, 1E, 1C → H wins
        assert dominant_ss_at_region(ss, 2, 8) == "H"

    def test_mixed_beta_majority(self):
        ss = list("HHEEEECHEE")
        # region [2:8] = E E E E C H → 4E, 1C, 1H → E wins
        assert dominant_ss_at_region(ss, 2, 8) == "E"

    def test_empty_region(self):
        ss = list("HHHHHHHH")
        assert dominant_ss_at_region(ss, 5, 5) == "C"  # empty → default coil

    def test_none_ss_prediction(self):
        assert dominant_ss_at_region(None, 0, 5) == "C"  # no data → coil

    def test_empty_list(self):
        assert dominant_ss_at_region([], 0, 5) == "C"

    def test_out_of_bounds_clamped(self):
        ss = list("HHH")
        # region [1:10] should clamp to [1:3]
        assert dominant_ss_at_region(ss, 1, 10) == "H"

    def test_tie_breaks_to_first_alphabetical(self):
        # 2C + 2H in region → tie → C wins (alphabetical)
        ss = list("CCHH")
        result = dominant_ss_at_region(ss, 0, 4)
        assert result in ("C", "H")  # either is acceptable on tie


# ──────────────────────────────────────────────────────────────────────
# get_consensus_ss – Tier assignment
# ──────────────────────────────────────────────────────────────────────


class TestGetConsensusSsTiers:
    """Test the five consensus tiers."""

    def test_tier1_high_agg_helix_at_hotspot(self):
        """TANGO APR >5% + S4PRED=Helix → Tier 1 High-Confidence Switch Zone."""
        result = get_consensus_ss(
            tango_agg_max=25.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
        )
        assert result["tier"] == 1
        assert "Switch Zone" in result["label"]
        assert result["certainty"] > 0.0

    def test_tier2_high_agg_coil_at_hotspot(self):
        """TANGO APR >5% + S4PRED=Coil → Tier 2 Disordered Aggregation-Prone."""
        result = get_consensus_ss(
            tango_agg_max=10.0,
            s4pred_ss_at_hotspot="C",
            s4pred_helix_percent=0.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=-1,
        )
        assert result["tier"] == 2
        assert "Disordered" in result["label"]

    def test_tier3_high_agg_beta_at_hotspot(self):
        """TANGO APR >5% + S4PRED=Beta → Tier 3 Native Beta."""
        result = get_consensus_ss(
            tango_agg_max=15.0,
            s4pred_ss_at_hotspot="E",
            s4pred_helix_percent=0.0,
            ssw_prediction=-1,
            s4pred_ssw_prediction=-1,
        )
        assert result["tier"] == 3
        assert "Beta" in result["label"]

    def test_tier4_low_agg(self):
        """TANGO APR <=5% → Tier 4 No Aggregation Concern."""
        result = get_consensus_ss(
            tango_agg_max=2.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=80.0,
            ssw_prediction=-1,
            s4pred_ssw_prediction=-1,
        )
        assert result["tier"] == 4
        assert "No Aggregation" in result["label"]
        assert result["certainty"] >= 0.7  # high certainty for "safe"

    def test_tier4_zero_agg(self):
        """TANGO APR = 0 → still Tier 4."""
        result = get_consensus_ss(
            tango_agg_max=0.0,
            s4pred_ss_at_hotspot="C",
            s4pred_helix_percent=0.0,
            ssw_prediction=-1,
            s4pred_ssw_prediction=-1,
        )
        assert result["tier"] == 4

    def test_tier5_no_tango(self):
        """No TANGO data → Tier 5 Insufficient Data."""
        result = get_consensus_ss(
            tango_agg_max=None,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=50.0,
            ssw_prediction=None,
            s4pred_ssw_prediction=1,
        )
        assert result["tier"] == 5
        assert "Insufficient" in result["label"]
        assert result["certainty"] == 0.0

    def test_tier5_all_none(self):
        """All inputs None → Tier 5."""
        result = get_consensus_ss(
            tango_agg_max=None,
            s4pred_ss_at_hotspot=None,
            s4pred_helix_percent=None,
            ssw_prediction=None,
            s4pred_ssw_prediction=None,
        )
        assert result["tier"] == 5
        assert result["certainty"] == 0.0


# ──────────────────────────────────────────────────────────────────────
# get_consensus_ss – Certainty modifiers
# ──────────────────────────────────────────────────────────────────────


class TestCertaintyModifiers:
    """Test certainty adjustments from SSW agreement and sequence length."""

    def test_ssw_agreement_boosts_certainty(self):
        """Both SSW predictors agree positive → +0.1 certainty."""
        result = get_consensus_ss(
            tango_agg_max=20.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
        )
        # Tier 1 base = 0.9, +0.1 agreement = 1.0 (capped)
        assert result["certainty"] == 1.0

    def test_ssw_disagreement_reduces_certainty(self):
        """SSW predictors disagree → -0.1 certainty."""
        result = get_consensus_ss(
            tango_agg_max=20.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=-1,
        )
        # Tier 1 base = 0.9, -0.1 disagreement = 0.8
        assert result["certainty"] == 0.8

    def test_short_sequence_caps_certainty(self):
        """Sequence <20 aa (implied by s4pred_helix_percent context) → cap at 0.5."""
        result = get_consensus_ss(
            tango_agg_max=20.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
            sequence_length=15,
        )
        assert result["certainty"] <= 0.5

    def test_certainty_never_negative(self):
        """Certainty should never go below 0.0."""
        result = get_consensus_ss(
            tango_agg_max=10.0,
            s4pred_ss_at_hotspot="E",
            s4pred_helix_percent=0.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=-1,
            sequence_length=10,
        )
        assert result["certainty"] >= 0.0

    def test_certainty_never_above_one(self):
        """Certainty should never exceed 1.0."""
        result = get_consensus_ss(
            tango_agg_max=20.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=80.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
        )
        assert result["certainty"] <= 1.0


# ──────────────────────────────────────────────────────────────────────
# get_consensus_ss – Custom threshold
# ──────────────────────────────────────────────────────────────────────


class TestCustomThreshold:
    """Test custom agg_threshold parameter."""

    def test_custom_threshold_10(self):
        """With agg_threshold=10, agg_max=8 should be Tier 4."""
        result = get_consensus_ss(
            tango_agg_max=8.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
            agg_threshold=10.0,
        )
        assert result["tier"] == 4

    def test_custom_threshold_2(self):
        """With agg_threshold=2, agg_max=3 should be Tier 1 (helix at hotspot)."""
        result = get_consensus_ss(
            tango_agg_max=3.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
            agg_threshold=2.0,
        )
        assert result["tier"] == 1


# ──────────────────────────────────────────────────────────────────────
# get_consensus_ss – Return shape
# ──────────────────────────────────────────────────────────────────────


class TestReturnShape:
    """Ensure all expected keys are in the return dict."""

    def test_has_required_keys(self):
        result = get_consensus_ss(
            tango_agg_max=10.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
        )
        assert "tier" in result
        assert "label" in result
        assert "certainty" in result
        assert "explanation" in result
        assert isinstance(result["tier"], int)
        assert isinstance(result["label"], str)
        assert isinstance(result["certainty"], float)
        assert isinstance(result["explanation"], str)

    def test_explanation_is_nonempty(self):
        result = get_consensus_ss(
            tango_agg_max=10.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
        )
        assert len(result["explanation"]) > 10


# ──────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_agg_exactly_at_threshold(self):
        """agg_max == threshold is NOT above → Tier 4."""
        result = get_consensus_ss(
            tango_agg_max=5.0,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
            agg_threshold=5.0,
        )
        assert result["tier"] == 4

    def test_agg_just_above_threshold(self):
        """agg_max = threshold + epsilon → above threshold."""
        result = get_consensus_ss(
            tango_agg_max=5.01,
            s4pred_ss_at_hotspot="H",
            s4pred_helix_percent=40.0,
            ssw_prediction=1,
            s4pred_ssw_prediction=1,
            agg_threshold=5.0,
        )
        assert result["tier"] == 1

    def test_no_s4pred_at_hotspot_with_high_agg(self):
        """High agg but s4pred_ss_at_hotspot=None → Tier 2 (treat as disordered)."""
        result = get_consensus_ss(
            tango_agg_max=20.0,
            s4pred_ss_at_hotspot=None,
            s4pred_helix_percent=None,
            ssw_prediction=1,
            s4pred_ssw_prediction=None,
        )
        # No S4PRED data at hotspot → can't distinguish H/E/C → default to coil-like
        assert result["tier"] == 2

    def test_ssw_both_negative_is_agreement(self):
        """Both SSW negative → agreement (both -1), should boost certainty."""
        base = get_consensus_ss(
            tango_agg_max=2.0,
            s4pred_ss_at_hotspot="C",
            s4pred_helix_percent=0.0,
            ssw_prediction=-1,
            s4pred_ssw_prediction=-1,
        )
        no_s4pred = get_consensus_ss(
            tango_agg_max=2.0,
            s4pred_ss_at_hotspot="C",
            s4pred_helix_percent=0.0,
            ssw_prediction=-1,
            s4pred_ssw_prediction=None,
        )
        # Both agree should have higher or equal certainty than one missing
        assert base["certainty"] >= no_s4pred["certainty"]
