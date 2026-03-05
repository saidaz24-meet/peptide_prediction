/**
 * S4PredBadge - Consistent S4PRED status display
 *
 * Uses similar display semantics to TangoBadge for consistent UI.
 * This is the component for rendering S4PRED SSW prediction badges.
 */

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, Info, AlertTriangle, Minus } from "lucide-react";
import type { SingleProviderStatus } from "@/types/peptide";

interface S4PredBadgeProps {
  providerStatus: SingleProviderStatus | undefined;
  sswPrediction: number | null | undefined;
  /** Whether S4PRED data (curves) exist, even if sswPrediction is null */
  hasS4PredData?: boolean;
  showIcon?: boolean;
}

type DisplayState = {
  type: "positive" | "negative" | "uncertain" | "missing" | "failed" | "off";
  reason?: string;
};

function getS4PredDisplayState(
  providerStatus: SingleProviderStatus | undefined,
  sswPrediction: number | null | undefined,
  hasS4PredData: boolean
): DisplayState {
  // Check provider status first
  if (providerStatus) {
    const status = providerStatus.status;

    if (status === "OFF") {
      return { type: "off", reason: providerStatus.reason || "S4PRED is disabled" };
    }

    if (status === "UNAVAILABLE") {
      return { type: "failed", reason: providerStatus.reason || "S4PRED failed to run" };
    }

    // PARTIAL or AVAILABLE - check the prediction value
    if (sswPrediction === 1) {
      return { type: "positive" };
    }
    if (sswPrediction === -1) {
      return { type: "negative" };
    }
    if (sswPrediction === 0 || (sswPrediction === null && hasS4PredData)) {
      return { type: "uncertain" };
    }
    if (sswPrediction === null) {
      return { type: "missing", reason: "No S4PRED prediction available" };
    }
  }

  // No provider status - use legacy logic based on prediction value
  if (sswPrediction === 1) {
    return { type: "positive" };
  }
  if (sswPrediction === -1) {
    return { type: "negative" };
  }
  if (sswPrediction === 0) {
    return { type: "uncertain" };
  }

  // Null prediction with data means uncertain, without data means missing
  if (hasS4PredData) {
    return { type: "uncertain" };
  }

  return { type: "off", reason: "S4PRED not available" };
}

type DisplayProps = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: "check" | "x" | "alert" | "minus" | "info" | null;
  tooltip: string;
};

function getS4PredDisplayProps(state: DisplayState): DisplayProps {
  switch (state.type) {
    case "positive":
      return {
        label: "SSW",
        variant: "default",
        icon: "check",
        tooltip: "S4PRED predicts secondary structure switch",
      };
    case "negative":
      return {
        label: "No SSW",
        variant: "secondary",
        icon: "x",
        tooltip: "S4PRED predicts no secondary structure switch",
      };
    case "uncertain":
      return {
        label: "SSW?",
        variant: "outline",
        icon: "alert",
        tooltip: "S4PRED prediction uncertain",
      };
    case "missing":
      return {
        label: "N/A",
        variant: "outline",
        icon: "minus",
        tooltip: state.reason || "S4PRED prediction missing",
      };
    case "failed":
      return {
        label: "Failed",
        variant: "destructive",
        icon: "alert",
        tooltip: state.reason || "S4PRED failed",
      };
    case "off":
      return {
        label: "Off",
        variant: "outline",
        icon: "info",
        tooltip: state.reason || "S4PRED is disabled",
      };
  }
}

/**
 * Display an S4PRED SSW prediction badge with consistent semantics.
 *
 * Rules:
 * - OFF/disabled/not_configured -> "Off" (outline)
 * - UNAVAILABLE -> "Failed" (destructive)
 * - PARTIAL + null -> "N/A" (outline)
 * - AVAILABLE + 1 -> "SSW" (green)
 * - AVAILABLE + -1 -> "No SSW" (secondary)
 * - AVAILABLE + 0 or (null with data) -> "SSW?" (outline)
 */
export function S4PredBadge({
  providerStatus,
  sswPrediction,
  hasS4PredData = false,
  showIcon = true,
}: S4PredBadgeProps) {
  const state = getS4PredDisplayState(providerStatus, sswPrediction, hasS4PredData);
  const props = getS4PredDisplayProps(state);

  const Icon = showIcon
    ? props.icon === "check"
      ? CheckCircle
      : props.icon === "x"
        ? XCircle
        : props.icon === "alert"
          ? AlertTriangle
          : props.icon === "minus"
            ? Minus
            : props.icon === "info"
              ? Info
              : null
    : null;

  // Map variant to Badge variant + custom class for positive
  const badgeVariant = props.variant;
  const isPositive = state.type === "positive";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge
              variant={badgeVariant}
              className={isPositive ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
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

export default S4PredBadge;
