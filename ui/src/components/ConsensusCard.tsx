import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getConsensusSS, type ConsensusResult, type ConsensusTier } from "@/lib/consensus";
import type { Peptide } from "@/types/peptide";

const TIER_COLORS: Record<ConsensusTier, string> = {
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-blue-500",
  4: "bg-green-500",
  5: "bg-muted-foreground",
};

const TIER_TEXT: Record<ConsensusTier, string> = {
  1: "text-red-700",
  2: "text-amber-700",
  3: "text-blue-700",
  4: "text-green-700",
  5: "text-muted-foreground",
};

interface ConsensusCardProps {
  peptide: Peptide;
  aggThreshold?: number;
}

export function ConsensusCard({ peptide, aggThreshold }: ConsensusCardProps) {
  const result: ConsensusResult = getConsensusSS(peptide, aggThreshold);
  const pct = Math.round(result.certainty * 100);

  return (
    <Card className={`${result.color} border-l-4`}>
      <CardContent className="p-4 space-y-3">
        {/* Top: Tier badge + label */}
        <div className="flex items-center gap-3">
          <Badge className={`${TIER_COLORS[result.tier]} text-white text-xs px-2 py-0.5`}>
            Tier {result.tier}
          </Badge>
          <span className={`font-semibold text-sm ${TIER_TEXT[result.tier]}`}>
            {result.label}
          </span>
        </div>

        {/* Middle: Certainty bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Certainty</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${TIER_COLORS[result.tier]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Bottom: Explanation */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {result.explanation}
        </p>

        {/* Tier 5 prompt */}
        {result.tier === 5 && (
          <p className="text-xs text-muted-foreground/70 italic">
            Enable TANGO + S4PRED for consensus analysis.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
