import { describe, it, expect } from 'vitest';
import { computeRanks, spearmanRank } from '../spearman';

describe('computeRanks', () => {
  it('ranks distinct values correctly', () => {
    expect(computeRanks([10, 30, 20])).toEqual([1, 3, 2]);
  });

  it('handles tied values with average ranks', () => {
    expect(computeRanks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('handles all identical values', () => {
    expect(computeRanks([5, 5, 5])).toEqual([2, 2, 2]);
  });

  it('handles single element', () => {
    expect(computeRanks([42])).toEqual([1]);
  });
});

describe('spearmanRank', () => {
  it('returns 1 for perfectly monotonic increasing', () => {
    expect(spearmanRank([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1.0);
  });

  it('returns -1 for perfectly monotonic decreasing', () => {
    expect(spearmanRank([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBeCloseTo(-1.0);
  });

  it('returns NaN for fewer than 3 pairs', () => {
    expect(spearmanRank([1, 2], [3, 4])).toBeNaN();
  });

  it('returns NaN for mismatched lengths', () => {
    expect(spearmanRank([1, 2, 3], [4, 5])).toBeNaN();
  });

  it('returns NaN for zero variance (all same values in one array)', () => {
    expect(spearmanRank([5, 5, 5], [1, 2, 3])).toBeNaN();
  });

  it('computes correct value for non-trivial case', () => {
    // Manual: xs=[86,97,99,100,101,103,106,110,112,113]
    //         ys=[2,20,28,27,50,29,7,17,6,12]
    const xs = [86, 97, 99, 100, 101, 103, 106, 110, 112, 113];
    const ys = [2, 20, 28, 27, 50, 29, 7, 17, 6, 12];
    const rho = spearmanRank(xs, ys);
    // Expected Spearman rho ≈ -0.175758 (verified independently)
    expect(rho).toBeCloseTo(-0.1758, 2);
  });

  it('handles ties correctly', () => {
    const xs = [1, 2, 3, 4, 4];
    const ys = [5, 6, 7, 8, 8];
    const rho = spearmanRank(xs, ys);
    expect(rho).toBeCloseTo(1.0, 5);
  });
});
