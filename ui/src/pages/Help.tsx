import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  HelpCircle, 
  BarChart3, 
  Zap, 
  Waves, 
  Target, 
  Layers,
  BookOpen,
  Info
} from 'lucide-react';

const metrics = [
  {
    icon: Zap,
    name: 'Hydrophobicity',
    description: 'Measure of how water-repelling the peptide is',
    interpretation: 'Higher values indicate more hydrophobic peptides. Typical range: -2.0 to +2.0',
    color: 'text-blue-600',
  },
  {
    icon: Waves,
    name: 'Hydrophobic Moment (μH)',
    description: 'Quantifies amphipathic character of the peptide',
    interpretation: 'Higher values suggest better membrane interaction potential. Range: 0.0 to 1.0',
    color: 'text-cyan-600',
  },
  {
    icon: Target,
    name: 'Charge',
    description: 'Net electrical charge of the peptide at physiological pH',
    interpretation: 'Positive values = cationic, negative = anionic, zero = neutral',
    color: 'text-amber-600',
  },
  {
    icon: Layers,
    name: 'FF-Helix Percentage',
    description: 'Predicted percentage of helical secondary structure (JPred)',
    interpretation: 'Higher percentages indicate more structured peptides. Range: 0-100%',
    color: 'text-helix',
  },
  {
    icon: BarChart3,
    name: 'SSW Prediction',
    description: 'Binary prediction for membrane-active potential',
    interpretation: 'Positive = likely membrane-active, Negative = likely not membrane-active',
    color: 'text-chameleon-positive',
  },
];

const chartTypes = [
  {
    name: 'Scatter Plot',
    description: 'Hydrophobicity vs Hydrophobic Moment correlation',
    insights: 'Identify peptides with optimal amphipathic properties',
  },
  {
    name: 'Distribution Histograms',
    description: 'Statistical distribution of key properties',
    insights: 'Understand the overall characteristics of your dataset',
  },
  {
    name: 'Proportion Donuts',
    description: 'Breakdown of categorical predictions',
    insights: 'Quick overview of prediction distributions',
  },
  {
    name: 'Radar Charts',
    description: 'Multi-dimensional comparison profiles',
    insights: 'Compare SSW-positive vs negative cohorts',
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
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${metric.color}`}>
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
              <CardDescription>
                How to read and interpret the different chart types
              </CardDescription>
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
                  <span className="text-sm">SSW Positive</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-chameleon-negative"></div>
                  <span className="text-sm">SSW Negative</span>
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
                  Ensure your CSV has clean, numeric values for best results. Missing values will be handled gracefully.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Filtering & Sorting</h4>
                <p className="text-sm text-muted-foreground">
                  Use the data table filters to focus on specific subsets of your peptides for targeted analysis.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Export Options</h4>
                <p className="text-sm text-muted-foreground">
                  Export filtered results to CSV or individual peptide data to JSON for further analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}