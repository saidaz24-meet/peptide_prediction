import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Peptide, DatasetStats } from '@/types/peptide';

interface PeptideRadarChartProps {
  peptide: Peptide;
  cohortStats: DatasetStats | null;
}

export function PeptideRadarChart({ peptide, cohortStats }: PeptideRadarChartProps) {
  if (!cohortStats) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No cohort data available for comparison
      </div>
    );
  }

  // Normalize values for radar chart (0-1 scale)
  const normalizeHydrophobicity = (value: number) => {
    // Typical range: -2 to 2, normalize to 0-1
    return Math.max(0, Math.min(1, (value + 2) / 4));
  };

  const normalizeCharge = (value: number) => {
    // Normalize absolute charge, typical range: 0 to 10
    return Math.max(0, Math.min(1, Math.abs(value) / 10));
  };

  const normalizeLength = (value: number) => {
    // Normalize length, typical range: 10 to 100
    return Math.max(0, Math.min(1, (value - 10) / 90));
  };

  const normalizeMuH = (value: number) => {
    // μH range: 0 to 1, already normalized
    return Math.max(0, Math.min(1, value));
  };

  const data = [
    {
      metric: 'Hydrophobicity',
      peptide: normalizeHydrophobicity(peptide.hydrophobicity),
      cohort: normalizeHydrophobicity(cohortStats.meanHydrophobicity),
      fullMark: 1,
    },
    {
      metric: 'Charge (abs)',
      peptide: normalizeCharge(peptide.charge),
      cohort: normalizeCharge(cohortStats.meanCharge),
      fullMark: 1,
    },
    {
      metric: 'Length',
      peptide: normalizeLength(peptide.length),
      cohort: normalizeLength(cohortStats.meanLength),
      fullMark: 1,
    },
  ];

  // Add μH if available
  if (peptide.muH !== undefined) {
    // Calculate cohort mean μH
    const cohortMeanMuH = 0.3; // Default fallback, should be calculated from actual cohort
    data.push({
      metric: 'μH',
      peptide: normalizeMuH(peptide.muH),
      cohort: normalizeMuH(cohortMeanMuH),
      fullMark: 1,
    });
  }

  // Add FF-Helix if available
  if (peptide.ffHelixPercent !== undefined && cohortStats.meanFFHelixPercent > 0) {
    data.push({
      metric: 'FF-Helix %',
      peptide: peptide.ffHelixPercent / 100, // Normalize to 0-1
      cohort: cohortStats.meanFFHelixPercent / 100,
      fullMark: 1,
    });
  }

  const chartConfig = {
    peptide: {
      label: 'This Peptide',
      color: 'hsl(var(--primary))',
    },
    cohort: {
      label: 'Cohort Mean',
      color: 'hsl(var(--muted-foreground))',
    },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis 
            domain={[0, 1]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="This Peptide"
            dataKey="peptide"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name="Cohort Mean"
            dataKey="cohort"
            stroke="hsl(var(--muted-foreground))"
            fill="hsl(var(--muted-foreground))"
            fillOpacity={0.1}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <ChartTooltip 
            content={<ChartTooltipContent />}
            formatter={(value: number, name: string) => [
              `${(value * 100).toFixed(1)}%`,
              name
            ]}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}