"""Cohort-comparison stats for ``POST /api/compare`` (Wave 2 §I).

Produces the response shape the §I dispatch specifies:

    {
      "stats": {
        "dataset_a": {"n": ..., "ff_helix_pct": ..., "mean_length": ..., ...},
        "dataset_b": {...}
      },
      "differences": [
        {"metric": "ff_helix_pct", "delta": ..., "direction": "b>a", "significance": "ns"},
        ...
      ],
      "method": "two-sided-chi2",
      "labels": {"dataset_a": "...", "dataset_b": "..."}
    }

The significance test for proportion metrics is a two-sided chi-squared on
the 2x2 contingency table ``(positive, observed - positive)`` for each
cohort. The test is implemented in pure Python (no scipy dependency — the
§I dispatch claim that scipy is transitively available via numpy is wrong;
scipy is a separate package, so we avoid pulling it just for one test).

For continuous metrics (lengths, μH, etc.) we expose the raw delta but mark
significance as "ns" — v0.x doesn't ship inferential tests for
continuous columns. Add Welch's t-test in a future wave if needed.

PVL flag conventions (from ``backend/schemas/api_models.py``):
     1  → positive prediction
    -1  → negative prediction (NOT candidate)
     0  → ambiguous (treated as observed-but-negative for fraction math)
    None → no data (excluded from both numerator and denominator)
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

# Camel-cased PeptideRow field names for each PVL class flag.
_CLASS_FIELDS: Dict[str, str] = {
    "helix": "s4predHelixPrediction",  # Peleg axiom 1 — Helix definition
    "ff_helix": "ffHelixFlag",
    "ssw": "sswPrediction",
    "ff_ssw": "ffSswFlag",
}

# Numeric biochem columns we mean-aggregate per cohort.
_BIOCHEM_FIELDS: Dict[str, str] = {
    "length": "length",
    "charge": "charge",
    "hydrophobicity": "hydrophobicity",
    "mu_h": "muH",
}

# Significance test name surfaced in the response. Bumped to v2 if/when we
# add Welch's t-test for continuous metrics or switch to a permutation test.
METHOD_NAME = "two-sided-chi2"


# ---------------------------------------------------------------------------
# Pure-Python chi-squared on a 2x2 contingency table
# ---------------------------------------------------------------------------
#
# For two cohorts with (positive, observed) each, build the contingency
# table:
#
#                   positive    negative    row_total
#       cohort_a    a           b           a + b
#       cohort_b    c           d           c + d
#       col_total   a + c       b + d       N
#
# Chi² = Σ ((observed - expected)^2 / expected) over all four cells, with
# expected_ij = row_total_i * col_total_j / N. 1 degree of freedom on a
# 2x2 table.
#
# We avoid scipy by computing the 1-DoF survival function from the chi²
# value: 1 - F(x; 1) where F is the chi² CDF with 1 DoF. For 1 DoF the CDF
# is erf(sqrt(x / 2)), so the survival function (the p-value) is
# erfc(sqrt(x / 2)) — both ``math.erf`` and ``math.erfc`` are stdlib.


def _expected(row_total: float, col_total: float, n_total: float) -> float:
    return (row_total * col_total) / n_total if n_total > 0 else 0.0


def chi2_p_value(
    positive_a: int, observed_a: int, positive_b: int, observed_b: int
) -> Optional[float]:
    """Two-sided p-value for a 2x2 contingency table on proportions.

    Returns ``None`` when the test isn't well-defined (e.g. an empty
    cohort, or one cohort with zero variance). Returns 1.0 (no evidence
    of difference) when both observed columns have zero positives —
    we don't want to report "highly significant" for "neither cohort
    fires this flag, ever".
    """
    n_a = max(0, observed_a)
    n_b = max(0, observed_b)
    if n_a == 0 or n_b == 0:
        return None

    a = max(0, positive_a)
    b = n_a - a
    c = max(0, positive_b)
    d = n_b - c
    n_total = n_a + n_b
    if n_total <= 0:
        return None

    row_totals = (n_a, n_b)
    col_totals = (a + c, b + d)
    cells = ((a, b), (c, d))

    if col_totals[0] == 0 or col_totals[1] == 0:
        # Both cohorts agree on every observation (all positive or all
        # negative). No contrast → reportably "no significant difference".
        return 1.0

    chi2 = 0.0
    for i in range(2):
        for j in range(2):
            expected = _expected(row_totals[i], col_totals[j], n_total)
            if expected <= 0:
                continue
            chi2 += (cells[i][j] - expected) ** 2 / expected

    # p-value = survival function at chi2 for chi² with 1 DoF.
    # SF(x; 1) = erfc(sqrt(x / 2)).
    return math.erfc(math.sqrt(chi2 / 2.0))


def _significance_marker(p_value: Optional[float]) -> str:
    """Convert a p-value to one of the §I dispatch's four markers."""
    if p_value is None:
        return "ns"
    if p_value < 0.001:
        return "***"
    if p_value < 0.01:
        return "**"
    if p_value < 0.05:
        return "*"
    return "ns"


