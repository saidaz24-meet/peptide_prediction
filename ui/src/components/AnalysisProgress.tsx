import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AnalysisProgressProps {
  isActive: boolean;
  peptideCount: number;
  hasTango?: boolean;
  hasS4pred?: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Estimate total processing time in seconds.
 * Based on observed batch timings (not per-peptide):
 *   Biochem-only:  ~2s + 0.002s/peptide
 *   With TANGO:    ~5s + 0.01s/peptide  (batch binary)
 *   With S4PRED:   ~8s + 0.015s/peptide (batch PyTorch)
 *   Both:          ~10s + 0.02s/peptide
 */
function estimateTotal(count: number, tango: boolean, s4pred: boolean): number {
  let base = 2;
  let perPeptide = 0.002;
  if (tango) { base += 3; perPeptide += 0.008; }
  if (s4pred) { base += 6; perPeptide += 0.013; }
  return Math.max(3, base + count * perPeptide);
}

/**
 * Minimal inline progress indicator. Not an overlay — just renders
 * in the document flow where placed.
 */
export function AnalysisProgress({ isActive, peptideCount, hasTango, hasS4pred }: AnalysisProgressProps) {
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
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
