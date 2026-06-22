import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, BarChart3, Zap, Waves, Target, Layers, BookOpen, Info } from "lucide-react";
import { BgNotebook } from "@/components/BgNotebook";
import AppFooter from "@/components/AppFooter";
import { DatasetCreditCard } from "@/components/DatasetCreditCard";

/**
 * Peleg-verbatim metric definitions (FIX-026 / FIX-027).
 * Ranges have been corrected to the actual Fauchere-Pliska + uH bounds.
 */
const metrics = [
  {
    icon: Zap,
    name: "Hydrophobicity",
    description: "Property quantifying the molecule or surface ability to repel water.",
    interpretation:
      "Range: −1.01 to 2.25. Higher values indicate more hydrophobic peptides. Here used as a feature to determine fibril-formation potential of secondary structure switch peptides.",
    color: "text-blue-600",
  },
  {
    icon: Waves,
    name: "Hydrophobic Moment (uH)",
    description:
      "Quantitative measurement of the amphiphilicity (asymmetry of hydrophobicity) of a peptide structure, representing the vector sum of hydrophobicity for amino acids in a helical arrangement.",
    interpretation:
      "Range: 0 to 3.26. Here used as a feature to determine fibril-formation potential of alpha-helical peptides.",
    color: "text-cyan-600",
  },
  {
    icon: Target,
    name: "Charge",
    description: "Net electrical charge of the peptide at physiological pH (pH = 7.4).",
    interpretation: "Positive values = cationic, negative = anionic, zero = neutral.",
    // PELEG-Q-FIX-022: signed vs absolute charge — Peleg flagged that |charge| loses
    // biological information. Discussion needed before changing presentation.
    color: "text-amber-600",
  },
  // 2026-06-07 (Peleg Drive 2026-05-22 + Zoom 2026-06-04): the 4 classification
  // sections below use her VERBATIM text. Ordering Helix → FF-Helix → SSW →
  // FF-SSW mirrors the KPI card row and the symmetry-of-treatment rule.
  // Two minor open confirmations in V2 doc Q2 (whether SSW references both gap
  // and min-SS-content thresholds; whether FF-SSW gate is hydrophobicity not μH)
  // — text below is shipped as Peleg wrote it; tweak only after she confirms.
  {
    icon: Layers,
    name: "Alpha-helix secondary structure (Helix)",
    description: "Determined by s4pred predictions and threshold.",
    interpretation:
      "Base class for FF-Helix. Classification is binary: helix-positive (at least one detected helix segment from Peleg's gap-smoothed segment finder applied to S4PRED) or helix-negative.",
    color: "text-helix",
  },
  {
    icon: Layers,
    name: "Fibril-forming alpha helix (FF-Helix)",
    description:
      "Determined by the uH threshold. If a peptide is predicted to be helical (as described above) and its uH is higher than the threshold uH, it will be predicted as a potential alpha-helical fibril-forming peptide.",
    interpretation:
      "Classification is binary: candidate or not. The μH threshold is dataset-derived (mean μH over helix-positive peptides in your batch). Single-sequence mode falls back to the Ragonis-Bachar / Rayan reference value 0.388.",
    color: "text-ff-helix",
  },
  {
    icon: BarChart3,
    name: "Secondary structure switch (SSW)",
    description:
      "Determined by Tango and/or s4pred. Peptide will be predicted as secondary structure switch if the difference between averaged scores of helicity and extended beta are lower than the maximum gap threshold. Meaning, for these sequences the secondary structure prediction tools were indecisive or predicted scores similar for both secondary structures.",
    interpretation:
      "Positive — predicted to undergo a structural switch.\nNegative — predicted stable (no switch).\nN/A — provider not available or sequence too short.\n\nThere is no connection between the SSW prediction and the fibril-forming potential. Only after taking hydrophobicity into account.",
    color: "text-ssw",
  },
  {
    icon: BarChart3,
    name: "Fibril-forming secondary structure switch (FF-SSW)",
    description:
      "Determined by the hydrophobicity threshold. If a peptide is predicted to be a secondary structure switch (as described above) and its hydrophobicity is higher than the threshold hydrophobicity, it will be predicted as a potential secondary structure switch fibril-forming.",
    interpretation:
      "Classification is binary: candidate or not. The hydrophobicity threshold is dataset-derived (mean hydrophobicity over SSW-positive peptides in your batch). Single-sequence mode falls back to the Ragonis-Bachar / Rayan reference value 0.417.",
    color: "text-ff-ssw",
  },
];