# ---------------------------------------------------------------------------
# Per-cohort tallies
# ---------------------------------------------------------------------------


def _as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return f


def _tally_class(cohort: List[Dict[str, Any]], field: str) -> Dict[str, int]:
    """Return ``{positive, observed}`` for one class-flag column."""
    positive = 0
    observed = 0
    for row in cohort:
        v = row.get(field)
        if v is None:
            continue
        observed += 1
        try:
            if int(v) == 1:
                positive += 1
        except (TypeError, ValueError):
            continue
    return {"positive": positive, "observed": observed}


def _mean(cohort: List[Dict[str, Any]], field: str) -> Optional[float]:
    nums = [v for v in (_as_float(row.get(field)) for row in cohort) if v is not None]
    if not nums:
        return None
    return sum(nums) / len(nums)


def _fraction(positive: int, observed: int) -> Optional[float]:
    if observed <= 0:
        return None
    return positive / observed


def _diff(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return a - b


def _direction(delta: Optional[float]) -> str:
    if delta is None or delta == 0:
        return "="
    return "a>b" if delta > 0 else "b>a"


def _cohort_stats(
    cohort: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], Dict[str, Dict[str, int]]]:
    """Build the flat per-cohort stat dict matching ``CohortFlatStats``.

    Returns
    -------
    Tuple of (flat_stats, classes_breakdown). The flat_stats dict matches the
    ``CohortFlatStats`` API shape; classes_breakdown carries per-class
    {positive, observed, total} tallies used by the chi-squared comparisons in
    ``compare_cohorts``. 2026-06-07 mypy fix: return type was previously declared
    as ``Dict[str, Any]`` even though this function always returns a 2-tuple —
    mypy in CI flagged every downstream indexing as `str` when it was actually
    `float | int`. Annotation now matches reality.
    """
    classes = {name: _tally_class(cohort, field) for name, field in _CLASS_FIELDS.items()}
    return {
        "n": len(cohort),
        "helix_pct": _fraction(classes["helix"]["positive"], classes["helix"]["observed"]),
        "ff_helix_pct": _fraction(classes["ff_helix"]["positive"], classes["ff_helix"]["observed"]),
        "ssw_pct": _fraction(classes["ssw"]["positive"], classes["ssw"]["observed"]),
        "ff_ssw_pct": _fraction(classes["ff_ssw"]["positive"], classes["ff_ssw"]["observed"]),
        "mean_length": _mean(cohort, _BIOCHEM_FIELDS["length"]),
        "mean_charge": _mean(cohort, _BIOCHEM_FIELDS["charge"]),
        "mean_hydrophobicity": _mean(cohort, _BIOCHEM_FIELDS["hydrophobicity"]),
        "mean_mu_h": _mean(cohort, _BIOCHEM_FIELDS["mu_h"]),
    }, classes


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compare_cohorts(
    cohort_a: List[Dict[str, Any]],
    cohort_b: List[Dict[str, Any]],
    *,
    label_a: str = "Cohort A",
    label_b: str = "Cohort B",
) -> Dict[str, Any]:
    """Compute the §I dispatch response shape for two peptide cohorts."""

    stats_a, classes_a = _cohort_stats(cohort_a)
    stats_b, classes_b = _cohort_stats(cohort_b)

    differences: List[Dict[str, Any]] = []

    # Proportion comparisons — chi-squared on each class flag.
    for metric_name, class_key in (
        ("helix_pct", "helix"),
        ("ff_helix_pct", "ff_helix"),
        ("ssw_pct", "ssw"),
        ("ff_ssw_pct", "ff_ssw"),
    ):
        delta = _diff(stats_a[metric_name], stats_b[metric_name])
        p = chi2_p_value(
            classes_a[class_key]["positive"],
            classes_a[class_key]["observed"],
            classes_b[class_key]["positive"],
            classes_b[class_key]["observed"],
        )
        differences.append(
            {
                "metric": metric_name,
                "delta": delta,
                "direction": _direction(delta),
                "significance": _significance_marker(p),
            }
        )

    # Continuous comparisons — delta only, no inferential test at v0.x.
    for metric_name in ("mean_length", "mean_charge", "mean_hydrophobicity", "mean_mu_h"):
        delta = _diff(stats_a[metric_name], stats_b[metric_name])
        differences.append(
            {
                "metric": metric_name,
                "delta": delta,
                "direction": _direction(delta),
                "significance": "ns",
            }
        )

    return {
        "stats": {
            "dataset_a": stats_a,
            "dataset_b": stats_b,
        },
        "differences": differences,
        "method": METHOD_NAME,
        "labels": {
            "dataset_a": label_a,
            "dataset_b": label_b,
        },
    }


__all__ = ["METHOD_NAME", "chi2_p_value", "compare_cohorts"]
