/**
 * BiochemComparison — Unified biochemical feature comparison framework.
 *
 * Replaces the 3 disjoint sections on PeptideDetail (radar, percentile bars,
 * summary stat cards) with a single configurable component reading from one
 * metrics declaration — single source of truth.
 *
 * Terminology: "cohort" → "database" throughout (Peleg FIX-003/FIX-016).
 * Badge colors: "Above median" uses green, not gold/brown (Peleg FIX-016).
 * No "neural network prediction" subtitle — just "S4PRED helix" (Peleg FIX-016).
 *
 * @see docs/active/PELEG_FEEDBACK_INSTRUCTIONS.md FIX-016
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { Peptide, DatasetStats } from "@/types/peptide";

// ── Types ──

export type BiochemDisplayMode = "radar" | "percentile" | "stat-card" | "all";

export interface BiochemMetric {
  /** Unique metric ID */
  id: string;
  /** Display label */
  label: string;
  /** Unit string (e.g., "%", "(pH 7.4)") */
  unit?: string;
  /** Which sub-panels show this metric */
  displayMode: BiochemDisplayMode;
  /** Extract the peptide's value for this metric */
  getValue: (p: Peptide) => number | null | undefined;
  /** Extract the database mean for this metric (from DatasetStats) */
  getMean?: (stats: DatasetStats) => number | null | undefined;
  /** Optional interpretation function */
  interpretation?: (value: number, percentile: number) => string;
}

export interface BiochemComparisonProps {
  /** The focal peptide */
  peptide: Peptide;
  /** All peptides in the dataset (for percentile computation) */
  allPeptides: Peptide[];
  /** Database-level statistics */
  stats: DatasetStats | null;
  /** Declarative list of metrics to compare */
  metrics: BiochemMetric[];
  /** Layout mode. Compact stacks sub-panels; expanded shows side-by-side. */
  layout?: "compact" | "expanded";
  /**
   * Wave Q.1: explicit display mode override.
   *  - "full" (default): all sub-panels render (stat cards + radar + percentiles)
   *  - "single-peptide": stat cards render absolute values only; radar +
   *    percentile bars are replaced with an empty-state pointing the user
   *    to upload a CSV / run a UniProt query.
   * If omitted, the component auto-detects single-peptide mode via
   * `allPeptides.length < 2`.
   */
  mode?: "full" | "single-peptide";
}

// ── Default PVL metrics ──

export const DEFAULT_PVL_METRICS: BiochemMetric[] = [
  {
    id: "hydrophobicity",
    label: "Hydrophobicity",
    unit: "",
    displayMode: "all",
    getValue: (p) => p.hydrophobicity,
    getMean: (s) => s.meanHydrophobicity,
  },
  {
    id: "muH",
    label: "Hydrophobic moment",
    unit: "μH",
    displayMode: "all",
    getValue: (p) => p.muH,
    getMean: (s) => s.meanMuH,
  },
  {
    id: "charge",
    label: "Charge",
    unit: "(pH 7.4)",
    displayMode: "all",
    getValue: (p) => p.charge,
    getMean: (s) => s.meanCharge,
  },
];

// ── Percentile computation ──

function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const below = allValues.filter((v) => v < value).length;
  return (below / allValues.length) * 100;
}

function getPercentileBand(pct: number): {
  label: string;
  colorClass: string;
} {
  if (pct >= 90) return { label: "Top 10%", colorClass: "text-green-600 dark:text-green-400" };
  if (pct >= 75) return { label: "Top 25%", colorClass: "text-green-600 dark:text-green-400" };
  if (pct >= 50) return { label: "Above median", colorClass: "text-green-600 dark:text-green-400" };
  if (pct >= 25) return { label: "Below median", colorClass: "text-muted-foreground" };
  return { label: "Bottom 25%", colorClass: "text-muted-foreground" };
}

// ── Component ──

