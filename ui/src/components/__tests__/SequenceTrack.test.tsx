/// <reference types="@testing-library/jest-dom" />
/**
 * Locks Peleg HELIX_PERCENTAGE_AUDIT.md fix #3:
 *
 * The SequenceTrack legend MUST source its helix/beta/coil percentages from
 * the canonical peptide.s4predHelixPercent / peptide.betaPercent fields, NOT
 * from re-counting ssPrediction labels. When the canonical helix value is
 * null we hide the percentages entirely rather than rendering "(0%)".
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
      // Provide an ssPrediction array so the track renders (no "no S4PRED" fallback).
      ssPrediction: ["H", "H", "H", "H", "H", "C", "C", "C", "C", "C"],
    },
    ...overrides,
  } as Peptide;
}

describe("SequenceTrack legend", () => {
  it("does not render any '%' string when s4predHelixPercent is null", () => {
    const p = makePeptide({ s4predHelixPercent: null, betaPercent: null });
    const { container } = render(<SequenceTrack peptide={p} />);

    // Legend wrapper must be present (track itself rendered).
    expect(container.textContent).toContain("Helix");
    // CRITICAL: no percentage anywhere in the legend region. The previous
    // implementation would have rendered "(50%)" / "(0%)" / "(50%)".
    expect(container.textContent).not.toContain("%");
  });

  it("renders canonical helix/beta percentages when both are provided", () => {
    const p = makePeptide({ s4predHelixPercent: 42, betaPercent: 18 });
    const { container } = render(<SequenceTrack peptide={p} />);

    // Helix from canonical field, NOT recomputed from ssPrediction.
    expect(container.textContent).toContain("(42%)");
    expect(container.textContent).toContain("(18%)");
    // Coil derived as 100 − H − E.
    expect(container.textContent).toContain("(40%)");
  });

  it("hides legend percentages when helix is provided but beta is null", () => {
    // Without a canonical betaPercent we cannot derive coil reliably; legend
    // must collapse to label-only rather than mix sources.
    const p = makePeptide({ s4predHelixPercent: 42, betaPercent: null });
    const { container } = render(<SequenceTrack peptide={p} />);

    // Helix percent IS available — it should still render.
    expect(container.textContent).toContain("(42%)");
    // Beta and coil have no canonical source — must NOT render numbers.
    expect(container.textContent).not.toContain("(0%)");
  });

  // 2026-06-07 regression — black-G bug. A residue that S4PRED's per-residue
  // argmax calls "C" (coil) but that sits INSIDE a helix fragment range
  // (Peleg's gap-smoothed `Helix fragments (S4PRED)`) MUST render as helix.
  // Driver: residue colour ought to derive from fragment ranges first, raw
  // per-residue argmax only as a fallback for residues outside any fragment.
  it("residue inside a helix fragment renders helix even when ssPrediction says coil", () => {
    // Sequence GIGAVLKVLT — 10 aa, S4PRED says C for the G at index 5 (1-indexed:6)
    // but Peleg's gap-smoothed helix fragment spans 1-10 covering it.
    const p = makePeptide({
      sequence: "GIGAVLKVLT",
      length: 10,
      s4predHelixPercent: 90,
      betaPercent: 0,
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "C", "H", "H", "H", "H"],
        helixSegments: [[1, 10]],
      },
    });
    const { container } = render(<SequenceTrack peptide={p} />);
    // All 10 residue spans should have the helix colour applied. We check via
    // the inline style — helix uses `hsl(var(--helix))`.
    const residueSpans = container.querySelectorAll("span[style*='helix']");
    expect(residueSpans.length).toBeGreaterThanOrEqual(10);
  });

  it("residue outside any fragment falls back to per-residue argmax", () => {
    // Helix fragment covers 1-5 only. Residue at 1-indexed:8 has ssPrediction "E"
    // and no fragment owns it — should render beta colour from the fallback path.
    const p = makePeptide({
      sequence: "AAAAAAEEEE",
      length: 10,
      s4predHelixPercent: 50,
      betaPercent: 40,
      s4pred: {
        ssPrediction: ["H", "H", "H", "H", "H", "C", "C", "E", "E", "E"],
        helixSegments: [[1, 5]],
      },
    });
    const { container } = render(<SequenceTrack peptide={p} />);
    // Beta colour uses `hsl(var(--beta))` via the style attribute — at least
    // one residue should pick this up via the fallback path.
    const betaSpans = container.querySelectorAll("span[style*='beta']");
    expect(betaSpans.length).toBeGreaterThanOrEqual(1);
  });

  // Q.2 — parity test against the canonical s4predHelixPercent.
  // Said's screenshot showed Amyloid-β(25-35) "AIKKYEEKNKKSSRLFIFRK"
  // with Helix (30%). Lock that the rendered legend % equals
  // s4predHelixPercent.toFixed(0) verbatim — never a recomputed value.
  it("legend helix % is exactly s4predHelixPercent.toFixed(0) — Amyloid-β parity", () => {
    const cases = [
      { s4predHelixPercent: 30, expectedLabel: "(30%)" },
      { s4predHelixPercent: 0, expectedLabel: "(0%)" },
      { s4predHelixPercent: 100, expectedLabel: "(100%)" },
      // Decimal value floors via toFixed(0) — 29.49 → 29, not 30.
      { s4predHelixPercent: 29.49, expectedLabel: "(29%)" },
    ];

    for (const { s4predHelixPercent, expectedLabel } of cases) {
      const p = makePeptide({
        sequence: "AIKKYEEKNKKSSRLFIFRK",
        length: 20,
        s4predHelixPercent,
        betaPercent: 10,
        s4pred: {
          // Deliberately mostly-coil ssPrediction — proves the legend does
          // NOT re-compute from this array (it would render ~5%, not 30).
          ssPrediction: [
            "C", "C", "C", "C", "C", "C", "C", "C", "C", "H",
            "C", "C", "C", "C", "C", "C", "C", "C", "C", "C",
          ],
        },
      });
      const { container } = render(<SequenceTrack peptide={p} />);
      expect(container.textContent).toContain(expectedLabel);
    }
  });
});
