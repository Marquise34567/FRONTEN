import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import { ApiError, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Loader2, Sparkles, WandSparkles } from "lucide-react";

type FeedbackJob = {
  id: string;
  sourceType: "classic" | "vibecut";
  title: string;
  createdAt: string;
  durationSeconds: number | null;
};

type PlatformPrediction = {
  score: number;
  confidence: number;
  potential: "low" | "moderate" | "high";
  reasoning: string;
};

type AnalyticsReport = {
  schemaVersion: number;
  style: {
    surface: string;
    accent: string;
    renderHint: string;
  };
  classification: {
    type: "short-form" | "long-form";
    reason: string;
  };
  source: {
    type: string;
    title: string;
  };
  metrics: {
    timeSavedOnThisEdit: {
      estimatedManualWithoutAiMinutes: number;
      actualTimeSpentMinutes: number;
      timeSavedMinutes: number;
      aiContributionPercent: number;
      summary: string;
      visualization: string;
      action: string;
    };
    renderDetails: {
      exportFormat: {
        container: string;
        resolution: string;
        orientation: "vertical" | "horizontal" | "unknown";
        aspectRatio: string;
      };
      templateUsed: string;
      chapterCount: number;
      featureCoveragePercent: {
        deadAirTrim: number;
        audioEnhancement: number;
        captions: number;
      };
      summary: string;
      visualization: string;
      action: string;
    };
    retentionPotential: {
      estimatedLiftPercent: number;
      summary: string;
      visualization: string;
      action: string;
      simulatedWatchTimeSeconds: {
        before: number;
        after: number;
      };
    };
    engagementInsights: {
      available: boolean;
      summary: string;
      visualization: string;
      action: string;
      retentionRatePercent: number | null;
      views: number | null;
      ratios: {
        engagementRatePercent: number | null;
      };
    };
    aiEfficiencyScore: {
      score: number;
      summary: string;
      visualization: string;
      action: string;
    };
    contentOptimizationBreakdown: {
      shortenedPercent: number;
      mostImpactfulFeature: string;
      summary: string;
      visualization: string;
      action: string;
      featureContributionPercent: Array<{ feature: string; percent: number }>;
    };
    platformPerformancePredictions: {
      youtube: PlatformPrediction;
      tiktok: PlatformPrediction;
      instagram: PlatformPrediction;
      bestFit: "youtube" | "tiktok" | "instagram";
      summary: string;
      visualization: string;
      action: string;
    };
    improvementSuggestions: {
      suggestions: string[];
      summary: string;
      visualization: string;
    };
  };
  motivationalNote: string;
};

type FeedbackResponse = {
  generatedAt: string;
  feedback: AnalyticsReport;
};

type RealtimePredictionTrend = "rising" | "steady" | "falling";

type RealtimePredictionVideo = {
  videoId: string;
  uploadKey: string;
  jobId: string;
  sourceType: "classic" | "vibecut";
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
  prediction: {
    score: number | null;
    confidencePercent: number;
    potential: "low" | "moderate" | "high";
    trend: RealtimePredictionTrend;
    predictedCompletionPercent: number | null;
    expectedLiftPercent: number | null;
    hookStrengthPercent: number | null;
    pacingScorePercent: number | null;
    summary: string;
    reasoning: string[];
    updatedAt: string | null;
  };
};

