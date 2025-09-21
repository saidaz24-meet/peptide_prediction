import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DatasetStats } from '@/types/peptide';

interface ResultsKpisProps {
  stats: DatasetStats | null;
}

export function ResultsKpis({ stats }: ResultsKpisProps) {
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

  const kpis = [
    {
      title: 'Total Peptides',
      value: stats.totalPeptides.toLocaleString(),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Chameleon Positive',
      value: `${stats.chameleonPositivePercent.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-chameleon-positive',
      bgColor: 'bg-chameleon-positive/10',
    },
    {
      title: 'Avg Hydrophobicity',
      value: stats.meanHydrophobicity.toFixed(2),
      icon: Zap,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Avg FF-Helix',
      value: stats.meanFFHelixPercent > 0 ? `${stats.meanFFHelixPercent.toFixed(1)}%` : 'Not available',
      icon: BarChart3,
      color: 'text-helix',
      bgColor: 'bg-helix/10',
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
            <Card className="shadow-soft hover:shadow-medium transition-shadow">
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