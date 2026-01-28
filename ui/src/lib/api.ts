export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";

import type { ThresholdConfig } from "@/types/peptide";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    // try to parse JSON error from FastAPI, else show raw text
    try {
      const j = JSON.parse(text);
      throw new ApiError(j.detail || JSON.stringify(j), res.status);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(text || `${res.status} ${res.statusText}`, res.status);
    }
  }
  try { return JSON.parse(text); } catch { return text; }
}

export async function uploadCSV(file: File, thresholdConfig?: ThresholdConfig) {
  const fd = new FormData();
  fd.append("file", file);
  if (thresholdConfig) {
    fd.append("thresholdConfig", JSON.stringify(thresholdConfig));
  }
  const res = await fetch(`${API_BASE}/api/upload-csv`, { method: "POST", body: fd, mode: "cors" });
  return (await handleResponse(res)) as { rows: any[], meta?: any };
}

export async function predictOne(sequence: string, entry?: string, thresholdConfig?: ThresholdConfig) {
  const fd = new FormData();
  fd.append("sequence", sequence);
  if (entry) fd.append("entry", entry);
  if (thresholdConfig) {
    fd.append("thresholdConfig", JSON.stringify(thresholdConfig));
  }
  const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd, mode: "cors" });
  return await handleResponse(res);
}

export async function fetchExampleDataset(recalc = 0) {
    const res = await fetch(`${API_BASE}/api/example?recalc=${recalc}`, { method: "GET" });
    return (await handleResponse(res)) as { rows: any[]; meta?: any };
}

/**
 * Execute a UniProt query with centralized error handling and auto-retry.
 * Strips HTML from error messages and provides clean error text.
 */
export async function executeUniProtQuery(requestBody: any, signal?: AbortSignal): Promise<{ rows: any[]; meta: any }> {
  const response = await fetch(`${API_BASE}/api/uniprot/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      const text = await response.text();
      try {
        errorData = JSON.parse(text);
      } catch {
        // If not JSON, try to extract from HTML or use text
        const htmlMatch = text.match(/<h1[^>]*>([^<]+)<\/h1>/i) || text.match(/HTTP Status (\d+)/i);
        if (htmlMatch) {
          errorData = { detail: htmlMatch[1] || `HTTP ${response.status}` };
        } else {
          errorData = { detail: text || `HTTP ${response.status}` };
        }
      }
    } catch {
      errorData = { detail: `HTTP ${response.status}` };
    }
    
    // Extract error message (handle both formats: {detail: "..."} or {source: "uniprot", error: "..."})
    let errorMessage = errorData.detail || errorData.error || 'Failed to execute query';
    // If it's a JSON string, try to parse it
    if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
      try {
        const parsed = JSON.parse(errorMessage);
        errorMessage = parsed.error || parsed.detail || errorMessage;
      } catch {
        // Not JSON, use as-is
      }
    }
    
    // Strip HTML tags if present and show clean error
    const cleanMessage = errorMessage.replace(/<[^>]*>/g, '').trim() || 'Failed to execute query';
    throw new ApiError(cleanMessage, response.status);
  }

  return await response.json();
}
