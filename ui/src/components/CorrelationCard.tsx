import { useMemo, useState } from "react";
import { ExpandableChart } from "@/components/ExpandableChart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Line,
  ComposedChart,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { TIER_POINT_COLORS } from "@/lib/chartConfig";
import { spearmanRank } from "@/lib/spearman";
import { getConsensusSS } from "@/lib/consensus";
import { Abbr } from "@/components/Abbr";
import type { Peptide } from "@/types/peptide";

const LABELS: Record<string, string> = {
  hydrophobicity: "Hydrophobicity",
  muH: "μH",
  length: "Length",
  chargeAbs: "|Charge|",
  ffHelixPercent: "FF-Helix %",
  s4predHelixPercent: "S4PRED Helix %",
  sswScore: "SSW Score",
  sswDiff: "SSW Diff",
  tangoAggMax: "Agg Max",
};

type ColKey =
  | "hydrophobicity"
  | "muH"
  | "length"
  | "chargeAbs"
  | "ffHelixPercent"
  | "s4predHelixPercent"
  | "sswScore"
  | "sswDiff"
  | "tangoAggMax";
const COLS: ColKey[] = [
  "hydrophobicity",
  "muH",
  "length",
  "chargeAbs",
  "ffHelixPercent",
  "s4predHelixPercent",
  "sswScore",
  "sswDiff",
  "tangoAggMax",
];
/** Rich labels with Abbr tooltips for grid headers */
const HEADER_LABELS: Record<string, React.ReactNode> = {
  hydrophobicity: "Hydrophobicity",
  muH: <Abbr title="Hydrophobic moment (amphipathic character)">μH</Abbr>,
  length: "Length",
  chargeAbs: "|Charge|",
  ffHelixPercent: (
    <>
      <Abbr title="Fibril-Forming">FF</Abbr>-Helix %
    </>
  ),
  s4predHelixPercent: (
    <>
      <Abbr title="Secondary Structure Prediction (neural network)">S4PRED</Abbr> Helix %
    </>
  ),
  sswScore: (
    <>
      <Abbr title="Structural Switching">SSW</Abbr> Score
    </>
  ),
  sswDiff: (
    <>
      <Abbr title="Structural Switching">SSW</Abbr> Diff
    </>
  ),
  tangoAggMax: <>Agg Max</>,
};

// Group boundaries: biochem (0-3) | structural (4-5) | switching (6-8)
const GROUP_BORDERS = new Set([4, 6]);

function corrColor(r: number): string {
  if (!Number.isFinite(r)) return "hsl(0 0% 90%)";
  if (r >= 0) {
    const s = Math.min(1, r);
    return `hsl(220 ${70 * s}% ${95 - s * 40}%)`;
  } else {
    const s = Math.min(1, -r);
    return `hsl(0 ${70 * s}% ${95 - s * 40}%)`;
  }
}

function getVal(p: Peptide, col: ColKey): number {
  switch (col) {
    case "chargeAbs":
      return Math.abs(p.charge ?? 0);
    case "muH":
      return typeof p.muH === "number" ? p.muH : NaN;
    case "ffHelixPercent":
      return typeof p.ffHelixPercent === "number" ? p.ffHelixPercent : NaN;
    case "s4predHelixPercent":
      return typeof p.s4predHelixPercent === "number" ? p.s4predHelixPercent : NaN;
    case "sswScore":
      return typeof p.sswScore === "number" ? p.sswScore : NaN;
    case "sswDiff":
      return typeof p.sswDiff === "number" ? p.sswDiff : NaN;
    case "tangoAggMax":
      return typeof p.tangoAggMax === "number" ? p.tangoAggMax : NaN;
    default:
      return (p as any)[col] ?? NaN;
  }
}

