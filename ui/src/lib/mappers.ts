// src/lib/mappers.ts
// Central mapper: backend row -> Peptide view model
// Keeps backward-compat with mixed key styles (snake/camel/labels).

import type { Peptide, Segment } from "@/types/peptide";
import { CSV_TO_FRONTEND } from "./peptideSchema";

// ----- optional nested shapes (match types/peptide) -----
type JPredInfo = {
  helixFragments?: Array<[number, number]> | Segment[];
  helixScore?: number;
};

type TangoCurves = {
  agg?: number[];
  beta?: number[];
  helix?: number[];
  turn?: number[];
};

type PsipredInfo = {
  pH?: number[];
  pE?: number[];
  pC?: number[];
  helixSegments?: Array<[number, number]>;
};

// ----- helpers -----
const num = (v: any, allowUndefined = false): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  if (n === null || n === undefined || Number.isNaN(Number(n))) {
    return allowUndefined ? undefined : 0;
  }
  return Number(n);
};

const toSegments = (val: any): Array<[number, number]> => {
  if (!val) return [];
  if (Array.isArray(val)) {
    // already [[s,e], ...] or Segment[]
    if (val.length && Array.isArray(val[0])) return val as Array<[number, number]>;
    if (val.length && typeof val[0] === "object" && "start" in val[0] && "end" in val[0]) {
      return (val as Segment[]).map((s) => [s.start, s.end]);
    }
  }
  if (typeof val === "string") {
    // try JSON first
    try {
      const parsed = JSON.parse(val);
      return toSegments(parsed);
    } catch {
      // fallback: "5-12;20-28" or "5:12,20:28"
      const out: Array<[number, number]> = [];
      val
        .split(/[;,]/)
        .map((s: string) => s.trim())
        .forEach((piece: string) => {
          const m = piece.match(/^(\d+)\s*[-:]\s*(\d+)$/);
          if (m) out.push([Number(m[1]), Number(m[2])]);
        });
      return out;
    }
  }
  return [];
};

const getAny = (row: Record<string, any>, keys: string[], fallback?: any) => {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
  }
  return fallback;
};

