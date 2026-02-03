"""
Golden tests for sequence preprocessing.
Validates that PVL matches reference implementation's handling of ambiguous amino acid codes.

Reference: 260120_Alpha_and_SSW_FF_Predictor/auxiliary.py:get_corrected_sequence()

Key mappings (matching reference):
- B (Asx: D or N) → D (aspartate)
- Z (Glx: E or Q) → E (glutamate)
- X (unknown) → A (alanine) in auxiliary, dropped in TANGO sanitizer
- U (selenocysteine) → C (cysteine)
"""
import pytest

import auxiliary
from tango import _sanitize_seq


class TestAuxiliaryPreprocessing:
    """Test auxiliary.get_corrected_sequence() matches reference."""

    def test_b_maps_to_aspartate(self):
        """B (Asx) should map to D (aspartate), matching reference."""
        assert auxiliary.get_corrected_sequence("ABCD") == "ADCD"
        assert auxiliary.get_corrected_sequence("BBBB") == "DDDD"

    def test_z_maps_to_glutamate(self):
        """Z (Glx) should map to E (glutamate), matching reference."""
        assert auxiliary.get_corrected_sequence("AZCD") == "AECD"
        assert auxiliary.get_corrected_sequence("ZZZZ") == "EEEE"

    def test_x_maps_to_alanine(self):
        """X (unknown) should map to A (alanine), matching reference."""
        assert auxiliary.get_corrected_sequence("AXCD") == "AACD"
        assert auxiliary.get_corrected_sequence("XXXX") == "AAAA"

    def test_u_maps_to_cysteine(self):
        """U (selenocysteine) should map to C (cysteine), matching reference."""
        assert auxiliary.get_corrected_sequence("AUCD") == "ACCD"
        assert auxiliary.get_corrected_sequence("UUUU") == "CCCC"

    def test_combined_ambiguous_codes(self):
        """All ambiguous codes should be resolved correctly."""
        # B→D, Z→E, X→A, U→C
        assert auxiliary.get_corrected_sequence("BXZU") == "DAEC"

    def test_hyphen_splits_sequence(self):
        """Hyphen should split sequence, taking first part only."""
        assert auxiliary.get_corrected_sequence("ABCD-EFGH") == "ADCD"

    def test_lowercase_converted_to_uppercase(self):
        """Lowercase should be converted to uppercase.

        Note: Replacements happen BEFORE uppercase conversion in reference,
        so lowercase 'b' becomes uppercase 'B' (not converted to 'D').
        Only uppercase B/Z/X/U are replaced.
        """
        # lowercase letters are converted to uppercase AFTER replacements
        # so 'b' → 'B' (not 'D'), 'z' → 'Z' (not 'E')
        assert auxiliary.get_corrected_sequence("abcd") == "ABCD"
        # But uppercase B/Z are replaced
        assert auxiliary.get_corrected_sequence("ABCD") == "ADCD"

    def test_standard_amino_acids_unchanged(self):
        """Standard 20 amino acids should pass through unchanged."""
        standard = "ACDEFGHIKLMNPQRSTVWY"
        assert auxiliary.get_corrected_sequence(standard) == standard


class TestTangoSanitizer:
    """Test TANGO's _sanitize_seq() matches reference for B/Z codes."""

    def test_b_maps_to_aspartate(self):
        """B (Asx) should map to D (aspartate), matching reference."""
        assert _sanitize_seq("ABCD") == "ADCD"
        assert _sanitize_seq("BBBB") == "DDDD"

    def test_z_maps_to_glutamate(self):
        """Z (Glx) should map to E (glutamate), matching reference."""
        assert _sanitize_seq("AZCD") == "AECD"
        assert _sanitize_seq("ZZZZ") == "EEEE"

    def test_x_is_dropped(self):
        """X (unknown) should be dropped in TANGO sanitizer."""
        # TANGO drops X instead of converting to A
        assert _sanitize_seq("AXCD") == "ACD"
        assert _sanitize_seq("XXXX") == ""

    def test_u_maps_to_cysteine(self):
        """U (selenocysteine) should map to C (cysteine)."""
        assert _sanitize_seq("AUCD") == "ACCD"
        assert _sanitize_seq("UUUU") == "CCCC"

    def test_o_maps_to_lysine(self):
        """O (pyrrolysine) should map to K (lysine)."""
        assert _sanitize_seq("AOCD") == "AKCD"

    def test_stop_codon_dropped(self):
        """Stop codon (*) should be dropped."""
        assert _sanitize_seq("A*CD") == "ACD"

    def test_combined_ambiguous_codes(self):
        """All ambiguous codes should be resolved correctly."""
        # B→D, Z→E, X→dropped, U→C
        assert _sanitize_seq("BXZU") == "DEC"

    def test_standard_amino_acids_unchanged(self):
        """Standard 20 amino acids should pass through unchanged."""
        standard = "ACDEFGHIKLMNPQRSTVWY"
        assert _sanitize_seq(standard) == standard

    def test_lowercase_converted_to_uppercase(self):
        """Lowercase should be converted to uppercase."""
        assert _sanitize_seq("abcd") == "ADCD"


class TestPreprocessingConsistency:
    """Test that both preprocessing functions handle B/Z consistently."""

    def test_b_consistent_between_functions(self):
        """B should map to D in both functions."""
        seq = "ABCDE"
        aux_result = auxiliary.get_corrected_sequence(seq)
        tango_result = _sanitize_seq(seq)
        # Both should have B→D
        assert aux_result[1] == "D"
        assert tango_result[1] == "D"

    def test_z_consistent_between_functions(self):
        """Z should map to E in both functions."""
        seq = "AZCDE"
        aux_result = auxiliary.get_corrected_sequence(seq)
        tango_result = _sanitize_seq(seq)
        # Both should have Z→E
        assert aux_result[1] == "E"
        assert tango_result[1] == "E"

    def test_u_consistent_between_functions(self):
        """U should map to C in both functions."""
        seq = "AUCDE"
        aux_result = auxiliary.get_corrected_sequence(seq)
        tango_result = _sanitize_seq(seq)
        # Both should have U→C
        assert aux_result[1] == "C"
        assert tango_result[1] == "C"


class TestSSWThresholdBoundary:
    """Test SSW prediction at threshold boundary.

    Reference behavior: diff >= avg → -1 (NOT SSW), diff < avg → 1 (IS SSW)
    At boundary (diff == avg): should be -1 (NOT SSW)
    """

    def test_boundary_case_documented(self):
        """Document the expected boundary behavior.

        When diff == avg_diff:
        - Reference: prediction = -1 (NOT SSW)
        - PVL (fixed): prediction = -1 (matches reference)

        This test documents the expected behavior. Full integration test
        would require setting up a dataset where one row has diff == avg.
        """
        # This is a documentation test - actual integration test would be more complex
        # The fix changes default from "<=" to "<", so diff == avg → -1
        pass
