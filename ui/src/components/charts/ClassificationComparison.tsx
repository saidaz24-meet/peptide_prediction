/**
 * ClassificationComparison — Generalized classification-group comparison chart.
 *
 * Handles any categorical grouping (SSW, Helix, etc.) without separate ad-hoc
 * charts. Each ClassificationScheme defines how to bucket peptides into groups,
 * and each ComparisonMetric defines a numeric value to aggregate per group.
 *
 * Rendering: Grouped bar chart with one cluster per metric, bars colored per
 * group. Tooltips show group | metric | value | n.
 *
 * Pre-built classification configs exported: SSW_CLASSIFICATION, HELIX_CLASSIFICATION.
 */

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/chartConfig";
import type { Peptide } from "@/types/peptide";

// ── Types ──

export interface ClassificationScheme {
  id: string;
  label: string;
  getGroup: (p: Peptide) => string | null; // null = excluded from comparison
  groupOrder?: string[]; // controls bar order
  colors?: Record<string, string>; // group name → color
}

export interface ComparisonMetric {
  id: string;
  label: string;
  unit?: string;
  getValue: (p: Peptide) => number | null | undefined;
}

export interface ClassificationComparisonProps {
  peptides: Peptide[];
  classification: ClassificationScheme;
  metrics: ComparisonMetric[];
  aggregation?: "mean" | "median"; // default 'mean'
  showSampleSize?: boolean; // default true — n=X label per group
  height?: number; // default 350
  onGroupClick?: (groupName: string, peptideIds: string[]) => void;
}

// ── Pre-built classification configs ──

// Color scheme: positive findings (SSW / Helix / FF-*) get green; negative
// (No SSW / No Helix) gets brown-orange. Per Peleg Drive comment on the
// Cohort Comparison slide (2026-06-03): "SSW should be green, since this is
// a more positive color to match the positive results."
const POS_NEG_COLORS = {
  noFinding: "hsl(25 85% 50%)", // brown-orange
  finding: "hsl(142 60% 50%)", // medium green
  ffFinding: "hsl(142 58% 36%)", // darker green
};

export const SSW_CLASSIFICATION: ClassificationScheme = {
  id: "ssw",
  label: "SSW Status",
  getGroup: (p) => {
    if (p.ffSswFlag === 1) return "FF-SSW";
    if (p.sswPrediction === 1) return "SSW";
    return "No SSW";
  },
  groupOrder: ["No SSW", "SSW", "FF-SSW"],
  colors: {
    "No SSW": POS_NEG_COLORS.noFinding,
    SSW: POS_NEG_COLORS.finding,
    "FF-SSW": POS_NEG_COLORS.ffFinding,
  },
};

export const HELIX_CLASSIFICATION: ClassificationScheme = {
  id: "helix",
  label: "Helix Status",
  getGroup: (p) => {
    if (p.ffHelixFlag === 1) return "FF-Helix";
    // Check if helical via s4predHelixPercent > 50
    if ((p.s4predHelixPercent ?? 0) > 50) return "Helix";
    return "No Helix";
  },
  groupOrder: ["No Helix", "Helix", "FF-Helix"],
  colors: {
    "No Helix": POS_NEG_COLORS.noFinding,
    Helix: POS_NEG_COLORS.finding,
    "FF-Helix": POS_NEG_COLORS.ffFinding,
  },
};

// PELEG-Q-FIX-022: |Charge| loses biological information (positive vs negative matters).
// Current implementation uses absolute charge. Awaiting Peleg/Alex decision on
// whether to show signed charge or split into positive/negative metrics.

// ── Helpers ──

const DEFAULT_GROUP_COLORS = [
  CHART_COLORS.scatterPrimary,
  CHART_COLORS.scatterSecondary,
  CHART_COLORS.scatterTertiary,
  CHART_COLORS.helix,
  CHART_COLORS.beta,
];

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface GroupData {
  name: string;
  peptideIds: string[];
  values: Map<string, number[]>; // metric id → raw values
}

interface ChartRow {
  metric: string;
  metricLabel: string;
  [groupName: string]: string | number; // group values + n_groupName
}

// ── Component ──

