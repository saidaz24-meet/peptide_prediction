"""
Shared provider status metadata builder.

Used by both predict_service (single sequence) and upload_service (batch)
to construct consistent provider status dicts for API responses.
"""
from typing import Optional, Dict, Any


def build_provider_meta(
    *,
    tango_enabled: bool,
    tango_ran: bool,
    tango_status: str,
    tango_reason: Optional[str] = None,
    tango_stats: Optional[Dict[str, int]] = None,
    tango_requested: bool = True,
    s4pred_enabled: bool,
    s4pred_ran: bool,
    s4pred_status: str,
    s4pred_reason: Optional[str] = None,
    s4pred_stats: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    """
    Build provider status metadata dict for API responses.

    Returns a dict with 'tango' and 's4pred' keys, each containing
    enabled/requested/ran/status/reason/stats fields.
    """
    result: Dict[str, Any] = {
        "tango": {
            "enabled": tango_enabled,
            "requested": tango_requested,
            "ran": tango_ran,
            "status": tango_status,
            "reason": tango_reason,
            "stats": tango_stats or {"requested": 0, "parsed_ok": 0, "parsed_bad": 0},
        },
        "s4pred": {
            "enabled": s4pred_enabled,
            "requested": s4pred_enabled,
            "ran": s4pred_ran,
            "status": s4pred_status,
            "reason": s4pred_reason,
        },
    }

    if s4pred_stats:
        result["s4pred"]["stats"] = s4pred_stats

    return result
