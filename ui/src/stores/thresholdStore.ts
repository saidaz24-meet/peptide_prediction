/**
 * Threshold store for real-time client-side re-classification.
 *
 * Manages threshold presets and custom values for the Results page
 * ThresholdTuner component. When thresholds change, all dependent
 * computations (KPIs, shortlist, charts) auto-update via React reactivity.
 */
import { create } from "zustand";
import type { ResolvedThresholds } from "@/lib/thresholds";
import { DEFAULT_THRESHOLDS } from "@/lib/thresholds";

export type ThresholdPreset = "original" | "strict" | "exploratory" | "custom";

const PRESETS: Record<Exclude<ThresholdPreset, "original" | "custom">, ResolvedThresholds> = {
  strict: {
    muHCutoff: 0.35,
    hydroCutoff: 0.4,
    aggThreshold: 10.0,
    percentOfLengthCutoff: 15.0,
    minSswResidues: 5,
    sswMaxDifference: 0.0,
    minPredictionPercent: 60.0,
    minS4predHelixScore: 0.0,
  },
  exploratory: {
    muHCutoff: 0.0,
    hydroCutoff: 0.0,
    aggThreshold: 2.0,
    percentOfLengthCutoff: 30.0,
    minSswResidues: 2,
    sswMaxDifference: 0.0,
    minPredictionPercent: 40.0,
    minS4predHelixScore: 0.0,
  },
};

interface ThresholdState {
  /** Current preset selection */
  preset: ThresholdPreset;
  /** Currently active thresholds (used for classification) */
  active: ResolvedThresholds;
  /** Original thresholds from server meta.thresholds */
  original: ResolvedThresholds;
  /** Whether thresholds have been modified from server values */
  isModified: boolean;

  /** Initialize from server meta.thresholds */
  initFromMeta: (t: ResolvedThresholds) => void;
  /** Switch to a preset */
  setPreset: (p: ThresholdPreset) => void;
  /** Update a single threshold value (auto-sets preset to 'custom') */
  setThreshold: (key: keyof ResolvedThresholds, value: number) => void;
  /** Reset to original server values */
  resetToOriginal: () => void;
}

export const useThresholdStore = create<ThresholdState>((set, get) => ({
  preset: "original",
  active: { ...DEFAULT_THRESHOLDS },
  original: { ...DEFAULT_THRESHOLDS },
  isModified: false,

  initFromMeta: (t) => {
    // Merge with defaults so new fields have values even if server
    // hasn't been updated yet
    const merged = { ...DEFAULT_THRESHOLDS, ...t };
    set({
      original: { ...merged },
      active: { ...merged },
      preset: "original",
      isModified: false,
    });
  },

  setPreset: (p) => {
    const state = get();
    if (p === "original") {
      set({ preset: "original", active: { ...state.original }, isModified: false });
    } else if (p === "custom") {
      // Keep current active values, just switch label
      set({ preset: "custom", isModified: true });
    } else {
      set({ preset: p, active: { ...PRESETS[p] }, isModified: true });
    }
  },

  setThreshold: (key, value) => {
    const state = get();
    set({
      preset: "custom",
      active: { ...state.active, [key]: value },
      isModified: true,
    });
  },

  resetToOriginal: () => {
    const state = get();
    set({
      preset: "original",
      active: { ...state.original },
      isModified: false,
    });
  },
}));
