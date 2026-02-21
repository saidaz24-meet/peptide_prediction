import { motion } from 'framer-motion';
import { Info, ChevronRight } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend as RechartsLegend,
  Tooltip, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Peptide } from '@/types/peptide';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ResultsChartsProps {
  peptides: Peptide[];
  providerStatus?: {
    tango?: { status: string; reason?: string | null; stats?: { requested: number; parsed_ok: number; parsed_bad: number } };
    s4pred?: { status: string; reason?: string | null; stats?: { requested: number; parsed_ok: number; parsed_bad: number } };
  };
}

const COLORS = {
  chameleonPositive: 'hsl(var(--chameleon-positive))',
  chameleonNegative: 'hsl(var(--chameleon-negative))',
  primary: 'hsl(var(--primary))',
  muted: 'hsl(var(--muted-foreground))',
};

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
  // Scatter data: require μH
  const scatterData = peptides
    .filter(p => typeof p.muH === 'number' && Number.isFinite(p.muH))
    .map(p => ({
      hydrophobicity: p.hydrophobicity,
      muH: p.muH as number,
      ssw: p.sswPrediction,
      id: p.id,
    }));

  // Charge vs Length scatter data
  const chargeLengthData = peptides
    .filter(p => typeof p.charge === 'number' && typeof p.length === 'number')
    .map(p => ({
      charge: p.charge as number,
      length: p.length as number,
      ssw: p.sswPrediction,
      id: p.id,
    }));

  // Hydrophobicity distribution (safe when all equal)
  const H = peptides.map(p => p.hydrophobicity).filter(v => Number.isFinite(v));
  const minH = H.length ? Math.min(...H) : 0;
  const maxH = H.length ? Math.max(...H) : 0;
  const span = Math.max(1e-6, maxH - minH);
  const binSize = span / 10;
  const hydrophobicityBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minH + i * binSize;
    const binEnd = binStart + binSize;
    const count = peptides.filter(p => {
      const v = p.hydrophobicity;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    }).length;
    // Format bin labels with 2 decimals, ordered left→right (start to end)
    return {
      range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`,
      count,
      binStart, // Use for sorting if needed
    };
  }).sort((a, b) => a.binStart - b.binStart); // Ensure left→right ordering

  // μH distribution histogram (same pattern as hydrophobicity)
  const muHValues = peptides.map(p => p.muH).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const minMuH = muHValues.length ? Math.min(...muHValues) : 0;
  const maxMuH = muHValues.length ? Math.max(...muHValues) : 1;
  const muHSpan = Math.max(1e-6, maxMuH - minMuH);
  const muHBinSize = muHSpan / 10;
  const muHBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minMuH + i * muHBinSize;
    const binEnd = binStart + muHBinSize;
    const count = muHValues.filter(v =>
      i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd
    ).length;
    return { range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`, count, binStart };
  }).sort((a, b) => a.binStart - b.binStart);

  // SSW distribution (null rows excluded — they have no prediction)
  const pos = peptides.filter(p => p.sswPrediction === 1).length;
  const neg = peptides.filter(p => p.sswPrediction === -1).length;
  const unc = peptides.filter(p => p.sswPrediction === 0).length;
  const sswDistribution = [
    { name: 'SSW Positive', value: pos, color: COLORS.chameleonPositive },
    { name: 'SSW Negative', value: neg, color: COLORS.chameleonNegative },
    { name: 'Uncertain', value: unc, color: COLORS.muted },
  ].filter(d => d.value > 0);

  // SSW predictor agreement stats (TANGO vs S4PRED)
  const bothSSW = peptides.filter(p =>
    p.sswPrediction != null && p.sswPrediction !== 0 &&
    p.s4predSswPrediction != null && p.s4predSswPrediction !== 0
  );
  const sswAgree = bothSSW.filter(p => p.sswPrediction === p.s4predSswPrediction).length;
  const sswDisagree = bothSSW.length - sswAgree;
  const sswAgreePct = bothSSW.length > 0 ? ((sswAgree / bothSSW.length) * 100).toFixed(0) : null;

  // SSW+ vs SSW- group comparison (grouped bar chart)
  const positiveGroup = peptides.filter(p => p.sswPrediction === 1);
  const negativeGroup = peptides.filter(p => p.sswPrediction === -1);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const groupedBarMetrics = (() => {
    if (positiveGroup.length === 0 && negativeGroup.length === 0) return [];
    type G = typeof peptides;
    const raw = [
      { metric: 'Hydrophobicity', pos: mean(positiveGroup.map(p => p.hydrophobicity)), neg: mean(negativeGroup.map(p => p.hydrophobicity)) },
      { metric: '|Charge|', pos: mean(positiveGroup.map(p => Math.abs(p.charge ?? 0))), neg: mean(negativeGroup.map(p => Math.abs(p.charge ?? 0))) },
      { metric: 'Length', pos: mean((positiveGroup as G).map(p => p.length).filter((v): v is number => typeof v === 'number')), neg: mean((negativeGroup as G).map(p => p.length).filter((v): v is number => typeof v === 'number')) },
      { metric: 'μH', pos: mean(positiveGroup.map(p => typeof p.muH === 'number' ? p.muH : 0)), neg: mean(negativeGroup.map(p => typeof p.muH === 'number' ? p.muH : 0)) },
      { metric: 'FF-Helix %', pos: mean(positiveGroup.map(p => typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : 0)), neg: mean(negativeGroup.map(p => typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent : 0)) },
    ];
    return raw.map(r => {
      const scale = Math.max(Math.abs(r.pos), Math.abs(r.neg)) || 1;
      return { metric: r.metric, posNorm: r.pos / scale, negNorm: r.neg / scale, posRaw: r.pos, negRaw: r.neg };
    });
  })();

  // FF-Helix % vs TANGO Aggregation Max scatter data
  const helixAggData = peptides
    .filter(p => typeof p.ffHelixPercent === 'number' && typeof p.tangoAggMax === 'number')
    .map(p => ({
      ffHelix: p.ffHelixPercent as number,
      aggMax: p.tangoAggMax as number,
      ssw: p.sswPrediction,
      id: p.id,
    }));

  // Aggregation risk overview (sorted by tangoAggMax desc, top 30)
  const aggOverviewData = peptides
    .filter(p => typeof p.tangoAggMax === 'number' && (p.tangoAggMax as number) > 0)
    .sort((a, b) => (b.tangoAggMax as number) - (a.tangoAggMax as number))
    .slice(0, 30)
    .map(p => ({
      id: p.id ?? '',
      aggMax: p.tangoAggMax as number,
      fill: (p.tangoAggMax as number) > 20 ? '#ef4444' : (p.tangoAggMax as number) > 5 ? '#eab308' : '#22c55e',
    }));
  const aggOverflowCount = Math.max(0,
    peptides.filter(p => typeof p.tangoAggMax === 'number' && (p.tangoAggMax as number) > 0).length - aggOverviewData.length
  );

  // Amino acid composition — HeliQuest-standard categories
  // (colors match HelicalWheel.tsx HeliQuest scheme)
  const AA_CATEGORIES: Record<string, { category: string; color: string }> = {
    I: { category: 'Hydrophobic', color: '#F4C430' },
    V: { category: 'Hydrophobic', color: '#F4C430' },
    L: { category: 'Hydrophobic', color: '#F4C430' },
    M: { category: 'Hydrophobic', color: '#F4C430' },
    C: { category: 'Hydrophobic', color: '#F4C430' },
    F: { category: 'Aromatic', color: '#F79318' },
    W: { category: 'Aromatic', color: '#F79318' },
    Y: { category: 'Aromatic', color: '#F79318' },
    K: { category: 'Basic (+)', color: '#4169E1' },
    R: { category: 'Basic (+)', color: '#4169E1' },
    H: { category: 'Basic (+)', color: '#4169E1' },
    D: { category: 'Acidic (−)', color: '#DC143C' },
    E: { category: 'Acidic (−)', color: '#DC143C' },
    N: { category: 'Polar', color: '#9370DB' },
    Q: { category: 'Polar', color: '#9370DB' },
    S: { category: 'Polar', color: '#9370DB' },
    T: { category: 'Polar', color: '#9370DB' },
    A: { category: 'Small', color: '#C8C8C8' },
    G: { category: 'Small', color: '#C8C8C8' },
    P: { category: 'Helix breaker', color: '#32CD32' },
  };
  const aaCompositionData = (() => {
    const allResidues = peptides.map(p => p.sequence).join('').toUpperCase();
    if (allResidues.length === 0) return [];
    const counts: Record<string, { count: number; color: string }> = {};
    for (const ch of allResidues) {
      const cat = AA_CATEGORIES[ch];
      if (!cat) continue;
      if (!counts[cat.category]) counts[cat.category] = { count: 0, color: cat.color };
      counts[cat.category].count++;
    }
    const total = allResidues.length;
    return Object.entries(counts)
      .map(([category, { count, color }]) => ({ category, count, pct: (count / total) * 100, color }))
      .sort((a, b) => b.count - a.count);
  })();

  // Sequence Length Distribution (histogram)
  const lengths = peptides.map(p => p.length).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const minLen = lengths.length ? Math.min(...lengths) : 0;
  const maxLen = lengths.length ? Math.max(...lengths) : 100;
  const lenSpan = Math.max(1, maxLen - minLen);
  const lenBinSize = Math.max(1, Math.ceil(lenSpan / 10));
  const lengthBins = Array.from({ length: 10 }, (_, i) => {
    const binStart = minLen + i * lenBinSize;
    const binEnd = binStart + lenBinSize;
    const count = peptides.filter(p => {
      const v = p.length;
      if (typeof v !== 'number') return false;
      return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
    }).length;
    return {
      range: `${binStart}–${binEnd}`,
      count,
      binStart,
    };
  }).filter(bin => bin.count > 0 || bin.binStart <= maxLen);

  // Provider status summary for dashboard
  const providers = [
    {
      name: 'TANGO',
      status: providerStatus?.tango?.status || 'OFF',
      reason: providerStatus?.tango?.reason,
      stats: providerStatus?.tango?.stats,
    },
    {
      name: 'S4PRED',
      status: providerStatus?.s4pred?.status || 'OFF',
      reason: providerStatus?.s4pred?.reason,
      stats: providerStatus?.s4pred?.stats,
    },
  ];

  const chartConfig = {
    hydrophobicity: { label: 'Hydrophobicity', color: COLORS.primary },
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Scatter: Hydrophobicity vs μH */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hydrophobicity vs Hydrophobic Moment</CardTitle>
                <CardDescription>Correlation between hydrophobicity and amphipathic character</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Each point is a peptide. The x-axis is its mean hydrophobicity (negative = more hydrophilic, positive = more hydrophobic). The y-axis is its hydrophobic moment (µH), which reflects how amphipathic the peptide is.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {scatterData.length === 0 ? (
              <EmptyState title="μH not available" subtitle="Upload a dataset or enable TANGO/S4PRED so μH can be computed." />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="hydrophobicity"
                      name="Hydrophobicity"
                      tickFormatter={(v) => parseFloat(v).toFixed(2)}
                    />
                    <YAxis
                      type="number"
                      dataKey="muH"
                      name="μH"
                      tickFormatter={(v) => parseFloat(v).toFixed(2)}
                    />
                    <ReferenceLine y={0.5} stroke="#94a3b8" strokeDasharray="6 3" label={{ value: 'Amphipathic', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                    <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="6 3" />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p className="font-medium">{item.id}</p>
                            <p>H: {parseFloat(item.hydrophobicity).toFixed(3)}</p>
                            <p>μH: {parseFloat(item.muH).toFixed(3)}</p>
                            <p>SSW: {item.ssw === 1 ? 'Positive' : item.ssw === -1 ? 'Negative' : 'N/A'}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData.filter(d => d.ssw === 1)} fill={COLORS.chameleonPositive} name="SSW +" />
                    <Scatter data={scatterData.filter(d => d.ssw === -1)} fill={COLORS.chameleonNegative} name="SSW −" />
                    <Scatter data={scatterData.filter(d => d.ssw !== 1 && d.ssw !== -1)} fill="#94a3b8" name="No SSW" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Hydrophobicity Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hydrophobicity Distribution</CardTitle>
                <CardDescription>Frequency distribution of hydrophobicity values</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Histogram of mean hydrophobicity across all peptides. Negative values correspond to more hydrophilic peptides; positive values are more hydrophobic.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {peptides.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hydrophobicityBins} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
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
                    <Bar dataKey="count" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* μH Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Hydrophobic Moment (μH) Distribution</CardTitle>
                <CardDescription>Frequency distribution of amphipathic character</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Distribution of hydrophobic moment (μH). Values above 0.5 indicate amphipathic character — the peptide has distinct hydrophobic and hydrophilic faces.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {muHValues.length === 0 ? (
              <EmptyState title="No μH data" subtitle="μH requires sequence data to compute." />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={muHBins} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis allowDecimals={false} />
                    <ReferenceLine x={muHBins.findIndex(b => b.binStart <= 0.5 && b.binStart + muHBinSize > 0.5)} stroke="#eab308" strokeDasharray="6 3" />
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
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            {muHValues.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                {muHValues.filter(v => v > 0.5).length} of {muHValues.length} peptides ({((muHValues.filter(v => v > 0.5).length / muHValues.length) * 100).toFixed(0)}%) above amphipathic threshold (μH &gt; 0.5)
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* SSW Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>TANGO SSW Distribution</CardTitle>
            <CardDescription>Structural switch predictions from TANGO aggregation analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {sswDistribution.length === 0 ? (
              <EmptyState title="No SSW predictions" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sswDistribution} cx="50%" cy="50%" outerRadius={82} dataKey="value"
                      label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                      {sswDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            {/* Predictor agreement note */}
            {bothSSW.length > 0 && (
              <div className="mt-3 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">TANGO vs S4PRED agreement: {sswAgreePct}% ({sswAgree}/{bothSSW.length} peptides)</span>
                </div>
                {sswDisagree > 0 && (
                  <p className="ml-5">
                    {sswDisagree} peptide{sswDisagree > 1 ? 's' : ''} show different SSW calls.
                    TANGO SSW reflects aggregation-correlated switching (primary for fibril research);
                    S4PRED SSW reflects pure secondary structure switching.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Cohort Comparison — SSW+ vs SSW- */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cohort Comparison</CardTitle>
                <CardDescription>Mean profiles: SSW+ vs SSW- (normalized, raw values in tooltip)</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Bars show mean values for TANGO SSW+ and SSW- groups, normalized per metric so they share a common scale. Hover for raw values.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {groupedBarMetrics.length === 0 ? (
              <EmptyState title="Not enough data to compare groups" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedBarMetrics} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis domain={[-1, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs space-y-1">
                            <p className="font-medium">{item.metric}</p>
                            <p className="text-green-600">SSW +: {Number(item.posRaw).toFixed(3)}</p>
                            <p className="text-red-600">SSW −: {Number(item.negRaw).toFixed(3)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="posNorm" name="SSW +" fill={COLORS.chameleonPositive} />
                    <Bar dataKey="negNorm" name="SSW −" fill={COLORS.chameleonNegative} />
                    <RechartsLegend />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charge vs Length */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Net Charge vs Sequence Length</CardTitle>
                <CardDescription>Charge landscape of the peptide cohort</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Net charge vs sequence length. Positive charge can enhance membrane interaction. Antimicrobial peptides typically cluster at positive charge / 12–50 aa.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {chargeLengthData.length === 0 ? (
              <EmptyState title="No charge/length data" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="length" name="Length (aa)" />
                    <YAxis type="number" dataKey="charge" name="Net Charge" />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="6 3" label={{ value: 'Neutral', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p className="font-medium">{item.id}</p>
                            <p>Length: {item.length} aa</p>
                            <p>Charge: {item.charge > 0 ? '+' : ''}{item.charge.toFixed(1)}</p>
                            <p>SSW: {item.ssw === 1 ? 'Positive' : item.ssw === -1 ? 'Negative' : 'N/A'}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={chargeLengthData.filter(d => d.ssw === 1)} fill={COLORS.chameleonPositive} name="SSW +" />
                    <Scatter data={chargeLengthData.filter(d => d.ssw === -1)} fill={COLORS.chameleonNegative} name="SSW −" />
                    <Scatter data={chargeLengthData.filter(d => d.ssw !== 1 && d.ssw !== -1)} fill="#94a3b8" name="No SSW" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* FF-Helix % vs TANGO Aggregation Max */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>FF-Helix % vs Aggregation Max</CardTitle>
                <CardDescription>Helix propensity vs peak TANGO aggregation score</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    X-axis: FF-Helix propensity % (thermodynamic helix-forming tendency). Y-axis: Peak TANGO aggregation score (&gt;5% = aggregation hotspot). Color: TANGO SSW prediction.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {helixAggData.length === 0 ? (
              <EmptyState title="Insufficient data" subtitle="Requires FF-Helix % and TANGO aggregation data." />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="ffHelix" name="FF-Helix %" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="number" dataKey="aggMax" name="Agg Max" />
                    <ReferenceLine y={5} stroke="#eab308" strokeDasharray="6 3" label={{ value: 'Agg threshold', position: 'right', fontSize: 10, fill: '#eab308' }} />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p className="font-medium">{item.id}</p>
                            <p>FF-Helix: {item.ffHelix.toFixed(1)}%</p>
                            <p>Agg Max: {item.aggMax.toFixed(1)}%</p>
                            <p>SSW: {item.ssw === 1 ? 'Positive' : item.ssw === -1 ? 'Negative' : 'N/A'}</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={helixAggData.filter(d => d.ssw === 1)} fill={COLORS.chameleonPositive} name="SSW +" />
                    <Scatter data={helixAggData.filter(d => d.ssw === -1)} fill={COLORS.chameleonNegative} name="SSW −" />
                    <Scatter data={helixAggData.filter(d => d.ssw !== 1 && d.ssw !== -1)} fill="#94a3b8" name="No SSW" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sequence Length Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sequence Length Distribution</CardTitle>
                <CardDescription>Distribution of peptide lengths in amino acids</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Histogram showing the distribution of peptide sequence lengths. Useful for understanding the dataset composition and identifying outliers.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {lengths.length === 0 ? (
              <EmptyState title="No length data" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lengthBins} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={70}
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
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Amino Acid Composition */}
      {aaCompositionData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card className="shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Amino Acid Composition</CardTitle>
                  <CardDescription>Residue categories across all peptides (HeliQuest classification)</CardDescription>
                </div>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Amino acid composition grouped by HeliQuest standard categories. High hydrophobic fraction suggests membrane affinity; high charged fraction suggests solubility.
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aaCompositionData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={85} />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p className="font-medium">{item.category}</p>
                            <p>{item.count} residues ({item.pct.toFixed(1)}%)</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="pct" name="Percentage">
                      {aaCompositionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Aggregation Risk Overview */}
      {aggOverviewData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aggregation Risk Overview</CardTitle>
                  <CardDescription>Peak TANGO aggregation score per peptide (&gt;5% = hotspot)</CardDescription>
                </div>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Horizontal bars show the maximum TANGO aggregation propensity per peptide. Green: low (&lt;5%), Yellow: moderate (5-20%), Red: high (&gt;20%).
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aggOverviewData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="id" tick={{ fontSize: 10 }} width={75} />
                    <ReferenceLine x={5} stroke="#eab308" strokeDasharray="6 3" label={{ value: '5%', position: 'top', fontSize: 10, fill: '#eab308' }} />
                    <ChartTooltip
                      content={({ payload }) => {
                        const item = payload?.[0]?.payload;
                        if (!item) return null;
                        return (
                          <div className="bg-background border border-border rounded p-2 text-xs">
                            <p className="font-medium">{item.id}</p>
                            <p>Agg Max: {item.aggMax.toFixed(1)}%</p>
                            <p>{item.aggMax > 20 ? 'HIGH risk' : item.aggMax > 5 ? 'MODERATE risk' : 'LOW risk'}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="aggMax" name="Agg Max %">
                      {aggOverviewData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              {aggOverflowCount > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">...and {aggOverflowCount} more peptide{aggOverflowCount > 1 ? 's' : ''}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Provider Status (collapsed by default) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="lg:col-span-2">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2 select-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
            <span>Provider Status</span>
            <div className="flex gap-1.5">
              {providers.map(p => (
                <span key={p.name} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                  p.status === 'AVAILABLE' ? 'bg-green-500' :
                  p.status === 'PARTIAL' ? 'bg-yellow-500' :
                  p.status === 'UNAVAILABLE' ? 'bg-red-500' : 'bg-gray-400'
                }`}>
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
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${
                    provider.status === 'AVAILABLE' ? 'bg-green-500' :
                    provider.status === 'PARTIAL' ? 'bg-yellow-500' :
                    provider.status === 'UNAVAILABLE' ? 'bg-red-500' : 'bg-gray-400'
                  }`}>
                    {provider.status}
                  </span>
                </div>
                {provider.reason && <p className="text-xs text-muted-foreground">{provider.reason}</p>}
                {provider.stats && (
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>Req: {provider.stats.requested}</span>
                    <span className="text-green-600">OK: {provider.stats.parsed_ok}</span>
                    {provider.stats.parsed_bad > 0 && <span className="text-red-600">Fail: {provider.stats.parsed_bad}</span>}
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
