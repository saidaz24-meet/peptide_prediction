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
export type ChameleonPrediction = -1 | 0 | 1; // -1 = no/NA, 0 = uncertain, 1 = yes

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

  // Tango / Chameleon (a.k.a. SSW)
  chameleonPrediction: ChameleonPrediction; // from "SSW prediction"
  sswScore?: number;                        // "SSW score"
  sswDiff?: number;                         // "SSW diff"
  sswHelixPct?: number;                     // "SSW helix percentage"
  sswBetaPct?: number;                      // "SSW beta percentage"

  // FF-Helix (from auxiliary)
  ffHelixPercent?: number;                                   // "FF-Helix %"
  ffHelixFragments?: Array<SegmentTuple> | Segment[];        // "FF Helix fragments"

  // Optional JPred block
  jpred?: {
    helixFragments?: Array<SegmentTuple> | Segment[];
    helixScore?: number;
  };

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

  // Chameleon / SSW
  chameleon_prediction?: string;   // maps to Peptide.chameleonPrediction
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

  // metadata
  species?: string;
  notes?: string;
  name?: string;
};

// ----- Dataset-level stats for KPI cards -----
export type DatasetStats = {
  totalPeptides: number;
  chameleonPositivePercent: number;
  meanHydrophobicity: number;
  meanCharge: number;
  meanFFHelixPercent: number;
  meanLength: number;

  // availability counts for better UI display
  jpredAvailable?: number;
  ffHelixAvailable?: number;
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

// ----- Backend-provided metadata for pills at top-right -----
export type DatasetMetadata = {
  use_jpred?: boolean;
  jpred_rows?: number;
  use_tango?: boolean;
  ssw_rows?: number;
  valid_seq_rows?: number;
};
