/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  HelixIcon,
  BetaSheetIcon,
  CoilIcon,
  StructuralSwitchIcon,
  FibrilIcon,
  HelixToFibrilIcon,
  SwitchToFibrilIcon,
  PeptideChainIcon,
  AggregationIcon,
  UniProtIcon,
  ClassificationIcon,
} from "../PeptideIcons";

const ALL_ICONS = [
  { name: "HelixIcon", Component: HelixIcon },
  { name: "BetaSheetIcon", Component: BetaSheetIcon },
  { name: "CoilIcon", Component: CoilIcon },
  { name: "StructuralSwitchIcon", Component: StructuralSwitchIcon },
  { name: "FibrilIcon", Component: FibrilIcon },
  { name: "HelixToFibrilIcon", Component: HelixToFibrilIcon },
  { name: "SwitchToFibrilIcon", Component: SwitchToFibrilIcon },
  { name: "PeptideChainIcon", Component: PeptideChainIcon },
  { name: "AggregationIcon", Component: AggregationIcon },
  { name: "UniProtIcon", Component: UniProtIcon },
];

describe("PeptideIcons", () => {
  it.each(ALL_ICONS)("$name renders at default size (24)", ({ Component }) => {
    const { container } = render(<Component />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it.each(ALL_ICONS)("$name renders at custom size (32)", ({ Component }) => {
    const { container } = render(<Component size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it.each(ALL_ICONS)("$name accepts className", ({ Component }) => {
    const { container } = render(<Component className="text-red-500" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("text-red-500")).toBe(true);
  });
});

describe("ClassificationIcon", () => {
  it("renders HelixToFibrilIcon for ff-helix", () => {
    const { container } = render(
      <ClassificationIcon classification="ff-helix" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders StructuralSwitchIcon for ssw", () => {
    const { container } = render(
      <ClassificationIcon classification="ssw" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders SwitchToFibrilIcon for ff-ssw", () => {
    const { container } = render(
      <ClassificationIcon classification="ff-ssw" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders PeptideChainIcon for total", () => {
    const { container } = render(
      <ClassificationIcon classification="total" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("falls back to PeptideChainIcon for unknown classification", () => {
    const { container } = render(
      // @ts-expect-error — testing unknown classification fallback
      <ClassificationIcon classification="unknown" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
