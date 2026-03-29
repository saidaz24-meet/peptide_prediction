import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, BarChart3, Zap, Waves, Target, Layers, BookOpen, Info } from "lucide-react";

const metrics = [
  {
    icon: Zap,
    name: "Hydrophobicity",
    description: "Measure of how water-repelling the peptide is",
    interpretation: "Higher values indicate more hydrophobic peptides. Typical range: -2.0 to +2.0",
    color: "text-blue-600",
  },
  {
    icon: Waves,
    name: "Hydrophobic Moment (μH)",
    description: "Quantifies amphipathic character of the peptide",
    interpretation:
      "Higher values suggest better membrane interaction potential. Range: 0.0 to 1.0",
    color: "text-cyan-600",
  },
  {
    icon: Target,
    name: "Charge",
    description: "Net electrical charge of the peptide at physiological pH",
    interpretation: "Positive values = cationic, negative = anionic, zero = neutral",
    color: "text-amber-600",
  },
  {
    icon: Layers,
    name: "FF-Helix % (Fibril-Forming Helix Propensity)",
    description:
      "Percentage of residues in sliding windows (6 residues) with mean Fauchere-Pliska helix propensity above threshold (1.0). This is a sequence-based propensity score, NOT a prediction of actual helical content.",
    interpretation:
      "0% = no 6-residue window exceeds the propensity threshold. 100% = all residues participate in qualifying windows. Do NOT compare to CD spectroscopy values (which measure environment-dependent helicity of 15-50% in membranes). FF-Helix measures intrinsic amino acid tendency only.",
    color: "text-purple-600",
  },
  {
    icon: BarChart3,
    name: "SSW Prediction",
    description:
      "Secondary Structure Switch prediction from TANGO aggregation analysis and/or S4PRED neural network. Indicates whether the peptide may undergo a conformational switch between helix and beta-sheet.",
    interpretation:
      "Positive = predicted to undergo structural switch (potential amyloid/fibril former). Negative = predicted stable (no switch). N/A = provider not available or sequence too short.",
    color: "text-chameleon-positive",
  },
];

