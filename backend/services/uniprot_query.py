"""
UniProt query parser and API integration.

Parses user input to classify query type (accession, keyword, organism, combinations)
and builds valid UniProt API search strings.
"""
import re
from typing import Dict, List, Optional, Literal, Tuple
from enum import Enum
from dataclasses import dataclass
from dataclasses import dataclass

# UniProt accession pattern (e.g., P12345, A0A1B2C3D4, P12345-1)
ACCESSION_PATTERN = re.compile(r'^[A-NR-Z][0-9]([A-Z][A-Z, 0-9][A-Z, 0-9][0-9]){1,2}(-[0-9]+)?$', re.IGNORECASE)

# Organism ID pattern (taxonomy ID, e.g., 9606 for human)
ORGANISM_ID_PATTERN = re.compile(r'^\d+$')


class QueryMode(str, Enum):
    """UniProt query modes"""
    ACCESSION = "accession"
    KEYWORD = "keyword"
    ORGANISM = "organism"
    KEYWORD_ORGANISM = "keyword_organism"  # Keyword + organism filter
    UNKNOWN = "unknown"


@dataclass
class ParsedUniProtQuery:
    """Result of parsing a UniProt query"""
    mode: QueryMode
    raw_query: str
    normalized_query: str  # Normalized version for display
    api_query_string: str  # Final API query string
    accession: Optional[str] = None
    keyword: Optional[str] = None
    organism_id: Optional[str] = None
    organism_name: Optional[str] = None
    error: Optional[str] = None
    
    def __post_init__(self):
        """Ensure mode is QueryMode enum if passed as string"""
        if isinstance(self.mode, str):
            self.mode = QueryMode(self.mode)


def normalize_query(text: str) -> str:
    """
    Normalize query text: strip whitespace, handle case.
    
    Args:
        text: Raw input text
    
    Returns:
        Normalized string
    """
    if not text:
        return ""
    # Strip leading/trailing whitespace
    normalized = text.strip()
    # Collapse multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def detect_accession(text: str) -> Optional[str]:
    """
    Detect if text contains a UniProt accession number.
    
    Args:
        text: Query text
    
    Returns:
        Accession string if detected, None otherwise
    """
    normalized = normalize_query(text)
    if not normalized:
        return None
    
    # Split by spaces/commas and check each part
    parts = re.split(r'[,\s]+', normalized)
    for part in parts:
        part = part.strip()
        if ACCESSION_PATTERN.match(part):
            return part.upper()  # UniProt accessions are case-insensitive but typically uppercase
    
    return None


def detect_organism_id(text: str) -> Optional[str]:
    """
    Detect if text contains an organism taxonomy ID (numeric).
    
    Args:
        text: Query text
    
    Returns:
        Organism ID if detected, None otherwise
    """
    normalized = normalize_query(text)
    if not normalized:
        return None
    
    # Check if entire query is a number (organism ID)
    if ORGANISM_ID_PATTERN.match(normalized):
        return normalized
    
    # Check for "organism_id:123" pattern
    organism_match = re.search(r'organism[_\s]*id[:\s]+(\d+)', normalized, re.IGNORECASE)
    if organism_match:
        return organism_match.group(1)
    
    return None


def extract_keyword(text: str, exclude_patterns: Optional[List[str]] = None) -> Optional[str]:
    """
    Extract keyword from query text, excluding accession and organism patterns.
    
    Args:
        text: Query text
        exclude_patterns: Patterns to exclude (e.g., organism_id:123)
    
    Returns:
        Keyword string if found, None otherwise
    """
    normalized = normalize_query(text)
    if not normalized:
        return None
    
    # Remove organism_id patterns
    normalized = re.sub(r'organism[_\s]*id[:\s]+\d+', '', normalized, flags=re.IGNORECASE)
    normalized = normalized.strip()
    
    # Remove accession if present (would be detected separately)
    # For now, if it looks like a single accession, return None for keyword
    if ACCESSION_PATTERN.match(normalized):
        return None
    
    # If the remaining text is purely numeric, it's likely an organism ID, not a keyword
    # This prevents "9606" from being extracted as both keyword and organism_id
    if normalized and normalized.isdigit():
        return None
    
    # Return remaining text as keyword (if not empty)
    if normalized and len(normalized) > 0:
        return normalized
    
    return None


def parse_uniprot_query(text: str) -> ParsedUniProtQuery:
    """
    Parse UniProt query text and classify into mode.
    
    Args:
        text: Raw query input from user
    
    Returns:
        ParsedUniProtQuery with mode, components, and API query string
    
    Examples:
        "P12345" -> accession mode
        "amyloid" -> keyword mode
        "9606" -> organism mode
        "amyloid organism_id:9606" -> keyword_organism mode
    """
    normalized = normalize_query(text)
    
    # Initialize with defaults, then update fields
    result = ParsedUniProtQuery(
        mode=QueryMode.UNKNOWN,
        raw_query=text,
        normalized_query=normalized,
        api_query_string="",
    )
    
    if not normalized:
        result.mode = QueryMode.UNKNOWN
        result.error = "Empty query"
        result.api_query_string = ""
        return result
    
    # Step 1: Check for accession
    accession = detect_accession(normalized)
    if accession:
        result.mode = QueryMode.ACCESSION
        result.accession = accession
        # For accession, API query is direct
        result.api_query_string = f"accession:{accession}"
        return result
    
    # Step 2: Check for organism ID
    organism_id = detect_organism_id(normalized)
    
    # Step 3: Extract keyword (excluding organism patterns)
    keyword = extract_keyword(normalized)
    
    # Step 4: Classify mode
    if organism_id and keyword:
        result.mode = QueryMode.KEYWORD_ORGANISM
        result.keyword = keyword
        result.organism_id = organism_id
        # UniProt API: keyword search + organism filter
        result.api_query_string = f"keyword:{keyword} AND organism_id:{organism_id}"
    elif organism_id:
        result.mode = QueryMode.ORGANISM
        result.organism_id = organism_id
        result.api_query_string = f"organism_id:{organism_id}"
    elif keyword:
        result.mode = QueryMode.KEYWORD
        result.keyword = keyword
        result.api_query_string = f"keyword:{keyword}"
    else:
        result.mode = QueryMode.UNKNOWN
        result.error = "Could not parse query. Expected: accession (e.g., P12345), keyword, or organism_id (e.g., 9606)"
        result.api_query_string = normalized  # Fallback: use normalized input as-is
    
    return result


