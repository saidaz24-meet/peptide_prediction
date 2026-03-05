/**
 * Spearman rank correlation coefficient.
 *
 * Ranks tied values using the average rank method.
 * Returns NaN if fewer than 3 pairs or zero variance.
 */

/** Assign average ranks to an array of numbers. */
export function computeRanks(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    // Find span of tied values
    while (j < n && indexed[j].v === indexed[i].v) j++;
    // Average rank for the group (1-based)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/** Compute Spearman rank correlation between two arrays. */
export function spearmanRank(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n !== ys.length || n < 3) return NaN;

  const rx = computeRanks(xs);
  const ry = computeRanks(ys);

  // Pearson of the ranks
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = rx[i] - mx;
    const ay = ry[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }

  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}
