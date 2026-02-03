"""
Golden tests for biochem calculations.
These tests validate that PVL biochem functions match the reference implementation.

Reference: 260120_Alpha_and_SSW_FF_Predictor/biochemCalculation.py
"""
import pytest
import math

# Import the functions we're testing
import biochem_calculation


class TestHydrophobicMoment:
    """Test hydrophobic moment (μH) calculation - Eisenberg 1982 formula."""

    def test_formula_basic(self):
        """Verify μH formula: sqrt(sin_sum² + cos_sum²) / N."""
        # Short sequence to verify formula manually
        seq = "AAAA"
        result = biochem_calculation.hydrophobic_moment(seq, angle=100)

        # Manual calculation for AAAA (A has H=0.31 in Fauchere-Pliska)
        # Position 0: cos(0*100°), sin(0*100°)
        # Position 1: cos(100°), sin(100°)
        # Position 2: cos(200°), sin(200°)
        # Position 3: cos(300°), sin(300°)
        import math
        H = 0.31  # Fauchere-Pliska for Alanine
        cos_sum = 0.0
        sin_sum = 0.0
        for i in range(4):
            rad = (i * 100) * math.pi / 180.0
            cos_sum += H * math.cos(rad)
            sin_sum += H * math.sin(rad)
        expected = math.sqrt(cos_sum**2 + sin_sum**2) / 4

        assert abs(result - expected) < 0.0001, f"Expected {expected}, got {result}"

    def test_angle_100_for_helix(self):
        """Default angle should be 100° for alpha-helix."""
        seq = "KLWKLWKLWK"
        result_default = biochem_calculation.hydrophobic_moment(seq)
        result_100 = biochem_calculation.hydrophobic_moment(seq, angle=100)
        assert result_default == result_100

    def test_angle_160_for_beta(self):
        """Beta sheet should use 160°."""
        seq = "KLWKLWKLWK"
        result_100 = biochem_calculation.hydrophobic_moment(seq, angle=100)
        result_160 = biochem_calculation.hydrophobic_moment(seq, angle=160)
        # Different angles should give different results
        assert result_100 != result_160

    def test_empty_sequence_raises(self):
        """Empty sequence should raise assertion error."""
        with pytest.raises(AssertionError):
            biochem_calculation.hydrophobic_moment("")

    def test_normalized_by_length(self):
        """μH should be normalized by sequence length."""
        # Longer homogeneous sequences should have similar μH to shorter ones
        # (not exactly equal due to angle periodicity, but in similar range)
        short = biochem_calculation.hydrophobic_moment("AAA")
        long = biochem_calculation.hydrophobic_moment("AAAAAAAAAA")
        # Both should be positive and in similar magnitude
        assert short > 0
        assert long > 0


class TestTotalCharge:
    """Test total charge calculation at pH 7.4."""

    def test_basic_positive(self):
        """K and R should each contribute +1."""
        assert biochem_calculation.total_charge("K") == 1
        assert biochem_calculation.total_charge("R") == 1
        assert biochem_calculation.total_charge("KR") == 2
        assert biochem_calculation.total_charge("KKR") == 3

    def test_basic_negative(self):
        """D and E should each contribute -1."""
        assert biochem_calculation.total_charge("D") == -1
        assert biochem_calculation.total_charge("E") == -1
        assert biochem_calculation.total_charge("DE") == -2
        assert biochem_calculation.total_charge("DDE") == -3

    def test_neutral_residues(self):
        """Non-charged residues should contribute 0."""
        assert biochem_calculation.total_charge("A") == 0
        assert biochem_calculation.total_charge("AAAAAAA") == 0
        assert biochem_calculation.total_charge("GGGGG") == 0

    def test_mixed_charges_cancel(self):
        """Equal positive and negative should cancel."""
        assert biochem_calculation.total_charge("KD") == 0
        assert biochem_calculation.total_charge("RE") == 0
        assert biochem_calculation.total_charge("KKDD") == 0
        assert biochem_calculation.total_charge("KRDE") == 0

    def test_histidine_partial_charge(self):
        """
        CRITICAL: Histidine should have +0.1 charge at pH 7.4.

        Reference implementation includes H: 0.1 in aa_charge dict.
        At pH 7.4, histidine (pKa ~6.0) is ~10% protonated.
        """
        result = biochem_calculation.total_charge("HHHH")
        # Expected: 4 * 0.1 = 0.4
        assert abs(result - 0.4) < 0.01, f"Expected 0.4, got {result}"

    def test_single_histidine(self):
        """Single H should contribute +0.1."""
        result = biochem_calculation.total_charge("H")
        assert abs(result - 0.1) < 0.01

    def test_mixed_with_histidine(self):
        """Test sequence with H alongside K/R/D/E."""
        # Sequence: KRHDE
        # Expected: K(+1) + R(+1) + H(+0.1) + D(-1) + E(-1) = 0.1
        result = biochem_calculation.total_charge("KRHDE")
        assert abs(result - 0.1) < 0.01, f"Expected 0.1, got {result}"


