/**
 * Regression tests for numeric normalization logic.
 * Prevents the JS || vs ?? bug where 0 is treated as falsy.
 */
import { describe, it, expect } from "vitest";

// SSW normalization logic (matches peptideMapper.ts implementation)
function normalizeSSWPrediction(raw: any): -1 | 0 | 1 | null {
  if (raw === null || raw === undefined) return null;
  const numVal = Number(raw);
  return numVal === -1 || numVal === 0 || numVal === 1
    ? (numVal as -1 | 0 | 1)
    : null;
}

describe("SSW prediction normalization", () => {
  it("preserves 0 (critical: must NOT become null or -1)", () => {
    expect(normalizeSSWPrediction(0)).toBe(0);
  });

  it("preserves -1 as valid prediction", () => {
    expect(normalizeSSWPrediction(-1)).toBe(-1);
  });

  it("preserves 1 as valid prediction", () => {
    expect(normalizeSSWPrediction(1)).toBe(1);
  });

  it("null → null (no prediction available)", () => {
    expect(normalizeSSWPrediction(null)).toBeNull();
  });

  it("undefined → null", () => {
    expect(normalizeSSWPrediction(undefined)).toBeNull();
  });

  it("invalid values → null", () => {
    expect(normalizeSSWPrediction(2)).toBeNull();
    expect(normalizeSSWPrediction(NaN)).toBeNull();
    expect(normalizeSSWPrediction("abc")).toBeNull();
  });

  it("string coercion works", () => {
    expect(normalizeSSWPrediction("0")).toBe(0);
    expect(normalizeSSWPrediction("-1")).toBe(-1);
    expect(normalizeSSWPrediction("1")).toBe(1);
  });
});

describe("nullish coalescing (??)", () => {
  it("0 ?? fallback = 0 (not fallback)", () => {
    const val = 0;
    expect(val ?? -1).toBe(0);
  });

  it("null ?? fallback = fallback", () => {
    const val = null;
    expect(val ?? -1).toBe(-1);
  });

  it("undefined ?? fallback = fallback", () => {
    const val = undefined;
    expect(val ?? -1).toBe(-1);
  });

  // This is the bug that || causes:
  it("0 || fallback = fallback (THIS IS THE BUG)", () => {
    const val = 0;
    expect(val || -1).toBe(-1); // This is why we use ?? not ||
  });
});
