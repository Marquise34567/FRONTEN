import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Brain, Crown, Loader2, Sparkles, Wand2 } from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import type { RenderJobResult, RenderJobSummary } from "@/features/autoeditor/types";

type TrendsResponse = {
  ok: boolean;
  year: number;
  source: string;
  generatedAt: string;
  topics: Array<{
    title: string;
    traffic: string | null;
    publishedAt: string | null;
    link: string | null;
  }>;
};

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

const toRetentionAverage = (job: RenderJobResult | null | undefined) => {
  const points = Array.isArray(job?.retention?.points) ? job!.retention.points : [];
  if (!points.length) return null;
  const sum = points.reduce((acc, point) => acc + Number(point.watchedPct || 0), 0);
  return Math.max(0, Math.min(100, sum / points.length));
};

const toBestPoint = (job: RenderJobResult | null | undefined) => {
  const points = Array.isArray(job?.retention?.points) ? job!.retention.points : [];
  if (!points.length) return null;
  return points.reduce((best, current) => (current.watchedPct > best.watchedPct ? current : best), points[0]);
};

const toGraphPoints = (job: RenderJobResult | null | undefined): RetentionGraphPoint[] => {
  const points = Array.isArray(job?.retention?.points) ? job!.retention.points : [];
  return points.map((point) => ({
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

const cleanTopicFromFilename = (value: string) =>
  value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const createTitlePredictions = ({
  fileName,
  retentionAverage,
  trends,
}: {
  fileName: string;
  retentionAverage: number | null;
  trends: TrendsResponse["topics"];
}) => {
  const baseTopic = cleanTopicFromFilename(fileName || "Your next clip");
  const trendWords = trends.map((trend) => trend.title).filter(Boolean).slice(0, 6);
  const angle =
    retentionAverage !== null && retentionAverage >= 80
      ? "Already winning retention"
      : retentionAverage !== null && retentionAverage >= 70
        ? "High-retention structure"
        : "Stop drop-offs early";

  const suggestions = [
    `${baseTopic}: ${angle} in 2026`,
    `I tested ${baseTopic} with 2026 trends and this happened`,
    `${baseTopic} but optimized for watch time in 2026`,
    `${baseTopic} | Retention blueprint (${new Date().getFullYear()})`,
    `${baseTopic}: the hook formula creators use in 2026`,
  ];

  trendWords.slice(0, 4).forEach((trend, index) => {
    suggestions.push(`${baseTopic} x ${trend} (${index + 1} move that keeps viewers)`);
  });

  return Array.from(new Set(suggestions)).slice(0, 8);
};

export default function Dashboard() {
  const { accessToken } = useAuth();
  const { data: me } = useMe();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [jobDetailsById, setJobDetailsById] = useState<Record<string, RenderJobResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);

  const loadJobDetail = useCallback(
    async (jobId: string) => {
      if (!accessToken) throw new ApiError("Sign in required.", 401, "unauthorized");
      const cached = jobDetailsById[jobId];
      if (cached) return cached;
      setLoadingDetailId(jobId);
      try {
        const detail = await fetchJobByIdApi(accessToken, jobId);
        setJobDetailsById((prev) => ({ ...prev, [jobId]: detail }));
        return detail;
      } finally {
        setLoadingDetailId((current) => (current === jobId ? null : current));
      }
    },
    [accessToken, jobDetailsById],
  );

  const refreshTitlePredictions = useCallback(async () => {
    const activeJobId = selectedJobId || jobs[0]?.id || null;
    if (!activeJobId) return;
    setLoadingTitles(true);
    try {
      const detail = await loadJobDetail(activeJobId);
      const generated = createTitlePredictions({
        fileName: jobs.find((job) => job.id === activeJobId)?.fileName || "Next video",
        retentionAverage: toRetentionAverage(detail),
        trends: trends?.topics || [],
      });
      setTitleSuggestions(generated);
    } catch {
      setTitleSuggestions([]);
    } finally {
      setLoadingTitles(false);
    }
  }, [jobs, loadJobDetail, selectedJobId, trends?.topics]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const run = async () => {
      setLoadingJobs(true);
      setDashboardError(null);
      try {
        const rows = await fetchRecentJobsApi(accessToken);
        if (cancelled) return;
        setJobs(rows);
        const defaultJobId =
          (requestedJobId && rows.some((job) => job.id === requestedJobId) ? requestedJobId : null) ||
          rows.find((job) => job.status === "completed")?.id ||
          rows[0]?.id ||
          null;
        setSelectedJobId(defaultJobId);
      } catch (error: any) {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : "Could not load dashboard data.";
        setDashboardError(message);
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
    let cancelled = false;
    const run = async () => {
      setLoadingTrends(true);
      try {
        const result = await apiFetch<TrendsResponse>("/api/public/title-trends");
        if (!cancelled) setTrends(result);
      } catch {
        if (!cancelled) setTrends(null);
      } finally {
        if (!cancelled) setLoadingTrends(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ids = jobs.slice(0, 4).map((job) => job.id).filter((id) => !jobDetailsById[id]);
    if (!ids.length || !accessToken) return;
    let cancelled = false;
    const run = async () => {
      await Promise.all(
        ids.map(async (id) => {
          try {
            const detail = await fetchJobByIdApi(accessToken, id);
            if (cancelled) return;
            setJobDetailsById((prev) => (prev[id] ? prev : { ...prev, [id]: detail }));
          } catch {
            // ignore
          }
        }),
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, jobDetailsById, jobs]);

  useEffect(() => {
    if (!selectedJobId) return;
    if (jobDetailsById[selectedJobId]) return;
    void loadJobDetail(selectedJobId);
  }, [jobDetailsById, loadJobDetail, selectedJobId]);

  useEffect(() => {
    if (!jobs.length) {
      setTitleSuggestions([]);
      return;
    }
    void refreshTitlePredictions();
  }, [jobs, refreshTitlePredictions, selectedJobId, trends]);

  const selectedJob = selectedJobId ? jobDetailsById[selectedJobId] || null : null;

  const jobRetentionRows = useMemo(
    () =>
      jobs.map((job) => {
        const detail = jobDetailsById[job.id];
        const avgRetention = toRetentionAverage(detail);
        const bestPoint = toBestPoint(detail);
        return {
          ...job,
          avgRetention,
          peak: bestPoint?.watchedPct ?? null,
          peakLabel: bestPoint?.label ?? null,
        };
      }),
    [jobDetailsById, jobs],
  );

  const bestRetentionEntry = useMemo(() => {
    const withRetention = jobRetentionRows.filter((row) => row.avgRetention !== null) as Array<
      (typeof jobRetentionRows)[number] & { avgRetention: number }
    >;
    if (!withRetention.length) return null;
    return withRetention.reduce((best, current) => (current.avgRetention > best.avgRetention ? current : best), withRetention[0]);
  }, [jobRetentionRows]);

  const selectedGraphPoints = useMemo(() => toGraphPoints(selectedJob), [selectedJob]);
  const selectedRetentionAverage = useMemo(() => toRetentionAverage(selectedJob), [selectedJob]);
  const selectedPrediction = useMemo(() => {
    if (selectedRetentionAverage === null) {
      return "Prediction pending: run a completed render to unlock retention-based forecasting.";
    }
    if (selectedRetentionAverage >= 82) {
      return "High breakout potential. Keep hook density and mirror this pacing in the next 10 seconds.";
    }
    if (selectedRetentionAverage >= 70) {
      return "Strong baseline. Add one earlier payoff moment to push this into high-virality range.";
    }
    return "Drop-risk detected. Tighten intro context and bring first payoff forward by 2-4 seconds.";
  }, [selectedRetentionAverage]);

  const planTier = String(me?.subscription?.tier || "free");
  const planStatus = String(me?.subscription?.status || "free");
  const rendersUsed = Number(me?.usage?.rendersUsed || 0);
  const monthlyLimit = me?.limits?.maxRendersPerMonth;

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-200">
          <Crown className="h-3.5 w-3.5" />
          Subscription
        </p>
        <p className="mt-2 text-lg font-semibold text-slate-100">{planTier}</p>
        <p className="text-sm text-slate-300">Status: {planStatus}</p>
        <p className="mt-2 text-xs text-slate-400">
          Monthly renders: {rendersUsed}
          {typeof monthlyLimit === "number" ? ` / ${monthlyLimit}` : " / unlimited"}
        </p>
      </PremiumCard>

      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          2026 Trend Feed
        </p>
        {loadingTrends ? (
          <p className="mt-2 text-sm text-slate-300">Loading latest trend signals...</p>
        ) : trends?.topics?.length ? (
          <div className="mt-2 space-y-2">
            {trends.topics.slice(0, 4).map((topic) => (
              <div key={topic.title} className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
                <p className="text-sm text-slate-100">{topic.title}</p>
                <p className="text-[11px] text-slate-400">{topic.traffic || "Live trend"}</p>
              </div>
            ))}
            <p className="text-[11px] text-slate-500">Updated {new Date(trends.generatedAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-300">Live trend feed unavailable. Using fallback signals.</p>
        )}
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Dashboard" showSidebar rightRail={rightRail}>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Dashboard Overview</h1>
              <p className="mt-1 text-sm text-slate-400">
                Recent jobs, subscription status, per-video retention rates, and AI title predictions in one dashboard.
              </p>
            </div>
            <PurpleAccentButton
              icon={loadingTitles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              disabled={loadingTitles || !jobs.length}
              onClick={() => void refreshTitlePredictions()}
            >
              Generate 2026 Titles
            </PurpleAccentButton>
          </div>
        </PremiumCard>

        <section className="grid gap-4 lg:grid-cols-3">
          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-cyan-200">
              <BarChart3 className="h-3.5 w-3.5" />
              Highest Retention
            </p>
            {bestRetentionEntry ? (
              <>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">{bestRetentionEntry.avgRetention.toFixed(1)}%</p>
                <p className="mt-1 text-sm text-slate-200">{bestRetentionEntry.fileName || "Untitled video"}</p>
                <p className="text-xs text-slate-400">
                  Peak marker: {bestRetentionEntry.peak !== null ? `${bestRetentionEntry.peak.toFixed(1)}%` : "n/a"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-300">No completed retention profiles yet.</p>
            )}
          </PremiumCard>

          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-cyan-200">
              <Brain className="h-3.5 w-3.5" />
              Video Prediction
            </p>
            <p className="mt-2 text-sm text-slate-200">{selectedPrediction}</p>
          </PremiumCard>

          <PremiumCard className="p-4">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Active Jobs
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-100">
              {jobs.filter((job) => job.status === "queued" || job.status === "processing").length}
            </p>
            <p className="text-xs text-slate-400">Queued + processing jobs in your latest batch.</p>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">Retention Rates Per Video</h2>
            {loadingJobs ? (
              <p className="mt-3 text-sm text-slate-300">Loading recent jobs...</p>
            ) : dashboardError ? (
              <p className="mt-3 text-sm text-rose-300">{dashboardError}</p>
            ) : jobRetentionRows.length ? (
              <div className="mt-3 space-y-2">
                {jobRetentionRows.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedJobId === job.id
                        ? "border-cyan-300/40 bg-cyan-500/12"
                        : "border-white/10 bg-black/35 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">{job.fileName || "Untitled video"}</p>
                      <span className="text-sm font-semibold text-emerald-300">
                        {job.avgRetention !== null ? `${job.avgRetention.toFixed(1)}%` : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(job.createdAt).toLocaleString()} • {job.mode} • {job.status}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-300">No jobs yet. Render a video in the editor to populate this dashboard.</p>
            )}
          </PremiumCard>

          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">AI Title Predictions</h2>
            <p className="mt-1 text-xs text-slate-400">
              Generated from your selected video plus live trend signals ({trends?.year || 2026}).
            </p>
            <div className="mt-3 space-y-2">
              {titleSuggestions.length ? (
                titleSuggestions.map((title) => (
                  <div key={title} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100">
                    {title}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-300">
                  {loadingTitles ? "Generating title suggestions..." : "Select a job to generate titles."}
                </p>
              )}
            </div>
          </PremiumCard>
        </section>

        <PremiumCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-100">Selected Job Retention</h2>
            {loadingDetailId ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading job detail
              </span>
            ) : null}
          </div>
          {selectedGraphPoints.length ? (
            <RetentionGraphCard points={selectedGraphPoints} />
          ) : (
            <p className="text-sm text-slate-300">
              Select a completed job to see detailed retention points and deep retention analytics.
            </p>
          )}
        </PremiumCard>
      </div>
    </AppShell>
  );
}
