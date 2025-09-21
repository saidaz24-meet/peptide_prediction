import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Peptide,
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
  DatasetMetadata,
} from '../types/peptide';

// --- SMART RANKING (weights + scorer) ---
// (keep using zustand just like your other stores)

export const useThresholds = create<{
  wH: number; wCharge: number; wMuH: number; wHelix: number;
  topN: number;
  setWeights: (partial: Partial<{wH:number;wCharge:number;wMuH:number;wHelix:number;topN:number}>) => void;
}>(set => ({
  wH: 1, wCharge: 1, wMuH: 1, wHelix: 1, topN: 10,
  setWeights: (partial) => set(partial),
}));

export function scorePeptide(
  p: Peptide,
  w: { wH:number; wCharge:number; wMuH:number; wHelix:number }
){
  const h = Number(p.hydrophobicity ?? 0);       // larger can be “better”
  const c = Math.abs(Number(p.charge ?? 0));     // absolute charge magnitude
  const m = Number(p.muH ?? 0);                  // hydrophobic moment
  const helix = typeof p.ffHelixPercent === "number" ? (p.ffHelixPercent >= 50 ? 1 : 0) : 0;
  return w.wH*h + w.wCharge*c + w.wMuH*m + w.wHelix*helix;
}


type BackendRow = Record<string, any>;

interface DatasetState {
  // Raw CSV data (preview)
  rawData: ParsedCSVData | null;

  // Processed peptide data (after mapping / backend analysis)
  peptides: Peptide[];

  // Column mapping chosen by the user
  columnMapping: ColumnMapping;

  // Aggregate stats for Results / Detail pages
  stats: DatasetStats | null;

  // Dataset metadata (JPred, Tango usage, etc.)
  meta: DatasetMetadata | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setRawData: (data: ParsedCSVData) => void;
  setRawPreview: (data: ParsedCSVData) => void; // alias
  setPeptides: (peptides: Peptide[]) => void;
  ingestBackendRows: (rows: BackendRow[], meta?: DatasetMetadata) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  setMetadata: (meta: DatasetMetadata) => void;
  calculateStats: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetData: () => void;

  // Lookups
  getPeptideById: (id: string) => Peptide | undefined;
}

const initialState: Omit<
  DatasetState,
  | 'setRawData'
  | 'setRawPreview'
  | 'setPeptides'
  | 'ingestBackendRows'
  | 'setColumnMapping'
  | 'setMetadata'
  | 'calculateStats'
  | 'setLoading'
  | 'setError'
  | 'resetData'
  | 'getPeptideById'
