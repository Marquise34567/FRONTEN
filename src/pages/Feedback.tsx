import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import RetentionLineGraph from "@/features/autoeditor/components/editor/RetentionLineGraph";
import type { RetentionHeatCell, RetentionPoint } from "@/features/autoeditor/types";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import { API_URL, ApiError, apiFetch, resolveApiMediaUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Loader2, PlayCircle, Sparkles, WandSparkles } from "lucide-react";

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

type RetentionTimelineMoment = {
  timestampSeconds: number;
  watchedPercent: number;
  category: string;
  label: string;
  note: string;
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
      retentionTimeline?: RetentionTimelineMoment[];
      bestMoments?: RetentionTimelineMoment[];
      weakMoments?: RetentionTimelineMoment[];
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
      actionItems?: Array<{
        id?: string;
        priority?: "high" | "medium" | "low" | string;
        tip?: string;
        impact?: string;
        category?: string;
      }>;
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

type VideoSourceDetail = {
  previewUrl: string | null;
  points: RetentionPoint[];
  heatmap: RetentionHeatCell[];
};

const resolvePredictionWsUrl = (token: string) => {
  const encodedToken = encodeURIComponent(token);
  if (API_URL) {
    try {
      const parsed = new URL(API_URL);
      const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${parsed.host}/ws?token=${encodedToken}`;
    } catch {
      return null;
    }
  }
  if (typeof window === "undefined") return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?token=${encodedToken}`;
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

const toRetentionPointType = (raw: unknown, watchedPct: number, index: number): RetentionPoint["type"] => {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "best" || normalized === "emotional_peak") return "best";
  if (normalized === "hook") return "hook";
  if (normalized === "skip_zone" || normalized === "skip_risk" || normalized === "skip-risk") return "skip_zone";
  if (normalized === "worst") return "worst";
  if (normalized === "low_energy" || normalized === "low-energy") return "worst";
  if (index <= 1 && watchedPct >= 66) return "hook";
  if (watchedPct >= 78) return "best";
  if (watchedPct <= 36) return "skip_zone";
  return "worst";
};

const normalizeTimelinePoints = (raw: any): RetentionPoint[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const timestamp = Number(item?.timestampSeconds ?? item?.timestamp ?? item?.time);
      const watchedPct = Number(item?.watchedPercent ?? item?.watchedPct ?? item?.score);
      if (!Number.isFinite(timestamp) || !Number.isFinite(watchedPct)) return null;
      const safePct = clamp(watchedPct, 0, 100);
      const type = toRetentionPointType(item?.category ?? item?.type, safePct, index);
      return {
        id: String(item?.id || `timeline-${index}-${timestamp.toFixed(2)}`),
        timestamp: Number(Math.max(0, timestamp).toFixed(2)),
        watchedPct: Number(safePct.toFixed(2)),
        type,
        label: String(item?.label || `${type} moment`),
        description: String(item?.note || item?.description || ""),
      } as RetentionPoint;
    })
    .filter((point): point is RetentionPoint => Boolean(point))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const buildHeatmapFromPoints = (points: RetentionPoint[]): RetentionHeatCell[] =>
  points
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => ({
      timestamp: point.timestamp,
      intensity: clamp((100 - point.watchedPct) / 100 + (point.type === "skip_zone" ? 0.16 : 0), 0.14, 1),
    }));

const buildClassicRetentionPoints = (jobPayload: any): RetentionPoint[] => {
  const analysis = jobPayload?.analysis && typeof jobPayload.analysis === "object" ? jobPayload.analysis : {};
  const metadata = analysis?.metadata_summary && typeof analysis.metadata_summary === "object" ? analysis.metadata_summary : {};
  const clips = Array.isArray(metadata?.clips) ? metadata.clips : [];
  const windows = Array.isArray(analysis?.engagementWindows)
    ? analysis.engagementWindows
    : Array.isArray(analysis?.editPlan?.engagementWindows)
      ? analysis.editPlan.engagementWindows
      : [];

  const clipPoints = clips
    .map((clip: any, index: number) => {
      const predicted = Number(clip?.predictedCompletion ?? clip?.predicted_completion);
      if (!Number.isFinite(predicted)) return null;
      const start = Number(clip?.start);
      const end = Number(clip?.end);
      const timestamp = Number.isFinite(start) ? start : Number.isFinite(end) ? Math.max(0, end - 2) : index * 4;
      const safePct = clamp(predicted, 0, 100);
      const type = toRetentionPointType(clip?.type ?? clip?.label, safePct, index);
      return {
        id: `clip-${index}-${timestamp.toFixed(2)}`,
        timestamp: Number(timestamp.toFixed(2)),
        watchedPct: Number(safePct.toFixed(2)),
        type,
        label: String(clip?.title || clip?.label || `Clip ${index + 1}`),
        description: String(clip?.reason || clip?.description || ""),
      } as RetentionPoint;
    })
    .filter((point): point is RetentionPoint => Boolean(point));
  if (clipPoints.length >= 5) {
    return clipPoints.sort((a, b) => a.timestamp - b.timestamp);
  }

  return windows
    .map((window: any, index: number) => {
      const timestamp = Number(window?.time);
      const score = Number(window?.score);
      if (!Number.isFinite(timestamp) || !Number.isFinite(score)) return null;
      const safePct = clamp(score <= 1 ? score * 100 : score, 0, 100);
      const type = toRetentionPointType(null, safePct, index);
      return {
        id: `window-${index}-${timestamp.toFixed(2)}`,
        timestamp: Number(Math.max(0, timestamp).toFixed(2)),
        watchedPct: Number(safePct.toFixed(2)),
        type,
        label: `Window ${index + 1}`,
        description: type === "skip_zone" ? "Viewers may skip this section." : type === "best" ? "Strong retention window." : "Low-energy or drop-off area.",
      } as RetentionPoint;
    })
    .filter((point): point is RetentionPoint => Boolean(point))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const buildVibecutRetentionPoints = (payload: any): RetentionPoint[] => {
  const points = Array.isArray(payload?.retention?.points) ? payload.retention.points : [];
  return points
    .map((point: any, index: number) => {
      const timestamp = Number(point?.timestamp);
      const watchedPct = Number(point?.watchedPct);
      if (!Number.isFinite(timestamp) || !Number.isFinite(watchedPct)) return null;
      return {
        id: String(point?.id || `vibecut-${index}`),
        timestamp: Number(Math.max(0, timestamp).toFixed(2)),
        watchedPct: Number(clamp(watchedPct, 0, 100).toFixed(2)),
        type: toRetentionPointType(point?.type, watchedPct, index),
        label: String(point?.label || `Moment ${index + 1}`),
        description: String(point?.description || ""),
      } as RetentionPoint;
    })
    .filter((point): point is RetentionPoint => Boolean(point))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const buildTrendSignals = (video: RealtimePredictionVideo | null) => {
  if (!video) return null;
  const trendBoost = video.prediction.trend === "rising" ? 1.08 : video.prediction.trend === "falling" ? 0.94 : 1;
  const hookBoost = Number.isFinite(Number(video.prediction.hookStrengthPercent))
    ? clamp(0.9 + Number(video.prediction.hookStrengthPercent) / 100 * 0.2, 0.82, 1.22)
    : 1;
  const liftBoost = Number.isFinite(Number(video.prediction.expectedLiftPercent))
    ? clamp(1 + Number(video.prediction.expectedLiftPercent) / 100, 0.82, 1.3)
    : 1;
  return {
    tiktokShortBoost: Number((trendBoost * hookBoost).toFixed(3)),
    youtubeLongBoost: Number((trendBoost * liftBoost).toFixed(3)),
    instagramCaptionBoost: Number((trendBoost * ((hookBoost + liftBoost) / 2)).toFixed(3)),
  };
};

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
  const [sourceDetail, setSourceDetail] = useState<VideoSourceDetail | null>(null);
  const [loadingSourceDetail, setLoadingSourceDetail] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const autoAnalyzeKeyRef = useRef("");
  const realtimePredictionErrorRef = useRef(false);
  const realtimeFetchInFlightRef = useRef(false);
  const realtimeRefetchQueuedRef = useRef(false);

  const tier = String(me?.subscription?.tier || "free").toLowerCase();
  const isDev = Boolean(me?.flags?.dev);
  const isPremium = isDev || tier !== "free";

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  const selectedRealtimeVideo = useMemo(
    () => realtimeVideos.find((video) => video.jobId === selectedJobId) || null,
    [realtimeVideos, selectedJobId],
  );

  const reportPoints = useMemo(
    () => normalizeTimelinePoints(report?.metrics?.retentionPotential?.retentionTimeline),
    [report],
  );

  const retentionPoints = reportPoints.length ? reportPoints : sourceDetail?.points || [];
  const retentionHeatmap = retentionPoints.length ? buildHeatmapFromPoints(retentionPoints) : sourceDetail?.heatmap || [];
  const selectedPoint = retentionPoints.find((point) => point.id === selectedPointId) || retentionPoints[0] || null;

  const bestMoments = retentionPoints
    .filter((point) => point.type === "best" || point.type === "hook")
    .sort((a, b) => b.watchedPct - a.watchedPct)
    .slice(0, 4);

  const weakMoments = retentionPoints
    .filter((point) => point.type === "worst" || point.type === "skip_zone")
    .sort((a, b) => a.watchedPct - b.watchedPct)
    .slice(0, 4);

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
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let scheduledRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let nextAllowedRefreshAt = 0;

    const clearScheduledRefresh = () => {
      if (scheduledRefreshTimer) {
        window.clearTimeout(scheduledRefreshTimer);
        scheduledRefreshTimer = null;
      }
    };

    const loadRealtimePredictions = async (silent: boolean) => {
      if (realtimeFetchInFlightRef.current) {
        realtimeRefetchQueuedRef.current = true;
        return;
      }
      realtimeFetchInFlightRef.current = true;
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
        realtimeFetchInFlightRef.current = false;
        if (!cancelled && !silent) setLoadingRealtime(false);
        if (!cancelled && realtimeRefetchQueuedRef.current) {
          realtimeRefetchQueuedRef.current = false;
          window.setTimeout(() => {
            void loadRealtimePredictions(true);
          }, 240);
        }
      }
    };

    const queueRefresh = (minDelayMs = 200) => {
      if (cancelled) return;
      const now = Date.now();
      const delay = Math.max(minDelayMs, nextAllowedRefreshAt > now ? nextAllowedRefreshAt - now : 0);
      clearScheduledRefresh();
      scheduledRefreshTimer = window.setTimeout(() => {
        if (cancelled) return;
        nextAllowedRefreshAt = Date.now() + 900;
        void loadRealtimePredictions(true);
      }, delay);
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectSocket();
      }, 2500);
    };

    const connectSocket = () => {
      if (cancelled) return;
      const wsUrl = resolvePredictionWsUrl(accessToken);
      if (!wsUrl) return;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        if (cancelled) return;
        queueRefresh(120);
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        let parsed: any = null;
        try {
          parsed = JSON.parse(String(event.data || "{}"));
        } catch {
          parsed = null;
        }
        if (parsed?.type === "job:update") {
          queueRefresh(180);
        }
      };

      socket.onerror = () => {
        if (cancelled) return;
        try {
          socket?.close();
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        scheduleReconnect();
      };
    };

    void loadRealtimePredictions(false);
    fallbackTimer = window.setInterval(() => {
      void loadRealtimePredictions(true);
    }, 12000);
    connectSocket();

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      clearScheduledRefresh();
      realtimeFetchInFlightRef.current = false;
      realtimeRefetchQueuedRef.current = false;
      try {
        socket?.close();
      } catch {
        // ignore
      }
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

  const fetchSourceDetail = async (jobId: string, sourceType: "classic" | "vibecut") => {
    if (!accessToken || !jobId) return;
    try {
      setLoadingSourceDetail(true);
      if (sourceType === "vibecut") {
        const result = await apiFetch<any>(`/api/vibecut/jobs/${jobId}`, { token: accessToken });
        const previewUrl =
          resolveApiMediaUrl(
            (typeof result?.outputVideoUrl === "string" && result.outputVideoUrl) ||
              (Array.isArray(result?.clipUrls) && typeof result.clipUrls[0] === "string" ? result.clipUrls[0] : null),
          ) || null;
        const points = buildVibecutRetentionPoints(result);
        setSourceDetail({ previewUrl, points, heatmap: buildHeatmapFromPoints(points) });
        return;
      }

      const result = await apiFetch<{ job?: any }>(`/api/jobs/${jobId}`, { token: accessToken });
      const payload = result?.job || {};
      let previewUrl = typeof payload?.outputUrl === "string" ? payload.outputUrl : "";
      if (!previewUrl && Array.isArray(payload?.outputUrls) && typeof payload.outputUrls[0] === "string") {
        previewUrl = payload.outputUrls[0];
      }
      if (!previewUrl) {
        try {
          const fallback = await apiFetch<{ url?: string }>(`/api/jobs/${jobId}/output-url?clip=1`, { token: accessToken });
          previewUrl = typeof fallback?.url === "string" ? fallback.url : "";
        } catch {
          // ignore fallback errors
        }
      }
      const points = buildClassicRetentionPoints(payload);
      setSourceDetail({ previewUrl: resolveApiMediaUrl(previewUrl || "") || null, points, heatmap: buildHeatmapFromPoints(points) });
    } catch {
      setSourceDetail({ previewUrl: null, points: [], heatmap: [] });
    } finally {
      setLoadingSourceDetail(false);
    }
  };

  const handleAnalyze = async (silent = false) => {
    if (!accessToken) return;
    setAnalyzeError(null);
    if (!selectedJobId) {
      if (!silent) {
        toast({ title: "Select a completed render", description: "Choose a render to generate analytics." });
      }
      return;
    }

    try {
      setAnalyzing(true);
      const trendSignals = buildTrendSignals(selectedRealtimeVideo);
      const result = await apiFetch<FeedbackResponse>("/api/feedback/analyze", {
        method: "POST",
        body: JSON.stringify({
          jobId: selectedJobId,
          sourceType: selectedSourceType,
          ...(trendSignals ? { trendSignals } : {}),
        }),
        token: accessToken,
      });
      setReport(result.feedback);
      if (!silent) {
        toast({ title: "Analytics ready", description: "Single-video report generated." });
      }
    } catch (error: any) {
      if (error instanceof ApiError && error.code === "PREMIUM_REQUIRED") {
        navigate("/pricing");
        return;
      }
      const message = error?.message || "Please try again.";
      setAnalyzeError(message);
      if (!silent) {
        toast({ title: "Analysis failed", description: message, variant: "destructive" });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const seekToPoint = (point: RetentionPoint) => {
    setSelectedPointId(point.id);
    if (previewRef.current) {
      previewRef.current.currentTime = Math.max(0, point.timestamp);
      void previewRef.current.play().catch(() => null);
    }
  };

  useEffect(() => {
    if (!selectedJobId || !accessToken || loadingMe || !isPremium) return;
    void fetchSourceDetail(selectedJobId, selectedSourceType);
  }, [selectedJobId, selectedSourceType, accessToken, loadingMe, isPremium]);

  useEffect(() => {
    if (!selectedJobId || !accessToken || loadingMe || !isPremium) return;
    const key = `${selectedSourceType}:${selectedJobId}`;
    if (autoAnalyzeKeyRef.current === key) return;
    autoAnalyzeKeyRef.current = key;
    setReport(null);
    setSelectedPointId(null);
    void handleAnalyze(true);
  }, [selectedJobId, selectedSourceType, accessToken, loadingMe, isPremium, selectedRealtimeVideo?.prediction?.trend]);

  useEffect(() => {
    if (!retentionPoints.length) {
      setSelectedPointId(null);
      return;
    }
    const hasSelected = retentionPoints.some((point) => point.id === selectedPointId);
    if (!hasSelected) setSelectedPointId(retentionPoints[0].id);
  }, [retentionPoints, selectedPointId]);

  if (loadingMe) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen px-4 pb-16 pt-24">
          <div className="mx-auto flex max-w-4xl items-center justify-center rounded-3xl border border-[#34f0d0]/25 bg-black/35 p-10 backdrop-blur-xl">
            <Loader2 className="h-6 w-6 animate-spin text-[#34f0d0]" />
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
          <div className="mx-auto max-w-4xl rounded-3xl border border-[#34f0d0]/35 bg-[linear-gradient(140deg,rgba(10,12,18,0.96),rgba(17,14,9,0.95))] p-8 shadow-[0_35px_110px_-60px_rgba(52,240,208,0.72)] backdrop-blur-xl">
            <Badge className="border border-[#34f0d0]/45 bg-[#34f0d0]/15 text-[#f8e8b5]">Premium Feature</Badge>
            <h1 className="mt-4 text-3xl font-bold text-white">Single-Video Analytics</h1>
            <p className="mt-2 text-sm text-slate-300">
              Upgrade to unlock per-video dynamic analytics, retention intelligence, and platform predictions.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
              Free tier users are redirected to pricing. Paid and dev users can generate premium feedback reports.
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-xl bg-gradient-to-r from-[#34f0d0] to-[#f8e8b5] text-[#1f1b13] hover:brightness-110">
                <Link to="/pricing">Upgrade to Unlock Analytics</Link>
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
          className="mx-auto max-w-6xl rounded-3xl border border-[#34f0d0]/35 bg-[radial-gradient(circle_at_top_left,rgba(52,240,208,0.2),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(255,245,214,0.1),transparent_55%),linear-gradient(145deg,rgba(9,11,17,0.95),rgba(13,16,24,0.94))] p-6 shadow-[0_34px_120px_-68px_rgba(52,240,208,0.82)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#f3d77f]/85">Premium Intelligence</p>
              <h1 className="mt-2 bg-gradient-to-r from-[#f8e8b5] via-[#34f0d0] to-[#f5d48f] bg-clip-text text-3xl font-bold text-transparent">
                Single-Video Analytics
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                One selected render at a time with deep retention insights, preview jumps, and platform-fit guidance.
              </p>
            </div>
            <Badge className="border border-[#34f0d0]/45 bg-[#34f0d0]/12 text-[#f8e8b5]">
              {isDev ? "Dev Access" : "Premium"}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-[#34f0d0]/30 bg-black/30 p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Select Rendered Video</p>
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
                onClick={() => void handleAnalyze(false)}
                disabled={analyzing}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#34f0d0] to-[#f8e8b5] text-[#1f1b13] shadow-[0_0_24px_rgba(52,240,208,0.45)] hover:brightness-110"
              >
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                Regenerate Analytics
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
              <div className="mt-3 rounded-xl border border-[#34f0d0]/25 bg-[#34f0d0]/10 p-3 text-xs text-[#f8e8b5]">
                {report ? report.classification.reason : "Run analytics to get short/long-form classification and performance prediction."}
              </div>
            </div>
          </div>
        </motion.section>

        <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[#34f0d0]/30 bg-black/25 p-4 backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Realtime Signal (Selected Video)</p>
              <p className="mt-1 text-sm text-slate-300">
                Trend heuristics are applied to this single render only.
              </p>
            </div>
            <Badge className="border border-cyan-300/45 bg-cyan-500/15 text-cyan-100">
              LIVE {realtimeGeneratedAt ? `• ${formatDateTime(realtimeGeneratedAt)}` : "• syncing"}
            </Badge>
          </div>

          {loadingRealtime && !selectedRealtimeVideo ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
              Loading selected video telemetry...
            </div>
          ) : selectedRealtimeVideo ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{selectedRealtimeVideo.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {sourceLabel(selectedRealtimeVideo.sourceType)} • {formatDateTime(selectedRealtimeVideo.prediction.updatedAt || selectedRealtimeVideo.updatedAt)}
                  </p>
                </div>
                <Badge className={statusTone(selectedRealtimeVideo.status)}>{formatStatus(selectedRealtimeVideo.status)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Trend</p>
                  <p className={`mt-0.5 text-sm font-semibold ${trendTone(selectedRealtimeVideo.prediction.trend)}`}>{trendLabel(selectedRealtimeVideo.prediction.trend)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Expected Lift</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-100">{formatLift(selectedRealtimeVideo.prediction.expectedLiftPercent)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-300">{selectedRealtimeVideo.prediction.summary}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-300">
              No telemetry found for this render yet.
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
                <Badge className="border border-[#34f0d0]/45 bg-[#34f0d0]/12 text-[#f8e8b5]">
                  {report.classification.type === "short-form" ? "Short-form" : "Long-form"}
                </Badge>
                <Badge className="border border-white/20 bg-white/5 text-slate-200">Source: {report.source.type}</Badge>
                <Badge className="border border-white/20 bg-white/5 text-slate-200">Video: {report.source.title}</Badge>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.25fr,0.75fr]">
              <div className="rounded-2xl border border-[#34f0d0]/25 bg-black/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Preview + Best Parts</p>
                  {loadingSourceDetail ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading preview
                    </span>
                  ) : null}
                </div>
                {sourceDetail?.previewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-black">
                    <video
                      ref={previewRef}
                      src={sourceDetail.previewUrl}
                      controls
                      preload="metadata"
                      className="aspect-video w-full object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-10 text-center text-sm text-slate-300">
                    Preview unavailable for this render.
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {bestMoments.map((point) => (
                    <button
                      key={`best-${point.id}`}
                      type="button"
                      onClick={() => seekToPoint(point)}
                      className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-100 transition hover:border-emerald-200/65"
                    >
                      <p className="font-semibold">Best • {point.timestamp.toFixed(1)}s</p>
                      <p className="mt-0.5">{point.description || point.label}</p>
                    </button>
                  ))}
                  {weakMoments.slice(0, 2).map((point) => (
                    <button
                      key={`weak-${point.id}`}
                      type="button"
                      onClick={() => seekToPoint(point)}
                      className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-100 transition hover:border-rose-200/65"
                    >
                      <p className="font-semibold">{point.type === "skip_zone" ? "Skip Risk" : "Low Energy"} • {point.timestamp.toFixed(1)}s</p>
                      <p className="mt-0.5">{point.description || point.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Current Focus</p>
                {selectedPoint ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-sm font-semibold text-slate-100">
                      {selectedPoint.type === "skip_zone" ? "Skip Risk" : selectedPoint.type === "worst" ? "Low Energy" : selectedPoint.type === "best" ? "Best Moment" : "Hook"} • {selectedPoint.timestamp.toFixed(1)}s
                    </p>
                    <p className="mt-1 text-xs text-slate-300">{selectedPoint.description || selectedPoint.label}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#34f0d0] via-[#f5d48f] to-[#f8e8b5]"
                        style={{ width: `${Math.max(4, Math.min(100, selectedPoint.watchedPct))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{selectedPoint.watchedPct.toFixed(1)}% estimated hold</p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-300">
                    Select a graph marker to inspect that moment.
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-[#34f0d0]/25 bg-[#34f0d0]/10 p-3 text-xs text-[#f8e8b5]">
                  {report.metrics.retentionPotential.action}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#34f0d0]/25 bg-black/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#f3d77f]/85">Retention Timeline</p>
                  <p className="mt-1 text-sm text-slate-300">Best, worst, low-energy, and skip-risk markers for this video only.</p>
                </div>
                <Badge className="border border-[#34f0d0]/45 bg-[#34f0d0]/12 text-[#f8e8b5]">
                  Estimated Lift {formatLift(report.metrics.retentionPotential.estimatedLiftPercent)}
                </Badge>
              </div>
              <RetentionLineGraph
                points={retentionPoints}
                heatmap={retentionHeatmap}
                selectedPointId={selectedPoint?.id || null}
                onPointSelect={seekToPoint}
              />
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

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">AI Efficiency Score</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.aiEfficiencyScore.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.aiEfficiencyScore.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.aiEfficiencyScore.action}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Content Optimization Breakdown</p>
                <p className="mt-2 text-sm text-slate-100">{report.metrics.contentOptimizationBreakdown.summary}</p>
                <p className="mt-2 text-xs text-slate-400">{report.metrics.contentOptimizationBreakdown.visualization}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.contentOptimizationBreakdown.action}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Platform Performance Predictions</p>
                <Badge className="border border-[#34f0d0]/45 bg-[#34f0d0]/12 text-[#f8e8b5]">
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
                        className="h-full rounded-full bg-gradient-to-r from-[#34f0d0] via-[#f5d48f] to-[#f8e8b5]"
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
                  {(Array.isArray(report.metrics.improvementSuggestions.actionItems) && report.metrics.improvementSuggestions.actionItems.length
                    ? report.metrics.improvementSuggestions.actionItems
                    : report.metrics.improvementSuggestions.suggestions.map((tip, index) => ({
                        id: `fallback-${index}`,
                        priority: index < 2 ? "high" : index < 4 ? "medium" : "low",
                        tip,
                      }))
                  ).map((item: any, index: number) => (
                    <div key={`${item?.id || "tip"}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p>{String(item?.tip || item)}</p>
                        <Badge className="border border-white/20 bg-white/5 text-slate-200">{String(item?.priority || "medium").toUpperCase()}</Badge>
                      </div>
                      {item?.impact ? <p className="text-xs text-slate-400">{String(item.impact)}</p> : null}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">{report.metrics.improvementSuggestions.summary}</p>
                <p className="mt-2 text-xs text-[#f8e8b5]">{report.metrics.improvementSuggestions.visualization}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-slate-200">
                  <BarChart3 className="h-4 w-4 text-[#f8e8b5]" />
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Computed Metrics Object</p>
                </div>
                <pre className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-slate-200">
                  {JSON.stringify(report.metrics, null, 2)}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-[#34f0d0]/30 bg-[#34f0d0]/10 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#f8e8b5]">
                <Sparkles className="h-4 w-4" />
                {report.motivationalNote}
              </p>
            </div>
          </motion.section>
        ) : null}
      </main>
      {selectedPoint ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/75 px-4 py-3 shadow-[0_30px_56px_-30px_rgba(0,0,0,0.9)] backdrop-blur-lg"
        >
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-[#d8ced1]">
            <PlayCircle className="h-3.5 w-3.5" />
            {selectedPoint.type === "skip_zone" ? "Skip Risk" : selectedPoint.type === "worst" ? "Low Energy" : selectedPoint.type === "best" ? "Best Moment" : "Hook"}
          </p>
          <p className="mt-1 text-sm text-[#f9f1e5]">{selectedPoint.description || selectedPoint.label}</p>
          <p className="mt-1 text-xs text-[#bcaeb2]">
            {selectedPoint.timestamp.toFixed(1)}s • {selectedPoint.watchedPct.toFixed(1)}% hold
          </p>
        </motion.div>
      ) : null}
    </GlowBackdrop>
  );
};

export default Feedback;

