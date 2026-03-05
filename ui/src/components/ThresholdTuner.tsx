/**
 * Interactive threshold controls for the Results page Ranking tab.
 *
 * Allows researchers to adjust muHCutoff, hydroCutoff, and
 * aggregation flagging rules in real-time and see how classification
 * counts change. All changes are client-side only.
 */
import { useState, useMemo } from 'react';
import { RotateCcw, Info, AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useThresholdStore, type ThresholdPreset } from '@/stores/thresholdStore';
import { classificationSummary } from '@/lib/thresholds';
import { useDatasetStore } from '@/stores/datasetStore';
import { toast } from 'sonner';
import type { Peptide } from '@/types/peptide';
import { Abbr } from '@/components/Abbr';

interface ThresholdTunerProps {
  peptides: Peptide[];
}

const PRESET_LABELS: Record<ThresholdPreset, string> = {
  original: 'Original',
  strict: 'Strict',
  exploratory: 'Exploratory',
  custom: 'Custom',
};

export function ThresholdTuner({ peptides }: ThresholdTunerProps) {
  const { preset, active, original, isModified, setPreset, setThreshold, resetToOriginal } =
    useThresholdStore();

  const [aggExpanded, setAggExpanded] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const recalculate = useDatasetStore(s => s.recalculate);
  const hasSource = useDatasetStore(s => s.sourceFile !== null || (s.lastRunType === 'predict' && s.lastRunInput !== null));

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await recalculate(active);
      if (result === 'server') {
        toast.success('Recalculated with new thresholds');
        resetToOriginal(); // new server data becomes the "original"
      } else {
        toast.info('Aggregation flags updated client-side. Source file unavailable for full server recalculation.');
      }
    } catch (err: any) {
      toast.error(`Recalculate failed: ${err?.message || err}`);
    } finally {
      setRecalculating(false);
    }
  };

  const summary = useMemo(
    () => classificationSummary(peptides, active),
    [peptides, active]
  );

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
            .filter((p) => p !== 'custom')
            .map((p) => (
              <Button
                key={p}
                variant={preset === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset(p)}
              >
                {PRESET_LABELS[p]}
              </Button>
            ))}
          {preset === 'custom' && (
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
              <span><Abbr title="Hydrophobic moment">μH</Abbr> Cutoff</span>
              <span className="tabular-nums text-muted-foreground">{active.muHCutoff.toFixed(2)}</span>
            </div>
            <Slider
              min={-1}
              max={2}
              step={0.01}
              value={[active.muHCutoff]}
              onValueChange={([v]) => setThreshold('muHCutoff', v)}
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Hydrophobicity Cutoff</span>
              <span className="tabular-nums text-muted-foreground">{active.hydroCutoff.toFixed(2)}</span>
            </div>
            <Slider
              min={-2}
              max={2}
              step={0.01}
              value={[active.hydroCutoff]}
              onValueChange={([v]) => setThreshold('hydroCutoff', v)}
            />
          </div>

          {/* Aggregation Flagging Section (collapsible) */}
          <div className="border rounded-md">
            <button
              type="button"
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-md"
              onClick={() => setAggExpanded(!aggExpanded)}
            >
              <span>Aggregation Flagging</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  Agg={active.aggThreshold.toFixed(1)}%
                </span>
                {aggExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {aggExpanded && (
              <div className="px-3 pb-3 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Per-Residue Threshold</span>
                    <span className="tabular-nums text-muted-foreground">{active.aggThreshold.toFixed(1)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={50}
                    step={0.5}
                    value={[active.aggThreshold]}
                    onValueChange={([v]) => setThreshold('aggThreshold', v)}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Dangerous Threshold (absolute max)</span>
                    <span className="tabular-nums text-muted-foreground">{active.dangerousThreshold.toFixed(1)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={50}
                    step={0.5}
                    value={[active.dangerousThreshold]}
                    onValueChange={([v]) => setThreshold('dangerousThreshold', v)}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">% of Length Cutoff</span>
                    <span className="tabular-nums text-muted-foreground">{active.percentOfLengthCutoff.toFixed(0)}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[active.percentOfLengthCutoff]}
                    onValueChange={([v]) => setThreshold('percentOfLengthCutoff', v)}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Min SSW Residues</span>
                    <span className="tabular-nums text-muted-foreground">{active.minSswResidues}</span>
                  </div>
                  <Slider
                    min={0}
                    max={20}
                    step={1}
                    value={[active.minSswResidues]}
                    onValueChange={([v]) => setThreshold('minSswResidues', v)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  A peptide is flagged if any rule triggers: absolute max exceeded, ≥5 contiguous hotspot residues, high % of aggregation-prone residues, or too few SSW residues.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Impact summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Helix Candidates (μH)</div>
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
            <div className="text-xs text-muted-foreground">Agg Flagged</div>
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

        {/* Threshold provenance note */}
        {isModified ? (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span>
              You have changed from the original thresholds. These are derived from Peleg's rigorously tested reference dataset. Changing may affect scientific accuracy.
              Server values: μH={original.muHCutoff.toFixed(2)}, H={original.hydroCutoff.toFixed(2)}, Agg={original.aggThreshold.toFixed(1)}%
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Using Peleg's original thresholds (dataset-average). These are rigorously validated values.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
