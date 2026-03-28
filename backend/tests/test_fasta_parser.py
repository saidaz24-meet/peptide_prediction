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
