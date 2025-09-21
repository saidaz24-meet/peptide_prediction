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
};

type ColKey = 'hydrophobicity' | 'muH' | 'length' | 'chargeAbs';
const COLS: ColKey[] = ['hydrophobicity', 'muH', 'length', 'chargeAbs'];

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
    // filter rows with numeric hydro & muH at minimum (others can be derived)
    const valid = peptides.filter(
      (p) =>
        Number.isFinite(p.hydrophobicity) &&
        Number.isFinite(p.muH) &&
        Number.isFinite(p.length) &&
        Number.isFinite(p.charge)
    );

    const m: number[][] = [];
    for (let i = 0; i < COLS.length; i++) {
      m[i] = [];
      for (let j = 0; j < COLS.length; j++) {
        const xi = valid.map((p) =>
          COLS[i] === 'chargeAbs' ? Math.abs(p.charge) : (p as any)[COLS[i]]
        );
        const yj = valid.map((p) =>
          COLS[j] === 'chargeAbs' ? Math.abs(p.charge) : (p as any)[COLS[j]]
        );
        m[i][j] = pearson(xi as number[], yj as number[]);
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
              gridTemplateColumns: `repeat(${COLS.length + 1}, minmax(80px, 1fr))`,
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
