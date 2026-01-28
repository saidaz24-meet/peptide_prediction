/**
 * Metric definitions for card-based navigation to detail pages.
 * Each metric has: definition, chart type, and relevant table columns.
 */

export type MetricId = 
  | 'ssw-positive'
  | 'ff-helix'
  | 'hydrophobicity'
  | 'charge'
  | 'ff-secondary-switch'
  | 'ff-helix-flag';

export interface MetricDefinition {
  id: MetricId;
  title: string;
  description: string;
  definition: string; // Scientific definition for detail page
  chartType: 'distribution' | 'scatter' | 'pie' | 'bar';
  tableColumns: string[]; // Columns to show in filtered table
  statKey?: keyof import('./peptide').DatasetStats; // Key in stats object for summary value
  statFormatter?: (value: number, stats: import('./peptide').DatasetStats) => string;
}

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  'ssw-positive': {
    id: 'ssw-positive',
    title: 'SSW Positive',
    description: 'Percentage of peptides with Secondary Structure Switch (SSW) prediction = positive',
    definition: 'SSW (Secondary Structure Switch) prediction indicates membrane-active peptides that can switch between different secondary structures. A positive prediction (1) suggests the peptide has the potential for membrane interaction and structural switching behavior.',
    chartType: 'pie',
    tableColumns: ['id', 'name', 'sswPrediction', 'sswScore', 'sswDiff', 'sswHelixPct', 'sswBetaPct', 'hydrophobicity', 'charge'],
    statKey: 'sswPositivePercent',
    statFormatter: (value) => `${value.toFixed(1)}%`,
  },
  'ff-helix': {
    id: 'ff-helix',
    title: 'Avg FF-Helix',
    description: 'Average percentage of residues in Fibril-Forming Helix cores',
    definition: 'FF-Helix % represents the percentage of residues that belong to sliding windows (≥6 residues) with mean helix propensity ≥ 1.0. Higher values indicate more regions with helix-forming potential, which is associated with fibril-forming capability in helical peptides.',
    chartType: 'distribution',
    tableColumns: ['id', 'name', 'ffHelixPercent', 'ffHelixFragments', 'muH', 'hydrophobicity', 'charge', 'length'],
    statKey: 'meanFFHelixPercent',
    statFormatter: (value) => `${value.toFixed(1)}%`,
  },
  'hydrophobicity': {
    id: 'hydrophobicity',
    title: 'Avg Hydrophobicity',
    description: 'Average hydrophobicity across the dataset',
    definition: 'Hydrophobicity is calculated using the Fauchere-Pliska scale, which assigns a hydrophobicity value to each amino acid. Negative values indicate hydrophilic residues (water-loving), while positive values indicate hydrophobic residues (water-avoiding). Higher hydrophobicity is associated with membrane interaction potential.',
    chartType: 'distribution',
    tableColumns: ['id', 'name', 'hydrophobicity', 'charge', 'muH', 'sswPrediction', 'length'],
    statKey: 'meanHydrophobicity',
    statFormatter: (value) => value.toFixed(2),
  },
  'charge': {
    id: 'charge',
    title: 'Avg Charge',
    description: 'Average net charge at pH 7',
    definition: 'Charge represents the net electrical charge of the peptide at neutral pH (pH 7). It is calculated by summing the charge contributions of all amino acids: positively charged residues (K, R, H) contribute +1, negatively charged residues (D, E) contribute -1. Charge influences peptide solubility, membrane interaction, and aggregation behavior.',
    chartType: 'distribution',
    tableColumns: ['id', 'name', 'charge', 'hydrophobicity', 'muH', 'sswPrediction', 'length'],
    statKey: 'meanCharge',
    statFormatter: (value) => value.toFixed(2),
  },
  'ff-secondary-switch': {
    id: 'ff-secondary-switch',
    title: 'Fibril Formation (SSW)',
    description: 'Peptides predicted to form fibrils via Secondary Structure Switch mechanism',
    definition: 'FF-Secondary Structure Switch indicates peptides that are predicted to form fibrils through a secondary structure switching mechanism. This prediction is based on TANGO analysis combined with hydrophobicity thresholds. Peptides with SSW prediction = 1 and hydrophobicity above the cohort average are flagged as fibril-forming via SSW.',
    chartType: 'pie',
    tableColumns: ['id', 'name', 'sswPrediction', 'hydrophobicity', 'sswScore', 'sswDiff', 'charge', 'muH'],
  },
  'ff-helix-flag': {
    id: 'ff-helix-flag',
    title: 'Fibril Formation (Helix)',
    description: 'Peptides predicted to form fibrils via alpha-helical mechanism',
    definition: 'FF-Helix flag indicates peptides predicted to form fibrils through an alpha-helical mechanism. This is determined by the presence of JPred-predicted helix segments with average hydrophobic moment (μH) above the cohort threshold. These peptides have helix-forming regions that can aggregate into fibrillar structures.',
    chartType: 'pie',
    tableColumns: ['id', 'name', 'ffHelixPercent', 'ffHelixFragments', 'muH', 'jpred', 'hydrophobicity', 'charge'],
  },
};

