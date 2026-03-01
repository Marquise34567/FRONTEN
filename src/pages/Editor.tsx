import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  ScissorsSquare,
  MousePointerClick,
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

const normalizeVerticalCaptionTextForJob = (value: string) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 1800);

const normalizeCaptionHexColor = (value: string, fallback: string) => {
  const compact = String(value || "").trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(compact)) return compact;
  return fallback;
};

type VerticalCaptionPresetOptionId =
  | "basic_clean"
  | "mrbeast_animated"
  | "neon_glow"
  | "bold_clean_box"
  | "rage_mode"
  | "ice_pop"
  | "retro_wave"
  | "glitch_pop"
  | "cinema_punch";
type VerticalCaptionFontOptionId = "impact" | "sans_bold" | "condensed" | "serif_bold" | "display_black" | "mono_bold";
type VerticalCaptionAnimationOptionId = "none" | "pop" | "slide" | "fade" | "bounce" | "glitch";

const VERTICAL_CAPTION_STYLE_OPTIONS: Array<{ id: VerticalCaptionPresetOptionId; label: string; description: string }> = [
  { id: "rage_mode", label: "TikTok Punch", description: "High-energy caption look for TikTok pacing." },
  { id: "bold_clean_box", label: "IG Reels Clean", description: "Readable box caption style for Reels." },
  { id: "cinema_punch", label: "YouTube Shorts Bold", description: "High-contrast Shorts-style captions." },
  { id: "mrbeast_animated", label: "Creator Hype", description: "Punchy pop captions with big outlines." },
  { id: "basic_clean", label: "Minimal", description: "Simple clean subtitles with subtle outline." },
  { id: "neon_glow", label: "Neon Glow", description: "Stylized neon look for energetic edits." },
  { id: "ice_pop", label: "Ice Pop", description: "Cool-blue pop style." },
  { id: "retro_wave", label: "Retro Wave", description: "Retro colorful caption style." },
  { id: "glitch_pop", label: "Glitch Pop", description: "Glitch-style captions for high motion clips." },
];
const VERTICAL_CAPTION_FONT_OPTIONS: Array<{ id: VerticalCaptionFontOptionId; label: string }> = [
  { id: "impact", label: "Impact" },
  { id: "sans_bold", label: "Sans Bold" },
  { id: "condensed", label: "Condensed" },
  { id: "serif_bold", label: "Serif Bold" },
  { id: "display_black", label: "Display Black" },
  { id: "mono_bold", label: "Mono Bold" },
];
const VERTICAL_CAPTION_ANIMATION_OPTIONS: Array<{ id: VerticalCaptionAnimationOptionId; label: string }> = [
  { id: "none", label: "Static" },
  { id: "pop", label: "Pop" },
  { id: "slide", label: "Slide" },
  { id: "fade", label: "Fade" },
  { id: "bounce", label: "Bounce" },
  { id: "glitch", label: "Glitch" },
];
const VERTICAL_CAPTION_PRESET_DEFAULTS: Record<
  VerticalCaptionPresetOptionId,
  { fontId: VerticalCaptionFontOptionId; outlineColor: string; outlineWidth: number; animation: VerticalCaptionAnimationOptionId }
> = {
  basic_clean: { fontId: "sans_bold", outlineColor: "0F172A", outlineWidth: 3, animation: "none" },
  mrbeast_animated: { fontId: "impact", outlineColor: "050505", outlineWidth: 18, animation: "pop" },
  neon_glow: { fontId: "condensed", outlineColor: "071E28", outlineWidth: 6, animation: "slide" },
  bold_clean_box: { fontId: "sans_bold", outlineColor: "000000", outlineWidth: 6, animation: "none" },
  rage_mode: { fontId: "impact", outlineColor: "1A0202", outlineWidth: 14, animation: "bounce" },
  ice_pop: { fontId: "condensed", outlineColor: "041426", outlineWidth: 10, animation: "pop" },
  retro_wave: { fontId: "display_black", outlineColor: "25003A", outlineWidth: 9, animation: "slide" },
  glitch_pop: { fontId: "mono_bold", outlineColor: "111827", outlineWidth: 8, animation: "glitch" },
  cinema_punch: { fontId: "serif_bold", outlineColor: "1A1203", outlineWidth: 7, animation: "none" },
};
const DEFAULT_VERTICAL_CAPTION_STYLE: VerticalCaptionPresetOptionId = "rage_mode";

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
  renderMode?: "horizontal" | "vertical" | "standard" | string;
}

