export type Segment = {
  start: number;
  end: number;
  score?: number;
};

export type ChameleonPrediction = -1 | 0 | 1; // -1 = no, 0 = uncertain, 1 = yes

export type Peptide = {
  id: string;
  name?: string;
  species?: string;
  sequence: string;
  length: number;
  hydrophobicity: number;
  muH?: number; // hydrophobic moment if present
  charge: number;
  chameleonPrediction: ChameleonPrediction;
  ffHelixPercent?: number; // JPred helix percentage
  jpred?: {
    helixFragments?: Array<[number, number]> | Segment[];
    helixScore?: number;
  };
  extra?: Record<string, any>;
};

export type ColumnMapping = {
  entry?: string;
  accession?: string;
  sequence?: string;
  length?: string;
  hydrophobicity?: string;
  hydrophobic_moment?: string;
  charge?: string;
  chameleon_prediction?: string;
  ff_helix_percent?: string;
  jpred_helix_percent?: string;
  jpred_helix_fragments?: string;
  jpred_helix_score?: string;
  species?: string;
  notes?: string;
  name?: string;
};

export type DatasetStats = {
  totalPeptides: number;
  chameleonPositivePercent: number;
  meanHydrophobicity: number;
  meanCharge: number;
  meanFFHelixPercent: number;
  meanLength: number;
};

export type ParsedCSVData = {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  rowCount: number;
};


export type PeptideRow = {
  Entry: string;
  Sequence: string;
  Length: number;
  Hydrophobicity: number;
  Charge: number;
  "Full length uH": number;
  "FF-Helix (Jpred)": number;                 // 1 or -1
  "FF-Secondary structure switch": number;    // 1 or -1
  "Helix fragments (Jpred)"?: Array<[number, number]> | any[];
};