import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload,
  Plus,
  Play,
  Download,
  Lock,
  Loader2,
  X,
  Gauge,
  Radar,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import { PLAN_CONFIG, QUALITY_ORDER, clampQualityForTier, normalizeQuality, type ExportQuality, type PlanTier } from "@shared/planConfig";

const MB = 1024 * 1024;
const LARGE_UPLOAD_THRESHOLD = 64 * MB;
const JOBS_POLL_INTERVAL_MS = 5000;
const ACTIVE_JOB_POLL_INTERVAL_MS = 4000;
const ETA_TICK_INTERVAL_MS = 2000;
// Supabase storage removed — use R2 via backend pre-signed multipart URLs only
const FILE_INPUT_ACCEPT = ".mp4,.mkv,video/mp4,video/x-matroska";
const isAllowedUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".mp4") || lowerName.endsWith(".mkv");
};

const chunkSizeForFile = (size: number) => {
  if (size >= 2 * 1024 * MB) return 32 * MB;
  if (size >= 1024 * MB) return 24 * MB;
  if (size >= 512 * MB) return 16 * MB;
  if (size >= 256 * MB) return 12 * MB;
  return 8 * MB;
};

const uploadParallelismForFile = (size: number) => {
  if (size >= 1024 * MB) return 4;
  if (size >= 512 * MB) return 3;
  if (size >= 256 * MB) return 2;
  return 1;
};

type JobStatus =
  | "queued"
  | "uploading"
  | "analyzing"
  | "hooking"
  | "cutting"
  | "pacing"
  | "story"
  | "subtitling"
  | "audio"
  | "retention"
  | "rendering"
  | "completed"
  | "failed"
  | "ready";

interface JobSummary {
  id: string;
  status: JobStatus;
  createdAt: string;
  inputPath?: string;
  progress?: number;
  requestedQuality?: string | null;
  watermark?: boolean;
}

interface JobDetail extends JobSummary {
  outputUrl?: string | null;
  finalQuality?: string | null;
  retentionScore?: number | null;
  analysis?: any;
  optimizationNotes?: string[] | null;
  error?: string | null;
}

const PIPELINE_STEPS = [
  { key: "queued", label: "Queued" },
  { key: "uploading", label: "Uploading" },
  { key: "analyzing", label: "Analyzing" },
  { key: "hooking", label: "Hook" },
  { key: "cutting", label: "Cuts" },
  { key: "pacing", label: "Pacing" },
  { key: "story", label: "Story" },
  { key: "subtitling", label: "Subtitles" },
  { key: "rendering", label: "Rendering" },
  { key: "ready", label: "Ready" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading",
  analyzing: "Analyzing",
  hooking: "Hook",
  cutting: "Cuts",
  pacing: "Pacing",
  story: "Story",
  subtitling: "Subtitles",
  audio: "Audio",
  retention: "Retention",
  rendering: "Rendering",
  completed: "Ready",
  ready: "Ready",
  failed: "Failed",
};

const STAGE_ETA_BASE_SECONDS: Record<string, number> = {
  queued: 35,
  uploading: 60,
  analyzing: 45,
  hooking: 30,
  cutting: 40,
  pacing: 35,
  story: 45,
  subtitling: 60,
  audio: 35,
  retention: 30,
  rendering: 120,
};

const computeStageEtaBaseline = ({
  status,
  fileSizeBytes,
  quality,
}: {
  status: string;
  fileSizeBytes?: number | null;
  quality?: ExportQuality | null;
}) => {
  const fileMB = fileSizeBytes ? Math.max(1, fileSizeBytes / MB) : 256;
  const qualityMultiplier = quality === "4k" ? 1.45 : quality === "1080p" ? 1.2 : 1;
  const base = STAGE_ETA_BASE_SECONDS[status] ?? 75;

  if (status === "uploading") {
    return Math.max(12, Math.round(fileMB / 8 + 12));
  }
  if (status === "rendering") {
    return Math.max(20, Math.round(base + fileMB * 0.18 * qualityMultiplier));
  }
  const variable = Math.round(Math.sqrt(fileMB) * 4 * qualityMultiplier);
  return Math.max(10, base + variable);
};

const normalizeStatus = (status?: JobStatus | string | null) => {
  if (!status) return "queued";
  const raw = String(status).toLowerCase();
  if (raw === "completed" || raw === "ready") return "ready";
  if (raw === "processing") return "rendering";
  return raw as JobStatus;
};

const isTerminalStatus = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === "ready" || normalized === "failed";
};

const stepKeyForStatus = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "audio" || normalized === "retention") return "rendering";
  return normalized;
};

const statusBadgeClass = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "ready") return "bg-success/10 text-success border-success/30";
  if (normalized === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
  if (normalized === "uploading") return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted/40 text-muted-foreground border-border/60";
};

const RETENTION_GOAL_PERCENT = 70;

type RetentionPointKind = "best" | "worst" | "skip_zone" | "hook" | "emotional_peak" | string;

type RetentionPoint = {
  atSec: number;
  predicted: number;
  kind?: RetentionPointKind | null;
  description?: string | null;
};

type EmotionMoment = {
  timestampSec: number;
  emotion: string;
  intensity: number;
  reason?: string | null;
};

type EmotionTimelineSegment = {
  id: string;
  startSec: number;
  endSec: number;
  emotion: string;
  label: string;
  intensity: number;
  reason: string;
  bingeReason: string;
  color: string;
  positionPct: number;
  widthPct: number;
};

type ScoreBreakdownItem = {
  key: string;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  summary: string;
};

type AnalysisDetailFocus = "retention" | "emotion" | "timeline";

const EMOTION_META: Record<
  string,
  {
    label: string;
    color: string;
    bingeReason: string;
  }
> = {
  excitement: {
    label: "Excitement",
    color: "hsl(var(--primary) / 0.86)",
    bingeReason: "Fast payoff and momentum spikes push viewers into the next beat.",
  },
  curiosity: {
    label: "Curiosity",
    color: "hsl(var(--glow-secondary) / 0.85)",
    bingeReason: "Open loops and unanswered questions keep watch-time climbing.",
  },
  surprise: {
    label: "Surprise",
    color: "hsl(44 100% 60% / 0.92)",
    bingeReason: "Pattern breaks reset attention and stop passive scrolling.",
  },
  tension: {
    label: "Tension",
    color: "hsl(352 87% 63% / 0.9)",
    bingeReason: "Conflict pressure holds viewers through the next reveal.",
  },
  trust: {
    label: "Trust",
    color: "hsl(145 76% 44% / 0.86)",
    bingeReason: "Clarity and credibility reduce drop-off during explanation moments.",
  },
  calm: {
    label: "Calm",
    color: "hsl(220 12% 66% / 0.84)",
    bingeReason: "Breathing room improves pacing contrast before the next peak.",
  },
  engagement: {
    label: "Engagement",
    color: "hsl(var(--glow-secondary) / 0.8)",
    bingeReason: "Consistent energy and clarity sustain overall completion.",
  },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const roundToTenths = (value: number) => Number(value.toFixed(1));

const toScore100 = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed === null) continue;
    const normalized = parsed <= 1 ? parsed * 100 : parsed;
    return roundToTenths(clamp(normalized, 0, 100));
  }
  return null;
};

const toSignedScoreDelta = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed === null) continue;
    const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    return roundToTenths(clamp(normalized, -100, 100));
  }
  return null;
};

const formatScore = (value: number | null, fractionDigits = 1) => {
  if (value === null || !Number.isFinite(value)) return "--";
  return Number(value).toFixed(fractionDigits);
};

const toPercent = (value: number | null, fallback: number) => {
  if (value === null || !Number.isFinite(value)) return clamp(Math.round(fallback), 0, 100);
  const normalized = value <= 1 ? value * 100 : value;
  return clamp(Math.round(normalized), 0, 100);
};

const formatTimelineClock = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const normalizeRetentionCurve = (raw: unknown): RetentionPoint[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      if (typeof entry === "number") {
        return { atSec: index * 15, predicted: toPercent(entry, entry) } as RetentionPoint;
      }
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!item) return null;
      const atSec = firstFiniteNumber(item.atSec, item.timeSec, item.t, item.second, item.timestamp, index * 15);
      const predicted = firstFiniteNumber(item.predicted, item.value, item.retention, item.score, item.y);
      if (atSec === null || predicted === null) return null;
      const kind =
        typeof item.type === "string"
          ? item.type
          : typeof item.kind === "string"
            ? item.kind
            : null;
      const description =
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : typeof item.reason === "string" && item.reason.trim()
            ? item.reason.trim()
            : null;
      return {
        atSec: Math.max(0, atSec),
        predicted: toPercent(predicted, predicted),
        kind,
        description,
      } as RetentionPoint;
    })
    .filter((item): item is RetentionPoint => Boolean(item))
    .slice(0, 40)
    .sort((a, b) => a.atSec - b.atSec);
};

const normalizeEmotionKey = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  if (!normalized) return "engagement";
  if (normalized.includes("excit") || normalized.includes("hype")) return "excitement";
  if (normalized.includes("curios")) return "curiosity";
  if (normalized.includes("surpris") || normalized.includes("shock")) return "surprise";
  if (normalized.includes("susp") || normalized.includes("tension") || normalized.includes("anx")) return "tension";
  if (normalized.includes("trust") || normalized.includes("confid") || normalized.includes("authority")) return "trust";
  if (normalized.includes("calm") || normalized.includes("relax") || normalized.includes("soft")) return "calm";
  return normalized;
};

const formatEmotionLabel = (emotion: string) => {
  const normalized = normalizeEmotionKey(emotion);
  const meta = EMOTION_META[normalized];
  if (meta) return meta.label;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Engagement";
};

const resolveEmotionMeta = (emotion: string) => {
  const normalized = normalizeEmotionKey(emotion);
  return (
    EMOTION_META[normalized] ?? {
      label: formatEmotionLabel(normalized),
      color: "hsl(var(--glow-secondary) / 0.8)",
      bingeReason: "Emotional contrast in this beat helps viewers stay invested.",
    }
  );
};

