import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import type { ColumnMapping, DatasetStats, ParsedCSVData, DatasetMetadata } from "../types/peptide";

import { mapApiRowToPeptide } from "@/lib/peptideMapper";
import { uploadCSV, predictOne as apiPredictOne } from "@/lib/api";
import type { Peptide, ThresholdConfig } from "@/types/peptide";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { setPVLSentryContext } from "@/lib/sentryContext";
import { useThresholdStore } from "@/stores/thresholdStore";

// --- RANKING STORE v2 (proportional weights, direction toggles) ---
import {
  rankPeptides,
  redistributeWeights,
  DEFAULT_METRICS,
  OPTIONAL_METRICS,
  ALL_METRICS,
  PRESETS,
  DEFAULT_DIRECTIONS,
  type ProportionalWeights,
  type RankingMetric,
  type RankingPreset,
  type MetricDirections,
} from "@/lib/ranking";

interface RankingStoreState {
  activeMetrics: RankingMetric[];
  weights: ProportionalWeights;
  directions: MetricDirections;
  topN: number;
  preset: RankingPreset | "custom";
  toggleOptionalMetric: (metric: RankingMetric) => void;
  setWeights: (weights: ProportionalWeights) => void;
  setDirection: (metric: RankingMetric, dir: "high" | "low") => void;
  setTopN: (n: number) => void;
  applyPreset: (preset: RankingPreset) => void;
}

// 2026-06-07 (Peleg Zoom 2026-06-04): default ranking preset switched from
// "equal" to "amyloid" (UI label "Fibril-Formation Focus"). Peleg's point:
// fibril-formation is the core thing researchers come for. The Equal preset
// is still available as an alternative; users who want a balanced metric
// distribution can switch.
export const useRankingStore = create<RankingStoreState>((set, get) => ({
  activeMetrics: [...DEFAULT_METRICS],
  weights: { ...PRESETS.amyloid.weights },
  directions: { ...DEFAULT_DIRECTIONS },
  topN: 10,
  preset: "amyloid",

  toggleOptionalMetric: (metric) => {
    const state = get();
    const isActive = state.activeMetrics.includes(metric);
    let nextMetrics: RankingMetric[];
    if (isActive) {
      nextMetrics = state.activeMetrics.filter((m) => m !== metric);
    } else {
      nextMetrics = [...state.activeMetrics, metric];
    }
    // Redistribute weights proportionally across new active set
    const newWeights = redistributeWeights(state.weights, nextMetrics);
    set({ activeMetrics: nextMetrics, weights: newWeights, preset: "custom" });
  },

  setWeights: (weights) => set({ weights, preset: "custom" }),

  setDirection: (metric, dir) =>
    set((state) => ({
      directions: { ...state.directions, [metric]: dir },
      preset: "custom",
    })),

  setTopN: (n) => set({ topN: Math.max(1, n) }),

  applyPreset: (preset) => {
    const p = PRESETS[preset];
    const activeMetrics = ALL_METRICS.filter((m) => (p.weights[m] ?? 0) > 0);
    set({
      weights: { ...p.weights },
      directions: { ...p.directions },
      activeMetrics,
      preset,
    });
  },
}));

// Re-export ranking types and functions for convenience
export { rankPeptides, PRESETS, DEFAULT_METRICS, OPTIONAL_METRICS, ALL_METRICS };
export type { ProportionalWeights, RankingMetric, RankingPreset, MetricDirections };

// --- DEPRECATED: Legacy z-score exports (used by report.ts until migration) ---
/** @deprecated Use useRankingStore instead */
export const useThresholds = create<{
  wH: number;
  wCharge: number;
  wMuH: number;
  wFfHelix: number;
  wFfSsw: number;
  topN: number;
  setWeights: (
    partial: Partial<{
      wH: number;
      wCharge: number;
      wMuH: number;
      wFfHelix: number;
      wFfSsw: number;
      topN: number;
    }>
  ) => void;
}>((set) => ({
  wH: 1,
  wCharge: 1,
  wMuH: 1,
  wFfHelix: 1,
  wFfSsw: 1,
  topN: 10,
  setWeights: (partial) => set(partial),
}));

