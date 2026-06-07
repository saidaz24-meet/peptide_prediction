"""Diagnostic-only parity check vs Peleg's reference implementation.

Inlines local copies of two reference functions from Peleg's repo:

* ``__check_subsegment``                  — auxiliary.py:65-79
* ``get_secondary_structure_segments``    — auxiliary.py:82-127

Then runs both Peleg's versions and PVL's matching implementations on a
fixed set of synthetic inputs and *reports* any divergence as a captured
print statement (visible via ``pytest -s``).

This test never asserts equality. The point is to surface drift so T1
can decide whether to match-paper or stay-corrected. The two known
divergences (PELEG_PAPER_AND_REPO_FINDINGS.md §5.1 and §5.2) are
expected to fire on short / non-aligned inputs.
"""

from __future__ import annotations

import os
import sys
from statistics import mean, median
from typing import List, Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import auxiliary as pvl_auxiliary  # noqa: E402
from auxiliary import (  # noqa: E402
    get_secondary_structure_segments as pvl_get_segments,
)

# ``__check_subsegment`` is a module-level dunder so it isn't re-exported by
# ``from auxiliary import *``. Look it up directly off the module.
_pvl_check_subsegment = getattr(pvl_auxiliary, "__check_subsegment", None)
if _pvl_check_subsegment is None:
    # Older builds had a single-underscore name; fall back to either spelling.
    _pvl_check_subsegment = getattr(pvl_auxiliary, "_check_subsegment", None)


# Peleg config constants (verbatim — Expanding-_the_amyloid_landscape-main/config.py).
PELEG_MIN_SEGMENT_LENGTH = 5
PELEG_MAX_GAP = 3
PELEG_MIN_TANGO_SCORE = 0
PELEG_MIN_JPRED_SCORE = 7


def peleg_check_subsegment(prediction: list, start: int, end: int) -> tuple:
    """Verbatim copy of Peleg auxiliary.py:65-79 (exclusive-end convention)."""
    all_possible_length = list(range(PELEG_MIN_SEGMENT_LENGTH, (end - start + 1 + 1)))
    max_start = -1
    max_end = -1
    max_score = -1
    for cur_length in all_possible_length:
        for i in range(start, end - cur_length + 1):
            cur_mean = mean(prediction[i : (i + cur_length)])
            cur_median = median(prediction[i : (i + cur_length)])
            if cur_mean > max_score or cur_median > max_score:
                max_score = max(cur_median, cur_mean)
                max_start = i
                max_end = i + cur_length  # exclusive
    return max_start, max_end, max_score


