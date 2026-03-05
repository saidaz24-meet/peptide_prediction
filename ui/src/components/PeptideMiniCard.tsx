/**
 * Floating mini-card shown when a peptide is selected from a chart.
 *
 * Shows KPIs, consensus tier, and a "View Detail" button that navigates
 * to PeptideDetail while preserving back-navigation context.
 */

import { X, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConsensusSS } from "@/lib/consensus";
import { CHART_COLORS } from "@/lib/chartConfig";
import { useChartSelection } from "@/stores/chartSelectionStore";
import type { Peptide } from "@/types/peptide";

const TIER_BG: Record<number, string> = {
  1: "bg-red-50 border-red-200",
  2: "bg-amber-50 border-amber-200",
  3: "bg-blue-50 border-blue-200",
  4: "bg-green-50 border-green-200",
  5: "bg-muted/50 border-muted",
};

interface PeptideMiniCardProps {
  peptide: Peptide;
}

export function PeptideMiniCard({ peptide }: PeptideMiniCardProps) {
  const navigate = useNavigate();
  const { clearSelection, selectedFrom } = useChartSelection();
  const consensus = getConsensusSS(peptide);

  return (
    <Card className={`border shadow-lg ${TIER_BG[consensus.tier] ?? ""}`}>
      <CardContent className="p-3 space-y-2">
        {/* Header: ID + close */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold truncate">
            {peptide.id}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="font-semibold">
              {peptide.hydrophobicity?.toFixed(2) ?? "–"}
            </div>
            <div className="text-muted-foreground">Hydro</div>
          </div>
          <div>
            <div className="font-semibold">
              {peptide.charge != null
                ? `${peptide.charge > 0 ? "+" : ""}${peptide.charge.toFixed(1)}`
                : "–"}
            </div>
            <div className="text-muted-foreground">Charge</div>
          </div>
          <div>
            <div className="font-semibold">
              {peptide.muH?.toFixed(2) ?? "–"}
            </div>
            <div className="text-muted-foreground">μH</div>
          </div>
        </div>

        {/* Consensus tier */}
        <div className="flex items-center gap-2">
          <Badge
            className="text-[10px] text-white px-1.5 py-0"
            style={{ backgroundColor: CHART_COLORS[`tier${consensus.tier}` as keyof typeof CHART_COLORS] }}
          >
            T{consensus.tier}
          </Badge>
          <span className="text-[11px] text-muted-foreground truncate">
            {consensus.label}
          </span>
        </div>

        {/* Navigate to detail */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => navigate(`/peptides/${encodeURIComponent(peptide.id)}`)}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View Detail
        </Button>
      </CardContent>
    </Card>
  );
}