/** @deprecated Use rankPeptides() from ranking.ts instead */
export function scorePeptide(
  p: Peptide,
  w: { wH: number; wCharge: number; wMuH: number; wFfHelix: number; wFfSsw: number }
) {
  const h = Number(p.hydrophobicity ?? 0);
  const c = Math.abs(Number(p.charge ?? 0));
  const m = Number(p.muH ?? 0);
  const ffHelix = p.ffHelixFlag === 1 ? 1 : 0;
  const ffSsw = p.ffSswFlag === 1 ? 1 : 0;
  return w.wH * h + w.wCharge * c + w.wMuH * m + w.wFfHelix * ffHelix + w.wFfSsw * ffSsw;
}

type BackendRow = Record<string, any>;

// Run input types for reproduce
export type RunInput =
  | File // For uploadCSV
  | { sequence: string; entry?: string }; // For predictOne

interface DatasetState {
  rawData: ParsedCSVData | null;
  peptides: Peptide[];
  columnMapping: ColumnMapping;
  stats: DatasetStats | null;
  meta: DatasetMetadata | null;

  isLoading: boolean;
  error: string | null;

  // Reproduce run state (for stateless reproduction)
  lastRunType: "upload" | "predict" | null;
  lastRunInput: RunInput | null; // File or { sequence, entry }
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
  setLastRun: (type: "upload" | "predict", input: RunInput, config: ThresholdConfig | null) => void;
  getLastRun: () => {
    type: "upload" | "predict" | null;
    input: RunInput | null;
    config: ThresholdConfig | null;
  };
  setSourceFile: (file: File | null) => void;
  recalculate: (thresholds: ResolvedThresholds) => Promise<"server" | "client" | "none">;
}

