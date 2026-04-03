import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface AnalysisProgressProps {
  isActive: boolean;
  peptideCount: number;
  hasTango?: boolean;
  hasS4pred?: boolean;
  onCancel?: () => void;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Estimate total processing time in seconds.
 * Based on observed timings on VPS (4 vCPU, 8GB):
 *   FF-Helix + Biochem: ~2s + 0.001s/peptide (fast, vectorized)
 *   TANGO (parallelized): ~5s + 0.5s/peptide (batched subprocess, ~4 parallel)
 *   S4PRED: ~3s + 1s/peptide (LSTM per-sequence, CPU-bound)
 * For short peptides (<50 aa), S4PRED is ~0.1s/peptide.
 * For full proteins (>200 aa), S4PRED is ~5-15s/protein.
 * We use a conservative middle estimate.
 */
function estimateTotal(count: number, tango: boolean, s4pred: boolean): number {
  let base = 3;
  let perPeptide = 0.001;
  if (tango) { base += 5; perPeptide += 0.5; }
  if (s4pred) { base += 3; perPeptide += 1.0; }
  return Math.max(5, base + count * perPeptide);
}

/**
 * Minimal inline progress indicator. Not an overlay — just renders
 * in the document flow where placed.
 */
export function AnalysisProgress({ isActive, peptideCount, hasTango, hasS4pred, onCancel }: AnalysisProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 500);
    return () => clearInterval(id);
  }, [isActive]);

  if (!isActive) return null;

  const estTotal = estimateTotal(peptideCount, !!hasTango, !!hasS4pred);
  const remaining = Math.max(0, estTotal - elapsed);
  const pct = Math.min(95, (elapsed / estTotal) * 100);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-sm text-foreground">
          Analyzing {peptideCount.toLocaleString()} peptide{peptideCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {formatTime(elapsed)} elapsed
          {remaining > 1 && <> · ~{formatTime(remaining)} left</>}
        </span>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
        )}
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
