"""
Tests for non-standard amino acid handling across the pipeline.

Non-standard residues in UniProt sequences:
  X → unknown (substitute A)
  B → Asp or Asn ambiguity (substitute D)
  Z → Glu or Gln ambiguity (substitute E)
  U → Selenocysteine (substitute C)
  O → Pyrrolysine (substitute K — closest standard AA by charge/size)
  J → Leucine or Isoleucine (substitute L)

These MUST NOT crash any biochem function.
"""

import biochem_calculation
from auxiliary import get_corrected_sequence

# --- get_corrected_sequence ---


class TestCorrectedSequence:
    """All non-standard AAs must be substituted before calculations."""

    def test_x_to_a(self):
        assert get_corrected_sequence("AXXA") == "AAAA"

    def test_b_to_d(self):
        assert get_corrected_sequence("ABBA") == "ADDA"

    def test_z_to_e(self):
        assert get_corrected_sequence("AZZA") == "AEEA"

    def test_u_to_c(self):
        assert get_corrected_sequence("AUUA") == "ACCA"

    def test_o_to_k(self):
        """O (pyrrolysine) must map to K. TANGO sanitizer does this already."""
        assert get_corrected_sequence("AOOA") == "AKKA"

    def test_j_to_l(self):
        """J (Leu/Ile ambiguity) must map to L."""
        assert get_corrected_sequence("AJJA") == "ALLA"

    def test_all_nonstandard(self):
        result = get_corrected_sequence("XBZUOJ")
        assert result == "ADECKL"

    def test_none_returns_empty(self):
        assert get_corrected_sequence(None) == ""

    def test_nan_returns_empty(self):
        assert get_corrected_sequence(float("nan")) == ""

    def test_dash_takes_first_part(self):
        assert get_corrected_sequence("AAAA-BBB") == "AAAA"

    def test_lowercase_uppercased(self):
        assert get_corrected_sequence("akla") == "AKLA"

    def test_digits_stripped(self):
        assert get_corrected_sequence("ABC123DEF") == "ADCDEF"  # B→D, digits stripped

    def test_all_digits_returns_empty(self):
        assert get_corrected_sequence("12345") == ""

    def test_spaces_stripped(self):
        assert get_corrected_sequence("AC GT") == "ACGT"

    def test_symbols_stripped(self):
        assert get_corrected_sequence("AC!@#GT") == "ACGT"

    def test_standard_unchanged(self):
        assert get_corrected_sequence("ACDEFGHIKLMNPQRSTVWY") == "ACDEFGHIKLMNPQRSTVWY"

    def test_mixed_invalid_with_substitutions(self):
        # strip non-letters first → "FOFJJJ", then O→K, J→L → "FKFLLL"
        assert get_corrected_sequence("FOF123JJJ") == "FKFLLL"


# --- hydrophobicity: must not crash on unknown AA ---


class TestHydrophobicityRobust:
    """hydrophobicity() must handle unknown AAs gracefully."""

    def test_standard_aa_unchanged(self):
        """Standard AAs should still work normally."""
        result = biochem_calculation.hydrophobicity("AAAA")
        assert abs(result - 0.31) < 0.001

    def test_unknown_aa_does_not_crash(self):
        """Unknown AAs should use fallback value (0.0), not crash."""
        # X is not in Fauchere_Pliska — should NOT raise KeyError
        result = biochem_calculation.hydrophobicity("AXXA")
        assert isinstance(result, (int, float))

    def test_all_unknown_returns_zero(self):
        """Sequence of only unknown AAs should return 0.0 (fallback)."""
        result = biochem_calculation.hydrophobicity("XXX")
        assert abs(result - 0.0) < 0.001

    def test_mixed_known_unknown(self):
        """Mix of known + unknown should average correctly."""
        # A(0.31), X(0.0), A(0.31) → mean = 0.62/3 ≈ 0.207
        result = biochem_calculation.hydrophobicity("AXA")
        expected = (0.31 + 0.0 + 0.31) / 3
        assert abs(result - expected) < 0.001


# --- hydrophobic_moment (muH): must not crash on unknown AA ---


class TestHydrophobicMomentRobust:
    """hydrophobic_moment() must handle unknown AAs gracefully."""

    def test_standard_aa_unchanged(self):
        result = biochem_calculation.hydrophobic_moment("AAAA")
        assert isinstance(result, float)
        assert result >= 0

    def test_unknown_aa_does_not_crash(self):
        """Unknown AAs in hydrophobic moment should not cause TypeError."""
        result = biochem_calculation.hydrophobic_moment("AXXA")
        assert isinstance(result, (int, float))

    def test_all_unknown_returns_zero(self):
        """All-unknown sequence should give muH ≈ 0."""
        result = biochem_calculation.hydrophobic_moment("XXX")
        assert abs(result) < 0.001

    def test_o_does_not_crash(self):
        """O (pyrrolysine) must not crash calculations."""
        result = biochem_calculation.hydrophobic_moment("AOOA")
        assert isinstance(result, (int, float))


# --- total_charge: already uses .get() so should be safe, but verify ---


class TestTotalChargeRobust:
    """Verify total_charge handles unknown AAs (should already work via .get(aa, 0))."""

    def test_unknown_aa_contributes_zero(self):
        assert biochem_calculation.total_charge("X") == 0
        assert biochem_calculation.total_charge("O") == 0
        assert biochem_calculation.total_charge("J") == 0

    def test_mixed_known_unknown(self):
        # K(+1) + X(0) + D(-1) = 0
        assert biochem_calculation.total_charge("KXD") == 0