export function ClassificationComparison({
  peptides,
  classification,
  metrics,
  aggregation = "mean",
  showSampleSize = true,
  height = 350,
  onGroupClick,
}: ClassificationComparisonProps) {
  // Build groups
  const { groups, groupNames } = useMemo(() => {
    const groupMap = new Map<string, GroupData>();

    for (const p of peptides) {
      const groupName = classification.getGroup(p);
      if (groupName === null) continue;

      let group = groupMap.get(groupName);
      if (!group) {
        group = { name: groupName, peptideIds: [], values: new Map() };
        groupMap.set(groupName, group);
      }
      group.peptideIds.push(p.id);

      for (const metric of metrics) {
        const val = metric.getValue(p);
        if (val != null) {
          let arr = group.values.get(metric.id);
          if (!arr) {
            arr = [];
            group.values.set(metric.id, arr);
          }
          arr.push(val);
        }
      }
    }

    // Determine group order
    const order = classification.groupOrder ?? [...groupMap.keys()];
    // Only include groups that exist in data OR are in groupOrder
    const orderedNames = order.filter(
      (name) => groupMap.has(name) || classification.groupOrder?.includes(name)
    );

    return { groups: groupMap, groupNames: orderedNames };
  }, [peptides, classification, metrics]);

  // Build chart data: one row per metric
  const chartData = useMemo<ChartRow[]>(() => {
    const agg = aggregation === "median" ? computeMedian : computeMean;

    return metrics.map((metric) => {
      const row: ChartRow = {
        metric: metric.id,
        metricLabel: metric.label,
      };

      for (const gName of groupNames) {
        const group = groups.get(gName);
        const values = group?.values.get(metric.id) ?? [];
        row[gName] = values.length > 0 ? Number(agg(values).toFixed(4)) : 0;
        row[`n_${gName}`] = group?.peptideIds.length ?? 0;
      }

      return row;
    });
  }, [metrics, groupNames, groups, aggregation]);

  // Resolve group colors
  const groupColors = useMemo(() => {
    const colors: Record<string, string> = {};
    groupNames.forEach((name, i) => {
      colors[name] =
        classification.colors?.[name] ?? DEFAULT_GROUP_COLORS[i % DEFAULT_GROUP_COLORS.length];
    });
    return colors;
  }, [groupNames, classification.colors]);

  // Empty state
  if (peptides.length === 0 || groupNames.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const yLabel = aggregation === "median" ? "Median value" : "Mean value";
  const chartConfig = Object.fromEntries(
    groupNames.map((name) => [name, { label: name, color: groupColors[name] }])
  );

  return (
    <div>
      <ChartContainer config={chartConfig} className={`h-[${height}px]`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, bottom: 35, left: 40 }}
            barGap={2}
            barCategoryGap="35%"
          >
            <CartesianGrid strokeOpacity={0.3} />
            <XAxis
              dataKey="metricLabel"
              tick={{ fontSize: 11 }}
              label={{
                value: "Metric",
                position: "insideBottom",
                offset: -20,
                fontSize: 12,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <YAxis
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: -5,
                fontSize: 12,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <ChartTooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const row = payload[0]?.payload as ChartRow | undefined;
                if (!row) return null;

                return (
                  <div className="bg-background border border-border rounded p-2 text-xs space-y-1">
                    <p className="font-medium">{row.metricLabel}</p>
                    {payload.map((entry) => {
                      const groupName = entry.dataKey as string;
                      const value = entry.value as number;
                      const n = row[`n_${groupName}`] as number;
                      return (
                        <p key={groupName} style={{ color: entry.color }}>
                          {groupName}: {value.toFixed(3)}
                          {showSampleSize ? ` (n=${n})` : ""}
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
            {groupNames.map((groupName) => (
              <Bar
                key={groupName}
                dataKey={groupName}
                fill={groupColors[groupName]}
                cursor={onGroupClick ? "pointer" : undefined}
                onClick={(_: unknown) => {
                  const group = groups.get(groupName);
                  if (group && onGroupClick) {
                    onGroupClick(groupName, group.peptideIds);
                  }
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Sample size legend */}
      {showSampleSize && (
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          {groupNames.map((name) => {
            const group = groups.get(name);
            const n = group?.peptideIds.length ?? 0;
            return (
              <span key={name} style={{ color: groupColors[name] }}>
                {name}: n={n}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClassificationComparison;
