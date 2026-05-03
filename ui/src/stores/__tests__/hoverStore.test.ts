/**
 * Tests for the cross-chart hover store.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useHoverStore } from "../hoverStore";

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useHoverStore.getState().clearHover();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useHoverStore", () => {
  it("starts with all null values", () => {
    const state = useHoverStore.getState();
    expect(state.activePeptideId).toBeNull();
    expect(state.activeMetricId).toBeNull();
    expect(state.source).toBeNull();
  });

  it("setHover sets all fields", () => {
    useHoverStore.getState().setHover({
      peptideId: "P001",
      metricId: "hydrophobicity",
      source: "scatter",
    });
    const state = useHoverStore.getState();
    expect(state.activePeptideId).toBe("P001");
    expect(state.activeMetricId).toBe("hydrophobicity");
    expect(state.source).toBe("scatter");
  });

  it("setHover with partial opts defaults missing to null", () => {
    useHoverStore.getState().setHover({ peptideId: "P002" });
    const state = useHoverStore.getState();
    expect(state.activePeptideId).toBe("P002");
    expect(state.activeMetricId).toBeNull();
    expect(state.source).toBeNull();
  });

  it("clearHover resets to null", () => {
    useHoverStore.getState().setHover({
      peptideId: "P003",
      metricId: "charge",
      source: "bar-chart",
    });
    useHoverStore.getState().clearHover();
    const state = useHoverStore.getState();
    expect(state.activePeptideId).toBeNull();
    expect(state.activeMetricId).toBeNull();
    expect(state.source).toBeNull();
  });

  it("source tracks which component triggered the hover", () => {
    useHoverStore.getState().setHover({ peptideId: "P004", source: "set-diagram" });
    expect(useHoverStore.getState().source).toBe("set-diagram");

    useHoverStore.getState().setHover({ peptideId: "P004", source: "correlation-matrix" });
    expect(useHoverStore.getState().source).toBe("correlation-matrix");
  });

  it("overwriting hover replaces previous state completely", () => {
    useHoverStore.getState().setHover({
      peptideId: "P005",
      metricId: "muH",
      source: "chart-A",
    });
    useHoverStore.getState().setHover({
      peptideId: "P006",
      source: "chart-B",
    });
    const state = useHoverStore.getState();
    expect(state.activePeptideId).toBe("P006");
    expect(state.activeMetricId).toBeNull();
    expect(state.source).toBe("chart-B");
  });
});
