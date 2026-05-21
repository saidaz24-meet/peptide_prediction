"""
ISSUE-032 — FF axiom invariants.

Two axioms anchor the 4-category classification (ADR-003 + Peleg canonical):
    1. ffSswFlag   == 1 ⇒ sswPrediction          == 1
    2. ffHelixFlag == 1 ⇒ s4predHelixPrediction  == 1

These tests pin the contract end-to-end: a row with TANGO=-1, S4PRED=1, and
hydrophobicity above threshold must emit BOTH sswPrediction=1 AND ffSswFlag=1.
Before the unified-SSW fix, this scenario produced sswPrediction=-1 and
ffSswFlag=1 (axiom violated). After the fix, both fields derive from the same
TANGO∪S4PRED mask, and the API normalizer enforces the invariant as
defense-in-depth.
"""

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.dataframe_utils import apply_ff_flags  # noqa: E402
from services.normalize import _enforce_ff_axioms, normalize_rows_for_ui  # noqa: E402


CUSTOM_THRESHOLDS = {
    "muHCutoff": 0.4,
    "hydroCutoff": 0.5,
    "ffHelixPercentThreshold": 50.0,
}


def _ssw_row(*, entry: str, tango_ssw: int, s4pred_ssw: int, hydro: float) -> dict:
    """A minimal row with the columns apply_ff_flags + normalize need."""
    return {
        "Entry": entry,
        "Sequence": "FFLGTLVKLGKKIF",  # P85089 sequence
        "Length": 14,
        "Hydrophobicity": hydro,
        "Charge": 3.0,
        "Full length uH": 0.3,
        "Beta full length uH": 0.2,
        "SSW prediction": tango_ssw,
        "SSW prediction (S4PRED)": s4pred_ssw,
        "SSW score": 0.5,
        "SSW diff": -0.1,
        "SSW helix percentage": 30.0,
        "SSW beta percentage": 20.0,
        "FF-Helix %": 30.0,
        "FF Helix fragments": [],
        # No helix data — keeps the test focused on the SSW axiom
        "Helix prediction (S4PRED)": None,
    }


def _run_pipeline(rows: list) -> list:
    df = pd.DataFrame(rows)
    apply_ff_flags(df, resolved_thresholds=CUSTOM_THRESHOLDS, threshold_mode="custom")
    return normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=True,
        s4pred_enabled=True,
    )


class TestFfSswAxiom:
    """ffSswFlag == 1 ⇒ sswPrediction == 1."""

    def test_s4pred_only_ssw_with_hydro_above_threshold_yields_both_positive(self):
        """The P85089 / P0C005 bug scenario.

        TANGO says NO SSW, S4PRED says SSW, hydrophobicity above threshold.
        Per Peleg canonical: SSW = TANGO ∪ S4PRED, so sswPrediction MUST be 1
        and ffSswFlag MUST be 1. Before the fix, sswPrediction was -1 while
        ffSswFlag was 1 → axiom violation.
        """
        rows = _run_pipeline([_ssw_row(entry="P85089_TEST", tango_ssw=-1, s4pred_ssw=1, hydro=0.7)])
        row = rows[0]
        assert row["ffSswFlag"] == 1, (
            f"ffSswFlag expected 1 (S4PRED says SSW + hydro above threshold), got "
            f"{row.get('ffSswFlag')}"
        )
        assert row["sswPrediction"] == 1, (
            f"AXIOM VIOLATION: ffSswFlag=1 but sswPrediction={row.get('sswPrediction')}. "
            f"sswPrediction must reflect TANGO ∪ S4PRED, not TANGO-only."
        )

    def test_tango_only_ssw_with_hydro_above_threshold_yields_both_positive(self):
        rows = _run_pipeline([_ssw_row(entry="TANGO_ONLY", tango_ssw=1, s4pred_ssw=-1, hydro=0.7)])
        row = rows[0]
        assert row["ffSswFlag"] == 1
        assert row["sswPrediction"] == 1

    def test_neither_provider_ssw_yields_no_ff_ssw(self):
        rows = _run_pipeline([_ssw_row(entry="NO_SSW", tango_ssw=-1, s4pred_ssw=-1, hydro=0.9)])
        row = rows[0]
        assert row["ffSswFlag"] == -1
        assert row["sswPrediction"] == -1

    def test_ssw_with_hydro_below_threshold_is_ssw_but_not_ff_ssw(self):
        """SSW=1 but hydrophobicity below cutoff → SSW pill shows positive,
        FF-SSW pill shows negative. The axiom doesn't require equality, only
        ffSsw=1 ⇒ ssw=1."""
        rows = _run_pipeline(
            [_ssw_row(entry="SSW_LOW_HYDRO", tango_ssw=1, s4pred_ssw=-1, hydro=0.1)]
        )
        row = rows[0]
        assert row["ffSswFlag"] == -1, "below hydro threshold → no FF-SSW"
        assert row["sswPrediction"] == 1, "TANGO says SSW → sswPrediction stays 1"

    def test_batch_with_mixed_provider_signals_preserves_axiom_per_row(self):
        rows = _run_pipeline(
            [
                _ssw_row(entry="A", tango_ssw=-1, s4pred_ssw=1, hydro=0.7),  # axiom bug seed
                _ssw_row(entry="B", tango_ssw=1, s4pred_ssw=-1, hydro=0.7),
                _ssw_row(entry="C", tango_ssw=-1, s4pred_ssw=-1, hydro=0.7),
                _ssw_row(entry="D", tango_ssw=1, s4pred_ssw=1, hydro=0.9),
            ]
        )
        for row in rows:
            if row.get("ffSswFlag") == 1:
                assert row.get("sswPrediction") == 1, (
                    f"axiom violation for entry={row.get('id')}: "
                    f"ffSswFlag=1 but sswPrediction={row.get('sswPrediction')}"
                )


