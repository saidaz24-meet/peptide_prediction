/**
 * Per-residue secondary-structure classification driven by Peleg's gap-smoothed
 * fragment columns (`Helix fragments (S4PRED)`, `SSW fragments (S4PRED)`,
 * S4PRED beta segments).
 *
 * Shared by every UI surface that colours residues by secondary structure —
 * SequenceTrack, Mol3DViewer overlays, ResidueHover segment flags,
 * WindowProfileChart bands. Centralising the rule guarantees the four surfaces
 * disagree-by-construction less.
 *
 * The black-G regression (2026-06-07): residue colour used to derive from raw
 * per-residue S4PRED argmax (`ssPrediction[idx]`), which calls a residue "coil"
 * whenever its three-class probability ties barely favour coil — even when that
 * residue sits INSIDE a helix run that Peleg's `get_secondary_structure_segments`
 * algorithm correctly identifies as one continuous helix fragment (MAX_GAP=3
 * smoothing). Symptom on Said's screenshot: a black G in the middle of a clear
 * helix run on the peptide detail page.
 *
 * Fix: fragment ranges win. Per-residue argmax is only consulted for residues
 * outside every known fragment range.
 */

export type SSClass = "H" | "E" | "C";

/** A fragment range expressed as [start, end] inclusive, 1-indexed. */
export type FragmentRange = [number, number];

/** Anything fragment-shaped in the wild: tuple or {start,end} object. */
type FragmentInput = FragmentRange | { start: number; end: number } | null | undefined;

function readRange(r: FragmentInput): [number, number] | null {
  if (!r) return null;
  if (Array.isArray(r)) return [r[0], r[1]];
  return [r.start, r.end];
}

/**
 * Build a residue-index → class lookup from fragment columns. Returns an array
 * of length `len`; entries are `null` for residues outside every fragment.
 *
 * Precedence is intentional:
 *   1. Helix fragments (most specific, gap-smoothed).
 *   2. SSW fragments (helix-beta indecision zones — coloured helix here, since
 *      the lab framing treats them as helix-dominant; DualStructureTrack shows
 *      them in their own SSW row separately).
 *   3. Beta fragments fill in the rest.
 */
export function buildFragmentClassification(
  len: number,
  helixFragments?: Array<FragmentInput> | null,
  betaFragments?: Array<FragmentInput> | null,
  sswFragments?: Array<FragmentInput> | null
): (SSClass | null)[] {
  const lookup: (SSClass | null)[] = new Array(len).fill(null);

  if (helixFragments) {
    for (const raw of helixFragments) {
      const range = readRange(raw);
      if (!range) continue;
      const [start, end] = range;
      for (let i = start - 1; i < end && i < len; i++) {
        if (i >= 0) lookup[i] = "H";
      }
    }
  }

  if (sswFragments) {
    for (const raw of sswFragments) {
      const range = readRange(raw);
      if (!range) continue;
      const [start, end] = range;
      for (let i = start - 1; i < end && i < len; i++) {
        if (i >= 0 && lookup[i] === null) lookup[i] = "H";
      }
    }
  }

  if (betaFragments) {
    for (const raw of betaFragments) {
      const range = readRange(raw);
      if (!range) continue;
      const [start, end] = range;
      for (let i = start - 1; i < end && i < len; i++) {
        if (i >= 0 && lookup[i] === null) lookup[i] = "E";
      }
    }
  }

  return lookup;
}

/**
 * Resolve a single residue's class. Fragment lookup wins; per-residue argmax
 * and ssPrediction strings are fallbacks for residues outside every fragment.
 */
export function classifyResidue(
  idx: number,
  fragmentLookup: (SSClass | null)[] | null,
  ssPrediction?: string[],
  pH?: number[],
  pE?: number[],
  pC?: number[]
): SSClass {
  if (fragmentLookup && fragmentLookup[idx] !== null && fragmentLookup[idx] !== undefined) {
    return fragmentLookup[idx] as SSClass;
  }
  if (ssPrediction && ssPrediction[idx]) {
    const p = ssPrediction[idx].toUpperCase();
    if (p === "H") return "H";
    if (p === "E") return "E";
    return "C";
  }
  if (pH && pE && pC && pH[idx] != null && pE[idx] != null && pC[idx] != null) {
    const h = pH[idx];
    const e = pE[idx];
    const c = pC[idx];
    if (h >= e && h >= c) return "H";
    if (e >= h && e >= c) return "E";
    return "C";
  }
  return "C";
}

/**
 * Is `position` (0-indexed) covered by any of the supplied fragments?
 *
 * Accepts the same input shapes as `buildFragmentClassification`. Use this for
 * SSW-zone / helix-segment yes/no checks (e.g., ResidueHover) instead of
 * hand-rolling tuple iteration — the inputs from the API mix tuple and object
 * shapes and a homegrown check usually only handles one of them.
 *
 * IMPORTANT: input ranges are treated as 1-indexed inclusive [start, end], so
 * position 0 maps to residue 1.
 */
export function isPositionInFragments(
  position: number,
  fragments: Array<FragmentInput> | null | undefined
): boolean {
  if (!fragments || fragments.length === 0) return false;
  const residue = position + 1;
  for (const raw of fragments) {
    const range = readRange(raw);
    if (!range) continue;
    const [start, end] = range;
    if (residue >= start && residue <= end) return true;
  }
  return false;
}
