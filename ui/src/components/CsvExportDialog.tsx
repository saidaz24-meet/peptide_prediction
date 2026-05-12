/**
 * CsvExportDialog — pre-export confirmation modal for CSV downloads
 * (Wave 2 §I, paired with T2 §G run-metadata work).
 *
 * Shows the analysis metadata that will be embedded in the exported file:
 * PVL version + build SHA, run timestamp, predictor versions, active
 * thresholds, dataset hash. The user can:
 *   - Copy the metadata block to the clipboard
 *   - Confirm → triggers the original download path via `onConfirm`
 *   - Cancel → closes without exporting
 *
 * The component is purely presentational w.r.t. the export itself — the
 * caller wires the actual CSV download in their own handler.
 */

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/stores/datasetStore";
import {
  PVL_VERSION,
  BUILD_SHA,
  useReproducibilityStore,
} from "@/stores/reproducibilityStore";
import { useThresholdStore } from "@/stores/thresholdStore";
import type { ResolvedThresholds } from "@/lib/thresholds";
import type { DatasetMetadata } from "@/types/peptide";

interface CsvExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default filename shown in the dialog (e.g., "peptide_data_2026-05-12.csv"). */
  filename: string;
  /** Number of rows that will be written (after filters, if applicable). */
  peptideCount: number;
  /** Called when the user confirms the export. */
  onConfirm: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the plain-text metadata block used both for display and clipboard. */
function buildMetadataText(args: {
  filename: string;
  peptideCount: number;
  pvlVersion: string;
  buildSha: string;
  timestamp: string;
  source: string;
  query: string | null;
  predictors: { tango: ProviderState; s4pred: ProviderState };
  thresholds: ResolvedThresholds;
  datasetHash: string | null;
}): string {
  const lines: string[] = [
    `# PVL CSV export`,
    `# file=${args.filename}`,
    `# rows=${args.peptideCount}`,
    `# pvl_version=${args.pvlVersion}`,
    `# build_sha=${args.buildSha}`,
    `# generated=${args.timestamp}`,
    `# source=${args.source}`,
  ];
  if (args.query) lines.push(`# query=${args.query}`);
  if (args.datasetHash)
    lines.push(`# dataset_hash=${args.datasetHash.slice(0, 16)}`);
  lines.push(
    `# tango=${args.predictors.tango.label}`,
    `# s4pred=${args.predictors.s4pred.label}`,
    `# threshold_muH_cutoff=${args.thresholds.muHCutoff}`,
    `# threshold_hydro_cutoff=${args.thresholds.hydroCutoff}`,
    `# threshold_tango_pct=${args.thresholds.tangoAggregationThreshold}`,
    `# threshold_min_segment_length=${args.thresholds.minSegmentLength}`,
  );
  return lines.join("\n");
}

interface ProviderState {
  /** "on" / "off" / "partial" / "unavailable" — short label suitable for badge text. */
  label: string;
  /** Variant for the badge component. */
  variant: "default" | "outline" | "secondary" | "destructive";
}

function providerStateFromMeta(
  meta: DatasetMetadata | null | undefined,
  key: "tango" | "s4pred",
): ProviderState {
  const status = meta?.provider_status?.[key]?.status;
  if (status === "AVAILABLE")
    return { label: "ran (all rows)", variant: "default" };
  if (status === "PARTIAL")
    return { label: "ran (partial)", variant: "secondary" };
  if (status === "UNAVAILABLE")
    return { label: "unavailable", variant: "destructive" };
  if (status === "OFF") return { label: "off", variant: "outline" };
  // Fall back to use_* flags if provider_status is missing
  const flag = key === "tango" ? meta?.use_tango : meta?.use_s4pred;
  return flag
    ? { label: "on", variant: "default" }
    : { label: "off", variant: "outline" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CsvExportDialog({
  open,
  onOpenChange,
  filename,
  peptideCount,
  onConfirm,
}: CsvExportDialogProps) {
  const meta = useDatasetStore((s) => s.meta);
  const queryMeta = useReproducibilityStore((s) => s.queryMeta);
  const datasetHash = useReproducibilityStore((s) => s.datasetHash);
  const thresholds = useThresholdStore((s) => s.active);

  const tango = useMemo(() => providerStateFromMeta(meta, "tango"), [meta]);
  const s4pred = useMemo(() => providerStateFromMeta(meta, "s4pred"), [meta]);

  // Use the existing analysis timestamp where possible so reruns of the same
  // analysis produce identical metadata blocks.
  const timestamp = useMemo(
    () => queryMeta?.timestamp ?? new Date().toISOString(),
    [queryMeta?.timestamp],
  );

  const source = useMemo(() => {
    if (queryMeta?.source === "uniprot") return "uniprot";
    if (queryMeta?.source === "single") return "single";
    if (queryMeta?.source === "csv") return "csv";
    if (meta?.source === "uniprot_api") return "uniprot";
    return "csv";
  }, [queryMeta?.source, meta?.source]);

  const metadataText = useMemo(
    () =>
      buildMetadataText({
        filename,
        peptideCount,
        pvlVersion: PVL_VERSION,
        buildSha: BUILD_SHA,
        timestamp,
        source,
        query: queryMeta?.query ?? meta?.query ?? null,
        predictors: { tango, s4pred },
        thresholds,
        datasetHash,
      }),
    [
      filename,
      peptideCount,
      timestamp,
      source,
      queryMeta?.query,
      meta?.query,
      tango,
      s4pred,
      thresholds,
      datasetHash,
    ],
  );

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(metadataText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = metadataText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [metadataText]);

  const handleConfirm = useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="csv-export-dialog"
      >
        <DialogHeader>
          <DialogTitle>Confirm CSV export</DialogTitle>
          <DialogDescription>
            The following analysis metadata will be embedded as comment lines
            (lines starting with <code>#</code>) at the top of{" "}
            <span className="font-mono text-foreground">{filename}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="secondary" className="font-mono">
            v{PVL_VERSION}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {BUILD_SHA.slice(0, 7)}
          </Badge>
          <Badge variant="outline" data-testid="csv-export-row-count">
            {peptideCount.toLocaleString()} rows
          </Badge>
          <Badge
            variant={tango.variant}
            data-testid="csv-export-tango-state"
          >
            TANGO: {tango.label}
          </Badge>
          <Badge
            variant={s4pred.variant}
            data-testid="csv-export-s4pred-state"
          >
            S4PRED: {s4pred.label}
          </Badge>
        </div>

        {/* Metadata block */}
        <pre
          className="text-xs font-mono bg-muted/40 border border-border/60 rounded-md p-3 overflow-x-auto leading-relaxed text-muted-foreground max-h-[260px] overflow-y-auto"
          data-testid="csv-export-metadata"
        >
          {metadataText}
        </pre>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="sm:mr-auto"
            data-testid="csv-export-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
            data-testid="csv-export-copy"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy metadata
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="gap-1.5"
            data-testid="csv-export-confirm"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
