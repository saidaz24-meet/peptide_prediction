/// <reference types="@testing-library/jest-dom" />
/**
 * Tests for the per-residue hover card.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResidueHover } from "../ResidueHover";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Mock Radix HoverCard so content renders inline (no portal)
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean; className?: string }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => <div data-testid="hover-content">{children}</div>,
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePeptide(overrides?: Partial<Peptide>): Peptide {
  return {
    id: "TEST-001",
    sequence: "AKLVFF",
    length: 6,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResidueHover", () => {
  it("renders children without crashing", () => {
    const peptide = makePeptide();
    render(
      <ResidueHover aa="A" position={0} peptide={peptide}>
        <span data-testid="residue">A</span>
      </ResidueHover>,
    );
    expect(screen.getByTestId("residue")).toBeInTheDocument();
    expect(screen.getByTestId("residue")).toHaveTextContent("A");
  });

  it("shows position and AA info", () => {
    const peptide = makePeptide();
    render(
      <ResidueHover aa="L" position={2} peptide={peptide}>
        <span data-testid="residue">L</span>
      </ResidueHover>,
    );

    // With mocked HoverCard, content renders inline
    // Position is 1-indexed for display
    expect(screen.getByText("Position 3")).toBeInTheDocument();
    expect(screen.getByText(/Leu/)).toBeInTheDocument();
  });

  it("handles missing per-residue data gracefully", () => {
    // Peptide with no s4pred or tango data
    const peptide = makePeptide();
    const { container } = render(
      <ResidueHover aa="K" position={1} peptide={peptide}>
        <span>K</span>
      </ResidueHover>,
    );
    // Should render without errors
    expect(container).toBeTruthy();
  });

  it("handles unknown residue codes gracefully", () => {
    const peptide = makePeptide({ sequence: "AXLVFF" });
    const { container } = render(
      <ResidueHover aa="X" position={1} peptide={peptide}>
        <span>X</span>
      </ResidueHover>,
    );
    expect(container).toBeTruthy();
  });

  it("shows S4PRED data when available", () => {
    const peptide = makePeptide({
      s4pred: {
        pH: [0.87, 0.12, 0.95],
        pE: [0.05, 0.8, 0.02],
        pC: [0.08, 0.08, 0.03],
        ssPrediction: ["H", "E", "H"],
        helixSegments: [[0, 1], [2, 3]],
        betaSegments: [[1, 2]],
      },
    });

    render(
      <ResidueHover aa="A" position={0} peptide={peptide}>
        <span data-testid="residue">A</span>
      </ResidueHover>,
    );

    // With mocked HoverCard, content renders inline
    expect(screen.getByText("0.87")).toBeInTheDocument();
    expect(screen.getByText("0.05")).toBeInTheDocument();
    expect(screen.getByText("0.08")).toBeInTheDocument();
  });

  it("shows TANGO aggregation when available", () => {
    const peptide = makePeptide({
      tango: {
        agg: [12.5, 0.0, 3.2],
      },
    });

    render(
      <ResidueHover aa="A" position={0} peptide={peptide}>
        <span data-testid="residue">A</span>
      </ResidueHover>,
    );

    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("TANGO Aggregation")).toBeInTheDocument();
  });
});
