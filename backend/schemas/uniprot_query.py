"""
Pydantic schemas for UniProt query parsing and execution.
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class UniProtQueryParseRequest(BaseModel):
    """Request to parse a UniProt query"""
    query: str = Field(..., description="Raw query text from user")


class UniProtQueryParseResponse(BaseModel):
    """Response from query parser"""
    mode: Literal["accession", "keyword", "organism", "keyword_organism", "unknown"] = Field(
        ..., description="Detected query mode"
    )
    accession: Optional[str] = Field(None, description="Extracted accession if mode is accession")
    keyword: Optional[str] = Field(None, description="Extracted keyword if mode is keyword or keyword_organism")
    organism_id: Optional[str] = Field(None, description="Extracted organism ID if mode is organism or keyword_organism")
    normalized_query: str = Field(..., description="Normalized version of input query")
    api_query_string: str = Field(..., description="Final UniProt API query string that will be executed")
    error: Optional[str] = Field(None, description="Error message if parsing failed")


class UniProtQueryExecuteRequest(BaseModel):
    """Request to execute a UniProt query"""
    query: str = Field(..., description="Raw query text or pre-parsed API query string")
    mode: Optional[Literal["accession", "keyword", "organism", "keyword_organism", "auto"]] = Field(
        "auto", description="Query mode (auto = detect automatically)"
    )
    reviewed: Optional[bool] = Field(
        True, description="If True, only reviewed (Swiss-Prot). If False, only unreviewed (TrEMBL). If None, both."
    )
    length_min: Optional[int] = Field(
        None, description="Minimum sequence length filter"
    )
    length_max: Optional[int] = Field(
        None, description="Maximum sequence length filter"
    )
    sort: Optional[str] = Field(
        None, description="Sort order in UniProt format (e.g., 'length asc', 'length desc', 'protein_name asc', etc.). Omit or null for best match."
    )
    include_isoforms: Optional[bool] = Field(
        False, description="Include isoform sequences"
    )
    size: Optional[int] = Field(
        500, description="Maximum number of results to return"
    )
    # Provider execution flags (default False for UniProt queries to ensure fast response)
    run_tango: Optional[bool] = Field(
        False, description="If True, run TANGO analysis (default False for UniProt queries to ensure fast response)"
    )
    run_psipred: Optional[bool] = Field(
        False, description="If True, run PSIPRED analysis (default False for UniProt queries to ensure fast response)"
    )
    max_provider_sequences: Optional[int] = Field(
        50, description="Maximum number of sequences to process with providers (TANGO/PSIPRED) when enabled. Prevents blocking on large queries."
    )

