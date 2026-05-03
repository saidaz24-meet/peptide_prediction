/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricHover } from "../MetricHover";
import type { Peptide, DatasetStats } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Mock Radix HoverCard so content renders inline (no portal)
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean; className?: string }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => <div data-testid="hover-content">{children}</div>,
}));

// ---------------------------------------------------------------------------
// Mock the Zustand store
// ---------------------------------------------------------------------------

const mockPeptides: Peptide[] = [];
const mockStats: DatasetStats | null = null;

vi.mock("@/stores/datasetStore", () => ({
  useDatasetStore: (selector: (s: { peptides: Peptide[]; stats: DatasetStats | null }) => unknown) =>
    selector({ peptides: mockPeptides, stats: mockStats }),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makePeptide(overrides: Partial<Peptide> & { id: string }): Peptide {
  return {
    sequence: "AAAAAA",
    length: 6,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  } as Peptide;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MetricHover", () => {
  it("renders children as trigger", () => {
    render(
      <MetricHover metric="hydrophobicity">
        <span data-testid="trigger">0.42</span>
      </MetricHover>
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
    expect(screen.getByTestId("trigger")).toHaveTextContent("0.42");
  });

  it("renders metric name in hover content", () => {
    render(
      <MetricHover metric="hydrophobicity" value={0.42}>
        <span>0.42</span>
      </MetricHover>
    );
    // HoverCardContent renders in the DOM even when not visible (radix behavior)
    // We check the content is present
    expect(screen.getByText("Hydrophobicity")).toBeInTheDocument();
  });

  it("renders the formatted value when provided", () => {
    render(
      <MetricHover metric="charge" value={2.5}>
        <span>trigger</span>
      </MetricHover>
    );
    // The formatted value appears in the hover content
    expect(screen.getByText("+2.50")).toBeInTheDocument();
  });

  it("handles missing peptide gracefully (aggregate mode)", () => {
    render(
      <MetricHover metric="hydrophobicity">
        <span>Avg: 0.42</span>
      </MetricHover>
    );
    // Should render definition but not value/distribution
    expect(screen.getByText("Hydrophobicity")).toBeInTheDocument();
    // The definition text should be present
    expect(
      screen.getByText(/Fauchere-Pliska scale/)
    ).toBeInTheDocument();
  });

  it("handles unknown metric ID gracefully", () => {
    render(
      <MetricHover metric="totally-unknown">
        <span>???</span>
      </MetricHover>
    );
    expect(screen.getByText(/Unknown metric/)).toBeInTheDocument();
    expect(screen.getByText("totally-unknown")).toBeInTheDocument();
  });

  it("shows interpretation text from registry", () => {
    render(
      <MetricHover metric="muH" value={0.388}>
        <span>trigger</span>
      </MetricHover>
    );
    expect(
      screen.getAllByText(/amphipathicity/).length
    ).toBeGreaterThan(0);
  });
});
