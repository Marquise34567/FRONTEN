import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock3,
  Film,
  Link2,
  Loader2,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wand2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import GoldAccentButton from "@/components/premium/GoldAccentButton";
import { cn } from "@/lib/utils";
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

const statusBadgeClass: Record<RenderJobSummary["status"], string> = {
  queued: "border-sky-300/35 bg-sky-500/12 text-sky-100",
  processing: "border-cyan-300/35 bg-cyan-500/14 text-cyan-100",
  completed: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
  failed: "border-rose-300/35 bg-rose-500/14 text-rose-100",
};

export default function DashboardOverview() {
  const { accessToken } = useAuth();
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
    setSelectedPointId(null);
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId || detailsById[selectedJobId]) return;
    void loadDetail(selectedJobId);
  }, [detailsById, loadDetail, selectedJobId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const selectedResult = selectedJobId ? detailsById[selectedJobId] || null : null;
  const graphPoints = useMemo(() => toGraphPoints(selectedResult), [selectedResult]);

  const { predictedAverageRetention, summary } = useUniqueJobData({
    result: selectedResult,
    fileName: selectedJob?.fileName || "Untitled clip",
  });

  const activeJobCount = useMemo(
    () => jobs.filter((job) => job.status === "queued" || job.status === "processing").length,
    [jobs],
  );

  const completedJobCount = useMemo(() => jobs.filter((job) => job.status === "completed").length, [jobs]);
  const creditsUsed = Math.min(500, completedJobCount * 8 + activeJobCount * 6 + 272);
  const creditsPercent = Math.round((creditsUsed / 500) * 100);

  return (
    <AppShell title="AutoEditor Dashboard" showSidebar>
      <div className="space-y-5">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
          <PremiumCard className="relative overflow-hidden p-5 md:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/18 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-16 h-44 w-60 rounded-full bg-violet-400/22 blur-3xl" />

            <div className="relative grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100">Retention Control Panel</p>
                  <h1 className="mt-2 text-3xl font-semibold text-white">Upload Footage - Run Retention Pipeline</h1>
                  <p className="mt-2 text-sm text-slate-300">
                    High-speed creator workflow focused on hooks, pacing, captions, and studio audio enhancement.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-200/25 bg-[linear-gradient(140deg,rgba(8,23,26,0.72),rgba(18,13,29,0.72))] p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="rounded-xl border border-cyan-200/20 bg-black/30 px-3 py-2.5">
                      <p className="text-xs uppercase tracking-[0.14em] text-cyan-100">Dropzone</p>
                      <p className="mt-1 text-sm text-slate-300">Upload footage or paste YouTube link to trigger AI pipeline.</p>
                    </div>
                    <GoldAccentButton asChild icon={<Upload className="h-4 w-4" />}>
                      <Link to="/editor">Run AI Editor</Link>
                    </GoldAccentButton>
                  </div>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-black/30 px-3 py-2 text-xs text-slate-200"
                  >
                    <Link2 className="h-3.5 w-3.5 text-cyan-200" />
                    Paste YouTube URL
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-200/20 bg-black/35 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Credits / Usage</p>
                <div className="mt-4 flex items-center justify-center">
                  <div className="relative h-28 w-28 rounded-full border border-cyan-200/25 bg-black/40">
                    <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                      <circle cx="60" cy="60" r="48" stroke="rgba(148,163,184,0.24)" strokeWidth="10" fill="none" />
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        stroke="url(#creditsGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={301.6}
                        strokeDashoffset={301.6 - (301.6 * creditsPercent) / 100}
                      />
                      <defs>
                        <linearGradient id="creditsGradient" x1="0" y1="0" x2="120" y2="120">
                          <stop stopColor="#2fe4c8" />
                          <stop offset="1" stopColor="#b477ff" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <p className="text-sm font-semibold text-cyan-100">{creditsUsed}/500</p>
                      <p className="text-[11px] text-slate-400">clips</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-slate-300">{creditsPercent}% usage this cycle</p>
              </div>
            </div>
          </PremiumCard>
        </motion.section>

        <section className="grid gap-3 md:grid-cols-3">
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <Target className="h-3.5 w-3.5" />
              Hook Win Rate This Month
            </p>
            <p className="mt-2 text-3xl font-semibold text-cyan-100">+28%</p>
            <p className="text-xs text-slate-400">Retention trend across completed exports</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <Film className="h-3.5 w-3.5" />
              Clips Exported
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{completedJobCount || 62}</p>
            <p className="text-xs text-slate-400">AI pipeline completions</p>
          </PremiumCard>
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-100">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Watch Time Boost
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">4.1x</p>
            <p className="text-xs text-slate-400">Based on current retention simulations</p>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <PremiumCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent Projects</h2>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200" /> : null}
            </div>
            {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.slice(0, 6).map((job) => {
                const active = selectedJobId === job.id;
                const detail = detailsById[job.id];
                const retentionLabel = detail?.retention?.predictedAvg != null ? `${Math.round(detail.retention.predictedAvg)}%` : "--";
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      void loadDetail(job.id);
                    }}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition",
                      active
                        ? "border-cyan-200/40 bg-[linear-gradient(145deg,rgba(52,240,208,0.22),rgba(180,119,255,0.18))]"
                        : "border-white/10 bg-black/30 hover:border-cyan-200/30",
                    )}
                  >
                    <div className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,20,0.92),rgba(10,8,18,0.9))]">
                      {detail?.thumbnails?.[0]?.url ? (
                        <img src={detail.thumbnails[0].url} alt={job.fileName || "Project"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-center text-xs text-slate-400">
                          <Play className="mb-2 h-4 w-4 text-cyan-200" />
                          Preview loading
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-white">{job.fileName || "Untitled project"}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{formatDateTime(job.createdAt)}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 uppercase tracking-[0.1em]", statusBadgeClass[job.status])}>
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Retention</span>
                      <span className="font-semibold text-cyan-100">{retentionLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {!jobs.length && !loading ? (
              <div className="mt-3 rounded-2xl border border-dashed border-cyan-200/30 bg-black/20 px-4 py-8 text-sm text-slate-300">
                No projects yet. Open editor and run your first retention pipeline.
              </div>
            ) : null}
          </PremiumCard>

          <div className="space-y-4">
            <PremiumCard className="p-4">
              <h2 className="text-sm font-semibold text-white">Publish / Export Scheduler</h2>
              <div className="mt-3 space-y-2">
                {[
                  "TikTok 7:30 PM - Hook Variants A/B",
                  "Reels 8:10 PM - Caption Highlight Style",
                  "YouTube Shorts 9:00 PM - Studio Audio On",
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard className="p-4">
              <h2 className="text-sm font-semibold text-white">Active Retention Profile</h2>
              <p className="mt-2 text-sm text-slate-300">{summary}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {predictedAverageRetention.toFixed(1)}% current predicted retention
              </p>
              <GoldAccentButton asChild className="mt-4 w-full" icon={<Wand2 className="h-4 w-4" />}>
                <Link to="/editor">Open Full Editor</Link>
              </GoldAccentButton>
            </PremiumCard>
          </div>
        </section>

        <PremiumCard className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Retention Curve Preview</h2>
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
              title="Drop-off Heatmap + Hook Signals"
            />
          ) : (
            <p className="text-sm text-slate-300">Select a completed project to load retention curves.</p>
          )}
        </PremiumCard>
      </div>
    </AppShell>
  );
}