/** Simple linear regression for trend line overlay */
function linearTrend(
  data: { x: number; y: number }[]
): { slope: number; intercept: number } | null {
  const n = data.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxy = 0,
    sxx = 0;
  for (const d of data) {
    sx += d.x;
    sy += d.y;
    sxy += d.x * d.y;
    sxx += d.x * d.x;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function CorrelationCard({ peptides }: { peptides: Peptide[] }) {
  const [scatterPair, setScatterPair] = useState<{ i: number; j: number } | null>(null);

  const { matrix, rows } = useMemo(() => {
    const valid = peptides.filter(
      (p) =>
        Number.isFinite(p.hydrophobicity) && Number.isFinite(p.length) && Number.isFinite(p.charge)
    );

    const m: number[][] = [];
    for (let i = 0; i < COLS.length; i++) {
      m[i] = [];
      for (let j = 0; j < COLS.length; j++) {
        const pairs = valid
          .map((p) => [getVal(p, COLS[i]), getVal(p, COLS[j])] as [number, number])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        m[i][j] = spearmanRank(
          pairs.map(([a]) => a),
          pairs.map(([, b]) => b)
        );
      }
    }
    return { matrix: m, rows: valid.length };
  }, [peptides]);

  // Scatter data for dialog
  const scatterData = useMemo(() => {
    if (!scatterPair) return [];
    const { i, j } = scatterPair;
    return peptides
      .map((p) => {
        const x = getVal(p, COLS[i]);
        const y = getVal(p, COLS[j]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const tier = getConsensusSS(p).tier;
        return { x, y, id: p.id, tier };
      })
      .filter(Boolean) as { x: number; y: number; id: string; tier: number }[];
  }, [peptides, scatterPair]);

  // Trend line data for scatter dialog
  const trendLineData = useMemo(() => {
    if (scatterData.length < 2) return [];
    const fit = linearTrend(scatterData);
    if (!fit) return [];
    const xs = scatterData.map((d) => d.x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    return [
      { x: xMin, y: fit.slope * xMin + fit.intercept },
      { x: xMax, y: fit.slope * xMax + fit.intercept },
    ];
  }, [scatterData]);

  const chartConfig = { scatter: { label: "Correlation", color: "#888" } };

  return (
    <>
      <ExpandableChart
        title="Correlation Matrix"
        description={`Spearman rank correlation (n = ${rows}). Click a cell to view scatter plot.`}
        peptides={peptides}
      >
        <div className="overflow-x-auto">
          <div
            className="inline-grid"
            style={{
              gridTemplateColumns: `auto repeat(${COLS.length}, minmax(48px, 1fr))`,
              gap: "2px",
            }}
          >
            <div />
            {COLS.map((c, idx) => (
              <div
                key={`col-h-${c}`}
                className={`text-[10px] font-medium text-muted-foreground px-1 py-1 text-center leading-tight${GROUP_BORDERS.has(idx) ? " border-l-2 border-muted-foreground/30" : ""}`}
              >
                {HEADER_LABELS[c]}
              </div>
            ))}

            {COLS.map((ri, i) => (
              <div
                key={`row-${ri}-${i}`}
                className={`contents${GROUP_BORDERS.has(i) ? " [&>*]:border-t-2 [&>*]:border-muted-foreground/30" : ""}`}
              >
                <div className="text-[10px] font-medium text-muted-foreground px-1 py-1 text-right leading-tight">
                  {HEADER_LABELS[ri]}
                </div>
                {COLS.map((cj, j) => {
                  const r = matrix[i][j];
                  const bg = corrColor(r);
                  const isDiag = i === j;
                  const significant = Number.isFinite(r) && Math.abs(r) > 0.5;
                  return (
                    <div
                      key={`cell-${i}-${j}`}
                      className={`px-1 py-2.5 text-[10px] font-mono text-center rounded-sm${isDiag ? "" : " cursor-pointer hover:ring-2 hover:ring-primary/40"}${significant ? " font-bold" : ""}${GROUP_BORDERS.has(j) ? " border-l-2 border-muted-foreground/30" : ""}`}
                      style={{ backgroundColor: bg }}
                      title={`${LABELS[ri]} vs ${LABELS[cj]}: ${Number.isFinite(r) ? r.toFixed(3) : "N/A"}`}
                      onClick={() => {
                        if (!isDiag) setScatterPair({ i, j });
                      }}
                    >
                      {Number.isFinite(r) ? r.toFixed(2) : "—"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>−1</span>
            <div
              className="h-3 w-24 rounded"
              style={{
                background:
                  "linear-gradient(90deg, hsl(0 70% 55%), hsl(0 0% 95%), hsl(220 70% 55%))",
              }}
            />
            <span>+1</span>
          </div>
          <span className="font-bold">Bold</span>
          <span>= |ρ| {">"} 0.5</span>
        </div>
      </ExpandableChart>

      {/* Click-to-scatter dialog */}
      <Dialog
        open={scatterPair !== null}
        onOpenChange={(open) => {
          if (!open) setScatterPair(null);
        }}
      >
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {scatterPair
                ? `${LABELS[COLS[scatterPair.i]]} vs ${LABELS[COLS[scatterPair.j]]}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              {scatterPair && Number.isFinite(matrix[scatterPair.i][scatterPair.j])
                ? `Spearman ρ = ${matrix[scatterPair.i][scatterPair.j].toFixed(3)} (n = ${scatterData.length})`
                : "Insufficient data"}
            </DialogDescription>
          </DialogHeader>
          {scatterData.length > 0 && (
            <ChartContainer config={chartConfig} className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 20, right: 50, bottom: 25, left: 40 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={scatterPair ? LABELS[COLS[scatterPair.i]] : ""}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={scatterPair ? LABELS[COLS[scatterPair.j]] : ""}
                  />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs">
                          <p className="font-medium">{item.id}</p>
                          <p>
                            {scatterPair ? LABELS[COLS[scatterPair.i]] : ""}:{" "}
                            {Number(item.x).toFixed(3)}
                          </p>
                          <p>
                            {scatterPair ? LABELS[COLS[scatterPair.j]] : ""}:{" "}
                            {Number(item.y).toFixed(3)}
                          </p>
                          <div className="flex items-center gap-1 mt-1 pt-1 border-t">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: TIER_POINT_COLORS[item.tier] }}
                            />
                            <span>Tier {item.tier}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((d, i) => (
                      <Cell key={i} fill={TIER_POINT_COLORS[d.tier] ?? "#999"} />
                    ))}
                  </Scatter>
                  {trendLineData.length === 2 && (
                    <Line
                      data={trendLineData}
                      dataKey="y"
                      stroke="#666"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      isAnimationActive={false}
                      legendType="none"
                      tooltipType="none"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
          {/* Tier legend */}
          <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {[1, 2, 3, 4, 5].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TIER_POINT_COLORS[t] }}
                />
                T{t}
              </span>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CorrelationCard;
