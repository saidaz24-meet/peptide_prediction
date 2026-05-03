/**
 * Tests for the amino acid reference map.
 */

import { describe, it, expect } from "vitest";
import { AA_MAP, getResidueInfo, categoryLabel } from "../aminoAcids";

// ---------------------------------------------------------------------------
// The 20 standard amino acid single-letter codes
// ---------------------------------------------------------------------------

const STANDARD_20 = [
  "A", "R", "N", "D", "C", "E", "Q", "G", "H", "I",
  "L", "K", "M", "F", "P", "S", "T", "W", "Y", "V",
];

describe("AA_MAP", () => {
  it("contains exactly 20 standard amino acids", () => {
    expect(Object.keys(AA_MAP)).toHaveLength(20);
  });

  it.each(STANDARD_20)("has entry for %s", (code) => {
    const info = AA_MAP[code];
    expect(info).toBeDefined();
    expect(info.letter).toBe(code);
    expect(info.threeLetterCode).toBeTruthy();
    expect(info.fullName).toBeTruthy();
    expect(["hydrophobic", "charged+", "charged-", "polar", "special"]).toContain(
      info.category,
    );
  });

  it("has unique three-letter codes", () => {
    const codes = Object.values(AA_MAP).map((v) => v.threeLetterCode);
    expect(new Set(codes).size).toBe(20);
  });
});

describe("getResidueInfo", () => {
  it("returns info for a standard amino acid", () => {
    const info = getResidueInfo("L");
    expect(info).toBeDefined();
    expect(info!.fullName).toBe("Leucine");
    expect(info!.threeLetterCode).toBe("Leu");
    expect(info!.category).toBe("hydrophobic");
  });

  it("is case-insensitive", () => {
    expect(getResidueInfo("a")).toEqual(getResidueInfo("A"));
  });

  it("returns undefined for non-standard residues", () => {
    expect(getResidueInfo("X")).toBeUndefined();
    expect(getResidueInfo("B")).toBeUndefined();
    expect(getResidueInfo("Z")).toBeUndefined();
    expect(getResidueInfo("U")).toBeUndefined(); // selenocysteine
  });
});

describe("categoryLabel", () => {
  it("returns human-readable labels", () => {
    expect(categoryLabel("hydrophobic")).toBe("Hydrophobic");
    expect(categoryLabel("charged+")).toBe("Charged (+)");
    expect(categoryLabel("charged-")).toBe("Charged (-)");
    expect(categoryLabel("polar")).toBe("Polar");
    expect(categoryLabel("special")).toBe("Special");
  });
});
