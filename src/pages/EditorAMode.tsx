import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, BrainCircuit, Gauge, ScanFace, Sparkles, Target, Wand2 } from "lucide-react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

const toPoints = (rows: readonly { energy: number; emotion: number }[], key: "energy" | "emotion") => (
  rows
    .map((row, index) => {
      const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100;
      const y = 100 - row[key];
      return `${x},${y}`;
    })
    .join(" ")
);
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const clampUnit = (value: number) => Math.max(0, Math.min(1, value));
const isObjectRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const toValuePoints = (values: number[]) =>
  values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 100 - clampPercent(value);
      return `${x},${y}`;
    })
    .join(" ");
const normalizePercent = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const scaled = Math.abs(raw) <= 1 ? raw * 100 : raw;
  return clampPercent(Math.round(scaled));
};
type RatePlatformKey = "youtube" | "tiktok" | "instagramReels";
const normalizeRatePlatformKey = (value: unknown): RatePlatformKey | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "youtube" || normalized === "yt" || normalized.includes("youtube")) return "youtube";
  if (normalized === "tiktok" || normalized === "tt" || normalized.includes("tiktok") || normalized.includes("tik tok")) {
    return "tiktok";
  }
  if (
    normalized === "instagram" ||
    normalized === "ig" ||
    normalized === "reels" ||
    normalized === "instagram_reels" ||
    normalized.includes("instagram") ||
    normalized.includes("reel")
  ) {
    return "instagramReels";
  }
  return null;
};
const readOptionalPercentParam = (params: URLSearchParams, key: string) => {
  const raw = Number(params.get(key));
  if (!Number.isFinite(raw)) return null;
  return normalizePercent(raw);
};
const readCountParam = (params: URLSearchParams, key: string, fallback: number) => {
  const raw = Number(params.get(key));
  if (!Number.isFinite(raw)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(raw));
};
const readNumberFrom = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const raw = Number(source[key]);
    if (Number.isFinite(raw)) return raw;
  }
  return null;
};
const readStringFrom = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return "";
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
};
const readObjectFrom = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const raw = source[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, any>;
  }
  return null;
};
const isLikelyVideoUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  const raw = value.trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("blob:");
};
const pickFirstVideoUrl = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (isLikelyVideoUrl(item)) return String(item).trim();
      }
      continue;
    }
    if (isLikelyVideoUrl(candidate)) return String(candidate).trim();
  }
  return "";
};
const normalizeTextList = (values: unknown[]) => {
  const list = values
    .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(list)).slice(0, 8);
};
const extractTextList = (source: Record<string, any> | null | undefined, keys: string[]) => {
  if (!source) return [] as string[];
  const collected: unknown[] = [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) collected.push(...value);
    else if (typeof value === "string") collected.push(value);
  }
  return normalizeTextList(collected);
};
const formatOptionalDateTime = (value: unknown) => {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
const formatOptionalShortDate = (value: unknown) => {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};
const formatTimelineStamp = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
};
const formatRangeLabel = (start: number | null, end: number | null) => {
  const startLabel = formatTimelineStamp(start);
  const endLabel = formatTimelineStamp(end);
  if (!startLabel && !endLabel) return "--";
  if (!startLabel) return `---${endLabel}`;
  if (!endLabel) return `${startLabel}-??`;
  return `${startLabel}-${endLabel}`;
};
const clampScore = (value: number | null) => {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  const scaled = Math.abs(value) <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
};
const parseBooleanLike = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) return true;
    if (["0", "false", "no"].includes(normalized)) return false;
  }
  return null;
};
const parseTimelineStampToSeconds = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const parts = trimmed.split(":").map((part) => Number(part.trim()));
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
};
const extractRangeStartLabel = (range: string) => {
  const normalized = String(range || "").trim();
  if (!normalized) return "";
  const [start] = normalized.split("-");
  return String(start || "").trim();
};

type TimelineSeriesPoint = {
  stamp: string;
  energy: number;
  emotion: number;
  retention?: number;
  timeSec?: number | null;
};

type DropoffHeatmapRow = {
  label: string;
  range: string;
  risk: number;
  detail: string;
  startSec: number | null;
  endSec: number | null;
};

type RetentionMiniSample = {
  stamp: string;
  value: number;
  sourceIndex: number;
  timeSec: number | null;
};

type RetentionMiniPlotPoint = RetentionMiniSample & {
  plotIndex: number;
  x: number;
  y: number;
};

