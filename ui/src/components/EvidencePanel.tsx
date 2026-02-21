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
  if (cohortStats && peptide.hydrophobicity !== null) {
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
  }

  if (cohortStats && peptide.charge !== null) {
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

  }

  // FF-Helix evidence
  if (cohortStats &&
      peptide.ffHelixPercent !== undefined &&
      peptide.ffHelixPercent !== null &&
      cohortStats.meanFFHelixPercent !== null &&
      cohortStats.meanFFHelixPercent !== undefined &&
      cohortStats.meanFFHelixPercent >= 0) {
    const helixDiff = peptide.ffHelixPercent - cohortStats.meanFFHelixPercent;
    const helixIsHigher = helixDiff > 0;
    const HelixIcon = helixIsHigher ? TrendingUp : TrendingDown;

    evidenceItems.push({
      property: 'Chou-Fasman Propensity',
      value: `${peptide.ffHelixPercent.toFixed(1)}%`,
      comparison: `${helixIsHigher ? 'Higher' : 'Lower'} propensity than cohort mean (${cohortStats.meanFFHelixPercent.toFixed(1)}%)`,
      difference: `${helixIsHigher ? '+' : ''}${helixDiff.toFixed(1)}%`,
      icon: HelixIcon,
      color: helixIsHigher ? 'text-green-600' : 'text-blue-600',
    });
  } else if (peptide.ffHelixPercent === undefined || peptide.ffHelixPercent === null) {
    evidenceItems.push({
      property: 'Chou-Fasman Propensity',
      value: 'Not available',
      comparison: 'No propensity data available',
      difference: '',
      icon: Minus,
      color: 'text-muted-foreground',
    });
  }

  // S4PRED Helix evidence
  if (cohortStats &&
      peptide.s4predHelixPercent !== undefined &&
      peptide.s4predHelixPercent !== null &&
      cohortStats.meanS4predHelixPercent !== null &&
      cohortStats.meanS4predHelixPercent !== undefined &&
      cohortStats.meanS4predHelixPercent >= 0) {
    const s4Diff = peptide.s4predHelixPercent - cohortStats.meanS4predHelixPercent;
    const s4IsHigher = s4Diff > 0;
    const S4Icon = s4IsHigher ? TrendingUp : TrendingDown;

    evidenceItems.push({
      property: 'S4PRED Helix',
      value: `${peptide.s4predHelixPercent.toFixed(1)}%`,
      comparison: `${s4IsHigher ? 'More' : 'Less'} helical than cohort mean (${cohortStats.meanS4predHelixPercent.toFixed(1)}%)`,
      difference: `${s4IsHigher ? '+' : ''}${s4Diff.toFixed(1)}%`,
      icon: S4Icon,
      color: s4IsHigher ? 'text-green-600' : 'text-blue-600',
    });
  }

  // Aggregation propensity evidence (TANGO)
  if (typeof peptide.tangoAggMax === 'number' && peptide.tangoAggMax > 0) {
    const aggLevel = peptide.tangoAggMax > 20 ? 'HIGH' : peptide.tangoAggMax > 5 ? 'MODERATE' : 'LOW';
    const aggIcon = peptide.tangoAggMax > 5 ? TrendingUp : Minus;
    const aggColor = peptide.tangoAggMax > 20 ? 'text-red-600' : peptide.tangoAggMax > 5 ? 'text-amber-600' : 'text-green-600';

    evidenceItems.push({
      property: 'Aggregation Propensity',
      value: `Peak: ${peptide.tangoAggMax.toFixed(1)}%`,
      comparison: aggLevel === 'HIGH'
        ? 'Strong aggregation-prone region detected'
        : aggLevel === 'MODERATE'
          ? 'Aggregation hotspot present'
          : 'No significant aggregation hotspots',
      difference: aggLevel,
      icon: aggIcon,
      color: aggColor,
    });
  }

  // Hydrophobic moment evidence
  if (peptide.muH !== undefined && peptide.muH !== null) {
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
  // Show BOTH TANGO and S4PRED SSW, flag disagreements
  const tangoSSW = peptide.sswPrediction;
  const s4predSSW = peptide.s4predSswPrediction;
  const tangoAvailable = peptide.providerStatus?.tango?.status === "AVAILABLE";
  const s4predAvailable = peptide.providerStatus?.s4pred?.status === "available" || peptide.providerStatus?.s4pred?.status === "AVAILABLE";
  const hasTangoSSW = tangoAvailable && tangoSSW !== null && tangoSSW !== undefined && tangoSSW !== "null";
  const hasS4predSSW = s4predAvailable && s4predSSW !== null && s4predSSW !== undefined;

  const tangoLabel = !hasTangoSSW ? 'N/A' : tangoSSW === 1 ? 'Positive' : tangoSSW === -1 ? 'Negative' : 'N/A';
  const s4predLabel = !hasS4predSSW ? 'N/A' : s4predSSW === 1 ? 'Positive' : s4predSSW === -1 ? 'Negative' : 'N/A';

  // Determine if predictors disagree
  const bothAvailable = hasTangoSSW && hasS4predSSW;
  const predictorsDisagree = bothAvailable && tangoSSW !== s4predSSW;

  // Pick the "headline" SSW — prefer TANGO since it's the aggregation-specific predictor
  const headlineSSW = hasTangoSSW ? tangoSSW : hasS4predSSW ? s4predSSW : null;
  const sswEvidence = {
    property: 'SSW Prediction',
    value: headlineSSW === 1 ? 'Positive' : headlineSSW === -1 ? 'Negative' : 'N/A',
    icon: headlineSSW === 1 ? CheckCircle : headlineSSW === -1 ? XCircle : Minus,
    color: headlineSSW === 1 ? 'text-chameleon-positive' : headlineSSW === -1 ? 'text-muted-foreground' : 'text-muted-foreground',
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
        {/* SSW Predictions - Featured (show both TANGO and S4PRED) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-4 rounded-lg border-l-4 ${predictorsDisagree ? 'border-l-amber-500 bg-gradient-to-r from-amber-500/5 to-transparent' : 'border-l-chameleon-positive bg-gradient-to-r from-chameleon-positive/5 to-transparent'}`}
        >
          <div className="flex items-center space-x-3">
            <sswEvidence.icon className={`w-5 h-5 ${sswEvidence.color}`} />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">
                {sswEvidence.property}: {sswEvidence.value}
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span>TANGO: <strong className={hasTangoSSW && tangoSSW === 1 ? 'text-chameleon-positive' : ''}>{tangoLabel}</strong></span>
                <span>S4PRED: <strong className={hasS4predSSW && s4predSSW === 1 ? 'text-chameleon-positive' : ''}>{s4predLabel}</strong></span>
              </div>
              {predictorsDisagree && (
                <p className="text-xs text-amber-600 mt-1">
                  Predictors disagree — TANGO (aggregation-based) and S4PRED (structure-based) use different algorithms.
                </p>
              )}
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

        {/* Note when Chou-Fasman propensity differs significantly from S4PRED */}
        {peptide.ffHelixPercent != null &&
         peptide.s4predHelixPercent != null &&
         peptide.ffHelixPercent > 20 &&
         peptide.s4predHelixPercent < 5 && (
          <div className="mt-4 p-3 rounded-lg border border-muted text-xs text-muted-foreground leading-relaxed">
            <strong>Note:</strong> Chou-Fasman propensity ({peptide.ffHelixPercent.toFixed(0)}%) measures
            context-free amino acid helix tendency (1978 method). S4PRED ({peptide.s4predHelixPercent.toFixed(0)}%)
            uses a modern neural network. For short peptides, the residues may favor helix individually but
            not form a stable segment in context. <strong>S4PRED is the authoritative prediction.</strong>
          </div>
        )}

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
