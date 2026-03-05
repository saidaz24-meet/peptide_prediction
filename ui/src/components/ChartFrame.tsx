import { createContext, useContext, useState, useMemo } from "react";
import { Maximize2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { CHART_COLORS } from "@/lib/chartConfig";
import { getConsensusSS } from "@/lib/consensus";
import type { Peptide } from "@/types/peptide";

// ── Context ──

interface ChartFrameContextValue {
  isExpanded: boolean;
}

const ChartFrameContext = createContext<ChartFrameContextValue>({
  isExpanded: false,
});

/** Hook for child charts to read whether they are in expanded (fullscreen) mode. */
export function useChartFrame() {
  return useContext(ChartFrameContext);
}

// ── Types ──

type SortCol = "id" | "length" | "hydrophobicity" | "charge" | "muH" | "tangoAggMax" | "tier";

export interface ChartFrameProps {
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Extra className applied to the expanded dialog's chart area. */
  expandedClassName?: string;
  footer?: React.ReactNode;
  /** Peptides to show in a detail table below the expanded chart. */
  peptides?: Peptide[];
  /** IDs of peptides visible in the zoom window (highlighted + pinned). */
  zoomedIds?: Set<string>;
  /** Default sort column for the detail table (matches chart's primary metric). */
  sortKey?: SortCol;
}

// ── Table helpers ──

const TIER_DOT: Record<number, string> = {
  1: CHART_COLORS.tier1,
  2: CHART_COLORS.tier2,
  3: CHART_COLORS.tier3,
  4: CHART_COLORS.tier4,
  5: CHART_COLORS.tier5,
};

const COL_DEFS: {
  key: SortCol;
  label: string;
  align: "left" | "right" | "center";
  fmt: (p: Peptide, tier: number) => React.ReactNode;
}[] = [
  {
    key: "id",
    label: "ID",
    align: "left",
    fmt: (p) => <span className="font-mono truncate max-w-[140px] inline-block">{p.id}</span>,
  },
  { key: "length", label: "Len", align: "right", fmt: (p) => p.length ?? "–" },
  {
    key: "hydrophobicity",
    label: "Hydro",
    align: "right",
    fmt: (p) => p.hydrophobicity?.toFixed(2) ?? "–",
  },
  {
    key: "charge",
    label: "Charge",
    align: "right",
    fmt: (p) => (p.charge != null ? p.charge.toFixed(1) : "–"),
  },
  {
    key: "muH",
    label: "μH",
    align: "right",
    fmt: (p) => p.muH?.toFixed(2) ?? "–",
  },
  {
    key: "tangoAggMax",
    label: "Agg Max",
    align: "right",
    fmt: (p) => (p.tangoAggMax != null ? p.tangoAggMax.toFixed(1) : "–"),
  },
  {
    key: "tier",
    label: "Tier",
    align: "center",
    fmt: (_p, tier) => (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: TIER_DOT[tier] }}
        title={`Tier ${tier}`}
      />
    ),
  },
];

function getSortValue(p: Peptide, col: SortCol, tier: number): number | string {
  switch (col) {
    case "id":
      return p.id;
    case "length":
      return p.length ?? -Infinity;
    case "hydrophobicity":
      return p.hydrophobicity ?? -Infinity;
    case "charge":
      return p.charge ?? -Infinity;
    case "muH":
      return p.muH ?? -Infinity;
    case "tangoAggMax":
      return p.tangoAggMax ?? -Infinity;
    case "tier":
      return tier;
  }
}

// ── Context values (stable references) ──

const COLLAPSED_CTX: ChartFrameContextValue = { isExpanded: false };
const EXPANDED_CTX: ChartFrameContextValue = { isExpanded: true };

// ── Component ──

/**
 * Wraps a chart card with an expand button that opens a full-screen dialog.
 *
 * Provides ChartFrameContext so child charts can read `isExpanded` to
 * switch between fixed-height card mode and responsive expanded mode.
 *
 * When `peptides` is provided, the expanded dialog splits into a resizable
 * chart (top) + sortable table (bottom) with a draggable divider.
 */
