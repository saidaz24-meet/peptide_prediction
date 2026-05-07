/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  WindowProfileChart,
  DEFAULT_PVL_CHANNELS,
  DEFAULT_REFERENCE_LINES,
} from "../WindowProfileChart";
import type { WindowChannel, WindowProfileChartProps } from "../WindowProfileChart";
import type { Peptide } from "@/types/peptide";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Recharts uses refs and SVG measurement — stub ResponsiveContainer
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 600, height: 300 }}>
        {children}
      </div>
    ),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeptide(overrides?: Partial<Peptide>): Peptide {
  return {
    id: "P12345",
    // 20 residues → window 11 produces 10 profile points
    sequence: "AKLVFFAEDVGSNKAKLVFF",
    length: 20,
    hydrophobicity: 0.5,
    charge: 1.0,
    sswPrediction: null,
    ...overrides,
  } as Peptide;
}

const LINE_ONLY_CHANNELS: WindowChannel[] = [
  {
    type: "line",
    id: "hydrophobicity",
    label: "Hydrophobicity (FP)",
    metric: "hydrophobicity",
    color: "#a855f7",
    yAxis: "left",
    strokeWidth: 2,
  },
];

const BAND_ONLY_CHANNELS: WindowChannel[] = [
  {
    type: "segment-band",
    id: "s4predHelix",
    label: "S4PRED helix",
    source: "s4predHelix",
    color: "#a855f7",
    opacity: 0.15,
  },
];

