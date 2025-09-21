export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000";

async function handleResponse(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    // try to parse JSON error from FastAPI, else show raw text
    try {
      const j = JSON.parse(text);
      throw new Error(j.detail || JSON.stringify(j));
    } catch {
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
  }
  try { return JSON.parse(text); } catch { return text; }
}

export async function uploadCSV(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-csv`, { method: "POST", body: fd, mode: "cors" });
  return (await handleResponse(res)) as { rows: any[], meta?: any };
}

export async function predictOne(sequence: string, entry?: string) {
  const fd = new FormData();
  fd.append("sequence", sequence);
  if (entry) fd.append("entry", entry);
  const res = await fetch(`${API_BASE}/api/predict`, { method: "POST", body: fd, mode: "cors" });
  return await handleResponse(res);
}
