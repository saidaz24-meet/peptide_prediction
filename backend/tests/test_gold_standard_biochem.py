"""
Gold-standard regression tests for biochemical calculations.

Validates charge, hydrophobicity, and muH calculations against
the verified Staphylococcus 2023 dataset (2916 peptides, all values
confirmed correct by Peleg lab).

These tests are deterministic — no TANGO/S4PRED needed.
"""
import json
import math
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import biochem_calculation as biochem

FIXTURE_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "gold_standard_sample.json"
)


@pytest.fixture(scope="module")
def gold_peptides():
    with open(FIXTURE_PATH) as f:
        data = json.load(f)
    return data["peptides"]


class TestChargeAgainstGoldStandard:
    """
    Verify total_charge matches gold-standard values.

    Convention difference: Our pipeline uses H=+0.1 (fractional charge
    at pH 7.4, pKa ~6.0 partial protonation). The gold standard uses
    integer charges (H=0). The difference is exactly 0.1 * H_count.
    Both are valid biochemical conventions.
    """

    def test_charge_all_peptides_accounting_for_histidine(self, gold_peptides):
        """Charge must match after accounting for the H=+0.1 convention."""
        mismatches = []
        for p in gold_peptides:
            seq = p["Sequence"]
            gold_int_charge = p["Charge"]
            actual = biochem.total_charge(seq)
            # Our charge = gold_charge + 0.1 * count(H)
            h_count = seq.upper().count("H")
            expected_with_h = gold_int_charge + 0.1 * h_count
            if not math.isclose(actual, expected_with_h, abs_tol=1e-9):
                mismatches.append(
                    f"{p['Entry']}: expected={expected_with_h}, got={actual}, "
                    f"H_count={h_count}"
                )
        assert not mismatches, (
            f"{len(mismatches)} charge mismatches:\n" + "\n".join(mismatches)
        )

    def test_charge_no_histidine_exact_match(self, gold_peptides):
        """Peptides without histidine must match the gold standard exactly."""
        for p in gold_peptides:
            seq = p["Sequence"]
            if "H" not in seq.upper():
                expected = p["Charge"]
                actual = biochem.total_charge(seq)
                assert actual == expected, (
                    f"{p['Entry']}: expected={expected}, got={actual}"
                )

    @pytest.mark.parametrize(
        "entry_id,gold_charge",
        [
            ("Q7DKL7", 2),       # Short peptide (len=8), MTASMRLK (no H)
            ("A0A7U7EZ98", 19),  # Highest positive charge (1 H → +0.1)
            ("A0A0E1VP86", -9),  # Most negative charge (2 H → +0.2)
            ("A0A6G4N8C5", 0),   # Zero charge (all hydrophobic, no H)
            ("L0N9I6", 0),       # Zero charge (lots of D,E,K,N, no H)
        ],
    )
    def test_charge_specific_cases(self, gold_peptides, entry_id, gold_charge):
        p = next(x for x in gold_peptides if x["Entry"] == entry_id)
        seq = p["Sequence"]
        h_count = seq.upper().count("H")
        expected = gold_charge + 0.1 * h_count
        actual = biochem.total_charge(seq)
        assert math.isclose(actual, expected, abs_tol=1e-9), (
            f"expected={expected}, got={actual}, H_count={h_count}"
        )


class TestHydrophobicityAgainstGoldStandard:
    """Verify hydrophobicity matches gold-standard values (Fauchere-Pliska mean)."""

    def test_hydrophobicity_all_peptides(self, gold_peptides):
        mismatches = []
        for p in gold_peptides:
            seq = p["Sequence"]
            expected = p["Hydrophobicity"]
            actual = biochem.hydrophobicity(seq)
            if not math.isclose(actual, expected, rel_tol=1e-9):
                mismatches.append(
                    f"{p['Entry']}: expected={expected:.10f}, "
                    f"got={actual:.10f}, delta={abs(actual - expected):.2e}"
                )
        assert not mismatches, (
            f"{len(mismatches)} hydrophobicity mismatches:\n" + "\n".join(mismatches)
        )

    @pytest.mark.parametrize(
        "entry_id,expected_hydro",
        [
            ("A0A6G4N8C5", 1.422173913043478),  # Highest
            ("L0N9I6", -0.4784375),               # Lowest
        ],
    )
    def test_hydrophobicity_extremes(self, gold_peptides, entry_id, expected_hydro):
        p = next(x for x in gold_peptides if x["Entry"] == entry_id)
        actual = biochem.hydrophobicity(p["Sequence"])
        assert math.isclose(actual, expected_hydro, rel_tol=1e-9)


