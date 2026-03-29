import { motion } from "framer-motion";
import { Info, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Legend as RechartsLegend,
  Cell,
  ComposedChart,
  Scatter,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ExpandableChart } from "@/components/ExpandableChart";
import { Peptide } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { CHART_COLORS } from "@/lib/chartConfig";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { EulerDiagram } from "@/components/charts/EulerDiagram";
import { UpsetMatrix } from "@/components/charts/UpsetMatrix";
import { AACompositionGrouped } from "@/components/charts/AACompositionGrouped";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResultsChartsProps {
  peptides: Peptide[];
  providerStatus?: {
    tango?: {
      status: string;
      reason?: string | null;
      stats?: { requested: number; parsed_ok: number; parsed_bad: number };
    };
    s4pred?: {
      status: string;
      reason?: string | null;
      stats?: { requested: number; parsed_ok: number; parsed_bad: number };
    };
  };
  thresholds?: ResolvedThresholds;
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-center text-sm text-muted-foreground">
      <div>
        <div className="font-medium">{title}</div>
        {subtitle && <div className="mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

export function ResultsCharts({ peptides, providerStatus }: ResultsChartsProps) {
  // ── Hydrophobicity distribution ──
  const H = peptides.map((p) => p.hydrophobicity).filter((v) => Number.isFinite(v));
  const minH = H.length ? Math.min(...H) : 0;
  const maxH = H.length ? Math.max(...H) : 0;
  const span = Math.max(1e-6, maxH - minH);
  const binSize = span / 10;
  const hydrophobicityBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minH + i * binSize;
    const binEnd = binStart + binSize;
    const matching = peptides.filter((p) => {
      const v = p.hydrophobicity;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return {
      range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`,
      count: matching.length,
      ids: matching.map((p) => p.id),
      binStart,
    };
  }).sort((a, b) => a.binStart - b.binStart);

  // ── μH distribution ──
  const muHValues = peptides
    .map((p) => p.muH)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const minMuH = muHValues.length ? Math.min(...muHValues) : 0;
  const maxMuH = muHValues.length ? Math.max(...muHValues) : 1;
  const muHSpan = Math.max(1e-6, maxMuH - minMuH);
  const muHBinSize = muHSpan / 10;
  const muHBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minMuH + i * muHBinSize;
    const binEnd = binStart + muHBinSize;
    const matching = peptides.filter((p) => {
      const v = p.muH;
      if (typeof v !== "number" || !Number.isFinite(v)) return false;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return {
      range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`,
      count: matching.length,
      ids: matching.map((p) => p.id),
      binStart,
    };
  }).sort((a, b) => a.binStart - b.binStart);

  // ── SSW+ vs SSW- cohort comparison ──
  const positiveGroup = peptides.filter((p) => p.sswPrediction === 1);
  const negativeGroup = peptides.filter((p) => p.sswPrediction === -1);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const groupedBarMetrics = (() => {
    if (positiveGroup.length === 0 && negativeGroup.length === 0) return [];
    type G = typeof peptides;
    const raw = [
      {
        metric: "Hydrophobicity",
        pos: mean(positiveGroup.map((p) => p.hydrophobicity)),
        neg: mean(negativeGroup.map((p) => p.hydrophobicity)),
        all: mean(peptides.map((p) => p.hydrophobicity)),
      },
      {
        metric: "|Charge|",
        pos: mean(positiveGroup.map((p) => Math.abs(p.charge ?? 0))),
        neg: mean(negativeGroup.map((p) => Math.abs(p.charge ?? 0))),
        all: mean(peptides.map((p) => Math.abs(p.charge ?? 0))),
      },
      {
        metric: "Length",
        pos: mean(
          (positiveGroup as G)
            .map((p) => p.length)
            .filter((v): v is number => typeof v === "number")
        ),
        neg: mean(
          (negativeGroup as G)
            .map((p) => p.length)
            .filter((v): v is number => typeof v === "number")
        ),
        all: mean(
          (peptides as G).map((p) => p.length).filter((v): v is number => typeof v === "number")
        ),
      },
      {
        metric: "μH",
        pos: mean(positiveGroup.map((p) => (typeof p.muH === "number" ? p.muH : 0))),
        neg: mean(negativeGroup.map((p) => (typeof p.muH === "number" ? p.muH : 0))),
        all: mean(peptides.map((p) => (typeof p.muH === "number" ? p.muH : 0))),
      },
      {
        metric: "FF-Helix %",
        pos: mean(
          positiveGroup.map((p) => (typeof p.ffHelixPercent === "number" ? p.ffHelixPercent : 0))
        ),
        neg: mean(
          negativeGroup.map((p) => (typeof p.ffHelixPercent === "number" ? p.ffHelixPercent : 0))
        ),
        all: mean(
          peptides.map((p) => (typeof p.ffHelixPercent === "number" ? p.ffHelixPercent : 0))
        ),
      },
    ];
    return raw.map((r) => {
      const denom = Math.abs(r.all) || 1;
      return {
        metric: r.metric,
        posPctDiff: ((r.pos - r.all) / denom) * 100,
        negPctDiff: ((r.neg - r.all) / denom) * 100,
        posRaw: r.pos,
        negRaw: r.neg,
        allRaw: r.all,
      };
    });
  })();

  // ── Sequence length distribution ──
  const lengths = peptides
    .map((p) => p.length)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const minLen = lengths.length ? Math.min(...lengths) : 0;
  const maxLen = lengths.length ? Math.max(...lengths) : 100;
  const lenSpan = Math.max(1, maxLen - minLen);
  const lenBinSize = Math.max(1, Math.ceil(lenSpan / 10));
  const lengthBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minLen + i * lenBinSize;
    const binEnd = binStart + lenBinSize;
    const matching = peptides.filter((p) => {
      const v = p.length;
      if (typeof v !== "number") return false;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    });
    return {
      range: `${binStart}–${binEnd}`,
      count: matching.length,
      ids: matching.map((p) => p.id),
      binStart,
    };
  }).filter((bin) => bin.count > 0 || bin.binStart <= maxLen);

  // ── Aggregation Propensity Distribution ──
  const AGG_BINS = [
    { label: "0–5%", min: 0, max: 5, color: "#22c55e" },
    { label: "5–10%", min: 5, max: 10, color: "#84cc16" },
    { label: "10–20%", min: 10, max: 20, color: "#eab308" },
    { label: "20–40%", min: 20, max: 40, color: "#f97316" },
    { label: "40–60%", min: 40, max: 60, color: "#ef4444" },
    { label: "60–80%", min: 60, max: 80, color: "#dc2626" },
    { label: "80–100%", min: 80, max: 100.01, color: "#991b1b" },
  ];
  const aggWithData = peptides.filter(
    (p) => typeof p.tangoAggMax === "number" && Number.isFinite(p.tangoAggMax as number)
  );
  const aggDistBins = AGG_BINS.map((bin) => {
    const matching = aggWithData.filter((p) => {
      const v = p.tangoAggMax as number;
      return v >= bin.min && v < bin.max;
    });
    return {
      label: bin.label,
      count: matching.length,
      ids: matching.map((p) => p.id),
      color: bin.color,
    };
  });

  // ── Provider status ──
  const providers = [
    {
      name: "TANGO",
      status: providerStatus?.tango?.status || "OFF",
      reason: providerStatus?.tango?.reason,
      stats: providerStatus?.tango?.stats,
    },
    {
      name: "S4PRED",
      status: providerStatus?.s4pred?.status || "OFF",
      reason: providerStatus?.s4pred?.reason,
      stats: providerStatus?.s4pred?.stats,
    },
  ];

  const chartConfig = {
    hydrophobicity: { label: "Hydrophobicity", color: CHART_COLORS.scatterPrimary },
  };

  const { selectBin } = useChartSelection();

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ═══ Row 1: Euler Diagram + UpSet Matrix ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <EulerDiagram peptides={peptides} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <UpsetMatrix peptides={peptides} />
      </motion.div>

      {/* ═══ Row 2: Hydrophobicity + μH Distribution ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ExpandableChart
          title="Hydrophobicity Distribution"
          description="Frequency distribution of hydrophobicity values"
          peptides={peptides}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Histogram of mean hydrophobicity across all peptides. Negative values correspond
                  to more hydrophilic peptides; positive values are more hydrophobic.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {peptides.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hydrophobicityBins}
                  margin={{ top: 20, right: 30, bottom: 25, left: 30 }}
                >
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split("–")[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>Range: {range}</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.scatterPrimary}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = hydrophobicityBins[idx];
                      if (bin?.ids?.length)
                        selectBin({
                          ids: bin.ids,
                          binLabel: bin.range,
                          source: "Hydrophobicity Distribution",
                        });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <ExpandableChart
          title="Hydrophobic Moment (μH) Distribution"
          description="Frequency distribution of amphipathic character"
          peptides={peptides}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Distribution of hydrophobic moment (μH). Values above 0.5 indicate amphipathic
                  character — the peptide has distinct hydrophobic and hydrophilic faces.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
          footer={
            muHValues.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                {muHValues.filter((v) => v > 0.5).length} of {muHValues.length} peptides (
                {((muHValues.filter((v) => v > 0.5).length / muHValues.length) * 100).toFixed(0)}%)
                above amphipathic threshold (μH &gt; 0.5)
              </div>
            ) : undefined
          }
        >
          {muHValues.length === 0 ? (
            <EmptyState title="No μH data" subtitle="μH requires sequence data to compute." />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muHBins} margin={{ top: 20, right: 30, bottom: 25, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split("–")[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ReferenceLine
                    x={muHBins.findIndex((b) => b.binStart <= 0.5 && b.binStart + muHBinSize > 0.5)}
                    stroke="#eab308"
                    strokeDasharray="6 3"
                  />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>μH: {range}</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.amphipathic}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = muHBins[idx];
                      if (bin?.ids?.length)
                        selectBin({
                          ids: bin.ids,
                          binLabel: bin.range,
                          source: "Hydrophobic Moment (μH) Distribution",
                        });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {/* ═══ Row 3: Cohort Comparison + AA Composition ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ExpandableChart
          title="Cohort Comparison"
          description="SSW vs No SSW group means (% difference from overall mean)"
          peptides={peptides}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Bars show % difference from overall mean for SSW and No SSW groups. Positive =
                  above average. Hover for raw values.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {groupedBarMetrics.length === 0 ? (
            <EmptyState title="Not enough data to compare groups" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedBarMetrics}
                  margin={{ top: 20, right: 30, bottom: 30, left: 30 }}
                >
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs space-y-1">
                          <p className="font-medium">{item.metric}</p>
                          <p className="text-green-600">
                            SSW: {Number(item.posRaw).toFixed(3)} ({item.posPctDiff > 0 ? "+" : ""}
                            {Number(item.posPctDiff).toFixed(1)}%)
                          </p>
                          <p className="text-red-600">
                            No SSW: {Number(item.negRaw).toFixed(3)} (
                            {item.negPctDiff > 0 ? "+" : ""}
                            {Number(item.negPctDiff).toFixed(1)}%)
                          </p>
                          <p className="text-muted-foreground">
                            Mean: {Number(item.allRaw).toFixed(3)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="posPctDiff" name="SSW" fill={CHART_COLORS.sswPositive} />
                  <Bar dataKey="negPctDiff" name="No SSW" fill={CHART_COLORS.sswNegative} />
                  <RechartsLegend />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <AACompositionGrouped peptides={peptides} />
      </motion.div>

      {/* ═══ Row 4: Sequence Length + Aggregation Risk Overview ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <ExpandableChart
          title="Sequence Length Distribution"
          description="Distribution of peptide lengths in amino acids"
          peptides={peptides}
          headerRight={
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Histogram showing the distribution of peptide sequence lengths. Useful for
                  understanding the dataset composition and identifying outliers.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          }
        >
          {lengths.length === 0 ? (
            <EmptyState title="No length data" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lengthBins} margin={{ top: 20, right: 30, bottom: 25, left: 30 }}>
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.split("–")[0]}
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const { range, count } = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p>Length: {range} aa</p>
                            <p>Count: {count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.scatterTertiary}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = lengthBins[idx];
                      if (bin?.ids?.length)
                        selectBin({
                          ids: bin.ids,
                          binLabel: bin.range,
                          source: "Sequence Length Distribution",
                        });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </ExpandableChart>
      </motion.div>

      {aggWithData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ExpandableChart
            title="Aggregation Propensity Distribution"
            description="How peptides distribute across aggregation score ranges"
            peptides={peptides}
            headerRight={
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Distribution of peak TANGO aggregation scores. Green: low (&lt;5%), Yellow:
                    moderate (5-20%), Red: high (&gt;20%). Click a bar to view peptides.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            }
          >
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={aggDistBins}
                  margin={{ top: 20, right: 30, bottom: 25, left: 30 }}
                >
                  <CartesianGrid stroke="#e5e5e5" strokeOpacity={0.8} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    content={({ payload }) => {
                      const item = payload?.[0]?.payload;
                      if (!item) return null;
                      return (
                        <div className="bg-background border border-border rounded p-2 text-xs">
                          <p className="font-medium">Agg Max: {item.label}</p>
                          <p>
                            {item.count} peptide{item.count !== 1 ? "s" : ""}
                          </p>
                          {item.ids.length > 0 && item.ids.length <= 5 && (
                            <p className="text-muted-foreground mt-1">{item.ids.join(", ")}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    barSize={3}
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = aggDistBins[idx];
                      if (bin?.ids?.length)
                        selectBin({
                          ids: bin.ids,
                          binLabel: `Agg Max ${bin.label}`,
                          source: "Aggregation Propensity Distribution",
                        });
                    }}
                  >
                    {aggDistBins.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                  <Scatter
                    dataKey="count"
                    cursor="pointer"
                    onClick={(_: any, idx: number) => {
                      const bin = aggDistBins[idx];
                      if (bin?.ids?.length)
                        selectBin({
                          ids: bin.ids,
                          binLabel: `Agg Max ${bin.label}`,
                          source: "Aggregation Propensity Distribution",
                        });
                    }}
                  >
                    {aggDistBins.map((d, i) => (
                      <Cell key={i} fill={d.color} r={6} />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </ExpandableChart>
        </motion.div>
      )}

      {/* ═══ Row 5: Correlation Heatmap — full width (rendered by parent) ═══ */}

      {/* ═══ Row 6: Provider Status (collapsed, full width) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="lg:col-span-2"
      >
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2 select-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            <span>Provider Status</span>
            <div className="flex gap-1.5">
              {providers.map((p) => (
                <span
                  key={p.name}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                    p.status === "AVAILABLE"
                      ? "bg-green-500"
                      : p.status === "PARTIAL"
                        ? "bg-yellow-500"
                        : p.status === "UNAVAILABLE"
                          ? "bg-red-500"
                          : "bg-gray-400"
                  }`}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {providers.map((provider) => (
              <div key={provider.name} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{provider.name}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                      provider.status === "AVAILABLE"
                        ? "bg-green-500"
                        : provider.status === "PARTIAL"
                          ? "bg-yellow-500"
                          : provider.status === "UNAVAILABLE"
                            ? "bg-red-500"
                            : "bg-gray-400"
                    }`}
                  >
                    {provider.status}
                  </span>
                </div>
                {provider.reason && (
                  <p className="text-xs text-muted-foreground">{provider.reason}</p>
                )}
                {provider.stats && (
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>Req: {provider.stats.requested}</span>
                    <span className="text-green-600">OK: {provider.stats.parsed_ok}</span>
                    {provider.stats.parsed_bad > 0 && (
                      <span className="text-red-600">Fail: {provider.stats.parsed_bad}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      </motion.div>
    </div>
  );
}