// ----- main mapper -----
export function mapBackendRowToPeptide(row: Record<string, any>): Peptide {
  // Only ID is required; everything else is optional with sensible defaults
  const id = getAny(row, ["id", "Entry", "Accession", "ID"]);
  
  if (!id) {
    console.warn('[mapBackendRowToPeptide] No valid ID found in row. Available keys:', Object.keys(row));
    throw new Error('Cannot map row: missing required field "id" or "Entry"');
  }
  
  const idStr = String(id).trim();
  if (!idStr) {
    console.warn('[mapBackendRowToPeptide] ID field is empty');
    throw new Error('Cannot map row: ID field is empty');
  }
  
  // All other fields are optional with safe defaults
  const seq = String(getAny(row, ["sequence", "Sequence"], "") || "");
  const length = num(getAny(row, ["length", "Length"], 0)) ?? 0;

  const hydrophobicity = num(getAny(row, ["hydrophobicity", "Hydrophobicity"], 0)) ?? 0;
  const muH = num(getAny(row, ["muH", "Full length uH", "uH"], undefined), true);
  const charge = num(getAny(row, ["charge", "Charge"], 0)) ?? 0;

  // SSW (Secondary Structure Switch) - canonical field: sswPrediction (-1/0/1 classification)
  // Priority: sswPrediction (canonical) > chameleonPrediction (backward compat, deprecated)
  const sswPredictionRaw = getAny(row, ["sswPrediction", "chameleonPrediction"], -1);
  // Backward compatibility warning
  if ("chameleonPrediction" in row && !("sswPrediction" in row)) {
    console.warn('[mapBackendRowToPeptide] Using deprecated field "chameleonPrediction". Backend should use "sswPrediction".');
  }
  const numVal = Number(sswPredictionRaw);
  const sswPrediction = (numVal === -1 || numVal === 0 || numVal === 1) 
    ? (numVal as -1 | 0 | 1)
    : -1;

  const sswScore = num(getAny(row, ["sswScore", "SSW score"], undefined), true);
  const sswDiff = num(getAny(row, ["sswDiff", "SSW diff"], undefined), true);
  const sswHelixPct = num(getAny(row, ["sswHelixPercentage", "sswHelixPct", "SSW helix percentage", "helixPercent"], undefined), true);
  const sswBetaPct = num(getAny(row, ["sswBetaPercentage", "sswBetaPct", "SSW beta percentage", "betaPercent"], undefined), true);

  // FF-Helix — use undefined if missing (not -1)
  const rawFFValue = getAny(row, ["ffHelixPercent", "FF-Helix %", "FF Helix %", "FF Helix", "FF-Helix"], undefined);
  const ffHelixPercent = num(rawFFValue, true);

  const ffHelixFragments = toSegments(
    getAny(row, ["ffHelixFragments", "FF Helix fragments", "FF-Helix fragments"], [])
  );

  // JPred — optional
  const jpredFrags = toSegments(
    getAny(row, ["jpredHelixFragments", "Helix fragments (Jpred)", "JPred Helix fragments"], [])
  );
  const jpredScore = num(
    getAny(row, ["jpredHelixScore", "Helix score (Jpred)", "JPred Helix score"], undefined),
    true
  );
  const jpred: JPredInfo | undefined =
    (jpredFrags?.length ?? 0) || jpredScore !== undefined
      ? { helixFragments: jpredFrags, helixScore: jpredScore }
      : undefined;

  // Optional per-residue curves (Tango)
  const tango: TangoCurves | undefined = (() => {
    const agg   = getAny(row, ["tangoAgg", "Tango Aggregation curve"], undefined) as number[] | undefined;
    const beta  = getAny(row, ["tangoBeta", "Tango Beta curve"], undefined) as number[] | undefined;
    const helix = getAny(row, ["tangoHelix", "Tango Helix curve"], undefined) as number[] | undefined;
    const turn  = getAny(row, ["tangoTurn", "Tango Turn curve"], undefined) as number[] | undefined;
    if (agg || beta || helix || turn) return { agg, beta, helix, turn };
    return undefined;
  })();

  // Optional per-residue curves (PSIPRED)
  const psipred: PsipredInfo | undefined = (() => {
    const pH = getAny(row, ["psipredPH", "Psipred P_H"], undefined) as number[] | undefined;
    const pE = getAny(row, ["psipredPE", "Psipred P_E"], undefined) as number[] | undefined;
    const pC = getAny(row, ["psipredPC", "Psipred P_C"], undefined) as number[] | undefined;
    const helixSegments = getAny(
      row,
      ["psipredHelixSegments", "Helix fragments (Psipred)"],
      undefined
    ) as Array<[number, number]> | undefined;
    if ((pH && pH.length) || (pE && pE.length) || (pC && pC.length) || (helixSegments?.length ?? 0) > 0) {
      return { pH, pE, pC, helixSegments };
    }
    return undefined;
  })();

  // Provider status: pass through from backend row (row.providerStatus or row.provider_status)
  // Do not fabricate provider status; only pass through what backend provides
  const providerStatus = row.providerStatus || row.provider_status || undefined;

  const peptide: Peptide = {
    id: idStr,
    name: getAny(row, ["name", "Protein name", "Name"]),
    species: getAny(row, ["species", "Organism", "Species", "organism"]),
    sequence: seq,
    length: typeof length === "number" && !Number.isNaN(length) ? length : 0,

    hydrophobicity,
    charge,
    muH,

    // FF
    ffHelixPercent,
    ffHelixFragments,

    // SSW (Secondary Structure Switch)
    sswPrediction,
    // Backward compatibility alias (deprecated)
    chameleonPrediction: sswPrediction,
    sswScore,
    sswDiff,
    sswHelixPct,
    sswBetaPct,

    // Providers
    jpred,
    tango,
    psipred,

    // Provider status (Principle B: mandatory provider status)
    providerStatus,
  };

  return peptide;
}

export function mapApiRowToPeptide(row: Record<string, any>) {
  // API should return camelCase canonical keys (id, sequence, muH, ffHelixPercent, etc.)
  // Cast/validate minimally here — prefer backend validation.
  return {
    id: row.id,
    sequence: row.sequence,
    length: row.length,
    name: row.name,
    species: row.species,
    hydrophobicity: row.hydrophobicity,
    charge: row.charge,
    muH: row.muH,
    sswPrediction: row.sswPrediction,
    sswScore: row.sswScore,
    sswDiff: row.sswDiff,
    sswHelixPercentage: row.sswHelixPercentage,
    sswBetaPercentage: row.sswBetaPercentage,
    ffHelixPercent: row.ffHelixPercent,
    ffHelixFragments: row.ffHelixFragments,
  };
}