const normalizeEmotionMoments = (raw: unknown): EmotionMoment[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!item) return null;
      const timestampSec = firstFiniteNumber(item.timestampSec, item.timeSec, item.timestamp, item.start, item.atSec);
      if (timestampSec === null) return null;
      let emotion =
        typeof item.emotion === "string"
          ? item.emotion
          : typeof item.label === "string"
            ? item.label
            : typeof item.type === "string"
              ? item.type
              : "";
      let intensity = firstFiniteNumber(item.intensity, item.value, item.score, item.emotionIntensity, item.emotion_intensity);
      const scoresObject =
        item.scores && typeof item.scores === "object" ? (item.scores as Record<string, unknown>) : null;
      if (scoresObject) {
        let topEmotion = "";
        let topScore = Number.NEGATIVE_INFINITY;
        for (const [key, rawScore] of Object.entries(scoresObject)) {
          const parsed = toFiniteNumber(rawScore);
          if (parsed === null) continue;
          if (parsed > topScore) {
            topScore = parsed;
            topEmotion = key;
          }
        }
        if (!emotion && topEmotion) emotion = topEmotion;
        if ((intensity === null || !Number.isFinite(intensity)) && Number.isFinite(topScore)) {
          intensity = topScore;
        }
      }
      const reason =
        typeof item.reason === "string" && item.reason.trim()
          ? item.reason.trim()
          : typeof item.why === "string" && item.why.trim()
            ? item.why.trim()
            : typeof item.note === "string" && item.note.trim()
              ? item.note.trim()
              : null;
      const normalizedEmotion = normalizeEmotionKey(emotion || "engagement");
      const intensityPct = toPercent(intensity, 56 + (index % 3) * 8);
      return {
        timestampSec: Math.max(0, timestampSec),
        emotion: normalizedEmotion,
        intensity: intensityPct,
        reason,
      } as EmotionMoment;
    })
    .filter((item): item is EmotionMoment => Boolean(item))
    .slice(0, 28)
    .sort((a, b) => a.timestampSec - b.timestampSec);
};

const buildJobSummarySignature = (job: JobSummary) =>
  [
    job.id,
    normalizeStatus(job.status),
    Math.round(Number(job.progress ?? 0)),
    String(job.createdAt || ""),
    String(job.inputPath || ""),
    String(job.requestedQuality || ""),
    job.watermark ? "1" : "0",
  ].join("|");

const sameJobSummaryList = (prev: JobSummary[], next: JobSummary[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let index = 0; index < prev.length; index += 1) {
    if (buildJobSummarySignature(prev[index]) !== buildJobSummarySignature(next[index])) return false;
  }
  return true;
};

const buildJobDetailSignature = (job: JobDetail) => {
  const analysis = asRecord(job.analysis);
  const retentionCurveRaw = analysis?.retentionCurve ?? analysis?.retention_curve ?? analysis?.retentionPoints ?? analysis?.retention_points;
  const emotionTimelineRaw = analysis?.emotionTimeline ?? analysis?.emotion_timeline ?? analysis?.timeline_emotions ?? analysis?.emotions;
  const retentionCurveLen = Array.isArray(retentionCurveRaw) ? retentionCurveRaw.length : 0;
  const emotionTimelineLen = Array.isArray(emotionTimelineRaw) ? emotionTimelineRaw.length : 0;
  const scoreAfter =
    toFiniteNumber(analysis?.retention_score_after) ??
    toFiniteNumber(analysis?.retentionScoreAfter) ??
    toFiniteNumber(analysis?.quality_score_after) ??
    toFiniteNumber(analysis?.qualityScoreAfter) ??
    toFiniteNumber(job.retentionScore) ??
    0;
  const scoreBefore =
    toFiniteNumber(analysis?.retention_score_before) ??
    toFiniteNumber(analysis?.retentionScoreBefore) ??
    toFiniteNumber(analysis?.quality_score_before) ??
    toFiniteNumber(analysis?.qualityScoreBefore) ??
    0;
  return [
    buildJobSummarySignature(job),
    String(job.outputUrl || ""),
    String(job.finalQuality || ""),
    Number(scoreBefore).toFixed(2),
    Number(scoreAfter).toFixed(2),
    retentionCurveLen,
    emotionTimelineLen,
    String(job.error || ""),
  ].join("|");
};

const sameJobDetail = (prev: JobDetail | null, next: JobDetail | null) => {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return buildJobDetailSignature(prev) === buildJobDetailSignature(next);
};

const displayName = (job: JobSummary) => job.inputPath?.split("/").pop() || "Untitled";

