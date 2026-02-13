import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, BarChart3, Dna } from 'lucide-react';
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
  // NO LYING UI rule: If TANGO is OFF or UNAVAILABLE, show N/A
  // AVAILABLE or PARTIAL means TANGO ran and produced output
  // Note: We don't check 'ran' field - 'status' is authoritative
  const tangoStatus = meta?.provider_status?.tango?.status;
  const tangoAvailable = tangoStatus === 'AVAILABLE' || tangoStatus === 'PARTIAL';

  const s4predStatus = meta?.provider_status?.s4pred?.status;
  const s4predAvailable = s4predStatus === 'AVAILABLE' || s4predStatus === 'PARTIAL';

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
      title: 'TANGO SSW+',
      // NO LYING UI: If TANGO didn't run, show N/A (not 0%)
      value: tangoAvailable
        ? formatPercent(stats.sswPositivePercent)
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
      subtitle: 'intrinsic propensity',
    },
    {
      title: 'Avg S4PRED Helix',
      value: s4predAvailable && stats.meanS4predHelixPercent !== null
        ? `${stats.meanS4predHelixPercent.toFixed(1)}%`
        : 'N/A',
      icon: Dna,
      color: 'text-purple-600',
      bgColor: 'bg-purple-600/10',
      metricId: null as MetricId | null,
      onClick: () => {},
      subtitle: 'context-dependent',
      tooltip: !s4predAvailable
        ? 'S4PRED did not run or is unavailable'
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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
                    {'subtitle' in kpi && kpi.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</p>
                    )}
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
