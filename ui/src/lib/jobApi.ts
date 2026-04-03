/**
 * Job management API client.
 *
 * Handles async job submission, polling, and cancellation.
 * Falls back to sync upload when async is unavailable.
 */

import { API_BASE } from "./api";
import type { ThresholdConfig } from "@/types/peptide";
import type { RowsResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobProgress {
  stage: string;
  percent: number;
  peptide_count?: number;
}

export type JobStatusValue = "PENDING" | "STARTED" | "PROGRESS" | "SUCCESS" | "FAILURE" | "REVOKED";

export interface JobStatusResponse {
  jobId: string;
  status: JobStatusValue;
  progress: JobProgress | null;
  result: RowsResponse | null;
  error: string | null;
}

export interface SubmitJobResponse {
  jobId: string | null;
  status: string;
  mode: "async" | "sync";
  peptideCount?: number;
  result?: RowsResponse;
}

export interface JobListItem {
  jobId: string;
  status: JobStatusValue;
  progress: JobProgress | null;
  fileName: string | null;
  peptideCount: number | null;
  createdAt: number | null;
}

// ---------------------------------------------------------------------------
// Stage labels for UI display
// ---------------------------------------------------------------------------

export const STAGE_LABELS: Record<string, string> = {
  parsing: "Parsing file...",
  ff_helix: "Computing helix propensity...",
  tango: "Running TANGO aggregation analysis...",
  s4pred: "Running S4PRED structure prediction...",
  biochem: "Computing biochemical features...",
  normalize: "Preparing results...",
  complete: "Analysis complete",
};

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function submitUploadJob(
  file: File,
  thresholdConfig?: ThresholdConfig,
  signal?: AbortSignal,
  cancelToken?: string
): Promise<SubmitJobResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (thresholdConfig) {
    fd.append("thresholdConfig", JSON.stringify(thresholdConfig));
  }
  const params = cancelToken ? `?cancelToken=${cancelToken}` : "";
  const res = await fetch(`${API_BASE}/api/jobs/upload${params}`, {
    method: "POST",
    body: fd,
    mode: "cors",
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail || text;
    } catch {
      // use raw text
    }
    throw new Error(detail);
  }
  return await res.json();
}

/** Cancel a running sync job by its cancel token. */
export async function cancelSyncJob(cancelToken: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/jobs/cancel-sync/${cancelToken}`, {
      method: "POST",
      mode: "cors",
    });
  } catch {
    // Best effort — job may already be done
  }
}

export async function pollJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    method: "GET",
    mode: "cors",
  });
  if (!res.ok) {
    throw new Error(`Failed to poll job ${jobId}: ${res.status}`);
  }
  return await res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/cancel`, {
    method: "POST",
    mode: "cors",
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel job ${jobId}: ${res.status}`);
  }
}

export async function listJobs(): Promise<JobListItem[]> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "GET",
    mode: "cors",
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.jobs || [];
}
