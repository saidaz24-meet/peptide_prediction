/// <reference types="@testing-library/jest-dom" />
/**
 * Q7 (Peleg 2026-06-18 PDF1 p19, confirmed 2026-06-23):
 *
 * SequenceTrack colors residues by the PIPELINE-DERIVED 3-class scheme
 * (Helix · SSW · Coiled-coil), NOT the raw S4PRED H/E/C labels.
 *
 * Legend percentages come from counting the rendered pipeline classes —
 * they must match exactly what the user sees on screen. This intentionally
 * supersedes the pre-Q7 "legend from canonical s4predHelixPercent" rule
 * (HELIX_PERCENTAGE_AUDIT fix #3) because the legend now describes a
 * different classification than the raw S4PRED %.
 *
 * Class precedence: SSW > Helix > Coiled-coil.
 * SSW source priority: s4predSswFragments → s4pred.betaSegments.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SequenceTrack } from "../SequenceTrack";
import type { Peptide } from "@/types/peptide";

function makePeptide(overrides: Partial<Peptide> = {}): Peptide {
  return {
    id: "P_TEST",
    sequence: "AAAAAAAAAA",
    length: 10,
    hydrophobicity: 0.5,
    muH: 0.4,
    charge: 1,
    sswPrediction: null,
    s4predHelixPercent: null,
    betaPercent: null,
    s4pred: {
      ssPrediction: ["H", "H", "H", "H", "H", "C", "C", "C", "C", "C"],
    },
    ...overrides,
  } as Peptide;
}

describe("SequenceTrack — Q7 pipeline 3-class coloring", () => {
  it("legend labels are Helix · SSW · Coiled-coil (not Beta or Coil)", () => {
    const p = makePeptide();
    const { container } = render(<SequenceTrack peptide={p} />);

    expect(container.textContent).toContain("Helix");
    expect(container.textContent).toContain("SSW");
    expect(container.textContent).toContain("Coiled-coil");
    // The pre-Q7 legend used "Beta" — explicitly retired.
    expect(container.textContent).not.toMatch(/\bBeta\b/);
  });

  it("with no fragments, every residue renders as coiled-coil (100%)", () => {
    const p = makePeptide({
      sequence: "AAAAAAAAAA",
      length: 10,
      s4pred: {
        // ssPrediction is provided so hasS4pred=true, but no fragments
        // exist → pipeline classification falls all to coiled-coil.
        ssPrediction: ["C", "C", "C", "C", "C", "C", "C", "C", "C", "C"],
      },
    });
    const { container } = render(<SequenceTrack peptide={p} />);

    expect(container.textContent).toContain("Coiled-coil");
    expect(container.textContent).toContain("(100%)");
    expect(container.textContent).toContain("Helix");
    expect(container.textContent).toContain("(0%)");
  });

  it("residue inside a helix fragment renders helix even when ssPrediction is C", () => {
    const p = makePeptide({
      sequence: "GIGAVLKVLT",
      length: 10,
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "C", "H", "H", "H", "H"],
        helixSegments: [[1, 10]],
      },
    });
    const { container } = render(<SequenceTrack peptide={p} />);

    const residueSpans = container.querySelectorAll<HTMLSpanElement>("span.cursor-default");
    expect(residueSpans).toHaveLength(10);
    residueSpans.forEach((span) => {
      expect(span.style.color).toContain("hsl(var(--helix))");
    });
  });

  it("SSW wins over helix when a residue sits in both ranges", () => {
    // Helix and SSW both cover positions 1-10. SSW must win — magenta #E040FB.
    const p = makePeptide({
      sequence: "AAAAAAAAAA",
      length: 10,
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"],
        helixSegments: [[1, 10]],
      },
      s4predSswFragments: [[1, 10]],
    });
    const { container } = render(<SequenceTrack peptide={p} />);

    const residueSpans = container.querySelectorAll<HTMLSpanElement>("span.cursor-default");
    expect(residueSpans).toHaveLength(10);
    residueSpans.forEach((span) => {
      // SSW magenta — jsdom normalizes #E040FB to rgb(224, 64, 251).
      expect(span.style.color).toBe("rgb(224, 64, 251)");
    });
  });

  it("does NOT fall back to betaSegments for SSW — only s4predSswFragments counts", () => {
    // 2026-06-23 regression test: raw S4PRED beta predictions are NOT SSW.
    // A peptide where S4PRED says "all beta" but the pipeline did not flag
    // any SSW fragment must show 0% SSW in the legend.
    const p = makePeptide({
      sequence: "AAAAAAAAAA",
      length: 10,
      s4pred: {
        ssPrediction: ["E", "E", "E", "E", "E", "E", "E", "E", "E", "E"],
        betaSegments: [[1, 10]],
      },
      s4predSswFragments: null,
    });
    const { container } = render(<SequenceTrack peptide={p} />);

    const text = container.textContent ?? "";
    expect(text).toMatch(/SSW\s*\(0%\)/);
    expect(text).toMatch(/Coiled-coil\s*\(100%\)/);
  });

  it("legend % matches pipeline classification (not canonical s4predHelixPercent)", () => {
    // Pipeline: positions 1-5 helix, 6-10 coiled-coil (no SSW). Legend must show
    // 50% Helix / 0% SSW / 50% Coiled-coil — even though s4predHelixPercent
    // claims 90, the legend describes the colors on screen, not raw S4PRED.
    const p = makePeptide({
      sequence: "AAAAAAAAAA",
      length: 10,
      s4predHelixPercent: 90, // intentionally misleading
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "C", "C", "C", "C", "C"],
        helixSegments: [[1, 5]],
      },
    });
    const { container } = render(<SequenceTrack peptide={p} />);

    const text = container.textContent ?? "";
    // Helix (50%)
    expect(text).toMatch(/Helix\s*\(50%\)/);
    // SSW (0%)
    expect(text).toMatch(/SSW\s*\(0%\)/);
    // Coiled-coil (50%)
    expect(text).toMatch(/Coiled-coil\s*\(50%\)/);
  });

  it("renders 'no S4PRED' fallback when fragments and probabilities are absent", () => {
    const p = makePeptide({
      sequence: "AAAA",
      length: 4,
      s4pred: {}, // no ssPrediction, no probabilities, no fragments
    });
    const { container } = render(<SequenceTrack peptide={p} />);
    expect(container.textContent).toContain("S4PRED data not available");
  });
});
