import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, MessageSquareText, Play, TrendingDown, TrendingUp, Wand2 } from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import PreviewPopup from "@/components/premium/PreviewPopup";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, apiFetch, resolveApiMediaUrl } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type { RenderJobResult, RenderJobSummary } from "@/features/autoeditor/types";

const fetchRecentJobsApi = async (token: string): Promise<RenderJobSummary[]> => {
  try {
    const withJobsPath = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut/jobs", { token });
    if (Array.isArray(withJobsPath.jobs)) return withJobsPath.jobs;
  } catch {
    // fallback path below
  }
  const fallback = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut", { token });
  return Array.isArray(fallback.jobs) ? fallback.jobs : [];
};

const fetchJobByIdApi = async (token: string, jobId: string): Promise<RenderJobResult> => {
  try {
    return await apiFetch<RenderJobResult>(`/api/vibecut/jobs/${jobId}`, { token });
  } catch {
    return await apiFetch<RenderJobResult>(`/api/vibecut/${jobId}`, { token });
  }
};

const mapRetentionType = (value: string): RetentionGraphPoint["type"] => {
  if (value === "best" || value === "hook" || value === "emotional_peak") return "peak";
  if (value === "worst") return "drop";
  if (value === "skip_zone") return "skip";
  return "neutral";
};

const toGraphPoints = (job: RenderJobResult | null | undefined): RetentionGraphPoint[] => {
  const points = Array.isArray(job?.retention?.points) ? job!.retention.points : [];
  return points.map((point) => ({
    id: point.id,
    timestamp: point.timestamp,
    watchedPercent: point.watchedPct,
    type: mapRetentionType(point.type),
    label: point.label,
    note: point.description,
  }));
};

const averageRetention = (points: RetentionGraphPoint[]) => {
  if (!points.length) return null;
  return points.reduce((acc, point) => acc + point.watchedPercent, 0) / points.length;
};

