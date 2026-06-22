/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickKpiStrip } from "../QuickKpiStrip";
import type { Peptide } from "@/types/peptide";

function makePeptide(overrides: Partial<Peptide> = {}): Peptide {
  return {
    id: "test",
    sequence: "GVGDLIRKAVSVIKNIV",
    length: 17,
    hydrophobicity: 0.5,
    muH: 0.4,
    charge: 1,
    s4predHelixPrediction: 1,
    s4predHelixPercent: 100,
    sswPrediction: -1,
    ffHelixFlag: 1,
    ffSswFlag: -1,
    ...overrides,
  } as Peptide;
}

describe("QuickKpiStrip", () => {
  it("renders all 4 PVL classes in canonical order", () => {
    render(<QuickKpiStrip peptide={makePeptide()} />);
    expect(screen.getByTestId("quick-kpi-strip")).toBeInTheDocument();
    expect(screen.getByTestId("quick-kpi-helix")).toBeInTheDocument();
    expect(screen.getByTestId("quick-kpi-ff-helix")).toBeInTheDocument();
    expect(screen.getByTestId("quick-kpi-ssw")).toBeInTheDocument();
    expect(screen.getByTestId("quick-kpi-ff-ssw")).toBeInTheDocument();
  });

  it("shows ✓ when Helix prediction = 1 and explains the helix coverage", () => {
    render(
      <QuickKpiStrip peptide={makePeptide({ s4predHelixPrediction: 1, s4predHelixPercent: 100 })} />
    );
    const helixCard = screen.getByTestId("quick-kpi-helix");
    expect(helixCard).toHaveTextContent("✓");
    expect(helixCard).toHaveTextContent(/coverage 100%/i);
  });

  it("shows ✗ + dependency explanation when FF-Helix has no underlying Helix", () => {
    render(<QuickKpiStrip peptide={makePeptide({ s4predHelixPrediction: 0, ffHelixFlag: -1 })} />);
    const ffHelixCard = screen.getByTestId("quick-kpi-ff-helix");
    expect(ffHelixCard).toHaveTextContent(/needs Helix first/i);
  });

  it("shows N/A when TANGO didn't run", () => {
    render(<QuickKpiStrip peptide={makePeptide({ sswPrediction: null })} />);
    const sswCard = screen.getByTestId("quick-kpi-ssw");
    expect(sswCard).toHaveTextContent("N/A");
    expect(sswCard).toHaveTextContent(/TANGO/i);
  });
});
