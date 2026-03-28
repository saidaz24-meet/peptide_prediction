import { describe, it, expect } from "vitest";
import {
  computePercentileRank,
  rankPeptides,
  redistributeWeights,
  PRESETS,
  DEFAULT_METRICS,
  OPTIONAL_METRICS,
  ALL_METRICS,
  type ProportionalWeights,
  type RankingMetric,
} from "../ranking";
import type { Peptide } from "@/types/peptide";

// Minimal peptide factory for tests
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: "AAAA",
    length: 4,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  };
}

// ---- computePercentileRank ----

describe("computePercentileRank", () => {
  it("ranks distinct values correctly", () => {
    const vals = [10, 20, 30, 40, 50];
    expect(computePercentileRank(10, vals)).toBe(20); // 1/5 * 100
    expect(computePercentileRank(30, vals)).toBe(60); // 3/5 * 100
    expect(computePercentileRank(50, vals)).toBe(100); // 5/5 * 100
  });

  it("handles ties (all same value)", () => {
    const vals = [5, 5, 5, 5];
    expect(computePercentileRank(5, vals)).toBe(100);
  });

  it("returns 50 for single element", () => {
    expect(computePercentileRank(42, [42])).toBe(50);
  });

  it("returns 50 for empty array", () => {
    expect(computePercentileRank(42, [])).toBe(50);
  });

  it("handles mixed values with ties", () => {
    const vals = [1, 2, 2, 3, 4];
    expect(computePercentileRank(2, vals)).toBe(60);
  });
});

// ---- rankPeptides ----

