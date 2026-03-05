/**
 * Tests for peptideMapper.ts — the single source of truth
 * for backend API → UI Peptide model conversion.
 *
 * Critical bugs prevented by these tests:
 * - 0 treated as falsy (|| vs ??)
 * - null sentinel confusion (-1 vs null)
 * - Numeric string coercion
 */
import { describe, it, expect } from "vitest";
import { mapApiRowToPeptide } from "../peptideMapper";

// Minimal valid row for tests
const minRow = (overrides: Record<string, any> = {}) => ({
  id: "P12345",
  sequence: "ACDEFGHIKLMNPQRSTVWY",
  length: 20,
  hydrophobicity: 1.23,
  charge: -1.0,
  muH: 0.45,
  sswPrediction: null,
  ffHelixPercent: null,
  ...overrides,
});

describe("mapApiRowToPeptide", () => {
  // ---------- Identity ----------
  it("maps id and sequence", () => {
    const p = mapApiRowToPeptide(minRow());
    expect(p.id).toBe("P12345");
    expect(p.sequence).toBe("ACDEFGHIKLMNPQRSTVWY");
    expect(p.length).toBe(20);
  });

  it("throws on missing id", () => {
    expect(() => mapApiRowToPeptide({ sequence: "AAA" })).toThrow(/missing required keys/i);
  });

  // ---------- Numeric null preservation ----------
  it("preserves null for missing biophysics", () => {
    const p = mapApiRowToPeptide(minRow({ hydrophobicity: null, charge: null }));
    expect(p.hydrophobicity).toBeNull();
    expect(p.charge).toBeNull();
  });

  it("preserves 0 as a valid number (not null)", () => {
    const p = mapApiRowToPeptide(minRow({ hydrophobicity: 0, charge: 0, muH: 0, ffHelixPercent: 0 }));
    expect(p.hydrophobicity).toBe(0);
    expect(p.charge).toBe(0);
    expect(p.muH).toBe(0);
    expect(p.ffHelixPercent).toBe(0);
  });

  it("preserves -1.0 as valid charge", () => {
    const p = mapApiRowToPeptide(minRow({ charge: -1.0 }));
    expect(p.charge).toBe(-1.0);
  });

  // ---------- SSW Prediction (critical sentinel handling) ----------
  it("maps sswPrediction: 1 = positive", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: 1 }));
    expect(p.sswPrediction).toBe(1);
  });

  it("maps sswPrediction: -1 = negative (valid prediction)", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: -1 }));
    expect(p.sswPrediction).toBe(-1);
  });

  it("maps sswPrediction: 0 = uncertain (valid)", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: 0 }));
    expect(p.sswPrediction).toBe(0);
  });

  it("maps sswPrediction: null = no prediction available", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: null }));
    expect(p.sswPrediction).toBeNull();
  });

  it("maps sswPrediction: undefined → null", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: undefined }));
    expect(p.sswPrediction).toBeNull();
  });

  it("rejects invalid sswPrediction values", () => {
    const p = mapApiRowToPeptide(minRow({ sswPrediction: 2 }));
    expect(p.sswPrediction).toBeNull();
  });

  // ---------- FF-Helix ----------
  it("maps ffHelixPercent: 0 is valid (not falsy)", () => {
    const p = mapApiRowToPeptide(minRow({ ffHelixPercent: 0 }));
    expect(p.ffHelixPercent).toBe(0);
  });

  it("maps ffHelixPercent: 100 is valid", () => {
    const p = mapApiRowToPeptide(minRow({ ffHelixPercent: 100 }));
    expect(p.ffHelixPercent).toBe(100);
  });

  it("maps ffHelixPercent: null → undefined (optional field, ?? falls through)", () => {
    // When backend sends null, the ?? chain treats it as nullish and
    // falls through to legacy keys (all undefined). The num() helper
    // then returns undefined for the optional field. Both null and
    // undefined mean "no data" for optional Peptide fields.
    const p = mapApiRowToPeptide(minRow({ ffHelixPercent: null }));
    expect(p.ffHelixPercent).toBeUndefined();
  });

  // ---------- String coercion ----------
  it("coerces numeric strings to numbers", () => {
    const p = mapApiRowToPeptide(minRow({ hydrophobicity: "1.5", charge: "-2.0" }));
    expect(p.hydrophobicity).toBe(1.5);
    expect(p.charge).toBe(-2.0);
  });

  // ---------- Tango curves ----------
  it("maps tango curves when present", () => {
    const agg = [0, 0.5, 1.0, 0.3];
    const p = mapApiRowToPeptide(minRow({ tangoAggCurve: agg }));
    expect(p.tango?.agg).toEqual(agg);
    expect(p.tangoHasData).toBe(true);
  });

  it("tangoHasData is false when no curves", () => {
    const p = mapApiRowToPeptide(minRow());
    expect(p.tangoHasData).toBe(false);
  });

  // ---------- S4PRED ----------
  it("maps s4pred curves", () => {
    const pH = [0.1, 0.8, 0.9];
    const p = mapApiRowToPeptide(minRow({ s4predPHCurve: pH }));
    expect(p.s4pred?.pH).toEqual(pH);
    expect(p.s4predHasData).toBe(true);
  });

  it("maps s4predHelixPercent: 0 is valid for short peptides", () => {
    const p = mapApiRowToPeptide(minRow({ s4predHelixPercent: 0 }));
    expect(p.s4predHelixPercent).toBe(0);
  });

  // ---------- Segment parsing ----------
  it("parses segments from arrays", () => {
    const p = mapApiRowToPeptide(minRow({ ffHelixFragments: [[1, 5], [10, 15]] }));
    expect(p.ffHelixFragments).toEqual([[1, 5], [10, 15]]);
  });

  it("parses segments from string format", () => {
    const p = mapApiRowToPeptide(minRow({ ffHelixFragments: "1-5;10-15" }));
    expect(p.ffHelixFragments).toEqual([[1, 5], [10, 15]]);
  });

  // ---------- Provider status passthrough ----------
  it("passes through providerStatus from backend", () => {
    const status = { tango: { status: "AVAILABLE" as const }, s4pred: { status: "OFF" as const } };
    const p = mapApiRowToPeptide(minRow({ providerStatus: status }));
    expect(p.providerStatus?.tango?.status).toBe("AVAILABLE");
    expect(p.providerStatus?.s4pred?.status).toBe("OFF");
  });
});
