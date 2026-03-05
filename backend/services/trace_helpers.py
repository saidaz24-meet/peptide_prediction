"""
Helper functions to ensure traceId is always included in responses and logs.
"""

from typing import Any, Dict

from services.logger import get_trace_id


def ensure_trace_id_in_meta(meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure traceId is included in meta dict.

    If traceId is missing, gets it from context (set by middleware).
    This ensures all Meta objects include traceId even if manually constructed.

    Args:
        meta: Meta dict (may or may not have traceId)

    Returns:
        Meta dict with traceId guaranteed to be present
    """
    if "traceId" not in meta or meta["traceId"] is None:
        trace_id = get_trace_id()
        if trace_id:
            meta["traceId"] = trace_id
        else:
            # Fallback: generate new traceId if context is missing (shouldn't happen with middleware)
            import uuid
            trace_id = str(uuid.uuid4())
            meta["traceId"] = trace_id

    return meta


def get_trace_id_for_response() -> str:
    """
    Get traceId for response (from context or generate new).

    This should always return a valid traceId since middleware sets it,
    but provides fallback for edge cases.

    Returns:
        traceId string (never None)
    """
    trace_id = get_trace_id()
    if trace_id:
        return trace_id

    # Fallback: generate new traceId if context is missing (shouldn't happen with middleware)
    import uuid
    return str(uuid.uuid4())