type RealtimePredictionResponse = {
  generatedAt: string;
  videos: RealtimePredictionVideo[];
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "Unknown";
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatPercent = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : "n/a";

const formatLift = (value: number | null | undefined) => {
  if (!Number.isFinite(Number(value))) return "n/a";
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}%`;
};

const formatStatus = (value: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Queued";
  if (normalized === "ready" || normalized === "completed") return "Ready";
  if (normalized === "failed") return "Failed";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const statusTone = (value: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ready" || normalized === "completed") {
    return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  }
  if (normalized === "failed") {
    return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  }
  if (normalized === "queued" || normalized === "uploading") {
    return "border-amber-300/45 bg-amber-500/15 text-amber-100";
  }
  return "border-cyan-300/40 bg-cyan-500/12 text-cyan-100";
};

const trendLabel = (trend: RealtimePredictionTrend) =>
  trend === "rising" ? "Rising" : trend === "falling" ? "Falling" : "Stable";

const trendTone = (trend: RealtimePredictionTrend) =>
  trend === "rising" ? "text-emerald-200" : trend === "falling" ? "text-rose-200" : "text-slate-200";

const potentialTone = (value: "low" | "moderate" | "high") => {
  if (value === "high") return "text-emerald-200 border-emerald-400/40 bg-emerald-500/10";
  if (value === "moderate") return "text-amber-100 border-amber-300/40 bg-amber-500/10";
  return "text-rose-100 border-rose-300/40 bg-rose-500/10";
};

const sourceLabel = (sourceType: "classic" | "vibecut") => (sourceType === "classic" ? "AutoEditor" : "VibeCut");

const Feedback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const { data: me, isLoading: loadingMe } = useMe();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<FeedbackJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedSourceType, setSelectedSourceType] = useState<"classic" | "vibecut">("classic");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [realtimeVideos, setRealtimeVideos] = useState<RealtimePredictionVideo[]>([]);
  const [realtimeGeneratedAt, setRealtimeGeneratedAt] = useState<string | null>(null);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const realtimePredictionErrorRef = useRef(false);

  const tier = String(me?.subscription?.tier || "free").toLowerCase();
  const isDev = Boolean(me?.flags?.dev);
  const isPremium = isDev || tier !== "free";

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  useEffect(() => {
    if (!accessToken || loadingMe || !isPremium) return;
    let cancelled = false;

    const run = async () => {
      try {
        setLoadingJobs(true);
        const result = await apiFetch<{ jobs: FeedbackJob[] }>("/api/feedback/jobs", { token: accessToken });
        if (cancelled) return;
        setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Could not load completed renders",
            description: error?.message || "Try again in a moment.",
          });
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, loadingMe, isPremium, toast]);

  useEffect(() => {
    if (!accessToken || loadingMe || !isPremium) return;
    let cancelled = false;

    const loadRealtimePredictions = async (silent: boolean) => {
      try {
        if (!silent) setLoadingRealtime(true);
        const result = await apiFetch<RealtimePredictionResponse>("/api/feedback/realtime-predictions?limit=24", {
          token: accessToken,
        });
        if (cancelled) return;
        setRealtimeVideos(Array.isArray(result.videos) ? result.videos : []);
        setRealtimeGeneratedAt(result.generatedAt || new Date().toISOString());
        realtimePredictionErrorRef.current = false;
      } catch (error: any) {
        if (cancelled) return;
        if (!realtimePredictionErrorRef.current) {
          realtimePredictionErrorRef.current = true;
          toast({
            title: "Realtime predictions unavailable",
            description: error?.message || "Retrying in the background.",
          });
        }
      } finally {
        if (!cancelled && !silent) setLoadingRealtime(false);
      }
    };

    void loadRealtimePredictions(false);
    const timer = window.setInterval(() => {
      void loadRealtimePredictions(true);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken, loadingMe, isPremium, toast]);

  useEffect(() => {
    const deepLinkJobId = String(searchParams.get("jobId") || "").trim();
    const deepLinkSource = String(searchParams.get("source") || "").trim().toLowerCase();
    if (!deepLinkJobId) return;

    setSelectedJobId(deepLinkJobId);
    if (deepLinkSource === "vibecut") {
      setSelectedSourceType("vibecut");
    } else if (deepLinkSource === "classic" || deepLinkSource === "job") {
      setSelectedSourceType("classic");
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedJobId || !jobs.length) return;
    setSelectedJobId(jobs[0].id);
    setSelectedSourceType(jobs[0].sourceType);
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (loadingMe || isPremium) return;
    const timer = window.setTimeout(() => {
      navigate("/pricing", { replace: true });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [loadingMe, isPremium, navigate]);

  const handleAnalyze = async () => {
    if (!accessToken) return;
    setAnalyzeError(null);
    if (!selectedJobId) {
      toast({ title: "Select a completed render", description: "Choose a render to generate analytics." });
      return;
    }

    try {
      setAnalyzing(true);
      const result = await apiFetch<FeedbackResponse>("/api/feedback/analyze", {
        method: "POST",
        body: JSON.stringify({ jobId: selectedJobId, sourceType: selectedSourceType }),
        token: accessToken,
      });
      setReport(result.feedback);
      toast({ title: "Feedback ready", description: "Per-video analytics report generated." });
    } catch (error: any) {
      if (error instanceof ApiError && error.code === "PREMIUM_REQUIRED") {
        navigate("/pricing");
        return;
      }
      const message = error?.message || "Please try again.";
      setAnalyzeError(message);
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingMe) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen px-4 pb-16 pt-24">
          <div className="mx-auto flex max-w-4xl items-center justify-center rounded-3xl border border-[#d4af37]/25 bg-black/35 p-10 backdrop-blur-xl">
            <Loader2 className="h-6 w-6 animate-spin text-[#d4af37]" />
            <span className="ml-3 text-sm text-slate-300">Loading analytics access...</span>
          </div>
        </main>
      </GlowBackdrop>
    );
  }

  if (!isPremium) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen px-4 pb-16 pt-24">
          <div className="mx-auto max-w-4xl rounded-3xl border border-[#d4af37]/35 bg-[linear-gradient(140deg,rgba(10,12,18,0.96),rgba(17,14,9,0.95))] p-8 shadow-[0_35px_110px_-60px_rgba(212,175,55,0.72)] backdrop-blur-xl">
            <Badge className="border border-[#d4af37]/45 bg-[#d4af37]/15 text-[#f8e8b5]">Premium Feature</Badge>
            <h1 className="mt-4 text-3xl font-bold text-white">AI Feedback Analytics</h1>
            <p className="mt-2 text-sm text-slate-300">
              Upgrade to unlock per-video dynamic analytics, platform predictions, and optimization guidance.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
              Free tier users are redirected to pricing. Paid and dev users can generate premium feedback reports.
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f8e8b5] text-[#1f1b13] hover:brightness-110">
                <Link to="/pricing">Upgrade to Unlock Feedback</Link>
              </Button>
              <p className="text-xs text-slate-400">Redirecting to pricing...</p>
            </div>
          </div>
        </main>
      </GlowBackdrop>
    );
  }

  const platforms = report
    ? [
        { key: "YouTube", value: report.metrics.platformPerformancePredictions.youtube },
        { key: "TikTok", value: report.metrics.platformPerformancePredictions.tiktok },
        { key: "Instagram", value: report.metrics.platformPerformancePredictions.instagram },
      ]
    : [];

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.section
          className="mx-auto max-w-6xl rounded-3xl border border-[#d4af37]/35 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.2),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(255,245,214,0.1),transparent_55%),linear-gradient(145deg,rgba(9,11,17,0.95),rgba(13,16,24,0.94))] p-6 shadow-[0_34px_120px_-68px_rgba(212,175,55,0.82)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#f3d77f]/85">Premium Intelligence</p>
              <h1 className="mt-2 bg-gradient-to-r from-[#f8e8b5] via-[#d4af37] to-[#f5d48f] bg-clip-text text-3xl font-bold text-transparent">
                AI Feedback Analytics
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Dynamic per-video metrics for editing efficiency, quality, retention, and platform fit.
              </p>
            </div>
            <Badge className="border border-[#d4af37]/45 bg-[#d4af37]/12 text-[#f8e8b5]">
              {isDev ? "Dev Access" : "Premium"}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-[#d4af37]/30 bg-black/30 p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Select Completed Render</p>
              <select
                value={selectedJobId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedJobId(nextId);
                  const next = jobs.find((job) => job.id === nextId);
                  if (next) setSelectedSourceType(next.sourceType);
                }}
                className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select render</option>
                {jobs.map((job) => (
                  <option key={`${job.sourceType}:${job.id}`} value={job.id}>
                    [{sourceLabel(job.sourceType)}] {job.title} • {formatDate(job.createdAt)} • {formatDuration(job.durationSeconds)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400">
                {loadingJobs
                  ? "Loading completed renders..."
                  : selectedJob
                  ? `Selected ${sourceLabel(selectedJob.sourceType)} render: ${selectedJob.title}`
                  : "Pick a finished render to compute dynamic metrics."}
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f8e8b5] text-[#1f1b13] shadow-[0_0_24px_rgba(212,175,55,0.45)] hover:brightness-110"
              >
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                Generate Feedback
              </Button>
              {analyzeError ? (
                <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {analyzeError}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Snapshot</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] text-slate-400">Time Saved</p>
                  <p className="mt-1 text-xl font-semibold text-[#f8e8b5]">
                    {report ? `${report.metrics.timeSavedOnThisEdit.timeSavedMinutes.toFixed(1)}m` : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] text-slate-400">AI Efficiency</p>
                  <p className="mt-1 text-xl font-semibold text-[#f8e8b5]">
                    {report ? `${report.metrics.aiEfficiencyScore.score.toFixed(1)}/100` : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] text-slate-400">Best Fit</p>
                  <p className="mt-1 text-xl font-semibold text-[#f8e8b5]">
                    {report ? report.metrics.platformPerformancePredictions.bestFit.toUpperCase() : "-"}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-3 text-xs text-[#f8e8b5]">
                {report ? report.classification.reason : "Run analytics to get short/long-form classification and performance prediction."}
              </div>
            </div>
          </div>
        </motion.section>

        <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[#d4af37]/30 bg-black/25 p-4 backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Realtime Predictions</p>
              <p className="mt-1 text-sm text-slate-300">
                Live outlook per unique uploaded video. Refreshes every 4 seconds.
              </p>
            </div>
            <Badge className="border border-cyan-300/45 bg-cyan-500/15 text-cyan-100">
              LIVE {realtimeGeneratedAt ? `• ${formatDateTime(realtimeGeneratedAt)}` : "• syncing"}
            </Badge>
          </div>

          {loadingRealtime && !realtimeVideos.length ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
              Loading realtime prediction feed...
            </div>
          ) : realtimeVideos.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {realtimeVideos.map((video) => {
                const isSelected = selectedJobId === video.jobId;
                return (
                  <button
                    key={video.videoId}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(video.jobId);
                      setSelectedSourceType(video.sourceType);
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#d4af37]/60 bg-[#d4af37]/10 shadow-[0_0_20px_rgba(212,175,55,0.28)]"
                        : "border-white/10 bg-black/30 hover:border-cyan-300/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{video.title}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {sourceLabel(video.sourceType)} • Updated {formatDateTime(video.prediction.updatedAt || video.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={statusTone(video.status)}>{formatStatus(video.status)}</Badge>
                        {isSelected ? (
                          <Badge className="border border-[#d4af37]/45 bg-[#d4af37]/15 text-[#f8e8b5]">Selected</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Score</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-100">{formatPercent(video.prediction.score)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Completion</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-100">
                          {formatPercent(video.prediction.predictedCompletionPercent)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Expected Lift</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-100">
                          {formatLift(video.prediction.expectedLiftPercent)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Confidence</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-100">
                          {formatPercent(video.prediction.confidencePercent)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <p className={`font-medium ${trendTone(video.prediction.trend)}`}>Trend: {trendLabel(video.prediction.trend)}</p>
                      <p className="text-slate-400">
                        Hook {formatPercent(video.prediction.hookStrengthPercent)} • Pacing{" "}
                        {formatPercent(video.prediction.pacingScorePercent)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{video.prediction.summary}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-300">
              No uploaded videos with prediction telemetry yet. Upload and render a video to populate the live feed.
            </div>
          )}
        </section>

        {report ? (
          <motion.section
            className="mx-auto mt-6 max-w-6xl space-y-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-[#d4af37]/45 bg-[#d4af37]/12 text-[#f8e8b5]">
                  {report.classification.type === "short-form" ? "Short-form" : "Long-form"}
                </Badge>
                <Badge className="border border-white/20 bg-white/5 text-slate-200">Source: {report.source.type}</Badge>
                <Badge className="border border-white/20 bg-white/5 text-slate-200">Video: {report.source.title}</Badge>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Time Saved on This Edit</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.timeSavedOnThisEdit.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.timeSavedOnThisEdit.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.timeSavedOnThisEdit.action}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Render Details</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.renderDetails.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.renderDetails.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.renderDetails.action}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Retention Potential</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.retentionPotential.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.retentionPotential.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.retentionPotential.action}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Engagement Insights</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.engagementInsights.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.engagementInsights.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.engagementInsights.action}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Platform Performance Predictions</p>
                <Badge className="border border-[#d4af37]/45 bg-[#d4af37]/12 text-[#f8e8b5]">
                  Best Fit: {report.metrics.platformPerformancePredictions.bestFit.toUpperCase()}
                </Badge>
              </div>

              <div className="mt-3 space-y-3">
                {platforms.map((platform) => (
                  <div key={platform.key} className="rounded-xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">{platform.key}</p>
                      <div className={`rounded-full border px-2 py-0.5 text-[11px] ${potentialTone(platform.value.potential)}`}>
                        {platform.value.potential} • {platform.value.confidence.toFixed(1)}% confidence
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d4af37] via-[#f5d48f] to-[#f8e8b5]"
                        style={{ width: `${Math.max(2, Math.min(100, platform.value.score))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{platform.value.reasoning}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-sm text-slate-100">{report.metrics.platformPerformancePredictions.summary}</p>
              <p className="mt-1 text-xs text-slate-400">{report.metrics.platformPerformancePredictions.visualization}</p>
              <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.platformPerformancePredictions.action}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Improvement Suggestions</p>
                <div className="mt-3 space-y-2 text-sm text-slate-100">
                  {report.metrics.improvementSuggestions.suggestions.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">{report.metrics.improvementSuggestions.summary}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-200">
                  <BarChart3 className="h-4 w-4 text-[#f8e8b5]" />
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">JSON Analytics Output</p>
                </div>
                <pre className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-slate-200">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#f8e8b5]">
                <Sparkles className="h-4 w-4" />
                {report.motivationalNote}
              </p>
            </div>
          </motion.section>
        ) : null}
      </main>
    </GlowBackdrop>
  );
};

export default Feedback;