const initialState: Omit<
  DatasetState,
  | "setRawData"
  | "setRawPreview"
  | "setPeptides"
  | "ingestBackendRows"
  | "setColumnMapping"
  | "setMetadata"
  | "calculateStats"
  | "setLoading"
  | "setError"
  | "resetData"
  | "getPeptideById"
  | "setLastRun"
  | "getLastRun"
  | "setSourceFile"
  | "recalculate"
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
              const source = "/api/ingestBackendRows";
              const mapped_pep = mapApiRowToPeptide(r, `${source}[${idx}]`);
              return mapped_pep;
            } catch (error) {
              console.warn(`[datasetStore] Failed to map row ${idx}:`, r, "Error:", error);
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

        // V6-1: enrich Sentry context with the active dataset.
        try {
          const providers: string[] = [];
          if (meta?.provider_status?.tango?.status === "AVAILABLE") providers.push("tango");
          if (meta?.provider_status?.s4pred?.status === "AVAILABLE") providers.push("s4pred");
          const dataSource: "demo" | "uniprot" | "csv" = meta?.isDemo
            ? "demo"
            : meta?.source === "uniprot_api"
              ? "uniprot"
              : "csv";
          setPVLSentryContext({
            peptideCount: mapped.length,
            dataSource,
            predictors: providers,
            thresholdPreset: useThresholdStore.getState().preset,
          });
        } catch {
          // Sentry context is non-critical; never block ingestion on it.
        }
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

        // Provider status — used downstream for `sswAvailable` and `tangoDataPeptides`.
        // Per ISSUE-032 canonical OR definition (SSW = TANGO ∪ S4PRED), `sswPrediction` and
        // `ffSswFlag` are valid whenever EITHER provider has data, so the KPI no longer
        // gates on TANGO availability alone. The valid-row filter below handles emptiness.
        const tangoStatus = meta?.provider_status?.tango?.status;
        const tangoUnavailable = tangoStatus === "OFF" || tangoStatus === "UNAVAILABLE";

        // Count SSW positives (prediction === 1) across all rows with a non-null unified
        // SSW value. Backend writes null when neither provider produced data for the row,
        // so the filter naturally returns 0 when both providers are off.
        const sswValidPeptides = peptides.filter((p) => {
          const sswVal = p.sswPrediction;
          if (sswVal === null || sswVal === undefined) {
            return false;
          }
          if (typeof sswVal === "number" && (isNaN(sswVal) || !isFinite(sswVal))) {
            return false;
          }
          return true;
        });
        const sswPositive = sswValidPeptides.filter((p) => {
          const sswVal = p.sswPrediction;
          return typeof sswVal === "number" && sswVal === 1;
        }).length;
        const sswPositivePercent =
          sswValidPeptides.length > 0 ? (sswPositive / sswValidPeptides.length) * 100 : null;

        // Helix positive — symmetric to sswPositive per Peleg's symmetry rule.
        // Counts peptides where S4PRED detected at least one helix segment
        // (s4predHelixPrediction === 1 in Peleg's main.py:219-220 framing).
        const helixValidPeptides = peptides.filter((p) => {
          const v = p.s4predHelixPrediction;
          if (v === null || v === undefined) return false;
          return typeof v === "number" && !isNaN(v) && isFinite(v);
        });
        const helixPositive = helixValidPeptides.filter(
          (p) => p.s4predHelixPrediction === 1
        ).length;
        const helixPositivePercent =
          helixValidPeptides.length > 0 ? (helixPositive / helixValidPeptides.length) * 100 : null;

        // Helper for means (returns null if no valid values)
        const mean = (arr: number[]): number | null => {
          if (arr.length === 0) return null;
          return arr.reduce((s, v) => s + v, 0) / arr.length;
        };

        // Basic biochemical stats (always computed, no provider dependency)
        const meanHydrophobicity =
          mean(
            peptides
              .map((p) => p.hydrophobicity)
              .filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
          ) ?? 0;
        const meanCharge =
          mean(
            peptides
              .map((p) => Math.abs(p.charge ?? 0))
              .filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
          ) ?? 0;
        const meanLength =
          mean(
            peptides
              .map((p) => p.length)
              .filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
          ) ?? 0;

        // μH stats
        const muHVals = peptides
          .map((p) => p.muH)
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        const meanMuH = muHVals.length > 0 ? (mean(muHVals) ?? null) : null;

        // FF-Helix stats (only count peptides where we have data)
        // FF-Helix is always computed (no provider dependency), but may be null/undefined
        const helixVals = peptides
          .map((p) => p.ffHelixPercent)
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        const meanFFHelixPercent = helixVals.length > 0 ? mean(helixVals) : null;

        // S4PRED Helix % stats
        const s4predHelixVals = peptides
          .map((p) => p.s4predHelixPercent)
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        const meanS4predHelixPercent = s4predHelixVals.length > 0 ? mean(s4predHelixVals) : null;

        // Count availability of different prediction types
        const s4predAvailable = peptides.filter((p) => {
          const st = p.providerStatus?.s4pred?.status?.toUpperCase();
          return st === "AVAILABLE" || st === "PARTIAL";
        }).length;
        const ffHelixAvailable = peptides.filter(
          (p) => typeof p.ffHelixPercent === "number" && !Number.isNaN(p.ffHelixPercent)
        ).length;
        // SSW available: count rows with valid TANGO metrics (sswPrediction !== null/undefined)
        // Only count if provider is not OFF/UNAVAILABLE
        const sswAvailable = tangoUnavailable
          ? 0
          : peptides.filter((p) => {
              const sswVal = p.sswPrediction;
              if (sswVal === null || sswVal === undefined) {
                return false;
              }
              // Also exclude NaN (shouldn't happen after backend fix, but defensive)
              if (typeof sswVal === "number" && (isNaN(sswVal) || !isFinite(sswVal))) {
                return false;
              }
              return true;
            }).length;

        // Aggregation hotspot count (tangoAggMax > aggThreshold)
        // Denominator: peptides WITH TANGO data (not all peptides)
        const aggThreshold = (meta?.thresholds as any)?.aggThreshold ?? 5.0;
        const tangoDataPeptides = !tangoUnavailable
          ? peptides.filter((p) => typeof p.tangoAggMax === "number")
          : [];
        const aggHotspots = tangoDataPeptides.filter(
          (p) => (p.tangoAggMax as number) > aggThreshold
        ).length;
        const aggHotspotPercent =
          tangoDataPeptides.length > 0 ? (aggHotspots / tangoDataPeptides.length) * 100 : null;

        // FF-Helix candidate count: ffHelixFlag === 1
        const ffHelixCandidates = peptides.filter((p) => p.ffHelixFlag === 1).length;
        const ffHelixCandidatePercent =
          totalPeptides > 0 ? (ffHelixCandidates / totalPeptides) * 100 : null;

        // FF-SSW candidate count: ffSswFlag === 1. After ISSUE-032 canonical OR definition,
        // FF-SSW can be S4PRED-only-derived, so the KPI is valid whenever totalPeptides > 0.
        const ffSswCandidates = peptides.filter((p) => p.ffSswFlag === 1).length;
        const ffSswCandidatePercent =
          totalPeptides > 0 ? (ffSswCandidates / totalPeptides) * 100 : null;

        const stats: DatasetStats = {
          totalPeptides,
          sswPositivePercent,
          helixPositivePercent,
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
          return sswVal !== null && sswVal !== undefined;
        });
        const tablePositives = tableValidPeptides.filter((p) => {
          const sswVal = p.sswPrediction;
          return typeof sswVal === "number" && sswVal === 1;
        }).length;
        const tablePositivePercent =
          tableValidPeptides.length > 0 ? (tablePositives / tableValidPeptides.length) * 100 : null;
        // Only check regression if both values are non-null
        if (
          sswPositivePercent !== null &&
          tablePositivePercent !== null &&
          Math.abs(tablePositivePercent - sswPositivePercent) > 0.1
        ) {
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
        try {
          localStorage.removeItem("peptide-dataset-storage");
        } catch {}
      },
      getPeptideById: (id) => get().peptides.find((p) => p.id === id),

      // Reproduce run state management
      setLastRun: (type, input, config) => {
        set({
          lastRunType: type,
          lastRunInput: input,
          lastRunConfig: config,
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
          mode: "custom",
          version: "1.0.0",
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
                } catch {
                  return null;
                }
              })
              .filter((p: Peptide | null): p is Peptide => p !== null);
            set({ peptides: mapped, meta: meta || null, lastRunConfig: thresholdConfig });
            get().calculateStats();
            return "server";
          } finally {
            set({ isLoading: false });
          }
        }

        // Case 2: Predict source (single sequence) → re-POST
        if (
          state.lastRunType === "predict" &&
          state.lastRunInput &&
          typeof state.lastRunInput === "object" &&
          "sequence" in state.lastRunInput
        ) {
          const input = state.lastRunInput as { sequence: string; entry?: string };
          set({ isLoading: true });
          try {
            const response = await apiPredictOne(input.sequence, input.entry, thresholdConfig);
            const peptide = mapApiRowToPeptide(response.row, "/api/recalculate");
            set({ peptides: [peptide], lastRunConfig: thresholdConfig });
            get().calculateStats();
            return "server";
          } finally {
            set({ isLoading: false });
          }
        }

        // Case 3: No source available → client-side only (aggFlags already applied via thresholdStore)
        return "none";
      },
    }),
    {
      name: "peptide-dataset-storage",
      version: 2, // Bump when persisted schema changes
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
        lastRunInput: state.lastRunType === "predict" ? state.lastRunInput : null, // Don't persist File
        lastRunConfig: state.lastRunConfig,
      }),
      storage: {
        getItem: (name): StorageValue<unknown> | null => {
          try {
            const str = localStorage.getItem(name);
            return str ? (JSON.parse(str) as StorageValue<unknown>) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          let serialized: string;
          try {
            serialized = JSON.stringify(value);
          } catch {
            return;
          }
          try {
            localStorage.setItem(name, serialized);
          } catch (e: unknown) {
            const isQuota = e instanceof DOMException && e.name === "QuotaExceededError";
            if (isQuota) {
              // Drop per-residue curves to fit within 5MB localStorage limit
              try {
                const state = (value.state ?? {}) as { peptides?: Record<string, unknown>[] };
                const stripped: StorageValue<unknown> = {
                  ...value,
                  state: {
                    ...state,
                    peptides: (state.peptides ?? []).map((p) => {
                      const { tango, s4predCurve, ...rest } = p;
                      void tango;
                      void s4predCurve;
                      return rest;
                    }),
                  },
                };
                localStorage.setItem(name, JSON.stringify(stripped));
              } catch {
                // Last resort: clear persisted data rather than silently losing updates
                localStorage.removeItem(name);
              }
            }
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {}
        },
      } satisfies PersistStorage<unknown>,
    }
  )
);
