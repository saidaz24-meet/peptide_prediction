/**
 * referenceDistributions.ts — Fetch reference CSVs, compute biochem stats.
 *
 * Q11 (Peleg 2026-06-18 PDF1 p20): clickable database comparison tabs for
 * single-peptide mode. Fetches CSV, parses sequences, computes per-metric
 * value arrays + aggregate stats client-side.
 *
 * Biochem formulas ported from backend/biochem_calculation.py:
 *   - Hydrophobicity: Fauchère-Pliska scale, mean over standard residues
 *   - Charge: K/R = +1, D/E = -1, H = +0.1 at pH 7.4
 *   - µH: Eisenberg 1982 formula at 100° (α-helix angle)
 *
 * TECH DEBT: these formulas duplicate the canonical backend ones. If Peleg
 * ever changes the µH angle or hydrophobicity scale, the client copy will
 * silently drift. Long-term fix is either a /api/biochem-constants endpoint
 * or generating a shared TS file from biochem_calculation.py at build time.
 */

import type { DatasetStats } from "@/types/peptide";

const FAUCHERE_PLISKA: Record<string, number> = {
  A: 0.31,
  R: -1.01,
  N: -0.6,
  D: -0.77,
  C: 1.54,
  Q: -0.22,
  E: -0.64,
  G: 0.0,
  H: 0.13,
  I: 1.8,
  L: 1.7,
  K: -0.99,
  M: 1.23,
  F: 1.79,
  P: 0.72,
  S: -0.04,
  T: 0.26,
  W: 2.25,
  Y: 0.96,
  V: 1.22,
};

const CHARGE_MAP: Record<string, number> = {
  K: 1,
  R: 1,
  D: -1,
  E: -1,
  H: 0.1,
};

export function calcHydrophobicity(seq: string): number {
  if (seq.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const aa of seq.toUpperCase()) {
    const val = FAUCHERE_PLISKA[aa];
    if (val !== undefined) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function calcCharge(seq: string): number {
  let charge = 0;
  for (const aa of seq.toUpperCase()) {
    charge += CHARGE_MAP[aa] ?? 0;
  }
  return charge;
}

/**
 * Hydrophobic moment (Eisenberg 1982).
 * µH = sqrt( (Σ Hi·cos(i·δ))² + (Σ Hi·sin(i·δ))² ) / n
 * where δ = 100° for α-helix.
 */
export function calcMuH(seq: string, angle = 100): number {
  if (seq.length === 0) return 0;
  const rad = (angle * Math.PI) / 180;
  let sumCos = 0;
  let sumSin = 0;
  const upper = seq.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const h = FAUCHERE_PLISKA[upper[i]] ?? 0;
    sumCos += h * Math.cos(i * rad);
    sumSin += h * Math.sin(i * rad);
  }
  const result = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / upper.length;
  return Number.isFinite(result) ? result : 0;
}

interface CsvRow {
  sequence: string;
  [key: string]: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const seqIdx = headers.indexOf("sequence");
  if (seqIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length <= seqIdx) continue;
    const seq = fields[seqIdx].trim().toUpperCase();
    if (!seq || !/^[A-Z]+$/.test(seq)) continue;
    const row: CsvRow = { sequence: seq };
    headers.forEach((h, j) => {
      if (j < fields.length) row[h] = fields[j].trim();
    });
    rows.push(row);
  }
  return rows;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export interface ReferenceDatasetResult {
  stats: DatasetStats;
  values: {
    hydrophobicity: number[];
    muH: number[];
    charge: number[];
  };
}

export async function fetchReferenceDataset(csvUrl: string): Promise<ReferenceDatasetResult> {
  const resp = await fetch(csvUrl);
  if (!resp.ok) throw new Error(`Failed to fetch ${csvUrl}: ${resp.status}`);
  const text = await resp.text();
  const rows = parseCSV(text);
  if (rows.length === 0) throw new Error(`No valid rows in ${csvUrl}`);

  const hydroValues: number[] = [];
  const muHValues: number[] = [];
  const chargeValues: number[] = [];
  const lengths: number[] = [];

  for (const row of rows) {
    const cleanSeq = row.sequence.replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
    if (cleanSeq.length === 0) continue;
    hydroValues.push(calcHydrophobicity(cleanSeq));
    muHValues.push(calcMuH(cleanSeq));
    chargeValues.push(calcCharge(row.sequence));
    lengths.push(row.sequence.length);
  }

  const stats: DatasetStats = {
    totalPeptides: rows.length,
    sswPositivePercent: null,
    meanHydrophobicity: mean(hydroValues),
    meanCharge: mean(chargeValues),
    meanMuH: mean(muHValues),
    meanFFHelixPercent: null,
    meanLength: mean(lengths),
    meanS4predHelixPercent: null,
  };

  return {
    stats,
    values: {
      hydrophobicity: hydroValues,
      muH: muHValues,
      charge: chargeValues,
    },
  };
}

export interface ReferenceDatasetConfig {
  id: string;
  label: string;
  csvUrl: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

export const QUICK_ANALYZE_DATASETS: ReferenceDatasetConfig[] = [
  {
    id: "fibril_118",
    label: "Fibril-forming short peptides",
    csvUrl: "/example/fibril_forming_peptides_118.csv",
  },
  {
    id: "uniprot_short",
    label: "UniProt short peptides",
    csvUrl: "/example/uniprot_short.csv",
    disabled: true,
    disabledTooltip: "Coming soon — UniProt short peptide reference distribution",
  },
];