class TestMuHAgainstGoldStandard:
    """Verify hydrophobic moment (muH) matches gold-standard values."""

    def test_alpha_helix_muH_all_peptides(self, gold_peptides):
        """Full length uH uses alpha-helix angle (100 degrees)."""
        mismatches = []
        for p in gold_peptides:
            seq = p["Sequence"]
            expected = p["Full length uH"]
            actual = biochem.hydrophobic_moment(seq, angle=100)
            if not math.isclose(actual, expected, rel_tol=1e-6):
                mismatches.append(
                    f"{p['Entry']}: expected={expected:.10f}, "
                    f"got={actual:.10f}, delta={abs(actual - expected):.2e}"
                )
        assert not mismatches, (
            f"{len(mismatches)} alpha-helix muH mismatches:\n" + "\n".join(mismatches)
        )

    def test_beta_sheet_muH_all_peptides(self, gold_peptides):
        """Beta full length uH uses beta-sheet angle (160 degrees)."""
        mismatches = []
        for p in gold_peptides:
            seq = p["Sequence"]
            expected = p["Beta full length uH"]
            actual = biochem.hydrophobic_moment(seq, angle=160)
            if not math.isclose(actual, expected, rel_tol=1e-6):
                mismatches.append(
                    f"{p['Entry']}: expected={expected:.10f}, "
                    f"got={actual:.10f}, delta={abs(actual - expected):.2e}"
                )
        assert not mismatches, (
            f"{len(mismatches)} beta-sheet muH mismatches:\n" + "\n".join(mismatches)
        )

    @pytest.mark.parametrize(
        "entry_id,expected_uH",
        [
            ("A0A0H2WXY3", 0.6606693202951265),  # Highest uH
            ("P03063", 0.003040539333387482),      # Lowest uH (>0)
        ],
    )
    def test_muH_extremes(self, gold_peptides, entry_id, expected_uH):
        p = next(x for x in gold_peptides if x["Entry"] == entry_id)
        actual = biochem.hydrophobic_moment(p["Sequence"], angle=100)
        assert math.isclose(actual, expected_uH, rel_tol=1e-6)


class TestSSWPredictionGoldStandard:
    """
    Validate SSW prediction semantics against gold-standard conventions.
    These tests verify our understanding of the data, not TANGO calculations.
    """

    def test_no_fragments_implies_negative_prediction(self, gold_peptides):
        """Entries with empty SSW fragments should have SSW prediction = -1."""
        for p in gold_peptides:
            if not p["SSW fragments"]:  # empty list
                assert p["SSW prediction"] == -1, (
                    f"{p['Entry']}: no SSW fragments but prediction={p['SSW prediction']}"
                )

    def test_no_fragments_implies_sentinel_diff(self, gold_peptides):
        """Entries with empty SSW fragments should have SSW diff = -1 (sentinel)."""
        for p in gold_peptides:
            if not p["SSW fragments"]:
                assert p["SSW diff"] == -1.0, (
                    f"{p['Entry']}: no SSW fragments but diff={p['SSW diff']}"
                )

    def test_no_fragments_implies_sentinel_score(self, gold_peptides):
        """Entries with empty SSW fragments should have SSW score = -1 (sentinel)."""
        for p in gold_peptides:
            if not p["SSW fragments"]:
                assert p["SSW score"] == -1.0, (
                    f"{p['Entry']}: no SSW fragments but score={p['SSW score']}"
                )

    def test_positive_prediction_has_fragments(self, gold_peptides):
        """SSW prediction = 1 implies non-empty SSW fragments."""
        for p in gold_peptides:
            if p["SSW prediction"] == 1:
                assert len(p["SSW fragments"]) > 0, (
                    f"{p['Entry']}: SSW prediction=1 but no fragments"
                )

    def test_zero_helix_implies_no_fragments(self, gold_peptides):
        """If SSW helix % = 0, there should be no SSW fragments."""
        for p in gold_peptides:
            if p["SSW helix percentage"] == 0.0:
                assert not p["SSW fragments"], (
                    f"{p['Entry']}: helix%=0 but has fragments: {p['SSW fragments']}"
                )