export default function Analytics() {
  const { accessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [jobDetailsById, setJobDetailsById] = useState<Record<string, RenderJobResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<RetentionGraphPoint | null>(null);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [previewPopupOpen, setPreviewPopupOpen] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const loadJobDetail = useCallback(
    async (jobId: string) => {
      if (!accessToken) throw new ApiError("Sign in required.", 401, "unauthorized");
      if (jobDetailsById[jobId]) return jobDetailsById[jobId];
      setLoadingJobId(jobId);
      try {
        const detail = await fetchJobByIdApi(accessToken, jobId);
        setJobDetailsById((prev) => ({ ...prev, [jobId]: detail }));
        return detail;
      } finally {
        setLoadingJobId((current) => (current === jobId ? null : current));
      }
    },
    [accessToken, jobDetailsById],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const run = async () => {
      setLoadingJobs(true);
      setErrorMessage(null);
      try {
        const rows = await fetchRecentJobsApi(accessToken);
        if (cancelled) return;
        setJobs(rows);
        const initial =
          (requestedJobId && rows.some((job) => job.id === requestedJobId) ? requestedJobId : null) ||
          rows.find((job) => job.status === "completed")?.id ||
          rows[0]?.id ||
          null;
        setSelectedJobId(initial);
      } catch (error: any) {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : "Could not load analytics jobs.";
        setErrorMessage(message);
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, requestedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    if (jobDetailsById[selectedJobId]) return;
    void loadJobDetail(selectedJobId);
  }, [jobDetailsById, loadJobDetail, selectedJobId]);

  const selectedJob = selectedJobId ? jobDetailsById[selectedJobId] || null : null;
  const points = useMemo(() => toGraphPoints(selectedJob), [selectedJob]);
  const avgRetention = useMemo(() => averageRetention(points), [points]);
  const peakSegments = useMemo(() => points.filter((point) => point.type === "peak").length, [points]);
  const dropSegments = useMemo(() => points.filter((point) => point.type === "drop" || point.type === "skip").length, [points]);

  const selectedJobSummary = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);

  useEffect(() => {
    if (!points.length) {
      setSelectedPoint(null);
      return;
    }
    setSelectedPoint((current) => {
      if (!current) return points[0];
      const stillExists = points.some((point) => point.id === current.id);
      return stillExists ? current : points[0];
    });
  }, [points]);

  const handleSelectPoint = (point: RetentionGraphPoint) => {
    setSelectedPoint(point);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = point.timestamp;
      void previewVideoRef.current.play().catch(() => null);
    }
    setPreviewPopupOpen(true);
    window.setTimeout(() => setPreviewPopupOpen(false), 1800);
  };

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-purple-200">Selected Job</p>
        <p className="mt-2 text-sm text-slate-200">{selectedJobSummary?.fileName || "No job selected"}</p>
        <p className="mt-1 text-xs text-slate-400">
          {selectedJobSummary
            ? `${selectedJobSummary.mode} • ${selectedJobSummary.status} • ${new Date(selectedJobSummary.createdAt).toLocaleString()}`
            : "Pick a job to view actual retention analytics."}
        </p>
      </PremiumCard>

      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-purple-200">Insights Summary</p>
        <p className="mt-2 text-sm text-slate-300">
          Predicted average retention:{" "}
          <span className="font-semibold text-emerald-300">
            {avgRetention !== null ? `${avgRetention.toFixed(1)}%` : "n/a"}
          </span>
        </p>
        <p className="mt-2 text-xs text-slate-400">{selectedJob?.retention?.summary || "Retention summary pending."}</p>
      </PremiumCard>

      <PremiumCard className="space-y-2 p-4">
        <PurpleAccentButton className="w-full justify-center" icon={<Wand2 className="h-4 w-4" />}>
          Fix Weak Parts
        </PurpleAccentButton>
        <button
          type="button"
          onClick={() => setDeepDiveOpen(true)}
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-slate-200 hover:border-purple-300/35 hover:text-white"
        >
          Open Deep Dive
        </button>
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Analytics" rightRail={rightRail}>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Retention Details</h1>
              <p className="text-sm text-slate-400">Actual retention analytics by render job, not demo placeholders.</p>
            </div>
            <div className="flex items-center gap-2">
              {loadingJobs ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : null}
              <select
                value={selectedJobId || ""}
                onChange={(event) => setSelectedJobId(event.target.value || null)}
                className="min-w-[260px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-300/40"
              >
                {!jobs.length ? <option value="">No jobs available</option> : null}
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.fileName || "Untitled"} • {job.status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
        </PremiumCard>

        <PremiumCard className="p-5">
          {points.length ? (
            <RetentionGraphCard points={points} selectedPointId={selectedPoint?.id || null} onSelectPoint={handleSelectPoint} />
          ) : (
            <p className="text-sm text-slate-300">
              {selectedJobId
                ? "This job does not have retention points yet. Complete processing to unlock analytics."
                : "Select a job to view retention analytics."}
            </p>
          )}
        </PremiumCard>

        <PremiumCard className="p-5">
          <h2 className="text-base font-semibold text-slate-100">Frame Thumbnails</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(selectedJob?.thumbnails || []).length ? (
              selectedJob!.thumbnails.map((thumbnail, index) => (
                <button
                  key={thumbnail.id}
                  type="button"
                  onClick={() => {
                    const point = points[Math.min(index, points.length - 1)];
                    if (point) handleSelectPoint(point);
                  }}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 text-left"
                >
                  <div className="aspect-video bg-black">
                    <img
                      src={resolveApiMediaUrl(thumbnail.url)}
                      alt={thumbnail.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm text-slate-100">{thumbnail.label}</p>
                    <p className="text-xs text-slate-400">Tap to sync preview</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-white/10 bg-black/35 px-3 py-5 text-sm text-slate-300">
                Thumbnail data is not available for this job yet.
              </div>
            )}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-purple-300" />
            <h2 className="text-base font-semibold text-slate-100">Realtime Preview</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              ref={previewVideoRef}
              src={resolveApiMediaUrl(selectedJob?.outputVideoUrl || "") || "/editor-help-sample.mp4"}
              controls
              preload="metadata"
              className="aspect-video w-full object-contain bg-black"
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Peak segments: {peakSegments}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                Drop segments: {dropSegments}
              </div>
            </div>
            <div className="rounded-2xl border border-purple-300/35 bg-purple-500/15 px-3 py-2 text-sm text-purple-100">
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                Selected: {selectedPoint ? `${selectedPoint.timestamp.toFixed(1)}s` : "n/a"}
              </div>
            </div>
          </div>
        </PremiumCard>
      </div>

      <Dialog open={deepDiveOpen} onOpenChange={setDeepDiveOpen}>
        <DialogContent className="max-w-5xl border-white/10 bg-[#05060c] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl">Retention Deep Dive</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            {points.length ? (
              <RetentionGraphCard
                points={points}
                title="Zoomable Timeline Graph"
                selectedPointId={selectedPoint?.id || null}
                onSelectPoint={handleSelectPoint}
                className="h-full"
              />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-slate-300">
                No retention points available for this job yet.
              </div>
            )}
            <div className="space-y-3">
              {loadingJobId ? (
                <p className="text-sm text-slate-300">Loading deep-dive markers...</p>
              ) : points.length ? (
                points.map((point) => (
                  <button
                    key={`insight-${point.id}`}
                    type="button"
                    onClick={() => handleSelectPoint(point)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      point.id === selectedPoint?.id
                        ? "border-purple-300/45 bg-purple-500/15 text-slate-100"
                        : "border-white/10 bg-black/40 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    <p className="font-medium">{point.label}</p>
                    <p className="text-xs text-slate-400">
                      {point.timestamp.toFixed(1)}s • {point.note || "No note"}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-300">Select a completed job to open deep-dive markers.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PreviewPopup
        open={previewPopupOpen}
        label={selectedPoint?.label || "Marker"}
        timestamp={selectedPoint?.timestamp || 0}
        note={selectedPoint?.note || ""}
      />
    </AppShell>
  );
}
