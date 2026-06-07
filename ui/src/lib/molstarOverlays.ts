/**
 * molstarOverlays.ts — Translate PVL prediction data into Mol* overlay descriptors.
 *
 * Overlay contract (forward-compatible for Phase I multi-predictor):
 * ────────────────────────────────────────────────────────────────────
 * Each overlay describes a set of residue ranges to color on the 3D structure.
 * The Mol3DViewer component consumes these descriptors and applies them using
 * Mol*'s representation API (overpaint + transparency).
 *
 * Residue numbering: 0-indexed internally (matching PVL convention).
 * Mol* uses 1-indexed auth_seq_id, so +1 is applied at render time.
 *
 * Adding a new predictor overlay:
 *   1. Add a new OverlayType literal to the union.
 *   2. Add an extract function (e.g., extractMyPredictorOverlay).
 *   3. Add it to buildDefaultOverlays().
 *   4. Add a toggle entry in Mol3DViewer's OVERLAY_TOGGLES.
 */

import type { Peptide, SegmentTuple, Segment } from "@/types/peptide";

// ── Types ──────────────────────────────────────────────────────────────────

export type OverlayType = "tango" | "s4pred-helix" | "ff-helix" | "ssw";

export interface StructureOverlay {
  /** Overlay type identifier */
  type: OverlayType;
  /** Human-readable label */
  label: string;
  /** Residue ranges [start, end) — 0-indexed */
  ranges: [number, number][];
  /** CSS color string (hex or hsl) */
  color: string;
  /** Opacity for the overlay fill (0-1) */
  opacity: number;
}

/** Toggle descriptor for the viewer UI */
export interface OverlayToggle {
  type: OverlayType;
  label: string;
  color: string;
  description: string;
}

// ── Default overlay colors (from PVL theme tokens) ─────────────────────────

export const OVERLAY_COLORS: Record<OverlayType, string> = {
  tango: "#ef4444", // red-500 — TANGO aggregation peaks
  "s4pred-helix": "#a855f7", // purple-500 — S4PRED helix segments
  "ff-helix": "#22c55e", // green-500 — FF-Helix candidate regions
  ssw: "#f59e0b", // amber-500 — SSW switch zones
};

export const OVERLAY_TOGGLES: OverlayToggle[] = [
  {
    type: "tango",
    label: "TANGO aggregation peaks",
    color: OVERLAY_COLORS.tango,
    description: "Residues with aggregation propensity above threshold",
  },
  {
    type: "s4pred-helix",
    label: "S4PRED helix segments",
    color: OVERLAY_COLORS["s4pred-helix"],
    description: "Detected alpha-helix runs from S4PRED",
  },
  {
    type: "ff-helix",
    label: "FF-Helix candidate regions",
    color: OVERLAY_COLORS["ff-helix"],
    description: "Regions passing fibril-forming helix biochemical criteria",
  },
  {
    type: "ssw",
    label: "SSW switch zones",
    color: OVERLAY_COLORS.ssw,
    description: "Secondary structure switch zones (helix↔beta transition)",
  },
];

// ── Segment normalization ──────────────────────────────────────────────────

/** Normalize PVL's mixed segment types into [start, end) tuples */
function normalizeSegments(
  segments: Array<SegmentTuple> | Segment[] | null | undefined
): [number, number][] {
  if (!segments || segments.length === 0) return [];
  return segments.map((s) => {
    if (Array.isArray(s)) return s as [number, number];
    return [s.start, s.end] as [number, number];
  });
}

// ── Extract overlays from peptide data ─────────────────────────────────────

/**
 * Extract TANGO aggregation peak ranges.
 * A "peak" is a contiguous run of residues where agg score > threshold.
 */
