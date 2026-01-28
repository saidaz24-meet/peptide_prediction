import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProviderStats {
  requested: number;
  parsed_ok: number;
  parsed_bad: number;
}

interface ProviderStatus {
  status: 'OFF' | 'UNAVAILABLE' | 'PARTIAL' | 'AVAILABLE';
  reason?: string | null;
  stats?: ProviderStats;
}

interface ProviderBadgeProps {
  name: string;
  status: ProviderStatus;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}

export function ProviderBadge({ name, status, variant = 'default' }: ProviderBadgeProps) {
  const { status: providerStatus, reason, stats } = status;
  
  let label: string;
  let badgeVariant: 'default' | 'outline' | 'secondary' | 'destructive' = variant;
  let tooltipText: string;
  
  if (providerStatus === 'OFF') {
    label = `${name}: OFF`;
    badgeVariant = 'outline';
    tooltipText = reason || `${name} is disabled in settings`;
  } else if (providerStatus === 'UNAVAILABLE') {
    const requested = stats?.requested || 0;
    label = `${name}: FAILED (0/${requested})`;
    badgeVariant = 'destructive';
    tooltipText = reason || `${name} output not available`;
  } else if (providerStatus === 'PARTIAL') {
    const parsed_ok = stats?.parsed_ok || 0;
    const requested = stats?.requested || 0;
    label = `${name}: PARTIAL (${parsed_ok}/${requested})`;
    badgeVariant = 'secondary';
    tooltipText = reason || `Only ${parsed_ok} of ${requested} sequences processed successfully`;
  } else if (providerStatus === 'AVAILABLE') {
    const requested = stats?.requested || 0;
    label = `${name}: ON (${requested}/${requested})`;
    badgeVariant = 'default';
    tooltipText = `${name} processing completed successfully`;
  } else {
    label = `${name}: UNKNOWN`;
    badgeVariant = 'outline';
    tooltipText = `${name} status unknown`;
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

