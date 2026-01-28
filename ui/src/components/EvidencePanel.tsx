import { motion } from 'framer-motion';
import { CheckCircle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Peptide, DatasetStats } from '@/types/peptide';

interface EvidencePanelProps {
  peptide: Peptide;
  cohortStats: DatasetStats | null;
}

export function EvidencePanel({ peptide, cohortStats }: EvidencePanelProps) {
  const evidenceItems = [];

  // Hydrophobicity evidence
  if (cohortStats) {
    const hydrophobicityDiff = peptide.hydrophobicity - cohortStats.meanHydrophobicity;
    const isHigher = hydrophobicityDiff > 0;
    const Icon = isHigher ? TrendingUp : TrendingDown;
    
    evidenceItems.push({
      property: 'Hydrophobicity',
      value: peptide.hydrophobicity.toFixed(2),
      comparison: `${isHigher ? 'Higher' : 'Lower'} than cohort mean (${cohortStats.meanHydrophobicity.toFixed(2)})`,
      difference: `${isHigher ? '+' : ''}${hydrophobicityDiff.toFixed(2)}`,
      icon: Icon,
      color: isHigher ? 'text-green-600' : 'text-blue-600',
    });

    // Charge evidence
    const chargeDiff = peptide.charge - cohortStats.meanCharge;
    const chargeIsHigher = chargeDiff > 0;
    const ChargeIcon = chargeIsHigher ? TrendingUp : TrendingDown;
    
    evidenceItems.push({
      property: 'Charge',
      value: `${peptide.charge > 0 ? '+' : ''}${peptide.charge.toFixed(1)}`,
      comparison: `${chargeIsHigher ? 'More positive' : 'More negative'} than cohort mean (${cohortStats.meanCharge > 0 ? '+' : ''}${cohortStats.meanCharge.toFixed(1)})`,
      difference: `${chargeIsHigher ? '+' : ''}${chargeDiff.toFixed(1)}`,
      icon: ChargeIcon,
      color: chargeIsHigher ? 'text-green-600' : 'text-blue-600',
    });

    // FF-Helix evidence
    if (peptide.ffHelixPercent !== undefined && 
        cohortStats.meanFFHelixPercent !== null && 
        cohortStats.meanFFHelixPercent !== undefined &&
        cohortStats.meanFFHelixPercent >= 0) {
      const helixDiff = peptide.ffHelixPercent - cohortStats.meanFFHelixPercent;
      const helixIsHigher = helixDiff > 0;
      const HelixIcon = helixIsHigher ? TrendingUp : TrendingDown;
      
      evidenceItems.push({
        property: 'FF-Helix Content',
        value: `${peptide.ffHelixPercent.toFixed(1)}%`,
        comparison: `${helixIsHigher ? 'More' : 'Less'} structured than cohort mean (${cohortStats.meanFFHelixPercent.toFixed(1)}%)`,
        difference: `${helixIsHigher ? '+' : ''}${helixDiff.toFixed(1)}%`,
        icon: HelixIcon,
        color: helixIsHigher ? 'text-green-600' : 'text-blue-600',
      });
    } else if (peptide.ffHelixPercent === undefined) {
      evidenceItems.push({
        property: 'FF-Helix Content',
        value: 'Not available',
        comparison: 'No helix structure data available',
        difference: '',
        icon: Minus,
        color: 'text-muted-foreground',
      });
    }
  }

  // Hydrophobic moment evidence
  if (peptide.muH !== undefined) {
    evidenceItems.push({
      property: 'Hydrophobic Moment',
      value: peptide.muH.toFixed(2),
      comparison: peptide.muH > 0.5 ? 'Strong amphipathic character' : 'Moderate amphipathic character',
      difference: '',
      icon: peptide.muH > 0.5 ? CheckCircle : Minus,
      color: peptide.muH > 0.5 ? 'text-green-600' : 'text-amber-600',
    });
  }

  // SSW (Secondary Structure Switch) prediction evidence
  // Gate: Only show valid predictions when TANGO provider status is AVAILABLE
  const sswPred = peptide.sswPrediction ?? (peptide as any).chameleonPrediction; // Backward compat
  const tangoAvailable = peptide.providerStatus?.tango?.status === "AVAILABLE";
  const hasValidSSW = sswPred !== null && sswPred !== undefined && sswPred !== "null";
  const sswEvidence = {
    property: 'SSW Prediction',
    value: !tangoAvailable || !hasValidSSW 
      ? 'N/A' 
      : sswPred === 1 
        ? 'Positive' 
        : sswPred === -1 
          ? 'Negative' 
          : 'Not available',
    comparison: !tangoAvailable || !hasValidSSW
      ? 'TANGO output not available'
      : sswPred === 1 
        ? 'Predicted to be membrane-active'
        : sswPred === -1
          ? 'Predicted to be non-membrane-active'
          : 'No SSW prediction available',
    difference: '',
    icon: !tangoAvailable || !hasValidSSW ? Minus : sswPred === 1 ? CheckCircle : sswPred === -1 ? XCircle : Minus,
    color: !tangoAvailable || !hasValidSSW ? 'text-muted-foreground' : sswPred === 1 ? 'text-chameleon-positive' : sswPred === -1 ? 'text-muted-foreground' : 'text-muted-foreground',
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle>Evidence Summary</CardTitle>
        <CardDescription>
          Key insights about this peptide's properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chameleon Prediction - Featured */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 rounded-lg border-l-4 border-l-chameleon-positive bg-gradient-to-r from-chameleon-positive/5 to-transparent"
        >
          <div className="flex items-center space-x-3">
            <sswEvidence.icon className={`w-5 h-5 ${sswEvidence.color}`} />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">
                {sswEvidence.property}: {sswEvidence.value}
              </h4>
              <p className="text-sm text-muted-foreground">
                {sswEvidence.comparison}
              </p>
            </div>
          </div>
        </motion.div>

        <Separator />

        {/* Other Evidence */}
        <div className="space-y-3">
          {evidenceItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.property}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Icon className={`w-4 h-4 ${item.color}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{item.property}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {item.value}
                      </Badge>
                      {item.difference && (
                        <Badge variant="secondary" className="text-xs">
                          {item.difference}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.comparison}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Context */}
        <div className="mt-6 p-4 bg-muted/20 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Interpretation Notes</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              • Higher hydrophobicity suggests stronger membrane affinity
            </p>
            <p>
              • Positive charge can enhance membrane interaction
            </p>
            <p>
              • Helical structure often correlates with biological activity
            </p>
            {peptide.muH !== undefined && (
            <p>
              • μH &gt; 0.5 indicates strong amphipathic character
            </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
