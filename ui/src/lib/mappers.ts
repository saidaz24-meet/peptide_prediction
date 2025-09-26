// src/lib/mappers.ts
// Central place to convert backend rows -> frontend Peptide objects
// Tolerant to column name variants and missing fields.

export type Segment = [number, number];

export interface JPredInfo {
  helixFragments: Segment[];
  helixScore?: number;
}

export interface Peptide {
  // identity & metadata
  id: string;                // Entry / Accession
  name?: string;             // Protein name
  species?: string;          // Organism
  sequence: string;
  length: number;

  // basic biophysics
  hydrophobicity: number;    // "Hydrophobicity"
  charge: number;            // "Charge"
  muH: number;               // "Full length uH"

  // FF Helix (from auxiliary; percent + fragments)
  ffHelixPercent?: number;   // "FF-Helix %", number or undefined when unavailable
  ffHelixFragments?: Segment[]; // "FF Helix fragments"

  // Tango / Chameleon
  chameleonPrediction: number;   // "SSW prediction" (1 / 0 / -1)
  sswScore?: number;             // "SSW score"
  sswDiff?: number;              // "SSW diff"
  sswHelixPct?: number;          // "SSW helix percentage"
  sswBetaPct?: number;           // "SSW beta percentage"

  // Optional JPred block
  jpred?: JPredInfo;

  // raw passthrough (just in case)
  _raw?: Record<string, any>;
}

/** Safely parse a number; treat -1 or NaN as undefined when requested. */
function num(x: any, undefIfNegOne = false): number | undefined {
  const v = typeof x === "number" ? x : Number(String(x ?? "").trim());
  if (Number.isNaN(v)) return undefined;
  if (undefIfNegOne && v === -1) return undefined;
  return v;
}

/** Normalize a string key (for tolerant column lookups). */
function key(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Read a value by trying several alternative keys. */
function getAny(obj: Record<string, any>, keys: string[], fallback?: any) {
  for (const k of keys) {
    const hit = Object.keys(obj).find((c) => key(c) === key(k));
    if (hit !== undefined) return obj[hit];
  }
  return fallback;
}

/** Convert "5-12; 20-28" | JSON | array -> Segment[] */
function toSegments(val: any): Segment[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    // e.g. [[5,12],[20,28]]
    const segs: Segment[] = [];
    for (const it of val) {
      if (Array.isArray(it) && it.length >= 2) {
        const a = Number(it[0]);
        const b = Number(it[1]);
        if (!Number.isNaN(a) && !Number.isNaN(b)) segs.push([a, b]);
      }
    }
    return segs;
  }
  const s = String(val).trim();
  if (!s) return [];
  // Try JSON
  try {
    const j = JSON.parse(s);
    return toSegments(j);
  } catch {
    // try "5-12;20-28" / "5:12, 20:28"
    const pieces = s.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    const segs: Segment[] = [];
    for (const p of pieces) {
      const m = p.match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (m) segs.push([Number(m[1]), Number(m[2])]);
    }
    return segs;
  }
}

/** Map a backend DataFrame row (as JSON) into a Peptide object. */
export function mapBackendRowToPeptide(row: Record<string, any>): Peptide {
  const id =
    getAny(row, ["Entry", "Accession", "ID", "entry", "accession", "id"], "") ?? "";
  const seq = String(
    getAny(row, ["Sequence", "sequence", "seq"], "") ?? ""
  );
  const length =
    num(getAny(row, ["Length", "length", "len"], seq?.length || 0)) ?? (seq?.length || 0);

  // core biophysics
  const hydrophobicity =
    num(getAny(row, ["Hydrophobicity", "hydrophobicity"]), true) ?? 0;
  const charge = num(getAny(row, ["Charge", "charge"]), true) ?? 0;
  const muH =
    num(getAny(row, ["Full length uH", "Full-length uH", "muH", "Full length μH"]), true) ?? 0;

  // FF-Helix
  const ffHelixPercent = num(getAny(row, ["FF-Helix %", "FF Helix %", "ffHelixPercent"]), true);
  const ffHelixFragments = toSegments(
    getAny(row, ["FF Helix fragments", "FF-Helix fragments", "ffHelixFragments"], [])
  );

  // Tango / Chameleon
  const chameleonPrediction =
    (num(getAny(row, ["SSW prediction", "Chameleon", "chameleonPrediction"])) as number | undefined) ??
    -1;
  const sswScore = num(getAny(row, ["SSW score", "sswScore"]), true);
  const sswDiff = num(getAny(row, ["SSW diff", "sswDiff"]), true);
  const sswHelixPct = num(getAny(row, ["SSW helix percentage", "Helix percentage", "helixPct"]), true);
  const sswBetaPct = num(getAny(row, ["SSW beta percentage", "Beta percentage", "betaPct"]), true);

  // JPred
  const jpredFrags = toSegments(
    getAny(row, ["Helix fragments (Jpred)", "JPred Helix fragments", "jpredHelixFragments"], [])
  );
  const jpredScore = num(getAny(row, ["Helix score (Jpred)", "JPred Helix score", "jpredHelixScore"]), true);
  const jpred: JPredInfo | undefined =
    jpredFrags.length || jpredScore !== undefined
      ? { helixFragments: jpredFrags, helixScore: jpredScore }
      : undefined;

  return {
    id: String(id || "").trim(),
    name: getAny(row, ["Protein name", "Name", "name"]),
    species: getAny(row, ["Organism", "Species", "organism", "species"]),
    sequence: seq,
    length: typeof length === "number" && !Number.isNaN(length) ? length : 0,

    hydrophobicity,
    charge,
    muH,

    ffHelixPercent,
    ffHelixFragments,

    chameleonPrediction: typeof chameleonPrediction === "number" ? chameleonPrediction : -1,
    sswScore,
    sswDiff,
    sswHelixPct,
    sswBetaPct,

    jpred,
    _raw: row,
  };
}