const MARKER_ONLY_CHANNELS: WindowChannel[] = [
  {
    type: "point-markers",
    id: "aggPeaks",
    label: "Agg peaks (>5%)",
    metric: "aggregationPeaks",
    threshold: 5,
    color: "#ef4444",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WindowProfileChart", () => {
  // ── Rendering basics ──────────────────────────────────────────────────

  it("renders the chart container", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={DEFAULT_PVL_CHANNELS}
      />,
    );
    expect(screen.getByTestId("window-profile-chart")).toBeInTheDocument();
    expect(screen.getByTestId("channel-legend")).toBeInTheDocument();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  // ── Channel type rendering ────────────────────────────────────────────

  it("renders line channel legend entry", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
      />,
    );
    expect(screen.getByText("Hydrophobicity (FP)")).toBeInTheDocument();
  });

  it("renders segment-band channel legend entry when peptide has helix data", () => {
    const p = makePeptide({
      s4pred: { helixSegments: [[2, 10]] },
    });
    render(
      <WindowProfileChart peptide={p} channels={BAND_ONLY_CHANNELS} />,
    );
    expect(screen.getByText("S4PRED helix")).toBeInTheDocument();
  });

  it("renders point-markers channel legend entry when TANGO data present", () => {
    const agg = new Array(20).fill(0);
    agg[5] = 15;
    agg[6] = 20;
    const p = makePeptide({ tango: { agg } });
    render(
      <WindowProfileChart peptide={p} channels={MARKER_ONLY_CHANNELS} />,
    );
    expect(screen.getByText("Agg peaks (>5%)")).toBeInTheDocument();
  });

  it("hides point-markers legend when no TANGO data", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={MARKER_ONLY_CHANNELS}
      />,
    );
    expect(screen.queryByText("Agg peaks (>5%)")).not.toBeInTheDocument();
  });

  it("hides TANGO line legend when no TANGO data", () => {
    const tangoLine: WindowChannel[] = [
      {
        type: "line",
        id: "tango",
        label: "TANGO Agg %",
        metric: "tango",
        color: "#ef4444",
        yAxis: "right",
      },
    ];
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={tangoLine}
      />,
    );
    expect(screen.queryByText("TANGO Agg %")).not.toBeInTheDocument();
  });

  // ── Channel toggle ────────────────────────────────────────────────────

  it("toggles channel visibility on click", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
      />,
    );
    const btn = screen.getByLabelText("Toggle Hydrophobicity (FP)");
    expect(btn).toBeInTheDocument();

    // Label should not be struck-through initially
    const label = screen.getByText("Hydrophobicity (FP)");
    expect(label.className).not.toContain("line-through");

    // Click to hide
    fireEvent.click(btn);
    expect(label.className).toContain("line-through");

    // Click again to show
    fireEvent.click(btn);
    expect(label.className).not.toContain("line-through");
  });

  // ── Zoom (B.1: discrete buttons replace drag-to-zoom) ─────────────────

  it("never renders the 'Drag to zoom' hint (B.1: removed)", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
      />,
    );
    expect(screen.queryByText("Drag to zoom")).not.toBeInTheDocument();
  });

  it("renders zoom-in / zoom-out / reset icon buttons", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
      />,
    );
    expect(screen.getByTestId("zoom-controls")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("reset-zoom")).toBeInTheDocument();
  });

  it("disables zoom-out and reset at full domain, enables them after zoom-in", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
      />,
    );
    const zoomIn = screen.getByTestId("zoom-in") as HTMLButtonElement;
    const zoomOut = screen.getByTestId("zoom-out") as HTMLButtonElement;
    const reset = screen.getByTestId("reset-zoom") as HTMLButtonElement;

    // Default = full sequence; nothing to zoom out from / reset to.
    expect(zoomOut.disabled).toBe(true);
    expect(reset.disabled).toBe(true);
    expect(zoomIn.disabled).toBe(false);

    // Zoom in once → reset + zoom-out should now be available.
    fireEvent.click(zoomIn);
    expect(reset.disabled).toBe(false);
    expect(zoomOut.disabled).toBe(false);

    // Reset goes back to full domain.
    fireEvent.click(reset);
    expect(reset.disabled).toBe(true);
    expect(zoomOut.disabled).toBe(true);
  });

  // ── Default channels ──────────────────────────────────────────────────

  it("DEFAULT_PVL_CHANNELS has 6 channels", () => {
    expect(DEFAULT_PVL_CHANNELS).toHaveLength(6);
    const types = DEFAULT_PVL_CHANNELS.map((ch) => ch.type);
    expect(types.filter((t) => t === "line")).toHaveLength(3);
    expect(types.filter((t) => t === "segment-band")).toHaveLength(2);
    expect(types.filter((t) => t === "point-markers")).toHaveLength(1);
  });

  it("DEFAULT_REFERENCE_LINES has 2 reference lines", () => {
    expect(DEFAULT_REFERENCE_LINES).toHaveLength(2);
    expect(DEFAULT_REFERENCE_LINES[0].yAxis).toBe("left");
    expect(DEFAULT_REFERENCE_LINES[1].yAxis).toBe("right");
  });

  // ── Full channel set ──────────────────────────────────────────────────

  it("renders all DEFAULT_PVL_CHANNELS legend entries with full data", () => {
    const agg = new Array(20).fill(0);
    agg[5] = 15;
    agg[6] = 20;
    const p = makePeptide({
      tango: { agg },
      s4pred: {
        helixSegments: [[2, 10]],
        betaSegments: [[12, 16]],
      },
      ffHelixFlag: 1,
      ffHelixFragments: [[3, 9]],
    });
    render(
      <WindowProfileChart peptide={p} channels={DEFAULT_PVL_CHANNELS} />,
    );

    // All 6 channel labels visible
    expect(screen.getByText("Hydrophobicity (FP)")).toBeInTheDocument();
    expect(screen.getByText("μH")).toBeInTheDocument();
    expect(screen.getByText("TANGO Agg %")).toBeInTheDocument();
    expect(screen.getByText("S4PRED helix")).toBeInTheDocument();
    expect(screen.getByText("FF-Helix candidate")).toBeInTheDocument();
    expect(screen.getByText("Agg peaks (>5%)")).toBeInTheDocument();
  });

  // ── Chart height prop ─────────────────────────────────────────────────

  it("applies custom height to chart container", () => {
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
        height={500}
      />,
    );
    const container = screen.getByTestId("chart-container");
    expect(container.style.height).toBe("500px");
  });

  // ── Empty/minimal data ────────────────────────────────────────────────

  it("renders gracefully with no channels", () => {
    render(
      <WindowProfileChart peptide={makePeptide()} channels={[]} />,
    );
    expect(screen.getByTestId("window-profile-chart")).toBeInTheDocument();
    // Legend exists but empty (only zoom hint)
    expect(screen.getByTestId("channel-legend")).toBeInTheDocument();
  });

  it("renders gracefully with short sequence", () => {
    const p = makePeptide({ sequence: "AKLVFFAEDVG", length: 11 });
    render(
      <WindowProfileChart peptide={p} channels={LINE_ONLY_CHANNELS} />,
    );
    // Should produce 1 data point for window=11 but not crash
    expect(screen.getByTestId("window-profile-chart")).toBeInTheDocument();
  });

  // ── Window size prop ──────────────────────────────────────────────────

  it("accepts custom windowSize prop", () => {
    // Just verify it doesn't crash with windowSize=7
    render(
      <WindowProfileChart
        peptide={makePeptide()}
        channels={LINE_ONLY_CHANNELS}
        windowSize={7}
      />,
    );
    expect(screen.getByTestId("window-profile-chart")).toBeInTheDocument();
  });
});
