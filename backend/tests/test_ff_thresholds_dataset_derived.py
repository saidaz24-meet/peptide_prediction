"""Tests for ``compute_dataset_ff_thresholds`` — Peleg main.py:147-150.

Pins the contract that, on a multi-row dataset with valid positive-class
rows, the FF gate thresholds equal the per-batch mean of the relevant
metric over the positive-class rows — exactly the calculation in Peleg's
``perform_fibril_formation_prediction``.
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
    """Single dict shaped like a row of the production DataFrame."""
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


def _make_df(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(rows)


def test_ssw_avg_h_equals_manual_mean_over_ssw_positive_rows():
    """ssw_avg_H = mean(Hydrophobicity) over rows where SSW prediction == 1."""
    df = _make_df(
        [
            _row(entry="A", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.4),
            _row(entry="B", ssw=1, hydro=0.3, helix_pred=1, helix_uh=0.2),
            _row(entry="C", ssw=-1, hydro=0.9, helix_pred=-1, helix_uh=0.0),
            _row(entry="D", ssw=1, hydro=0.7, helix_pred=1, helix_uh=0.6),
        ]
    )
    result = compute_dataset_ff_thresholds(df)
    expected = (0.5 + 0.3 + 0.7) / 3
    assert abs(result["ssw_avg_H"] - expected) < 1e-9
    assert result["n_ssw_positive"] == 3
    assert result["single_sequence_fallback"] is False


def test_helix_avg_uh_equals_manual_mean_over_helix_positive_rows():
    """helix_avg_uH = mean(Helix uH) over rows where helix prediction != -1."""
    df = _make_df(
        [
            _row(entry="A", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.4),
            _row(entry="B", ssw=1, hydro=0.3, helix_pred=-1, helix_uh=0.9),
            _row(entry="C", ssw=-1, hydro=0.9, helix_pred=1, helix_uh=0.6),
            _row(entry="D", ssw=1, hydro=0.7, helix_pred=1, helix_uh=0.2),
        ]
    )
    result = compute_dataset_ff_thresholds(df)
    expected = (0.4 + 0.6 + 0.2) / 3
    assert abs(result["helix_avg_uH"] - expected) < 1e-9
    assert result["n_helix_positive"] == 3


def test_50_row_synthetic_dataset_matches_manual_mean():
    """50-row dataset stress-test (catches drift if internal masking changes)."""
    rows = []
    for i in range(50):
        rows.append(
            _row(
                entry=f"P{i}",
                ssw=1 if i % 2 == 0 else -1,
                hydro=0.1 * (i % 10),
                helix_pred=1 if i % 3 == 0 else -1,
                helix_uh=0.05 * (i % 8),
            )
        )
    df = _make_df(rows)
    result = compute_dataset_ff_thresholds(df)

    ssw_hydros = [r["Hydrophobicity"] for r in rows if r["SSW prediction"] == 1]
    helix_uhs = [r["Helix (s4pred) uH"] for r in rows if r["Helix prediction (S4PRED)"] != -1]
    assert abs(result["ssw_avg_H"] - sum(ssw_hydros) / len(ssw_hydros)) < 1e-9
    assert abs(result["helix_avg_uH"] - sum(helix_uhs) / len(helix_uhs)) < 1e-9
    assert result["n_ssw_positive"] == len(ssw_hydros)
    assert result["n_helix_positive"] == len(helix_uhs)
    assert result["single_sequence_fallback"] is False


def test_apply_ff_flags_threshold_provenance_surfaced_in_return():
    """apply_ff_flags returns the new bookkeeping fields verbatim so the
    callers (predict_service / upload_service) can merge them into
    Meta.thresholds."""
    df = _make_df(
        [
            _row(entry="A", ssw=1, hydro=0.5, helix_pred=1, helix_uh=0.4),
            _row(entry="B", ssw=1, hydro=0.3, helix_pred=1, helix_uh=0.2),
        ]
    )
    out = apply_ff_flags(df)
    for key in (
        "sswAvgHUsed",
        "helixAvgUhUsed",
        "nSswPositive",
        "nHelixPositive",
        "singleSequenceFallback",
    ):
        assert key in out, f"missing FF threshold provenance key: {key}"
    assert out["nSswPositive"] == 2
    assert out["nHelixPositive"] == 2
    assert out["singleSequenceFallback"] is False
    assert abs(out["sswAvgHUsed"] - (0.5 + 0.3) / 2) < 1e-9
    assert abs(out["helixAvgUhUsed"] - (0.4 + 0.2) / 2) < 1e-9
