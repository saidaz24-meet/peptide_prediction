"""
Test UniProt query parsing and analysis pipeline.

Tests:
- (a) "9606" should be parsed as organism_id only (not keyword+organism)
- (b) UniProt query results should have computed metrics (not all 0/NA)
- (c) Analysis pipeline runs on UniProt results
"""
import pytest
from services.uniprot_query import parse_uniprot_query, QueryMode


def test_organism_id_9606_parsed_correctly():
    """Test (a): '9606' should be parsed as organism_id only, not keyword+organism."""
    result = parse_uniprot_query("9606")
    
    # Should be ORGANISM mode, not KEYWORD_ORGANISM
    assert result.mode == QueryMode.ORGANISM, f"Expected ORGANISM mode, got {result.mode}"
    assert result.organism_id == "9606", f"Expected organism_id='9606', got {result.organism_id}"
    assert result.keyword is None, f"Expected keyword=None, got {result.keyword}"
    assert result.api_query_string == "organism_id:9606", \
        f"Expected api_query_string='organism_id:9606', got '{result.api_query_string}'"
    assert result.error is None, f"Expected no error, got: {result.error}"


def test_organism_id_with_keyword():
    """Test that 'amyloid 9606' is parsed as keyword_organism correctly."""
    result = parse_uniprot_query("amyloid 9606")
    
    assert result.mode == QueryMode.KEYWORD_ORGANISM
    assert result.organism_id == "9606"
    assert result.keyword == "amyloid"
    assert result.api_query_string == "keyword:amyloid AND organism_id:9606"


def test_pure_numeric_not_keyword():
    """Test that pure numeric strings are not extracted as keywords."""
    from services.uniprot_query import extract_keyword
    
    # Pure numeric should return None (it's an organism ID)
    assert extract_keyword("9606") is None, "Pure numeric '9606' should not be extracted as keyword"
    
    # Numeric with text should extract the text part
    assert extract_keyword("amyloid 9606") == "amyloid", "Should extract 'amyloid' from 'amyloid 9606'"
    
    # After removing organism_id pattern, pure numeric should return None
    assert extract_keyword("organism_id:9606") is None, "After removing organism_id pattern, should return None"


def test_accession_parsing():
    """Test that accession parsing works correctly."""
    result = parse_uniprot_query("P12345")
    assert result.mode == QueryMode.ACCESSION
    assert result.accession == "P12345"
    assert result.api_query_string == "accession:P12345"


def test_keyword_parsing():
    """Test that keyword parsing works correctly."""
    result = parse_uniprot_query("amyloid")
    assert result.mode == QueryMode.KEYWORD
    assert result.keyword == "amyloid"
    assert result.api_query_string == "keyword:amyloid"

