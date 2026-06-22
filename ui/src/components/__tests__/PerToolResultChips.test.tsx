/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerToolResultChips } from "../PerToolResultChips";
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
    tangoHasData: true,
    tangoAggMax: 12.3,
    sswPrediction: 1,
    ffHelixFlag: 1,
    ffSswFlag: -1,
    ...overrides,
  } as Peptide;
}

describe("PerToolResultChips", () => {
  it("renders one chip per provider/classifier in canonical order", () => {
    render(<PerToolResultChips peptide={makePeptide()} />);
    expect(screen.getByTestId("per-tool-result-chips")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chip-s4pred")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chip-tango")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chip-ff-helix")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chip-ssw")).toBeInTheDocument();
    expect(screen.getByTestId("tool-chip-ff-ssw")).toBeInTheDocument();
  });

  it("shows the S4PRED helix percentage when prediction is positive", () => {
    render(
      <PerToolResultChips
        peptide={makePeptide({ s4predHelixPrediction: 1, s4predHelixPercent: 87 })}
      />
    );
    expect(screen.getByTestId("tool-chip-s4pred")).toHaveTextContent(/Helix\s+87%/);
  });

  it("shows TANGO peak aggregation when data is present", () => {
    render(<PerToolResultChips peptide={makePeptide({ tangoHasData: true, tangoAggMax: 12.3 })} />);
    expect(screen.getByTestId("tool-chip-tango")).toHaveTextContent(/Peak agg 12\.3/);
  });

  it("falls back to N/A when a provider didn't run", () => {
    render(
      <PerToolResultChips
        peptide={makePeptide({
          s4predHelixPrediction: null,
          tangoHasData: false,
          tangoAggMax: null,
          sswPrediction: null,
          ffHelixFlag: null,
          ffSswFlag: null,
        })}
      />
    );
    expect(screen.getByTestId("tool-chip-s4pred")).toHaveTextContent("N/A");
    expect(screen.getByTestId("tool-chip-tango")).toHaveTextContent("N/A");
    expect(screen.getByTestId("tool-chip-ff-helix")).toHaveTextContent("N/A");
    expect(screen.getByTestId("tool-chip-ssw")).toHaveTextContent("N/A");
    expect(screen.getByTestId("tool-chip-ff-ssw")).toHaveTextContent("N/A");
  });

  it("distinguishes Candidate / No / Switch / Stable verdicts", () => {
    render(
      <PerToolResultChips
        peptide={makePeptide({
          ffHelixFlag: 1,
          sswPrediction: 0,
          ffSswFlag: -1,
        })}
      />
    );
    expect(screen.getByTestId("tool-chip-ff-helix")).toHaveTextContent("Candidate");
    expect(screen.getByTestId("tool-chip-ssw")).toHaveTextContent("Stable");
    expect(screen.getByTestId("tool-chip-ff-ssw")).toHaveTextContent("No");
  });
});
