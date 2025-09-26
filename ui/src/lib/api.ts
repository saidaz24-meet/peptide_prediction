export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";


  function tryJson(s: string) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  
  async function handle(res: Response) {
    const txt = await res.text();
    if (!res.ok) {
      const j = tryJson(txt);
      throw new Error(j?.detail || txt || `HTTP ${res.status}`);
    }
    return tryJson(txt) ?? txt;
  }
  
async function handleResponse(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    // try to parse JSON error from FastAPI, else show raw text
    try {
      const j = JSON.parse(text);
      throw new Error(j.detail || JSON.stringify(j));
    } catch {
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
  }
  try { return JSON.parse(text); } catch { return text; }
}

export async function uploadCSV(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-csv`, { method: "POST", body: fd, mode: "cors" });
  return (await handleResponse(res)) as { rows: any[], meta?: any };
}

export async function predictOne(sequence: string, entry?: string) {
  const fd = new FormData();
  fd.append("sequence", sequence);
  if (entry) fd.append("entry", entry);
  const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd, mode: "cors" });
  return await handleResponse(res);
}

export async function fetchExampleDataset(recalc = 0) {
    const res = await fetch(`${API_BASE}/api/example?recalc=${recalc}`, { method: "GET" });
    return (await handleResponse(res)) as { rows: any[]; meta?: any };
  }


export async function callPredict(payload: {sequence: string; entry?: string}) {
  const form = new FormData();
  form.append("sequence", payload.sequence);
  if (payload.entry) form.append("entry", payload.entry);
  
  const res = await fetch(import.meta.env.VITE_API_BASE + "/api/predict", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
  
  }

  
  // api.ts — make sure this normalizeRow is used on every fetch result

type RawRow = Record<string, any>;
export type Peptide = {
  id: string;
  name?: string;
  species?: string;
  sequence: string;
  length: number;

  hydrophobicity?: number;
  charge?: number;
  muH?: number; // Full length μH

  // PSIPRED/Tango normalized fields expected by UI:
  helixPercent?: number; // from PSIPRED or Tango %
  betaPercent?: number;  // from PSIPRED or Tango %
  ffHelixPercent?: number;            // from backend "FF-Helix %"
  ffHelixFragments?: number[][] | []; // from backend "FF Helix fragments"
  chameleonPrediction?: -1 | 0 | 1;   // from backend "SSW prediction"

  // keep anything else you already use...
};

function num(v: any, dflt: number | null = null): number | null {
  if (v === null || v === undefined) return dflt;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? (n as number) : dflt;
}

function parseSegs(v: any): number[][] {
  if (!v) return [];
  if (Array.isArray(v)) return v as number[][];
  // support "5-12;20-28" or JSON string
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j;
  } catch {}
  const out: number[][] = [];
  String(v)
    .split(/[;,]/)
    .map((s) => s.trim())
    .forEach((tok) => {
      const m = tok.match(/^(\d+)\s*[-:]\s*(\d+)$/);
      if (m) out.push([Number(m[1]), Number(m[2])]);
    });
  return out;
}

export function normalizeRow(r: RawRow): Peptide {
  return {
    id: r.Entry ?? r.entry ?? r.id ?? '',
    name: r['Protein name'] ?? r.name ?? '',
    species: r.Organism ?? r.organism ?? '',
    sequence: r.Sequence ?? r.sequence ?? '',
    length: Number(r.Length ?? r.length ?? (r.Sequence ? String(r.Sequence).length : 0)),

    hydrophobicity: num(r['Hydrophobicity']),
    charge: num(r['Charge']),
    muH: num(r['Full length uH']),

    // PSIPRED/Tango percentages (whatever is present)
    helixPercent: num(r['PSIPRED helix %']) ?? num(r['SSW helix percentage']) ?? 0,
    betaPercent: num(r['PSIPRED beta %']) ?? num(r['SSW beta percentage']) ?? 0,

    // FF-Helix family
    ffHelixPercent: num(r['FF-Helix %'], -1) ?? -1,
    ffHelixFragments: parseSegs(r['FF Helix fragments']),

    // Chameleon from Tango SSW
    chameleonPrediction:
      (num(r['SSW prediction']) as -1 | 0 | 1) ??
      ((r['SSW prediction'] === -1 || r['SSW prediction'] === 0 || r['SSW prediction'] === 1)
        ? (r['SSW prediction'] as -1 | 0 | 1)
        : 0),
  };
}

// Wherever you fetch:
// const data = await (await fetch(...)).json();
// const peptides = (data.rows ?? []).map(normalizeRow);
// const meta = data.meta ?? {};
// return { peptides, meta, ... }
