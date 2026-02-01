/**
 * Single source of truth for mapping backend API responses to UI Peptide model.
 * 
 * This is the ONLY mapping layer from backend payload → UI model.
 * All components must use this function - no duplicate normalization logic allowed.
 * 
 * Backend API responses use canonical camelCase format (id, sequence, sswPrediction, etc.)
 * as defined in backend/schemas/api_models.py:PeptideRow
 * 
 * This mapper converts ApiPeptideRow → Peptide (UI model)
 */

import type { Peptide, Segment, SSWPrediction } from "@/types/peptide";
import type { ApiPeptideRow } from "@/types/api";
import { validateApiRow, reportValidationErrors } from "./apiValidator";

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

/**
 * Map backend API response row to UI Peptide model.
 * 
 * This is the ONLY function that should convert backend payloads to UI models.
 * All components must use this function - no duplicate normalization logic.
 * 
 * @param row - Backend API response row (ApiPeptideRow format with camelCase keys)
 * @returns Peptide - UI model with all fields normalized
 * 
 * Backend format: {id, sequence, sswPrediction, ffHelixPercent, ...}
 * UI format: {id, sequence, sswPrediction, ...}
 */
export function mapApiRowToPeptide(row: ApiPeptideRow | Record<string, any>, source: string = 'API'): Peptide {
  // Development-only validation: check for forbidden keys and required keys
  if (!import.meta.env.PROD) {
    const errors = validateApiRow(row, source);
    
    // Required keys missing: throw error in dev
    const missingRequired = errors.filter(e => e.includes('missing required keys'));
    if (missingRequired.length > 0) {
      const errorMsg = `[mapApiRowToPeptide] ${missingRequired.join('; ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Forbidden keys present: report but don't throw (backward compat during migration)
    const forbiddenErrors = errors.filter(e => e.includes('forbidden keys'));
    if (forbiddenErrors.length > 0) {
      reportValidationErrors(forbiddenErrors);
    }
  }

  // Validate required ID field
  const id = String(row.id || row.Entry || row.entry || row.Accession || row.accession || "").trim();
  if (!id) {
    console.warn('[mapApiRowToPeptide] No valid ID found in row. Available keys:', Object.keys(row));
    throw new Error('Cannot map row: missing required field "id" or "Entry"');
  }

  // Sequence (required)
  const sequence = String(row.sequence || row.Sequence || "");

  // Basic biophysics
  const length = num(row.length || row.Length, true) ?? 0;
  const hydrophobicity = num(row.hydrophobicity || row.Hydrophobicity, true) ?? 0;
  const charge = num(row.charge || row.Charge, true) ?? 0;
  const muH = num(row.muH || row["Full length uH"] || row.uH, true);

  // SSW (Secondary Structure Switch) - canonical field: sswPrediction
  const sswPredictionRaw = row.sswPrediction ?? -1;
  const numVal = Number(sswPredictionRaw);
  const sswPrediction: SSWPrediction = (numVal === -1 || numVal === 0 || numVal === 1) 
    ? (numVal as -1 | 0 | 1)
    : -1;

  // SSW scores and percentages
  const sswScore = num(row.sswScore || row["SSW score"], true);
  const sswDiff = num(row.sswDiff || row["SSW diff"], true);
  const sswHelixPct = num(
    row.sswHelixPercentage || 
    row.sswHelixPct || 
    row["SSW helix percentage"] || 
    row.helixPercent, 
    true
  );
  const sswBetaPct = num(
    row.sswBetaPercentage || 
    row.sswBetaPct || 
    row["SSW beta percentage"] || 
    row.betaPercent, 
    true
  );

  // FF-Helix
  const rawFFValue = row.ffHelixPercent || row["FF-Helix %"] || row["FF Helix %"] || row["FF Helix"] || row["FF-Helix"];
  const ffHelixPercent = num(rawFFValue, true);
  const ffHelixFragments = toSegments(
    row.ffHelixFragments || row["FF Helix fragments"] || row["FF-Helix fragments"] || []
  );

  // JPred — optional
  const jpredFrags = toSegments(
    row.jpredHelixFragments || row["Helix fragments (Jpred)"] || row["JPred Helix fragments"] || []
  );
  const jpredScore = num(
    row.jpredHelixScore || row["Helix score (Jpred)"] || row["JPred Helix score"],
    true
  );
  const jpred: JPredInfo | undefined =
    (jpredFrags?.length ?? 0) || jpredScore !== undefined
      ? { helixFragments: jpredFrags, helixScore: jpredScore }
      : undefined;

  // Optional per-residue curves (Tango)
  const tango: TangoCurves | undefined = (() => {
    const agg = (row.tangoAgg || row["Tango Aggregation curve"]) as number[] | undefined;
    const beta = (row.tangoBeta || row["Tango Beta curve"]) as number[] | undefined;
    const helix = (row.tangoHelix || row["Tango Helix curve"]) as number[] | undefined;
    const turn = (row.tangoTurn || row["Tango Turn curve"]) as number[] | undefined;
    if (agg || beta || helix || turn) return { agg, beta, helix, turn };
    return undefined;
  })();

  // Optional per-residue curves (PSIPRED)
  const psipred: PsipredInfo | undefined = (() => {
    const pH = row.psipredPH || row["Psipred P_H"] as number[] | undefined;
    const pE = row.psipredPE || row["Psipred P_E"] as number[] | undefined;
    const pC = row.psipredPC || row["Psipred P_C"] as number[] | undefined;
    const helixSegments = (
      row.psipredHelixSegments || row["Helix fragments (Psipred)"]
    ) as Array<[number, number]> | undefined;
    if ((pH && pH.length) || (pE && pE.length) || (pC && pC.length) || (helixSegments?.length ?? 0) > 0) {
      return { pH, pE, pC, helixSegments };
    }
    return undefined;
  })();

  // Provider status: pass through from backend row
  // Do not fabricate provider status; only pass through what backend provides
  const providerStatus = row.providerStatus || row.provider_status || undefined;

  // Build Peptide object
  const peptide: Peptide = {
    id,
    name: row.name || row["Protein name"] || row.Name || undefined,
    species: row.species || row.Organism || row.Species || row.organism || undefined,
    sequence,
    length: typeof length === "number" && !Number.isNaN(length) ? length : 0,

    hydrophobicity,
    charge,
    muH,

    // FF
    ffHelixPercent,
    ffHelixFragments,

    // SSW (Secondary Structure Switch)
    sswPrediction,
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

    // Pass through extras (including legacy fields)
    extra: row.extras || row.extra || {},
  };

  return peptide;
}

/**
 * Map array of backend API response rows to UI Peptide models.
 * 
 * @param rows - Array of backend API response rows
 * @param source - Source identifier for validation errors (e.g., '/api/upload-csv')
 * @returns Array of Peptide UI models
 */
export function mapApiRowsToPeptides(rows: (ApiPeptideRow | Record<string, any>)[], source: string = 'API'): Peptide[] {
  // Development-only validation: check all rows
  if (!import.meta.env.PROD) {
    const errors: string[] = [];
    rows.forEach((row, index) => {
      const rowErrors = validateApiRow(row, `${source}[${index}]`);
      
      // Required keys missing: throw error in dev
      const missingRequired = rowErrors.filter(e => e.includes('missing required keys'));
      if (missingRequired.length > 0) {
        errors.push(...missingRequired);
      }
      
      // Forbidden keys present: report but don't throw
      const forbiddenErrors = rowErrors.filter(e => e.includes('forbidden keys'));
      if (forbiddenErrors.length > 0) {
        reportValidationErrors(forbiddenErrors);
      }
    });
    
    if (errors.length > 0) {
      const errorMsg = `[mapApiRowsToPeptides] ${errors.join('; ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
  return rows.map((row, index) => mapApiRowToPeptide(row, `${source}[${index}]`));
}

