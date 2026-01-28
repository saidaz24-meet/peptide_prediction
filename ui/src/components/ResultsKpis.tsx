import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DatasetStats, DatasetMetadata } from '@/types/peptide';
import { useNavigate } from 'react-router-dom';
import { MetricId } from '@/types/metrics';

interface ResultsKpisProps {
  stats: DatasetStats | null;
  meta?: DatasetMetadata | null;
}

export function ResultsKpis({ stats, meta }: ResultsKpisProps) {
  const navigate = useNavigate();

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-soft">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Determine availability for each KPI based on provider status
  // NO LYING UI rule: If TANGO didn't run (ran=false) or is OFF/UNAVAILABLE, show N/A
  const tangoRan = meta?.provider_status?.tango?.ran ?? false;
  const tangoStatus = meta?.provider_status?.tango?.status;
  const tangoAvailable = tangoRan && (tangoStatus === 'AVAILABLE' || tangoStatus === 'PARTIAL');
  
  const ffAvailable = (stats.ffHelixAvailable ?? 0) > 0;
  const sswAvailable = (stats.sswAvailable ?? 0) > 0;

  // Helper to format percentage or show N/A
  const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/A';
    }
    return `${value.toFixed(decimals)}%`;
  };

  const kpis = [
    {
      title: 'Total Peptides',
      value: stats.totalPeptides.toLocaleString(),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      metricId: null as MetricId | null,
      onClick: () => {}, // Total peptides doesn't have a detail page
    },
    {
      title: 'SSW Positive',
      // NO LYING UI: If TANGO didn't run, show N/A (not 0%)
      value: tangoAvailable 
        ? formatPercent(stats.sswPositivePercent ?? stats.chameleonPositivePercent ?? null)
        : 'N/A',
      icon: TrendingUp,
      color: 'text-chameleon-positive',
      bgColor: 'bg-chameleon-positive/10',
      metricId: 'ssw-positive' as MetricId,
      onClick: () => navigate('/metrics/ssw-positive'),
      tooltip: !tangoAvailable 
        ? 'TANGO did not run or is unavailable' 
        : (stats.sswPositivePercent === null || stats.sswPositivePercent === undefined) && (sswAvailable ?? 0) === 0 
        ? 'TANGO output not available' 
        : undefined,
    },
    {
      title: 'Avg Hydrophobicity',
      value: stats.meanHydrophobicity.toFixed(2),
      icon: Zap,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      metricId: 'hydrophobicity' as MetricId,
      onClick: () => navigate('/metrics/hydrophobicity'),
    },
    {
      title: 'Avg FF-Helix',
      value: ffAvailable && stats.meanFFHelixPercent !== null
        ? `${stats.meanFFHelixPercent.toFixed(1)}%`
        : 'N/A',
      icon: BarChart3,
      color: 'text-helix',
      bgColor: 'bg-helix/10',
      metricId: 'ff-helix' as MetricId,
      onClick: () => navigate('/metrics/ff-helix'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className={`shadow-soft transition-shadow ${kpi.metricId ? 'cursor-pointer hover:shadow-medium active:scale-[0.98]' : ''}`}
              onClick={kpi.metricId ? kpi.onClick : undefined}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {kpi.title}
                    </p>
                    <motion.p
                      className="text-3xl font-bold"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                    >
                      {kpi.value}
                    </motion.p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
