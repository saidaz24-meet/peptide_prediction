"""
UniProt query service.

Handles UniProt API interactions, query parsing, and sequence windowing.
The execute_uniprot_query function remains in server.py pending further refactoring
to deduplicate processing logic with upload_service.py.
"""
from typing import Any, Dict, List

import httpx

from schemas.uniprot_query import UniProtQueryParseRequest, UniProtQueryParseResponse
from services.dataframe_utils import read_any_table
from services.logger import log_info
from services.sequence_windowing import window_sequences
from services.uniprot_parser import build_uniprot_export_url, parse_uniprot_query


async def ping_uniprot() -> Dict[str, Any]:
    """
    Test UniProt API connectivity.

    Executes a simple known-good query and returns status.
    Does not raise exceptions - returns error status in response.

    Returns:
        Dict with status, message, and additional info
    """
    try:
        # Simple test query: get one reviewed human protein
        test_url = build_uniprot_export_url(
            query_string="organism_id:9606",
            format="tsv",
            reviewed=True,
            size=1,
        )

        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "User-Agent": "PeptideVisualLab/1.0 (https://github.com/your-org/peptide-prediction)"
            }
            response = await client.get(test_url, headers=headers)
            response.raise_for_status()

            # Parse response
            raw_data = response.content
            df = read_any_table(raw_data, "uniprot_test.tsv")

            return {
                "status": "ok",
                "message": "UniProt API is reachable",
                "test_query": "organism_id:9606",
                "rows_returned": len(df),
                "sample_columns": list(df.columns) if len(df) > 0 else [],
            }
    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "message": f"UniProt API returned {e.response.status_code}",
            "error": str(e),
        }
    except httpx.TimeoutException:
        return {
            "status": "error",
            "message": "UniProt API request timed out",
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to connect to UniProt API: {str(e)}",
        }


def parse_query(request: UniProtQueryParseRequest) -> UniProtQueryParseResponse:
    """
    Parse a UniProt query string and detect its mode.

    Args:
        request: UniProtQueryParseRequest with the query string

    Returns:
        UniProtQueryParseResponse with mode, components, and API query string
    """
    parsed = parse_uniprot_query(request.query)

    return UniProtQueryParseResponse(
        mode=parsed.mode.value,
        accession=parsed.accession,
        keyword=parsed.keyword,
        organism_id=parsed.organism_id,
        normalized_query=parsed.normalized_query,
        api_query_string=parsed.api_query_string,
        error=parsed.error,
    )


def window_protein_sequences(
    sequences: List[Dict[str, str]],
    window_size: int = 20,
    step_size: int = 5
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Window protein sequences into peptides.

    Args:
        sequences: List of dicts with 'id' and 'sequence' keys
        window_size: Size of the sliding window (default 20)
        step_size: Step size for the sliding window (default 5)

    Returns:
        Dict with 'peptides' list containing windowed peptide dicts
    """
    peptides = window_sequences(sequences, window_size, step_size)

    log_info("uniprot_windowed",
             f"Windowed {len(sequences)} sequences into {len(peptides)} peptides",
             sequences=len(sequences),
             peptides=len(peptides),
             window_size=window_size,
             step_size=step_size)

    return {"peptides": peptides}
