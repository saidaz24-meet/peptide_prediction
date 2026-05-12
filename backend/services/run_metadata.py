"""Build + serialize ``RunMetadata`` for analysis responses (Wave 2 §G, ADR-013).

Every analysis response carries a ``runMetadata`` stamp under its ``meta``
field so peer reviewers can re-run the analysis identically. The same data
is also exposed as a ``# PVL ...`` CSV-comment header for exports — pandas /
R / Excel skip ``#``-prefixed lines by default, so downstream parsers stay
backwards-compatible.

This module is the single seam between the response-building code (upload /
predict / UniProt services) and the metadata shape — change the producer
here, never inline at each service site.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import settings

# Predictor version constants. TANGO and S4PRED are binaries / weight files
# without a callable version API; we encode the shipped version explicitly
# here so the run metadata stays reproducible even when the binaries get
# updated upstream. Bump these when the bundled tool version changes.
TANGO_VERSION = "2.3"
S4PRED_VERSION = "1.2.4"

# FF-Helix / FF-SSW are PVL's in-house implementations of the Hamodrakas 2007
# fibril-forming heuristic — see Peleg's domain axioms in
# ``mcp_server/pvl_mcp/prompts.py``. The "version" string identifies the
# reference paper rather than a software version since the algorithm itself
# is fixed.
FF_HELIX_VERSION = "hamodrakas2007"
FF_SSW_VERSION = "hamodrakas2007"

# Allowed values for ``RunMetadata.sequenceSource`` — kept here so callers
# don't have to import Pydantic Literal types.
SequenceSource = str  # one of: "fasta" | "csv" | "uniprot" | "manual" | "demo"


def _flatten_thresholds(thresholds: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """Coerce a thresholds dict to ``Dict[str, float]`` (RunMetadata schema).

    PVL's threshold dicts mix numerics with the occasional nested config
    block (``thresholdConfigResolved`` has ``mode``, ``version`` strings).
    We only keep the leaf numerics here — the CSV header would otherwise
    blow up the line count, and Pydantic's ``Dict[str, float]`` would reject
    the strings anyway.
    """
    out: Dict[str, float] = {}
    if not thresholds:
        return out
    for key, value in thresholds.items():
        try:
            out[key] = float(value)
        except (TypeError, ValueError):
            # Skip non-numeric entries silently — they aren't reproducibility
            # primitives, and the CSV header is meant to be human-readable.
            continue
    return out


def _detect_predictors_used(
    *,
    use_tango: bool,
    use_s4pred: bool,
) -> tuple[List[str], Dict[str, str]]:
    """Return (predictors_used, predictor_versions) tuples for the request.

    ``ff_helix`` and ``ff_ssw`` are PVL-internal pure-Python helpers so they
    are always considered "used" — they don't have an enable flag. TANGO
    and S4PRED reflect the live ``settings.USE_*`` flags AS PASSED IN to
    this helper (not the raw env vars) so per-request overrides are honoured.
    """
    predictors: List[str] = []
    versions: Dict[str, str] = {}

    if use_tango:
        predictors.append("tango")
        versions["tango"] = TANGO_VERSION
    if use_s4pred:
        predictors.append("s4pred")
        versions["s4pred"] = S4PRED_VERSION
    # FF helpers are PVL invariants — always present.
    predictors.append("ff_helix")
    versions["ff_helix"] = FF_HELIX_VERSION
    predictors.append("ff_ssw")
    versions["ff_ssw"] = FF_SSW_VERSION

    return predictors, versions


def build_run_metadata(
    *,
    sequence_source: SequenceSource,
    thresholds: Optional[Dict[str, Any]] = None,
    use_tango: Optional[bool] = None,
    use_s4pred: Optional[bool] = None,
    dataset_id: Optional[str] = None,
    permalink: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Build a ``RunMetadata`` dict (camelCase, ready for ``Meta.runMetadata``).

    Returns a plain dict (not a Pydantic instance) because the consumer
    sites build the surrounding ``meta_dict`` as a plain dict and pass the
    whole thing through ``Meta.model_validate`` later — staying in dict-land
    avoids an unnecessary ``model_dump`` round-trip.

    Parameters
    ----------
    sequence_source:
        Where the input sequences came from. One of ``fasta`` / ``csv`` /
        ``uniprot`` / ``manual`` / ``demo``. Drives downstream trust signals.
    thresholds:
        Resolved threshold dict for this run (e.g. the value services pass
        to ``meta["thresholds"]``). Non-numeric entries are filtered out.
    use_tango / use_s4pred:
        Live predictor toggle for this request. Defaults to ``settings.*``
        so single-request callers can omit them.
    dataset_id:
        Server-side dataset identifier (typically the inputs hash) for batch
        runs. Omit for single-sequence runs.
    permalink:
        Reproducibility-ribbon URL. The frontend passes this; backend doesn't
        synthesize one.
    now:
        Override for the run timestamp — only used by tests to get a stable
        value to assert against.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if use_tango is None:
        use_tango = settings.USE_TANGO
    if use_s4pred is None:
        use_s4pred = settings.USE_S4PRED

    predictors_used, predictor_versions = _detect_predictors_used(
        use_tango=use_tango, use_s4pred=use_s4pred
    )

    return {
        "pvlVersion": settings.VERSION,
        "runTimestamp": now.isoformat().replace("+00:00", "Z"),
        "sequenceSource": sequence_source,
        "predictorsUsed": predictors_used,
        "predictorVersions": predictor_versions,
        "thresholds": _flatten_thresholds(thresholds),
        "datasetId": dataset_id,
        "permalink": permalink,
    }


# ---------------------------------------------------------------------------
# CSV header serializer — spec G.3
# ---------------------------------------------------------------------------


# Stable order: identity fields first, then provenance, then thresholds /
# context. Listing keys explicitly means the header is deterministic across
# Python dict-ordering implementations and across PVL versions (helpful
# when diffing two exported CSVs).
_HEADER_FIELD_ORDER: tuple[str, ...] = (
    "pvlVersion",
    "runTimestamp",
    "sequenceSource",
    "predictorsUsed",
    "predictorVersions",
    "thresholds",
    "datasetId",
    "permalink",
)

# camelCase → snake_case mapping for the CSV header lines per spec G.3
# (``# pvl_version=...``). Keys not in this map fall through unchanged.
_HEADER_KEY_ALIAS: Dict[str, str] = {
    "pvlVersion": "pvl_version",
    "runTimestamp": "run_timestamp",
    "sequenceSource": "sequence_source",
    "predictorsUsed": "predictors_used",
    "predictorVersions": "predictor_versions",
    "datasetId": "dataset_id",
}


def _format_value(value: Any) -> str:
    """Serialize a RunMetadata value to its CSV-header string form.

    Lists → comma-joined values. Dicts → ``key=value`` pairs, comma-joined.
    None → the empty string. Everything else → ``str(value)``. Newlines
    and CR are stripped so a single metadata line cannot accidentally span
    multiple CSV header rows.
    """
    if value is None:
        return ""
    if isinstance(value, list):
        text = ",".join(str(item) for item in value)
    elif isinstance(value, dict):
        text = ",".join(f"{k}={v}" for k, v in value.items())
    else:
        text = str(value)
    return text.replace("\n", " ").replace("\r", " ")


def format_csv_header(run_metadata: Dict[str, Any]) -> str:
    """Return the ``# PVL ...`` CSV-comment header block for ``run_metadata``.

    Output ends with a single blank ``#`` line so downstream tools can spot
    the metadata block boundary if they want to. Lines look like::

        # PVL run_metadata
        # pvl_version=0.1.0
        # run_timestamp=2026-05-12T10:00:00Z
        # sequence_source=csv
        # predictors_used=tango,s4pred,ff_helix,ff_ssw
        # predictor_versions=tango=2.3,s4pred=1.2.4,ff_helix=hamodrakas2007,ff_ssw=hamodrakas2007
        # thresholds=muHCutoff=0.5,hydroCutoff=0.5
        # dataset_id=abc123
        # permalink=
        #

    The trailing newline is included — callers can prepend the result
    directly to a CSV string.
    """
    lines = ["# PVL run_metadata"]
    for camel_key in _HEADER_FIELD_ORDER:
        if camel_key not in run_metadata:
            continue
        snake_key = _HEADER_KEY_ALIAS.get(camel_key, camel_key)
        lines.append(f"# {snake_key}={_format_value(run_metadata[camel_key])}")
    lines.append("#")
    return "\n".join(lines) + "\n"


__all__ = [
    "FF_HELIX_VERSION",
    "FF_SSW_VERSION",
    "S4PRED_VERSION",
    "TANGO_VERSION",
    "build_run_metadata",
    "format_csv_header",
]
