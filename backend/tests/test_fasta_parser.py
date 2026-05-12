"""Tests for FASTA file parsing in dataframe_utils."""

import os

os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

import pytest

from services.dataframe_utils import parse_fasta, read_any_table


class TestParseFasta:
    """parse_fasta() converts FASTA bytes into a DataFrame."""

    def test_single_sequence(self):
        raw = b">seq1\nACDEFGHI\n"
        df = parse_fasta(raw, "test.fasta")
        assert len(df) == 1
        assert df.iloc[0]["Entry"] == "seq1"
        assert df.iloc[0]["Sequence"] == "ACDEFGHI"
        assert df.iloc[0]["Length"] == 8

    def test_multi_sequence(self):
        raw = b">s1\nAAAA\n>s2\nBBBB\n>s3\nCCCC\n"
        df = parse_fasta(raw, "test.fasta")
        assert len(df) == 3
        assert list(df["Entry"]) == ["s1", "s2", "s3"]

    def test_uniprot_header_first_word(self):
        raw = b">sp|P12345|NAME_HUMAN some description\nACDEFG\n"
        df = parse_fasta(raw, "test.fasta")
        assert df.iloc[0]["Entry"] == "sp|P12345|NAME_HUMAN"

    def test_multiline_sequence_concatenated(self):
        raw = b">seq1\nACDE\nFGHI\nKLMN\n"
        df = parse_fasta(raw, "test.fasta")
        assert df.iloc[0]["Sequence"] == "ACDEFGHIKLMN"
        assert df.iloc[0]["Length"] == 12

    def test_blank_lines_between_entries(self):
        raw = b">s1\nAAAA\n\n\n>s2\nBBBB\n"
        df = parse_fasta(raw, "test.fasta")
        assert len(df) == 2

    def test_empty_fasta_raises(self):
        with pytest.raises(ValueError, match="No valid FASTA entries found"):
            parse_fasta(b"", "test.fasta")

    def test_no_headers_raises(self):
        with pytest.raises(ValueError, match="No valid FASTA entries found"):
            parse_fasta(b"ACDEFGHI\n", "test.fasta")

    def test_utf8_bom_handled(self):
        raw = b"\xef\xbb\xbf>seq1\nACDE\n"
        df = parse_fasta(raw, "test.fasta")
        assert len(df) == 1
        assert df.iloc[0]["Entry"] == "seq1"

    def test_columns_present(self):
        raw = b">seq1\nACDE\n"
        df = parse_fasta(raw, "test.fasta")
        assert list(df.columns) == ["Entry", "Sequence", "Length"]


class TestReadAnyTableFasta:
    """read_any_table() routes FASTA files to parse_fasta()."""

    def test_fasta_extension(self):
        raw = b">s1\nACDE\n"
        df = read_any_table(raw, "input.fasta")
        assert len(df) == 1
        assert df.iloc[0]["Entry"] == "s1"

    def test_fa_extension(self):
        raw = b">s1\nACDE\n"
        df = read_any_table(raw, "input.fa")
        assert len(df) == 1

    def test_txt_starting_with_chevron(self):
        raw = b">s1\nACDE\n"
        df = read_any_table(raw, "input.txt")
        assert "Entry" in df.columns
        assert df.iloc[0]["Sequence"] == "ACDE"


class TestParseFastaEdgeCases:
    """Wave 2 §H edge cases — non-standard AA, duplicate IDs, stress."""

    def test_non_standard_aa_letters_preserved(self):
        """B, J, O, U, X, Z are valid IUPAC ambiguity / pyrrolysine /
        selenocysteine codes. The parser keeps them as-is so downstream
        annotation can flag them in ``sequenceNotes`` — it does NOT silently
        rewrite them to A or drop the row."""
        raw = b">amb1\nACDEFGHIBJOUXZ\n>amb2\nXYZ\n"
        df = parse_fasta(raw, "edge.fasta")
        assert df.iloc[0]["Sequence"] == "ACDEFGHIBJOUXZ"
        assert df.iloc[1]["Sequence"] == "XYZ"

    def test_duplicate_ids_kept_not_deduped(self):
        """If a FASTA contains two entries with the same id, BOTH are kept.
        The pipeline tracks them as separate rows; the UI surfaces the
        repetition. Silent dedup would lose data the researcher provided."""
        raw = b">dup\nAAAA\n>dup\nBBBB\n>other\nCCCC\n"
        df = parse_fasta(raw, "dup.fasta")
        assert len(df) == 3
        assert list(df["Entry"]) == ["dup", "dup", "other"]
        # Both 'dup' entries keep their original distinct sequences.
        assert df.iloc[0]["Sequence"] == "AAAA"
        assert df.iloc[1]["Sequence"] == "BBBB"

    def test_100_entry_stress_parse(self):
        """100-entry FASTA parses cleanly and quickly — sanity check that
        the parser doesn't accidentally O(n^2)."""
        body = b"\n".join(
            f">peptide_{i:03d}\nACDE{i:04d}".encode() for i in range(100)
        )
        df = parse_fasta(body, "stress.fasta")
        assert len(df) == 100
        assert df.iloc[0]["Entry"] == "peptide_000"
        assert df.iloc[99]["Entry"] == "peptide_099"

    def test_wrapped_sequence_80_char_lines(self):
        """FASTA convention wraps sequences at 80 chars. The parser
        concatenates wrapped lines into a single Sequence column entry."""
        wrapped = b">long\n" + b"A" * 80 + b"\n" + b"C" * 80 + b"\n" + b"GT\n"
        df = parse_fasta(wrapped, "wrap.fasta")
        assert df.iloc[0]["Sequence"] == "A" * 80 + "C" * 80 + "GT"
        assert df.iloc[0]["Length"] == 162

    def test_example_fasta_fixture_parses(self, tmp_path):
        """The shipped fixture used by the dispatch's curl example must
        parse cleanly so manual verification matches automated runs."""
        from pathlib import Path

        fixture = Path(__file__).parent / "fixtures" / "example.fasta"
        df = parse_fasta(fixture.read_bytes(), "example.fasta")
        assert len(df) == 5
        assert "amyloid_beta_1_42" in list(df["Entry"])
        assert "magainin_2" in list(df["Entry"])
        # Spot-check one sequence to catch any silent corruption.
        ab42_seq = df[df["Entry"] == "amyloid_beta_1_42"].iloc[0]["Sequence"]
        assert ab42_seq.startswith("DAEFRHDSGYEVHHQKLVFFAED")
