import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Plus, Play, Download, Lock, Loader2, CheckCircle2, ZoomIn, ScissorsSquare, MousePointerClick, XCircle, Menu } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { getAnalyticsSessionId, trackAnalyticsEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import { PLAN_CONFIG, PLAN_TIERS, QUALITY_ORDER, clampQualityForTier, isPaidTier, normalizeQuality, type ExportQuality, type PlanTier } from "@shared/planConfig";
import {
  MRBEAST_ANIMATION_OPTIONS,
  MRBEAST_FONT_OPTIONS,
  parseSubtitleStyleConfig,
  serializeSubtitleStyleConfig,
  type SubtitlePresetId,
  type SubtitleStyleConfig,
} from "@shared/subtitlePresets";

const MB = 1024 * 1024;
const LARGE_UPLOAD_THRESHOLD = 64 * MB;
// Supabase storage removed — use R2 via backend pre-signed multipart URLs only
const ALLOWED_UPLOAD_EXTENSIONS = [".mp4", ".m4v", ".mkv"];
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "video/mp4",
  "application/mp4",
  "video/m4v",
  "video/x-m4v",
  "video/x-matroska",
]);
const FILE_INPUT_ACCEPT = ".mp4,.m4v,.mkv,video/mp4,application/mp4,video/m4v,video/x-m4v,video/x-matroska";
const isAllowedUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return true;
  const normalizedType = String(file.type || "").toLowerCase();
  return normalizedType.length > 0 && ALLOWED_UPLOAD_MIME_TYPES.has(normalizedType);
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DEFAULT_VERTICAL_OUTPUT = { width: 1080, height: 1920 } as const;
const DEFAULT_WEBCAM_TOP_HEIGHT_PCT = 40;
const DEFAULT_WEBCAM_PADDING_PX = 0;
const MIN_WEBCAM_CROP_SIZE_PX = 48;
const RETENTION_FEEDBACK_INTERVAL_MS = 15000;
const WATCH_FEEDBACK_PROGRESS_STEP = 0.08;
const MIN_WATCH_FEEDBACK_PROGRESS = 0.08;

type VerticalFitMode = "cover" | "contain";
type RetentionStrategyProfile = "safe" | "balanced" | "viral";
type RetentionAggressionLevel = "low" | "medium" | "high" | "viral";
type RetentionTargetPlatform = "tiktok" | "instagram_reels" | "youtube";
const STRATEGY_TO_AGGRESSION: Record<RetentionStrategyProfile, RetentionAggressionLevel> = {
  safe: "low",
  balanced: "medium",
  viral: "viral",
};
const RETENTION_PROFILE_OPTIONS: Array<{ value: RetentionStrategyProfile; label: string; description: string }> = [
  {
    value: "safe",
    label: "Safe",
    description: "Context-first pacing with regular cuts, clean flow, and a strong best-moment hook in the first 8 seconds.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Adaptive commentary/lifestyle blend with conversational pacing, strategic zooms, and moderate interrupt density.",
  },
  {
    value: "viral",
    label: "Viral",
    description: "High-stakes challenge and energetic vlog blend with faster cuts, stronger interrupts, and aggressive escalation.",
  },
];
const PLATFORM_OPTIONS: Array<{ value: RetentionTargetPlatform; label: string }> = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram_reels", label: "IG Reels" },
  { value: "youtube", label: "YouTube" },
];
const PLATFORM_HELP_TEXT: Record<RetentionTargetPlatform, string> = {
  tiktok: "Fastest pacing, denser pattern interrupts, and short-form hook pressure.",
  instagram_reels: "Fast pacing with slightly smoother transitions than TikTok.",
  youtube: "Context-first pacing for stronger narrative clarity and lower overcut risk.",
};
const SUBTITLE_PRESET_OPTIONS: Array<{ id: SubtitlePresetId; label: string; description: string }> = [
  { id: "basic_clean", label: "Minimal White", description: "Clean white captions with subtle outline." },
  { id: "bold_pop", label: "Bold Influencer", description: "High-contrast styling that pops on mobile." },
  { id: "mrbeast_animated", label: "High-Energy Animated", description: "High-energy animated captions with punchy styling." },
  { id: "outline_heavy", label: "Cinematic Serif", description: "Film-style serif captions with strong outline." },
  { id: "caption_box", label: "Black Box", description: "Boxed captions for maximum readability." },
  { id: "neon_glow", label: "Neon Glow", description: "Bright glow treatment for stylized edits." },
  { id: "karaoke_highlight", label: "Karaoke Highlight", description: "Word-by-word highlight styling." },
];
type WebcamCrop = { x: number; y: number; w: number; h: number };
type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type CropInteraction = {
  handle: CropHandle;
  startClientX: number;
  startClientY: number;
  startCrop: WebcamCrop;
};
type VerticalLayoutMode = "stacked" | "single";
type VerticalModePayload = {
  enabled: true;
  output: { width: number; height: number };
  source?: { width: number; height: number };
  layout?: VerticalLayoutMode;
  webcamCrop?: WebcamCrop | null;
  webcamPlacement?: { heightPct: number };
  topHeightPx?: number | null;
  bottomFit?: VerticalFitMode;
  webcamFit?: VerticalFitMode;
  paddingPx?: number;
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

type HookCandidate = {
  start: number;
  duration: number;
  score: number;
  auditScore: number;
  auditPassed: boolean;
  text: string;
  reason: string;
  synthetic: boolean;
};

type PreviewPlaybackTelemetry = {
  durationSec: number;
  maxTimeSec: number;
  maxProgress: number;
  watchedSeconds: number;
  rewatchSeconds: number;
  loopCount: number;
  lastTimeSec: number;
  lastDispatchProgress: number;
};
type CreatorFeedbackCategory = "bad_hook" | "too_fast" | "too_generic" | "great_edit";

const CREATOR_FEEDBACK_ACTIONS: Array<{ category: CreatorFeedbackCategory; label: string }> = [
  { category: "bad_hook", label: "Hook weak" },
  { category: "too_fast", label: "Too fast" },
  { category: "too_generic", label: "Generic" },
  { category: "great_edit", label: "Great edit" },
];

const PIPELINE_STEPS = [
  { key: "queued", label: "Queued" },
  { key: "uploading", label: "Uploading" },
  { key: "analyzing", label: "Analyzing" },
  { key: "hooking", label: "Hook" },
  { key: "cutting", label: "Cuts" },
  { key: "pacing", label: "Pacing" },
  { key: "zoom", label: "Zoom-In", comingSoon: true },
  { key: "story", label: "Story" },
  { key: "subtitling", label: "Subtitles" },
  { key: "rendering", label: "Rendering" },
  { key: "ready", label: "Ready" },
] as const;
const REALTIME_HOOK_MUTABLE_STATUSES = new Set([
  "queued",
  "uploading",
  "analyzing",
  "hooking",
  "cutting",
  "pacing",
  "story",
]);

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

const normalizeHookCandidates = (raw: unknown): HookCandidate[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const start = Number((item as any)?.start);
      const duration = Number((item as any)?.duration);
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return null;
      const score = Number((item as any)?.score);
      const auditScore = Number((item as any)?.auditScore);
      return {
        start,
        duration,
        score: Number.isFinite(score) ? score : 0,
        auditScore: Number.isFinite(auditScore) ? auditScore : Number.isFinite(score) ? score : 0,
        auditPassed: Boolean((item as any)?.auditPassed),
        text: typeof (item as any)?.text === "string" ? (item as any).text : "",
        reason: typeof (item as any)?.reason === "string" ? (item as any).reason : "",
        synthetic: Boolean((item as any)?.synthetic),
      } as HookCandidate;
    })
    .filter((candidate): candidate is HookCandidate => Boolean(candidate));
};

const isSameHookCandidate = (left?: HookCandidate | null, right?: HookCandidate | null) => {
  if (!left || !right) return false;
  return Math.abs(left.start - right.start) <= 0.01 && Math.abs(left.duration - right.duration) <= 0.01;
};

const formatNicheLabel = (value?: string | null) => {
  if (!value) return "Unknown";
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatPlatformLabel = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "instagram_reels" || normalized === "instagram" || normalized === "ig" || normalized === "reels") {
    return "IG Reels";
  }
  if (normalized === "tiktok" || normalized === "tt") return "TikTok";
  if (normalized === "youtube" || normalized === "yt") return "YouTube";
  return formatNicheLabel(normalized);
};

const getRequiredPlanForSubtitlePreset = (presetId: SubtitlePresetId): PlanTier => {
  for (const tier of PLAN_TIERS) {
    const allowed = PLAN_CONFIG[tier]?.allowedSubtitlePresets ?? PLAN_CONFIG.free.allowedSubtitlePresets;
    if (allowed === "ALL" || allowed.includes(presetId)) return tier;
  }
  return "studio";
};

