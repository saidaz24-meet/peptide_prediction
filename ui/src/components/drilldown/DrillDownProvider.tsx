/**
 * DrillDown context provider with URL synchronization.
 *
 * Design philosophy: any chart, KPI card, or metric hover can launch a
 * deep-inspection slide-over by calling `open()`. The URL is updated so
 * the drill state is shareable and survives page reloads. Mount once at
 * the app root level.
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrillDownState {
  isOpen: boolean;
  mode: "metric" | "chart" | "peptide" | null;
  metricId: string | null;
  peptideId: string | null;
}

export interface DrillDownContextValue {
  state: DrillDownState;
  open: (opts: {
    metric?: string;
    peptide?: string;
    mode: "metric" | "chart" | "peptide";
  }) => void;
  close: () => void;
}

// ---------------------------------------------------------------------------
// URL param keys
// ---------------------------------------------------------------------------

const PARAM_DRILL = "drill";
const PARAM_PEPTIDE = "drillPeptide";
const PARAM_MODE = "drillMode";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DrillDownContext = createContext<DrillDownContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DrillDownProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive state from URL search params (single source of truth)
  const state = useMemo<DrillDownState>(() => {
    const metricId = searchParams.get(PARAM_DRILL);
    const peptideId = searchParams.get(PARAM_PEPTIDE);
    const mode = searchParams.get(PARAM_MODE) as DrillDownState["mode"];

    const isOpen = !!(metricId || peptideId);
    return {
      isOpen,
      mode: isOpen ? (mode ?? "metric") : null,
      metricId: metricId ?? null,
      peptideId: peptideId ?? null,
    };
  }, [searchParams]);

  const open = useCallback(
    (opts: {
      metric?: string;
      peptide?: string;
      mode: "metric" | "chart" | "peptide";
    }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (opts.metric) {
            next.set(PARAM_DRILL, opts.metric);
          } else {
            next.delete(PARAM_DRILL);
          }
          if (opts.peptide) {
            next.set(PARAM_PEPTIDE, opts.peptide);
          } else {
            next.delete(PARAM_PEPTIDE);
          }
          next.set(PARAM_MODE, opts.mode);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const close = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PARAM_DRILL);
        next.delete(PARAM_PEPTIDE);
        next.delete(PARAM_MODE);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const value = useMemo<DrillDownContextValue>(
    () => ({ state, open, close }),
    [state, open, close],
  );

  return (
    <DrillDownContext.Provider value={value}>
      {children}
    </DrillDownContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDrillDown(): DrillDownContextValue {
  const ctx = useContext(DrillDownContext);
  if (!ctx) {
    throw new Error("useDrillDown must be used within a DrillDownProvider");
  }
  return ctx;
}
