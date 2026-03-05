/**
 * Chart selection state for cross-filtering / linked views.
 *
 * Tracks the currently selected peptide from chart interactions,
 * preview sheet visibility, histogram bin selection, and active tab.
 * Not persisted — resets on page reload (intentional: selection is transient).
 */

import { create } from "zustand";

export interface BinSelection {
  ids: string[];
  binLabel: string;
  source: string;
}

export interface TableFilter {
  label: string;
  field: string;
  value: number;
}

interface ChartSelectionState {
  /** Currently selected peptide ID from chart click (null = none) */
  selectedId: string | null;
  /** Source of selection (for breadcrumb navigation) */
  selectedFrom: string | null;
  /** Controls PeptidePreviewSheet visibility */
  sheetOpen: boolean;
  /** Histogram bin click context */
  binSelection: BinSelection | null;
  /** Preserves active Results tab for navigation return */
  activeTab: string;
  /** KPI-driven table filter */
  tableFilter: TableFilter | null;

  /** Set selected peptide (from chart click) — also opens sheet */
  select: (id: string, source: string) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Control sheet visibility */
  setSheetOpen: (open: boolean) => void;
  /** Select a histogram bin */
  selectBin: (bin: BinSelection) => void;
  /** Clear histogram bin selection */
  clearBinSelection: () => void;
  /** Set active Results tab */
  setActiveTab: (tab: string) => void;
  /** Set table filter from KPI click */
  setTableFilter: (filter: TableFilter | null) => void;
}

export const useChartSelection = create<ChartSelectionState>((set) => ({
  selectedId: null,
  selectedFrom: null,
  sheetOpen: false,
  binSelection: null,
  activeTab: "data",
  tableFilter: null,

  select: (id, source) => set({ selectedId: id, selectedFrom: source, sheetOpen: true }),
  clearSelection: () => set({ selectedId: null, selectedFrom: null, sheetOpen: false }),
  setSheetOpen: (open) =>
    set(open ? { sheetOpen: true } : { sheetOpen: false, selectedId: null, selectedFrom: null }),
  selectBin: (bin) => set({ binSelection: bin }),
  clearBinSelection: () => set({ binSelection: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTableFilter: (filter) => set({ tableFilter: filter }),
}));
