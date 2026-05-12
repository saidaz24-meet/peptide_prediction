/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { QueryMetadata } from "@/lib/permalink";
import type { DatasetMetadata } from "@/types/peptide";
import { DEFAULT_THRESHOLDS } from "@/lib/thresholds";

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------

const baseQueryMeta: QueryMetadata = {
  source: "uniprot",
  query: "amyloid AND reviewed:true",
  peptideCount: 16,
  timestamp: "2026-05-12T09:00:00Z",
  predictors: { s4pred: true, tango: true },
};

const baseMeta: DatasetMetadata = {
  runId: "run-1",
  use_tango: true,
  use_s4pred: true,
  source: "uniprot_api",
  query: "amyloid AND reviewed:true",
  provider_status: {
    tango: { status: "AVAILABLE", stats: { requested: 16, parsed_ok: 16, parsed_bad: 0 } },
    s4pred: { status: "PARTIAL", stats: { requested: 16, parsed_ok: 12, parsed_bad: 4 } },
  },
};

let datasetState = { meta: baseMeta as DatasetMetadata | null };
let reproState = {
  queryMeta: baseQueryMeta as QueryMetadata | null,
  datasetHash: "abc123def4567890abcdef1234567890" as string | null,
  isHashing: false,
};
let thresholdState = { active: { ...DEFAULT_THRESHOLDS } };

vi.mock("@/stores/datasetStore", () => ({
  useDatasetStore: (selector: (s: typeof datasetState) => unknown) =>
    selector(datasetState),
}));

vi.mock("@/stores/reproducibilityStore", () => ({
  useReproducibilityStore: (selector: (s: typeof reproState) => unknown) =>
    selector(reproState),
  PVL_VERSION: "0.1.2",
  BUILD_SHA: "abc1234defabcd",
}));

vi.mock("@/stores/thresholdStore", () => ({
  useThresholdStore: (selector: (s: typeof thresholdState) => unknown) =>
    selector(thresholdState),
}));

// shadcn Dialog uses Radix portals; render children inline for jsdom.
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Dialog: ({
      open,
      children,
    }: {
      open: boolean;
      children?: React.ReactNode;
    }) => (open ? <>{children}</> : null),
    DialogContent: ({
      children,
      ...rest
    }: {
      children?: React.ReactNode;
    } & Record<string, unknown>) => <div {...rest}>{children}</div>,
    DialogHeader: Pass,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    DialogDescription: ({ children }: { children?: React.ReactNode }) => (
      <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { CsvExportDialog } from "../CsvExportDialog";

beforeEach(() => {
  datasetState = { meta: baseMeta };
  reproState = {
    queryMeta: baseQueryMeta,
    datasetHash: "abc123def4567890abcdef1234567890",
    isHashing: false,
  };
  thresholdState = { active: { ...DEFAULT_THRESHOLDS } };
});

function renderDialog(overrides: Partial<{
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  filename: string;
  peptideCount: number;
}> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <CsvExportDialog
      open
      onOpenChange={onOpenChange}
      filename={overrides.filename ?? "peptide_data_2026-05-12.csv"}
      peptideCount={overrides.peptideCount ?? 42}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("CsvExportDialog", () => {
  it("does not render content when open is false", () => {
    render(
      <CsvExportDialog
        open={false}
        onOpenChange={vi.fn()}
        filename="x.csv"
        peptideCount={0}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("csv-export-dialog")).toBeNull();
  });

  it("renders the filename and row-count badge", () => {
    renderDialog({ peptideCount: 16, filename: "peptide_data_2026-05-12.csv" });
    expect(screen.getByTestId("csv-export-dialog")).toBeInTheDocument();
    // Filename appears twice (description prose + metadata block) — both is fine.
    expect(
      screen.getAllByText(/peptide_data_2026-05-12\.csv/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("csv-export-row-count")).toHaveTextContent(
      "16 rows",
    );
  });

  it("shows predictor states from provider_status (AVAILABLE / PARTIAL)", () => {
    renderDialog();
    expect(screen.getByTestId("csv-export-tango-state")).toHaveTextContent(
      "TANGO: ran (all rows)",
    );
    expect(screen.getByTestId("csv-export-s4pred-state")).toHaveTextContent(
      "S4PRED: ran (partial)",
    );
  });

  it("falls back to use_* flags when provider_status is missing", () => {
    datasetState = {
      meta: { use_tango: true, use_s4pred: false } as DatasetMetadata,
    };
    renderDialog();
    expect(screen.getByTestId("csv-export-tango-state")).toHaveTextContent(
      "TANGO: on",
    );
    expect(screen.getByTestId("csv-export-s4pred-state")).toHaveTextContent(
      "S4PRED: off",
    );
  });

  it("embeds version, timestamp, thresholds, and dataset hash in the metadata block", () => {
    renderDialog({ peptideCount: 16 });
    const block = screen.getByTestId("csv-export-metadata").textContent ?? "";
    expect(block).toContain("# PVL CSV export");
    expect(block).toContain("pvl_version=0.1.2");
    expect(block).toContain("build_sha=abc1234defabcd");
    expect(block).toContain("generated=2026-05-12T09:00:00Z");
    expect(block).toContain("source=uniprot");
    expect(block).toContain("query=amyloid AND reviewed:true");
    expect(block).toContain("dataset_hash=abc123def4567890");
    expect(block).toContain(
      `threshold_muH_cutoff=${DEFAULT_THRESHOLDS.muHCutoff}`,
    );
    expect(block).toContain(
      `threshold_hydro_cutoff=${DEFAULT_THRESHOLDS.hydroCutoff}`,
    );
    expect(block).toContain("rows=16");
  });

  it("copies the metadata block to the clipboard on Copy click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderDialog();
    fireEvent.click(screen.getByTestId("csv-export-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const arg = writeText.mock.calls[0][0] as string;
    expect(arg).toContain("# PVL CSV export");
    expect(arg).toContain("pvl_version=0.1.2");
    // Button reflects "Copied" after success
    await waitFor(() =>
      expect(screen.getByTestId("csv-export-copy")).toHaveTextContent("Copied"),
    );
  });

  it("calls onConfirm and closes when Download is clicked", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });

    fireEvent.click(screen.getByTestId("csv-export-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes (no download) when Cancel is clicked", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });

    fireEvent.click(screen.getByTestId("csv-export-cancel"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses the current time as the timestamp when no queryMeta exists", () => {
    reproState = { queryMeta: null, datasetHash: null, isHashing: false };
    renderDialog();
    const block = screen.getByTestId("csv-export-metadata").textContent ?? "";
    expect(block).toMatch(/generated=\d{4}-\d{2}-\d{2}T/);
    // Without a dataset hash, the line is omitted
    expect(block).not.toContain("dataset_hash=");
  });
});
