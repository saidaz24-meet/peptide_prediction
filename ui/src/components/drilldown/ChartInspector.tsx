/**
 * ChartInspector — drill-down content for chart mode.
 *
 * Layout (B.3 — Said 2026-05-07):
 *   ┌──────────────────────────────────────────┐
 *   │ Chart fills the view                     │  flex-1, scrollable
 *   │ + scientific notes / threshold copy      │
 *   ├── drag-handle (resizable) ───────────────┤
 *   │ Peptide table peeks from the bottom      │  height = state, drag/keyboard
 *   └──────────────────────────────────────────┘
 *
 * The previous behavior was inverted (table dominant, chart cropped). Now the
 * chart + its descriptive text are the primary surface; the table starts
 * compact at the bottom and the user pulls it up with the drag handle (or
 * presses `T` to toggle between collapsed / expanded).
 *
 * On mobile (≤640px) the table collapses to a chip ("Peptides (N) →") that
 * opens a full-screen overlay when tapped.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMetric } from "@/lib/metricRegistry";
import { useDatasetStore } from "@/stores/datasetStore";
import { useDrillDown } from "./DrillDownProvider";

interface ChartInspectorProps {
  metricId: string;
}

const TABLE_DEFAULT_HEIGHT = 280;
const TABLE_COLLAPSED_HEIGHT = 100;
const TABLE_MIN_HEIGHT = 100;
// 70vh is the spec maximum. Computed at drag time off window.innerHeight.

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

export function ChartInspector({ metricId }: ChartInspectorProps) {
  const metric = getMetric(metricId);
  const peptides = useDatasetStore((s) => s.peptides);
  const { open } = useDrillDown();

  const [tableHeight, setTableHeight] = useState<number>(TABLE_DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  // Keep mobile flag in sync with viewport so layout responds to rotation.
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = tableHeight;
    },
    [tableHeight],
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const delta = dragStartY.current - e.clientY;
      const next = dragStartHeight.current + delta;
      const max = Math.round(window.innerHeight * 0.7);
      setTableHeight(Math.min(max, Math.max(TABLE_MIN_HEIGHT, next)));
    },
    [isDragging],
  );

  const onDragEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      setIsDragging(false);
    },
    [],
  );

  // Keyboard `T` toggles collapsed (100px) vs expanded (60vh).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "t" && e.key !== "T") return;
      // Ignore when typing in inputs / textareas.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const expanded = Math.round(window.innerHeight * 0.6);
      setTableHeight((h) =>
        h <= TABLE_COLLAPSED_HEIGHT + 5 ? expanded : TABLE_COLLAPSED_HEIGHT,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sort peptides by metric value desc (for "top hits" relevance).
  const sortedPeptides = useMemo(() => {
    if (!metric) return [];
    const withVal = peptides
      .map((p) => ({ p, v: metric.getValue(p) }))
      .filter((row): row is { p: (typeof peptides)[number]; v: number } =>
        typeof row.v === "number" && Number.isFinite(row.v),
      );
    withVal.sort((a, b) => b.v - a.v);
    return withVal;
  }, [peptides, metric]);

  if (!metric) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-6">
        Unknown metric: <code>{metricId}</code>
      </div>
    );
  }

  // ── Table content (shared between bottom dock and mobile overlay) ──────
  const tableNode = (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
        <tr className="border-b border-border">
          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
            Peptide
          </th>
          <th className="text-right px-3 py-2 font-medium text-muted-foreground">
            {metric.shortName ?? metric.name}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedPeptides.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
              No peptides have a value for this metric.
            </td>
          </tr>
        ) : (
          sortedPeptides.map(({ p, v }) => (
            <tr
              key={p.id}
              className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => open({ peptide: p.id, mode: "peptide" })}
            >
              <td className="px-3 py-1.5 font-mono">{p.id}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {metric.format(v)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full" data-testid="chart-inspector">
      {/* Chart + notes — fills remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4" data-testid="chart-inspector-chart">
        <div>
          <h3 className="text-base font-semibold">{metric.name}</h3>
          {metric.unit && (
            <p className="text-xs text-muted-foreground mt-0.5">{metric.unit}</p>
          )}
        </div>

        {/* Placeholder chart surface — concrete chart wires in here later. */}
        <div className="rounded-lg border border-dashed border-border bg-muted/20 h-64 flex items-center justify-center text-sm text-muted-foreground">
          Full chart view coming soon
        </div>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Definition
          </h4>
          <p className="text-sm leading-relaxed">{metric.definition}</p>
        </section>

        {metric.interpretation && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Interpretation
            </h4>
            <p className="text-sm leading-relaxed">{metric.interpretation}</p>
          </section>
        )}

      </div>

      {/* Mobile: collapsed chip — opens full-screen overlay on tap. */}
      {isMobile ? (
        <>
          <button
            onClick={() => setMobileOverlayOpen(true)}
            className="border-t border-border px-4 py-3 flex items-center justify-between text-sm bg-card hover:bg-muted/40 transition-colors"
            data-testid="chart-inspector-mobile-chip"
          >
            <span className="font-medium">
              Peptides ({sortedPeptides.length})
            </span>
            <span className="text-muted-foreground">→</span>
          </button>
          {mobileOverlayOpen && (
            <div className="fixed inset-0 z-[80] bg-background flex flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-semibold text-sm">
                  Peptides ({sortedPeptides.length})
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOverlayOpen(false)}
                  aria-label="Close peptide table"
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">{tableNode}</div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Drag handle — pointer events so it works under touch + mouse. */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize peptide table"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="h-1.5 border-t border-border bg-card hover:bg-muted/60 cursor-row-resize flex items-center justify-center select-none"
            style={{ touchAction: "none" }}
            data-testid="chart-inspector-drag-handle"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground/60" />
          </div>

          {/* Peptide table dock */}
          <div
            className="overflow-y-auto bg-card/40"
            style={{
              height: tableHeight,
              transition: isDragging ? "none" : "height 150ms ease-out",
            }}
            data-testid="chart-inspector-table"
          >
            {tableNode}
          </div>
        </>
      )}
    </div>
  );
}
