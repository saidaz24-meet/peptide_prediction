/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorks } from "../HowItWorks";

describe("HowItWorks", () => {
  it("renders the section with heading", () => {
    render(<HowItWorks />);
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(
      screen.getByText(/From sequence to publication, step by step/),
    ).toBeInTheDocument();
  });

  it("renders 5 sequentially numbered step cards", () => {
    render(<HowItWorks />);
    expect(screen.getByTestId("how-step-1")).toBeInTheDocument();
    expect(screen.getByTestId("how-step-2")).toBeInTheDocument();
    expect(screen.getByTestId("how-step-3")).toBeInTheDocument();
    expect(screen.getByTestId("how-step-4")).toBeInTheDocument();
    expect(screen.getByTestId("how-step-5")).toBeInTheDocument();
  });

  it("renders step titles", () => {
    render(<HowItWorks />);
    expect(screen.getByText("Paste or Upload")).toBeInTheDocument();
    expect(screen.getByText("Run Predictors")).toBeInTheDocument();
    expect(screen.getByText("Classify Fibril-formation candidates")).toBeInTheDocument();
    expect(screen.getByText("Interactive Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Export & Cite")).toBeInTheDocument();
  });

  it("renders step labels", () => {
    render(<HowItWorks />);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(screen.getByText("Step 4")).toBeInTheDocument();
    expect(screen.getByText("Step 5")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    render(<HowItWorks />);
    expect(screen.getByText(/Single sequence, CSV batch/)).toBeInTheDocument();
    expect(screen.getByText(/S4PRED secondary structure, TANGO aggregation/)).toBeInTheDocument();
    expect(screen.getByText(/Apply dataset-derived thresholds/)).toBeInTheDocument();
    expect(screen.getByText(/Classification analysis/)).toBeInTheDocument();
    expect(screen.getByText(/publication-ready figure pack/)).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    render(<HowItWorks className="my-custom-class" />);
    expect(screen.getByTestId("how-it-works")).toHaveClass("my-custom-class");
  });
});
