// src/types/peptide.ts
//
// CONTRACT SOURCE: backend/schemas/api_models.py (PeptideRow)
// This file must stay in sync with the backend Pydantic model.
// Run `make contract-check` to verify alignment.
//
// SSW Semantics (LOCKED):
//   sswPrediction: 1 = positive, -1 = negative, 0 = uncertain, null = missing
// Provider Status (LOCKED):
//   providerStatus.<provider>.status: "AVAILABLE" | "UNAVAILABLE" | "PARTIAL" | "OFF"
//

// ----- Segments -----
// You previously used an object-style Segment. Keep it.
export type Segment = {
  start: number;
  end: number;
  score?: number;
};

// Also allow tuple segments (some mappers/components prefer this form).
export type SegmentTuple = [number, number];

// ----- Prediction enums -----
// SSWPrediction semantic values:
// -1 = predicted NOT to undergo structural switch (valid prediction)
//  0 = uncertain/unknown
//  1 = predicted to undergo structural switch
// null = no prediction available (provider didn't run or failed)
export type SSWPrediction = -1 | 0 | 1 | null;

// ----- Provider Status -----
// Single provider status shape
export type SingleProviderStatus = {
  enabled?: boolean;
  requested?: boolean;
  ran?: boolean;
  status: 'OFF' | 'UNAVAILABLE' | 'PARTIAL' | 'AVAILABLE';
  reason?: string | null;
  stats?: {
    requested: number;
    parsed_ok: number;
    parsed_bad: number;
  };
};

export type ProviderStatus = {
  tango?: SingleProviderStatus;
  s4pred?: SingleProviderStatus;
};

// ----- Core Peptide model used across the UI -----
// NOTE: Fields that can be `null` from the backend are typed as `| null`.
// `null` means "data is missing/unavailable" (provider didn't run or failed).
// `undefined` means "field not present in response".
// Actual zero values (0, 0.0) are valid data and should not be confused with null.
export type Peptide = {
  // identity & metadata (required)
  id: string;
  name?: string | null;
  species?: string | null;

  // UniProt metadata (optional, only present for UniProt-sourced data)
  geneName?: string | null;
  proteinFunction?: string | null;
  annotationScore?: number | null;

  // sequence (required)
  sequence: string;
  length: number | null;  // null if not computed

  // basic biophysics (can be null if not computed)
  hydrophobicity: number | null;
  muH?: number | null;  // hydrophobic moment if present
  charge: number | null;

  // Tango / SSW (Secondary Structure Switch)
  // sswPrediction can be -1/0/1 (valid predictions) or null (no prediction available)
  sswPrediction: SSWPrediction;  // from "SSW prediction"
  sswScore?: number | null;      // "SSW score" - null if TANGO unavailable
  sswDiff?: number | null;       // "SSW diff" - null if TANGO unavailable
  sswHelixPct?: number | null;   // "SSW helix percentage" - null if TANGO unavailable
  sswBetaPct?: number | null;    // "SSW beta percentage" - null if TANGO unavailable

  // FF-Helix (from auxiliary - always computed locally)
  ffHelixPercent?: number | null;                            // "FF-Helix %"
  ffHelixFragments?: Array<SegmentTuple> | Segment[];        // "FF Helix fragments"

  // FF flags (database-level binary classification from reference implementation)
  // Thresholds verified against Peleg's reference dataset (2026-02-26). Fallback: H=0.417, uH=0.388.
  ffHelixFlag?: number | null;    // 1 (candidate), -1 (not candidate), null (no data). S4PRED-based.
  ffHelixScore?: number | null;   // helix_uH + helix_score
  ffSswFlag?: number | null;      // 1 (candidate), -1 (not candidate), null (no data)
  ffSswScore?: number | null;     // Hydrophobicity + Beta_uH + Full_length_uH + SSW_prediction

  // ----- Unified secondary-structure percentages used by Results table -----
  // These are filled by the mapper from S4PRED if present, otherwise Tango fallback.
  helixPercent?: number | null;   // preferred: S4PRED helix %; fallback: "SSW helix percentage"
  betaPercent?: number | null;    // preferred: S4PRED beta %;  fallback: "SSW beta percentage"

  // --- Optional Tango per-residue curves
  tango?: {
    agg?: number[];   // Aggregation curve
    beta?: number[];  // Beta curve
    helix?: number[]; // Helix curve
    turn?: number[];  // Turn curve
  };

  // Canonical Tango summary fields (from backend, preferred over computing from extras)
  // These provide a single source of truth for UI display
  tangoHasData?: boolean;        // True if any Tango curves are available
  tangoAggMax?: number | null;   // Max value of Aggregation curve (risk indicator)
  tangoBetaMax?: number | null;  // Max value of Beta curve
  tangoHelixMax?: number | null; // Max value of Helix curve

  // ----- S4PRED secondary structure predictions -----
  // From backend/s4pred.py - matches reference 260120_Alpha_and_SSW_FF_Predictor/s4pred.py
  // Helix predictions
  s4predHelixPrediction?: number | null;              // -1 no helix, 1 helix found (alias: 'Helix prediction (S4PRED)')
  s4predHelixFragments?: Array<SegmentTuple> | null;  // segment tuples (alias: 'Helix fragments (S4PRED)')
  s4predHelixScore?: number | null;                   // avg helix score (alias: 'Helix score (S4PRED)')
  s4predHelixPercent?: number | null;                 // helix percentage 0-100 (alias: 'Helix percentage (S4PRED)')
  // SSW (Secondary Structure Switch) predictions
  s4predSswPrediction?: number | null;                // -1/1 (alias: 'SSW prediction (S4PRED)')
  s4predSswFragments?: Array<SegmentTuple> | null;    // SSW segment tuples (alias: 'SSW fragments (S4PRED)')
  s4predSswScore?: number | null;                     // SSW score (alias: 'SSW score (S4PRED)')
  s4predSswDiff?: number | null;                      // SSW diff (alias: 'SSW diff (S4PRED)')
  s4predSswHelixPercent?: number | null;              // SSW helix % (alias: 'SSW helix percentage (S4PRED)')
  s4predSswBetaPercent?: number | null;               // SSW beta % (alias: 'SSW beta percentage (S4PRED)')
  s4predSswPercent?: number | null;                   // SSW overlap % (alias: 'SSW percentage (S4PRED)')
  s4predHasData?: boolean;                            // True if S4PRED ran and produced results
  // S4PRED per-residue curves (for PeptideDetail view)
  s4pred?: {
    pH?: number[];    // per-residue P(helix)
    pE?: number[];    // per-residue P(beta)
    pC?: number[];    // per-residue P(coil)
    ssPrediction?: string[];  // per-residue SS prediction ('C', 'H', 'E')
    helixSegments?: Array<[number, number]>;  // Helix segment tuples
    betaSegments?: Array<[number, number]>;   // Beta segment tuples (from ssw fragments)
  };

  // Provider status (Principle B: mandatory provider status)
  // Row-level provider status (from row.providerStatus or row.provider_status)
  // Passed through from backend without modification
  providerStatus?: ProviderStatus;

  // passthrough for any extras
  extra?: Record<string, any>;
};

