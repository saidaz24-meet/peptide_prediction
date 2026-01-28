import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Peptide } from '@/types/peptide';

interface PositionBarsProps {
  peptide: Peptide;
  allPeptides: Peptide[];
}

export function PositionBars({ peptide, allPeptides }: PositionBarsProps) {
  const calculatePercentile = (value: number, allValues: number[]) => {
    const sorted = allValues.sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'text-green-600';
    if (percentile >= 50) return 'text-yellow-600';
    if (percentile >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPercentileLabel = (percentile: number) => {
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Above Average';
    if (percentile >= 25) return 'Below Average';
    return 'Bottom 25%';
  };

  const metrics = [
    {
      label: 'Hydrophobicity',
      value: peptide.hydrophobicity,
      allValues: allPeptides.map(p => p.hydrophobicity),
      formatter: (v: number) => v.toFixed(2),
    },
    {
      label: 'Charge (absolute)',
      value: Math.abs(peptide.charge),
      allValues: allPeptides.map(p => Math.abs(p.charge)),
      formatter: (v: number) => v.toFixed(1),
    },
    {
      label: 'Length',
      value: peptide.length,
      allValues: allPeptides.map(p => p.length),
      formatter: (v: number) => v.toString(),
    },
  ];

  // Add μH if available
  if (peptide.muH !== undefined) {
    const peptidesWithMuH = allPeptides.filter(p => p.muH !== undefined);
    if (peptidesWithMuH.length > 1) {
      metrics.push({
        label: 'Hydrophobic Moment',
        value: peptide.muH,
        allValues: peptidesWithMuH.map(p => p.muH!),
        formatter: (v: number) => v.toFixed(2),
      });
    }
  }

  // Add FF-Helix if available (only show in detailed view, not main dashboard)
  // Filter out invalid values (negative or >100)
  if (peptide.ffHelixPercent !== undefined && 
      peptide.ffHelixPercent >= 0 && 
      peptide.ffHelixPercent <= 100) {
    const peptidesWithHelix = allPeptides.filter(
      p => p.ffHelixPercent !== undefined && 
           p.ffHelixPercent >= 0 && 
           p.ffHelixPercent <= 100
    );
    if (peptidesWithHelix.length > 1) {
      metrics.push({
        label: 'FF-Helix %',
        value: peptide.ffHelixPercent,
        allValues: peptidesWithHelix.map(p => p.ffHelixPercent!),
        formatter: (v: number) => `${v.toFixed(1)}%`,
      });
    }
  }

  return (
    <div className="space-y-6">
      {metrics.map((metric, index) => {
        const percentile = calculatePercentile(metric.value, metric.allValues);
        const color = getPercentileColor(percentile);
        const label = getPercentileLabel(percentile);

        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{metric.label}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono">
                  {metric.formatter(metric.value)}
                </span>
                <Badge variant="outline" className={`text-xs ${color}`}>
                  {label}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-1">
              <Progress value={percentile} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0th percentile</span>
                <span className={color}>
                  {percentile.toFixed(0)}th percentile
                </span>
                <span>100th percentile</span>
              </div>
            </div>
          </motion.div>
        );
      })}

      <div className="mt-6 p-4 bg-muted/20 rounded-lg">
        <h4 className="font-medium text-sm mb-2">Interpretation</h4>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Percentiles show where this peptide ranks compared to the entire dataset.
          </p>
          <p>
            Higher percentiles indicate the peptide has higher values for that metric than most other peptides.
          </p>
        </div>
      </div>
    </div>
  );
}