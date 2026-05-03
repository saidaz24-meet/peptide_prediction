/**
 * Central metric registry for PVL.
 *
 * Design philosophy: every metric in PVL — biophysical, structural, or
 * classification — is described once in this registry.  Components that
 * display metric values (KPI cards, hover cards, correlation matrices,
 * sparklines) resolve their rendering metadata here rather than duplicating
 * labels, units, formatters, and scientific definitions in each component.
 *
 * Definitions follow Peleg's axioms:
 *   - Hydrophobicity uses Fauchere-Pliska (NOT helix propensity).
 *   - S4PRED is the primary helix predictor; Chou-Fasman is legacy.
 *   - FF-Helix% is always computed locally (no external dependency).
 */

import type { Peptide, DatasetStats } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Registry entry shape
// ---------------------------------------------------------------------------

export interface MetricRegistryEntry {
  id: string;
  /** Full display name */
  name: string;
  /** Short label for tight spaces (matrix headers, sparklines) */
  shortName?: string;
  /** Scientific definition — 1-2 sentences, Peleg-verbatim where applicable */
  definition: string;
  /** Unit string (e.g., "%", "pH 7.4", "μH") */
  unit?: string;
  /** Extract this metric's value from a Peptide */
  getValue: (p: Peptide) => number | null | undefined;
  /** Extract the database mean from DatasetStats */
  getMean?: (stats: DatasetStats) => number | null | undefined;
  /** Format a value for display */
  format: (value: number) => string;
  /** Interpretation guide (e.g., "Higher values mean stronger membrane interaction") */
  interpretation?: string;
  /** Related metric IDs */
  relatedMetrics?: string[];
  /** CSS color token (e.g., "hsl(var(--ff-helix))") */
  color?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const METRIC_REGISTRY: Record<string, MetricRegistryEntry> = {
  hydrophobicity: {
    id: "hydrophobicity",
    name: "Hydrophobicity",
    shortName: "H",
    definition:
      "Average residue hydrophobicity computed with the Fauchere-Pliska scale. " +
      "Negative values indicate hydrophilic character; positive values indicate hydrophobic character.",
    unit: "F-P",
    getValue: (p) => p.hydrophobicity,
    getMean: (s) => s.meanHydrophobicity,
    format: (v) => v.toFixed(2),
    interpretation:
      "Higher values indicate stronger hydrophobic character and greater membrane interaction potential.",
    relatedMetrics: ["muH", "charge"],
    color: "hsl(var(--hydrophobicity))",
  },

  muH: {
    id: "muH",
    name: "Hydrophobic Moment (μH)",
    shortName: "μH",
    definition:
      "Hydrophobic moment quantifies the amphipathicity of a helix by measuring the " +
      "asymmetry of hydrophobicity perpendicular to the helix axis (Eisenberg, 1982).",
    unit: "μH",
    getValue: (p) => p.muH,
    getMean: (s) => s.meanMuH,
    format: (v) => v.toFixed(3),
    interpretation:
      "Higher values indicate greater amphipathicity, suggesting the peptide can form " +
      "a helix with distinct hydrophobic and hydrophilic faces.",
    relatedMetrics: ["hydrophobicity", "s4predHelixPercent"],
    color: "hsl(var(--mu-h))",
  },

  charge: {
    id: "charge",
    name: "Net Charge (pH 7.4)",
    shortName: "Q",
    definition:
      "Net electrical charge at physiological pH (7.4), computed from ionizable residue " +
      "pKa values. Positively charged residues: K, R, H; negatively charged: D, E.",
    unit: "pH 7.4",
    getValue: (p) => p.charge,
    getMean: (s) => s.meanCharge,
    format: (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
    interpretation:
      "Positive charge promotes interaction with negatively charged membranes. " +
      "Magnitude affects solubility and aggregation behavior.",
    relatedMetrics: ["hydrophobicity"],
    color: "hsl(var(--charge))",
  },

  length: {
    id: "length",
    name: "Sequence Length",
    shortName: "Len",
    definition: "Number of amino acid residues in the peptide sequence.",
    unit: "aa",
    getValue: (p) => p.length,
    getMean: (s) => s.meanLength,
    format: (v) => Math.round(v).toString(),
    interpretation:
      "Peptide length influences secondary structure stability, aggregation kinetics, " +
      "and membrane insertion potential.",
    color: "hsl(var(--length))",
  },

  s4predHelixPercent: {
    id: "s4predHelixPercent",
    name: "S4PRED Helix Content",
    shortName: "Helix%",
    definition:
      "Percentage of residues predicted to adopt alpha-helical conformation by S4PRED, " +
      "a deep-learning secondary structure predictor. This is the primary helix prediction in PVL.",
    unit: "%",
    getValue: (p) => p.s4predHelixPercent,
    getMean: (s) => s.meanS4predHelixPercent,
    format: (v) => `${v.toFixed(1)}%`,
    interpretation:
      "Higher helix content suggests the peptide can form stable alpha-helical structures, " +
      "relevant for membrane interaction and fibril-formation via the helix pathway.",
    relatedMetrics: ["ffHelixPercent", "muH", "ffHelixFlag"],
    color: "hsl(var(--s4pred-helix))",
  },

  ffHelixPercent: {
    id: "ffHelixPercent",
    name: "FF-Helix Propensity",
    shortName: "FF-H%",
    definition:
      "Chou-Fasman helix propensity computed with a 6-residue sliding window (threshold 1.0). " +
      "This is a legacy metric; S4PRED Helix % is the primary helix prediction.",
    unit: "%",
    getValue: (p) => p.ffHelixPercent,
    getMean: (s) => s.meanFFHelixPercent,
    format: (v) => `${v.toFixed(1)}%`,
    interpretation:
      "Higher values indicate greater context-free helix-forming propensity based on " +
      "the Chou-Fasman (1978) amino acid scale.",
    relatedMetrics: ["s4predHelixPercent", "ffHelixFlag"],
    color: "hsl(var(--ff-helix))",
  },

  ffHelixFlag: {
    id: "ffHelixFlag",
    name: "Fibril-Forming Helix Flag",
    shortName: "FF-H",
    definition:
      "Binary classification flag for fibril formation via the alpha-helical pathway. " +
      "Uses S4PRED helix segments combined with hydrophobic moment (μH) above the database threshold.",
    getValue: (p) => p.ffHelixFlag,
    getMean: (s) => s.ffHelixCandidatePercent,
    format: (v) => (v === 1 ? "Candidate" : v === -1 ? "Non-candidate" : String(v)),
    interpretation:
      "A value of 1 (candidate) indicates the peptide is predicted to form fibrils " +
      "through an alpha-helical aggregation mechanism.",
    relatedMetrics: ["s4predHelixPercent", "muH", "ffSswFlag"],
    color: "hsl(var(--ff-helix-flag))",
  },

  sswPrediction: {
    id: "sswPrediction",
    name: "SSW Prediction",
    shortName: "SSW",
    definition:
      "Secondary Structure Switch prediction from TANGO analysis. Indicates whether " +
      "the peptide can switch between alpha-helix and beta-sheet conformations, " +
      "a prerequisite for amyloid fibril formation.",
    getValue: (p) => p.sswPrediction,
    getMean: (s) => s.sswPositivePercent,
    format: (v) => (v === 1 ? "Positive" : v === -1 ? "Negative" : "Uncertain"),
    interpretation:
      "A positive prediction (1) suggests the peptide has the potential for " +
      "membrane interaction and structural switching behavior.",
    relatedMetrics: ["ffSswFlag", "tangoAggregation"],
    color: "hsl(var(--ssw))",
  },

  ffSswFlag: {
    id: "ffSswFlag",
    name: "Fibril-Forming SSW Flag",
    shortName: "FF-SSW",
    definition:
      "Binary classification flag for fibril formation via the secondary structure " +
      "switch pathway. Combines TANGO SSW prediction with hydrophobicity thresholds.",
    getValue: (p) => p.ffSswFlag,
    getMean: (s) => s.ffSswCandidatePercent,
    format: (v) => (v === 1 ? "Candidate" : v === -1 ? "Non-candidate" : String(v)),
    interpretation:
      "A value of 1 (candidate) indicates the peptide is predicted to form fibrils " +
      "through a secondary structure switching mechanism.",
    relatedMetrics: ["sswPrediction", "hydrophobicity", "ffHelixFlag"],
    color: "hsl(var(--ff-ssw-flag))",
  },

  tangoAggregation: {
    id: "tangoAggregation",
    name: "TANGO Aggregation Propensity",
    shortName: "Agg",
    definition:
      "Maximum aggregation propensity score from the TANGO algorithm. " +
      "TANGO predicts beta-aggregation regions using a statistical mechanics model.",
    unit: "score",
    getValue: (p) => p.tangoAggMax,
    getMean: (s) => s.aggHotspotPercent,
    format: (v) => v.toFixed(1),
    interpretation:
      "Higher values indicate stronger aggregation-prone regions. " +
      "Values above 5.0 are typically considered aggregation hotspots.",
    relatedMetrics: ["sswPrediction", "ffSswFlag"],
    color: "hsl(var(--tango-agg))",
  },
};

// ---------------------------------------------------------------------------
// Convenience accessor
// ---------------------------------------------------------------------------

/** Get a registry entry by ID, or undefined if not found */
export function getMetric(id: string): MetricRegistryEntry | undefined {
  return METRIC_REGISTRY[id];
}
