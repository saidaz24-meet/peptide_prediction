# -*- coding: utf-8 -*-
"""
S4PRED Integration for PVL

This module provides S4PRED secondary structure prediction integration
for the Peptide Visual Lab application.

Based on the reference implementation from 260120_Alpha_and_SSW_FF_Predictor.
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

def get_s4pred_weights_path() -> Optional[str]:
    """Get the S4PRED weights path from settings."""
    return getattr(settings, 'S4PRED_MODEL_PATH', None) or os.getenv('S4PRED_MODEL_PATH')


def is_s4pred_available() -> Tuple[bool, Optional[str]]:
    """
    Check if S4PRED is available and configured.

    Returns:
        (available, reason_if_not)
    """
    # Check if enabled
    use_s4pred = getattr(settings, 'USE_S4PRED', False)
    if not use_s4pred:
        return False, "S4PRED is disabled (USE_S4PRED=0)"

    # Check weights path
    weights_path = get_s4pred_weights_path()
    if not weights_path:
        return False, "S4PRED_MODEL_PATH not configured"

    if not os.path.isdir(weights_path):
        return False, f"S4PRED weights directory not found: {weights_path}"

    # Check for weight files
    required_files = ['weights_1.pt', 'weights_2.pt', 'weights_3.pt', 'weights_4.pt', 'weights_5.pt']
    missing = [f for f in required_files if not os.path.exists(os.path.join(weights_path, f))]
    if missing:
        return False, f"Missing S4PRED weight files: {missing}"

    # Check for PyTorch
    try:
        import torch  # noqa: F401
    except ImportError:
        return False, "PyTorch not installed (required for S4PRED)"

    return True, None


# ---------------------------------------------------------------------
# Canonical column names (from reference implementation)
# ---------------------------------------------------------------------

HELIX_PREDICTION_S4PRED = 'Helix prediction (S4PRED)'
HELIX_FRAGMENTS_S4PRED = 'Helix fragments (S4PRED)'
HELIX_SCORE_S4PRED = 'Helix score (S4PRED)'
HELIX_PERCENTAGE_S4PRED = 'Helix percentage (S4PRED)'

SSW_PREDICTION_S4PRED = 'SSW prediction (S4PRED)'
SSW_FRAGMENTS_S4PRED = 'SSW fragments (S4PRED)'
SSW_SCORE_S4PRED = 'SSW score (S4PRED)'
SSW_DIFF_S4PRED = 'SSW diff (S4PRED)'
SSW_HELIX_PERCENTAGE_S4PRED = 'SSW helix percentage (S4PRED)'
SSW_BETA_PERCENTAGE_S4PRED = 'SSW beta percentage (S4PRED)'
SSW_PERCENTAGE_S4PRED = 'SSW percentage (S4PRED)'

# Per-residue curve column names
S4PRED_P_H_CURVE = 'S4PRED P_H curve'
S4PRED_P_E_CURVE = 'S4PRED P_E curve'
S4PRED_P_C_CURVE = 'S4PRED P_C curve'
S4PRED_SS_PREDICTION = 'S4PRED SS prediction'


# ---------------------------------------------------------------------
# Analysis Functions (matching reference 260120_Alpha_and_SSW_FF_Predictor/auxiliary.py)
# ---------------------------------------------------------------------

def _check_subsegment(prediction: List[float], start: int, end: int, min_segment_length: int) -> Tuple[int, int, float]:
    """
    Find the best subsegment within a given range.

    Matches reference auxiliary.py:__check_subsegment (lines 70-84).
    """
    from statistics import mean, median

    all_possible_lengths = list(range(min_segment_length, (end - start + 1 + 1)))
    max_start = -1
    max_end = -1
    max_score = -1.0

    for cur_length in all_possible_lengths:
        for i in range(start, end - cur_length + 1):
            cur_mean = mean(prediction[i:(i + cur_length)])
            cur_median = median(prediction[i:(i + cur_length)])
            if cur_mean > max_score or cur_median > max_score:
                max_score = max(cur_median, cur_mean)
                max_start = i
                max_end = i + cur_length

    return max_start, max_end, max_score


def _get_secondary_structure_segments(
    prediction_scores: List[float],
    min_score: float = 0.5,
    min_segment_length: int = 5,
    max_gap: int = 3
) -> List[Tuple[int, int]]:
    """
    Find contiguous segments where prediction score exceeds threshold.

    EXACT match to reference auxiliary.py:get_secondary_structure_segments (lines 87-127).
    Uses gap tracking and mean/median validation like reference implementation.

    Args:
        prediction_scores: Per-residue prediction scores
        min_score: Minimum score to count as positive (MIN_TANGO_SCORE=0 for Tango, MIN_S4PRED_SCORE=0.5 for S4PRED)
        min_segment_length: Minimum segment length to report (config.MIN_SEGMENT_LENGTH)
        max_gap: Maximum gap to merge across (config.MAX_GAP)

    Returns:
        List of (start, end) tuples (0-indexed)
    """
    from statistics import mean, median

    if not prediction_scores:
        return []

    segments = []
    i = 0

    while i < len(prediction_scores):
        # Start segment when we find a positive value (>0)
        if prediction_scores[i] > 0:
            start = i
            gap = 0
            i += 1

            # Extend segment, tracking gaps
            while i < len(prediction_scores) and gap <= max_gap:
                if prediction_scores[i] == 0:
                    gap += 1
                else:
                    gap = 0
                i += 1

            # Calculate actual end (exclude trailing gap)
            end = i - 1 - gap
            segment_length = end - start + 1

            # Validate segment using BOTH mean AND median (either must pass)
            # This matches reference: mean(prediction[start:end]) >= min_score or median(prediction[start:end]) >= min_score
            segment_slice = prediction_scores[start:end + 1]
            good_segment = (
                segment_length >= min_segment_length and
                (mean(segment_slice) >= min_score or median(segment_slice) >= min_score)
            )

            if good_segment:
                segments.append((start, end))
            elif segment_length >= min_segment_length:
                # Try to find a valid subsegment (reference fallback logic)
                shorter_start, shorter_end, shorter_score = _check_subsegment(
                    prediction_scores, start, end, min_segment_length
                )
                if shorter_end != -1 and shorter_start != -1 and shorter_score >= min_score:
                    segments.append((shorter_start, shorter_end))

        i += 1

    return segments


def _calc_average_score(scores: List[float], segments: List[Tuple[int, int]]) -> float:
    """
    Calculate average score over segments.

    EXACT match to reference auxiliary.py:__calc_average_score (lines 130-145).
    Calculates the MEAN OF SEGMENT MEANS (not mean of all residues).
    """
    from statistics import mean

    if not segments:
        return -1.0

    # Calculate mean of each segment, then mean of those means
    segment_scores = []
    for start, end in segments:
        segment_slice = scores[start:end + 1]
        if segment_slice:
            segment_scores.append(mean(segment_slice))

    return mean(segment_scores) if segment_scores else -1.0


def _get_segment_percentage(segments: List[Tuple[int, int]], sequence_length: int) -> float:
    """
    Calculate percentage of residues in segments.

    EXACT match to reference auxiliary.py:get_secondary_structure_prediction_percentage_by_segment_indexes (lines 246-262).
    Returns rounded to 2 decimal places.
    """
    if not segments or sequence_length == 0:
        return 0

    sum_predicted_residues = 0
    for segment_start, segment_end in segments:
        sum_predicted_residues += (segment_end - segment_start) + 1

    percentage = (sum_predicted_residues / sequence_length) * 100
    return round(percentage, 2)


def _find_ssw_segments(
    helix_segments: List[Tuple[int, int]],
    beta_segments: List[Tuple[int, int]]
) -> List[Tuple[int, int]]:
    """
    Find Secondary Structure Switch (SSW) segments where helix and beta overlap.

    EXACT match to reference auxiliary.py:find_secondary_structure_switch_segments (lines 170-227).
    Uses complex pointer-based merging algorithm from reference.

    Args:
        helix_segments: List of (start, end) helix segments
        beta_segments: List of (start, end) beta segments

    Returns:
        List of (start, end) SSW segments
    """
    if not helix_segments or not beta_segments:
        return []

    merged_segments = []
    helix_ind = 0
    beta_ind = 0

    while helix_ind < len(helix_segments) and beta_ind < len(beta_segments):
        h_start = helix_segments[helix_ind][0]
        h_end = helix_segments[helix_ind][1]
        b_start = beta_segments[beta_ind][0]
        b_end = beta_segments[beta_ind][1]

        # [] {} - helix ends before beta starts
        if h_end <= b_start:
            helix_ind += 1
            continue

        # {} [] - beta ends before helix starts
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

    return merged_segments


def _calc_ssw_score_and_diff(
    helix_scores: List[float],
    beta_scores: List[float],
    ssw_segments: List[Tuple[int, int]]
) -> Tuple[float, float]:
    """
    Calculate SSW score and diff from helix/beta predictions.

    EXACT match to reference auxiliary.py:calc_secondary_structure_switch_difference_and_score (lines 148-167).
    SSW score = beta_score + helix_score (SUM, not average!)
    SSW diff = abs(beta_score - helix_score)

    Args:
        helix_scores: Per-residue helix probabilities
        beta_scores: Per-residue beta probabilities
        ssw_segments: SSW segment positions

    Returns:
        (ssw_score, ssw_diff) tuple
    """
    if not ssw_segments:
        return -1.0, -1.0

    # Use the same average calculation as reference (mean of segment means)
    beta_score = _calc_average_score(beta_scores, ssw_segments)
    helix_score = _calc_average_score(helix_scores, ssw_segments)

    if beta_score < 0 or helix_score < 0:
        return -1.0, -1.0

    # Reference: ssw_score = beta_score + helix_score (SUM!)
    ssw_score = beta_score + helix_score
    ssw_diff = abs(beta_score - helix_score)

    return ssw_score, ssw_diff


def analyse_s4pred_result(prediction_result: Dict) -> Dict:
    """
    Analyse S4PRED prediction result for a single sequence.

    EXACT match to reference s4pred.py:__analyse_s4pred_sequence_results (lines 129-219).

    Args:
        prediction_result: Result from S4PREDPredictor.predict_from_sequence()

    Returns:
        Dictionary with analysis results matching reference column names
    """
    from config import settings

    # Get thresholds from config (matching reference config.py)
    min_s4pred_score = getattr(settings, 'MIN_S4PRED_SCORE', 0.5)
    min_segment_length = getattr(settings, 'MIN_SEGMENT_LENGTH', 5)
    max_gap = getattr(settings, 'MAX_GAP', 3)

    # Initialize result dict matching reference (lines 164-174)
    result = {
        HELIX_PREDICTION_S4PRED: -1,
        HELIX_FRAGMENTS_S4PRED: [],
        HELIX_SCORE_S4PRED: -1.0,
        HELIX_PERCENTAGE_S4PRED: 0,  # Note: reference uses 0 not 0.0
        SSW_FRAGMENTS_S4PRED: [],
        SSW_SCORE_S4PRED: -1.0,
        SSW_DIFF_S4PRED: -1.0,
        SSW_HELIX_PERCENTAGE_S4PRED: 0,
        SSW_BETA_PERCENTAGE_S4PRED: 0,
        SSW_PERCENTAGE_S4PRED: 0,
    }

    helix_scores = prediction_result.get('P_H', [])
    beta_scores = prediction_result.get('P_E', [])
    sequence_length = len(helix_scores)

    if sequence_length == 0:
        return result

    # ----------------------------------------------------
    # Helix prediction analysis (reference lines 178-190)
    # ----------------------------------------------------
    helix_segments = _get_secondary_structure_segments(
        helix_scores, min_s4pred_score, min_segment_length, max_gap
    )
    helix_avg_score = _calc_average_score(helix_scores, helix_segments)
    helix_percentage = _get_segment_percentage(helix_segments, sequence_length)

    if helix_segments:
        result[HELIX_PERCENTAGE_S4PRED] = helix_percentage
        result[HELIX_PREDICTION_S4PRED] = 1
        result[HELIX_FRAGMENTS_S4PRED] = helix_segments
        result[HELIX_SCORE_S4PRED] = helix_avg_score

    # ----------------------------------------------------
    # Secondary structure switch prediction analysis (reference lines 192-218)
    # ----------------------------------------------------
    # Beta segments use min_score=0 (reference line 195)
    beta_segments = _get_secondary_structure_segments(
        beta_scores, 0, min_segment_length, max_gap
    )

    # NOTE: Reference s4pred.py:197-198 has parameters SWAPPED:
    # ssw_fragments = auxiliary.find_secondary_structure_switch_segments(
    #     beta_segments=helix_segments,    # <-- swapped!
    #     helix_segments=beta_segments)    # <-- swapped!
    # We replicate this exact behavior for biological accuracy
    ssw_segments = _find_ssw_segments(
        helix_segments=beta_segments,  # Reference passes beta_segments as helix_segments
        beta_segments=helix_segments   # Reference passes helix_segments as beta_segments
    )

    # Calculate SSW score and diff (reference lines 200-203)
    ssw_score, ssw_diff = _calc_ssw_score_and_diff(
        helix_scores=helix_scores,
        beta_scores=beta_scores,
        ssw_segments=ssw_segments
    )

    # Early return if no SSW segments (reference lines 208-209)
    if not ssw_segments:
        return result

    # Update result with SSW data (reference lines 211-218)
    result[SSW_FRAGMENTS_S4PRED] = ssw_segments
    result[SSW_SCORE_S4PRED] = ssw_score
    result[SSW_DIFF_S4PRED] = ssw_diff
    result[SSW_HELIX_PERCENTAGE_S4PRED] = helix_percentage
    result[SSW_BETA_PERCENTAGE_S4PRED] = _get_segment_percentage(beta_segments, sequence_length)
    result[SSW_PERCENTAGE_S4PRED] = _get_segment_percentage(ssw_segments, sequence_length)

    return result


# ---------------------------------------------------------------------
# Main Runner Functions
# ---------------------------------------------------------------------

def run_s4pred_sequences(
    sequences: List[Tuple[str, str]],
    trace_id: Optional[str] = None
) -> Tuple[List[Dict], Dict[str, Any]]:
    """
    Run S4PRED on a list of sequences.

    Args:
        sequences: List of (entry_id, sequence) tuples
        trace_id: Optional trace ID for logging

    Returns:
        (results, stats) where:
          - results: List of dictionaries with S4PRED analysis
          - stats: Statistics dictionary with requested/success/failed counts
    """
    start_time = time.time()
    stats = {
        'requested': len(sequences),
        'parsed_ok': 0,
        'parsed_bad': 0,
        'runtime_ms': 0,
    }

    # Check availability
    available, reason = is_s4pred_available()
    if not available:
        logger.warning(f"[{trace_id}] S4PRED not available: {reason}")
        return [], stats

    weights_path = get_s4pred_weights_path()
    logger.info(f"[{trace_id}] Running S4PRED on {len(sequences)} sequences")

    try:
        from tools.s4pred import get_predictor
        predictor = get_predictor(weights_path)
    except Exception as e:
        logger.error(f"[{trace_id}] Failed to initialize S4PRED: {e}")
        stats['parsed_bad'] = len(sequences)
        return [], stats

    results = []

    for entry_id, sequence in sequences:
        try:
            # Run prediction
            prediction = predictor.predict_from_sequence(entry_id, sequence)

            # Analyse results
            analysis = analyse_s4pred_result(prediction)

            # Combine prediction curves with analysis
            result = {
                'entry_id': entry_id,
                'P_C': prediction['P_C'],
                'P_H': prediction['P_H'],
                'P_E': prediction['P_E'],
                'ss_prediction': prediction['ss_prediction'],
                **analysis
            }

            results.append(result)
            stats['parsed_ok'] += 1

        except Exception as e:
            logger.warning(f"[{trace_id}] S4PRED failed for {entry_id}: {e}")
            stats['parsed_bad'] += 1
            # Add empty result to maintain alignment
            results.append({'entry_id': entry_id})

    stats['runtime_ms'] = int((time.time() - start_time) * 1000)
    logger.info(
        f"[{trace_id}] S4PRED completed: {stats['parsed_ok']}/{stats['requested']} "
        f"in {stats['runtime_ms']}ms"
    )

    return results, stats


def run_s4pred_database(
    database: pd.DataFrame,
    database_name: str,
    trace_id: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    """
    Run S4PRED on a DataFrame and add result columns in-place.

    Args:
        database: DataFrame with 'Entry' and 'Sequence' columns
        database_name: Name for logging
        trace_id: Optional trace ID

    Returns:
        (success, stats) tuple
    """
    # Extract sequences
    sequences = []
    for _, row in database.iterrows():
        entry_id = str(row.get('Entry', ''))
        sequence = str(row.get('Sequence', ''))
        if entry_id and sequence:
            sequences.append((entry_id, sequence))

    if not sequences:
        logger.warning(f"[{trace_id}] No valid sequences for S4PRED")
        return False, {'requested': 0, 'parsed_ok': 0, 'parsed_bad': 0}

    results, stats = run_s4pred_sequences(sequences, trace_id)

    if stats['parsed_ok'] == 0:
        return False, stats

    # Initialize columns - analysis results
    analysis_columns = [
        HELIX_PREDICTION_S4PRED,
        HELIX_FRAGMENTS_S4PRED,
        HELIX_SCORE_S4PRED,
        HELIX_PERCENTAGE_S4PRED,
        SSW_FRAGMENTS_S4PRED,
        SSW_SCORE_S4PRED,
        SSW_DIFF_S4PRED,
        SSW_HELIX_PERCENTAGE_S4PRED,
        SSW_BETA_PERCENTAGE_S4PRED,
        SSW_PERCENTAGE_S4PRED,
    ]

    # Per-residue curve columns
    curve_columns = [
        S4PRED_P_H_CURVE,
        S4PRED_P_E_CURVE,
        S4PRED_P_C_CURVE,
        S4PRED_SS_PREDICTION,
    ]

    all_columns = analysis_columns + curve_columns

    for col in all_columns:
        database[col] = None

    # Map results back to DataFrame
    entry_to_result = {r['entry_id']: r for r in results if 'entry_id' in r}

    for idx, row in database.iterrows():
        entry_id = str(row.get('Entry', ''))
        if entry_id in entry_to_result:
            result = entry_to_result[entry_id]
            # Map analysis columns
            for col in analysis_columns:
                if col in result:
                    database.at[idx, col] = result[col]
            # Map per-residue curves
            if 'P_H' in result:
                database.at[idx, S4PRED_P_H_CURVE] = result['P_H']
            if 'P_E' in result:
                database.at[idx, S4PRED_P_E_CURVE] = result['P_E']
            if 'P_C' in result:
                database.at[idx, S4PRED_P_C_CURVE] = result['P_C']
            if 'ss_prediction' in result:
                database.at[idx, S4PRED_SS_PREDICTION] = result['ss_prediction']

    return True, stats


def filter_by_s4pred_diff(
    database: pd.DataFrame,
    threshold: float = 0.0,
    comparison: str = "<"
) -> List[Optional[int]]:
    """
    Generate S4PRED SSW predictions based on whether SSW fragments exist.

    Reference implementation semantics (260120_Alpha_and_SSW_FF_Predictor/s4pred.py):
    - SSW prediction is positive (1) when SSW fragments exist (ssw_diff >= 0)
    - SSW prediction is negative (-1) when S4PRED ran but no SSW overlap found
    - SSW prediction is None when S4PRED didn't run for this row

    The reference doesn't have an explicit "SSW prediction" column - it uses
    SSW diff/fragments to determine switch presence. We replicate that logic here.

    Args:
        database: DataFrame with S4PRED columns
        threshold: Not used (kept for API compatibility)
        comparison: Not used (kept for API compatibility)

    Returns:
        List of predictions (1=positive, -1=negative, None=unavailable)
    """
    predictions = []

    for _, row in database.iterrows():
        ssw_diff = row.get(SSW_DIFF_S4PRED)
        ssw_fragments = row.get(SSW_FRAGMENTS_S4PRED)
        helix_pred = row.get(HELIX_PREDICTION_S4PRED)
        helix_pct = row.get(HELIX_PERCENTAGE_S4PRED)

        # Check if S4PRED ran for this row (helix_pred is -1 or 1 when S4PRED ran)
        s4pred_ran = (
            helix_pred is not None and
            not (isinstance(helix_pred, float) and pd.isna(helix_pred)) and
            helix_pred in [-1, 1]
        )

        # Fallback: check if helix_pct exists (0 is valid when no helix found)
        if not s4pred_ran:
            s4pred_ran = (
                helix_pct is not None and
                not (isinstance(helix_pct, float) and pd.isna(helix_pct))
            )

        # SSW prediction is positive when SSW fragments exist
        # Reference: if len(ssw_fragments) > 0, SSW switch is detected
        has_ssw_fragments = (
            ssw_fragments is not None and
            isinstance(ssw_fragments, list) and
            len(ssw_fragments) > 0
        )

        # Alternative check: ssw_diff >= 0 indicates SSW segments were found
        has_valid_ssw_diff = (
            ssw_diff is not None and
            not (isinstance(ssw_diff, float) and pd.isna(ssw_diff)) and
            ssw_diff >= 0
        )

        if has_ssw_fragments or has_valid_ssw_diff:
            # SSW segments exist → positive prediction
            predictions.append(1)
        elif s4pred_ran:
            # S4PRED ran but no SSW overlap found → negative prediction
            predictions.append(-1)
        else:
            # S4PRED didn't run → unavailable
            predictions.append(None)

    return predictions
