// src/lib/mappers.ts
// Central mapper: backend row -> Peptide view model
// Keeps backward-compat with mixed key styles (snake/camel/labels).

import type { Peptide, Segment } from "@/types/peptide";

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
  const id = getAny(row, ["Entry", "Accession", "ID", "id"]);
  const seq = String(getAny(row, ["Sequence", "sequence"], "") || "");
  const length = num(getAny(row, ["Length", "length"], 0)) ?? 0;

  const hydrophobicity = Number(getAny(row, ["Hydrophobicity", "hydrophobicity"], 0) || 0);
  const muH = num(getAny(row, ["Full length uH", "uH", "muH"]), true);
  const charge = Number(getAny(row, ["Charge", "charge"], 0) || 0);

  // Flags / SSW (Chameleon)
  const chameleonPrediction = Number(
    getAny(row, ["chameleonPrediction", "Chameleon", "Chameleon_Prediction"], -1)
  ) as -1 | 0 | 1;

  const sswScore = num(getAny(row, ["SSW score", "sswScore"]), true);
  const sswDiff = num(getAny(row, ["SSW diff", "sswDiff"]), true);
  const sswHelixPct = num(getAny(row, ["SSW helix percentage", "sswHelixPct", "helixPercent"]), true);
  const sswBetaPct  = num(getAny(row, ["SSW beta percentage", "sswBetaPct", "betaPercent"]), true);


  // FF-Helix - DEBUG VERSION
  const rawFFValue = getAny(row, ["FF Helix %", "FF-Helix %", "ffHelixPercent", "FF Helix", "FF-Helix"]);
  
  console.log('[MAPPER DEBUG] FF-Helix raw value:', rawFFValue, 'type:', typeof rawFFValue);
  const ffHelixPercent =
    num(rawFFValue, true) ?? undefined;


  const ffHelixFragments = toSegments(
    getAny(row, ["FF Helix fragments", "ffHelixFragments"], [])
  );

  // JPred
  const jpredFrags = toSegments(
    getAny(row, ["Helix fragments (Jpred)", "JPred Helix fragments", "jpredHelixFragments"], [])
  );
  const jpredScore = num(
    getAny(row, ["Helix score (Jpred)", "JPred Helix score", "jpredHelixScore"]),
    true
  );
  const jpred: JPredInfo | undefined =
    (jpredFrags?.length ?? 0) || jpredScore !== undefined
      ? { helixFragments: jpredFrags, helixScore: jpredScore }
      : undefined;

  // Optional per-residue curves (Tango)
  const tango: TangoCurves | undefined = (() => {
    const agg   = getAny(row, ["Tango Aggregation curve", "tangoAgg"]) as number[] | undefined;
    const beta  = getAny(row, ["Tango Beta curve", "tangoBeta"])       as number[] | undefined;
    const helix = getAny(row, ["Tango Helix curve", "tangoHelix"])     as number[] | undefined;
    const turn  = getAny(row, ["Tango Turn curve", "tangoTurn"])       as number[] | undefined;
    if (agg || beta || helix || turn) return { agg, beta, helix, turn };
    return undefined;
  })();

  // Optional per-residue curves (PSIPRED)
  const psipred: PsipredInfo | undefined = (() => {
    const pH = getAny(row, ["Psipred P_H", "psipredPH"]) as number[] | undefined;
    const pE = getAny(row, ["Psipred P_E", "psipredPE"]) as number[] | undefined;
    const pC = getAny(row, ["Psipred P_C", "psipredPC"]) as number[] | undefined;
    const helixSegments = getAny(
      row,
      ["Helix fragments (Psipred)", "psipredHelixSegments"],
      []
    ) as Array<[number, number]>;
    if ((pH && pH.length) || (pE && pE.length) || (pC && pC.length) || (helixSegments?.length ?? 0) > 0) {
      return { pH, pE, pC, helixSegments };
    }
    return undefined;
  })();

  const peptide: Peptide = {
    id: String(id || "").trim(),
    name: getAny(row, ["Protein name", "Name", "name"]),
    species: getAny(row, ["Organism", "Species", "organism", "species"]),
    sequence: seq,
    length: typeof length === "number" && !Number.isNaN(length) ? length : 0,

    hydrophobicity,
    charge,
    muH,

    // FF
    ffHelixPercent,
    ffHelixFragments,

    // SSW / Chameleon
    chameleonPrediction,
    sswScore,
    sswDiff,
    sswHelixPct,
    sswBetaPct,

    // Providers
    jpred,
    tango,
    psipred,

   
  };

  return peptide;
}
