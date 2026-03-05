/**
 * TangoBadge - Consistent Tango status display
 *
 * Uses tangoDisplaySemantics to ensure consistent display across the UI.
 * This is the ONLY component that should render SSW prediction badges.
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, Info, AlertTriangle, Minus } from 'lucide-react';
import {
  getTangoDisplayState,
  getTangoDisplayProps,
  type ProviderStatusInfo,
  type SswContext,
} from '@/lib/tangoDisplaySemantics';

interface TangoBadgeProps {
  providerStatus: ProviderStatusInfo | undefined;
  sswPrediction: number | null | undefined;
  /** Whether Tango data (curves) exist, even if sswPrediction is null */
  hasTangoData?: boolean;
  showIcon?: boolean;
  /** Optional SSW context for richer negative-prediction tooltips */
  sswContext?: SswContext;
}

/**
 * Display a Tango SSW prediction badge with consistent semantics.
 *
 * Rules:
 * - OFF/disabled/not_configured → "Off" (outline)
 * - UNAVAILABLE → "Failed" (destructive)
 * - PARTIAL + null → "Missing" (outline)
 * - AVAILABLE + 1 → "Positive" (green)
 * - AVAILABLE + -1 → "Negative" (secondary)
 * - AVAILABLE + 0 or (null with data) → "Uncertain" (outline)
 */
export function TangoBadge({ providerStatus, sswPrediction, hasTangoData = false, showIcon = true, sswContext }: TangoBadgeProps) {
  const state = getTangoDisplayState(providerStatus, sswPrediction, hasTangoData, sswContext);
  const props = getTangoDisplayProps(state);

  const Icon = showIcon
    ? props.icon === 'check'
      ? CheckCircle
      : props.icon === 'x'
      ? XCircle
      : props.icon === 'alert'
      ? AlertTriangle
      : props.icon === 'minus'
      ? Minus
      : props.icon === 'info'
      ? Info
      : null
    : null;

  // Map variant to Badge variant + custom class for positive
  const badgeVariant = props.variant;
  const isPositive = state.type === 'positive';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge
              variant={badgeVariant}
              className={isPositive ? 'bg-chameleon-positive text-white hover:bg-chameleon-positive/90' : ''}
            >
              {Icon && <Icon className="w-3 h-3 mr-1" />}
              {props.label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{props.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TangoBadge;
