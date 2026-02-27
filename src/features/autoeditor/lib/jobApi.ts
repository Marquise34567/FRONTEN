import { apiFetch } from "@/lib/api";
import type { RenderJobResult, RenderJobSummary } from "@/features/autoeditor/types";

export const fetchRecentJobsApi = async (token: string): Promise<RenderJobSummary[]> => {
  try {
    const withJobsPath = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut/jobs", { token });
    if (Array.isArray(withJobsPath.jobs)) return withJobsPath.jobs;
  } catch {
    // fallback path below
  }
  const fallback = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut", { token });
  return Array.isArray(fallback.jobs) ? fallback.jobs : [];
};

export const fetchJobByIdApi = async (token: string, jobId: string): Promise<RenderJobResult> => {
  try {
    return await apiFetch<RenderJobResult>(`/api/vibecut/jobs/${jobId}`, { token });
  } catch {
    return await apiFetch<RenderJobResult>(`/api/vibecut/${jobId}`, { token });
  }
};
