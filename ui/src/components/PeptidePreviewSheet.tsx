/**
 * Side sheet for quick peptide preview when clicking chart dots.
 *
 * Replaces the floating PeptideMiniCard with a richer preview that
 * shows KPIs, consensus tier, classification flags, and a link to
 * the full PeptideDetail page.
 */

import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChartSelection } from "@/stores/chartSelectionStore";
import { useDatasetStore } from "@/stores/datasetStore";
import { getConsensusSS, type ConsensusTier } from "@/lib/consensus";
import { CHART_COLORS } from "@/lib/chartConfig";

const TIER_BG: Record<ConsensusTier, string> = {
  1: "bg-red-50 border-red-200",
  2: "bg-amber-50 border-amber-200",
  3: "bg-blue-50 border-blue-200",
  4: "bg-green-50 border-green-200",
  5: "bg-muted/50 border-muted",
};

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded bg-muted/40">
      <div className="font-semibold text-sm">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function PeptidePreviewSheet() {
  const navigate = useNavigate();
  const { selectedId, selectedFrom, sheetOpen, setSheetOpen, setActiveTab } =
    useChartSelection();
  const { getPeptideById } = useDatasetStore();

  const peptide = selectedId ? getPeptideById(selectedId) : undefined;

  const handleOpenDetail = () => {
    if (!peptide) return;
    setActiveTab("charts");
    setSheetOpen(false);
    navigate(`/peptides/${encodeURIComponent(peptide.id)}`);
  };

  if (!peptide) {
    return (
      <Sheet open={sheetOpen && !!selectedId} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[340px] sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle>Peptide not found</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const consensus = getConsensusSS(peptide);
  const tierColor =
    CHART_COLORS[`tier${consensus.tier}` as keyof typeof CHART_COLORS];
  const truncSeq =
    peptide.sequence.length > 80
      ? peptide.sequence.slice(0, 77) + "..."
      : peptide.sequence;

  const fmt = (v: number | null | undefined, d = 2) =>
    v != null ? v.toFixed(d) : "\u2013";
  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(1)}%` : "\u2013";
  const fmtSSW = (v: number | null | undefined) =>
    v === 1 ? "+1" : v === -1 ? "-1" : "\u2013";

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-[340px] sm:max-w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base truncate pr-6">
            {peptide.id}
          </SheetTitle>
          <SheetDescription>
            {selectedFrom && (
              <span className="text-xs">From: {selectedFrom}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Sequence */}
          <div className="p-2 rounded bg-muted/30 font-mono text-[11px] break-all leading-relaxed">
            {truncSeq}
          </div>

          {/* Species */}
          {peptide.species && (
            <div className="text-xs text-muted-foreground">
              Organism: {peptide.species}
            </div>
          )}

          {/* Consensus tier */}
          <div className={`p-3 rounded border ${TIER_BG[consensus.tier]}`}>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className="text-[10px] text-white px-1.5 py-0"
                style={{ backgroundColor: tierColor }}
              >
                T{consensus.tier}
              </Badge>
              <span className="text-sm font-medium">{consensus.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {consensus.explanation}
            </p>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2">
            <KpiTile label="Hydrophobicity" value={fmt(peptide.hydrophobicity)} />
            <KpiTile label="Charge" value={fmt(peptide.charge, 1)} />
            <KpiTile label="\u03BCH" value={fmt(peptide.muH)} />
            <KpiTile label="FF-Helix %" value={fmtPct(peptide.ffHelixPercent)} />
            <KpiTile label="Agg Max" value={fmtPct(peptide.tangoAggMax)} />
            <KpiTile label="S4PRED Helix %" value={fmtPct(peptide.s4predHelixPercent)} />
            <KpiTile label="SSW (TANGO)" value={fmtSSW(peptide.sswPrediction)} />
            <KpiTile label="SSW (S4PRED)" value={fmtSSW(peptide.s4predSswPrediction)} />
          </div>

          {/* Classification flags */}
          <div className="flex flex-wrap gap-2">
            {peptide.ffSswFlag != null && (
              <Badge variant={peptide.ffSswFlag === 1 ? "default" : "secondary"}>
                FF-SSW: {peptide.ffSswFlag === 1 ? "Candidate" : "Not candidate"}
              </Badge>
            )}
            {peptide.ffHelixFlag != null && (
              <Badge variant={peptide.ffHelixFlag === 1 ? "default" : "secondary"}>
                FF-Helix: {peptide.ffHelixFlag === 1 ? "Candidate" : "Not candidate"}
              </Badge>
            )}
          </div>

          {/* Open full detail */}
          <Button
            className="w-full"
            onClick={handleOpenDetail}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Full Detail
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
