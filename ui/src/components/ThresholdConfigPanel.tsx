/**
 * Shared threshold configuration panel.
 *
 * Used by Upload.tsx and QuickAnalyze.tsx for pre-submission threshold
 * selection. Supports collapsible (details) and inline variants.
 */
import { AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ThresholdConfigPanelProps {
  thresholdMode: "default" | "recommended" | "custom";
  onModeChange: (mode: "default" | "recommended" | "custom") => void;
  customThresholds: {
    muHCutoff: number;
    hydroCutoff: number;
    aggThreshold: number;
    dangerousThreshold?: number;
    percentOfLengthCutoff?: number;
    minSswResidues?: number;
  };
  onCustomChange: (t: {
    muHCutoff: number;
    hydroCutoff: number;
    aggThreshold: number;
    dangerousThreshold?: number;
    percentOfLengthCutoff?: number;
    minSswResidues?: number;
  }) => void;
  variant?: "details" | "inline";
}

function ThresholdFields({
  thresholdMode,
  onModeChange,
  customThresholds,
  onCustomChange,
}: Omit<ThresholdConfigPanelProps, "variant">) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="threshold-mode">Threshold Mode</Label>
        <Select
          value={thresholdMode}
          onValueChange={(v: "default" | "recommended" | "custom") => onModeChange(v)}
        >
          <SelectTrigger id="threshold-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {(thresholdMode === "default" || thresholdMode === "recommended") &&
            "Compute thresholds from data using median"}
          {thresholdMode === "custom" && "Set custom threshold values"}
        </p>
      </div>

      {thresholdMode === "custom" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Custom thresholds override Peleg's rigorously validated reference values. Changes may
              affect scientific accuracy of FF classification.
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="muH-cutoff">μH Cutoff</Label>
              <input
                id="muH-cutoff"
                type="number"
                step="0.1"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.muHCutoff}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    muHCutoff: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="hydro-cutoff">Hydrophobicity Cutoff</Label>
              <input
                id="hydro-cutoff"
                type="number"
                step="0.1"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.hydroCutoff}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    hydroCutoff: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="agg-threshold">Agg Per-Residue (%)</Label>
              <input
                id="agg-threshold"
                type="number"
                step="0.5"
                min="0"
                max="50"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.aggThreshold}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    aggThreshold: parseFloat(e.target.value) || 5,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="dangerous-threshold">Dangerous Max (%)</Label>
              <input
                id="dangerous-threshold"
                type="number"
                step="0.5"
                min="0"
                max="50"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.dangerousThreshold ?? 25}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    dangerousThreshold: parseFloat(e.target.value) || 25,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="pct-length">% of Length Cutoff</Label>
              <input
                id="pct-length"
                type="number"
                step="1"
                min="0"
                max="100"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.percentOfLengthCutoff ?? 20}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    percentOfLengthCutoff: parseFloat(e.target.value) || 20,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="min-ssw">Min SSW Residues</Label>
              <input
                id="min-ssw"
                type="number"
                step="1"
                min="0"
                max="20"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                value={customThresholds.minSswResidues ?? 3}
                onChange={(e) =>
                  onCustomChange({
                    ...customThresholds,
                    minSswResidues: parseInt(e.target.value) || 3,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ThresholdConfigPanel({
  thresholdMode,
  onModeChange,
  customThresholds,
  onCustomChange,
  variant = "details",
}: ThresholdConfigPanelProps) {
  if (variant === "inline") {
    return (
      <div className="border rounded-lg p-4">
        <ThresholdFields
          thresholdMode={thresholdMode}
          onModeChange={onModeChange}
          customThresholds={customThresholds}
          onCustomChange={onCustomChange}
        />
      </div>
    );
  }

  return (
    <details className="border rounded-lg">
      <summary className="px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/50">
        Advanced: Threshold Configuration
      </summary>
      <div className="px-4 pb-4">
        <ThresholdFields
          thresholdMode={thresholdMode}
          onModeChange={onModeChange}
          customThresholds={customThresholds}
          onCustomChange={onCustomChange}
        />
      </div>
    </details>
  );
}