// ----- Column mapping (user remap support) -----
export type ColumnMapping = {
  entry?: string;
  accession?: string;
  sequence?: string;
  length?: string;
  hydrophobicity?: string;
  hydrophobic_moment?: string;
  charge?: string;

  // SSW (Secondary Structure Switch)
  ssw_prediction?: string;   // maps to Peptide.sswPrediction
  ssw_score?: string;
  ssw_diff?: string;
  ssw_helix_percentage?: string;
  ssw_beta_percentage?: string;

  // FF-Helix
  ff_helix_percent?: string;       // maps to Peptide.ffHelixPercent
  ff_helix_fragments?: string;

  // ----- Optional direct mapping for unified columns -----
  helix_percent?: string;          // maps to Peptide.helixPercent
  beta_percent?: string;           // maps to Peptide.betaPercent

  // metadata
  species?: string;
  notes?: string;
  name?: string;
};

// ----- Dataset-level stats for KPI cards -----
export type DatasetStats = {
  totalPeptides: number;
  sswPositivePercent: number | null; // null when TANGO unavailable
  meanHydrophobicity: number;
  meanCharge: number;
  meanMuH: number | null; // null when no μH data available
  meanFFHelixPercent: number | null; // null when no FF-Helix data available
  meanLength: number;

  meanS4predHelixPercent: number | null; // null when no S4PRED data available

  // FF candidate percentages
  ffHelixCandidatePercent?: number | null; // % of peptides with ffHelixFlag === 1
  ffSswCandidatePercent?: number | null;   // % of peptides with ffSswFlag === 1 (gated on TANGO)

  // availability counts for better UI display
  s4predAvailable?: number;
  ffHelixAvailable?: number;
  sswAvailable?: number;
  aggHotspotPercent?: number | null;
};

// ----- Raw CSV load shape -----
export type ParsedCSVData = {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  rowCount: number;
};

// ----- A strongly-typed “row” when exporting/saving tables -----
// Keep previous fields and add optional ones you’re now using.
export type PeptideRow = {
  Entry: string;
  Sequence: string;
  Length: number;
  Hydrophobicity: number;
  Charge: number;
  "Full length uH": number;

  // FF flags (legacy names kept)
  "FF-Helix (Jpred)": number;                 // 1 or -1
  "FF-Secondary structure switch": number;    // 1 or -1

  // Optional richer outputs (all optional to avoid breaking old sheets)
  "FF-Helix %"? : number;                     // from auxiliary calc
  "FF Helix fragments"?: Array<SegmentTuple> | any[];

  // Tango / SSW
  "SSW prediction"?: number;                  // -1/0/1
  "SSW score"?: number;
  "SSW diff"?: number;
  "SSW helix percentage"?: number;
  "SSW beta percentage"?: number;

  // JPred
  "Helix fragments (Jpred)"?: Array<SegmentTuple> | any[];
  "Helix score (Jpred)"?: number;

  // Metadata
  "Protein name"?: string;
  "Organism"?: string;
};

// ----- Threshold Configuration -----
export type ThresholdConfig = {
  mode: "default" | "recommended" | "custom";
  custom?: Record<string, any>;  // Custom threshold values when mode is "custom"
  version: string;  // Config schema version
};

// ----- Backend-provided metadata for pills at top-right -----
export type DatasetMetadata = {
  runId?: string;
  traceId?: string;
  inputsHash?: string;
  configHash?: string;
  use_tango?: boolean;
  use_s4pred?: boolean;
  ssw_rows?: number;
  valid_seq_rows?: number;
  thresholds?: {
    muHCutoff: number;
    hydroCutoff: number;
  };
  thresholdConfigRequested?: ThresholdConfig | null;
  thresholdConfigResolved?: ThresholdConfig | null;
  providerStatusSummary?: any;  // Provider status summary from backend
  provider_status?: {
    tango?: SingleProviderStatus;
    s4pred?: SingleProviderStatus;
  };
  // UniProt-specific metadata (only present for UniProt-sourced data)
  source?: "uniprot_api" | null;
  query?: string | null;
  url?: string | null;
  size_returned?: number | null;
  total_available?: number | null;
};
