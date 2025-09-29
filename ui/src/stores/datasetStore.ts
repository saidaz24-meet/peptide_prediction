import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
  DatasetMetadata,
} from '../types/peptide';

import { mapBackendRowToPeptide } from "@/lib/mappers";
import type { Peptide } from "@/types/peptide";

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
  const helix = p.ffHelixPercent && p.ffHelixPercent >= 50 ? 1 : 0;
  return w.wH*h + w.wCharge*c + w.wMuH*m + w.wHelix*helix;
}

type BackendRow = Record<string, any>;

interface DatasetState {
  rawData: ParsedCSVData | null;
  peptides: Peptide[];
  columnMapping: ColumnMapping;
  stats: DatasetStats | null;
  meta: DatasetMetadata | null;

  isLoading: boolean;
  error: string | null;

  setRawData: (data: ParsedCSVData) => void;
  setRawPreview: (data: ParsedCSVData) => void;
  setPeptides: (peptides: Peptide[]) => void;
  ingestBackendRows: (rows: BackendRow[], meta?: DatasetMetadata) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  setMetadata: (meta: DatasetMetadata) => void;
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
        console.log('[DEBUG] Raw backend row sample:', rows[0]); // Debug log
        console.log('[DEBUG] FF-Helix keys in first row:', Object.keys(rows[0]).filter(k => k.toLowerCase().includes('helix')));

        
        const mapped: Peptide[] = rows
          .map((r: BackendRow) => {
            try {
              return mapBackendRowToPeptide(r);
            } catch (error) {
              console.warn('Failed to map row:', r, error);
              return null;
            }
          })
          .filter((p): p is Peptide => p !== null);

        console.log('[DEBUG] First mapped peptide:', mapped[0]); // Debug log
        
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
        
        // Count chameleon positives (prediction === 1)
        const chameleonPositive = peptides.filter(
          (p) => p.chameleonPrediction === 1
        ).length;
        const chameleonPositivePercent = (chameleonPositive / totalPeptides) * 100;

        // Helper for means
        const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

        // Basic biochemical stats
        const meanHydrophobicity = mean(peptides.map((p) => p.hydrophobicity));
        const meanCharge = mean(peptides.map((p) => Math.abs(p.charge)));
        const meanLength = mean(peptides.map((p) => p.length));

        // FF-Helix stats (only count peptides where we have data)
        const helixVals = peptides
          .map((p) => p.ffHelixPercent)
          .filter((v): v is number => typeof v === 'number');
        const meanFFHelixPercent = helixVals.length ? mean(helixVals) : 0;

        // Count availability of different prediction types
        const jpredAvailable = peptides.filter(p => p.jpred?.helixFragments.length).length;
        const ffHelixAvailable = peptides.filter(p => typeof p.ffHelixPercent === 'number').length;
        const chameleonAvailable = peptides.filter(p => p.chameleonPrediction !== -1).length;

        const stats: DatasetStats = {
          totalPeptides,
          chameleonPositivePercent,
          meanHydrophobicity,
          meanCharge,
          meanFFHelixPercent,
          meanLength,
          // Add these for better UI display
          jpredAvailable,
          ffHelixAvailable, 
          chameleonAvailable,
        };

        console.log('[DEBUG] Calculated stats:', stats); // Debug log

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

// --- Flag threshold store (unchanged) ---
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