const EditorAMode = () => {
  const [searchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const [jobDetail, setJobDetail] = useState<Record<string, any> | null>(null);
  const [retentionBenchmarks, setRetentionBenchmarks] = useState<Record<string, any> | null>(null);
  const [applyTipsPending, setApplyTipsPending] = useState(false);
  const [applyTipsMessage, setApplyTipsMessage] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const fullVideoScanProgress = useMemo(() => {
    const raw = Number(searchParams.get("fullScanProgress"));
    if (Number.isFinite(raw)) return Math.max(0, Math.min(100, raw));
    return null;
  }, [searchParams]);
  const fullVideoScanLabel = useMemo(() => {
    const raw = String(searchParams.get("fullScanLabel") || "").trim();
    if (raw) return raw.slice(0, 120);
    if (fullVideoScanProgress === null) return "Awaiting scan signal";
    if (fullVideoScanProgress >= 100) return "Full scan complete";
    return `Full scan ${Math.round(fullVideoScanProgress)}% complete`;
  }, [searchParams, fullVideoScanProgress]);
  const activeJobId = useMemo(() => String(searchParams.get("jobId") || "").trim(), [searchParams]);
  useEffect(() => {
    let cancelled = false;
    if (!accessToken || !activeJobId) {
      setJobDetail(null);
      setJobLoading(false);
      setJobError("");
      return;
    }
    setJobLoading(true);
    setJobError("");
    apiFetch<{ job?: Record<string, any> }>(`/api/jobs/${activeJobId}`, { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        setJobDetail(data.job ?? null);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setJobDetail(null);
        setJobError(error?.message || "Unable to load job details.");
      })
      .finally(() => {
        if (cancelled) return;
        setJobLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeJobId]);
  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      setRetentionBenchmarks(null);
      return;
    }
    apiFetch<{ benchmarks?: Record<string, any> }>("/api/retention/benchmarks", { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        setRetentionBenchmarks(isObjectRecord(data?.benchmarks) ? data.benchmarks : null);
      })
      .catch(() => {
        if (cancelled) return;
        setRetentionBenchmarks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);
  const backToEditorHref = useMemo(() => {
    if (!activeJobId) return "/editor";
    return `/editor?jobId=${encodeURIComponent(activeJobId)}`;
  }, [activeJobId]);
  const rateDecisionReady = useMemo(() => {
    const raw = String(searchParams.get("rateDecisionReady") || "").trim().toLowerCase();
    if (raw === "1" || raw === "true" || raw === "yes") return true;
    const status = String(jobDetail?.status || "").trim().toLowerCase();
    return status === "ready";
  }, [jobDetail?.status, searchParams]);
  const platformForecast = useMemo(() => {
    const analysis = jobDetail?.analysis;
    if (!analysis || typeof analysis !== "object") return [] as {
      platformKey: RatePlatformKey | null;
      label: string;
      before: number | null;
      after: number | null;
      lift: string;
      note: string;
    }[];
    const raw =
      (analysis as Record<string, any>).platform_forecast ??
      (analysis as Record<string, any>).platformForecast ??
      (analysis as Record<string, any>).platform_outcome_forecast ??
      (analysis as Record<string, any>).platformOutcomeForecast;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry: any, index: number) => {
        if (!entry || typeof entry !== "object") return null;
        const labelRaw = String(entry.label ?? entry.platform ?? entry.name ?? "").trim();
        const label = labelRaw || `Platform ${index + 1}`;
        const platformKey = normalizeRatePlatformKey(entry.platform ?? entry.key ?? entry.id ?? labelRaw);
        const before = normalizePercent(entry.before ?? entry.baseline ?? entry.current ?? entry.score_before);
        const after = normalizePercent(entry.after ?? entry.projected ?? entry.score_after ?? entry.predicted);
        let lift = "";
        if (typeof entry.lift === "string" && entry.lift.trim()) {
          lift = entry.lift.trim();
        } else {
          const liftValue = normalizePercent(entry.lift);
          if (liftValue !== null) lift = `${liftValue >= 0 ? "+" : ""}${liftValue}`;
          else if (before !== null && after !== null) {
            const diff = Math.round(after - before);
            lift = `${diff >= 0 ? "+" : ""}${diff}`;
          }
        }
        const note = typeof entry.note === "string" && entry.note.trim()
          ? entry.note.trim()
          : typeof entry.reason === "string" && entry.reason.trim()
            ? entry.reason.trim()
            : "";
        return { platformKey, label, before, after, lift, note };
      })
      .filter((entry): entry is {
        platformKey: RatePlatformKey | null;
        label: string;
        before: number | null;
        after: number | null;
        lift: string;
        note: string;
      } => Boolean(entry))
      .slice(0, 5);
  }, [jobDetail]);
  const scoreModeLabel = useMemo(() => {
    const analysis = jobDetail?.analysis as Record<string, any> | null | undefined;
    const raw = String(
      analysis?.pipelinePowerMode ??
      analysis?.pipeline_power_mode ??
      analysis?.pipeline_mode_playbook ??
      analysis?.mode_playbook ??
      analysis?.editorMode ??
      analysis?.editor_mode ??
      "",
    ).trim().toLowerCase();
    if (raw === "ultra") return "Fast";
    if (raw === "retention-king" || raw === "retention_king") return "Quality";
    return "Standard";
  }, [jobDetail]);
  const queryRateOverallScore = useMemo(() => normalizePercent(searchParams.get("rateOverall")), [searchParams]);
  const queryRateAverageScore = useMemo(() => readOptionalPercentParam(searchParams, "rateAverage"), [searchParams]);
  const queryRateByPlatform = useMemo(() => ({
    youtube: readOptionalPercentParam(searchParams, "rateYoutube"),
    tiktok: readOptionalPercentParam(searchParams, "rateTiktok"),
    instagramReels: readOptionalPercentParam(searchParams, "rateInstagram"),
  }), [searchParams]);
  const jobAnalysis = useMemo(() => {
    const raw = jobDetail?.analysis;
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, any>;
  }, [jobDetail]);
  const jobAutonomous = useMemo(() => {
    if (jobDetail?.autonomousEditor && typeof jobDetail.autonomousEditor === "object") {
      return jobDetail.autonomousEditor as Record<string, any>;
    }
    const nested = jobAnalysis?.autonomous_editor ?? jobAnalysis?.autonomousEditor;
    if (!nested || typeof nested !== "object") return null;
    return nested as Record<string, any>;
  }, [jobAnalysis, jobDetail]);
  const retentionGateSummary = useMemo(
    () => readObjectFrom(jobAnalysis, ["retention_gate", "retentionGate", "Retention Gate"]),
    [jobAnalysis],
  );
  const abWinnerSummary = useMemo(
    () => readObjectFrom(jobAnalysis, ["a_b_winner", "abWinner", "A/B Winner"]),
    [jobAnalysis],
  );
  const winnerPromotionSummary = useMemo(
    () => readObjectFrom(jobAnalysis, ["winner_promotion", "winnerPromotion", "Winner Promotion"]),
    [jobAnalysis],
  );
  const longFormGateSummary = useMemo(
    () => readObjectFrom(jobAnalysis, ["long_form_gate", "longFormGate"]),
    [jobAnalysis],
  );
  const rerenderSearchSummary = useMemo(
    () => readObjectFrom(retentionGateSummary, ["rerender_search", "rerenderSearch"]),
    [retentionGateSummary],
  );
  const engagementWindows = useMemo(() => {
    if (!jobAnalysis) return [] as Record<string, any>[];
    const raw =
      jobAnalysis?.editPlan?.engagementWindows ??
      jobAnalysis?.edit_plan?.engagement_windows ??
      jobAnalysis?.engagementWindows ??
      jobAnalysis?.engagement_windows;
    if (!Array.isArray(raw)) return [] as Record<string, any>[];
    return raw.filter((entry) => entry && typeof entry === "object") as Record<string, any>[];
  }, [jobAnalysis]);
  const timelineSeries = useMemo(() => {
    if (!jobAnalysis) return [] as TimelineSeriesPoint[];
    const pickArray = (...values: unknown[]) => values.find((value) => Array.isArray(value)) as unknown[] | undefined;
    const buildFromEngagement = (windows: Record<string, any>[]) => {
      if (!windows.length) return [] as TimelineSeriesPoint[];
      const usable = windows
        .map((entry) => {
          const time = Number(entry.time ?? entry.t ?? entry.second ?? entry.seconds);
          return Number.isFinite(time) ? { ...entry, time } : null;
        })
        .filter((entry): entry is Record<string, any> & { time: number } => Boolean(entry));
      if (!usable.length) return [] as TimelineSeriesPoint[];
      const targetCount = Math.min(12, Math.max(6, Math.round(usable.length / 90)));
      const maxIndex = usable.length - 1;
      const points: TimelineSeriesPoint[] = [];
      for (let i = 0; i < targetCount; i += 1) {
        const idx = Math.round((i / Math.max(1, targetCount - 1)) * maxIndex);
        const entry = usable[idx];
        if (!entry) continue;
        const energy = normalizePercent(entry.audioEnergy ?? entry.motionScore ?? entry.visualImpact);
        const emotion = normalizePercent(entry.emotionIntensity ?? entry.emotionalSpike ?? entry.transcriptEmotion);
        if (energy === null || emotion === null) continue;
        const retention = normalizePercent(entry.score ?? entry.hookScore);
        points.push({
          stamp: formatTimelineStamp(entry.time),
          energy,
          emotion,
          retention: retention ?? undefined,
          timeSec: Math.max(0, entry.time),
        });
      }
      return points;
    };
    const parseObjectSeries = (series: unknown[]) => {
      const points: TimelineSeriesPoint[] = [];
      series.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        const energy = normalizePercent((entry as any).energy ?? (entry as any).energyScore ?? (entry as any).energy_score);
        const emotion = normalizePercent((entry as any).emotion ?? (entry as any).emotionScore ?? (entry as any).emotion_score);
        if (energy === null || emotion === null) return;
        const retention = normalizePercent(
          (entry as any).retention ?? (entry as any).retentionScore ?? (entry as any).retention_score,
        );
        const stampValue =
          (entry as any).stamp ??
          (entry as any).t ??
          (entry as any).time ??
          (entry as any).second ??
          (entry as any).seconds ??
          index;
        const stampNumber = Number(stampValue);
        const rawStampText = String((entry as any).stamp ?? "").trim();
        const resolvedTimeSec = Number.isFinite(stampNumber)
          ? Math.max(0, stampNumber)
          : parseTimelineStampToSeconds(rawStampText);
        const stamp = resolvedTimeSec !== null
          ? formatTimelineStamp(resolvedTimeSec)
          : rawStampText || formatTimelineStamp(index);
        points.push({
          stamp,
          energy,
          emotion,
          retention: retention ?? undefined,
          timeSec: resolvedTimeSec,
        });
      });
      return points;
    };
    let points = parseObjectSeries(pickArray(
      jobAnalysis.energyEmotionTimeline,
      jobAnalysis.energy_emotion_timeline,
      jobAnalysis.timeline,
      jobAnalysis.energyTimeline,
      jobAnalysis.energy_timeline,
      jobAnalysis.emotionTimeline,
      jobAnalysis.emotion_timeline,
    ) || []);
    if (!points.length) {
      const energySeries = pickArray(jobAnalysis.energyTimeline, jobAnalysis.energy_timeline);
      const emotionSeries = pickArray(jobAnalysis.emotionTimeline, jobAnalysis.emotion_timeline);
      if (energySeries && emotionSeries) {
        const length = Math.min(energySeries.length, emotionSeries.length);
        points = Array.from({ length }, (_, index) => {
          const energy = normalizePercent(energySeries[index]);
          const emotion = normalizePercent(emotionSeries[index]);
          if (energy === null || emotion === null) return null;
          return {
            stamp: formatTimelineStamp(index),
            energy,
            emotion,
            timeSec: index,
          };
        }).filter((point): point is TimelineSeriesPoint => Boolean(point));
      }
    }
    if (!points.length && engagementWindows.length) {
      points = buildFromEngagement(engagementWindows);
    }
    return points.slice(0, 24);
  }, [engagementWindows, jobAnalysis]);
  const hasTimeline = timelineSeries.length > 0;
  const avgEmotion = useMemo(() => {
    if (!timelineSeries.length) return null;
    const total = timelineSeries.reduce((sum, row) => sum + row.emotion, 0);
    return Math.round(total / timelineSeries.length);
  }, [timelineSeries]);
  const peakEnergyPoint = useMemo(() => {
    if (!timelineSeries.length) return null;
    return timelineSeries.reduce((best, current) => (current.energy > best.energy ? current : best), timelineSeries[0]);
  }, [timelineSeries]);
  const energyPoints = useMemo(
    () => (timelineSeries.length ? toPoints(timelineSeries, "energy") : ""),
    [timelineSeries],
  );
  const emotionPoints = useMemo(
    () => (timelineSeries.length ? toPoints(timelineSeries, "emotion") : ""),
    [timelineSeries],
  );
  const retentionMiniSamples = useMemo(() => {
    const fallbackValues = [68, 65, 62, 58, 52, 49, 44];
    if (timelineSeries.length > 1) {
      const baseSamples = timelineSeries
        .map((row, index) => {
          const value = row.retention ?? row.energy ?? row.emotion;
          if (!Number.isFinite(value)) return null;
          const safeStamp = String(row.stamp || "").trim();
          const parsedTime = row.timeSec ?? parseTimelineStampToSeconds(safeStamp);
          return {
            stamp: safeStamp || formatTimelineStamp(parsedTime ?? index * 8),
            value: clampPercent(Number(value)),
            sourceIndex: index,
            timeSec: parsedTime ?? null,
          };
        })
        .filter((row): row is RetentionMiniSample => Boolean(row));
      if (baseSamples.length > 3) {
        const sampleCount = Math.min(9, baseSamples.length);
        return Array.from({ length: sampleCount }, (_, index) => {
          const sourceIndex = Math.round((index / Math.max(1, sampleCount - 1)) * Math.max(0, baseSamples.length - 1));
          return baseSamples[sourceIndex];
        });
      }
    }
    return fallbackValues.map((value, index) => ({
      stamp: formatTimelineStamp(index * 8),
      value,
      sourceIndex: index,
      timeSec: index * 8,
    }));
  }, [timelineSeries]);
  const retentionMiniValues = useMemo(
    () => retentionMiniSamples.map((sample) => sample.value),
    [retentionMiniSamples],
  );
  const retentionMiniPoints = useMemo(
    () => (retentionMiniValues.length ? toValuePoints(retentionMiniValues) : ""),
    [retentionMiniValues],
  );
  const retentionMiniArea = useMemo(() => {
    if (!retentionMiniPoints) return "";
    return `${retentionMiniPoints} 100,100 0,100`;
  }, [retentionMiniPoints]);
  const retentionMiniPlotPoints = useMemo(
    () => retentionMiniSamples.map((sample, index) => {
      const x = retentionMiniSamples.length <= 1 ? 0 : (index / (retentionMiniSamples.length - 1)) * 100;
      const y = 100 - clampPercent(sample.value);
      return {
        ...sample,
        plotIndex: index,
        x,
        y,
      } as RetentionMiniPlotPoint;
    }),
    [retentionMiniSamples],
  );
  const dropoffHeatmapRows = useMemo(() => {
    if (!jobAnalysis) return [] as DropoffHeatmapRow[];
    const explicitSpans =
      jobAnalysis?.dropoff_heatmap?.spans ??
      jobAnalysis?.dropoffHeatmap?.spans ??
      jobAnalysis?.heatmap?.spans ??
      jobAnalysis?.heat_map?.spans ??
      jobAnalysis?.retention_heatmap?.spans ??
      jobAnalysis?.retentionHeatmap?.spans ??
      jobAnalysis?.debug?.heatmap?.spans ??
      jobAnalysis?.raw_debug?.heatmap?.spans ??
      jobAnalysis?.rawDebug?.heatmap?.spans;
    if (Array.isArray(explicitSpans) && explicitSpans.length > 0) {
      return explicitSpans
        .map((entry: any, index: number) => {
          if (!entry || typeof entry !== "object") return null;
          const start = Number(entry.start ?? entry.t0 ?? entry.from ?? entry.range_start);
          const end = Number(entry.end ?? entry.t1 ?? entry.to ?? entry.range_end);
          const riskFromHeat = normalizePercent(entry.heat ?? entry.risk ?? entry.dropoffRisk ?? entry.dropoff_risk);
          const scoreFromEngagement = normalizePercent(entry.score ?? entry.engagement ?? entry.retention);
          const risk = riskFromHeat ?? (scoreFromEngagement !== null ? clampPercent(100 - scoreFromEngagement) : null);
          if (risk === null) return null;
          const safeStart = Number.isFinite(start) ? Math.max(0, start) : null;
          const safeEnd = Number.isFinite(end) ? Math.max(0, end) : null;
          const range = formatRangeLabel(safeStart, safeEnd);
          const detail = String(entry.reason ?? entry.note ?? entry.detail ?? "").trim();
          return {
            label: `Drop Zone ${index + 1}`,
            range,
            risk,
            detail,
            startSec: safeStart,
            endSec: safeEnd,
          };
        })
        .filter((entry): entry is DropoffHeatmapRow => Boolean(entry))
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 6);
    }
    if (!engagementWindows.length) return [];
    return engagementWindows
      .map((entry) => {
        const time = Number(entry.time ?? entry.t ?? entry.second ?? entry.seconds);
        if (!Number.isFinite(time)) return null;
        const score = normalizePercent(entry.score ?? entry.hookScore ?? entry.engagementScore ?? entry.engagement_score);
        if (score === null) return null;
        const risk = clampPercent(100 - score);
        if (risk < 18) return null;
        const emotion = normalizePercent(entry.emotionIntensity ?? entry.emotionalSpike ?? entry.transcriptEmotion);
        const audio = normalizePercent(entry.audioEnergy ?? entry.motionScore ?? entry.visualImpact);
        const detailParts: string[] = [];
        if (score !== null) detailParts.push(`Engagement ${score}%`);
        if (emotion !== null) detailParts.push(`Emotion ${emotion}%`);
        if (audio !== null) detailParts.push(`Energy ${audio}%`);
        return {
          label: "Drop Zone",
          range: formatRangeLabel(time, time + 8),
          risk,
          detail: detailParts.join(" · "),
          startSec: time,
          endSec: time + 8,
        };
      })
      .filter((entry): entry is DropoffHeatmapRow => Boolean(entry))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 6)
      .map((entry, index) => ({
        label: `${entry.label} ${index + 1}`,
        range: entry.range,
        risk: entry.risk,
        detail: entry.detail,
        startSec: entry.startSec,
        endSec: entry.endSec,
      }));
  }, [engagementWindows, jobAnalysis]);
  const retentionHighMoments = useMemo(() => {
    if (!retentionMiniPlotPoints.length) {
      return [] as {
        id: string;
        stamp: string;
        value: number;
        x: number;
        y: number;
        detail: string;
        sourceIndex: number;
      }[];
    }
    const average =
      retentionMiniPlotPoints.reduce((sum, point) => sum + point.value, 0) /
      Math.max(1, retentionMiniPlotPoints.length);
    const threshold = Math.max(62, Math.min(88, Math.round(average + 4)));
    const ranked = [...retentionMiniPlotPoints]
      .filter((point) => point.value >= threshold)
      .sort((a, b) => b.value - a.value);
    const selected: {
      id: string;
      stamp: string;
      value: number;
      x: number;
      y: number;
      detail: string;
      sourceIndex: number;
    }[] = [];
    for (const point of ranked) {
      if (selected.some((existing) => Math.abs(existing.sourceIndex - point.sourceIndex) <= 1)) continue;
      selected.push({
        id: `high-${point.sourceIndex}-${point.value}`,
        stamp: point.stamp,
        value: point.value,
        x: point.x,
        y: point.y,
        detail: `High hold ${point.value}%`,
        sourceIndex: point.sourceIndex,
      });
      if (selected.length >= 3) break;
    }
    if (!selected.length) {
      const fallback = [...retentionMiniPlotPoints].sort((a, b) => b.value - a.value)[0];
      if (fallback) {
        selected.push({
          id: `high-${fallback.sourceIndex}-${fallback.value}`,
          stamp: fallback.stamp,
          value: fallback.value,
          x: fallback.x,
          y: fallback.y,
          detail: `High hold ${fallback.value}%`,
          sourceIndex: fallback.sourceIndex,
        });
      }
    }
    return selected;
  }, [retentionMiniPlotPoints]);
  const retentionDropoffMoments = useMemo(() => {
    if (!dropoffHeatmapRows.length || !retentionMiniPlotPoints.length) {
      return [] as {
        id: string;
        stamp: string;
        range: string;
        risk: number;
        x: number;
        y: number;
        detail: string;
      }[];
    }
    const pointsWithTime = retentionMiniPlotPoints.filter((point) => point.timeSec !== null);
    const limit = Math.min(3, dropoffHeatmapRows.length);
    return dropoffHeatmapRows.slice(0, limit).map((row, index) => {
      const fallbackPoint =
        retentionMiniPlotPoints[
          Math.round((index / Math.max(1, limit - 1)) * Math.max(0, retentionMiniPlotPoints.length - 1))
        ] ?? null;
      let anchorPoint = fallbackPoint;
      const targetSec = row.startSec ?? row.endSec;
      if (targetSec !== null && pointsWithTime.length) {
        anchorPoint = pointsWithTime.reduce((closest, point) => {
          if (!closest) return point;
          const pointDistance = Math.abs((point.timeSec ?? targetSec) - targetSec);
          const closestDistance = Math.abs((closest.timeSec ?? targetSec) - targetSec);
          return pointDistance < closestDistance ? point : closest;
        }, pointsWithTime[0] ?? fallbackPoint);
      }
      const rangeStartLabel = extractRangeStartLabel(row.range);
      if (rangeStartLabel) {
        const byLabel = retentionMiniPlotPoints.find((point) => point.stamp === rangeStartLabel);
        if (byLabel) anchorPoint = byLabel;
      }
      return {
        id: `drop-${index}-${row.range}-${row.risk}`,
        stamp: rangeStartLabel || anchorPoint?.stamp || "--",
        range: row.range,
        risk: row.risk,
        x: anchorPoint?.x ?? 0,
        y: anchorPoint ? Math.max(anchorPoint.y, 24) : 70,
        detail: row.detail || `Drop-off risk ${row.risk}%`,
      };
    });
  }, [dropoffHeatmapRows, retentionMiniPlotPoints]);
  const retentionTimelineMoments = useMemo(() => {
    const combined = [
      ...retentionDropoffMoments.map((moment) => ({
        id: moment.id,
        tone: "drop" as const,
        stamp: moment.stamp,
        detail: `${moment.range} · ${moment.risk}% risk`,
        x: moment.x,
        y: moment.y,
      })),
      ...retentionHighMoments.map((moment) => ({
        id: moment.id,
        tone: "high" as const,
        stamp: moment.stamp,
        detail: `${moment.detail} · strong audience hold`,
        x: moment.x,
        y: moment.y,
      })),
    ];
    return combined.sort((a, b) => a.x - b.x).slice(0, 6);
  }, [retentionDropoffMoments, retentionHighMoments]);
  const facialZones = useMemo(() => {
    if (!jobAnalysis) return [] as { label: string; at: string; intensity: number; detail: string }[];
    const raw =
      jobAnalysis.facialZones ??
      jobAnalysis.facial_zones ??
      jobAnalysis.faceZones ??
      jobAnalysis.face_zones ??
      jobAnalysis.face_heatmap;
    if (Array.isArray(raw)) {
      return raw
        .map((entry: any, index: number) => {
          if (!entry || typeof entry !== "object") return null;
          const label = String(entry.label ?? entry.zone ?? `Face Zone ${index + 1}`).trim();
          const atValue = Number(entry.at ?? entry.time ?? entry.t ?? entry.second ?? entry.seconds);
          const at = Number.isFinite(atValue) ? formatTimelineStamp(atValue) : String(entry.at ?? "").trim();
          const intensity = normalizePercent(entry.intensity ?? entry.score ?? entry.value);
          if (intensity === null) return null;
          const detail = String(entry.detail ?? entry.note ?? entry.reason ?? "").trim();
          return { label: label || `Face Zone ${index + 1}`, at, intensity, detail };
        })
        .filter((entry): entry is { label: string; at: string; intensity: number; detail: string } => Boolean(entry))
        .slice(0, 6);
    }
    if (!engagementWindows.length) return [];
    const candidates = engagementWindows
      .map((entry) => {
        const time = Number(entry.time ?? entry.t ?? entry.second ?? entry.seconds);
        if (!Number.isFinite(time)) return null;
        const intensity = normalizePercent(entry.faceIntensity ?? entry.facePresence);
        if (intensity === null || intensity <= 0) return null;
        const presence = normalizePercent(entry.facePresence);
        const emotion = normalizePercent(entry.emotionIntensity ?? entry.emotionalSpike ?? entry.transcriptEmotion);
        const audioEnergy = normalizePercent(entry.audioEnergy ?? entry.motionScore);
        const detailParts = [];
        if (presence !== null) detailParts.push(`Presence ${presence}%`);
        if (emotion !== null) detailParts.push(`Emotion ${emotion}%`);
        if (audioEnergy !== null) detailParts.push(`Audio ${audioEnergy}%`);
        return {
          time,
          intensity,
          detail: detailParts.join(" · "),
        };
      })
      .filter((entry): entry is { time: number; intensity: number; detail: string } => Boolean(entry))
      .sort((a, b) => b.intensity - a.intensity);
    if (!candidates.length) return [];
    const zones: { label: string; at: string; intensity: number; detail: string }[] = [];
    const usedBuckets = new Set<number>();
    for (const candidate of candidates) {
      const bucket = Math.round(candidate.time);
      if (usedBuckets.has(bucket)) continue;
      zones.push({
        label: `Face Zone ${zones.length + 1}`,
        at: formatTimelineStamp(candidate.time),
        intensity: candidate.intensity,
        detail: candidate.detail,
      });
      usedBuckets.add(bucket);
      if (zones.length >= 4) break;
    }
    return zones;
  }, [engagementWindows, jobAnalysis]);
  const storyMapRows = useMemo(() => {
    if (!jobAnalysis) return [] as { phase: string; range: string; score: number | null; note: string }[];
    const graph = jobAnalysis.story_beat_graph ?? jobAnalysis.storyBeatGraph ?? jobAnalysis.story_map ?? jobAnalysis.storyMap;
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : Array.isArray(graph) ? graph : null;
    if (!Array.isArray(nodes)) return [];
    return nodes
      .map((node: any) => {
        if (!node || typeof node !== "object") return null;
        const phaseRaw = String(node.role ?? node.phase ?? node.label ?? "Beat").trim();
        const phase = phaseRaw ? phaseRaw.replace(/_/g, " ") : "Beat";
        const start = Number(node.start ?? node.start_time ?? node.t0);
        const end = Number(node.end ?? node.end_time ?? node.t1);
        const range = formatRangeLabel(Number.isFinite(start) ? start : null, Number.isFinite(end) ? end : null);
        const score = normalizePercent(node.strength ?? node.score ?? node.weight);
        const note = String(node.summary ?? node.note ?? node.detail ?? "").trim();
        return { phase, range, score, note };
      })
      .filter((entry): entry is { phase: string; range: string; score: number | null; note: string } => Boolean(entry))
      .slice(0, 4);
  }, [jobAnalysis]);
  const cutQualityPercent = useMemo(() => {
    const fromGate = readNumberFrom(jobAutonomous?.qualityGate as Record<string, any> | null, [
      "cutQualityScore",
      "cut_quality_score",
      "cutQuality",
    ]);
    const fromAnalysis = readNumberFrom(jobAnalysis, ["cut_quality_score", "cutQualityScore"]);
    return normalizePercent(fromGate ?? fromAnalysis);
  }, [jobAnalysis, jobAutonomous?.qualityGate]);
  const decisionLogDateLabel = useMemo(() => {
    const raw = jobAutonomous?.learning?.recordedAt ??
      jobAutonomous?.learning?.updatedAt ??
      jobAnalysis?.editor_last_updated_at ??
      jobAnalysis?.editorLastUpdatedAt;
    return formatOptionalShortDate(raw);
  }, [jobAnalysis?.editorLastUpdatedAt, jobAnalysis?.editor_last_updated_at, jobAutonomous?.learning]);
  const decisionNotes = useMemo(() => {
    if (Array.isArray(jobAutonomous?.notes) && jobAutonomous?.notes.length > 0) {
      return normalizeTextList(jobAutonomous.notes);
    }
    if (Array.isArray(jobAutonomous?.learning?.notes) && jobAutonomous?.learning?.notes.length > 0) {
      return normalizeTextList(jobAutonomous.learning.notes);
    }
    return [] as string[];
  }, [jobAutonomous]);
  const retentionScoreAfter = useMemo(() => {
    const fromGate = readNumberFrom(retentionGateSummary, [
      "final_predicted_retention",
      "selected_predicted_retention",
      "predicted_retention",
    ]);
    const winnerPredicted = readNumberFrom(abWinnerSummary, ["predicted_retention", "retentionScore"]);
    const winnerScore10 = readNumberFrom(abWinnerSummary, ["retention_score_10"]);
    const fromWinner = winnerPredicted ?? (winnerScore10 !== null ? winnerScore10 * 10.0 : null);
    const fromAnalysis = readNumberFrom(jobAnalysis, [
      "retention_score_after",
      "retentionScoreAfter",
      "retentionScore",
      "retention_score",
    ]);
    const fromJob = readNumberFrom(jobDetail as Record<string, any> | null, ["retentionScore", "retention_score"]);
    const preferred = fromGate ?? fromWinner ?? fromAnalysis ?? fromJob;
    return clampScore(preferred);
  }, [abWinnerSummary, jobAnalysis, jobDetail, retentionGateSummary]);
  const retentionScoreBefore = useMemo(
    () => clampScore(
      readNumberFrom(retentionGateSummary, [
        "final_predicted_retention_pre_edit",
        "selected_predicted_retention_pre_edit",
      ]) ?? readNumberFrom(jobAnalysis, ["retention_score_before", "retentionScoreBefore"]),
    ),
    [jobAnalysis, retentionGateSummary],
  );
  const retentionScoreDelta = useMemo(() => {
    const raw = readNumberFrom(jobAnalysis, ["retention_score_delta", "retentionScoreDelta", "retentionDelta"]);
    if (raw !== null && Number.isFinite(raw)) {
      const scaled = Math.abs(raw) <= 1 ? raw * 100 : raw;
      return Number(scaled.toFixed(1));
    }
    const gateAfter = clampScore(readNumberFrom(retentionGateSummary, ["final_predicted_retention"]));
    const gateBefore = clampScore(readNumberFrom(retentionGateSummary, ["final_predicted_retention_pre_edit"]));
    if (gateAfter !== null && gateBefore !== null) {
      return Number((gateAfter - gateBefore).toFixed(1));
    }
    if (retentionScoreAfter !== null && retentionScoreBefore !== null) {
      return Number((retentionScoreAfter - retentionScoreBefore).toFixed(1));
    }
    return null;
  }, [jobAnalysis, retentionGateSummary, retentionScoreAfter, retentionScoreBefore]);
  const hookConfidence = useMemo(
    () => clampScore(readNumberFrom(jobAnalysis, ["hook_audit_score", "hookAuditScore", "hook_score", "hookScore"])),
    [jobAnalysis],
  );
  const retentionTargetPlatformLabel = useMemo(() => {
    const raw = readStringFrom(jobAnalysis, [
      "retentionTargetPlatform",
      "retention_target_platform",
      "retentionPlatform",
      "targetPlatform",
      "platform",
    ])
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!raw) return "Auto";
    if (raw.includes("tiktok")) return "TikTok";
    if (raw.includes("instagram")) return "IG Reels";
    if (raw.includes("reels")) return "IG Reels";
    if (raw.includes("youtube")) return "YouTube";
    return raw.replace(/_/g, " ");
  }, [jobAnalysis]);
  const benchmarkTargets = useMemo(() => {
    if (!retentionBenchmarks) return null as null | {
      label: string;
      averageTarget: number;
      goodTarget: number;
      viralTarget: number;
      source: string;
    };
    const durationSec = readNumberFrom(jobAnalysis, [
      "duration_sec",
      "durationSec",
      "sourceDurationSec",
      "source_duration_sec",
      "runtime_seconds",
      "runtimeSeconds",
      "video_duration_sec",
      "videoDurationSec",
    ]) ?? readNumberFrom(jobDetail, ["durationSec", "duration_sec", "sourceDurationSec"]);
    const formatRaw = String(
      jobDetail?.renderMode ??
      jobAnalysis?.renderMode ??
      jobAnalysis?.render_mode ??
      jobAnalysis?.format ??
      jobAnalysis?.format_choice ??
      "",
    ).toLowerCase();
    const isShortForm = formatRaw.includes("vertical") || formatRaw.includes("short") || (durationSec !== null && durationSec <= 65);
    const source = String(retentionBenchmarks.source ?? "retention_dataset_2026").trim() || "retention_dataset_2026";

    if (isShortForm) {
      const shortsTiers = isObjectRecord(retentionBenchmarks.shorts_length_tiers)
        ? (retentionBenchmarks.shorts_length_tiers as Record<string, any>)
        : {};
      const primaryTier = isObjectRecord(shortsTiers.under_60s)
        ? shortsTiers.under_60s
        : (Object.values(shortsTiers).find((entry) => isObjectRecord(entry)) as Record<string, any> | undefined) ?? {};
      const averageTarget = normalizePercent(primaryTier.avg_end ?? retentionBenchmarks.shorts_average?.overall_avg ?? 73) ?? 73;
      const goodTarget = normalizePercent(primaryTier.good_end ?? retentionBenchmarks.templates?.good?.overall_avg ?? 80) ?? 80;
      const viralTarget = normalizePercent(primaryTier.viral_end ?? retentionBenchmarks.shorts_viral?.overall_avg ?? 88) ?? 88;
      return {
        label: String(primaryTier.label ?? "Shorts < 60s"),
        averageTarget,
        goodTarget,
        viralTarget: Math.max(viralTarget, goodTarget + 1),
        source,
      };
    }

    const longTiers = isObjectRecord(retentionBenchmarks.length_tiers)
      ? (retentionBenchmarks.length_tiers as Record<string, any>)
      : {};
    const duration = durationSec ?? 0;
    const tierKey = duration < 300 ? "under_5" : duration < 600 ? "5_10" : duration < 1200 ? "10_20" : "20_plus";
    const tier = isObjectRecord(longTiers[tierKey])
      ? longTiers[tierKey]
      : (Object.values(longTiers).find((entry) => isObjectRecord(entry)) as Record<string, any> | undefined) ?? {};
    const averageTarget = normalizePercent(tier.avg_end ?? retentionBenchmarks.non_viral?.overall_avg ?? retentionBenchmarks.templates?.average?.overall_avg ?? 30) ?? 30;
    const goodTarget = normalizePercent(tier.good_end ?? retentionBenchmarks.templates?.good?.overall_avg ?? 55) ?? 55;
    const viralTarget = normalizePercent(tier.viral_end ?? retentionBenchmarks.viral?.overall_avg ?? retentionBenchmarks.templates?.viral?.overall_avg ?? 60) ?? 60;
    return {
      label: String(tier.label ?? "Long-form"),
      averageTarget,
      goodTarget,
      viralTarget: Math.max(viralTarget, goodTarget + 1),
      source,
    };
  }, [jobAnalysis, jobDetail, retentionBenchmarks]);
  const rateForecastByPlatform = useMemo(() => {
    const base = { youtube: null, tiktok: null, instagramReels: null } as Record<RatePlatformKey, number | null>;
    for (const entry of platformForecast) {
      const key = entry.platformKey ?? normalizeRatePlatformKey(entry.label);
      if (!key) continue;
      const score = entry.after ?? entry.before;
      if (score === null) continue;
      base[key] = score;
    }
    return base;
  }, [platformForecast]);
  const rateEstimateBase = useMemo(() => {
    const signals = [retentionScoreAfter, hookConfidence, avgEmotion, cutQualityPercent]
      .filter((value): value is number => value !== null);
    if (signals.length === 0) return null;
    const average = signals.reduce((sum, value) => sum + value, 0) / signals.length;
    return clampPercent(Math.round(average));
  }, [avgEmotion, cutQualityPercent, hookConfidence, retentionScoreAfter]);
  const rateEstimateByPlatform = useMemo(() => {
    if (rateEstimateBase === null) {
      return { youtube: null, tiktok: null, instagramReels: null } as Record<RatePlatformKey, number | null>;
    }
    const youtubeBoost = retentionTargetPlatformLabel === "YouTube" ? 4 : 0;
    const tiktokBoost = retentionTargetPlatformLabel === "TikTok" ? 5 : 0;
    const reelsBoost = retentionTargetPlatformLabel === "IG Reels" ? 4 : 0;
    const modeBoost = scoreModeLabel === "Fast"
      ? { youtube: -2, tiktok: 3, instagramReels: 1 }
      : scoreModeLabel === "Quality"
        ? { youtube: 3, tiktok: -1, instagramReels: 2 }
        : { youtube: 0, tiktok: 0, instagramReels: 0 };
    return {
      youtube: clampPercent(Math.round(
        rateEstimateBase * 0.96 +
        youtubeBoost +
        modeBoost.youtube +
        (cutQualityPercent ? cutQualityPercent * 0.05 : 0),
      )),
      tiktok: clampPercent(Math.round(
        rateEstimateBase * 0.94 +
        tiktokBoost +
        modeBoost.tiktok +
        (hookConfidence ? hookConfidence * 0.08 : 0),
      )),
      instagramReels: clampPercent(Math.round(
        rateEstimateBase * 0.95 +
        reelsBoost +
        modeBoost.instagramReels +
        (avgEmotion ? avgEmotion * 0.07 : 0),
      )),
    };
  }, [
    avgEmotion,
    cutQualityPercent,
    hookConfidence,
    rateEstimateBase,
    retentionTargetPlatformLabel,
    scoreModeLabel,
  ]);
  const rateByPlatform = useMemo(() => ({
    youtube: rateForecastByPlatform.youtube ?? rateEstimateByPlatform.youtube ?? queryRateByPlatform.youtube,
    tiktok: rateForecastByPlatform.tiktok ?? rateEstimateByPlatform.tiktok ?? queryRateByPlatform.tiktok,
    instagramReels: rateForecastByPlatform.instagramReels ?? rateEstimateByPlatform.instagramReels ?? queryRateByPlatform.instagramReels,
  }), [queryRateByPlatform, rateEstimateByPlatform, rateForecastByPlatform]);
  const rateTopScore = useMemo(() => {
    const scores = [rateByPlatform.youtube, rateByPlatform.tiktok, rateByPlatform.instagramReels].filter(
      (score): score is number => score !== null,
    );
    if (!scores.length) return null;
    return Math.max(...scores);
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube]);
  const rateTopLabel = useMemo(() => {
    const explicit = String(searchParams.get("rateTopLabel") || "").trim();
    if (explicit && rateTopScore === null) return explicit.slice(0, 48);
    const rows = [
      { label: "YouTube", score: rateByPlatform.youtube },
      { label: "TikTok", score: rateByPlatform.tiktok },
      { label: "IG Reels", score: rateByPlatform.instagramReels },
    ].filter((row) => row.score !== null);
    if (!rows.length) return "Pending";
    return rows.reduce((best, row) => ((row.score ?? 0) > (best.score ?? 0) ? row : best), rows[0]).label;
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube, rateTopScore, searchParams]);
  const rateAverageScore = useMemo(() => {
    const scores = [rateByPlatform.youtube, rateByPlatform.tiktok, rateByPlatform.instagramReels].filter(
      (score): score is number => score !== null,
    );
    if (!scores.length) return queryRateAverageScore;
    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  }, [queryRateAverageScore, rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube]);
  const rateOverallScore = useMemo(() => {
    if (rateTopScore === null || rateAverageScore === null) return queryRateOverallScore;
    return clampPercent(Math.round(rateTopScore * 0.58 + rateAverageScore * 0.42));
  }, [queryRateOverallScore, rateAverageScore, rateTopScore]);
  const rateSelectedCount = useMemo(() => readCountParam(searchParams, "rateSelected", 0), [searchParams]);
  const rateSuggestionCount = useMemo(
    () => Math.max(rateSelectedCount, readCountParam(searchParams, "rateSuggestions", 0)),
    [rateSelectedCount, searchParams],
  );
  const rateNotesByPlatform = useMemo(() => {
    const baseParts: string[] = [];
    if (retentionScoreAfter !== null) baseParts.push(`Retention ${retentionScoreAfter}%`);
    if (hookConfidence !== null) baseParts.push(`Hook ${hookConfidence}%`);
    if (avgEmotion !== null) baseParts.push(`Emotion ${avgEmotion}%`);
    if (cutQualityPercent !== null) baseParts.push(`Cut quality ${cutQualityPercent}%`);
    if (retentionScoreDelta !== null && retentionScoreDelta !== 0) {
      baseParts.push(`Δ${retentionScoreDelta > 0 ? "+" : ""}${retentionScoreDelta} pts`);
    }
    if (scoreModeLabel !== "Standard") baseParts.push(`Mode ${scoreModeLabel}`);
    const fallback = baseParts.length > 0 ? baseParts.join(" · ") : "Awaiting full analysis.";
    const notes: Record<RatePlatformKey, string> = {
      youtube: fallback,
      tiktok: fallback,
      instagramReels: fallback,
    };
    for (const entry of platformForecast) {
      const key = entry.platformKey ?? normalizeRatePlatformKey(entry.label);
      if (!key) continue;
      const noteParts: string[] = [];
      if (entry.before !== null && entry.after !== null) {
        noteParts.push(`Forecast ${entry.before}→${entry.after}${entry.lift ? ` (${entry.lift})` : ""}`);
      } else if (entry.after !== null) {
        noteParts.push(`Forecast score ${entry.after}/100`);
      } else if (entry.before !== null) {
        noteParts.push(`Baseline ${entry.before}/100`);
      }
      if (entry.note) noteParts.push(entry.note);
      if (scoreModeLabel !== "Standard") noteParts.push(`Mode ${scoreModeLabel}`);
      notes[key] = noteParts.length > 0 ? noteParts.join(" · ") : fallback;
    }
    if (retentionTargetPlatformLabel === "YouTube") notes.youtube = `${notes.youtube} · Targeted platform`;
    if (retentionTargetPlatformLabel === "TikTok") notes.tiktok = `${notes.tiktok} · Targeted platform`;
    if (retentionTargetPlatformLabel === "IG Reels") notes.instagramReels = `${notes.instagramReels} · Targeted platform`;
    return notes;
  }, [
    avgEmotion,
    cutQualityPercent,
    hookConfidence,
    platformForecast,
    retentionScoreAfter,
    retentionScoreDelta,
    retentionTargetPlatformLabel,
    scoreModeLabel,
  ]);
  const rateUpdatedLabel = useMemo(() => {
    const analysis = jobDetail?.analysis as Record<string, any> | null | undefined;
    const raw =
      analysis?.rate_updated_at ??
      analysis?.rateUpdatedAt ??
      analysis?.editor_last_updated_at ??
      analysis?.editorLastUpdatedAt ??
      jobDetail?.updatedAt ??
      (jobDetail as any)?.updated_at ??
      searchParams.get("rateUpdated");
    const formatted = formatOptionalDateTime(raw);
    if (formatted) return formatted;
    const fallback = String(searchParams.get("rateUpdated") || "").trim();
    if (fallback) return fallback.slice(0, 40);
    return "Awaiting analysis update";
  }, [
    jobDetail,
    searchParams,
  ]);
  const directDownloadUrl = useMemo(() => pickFirstVideoUrl(
    jobDetail?.outputUrl,
    (jobDetail as any)?.output_url,
    (jobDetail as any)?.outputVideoUrl,
    (jobDetail as any)?.output_video_url,
    (jobDetail as any)?.downloadUrl,
    (jobDetail as any)?.download_url,
    (jobDetail as any)?.outputUrls,
    (jobDetail as any)?.output_urls,
    jobAnalysis?.outputUrl,
    jobAnalysis?.output_url,
    (jobAnalysis as any)?.outputVideoUrl,
    (jobAnalysis as any)?.output_video_url,
    (jobAnalysis as any)?.downloadUrl,
    (jobAnalysis as any)?.download_url,
    searchParams.get("outputUrl"),
  ), [jobAnalysis, jobDetail, searchParams]);
  const rateScoreRows = useMemo(() => ([
    {
      key: "youtube",
      label: "YouTube",
      score: rateByPlatform.youtube,
      barClassName: "from-rose-300/85 to-red-400/85",
      note: rateNotesByPlatform.youtube,
    },
    {
      key: "tiktok",
      label: "TikTok",
      score: rateByPlatform.tiktok,
      barClassName: "from-cyan-300/85 to-blue-400/85",
      note: rateNotesByPlatform.tiktok,
    },
    {
      key: "instagram",
      label: "IG Reels",
      score: rateByPlatform.instagramReels,
      barClassName: "from-fuchsia-300/85 to-pink-400/85",
      note: rateNotesByPlatform.instagramReels,
    },
  ]), [
    rateByPlatform.instagramReels,
    rateByPlatform.tiktok,
    rateByPlatform.youtube,
    rateNotesByPlatform.instagramReels,
    rateNotesByPlatform.tiktok,
    rateNotesByPlatform.youtube,
  ]);
  const hasRateCard = useMemo(
    () => rateAverageScore !== null || rateTopScore !== null || rateOverallScore !== null,
    [rateAverageScore, rateOverallScore, rateTopScore],
  );
  const handleDownloadVideo = async () => {
    if (downloadPending) return;
    setDownloadPending(true);
    setDownloadMessage("");
    try {
      let resolvedUrl = directDownloadUrl;
      if (!resolvedUrl && accessToken && activeJobId) {
        try {
          const out = await apiFetch<{ url?: string }>(`/api/jobs/${activeJobId}/download-url`, {
            method: "POST",
            token: accessToken,
          });
          if (isLikelyVideoUrl(out?.url)) resolvedUrl = String(out?.url);
        } catch {
          // fallback below
        }
      }
      if (!resolvedUrl && accessToken && activeJobId) {
        const refreshed = await apiFetch<{ job?: Record<string, any> }>(`/api/jobs/${activeJobId}`, { token: accessToken });
        if (refreshed?.job) {
          setJobDetail(refreshed.job);
          resolvedUrl = pickFirstVideoUrl(
            refreshed.job.outputUrl,
            refreshed.job.output_url,
            refreshed.job.outputVideoUrl,
            refreshed.job.output_video_url,
            refreshed.job.downloadUrl,
            refreshed.job.download_url,
            refreshed.job.outputUrls,
            refreshed.job.output_urls,
            refreshed.job.analysis?.outputUrl,
            refreshed.job.analysis?.output_url,
            refreshed.job.analysis?.downloadUrl,
            refreshed.job.analysis?.download_url,
          );
        }
      }
      if (!resolvedUrl) {
        throw new Error("Download URL is not ready yet. Let this render finish, then try again.");
      }
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
      setDownloadMessage("Download opened in a new tab.");
    } catch (error: any) {
      setDownloadMessage(error?.message || "Could not open download yet.");
    } finally {
      setDownloadPending(false);
    }
  };
  const retentionDetectionScore = useMemo(() => {
    const preferred = retentionScoreAfter ?? rateOverallScore;
    if (preferred === null) return null;
    return clampPercent(preferred);
  }, [rateOverallScore, retentionScoreAfter]);
  const autoPatchBars = useMemo(() => {
    const rawSeries = timelineSeries
      .map((row) => row.retention ?? Math.round((row.energy + row.emotion) / 2))
      .filter((value): value is number => Number.isFinite(value))
      .map((value) => clampPercent(value));
    const size = 23;
    if (rawSeries.length >= 4) {
      return Array.from({ length: size }, (_, index) => {
        const sourceIndex = Math.round((index / Math.max(1, size - 1)) * Math.max(0, rawSeries.length - 1));
        return rawSeries[sourceIndex] ?? rawSeries[rawSeries.length - 1] ?? 30;
      });
    }
    const base = retentionDetectionScore ?? 45;
    return Array.from({ length: size }, (_, index) => {
      const progress = index / Math.max(1, size - 1);
      const smooth = 0.72 + progress * 0.28;
      return clampPercent(Math.round(base * smooth));
    });
  }, [retentionDetectionScore, timelineSeries]);
  const autoPatchActiveIndex = useMemo(() => {
    const statusRaw = String(jobDetail?.status ?? "").trim().toLowerCase();
    const statusProgress = statusRaw === "ready" ? 100 : statusRaw === "processing" ? 55 : statusRaw === "queued" ? 25 : null;
    const progress = fullVideoScanProgress ?? statusProgress ?? retentionDetectionScore ?? 0;
    const maxIndex = autoPatchBars.length - 1;
    return Math.max(0, Math.min(maxIndex, Math.round((progress / 100) * maxIndex)));
  }, [autoPatchBars, fullVideoScanProgress, jobDetail?.status, retentionDetectionScore]);
  const autoPatchLogRows = useMemo(() => {
    const rows: { tone: "cmd" | "info" | "warn" | "success"; text: string }[] = [];
    const renderModeLabel = String(jobDetail?.renderMode || "horizontal").toLowerCase();
    rows.push({ tone: "cmd", text: `$ autoeditor --retention-safe --mode ${renderModeLabel}` });
    rows.push({ tone: "info", text: fullVideoScanLabel });

    if (dropoffHeatmapRows.length > 0) {
      rows.push({ tone: "warn", text: `${dropoffHeatmapRows.length} drop-off zone(s) flagged for patching` });
    }
    if (retentionScoreBefore !== null && retentionScoreAfter !== null) {
      const tone = retentionScoreAfter >= 50 ? "success" : "warn";
      rows.push({ tone, text: `Predicted retention ${retentionScoreBefore}% -> ${retentionScoreAfter}%` });
    } else if (retentionScoreAfter !== null) {
      rows.push({
        tone: retentionScoreAfter >= 50 ? "success" : "warn",
        text: `Predicted retention now ${retentionScoreAfter}%`,
      });
    }

    const oneMinuteTarget = normalizePercent(readNumberFrom(retentionGateSummary, ["one_minute_hold_target"]));
    const oneMinuteEstimate = normalizePercent(readNumberFrom(longFormGateSummary, ["one_minute_hold_estimate"]));
    if (oneMinuteTarget !== null) {
      if (oneMinuteEstimate !== null) {
        rows.push({
          tone: oneMinuteEstimate >= oneMinuteTarget ? "success" : "warn",
          text: `Minute-1 hold ${oneMinuteEstimate}% vs target ${oneMinuteTarget}%`,
        });
      } else {
        rows.push({ tone: "info", text: `Minute-1 hold target ${oneMinuteTarget}% (One Minute Wall guard)` });
      }
    }

    const qualityGateRaw = jobAutonomous?.qualityGate && typeof jobAutonomous.qualityGate === "object"
      ? (jobAutonomous.qualityGate as Record<string, any>)
      : readObjectFrom(jobAnalysis, ["qualityGate", "quality_gate"]);
    const qualityGatePassedSignal = parseBooleanLike(qualityGateRaw?.passed);
    if (qualityGatePassedSignal === true) {
      rows.push({ tone: "success", text: "Quality gate passed; winner locked for export" });
    } else if (qualityGatePassedSignal === false) {
      rows.push({ tone: "warn", text: "Quality gate not passed yet; additional patching may run" });
    }
    const winnerPolicy = readStringFrom(winnerPromotionSummary, ["pool_reason"]).replace(/_/g, " ").trim();
    if (winnerPolicy) {
      rows.push({ tone: "info", text: `Winner policy: ${winnerPolicy}` });
    }
    const rerenderRate = normalizePercent(readNumberFrom(rerenderSearchSummary, ["rerender_rate", "rerender_attempt_rate"]));
    const roundsUsed = readNumberFrom(rerenderSearchSummary, ["rounds_used"]);
    const maxRounds = readNumberFrom(rerenderSearchSummary, ["max_rounds"]);
    if (rerenderRate !== null) {
      const roundsLabel = Number.isFinite(roundsUsed) && Number.isFinite(maxRounds) && maxRounds > 0
        ? ` (${Math.round(roundsUsed)}/${Math.round(maxRounds)} rounds)`
        : "";
      rows.push({ tone: "info", text: `Re-render search rate ${rerenderRate}%${roundsLabel}` });
    }

    if (rows.length < 3) {
      rows.push({ tone: "info", text: "Awaiting live retention diagnostics..." });
    }
    return rows.slice(0, 8);
  }, [
    dropoffHeatmapRows.length,
    fullVideoScanLabel,
    jobAnalysis,
    jobAutonomous?.qualityGate,
    jobDetail?.renderMode,
    longFormGateSummary,
    retentionGateSummary,
    retentionScoreAfter,
    retentionScoreBefore,
    rerenderSearchSummary,
    winnerPromotionSummary,
  ]);
  const autoPatchStats = useMemo(() => {
    const patchCountRaw = readNumberFrom(jobAnalysis, ["patch_count", "patchCount", "editsApplied", "edits_applied"]);
    const patchCount = patchCountRaw !== null && Number.isFinite(patchCountRaw) ? Math.max(0, Math.round(patchCountRaw)) : null;
    const durationRaw = readNumberFrom(jobAnalysis, ["duration_sec", "durationSec", "sourceDurationSec", "source_duration_sec"]);
    const durationLabel = durationRaw !== null && Number.isFinite(durationRaw)
      ? formatTimelineStamp(durationRaw)
      : "--";
    const retentionValue = retentionScoreAfter !== null
      ? `${retentionScoreAfter}%`
      : retentionScoreDelta !== null
        ? `${retentionScoreDelta > 0 ? "+" : ""}${retentionScoreDelta.toFixed(1)} pts`
        : "--";
    return [
      { label: "Patches Applied", value: patchCount === null ? "--" : String(patchCount), accent: "neutral" },
      { label: "Analyzed", value: durationLabel, accent: "neutral" },
      { label: "Retention", value: retentionValue, accent: retentionScoreAfter !== null && retentionScoreAfter >= 50 ? "good" : "neutral" },
    ];
  }, [jobAnalysis, retentionScoreAfter, retentionScoreDelta]);
  const autoPatchPhaseLabel = useMemo(() => {
    const status = String(jobDetail?.status ?? "").trim().toLowerCase();
    if (status === "ready") return "Auto-Patch Complete";
    if (status === "failed") return "Auto-Patch Blocked";
    if (status === "queued") return "Auto-Patch Queued";
    if (status === "processing" || status === "running") return "Auto-Patch in Progress";
    return "Auto-Patch Status";
  }, [jobDetail?.status]);
  const qualityGate = useMemo(() => {
    const raw = jobAutonomous?.qualityGate ?? jobAnalysis?.qualityGate ?? jobAnalysis?.quality_gate;
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, any>;
  }, [jobAnalysis, jobAutonomous]);
  const qualityGatePassed = parseBooleanLike(qualityGate?.passed);
  const qualityGateScore = useMemo(() => {
    const passedChecks = Number(qualityGate?.passedChecks ?? qualityGate?.passed_checks);
    const totalChecks = Number(qualityGate?.totalChecks ?? qualityGate?.total_checks);
    if (Number.isFinite(passedChecks) && Number.isFinite(totalChecks) && totalChecks > 0) {
      return `${Math.round(passedChecks)}/${Math.round(totalChecks)}`;
    }
    return null;
  }, [qualityGate?.passedChecks, qualityGate?.passed_checks, qualityGate?.totalChecks, qualityGate?.total_checks]);
  const highRetentionLikelihood = useMemo(() => {
    const targets = benchmarkTargets;
    const observedRetention = retentionScoreAfter ?? rateOverallScore;
    if (!targets || observedRetention === null) return null as null | {
      score: number;
      bandLabel: string;
      detailLine: string;
      benchmarkLine: string;
    };

    const avgTarget = targets.averageTarget;
    const goodTarget = targets.goodTarget;
    const viralTarget = targets.viralTarget;
    const datasetClimb = clampUnit((observedRetention - avgTarget) / Math.max(8, goodTarget - avgTarget));
    const viralClimb = clampUnit((observedRetention - goodTarget) / Math.max(6, viralTarget - goodTarget));
    const benchmarkAlignment = clampUnit(datasetClimb * 0.55 + viralClimb * 0.45);

    const retentionLift = retentionScoreDelta ?? 0;
    const liftSignal = clampUnit((retentionLift + 8) / 22);
    const hookSignal = clampUnit((hookConfidence ?? 50) / 100);
    const cutSignal = clampUnit((cutQualityPercent ?? 50) / 100);
    const gateSignal = qualityGatePassed === true ? 1 : qualityGatePassed === false ? 0.2 : 0.55;
    const editsAppliedRaw = readNumberFrom(jobAnalysis, ["patch_count", "patchCount", "editsApplied", "edits_applied"]);
    const editsSignal = editsAppliedRaw !== null
      ? clampUnit(Math.log1p(Math.max(0, editsAppliedRaw)) / Math.log(12))
      : 0.5;
    const editExecution = clampUnit(
      0.28 * liftSignal +
      0.22 * hookSignal +
      0.2 * cutSignal +
      0.16 * gateSignal +
      0.14 * editsSignal,
    );

    const score = clampPercent(Math.round((benchmarkAlignment * 0.62 + editExecution * 0.38) * 100));
    const bandLabel = score >= 82
      ? "Very high"
      : score >= 68
        ? "High"
        : score >= 52
          ? "Moderate"
          : "Low";
    const detailLine = `Upload vs tier: ${observedRetention}% (good ${goodTarget}% · viral ${viralTarget}%)`;
    const benchmarkLine = `Dataset: ${targets.label} · source ${targets.source}`;
    return { score, bandLabel, detailLine, benchmarkLine };
  }, [
    benchmarkTargets,
    cutQualityPercent,
    hookConfidence,
    jobAnalysis,
    qualityGatePassed,
    rateOverallScore,
    retentionScoreAfter,
    retentionScoreDelta,
  ]);
  const humanReviewRequired = useMemo(() => {
    return parseBooleanLike(
      jobAnalysis?.humanReviewRequired ??
      jobAnalysis?.human_review_required,
    );
  }, [jobAnalysis]);
  const humanReviewState = useMemo(() => {
    const review = jobAnalysis?.human_review ?? jobAnalysis?.humanReview;
    if (!review || typeof review !== "object") return null;
    return review as Record<string, any>;
  }, [jobAnalysis]);
  const humanReviewNotes = useMemo(() => extractTextList(humanReviewState, [
    "comments",
    "reviewComments",
    "review_comments",
    "notes",
    "todo",
    "todo_list",
    "actionItems",
    "action_items",
    "instructions",
    "reviewerNotes",
    "reviewer_notes",
  ]), [humanReviewState]);
  const editorInstructionPlan = useMemo(() => {
    const plan = jobAnalysis?.editorInstructionPlan ?? jobAnalysis?.editor_instruction_plan;
    if (!plan || typeof plan !== "object") return null;
    return plan as Record<string, any>;
  }, [jobAnalysis]);
  const editorInstructionPrompt = useMemo(() => readStringFrom(jobAnalysis, [
    "editorInstructionPrompt",
    "editor_instruction_prompt",
    "directorNotes",
    "director_notes",
  ]), [jobAnalysis]);
  const agentTaskNotes = useMemo(() => {
    const fromPlan = Array.isArray(editorInstructionPlan?.notes) ? editorInstructionPlan?.notes : [];
    const fromReview = extractTextList(humanReviewState, [
      "agentNotes",
      "agent_notes",
      "agentTasks",
      "agent_tasks",
      "aiTasks",
      "ai_tasks",
    ]);
    return normalizeTextList([...(fromPlan || []), ...fromReview]);
  }, [editorInstructionPlan?.notes, humanReviewState]);
  const retentionJudge = useMemo(() => {
    const raw = jobAnalysis?.retention_judge ?? jobAnalysis?.retentionJudge;
    if (!raw || typeof raw !== "object") return null;
    return raw as Record<string, any>;
  }, [jobAnalysis]);
  const recommendedEditTips = useMemo(() => {
    const tips: string[] = [];
    const fixes = retentionJudge?.required_fixes ?? retentionJudge?.requiredFixes;
    if (isObjectRecord(fixes)) {
      if (parseBooleanLike(fixes.stronger_hook)) tips.push("Strengthen the first 3-8 seconds with a clearer hook and payoff preview.");
      if (parseBooleanLike(fixes.raise_emotion)) tips.push("Raise emotional pull early with higher-intensity moments and reactions.");
      if (parseBooleanLike(fixes.improve_pacing)) tips.push("Increase pacing by tightening low-energy stretches and accelerating cut rhythm.");
      if (parseBooleanLike(fixes.increase_interrupts)) tips.push("Add more pattern interrupts to avoid flat sections and reduce early drop-off.");
    }
    if (Array.isArray(retentionJudge?.what_is_generic)) {
      for (const line of retentionJudge.what_is_generic) {
        if (typeof line === "string" && line.trim()) tips.push(line.trim());
      }
    }
    if (Array.isArray(retentionJudge?.why_keep_watching)) {
      for (const line of retentionJudge.why_keep_watching) {
        if (typeof line === "string" && line.trim()) tips.push(`Preserve: ${line.trim()}`);
      }
    }
    for (const line of agentTaskNotes) {
      if (typeof line === "string" && line.trim()) tips.push(line.trim());
    }
    for (const line of decisionNotes) {
      if (typeof line === "string" && line.trim()) tips.push(line.trim());
    }
    return normalizeTextList(tips).slice(0, 7);
  }, [agentTaskNotes, decisionNotes, retentionJudge]);
  const recommendedReprocessPayload = useMemo(() => {
    const fixes = retentionJudge?.required_fixes ?? retentionJudge?.requiredFixes;
    const needsHook = isObjectRecord(fixes) ? parseBooleanLike(fixes.stronger_hook) === true : false;
    const needsEmotion = isObjectRecord(fixes) ? parseBooleanLike(fixes.raise_emotion) === true : false;
    const needsPacing = isObjectRecord(fixes) ? parseBooleanLike(fixes.improve_pacing) === true : false;
    const needsInterrupts = isObjectRecord(fixes) ? parseBooleanLike(fixes.increase_interrupts) === true : false;
    const severityCount = [needsHook, needsEmotion, needsPacing, needsInterrupts].filter(Boolean).length;
    const aggression = severityCount >= 3 ? "viral" : severityCount >= 1 ? "high" : "medium";
    const strategy = needsHook || needsInterrupts || needsPacing ? "viral" : "balanced";
    const pacingHeavy = needsPacing || needsInterrupts;
    const recommendedMaxCuts = pacingHeavy ? 30 : 22;
    const instructionLines = [
      "Apply editor recommended retention fixes on this upload before rerender.",
      ...recommendedEditTips.slice(0, 5).map((tip) => `- ${tip}`),
      "Prioritize first 30-60s stability and smoother pacing through the mid-section.",
    ];
    const payload: Record<string, any> = {
      forceReanalyze: true,
      retentionAggressionLevel: aggression,
      retentionStrategyProfile: strategy,
      maxCuts: recommendedMaxCuts,
      editorInstructionPrompt: instructionLines.join("\n"),
    };
    if (needsHook) payload.hookSelectionMode = "auto";
    return payload;
  }, [recommendedEditTips, retentionJudge]);
  const canApplyRecommendedEdits = Boolean(accessToken && activeJobId && rateDecisionReady && !applyTipsPending);
  const applyRecommendedEdits = async () => {
    if (!accessToken || !activeJobId || applyTipsPending) return;
    setApplyTipsPending(true);
    setApplyTipsMessage("");
    try {
      const result = await apiFetch<{
        ok?: boolean;
        queued?: boolean;
        rerenderUsage?: {
          rerendersRemaining?: number | null;
          rerendersLimit?: number | null;
        };
      }>(`/api/jobs/${activeJobId}/reprocess`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(recommendedReprocessPayload),
      });
      const remaining = Number(result?.rerenderUsage?.rerendersRemaining);
      const limit = Number(result?.rerenderUsage?.rerendersLimit);
      const usageLine = Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0
        ? ` ${remaining} of ${limit} re-renders left today.`
        : "";
      setApplyTipsMessage(`Recommended edits queued. Re-render started.${usageLine}`);
      setJobDetail((prev) => (prev ? { ...prev, status: "queued" } : prev));
    } catch (error: any) {
      const message = error?.message || "Could not queue re-render with recommended edits.";
      setApplyTipsMessage(String(message));
    } finally {
      setApplyTipsPending(false);
    }
  };
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-16 pt-20">
        <motion.header
          className="mx-auto max-w-6xl space-y-2"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            to={backToEditorHref}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(140deg,rgba(30,32,74,0.78),rgba(13,19,42,0.7))] p-4 backdrop-blur">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-12 h-28 w-28 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="border-primary/35 bg-primary/10 text-foreground">A-Mode</Badge>
                <Badge className="border-border/55 bg-background/55 text-foreground">Self-directed · Learning live</Badge>
              </div>
              <h1 className="mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">A-Mode Intelligence Deck</h1>
              <p className="mt-2 max-w-3xl text-[13px] text-foreground/85">
                Expanded retention intelligence with richer data, modern graphing, and a premium decision dashboard.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                {jobLoading ? (
                  <Badge className="border-cyan-300/35 bg-cyan-400/10 text-cyan-100">Syncing job data...</Badge>
                ) : null}
                {jobError ? (
                  <Badge className="border-rose-400/35 bg-rose-500/10 text-rose-200">{jobError}</Badge>
                ) : null}
                {jobDetail?.id ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">Job {jobDetail.id.slice(0, 10)}</Badge>
                ) : null}
                {jobDetail?.status ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">{String(jobDetail.status).toUpperCase()}</Badge>
                ) : null}
                {jobDetail?.renderMode ? (
                  <Badge className="border-border/60 bg-background/60 text-foreground">
                    {jobDetail.renderMode === "vertical" ? "Vertical render" : "Horizontal render"}
                  </Badge>
                ) : null}
                {jobDetail?.createdAt ? (
                  <span>Started {formatOptionalDateTime(jobDetail.createdAt)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-3 lg:grid-cols-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.38 }}
        >
          <article className="a-mode-visual-card">
            <div className="a-mode-visual-shell">
              <div className="a-mode-visual-top">
                <div className="a-mode-signal-strip" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="a-mode-visual-content">
                <p className="a-mode-visual-kicker">AI Analysis</p>
                <h2 className="a-mode-visual-title">Retention Detection</h2>
                <p className="a-mode-visual-subtitle">AutoEditor scans for audience drop-off points</p>
                <div className="a-mode-mini-card a-mode-mini-card-premium">
                  <div className="a-mode-mini-header">
                    <span className="a-mode-mini-label">Signal</span>
                    <span className="a-mode-mini-score">II {retentionDetectionScore !== null ? `${retentionDetectionScore}%` : "--"}</span>
                  </div>
                  <div className="a-mode-mini-legend-row">
                    <span className="a-mode-mini-legend-chip is-drop">Drop-off</span>
                    <span className="a-mode-mini-legend-chip is-high">High retention</span>
                    <span className="a-mode-mini-legend-chip is-trace">Live trace</span>
                  </div>
                  <div className="a-mode-mini-graph a-mode-mini-graph-premium">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                      <defs>
                        <linearGradient id="a-mode-mini-line" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.95)" />
                          <stop offset="52%" stopColor="rgba(124, 92, 255, 0.94)" />
                          <stop offset="100%" stopColor="rgba(52, 211, 153, 0.94)" />
                        </linearGradient>
                        <linearGradient id="a-mode-mini-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(56, 189, 248, 0.24)" />
                          <stop offset="65%" stopColor="rgba(124, 92, 255, 0.1)" />
                          <stop offset="100%" stopColor="rgba(124, 92, 255, 0.02)" />
                        </linearGradient>
                        <filter id="a-mode-mini-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="1.8" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <line x1="0" y1="20" x2="100" y2="20" className="a-mode-mini-grid-line" />
                      <line x1="0" y1="40" x2="100" y2="40" className="a-mode-mini-grid-line" />
                      <line x1="0" y1="60" x2="100" y2="60" className="a-mode-mini-grid-line" />
                      <line x1="0" y1="80" x2="100" y2="80" className="a-mode-mini-grid-line" />
                      <polyline points={retentionMiniArea} fill="url(#a-mode-mini-fill)" stroke="none" />
                      <polyline
                        points={retentionMiniPoints}
                        fill="none"
                        stroke="url(#a-mode-mini-line)"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#a-mode-mini-line-glow)"
                      />
                      {retentionDropoffMoments.map((event) => (
                        <g key={event.id}>
                          <circle className="a-mode-mini-marker-glow is-drop" cx={event.x} cy={event.y} r="7" />
                          <circle className="a-mode-mini-marker-core is-drop" cx={event.x} cy={event.y} r="2.8" />
                        </g>
                      ))}
                      {retentionHighMoments.map((event) => (
                        <g key={event.id}>
                          <circle className="a-mode-mini-marker-glow is-high" cx={event.x} cy={event.y} r="6.4" />
                          <circle className="a-mode-mini-marker-core is-high" cx={event.x} cy={event.y} r="2.6" />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="a-mode-mini-signal-grid">
                    <div className="a-mode-mini-signal-box is-drop">
                      <p className="a-mode-mini-signal-value">
                        {retentionDropoffMoments.length > 0 ? `${retentionDropoffMoments.length} zone${retentionDropoffMoments.length > 1 ? "s" : ""}` : "No risk zones"}
                      </p>
                      <p className="a-mode-mini-signal-note">Drop-off moments</p>
                    </div>
                    <div className="a-mode-mini-signal-box is-high">
                      <p className="a-mode-mini-signal-value">
                        {retentionHighMoments.length > 0 ? `${retentionHighMoments.length} peak${retentionHighMoments.length > 1 ? "s" : ""}` : "No peaks yet"}
                      </p>
                      <p className="a-mode-mini-signal-note">High-retention moments</p>
                    </div>
                  </div>
                  <div className="a-mode-mini-timestamp-rail">
                    {retentionTimelineMoments.length > 0 ? (
                      retentionTimelineMoments.map((moment) => (
                        <div
                          key={`retention-moment-${moment.id}`}
                          className={`a-mode-mini-time-chip ${moment.tone === "drop" ? "is-drop" : "is-high"}`}
                        >
                          <p className="a-mode-mini-time-stamp">{moment.stamp}</p>
                          <p className="a-mode-mini-time-note">{moment.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="a-mode-mini-time-fallback">
                        Timestamp moments appear after retention traces are synced.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="a-mode-visual-footer">
                <button
                  className="a-mode-download-btn"
                  type="button"
                  onClick={handleDownloadVideo}
                  disabled={downloadPending}
                >
                  {downloadPending ? "Preparing..." : "Download Video"}
                </button>
                {downloadMessage ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">{downloadMessage}</p>
                ) : null}
              </div>
            </div>
          </article>

          <article className="a-mode-visual-card">
            <div className="a-mode-visual-shell a-mode-visual-shell-alt">
              <div className="a-mode-visual-top">
                <div className="a-mode-signal-strip" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="a-mode-visual-content">
                <p className="a-mode-visual-kicker">Performance Mode</p>
                <h2 className="a-mode-visual-title">{autoPatchPhaseLabel}</h2>
                <div className="a-mode-bar-grid" aria-hidden="true">
                  {autoPatchBars.map((height, index) => {
                    const isActive = index === autoPatchActiveIndex;
                    const isTrailing = index > autoPatchActiveIndex - 3 && index < autoPatchActiveIndex + 3;
                    return (
                      <span
                        key={`a-mode-bar-${index}`}
                        className={`a-mode-bar ${isActive ? "is-active" : ""} ${isTrailing ? "is-trailing" : ""}`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
                <div className="a-mode-terminal">
                  <div className="a-mode-terminal-header">
                    <span className="a-mode-terminal-dot is-red" />
                    <span className="a-mode-terminal-dot is-yellow" />
                    <span className="a-mode-terminal-dot is-green" />
                    <span className="a-mode-terminal-title">autoeditor --retention-safe --performance-safe</span>
                  </div>
                  <div className="a-mode-terminal-body">
                    {autoPatchLogRows.map((row) => (
                      <p key={row.text} className={`a-mode-terminal-line is-${row.tone}`}>
                        {row.text}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="a-mode-stat-grid">
                  {autoPatchStats.map((stat) => (
                    <div key={stat.label} className={`a-mode-stat-card ${stat.accent === "good" ? "is-good" : ""}`}>
                      <p className="a-mode-stat-value">{stat.value}</p>
                      <p className="a-mode-stat-label">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-2 sm:grid-cols-2 lg:grid-cols-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention score</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {retentionScoreAfter !== null ? `${retentionScoreAfter}%` : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {retentionScoreAfter !== null ? "Latest retention score" : "Awaiting retention score"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">High-retention likelihood</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {highRetentionLikelihood ? `${highRetentionLikelihood.score}%` : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {highRetentionLikelihood ? `${highRetentionLikelihood.bandLabel} confidence` : "Awaiting benchmark + edit signals"}
            </p>
            {highRetentionLikelihood ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {highRetentionLikelihood.detailLine}
              </p>
            ) : null}
            {highRetentionLikelihood ? (
              <p className="mt-1 text-[10px] text-muted-foreground">{highRetentionLikelihood.benchmarkLine}</p>
            ) : null}
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Peak energy</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {peakEnergyPoint ? peakEnergyPoint.energy : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {peakEnergyPoint ? `At ${peakEnergyPoint.stamp}` : "Awaiting energy scan"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Emotion sync</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{avgEmotion ?? "--"}</p>
            <p className="text-[10px] text-muted-foreground">
              {avgEmotion !== null ? "Facial + audio weighted" : "Awaiting emotion scan"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Quality gate</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                qualityGatePassed === false
                  ? "text-rose-200"
                  : qualityGatePassed === true
                    ? "text-emerald-200"
                    : "text-foreground"
              }`}
            >
              {qualityGateScore ?? "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {qualityGatePassed === false
                ? "Gate needs attention"
                : qualityGatePassed === true
                  ? "All hard checks passed"
                  : "Quality gate awaiting signal"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rate Card Winner</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{rateTopScore ?? "--"}</p>
            <p className="text-[10px] text-muted-foreground">{rateTopScore !== null ? rateTopLabel : "Pending"}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {rateDecisionReady && hasRateCard
                ? "Locked on ready render"
                : hasRateCard
                  ? "Live estimate"
                  : "Awaiting rate data"}
            </p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-3 grid max-w-6xl gap-2 sm:grid-cols-2 lg:grid-cols-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention before</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{retentionScoreBefore ?? "--"}</p>
            <p className="text-[10px] text-muted-foreground">Baseline signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention delta</p>
            <p className={`mt-1 text-xl font-semibold ${
              retentionScoreDelta === null
                ? "text-foreground"
                : retentionScoreDelta >= 0
                  ? "text-emerald-200"
                  : "text-rose-200"
            }`}>
              {retentionScoreDelta !== null ? `${retentionScoreDelta > 0 ? "+" : ""}${retentionScoreDelta}` : "--"}
            </p>
            <p className="text-[10px] text-muted-foreground">After - before</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Hook confidence</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{hookConfidence ?? "--"}{hookConfidence !== null ? "%" : ""}</p>
            <p className="text-[10px] text-muted-foreground">Opener signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Target platform</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{retentionTargetPlatformLabel}</p>
            <p className="text-[10px] text-muted-foreground">Retention focus</p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-3 grid max-w-6xl gap-3 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(145deg,rgba(29,35,68,0.72),rgba(14,18,39,0.74))] p-3">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  Editor Agent Rate Card
                </p>
                <Badge className="border-primary/35 bg-primary/10 text-foreground">Moved to A-Mode</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <p className="font-display text-4xl font-bold leading-none text-foreground">
                  {rateOverallScore ?? "--"}
                </p>
                <span className="pb-1 text-sm text-muted-foreground">{rateOverallScore !== null ? "/100" : "pending"}</span>
              </div>
              <p className="mt-1 text-xs text-foreground/90">
                {rateTopScore !== null
                  ? `Top platform: ${rateTopLabel} ${rateDecisionReady ? `${rateTopScore}/100` : "(estimating)"}`
                  : "Top platform: Pending"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {rateAverageScore !== null ? `Avg score ${rateAverageScore}/100` : "Avg score pending"} · Updated {rateUpdatedLabel}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Suggestions selected {rateSelectedCount}/{rateSuggestionCount}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Score mode: {scoreModeLabel}
              </p>
              <div className="mt-2.5 space-y-2">
                {rateScoreRows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border/55 bg-background/45 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{row.label}</p>
                      <Badge className="border-primary/35 bg-primary/10 text-foreground">{row.score ?? "--"}</Badge>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/65">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${row.barClassName}`}
                        style={{ width: `${row.score ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Full Video Scan Progress
              </p>
              <Badge className="border-cyan-300/35 bg-cyan-400/10 text-cyan-100">
                {fullVideoScanProgress === null
                  ? "Scan pending"
                  : fullVideoScanProgress >= 100
                    ? "Scan complete"
                    : "Scan running"}
              </Badge>
            </div>
            <p className="mt-2 font-display text-4xl font-bold leading-none text-foreground">
              {fullVideoScanProgress === null ? "--" : `${Math.round(fullVideoScanProgress)}%`}
            </p>
            <Progress
              value={fullVideoScanProgress ?? 0}
              className="mt-2.5 h-2 bg-muted/70 [&>div]:bg-gradient-to-r [&>div]:from-cyan-300 [&>div]:to-primary"
            />
            <p className="mt-2 text-[13px] text-foreground/90">{fullVideoScanLabel}</p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Render Link</p>
                <p className="mt-1 text-xs text-foreground">{activeJobId ? `Job ${activeJobId.slice(0, 12)}` : "No job selected"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Mode Note</p>
                <p className="mt-1 text-xs text-foreground">Full scan and rate decisions now live on this page.</p>
              </div>
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-3 grid max-w-6xl gap-3 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Modern Energy + Emotion Timeline
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">Premium graph</Badge>
            </div>
            {hasTimeline ? (
              <>
                <div className="mt-2.5 h-36 rounded-xl border border-border/55 bg-[linear-gradient(180deg,rgba(26,33,59,0.76),rgba(14,19,38,0.62))] p-3">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    <defs>
                      <linearGradient id="a-mode-energy" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(56,189,248,0.95)" />
                        <stop offset="100%" stopColor="rgba(16,185,129,0.95)" />
                      </linearGradient>
                      <linearGradient id="a-mode-emotion" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(244,114,182,0.95)" />
                        <stop offset="100%" stopColor="rgba(251,146,60,0.95)" />
                      </linearGradient>
                    </defs>
                    <polyline points={energyPoints} fill="none" stroke="url(#a-mode-energy)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={emotionPoints} fill="none" stroke="url(#a-mode-emotion)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-1">
                  {timelineSeries.map((row) => (
                    <div key={row.stamp} className="rounded-md border border-border/50 bg-background/45 px-2 py-1">
                      <p className="text-[10px] text-muted-foreground">{row.stamp}</p>
                      <p className="text-[11px] font-medium text-foreground">E {row.energy} · M {row.emotion}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-2.5 flex h-36 items-center justify-center rounded-xl border border-border/55 bg-[linear-gradient(180deg,rgba(26,33,59,0.76),rgba(14,19,38,0.62))] text-xs text-muted-foreground">
                No energy/emotion timeline available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Platform Outcome Forecast
              </p>
              <Badge className="border-emerald-400/35 bg-emerald-500/10 text-emerald-200">
                {platformForecast.length > 0 ? "Live uplift deck" : "Forecast pending"}
              </Badge>
            </div>
            {platformForecast.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {platformForecast.map((row) => (
                  <div key={row.label} className="rounded-lg border border-border/55 bg-background/45 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{row.label}</p>
                      <Badge className="border-primary/35 bg-primary/10 text-primary">
                        {row.lift ? `Lift ${row.lift}` : "Lift pending"}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Before</span>
                          <span>{row.before ?? "--"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-slate-400/75" style={{ width: `${row.before ?? 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>After</span>
                          <span>{row.after ?? "--"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300/80" style={{ width: `${row.after ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg border border-border/55 bg-background/45 p-2.5 text-xs text-muted-foreground">
                No platform forecast available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Audience Drop-off Heatmap
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">
                {dropoffHeatmapRows.length > 0 ? "Heatmap ready" : "Heatmap pending"}
              </Badge>
            </div>
            {dropoffHeatmapRows.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {dropoffHeatmapRows.map((zone) => (
                  <div key={`${zone.label}-${zone.range}`} className="rounded-lg border border-border/60 bg-background/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{zone.label} · {zone.range}</p>
                      <Badge className="border-rose-300/40 bg-rose-500/12 text-rose-100">{zone.risk}% risk</Badge>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300/85 via-orange-300/85 to-rose-300/90"
                        style={{ width: `${zone.risk}%` }}
                      />
                    </div>
                    {zone.detail ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{zone.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg border border-border/60 bg-background/60 p-2.5 text-xs text-muted-foreground">
                Drop-off heatmap appears here after engagement windows are available.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <ScanFace className="h-3.5 w-3.5 text-primary" />
                Facial Signal Heatmap
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">
                {facialZones.length > 0 ? "Signal active" : "Signal pending"}
              </Badge>
            </div>
            {facialZones.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {facialZones.map((zone) => (
                  <div key={`${zone.label}-${zone.at}`} className="rounded-lg border border-border/60 bg-background/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{zone.label}{zone.at ? ` · ${zone.at}` : ""}</p>
                      <Badge className="border-border/55 bg-background/55 text-foreground">{zone.intensity}</Badge>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted/70">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300/90 to-primary/90" style={{ width: `${zone.intensity}%` }} />
                    </div>
                    {zone.detail ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{zone.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg border border-border/60 bg-background/60 p-2.5 text-xs text-muted-foreground">
                No facial signal data available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Editor Agent Story Map
              </p>
              <Badge className="border-amber-400/35 bg-amber-500/10 text-amber-200">
                {storyMapRows.length > 0 ? "Narrative tuned" : "Narrative pending"}
              </Badge>
            </div>
            {storyMapRows.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {storyMapRows.map((row, index) => (
                  <div key={`${row.phase}-${row.range}-${index}`} className="rounded-lg border border-border/60 bg-background/50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{row.phase}</p>
                      <Badge variant="outline" className="border-border/55 bg-background/45 text-[10px] text-muted-foreground">
                        {row.range}
                      </Badge>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/90 to-emerald-300/85"
                        style={{ width: `${row.score ?? 0}%` }}
                      />
                    </div>
                    {row.note ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs text-muted-foreground">
                No story map data available yet.
              </div>
            )}
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-3 grid max-w-6xl gap-3 lg:grid-cols-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                AI Review Details
              </p>
              <Badge className={humanReviewRequired ? "border-amber-300/40 bg-amber-500/12 text-amber-100" : "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"}>
                {humanReviewRequired ? "AI review enabled" : "Auto-approve"}
              </Badge>
            </div>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Status</p>
                <p className="mt-1 text-xs text-foreground">
                  {humanReviewState?.status
                    ? String(humanReviewState.status).replace(/_/g, " ")
                    : humanReviewRequired
                      ? "Awaiting review"
                      : "Not required"}
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Preview</p>
                <p className="mt-1 text-xs text-foreground">
                  {humanReviewState?.previewDurationSeconds
                    ? `${Math.round(Number(humanReviewState.previewDurationSeconds))}s`
                    : "Pending"}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {humanReviewState?.previewMode ? `Mode ${humanReviewState.previewMode}` : "Preview not ready"}
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Requested</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.requestedAt) || "--"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Approved</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.approvedAt) || "--"}</p>
              </div>
            </div>
            {humanReviewState?.previewError ? (
              <p className="mt-2 text-[11px] text-rose-200">Preview error: {String(humanReviewState.previewError)}</p>
            ) : null}
            <div className="mt-2.5">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Reviewer notes</p>
              {humanReviewNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {humanReviewNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-1.5 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No AI review notes yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Agent Task Brief
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">AI agent notes</Badge>
            </div>
            {editorInstructionPrompt ? (
              <div className="mt-2.5 rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                {editorInstructionPrompt}
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">No agent prompt attached yet.</p>
            )}
            <div className="mt-2.5">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Action items</p>
              {agentTaskNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {agentTaskNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-1.5 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No agent action items found.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                Recommended Edit Apply
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">A-Mode action card</Badge>
            </div>
            {recommendedEditTips.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {recommendedEditTips.map((tip, index) => (
                  <div key={`${tip}-${index}`} className="rounded-lg border border-border/55 bg-background/45 px-3 py-1.5 text-xs text-foreground/90">
                    {tip}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">
                Waiting for editor recommendations from the latest upload analysis.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={applyRecommendedEdits}
                disabled={!canApplyRecommendedEdits}
                className="h-8 px-3 text-xs"
              >
                {applyTipsPending ? "Applying + re-rendering..." : "Apply Recommended Edits + Re-render"}
              </Button>
              {!rateDecisionReady ? (
                <span className="text-[11px] text-muted-foreground">Wait until this upload is fully ready.</span>
              ) : null}
            </div>
            {applyTipsMessage ? (
              <p className="mt-2 text-[11px] text-muted-foreground">{applyTipsMessage}</p>
            ) : null}
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-3 max-w-6xl rounded-2xl border border-primary/25 bg-background/55 p-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5 text-primary" />
              Autonomous Editor Decision Log
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge className="border-primary/35 bg-primary/10 text-foreground">
                <Gauge className="mr-1 h-3.5 w-3.5" />
                {cutQualityPercent !== null ? `Cut quality ${cutQualityPercent}%` : "Cut quality pending"}
              </Badge>
              <Badge className="border-emerald-400/35 bg-emerald-500/10 text-emerald-200">
                <Target className="mr-1 h-3.5 w-3.5" />
                {qualityGatePassed === true
                  ? "Goal line active"
                  : qualityGatePassed === false
                    ? "Goal line missed"
                    : "Goal line pending"}
              </Badge>
              {decisionLogDateLabel ? (
                <Badge className="border-sky-400/35 bg-sky-500/10 text-sky-100">
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                  Refined {decisionLogDateLabel}
                </Badge>
              ) : null}
            </div>
          </div>
          {decisionNotes.length > 0 ? (
            <div className="mt-2.5 space-y-2">
              {decisionNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-1.5 text-xs text-foreground/90">
                  {note}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2.5 text-xs text-muted-foreground">No decision log entries yet.</p>
          )}
        </motion.section>

        <div className="mx-auto mt-5 flex max-w-6xl justify-end">
          <Button asChild>
            <Link to={backToEditorHref}>Return to Editor</Link>
          </Button>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default EditorAMode;
