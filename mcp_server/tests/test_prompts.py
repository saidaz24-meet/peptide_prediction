"""Tests pinning Peleg's domain axioms inside ``SYSTEM_PROMPT``.

If you change ``prompts.py``, update these tests in the same change — they
are intentionally strict because the system prompt is what the LLM "sees"
when it decides whether to call PVL tools, and any drift on the four
canonical categories or the three CRITICAL CORRECTIONS would silently
mis-classify peptides in user-facing answers.
"""

from __future__ import annotations

import re

from pvl_mcp.prompts import SYSTEM_PROMPT


def test_prompt_credits_peleg_and_technion():
    assert "Peleg Ragonis-Bachar" in SYSTEM_PROMPT
    assert "Technion" in SYSTEM_PROMPT


def test_prompt_defines_helix_with_continuous_residues_and_score():
    # Helix definition: S4PRED + minimal-continuous-residues + minimal-helix-score.
    assert re.search(
        r"\*\*Helical\*\*\s*=\s*a peptide with S4PRED-predicted helix segments",
        SYSTEM_PROMPT,
    )
    assert "minimal-continuous-residues threshold" in SYSTEM_PROMPT
    assert "minimal-helix-score threshold" in SYSTEM_PROMPT


def test_prompt_defines_ff_helix_using_uH_not_hydrophobicity():
    # FF-Helix uses HYDROPHOBIC MOMENT (uH), NOT hydrophobicity.
    assert re.search(
        r"\*\*Fibril-Forming Helix \(FF-Helix\)\*\*\s*=\s*Helical AND uH > uH_threshold",
        SYSTEM_PROMPT,
    )
    assert "FF-Helix uses the HYDROPHOBIC MOMENT (uH) threshold, NOT hydrophobicity" in SYSTEM_PROMPT


def test_prompt_defines_ssw_with_OR_logic_not_AND():
    # SSW uses OR logic between TANGO and S4PRED (Peleg FIX-001 axiom).
    assert re.search(
        r"\*\*Secondary Structure Switch \(SSW\)\*\*\s*=\s*TANGO OR S4PRED prediction is indecisive",
        SYSTEM_PROMPT,
    )
    assert "Logic is OR, not AND" in SYSTEM_PROMPT


def test_prompt_defines_ff_ssw_using_hydrophobicity_not_uH():
    # FF-SSW uses HYDROPHOBICITY, NOT uH.
    assert re.search(
        r"\*\*Fibril-Forming SSW \(FF-SSW\)\*\*\s*=\s*SSW AND hydrophobicity > hydrophobicity_threshold",
        SYSTEM_PROMPT,
    )
    assert "FF-SSW uses HYDROPHOBICITY, NOT uH" in SYSTEM_PROMPT


def test_prompt_contains_critical_corrections():
    # The three CRITICAL CORRECTIONS that the LLM must never violate.
    assert "CRITICAL CORRECTIONS" in SYSTEM_PROMPT
    assert '"Aggregation" (TANGO output) is NOT the same as "fibril formation"' in SYSTEM_PROMPT
    assert "Chou-Fasman propensity is OUTDATED" in SYSTEM_PROMPT
    assert "CD spectroscopy is NEVER mentioned in PVL outputs" in SYSTEM_PROMPT


def test_prompt_lists_all_seven_tools_by_name():
    """Every registered tool must be referenced in the system prompt so the
    LLM knows it exists. If a tool is added/removed, the prompt must change too."""
    for tool_name in (
        "search_uniprot",
        "analyze_sequences",
        "get_peptide_detail",
        "rank_candidates",
        "compare_cohorts",
        "find_similar_peptides",
        "get_pvl_version",
    ):
        assert tool_name in SYSTEM_PROMPT, f"tool {tool_name!r} missing from SYSTEM_PROMPT"
