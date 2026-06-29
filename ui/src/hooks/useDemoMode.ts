/**
 * useDemoMode — Auto-loads a demo dataset on first visit.
 *
 * On app boot:
 * 1. Check `localStorage.pvl-demo-acknowledged`. If set → skip.
 * 2. Check if datasetStore already has peptides → skip.
 * 3. Fetch the Staphylococcus 2023 dataset:
 *    a. Try `/demo-dataset.json` (pre-processed, instant load).
 *    b. Fallback: fetch `/Final_Staphylococcus_2023_new.xlsx` → upload to backend.
 * 4. Ingest into datasetStore with `isDemo: true` metadata flag.
 * 5. Set `pvl-demo-acknowledged` in localStorage.
 *
 * The hook also exposes:
 * - `isDemo` — true if the current dataset was auto-loaded by demo mode.
 * - `isDemoLoading` — true while the demo dataset is loading.
 * - `demoError` — error message if loading failed.
 * - `clearDemo()` — clears demo data and sets a flag so it won't reload.
 * - `showFirstVisit` — true if the user has never visited before.
 * - `dismissFirstVisit()` — hides the first-visit modal.
 * - `dismissChip()` — hides the demo chip (persists).
 * - `isChipDismissed` — true if the user closed the demo chip.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useDatasetStore } from "@/stores/datasetStore";
import { useDemoStore } from "@/stores/demoStore";
import { uploadCSV, loadPrecomputedDataset } from "@/lib/api";
import type { DatasetMetadata } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEY_ACKNOWLEDGED = "pvl-demo-acknowledged";
const LS_KEY_FIRST_VISIT = "pvl-first-visit-dismissed";
const LS_KEY_CHIP_DISMISSED = "pvl-demo-chip-dismissed";

const DEMO_JSON_URL = "/demo-dataset.json";
const DEMO_XLSX_URL = "/Final_Staphylococcus_2023_new.xlsx";

/** Dataset info shown in the chip and first-visit modal */
export const DEMO_DATASET_INFO = {
  name: "Staphylococcus 2023",
  peptideCount: 2916,
  source: "Staphylococcus aureus proteome — 2,916 peptide fragments",
  description:
    "Pre-analyzed dataset from Staphylococcus aureus with TANGO aggregation, S4PRED secondary structure, and FF-Helix predictions.",
} as const;

// ---------------------------------------------------------------------------
// Storage helpers (safe for SSR / test environments)
// ---------------------------------------------------------------------------

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DemoModeState {
  isDemo: boolean;
  isDemoLoading: boolean;
  demoError: string | null;
  showFirstVisit: boolean;
  isChipDismissed: boolean;
  clearDemo: () => void;
  dismissFirstVisit: () => void;
  dismissChip: () => void;
}

export function useDemoMode(): DemoModeState {
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  const [isChipDismissed, setIsChipDismissed] = useState(
    () => lsGet(LS_KEY_CHIP_DISMISSED) === "true"
  );
  const didAttempt = useRef(false);

  const { peptides, meta, ingestBackendRows, resetData } = useDatasetStore();
  const isDemo = meta?.isDemo === true;

  // ── First-visit detection (independent of demo load) ─────────────────
  useEffect(() => {
    const wasHereBefore = lsGet(LS_KEY_FIRST_VISIT) === "true";
    if (!wasHereBefore) {
      setShowFirstVisit(true);
    }
  }, []);

  // ── Auto-load on first mount ────────────────────────────────────────
  useEffect(() => {
    if (didAttempt.current) return;
    didAttempt.current = true;

    // Already acknowledged demo OR already has data → skip
    if (lsGet(LS_KEY_ACKNOWLEDGED) === "true" && peptides.length > 0) return;
    if (peptides.length > 0) return;

    void loadDemoDataset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load strategy: JSON first, XLSX fallback ────────────────────────
  async function loadDemoDataset() {
    setIsDemoLoading(true);
    useDemoStore.getState().setDemoLoading(true);
    setDemoError(null);

    const demoMeta: Partial<DatasetMetadata> = {
      isDemo: true,
      source: "uniprot_api" as const,
      query: "Staphylococcus aureus 2023 (demo)",
    };

    try {
      // Strategy A: try the /api/precomputed/gold_standard endpoint first
      // (instant — served by backend from a pre-baked JSON artifact). Falls
      // through silently on 404 so hosts without the precompute file still
      // get the slower XLSX path. Hosts get the file by running:
      //   docker compose exec backend python scripts/precompute_dataset.py gold_standard
      const precomp = await loadPrecomputedDataset("gold_standard");
      if (precomp && Array.isArray(precomp.rows) && precomp.rows.length > 0) {
        ingestBackendRows(precomp.rows, {
          ...precomp.meta,
          ...demoMeta,
        } as DatasetMetadata);
        lsSet(LS_KEY_ACKNOWLEDGED, "true");
        setIsDemoLoading(false);
        useDemoStore.getState().setDemoLoading(false);
        return;
      }
    } catch {
      // precompute endpoint unavailable — fall through
    }

    try {
      // Strategy A2 (legacy): try the static /demo-dataset.json. Kept for
      // hosts that ship a baked JSON next to the index.html — predates the
      // /api/precomputed route.
      const jsonRes = await fetch(DEMO_JSON_URL);
      if (jsonRes.ok) {
        const data = await jsonRes.json();
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          ingestBackendRows(data.rows, {
            ...data.meta,
            ...demoMeta,
          } as DatasetMetadata);
          lsSet(LS_KEY_ACKNOWLEDGED, "true");
          setIsDemoLoading(false);
          useDemoStore.getState().setDemoLoading(false);
          return;
        }
      }
    } catch {
      // JSON not available — fall through to XLSX approach
    }

    try {
      // Strategy B: fetch XLSX → upload to backend for processing
      const xlsxRes = await fetch(DEMO_XLSX_URL);
      if (!xlsxRes.ok) {
        throw new Error(`Failed to fetch demo dataset: ${xlsxRes.status}`);
      }
      const blob = await xlsxRes.blob();
      const file = new File([blob], "Final_Staphylococcus_2023_new.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const { rows, meta: responseMeta } = (await uploadCSV(file)) as any;
      ingestBackendRows(rows, {
        ...responseMeta,
        ...demoMeta,
      } as DatasetMetadata);
      lsSet(LS_KEY_ACKNOWLEDGED, "true");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load demo dataset";
      setDemoError(message);
      console.warn("[useDemoMode] Demo dataset load failed:", message);
    } finally {
      setIsDemoLoading(false);
      useDemoStore.getState().setDemoLoading(false);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────

  const clearDemo = useCallback(() => {
    resetData();
    lsSet(LS_KEY_ACKNOWLEDGED, "true");
    lsSet(LS_KEY_CHIP_DISMISSED, "true");
    setIsChipDismissed(true);
  }, [resetData]);

  const dismissFirstVisit = useCallback(() => {
    setShowFirstVisit(false);
    lsSet(LS_KEY_FIRST_VISIT, "true");
  }, []);

  const dismissChip = useCallback(() => {
    setIsChipDismissed(true);
    lsSet(LS_KEY_CHIP_DISMISSED, "true");
  }, []);

  return {
    isDemo,
    isDemoLoading,
    demoError,
    showFirstVisit,
    isChipDismissed,
    clearDemo,
    dismissFirstVisit,
    dismissChip,
  };
}
