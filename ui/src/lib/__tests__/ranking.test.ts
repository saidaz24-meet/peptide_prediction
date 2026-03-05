import { describe, it, expect } from 'vitest';
import {
  computePercentileRank,
  rankPeptides,
  DEFAULT_WEIGHTS,
  PRESETS,
  type RankingWeights,
} from '../ranking';
import type { Peptide } from '@/types/peptide';

// Minimal peptide factory for tests
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: 'AAAA',
    length: 4,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  };
}

// ---- computePercentileRank ----

describe('computePercentileRank', () => {
  it('ranks distinct values correctly', () => {
    const vals = [10, 20, 30, 40, 50];
    expect(computePercentileRank(10, vals)).toBe(20);  // 1/5 * 100
    expect(computePercentileRank(30, vals)).toBe(60);  // 3/5 * 100
    expect(computePercentileRank(50, vals)).toBe(100); // 5/5 * 100
  });

  it('handles ties (all same value)', () => {
    const vals = [5, 5, 5, 5];
    expect(computePercentileRank(5, vals)).toBe(100); // all ≤ 5
  });

  it('returns 50 for single element', () => {
    expect(computePercentileRank(42, [42])).toBe(50);
  });

  it('returns 50 for empty array', () => {
    expect(computePercentileRank(42, [])).toBe(50);
  });

  it('handles mixed values with ties', () => {
    const vals = [1, 2, 2, 3, 4];
    // 2 appears at positions 1,2 → count ≤ 2 is 3 → 3/5 * 100 = 60
    expect(computePercentileRank(2, vals)).toBe(60);
  });
});

// ---- rankPeptides ----

describe('rankPeptides', () => {
  const cohort: Peptide[] = [
    makePeptide({ id: 'A', hydrophobicity: 0.2, charge: 1.0, muH: 0.3, ffHelixPercent: 30 }),
    makePeptide({ id: 'B', hydrophobicity: 0.5, charge: 2.0, muH: 0.6, ffHelixPercent: 60 }),
    makePeptide({ id: 'C', hydrophobicity: 0.8, charge: 3.0, muH: 0.9, ffHelixPercent: 90 }),
  ];

  it('produces rankings for all peptides', () => {
    const rankings = rankPeptides(cohort, DEFAULT_WEIGHTS);
    expect(rankings).toHaveLength(3);
    expect(rankings.map(r => r.peptideId)).toEqual(['A', 'B', 'C']);
  });

  it('composite scores are in 0-100 range', () => {
    const rankings = rankPeptides(cohort, DEFAULT_WEIGHTS);
    for (const r of rankings) {
      expect(r.compositeScore).toBeGreaterThanOrEqual(0);
      expect(r.compositeScore).toBeLessThanOrEqual(100);
    }
  });

  it('highest-value peptide has highest composite score with equal weights', () => {
    const rankings = rankPeptides(cohort, DEFAULT_WEIGHTS);
    const scores = rankings.map(r => r.compositeScore);
    expect(scores[2]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  it('handles null metric gracefully (excluded from average)', () => {
    const withNull: Peptide[] = [
      makePeptide({ id: 'X', hydrophobicity: 0.5, charge: 1.0, muH: undefined }),
      makePeptide({ id: 'Y', hydrophobicity: 0.8, charge: 2.0, muH: 0.9 }),
    ];
    const rankings = rankPeptides(withNull, DEFAULT_WEIGHTS);
    // X should have muH percentile as null
    expect(rankings[0].metricPercentiles.muH).toBeNull();
    // Y should have muH percentile as non-null
    expect(rankings[1].metricPercentiles.muH).not.toBeNull();
    // Composite should still be valid
    expect(rankings[0].compositeScore).toBeGreaterThanOrEqual(0);
  });

  it('TANGO-off gating excludes sswScore and tangoAggMax', () => {
    const withTango: Peptide[] = [
      makePeptide({ id: 'A', hydrophobicity: 0.5, sswScore: 10, tangoAggMax: 50 }),
      makePeptide({ id: 'B', hydrophobicity: 0.8, sswScore: 20, tangoAggMax: 80 }),
    ];
    const rankings = rankPeptides(withTango, DEFAULT_WEIGHTS, { tangoAvailable: false });
    for (const r of rankings) {
      expect(r.metricPercentiles.sswScore).toBeNull();
      expect(r.metricPercentiles.tangoAggMax).toBeNull();
      expect(r.categoryScores.aggregation).toBeNull();
    }
  });

  it('single peptide gets compositeScore of 50', () => {
    const single = [makePeptide({ id: 'SOLO', hydrophobicity: 0.5 })];
    const rankings = rankPeptides(single, DEFAULT_WEIGHTS);
    expect(rankings[0].compositeScore).toBe(50);
  });

  it('category scores group metrics correctly', () => {
    const rankings = rankPeptides(cohort, DEFAULT_WEIGHTS);
    // Peptide C should have highest physicochemical score
    const cRanking = rankings.find(r => r.peptideId === 'C')!;
    expect(cRanking.categoryScores.physicochemical).not.toBeNull();
    expect(cRanking.categoryScores.structural).not.toBeNull();
    // Aggregation should be null (no sswScore/tangoAggMax set)
    expect(cRanking.categoryScores.aggregation).toBeNull();
  });

  it('weighted scoring: zero weight effectively ignores metric', () => {
    // Use uncorrelated data so zeroing a weight actually changes scores
    const uncorrelated: Peptide[] = [
      makePeptide({ id: 'P', hydrophobicity: 0.9, charge: 1.0, muH: 0.1, ffHelixPercent: 10 }),
      makePeptide({ id: 'Q', hydrophobicity: 0.1, charge: 2.0, muH: 0.9, ffHelixPercent: 90 }),
      makePeptide({ id: 'R', hydrophobicity: 0.5, charge: 3.0, muH: 0.5, ffHelixPercent: 50 }),
    ];
    const equalRankings = rankPeptides(uncorrelated, DEFAULT_WEIGHTS);
    // Zero out hydrophobicity — P was high in hydro, so its ranking should drop
    const zeroHydro: RankingWeights = { ...DEFAULT_WEIGHTS, hydrophobicity: 0 };
    const rankings = rankPeptides(uncorrelated, zeroHydro);
    const differ = rankings.some((r, i) =>
      Math.abs(r.compositeScore - equalRankings[i].compositeScore) > 0.01,
    );
    expect(differ).toBe(true);
  });
});

// ---- Presets ----

describe('presets', () => {
  it('equal preset has all weights at 1', () => {
    const w = PRESETS.equal;
    for (const v of Object.values(w)) {
      expect(v).toBe(1);
    }
  });

  it('physicochemical preset emphasizes physico metrics', () => {
    const w = PRESETS.physicochemical;
    expect(w.hydrophobicity).toBeGreaterThan(w.sswScore);
    expect(w.absCharge).toBeGreaterThan(w.tangoAggMax);
  });

  it('aggregation preset emphasizes agg metrics', () => {
    const w = PRESETS.aggregation;
    expect(w.sswScore).toBeGreaterThan(w.hydrophobicity);
    expect(w.tangoAggMax).toBeGreaterThan(w.absCharge);
  });
});
