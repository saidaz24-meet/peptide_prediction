import { describe, it, expect } from "vitest";
import {
  extractTangoOverlay,
  extractS4predHelixOverlay,
  extractFFHelixOverlay,
  extractSSWOverlay,
  buildDefaultOverlays,
  toMolstarRanges,
  OVERLAY_COLORS,
  OVERLAY_TOGGLES,
} from "../molstarOverlays";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePeptide(overrides?: Partial<Peptide>): Peptide {
  return {
    id: "P12345",
    sequence: "AKLVFFAEDVGSNK",
    length: 14,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  } as Peptide;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("molstarOverlays", () => {
  describe("constants", () => {
    it("has 4 overlay colors", () => {
      expect(Object.keys(OVERLAY_COLORS)).toHaveLength(4);
    });

    it("has 4 overlay toggles with required fields", () => {
      expect(OVERLAY_TOGGLES).toHaveLength(4);
      for (const toggle of OVERLAY_TOGGLES) {
        expect(toggle.type).toBeTruthy();
        expect(toggle.label).toBeTruthy();
        expect(toggle.color).toBeTruthy();
        expect(toggle.description).toBeTruthy();
      }
    });
  });

  describe("extractTangoOverlay", () => {
    it("returns null when no tango data", () => {
      expect(extractTangoOverlay(makePeptide())).toBeNull();
    });

    it("returns null when all scores below threshold", () => {
      const p = makePeptide({ tango: { agg: [0, 1, 2, 3, 4] } });
      expect(extractTangoOverlay(p, 5)).toBeNull();
    });

    it("extracts contiguous peak ranges", () => {
      const p = makePeptide({
        tango: { agg: [0, 0, 10, 15, 20, 0, 0, 8, 0] },
      });
      const overlay = extractTangoOverlay(p, 5);
      expect(overlay).not.toBeNull();
      expect(overlay!.type).toBe("tango");
      expect(overlay!.ranges).toEqual([
        [2, 5], // residues 2,3,4
        [7, 8], // residue 7
      ]);
      expect(overlay!.color).toBe(OVERLAY_COLORS.tango);
    });

    it("handles peak at end of sequence", () => {
      const p = makePeptide({ tango: { agg: [0, 0, 10, 15] } });
      const overlay = extractTangoOverlay(p, 5);
      expect(overlay!.ranges).toEqual([[2, 4]]);
    });

    it("respects custom threshold", () => {
      const p = makePeptide({ tango: { agg: [3, 8, 12, 2] } });
      expect(extractTangoOverlay(p, 10)!.ranges).toEqual([[2, 3]]);
      expect(extractTangoOverlay(p, 5)!.ranges).toEqual([[1, 3]]);
    });
  });

  describe("extractS4predHelixOverlay", () => {
    it("returns null when no s4pred data", () => {
      expect(extractS4predHelixOverlay(makePeptide())).toBeNull();
    });

    it("returns null when no helix segments", () => {
      const p = makePeptide({ s4pred: { helixSegments: [] } });
      expect(extractS4predHelixOverlay(p)).toBeNull();
    });

    it("extracts helix segments", () => {
      const p = makePeptide({
        s4pred: {
          helixSegments: [
            [2, 8],
            [10, 14],
          ],
        },
      });
      const overlay = extractS4predHelixOverlay(p);
      expect(overlay).not.toBeNull();
      expect(overlay!.type).toBe("s4pred-helix");
      expect(overlay!.ranges).toEqual([
        [2, 8],
        [10, 14],
      ]);
    });
  });

  describe("extractFFHelixOverlay", () => {
    it("returns null when ffHelixFlag is not 1", () => {
      const p = makePeptide({ ffHelixFlag: -1 });
      expect(extractFFHelixOverlay(p)).toBeNull();
    });

    it("returns null when ffHelixFlag is null", () => {
      expect(extractFFHelixOverlay(makePeptide())).toBeNull();
    });

    it("extracts from ffHelixFragments when available", () => {
      const p = makePeptide({
        ffHelixFlag: 1,
        ffHelixFragments: [
          [3, 10],
          [12, 14],
        ],
      });
      const overlay = extractFFHelixOverlay(p);
      expect(overlay).not.toBeNull();
      expect(overlay!.type).toBe("ff-helix");
      expect(overlay!.ranges).toEqual([
        [3, 10],
        [12, 14],
      ]);
    });

    it("falls back to s4pred helixSegments", () => {
      const p = makePeptide({
        ffHelixFlag: 1,
        s4pred: { helixSegments: [[0, 5]] },
      });
      const overlay = extractFFHelixOverlay(p);
      expect(overlay!.ranges).toEqual([[0, 5]]);
    });
  });

  describe("extractSSWOverlay", () => {
    it("returns null when no beta segments", () => {
      expect(extractSSWOverlay(makePeptide())).toBeNull();
    });

    it("extracts SSW zones from beta segments", () => {
      const p = makePeptide({
        s4pred: { betaSegments: [[5, 9]] },
      });
      const overlay = extractSSWOverlay(p);
      expect(overlay).not.toBeNull();
      expect(overlay!.type).toBe("ssw");
      expect(overlay!.ranges).toEqual([[5, 9]]);
    });

    // 2026-06-07 — SSW-source fix. When the peptide carries the dedicated
    // s4predSswFragments column (Peleg's gap-smoothed `SSW fragments (S4PRED)`),
    // it MUST win over raw S4PRED beta segments. The columns describe different
    // things — SSW fragments are the canonical switch-zone answer.
    it("prefers s4predSswFragments over raw betaSegments", () => {
      const p = makePeptide({
        s4predSswFragments: [[2, 6]],
        s4pred: { betaSegments: [[10, 14]] },
      });
      const overlay = extractSSWOverlay(p);
      expect(overlay).not.toBeNull();
      expect(overlay!.ranges).toEqual([[2, 6]]);
    });

    it("falls back to betaSegments when s4predSswFragments is empty", () => {
      const p = makePeptide({
        s4predSswFragments: [],
        s4pred: { betaSegments: [[10, 14]] },
      });
      const overlay = extractSSWOverlay(p);
      expect(overlay).not.toBeNull();
      expect(overlay!.ranges).toEqual([[10, 14]]);
    });
  });

  describe("buildDefaultOverlays", () => {
    it("returns empty array for peptide with no prediction data", () => {
      expect(buildDefaultOverlays(makePeptide())).toEqual([]);
    });

    it("includes only overlays that have data", () => {
      const p = makePeptide({
        tango: { agg: [0, 0, 10, 15, 0] },
        s4pred: { helixSegments: [[0, 4]] },
      });
      const overlays = buildDefaultOverlays(p);
      expect(overlays).toHaveLength(2);
      expect(overlays.map((o) => o.type)).toContain("tango");
      expect(overlays.map((o) => o.type)).toContain("s4pred-helix");
    });

    it("includes all 4 overlay types when data is available", () => {
      const p = makePeptide({
        tango: { agg: [0, 10, 0] },
        s4pred: {
          helixSegments: [[0, 3]],
          betaSegments: [[5, 8]],
        },
        ffHelixFlag: 1,
        ffHelixFragments: [[0, 3]],
      });
      const overlays = buildDefaultOverlays(p);
      expect(overlays).toHaveLength(4);
      const types = overlays.map((o) => o.type);
      expect(types).toContain("tango");
      expect(types).toContain("s4pred-helix");
      expect(types).toContain("ff-helix");
      expect(types).toContain("ssw");
    });
  });

  describe("toMolstarRanges", () => {
    it("converts 0-indexed to 1-indexed ranges", () => {
      expect(toMolstarRanges([[0, 5]])).toEqual([[1, 5]]);
      expect(
        toMolstarRanges([
          [3, 10],
          [12, 14],
        ])
      ).toEqual([
        [4, 10],
        [13, 14],
      ]);
    });

    it("handles empty array", () => {
      expect(toMolstarRanges([])).toEqual([]);
    });
  });
});
