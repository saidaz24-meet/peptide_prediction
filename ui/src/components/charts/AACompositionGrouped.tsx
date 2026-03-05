import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend as RechartsLegend,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ExpandableChart } from "@/components/ExpandableChart";
import { CHART_COLORS } from "@/lib/chartConfig";
import type { Peptide } from "@/types/peptide";

const AA_CATEGORIES: Record<string, string> = {
  I: "Hydrophobic",
  V: "Hydrophobic",
  L: "Hydrophobic",
  M: "Hydrophobic",
  C: "Hydrophobic",
  F: "Aromatic",
  W: "Aromatic",
  Y: "Aromatic",
  K: "Basic (+)",
  R: "Basic (+)",
  H: "Basic (+)",
  D: "Acidic (-)",
  E: "Acidic (-)",
  N: "Polar",
  Q: "Polar",
  S: "Polar",
  T: "Polar",
  A: "Small",
  G: "Small",
  P: "Helix breaker",
};

const CATEGORIES = [
  "Hydrophobic",
  "Aromatic",
  "Basic (+)",
  "Acidic (-)",
  "Polar",
  "Small",
  "Helix breaker",
];

type GroupKey = "noSsw" | "ssw" | "ffSsw" | "noHelix" | "helix" | "ffHelix";

const GROUP_COLORS: Record<GroupKey, string> = {
  noSsw: CHART_COLORS.sswUncertain,
  ssw: CHART_COLORS.sswPositive,
  ffSsw: "#A03000",
  noHelix: "#C0C0C0",
  helix: CHART_COLORS.helix,
  ffHelix: "#004A75",
};

const GROUP_LABELS: Record<GroupKey, string> = {
  noSsw: "No SSW",
  ssw: "SSW",
  ffSsw: "FF-SSW",
  noHelix: "No Helix",
  helix: "Helix+",
  ffHelix: "FF-Helix",
};

function getAAComposition(peptides: Peptide[]): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const p of peptides) {
    for (const ch of p.sequence.toUpperCase()) {
      const cat = AA_CATEGORIES[ch];
      if (cat) {
        counts[cat] = (counts[cat] ?? 0) + 1;
        total++;
      }
    }
  }
  const pcts: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    pcts[cat] = total > 0 ? ((counts[cat] ?? 0) / total) * 100 : 0;
  }
  return pcts;
}

interface AACompositionGroupedProps {
  peptides: Peptide[];
}

/**
 * Grouped bar chart comparing amino acid category percentages
 * across 6 classification groups (No SSW, SSW, FF-SSW, No Helix, Helix, FF-Helix).
 */
export function AACompositionGrouped({ peptides }: AACompositionGroupedProps) {
  const { data, activeGroupKeys } = useMemo(() => {
    const groups: Record<GroupKey, Peptide[]> = {
      noSsw: peptides.filter((p) => p.sswPrediction !== 1),
      ssw: peptides.filter((p) => p.sswPrediction === 1),
      ffSsw: peptides.filter((p) => p.ffSswFlag === 1),
      noHelix: peptides.filter((p) => p.s4predHelixPrediction !== 1),
      helix: peptides.filter((p) => p.s4predHelixPrediction === 1),
      ffHelix: peptides.filter((p) => p.ffHelixFlag === 1),
    };

    // Only include groups with peptides
    const active = (Object.keys(groups) as GroupKey[]).filter((k) => groups[k].length > 0);

    const compositions = Object.fromEntries(
      active.map((key) => [key, getAAComposition(groups[key])])
    ) as Record<GroupKey, Record<string, number>>;

    const chartData = CATEGORIES.map((cat) => {
      const row: Record<string, any> = { category: cat };
      for (const key of active) {
        row[key] = compositions[key]?.[cat] ?? 0;
      }
      return row;
    });

    return { data: chartData, activeGroupKeys: active };
  }, [peptides]);

  if (activeGroupKeys.length === 0) return null;

  const chartConfig = Object.fromEntries(
    activeGroupKeys.map((k) => [k, { label: GROUP_LABELS[k], color: GROUP_COLORS[k] }])
  );

  return (
    <ExpandableChart
      title="Amino Acid Composition by Classification"
      description="AA category % across pipeline classification groups"
      peptides={peptides}
    >
      {data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
          No sequence data available
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 25, left: 30 }}>
              <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <ChartTooltip
                content={({ payload, label }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="bg-background border border-border rounded p-2 text-xs space-y-0.5">
                      <p className="font-medium">{label}</p>
                      {payload.map((entry: any) => (
                        <p key={entry.dataKey} style={{ color: entry.fill }}>
                          {GROUP_LABELS[entry.dataKey as GroupKey]}:{" "}
                          {Number(entry.value).toFixed(1)}%
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {activeGroupKeys.map((key) => (
                <Bar key={key} dataKey={key} name={GROUP_LABELS[key]} fill={GROUP_COLORS[key]} />
              ))}
              <RechartsLegend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </ExpandableChart>
  );
}