export function ChartFrame({
  title,
  description,
  headerRight,
  children,
  className,
  expandedClassName,
  footer,
  peptides,
  zoomedIds,
  sortKey,
}: ChartFrameProps) {
  const [open, setOpen] = useState(false);
  const { selectedId, select } = useChartSelection();

  const [sortCol, setSortCol] = useState<SortCol>(sortKey ?? "id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(sortKey ? "desc" : "asc");

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "id" ? "asc" : "desc");
    }
  };

  const sortedPeptides = useMemo(() => {
    if (!peptides) return [];
    const withTier = peptides.map((p) => ({
      p,
      tier: getConsensusSS(p).tier,
    }));
    withTier.sort((a, b) => {
      const aZ = zoomedIds?.has(a.p.id) ? 0 : 1;
      const bZ = zoomedIds?.has(b.p.id) ? 0 : 1;
      if (aZ !== bZ) return aZ - bZ;
      const aV = getSortValue(a.p, sortCol, a.tier);
      const bV = getSortValue(b.p, sortCol, b.tier);
      if (typeof aV === "string" && typeof bV === "string") {
        return sortDir === "asc" ? aV.localeCompare(bV) : bV.localeCompare(aV);
      }
      const diff = (aV as number) - (bV as number);
      return sortDir === "asc" ? diff : -diff;
    });
    return withTier;
  }, [peptides, zoomedIds, sortCol, sortDir]);

  const hasTable = peptides && peptides.length > 0;

  return (
    <>
      {/* Card mode — isExpanded: false */}
      <Card className={`shadow-medium ${className ?? ""}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <div className="flex items-center gap-2">
              {headerRight}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(true)}
                title="Expand chart"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartFrameContext.Provider value={COLLAPSED_CTX}>{children}</ChartFrameContext.Provider>
          {footer}
        </CardContent>
      </Card>

      {/* Expanded dialog — isExpanded: true */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[92vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="flex-1 min-h-0 px-6 pb-2">
            <ChartFrameContext.Provider value={EXPANDED_CTX}>
              {hasTable ? (
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={62} minSize={25}>
                    <div className="relative h-full w-full">
                      <div className={`absolute inset-0 chart-expanded ${expandedClassName ?? ""}`}>
                        {children}
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={38} minSize={15}>
                    <div className="h-full overflow-auto pt-2">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-background border-b z-10">
                          <tr>
                            {COL_DEFS.map((col) => (
                              <th
                                key={col.key}
                                className={`py-1.5 px-2 font-medium cursor-pointer select-none
                                  hover:bg-muted/50 transition-colors
                                  ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                                onClick={() => handleSort(col.key)}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {col.label}
                                  {col.key === sortCol ? (
                                    sortDir === "asc" ? (
                                      <ArrowUp className="h-3 w-3" />
                                    ) : (
                                      <ArrowDown className="h-3 w-3" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                                  )}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPeptides.map(({ p, tier }) => {
                            const isZoomed = zoomedIds?.has(p.id);
                            const isSelected = p.id === selectedId;
                            return (
                              <tr
                                key={p.id}
                                className={`border-b cursor-pointer transition-colors hover:bg-muted/40
                                  ${isZoomed ? "bg-primary/5 font-medium" : ""}
                                  ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                                onClick={() => {
                                  setOpen(false);
                                  select(p.id, title);
                                }}
                              >
                                {COL_DEFS.map((col) => (
                                  <td
                                    key={col.key}
                                    className={`py-1 px-2
                                      ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}
                                  >
                                    {col.fmt(p, tier)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="relative h-full w-full">
                  <div className={`absolute inset-0 chart-expanded ${expandedClassName ?? ""}`}>
                    {children}
                  </div>
                </div>
              )}
            </ChartFrameContext.Provider>
          </div>

          {footer && <div className="px-6 pb-4 pt-2 border-t shrink-0">{footer}</div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
