import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Crown, Loader2, Sparkles, Target } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import VIPBadge from "@/components/premium/VIPBadge";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { fetchJobByIdApi, fetchRecentJobsApi } from "@/features/autoeditor/lib/jobApi";
import { useUniqueJobData } from "@/features/autoeditor/hooks/useUniqueJobData";
import { useMe } from "@/hooks/use-me";
import type { RenderJobResult, RenderJobSummary } from "@/features/autoeditor/types";

const toGraphPoints = (job: RenderJobResult | null): RetentionGraphPoint[] => {
  if (!job?.retention?.points?.length) return [];
  return job.retention.points.map((point) => ({
    id: point.id,
    timestamp: point.timestamp,
    watchedPercent: point.watchedPct,
    type:
      point.type === "best" || point.type === "hook" || point.type === "emotional_peak"
        ? "peak"
        : point.type === "worst"
          ? "drop"
          : point.type === "skip_zone"
            ? "skip"
            : "neutral",
    label: point.label,
    note: point.description,
  }));
};

export default function DashboardOverview() {
  const { accessToken } = useAuth();
  const { data: me } = useMe();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, RenderJobResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (jobId: string) => {
      if (!accessToken) throw new ApiError("Sign in required.", 401, "unauthorized");
      if (detailsById[jobId]) return detailsById[jobId];
      setLoadingJobId(jobId);
      try {
        const detail = await fetchJobByIdApi(accessToken, jobId);
        setDetailsById((prev) => ({ ...prev, [jobId]: detail }));
        return detail;
      } finally {
        setLoadingJobId((current) => (current === jobId ? null : current));
      }
    },
    [accessToken, detailsById],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const rows = await fetchRecentJobsApi(accessToken);
        if (cancelled) return;
        setJobs(rows);
        const firstJob =
          (requestedJobId && rows.find((job) => job.id === requestedJobId)?.id) ||
          rows.find((job) => job.status === "completed")?.id ||
          rows[0]?.id ||
          null;
        setSelectedJobId(firstJob);
      } catch (error: any) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Could not load dashboard jobs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, requestedJobId]);

  useEffect(() => {
    if (!selectedJobId || detailsById[selectedJobId]) return;
    void loadDetail(selectedJobId);
  }, [detailsById, loadDetail, selectedJobId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const selectedResult = selectedJobId ? detailsById[selectedJobId] || null : null;
  const graphPoints = useMemo(() => toGraphPoints(selectedResult), [selectedResult]);
  const {
    predictedAverageRetention,
    metadataStats,
    editInsights,
    summary,
  } = useUniqueJobData({
    result: selectedResult,
    fileName: selectedJob?.fileName || "Untitled clip",
  });

  const activeJobCount = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "processing").length,
    [jobs],
  );

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
          <Crown className="h-3.5 w-3.5" />
          VIP Membership
        </p>
        <p className="mt-2 text-lg font-semibold text-slate-100">{String(me?.subscription?.tier || "free")}</p>
        <p className="text-sm text-slate-300">Status: {String(me?.subscription?.status || "free")}</p>
        <p className="mt-2 text-xs text-slate-400">Used by Top 1% Creators</p>
      </PremiumCard>
      <PremiumCard className="space-y-2 p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          Metadata Pulse
        </p>
        {metadataStats.slice(0, 3).map((stat, index) => (
          <div key={stat.id} className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[rgba(7,7,12,0.72)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
            <p className="text-sm font-semibold text-slate-100">{stat.value}</p>
            <p className="text-xs text-slate-400">{stat.detail}</p>
            {index === 0 ? <VIPBadge label="Exclusive Signal" className="mt-2" /> : null}
          </div>
        ))}
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Dashboard" showSidebar rightRail={rightRail}>
      <div className="space-y-5">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <PremiumCard className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[rgba(212,175,55,0.18)] blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-56 bg-gradient-to-r from-[rgba(192,132,252,0.16)] to-transparent blur-2xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-accent)]">Dashboard Overview</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-100">Your Elite Avg. Retention: {predictedAverageRetention.toFixed(1)}%</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Every job now carries unique retention predictions, metadata stats, and hook rationale tuned for watch-time.
                </p>
              </div>
              <VIPBadge label="Top 1% Creators" />
            </div>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
              <Target className="h-3.5 w-3.5" />
              Predicted Avg Retention
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f6da8a]">{predictedAverageRetention.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Target benchmark: 70%+</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
              <BarChart3 className="h-3.5 w-3.5" />
              Active Jobs
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-100">{activeJobCount}</p>
            <p className="text-xs text-slate-400">Queued + processing renders</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              Retention Signal
            </p>
            <p className="mt-2 text-sm text-slate-200">{summary}</p>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <PremiumCard className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-100">Recent Jobs</h2>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : null}
            </div>
            {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}
            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedJobId === job.id
                      ? "border-[rgba(212,175,55,0.38)] bg-[linear-gradient(120deg,rgba(212,175,55,0.18),rgba(192,132,252,0.14))]"
                      : "border-white/10 bg-black/30 hover:border-[rgba(212,175,55,0.35)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-100">{job.fileName || "Untitled clip"}</p>
                    <span className="rounded-full border border-[rgba(212,175,55,0.36)] bg-[rgba(212,175,55,0.12)] px-2 py-0.5 text-xs text-[#f6da8a]">{Math.round(job.progress)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {job.mode} • {job.status} • {new Date(job.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
              {!jobs.length && !loading ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-3 py-5 text-sm text-slate-400">
                  No jobs yet. Upload and render in the editor to populate dynamic metrics.
                </div>
              ) : null}
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-100">Trend Feed</h2>
              <VIPBadge label="Exclusive Scroll" />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {editInsights.map((insight) => (
                <div key={insight.id} className="min-w-[220px] rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[rgba(7,7,12,0.7)] px-3 py-3">
                  <p className="text-sm font-medium text-slate-100">{insight.headline}</p>
                  <p className="mt-1 text-xs text-slate-400">{insight.detail}</p>
                  <p className="mt-1 text-[11px] text-[#f6da8a]">
                    {insight.timestamp.toFixed(1)}s • Predicted {insight.predictedRetention}%
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>

        <PremiumCard className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Retention Graph</h2>
            {loadingJobId ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading detail
              </span>
            ) : null}
          </div>
          {graphPoints.length ? (
            <RetentionGraphCard
              points={graphPoints}
              selectedPointId={selectedPointId}
              onSelectPoint={(point) => setSelectedPointId(point.id)}
            />
          ) : (
            <p className="text-sm text-slate-300">Select a completed render to load interactive retention details.</p>
          )}
        </PremiumCard>
      </div>
    </AppShell>
  );
}
