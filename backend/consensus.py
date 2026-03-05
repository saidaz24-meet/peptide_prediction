"""Consensus secondary structure reconciliation logic.

Combines TANGO (aggregation) and S4PRED (secondary structure) predictions
into a tiered evidence framework. Based on AMYLPRED2 consensus approach
(Hamodrakas 2007) — "conformational switch zones" where helix-predicted
residues overlap beta-aggregation hotspots.

This module is pure functions with no side effects or I/O.
"""

from __future__ import annotations

from collections import Counter
from typing import Optional


def dominant_ss_at_region(
    ss_prediction: Optional[list[str]],
    hotspot_start: int,
    hotspot_end: int,
) -> str:
    """Find majority secondary structure call in a TANGO hotspot region.

    Args:
        ss_prediction: Per-residue SS predictions ('H', 'E', 'C').
        hotspot_start: Start index (inclusive).
        hotspot_end: End index (exclusive).

    Returns:
        Dominant SS call ('H', 'E', or 'C'). Defaults to 'C' if no data.
    """
    if not ss_prediction:
        return "C"

    # Clamp to valid bounds
    start = max(0, hotspot_start)
    end = min(len(ss_prediction), hotspot_end)

    region = ss_prediction[start:end]
    if not region:
        return "C"

    counts = Counter(region)
    # Sort by count descending, then alphabetically for tie-breaking
    return sorted(counts.keys(), key=lambda k: (-counts[k], k))[0]


def get_consensus_ss(
    tango_agg_max: Optional[float],
    s4pred_ss_at_hotspot: Optional[str],
    s4pred_helix_percent: Optional[float],
    ssw_prediction: Optional[int],
    s4pred_ssw_prediction: Optional[int],
    agg_threshold: float = 5.0,
    sequence_length: Optional[int] = None,
) -> dict:
    """Compute consensus tier from TANGO + S4PRED data.

    Tier Logic (the "Meytal" Rules):
        1: TANGO APR >threshold + S4PRED=Helix at hotspot → High-Confidence Switch Zone
        2: TANGO APR >threshold + S4PRED=Coil at hotspot  → Disordered Aggregation-Prone
        3: TANGO APR >threshold + S4PRED=Beta at hotspot  → Native Beta / Low Switch Risk
        4: TANGO APR <=threshold + any S4PRED              → No Aggregation Concern
        5: No TANGO data                                   → Insufficient Data

    Args:
        tango_agg_max: Peak TANGO aggregation propensity (%).
        s4pred_ss_at_hotspot: Dominant SS at TANGO hotspot ('H', 'E', 'C', or None).
        s4pred_helix_percent: S4PRED helix percentage (0-100).
        ssw_prediction: TANGO-based SSW prediction (1/-1/None).
        s4pred_ssw_prediction: S4PRED-based SSW prediction (1/-1/None).
        agg_threshold: TANGO aggregation threshold (default 5.0%).
        sequence_length: Sequence length for short-sequence penalty (optional).

    Returns:
        dict with keys: tier (1-5), label (str), certainty (0.0-1.0), explanation (str).
    """
    # ── Tier 5: No TANGO data ──
    if tango_agg_max is None:
        return {
            "tier": 5,
            "label": "Insufficient Data",
            "certainty": 0.0,
            "explanation": (
                "TANGO aggregation data is unavailable. Enable TANGO + S4PRED "
                "for consensus analysis."
            ),
        }

    # ── Tier 4: Low aggregation ──
    if tango_agg_max <= agg_threshold:
        certainty = 0.8
        certainty = _apply_ssw_modifier(certainty, ssw_prediction, s4pred_ssw_prediction)
        certainty = _apply_length_cap(certainty, sequence_length)
        return {
            "tier": 4,
            "label": "No Aggregation Concern",
            "certainty": certainty,
            "explanation": (
                f"TANGO peak aggregation ({tango_agg_max:.1f}%) is at or below "
                f"the {agg_threshold:.1f}% threshold. No significant aggregation "
                "hotspot detected."
            ),
        }

    # ── Tiers 1-3: High aggregation, differentiated by SS at hotspot ──
    ss = s4pred_ss_at_hotspot if s4pred_ss_at_hotspot in ("H", "E", "C") else "C"

    if ss == "H":
        tier, label, base_certainty = 1, "High-Confidence Switch Zone", 0.9
        explanation = (
            f"TANGO detects an aggregation hotspot (peak {tango_agg_max:.1f}%) "
            "where S4PRED predicts helical structure. This helix-to-beta "
            "conformational switch zone is a hallmark of amyloid-forming regions "
            "(Hamodrakas 2007)."
        )
    elif ss == "E":
        tier, label, base_certainty = 3, "Native Beta / Low Switch Risk", 0.5
        explanation = (
            f"TANGO detects an aggregation hotspot (peak {tango_agg_max:.1f}%) "
            "where S4PRED predicts beta-strand structure. The region is already "
            "in a beta conformation, so conformational switching is less likely."
        )
    else:  # "C" or None
        tier, label, base_certainty = 2, "Disordered Aggregation-Prone", 0.7
        explanation = (
            f"TANGO detects an aggregation hotspot (peak {tango_agg_max:.1f}%) "
            "in a disordered (coil) region. The lack of stable secondary structure "
            "may facilitate aggregation through disorder-to-order transitions."
        )

    certainty = _apply_ssw_modifier(base_certainty, ssw_prediction, s4pred_ssw_prediction)
    certainty = _apply_length_cap(certainty, sequence_length)

    return {
        "tier": tier,
        "label": label,
        "certainty": certainty,
        "explanation": explanation,
    }


def _apply_ssw_modifier(
    certainty: float,
    ssw_prediction: Optional[int],
    s4pred_ssw_prediction: Optional[int],
) -> float:
    """Adjust certainty based on SSW predictor agreement/disagreement."""
    if ssw_prediction is not None and s4pred_ssw_prediction is not None:
        if ssw_prediction == s4pred_ssw_prediction:
            certainty += 0.1  # agreement bonus
        else:
            certainty -= 0.1  # disagreement penalty
    return max(0.0, min(1.0, certainty))


def _apply_length_cap(certainty: float, sequence_length: Optional[int]) -> float:
    """Cap certainty for short sequences where S4PRED is out-of-distribution."""
    if sequence_length is not None and sequence_length < 20:
        certainty = min(certainty, 0.5)
    return certainty