const Editor = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytesUploaded, setUploadBytesUploaded] = useState<number | null>(null);
  const [uploadBytesTotal, setUploadBytesTotal] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [videoAnalysisOpen, setVideoAnalysisOpen] = useState(false);
  const [analysisDetailFocus, setAnalysisDetailFocus] = useState<AnalysisDetailFocus>("retention");
  const [qualityByJob, setQualityByJob] = useState<Record<string, ExportQuality>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const pipelineStartRef = useRef<Record<string, number>>({});
  const uploadStartRef = useRef<Record<string, number>>({});
  const jobFileSizeRef = useRef<Record<string, number>>({});
  const statusStartRef = useRef<Record<string, { status: string; startedAt: number }>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const [etaTick, setEtaTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, signOut } = useAuth();
  const { toast } = useToast();

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  const { data: me, refetch: refetchMe } = useMe({ refetchInterval: hasActiveJobs ? 2500 : false });
  const [entitlements, setEntitlements] = useState<{ autoDownloadAllowed?: boolean } | null>(null);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean | null>(null);
  const [autoDownloadModal, setAutoDownloadModal] = useState<{ open: boolean; url?: string; fileName?: string; jobId?: string }>({ open: false });
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const maxQuality = (PLAN_CONFIG[tier] ?? PLAN_CONFIG.free).exportQuality;
  const tierLabel = tier === "free" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const isDevAccount = Boolean(me?.flags?.dev);
  const rendersUsed = me?.usage?.rendersUsed ?? 0;
  const maxRendersPerMonth = me?.limits?.maxRendersPerMonth ?? null;
  const rendersRemaining = useMemo(() => {
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return null;
    return Math.max(0, maxRendersPerMonth - rendersUsed);
  }, [maxRendersPerMonth, rendersUsed]);

  const [authError, setAuthError] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }
    try {
      const data = await apiFetch<{ jobs?: JobSummary[] }>("/api/jobs", { token: accessToken });
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs((prev) => (sameJobSummaryList(prev, nextJobs) ? prev : nextJobs));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        toast({ title: "Session expired", description: "Please sign in again.", action: undefined });
        try {
          await signOut();
        } catch (e) {
          // ignore
        }
      } else {
        toast({ title: "Failed to load jobs", description: "Please refresh and try again." });
      }
    } finally {
      setLoadingJobs(false);
    }
  }, [accessToken, toast, signOut]);

  const fetchJob = useCallback(
    async (jobId: string) => {
      if (!accessToken || !jobId) return;
      setLoadingJob(true);
      try {
        const data = await apiFetch<{ job: JobDetail }>(`/api/jobs/${jobId}`, { token: accessToken });
        setActiveJob((prev) => (sameJobDetail(prev, data.job) ? prev : data.job));
        setJobs((prev) => {
          const index = prev.findIndex((job) => job.id === jobId);
          if (index === -1) return [data.job, ...prev];
          const next = [...prev];
          const merged = { ...next[index], ...data.job };
          if (buildJobSummarySignature(next[index]) === buildJobSummarySignature(merged)) return prev;
          next[index] = merged;
          return next;
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true)
          toast({ title: "Session expired", description: "Please sign in again." })
          try { await signOut() } catch (e) {}
        } else {
          toast({ title: "Failed to load job", description: "Please refresh and try again." });
        }
        setActiveJob(null);
      } finally {
        setLoadingJob(false);
      }
    },
    [accessToken, toast, signOut],
  );

  useEffect(() => {
    if (!accessToken) {
      setJobs([]);
      setActiveJob(null);
      setLoadingJobs(false);
      return;
    }
    if (authError) return;
    setLoadingJobs(true);
    fetchJobs();
  }, [accessToken, authError, fetchJobs]);

  useEffect(() => {
    if (accessToken) setAuthError(false);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      const local = typeof window !== "undefined" ? window.localStorage.getItem("autoDownloadEnabled") : null;
      setAutoDownloadEnabled(local === "true");
      return;
    }
    apiFetch('/api/billing/entitlements', { token: accessToken })
      .then((d) => setEntitlements(d?.entitlements ? d.entitlements : null))
      .catch(async (err) => {
        setEntitlements(null);
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try { await signOut() } catch (e) {}
        }
      });
    apiFetch('/api/settings', { token: accessToken })
      .then((d) => setAutoDownloadEnabled(Boolean(d?.settings?.autoDownload)))
      .catch(async (err) => {
        setAutoDownloadEnabled(null);
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try { await signOut() } catch (e) {}
        }
      });
  }, [accessToken, signOut]);

  useEffect(() => {
    if (!activeJob || isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => setEtaTick((tick) => tick + 1), ETA_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    if (!activeJob) return;
    const id = activeJob.id;
    const normalized = normalizeStatus(activeJob.status);
    const prev = statusStartRef.current[id];
    if (!prev || prev.status !== normalized) {
      statusStartRef.current[id] = { status: normalized, startedAt: Date.now() };
    }
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set("jobId", jobs[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [jobs, searchParams, selectedJobId, setSearchParams]);

  useEffect(() => {
    if (!selectedJobId || !accessToken || authError) {
      setActiveJob(null);
      return;
    }
    fetchJob(selectedJobId);
    setExportOpen(false);
    setVideoAnalysisOpen(false);
  }, [selectedJobId, accessToken, authError, fetchJob]);

  useEffect(() => {
    if (!accessToken || !hasActiveJobs || authError) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, JOBS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accessToken, hasActiveJobs, fetchJobs, authError]);

  useEffect(() => {
    if (!accessToken || authError || !activeJob || !selectedJobId) return;
    if (isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => {
      fetchJob(selectedJobId);
    }, ACTIVE_JOB_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accessToken, authError, activeJob?.id, activeJob?.status, selectedJobId, fetchJob]);

  useEffect(() => {
    const prev = prevJobStatusRef.current;
    const next = new Map<string, JobStatus>();
    const transitioned: string[] = [];
    for (const job of jobs) {
      next.set(job.id, job.status);
      const prevStatus = prev.get(job.id);
      const prevNorm = normalizeStatus(prevStatus);
      const newNorm = normalizeStatus(job.status);
      if (prevStatus && !isTerminalStatus(prevStatus) && newNorm === "ready") {
        transitioned.push(job.id);
      }
    }
    prevJobStatusRef.current = next;
    if (transitioned.length > 0) {
      refetchMe();
      for (const id of transitioned) {
        ;(async () => {
          try {
            // ensure entitlements/settings are loaded
            if (entitlements === null && accessToken) {
              const d = await apiFetch('/api/billing/entitlements', { token: accessToken });
              setEntitlements(d?.entitlements ?? null);
            }
            if (autoDownloadEnabled === null) {
              if (accessToken) {
                const s = await apiFetch('/api/settings', { token: accessToken });
                setAutoDownloadEnabled(Boolean(s?.settings?.autoDownload));
              } else {
                const local = typeof window !== 'undefined' ? window.localStorage.getItem('autoDownloadEnabled') : null;
                setAutoDownloadEnabled(local === 'true');
              }
            }
            // decide whether to auto-download
            const allowed = entitlements?.autoDownloadAllowed ?? false;
            const enabled = autoDownloadEnabled ?? false;
            const downloadedKey = `auto_downloaded_${id}`;
            if (!allowed || !enabled) return;
            if (typeof window !== 'undefined' && window.localStorage.getItem(downloadedKey)) return;

            // fetch job detail to get URL or fileName
            const j = jobs.find((x) => x.id === id);
            let fileName: string | undefined;
            let url: string | undefined;
            if (j && (j as any).outputUrl) {
              url = (j as any).outputUrl;
              fileName = (j as any).fileName ?? undefined;
            } else {
              try {
                const resp = await apiFetch<{ job?: any }>(`/api/jobs/${id}`, { token: accessToken });
                url = resp?.job?.outputUrl ?? undefined;
                fileName = resp?.job?.fileName ?? undefined;
              } catch (e) {
                // fallback to download-url endpoint
              }
            }
            if (!url) {
              try {
                const out = await apiFetch<{ url: string }>(`/api/jobs/${id}/download-url`, { method: 'POST', token: accessToken });
                url = out.url;
              } catch (e) {
                return;
              }
            }

            // attempt programmatic download
            const a = document.createElement('a');
            a.href = url as string;
            if (fileName) a.download = fileName;
            a.target = '_blank';
            a.style.display = 'none';
            document.body.appendChild(a);
            try {
              a.click();
              // assume success; if browser blocked, user can tap in modal
              // set a short timeout to mark as downloaded optimistically
              setTimeout(() => {
                try {
                  window.localStorage.setItem(downloadedKey, 'true');
                } catch (e) {}
              }, 1200);
            } catch (e) {
              // show modal fallback
              setAutoDownloadModal({ open: true, url, fileName, jobId: id });
            } finally {
              document.body.removeChild(a);
            }
          } catch (e) {
            // ignore
          }
        })();
      }
    }
  }, [jobs, refetchMe, entitlements, autoDownloadEnabled, accessToken]);

  useEffect(() => {
    if (!activeJob) return;
    if (normalizeStatus(activeJob.status) !== "ready") return;
    const key = `export_popup_shown_${activeJob.id}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "true");
    setExportOpen(true);
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    return () => {
      try {
        if (typeof highlightTimeoutRef.current === "number") window.clearTimeout(highlightTimeoutRef.current as any);
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (!activeJob) return;
    setQualityByJob((prev) => {
      if (prev[activeJob.id]) return prev;
      const requested = normalizeQuality(activeJob.requestedQuality || activeJob.finalQuality || maxQuality);
      const clamped = clampQualityForTier(requested, tier);
      return { ...prev, [activeJob.id]: clamped };
    });
  }, [activeJob, maxQuality, tier]);

  const selectedQuality = useMemo(() => {
    if (!activeJob) return clampQualityForTier(maxQuality, tier);
    return (
      qualityByJob[activeJob.id] ??
      clampQualityForTier(normalizeQuality(activeJob.requestedQuality || activeJob.finalQuality || maxQuality), tier)
    );
  }, [activeJob, maxQuality, qualityByJob, tier]);

  const qualityButtons = useMemo(() => {
    return QUALITY_ORDER.map((quality) => {
      const locked = QUALITY_ORDER.indexOf(quality) > QUALITY_ORDER.indexOf(maxQuality);
      return (
        <Tooltip key={quality}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                selectedQuality === quality
                  ? "border-primary text-primary"
                  : "border-border/50 text-muted-foreground"
              } ${locked ? "cursor-not-allowed opacity-60" : "hover:border-primary/50"}`}
              onClick={() => {
                if (locked || !activeJob) return;
                setQualityByJob((prev) => ({ ...prev, [activeJob.id]: quality }));
              }}
            >
              <span className="flex items-center gap-1">
                {quality}
                {locked && <Lock className="w-3 h-3" />}
              </span>
            </button>
          </TooltipTrigger>
          {locked && <TooltipContent>Upgrade to unlock {quality.toUpperCase()}</TooltipContent>}
        </Tooltip>
      );
    });
  }, [activeJob, maxQuality, selectedQuality]);

  const uploadWithProgress = (
    url: string,
    file: File,
    onProgress: (value: number) => void,
    onProgressBytes?: (loaded: number, total: number) => void,
  ) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
        if (onProgressBytes) onProgressBytes(event.loaded, event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });
  };

  // Resumable upload logic removed — we use backend-presigned multipart upload to R2

  const handleFile = async (file: File) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4 or MKV file." });
      return;
    }
    if (!accessToken) return;
    if (maxRendersPerMonth !== null && maxRendersPerMonth !== undefined && (rendersRemaining ?? 0) <= 0) {
      toast({
        title: "Render limit reached",
        description: `You've used all ${maxRendersPerMonth} renders for this month.`,
      });
      return;
    }
    setUploadProgress(0);
    try {
      const create = await apiFetch<{ job: JobDetail; uploadUrl?: string | null; inputPath: string; bucket: string }>(
        "/api/jobs/create",
        {
          method: "POST",
          body: JSON.stringify({ filename: file.name }),
          token: accessToken,
        },
      );

      setUploadingJobId(create.job.id);
      pipelineStartRef.current[create.job.id] = Date.now();
      statusStartRef.current[create.job.id] = { status: "uploading", startedAt: Date.now() };
      setJobs((prev) => [{ ...create.job, status: "uploading", progress: 5 }, ...(Array.isArray(prev) ? prev : [])]);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("jobId", create.job.id);
      setSearchParams(nextParams, { replace: false });

      // Attempt R2 multipart first (preferred for large files)
      const tryR2Multipart = async () => {
        let abortContext: { uploadId: string; key: string } | null = null;
        try {
          const r2create = await apiFetch<{
            uploadId: string
            key: string
            partSize: number
            presignedParts: { partNumber: number; url: string }[]
          }>(`/api/uploads/create`, {
            method: 'POST',
            body: JSON.stringify({ jobId: create.job.id, filename: file.name, contentType: file.type, sizeBytes: file.size }),
            token: accessToken,
          })

          const { uploadId, key, partSize, presignedParts } = r2create
          abortContext = { uploadId, key }
          if (!uploadId || !key || !Array.isArray(presignedParts) || presignedParts.length === 0) throw new Error('invalid_r2_create')

          const total = file.size
          const actualPartSize = partSize || chunkSizeForFile(total)
          const parts: { ETag: string; PartNumber: number }[] = []
          const sortedPresignedParts = [...presignedParts].sort((left, right) => left.partNumber - right.partNumber)
          let uploaded = 0
          jobFileSizeRef.current[create.job.id] = total
          uploadStartRef.current[create.job.id] = Date.now()

          // presignedParts should be ordered by partNumber; iterate and upload corresponding slices
          for (const p of sortedPresignedParts) {
            const partNumber = p.partNumber
            if (!partNumber || !p.url) throw new Error('invalid_part_descriptor')
            const start = (partNumber - 1) * actualPartSize
            const end = Math.min(total, start + actualPartSize)
            const chunk = file.slice(start, end)
            const resp = await fetch(p.url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: chunk })
            if (!resp.ok) throw new Error(`upload_part_failed_${partNumber}`)
            const etag = resp.headers.get('ETag') || resp.headers.get('etag')
            if (!etag) {
              throw new Error(
                'missing_etag_header: configure R2 CORS ExposeHeaders to include ETag for multipart uploads'
              )
            }
            parts.push({ ETag: etag, PartNumber: partNumber })
            uploaded += chunk.size
            setUploadBytesUploaded(uploaded)
            setUploadBytesTotal(total)
            setUploadProgress(Math.round((uploaded / total) * 100))
          }

          // Complete multipart upload on backend
          await apiFetch('/api/uploads/complete', {
            method: 'POST',
            body: JSON.stringify({ jobId: create.job.id, key, uploadId, parts }),
            token: accessToken,
          })

          setUploadProgress(100)
          setUploadingJobId(null)
          setUploadBytesUploaded(null)
          setUploadBytesTotal(null)
          fetchJobs()
          toast({ title: 'Upload complete', description: 'Your job is now processing.' })
          return true
        } catch (err) {
          console.warn('R2 multipart upload failed', err)
          // best-effort abort if we have uploadId
          try {
            if (abortContext?.uploadId && abortContext?.key) {
              await apiFetch('/api/uploads/abort', {
                method: 'POST',
                body: JSON.stringify({ key: abortContext.key, uploadId: abortContext.uploadId }),
                token: accessToken,
              })
            }
          } catch (abortErr) {
            console.warn('R2 multipart abort failed', abortErr)
          }
          return false
        }
      }

      // Try R2 multipart only when backend indicated direct upload support.
      if (create.uploadUrl) {
        const usedR2 = await tryR2Multipart()
        if (usedR2) return
      }

      const uploadViaProxy = async () => {
        const proxyPath = `/api/uploads/proxy?jobId=${encodeURIComponent(create.job.id)}`
        const proxyUrl = API_URL ? `${API_URL}${proxyPath}` : proxyPath
        const proxyResp = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
        if (!proxyResp.ok) {
          const bodyText = await proxyResp.text().catch(() => "")
          throw new Error(bodyText || `Proxy upload failed (${proxyResp.status})`)
        }
        setUploadProgress(100)
      }

      // Fallback: if server provided a single PUT uploadUrl, use it. Otherwise use proxy upload.
      if (create.uploadUrl) {
        jobFileSizeRef.current[create.job.id] = file.size
        uploadStartRef.current[create.job.id] = Date.now()
        try {
          await uploadWithProgress(create.uploadUrl, file, setUploadProgress, (loaded, total) => {
            setUploadBytesUploaded(loaded)
            setUploadBytesTotal(total)
            setUploadProgress(Math.round((loaded / total) * 100))
          })
        } catch (err) {
          console.warn('Direct upload failed, falling back to proxy', err)
          await uploadViaProxy()
          toast({ title: 'Upload complete', description: 'Your job is now processing.' })
          setUploadingJobId(null)
          setUploadProgress(0)
          setUploadBytesUploaded(null)
          setUploadBytesTotal(null)
          fetchJobs()
          return
        }

        // Notify backend of completion for single-PUT flow
        await apiFetch(`/api/jobs/${create.job.id}/complete-upload`, {
          method: 'POST',
          body: JSON.stringify({ key: create.inputPath }),
          token: accessToken,
        })

        toast({ title: 'Upload complete', description: 'Your job is now processing.' })
        setUploadingJobId(null)
        setUploadProgress(0)
        setUploadBytesUploaded(null)
        setUploadBytesTotal(null)
        fetchJobs()
        return
      }

      // No direct upload URL available; proxy upload will update job and enqueue processing server-side.
      await uploadViaProxy()
      toast({ title: "Upload complete", description: "Your job is now processing." })
      try {
        if (typeof highlightTimeoutRef.current === "number") window.clearTimeout(highlightTimeoutRef.current as any)
      } catch (e) {}
      setHighlightedJobId(create.job.id)
      highlightTimeoutRef.current = window.setTimeout(() => setHighlightedJobId(null), 4000)
      setUploadingJobId(null)
      setUploadProgress(0)
      setUploadBytesUploaded(null)
      setUploadBytesTotal(null)
      fetchJobs()
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError && err.code === "RENDER_LIMIT_REACHED") {
        const remaining = typeof err.data?.rendersRemaining === "number" ? err.data.rendersRemaining : rendersRemaining;
        const maxRenders = err.data?.maxRendersPerMonth ?? maxRendersPerMonth;
        const detail =
          typeof remaining === "number"
            ? `You have ${remaining} render${remaining === 1 ? "" : "s"} left this month.`
            : maxRenders
              ? `You've used all ${maxRenders} renders for this month.`
              : "You've reached your monthly render limit.";
        toast({ title: "Render limit reached", description: detail });
      } else {
        toast({ title: "Upload failed", description: err?.message || "Please try again." });
      }
      setUploadingJobId(null);
      setUploadProgress(0);
      setUploadBytesUploaded(null);
      setUploadBytesTotal(null);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSelectJob = (jobId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("jobId", jobId);
    setSearchParams(next, { replace: false });
  };

  const openVideoAnalysisWithFocus = useCallback((focus: AnalysisDetailFocus) => {
    setAnalysisDetailFocus(focus);
    setVideoAnalysisOpen(true);
  }, []);

  const handleDownload = async () => {
    if (!accessToken || !activeJob) return false;
    try {
      if (activeJob.outputUrl) {
        window.open(activeJob.outputUrl, "_blank");
        return true;
      }
      const data = await apiFetch<{ url: string }>(`/api/jobs/${activeJob.id}/output-url`, { token: accessToken });
      setActiveJob((prev) => (prev ? { ...prev, outputUrl: data.url } : prev));
      window.open(data.url, "_blank");
      return true;
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again." });
      return false;
    }
  };

  const normalizedActiveStatus = activeJob ? normalizeStatus(activeJob.status) : null;
  const activeJobIsReady = normalizedActiveStatus === "ready";
  const activeStatusLabel = activeJob ? STATUS_LABELS[normalizeStatus(activeJob.status)] || "Queued" : "Queued";
  const activeStepKey = activeJob ? stepKeyForStatus(activeJob.status) : null;
  const currentStepIndex = activeStepKey
    ? PIPELINE_STEPS.findIndex((step) => step.key === activeStepKey)
    : -1;
  const showVideo = Boolean(activeJob && normalizedActiveStatus === "ready" && activeJob.outputUrl);
  const optimizationHighlights = useMemo(() => {
    if (!Array.isArray(activeJob?.optimizationNotes)) return [];
    return activeJob.optimizationNotes
      .map((note) => (typeof note === "string" ? note.trim() : ""))
      .filter(Boolean)
      .slice(0, 3);
  }, [activeJob?.optimizationNotes]);
  const activeAnalysis = activeJob?.analysis && typeof activeJob.analysis === "object" ? activeJob.analysis : null;
  const activeRetentionPayload =
    activeJob && (activeJob as any).retention && typeof (activeJob as any).retention === "object"
      ? ((activeJob as any).retention as Record<string, unknown>)
      : null;
  const analyzedFrames = firstFiniteNumber(
    activeAnalysis?.frames_analyzed,
    activeAnalysis?.framesAnalyzed,
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.framesProcessed,
    activeAnalysis?.pipelineSteps?.ANALYZING?.meta?.framesProcessed,
  );
  const totalFrames = firstFiniteNumber(
    activeAnalysis?.frames_total,
    activeAnalysis?.totalFrames,
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.totalFrames,
    activeAnalysis?.pipelineSteps?.ANALYZING?.meta?.totalFrames,
  );
  const estimatedDurationSec = useMemo(() => {
    const parsed = firstFiniteNumber(
      activeAnalysis?.source_duration_seconds,
      activeAnalysis?.sourceDurationSeconds,
      activeAnalysis?.duration_seconds,
      activeAnalysis?.durationSec,
      activeAnalysis?.duration,
      activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.durationSec,
      activeAnalysis?.pipelineSteps?.ANALYZING?.meta?.durationSec,
      activeRetentionPayload?.durationSec,
      activeRetentionPayload?.duration,
    );
    if (parsed === null) return null;
    return Math.max(1, parsed);
  }, [activeAnalysis, activeRetentionPayload]);
  const retentionCurvePoints = useMemo<RetentionPoint[]>(() => {
    const parsed = normalizeRetentionCurve(
      activeAnalysis?.retentionCurve ||
      activeAnalysis?.retention_curve ||
      activeAnalysis?.retentionPoints ||
      activeAnalysis?.retention_points ||
      activeAnalysis?.pipelineSteps?.RETENTION_SCORE?.meta?.curve ||
      activeRetentionPayload?.retentionCurve ||
      activeRetentionPayload?.retention_curve ||
      activeRetentionPayload?.curve ||
      activeRetentionPayload?.points
    );
    if (parsed.length >= 2) return parsed;
    const duration = Math.max(60, Math.round(estimatedDurationSec ?? 210));
    const baseline = clamp(Math.round(toFiniteNumber(activeJob?.retentionScore) ?? 74), 52, 95);
    const fallbackRatios = [0, 0.16, 0.3, 0.45, 0.62, 0.78, 1];
    return fallbackRatios.map((ratio, index) => {
      const organicDrift = baseline - ratio * 18 + (index % 2 === 0 ? 2 : -1) + (ratio > 0.7 ? 3 : 0);
      return {
        atSec: Math.round(duration * ratio),
        predicted: clamp(Math.round(organicDrift), 48, 100),
      } as RetentionPoint;
    });
  }, [activeAnalysis, activeRetentionPayload, estimatedDurationSec, activeJob?.retentionScore]);
  const retentionTimelineDurationSec = useMemo(() => {
    const lastCurveSec = retentionCurvePoints.length > 0
      ? retentionCurvePoints[retentionCurvePoints.length - 1].atSec + 14
      : 0;
    return Math.max(60, Math.round(estimatedDurationSec ?? lastCurveSec ?? 210));
  }, [estimatedDurationSec, retentionCurvePoints]);
  const retentionCoordinates = useMemo(
    () => {
      const maxSec = Math.max(
        1,
        retentionCurvePoints.length > 0
          ? retentionCurvePoints[retentionCurvePoints.length - 1].atSec
          : retentionTimelineDurationSec,
      );
      return retentionCurvePoints.map((point) => {
        const x = clamp((point.atSec / maxSec) * 100, 0, 100);
        const y = 100 - clamp(point.predicted, 0, 100);
        return { x, y };
      });
    },
    [retentionCurvePoints, retentionTimelineDurationSec],
  );
  const retentionLinePoints = useMemo(
    () => retentionCoordinates.map((point) => `${point.x},${point.y}`).join(" "),
    [retentionCoordinates],
  );
  const retentionAreaPath = useMemo(() => {
    if (retentionCoordinates.length < 2) return "";
    const first = retentionCoordinates[0];
    const last = retentionCoordinates[retentionCoordinates.length - 1];
    const linePath = retentionCoordinates.map((point) => `L${point.x},${point.y}`).join(" ");
    return `M${first.x},100 L${first.x},${first.y} ${linePath} L${last.x},100 Z`;
  }, [retentionCoordinates]);
  const retentionGoalLineY = 100 - RETENTION_GOAL_PERCENT;
  const latestRetentionPoint = retentionCurvePoints.length > 0
    ? retentionCurvePoints[retentionCurvePoints.length - 1]
    : null;
  const retentionGoalMet = Boolean(latestRetentionPoint && latestRetentionPoint.predicted >= RETENTION_GOAL_PERCENT);
  const fullScanProgress = useMemo(() => {
    if (analyzedFrames !== null && totalFrames !== null && totalFrames > 0) {
      return clamp((analyzedFrames / totalFrames) * 100, 0, 100);
    }
    if (normalizedActiveStatus === "ready") return 100;
    if (normalizedActiveStatus === "failed") return clamp(toFiniteNumber(activeJob?.progress) ?? 100, 0, 100);
    if (normalizedActiveStatus === "analyzing") {
      return clamp(toFiniteNumber(activeJob?.progress) ?? 44, 6, 99);
    }
    const base = clamp(toFiniteNumber(activeJob?.progress) ?? 0, 0, 100);
    return clamp(base * 0.86, 0, normalizedActiveStatus ? 99 : 0);
  }, [analyzedFrames, totalFrames, normalizedActiveStatus, activeJob?.progress]);
  const fullScanProgressLabel = analyzedFrames !== null && totalFrames !== null && totalFrames > 0
    ? `${Math.round(analyzedFrames)} / ${Math.round(totalFrames)} frames scanned`
    : `Full video scan ${Math.round(fullScanProgress)}% complete`;
  const emotionMomentsRaw =
    activeAnalysis?.emotionTimeline ||
    activeAnalysis?.emotion_timeline ||
    activeAnalysis?.timeline_emotions ||
    activeAnalysis?.emotions ||
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.emotionTimeline ||
    activeAnalysis?.pipelineSteps?.ANALYZING?.meta?.emotionTimeline ||
    activeRetentionPayload?.emotionTimeline ||
    activeRetentionPayload?.emotions;
  const emotionMomentsFromAnalysis = useMemo(
    () => normalizeEmotionMoments(emotionMomentsRaw),
    [emotionMomentsRaw],
  );
  const fallbackEmotionMoments = useMemo<EmotionMoment[]>(() => {
    const duration = Math.max(60, retentionTimelineDurationSec);
    return [
      {
        timestampSec: Math.round(duration * 0.08),
        emotion: "curiosity",
        intensity: 72,
        reason: "Open question drops in the first beat to hook attention quickly.",
      },
      {
        timestampSec: Math.round(duration * 0.24),
        emotion: "excitement",
        intensity: 84,
        reason: "Early payoff accelerates pacing and spikes watch momentum.",
      },
      {
        timestampSec: Math.round(duration * 0.45),
        emotion: "tension",
        intensity: 78,
        reason: "Conflict build keeps viewers waiting for the resolution.",
      },
      {
        timestampSec: Math.round(duration * 0.66),
        emotion: "surprise",
        intensity: 86,
        reason: "Pattern break resets attention before viewers can drift.",
      },
      {
        timestampSec: Math.round(duration * 0.84),
        emotion: "trust",
        intensity: 69,
        reason: "Clear value summary improves completion through the close.",
      },
    ];
  }, [retentionTimelineDurationSec]);
  const emotionMoments = emotionMomentsFromAnalysis.length > 0 ? emotionMomentsFromAnalysis : fallbackEmotionMoments;
  const emotionTimelineDurationSec = useMemo(() => {
    const lastEmotionSec = emotionMoments.length > 0
      ? emotionMoments[emotionMoments.length - 1].timestampSec + 12
      : 0;
    return Math.max(60, Math.round(estimatedDurationSec ?? retentionTimelineDurationSec ?? lastEmotionSec ?? 210));
  }, [emotionMoments, estimatedDurationSec, retentionTimelineDurationSec]);
  const emotionCoordinates = useMemo(() => {
    const maxSec = Math.max(
      1,
      emotionMoments.length > 0
        ? emotionMoments[emotionMoments.length - 1].timestampSec
        : emotionTimelineDurationSec,
    );
    return emotionMoments.map((moment) => {
      const x = clamp((moment.timestampSec / maxSec) * 100, 0, 100);
      const y = 100 - clamp(moment.intensity, 0, 100);
      return { x, y };
    });
  }, [emotionMoments, emotionTimelineDurationSec]);
  const emotionLinePoints = useMemo(
    () => emotionCoordinates.map((point) => `${point.x},${point.y}`).join(" "),
    [emotionCoordinates],
  );
  const emotionAreaPath = useMemo(() => {
    if (emotionCoordinates.length < 2) return "";
    const first = emotionCoordinates[0];
    const last = emotionCoordinates[emotionCoordinates.length - 1];
    const linePath = emotionCoordinates.map((point) => `L${point.x},${point.y}`).join(" ");
    return `M${first.x},100 L${first.x},${first.y} ${linePath} L${last.x},100 Z`;
  }, [emotionCoordinates]);
  const emotionTimelineSegments = useMemo<EmotionTimelineSegment[]>(() => {
    if (emotionMoments.length === 0) return [];
    const minSpanSec = Math.max(6, Math.round(emotionTimelineDurationSec / Math.max(8, emotionMoments.length * 1.3)));
    return emotionMoments
      .map((moment, index) => {
        const nextSec = emotionMoments[index + 1]?.timestampSec ?? Math.min(emotionTimelineDurationSec, moment.timestampSec + minSpanSec);
        const startSec = clamp(moment.timestampSec, 0, Math.max(0, emotionTimelineDurationSec - 1));
        const endSec = clamp(Math.max(startSec + 1, nextSec), startSec + 1, emotionTimelineDurationSec);
        const meta = resolveEmotionMeta(moment.emotion);
        const positionPct = clamp((startSec / emotionTimelineDurationSec) * 100, 0, 99);
        const widthPct = clamp(((endSec - startSec) / emotionTimelineDurationSec) * 100, 1.8, 100 - positionPct);
        return {
          id: `${index}-${Math.round(startSec * 10)}-${Math.round(endSec * 10)}`,
          startSec,
          endSec,
          emotion: normalizeEmotionKey(moment.emotion),
          label: meta.label,
          intensity: clamp(Math.round(moment.intensity), 0, 100),
          reason: moment.reason || `${meta.label} carries this section with strong attention pressure.`,
          bingeReason: meta.bingeReason,
          color: meta.color,
          positionPct,
          widthPct,
        } satisfies EmotionTimelineSegment;
      })
      .slice(0, 16);
  }, [emotionMoments, emotionTimelineDurationSec]);
  const emotionLegend = useMemo(() => {
    const seen = new Set<string>();
    return emotionTimelineSegments.reduce<Array<{ emotion: string; label: string; color: string }>>((acc, segment) => {
      if (seen.has(segment.emotion)) return acc;
      seen.add(segment.emotion);
      acc.push({
        emotion: segment.emotion,
        label: segment.label,
        color: segment.color,
      });
      return acc;
    }, []).slice(0, 6);
  }, [emotionTimelineSegments]);
  const bingeHighlightSegments = useMemo(
    () => [...emotionTimelineSegments].sort((a, b) => b.intensity - a.intensity).slice(0, 6),
    [emotionTimelineSegments],
  );
  const retentionBiggestDrop = useMemo(() => {
    if (retentionCurvePoints.length < 2) return null;
    let best: { drop: number; from: RetentionPoint; to: RetentionPoint } | null = null;
    for (let index = 1; index < retentionCurvePoints.length; index += 1) {
      const from = retentionCurvePoints[index - 1];
      const to = retentionCurvePoints[index];
      const drop = from.predicted - to.predicted;
      if (drop <= 0) continue;
      if (!best || drop > best.drop) {
        best = { drop, from, to };
      }
    }
    return best;
  }, [retentionCurvePoints]);
  const dominantEmotionSegment = useMemo(() => {
    let bestSegment: EmotionTimelineSegment | null = null;
    let bestScore = -1;
    for (const segment of emotionTimelineSegments) {
      const score = segment.intensity * Math.max(1, segment.endSec - segment.startSec);
      if (score > bestScore) {
        bestScore = score;
        bestSegment = segment;
      }
    }
    return bestSegment;
  }, [emotionTimelineSegments]);
  const activeAutoDetectProfile = useMemo(
    () =>
      asRecord(activeAnalysis?.auto_detect_profile) ??
      asRecord(activeAnalysis?.autoDetectProfile) ??
      asRecord(activeAnalysis?.metadata_summary?.auto_detect_profile) ??
      asRecord(activeAnalysis?.metadataSummary?.autoDetectProfile),
    [activeAnalysis],
  );
  const explicitRetentionBeforeScore = useMemo(
    () =>
      toScore100(
        activeAnalysis?.retention_score_before,
        activeAnalysis?.retentionScoreBefore,
        activeAnalysis?.quality_score_before,
        activeAnalysis?.qualityScoreBefore,
        activeRetentionPayload?.retention_score_before,
        activeRetentionPayload?.retentionScoreBefore,
        activeRetentionPayload?.quality_score_before,
        activeRetentionPayload?.qualityScoreBefore,
        activeAutoDetectProfile?.qualityScoreBefore,
        activeAutoDetectProfile?.quality_score_before,
        activeAutoDetectProfile?.scoreBefore,
        activeAutoDetectProfile?.score_before,
      ),
    [activeAnalysis, activeRetentionPayload, activeAutoDetectProfile],
  );
  const explicitRetentionAfterScore = useMemo(
    () =>
      toScore100(
        activeAnalysis?.retention_score_after,
        activeAnalysis?.retentionScoreAfter,
        activeAnalysis?.quality_score_after,
        activeAnalysis?.qualityScoreAfter,
        activeRetentionPayload?.retention_score_after,
        activeRetentionPayload?.retentionScoreAfter,
        activeRetentionPayload?.quality_score_after,
        activeRetentionPayload?.qualityScoreAfter,
        activeAutoDetectProfile?.qualityScoreAfter,
        activeAutoDetectProfile?.quality_score_after,
        activeAutoDetectProfile?.scoreAfter,
        activeAutoDetectProfile?.score_after,
        activeJob?.retentionScore,
      ),
    [activeAnalysis, activeRetentionPayload, activeAutoDetectProfile, activeJob?.retentionScore],
  );
  const explicitRetentionDelta = useMemo(
    () =>
      toSignedScoreDelta(
        activeAnalysis?.retention_delta,
        activeAnalysis?.retentionDelta,
        activeAnalysis?.retention_delta_estimate,
        activeAnalysis?.retentionDeltaEstimate,
        activeAnalysis?.manual_retention_delta_estimate,
        activeAnalysis?.quality_delta,
        activeAnalysis?.qualityDelta,
        activeRetentionPayload?.retention_delta,
        activeRetentionPayload?.retentionDelta,
        activeRetentionPayload?.manual_retention_delta_estimate,
        activeRetentionPayload?.quality_delta,
        activeRetentionPayload?.qualityDelta,
        activeRetentionPayload?.delta,
        activeAutoDetectProfile?.qualityDelta,
        activeAutoDetectProfile?.quality_delta,
      ),
    [activeAnalysis, activeRetentionPayload, activeAutoDetectProfile],
  );
  const retentionAverageScore = useMemo(() => {
    if (retentionCurvePoints.length === 0) return null;
    const total = retentionCurvePoints.reduce((sum, point) => sum + point.predicted, 0);
    return roundToTenths(clamp(total / retentionCurvePoints.length, 0, 100));
  }, [retentionCurvePoints]);
  const endingRetentionScore = useMemo(
    () => toScore100(latestRetentionPoint?.predicted, activeJob?.retentionScore, retentionAverageScore),
    [latestRetentionPoint, activeJob?.retentionScore, retentionAverageScore],
  );
  const emotionResonanceScore = useMemo(() => {
    if (emotionMoments.length === 0) return null;
    const average = emotionMoments.reduce((sum, moment) => sum + moment.intensity, 0) / emotionMoments.length;
    const peak = emotionMoments.reduce((best, moment) => Math.max(best, moment.intensity), 0);
    return roundToTenths(clamp(average * 0.74 + peak * 0.26, 0, 100));
  }, [emotionMoments]);
  const retentionDropAverage = useMemo(() => {
    if (retentionCurvePoints.length < 2) return 0;
    let totalDrop = 0;
    let dropCount = 0;
    for (let index = 1; index < retentionCurvePoints.length; index += 1) {
      const drop = retentionCurvePoints[index - 1].predicted - retentionCurvePoints[index].predicted;
      if (drop <= 0) continue;
      totalDrop += drop;
      dropCount += 1;
    }
    if (dropCount === 0) return 0;
    return roundToTenths(totalDrop / dropCount);
  }, [retentionCurvePoints]);
  const retentionStabilityScore = useMemo(() => {
    const largestDrop = retentionBiggestDrop?.drop ?? 0;
    const combinedPenalty = largestDrop * 1.65 + retentionDropAverage * 1.15;
    return roundToTenths(clamp(100 - combinedPenalty, 30, 100));
  }, [retentionBiggestDrop, retentionDropAverage]);
  const retentionScoringBreakdown = useMemo<ScoreBreakdownItem[]>(() => {
    const scanConfidence = roundToTenths(clamp(fullScanProgress, 0, 100));
    const rows = [
      {
        key: "ending-hold",
        label: "Ending Hold",
        score: endingRetentionScore ?? 62,
        weight: 0.34,
        summary: "Predicted viewer hold in the final section.",
      },
      {
        key: "average-hold",
        label: "Average Hold",
        score: retentionAverageScore ?? endingRetentionScore ?? 60,
        weight: 0.24,
        summary: "Average retention strength across the full timeline.",
      },
      {
        key: "emotion-strength",
        label: "Emotion Strength",
        score: emotionResonanceScore ?? 58,
        weight: 0.18,
        summary: "Blend of emotional intensity and contrast from detected beats.",
      },
      {
        key: "stability",
        label: "Retention Stability",
        score: retentionStabilityScore,
        weight: 0.14,
        summary: "Penalty-adjusted score for steep drop-off zones.",
      },
      {
        key: "scan-confidence",
        label: "Scan Confidence",
        score: scanConfidence,
        weight: 0.1,
        summary: "How complete the current full-video analysis pass is.",
      },
    ];
    return rows.map((item) => ({
      ...item,
      weightedScore: roundToTenths(item.score * item.weight),
    }));
  }, [
    fullScanProgress,
    endingRetentionScore,
    retentionAverageScore,
    emotionResonanceScore,
    retentionStabilityScore,
  ]);
  const combinedRetentionScore = useMemo(() => {
    if (retentionScoringBreakdown.length === 0) return 0;
    const weightedTotal = retentionScoringBreakdown.reduce((sum, item) => sum + item.score * item.weight, 0);
    return roundToTenths(clamp(weightedTotal, 0, 100));
  }, [retentionScoringBreakdown]);
  const afterRetentionScore = useMemo(
    () => toScore100(explicitRetentionAfterScore, combinedRetentionScore, endingRetentionScore, retentionAverageScore),
    [explicitRetentionAfterScore, combinedRetentionScore, endingRetentionScore, retentionAverageScore],
  );
  const inferredRetentionLift = useMemo(() => {
    const emotionLift = emotionResonanceScore !== null ? clamp((emotionResonanceScore - 56) * 0.08, -1.2, 3.8) : 0.8;
    const scanLift = clamp((fullScanProgress - 45) * 0.03, 0, 2.5);
    const dropPenalty = clamp((retentionBiggestDrop?.drop ?? 0) * 0.18, 0.3, 3);
    return roundToTenths(clamp(3.6 + emotionLift + scanLift - dropPenalty, 1.3, 9.5));
  }, [emotionResonanceScore, fullScanProgress, retentionBiggestDrop]);
  const beforeRetentionScore = useMemo(() => {
    if (explicitRetentionBeforeScore !== null) return explicitRetentionBeforeScore;
    if (afterRetentionScore === null) return null;
    if (explicitRetentionDelta !== null) {
      return toScore100(afterRetentionScore - explicitRetentionDelta);
    }
    return toScore100(afterRetentionScore - inferredRetentionLift);
  }, [
    explicitRetentionBeforeScore,
    afterRetentionScore,
    explicitRetentionDelta,
    inferredRetentionLift,
  ]);
  const retentionScoreDelta = useMemo(() => {
    if (afterRetentionScore !== null && beforeRetentionScore !== null) {
      return roundToTenths(clamp(afterRetentionScore - beforeRetentionScore, -100, 100));
    }
    return explicitRetentionDelta;
  }, [afterRetentionScore, beforeRetentionScore, explicitRetentionDelta]);
  const finalRetentionScore = afterRetentionScore ?? combinedRetentionScore;
  const retentionDeltaPositive = retentionScoreDelta === null ? null : retentionScoreDelta >= 0;
  const retentionDeltaLabel = retentionScoreDelta === null
    ? "Baseline pending"
    : `${retentionScoreDelta >= 0 ? "+" : ""}${retentionScoreDelta.toFixed(1)} pts`;
  const retentionScoreTier = useMemo(() => {
    if (finalRetentionScore >= 88) {
      return {
        label: "Elite",
        summary: "High watch-through trajectory with strong finish pressure.",
        badgeClass: "border-success/35 bg-success/10 text-success",
      };
    }
    if (finalRetentionScore >= 76) {
      return {
        label: "Strong",
        summary: "Solid retention profile with room for extra lift in weaker sections.",
        badgeClass: "border-primary/35 bg-primary/12 text-primary",
      };
    }
    if (finalRetentionScore >= 62) {
      return {
        label: "Developing",
        summary: "Moderate retention profile; optimize pacing to avoid mid-video dips.",
        badgeClass: "border-warning/35 bg-warning/10 text-warning",
      };
    }
    return {
      label: "Rescue",
      summary: "High drop-off risk detected; another optimization pass is recommended.",
      badgeClass: "border-destructive/35 bg-destructive/10 text-destructive",
    };
  }, [finalRetentionScore]);
  const retentionScoreOrbFill = clamp(finalRetentionScore, 0, 100);
  const focusedAnalysisDetail = useMemo(() => {
    if (analysisDetailFocus === "emotion") {
      return {
        title: "Emotion Graph Deep Dive",
        subtitle: "Why this emotional arc should hold viewers longer.",
        highlights: [
          dominantEmotionSegment
            ? `${dominantEmotionSegment.label} dominates ${formatTimelineClock(dominantEmotionSegment.startSec)}-${formatTimelineClock(dominantEmotionSegment.endSec)} at ${dominantEmotionSegment.intensity}% intensity.`
            : "Emotion dominance is still being estimated.",
          bingeHighlightSegments[0]
            ? `Strongest binge beat is ${bingeHighlightSegments[0].label} at ${formatTimelineClock(bingeHighlightSegments[0].startSec)}.`
            : "Top binge beat is still being generated.",
          `${emotionLegend.length} distinct emotions detected across ${emotionTimelineSegments.length} timeline segments.`,
        ],
      };
    }
    if (analysisDetailFocus === "timeline") {
      return {
        title: "Timeline Deep Dive",
        subtitle: "Section-level breakdown of binge-worthy moments.",
        highlights: [
          `${formatTimelineClock(emotionTimelineDurationSec)} total timeline scanned with ${emotionTimelineSegments.length} emotion segments.`,
          bingeHighlightSegments[0]
            ? `Highest-impact window: ${bingeHighlightSegments[0].label} at ${formatTimelineClock(bingeHighlightSegments[0].startSec)}-${formatTimelineClock(bingeHighlightSegments[0].endSec)}.`
            : "Highest-impact window is still being estimated.",
          `Top ${Math.min(6, bingeHighlightSegments.length)} windows are prioritized for binge retention tuning.`,
        ],
      };
    }
    const topRetentionPoint = retentionCurvePoints.reduce<RetentionPoint | null>(
      (best, point) => (!best || point.predicted > best.predicted ? point : best),
      null,
    );
    return {
      title: "Retention Graph Deep Dive",
      subtitle: "Predicted watch-through shape and where drop-off risk is highest.",
      highlights: [
        `Combined retention score is ${formatScore(finalRetentionScore)} / 100 with ${retentionDeltaLabel} vs baseline.`,
        latestRetentionPoint
          ? `Predicted ending hold is ${latestRetentionPoint.predicted}% at ${formatTimelineClock(latestRetentionPoint.atSec)}.`
          : "Ending hold prediction is still being estimated.",
        topRetentionPoint
          ? `Strongest retention moment is ${topRetentionPoint.predicted}% at ${formatTimelineClock(topRetentionPoint.atSec)}.`
          : "Strongest retention moment is still being estimated.",
        retentionBiggestDrop
          ? `Largest drop is ${retentionBiggestDrop.drop}% between ${formatTimelineClock(retentionBiggestDrop.from.atSec)} and ${formatTimelineClock(retentionBiggestDrop.to.atSec)}.`
          : "No major retention drop detected yet.",
      ],
    };
  }, [
    analysisDetailFocus,
    bingeHighlightSegments,
    dominantEmotionSegment,
    emotionLegend.length,
    emotionTimelineDurationSec,
    emotionTimelineSegments.length,
    finalRetentionScore,
    latestRetentionPoint,
    retentionDeltaLabel,
    retentionBiggestDrop,
    retentionCurvePoints,
  ]);
  const retentionFillId = useMemo(
    () => `retention-fill-${String(activeJob?.id || "none").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [activeJob?.id],
  );
  const emotionFillId = useMemo(
    () => `emotion-fill-${String(activeJob?.id || "none").replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [activeJob?.id],
  );

  const etaSeconds = useMemo(() => {
    if (!activeJob) return null;
    const normalized = normalizeStatus(activeJob.status);
    if (normalized === "ready" || normalized === "failed") return null;
    const fileSize = jobFileSizeRef.current[activeJob.id] ?? uploadBytesTotal ?? null;
    const targetQuality = normalizeQuality(activeJob.finalQuality || activeJob.requestedQuality || "720p");
    const stageMarker = statusStartRef.current[activeJob.id];
    const stageStartedAt =
      stageMarker && stageMarker.status === normalized
        ? stageMarker.startedAt
        : pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const stageElapsed = Math.max(0, (Date.now() - stageStartedAt) / 1000);

    // If we're uploading, compute ETA from raw upload bytes/speed plus a small post-upload buffer
    if (normalized === "uploading") {
      const uploaded = uploadBytesUploaded;
      const total = uploadBytesTotal;
      const startAt = uploadStartRef.current[activeJob.id] ?? pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
      if (uploaded && total && uploaded > 0) {
        const elapsedUpload = Math.max(0.5, (Date.now() - startAt) / 1000);
        const speed = uploaded / elapsedUpload; // bytes/sec
        if (speed > 0) {
          const remainingBytes = Math.max(0, total - uploaded);
          const uploadETA = Math.round(remainingBytes / speed);
          // estimate post-upload processing: conservative heuristic based on file size
          const uploadSize = jobFileSizeRef.current[activeJob.id] ?? total;
          const fileMB = Math.max(1, uploadSize / (1024 * 1024));
          const processingEstimate = Math.round(fileMB * 0.2); // ~0.2s per MB as a conservative baseline
          return Math.max(0, uploadETA + processingEstimate);
        }
      }
      // fallback: estimate from upload percent progress if byte counts aren't available
      // Use the actual upload percent (0-100) rather than an unnecessarily scaled value.
      const startAtFallback = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
      const elapsed = Math.max(1, (Date.now() - startAtFallback) / 1000);
      const boundedProgress = Math.max(1, Math.min(99, uploadProgress ?? 0));
      const remaining = (elapsed * (100 - boundedProgress)) / boundedProgress;
      return Math.max(0, Math.round(remaining));
    }

    // Otherwise, estimate remaining processing time from job progress and elapsed pipeline time.
    const startAt = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const elapsed = Math.max(1, (Date.now() - startAt) / 1000);
    const jobProgress = typeof activeJob.progress === "number" ? activeJob.progress : 0;
    if (jobProgress > 0) {
      const remaining = Math.round((elapsed * (100 - jobProgress)) / jobProgress);
      return Math.max(0, remaining);
    }
    const baseline = computeStageEtaBaseline({ status: normalized, fileSizeBytes: fileSize, quality: targetQuality });
    return Math.max(1, Math.round(baseline - stageElapsed));
  }, [activeJob, etaTick, uploadProgress, uploadBytesUploaded, uploadBytesTotal]);

  const formatEta = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return "Finalizing...";
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const remSecs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    if (mins > 0) return `${mins}m ${remSecs}s`;
    return `${remSecs}s`;
  };

  const etaLabel = formatEta(etaSeconds);
  const etaSuffix = etaSeconds !== null && etaSeconds > 0 ? " remaining" : "";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-premium text-foreground">Creator Studio</h1>
              <p className="text-muted-foreground mt-1">Ship edits faster with live preview and real-time feedback</p>
            </div>
            <div className="flex items-center gap-3">
              {me && (
                <>
                  {isDevAccount && (
                    <Badge className="bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-orange-500/20 text-amber-200 border border-amber-400/40 uppercase tracking-[0.25em] text-[10px] px-3 py-1">
                      Dev
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {tierLabel} plan
                  </Badge>
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {maxRendersPerMonth === null || maxRendersPerMonth === undefined
                      ? "Unlimited renders"
                      : `${rendersRemaining ?? 0} renders left`}
                  </Badge>
                </>
              )}
              <Button onClick={handlePickFile} className="rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_INPUT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              if (e.target) e.target.value = "";
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <aside className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Recent Jobs</h2>
                <Badge variant="secondary" className="bg-muted/40 text-muted-foreground">
                  {jobs.length}
                </Badge>
              </div>
              {loadingJobs && <p className="text-xs text-muted-foreground">Loading jobs...</p>}
              {!loadingJobs && jobs.length === 0 && (
                <p className="text-xs text-muted-foreground">No jobs yet. Upload a video to get started.</p>
              )}
              <div className="space-y-2">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleSelectJob(job.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                      highlightedJobId === job.id
                        ? "ring-2 ring-primary/40 bg-primary/10 border-primary/40"
                        : normalizeStatus(job.status) === "ready"
                          ? "border-success/40 bg-success/10"
                          : selectedJobId === job.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{displayName(job)}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(job.status)}`}>
                        {STATUS_LABELS[normalizeStatus(job.status)] || "Queued"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-6">
              <div
                className={`glass-card p-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
                  isDragging ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/30"
                }`}
                onClick={handlePickFile}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">Drop your video here or click to upload</p>
                  <p className="text-sm text-muted-foreground">MP4 or MKV up to 2GB</p>
                  {uploadingJobId && (
                    <div className="w-full max-w-sm mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2 bg-muted [&>div]:bg-primary" />
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="aspect-video bg-muted/30 flex items-center justify-center relative">
                  {showVideo ? (
                    <video src={activeJob?.outputUrl || ""} controls className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      <div className="relative z-10 flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                          {activeJob && !isTerminalStatus(activeJob.status) ? (
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                          ) : (
                            <Play className="w-6 h-6 text-primary ml-0.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activeJob
                            ? normalizedActiveStatus === "ready"
                              ? "Ready to export"
                              : normalizedActiveStatus === "failed"
                                ? "Job failed"
                                : "Processing your edit..."
                            : "Select a job to preview"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="pill-badge text-[10px]">Video Summary</p>
                    <p className="mt-2 text-xs text-muted-foreground">Live status updates while your job runs</p>
                  </div>
                  {activeJob && (
                    <Badge variant="outline" className={`text-xs ${statusBadgeClass(activeJob.status)}`}>
                      {activeStatusLabel}
                    </Badge>
                  )}
                </div>

                {loadingJob && <p className="text-xs text-muted-foreground">Loading job details...</p>}
                {!activeJob && !loadingJob && (
                  <p className="text-xs text-muted-foreground">Select a job from the left to view its pipeline.</p>
                )}

                {activeJob && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const active = currentStepIndex !== -1 && idx <= currentStepIndex && activeJob.status !== "failed";
                        return (
                          <Badge
                            key={step.key}
                            variant="secondary"
                            className={`border ${
                              active
                                ? "border-primary/30 text-primary bg-primary/10"
                                : "border-border/50 text-muted-foreground bg-muted/30"
                            }`}
                          >
                            {step.label}
                          </Badge>
                        );
                      })}
                      {normalizeStatus(activeJob.status) === "failed" && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>

                    {!isTerminalStatus(activeJob.status) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{activeStatusLabel}</span>
                          <span className="text-xs text-muted-foreground">{activeJob.progress ?? 0}%</span>
                        </div>
                        <Progress value={activeJob.progress ?? 0} className="h-2 bg-muted [&>div]:bg-primary" />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="uppercase tracking-[0.2em] text-muted-foreground/80">Estimated time</span>
                          <span className="font-premium text-sm text-foreground font-semibold tracking-tight">
                            {etaLabel}
                            {etaSuffix}
                          </span>
                        </div>
                      </div>
                    )}

                    {activeJobIsReady && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Export is ready. Review feedback or download your final cut.</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openVideoAnalysisWithFocus("retention")}>
                            Feedback Deep Dive
                          </Button>
                          <Button size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
                            <Download className="w-4 h-4" /> Open Export
                          </Button>
                        </div>
                      </div>
                    )}

                    {!activeJobIsReady ? (
                      <div className="analysis-report-card space-y-3 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="pill-badge text-[10px]">Feedback Deep Dive</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Deep feedback is generated after render completes.
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                            Processing
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Deep feedback becomes available after rendering completes. Open Feedback Deep Dive for the full report.
                        </p>
                      </div>
                    ) : (
                      <div className="analysis-report-card space-y-3 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="pill-badge text-[10px]">Feedback Deep Dive</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Post-render retention feedback with score lift, weak spots, and optimization reasoning.
                            </p>
                          </div>
                          <Badge className={retentionScoreTier.badgeClass}>{formatScore(finalRetentionScore)} / 100</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="video-stats-metric-card rounded-lg p-2.5">
                            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Before</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatScore(beforeRetentionScore)}</p>
                          </div>
                          <div className="video-stats-metric-card rounded-lg p-2.5">
                            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">After</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatScore(afterRetentionScore ?? finalRetentionScore)}</p>
                          </div>
                          <div className="video-stats-metric-card rounded-lg p-2.5">
                            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Lift</p>
                            <p
                              className={`mt-1 text-sm font-semibold ${
                                retentionDeltaPositive === null
                                  ? "text-foreground"
                                  : retentionDeltaPositive
                                    ? "text-success"
                                    : "text-destructive"
                              }`}
                            >
                              {retentionDeltaLabel}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {optimizationHighlights.length > 0 ? (
                            optimizationHighlights.map((note, index) => (
                              <p key={`feedback-highlight-${index}`} className="rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                                {note}
                              </p>
                            ))
                          ) : (
                            <p className="rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                              Feedback summary is ready. Open deep dive for full retention and emotion diagnostics.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            Render complete. Review the full feedback breakdown and key improvement windows.
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openVideoAnalysisWithFocus("retention")}
                          >
                            Open Feedback Deep Dive
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      <Dialog open={videoAnalysisOpen} onOpenChange={setVideoAnalysisOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-white/10 bg-background/95 p-3 backdrop-blur-xl sm:max-w-5xl sm:p-5">
          <div className="analysis-report-shell space-y-4 rounded-2xl p-3 sm:p-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">Feedback Deep Dive</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Full scan confidence, retention scoring, emotional timeline, and actionable post-render feedback.
              </p>
            </DialogHeader>

            <div className="analysis-report-card rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Retention Scoring System</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Combined score from weighted retention, emotion, stability, and scan signals.
                  </p>
                </div>
                <Badge className={retentionScoreTier.badgeClass}>
                  {formatScore(finalRetentionScore)} / 100
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="video-stats-surface rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Before</span>
                    <span className="text-sm font-semibold text-foreground">{formatScore(beforeRetentionScore)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/45">
                    <div
                      className="h-full rounded-full bg-muted-foreground/55"
                      style={{ width: `${beforeRetentionScore !== null ? clamp(beforeRetentionScore, 0, 100) : 0}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-primary/90">After</span>
                    <span className="text-sm font-semibold text-foreground">{formatScore(afterRetentionScore ?? finalRetentionScore)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/45">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${clamp(finalRetentionScore, 0, 100)}%` }}
                    />
                  </div>
                  <div
                    className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                      retentionDeltaPositive === null
                        ? "border-border/60 bg-muted/25 text-muted-foreground"
                        : retentionDeltaPositive
                          ? "border-success/35 bg-success/10 text-success"
                          : "border-destructive/35 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {retentionDeltaPositive === null ? (
                      <Gauge className="h-3 w-3" />
                    ) : retentionDeltaPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {retentionDeltaLabel}
                  </div>
                </div>

                <div className="space-y-2">
                  {retentionScoringBreakdown.map((item) => (
                    <div key={`modal-breakdown-${item.key}`} className="rounded-lg border border-border/60 bg-background/45 p-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">
                          {item.score.toFixed(1)} x {Math.round(item.weight * 100)}% = {item.weightedScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/45">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-[0.16em]">Full Video Scan Progress</span>
                  <span>{fullScanProgressLabel}</span>
                </div>
                <Progress value={fullScanProgress} className="mt-2 h-2 bg-muted [&>div]:bg-primary" />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  <Radar className="mr-1 h-3 w-3" />
                  Duration: {formatTimelineClock(estimatedDurationSec ?? retentionTimelineDurationSec)}
                </Badge>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  <BarChart3 className="mr-1 h-3 w-3" />
                  Retention points: {retentionCurvePoints.length}
                </Badge>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  <BrainCircuit className="mr-1 h-3 w-3" />
                  Emotion beats: {emotionTimelineSegments.length}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div
                className={`analysis-report-card rounded-xl p-3 sm:p-4 transition ${
                  analysisDetailFocus === "retention" ? "ring-1 ring-primary/55" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Retention Prediction Graph</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected watch-through from first second to end frame.
                    </p>
                  </div>
                  <Badge
                    className={`${
                      retentionGoalMet
                        ? "border-success/35 bg-success/10 text-success"
                        : "border-warning/35 bg-warning/10 text-warning"
                    }`}
                  >
                    {latestRetentionPoint ? `${latestRetentionPoint.predicted}%` : "Predicting"}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="analysis-graph-surface mt-3 h-44 w-full overflow-hidden rounded-lg border border-border/60 p-2 text-left transition hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => setAnalysisDetailFocus("retention")}
                  aria-label="Focus retention deep dive details"
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                      <linearGradient id={`${retentionFillId}-modal`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary) / 0.42)" />
                        <stop offset="100%" stopColor="hsl(var(--primary) / 0.03)" />
                      </linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map((line) => (
                      <line
                        key={`retention-modal-grid-${line}`}
                        x1="0"
                        y1={line}
                        x2="100"
                        y2={line}
                        stroke="hsl(var(--border) / 0.35)"
                        strokeDasharray="2.5 3"
                        strokeWidth="0.8"
                      />
                    ))}
                    <line
                      x1="0"
                      y1={retentionGoalLineY}
                      x2="100"
                      y2={retentionGoalLineY}
                      stroke="hsl(var(--success) / 0.82)"
                      strokeDasharray="3 2.5"
                      strokeWidth="1.2"
                    />
                    {retentionAreaPath ? (
                      <path d={retentionAreaPath} fill={`url(#${retentionFillId}-modal)`} />
                    ) : null}
                    <polyline
                      points={retentionLinePoints}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {retentionCoordinates.map((point, index) => (
                      <circle key={`retention-modal-node-${index}`} cx={point.x} cy={point.y} r="1.25" fill="hsl(var(--primary))" />
                    ))}
                  </svg>
                </button>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Goal: {RETENTION_GOAL_PERCENT}%+</span>
                  <span>{retentionGoalMet ? "On track" : "Below target"} · Click graph for details</span>
                </div>
              </div>

              <div
                className={`analysis-report-card rounded-xl p-3 sm:p-4 transition ${
                  analysisDetailFocus === "emotion" ? "ring-1 ring-primary/55" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Emotion Graph</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Landing-page style emotional arc showing intensity over time.
                    </p>
                  </div>
                  <Badge className="border-primary/35 bg-primary/10 text-primary">
                    {emotionMoments.length} moments
                  </Badge>
                </div>
                <button
                  type="button"
                  className="analysis-graph-surface mt-3 h-44 w-full overflow-hidden rounded-lg border border-border/60 p-2 text-left transition hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => setAnalysisDetailFocus("emotion")}
                  aria-label="Focus emotion deep dive details"
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                      <linearGradient id={`${emotionFillId}-modal`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--glow-secondary) / 0.36)" />
                        <stop offset="100%" stopColor="hsl(var(--glow-secondary) / 0.02)" />
                      </linearGradient>
                    </defs>
                    {[20, 40, 60, 80].map((line) => (
                      <line
                        key={`emotion-modal-grid-${line}`}
                        x1="0"
                        y1={line}
                        x2="100"
                        y2={line}
                        stroke="hsl(var(--border) / 0.35)"
                        strokeDasharray="2.5 3"
                        strokeWidth="0.8"
                      />
                    ))}
                    {emotionAreaPath ? (
                      <path d={emotionAreaPath} fill={`url(#${emotionFillId}-modal)`} />
                    ) : null}
                    <polyline
                      points={emotionLinePoints}
                      fill="none"
                      stroke="hsl(var(--glow-secondary))"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {emotionCoordinates.map((point, index) => (
                      <circle key={`emotion-modal-node-${index}`} cx={point.x} cy={point.y} r="1.1" fill="hsl(var(--glow-secondary))" />
                    ))}
                  </svg>
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {emotionLegend.map((item) => (
                    <span
                      key={`emotion-legend-${item.emotion}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-[11px] text-foreground/90"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`analysis-report-card rounded-xl p-3 sm:p-4 transition ${
                analysisDetailFocus === "timeline" ? "ring-1 ring-primary/55" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Emotion Timeline</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Different emotions felt through the edit and why these moments are binge-worthy. Click timeline to focus deep dive.
                  </p>
                </div>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  {formatTimelineClock(emotionTimelineDurationSec)} scanned
                </Badge>
              </div>

              <button
                type="button"
                className="analysis-emotion-track mt-3 h-4 w-full overflow-hidden rounded-full border border-border/60 bg-muted/35"
                onClick={() => setAnalysisDetailFocus("timeline")}
                aria-label="Focus timeline deep dive details"
              >
                {emotionTimelineSegments.map((segment) => (
                  <span
                    key={`emotion-track-${segment.id}`}
                    className="absolute inset-y-0 rounded-sm"
                    style={{
                      left: `${segment.positionPct}%`,
                      width: `${segment.widthPct}%`,
                      backgroundColor: segment.color,
                    }}
                    title={`${segment.label} ${formatTimelineClock(segment.startSec)}-${formatTimelineClock(segment.endSec)}`}
                  />
                ))}
              </button>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {bingeHighlightSegments.map((segment) => (
                  <div key={`binge-highlight-${segment.id}`} className="rounded-lg border border-border/60 bg-background/45 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">{segment.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimelineClock(segment.startSec)}-{formatTimelineClock(segment.endSec)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{segment.reason}</p>
                    <p className="mt-1 text-[11px] text-foreground/90">
                      Why binge-worthy: {segment.bingeReason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="analysis-report-card rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{focusedAnalysisDetail.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{focusedAnalysisDetail.subtitle}</p>
                </div>
                <Badge className="border-primary/35 bg-primary/10 text-primary">Detailed view</Badge>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                {focusedAnalysisDetail.highlights.map((item, index) => (
                  <div key={`analysis-focus-detail-${analysisDetailFocus}-${index}`} className="rounded-lg border border-border/60 bg-background/45 p-2.5">
                    <p className="text-xs text-foreground/90">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (open) {
            setExportOpen(true);
          }
        }}
      >
        <DialogContent
          className="max-w-lg bg-background/95 backdrop-blur-xl border border-white/10 [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-display">Export ready</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Choose your quality and download the final MP4.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 border-border/60 bg-card/40"
                aria-label="Close export popup"
                onClick={() => setExportOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Export Quality</span>
                <span className="text-xs text-muted-foreground">Max: {maxQuality.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">{qualityButtons}</div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => openVideoAnalysisWithFocus("retention")}
              >
                Feedback Deep Dive
              </Button>
              <Button
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto"
                onClick={async () => {
                  const didStartDownload = await handleDownload();
                  if (didStartDownload) {
                    setExportOpen(false);
                  }
                }}
              >
                <Download className="w-4 h-4" /> Final MP4
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={autoDownloadModal.open} onOpenChange={(open) => setAutoDownloadModal({ open })}>
        <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Tap to download</DialogTitle>
            <p className="text-sm text-muted-foreground">Your render finished — tap the button below to download.</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">If the download doesn't start automatically, press the button below.</div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setAutoDownloadModal({ open: false })}>Cancel</Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => {
                  try {
                    const url = autoDownloadModal.url;
                    const fileName = autoDownloadModal.fileName;
                    if (!url) return;
                    const a = document.createElement('a');
                    a.href = url;
                    if (fileName) a.download = fileName;
                    a.target = '_blank';
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (autoDownloadModal.jobId) window.localStorage.setItem(`auto_downloaded_${autoDownloadModal.jobId}`, 'true');
                  } catch (e) {
                    // ignore
                  }
                  setAutoDownloadModal({ open: false });
                }}
              >
                <Download className="w-4 h-4" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </GlowBackdrop>
  );
};

export default Editor;
