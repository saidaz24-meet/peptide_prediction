import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Peptide,
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
} from '../types/peptide';

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

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setRawData: (data: ParsedCSVData) => void;
  setRawPreview: (data: ParsedCSVData) => void; // alias
  setPeptides: (peptides: Peptide[]) => void;
  ingestBackendRows: (rows: BackendRow[]) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
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

      ingestBackendRows: (rows: BackendRow[]) => {
        // Map whatever the backend returns into the Peptide shape used by the UI.
        // This is defensive: it accepts multiple possible key names.
        const mapped: Peptide[] = rows
          .map((r: BackendRow, i: number) => {
            const seq: string | undefined =
              r.Sequence ?? r.sequence ?? r.seq ?? undefined;
            if (!seq) return undefined;

            const id: string =
              String(r.Entry ?? r.entry ?? r.id ?? r.uniprot ?? r.name ?? i + 1);

            const length =
              r.length ??
              (typeof seq === 'string' ? seq.length : undefined) ??
              0;

            const chameleon =
              Number(
                r['FF-Chameleon'] ??
                  r.FFChameleon ??
                  r.chameleonPrediction ??
                  r['Chameleon prediction'] ??
                  r.chameleon
              ) || 0;

            const ffHelix =
              r['FF-Helix (Jpred)'] ??
              r['FF-Helix'] ??
              r.ffHelixPercent ??
              r.helix_percent ??
              undefined;

            // jpred fragments may arrive as string like "[[5,18],[31,40]]"
            let helixFragments: [number, number][] | undefined = undefined;
            const rawFragments =
              r['Helix fragments (Jpred)'] ?? r.helixFragments ?? r.jpredFragments;
            if (typeof rawFragments === 'string') {
              try {
                const parsed = JSON.parse(rawFragments);
                if (Array.isArray(parsed)) helixFragments = parsed;
              } catch {
                // ignore parse errors
              }
            } else if (Array.isArray(rawFragments)) {
              helixFragments = rawFragments as [number, number][];
            }

            const peptide: Peptide = {
              id,
              name:
                r['Protein name'] ??
                r.ProteinName ??
                r.name ??
                `Peptide ${i + 1}`,
              sequence: seq,
              length,
              species: r.Organism ?? r.species ?? r.organism,
              hydrophobicity:
                Number(r.Hydrophobicity ?? r.hydrophobicity ?? r.hydro ?? 0) || 0,
              charge: Number(r.Charge ?? r.charge ?? 0) || 0,
              muH:
                r.muH !== undefined
                  ? Number(r.muH)
                  : r['Hydrophobic moment'] !== undefined
                  ? Number(r['Hydrophobic moment'])
                  : undefined,
              chameleonPrediction: (chameleon as 1 | 0 | -1) ?? 0,
              ffHelixPercent:
                ffHelix !== undefined ? Number(ffHelix) : undefined,
              jpred: helixFragments ? { helixFragments } : undefined,
            };

            return peptide;
          })
          .filter(Boolean) as Peptide[];

        set({ peptides: mapped });
        get().calculateStats();
      },

      setColumnMapping: (mapping) => set({ columnMapping: mapping }),

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
