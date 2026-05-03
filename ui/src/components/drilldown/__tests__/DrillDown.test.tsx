/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DrillDownProvider, useDrillDown } from "../DrillDownProvider";
import type { Peptide, DatasetStats } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Mock react-router-dom useSearchParams
// ---------------------------------------------------------------------------

let mockParams = new URLSearchParams();
const mockSetSearchParams = vi.fn((updater: (prev: URLSearchParams) => URLSearchParams) => {
  if (typeof updater === "function") {
    mockParams = updater(mockParams);
  }
});

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [mockParams, mockSetSearchParams],
}));

// ---------------------------------------------------------------------------
// Mock Zustand store (for MetricInspector / PeptideInspector)
// ---------------------------------------------------------------------------

vi.mock("@/stores/datasetStore", () => ({
  useDatasetStore: (selector: (s: { peptides: Peptide[]; stats: DatasetStats | null; getPeptideById: (id: string) => Peptide | undefined }) => unknown) =>
    selector({
      peptides: [],
      stats: null,
      getPeptideById: () => undefined,
    }),
}));

// ---------------------------------------------------------------------------
// Test helper: renders a consumer that exposes drilldown controls
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { state, open, close } = useDrillDown();
  return (
    <div>
      <span data-testid="isOpen">{String(state.isOpen)}</span>
      <span data-testid="mode">{String(state.mode)}</span>
      <span data-testid="metricId">{String(state.metricId)}</span>
      <span data-testid="peptideId">{String(state.peptideId)}</span>
      <button onClick={() => open({ metric: "hydrophobicity", mode: "metric" })}>
        open-metric
      </button>
      <button onClick={() => open({ peptide: "PEP-001", mode: "peptide" })}>
        open-peptide
      </button>
      <button onClick={() => close()}>close</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DrillDownProvider", () => {
  beforeEach(() => {
    mockParams = new URLSearchParams();
    mockSetSearchParams.mockClear();
  });

  it("provides initial closed state when no URL params", () => {
    render(
      <DrillDownProvider>
        <TestConsumer />
      </DrillDownProvider>,
    );

    expect(screen.getByTestId("isOpen").textContent).toBe("false");
    expect(screen.getByTestId("mode").textContent).toBe("null");
    expect(screen.getByTestId("metricId").textContent).toBe("null");
    expect(screen.getByTestId("peptideId").textContent).toBe("null");
  });

  it("calls setSearchParams with metric on open()", () => {
    render(
      <DrillDownProvider>
        <TestConsumer />
      </DrillDownProvider>,
    );

    act(() => {
      screen.getByText("open-metric").click();
    });

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    // The updater function should produce params with drill=hydrophobicity
    const updater = mockSetSearchParams.mock.calls[0][0];
    const result = updater(new URLSearchParams());
    expect(result.get("drill")).toBe("hydrophobicity");
    expect(result.get("drillMode")).toBe("metric");
  });

  it("calls setSearchParams with peptide on open() for peptide mode", () => {
    render(
      <DrillDownProvider>
        <TestConsumer />
      </DrillDownProvider>,
    );

    act(() => {
      screen.getByText("open-peptide").click();
    });

    const updater = mockSetSearchParams.mock.calls[0][0];
    const result = updater(new URLSearchParams());
    expect(result.get("drillPeptide")).toBe("PEP-001");
    expect(result.get("drillMode")).toBe("peptide");
  });

  it("clears params on close()", () => {
    render(
      <DrillDownProvider>
        <TestConsumer />
      </DrillDownProvider>,
    );

    act(() => {
      screen.getByText("close").click();
    });

    const updater = mockSetSearchParams.mock.calls[0][0];
    const result = updater(new URLSearchParams("drill=hydrophobicity&drillMode=metric"));
    expect(result.has("drill")).toBe(false);
    expect(result.has("drillMode")).toBe(false);
    expect(result.has("drillPeptide")).toBe(false);
  });

  it("derives isOpen=true from URL params", () => {
    mockParams = new URLSearchParams("drill=charge&drillMode=metric");

    render(
      <DrillDownProvider>
        <TestConsumer />
      </DrillDownProvider>,
    );

    expect(screen.getByTestId("isOpen").textContent).toBe("true");
    expect(screen.getByTestId("mode").textContent).toBe("metric");
    expect(screen.getByTestId("metricId").textContent).toBe("charge");
  });

  it("throws when useDrillDown is used outside provider", () => {
    // Suppress console.error from React error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useDrillDown must be used within a DrillDownProvider",
    );
    spy.mockRestore();
  });
});
