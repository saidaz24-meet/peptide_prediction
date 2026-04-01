import math
import os
import re
from collections import defaultdict
from statistics import mean, median
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

import biochem_calculation

# SSW segment detection thresholds
MIN_LENGTH = 5
MAX_GAP = 3
MIN_TANGO_SCORE = 0

# --- FF-Helix helpers (pure Python; no external tools) ---

# Simple helix propensity (normalized ~0..1) — tweak if you like
_HELIX_PROP = {
    "A": 1.42,
    "E": 1.51,
    "L": 1.21,
    "M": 1.45,
    "Q": 1.11,
    "K": 1.14,
    "R": 0.98,
    "I": 1.08,
    "V": 1.06,
    "W": 1.08,
    "F": 1.13,
    "T": 0.83,
    "S": 0.77,
    "Y": 0.69,
    "H": 1.00,
    "C": 0.70,
    "N": 0.67,
    "D": 1.01,
    "G": 0.57,
    "P": 0.57,
}


def _safe_seq_str(seq) -> str:
    """Convert sequence to string, handling NaN/None/float values safely."""
    if seq is None or (isinstance(seq, float) and pd.isna(seq)):
        return ""
    if not isinstance(seq, str):
        return str(seq)
    return seq


def _hprop(seq):
    """Get helix propensity for each residue in sequence."""
    s = _safe_seq_str(seq).upper()
    return [_HELIX_PROP.get(aa, 1.0) for aa in s]


def ff_helix_percent(seq, core_len: Optional[int] = None, thr: Optional[float] = None) -> float:
    """
    Calculate percentage of residues that belong to ≥core_len window with mean helix propensity ≥ threshold.
    Uses a more realistic threshold of 1.0 (average helix propensity).

    Args:
        seq: Amino acid sequence (handles NaN/None gracefully)
        core_len: Window size for helix core detection (default from FF_HELIX_CORE_LEN env, or 6)
        thr: Threshold for helix propensity (default from config, or 1.0)

    Returns a value in [0.0, 100.0] (clamped to ensure valid range).
    """
    # Get defaults from config (with fallback for backward compatibility)
    if core_len is None:
        try:
            from config import settings

            core_len = settings.FF_HELIX_CORE_LEN
        except ImportError:
            core_len = int(os.getenv("FF_HELIX_CORE_LEN", "6"))
    if thr is None:
        try:
            from config import settings

            thr = settings.FF_HELIX_THRESHOLD
        except ImportError:
            thr = float(os.getenv("FF_HELIX_THRESHOLD", "1.0"))
    s = _safe_seq_str(seq).upper().strip()
    if len(s) < core_len:
        return 0.0

    hp = _hprop(s)
    in_core = [False] * len(s)

    # Check each possible window
    for i in range(len(s) - core_len + 1):
        window_props = hp[i : i + core_len]
        window_mean = sum(window_props) / core_len

        if window_mean >= thr:
            # Mark all residues in this window as part of a helix core
            for j in range(i, i + core_len):
                in_core[j] = True

    if not any(in_core):
        return 0.0

    percent = round(100.0 * sum(in_core) / len(s), 1)
    # Ensure result is in valid range [0.0, 100.0]
    return max(0.0, min(100.0, percent))


