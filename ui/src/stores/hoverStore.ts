/**
 * Cross-chart hover state for linked highlighting.
 *
 * When a user hovers over a peptide in any chart (SetDiagram, DistributionChart,
 * CorrelationMatrix, etc.), the hovered peptide ID and metric are broadcast here.
 * Other charts subscribe and highlight the same peptide, creating a linked-views
 * interaction pattern.
 *
 * Not persisted — resets on page reload (intentional: hover is transient).
 */

import { create } from "zustand";
import { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface HoverState {
  /** Currently hovered peptide ID (from any chart) */
  activePeptideId: string | null;
  /** Currently hovered metric ID (from any chart) */
  activeMetricId: string | null;
  /** Source component that triggered the hover */
  source: string | null;
  /** Set hover state */
  setHover: (opts: {
    peptideId?: string | null;
    metricId?: string | null;
    source?: string;
  }) => void;
  /** Clear hover state */
  clearHover: () => void;
}

export const useHoverStore = create<HoverState>((set) => ({
  activePeptideId: null,
  activeMetricId: null,
  source: null,

  setHover: ({ peptideId, metricId, source }) =>
    set({
      activePeptideId: peptideId ?? null,
      activeMetricId: metricId ?? null,
      source: source ?? null,
    }),

  clearHover: () =>
    set({ activePeptideId: null, activeMetricId: null, source: null }),
}));

// ---------------------------------------------------------------------------
// Debounced hook — prevents thrashing during rapid mouse movement
// ---------------------------------------------------------------------------

/**
 * Returns debounced `setHover` and `clearHover` callbacks.
 *
 * Usage:
 *   const { setHover, clearHover } = useDebouncedHover(50);
 *   <rect onMouseEnter={() => setHover({ peptideId: p.id, source: 'scatter' })}
 *         onMouseLeave={clearHover} />
 */
export function useDebouncedHover(delayMs = 50) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const store = useHoverStore;

  const setHover = useCallback(
    (opts: { peptideId?: string | null; metricId?: string | null; source?: string }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        store.getState().setHover(opts);
      }, delayMs);
    },
    [delayMs, store],
  );

  const clearHover = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      store.getState().clearHover();
    }, delayMs);
  }, [delayMs, store]);

  return { setHover, clearHover };
}
