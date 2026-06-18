/**
 * Shared threshold configuration panel.
 *
 * Used by Upload.tsx and QuickAnalyze.tsx for pre-submission threshold
 * selection. Supports collapsible (details) and inline variants.
 *
 * Restructured per Peleg FIX-002 into her 4 canonical groups:
 *   1. General secondary structure thresholds
 *   2. Helical thresholds
 *   3. Secondary structure switch thresholds
 *   4. Fibril-formation thresholds
 *
 * Tooltip text is taken VERBATIM from PELEG_FEEDBACK_INSTRUCTIONS.md FIX-002.
 * Defaults must match `backend/config.py` and `ui/src/lib/thresholds.ts`.
 *
 * Legacy aggregation-flagging thresholds (Aggregation Per-Residue %, % of
 * Length Cutoff, Minimum SSW Residues, Minimum Prediction %) are surfaced
 * under "Advanced (TANGO aggregation)" — Peleg flagged these for discussion,
 * not deletion.
 */
import { useEffect, useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface CustomThresholds {
  // Group 1: General secondary structure
  minSegmentLength: number;
  maxGap: number;
  // Group 2: Helical
  minS4predHelixScore: number;
  minHelixPercentContent: number;
  // Group 3: Secondary structure switch
  s4predMaxHelixBetaDiff: number;
  tangoMaxHelixBetaDiff: number;
  minSsPercentContent: number;
  // Group 4: Fibril-formation
  muHCutoff: number;
  hydroCutoff: number;
  // PELEG-Q6-PARTIAL: TANGO 5%-style aggregation threshold (configurable, awaiting citation).
  tangoAggregationThreshold: number;
  // Legacy back-compat fields — not surfaced in the panel anymore but kept
  // so existing CustomThresholds payloads keep round-tripping.
  aggThreshold: number;
  percentOfLengthCutoff: number;
  minSswResidues: number;
  sswMaxDifference: number;
  minPredictionPercent: number;
}

interface ThresholdConfigPanelProps {
  thresholdMode: "default" | "recommended" | "custom";
  onModeChange: (mode: "default" | "recommended" | "custom") => void;
  customThresholds: CustomThresholds;
  onCustomChange: (t: CustomThresholds) => void;
  variant?: "details" | "inline";
}

/* Defaults match backend/config.py + ui/src/lib/thresholds.ts (Peleg FIX-002) */
const RECOMMENDED_DEFAULTS: Required<CustomThresholds> = {
  // Group 1
  minSegmentLength: 5,
  maxGap: 3,
  // Group 2
  minS4predHelixScore: 0.5,
  minHelixPercentContent: 0,
  // Group 3
  s4predMaxHelixBetaDiff: 0.03,
  tangoMaxHelixBetaDiff: 3,
  minSsPercentContent: 0,
  // Group 4
  muHCutoff: 0.5,
  hydroCutoff: 0.5,
  tangoAggregationThreshold: 5.0,
  // Legacy
  aggThreshold: 5.0,
  percentOfLengthCutoff: 20,
  minSswResidues: 3,
  sswMaxDifference: 0.0,
  minPredictionPercent: 50.0,
};

/** Single info tooltip — uses Peleg's verbatim text. */
function ThresholdInfo({ description }: { description: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <Info className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[320px] text-xs leading-relaxed">
          <p>{description}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

/** One threshold input row. */
function ThresholdInput({
  id,
  label,
  value,
  defaultValue,
  step,
  min,
  max,
  description,
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
  readOnly: boolean;
  onChange: (v: number) => void;
}) {
  // Local string buffer so partial inputs like "0." or "" don't get round-tripped
  // through parseFloat and snapped back. Commit on blur or valid full number.
  // PELEG-A2 (2026-06-18): Peleg PDF1 p17 — typed input was being eaten.
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      setDraft(String(defaultValue));
      onChange(defaultValue);
      return;
    }
    const parsed = parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    onChange(parsed);
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm whitespace-nowrap">
          {label}
        </Label>
        <ThresholdInfo description={description} />
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
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const parsed = parseFloat(e.target.value);
              if (!Number.isNaN(parsed)) onChange(parsed);
            }}
            onBlur={(e) => commit(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

/** Collapsible group wrapper. */
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
        <div className="ml-6 border-l border-border/50 pl-4 pb-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Main grouped threshold fields. */
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
            Custom thresholds override the recommended reference values. Changes may affect
            scientific accuracy of the classification.
          </span>
        </div>
      )}

      {/* ── Group 1: General secondary structure thresholds ── */}
      <ThresholdSection title="General secondary structure thresholds">
        <ThresholdInput
          id="min-segment-length"
          label="Minimal continuous residues"
          value={t.minSegmentLength}
          defaultValue={d.minSegmentLength}
          step="1"
          min="1"
          max="50"
          description="The minimal length of consecutive residues predicted to have the same secondary structure. To make secondary structure prediction longer, this value should be increased. Only integer numbers allowed."
          readOnly={isReadOnly}
          onChange={(v) => update("minSegmentLength", Math.round(v))}
        />
        <ThresholdInput
          id="max-gap"
          label="Maximum gap"
          value={t.maxGap}
          defaultValue={d.maxGap}
          step="1"
          min="0"
          max="20"
          description="Maximum number of residues with mismatched secondary-structure prediction score allowed within a predicted segment stretch. To make secondary structure prediction more strict, this number should be closer to 0. Only integer numbers allowed."
          readOnly={isReadOnly}
          onChange={(v) => update("maxGap", Math.round(v))}
        />
      </ThresholdSection>

      {/* ── Group 2: Helical thresholds ── */}
      <ThresholdSection title="Helical thresholds">
        <ThresholdInput
          id="min-s4pred-helix-score"
          label="Minimal S4PRED helix score"
          value={t.minS4predHelixScore}
          defaultValue={d.minS4predHelixScore}
          step="0.01"
          min="0"
          max="1"
          description="The minimal average reliability score of α-helical prediction by S4PRED. To make secondary structure prediction more strict, this number should be closer to 1. Value range 0-1."
          readOnly={isReadOnly}
          onChange={(v) => update("minS4predHelixScore", v)}
        />
        <ThresholdInput
          id="min-helix-percent-content"
          label="Minimal % helix content"
          value={t.minHelixPercentContent}
          defaultValue={d.minHelixPercentContent}
          step="1"
          min="0"
          max="100"
          description="Minimum percentage of residues predicted to be helical so that the sequence will be defined as helical. To make secondary structure prediction more strict, this number should be closer to 100. Value range 0-100."
          readOnly={isReadOnly}
          onChange={(v) => update("minHelixPercentContent", v)}
        />
      </ThresholdSection>

      {/* ── Group 3: Secondary structure switch thresholds ── */}
      <ThresholdSection title="Secondary structure switch thresholds">
        <ThresholdInput
          id="s4pred-max-helix-beta-diff"
          label="S4PRED maximum helix and beta difference"
          value={t.s4predMaxHelixBetaDiff}
          defaultValue={d.s4predMaxHelixBetaDiff}
          step="0.01"
          min="0"
          max="1"
          description="The maximal difference between α-helix and β prediction scores by S4PRED. To increase the potential for secondary structure, this value should be lower. Value range 0-1. Note: in batch mode, this value is determined automatically according to the input database."
          readOnly={isReadOnly}
          onChange={(v) => update("s4predMaxHelixBetaDiff", v)}
        />
        <ThresholdInput
          id="tango-max-helix-beta-diff"
          label="TANGO maximum helix and beta difference"
          value={t.tangoMaxHelixBetaDiff}
          defaultValue={d.tangoMaxHelixBetaDiff}
          step="0.1"
          min="0"
          max="100"
          description="The maximal difference between α-helix and β prediction scores by TANGO. To increase the potential for secondary structure, this value should be lower. Value range 0-100. Note: in batch mode, this value is determined automatically according to the input database."
          readOnly={isReadOnly}
          onChange={(v) => update("tangoMaxHelixBetaDiff", v)}
        />
        <ThresholdInput
          id="min-ss-percent-content"
          label="Minimal % secondary structure content"
          value={t.minSsPercentContent}
          defaultValue={d.minSsPercentContent}
          step="1"
          min="0"
          max="100"
          description="Minimum percentage of residues predicted to be secondary structure switch so that the sequence will be defined as such. To make secondary structure prediction more strict, this number should be closer to 100. Value range 0-100."
          readOnly={isReadOnly}
          onChange={(v) => update("minSsPercentContent", v)}
        />
      </ThresholdSection>

      {/* ── Group 4: Fibril-formation thresholds ── */}
      <ThresholdSection title="Fibril-formation thresholds">
        <ThresholdInput
          id="muH"
          label="Hydrophobic moment (µH)"
          value={t.muHCutoff}
          defaultValue={d.muHCutoff}
          step="0.01"
          min="0"
          max="3.26"
          description="Minimum hydrophobic moment to predict fibril formation potential of α-helical fibrils. To perform a more strict prediction, this value should be higher. Value range 0 to 3.26. Hydrophobic parameters by Fauchère, J. and Pliska, V. 1983."
          readOnly={isReadOnly}
          onChange={(v) => update("muHCutoff", v)}
        />
        <ThresholdInput
          id="hydrophobicity"
          label="Hydrophobicity"
          value={t.hydroCutoff}
          defaultValue={d.hydroCutoff}
          step="0.01"
          min="-1.01"
          max="2.25"
          description="Minimum hydrophobicity to predict fibril formation potential of secondary structure switch fibrils. To perform a more strict prediction, this value should be higher. Value range -1.01 to 2.25. Hydrophobic parameters by Fauchère, J. and Pliska, V. 1983."
          readOnly={isReadOnly}
          onChange={(v) => update("hydroCutoff", v)}
        />
      </ThresholdSection>

      {/* PELEG-Q5-RESOLVED: removed per Said+Peleg 2026-05-06; previously
          unclear "Aggregation per-residue %" threshold with no scientific justification. */}
      {/* PELEG-PEL-G-RESOLVED: removed; "% of length cutoff" lacked scientific source and was confusing. */}
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
