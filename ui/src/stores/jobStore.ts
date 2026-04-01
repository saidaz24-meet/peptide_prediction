/**
 * Zustand store for tracking active background analysis jobs.
 *
 * Features:
 * - Persisted to localStorage (jobs survive page refresh)
 * - Auto-polls every 2 seconds for active jobs
 * - Calls ingestBackendRows on SUCCESS
 * - Shows toast notifications for completion/failure
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

import { pollJobStatus, cancelJob as apiCancelJob } from "@/lib/jobApi";
import type { JobProgress, JobStatusValue } from "@/lib/jobApi";
import { useDatasetStore } from "./datasetStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrackedJob {
  jobId: string;
  fileName: string;
  peptideCount: number;
  status: JobStatusValue;
  progress: JobProgress | null;
  createdAt: number;
  error: string | null;
}

interface JobStore {
  /** Map of jobId → tracked job */
  jobs: Record<string, TrackedJob>;

  /** Add a new job and start polling */
  addJob: (jobId: string, fileName: string, peptideCount: number) => void;

  /** Cancel a running job */
  cancelJob: (jobId: string) => void;

  /** Remove a completed/failed job from tracking */
  removeJob: (jobId: string) => void;

  /** Clear all jobs */
  clearAll: () => void;

  /** Get count of active (non-terminal) jobs */
  activeCount: () => number;

  /** Resume polling for any persisted active jobs (called on mount) */
  resumePolling: () => void;
}

// ---------------------------------------------------------------------------
// Polling management (module-level, not persisted)
// ---------------------------------------------------------------------------

const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

const POLL_INTERVAL_MS = 2000;

function stopPolling(jobId: string) {
  const interval = pollingIntervals.get(jobId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(jobId);
  }
}

function isTerminal(status: JobStatusValue): boolean {
  return status === "SUCCESS" || status === "FAILURE" || status === "REVOKED";
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      jobs: {},

      addJob: (jobId, fileName, peptideCount) => {
        const job: TrackedJob = {
          jobId,
          fileName,
          peptideCount,
          status: "PENDING",
          progress: null,
          createdAt: Date.now(),
          error: null,
        };

        set((state) => ({
          jobs: { ...state.jobs, [jobId]: job },
        }));

        startPolling(jobId, set, get);
      },

      cancelJob: async (jobId) => {
        try {
          await apiCancelJob(jobId);
          stopPolling(jobId);
          set((state) => ({
            jobs: {
              ...state.jobs,
              [jobId]: { ...state.jobs[jobId], status: "REVOKED" as const },
            },
          }));
          toast.info("Analysis cancelled");
        } catch (e: any) {
          toast.error(`Failed to cancel: ${e.message}`);
        }
      },

      removeJob: (jobId) => {
        stopPolling(jobId);
        set((state) => {
          const { [jobId]: _, ...rest } = state.jobs;
          return { jobs: rest };
        });
      },

      clearAll: () => {
        for (const jobId of Object.keys(get().jobs)) {
          stopPolling(jobId);
        }
        set({ jobs: {} });
      },

      activeCount: () => {
        return Object.values(get().jobs).filter((j) => !isTerminal(j.status)).length;
      },

      resumePolling: () => {
        const { jobs } = get();
        for (const job of Object.values(jobs)) {
          if (!isTerminal(job.status) && !pollingIntervals.has(job.jobId)) {
            startPolling(job.jobId, set, get);
          }
        }
      },
    }),
    {
      name: "pvl-jobs",
      version: 1,
      // Only persist the jobs map
      partialize: (state) => ({ jobs: state.jobs }),
    }
  )
);

// ---------------------------------------------------------------------------
// Polling implementation
// ---------------------------------------------------------------------------

function startPolling(
  jobId: string,
  set: (fn: (state: JobStore) => Partial<JobStore>) => void,
  get: () => JobStore
) {
  // Don't duplicate polling
  if (pollingIntervals.has(jobId)) return;

  const interval = setInterval(async () => {
    try {
      const status = await pollJobStatus(jobId);

      // Update job state
      set((state) => ({
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...state.jobs[jobId],
            status: status.status,
            progress: status.progress,
            error: status.error,
          },
        },
      }));

      // Handle terminal states
      if (status.status === "SUCCESS" && status.result) {
        stopPolling(jobId);

        // Ingest results into the dataset store
        const { rows, meta } = status.result;
        useDatasetStore.getState().ingestBackendRows(rows, meta);

        const job = get().jobs[jobId];
        toast.success(`Analysis complete — ${rows.length} peptides`, {
          description: job?.fileName ?? undefined,
        });

        // Navigate to results (if the app has a navigate function)
        if (window.__pvlNavigate) {
          window.__pvlNavigate("/results");
        }
      } else if (status.status === "FAILURE") {
        stopPolling(jobId);
        toast.error(`Analysis failed: ${status.error || "Unknown error"}`);
      } else if (status.status === "REVOKED") {
        stopPolling(jobId);
      }
    } catch {
      // Network error — keep polling, might recover
    }
  }, POLL_INTERVAL_MS);

  pollingIntervals.set(jobId, interval);
}

// ---------------------------------------------------------------------------
// Global navigate helper (set by App.tsx)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __pvlNavigate?: (path: string) => void;
  }
}