/**
 * Peleg-verbatim classification definitions (2026-06-07).
 *
 * Order mirrors the KPI card row: Helix → FF-Helix → SSW → FF-SSW.
 * Body text is COPIED VERBATIM from Peleg — do not rephrase. The short
 * `name` is the class label; `subtitle` is the long form; `accentVar`
 * is the CSS custom property used for the left-border accent.
 */
const classificationDefinitions = [
  {
    name: "Helix",
    subtitle: "Alpha-helix secondary structure",
    body: "Determined by s4pred predictions and threshold.",
    accentVar: "--helix",
  },
  {
    name: "FF-Helix",
    subtitle: "Fibril-forming alpha helix",
    body: "Determined by the uH threshold. If a peptide is predicted to be helical (as described above) and its uH is higher than the threshold uH, it will be predicted as a potential alpha-helical fibril-forming peptide.",
    accentVar: "--ff-helix",
  },
  {
    name: "SSW",
    subtitle: "Secondary structure switch",
    body: "Determined by Tango and/or s4pred. Peptide will be predicted as secondary structure switch if the difference between averaged scores of helicity and extended beta are lower than the maximum gap threshold. Meaning, for these sequences the secondary structure prediction tools were indecisive or predicted scores similar for both secondary structures.",
    accentVar: "--ssw",
  },
  {
    name: "FF-SSW",
    subtitle: "Fibril-forming secondary structure switch",
    body: "Determined by the hydrophobicity threshold. If a peptide is predicted to be a secondary structure switch (as described above) and its hydrophobicity is higher than the threshold hydrophobicity, it will be predicted as a potential secondary structure switch fibril-forming.",
    accentVar: "--ff-ssw",
  },
];

