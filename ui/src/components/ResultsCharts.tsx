import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend as RechartsLegend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Peptide } from '@/types/peptide';

interface ResultsChartsProps {
  peptides: Peptide[];
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

export function ResultsCharts({ peptides }: ResultsChartsProps) {
  // Scatter data: require μH
  const scatterData = peptides
    .filter(p => typeof p.muH === 'number' && Number.isFinite(p.muH))
    .map(p => ({
      hydrophobicity: p.hydrophobicity,
      muH: p.muH as number,
      chameleon: p.chameleonPrediction,
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
    return { range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`, count };
  });

  // Chameleon distribution
  const pos = peptides.filter(p => p.chameleonPrediction === 1).length;
  const neg = peptides.filter(p => p.chameleonPrediction === -1).length;
  const unc = peptides.filter(p => p.chameleonPrediction === 0).length;
  const chameleonDistribution = [
    { name: 'Positive', value: pos, color: COLORS.chameleonPositive },
    { name: 'Negative', value: neg, color: COLORS.chameleonNegative },
    { name: 'Not available', value: unc, color: COLORS.muted },
  ].filter(d => d.value > 0);

  // Radar comparison (if both groups empty, render empty)
  const positiveGroup = peptides.filter(p => p.chameleonPrediction === 1);
  const negativeGroup = peptides.filter(p => p.chameleonPrediction === -1);
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

  const chartConfig = {
    hydrophobicity: { label: 'Hydrophobicity', color: COLORS.primary },
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Scatter: Hydrophobicity vs μH */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Hydrophobicity vs Hydrophobic Moment</CardTitle>
            <CardDescription>Correlation between hydrophobicity and amphipathic character</CardDescription>
          </CardHeader>
          <CardContent>
            {scatterData.length === 0 ? (
              <EmptyState title="μH not available" subtitle="Upload a dataset or enable JPred/Tango so μH can be computed." />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hydrophobicity" name="Hydrophobicity" />
                    <YAxis dataKey="muH" name="μH" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Scatter data={scatterData.filter(d => d.chameleon === 1)} fill={COLORS.chameleonPositive} name="Chameleon +" />
                    <Scatter data={scatterData.filter(d => d.chameleon === -1)} fill={COLORS.chameleonNegative} name="Chameleon −" />
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
            <CardTitle>Hydrophobicity Distribution</CardTitle>
            <CardDescription>Frequency distribution of hydrophobicity values</CardDescription>
          </CardHeader>
          <CardContent>
            {peptides.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hydrophobicityBins}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Chameleon Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Chameleon Prediction Distribution</CardTitle>
            <CardDescription>Proportion of membrane-active predictions</CardDescription>
          </CardHeader>
          <CardContent>
            {chameleonDistribution.length === 0 ? (
              <EmptyState title="No chameleon predictions" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chameleonDistribution} cx="50%" cy="50%" outerRadius={82} dataKey="value"
                      label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                      {chameleonDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
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
            <CardDescription>Mean profiles: Chameleon positive vs negative</CardDescription>
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
                  <Radar name="Chameleon +" dataKey="positive" stroke={COLORS.chameleonPositive} fill={COLORS.chameleonPositive} fillOpacity={0.1} />
                  <Radar name="Chameleon −" dataKey="negative" stroke={COLORS.chameleonNegative} fill={COLORS.chameleonNegative} fillOpacity={0.1} />
                  <RechartsLegend />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
