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
const normalizePercent = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const scaled = Math.abs(raw) <= 1 ? raw * 100 : raw;
  return clampPercent(Math.round(scaled));
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

const EditorAMode = () => {
  const [searchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const [jobDetail, setJobDetail] = useState<Record<string, any> | null>(null);
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
  const rateOverallScore = useMemo(() => {
    return normalizePercent(searchParams.get("rateOverall"));
  }, [searchParams]);
  const rateAverageScore = useMemo(() => readOptionalPercentParam(searchParams, "rateAverage"), [searchParams]);
  const rateByPlatform = useMemo(() => ({
    youtube: readOptionalPercentParam(searchParams, "rateYoutube"),
    tiktok: readOptionalPercentParam(searchParams, "rateTiktok"),
    instagramReels: readOptionalPercentParam(searchParams, "rateInstagram"),
  }), [searchParams]);
  const rateTopLabel = useMemo(() => {
    const explicit = String(searchParams.get("rateTopLabel") || "").trim();
    if (explicit) return explicit.slice(0, 48);
    const rows = [
      { label: "YouTube", score: rateByPlatform.youtube },
      { label: "TikTok", score: rateByPlatform.tiktok },
      { label: "IG Reels", score: rateByPlatform.instagramReels },
    ].filter((row) => row.score !== null);
    if (!rows.length) return "Pending";
    return rows.reduce((best, row) => ((row.score ?? 0) > (best.score ?? 0) ? row : best), rows[0]).label;
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube, searchParams]);
  const rateTopScore = useMemo(() => {
    const raw = normalizePercent(searchParams.get("rateTopScore"));
    if (raw !== null) return raw;
    const scores = [rateByPlatform.youtube, rateByPlatform.tiktok, rateByPlatform.instagramReels].filter(
      (score): score is number => score !== null,
    );
    if (!scores.length) return null;
    return Math.max(...scores);
  }, [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube, searchParams]);
  const rateSelectedCount = useMemo(() => readCountParam(searchParams, "rateSelected", 0), [searchParams]);
  const rateSuggestionCount = useMemo(
    () => Math.max(rateSelectedCount, readCountParam(searchParams, "rateSuggestions", 0)),
    [rateSelectedCount, searchParams],
  );
  const rateUpdatedLabel = useMemo(() => {
    const raw = String(searchParams.get("rateUpdated") || "").trim();
    if (!raw) return "Awaiting first live update";
    return raw.slice(0, 40);
  }, [searchParams]);
  const rateScoreRows = useMemo(() => ([
    {
      key: "youtube",
      label: "YouTube",
      score: rateByPlatform.youtube,
      barClassName: "from-rose-300/85 to-red-400/85",
    },
    {
      key: "tiktok",
      label: "TikTok",
      score: rateByPlatform.tiktok,
      barClassName: "from-cyan-300/85 to-blue-400/85",
    },
    {
      key: "instagram",
      label: "IG Reels",
      score: rateByPlatform.instagramReels,
      barClassName: "from-fuchsia-300/85 to-pink-400/85",
    },
  ]), [rateByPlatform.instagramReels, rateByPlatform.tiktok, rateByPlatform.youtube]);
  const hasRateCard = useMemo(
    () => rateAverageScore !== null || rateTopScore !== null || rateOverallScore !== null,
    [rateAverageScore, rateOverallScore, rateTopScore],
  );
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
    if (!jobAnalysis) return [] as { stamp: string; energy: number; emotion: number; retention?: number }[];
    const pickArray = (...values: unknown[]) => values.find((value) => Array.isArray(value)) as unknown[] | undefined;
    const buildFromEngagement = (windows: Record<string, any>[]) => {
      if (!windows.length) return [] as { stamp: string; energy: number; emotion: number; retention?: number }[];
      const usable = windows
        .map((entry) => {
          const time = Number(entry.time ?? entry.t ?? entry.second ?? entry.seconds);
          return Number.isFinite(time) ? { ...entry, time } : null;
        })
        .filter((entry): entry is Record<string, any> & { time: number } => Boolean(entry));
      if (!usable.length) return [] as { stamp: string; energy: number; emotion: number; retention?: number }[];
      const targetCount = Math.min(12, Math.max(6, Math.round(usable.length / 90)));
      const maxIndex = usable.length - 1;
      const points: { stamp: string; energy: number; emotion: number; retention?: number }[] = [];
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
        });
      }
      return points;
    };
    const parseObjectSeries = (series: unknown[]) => {
      const points: { stamp: string; energy: number; emotion: number; retention?: number }[] = [];
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
        const stamp = Number.isFinite(stampNumber)
          ? formatTimelineStamp(stampNumber)
          : String((entry as any).stamp || "").trim();
        points.push({
          stamp: stamp || formatTimelineStamp(index),
          energy,
          emotion,
          retention: retention ?? undefined,
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
          };
        }).filter((point): point is { stamp: string; energy: number; emotion: number } => Boolean(point));
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
  const platformForecast = useMemo(() => {
    if (!jobAnalysis) return [] as { label: string; before: number | null; after: number | null; lift: string }[];
    const raw =
      jobAnalysis.platform_forecast ??
      jobAnalysis.platformForecast ??
      jobAnalysis.platform_outcome_forecast ??
      jobAnalysis.platformOutcomeForecast;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry: any, index: number) => {
        if (!entry || typeof entry !== "object") return null;
        const labelRaw = String(entry.label ?? entry.platform ?? entry.name ?? "").trim();
        const label = labelRaw || `Platform ${index + 1}`;
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
        return { label, before, after, lift };
      })
      .filter((entry): entry is { label: string; before: number | null; after: number | null; lift: string } => Boolean(entry))
      .slice(0, 5);
  }, [jobAnalysis]);
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
  const retentionScoreAfter = useMemo(
    () => clampScore(
      readNumberFrom(jobAnalysis, [
        "retention_score_after",
        "retentionScoreAfter",
        "retentionScore",
        "retention_score",
      ]) ?? (jobDetail?.retentionScore ?? null),
    ),
    [jobAnalysis, jobDetail?.retentionScore],
  );
  const retentionScoreBefore = useMemo(
    () => clampScore(readNumberFrom(jobAnalysis, ["retention_score_before", "retentionScoreBefore"])),
    [jobAnalysis],
  );
  const retentionScoreDelta = useMemo(() => {
    const raw = readNumberFrom(jobAnalysis, ["retention_score_delta", "retentionScoreDelta", "retentionDelta"]);
    if (raw !== null && Number.isFinite(raw)) {
      const scaled = Math.abs(raw) <= 1 ? raw * 100 : raw;
      return Number(scaled.toFixed(1));
    }
    if (retentionScoreAfter !== null && retentionScoreBefore !== null) {
      return Number((retentionScoreAfter - retentionScoreBefore).toFixed(1));
    }
    return null;
  }, [jobAnalysis, retentionScoreAfter, retentionScoreBefore]);
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
  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.header
          className="mx-auto max-w-6xl space-y-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Link
            to={backToEditorHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to editor
          </Link>
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(140deg,rgba(30,32,74,0.78),rgba(13,19,42,0.7))] p-5 backdrop-blur">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-12 h-28 w-28 rounded-full bg-cyan-300/15 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className="border-primary/35 bg-primary/10 text-foreground">A-Mode</Badge>
                <Badge className="border-border/55 bg-background/55 text-foreground">Self-directed · Learning live</Badge>
              </div>
              <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">A-Mode Intelligence Deck</h1>
              <p className="mt-2 max-w-3xl text-sm text-foreground/85">
                Expanded retention intelligence with richer data, modern graphing, and a premium decision dashboard.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
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
          className="mx-auto mt-6 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention score</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {retentionScoreAfter !== null ? `${retentionScoreAfter}%` : "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {retentionScoreAfter !== null ? "Latest retention score" : "Awaiting retention score"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Peak energy</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {peakEnergyPoint ? peakEnergyPoint.energy : "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {peakEnergyPoint ? `At ${peakEnergyPoint.stamp}` : "Awaiting energy scan"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Emotion sync</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{avgEmotion ?? "--"}</p>
            <p className="text-[11px] text-muted-foreground">
              {avgEmotion !== null ? "Facial + audio weighted" : "Awaiting emotion scan"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Quality gate</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                qualityGatePassed === false
                  ? "text-rose-200"
                  : qualityGatePassed === true
                    ? "text-emerald-200"
                    : "text-foreground"
              }`}
            >
              {qualityGateScore ?? "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {qualityGatePassed === false
                ? "Gate needs attention"
                : qualityGatePassed === true
                  ? "All hard checks passed"
                  : "Quality gate awaiting signal"}
            </p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Rate Card Winner</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{rateTopScore ?? "--"}</p>
            <p className="text-[11px] text-muted-foreground">{rateTopScore !== null ? rateTopLabel : "Pending"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {rateDecisionReady && hasRateCard
                ? "Locked on ready render"
                : hasRateCard
                  ? "Live estimate"
                  : "Awaiting rate data"}
            </p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35 }}
        >
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention before</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{retentionScoreBefore ?? "--"}</p>
            <p className="text-[11px] text-muted-foreground">Baseline signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Retention delta</p>
            <p className={`mt-1 text-2xl font-semibold ${
              retentionScoreDelta === null
                ? "text-foreground"
                : retentionScoreDelta >= 0
                  ? "text-emerald-200"
                  : "text-rose-200"
            }`}>
              {retentionScoreDelta !== null ? `${retentionScoreDelta > 0 ? "+" : ""}${retentionScoreDelta}` : "--"}
            </p>
            <p className="text-[11px] text-muted-foreground">After - before</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Hook confidence</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{hookConfidence ?? "--"}{hookConfidence !== null ? "%" : ""}</p>
            <p className="text-[11px] text-muted-foreground">Opener signal</p>
          </article>
          <article className="rounded-xl border border-primary/25 bg-background/55 p-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Target platform</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{retentionTargetPlatformLabel}</p>
            <p className="text-[11px] text-muted-foreground">Retention focus</p>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(145deg,rgba(29,35,68,0.72),rgba(14,18,39,0.74))] p-4">
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
                <p className="font-display text-5xl font-bold leading-none text-foreground">
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
              <div className="mt-3 space-y-2">
                {rateScoreRows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border/55 bg-background/45 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{row.label}</p>
                      <Badge className="border-primary/35 bg-primary/10 text-foreground">{row.score ?? "--"}</Badge>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/65">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${row.barClassName}`}
                        style={{ width: `${row.score ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
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
            <p className="mt-3 font-display text-5xl font-bold leading-none text-foreground">
              {fullVideoScanProgress === null ? "--" : `${Math.round(fullVideoScanProgress)}%`}
            </p>
            <Progress
              value={fullVideoScanProgress ?? 0}
              className="mt-3 h-2.5 bg-muted/70 [&>div]:bg-gradient-to-r [&>div]:from-cyan-300 [&>div]:to-primary"
            />
            <p className="mt-2 text-sm text-foreground/90">{fullVideoScanLabel}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Render Link</p>
                <p className="mt-1 text-xs text-foreground">{activeJobId ? `Job ${activeJobId.slice(0, 12)}` : "No job selected"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Mode Note</p>
                <p className="mt-1 text-xs text-foreground">Full scan and rate decisions now live on this page.</p>
              </div>
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Modern Energy + Emotion Timeline
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">Premium graph</Badge>
            </div>
            {hasTimeline ? (
              <>
                <div className="mt-3 h-44 rounded-xl border border-border/55 bg-[linear-gradient(180deg,rgba(26,33,59,0.76),rgba(14,19,38,0.62))] p-3">
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
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {timelineSeries.map((row) => (
                    <div key={row.stamp} className="rounded-md border border-border/50 bg-background/45 px-2 py-1.5">
                      <p className="text-[10px] text-muted-foreground">{row.stamp}</p>
                      <p className="text-[11px] font-medium text-foreground">E {row.energy} · M {row.emotion}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-3 flex h-44 items-center justify-center rounded-xl border border-border/55 bg-[linear-gradient(180deg,rgba(26,33,59,0.76),rgba(14,19,38,0.62))] text-xs text-muted-foreground">
                No energy/emotion timeline available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
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
              <div className="mt-3 space-y-2">
                {platformForecast.map((row) => (
                  <div key={row.label} className="rounded-lg border border-border/55 bg-background/45 p-2.5">
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
                        <div className="h-2 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-slate-400/75" style={{ width: `${row.before ?? 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>After</span>
                          <span>{row.after ?? "--"}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-300/80" style={{ width: `${row.after ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-border/55 bg-background/45 p-3 text-xs text-muted-foreground">
                No platform forecast available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
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
              <div className="mt-3 space-y-2">
                {facialZones.map((zone) => (
                  <div key={`${zone.label}-${zone.at}`} className="rounded-lg border border-border/60 bg-background/60 p-2.5">
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
              <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                No facial signal data available yet.
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
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
              <div className="mt-3 space-y-2">
                {storyMapRows.map((row, index) => (
                  <div key={`${row.phase}-${row.range}-${index}`} className="rounded-lg border border-border/60 bg-background/50 p-2.5">
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
              <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                No story map data available yet.
              </div>
            )}
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.38 }}
        >
          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                AI Review Details
              </p>
              <Badge className={humanReviewRequired ? "border-amber-300/40 bg-amber-500/12 text-amber-100" : "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"}>
                {humanReviewRequired ? "AI review enabled" : "Auto-approve"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Status</p>
                <p className="mt-1 text-xs text-foreground">
                  {humanReviewState?.status
                    ? String(humanReviewState.status).replace(/_/g, " ")
                    : humanReviewRequired
                      ? "Awaiting review"
                      : "Not required"}
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
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
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Requested</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.requestedAt) || "--"}</p>
              </div>
              <div className="rounded-lg border border-border/55 bg-background/45 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Approved</p>
                <p className="mt-1 text-xs text-foreground">{formatOptionalDateTime(humanReviewState?.approvedAt) || "--"}</p>
              </div>
            </div>
            {humanReviewState?.previewError ? (
              <p className="mt-2 text-[11px] text-rose-200">Preview error: {String(humanReviewState.previewError)}</p>
            ) : null}
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Reviewer notes</p>
              {humanReviewNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {humanReviewNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No AI review notes yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-primary/25 bg-background/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Agent Task Brief
              </p>
              <Badge className="border-primary/35 bg-primary/10 text-foreground">AI agent notes</Badge>
            </div>
            {editorInstructionPrompt ? (
              <div className="mt-3 rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                {editorInstructionPrompt}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No agent prompt attached yet.</p>
            )}
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Action items</p>
              {agentTaskNotes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {agentTaskNotes.map((note) => (
                    <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No agent action items found.</p>
              )}
            </div>
          </article>
        </motion.section>

        <motion.section
          className="mx-auto mt-4 max-w-6xl rounded-2xl border border-primary/25 bg-background/55 p-4"
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
            <div className="mt-3 space-y-2">
              {decisionNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border/55 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                  {note}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No decision log entries yet.</p>
          )}
        </motion.section>

        <div className="mx-auto mt-6 flex max-w-6xl justify-end">
          <Button asChild>
            <Link to={backToEditorHref}>Return to Editor</Link>
          </Button>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default EditorAMode;
