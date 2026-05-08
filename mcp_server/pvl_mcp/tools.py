"""MCP tool definitions wrapping every public PVL endpoint.

Each ``@mcp.tool()`` function below becomes callable by any MCP-aware LLM
client (Claude Desktop, Cursor, Continue, Cline, Windsurf...). The function's
docstring is what the LLM "sees" when deciding whether to use the tool — keep
it scientific, concrete, and aligned with Peleg's category definitions in
``prompts.py``.

Backend wiring status (2026-05-08):

| Tool                     | Backend route                            | Status |
| ------------------------ | ---------------------------------------- | ------ |
| search_uniprot           | POST /api/uniprot/execute                | LIVE   |
| analyze_sequences        | POST /api/predict + POST /api/upload-csv | LIVE   |
| get_pvl_version          | GET  /api/version                        | LIVE   |
| get_peptide_detail       | GET  /api/peptide/{accession}            | TODO   |
| rank_candidates          | POST /api/rank                           | TODO   |
| compare_cohorts          | POST /api/compare                        | TODO   |
| find_similar_peptides    | POST /api/peptides/similar               | TODO (Wave 2 §D) |

Tools whose backend route is TODO will still register with the MCP client
but raise ``PVLAPIError`` with a clear "endpoint not yet implemented" message
when invoked — this keeps the MCP surface stable while the backend catches up.
"""

from __future__ import annotations

import csv
import io
import json
from typing import Annotated, Any, Optional

from pydantic import Field

from . import _client


