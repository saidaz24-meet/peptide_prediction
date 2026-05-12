/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FastaPreview, type FastaEntry } from "../FastaPreview";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRY_A: FastaEntry = {
  id: "sp|P12345|FOO_HUMAN",
  sequence:
    "MKQHKAMIVALIVICITAVVAALVTRKDLCEVHIRTGQTEVAVFFQDSVISALILGGLGCVI", // 60aa
};

const ENTRY_B: FastaEntry = {
  id: "sp|Q98765|BAR_HUMAN",
  sequence: "AKLMNPQR",
};

const ENTRY_C: FastaEntry = {
  id: "sp|R55555|BAZ_HUMAN",
  sequence: "GLYCINEPROLINE",
};

const ENTRY_D: FastaEntry = {
  id: "sp|S77777|QUX_HUMAN",
  sequence: "MKTAYIAKQRQISFVKSH",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FastaPreview", () => {
  it("renders nothing surprising when given an empty entries array", () => {
    render(<FastaPreview fileName="empty.fasta" entries={[]} />);
    const root = screen.getByTestId("fasta-preview");
    expect(root).toBeInTheDocument();
    expect(screen.getByTestId("fasta-preview-count")).toHaveTextContent("0");
    expect(screen.getByTestId("fasta-preview-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("fasta-preview-rows")).toBeNull();
  });

  it("renders the filename and FASTA badge", () => {
    render(
      <FastaPreview
        fileName="staphylococcus_2023.fasta"
        entries={[ENTRY_A]}
      />,
    );
    const root = screen.getByTestId("fasta-preview");
    expect(root).toHaveTextContent("staphylococcus_2023.fasta");
    expect(root).toHaveTextContent("FASTA");
  });

  it("reports the sequence count (default = entries.length)", () => {
    render(
      <FastaPreview
        fileName="x.fasta"
        entries={[ENTRY_A, ENTRY_B, ENTRY_C]}
      />,
    );
    expect(screen.getByTestId("fasta-preview-count")).toHaveTextContent("3");
    // The headline text is split across a <span> and surrounding nodes; assert
    // on the root's full textContent instead of a single text node.
    expect(screen.getByTestId("fasta-preview").textContent).toMatch(
      /3 sequences detected from your FASTA file/,
    );
  });

  it("uses singular grammar when there is exactly one sequence", () => {
    render(<FastaPreview fileName="x.fasta" entries={[ENTRY_A]} />);
    expect(screen.getByTestId("fasta-preview").textContent).toMatch(
      /1 sequence detected from your FASTA file/,
    );
  });

  it("shows only the first 3 entries by default", () => {
    render(
      <FastaPreview
        fileName="x.fasta"
        entries={[ENTRY_A, ENTRY_B, ENTRY_C, ENTRY_D]}
      />,
    );
    const rows = screen.getAllByTestId("fasta-preview-row");
    expect(rows).toHaveLength(3);
    const more = screen.getByTestId("fasta-preview-more");
    expect(more).toHaveTextContent("+ 1 more sequence");
  });

  it("respects the `previewCount` override", () => {
    render(
      <FastaPreview
        fileName="x.fasta"
        entries={[ENTRY_A, ENTRY_B, ENTRY_C, ENTRY_D]}
        previewCount={1}
      />,
    );
    expect(screen.getAllByTestId("fasta-preview-row")).toHaveLength(1);
    expect(screen.getByTestId("fasta-preview-more")).toHaveTextContent(
      "+ 3 more sequences",
    );
  });

  it("truncates long sequences and shows the per-row length", () => {
    render(<FastaPreview fileName="x.fasta" entries={[ENTRY_A]} truncateAt={10} />);
    const row = screen.getByTestId("fasta-preview-row");
    // Truncated to first 10 chars + ellipsis
    expect(row).toHaveTextContent(/MKQHKAMIVA…/);
    // Length badge still reports the true sequence length (60)
    expect(row).toHaveTextContent(`${ENTRY_A.sequence.length} aa`);
    // Title attribute holds the full sequence so power users can hover
    const seqSpan = row.querySelector('[title^="MKQHKAMIVA"]') as HTMLElement;
    expect(seqSpan).not.toBeNull();
    expect(seqSpan.getAttribute("title")).toBe(ENTRY_A.sequence);
  });

  it("uses totalCount when provided so capped previews still report the true total", () => {
    // Simulates Upload.tsx capping rawData.rows at 200 while the actual file
    // has 1,500 sequences.
    render(
      <FastaPreview
        fileName="large.fasta"
        entries={[ENTRY_A, ENTRY_B, ENTRY_C]}
        totalCount={1500}
      />,
    );
    expect(screen.getByTestId("fasta-preview-count")).toHaveTextContent(
      "1,500",
    );
    expect(screen.getByTestId("fasta-preview-more")).toHaveTextContent(
      "+ 1,497 more sequences",
    );
  });

  it("renders without crashing when an entry has an empty sequence", () => {
    render(
      <FastaPreview
        fileName="x.fasta"
        entries={[{ id: "empty", sequence: "" }]}
      />,
    );
    const row = screen.getByTestId("fasta-preview-row");
    expect(row).toHaveTextContent("empty");
    expect(row).toHaveTextContent("0 aa");
  });

  it("exposes ARIA label for assistive tech", () => {
    render(<FastaPreview fileName="x.fasta" entries={[ENTRY_A]} />);
    expect(screen.getByLabelText("FASTA file preview")).toBeInTheDocument();
  });
});
