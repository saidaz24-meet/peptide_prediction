/**
 * Percentile-based peptide ranking engine v2.
 *
 * 5 default metrics + 2 optional add-ons. Proportional weights sum to 100%.
 * Direction toggles allow inverting "high is good" vs "low is good".
 *
 * Default metrics:  tangoAggMax, s4predHelixPercent, ffHelixPercent, muH, sswScore
 * Optional add-ons: hydrophobicity, absCharge
 */
import type { Peptide } from "@/types/peptide";

// ---- Types ----

export type RankingMetric =
  | "tangoAggMax"
  | "s4predHelixPercent"
  | "ffHelixPercent"
  | "muH"
  | "sswScore"
  | "hydrophobicity"
  | "absCharge";

export type MetricDirection = "high" | "low";

export type MetricDirections = Partial<Record<RankingMetric, MetricDirection>>;

export type ProportionalWeights = Partial<Record<RankingMetric, number>>;

export type PeptideRanking = {
  peptideId: string;
  compositeScore: number; // 0-100
  metricPercentiles: Record<RankingMetric, number | null>;
};

export interface RankingOptions {
  tangoAvailable?: boolean;
  directions?: MetricDirections;
}

export type RankingPreset = "equal" | "amyloid" | "switch";

// ---- Constants ----

export const DEFAULT_METRICS: RankingMetric[] = [
  "tangoAggMax",
  "s4predHelixPercent",
  "ffHelixPercent",
  "muH",
  "sswScore",
];

export const OPTIONAL_METRICS: RankingMetric[] = ["hydrophobicity", "absCharge"];

export const ALL_METRICS: RankingMetric[] = [...DEFAULT_METRICS, ...OPTIONAL_METRICS];

export const METRIC_LABELS: Record<RankingMetric, string> = {
  tangoAggMax: "TANGO Agg Max",
  s4predHelixPercent: "S4PRED Helix %",
  ffHelixPercent: "FF-Helix %",
  muH: "μH",
  sswScore: "SSW Score",
  hydrophobicity: "Hydrophobicity",
  absCharge: "|Charge|",
};

export const METRIC_COLORS: Record<RankingMetric, string> = {
  tangoAggMax: "bg-red-500",
  s4predHelixPercent: "bg-violet-500",
  ffHelixPercent: "bg-purple-500",
  muH: "bg-blue-500",
  sswScore: "bg-amber-500",
  hydrophobicity: "bg-cyan-500",
  absCharge: "bg-emerald-500",
};

export const METRIC_COLORS_HEX: Record<RankingMetric, string> = {
  tangoAggMax: "#ef4444",
  s4predHelixPercent: "#8b5cf6",
  ffHelixPercent: "#a855f7",
  muH: "#3b82f6",
  sswScore: "#f59e0b",
  hydrophobicity: "#06b6d4",
  absCharge: "#10b981",
};

/** Default directions: high = good for all metrics. */
export const DEFAULT_DIRECTIONS: MetricDirections = {
  tangoAggMax: "high",
  s4predHelixPercent: "high",
  ffHelixPercent: "high",
  muH: "high",
  sswScore: "high",
  hydrophobicity: "high",
  absCharge: "high",
};

/** Equal weights across 5 default metrics (20% each). */
function equalWeights(): ProportionalWeights {
  return {
    tangoAggMax: 20,
    s4predHelixPercent: 20,
    ffHelixPercent: 20,
    muH: 20,
    sswScore: 20,
  };
}

export const PRESETS: Record<
  RankingPreset,
  { weights: ProportionalWeights; directions: MetricDirections }
> = {
  equal: {
    weights: equalWeights(),
    directions: { ...DEFAULT_DIRECTIONS },
  },
  amyloid: {
    weights: {
      tangoAggMax: 35,
      sswScore: 25,
      ffHelixPercent: 15,
      muH: 15,
      s4predHelixPercent: 10,
    },
    directions: {
      ...DEFAULT_DIRECTIONS,
      s4predHelixPercent: "low", // low helix = more disordered = more amyloid-prone
    },
  },
  switch: {
    weights: {
      s4predHelixPercent: 30,
      tangoAggMax: 25,
      sswScore: 20,
      ffHelixPercent: 15,
      muH: 10,
    },
    directions: {
      ...DEFAULT_DIRECTIONS,
      s4predHelixPercent: "high", // high helix content → helix-to-beta switch
    },
  },
};

