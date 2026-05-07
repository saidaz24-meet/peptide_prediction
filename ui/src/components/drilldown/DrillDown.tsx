/**
 * DrillDown slide-over inspector.
 *
 * Design philosophy: a single right-side panel that any chart, KPI card,
 * or metric hover can launch for deep inspection. Built on shadcn Sheet
 * with framer-motion enter/exit. Content is mode-driven: metric, peptide,
 * or chart inspection.
 */

import { useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, Share2, Download } from "lucide-react";
import { getMetric } from "@/lib/metricRegistry";
import { useDrillDown } from "./DrillDownProvider";
import { MetricInspector } from "./MetricInspector";
import { PeptideInspector } from "./PeptideInspector";
import { ChartInspector } from "./ChartInspector";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTitle(
  mode: "metric" | "chart" | "peptide" | null,
  metricId: string | null,
  peptideId: string | null,
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
  return "Inspector";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrillDown() {
  const { state, close } = useDrillDown();
  const { isOpen, mode, metricId, peptideId } = state;

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
            <SheetTitle className="text-base font-semibold truncate">
              {title}
            </SheetTitle>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="Close inspector"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
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
            {mode === "peptide" && peptideId && (
              <PeptideInspector peptideId={peptideId} />
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