class TestEnforceFfAxiomsDefenseLayer:
    """The normalize-boundary enforcer is the last line of defense.

    Even if upstream code regressed and tried to emit a violating row, the
    enforcer must clamp the FF flag so the API contract holds.
    """

    def test_zeros_out_ff_ssw_when_ssw_is_negative(self):
        bogus = {"ffSswFlag": 1, "sswPrediction": -1, "id": "X"}
        result = _enforce_ff_axioms(bogus, "X")
        assert result["ffSswFlag"] == -1
        assert result["sswPrediction"] == -1  # untouched

    def test_zeros_out_ff_ssw_when_ssw_is_none(self):
        bogus = {"ffSswFlag": 1, "sswPrediction": None, "id": "X"}
        result = _enforce_ff_axioms(bogus, "X")
        assert result["ffSswFlag"] == -1

    def test_zeros_out_ff_helix_when_helix_is_negative(self):
        bogus = {"ffHelixFlag": 1, "s4predHelixPrediction": -1, "id": "X"}
        result = _enforce_ff_axioms(bogus, "X")
        assert result["ffHelixFlag"] == -1

    def test_leaves_consistent_row_unchanged(self):
        good = {
            "ffSswFlag": 1,
            "sswPrediction": 1,
            "ffHelixFlag": 1,
            "s4predHelixPrediction": 1,
            "id": "OK",
        }
        result = _enforce_ff_axioms(dict(good), "OK")
        assert result == good


class TestPerPredictorVerdictPreserved:
    """Scientific integrity (Said directive 2026-05-20): the unified SSW
    summary is the canonical OR mask, but TANGO's and S4PRED's individual
    verdicts must be exposed UNCHANGED so the EvidencePanel can show their
    disagreement honestly.

    These tests pin that the API serializes both:
      - sswPrediction (camelCase "SSW prediction") = unified TANGO ∪ S4PRED
      - tangoSswPrediction (camelCase "TANGO SSW prediction") = TANGO-only raw
      - s4predSswPrediction (camelCase "SSW prediction (S4PRED)") = S4PRED-only raw

    Reproduces the Anoplin (P0C005) case Said reported: pre-fix UI showed
    "TANGO: Positive S4PRED: Positive" after ISSUE-032, which was wrong
    because TANGO's actual verdict was Negative.
    """

    def test_tango_negative_s4pred_positive_preserves_per_predictor_disagreement(self):
        """The P0C005 / Anoplin case: TANGO says no SSW, S4PRED says yes.
        Unified summary must be Positive (canonical OR), but the per-predictor
        breakdown must preserve the disagreement so the UI shows TANGO: Negative."""
        rows = _run_pipeline(
            [_ssw_row(entry="P0C005_TEST", tango_ssw=-1, s4pred_ssw=1, hydro=0.7)]
        )
        row = rows[0]
        assert row["sswPrediction"] == 1, (
            "unified summary should be Positive (S4PRED says SSW)"
        )
        assert row["tangoSswPrediction"] == -1, (
            "TANGO's raw verdict must be preserved as Negative — UI shows what "
            "TANGO actually computed, not the unified mask"
        )
        assert row["s4predSswPrediction"] == 1, (
            "S4PRED's raw verdict must be preserved as Positive"
        )

    def test_tango_positive_s4pred_negative_preserves_per_predictor_disagreement(self):
        """Mirror: TANGO says yes, S4PRED says no. Unified Positive; per-predictor honest."""
        rows = _run_pipeline(
            [_ssw_row(entry="MIRROR_TEST", tango_ssw=1, s4pred_ssw=-1, hydro=0.7)]
        )
        row = rows[0]
        assert row["sswPrediction"] == 1
        assert row["tangoSswPrediction"] == 1
        assert row["s4predSswPrediction"] == -1

    def test_both_predictors_agree_positive(self):
        rows = _run_pipeline(
            [_ssw_row(entry="AGREE_POS", tango_ssw=1, s4pred_ssw=1, hydro=0.7)]
        )
        row = rows[0]
        assert row["sswPrediction"] == 1
        assert row["tangoSswPrediction"] == 1
        assert row["s4predSswPrediction"] == 1

    def test_both_predictors_agree_negative(self):
        rows = _run_pipeline(
            [_ssw_row(entry="AGREE_NEG", tango_ssw=-1, s4pred_ssw=-1, hydro=0.9)]
        )
        row = rows[0]
        assert row["sswPrediction"] == -1
        assert row["tangoSswPrediction"] == -1
        assert row["s4predSswPrediction"] == -1
