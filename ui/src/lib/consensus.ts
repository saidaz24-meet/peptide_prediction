/**
 * Consensus secondary structure reconciliation logic.
 *
 * TypeScript port of backend/consensus.py — combines TANGO (aggregation)
 * and S4PRED (secondary structure) predictions into a tiered evidence
 * framework. Based on AMYLPRED2 consensus approach (Hamodrakas 2007).
 *
 * Operates on existing Peptide type fields — no API schema change needed.
 */

import type { Peptide } from "@/types/peptide";

export type ConsensusTier = 1 | 2 | 3 | 4 | 5;

export type ConsensusResult = {
  tier: ConsensusTier;
  label: string;
  certainty: number; // 0-1
  explanation: string;
  color: string; // tailwind border-color class
};

/** Tier metadata lookup. */
const TIER_META: Record<
  ConsensusTier,
  { label: string; color: string; baseCertainty: number }
> = {
  1: { label: "High-Confidence Switch Zone", color: "border-red-500", baseCertainty: 0.9 },
  2: { label: "Disordered Aggregation-Prone", color: "border-amber-500", baseCertainty: 0.7 },
  3: { label: "Native Beta / Low Switch Propensity", color: "border-blue-500", baseCertainty: 0.5 },
  4: { label: "Low Aggregation Propensity", color: "border-green-500", baseCertainty: 0.8 },
  5: { label: "Insufficient Data", color: "border-muted", baseCertainty: 0.0 },
};

/**
 * Find majority SS call ('H', 'E', 'C') in a region of per-residue predictions.
 */
export function dominantSsAtRegion(
  ssPrediction: string[] | undefined | null,
  start: number,
  end: number,
): string {
  if (!ssPrediction || ssPrediction.length === 0) return "C";

  const s = Math.max(0, start);
  const e = Math.min(ssPrediction.length, end);
  const region = ssPrediction.slice(s, e);
  if (region.length === 0) return "C";

  const counts: Record<string, number> = {};
  for (const ss of region) {
    counts[ss] = (counts[ss] ?? 0) + 1;
  }

  // Sort by count desc, then alphabetical for tie-breaking
  return Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a] || a.localeCompare(b),
  )[0];
}

/**
 * Find the hotspot region (contiguous residues with agg > threshold).
 * Returns [start, end) indices of the peak hotspot region.
 */
function findHotspotRegion(
  aggCurve: number[] | undefined,
  threshold: number,
): [number, number] | null {
  if (!aggCurve || aggCurve.length === 0) return null;

  let bestStart = -1;
  let bestEnd = -1;
  let bestSum = 0;

  let curStart = -1;
  let curSum = 0;

  for (let i = 0; i < aggCurve.length; i++) {
    if (aggCurve[i] > threshold) {
      if (curStart === -1) curStart = i;
      curSum += aggCurve[i];
    } else {
      if (curStart !== -1 && curSum > bestSum) {
        bestStart = curStart;
        bestEnd = i;
        bestSum = curSum;
      }
      curStart = -1;
      curSum = 0;
    }
  }
  // Handle case where hotspot extends to end
  if (curStart !== -1 && curSum > bestSum) {
    bestStart = curStart;
    bestEnd = aggCurve.length;
  }

  return bestStart >= 0 ? [bestStart, bestEnd] : null;
}

/**
 * Compute consensus tier from a Peptide's TANGO + S4PRED data.
 */
export function getConsensusSS(
  peptide: Peptide,
  aggThreshold: number = 5.0,
): ConsensusResult {
  const tangoAggMax = peptide.tangoAggMax;

  // ── Tier 5: No TANGO data ──
  if (tangoAggMax == null) {
    return {
      tier: 5,
      label: TIER_META[5].label,
      certainty: 0.0,
      color: TIER_META[5].color,
      explanation:
        "TANGO aggregation data is unavailable. Enable TANGO + S4PRED for consensus analysis.",
    };
  }

  // ── Tier 4: Low aggregation ──
  if (tangoAggMax <= aggThreshold) {
    let certainty = TIER_META[4].baseCertainty;
    certainty = applySswModifier(certainty, peptide.sswPrediction, peptide.s4predSswPrediction);
    certainty = applyLengthCap(certainty, peptide.length);
    return {
      ...TIER_META[4],
      tier: 4,
      certainty,
      explanation: `TANGO peak aggregation (${tangoAggMax.toFixed(1)}%) is at or below the ${aggThreshold.toFixed(1)}% threshold. No significant aggregation hotspot detected.`,
    };
  }

  // ── Tiers 1-3: High aggregation, differentiated by SS at hotspot ──
  // Find SS at the hotspot region
  const hotspot = findHotspotRegion(peptide.tango?.agg, aggThreshold);
  const ssPred = peptide.s4pred?.ssPrediction;

  let ss: string;
  if (hotspot && ssPred) {
    ss = dominantSsAtRegion(ssPred, hotspot[0], hotspot[1]);
  } else {
    ss = "C"; // no S4PRED data → treat as disordered
  }

  let tier: ConsensusTier;
  let explanation: string;

  if (ss === "H") {
    tier = 1;
    explanation = `TANGO detects an aggregation hotspot (peak ${tangoAggMax.toFixed(1)}%) where S4PRED predicts helical structure. This helix-to-beta conformational switch zone is a hallmark of amyloid-forming regions (Hamodrakas 2007).`;
  } else if (ss === "E") {
    tier = 3;
    explanation = `TANGO detects an aggregation hotspot (peak ${tangoAggMax.toFixed(1)}%) where S4PRED predicts beta-strand structure. The region is already in a beta conformation, so conformational switching is less likely.`;
  } else {
    tier = 2;
    explanation = `TANGO detects an aggregation hotspot (peak ${tangoAggMax.toFixed(1)}%) in a disordered (coil) region. The lack of stable secondary structure may facilitate aggregation through disorder-to-order transitions.`;
  }

  let certainty = TIER_META[tier].baseCertainty;
  certainty = applySswModifier(certainty, peptide.sswPrediction, peptide.s4predSswPrediction);
  certainty = applyLengthCap(certainty, peptide.length);

  return {
    tier,
    label: TIER_META[tier].label,
    certainty,
    explanation,
    color: TIER_META[tier].color,
  };
}

function applySswModifier(
  certainty: number,
  sswPrediction: number | null | undefined,
  s4predSswPrediction: number | null | undefined,
): number {
  if (sswPrediction != null && s4predSswPrediction != null) {
    if (sswPrediction === s4predSswPrediction) {
      certainty += 0.1;
    } else {
      certainty -= 0.1;
    }
  }
  return Math.max(0.0, Math.min(1.0, certainty));
}

function applyLengthCap(certainty: number, length: number | null | undefined): number {
  if (length != null && length < 20) {
    certainty = Math.min(certainty, 0.5);
  }
  return certainty;
}
