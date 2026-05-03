/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BiochemComparison,
  DEFAULT_PVL_METRICS,
  type BiochemMetric,
} from "../BiochemComparison";
import type { Peptide, DatasetStats } from "@/types/peptide";

// Minimal peptide factory
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: "AAAAAA",
    length: 6,
    hydrophobicity: 0.5,
    muH: 0.3,
    charge: 1.0,
    s4predHelixPercent: 60,
    classification: "ff-helix",
    ffHelixFlag: 1,
    sswPrediction: 0,
    ffSswFlag: 0,
    tangoAggregation: null,
    ...overrides,
  } as Peptide;
}

const PEPTIDES = [
  makePeptide({ id: "P1", hydrophobicity: 0.2, muH: 0.1, charge: -1, s4predHelixPercent: 20 }),
  makePeptide({ id: "P2", hydrophobicity: 0.5, muH: 0.3, charge: 0, s4predHelixPercent: 50 }),
  makePeptide({ id: "P3", hydrophobicity: 0.8, muH: 0.6, charge: 2, s4predHelixPercent: 80 }),
  makePeptide({ id: "P4", hydrophobicity: 1.0, muH: 0.9, charge: 3, s4predHelixPercent: 95 }),
];

const STATS: DatasetStats = {
  totalPeptides: 4,
  meanHydrophobicity: 0.625,
  meanMuH: 0.475,
  meanCharge: 1.0,
  meanS4predHelixPercent: 61.25,
  ffHelixCandidatePercent: 50,
  sswPositivePercent: 0,
  ffSswCandidatePercent: 0,
  meanLength: 6,
} as DatasetStats;

// Mock ResizeObserver for any chart internals
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("BiochemComparison", () => {
  it("renders stat cards for each metric in stat-card or all mode", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[2]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    // Should show all 4 default metrics (hydrophobicity, muH, charge, s4predHelix)
    expect(container.textContent).toContain("Hydrophobicity");
    expect(container.textContent).toContain("Hydrophobic moment");
    expect(container.textContent).toContain("Charge");
    expect(container.textContent).toContain("S4PRED helix");
  });

  it("shows database mean values", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[2]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    expect(container.textContent).toContain("Database mean");
  });

  it("uses 'database' terminology, never 'cohort'", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[0]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    expect(container.textContent).not.toContain("cohort");
    expect(container.textContent).not.toContain("Cohort");
    expect(container.textContent).toContain("database");
  });

  it("renders percentile bars for metrics with displayMode 'all' or 'percentile'", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[3]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    // Percentile ranking section should exist
    expect(container.textContent).toContain("Percentile ranking");
  });

  it("shows dataset-relative percentile note (Peleg FIX-016)", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[0]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    expect(container.textContent).toContain("percentiles are relative to this dataset only");
  });

  it("renders radar chart when ≥3 radar-mode metrics", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[1]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    // 3 metrics have displayMode "all" → radar should render
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(container.textContent).toContain("Radar comparison");
  });

  it("handles single metric gracefully (no radar, no crash)", () => {
    const singleMetric: BiochemMetric[] = [
      {
        id: "test",
        label: "Test metric",
        unit: "",
        displayMode: "stat-card",
        getValue: (p) => p.hydrophobicity,
        getMean: (s) => s.meanHydrophobicity,
      },
    ];
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[0]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={singleMetric}
      />
    );
    expect(container.textContent).toContain("Test metric");
    // No radar (only 1 metric)
    expect(container.textContent).not.toContain("Radar comparison");
  });

  it("handles null stats gracefully", () => {
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[0]}
        allPeptides={PEPTIDES}
        stats={null}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    // Should still render without crashing
    expect(container.textContent).toContain("Hydrophobicity");
    // No database mean shown
    expect(container.textContent).not.toContain("Database mean");
  });

  it("uses green for 'Above median' badge (Peleg FIX-016)", () => {
    // P3 has hydrophobicity 0.8 — above median of the 4 values
    const { container } = render(
      <BiochemComparison
        peptide={PEPTIDES[2]}
        allPeptides={PEPTIDES}
        stats={STATS}
        metrics={DEFAULT_PVL_METRICS}
      />
    );
    const aboveMedianBadges = Array.from(container.querySelectorAll("span")).filter(
      (el) => el.textContent === "Above median"
    );
    expect(aboveMedianBadges.length).toBeGreaterThan(0);
    // Should use green color class, not gold/brown
    for (const badge of aboveMedianBadges) {
      expect(badge.className).toContain("green");
    }
  });

  // Wave Q.1: single-peptide mode (Quick Analyze) — no database to compare against.
  describe("single-peptide mode (Wave Q.1)", () => {
    it("auto-detects single-peptide via allPeptides.length < 2", () => {
      const single = PEPTIDES[0];
      const { container } = render(
        <BiochemComparison
          peptide={single}
          allPeptides={[single]}
          stats={null}
          metrics={DEFAULT_PVL_METRICS}
        />
      );

      // Stat cards still render values
      expect(container.textContent).toContain("Hydrophobicity");
      expect(container.textContent).toContain("Hydrophobic moment");

      // Radar + percentile bars are replaced with the empty-state message
      expect(container.textContent).toContain(
        "Compare with a database — upload a CSV or run a UniProt query."
      );

      // The "Percentile ranking" / "Radar comparison" headings must NOT render
      expect(container.textContent).not.toContain("Percentile ranking");
      expect(container.textContent).not.toContain("Radar comparison");

      // The "Above median" / "Top 10%" percentile bands must NOT render
      // (a single-sample percentile is meaningless).
      expect(container.textContent).not.toContain("Above median");
      expect(container.textContent).not.toContain("Top 10%");
    });

    it("explicit mode='single-peptide' overrides allPeptides count", () => {
      const { container } = render(
        <BiochemComparison
          peptide={PEPTIDES[0]}
          allPeptides={PEPTIDES}
          stats={STATS}
          metrics={DEFAULT_PVL_METRICS}
          mode="single-peptide"
        />
      );
      expect(container.textContent).toContain(
        "Compare with a database — upload a CSV or run a UniProt query."
      );
    });

    it("explicit mode='full' overrides single-peptide auto-detect", () => {
      // Even with a single peptide, mode="full" forces percentile bars to render.
      const single = PEPTIDES[0];
      const { container } = render(
        <BiochemComparison
          peptide={single}
          allPeptides={[single]}
          stats={STATS}
          metrics={DEFAULT_PVL_METRICS}
          mode="full"
        />
      );
      expect(container.textContent).toContain("Percentile ranking");
      expect(container.textContent).not.toContain(
        "Compare with a database — upload a CSV or run a UniProt query."
      );
    });
  });
});
