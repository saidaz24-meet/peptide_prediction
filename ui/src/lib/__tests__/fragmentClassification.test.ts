/**
 * Locks the residue-colour-from-fragments rule for every UI surface that
 * consults it. The black-G regression (2026-06-07) lives or dies here.
 */
import { describe, it, expect } from "vitest";
import {
  buildFragmentClassification,
  classifyResidue,
  isPositionInFragments,
} from "../fragmentClassification";

describe("buildFragmentClassification", () => {
  it("returns all-null when no fragments are supplied", () => {
    const lookup = buildFragmentClassification(5, null, null, null);
    expect(lookup).toEqual([null, null, null, null, null]);
  });

  it("marks helix residues from a 1-indexed inclusive helix fragment", () => {
    // [1, 5] means residues 1..5 (0-indexed 0..4).
    const lookup = buildFragmentClassification(7, [[1, 5]], null, null);
    expect(lookup).toEqual(["H", "H", "H", "H", "H", null, null]);
  });

  it("colours SSW fragments as helix in the absence of explicit helix/beta", () => {
    const lookup = buildFragmentClassification(6, null, null, [[2, 4]]);
    expect(lookup).toEqual([null, "H", "H", "H", null, null]);
  });

  it("helix wins over SSW where they overlap", () => {
    const lookup = buildFragmentClassification(6, [[1, 3]], null, [[2, 5]]);
    expect(lookup.slice(0, 3)).toEqual(["H", "H", "H"]); // already H from helix
    expect(lookup[3]).toBe("H"); // SSW fills 4 (1-indexed)
    expect(lookup[4]).toBe("H"); // SSW fills 5
    expect(lookup[5]).toBeNull();
  });

  it("beta fragments fill residues that helix/SSW left null", () => {
    const lookup = buildFragmentClassification(6, [[1, 2]], [[3, 5]], null);
    expect(lookup).toEqual(["H", "H", "E", "E", "E", null]);
  });

  it("accepts {start,end} object shapes alongside tuples", () => {
    const lookup = buildFragmentClassification(
      4,
      [{ start: 1, end: 2 }, [3, 3]] as Array<[number, number] | { start: number; end: number }>,
      null,
      null
    );
    expect(lookup).toEqual(["H", "H", "H", null]);
  });

  it("clamps fragments that overrun `len`", () => {
    const lookup = buildFragmentClassification(3, [[2, 10]], null, null);
    expect(lookup).toEqual([null, "H", "H"]);
  });
});

describe("classifyResidue", () => {
  it("returns C as the last resort when no signal is available", () => {
    expect(classifyResidue(0, null)).toBe("C");
  });

  it("fragment lookup wins over ssPrediction (black-G regression)", () => {
    const lookup = buildFragmentClassification(5, [[1, 5]], null, null);
    expect(classifyResidue(2, lookup, ["H", "H", "C", "H", "H"])).toBe("H");
  });

  it("falls back to ssPrediction when the residue is outside every fragment", () => {
    const lookup = buildFragmentClassification(5, [[1, 2]], null, null);
    expect(classifyResidue(3, lookup, ["H", "H", "C", "E", "E"])).toBe("E");
  });

  it("falls back to per-residue argmax when ssPrediction is absent", () => {
    expect(classifyResidue(0, null, undefined, [0.1], [0.7], [0.2])).toBe("E");
  });
});

describe("isPositionInFragments", () => {
  it("returns false when fragments are null/empty", () => {
    expect(isPositionInFragments(0, null)).toBe(false);
    expect(isPositionInFragments(0, undefined)).toBe(false);
    expect(isPositionInFragments(0, [])).toBe(false);
  });

  it("treats input fragments as 1-indexed inclusive [start, end]", () => {
    // Fragment [3, 5] = residues 3,4,5 (1-indexed) = positions 2,3,4 (0-indexed).
    const frags: [number, number][] = [[3, 5]];
    expect(isPositionInFragments(1, frags)).toBe(false); // residue 2
    expect(isPositionInFragments(2, frags)).toBe(true); // residue 3
    expect(isPositionInFragments(4, frags)).toBe(true); // residue 5
    expect(isPositionInFragments(5, frags)).toBe(false); // residue 6
  });

  it("accepts {start,end} object shapes", () => {
    expect(isPositionInFragments(0, [{ start: 1, end: 1 }])).toBe(true);
    expect(isPositionInFragments(1, [{ start: 1, end: 1 }])).toBe(false);
  });
});
