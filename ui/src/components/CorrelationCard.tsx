import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Peptide } from '@/types/peptide';

// Tiny Pearson helper
function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n !== ys.length || n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx, ay = ys[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

// nice labels for the matrix headers
const LABELS: Record<string, string> = {
  hydrophobicity: 'Hydrophobicity',
  muH: 'μH',
  length: 'Length',
  chargeAbs: '|Charge|',
  ffHelixPercent: 'FF-Helix %',
  tangoAggMax: 'Agg Max',
};

type ColKey = 'hydrophobicity' | 'muH' | 'length' | 'chargeAbs' | 'ffHelixPercent' | 'tangoAggMax';
const COLS: ColKey[] = ['hydrophobicity', 'muH', 'length', 'chargeAbs', 'ffHelixPercent', 'tangoAggMax'];

// red-white-blue color scale for r in [-1,1]
function corrColor(r: number): string {
  if (!Number.isFinite(r)) return 'hsl(0 0% 90%)'; // light gray for NaN
  // Map r=-1..0..1 to hue 0 (red) .. 220 (blue) via interpolation around white in the middle.
  // We'll just blend via separate negatives/positives to keep it simple & readable.
  if (r >= 0) {
    // white -> blue
    const s = Math.min(1, r);
    const light = 95 - s * 40;  // 95% -> 55%
    const hue = 220;            // blue
    const sat = 70 * s;         // up to 70%
    return `hsl(${hue} ${sat}% ${light}%)`;
  } else {
    // white -> red
    const s = Math.min(1, -r);
    const light = 95 - s * 40;  // 95% -> 55%
    const hue = 0;              // red
    const sat = 70 * s;         // up to 70%
    return `hsl(${hue} ${sat}% ${light}%)`;
  }
}

export function CorrelationCard({ peptides }: { peptides: Peptide[] }) {
  const { matrix, rows } = useMemo(() => {
    // Relaxed filter: only require core fields; optional fields handled per-pair
    const valid = peptides.filter(
      (p) =>
        Number.isFinite(p.hydrophobicity) &&
        Number.isFinite(p.length) &&
        Number.isFinite(p.charge)
    );

    // Extract a numeric value for a given column from a peptide
    function getVal(p: Peptide, col: ColKey): number {
      switch (col) {
        case 'chargeAbs': return Math.abs(p.charge ?? 0);
        case 'muH': return typeof p.muH === 'number' ? p.muH : NaN;
        case 'ffHelixPercent': return typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : NaN;
        case 'tangoAggMax': return typeof p.tangoAggMax === 'number' ? p.tangoAggMax : NaN;
        default: return (p as any)[col] ?? NaN;
      }
    }

    const m: number[][] = [];
    for (let i = 0; i < COLS.length; i++) {
      m[i] = [];
      for (let j = 0; j < COLS.length; j++) {
        // For each pair, only include peptides where both values are finite
        const pairs = valid
          .map(p => [getVal(p, COLS[i]), getVal(p, COLS[j])] as [number, number])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        m[i][j] = pearson(pairs.map(([a]) => a), pairs.map(([, b]) => b));
      }
    }
    return { matrix: m, rows: valid.length };
  }, [peptides]);

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle>Correlation Matrix</CardTitle>
        <CardDescription>
          Pearson correlation (n = {rows}). Higher |r| = stronger linear relationship.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Grid: +1 column for row labels */}
          <div
            className="inline-grid"
            style={{
              gridTemplateColumns: `auto repeat(${COLS.length}, minmax(60px, 1fr))`,
              gap: '2px',
            }}
          >
            {/* Top-left blank cell */}
            <div />

            {/* Column headers */}
            {COLS.map((c) => (
              <div key={`col-h-${c}`} className="text-xs font-medium text-muted-foreground px-2 py-1 text-center">
                {LABELS[c]}
              </div>
            ))}

            {/* Rows */}
            {COLS.map((ri, i) => (
              <div key={`row-${ri}-${i}`} className="contents">
                {/* Row header */}
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 text-right">
                  {LABELS[ri]}
                </div>
                {/* Cells */}
                {COLS.map((cj, j) => {
                  const r = matrix[i][j];
                  const bg = corrColor(r);
                  return (
                    <div
                      key={`cell-${i}-${j}`}
                      className="px-2 py-3 text-xs font-mono text-center rounded-sm"
                      style={{ backgroundColor: bg }}
                      title={`${LABELS[ri]} vs ${LABELS[cj]}: ${Number.isFinite(r) ? r.toFixed(2) : 'N/A'}`}
                    >
                      {Number.isFinite(r) ? r.toFixed(2) : '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>−1</span>
          <div className="h-3 w-24 rounded"
               style={{ background: 'linear-gradient(90deg, hsl(0 70% 55%), hsl(0 0% 95%), hsl(220 70% 55%))' }} />
          <span>+1</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default CorrelationCard;
