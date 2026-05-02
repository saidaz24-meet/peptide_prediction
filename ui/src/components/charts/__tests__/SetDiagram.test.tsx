/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetDiagram, buildPVLSets } from "../SetDiagram";
import type { SetDefinition } from "../SetDiagram";

// ── Fixtures ──

const TWO_SETS: SetDefinition[] = [
  { id: "a", label: "Set A", members: ["1", "2", "3"], color: "#f00" },
  { id: "b", label: "Set B", members: ["2", "3", "4", "5"], color: "#00f" },
];

const THREE_SETS: SetDefinition[] = [
  { id: "a", label: "Alpha", members: ["1", "2", "3"] },
  { id: "b", label: "Beta", members: ["2", "3", "4"] },
  { id: "c", label: "Gamma", members: ["5"] },
];

const FOUR_SETS_WITH_SUBSETS: SetDefinition[] = [
  { id: "ssw", label: "SSW", members: ["1", "2", "3", "4"], color: "#D55E00" },
  {
    id: "helix",
    label: "Helix",
    members: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
    color: "#0072B2",
  },
  {
    id: "ff-ssw",
    label: "FF-SSW",
    members: ["1"],
    color: "#A03000",
    parentSet: "ssw",
  },
  {
    id: "ff-helix",
    label: "FF-Helix",
    members: ["5", "6", "7"],
    color: "#004A75",
    parentSet: "helix",
  },
];

const UNIVERSE_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));

// ── Tests ──

describe("SetDiagram", () => {
  it("renders with 2 sets and computes correct regions", () => {
    const { container } = render(
      <SetDiagram sets={TWO_SETS} universe={["1", "2", "3", "4", "5"]} />
    );

    // Should show "All: 5" total
    expect(container.textContent).toContain("All: 5");

    // Summary table should exist
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
  });

  it("renders with 4 sets including subset declarations", () => {
    const { container } = render(
      <SetDiagram sets={FOUR_SETS_WITH_SUBSETS} universe={UNIVERSE_12} />
    );

    // Should show total
    expect(container.textContent).toContain("All: 12");

    // FF-SSW and FF-Helix should appear as regions in the table
    expect(container.textContent).toContain("FF-SSW");
    expect(container.textContent).toContain("FF-Helix");
  });

  it("shows Neither count in foreground color (not faint gray)", () => {
    const { container } = render(
      <SetDiagram
        sets={[{ id: "a", label: "A", members: ["1", "2"] }]}
        universe={["1", "2", "3"]}
      />
    );

    // The "Neither" label should use fill-foreground class, not fill-muted
    const neitherTexts = container.querySelectorAll("text.fill-foreground");
    const neitherFound = Array.from(neitherTexts).some(
      (el) => el.textContent === "Neither"
    );
    expect(neitherFound).toBe(true);
  });

  it("calls onRegionClick when a table row is clicked", () => {
    const onClick = vi.fn();
    render(
      <SetDiagram
        sets={TWO_SETS}
        universe={["1", "2", "3", "4", "5"]}
        onRegionClick={onClick}
      />
    );

    // Click on a table row
    const rows = screen.getAllByRole("row");
    // First data row (skip header)
    if (rows.length > 1) {
      fireEvent.click(rows[1]);
      expect(onClick).toHaveBeenCalled();
    }
  });

  it("hides empty regions in euler mode", () => {
    // Only set A has member "1", set B has no overlap with universe
    const sets: SetDefinition[] = [
      { id: "a", label: "A", members: ["1"] },
      { id: "b", label: "B", members: [] },
    ];

    const { container } = render(
      <SetDiagram sets={sets} universe={["1", "2"]} mode="euler" />
    );

    // B-only should not appear in the table (empty)
    const tableText = container.querySelector("tbody")?.textContent || "";
    expect(tableText).not.toContain("B only");
  });

  it("renders with empty sets gracefully", () => {
    const { container } = render(
      <SetDiagram sets={[]} universe={["1", "2"]} />
    );

    expect(container.textContent).toContain("No classification predictions detected");
  });

  it("custom outsideLabel replaces 'Neither'", () => {
    const { container } = render(
      <SetDiagram
        sets={[{ id: "a", label: "A", members: ["1"] }]}
        universe={["1", "2"]}
        outsideLabel="Unclassified"
      />
    );

    expect(container.textContent).toContain("Unclassified");
  });
});

describe("buildPVLSets", () => {
  it("builds 4 sets with correct parentSet declarations", () => {
    const peptides = [
      { id: "P1", sswPrediction: 1, s4predHelixPrediction: 1, ffSswFlag: null, ffHelixFlag: 1 },
      { id: "P2", sswPrediction: -1, s4predHelixPrediction: 1, ffSswFlag: null, ffHelixFlag: null },
      { id: "P3", sswPrediction: 1, s4predHelixPrediction: -1, ffSswFlag: 1, ffHelixFlag: null },
    ];

    const sets = buildPVLSets(peptides);

    expect(sets).toHaveLength(4);
    expect(sets[0].id).toBe("ssw");
    expect(sets[1].id).toBe("helix");
    expect(sets[2].id).toBe("ff-ssw");
    expect(sets[2].parentSet).toBe("ssw");
    expect(sets[3].id).toBe("ff-helix");
    expect(sets[3].parentSet).toBe("helix");

    // SSW members: P1, P3
    expect(sets[0].members).toEqual(["P1", "P3"]);
    // Helix members: P1, P2
    expect(sets[1].members).toEqual(["P1", "P2"]);
    // FF-SSW members: P3
    expect(sets[2].members).toEqual(["P3"]);
    // FF-Helix members: P1
    expect(sets[3].members).toEqual(["P1"]);
  });
});