> = {
  rawData: null,
  peptides: [],
  columnMapping: {},
  stats: null,
  meta: null,
  isLoading: false,
  error: null,
};

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setRawData: (data) => set({ rawData: data }),
      setRawPreview: (data) => set({ rawData: data }),

      setPeptides: (peptides) => {
        set({ peptides });
        get().calculateStats();
      },

      ingestBackendRows: (rows: BackendRow[], meta?: DatasetMetadata) => {
        // Map whatever the backend returns into the Peptide shape used by the UI.
        // Defensive: accepts multiple possible key names.
        const mapped: Peptide[] = rows
          .map((r: BackendRow, i: number) => {
            const seq: string | undefined =
              r.Sequence ?? r.sequence ?? r.seq ?? undefined;
            if (!seq) return undefined;
      
            const id: string = String(
              r.Entry ??
                r.entry ??
                r.id ??
                r.Accession ??
                r.accession ??
                r.uniprot ??
                r.name ??
                i + 1
            );
      
            const length =
              Number(
                r.Length ??
                  r.length ??
                  (typeof seq === "string" ? seq.length : undefined)
              ) || 0;
      
            // --- μH: prefer "Full length uH", else "Hydrophobic moment" ---
            const muH =
              r["Full length uH"] !== undefined
                ? Number(r["Full length uH"])
                : r["Hydrophobic moment"] !== undefined
                ? Number(r["Hydrophobic moment"])
                : r.muH !== undefined
                ? Number(r.muH)
                : undefined;
      
            // --- FF-Helix: backend flag -1/1 → UI wants percent 0/100 ---
            let ffHelixPercent: number | undefined = undefined;
            if (r["FF-Helix (Jpred)"] !== undefined) {
              const flag = Number(r["FF-Helix (Jpred)"]);
              ffHelixPercent = flag === 1 ? 100 : 0;
            } else if (
              r["FF-Helix"] !== undefined ||
              r.ffHelixPercent !== undefined ||
              r.helix_percent !== undefined
            ) {
              ffHelixPercent = Number(
                r["FF-Helix"] ?? r.ffHelixPercent ?? r.helix_percent
              );
            } else if (r["Helix percentage (Jpred)"] !== undefined) {
              ffHelixPercent = Number(r["Helix percentage (Jpred)"]);
            }
      
            // --- Chameleon: prefer final FF flag, else raw SSW, else fallback ---
            const chameleonPrediction =
              (r["FF-Secondary structure switch"] ??
                r["FF-Chameleon"] ??
                r.FFChameleon ??
                r["Chameleon prediction"] ??
                r.chameleonPrediction ??
                r.chameleon ??
                r["SSW prediction"] ??
                0) as -1 | 0 | 1;
      
            // --- JPred fragments: stringified JSON or array ---
            let helixFragments: [number, number][] | undefined;
            const rawFragments =
              r["Helix fragments (Jpred)"] ??
              r.helixFragments ??
              r.jpredFragments;
            if (typeof rawFragments === "string") {
              try {
                const arr = JSON.parse(rawFragments);
                if (Array.isArray(arr)) helixFragments = arr;
              } catch {
                // ignore parse errors
              }
            } else if (Array.isArray(rawFragments)) {
              helixFragments = rawFragments as [number, number][];
            }
      
            const peptide: Peptide = {
              id,
              name:
                r["Protein name"] ??
                r.ProteinName ??
                r.Name ??
                r["Entry name"] ??
                r.name ??
                `Peptide ${i + 1}`,
              sequence: String(seq).toUpperCase(),
              length,
              species: r.Organism ?? r.organism ?? r.Species ?? r.species,
              hydrophobicity:
                Number(
                  r.Hydrophobicity ??
                    r.hydrophobicity ??
                    r.hydro ??
                    0
                ) || 0,
              charge: Number(r.Charge ?? r.charge ?? 0) || 0,
              muH,
              chameleonPrediction,
              ffHelixPercent,
              jpred: helixFragments ? { helixFragments } : undefined,
            };
      
            return peptide;
          })
          .filter(Boolean) as Peptide[];
      
        set({ peptides: mapped, meta: meta || null });
        get().calculateStats();
      },
      

      setColumnMapping: (mapping) => set({ columnMapping: mapping }),
      
      setMetadata: (meta) => set({ meta }),

      calculateStats: () => {
        const { peptides } = get();
        if (!peptides.length) {
          set({ stats: null });
          return;
        }

        const totalPeptides = peptides.length;
        const chameleonPositive = peptides.filter(
          (p) => p.chameleonPrediction === 1
        ).length;
        const chameleonPositivePercent =
          (chameleonPositive / totalPeptides) * 100;

        const mean = (arr: number[]) =>
          arr.reduce((s, v) => s + v, 0) / arr.length;

        const meanHydrophobicity = mean(peptides.map((p) => p.hydrophobicity));
        const meanCharge = mean(peptides.map((p) => p.charge));
        const meanLength = mean(peptides.map((p) => p.length));

        const helixVals = peptides
          .map((p) => p.ffHelixPercent)
          .filter((v): v is number => typeof v === 'number');
        const meanFFHelixPercent = helixVals.length ? mean(helixVals) : 0;

        const stats: DatasetStats = {
          totalPeptides,
          chameleonPositivePercent,
          meanHydrophobicity,
          meanCharge,
          meanFFHelixPercent,
          meanLength,
        };

        set({ stats });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      resetData: () => set({ ...initialState }),

      getPeptideById: (id) => {
        const { peptides } = get();
        return peptides.find((p) => p.id === id);
      },
    }),
    {
      name: 'peptide-dataset-storage',
      partialize: (state) => ({
        // keep mapping between page reloads; avoid persisting heavy arrays
        columnMapping: state.columnMapping,
      }),
    }
  )
);

// --- Flag threshold store ---

type FlagsState = {
  muHCutoff: number;
  hydroCutoff: number;
  setFlags: (p: Partial<Pick<FlagsState, 'muHCutoff' | 'hydroCutoff'>>) => void;
};

// Either style works; pick ONE of these:

// A) Standard generic form
export const useFlags = create<FlagsState>((set) => ({
  muHCutoff: 0,
  hydroCutoff: 0,
  setFlags: (p) => set(p),
}));

