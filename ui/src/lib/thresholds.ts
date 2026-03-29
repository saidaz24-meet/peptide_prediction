/**
 * Threshold application helpers
 *
 * Centralizes logic for applying thresholds to peptides for consistent
 * filtering and ranking across Results and QuickAnalyze.
 */
import type { Peptide } from "@/types/peptide";
import { computeAggFlag, type AggFlagConfig, DEFAULT_AGG_CONFIG } from "@/lib/aggregationFlags";

export type ResolvedThresholds = {
  muHCutoff: number;
  hydroCutoff: number;
  aggThreshold: number;
  percentOfLengthCutoff: number;
  minSswResidues: number;
  sswMaxDifference: number;
  minPredictionPercent: number;
  minS4predHelixScore: number;
  maxTangoDifference: number;
};

/**
 * Default thresholds (fallback if meta.thresholds not available)
 */
export const DEFAULT_THRESHOLDS: ResolvedThresholds = {
  muHCutoff: 0.0,
  hydroCutoff: 0.0,
  aggThreshold: 5.0,
  percentOfLengthCutoff: 20.0,
  minSswResidues: 3,
  sswMaxDifference: 0.0,
  minPredictionPercent: 50.0,
  minS4predHelixScore: 0.0,
  maxTangoDifference: 0.0,
};

/** Extract AggFlagConfig from ResolvedThresholds */
export function toAggConfig(t: ResolvedThresholds): AggFlagConfig {
  return {
    aggThreshold: t.aggThreshold,
    percentOfLengthCutoff: t.percentOfLengthCutoff,
    minSswResidues: t.minSswResidues,
  };
}

/**
 * Apply thresholds to a peptide and return view flags
 *
 * @param peptide - Peptide to evaluate
 * @param thresholds - Resolved thresholds from meta.thresholds
 * @returns Object with ffHelixView and sswView flags (1, 0, or -1)
 */
export function applyThresholds(
  peptide: Peptide,
  thresholds: ResolvedThresholds
): { ffHelixView: number; sswView: number } {
  const muH = typeof peptide.muH === "number" ? peptide.muH : 0;
  const H = typeof peptide.hydrophobicity === "number" ? peptide.hydrophobicity : 0;
  const ssw = peptide.sswPrediction ?? -1;

  // FF-Helix flag: 1 if muH >= muHCutoff, else 0
  const ffHelixView = muH >= thresholds.muHCutoff ? 1 : 0;

  // SSW flag: 1 if ssw === 1 AND H >= hydroCutoff, -1 if ssw === -1, else 0
  const sswView = ssw === 1 && H >= thresholds.hydroCutoff ? 1 : ssw === -1 ? -1 : 0;

  return { ffHelixView, sswView };
}

/**
 * Compute classification summary counts for a set of peptides given thresholds.
 *
 * Used by ThresholdTuner to show impact counts when thresholds change.
 */
export function classificationSummary(
  peptides: Peptide[],
  thresholds: ResolvedThresholds
): {
  ffHelixCandidates: number;
  sswCandidates: number;
  aggFlagged: number;
  total: number;
} {
  let ffHelixCandidates = 0;
  let sswCandidates = 0;
  let aggFlagged = 0;

  const aggConfig = toAggConfig(thresholds);

  for (const p of peptides) {
    const { ffHelixView, sswView } = applyThresholds(p, thresholds);
    if (ffHelixView === 1) ffHelixCandidates++;
    if (sswView === 1) sswCandidates++;
    if (computeAggFlag(p, aggConfig).flagged) aggFlagged++;
  }

  return {
    ffHelixCandidates,
    sswCandidates,
    aggFlagged,
    total: peptides.length,
  };
}
