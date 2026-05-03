/**
 * Tests for the Figure Pack SVG generation pipeline.
 */
import { describe, it, expect } from "vitest";
import { generateCoverPage, generateFigurePack } from "../figurePack";
import { generateClassificationTableSVG } from "../figurePackPanels/classificationTable";
import { generateRadarOverlaySVG } from "../figurePackPanels/radarOverlay";
import { generateMethodsSVG } from "../figurePackPanels/methodsText";
import { generateAggregationProfileSVG } from "../figurePackPanels/aggregationProfile";
import type { Peptide, DatasetStats } from "@/types/peptide";
import { DEFAULT_THRESHOLDS } from "@/lib/thresholds";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: "AKLWFFAQLGK",
    length: 11,
    hydrophobicity: 0.42,
    muH: 0.35,
    charge: 2.0,
    sswPrediction: 1,
    s4predHelixPercent: 55,
    ffHelixPercent: 40,
    ffHelixFlag: 1,
    ffSswFlag: -1,
    tangoAggMax: 12.5,
    ...overrides,
  } as Peptide;
}

const MOCK_STATS: DatasetStats = {
  totalPeptides: 100,
  sswPositivePercent: 30,
  meanHydrophobicity: 0.45,
  meanCharge: 1.5,
  meanMuH: 0.38,
  meanFFHelixPercent: 35,
  meanLength: 15,
  meanS4predHelixPercent: 42,
};

const peptideA = makePeptide({ id: "PEP_001" });
const peptideB = makePeptide({
  id: "PEP_002",
  sequence: "DDDEEEKKKRRR",
  length: 12,
  hydrophobicity: -0.3,
  charge: 4.0,
  sswPrediction: -1,
  ffHelixFlag: -1,
  ffSswFlag: -1,
  s4predHelixPercent: 10,
});

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

describe("generateCoverPage", () => {
  it("produces valid SVG string", () => {
    const svg = generateCoverPage({
      peptides: [peptideA],
      allPeptides: [peptideA, peptideB],
      thresholds: DEFAULT_THRESHOLDS,
      stats: MOCK_STATS,
    });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("xmlns=");
    expect(svg).toContain("</svg>");
  });

  it("includes custom title when provided", () => {
    const svg = generateCoverPage({
      peptides: [peptideA],
      allPeptides: [peptideA],
      thresholds: DEFAULT_THRESHOLDS,
      stats: MOCK_STATS,
      title: "My Custom Title",
    });
    expect(svg).toContain("My Custom Title");
  });
});

// ---------------------------------------------------------------------------
// Panel A — Classification Table
// ---------------------------------------------------------------------------

describe("generateClassificationTableSVG", () => {
  it("produces valid SVG", () => {
    const svg = generateClassificationTableSVG([peptideA, peptideB]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
  });

  it("includes all peptide IDs", () => {
    const svg = generateClassificationTableSVG([peptideA, peptideB]);
    expect(svg).toContain("PEP_001");
    expect(svg).toContain("PEP_002");
  });

  it("renders check and cross marks for flags", () => {
    const svg = generateClassificationTableSVG([peptideA]);
    // ffHelixFlag = 1 should produce a checkmark
    expect(svg).toContain("✓");
  });

  it("handles empty array without crashing", () => {
    const svg = generateClassificationTableSVG([]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
  });
});

// ---------------------------------------------------------------------------
// Panel B — Radar Overlay
// ---------------------------------------------------------------------------

describe("generateRadarOverlaySVG", () => {
  it("produces valid SVG", () => {
    const svg = generateRadarOverlaySVG([peptideA], MOCK_STATS);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
  });

  it("includes legend with peptide IDs", () => {
    const svg = generateRadarOverlaySVG([peptideA, peptideB], MOCK_STATS);
    expect(svg).toContain("PEP_001");
    expect(svg).toContain("PEP_002");
  });

  it("includes database mean legend entry", () => {
    const svg = generateRadarOverlaySVG([peptideA], MOCK_STATS);
    expect(svg).toContain("Database mean");
  });

  it("handles empty array without crashing", () => {
    const svg = generateRadarOverlaySVG([], MOCK_STATS);
    expect(svg).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// Panel C — Aggregation Profile
// ---------------------------------------------------------------------------

describe("generateAggregationProfileSVG", () => {
  it("shows placeholder when no TANGO data", () => {
    const svg = generateAggregationProfileSVG([peptideA]);
    expect(svg).toContain("TANGO per-residue data not available");
  });

  it("renders profile when TANGO data present", () => {
    const withTango = makePeptide({
      id: "PEP_TANGO",
      tango: { agg: [0, 5, 15, 8, 2, 0] },
    });
    const svg = generateAggregationProfileSVG([withTango]);
    expect(svg).not.toContain("TANGO per-residue data not available");
    expect(svg).toContain("<path");
  });
});

// ---------------------------------------------------------------------------
// Panel D — Methods Text
// ---------------------------------------------------------------------------

describe("generateMethodsSVG", () => {
  it("produces valid SVG", () => {
    const svg = generateMethodsSVG(DEFAULT_THRESHOLDS, 50);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
  });

  it("includes threshold values", () => {
    const svg = generateMethodsSVG(DEFAULT_THRESHOLDS, 50);
    // muHCutoff default is 0.5
    expect(svg).toContain("0.5");
    // aggThreshold default is 5
    expect(svg).toContain("5");
  });

  it("includes peptide count", () => {
    const svg = generateMethodsSVG(DEFAULT_THRESHOLDS, 42);
    expect(svg).toContain("42");
  });

  it("includes PVL citation", () => {
    const svg = generateMethodsSVG(DEFAULT_THRESHOLDS, 1);
    expect(svg).toContain("pvl.example");
  });
});

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

describe("generateFigurePack", () => {
  it("returns 4 panels", async () => {
    const panels = await generateFigurePack({
      peptides: [peptideA],
      allPeptides: [peptideA, peptideB],
      thresholds: DEFAULT_THRESHOLDS,
      stats: MOCK_STATS,
    });
    expect(panels).toHaveLength(4);
    expect(panels[0].label).toBe("Panel A");
    expect(panels[1].label).toBe("Panel B");
    expect(panels[2].label).toBe("Panel C");
    expect(panels[3].label).toBe("Panel D");
  });

  it("all panels produce valid SVG", async () => {
    const panels = await generateFigurePack({
      peptides: [peptideA, peptideB],
      allPeptides: [peptideA, peptideB],
      thresholds: DEFAULT_THRESHOLDS,
      stats: MOCK_STATS,
    });
    for (const panel of panels) {
      expect(panel.svg).toMatch(/^<svg/);
      expect(panel.svg).toContain("</svg>");
    }
  });

  it("handles empty peptides array without crashing", async () => {
    const panels = await generateFigurePack({
      peptides: [],
      allPeptides: [peptideA],
      thresholds: DEFAULT_THRESHOLDS,
      stats: MOCK_STATS,
    });
    expect(panels).toHaveLength(4);
    for (const panel of panels) {
      expect(panel.svg).toMatch(/^<svg/);
    }
  });
});