export function BiochemComparison({
  peptide,
  allPeptides,
  stats,
  metrics,
  layout = "compact",
  mode,
}: BiochemComparisonProps) {
  // Wave Q.1: detect single-peptide mode. Auto-detect by allPeptides.length < 2,
  // overridable via the explicit `mode` prop. In single-peptide mode the
  // stat-card row still renders (absolute values), but percentile bars + radar
  // are replaced with a single empty-state pointing the user to a database.
  const isSinglePeptide = mode === "single-peptide" || (mode !== "full" && allPeptides.length < 2);

  // Compute percentiles for each metric
  const metricsWithPercentiles = useMemo(() => {
    return metrics.map((m) => {
      const value = m.getValue(peptide);
      const allValues = allPeptides
        .map((p) => m.getValue(p))
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      // Suppress percentile computation in single-peptide mode — a single
      // sample's percentile is meaningless.
      const percentile =
        !isSinglePeptide && typeof value === "number" && Number.isFinite(value)
          ? calculatePercentile(value, allValues)
          : null;
      const mean = stats && m.getMean ? m.getMean(stats) : null;
      return { metric: m, value, percentile, mean };
    });
  }, [peptide, allPeptides, stats, metrics, isSinglePeptide]);

  const statCardMetrics = metricsWithPercentiles.filter(
    (m) => m.metric.displayMode === "stat-card" || m.metric.displayMode === "all"
  );
  const percentileMetrics = metricsWithPercentiles.filter(
    (m) => m.metric.displayMode === "percentile" || m.metric.displayMode === "all"
  );
  const radarMetrics = metricsWithPercentiles.filter(
    (m) => m.metric.displayMode === "radar" || m.metric.displayMode === "all"
  );

  return (
    <Card className="rounded-xl border-[hsl(var(--border))]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Biochemical feature comparison</CardTitle>
        <CardDescription>How this peptide compares to the database</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sub-panel 1: Stat cards row */}
        {statCardMetrics.length > 0 && (
          <div
            className={`grid gap-3 ${
              statCardMetrics.length <= 2
                ? "grid-cols-1 sm:grid-cols-2"
                : statCardMetrics.length <= 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {statCardMetrics.map(({ metric: m, value, mean, percentile }) => {
              const band = percentile !== null ? getPercentileBand(percentile) : null;
              return (
                <div key={m.id} className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    {m.label} {m.unit && <span className="text-[10px]">{m.unit}</span>}
                  </p>
                  <p className="text-xl font-bold tracking-tight">
                    {typeof value === "number" ? value.toFixed(2) : "N/A"}
                  </p>
                  {typeof mean === "number" && (
                    <p className="text-[10px] text-muted-foreground">
                      Database mean: {mean.toFixed(2)}
                    </p>
                  )}
                  {band && (
                    <span className={`text-[10px] font-medium ${band.colorClass}`}>
                      {band.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* B3 (Said decided 2026-05-21, option 3): drop the "No database
            comparison available" empty state — it adds noise without info.
            In single-peptide mode we simply show the absolute-value stat
            cards above and stop. The radar + percentile sub-panels below
            stay gated on the dataset-mode branch. */}

        {/* Sub-panel 2: Radar chart placeholder (full mode only) */}
        {!isSinglePeptide && radarMetrics.length >= 3 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Radar comparison (peptide vs database mean)
            </p>
            <RadarComparisonSVG metrics={radarMetrics} />
          </div>
        )}

        {/* Sub-panel 3: Percentile bars (full mode only) */}
        {!isSinglePeptide && percentileMetrics.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Percentile ranking across key metrics
            </p>
            <div className="space-y-2">
              {percentileMetrics.map(({ metric: m, value, percentile }) => {
                const band = percentile !== null ? getPercentileBand(percentile) : null;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                      {m.label}
                    </span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(2, percentile ?? 0)}%`,
                          backgroundColor:
                            (percentile ?? 0) >= 50
                              ? "hsl(var(--ff-helix))"
                              : "hsl(var(--muted-foreground))",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-12 text-right">
                      {percentile !== null ? `${percentile.toFixed(0)}%` : "—"}
                    </span>
                    {band && (
                      <span className={`text-[10px] w-20 ${band.colorClass}`}>{band.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Peleg FIX-016: add dataset-relative note */}
            <p className="text-[9px] text-muted-foreground/60 mt-2">
              Note: percentiles are relative to this dataset only.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Simple SVG radar chart ──

function RadarComparisonSVG({
  metrics,
}: {
  metrics: {
    metric: BiochemMetric;
    value: number | null | undefined;
    percentile: number | null;
    mean: number | null | undefined;
  }[];
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const n = metrics.length;

  // B.4: hover-vertex tooltip — restores the "hover a point, see metric +
  // peptide value + database mean" behavior Said reported as missing.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (n < 3) return null;

  // Normalize values to 0-1 using percentile
  const peptidePoints = metrics.map((m, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = maxR * ((m.percentile ?? 50) / 100);
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      label: m.metric.label,
      labelX: cx + (maxR + 15) * Math.cos(angle),
      labelY: cy + (maxR + 15) * Math.sin(angle),
    };
  });

  // Database mean at 50th percentile (center line)
  const meanPoints = metrics.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = maxR * 0.5;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const peptidePath =
    peptidePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const meanPath =
    meanPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const hovered = hoveredIdx != null ? metrics[hoveredIdx] : null;
  const hoveredPoint = hoveredIdx != null ? peptidePoints[hoveredIdx] : null;
  const fmt = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—";

  return (
    <div className="flex justify-center">
      <div className="relative w-full max-w-[240px]" data-testid="biochem-radar">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <circle
            key={frac}
            cx={cx}
            cy={cy}
            r={maxR * frac}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {metrics.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        {/* Database mean polygon */}
        <path
          d={meanPath}
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.1}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />

        {/* Peptide polygon */}
        <path
          d={peptidePath}
          fill="hsl(var(--primary))"
          fillOpacity={0.15}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />

        {/* Data points — hover surface includes a larger transparent target
            so even tiny dots are easy to hit on touch + mouse devices. */}
        {peptidePoints.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onFocus={() => setHoveredIdx(i)}
            tabIndex={0}
            data-testid={`biochem-radar-vertex-${i}`}
            style={{ cursor: "pointer" }}
          >
            <circle cx={p.x} cy={p.y} r={9} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 4 : 3}
              fill="hsl(var(--primary))"
              stroke={hoveredIdx === i ? "hsl(var(--primary-foreground))" : "none"}
              strokeWidth={hoveredIdx === i ? 1.5 : 0}
            />
          </g>
        ))}

        {/* Labels */}
        {peptidePoints.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            className="fill-muted-foreground"
          >
            {p.label}
          </text>
        ))}
      </svg>

      {/* B.4: vertex tooltip — metric name, peptide value, database mean.
          Positioned in viewBox-relative coordinates over the svg. */}
      {hovered && hoveredPoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-background/95 backdrop-blur-sm px-2.5 py-1.5 text-[11px] shadow-md whitespace-nowrap"
          style={{
            left: `${(hoveredPoint.x / size) * 100}%`,
            top: `${(hoveredPoint.y / size) * 100}%`,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
          role="tooltip"
          data-testid="biochem-radar-tooltip"
        >
          <p className="font-semibold mb-0.5">{hovered.metric.label}</p>
          <p className="text-muted-foreground">
            <span className="text-primary">●</span> Peptide:{" "}
            <span className="font-mono text-foreground">{fmt(hovered.value)}</span>
            {hovered.metric.unit ? ` ${hovered.metric.unit}` : ""}
          </p>
          <p className="text-muted-foreground">
            <span className="text-muted-foreground">○</span> Database mean:{" "}
            <span className="font-mono text-foreground">{fmt(hovered.mean)}</span>
            {hovered.metric.unit ? ` ${hovered.metric.unit}` : ""}
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

export default BiochemComparison;