const chartTypes = [
  {
    name: "Scatter Plot",
    description: "Hydrophobicity vs Hydrophobic Moment correlation",
    // Peleg FIX-029 verbatim
    insights: "Identifies correlation between hydrophobicity and amphipathic nature of the peptide",
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
    // Peleg FIX-029 verbatim
    insights: "Compare No SSW vs SSW vs FF-SSW and No Helix vs Helix vs FF-Helix",
  },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-background relative">
      <BgNotebook />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center w-14 h-14 mx-auto bg-primary/10 rounded-2xl">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-h1 text-foreground page-header-title">Help & Documentation</h1>
            <p className="text-body text-muted-foreground max-w-2xl mx-auto">
              Learn how to interpret peptide metrics and make the most of your analysis results.
            </p>
          </div>

          {/* Metrics Explanation */}
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
                          {/* Peleg FIX-027 SSW interpretation uses newline-separated lines */}
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {metric.interpretation}
                          </p>
                        </div>
                      </div>
                    </div>
                    {index < metrics.length - 1 && <Separator className="my-4" />}
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>

          {/* Classification Definitions — Peleg verbatim (2026-06-07).
              Ordering matches the KPI cards: Helix → FF-Helix → SSW → FF-SSW. */}
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers className="w-5 h-5 mr-2 text-primary" />
                Classification Definitions
              </CardTitle>
              <CardDescription>
                The four classes PVL surfaces, defined verbatim from Peleg's notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {classificationDefinitions.map((cls, index) => (
                <motion.section
                  key={cls.name}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg border border-[hsl(var(--border))] bg-card p-4"
                  style={{ borderLeft: `4px solid hsl(var(${cls.accentVar}))` }}
                  data-testid={`classification-section-${cls.name.toLowerCase()}`}
                >
                  <h3 className="font-semibold text-foreground">{cls.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{cls.subtitle}</p>
                  <p className="text-sm text-foreground/90 mt-2 leading-relaxed">{cls.body}</p>
                </motion.section>
              ))}
            </CardContent>
          </Card>

          {/* Chart Types */}
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl border-primary/20 bg-primary/5">
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
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
                {/* Peleg FIX-030: FF-Helix classification consolidated into Peptide Metrics
                    Explained (above). FF-SSW uses TANGO OR S4PRED (FIX-001 OR-logic). */}
                {[
                  {
                    name: "FF-SSW Classification",
                    description:
                      "A peptide is classified as FF-SSW when TANGO or S4PRED predicts a Secondary Structure Switch (SSW) AND the mean hydrophobicity is above the database hydrophobicity threshold. This identifies peptides with structural switching potential and hydrophobic character.",
                  },
                  {
                    name: "Aggregation Propensity Interpretation",
                    description:
                      "The lollipop chart shows peak TANGO aggregation per peptide. Higher peaks indicate regions with higher aggregation propensity. Aggregation-prone regions are where per-residue aggregation exceeds the configured threshold (see Threshold Presets).",
                  },
                  {
                    name: "Correlation Matrix Guide",
                    description:
                      "The matrix shows Spearman rank correlation (ρ) between all metric pairs. Blue = positive correlation, Red = negative. Bold values indicate |ρ| > 0.5 (strong). Click any cell to view the underlying scatter plot with trend line.",
                  },
                  {
                    name: "Candidate Ranking System",
                    // Peleg FIX-030 verbatim: drop TANGO aggregation and SSW score from default
                    // ranking description. "We shouldn't look on the SSW score at all. It does
                    // not mean anything." (Peleg)
                    description:
                      "Ranking uses percentile normalization (0-100) across the active metrics: hydrophobicity, μH, FF-Helix, S4PRED helix %, and (optionally) |charge|. Weight sliders control each metric's influence. Presets: Equal, Fibril-formation Focus, Helix Focus, and Switch Focus.",
                  },
                  {
                    name: "Threshold Presets",
                    // Peleg FIX-030 + PELEG-Q5/Q6/PEL-G-RESOLVED (2026-05-06):
                    // legacy aggregation-flagging parameters were removed; only
                    // the configurable TANGO aggregation threshold remains under Group 4.
                    description:
                      "Recommended (default): thresholds computed from your data using database median. Custom: manually set the thresholds across the 4 groups (general SS, helical, SS-switch, fibril-formation). The TANGO aggregation threshold (default 5) is configurable under fibril-formation thresholds; pending citation.",
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
          <Card className="shadow-soft border-[hsl(var(--border))] rounded-xl">
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
                <h4 className="font-medium">Helix %</h4>
                <p className="text-sm text-muted-foreground">
                  {/* PELEG-Q1-RESOLVED: Chou-Fasman / Fauchere-Pliska helix-propensity
                      framing dropped per Said+Peleg 2026-05-06. Helix % is now a single
                      canonical metric (segment-based S4PRED). */}
                  <strong className="text-foreground">Helix %</strong> is the segment-based S4PRED
                  helix percentage: the fraction of residues that fall inside helix segments meeting
                  the minimal-continuous-residues threshold (default &ge;5) and the minimal helix
                  score threshold (default P(Helix) &ge; 0.5).
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">SSW helix percentage (TANGO-side)</h4>
                <p className="text-sm text-muted-foreground">
                  The API field <code>sswHelixPercentage</code> is the percentage of residues with a
                  TANGO helix-track score &gt; 0. It is used internally for SSW negative-result
                  classification (helix track empty vs. helix-beta overlap absent vs. genuine
                  negative) and is not the canonical Helix %. Do not compare it against the Helix
                  column.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">S4PRED</h4>
                <p className="text-sm text-muted-foreground">
                  S4PRED (Single Sequence Secondary Structure Prediction) predicts per-residue
                  secondary structure from amino acid sequence alone (no multiple sequence alignment
                  required). It outputs probabilities for three classes: Helix (H), Beta-strand (E),
                  and Coil (C). The per-residue prediction shown in the Sequence Track uses the
                  highest-probability class at each position.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">SSW (Secondary Structure Switch)</h4>
                <p className="text-sm text-muted-foreground">
                  SSW prediction identifies peptides that may switch between alpha-helix and
                  beta-sheet conformations. This is relevant for amyloid formation and
                  fibril-forming behavior. The prediction uses either TANGO (aggregation
                  thermodynamics) or S4PRED (helix/beta balance), comparing helix and beta
                  propensities against dataset-level averages. A "Positive" prediction suggests the
                  peptide has significant propensity for both helix and beta structures, indicating
                  potential for structural switching.
                </p>
              </div>
              <Separator />
              {/* D4 (Peleg 2026-06-18): explain why PVL has no standalone
                  "aggregation" class. TANGO score is an INPUT to the
                  Helix / SSW / FF-Helix / FF-SSW classification, not an
                  endpoint of its own. Surfaces the design decision Peleg
                  asked for. */}
              <div className="space-y-2">
                <h4 className="font-medium">Why no "aggregation" class?</h4>
                <p className="text-sm text-muted-foreground">
                  TANGO predicts <strong>aggregation propensity</strong>, not fibril formation.
                  Aggregation is one input to PVL's classification, alongside S4PRED secondary
                  structure and biochemical features. PVL exposes four endpoints — Helix,
                  Fibril-forming helix (FF-Helix), Secondary structure switch (SSW), and
                  Fibril-forming SSW (FF-SSW) — because these are the categories that have
                  experimental support in the literature. A peptide with a high TANGO score but no
                  helix/SSW signal is not, on its own, a fibril candidate. The aggregation curve is
                  shown on every peptide for context, but it is not a classification output.
                </p>
              </div>
              <Separator />
              {/* E1/E2/E3 (Peleg 2026-06-18): primary scientific references for
                  the metrics PVL surfaces. Bibliographic entries kept short so
                  the Help page stays scannable. */}
              <div className="space-y-2">
                <h4 className="font-medium">References &amp; thresholds</h4>
                <ul className="text-sm text-muted-foreground list-disc list-outside ml-5 space-y-1">
                  <li>
                    <strong className="text-foreground">Hydrophobicity scale.</strong> Fauchère, J.
                    &amp; Pliska, V. (1983). <em>Eur. J. Med. Chem.</em> 18, 369–375. Octanol/water
                    partition coefficients used both for the FF-Helix µH gate and the FF-SSW
                    hydrophobicity gate.
                  </li>
                  <li>
                    <strong className="text-foreground">Hydrophobic moment (µH).</strong> Eisenberg,
                    D., Weiss, R. M. &amp; Terwilliger, T. C. (1982). <em>Nature</em> 299, 371–374.
                    Helical-wheel vector sum with periodicity 100°.
                  </li>
                  <li>
                    <strong className="text-foreground">FF-Helix framing.</strong> Hamodrakas, S. J.
                    (2007). <em>FEBS J.</em> 274, 6107–6122. "Concentric model" for amphipathic
                    α-helices and fibril formation; PVL's FF-Helix definition builds on this.
                  </li>
                  <li>
                    <strong className="text-foreground">S4PRED secondary structure.</strong> Moffat,
                    L. &amp; Jones, D. T. (2021). <em>Bioinformatics</em> 37, 3744–3751. Ensemble
                    BiLSTM single-sequence 3-state predictor.
                  </li>
                  <li>
                    <strong className="text-foreground">TANGO β-aggregation.</strong>{" "}
                    Fernandez-Escamilla, A.-M. et al. (2004). <em>Nat. Biotechnol.</em> 22,
                    1302–1306.
                  </li>
                  <li>
                    <strong className="text-foreground">PVL default thresholds.</strong>{" "}
                    Ragonis-Bachar et al., in preparation (2026). Used for the µH and hydrophobicity
                    gates when no batch is available for auto-tuning.
                  </li>
                </ul>
              </div>
              <Separator />
              {/* Dataset attribution — referenced by the upcoming gold-standard
                  accuracy badges (T2 §H). Released 2026-05-08 per ADR-014. */}
              <div className="space-y-2">
                <h4 className="font-medium">Benchmark dataset</h4>
                <DatasetCreditCard variant="compact" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <AppFooter />
      </div>
    </div>
  );
}