def build_uniprot_export_url(
    query_string: str,
    format: str = "tsv",
    columns: Optional[List[str]] = None,
    reviewed: Optional[bool] = True,  # True = reviewed (Swiss-Prot), False = unreviewed (TrEMBL), None = both
    length_min: Optional[int] = None,
    length_max: Optional[int] = None,
    sort: Optional[str] = None,  # None or "score" = omit (best match), or allowed sort value
    include_isoforms: bool = False,
    size: int = 500,
) -> str:
    """
    Build UniProt REST API export URL with query controls.
    
    Args:
        query_string: UniProt API query string (e.g., "accession:P12345")
        format: Export format (tsv, csv, xlsx, fasta, etc.)
        columns: List of column names to include (None = default)
        reviewed: If True, only reviewed (Swiss-Prot). If False, only unreviewed (TrEMBL). If None, both.
        length_min: Minimum sequence length filter
        length_max: Maximum sequence length filter
        sort: Sort order ("score" = best match first, "length_asc", "length_desc", "organism_name")
        include_isoforms: Include isoform sequences
        size: Maximum number of results (default 500)
    
    Returns:
        Full UniProt API URL
    """
    base_url = "https://rest.uniprot.org/uniprotkb/search"
    
    # Build query string with filters
    query_parts = [query_string]
    
    # Reviewed/unreviewed filter
    if reviewed is True:
        query_parts.append("reviewed:true")
    elif reviewed is False:
        query_parts.append("reviewed:false")
    # If None, include both (no filter)
    
    # Length filters - only add if at least one bound is set
    # UniProt API range syntax: length:[min TO max] or length:[min TO *] or length:[* TO max]
    # IMPORTANT: Avoid wildcard (*) when possible - UniProt may reject patterns like length:[* TO 6]
    # Strategy: Use explicit lower bound (1) when max is small to avoid wildcard rejection
    if length_min is not None and length_max is not None:
        # Both bounds provided: use explicit range [min TO max]
        query_parts.append(f"length:[{length_min} TO {length_max}]")
    elif length_min is not None:
        # Only min provided: use [min TO *]
        query_parts.append(f"length:[{length_min} TO *]")
    elif length_max is not None:
        # Only max provided: use explicit lower bound if max < 10 to avoid wildcard issues
        # UniProt rejects length:[* TO 6] but accepts length:[1 TO 6]
        if length_max < 10:
            query_parts.append(f"length:[1 TO {length_max}]")
        else:
            # For larger max values, wildcard is acceptable
            query_parts.append(f"length:[* TO {length_max}]")
    # If both are None: DO NOT append length clause
    
    # Combine query parts
    final_query = " AND ".join(query_parts)
    
    # Default columns for peptide analysis
    default_columns = [
        "accession",
        "id",
        "protein_name",
        "organism_name",
        "organism_id",
        "sequence",
        "length",
    ]
    
    columns_to_use = columns if columns else default_columns
    fields = ",".join(columns_to_use)
    
    # Build query parameters
    params = {
        "query": final_query,
        "format": format,
        "fields": fields,
        "size": size,
    }
    
    # Add sorting with strict allowlist
    # Frontend now sends UniProt format directly (e.g., "length asc"), so we validate against that
    # Allowed sort values: "length asc", "length desc", "reviewed asc", "reviewed desc", 
    # "protein_name asc", "protein_name desc", "organism_name asc", "organism_name desc"
    # Note: "score" (best match) should be omitted - UniProt defaults to score when sort is not provided
    ALLOWED_SORT_VALUES = {
        "length asc", "length desc",
        "reviewed asc", "reviewed desc",
        "protein_name asc", "protein_name desc",
        "organism_name asc", "organism_name desc",
    }
    
    # Only add sort parameter if it's not "score"/None and is in allowlist
    # (Validation should happen before calling this function, but we double-check here)
    if sort and sort != "score":
        if sort in ALLOWED_SORT_VALUES:
            params["sort"] = sort  # Already in correct format
        else:
            # This should not happen if validation is correct, but raise to be safe
            raise ValueError(
                f"Invalid sort value: '{sort}'. "
                f"Allowed values: {sorted(ALLOWED_SORT_VALUES)} or omit for best match"
            )
    # If sort is "score" or None, omit it (UniProt defaults to score)
    
    # Include isoforms if requested (this is handled in the query, not as a parameter)
    # For isoforms, we might need to adjust the query or handle differently
    # UniProt REST API doesn't have a direct "include_isoforms" parameter
    # Instead, isoforms are typically included if the accession includes them
    
    # Build URL with proper encoding using httpx.URL
    import httpx
    url = httpx.URL(base_url, params=params)
    
    return str(url)

