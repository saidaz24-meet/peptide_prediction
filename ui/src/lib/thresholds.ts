/**
 * Threshold application helpers
 * 
 * Centralizes logic for applying thresholds to peptides for consistent
 * filtering and ranking across Results and QuickAnalyze.
 */
import type { Peptide } from '@/types/peptide';

export type ResolvedThresholds = {
  muHCutoff: number;
  hydroCutoff: number;
  ffHelixPercentThreshold: number;
};

/**
 * Default thresholds (fallback if meta.thresholds not available)
 */
export const DEFAULT_THRESHOLDS: ResolvedThresholds = {
  muHCutoff: 0.0,
  hydroCutoff: 0.0,
  ffHelixPercentThreshold: 50.0,
};

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
  const muH = typeof peptide.muH === 'number' ? peptide.muH : 0;
  const H = typeof peptide.hydrophobicity === 'number' ? peptide.hydrophobicity : 0;
  const ssw = peptide.sswPrediction ?? (peptide as any).chameleonPrediction ?? -1;

  // FF-Helix flag: 1 if muH >= muHCutoff, else 0
  const ffHelixView = muH >= thresholds.muHCutoff ? 1 : 0;

  // SSW flag: 1 if ssw === 1 AND H >= hydroCutoff, -1 if ssw === -1, else 0
  const sswView = ssw === 1 && H >= thresholds.hydroCutoff ? 1 : ssw === -1 ? -1 : 0;

  return { ffHelixView, sswView };
}

/**
 * Check if FF-Helix percent meets threshold (for scoring)
 * 
 * @param peptide - Peptide to evaluate
 * @param thresholds - Resolved thresholds from meta.thresholds
 * @returns true if ffHelixPercent >= ffHelixPercentThreshold
 */
export function meetsFFHelixThreshold(
  peptide: Peptide,
  thresholds: ResolvedThresholds
): boolean {
  const ffHelixPercent = peptide.ffHelixPercent;
  if (typeof ffHelixPercent !== 'number' || isNaN(ffHelixPercent)) {
    return false;
  }
  return ffHelixPercent >= thresholds.ffHelixPercentThreshold;
}