const chartTypes = [
  {
    name: "Scatter Plot",
    description: "Hydrophobicity vs Hydrophobic Moment correlation",
    insights: "Identify peptides with optimal amphipathic properties",
  },
  {
    name: "Distribution Histograms",
    description: "Statistical distribution of key properties",
    insights: "Understand the overall characteristics of your dataset",
  },
  {
    name: "Proportion Donuts",
    description: "Breakdown of categorical predictions",
    insights: "Quick overview of prediction distributions",
  },
  {
    name: "Radar Charts",
    description: "Multi-dimensional comparison profiles",
    insights: "Compare SSW vs No SSW cohorts",
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-primary/10 rounded-2xl">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Help & Documentation</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Learn how to interpret peptide metrics and make the most of your analysis results
            </p>
          </div>

          {/* Metrics Explanation */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="w-5 h-5 mr-2 text-primary" />
                Peptide Metrics Explained
              </CardTitle>
              <CardDescription>
                Understanding the key properties analyzed in your dataset
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${metric.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{metric.name}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{metric.description}</p>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm font-medium text-foreground">Interpretation:</p>
                          <p className="text-sm text-muted-foreground">{metric.interpretation}</p>
                        </div>
                      </div>
                    </div>
                    {index < metrics.length - 1 && <Separator className="my-4" />}
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>

          {/* Chart Types */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                Visualization Guide
              </CardTitle>
              <CardDescription>How to read and interpret the different chart types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {chartTypes.map((chart, index) => (
                  <motion.div
                    key={chart.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-3 p-4 rounded-lg border border-border/50 bg-card"
                  >
                    <h3 className="font-semibold text-foreground">{chart.name}</h3>
                    <p className="text-sm text-muted-foreground">{chart.description}</p>
                    <div className="bg-primary/5 rounded-md p-3">
                      <p className="text-sm font-medium text-primary">Key Insights:</p>
                      <p className="text-sm text-muted-foreground">{chart.insights}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Color Legend */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Color Conventions</CardTitle>
              <CardDescription>
                Standard color coding used throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-chameleon-positive"></div>
                  <span className="text-sm">SSW</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-chameleon-negative"></div>
                  <span className="text-sm">No SSW</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-helix"></div>
                  <span className="text-sm">Helix Segments</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips Section */}
          <Card className="shadow-medium border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <HelpCircle className="w-5 h-5 mr-2" />
                Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h4 className="font-medium">Data Quality</h4>
                <p className="text-sm text-muted-foreground">
                  Ensure your CSV has clean, numeric values for best results. Missing values will be
                  handled gracefully.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Filtering & Sorting</h4>
                <p className="text-sm text-muted-foreground">
                  Use the data table filters to focus on specific subsets of your peptides for
                  targeted analysis.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Export Options</h4>
                <p className="text-sm text-muted-foreground">
                  Export filtered results to CSV or individual peptide data to JSON for further
                  analysis.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Topics */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="w-5 h-5 mr-2 text-primary" />
                Advanced Topics
              </CardTitle>
              <CardDescription>
                Detailed explanations of classification systems and analysis features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    name: "FF-Helix Classification",
                    description:
                      "A peptide is classified as an FF-Helix candidate when S4PRED predicts helical structure AND the hydrophobic moment (μH) is above the cohort average. This identifies amphipathic helices that could form fibril-like assemblies. It is NOT a CD spectroscopy measurement.",
                  },
                  {
                    name: "FF-SSW Classification",
                    description:
                      "A peptide is classified as FF-SSW when TANGO predicts a Secondary Structure Switch (SSW) AND the mean hydrophobicity is above the cohort average. This identifies peptides with structural switching potential and a hydrophobic core — key features of amyloid fibril formation.",
                  },
                  {
                    name: "Aggregation Propensity Interpretation",
                    description:
                      "The lollipop chart shows peak TANGO aggregation per peptide. Green (<5%) = low propensity, Yellow (5-20%) = moderate — potential aggregation hotspot, Red (>20%) = high — strong amyloid-forming propensity. Hotspot regions are where per-residue aggregation exceeds the threshold.",
                  },
                  {
                    name: "Correlation Matrix Guide",
                    description:
                      "The matrix shows Spearman rank correlation (ρ) between all metric pairs. Blue = positive correlation, Red = negative. Bold values indicate |ρ| > 0.5 (strong). Click any cell to view the underlying scatter plot with trend line and consensus tier coloring.",
                  },
                  {
                    name: "Candidate Ranking System",
                    description:
                      "Ranking uses percentile normalization (0-100) across 6 metrics: hydrophobicity, |charge|, μH, FF-Helix %, SSW score, and TANGO Agg Max. Weight sliders (0-1) control each metric's influence. Presets: Equal (all 1.0), Physicochemical (emphasize biochem), Aggregation (emphasize TANGO).",
                  },
                  {
                    name: "Threshold Presets",
                    description:
                      "Recommended (default): thresholds computed from your data using cohort median. Custom: manually set μH cutoff, hydrophobicity cutoff, and aggregation thresholds. Custom values override Peleg's validated reference values — use with care for publication-quality analysis.",
                  },
                ].map((topic, index) => (
                  <motion.div
                    key={topic.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-3 p-4 rounded-lg border border-border/50 bg-card"
                  >
                    <h3 className="font-semibold text-foreground">{topic.name}</h3>
                    <p className="text-sm text-muted-foreground">{topic.description}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scientific Notes */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-primary" />
                Scientific Notes
              </CardTitle>
              <CardDescription>
                Important methodological details for interpreting results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h4 className="font-medium">FF-Helix % vs S4PRED Helix %</h4>
                <p className="text-sm text-muted-foreground">
                  PVL reports two helix-related metrics that measure different things:
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">S4PRED Helix %</strong> is the primary helix
                  prediction. A modern neural network (5-model ensemble) predicts per-residue helix,
                  beta-sheet, and coil probabilities considering the full sequence context. Helix
                  segments require &ge;5 consecutive residues with P(Helix) &ge; 0.5.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">FF-Helix %</strong> (Fibril-Forming Helix
                  Propensity) is a context-free scoring method using the Fauchere-Pliska helix
                  propensity scale with a 6-residue sliding window. It measures the intrinsic amino
                  acid tendency to form helices, ignoring sequence context and environment. A value
                  of 0% means no window exceeds the threshold; 100% means all residues participate
                  in qualifying windows. These values should{" "}
                  <strong className="text-foreground">not</strong> be compared to experimental CD
                  spectroscopy measurements (which report environment-dependent helicity, typically
                  15-50% in membrane environments).
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">S4PRED Neural Network</h4>
                <p className="text-sm text-muted-foreground">
                  S4PRED (Single Sequence Secondary Structure PREDiction) is an ensemble of 5 neural
                  networks that predicts per-residue secondary structure from amino acid sequence
                  alone (no multiple sequence alignment required). It outputs probabilities for
                  three classes: Helix (H), Beta-strand (E), and Coil (C). The per-residue
                  prediction shown in the Sequence Track uses the highest-probability class at each
                  position.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">SSW (Secondary Structure Switch)</h4>
                <p className="text-sm text-muted-foreground">
                  SSW prediction identifies peptides that may switch between alpha-helix and
                  beta-sheet conformations. This is relevant for amyloid formation and
                  fibril-forming behavior. The prediction uses either TANGO (aggregation
                  thermodynamics) or S4PRED (neural network helix/beta balance), comparing helix and
                  beta propensities against dataset-level averages. A "Positive" prediction suggests
                  the peptide has significant propensity for both helix and beta structures,
                  indicating potential for structural switching.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
