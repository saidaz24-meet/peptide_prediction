"""Single-sequence FF threshold fallback — Peleg constants override mean.

For len(database) <= 1 the per-batch mean of a single positive row equals
that row's metric, so the FF gate would trivially pass for any SSW-positive
single sequence. ``compute_dataset_ff_thresholds`` recognises this and
substitutes Peleg's documented single-sequence constants — 0.417 for
hydrophobicity and 0.388 for helix μH — and marks
``single_sequence_fallback=True`` so the UI can disclose the fallback.
"""

from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import settings  # noqa: E402
from services.dataframe_utils import (  # noqa: E402
    apply_ff_flags,
    compute_dataset_ff_thresholds,
)


def _single_ssw_positive_row(hydro: float, helix_uh: float) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Entry": "ONLY",
                "Sequence": "AAAAAAAAAAA",
                "Length": 11,
                "Hydrophobicity": hydro,
                "Charge": 1.0,
                "Full length uH": 0.3,
                "Beta full length uH": 0.2,
                "SSW prediction": 1,
                "SSW prediction (S4PRED)": -1,
                "SSW score": 0.5,
                "SSW diff": -0.1,
                "SSW helix percentage": 10.0,
                "SSW beta percentage": 20.0,
                "Helix prediction (S4PRED)": 1,
                "Helix (s4pred) uH": helix_uh,
                "Helix score (S4PRED)": 0.7,
                "Helix fragments (S4PRED)": [[0, 5]],
            }
        ]
    )


def test_single_sequence_uses_peleg_defaults_not_data_mean():
    df = _single_ssw_positive_row(hydro=0.92, helix_uh=0.81)
    result = compute_dataset_ff_thresholds(df)
    assert result["single_sequence_fallback"] is True
    assert abs(result["ssw_avg_H"] - settings.PELEG_DEFAULT_HYDRO_THRESHOLD) < 1e-9
    assert abs(result["helix_avg_uH"] - settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD) < 1e-9


def test_single_sequence_marks_fallback_in_apply_ff_flags_return():
    df = _single_ssw_positive_row(hydro=0.92, helix_uh=0.81)
    out = apply_ff_flags(df)
    assert out["singleSequenceFallback"] is True
    # The FF gate uses the Peleg defaults — not the row's own metric.
    assert abs(out["sswAvgHUsed"] - settings.PELEG_DEFAULT_HYDRO_THRESHOLD) < 1e-9
    assert abs(out["helixAvgUhUsed"] - settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD) < 1e-9


def test_single_sequence_below_peleg_default_does_not_pass_ff_ssw():
    """Hydro below 0.417 → FF-SSW = -1, even though SSW prediction = 1."""
    df = _single_ssw_positive_row(hydro=0.30, helix_uh=0.20)
    apply_ff_flags(df)
    # Below both Peleg constants → both gates fail.
    assert df["FF-Secondary structure switch"].iloc[0] == -1
    assert df["FF-Helix (Jpred)"].iloc[0] == -1


def test_single_sequence_above_peleg_default_passes_ff_ssw():
    """Hydro/μH above the Peleg constants → both gates pass."""
    df = _single_ssw_positive_row(hydro=0.50, helix_uh=0.50)
    apply_ff_flags(df)
    assert df["FF-Secondary structure switch"].iloc[0] == 1
    assert df["FF-Helix (Jpred)"].iloc[0] == 1


def test_empty_df_uses_peleg_defaults_and_flags_fallback():
    df = pd.DataFrame()
    result = compute_dataset_ff_thresholds(df)
    assert result["single_sequence_fallback"] is True
    assert abs(result["ssw_avg_H"] - settings.PELEG_DEFAULT_HYDRO_THRESHOLD) < 1e-9
    assert abs(result["helix_avg_uH"] - settings.PELEG_DEFAULT_HELIX_UH_THRESHOLD) < 1e-9
    assert result["n_ssw_positive"] == 0
    assert result["n_helix_positive"] == 0
