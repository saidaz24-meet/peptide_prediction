/**
 * Smart aggregation flagging module.
 *
 * Implements 4 rules from the holistic review for intelligent
 * aggregation-prone peptide flagging — replaces simple
 * "aggMax > threshold" with multi-rule assessment.
 *
 * A peptide is flagged if ANY rule triggers (OR logic).
 */

import type { Peptide } from "@/types/peptide";

export type AggFlag = {
  flagged: boolean;
  rules: {
    contiguousHotspot: boolean; // Rule 1: ≥5 consecutive residues above aggThreshold
    percentOfLength: boolean; // Rule 2: agg residues / length > percentCutoff
    sswDeletion: boolean; // Rule 3: too few SSW residues → unreliable SSW
  };
  contiguousLength?: number; // Longest contiguous hotspot stretch
  aggResidueCount?: number; // Number of residues above threshold
  aggResiduePercent?: number; // Percentage of sequence that's aggregation-prone
};

export type AggFlagConfig = {
  aggThreshold: number; // Per-residue threshold (default 5.0%)
  percentOfLengthCutoff: number; // % of sequence that counts as agg-prone (default 20%)
  minSswResidues: number; // Min SSW residues to keep classification (default 3)
};

export const DEFAULT_AGG_CONFIG: AggFlagConfig = {
  aggThreshold: 5.0,
  percentOfLengthCutoff: 20.0,
  minSswResidues: 3,
};

/**
 * Find the longest contiguous stretch of residues where all values ≥ threshold.
 * Returns [length, start, end] of the best stretch.
 */
function longestContiguousHotspot(
  aggCurve: number[],
  threshold: number
): { length: number; start: number; end: number } {
  let bestLen = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let curStart = -1;

  for (let i = 0; i < aggCurve.length; i++) {
    if (aggCurve[i] >= threshold) {
      if (curStart === -1) curStart = i;
    } else {
      if (curStart !== -1) {
        const len = i - curStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = curStart;
          bestEnd = i;
        }
        curStart = -1;
      }
    }
  }
  // Handle stretch extending to end
  if (curStart !== -1) {
    const len = aggCurve.length - curStart;
    if (len > bestLen) {
      bestLen = len;
      bestStart = curStart;
      bestEnd = aggCurve.length;
    }
  }

  return { length: bestLen, start: bestStart, end: bestEnd };
}

/**
 * Count residues in SSW fragments.
 */
function countSswResidues(peptide: Peptide): number {
  // Use TANGO SSW fragments first, then S4PRED SSW fragments
  const fragments = peptide.extra?.sswFragments ?? peptide.s4predSswFragments;

  if (!fragments || !Array.isArray(fragments) || fragments.length === 0) {
    return 0;
  }

  let count = 0;
  for (const frag of fragments) {
    if (Array.isArray(frag) && frag.length >= 2) {
      count += Math.max(0, frag[1] - frag[0]);
    } else if (frag && typeof frag === "object" && "start" in frag && "end" in frag) {
      count += Math.max(
        0,
        (frag as { start: number; end: number }).end -
          (frag as { start: number; end: number }).start
      );
    }
  }
  return count;
}

/**
 * Compute smart aggregation flag for a single peptide.
 *
 * A peptide is flagged if ANY of the 3 rules triggers.
 */
export function computeAggFlag(
  peptide: Peptide,
  config: AggFlagConfig = DEFAULT_AGG_CONFIG
): AggFlag {
  const aggCurve = peptide.tango?.agg;
  const seqLength = peptide.length ?? peptide.sequence?.length ?? 0;

  // Default unflagged result
  const result: AggFlag = {
    flagged: false,
    rules: {
      contiguousHotspot: false,
      percentOfLength: false,
      sswDeletion: false,
    },
  };

  // Rules 1 & 2 require per-residue curve
  if (aggCurve && aggCurve.length > 0) {
    // Rule 1: Contiguous hotspot (≥5 consecutive residues above aggThreshold)
    const hotspot = longestContiguousHotspot(aggCurve, config.aggThreshold);
    result.contiguousLength = hotspot.length;
    if (hotspot.length >= 5) {
      result.rules.contiguousHotspot = true;
    }

    // Rule 2: Percentage of length
    const aggResidueCount = aggCurve.filter((v) => v >= config.aggThreshold).length;
    result.aggResidueCount = aggResidueCount;
    const aggResiduePercent = seqLength > 0 ? (aggResidueCount / seqLength) * 100 : 0;
    result.aggResiduePercent = aggResiduePercent;
    if (aggResiduePercent > config.percentOfLengthCutoff) {
      result.rules.percentOfLength = true;
    }
  }

  // Rule 3: SSW deletion (too few SSW residues)
  const sswResidues = countSswResidues(peptide);
  if (sswResidues > 0 && sswResidues < config.minSswResidues) {
    result.rules.sswDeletion = true;
  }

  // Flag if ANY rule triggers
  result.flagged =
    result.rules.contiguousHotspot || result.rules.percentOfLength || result.rules.sswDeletion;

  return result;
}

/**
 * Count how many peptides are flagged by smart aggregation rules.
 */
export function countAggFlagged(
  peptides: Peptide[],
  config: AggFlagConfig = DEFAULT_AGG_CONFIG
): number {
  return peptides.filter((p) => computeAggFlag(p, config).flagged).length;
}
