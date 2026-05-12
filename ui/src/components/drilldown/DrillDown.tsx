/**
 * DrillDown slide-over inspector.
 *
 * Design philosophy: a single right-side panel that any chart, KPI card,
 * or metric hover can launch for deep inspection. Built on shadcn Sheet
 * with framer-motion enter/exit. Content is mode-driven: metric, peptide,
 * or chart inspection.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Share2, Download } from "lucide-react";
import { toast } from "sonner";
import { getMetric } from "@/lib/metricRegistry";
import { useDatasetStore } from "@/stores/datasetStore";
import { findSimilarPeptides, type SimilarPeptideHit } from "@/lib/api";
import { useDrillDown } from "./DrillDownProvider";
import { MetricInspector } from "./MetricInspector";
import { PeptideInspector } from "./PeptideInspector";
import { ChartInspector } from "./ChartInspector";
import { SimilarPeptidesInspector } from "./SimilarPeptidesInspector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTitle(
  mode: "metric" | "chart" | "peptide" | "similar" | null,
  metricId: string | null,
  peptideId: string | null
): string {
  if (mode === "metric" && metricId) {
    return getMetric(metricId)?.name ?? metricId;
  }
  if (mode === "chart" && metricId) {
    return getMetric(metricId)?.name ?? "Chart Inspector";
  }
  if (mode === "peptide" && peptideId) {
    return `Peptide: ${peptideId}`;
  }
  if (mode === "similar" && peptideId) {
    return `Similar to: ${peptideId}`;
  }
  return "Inspector";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrillDown() {
  const { state, close } = useDrillDown();
  const navigate = useNavigate();
  const { isOpen, mode, metricId, peptideId } = state;
  const referencePeptide = useDatasetStore((s) =>
    peptideId ? s.getPeptideById(peptideId) : undefined
  );

  // ── Similar-peptides API call (G.3) ────────────────────────────
  // Local to the drill-down so closing the panel cancels in-flight requests
  // and re-opening a fresh reference re-fires the search.
  const [similarHits, setSimilarHits] = useState<SimilarPeptideHit[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const similarMethodRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSimilarSearch = useCallback((refId: string) => {
    // Cancel any prior request before kicking off a new one.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setSimilarLoading(true);
    setSimilarError(null);
    setSimilarHits(null);
    similarMethodRef.current = null;

    findSimilarPeptides(refId, 10, undefined, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        similarMethodRef.current = res.method;
        setSimilarHits(res.results);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to find similar peptides";
        setSimilarError(message);
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setSimilarLoading(false);
      });
  }, []);

  useEffect(() => {
    if (mode === "similar" && peptideId) {
      runSimilarSearch(peptideId);
    } else {
      // Clear when we leave similar mode so a future open starts clean.
      abortRef.current?.abort();
      abortRef.current = null;
      setSimilarHits(null);
      setSimilarError(null);
      setSimilarLoading(false);
      similarMethodRef.current = null;
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [mode, peptideId, runSimilarSearch]);

  // ── Row click → navigate + close ──────────────────────────────
  const handleSelectPeptide = useCallback(
    (id: string) => {
      navigate(`/peptides/${encodeURIComponent(id)}`);
      close();
    },
    [navigate, close]
  );

  // ── Compare → /compare?ids=ref,r1,r2,... ──────────────────────
  const handleCompare = useCallback(
    (selectedIds: string[]) => {
      if (!peptideId) return;
      const ids = [peptideId, ...selectedIds.filter((id) => id !== peptideId)];
      navigate(`/compare?ids=${ids.map(encodeURIComponent).join(",")}`);
      close();
    },
    [navigate, close, peptideId]
  );

  // ── Export CSV of similarity result set ───────────────────────
  const handleExportSimilarCSV = useCallback(() => {
    if (!referencePeptide || !similarHits || similarHits.length === 0) {
      toast.error("Nothing to export yet — wait for results to load.");
      return;
    }
    const header = [
      "rank",
      "accession",
      "sequence",
      "distance",
      "length",
      "muH",
      "hydrophobicity",
      "s4predHelixPrediction",
      "ffHelixFlag",
      "sswPrediction",
      "ffSswFlag",
    ];
    const escape = (val: unknown): string => {
      const s = val === null || val === undefined ? "" : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = similarHits.map((hit, i) => {
      const p = hit.peptide;
      return [
        i + 1,
        p.id,
        p.sequence,
        hit.distance.toFixed(6),
        p.length ?? "",
        p.muH ?? "",
        p.hydrophobicity ?? "",
        p.s4predHelixPrediction ?? "",
        p.ffHelixFlag ?? "",
        p.sswPrediction ?? "",
        p.ffSswFlag ?? "",
      ]
        .map(escape)
        .join(",");
    });
    // Provenance comment lines (CSV `#` is non-standard but well-tolerated;
    // tools like Excel ignore them, pandas accepts via `comment="#"`).
    const provenance = [
      `# PVL similarity export`,
      `# reference=${referencePeptide.id}`,
      `# method=${similarMethodRef.current ?? "unknown"}`,
      `# k=${similarHits.length}`,
      `# generated=${new Date().toISOString()}`,
    ];
    const csv = [...provenance, header.join(","), ...rows].join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${referencePeptide.id}_similar.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${similarHits.length} similar peptides`);
  }, [referencePeptide, similarHits]);

  const handleRetrySimilar = useCallback(() => {
    if (peptideId) runSimilarSearch(peptideId);
  }, [peptideId, runSimilarSearch]);

  // Copy shareable URL to clipboard
  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {
      // Clipboard write failed silently
    });
  }, []);

  // Keyboard: Esc handled natively by Sheet (Radix Dialog)

  const title = resolveTitle(mode, metricId, peptideId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[560px] sm:max-w-[560px] flex flex-col p-0 gap-0"
      >
        {/* ---- Header ---- */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4 space-y-0">
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-semibold truncate">{title}</SheetTitle>
            <SheetDescription className="sr-only">
              Deep inspection panel for {title}
            </SheetDescription>
          </div>

          <div className="flex items-center gap-1 ml-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              aria-label="Copy share link"
              className="h-8 w-8"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {/* Note: SheetContent renders a built-in close X in the top-right
                corner — do not add a second close button here. */}
          </div>
        </SheetHeader>

        {/* ---- Content ----
            Chart mode owns its own scroll/layout (chart fills view, table
            peeks from bottom — Said B.3); other modes use the standard
            padded scroll container. */}
        {mode === "chart" && metricId ? (
          <div className="flex-1 min-h-0">
            <ChartInspector metricId={metricId} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {mode === "metric" && metricId && (
              <MetricInspector metricId={metricId} peptideId={peptideId} />
            )}
            {mode === "peptide" && peptideId && <PeptideInspector peptideId={peptideId} />}
            {mode === "similar" && peptideId && referencePeptide && (
              <SimilarPeptidesInspector
                reference={referencePeptide}
                results={similarHits ?? undefined}
                isLoading={similarLoading}
                error={similarError}
                onRetry={handleRetrySimilar}
                onSelectPeptide={handleSelectPeptide}
                onCompare={handleCompare}
                onExport={handleExportSimilarCSV}
              />
            )}
            {mode === "similar" && peptideId && !referencePeptide && (
              <div className="text-sm text-muted-foreground">
                Peptide not found: <code>{peptideId}</code>
              </div>
            )}
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="border-t border-border px-6 py-3 flex items-center gap-2">
          {/* TODO: Wire export handlers for SVG and CSV */}
          <Button variant="outline" size="sm" disabled className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            SVG
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
