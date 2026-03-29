/**
 * Shared threshold configuration panel.
 *
 * Used by Upload.tsx and QuickAnalyze.tsx for pre-submission threshold
 * selection. Supports collapsible (details) and inline variants.
 *
 * Redesigned: grouped into SSW / FF-Helix / General sections with
 * collapsible cards, info tooltips, and Recommended read-only mode.
 */
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface CustomThresholds {
  muHCutoff: number;
  hydroCutoff: number;
  aggThreshold: number;
  percentOfLengthCutoff: number;
  minSswResidues: number;
  sswMaxDifference: number;
  minPredictionPercent: number;
  minS4predHelixScore: number;
}

interface ThresholdConfigPanelProps {
  thresholdMode: "default" | "recommended" | "custom";
  onModeChange: (mode: "default" | "recommended" | "custom") => void;
  customThresholds: CustomThresholds;
  onCustomChange: (t: CustomThresholds) => void;
  variant?: "details" | "inline";
}

/* ── Defaults for recommended mode display ── */
const RECOMMENDED_DEFAULTS: Required<CustomThresholds> = {
  muHCutoff: 0.0,
  hydroCutoff: 0.0,
  aggThreshold: 5.0,
  percentOfLengthCutoff: 20,
  minSswResidues: 3,
  sswMaxDifference: 0.0,
  minPredictionPercent: 50.0,
  minS4predHelixScore: 0.0,
};

/* ── Info tooltip for each threshold ── */
function ThresholdInfo({ description, impact }: { description: string; impact: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[280px] text-xs leading-relaxed space-y-1.5">
          <p>{description}</p>
          <p className="text-muted-foreground italic">{impact}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

/* ── Single threshold input row ── */
function ThresholdInput({
  id,
  label,
  value,
  defaultValue,
  step,
  min,
  max,
  description,
  impact,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  defaultValue: number;
  step: string;
  min?: string;
  max?: string;
  description: string;
  impact: string;
  readOnly: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm whitespace-nowrap">
          {label}
        </Label>
        <ThresholdInfo description={description} impact={impact} />
      </div>
      <div className="flex items-center gap-2">
        {readOnly ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground w-20 text-right">
              {defaultValue}
            </span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              Default
            </Badge>
          </div>
        ) : (
          <Input
            id={id}
            type="number"
            step={step}
            min={min}
            max={max}
            className="w-24 h-8 text-sm font-mono text-right"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || defaultValue)}
          />
        )}
      </div>
    </div>
  );
}

/* ── Collapsible section wrapper ── */
function ThresholdSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors">
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 border-l border-border/50 pl-4 pb-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Main grouped threshold fields ── */
function ThresholdFields({
  thresholdMode,
  onModeChange,
  customThresholds,
  onCustomChange,
}: Omit<ThresholdConfigPanelProps, "variant">) {
  const isReadOnly = thresholdMode === "default" || thresholdMode === "recommended";
  const t = customThresholds;
  const d = RECOMMENDED_DEFAULTS;

  const update = (key: keyof CustomThresholds, value: number) => {
    onCustomChange({ ...customThresholds, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
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
          {isReadOnly && "Compute thresholds from data using median"}
          {thresholdMode === "custom" && "Set custom threshold values"}
        </p>
      </div>

      {/* Warning for custom mode */}
      {thresholdMode === "custom" && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <span>
            Custom thresholds override Peleg's rigorously validated reference values. Changes may
            affect scientific accuracy of FF classification.
          </span>
        </div>
      )}

      {/* Section 1: SSW Thresholds */}
      <ThresholdSection title="SSW Thresholds">
        <ThresholdInput
          id="min-ssw"
          label="Min SSW Residues"
          value={t.minSswResidues}
          defaultValue={d.minSswResidues}
          step="1"
          min="0"
          max="20"
          description="Minimum residues in structural switching window."
          impact="Raising this requires more overlapping helix/beta residues to flag SSW, reducing false positives."
          readOnly={isReadOnly}
          onChange={(v) => update("minSswResidues", v)}
        />
        <ThresholdInput
          id="ssw-max-diff"
          label="SSW Max Difference"
          value={t.sswMaxDifference}
          defaultValue={d.sswMaxDifference}
          step="0.1"
          description="Maximum allowed difference between avg beta and avg helicity."
          impact="Lower values require more balanced helix/beta contributions for SSW detection."
          readOnly={isReadOnly}
          onChange={(v) => update("sswMaxDifference", v)}
        />
      </ThresholdSection>

      {/* Section 2: FF-Helix Thresholds */}
      <ThresholdSection title="FF-Helix Thresholds">
        <ThresholdInput
          id="muH-cutoff"
          label="μH Cutoff"
          value={t.muHCutoff}
          defaultValue={d.muHCutoff}
          step="0.1"
          description="Minimum hydrophobic moment for FF-Helix classification."
          impact="Higher values restrict FF-Helix candidates to more amphipathic peptides."
          readOnly={isReadOnly}
          onChange={(v) => update("muHCutoff", v)}
        />
        <ThresholdInput
          id="hydro-cutoff"
          label="Hydrophobicity Cutoff"
          value={t.hydroCutoff}
          defaultValue={d.hydroCutoff}
          step="0.1"
          description="Minimum hydrophobicity for FF-Helix classification."
          impact="Higher values require stronger hydrophobic character for FF candidacy."
          readOnly={isReadOnly}
          onChange={(v) => update("hydroCutoff", v)}
        />
      </ThresholdSection>

      {/* Section 3: General Thresholds */}
      <ThresholdSection title="General Thresholds">
        <ThresholdInput
          id="agg-threshold"
          label="Agg Per-Residue %"
          value={t.aggThreshold}
          defaultValue={d.aggThreshold}
          step="0.5"
          min="0"
          max="50"
          description="Minimum aggregation per residue for flagging."
          impact="Higher values reduce the number of peptides flagged for aggregation risk."
          readOnly={isReadOnly}
          onChange={(v) => update("aggThreshold", v)}
        />
        <ThresholdInput
          id="pct-length"
          label="% of Length Cutoff"
          value={t.percentOfLengthCutoff}
          defaultValue={d.percentOfLengthCutoff}
          step="1"
          min="0"
          max="100"
          description="Percentage of sequence length for aggregation flagging."
          impact="Higher values require aggregation across a larger portion of the sequence."
          readOnly={isReadOnly}
          onChange={(v) => update("percentOfLengthCutoff", v)}
        />
        <ThresholdInput
          id="min-prediction-pct"
          label="Min Prediction %"
          value={t.minPredictionPercent}
          defaultValue={d.minPredictionPercent}
          step="1"
          min="0"
          max="100"
          description="If less than this % of amino acids are predicted as something, flag it."
          impact="Lower values are more lenient with partial predictions."
          readOnly={isReadOnly}
          onChange={(v) => update("minPredictionPercent", v)}
        />
        <ThresholdInput
          id="min-s4pred-helix"
          label="Min S4PRED Helix Score"
          value={t.minS4predHelixScore}
          defaultValue={d.minS4predHelixScore}
          step="0.01"
          min="0"
          max="1"
          description="Minimum S4PRED helix prediction score."
          impact="Higher values require stronger helix confidence from S4PRED neural network."
          readOnly={isReadOnly}
          onChange={(v) => update("minS4predHelixScore", v)}
        />
      </ThresholdSection>
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