def register_tools(mcp: Any) -> None:
    """Register every PVL tool on the given FastMCP server instance.

    Done via a function (rather than module-level decorators) so tests can
    construct a fresh ``FastMCP`` per test case and so the server entry point
    in ``server.py`` stays the single source of truth for the tool surface.
    """

    # -----------------------------------------------------------------------
    # 1. search_uniprot — wraps POST /api/uniprot/execute
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def search_uniprot(
        query: Annotated[
            str,
            Field(
                description="UniProt query — accession (e.g. 'P0C1Q4'), keyword (e.g. 'amyloid'), or organism+keyword combination.",
            ),
        ],
        organism_id: Annotated[
            Optional[str],
            Field(
                description="NCBI taxonomy ID to restrict to one species (e.g. '1280' for Staphylococcus aureus).",
            ),
        ] = None,
        length_min: Annotated[
            Optional[int],
            Field(description="Minimum sequence length to include."),
        ] = None,
        length_max: Annotated[
            Optional[int],
            Field(description="Maximum sequence length to include."),
        ] = None,
        reviewed: Annotated[
            bool,
            Field(description="If True, only Swiss-Prot reviewed entries. False = TrEMBL only."),
        ] = True,
        max_results: Annotated[
            int,
            Field(description="Maximum rows to return (1-10000; pagination handled server-side)."),
        ] = 500,
        run_tango: Annotated[
            bool,
            Field(
                description="If True, run TANGO aggregation prediction on returned sequences. Slower; defaults to False.",
            ),
        ] = False,
        run_s4pred: Annotated[
            bool,
            Field(
                description="If True, run S4PRED secondary-structure prediction on returned sequences. Slower; defaults to False.",
            ),
        ] = False,
    ) -> dict[str, Any]:
        """Search UniProt and return PVL-normalized peptide rows.

        Use this to discover candidate peptides by accession, keyword, or
        organism. The result includes UniProt metadata plus PVL biochem
        columns (length, charge, hydrophobicity, μH). Call ``analyze_sequences``
        afterwards if the user wants TANGO/S4PRED-derived classifications.
        """
        payload: dict[str, Any] = {
            "query": query,
            "reviewed": reviewed,
            "size": max_results,
            "run_tango": run_tango,
            "run_s4pred": run_s4pred,
        }
        if organism_id is not None:
            payload["organism_id"] = organism_id
        if length_min is not None:
            payload["length_min"] = length_min
        if length_max is not None:
            payload["length_max"] = length_max

        return await _client.request("POST", "/api/uniprot/execute", json=payload)

    # -----------------------------------------------------------------------
    # 2. analyze_sequences — wraps POST /api/predict (single) + /api/upload-csv (batch)
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def analyze_sequences(
        sequences: Annotated[
            list[dict[str, str]],
            Field(
                description="List of {'id': str, 'sequence': str} dicts. Pass a single-element list for a single-peptide analysis.",
            ),
        ],
        threshold_config: Annotated[
            Optional[dict[str, Any]],
            Field(
                description="Optional threshold overrides. Omit for PVL defaults (recommended).",
            ),
        ] = None,
    ) -> dict[str, Any]:
        """Run the full PVL analysis pipeline on one or more peptide sequences.

        Returns the canonical PVL response shape with biochem metrics plus
        classification flags (helixFlag, ffHelixFlag, sswPrediction, ffSswFlag).
        Single-element batches go through ``/api/predict``; multi-element
        batches go through ``/api/upload-csv``. The result schema is identical
        either way (single/batch parity is a PVL invariant).
        """
        if not sequences:
            return {"rows": [], "stats": {"row_count": 0}}

        threshold_form: Optional[dict[str, str]] = None
        if threshold_config is not None:
            threshold_form = {"thresholdConfig": json.dumps(threshold_config)}

        # Single-peptide path: form-encoded /api/predict.
        if len(sequences) == 1:
            row = sequences[0]
            seq = row.get("sequence") or ""
            if not seq:
                raise _client.PVLAPIError(
                    "analyze_sequences: each row needs a non-empty 'sequence' field."
                )
            form: dict[str, Any] = {"sequence": seq}
            entry = row.get("id") or row.get("entry")
            if entry:
                form["entry"] = entry
            if threshold_form:
                form.update(threshold_form)
            return await _client.request("POST", "/api/predict", data=form)

        # Batch path: build CSV in memory and POST as multipart upload.
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["Entry", "Sequence"])
        writer.writeheader()
        for i, row in enumerate(sequences, start=1):
            seq = row.get("sequence") or ""
            if not seq:
                raise _client.PVLAPIError(
                    f"analyze_sequences: row {i} is missing 'sequence'."
                )
            writer.writerow({"Entry": row.get("id") or f"seq_{i}", "Sequence": seq})

        files = {"file": ("pvl_mcp_batch.csv", buf.getvalue().encode("utf-8"), "text/csv")}
        return await _client.request(
            "POST",
            "/api/upload-csv",
            files=files,
            data=threshold_form,
        )

    # -----------------------------------------------------------------------
    # 3. get_peptide_detail — wraps GET /api/peptide/{accession}  (TODO backend)
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def get_peptide_detail(
        accession: Annotated[
            str,
            Field(
                description="Peptide accession or PVL row ID (e.g. 'P0C1Q4', 'P0C1Q4_25-50').",
            ),
        ],
    ) -> dict[str, Any]:
        """Return all PVL data for a single peptide.

        Includes biochem metrics (length, charge, hydrophobicity, μH), all
        four classification flags (helixFlag, ffHelixFlag, sswPrediction,
        ffSswFlag), provider raw outputs (TANGO peaks, S4PRED helix segments),
        and structure metadata (PDB / AlphaFold link if available).
        """
        return await _client.request("GET", f"/api/peptide/{accession}")

    # -----------------------------------------------------------------------
    # 4. rank_candidates — wraps POST /api/rank  (TODO backend)
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def rank_candidates(
        sequences: Annotated[
            Optional[list[dict[str, Any]]],
            Field(
                description="List of peptide rows (already analyzed) to rank. Pass either this OR dataset_id, not both.",
            ),
        ] = None,
        dataset_id: Annotated[
            Optional[str],
            Field(
                description="Server-side dataset identifier. Pass either this OR sequences.",
            ),
        ] = None,
        preset: Annotated[
            str,
            Field(
                description="Ranking preset. One of: 'equal', 'helix-focus', 'fibril-formation-focus', 'switch-focus'.",
            ),
        ] = "equal",
        weights: Annotated[
            Optional[dict[str, float]],
            Field(
                description="Custom weights map (overrides preset). Keys are signal names, values are non-negative weights.",
            ),
        ] = None,
        top_n: Annotated[
            int,
            Field(description="Number of top peptides to return."),
        ] = 10,
    ) -> dict[str, Any]:
        """Rank a peptide set by configurable multi-signal weights.

        PVL ranking is multi-signal by design (helix score, FF-Helix flag,
        SSW indecisiveness, hydrophobicity, charge, μH); never rely on TANGO
        alone. Use one of the named presets unless the user has a reason to
        diverge.
        """
        if (sequences is None) == (dataset_id is None):
            raise _client.PVLAPIError(
                "rank_candidates: pass exactly one of 'sequences' or 'dataset_id'."
            )
        payload: dict[str, Any] = {"preset": preset, "top_n": top_n}
        if sequences is not None:
            payload["sequences"] = sequences
        if dataset_id is not None:
            payload["dataset_id"] = dataset_id
        if weights is not None:
            payload["weights"] = weights
        return await _client.request("POST", "/api/rank", json=payload)

    # -----------------------------------------------------------------------
    # 5. compare_cohorts — wraps POST /api/compare  (TODO backend)
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def compare_cohorts(
        cohort_a: Annotated[
            list[dict[str, Any]],
            Field(description="First cohort: list of analyzed peptide rows."),
        ],
        cohort_b: Annotated[
            list[dict[str, Any]],
            Field(description="Second cohort: list of analyzed peptide rows."),
        ],
        label_a: Annotated[
            str,
            Field(description="Display label for cohort A."),
        ] = "Cohort A",
        label_b: Annotated[
            str,
            Field(description="Display label for cohort B."),
        ] = "Cohort B",
    ) -> dict[str, Any]:
        """Compute delta metrics between two peptide cohorts.

        Returns class-fraction differences (Helix, FF-Helix, SSW, FF-SSW)
        and biochem distribution shifts (length, charge, hydrophobicity, μH).
        Useful for "does cohort X have more fibril-forming candidates than
        cohort Y?" questions.
        """
        return await _client.request(
            "POST",
            "/api/compare",
            json={
                "cohort_a": cohort_a,
                "cohort_b": cohort_b,
                "label_a": label_a,
                "label_b": label_b,
            },
        )

    # -----------------------------------------------------------------------
    # 6. find_similar_peptides — wraps POST /api/peptides/similar  (Wave 2 §D)
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def find_similar_peptides(
        reference_sequence: Annotated[
            str,
            Field(
                description="Reference peptide sequence (single-letter amino acids).",
                min_length=2,
                max_length=500,
            ),
        ],
        k: Annotated[
            int,
            Field(
                description="Number of nearest neighbors to return (1-100).",
                ge=1,
                le=100,
            ),
        ] = 10,
    ) -> dict[str, Any]:
        """Return the k peptides most semantically similar to the reference.

        Uses PVL's vector embedding store (Chroma) — see Wave 2 §D. Distance
        is cosine; lower = more similar. Each result includes accession,
        sequence, distance, and metadata flags (helix/FF-Helix/SSW).
        """
        return await _client.request(
            "POST",
            "/api/peptides/similar",
            json={"reference_sequence": reference_sequence, "k": k},
        )

    # -----------------------------------------------------------------------
    # 7. get_pvl_version — wraps GET /api/version
    # -----------------------------------------------------------------------
    @mcp.tool()
    async def get_pvl_version() -> dict[str, Any]:
        """Return PVL version, build SHA, and build timestamp.

        Cite the returned version when reporting PVL results in any
        paper-citable format (e.g. "PVL v0.1.0 (build abc1234)").
        """
        return await _client.request("GET", "/api/version")


# Names of every tool registered above — used by tests to assert the
# full surface is present without instantiating a real FastMCP.
TOOL_NAMES: tuple[str, ...] = (
    "search_uniprot",
    "analyze_sequences",
    "get_peptide_detail",
    "rank_candidates",
    "compare_cohorts",
    "find_similar_peptides",
    "get_pvl_version",
)


__all__ = ["TOOL_NAMES", "register_tools"]