// Metrics that require TANGO
const TANGO_GATED: RankingMetric[] = ["sswScore", "tangoAggMax"];

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
    case "s4predHelixPercent":
      return p.s4predHelixPercent ?? null;
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
 * Redistribute weights proportionally when some metrics are removed.
 * Returns a new weights record that sums to 100.
 */
export function redistributeWeights(
  weights: ProportionalWeights,
  activeMetrics: RankingMetric[]
): ProportionalWeights {
  const activeWeights: ProportionalWeights = {};
  let sum = 0;
  for (const m of activeMetrics) {
    const w = weights[m] ?? 0;
    activeWeights[m] = w;
    sum += w;
  }
  if (sum === 0) {
    // Fallback: equal distribution
    const each = 100 / activeMetrics.length;
    for (const m of activeMetrics) activeWeights[m] = each;
    return activeWeights;
  }
  // Scale to sum to 100
  const scale = 100 / sum;
  for (const m of activeMetrics) {
    activeWeights[m] = (activeWeights[m] ?? 0) * scale;
  }
  return activeWeights;
}

/**
 * Rank all peptides using percentile normalization and proportional weighted scoring.
 *
 * @param peptides - Array of peptides to rank
 * @param weights - Per-metric weights (values sum to 100)
 * @param options - tangoAvailable gates SSW/TANGO metrics, directions invert percentiles
 */
export function rankPeptides(
  peptides: Peptide[],
  weights: ProportionalWeights,
  options?: RankingOptions
): PeptideRanking[] {
  const tangoAvailable = options?.tangoAvailable ?? true;
  const directions = options?.directions ?? DEFAULT_DIRECTIONS;

  // Determine which metrics are active (from weights keys, minus TANGO-gated when unavailable)
  const requestedMetrics = ALL_METRICS.filter((m) => (weights[m] ?? 0) > 0);
  const activeMetrics = requestedMetrics.filter((m) => tangoAvailable || !TANGO_GATED.includes(m));

  // Redistribute weights excluding gated metrics
  const effectiveWeights = redistributeWeights(weights, activeMetrics);

  // Collect all valid values per metric (for percentile computation)
  const metricValues: Partial<Record<RankingMetric, number[]>> = {};
  for (const m of activeMetrics) {
    metricValues[m] = peptides
      .map((p) => extractMetric(p, m))
      .filter((v): v is number => v != null && Number.isFinite(v));
  }

  // Compute per-peptide rankings
  return peptides.map((p) => {
    const metricPercentiles: Record<RankingMetric, number | null> = {} as any;

    for (const m of ALL_METRICS) {
      if (!activeMetrics.includes(m)) {
        metricPercentiles[m] = null;
        continue;
      }
      const value = extractMetric(p, m);
      if (value == null || !Number.isFinite(value)) {
        metricPercentiles[m] = null;
      } else {
        let pct = computePercentileRank(value, metricValues[m]!);
        // Invert percentile when direction is "low" (lower raw value = higher score)
        if (directions[m] === "low") {
          pct = 100 - pct;
        }
        metricPercentiles[m] = pct;
      }
    }

    // Composite score: weighted average of adjusted percentiles / 100
    let weightedSum = 0;
    let weightSum = 0;
    for (const m of activeMetrics) {
      const pct = metricPercentiles[m];
      const w = effectiveWeights[m] ?? 0;
      if (pct != null) {
        weightedSum += w * pct;
        weightSum += w;
      }
    }
    const compositeScore = weightSum > 0 ? weightedSum / weightSum : 50;

    return {
      peptideId: p.id,
      compositeScore,
      metricPercentiles,
    };
  });
}
