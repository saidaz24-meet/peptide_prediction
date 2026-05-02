/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DistributionChart } from "../DistributionChart";
import type { DistributionMetric, PreBinnedData } from "../DistributionChart";

const METRIC: DistributionMetric = {
  id: "hydrophobicity",
  label: "Hydrophobicity",
  axisX: "Hydrophobicity",
  axisY: "Count",
};

const RAW_DATA = [0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5];

const PEPTIDE_VALUES = RAW_DATA.map((v, i) => ({ id: `P${i + 1}`, value: v }));

const BINNED_DATA: PreBinnedData[] = [
  { label: "0-5%", count: 9, ids: ["a", "b"], color: "#22c55e" },
  { label: "5-10%", count: 2, ids: ["c"], color: "#eab308" },
  { label: "10-20%", count: 1, ids: ["d"], color: "#ef4444" },
];

// Mock ResizeObserver for Recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("DistributionChart", () => {
  it("renders with raw data in bar mode", () => {
    const { container } = render(
      <DistributionChart
        data={RAW_DATA}
        peptideValues={PEPTIDE_VALUES}
        metric={METRIC}
        style="bar"
      />
    );
    // Should render a chart container
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("renders with pre-binned data", () => {
    const { container } = render(
      <DistributionChart binnedData={BINNED_DATA} metric={METRIC} />
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("renders lollipop style", () => {
    const { container } = render(
      <DistributionChart
        binnedData={BINNED_DATA}
        metric={METRIC}
        style="lollipop"
      />
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("shows summary text when threshold and summary mode provided", () => {
    const { container } = render(
      <DistributionChart
        data={RAW_DATA}
        peptideValues={PEPTIDE_VALUES}
        metric={METRIC}
        threshold={{ value: 0.5, label: "μH threshold" }}
        summary="count-above"
      />
    );
    // Summary text should mention count above threshold
    expect(container.textContent).toContain("peptides");
    expect(container.textContent).toContain("above");
  });

  it("shows empty state when no data", () => {
    const { container } = render(
      <DistributionChart data={[]} metric={METRIC} />
    );
    expect(container.textContent).toContain("No data available");
  });

  it("renders with custom height", () => {
    const { container } = render(
      <DistributionChart
        data={RAW_DATA}
        peptideValues={PEPTIDE_VALUES}
        metric={METRIC}
        height={400}
      />
    );
    // The container should have the height style
    const chartContainer = container.querySelector("[style]");
    expect(chartContainer).not.toBeNull();
  });
});
