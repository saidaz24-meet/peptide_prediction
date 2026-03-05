/**
 * Percentile-based peptide ranking engine.
 *
 * Replaces the z-score approach with a 0-100 percentile scale that is
 * easier for researchers to interpret ("this peptide ranks in the 85th
 * percentile for hydrophobicity").
 *
 * 6 continuous metrics (no binary FF flags):
 *   Physicochemical: hydrophobicity, |charge|, μH
 *   Structural:      FF-Helix %
 *   Aggregation:     SSW score, TANGO Agg Max
 */
import type { Peptide } from "@/types/peptide";

// ---- Types ----

export type RankingMetric =
  | "hydrophobicity"
  | "absCharge"
  | "muH"
  | "ffHelixPercent"
  | "sswScore"
  | "tangoAggMax";

export type RankingCategory = "physicochemical" | "structural" | "aggregation";

export type RankingWeights = Record<RankingMetric, number>;

export type PeptideRanking = {
  peptideId: string;
  compositeScore: number; // 0-100
  categoryScores: Record<RankingCategory, number | null>;
  metricPercentiles: Record<RankingMetric, number | null>;
};

export interface RankingOptions {
  tangoAvailable?: boolean;
}

// ---- Constants ----

export const METRIC_CATEGORIES: Record<RankingMetric, RankingCategory> = {
  hydrophobicity: "physicochemical",
  absCharge: "physicochemical",
  muH: "physicochemical",
  ffHelixPercent: "structural",
  sswScore: "aggregation",
  tangoAggMax: "aggregation",
};

export const METRIC_LABELS: Record<RankingMetric, string> = {
  hydrophobicity: "Hydrophobicity",
  absCharge: "|Charge|",
  muH: "μH",
  ffHelixPercent: "FF-Helix %",
  sswScore: "SSW Score",
  tangoAggMax: "TANGO Agg Max",
};

export const CATEGORY_LABELS: Record<RankingCategory, string> = {
  physicochemical: "Physicochemical",
  structural: "Structural",
  aggregation: "Agg & Switch",
};

export const DEFAULT_WEIGHTS: RankingWeights = {
  hydrophobicity: 1,
  absCharge: 1,
  muH: 1,
  ffHelixPercent: 1,
  sswScore: 1,
  tangoAggMax: 1,
};

export const PRESETS = {
  equal: { ...DEFAULT_WEIGHTS } as RankingWeights,
  physicochemical: {
    hydrophobicity: 1,
    absCharge: 1,
    muH: 1,
    ffHelixPercent: 0.25,
    sswScore: 0.25,
    tangoAggMax: 0.25,
  } as RankingWeights,
  aggregation: {
    hydrophobicity: 0.25,
    absCharge: 0.25,
    muH: 0.25,
    ffHelixPercent: 0.25,
    sswScore: 1,
    tangoAggMax: 1,
  } as RankingWeights,
};

export type RankingPreset = keyof typeof PRESETS;

// ---- Core Functions ----

/** Extract a numeric metric value from a peptide, returning null if unavailable. */
function extractMetric(p: Peptide, metric: RankingMetric): number | null {
  switch (metric) {
    case "hydrophobicity":
      return p.hydrophobicity;
    case "absCharge":
      return p.charge != null ? Math.abs(p.charge) : null;
    case "muH":
      return p.muH ?? null;
    case "ffHelixPercent":
      return p.ffHelixPercent ?? null;
    case "sswScore":
      return p.sswScore ?? null;
    case "tangoAggMax":
      return p.tangoAggMax ?? null;
  }
}

/**
 * Compute the percentile rank of `value` within `allValues`.
 *
 * percentileRank = (count of values ≤ value) / totalCount × 100
 *
 * Edge cases:
 * - Single element → 50
 * - All same values → 50 for all
 */
export function computePercentileRank(value: number, allValues: number[]): number {
  const n = allValues.length;
  if (n <= 1) return 50;

  const countBelow = allValues.filter((v) => v <= value).length;
  return (countBelow / n) * 100;
}

/**
 * Rank all peptides using percentile normalization and weighted composite scoring.
 *
 * @param peptides - Array of peptides to rank
 * @param weights - Per-metric weights (0-1 range, default 1)
 * @param options - tangoAvailable gates SSW/TANGO metrics
 */
export function rankPeptides(
  peptides: Peptide[],
  weights: RankingWeights,
  options?: RankingOptions
): PeptideRanking[] {
  const tangoAvailable = options?.tangoAvailable ?? true;
  const allMetrics: RankingMetric[] = [
    "hydrophobicity",
    "absCharge",
    "muH",
    "ffHelixPercent",
    "sswScore",
    "tangoAggMax",
  ];

  // Determine which metrics are active (TANGO gating)
  const tangoGated: RankingMetric[] = ["sswScore", "tangoAggMax"];
  const activeMetrics = allMetrics.filter((m) => tangoAvailable || !tangoGated.includes(m));

  // Collect all valid values per metric (for percentile computation)
  const metricValues: Record<RankingMetric, number[]> = {} as any;
  for (const m of activeMetrics) {
    metricValues[m] = peptides
      .map((p) => extractMetric(p, m))
      .filter((v): v is number => v != null && Number.isFinite(v));
  }

  // Compute per-peptide rankings
  return peptides.map((p) => {
    const metricPercentiles: Record<RankingMetric, number | null> = {} as any;

    for (const m of allMetrics) {
      if (!activeMetrics.includes(m)) {
        metricPercentiles[m] = null;
        continue;
      }
      const value = extractMetric(p, m);
      if (value == null || !Number.isFinite(value)) {
        metricPercentiles[m] = null;
      } else {
        metricPercentiles[m] = computePercentileRank(value, metricValues[m]);
      }
    }

    // Category scores: average of constituent metric percentiles
    const categoryScores: Record<RankingCategory, number | null> = {
      physicochemical: null,
      structural: null,
      aggregation: null,
    };
    for (const cat of ["physicochemical", "structural", "aggregation"] as RankingCategory[]) {
      const catMetrics = activeMetrics.filter((m) => METRIC_CATEGORIES[m] === cat);
      const catPercentiles = catMetrics
        .map((m) => metricPercentiles[m])
        .filter((v): v is number => v != null);
      if (catPercentiles.length > 0) {
        categoryScores[cat] = catPercentiles.reduce((a, b) => a + b, 0) / catPercentiles.length;
      }
    }

    // Composite score: weighted average of percentile ranks
    let weightedSum = 0;
    let weightSum = 0;
    for (const m of activeMetrics) {
      const pct = metricPercentiles[m];
      if (pct != null) {
        weightedSum += weights[m] * pct;
        weightSum += weights[m];
      }
    }
    const compositeScore = weightSum > 0 ? weightedSum / weightSum : 50;

    return {
      peptideId: p.id,
      compositeScore,
      categoryScores,
      metricPercentiles,
    };
  });
}
