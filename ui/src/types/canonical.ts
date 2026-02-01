/**
 * Canonical TypeScript Interfaces for Peptide Analysis
 *
 * These interfaces mirror the Python Pydantic models in backend/schemas/canonical.py
 * All API responses conform to these schemas.
 *
 * Naming Conventions:
 * - TypeScript: camelCase for field names
 * - null for missing values (NOT -1, NOT "N/A", NOT empty string)
 *
 * Created: 2026-02-01
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Classification result from aggregation prediction.
 *
 * Values:
 *   -1: Predicted NOT to undergo structural switch
 *   0: Uncertain / borderline
 *   1: Predicted to undergo structural switch
 */
export type PredictionClass = -1 | 0 | 1;

/**
 * Status of an external prediction provider.
 */
export type ProviderStatusValue =
  | "OFF" // Provider is disabled in configuration
  | "UNAVAILABLE" // Provider enabled but not reachable/working
  | "PARTIAL" // Provider ran but some results failed
  | "AVAILABLE"; // Provider ran successfully

// =============================================================================
// Provider Status Types
// =============================================================================

/**
 * Statistics for a provider run.
 */
export interface ProviderStats {
  /** Number of sequences submitted */
  requested: number;
  /** Number successfully parsed */
  parsedOk: number;
  /** Number that failed parsing */
  parsedBad: number;
}

/**
 * Status of a single prediction provider.
 */
export interface SingleProviderStatus {
  /** Current status */
  status: ProviderStatusValue;
  /** Reason if unavailable */
  reason?: string | null;
  /** Run statistics if available */
  stats?: ProviderStats | null;
}

/**
 * Combined status for all prediction providers.
 *
 * Every peptide row MUST include this to indicate data provenance.
 */
export interface ProviderStatus {
  /** TANGO aggregation predictor status */
  tango: SingleProviderStatus;
  /** PSIPRED secondary structure (disabled) */
  psipred?: SingleProviderStatus | null;
  /** JPred secondary structure (disabled) */
  jpred?: SingleProviderStatus | null;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Results from aggregation prediction (TANGO).
 *
 * Contains the classification, scores, and per-residue curves
 * from the TANGO aggregation predictor.
 *
 * All fields are optional because:
 * - Provider may be disabled
 * - Provider may have failed for this sequence
 * - Per-residue curves may not be requested
 */
export interface AggregationResult {
  /** Classification: -1 (no switch), 0 (uncertain), 1 (switch) */
  prediction?: PredictionClass | null;

  /** Aggregation score (higher = more aggregation-prone) */
  score?: number | null;

  /** Score differential used for classification */
  diff?: number | null;

  /** Percentage of sequence predicted as helix (0-100) */
  helixPercentage?: number | null;

  /** Percentage of sequence predicted as beta (0-100) */
  betaPercentage?: number | null;

  /** Per-residue aggregation propensity (length = sequence length) */
  aggregationCurve?: number[] | null;

  /** Per-residue helix propensity */
  helixCurve?: number[] | null;

  /** Per-residue beta propensity */
  betaCurve?: number[] | null;

  /** Per-residue turn propensity */
  turnCurve?: number[] | null;
}

/**
 * A segment defined by start and end positions (1-indexed).
 */
export type Segment = [number, number];

/**
 * Secondary structure prediction results.
 *
 * Contains FF-Helix (local calculation) and optional PSIPRED results.
 * FF-Helix is always computed (no external dependency).
 * PSIPRED requires Docker and is optional.
 */
export interface SecondaryStructureResult {
  /** FF-Helix percentage (0-100), locally computed from propensity scale */
  ffHelixPercent?: number | null;

  /** Helix segments as [[start, end], ...], 1-indexed */
  ffHelixSegments?: Segment[] | null;

  /** Whether peptide is predicted to undergo structure switch */
  isStructureSwitch?: boolean | null;

  /** PSIPRED helix percentage (if available) */
  psipredHelixPercent?: number | null;

  /** PSIPRED beta percentage (if available) */
  psipredBetaPercent?: number | null;

  /** PSIPRED coil percentage (if available) */
  psipredCoilPercent?: number | null;

  /** PSIPRED helix segments (if available) */
  psipredHelixSegments?: Segment[] | null;
}

/**
 * Basic biophysical properties of a peptide.
 *
 * These are always computed (no external dependencies).
 */
export interface BiophysicalProperties {
  /** Net charge at pH 7.4 */
  charge?: number | null;

  /** Mean hydrophobicity (Fauchere-Pliska scale) */
  hydrophobicity?: number | null;

