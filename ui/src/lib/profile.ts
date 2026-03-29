// src/lib/profile.ts

// Fauchere-Pliska hydrophobicity scale (matches backend biochem_calculation.py)
const FP: Record<string, number> = {
  A: 0.31,
  R: -1.01,
  N: -0.6,
  D: -0.77,
  C: 1.54,
  E: -0.64,
  Q: -0.22,
  G: 0.0,
  H: 0.13,
  I: 1.8,
  L: 1.7,
  K: -0.99,
  M: 1.23,
  F: 1.79,
  P: 0.72,
  S: -0.04,
  T: 0.26,
  W: 2.25,
  Y: 0.96,
  V: 1.22,
};

export function kd(a: string): number {
  return FP[a.toUpperCase()] ?? 0;
}

/**
 * Sliding-window hydrophobicity (mean) and hydrophobic moment (α-helix model)
 * @param seq Amino-acid sequence (single-letter)
 * @param k   Window size (odd number like 9, 11, 13…)
 * @returns arrays H[] and muH[] of length (seq.length - k + 1)
 */
export function windowSeries(seq: string, k = 11): { H: number[]; muH: number[] } {
  const H: number[] = [];
  const muH: number[] = [];
  const angle = (100 * Math.PI) / 180; // 100° per residue for α-helix

  const U = seq.toUpperCase();
  for (let i = 0; i <= U.length - k; i++) {
    const sub = U.slice(i, i + k);
    // mean hydrophobicity
    let hsum = 0;
    for (let j = 0; j < k; j++) hsum += kd(sub[j]);
    H.push(hsum / k);

    // hydrophobic moment (vector sum)
    let x = 0,
      y = 0;
    for (let j = 0; j < k; j++) {
      const h = kd(sub[j]);
      const theta = j * angle;
      x += h * Math.cos(theta);
      y += h * Math.sin(theta);
    }
    muH.push(Math.sqrt(x * x + y * y) / k);
  }
  return { H, muH };
}

/** Build Recharts-friendly series: [{x, H, muH}] */
export function buildProfilePoints(
  seq: string,
  k = 11
): Array<{ x: number; H: number; muH: number }> {
  const { H, muH } = windowSeries(seq, k);
  const pts = [];
  for (let i = 0; i < H.length; i++) pts.push({ x: i + 1, H: H[i], muH: muH[i] });
  return pts;
}

/** Convert helix fragments [[start,end],...] into ReferenceArea ranges (1-indexed) */
export function helixRanges(frags?: [number, number][], k = 11): Array<{ x1: number; x2: number }> {
  if (!frags || !frags.length) return [];
  // profile’s x runs over window starts; shade where window fully inside helix segment
  const pad = Math.floor(k / 2);
  return frags.map(([s, e]) => ({
    x1: Math.max(1, s - pad),
    x2: Math.max(1, e - pad),
  }));
}