def ff_helix_cores(seq, core_len: Optional[int] = None, thr: Optional[float] = None):
    """
    Find FF-Helix core segments as contiguous regions where sliding windows meet threshold.
    Returns list of [start, end] segments (1-indexed).

    Args:
        seq: Amino acid sequence (handles NaN/None gracefully)
        core_len: Window size for helix core detection (default from config, or 6)
        thr: Threshold for helix propensity (default from config, or 1.0)
    """
    # Get defaults from config (with fallback for backward compatibility)
    if core_len is None:
        try:
            from config import settings

            core_len = settings.FF_HELIX_CORE_LEN
        except ImportError:
            core_len = int(os.getenv("FF_HELIX_CORE_LEN", "6"))
    if thr is None:
        try:
            from config import settings

            thr = settings.FF_HELIX_THRESHOLD
        except ImportError:
            thr = float(os.getenv("FF_HELIX_THRESHOLD", "1.0"))
    s = _safe_seq_str(seq).upper().strip()
    if len(s) < core_len:
        return []

    hp = _hprop(s)
    core_marks = [False] * len(s)

    # Mark residues that are part of qualifying windows
    for i in range(len(s) - core_len + 1):
        window_props = hp[i : i + core_len]
        window_mean = sum(window_props) / core_len

        if window_mean >= thr:
            for j in range(i, i + core_len):
                core_marks[j] = True

    # Convert marks to contiguous segments
    segments = []
    i = 0
    while i < len(s):
        if core_marks[i]:
            start = i
            # Find the end of this contiguous region
            while i < len(s) and core_marks[i]:
                i += 1
            end = i - 1
            # Convert to 1-indexed and add to results
            segments.append([start + 1, end + 1])
        else:
            i += 1

    return segments


def __check_subsegment(prediction: list, start: int, end: int) -> tuple:
    all_possible_length = list(range(MIN_LENGTH, (end - start + 1 + 1)))
    max_start = -1
    max_end = -1
    max_score = -1
    for cur_length in all_possible_length:
        for i in range(start, end - cur_length + 2):  # +2: inclusive end
            cur_mean = mean(prediction[i : (i + cur_length)])
            cur_median = median(prediction[i : (i + cur_length)])
            if cur_mean > max_score or cur_median > max_score:
                max_score = max(cur_median, cur_mean)
                max_start = i
                max_end = i + cur_length - 1  # inclusive end to match segment convention

    return max_start, max_end, max_score


