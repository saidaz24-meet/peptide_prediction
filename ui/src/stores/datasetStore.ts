import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Peptide,
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
  DatasetMetadata,
} from '../types/peptide';

import { mapBackendRowToPeptide } from "@/lib/mappers"; // unchanged

// --- SMART RANKING (weights + scorer) ---
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
  const h = Number(p.hydrophobicity ?? 0);
  const c = Math.abs(Number(p.charge ?? 0));
  const m = Number(p.muH ?? 0);
  const helix = typeof p.ffHelixPercent === "number" ? (p.ffHelixPercent >= 50 ? 1 : 0) : 0;
  return w.wH*h + w.wCharge*c + w.wMuH*m + w.wHelix*helix;
}

type BackendRow = Record<string, any>;

interface DatasetState {
  rawData: ParsedCSVData | null;
  peptides: Peptide[];
  columnMapping: ColumnMapping;
  stats: DatasetStats | null;

  // 🔹 NEW: keep backend provenance info
  meta: DatasetMetadata | null;

  isLoading: boolean;
  error: string | null;

  setRawData: (data: ParsedCSVData) => void;
  setRawPreview: (data: ParsedCSVData) => void;
  setPeptides: (peptides: Peptide[]) => void;
  ingestBackendRows: (rows: BackendRow[], meta?: DatasetMetadata) => void; // 🔹 changed
  setColumnMapping: (mapping: ColumnMapping) => void;
  setMetadata: (meta: DatasetMetadata) => void; // 🔹 new
  calculateStats: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetData: () => void;
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
  meta: null, // 🔹 added
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

      // 🔹 Changed: now accepts `meta` and saves it
      ingestBackendRows: (rows: BackendRow[], meta?: DatasetMetadata) => {
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

            const muH =
              r["Full length uH"] !== undefined
                ? Number(r["Full length uH"])
                : r["Hydrophobic moment"] !== undefined
                ? Number(r["Hydrophobic moment"])
                : r.muH !== undefined
                ? Number(r.muH)
                : undefined;

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

            const chameleonPrediction =
              (r["FF-Secondary structure switch"] ??
                r["FF-Chameleon"] ??
                r.FFChameleon ??
                r["Chameleon prediction"] ??
                r.chameleonPrediction ??
                r.chameleon ??
                r["SSW prediction"] ??
                0) as -1 | 0 | 1;

            let helixFragments: [number, number][] | undefined;
            const rawFragments =
              r["Helix fragments (Jpred)"] ??
              r.helixFragments ??
              r.jpredFragments;
            if (typeof rawFragments === "string") {
              try {
                const arr = JSON.parse(rawFragments);
                if (Array.isArray(arr)) helixFragments = arr;
              } catch {}
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

        set({ peptides: mapped, meta: meta || null }); // 🔹 save meta too
        get().calculateStats();
      },

      setColumnMapping: (mapping) => set({ columnMapping: mapping }),

      // 🔹 Added: standalone setter for meta
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
      getPeptideById: (id) => get().peptides.find((p) => p.id === id),
    }),
    {
      name: 'peptide-dataset-storage',
      partialize: (state) => ({
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

export const useFlags = create<FlagsState>((set) => ({
  muHCutoff: 0,
  hydroCutoff: 0,
  setFlags: (p) => set(p),
}));
