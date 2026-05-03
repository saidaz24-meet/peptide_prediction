/**
 * MetricHover — universal hover card for any PVL metric value.
 *
 * Wraps any trigger element and reveals a rich tooltip with:
 *   1. Metric name and scientific definition
 *   2. The displayed value (large, monospaced) with unit
 *   3. Database context: mean + percentile band
 *   4. Mini 5-bin distribution sparkline with position highlight
 *   5. Interpretation guidance
 *
 * All data is resolved from the central metric registry and the live
 * Zustand dataset store, keeping per-component duplication at zero.
 */

import { useMemo } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useDatasetStore } from "@/stores/datasetStore";
import { getMetric } from "@/lib/metricRegistry";
import { MiniDistribution } from "./MiniDistribution";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Percentile helpers
// ---------------------------------------------------------------------------

function computePercentile(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < target).length;
  return (below / values.length) * 100;
}

function percentileBand(pct: number): string {
  if (pct >= 90) return "Top 10%";
  if (pct >= 75) return "Top 25%";
  if (pct >= 50) return "Above median";
  if (pct >= 25) return "Below median";
  return "Bottom 25%";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetricHoverProps {
  /** Metric ID from the registry */
  metric: string;
  /** The peptide whose value is being shown (optional for aggregate views) */
  peptide?: Peptide;
  /** The specific value being displayed */
  value?: number | null;
  /** Children — the element that triggers the hover */
  children: React.ReactNode;
  /** Additional class on trigger */
  className?: string;
  /** Side for hover card placement */
  side?: "top" | "bottom" | "left" | "right";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricHover({
  metric: metricId,
  peptide,
  value,
  children,
  className,
  side = "top",
}: MetricHoverProps) {
  const entry = getMetric(metricId);
  const peptides = useDatasetStore((s) => s.peptides);
  const stats = useDatasetStore((s) => s.stats);

  // Resolve the display value: explicit prop > extracted from peptide
  const displayValue = useMemo(() => {
    if (value !== null && value !== undefined) return value;
    if (peptide && entry) return entry.getValue(peptide) ?? null;
    return null;
  }, [value, peptide, entry]);

  // Collect all numeric values for this metric across the database
  const allValues = useMemo(() => {
    if (!entry) return [];
    return peptides
      .map((p) => entry.getValue(p))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  }, [entry, peptides]);

  // Database mean
  const dbMean = useMemo(() => {
    if (!entry?.getMean || !stats) return null;
    return entry.getMean(stats) ?? null;
  }, [entry, stats]);

  // Percentile
  const percentile = useMemo(() => {
    if (displayValue === null || allValues.length === 0) return null;
    return computePercentile(allValues, displayValue);
  }, [displayValue, allValues]);

  // Unknown metric fallback
  if (!entry) {
    return (
      <HoverCard openDelay={250} closeDelay={0}>
        <HoverCardTrigger asChild className={className}>
          {children}
        </HoverCardTrigger>
        <HoverCardContent side={side} className="w-56">
          <p className="text-sm text-muted-foreground">
            Unknown metric: <code className="text-xs">{metricId}</code>
          </p>
        </HoverCardContent>
      </HoverCard>
    );
  }

  const hasValue = displayValue !== null && displayValue !== undefined;
  const accentColor = entry.color ?? "hsl(var(--primary))";

  return (
    <HoverCard openDelay={250} closeDelay={0}>
      <HoverCardTrigger asChild className={className}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side={side} className="w-72 space-y-2">
        {/* 1. Title */}
        <h4 className="text-sm font-semibold leading-tight">{entry.name}</h4>

        {/* 2. Definition */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {entry.definition}
        </p>

        {/* 3-5: Value, context, distribution — only when a specific value is available */}
        {hasValue && (
          <>
            {/* 3. This value */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono">
                {entry.format(displayValue)}
              </span>
              {entry.unit && (
                <span className="text-xs text-muted-foreground">{entry.unit}</span>
              )}
            </div>

            {/* 4. Context: mean + percentile */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {dbMean !== null && (
                <span>
                  Database mean: {entry.format(dbMean)}
                </span>
              )}
              {dbMean !== null && percentile !== null && (
                <span aria-hidden="true">·</span>
              )}
              {percentile !== null && <span>{percentileBand(percentile)}</span>}
            </div>

            {/* 5. Mini distribution */}
            {allValues.length > 1 && (
              <MiniDistribution
                values={allValues}
                highlight={displayValue}
                color={accentColor}
              />
            )}
          </>
        )}

        {/* 6. Interpretation */}
        {entry.interpretation && (
          <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
            {entry.interpretation}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
