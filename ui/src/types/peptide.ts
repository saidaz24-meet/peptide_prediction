// src/types/peptide.ts

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
export type SSWPrediction = -1 | 0 | 1; // -1 = no/NA, 0 = uncertain, 1 = yes
// Backward compatibility alias (deprecated, use SSWPrediction)
export type ChameleonPrediction = SSWPrediction;

// ----- Provider Status -----
export type ProviderStatus = {
  tango?: {
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
  psipred?: {
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
  jpred?: {
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
};

// ----- Core Peptide model used across the UI -----
export type Peptide = {
  // identity & metadata
  id: string;
  name?: string;
  species?: string;

  // sequence
  sequence: string;
  length: number;

  // basic biophysics
  hydrophobicity: number;
  muH?: number; // hydrophobic moment if present
  charge: number;

  // Tango / SSW (Secondary Structure Switch)
  sswPrediction: SSWPrediction; // from "SSW prediction"
  // Backward compatibility alias (deprecated, use sswPrediction)
  chameleonPrediction?: SSWPrediction;
  sswScore?: number;                        // "SSW score"
  sswDiff?: number;                         // "SSW diff"
  sswHelixPct?: number;                     // "SSW helix percentage"
  sswBetaPct?: number;                      // "SSW beta percentage"

  // FF-Helix (from auxiliary)
  ffHelixPercent?: number;                                   // "FF-Helix %"
  ffHelixFragments?: Array<SegmentTuple> | Segment[];        // "FF Helix fragments"

  // ----- NEW: unified secondary-structure percentages used by Results table -----
  // These are filled by the mapper from PSIPRED if present, otherwise Tango fallback.
  helixPercent?: number;   // preferred: PSIPRED helix %; fallback: "SSW helix percentage"
  betaPercent?: number;    // preferred: PSIPRED beta %;  fallback: "SSW beta percentage"

  // Optional JPred block
  jpred?: {
    helixFragments?: Array<SegmentTuple> | Segment[];
    helixScore?: number;
  };

  // --- NEW (optional) PSIPRED curves + segments
  psipred?: {
    pH?: number[]; // per-residue P(helix)
    pE?: number[]; // per-residue P(beta)
    pC?: number[]; // per-residue P(coil)
    helixSegments?: Array<[number, number]>;
  };

  // --- NEW (optional) Tango per-residue curves
  tango?: {
    agg?: number[];   // Aggregation curve
    beta?: number[];  // Beta curve
    helix?: number[]; // Helix curve
    turn?: number[];  // Turn curve
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
  // Backward compatibility alias (deprecated, use ssw_prediction)
  chameleon_prediction?: string;
  ssw_score?: string;
  ssw_diff?: string;
  ssw_helix_percentage?: string;
  ssw_beta_percentage?: string;

  // FF-Helix
  ff_helix_percent?: string;       // maps to Peptide.ffHelixPercent
  ff_helix_fragments?: string;

  // JPred
  jpred_helix_percent?: string;    // (if you ever store it)
  jpred_helix_fragments?: string;
  jpred_helix_score?: string;

  // ----- NEW: optional direct mapping for unified columns -----
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
  meanFFHelixPercent: number | null; // null when no FF-Helix data available
  meanLength: number;

  // availability counts for better UI display
  jpredAvailable?: number;
  ffHelixAvailable?: number;
  sswAvailable?: number;
  // Backward compatibility aliases (deprecated, use ssw*)
  chameleonPositivePercent?: number | null;
  chameleonAvailable?: number;
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
  use_jpred?: boolean;
  jpred_rows?: number;
  use_tango?: boolean;
  ssw_rows?: number;
  valid_seq_rows?: number;
  thresholds?: {
    muHCutoff: number;
    hydroCutoff: number;
    ffHelixPercentThreshold: number;
  };
  thresholdConfigRequested?: ThresholdConfig | null;
  thresholdConfigResolved?: ThresholdConfig | null;
  providerStatusSummary?: any;  // Provider status summary from backend
  provider_status?: {
    tango?: {
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
    psipred?: {
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
    jpred?: {
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
  };
};
