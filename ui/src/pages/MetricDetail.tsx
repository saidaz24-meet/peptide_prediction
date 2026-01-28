import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PeptideTable } from '@/components/PeptideTable';
import { METRIC_DEFINITIONS, MetricId } from '@/types/metrics';
import { useDatasetStore } from '@/stores/datasetStore';
import { Peptide, DatasetStats } from '@/types/peptide';
import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const COLORS = {
  positive: 'hsl(var(--ssw-positive))',
  negative: 'hsl(var(--ssw-negative))',
  primary: 'hsl(var(--primary))',
  muted: 'hsl(var(--muted-foreground))',
};

export default function MetricDetail() {
  const { metricId } = useParams<{ metricId: MetricId }>();
  const navigate = useNavigate();
  const { peptides, stats } = useDatasetStore();

  const metric = metricId ? METRIC_DEFINITIONS[metricId] : null;

  if (!metric || !metricId) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Metric not found</p>
            <Button onClick={() => navigate('/results')} className="mt-4">
              Back to Results
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normalize peptides (same logic as Results page)
  const normalizePeptide = (p: any): Peptide => {
    const sswRaw = p?.sswPrediction ?? p?.chameleonPrediction;
    const ssw: -1 | 0 | 1 = sswRaw === 1 ? 1 : sswRaw === 0 ? 0 : -1;
    const id = String(p.id ?? p.Entry ?? p.entry ?? p.Accession ?? p.accession ?? '').trim();
    
    return {
      id,
      name: p.name ?? p['Protein name'],
      species: p.species ?? p.Organism,
      sequence: String(p.sequence ?? p.Sequence ?? ''),
      length: Number(p.length ?? p.Length ?? 0),
      hydrophobicity: Number(p.hydrophobicity ?? p.Hydrophobicity ?? 0),
      muH: typeof p.muH === 'number' ? p.muH : (typeof p['Full length uH'] === 'number' ? p['Full length uH'] : undefined),
      charge: Number(p.charge ?? p.Charge ?? 0),
      sswPrediction: ssw,
      chameleonPrediction: ssw,
      ffHelixPercent: typeof p.ffHelixPercent === 'number' ? p.ffHelixPercent
        : (typeof p['FF-Helix %'] === 'number' ? p['FF-Helix %'] : undefined),
      jpred: p.jpred ?? {
        helixFragments: p['Helix fragments (Jpred)'] ?? undefined,
        helixScore: typeof p['Helix score (Jpred)'] === 'number' ? p['Helix score (Jpred)'] : undefined,
      },
      extra: p.extra ?? {},
    };
  };

  const peptidesTyped: Peptide[] = useMemo(
    () => peptides.map(normalizePeptide),
    [peptides]
  );

  // Generate chart data based on metric type
  const chartData = useMemo(() => {
    if (!peptidesTyped.length) return null;

    switch (metric.chartType) {
      case 'distribution': {
        // Histogram data
        const values: number[] = [];
        
        if (metricId === 'ff-helix') {
          peptidesTyped.forEach(p => {
            if (typeof p.ffHelixPercent === 'number') values.push(p.ffHelixPercent);
          });
        } else if (metricId === 'hydrophobicity') {
          peptidesTyped.forEach(p => values.push(p.hydrophobicity));
        } else if (metricId === 'charge') {
          peptidesTyped.forEach(p => values.push(Math.abs(p.charge)));
        }

        if (values.length === 0) return null;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = Math.max(1e-6, max - min);
        const binSize = span / 10;

        return Array.from({ length: 10 }, (_, i) => {
          const binStart = min + i * binSize;
          const binEnd = binStart + binSize;
          const count = values.filter(v => {
            return i < 9 ? v >= binStart && v < binEnd : v >= binStart && v <= binEnd;
          }).length;
          return {
            range: `${binStart.toFixed(2)}–${binEnd.toFixed(2)}`,
            count,
            binStart,
          };
        }).sort((a, b) => a.binStart - b.binStart);
      }

      case 'pie': {
        if (metricId === 'ssw-positive') {
          const pos = peptidesTyped.filter(p => p.sswPrediction === 1).length;
          const neg = peptidesTyped.filter(p => p.sswPrediction === -1).length;
          const unc = peptidesTyped.filter(p => p.sswPrediction === 0).length;
          return [
            { name: 'SSW Positive', value: pos, color: COLORS.positive },
            { name: 'SSW Negative', value: neg, color: COLORS.negative },
            { name: 'Not available', value: unc, color: COLORS.muted },
          ].filter(d => d.value > 0);
        } else if (metricId === 'ff-secondary-switch') {
          // This would require FF-Secondary structure switch data - simplified for now
          const pos = peptidesTyped.filter(p => p.sswPrediction === 1).length; // Placeholder
          const neg = peptidesTyped.length - pos;
          return [
            { name: 'Fibril-forming (SSW)', value: pos, color: COLORS.positive },
            { name: 'Not fibril-forming', value: neg, color: COLORS.negative },
          ].filter(d => d.value > 0);
        } else if (metricId === 'ff-helix-flag') {
          // This would require FF-Helix flag data - simplified for now
          const pos = peptidesTyped.filter(p => (p.ffHelixPercent ?? 0) > 0).length; // Placeholder
          const neg = peptidesTyped.length - pos;
          return [
            { name: 'Fibril-forming (Helix)', value: pos, color: COLORS.positive },
            { name: 'Not fibril-forming', value: neg, color: COLORS.negative },
          ].filter(d => d.value > 0);
        }
        return null;
      }

      default:
        return null;
    }
  }, [peptidesTyped, metricId, metric.chartType]);

  // Show all peptides - PeptideTable will display all columns by default
  const filteredPeptides = peptidesTyped;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/results')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Results
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{metric.title}</h1>
              <p className="text-muted-foreground mt-1">{metric.description}</p>
            </div>
          </div>

          {/* Definition */}
          <Card>
            <CardHeader>
              <CardTitle>Definition</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{metric.definition}</p>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
              <CardDescription>{metric.title} across the dataset</CardDescription>
            </CardHeader>
            <CardContent>
              {!chartData || (Array.isArray(chartData) && chartData.length === 0) ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              ) : metric.chartType === 'distribution' ? (
                <ChartContainer config={{}} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill={COLORS.primary} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : metric.chartType === 'pie' ? (
                <ChartContainer config={{}} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      >
                        {(chartData as any[]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Filtered Table */}
          <Card>
            <CardHeader>
              <CardTitle>Peptide Data</CardTitle>
              <CardDescription>Filtered view showing relevant columns for {metric.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <PeptideTable peptides={filteredPeptides} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