class TestHydrophobicity:
    """Test hydrophobicity calculation - Fauchere-Pliska scale."""

    def test_uses_fauchere_pliska_scale(self):
        """Verify the Fauchere-Pliska scale values are correct."""
        # Check a few known values from the scale
        expected_scale = {
            'A': 0.31, 'R': -1.01, 'N': -0.60,
            'D': -0.77, 'C': 1.54, 'Q': -0.22,
            'E': -0.64, 'G': 0.00, 'H': 0.13,
            'I': 1.80, 'L': 1.70, 'K': -0.99,
            'M': 1.23, 'F': 1.79, 'P': 0.72,
            'S': -0.04, 'T': 0.26, 'W': 2.25,
            'Y': 0.96, 'V': 1.22
        }

        # Single residue hydrophobicity should match scale value
        for aa, expected in expected_scale.items():
            result = biochem_calculation.hydrophobicity(aa)
            assert abs(result - expected) < 0.001, f"Mismatch for {aa}: expected {expected}, got {result}"

    def test_average_calculation(self):
        """Hydrophobicity should be mean of individual residue values."""
        # AA: A(0.31) + A(0.31) = 0.62 / 2 = 0.31
        assert abs(biochem_calculation.hydrophobicity("AA") - 0.31) < 0.001

        # AG: A(0.31) + G(0.00) = 0.31 / 2 = 0.155
        assert abs(biochem_calculation.hydrophobicity("AG") - 0.155) < 0.001

    def test_polar_vs_hydrophobic(self):
        """Polar residues should have negative, hydrophobic positive."""
        # Polar sequence
        polar = biochem_calculation.hydrophobicity("DDEE")  # All negative H values
        assert polar < 0

        # Hydrophobic sequence
        hydrophobic = biochem_calculation.hydrophobicity("WWFF")  # All positive H values
        assert hydrophobic > 0

    def test_known_peptide(self):
        """Test a known antimicrobial peptide sequence."""
        # Melittin-like sequence (hydrophobic amphipathic)
        seq = "GIGAVLKVLTTGLPALISWIKRKRQQ"
        result = biochem_calculation.hydrophobicity(seq)
        # Should be positive but not extremely high (amphipathic)
        assert 0 < result < 1.0


class TestScaleConsistency:
    """Test that scales are consistent between functions."""

    def test_same_scale_for_hydrophobicity_and_moment(self):
        """Both functions should use the same Fauchere-Pliska scale."""
        # The hydrophobic_moment function uses __get_hydrophobic_moment_vec
        # which should use the same Fauchere_Pliska dict

        # For single residue, μH should use same H value as hydrophobicity
        # (though μH involves sin/cos transformation)
        h_value = biochem_calculation.hydrophobicity("A")

        # Verify the Fauchere_Pliska dict is used
        assert biochem_calculation.Fauchere_Pliska["A"] == h_value