export function extractTangoOverlay(peptide: Peptide, aggThreshold = 5.0): StructureOverlay | null {
  const agg = peptide.tango?.agg;
  if (!agg || agg.length === 0) return null;

  const ranges: [number, number][] = [];
  let start: number | null = null;

  for (let i = 0; i < agg.length; i++) {
    if (agg[i] > aggThreshold) {
      if (start === null) start = i;
    } else {
      if (start !== null) {
        ranges.push([start, i]);
        start = null;
      }
    }
  }
  if (start !== null) ranges.push([start, agg.length]);

  if (ranges.length === 0) return null;

  return {
    type: "tango",
    label: "TANGO aggregation peaks",
    ranges,
    color: OVERLAY_COLORS.tango,
    opacity: 0.85,
  };
}

/**
 * Extract S4PRED helix segment ranges.
 */
export function extractS4predHelixOverlay(peptide: Peptide): StructureOverlay | null {
  const segments = peptide.s4pred?.helixSegments;
  const ranges = normalizeSegments(segments);
  if (ranges.length === 0) return null;

  return {
    type: "s4pred-helix",
    label: "S4PRED helix segments",
    ranges,
    color: OVERLAY_COLORS["s4pred-helix"],
    opacity: 0.75,
  };
}

/**
 * Extract FF-Helix candidate region ranges.
 */
export function extractFFHelixOverlay(peptide: Peptide): StructureOverlay | null {
  // FF-Helix is flagged at peptide level; use helix fragments if ffHelixFlag === 1
  if (peptide.ffHelixFlag !== 1) return null;

  const segments = peptide.ffHelixFragments ?? peptide.s4pred?.helixSegments;
  const ranges = normalizeSegments(segments);
  if (ranges.length === 0) return null;

  return {
    type: "ff-helix",
    label: "FF-Helix candidate regions",
    ranges,
    color: OVERLAY_COLORS["ff-helix"],
    opacity: 0.8,
  };
}

/**
 * Extract SSW switch zone ranges.
 *
 * Source priority (2026-06-07): the dedicated `SSW fragments (S4PRED)` column
 * (gap-smoothed by Peleg's `get_secondary_structure_segments`) wins over the
 * raw S4PRED beta segments — they describe different things, and the SSW
 * column is the canonical "where is this peptide a switch zone" answer.
 */
export function extractSSWOverlay(peptide: Peptide): StructureOverlay | null {
  // `??` alone would lock us to s4predSswFragments when it's an empty array
  // (which is null-shaped semantically but truthy to ??). Treat empty as missing.
  const sswPrimary = peptide.s4predSswFragments;
  const segments =
    sswPrimary && sswPrimary.length > 0 ? sswPrimary : peptide.s4pred?.betaSegments;
  const ranges = normalizeSegments(segments);
  if (ranges.length === 0) return null;

  return {
    type: "ssw",
    label: "SSW switch zones",
    ranges,
    color: OVERLAY_COLORS.ssw,
    opacity: 0.7,
  };
}

// ── Build all overlays for a peptide ───────────────────────────────────────

/**
 * Build the default set of overlays for a given peptide.
 * Returns only overlays that have data (no empty ranges).
 */
export function buildDefaultOverlays(peptide: Peptide, aggThreshold = 5.0): StructureOverlay[] {
  return [
    extractTangoOverlay(peptide, aggThreshold),
    extractS4predHelixOverlay(peptide),
    extractFFHelixOverlay(peptide),
    extractSSWOverlay(peptide),
  ].filter((o): o is StructureOverlay => o !== null);
}

/**
 * Convert 0-indexed PVL ranges to 1-indexed Mol* auth_seq_id ranges.
 * Mol* uses 1-based residue numbering for PDB/mmCIF structures.
 */
export function toMolstarRanges(ranges: [number, number][]): [number, number][] {
  return ranges.map(([s, e]) => [s + 1, e]);
  // Note: [start, end) in PVL → [start+1, end] in Mol* (inclusive on both ends)
  // The Mol* selection helper handles the exact semantics.
}
