import { describe, it, expect } from "vitest";
import {
  getConsensusSS,
  dominantSsAtRegion,
  type ConsensusResult,
} from "../consensus";
import type { Peptide } from "@/types/peptide";

// ── Helper to build a minimal Peptide stub ──
function makePeptide(overrides: Partial<Peptide> = {}): Peptide {
  return {
    id: "test-1",
    sequence: "ACDEFGHIKLMNPQRSTVWY",
    length: 20,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────
// dominantSsAtRegion
// ──────────────────────────────────────────────────────────────────────

describe("dominantSsAtRegion", () => {
  it("returns H for all-helix region", () => {
    expect(dominantSsAtRegion(["H", "H", "H", "H", "H"], 0, 5)).toBe("H");
  });

  it("returns E for all-beta region", () => {
    expect(dominantSsAtRegion(["E", "E", "E"], 0, 3)).toBe("E");
  });

  it("returns C for empty/null input", () => {
    expect(dominantSsAtRegion(undefined, 0, 5)).toBe("C");
    expect(dominantSsAtRegion([], 0, 5)).toBe("C");
  });

  it("finds majority in mixed region", () => {
    // region [1:5] = H H E H → 3H, 1E → H
    expect(dominantSsAtRegion(["C", "H", "H", "E", "H", "C"], 1, 5)).toBe("H");
  });

  it("clamps out-of-bounds indices", () => {
    expect(dominantSsAtRegion(["H", "H"], 0, 100)).toBe("H");
  });
});

// ──────────────────────────────────────────────────────────────────────
// getConsensusSS – Tier assignment
// ──────────────────────────────────────────────────────────────────────

describe("getConsensusSS", () => {
  it("returns Tier 1 for high agg + helix at hotspot", () => {
    const p = makePeptide({
      tangoAggMax: 25.0,
      sswPrediction: 1,
      s4predSswPrediction: 1,
      s4predHelixPercent: 40.0,
      tango: { agg: [0, 0, 0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: {
        ssPrediction: ["C", "C", "C", "H", "H", "H", "C", "C", "C", "C",
                        "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"],
      },
    });
    const result = getConsensusSS(p);
    expect(result.tier).toBe(1);
    expect(result.label).toContain("Switch Zone");
  });

  it("returns Tier 2 for high agg + coil at hotspot", () => {
    const p = makePeptide({
      tangoAggMax: 15.0,
      sswPrediction: 1,
      tango: { agg: [0, 0, 0, 20, 25, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: {
        ssPrediction: ["C", "C", "C", "C", "C", "C", "C", "C", "C", "C",
                        "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"],
      },
    });
    const result = getConsensusSS(p);
    expect(result.tier).toBe(2);
    expect(result.label).toContain("Disordered");
  });

  it("returns Tier 3 for high agg + beta at hotspot", () => {
    const p = makePeptide({
      tangoAggMax: 15.0,
      tango: { agg: [0, 0, 0, 20, 25, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: {
        ssPrediction: ["C", "C", "C", "E", "E", "E", "C", "C", "C", "C",
                        "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"],
      },
    });
    const result = getConsensusSS(p);
    expect(result.tier).toBe(3);
    expect(result.label).toContain("Beta");
  });

  it("returns Tier 4 for low aggregation", () => {
    const p = makePeptide({
      tangoAggMax: 2.0,
      tango: { agg: [1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H",
                        "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"],
      },
    });
    const result = getConsensusSS(p);
    expect(result.tier).toBe(4);
    expect(result.label).toContain("No Aggregation");
  });

  it("returns Tier 5 when no TANGO data", () => {
    const p = makePeptide({ tangoAggMax: null });
    const result = getConsensusSS(p);
    expect(result.tier).toBe(5);
    expect(result.label).toContain("Insufficient");
    expect(result.certainty).toBe(0.0);
  });

  it("returns Tier 5 when tangoAggMax is undefined", () => {
    const p = makePeptide();
    // tangoAggMax not set → undefined → tier 5
    const result = getConsensusSS(p);
    expect(result.tier).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────────────
// getConsensusSS – Certainty modifiers
// ──────────────────────────────────────────────────────────────────────

describe("getConsensusSS – certainty", () => {
  it("boosts certainty when SSW predictors agree", () => {
    const p = makePeptide({
      tangoAggMax: 25.0,
      sswPrediction: 1,
      s4predSswPrediction: 1,
      tango: { agg: [0, 0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: { ssPrediction: ["C", "C", "H", "H", "H", "C", "C", "C", "C", "C",
                                "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"] },
    });
    const result = getConsensusSS(p);
    // Tier 1 base 0.9 + 0.1 agreement = 1.0
    expect(result.certainty).toBe(1.0);
  });

  it("reduces certainty when SSW predictors disagree", () => {
    const p = makePeptide({
      tangoAggMax: 25.0,
      sswPrediction: 1,
      s4predSswPrediction: -1,
      tango: { agg: [0, 0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: { ssPrediction: ["C", "C", "H", "H", "H", "C", "C", "C", "C", "C",
                                "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"] },
    });
    const result = getConsensusSS(p);
    expect(result.certainty).toBe(0.8);
  });

  it("caps certainty at 0.5 for short sequences", () => {
    const p = makePeptide({
      sequence: "ACDEFGHIKLMNPQ", // 14 aa
      length: 14,
      tangoAggMax: 25.0,
      sswPrediction: 1,
      s4predSswPrediction: 1,
      tango: { agg: [0, 30, 40, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: { ssPrediction: ["C", "H", "H", "H", "C", "C", "C", "C", "C", "C", "C", "C", "C", "C"] },
    });
    const result = getConsensusSS(p);
    expect(result.certainty).toBeLessThanOrEqual(0.5);
  });

  it("certainty is always between 0 and 1", () => {
    const p = makePeptide({
      tangoAggMax: 10.0,
      sswPrediction: 1,
      s4predSswPrediction: -1,
      length: 10,
      sequence: "ACDEFGHIKL",
      tango: { agg: [0, 20, 0, 0, 0, 0, 0, 0, 0, 0] },
      s4pred: { ssPrediction: ["E", "E", "E", "E", "E", "E", "E", "E", "E", "E"] },
    });
    const result = getConsensusSS(p);
    expect(result.certainty).toBeGreaterThanOrEqual(0.0);
    expect(result.certainty).toBeLessThanOrEqual(1.0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// getConsensusSS – Return shape
// ──────────────────────────────────────────────────────────────────────

describe("getConsensusSS – return shape", () => {
  it("has all required fields", () => {
    const p = makePeptide({ tangoAggMax: 10.0 });
    const result = getConsensusSS(p);
    expect(result).toHaveProperty("tier");
    expect(result).toHaveProperty("label");
    expect(result).toHaveProperty("certainty");
    expect(result).toHaveProperty("explanation");
    expect(result).toHaveProperty("color");
  });

  it("color is a valid tailwind class string", () => {
    const p = makePeptide({ tangoAggMax: 25.0 });
    const result = getConsensusSS(p);
    expect(typeof result.color).toBe("string");
    expect(result.color.length).toBeGreaterThan(0);
  });
});
