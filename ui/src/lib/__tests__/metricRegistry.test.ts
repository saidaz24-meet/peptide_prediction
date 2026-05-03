/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { METRIC_REGISTRY, getMetric } from "../metricRegistry";
import type { Peptide } from "@/types/peptide";

// Minimal peptide factory
function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: "AAAAAA",
    length: 6,
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

// ---- Required fields ----

describe("METRIC_REGISTRY completeness", () => {
  const entries = Object.values(METRIC_REGISTRY);

  it("has at least 10 entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(10);
  });

  it.each(entries.map((e) => [e.id, e]))(
    "%s has required fields (name, definition, getValue, format)",
    (_id, entry) => {
      expect(typeof entry.name).toBe("string");
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.definition).toBe("string");
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(typeof entry.getValue).toBe("function");
      expect(typeof entry.format).toBe("function");
    }
  );
});

// ---- getMetric ----

describe("getMetric", () => {
  it("returns a registry entry for known IDs", () => {
    const entry = getMetric("hydrophobicity");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("Hydrophobicity");
  });

  it("returns undefined for unknown IDs", () => {
    expect(getMetric("nonexistent-metric")).toBeUndefined();
    expect(getMetric("")).toBeUndefined();
  });
});

// ---- Format functions ----

describe("format functions", () => {
  it("hydrophobicity formats to 2 decimal places", () => {
    expect(getMetric("hydrophobicity")!.format(0.417)).toBe("0.42");
  });

  it("muH formats to 3 decimal places", () => {
    expect(getMetric("muH")!.format(0.3884)).toBe("0.388");
  });

  it("charge formats with sign", () => {
    expect(getMetric("charge")!.format(2.5)).toBe("+2.50");
    expect(getMetric("charge")!.format(-1.3)).toBe("-1.30");
  });

  it("length formats as integer", () => {
    expect(getMetric("length")!.format(6)).toBe("6");
    expect(getMetric("length")!.format(6.7)).toBe("7");
  });

  it("s4predHelixPercent formats with % suffix", () => {
    expect(getMetric("s4predHelixPercent")!.format(55.123)).toBe("55.1%");
  });

  it("ffHelixFlag formats binary labels", () => {
    const fmt = getMetric("ffHelixFlag")!.format;
    expect(fmt(1)).toBe("Candidate");
    expect(fmt(-1)).toBe("Non-candidate");
  });

  it("sswPrediction formats ternary labels", () => {
    const fmt = getMetric("sswPrediction")!.format;
    expect(fmt(1)).toBe("Positive");
    expect(fmt(-1)).toBe("Negative");
    expect(fmt(0)).toBe("Uncertain");
  });

  it("tangoAggregation formats to 1 decimal", () => {
    expect(getMetric("tangoAggregation")!.format(12.56)).toBe("12.6");
  });
});

// ---- getValue extraction ----

describe("getValue extraction", () => {
  const pep = makePeptide({ id: "TEST-1" });

  it("hydrophobicity extracts correctly", () => {
    expect(getMetric("hydrophobicity")!.getValue(pep)).toBe(0.42);
  });

  it("muH extracts correctly", () => {
    expect(getMetric("muH")!.getValue(pep)).toBe(0.35);
  });

  it("charge extracts correctly", () => {
    expect(getMetric("charge")!.getValue(pep)).toBe(2.0);
  });

  it("length extracts correctly", () => {
    expect(getMetric("length")!.getValue(pep)).toBe(6);
  });

  it("s4predHelixPercent extracts correctly", () => {
    expect(getMetric("s4predHelixPercent")!.getValue(pep)).toBe(55);
  });

  it("ffHelixPercent extracts correctly", () => {
    expect(getMetric("ffHelixPercent")!.getValue(pep)).toBe(40);
  });

  it("ffHelixFlag extracts correctly", () => {
    expect(getMetric("ffHelixFlag")!.getValue(pep)).toBe(1);
  });

  it("sswPrediction extracts correctly", () => {
    expect(getMetric("sswPrediction")!.getValue(pep)).toBe(1);
  });

  it("ffSswFlag extracts correctly", () => {
    expect(getMetric("ffSswFlag")!.getValue(pep)).toBe(-1);
  });

  it("tangoAggregation extracts tangoAggMax", () => {
    expect(getMetric("tangoAggregation")!.getValue(pep)).toBe(12.5);
  });

  it("returns null for missing optional fields", () => {
    const sparse = makePeptide({ id: "SPARSE", muH: null, s4predHelixPercent: null });
    expect(getMetric("muH")!.getValue(sparse)).toBeNull();
    expect(getMetric("s4predHelixPercent")!.getValue(sparse)).toBeNull();
  });
});
