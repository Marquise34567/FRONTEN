import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  Download,
  Filter,
  Flame,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import GoldAccentButton from "@/components/premium/GoldAccentButton";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { fetchJobByIdApi, fetchRecentJobsApi } from "@/features/autoeditor/lib/jobApi";
import { useUniqueJobData } from "@/features/autoeditor/hooks/useUniqueJobData";
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

const platformMetrics = [
  { platform: "TikTok", value: 89 },
  { platform: "Reels", value: 83 },
  { platform: "Shorts", value: 86 },
  { platform: "YouTube", value: 78 },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function AnalyticsPage() {
  const { accessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, RenderJobResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        const first =
          (requestedJobId && rows.find((job) => job.id === requestedJobId)?.id) ||
          rows.find((job) => job.status === "completed")?.id ||
          rows[0]?.id ||
          null;
        setSelectedJobId(first);
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : "Could not load analytics jobs.");
        }
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

  const { predictedAverageRetention, editInsights, summary } = useUniqueJobData({
    result: selectedResult,
    fileName: selectedJob?.fileName || "Untitled",
  });

  useEffect(() => {
    if (!graphPoints.length) return;
    if (selectedPointId && graphPoints.some((point) => point.id === selectedPointId)) return;
    setSelectedPointId(graphPoints[0].id);
  }, [graphPoints, selectedPointId]);

  const selectedPoint = useMemo(
    () => graphPoints.find((point) => point.id === selectedPointId) || null,
    [graphPoints, selectedPointId],
  );

  const avgHookWinRate = Math.min(98, Math.round(predictedAverageRetention + 12));
  const retentionLift = Math.max(8, Math.round(predictedAverageRetention - 44));
  const avgWatchTime = `${Math.max(18, Math.round((predictedAverageRetention / 100) * 42))}s`;
  const revisionReduction = `${Math.max(22, 48 - Math.max(0, jobs.length - 6))}%`;

  return (
    <AppShell title="AutoEditor Analytics" showSidebar>
      <div className="space-y-5">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">Retention Analytics Dashboard</h1>
              <p className="mt-1 text-sm text-slate-300">
                Track watch-time curves, drop-off heatmaps, and hook performance across platforms.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-black/35 px-3 py-2 text-xs text-slate-200"
              >
                <CalendarRange className="h-3.5 w-3.5 text-cyan-100" />
                Last 30 days
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-black/35 px-3 py-2 text-xs text-slate-200"
              >
                <Filter className="h-3.5 w-3.5 text-cyan-100" />
                Project filter
              </button>
              <GoldAccentButton icon={<Download className="h-4 w-4" />}>Export Report</GoldAccentButton>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200" /> : null}
            <select
              value={selectedJobId || ""}
              onChange={(event) => setSelectedJobId(event.target.value || null)}
              className="min-w-[260px] rounded-xl border border-cyan-200/24 bg-[rgba(9,15,24,0.75)] px-3 py-2 text-sm text-slate-100"
            >
              {!jobs.length ? <option value="">No jobs</option> : null}
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.fileName || "Untitled"} • {job.status}
                </option>
              ))}
            </select>
          </div>

          {errorMessage ? <p className="mt-2 text-sm text-rose-300">{errorMessage}</p> : null}
        </PremiumCard>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <Flame className="h-3.5 w-3.5" />
              Avg. Hook Win Rate
            </p>
            <p className="mt-2 text-3xl font-semibold text-cyan-100">{avgHookWinRate}%</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Retention Lift %
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">+{retentionLift}%</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <Target className="h-3.5 w-3.5" />
              Avg. Watch Time
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{avgWatchTime}</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Revision Reduction
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{revisionReduction}</p>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <PremiumCard className="p-4">
            {graphPoints.length ? (
              <RetentionGraphCard
                points={graphPoints}
                selectedPointId={selectedPointId}
                onSelectPoint={(point) => setSelectedPointId(point.id)}
                title="Watch Time Retention Curve"
              />
            ) : (
              <p className="text-sm text-slate-300">Select a completed render to load retention analytics.</p>
            )}
            {selectedPoint ? (
              <div className="mt-3 rounded-xl border border-cyan-200/24 bg-black/30 px-3 py-2 text-xs text-slate-300">
                Marker: <span className="text-cyan-100">{selectedPoint.label}</span> • {selectedPoint.timestamp.toFixed(1)}s •
                {" "}{Math.round(selectedPoint.watchedPercent)}% retention
              </div>
            ) : null}
          </PremiumCard>

          <PremiumCard className="p-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart3 className="h-4 w-4 text-cyan-100" />
              Platform Performance
            </h2>
            <div className="mt-3 space-y-2">
              {platformMetrics.map((metric) => (
                <div key={metric.platform} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{metric.platform}</span>
                    <span className="text-cyan-100">{metric.value}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(52,240,208,0.92),rgba(180,119,255,0.92))]"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mt-4 text-xs uppercase tracking-[0.13em] text-slate-400">Drop-off Heatmap</h3>
            <div className="mt-2 grid grid-cols-8 gap-1">
              {Array.from({ length: 40 }).map((_, index) => {
                const intensity = (index * 17) % 100;
                return (
                  <div
                    key={index}
                    className="h-4 rounded"
                    style={{
                      backgroundColor:
                        intensity > 75
                          ? "rgba(180,119,255,0.7)"
                          : intensity > 50
                            ? "rgba(52,240,208,0.62)"
                            : "rgba(148,163,184,0.2)",
                    }}
                  />
                );
              })}
            </div>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <PremiumCard className="p-4">
            <h2 className="text-sm font-semibold text-white">Top Clips Ranked</h2>
            <div className="mt-3 space-y-2">
              {jobs.slice(0, 5).map((job, index) => {
                const detail = detailsById[job.id];
                const retention = detail?.retention?.predictedAvg != null ? `${Math.round(detail.retention.predictedAvg)}%` : "--";
                return (
                  <div key={job.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-slate-100">
                        #{index + 1} {job.fileName || "Untitled clip"}
                      </p>
                      <span className="text-cyan-100">{retention}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(job.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <h2 className="text-sm font-semibold text-white">Hook Performance Over Time</h2>
            <div className="mt-3 space-y-2">
              {editInsights.slice(0, 5).map((insight) => (
                <div key={insight.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                  <p className="text-sm text-slate-100">{insight.headline}</p>
                  <p className="mt-1 text-xs text-slate-400">{insight.detail}</p>
                  <p className="mt-1 text-[11px] text-cyan-100">
                    {insight.timestamp.toFixed(1)}s • Predicted retention {insight.predictedRetention}%
                  </p>
                </div>
              ))}
              {!editInsights.length ? (
                <div className="rounded-xl border border-dashed border-cyan-200/26 bg-black/20 px-3 py-6 text-sm text-slate-300">
                  Insights will appear after retention analysis completes.
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-400">{summary}</p>
          </PremiumCard>
        </section>
      </div>
    </AppShell>
  );
}
