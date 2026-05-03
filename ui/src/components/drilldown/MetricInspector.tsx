/**
 * Metric drill-down inspector content.
 *
 * Design philosophy: shows a single metric in full scientific context --
 * hero value, definition, interpretation, threshold reference, distribution
 * histogram, and related metric chips. All metadata comes from the central
 * metricRegistry. All peptide data comes from the datasetStore.
 */

import { useMemo } from "react";
import { getMetric, METRIC_REGISTRY } from "@/lib/metricRegistry";
import { useDatasetStore } from "@/stores/datasetStore";
import { Badge } from "@/components/ui/badge";
import { useDrillDown } from "./DrillDownProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricInspectorProps {
  metricId: string;
  peptideId: string | null;
}

// ---------------------------------------------------------------------------
// Simple SVG histogram (no external chart library needed)
// ---------------------------------------------------------------------------

function MiniHistogram({
  values,
  color,
}: {
  values: number[];
  color?: string;
}) {
  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const binCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / binCount;

  const bins = new Array(binCount).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx]++;
  }

  const maxBin = Math.max(...bins);
  const svgW = 480;
  const svgH = 120;
  const barGap = 2;
  const barW = (svgW - barGap * (binCount - 1)) / binCount;

  const fillColor = color ?? "hsl(var(--primary))";

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-32"
      role="img"
      aria-label="Distribution histogram"
    >
      {bins.map((count, i) => {
        const barH = maxBin > 0 ? (count / maxBin) * (svgH - 8) : 0;
        const x = i * (barW + barGap);
        const y = svgH - barH;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={2}
            fill={fillColor}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricInspector({ metricId, peptideId }: MetricInspectorProps) {
  const metric = getMetric(metricId);
  const peptides = useDatasetStore((s) => s.peptides);
  const stats = useDatasetStore((s) => s.stats);
  const { open } = useDrillDown();

  // Resolve peptide-specific value
  const peptide = useMemo(
    () => (peptideId ? peptides.find((p) => p.id === peptideId) : undefined),
    [peptides, peptideId],
  );

  // Collect all values for distribution
  const allValues = useMemo(() => {
    if (!metric) return [];
    return peptides
      .map((p) => metric.getValue(p))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  }, [peptides, metric]);

  if (!metric) {
    return (
      <div className="text-sm text-muted-foreground">
        Unknown metric: <code>{metricId}</code>
      </div>
    );
  }

  // Hero value: peptide-specific or database mean
  const heroRaw = peptide
    ? metric.getValue(peptide)
    : stats && metric.getMean
      ? metric.getMean(stats)
      : null;
  const heroFormatted =
    heroRaw != null && Number.isFinite(heroRaw)
      ? metric.format(heroRaw)
      : "N/A";
  const heroLabel = peptide ? peptide.id : "Database mean";

  return (
    <div className="space-y-6">
      {/* ---- Hero value ---- */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          {heroLabel}
        </p>
        <p className="text-4xl font-bold tabular-nums">
          {heroFormatted}
        </p>
        {metric.unit && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {metric.unit}
          </p>
        )}
      </div>

      {/* ---- Scientific definition ---- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Definition
        </h3>
        <p className="text-sm leading-relaxed">{metric.definition}</p>
      </section>

      {/* ---- Interpretation guide ---- */}
      {metric.interpretation && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Interpretation
          </h3>
          <p className="text-sm leading-relaxed">{metric.interpretation}</p>
        </section>
      )}

      {/* ---- Distribution histogram ---- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Distribution ({allValues.length} peptides)
        </h3>
        <MiniHistogram values={allValues} color={metric.color} />
      </section>

      {/* ---- Related metrics ---- */}
      {metric.relatedMetrics && metric.relatedMetrics.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Related Metrics
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {metric.relatedMetrics.map((rid) => {
              const related = METRIC_REGISTRY[rid];
              if (!related) return null;
              return (
                <Badge
                  key={rid}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() =>
                    open({ metric: rid, peptide: peptideId ?? undefined, mode: "metric" })
                  }
                >
                  {related.shortName ?? related.name}
                </Badge>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
