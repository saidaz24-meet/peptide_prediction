/**
 * AnalysisProgress — unified in-page progress block.
 *
 * V10-3: reads entirely from useJobStore (single source of truth).
 * Renders when the store has an active job, hides otherwise.
 * Works for both sync and async jobs — the sidebar JobIndicator
 * and this component both read from the same store.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useJobStore } from "@/stores/jobStore";
import { STAGE_LABELS } from "@/lib/jobApi";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Minimal inline progress indicator. Self-gated — renders only when
 * the jobStore has an active (non-terminal) job. Mount it anywhere;
 * it takes no props.
 */
export function AnalysisProgress() {
  const activeJob = useJobStore((s) => s.getActiveJob());
  const cancelJob = useJobStore((s) => s.cancelJob);

  // Local elapsed timer (ticks every 500ms for smooth display)
  const [elapsed, setElapsed] = useState(0);
  const jobCreatedAt = activeJob?.createdAt ?? 0;

  useEffect(() => {
    if (!activeJob) {
      setElapsed(0);
      return;
    }
    // Compute elapsed from the job's createdAt so it's consistent
    // even if the user navigated away and came back
    const tick = () => setElapsed((Date.now() - jobCreatedAt) / 1000);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [activeJob, jobCreatedAt]);

  if (!activeJob) return null;

  const percent = activeJob.progress?.percent ?? 0;
  const stageLabel = activeJob.progress?.stage
    ? STAGE_LABELS[activeJob.progress.stage] || activeJob.progress.stage
    : "Starting...";

  // Estimate remaining from percent (avoid division by zero)
  const remaining = percent > 0 ? (elapsed / (percent / 100)) * ((100 - percent) / 100) : 0;

  // B8 (Peleg 2026-06-18 PDF2): show "X of N peptides" so users see
  // movement at the row level, not just percent. For batches of 5,000
  // a few-percent gap can look frozen; the counter ticking gives the
  // psychologically-needed sign of life. Estimate from percent.
  const processedCount =
    activeJob.peptideCount > 0
      ? Math.min(activeJob.peptideCount, Math.floor((percent / 100) * activeJob.peptideCount))
      : 0;

  return (
    <div className="mt-4 space-y-2" data-testid="analysis-progress">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-sm text-foreground">
          {activeJob.peptideCount > 1 ? (
            <>
              Analyzing{" "}
              <span className="tabular-nums font-medium">
                {processedCount.toLocaleString()} / {activeJob.peptideCount.toLocaleString()}
              </span>{" "}
              peptides
            </>
          ) : (
            <>Analyzing {activeJob.peptideCount.toLocaleString()} peptide</>
          )}
        </span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {formatTime(elapsed)} elapsed
          {remaining > 1 && <> · ~{formatTime(remaining)} left</>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cancelJob(activeJob.jobId)}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          data-testid="analysis-progress-cancel"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={Math.min(95, percent)} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
          {Math.round(percent)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{stageLabel}</p>
    </div>
  );
}
