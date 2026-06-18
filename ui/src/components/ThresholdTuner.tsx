/**
 * Interactive threshold controls for the Results page Ranking tab.
 *
 * Allows researchers to adjust muHCutoff, hydroCutoff, and
 * aggregation flagging rules in real-time and see how classification
 * counts change. All changes are client-side only.
 */
import { useState, useMemo } from "react";
// PELEG-Q5-RESOLVED + PELEG-PEL-G-RESOLVED: collapsible Aggregation Flagging
// section was removed; ChevronDown/ChevronRight no longer used here.
import { RotateCcw, Info, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useThresholdStore, type ThresholdPreset } from "@/stores/thresholdStore";
import { classificationSummary } from "@/lib/thresholds";
import { useDatasetStore } from "@/stores/datasetStore";
import { toast } from "sonner";
import type { Peptide } from "@/types/peptide";
import { Abbr } from "@/components/Abbr";

interface ThresholdTunerProps {
  peptides: Peptide[];
}

// B14 (Peleg 2026-06-18 PDF2): preset chip labels aligned with Peleg's
// preferred terminology. "Original" → "Peleg default" makes the provenance
// explicit; "Exploratory" → "Lenient" matches the symmetric strict/lenient
// framing in the paper.
const PRESET_LABELS: Record<ThresholdPreset, string> = {
  original: "Peleg default",
  strict: "Strict",
  exploratory: "Lenient",
  custom: "Custom",
};

export function ThresholdTuner({ peptides }: ThresholdTunerProps) {
  const { preset, active, original, isModified, setPreset, setThreshold, resetToOriginal } =
    useThresholdStore();

  // PELEG-Q5-RESOLVED + PELEG-PEL-G-RESOLVED: aggExpanded state removed
  // (collapsible Aggregation Flagging section deleted).
  const [recalculating, setRecalculating] = useState(false);
  const recalculate = useDatasetStore((s) => s.recalculate);
  const hasSource = useDatasetStore(
    (s) => s.sourceFile !== null || (s.lastRunType === "predict" && s.lastRunInput !== null)
  );

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await recalculate(active);
      if (result === "server") {
        toast.success("Recalculated with new thresholds");
        resetToOriginal(); // new server data becomes the "original"
      } else {
        toast.info(
          "Aggregation flags updated client-side. Source file unavailable for full server recalculation."
        );
      }
    } catch (err: any) {
      toast.error(`Recalculate failed: ${err?.message || err}`);
    } finally {
      setRecalculating(false);
    }
  };

  const summary = useMemo(() => classificationSummary(peptides, active), [peptides, active]);

  const originalSummary = useMemo(
    () => classificationSummary(peptides, original),
    [peptides, original]
  );

  function impactLabel(current: number, original: number): string | null {
    if (current === original) return null;
    return `${original} \u2192 ${current}`;
  }

  return (
    <Card className="shadow-medium">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Threshold Controls</CardTitle>
            <CardDescription>
              Adjust thresholds to explore classification changes (client-side only)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isModified && (
              <Badge variant="secondary" className="text-xs">
                Modified
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={resetToOriginal} disabled={!isModified}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Preset buttons */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PRESET_LABELS) as ThresholdPreset[])
            .filter((p) => p !== "custom")
            .map((p) => (
              <Button
                key={p}
                variant={preset === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p)}
              >
                {PRESET_LABELS[p]}
              </Button>
            ))}
          {preset === "custom" && (
            <Badge variant="outline" className="text-xs self-center">
              Custom
            </Badge>
          )}
          {isModified && hasSource && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
              )}
              Recalculate
            </Button>
          )}
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>
                <Abbr title="Hydrophobic moment">uH</Abbr>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {active.muHCutoff.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={3.26}
              step={0.01}
              value={[active.muHCutoff]}
              onValueChange={([v]) => setThreshold("muHCutoff", v)}
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Hydrophobicity</span>
              <span className="tabular-nums text-muted-foreground">
                {active.hydroCutoff.toFixed(2)}
              </span>
            </div>
            <Slider
              min={-1.01}
              max={2.25}
              step={0.01}
              value={[active.hydroCutoff]}
              onValueChange={([v]) => setThreshold("hydroCutoff", v)}
            />
          </div>

          {/* PELEG-Q5-RESOLVED: "Aggregation per-residue %" removed per Said+Peleg 2026-05-06.
              PELEG-PEL-G-RESOLVED: "% of length" removed; threshold lacked scientific source.
              PELEG-Q-FIX-025: "Minimum SSW residues" hidden alongside; awaiting discussion. */}

          {/* PELEG-Q6-PARTIAL: TANGO aggregation threshold (replacing the
              hardcoded "5%" annotation on the TANGO chart). */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>TANGO aggregation threshold</span>
              <span className="tabular-nums text-muted-foreground">
                {active.tangoAggregationThreshold.toFixed(1)}
              </span>
            </div>
            <Slider
              min={0}
              max={50}
              step={0.5}
              value={[active.tangoAggregationThreshold]}
              onValueChange={([v]) => setThreshold("tangoAggregationThreshold", v)}
            />
          </div>
        </div>

        {/* Impact summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Helix Candidates (uH)</div>
            <div className="text-xl font-semibold">{summary.ffHelixCandidates}</div>
            {impactLabel(summary.ffHelixCandidates, originalSummary.ffHelixCandidates) && (
              <div className="text-[10px] text-amber-600 mt-0.5">
                {impactLabel(summary.ffHelixCandidates, originalSummary.ffHelixCandidates)}
              </div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">SSW Candidates</div>
            <div className="text-xl font-semibold">{summary.sswCandidates}</div>
            {impactLabel(summary.sswCandidates, originalSummary.sswCandidates) && (
              <div className="text-[10px] text-amber-600 mt-0.5">
                {impactLabel(summary.sswCandidates, originalSummary.sswCandidates)}
              </div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Aggregation Flagged</div>
            <div className="text-xl font-semibold">{summary.aggFlagged}</div>
            {impactLabel(summary.aggFlagged, originalSummary.aggFlagged) && (
              <div className="text-[10px] text-amber-600 mt-0.5">
                {impactLabel(summary.aggFlagged, originalSummary.aggFlagged)}
              </div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{summary.total}</div>
          </div>
        </div>

        {/* Peleg FIX-025: threshold provenance — show origin clearly. */}
        {isModified ? (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>
              <strong>Source: User-set</strong> — you have changed from the original thresholds. The
              originals are the recommended values (computed from the dataset). Changing may affect
              scientific accuracy. Original values: uH={original.muHCutoff.toFixed(2)}, H=
              {original.hydroCutoff.toFixed(2)}, TANGO aggregation=
              {original.tangoAggregationThreshold.toFixed(1)}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Source: Computed from dataset median.</strong> These are the recommended
              thresholds derived from your data and rigorously validated reference values.
            </span>
          </div>
        )}
        {/* PELEG-Q5-RESOLVED + PELEG-PEL-G-RESOLVED + PELEG-Q-FIX-025:
            "Aggregation per-residue %", "% of length", and "Min SSW residues"
            controls were removed entirely per Said+Peleg 2026-05-06 — they
            lacked scientific source and confused users. */}
      </CardContent>
    </Card>
  );
}
