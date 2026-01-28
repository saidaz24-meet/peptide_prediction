import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
  DatasetMetadata,
} from '../types/peptide';

import { mapBackendRowToPeptide } from "@/lib/mappers";
import type { Peptide, ThresholdConfig } from "@/types/peptide";

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
  w: { wH:number; wCharge:number; wMuH:number; wHelix:number },
  ffHelixThreshold: number = 50.0  // Default threshold, can be overridden from meta.thresholds
){
  const h = Number(p.hydrophobicity ?? 0);
  const c = Math.abs(Number(p.charge ?? 0));
  const m = Number(p.muH ?? 0);
  const helix = p.ffHelixPercent && p.ffHelixPercent >= ffHelixThreshold ? 1 : 0;
  return w.wH*h + w.wCharge*c + w.wMuH*m + w.wHelix*helix;
}

type BackendRow = Record<string, any>;

// Run input types for reproduce
export type RunInput = 
  | File  // For uploadCSV
  | { sequence: string; entry?: string };  // For predictOne

interface DatasetState {
  rawData: ParsedCSVData | null;
  peptides: Peptide[];
  columnMapping: ColumnMapping;
  stats: DatasetStats | null;
  meta: DatasetMetadata | null;

  isLoading: boolean;
  error: string | null;

  // Reproduce run state (for stateless reproduction)
  lastRunType: 'upload' | 'predict' | null;
  lastRunInput: RunInput | null;  // File or { sequence, entry }
  lastRunConfig: ThresholdConfig | null;

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
  setLastRun: (type: 'upload' | 'predict', input: RunInput, config: ThresholdConfig | null) => void;
  getLastRun: () => { type: 'upload' | 'predict' | null; input: RunInput | null; config: ThresholdConfig | null };
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
  | 'setLastRun'
  | 'getLastRun'
> = {
  rawData: null,
  peptides: [],
  columnMapping: {},
  stats: null,
  meta: null,
  isLoading: false,
  error: null,
  lastRunType: null,
  lastRunInput: null,
  lastRunConfig: null,
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
        // Debug entry (can be set via localStorage or URL param)
        const debugEntry = (typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG_ENTRY')) || 
                          new URLSearchParams(window.location.search).get('debug_entry') || '';
        
        if (debugEntry) {
          console.log(`[DEBUG_TRACE][FRONTEND_RECEIVE] Looking for entry: ${debugEntry}`);
          const debugRow = rows.find(r => String(r.id || r.entry || '').trim() === debugEntry.trim());
          if (debugRow) {
            console.log(`[DEBUG_TRACE][FRONTEND_RECEIVE] Found entry ${debugEntry}:`, debugRow);
            console.log(`  Raw backend row keys (chameleon-related):`, 
              Object.keys(debugRow).filter(k => k.toLowerCase().includes('ssw') || 
                k.toLowerCase().includes('chameleon') || k.toLowerCase().includes('helix') || 
                k.toLowerCase().includes('beta')));
            for (const key of ['id', 'sswPrediction', 'sswHelixPercentage', 
                             'sswBetaPercentage', 'ffHelixPercent']) {
              if (key in debugRow) {
                console.log(`  ${key}: ${debugRow[key]} (type: ${typeof debugRow[key]})`);
              }
            }
          } else {
            console.log(`[DEBUG_TRACE][FRONTEND_RECEIVE] Entry ${debugEntry} not found in rows`);
          }
        }

        const mapped: Peptide[] = rows
          .map((r: BackendRow, idx: number) => {
            try {
              const mapped_pep = mapBackendRowToPeptide(r);
              // Debug: Log mapping for traced entry
              if (debugEntry && String(mapped_pep.id).trim() === debugEntry.trim()) {
                console.log(`[DEBUG_TRACE][FRONTEND_MAP] Entry ${debugEntry} after mapping:`, mapped_pep);
                console.log(`  sswPrediction: ${mapped_pep.sswPrediction} (type: ${typeof mapped_pep.sswPrediction})`);
                console.log(`  sswHelixPercentage: ${mapped_pep.sswHelixPct} (type: ${typeof mapped_pep.sswHelixPct})`);
                console.log(`  sswBetaPercentage: ${mapped_pep.sswBetaPct} (type: ${typeof mapped_pep.sswBetaPct})`);
              }
              return mapped_pep;
            } catch (error) {
              console.warn(`[datasetStore] Failed to map row ${idx}:`, r, 'Error:', error);
              return null;
            }
          })
          .filter((p): p is Peptide => p !== null);

        const failedCount = rows.length - mapped.length;
        if (failedCount > 0) {
          console.warn(`[datasetStore] ${failedCount} of ${rows.length} rows failed to map`);
        }
        
        set({ peptides: mapped, meta: meta || null });
        get().calculateStats();
      },

      setColumnMapping: (mapping) => set({ columnMapping: mapping }),
      setMetadata: (meta) => set({ meta }),

      calculateStats: () => {
        const { peptides, meta } = get();
        if (!peptides.length) {
          set({ stats: null });
          return;
        }

        const totalPeptides = peptides.length;
        
        // Check provider status: if TANGO is OFF or UNAVAILABLE, SSW KPI should be N/A
        const tangoStatus = meta?.provider_status?.tango?.status;
        const tangoUnavailable = tangoStatus === 'OFF' || tangoStatus === 'UNAVAILABLE';
        
        // Count SSW positives (prediction === 1) - gate: only count rows with valid TANGO metrics (sswPrediction !== null/undefined)
        // Denominator: rows with sswPrediction !== null/undefined
        // Numerator: rows with sswPrediction === 1
        // If provider is OFF/UNAVAILABLE, denominator will be 0 → return null
        const sswValidPeptides = peptides.filter((p) => {
          const sswVal = p.sswPrediction ?? (p as any).chameleonPrediction;
          // Only include rows with valid TANGO metrics (not null, not undefined, not NaN)
          if (sswVal === null || sswVal === undefined || sswVal === "null") {
            return false;
          }
          // Also exclude NaN (shouldn't happen after backend fix, but defensive)
          if (typeof sswVal === 'number' && (isNaN(sswVal) || !isFinite(sswVal))) {
            return false;
          }
          return true;
        });
        const sswPositive = sswValidPeptides.filter(
          (p) => {
            const sswVal = p.sswPrediction ?? (p as any).chameleonPrediction;
            return typeof sswVal === 'number' && sswVal === 1;
          }
        ).length;
        // Only compute percent if we have valid TANGO data (denominator > 0)
        // If denominator == 0 → return null (UI will show N/A)
        // Also return null if provider is OFF/UNAVAILABLE
        const sswPositivePercent = (!tangoUnavailable && sswValidPeptides.length > 0)
          ? (sswPositive / sswValidPeptides.length) * 100 
          : null;
        
        // Debug: Log stats computation for traced entry
        const debugEntry = (typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG_ENTRY')) || 
                          new URLSearchParams(window.location.search).get('debug_entry') || '';
        if (debugEntry) {
          const debugPep = peptides.find(p => String(p.id).trim() === debugEntry.trim());
          if (debugPep) {
            console.log(`[DEBUG_TRACE][FRONTEND_STATS] Entry ${debugEntry} in stats calculation:`);
          const sswPred = debugPep.sswPrediction ?? (debugPep as any).chameleonPrediction;
          console.log(`  sswPrediction: ${sswPred} (type: ${typeof sswPred})`);
          console.log(`  Is counted as positive: ${sswPred === 1}`);
          }
          console.log(`[DEBUG_TRACE][FRONTEND_STATS] Final computed stats:`);
          console.log(`  sswPositive: ${sswPositive}`);
          console.log(`  sswPositivePercent: ${sswPositivePercent !== null ? `${sswPositivePercent}%` : 'N/A'}`);
          console.log(`  Total peptides: ${totalPeptides}`);
        }

        // Helper for means (returns null if no valid values)
        const mean = (arr: number[]): number | null => {
          if (arr.length === 0) return null;
          return arr.reduce((s, v) => s + v, 0) / arr.length;
        };

        // Basic biochemical stats (always computed, no provider dependency)
        const meanHydrophobicity = mean(
          peptides.map((p) => p.hydrophobicity).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
        ) ?? 0;
        const meanCharge = mean(
          peptides.map((p) => Math.abs(p.charge ?? 0)).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
        ) ?? 0;
        const meanLength = mean(
          peptides.map((p) => p.length).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
        ) ?? 0;

        // FF-Helix stats (only count peptides where we have data)
        // FF-Helix is always computed (no provider dependency), but may be null/undefined
        const helixVals = peptides
          .map((p) => p.ffHelixPercent)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const meanFFHelixPercent = helixVals.length > 0 ? mean(helixVals) : null;
        
        // CSV path guard: one-time console warning if all FF-Helix values are 0/null on CSV path but non-zero on UniProt
        // This helps diagnose mapping issues between CSV normalization and UI
        if (meanFFHelixPercent === null || meanFFHelixPercent === 0) {
          const sampleVals = peptides.slice(0, 3).map(p => ({
            id: p.id,
            ffHelixPercent: p.ffHelixPercent,
            type: typeof p.ffHelixPercent,
          }));
          console.warn(
            '[CSV_FF_HELIX_GUARD] FF-Helix mean is null or 0. Sample values:',
            sampleVals,
            'Total peptides:', peptides.length,
            'Valid FF-Helix count:', helixVals.length
          );
        }

        // Count availability of different prediction types
        const jpredAvailable = peptides.filter(p => 
          p.providerStatus?.jpred?.status === "available" && 
          p.jpred?.helixFragments && p.jpred.helixFragments.length > 0
        ).length;
        const ffHelixAvailable = peptides.filter(p => 
          typeof p.ffHelixPercent === 'number' && !Number.isNaN(p.ffHelixPercent)
        ).length;
        // SSW available: count rows with valid TANGO metrics (sswPrediction !== null/undefined)
        // Only count if provider is not OFF/UNAVAILABLE
        const sswAvailable = tangoUnavailable ? 0 : peptides.filter(p => {
          const sswVal = p.sswPrediction ?? (p as any).chameleonPrediction;
          if (sswVal === null || sswVal === undefined || sswVal === "null") {
            return false;
          }
          // Also exclude NaN (shouldn't happen after backend fix, but defensive)
          if (typeof sswVal === 'number' && (isNaN(sswVal) || !isFinite(sswVal))) {
            return false;
          }
          return true;
        }).length;

        const stats: DatasetStats = {
          totalPeptides,
          sswPositivePercent,
          meanHydrophobicity,
          meanCharge,
          meanFFHelixPercent,
          meanLength,
          // Add these for better UI display
          jpredAvailable,
          ffHelixAvailable, 
          sswAvailable,
          // Backward compatibility aliases (deprecated)
          chameleonPositivePercent: sswPositivePercent,
          chameleonAvailable: sswAvailable,
        };

        // Regression check: verify table positives match stats positives
        // Count positives from actual peptides array (what table sees) - gate: only rows with valid TANGO metrics
        const tableValidPeptides = peptides.filter((p) => {
          const sswVal = p.sswPrediction ?? (p as any).chameleonPrediction;
          return sswVal !== null && sswVal !== undefined && sswVal !== "null";
        });
        const tablePositives = tableValidPeptides.filter(p => {
          const sswVal = p.sswPrediction ?? (p as any).chameleonPrediction;
          return typeof sswVal === 'number' && sswVal === 1;
        }).length;
        const tablePositivePercent = tableValidPeptides.length > 0 
          ? (tablePositives / tableValidPeptides.length) * 100 
          : null;
        // Only check regression if both values are non-null
        if (sswPositivePercent !== null && tablePositivePercent !== null && 
            Math.abs(tablePositivePercent - sswPositivePercent) > 0.1) {
          console.error(
            `[REGRESSION] SSW count mismatch: ` +
            `Stats=${sswPositivePercent.toFixed(1)}% (${sswPositive} positives), ` +
            `Table=${tablePositivePercent.toFixed(1)}% (${tablePositives} positives)`
          );
          // In production, you might want to throw or report to monitoring
        }

        console.log('[DEBUG] Calculated stats:', stats); // Debug log

        set({ stats });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      resetData: () => set({ ...initialState }),
      getPeptideById: (id) => get().peptides.find((p) => p.id === id),
      
      // Reproduce run state management
      setLastRun: (type, input, config) => {
        set({ 
          lastRunType: type, 
          lastRunInput: input, 
          lastRunConfig: config 
        });
      },
      
      getLastRun: () => {
        const state = get();
        return {
          type: state.lastRunType,
          input: state.lastRunInput,
          config: state.lastRunConfig,
        };
      },
    }),
    {
      name: 'peptide-dataset-storage',
      partialize: (state) => ({
        columnMapping: state.columnMapping,
        // Only persist config and predict input (not File objects)
        lastRunType: state.lastRunType,
        lastRunInput: state.lastRunType === 'predict' ? state.lastRunInput : null,  // Don't persist File
        lastRunConfig: state.lastRunConfig,
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
