/**
 * Compact inline badge for consensus tier in ranked table rows.
 * Shows tier number + short label + color with tooltip explanation.
 */
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConsensusTier, ConsensusResult } from "@/lib/consensus";

const TIER_DISPLAY: Record<ConsensusTier, { short: string; bg: string; text: string }> = {
  1: {
    short: "Switch Zone",
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-700 dark:text-red-400",
  },
  2: {
    short: "Disordered",
    bg: "bg-amber-100 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-400",
  },
  3: {
    short: "Native Beta",
    bg: "bg-blue-100 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-400",
  },
  4: {
    short: "No Concern",
    bg: "bg-green-100 dark:bg-green-950",
    text: "text-green-700 dark:text-green-400",
  },
  5: { short: "No Data", bg: "bg-muted", text: "text-muted-foreground" },
};

interface ConsensusBadgeProps {
  consensus: ConsensusResult;
}

export function ConsensusBadge({ consensus }: ConsensusBadgeProps) {
  const display = TIER_DISPLAY[consensus.tier];

  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium cursor-help whitespace-nowrap ${display.bg} ${display.text}`}
          >
            <span className="font-bold">T{consensus.tier}</span>
            <span className="hidden sm:inline">{display.short}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          <div className="space-y-1">
            <div className="font-medium text-xs">{consensus.label}</div>
            <p className="text-xs text-muted-foreground">{consensus.explanation}</p>
          </div>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}
