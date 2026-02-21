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

  const data: { metric: string; peptide: number; cohort: number; fullMark: number }[] = [];

  if (peptide.hydrophobicity !== null) {
    data.push({
      metric: 'Hydrophobicity',
      peptide: normalizeHydrophobicity(peptide.hydrophobicity),
      cohort: normalizeHydrophobicity(cohortStats.meanHydrophobicity),
      fullMark: 1,
    });
  }

  if (peptide.charge !== null) {
    data.push({
      metric: 'Charge (abs)',
      peptide: normalizeCharge(peptide.charge),
      cohort: normalizeCharge(cohortStats.meanCharge),
      fullMark: 1,
    });
  }

  if (peptide.length !== null) {
    data.push({
      metric: 'Length',
      peptide: normalizeLength(peptide.length),
      cohort: normalizeLength(cohortStats.meanLength),
      fullMark: 1,
    });
  }

  // Add μH if available
  if (peptide.muH !== undefined) {
    const cohortMeanMuH = cohortStats.meanMuH ?? 0.3;
    data.push({
      metric: 'μH',
      peptide: normalizeMuH(peptide.muH),
      cohort: normalizeMuH(cohortMeanMuH),
      fullMark: 1,
    });
  }

  // S4PRED Helix % on radar (primary helix metric)
  if (peptide.s4predHelixPercent !== undefined &&
      peptide.s4predHelixPercent !== null &&
      peptide.s4predHelixPercent >= 0 &&
      peptide.s4predHelixPercent <= 100 &&
      cohortStats.meanS4predHelixPercent !== null &&
      cohortStats.meanS4predHelixPercent !== undefined &&
      cohortStats.meanS4predHelixPercent >= 0) {
    data.push({
      metric: 'S4PRED Helix %',
      peptide: peptide.s4predHelixPercent / 100,
      cohort: cohortStats.meanS4predHelixPercent / 100,
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
              `${(value * 100).toFixed(1)}% `,
              name
            ]}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}