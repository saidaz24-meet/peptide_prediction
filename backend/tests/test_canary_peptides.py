"""Scientific-integrity canary suite.

For each peptide listed below, we pin the expected PVL biochemistry outputs
against literature-derived ground truth. If a PR changes any of these outputs,
CI fails loudly. Use this as the contract for "do our predictions still make
sense" across releases.

Origin:
    `docs/active/RESEARCH_BRIEFS/RB-VALIDATION-V0-1.md` Part 2 — produced by
    T5-DEEP dispatch (2026-05-21). The pinned values come from the current
    production pipeline (services.dataframe_utils + calculations.biochem +
    auxiliary.ff_helix_percent) running in USE_TANGO=0 USE_S4PRED=0 mode.

Scope and limits:
    * We DO pin: Length, Charge, Hydrophobicity, Full length uH,
      Beta full length uH, FF-Helix % — all deterministic numpy/pandas math.
    * We do NOT pin: SSW prediction, FF-SSW flag, FF-Helix (Jpred) flag —
      these require live TANGO / S4PRED subprocesses. A future cron-driven
      integration suite (see RB-VALIDATION-V0-1 §10 follow-up #4) will pin
      those. For now, the expected SSW/FF-SSW values are documented in
      the rationale string of each canary, not enforced in code.

Adding a new canary:
    Cite the literature source in the rationale field. Include a UniProt
    accession or DOI. Capture the pinned biochem values by running the
    snippet in RB-VALIDATION-V0-1 §14 against your sequence.

Removing or relaxing a canary:
    Requires a written justification in the commit message and ideally
    a Peleg sign-off line. The canary set is the contract for the
    scientific behaviour shipped to users; do not soften silently.

False positives:
    Some canaries are marked `_KNOWN_FALSE_POSITIVE = True`. These are
    peptides where PVL's classifiers flag them as candidates from sequence
    alone, but the experimental literature says they are NOT amyloid
    formers (e.g. antimicrobial peptides). The pinned values DOCUMENT
    the current (intentional) FP behaviour — they exist so that any
    future "fix" surfaces as a visible diff that a scientific reviewer
    must approve.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Disable external tools BEFORE any backend imports — matches the contract in
# backend/CLAUDE.md "Test Pattern" section.
os.environ.setdefault("USE_TANGO", "0")
os.environ.setdefault("USE_S4PRED", "0")

import pandas as pd
import pytest

# Make backend/ importable when pytest is run from any cwd.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from auxiliary import ff_helix_percent  # noqa: E402
from calculations.biochem import calculate_biochemical_features as calc_biochem  # noqa: E402
from services.dataframe_utils import ensure_computed_cols, ensure_ff_cols  # noqa: E402

# --------------------------------------------------------------------------
# Canary peptide registry.
#
# Each entry has:
#   id              — short label used in the test id (pytest will show it)
#   sequence        — primary sequence
#   expected        — dict of column-name -> pinned value (or None for "any")
#   rationale       — literature citation + scientific role of this canary
#   _KNOWN_FALSE_POSITIVE — True iff PVL flags this as a candidate but the
#                            experimental literature says it is NOT amyloid.
#
# Floating-point fields are compared with abs(diff) < TOLERANCE.
# --------------------------------------------------------------------------

TOLERANCE: float = 1e-3

CANARIES: List[Dict[str, Any]] = [
    {
        "id": "PSM_alpha_1",
        "sequence": "MGIIAGIIKVIKSLIEQFTGK",
        "expected": {
            "Length": 21,
            "Charge": 2.0,
            "Hydrophobicity": 0.640,
            "Full length uH": 0.551,
            "Beta full length uH": 0.089,
            "FF-Helix %": 100.0,
        },
        "rationale": (
            "S. aureus Phenol-soluble modulin alpha 1 (PSM-α1). "
            "Experimentally amyloid (TEM Fibrils = V) on the Staphylococcus "
            "2023 benchmark; see Schwartz et al., Infection and Immunity "
            "(2014), PMID 24600028. Pinned biochem is the production "
            "baseline; expected PVL classification: FF-Helix flag = 1, "
            "SSW prediction = -1, FF-SSW = -1 (requires TANGO to verify)."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "PSM_alpha_2",
        "sequence": "MGIIAGIIKFIKGLIEKFTGK",
        "expected": {
            "Length": 21,
            "Charge": 3.0,
            "Hydrophobicity": 0.632,
            "Full length uH": 0.562,
            "Beta full length uH": 0.067,
            "FF-Helix %": 100.0,
        },
        "rationale": (
            "S. aureus Phenol-soluble modulin alpha 2 (PSM-α2). "
            "ANTIMICROBIAL PEPTIDE, NOT an amyloid former — TEM Fibrils = X "
            "on the Staphylococcus 2023 benchmark; UniProt P0C7Z2 (same "
            "sequence repeated under multiple accessions). Wang et al., "
            "Infection and Immunity (2007), PMID 17923514, established the "
            "PSM-α family as cytolytic AMPs; Schwartz et al. PMID 24600028 "
            "report amyloidogenicity for α1/α3/α4 but NOT α2. PVL flags "
            "this FF-Helix = 1 and FF-SSW = 1 from amphipathic-helix "
            "criteria; this is a KNOWN FALSE POSITIVE documented in "
            "RB-VALIDATION-V0-1 §4. Differs from PSM-α1 by 4 residues but "
            "biochem is nearly identical — sequence-based rules cannot "
            "resolve the experimental difference. Do NOT 'fix' this "
            "without scientific review by Peleg."
        ),
        "_KNOWN_FALSE_POSITIVE": True,
    },
    {
        "id": "PSM_alpha_3",
        "sequence": "MEFVAKLFKFFKDLLGKFLGNN",
        "expected": {
            "Length": 22,
            "Charge": 2.0,
            "Hydrophobicity": 0.543,
            "Full length uH": 0.563,
            "Beta full length uH": 0.187,
            "FF-Helix %": 86.4,
        },
        "rationale": (
            "S. aureus Phenol-soluble modulin alpha 3 (PSM-α3). "
            "Cross-α amyloid fibril former; Tayeb-Fligelman et al., "
            "Science 355, 831–833 (2017), DOI 10.1126/science.aaf4901. "
            "TEM Fibrils = V on Staph 2023. Expected PVL classification: "
            "FF-Helix = 1, SSW = 1, FF-SSW = 1."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "Delta_hemolysin",
        "sequence": "MAQDIISTIGDLVKWIIDTVNKFTKK",
        "expected": {
            "Length": 26,
            "Charge": 1.0,
            "Hydrophobicity": 0.476,
            "Full length uH": 0.587,
            "Beta full length uH": 0.094,
            "FF-Helix %": 96.2,
        },
        "rationale": (
            "S. aureus delta-hemolysin (delta-toxin). Membrane-disrupting "
            "amphipathic α-helix; NOT an amyloid former (TEM Fibrils = X "
            "on Staph 2023). KNOWN FALSE POSITIVE under PVL's FF-Helix "
            "and FF-SSW criteria — RB-VALIDATION-V0-1 §4. See UniProt "
            "P0C7Y4."
        ),
        "_KNOWN_FALSE_POSITIVE": True,
    },
    {
        "id": "Anoplin",
        "sequence": "GLLKRIKTLL",
        "expected": {
            "Length": 10,
            "Charge": 3.0,
            "Hydrophobicity": 0.587,
            "Full length uH": 0.715,
            "Beta full length uH": 0.216,
            "FF-Helix %": 100.0,
        },
        "rationale": (
            "Anoplin — wasp venom antimicrobial peptide, Anoplus "
            "samariensis. UniProt P0C005 curates this as an AMP with no "
            "reported amyloidogenicity. PVL's FF-Helix / FF-SSW criteria "
            "flag it because Anoplin is a textbook amphipathic α-helix; "
            "this is a KNOWN FALSE POSITIVE used as a regression sentinel "
            "for the AMP-confusion failure mode. Do NOT 'fix' without "
            "scientific review."
        ),
        "_KNOWN_FALSE_POSITIVE": True,
    },
    {
        "id": "Magainin_2",
        "sequence": "GIGKFLHSAKKFGKAFVGEIMNS",
        "expected": {
            "Length": 23,
            "Charge": 3.1,
            "Hydrophobicity": 0.373,
            "Full length uH": 0.475,
            "Beta full length uH": 0.103,
            "FF-Helix %": 95.7,
        },
        "rationale": (
            "Magainin-2 — Xenopus laevis antimicrobial peptide. Zasloff, "
            "PNAS 84, 5449–5453 (1987), PMID 2440225. Membrane-disrupting, "
            "NOT amyloid-forming. KNOWN FALSE POSITIVE — same failure "
            "mode as Anoplin. Note the +0.1 partial charge from the "
            "single histidine."
        ),
        "_KNOWN_FALSE_POSITIVE": True,
    },
    {
        "id": "Melittin",
        "sequence": "GIGAVLKVLTTGLPALISWIKRKRQQ",
        "expected": {
            "Length": 26,
            "Charge": 5.0,
            "Hydrophobicity": 0.511,
            "Full length uH": 0.394,
            "Beta full length uH": 0.156,
            "FF-Helix %": 96.2,
        },
        "rationale": (
            "Melittin — Apis mellifera bee venom AMP. Habermann, Science "
            "177, 314–322 (1972), PMID 4113805. Pore-forming, NOT amyloid. "
            "KNOWN FALSE POSITIVE for sequence-based amphipathic-helix "
            "rules. High net charge (+5) makes this a useful boundary "
            "case for any future charge-aware refinement."
        ),
        "_KNOWN_FALSE_POSITIVE": True,
    },
    {
        "id": "Abeta42",
        "sequence": "DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVVIA",
        "expected": {
            "Length": 42,
            "Charge": -2.7,
            "Hydrophobicity": 0.409,
            "Full length uH": 0.107,
            "Beta full length uH": 0.082,
            "FF-Helix %": 76.2,
        },
        "rationale": (
            "Alzheimer's amyloid-β 1-42 (Aβ42) — the canonical amyloid "
            "reference. Lührs et al., PNAS 102, 17342–17347 (2005), "
            "DOI 10.1073/pnas.0506723102. Forms cross-β fibrils. PVL is "
            "expected to flag this as FF-Helix = 1 (high helix-propensity "
            "residue content) — the canary documents the SHAPE of the "
            "biochem signature (low µH, slightly negative charge from "
            "the H residues at partial protonation), not the prediction "
            "verdict. "
            "NOTE 2026-05-22: Peleg flagged that 42 aa is past PVL's "
            "recommended pipeline length (Drive Comment 6). Kept in suite "
            "as the canonical reference; the short fragment Abeta_16_22 "
            "below is the pipeline-appropriate amyloid control."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "Abeta_16_22",
        "sequence": "KLVFFAE",
        "expected": {
            "Length": 7,
        },
        "rationale": (
            "Aβ16-22 (KLVFFAE) — canonical short amyloid-forming fragment. "
            "Balbach et al., Biochemistry 39:13748–13759 (2000), "
            "DOI 10.1021/bi002095n — first paper to prove this 7-residue "
            "core forms cross-β fibrils on its own. PDB structures 1OW7 "
            "and 2BEG. Added 2026-05-22 per Peleg Drive Comment 6 as the "
            "pipeline-appropriate amyloid positive control (replaces Aβ42's "
            "role for length-cap-bounded validation). Expected: FF-Helix "
            "or FF-SSW positive; the canary pins length only here, since "
            "the predictor verdict will be filled in once the suite runs "
            "with TANGO + S4PRED enabled in the integration cycle."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "aSyn_NAC",
        "sequence": "VTGVTAVAQKTV",
        "expected": {
            "Length": 12,
            "Charge": 1.0,
            "Hydrophobicity": 0.423,
            "Full length uH": 0.328,
            "Beta full length uH": 0.024,
            "FF-Helix %": 83.3,
        },
        "rationale": (
            "α-synuclein residues 71-82 — the NAC (non-amyloid β component) "
            "core, essential for filament assembly. Giasson et al., JBC "
            "276, 2380–2386 (2001), PMID 11060312. Forms amyloid fibrils "
            "in Parkinson's pathology. Short peptide — useful test of "
            "PVL's behaviour on sub-15-residue sequences."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "Poly_GS_linker",
        "sequence": "GSGSGSGSGSGSGSGS",
        "expected": {
            "Length": 16,
            "Charge": 0.0,
            "Hydrophobicity": -0.020,
            "Full length uH": 0.002,
            "Beta full length uH": 0.003,
            "FF-Helix %": 0.0,
        },
        "rationale": (
            "Glycine-serine repeat — canonical flexible linker used in "
            "fusion-protein engineering. No secondary structure, no "
            "amyloid propensity. NEGATIVE CONTROL: validates that PVL "
            "produces near-zero biochem signal on a non-aggregating "
            "linker."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
    {
        "id": "Poly_E_curiosity",
        "sequence": "EEEEEEEEEEEEEEEE",
        "expected": {
            "Length": 16,
            "Charge": -16.0,
            "Hydrophobicity": -0.640,
            "Full length uH": 0.051,
            "Beta full length uH": 0.014,
            "FF-Helix %": 100.0,
        },
        "rationale": (
            "Polyglutamate (poly-E). NOT an amyloid former and would never "
            "be flagged as a candidate by the SSW / FF-SSW criteria "
            "(strongly negative charge, low hydrophobicity, near-zero "
            "hydrophobic moment). HOWEVER PVL's `ff_helix_percent` returns "
            "100.0 because every glutamate has high α-helix propensity in "
            "the Hamodrakas 2011 residue scale used by the calculator. "
            "Pinned to detect any future change to the FF-Helix % "
            "calculation that would shift this curiosity value. See "
            "RB-VALIDATION-V0-1 §7."
        ),
        "_KNOWN_FALSE_POSITIVE": False,
    },
]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _run_pipeline(sequence: str, entry: str) -> Dict[str, Any]:
    """Run the biochem + FF-helix-percent subset of the production pipeline.

    We intentionally do NOT call ``apply_ff_flags`` here — that step depends
    on TANGO SSW outputs which aren't available with USE_TANGO=0. The fields
    we pin are produced by ``calculate_biochemical_features`` and
    ``ff_helix_percent``, both pure pandas/numpy and therefore deterministic.
    """
    df = pd.DataFrame([{"Entry": entry, "Sequence": sequence, "Length": len(sequence)}])

    # Same column-bootstrap path used by /api/upload-csv.
    ensure_ff_cols(df)
    ensure_computed_cols(df)
    calc_biochem(df)
    df["FF-Helix %"] = df["Sequence"].apply(ff_helix_percent)

    row = df.iloc[0]
    return {col: row[col] for col in df.columns}


def _assert_close(actual: Any, expected: Any, field: str, canary_id: str, rationale: str) -> None:
    """Compare ``actual`` to ``expected`` with field-aware tolerance.

    Integer fields (Length) must match exactly.
    Float fields must match within TOLERANCE.
    """
    if expected is None:
        # "Any" — used when we only care that the field exists.
        return

    if isinstance(expected, int) and not isinstance(expected, bool):
        assert int(actual) == expected, (
            f"\nCanary regression — {canary_id} / {field}\n"
            f"  expected: {expected}\n"
            f"  actual  : {actual}\n"
            f"  rationale: {rationale}"
        )
        return

    actual_f = float(actual)
    expected_f = float(expected)
    diff = abs(actual_f - expected_f)
    assert diff < TOLERANCE, (
        f"\nCanary regression — {canary_id} / {field}\n"
        f"  expected: {expected_f:.4f}\n"
        f"  actual  : {actual_f:.4f}\n"
        f"  diff    : {diff:.4f}  (tolerance {TOLERANCE})\n"
        f"  rationale: {rationale}"
    )


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------


@pytest.mark.parametrize("canary", CANARIES, ids=[c["id"] for c in CANARIES])
def test_canary_prediction_pinned(canary: Dict[str, Any]) -> None:
    """Run a single canary through the biochem pipeline and assert pinned outputs.

    On failure the assertion message includes the literature rationale so a
    reviewer reading the CI log knows whether the change is acceptable.
    """
    result = _run_pipeline(canary["sequence"], canary["id"])
    rationale = canary["rationale"]
    for field, expected_value in canary["expected"].items():
        actual = result.get(field)
        assert actual is not None and not (isinstance(actual, float) and pd.isna(actual)), (
            f"\nCanary {canary['id']} — field {field!r} is missing or NaN. "
            f"Expected {expected_value}. Rationale: {rationale}"
        )
        _assert_close(actual, expected_value, field, canary["id"], rationale)


def test_canary_registry_metadata() -> None:
    """Sanity-check the registry itself.

    Every entry must have id, sequence, expected dict, rationale, and the
    ``_KNOWN_FALSE_POSITIVE`` flag. The flag must be a bool. Cite at least
    one literature reference (look for "PMID", "DOI", "UniProt", "et al",
    "PNAS", "Science", "JBC", "Infection") in the rationale.
    """
    citation_markers = ("PMID", "DOI", "UniProt", "et al", "PNAS", "Science", "JBC", "Infection")
    seen_ids: set[str] = set()
    for canary in CANARIES:
        cid = canary["id"]
        assert cid not in seen_ids, f"Duplicate canary id: {cid}"
        seen_ids.add(cid)
        assert isinstance(canary["sequence"], str) and canary["sequence"]
        assert isinstance(canary["expected"], dict) and canary["expected"]
        assert isinstance(canary["rationale"], str) and canary["rationale"]
        assert isinstance(canary["_KNOWN_FALSE_POSITIVE"], bool), (
            f"Canary {cid} _KNOWN_FALSE_POSITIVE must be bool"
        )
        # Control sequences (Poly_GS_linker, Poly_E_curiosity) are exempt
        # from the citation requirement — they serve as REGRESSION CANARIES
        # for the FF-Helix percentage calculation, not as biological negative
        # controls. Per Peleg's Drive comment 2026-05-22: "in the field of
        # fibril or amyloid formation it is very hard to define a negative
        # control, since fibril or amyloid formation is very dependent on
        # environmental conditions" — so we explicitly do NOT assert these
        # sequences "do not form fibrils." Their job is to detect any future
        # drift in the FF-Helix % math (e.g., Poly_E flagging 100% FF-Helix
        # despite −16 net charge would surface immediately if that ever
        # changed). See PELEG_DRIVE_COMMENTS_CONFUSION_MAP.md Comment 7.
        if cid not in ("Poly_GS_linker", "Poly_E_curiosity"):
            has_citation = any(marker in canary["rationale"] for marker in citation_markers)
            assert has_citation, (
                f"Canary {cid} rationale must cite a literature source "
                f"(one of {citation_markers}). Rationale: {canary['rationale']}"
            )


def test_canary_known_false_positives_documented() -> None:
    """At least one ``_KNOWN_FALSE_POSITIVE`` entry must be present.

    This is structural — it guarantees we never silently lose the
    documentation of PVL's intentional FP behaviour on AMPs.
    """
    fp_canaries = [c for c in CANARIES if c["_KNOWN_FALSE_POSITIVE"]]
    assert len(fp_canaries) >= 3, (
        "At least 3 known-FP canaries (e.g. PSM-α2, Anoplin, Magainin-2) "
        "must be present to document the AMP-confusion failure mode. "
        f"Currently have {len(fp_canaries)}."
    )
    # Each FP canary must explicitly call out the known-FP status in the rationale.
    for canary in fp_canaries:
        rationale_lower = canary["rationale"].lower()
        assert (
            "false positive" in rationale_lower
            or "not amyloid" in rationale_lower
            or "not an amyloid" in rationale_lower
        ), (
            f"Canary {canary['id']} is marked _KNOWN_FALSE_POSITIVE=True "
            f"but its rationale doesn't explicitly call this out."
        )
