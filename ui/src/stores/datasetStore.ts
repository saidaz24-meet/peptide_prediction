import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ColumnMapping,
  DatasetStats,
  ParsedCSVData,
  DatasetMetadata,
} from '../types/peptide';

import { mapApiRowToPeptide } from "@/lib/peptideMapper";
import { uploadCSV, predictOne as apiPredictOne } from "@/lib/api";
import type { Peptide, ThresholdConfig } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";

// --- SMART RANKING (weights + scorer) ---
export const useThresholds = create<{
  wH: number; wCharge: number; wMuH: number; wFfHelix: number; wFfSsw: number;
  topN: number;
  setWeights: (partial: Partial<{wH:number;wCharge:number;wMuH:number;wFfHelix:number;wFfSsw:number;topN:number}>) => void;
}>(set => ({
  wH: 1, wCharge: 1, wMuH: 1, wFfHelix: 1, wFfSsw: 1, topN: 10,
  setWeights: (partial) => set(partial),
}));

export type ZStats = {
  hMean: number; hStd: number;
  cMean: number; cStd: number;
  mMean: number; mStd: number;
};

export function computeZStats(peptides: Peptide[]): ZStats {
  const hVals = peptides.map(p => Number(p.hydrophobicity ?? 0));
  const cVals = peptides.map(p => Math.abs(Number(p.charge ?? 0)));
  const mVals = peptides.map(p => Number(p.muH ?? 0));
  const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const std = (a: number[], m: number) => {
    if (a.length < 2) return 1; // avoid div-by-zero
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1;
  };
  const hM = mean(hVals), cM = mean(cVals), mM = mean(mVals);
  return { hMean: hM, hStd: std(hVals, hM), cMean: cM, cStd: std(cVals, cM), mMean: mM, mStd: std(mVals, mM) };
}

