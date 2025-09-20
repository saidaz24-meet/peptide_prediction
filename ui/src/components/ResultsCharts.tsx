import { motion } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend as RechartsLegend,
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
  helix: 'hsl(var(--helix))',
  primary: 'hsl(var(--primary))',
  accent: 'hsl(var(--accent))',
};

export function ResultsCharts({ peptides }: ResultsChartsProps) {
  // Prepare scatter plot data
  const scatterData = peptides
    .filter(p => p.muH !== undefined)
    .map(p => ({
      hydrophobicity: p.hydrophobicity,
      muH: p.muH,
      chameleon: p.chameleonPrediction,
      length: p.length,
      id: p.id,
    }));

  // Prepare hydrophobicity distribution
  const hydrophobicityBins = [];
  const minH = Math.min(...peptides.map(p => p.hydrophobicity));
  const maxH = Math.max(...peptides.map(p => p.hydrophobicity));
  const binSize = (maxH - minH) / 10;
  
  for (let i = 0; i < 10; i++) {
    const binStart = minH + i * binSize;
    const binEnd = binStart + binSize;
    const count = peptides.filter(p => p.hydrophobicity >= binStart && p.hydrophobicity < binEnd).length;
    hydrophobicityBins.push({
      range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
      count,
      binStart,
    });
  }

  // Prepare chameleon distribution
  const chameleonDistribution = [
    {
      name: 'Positive',
      value: peptides.filter(p => p.chameleonPrediction === 1).length,
      color: COLORS.chameleonPositive,
    },
    {
      name: 'Negative',
      value: peptides.filter(p => p.chameleonPrediction === -1).length,
      color: COLORS.chameleonNegative,
    },
    {
      name: 'Uncertain',
      value: peptides.filter(p => p.chameleonPrediction === 0).length,
      color: 'hsl(var(--muted-foreground))',
    },
  ];

  // Prepare radar data
  const positiveGroup = peptides.filter(p => p.chameleonPrediction === 1);
  const negativeGroup = peptides.filter(p => p.chameleonPrediction === -1);
  
  const radarData = [
    {
      metric: 'Hydrophobicity',
      positive: positiveGroup.length > 0 ? positiveGroup.reduce((sum, p) => sum + p.hydrophobicity, 0) / positiveGroup.length : 0,
      negative: negativeGroup.length > 0 ? negativeGroup.reduce((sum, p) => sum + p.hydrophobicity, 0) / negativeGroup.length : 0,
    },
    {
      metric: 'Charge (abs)',
      positive: positiveGroup.length > 0 ? positiveGroup.reduce((sum, p) => sum + Math.abs(p.charge), 0) / positiveGroup.length : 0,
      negative: negativeGroup.length > 0 ? negativeGroup.reduce((sum, p) => sum + Math.abs(p.charge), 0) / negativeGroup.length : 0,
    },
    {
      metric: 'Length (norm)',
      positive: positiveGroup.length > 0 ? (positiveGroup.reduce((sum, p) => sum + p.length, 0) / positiveGroup.length) / 50 : 0,
      negative: negativeGroup.length > 0 ? (negativeGroup.reduce((sum, p) => sum + p.length, 0) / negativeGroup.length) / 50 : 0,
    },
    {
      metric: 'μH',
      positive: positiveGroup.filter(p => p.muH !== undefined).length > 0 
        ? positiveGroup.filter(p => p.muH !== undefined).reduce((sum, p) => sum + (p.muH || 0), 0) / positiveGroup.filter(p => p.muH !== undefined).length 
        : 0,
      negative: negativeGroup.filter(p => p.muH !== undefined).length > 0 
        ? negativeGroup.filter(p => p.muH !== undefined).reduce((sum, p) => sum + (p.muH || 0), 0) / negativeGroup.filter(p => p.muH !== undefined).length 
        : 0,
    },
  ];

  const chartConfig = {
    chameleonPositive: {
      label: 'Chameleon Positive',
      color: COLORS.chameleonPositive,
    },
    chameleonNegative: {
      label: 'Chameleon Negative',
      color: COLORS.chameleonNegative,
    },
    hydrophobicity: {
      label: 'Hydrophobicity',
      color: COLORS.primary,
    },
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Scatter Plot */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Hydrophobicity vs Hydrophobic Moment</CardTitle>
            <CardDescription>
              Correlation between hydrophobicity and amphipathic character
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={scatterData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hydrophobicity" name="Hydrophobicity" />
                  <YAxis dataKey="muH" name="μH" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Scatter
                    data={scatterData.filter(d => d.chameleon === 1)}
                    fill={COLORS.chameleonPositive}
                    name="Chameleon +"
                  />
                  <Scatter
                    data={scatterData.filter(d => d.chameleon === -1)}
                    fill={COLORS.chameleonNegative}
                    name="Chameleon -"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Hydrophobicity Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Hydrophobicity Distribution</CardTitle>
            <CardDescription>
              Frequency distribution of hydrophobicity values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hydrophobicityBins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Chameleon Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Chameleon Prediction Distribution</CardTitle>
            <CardDescription>
              Proportion of membrane-active predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chameleonDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {chameleonDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Radar Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Cohort Comparison</CardTitle>
            <CardDescription>
              Mean profiles: Chameleon positive vs negative
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                  <Radar
                    name="Chameleon +"
                    dataKey="positive"
                    stroke={COLORS.chameleonPositive}
                    fill={COLORS.chameleonPositive}
                    fillOpacity={0.1}
                  />
                  <Radar
                    name="Chameleon -"
                    dataKey="negative"
                    stroke={COLORS.chameleonNegative}
                    fill={COLORS.chameleonNegative}
                    fillOpacity={0.1}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <RechartsLegend />
                </RadarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}