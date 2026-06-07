"""Tests that ``tangoSswFragments`` is surfaced on the per-peptide response.

The TANGO binary writes a list of ``[start, end]`` segment coordinates
into the DataFrame column ``"SSW fragments"``. Pre-2026-06 PVL never
surfaced this column on the API response, so the SSW (TANGO) sequence
track in the UI had to be faked. This test pins the new contract:
when TANGO produced fragments, ``tangoSswFragments`` is present on the
normalised row; when TANGO's sentinel ``"-"`` is in the column, the API
emits ``None`` (not the literal string).
"""

from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from schemas.peptide import PeptideSchema  # noqa: E402
from services.normalize import normalize_rows_for_ui  # noqa: E402


def _base_row(*, entry: str, ssw_fragments) -> dict:
    return {
        "Entry": entry,
        "Sequence": "ACDEFGHIKLMNPQRST",
        "Length": 17,
        "Hydrophobicity": 0.5,
        "Charge": 1.0,
        "Full length uH": 0.3,
        "Beta full length uH": 0.2,
        "SSW prediction": 1,
        "SSW prediction (S4PRED)": -1,
        "SSW prediction (unified)": 1,
        "SSW score": 0.5,
        "SSW diff": -0.1,
        "SSW helix percentage": 30.0,
        "SSW beta percentage": 25.0,
        "SSW fragments": ssw_fragments,
        "FF-Helix %": 30.0,
        "FF Helix fragments": [],
        "FF-Helix (Jpred)": 1,
        "FF-Secondary structure switch": 1,
        "Helix prediction (S4PRED)": 1,
        "Helix fragments (S4PRED)": [[1, 7]],
        "Helix score (S4PRED)": 0.7,
        "Helix (s4pred) uH": 0.5,
    }


def test_tango_ssw_fragments_present_when_tango_ran_with_segments():
    row = _base_row(entry="WITH_SEGS", ssw_fragments=[[2, 8], [11, 16]])
    df = pd.DataFrame([row])
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=True,
        s4pred_enabled=True,
    )
    assert rows_out[0]["tangoSswFragments"] == [[2, 8], [11, 16]]


def test_tango_ssw_fragments_null_when_column_holds_dash_sentinel():
    row = _base_row(entry="DASH", ssw_fragments="-")
    df = pd.DataFrame([row])
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=True,
        s4pred_enabled=True,
    )
    assert rows_out[0].get("tangoSswFragments") is None


def test_tango_ssw_fragments_null_when_tango_provider_unavailable():
    """If TANGO is OFF, normalize.py nullifies all TANGO fields."""
    row = _base_row(entry="OFF", ssw_fragments=[[1, 5]])
    df = pd.DataFrame([row])
    rows_out = normalize_rows_for_ui(
        df,
        is_single_row=False,
        tango_enabled=False,  # provider OFF
        s4pred_enabled=True,
    )
    assert rows_out[0].get("tangoSswFragments") is None


def test_peptide_schema_field_alias_maps_ssw_fragments_to_tango_ssw_fragments():
    """The PeptideSchema field validator/alias contract."""
    obj = PeptideSchema.parse_obj(
        {
            "Entry": "X",
            "Sequence": "ABC",
            "SSW fragments": [[0, 3]],
        }
    )
    assert obj.tango_ssw_fragments == [[0, 3]]
    camel = obj.to_camel_dict()
    assert camel["tangoSswFragments"] == [[0, 3]]