export function scorePeptide(
  p: Peptide,
  w: { wH:number; wCharge:number; wMuH:number; wFfHelix:number; wFfSsw:number },
  zStats?: ZStats,
){
  const h = Number(p.hydrophobicity ?? 0);
  const c = Math.abs(Number(p.charge ?? 0));
  const m = Number(p.muH ?? 0);
  const ffHelix = p.ffHelixFlag === 1 ? 1 : 0;
  const ffSsw = p.ffSswFlag === 1 ? 1 : 0;
  if (zStats) {
    const hz = (h - zStats.hMean) / zStats.hStd;
    const cz = (c - zStats.cMean) / zStats.cStd;
    const mz = (m - zStats.mMean) / zStats.mStd;
    return w.wH*hz + w.wCharge*cz + w.wMuH*mz + w.wFfHelix*ffHelix + w.wFfSsw*ffSsw;
  }
  return w.wH*h + w.wCharge*c + w.wMuH*m + w.wFfHelix*ffHelix + w.wFfSsw*ffSsw;
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

  // Volatile source references (not persisted — for recalculate)
  sourceFile: File | null;

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
  setSourceFile: (file: File | null) => void;
  recalculate: (thresholds: ResolvedThresholds) => Promise<'server' | 'client' | 'none'>;
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
  | 'setSourceFile'
  | 'recalculate'
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
  sourceFile: null,
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
        const mapped: Peptide[] = rows
          .map((r: BackendRow, idx: number) => {
            try {
              const source = '/api/ingestBackendRows';
              const mapped_pep = mapApiRowToPeptide(r, `${source}[${idx}]`);
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
          const sswVal = p.sswPrediction;
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
            const sswVal = p.sswPrediction;
            return typeof sswVal === 'number' && sswVal === 1;
          }
        ).length;
        // Only compute percent if we have valid TANGO data (denominator > 0)
        // If denominator == 0 → return null (UI will show N/A)
        // Also return null if provider is OFF/UNAVAILABLE
        const sswPositivePercent = (!tangoUnavailable && sswValidPeptides.length > 0)
          ? (sswPositive / sswValidPeptides.length) * 100 
          : null;
        
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

        // μH stats
        const muHVals = peptides
          .map((p) => p.muH)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const meanMuH = muHVals.length > 0 ? (mean(muHVals) ?? null) : null;

        // FF-Helix stats (only count peptides where we have data)
        // FF-Helix is always computed (no provider dependency), but may be null/undefined
        const helixVals = peptides
          .map((p) => p.ffHelixPercent)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const meanFFHelixPercent = helixVals.length > 0 ? mean(helixVals) : null;
        
        // S4PRED Helix % stats
        const s4predHelixVals = peptides
          .map((p) => p.s4predHelixPercent)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const meanS4predHelixPercent = s4predHelixVals.length > 0 ? mean(s4predHelixVals) : null;

        // Count availability of different prediction types
        const s4predAvailable = peptides.filter(p => {
          const st = p.providerStatus?.s4pred?.status?.toUpperCase();
          return st === "AVAILABLE" || st === "PARTIAL";
        }).length;
        const ffHelixAvailable = peptides.filter(p => 
          typeof p.ffHelixPercent === 'number' && !Number.isNaN(p.ffHelixPercent)
        ).length;
        // SSW available: count rows with valid TANGO metrics (sswPrediction !== null/undefined)
        // Only count if provider is not OFF/UNAVAILABLE
        const sswAvailable = tangoUnavailable ? 0 : peptides.filter(p => {
          const sswVal = p.sswPrediction;
          if (sswVal === null || sswVal === undefined || sswVal === "null") {
            return false;
          }
          // Also exclude NaN (shouldn't happen after backend fix, but defensive)
          if (typeof sswVal === 'number' && (isNaN(sswVal) || !isFinite(sswVal))) {
            return false;
          }
          return true;
        }).length;

        // Aggregation hotspot count (tangoAggMax > aggThreshold)
        // Denominator: peptides WITH TANGO data (not all peptides)
        const aggThreshold = (meta?.thresholds as any)?.aggThreshold ?? 5.0;
        const tangoDataPeptides = !tangoUnavailable
          ? peptides.filter(p => typeof p.tangoAggMax === 'number')
          : [];
        const aggHotspots = tangoDataPeptides.filter(p => (p.tangoAggMax as number) > aggThreshold).length;
        const aggHotspotPercent = tangoDataPeptides.length > 0
          ? (aggHotspots / tangoDataPeptides.length) * 100
          : null;

        // FF-Helix candidate count: ffHelixFlag === 1
        const ffHelixCandidates = peptides.filter(p => p.ffHelixFlag === 1).length;
        const ffHelixCandidatePercent = totalPeptides > 0 ? (ffHelixCandidates / totalPeptides) * 100 : null;

        // FF-SSW candidate count: ffSswFlag === 1 (gated on TANGO availability)
        const ffSswCandidates = peptides.filter(p => p.ffSswFlag === 1).length;
        const ffSswCandidatePercent = (!tangoUnavailable && totalPeptides > 0)
          ? (ffSswCandidates / totalPeptides) * 100 : null;

        const stats: DatasetStats = {
          totalPeptides,
          sswPositivePercent,
          meanHydrophobicity,
          meanCharge,
          meanMuH,
          meanFFHelixPercent,
          meanS4predHelixPercent,
          meanLength,
          ffHelixCandidatePercent,
          ffSswCandidatePercent,
          // Add these for better UI display
          s4predAvailable,
          ffHelixAvailable,
          sswAvailable,
          aggHotspotPercent,
        };

        // Regression check: verify table positives match stats positives
        // Count positives from actual peptides array (what table sees) - gate: only rows with valid TANGO metrics
        const tableValidPeptides = peptides.filter((p) => {
          const sswVal = p.sswPrediction;
          return sswVal !== null && sswVal !== undefined && sswVal !== "null";
        });
        const tablePositives = tableValidPeptides.filter(p => {
          const sswVal = p.sswPrediction;
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

        set({ stats });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      resetData: () => {
        set({ ...initialState });
        // Also clear persisted data from localStorage to prevent resurrection
        try { localStorage.removeItem('peptide-dataset-storage'); } catch {}
      },
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

      setSourceFile: (file) => set({ sourceFile: file }),

      recalculate: async (thresholds) => {
        const state = get();
        const thresholdConfig: ThresholdConfig = {
          mode: 'custom',
          version: '1.0.0',
          custom: thresholds,
        };

        // Case 1: Upload source file available → re-POST
        if (state.sourceFile) {
          set({ isLoading: true });
          try {
            const { rows, meta } = (await uploadCSV(state.sourceFile, thresholdConfig)) as any;
            const mapped: Peptide[] = rows
              .map((r: BackendRow, idx: number) => {
                try {
                  return mapApiRowToPeptide(r, `/api/recalculate[${idx}]`);
                } catch { return null; }
              })
              .filter((p: Peptide | null): p is Peptide => p !== null);
            set({ peptides: mapped, meta: meta || null, lastRunConfig: thresholdConfig });
            get().calculateStats();
            return 'server';
          } finally {
            set({ isLoading: false });
          }
        }

        // Case 2: Predict source (single sequence) → re-POST
        if (state.lastRunType === 'predict' && state.lastRunInput && typeof state.lastRunInput === 'object' && 'sequence' in state.lastRunInput) {
          const input = state.lastRunInput as { sequence: string; entry?: string };
          set({ isLoading: true });
          try {
            const response = await apiPredictOne(input.sequence, input.entry, thresholdConfig);
            const peptide = mapApiRowToPeptide(response.row, '/api/recalculate');
            set({ peptides: [peptide], lastRunConfig: thresholdConfig });
            get().calculateStats();
            return 'server';
          } finally {
            set({ isLoading: false });
          }
        }

        // Case 3: No source available → client-side only (aggFlags already applied via thresholdStore)
        return 'none';
      },
    }),
    {
      name: 'peptide-dataset-storage',
      version: 2,  // Bump when persisted schema changes
      migrate: (persisted: any, version: number) => {
        // v0/v1 → v2: added peptides, stats, meta to persist
        if (version < 2) {
          return {
            ...initialState,
            columnMapping: persisted?.columnMapping ?? {},
            lastRunType: persisted?.lastRunType ?? null,
            lastRunInput: persisted?.lastRunInput ?? null,
            lastRunConfig: persisted?.lastRunConfig ?? null,
          };
        }
        return persisted;
      },
      partialize: (state) => ({
        // Persist prediction results so they survive page refresh
        peptides: state.peptides,
        stats: state.stats,
        meta: state.meta,
        columnMapping: state.columnMapping,
        // Only persist config and predict input (not File objects)
        lastRunType: state.lastRunType,
        lastRunInput: state.lastRunType === 'predict' ? state.lastRunInput : null,  // Don't persist File
        lastRunConfig: state.lastRunConfig,
      }),
      storage: {
        getItem: (name) => {
          try { return localStorage.getItem(name); } catch { return null; }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (e: any) {
            if (e?.name === 'QuotaExceededError') {
              // Drop per-residue curves to fit within 5MB localStorage limit
              try {
                const parsed = JSON.parse(value);
                if (parsed?.state?.peptides) {
                  parsed.state.peptides = parsed.state.peptides.map((p: any) => {
                    const { tango, s4predCurve, ...rest } = p;
                    return rest;
                  });
                  localStorage.setItem(name, JSON.stringify(parsed));
                }
              } catch {
                // Last resort: clear persisted data rather than silently losing updates
                localStorage.removeItem(name);
              }
            }
          }
        },
        removeItem: (name) => {
          try { localStorage.removeItem(name); } catch {}
        },
      },
    }
  )
);

