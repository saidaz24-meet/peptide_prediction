/**
 * Amino acid reference data for PVL.
 *
 * Canonical map of the 20 standard amino acids with single-letter codes,
 * three-letter codes, full names, and biochemical categories. Used by
 * ResidueHover and any component that needs residue-level metadata.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AminoAcidCategory = "hydrophobic" | "charged+" | "charged-" | "polar" | "special";

export interface AminoAcidInfo {
  letter: string;
  threeLetterCode: string;
  fullName: string;
  category: AminoAcidCategory;
}

// ---------------------------------------------------------------------------
// Map — all 20 standard amino acids
// ---------------------------------------------------------------------------

export const AA_MAP: Record<string, AminoAcidInfo> = {
  A: { letter: "A", threeLetterCode: "Ala", fullName: "Alanine", category: "hydrophobic" },
  R: { letter: "R", threeLetterCode: "Arg", fullName: "Arginine", category: "charged+" },
  N: { letter: "N", threeLetterCode: "Asn", fullName: "Asparagine", category: "polar" },
  D: { letter: "D", threeLetterCode: "Asp", fullName: "Aspartic acid", category: "charged-" },
  C: { letter: "C", threeLetterCode: "Cys", fullName: "Cysteine", category: "special" },
  E: { letter: "E", threeLetterCode: "Glu", fullName: "Glutamic acid", category: "charged-" },
  Q: { letter: "Q", threeLetterCode: "Gln", fullName: "Glutamine", category: "polar" },
  G: { letter: "G", threeLetterCode: "Gly", fullName: "Glycine", category: "special" },
  H: { letter: "H", threeLetterCode: "His", fullName: "Histidine", category: "charged+" },
  I: { letter: "I", threeLetterCode: "Ile", fullName: "Isoleucine", category: "hydrophobic" },
  L: { letter: "L", threeLetterCode: "Leu", fullName: "Leucine", category: "hydrophobic" },
  K: { letter: "K", threeLetterCode: "Lys", fullName: "Lysine", category: "charged+" },
  M: { letter: "M", threeLetterCode: "Met", fullName: "Methionine", category: "hydrophobic" },
  F: { letter: "F", threeLetterCode: "Phe", fullName: "Phenylalanine", category: "hydrophobic" },
  P: { letter: "P", threeLetterCode: "Pro", fullName: "Proline", category: "special" },
  S: { letter: "S", threeLetterCode: "Ser", fullName: "Serine", category: "polar" },
  T: { letter: "T", threeLetterCode: "Thr", fullName: "Threonine", category: "polar" },
  W: { letter: "W", threeLetterCode: "Trp", fullName: "Tryptophan", category: "hydrophobic" },
  Y: { letter: "Y", threeLetterCode: "Tyr", fullName: "Tyrosine", category: "polar" },
  V: { letter: "V", threeLetterCode: "Val", fullName: "Valine", category: "hydrophobic" },
};

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

/** Get amino acid info by single-letter code, or undefined for non-standard residues. */
export function getResidueInfo(aa: string): AminoAcidInfo | undefined {
  return AA_MAP[aa.toUpperCase()];
}

/** Human-readable category label. */
export function categoryLabel(cat: AminoAcidCategory): string {
  switch (cat) {
    case "hydrophobic":
      return "Hydrophobic";
    case "charged+":
      return "Charged (+)";
    case "charged-":
      return "Charged (-)";
    case "polar":
      return "Polar";
    case "special":
      return "Special";
  }
}

// ---------------------------------------------------------------------------
// Category color map — used by ResidueCategoryLegend (FIX-010, 2026-05-07)
// to render a small chip row alongside the sequence display. The palette
// matches the BackboneViewer side-chain coloring (acidic = red, basic = blue,
// polar = green, hydrophobic = neutral, special = yellow/purple) collapsed
// to the 5-category model used by aminoAcids.ts.
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<AminoAcidCategory, string> = {
  hydrophobic: "#94a3b8", // slate-400 — neutral / non-polar
  "charged+": "#3b82f6", // blue-500
  "charged-": "#ef4444", // red-500
  polar: "#22c55e", // green-500
  special: "#a855f7", // purple-500
};

/** Members of each category, ordered alphabetically. */
export const CATEGORY_MEMBERS: Record<AminoAcidCategory, string[]> = (() => {
  const out: Record<AminoAcidCategory, string[]> = {
    hydrophobic: [],
    "charged+": [],
    "charged-": [],
    polar: [],
    special: [],
  };
  for (const info of Object.values(AA_MAP)) {
    out[info.category].push(info.letter);
  }
  for (const k of Object.keys(out) as AminoAcidCategory[]) {
    out[k].sort();
  }
  return out;
})();
