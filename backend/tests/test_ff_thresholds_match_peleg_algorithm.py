"""Hand-built dataset → bit-for-bit parity with Peleg main.py:147-170.

A small, manually-curated dataset where ssw_avg_H and helix_avg_uH can be
computed by hand. For every row we then assert that ``apply_ff_flags``
produces the same FF flag Peleg's rule would: positive iff the row's
metric is greater than or equal to the dataset mean over positive-class
rows.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, List

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.dataframe_utils import (  # noqa: E402
    apply_ff_flags,
    compute_dataset_ff_thresholds,
)


def _row(
    *,
    entry: str,
    ssw: int,
    hydro: float,
    helix_pred: int,
    helix_uh: float,
) -> Dict[str, Any]:
    return {
        "Entry": entry,
        "Sequence": "A" * 20,
        "Length": 20,
        "Hydrophobicity": hydro,
        "Charge": 1.0,
        "Full length uH": 0.3,
        "Beta full length uH": 0.2,
        "SSW prediction": ssw,
        "SSW prediction (S4PRED)": -1,
        "SSW score": 0.5,
        "SSW diff": -0.1,
        "SSW helix percentage": 10.0,
        "SSW beta percentage": 20.0,
        "Helix prediction (S4PRED)": helix_pred,
        "Helix (s4pred) uH": helix_uh,
        "Helix score (S4PRED)": 0.7,
        "Helix fragments (S4PRED)": [[0, 5]],
    }


def _peleg_expected_ff_ssw(rows: List[Dict[str, Any]], ssw_avg_H: float) -> List[int]:
    return [
        1 if (r["SSW prediction"] == 1 and r["Hydrophobicity"] >= ssw_avg_H) else -1 for r in rows
    ]


def _peleg_expected_ff_helix(rows: List[Dict[str, Any]], helix_avg_uH: float) -> List[int]:
    return [
        1
        if (r["Helix prediction (S4PRED)"] != -1 and r["Helix (s4pred) uH"] >= helix_avg_uH)
        else -1
        for r in rows
    ]


def test_ff_ssw_flags_match_peleg_rule_row_by_row():
    rows = [
        _row(entry="A", ssw=1, hydro=0.80, helix_pred=1, helix_uh=0.10),
        _row(entry="B", ssw=1, hydro=0.40, helix_pred=1, helix_uh=0.10),
        _row(entry="C", ssw=1, hydro=0.20, helix_pred=1, helix_uh=0.10),
        _row(entry="D", ssw=-1, hydro=0.95, helix_pred=1, helix_uh=0.10),
        _row(entry="E", ssw=1, hydro=0.60, helix_pred=1, helix_uh=0.10),
    ]
    df = pd.DataFrame(rows)
    thresholds = compute_dataset_ff_thresholds(df)
    # Manual mean: (0.80 + 0.40 + 0.20 + 0.60) / 4 = 0.50
    assert abs(thresholds["ssw_avg_H"] - 0.50) < 1e-9

    apply_ff_flags(df)
    expected = _peleg_expected_ff_ssw(rows, ssw_avg_H=thresholds["ssw_avg_H"])
    actual = df["FF-Secondary structure switch"].tolist()
    assert actual == expected, (
        f"FF-SSW flags drifted from Peleg's rule. expected={expected} actual={actual}"
    )


def test_ff_helix_flags_match_peleg_rule_row_by_row():
    rows = [
        _row(entry="A", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.70),
        _row(entry="B", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.40),
        _row(entry="C", ssw=1, hydro=0.5, helix_pred=-1, helix_uh=0.95),
        _row(entry="D", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.20),
        _row(entry="E", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.50),
    ]
    df = pd.DataFrame(rows)
    thresholds = compute_dataset_ff_thresholds(df)
    # Manual mean of helix-positive uH: (0.70 + 0.40 + 0.20 + 0.50) / 4 = 0.45
    assert abs(thresholds["helix_avg_uH"] - 0.45) < 1e-9

    apply_ff_flags(df)
    expected = _peleg_expected_ff_helix(rows, helix_avg_uH=thresholds["helix_avg_uH"])
    actual = df["FF-Helix (Jpred)"].tolist()
    assert actual == expected, (
        f"FF-Helix flags drifted from Peleg's rule. expected={expected} actual={actual}"
    )


def test_zero_positive_class_falls_back_to_peleg_default_for_that_class():
    """If a class has zero positives, that class falls back to the Peleg
    constant — without dragging the other class along with it."""
    rows = [
        _row(entry="A", ssw=-1, hydro=0.8, helix_pred=1, helix_uh=0.5),
        _row(entry="B", ssw=-1, hydro=0.7, helix_pred=1, helix_uh=0.6),
    ]
    df = pd.DataFrame(rows)
    t = compute_dataset_ff_thresholds(df)
    # No SSW positives → ssw_avg_H falls back to 0.417.
    # Helix positives still computed from data: (0.5 + 0.6) / 2 = 0.55.
    assert abs(t["ssw_avg_H"] - 0.417) < 1e-9
    assert abs(t["helix_avg_uH"] - 0.55) < 1e-9
    assert t["n_ssw_positive"] == 0
    assert t["n_helix_positive"] == 2
    # Both classes have data → not a single-sequence fallback overall.
    assert t["single_sequence_fallback"] is False