def get_secondary_structure_segments(prediction: list, prediction_method: str) -> list:
    """
    Calculate segments predicted to have above-threshold secondary structure.

    :param prediction_method: name of the tool the prediction came from (e.g. "Tango")
    :param prediction: list of float numbers indicating the prediction score for each residue
    :return: list of tuples with start and end indexes of segments predicted to have secondary structure
    """
    min_score = -np.inf
    if prediction_method == "Tango":
        min_score = MIN_TANGO_SCORE

    segments = []
    i = 0
    while i < len(prediction):
        if prediction[i] > 0:
            start = i
            gap = 0
            i += 1
            while i < len(prediction) and gap <= MAX_GAP:
                if prediction[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1

            end = i - 1 - gap
            segment_length = end - start + 1
            good_segment = segment_length >= MIN_LENGTH and (
                mean(prediction[start : end + 1]) >= min_score
                or median(prediction[start : end + 1]) >= min_score
            )
            if good_segment:
                segments.append((start, end))
            elif segment_length >= MIN_LENGTH:
                shorter_segment_start, shorter_segment_end, shorter_segment_score = (
                    __check_subsegment(prediction, start, end)
                )
                if (
                    shorter_segment_end is not None
                    and shorter_segment_start is not None
                    and shorter_segment_score >= min_score
                ):
                    segments.append((shorter_segment_start, shorter_segment_end))

        i += 1
    return segments


def __calc_average_score(prediction: list, structure_prediction_indexes: list) -> Optional[float]:
    """
    Calculates the average score of the secondary structure prediction by averaging the average score of each segment
    predicted to have secondary structure.

    :param prediction: list of prediction scores
    :param structure_prediction_indexes: list of tuples, each tuple represent the start and end index of segment
    predicted to have secondary structure.
    :return: average prediction score, or None if no segments
    """
    if len(structure_prediction_indexes) == 0:
        return None  # No segments to calculate
    segments_scores = []
    for start, end in structure_prediction_indexes:
        segments_scores.append(mean(prediction[start : end + 1]))
    return mean(segments_scores)


def calc_secondary_structure_switch_difference_and_score(
    beta_prediction: list, helix_prediction: list, structure_prediction_indexes: list
) -> tuple:
    """
    Calculate the score of secondary structure switch segments by summing the average score of the helical prediction
    and beta prediction. In addition, it calculates the difference between these averaged scores.

    :param beta_prediction: list of prediction scores
    :param helix_prediction: list of prediction scores
    :param structure_prediction_indexes: list of tuples, each tuple represent the start and end index of segment
    predicted to have secondary structure.
    :return: secondary structure switch score, secondary structure switch difference (None, None if no segments)
    """
    if len(structure_prediction_indexes) == 0:
        return None, None  # No segments to calculate

    beta_score = __calc_average_score(beta_prediction, structure_prediction_indexes)
    helix_score = __calc_average_score(helix_prediction, structure_prediction_indexes)
    ssw_score = beta_score + helix_score
    ssw_diff = abs(beta_score - helix_score)
    return ssw_score, ssw_diff


def find_secondary_structure_switch_segments(beta_segments: list, helix_segments: list) -> list:
    """
    Merge segments predicted to be helical and beta to one secondary structure switch (SSW) segment prediction.
    SSW segments are residues that have both helical and beta residues that their length is larger than MIN_LENGTH.

    :param beta_segments: list of tuples where each tuple represent the start and end index of a predicted segment
    :param helix_segments: list of tuples where each tuple represent the start and end index of a predicted segment
    :return: list of tuples where each tuple represent the start and end index of a predicted segment
    """
    merged_segments = []
    helix_ind = 0
    beta_ind = 0
    # print("helix_segments={}, beta_segments={}".format(helix_segments, beta_segments))
    # print("result = {}".format(result))
    while helix_ind < len(helix_segments) and beta_ind < len(beta_segments):
        # print("helix_ind={}, beta_ind={}".format(helix_ind, beta_ind))
        h_start = helix_segments[helix_ind][0]
        h_end = helix_segments[helix_ind][1]
        b_start = beta_segments[beta_ind][0]
        b_end = beta_segments[beta_ind][1]
        # print("h_start={}, h_end={}\nb_start={}, b_end={}".format(h_start, h_end, b_start, b_end))

        """ [] {} """
        if h_end <= b_start:
            helix_ind += 1
            continue

        """ {} [] """
        if b_end <= h_start:
            beta_ind += 1
            continue

        if b_start < h_start or b_start == h_start:
            merged_segments.append((h_start, h_end))
            if h_end == b_end:
                beta_ind += 1
            helix_ind += 1
            continue

        if h_start <= b_start:
            merged_segments.append((b_start, b_end))
            if h_end == b_end:
                helix_ind += 1
            beta_ind += 1
            continue

        if b_start < h_start and b_end < h_end:
            merged_segments.append((h_start, b_end))
            beta_ind += 1
            continue

        if h_start < b_start and h_end < b_end:
            merged_segments.append((b_start, h_end))
            helix_ind += 1
            continue

    # print("merged_segments = {}".format(merged_segments))
    return merged_segments


def get_avg_uH_by_segments(sequence: str, segments: list) -> Optional[float]:
    """
    Calculate average hydrophobic moment for given segments.
    Returns None if no valid segments (instead of -1).
    """
    if not sequence or not segments:
        return None  # No data to calculate

    try:
        total_muH = 0.0
        total_length = 0

        for segment in segments:
            if len(segment) >= 2:
                start, end = segment[0] - 1, segment[1]  # Convert to 0-indexed
                if 0 <= start < len(sequence) and start < end <= len(sequence):
                    seg_seq = sequence[start:end]
                    if seg_seq:  # Make sure segment is not empty
                        muH = biochem_calculation.hydrophobic_moment(seg_seq)
                        total_muH += muH * len(seg_seq)
                        total_length += len(seg_seq)

        return total_muH / total_length if total_length > 0 else None

    except Exception as e:
        from services.logger import log_debug

        log_debug("uH_segment_error", f"Error in get_avg_uH_by_segments: {e}")
        return None  # Return None on error


def check_secondary_structure_prediction_content(
    secondary_structure_prediction_conf: list,
) -> float:
    """
    This function calculates the percentage of secondary structure prediction of the sequence.

    :param secondary_structure_prediction_conf: list of floats with confidence value of secondary structure prediction.
    :return: percentage of secondary structure prediction
    """
    # Filter out NaN/None values — they shouldn't inflate the denominator
    valid_values = [
        v
        for v in secondary_structure_prediction_conf
        if v is not None and not (isinstance(v, float) and math.isnan(v))
    ]
    if not valid_values:
        return 0
    residues_with_secondary_structure_prediction = sum(1 for v in valid_values if v > 0)
    if residues_with_secondary_structure_prediction == 0:
        return 0
    return (residues_with_secondary_structure_prediction / len(valid_values)) * 100


def get_corrected_sequence(sequence) -> str:
    """
    Substitute letters for general amino acid to be compatible with prediction tools:
    "X" -> "A"  (unknown → alanine)
    "Z" -> "E"  (Glu/Gln ambiguity → glutamate)
    "B" -> "D"  (Asp/Asn ambiguity → aspartate)
    "U" -> "C"  (selenocysteine → cysteine)
    "O" -> "K"  (pyrrolysine → lysine)
    "J" -> "L"  (Leu/Ile ambiguity → leucine)

    :param sequence: The sequence to modify (handles NaN/None gracefully)
    :return: sequence with the substituted amino acids, or empty string if invalid
    """
    # Handle NaN, None, or non-string values
    if sequence is None or (isinstance(sequence, float) and pd.isna(sequence)):
        return ""
    if not isinstance(sequence, str):
        sequence = str(sequence)

    # B10: Strip known chemical modifications before cleaning
    for prefix in (
        "Ac-",
        "ac-",
        "Acetyl-",
        "acetyl-",
        "pGlu-",
        "pglu-",
        "Pyr-",
        "For-",
        "Myr-",
        "Palm-",
    ):
        if sequence.startswith(prefix):
            sequence = sequence[len(prefix) :]
            break
    for suffix in ("-NH2", "-nh2", "-amide", "-OH", "-COOH", "-CONH2"):
        if sequence.endswith(suffix):
            sequence = sequence[: -len(suffix)]
            break

    # Strip non-letter characters (keep dashes for terminal modification handling)
    sequence = re.sub(r"[^A-Za-z-]", "", sequence)
    if not sequence or sequence == "-":
        return ""

    s1 = sequence.replace("X", "A")
    s2 = s1.replace("Z", "E")
    s3 = s2.replace("U", "C")
    s4 = s3.replace("B", "D")
    s4 = s4.replace("O", "K")
    s4 = s4.replace("J", "L")
    if "-" in s4:
        return s4.split("-")[0].upper()
    return s4.upper()


# Substitution reason map for user-facing notes (ISSUE-024)
_SUBSTITUTION_REASONS: Dict[str, Tuple[str, str]] = {
    "X": ("A", "Unknown residue → Alanine"),
    "Z": ("E", "Glu/Gln ambiguity → Glutamate"),
    "B": ("D", "Asp/Asn ambiguity → Aspartate"),
    "U": ("C", "Selenocysteine → Cysteine"),
    "O": ("K", "Pyrrolysine → Lysine"),
    "J": ("L", "Leu/Ile ambiguity → Leucine"),
}


def get_corrected_sequence_with_notes(
    sequence,
) -> Tuple[str, List[Dict], str]:
    """
    Like get_corrected_sequence(), but also returns substitution details.

    Returns:
        Tuple of:
        - corrected_sequence (str): The cleaned sequence
        - substitutions (list[dict]): Each substitution made, e.g.:
            [{"position": 3, "original": "X", "replacement": "A", "reason": "Unknown residue → Alanine"}]
        - notes (str): Human-readable summary, or empty string if no changes
    """
    if sequence is None or (isinstance(sequence, float) and pd.isna(sequence)):
        return "", [], ""
    if not isinstance(sequence, str):
        sequence = str(sequence)

    note_parts: List[str] = []

    # B10: Strip common chemical modifications before cleaning
    # N-terminal modifications (prefixes)
    _n_terminal_mods = [
        ("Ac-", "N-terminal acetylation (Ac-)"),
        ("ac-", "N-terminal acetylation (Ac-)"),
        ("Acetyl-", "N-terminal acetylation (Acetyl-)"),
        ("acetyl-", "N-terminal acetylation (Acetyl-)"),
        ("pGlu-", "N-terminal pyroglutamylation (pGlu-)"),
        ("pglu-", "N-terminal pyroglutamylation (pGlu-)"),
        ("Pyr-", "N-terminal pyroglutamylation (Pyr-)"),
        ("For-", "N-terminal formylation (For-)"),
        ("Myr-", "N-terminal myristoylation (Myr-)"),
        ("Palm-", "N-terminal palmitoylation (Palm-)"),
    ]
    for prefix, description in _n_terminal_mods:
        if sequence.startswith(prefix):
            note_parts.append(f"{description} removed")
            sequence = sequence[len(prefix) :]
            break

    # C-terminal modifications (suffixes)
    _c_terminal_mods = [
        ("-NH2", "C-terminal amidation (-NH2)"),
        ("-nh2", "C-terminal amidation (-NH2)"),
        ("-amide", "C-terminal amidation (-amide)"),
        ("-OH", "C-terminal free acid (-OH)"),
        ("-COOH", "C-terminal carboxyl (-COOH)"),
        ("-CONH2", "C-terminal amidation (-CONH2)"),
    ]
    for suffix, description in _c_terminal_mods:
        if sequence.endswith(suffix):
            note_parts.append(f"{description} removed")
            sequence = sequence[: -len(suffix)]
            break

    # Track non-letter characters stripped
    non_letters = re.findall(r"[^A-Za-z-]", sequence)
    if non_letters:
        note_parts.append("Non-amino acid characters removed")

    # Strip non-letter characters (keep dashes for terminal modification handling)
    stripped = re.sub(r"[^A-Za-z-]", "", sequence)
    if not stripped or stripped == "-":
        return "", [], ""

    # Track any remaining terminal modification removal (generic dash pattern)
    terminal_mod = None
    if "-" in stripped:
        parts = stripped.split("-", 1)
        if len(parts) > 1 and parts[1]:
            terminal_mod = parts[1]
            note_parts.append(f"Terminal modification '-{terminal_mod}' removed")
        stripped = parts[0]

    # Uppercase for substitution tracking
    upper = stripped.upper()

    # Track substitutions character by character
    substitutions: List[Dict] = []
    result_chars: List[str] = []
    for i, ch in enumerate(upper):
        if ch in _SUBSTITUTION_REASONS:
            replacement, reason = _SUBSTITUTION_REASONS[ch]
            substitutions.append(
                {
                    "position": i + 1,  # 1-based
                    "original": ch,
                    "replacement": replacement,
                    "reason": reason,
                }
            )
            result_chars.append(replacement)
        else:
            result_chars.append(ch)

    corrected = "".join(result_chars)

    # Build human-readable substitution summary
    if substitutions:
        # Group by original → positions
        grouped: Dict[str, List[int]] = defaultdict(list)
        for sub in substitutions:
            grouped[sub["original"]].append(sub["position"])
        parts = []
        for orig, positions in grouped.items():
            replacement = _SUBSTITUTION_REASONS[orig][0]
            pos_str = ", ".join(str(p) for p in positions)
            if len(positions) == 1:
                parts.append(f"{orig}→{replacement} (position {pos_str})")
            else:
                parts.append(f"{orig}→{replacement} (positions {pos_str})")
        note_parts.insert(0, "Non-standard residues substituted: " + ", ".join(parts))

    notes = ". ".join(note_parts) + ("." if note_parts else "")
    if notes == ".":
        notes = ""

    return corrected, substitutions, notes
