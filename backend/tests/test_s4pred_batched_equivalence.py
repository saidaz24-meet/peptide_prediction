# -*- coding: utf-8 -*-
"""
Regression test for PVL-perf-03: batched S4PRED forward must produce the
SAME prediction as the per-peptide legacy path, for every peptide in the
batch.

This is the architectural invariant from CLAUDE.md §1: single-sequence
and batch MUST produce identical results for the same peptide. Breaking
this invariant breaks reproducibility — a user analyzing one peptide via
Quick Analyze must see the same Helix/Beta/Coil prediction as the same
peptide submitted in a multi-sequence batch.

The test is conditionally skipped when S4PRED weights aren't available
locally (CI without weights, fresh dev machines), because S4PRED is a
heavy ML dependency. When weights ARE available the test runs the actual
model and compares predictions character-for-character.
"""

from __future__ import annotations

import os
from typing import List, Tuple

import numpy as np
import pytest

# Sentinel peptides chosen to cover edge cases:
# - Very short (KLVFF-7 — the canonical Aβ-derived fibril seed)
# - Medium (Uperin-3.5, Melittin)
# - Long enough to be the max-length item in a batch (LL-37 at 37 aa)
# Inhomogeneous lengths force the padded-batch path through its tricky case:
# padding contamination of the BiLSTM near sequence boundaries. The test
# catches any regression that re-introduces it.
TEST_PEPTIDES: List[Tuple[str, str]] = [
    ("Uperin-3.5", "GVGDLIRKAVSVIKNIV"),  # 17
    ("KLVFF-7", "KLVFFAE"),  # 7
    ("LL-37", "LLGDFFRKSKEKIGKEFKRIVQRIKDFLRNLVPRTES"),  # 37
    ("Melittin", "GIGAVLKVLTTGLPALISWIKRKRQQ"),  # 26
]


def _weights_available() -> bool:
    """True iff all 5 S4PRED ensemble weight files are present on disk."""
    weights_dir = os.environ.get("S4PRED_MODEL_PATH")
    if not weights_dir:
        # Fall back to the canonical project-root location.
        weights_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "tools",
            "s4pred",
            "models",
        )
    if not os.path.isdir(weights_dir):
        return False
    for n in range(1, 6):
        if not os.path.isfile(os.path.join(weights_dir, f"weights_{n}.pt")):
            return False
    return True


@pytest.mark.skipif(
    not _weights_available(),
    reason="S4PRED ensemble weights not available — skip numerical-equivalence test",
)
def test_batched_forward_matches_per_peptide_legacy() -> None:
    """For each test peptide, predict_sequences_batched must produce the
    SAME (ss_prediction, P_C, P_H, P_E) as predict_from_sequence."""
    # Import inside the test so the module-load cost only happens when we
    # actually have weights available.
    from tools.s4pred import get_predictor

    weights_path = os.environ.get("S4PRED_MODEL_PATH") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "tools",
        "s4pred",
        "models",
    )
    predictor = get_predictor(weights_path)

    legacy = [predictor.predict_from_sequence(eid, seq) for eid, seq in TEST_PEPTIDES]
    batched = predictor.predict_sequences_batched(TEST_PEPTIDES)

    assert len(legacy) == len(batched), "result count must match input count"

    # 1e-5 absolute tolerance — well above float32 noise (~1e-7 observed),
    # well below any predictive-difference threshold worth caring about.
    PROB_TOL = 1e-5

    for L, B in zip(legacy, batched):
        eid = L["entry_id"]
        assert L["entry_id"] == B["entry_id"], f"{eid}: entry_id misalignment"
        assert L["sequence"] == B["sequence"], f"{eid}: cleaned sequence differs"
        assert L["ss_prediction"] == B["ss_prediction"], (
            f"{eid}: ss_prediction differs — padding contamination has returned. "
            f"legacy={L['ss_prediction']!r} batched={B['ss_prediction']!r}"
        )
        for k in ("P_C", "P_H", "P_E"):
            l_arr, b_arr = np.array(L[k]), np.array(B[k])
            assert l_arr.shape == b_arr.shape, f"{eid}: {k} shape mismatch"
            max_diff = float(np.abs(l_arr - b_arr).max())
            assert max_diff < PROB_TOL, (
                f"{eid}: {k} max |Δ| = {max_diff:.2e} > tolerance {PROB_TOL:.0e}"
            )


@pytest.mark.skipif(
    not _weights_available(),
    reason="S4PRED ensemble weights not available — skip numerical-equivalence test",
)
def test_batched_forward_single_sequence_is_identical_to_legacy() -> None:
    """N=1 is the Quick Analyze case. The batched path must short-circuit
    to the legacy single-sequence path for N=1 so Quick Analyze stays
    bit-identical, including its handling of `x.squeeze()` in the network."""
    from tools.s4pred import get_predictor

    weights_path = os.environ.get("S4PRED_MODEL_PATH") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "tools",
        "s4pred",
        "models",
    )
    predictor = get_predictor(weights_path)

    one = [TEST_PEPTIDES[0]]
    legacy_single = predictor.predict_from_sequence(*one[0])
    batched_one = predictor.predict_sequences_batched(one)

    assert len(batched_one) == 1
    assert legacy_single["ss_prediction"] == batched_one[0]["ss_prediction"]
    for k in ("P_C", "P_H", "P_E"):
        l_arr, b_arr = np.array(legacy_single[k]), np.array(batched_one[0][k])
        assert (l_arr == b_arr).all(), (
            f"N=1 batched path produced different {k} probabilities than "
            "predict_from_sequence — Quick Analyze bit-equivalence is broken"
        )