def peleg_get_secondary_structure_segments(
    prediction: list, prediction_method: str
) -> List[Tuple[int, int]]:
    """Verbatim copy of Peleg auxiliary.py:82-127.

    Notes:
    * ``mean(prediction[start:end])`` uses Peleg's exclusive-end slice —
      mathematically inconsistent with ``segment_length = end - start + 1``,
      but reproduced here for parity.
    """
    import math

    min_score = -math.inf
    if prediction_method == "Tango":
        min_score = PELEG_MIN_TANGO_SCORE
    elif prediction_method == "Jpred":
        min_score = PELEG_MIN_JPRED_SCORE

    segments: List[Tuple[int, int]] = []
    i = 0
    while i < len(prediction):
        if prediction[i] > 0:
            start = i
            gap = 0
            i += 1
            while i < len(prediction) and gap <= PELEG_MAX_GAP:
                if prediction[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1

            end = i - 1 - gap
            segment_length = end - start + 1
            good_segment = segment_length >= PELEG_MIN_SEGMENT_LENGTH and (
                mean(prediction[start:end]) >= min_score
                or median(prediction[start:end]) >= min_score
            )
            if good_segment:
                segments.append((start, end))
            elif segment_length >= PELEG_MIN_SEGMENT_LENGTH:
                short_start, short_end, short_score = peleg_check_subsegment(prediction, start, end)
                if short_end != -1 and short_start != -1 and short_score >= min_score:
                    segments.append((short_start, short_end))

        i += 1
    return segments


# ---------------------------------------------------------------------------
# Diagnostic inputs.
# ---------------------------------------------------------------------------

_CHECK_SUBSEGMENT_CASES = [
    # (label, prediction, start, end)
    ("short_all_positive_len5", [1, 1, 1, 1, 1], 0, 4),
    ("short_all_positive_len6", [1, 1, 1, 1, 1, 1], 0, 5),
    ("mixed_floats_short", [0.1, 0.5, 0.9, 0.4, 0.2, 0.8, 0.3], 0, 6),
    ("zero_then_positive", [0, 0, 0.5, 0.7, 0.4, 0.6, 0.8], 0, 6),
    ("flat_with_dip", [0.6, 0.6, 0.0, 0.6, 0.6, 0.6], 0, 5),
]

_GET_SEGMENTS_CASES = [
    # (label, prediction, method)
    ("short_one_segment", [0.7, 0.6, 0.5, 0.6, 0.7, 0, 0], "Tango"),
    ("two_short_segments_with_gap", [0.6, 0.7, 0.0, 0.0, 0.5, 0.6, 0.6, 0.0], "Tango"),
    ("all_zero", [0, 0, 0, 0, 0, 0], "Tango"),
    ("len5_borderline", [0.5, 0.5, 0.5, 0.5, 0.5], "Tango"),
    ("len4_below_min", [0.7, 0.6, 0.5, 0.5], "Tango"),
    ("long_run_with_dip", [0.6, 0.5, 0.6, 0.0, 0.5, 0.7, 0.6, 0.5], "Tango"),
]


# ---------------------------------------------------------------------------
# Tests (diagnostic — never fail on divergence; only fail if PVL crashes).
# ---------------------------------------------------------------------------


def test_check_subsegment_parity_diagnostic(capsys):
    """Reports any (peleg, pvl) divergence — does not fail on mismatch."""
    if _pvl_check_subsegment is None:
        print("=== __check_subsegment parity ===")
        print("SKIPPED — PVL helper not exposed on the auxiliary module.")
        assert True
        return

    divergences = []
    for label, prediction, start, end in _CHECK_SUBSEGMENT_CASES:
        peleg = peleg_check_subsegment(prediction, start, end)
        pvl = _pvl_check_subsegment(prediction, start, end)
        if peleg != pvl:
            divergences.append(
                {
                    "case": label,
                    "peleg": peleg,
                    "pvl": pvl,
                    "interpretation": "Boundary indexing — see findings doc §5.1",
                }
            )
    print("=== __check_subsegment parity ===")
    print(f"total cases: {len(_CHECK_SUBSEGMENT_CASES)}")
    print(f"divergences: {len(divergences)}")
    for d in divergences:
        print(f"  - case={d['case']}: peleg={d['peleg']} pvl={d['pvl']}")
    # Diagnostic — never assert equality.
    assert True


def test_get_segments_parity_diagnostic(capsys):
    """Reports any (peleg, pvl) divergence — does not fail on mismatch."""
    divergences = []
    for label, prediction, method in _GET_SEGMENTS_CASES:
        peleg = peleg_get_secondary_structure_segments(prediction, method)
        pvl = pvl_get_segments(prediction, method)
        # Normalise tuple/list to comparable shape.
        peleg_norm = [tuple(s) for s in peleg]
        pvl_norm = [tuple(s) for s in pvl]
        if peleg_norm != pvl_norm:
            divergences.append(
                {
                    "case": label,
                    "peleg": peleg_norm,
                    "pvl": pvl_norm,
                    "interpretation": "Mean-window slice — see findings doc §5.2",
                }
            )
    print("=== get_secondary_structure_segments parity ===")
    print(f"total cases: {len(_GET_SEGMENTS_CASES)}")
    print(f"divergences: {len(divergences)}")
    for d in divergences:
        print(f"  - case={d['case']}: peleg={d['peleg']} pvl={d['pvl']}")
    assert True
