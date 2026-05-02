/**
 * CorrelationCard — Card wrapper around the generalized CorrelationMatrix.
 *
 * Peleg FIX-023:
 *   3. SSW Score, SSW Diff, and Agg Max are EXCLUDED from the matrix
 *      (Peleg: "these numbers do not have real meaning").
 *   4. FF-Helix label drops the "%" suffix.
 *   1. Upper triangle only (matrix is symmetric).
 *   6. Missing values handled via pairwise-exclude (NOT zero-imputation).
 */

import { CorrelationMatrix, DEFAULT_CORRELATION_METRICS } from "@/components/CorrelationMatrix";
import type { Peptide } from "@/types/peptide";

export function CorrelationCard({ peptides }: { peptides: Peptide[] }) {
  return (
    <CorrelationMatrix
      peptides={peptides}
      metrics={DEFAULT_CORRELATION_METRICS}
      display="upper"
      missingStrategy="pairwise-exclude"
    />
  );
}

export default CorrelationCard;
