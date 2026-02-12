import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend as RechartsLegend,
  Tooltip,
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

  // SSW distribution
  const pos = peptides.filter(p => p.sswPrediction === 1).length;
  const neg = peptides.filter(p => p.sswPrediction === -1).length;
  const unc = peptides.filter(p => p.sswPrediction === 0).length;
  const sswDistribution = [
    { name: 'SSW Positive', value: pos, color: COLORS.chameleonPositive },
    { name: 'SSW Negative', value: neg, color: COLORS.chameleonNegative },
    { name: 'Not available', value: unc, color: COLORS.muted },
  ].filter(d => d.value > 0);

  // Radar comparison (if both groups empty, render empty)
  const positiveGroup = peptides.filter(p => p.sswPrediction === 1);
  const negativeGroup = peptides.filter(p => p.sswPrediction === -1);
  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const radarData =
    positiveGroup.length + negativeGroup.length > 0
      ? [
          { metric: 'Hydrophobicity',
            positive: mean(positiveGroup.map(p => p.hydrophobicity)),
            negative: mean(negativeGroup.map(p => p.hydrophobicity)) },
          { metric: 'Charge (abs)',
            positive: mean(positiveGroup.map(p => Math.abs(p.charge))),
            negative: mean(negativeGroup.map(p => Math.abs(p.charge))) },
          { metric: 'Length (norm)',
            positive: mean(positiveGroup.map(p => p.length)) / 50,
            negative: mean(negativeGroup.map(p => p.length)) / 50 },
          { metric: 'μH',
            positive: mean(positiveGroup.map(p => (typeof p.muH === 'number' ? p.muH : 0))),
            negative: mean(negativeGroup.map(p => (typeof p.muH === 'number' ? p.muH : 0))) },
        ]
      : [];

  // FF-Helix % vs SSW Prediction scatter data
  const ffHelixSswData = peptides
    .filter(p => typeof p.ffHelixPercent === 'number' && Number.isFinite(p.ffHelixPercent) && p.sswPrediction !== null)
    .map(p => ({
      ffHelix: p.ffHelixPercent as number,
      ssw: p.sswPrediction as number,
      id: p.id,
    }));

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
                    <ChartTooltip
                      content={({ payload }) => {
                        if (payload && payload.length > 0) {
                          const { hydrophobicity, muH } = payload[0].payload;
                          return (
                            <div className="bg-background border border-border rounded p-2 text-xs">
                              <p>H: {parseFloat(hydrophobicity).toFixed(2)}</p>
                              <p>μH: {parseFloat(muH).toFixed(2)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={scatterData.filter(d => d.ssw === 1)} fill={COLORS.chameleonPositive} name="SSW +" />
                    <Scatter data={scatterData.filter(d => d.ssw === -1)} fill={COLORS.chameleonNegative} name="SSW −" />
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

      {/* SSW Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>SSW Prediction Distribution</CardTitle>
            <CardDescription>Proportion of structural switch predictions</CardDescription>
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Radar Comparison */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Cohort Comparison</CardTitle>
            <CardDescription>Mean profiles: SSW positive vs negative</CardDescription>
          </CardHeader>
        <CardContent>
          {radarData.length === 0 ? (
            <EmptyState title="Not enough data to compare groups" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                  <Radar name="SSW +" dataKey="positive" stroke={COLORS.chameleonPositive} fill={COLORS.chameleonPositive} fillOpacity={0.1} />
                  <Radar name="SSW −" dataKey="negative" stroke={COLORS.chameleonNegative} fill={COLORS.chameleonNegative} fillOpacity={0.1} />
                  <RechartsLegend />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
        </Card>
      </motion.div>

      {/* FF-Helix % vs SSW Prediction Scatter */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>FF-Helix % vs SSW Prediction</CardTitle>
                <CardDescription>Relationship between fibril-forming helix content and structural switching</CardDescription>
              </div>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-5 h-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Scatter plot showing FF-Helix percentage vs SSW prediction. Positive SSW (green) indicates predicted structural switching; Negative SSW (red) indicates no switching predicted.
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {ffHelixSswData.length === 0 ? (
              <EmptyState title="Insufficient data" subtitle="Requires FF-Helix % and SSW prediction values." />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="ffHelix"
                      name="FF-Helix %"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="number"
                      dataKey="ssw"
                      name="SSW"
                      domain={[-1.5, 1.5]}
                      ticks={[-1, 0, 1]}
                      tickFormatter={(v: number) => v === 1 ? 'Positive' : v === -1 ? 'Negative' : 'Uncertain'}
                    />
                    <ChartTooltip
                      content={({ payload }) => {
                        if (payload && payload.length > 0) {
                          const { ffHelix, ssw, id } = payload[0].payload;
                          return (
                            <div className="bg-background border border-border rounded p-2 text-xs">
                              <p className="font-medium">{id}</p>
                              <p>FF-Helix: {ffHelix.toFixed(1)}%</p>
                              <p>SSW: {ssw === 1 ? 'Positive' : ssw === -1 ? 'Negative' : 'Uncertain'}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={ffHelixSswData.filter(d => d.ssw === 1)} fill={COLORS.chameleonPositive} name="SSW +" />
                    <Scatter data={ffHelixSswData.filter(d => d.ssw === -1)} fill={COLORS.chameleonNegative} name="SSW −" />
                    <Scatter data={ffHelixSswData.filter(d => d.ssw === 0)} fill={COLORS.muted} name="Uncertain" />
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

      {/* Provider Status Dashboard */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Provider Status Dashboard</CardTitle>
            <CardDescription>Status of prediction providers used in this analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {providers.map((provider) => {
                const statusColor =
                  provider.status === 'AVAILABLE' ? 'bg-green-500' :
                  provider.status === 'PARTIAL' ? 'bg-yellow-500' :
                  provider.status === 'UNAVAILABLE' ? 'bg-red-500' :
                  'bg-gray-400';

                return (
                  <div key={provider.name} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{provider.name}</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${statusColor}`}>
                        {provider.status}
                      </span>
                    </div>
                    {provider.reason && (
                      <p className="text-xs text-muted-foreground">{provider.reason}</p>
                    )}
                    {provider.stats && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Requested:</span>
                          <span>{provider.stats.requested}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Successful:</span>
                          <span className="text-green-600">{provider.stats.parsed_ok}</span>
                        </div>
                        {provider.stats.parsed_bad > 0 && (
                          <div className="flex justify-between">
                            <span>Failed:</span>
                            <span className="text-red-600">{provider.stats.parsed_bad}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