const normalizeSubtitleStyleFromSettings = (value: unknown) => {
  if (typeof value !== "string") return "basic_clean";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "basic_clean";
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
  const [qualityByJob, setQualityByJob] = useState<Record<string, ExportQuality>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const pipelineStartRef = useRef<Record<string, number>>({});
  const uploadStartRef = useRef<Record<string, number>>({});
  const jobFileSizeRef = useRef<Record<string, number>>({});
  const statusStartRef = useRef<Record<string, { status: string; startedAt: number; startProgress: number }>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const [etaTick, setEtaTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, signOut } = useAuth();
  const { toast } = useToast();
  const modeParam = searchParams.get("mode");
  const isVerticalMode = modeParam === "vertical";
  const [verticalClipCount, setVerticalClipCount] = useState(2);
  const [pendingVerticalFile, setPendingVerticalFile] = useState<File | null>(null);
  const [verticalPreviewUrl, setVerticalPreviewUrl] = useState<string | null>(null);
  const [skipManualWebcamCrop, setSkipManualWebcamCrop] = useState(false);
  const [onlyHookAndCut, setOnlyHookAndCut] = useState(false);
  const [hideJobsPanel, setHideJobsPanel] = useState(false);
  const [webcamCrop, setWebcamCrop] = useState<WebcamCrop | null>(null);
  const [sourceVideoMeta, setSourceVideoMeta] = useState<{ width: number; height: number } | null>(null);
  const [webcamTopHeightPct, setWebcamTopHeightPct] = useState(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
  const [webcamPaddingPx, setWebcamPaddingPx] = useState(DEFAULT_WEBCAM_PADDING_PX);
  const [bottomFitMode, setBottomFitMode] = useState<VerticalFitMode>("cover");
  const [cropInteraction, setCropInteraction] = useState<CropInteraction | null>(null);
  const [retentionStrategyProfile, setRetentionStrategyProfile] = useState<RetentionStrategyProfile>("balanced");
  const [retentionTargetPlatform, setRetentionTargetPlatform] = useState<RetentionTargetPlatform>(
    isVerticalMode ? "tiktok" : "youtube",
  );
  const [subtitleStyleDraft, setSubtitleStyleDraft] = useState<string>("basic_clean");
  const [subtitleStyleDirty, setSubtitleStyleDirty] = useState(false);
  const [autoCaptionsEnabled, setAutoCaptionsEnabled] = useState(true);
  const [captionsPanelOpen, setCaptionsPanelOpen] = useState(false);
  const [savingSubtitleStyle, setSavingSubtitleStyle] = useState(false);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);
  const [creatorFeedbackSubmitting, setCreatorFeedbackSubmitting] = useState<CreatorFeedbackCategory | null>(null);
  const [applyingHookJobId, setApplyingHookJobId] = useState<string | null>(null);
  const [hookSelectorOpen, setHookSelectorOpen] = useState(false);
  const [editorGuideOpen, setEditorGuideOpen] = useState(false);
  const [hookPromptedByJob, setHookPromptedByJob] = useState<Record<string, boolean>>({});
  const [selectedHookByJob, setSelectedHookByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookPreviewCandidateByJob, setHookPreviewCandidateByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookPreviewUrlByJob, setHookPreviewUrlByJob] = useState<Record<string, string>>({});
  const [hookPreviewErrorByJob, setHookPreviewErrorByJob] = useState<Record<string, string>>({});
  const [hookPreviewLoadingJobId, setHookPreviewLoadingJobId] = useState<string | null>(null);
  const sourcePreviewRef = useRef<HTMLDivElement | null>(null);
  const verticalSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hookPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackTelemetryRef = useRef<Record<string, PreviewPlaybackTelemetry>>({});
  const retentionFeedbackDispatchRef = useRef<Record<string, { at: number; signature: string }>>({});
  const retentionFeedbackInFlightRef = useRef<Record<string, boolean>>({});
  const downloadFeedbackSentRef = useRef<Record<string, boolean>>({});
  const pageViewTrackedRef = useRef(false);
  const analyticsSessionId = useMemo(() => getAnalyticsSessionId(), []);

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  const { data: me, refetch: refetchMe } = useMe({ refetchInterval: hasActiveJobs ? 2500 : false });
  const [entitlements, setEntitlements] = useState<{ autoDownloadAllowed?: boolean } | null>(null);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean | null>(null);
  const [autoDownloadModal, setAutoDownloadModal] = useState<{ open: boolean; url?: string; fileName?: string; jobId?: string }>({ open: false });
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [trialUpgradeOpen, setTrialUpgradeOpen] = useState(false);
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const paidTier = isPaidTier(tier);
  const trialInfo = me?.subscription?.trial;
  const trialActive = Boolean(trialInfo?.active);
  const trialDaysRemaining = Number(trialInfo?.daysRemaining ?? 0);
  const trialUnlockTierRaw = trialInfo?.trialTier as PlanTier | undefined;
  const trialUnlockTier: PlanTier =
    trialUnlockTierRaw && PLAN_CONFIG[trialUnlockTierRaw] ? trialUnlockTierRaw : tier;
  const trialUnlockedFeatures = (PLAN_CONFIG[trialUnlockTier] ?? PLAN_CONFIG[tier]).features;
  const trialEndsAtMs = trialInfo?.endsAt ? new Date(trialInfo.endsAt).getTime() : null;
  const trialEndsAtLabel =
    trialEndsAtMs !== null && Number.isFinite(trialEndsAtMs)
      ? new Date(trialEndsAtMs).toLocaleString()
      : null;
  const hasTrialHistory = Boolean(trialInfo?.trialTier || trialInfo?.startedAt || trialInfo?.endsAt);
  const trialEnded = Boolean(
    hasTrialHistory &&
    !trialActive &&
    trialEndsAtMs !== null &&
    Number.isFinite(trialEndsAtMs) &&
    trialEndsAtMs <= Date.now() &&
    tier === "free",
  );
  const trialUpgradePromptKey =
    me?.user?.id && trialInfo?.endsAt
      ? `trial_upgrade_prompt_dismissed_${me.user.id}_${trialInfo.endsAt}`
      : null;
  const subscriptionCardHideKey = me?.user?.id ? `editor_subscription_card_hidden_${me.user.id}` : null;
  const [hideSubscriptionCard, setHideSubscriptionCard] = useState(false);
  const maxQuality = (PLAN_CONFIG[tier] ?? PLAN_CONFIG.free).exportQuality;
  const subtitleFeatureTier: PlanTier = trialActive ? trialUnlockTier : tier;
  const allowedSubtitlePresets = (PLAN_CONFIG[subtitleFeatureTier] ?? PLAN_CONFIG.free).allowedSubtitlePresets;
  const subtitlesEnabled = allowedSubtitlePresets === "ALL" || allowedSubtitlePresets.length > 0;
  const isSubtitlePresetAllowed = useCallback(
    (presetId: SubtitlePresetId) => {
      if (!subtitlesEnabled) return false;
      return allowedSubtitlePresets === "ALL" || allowedSubtitlePresets.includes(presetId);
    },
    [allowedSubtitlePresets, subtitlesEnabled],
  );
  const subtitleStyleConfig = useMemo(() => parseSubtitleStyleConfig(subtitleStyleDraft), [subtitleStyleDraft]);
  const activeSubtitlePreset = subtitleStyleConfig.preset;
  const activeRetentionProfileMeta = useMemo(
    () =>
      RETENTION_PROFILE_OPTIONS.find((profile) => profile.value === retentionStrategyProfile) ??
      RETENTION_PROFILE_OPTIONS[1],
    [retentionStrategyProfile],
  );
  const activeSubtitlePresetMeta = useMemo(
    () => SUBTITLE_PRESET_OPTIONS.find((preset) => preset.id === activeSubtitlePreset) ?? null,
    [activeSubtitlePreset],
  );
  const tierLabel = tier === "free" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const isDevAccount = Boolean(me?.flags?.dev);
  const rendersUsed = me?.usage?.rendersUsed ?? 0;
  const maxRendersPerMonth = me?.limits?.maxRendersPerMonth ?? null;
  const rendersRemaining = useMemo(() => {
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return null;
    return Math.max(0, maxRendersPerMonth - rendersUsed);
  }, [maxRendersPerMonth, rendersUsed]);
  const hasReachedRenderLimitForMode = useCallback((_mode: "horizontal" | "vertical") => {
    if (isDevAccount) return false;
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return false;
    return (rendersRemaining ?? 0) <= 0;
  }, [
    isDevAccount,
    maxRendersPerMonth,
    rendersRemaining
  ]);
  const trackEditorEvent = useCallback(
    (
      eventName: string,
      options: {
        category?: "interaction" | "page_view" | "feedback" | "system";
        jobId?: string;
        retentionProfile?: string;
        targetPlatform?: string;
        captionStyle?: string;
        metadata?: Record<string, unknown>;
      } = {},
    ) => {
      if (!accessToken) return;
      void trackAnalyticsEvent(
        {
          eventName,
          category: options.category ?? "interaction",
          pagePath: "/editor",
          sessionId: analyticsSessionId,
          jobId: options.jobId,
          retentionProfile: options.retentionProfile,
          targetPlatform: options.targetPlatform,
          captionStyle: options.captionStyle,
          metadata: options.metadata,
        },
        accessToken,
      );
    },
    [accessToken, analyticsSessionId],
  );

  const selectSubtitlePreset = useCallback(
    (presetId: SubtitlePresetId) => {
      if (!isSubtitlePresetAllowed(presetId)) {
        const requiredPlan = getRequiredPlanForSubtitlePreset(presetId);
        toast({
          title: "Upgrade required",
          description: `${PLAN_CONFIG[requiredPlan]?.name || formatNicheLabel(requiredPlan)} plan required for this caption style.`,
        });
        return;
      }
      const nextValue =
        presetId === "mrbeast_animated"
          ? serializeSubtitleStyleConfig({
              ...subtitleStyleConfig,
              preset: "mrbeast_animated",
            })
          : presetId;
      setSubtitleStyleDraft(nextValue);
      setSubtitleStyleDirty(true);
      setAutoCaptionsEnabled(true);
      trackEditorEvent("subtitle_preset_selected", {
        retentionProfile: retentionStrategyProfile,
        targetPlatform: retentionTargetPlatform,
        captionStyle: presetId,
        metadata: {
          subtitlePreset: presetId,
          isAnimated: presetId === "mrbeast_animated",
        },
      });
    },
    [isSubtitlePresetAllowed, subtitleStyleConfig, toast, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform],
  );

  const updateMrBeastSubtitleStyle = useCallback(
    (updates: Partial<SubtitleStyleConfig>) => {
      const nextSerialized = serializeSubtitleStyleConfig({
        ...subtitleStyleConfig,
        preset: "mrbeast_animated",
        ...updates,
      });
      setSubtitleStyleDraft(nextSerialized);
      setSubtitleStyleDirty(true);
    },
    [subtitleStyleConfig],
  );

  const saveSubtitleStyle = useCallback(async () => {
    if (!accessToken) return;
    const nextStyle = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    try {
      setSavingSubtitleStyle(true);
      const result = await apiFetch<{ settings?: { subtitleStyle?: string; autoCaptions?: boolean } }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ subtitleStyle: nextStyle, autoCaptions: autoCaptionsEnabled }),
        token: accessToken,
      });
      const persisted = normalizeSubtitleStyleFromSettings(result?.settings?.subtitleStyle ?? nextStyle);
      const persistedAutoCaptions =
        typeof result?.settings?.autoCaptions === "boolean"
          ? result.settings.autoCaptions
          : autoCaptionsEnabled;
      setSubtitleStyleDraft(persisted);
      setAutoCaptionsEnabled(persistedAutoCaptions);
      setSubtitleStyleDirty(false);
      setCaptionsPanelOpen(false);
      trackEditorEvent("subtitle_preferences_saved", {
        captionStyle: persisted,
        retentionProfile: retentionStrategyProfile,
        targetPlatform: retentionTargetPlatform,
        metadata: {
          autoCaptionsEnabled: persistedAutoCaptions,
        },
      });
      toast({
        title: "Captions updated",
        description: persistedAutoCaptions
          ? "Caption style saved and captions are enabled for new renders."
          : "Caption style saved and captions are disabled for new renders.",
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "PLAN_LIMIT_EXCEEDED") {
        toast({
          title: "Upgrade required",
          description: err?.message || "Your plan cannot use this caption style.",
        });
        return;
      }
      toast({
        title: "Save failed",
        description: err?.message || "Unable to save caption style right now.",
      });
    } finally {
      setSavingSubtitleStyle(false);
    }
  }, [accessToken, autoCaptionsEnabled, subtitleStyleDraft, toast, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform]);

  const dismissTrialUpgradePrompt = useCallback(() => {
    if (trialUpgradePromptKey) {
      try {
        window.localStorage.setItem(trialUpgradePromptKey, String(Date.now()));
      } catch (error) {
        // ignore storage failures
      }
    }
    setTrialUpgradeOpen(false);
  }, [trialUpgradePromptKey]);

  const handleUpgradeFromTrialPrompt = useCallback(() => {
    dismissTrialUpgradePrompt();
    navigate("/pricing");
  }, [dismissTrialUpgradePrompt, navigate]);

  const handleHideSubscriptionCard = useCallback(() => {
    if (subscriptionCardHideKey) {
      try {
        window.localStorage.setItem(subscriptionCardHideKey, "true");
      } catch (error) {
        // ignore storage failures
      }
    }
    setHideSubscriptionCard(true);
  }, [subscriptionCardHideKey]);

  const handleShowSubscriptionCard = useCallback(() => {
    if (subscriptionCardHideKey) {
      try {
        window.localStorage.removeItem(subscriptionCardHideKey);
      } catch (error) {
        // ignore storage failures
      }
    }
    setHideSubscriptionCard(false);
  }, [subscriptionCardHideKey]);

  useEffect(() => {
    if (!trialEnded || !trialUpgradePromptKey) {
      setTrialUpgradeOpen(false);
      return;
    }
    try {
      const dismissed = window.localStorage.getItem(trialUpgradePromptKey);
      if (dismissed) return;
    } catch (error) {
      // ignore storage failures
    }
    setTrialUpgradeOpen(true);
  }, [trialEnded, trialUpgradePromptKey]);

  useEffect(() => {
    if (!subscriptionCardHideKey) {
      setHideSubscriptionCard(false);
      return;
    }
    try {
      setHideSubscriptionCard(window.localStorage.getItem(subscriptionCardHideKey) === "true");
    } catch (error) {
      setHideSubscriptionCard(false);
    }
  }, [subscriptionCardHideKey]);

  const [authError, setAuthError] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }
    try {
      const data = await apiFetch<{ jobs?: JobSummary[] }>("/api/jobs", { token: accessToken });
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
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
        setActiveJob(data.job);
        setJobs((prev) => {
          const index = prev.findIndex((job) => job.id === jobId);
          if (index === -1) return [data.job, ...prev];
          const next = [...prev];
          next[index] = { ...next[index], ...data.job };
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

  const getHookWindowSeconds = useCallback((job?: JobDetail | null) => {
    const analysis = (job?.analysis ?? {}) as any;
    const hookStart = Number(analysis?.hook_start_time ?? analysis?.hook?.start ?? NaN);
    const hookEnd = Number(
      analysis?.hook_end_time ??
      (Number.isFinite(hookStart) ? hookStart + Number(analysis?.hook?.duration ?? 0) : NaN),
    );
    if (Number.isFinite(hookStart) && Number.isFinite(hookEnd) && hookEnd > hookStart) {
      return clamp(hookEnd - hookStart, 4, 8);
    }
    return 8;
  }, []);

  const ensurePlaybackTelemetry = useCallback((jobId: string, durationSec: number, lastTimeSec = 0) => {
    const existing = playbackTelemetryRef.current[jobId];
    if (existing) {
      existing.durationSec = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : existing.durationSec;
      if (Number.isFinite(lastTimeSec)) {
        existing.lastTimeSec = clamp(lastTimeSec, 0, Math.max(lastTimeSec, existing.durationSec || lastTimeSec));
      }
      return existing;
    }
    const next: PreviewPlaybackTelemetry = {
      durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
      maxTimeSec: 0,
      maxProgress: 0,
      watchedSeconds: 0,
      rewatchSeconds: 0,
      loopCount: 0,
      lastTimeSec: Number.isFinite(lastTimeSec) ? Math.max(0, lastTimeSec) : 0,
      lastDispatchProgress: 0,
    };
    playbackTelemetryRef.current[jobId] = next;
    return next;
  }, []);

  const postRetentionFeedback = useCallback(
    async (
      jobId: string,
      payload: Record<string, unknown>,
      options?: { force?: boolean },
    ) => {
      if (!accessToken || !jobId) return;
      const compactPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== ""),
      ) as Record<string, unknown>;
      const hasSignal = ["watchPercent", "hookHoldPercent", "completionPercent", "rewatchRate", "manualScore"].some(
        (key) => typeof compactPayload[key] === "number",
      );
      if (!hasSignal) return;

      const now = Date.now();
      const signature = JSON.stringify(
        Object.entries(compactPayload).sort(([a], [b]) => a.localeCompare(b)),
      );
      const previous = retentionFeedbackDispatchRef.current[jobId];
      const force = Boolean(options?.force);
      if (!force && previous && now - previous.at < RETENTION_FEEDBACK_INTERVAL_MS) return;
      if (!force && previous && previous.signature === signature && now - previous.at < RETENTION_FEEDBACK_INTERVAL_MS * 4) return;
      if (retentionFeedbackInFlightRef.current[jobId]) return;

      retentionFeedbackInFlightRef.current[jobId] = true;
      try {
        await apiFetch(`/api/jobs/${jobId}/retention-feedback`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(compactPayload),
        });
        trackEditorEvent("retention_feedback_submitted", {
          category: "feedback",
          jobId,
          retentionProfile: retentionStrategyProfile,
          targetPlatform: retentionTargetPlatform,
          captionStyle: activeSubtitlePreset,
          metadata: {
            source: String(compactPayload.source ?? "frontend_retention"),
            hasManualScore: typeof compactPayload.manualScore === "number",
          },
        });
        retentionFeedbackDispatchRef.current[jobId] = { at: now, signature };
      } catch (error) {
        // Non-blocking telemetry path.
        console.warn("retention-feedback submit failed", error);
      } finally {
        retentionFeedbackInFlightRef.current[jobId] = false;
      }
    },
    [accessToken, activeSubtitlePreset, retentionStrategyProfile, retentionTargetPlatform, trackEditorEvent],
  );

  const buildFeedbackPayloadFromTelemetry = useCallback(
    (
      job: JobDetail,
      telemetry: PreviewPlaybackTelemetry | null,
      source: string,
      note?: string,
    ) => {
      const payload: Record<string, unknown> = { source };
      if (note) payload.notes = note;
      if (!telemetry || !Number.isFinite(telemetry.durationSec) || telemetry.durationSec <= 0) {
        return payload;
      }
      const durationSec = Math.max(0.1, telemetry.durationSec);
      const maxTimeSec = clamp(telemetry.maxTimeSec, 0, durationSec);
      const maxProgress = clamp01(maxTimeSec / durationSec);
      const hookWindowSeconds = getHookWindowSeconds(job);
      const hookHoldPercent = clamp01(maxTimeSec / Math.max(1, hookWindowSeconds));
      const overwatchSeconds = Math.max(0, telemetry.watchedSeconds - durationSec);
      const rewatchRate = clamp01(
        overwatchSeconds / durationSec +
        (telemetry.rewatchSeconds / durationSec) * 0.5 +
        telemetry.loopCount * 0.08,
      );

      payload.watchPercent = Number(maxProgress.toFixed(4));
      payload.hookHoldPercent = Number(hookHoldPercent.toFixed(4));
      payload.completionPercent = Number(maxProgress.toFixed(4));
      payload.rewatchRate = Number(rewatchRate.toFixed(4));
      return payload;
    },
    [getHookWindowSeconds],
  );

  const submitPreviewFeedback = useCallback(
    (job: JobDetail | null, telemetry: PreviewPlaybackTelemetry, trigger: string, force = false) => {
      if (!job) return;
      if (!force && telemetry.maxProgress < MIN_WATCH_FEEDBACK_PROGRESS) return;
      const payload = buildFeedbackPayloadFromTelemetry(job, telemetry, "frontend_preview", `trigger:${trigger}`);
      void postRetentionFeedback(job.id, payload, { force });
    },
    [buildFeedbackPayloadFromTelemetry, postRetentionFeedback],
  );

  const submitDownloadFeedback = useCallback(
    (job: JobDetail | null, clipIndex: number, source: string) => {
      if (!job) return;
      const key = `${job.id}:${clipIndex + 1}`;
      if (downloadFeedbackSentRef.current[key]) return;
      const telemetry = playbackTelemetryRef.current[job.id] ?? null;
      const payload = buildFeedbackPayloadFromTelemetry(
        job,
        telemetry,
        source,
        `download_clip:${clipIndex + 1}`,
      ) as Record<string, unknown>;
      if (typeof payload.manualScore !== "number") {
        payload.manualScore = 78;
      }
      downloadFeedbackSentRef.current[key] = true;
      void postRetentionFeedback(job.id, payload, { force: true });
    },
    [buildFeedbackPayloadFromTelemetry, postRetentionFeedback],
  );

  const submitCreatorFeedback = useCallback(
    async (category: CreatorFeedbackCategory) => {
      if (!activeJob?.id || !accessToken) return;
      if (!paidTier) {
        toast({
          title: "Paid feature",
          description: "Creator correction feedback is available on paid plans.",
        });
        return;
      }
      setCreatorFeedbackSubmitting(category);
      try {
        await apiFetch(`/api/jobs/${activeJob.id}/creator-feedback`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            category,
            source: "frontend_creator",
          }),
        });
        trackEditorEvent("creator_feedback_submitted", {
          category: "feedback",
          jobId: activeJob.id,
          retentionProfile: retentionStrategyProfile,
          targetPlatform: retentionTargetPlatform,
          captionStyle: activeSubtitlePreset,
          metadata: { category },
        });
        await fetchJob(activeJob.id);
        toast({
          title: "Feedback saved",
          description: "We’ll use this to calibrate future edits.",
        });
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 403) {
          toast({
            title: "Upgrade required",
            description: "This correction control is for paid plans.",
          });
        } else {
          toast({
            title: "Feedback failed",
            description: err?.message || "Please try again.",
          });
        }
      } finally {
        setCreatorFeedbackSubmitting(null);
      }
    },
    [accessToken, activeJob?.id, activeSubtitlePreset, fetchJob, paidTier, toast, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform],
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
    if (!accessToken) pageViewTrackedRef.current = false;
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    if (pageViewTrackedRef.current) return;
    trackEditorEvent("editor_page_view", {
      category: "page_view",
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        mode: isVerticalMode ? "vertical" : "horizontal",
      },
    });
    pageViewTrackedRef.current = true;
  }, [accessToken, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform, activeSubtitlePreset, isVerticalMode]);

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
      .then((d) => {
        setAutoDownloadEnabled(Boolean(d?.settings?.autoDownload));
        setAutoCaptionsEnabled(Boolean(d?.settings?.autoCaptions));
        const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(d?.settings?.subtitleStyle);
        setSubtitleStyleDraft(resolvedSubtitleStyle);
        setSubtitleStyleDirty(false);
      })
      .catch(async (err) => {
        setAutoDownloadEnabled(null);
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try { await signOut() } catch (e) {}
        }
      });
  }, [accessToken, signOut]);

  useEffect(() => {
    const timer = setInterval(() => setEtaTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeJob) return;
    const id = activeJob.id;
    const normalized = normalizeStatus(activeJob.status);
    const prev = statusStartRef.current[id];
    const progress =
      typeof activeJob.progress === "number" && Number.isFinite(activeJob.progress)
        ? clamp(activeJob.progress, 0, 100)
        : 0;
    if (!prev || prev.status !== normalized) {
      statusStartRef.current[id] = { status: normalized, startedAt: Date.now(), startProgress: progress };
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
  }, [selectedJobId, accessToken, authError, fetchJob]);

  useEffect(() => {
    setHookSelectorOpen(false);
  }, [activeJob?.id]);

  useEffect(() => {
    if (!accessToken || !hasActiveJobs || authError) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [accessToken, hasActiveJobs, fetchJobs, authError]);

  useEffect(() => {
    if (!accessToken || authError || !activeJob || !selectedJobId) return;
    if (isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => {
      fetchJob(selectedJobId);
    }, 2500);
    return () => clearInterval(timer);
  }, [accessToken, authError, activeJob, selectedJobId, fetchJob]);

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
                setAutoCaptionsEnabled(Boolean(s?.settings?.autoCaptions));
                const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(s?.settings?.subtitleStyle);
                setSubtitleStyleDraft(resolvedSubtitleStyle);
                setSubtitleStyleDirty(false);
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
              const telemetryJob: JobDetail = {
                ...(j as any),
                id,
                status: "ready",
                analysis: (j as any)?.analysis ?? null,
              };
              submitDownloadFeedback(telemetryJob, 0, "frontend_auto_download");
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
  }, [jobs, refetchMe, entitlements, autoDownloadEnabled, accessToken, submitDownloadFeedback]);

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
      if (!activeJob) return;
      const telemetry = playbackTelemetryRef.current[activeJob.id];
      if (!telemetry) return;
      submitPreviewFeedback(activeJob, telemetry, "job-change", false);
    };
  }, [activeJob?.id, submitPreviewFeedback]);

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

  const handleFile = async (
    file: File,
    renderOptions?: {
      mode?: "horizontal" | "vertical";
      verticalClipCount?: number;
      verticalMode?: VerticalModePayload | null;
    },
  ) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4, M4V, or MKV file." });
      return false;
    }
    if (!accessToken) return false;
    const requestedMode = renderOptions?.mode === "vertical" ? "vertical" : "horizontal";
    const effectiveRetentionStrategyProfile: RetentionStrategyProfile =
      requestedMode === "vertical"
        ? "viral"
        : retentionStrategyProfile === "viral"
          ? "balanced"
          : retentionStrategyProfile;
    const effectiveRetentionAggressionLevel = STRATEGY_TO_AGGRESSION[effectiveRetentionStrategyProfile];
    const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
    const subtitlesPayload = {
      enabled: autoCaptionsEnabled,
      preset: subtitlePresetForJob,
      style: subtitleStyleForJob,
    };
    if (hasReachedRenderLimitForMode(requestedMode)) {
      const detail = tier === "free"
        ? `Free plan includes ${maxRendersPerMonth ?? 10} renders per month.`
        : `You've used all ${maxRendersPerMonth} renders for this month.`;
      toast({
        title: "Render limit reached",
        description: detail,
      });
      return false;
    }
    setUploadProgress(0);
    try {
      const createPayload =
        requestedMode === "vertical"
          ? {
              filename: file.name,
              contentType: file.type,
              renderMode: "vertical" as const,
              retentionAggressionLevel: effectiveRetentionAggressionLevel,
              retentionStrategyProfile: effectiveRetentionStrategyProfile,
              retentionTargetPlatform,
              platformProfile: retentionTargetPlatform,
              onlyHookAndCut,
              autoCaptions: autoCaptionsEnabled,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              verticalClipCount: renderOptions?.verticalClipCount,
              verticalMode: renderOptions?.verticalMode ?? null,
            }
          : {
              filename: file.name,
              contentType: file.type,
              renderMode: "horizontal" as const,
              retentionAggressionLevel: effectiveRetentionAggressionLevel,
              retentionStrategyProfile: effectiveRetentionStrategyProfile,
              retentionTargetPlatform,
              platformProfile: retentionTargetPlatform,
              onlyHookAndCut,
              autoCaptions: autoCaptionsEnabled,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              horizontalMode: {
                output: "quality" as const,
                fit: "contain" as const,
              },
            };
      const create = await apiFetch<{ job: JobDetail; uploadUrl?: string | null; inputPath: string; bucket: string }>(
        "/api/jobs/create",
        {
          method: "POST",
          body: JSON.stringify(createPayload),
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
          if (!uploadId || !key || !Array.isArray(presignedParts) || presignedParts.length === 0) throw new Error('invalid_r2_create')

          const total = file.size
          const actualPartSize = partSize || 10 * MB
          const parts: { ETag: string; PartNumber: number }[] = []
          let uploaded = 0
          jobFileSizeRef.current[create.job.id] = total
          uploadStartRef.current[create.job.id] = Date.now()

          // presignedParts should be ordered by partNumber; iterate and upload corresponding slices
          for (const p of presignedParts) {
            const partNumber = p.partNumber
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
            const maybe = err as any
            if (maybe?.uploadId && maybe?.key) {
              await apiFetch('/api/uploads/abort', { method: 'POST', body: JSON.stringify({ key: maybe.key, uploadId: maybe.uploadId }), token: accessToken })
            }
          } catch (e) {}
          return false
        }
      }

      // Try R2 multipart only when backend indicates direct object upload support.
      if (create.uploadUrl) {
        const usedR2 = await tryR2Multipart()
        if (usedR2) return true
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
        if (!proxyResp.ok) throw new Error('Proxy upload failed')
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
          return true
        }

        // Notify backend of completion for single-PUT flow
        await apiFetch(`/api/jobs/${create.job.id}/complete-upload`, {
          method: 'POST',
          body: JSON.stringify({
            key: create.inputPath,
            onlyHookAndCut,
            retentionAggressionLevel: effectiveRetentionAggressionLevel,
            retentionStrategyProfile: effectiveRetentionStrategyProfile,
            retentionTargetPlatform,
            platformProfile: retentionTargetPlatform,
            autoCaptions: autoCaptionsEnabled,
            subtitleStyle: subtitleStyleForJob,
            subtitles: subtitlesPayload,
          }),
          token: accessToken,
        })

        toast({ title: 'Upload complete', description: 'Your job is now processing.' })
        setUploadingJobId(null)
        setUploadProgress(0)
        setUploadBytesUploaded(null)
        setUploadBytesTotal(null)
        fetchJobs()
        return true
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
      return true
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
      } else if (err instanceof ApiError && err.code === "VERTICAL_RENDER_LIMIT_REACHED") {
        const used = Number(err.data?.verticalRendersUsed ?? 1);
        const month = err.data?.month ? ` in ${err.data.month}` : "";
        toast({
          title: "Vertical render limit reached",
          description: `You already used ${used} free vertical render${used === 1 ? "" : "s"}${month}.`,
        });
      } else {
        toast({ title: "Upload failed", description: err?.message || "Please try again." });
      }
      setUploadingJobId(null);
      setUploadProgress(0);
      setUploadBytesUploaded(null);
      setUploadBytesTotal(null);
      return false;
    }
  };

  useEffect(() => {
    return () => {
      if (verticalPreviewUrl) URL.revokeObjectURL(verticalPreviewUrl);
    };
  }, [verticalPreviewUrl]);

  useEffect(() => {
    if (isVerticalMode) return;
    setSkipManualWebcamCrop(false);
    setPendingVerticalFile(null);
    setWebcamCrop(null);
    setSourceVideoMeta(null);
    setWebcamTopHeightPct(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
    setBottomFitMode("cover");
    setCropInteraction(null);
    setVerticalClipCount(2);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isVerticalMode]);

  useEffect(() => {
    if (isVerticalMode) {
      if (retentionStrategyProfile !== "viral") {
        setRetentionStrategyProfile("viral");
      }
      return;
    }
    if (retentionStrategyProfile === "viral") {
      setRetentionStrategyProfile("balanced");
    }
  }, [isVerticalMode, retentionStrategyProfile]);

  const buildDefaultWebcamCrop = useCallback((sourceWidth: number, sourceHeight: number): WebcamCrop => {
    const y = Math.round(sourceHeight * 0.05);
    const h = Math.round(sourceHeight * 0.4);
    return {
      x: 0,
      y,
      w: sourceWidth,
      h: clamp(h, MIN_WEBCAM_CROP_SIZE_PX, sourceHeight - y),
    };
  }, []);

  const normalizeWebcamCrop = useCallback((value: WebcamCrop, source: { width: number; height: number }): WebcamCrop => {
    const minSize = Math.min(
      Math.max(MIN_WEBCAM_CROP_SIZE_PX, Math.round(Math.min(source.width, source.height) * 0.03)),
      Math.min(source.width, source.height),
    );
    let x = Number.isFinite(value.x) ? value.x : 0;
    let y = Number.isFinite(value.y) ? value.y : 0;
    let w = Number.isFinite(value.w) ? value.w : minSize;
    let h = Number.isFinite(value.h) ? value.h : minSize;
    if (w < 0) {
      x += w;
      w = Math.abs(w);
    }
    if (h < 0) {
      y += h;
      h = Math.abs(h);
    }
    x = clamp(x, 0, source.width - minSize);
    y = clamp(y, 0, source.height - minSize);
    w = clamp(w, minSize, source.width - x);
    h = clamp(h, minSize, source.height - y);
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    };
  }, []);

  const setRenderMode = useCallback((mode: "horizontal" | "vertical") => {
    const next = new URLSearchParams(searchParams);
    if (mode === "vertical") next.set("mode", "vertical");
    else next.delete("mode");
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const prepareVerticalFile = (file: File) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4, M4V, or MKV file." });
      return;
    }
    setPendingVerticalFile(file);
    setWebcamCrop(null);
    setSourceVideoMeta(null);
    setWebcamTopHeightPct(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
    setBottomFitMode("cover");
    setCropInteraction(null);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleVerticalSourceMetadata = useCallback(() => {
    const video = verticalSourceVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const nextSource = { width: video.videoWidth, height: video.videoHeight };
    setSourceVideoMeta(nextSource);
    setWebcamCrop((prev) => {
      if (prev) return normalizeWebcamCrop(prev, nextSource);
      return buildDefaultWebcamCrop(nextSource.width, nextSource.height);
    });
  }, [buildDefaultWebcamCrop, normalizeWebcamCrop]);

  const beginCropInteraction = useCallback((handle: CropHandle, event: React.PointerEvent<HTMLElement>) => {
    if (!webcamCrop) return;
    event.preventDefault();
    event.stopPropagation();
    setCropInteraction({
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: webcamCrop,
    });
  }, [webcamCrop]);

  useEffect(() => {
    if (!cropInteraction || !sourceVideoMeta) return;
    const onMove = (event: PointerEvent) => {
      const previewRect = sourcePreviewRef.current?.getBoundingClientRect();
      if (!previewRect || !previewRect.width || !previewRect.height) return;
      const pxPerClientX = sourceVideoMeta.width / previewRect.width;
      const pxPerClientY = sourceVideoMeta.height / previewRect.height;
      const dx = (event.clientX - cropInteraction.startClientX) * pxPerClientX;
      const dy = (event.clientY - cropInteraction.startClientY) * pxPerClientY;
      const next = { ...cropInteraction.startCrop };
      const includeNorth = cropInteraction.handle.includes("n");
      const includeSouth = cropInteraction.handle.includes("s");
      const includeEast = cropInteraction.handle.includes("e");
      const includeWest = cropInteraction.handle.includes("w");
      if (cropInteraction.handle === "move") {
        next.x += dx;
        next.y += dy;
      } else {
        if (includeWest) {
          next.x += dx;
          next.w -= dx;
        }
        if (includeEast) {
          next.w += dx;
        }
        if (includeNorth) {
          next.y += dy;
          next.h -= dy;
        }
        if (includeSouth) {
          next.h += dy;
        }
      }
      setWebcamCrop(normalizeWebcamCrop(next, sourceVideoMeta));
    };
    const onEnd = () => setCropInteraction(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [cropInteraction, sourceVideoMeta, normalizeWebcamCrop]);

  const webcamPaddingMax = useMemo(() => {
    if (!webcamCrop) return 0;
    return Math.max(0, Math.floor(Math.min(webcamCrop.w, webcamCrop.h) / 2) - 1);
  }, [webcamCrop]);

  useEffect(() => {
    if (webcamPaddingPx <= webcamPaddingMax) return;
    setWebcamPaddingPx(webcamPaddingMax);
  }, [webcamPaddingPx, webcamPaddingMax]);

  const effectiveWebcamCrop = useMemo(() => {
    if (!webcamCrop || !sourceVideoMeta) return null;
    const pad = clamp(webcamPaddingPx, 0, webcamPaddingMax);
    return normalizeWebcamCrop(
      {
        x: webcamCrop.x + pad,
        y: webcamCrop.y + pad,
        w: webcamCrop.w - pad * 2,
        h: webcamCrop.h - pad * 2,
      },
      sourceVideoMeta,
    );
  }, [normalizeWebcamCrop, sourceVideoMeta, webcamCrop, webcamPaddingMax, webcamPaddingPx]);

  const webcamCropStyle = useMemo(() => {
    if (!webcamCrop || !sourceVideoMeta) return null;
    return {
      left: `${(webcamCrop.x / sourceVideoMeta.width) * 100}%`,
      top: `${(webcamCrop.y / sourceVideoMeta.height) * 100}%`,
      width: `${(webcamCrop.w / sourceVideoMeta.width) * 100}%`,
      height: `${(webcamCrop.h / sourceVideoMeta.height) * 100}%`,
    };
  }, [sourceVideoMeta, webcamCrop]);

  const topHeightPx = useMemo(() => {
    const raw = Math.round(DEFAULT_VERTICAL_OUTPUT.height * clamp01(webcamTopHeightPct / 100));
    return clamp(raw, 200, DEFAULT_VERTICAL_OUTPUT.height - 200);
  }, [webcamTopHeightPct]);

  const verticalSelectionReady = skipManualWebcamCrop
    ? Boolean(pendingVerticalFile && sourceVideoMeta)
    : Boolean(pendingVerticalFile && sourceVideoMeta && effectiveWebcamCrop);

  useEffect(() => {
    const video = verticalCompositionVideoRef.current;
    const canvas = verticalCompositionCanvasRef.current;
    if (!video || !canvas || !verticalPreviewUrl || !sourceVideoMeta) return;
    const singleLayout = skipManualWebcamCrop || !effectiveWebcamCrop;
    if (!singleLayout && !effectiveWebcamCrop) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const canvasWidth = 540;
    const canvasHeight = Math.round((DEFAULT_VERTICAL_OUTPUT.height / DEFAULT_VERTICAL_OUTPUT.width) * canvasWidth);
    const topHeight = Math.round((topHeightPx / DEFAULT_VERTICAL_OUTPUT.height) * canvasHeight);
    const bottomHeight = canvasHeight - topHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const drawVideoRegion = (
      src: WebcamCrop,
      dst: { x: number; y: number; w: number; h: number },
      fit: VerticalFitMode,
    ) => {
      if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;
      const srcAspect = src.w / src.h;
      const dstAspect = dst.w / dst.h;
      if (fit === "contain") {
        let drawWidth = dst.w;
        let drawHeight = dst.h;
        let drawX = dst.x;
        let drawY = dst.y;
        if (srcAspect > dstAspect) {
          drawHeight = dst.w / srcAspect;
          drawY += (dst.h - drawHeight) / 2;
        } else {
          drawWidth = dst.h * srcAspect;
          drawX += (dst.w - drawWidth) / 2;
        }
        ctx.fillStyle = "#050505";
        ctx.fillRect(dst.x, dst.y, dst.w, dst.h);
        ctx.drawImage(video, src.x, src.y, src.w, src.h, drawX, drawY, drawWidth, drawHeight);
        return;
      }
      let sx = src.x;
      let sy = src.y;
      let sw = src.w;
      let sh = src.h;
      if (srcAspect > dstAspect) {
        const narrowed = sh * dstAspect;
        sx += (sw - narrowed) / 2;
        sw = narrowed;
      } else {
        const trimmed = sw / dstAspect;
        sy += (sh - trimmed) / 2;
        sh = trimmed;
      }
      ctx.drawImage(video, sx, sy, sw, sh, dst.x, dst.y, dst.w, dst.h);
    };

    let raf = 0;
    const render = () => {
      if (video.readyState >= 2) {
        ctx.fillStyle = "#040404";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        if (singleLayout) {
          drawVideoRegion(
            { x: 0, y: 0, w: sourceVideoMeta.width, h: sourceVideoMeta.height },
            { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
            bottomFitMode,
          );
        } else {
          drawVideoRegion(
            effectiveWebcamCrop,
            { x: 0, y: 0, w: canvasWidth, h: topHeight },
            "cover",
          );
          drawVideoRegion(
            { x: 0, y: 0, w: sourceVideoMeta.width, h: sourceVideoMeta.height },
            { x: 0, y: topHeight, w: canvasWidth, h: bottomHeight },
            bottomFitMode,
          );
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, topHeight + 0.5);
          ctx.lineTo(canvasWidth, topHeight + 0.5);
          ctx.stroke();
        }
      }
      raf = window.requestAnimationFrame(render);
    };
    const startPlayback = () => {
      const maybePromise = video.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => undefined);
      }
    };
    startPlayback();
    render();
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [verticalPreviewUrl, sourceVideoMeta, effectiveWebcamCrop, bottomFitMode, topHeightPx, skipManualWebcamCrop]);

  const startVerticalRender = async () => {
    if (!pendingVerticalFile) {
      toast({ title: "Choose a file", description: "Upload an MP4, M4V, or MKV before rendering." });
      return;
    }
    if (!sourceVideoMeta) {
      toast({ title: "Preparing preview", description: "Wait for video metadata to load, then try again." });
      return;
    }
    if (!skipManualWebcamCrop && !effectiveWebcamCrop) {
      toast({ title: "Set webcam crop", description: "Adjust the crop box before rendering vertical output." });
      return;
    }
    const verticalLayout: VerticalLayoutMode = skipManualWebcamCrop ? "single" : "stacked";
    const ok = await handleFile(pendingVerticalFile, {
      mode: "vertical",
      verticalClipCount,
      verticalMode: {
        enabled: true,
        output: { ...DEFAULT_VERTICAL_OUTPUT },
        layout: verticalLayout,
        source: sourceVideoMeta,
        webcamCrop: verticalLayout === "stacked" ? effectiveWebcamCrop : null,
        webcamPlacement: verticalLayout === "stacked"
          ? {
              heightPct: Number(clamp01(webcamTopHeightPct / 100).toFixed(4)),
            }
          : undefined,
        topHeightPx: verticalLayout === "stacked" ? topHeightPx : null,
        bottomFit: bottomFitMode,
        webcamFit: "cover",
        paddingPx: verticalLayout === "stacked" ? clamp(webcamPaddingPx, 0, webcamPaddingMax) : 0,
      },
    });
    if (!ok) return;
    setPendingVerticalFile(null);
    setWebcamCrop(null);
    setSourceVideoMeta(null);
    setWebcamTopHeightPct(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
    setBottomFitMode("cover");
    setCropInteraction(null);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handlePickFile = () => {
    trackEditorEvent("new_project_clicked", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: { mode: isVerticalMode ? "vertical" : "horizontal" },
    });
    fileInputRef.current?.click();
  };

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

  const handleSelectJob = (jobId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("jobId", jobId);
    setSearchParams(next, { replace: false });
  };

  const handleCancelJob = useCallback(
    async (jobId: string) => {
      if (!accessToken || !jobId) return;
      setCancelingJobId(jobId);
      try {
        const requestCancel = async () =>
          apiFetch<{ ok: boolean }>(`/api/jobs/${jobId}/cancel`, {
            method: "POST",
            token: accessToken,
          });
        try {
          await requestCancel();
        } catch (err: any) {
          // Backward compatibility while backend deploys the new /cancel route.
          if (err instanceof ApiError && err.status === 404) {
            await apiFetch<{ ok: boolean }>(`/api/jobs/${jobId}/cancel-queue`, {
              method: "POST",
              token: accessToken,
            });
          } else {
            throw err;
          }
        }
        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? { ...job, status: "failed", progress: Math.max(0, Math.min(100, Number(job.progress ?? 0))) }
              : job,
          ),
        );
        setActiveJob((prev) => {
          if (!prev || prev.id !== jobId) return prev;
          return {
            ...prev,
            status: "failed",
            progress: Math.max(0, Math.min(100, Number(prev.progress ?? 0))),
            error: "queue_canceled_by_user",
          };
        });
        toast({
          title: "Job canceled",
          description: "The job has been stopped.",
        });
        fetchJobs();
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          toast({ title: "Session expired", description: "Please sign in again." });
          try {
            await signOut();
          } catch (e) {
            // ignore
          }
        } else {
          toast({
            title: "Cancel failed",
            description: err?.message || "Please try again.",
          });
          fetchJobs();
        }
      } finally {
        setCancelingJobId((current) => (current === jobId ? null : current));
      }
    },
    [accessToken, fetchJobs, signOut, toast],
  );

  const handleDownload = async (clipIndex = 0) => {
    if (!accessToken || !activeJob) return;
    try {
      const outputUrls = Array.isArray(activeJob.outputUrls) ? activeJob.outputUrls : [];
      const selectedExistingUrl =
        outputUrls[clipIndex] || (clipIndex === 0 ? activeJob.outputUrl || undefined : undefined);
      if (selectedExistingUrl) {
        window.open(selectedExistingUrl, "_blank");
        submitDownloadFeedback(activeJob, clipIndex, "frontend_manual_download");
        return;
      }
      const clipParam = clipIndex + 1;
      const data = await apiFetch<{ url: string }>(`/api/jobs/${activeJob.id}/output-url?clip=${clipParam}`, { token: accessToken });
      setActiveJob((prev) => {
        if (!prev) return prev;
        const nextUrls = Array.isArray(prev.outputUrls) ? [...prev.outputUrls] : [];
        while (nextUrls.length < clipParam) nextUrls.push("");
        nextUrls[clipIndex] = data.url;
        return { ...prev, outputUrl: data.url, outputUrls: nextUrls };
      });
      window.open(data.url, "_blank");
      submitDownloadFeedback(activeJob, clipIndex, "frontend_manual_download");
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again." });
    }
  };

  const normalizedActiveStatus = activeJob ? normalizeStatus(activeJob.status) : null;
  const activeStatusLabel = activeJob
    ? normalizeStatus(activeJob.status) === "failed" && activeJob.error === "queue_canceled_by_user"
      ? "Canceled"
      : STATUS_LABELS[normalizeStatus(activeJob.status)] || "Queued"
    : "Queued";
  const canCancelJob = Boolean(activeJob && !isTerminalStatus(activeJob.status));
  const cancelButtonLabel =
    normalizedActiveStatus === "queued" || normalizedActiveStatus === "uploading"
      ? "Cancel Queue"
      : "Cancel Job";
  const activeOutputUrls = useMemo(() => {
    if (!activeJob) return [] as string[];
    const urls = Array.isArray(activeJob.outputUrls)
      ? activeJob.outputUrls.map((url) => (typeof url === "string" ? url : ""))
      : [];
    if (urls.length > 0) return urls;
    if (activeJob.outputUrl) return [activeJob.outputUrl];
    return [];
  }, [activeJob]);
  const activeAnalysis = (activeJob?.analysis ?? {}) as any;
  const hookStartSec = Number(activeAnalysis?.hook_start_time ?? activeAnalysis?.hook?.start ?? NaN);
  const hookEndSec = Number(activeAnalysis?.hook_end_time ?? (Number.isFinite(hookStartSec) ? hookStartSec + Number(activeAnalysis?.hook?.duration ?? 0) : NaN));
  const hookText = typeof activeAnalysis?.hook_text === "string" ? activeAnalysis.hook_text : "";
  const hookReason = typeof activeAnalysis?.hook_reason === "string" ? activeAnalysis.hook_reason : "";
  const metadataSummary = activeAnalysis?.metadata_summary && typeof activeAnalysis.metadata_summary === "object"
    ? activeAnalysis.metadata_summary
    : null;
  const metadataRetention = metadataSummary?.retention && typeof metadataSummary.retention === "object"
    ? metadataSummary.retention
    : null;
  const metadataNiche = metadataSummary?.niche && typeof metadataSummary.niche === "object"
    ? metadataSummary.niche
    : null;
  const hookSelectionSource = typeof activeAnalysis?.hook_selection_source === "string"
    ? activeAnalysis.hook_selection_source
    : typeof metadataRetention?.hookSelectionSource === "string"
      ? metadataRetention.hookSelectionSource
      : "auto";
  const pipelineJudgeMeta =
    activeAnalysis?.pipelineSteps?.STORY_QUALITY_GATE?.meta ||
    activeAnalysis?.pipelineSteps?.RETENTION_SCORE?.meta ||
    null;
  const retentionJudge = activeAnalysis?.retention_judge && typeof activeAnalysis.retention_judge === "object"
    ? activeAnalysis.retention_judge
    : pipelineJudgeMeta?.selectedJudge && typeof pipelineJudgeMeta.selectedJudge === "object"
      ? pipelineJudgeMeta.selectedJudge
      : pipelineJudgeMeta?.judge && typeof pipelineJudgeMeta.judge === "object"
        ? pipelineJudgeMeta.judge
        : null;
  const retentionAttempts = Array.isArray(activeAnalysis?.retention_attempts)
    ? activeAnalysis.retention_attempts
    : Array.isArray(pipelineJudgeMeta?.attempts)
      ? pipelineJudgeMeta.attempts
      : [];
  const whyKeepWatching: string[] = Array.isArray(retentionJudge?.why_keep_watching)
    ? retentionJudge.why_keep_watching.filter((item: unknown) => typeof item === "string").slice(0, 3)
    : [];
  const genericReasons: string[] = Array.isArray(retentionJudge?.what_is_generic)
    ? retentionJudge.what_is_generic.filter((item: unknown) => typeof item === "string").slice(0, 3)
    : [];
  const detectedRetentionStrategyProfile =
    typeof metadataRetention?.strategyProfile === "string"
      ? metadataRetention.strategyProfile
      : typeof retentionJudge?.strategy_profile === "string"
        ? retentionJudge.strategy_profile
        : typeof activeAnalysis?.retentionStrategyProfile === "string"
          ? activeAnalysis.retentionStrategyProfile
          : typeof activeAnalysis?.retentionStrategy === "string"
            ? activeAnalysis.retentionStrategy
            : null;
  const detectedRetentionContentFormat =
    typeof metadataRetention?.contentFormat === "string"
      ? metadataRetention.contentFormat
      : typeof retentionJudge?.content_format === "string"
        ? retentionJudge.content_format
        : typeof activeAnalysis?.retentionContentFormat === "string"
          ? activeAnalysis.retentionContentFormat
          : typeof activeAnalysis?.retention_content_format === "string"
            ? activeAnalysis.retention_content_format
            : null;
  const detectedRetentionTargetPlatform =
    typeof metadataRetention?.targetPlatform === "string"
      ? metadataRetention.targetPlatform
      : typeof retentionJudge?.target_platform === "string"
        ? retentionJudge.target_platform
        : typeof activeAnalysis?.retentionTargetPlatform === "string"
          ? activeAnalysis.retentionTargetPlatform
          : typeof activeAnalysis?.retention_target_platform === "string"
            ? activeAnalysis.retention_target_platform
            : typeof activeAnalysis?.retentionPlatform === "string"
              ? activeAnalysis.retentionPlatform
              : typeof activeAnalysis?.targetPlatform === "string"
                ? activeAnalysis.targetPlatform
                : null;
  const detectedNicheRaw =
    typeof activeAnalysis?.niche_profile?.niche === "string"
      ? activeAnalysis.niche_profile.niche
      : typeof metadataNiche?.name === "string"
        ? metadataNiche.name
        : null;
  const detectedNicheConfidenceRaw =
    Number.isFinite(Number(activeAnalysis?.niche_profile?.confidence))
      ? Number(activeAnalysis.niche_profile.confidence)
      : Number.isFinite(Number(metadataNiche?.confidence))
        ? Number(metadataNiche.confidence)
        : null;
  const detectedNicheConfidencePercent =
    detectedNicheConfidenceRaw !== null
      ? Math.round(clamp01(detectedNicheConfidenceRaw) * 100)
      : null;
  const detectedNicheRationale: string[] = Array.isArray(activeAnalysis?.niche_profile?.rationale)
    ? activeAnalysis.niche_profile.rationale.filter((line: unknown) => typeof line === "string").slice(0, 3)
    : Array.isArray(metadataNiche?.rationale)
      ? metadataNiche.rationale.filter((line: unknown) => typeof line === "string").slice(0, 3)
      : [];
  const hookVariants = normalizeHookCandidates(
    activeAnalysis?.hook_variants ||
    activeAnalysis?.hook_candidates ||
    activeAnalysis?.editPlan?.hookVariants ||
    activeAnalysis?.editPlan?.hookCandidates ||
    activeAnalysis?.pipelineSteps?.HOOK_SCORING?.meta?.topCandidates ||
    activeAnalysis?.pipelineSteps?.BEST_MOMENT_SCORING?.meta?.topCandidates ||
    (activeAnalysis?.pipelineSteps?.HOOK_SELECT_AND_AUDIT?.meta?.selectedHook
      ? [activeAnalysis.pipelineSteps.HOOK_SELECT_AND_AUDIT.meta.selectedHook]
      : [])
  ).slice(0, 3);
  const selectedHookFromPipeline =
    normalizeHookCandidates(
      activeAnalysis?.pipelineSteps?.HOOK_SELECT_AND_AUDIT?.meta?.selectedHook
        ? [activeAnalysis.pipelineSteps.HOOK_SELECT_AND_AUDIT.meta.selectedHook]
        : [],
    )[0] ?? null;
  const selectedHookFromAnalysis: HookCandidate | null =
    Number.isFinite(hookStartSec) && Number.isFinite(hookEndSec) && hookEndSec > hookStartSec
      ? {
          start: hookStartSec,
          duration: Math.max(0.1, hookEndSec - hookStartSec),
          score: Number.isFinite(Number(activeAnalysis?.hook_score)) ? Number(activeAnalysis?.hook_score) : 0,
          auditScore: Number.isFinite(Number(activeAnalysis?.hook_audit_score))
            ? Number(activeAnalysis?.hook_audit_score)
            : Number.isFinite(Number(activeAnalysis?.hook_score))
              ? Number(activeAnalysis?.hook_score)
              : 0,
          auditPassed: Boolean(activeAnalysis?.hook_audit_passed ?? true),
          text: hookText,
          reason: hookReason,
          synthetic: Boolean(activeAnalysis?.hook_synthetic),
        }
      : selectedHookFromPipeline;
  const selectedHookCandidate =
    (activeJob ? selectedHookByJob[activeJob.id] : null) ||
    (() => {
      if (selectedHookFromAnalysis && hookVariants.length > 0) {
        const matched = hookVariants.find((candidate) => (
          Math.abs(candidate.start - selectedHookFromAnalysis.start) <= 0.4 &&
          Math.abs(candidate.duration - selectedHookFromAnalysis.duration) <= 0.8
        ));
        if (matched) return matched;
      }
      if (selectedHookFromAnalysis) return selectedHookFromAnalysis;
      return hookVariants[0] || null;
    })();
  const retentionImprovements: string[] = Array.isArray(metadataRetention?.improvements)
    ? metadataRetention.improvements.filter((line: unknown) => typeof line === "string").slice(0, 8)
    : Array.isArray(activeJob?.optimizationNotes)
      ? activeJob.optimizationNotes.filter((line: unknown) => typeof line === "string").slice(0, 8)
      : [];
  const retentionScoreDisplay = Number.isFinite(Number(activeJob?.retentionScore))
    ? Number(activeJob?.retentionScore)
    : Number.isFinite(Number(retentionJudge?.retention_score))
      ? Number(retentionJudge?.retention_score)
      : null;
  const retentionScoreBeforeDisplay = Number.isFinite(Number(metadataRetention?.beforeScore))
    ? Number(metadataRetention.beforeScore)
    : Number.isFinite(Number(activeAnalysis?.retention_score_before))
      ? Number(activeAnalysis.retention_score_before)
      : null;
  const retentionScoreAfterDisplay = Number.isFinite(Number(metadataRetention?.afterScore))
    ? Number(metadataRetention.afterScore)
    : Number.isFinite(Number(activeAnalysis?.retention_score_after))
      ? Number(activeAnalysis.retention_score_after)
      : retentionScoreDisplay;
  const retentionScoreDeltaDisplay = Number.isFinite(Number(metadataRetention?.delta))
    ? Number(metadataRetention.delta)
    : (
      retentionScoreBeforeDisplay !== null &&
      retentionScoreAfterDisplay !== null
        ? Number((retentionScoreAfterDisplay - retentionScoreBeforeDisplay).toFixed(1))
        : null
    );
  const hookWindowLabel =
    Number.isFinite(hookStartSec) && Number.isFinite(hookEndSec)
      ? `${hookStartSec.toFixed(1)}s - ${hookEndSec.toFixed(1)}s`
      : selectedHookCandidate
        ? `${selectedHookCandidate.start.toFixed(1)}s - ${(selectedHookCandidate.start + selectedHookCandidate.duration).toFixed(1)}s`
      : "Not available";
  const failedGateReason =
    activeJob?.error && activeJob.error.startsWith("FAILED_HOOK:")
      ? activeJob.error.replace(/^FAILED_HOOK:\s*/i, "").trim()
      : activeJob?.error && activeJob.error.startsWith("FAILED_QUALITY_GATE:")
        ? activeJob.error.replace(/^FAILED_QUALITY_GATE:\s*/i, "").trim()
        : "";
  const activeStepKey = activeJob ? stepKeyForStatus(activeJob.status) : null;
  const currentStepIndex = activeStepKey
    ? PIPELINE_STEPS.findIndex((step) => step.key === activeStepKey)
    : -1;
  const previewOutputUrl = activeOutputUrls.find((url) => typeof url === "string" && url.length > 0) || "";
  const showVideo = Boolean(activeJob && normalizedActiveStatus === "ready" && previewOutputUrl);
  const canApplyHookRealtime = Boolean(
    activeJob && REALTIME_HOOK_MUTABLE_STATUSES.has(normalizeStatus(activeJob.status)),
  );
  const canShowRealtimeHookSelector = Boolean(
    activeJob &&
      activeJob.renderMode !== "vertical" &&
      hookVariants.length > 1 &&
      canApplyHookRealtime,
  );
  const hookPreviewCandidate =
    (activeJob ? hookPreviewCandidateByJob[activeJob.id] : null) ||
    selectedHookCandidate ||
    hookVariants[0] ||
    null;
  const activeHookPreviewUrl = activeJob ? hookPreviewUrlByJob[activeJob.id] || "" : "";
  const hookPreviewSourceUrl = activeJob
    ? activeHookPreviewUrl || previewOutputUrl || ""
    : "";
  const hookPreviewError = activeJob ? hookPreviewErrorByJob[activeJob.id] || "" : "";
  const hookPreviewLoading = Boolean(activeJob?.id && hookPreviewLoadingJobId === activeJob.id);
  useEffect(() => {
    if (!activeJob?.id || !canShowRealtimeHookSelector) return;
    if (hookPromptedByJob[activeJob.id]) return;
    setHookPromptedByJob((prev) => ({ ...prev, [activeJob.id]: true }));
    setHookSelectorOpen(true);
  }, [activeJob?.id, canShowRealtimeHookSelector, hookPromptedByJob]);
  useEffect(() => {
    if (!hookSelectorOpen || !activeJob?.id || !canShowRealtimeHookSelector) return;
    const jobId = activeJob.id;
    setHookPreviewCandidateByJob((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, jobId)) return prev;
      return { ...prev, [jobId]: selectedHookCandidate || hookVariants[0] || null };
    });
  }, [
    activeJob?.id,
    canShowRealtimeHookSelector,
    hookSelectorOpen,
    hookVariants,
    selectedHookCandidate,
  ]);
  useEffect(() => {
    if (!hookSelectorOpen || !activeJob?.id || !accessToken || !canShowRealtimeHookSelector) return;
    const jobId = activeJob.id;
    if (activeHookPreviewUrl || hookPreviewLoadingJobId === jobId) return;

    let canceled = false;
    setHookPreviewLoadingJobId(jobId);
    setHookPreviewErrorByJob((prev) => ({ ...prev, [jobId]: "" }));

    const resolvePreviewUrl = async () => {
      let resolvedUrl = "";
      try {
        const proxyResp = await apiFetch<{ url?: string }>(`/api/jobs/${jobId}/proxy-url`, {
          method: "POST",
          token: accessToken,
        });
        if (typeof proxyResp?.url === "string" && proxyResp.url.length > 0) {
          resolvedUrl = proxyResp.url;
        }
      } catch (err: any) {
        if (!(err instanceof ApiError && err.status === 404)) {
          console.warn("proxy preview url failed", err);
        }
      }

      if (!resolvedUrl) {
        try {
          const inputResp = await apiFetch<{ url?: string }>(`/api/jobs/${jobId}/input-url`, {
            method: "POST",
            token: accessToken,
          });
          if (typeof inputResp?.url === "string" && inputResp.url.length > 0) {
            resolvedUrl = inputResp.url;
          }
        } catch (err: any) {
          if (!(err instanceof ApiError && err.status === 404)) {
            console.warn("input preview url failed", err);
          }
        }
      }

      if (canceled) return;
      if (resolvedUrl) {
        setHookPreviewUrlByJob((prev) => ({ ...prev, [jobId]: resolvedUrl }));
        setHookPreviewErrorByJob((prev) => ({ ...prev, [jobId]: "" }));
        return;
      }
      setHookPreviewErrorByJob((prev) => ({
        ...prev,
        [jobId]: "Preview unavailable right now. You can still apply a hook.",
      }));
    };

    void resolvePreviewUrl().finally(() => {
      setHookPreviewLoadingJobId((current) => (current === jobId ? null : current));
    });

    return () => {
      canceled = true;
    };
  }, [
    accessToken,
    activeJob?.id,
    activeHookPreviewUrl,
    canShowRealtimeHookSelector,
    hookSelectorOpen,
  ]);
  useEffect(() => {
    if (!hookSelectorOpen) return;
    const video = hookPreviewVideoRef.current;
    if (!video || !hookPreviewCandidate) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const start = clamp(hookPreviewCandidate.start, 0, Math.max(0, duration - 0.05));
    video.currentTime = start;
    void video.play().catch(() => {});
  }, [
    hookPreviewCandidate?.duration,
    hookPreviewCandidate?.start,
    hookPreviewSourceUrl,
    hookSelectorOpen,
  ]);
  const handleSelectHookPreviewCandidate = useCallback((candidate: HookCandidate) => {
    if (!activeJob?.id) return;
    const jobId = activeJob.id;
    setHookPreviewCandidateByJob((prev) => ({ ...prev, [jobId]: candidate }));
  }, [activeJob?.id]);
  const handleHookPreviewLoadedMetadata = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!video || !hookPreviewCandidate) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const start = clamp(hookPreviewCandidate.start, 0, Math.max(0, duration - 0.05));
    video.currentTime = start;
    void video.play().catch(() => {});
  }, [hookPreviewCandidate]);
  const handleHookPreviewTimeUpdate = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!video || !hookPreviewCandidate) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const start = clamp(hookPreviewCandidate.start, 0, Math.max(0, duration - 0.05));
    const rawEnd = hookPreviewCandidate.start + Math.max(0.1, hookPreviewCandidate.duration);
    const end = clamp(rawEnd, start + 0.08, duration);
    if (video.currentTime < start) {
      video.currentTime = start;
      return;
    }
    if (video.currentTime >= end - 0.03) {
      video.currentTime = start;
      if (!video.paused) void video.play().catch(() => {});
    }
  }, [hookPreviewCandidate]);
  const handleApplyPreferredHookRealtime = useCallback(async (candidate: HookCandidate) => {
    if (!activeJob?.id || !accessToken) return;
    const jobId = activeJob.id;
    setSelectedHookByJob((prev) => ({ ...prev, [jobId]: candidate }));
    setHookPreviewCandidateByJob((prev) => ({ ...prev, [jobId]: candidate }));
    setApplyingHookJobId(jobId);
    try {
      await apiFetch(`/api/jobs/${jobId}/preferred-hook`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ preferredHook: candidate }),
      });
      await fetchJob(jobId);
      toast({
        title: "Hook updated",
        description: "Preview another option any time before rendering locks.",
      });
    } catch (err: any) {
      toast({
        title: err instanceof ApiError && err.status === 409 ? "Hook stage passed" : "Hook update failed",
        description: err?.message || "Please try again.",
      });
    } finally {
      setApplyingHookJobId((current) => (current === jobId ? null : current));
    }
  }, [accessToken, activeJob?.id, fetchJob, toast]);
  const handlePreviewLoadedMetadata = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    ensurePlaybackTelemetry(activeJob.id, duration, Number(video.currentTime || 0));
  }, [activeJob, ensurePlaybackTelemetry]);

  const handlePreviewTimeUpdate = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const telemetry = ensurePlaybackTelemetry(activeJob.id, duration);
    const currentTime = clamp(Number(video.currentTime || 0), 0, duration);
    const delta = currentTime - telemetry.lastTimeSec;
    if (Number.isFinite(delta)) {
      if (delta >= 0 && delta <= 2.5) {
        telemetry.watchedSeconds += delta;
      } else if (delta < -0.25) {
        telemetry.rewatchSeconds += Math.abs(delta);
      }
      if (delta < -Math.max(0.5, duration * 0.35)) {
        telemetry.loopCount += 1;
      }
    }
    telemetry.lastTimeSec = currentTime;
    telemetry.maxTimeSec = Math.max(telemetry.maxTimeSec, currentTime);
    telemetry.maxProgress = Math.max(telemetry.maxProgress, clamp01(telemetry.maxTimeSec / duration));

    const shouldDispatch =
      telemetry.maxProgress >= 0.95 ||
      telemetry.maxProgress - telemetry.lastDispatchProgress >= WATCH_FEEDBACK_PROGRESS_STEP;
    if (shouldDispatch) {
      telemetry.lastDispatchProgress = telemetry.maxProgress;
      submitPreviewFeedback(
        activeJob,
        telemetry,
        `progress:${Math.round(telemetry.maxProgress * 100)}`,
        telemetry.maxProgress >= 0.95,
      );
    }
  }, [activeJob, ensurePlaybackTelemetry, submitPreviewFeedback]);

  const handlePreviewPause = useCallback(() => {
    if (!activeJob) return;
    const telemetry = playbackTelemetryRef.current[activeJob.id];
    if (!telemetry) return;
    submitPreviewFeedback(activeJob, telemetry, "pause", false);
  }, [activeJob, submitPreviewFeedback]);

  const handlePreviewEnded = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    const telemetry = ensurePlaybackTelemetry(activeJob.id, duration, duration);
    if (Number.isFinite(duration) && duration > 0) {
      telemetry.maxTimeSec = Math.max(telemetry.maxTimeSec, duration);
      telemetry.maxProgress = Math.max(telemetry.maxProgress, 1);
      telemetry.watchedSeconds = Math.max(telemetry.watchedSeconds, duration);
      telemetry.lastDispatchProgress = 1;
    }
    submitPreviewFeedback(activeJob, telemetry, "ended", true);
  }, [activeJob, ensurePlaybackTelemetry, submitPreviewFeedback]);

  const handlePreviewVideoError = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    const details = {
      jobId: activeJob?.id ?? null,
      outputUrl: previewOutputUrl || null,
      networkState: video?.networkState ?? null,
      readyState: video?.readyState ?? null,
      errorCode: video?.error?.code ?? null,
      errorMessage: video?.error?.message ?? null,
    };
    console.error("Preview video failed to load", details);
    toast({
      title: "Preview failed",
      description: "Could not load the edited video. Check network/output URL.",
    });
  }, [activeJob?.id, previewOutputUrl, toast]);

  const etaSeconds = useMemo(() => {
    if (!activeJob) return null;
    const normalized = normalizeStatus(activeJob.status);
    if (normalized === "ready" || normalized === "failed") return null;
    // During upload we show explicit status text instead of an ETA to avoid
    // confusing/sticky countdowns before the edit pipeline actually starts.
    if (normalized === "uploading") return null;
    const fileSize = jobFileSizeRef.current[activeJob.id] ?? uploadBytesTotal ?? null;
    const targetQuality = normalizeQuality(activeJob.finalQuality || activeJob.requestedQuality || "720p");
    const stageMarker = statusStartRef.current[activeJob.id];
    const stageStartedAt =
      stageMarker && stageMarker.status === normalized
        ? stageMarker.startedAt
        : pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const stageStartProgress =
      stageMarker && stageMarker.status === normalized && Number.isFinite(stageMarker.startProgress)
        ? clamp(stageMarker.startProgress, 0, 100)
        : 0;
    const stageElapsed = Math.max(0, (Date.now() - stageStartedAt) / 1000);

    // Otherwise, estimate remaining processing time from job progress and elapsed pipeline time.
    const startAt = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const elapsed = Math.max(1, (Date.now() - startAt) / 1000);
    const jobProgress = typeof activeJob.progress === "number" ? activeJob.progress : 0;
    const clampedProgress = clamp(jobProgress, 0, 100);
    const baseline = computeStageEtaBaseline({ status: normalized, fileSizeBytes: fileSize, quality: targetQuality });
    const baselineRemaining = Math.max(2, Math.round(baseline - stageElapsed));
    const finalizeFloor = Math.min(90, Math.max(4, Math.round(6 + stageElapsed * 0.08)));
    const antiStall = (seconds: number) => {
      const rounded = Math.max(0, Math.round(seconds));
      if (rounded > 1) return rounded;
      // Avoid misleading "1s remaining" while still in non-terminal stages.
      if (clampedProgress >= 95) return Math.max(baselineRemaining, finalizeFloor);
      return baselineRemaining;
    };
    const stageProgressGain = Math.max(0, clampedProgress - stageStartProgress);
    if (clampedProgress > 0 && stageProgressGain >= 0.5 && stageElapsed >= 2) {
      const remainingPct = Math.max(0, 100 - clampedProgress);
      const remaining = Math.round((stageElapsed * remainingPct) / stageProgressGain);
      return antiStall(remaining);
    }
    if (jobProgress > 0) {
      const remaining = Math.round((elapsed * (100 - jobProgress)) / jobProgress);
      return antiStall(remaining);
    }
    return baselineRemaining;
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

  const showUploadStatusOnly = normalizedActiveStatus === "uploading";
  const etaLabel = showUploadStatusOnly ? "Uploading..." : formatEta(etaSeconds);
  const etaSuffix = !showUploadStatusOnly && etaSeconds !== null && etaSeconds > 0 ? " remaining" : "";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main mx-auto min-h-screen max-w-6xl overflow-x-clip px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold font-premium text-foreground sm:text-3xl">Creator Studio</h1>
              <p className="text-muted-foreground mt-1">Ship edits faster with live preview and real-time feedback</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:w-auto md:justify-end">
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
                  {trialActive && (
                    <Badge className="bg-emerald-500/15 text-emerald-200 border border-emerald-400/40">
                      Trial {Math.max(1, trialDaysRemaining)}d left
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {isDevAccount
                      ? "Unlimited renders"
                      : `${rendersRemaining ?? 0} renders left`}
                  </Badge>
                  {isDevAccount && (
                    <Link to="/__control-panel" className="inline-flex">
                      <Button type="button" variant="outline" className="h-8 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
                        Open Dev Panel
                      </Button>
                    </Link>
                  )}
                </>
              )}
              <div className="flex w-full flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-1 sm:w-auto sm:flex-row sm:items-center sm:rounded-full">
                <button
                  type="button"
                  className={`w-full rounded-full px-3 py-1.5 text-[11px] text-center transition-colors sm:w-auto sm:text-xs ${
                    !isVerticalMode ? "bg-card text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    trackEditorEvent("render_mode_selected", {
                      retentionProfile: retentionStrategyProfile,
                      targetPlatform: retentionTargetPlatform,
                      captionStyle: activeSubtitlePreset,
                      metadata: { mode: "horizontal" },
                    });
                    setRenderMode("horizontal");
                  }}
                  aria-label="Horizontal original mode"
                >
                  Horizontal (Original)
                </button>
                <button
                  type="button"
                  className={`w-full rounded-full px-3 py-1.5 text-[11px] text-center transition-colors sm:w-auto sm:text-xs ${
                    isVerticalMode ? "bg-card text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    trackEditorEvent("render_mode_selected", {
                      retentionProfile: retentionStrategyProfile,
                      targetPlatform: retentionTargetPlatform,
                      captionStyle: activeSubtitlePreset,
                      metadata: { mode: "vertical" },
                    });
                    setRenderMode("vertical");
                  }}
                  aria-label="Vertical 9:16 mode"
                >
                  Vertical (9:16)
                </button>
              </div>
              <div className="flex w-full flex-wrap items-center gap-1 rounded-full border border-border/60 bg-muted/20 p-1 sm:w-auto">
                {RETENTION_PROFILE_OPTIONS.map((profile) => {
                  const lockedForMode = !isVerticalMode && profile.value === "viral";
                  return (
                    <button
                      key={profile.value}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                        retentionStrategyProfile === profile.value
                          ? "bg-card text-foreground border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      } ${lockedForMode ? "opacity-55 cursor-not-allowed" : ""}`}
                      disabled={lockedForMode}
                      onClick={() => {
                        if (lockedForMode) return;
                        trackEditorEvent("retention_profile_selected", {
                          retentionProfile: profile.value,
                          targetPlatform: retentionTargetPlatform,
                          captionStyle: activeSubtitlePreset,
                          metadata: {
                            fromMode: isVerticalMode ? "vertical" : "horizontal",
                          },
                        });
                        setRetentionStrategyProfile(profile.value);
                      }}
                      aria-label={`Retention profile ${profile.label}`}
                      title={profile.description}
                    >
                      {profile.label}
                    </button>
                  );
                })}
              </div>
              <p className="w-full px-1 text-[11px] text-muted-foreground/90">
                {activeRetentionProfileMeta.description}
              </p>
              <div className="flex w-full flex-wrap items-center gap-1 rounded-full border border-border/60 bg-muted/20 p-1 sm:w-auto">
                {PLATFORM_OPTIONS.map((platform) => (
                  <Tooltip key={platform.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                          retentionTargetPlatform === platform.value
                            ? "bg-card text-foreground border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => {
                          trackEditorEvent("target_platform_selected", {
                            retentionProfile: retentionStrategyProfile,
                            targetPlatform: platform.value,
                            captionStyle: activeSubtitlePreset,
                            metadata: {
                              fromMode: isVerticalMode ? "vertical" : "horizontal",
                            },
                          });
                          setRetentionTargetPlatform(platform.value);
                        }}
                        aria-label={`Target platform ${platform.label}`}
                      >
                        {platform.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{PLATFORM_HELP_TEXT[platform.value]}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="w-full px-1 text-[11px] text-muted-foreground/90">
                {isVerticalMode
                  ? "Vertical mode always uses viral short-form pacing. Platform profile also tunes clip windows, captions, and export encoding."
                  : "Horizontal mode preserves long-form context while platform profile tunes cadence, caption defaults, and export encoding."}
              </p>
              <div className="w-full rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">Captions</p>
                    <p className="text-xs text-muted-foreground">
                      Captions in renders: {autoCaptionsEnabled ? "On" : "Off"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current style: {activeSubtitlePresetMeta?.label ?? formatNicheLabel(activeSubtitlePreset)}
                    </p>
                    {subtitleStyleDirty ? (
                      <p className="text-[11px] text-amber-300/90">Unsaved caption changes</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={autoCaptionsEnabled ? "default" : "outline"}
                      className={`rounded-full ${
                        autoCaptionsEnabled
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border/60 text-muted-foreground"
                      }`}
                      onClick={() => {
                        if (!subtitlesEnabled) return;
                        const nextState = !autoCaptionsEnabled;
                        trackEditorEvent("captions_toggled", {
                          retentionProfile: retentionStrategyProfile,
                          targetPlatform: retentionTargetPlatform,
                          captionStyle: activeSubtitlePreset,
                          metadata: { enabled: nextState },
                        });
                        setAutoCaptionsEnabled(nextState);
                        setSubtitleStyleDirty(true);
                        setCaptionsPanelOpen(true);
                      }}
                      disabled={!subtitlesEnabled}
                    >
                      {autoCaptionsEnabled ? "Captions on" : "Captions off"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={captionsPanelOpen ? "default" : "outline"}
                      className={`rounded-full ${
                        captionsPanelOpen
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border/60 text-muted-foreground"
                      }`}
                      onClick={() => {
                        const nextOpen = !captionsPanelOpen;
                        trackEditorEvent("captions_panel_toggled", {
                          retentionProfile: retentionStrategyProfile,
                          targetPlatform: retentionTargetPlatform,
                          captionStyle: activeSubtitlePreset,
                          metadata: { open: nextOpen },
                        });
                        setCaptionsPanelOpen(nextOpen);
                      }}
                    >
                      {captionsPanelOpen ? "Close captions" : "Edit captions"}
                    </Button>
                    {captionsPanelOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={subtitleStyleDirty ? "default" : "outline"}
                        className={`rounded-full ${
                          subtitleStyleDirty
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border-border/60 text-muted-foreground"
                        }`}
                        onClick={() => void saveSubtitleStyle()}
                        disabled={!subtitleStyleDirty || savingSubtitleStyle}
                      >
                        {savingSubtitleStyle ? "Saving..." : subtitleStyleDirty ? "Save captions" : "Captions saved"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {captionsPanelOpen ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {SUBTITLE_PRESET_OPTIONS.map((preset) => {
                        const locked = !isSubtitlePresetAllowed(preset.id);
                        const requiredPlan = getRequiredPlanForSubtitlePreset(preset.id);
                        const active = activeSubtitlePreset === preset.id;
                        const card = (
                          <button
                            type="button"
                            className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                              active
                                ? "border-primary/60 bg-primary/10 text-foreground"
                                : "border-border/60 text-muted-foreground hover:text-foreground"
                            } ${locked ? "opacity-65" : ""}`}
                            onClick={() => selectSubtitlePreset(preset.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{preset.label}</span>
                              {locked ? <Lock className="h-3 w-3" /> : null}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground/90">{preset.description}</p>
                          </button>
                        );
                        if (!locked) return <div key={preset.id}>{card}</div>;
                        return (
                          <Tooltip key={preset.id}>
                            <TooltipTrigger asChild>{card}</TooltipTrigger>
                            <TooltipContent>Upgrade to {PLAN_CONFIG[requiredPlan]?.name || formatNicheLabel(requiredPlan)} to unlock</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    {activeSubtitlePreset === "mrbeast_animated" && isSubtitlePresetAllowed("mrbeast_animated") ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Font</span>
                          <select
                            className="w-full rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs text-foreground"
                            value={subtitleStyleConfig.fontId}
                            onChange={(event) =>
                              updateMrBeastSubtitleStyle({ fontId: event.target.value as SubtitleStyleConfig["fontId"] })
                            }
                          >
                            {MRBEAST_FONT_OPTIONS.map((fontOption) => (
                              <option key={fontOption.id} value={fontOption.id} className="bg-background text-foreground">
                                {fontOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Animation</span>
                          <select
                            className="w-full rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs text-foreground"
                            value={subtitleStyleConfig.animation}
                            onChange={(event) =>
                              updateMrBeastSubtitleStyle({ animation: event.target.value as SubtitleStyleConfig["animation"] })
                            }
                          >
                            {MRBEAST_ANIMATION_OPTIONS.map((animationOption) => (
                              <option key={animationOption.id} value={animationOption.id} className="bg-background text-foreground">
                                {animationOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Text color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.textColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ textColor: event.target.value })}
                            className="h-8 w-full rounded-md border border-border/60 bg-background/40 p-1"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Accent color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.accentColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ accentColor: event.target.value })}
                            className="h-8 w-full rounded-md border border-border/60 bg-background/40 p-1"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Outline color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.outlineColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ outlineColor: event.target.value })}
                            className="h-8 w-full rounded-md border border-border/60 bg-background/40 p-1"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] text-muted-foreground">Outline width ({subtitleStyleConfig.outlineWidth}px)</span>
                          <Slider
                            min={1}
                            max={12}
                            step={1}
                            value={[subtitleStyleConfig.outlineWidth]}
                            onValueChange={(values) =>
                              updateMrBeastSubtitleStyle({ outlineWidth: Number(values?.[0] ?? subtitleStyleConfig.outlineWidth) })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                variant={onlyHookAndCut ? "default" : "outline"}
                className={`w-full rounded-full gap-2 sm:w-auto ${
                  onlyHookAndCut
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setOnlyHookAndCut((prev) => !prev)}
              >
                {onlyHookAndCut ? "Only Hook + Cut: On" : "Only Hook + Cut"}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="rounded-full border-border/60 text-muted-foreground hover:text-foreground"
                onClick={() => setEditorGuideOpen(true)}
                aria-label="Open editor help menu"
                title="Editor help menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full border-border/60 text-muted-foreground hover:text-foreground sm:w-auto"
                onClick={() => setHideJobsPanel((prev) => !prev)}
              >
                {hideJobsPanel ? "Show Jobs" : "Hide Jobs"}
              </Button>
              <Button onClick={handlePickFile} className="w-full rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </div>
          </div>

          {trialActive && hideSubscriptionCard && (
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={handleShowSubscriptionCard}
              >
                Show subscription card
              </Button>
            </div>
          )}

          {trialActive && !hideSubscriptionCard && (
            <div className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">Free trial unlocked</p>
                  <p className="text-xs text-emerald-200/80">
                    {trialEndsAtLabel
                      ? `Full ${PLAN_CONFIG[trialUnlockTier].name} access until ${trialEndsAtLabel}.`
                      : `Full ${PLAN_CONFIG[trialUnlockTier].name} access is active.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-100 border border-emerald-300/40">
                    Trial {Math.max(1, trialDaysRemaining)}d left
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-emerald-100/80 hover:text-emerald-100"
                    onClick={handleHideSubscriptionCard}
                  >
                    Hide
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {trialUnlockedFeatures.map((feature) => (
                  <p key={`trial-feature-${feature}`} className="text-xs text-emerald-100/90">
                    - {feature}
                  </p>
                ))}
              </div>
            </div>
          )}

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

          <div className={`grid grid-cols-1 gap-6 ${hideJobsPanel ? "lg:grid-cols-1" : "lg:grid-cols-[280px_1fr]"}`}>
            {!hideJobsPanel ? (
              <aside className="glass-card min-w-0 space-y-4 p-4">
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
                {jobs.map((job) => {
                  const ready = normalizeStatus(job.status) === "ready";
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleSelectJob(job.id)}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                        highlightedJobId === job.id
                          ? "ring-2 ring-primary/40 bg-primary/10 border-primary/40"
                          : ready
                            ? "border-success/50 bg-success/15 ring-1 ring-emerald-400/35 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
                            : selectedJobId === job.id
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {ready ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" /> : null}
                          <span className={`text-sm font-medium truncate ${ready ? "text-success" : "text-foreground"}`}>
                            {displayName(job)}
                          </span>
                        </span>
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
                  );
                })}
              </div>
              </aside>
            ) : null}

            <section className="min-w-0 space-y-6">
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
                    {isVerticalMode ? "Upload a video for vertical editing" : "Drop your video here or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isVerticalMode
                      ? "Then place the webcam crop box for the top panel and preview the stacked 9:16 layout."
                      : "MP4, M4V, or MKV up to 2GB"}
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
                <div className="glass-card p-5 space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Vertical Clip Builder</p>
                      <p className="text-xs text-muted-foreground">
                        {skipManualWebcamCrop
                          ? "Manual webcam crop is skipped. Vertical clips render directly from the source framing."
                          : "Manual Webcam Selector is now a crop tool. Top panel uses the selected crop, bottom panel uses the full frame."}
                      </p>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setCropInteraction(null);
                          setSkipManualWebcamCrop((prev) => !prev);
                        }}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            skipManualWebcamCrop ? "bg-emerald-400" : "bg-muted-foreground/60"
                          }`}
                        />
                        {skipManualWebcamCrop ? "Using source framing (skip manual crop)" : "Use manual webcam crop"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3].map((count) => (
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
                          {count} clip{count === 1 ? "" : "s"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      AI will rank the strongest moments and export exactly this many clips when possible.
                    </p>
                  </div>

                  {!verticalPreviewUrl && (
                    <p className="text-xs text-muted-foreground">
                      Upload a file to open the webcam crop tool and 9:16 stacked preview.
                    </p>
                  )}

                  {verticalPreviewUrl && (
                    <div className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                          {!skipManualWebcamCrop ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (!sourceVideoMeta) return;
                                  setWebcamCrop(buildDefaultWebcamCrop(sourceVideoMeta.width, sourceVideoMeta.height));
                                  setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
                                }}
                              >
                                Reset crop
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  if (!sourceVideoMeta) return;
                                  setWebcamCrop((prev) =>
                                    normalizeWebcamCrop(
                                      {
                                        x: 0,
                                        y: prev?.y ?? Math.round(sourceVideoMeta.height * 0.05),
                                        w: sourceVideoMeta.width,
                                        h: prev?.h ?? Math.round(sourceVideoMeta.height * 0.4),
                                      },
                                      sourceVideoMeta,
                                    ),
                                  );
                                }}
                              >
                                Snap to full width
                              </Button>
                            </div>
                          ) : null}

                          <div
                            ref={sourcePreviewRef}
                            className="relative overflow-hidden rounded-xl border border-border/40 bg-black/80 touch-none select-none"
                            style={sourceVideoMeta ? { aspectRatio: `${sourceVideoMeta.width} / ${sourceVideoMeta.height}` } : { aspectRatio: "16 / 9" }}
                          >
                            <video
                              ref={verticalSourceVideoRef}
                              src={verticalPreviewUrl}
                              controls
                              onLoadedMetadata={handleVerticalSourceMetadata}
                              className="h-full w-full object-contain"
                            />
                            {!skipManualWebcamCrop && webcamCropStyle && (
                              <div
                                className={`absolute border-2 border-primary bg-primary/15 ${cropInteraction ? "ring-2 ring-primary/40" : ""}`}
                                style={webcamCropStyle}
                                onPointerDown={(event) => beginCropInteraction("move", event)}
                              >
                                {webcamPaddingPx > 0 && webcamCrop && (
                                  <div
                                    className="absolute border border-white/75 border-dashed pointer-events-none"
                                    style={{
                                      left: `${(clamp(webcamPaddingPx, 0, webcamPaddingMax) / webcamCrop.w) * 100}%`,
                                      top: `${(clamp(webcamPaddingPx, 0, webcamPaddingMax) / webcamCrop.h) * 100}%`,
                                      width: `${100 - ((clamp(webcamPaddingPx, 0, webcamPaddingMax) * 2) / webcamCrop.w) * 100}%`,
                                      height: `${100 - ((clamp(webcamPaddingPx, 0, webcamPaddingMax) * 2) / webcamCrop.h) * 100}%`,
                                    }}
                                  />
                                )}
                                {([
                                  { key: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
                                  { key: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
                                  { key: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
                                  { key: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
                                  { key: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
                                  { key: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
                                  { key: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
                                  { key: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
                                ] as { key: CropHandle; className: string }[]).map((handle) => (
                                  <span
                                    key={handle.key}
                                    className={`absolute h-3.5 w-3.5 rounded-full border border-white/80 bg-primary shadow ${handle.className}`}
                                    onPointerDown={(event) => beginCropInteraction(handle.key, event)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                            <MousePointerClick className="w-3.5 h-3.5" />
                            {skipManualWebcamCrop
                              ? "Manual webcam crop is disabled. Source framing will be used."
                              : webcamCrop
                              ? `Crop: ${Math.round(webcamCrop.w)} x ${Math.round(webcamCrop.h)}px at (${Math.round(webcamCrop.x)}, ${Math.round(webcamCrop.y)})`
                              : "Webcam crop initializes when video metadata loads."}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <video
                            ref={verticalCompositionVideoRef}
                            src={verticalPreviewUrl}
                            muted
                            loop
                            playsInline
                            className="hidden"
                          />
                          <div className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-3">
                            <p className="text-xs font-medium text-foreground">Live 9:16 Composition Preview</p>
                            <div className="mx-auto w-full max-w-[300px]">
                              <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                                <canvas
                                  ref={verticalCompositionCanvasRef}
                                  className="h-full w-full rounded-lg border border-border/50 bg-black"
                                />
                                <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-white/10" />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-3">
                            {!skipManualWebcamCrop ? (
                              <>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Webcam height</span>
                                    <span>{Math.round(topHeightPx)}px ({Math.round(webcamTopHeightPct)}%)</span>
                                  </div>
                                  <Slider
                                    value={[webcamTopHeightPct]}
                                    min={20}
                                    max={70}
                                    step={1}
                                    onValueChange={(value) => setWebcamTopHeightPct(clamp(value[0] ?? DEFAULT_WEBCAM_TOP_HEIGHT_PCT, 20, 70))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Padding</span>
                                    <span>{Math.round(webcamPaddingPx)}px</span>
                                  </div>
                                  <Slider
                                    value={[webcamPaddingPx]}
                                    min={0}
                                    max={Math.max(0, Math.min(120, webcamPaddingMax))}
                                    step={1}
                                    disabled={webcamPaddingMax <= 0}
                                    onValueChange={(value) => setWebcamPaddingPx(clamp(Math.round(value[0] ?? 0), 0, webcamPaddingMax))}
                                  />
                                </div>
                              </>
                            ) : null}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Bottom fit</p>
                              <div className="flex flex-wrap items-center gap-2">
                                {(["cover", "contain"] as VerticalFitMode[]).map((fit) => (
                                  <button
                                    key={fit}
                                    type="button"
                                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                                      bottomFitMode === fit
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border/60 text-muted-foreground hover:border-primary/40"
                                    }`}
                                    onClick={() => setBottomFitMode(fit)}
                                  >
                                    {fit === "cover" ? "Cover (default)" : "Contain"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          {skipManualWebcamCrop
                            ? `Output: ${DEFAULT_VERTICAL_OUTPUT.width} x ${DEFAULT_VERTICAL_OUTPUT.height}, single-frame vertical render (manual crop skipped).`
                            : `Output: ${DEFAULT_VERTICAL_OUTPUT.width} x ${DEFAULT_VERTICAL_OUTPUT.height}, top webcam strip + bottom full-frame stack.`}
                        </p>
                        <Button
                          type="button"
                          className="w-full gap-2 sm:w-auto"
                          disabled={!verticalSelectionReady || !!uploadingJobId || !!cropInteraction}
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
                <div className={`${isVerticalMode ? "aspect-[9/16] max-w-[360px] mx-auto" : "aspect-video"} bg-muted/30 flex items-center justify-center relative`}>
                  {showVideo ? (
                    <video
                      ref={previewVideoRef}
                      src={previewOutputUrl}
                      controls
                      onLoadedMetadata={handlePreviewLoadedMetadata}
                      onTimeUpdate={handlePreviewTimeUpdate}
                      onPause={handlePreviewPause}
                      onEnded={handlePreviewEnded}
                      onError={handlePreviewVideoError}
                      className={`w-full h-full ${isVerticalMode ? "object-contain bg-black" : "object-cover"}`}
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
                                ? activeJob.error === "queue_canceled_by_user"
                                  ? "Job canceled"
                                  : "Job failed"
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
                    <p className="text-sm font-medium text-foreground">Pipeline</p>
                    <p className="text-xs text-muted-foreground">Live status updates while your job runs</p>
                  </div>
                  {activeJob && (
                    <Badge variant="outline" className={`text-xs flex items-center gap-1.5 ${statusBadgeClass(activeJob.status)}`}>
                      {normalizeStatus(activeJob.status) === "ready" ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
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
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const active =
                          !step.comingSoon &&
                          currentStepIndex !== -1 &&
                          idx <= currentStepIndex &&
                          activeJob.status !== "failed";
                        return (
                          <Badge
                            key={step.key}
                            variant="secondary"
                            className={`border ${
                              step.comingSoon
                                ? "border-emerald-400/35 text-emerald-200 bg-emerald-500/10"
                                : active
                                ? "border-primary/30 text-primary bg-primary/10"
                                : "border-border/50 text-muted-foreground bg-muted/30"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {step.key === "zoom" ? <ZoomIn className="w-3 h-3" /> : null}
                              {step.label}
                              {step.comingSoon ? <span className="text-[10px] uppercase tracking-[0.12em]">Soon</span> : null}
                            </span>
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
                        {canCancelJob && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-fit h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={cancelingJobId === activeJob.id}
                            onClick={() => void handleCancelJob(activeJob.id)}
                          >
                            {cancelingJobId === activeJob.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                            )}
                            {cancelButtonLabel}
                          </Button>
                        )}
                      </div>
                    )}

                    {canShowRealtimeHookSelector && (
                      <div className="rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Hook Job</p>
                            <p className="text-xs text-muted-foreground">Pick the opening hook now. Changes apply in real time.</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            disabled={applyingHookJobId === activeJob.id}
                            onClick={() => setHookSelectorOpen(true)}
                          >
                            {applyingHookJobId === activeJob.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Select hook
                          </Button>
                        </div>
                        {selectedHookCandidate ? (
                          <p className="text-xs text-foreground/90">
                            Selected: {selectedHookCandidate.start.toFixed(1)}s - {(selectedHookCandidate.start + selectedHookCandidate.duration).toFixed(1)}s
                          </p>
                        ) : null}
                      </div>
                    )}

                    {normalizeStatus(activeJob.status) === "ready" && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-success flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {activeJob.renderMode === "vertical" && activeOutputUrls.length > 1
                            ? `Vertical clips are ready (${activeOutputUrls.length}).`
                            : "Export is ready. Download your final cut."}
                        </p>
                        <Button size="sm" className="w-full gap-2 sm:w-auto" onClick={() => setExportOpen(true)}>
                          <Download className="w-4 h-4" />
                          {activeJob.renderMode === "vertical" ? "Open Clips" : "Open Export"}
                        </Button>
                      </div>
                    )}

                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Retention Summary</p>
                      <p className="text-sm text-foreground break-words">
                        Hook chosen: {hookWindowLabel}
                        {hookText ? ` — ${hookText}` : ""}
                      </p>
                      {hookReason ? (
                        <p className="text-xs text-muted-foreground">Hook reason: {hookReason}</p>
                      ) : null}
                      {detectedNicheRaw ? (
                        <p className="text-xs text-muted-foreground">
                          Detected niche: {formatNicheLabel(detectedNicheRaw)}
                          {detectedNicheConfidencePercent !== null ? ` (${detectedNicheConfidencePercent}% confidence)` : ""}
                        </p>
                      ) : null}
                      {detectedNicheRationale.length > 0 ? (
                        <div className="space-y-1">
                          {detectedNicheRationale.map((line, index) => (
                            <p key={`niche-rationale-${index}`} className="text-xs text-muted-foreground">
                              - {line}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Hook selection: {hookSelectionSource === "user_selected" ? "User-selected" : hookSelectionSource === "fallback" ? "Fallback" : "Auto"}
                      </p>
                      {detectedRetentionStrategyProfile ? (
                        <p className="text-xs text-muted-foreground">
                          Retention profile: {formatNicheLabel(detectedRetentionStrategyProfile)}
                        </p>
                      ) : null}
                      {detectedRetentionContentFormat ? (
                        <p className="text-xs text-muted-foreground">
                          Content format: {formatNicheLabel(detectedRetentionContentFormat)}
                        </p>
                      ) : null}
                      {detectedRetentionTargetPlatform ? (
                        <p className="text-xs text-muted-foreground">
                          Target platform: {formatPlatformLabel(detectedRetentionTargetPlatform)}
                        </p>
                      ) : null}
                      <p className="text-sm text-foreground">
                        Retention score (after): {retentionScoreAfterDisplay !== null ? retentionScoreAfterDisplay : "Pending"}
                      </p>
                      {retentionScoreBeforeDisplay !== null ? (
                        <p className="text-xs text-muted-foreground">
                          Retention score (before edits): {retentionScoreBeforeDisplay}
                        </p>
                      ) : null}
                      {retentionScoreDeltaDisplay !== null ? (
                        <p className={`text-xs ${retentionScoreDeltaDisplay >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                          Delta: {retentionScoreDeltaDisplay > 0 ? "+" : ""}{retentionScoreDeltaDisplay.toFixed(1)}
                        </p>
                      ) : null}
                      {retentionImprovements.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">What the editor improved:</p>
                          {retentionImprovements.map((line, index) => (
                            <p key={`improve-${index}`} className="text-xs text-foreground/90">- {line}</p>
                          ))}
                        </div>
                      ) : null}
                      {whyKeepWatching.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Why this should keep viewers:</p>
                          {whyKeepWatching.map((line, index) => (
                            <p key={`why-${index}`} className="text-xs text-foreground/90">- {line}</p>
                          ))}
                        </div>
                      ) : null}
                      {normalizeStatus(activeJob.status) === "failed" && failedGateReason ? (
                        <div className="space-y-1">
                          <p className="text-xs text-destructive">
                            We refused to render because: {failedGateReason}
                          </p>
                          {genericReasons.length > 0 ? (
                            <div className="space-y-1">
                              {genericReasons.map((line, index) => (
                                <p key={`generic-${index}`} className="text-xs text-muted-foreground">- {line}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="space-y-1 pt-1">
                        <p className="text-xs text-muted-foreground">
                          Creator correction feedback {paidTier ? "" : "(paid plans only)"}:
                        </p>
                        {paidTier ? (
                          <div className="flex flex-wrap gap-1.5">
                            {CREATOR_FEEDBACK_ACTIONS.map((action) => (
                              <Button
                                key={action.category}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                disabled={creatorFeedbackSubmitting !== null || normalizeStatus(activeJob.status) !== "ready"}
                                onClick={() => void submitCreatorFeedback(action.category)}
                              >
                                {creatorFeedbackSubmitting === action.category ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : null}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            Upgrade to send hook/pacing/generic corrections directly to the model.
                          </p>
                        )}
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                          onClick={() => setShowAdvancedDebug((prev) => !prev)}
                        >
                          {showAdvancedDebug ? "Hide Advanced" : "Advanced"}
                        </button>
                      </div>
                      {showAdvancedDebug ? (
                        <div className="space-y-1 text-[11px] text-muted-foreground">
                          <p>Selected strategy: {String(activeAnalysis?.selected_strategy ?? pipelineJudgeMeta?.selectedStrategy ?? "n/a")}</p>
                          <p>Pattern interrupts: {String(activeAnalysis?.pattern_interrupt_count ?? "n/a")}</p>
                          <p>Interrupt density: {String(activeAnalysis?.pattern_interrupt_density ?? "n/a")}</p>
                          <p>Boredom removed ratio: {String(activeAnalysis?.boredom_removed_ratio ?? "n/a")}</p>
                          <p>Emotional beat cuts: {String(activeAnalysis?.emotional_beat_cut_count ?? "n/a")}</p>
                          <p>Emotional lead trimmed (s): {String(activeAnalysis?.emotional_lead_trimmed_seconds ?? "n/a")}</p>
                          <p className="break-all">
                            Emotional tuning:
                            {" "}
                            {activeAnalysis?.emotional_tuning_profile
                              ? JSON.stringify(activeAnalysis.emotional_tuning_profile)
                              : "n/a"}
                          </p>
                          <p>Editor engine: {String(activeAnalysis?.editor_engine_version ?? "n/a")}</p>
                          <p>Editor config: {String(activeAnalysis?.editor_config_version ?? "n/a")}</p>
                          <p>Attempts stored: {retentionAttempts.length}</p>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      <Dialog
        open={editorGuideOpen}
        onOpenChange={setEditorGuideOpen}
      >
        <DialogContent className="max-h-[85vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Editor Help Menu</DialogTitle>
            <DialogDescription>
              Quick guide to what each control does, how modes work, and where to review privacy and terms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">How It Works</p>
              <div className="mt-2 space-y-1 text-xs text-foreground/90">
                <p>1. Click <span className="font-medium">New Project</span> and upload your video.</p>
                <p>2. Pick render mode, retention profile, platform target, and caption settings.</p>
                <p>3. If shown, choose a hook in real time before render lock.</p>
                <p>4. Wait for <span className="font-medium">Ready</span> then open export and download.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Main Buttons</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="text-xs text-foreground/90"><span className="font-medium">New Project:</span> Upload and start a new edit job.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Horizontal / Vertical:</span> Choose original format or 9:16 short-form output.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Safe / Balanced / Viral:</span> Control pacing and retention aggression.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">TikTok / IG Reels / YouTube:</span> Tune editing defaults for platform behavior.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Captions on/off:</span> Toggle subtitle burn-in for new renders.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Edit captions:</span> Open style/preset controls.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Save captions:</span> Persist caption settings to your account.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Only Hook + Cut:</span> Minimal edit path focused on hook and dead-space cuts.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Show/Hide Jobs:</span> Toggle recent jobs panel.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Select hook:</span> Choose opening hook when real-time hook stage is active.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Create Vertical Clips:</span> Render ranked short clips in vertical mode.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Open Export / Open Clips:</span> Download final output files.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Modes</p>
              <div className="mt-2 space-y-2 text-xs text-foreground/90">
                <p><span className="font-medium">Horizontal (Original):</span> Keeps long-form framing and context for standard videos.</p>
                <p><span className="font-medium">Vertical (9:16):</span> Short-form clip mode with webcam crop and stacked composition options.</p>
                <p><span className="font-medium">Retention Profiles:</span> Safe = conservative, Balanced = adaptive default, Viral = fastest pacing (best for short-form).</p>
                <p><span className="font-medium">Platform Profiles:</span> Adjusts pacing, caption defaults, and export tuning for each social platform.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Privacy And Terms</p>
              <p className="mt-2 text-xs text-foreground/90">
                By using the editor, you agree to the service terms. Review how uploads and processing are handled in the privacy policy.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href="https://www.autoeditor.app/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Privacy Policy
                </a>
                <a
                  href="https://www.autoeditor.app/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={hookSelectorOpen && canShowRealtimeHookSelector}
        onOpenChange={setHookSelectorOpen}
      >
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Choose your opening hook</DialogTitle>
            <DialogDescription>
              Pick one of the top 3 hooks the editor found, preview it, then apply before render lock.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-2">
              <div className="rounded-xl border border-border/60 bg-black/80 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Hook preview</p>
                  {hookPreviewCandidate ? (
                    <p className="text-xs text-foreground/90">
                      {hookPreviewCandidate.start.toFixed(1)}s - {(hookPreviewCandidate.start + hookPreviewCandidate.duration).toFixed(1)}s
                    </p>
                  ) : null}
                </div>
                {hookPreviewSourceUrl ? (
                  <video
                    ref={hookPreviewVideoRef}
                    src={hookPreviewSourceUrl}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full rounded-lg bg-black"
                    onLoadedMetadata={handleHookPreviewLoadedMetadata}
                    onTimeUpdate={handleHookPreviewTimeUpdate}
                  />
                ) : hookPreviewLoading ? (
                  <div className="flex h-40 items-center justify-center gap-2 rounded-lg bg-muted/20 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading preview video...
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg bg-muted/20 px-4 text-center text-xs text-muted-foreground">
                    {hookPreviewError || "Preview not available yet."}
                  </div>
                )}
                {hookPreviewCandidate?.text ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{hookPreviewCandidate.text}</p>
                ) : null}
              </div>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {hookVariants.map((candidate, index) => {
                const end = candidate.start + candidate.duration;
                const isPreviewing = isSameHookCandidate(hookPreviewCandidate, candidate);
                const isApplied = isSameHookCandidate(selectedHookCandidate, candidate);
                return (
                  <button
                    key={`hook-dialog-option-${index}-${candidate.start.toFixed(3)}-${candidate.duration.toFixed(3)}`}
                    type="button"
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      isPreviewing
                        ? "border-primary/55 bg-primary/10 text-foreground"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40"
                    }`}
                    disabled={applyingHookJobId === activeJob?.id}
                    onClick={() => handleSelectHookPreviewCandidate(candidate)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        Option {index + 1}: {candidate.start.toFixed(1)}s - {end.toFixed(1)}s
                      </p>
                      {isApplied ? (
                        <span className="rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-primary">
                          Applied
                        </span>
                      ) : null}
                    </div>
                    {candidate.text ? <p className="mt-1 line-clamp-2">{candidate.text}</p> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setHookSelectorOpen(false)}>
              Done
            </Button>
            <Button
              size="sm"
              className="sm:min-w-[150px]"
              disabled={!hookPreviewCandidate || applyingHookJobId === activeJob?.id}
              onClick={() => {
                if (!hookPreviewCandidate) return;
                void handleApplyPreferredHookRealtime(hookPreviewCandidate);
              }}
            >
              {applyingHookJobId === activeJob?.id ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Use this hook
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={trialUpgradeOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissTrialUpgradePrompt();
            return;
          }
          setTrialUpgradeOpen(true);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Free trial ended</DialogTitle>
            <DialogDescription>
              {trialEndsAtLabel
                ? `Your trial ended on ${trialEndsAtLabel}. Upgrade now to keep premium editing tools unlocked.`
                : "Your trial ended. Upgrade now to keep premium editing tools unlocked."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">
                Trial features you used
              </p>
              <div className="space-y-1">
                {trialUnlockedFeatures.slice(0, 6).map((feature) => (
                  <p key={`ended-trial-${feature}`} className="text-xs text-foreground/90">
                    - {feature}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={dismissTrialUpgradePrompt}>
                Maybe later
              </Button>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto"
                onClick={handleUpgradeFromTrialPrompt}
              >
                Upgrade now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Export ready</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {activeJob?.renderMode === "vertical"
                ? "Choose quality and download each vertical clip."
                : "Choose your quality and download the final MP4."}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Export Quality</span>
                <span className="text-xs text-muted-foreground">Max: {maxQuality.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">{qualityButtons}</div>
            </div>
            {activeJob?.renderMode === "vertical" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Vertical Clips</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.max(1, activeOutputUrls.length || verticalClipCount) }).map((_, idx) => (
                    <Button
                      key={`clip-${idx + 1}`}
                      size="sm"
                      variant="secondary"
                      className="gap-2"
                      onClick={() => handleDownload(idx)}
                    >
                      <Download className="w-4 h-4" />
                      Clip {idx + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setExportOpen(false)}>
                Close
              </Button>
              <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto" onClick={() => handleDownload(0)}>
                <Download className="w-4 h-4" />
                {activeJob?.renderMode === "vertical" ? "Clip 1" : "Final MP4"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={autoDownloadModal.open} onOpenChange={(open) => setAutoDownloadModal({ open })}>
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Tap to download</DialogTitle>
            <p className="text-sm text-muted-foreground">Your render finished — tap the button below to download.</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">If the download doesn't start automatically, press the button below.</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setAutoDownloadModal({ open: false })}>Cancel</Button>
              <Button
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto"
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
                    if (autoDownloadModal.jobId) {
                      const modalJob =
                        activeJob && activeJob.id === autoDownloadModal.jobId
                          ? activeJob
                          : ({ id: autoDownloadModal.jobId, status: "ready", analysis: null } as JobDetail);
                      submitDownloadFeedback(modalJob, 0, "frontend_modal_download");
                      window.localStorage.setItem(`auto_downloaded_${autoDownloadModal.jobId}`, 'true');
                    }
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