  /** Hydrophobic moment (μH) for alpha-helix geometry */
  hydrophobicMoment?: number | null;
}

/**
 * Toxicity prediction results.
 *
 * Note: Toxicity prediction is not currently implemented.
 * This interface is a placeholder for future functionality.
 */
export interface ToxicityResult {
  /** Whether peptide is predicted to be toxic */
  isToxic?: boolean | null;

  /** Toxicity probability (0-1) */
  toxicityScore?: number | null;

  /** Type of predicted toxicity (if any) */
  toxicityType?: string | null;
}

// =============================================================================
// Peptide Types
// =============================================================================

/**
 * Identity and metadata for a peptide.
 */
export interface PeptideIdentity {
  /** Unique identifier (UniProt accession or user-provided) */
  id: string;

  /** Amino acid sequence (1-letter code) */
  sequence: string;

  /** Sequence length */
  length: number;

  /** Protein name */
  name?: string | null;

  /** Organism/species */
  species?: string | null;
}

/**
 * Complete analysis results for a single peptide.
 *
 * This is the canonical model for peptide analysis output.
 * Combines identity, biophysics, and all prediction results.
 */
export interface PeptideAnalysis {
  // Identity (required)
  /** Unique identifier */
  id: string;

  /** Amino acid sequence */
  sequence: string;

  /** Sequence length */
  length: number;

  /** Protein name */
  name?: string | null;

  /** Organism/species */
  species?: string | null;

  // Biophysical properties (always computed)
  /** Net charge */
  charge?: number | null;

  /** Mean hydrophobicity */
  hydrophobicity?: number | null;

  /** Hydrophobic moment (μH) */
  muH?: number | null;

  // Aggregation prediction (TANGO)
  /** TANGO aggregation prediction results */
  aggregation?: AggregationResult | null;

  // Secondary structure
  /** Secondary structure prediction results */
  secondaryStructure?: SecondaryStructureResult | null;

  // Toxicity (future)
  /** Toxicity prediction results (not yet implemented) */
  toxicity?: ToxicityResult | null;

  // Provider status (required for data provenance)
  /** Status of prediction providers for this peptide */
  providerStatus: ProviderStatus;
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Request for peptide analysis.
 *
 * Can be used for single sequence or batch analysis.
 */
export interface AnalysisRequest {
  /** Amino acid sequence (1-letter code) */
  sequence: string;

  /** Entry/ID (defaults to 'adhoc') */
  entry?: string | null;

  /** Whether to run TANGO aggregation prediction */
  runTango?: boolean;

  /** Whether to include per-residue curves in response */
  includeCurves?: boolean;
}

/**
 * Response from single peptide analysis.
 */
export interface AnalysisResponse {
  /** Analysis results */
  result: PeptideAnalysis;

  /** Unique run identifier (UUID) */
  runId: string;

  /** Trace ID for request correlation */
  traceId: string;

  /** Summary of provider status for the run */
  providerSummary?: ProviderStatus | null;
}

/**
 * Response from batch peptide analysis (upload-csv, uniprot query).
 */
export interface BatchAnalysisResponse {
  /** List of analysis results */
  results: PeptideAnalysis[];

  /** Unique run identifier */
  runId: string;

  /** Trace ID for request correlation */
  traceId: string;

  /** Hash of input data for reproducibility */
  inputsHash: string;

  /** Hash of configuration for reproducibility */
  configHash: string;

  /** Total number of peptides processed */
  totalRows: number;

  /** Number of successfully analyzed peptides */
  successfulRows: number;

  /** Summary of provider status for the batch */
  providerSummary: ProviderStatus;
}

// =============================================================================
// Backward Compatibility Types (for migration period)
// =============================================================================

/**
 * Legacy field name mapping for migration.
 *
 * @deprecated These aliases will be removed after 2026-04-01
 */
export const DEPRECATED_FIELD_MAPPING = {
  sswPrediction: "aggregation.prediction",
  sswScore: "aggregation.score",
  sswDiff: "aggregation.diff",
  sswHelixPercentage: "aggregation.helixPercentage",
  sswBetaPercentage: "aggregation.betaPercentage",
  sswHelixPct: "aggregation.helixPercentage",
  sswBetaPct: "aggregation.betaPercentage",
  ffHelixPercent: "secondaryStructure.ffHelixPercent",
  ffHelixFragments: "secondaryStructure.ffHelixSegments",
} as const;

/**
 * Helper to check if a value is null or undefined.
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Helper to convert legacy -1 values to null.
 * Use this during migration to normalize old data.
 */
export function normalizeValue<T>(
  value: T | -1 | null | undefined,
): T | null {
  if (value === -1 || value === null || value === undefined) {
    return null;
  }
  return value;
}