describe("rankPeptides", () => {
  const equalWeights: ProportionalWeights = { ...PRESETS.equal.weights };

  const cohort: Peptide[] = [
    makePeptide({
      id: "A",
      hydrophobicity: 0.2,
      charge: 1.0,
      muH: 0.3,
      ffHelixPercent: 30,
      s4predHelixPercent: 20,
      sswScore: 5,
      tangoAggMax: 10,
    }),
    makePeptide({
      id: "B",
      hydrophobicity: 0.5,
      charge: 2.0,
      muH: 0.6,
      ffHelixPercent: 60,
      s4predHelixPercent: 50,
      sswScore: 15,
      tangoAggMax: 40,
    }),
    makePeptide({
      id: "C",
      hydrophobicity: 0.8,
      charge: 3.0,
      muH: 0.9,
      ffHelixPercent: 90,
      s4predHelixPercent: 80,
      sswScore: 25,
      tangoAggMax: 70,
    }),
  ];

  it("produces rankings for all peptides", () => {
    const rankings = rankPeptides(cohort, equalWeights);
    expect(rankings).toHaveLength(3);
    expect(rankings.map((r) => r.peptideId)).toEqual(["A", "B", "C"]);
  });

  it("composite scores are in 0-100 range", () => {
    const rankings = rankPeptides(cohort, equalWeights);
    for (const r of rankings) {
      expect(r.compositeScore).toBeGreaterThanOrEqual(0);
      expect(r.compositeScore).toBeLessThanOrEqual(100);
    }
  });

  it("highest-value peptide has highest composite score with equal weights", () => {
    const rankings = rankPeptides(cohort, equalWeights);
    const scores = rankings.map((r) => r.compositeScore);
    expect(scores[2]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  it("handles null metric gracefully (excluded from average)", () => {
    const withNull: Peptide[] = [
      makePeptide({ id: "X", muH: undefined, tangoAggMax: 10, sswScore: 5 }),
      makePeptide({ id: "Y", muH: 0.9, tangoAggMax: 20, sswScore: 15 }),
    ];
    const rankings = rankPeptides(withNull, equalWeights);
    expect(rankings[0].metricPercentiles.muH).toBeNull();
    expect(rankings[1].metricPercentiles.muH).not.toBeNull();
    expect(rankings[0].compositeScore).toBeGreaterThanOrEqual(0);
  });

  it("TANGO-off gating excludes sswScore and tangoAggMax", () => {
    const withTango: Peptide[] = [
      makePeptide({
        id: "A",
        muH: 0.3,
        ffHelixPercent: 30,
        s4predHelixPercent: 20,
        sswScore: 10,
        tangoAggMax: 50,
      }),
      makePeptide({
        id: "B",
        muH: 0.6,
        ffHelixPercent: 60,
        s4predHelixPercent: 50,
        sswScore: 20,
        tangoAggMax: 80,
      }),
    ];
    const rankings = rankPeptides(withTango, equalWeights, { tangoAvailable: false });
    for (const r of rankings) {
      expect(r.metricPercentiles.sswScore).toBeNull();
      expect(r.metricPercentiles.tangoAggMax).toBeNull();
    }
  });

  it("TANGO-off redistributes weights to remaining metrics", () => {
    const withTango: Peptide[] = [
      makePeptide({
        id: "A",
        muH: 0.3,
        ffHelixPercent: 30,
        s4predHelixPercent: 80,
        sswScore: 10,
        tangoAggMax: 50,
      }),
      makePeptide({
        id: "B",
        muH: 0.6,
        ffHelixPercent: 60,
        s4predHelixPercent: 20,
        sswScore: 20,
        tangoAggMax: 80,
      }),
    ];
    // With TANGO off, only 3 metrics remain — composite should still be valid
    const rankings = rankPeptides(withTango, equalWeights, { tangoAvailable: false });
    expect(rankings[0].compositeScore).toBeGreaterThanOrEqual(0);
    expect(rankings[0].compositeScore).toBeLessThanOrEqual(100);
  });

  it("single peptide gets compositeScore of 50", () => {
    const single = [
      makePeptide({
        id: "SOLO",
        muH: 0.5,
        ffHelixPercent: 50,
        s4predHelixPercent: 50,
        sswScore: 10,
        tangoAggMax: 30,
      }),
    ];
    const rankings = rankPeptides(single, equalWeights);
    expect(rankings[0].compositeScore).toBe(50);
  });

  it("direction inversion: low s4pred = high percentile for low-helix peptides", () => {
    const peps: Peptide[] = [
      makePeptide({
        id: "LowHelix",
        s4predHelixPercent: 10,
        muH: 0.5,
        ffHelixPercent: 50,
        sswScore: 10,
        tangoAggMax: 30,
      }),
      makePeptide({
        id: "HighHelix",
        s4predHelixPercent: 90,
        muH: 0.5,
        ffHelixPercent: 50,
        sswScore: 10,
        tangoAggMax: 30,
      }),
    ];

    // With direction high: HighHelix should rank higher for s4pred
    const highDir = rankPeptides(peps, equalWeights, {
      directions: { s4predHelixPercent: "high" },
    });
    const highHelixHighDir = highDir.find((r) => r.peptideId === "HighHelix")!;
    const lowHelixHighDir = highDir.find((r) => r.peptideId === "LowHelix")!;
    expect(highHelixHighDir.metricPercentiles.s4predHelixPercent).toBeGreaterThan(
      lowHelixHighDir.metricPercentiles.s4predHelixPercent!
    );

    // With direction low: LowHelix should have higher adjusted percentile
    const lowDir = rankPeptides(peps, equalWeights, {
      directions: { s4predHelixPercent: "low" },
    });
    const highHelixLowDir = lowDir.find((r) => r.peptideId === "HighHelix")!;
    const lowHelixLowDir = lowDir.find((r) => r.peptideId === "LowHelix")!;
    expect(lowHelixLowDir.metricPercentiles.s4predHelixPercent).toBeGreaterThan(
      highHelixLowDir.metricPercentiles.s4predHelixPercent!
    );
  });

  it("proportional weights sum to 100 in composite formula", () => {
    // Use weights that sum to 100
    const w: ProportionalWeights = {
      tangoAggMax: 35,
      sswScore: 25,
      ffHelixPercent: 15,
      muH: 15,
      s4predHelixPercent: 10,
    };
    const rankings = rankPeptides(cohort, w);
    // All composite scores should be valid
    for (const r of rankings) {
      expect(r.compositeScore).toBeGreaterThanOrEqual(0);
      expect(r.compositeScore).toBeLessThanOrEqual(100);
    }
  });

  it("optional metric toggle: 5 vs 7 metrics", () => {
    const w5: ProportionalWeights = { ...PRESETS.equal.weights };
    const w7: ProportionalWeights = {
      ...PRESETS.equal.weights,
      hydrophobicity: 14,
      absCharge: 14,
      tangoAggMax: 14,
      s4predHelixPercent: 14,
      ffHelixPercent: 14,
      muH: 15,
      sswScore: 15,
    };

    const r5 = rankPeptides(cohort, w5);
    const r7 = rankPeptides(cohort, w7);

    // With 7 metrics, hydrophobicity and absCharge percentiles should be set
    expect(r7[0].metricPercentiles.hydrophobicity).not.toBeNull();
    expect(r7[0].metricPercentiles.absCharge).not.toBeNull();
    // With 5 metrics, optional metrics should be null
    expect(r5[0].metricPercentiles.hydrophobicity).toBeNull();
    expect(r5[0].metricPercentiles.absCharge).toBeNull();
  });
});

// ---- redistributeWeights ----

describe("redistributeWeights", () => {
  it("scales weights to sum to 100", () => {
    const w: ProportionalWeights = { tangoAggMax: 20, sswScore: 20, muH: 20 };
    const result = redistributeWeights(w, ["tangoAggMax", "sswScore", "muH"]);
    const sum = Object.values(result).reduce((s, v) => s + (v ?? 0), 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
  });

  it("handles removal of a metric by redistributing", () => {
    const w: ProportionalWeights = {
      tangoAggMax: 25,
      sswScore: 25,
      muH: 25,
      ffHelixPercent: 25,
    };
    // Remove ffHelixPercent
    const result = redistributeWeights(w, ["tangoAggMax", "sswScore", "muH"]);
    // Each should be ~33.33
    expect(result.tangoAggMax).toBeCloseTo(33.33, 1);
    expect(result.sswScore).toBeCloseTo(33.33, 1);
    expect(result.muH).toBeCloseTo(33.33, 1);
  });

  it("handles all-zero weights with equal fallback", () => {
    const w: ProportionalWeights = {};
    const result = redistributeWeights(w, ["tangoAggMax", "sswScore"]);
    expect(result.tangoAggMax).toBe(50);
    expect(result.sswScore).toBe(50);
  });
});

// ---- Presets v2 ----

describe("presets v2", () => {
  it("equal preset weights sum to 100", () => {
    const w = PRESETS.equal.weights;
    const sum = Object.values(w).reduce((s, v) => s + (v ?? 0), 0);
    expect(sum).toBe(100);
  });

  it("amyloid preset emphasizes TANGO (35%)", () => {
    const w = PRESETS.amyloid.weights;
    expect(w.tangoAggMax).toBe(35);
    expect((w.tangoAggMax ?? 0) > (w.s4predHelixPercent ?? 0)).toBe(true);
  });

  it("amyloid preset sets s4pred direction to low", () => {
    expect(PRESETS.amyloid.directions.s4predHelixPercent).toBe("low");
  });

  it("switch preset emphasizes S4PRED (30%)", () => {
    const w = PRESETS.switch.weights;
    expect(w.s4predHelixPercent).toBe(30);
    expect((w.s4predHelixPercent ?? 0) > (w.tangoAggMax ?? 0)).toBe(true);
  });

  it("switch preset sets s4pred direction to high", () => {
    expect(PRESETS.switch.directions.s4predHelixPercent).toBe("high");
  });

  it("all presets have weights summing to 100", () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const sum = Object.values(preset.weights).reduce((s, v) => s + (v ?? 0), 0);
      expect(sum).toBe(100);
    }
  });

  it("DEFAULT_METRICS has 5 entries, OPTIONAL_METRICS has 2", () => {
    expect(DEFAULT_METRICS).toHaveLength(5);
    expect(OPTIONAL_METRICS).toHaveLength(2);
    expect(ALL_METRICS).toHaveLength(7);
  });
});