interface JobDetail extends JobSummary {
  outputUrl?: string | null;
  outputUrls?: string[] | null;
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

type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"];

type PipelineStepHoverDetail = {
  title: string;
  summary: string;
  lines: string[];
};

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
type AnalysisExplorerTab = "hooks" | "risks" | "actions";

type ExplorerHookCandidate = {
  id: string;
  startSec: number;
  endSec: number;
  score: number | null;
  auditScore: number | null;
  reason: string;
  text: string;
  selected: boolean;
};

type ExplorerRiskWindow = {
  id: string;
  startSec: number;
  endSec: number;
  severity: number;
  source: "drop" | "removed" | "compressed";
  reason: string;
};

type ExplorerActionItem = {
  id: string;
  startSec: number | null;
  endSec: number | null;
  action: string;
  intensity: number | null;
  reason: string;
};

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

const formatMegabytes = (bytes: number | null | undefined) => {
  const parsed = Number(bytes);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const mb = parsed / MB;
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(2)} MB`;
};

const formatTokenLabel = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const truncateText = (value: string, max = 120) => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
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

const normalizeHookExplorerCandidates = ({
  raw,
  selectedStart,
  selectedEnd,
  maxDurationSec,
}: {
  raw: unknown;
  selectedStart: number | null;
  selectedEnd: number | null;
  maxDurationSec: number;
}): ExplorerHookCandidate[] => {
  if (!Array.isArray(raw)) return [];
  const safeDuration = Math.max(1, maxDurationSec || 1);
  const mapped = raw
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      const startRaw = firstFiniteNumber(item.start, item.startSec, item.hook_start_time);
      const durationRaw = firstFiniteNumber(item.duration, item.durationSec);
      const endRaw = firstFiniteNumber(item.end, item.endSec, item.hook_end_time);
      if (startRaw === null && endRaw === null) return null;
      const startSec = clamp(startRaw ?? Math.max(0, (endRaw ?? 0) - 8), 0, Math.max(0, safeDuration - 0.2));
      const endSec = clamp(
        endRaw ?? (durationRaw !== null ? startSec + durationRaw : startSec + 8),
        startSec + 0.2,
        safeDuration,
      );
      const score = toScore100(item.score, item.score100);
      const auditScore = toScore100(item.auditScore, item.audit_score, item.hook_audit_score);
      const reason =
        (typeof item.reason === "string" && item.reason.trim()) ||
        (typeof item.hook_reason === "string" && item.hook_reason.trim()) ||
        "Candidate selected from strongest opener signals.";
      const text =
        (typeof item.text === "string" && item.text.trim()) ||
        (typeof item.transcript === "string" && item.transcript.trim()) ||
        "";
      const selected =
        selectedStart !== null &&
        selectedEnd !== null &&
        Math.abs(startSec - selectedStart) < 0.15 &&
        Math.abs(endSec - selectedEnd) < 0.2;
      return {
        id: `${index}-${Math.round(startSec * 10)}-${Math.round(endSec * 10)}`,
        startSec: Number(startSec.toFixed(3)),
        endSec: Number(endSec.toFixed(3)),
        score,
        auditScore,
        reason: String(reason),
        text: String(text),
        selected,
      } satisfies ExplorerHookCandidate;
    })
    .filter((item): item is ExplorerHookCandidate => Boolean(item))
    .sort((left, right) => {
      const leftScore = left.score ?? left.auditScore ?? 0;
      const rightScore = right.score ?? right.auditScore ?? 0;
      return rightScore - leftScore || left.startSec - right.startSec;
    });
  return mapped.slice(0, 12);
};

const normalizeRangeWindows = ({
  raw,
  source,
  reasonFallback,
  severityFallback,
  maxDurationSec,
}: {
  raw: unknown;
  source: ExplorerRiskWindow["source"];
  reasonFallback: string;
  severityFallback: number;
  maxDurationSec: number;
}): ExplorerRiskWindow[] => {
  if (!Array.isArray(raw)) return [];
  const safeDuration = Math.max(1, maxDurationSec || 1);
  return raw
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      const startRaw = firstFiniteNumber(item.start, item.startSec, item.t);
      const endRaw = firstFiniteNumber(item.end, item.endSec, item.to);
      if (startRaw === null || endRaw === null) return null;
      const startSec = clamp(startRaw, 0, Math.max(0, safeDuration - 0.2));
      const endSec = clamp(endRaw, startSec + 0.2, safeDuration);
      if (endSec - startSec < 0.2) return null;
      const severity = clamp(
        Math.round(firstFiniteNumber(item.score, item.severity, item.intensity, severityFallback) ?? severityFallback),
        0,
        100,
      );
      const reason =
        (typeof item.reason === "string" && item.reason.trim()) ||
        (typeof item.description === "string" && item.description.trim()) ||
        reasonFallback;
      return {
        id: `${source}-${index}-${Math.round(startSec * 10)}-${Math.round(endSec * 10)}`,
        startSec: Number(startSec.toFixed(3)),
        endSec: Number(endSec.toFixed(3)),
        severity,
        source,
        reason: String(reason),
      } satisfies ExplorerRiskWindow;
    })
    .filter((item): item is ExplorerRiskWindow => Boolean(item));
};

const normalizeExplorerActions = ({
  raw,
  maxDurationSec,
}: {
  raw: unknown;
  maxDurationSec: number;
}): ExplorerActionItem[] => {
  if (!Array.isArray(raw)) return [];
  const safeDuration = Math.max(1, maxDurationSec || 1);
  return raw
    .map((entry, index) => {
      const item = asRecord(entry);
      if (!item) return null;
      const startRaw = firstFiniteNumber(item.start, item.startSec, item.t);
      const endRaw = firstFiniteNumber(item.end, item.endSec, item.to);
      const hasRange = startRaw !== null && endRaw !== null;
      const startSec = hasRange ? clamp(startRaw as number, 0, Math.max(0, safeDuration - 0.2)) : null;
      const endSec = hasRange ? clamp(endRaw as number, (startSec as number) + 0.2, safeDuration) : null;
      const reason =
        (typeof item.reason === "string" && item.reason.trim()) ||
        (typeof item.description === "string" && item.description.trim()) ||
        "Applied by retention planner.";
      const actionRaw =
        (typeof item.action === "string" && item.action) ||
        (typeof item.type === "string" && item.type) ||
        "adjust";
      const action = actionRaw.replace(/_/g, " ").trim();
      const intensity = toScore100(item.intensity, item.score, item.severity);
      return {
        id: `action-${index}-${Math.round((startSec ?? 0) * 10)}`,
        startSec: startSec !== null ? Number(startSec.toFixed(3)) : null,
        endSec: endSec !== null ? Number(endSec.toFixed(3)) : null,
        action,
        intensity,
        reason: String(reason),
      } satisfies ExplorerActionItem;
    })
    .filter((item): item is ExplorerActionItem => Boolean(item))
    .slice(0, 18);
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
  const [analysisExplorerTab, setAnalysisExplorerTab] = useState<AnalysisExplorerTab>("hooks");
  const [analysisCursorSec, setAnalysisCursorSec] = useState<number | null>(null);
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
  const modeParam = searchParams.get("mode");
  const isVerticalMode = modeParam === "vertical";
  const [verticalClipCount, setVerticalClipCount] = useState(8);
  const [verticalCaptionText, setVerticalCaptionText] = useState("");
  const [verticalCaptionPreset, setVerticalCaptionPreset] = useState<VerticalCaptionPresetOptionId>(DEFAULT_VERTICAL_CAPTION_STYLE);
  const [verticalCaptionFontId, setVerticalCaptionFontId] = useState<VerticalCaptionFontOptionId>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].fontId,
  );
  const [verticalCaptionOutlineColor, setVerticalCaptionOutlineColor] = useState<string>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].outlineColor,
  );
  const [verticalCaptionOutlineWidth, setVerticalCaptionOutlineWidth] = useState<number>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].outlineWidth,
  );
  const [verticalCaptionAnimation, setVerticalCaptionAnimation] = useState<VerticalCaptionAnimationOptionId>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].animation,
  );
  const [pendingVerticalFile, setPendingVerticalFile] = useState<File | null>(null);
  const [verticalPreviewUrl, setVerticalPreviewUrl] = useState<string | null>(null);

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

  const applyVerticalCaptionPreset = useCallback((presetId: VerticalCaptionPresetOptionId) => {
    const defaults = VERTICAL_CAPTION_PRESET_DEFAULTS[presetId] ?? VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE];
    setVerticalCaptionPreset(presetId);
    setVerticalCaptionFontId(defaults.fontId);
    setVerticalCaptionOutlineColor(defaults.outlineColor);
    setVerticalCaptionOutlineWidth(defaults.outlineWidth);
    setVerticalCaptionAnimation(defaults.animation);
  }, []);

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
    return () => {
      if (verticalPreviewUrl) URL.revokeObjectURL(verticalPreviewUrl);
    };
  }, [verticalPreviewUrl]);

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

  const handleFile = async (
    file: File,
    renderOptions?: {
      mode?: "horizontal" | "vertical";
      verticalClipCount?: number;
    },
  ) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4 or MKV file." });
      return;
    }
    if (!accessToken) return;
    const requestedMode = renderOptions?.mode === "vertical" ? "vertical" : "horizontal";
    const verticalCaptionTextForJob = normalizeVerticalCaptionTextForJob(verticalCaptionText);
    const verticalCaptionsPayload =
      requestedMode === "vertical"
        ? {
            enabled: true,
            autoGenerate: verticalCaptionTextForJob.length === 0,
            preset: verticalCaptionPreset,
            text: verticalCaptionTextForJob,
            fontId: verticalCaptionFontId,
            outlineColor: normalizeCaptionHexColor(
              verticalCaptionOutlineColor,
              VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].outlineColor,
            ),
            outlineWidth: clamp(Math.round(verticalCaptionOutlineWidth), 0, 24),
            animation: verticalCaptionAnimation,
          }
        : null;
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
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            renderMode: requestedMode,
            ...(requestedMode === "vertical" ? { verticalClipCount: renderOptions?.verticalClipCount ?? verticalClipCount } : {}),
            ...(requestedMode === "vertical" ? { verticalCaptionText: verticalCaptionTextForJob } : {}),
            ...(requestedMode === "vertical" ? { verticalCaptions: verticalCaptionsPayload } : {}),
          }),
          token: accessToken,
        },
      );

      setUploadingJobId(create.job.id);
      pipelineStartRef.current[create.job.id] = Date.now();
      statusStartRef.current[create.job.id] = { status: "uploading", startedAt: Date.now() };
      setJobs((prev) => [{ ...create.job, renderMode: requestedMode, status: "uploading", progress: 5 }, ...(Array.isArray(prev) ? prev : [])]);

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
          body: JSON.stringify({
            key: create.inputPath,
            ...(requestedMode === "vertical" ? { renderMode: "vertical" as const } : {}),
            ...(requestedMode === "vertical" ? { verticalClipCount: renderOptions?.verticalClipCount ?? verticalClipCount } : {}),
            ...(requestedMode === "vertical" ? { verticalCaptionText: verticalCaptionTextForJob } : {}),
            ...(requestedMode === "vertical" ? { verticalCaptions: verticalCaptionsPayload } : {}),
          }),
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

  const prepareVerticalFile = useCallback(
    (file: File) => {
      if (!isAllowedUploadFile(file)) {
        toast({ title: "Unsupported file type", description: "Please upload an MP4 or MKV file." });
        return;
      }
      setPendingVerticalFile(file);
      setVerticalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [toast],
  );

  const startVerticalRender = useCallback(() => {
    if (!pendingVerticalFile) {
      toast({ title: "Choose a file", description: "Upload a video before creating vertical clips." });
      return;
    }
    void handleFile(pendingVerticalFile, {
      mode: "vertical",
      verticalClipCount,
    });
  }, [handleFile, pendingVerticalFile, toast, verticalClipCount]);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (isVerticalMode) {
      prepareVerticalFile(file);
      return;
    }
    void handleFile(file);
  };

  const toggleEditorMode = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (isVerticalMode) {
      next.delete("mode");
      setPendingVerticalFile(null);
      setVerticalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } else {
      next.set("mode", "vertical");
    }
    setSearchParams(next, { replace: false });
  }, [isVerticalMode, searchParams, setSearchParams]);

  const handleSelectJob = (jobId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("jobId", jobId);
    setSearchParams(next, { replace: false });
  };

  const openVideoAnalysisWithFocus = useCallback((focus: AnalysisDetailFocus) => {
    setAnalysisDetailFocus(focus);
    setVideoAnalysisOpen(true);
  }, []);

  const focusAnalysisAtTime = useCallback((seconds: number, focus: AnalysisDetailFocus = "retention") => {
    setAnalysisCursorSec(Math.max(0, seconds));
    setAnalysisDetailFocus(focus);
    setVideoAnalysisOpen(true);
  }, []);

  const handleFocusGraphClick = useCallback(
    (
      event: MouseEvent<HTMLButtonElement>,
      durationSec: number,
      focus: AnalysisDetailFocus,
    ) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) {
        setAnalysisDetailFocus(focus);
        return;
      }
      const relativeX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const targetSec = Number((relativeX * Math.max(1, durationSec)).toFixed(2));
      setAnalysisCursorSec(targetSec);
      setAnalysisDetailFocus(focus);
    },
    [],
  );

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
  const analysisDurationSec = Math.max(
    1,
    estimatedDurationSec ?? retentionTimelineDurationSec ?? emotionTimelineDurationSec ?? 1,
  );
  const activeEditPlan = useMemo(
    () => asRecord(activeAnalysis?.editPlan) ?? asRecord(activeAnalysis?.edit_plan),
    [activeAnalysis],
  );
  const selectedHookStartSec = firstFiniteNumber(
    activeAnalysis?.hook_start_time,
    activeAnalysis?.hookStartTime,
    activeAnalysis?.hook?.start,
    activeAnalysis?.preferred_hook?.start,
    activeAnalysis?.preferredHook?.start,
  );
  const selectedHookEndSec = firstFiniteNumber(
    activeAnalysis?.hook_end_time,
    activeAnalysis?.hookEndTime,
    selectedHookStartSec !== null
      ? firstFiniteNumber(
          activeAnalysis?.hook?.duration !== undefined
            ? selectedHookStartSec + Number(activeAnalysis?.hook?.duration)
            : null,
          activeAnalysis?.preferred_hook?.duration !== undefined
            ? selectedHookStartSec + Number(activeAnalysis?.preferred_hook?.duration)
            : null,
        )
      : null,
    activeAnalysis?.preferred_hook?.end,
    activeAnalysis?.preferredHook?.end,
  );
  const hookExplorerCandidates = useMemo<ExplorerHookCandidate[]>(() => {
    const raw =
      activeAnalysis?.hook_candidates ||
      activeAnalysis?.hookCandidates ||
      activeAnalysis?.hook_variants ||
      activeAnalysis?.hookVariants ||
      activeEditPlan?.hookCandidates ||
      activeEditPlan?.hook_candidates ||
      activeEditPlan?.hookVariants ||
      activeEditPlan?.hook_variants ||
      [];
    return normalizeHookExplorerCandidates({
      raw,
      selectedStart: selectedHookStartSec,
      selectedEnd: selectedHookEndSec,
      maxDurationSec: analysisDurationSec,
    });
  }, [activeAnalysis, activeEditPlan, selectedHookStartSec, selectedHookEndSec, analysisDurationSec]);
  const plannerSummary = useMemo(
    () => asRecord(activeEditPlan?.planner) ?? asRecord(activeAnalysis?.planner),
    [activeEditPlan, activeAnalysis],
  );
  const plannerPacingAdjustmentCount = Math.max(
    0,
    Math.round(
      firstFiniteNumber(
        plannerSummary?.pacingAdjustmentCount,
        plannerSummary?.pacing_adjustment_count,
        activeEditPlan?.pacingGovernorAdjustments,
      ) ?? 0,
    ),
  );
  const plannerProtectionChanges = useMemo(() => {
    const rows =
      (Array.isArray(plannerSummary?.retentionProtectionChanges) && plannerSummary?.retentionProtectionChanges) ||
      (Array.isArray(plannerSummary?.retention_protection_changes) && plannerSummary?.retention_protection_changes) ||
      [];
    return rows
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  }, [plannerSummary]);
  const actionExplorerItems = useMemo<ExplorerActionItem[]>(() => {
    const fromBoredom = normalizeExplorerActions({
      raw: activeEditPlan?.boredomActions || activeEditPlan?.boredom_actions || [],
      maxDurationSec: analysisDurationSec,
    });
    const fromPlannerText = plannerProtectionChanges.map((item, index) => ({
      id: `planner-protection-${index}`,
      startSec: null,
      endSec: null,
      action: "retention protection",
      intensity: null,
      reason: item,
    }));
    return [...fromBoredom, ...fromPlannerText].slice(0, 18);
  }, [activeEditPlan, analysisDurationSec, plannerProtectionChanges]);
  const modelConfidenceScore = toScore100(
    plannerSummary?.predictionConfidence,
    plannerSummary?.prediction_confidence,
    activeAnalysis?.retention_judge?.confidence,
    activeAnalysis?.retention_judge?.confidence_percent,
  );
  const analysisConfidenceScore = useMemo(() => {
    const model = modelConfidenceScore ?? clamp(fullScanProgress - 8, 0, 100);
    return roundToTenths(clamp(model * 0.62 + fullScanProgress * 0.38, 0, 100));
  }, [modelConfidenceScore, fullScanProgress]);
  const analysisCursorSafeSec = analysisCursorSec === null ? null : clamp(analysisCursorSec, 0, analysisDurationSec);
  const retentionCursorX = analysisCursorSafeSec === null
    ? null
    : clamp((analysisCursorSafeSec / Math.max(1, retentionTimelineDurationSec)) * 100, 0, 100);
  const emotionCursorX = analysisCursorSafeSec === null
    ? null
    : clamp((analysisCursorSafeSec / Math.max(1, emotionTimelineDurationSec)) * 100, 0, 100);
  const closestRetentionAtCursor = useMemo(() => {
    if (analysisCursorSafeSec === null || retentionCurvePoints.length === 0) return null;
    let best = retentionCurvePoints[0];
    let bestDistance = Math.abs(retentionCurvePoints[0].atSec - analysisCursorSafeSec);
    for (let index = 1; index < retentionCurvePoints.length; index += 1) {
      const point = retentionCurvePoints[index];
      const distance = Math.abs(point.atSec - analysisCursorSafeSec);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best;
  }, [analysisCursorSafeSec, retentionCurvePoints]);
  const closestEmotionAtCursor = useMemo(() => {
    if (analysisCursorSafeSec === null || emotionTimelineSegments.length === 0) return null;
    let best = emotionTimelineSegments[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const segment of emotionTimelineSegments) {
      if (analysisCursorSafeSec >= segment.startSec && analysisCursorSafeSec <= segment.endSec) {
        return segment;
      }
      const center = segment.startSec + (segment.endSec - segment.startSec) * 0.5;
      const distance = Math.abs(center - analysisCursorSafeSec);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = segment;
      }
    }
    return best;
  }, [analysisCursorSafeSec, emotionTimelineSegments]);
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
  const riskExplorerWindows = useMemo<ExplorerRiskWindow[]>(() => {
    const removed = normalizeRangeWindows({
      raw: activeAnalysis?.removed_segments || activeAnalysis?.removedSegments || [],
      source: "removed",
      reasonFallback: "Hard-cut range removed to avoid viewer drop-off.",
      severityFallback: 78,
      maxDurationSec: analysisDurationSec,
    });
    const compressed = normalizeRangeWindows({
      raw: activeAnalysis?.compressed_segments || activeAnalysis?.compressedSegments || [],
      source: "compressed",
      reasonFallback: "Compressed section to preserve context with less drag.",
      severityFallback: 64,
      maxDurationSec: analysisDurationSec,
    });
    const boredom = normalizeRangeWindows({
      raw: activeAnalysis?.boredom_ranges || activeAnalysis?.boredomRanges || activeEditPlan?.boredomRanges || [],
      source: "drop",
      reasonFallback: "Predicted boredom/drop-off zone.",
      severityFallback: 70,
      maxDurationSec: analysisDurationSec,
    });
    const fromLargestDrop = retentionBiggestDrop
      ? [{
          id: "largest-drop",
          startSec: retentionBiggestDrop.from.atSec,
          endSec: retentionBiggestDrop.to.atSec,
          severity: clamp(Math.round(retentionBiggestDrop.drop * 5), 30, 99),
          source: "drop" as const,
          reason: `Largest predicted drop (${retentionBiggestDrop.drop.toFixed(1)}%) in retention curve.`,
        } satisfies ExplorerRiskWindow]
      : [];
    return [...fromLargestDrop, ...boredom, ...removed, ...compressed]
      .sort((left, right) => right.severity - left.severity || left.startSec - right.startSec)
      .slice(0, 16);
  }, [activeAnalysis, activeEditPlan, analysisDurationSec, retentionBiggestDrop]);
  const patternInterruptCountValue = Math.max(
    0,
    Math.round(
      firstFiniteNumber(
        activeAnalysis?.pattern_interrupt_count,
        activeAnalysis?.patternInterruptCount,
        activeEditPlan?.patternInterruptCount,
      ) ?? 0,
    ),
  );
  const patternInterruptDensityValue = firstFiniteNumber(
    activeAnalysis?.pattern_interrupt_density,
    activeAnalysis?.patternInterruptDensity,
    activeEditPlan?.patternInterruptDensity,
  );
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
          analysisCursorSafeSec !== null && closestEmotionAtCursor
            ? `At cursor ${formatTimelineClock(analysisCursorSafeSec)}, dominant emotion is ${closestEmotionAtCursor.label} (${closestEmotionAtCursor.intensity}%).`
            : "Click the graph or timeline to inspect exact moments.",
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
          analysisCursorSafeSec !== null
            ? `Cursor is locked at ${formatTimelineClock(analysisCursorSafeSec)} for section-level QA.`
            : "Set a cursor point to inspect section-level QA.",
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
        analysisCursorSafeSec !== null && closestRetentionAtCursor
          ? `At cursor ${formatTimelineClock(analysisCursorSafeSec)}, predicted hold is ${closestRetentionAtCursor.predicted}%.`
          : "Click retention graph to inspect point-by-point hold predictions.",
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
    analysisCursorSafeSec,
    bingeHighlightSegments,
    closestEmotionAtCursor,
    closestRetentionAtCursor,
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

  useEffect(() => {
    setAnalysisCursorSec(null);
    setAnalysisExplorerTab("hooks");
  }, [activeJob?.id]);

  useEffect(() => {
    if (!videoAnalysisOpen) return;
    if (analysisCursorSec !== null) return;
    if (hookExplorerCandidates[0]) {
      setAnalysisCursorSec(hookExplorerCandidates[0].startSec);
      return;
    }
    if (riskExplorerWindows[0]) {
      setAnalysisCursorSec(riskExplorerWindows[0].startSec);
      return;
    }
    if (retentionCurvePoints[0]) {
      setAnalysisCursorSec(retentionCurvePoints[0].atSec);
    }
  }, [videoAnalysisOpen, analysisCursorSec, hookExplorerCandidates, riskExplorerWindows, retentionCurvePoints]);

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

  const pipelineStepHoverDetails: Record<PipelineStepKey, PipelineStepHoverDetail> = (() => {
    const idleDetails: Record<PipelineStepKey, PipelineStepHoverDetail> = {
      queued: {
        title: "Queued",
        summary: "Waiting for processing resources.",
        lines: [
          "Upload a file to start the edit pipeline.",
          "Once queued, AutoEditor starts processing automatically.",
        ],
      },
      uploading: {
        title: "Uploading",
        summary: "Video upload and ingest stage.",
        lines: [
          "Source video is chunk-uploaded to the processing backend.",
          "Analysis starts immediately after upload completes.",
        ],
      },
      analyzing: {
        title: "Analyzing",
        summary: "Scene, transcript, and retention signal analysis.",
        lines: [
          "Frame analysis and signal extraction run in this stage.",
          "Hover here during processing to see scan progress updates.",
        ],
      },
      hooking: {
        title: "Hook",
        summary: "Selecting the strongest opening moment.",
        lines: [
          "The model scores hook candidates and picks the best opener.",
          "Selection favors strong curiosity and payoff pressure.",
        ],
      },
      cutting: {
        title: "Cuts",
        summary: "Removing low-retention sections.",
        lines: [
          "Low-engagement windows are trimmed and timeline ranges updated.",
          "Cut decisions target stronger completion and fewer skips.",
        ],
      },
      pacing: {
        title: "Pacing",
        summary: "Balancing rhythm and interruptions.",
        lines: [
          "Pattern interrupts and pace adjustments are applied here.",
          "The planner protects important context while keeping speed up.",
        ],
      },
      story: {
        title: "Story",
        summary: "Narrative continuity and quality gating.",
        lines: [
          "Story order is validated against retention and coherence checks.",
          "Risk windows are reviewed before final render.",
        ],
      },
      subtitling: {
        title: "Subtitles",
        summary: "Caption timing and styling.",
        lines: [
          "Subtitle generation maps transcript cues to the edited timeline.",
          "Chosen subtitle style is applied before export.",
        ],
      },
      rendering: {
        title: "Rendering",
        summary: "Final export pass.",
        lines: [
          "All selected edits are burned into the final output.",
          "Output file quality and final retention score are finalized.",
        ],
      },
      ready: {
        title: "Ready",
        summary: "Export completed.",
        lines: [
          "Your edited video is ready for review and download.",
          "Open Feedback Deep Dive to inspect retention diagnostics.",
        ],
      },
    };

    if (!activeJob) return idleDetails;

    const pipelineSteps = asRecord(activeAnalysis?.pipelineSteps);
    const readMeta = (stepKeys: string[]) => {
      if (!pipelineSteps) return null;
      for (const stepKey of stepKeys) {
        const state = asRecord(pipelineSteps[stepKey]);
        const meta = asRecord(state?.meta);
        if (meta) return meta;
      }
      return null;
    };

    const hookMeta = readMeta(["HOOK_SELECT_AND_AUDIT", "HOOK_SCORING", "BEST_MOMENT_SCORING"]);
    const cutsMeta = readMeta(["BOREDOM_SCORING", "TIMELINE_REORDER"]);
    const pacingMeta = readMeta(["PACING_AND_INTERRUPTS", "PACING_ENFORCEMENT"]);
    const storyMeta = readMeta(["STORY_QUALITY_GATE", "STORY_REORDER"]);
    const renderMeta = readMeta(["RENDER_FINAL"]);
    const retentionMeta = readMeta(["RETENTION_SCORE"]);

    const selectedHookMeta = asRecord(hookMeta?.selectedHook) ?? asRecord(hookMeta?.hook);
    const selectedHookStart = firstFiniteNumber(
      selectedHookStartSec,
      selectedHookMeta?.start,
      selectedHookMeta?.startSec,
      selectedHookMeta?.hook_start_time,
    );
    const selectedHookEnd = firstFiniteNumber(
      selectedHookEndSec,
      selectedHookMeta?.end,
      selectedHookMeta?.endSec,
      selectedHookStart !== null
        ? firstFiniteNumber(
            selectedHookMeta?.duration !== undefined ? selectedHookStart + Number(selectedHookMeta?.duration) : null,
            selectedHookMeta?.durationSec !== undefined ? selectedHookStart + Number(selectedHookMeta?.durationSec) : null,
          )
        : null,
    );
    const hookRangeLine =
      selectedHookStart !== null
        ? `Selected hook: ${formatTimelineClock(selectedHookStart)}-${
            selectedHookEnd !== null ? formatTimelineClock(selectedHookEnd) : "live"
          }.`
        : "Selecting the strongest opening range now.";
    const hookTopCandidates = Array.isArray(hookMeta?.topCandidates) ? hookMeta.topCandidates.length : 0;
    const hookCandidateCount = Math.max(hookExplorerCandidates.length, hookTopCandidates);
    const hookReasonRaw =
      (typeof hookExplorerCandidates[0]?.reason === "string" && hookExplorerCandidates[0].reason) ||
      (typeof selectedHookMeta?.reason === "string" && selectedHookMeta.reason) ||
      (typeof selectedHookMeta?.hook_reason === "string" && selectedHookMeta.hook_reason) ||
      "";
    const hookReason = hookReasonRaw ? `Current rationale: ${truncateText(hookReasonRaw, 118)}` : null;

    const boredomRangesRaw =
      (Array.isArray(activeEditPlan?.boredomRanges) && activeEditPlan?.boredomRanges) ||
      (Array.isArray(activeEditPlan?.boredom_ranges) && activeEditPlan?.boredom_ranges) ||
      [];
    const removedRangeCount = Math.max(
      boredomRangesRaw.length,
      Array.isArray(cutsMeta?.removedRanges) ? cutsMeta.removedRanges.length : 0,
    );
    const removedSeconds = firstFiniteNumber(cutsMeta?.totalRemovedSeconds, cutsMeta?.total_removed_seconds);

    const storyAttemptCount = Math.max(
      0,
      Math.round(
        firstFiniteNumber(
          storyMeta?.attemptCount,
          storyMeta?.attempt_count,
          Array.isArray(storyMeta?.attempts) ? storyMeta?.attempts.length : null,
        ) ?? 0,
      ),
    );
    const editPlanSegmentCount = Array.isArray(activeEditPlan?.segments) ? activeEditPlan.segments.length : null;
    const storySegmentCount = Math.max(
      0,
      Math.round(firstFiniteNumber(storyMeta?.segmentCount, storyMeta?.segment_count, editPlanSegmentCount) ?? 0),
    );

    const transcriptCuesRaw =
      activeAnalysis?.transcript_cues ||
      activeAnalysis?.transcriptCues ||
      activeAnalysis?.transcript ||
      activeAnalysis?.captions ||
      activeAnalysis?.subtitle_cues;
    const transcriptCueCount = Array.isArray(transcriptCuesRaw) ? transcriptCuesRaw.length : 0;
    const subtitlePresetRaw =
      (typeof activeAnalysis?.subtitleStyle === "string" && activeAnalysis?.subtitleStyle) ||
      (typeof activeAnalysis?.subtitle_style === "string" && activeAnalysis?.subtitle_style) ||
      (typeof activeAnalysis?.verticalCaptionPreset === "string" && activeAnalysis?.verticalCaptionPreset) ||
      (typeof activeAnalysis?.vertical_caption_preset === "string" && activeAnalysis?.vertical_caption_preset) ||
      "";
    const subtitlePreset = subtitlePresetRaw ? formatTokenLabel(subtitlePresetRaw) : null;

    const renderSegmentCount = Math.max(
      0,
      Math.round(
        firstFiniteNumber(
          renderMeta?.segmentCount,
          renderMeta?.segment_count,
          renderMeta?.outputTarget,
          renderMeta?.requestedClipCount,
        ) ?? 0,
      ),
    );
    const projectedRetention = toScore100(
      retentionMeta?.score,
      retentionMeta?.retention_score,
      retentionMeta?.judge && asRecord(retentionMeta.judge)?.retention_score,
      activeJob?.retentionScore,
    );

    const uploadProgressValue = Math.round(clamp(firstFiniteNumber(uploadProgress, activeJob.progress) ?? 0, 0, 100));
    const uploadedMb = formatMegabytes(uploadBytesUploaded);
    const totalMb = formatMegabytes(uploadBytesTotal);
    const targetQualityLabel = normalizeQuality(activeJob.finalQuality || activeJob.requestedQuality || "720p").toUpperCase();
    const queueCreatedLabel = new Date(activeJob.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const pacingDensityLabel =
      patternInterruptDensityValue !== null ? ` (${patternInterruptDensityValue.toFixed(3)}/s density)` : "";
    const pacingSignalRaw =
      (typeof plannerProtectionChanges[0] === "string" && plannerProtectionChanges[0]) ||
      (typeof pacingMeta?.reason === "string" && pacingMeta.reason) ||
      "";

    return {
      queued: {
        title: "Queued",
        summary: "The job is staged and waiting for a processing slot.",
        lines: [
          `Queued at ${queueCreatedLabel}.`,
          `Target export quality: ${targetQualityLabel}.`,
          "Upload and analysis start automatically once resources are available.",
        ],
      },
      uploading: {
        title: "Uploading",
        summary: "Video chunks are streaming into the editor backend.",
        lines: [
          uploadedMb && totalMb
            ? `Uploaded ${uploadedMb} of ${totalMb} (${uploadProgressValue}%).`
            : `Upload progress: ${uploadProgressValue}%.`,
          "Multipart ingest is active to keep large files reliable.",
          "As soon as upload completes, analysis and edit planning begin.",
        ],
      },
      analyzing: {
        title: "Analyzing",
        summary: "Frame, transcript, emotion, and retention signals are being extracted.",
        lines: [
          fullScanProgressLabel,
          estimatedDurationSec !== null
            ? `Detected source runtime: ${formatTimelineClock(estimatedDurationSec)}.`
            : "Detecting runtime and scene boundaries.",
          `Analysis confidence: ${formatScore(analysisConfidenceScore)} / 100 across ${emotionMoments.length} emotion checkpoints.`,
        ],
      },
      hooking: {
        title: "Hook",
        summary: "Choosing the strongest opener to maximize early hold.",
        lines: [
          `Hook candidates scored: ${hookCandidateCount}.`,
          hookRangeLine,
          hookReason || "Scoring curiosity, payoff timing, and audit pass/fail now.",
        ],
      },
      cutting: {
        title: "Cuts",
        summary: "Pruning low-retention sections and rebuilding timeline flow.",
        lines: [
          `Trim windows identified: ${removedRangeCount}.`,
          removedSeconds !== null
            ? `Estimated low-signal footage removed: ${removedSeconds.toFixed(1)}s.`
            : `Risk windows monitored: ${riskExplorerWindows.length}.`,
          `Action planner produced ${actionExplorerItems.length} timeline action items.`,
        ],
      },
      pacing: {
        title: "Pacing",
        summary: "Applying rhythm controls to keep watch-through momentum.",
        lines: [
          `Pattern interrupts active: ${patternInterruptCountValue}${pacingDensityLabel}.`,
          `Planner pacing adjustments: ${plannerPacingAdjustmentCount}.`,
          pacingSignalRaw
            ? `Retention protection: ${truncateText(pacingSignalRaw, 118)}`
            : "Pacing guard is balancing tempo without damaging key context.",
        ],
      },
      story: {
        title: "Story",
        summary: "Story structure and quality gate checks before final output.",
        lines: [
          `Current structured segments: ${storySegmentCount || 0}.`,
          `Story quality gate attempts: ${storyAttemptCount}.`,
          `High-risk narrative windows tracked: ${riskExplorerWindows.length}.`,
        ],
      },
      subtitling: {
        title: "Subtitles",
        summary: "Generating timed captions aligned to the edited timeline.",
        lines: [
          subtitlePreset ? `Subtitle preset: ${subtitlePreset}.` : "Using automatic subtitle styling.",
          transcriptCueCount > 0
            ? `Transcript cues mapped: ${transcriptCueCount}.`
            : "Transcript cue map is still being assembled.",
          "Caption timing is synced before final rendering.",
        ],
      },
      rendering: {
        title: "Rendering",
        summary: "Compositing the final edit and preparing export files.",
        lines: [
          `Render progress: ${Math.round(clamp(toFiniteNumber(activeJob.progress) ?? 0, 0, 100))}%.`,
          renderSegmentCount > 0
            ? `Rendering ${renderSegmentCount} final timeline segments.`
            : "Applying timeline edits, overlays, and final output settings.",
          projectedRetention !== null
            ? `Projected retention score: ${formatScore(projectedRetention)} / 100.`
            : "Final retention score is being confirmed.",
        ],
      },
      ready: {
        title: "Ready",
        summary: "The final cut is exported and available for review.",
        lines: [
          `Retention score: ${formatScore(finalRetentionScore)} / 100 (${retentionDeltaLabel}).`,
          `Export quality: ${targetQualityLabel}.`,
          optimizationHighlights[0]
            ? truncateText(optimizationHighlights[0], 118)
            : "Open Feedback Deep Dive for detailed optimization notes.",
        ],
      },
    };
  })();

  const pipelineHoverStatusLabel = (stepKey: PipelineStepKey, stepIndex: number) => {
    if (!activeJob) return "Idle";
    const normalized = normalizeStatus(activeJob.status);
    const live = !isTerminalStatus(activeJob.status) && activeStepKey === stepKey;
    if (live) return "Live now";
    if (normalized === "failed") {
      if (currentStepIndex !== -1 && stepIndex < currentStepIndex) return "Completed";
      if (activeStepKey === stepKey) return "Failed";
      return "Stopped";
    }
    if (normalized === "ready") return "Completed";
    if (currentStepIndex !== -1 && stepIndex < currentStepIndex) return "Completed";
    return "Pending";
  };

  const pipelineHoverStatusClass = (statusLabel: string, isLive: boolean) => {
    if (isLive || statusLabel === "Live now") {
      return "border-primary/45 bg-primary/15 text-primary";
    }
    if (statusLabel === "Failed" || statusLabel === "Stopped") {
      return "border-destructive/45 bg-destructive/15 text-destructive";
    }
    if (statusLabel === "Completed") {
      return "border-success/40 bg-success/12 text-success";
    }
    return "border-border/65 bg-muted/35 text-muted-foreground";
  };

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
              <Button type="button" variant="outline" onClick={toggleEditorMode} className="rounded-full">
                {isVerticalMode ? "Standard Mode" : "Vertical Mode"}
              </Button>
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
              if (file) {
                if (isVerticalMode) {
                  prepareVerticalFile(file);
                } else {
                  void handleFile(file);
                }
              }
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
                    {job.renderMode === "vertical" && (
                      <p className="text-[10px] text-primary/90 mt-1 inline-flex items-center gap-1">
                        <ScissorsSquare className="w-3 h-3" />
                        Vertical clip job
                      </p>
                    )}
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
                  <p className="font-medium text-foreground">
                    {isVerticalMode ? "Upload a video for vertical clip mode" : "Drop your video here or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isVerticalMode ? "Then customize caption style and create vertical clips." : "MP4 or MKV up to 2GB"}
                  </p>
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

              {isVerticalMode && (
                <div className="glass-card p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Vertical Caption Builder</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create TikTok/Reels/Shorts-style vertical captions with custom font and outline.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[8, 10, 12, 15, 20].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                            verticalClipCount === count
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-primary/40"
                          }`}
                          onClick={() => setVerticalClipCount(count)}
                        >
                          {count} clips
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Caption style</span>
                      <select
                        className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                        value={verticalCaptionPreset}
                        onChange={(event) => applyVerticalCaptionPreset(event.target.value as VerticalCaptionPresetOptionId)}
                      >
                        {VERTICAL_CAPTION_STYLE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id} className="bg-background text-foreground">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Font</span>
                      <select
                        className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                        value={verticalCaptionFontId}
                        onChange={(event) => setVerticalCaptionFontId(event.target.value as VerticalCaptionFontOptionId)}
                      >
                        {VERTICAL_CAPTION_FONT_OPTIONS.map((fontOption) => (
                          <option key={fontOption.id} value={fontOption.id} className="bg-background text-foreground">
                            {fontOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Animation</span>
                      <select
                        className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                        value={verticalCaptionAnimation}
                        onChange={(event) => setVerticalCaptionAnimation(event.target.value as VerticalCaptionAnimationOptionId)}
                      >
                        {VERTICAL_CAPTION_ANIMATION_OPTIONS.map((animationOption) => (
                          <option key={animationOption.id} value={animationOption.id} className="bg-background text-foreground">
                            {animationOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Outline color</span>
                      <input
                        type="color"
                        className="h-9 w-full rounded-lg border border-border/50 bg-muted/20 p-1"
                        value={`#${normalizeCaptionHexColor(
                          verticalCaptionOutlineColor,
                          VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].outlineColor,
                        )}`}
                        onChange={(event) =>
                          setVerticalCaptionOutlineColor(
                            normalizeCaptionHexColor(
                              event.target.value,
                              VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].outlineColor,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-[11px] text-muted-foreground">
                        Outline width ({verticalCaptionOutlineWidth}px)
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        step={1}
                        value={verticalCaptionOutlineWidth}
                        onChange={(event) => setVerticalCaptionOutlineWidth(clamp(Number(event.target.value), 0, 24))}
                        className="w-full accent-primary"
                      />
                      <span className="text-[10px] text-muted-foreground">Set to 0 for no outline.</span>
                    </label>
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-muted-foreground">Custom caption text (optional)</span>
                    <textarea
                      value={verticalCaptionText}
                      onChange={(event) => setVerticalCaptionText(event.target.value)}
                      placeholder={"WTF 😂\nNo way this happened\nRun it back 🔁"}
                      className="min-h-[96px] w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground"
                    />
                  </label>

                  {!verticalPreviewUrl ? (
                    <p className="text-xs text-muted-foreground">Upload a file to prepare a vertical render.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-border/40 bg-black/80">
                        <video src={verticalPreviewUrl} controls className="w-full max-h-[380px] object-contain" />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                          <MousePointerClick className="w-3.5 h-3.5" />
                          Vertical style: {VERTICAL_CAPTION_STYLE_OPTIONS.find((option) => option.id === verticalCaptionPreset)?.label}
                        </p>
                        <Button
                          type="button"
                          className="gap-2"
                          disabled={!pendingVerticalFile || !!uploadingJobId}
                          onClick={startVerticalRender}
                        >
                          <ScissorsSquare className="w-4 h-4" />
                          Create Vertical Clips
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="glass-card overflow-hidden">
                <div
                  className={`${
                    activeJob?.renderMode === "vertical" || isVerticalMode
                      ? "aspect-[9/16] max-w-[360px] mx-auto"
                      : "aspect-video"
                  } bg-muted/30 flex items-center justify-center relative`}
                >
                  {showVideo ? (
                    <video
                      src={activeJob?.outputUrl || ""}
                      controls
                      className={`w-full h-full ${activeJob?.renderMode === "vertical" || isVerticalMode ? "object-contain bg-black" : "object-cover"}`}
                    />
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
                    <p className="pill-badge text-[10px]">Feedback Snapshot</p>
                    <p className="mt-2 text-xs text-muted-foreground">Live status and feedback updates while your job runs</p>
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
                        const live = !isTerminalStatus(activeJob.status) && activeStepKey === step.key;
                        const hoverDetail = pipelineStepHoverDetails[step.key];
                        const hoverStatusLabel = pipelineHoverStatusLabel(step.key, idx);
                        return (
                          <Tooltip key={step.key}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Badge
                                  variant="secondary"
                                  className={`cursor-help border transition-colors ${
                                    active
                                      ? "border-primary/30 text-primary bg-primary/10"
                                      : "border-border/50 text-muted-foreground bg-muted/30"
                                  } ${live ? "pipeline-step-live" : ""}`}
                                >
                                  {step.label}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="pipeline-hover-card w-[18rem] p-3 text-left">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-foreground">{hoverDetail.title}</p>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${pipelineHoverStatusClass(
                                      hoverStatusLabel,
                                      live,
                                    )}`}
                                  >
                                    {hoverStatusLabel}
                                  </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">{hoverDetail.summary}</p>
                                <div className="space-y-1.5">
                                  {hoverDetail.lines.map((line, lineIndex) => (
                                    <p key={`${step.key}-hover-line-${lineIndex}`} className="text-[11px] leading-relaxed text-foreground/90">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {normalizeStatus(activeJob.status) === "failed" && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/80">Hover each stage to see live edit actions as they happen.</p>

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

            <div className="analysis-report-card rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Actionable AI Plan Explorer</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click hooks, risk windows, and actions to inspect exact timeline moments.
                  </p>
                </div>
                <Badge className="border-primary/35 bg-primary/10 text-primary">
                  Confidence {formatScore(analysisConfidenceScore)}%
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  Model: {formatScore(modelConfidenceScore)}%
                </Badge>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  Data coverage: {Math.round(fullScanProgress)}%
                </Badge>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  Pattern interrupts: {patternInterruptCountValue}
                  {patternInterruptDensityValue !== null ? ` (${patternInterruptDensityValue.toFixed(3)}/s)` : ""}
                </Badge>
                <Badge variant="secondary" className="bg-muted/35 text-foreground/90">
                  Planner pacing actions: {plannerPacingAdjustmentCount}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    analysisExplorerTab === "hooks"
                      ? "border-primary/45 bg-primary/12 text-primary"
                      : "border-border/60 bg-background/45 text-foreground/85 hover:border-primary/35"
                  }`}
                  onClick={() => setAnalysisExplorerTab("hooks")}
                >
                  Hooks ({hookExplorerCandidates.length})
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    analysisExplorerTab === "risks"
                      ? "border-primary/45 bg-primary/12 text-primary"
                      : "border-border/60 bg-background/45 text-foreground/85 hover:border-primary/35"
                  }`}
                  onClick={() => setAnalysisExplorerTab("risks")}
                >
                  Drop-off Risks ({riskExplorerWindows.length})
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    analysisExplorerTab === "actions"
                      ? "border-primary/45 bg-primary/12 text-primary"
                      : "border-border/60 bg-background/45 text-foreground/85 hover:border-primary/35"
                  }`}
                  onClick={() => setAnalysisExplorerTab("actions")}
                >
                  Actions ({actionExplorerItems.length})
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {analysisExplorerTab === "hooks" && (
                    <>
                      {hookExplorerCandidates.length === 0 ? (
                        <p className="rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                          Hook candidates are still being compiled from the analysis pipeline.
                        </p>
                      ) : (
                        hookExplorerCandidates.map((candidate, index) => (
                          <button
                            key={candidate.id}
                            type="button"
                            className={`w-full rounded-lg border p-2.5 text-left transition ${
                              analysisCursorSafeSec !== null && Math.abs((analysisCursorSafeSec ?? 0) - candidate.startSec) < 0.2
                                ? "border-primary/45 bg-primary/10"
                                : "border-border/60 bg-background/45 hover:border-primary/35"
                            }`}
                            onClick={() => focusAnalysisAtTime(candidate.startSec, "retention")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-foreground">
                                #{index + 1} {formatTimelineClock(candidate.startSec)}-{formatTimelineClock(candidate.endSec)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {candidate.score !== null ? `${candidate.score.toFixed(1)}%` : "score pending"}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{candidate.reason}</p>
                            {candidate.selected ? (
                              <p className="mt-1 text-[11px] font-medium text-primary">Selected hook</p>
                            ) : null}
                          </button>
                        ))
                      )}
                    </>
                  )}

                  {analysisExplorerTab === "risks" && (
                    <>
                      {riskExplorerWindows.length === 0 ? (
                        <p className="rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                          No high-risk windows detected yet.
                        </p>
                      ) : (
                        riskExplorerWindows.map((window) => (
                          <button
                            key={window.id}
                            type="button"
                            className={`w-full rounded-lg border p-2.5 text-left transition ${
                              analysisCursorSafeSec !== null && Math.abs((analysisCursorSafeSec ?? 0) - window.startSec) < 0.2
                                ? "border-primary/45 bg-primary/10"
                                : "border-border/60 bg-background/45 hover:border-primary/35"
                            }`}
                            onClick={() => focusAnalysisAtTime(window.startSec, "retention")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-foreground">
                                {formatTimelineClock(window.startSec)}-{formatTimelineClock(window.endSec)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                severity {window.severity}%
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{window.reason}</p>
                          </button>
                        ))
                      )}
                    </>
                  )}

                  {analysisExplorerTab === "actions" && (
                    <>
                      {actionExplorerItems.length === 0 ? (
                        <p className="rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                          Action items are pending from planner output.
                        </p>
                      ) : (
                        actionExplorerItems.map((action) => {
                          const hasRange = action.startSec !== null && action.endSec !== null;
                          return (
                            <button
                              key={action.id}
                              type="button"
                              className={`w-full rounded-lg border p-2.5 text-left transition ${
                                hasRange
                                  ? "border-border/60 bg-background/45 hover:border-primary/35"
                                  : "border-border/45 bg-background/25"
                              }`}
                              onClick={() => {
                                if (hasRange) focusAnalysisAtTime(action.startSec as number, "timeline");
                              }}
                              disabled={!hasRange}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium capitalize text-foreground">{action.action}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {hasRange
                                    ? `${formatTimelineClock(action.startSec as number)}-${formatTimelineClock(action.endSec as number)}`
                                    : "global"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{action.reason}</p>
                            </button>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/45 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Cursor Inspector</p>
                  <p className="mt-1 text-xs text-foreground">
                    {analysisCursorSafeSec !== null
                      ? `Pinned at ${formatTimelineClock(analysisCursorSafeSec)}`
                      : "Click any graph or item to pin timeline cursor."}
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="rounded-md border border-border/60 bg-background/40 p-2">
                      <p className="text-[11px] text-muted-foreground">Nearest retention point</p>
                      <p className="text-xs text-foreground">
                        {closestRetentionAtCursor
                          ? `${closestRetentionAtCursor.predicted}% at ${formatTimelineClock(closestRetentionAtCursor.atSec)}`
                          : "Not available"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/40 p-2">
                      <p className="text-[11px] text-muted-foreground">Nearest emotion segment</p>
                      <p className="text-xs text-foreground">
                        {closestEmotionAtCursor
                          ? `${closestEmotionAtCursor.label} (${closestEmotionAtCursor.intensity}%)`
                          : "Not available"}
                      </p>
                    </div>
                  </div>
                </div>
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
                  onClick={(event) => handleFocusGraphClick(event, retentionTimelineDurationSec, "retention")}
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
                    {retentionCursorX !== null ? (
                      <line
                        x1={retentionCursorX}
                        y1="0"
                        x2={retentionCursorX}
                        y2="100"
                        stroke="hsl(var(--foreground) / 0.58)"
                        strokeDasharray="2 2"
                        strokeWidth="1.2"
                      />
                    ) : null}
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
                  <span>
                    {retentionGoalMet ? "On track" : "Below target"}
                    {analysisCursorSafeSec !== null ? ` · Cursor ${formatTimelineClock(analysisCursorSafeSec)}` : " · Click graph for details"}
                  </span>
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
                  onClick={(event) => handleFocusGraphClick(event, emotionTimelineDurationSec, "emotion")}
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
                    {emotionCursorX !== null ? (
                      <line
                        x1={emotionCursorX}
                        y1="0"
                        x2={emotionCursorX}
                        y2="100"
                        stroke="hsl(var(--foreground) / 0.58)"
                        strokeDasharray="2 2"
                        strokeWidth="1.2"
                      />
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
                onClick={(event) => handleFocusGraphClick(event, emotionTimelineDurationSec, "timeline")}
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
                {emotionCursorX !== null ? (
                  <span
                    className="absolute inset-y-0 w-[2px] bg-foreground/80"
                    style={{ left: `${emotionCursorX}%` }}
                  />
                ) : null}
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
