/**
 * ProviderBadge - Display provider run status in header/summary context
 *
 * Uses consistent semantics with status normalization:
 * - OFF/disabled/not_configured → "Name: OFF" (outline)
 * - UNAVAILABLE/unavailable → "Name: FAILED (0/N)" (destructive)
 * - PARTIAL/partial/running → "Name: PARTIAL (M/N)" (secondary)
 * - AVAILABLE/available → "Name: OK (N/N)" (default)
 */

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeProviderStatus } from "@/lib/tangoDisplaySemantics";

interface ProviderStats {
  requested: number;
  parsed_ok: number;
  parsed_bad: number;
}

interface ProviderStatus {
  status: string; // Accept any string, we'll normalize it
  reason?: string | null;
  stats?: ProviderStats;
}

interface ProviderBadgeProps {
  name: string;
  status: ProviderStatus;
  variant?: "default" | "outline" | "secondary" | "destructive";
}

export function ProviderBadge({ name, status, variant = "default" }: ProviderBadgeProps) {
  const { status: rawStatus, reason, stats } = status;
  const normalizedStatus = normalizeProviderStatus(rawStatus);

  let label: string;
  let badgeVariant: "default" | "outline" | "secondary" | "destructive" = variant;
  let tooltipText: string;

  if (normalizedStatus === "OFF") {
    label = `${name}: OFF`;
    badgeVariant = "outline";
    tooltipText = reason || `${name} is disabled in settings`;
  } else if (normalizedStatus === "UNAVAILABLE") {
    const requested = stats?.requested || 0;
    label = requested > 0 ? `${name}: Unavailable (0/${requested})` : `${name}: Unavailable`;
    badgeVariant = "secondary";
    tooltipText = reason || `${name} could not run — check tool configuration`;
  } else if (normalizedStatus === "PARTIAL") {
    const parsed_ok = stats?.parsed_ok || 0;
    const requested = stats?.requested || 0;
    label = requested > 0 ? `${name}: PARTIAL (${parsed_ok}/${requested})` : `${name}: PARTIAL`;
    badgeVariant = "secondary";
    tooltipText = reason || `Only ${parsed_ok} of ${requested} peptides processed`;
  } else if (normalizedStatus === "AVAILABLE") {
    const parsed_ok = stats?.parsed_ok || stats?.requested || 0;
    const requested = stats?.requested || 0;
    label = requested > 0 ? `${name}: OK (${parsed_ok}/${requested})` : `${name}: OK`;
    badgeVariant = "default";
    tooltipText = `${name} processing completed successfully`;
  } else {
    // Unknown status - show raw value for debugging
    label = `${name}: UNKNOWN`;
    badgeVariant = "outline";
    tooltipText = `${name} status unknown (raw: "${rawStatus}") - check backend logs`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge variant={badgeVariant}>{label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
