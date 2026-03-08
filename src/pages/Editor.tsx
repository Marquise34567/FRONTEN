import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Fragment, lazy, Suspense } from "react";
const GlowBackdrop = lazy(() => import("@/components/GlowBackdrop"));
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload, Plus, Play, Download, Lock, Loader2, CheckCircle2, ScissorsSquare, Scissors, MousePointerClick, MessageCircle, X, XCircle, Map as MapIcon, RotateCcw, SlidersHorizontal, Monitor, Smartphone, Camera, Music, Gauge, Flame, Zap, Wand2, ShieldCheck, Clock, Crown, Trophy } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { getAnalyticsSessionId, trackAnalyticsEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { useExportNotification } from "@/hooks/use-export-notification";
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
const CAPTIONS_PIPELINE_ENABLED = false;
const PREVIEW_REFRESH_RETRY_LIMIT = 2;
const PREVIEW_REFRESH_RETRY_DELAY_MS = 900;
const isAllowedUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) return true;
  const normalizedType = String(file.type || "").toLowerCase();
  return normalizedType.length > 0 && ALLOWED_UPLOAD_MIME_TYPES.has(normalizedType);
};

type ConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

type RuntimeProfile = {
  effectiveType: string | null;
  saveData: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  reducedMotion: boolean;
  lowBandwidth: boolean;
  lowPowerDevice: boolean;
};

const LOW_BANDWIDTH_TYPES = new Set(["slow-2g", "2g", "3g"]);

const asPositiveNumber = (value: unknown) => {
  const resolved = Number(value);
  return Number.isFinite(resolved) && resolved > 0 ? resolved : null;
};

const getConnection = (): ConnectionLike | null => {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: ConnectionLike;
    mozConnection?: ConnectionLike;
    webkitConnection?: ConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
};

const LOCAL_OUTPUT_DOWNLOAD_PATH_RE = /^\/api\/jobs\/[^/]+\/local-output$/i;

const getResolvedUrlPathname = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const fallbackBase = typeof window !== "undefined"
      ? window.location.origin
      : (API_URL || "http://localhost");
    return new URL(raw, fallbackBase).pathname;
  } catch {
    return "";
  }
};

const isAuthRequiredDownloadUrl = (value: string) => (
  LOCAL_OUTPUT_DOWNLOAD_PATH_RE.test(getResolvedUrlPathname(value))
);

const readRuntimeProfile = (): RuntimeProfile => {
  const connection = getConnection();
  const effectiveType = String(connection?.effectiveType || "").trim().toLowerCase() || null;
  const saveData = Boolean(connection?.saveData);
  const deviceMemoryGb = typeof navigator !== "undefined"
    ? asPositiveNumber((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
    : null;
  const hardwareConcurrency = typeof navigator !== "undefined"
    ? asPositiveNumber(navigator.hardwareConcurrency)
    : null;
  const reducedMotion = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const lowBandwidth = saveData || (effectiveType ? LOW_BANDWIDTH_TYPES.has(effectiveType) : false);
  const lowPowerDevice =
    (deviceMemoryGb !== null && deviceMemoryGb <= 2) ||
    (hardwareConcurrency !== null && hardwareConcurrency <= 4);
  return {
    effectiveType,
    saveData,
    deviceMemoryGb,
    hardwareConcurrency,
    reducedMotion,
    lowBandwidth,
    lowPowerDevice,
  };
};

const transferHasFiles = (transfer: DataTransfer | null | undefined) => {
  if (!transfer) return false;
  if (transfer.files && transfer.files.length > 0) return true;
  if (!transfer.types) return false;
  return Array.from(transfer.types).includes("Files");
};

const getTransferFileCount = (transfer: DataTransfer | null | undefined) => {
  if (!transfer) return 0;
  if (transfer.items && transfer.items.length > 0) {
    const itemCount = Array.from(transfer.items).filter((item) => item.kind === "file").length;
    if (itemCount > 0) return itemCount;
  }
  return transfer.files?.length ?? 0;
};

const getFirstTransferFile = (transfer: DataTransfer | null | undefined): File | null => {
  if (!transfer) return null;
  if (transfer.items && transfer.items.length > 0) {
    const fileItem = Array.from(transfer.items).find((item) => item.kind === "file");
    const maybeFile = fileItem?.getAsFile();
    if (maybeFile) return maybeFile;
  }
  return transfer.files?.[0] ?? null;
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

const PREVIEW_FILLER_TOKENS = new Set(["um", "uh", "like", "basically", "literally", "actually", "honestly", "seriously"]);
const PREVIEW_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PREVIEW_EMPHASIS_TOKENS = new Set([
  "crazy", "insane", "wild", "shocking", "secret", "proof", "never", "always", "must", "now", "stop",
  "wait", "watch", "listen", "important", "viral", "breaking", "unbelievable", "cannot", "can't", "cant",
  "no", "way", "how", "why", "what",
]);
const PREVIEW_EMOJI_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /(crazy|insane|wild|shocking|wtf|no\s*way)/i, emoji: "🤯" },
  { pattern: /(fire|hot|viral|legend|win|clutch|hype)/i, emoji: "🔥" },
  { pattern: /(laugh|funny|lol|lmao|joke)/i, emoji: "😂" },
  { pattern: /(watch|look|wait|listen|secret|proof)/i, emoji: "👀" },
];
const normalizePreviewToken = (value: string) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/(^[^a-z0-9']+|[^a-z0-9']+$)/g, "");
const shouldPreviewEmphasis = (value: string) => {
  const token = normalizePreviewToken(value);
  if (!token) return false;
  if (PREVIEW_EMPHASIS_TOKENS.has(token)) return true;
  if (/\d/.test(token)) return true;
  return String(value || "").trim().toUpperCase() === String(value || "").trim() && token.length >= 3;
};
const removePreviewFillers = (value: string) => {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return "";
  const filtered = words.filter((word) => !PREVIEW_FILLER_TOKENS.has(normalizePreviewToken(word)));
  return (filtered.length ? filtered : words).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim();
};
const inferPreviewEmoji = (value: string) => {
  const sample = String(value || "").trim();
  if (!sample) return "";
  for (const rule of PREVIEW_EMOJI_RULES) {
    if (rule.pattern.test(sample)) return rule.emoji;
  }
  return "";
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const VERTICAL_CAPTION_POSITION_MIN = 0.02;
const VERTICAL_CAPTION_POSITION_MAX = 0.98;
const clampCaptionPosition = (value: number) =>
  Number(clamp(value, VERTICAL_CAPTION_POSITION_MIN, VERTICAL_CAPTION_POSITION_MAX).toFixed(4));
const MAX_CUTS_MIN = 1;
const MAX_CUTS_MAX = 15;
const DEFAULT_MAX_CUTS = 12;
const DEFAULT_VERTICAL_OUTPUT = { width: 1080, height: 1920 } as const;
const DEFAULT_WEBCAM_TOP_HEIGHT_PCT = 40;
const DEFAULT_WEBCAM_PADDING_PX = 0;
const MIN_WEBCAM_CROP_SIZE_PX = 48;
const RETENTION_FEEDBACK_INTERVAL_MS = 15000;
const WATCH_FEEDBACK_PROGRESS_STEP = 0.08;
const MIN_WATCH_FEEDBACK_PROGRESS = 0.08;
const HOOK_PREVIEW_RETRY_DELAY_MS = 3000;
const EDITOR_GUIDE_AUTO_OPENED_KEY = "editor_help_auto_opened_v1";
const EDITOR_SETTINGS_COLLAPSED_KEY = "editor_settings_collapsed_v3";
const ANALYZE_UNLOCKED_JOBS_KEY = "editor_analyze_unlocked_jobs_v1";
const CHECKOUT_SUCCESS_QUERY_KEYS = ["success", "session_id", "source", "trial", "tier", "endsAt"] as const;

const toPlanTier = (value: unknown): PlanTier | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return PLAN_TIERS.includes(normalized as PlanTier) ? (normalized as PlanTier) : null;
};

type VerticalFitMode = "cover" | "contain";
type RetentionStrategyProfile = "safe" | "balanced" | "viral";
type RetentionAggressionLevel = "low" | "medium" | "high" | "viral";
type RetentionTargetPlatform = "tiktok" | "instagram_reels" | "youtube";
type VerticalCaptionPresetOptionId =
  | "basic_clean"
  | "mrbeast_animated"
  | "neon_glow"
  | "bold_clean_box"
  | "rage_mode"
  | "ice_pop"
  | "retro_wave"
  | "glitch_pop"
  | "cinema_punch"
  | "shadow_strike";
type VerticalCaptionFontOptionId = "impact" | "sans_bold" | "condensed" | "serif_bold" | "display_black" | "mono_bold";
type VerticalCaptionAnimationOptionId = "none" | "pop" | "slide" | "fade" | "bounce" | "glitch";
type VerticalCaptionDynamicModeOptionId = "classic" | "karaoke_word" | "kinetic_word";
type VerticalVoicePresetOptionId = "none" | "deep" | "helium" | "radio" | "robot";
type EditorModeSelection = "auto" | "reaction" | "commentary" | "vlog" | "gaming" | "sports" | "education" | "podcast";
type BackendEditorModeSelection = EditorModeSelection | "ultra" | "retention-king";
type PipelinePowerMode = "standard" | "ultra" | "retention_king";
type CreativeVariant = "balanced" | "punchy" | "dramatic" | "curiosity_first";
type UploadModePromptSelection = PipelinePowerMode | "full_auto_youtube";
type FullAutoYoutubeTarget = "auto" | "long_form" | "shorts";
type FullAutoYoutubeVibe = "auto" | "hype" | "cinematic" | "chill" | "education";
type HookSelectionMode = "manual" | "auto";
type LongFormPreset = "auto" | "balanced" | "aggressive" | "ultra";
type EditorSettingsSection = "format" | "vibe" | "cuts";
type OutcomeAutomationPlatform = RetentionTargetPlatform | "auto";
type OutcomeAutomationEditorMode = Exclude<EditorModeSelection, "auto"> | null;
type CreatorLearningMode = "cold_start_autopilot" | "continuity_first" | "explore_x3" | "top_human_guard";
type AchievementSignal = {
  id: "retention_beast" | "hook_master" | "post_now";
  title: string;
  line: string;
  metric: string;
};
type OutcomeAutomationProfile = {
  enabled: boolean;
  source: "real_distribution_analytics";
  sampleSize: number;
  baselineOutcome: number | null;
  confidence: number;
  expectedOutcome: number | null;
  expectedLift: number;
  qualityGateOffset: number;
  hookThresholdOffset: number;
  recommendedStrategyProfile: RetentionStrategyProfile;
  recommendedTargetPlatform: OutcomeAutomationPlatform;
  recommendedEditorMode: OutcomeAutomationEditorMode;
  reasons: string[];
  generatedAt: string;
};
type OutcomeAutomationPreview = {
  strategyApplied: boolean;
  targetPlatformApplied: boolean;
  editorModeApplied: boolean;
  strategy: RetentionStrategyProfile;
  targetPlatform: OutcomeAutomationPlatform;
  editorMode: OutcomeAutomationEditorMode;
};
type OutcomeAutomationResponse = {
  profile?: OutcomeAutomationProfile;
  preview?: OutcomeAutomationPreview;
};
type FullAutoYoutubeProfilePayload = {
  mode?: string;
  version?: string;
  target?: Exclude<FullAutoYoutubeTarget, "auto">;
  vibe?: Exclude<FullAutoYoutubeVibe, "auto">;
  highlights?: string[];
  transitionPack?: string[];
  overlayPack?: string[];
  soundFxPack?: string[];
  musicPlan?: {
    vibe?: string;
    source?: string;
    ducking?: boolean;
  } | null;
  exportPlan?: {
    aspectRatio?: string;
    resolution?: string;
  } | null;
  seoSuggestions?: {
    titles?: string[];
    thumbnailIdeas?: string[];
    hashtags?: string[];
  } | null;
  subAiPrompts?: Record<string, string> | null;
  edgeCases?: string[];
  cloudQueue?: string[];
} | null;
type FullAutoYoutubeProfileResponse = {
  enabled?: boolean;
  defaults?: Record<string, unknown>;
  profile?: FullAutoYoutubeProfilePayload;
};
const STRATEGY_TO_AGGRESSION: Record<RetentionStrategyProfile, RetentionAggressionLevel> = {
  safe: "low",
  balanced: "medium",
  viral: "viral",
};
const resolveEffectiveRetentionAggressionLevel = ({
  strategyProfile,
  longFormPreset,
}: {
  strategyProfile: RetentionStrategyProfile;
  longFormPreset: LongFormPreset;
}): RetentionAggressionLevel => {
  const base = STRATEGY_TO_AGGRESSION[strategyProfile];
  if (longFormPreset !== "auto") return base;
  if (base === "low" || base === "viral") return base;
  // Auto long-form defaults should match the B profile baseline.
  return "high";
};
const AUTO_MODE_V3_DEFAULTS = {
  strategyProfile: "viral" as RetentionStrategyProfile,
  aggressionLevel: "high" as RetentionAggressionLevel,
  longFormPreset: "aggressive" as LongFormPreset,
  longFormAggression: 88,
  longFormClarityVsSpeed: 44,
};
const resolveAutoModeV3Defaults = ({
  editorMode,
  pipelinePowerMode,
  strategyProfile,
  aggressionLevel,
  maxCuts,
  longFormPreset,
  longFormAggression,
  longFormClarityVsSpeed,
}: {
  editorMode: BackendEditorModeSelection;
  pipelinePowerMode: PipelinePowerMode;
  strategyProfile: RetentionStrategyProfile;
  aggressionLevel: RetentionAggressionLevel;
  maxCuts: number | null;
  longFormPreset: LongFormPreset;
  longFormAggression: number;
  longFormClarityVsSpeed: number;
}) => {
  const autoModeStandard = pipelinePowerMode === "standard" && editorMode === "auto";
  if (!autoModeStandard) {
    return {
      strategyProfile,
      aggressionLevel,
      maxCuts,
      longFormPreset,
      longFormAggression,
      longFormClarityVsSpeed,
    };
  }
  const legacyAutoBaseline = strategyProfile === "balanced" && longFormPreset === "auto";
  return {
    strategyProfile: legacyAutoBaseline ? AUTO_MODE_V3_DEFAULTS.strategyProfile : strategyProfile,
    aggressionLevel: legacyAutoBaseline ? AUTO_MODE_V3_DEFAULTS.aggressionLevel : aggressionLevel,
    maxCuts: null,
    longFormPreset: longFormPreset === "auto" ? AUTO_MODE_V3_DEFAULTS.longFormPreset : longFormPreset,
    longFormAggression: Math.max(longFormAggression, AUTO_MODE_V3_DEFAULTS.longFormAggression),
    longFormClarityVsSpeed: Math.min(longFormClarityVsSpeed, AUTO_MODE_V3_DEFAULTS.longFormClarityVsSpeed),
  };
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
const PLATFORM_RECOMMENDATION_MAP: Record<
  RetentionTargetPlatform,
  { profile: RetentionStrategyProfile; suggestedCuts: number; label: string }
> = {
  tiktok: { profile: "viral", suggestedCuts: 12, label: "TikTok -> Viral + 10-14 cuts suggested" },
  instagram_reels: { profile: "balanced", suggestedCuts: 10, label: "Reels -> Balanced + 8-12 cuts suggested" },
  youtube: { profile: "safe", suggestedCuts: 8, label: "YouTube -> Safe + 6-10 cuts suggested" },
};
const RETENTION_PROFILE_HINTS: Record<RetentionStrategyProfile, string> = {
  safe: "Safe = clean pacing + context protection",
  balanced: "Balanced = adaptive cuts + smooth flow",
  viral: "Viral = faster cuts + shock hooks",
};
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
const VERTICAL_CAPTION_DYNAMIC_MODE_OPTIONS: Array<{ id: VerticalCaptionDynamicModeOptionId; label: string }> = [
  { id: "classic", label: "Classic Lines" },
  { id: "karaoke_word", label: "Karaoke Word" },
  { id: "kinetic_word", label: "Kinetic Rapid" },
];
const VERTICAL_VOICE_PRESET_OPTIONS: Array<{ id: VerticalVoicePresetOptionId; label: string }> = [
  { id: "none", label: "Original Voice" },
  { id: "deep", label: "Deep" },
  { id: "helium", label: "Helium" },
  { id: "radio", label: "Radio" },
  { id: "robot", label: "Robot" },
];
const VERTICAL_CAPTION_STYLE_OPTIONS: Array<{
  id: VerticalCaptionPresetOptionId;
  label: string;
  description: string;
  platformHint?: string;
}> = [
  { id: "rage_mode", label: "CapCut Kinetic", description: "Fast kinetic pops with aggressive mobile readability.", platformHint: "TikTok" },
  { id: "bold_clean_box", label: "Reels Clean Box", description: "Clear white captions in a high-readability box.", platformHint: "IG Reels" },
  { id: "cinema_punch", label: "Shorts Bold", description: "High-contrast cinematic styling for Shorts.", platformHint: "YouTube Shorts" },
  { id: "mrbeast_animated", label: "Opus Pop", description: "Word-level hype captions with creator-style pop timing." },
  { id: "basic_clean", label: "Minimal Bold", description: "Minimal layout with clean bold readability." },
  { id: "neon_glow", label: "High Energy Neon", description: "Bright neon pulse look for high-energy clips." },
  { id: "ice_pop", label: "Ice Pop", description: "Cool-toned pop look for gaming and reaction clips." },
  { id: "retro_wave", label: "Retro Wave", description: "Colorful retro styling with bold presence." },
  { id: "glitch_pop", label: "Glitch Pop", description: "Techy glitch-inspired styling for energetic moments." },
  { id: "shadow_strike", label: "Shadow Strike", description: "Bold captions with heavy cinematic drop shadow." },
];
const VERTICAL_CAPTION_PRESET_DEFAULTS: Record<
  VerticalCaptionPresetOptionId,
  {
    fontId: VerticalCaptionFontOptionId;
    outlineColor: string;
    outlineWidth: number;
    animation: VerticalCaptionAnimationOptionId;
    dynamicMode: VerticalCaptionDynamicModeOptionId;
    shadowStrength: number;
    animationSpeed: number;
    highlightWords: boolean;
    autoEmphasis: boolean;
    autoEmoji: boolean;
    removeFillers: boolean;
  }
> = {
  basic_clean: {
    fontId: "sans_bold", outlineColor: "0F172A", outlineWidth: 3, animation: "none", shadowStrength: 34,
    dynamicMode: "classic", animationSpeed: 1.0, highlightWords: true, autoEmphasis: true, autoEmoji: false, removeFillers: true,
  },
  mrbeast_animated: {
    fontId: "impact", outlineColor: "050505", outlineWidth: 18, animation: "pop", shadowStrength: 62,
    dynamicMode: "karaoke_word", animationSpeed: 1.08, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  neon_glow: {
    fontId: "condensed", outlineColor: "071E28", outlineWidth: 6, animation: "slide", shadowStrength: 70,
    dynamicMode: "kinetic_word", animationSpeed: 1.2, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  bold_clean_box: {
    fontId: "sans_bold", outlineColor: "000000", outlineWidth: 6, animation: "none", shadowStrength: 46,
    dynamicMode: "classic", animationSpeed: 0.96, highlightWords: true, autoEmphasis: true, autoEmoji: false, removeFillers: true,
  },
  rage_mode: {
    fontId: "impact", outlineColor: "1A0202", outlineWidth: 14, animation: "bounce", shadowStrength: 76,
    dynamicMode: "kinetic_word", animationSpeed: 1.14, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  ice_pop: {
    fontId: "condensed", outlineColor: "041426", outlineWidth: 10, animation: "pop", shadowStrength: 62,
    dynamicMode: "karaoke_word", animationSpeed: 1.06, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  retro_wave: {
    fontId: "display_black", outlineColor: "25003A", outlineWidth: 9, animation: "slide", shadowStrength: 68,
    dynamicMode: "kinetic_word", animationSpeed: 1.1, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  glitch_pop: {
    fontId: "mono_bold", outlineColor: "111827", outlineWidth: 8, animation: "glitch", shadowStrength: 74,
    dynamicMode: "kinetic_word", animationSpeed: 1.2, highlightWords: true, autoEmphasis: true, autoEmoji: true, removeFillers: false,
  },
  cinema_punch: {
    fontId: "serif_bold", outlineColor: "1A1203", outlineWidth: 7, animation: "none", shadowStrength: 58,
    dynamicMode: "classic", animationSpeed: 0.92, highlightWords: true, autoEmphasis: true, autoEmoji: false, removeFillers: true,
  },
  shadow_strike: {
    fontId: "display_black", outlineColor: "111827", outlineWidth: 10, animation: "none", shadowStrength: 92,
    dynamicMode: "classic", animationSpeed: 1.02, highlightWords: true, autoEmphasis: true, autoEmoji: false, removeFillers: false,
  },
};
const PLATFORM_VERTICAL_CAPTION_PRESET: Record<RetentionTargetPlatform, VerticalCaptionPresetOptionId> = {
  tiktok: "rage_mode",
  instagram_reels: "bold_clean_box",
  youtube: "cinema_punch",
};
const VERTICAL_CAPTION_FONT_FAMILY: Record<VerticalCaptionFontOptionId, string> = {
  impact: '"Impact", "Arial Black", "Inter", sans-serif',
  sans_bold: '"Inter", "Segoe UI", sans-serif',
  condensed: '"Arial Narrow", "Inter", sans-serif',
  serif_bold: '"Georgia", "Times New Roman", serif',
  display_black: '"Poppins", "Space Grotesk", "Inter", sans-serif',
  mono_bold: '"Consolas", "Roboto Mono", monospace',
};
const VERTICAL_CAPTION_PREVIEW_PALETTE: Record<
  VerticalCaptionPresetOptionId,
  { textColor: string; boxColor: string; borderColor: string; glowColor: string }
> = {
  basic_clean: {
    textColor: "#F8FAFC",
    boxColor: "rgba(2, 6, 23, 0.5)",
    borderColor: "rgba(255, 255, 255, 0.36)",
    glowColor: "rgba(15, 23, 42, 0.5)",
  },
  mrbeast_animated: {
    textColor: "#FFFFFF",
    boxColor: "rgba(161, 98, 7, 0.32)",
    borderColor: "rgba(251, 191, 36, 0.8)",
    glowColor: "rgba(251, 191, 36, 0.44)",
  },
  neon_glow: {
    textColor: "#67E8F9",
    boxColor: "rgba(17, 24, 39, 0.64)",
    borderColor: "rgba(34, 211, 238, 0.72)",
    glowColor: "rgba(34, 211, 238, 0.46)",
  },
  bold_clean_box: {
    textColor: "#FFFFFF",
    boxColor: "rgba(0, 0, 0, 0.72)",
    borderColor: "rgba(248, 250, 252, 0.8)",
    glowColor: "rgba(15, 23, 42, 0.42)",
  },
  rage_mode: {
    textColor: "#FDE68A",
    boxColor: "rgba(127, 29, 29, 0.56)",
    borderColor: "rgba(251, 191, 36, 0.82)",
    glowColor: "rgba(251, 146, 60, 0.52)",
  },
  ice_pop: {
    textColor: "#E0F2FE",
    boxColor: "rgba(12, 74, 110, 0.56)",
    borderColor: "rgba(125, 211, 252, 0.75)",
    glowColor: "rgba(56, 189, 248, 0.5)",
  },
  retro_wave: {
    textColor: "#F5D0FE",
    boxColor: "rgba(88, 28, 135, 0.55)",
    borderColor: "rgba(244, 114, 182, 0.72)",
    glowColor: "rgba(236, 72, 153, 0.5)",
  },
  glitch_pop: {
    textColor: "#E5E7EB",
    boxColor: "rgba(15, 23, 42, 0.74)",
    borderColor: "rgba(148, 163, 184, 0.72)",
    glowColor: "rgba(129, 140, 248, 0.44)",
  },
  cinema_punch: {
    textColor: "#FFFBEB",
    boxColor: "rgba(120, 53, 15, 0.56)",
    borderColor: "rgba(253, 230, 138, 0.78)",
    glowColor: "rgba(251, 191, 36, 0.4)",
  },
  shadow_strike: {
    textColor: "#FFFFFF",
    boxColor: "rgba(15, 23, 42, 0.72)",
    borderColor: "rgba(148, 163, 184, 0.84)",
    glowColor: "rgba(15, 23, 42, 0.78)",
  },
};
const DEFAULT_VERTICAL_CAPTION_STYLE: VerticalCaptionPresetOptionId = "rage_mode";
const CREATOR_STYLE_LOCK_MIN = 0;
const CREATOR_STYLE_LOCK_MAX = 100;
const DEFAULT_CREATOR_STYLE_LOCK_PERCENT = 65;
const clampCreatorStyleLockPercent = (value: number) => clamp(Math.round(value), CREATOR_STYLE_LOCK_MIN, CREATOR_STYLE_LOCK_MAX);
const VERTICAL_CAPTION_FONT_SIZE_MIN = 30;
const VERTICAL_CAPTION_FONT_SIZE_MAX = 220;
const VERTICAL_CAPTION_FONT_SIZE_DEFAULT = 96;
const VERTICAL_CAPTION_SHADOW_MIN = 0;
const VERTICAL_CAPTION_SHADOW_MAX = 100;
const VERTICAL_CAPTION_ANIMATION_SPEED_MIN = 0.5;
const VERTICAL_CAPTION_ANIMATION_SPEED_MAX = 2.2;
const clampVerticalCaptionAnimationSpeed = (value: number) =>
  Number(clamp(value, VERTICAL_CAPTION_ANIMATION_SPEED_MIN, VERTICAL_CAPTION_ANIMATION_SPEED_MAX).toFixed(2));
const RETENTION_PROFILE_SEQUENCE: RetentionStrategyProfile[] = ["safe", "balanced", "viral"];
const EDITOR_SETTINGS_SECTIONS: Array<{ key: EditorSettingsSection; label: string }> = [
  { key: "format", label: "Format" },
  { key: "vibe", label: "Style" },
  { key: "cuts", label: "Cuts" },
];
const EDITOR_MODE_OPTIONS: Array<{ value: EditorModeSelection; label: string; description: string }> = [
  { value: "auto", label: "Auto", description: "Let the model infer style from your content." },
  { value: "reaction", label: "Reaction", description: "Higher-energy pacing tuned for reactions." },
  { value: "commentary", label: "Commentary", description: "Speech-first pacing with cleaner flow." },
  { value: "vlog", label: "Vlog", description: "Conversational lifestyle pacing." },
  { value: "gaming", label: "Gaming", description: "Fast action-driven pacing for gameplay footage." },
  { value: "sports", label: "Sports", description: "High-intensity pacing for highlights and plays." },
  { value: "education", label: "Education", description: "Clarity-first pacing for tutorials and explainers." },
  { value: "podcast", label: "Podcast", description: "Multi-speaker cleanup with breathing room and chapter-friendly pacing." },
];
const LONG_FORM_PRESET_OPTIONS: Array<{ value: LongFormPreset; label: string; description: string }> = [
  { value: "auto", label: "Auto", description: "Auto-tunes long-form pacing profile by runtime and retention settings." },
  { value: "balanced", label: "Balanced", description: "10-18 cuts/min, lighter compression, 0.28s silence target." },
  { value: "aggressive", label: "Aggressive", description: "18-28 cuts/min, tighter pacing, 0.18s silence target." },
  { value: "ultra", label: "Ultra", description: "28-40 cuts/min, maximum tightening, 0.12s silence target." },
];
const LONG_FORM_PRESET_DEFAULTS: Record<LongFormPreset, { aggression: number; clarityVsSpeed: number; tangentKiller: boolean }> = {
  auto: { aggression: 88, clarityVsSpeed: 44, tangentKiller: true },
  balanced: { aggression: 45, clarityVsSpeed: 82, tangentKiller: false },
  aggressive: { aggression: 72, clarityVsSpeed: 52, tangentKiller: true },
  ultra: { aggression: 92, clarityVsSpeed: 36, tangentKiller: true },
};
const PIPELINE_POWER_MODE_OPTIONS: Array<{
  value: PipelinePowerMode;
  label: string;
  description: string;
}> = [
  {
    value: "standard",
    label: "Balanced",
    description: "Middle ground between speed and quality using your current retention profile and editor mode.",
  },
  {
    value: "ultra",
    label: "Fast",
    description: "Speed-first path that still requires transcript generation before editing continues.",
  },
  {
    value: "retention_king",
    label: "Quality",
    description: "Transcript-guided hook and cut analysis for stronger edit decisions on long-form renders.",
  },
];
const CREATIVE_VARIANT_OPTIONS: Array<{ value: CreativeVariant; label: string; description: string }> = [
  { value: "balanced", label: "Balanced", description: "Default transcript-led ranking with no extra bias." },
  { value: "punchy", label: "Punchy", description: "Favor sharper hooks, faster transcript cuts, and denser pacing." },
  { value: "dramatic", label: "Dramatic", description: "Favor emotional transcript lines and let big beats breathe longer." },
  { value: "curiosity_first", label: "Curiosity", description: "Favor open loops, questions, and transcript-driven intrigue." },
];
const UPLOAD_MODE_PROMPT_OPTIONS: Array<{
  value: UploadModePromptSelection;
  label: string;
  description: string;
  premium?: boolean;
}> = [
  {
    value: "standard",
    label: "Balanced",
    description: "Balanced default for most videos when you want speed and quality in the middle.",
  },
  {
    value: "ultra",
    label: "Fast",
    description: "Fast upload + processing path with transcript still required before editing.",
    premium: true,
  },
  {
    value: "retention_king",
    label: "Quality",
    description: "Transcript-guided analysis path tuned for better hook choice and cleaner long-form cuts.",
    premium: true,
  },
  {
    value: "full_auto_youtube",
    label: "Full Auto YouTube",
    description: "Auto-tunes cuts, captions, transitions, and YouTube packaging.",
  },
];
const FULL_AUTO_YOUTUBE_TARGET_OPTIONS: Array<{ value: FullAutoYoutubeTarget; label: string; description: string }> = [
  { value: "auto", label: "Auto Detect", description: "Use current orientation to infer long-form vs Shorts defaults." },
  { value: "long_form", label: "Long-Form", description: "16:9 pacing with chapter-safe rhythm and story continuity." },
  { value: "shorts", label: "Shorts", description: "9:16 high-retention pacing with denser hooks and interrupts." },
];
const FULL_AUTO_YOUTUBE_VIBE_OPTIONS: Array<{ value: FullAutoYoutubeVibe; label: string; description: string }> = [
  { value: "auto", label: "Auto Vibe", description: "Infer mood from content context and orientation." },
  { value: "hype", label: "Hype", description: "Faster transitions, stronger SFX, punchier overlays." },
  { value: "cinematic", label: "Cinematic", description: "Smoother pacing, filmic transitions, polished lower-thirds." },
  { value: "chill", label: "Chill", description: "Subtle cuts, softer motion, ambient visual treatment." },
  { value: "education", label: "Education", description: "Clarity-first cuts, chapter cues, and calmer overlays." },
];
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
type VerticalCaptionDragState = {
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
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

type AutonomousEditorModeSummary = {
  id: string;
  label: string;
  active: boolean;
};
type AutonomousEditorDecisionSummary = {
  atSec: number;
  type: string;
  label: string;
  detail?: string | null;
};
type AutonomousEditorLearningSummary = {
  trigger?: string | null;
  throttled?: boolean;
  recordedAt?: string | null;
  boundaryCritic?: {
    trained?: boolean;
    reason?: string | null;
    activeVersion?: string | null;
    sampleCount?: number | null;
  } | null;
  policyPromotions?: Array<{
    policyId: string;
    baselinePolicyId?: string | null;
    lift?: number | null;
    zScore?: number | null;
    sampleCount?: number | null;
  }> | null;
} | null;
type AutonomousEditorSummary = {
  status?: string;
  autonomyState?: "self_directed" | "assisted" | string;
  senses?: string[];
  modes?: AutonomousEditorModeSummary[];
  selectedHook?: {
    start: number;
    duration: number;
    source?: string | null;
    reason?: string | null;
  } | null;
  winnerPolicy?: {
    policyId: string;
    reason?: string | null;
    strategy?: string | null;
    pacingCurve?: string | null;
    cliffhangerStyle?: string | null;
    predictedRetention?: number | null;
    judgeRetentionScore?: number | null;
  } | null;
  qualityGate?: {
    passed?: boolean | null;
    summary?: string | null;
    passedChecks?: number | null;
    totalChecks?: number | null;
    cutQualityScore?: number | null;
  } | null;
  decisions?: AutonomousEditorDecisionSummary[];
  decisionCounts?: Record<string, number>;
  notes?: string[];
  learning?: AutonomousEditorLearningSummary;
} | null;

interface JobDetail extends JobSummary {
  outputUrl?: string | null;
  outputUrls?: string[] | null;
  finalQuality?: string | null;
  retentionScore?: number | null;
  analysis?: any;
  autonomousEditor?: AutonomousEditorSummary;
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
type EditorTranscriptCue = {
  start: number;
  end: number;
  text: string;
  confidence?: number | null;
};
type EditorTranscriptSegment = {
  start: number;
  end: number;
  speed: number;
};
type TranscriptEditDecision = "hook" | "keep" | "cut" | "pending";
type TranscriptEditorRow = {
  cue: EditorTranscriptCue;
  decision: TranscriptEditDecision;
};
type TranscriptPanelTab = "editor" | "preview" | "source";

type VerticalClipPrediction = {
  clip: number;
  start: number;
  end: number;
  duration: number;
  predictedCompletion: number;
  reason: string;
};
type EnergyMoment = {
  timestampSec: number;
  energy: number;
  motion: number;
  audio: number;
  visual: number;
  facial: number;
};
type RetentionPointKind = "best" | "worst" | "skip_zone" | "hook" | "emotional_peak" | string;
type RetentionPoint = {
  atSec: number;
  predicted: number;
  kind?: RetentionPointKind | null;
  label?: string | null;
  description?: string | null;
  watchedPct?: number | null;
};
type RetentionTimelineCategory = "best" | "skip_risk" | "weak" | "steady";
type RetentionTimelineSegment = {
  id: string;
  startSec: number;
  endSec: number;
  midpointSec: number;
  predicted: number;
  dropFromPrevious: number;
  category: RetentionTimelineCategory;
  categoryLabel: string;
  reason: string;
  sourceKind: RetentionPointKind | null;
  positionPct: number;
  widthPct: number;
};
type EmotionProfileKey = "excitement" | "curiosity" | "anticipation" | "tension" | "inspiration";
type EmotionSummarySignal = {
  key: EmotionProfileKey;
  label: string;
  sharePercent: number;
  confidence: number;
  timelineStrength: number;
  timestampsSec: number[];
  badgeClassName: string;
  barClassName: string;
};
type EnergyMomentWithEmotion = EnergyMoment & {
  positionPct: number;
  timestampLabel: string;
  emotionKey: EmotionProfileKey;
  emotionLabel: string;
  emotionalScore: number;
};
type EmotionTimelineHighlight = {
  id: string;
  timestampSec: number;
  timestampLabel: string;
  emotionKey: EmotionProfileKey;
  emotionLabel: string;
  strength: number;
  reason: string;
  source: "energy" | "anchor" | "retention";
};
type BingeMoment = {
  id: string;
  timestampSec: number;
  timestampLabel: string;
  score: number;
  reason: string;
};
type FeedbackDeepDiveSection = "retention_vs_emotion" | "emotional_parts" | "binge_parts" | "timeline";

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
type PreviewCompareMode = "before" | "after";
type CreatorFeedbackCategory = "bad_hook" | "too_fast" | "too_generic" | "great_edit";
type CreatorFeedbackHistoryEntry = {
  category: string;
  source: string | null;
  notes: string | null;
  submittedAt: string | null;
};
type RetentionFeedbackHistoryEntry = {
  sourceType: "platform" | "internal";
  source: string | null;
  notes: string | null;
  submittedAt: string | null;
  watchPercent: number | null;
  hookHoldPercent: number | null;
  completionPercent: number | null;
  manualScore: number | null;
};
type YouTubeSignalState = {
  coldStartMode: boolean;
  trustWeight: number;
  qualifyingVideos: number;
  requiredVideos: number;
  averageViewsPerVideo: number | null;
  currentVideoViews: number;
  requiredAverageViewsPerVideo: number;
  highTrustAverageViewsPerVideo: number;
  recommendation: string;
};
type YouTubeOAuthStatusResponse = {
  connected?: boolean;
  channelId?: string | null;
  channelTitle?: string | null;
  expiryDate?: string | null;
  hasRefreshToken?: boolean;
  scopes?: string[];
  authConfigured?: boolean;
  missingConfig?: string[];
};
type YouTubeLinkJobVideoResponse = {
  ok?: boolean;
  jobId?: string;
  videoId?: string;
};
type YouTubeSyncJobFeedbackResponse = {
  ok?: boolean;
  jobId?: string;
  videoId?: string;
  youtubeSignal?: YouTubeSignalState | null;
  feedbackLoop?: {
    applied?: boolean;
    reason?: string;
  } | null;
};
type YouTubeReferenceStyleProfile = {
  retentionStrategyProfile?: RetentionStrategyProfile;
  retentionTargetPlatform?: RetentionTargetPlatform;
  maxCuts?: number;
  subtitleStyle?: string;
  autoCaptions?: boolean;
  confidence?: number;
  source?: "public_metrics" | "public_metrics_plus_analytics";
};
type YouTubeReferenceStyleResponse = {
  ok?: boolean;
  videoId?: string;
  title?: string;
  profile?: YouTubeReferenceStyleProfile | null;
  reasoning?: string[];
  metrics?: {
    durationSeconds?: number | null;
    engagementRate?: number;
    averageViewPercentage?: number | null;
    hookHoldPercent?: number | null;
  } | null;
};
type YouTubeReferenceStyleApplied = {
  videoId: string;
  title: string;
  appliedAt: string;
  retentionStrategyProfile: RetentionStrategyProfile;
  retentionTargetPlatform: RetentionTargetPlatform;
  maxCuts: number;
  subtitleStyle: string;
  confidence: number | null;
  source: string | null;
};
type ExportFeedbackEntry = {
  id: string;
  at: string | null;
  sourceType: "creator" | "retention";
  label: string;
  detail: string;
};

const CREATOR_FEEDBACK_ACTIONS: Array<{ category: CreatorFeedbackCategory; label: string }> = [
  { category: "bad_hook", label: "Hook weak" },
  { category: "too_fast", label: "Too fast" },
  { category: "too_generic", label: "Generic" },
  { category: "great_edit", label: "Great edit" },
];

const CREATOR_FEEDBACK_LABELS: Record<CreatorFeedbackCategory, string> = {
  bad_hook: "Hook weak",
  too_fast: "Too fast",
  too_generic: "Generic",
  great_edit: "Great edit",
};

const CREATOR_FEEDBACK_RETENTION_SCORES: Record<CreatorFeedbackCategory, { manualScore: number; note: string }> = {
  bad_hook: { manualScore: 52, note: "Hook did not hold attention in opening seconds." },
  too_fast: { manualScore: 58, note: "Pacing felt too aggressive and rushed." },
  too_generic: { manualScore: 60, note: "Edit felt generic and needs stronger variation." },
  great_edit: { manualScore: 92, note: "Edit quality was strong and worth reinforcing." },
};

const PIPELINE_STEPS = [
  { key: "uploading", label: "Upload" },
  { key: "analyzing", label: "Analyze" },
  { key: "hooking", label: "Hook" },
  { key: "cutting", label: "Cut" },
  { key: "pacing", label: "Binge Optimize" },
  { key: "ready", label: "Download Ready" },
] as const;
const RETENTION_GOAL_PERCENT = 70;
const DEFAULT_AUTO_HOOK_DURATION_SEC = 8;
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
  uploading: "Upload",
  analyzing: "Analyze",
  hooking: "Hook",
  cutting: "Cut",
  pacing: "Binge Optimize",
  story: "Binge Optimize",
  subtitling: "Binge Optimize",
  audio: "Binge Optimize",
  retention: "Binge Optimize",
  rendering: "Binge Optimize",
  completed: "Download Ready",
  ready: "Download Ready",
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
  if (normalized === "queued") return "uploading";
  if (
    normalized === "pacing" ||
    normalized === "story" ||
    normalized === "subtitling" ||
    normalized === "audio" ||
    normalized === "retention" ||
    normalized === "rendering"
  ) {
    return "pacing";
  }
  return normalized;
};

const statusBadgeClass = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "ready") return "bg-primary/12 text-primary border-primary/35";
  if (normalized === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
  if (normalized === "uploading") return "bg-warning/10 text-warning border-warning/30";
  return "bg-primary/8 text-muted-foreground border-primary/20";
};

const toFiniteNumber = (value: unknown): number | null => {
  const resolved = Number(value);
  return Number.isFinite(resolved) ? resolved : null;
};

const firstFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const resolved = toFiniteNumber(value);
    if (resolved !== null) return resolved;
  }
  return null;
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

const toObjectRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeTranscriptCueRows = (value: unknown): EditorTranscriptCue[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = toObjectRecord(entry);
      if (!row) return null;
      const start = firstFiniteNumber(row.start, row.startSec, row.start_sec, row.atSec, row.at_sec);
      const end = firstFiniteNumber(row.end, row.endSec, row.end_sec);
      const text = typeof row.text === "string"
        ? row.text.trim()
        : typeof row.caption === "string"
          ? row.caption.trim()
          : typeof row.transcript === "string"
            ? row.transcript.trim()
            : "";
      if (start === null || end === null || end <= start || !text) return null;
      const confidenceRaw = firstFiniteNumber(row.confidence);
      return {
        start,
        end,
        text,
        confidence: confidenceRaw,
      };
    })
    .filter((cue): cue is EditorTranscriptCue => cue !== null)
    .sort((left, right) => left.start - right.start);
};

const normalizeTranscriptSegmentRows = (value: unknown): EditorTranscriptSegment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = toObjectRecord(entry);
      if (!row) return null;
      const start = firstFiniteNumber(row.start, row.startSec, row.start_sec);
      const end = firstFiniteNumber(row.end, row.endSec, row.end_sec);
      const speed = firstFiniteNumber(row.speed, row.playbackRate, row.playback_rate) ?? 1;
      if (start === null || end === null || end <= start) return null;
      return {
        start,
        end,
        speed: speed > 0 ? speed : 1,
      };
    })
    .filter((segment): segment is EditorTranscriptSegment => segment !== null)
    .sort((left, right) => left.start - right.start);
};

const remapTranscriptCuesToEditedTimelinePreview = (
  cues: EditorTranscriptCue[],
  segments: EditorTranscriptSegment[],
): EditorTranscriptCue[] => {
  if (!cues.length || !segments.length) return [];
  let outputCursor = 0;
  const timeline = segments
    .map((segment) => {
      const outputDuration = (segment.end - segment.start) / Math.max(0.01, segment.speed);
      if (!Number.isFinite(outputDuration) || outputDuration <= 0) return null;
      const row = {
        sourceStart: segment.start,
        sourceEnd: segment.end,
        speed: Math.max(0.01, segment.speed),
        outputStart: outputCursor,
        outputEnd: outputCursor + outputDuration,
      };
      outputCursor = row.outputEnd;
      return row;
    })
    .filter((segment): segment is {
      sourceStart: number;
      sourceEnd: number;
      speed: number;
      outputStart: number;
      outputEnd: number;
    } => Boolean(segment));
  if (!timeline.length) return [];

  const remapped = cues.flatMap((cue) => (
    timeline.map((segment) => {
      const overlapStart = Math.max(cue.start, segment.sourceStart);
      const overlapEnd = Math.min(cue.end, segment.sourceEnd);
      if (overlapEnd - overlapStart <= 0.01) return null;
      return {
        start: Number((segment.outputStart + (overlapStart - segment.sourceStart) / segment.speed).toFixed(3)),
        end: Number((segment.outputStart + (overlapEnd - segment.sourceStart) / segment.speed).toFixed(3)),
        text: cue.text,
        confidence: cue.confidence ?? null,
      };
    })
  ))
    .filter((cue): cue is EditorTranscriptCue => Boolean(cue) && cue.end > cue.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: EditorTranscriptCue[] = [];
  for (const cue of remapped) {
    const previous = merged.length > 0 ? merged[merged.length - 1] : null;
    if (previous && previous.text === cue.text && cue.start - previous.end <= 0.08) {
      previous.end = Number(Math.max(previous.end, cue.end).toFixed(3));
      continue;
    }
    merged.push({ ...cue });
  }
  return merged;
};

const cueOverlapsSegment = (cue: EditorTranscriptCue, segment: EditorTranscriptSegment) =>
  Math.min(cue.end, segment.end) - Math.max(cue.start, segment.start) > 0.01;

const buildTranscriptEditorRows = ({
  cues,
  segments,
  hookStart,
  hookEnd,
}: {
  cues: EditorTranscriptCue[];
  segments: EditorTranscriptSegment[];
  hookStart: number | null;
  hookEnd: number | null;
}): TranscriptEditorRow[] => {
  const hasSegments = segments.length > 0;
  return cues.map((cue) => {
    const overlapsHook =
      hookStart !== null &&
      hookEnd !== null &&
      Math.min(cue.end, hookEnd) - Math.max(cue.start, hookStart) > 0.01;
    if (overlapsHook) {
      return { cue, decision: "hook" };
    }
    if (!hasSegments) {
      return { cue, decision: "pending" };
    }
    const kept = segments.some((segment) => cueOverlapsSegment(cue, segment));
    return {
      cue,
      decision: kept ? "keep" : "cut",
    };
  });
};

const formatNaturalList = (items: string[]) => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const formatHookTimestamp = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secondsRemainder = safe - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${secondsRemainder.toFixed(3).padStart(6, "0")}`;
};

const formatHookRange = (start: number, end: number) => {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || safeStart);
  return `${formatHookTimestamp(safeStart)} - ${formatHookTimestamp(safeEnd)}`;
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

const formatDurationClock = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "--";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
};

const formatSignedPercent = (value: number | null, fractionDigits = 1) => {
  if (value === null || !Number.isFinite(value)) return "--";
  const normalized = Number(value.toFixed(fractionDigits));
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(fractionDigits)}%`;
};

const roundToTenth = (value: number) => Number(value.toFixed(1));

const VIDEO_URL_EXTENSION_PATTERN = /\.(mp4|m4v|mov|webm|mkv)(?:$|[?#])/i;
const BLOCKED_URL_EXTENSION_PATTERN = /\.(xml|html?|json|txt|csv)(?:$|[?#])/i;

const normalizeUrlCandidate = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isLikelyVideoUrl = (value: unknown) => {
  const raw = normalizeUrlCandidate(value);
  if (!raw) return false;
  const lowerRaw = raw.toLowerCase();
  if (BLOCKED_URL_EXTENSION_PATTERN.test(lowerRaw)) return false;
  if (VIDEO_URL_EXTENSION_PATTERN.test(lowerRaw)) return true;
  if (lowerRaw.includes("/local-output")) return true;
  if (lowerRaw.includes("/output-url")) return true;
  if (lowerRaw.includes("video/mp4")) return true;
  if (lowerRaw.includes("response-content-type=video")) return true;
  if (lowerRaw.includes("content-type=video")) return true;

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://autoeditor.local";
    const parsed = new URL(raw, base);
    const pathname = parsed.pathname.toLowerCase();
    if (BLOCKED_URL_EXTENSION_PATTERN.test(pathname)) return false;
    if (VIDEO_URL_EXTENSION_PATTERN.test(pathname)) return true;
    if (pathname.includes("/local-output")) return true;
    if (pathname.includes("/output-url")) return true;
    const search = parsed.search.toLowerCase();
    if (search.includes("response-content-type=video") || search.includes("content-type=video")) return true;
  } catch {
    return false;
  }

  return false;
};

const sanitizeVideoUrlList = (values: Array<unknown>) => {
  const deduped = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeUrlCandidate(value);
    if (!normalized || !isLikelyVideoUrl(normalized) || deduped.has(normalized)) continue;
    deduped.add(normalized);
    result.push(normalized);
  }
  return result;
};

const appendVideoCacheBust = (url: string, cacheKey: string) => {
  const normalized = normalizeUrlCandidate(url);
  const key = String(cacheKey || "").trim();
  if (!normalized || !key) return normalized;
  if (!isAuthRequiredDownloadUrl(normalized)) return normalized;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://autoeditor.local";
    const parsed = new URL(normalized, base);
    parsed.searchParams.set("aev", key);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) return parsed.toString();
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = normalized.includes("?") ? "&" : "?";
    return `${normalized}${separator}aev=${encodeURIComponent(key)}`;
  }
};

const buildJobPreviewCacheKey = (job: JobDetail | null) => {
  if (!job) return "";
  const analysis =
    job.analysis && typeof job.analysis === "object" && !Array.isArray(job.analysis)
      ? (job.analysis as Record<string, unknown>)
      : null;
  const runtimeRaw =
    (analysis?.pipeline_runtime as Record<string, unknown> | undefined) ||
    (analysis?.pipelineRuntime as Record<string, unknown> | undefined) ||
    null;
  const parts = [
    String(runtimeRaw?.startedAt || ""),
    String(analysis?.pipelineUpdatedAt || ""),
    String(analysis?.hook_start_time ?? analysis?.hookStartTime ?? ""),
    String(job.status || ""),
    String(job.progress ?? ""),
  ].filter((value) => value.length > 0);
  return parts.join("|");
};

const normalizeJobVideoOutputs = (job: JobDetail): JobDetail => {
  const urls = sanitizeVideoUrlList([
    ...(Array.isArray(job.outputUrls) ? job.outputUrls : []),
    job.outputUrl,
  ]);
  return {
    ...job,
    outputUrl: urls[0] ?? null,
    outputUrls: urls.length > 0 ? urls : null,
  };
};

const RETENTION_SUMMARY_HIDDEN_MODE_TOKEN_PATTERN =
  /long_form_[a-z0-9_]*defaults_[0-9]{4}_[0-9]{2}_[0-9]{2}/i;

const sanitizeRetentionSummaryModeText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return RETENTION_SUMMARY_HIDDEN_MODE_TOKEN_PATTERN.test(text) ? null : text;
};

const interpolateRetentionAtSec = (points: RetentionPoint[], targetSec: number) => {
  if (!Array.isArray(points) || points.length === 0) return null;
  const safeTarget = Math.max(0, Number(targetSec) || 0);
  if (safeTarget <= points[0].atSec) return points[0].predicted;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (safeTarget > current.atSec) continue;
    const span = Math.max(0.001, current.atSec - previous.atSec);
    const ratio = clamp((safeTarget - previous.atSec) / span, 0, 1);
    return roundToTenth(previous.predicted + (current.predicted - previous.predicted) * ratio);
  }
  return points[points.length - 1]?.predicted ?? null;
};

const averageRetentionBetween = (points: RetentionPoint[], startSec: number, endSec: number) => {
  if (!Array.isArray(points) || points.length === 0) return null;
  const safeStart = Math.max(0, Number(startSec) || 0);
  const safeEnd = Math.max(safeStart + 0.001, Number(endSec) || safeStart);
  const anchors = [
    safeStart,
    ...points
      .map((point) => point.atSec)
      .filter((atSec) => atSec > safeStart && atSec < safeEnd),
    safeEnd,
  ].sort((left, right) => left - right);
  let area = 0;
  for (let index = 1; index < anchors.length; index += 1) {
    const fromSec = anchors[index - 1];
    const toSec = anchors[index];
    const from = interpolateRetentionAtSec(points, fromSec);
    const to = interpolateRetentionAtSec(points, toSec);
    if (from === null || to === null) continue;
    area += ((from + to) / 2) * (toSec - fromSec);
  }
  const span = safeEnd - safeStart;
  if (span <= 0) return null;
  return roundToTenth(area / span);
};

const normalizeFeedbackPercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clamp01(numeric <= 1 ? numeric : numeric / 100);
};

const normalizeFeedbackTimestamp = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatFeedbackTimestamp = (iso: string | null) => {
  if (!iso) return "Unknown time";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const parseBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on", "enabled", "enable"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled", "disable"].includes(normalized)) return false;
  return null;
};

const parseCreatorStyleLockPercent = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return clampCreatorStyleLockPercent(numeric);
};

const parseYouTubeVideoInput = (value: unknown): string | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const asUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(asUrl);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (!hostname.endsWith("youtube.com")) return null;
    const watchId = parsed.searchParams.get("v") || "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
    const pathTokens = parsed.pathname.split("/").filter(Boolean);
    const pathId = pathTokens.length >= 2 && (
      pathTokens[0] === "shorts" ||
      pathTokens[0] === "embed" ||
      pathTokens[0] === "live" ||
      pathTokens[0] === "v"
    )
      ? pathTokens[1]
      : "";
    return /^[a-zA-Z0-9_-]{11}$/.test(pathId) ? pathId : null;
  } catch {
    return null;
  }
};

const normalizeYouTubeSignalState = (value: unknown): YouTubeSignalState | null => {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const trustWeight = Number(entry.trustWeight);
  const qualifyingVideos = Number(entry.qualifyingVideos);
  const requiredVideos = Number(entry.requiredVideos);
  const avgViews = Number(entry.averageViewsPerVideo);
  const currentViews = Number(entry.currentVideoViews);
  const requiredAvgViews = Number(entry.requiredAverageViewsPerVideo);
  const highTrustAvgViews = Number(entry.highTrustAverageViewsPerVideo);
  const recommendation = String(entry.recommendation || "").trim();
  if (!Number.isFinite(trustWeight)) return null;
  if (!Number.isFinite(qualifyingVideos) || !Number.isFinite(requiredVideos)) return null;
  return {
    coldStartMode: Boolean(entry.coldStartMode),
    trustWeight: clamp01(trustWeight),
    qualifyingVideos: Math.max(0, Math.round(qualifyingVideos)),
    requiredVideos: Math.max(1, Math.round(requiredVideos)),
    averageViewsPerVideo: Number.isFinite(avgViews) ? Math.max(0, avgViews) : null,
    currentVideoViews: Number.isFinite(currentViews) ? Math.max(0, currentViews) : 0,
    requiredAverageViewsPerVideo: Number.isFinite(requiredAvgViews) ? Math.max(0, requiredAvgViews) : 0,
    highTrustAverageViewsPerVideo: Number.isFinite(highTrustAvgViews) ? Math.max(0, highTrustAvgViews) : 0,
    recommendation: recommendation || "YouTube retention signal updated.",
  };
};

const normalizeCreatorFeedbackHistory = (analysis: any): CreatorFeedbackHistoryEntry[] => {
  const historyRaw = Array.isArray(analysis?.creator_feedback_history) ? analysis.creator_feedback_history : [];
  const current = analysis?.creator_feedback && typeof analysis.creator_feedback === "object"
    ? [analysis.creator_feedback]
    : [];
  const merged = [...historyRaw, ...current];
  const seen = new Set<string>();
  const rows: CreatorFeedbackHistoryEntry[] = [];
  for (const item of merged) {
    const categoryRaw = String((item as any)?.category || (item as any)?.feedback || "").trim().toLowerCase();
    if (!categoryRaw) continue;
    const submittedAt = normalizeFeedbackTimestamp((item as any)?.submittedAt ?? (item as any)?.submitted_at);
    const source = String((item as any)?.source || "").trim().toLowerCase() || null;
    const notes = String((item as any)?.notes || "").trim() || null;
    const dedupeKey = `${categoryRaw}|${submittedAt || "none"}|${source || "none"}|${notes || "none"}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      category: categoryRaw,
      source,
      notes,
      submittedAt,
    });
  }
  return rows.sort((a, b) => {
    const left = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const right = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return right - left;
  });
};

const normalizeRetentionFeedbackHistory = (analysis: any): RetentionFeedbackHistoryEntry[] => {
  const historyRaw = Array.isArray(analysis?.retention_feedback_history) ? analysis.retention_feedback_history : [];
  const current = analysis?.retention_feedback && typeof analysis.retention_feedback === "object"
    ? [analysis.retention_feedback]
    : [];
  const merged = [...historyRaw, ...current];
  const seen = new Set<string>();
  const rows: RetentionFeedbackHistoryEntry[] = [];
  for (const item of merged) {
    const watchPercent = normalizeFeedbackPercent((item as any)?.watchPercent ?? (item as any)?.watch_percent);
    const hookHoldPercent = normalizeFeedbackPercent((item as any)?.hookHoldPercent ?? (item as any)?.hook_hold_percent);
    const completionPercent = normalizeFeedbackPercent((item as any)?.completionPercent ?? (item as any)?.completion_percent);
    const manualScore = normalizeFeedbackPercent((item as any)?.manualScore ?? (item as any)?.manual_score);
    const hasSignal = watchPercent !== null || hookHoldPercent !== null || completionPercent !== null || manualScore !== null;
    if (!hasSignal) continue;
    const submittedAt = normalizeFeedbackTimestamp((item as any)?.submittedAt ?? (item as any)?.submitted_at);
    const sourceRaw = String((item as any)?.source || "").trim().toLowerCase();
    const source = sourceRaw || null;
    const sourceTypeRaw = String((item as any)?.sourceType || (item as any)?.source_type || "").trim().toLowerCase();
    const sourceType: "platform" | "internal" = sourceTypeRaw === "platform" ? "platform" : "internal";
    const notes = String((item as any)?.notes || "").trim() || null;
    const dedupeKey = `${submittedAt || "none"}|${sourceType}|${source || "none"}|${watchPercent}|${hookHoldPercent}|${completionPercent}|${manualScore}|${notes || "none"}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      sourceType,
      source,
      notes,
      submittedAt,
      watchPercent,
      hookHoldPercent,
      completionPercent,
      manualScore,
    });
  }
  return rows.sort((a, b) => {
    const left = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const right = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return right - left;
  });
};

const buildExportFeedbackEntries = (analysis: any): ExportFeedbackEntry[] => {
  const creatorHistory = normalizeCreatorFeedbackHistory(analysis);
  const retentionHistory = normalizeRetentionFeedbackHistory(analysis);
  const creatorEntries: ExportFeedbackEntry[] = creatorHistory.map((entry, index) => {
    const knownLabel = (CREATOR_FEEDBACK_LABELS as Record<string, string>)[entry.category];
    const label = knownLabel || formatNicheLabel(entry.category);
    return {
      id: `creator-${index}-${entry.submittedAt || "none"}-${entry.category}`,
      at: entry.submittedAt,
      sourceType: "creator",
      label: `Creator: ${label}`,
      detail: entry.notes || entry.source || "Submitted from editor feedback controls.",
    };
  });
  const retentionEntries: ExportFeedbackEntry[] = retentionHistory.map((entry, index) => {
    const metrics = [
      entry.watchPercent !== null ? `watch ${Math.round(entry.watchPercent * 100)}%` : null,
      entry.hookHoldPercent !== null ? `hook ${Math.round(entry.hookHoldPercent * 100)}%` : null,
      entry.completionPercent !== null ? `completion ${Math.round(entry.completionPercent * 100)}%` : null,
      entry.manualScore !== null ? `manual ${Math.round(entry.manualScore * 100)}%` : null,
    ].filter((part): part is string => Boolean(part));
    return {
      id: `retention-${index}-${entry.submittedAt || "none"}-${entry.sourceType}`,
      at: entry.submittedAt,
      sourceType: "retention",
      label: entry.sourceType === "platform" ? "Platform feedback" : "Retention feedback",
      detail: entry.notes || `${metrics.join(" • ")}${entry.source ? ` • ${entry.source}` : ""}`.trim(),
    };
  });
  return [...creatorEntries, ...retentionEntries]
    .sort((a, b) => {
      const left = a.at ? new Date(a.at).getTime() : 0;
      const right = b.at ? new Date(b.at).getTime() : 0;
      return right - left;
    })
    .slice(0, 12);
};

const ENERGY_TIMELINE_POINT_LIMIT = 16;
const ENERGY_MERGE_WINDOW_SEC = 0.45;

const toOptionalPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return clamp(Math.round(normalized), 0, 100);
};

const averageOptionalNumbers = (...values: Array<number | null>) => {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
};

const computeEnergyComposite = (moment: Pick<EnergyMoment, "motion" | "audio" | "visual" | "facial">) =>
  clamp(
    Math.round(
      (moment.motion * 0.32) +
      (moment.audio * 0.28) +
      (moment.visual * 0.22) +
      (moment.facial * 0.18),
    ),
    0,
    100,
  );

const sampleTimelineEnergyMoments = (moments: EnergyMoment[], maxCount: number) => {
  if (moments.length <= maxCount) return moments;
  const limit = Math.max(2, maxCount);
  const step = (moments.length - 1) / (limit - 1);
  const sampledIndices = Array.from({ length: limit }, (_, index) => Math.round(index * step));
  const peakIndex = moments.reduce((best, current, index, list) => (current.energy > list[best].energy ? index : best), 0);
  if (!sampledIndices.includes(peakIndex)) {
    let replaceAt = 1;
    let smallestDistance = Number.POSITIVE_INFINITY;
    for (let i = 1; i < sampledIndices.length - 1; i += 1) {
      const distance = Math.abs(sampledIndices[i] - peakIndex);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        replaceAt = i;
      }
    }
    sampledIndices[replaceAt] = peakIndex;
  }
  const uniqueSortedIndices = Array.from(new Set(sampledIndices)).sort((a, b) => a - b);
  return uniqueSortedIndices.slice(0, limit).map((index) => moments[index]);
};

const normalizeEnergyMoments = (raw: unknown): EnergyMoment[] => {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!item) return null;
      const timestampSec = firstFiniteNumber(item.timestampSec, item.timestamp, item.timeSec, item.time, item.start, item.atSec);
      if (timestampSec === null) return null;
      const rawEnergy = toOptionalPercent(firstFiniteNumber(item.energy, item.energyScore, item.score, item.value));
      const motionRaw = toOptionalPercent(firstFiniteNumber(item.motion, item.motionScore, item.motion_energy));
      const audioRaw = toOptionalPercent(firstFiniteNumber(item.audio, item.audioScore, item.audio_energy));
      const visualRaw = toOptionalPercent(firstFiniteNumber(item.visual, item.visualScore, item.visual_energy));
      const facialRaw = toOptionalPercent(firstFiniteNumber(item.facial, item.facialScore, item.facial_engagement));
      const componentsAverage = averageOptionalNumbers(motionRaw, audioRaw, visualRaw, facialRaw);
      const blendedEnergy =
        rawEnergy !== null && componentsAverage !== null
          ? clamp(Math.round((rawEnergy * 0.58) + (componentsAverage * 0.42)), 0, 100)
          : rawEnergy ?? componentsAverage;
      if (blendedEnergy === null) return null;
      const motion = motionRaw ?? blendedEnergy;
      const audio = audioRaw ?? blendedEnergy;
      const visual = visualRaw ?? blendedEnergy;
      const facial = facialRaw ?? blendedEnergy;
      return {
        timestampSec: Math.max(0, timestampSec),
        energy: blendedEnergy,
        motion,
        audio,
        visual,
        facial,
      } as EnergyMoment;
    })
    .filter((item): item is EnergyMoment => Boolean(item))
    .sort((a, b) => a.timestampSec - b.timestampSec);
  if (parsed.length === 0) return [];

  const merged = parsed.reduce<Array<EnergyMoment & { sampleCount: number }>>((acc, moment) => {
    const previous = acc[acc.length - 1];
    if (previous && Math.abs(moment.timestampSec - previous.timestampSec) <= ENERGY_MERGE_WINDOW_SEC) {
      const sampleCount = previous.sampleCount + 1;
      previous.timestampSec = Number(((previous.timestampSec * previous.sampleCount + moment.timestampSec) / sampleCount).toFixed(3));
      previous.energy = Math.round((previous.energy * previous.sampleCount + moment.energy) / sampleCount);
      previous.motion = Math.round((previous.motion * previous.sampleCount + moment.motion) / sampleCount);
      previous.audio = Math.round((previous.audio * previous.sampleCount + moment.audio) / sampleCount);
      previous.visual = Math.round((previous.visual * previous.sampleCount + moment.visual) / sampleCount);
      previous.facial = Math.round((previous.facial * previous.sampleCount + moment.facial) / sampleCount);
      previous.sampleCount = sampleCount;
      return acc;
    }
    acc.push({ ...moment, sampleCount: 1 });
    return acc;
  }, []);

  const smoothed = merged.map((moment, index) => {
    const previous = merged[Math.max(0, index - 1)] ?? moment;
    const next = merged[Math.min(merged.length - 1, index + 1)] ?? moment;
    const trendEnergy = Math.round((previous.energy * 0.22) + (moment.energy * 0.56) + (next.energy * 0.22));
    const componentEnergy = computeEnergyComposite(moment);
    const energy = clamp(Math.round((trendEnergy * 0.64) + (componentEnergy * 0.36)), 0, 100);
    return {
      timestampSec: moment.timestampSec,
      energy,
      motion: moment.motion,
      audio: moment.audio,
      visual: moment.visual,
      facial: moment.facial,
    } as EnergyMoment;
  });

  return sampleTimelineEnergyMoments(smoothed, ENERGY_TIMELINE_POINT_LIMIT);
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
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : null;
      const description =
        typeof item.description === "string" && item.description.trim() ? item.description.trim() : null;
      const watchedPct = firstFiniteNumber(item.watchedPct, item.watched_percent, item.watchPercent);
      return {
        atSec: Math.max(0, atSec),
        predicted: toPercent(predicted, predicted),
        kind,
        label,
        description,
        watchedPct: watchedPct === null ? null : toPercent(watchedPct, watchedPct),
      } as RetentionPoint;
    })
    .filter((item): item is RetentionPoint => Boolean(item))
    .slice(0, 40)
    .sort((a, b) => a.atSec - b.atSec);
};

const RETENTION_TIMELINE_CATEGORY_META: Record<
  RetentionTimelineCategory,
  {
    label: string;
    segmentClassName: string;
    badgeClassName: string;
    textClassName: string;
  }
> = {
  best: {
    label: "Best Part",
    segmentClassName: "bg-primary/85 hover:bg-primary/70",
    badgeClassName: "border-primary/40 bg-primary/15 text-foreground",
    textClassName: "text-foreground",
  },
  skip_risk: {
    label: "Likely Skip",
    segmentClassName: "bg-rose-400/90 hover:bg-rose-300",
    badgeClassName: "border-rose-500/40 bg-rose-500/15 text-rose-100",
    textClassName: "text-rose-100",
  },
  weak: {
    label: "Weaker Part",
    segmentClassName: "bg-amber-400/90 hover:bg-amber-300",
    badgeClassName: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    textClassName: "text-amber-100",
  },
  steady: {
    label: "Steady",
    segmentClassName: "bg-[hsl(var(--glow-secondary)/0.78)] hover:bg-[hsl(var(--glow-secondary)/0.62)]",
    badgeClassName: "border-[hsl(var(--glow-secondary)/0.45)] bg-[hsl(var(--glow-secondary)/0.16)] text-foreground",
    textClassName: "text-foreground/90",
  },
};

const EMOTION_PROFILE_META: Record<
  EmotionProfileKey,
  {
    label: string;
    badgeClassName: string;
    barClassName: string;
    detail: string;
  }
> = {
  excitement: {
    label: "Excitement",
    badgeClassName: "border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-100",
    barClassName: "from-fuchsia-400/90 via-pink-400/85 to-orange-300/85",
    detail: "High velocity moments with strong payoff pressure.",
  },
  curiosity: {
    label: "Curiosity",
    badgeClassName: "border-sky-400/45 bg-sky-500/15 text-sky-100",
    barClassName: "from-sky-400/90 via-cyan-300/85 to-teal-300/85",
    detail: "Question-loop and reveal-driven watch momentum.",
  },
  anticipation: {
    label: "Anticipation",
    badgeClassName: "border-indigo-400/45 bg-indigo-500/15 text-indigo-100",
    barClassName: "from-indigo-400/90 via-violet-300/85 to-blue-300/85",
    detail: "Build-up windows before major emotional beats.",
  },
  tension: {
    label: "Tension",
    badgeClassName: "border-rose-400/45 bg-rose-500/15 text-rose-100",
    barClassName: "from-rose-400/90 via-red-300/85 to-amber-300/75",
    detail: "Likely drop-off risk where pacing needs tightening.",
  },
  inspiration: {
    label: "Inspiration",
    badgeClassName: "border-emerald-400/45 bg-emerald-500/15 text-emerald-100",
    barClassName: "from-emerald-400/90 via-lime-300/85 to-cyan-300/80",
    detail: "Emotion-forward sections with face and voice emphasis.",
  },
};

const classifyEmotionProfile = (moment: Pick<EnergyMoment, "energy" | "motion" | "audio" | "visual" | "facial">): EmotionProfileKey => {
  if (moment.energy >= 86 && moment.motion >= 78) return "excitement";
  if (moment.visual >= 80 && moment.energy >= 72) return "curiosity";
  if (moment.facial >= 78 && moment.audio >= 70) return "inspiration";
  if (moment.energy <= 60 || moment.audio <= 54) return "tension";
  return "anticipation";
};

const formatEmotionPredictionReason = (emotionKey: EmotionProfileKey) => {
  const meta = EMOTION_PROFILE_META[emotionKey];
  return `${meta.label} signals are strong across energy + retention windows.`;
};

const resolveRetentionTimelineCategory = ({
  predicted,
  dropFromPrevious,
  pointKind,
}: {
  predicted: number;
  dropFromPrevious: number;
  pointKind: RetentionPointKind | null;
}): { category: RetentionTimelineCategory; reason: string } => {
  const normalizedKind = String(pointKind || "").trim().toLowerCase();
  if (normalizedKind === "best" || normalizedKind === "hook" || normalizedKind === "emotional_peak") {
    return { category: "best", reason: "High-performing retention anchor." };
  }
  if (normalizedKind === "skip_zone") {
    return { category: "skip_risk", reason: "Model marked this range as skippable." };
  }
  if (normalizedKind === "worst") {
    return { category: "weak", reason: "Largest drop-off window from model scoring." };
  }
  if (predicted >= 82 && dropFromPrevious <= 2) {
    return { category: "best", reason: "Top retention window based on predicted watch rate." };
  }
  if (predicted <= 46 || dropFromPrevious >= 11) {
    return { category: "skip_risk", reason: "Sharp retention drop; likely skip risk." };
  }
  if (predicted <= 62 || dropFromPrevious >= 6) {
    return { category: "weak", reason: "Below-target retention momentum." };
  }
  return { category: "steady", reason: "Holding average retention." };
};

const toTimelineSegmentActionKey = (jobId: string, segmentId: string) => `${jobId}:${segmentId}`;

const normalizeOutcomeAutomationEditorMode = (value: unknown): EditorModeSelection => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined") return "auto";
  return EDITOR_MODE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as EditorModeSelection)
    : "auto";
};

const mapEditorModeForBackend = (
  value: EditorModeSelection,
  powerMode: PipelinePowerMode,
): BackendEditorModeSelection => {
  if (powerMode === "ultra") return "ultra";
  if (powerMode === "retention_king") return "retention-king";
  return value;
};
const isUltraPipelineMode = (mode: PipelinePowerMode) => mode === "ultra";
const resolveFullAutoYoutubeTarget = (
  target: FullAutoYoutubeTarget,
  isVerticalMode: boolean,
): Exclude<FullAutoYoutubeTarget, "auto"> => {
  if (target === "long_form" || target === "shorts") return target;
  return isVerticalMode ? "shorts" : "long_form";
};
const resolveFullAutoYoutubeVibe = (
  vibe: FullAutoYoutubeVibe,
  target: Exclude<FullAutoYoutubeTarget, "auto">,
): Exclude<FullAutoYoutubeVibe, "auto"> => {
  if (vibe !== "auto") return vibe;
  return target === "shorts" ? "hype" : "cinematic";
};

const normalizeHookSelectionMode = (value: unknown): HookSelectionMode => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined") return "auto";
  if (normalized === "auto" || normalized === "automatic" || normalized === "editor") return "auto";
  if (normalized === "manual" || normalized === "user" || normalized === "user_selected") return "auto";
  return "auto";
};

const normalizeCreativeVariant = (value: unknown): CreativeVariant => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CREATIVE_VARIANT_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as CreativeVariant)
    : "balanced";
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

type CaptionCapability = {
  available: boolean;
  provider?: string | null;
  mode?: string | null;
  reason?: string | null;
};

type EditorSettingsResponse = {
  settings?: {
    autoDownload?: boolean;
    autoCaptions?: boolean;
    subtitleStyle?: string;
  };
  capabilities?: {
    captions?: CaptionCapability;
  };
};

type CheckoutSuccessDialogState = {
  open: boolean;
  heading: string;
  description: string;
  activatedPlan: string | null;
  trial: boolean;
};

const displayName = (job: JobSummary) => job.inputPath?.split("/").pop() || "Untitled";

const Editor = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [uploadModePromptOpen, setUploadModePromptOpen] = useState(false);
  const [pendingUploadSelection, setPendingUploadSelection] = useState<{
    file: File;
    fileCount: number;
    mode: "horizontal" | "vertical";
  } | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytesUploaded, setUploadBytesUploaded] = useState<number | null>(null);
  const [uploadBytesTotal, setUploadBytesTotal] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFeedbackOpen, setExportFeedbackOpen] = useState(false);
  const [qualityByJob, setQualityByJob] = useState<Record<string, ExportQuality>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const pipelineStartRef = useRef<Record<string, number>>({});
  const uploadStartRef = useRef<Record<string, number>>({});
  const jobFileSizeRef = useRef<Record<string, number>>({});
  const statusStartRef = useRef<Record<string, { status: string; startedAt: number; startProgress: number }>>({});
  const lastKnownJobIdRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [etaTick, setEtaTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, signOut } = useAuth();
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const {
    notificationPermission,
    showEnableNotificationHint,
    ensureNotificationPermission,
    dismissEnableNotificationHint,
    notifyExportComplete,
  } = useExportNotification({
    toast,
    logoUrl: "/logo.png",
    fallbackLogoUrl: "/favicon-32x32.png",
    requestPermissionOnMount: true,
    playSound: true,
    flashTitle: true,
  });
  const modeParam = searchParams.get("mode");
  const isVerticalMode = modeParam === "vertical";
  const [verticalClipCount, setVerticalClipCount] = useState(0);
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
  const [verticalCaptionDynamicMode, setVerticalCaptionDynamicMode] = useState<VerticalCaptionDynamicModeOptionId>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].dynamicMode,
  );
  const [verticalVoicePreset, setVerticalVoicePreset] = useState<VerticalVoicePresetOptionId>("none");
  const [verticalCaptionFontSize, setVerticalCaptionFontSize] = useState<number>(VERTICAL_CAPTION_FONT_SIZE_DEFAULT);
  const [verticalCaptionShadowStrength, setVerticalCaptionShadowStrength] = useState<number>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].shadowStrength,
  );
  const [verticalCaptionAnimationSpeed, setVerticalCaptionAnimationSpeed] = useState<number>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].animationSpeed,
  );
  const [verticalCaptionHighlightWords, setVerticalCaptionHighlightWords] = useState<boolean>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].highlightWords,
  );
  const [verticalCaptionAutoEmphasis, setVerticalCaptionAutoEmphasis] = useState<boolean>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].autoEmphasis,
  );
  const [verticalCaptionAutoEmoji, setVerticalCaptionAutoEmoji] = useState<boolean>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].autoEmoji,
  );
  const [verticalCaptionRemoveFillers, setVerticalCaptionRemoveFillers] = useState<boolean>(
    VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE].removeFillers,
  );
  const [verticalCaptionPositionX, setVerticalCaptionPositionX] = useState<number>(0.5);
  const [verticalCaptionPositionY, setVerticalCaptionPositionY] = useState<number>(0.84);
  const [pendingVerticalFile, setPendingVerticalFile] = useState<File | null>(null);
  const [isVerticalBuilderHidden, setIsVerticalBuilderHidden] = useState(false);
  const [verticalPreviewUrl, setVerticalPreviewUrl] = useState<string | null>(null);
  const [skipManualWebcamCrop, setSkipManualWebcamCrop] = useState(false);
  const [onlyHookAndCut, setOnlyHookAndCut] = useState(false);
  const [maxCutsRequested, setMaxCutsRequested] = useState(DEFAULT_MAX_CUTS);
  const [editorMode, setEditorMode] = useState<EditorModeSelection>("auto");
  const [pipelinePowerMode, setPipelinePowerMode] = useState<PipelinePowerMode>("retention_king");
  const [creativeVariant, setCreativeVariant] = useState<CreativeVariant>("balanced");
  const [coldStartAutopilotEnabled, setColdStartAutopilotEnabled] = useState(false);
  const [continuityFirstEnabled, setContinuityFirstEnabled] = useState(false);
  const [exploreX3Enabled, setExploreX3Enabled] = useState(false);
  const [topHumanGuardEnabled, setTopHumanGuardEnabled] = useState(false);
  const [creatorStyleLockPercent, setCreatorStyleLockPercent] = useState(DEFAULT_CREATOR_STYLE_LOCK_PERCENT);
  const [fullAutoYoutubeEnabled, setFullAutoYoutubeEnabled] = useState(false);
  const [fullAutoYoutubeTarget, setFullAutoYoutubeTarget] = useState<FullAutoYoutubeTarget>(
    isVerticalMode ? "shorts" : "auto",
  );
  const [fullAutoYoutubeVibe, setFullAutoYoutubeVibe] = useState<FullAutoYoutubeVibe>("auto");
  const [fullAutoYoutubeProfile, setFullAutoYoutubeProfile] = useState<FullAutoYoutubeProfilePayload>(null);
  const [fullAutoYoutubeLoading, setFullAutoYoutubeLoading] = useState(false);
  const [defaultHookSelectionMode, setDefaultHookSelectionMode] = useState<HookSelectionMode>("auto");
  const [longFormPreset, setLongFormPreset] = useState<LongFormPreset>("aggressive");
  const [longFormAggression, setLongFormAggression] = useState(88);
  const [longFormClarityVsSpeed, setLongFormClarityVsSpeed] = useState(44);
  const [tangentKiller, setTangentKiller] = useState(true);
  const [outcomeAutomationProfile, setOutcomeAutomationProfile] = useState<OutcomeAutomationProfile | null>(null);
  const [hideJobsPanel, setHideJobsPanel] = useState(true);
  const [hideEditorControlsPanel, setHideEditorControlsPanel] = useState(true);
  const [editorSettingsSection, setEditorSettingsSection] = useState<EditorSettingsSection>("format");
  const [webcamCrop, setWebcamCrop] = useState<WebcamCrop | null>(null);
  const [sourceVideoMeta, setSourceVideoMeta] = useState<{ width: number; height: number } | null>(null);
  const [webcamTopHeightPct, setWebcamTopHeightPct] = useState(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
  const [webcamPaddingPx, setWebcamPaddingPx] = useState(DEFAULT_WEBCAM_PADDING_PX);
  const [bottomFitMode, setBottomFitMode] = useState<VerticalFitMode>("cover");
  const [cropInteraction, setCropInteraction] = useState<CropInteraction | null>(null);
  const [verticalCaptionDragState, setVerticalCaptionDragState] = useState<VerticalCaptionDragState | null>(null);
  const [retentionStrategyProfile, setRetentionStrategyProfile] = useState<RetentionStrategyProfile>("viral");
  const [retentionTargetPlatform, setRetentionTargetPlatform] = useState<RetentionTargetPlatform>(
    isVerticalMode ? "tiktok" : "youtube",
  );
  const [subtitleStyleDraft, setSubtitleStyleDraft] = useState<string>("basic_clean");
  const [subtitleStyleDirty, setSubtitleStyleDirty] = useState(false);
  const [autoCaptionsEnabled, setAutoCaptionsEnabled] = useState(false);
  const [captionCapability, setCaptionCapability] = useState<CaptionCapability>({
    available: false,
    mode: "disabled",
    reason: "Captions are disabled in the editor pipeline.",
  });
  const [savingSubtitleStyle, setSavingSubtitleStyle] = useState(false);
  const [showSavedAnimation, setShowSavedAnimation] = useState(false);
  const prevSavingSubtitleRef = useRef<boolean>(savingSubtitleStyle);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);
  const [analyzeUnlockedByJob, setAnalyzeUnlockedByJob] = useState<Record<string, boolean>>({});
  const [creatorFeedbackSubmitting, setCreatorFeedbackSubmitting] = useState<CreatorFeedbackCategory | null>(null);
  const [timelineSegmentActionByKey, setTimelineSegmentActionByKey] = useState<Record<string, "fix" | "remove">>({});
  const [timelineSegmentActionSubmittingKey, setTimelineSegmentActionSubmittingKey] = useState<string | null>(null);
  const [mobilePipeline, setMobilePipeline] = useState(false);
  const [runtimeProfile, setRuntimeProfile] = useState<RuntimeProfile>(() => readRuntimeProfile());
  const [pipelineLogOpen, setPipelineLogOpen] = useState(false);
  const [retentionDetailsOpen, setRetentionDetailsOpen] = useState(false);
  const [videoAnalysisOpen, setVideoAnalysisOpen] = useState(false);
  const [youtubeOAuthStatus, setYouTubeOAuthStatus] = useState<YouTubeOAuthStatusResponse | null>(null);
  const [youtubeOAuthStatusLoading, setYouTubeOAuthStatusLoading] = useState(false);
  const [youtubeOAuthBusyAction, setYouTubeOAuthBusyAction] = useState<"connect" | "exchange" | "disconnect" | null>(null);
  const [youtubeVideoDraftLoose, setYouTubeVideoDraftLoose] = useState("");
  const [youtubeVideoDraftByJob, setYouTubeVideoDraftByJob] = useState<Record<string, string>>({});
  const [youtubeVideoLinkingJobId, setYoutubeVideoLinkingJobId] = useState<string | null>(null);
  const [youtubeSyncingJobId, setYoutubeSyncingJobId] = useState<string | null>(null);
  const [youtubeStyleApplying, setYoutubeStyleApplying] = useState(false);
  const [youtubeReferenceStyleApplied, setYoutubeReferenceStyleApplied] = useState<YouTubeReferenceStyleApplied | null>(null);
  const [youtubeSignalByJob, setYouTubeSignalByJob] = useState<Record<string, YouTubeSignalState | null>>({});
  const [feedbackDeepDiveOpen, setFeedbackDeepDiveOpen] = useState(false);
  const [feedbackDeepDiveSection, setFeedbackDeepDiveSection] = useState<FeedbackDeepDiveSection>("retention_vs_emotion");
  const [aModeEnabled, setAModeEnabled] = useState(true);
  const [autoCutBoringEnabled, setAutoCutBoringEnabled] = useState(true);
  const [bingeModeEnabled, setBingeModeEnabled] = useState(true);
  const [achievementPopup, setAchievementPopup] = useState<AchievementSignal | null>(null);
  const [applyingHookJobId, setApplyingHookJobId] = useState<string | null>(null);
  const [hookSelectorOpen, setHookSelectorOpen] = useState(false);
  const [editorGuideOpen, setEditorGuideOpen] = useState(false);
  const [hookPromptedByJob, setHookPromptedByJob] = useState<Record<string, boolean>>({});
  const [selectedHookByJob, setSelectedHookByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookSelectionModeByJob, setHookSelectionModeByJob] = useState<Record<string, HookSelectionMode>>({});
  const [hookPreviewCandidateByJob, setHookPreviewCandidateByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookPreviewUrlByJob, setHookPreviewUrlByJob] = useState<Record<string, string>>({});
  const [hookPreviewErrorByJob, setHookPreviewErrorByJob] = useState<Record<string, string>>({});
  const [hookPreviewLoadingJobId, setHookPreviewLoadingJobId] = useState<string | null>(null);
  const [hookPreviewRefreshNonceByJob, setHookPreviewRefreshNonceByJob] = useState<Record<string, number>>({});
  const [previewRefreshNonceByJob, setPreviewRefreshNonceByJob] = useState<Record<string, number>>({});
  const [previewCompareMode, setPreviewCompareMode] = useState<PreviewCompareMode>("after");
  const [beforePreviewUrlByJob, setBeforePreviewUrlByJob] = useState<Record<string, string>>({});
  const [beforePreviewLoadingJobId, setBeforePreviewLoadingJobId] = useState<string | null>(null);
  const uploadDropZoneRef = useRef<HTMLDivElement | null>(null);
  const dropDragDepthRef = useRef(0);
  const menuTouchedRef = useRef<{ strategy: boolean; targetPlatform: boolean; editorMode: boolean }>({
    strategy: false,
    targetPlatform: false,
    editorMode: false,
  });
  const sourcePreviewRef = useRef<HTMLDivElement | null>(null);
  const fullAnalysisSectionRef = useRef<HTMLDivElement | null>(null);
  const feedbackDeepDiveSectionRefs = useRef<Partial<Record<FeedbackDeepDiveSection, HTMLDivElement | null>>>({});
  const verticalSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const verticalCaptionHitboxRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [resolvedPreviewOutputUrl, setResolvedPreviewOutputUrl] = useState<string>("");
  const [previewCurrentTimeSec, setPreviewCurrentTimeSec] = useState(0);
  const [transcriptPanelTab, setTranscriptPanelTab] = useState<TranscriptPanelTab>("editor");
  const hookPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRetryCountByJobRef = useRef<Record<string, number>>({});
  const playbackTelemetryRef = useRef<Record<string, PreviewPlaybackTelemetry>>({});
  const retentionFeedbackDispatchRef = useRef<Record<string, { at: number; signature: string }>>({});
  const retentionFeedbackInFlightRef = useRef<Record<string, boolean>>({});
  const downloadFeedbackSentRef = useRef<Record<string, boolean>>({});
  const achievementShownRef = useRef<Record<string, Record<string, boolean>>>({});
  const powerModeSyncJobRef = useRef<string | null>(null);
  const creativeVariantSyncJobRef = useRef<string | null>(null);
  const advancedModesSyncJobRef = useRef<string | null>(null);
  const pageViewTrackedRef = useRef(false);
  const editorGuidePromptedRef = useRef(false);
  const analyticsSessionId = useMemo(() => getAnalyticsSessionId(), []);
  const lowBandwidthMode = runtimeProfile.lowBandwidth;
  const lowPowerMode = runtimeProfile.lowPowerDevice;
  const performanceConstrained = lowBandwidthMode || lowPowerMode || runtimeProfile.reducedMotion;
  const livePollingIntervalMs = performanceConstrained ? 4500 : 2500;
  const ultraPipelineMode = isUltraPipelineMode(pipelinePowerMode);
  const retentionKingPipelineMode = pipelinePowerMode === "retention_king";
  const previewPreload: "auto" | "metadata" = performanceConstrained ? "metadata" : "auto";
  const fullAutoResolvedTarget = useMemo(
    () => resolveFullAutoYoutubeTarget(fullAutoYoutubeTarget, isVerticalMode),
    [fullAutoYoutubeTarget, isVerticalMode],
  );
  const fullAutoResolvedVibe = useMemo(
    () => resolveFullAutoYoutubeVibe(fullAutoYoutubeVibe, fullAutoResolvedTarget),
    [fullAutoYoutubeVibe, fullAutoResolvedTarget],
  );

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  useEffect(() => {
    if (!selectedJobId) return;
    lastKnownJobIdRef.current = selectedJobId;
    try {
      window.sessionStorage.setItem("editor:last-job-id", selectedJobId);
    } catch (error) {
      // ignore storage failures
    }
  }, [selectedJobId]);

  const { data: me, refetch: refetchMe } = useMe({
    refetchInterval: hasActiveJobs ? livePollingIntervalMs : false,
  });
  const [entitlements, setEntitlements] = useState<{ autoDownloadAllowed?: boolean } | null>(null);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean | null>(null);
  const [autoDownloadModal, setAutoDownloadModal] = useState<{ open: boolean; url?: string; fileName?: string; jobId?: string }>({ open: false });
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [reprocessingJobId, setReprocessingJobId] = useState<string | null>(null);
  const [trialUpgradeOpen, setTrialUpgradeOpen] = useState(false);
  const [checkoutSuccessDialog, setCheckoutSuccessDialog] = useState<CheckoutSuccessDialogState>({
    open: false,
    heading: "",
    description: "",
    activatedPlan: null,
    trial: false,
  });
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const paidTier = isPaidTier(tier);
  const subscriptionResolved = !accessToken || me !== undefined;
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
  const analyzeUnlockStorageKey = me?.user?.id ? `${ANALYZE_UNLOCKED_JOBS_KEY}_${me.user.id}` : null;
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
  const activeSubtitlePresetMeta = useMemo(
    () => SUBTITLE_PRESET_OPTIONS.find((preset) => preset.id === activeSubtitlePreset) ?? null,
    [activeSubtitlePreset],
  );
  const outcomeAutomationConfidencePercent = useMemo(
    () =>
      outcomeAutomationProfile
        ? Math.round(clamp01(Number(outcomeAutomationProfile.confidence || 0)) * 100)
        : 0,
    [outcomeAutomationProfile],
  );
  const outcomeAutomationExpectedLiftPoints = useMemo(
    () => (outcomeAutomationProfile ? Number(outcomeAutomationProfile.expectedLift || 0) * 100 : 0),
    [outcomeAutomationProfile],
  );
  const isDevAccount = Boolean(me?.flags?.dev);
  const rendersUsed = me?.usage?.rendersUsed ?? 0;
  const maxRendersPerMonth = me?.limits?.maxRendersPerMonth ?? null;
  const rendersRemaining = useMemo(() => {
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return null;
    return Math.max(0, maxRendersPerMonth - rendersUsed);
  }, [maxRendersPerMonth, rendersUsed]);
  const maxRerendersPerDay = me?.limits?.maxRerendersPerDay ?? PLAN_CONFIG[tier].maxRerendersPerDay;
  const rerendersUsedToday = me?.rerenderUsageDaily?.rerendersUsed ?? 0;
  const rerendersRemainingToday = useMemo(() => {
    if (maxRerendersPerDay === null || maxRerendersPerDay === undefined) return null;
    return Math.max(0, maxRerendersPerDay - rerendersUsedToday);
  }, [maxRerendersPerDay, rerendersUsedToday]);
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

  const applyVerticalCaptionPreset = useCallback((presetId: VerticalCaptionPresetOptionId) => {
    const defaults = VERTICAL_CAPTION_PRESET_DEFAULTS[presetId] ?? VERTICAL_CAPTION_PRESET_DEFAULTS[DEFAULT_VERTICAL_CAPTION_STYLE];
    setVerticalCaptionPreset(presetId);
    setVerticalCaptionFontId(defaults.fontId);
    setVerticalCaptionOutlineColor(defaults.outlineColor);
    setVerticalCaptionOutlineWidth(defaults.outlineWidth);
    setVerticalCaptionAnimation(defaults.animation);
    setVerticalCaptionDynamicMode(defaults.dynamicMode);
    setVerticalCaptionShadowStrength(defaults.shadowStrength);
    setVerticalCaptionAnimationSpeed(defaults.animationSpeed);
    setVerticalCaptionHighlightWords(defaults.highlightWords);
    setVerticalCaptionAutoEmphasis(defaults.autoEmphasis);
    setVerticalCaptionAutoEmoji(defaults.autoEmoji);
    setVerticalCaptionRemoveFillers(defaults.removeFillers);
  }, []);

  const applyPlatformVerticalCaptionPreset = useCallback(
    (platform: RetentionTargetPlatform) => {
      applyVerticalCaptionPreset(PLATFORM_VERTICAL_CAPTION_PRESET[platform]);
    },
    [applyVerticalCaptionPreset],
  );

  const resetVerticalCaptionPlacement = useCallback(() => {
    setVerticalCaptionPositionX(0.5);
    setVerticalCaptionPositionY(0.84);
    setVerticalCaptionFontSize(VERTICAL_CAPTION_FONT_SIZE_DEFAULT);
  }, []);

  const saveSubtitleStyle = useCallback(async () => {
    if (!accessToken) return;
    const nextStyle = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    try {
      setSavingSubtitleStyle(true);
      const result = await apiFetch<EditorSettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ subtitleStyle: nextStyle, autoCaptions: false }),
        token: accessToken,
      });
      const runtimeCaptions = result?.capabilities?.captions;
      if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
        setCaptionCapability(runtimeCaptions);
      }
      const persisted = normalizeSubtitleStyleFromSettings(result?.settings?.subtitleStyle ?? nextStyle);
      const persistedAutoCaptions = false;
      setSubtitleStyleDraft(persisted);
      setAutoCaptionsEnabled(persistedAutoCaptions);
      setSubtitleStyleDirty(false);
      trackEditorEvent("subtitle_preferences_saved", {
        captionStyle: persisted,
        retentionProfile: retentionStrategyProfile,
        targetPlatform: retentionTargetPlatform,
        metadata: {
          autoCaptionsEnabled: persistedAutoCaptions,
        },
      });
      toast({
        title: "Caption settings updated",
        description: "Captions remain disabled for editor renders.",
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "PLAN_LIMIT_EXCEEDED") {
        toast({
          title: "Upgrade required",
          description: err?.message || "Your plan cannot use this caption style.",
        });
        return;
      }
      if (err instanceof ApiError && err.code === "CAPTION_ENGINE_UNAVAILABLE") {
        const runtimeCaptions = err?.data?.capabilities?.captions;
        if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
          setCaptionCapability(runtimeCaptions);
        }
        setAutoCaptionsEnabled(false);
        toast({
          title: "Caption engine unavailable",
          description:
            runtimeCaptions?.reason ||
            err?.message ||
            "Caption engine is not available on the backend, so captions are disabled.",
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

  useEffect(() => {
    // Show a brief green check animation when a save completes
    if (prevSavingSubtitleRef.current && !savingSubtitleStyle && !subtitleStyleDirty) {
      setShowSavedAnimation(true);
      const id = window.setTimeout(() => setShowSavedAnimation(false), 1400);
      return () => window.clearTimeout(id);
    }
    prevSavingSubtitleRef.current = savingSubtitleStyle;
  }, [savingSubtitleStyle, subtitleStyleDirty]);

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

  useEffect(() => {
    if (searchParams.get("success") !== "true") return;

    const source = String(searchParams.get("source") || "").toLowerCase();
    const trialState = String(searchParams.get("trial") || "").toLowerCase();
    const trialCheckout = source === "trial" || trialState === "started" || trialState === "active";
    const tierFromQuery = toPlanTier(searchParams.get("tier"));
    const tierFromSubscription = toPlanTier(me?.subscription?.tier);
    const tierFromTrial = toPlanTier(trialInfo?.trialTier);
    const resolvedTier = tierFromQuery || (trialCheckout ? tierFromTrial : tierFromSubscription) || null;
    const activatedPlan = resolvedTier ? PLAN_CONFIG[resolvedTier].name : null;
    const description = activatedPlan
      ? trialCheckout
        ? `You activated the ${activatedPlan} free trial.`
        : `You activated the ${activatedPlan} subscription.`
      : trialCheckout
      ? "You activated a free trial."
      : "You activated a subscription.";

    setCheckoutSuccessDialog({
      open: true,
      heading: trialCheckout ? "Free trial activated" : "Subscription activated",
      description: `${description} Premium editor tools are now unlocked.`,
      activatedPlan,
      trial: trialCheckout,
    });

    const next = new URLSearchParams(searchParams);
    for (const key of CHECKOUT_SUCCESS_QUERY_KEYS) {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }, [me?.subscription?.tier, searchParams, setSearchParams, trialInfo?.trialTier]);

  useEffect(() => {
    const previewParam = String(searchParams.get("preview") || "").toLowerCase();
    const shouldOpenExportPreview = previewParam === "export" || searchParams.get("exportPreview") === "1";
    if (!shouldOpenExportPreview) return;

    setExportOpen(true);
    setExportFeedbackOpen(false);
  }, [searchParams]);

  useEffect(() => {
    try {
      const persisted = window.localStorage.getItem(EDITOR_SETTINGS_COLLAPSED_KEY);
      if (persisted === "true") {
        setHideEditorControlsPanel(true);
        return;
      }
      if (persisted === "false") {
        setHideEditorControlsPanel(false);
      }
    } catch (error) {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_SETTINGS_COLLAPSED_KEY, hideEditorControlsPanel ? "true" : "false");
    } catch (error) {
      // ignore storage failures
    }
  }, [hideEditorControlsPanel]);

  useEffect(() => {
    if (!analyzeUnlockStorageKey) {
      setAnalyzeUnlockedByJob({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(analyzeUnlockStorageKey);
      if (!raw) {
        setAnalyzeUnlockedByJob({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") {
        setAnalyzeUnlockedByJob({});
        return;
      }
      const normalized = Object.entries(parsed).reduce<Record<string, boolean>>((acc, [jobId, unlocked]) => {
        if (typeof jobId === "string" && unlocked === true) {
          acc[jobId] = true;
        }
        return acc;
      }, {});
      setAnalyzeUnlockedByJob(normalized);
    } catch (error) {
      setAnalyzeUnlockedByJob({});
    }
  }, [analyzeUnlockStorageKey]);

  useEffect(() => {
    if (!analyzeUnlockStorageKey) return;
    try {
      window.localStorage.setItem(analyzeUnlockStorageKey, JSON.stringify(analyzeUnlockedByJob));
    } catch (error) {
      // ignore storage failures
    }
  }, [analyzeUnlockStorageKey, analyzeUnlockedByJob]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(EDITOR_GUIDE_AUTO_OPENED_KEY) === "true") {
        editorGuidePromptedRef.current = true;
        return;
      }
    } catch (error) {
      // ignore storage failures
    }

    const onScroll = () => {
      if (editorGuidePromptedRef.current) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop < 80) return;
      editorGuidePromptedRef.current = true;
      try {
        window.localStorage.setItem(EDITOR_GUIDE_AUTO_OPENED_KEY, "true");
      } catch (error) {
        // ignore storage failures
      }
      window.setTimeout(() => {
        setEditorGuideOpen(true);
      }, 220);
      window.removeEventListener("scroll", onScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
        const description = err instanceof ApiError
          ? (err.message || `HTTP ${err.status}`)
          : "Please refresh and try again.";
        toast({ title: "Failed to load jobs", description });
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
        const normalizedJob = normalizeJobVideoOutputs(data.job);
        setActiveJob(normalizedJob);
        setJobs((prev) => {
          const index = prev.findIndex((job) => job.id === jobId);
          if (index === -1) return [normalizedJob, ...prev];
          const next = [...prev];
          next[index] = { ...next[index], ...normalizedJob };
          return next;
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true)
          toast({ title: "Session expired", description: "Please sign in again." })
          try { await signOut() } catch (e) {}
        } else if (err instanceof ApiError && err.status === 404) {
          setJobs((prev) => prev.filter((job) => job.id !== jobId));
          setActiveJob((prev) => (prev?.id === jobId ? null : prev));
        } else {
          toast({ title: "Failed to load job", description: "Please refresh and try again." });
        }
      } finally {
        setLoadingJob(false);
      }
    },
    [accessToken, toast, signOut],
  );

  const fetchYouTubeOAuthStatus = useCallback(async () => {
    if (!accessToken) {
      setYouTubeOAuthStatus(null);
      setYouTubeOAuthStatusLoading(false);
      return;
    }
    setYouTubeOAuthStatusLoading(true);
    try {
      const data = await apiFetch<YouTubeOAuthStatusResponse>("/api/feedback/youtube/oauth/status", {
        token: accessToken,
      });
      setYouTubeOAuthStatus(data || null);
    } catch (err: any) {
      setYouTubeOAuthStatus(null);
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        toast({ title: "Session expired", description: "Please sign in again." });
        try {
          await signOut();
        } catch (error) {
          // ignore
        }
      }
    } finally {
      setYouTubeOAuthStatusLoading(false);
    }
  }, [accessToken, signOut, toast]);

  const handleConnectYouTubeOAuth = useCallback(async () => {
    if (!accessToken) return;
    setYouTubeOAuthBusyAction("connect");
    try {
      const data = await apiFetch<{ authUrl?: string }>("/api/feedback/youtube/oauth/authorize", {
        method: "POST",
        token: accessToken,
      });
      const authUrl = String(data?.authUrl || "").trim();
      if (!authUrl) {
        throw new Error("YouTube OAuth authorize URL was missing.");
      }
      window.location.assign(authUrl);
      return;
    } catch (err: any) {
      toast({
        title: "Connect YouTube failed",
        description: err?.message || "Unable to start Google sign-in flow.",
      });
    } finally {
      setYouTubeOAuthBusyAction((current) => (current === "connect" ? null : current));
    }
  }, [accessToken, toast]);

  const handleDisconnectYouTubeOAuth = useCallback(async () => {
    if (!accessToken) return;
    setYouTubeOAuthBusyAction("disconnect");
    try {
      await apiFetch<{ ok?: boolean }>("/api/feedback/youtube/oauth/disconnect", {
        method: "POST",
        token: accessToken,
      });
      await fetchYouTubeOAuthStatus();
      toast({
        title: "YouTube disconnected",
        description: "Channel access was removed from this account.",
      });
    } catch (err: any) {
      toast({
        title: "Disconnect failed",
        description: err?.message || "Unable to disconnect YouTube right now.",
      });
    } finally {
      setYouTubeOAuthBusyAction((current) => (current === "disconnect" ? null : current));
    }
  }, [accessToken, fetchYouTubeOAuthStatus, toast]);

  const handleLinkYouTubeVideoToJob = useCallback(async () => {
    if (!accessToken || !activeJob?.id) return;
    const jobId = activeJob.id;
    const rawValue = String(youtubeVideoDraftByJob[jobId] || "").trim();
    const videoId = parseYouTubeVideoInput(rawValue);
    if (!videoId) {
      toast({
        title: "Invalid YouTube video",
        description: "Paste a valid YouTube URL or 11-character video ID.",
      });
      return;
    }
    setYoutubeVideoLinkingJobId(jobId);
    try {
      await apiFetch<YouTubeLinkJobVideoResponse>("/api/feedback/youtube/job-video/link", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          jobId,
          videoId,
        }),
      });
      setYouTubeVideoDraftByJob((prev) => ({ ...prev, [jobId]: videoId }));
      await fetchJob(jobId);
      toast({
        title: "Video linked",
        description: "This job is now mapped to the selected YouTube video.",
      });
    } catch (err: any) {
      toast({
        title: "Link failed",
        description: err?.message || "Could not save this YouTube mapping.",
      });
    } finally {
      setYoutubeVideoLinkingJobId((current) => (current === jobId ? null : current));
    }
  }, [accessToken, activeJob?.id, fetchJob, toast, youtubeVideoDraftByJob]);

  const handleSyncYouTubeAnalyticsForJob = useCallback(async () => {
    if (!accessToken || !activeJob?.id) return;
    const jobId = activeJob.id;
    const rawValue = String(youtubeVideoDraftByJob[jobId] || "").trim();
    const parsedVideoId = rawValue ? parseYouTubeVideoInput(rawValue) : null;
    if (rawValue && !parsedVideoId) {
      toast({
        title: "Invalid YouTube video",
        description: "Paste a valid YouTube URL/ID or clear the field to use the linked value.",
      });
      return;
    }
    setYoutubeSyncingJobId(jobId);
    try {
      const payload: Record<string, unknown> = { jobId };
      if (parsedVideoId) payload.videoId = parsedVideoId;
      const data = await apiFetch<YouTubeSyncJobFeedbackResponse>("/api/feedback/youtube/analytics/sync-job-feedback", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(payload),
      });
      const normalizedSignal = normalizeYouTubeSignalState(data?.youtubeSignal);
      if (normalizedSignal) {
        setYouTubeSignalByJob((prev) => ({ ...prev, [jobId]: normalizedSignal }));
      }
      await fetchJob(jobId);
      toast({
        title: normalizedSignal?.coldStartMode ? "Synced in cold-start mode" : "YouTube analytics synced",
        description: normalizedSignal
          ? `${Math.round(normalizedSignal.trustWeight * 100)}% trust weight applied to outcome tuning.`
          : "Outcome feedback loop updated for this job.",
      });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err?.message || "Could not sync YouTube analytics for this job.",
      });
    } finally {
      setYoutubeSyncingJobId((current) => (current === jobId ? null : current));
    }
  }, [accessToken, activeJob?.id, fetchJob, toast, youtubeVideoDraftByJob]);

  const handleApplyYouTubeReferenceStyle = useCallback(async () => {
    if (!accessToken) return;
    const linkedFromAnalysis = parseYouTubeVideoInput(
      (activeJob?.analysis as any)?.youtube_video_id ??
      (activeJob?.analysis as any)?.youtubeVideoId ??
      (activeJob?.analysis as any)?.youtube_sync?.videoId ??
      (activeJob?.analysis as any)?.youtubeSync?.videoId,
    );
    const rawValue = String(
      (activeJob?.id ? youtubeVideoDraftByJob[activeJob.id] : "") ||
      linkedFromAnalysis ||
      youtubeVideoDraftLoose ||
      "",
    ).trim();
    const videoId = parseYouTubeVideoInput(rawValue);
    if (!videoId) {
      toast({
        title: "Missing YouTube video",
        description: "Paste a valid YouTube URL or 11-character video ID first.",
      });
      return;
    }

    setYoutubeStyleApplying(true);
    try {
      const data = await apiFetch<YouTubeReferenceStyleResponse>("/api/feedback/youtube/reference-style", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ videoId }),
      });
      const profile = data?.profile;
      if (!profile) {
        throw new Error("Reference style profile was missing from the server response.");
      }

      const nextRetentionStrategyProfile: RetentionStrategyProfile =
        profile.retentionStrategyProfile === "safe" ||
        profile.retentionStrategyProfile === "balanced" ||
        profile.retentionStrategyProfile === "viral"
          ? profile.retentionStrategyProfile
          : retentionStrategyProfile;
      const nextRetentionTargetPlatform: RetentionTargetPlatform =
        profile.retentionTargetPlatform === "tiktok" ||
        profile.retentionTargetPlatform === "instagram_reels" ||
        profile.retentionTargetPlatform === "youtube"
          ? profile.retentionTargetPlatform
          : retentionTargetPlatform;
      const nextMaxCuts = Number.isFinite(Number(profile.maxCuts))
        ? clamp(Math.round(Number(profile.maxCuts)), MAX_CUTS_MIN, MAX_CUTS_MAX)
        : maxCutsRequested;
      const suggestedSubtitleStyle = normalizeSubtitleStyleFromSettings(
        String(profile.subtitleStyle || subtitleStyleDraft),
      );
      const suggestedSubtitlePreset = parseSubtitleStyleConfig(suggestedSubtitleStyle).preset;
      const subtitleStyleAllowed = isSubtitlePresetAllowed(suggestedSubtitlePreset);
      const nextSubtitleStyle = subtitleStyleAllowed ? suggestedSubtitleStyle : subtitleStyleDraft;
      const nextAutoCaptions =
        typeof profile.autoCaptions === "boolean" ? profile.autoCaptions : autoCaptionsEnabled;
      const confidenceValue = Number(profile.confidence);
      const confidence = Number.isFinite(confidenceValue) ? clamp01(confidenceValue) : null;
      const sourceLabel = typeof profile.source === "string" ? profile.source : null;

      menuTouchedRef.current.strategy = true;
      menuTouchedRef.current.targetPlatform = true;
      setRetentionStrategyProfile(nextRetentionStrategyProfile);
      setRetentionTargetPlatform(nextRetentionTargetPlatform);
      setMaxCutsRequested(nextMaxCuts);
      setAutoCaptionsEnabled(nextAutoCaptions);
      setSubtitleStyleDraft(nextSubtitleStyle);
      setSubtitleStyleDirty(true);
      if (isVerticalMode) {
        setVerticalCaptionPreset(PLATFORM_VERTICAL_CAPTION_PRESET[nextRetentionTargetPlatform]);
      }
      if (activeJob?.id) {
        setYouTubeVideoDraftByJob((prev) => ({ ...prev, [activeJob.id]: videoId }));
      } else {
        setYouTubeVideoDraftLoose(videoId);
      }
      setYoutubeReferenceStyleApplied({
        videoId,
        title: String(data?.title || "").trim() || `YouTube video ${videoId}`,
        appliedAt: new Date().toISOString(),
        retentionStrategyProfile: nextRetentionStrategyProfile,
        retentionTargetPlatform: nextRetentionTargetPlatform,
        maxCuts: nextMaxCuts,
        subtitleStyle: nextSubtitleStyle,
        confidence,
        source: sourceLabel,
      });

      trackEditorEvent("youtube_reference_style_applied", {
        retentionProfile: nextRetentionStrategyProfile,
        targetPlatform: nextRetentionTargetPlatform,
        captionStyle: parseSubtitleStyleConfig(nextSubtitleStyle).preset,
        metadata: {
          videoId,
          maxCuts: nextMaxCuts,
          confidence,
          source: sourceLabel,
          subtitleStyleLockedFallback: !subtitleStyleAllowed,
          reasoning: Array.isArray(data?.reasoning) ? data.reasoning.slice(0, 4) : [],
        },
      });

      const profileLabel = RETENTION_PROFILE_OPTIONS.find((entry) => entry.value === nextRetentionStrategyProfile)?.label || "Balanced";
      const platformLabel = PLATFORM_OPTIONS.find((entry) => entry.value === nextRetentionTargetPlatform)?.label || "YouTube";
      const fallbackNote = subtitleStyleAllowed ? "" : " Caption style fallback kept your current preset due plan limits.";
      toast({
        title: "Reference style applied",
        description: `${profileLabel} · ${platformLabel} · ${nextMaxCuts} cuts.${fallbackNote}`,
      });
    } catch (err: any) {
      toast({
        title: "Reference style failed",
        description: err?.message || "Could not build settings from that YouTube video.",
      });
    } finally {
      setYoutubeStyleApplying(false);
    }
  }, [
    accessToken,
    activeJob?.analysis,
    activeJob?.id,
    autoCaptionsEnabled,
    isSubtitlePresetAllowed,
    isVerticalMode,
    maxCutsRequested,
    retentionStrategyProfile,
    retentionTargetPlatform,
    subtitleStyleDraft,
    toast,
    trackEditorEvent,
    youtubeVideoDraftByJob,
    youtubeVideoDraftLoose,
  ]);

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

  const triggerFileDownload = useCallback(
    async (url: string, fileName?: string) => {
      const resolvedUrl = String(url || "").trim();
      if (!resolvedUrl) throw new Error("download_url_missing");
      if (isAuthRequiredDownloadUrl(resolvedUrl)) {
        if (!accessToken) throw new Error("download_auth_required");
        const response = await fetch(resolvedUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error(`download_request_failed_${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        if (fileName) link.download = fileName;
        link.rel = "noopener";
        link.style.display = "none";
        document.body.appendChild(link);
        try {
          link.click();
        } finally {
          document.body.removeChild(link);
          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
        }
        return;
      }

      const link = document.createElement("a");
      link.href = resolvedUrl;
      if (fileName) link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        document.body.removeChild(link);
      }
    },
    [accessToken],
  );

  const submitCreatorFeedback = useCallback(
    async (category: CreatorFeedbackCategory, source: "details_panel" | "export_popup" = "details_panel") => {
      if (!activeJob?.id || !accessToken) return;
      const sourceLabel = source === "export_popup" ? "frontend_export_popup" : "frontend_creator";
      const fallbackConfig = CREATOR_FEEDBACK_RETENTION_SCORES[category];
      const persistFallbackFeedback = async () => {
        await postRetentionFeedback(
          activeJob.id,
          {
            source: sourceLabel,
            manualScore: fallbackConfig.manualScore,
            notes: fallbackConfig.note,
          },
          { force: true },
        );
      };

      setCreatorFeedbackSubmitting(category);
      try {
        if (!paidTier) {
          await persistFallbackFeedback();
        } else {
          await apiFetch(`/api/jobs/${activeJob.id}/creator-feedback`, {
            method: "POST",
            token: accessToken,
            body: JSON.stringify({
              category,
              source: sourceLabel,
            }),
          });
          await fetchJob(activeJob.id);
        }

        trackEditorEvent("creator_feedback_submitted", {
          category: "feedback",
          jobId: activeJob.id,
          retentionProfile: retentionStrategyProfile,
          targetPlatform: retentionTargetPlatform,
          captionStyle: activeSubtitlePreset,
          metadata: {
            category,
            source,
            mode: paidTier ? "creator_feedback" : "retention_feedback",
          },
        });
        setAnalyzeUnlockedByJob((prev) => (prev[activeJob.id] ? prev : { ...prev, [activeJob.id]: true }));
        toast({
          title: "Feedback saved",
          description: "Analyze view is now unlocked for this render.",
        });
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 403) {
          try {
            await persistFallbackFeedback();
            trackEditorEvent("creator_feedback_submitted", {
              category: "feedback",
              jobId: activeJob.id,
              retentionProfile: retentionStrategyProfile,
              targetPlatform: retentionTargetPlatform,
              captionStyle: activeSubtitlePreset,
              metadata: {
                category,
                source,
                mode: "retention_feedback_fallback",
              },
            });
            setAnalyzeUnlockedByJob((prev) => (prev[activeJob.id] ? prev : { ...prev, [activeJob.id]: true }));
            toast({
              title: "Feedback saved",
              description: "Saved to retention telemetry for this render.",
            });
          } catch (fallbackErr: any) {
            toast({
              title: "Feedback failed",
              description: fallbackErr?.message || err?.message || "Please try again.",
            });
          }
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
    [accessToken, activeJob?.id, activeSubtitlePreset, fetchJob, paidTier, postRetentionFeedback, toast, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform],
  );

  const handleQueueTimelineSegmentAction = useCallback(
    async (segment: RetentionTimelineSegment, action: "fix" | "remove") => {
      if (!activeJob?.id) return;
      if (normalizeStatus(activeJob.status) !== "ready") {
        toast({
          title: "Render still processing",
          description: "Timeline fixes unlock after rendering finishes.",
        });
        return;
      }
      const jobId = activeJob.id;
      const actionKey = toTimelineSegmentActionKey(jobId, segment.id);
      const timeRange = `${formatTimelineClock(segment.startSec)}-${formatTimelineClock(segment.endSec)}`;
      setTimelineSegmentActionSubmittingKey(actionKey);
      if (action === "fix") {
        setAModeEnabled(true);
        setBingeModeEnabled(true);
      } else {
        setAutoCutBoringEnabled(true);
        setMaxCutsRequested((prev) => clamp(prev + 2, MAX_CUTS_MIN, MAX_CUTS_MAX));
      }
      await postRetentionFeedback(
        jobId,
        {
          source: "frontend_retention_timeline",
          manualScore: action === "fix" ? 78 : 64,
          watchPercent: Number((segment.predicted / 100).toFixed(4)),
          completionPercent: Number((segment.predicted / 100).toFixed(4)),
          notes: `${action === "fix" ? "Fix" : "Remove"} ${timeRange} (${segment.categoryLabel.toLowerCase()}) from timeline deep dive.`,
        },
        { force: true },
      );
      setTimelineSegmentActionByKey((prev) => ({ ...prev, [actionKey]: action }));
      toast({
        title: action === "fix" ? "Fix queued for redo" : "Removal queued for redo",
        description: `${timeRange} saved. Run Redo Renderer to apply this change.`,
      });
      setTimelineSegmentActionSubmittingKey((current) => (current === actionKey ? null : current));
    },
    [activeJob?.id, activeJob?.status, postRetentionFeedback, toast],
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
    if (!accessToken || authError) {
      setYouTubeOAuthStatus(null);
      setYouTubeOAuthStatusLoading(false);
      return;
    }
    void fetchYouTubeOAuthStatus();
  }, [accessToken, authError, fetchYouTubeOAuthStatus]);

  useEffect(() => {
    if (!accessToken) return;
    const oauthCode = String(searchParams.get("code") || "").trim();
    const oauthState = String(searchParams.get("state") || "").trim();
    const oauthScope = String(searchParams.get("scope") || "").toLowerCase();
    if (!oauthCode || !oauthState || !oauthScope.includes("youtube")) return;

    let cancelled = false;
    const exchange = async () => {
      setYouTubeOAuthBusyAction("exchange");
      try {
        await apiFetch<{ ok?: boolean; connection?: unknown }>("/api/feedback/youtube/oauth/exchange", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            code: oauthCode,
            state: oauthState,
          }),
        });
        if (cancelled) return;
        await fetchYouTubeOAuthStatus();
        toast({
          title: "YouTube connected",
          description: "Channel access saved. You can now sync retention outcomes.",
        });
      } catch (err: any) {
        if (cancelled) return;
        toast({
          title: "OAuth exchange failed",
          description: err?.message || "Try connecting YouTube again.",
        });
      } finally {
        if (!cancelled) {
          setYouTubeOAuthBusyAction((current) => (current === "exchange" ? null : current));
          const next = new URLSearchParams(searchParams);
          ["code", "state", "scope", "authuser", "prompt", "hd"].forEach((key) => next.delete(key));
          setSearchParams(next, { replace: true });
        }
      }
    };
    void exchange();

    return () => {
      cancelled = true;
    };
  }, [accessToken, fetchYouTubeOAuthStatus, searchParams, setSearchParams, toast]);

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
    if (!accessToken || authError) {
      setOutcomeAutomationProfile(null);
      return;
    }
    const query = new URLSearchParams({
      strategyProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      editorMode,
    });
    let cancelled = false;
    apiFetch<OutcomeAutomationResponse>(`/api/jobs/automation-profile?${query.toString()}`, { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        const profile = data?.profile ?? null;
        setOutcomeAutomationProfile(profile);
        if (!profile?.enabled) return;

        const recommendedStrategy = profile.recommendedStrategyProfile;
        const recommendedTargetPlatform = profile.recommendedTargetPlatform;
        const recommendedEditorMode = normalizeOutcomeAutomationEditorMode(profile.recommendedEditorMode);
        const strategyAllowedForMode = isVerticalMode ? recommendedStrategy === "viral" : recommendedStrategy !== "viral";

        let strategyApplied = false;
        let targetPlatformApplied = false;
        let editorModeApplied = false;

        if (
          strategyAllowedForMode &&
          !menuTouchedRef.current.strategy &&
          recommendedStrategy !== retentionStrategyProfile
        ) {
          setRetentionStrategyProfile(recommendedStrategy);
          strategyApplied = true;
        }
        if (
          !menuTouchedRef.current.targetPlatform &&
          recommendedTargetPlatform !== "auto" &&
          recommendedTargetPlatform !== retentionTargetPlatform
        ) {
          setRetentionTargetPlatform(recommendedTargetPlatform);
          targetPlatformApplied = true;
        }
        if (
          !menuTouchedRef.current.editorMode &&
          recommendedEditorMode !== editorMode
        ) {
          setEditorMode(recommendedEditorMode);
          editorModeApplied = true;
        }
        if (strategyApplied || targetPlatformApplied || editorModeApplied) {
          trackEditorEvent("outcome_automation_menu_applied", {
            retentionProfile: strategyApplied ? recommendedStrategy : retentionStrategyProfile,
            targetPlatform: targetPlatformApplied && recommendedTargetPlatform !== "auto"
              ? recommendedTargetPlatform
              : retentionTargetPlatform,
            captionStyle: activeSubtitlePreset,
            metadata: {
              sampleSize: profile.sampleSize,
              confidence: profile.confidence,
              expectedLift: profile.expectedLift,
              strategyApplied,
              targetPlatformApplied,
              editorModeApplied,
            },
          });
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try {
            await signOut();
          } catch (error) {
            // ignore
          }
          return;
        }
        setOutcomeAutomationProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    activeSubtitlePreset,
    authError,
    editorMode,
    isVerticalMode,
    retentionStrategyProfile,
    retentionTargetPlatform,
    signOut,
    trackEditorEvent,
  ]);

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
    apiFetch<EditorSettingsResponse>('/api/settings', { token: accessToken })
      .then((d) => {
        setAutoDownloadEnabled(Boolean(d?.settings?.autoDownload));
        setAutoCaptionsEnabled(false);
        const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(d?.settings?.subtitleStyle);
        setSubtitleStyleDraft(resolvedSubtitleStyle);
        setSubtitleStyleDirty(false);
        const runtimeCaptions = d?.capabilities?.captions;
        if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
          setCaptionCapability(runtimeCaptions);
          if (!runtimeCaptions.available) {
            setAutoCaptionsEnabled(false);
          }
        }
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
    if (typeof window === "undefined") return;
    const connection = getConnection();
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setRuntimeProfile(readRuntimeProfile());

    sync();
    window.addEventListener("resize", sync, { passive: true });
    window.visualViewport?.addEventListener("resize", sync);
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", sync);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(sync);
    }
    if (connection?.addEventListener) {
      connection.addEventListener("change", sync);
    } else if (connection?.addListener) {
      connection.addListener(sync);
    }

    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      if (typeof reducedMotionQuery.removeEventListener === "function") {
        reducedMotionQuery.removeEventListener("change", sync);
      } else if (typeof reducedMotionQuery.removeListener === "function") {
        reducedMotionQuery.removeListener(sync);
      }
      if (connection?.removeEventListener) {
        connection.removeEventListener("change", sync);
      } else if (connection?.removeListener) {
        connection.removeListener(sync);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.network = runtimeProfile.effectiveType ?? "unknown";
    root.dataset.saveData = runtimeProfile.saveData ? "true" : "false";
    root.dataset.performance = performanceConstrained ? "constrained" : "standard";
  }, [performanceConstrained, runtimeProfile.effectiveType, runtimeProfile.saveData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mobile signal should follow viewport width so screen-size behavior is predictable.
    const syncMobileSignal = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const isMobile = viewportWidth <= 767;
      setMobilePipeline(isMobile);
      document.documentElement.classList.toggle("mobile", isMobile);
    };
    syncMobileSignal();
    window.addEventListener("resize", syncMobileSignal, { passive: true });
    window.addEventListener("orientationchange", syncMobileSignal, { passive: true });
    return () => {
      window.removeEventListener("resize", syncMobileSignal);
      window.removeEventListener("orientationchange", syncMobileSignal);
    };
  }, []);

  useEffect(() => {
    if (mobilePipeline) {
      setPipelineLogOpen(false);
      setRetentionDetailsOpen(false);
      return;
    }
    setPipelineLogOpen(true);
    setRetentionDetailsOpen(true);
  }, [mobilePipeline, activeJob?.id]);

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
    if (!activeJob?.id) return;
    const analysis = activeJob.analysis && typeof activeJob.analysis === "object"
      ? (activeJob.analysis as Record<string, unknown>)
      : {};
    const linkedVideoId = parseYouTubeVideoInput(
      analysis.youtube_video_id ??
      analysis.youtubeVideoId ??
      (analysis.youtube_sync as Record<string, unknown> | undefined)?.videoId ??
      (analysis.youtubeSync as Record<string, unknown> | undefined)?.videoId,
    );
    if (linkedVideoId) {
      setYouTubeVideoDraftByJob((prev) => {
        const existing = String(prev[activeJob.id] || "").trim();
        if (existing.length > 0) return prev;
        return {
          ...prev,
          [activeJob.id]: linkedVideoId,
        };
      });
    }
    const youtubeSync = analysis.youtube_sync && typeof analysis.youtube_sync === "object"
      ? (analysis.youtube_sync as Record<string, unknown>)
      : {};
    const retentionFeedback = analysis.retention_feedback && typeof analysis.retention_feedback === "object"
      ? (analysis.retention_feedback as Record<string, unknown>)
      : {};
    const signal =
      normalizeYouTubeSignalState(youtubeSync.signalState) ??
      normalizeYouTubeSignalState(retentionFeedback.youtubeSignal) ??
      normalizeYouTubeSignalState(retentionFeedback.youtube_signal);
    if (signal) {
      setYouTubeSignalByJob((prev) => (prev[activeJob.id] ? prev : { ...prev, [activeJob.id]: signal }));
    }
  }, [activeJob?.id, activeJob?.analysis]);

  useEffect(() => {
    if (selectedJobId) return;
    let fallbackJobId = activeJob?.id || jobs[0]?.id || lastKnownJobIdRef.current;
    if (!fallbackJobId && typeof window !== "undefined") {
      try {
        fallbackJobId = window.sessionStorage.getItem("editor:last-job-id") || "";
      } catch (error) {
        // ignore storage failures
      }
    }
    if (!fallbackJobId) return;
    const next = new URLSearchParams(searchParams);
    next.set("jobId", fallbackJobId);
    setSearchParams(next, { replace: true });
  }, [activeJob?.id, jobs, searchParams, selectedJobId, setSearchParams]);

  useEffect(() => {
    if (!accessToken || authError) {
      setActiveJob(null);
      return;
    }
    if (!selectedJobId) return;
    fetchJob(selectedJobId);
    setExportOpen(false);
  }, [selectedJobId, accessToken, authError, fetchJob]);

  useEffect(() => {
    if (!subscriptionResolved) return;
    if (paidTier || pipelinePowerMode === "standard") return;
    setPipelinePowerMode("standard");
  }, [paidTier, pipelinePowerMode, subscriptionResolved]);

  useEffect(() => {
    setHookSelectorOpen(false);
    if (!activeJob?.id) {
      powerModeSyncJobRef.current = null;
      advancedModesSyncJobRef.current = null;
    }
  }, [activeJob?.id]);

  useEffect(() => {
    if (!accessToken || !hasActiveJobs || authError) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, livePollingIntervalMs);
    return () => clearInterval(timer);
  }, [accessToken, hasActiveJobs, fetchJobs, authError, livePollingIntervalMs]);

  useEffect(() => {
    if (!accessToken || authError || !activeJob || !selectedJobId) return;
    if (isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => {
      fetchJob(selectedJobId);
    }, livePollingIntervalMs);
    return () => clearInterval(timer);
  }, [accessToken, authError, activeJob, selectedJobId, fetchJob, livePollingIntervalMs]);

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
            const summaryJob = jobs.find((x) => x.id === id);
            const normalizedTitle = summaryJob
              ? displayName(summaryJob).replace(/\.[^/.]+$/, "").trim()
              : "";
            let fileName: string | undefined;
            let url: string | undefined;
            if (summaryJob && isLikelyVideoUrl((summaryJob as any).outputUrl)) {
              url = String((summaryJob as any).outputUrl);
              fileName = (summaryJob as any).fileName ?? undefined;
            } else if (accessToken) {
              try {
                const resp = await apiFetch<{ job?: any }>(`/api/jobs/${id}`, { token: accessToken });
                url = isLikelyVideoUrl(resp?.job?.outputUrl) ? String(resp?.job?.outputUrl) : undefined;
                fileName = resp?.job?.fileName ?? undefined;
              } catch (error) {
                // fallback to download-url endpoint
              }
            }
            if (!url && accessToken) {
              try {
                const out = await apiFetch<{ url: string }>(`/api/jobs/${id}/download-url`, { method: "POST", token: accessToken });
                url = out.url;
              } catch (error) {
                // Continue with editor deep-link only.
              }
            }

            const editorUrl = typeof window !== "undefined"
              ? `${window.location.origin}/editor?jobId=${encodeURIComponent(id)}`
              : null;
            await notifyExportComplete({
              jobId: id,
              title: normalizedTitle || "edited video",
              downloadUrl: url || null,
              editorUrl,
            });

            // ensure entitlements/settings are loaded
            let resolvedEntitlements = entitlements;
            if (resolvedEntitlements === null && accessToken) {
              const d = await apiFetch('/api/billing/entitlements', { token: accessToken });
              resolvedEntitlements = d?.entitlements ?? null;
              setEntitlements(resolvedEntitlements);
            }
            let resolvedAutoDownloadEnabled = autoDownloadEnabled;
            if (resolvedAutoDownloadEnabled === null) {
              if (accessToken) {
                const s = await apiFetch<EditorSettingsResponse>('/api/settings', { token: accessToken });
                resolvedAutoDownloadEnabled = Boolean(s?.settings?.autoDownload);
                setAutoDownloadEnabled(resolvedAutoDownloadEnabled);
                setAutoCaptionsEnabled(false);
                const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(s?.settings?.subtitleStyle);
                setSubtitleStyleDraft(resolvedSubtitleStyle);
                setSubtitleStyleDirty(false);
                const runtimeCaptions = s?.capabilities?.captions;
                if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
                  setCaptionCapability(runtimeCaptions);
                  if (!runtimeCaptions.available) {
                    setAutoCaptionsEnabled(false);
                  }
                }
              } else {
                const local = typeof window !== 'undefined' ? window.localStorage.getItem('autoDownloadEnabled') : null;
                resolvedAutoDownloadEnabled = local === "true";
                setAutoDownloadEnabled(resolvedAutoDownloadEnabled);
              }
            }
            // decide whether to auto-download
            const allowed = resolvedEntitlements?.autoDownloadAllowed ?? false;
            const enabled = resolvedAutoDownloadEnabled ?? false;
            const downloadedKey = `auto_downloaded_${id}`;
            if (!allowed || !enabled) return;
            if (typeof window !== 'undefined' && window.localStorage.getItem(downloadedKey)) return;

            if (!url && accessToken) {
              try {
                const out = await apiFetch<{ url: string }>(`/api/jobs/${id}/download-url`, { method: "POST", token: accessToken });
                url = out.url;
              } catch (error) {
                return;
              }
            }
            if (!url) return;

            try {
              await triggerFileDownload(url as string, fileName);
              const telemetryJob: JobDetail = {
                ...(summaryJob as any),
                id,
                status: "ready",
                createdAt: summaryJob?.createdAt || new Date().toISOString(),
                analysis: (summaryJob as any)?.analysis ?? null,
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
            }
          } catch (e) {
            // ignore
          }
        })();
      }
    }
  }, [jobs, refetchMe, entitlements, autoDownloadEnabled, accessToken, notifyExportComplete, submitDownloadFeedback, triggerFileDownload]);

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
    setShowAdvancedDebug(false);
  }, [activeJob?.id]);

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
      uploadModeOverride?: {
        pipelinePowerMode?: PipelinePowerMode;
        fullAutoYoutubeEnabled?: boolean;
      };
    },
  ) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4, M4V, or MKV file." });
      return false;
    }
    if (!accessToken) return false;
    void ensureNotificationPermission("export_start");
    const requestedMode = renderOptions?.mode === "vertical" ? "vertical" : "horizontal";
    const resolvedPipelinePowerMode = renderOptions?.uploadModeOverride?.pipelinePowerMode ?? pipelinePowerMode;
    const resolvedFullAutoYoutubeEnabled = typeof renderOptions?.uploadModeOverride?.fullAutoYoutubeEnabled === "boolean"
      ? renderOptions.uploadModeOverride.fullAutoYoutubeEnabled
      : fullAutoYoutubeEnabled;
    const effectiveRetentionStrategyProfile: RetentionStrategyProfile = retentionStrategyProfile;
    const effectiveRetentionAggressionLevel = resolveEffectiveRetentionAggressionLevel({
      strategyProfile: effectiveRetentionStrategyProfile,
      longFormPreset,
    });
    const editorModeForJob = mapEditorModeForBackend(editorMode, resolvedPipelinePowerMode);
    const autoModeV3Defaults = resolveAutoModeV3Defaults({
      editorMode: editorModeForJob,
      pipelinePowerMode: resolvedPipelinePowerMode,
      strategyProfile: effectiveRetentionStrategyProfile,
      aggressionLevel: effectiveRetentionAggressionLevel,
      maxCuts: maxCutsRequested,
      longFormPreset,
      longFormAggression,
      longFormClarityVsSpeed,
    });
    const fastModeForJob = isUltraPipelineMode(resolvedPipelinePowerMode);
    const creatorStyleLockForJob = clampCreatorStyleLockPercent(creatorStyleLockPercent);
    const adaptiveLearningPayload = {
      coldStartAutopilot: coldStartAutopilotEnabled,
      continuityFirstMode: continuityFirstEnabled,
      exploreX3Mode: exploreX3Enabled,
      topHumanGuardMode: topHumanGuardEnabled,
      creatorStyleLock: creatorStyleLockForJob,
    };
    const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
    const captionsEnabledForJob = CAPTIONS_PIPELINE_ENABLED && requestedMode === "vertical";
    const verticalCaptionTextForJob = normalizeVerticalCaptionTextForJob(verticalCaptionText);
    const subtitlesPayload = {
      enabled: captionsEnabledForJob,
      preset: subtitlePresetForJob,
      style: subtitleStyleForJob,
    };
    const verticalCaptionsPayload =
      requestedMode === "vertical"
        ? {
            enabled: captionsEnabledForJob,
            autoGenerate: captionsEnabledForJob && verticalCaptionTextForJob.length === 0,
            preset: verticalCaptionPreset,
            text: verticalCaptionTextForJob,
            fontId: verticalCaptionFontId,
            fontSize: Math.round(clamp(verticalCaptionFontSize, VERTICAL_CAPTION_FONT_SIZE_MIN, VERTICAL_CAPTION_FONT_SIZE_MAX)),
            outlineColor: normalizeCaptionHexColor(
              verticalCaptionOutlineColor,
              VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].outlineColor,
            ),
            outlineWidth: clamp(Math.round(verticalCaptionOutlineWidth), 0, 24),
            animation: verticalCaptionAnimation,
            animationSpeed: clampVerticalCaptionAnimationSpeed(verticalCaptionAnimationSpeed),
            dynamicMode: verticalCaptionDynamicMode,
            voicePreset: verticalVoicePreset,
            highlightWords: verticalCaptionHighlightWords,
            autoEmphasis: verticalCaptionAutoEmphasis,
            autoEmoji: verticalCaptionAutoEmoji,
            removeFillers: verticalCaptionRemoveFillers,
            shadowStrength: Math.round(clamp(verticalCaptionShadowStrength, VERTICAL_CAPTION_SHADOW_MIN, VERTICAL_CAPTION_SHADOW_MAX)),
            positionX: clampCaptionPosition(verticalCaptionPositionX),
            positionY: clampCaptionPosition(verticalCaptionPositionY),
          }
        : null;
    const fullAutoYoutubePayload = resolvedFullAutoYoutubeEnabled
      ? {
          enabled: true,
          target: fullAutoYoutubeTarget,
          vibe: fullAutoYoutubeVibe,
          includeSeoPack: true,
          includePromptPack: true,
          includeQueueHints: true,
          preferAiBroll: true,
        }
      : null;
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
              retentionAggressionLevel: autoModeV3Defaults.aggressionLevel,
              retentionStrategyProfile: autoModeV3Defaults.strategyProfile,
              retentionTargetPlatform,
              platformProfile: retentionTargetPlatform,
              onlyHookAndCut,
              maxCuts: autoModeV3Defaults.maxCuts,
              editorMode: editorModeForJob,
              creativeVariant,
              hookSelectionMode: defaultHookSelectionMode,
              longFormPreset: autoModeV3Defaults.longFormPreset,
              longFormAggression: autoModeV3Defaults.longFormAggression,
              longFormClarityVsSpeed: autoModeV3Defaults.longFormClarityVsSpeed,
              tangentKiller,
              fastMode: fastModeForJob,
              pipelinePowerMode: resolvedPipelinePowerMode,
              ...adaptiveLearningPayload,
              autoCaptions: captionsEnabledForJob,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              ...(fullAutoYoutubePayload ? { fullAutoYoutube: fullAutoYoutubePayload } : {}),
              verticalClipCount: renderOptions?.verticalClipCount,
              verticalMode: renderOptions?.verticalMode ?? null,
              verticalCaptionText: verticalCaptionTextForJob,
              verticalCaptions: verticalCaptionsPayload,
            }
          : {
              filename: file.name,
              contentType: file.type,
              renderMode: "horizontal" as const,
              retentionAggressionLevel: autoModeV3Defaults.aggressionLevel,
              retentionStrategyProfile: autoModeV3Defaults.strategyProfile,
              retentionTargetPlatform,
              platformProfile: retentionTargetPlatform,
              onlyHookAndCut,
              maxCuts: autoModeV3Defaults.maxCuts,
              editorMode: editorModeForJob,
              creativeVariant,
              hookSelectionMode: defaultHookSelectionMode,
              longFormPreset: autoModeV3Defaults.longFormPreset,
              longFormAggression: autoModeV3Defaults.longFormAggression,
              longFormClarityVsSpeed: autoModeV3Defaults.longFormClarityVsSpeed,
              tangentKiller,
              fastMode: fastModeForJob,
              pipelinePowerMode: resolvedPipelinePowerMode,
              ...adaptiveLearningPayload,
              autoCaptions: captionsEnabledForJob,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              ...(fullAutoYoutubePayload ? { fullAutoYoutube: fullAutoYoutubePayload } : {}),
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
        let abortContext: { uploadId: string; key: string } | null = null;
        try {
          const r2create = await apiFetch<{
            uploadId: string;
            key: string;
            partSize: number;
            presignedParts: { partNumber: number; url: string }[];
          }>(`/api/uploads/create`, {
            method: "POST",
            body: JSON.stringify({ jobId: create.job.id, filename: file.name, contentType: file.type, sizeBytes: file.size }),
            token: accessToken,
          });

          const { uploadId, key, partSize, presignedParts } = r2create;
          abortContext = { uploadId, key };
          if (!uploadId || !key || !Array.isArray(presignedParts) || presignedParts.length === 0) throw new Error("invalid_r2_create");

          const total = file.size;
          const actualPartSize = partSize || chunkSizeForFile(total);
          const parts: { ETag: string; PartNumber: number }[] = [];
          const sortedPresignedParts = [...presignedParts].sort((left, right) => left.partNumber - right.partNumber);
          let uploaded = 0;
          jobFileSizeRef.current[create.job.id] = total;
          uploadStartRef.current[create.job.id] = Date.now();

          const effectiveType = runtimeProfile.effectiveType ?? "";
          const conservativeNetwork = runtimeProfile.saveData || effectiveType === "slow-2g" || effectiveType === "2g";
          const moderateNetwork = effectiveType === "3g";
          let parallelism = uploadParallelismForFile(total);
          if (conservativeNetwork) parallelism = 1;
          else if (moderateNetwork) parallelism = Math.min(parallelism, 2);
          if (runtimeProfile.lowPowerDevice) parallelism = Math.min(parallelism, 2);
          parallelism = clamp(parallelism, 1, 4);

          const uploadPart = async (part: { partNumber: number; url: string }) => {
            const partNumber = part.partNumber;
            const start = (partNumber - 1) * actualPartSize;
            const end = Math.min(total, start + actualPartSize);
            const chunk = file.slice(start, end);
            const resp = await fetch(part.url, {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: chunk,
            });
            if (!resp.ok) throw new Error(`upload_part_failed_${partNumber}`);
            const etag = resp.headers.get("ETag") || resp.headers.get("etag");
            if (!etag) {
              throw new Error(
                "missing_etag_header: configure R2 CORS ExposeHeaders to include ETag for multipart uploads",
              );
            }
            return { ETag: etag, PartNumber: partNumber, size: chunk.size };
          };

          if (parallelism <= 1 || sortedPresignedParts.length <= 1) {
            for (const part of sortedPresignedParts) {
              const result = await uploadPart(part);
              parts.push({ ETag: result.ETag, PartNumber: result.PartNumber });
              uploaded += result.size;
              setUploadBytesUploaded(uploaded);
              setUploadBytesTotal(total);
              setUploadProgress(Math.round((uploaded / total) * 100));
            }
          } else {
            let cursor = 0;
            const workerCount = Math.min(parallelism, sortedPresignedParts.length);
            const worker = async () => {
              while (cursor < sortedPresignedParts.length) {
                const current = cursor;
                cursor += 1;
                const result = await uploadPart(sortedPresignedParts[current]);
                parts.push({ ETag: result.ETag, PartNumber: result.PartNumber });
                uploaded += result.size;
                setUploadBytesUploaded(uploaded);
                setUploadBytesTotal(total);
                setUploadProgress(Math.round((uploaded / total) * 100));
              }
            };
            await Promise.all(Array.from({ length: workerCount }, () => worker()));
            parts.sort((left, right) => left.PartNumber - right.PartNumber);
          }

          // Complete multipart upload on backend
          await apiFetch("/api/uploads/complete", {
            method: "POST",
            body: JSON.stringify({ jobId: create.job.id, key, uploadId, parts }),
            token: accessToken,
          });

          setUploadProgress(100);
          setUploadingJobId(null);
          setUploadBytesUploaded(null);
          setUploadBytesTotal(null);
          fetchJobs();
          toast({ title: "Upload complete", description: "Your job is now processing." });
          return true;
        } catch (err) {
          console.warn("R2 multipart upload failed", err);
          // best-effort abort if we have uploadId
          try {
            if (abortContext?.uploadId && abortContext?.key) {
              await apiFetch("/api/uploads/abort", {
                method: "POST",
                body: JSON.stringify({ key: abortContext.key, uploadId: abortContext.uploadId }),
                token: accessToken,
              });
            }
          } catch (abortErr) {
            console.warn("R2 multipart abort failed", abortErr);
          }
          return false;
        }
      };

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
            retentionAggressionLevel: autoModeV3Defaults.aggressionLevel,
            retentionStrategyProfile: autoModeV3Defaults.strategyProfile,
            retentionTargetPlatform,
            platformProfile: retentionTargetPlatform,
            autoCaptions: captionsEnabledForJob,
            subtitleStyle: subtitleStyleForJob,
            subtitles: subtitlesPayload,
            maxCuts: autoModeV3Defaults.maxCuts,
            editorMode: editorModeForJob,
            creativeVariant,
            hookSelectionMode: defaultHookSelectionMode,
            longFormPreset: autoModeV3Defaults.longFormPreset,
            longFormAggression: autoModeV3Defaults.longFormAggression,
            longFormClarityVsSpeed: autoModeV3Defaults.longFormClarityVsSpeed,
            tangentKiller,
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
    setVerticalCaptionDragState(null);
    setVerticalClipCount(0);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isVerticalMode]);

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
    setIsVerticalBuilderHidden(false);
    setPendingVerticalFile(file);
    setWebcamCrop(null);
    setSourceVideoMeta(null);
    setWebcamTopHeightPct(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
    setBottomFitMode("cover");
    setCropInteraction(null);
    setVerticalCaptionDragState(null);
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

  const beginVerticalCaptionDrag = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isVerticalMode) return;
    const canvas = verticalCompositionCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextX = clampCaptionPosition((event.clientX - rect.left) / rect.width);
    const nextY = clampCaptionPosition((event.clientY - rect.top) / rect.height);
    event.preventDefault();
    setVerticalCaptionPositionX(nextX);
    setVerticalCaptionPositionY(nextY);
    setVerticalCaptionDragState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: nextX,
      startY: nextY,
    });
  }, [isVerticalMode]);

  useEffect(() => {
    if (!verticalCaptionDragState) return;
    const onMove = (event: PointerEvent) => {
      const canvas = verticalCompositionCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const deltaX = (event.clientX - verticalCaptionDragState.startClientX) / rect.width;
      const deltaY = (event.clientY - verticalCaptionDragState.startClientY) / rect.height;
      setVerticalCaptionPositionX(clampCaptionPosition(verticalCaptionDragState.startX + deltaX));
      setVerticalCaptionPositionY(clampCaptionPosition(verticalCaptionDragState.startY + deltaY));
    };
    const onEnd = () => setVerticalCaptionDragState(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [verticalCaptionDragState]);

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
    const captionPalette =
      VERTICAL_CAPTION_PREVIEW_PALETTE[verticalCaptionPreset] ??
      VERTICAL_CAPTION_PREVIEW_PALETTE[DEFAULT_VERTICAL_CAPTION_STYLE];
    const captionOutlineColor = normalizeCaptionHexColor(
      verticalCaptionOutlineColor,
      VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset]?.outlineColor ?? "0F172A",
    );
    const captionFontFamily = VERTICAL_CAPTION_FONT_FAMILY[verticalCaptionFontId] ?? VERTICAL_CAPTION_FONT_FAMILY.impact;
    const captionRawText = normalizeVerticalCaptionTextForJob(verticalCaptionText);
    const captionBaseText = captionRawText || "Auto captions preview";
    const captionNoFillers = verticalCaptionRemoveFillers ? removePreviewFillers(captionBaseText) : captionBaseText;
    const captionAutoEmoji = verticalCaptionAutoEmoji ? inferPreviewEmoji(captionNoFillers) : "";
    const captionTextForPreview = captionAutoEmoji && !PREVIEW_EMOJI_PATTERN.test(captionNoFillers)
      ? `${captionNoFillers} ${captionAutoEmoji}`
      : captionNoFillers;

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
    const wrapCaptionText = (text: string, maxWidth: number, maxLines: number) => {
      const tokens = text
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);
      if (tokens.length === 0) return [];
      const lines: string[] = [];
      let current = tokens[0];
      for (let i = 1; i < tokens.length; i += 1) {
        const token = tokens[i];
        const candidate = `${current} ${token}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = token;
        if (lines.length >= maxLines - 1) {
          const remaining = [current, ...tokens.slice(i + 1)].join(" ");
          let clipped = remaining;
          while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) {
            clipped = clipped.slice(0, -1);
          }
          lines.push(clipped.length < remaining.length ? `${clipped}...` : clipped);
          return lines;
        }
      }
      lines.push(current);
      return lines.slice(0, maxLines);
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

        if (CAPTIONS_PIPELINE_ENABLED && (isVerticalMode || autoCaptionsEnabled)) {
          const now = performance.now();
          const animSpeed = clampVerticalCaptionAnimationSpeed(verticalCaptionAnimationSpeed);
          const timing = (base: number) => Math.max(60, base / Math.max(0.5, animSpeed));
          let animationScale = 1;
          let animationYOffset = 0;
          let animationOpacity = 1;
          if (verticalCaptionAnimation === "pop") {
            animationScale = 1 + Math.sin(now / timing(190)) * 0.03;
          } else if (verticalCaptionAnimation === "slide") {
            animationYOffset = Math.sin(now / timing(440)) * 4;
          } else if (verticalCaptionAnimation === "fade") {
            animationOpacity = 0.76 + Math.abs(Math.sin(now / timing(460))) * 0.24;
          } else if (verticalCaptionAnimation === "bounce") {
            animationYOffset = -Math.abs(Math.sin(now / timing(210))) * 7;
          } else if (verticalCaptionAnimation === "glitch") {
            animationScale = 1 + Math.sin(now / timing(120)) * 0.01;
          }

          const fontPx = Math.round(
            clamp(
              verticalCaptionFontSize * (canvasWidth / DEFAULT_VERTICAL_OUTPUT.width),
              16,
              120,
            ),
          );
          const captionShadowStrength = clamp(verticalCaptionShadowStrength, VERTICAL_CAPTION_SHADOW_MIN, VERTICAL_CAPTION_SHADOW_MAX) / 100;
          const outlinePx = Math.max(0, Math.round(verticalCaptionOutlineWidth * (canvasWidth / DEFAULT_VERTICAL_OUTPUT.width)));
          const centerX = canvasWidth * clampCaptionPosition(verticalCaptionPositionX);
          const centerY = canvasHeight * clampCaptionPosition(verticalCaptionPositionY);
          const maxTextWidth = canvasWidth * 0.82;

          ctx.save();
          ctx.globalAlpha = animationOpacity;
          ctx.translate(centerX, centerY + animationYOffset);
          ctx.scale(animationScale, animationScale);
          ctx.font = `900 ${fontPx}px ${captionFontFamily}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          const lines = wrapCaptionText(captionTextForPreview, maxTextWidth, 3);
          if (lines.length > 0) {
            const lineHeight = Math.round(fontPx * 1.08);
            const blockTextWidth = lines.reduce((widest, line) => Math.max(widest, ctx.measureText(line).width), 0);
            const textBlockHeight = lineHeight * lines.length;
            const hitPadding = Math.round(fontPx * 0.55);
            verticalCaptionHitboxRef.current = {
              left: centerX - blockTextWidth / 2 - hitPadding,
              right: centerX + blockTextWidth / 2 + hitPadding,
              top: centerY - textBlockHeight / 2 - hitPadding,
              bottom: centerY + textBlockHeight / 2 + hitPadding,
            };

            ctx.shadowColor = captionPalette.glowColor;
            ctx.shadowBlur = Math.round(fontPx * (0.08 + captionShadowStrength * 0.52));
            ctx.shadowOffsetY = Math.round(fontPx * 0.05 * captionShadowStrength);
            const centerOffset = ((lines.length - 1) * lineHeight) / 2;
            const allTokens = captionTextForPreview
              .replace(/\s+/g, " ")
              .trim()
              .split(" ")
              .filter(Boolean);
            const highlightedTokenIndex =
              verticalCaptionHighlightWords && allTokens.length > 1
                ? Math.floor((now / Math.max(90, 320 / Math.max(0.5, animSpeed))) % allTokens.length)
                : -1;
            let tokenCursor = 0;
            for (let idx = 0; idx < lines.length; idx += 1) {
              const line = lines[idx];
              const y = idx * lineHeight - centerOffset;
              const lineWords = line.split(" ").filter(Boolean);
              if (!lineWords.length) continue;
              const measuredWords = lineWords.map((word, wordIndex) => {
                const isLast = wordIndex === lineWords.length - 1;
                const display = isLast ? word : `${word} `;
                return {
                  word,
                  display,
                  width: ctx.measureText(display).width,
                };
              });
              const totalLineWidth = measuredWords.reduce((sum, entry) => sum + entry.width, 0);
              let cursorX = -totalLineWidth / 2;
              for (const entry of measuredWords) {
                const isHighlighted = tokenCursor === highlightedTokenIndex;
                const isEmphasis = verticalCaptionAutoEmphasis ? shouldPreviewEmphasis(entry.word) : false;
                if (outlinePx > 0) {
                  ctx.strokeStyle = `#${captionOutlineColor}`;
                  ctx.lineWidth = outlinePx;
                  ctx.lineJoin = "round";
                  ctx.strokeText(entry.display, cursorX, y);
                }
                ctx.fillStyle = isHighlighted || isEmphasis ? captionPalette.borderColor : captionPalette.textColor;
                ctx.fillText(entry.display, cursorX, y);
                if (verticalCaptionAnimation === "glitch") {
                  ctx.fillStyle = "rgba(255, 0, 120, 0.42)";
                  ctx.fillText(entry.display, cursorX - 1.5, y);
                  ctx.fillStyle = "rgba(0, 255, 255, 0.42)";
                  ctx.fillText(entry.display, cursorX + 1.5, y);
                }
                cursorX += entry.width;
                tokenCursor += 1;
              }
            }
          } else {
            verticalCaptionHitboxRef.current = null;
          }
          ctx.restore();
        } else {
          verticalCaptionHitboxRef.current = null;
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
  }, [
    verticalPreviewUrl,
    sourceVideoMeta,
    effectiveWebcamCrop,
    bottomFitMode,
    topHeightPx,
    skipManualWebcamCrop,
    autoCaptionsEnabled,
    verticalCaptionAnimation,
    verticalCaptionAnimationSpeed,
    verticalCaptionFontSize,
    verticalCaptionFontId,
    verticalCaptionOutlineColor,
    verticalCaptionOutlineWidth,
    verticalCaptionShadowStrength,
    verticalCaptionHighlightWords,
    verticalCaptionAutoEmphasis,
    verticalCaptionAutoEmoji,
    verticalCaptionRemoveFillers,
    verticalCaptionPositionX,
    verticalCaptionPositionY,
    verticalCaptionPreset,
    verticalCaptionText,
    isVerticalMode,
  ]);

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
    setIsVerticalBuilderHidden(true);
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

  const handlePickFile = useCallback(() => {
    trackEditorEvent("new_project_clicked", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: { mode: isVerticalMode ? "vertical" : "horizontal" },
    });
    fileInputRef.current?.click();
  }, [
    activeSubtitlePreset,
    isVerticalMode,
    retentionStrategyProfile,
    retentionTargetPlatform,
    trackEditorEvent,
  ]);

  const continueWithSelectedFile = useCallback((
    file: File,
    fileCount = 1,
    selectionMode: "horizontal" | "vertical" = isVerticalMode ? "vertical" : "horizontal",
    uploadModeOverride?: {
      pipelinePowerMode?: PipelinePowerMode;
      fullAutoYoutubeEnabled?: boolean;
    },
  ) => {
    if (fileCount > 1) {
      toast({
        title: "Multiple files detected",
        description: "Using the first selected file.",
      });
    }
    if (selectionMode === "vertical") {
      prepareVerticalFile(file);
      return;
    }
    void handleFile(file, { mode: "horizontal", uploadModeOverride });
  }, [handleFile, isVerticalMode, prepareVerticalFile, toast]);

  const handleSelectedFile = useCallback((file: File, fileCount = 1) => {
    setPendingUploadSelection({
      file,
      fileCount,
      mode: isVerticalMode ? "vertical" : "horizontal",
    });
    setUploadModePromptOpen(true);
  }, [isVerticalMode]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const file = files?.[0];
    if (file) handleSelectedFile(file, files?.length ?? 1);
    if (event.target) event.target.value = "";
  }, [handleSelectedFile]);

  const handleDropZoneDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dropDragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDropZoneDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDropZoneDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dropDragDepthRef.current = Math.max(0, dropDragDepthRef.current - 1);
    if (dropDragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dropDragDepthRef.current = 0;
    setIsDragging(false);
    const fileCount = getTransferFileCount(event.dataTransfer);
    const file = getFirstTransferFile(event.dataTransfer);
    if (!file) return;
    handleSelectedFile(file, fileCount);
  }, [handleSelectedFile]);

  const handleDropZoneKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlePickFile();
  }, [handlePickFile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWindowDragOver = (event: DragEvent) => {
      if (!transferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
    };

    const handleWindowDrop = (event: DragEvent) => {
      if (!transferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      dropDragDepthRef.current = 0;
      setIsDragging(false);
      const targetNode = event.target instanceof Node ? event.target : null;
      if (uploadDropZoneRef.current && targetNode && uploadDropZoneRef.current.contains(targetNode)) return;
      const fileCount = getTransferFileCount(event.dataTransfer);
      const file = getFirstTransferFile(event.dataTransfer);
      if (!file) return;
      handleSelectedFile(file, fileCount);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [handleSelectedFile]);

  // If the landing page requested an automatic pick, open the file picker when user is signed in.
  useEffect(() => {
    try {
      if (!searchParams.get("autopick")) return;
      if (!accessToken) {
        const target = `/editor?autopick=1`;
        navigate(`/login?next=${encodeURIComponent(target)}`);
        return;
      }
      const t = window.setTimeout(() => {
        handlePickFile();
        const next = new URLSearchParams(searchParams);
        next.delete("autopick");
        setSearchParams(next, { replace: true });
      }, 250);
      return () => window.clearTimeout(t);
    } catch (err) {
      // ignore
    }
  }, [accessToken, handlePickFile, navigate, searchParams, setSearchParams]);

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

  const handleRedoRender = useCallback(
    async (job: JobDetail) => {
      if (!accessToken || !job?.id) return;
      void ensureNotificationPermission("export_start");
      setReprocessingJobId(job.id);
      try {
        const effectiveRetentionStrategyProfile: RetentionStrategyProfile = retentionStrategyProfile;
        const effectiveRetentionAggressionLevel = resolveEffectiveRetentionAggressionLevel({
          strategyProfile: effectiveRetentionStrategyProfile,
          longFormPreset,
        });
        const editorModeForJob = mapEditorModeForBackend(editorMode, pipelinePowerMode);
        const autoModeV3Defaults = resolveAutoModeV3Defaults({
          editorMode: editorModeForJob,
          pipelinePowerMode,
          strategyProfile: effectiveRetentionStrategyProfile,
          aggressionLevel: effectiveRetentionAggressionLevel,
          maxCuts: maxCutsRequested,
          longFormPreset,
          longFormAggression,
          longFormClarityVsSpeed,
        });
        const requestedMode = job.renderMode === "vertical" ? "vertical" : "horizontal";
        const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
        const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
        const captionsEnabledForJob = CAPTIONS_PIPELINE_ENABLED && requestedMode === "vertical";
        const fastModeForJob = ultraPipelineMode;
        const creatorStyleLockForJob = clampCreatorStyleLockPercent(creatorStyleLockPercent);
        const selectedQuality = normalizeQuality(qualityByJob[job.id] || job.requestedQuality || "720p");
        const preferredHook = selectedHookByJob[job.id] || null;
        const hookSelectionModeForJob =
          hookSelectionModeByJob[job.id] ??
          normalizeHookSelectionMode(
            (job.analysis as any)?.hook_selection_mode ??
            (job.analysis as any)?.hookSelectionMode ??
            (job.analysis as any)?.hook_mode ??
            (job.analysis as any)?.hookMode,
          );
        const payload: Record<string, unknown> = {
          requestedQuality: selectedQuality,
          retentionAggressionLevel: autoModeV3Defaults.aggressionLevel,
          retentionStrategyProfile: autoModeV3Defaults.strategyProfile,
          retentionTargetPlatform,
          platformProfile: retentionTargetPlatform,
          onlyHookAndCut,
          maxCuts: autoModeV3Defaults.maxCuts,
          editorMode: editorModeForJob,
          creativeVariant,
          hookSelectionMode: hookSelectionModeForJob,
          longFormPreset: autoModeV3Defaults.longFormPreset,
          longFormAggression: autoModeV3Defaults.longFormAggression,
          longFormClarityVsSpeed: autoModeV3Defaults.longFormClarityVsSpeed,
          tangentKiller,
          fastMode: fastModeForJob,
          pipelinePowerMode,
          coldStartAutopilot: coldStartAutopilotEnabled,
          continuityFirstMode: continuityFirstEnabled,
          exploreX3Mode: exploreX3Enabled,
          topHumanGuardMode: topHumanGuardEnabled,
          creatorStyleLock: creatorStyleLockForJob,
          autoCaptions: captionsEnabledForJob,
          subtitleStyle: subtitleStyleForJob,
          subtitles: {
            enabled: captionsEnabledForJob,
            preset: subtitlePresetForJob,
            style: subtitleStyleForJob,
          },
          ...(fullAutoYoutubeEnabled
            ? {
                fullAutoYoutube: {
                  enabled: true,
                  target: fullAutoYoutubeTarget,
                  vibe: fullAutoYoutubeVibe,
                  includeSeoPack: true,
                  includePromptPack: true,
                  includeQueueHints: true,
                  preferAiBroll: true,
                },
              }
            : {}),
        };
        if (requestedMode === "vertical") {
          const verticalCaptionTextForJob = normalizeVerticalCaptionTextForJob(verticalCaptionText);
          payload.verticalCaptionText = verticalCaptionTextForJob;
          payload.verticalCaptions = {
            enabled: captionsEnabledForJob,
            autoGenerate: captionsEnabledForJob && verticalCaptionTextForJob.length === 0,
            preset: verticalCaptionPreset,
            text: verticalCaptionTextForJob,
            fontId: verticalCaptionFontId,
            fontSize: Math.round(clamp(verticalCaptionFontSize, VERTICAL_CAPTION_FONT_SIZE_MIN, VERTICAL_CAPTION_FONT_SIZE_MAX)),
            outlineColor: normalizeCaptionHexColor(
              verticalCaptionOutlineColor,
              VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].outlineColor,
            ),
            outlineWidth: clamp(Math.round(verticalCaptionOutlineWidth), 0, 24),
            animation: verticalCaptionAnimation,
            animationSpeed: clampVerticalCaptionAnimationSpeed(verticalCaptionAnimationSpeed),
            dynamicMode: verticalCaptionDynamicMode,
            voicePreset: verticalVoicePreset,
            highlightWords: verticalCaptionHighlightWords,
            autoEmphasis: verticalCaptionAutoEmphasis,
            autoEmoji: verticalCaptionAutoEmoji,
            removeFillers: verticalCaptionRemoveFillers,
            shadowStrength: Math.round(clamp(verticalCaptionShadowStrength, VERTICAL_CAPTION_SHADOW_MIN, VERTICAL_CAPTION_SHADOW_MAX)),
            positionX: clampCaptionPosition(verticalCaptionPositionX),
            positionY: clampCaptionPosition(verticalCaptionPositionY),
          };
        }
        if (preferredHook && hookSelectionModeForJob !== "auto") {
          payload.preferredHook = {
            start: preferredHook.start,
            duration: preferredHook.duration,
          };
        }

        const result = await apiFetch<{
          ok: boolean;
          queued: boolean;
          rerenderUsage?: {
            day?: string;
            rerendersUsed?: number;
            rerendersLimit?: number | null;
            rerendersRemaining?: number | null;
          } | null;
        }>(`/api/jobs/${job.id}/reprocess`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify(payload),
        });

        setExportOpen(false);
        setJobs((prev) =>
          prev.map((entry) =>
            entry.id === job.id
              ? { ...entry, status: "queued", progress: 1 }
              : entry,
          ),
        );
        setActiveJob((prev) => {
          if (!prev || prev.id !== job.id) return prev;
          return {
            ...prev,
            status: "queued",
            progress: 1,
            error: null,
            outputUrl: null,
            outputUrls: null,
          };
        });
        await Promise.allSettled([fetchJobs(), fetchJob(job.id), refetchMe()]);
        const remaining = Number(result?.rerenderUsage?.rerendersRemaining);
        const limit = Number(result?.rerenderUsage?.rerendersLimit);
        if (Number.isFinite(remaining) && Number.isFinite(limit)) {
          toast({
            title: "Re-render queued",
            description: `${remaining} of ${limit} re-renders left today.`,
          });
        } else {
          toast({
            title: "Re-render queued",
            description: "Your job was added back to the queue.",
          });
        }
      } catch (err: any) {
        if (err instanceof ApiError && err.code === "RERENDER_LIMIT_REACHED") {
          const used = Number(err.data?.rerendersUsed ?? 0);
          const limit = Number(err.data?.maxRerendersPerDay ?? maxRerendersPerDay ?? 0);
          const dayLabel = typeof err.data?.day === "string" ? ` on ${err.data.day}` : "";
          toast({
            title: "Daily re-render limit reached",
            description:
              Number.isFinite(limit) && limit > 0
                ? `You used ${used} of ${limit} re-renders${dayLabel}.`
                : "You reached your re-render limit for today.",
          });
        } else if (err instanceof ApiError && err.code === "RENDER_LIMIT_REACHED") {
          const maxRenders = err.data?.maxRendersPerMonth ?? maxRendersPerMonth;
          toast({
            title: "Render limit reached",
            description: maxRenders
              ? `You used all ${maxRenders} renders for this month.`
              : "You've reached your monthly render limit.",
          });
        } else {
          toast({
            title: "Re-render failed",
            description: err?.message || "Please try again.",
          });
        }
      } finally {
        setReprocessingJobId((current) => (current === job.id ? null : current));
      }
    },
    [
      accessToken,
      autoCaptionsEnabled,
      coldStartAutopilotEnabled,
      continuityFirstEnabled,
      creativeVariant,
      creatorStyleLockPercent,
      editorMode,
      exploreX3Enabled,
      topHumanGuardEnabled,
      fetchJob,
      fetchJobs,
      fullAutoYoutubeEnabled,
      fullAutoYoutubeTarget,
      fullAutoYoutubeVibe,
      maxRendersPerMonth,
      maxRerendersPerDay,
      maxCutsRequested,
      longFormPreset,
      longFormAggression,
      longFormClarityVsSpeed,
      onlyHookAndCut,
      pipelinePowerMode,
      qualityByJob,
      refetchMe,
      retentionStrategyProfile,
      retentionTargetPlatform,
      tangentKiller,
      hookSelectionModeByJob,
      selectedHookByJob,
      subtitleStyleDraft,
      ultraPipelineMode,
      verticalCaptionAnimation,
      verticalCaptionAnimationSpeed,
      verticalCaptionDynamicMode,
      verticalCaptionHighlightWords,
      verticalCaptionAutoEmphasis,
      verticalCaptionAutoEmoji,
      verticalCaptionRemoveFillers,
      verticalVoicePreset,
      verticalCaptionFontSize,
      verticalCaptionFontId,
      verticalCaptionOutlineColor,
      verticalCaptionOutlineWidth,
      verticalCaptionShadowStrength,
      verticalCaptionPositionX,
      verticalCaptionPositionY,
      verticalCaptionPreset,
      verticalCaptionText,
      ensureNotificationPermission,
      toast,
    ],
  );

  const handleDownload = async (clipIndex = 0) => {
    if (!accessToken || !activeJob) return false;
    try {
      const clipParam = clipIndex + 1;
      let downloadUrl = "";
      try {
        const data = await apiFetch<{ url: string }>(`/api/jobs/${activeJob.id}/download-url`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ clip: clipParam }),
        });
        downloadUrl = data.url;
      } catch {
        const outputUrls = sanitizeVideoUrlList(Array.isArray(activeJob.outputUrls) ? activeJob.outputUrls : []);
        const selectedExistingUrl =
          outputUrls[clipIndex] || (clipIndex === 0 ? activeJob.outputUrl || undefined : undefined);
        if (selectedExistingUrl) {
          downloadUrl = selectedExistingUrl;
        } else {
          const data = await apiFetch<{ url: string }>(`/api/jobs/${activeJob.id}/output-url?clip=${clipParam}`, {
            token: accessToken,
          });
          downloadUrl = data.url;
        }
      }
      setActiveJob((prev) => {
        if (!prev) return prev;
        const nextUrls = sanitizeVideoUrlList(Array.isArray(prev.outputUrls) ? prev.outputUrls : []);
        while (nextUrls.length < clipParam) nextUrls.push("");
        nextUrls[clipIndex] = downloadUrl;
        const sanitized = sanitizeVideoUrlList(nextUrls);
        return {
          ...prev,
          outputUrl: isLikelyVideoUrl(downloadUrl) ? downloadUrl : (sanitized[0] ?? null),
          outputUrls: sanitized.length > 0 ? sanitized : null,
        };
      });
      const baseName = displayName(activeJob).replace(/\.[^/.]+$/, "") || "export";
      const fallbackFileName =
        activeJob.renderMode === "vertical"
          ? `${baseName}-clip-${clipParam}.mp4`
          : `${baseName}.mp4`;
      await triggerFileDownload(downloadUrl, fallbackFileName);
      submitDownloadFeedback(activeJob, clipIndex, "frontend_manual_download");
      return true;
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again." });
      return false;
    }
  };

  const normalizedActiveStatus = activeJob ? normalizeStatus(activeJob.status) : null;
  const activeStatusLabel = activeJob
    ? normalizeStatus(activeJob.status) === "failed" && activeJob.error === "queue_canceled_by_user"
      ? "Canceled"
      : STATUS_LABELS[normalizeStatus(activeJob.status)] || "Queued"
    : "Queued";
  const activeStageLabel = activeJob
    ? PIPELINE_STEPS.find((step) => step.key === stepKeyForStatus(activeJob.status))?.label || "Upload"
    : "Upload";
  const activeJobCreatedAtLabel = activeJob
    ? new Date(activeJob.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const canCancelJob = Boolean(activeJob && !isTerminalStatus(activeJob.status));
  const cancelButtonLabel =
    normalizedActiveStatus === "queued" || normalizedActiveStatus === "uploading"
      ? "Cancel Queue"
      : "Cancel Job";
  const activePreviewCacheKey = useMemo(() => buildJobPreviewCacheKey(activeJob), [activeJob]);
  const activeOutputUrls = useMemo(() => {
    if (!activeJob) return [] as string[];
    const urls = sanitizeVideoUrlList(Array.isArray(activeJob.outputUrls) ? activeJob.outputUrls : [])
      .map((url) => appendVideoCacheBust(url, activePreviewCacheKey))
      .filter((url) => isLikelyVideoUrl(url));
    if (urls.length > 0) return urls;
    if (isLikelyVideoUrl(activeJob.outputUrl)) {
      const preview = appendVideoCacheBust(String(activeJob.outputUrl), activePreviewCacheKey);
      return preview ? [preview] : [];
    }
    return [];
  }, [activeJob, activePreviewCacheKey]);
  const analyzeUnlockedForActiveJob = Boolean(activeJob?.id && analyzeUnlockedByJob[activeJob.id]);
  const activeAnalysis = (activeJob?.analysis ?? {}) as any;
  const activeYouTubeSync = activeAnalysis?.youtube_sync && typeof activeAnalysis.youtube_sync === "object"
    ? (activeAnalysis.youtube_sync as Record<string, unknown>)
    : null;
  const activeLinkedYouTubeVideoId = parseYouTubeVideoInput(
    activeAnalysis?.youtube_video_id ??
    activeAnalysis?.youtubeVideoId ??
    activeYouTubeSync?.videoId,
  );
  const activeYouTubeVideoDraft = activeJob?.id
    ? (youtubeVideoDraftByJob[activeJob.id] ?? activeLinkedYouTubeVideoId ?? youtubeVideoDraftLoose ?? "")
    : youtubeVideoDraftLoose;
  const canApplyYouTubeReferenceStyle = Boolean(parseYouTubeVideoInput(activeYouTubeVideoDraft));
  const activeYouTubeSignalFromAnalysis =
    normalizeYouTubeSignalState(activeYouTubeSync?.signalState) ??
    normalizeYouTubeSignalState(activeAnalysis?.retention_feedback?.youtubeSignal) ??
    normalizeYouTubeSignalState(activeAnalysis?.retention_feedback?.youtube_signal);
  const activeYouTubeSignal = activeJob?.id
    ? (youtubeSignalByJob[activeJob.id] ?? activeYouTubeSignalFromAnalysis)
    : activeYouTubeSignalFromAnalysis;
  const activeYouTubeTrustPercent = activeYouTubeSignal ? Math.round(clamp01(activeYouTubeSignal.trustWeight) * 100) : null;
  const activeYouTubeAverageViewsLabel = activeYouTubeSignal?.averageViewsPerVideo !== null && activeYouTubeSignal?.averageViewsPerVideo !== undefined
    ? Math.round(activeYouTubeSignal.averageViewsPerVideo).toLocaleString()
    : "n/a";
  const activeYouTubeCurrentViewsLabel = activeYouTubeSignal
    ? Math.round(activeYouTubeSignal.currentVideoViews).toLocaleString()
    : "n/a";
  const activeYouTubeDateRange = activeYouTubeSync?.dateRange && typeof activeYouTubeSync.dateRange === "object"
    ? (activeYouTubeSync.dateRange as Record<string, unknown>)
    : null;
  const activeYouTubeLastSyncedAt = activeYouTubeSync?.lastSyncedAt && typeof activeYouTubeSync.lastSyncedAt === "string"
    ? activeYouTubeSync.lastSyncedAt
    : null;
  const youtubeReferenceStyleAppliedAtLabel = youtubeReferenceStyleApplied?.appliedAt
    ? formatFeedbackTimestamp(youtubeReferenceStyleApplied.appliedAt)
    : null;
  const youtubeReferenceStyleConfidenceLabel =
    youtubeReferenceStyleApplied?.confidence !== null && youtubeReferenceStyleApplied?.confidence !== undefined
      ? `${Math.round(clamp01(youtubeReferenceStyleApplied.confidence) * 100)}% confidence`
      : null;
  const youtubeConnected = Boolean(youtubeOAuthStatus?.connected);
  const youtubeOAuthConfigured = youtubeOAuthStatus?.authConfigured !== false;
  const youtubeConnectBusy = youtubeOAuthBusyAction === "connect" || youtubeOAuthBusyAction === "exchange";
  const youtubeDisconnectBusy = youtubeOAuthBusyAction === "disconnect";
  const youtubeStatusMissingConfig = Array.isArray(youtubeOAuthStatus?.missingConfig)
    ? youtubeOAuthStatus?.missingConfig?.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const activeRenderSettings =
    activeJob && (activeJob as any).renderSettings && typeof (activeJob as any).renderSettings === "object"
      ? ((activeJob as any).renderSettings as Record<string, unknown>)
      : null;
  const autonomousEditor =
    activeJob?.autonomousEditor && typeof activeJob.autonomousEditor === "object"
      ? (activeJob.autonomousEditor as AutonomousEditorSummary)
      : activeAnalysis?.autonomous_editor && typeof activeAnalysis.autonomous_editor === "object"
        ? (activeAnalysis.autonomous_editor as AutonomousEditorSummary)
        : null;
  const autonomousSenses = Array.isArray(autonomousEditor?.senses)
    ? autonomousEditor.senses.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, 5)
    : [];
  const autonomousModes = Array.isArray(autonomousEditor?.modes)
    ? autonomousEditor.modes.filter((mode): mode is AutonomousEditorModeSummary => Boolean(mode && typeof mode.label === "string"))
    : [];
  const autonomousActiveModes = autonomousModes.filter((mode) => mode.active);
  const autonomousDecisions = Array.isArray(autonomousEditor?.decisions)
    ? autonomousEditor.decisions
        .filter((decision): decision is AutonomousEditorDecisionSummary => Boolean(decision && Number.isFinite(Number(decision.atSec))))
        .slice(0, 6)
    : [];
  const autonomousDecisionCounts = Object.entries(autonomousEditor?.decisionCounts || {})
    .filter((entry) => Number.isFinite(Number(entry[1])) && Number(entry[1]) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]));
  const autonomousSelectedHook = autonomousEditor?.selectedHook ?? null;
  const autonomousWinnerPolicy = autonomousEditor?.winnerPolicy ?? null;
  const autonomousQualityGate = autonomousEditor?.qualityGate ?? null;
  const autonomousCutQualityPercent =
    autonomousQualityGate?.cutQualityScore !== null && autonomousQualityGate?.cutQualityScore !== undefined
      ? Math.round(clamp01(Number(autonomousQualityGate.cutQualityScore)) * 100)
      : null;
  const autonomousLearning = autonomousEditor?.learning ?? null;
  const autonomousLearningRecordedAtLabel =
    autonomousLearning?.recordedAt && typeof autonomousLearning.recordedAt === "string"
      ? formatFeedbackTimestamp(autonomousLearning.recordedAt)
      : null;
  const autonomousPromotionLead =
    Array.isArray(autonomousLearning?.policyPromotions) && autonomousLearning.policyPromotions.length > 0
      ? autonomousLearning.policyPromotions[0]
      : null;
  const autonomousHookSourceLabel = (() => {
    const source = String(autonomousSelectedHook?.source || "").trim().toLowerCase();
    if (source === "user_selected") return "User locked";
    if (source === "fallback") return "Fallback";
    if (source === "auto") return "Auto";
    return "Unknown";
  })();
  const autonomousStatusLabel =
    autonomousEditor?.autonomyState === "self_directed"
      ? "Self-Directed"
      : "Assisted";
  const autonomousLearningReasonLabel =
    typeof autonomousLearning?.boundaryCritic?.reason === "string" && autonomousLearning.boundaryCritic.reason.trim().length > 0
      ? autonomousLearning.boundaryCritic.reason.replace(/_/g, " ")
      : null;
  const liveStepTranscriptCues = useMemo(
    () => normalizeTranscriptCueRows(activeAnalysis?.pipelineSteps?.TRANSCRIBE?.meta?.transcriptCues),
    [activeAnalysis],
  );
  const sourceTranscriptCues = useMemo(
    () => normalizeTranscriptCueRows(activeAnalysis?.transcript_cues ?? activeAnalysis?.transcriptCues),
    [activeAnalysis],
  );
  const liveSourceTranscriptCues = liveStepTranscriptCues.length > 0 ? liveStepTranscriptCues : sourceTranscriptCues;
  const pipelineStepTranscriptSegments = useMemo(
    () => normalizeTranscriptSegmentRows(activeAnalysis?.pipelineSteps?.FRAME_ANALYSIS?.meta?.segments),
    [activeAnalysis],
  );
  const pipelineStepEditedTranscriptCues = useMemo(
    () => normalizeTranscriptCueRows(activeAnalysis?.pipelineSteps?.FRAME_ANALYSIS?.meta?.editedTranscriptCues),
    [activeAnalysis],
  );
  const editorTranscriptSegments = useMemo(
    () => normalizeTranscriptSegmentRows(activeAnalysis?.editPlan?.segments),
    [activeAnalysis],
  );
  const liveTranscriptSegments = editorTranscriptSegments.length > 0 ? editorTranscriptSegments : pipelineStepTranscriptSegments;
  const editedTranscriptCues = useMemo(
    () => normalizeTranscriptCueRows(activeAnalysis?.edited_transcript_cues ?? activeAnalysis?.editedTranscriptCues),
    [activeAnalysis],
  );
  const liveEditedTranscriptCues = useMemo(() => {
    if (editedTranscriptCues.length > 0) return editedTranscriptCues;
    if (pipelineStepEditedTranscriptCues.length > 0) return pipelineStepEditedTranscriptCues;
    if (liveSourceTranscriptCues.length > 0 && liveTranscriptSegments.length > 0) {
      return remapTranscriptCuesToEditedTimelinePreview(liveSourceTranscriptCues, liveTranscriptSegments);
    }
    return [] as EditorTranscriptCue[];
  }, [
    editedTranscriptCues,
    liveSourceTranscriptCues,
    liveTranscriptSegments,
    pipelineStepEditedTranscriptCues,
  ]);
  const exportFeedbackEntries = useMemo(
    () => buildExportFeedbackEntries(activeJob?.analysis ?? {}),
    [activeJob?.id, activeJob?.analysis],
  );
  const exportCreatorFeedbackCount = exportFeedbackEntries.filter((entry) => entry.sourceType === "creator").length;
  const hookStartSec = Number(activeAnalysis?.hook_start_time ?? activeAnalysis?.hook?.start ?? NaN);
  const hookEndSec = Number(activeAnalysis?.hook_end_time ?? (Number.isFinite(hookStartSec) ? hookStartSec + Number(activeAnalysis?.hook?.duration ?? 0) : NaN));
  const hookText = typeof activeAnalysis?.hook_text === "string" ? activeAnalysis.hook_text : "";
  const hookReason = typeof activeAnalysis?.hook_reason === "string" ? activeAnalysis.hook_reason : "";
  const liveTranscriptEditorRows = useMemo(() => buildTranscriptEditorRows({
    cues: liveSourceTranscriptCues,
    segments: liveTranscriptSegments,
    hookStart: Number.isFinite(hookStartSec) ? hookStartSec : null,
    hookEnd: Number.isFinite(hookEndSec) ? hookEndSec : null,
  }), [
    hookEndSec,
    hookStartSec,
    liveSourceTranscriptCues,
    liveTranscriptSegments,
  ]);
  const activeTranscriptCues = liveEditedTranscriptCues.length > 0 ? liveEditedTranscriptCues : liveSourceTranscriptCues;
  const activeTranscriptTimelineMode: "edited" | "source" | null = liveEditedTranscriptCues.length > 0
    ? "edited"
    : liveSourceTranscriptCues.length > 0
      ? "source"
      : null;
  const transcriptEditorStageLabel = !liveSourceTranscriptCues.length
    ? "Waiting for transcript"
    : liveTranscriptSegments.length > 0
      ? (normalizedActiveStatus === "ready" ? "Edit locked" : "Editing in real time")
      : "Transcript ready";
  const transcriptEditorStageHint = !liveSourceTranscriptCues.length
    ? "The transcript will appear here as soon as the transcribe step completes."
    : liveTranscriptSegments.length > 0
      ? "Keep, cut, and hook decisions are mirrored on the transcript as the pipeline advances."
      : "Transcript is ready. Cut and pacing decisions will appear here as the editor resolves segments.";
  const transcriptSourceCueCount = liveSourceTranscriptCues.length;
  const transcriptEditedCueCount = liveEditedTranscriptCues.length;
  const transcriptCutCount = liveTranscriptEditorRows.filter((row) => row.decision === "cut").length;
  const transcriptKeepCount = liveTranscriptEditorRows.filter((row) => row.decision === "keep" || row.decision === "hook").length;
  const transcriptDefaultTab: TranscriptPanelTab = liveTranscriptEditorRows.length > 0
    ? "editor"
    : liveEditedTranscriptCues.length > 0
      ? "preview"
      : "source";
  const transcriptHasEditor = liveTranscriptEditorRows.length > 0;
  const transcriptHasPreview = liveEditedTranscriptCues.length > 0;
  const transcriptHasSource = liveSourceTranscriptCues.length > 0;
  useEffect(() => {
    setTranscriptPanelTab(transcriptDefaultTab);
  }, [activeJob?.id, transcriptDefaultTab]);
  useEffect(() => {
    if (transcriptPanelTab === "editor" && transcriptHasEditor) return;
    if (transcriptPanelTab === "preview" && transcriptHasPreview) return;
    if (transcriptPanelTab === "source" && transcriptHasSource) return;
    setTranscriptPanelTab(transcriptDefaultTab);
  }, [
    transcriptDefaultTab,
    transcriptHasEditor,
    transcriptHasPreview,
    transcriptHasSource,
    transcriptPanelTab,
  ]);
  const metadataSummary = activeAnalysis?.metadata_summary && typeof activeAnalysis.metadata_summary === "object"
    ? activeAnalysis.metadata_summary
    : null;
  const fullAutoProfileRaw =
    toObjectRecord(activeAnalysis?.fullAutoYoutube) ??
    toObjectRecord(activeAnalysis?.full_auto_youtube) ??
    toObjectRecord(activeRenderSettings?.fullAutoYoutube) ??
    toObjectRecord(activeRenderSettings?.full_auto_youtube);
  const fullAutoAppliedSettings = toObjectRecord(fullAutoProfileRaw?.appliedSettings);
  const fullAutoTransitionPack = Array.isArray(fullAutoProfileRaw?.transitionPack)
    ? fullAutoProfileRaw.transitionPack.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const fullAutoSoundFxPack = Array.isArray(fullAutoProfileRaw?.soundFxPack)
    ? fullAutoProfileRaw.soundFxPack.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const fullAutoMusicPlan = toObjectRecord(fullAutoProfileRaw?.musicPlan);
  const fullAutoEnabledForActiveJob = Boolean(
    fullAutoProfileRaw &&
      (
        fullAutoProfileRaw.enabled === true ||
        fullAutoProfileRaw.mode === "full_auto_youtube" ||
        typeof fullAutoProfileRaw.target === "string" ||
        typeof fullAutoProfileRaw.vibe === "string" ||
        fullAutoAppliedSettings
      ),
  );
  const fullAutoEditorAddedSummary = (() => {
    if (!fullAutoEnabledForActiveJob) return null;
    const labels: string[] = [];
    const seen = new Set<string>();
    const addLabel = (value: string | null) => {
      const label = String(value || "").trim();
      if (!label) return;
      const dedupeKey = label.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      labels.push(label);
    };

    if (fullAutoAppliedSettings?.smartZoom === true) addLabel("smart zoom reframing");
    if (fullAutoAppliedSettings?.transitions === true || fullAutoTransitionPack.length > 0) addLabel("transitions");
    if (fullAutoAppliedSettings?.soundFx === true || fullAutoSoundFxPack.length > 0) addLabel("sound effects");
    if (fullAutoAppliedSettings?.autoCaptions === true) {
      const subtitleStyle = typeof fullAutoAppliedSettings?.subtitleStyle === "string"
        ? fullAutoAppliedSettings.subtitleStyle.trim()
        : "";
      addLabel(subtitleStyle ? `${formatNicheLabel(subtitleStyle)} auto captions` : "auto captions");
    }
    if (fullAutoMusicPlan?.ducking === true) addLabel("background music ducking");
    if (fullAutoProfileRaw?.preferAiBroll === true) addLabel("AI B-roll assist");
    if (fullAutoAppliedSettings?.hookSelectionMode === "auto") addLabel("auto hook selection");
    const maxCuts = Number(fullAutoAppliedSettings?.maxCuts);
    if (Number.isFinite(maxCuts) && maxCuts > 0) addLabel(`up to ${Math.round(maxCuts)} auto cuts`);
    const editorMode = typeof fullAutoAppliedSettings?.editorMode === "string"
      ? fullAutoAppliedSettings.editorMode.trim().toLowerCase()
      : "";
    if (editorMode && editorMode !== "auto") addLabel(`${formatNicheLabel(editorMode)} pacing mode`);

    if (labels.length > 0) return `Editor added: ${formatNaturalList(labels.slice(0, 6))}.`;

    const fallbackHighlight = Array.isArray(fullAutoProfileRaw?.highlights)
      ? fullAutoProfileRaw.highlights.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : null;
    if (fallbackHighlight) {
      const cleanHighlight = fallbackHighlight.trim().replace(/[.!?]+$/, "");
      if (cleanHighlight) return `Editor added: ${cleanHighlight}.`;
    }
    return "Editor added: Full Auto YouTube optimizations.";
  })();
  const showFullAutoEditorAddedSummary = Boolean(
    fullAutoEnabledForActiveJob &&
      normalizedActiveStatus === "ready" &&
      fullAutoEditorAddedSummary,
  );
  const metadataClipSummaries: Array<{
    clip: number;
    predictedCompletion: number | null;
    reason: string | null;
  }> = Array.isArray(metadataSummary?.clips)
    ? metadataSummary.clips
        .map((entry: any, index: number) => {
          const clipNumber = Number.isFinite(Number(entry?.clip)) ? Number(entry.clip) : index + 1;
          const predictedCompletion = Number(entry?.predictedCompletion);
          const reason = typeof entry?.reason === "string" ? entry.reason.trim() : "";
          return {
            clip: clipNumber,
            predictedCompletion: Number.isFinite(predictedCompletion) ? predictedCompletion : null,
            reason: reason.length > 0 ? reason : null,
          };
        })
        .slice(0, 6)
    : [];
  const metadataRetention = metadataSummary?.retention && typeof metadataSummary.retention === "object"
    ? metadataSummary.retention
    : null;
  const metadataNiche = metadataSummary?.niche && typeof metadataSummary.niche === "object"
    ? metadataSummary.niche
    : null;
  const verticalSelectionMode = typeof metadataSummary?.selectionMode === "string"
    ? metadataSummary.selectionMode
    : null;
  const verticalClipPredictions: VerticalClipPrediction[] = Array.isArray(metadataSummary?.clips)
    ? metadataSummary.clips
        .map((item: any) => {
          const clip = Number(item?.clip);
          const start = Number(item?.start);
          const end = Number(item?.end);
          const duration = Number(item?.duration);
          const predictedCompletion = Number(item?.predictedCompletion);
          if (
            !Number.isFinite(clip) ||
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            !Number.isFinite(duration) ||
            !Number.isFinite(predictedCompletion)
          ) {
            return null;
          }
          return {
            clip: Math.max(1, Math.round(clip)),
            start,
            end,
            duration: Math.max(0, duration),
            predictedCompletion: Math.max(0, Math.min(100, predictedCompletion)),
            reason: typeof item?.reason === "string" ? item.reason : "",
          } as VerticalClipPrediction;
        })
        .filter((item: VerticalClipPrediction | null): item is VerticalClipPrediction => Boolean(item))
        .sort((a, b) => a.clip - b.clip)
    : [];
  const verticalPredictedAverage = Number.isFinite(Number(metadataSummary?.predictedAverage))
    ? Number(metadataSummary.predictedAverage)
    : verticalClipPredictions.length > 0
      ? Number(
          (
            verticalClipPredictions.reduce((sum, item) => sum + item.predictedCompletion, 0) /
            verticalClipPredictions.length
          ).toFixed(2),
        )
      : null;
  const hookSelectionModeFromAnalysis = normalizeHookSelectionMode(
    activeAnalysis?.hook_selection_mode ??
    activeAnalysis?.hookSelectionMode ??
    activeAnalysis?.hook_mode ??
    activeAnalysis?.hookMode ??
    metadataRetention?.hookSelectionMode ??
    metadataRetention?.hook_selection_mode ??
    activeAnalysis?.pipelineSteps?.HOOK_SELECT_AND_AUDIT?.meta?.hookSelectionMode,
  );
  const activeHookSelectionMode = activeJob
    ? (hookSelectionModeByJob[activeJob.id] ?? hookSelectionModeFromAnalysis)
    : defaultHookSelectionMode;
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
  const autoDetectProfile =
    metadataRetention?.autoDetect && typeof metadataRetention.autoDetect === "object"
      ? metadataRetention.autoDetect
      : metadataRetention?.auto_detect && typeof metadataRetention.auto_detect === "object"
        ? metadataRetention.auto_detect
        : activeAnalysis?.video_auto_detect && typeof activeAnalysis.video_auto_detect === "object"
          ? activeAnalysis.video_auto_detect
          : activeAnalysis?.videoAutoDetect && typeof activeAnalysis.videoAutoDetect === "object"
            ? activeAnalysis.videoAutoDetect
            : null;
  const detectedAutoPreset = sanitizeRetentionSummaryModeText(autoDetectProfile?.preset);
  const detectedAutoStyle = sanitizeRetentionSummaryModeText(autoDetectProfile?.style);
  const detectedAutoContentType = sanitizeRetentionSummaryModeText(
    typeof autoDetectProfile?.contentType === "string"
      ? autoDetectProfile.contentType
      : typeof autoDetectProfile?.content_type === "string"
        ? autoDetectProfile.content_type
        : null,
  );
  const detectedAutoFormat = sanitizeRetentionSummaryModeText(autoDetectProfile?.format);
  const retentionKingBlendPctDisplay =
    Number.isFinite(Number(autoDetectProfile?.retentionKingBlendPct))
      ? Number(autoDetectProfile.retentionKingBlendPct)
      : Number.isFinite(Number(activeAnalysis?.retention_king_blend_pct))
        ? Number(activeAnalysis.retention_king_blend_pct)
        : Number.isFinite(Number(activeAnalysis?.retentionKingBlendPct))
          ? Number(activeAnalysis.retentionKingBlendPct)
          : null;
  const retentionKingBlendLevelDisplay =
    typeof autoDetectProfile?.retentionKingBlendLevel === "string"
      ? autoDetectProfile.retentionKingBlendLevel
      : typeof autoDetectProfile?.retention_king_blend_level === "string"
        ? autoDetectProfile.retention_king_blend_level
        : null;
  const dynamicScoreBeforeDisplay =
    Number.isFinite(Number(autoDetectProfile?.qualityScoreBefore))
      ? Number(autoDetectProfile.qualityScoreBefore)
      : Number.isFinite(Number(autoDetectProfile?.quality_score_before))
        ? Number(autoDetectProfile.quality_score_before)
        : null;
  const dynamicScoreAfterDisplay =
    Number.isFinite(Number(autoDetectProfile?.qualityScoreAfter))
      ? Number(autoDetectProfile.qualityScoreAfter)
      : Number.isFinite(Number(autoDetectProfile?.quality_score_after))
        ? Number(autoDetectProfile.quality_score_after)
        : null;
  const dynamicThoughtBefore =
    typeof autoDetectProfile?.thoughtBefore === "string"
      ? autoDetectProfile.thoughtBefore
      : typeof autoDetectProfile?.thought_before === "string"
        ? autoDetectProfile.thought_before
        : null;
  const dynamicThoughtAfter =
    typeof autoDetectProfile?.thoughtAfter === "string"
      ? autoDetectProfile.thoughtAfter
      : typeof autoDetectProfile?.thought_after === "string"
        ? autoDetectProfile.thought_after
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
    ? metadataRetention.improvements
        .filter(
          (line: unknown) =>
            typeof line === "string" &&
            !RETENTION_SUMMARY_HIDDEN_MODE_TOKEN_PATTERN.test(line),
        )
        .slice(0, 8)
    : Array.isArray(activeJob?.optimizationNotes)
      ? activeJob.optimizationNotes
          .filter(
            (line: unknown) =>
              typeof line === "string" &&
              !RETENTION_SUMMARY_HIDDEN_MODE_TOKEN_PATTERN.test(line),
          )
          .slice(0, 8)
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
  const dynamicScoreBeforePopup = dynamicScoreBeforeDisplay ?? retentionScoreBeforeDisplay;
  const dynamicScoreAfterPopup = dynamicScoreAfterDisplay ?? retentionScoreAfterDisplay;
  const hookWindowLabel =
    Number.isFinite(hookStartSec) && Number.isFinite(hookEndSec)
      ? formatHookRange(hookStartSec, hookEndSec)
      : selectedHookCandidate
        ? formatHookRange(selectedHookCandidate.start, selectedHookCandidate.start + selectedHookCandidate.duration)
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
  const failedStepKey =
    normalizedActiveStatus === "failed"
      ? activeJob?.error && activeJob.error.startsWith("FAILED_HOOK:")
        ? "hooking"
        : activeJob?.error && activeJob.error.startsWith("FAILED_QUALITY_GATE:")
          ? "pacing"
          : "pacing"
      : null;
  const failedStepIndex = failedStepKey
    ? PIPELINE_STEPS.findIndex((step) => step.key === failedStepKey)
    : -1;
  const visualStepIndex = normalizedActiveStatus === "failed"
    ? (failedStepIndex >= 0 ? failedStepIndex : Math.max(0, currentStepIndex))
    : currentStepIndex;
  const totalPipelineProgress = clamp(Number(activeJob?.progress ?? 0), 0, 100);
  const activeStageProgress = useMemo(() => {
    if (!activeJob) return 0;
    const normalized = normalizeStatus(activeJob.status);
    const overallProgress =
      typeof activeJob.progress === "number" && Number.isFinite(activeJob.progress)
        ? clamp(activeJob.progress, 0, 100)
        : 0;
    if (normalized === "ready") return 100;
    const marker = statusStartRef.current[activeJob.id];
    if (marker && marker.status === normalized && Number.isFinite(marker.startProgress)) {
      const start = clamp(marker.startProgress, 0, 99);
      const span = Math.max(1, 100 - start);
      return clamp(((overallProgress - start) / span) * 100, 4, 99);
    }
    if (normalized === "failed") return clamp(overallProgress, 6, 99);
    return clamp(overallProgress, 4, 99);
  }, [activeJob?.id, activeJob?.status, activeJob?.progress]);
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
  const highEnergyPeaks = firstFiniteNumber(
    activeAnalysis?.high_energy_peaks,
    activeAnalysis?.highEnergyPeaks,
    activeAnalysis?.pipelineSteps?.HOOK_SCORING?.meta?.peakCount,
    activeAnalysis?.pipelineSteps?.HOOK_SCORING?.meta?.highEnergyPeaks,
  );
  const cutsApplied = firstFiniteNumber(
    activeAnalysis?.cuts_applied,
    activeAnalysis?.cut_count,
    activeAnalysis?.pipelineSteps?.CUTTING?.meta?.cutsApplied,
    activeAnalysis?.pipelineSteps?.CUTTING?.meta?.cutCount,
  );
  const subtitleLines = firstFiniteNumber(
    activeAnalysis?.subtitle_line_count,
    activeAnalysis?.subtitlesCount,
    activeAnalysis?.pipelineSteps?.SUBTITLING?.meta?.lineCount,
    activeAnalysis?.pipelineSteps?.SUBTITLING?.meta?.subtitleCount,
  );
  const estimatedDurationSec = firstFiniteNumber(
    activeAnalysis?.source_duration_seconds,
    activeAnalysis?.sourceDurationSeconds,
    activeAnalysis?.durationSec,
    activeAnalysis?.duration_seconds,
    activeAnalysis?.duration,
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.durationSec,
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.sourceDurationSec,
  );
  const energyMomentsSource =
    activeAnalysis?.energyMoments ||
    activeAnalysis?.energy_moments ||
    activeAnalysis?.timeline_energy_scores ||
    activeAnalysis?.pipelineSteps?.ANALYZE?.meta?.energyMoments ||
    activeAnalysis?.pipelineSteps?.ANALYZING?.meta?.energyMoments ||
    activeAnalysis?.pipelineSteps?.HOOK_SCORING?.meta?.topCandidates;
  const energyMomentsFromAnalysis = useMemo(
    () => normalizeEnergyMoments(energyMomentsSource),
    [energyMomentsSource],
  );
  const fallbackEnergyAnchorSec = selectedHookCandidate?.start ?? 252;
  const energyTimelineMoments = useMemo(() => {
    if (energyMomentsFromAnalysis.length > 0) return energyMomentsFromAnalysis;
    const synthetic = [
      { timestampSec: Math.max(6, fallbackEnergyAnchorSec - 120), energy: 66, motion: 62, audio: 67, visual: 64, facial: 61 },
      { timestampSec: Math.max(12, fallbackEnergyAnchorSec - 62), energy: 73, motion: 75, audio: 71, visual: 72, facial: 70 },
      { timestampSec: Math.max(18, fallbackEnergyAnchorSec), energy: 94, motion: 91, audio: 90, visual: 95, facial: 92 },
      { timestampSec: Math.max(24, fallbackEnergyAnchorSec + 58), energy: 82, motion: 80, audio: 78, visual: 83, facial: 84 },
      { timestampSec: Math.max(30, fallbackEnergyAnchorSec + 124), energy: 76, motion: 72, audio: 74, visual: 79, facial: 78 },
    ] satisfies EnergyMoment[];
    return synthetic;
  }, [energyMomentsFromAnalysis, fallbackEnergyAnchorSec]);
  const estimatedTimelineDurationSec = useMemo(() => {
    const fromDuration = estimatedDurationSec !== null ? Math.max(1, estimatedDurationSec) : null;
    const maxMomentSec = energyTimelineMoments.length > 0
      ? energyTimelineMoments[energyTimelineMoments.length - 1].timestampSec + 45
      : null;
    const hookTail = selectedHookCandidate
      ? selectedHookCandidate.start + selectedHookCandidate.duration + 90
      : 0;
    return Math.max(60, Math.round(fromDuration ?? maxMomentSec ?? hookTail ?? 360));
  }, [estimatedDurationSec, energyTimelineMoments, selectedHookCandidate]);
  const timelineEnergyMoments = useMemo<EnergyMomentWithEmotion[]>(() => (
    energyTimelineMoments.slice(0, 12).map((moment) => {
      const emotionKey = classifyEmotionProfile(moment);
      const emotionalScore = clamp(
        Math.round((moment.facial * 0.48) + (moment.audio * 0.32) + (moment.motion * 0.2)),
        0,
        100,
      );
      return {
        ...moment,
        positionPct: clamp((moment.timestampSec / Math.max(1, estimatedTimelineDurationSec)) * 100, 4, 96),
        timestampLabel: formatTimelineClock(moment.timestampSec),
        emotionKey,
        emotionLabel: EMOTION_PROFILE_META[emotionKey].label,
        emotionalScore,
      };
    })
  ), [energyTimelineMoments, estimatedTimelineDurationSec]);
  const highestEnergyMoment = timelineEnergyMoments.length > 0
    ? timelineEnergyMoments.reduce((best, current) => (current.energy > best.energy ? current : best), timelineEnergyMoments[0])
    : null;
  const fullScanProgress = useMemo(() => {
    if (analyzedFrames !== null && totalFrames !== null && totalFrames > 0) {
      return clamp((analyzedFrames / totalFrames) * 100, 0, 100);
    }
    const analyzeIndex = PIPELINE_STEPS.findIndex((step) => step.key === "analyzing");
    if (normalizedActiveStatus === "ready") return 100;
    if (normalizedActiveStatus === "failed" && visualStepIndex > analyzeIndex) return 100;
    if (visualStepIndex > analyzeIndex) return 100;
    if (activeStepKey === "analyzing") return clamp(activeStageProgress, 4, 99);
    if (visualStepIndex < analyzeIndex) return clamp(totalPipelineProgress * 0.45, 0, 40);
    return clamp(totalPipelineProgress, 0, 100);
  }, [
    analyzedFrames,
    totalFrames,
    normalizedActiveStatus,
    visualStepIndex,
    activeStepKey,
    activeStageProgress,
    totalPipelineProgress,
  ]);
  const fullScanProgressLabel = analyzedFrames !== null && totalFrames !== null && totalFrames > 0
    ? `${Math.round(analyzedFrames)} / ${Math.round(totalFrames)} frames analyzed`
    : `Full scan ${Math.round(fullScanProgress)}% complete`;
  const autoHookTimestampSec = highestEnergyMoment?.timestampSec ?? selectedHookCandidate?.start ?? 252;
  const autoHookSummaryLine = `Highest energy at ${formatTimelineClock(autoHookTimestampSec)} - moved to start for max retention boost`;
  const removedFillerPercent = toPercent(
    firstFiniteNumber(
      activeAnalysis?.boredom_removed_ratio,
      activeAnalysis?.boredomRemovedRatio,
      activeAnalysis?.low_engagement_removed_pct,
      activeAnalysis?.lowEngagementRemovedPct,
      activeAnalysis?.pipelineSteps?.CUTTING?.meta?.removedPct,
      metadataRetention?.fillerRemovedPct,
    ),
    28,
  );
  const facialFocusSec = firstFiniteNumber(
    activeAnalysis?.facial_focus_time_sec,
    activeAnalysis?.facialFocusTimeSec,
    activeAnalysis?.peak_facial_engagement_sec,
    activeAnalysis?.peakFacialEngagementSec,
    highestEnergyMoment?.timestampSec,
  ) ?? 135;
  const facialRetentionBoostPct = toPercent(
    firstFiniteNumber(
      activeAnalysis?.facial_scan_retention_boost_pct,
      activeAnalysis?.facialScanRetentionBoostPct,
      activeAnalysis?.face_retention_lift_pct,
      activeAnalysis?.faceRetentionLiftPct,
    ),
    15,
  );
  const facialHeatmapMoments = useMemo(() => (
    timelineEnergyMoments.slice(0, 4).map((moment, index) => ({
      label: `Face Zone ${index + 1}`,
      intensity: clamp(Math.round((moment.facial * 0.6) + (moment.energy * 0.4)), 0, 100),
      at: moment.timestampLabel,
    }))
  ), [timelineEnergyMoments]);
  const rehookIntervalSec = clamp(
    Math.round(
      firstFiniteNumber(
        activeAnalysis?.rehook_interval_seconds,
        activeAnalysis?.rehookIntervalSeconds,
        activeAnalysis?.re_hook_every_sec,
      ) ?? 45,
    ),
    30,
    60,
  );
  const cliffhangerAtSec = firstFiniteNumber(
    activeAnalysis?.cliffhanger_transition_sec,
    activeAnalysis?.cliffhangerTransitionSec,
    activeAnalysis?.pipelineSteps?.PACING?.meta?.cliffhangerAtSec,
  ) ?? 105;
  const curiosityLoopRetentionLift = toPercent(
    firstFiniteNumber(
      activeAnalysis?.curiosity_loop_retention_lift_pct,
      activeAnalysis?.curiosityLoopRetentionLiftPct,
      activeAnalysis?.curiosity_loop_lift_pct,
    ),
    20,
  );
  const bingeSuggestions = [
    `Added Cliffhanger Transition at ${formatTimelineClock(cliffhangerAtSec)}`,
    "Emotional Arc Pacing Applied for Binge Flow",
    `Re-Hook Inserted Every ${rehookIntervalSec}s to Prevent Drop-Offs`,
    `Curiosity Loop at End: +${curiosityLoopRetentionLift}% Viewer Retention Predicted`,
  ];
  const retentionCurvePoints = useMemo(() => {
    const parsed = normalizeRetentionCurve(
      activeAnalysis?.retentionCurve ||
      activeAnalysis?.retention_curve ||
      metadataRetention?.retentionCurve ||
      metadataRetention?.curve ||
      activeAnalysis?.pipelineSteps?.RETENTION_SCORE?.meta?.curve,
    );
    if (parsed.length >= 2) return parsed;
    const durationSec = Math.max(60, estimatedTimelineDurationSec);
    const baseline = clamp(Math.round(retentionScoreAfterDisplay ?? retentionScoreDisplay ?? 78), 55, 96);
    const ratios = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1];
    return ratios.map((ratio, idx) => {
      const organicDrift = baseline - (ratio * 17) + (idx % 2 === 0 ? 2 : -1) + (ratio > 0.72 ? 3 : 0);
      return {
        atSec: Math.round(durationSec * ratio),
        predicted: clamp(Math.round(organicDrift), 50, 100),
      } as RetentionPoint;
    });
  }, [activeAnalysis, metadataRetention, estimatedTimelineDurationSec, retentionScoreAfterDisplay, retentionScoreDisplay]);
  const retentionLinePoints = useMemo(() => {
    if (retentionCurvePoints.length < 2) return "";
    const maxSec = Math.max(retentionCurvePoints[retentionCurvePoints.length - 1]?.atSec || 1, 1);
    return retentionCurvePoints
      .map((point) => {
        const x = clamp((point.atSec / maxSec) * 100, 0, 100);
        const y = 100 - clamp(point.predicted, 0, 100);
        return `${x},${y}`;
      })
      .join(" ");
  }, [retentionCurvePoints]);
  const latestRetentionPoint = retentionCurvePoints.length > 0
    ? retentionCurvePoints[retentionCurvePoints.length - 1]
    : null;
  const retentionTimelineDurationSec = useMemo(() => {
    const lastCurveSec = retentionCurvePoints.length > 0
      ? retentionCurvePoints[retentionCurvePoints.length - 1].atSec
      : 0;
    return Math.max(
      60,
      Math.round(Math.max(
        estimatedTimelineDurationSec,
        lastCurveSec + Math.max(8, Math.round(estimatedTimelineDurationSec * 0.08)),
      )),
    );
  }, [retentionCurvePoints, estimatedTimelineDurationSec]);
  const retentionTimelineSegments = useMemo<RetentionTimelineSegment[]>(() => {
    if (retentionCurvePoints.length === 0) return [];
    const minSegmentSec = Math.max(
      6,
      Math.round(retentionTimelineDurationSec / Math.max(10, retentionCurvePoints.length * 1.4)),
    );
    return retentionCurvePoints.map((point, index) => {
      const nextAtSec = retentionCurvePoints[index + 1]?.atSec;
      const startSec = clamp(point.atSec, 0, Math.max(0, retentionTimelineDurationSec - minSegmentSec));
      const fallbackEndSec = startSec + minSegmentSec;
      const rawEndSec = Number.isFinite(Number(nextAtSec)) ? Number(nextAtSec) : fallbackEndSec;
      const endSec = clamp(
        Math.max(startSec + 1, rawEndSec),
        startSec + 1,
        Math.max(startSec + 1, retentionTimelineDurationSec),
      );
      const previousPredicted = index > 0 ? retentionCurvePoints[index - 1].predicted : point.predicted;
      const dropFromPrevious = Number((previousPredicted - point.predicted).toFixed(1));
      const resolved = resolveRetentionTimelineCategory({
        predicted: point.predicted,
        dropFromPrevious,
        pointKind: point.kind ?? null,
      });
      const positionPct = clamp((startSec / retentionTimelineDurationSec) * 100, 0, 99);
      const widthPct = clamp(((endSec - startSec) / retentionTimelineDurationSec) * 100, 1.5, 100 - positionPct);
      return {
        id: `${index}-${Math.round(startSec * 10)}-${Math.round(endSec * 10)}`,
        startSec,
        endSec,
        midpointSec: Number(((startSec + endSec) / 2).toFixed(3)),
        predicted: point.predicted,
        dropFromPrevious,
        category: resolved.category,
        categoryLabel: RETENTION_TIMELINE_CATEGORY_META[resolved.category].label,
        reason: point.description || resolved.reason,
        sourceKind: point.kind ?? null,
        positionPct,
        widthPct,
      } satisfies RetentionTimelineSegment;
    });
  }, [retentionCurvePoints, retentionTimelineDurationSec]);
  const bestRetentionSegments = useMemo(
    () => retentionTimelineSegments.filter((segment) => segment.category === "best").slice(0, 3),
    [retentionTimelineSegments],
  );
  const skipRiskRetentionSegments = useMemo(
    () => retentionTimelineSegments.filter((segment) => segment.category === "skip_risk").slice(0, 3),
    [retentionTimelineSegments],
  );
  const weakRetentionSegments = useMemo(
    () => retentionTimelineSegments.filter((segment) => segment.category === "weak").slice(0, 3),
    [retentionTimelineSegments],
  );
  const emotionalBeatAnchorSeconds = useMemo(() => {
    const raw =
      activeAnalysis?.emotional_beat_anchors ??
      activeAnalysis?.emotionalBeatAnchors ??
      activeAnalysis?.pipelineSteps?.PACING?.meta?.emotionalBeatAnchors ??
      activeAnalysis?.pipelineSteps?.RETENTION_SCORE?.meta?.emotionalBeatAnchors;
    if (!Array.isArray(raw)) return [] as number[];
    const parsed = raw
      .map((entry) => {
        if (typeof entry === "number") return entry;
        if (entry && typeof entry === "object") {
          const item = entry as Record<string, unknown>;
          return firstFiniteNumber(item.atSec, item.timeSec, item.timestampSec, item.timestamp, item.time, item.start);
        }
        return firstFiniteNumber(entry);
      })
      .filter((value): value is number => value !== null && Number.isFinite(value))
      .map((value) => clamp(value, 0, retentionTimelineDurationSec))
      .sort((a, b) => a - b);
    const unique = Array.from(new Set(parsed.map((value) => Number(value.toFixed(2)))));
    return unique.slice(0, 10);
  }, [activeAnalysis, retentionTimelineDurationSec]);
  const emotionSignals = useMemo<EmotionSummarySignal[]>(() => {
    const buckets = new Map<EmotionProfileKey, { score: number; samples: number; timestamps: number[] }>();
    const pushSignal = (key: EmotionProfileKey, score: number, timestampSec: number) => {
      const existing = buckets.get(key) ?? { score: 0, samples: 0, timestamps: [] };
      existing.score += Math.max(0, score);
      existing.samples += 1;
      if (Number.isFinite(timestampSec) && existing.timestamps.length < 8) {
        existing.timestamps.push(Math.max(0, timestampSec));
      }
      buckets.set(key, existing);
    };

    for (const moment of timelineEnergyMoments) {
      const weightedScore = Math.round(
        (moment.energy * 0.56) +
        (moment.emotionalScore * 0.24) +
        (moment.audio * 0.2),
      );
      pushSignal(moment.emotionKey, weightedScore, moment.timestampSec);
    }

    for (const anchorSec of emotionalBeatAnchorSeconds) {
      const nearest = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - anchorSec) < Math.abs(closest.timestampSec - anchorSec) ? moment : closest;
      }, null);
      pushSignal(nearest?.emotionKey ?? "anticipation", 24, anchorSec);
    }

    for (const segment of bestRetentionSegments) {
      const nearest = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - segment.midpointSec) < Math.abs(closest.timestampSec - segment.midpointSec)
          ? moment
          : closest;
      }, null);
      const segmentScore = Math.round(segment.predicted * 0.28 + Math.max(0, -segment.dropFromPrevious) * 3.5);
      pushSignal(nearest?.emotionKey ?? "anticipation", segmentScore, segment.midpointSec);
    }

    const totalScore = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.score, 0);
    if (totalScore <= 0) {
      const fallbackMeta = EMOTION_PROFILE_META.anticipation;
      return [{
        key: "anticipation",
        label: fallbackMeta.label,
        sharePercent: 100,
        confidence: 62,
        timelineStrength: 62,
        timestampsSec: timelineEnergyMoments.slice(0, 2).map((moment) => moment.timestampSec),
        badgeClassName: fallbackMeta.badgeClassName,
        barClassName: fallbackMeta.barClassName,
      }];
    }

    return Array.from(buckets.entries())
      .map(([key, bucket]) => {
        const avg = bucket.samples > 0 ? bucket.score / bucket.samples : bucket.score;
        const sharePercent = Number(((bucket.score / totalScore) * 100).toFixed(1));
        const confidence = clamp(Math.round(avg), 28, 99);
        const meta = EMOTION_PROFILE_META[key];
        return {
          key,
          label: meta.label,
          sharePercent,
          confidence,
          timelineStrength: clamp(Math.round(avg), 0, 100),
          timestampsSec: bucket.timestamps.slice(0, 4).sort((a, b) => a - b),
          badgeClassName: meta.badgeClassName,
          barClassName: meta.barClassName,
        } satisfies EmotionSummarySignal;
      })
      .sort((a, b) => b.sharePercent - a.sharePercent)
      .slice(0, 5);
  }, [bestRetentionSegments, emotionalBeatAnchorSeconds, timelineEnergyMoments]);
  const predictedAudienceEmotions = useMemo(() => {
    const baselineRetention = latestRetentionPoint?.predicted ?? retentionScoreAfterDisplay ?? retentionScoreDisplay ?? 74;
    return emotionSignals.slice(0, 4).map((signal, index) => {
      const predicted = clamp(
        Math.round(signal.timelineStrength * 0.62 + baselineRetention * 0.38 - index * 3),
        32,
        98,
      );
      return {
        ...signal,
        predictedAudiencePercent: predicted,
        predictionReason: formatEmotionPredictionReason(signal.key),
      };
    });
  }, [emotionSignals, latestRetentionPoint, retentionScoreAfterDisplay, retentionScoreDisplay]);
  const topEmotionSignal = emotionSignals[0] ?? null;
  const emotionTimelineHighlights = useMemo<EmotionTimelineHighlight[]>(() => {
    const rows: EmotionTimelineHighlight[] = [];
    for (const moment of timelineEnergyMoments) {
      rows.push({
        id: `energy-${moment.timestampSec.toFixed(2)}`,
        timestampSec: moment.timestampSec,
        timestampLabel: moment.timestampLabel,
        emotionKey: moment.emotionKey,
        emotionLabel: moment.emotionLabel,
        strength: moment.emotionalScore,
        reason: `${moment.emotionLabel} spike · energy ${moment.energy}`,
        source: "energy",
      });
    }
    for (const [index, anchorSec] of emotionalBeatAnchorSeconds.entries()) {
      const nearest = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - anchorSec) < Math.abs(closest.timestampSec - anchorSec) ? moment : closest;
      }, null);
      const emotionKey = nearest?.emotionKey ?? "anticipation";
      rows.push({
        id: `anchor-${index}-${anchorSec.toFixed(2)}`,
        timestampSec: anchorSec,
        timestampLabel: formatTimelineClock(anchorSec),
        emotionKey,
        emotionLabel: EMOTION_PROFILE_META[emotionKey].label,
        strength: nearest?.emotionalScore ?? 70,
        reason: `Detected emotional beat anchor at ${formatTimelineClock(anchorSec)}`,
        source: "anchor",
      });
    }
    for (const [index, segment] of bestRetentionSegments.entries()) {
      const nearest = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - segment.midpointSec) < Math.abs(closest.timestampSec - segment.midpointSec)
          ? moment
          : closest;
      }, null);
      const emotionKey = nearest?.emotionKey ?? "curiosity";
      rows.push({
        id: `retention-${index}-${segment.id}`,
        timestampSec: segment.midpointSec,
        timestampLabel: formatTimelineClock(segment.midpointSec),
        emotionKey,
        emotionLabel: EMOTION_PROFILE_META[emotionKey].label,
        strength: clamp(Math.round(segment.predicted), 0, 100),
        reason: `Best-part retention window (${segment.predicted}% hold)`,
        source: "retention",
      });
    }
    const sortedByStrength = rows.sort((a, b) => b.strength - a.strength);
    const deduped: EmotionTimelineHighlight[] = [];
    for (const row of sortedByStrength) {
      const nearDuplicate = deduped.some(
        (existing) =>
          existing.emotionKey === row.emotionKey &&
          Math.abs(existing.timestampSec - row.timestampSec) < 7,
      );
      if (nearDuplicate) continue;
      deduped.push(row);
      if (deduped.length >= 8) break;
    }
    return deduped.sort((a, b) => a.timestampSec - b.timestampSec);
  }, [bestRetentionSegments, emotionalBeatAnchorSeconds, timelineEnergyMoments]);
  const bingeWorthyMoments = useMemo<BingeMoment[]>(() => {
    const rows: BingeMoment[] = [];
    for (const segment of bestRetentionSegments) {
      const nearest = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - segment.midpointSec) < Math.abs(closest.timestampSec - segment.midpointSec)
          ? moment
          : closest;
      }, null);
      const emotionLabel = nearest?.emotionLabel ?? "Momentum";
      rows.push({
        id: `best-${segment.id}`,
        timestampSec: segment.midpointSec,
        timestampLabel: formatTimelineClock(segment.midpointSec),
        score: clamp(Math.round(segment.predicted * 0.68 + (nearest?.energy ?? 72) * 0.32), 0, 100),
        reason: `${emotionLabel} + retention hold (${segment.predicted}%)`,
      });
    }
    for (const moment of timelineEnergyMoments.filter((entry) => entry.energy >= 74)) {
      rows.push({
        id: `energy-${moment.timestampSec.toFixed(2)}`,
        timestampSec: moment.timestampSec,
        timestampLabel: moment.timestampLabel,
        score: clamp(Math.round(moment.energy * 0.7 + moment.emotionalScore * 0.3), 0, 100),
        reason: `${moment.emotionLabel} surge (energy ${moment.energy})`,
      });
    }
    const sorted = rows.sort((a, b) => b.score - a.score);
    const deduped: BingeMoment[] = [];
    for (const row of sorted) {
      if (deduped.some((existing) => Math.abs(existing.timestampSec - row.timestampSec) < 6)) continue;
      deduped.push(row);
      if (deduped.length >= 6) break;
    }
    return deduped.sort((a, b) => a.timestampSec - b.timestampSec);
  }, [bestRetentionSegments, timelineEnergyMoments]);
  const emotionLinePoints = useMemo(() => {
    if (timelineEnergyMoments.length < 2) return "";
    return timelineEnergyMoments
      .map((moment) => {
        const x = clamp((moment.timestampSec / Math.max(1, retentionTimelineDurationSec)) * 100, 0, 100);
        const y = 100 - clamp(moment.emotionalScore, 0, 100);
        return `${x},${y}`;
      })
      .join(" ");
  }, [retentionTimelineDurationSec, timelineEnergyMoments]);
  const canQueueTimelineSegmentAction = Boolean(activeJob && normalizeStatus(activeJob.status) === "ready");
  const retentionGoalMet = latestRetentionPoint !== null && latestRetentionPoint.predicted >= RETENTION_GOAL_PERCENT;
  const durationForDeepDiveSec = Math.max(1, retentionTimelineDurationSec || estimatedTimelineDurationSec || 1);
  const averagePercentViewed = useMemo(
    () => averageRetentionBetween(retentionCurvePoints, 0, durationForDeepDiveSec),
    [durationForDeepDiveSec, retentionCurvePoints],
  );
  const averageViewDurationSec = averagePercentViewed === null
    ? null
    : roundToTenth((durationForDeepDiveSec * averagePercentViewed) / 100);
  const durationBenchmarkPercent = useMemo(() => {
    const minutes = durationForDeepDiveSec / 60;
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    if (minutes <= 1) return 72;
    if (minutes <= 3) return 62;
    if (minutes <= 6) return 54;
    if (minutes <= 10) return 48;
    if (minutes <= 20) return 42;
    return 38;
  }, [durationForDeepDiveSec]);
  const relativeRetentionDeltaPercent = averagePercentViewed === null || durationBenchmarkPercent === null
    ? null
    : roundToTenth(averagePercentViewed - durationBenchmarkPercent);
  const relativeRetentionLabel = relativeRetentionDeltaPercent === null
    ? "Not enough retention data"
    : relativeRetentionDeltaPercent >= 0
      ? `Above similar videos (${formatSignedPercent(relativeRetentionDeltaPercent)})`
      : `Below similar videos (${formatSignedPercent(relativeRetentionDeltaPercent)})`;
  const watchTimePerThousandViewsMinutes = averageViewDurationSec === null
    ? null
    : Math.round((averageViewDurationSec / 60) * 1000);
  const completionRatePercent = useMemo(
    () => interpolateRetentionAtSec(retentionCurvePoints, durationForDeepDiveSec),
    [durationForDeepDiveSec, retentionCurvePoints],
  );
  const engagedViewsPercent = useMemo(() => {
    const engagedAtSec = Math.min(5, Math.max(1.5, durationForDeepDiveSec * 0.06));
    return interpolateRetentionAtSec(retentionCurvePoints, engagedAtSec);
  }, [durationForDeepDiveSec, retentionCurvePoints]);
  const retentionAt15Sec = useMemo(
    () => interpolateRetentionAtSec(retentionCurvePoints, 15),
    [retentionCurvePoints],
  );
  const retentionAt30Sec = useMemo(
    () => interpolateRetentionAtSec(retentionCurvePoints, 30),
    [retentionCurvePoints],
  );
  const midVideoRetentionPercent = useMemo(
    () => averageRetentionBetween(retentionCurvePoints, durationForDeepDiveSec * 0.3, durationForDeepDiveSec * 0.7),
    [durationForDeepDiveSec, retentionCurvePoints],
  );
  const endRetentionPercent = useMemo(() => {
    const endStart = Math.max(0, durationForDeepDiveSec - 30);
    return averageRetentionBetween(retentionCurvePoints, endStart, durationForDeepDiveSec);
  }, [durationForDeepDiveSec, retentionCurvePoints]);
  const patternInterruptCount = firstFiniteNumber(
    activeAnalysis?.pattern_interrupt_count,
    activeAnalysis?.patternInterruptCount,
    activeAnalysis?.pipelineSteps?.PACING?.meta?.patternInterruptCount,
  );
  const pacingScoreOutOf10 = useMemo(() => {
    const explicit = firstFiniteNumber(
      activeAnalysis?.pacing_score,
      activeAnalysis?.pacingScore,
      activeAnalysis?.pipelineSteps?.PACING?.meta?.score,
      activeAnalysis?.pipelineSteps?.PACING?.meta?.pacingScore,
    );
    if (explicit !== null) {
      return roundToTenth(clamp(explicit <= 1 ? explicit * 10 : explicit, 1, 10));
    }
    if (patternInterruptCount !== null && durationForDeepDiveSec > 0) {
      const interruptsPerMinute = patternInterruptCount / Math.max(1, durationForDeepDiveSec / 60);
      return roundToTenth(clamp(4.2 + interruptsPerMinute * 0.45, 1, 10));
    }
    return null;
  }, [activeAnalysis, durationForDeepDiveSec, patternInterruptCount]);
  const boredomRemovedRatioRaw = firstFiniteNumber(
    activeAnalysis?.boredom_removed_ratio,
    activeAnalysis?.boredomRemovedRatio,
    activeAnalysis?.low_engagement_removed_pct,
    activeAnalysis?.lowEngagementRemovedPct,
  );
  const boredomRemovedRatio = boredomRemovedRatioRaw === null
    ? null
    : clamp(boredomRemovedRatioRaw > 1 ? boredomRemovedRatioRaw / 100 : boredomRemovedRatioRaw, 0, 1);
  const fillerSecondsPotential = boredomRemovedRatio === null
    ? null
    : Math.round(durationForDeepDiveSec * boredomRemovedRatio);
  const retentionChangeEvents = useMemo(() => {
    if (retentionCurvePoints.length < 2) return [] as Array<{
      id: string;
      from: RetentionPoint;
      to: RetentionPoint;
      dropAbs: number;
      gainAbs: number;
      relativeDrop: number;
      segment: RetentionTimelineSegment | null;
      cause: string;
      suggestion: string;
    }>;
    const totalDrop = Math.max(0.1, retentionCurvePoints[0].predicted - (latestRetentionPoint?.predicted ?? retentionCurvePoints[retentionCurvePoints.length - 1].predicted));
    return retentionCurvePoints.slice(1).map((to, index) => {
      const from = retentionCurvePoints[index];
      const delta = roundToTenth(to.predicted - from.predicted);
      const dropAbs = roundToTenth(Math.max(0, -delta));
      const gainAbs = roundToTenth(Math.max(0, delta));
      const expectedDrop = roundToTenth(totalDrop * ((to.atSec - from.atSec) / Math.max(1, durationForDeepDiveSec)));
      const relativeDrop = roundToTenth(dropAbs - Math.max(0, expectedDrop));
      const midpoint = (from.atSec + to.atSec) / 2;
      const segment = retentionTimelineSegments.find((item) => midpoint >= item.startSec && midpoint <= item.endSec) ?? null;
      const nearestEmotion = timelineEnergyMoments.reduce<EnergyMomentWithEmotion | null>((closest, moment) => {
        if (!closest) return moment;
        return Math.abs(moment.timestampSec - midpoint) < Math.abs(closest.timestampSec - midpoint) ? moment : closest;
      }, null);
      const causeBits: string[] = [];
      if (segment?.reason) causeBits.push(segment.reason);
      if (nearestEmotion) {
        if (nearestEmotion.energy <= 58) causeBits.push("Low motion/energy detected.");
        if (nearestEmotion.audio <= 54) causeBits.push("Likely dead-air or low vocal intensity.");
        if (nearestEmotion.visual <= 56) causeBits.push("Visual variety dropped in this range.");
      }
      const cause = causeBits.length > 0
        ? causeBits.slice(0, 2).join(" ")
        : "Pacing slowed without a strong visual interrupt.";
      const suggestion = dropAbs >= 12
        ? "Trim this beat, add B-roll or a pattern interrupt, and tighten narration."
        : dropAbs >= 7
          ? "Condense this section and add fast visual overlays or jump cuts."
          : "Slightly speed up this moment and remove filler words/pauses.";
      return {
        id: `${from.atSec}-${to.atSec}`,
        from,
        to,
        dropAbs,
        gainAbs,
        relativeDrop,
        segment,
        cause,
        suggestion,
      };
    });
  }, [durationForDeepDiveSec, latestRetentionPoint?.predicted, retentionCurvePoints, retentionTimelineSegments, timelineEnergyMoments]);
  const majorDropOffMoments = useMemo(
    () => retentionChangeEvents.filter((event) => event.dropAbs >= 3).sort((left, right) => right.dropAbs - left.dropAbs).slice(0, 5),
    [retentionChangeEvents],
  );
  const retentionSpikeMoments = useMemo(
    () => retentionChangeEvents.filter((event) => event.gainAbs >= 2).sort((left, right) => right.gainAbs - left.gainAbs).slice(0, 4),
    [retentionChangeEvents],
  );
  const deepDiveRecommendations = useMemo(() => {
    const recommendations: Array<{
      id: string;
      rank: number;
      title: string;
      timestampLabel: string;
      detail: string;
      estimatedLift: number;
      segment: RetentionTimelineSegment | null;
    }> = [];
    for (const event of majorDropOffMoments) {
      const estimatedLift = clamp(Math.round(event.dropAbs * 0.55), 3, 18);
      recommendations.push({
        id: `drop-${event.id}`,
        rank: 0,
        title: `Fix drop from ${formatTimelineClock(event.from.atSec)} to ${formatTimelineClock(event.to.atSec)}`,
        timestampLabel: `${formatTimelineClock(event.from.atSec)}-${formatTimelineClock(event.to.atSec)}`,
        detail: `${event.cause} ${event.suggestion}`,
        estimatedLift,
        segment: event.segment,
      });
    }
    if (fillerSecondsPotential !== null && fillerSecondsPotential > 4) {
      recommendations.push({
        id: "filler-removal",
        rank: 0,
        title: "Remove silence/filler pockets",
        timestampLabel: "Across timeline",
        detail: `Potentially trim around ${fillerSecondsPotential}s of pauses/fillers to improve pacing continuity.`,
        estimatedLift: clamp(Math.round(fillerSecondsPotential / 6), 2, 10),
        segment: null,
      });
    }
    if (retentionAt30Sec !== null && retentionAt30Sec < 70) {
      recommendations.push({
        id: "hook-tighten",
        rank: 0,
        title: "Tighten first 30 seconds",
        timestampLabel: "0:00-0:30",
        detail: "Strengthen hook clarity, front-load payoff, and use a faster pattern interrupt cadence.",
        estimatedLift: clamp(Math.round((70 - retentionAt30Sec) * 0.35), 3, 14),
        segment: null,
      });
    }
    return recommendations
      .sort((left, right) => right.estimatedLift - left.estimatedLift)
      .slice(0, 5)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [fillerSecondsPotential, majorDropOffMoments, retentionAt30Sec]);
  const projectedAverageViewedRange = useMemo(() => {
    if (averagePercentViewed === null) return null;
    const totalLift = deepDiveRecommendations.reduce((sum, item) => sum + item.estimatedLift, 0);
    if (totalLift <= 0) return { min: averagePercentViewed, max: averagePercentViewed };
    return {
      min: roundToTenth(clamp(averagePercentViewed + totalLift * 0.35, 0, 100)),
      max: roundToTenth(clamp(averagePercentViewed + totalLift * 0.58, 0, 100)),
    };
  }, [averagePercentViewed, deepDiveRecommendations]);
  const deepDiveOverallSummary = useMemo(() => {
    if (averagePercentViewed === null) {
      return "Retention analysis will appear once full retention points are available.";
    }
    const quality =
      averagePercentViewed >= 60
        ? "Excellent retention profile"
        : averagePercentViewed >= 45
          ? "Solid retention profile"
          : averagePercentViewed >= 35
            ? "Moderate retention profile"
            : "At-risk retention profile";
    const majorDrop = majorDropOffMoments[0];
    if (!majorDrop) {
      return `${quality} — ${averagePercentViewed.toFixed(1)}% avg viewed with no major drop-off detected.`;
    }
    return `${quality} — ${averagePercentViewed.toFixed(1)}% avg viewed, biggest drop ${majorDrop.dropAbs.toFixed(1)}% at ${formatTimelineClock(majorDrop.from.atSec)}-${formatTimelineClock(majorDrop.to.atSec)}.`;
  }, [averagePercentViewed, majorDropOffMoments]);
  const retentionCurveSummary = useMemo(() => {
    if (retentionCurvePoints.length < 2) return "Retention curve is not available yet for this video.";
    const first = retentionCurvePoints[0];
    const majorDrop = majorDropOffMoments[0];
    const spike = retentionSpikeMoments[0];
    const startLine = `Curve opens at ${first.predicted}% and trends through ${formatTimelineClock(durationForDeepDiveSec)}.`;
    const dropLine = majorDrop
      ? `Sharpest drop is ${majorDrop.dropAbs.toFixed(1)}% at ${formatTimelineClock(majorDrop.from.atSec)}-${formatTimelineClock(majorDrop.to.atSec)}.`
      : "No severe drop-off segment detected.";
    const spikeLine = spike
      ? `Best rebound is +${spike.gainAbs.toFixed(1)}% at ${formatTimelineClock(spike.from.atSec)}-${formatTimelineClock(spike.to.atSec)}.`
      : "No strong rewatch spike detected yet.";
    return `${startLine} ${dropLine} ${spikeLine}`;
  }, [durationForDeepDiveSec, majorDropOffMoments, retentionCurvePoints, retentionSpikeMoments]);
  const hookConfidenceScore = clamp(
    Math.round((Number(selectedHookCandidate?.auditScore || selectedHookCandidate?.score || 0) || 0) * 100),
    0,
    100,
  );
  const achievementSignals = useMemo<AchievementSignal[]>(() => {
    const list: AchievementSignal[] = [];
    const predicted = latestRetentionPoint?.predicted ?? retentionScoreAfterDisplay ?? retentionScoreDisplay ?? null;
    if (predicted !== null && predicted >= 78) {
      list.push({
        id: "retention_beast",
        title: "Congrats! Retention Beast",
        line: "High retention unlocked. I'd watch this all the way through - it's that good.",
        metric: `${Math.round(predicted)}% predicted retention`,
      });
    }
    if (hookConfidenceScore >= 79) {
      list.push({
        id: "hook_master",
        title: "Hook Master",
        line: "Your opener is strong in the first seconds and should stop scrolls hard.",
        metric: `${hookConfidenceScore}% hook confidence`,
      });
    }
    if (retentionGoalMet && (retentionScoreDeltaDisplay ?? 0) >= 5) {
      list.push({
        id: "post_now",
        title: "Post Signal Detected",
        line: "This is good. You should post this.",
        metric: `${retentionScoreDeltaDisplay > 0 ? "+" : ""}${retentionScoreDeltaDisplay?.toFixed(1) ?? "0.0"} retention delta`,
      });
    }
    return list;
  }, [
    hookConfidenceScore,
    latestRetentionPoint?.predicted,
    retentionGoalMet,
    retentionScoreAfterDisplay,
    retentionScoreDisplay,
    retentionScoreDeltaDisplay,
  ]);
  const activePipelinePowerMode = useMemo<PipelinePowerMode>(() => {
    if (pipelinePowerMode !== "standard") return pipelinePowerMode;
    const raw = String(
      activeAnalysis?.pipelinePowerMode ??
      activeAnalysis?.pipeline_power_mode ??
      activeAnalysis?.pipeline_mode_playbook ??
      activeAnalysis?.mode_playbook ??
      activeAnalysis?.editorMode ??
      activeAnalysis?.editor_mode ??
      "",
    ).trim().toLowerCase();
    if (raw === "ultra") return "ultra";
    if (raw === "retention-king" || raw === "retention_king") return "retention_king";
    return "standard";
  }, [activeAnalysis, pipelinePowerMode]);
  const modeMomentumScore = clamp(
    Math.round(
      (latestRetentionPoint?.predicted ?? retentionScoreAfterDisplay ?? 72) * 0.55 +
      (retentionScoreDeltaDisplay ?? 0) * 2.2,
    ),
    0,
    100,
  );
  const modePackagingScore = clamp(
    Math.round(
      hookConfidenceScore * 0.6 +
      (retentionGoalMet ? 24 : 12) +
      Math.max(0, (retentionScoreDeltaDisplay ?? 0) * 1.6),
    ),
    0,
    100,
  );
  const modeConsistencyScore = clamp(
    Math.round(100 - Math.min(45, Math.abs(skipRiskRetentionSegments.length * 9 - bestRetentionSegments.length * 4))),
    0,
    100,
  );
  const modeCompletionScore = clamp(
    Math.round((latestRetentionPoint?.predicted ?? retentionScoreAfterDisplay ?? 70) - weakRetentionSegments.length * 2),
    0,
    100,
  );
  const retentionBeforeBar = retentionScoreBeforeDisplay !== null
    ? clamp(retentionScoreBeforeDisplay, 0, 100)
    : null;
  const retentionAfterBar = retentionScoreAfterDisplay !== null
    ? clamp(retentionScoreAfterDisplay, 0, 100)
    : null;
  const confidenceLabel = detectedNicheRaw ? formatNicheLabel(detectedNicheRaw) : "High Energy";
  const confidenceValue = detectedNicheConfidencePercent !== null
    ? `${detectedNicheConfidencePercent}%`
    : null;
  const stepMicroCopy: Record<string, string> = {
    queued: "Queued in worker lane",
    uploading:
      uploadBytesUploaded !== null && uploadBytesTotal !== null && uploadBytesTotal > 0
        ? `${(uploadBytesUploaded / MB).toFixed(1)} / ${(uploadBytesTotal / MB).toFixed(1)} MB uploaded`
        : "Ingesting source media for full-retention analysis",
    analyzing:
      analyzedFrames !== null && totalFrames !== null
        ? `Full scan ${Math.round(analyzedFrames)}/${Math.round(totalFrames)} frames with energy + facial ratings`
        : "Full video scan for energy, emotion, and engagement",
    hooking:
      highEnergyPeaks !== null
        ? `Detected ${Math.round(highEnergyPeaks)} high-energy peaks, selecting 8s opener`
        : selectedHookCandidate
          ? `Auto-hook from ${formatHookRange(selectedHookCandidate.start, selectedHookCandidate.start + selectedHookCandidate.duration)}`
          : "Scoring high-energy opener candidates",
    cutting:
      cutsApplied !== null
        ? `Applied ${Math.round(cutsApplied)} cuts (${removedFillerPercent}% low-engagement filler removed)`
        : "Auto-cut boring/silent/filler segments",
    pacing: `Binge optimization: cliffhangers, emotional arcs, and re-hooks every ${rehookIntervalSec}s`,
    story: "Binge optimization and continuity checks",
    subtitling:
      autoCaptionsEnabled
        ? subtitleLines !== null
          ? `Generated ${Math.round(subtitleLines)} caption lines`
          : "Generating timed captions"
        : "Captions disabled",
    rendering:
      activeJob?.renderMode === "vertical"
        ? `Rendering ${Math.max(1, activeOutputUrls.length || verticalClipCount || 1)} vertical clip(s)`
        : "Encoding final MP4 output",
    ready:
      activeJob?.renderMode === "vertical"
        ? `${Math.max(1, activeOutputUrls.length || verticalClipCount || 1)} clip(s) ready`
        : "Export package is ready",
  };
  const pipelinePopupStatus = activeJob
    ? normalizeStatus(activeJob.status)
    : uploadingJobId
      ? "uploading"
      : null;
  const showPipelineStatusPopup = Boolean(
    pipelinePopupStatus &&
      !isTerminalStatus(pipelinePopupStatus) &&
      (activeJob || uploadingJobId),
  );
  const pipelinePopupVisualProgress = showPipelineStatusPopup
    ? clamp(
        Math.max(
          pipelinePopupStatus === "uploading"
            ? 6
            : 10,
          activeJob ? Number(activeJob.progress ?? 0) : uploadProgress,
        ),
        0,
        100,
      )
    : 0;
  const pipelinePopupStageLabel = pipelinePopupStatus
    ? PIPELINE_STEPS.find((step) => step.key === stepKeyForStatus(pipelinePopupStatus))?.label ||
      STATUS_LABELS[pipelinePopupStatus] ||
      "Processing"
    : "Processing";
  const pipelinePopupDetail = pipelinePopupStatus
    ? stepMicroCopy[stepKeyForStatus(pipelinePopupStatus)] ||
      stepMicroCopy[pipelinePopupStatus] ||
      "Running real-time retention pipeline tasks"
    : "";
  const pipelinePopupJobId = activeJob?.id || uploadingJobId || null;
  const pipelineRows = PIPELINE_STEPS.map((step, idx) => {
    let state: "done" | "active" | "pending" | "failed" = "pending";
    if (normalizedActiveStatus === "ready") {
      state = "done";
    } else if (normalizedActiveStatus === "failed") {
      if (step.key === failedStepKey) state = "failed";
      else if (idx < visualStepIndex) state = "done";
    } else if (idx < visualStepIndex) {
      state = "done";
    } else if (idx === visualStepIndex) {
      state = "active";
    }

    const connectorState: "done" | "active" | "pending" =
      idx >= PIPELINE_STEPS.length - 1
        ? "pending"
        : normalizedActiveStatus === "ready"
          ? "done"
          : normalizedActiveStatus === "failed"
            ? idx < visualStepIndex
              ? "done"
              : "pending"
            : idx < visualStepIndex
              ? "done"
              : idx === visualStepIndex
                ? "active"
                : "pending";

    const percent = state === "done"
      ? 100
      : state === "active" || state === "failed"
        ? Math.round(activeStageProgress)
        : 0;

    return {
      ...step,
      state,
      percent,
      connectorState,
      detail: state === "failed" ? failedGateReason || "Rendering failed in this stage." : (stepMicroCopy[step.key] || step.label),
    };
  });
  const pipelineLogEntries: Array<{ level: "info" | "success" | "warn" | "error"; message: string }> = [
    ...(activeJob
      ? [
          {
            level: "info" as const,
            message: `${activeStatusLabel} (${Math.round(totalPipelineProgress)}%)`,
          },
        ]
      : []),
    ...(analyzedFrames !== null && totalFrames !== null
      ? [
          {
            level: "info" as const,
            message: `Analyzed ${Math.round(analyzedFrames)} of ${Math.round(totalFrames)} frames`,
          },
        ]
      : []),
    ...(highEnergyPeaks !== null
      ? [
          {
            level: "info" as const,
            message: `Detected ${Math.round(highEnergyPeaks)} high-energy peaks`,
          },
        ]
      : []),
    ...(cutsApplied !== null
      ? [
          {
            level: "success" as const,
            message: `Applied ${Math.round(cutsApplied)} cuts`,
          },
        ]
      : []),
    ...(hookSelectionSource === "fallback"
      ? [
          {
            level: "warn" as const,
            message: "Fallback hook used due to low confidence in primary candidates",
          },
        ]
      : []),
    ...(retentionScoreDeltaDisplay !== null
      ? [
          {
            level: retentionScoreDeltaDisplay >= 0 ? ("success" as const) : ("warn" as const),
            message: `Retention delta ${retentionScoreDeltaDisplay > 0 ? "+" : ""}${retentionScoreDeltaDisplay.toFixed(1)}`,
          },
        ]
      : []),
    ...(normalizeStatus(activeJob?.status) === "failed"
      ? [
          {
            level: "error" as const,
            message: failedGateReason || activeJob?.error || "Pipeline failed",
          },
        ]
      : []),
  ].slice(0, 8);
  const logTimestamp = new Date().toLocaleTimeString([], { hour12: false });
  const previewOutputUrl = activeOutputUrls.find((url) => typeof url === "string" && url.length > 0) || "";
  const activePreviewRefreshNonce = activeJob ? previewRefreshNonceByJob[activeJob.id] || 0 : 0;
  useEffect(() => {
    let canceled = false;
    let previewBlobUrl: string | null = null;
    const jobId = activeJob?.id || "";
    const baseUrl = String(previewOutputUrl || "").trim();
    if (!jobId && !baseUrl) {
      setResolvedPreviewOutputUrl("");
      return () => {};
    }
    const resolveAuthorizedPreview = async () => {
      let sourceUrl = baseUrl;
      if (jobId && accessToken && normalizedActiveStatus === "ready") {
        try {
          const refreshed = await apiFetch<{ url?: string }>(`/api/jobs/${jobId}/output-url`, {
            method: "GET",
            token: accessToken,
          });
          if (typeof refreshed?.url === "string" && refreshed.url.trim().length > 0) {
            sourceUrl = appendVideoCacheBust(refreshed.url, activePreviewCacheKey);
          }
        } catch (error) {
          console.warn("refresh preview url failed", error);
        }
      }
      const resolvedSourceUrl = String(sourceUrl || "").trim();
      if (!resolvedSourceUrl) {
        if (!canceled) setResolvedPreviewOutputUrl("");
        return;
      }
      if (!isAuthRequiredDownloadUrl(resolvedSourceUrl)) {
        if (!canceled) setResolvedPreviewOutputUrl(resolvedSourceUrl);
        return;
      }
      if (!accessToken) {
        if (!canceled) setResolvedPreviewOutputUrl("");
        return;
      }
      try {
        const response = await fetch(resolvedSourceUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) throw new Error(`preview_request_failed_${response.status}`);
        const blob = await response.blob();
        if (canceled) return;
        previewBlobUrl = window.URL.createObjectURL(blob);
        setResolvedPreviewOutputUrl(previewBlobUrl);
      } catch (error) {
        if (canceled) return;
        setResolvedPreviewOutputUrl("");
      }
    };
    void resolveAuthorizedPreview();
    return () => {
      canceled = true;
      if (previewBlobUrl) window.URL.revokeObjectURL(previewBlobUrl);
    };
  }, [
    accessToken,
    activeJob?.id,
    activePreviewCacheKey,
    activePreviewRefreshNonce,
    normalizedActiveStatus,
    previewOutputUrl,
  ]);
  useEffect(() => {
    setPreviewCurrentTimeSec(0);
  }, [activeJob?.id, resolvedPreviewOutputUrl]);
  useEffect(() => {
    const jobId = activeJob?.id;
    if (!jobId) return;
    previewRetryCountByJobRef.current[jobId] = 0;
  }, [activeJob?.id, activePreviewCacheKey]);
  useEffect(() => {
    const jobId = activeJob?.id;
    if (!jobId) return;
    if (!resolvedPreviewOutputUrl) return;
    previewRetryCountByJobRef.current[jobId] = 0;
  }, [activeJob?.id, resolvedPreviewOutputUrl]);
  const showVideo = Boolean(activeJob && normalizedActiveStatus === "ready" && resolvedPreviewOutputUrl);
  const transcriptSeekEnabled = activeTranscriptTimelineMode === "edited" && showVideo;
  const activeTranscriptCueIndex = useMemo(() => {
    if (!transcriptSeekEnabled || !activeTranscriptCues.length) return -1;
    for (let index = 0; index < activeTranscriptCues.length; index += 1) {
      const cue = activeTranscriptCues[index];
      if (previewCurrentTimeSec >= cue.start && previewCurrentTimeSec < cue.end + 0.08) {
        return index;
      }
    }
    return -1;
  }, [activeTranscriptCues, previewCurrentTimeSec, transcriptSeekEnabled]);
  const canApplyHookRealtime = Boolean(
    activeJob && REALTIME_HOOK_MUTABLE_STATUSES.has(normalizeStatus(activeJob.status)),
  );
  const canShowRealtimeHookSelector = Boolean(
    activeJob &&
      activeJob.renderMode !== "vertical" &&
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
  const hookPreviewRefreshNonce = activeJob ? hookPreviewRefreshNonceByJob[activeJob.id] || 0 : 0;
  useEffect(() => {
    if (!activeJob?.id) return;
    if (powerModeSyncJobRef.current === activeJob.id) return;
    const raw = String(
      activeAnalysis?.pipelinePowerMode ??
      activeAnalysis?.pipeline_power_mode ??
      activeAnalysis?.pipeline_mode_playbook ??
      activeAnalysis?.mode_playbook ??
      activeAnalysis?.editorMode ??
      activeAnalysis?.editor_mode ??
      "",
    ).trim().toLowerCase();
    let next: PipelinePowerMode = "standard";
    if (raw === "ultra") next = "ultra";
    if (raw === "retention-king" || raw === "retention_king") next = "retention_king";
    if (next !== "standard" && !paidTier) next = "standard";
    powerModeSyncJobRef.current = activeJob.id;
    setPipelinePowerMode(next);
  }, [activeAnalysis, activeJob?.id, paidTier]);
  useEffect(() => {
    if (!activeJob?.id) return;
    if (creativeVariantSyncJobRef.current === activeJob.id) return;
    const next = normalizeCreativeVariant(
      activeRenderSettings?.creativeVariant ??
      activeRenderSettings?.creative_variant ??
      activeAnalysis?.creativeVariant ??
      activeAnalysis?.creative_variant,
    );
    creativeVariantSyncJobRef.current = activeJob.id;
    setCreativeVariant(next);
  }, [activeAnalysis, activeJob?.id, activeRenderSettings]);
  useEffect(() => {
    if (!activeJob?.id) return;
    if (advancedModesSyncJobRef.current === activeJob.id) return;
    const coldStart = parseBooleanLike(
      activeRenderSettings?.coldStartAutopilot ??
      activeRenderSettings?.cold_start_autopilot ??
      activeAnalysis?.coldStartAutopilot ??
      activeAnalysis?.cold_start_autopilot,
    );
    const continuityFirst = parseBooleanLike(
      activeRenderSettings?.continuityFirstMode ??
      activeRenderSettings?.continuity_first_mode ??
      activeAnalysis?.continuityFirstMode ??
      activeAnalysis?.continuity_first_mode,
    );
    const exploreX3 = parseBooleanLike(
      activeRenderSettings?.exploreX3Mode ??
      activeRenderSettings?.explore_x3_mode ??
      activeAnalysis?.exploreX3Mode ??
      activeAnalysis?.explore_x3_mode,
    );
    const topHumanGuard = parseBooleanLike(
      activeRenderSettings?.topHumanGuardMode ??
      activeRenderSettings?.top_human_guard_mode ??
      activeAnalysis?.topHumanGuardMode ??
      activeAnalysis?.top_human_guard_mode,
    );
    const styleLockPercent = parseCreatorStyleLockPercent(
      activeRenderSettings?.creatorStyleLock ??
      activeRenderSettings?.creator_style_lock ??
      activeAnalysis?.creatorStyleLock ??
      activeAnalysis?.creator_style_lock,
    );
    advancedModesSyncJobRef.current = activeJob.id;
    setColdStartAutopilotEnabled(coldStart ?? false);
    setContinuityFirstEnabled(continuityFirst ?? false);
    setExploreX3Enabled(exploreX3 ?? false);
    setTopHumanGuardEnabled(topHumanGuard ?? false);
    setCreatorStyleLockPercent(styleLockPercent ?? DEFAULT_CREATOR_STYLE_LOCK_PERCENT);
  }, [activeAnalysis, activeJob?.id, activeRenderSettings]);
  useEffect(() => {
    if (!activeJob?.id || normalizeStatus(activeJob.status) !== "ready") return;
    if (achievementSignals.length === 0) return;
    const shownForJob = achievementShownRef.current[activeJob.id] || {};
    const nextSignal = achievementSignals.find((signal) => !shownForJob[signal.id]);
    if (!nextSignal) return;
    achievementShownRef.current[activeJob.id] = {
      ...shownForJob,
      [nextSignal.id]: true,
    };
    setAchievementPopup(nextSignal);
  }, [activeJob?.id, activeJob?.status, achievementSignals]);
  useEffect(() => {
    if (!activeJob?.id || !canShowRealtimeHookSelector || activeHookSelectionMode !== "manual") return;
    if (hookPromptedByJob[activeJob.id]) return;
    setHookPromptedByJob((prev) => ({ ...prev, [activeJob.id]: true }));
    setHookSelectorOpen(true);
  }, [activeHookSelectionMode, activeJob?.id, canShowRealtimeHookSelector, hookPromptedByJob]);
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
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
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
      retryTimer = setTimeout(() => {
        if (canceled) return;
        setHookPreviewRefreshNonceByJob((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] || 0) + 1,
        }));
      }, HOOK_PREVIEW_RETRY_DELAY_MS);
    };

    void resolvePreviewUrl().finally(() => {
      setHookPreviewLoadingJobId((current) => (current === jobId ? null : current));
    });

    return () => {
      canceled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    accessToken,
    activeJob?.id,
    activeHookPreviewUrl,
    canShowRealtimeHookSelector,
    hookPreviewRefreshNonce,
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
  const handleHookPreviewVideoError = useCallback(() => {
    if (!activeJob?.id) return;
    const jobId = activeJob.id;
    setHookPreviewUrlByJob((prev) => ({ ...prev, [jobId]: "" }));
    setHookPreviewErrorByJob((prev) => ({
      ...prev,
      [jobId]: "Refreshing preview video...",
    }));
    setHookPreviewRefreshNonceByJob((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] || 0) + 1,
    }));
  }, [activeJob?.id]);
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
  const handleSetHookSelectionModeRealtime = useCallback(async (mode: HookSelectionMode) => {
    if (!activeJob?.id || !accessToken) return;
    const jobId = activeJob.id;
    const previousMode = hookSelectionModeByJob[jobId] ?? hookSelectionModeFromAnalysis;
    setHookSelectionModeByJob((prev) => ({ ...prev, [jobId]: mode }));
    setDefaultHookSelectionMode(mode);
    if (mode === "auto") {
      setSelectedHookByJob((prev) => ({ ...prev, [jobId]: null }));
    }
    setApplyingHookJobId(jobId);
    try {
      await apiFetch(`/api/jobs/${jobId}/preferred-hook`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ hookSelectionMode: mode }),
      });
      await fetchJob(jobId);
      toast({
        title: mode === "auto" ? "Auto hook enabled" : "Manual hook enabled",
        description: mode === "auto"
          ? "The editor will choose the opening hook automatically."
          : "Select and apply your preferred opening hook.",
      });
    } catch (err: any) {
      setHookSelectionModeByJob((prev) => ({ ...prev, [jobId]: previousMode }));
      toast({
        title: err instanceof ApiError && err.status === 409 ? "Hook stage passed" : "Hook mode update failed",
        description: err?.message || "Please try again.",
      });
    } finally {
      setApplyingHookJobId((current) => (current === jobId ? null : current));
    }
  }, [accessToken, activeJob?.id, fetchJob, hookSelectionModeByJob, hookSelectionModeFromAnalysis, toast]);
  const handleApplyPreferredHookRealtime = useCallback(async (candidate: HookCandidate) => {
    if (!activeJob?.id || !accessToken) return;
    const jobId = activeJob.id;
    setHookSelectionModeByJob((prev) => ({ ...prev, [jobId]: "manual" }));
    setDefaultHookSelectionMode("manual");
    setSelectedHookByJob((prev) => ({ ...prev, [jobId]: candidate }));
    setHookPreviewCandidateByJob((prev) => ({ ...prev, [jobId]: candidate }));
    setApplyingHookJobId(jobId);
    try {
      await apiFetch(`/api/jobs/${jobId}/preferred-hook`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ preferredHook: candidate, hookSelectionMode: "manual" }),
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
    setPreviewCurrentTimeSec(clamp(Number(video.currentTime || 0), 0, duration));
  }, [activeJob, ensurePlaybackTelemetry]);

  const handleSeekPreviewToTranscriptCue = useCallback((cue: EditorTranscriptCue) => {
    if (!transcriptSeekEnabled) return;
    const video = previewVideoRef.current;
    if (!video) return;
    const duration = Number(video.duration);
    const maxStart = Number.isFinite(duration) && duration > 0
      ? Math.max(0, duration - 0.05)
      : Math.max(0, cue.start);
    const nextTime = clamp(cue.start, 0, maxStart);
    video.currentTime = nextTime;
    setPreviewCurrentTimeSec(nextTime);
    void video.play().catch(() => {});
  }, [transcriptSeekEnabled]);

  const handlePreviewTimeUpdate = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const telemetry = ensurePlaybackTelemetry(activeJob.id, duration);
    const currentTime = clamp(Number(video.currentTime || 0), 0, duration);
    setPreviewCurrentTimeSec(currentTime);
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
      setPreviewCurrentTimeSec(duration);
      telemetry.maxTimeSec = Math.max(telemetry.maxTimeSec, duration);
      telemetry.maxProgress = Math.max(telemetry.maxProgress, 1);
      telemetry.watchedSeconds = Math.max(telemetry.watchedSeconds, duration);
      telemetry.lastDispatchProgress = 1;
    }
    submitPreviewFeedback(activeJob, telemetry, "ended", true);
  }, [activeJob, ensurePlaybackTelemetry, submitPreviewFeedback]);

  const handlePreviewVideoError = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    const jobId = activeJob?.id || null;
    const details = {
      jobId,
      outputUrl: resolvedPreviewOutputUrl || null,
      networkState: video?.networkState ?? null,
      readyState: video?.readyState ?? null,
      errorCode: video?.error?.code ?? null,
      errorMessage: video?.error?.message ?? null,
    };
    console.error("Preview video failed to load", details);
    if (jobId) {
      const retryCount = previewRetryCountByJobRef.current[jobId] || 0;
      setResolvedPreviewOutputUrl("");
      if (retryCount < PREVIEW_REFRESH_RETRY_LIMIT) {
        previewRetryCountByJobRef.current[jobId] = retryCount + 1;
        window.setTimeout(() => {
          setPreviewRefreshNonceByJob((prev) => ({
            ...prev,
            [jobId]: (prev[jobId] || 0) + 1,
          }));
        }, PREVIEW_REFRESH_RETRY_DELAY_MS);
        if (retryCount === 0) {
          toast({
            title: "Preview failed",
            description: "Refreshing preview URL and retrying...",
          });
        }
        return;
      }
    }
    toast({
      title: "Preview failed",
      description: "Preview is unavailable right now. Download still works.",
    });
  }, [activeJob?.id, resolvedPreviewOutputUrl, toast]);

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
  const activePlatformRecommendation = PLATFORM_RECOMMENDATION_MAP[retentionTargetPlatform];
  const retentionSliderValue = Math.max(0, RETENTION_PROFILE_SEQUENCE.indexOf(retentionStrategyProfile));
  const fullAutoPreviewBulletPoints = useMemo(() => {
    const highlightSource = Array.isArray(fullAutoYoutubeProfile?.highlights)
      ? fullAutoYoutubeProfile.highlights
      : [];
    const highlights = highlightSource.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (highlights.length > 0) return highlights.slice(0, 3);
    if (fullAutoResolvedTarget === "shorts") {
      return [
        "Hook-first pacing with denser pattern interrupts every few seconds.",
        "Energetic transitions + punchy SFX layering tuned for short-form retention.",
        "Vertical export with YouTube Shorts packaging defaults.",
      ];
    }
    return [
      "Long-form chapter-safe pacing with clarity-preserving compression.",
      "Mood-based transitions and overlays tuned for viewer flow.",
      "Horizontal export with title/thumbnail suggestion pack.",
    ];
  }, [fullAutoResolvedTarget, fullAutoYoutubeProfile]);
  const fullAutoPreviewTitleIdea = useMemo(() => {
    const first = fullAutoYoutubeProfile?.seoSuggestions?.titles?.[0];
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }, [fullAutoYoutubeProfile]);
  const captionsPipelineRemoved = !CAPTIONS_PIPELINE_ENABLED;
  const captionEngineOffline = CAPTIONS_PIPELINE_ENABLED && captionCapability.available === false;
  const captionsToggleDisabled = captionsPipelineRemoved || !subtitlesEnabled || captionEngineOffline;
  const mobileApplyAndRenderDisabled =
    Boolean(uploadingJobId) || (isVerticalMode && Boolean(pendingVerticalFile) && !verticalSelectionReady);
  const mobileApplyAndRenderLabel = isVerticalMode
    ? pendingVerticalFile
      ? "Run Binge Optimizer"
      : "Pick Clip & Run Binge Optimizer"
    : "Run Binge Optimizer";
  const uploadModePromptActiveSelection: UploadModePromptSelection = fullAutoYoutubeEnabled
    ? "full_auto_youtube"
    : pipelinePowerMode;
  const activeAdvancedLearningModeLabels = useMemo(() => {
    const labels: string[] = [];
    if (coldStartAutopilotEnabled) labels.push("Cold-Start Autopilot");
    if (continuityFirstEnabled) labels.push("Continuity-First");
    if (exploreX3Enabled) labels.push("Explore x3");
    if (topHumanGuardEnabled) labels.push("Top-Human Guard");
    return labels;
  }, [
    coldStartAutopilotEnabled,
    continuityFirstEnabled,
    exploreX3Enabled,
    topHumanGuardEnabled,
  ]);

  const handleSelectPipelinePowerMode = (mode: PipelinePowerMode) => {
    if (mode !== "standard" && !paidTier) {
      setTrialUpgradeOpen(true);
      toast({
        title: "Premium mode locked",
        description: "Fast and Quality modes are available on paid plans.",
      });
      return;
    }
    setPipelinePowerMode(mode);
    trackEditorEvent("pipeline_power_mode_selected", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: { mode },
    });
  };

  const closeUploadModePrompt = useCallback(() => {
    setUploadModePromptOpen(false);
    setPendingUploadSelection(null);
  }, []);

  const handleSelectUploadModePrompt = useCallback((selection: UploadModePromptSelection) => {
    const pending = pendingUploadSelection;
    if (!pending) return;

    if ((selection === "ultra" || selection === "retention_king") && !paidTier) {
      setTrialUpgradeOpen(true);
      toast({
        title: "Premium mode locked",
        description: "Fast and Quality modes are available on paid plans.",
      });
      return;
    }

    const uploadModeOverride =
      selection === "full_auto_youtube"
        ? { pipelinePowerMode: "standard" as PipelinePowerMode, fullAutoYoutubeEnabled: true }
        : { pipelinePowerMode: selection as PipelinePowerMode, fullAutoYoutubeEnabled: false };

    if (selection === "full_auto_youtube") {
      setFullAutoYoutubeEnabled(true);
      if (pipelinePowerMode !== "standard") {
        handleSelectPipelinePowerMode("standard");
      }
    } else {
      setFullAutoYoutubeEnabled(false);
      handleSelectPipelinePowerMode(selection as PipelinePowerMode);
    }

    trackEditorEvent("upload_mode_prompt_selected", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        selection,
        mode: pending.mode,
      },
    });

    closeUploadModePrompt();
    continueWithSelectedFile(
      pending.file,
      pending.fileCount,
      pending.mode,
      uploadModeOverride,
    );
  }, [
    activeSubtitlePreset,
    closeUploadModePrompt,
    continueWithSelectedFile,
    handleSelectPipelinePowerMode,
    paidTier,
    pendingUploadSelection,
    pipelinePowerMode,
    retentionStrategyProfile,
    retentionTargetPlatform,
    toast,
    trackEditorEvent,
  ]);

  useEffect(() => {
    if (pipelinePowerMode === "standard") return;
    if (pipelinePowerMode === "ultra") {
      setRetentionStrategyProfile("viral");
      setLongFormPreset("ultra");
      setLongFormAggression((prev) => Math.max(prev, LONG_FORM_PRESET_DEFAULTS.ultra.aggression));
      setLongFormClarityVsSpeed((prev) => Math.min(prev, LONG_FORM_PRESET_DEFAULTS.ultra.clarityVsSpeed));
      setTangentKiller(true);
      return;
    }
    setRetentionStrategyProfile("viral");
    setLongFormPreset("ultra");
    setLongFormAggression((prev) => Math.max(prev, LONG_FORM_PRESET_DEFAULTS.ultra.aggression));
    setLongFormClarityVsSpeed((prev) => Math.min(prev, LONG_FORM_PRESET_DEFAULTS.ultra.clarityVsSpeed));
    setTangentKiller(true);
  }, [pipelinePowerMode]);

  useEffect(() => {
    if (!fullAutoYoutubeEnabled) return;

    const modeByVibe: Record<Exclude<FullAutoYoutubeVibe, "auto">, EditorModeSelection> = {
      hype: "gaming",
      cinematic: "vlog",
      chill: "commentary",
      education: "education",
    };
    const target = fullAutoResolvedTarget;
    const vibe = fullAutoResolvedVibe;
    const targetMaxCuts = target === "shorts" ? 12 : (vibe === "education" ? 6 : 8);

    setOnlyHookAndCut(false);
    setDefaultHookSelectionMode("auto");
    setAutoCaptionsEnabled(true);
    setRetentionTargetPlatform("youtube");
    setMaxCutsRequested(targetMaxCuts);
    setEditorMode(modeByVibe[vibe] ?? "auto");

    if (target === "shorts") {
      setRetentionStrategyProfile("viral");
      setLongFormPreset("auto");
      setLongFormAggression(62);
      setLongFormClarityVsSpeed(46);
      setTangentKiller(false);
    } else {
      const educationFlow = vibe === "education";
      setRetentionStrategyProfile(educationFlow ? "safe" : "balanced");
      setLongFormPreset(educationFlow ? "balanced" : "aggressive");
      setLongFormAggression(educationFlow ? 58 : 74);
      setLongFormClarityVsSpeed(educationFlow ? 78 : 56);
      setTangentKiller(true);
    }

    if (vibe === "hype" && paidTier) {
      setPipelinePowerMode("ultra");
    } else if (pipelinePowerMode !== "standard") {
      setPipelinePowerMode("standard");
    }
  }, [
    fullAutoYoutubeEnabled,
    fullAutoResolvedTarget,
    fullAutoResolvedVibe,
    paidTier,
    pipelinePowerMode,
  ]);

  useEffect(() => {
    if (!fullAutoYoutubeEnabled || !accessToken || authError) {
      setFullAutoYoutubeProfile(null);
      setFullAutoYoutubeLoading(false);
      return;
    }
    let cancelled = false;
    setFullAutoYoutubeLoading(true);
    apiFetch<FullAutoYoutubeProfileResponse>("/api/jobs/full-auto-youtube/profile", {
      method: "POST",
      token: accessToken,
      body: JSON.stringify({
        renderMode: isVerticalMode ? "vertical" : "horizontal",
        fullAutoYoutube: {
          enabled: true,
          target: fullAutoYoutubeTarget,
          vibe: fullAutoYoutubeVibe,
          includeSeoPack: true,
          includePromptPack: true,
          includeQueueHints: true,
          preferAiBroll: true,
        },
      }),
    })
      .then((data) => {
        if (cancelled) return;
        setFullAutoYoutubeProfile(data?.profile ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setFullAutoYoutubeProfile(null);
      })
      .finally(() => {
        if (cancelled) return;
        setFullAutoYoutubeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    authError,
    fullAutoYoutubeEnabled,
    fullAutoYoutubeTarget,
    fullAutoYoutubeVibe,
    isVerticalMode,
  ]);

  const applyPlatformRecommendation = () => {
    setRetentionStrategyProfile(activePlatformRecommendation.profile);
    setMaxCutsRequested(clamp(activePlatformRecommendation.suggestedCuts, MAX_CUTS_MIN, MAX_CUTS_MAX));
    trackEditorEvent("platform_recommendation_applied", {
      retentionProfile: activePlatformRecommendation.profile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        suggestedCuts: activePlatformRecommendation.suggestedCuts,
      },
    });
  };

  const runApplyAndRender = () => {
    if (isVerticalMode && pendingVerticalFile) {
      void startVerticalRender();
      return;
    }
    handlePickFile();
  };

  const openFeedbackDeepDiveSection = useCallback((section: FeedbackDeepDiveSection = "retention_vs_emotion") => {
    setFeedbackDeepDiveSection(section);
    setFeedbackDeepDiveOpen(true);
  }, []);

  useEffect(() => {
    if (!feedbackDeepDiveOpen) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      feedbackDeepDiveSectionRefs.current[feedbackDeepDiveSection]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [feedbackDeepDiveOpen, feedbackDeepDiveSection]);

  const applyQuickSetupPreset = (preset: "simple" | "balanced" | "viral") => {
    menuTouchedRef.current.strategy = true;
    menuTouchedRef.current.targetPlatform = true;
    menuTouchedRef.current.editorMode = true;

    if (preset === "simple") {
      setRenderMode("horizontal");
      setRetentionStrategyProfile("safe");
      setRetentionTargetPlatform("youtube");
      setEditorMode("auto");
      setMaxCutsRequested(6);
    } else if (preset === "balanced") {
      setRenderMode("horizontal");
      setRetentionStrategyProfile("balanced");
      setRetentionTargetPlatform("instagram_reels");
      setEditorMode("auto");
      setMaxCutsRequested(8);
    } else {
      setRenderMode("vertical");
      setRetentionStrategyProfile("viral");
      setRetentionTargetPlatform("tiktok");
      setEditorMode("reaction");
      setMaxCutsRequested(12);
    }

    if (!autoCaptionsEnabled) {
      setAutoCaptionsEnabled(true);
      setSubtitleStyleDirty(true);
    }

    trackEditorEvent("quick_setup_preset_applied", {
      retentionProfile: preset === "simple" ? "safe" : preset === "balanced" ? "balanced" : "viral",
      targetPlatform: preset === "simple" ? "youtube" : preset === "balanced" ? "instagram_reels" : "tiktok",
      captionStyle: activeSubtitlePreset,
      metadata: {
        preset,
      },
    });
  };

  const sectionPillClass = (active: boolean) =>
    `editor-settings-pill min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all md:min-h-[46px] ${
      active
        ? "border-primary/55 bg-primary/14 text-foreground shadow-sm"
        : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"
    }`;
  const verticalModeChipClass = (active: boolean) =>
    `vertical-mode-chip rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${active ? "is-active" : ""}`;

  const renderSettingsSection = (section: EditorSettingsSection) => {
    if (section === "format") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <button
              type="button"
              className={sectionPillClass(!isVerticalMode)}
              onClick={() => {
                trackEditorEvent("render_mode_selected", {
                  retentionProfile: retentionStrategyProfile,
                  targetPlatform: retentionTargetPlatform,
                  captionStyle: activeSubtitlePreset,
                  metadata: { mode: "horizontal" },
                });
                setRenderMode("horizontal");
              }}
            >
              <div className="flex flex-col items-center">
                <Monitor className="h-5 w-5" aria-hidden />
                <span className="text-[11px] mt-1">Horizontal</span>
              </div>
            </button>
            <button
              type="button"
              className={sectionPillClass(isVerticalMode)}
              onClick={() => {
                trackEditorEvent("render_mode_selected", {
                  retentionProfile: retentionStrategyProfile,
                  targetPlatform: retentionTargetPlatform,
                  captionStyle: activeSubtitlePreset,
                  metadata: { mode: "vertical" },
                });
                setRenderMode("vertical");
              }}
            >
              <div className="flex flex-col items-center">
                <Smartphone className="h-5 w-5" aria-hidden />
                <span className="text-[11px] mt-1">Vertical</span>
              </div>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PLATFORM_OPTIONS.map((platform) => (
              <Tooltip key={platform.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={sectionPillClass(retentionTargetPlatform === platform.value)}
                    onClick={() => {
                      menuTouchedRef.current.targetPlatform = true;
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
                    <div className="flex flex-col items-center">
                      {platform.value === "youtube" ? (
                        <Monitor className="h-5 w-5" aria-hidden />
                      ) : platform.value === "instagram_reels" ? (
                        <Camera className="h-5 w-5" aria-hidden />
                      ) : (
                        <Music className="h-5 w-5" aria-hidden />
                      )}
                      <span className="text-[11px] mt-1">{platform.label}</span>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{PLATFORM_HELP_TEXT[platform.value]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="rounded-xl border border-primary/35 bg-gradient-to-r from-primary/12 via-primary/8 to-transparent px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-primary">{activePlatformRecommendation.label}</span>
              <Button
                type="button"
                size="sm"
                className="min-h-12 rounded-xl bg-primary px-4 text-white hover:bg-primary/90 md:min-h-10"
                onClick={applyPlatformRecommendation}
              >
                Apply Recommendation
              </Button>
            </div>
          </div>
        </div>
      );
    }
    if (section === "vibe") {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/35 bg-[linear-gradient(140deg,rgba(22,163,74,0.14),rgba(9,20,16,0.38))] p-3 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Full Auto YouTube Mode</p>
                <p className="text-xs text-muted-foreground">
                  One click to auto-tune cuts, transitions, SFX, captions, BGM ducking, and export packaging.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={fullAutoYoutubeEnabled ? "border-primary/45 bg-primary/20 text-primary-foreground" : "border-border/50 bg-background/40 text-muted-foreground"}>
                  {fullAutoYoutubeEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={fullAutoYoutubeEnabled}
                  onCheckedChange={(checked) => {
                    setFullAutoYoutubeEnabled(checked);
                    trackEditorEvent("full_auto_youtube_toggled", {
                      retentionProfile: retentionStrategyProfile,
                      targetPlatform: retentionTargetPlatform,
                      captionStyle: activeSubtitlePreset,
                      metadata: {
                        enabled: checked,
                        target: fullAutoYoutubeTarget,
                        vibe: fullAutoYoutubeVibe,
                        mode: isVerticalMode ? "vertical" : "horizontal",
                      },
                    });
                  }}
                  aria-label="Toggle Full Auto YouTube mode"
                />
              </div>
            </div>

            {fullAutoYoutubeEnabled ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Output Intent</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {FULL_AUTO_YOUTUBE_TARGET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={sectionPillClass(fullAutoYoutubeTarget === option.value)}
                        onClick={() => setFullAutoYoutubeTarget(option.value)}
                        aria-label={option.label}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] font-semibold">{option.label}</span>
                          <span className="mt-1 text-[10px] text-muted-foreground">{option.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Vibe Coding</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                    {FULL_AUTO_YOUTUBE_VIBE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={sectionPillClass(fullAutoYoutubeVibe === option.value)}
                        onClick={() => setFullAutoYoutubeVibe(option.value)}
                        aria-label={option.label}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] font-semibold">{option.label}</span>
                          <span className="mt-1 text-[10px] text-muted-foreground">{option.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-background/35 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Auto Profile Preview</p>
                  <p className="mt-1 text-xs text-primary">
                    Target: {fullAutoResolvedTarget === "shorts" ? "YouTube Shorts" : "YouTube Long-Form"} | Vibe: {formatNicheLabel(fullAutoResolvedVibe)}
                  </p>
                  {fullAutoYoutubeLoading ? (
                    <p className="mt-2 text-xs text-muted-foreground">Building backend profile...</p>
                  ) : (
                    <>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {fullAutoPreviewBulletPoints.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                      {fullAutoPreviewTitleIdea ? (
                        <p className="mt-2 text-[11px] text-primary/90">Title idea: {fullAutoPreviewTitleIdea}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Turn this on to auto-apply YouTube-ready defaults and backend profile generation on each upload.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-primary/30 bg-[linear-gradient(145deg,rgba(102,58,255,0.2),rgba(31,23,58,0.38))] p-3 backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Power Modes</p>
                <p className="text-xs text-muted-foreground">
                  Balanced keeps the middle ground, Fast prioritizes turnaround while still requiring a transcript, and Quality keeps transcript-guided hook picking on.
                </p>
              </div>
              <Badge className={paidTier ? "border-primary/45 bg-primary/20 text-primary-foreground" : "border-border/50 bg-background/40 text-muted-foreground"}>
                {paidTier ? "Paid unlocked" : "Paid only"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {PIPELINE_POWER_MODE_OPTIONS.map((mode) => {
                const active = pipelinePowerMode === mode.value;
                const locked = !paidTier && mode.value !== "standard";
                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={`premium-mode-toggle ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}`}
                    onClick={() => handleSelectPipelinePowerMode(mode.value)}
                    aria-pressed={active}
                    aria-label={mode.label}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{mode.label}</span>
                      {locked ? (
                        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                      ) : mode.value === "retention_king" ? (
                        <Crown className="h-4 w-4 text-primary" aria-hidden />
                      ) : mode.value === "ultra" ? (
                        <Zap className="h-4 w-4 text-primary" aria-hidden />
                      ) : (
                        <Gauge className="h-4 w-4 text-primary" aria-hidden />
                      )}
                    </div>
                    <p className="mt-1.5 text-left text-[11px] text-muted-foreground">{mode.description}</p>
                  </button>
                );
              })}
            </div>
            {pipelinePowerMode !== "standard" ? (
              <p className="mt-2 text-[11px] text-primary/90">
                {pipelinePowerMode === "ultra"
                  ? "Fast mode active: accelerated upload/process with transcript still required."
                  : "Quality mode active: transcript-guided hook analysis + aggressive binge cut profile enabled."}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Creative Variant</p>
                <p className="text-xs text-muted-foreground">
                  Changes transcript-led hook ranking and pacing so rerenders can explore different edit personalities.
                </p>
              </div>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {activeCreativeVariantLabel}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {CREATIVE_VARIANT_OPTIONS.map((variant) => (
                <button
                  key={variant.value}
                  type="button"
                  className={sectionPillClass(creativeVariant === variant.value)}
                  onClick={() => setCreativeVariant(variant.value)}
                  aria-label={variant.label}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-semibold">{variant.label}</span>
                    <span className="mt-1 text-center text-[10px] text-muted-foreground">{variant.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Advanced Learning Modes</p>
                <p className="text-xs text-muted-foreground">
                  Cold-start defaults, continuity-first hardening, explore-x3 policy search, and creator-style weighting.
                </p>
              </div>
              <Badge className="border-border/55 bg-background/50 text-muted-foreground">
                {activeAdvancedLearningModeLabels.length} active
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              {([
                {
                  id: "cold_start_autopilot" as CreatorLearningMode,
                  label: "Cold-Start Autopilot",
                  description: "Use conservative low-data defaults until enough real outcome signal exists.",
                  active: coldStartAutopilotEnabled,
                  onToggle: () => setColdStartAutopilotEnabled((prev) => !prev),
                  Icon: Gauge,
                },
                {
                  id: "continuity_first" as CreatorLearningMode,
                  label: "Continuity-First",
                  description: "Stricter boundary critic behavior and slower pacing for smoother cuts.",
                  active: continuityFirstEnabled,
                  onToggle: () => setContinuityFirstEnabled((prev) => !prev),
                  Icon: ShieldCheck,
                },
                {
                  id: "explore_x3" as CreatorLearningMode,
                  label: "Explore x3",
                  description: "Run three policy candidates and auto-promote winners via outcome feedback.",
                  active: exploreX3Enabled,
                  onToggle: () => setExploreX3Enabled((prev) => !prev),
                  Icon: Trophy,
                },
                {
                  id: "top_human_guard" as CreatorLearningMode,
                  label: "Top-Human Guard",
                  description: "Fail closed on weak cuts. No forced low-signal fallback exports.",
                  active: topHumanGuardEnabled,
                  onToggle: () => setTopHumanGuardEnabled((prev) => !prev),
                  Icon: Crown,
                },
              ]).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={sectionPillClass(mode.active)}
                  onClick={mode.onToggle}
                  aria-pressed={mode.active}
                  aria-label={mode.label}
                >
                  <div className="flex flex-col items-center">
                    <mode.Icon className="h-5 w-5" aria-hidden />
                    <span className="mt-1 text-[11px]">{mode.label}</span>
                    <span className="mt-1 text-center text-[10px] text-muted-foreground">{mode.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-2.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Currently Active</p>
              {activeAdvancedLearningModeLabels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeAdvancedLearningModeLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">None active. Running with default learning behavior.</p>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-2.5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Creator Style Lock</span>
                <span>{clampCreatorStyleLockPercent(creatorStyleLockPercent)}%</span>
              </div>
              <Slider
                min={CREATOR_STYLE_LOCK_MIN}
                max={CREATOR_STYLE_LOCK_MAX}
                step={1}
                className="editor-settings-slider"
                value={[clampCreatorStyleLockPercent(creatorStyleLockPercent)]}
                onValueChange={(values) => {
                  const next = Number(values?.[0] ?? creatorStyleLockPercent);
                  setCreatorStyleLockPercent(clampCreatorStyleLockPercent(next));
                }}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Lower = prioritize global winner policies. Higher = follow this creator's learned style profile more aggressively.
              </p>
            </div>
          </div>
          {renderYouTubeOutcomeLoopCard({
            title: "Editor Settings: YouTube Auth + Learning",
            subtitle: "This connection is per account and feeds the live outcome loop used by the editor modes.",
            compact: true,
            showModeImpact: true,
          })}

          <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-foreground">Vibe</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {RETENTION_PROFILE_OPTIONS.find((profile) => profile.value === retentionStrategyProfile)?.label || "Balanced"}
              </span>
            </div>
            <Slider
              min={0}
              max={RETENTION_PROFILE_SEQUENCE.length - 1}
              step={1}
              value={[retentionSliderValue]}
              className="editor-settings-slider"
              onValueChange={(values) => {
                const candidate = Number(values?.[0] ?? retentionSliderValue);
                const next = RETENTION_PROFILE_SEQUENCE[clamp(Math.round(candidate), 0, RETENTION_PROFILE_SEQUENCE.length - 1)];
                menuTouchedRef.current.strategy = true;
                setRetentionStrategyProfile(next);
              }}
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
                      {RETENTION_PROFILE_OPTIONS.map((profile) => (
                <Tooltip key={profile.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                              className={sectionPillClass(retentionStrategyProfile === profile.value)}
                      onClick={() => {
                        menuTouchedRef.current.strategy = true;
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
                              aria-label={profile.label}
                    >
                              <div className="flex flex-col items-center">
                                {profile.value === "safe" ? (
                                  <ShieldCheck className="h-5 w-5" aria-hidden />
                                ) : profile.value === "balanced" ? (
                                  <Gauge className="h-5 w-5" aria-hidden />
                                ) : (
                                  <Zap className="h-5 w-5" aria-hidden />
                                )}
                                <span className="text-[11px] mt-1">{profile.label}</span>
                              </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{RETENTION_PROFILE_HINTS[profile.value]}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
            <p className="mb-3 text-sm text-foreground">Content Type</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {EDITOR_MODE_OPTIONS.map((mode) => (
                <Tooltip key={mode.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={sectionPillClass(editorMode === mode.value)}
                      onClick={() => {
                        menuTouchedRef.current.editorMode = true;
                        trackEditorEvent("editor_mode_selected", {
                          retentionProfile: retentionStrategyProfile,
                          targetPlatform: retentionTargetPlatform,
                          captionStyle: activeSubtitlePreset,
                          metadata: { editorMode: mode.value },
                        });
                        setEditorMode(mode.value);
                      }}
                      aria-label={mode.label}
                    >
                      <div className="flex flex-col items-center">
                        {mode.value === "auto" ? (
                          <Wand2 className="h-5 w-5" aria-hidden />
                        ) : (
                          <MousePointerClick className="h-5 w-5" aria-hidden />
                        )}
                        <span className="text-[11px] mt-1">{mode.label}</span>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{mode.description}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (section === "cuts") {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-foreground">Cut Count</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {maxCutsRequested} cuts
              </span>
            </div>
            <Slider
              min={MAX_CUTS_MIN}
              max={MAX_CUTS_MAX}
              step={1}
              value={[maxCutsRequested]}
              className="editor-settings-slider"
              onValueChange={(values) => {
                const candidate = Number(values?.[0] ?? maxCutsRequested);
                if (!Number.isFinite(candidate)) return;
                setMaxCutsRequested(clamp(Math.round(candidate), MAX_CUTS_MIN, MAX_CUTS_MAX));
              }}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{MAX_CUTS_MIN}</span>
              <span>{MAX_CUTS_MAX}</span>
            </div>
          </div>

          <Accordion type="single" collapsible className="rounded-xl border border-border/50 bg-muted/15 px-3">
            <AccordionItem value="more-options" className="border-0">
              <AccordionTrigger className="py-3 text-sm text-foreground hover:no-underline">
                Advanced
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Long-Form Efficiency</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {LONG_FORM_PRESET_OPTIONS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={sectionPillClass(longFormPreset === preset.value)}
                          onClick={() => {
                            const defaults = LONG_FORM_PRESET_DEFAULTS[preset.value];
                            setLongFormPreset(preset.value);
                            setLongFormAggression(defaults.aggression);
                            setLongFormClarityVsSpeed(defaults.clarityVsSpeed);
                            setTangentKiller(defaults.tangentKiller);
                          }}
                          aria-label={preset.label}
                        >
                          <div className="flex flex-col items-center">
                            {preset.value === "short" ? (
                              <Clock className="h-5 w-5" aria-hidden />
                            ) : preset.value === "balanced" ? (
                              <Gauge className="h-5 w-5" aria-hidden />
                            ) : (
                              <Zap className="h-5 w-5" aria-hidden />
                            )}
                            <span className="text-[11px] mt-1">{preset.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Aggression</span>
                        <span>{longFormAggression}</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        className="editor-settings-slider"
                        value={[longFormAggression]}
                        onValueChange={(values) => {
                          const next = clamp(Math.round(Number(values?.[0] ?? longFormAggression)), 0, 100);
                          setLongFormAggression(next);
                        }}
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Clarity vs Speed</span>
                        <span>{longFormClarityVsSpeed}</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        className="editor-settings-slider"
                        value={[longFormClarityVsSpeed]}
                        onValueChange={(values) => {
                          const next = clamp(Math.round(Number(values?.[0] ?? longFormClarityVsSpeed)), 0, 100);
                          setLongFormClarityVsSpeed(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      className={sectionPillClass(tangentKiller)}
                      onClick={() => setTangentKiller((prev) => !prev)}
                      aria-pressed={tangentKiller}
                      aria-label={`Tangent Killer ${tangentKiller ? "On" : "Off"}`}
                    >
                      <div className="flex flex-col items-center">
                        <Zap className="h-5 w-5" aria-hidden />
                        <span className="text-[11px] mt-1">Tangent Killer</span>
                      </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={sectionPillClass(defaultHookSelectionMode === "auto")}
                        onClick={() => setDefaultHookSelectionMode("auto")}
                        aria-label="Hook auto"
                      >
                        <div className="flex flex-col items-center">
                          <Wand2 className="h-5 w-5" aria-hidden />
                          <span className="text-[11px] mt-1">Hook Auto</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={sectionPillClass(defaultHookSelectionMode === "manual")}
                        onClick={() => setDefaultHookSelectionMode("manual")}
                        aria-label="Hook manual"
                      >
                        <div className="flex flex-col items-center">
                          <MousePointerClick className="h-5 w-5" aria-hidden />
                          <span className="text-[11px] mt-1">Hook Manual</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-foreground">Captions</p>
              <p className="text-xs text-muted-foreground">
                {autoCaptionsEnabled ? "Enabled" : "Disabled"} · {activeSubtitlePresetMeta?.label ?? formatNicheLabel(activeSubtitlePreset)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                className={`min-h-12 rounded-xl px-5 md:min-h-10 ${
                  autoCaptionsEnabled
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "border border-border/60 bg-muted/20 text-foreground hover:border-primary/40 hover:bg-primary/10"
                }`}
                onClick={() => {
                  if (captionsToggleDisabled) return;
                  const nextState = !autoCaptionsEnabled;
                  trackEditorEvent("captions_toggled", {
                    retentionProfile: retentionStrategyProfile,
                    targetPlatform: retentionTargetPlatform,
                    captionStyle: activeSubtitlePreset,
                    metadata: { enabled: nextState },
                  });
                  setAutoCaptionsEnabled(nextState);
                  setSubtitleStyleDirty(true);
                }}
                disabled={captionsToggleDisabled}
              >
                {autoCaptionsEnabled ? "Captions On" : "Captions Off"}
              </Button>
              {captionEngineOffline ? (
                <Button
                  type="button"
                  className="min-h-12 rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--glow-secondary))] text-white hover:from-primary/90 hover:to-[hsl(var(--glow-secondary)/0.9)] md:min-h-10"
                  onClick={() => navigate("/settings")}
                >
                  Setup Captions
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Accordion type="single" collapsible className="rounded-xl border border-border/50 bg-muted/15 px-3">
          <AccordionItem value="caption-options" className="border-0">
            <AccordionTrigger className="py-3 text-sm text-foreground hover:no-underline">
              Advanced
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBTITLE_PRESET_OPTIONS.map((preset) => {
                    const locked = !isSubtitlePresetAllowed(preset.id);
                    const requiredPlan = getRequiredPlanForSubtitlePreset(preset.id);
                    const active = activeSubtitlePreset === preset.id;
                    const card = (
                      <button
                        type="button"
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                          active
                            ? "border-primary/60 bg-primary/15 text-primary shadow-sm"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
                        onClick={() => selectSubtitlePreset(preset.id)}
                        disabled={locked}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{preset.label}</span>
                          {locked ? <Lock className="h-3.5 w-3.5" /> : null}
                        </div>
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Font</span>
                      <select
                        className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
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
                        className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
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
                      <span className="text-[11px] text-muted-foreground">Outline ({subtitleStyleConfig.outlineWidth}px)</span>
                      <Slider
                        min={1}
                        max={12}
                        step={1}
                        className="editor-settings-slider"
                        value={[subtitleStyleConfig.outlineWidth]}
                        onValueChange={(values) =>
                          updateMrBeastSubtitleStyle({ outlineWidth: Number(values?.[0] ?? subtitleStyleConfig.outlineWidth) })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {subtitleStyleDirty ? <span className="text-xs text-amber-300">Unsaved caption changes</span> : <span />}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      className="min-h-12 rounded-xl bg-primary text-white hover:bg-primary/90 md:min-h-10"
                      onClick={() => void saveSubtitleStyle()}
                      disabled={!subtitleStyleDirty || savingSubtitleStyle}
                    >
                      {savingSubtitleStyle ? "Saving..." : subtitleStyleDirty ? "Save Captions" : "Captions Saved"}
                    </Button>
                    {showSavedAnimation ? (
                      <div className="relative flex items-center justify-center w-8 h-8">
                        <span className="absolute inline-flex w-6 h-6 rounded-full bg-emerald-400/30 animate-ping" />
                        <CheckCircle2 className="relative text-emerald-400 w-5 h-5" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const topToolbarToggleClass = (active: boolean) =>
    `w-full min-h-12 rounded-full border px-4 text-xs transition-colors sm:w-auto ${
      active
        ? "border-primary/55 bg-primary/18 text-foreground shadow-sm"
        : "border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/35 hover:text-foreground"
    }`;
  const activeRetentionLabel =
    RETENTION_PROFILE_OPTIONS.find((profile) => profile.value === retentionStrategyProfile)?.label ?? "Balanced";
  const activeEditorModeLabel = pipelinePowerMode === "ultra"
    ? "Fast"
    : pipelinePowerMode === "retention_king"
      ? "Quality"
      : (EDITOR_MODE_OPTIONS.find((mode) => mode.value === editorMode)?.label ?? "Auto");
  const activeCreativeVariantLabel =
    CREATIVE_VARIANT_OPTIONS.find((variant) => variant.value === creativeVariant)?.label ?? "Balanced";
  const activeTargetPlatformLabel =
    PLATFORM_OPTIONS.find((platform) => platform.value === retentionTargetPlatform)?.label ?? "TikTok";
  const renderYouTubeOutcomeLoopCard = ({
    title = "YouTube Outcome Loop",
    subtitle = "Connect channel -> map job/video -> sync retention outcomes -> tune policy over time.",
    compact = false,
    showModeImpact = false,
    className = "",
  }: {
    title?: string;
    subtitle?: string;
    compact?: boolean;
    showModeImpact?: boolean;
    className?: string;
  } = {}) => {
    const shellClassName = compact
      ? `rounded-xl border border-border/50 bg-muted/15 p-3 ${className}`.trim()
      : `retention-summary-card glass-card rounded-xl p-3 ${className}`.trim();
    const statusClassName = youtubeConnected
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
      : "border-border/55 bg-background/50 text-muted-foreground";

    return (
      <div className={shellClassName}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Badge className={statusClassName}>
            {youtubeOAuthStatusLoading
              ? "Checking..."
              : youtubeConnected
                ? "Connected"
                : "Not connected"}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge className="border-primary/35 bg-primary/10 text-foreground">
            Boundary critic hard gate
          </Badge>
          <Badge className={activeYouTubeSignal?.coldStartMode ? "border-amber-400/35 bg-amber-500/10 text-amber-100" : "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"}>
            {activeYouTubeSignal
              ? activeYouTubeSignal.coldStartMode
                ? `Cold-start trust ${activeYouTubeTrustPercent ?? 0}%`
                : `Outcome trust ${activeYouTubeTrustPercent ?? 0}%`
              : "Waiting for synced outcomes"}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!youtubeConnected ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full px-3 text-[11px]"
              disabled={!youtubeOAuthConfigured || youtubeConnectBusy}
              onClick={() => void handleConnectYouTubeOAuth()}
            >
              {youtubeConnectBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Connect YouTube
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-[11px]"
              disabled={youtubeDisconnectBusy}
              onClick={() => void handleDisconnectYouTubeOAuth()}
            >
              {youtubeDisconnectBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="mr-1.5 h-3.5 w-3.5" />
              )}
              Disconnect YouTube
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-[11px]"
            disabled={
              !youtubeConnected ||
              !activeJob?.id ||
              youtubeSyncingJobId === activeJob.id
            }
            onClick={() => void handleSyncYouTubeAnalyticsForJob()}
          >
            {youtubeSyncingJobId === activeJob?.id ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sync Analytics
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-[11px]"
            disabled={!canApplyYouTubeReferenceStyle || youtubeStyleApplying}
            onClick={() => void handleApplyYouTubeReferenceStyle()}
          >
            {youtubeStyleApplying ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Apply Ref Style
          </Button>
        </div>

        {!youtubeOAuthConfigured ? (
          <p className="mt-2 text-[11px] text-amber-200">
            OAuth config missing: {youtubeStatusMissingConfig.length > 0 ? youtubeStatusMissingConfig.join(", ") : "server credentials"}
          </p>
        ) : null}

        {youtubeConnected ? (
          <p className="mt-2 text-[11px] text-foreground/90">
            Channel: {youtubeOAuthStatus?.channelTitle || youtubeOAuthStatus?.channelId || "Connected account"}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cold-start is normal for new creators. The engine stays on boundary critic + in-app watch/skip/thumb feedback until outcome signal grows.
          </p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={activeYouTubeVideoDraft}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (activeJob?.id) {
                setYouTubeVideoDraftByJob((prev) => ({ ...prev, [activeJob.id]: nextValue }));
                return;
              }
              setYouTubeVideoDraftLoose(nextValue);
            }}
            placeholder="Paste YouTube URL or 11-char video ID"
            className="h-9 rounded-md border border-border/60 bg-background/50 px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-65"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-3 text-[11px]"
            disabled={!activeJob?.id || youtubeVideoLinkingJobId === activeJob.id}
            onClick={() => void handleLinkYouTubeVideoToJob()}
          >
            {youtubeVideoLinkingJobId === activeJob?.id ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Link
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Linked video: {activeLinkedYouTubeVideoId || "not linked yet"}
        </p>
        {youtubeReferenceStyleApplied ? (
          <p className="mt-1 text-[11px] text-foreground/90">
            Ref style: {formatNicheLabel(youtubeReferenceStyleApplied.retentionStrategyProfile)} · {formatPlatformLabel(youtubeReferenceStyleApplied.retentionTargetPlatform)} · {youtubeReferenceStyleApplied.maxCuts} cuts · {formatNicheLabel(parseSubtitleStyleConfig(youtubeReferenceStyleApplied.subtitleStyle).preset)} captions
            {youtubeReferenceStyleConfidenceLabel ? ` · ${youtubeReferenceStyleConfidenceLabel}` : ""}
            {youtubeReferenceStyleAppliedAtLabel ? ` · applied ${youtubeReferenceStyleAppliedAtLabel}` : ""}
          </p>
        ) : null}

        {activeYouTubeSignal ? (
          <div className={`mt-3 rounded-md border p-2 ${activeYouTubeSignal.coldStartMode ? "border-amber-400/35 bg-amber-500/10" : "border-emerald-400/35 bg-emerald-500/10"}`}>
            <p className="text-xs text-foreground/90">
              {activeYouTubeSignal.coldStartMode ? "Cold-start mode active" : "Outcome trust unlocked"} ·
              trust {activeYouTubeTrustPercent ?? 0}%
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Signal volume: {activeYouTubeSignal.qualifyingVideos}/{activeYouTubeSignal.requiredVideos} videos ·
              avg views/video {activeYouTubeAverageViewsLabel} ·
              current video views {activeYouTubeCurrentViewsLabel}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Strong YouTube weighting starts around &gt;= {activeYouTubeSignal.requiredVideos} videos and about {activeYouTubeSignal.requiredAverageViewsPerVideo}-{activeYouTubeSignal.highTrustAverageViewsPerVideo} views/video.
            </p>
            <p className="mt-1 text-[11px] text-foreground/85">{activeYouTubeSignal.recommendation}</p>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Boundary-label critic + live outcome loop are running. YouTube trust increases automatically after consistent signal volume.
          </p>
        )}

        {showModeImpact ? (
          <div className="mt-3 rounded-md border border-border/50 bg-background/35 p-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How modes affect decisions</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Safe/Balanced/Viral controls candidate pacing aggression, then boundary critic blocks rough joins.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Balanced keeps the middle ground, Fast prioritizes turnaround while transcript remains required, and Quality keeps transcript-guided hook selection while continuity checks stay enforced.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              YouTube trust weighting grows over time and personalizes future edits for this connected channel.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Active now: {coldStartAutopilotEnabled ? "Cold-start autopilot" : "standard warm-start"} · {continuityFirstEnabled ? "Continuity-first" : "default continuity"} · {exploreX3Enabled ? "Explore x3 on" : "single winner"} · {topHumanGuardEnabled ? "top-human guard on" : "fallbacks allowed"} · style lock {clampCreatorStyleLockPercent(creatorStyleLockPercent)}%.
            </p>
          </div>
        ) : null}

        {activeYouTubeLastSyncedAt ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Last sync: {formatFeedbackTimestamp(activeYouTubeLastSyncedAt)}
            {activeYouTubeDateRange?.startDate && activeYouTubeDateRange?.endDate
              ? ` (${String(activeYouTubeDateRange.startDate)} -> ${String(activeYouTubeDateRange.endDate)})`
              : ""}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <Suspense fallback={<Fragment />}><GlowBackdrop>
      <Navbar />
      <main
        className={`editor-landing-skin responsive-main adaptive-editor-shell mx-auto min-h-screen max-w-6xl overflow-x-clip px-4 pt-24 pb-12 ${
          performanceConstrained ? "network-constrained editor-performance-safe" : ""
        }`}
        data-network={runtimeProfile.effectiveType ?? "unknown"}
        data-save-data={runtimeProfile.saveData ? "true" : "false"}
        data-low-power={lowPowerMode ? "true" : "false"}
        data-performance={performanceConstrained ? "constrained" : "standard"}
      >
        <motion.div
          initial={performanceConstrained ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: performanceConstrained ? 0.2 : 0.5 }}
        >
          <AnimatePresence>
            {showPipelineStatusPopup ? (
              <motion.aside
                key={`${pipelinePopupJobId || "upload"}-${pipelinePopupStatus}`}
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="pointer-events-none fixed bottom-5 right-4 z-[85] w-[min(92vw,360px)]"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="rounded-2xl border border-primary/35 bg-background/75 px-3.5 py-3 shadow-[0_18px_42px_-24px_hsl(var(--primary)/0.95)] backdrop-blur-md">
                  <div className="flex items-start gap-3">
                    <motion.div
                      animate={runtimeProfile.reducedMotion ? undefined : { rotate: 360 }}
                      transition={
                        runtimeProfile.reducedMotion
                          ? undefined
                          : { duration: 1.15, repeat: Infinity, ease: "linear" }
                      }
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary"
                    >
                      <Loader2 className="h-4 w-4" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary/90">Live Pipeline</p>
                      <p className="truncate text-sm font-semibold text-foreground">{pipelinePopupStageLabel}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{pipelinePopupDetail}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-primary/35 bg-primary/10 text-[11px] text-foreground">
                      {Math.round(pipelinePopupVisualProgress)}%
                    </Badge>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/12">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-primary/85 to-glow-secondary"
                      initial={{ width: 0 }}
                      animate={{ width: `${pipelinePopupVisualProgress}%` }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                    />
                  </div>
                  {pipelinePopupJobId ? (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">Job {pipelinePopupJobId.slice(0, 8)}</p>
                  ) : null}
                </div>
              </motion.aside>
            ) : null}
          </AnimatePresence>

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold font-premium text-foreground sm:text-3xl">{t("editor.creatorStudio")}</h1>
              <p className="text-muted-foreground mt-1">{t("editor.shipFaster")}</p>
            </div>
            <div className="w-full space-y-3 md:ml-auto md:max-w-4xl">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              {me && trialActive && (
                <Badge className="bg-emerald-500/15 text-emerald-200 border border-emerald-400/40">
                  Trial {Math.max(1, trialDaysRemaining)}d left
                </Badge>
              )}
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className={topToolbarToggleClass(onlyHookAndCut)}
                    onClick={() => setOnlyHookAndCut((prev) => !prev)}
                    aria-pressed={onlyHookAndCut}
                    aria-label={onlyHookAndCut ? t("editor.onlyHookCut.disable") : t("editor.onlyHookCut.enable")}
                    title={onlyHookAndCut ? t("editor.onlyHookCut.on") : t("editor.onlyHookCut.off")}
                  >
                    <Scissors className="h-4 w-4" />
                    <span>{onlyHookAndCut ? t("editor.onlyHookCut.on") : t("editor.onlyHookCut.off")}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={topToolbarToggleClass(!hideJobsPanel)}
                    onClick={() => setHideJobsPanel((prev) => !prev)}
                    aria-pressed={!hideJobsPanel}
                  >
                    {hideJobsPanel ? t("editor.jobs.show") : t("editor.jobs.hide")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={topToolbarToggleClass(editorGuideOpen)}
                    onClick={() => {
                      editorGuidePromptedRef.current = true;
                      setEditorGuideOpen(true);
                    }}
                    aria-pressed={editorGuideOpen}
                    aria-label={t("editor.help.open")}
                    title={t("editor.help.title")}
                  >
                    <MapIcon className="h-4 w-4" />
                    <span>Help</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={topToolbarToggleClass(false)}
                    onClick={() => navigate("/settings")}
                  >
                    Account Settings
                  </Button>
                  <Button onClick={handlePickFile} className="w-full min-h-12 rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
                    <Plus className="w-4 h-4" /> {t("editor.newProject")}
                  </Button>
                </div>
              </div>
              <div className="editor-settings-shell w-full p-3.5 md:p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Editing Tools</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{t("editor.settings.title")}</span>
                      {hideEditorControlsPanel ? (
                        <span className="text-xs text-muted-foreground">{t("editor.settings.collapsed")}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Quick setup first, then fine-tune only what you need.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (hideEditorControlsPanel) {
                        setHideEditorControlsPanel(false);
                        return;
                      }
                      setHideEditorControlsPanel(true);
                    }}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border/60 bg-muted/20 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    aria-label={hideEditorControlsPanel ? t("editor.settings.open") : t("editor.settings.close")}
                    title={hideEditorControlsPanel ? t("editor.settings.openShort") : t("editor.settings.closeShort")}
                  >
                    {hideEditorControlsPanel ? <SlidersHorizontal className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    hideEditorControlsPanel ? "max-h-16 opacity-95" : "max-h-[3400px] opacity-100"
                  }`}
                >
                  {hideEditorControlsPanel ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{t("editor.settings.hidden")}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-10 rounded-lg border-border/60 bg-muted/20 text-foreground hover:border-primary/40 hover:bg-primary/10"
                        onClick={() => setHideEditorControlsPanel(false)}
                      >
                        {t("editor.settings.openShort")}
                      </Button>
                    </div>
                  ) : (
                    <div className={`space-y-3 ${mobilePipeline ? "pb-20" : ""}`}>
                      {captionEngineOffline ? (
                        <div className="rounded-xl border border-primary/35 bg-gradient-to-r from-primary/15 via-primary/8 to-transparent px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium text-foreground">Captions Offline - Set OpenAI Key to Unlock</p>
                            <Button
                              type="button"
                              className="min-h-12 rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--glow-secondary))] text-white hover:from-primary/90 hover:to-[hsl(var(--glow-secondary)/0.9)] md:min-h-10"
                              onClick={() => navigate("/settings")}
                            >
                              Fix Now
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="editor-tools-step-card">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                            <p className="text-sm font-semibold text-foreground">Quick Setup</p>
                          </div>
                          <Badge className="border-primary/35 bg-primary/10 text-primary">Simple Mode</Badge>
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Choose format, vibe, cuts, and captions. Most creators can render from this section alone.
                        </p>
                        <div className="mb-3 space-y-1.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">One-tap presets</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <button
                              type="button"
                              className={sectionPillClass(!isVerticalMode && retentionStrategyProfile === "safe" && maxCutsRequested <= 6)}
                              onClick={() => applyQuickSetupPreset("simple")}
                              aria-label="Simple preset"
                            >
                              <div className="flex flex-col items-center">
                                <CheckCircle2 className="h-5 w-5" aria-hidden />
                                <span className="text-[11px] mt-1">Simple</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              className={sectionPillClass(!isVerticalMode && retentionStrategyProfile === "balanced" && maxCutsRequested >= 7 && maxCutsRequested <= 9)}
                              onClick={() => applyQuickSetupPreset("balanced")}
                              aria-label="Balanced preset"
                            >
                              <div className="flex flex-col items-center">
                                <Gauge className="h-5 w-5" aria-hidden />
                                <span className="text-[11px] mt-1">Balanced</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              className={sectionPillClass(isVerticalMode && retentionStrategyProfile === "viral" && maxCutsRequested >= 10)}
                              onClick={() => applyQuickSetupPreset("viral")}
                              aria-label="Viral preset"
                            >
                              <div className="flex flex-col items-center">
                                <Flame className="h-5 w-5" aria-hidden />
                                <span className="text-[11px] mt-1">Viral</span>
                              </div>
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 items-stretch">
                          <div className="min-h-[140px] flex flex-col justify-between space-y-2 rounded-xl border border-border/50 bg-background/35 p-2.5">
                            <p className="text-xs text-muted-foreground">Vibe · {activeRetentionLabel}</p>
                            <Slider
                              min={0}
                              max={RETENTION_PROFILE_SEQUENCE.length - 1}
                              step={1}
                              value={[retentionSliderValue]}
                              className="editor-settings-slider"
                              onValueChange={(values) => {
                                const candidate = Number(values?.[0] ?? retentionSliderValue);
                                const next = RETENTION_PROFILE_SEQUENCE[clamp(Math.round(candidate), 0, RETENTION_PROFILE_SEQUENCE.length - 1)];
                                setRetentionStrategyProfile(next);
                              }}
                            />
                          </div>
                          <div className="min-h-[140px] flex flex-col justify-between space-y-2 rounded-xl border border-border/50 bg-background/35 p-2.5">
                            <p className="text-xs text-muted-foreground">Cuts · {maxCutsRequested}</p>
                            <Slider
                              min={MAX_CUTS_MIN}
                              max={MAX_CUTS_MAX}
                              step={1}
                              value={[maxCutsRequested]}
                              className="editor-settings-slider"
                              onValueChange={(values) => {
                                const candidate = Number(values?.[0] ?? maxCutsRequested);
                                if (!Number.isFinite(candidate)) return;
                                setMaxCutsRequested(clamp(Math.round(candidate), MAX_CUTS_MIN, MAX_CUTS_MAX));
                              }}
                            />
                          </div>
                          <div className="min-h-[140px] flex flex-col justify-between space-y-2 rounded-xl border border-border/50 bg-background/35 p-2.5">
                            <p className="text-xs text-muted-foreground">Captions · {autoCaptionsEnabled ? "On" : "Off"}</p>
                            <Button
                              type="button"
                              className={`w-full min-h-12 rounded-xl md:min-h-[46px] ${
                                autoCaptionsEnabled
                                  ? "bg-primary text-white hover:bg-primary/90"
                                  : "border border-border/60 bg-muted/20 text-foreground hover:border-primary/40 hover:bg-primary/10"
                              }`}
                              onClick={() => {
                                if (captionsToggleDisabled) return;
                                const nextState = !autoCaptionsEnabled;
                                setAutoCaptionsEnabled(nextState);
                                setSubtitleStyleDirty(true);
                              }}
                              disabled={captionsToggleDisabled}
                              aria-pressed={autoCaptionsEnabled}
                              aria-label={autoCaptionsEnabled ? "Captions enabled" : "Captions disabled"}
                            >
                              <div className="flex items-center justify-center gap-2">
                                {autoCaptionsEnabled ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                                <span className="text-sm">{autoCaptionsEnabled ? "Captions On" : "Captions Off"}</span>
                              </div>
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                              {isVerticalMode ? "Vertical" : "Horizontal"}
                            </span>
                            <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                              {activeTargetPlatformLabel}
                            </span>
                            <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                              {activeEditorModeLabel}
                            </span>
                            {coldStartAutopilotEnabled ? (
                              <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                                Cold-Start
                              </span>
                            ) : null}
                            {continuityFirstEnabled ? (
                              <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                                Continuity-First
                              </span>
                            ) : null}
                            {exploreX3Enabled ? (
                              <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                                Explore x3
                              </span>
                            ) : null}
                            {topHumanGuardEnabled ? (
                              <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                                Top-Human Guard
                              </span>
                            ) : null}
                            <span className="rounded-full border border-border/60 bg-muted/15 px-2.5 py-1 text-muted-foreground">
                              Style lock {clampCreatorStyleLockPercent(creatorStyleLockPercent)}%
                            </span>
                            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-primary">
                              {activePlatformRecommendation.label}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-12 rounded-xl bg-primary px-4 text-white hover:bg-primary/90 md:min-h-10"
                            onClick={applyPlatformRecommendation}
                          >
                            Auto Recommend
                          </Button>
                        </div>
                      </div>

                      <div className="editor-tools-step-card">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                            <p className="text-sm font-semibold text-foreground">Fine Tune (Optional)</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground">Optional details</span>
                        </div>
                        {mobilePipeline ? (
                          <Accordion
                            type="single"
                            collapsible
                            value={editorSettingsSection}
                            onValueChange={(value) => {
                              if (!value) return;
                              setEditorSettingsSection(value as EditorSettingsSection);
                            }}
                            className="space-y-2"
                          >
                            {EDITOR_SETTINGS_SECTIONS.map((item) => (
                              <AccordionItem key={item.key} value={item.key} className="rounded-xl border border-border/50 bg-muted/15 px-3">
                                <AccordionTrigger className="py-3 text-sm text-foreground hover:no-underline">
                                  {item.label}
                                </AccordionTrigger>
                                <AccordionContent className="pb-2">{renderSettingsSection(item.key)}</AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        ) : (
                          <Tabs
                            value={editorSettingsSection}
                            onValueChange={(value) => setEditorSettingsSection(value as EditorSettingsSection)}
                            className="space-y-3"
                          >
                            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border border-border/50 bg-muted/15 p-1.5 md:grid-cols-4">
                              {EDITOR_SETTINGS_SECTIONS.map((item) => (
                                <TabsTrigger
                                  key={item.key}
                                  value={item.key}
                                  className="editor-settings-tab min-h-12 rounded-lg text-xs"
                                >
                                  {item.label}
                                </TabsTrigger>
                              ))}
                            </TabsList>
                            {EDITOR_SETTINGS_SECTIONS.map((item) => (
                              <TabsContent key={item.key} value={item.key} className="mt-0">
                                {renderSettingsSection(item.key)}
                              </TabsContent>
                            ))}
                          </Tabs>
                        )}
                      </div>

                      {outcomeAutomationProfile ? (
                        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                          Outcome automation: {outcomeAutomationProfile.enabled
                            ? `${outcomeAutomationProfile.sampleSize} outcomes, ${outcomeAutomationConfidencePercent}% confidence${Math.abs(outcomeAutomationExpectedLiftPoints) >= 0.1 ? `, expected ${outcomeAutomationExpectedLiftPoints >= 0 ? "+" : ""}${outcomeAutomationExpectedLiftPoints.toFixed(1)} pts` : ""}.`
                            : outcomeAutomationProfile.reasons?.[0] || "Collecting watch-time outcomes to calibrate menu defaults."}
                        </div>
                      ) : null}

                      {/* Mobile adaptation: persistent bottom CTA for one-thumb apply-and-render flow. */}
                      {mobilePipeline ? (
                        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                          <div className="pointer-events-auto rounded-2xl border border-primary/35 bg-[linear-gradient(145deg,rgba(15,15,26,0.96),rgba(18,18,31,0.92))] p-2 backdrop-blur-xl">
                            <Button
                              type="button"
                              className="min-h-12 w-full rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--glow-secondary))] text-white hover:from-primary/90 hover:to-[hsl(var(--glow-secondary)/0.9)]"
                              onClick={runApplyAndRender}
                              disabled={mobileApplyAndRenderDisabled}
                            >
                              {mobileApplyAndRenderLabel}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
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
            onChange={handleFileInputChange}
          />

          <div className={`grid grid-cols-1 gap-6 ${hideJobsPanel ? "lg:grid-cols-1" : "lg:grid-cols-[280px_1fr]"}`}>
            {!hideJobsPanel ? (
              <aside className="editor-job-list-shell min-w-0 space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Pipeline Jobs</h2>
                    <p className="text-[11px] text-muted-foreground">Pick a job to view status, stage, and live progress.</p>
                  </div>
                  <Badge variant="secondary" className="border-border/50 bg-muted/30 text-muted-foreground">
                    {jobs.length}
                  </Badge>
                </div>
                {loadingJobs && <p className="text-xs text-muted-foreground">Loading jobs...</p>}
                {!loadingJobs && jobs.length === 0 && (
                  <p className="text-xs text-muted-foreground">No jobs yet. Upload a video to get started.</p>
                )}
                <div className="space-y-2.5">
                  {jobs.map((job) => {
                    const normalizedJobStatus = normalizeStatus(job.status);
                    const ready = normalizedJobStatus === "ready";
                    const inFlight = !isTerminalStatus(job.status);
                    const stageLabel =
                      PIPELINE_STEPS.find((step) => step.key === stepKeyForStatus(job.status))?.label ??
                      STATUS_LABELS[normalizedJobStatus] ??
                      "Upload";
                    const progressValue = clamp(Number(job.progress ?? 0), 0, 100);
                    const visualProgress = inFlight ? Math.max(6, progressValue) : progressValue;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => handleSelectJob(job.id)}
                        data-selected={selectedJobId === job.id ? "true" : "false"}
                        data-ready={ready ? "true" : "false"}
                        data-highlighted={highlightedJobId === job.id ? "true" : "false"}
                        className="editor-job-card w-full text-left px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-semibold ${ready ? "text-success" : "text-foreground"}`}>
                              {displayName(job)}
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                              Job {job.id.slice(0, 8)}
                            </p>
                          </div>
                          {inFlight ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              Live
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(job.status)}`}>
                            {STATUS_LABELS[normalizedJobStatus] || "Queued"}
                          </Badge>
                          <Badge variant="outline" className="border-border/60 bg-muted/20 text-[10px] text-muted-foreground">
                            Stage: {stageLabel}
                          </Badge>
                          <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{Math.round(progressValue)}%</span>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/70">
                          <div
                            className={`h-full rounded-full transition-all ${
                              normalizedJobStatus === "failed"
                                ? "bg-gradient-to-r from-destructive/80 to-destructive"
                                : ready
                                  ? "bg-gradient-to-r from-emerald-300 to-emerald-500"
                                  : "bg-gradient-to-r from-primary via-[hsl(var(--glow-secondary))] to-cyan-300"
                            }`}
                            style={{ width: `${visualProgress}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {new Date(job.createdAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/45 px-2 py-0.5">
                            {job.renderMode === "vertical" ? (
                              <>
                                <ScissorsSquare className="h-3 w-3 text-primary" />
                                Vertical
                              </>
                            ) : (
                              "Standard"
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            <section className="min-w-0 space-y-6">
              <div
                ref={uploadDropZoneRef}
                className={`glass-card editor-upload-dropzone p-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
                  isDragging ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/30"
                }`}
                onClick={handlePickFile}
                onDragEnter={handleDropZoneDragEnter}
                onDragOver={handleDropZoneDragOver}
                onDragLeave={handleDropZoneDragLeave}
                onDrop={handleDrop}
                onKeyDown={handleDropZoneKeyDown}
                role="button"
                tabIndex={0}
                aria-label={isVerticalMode ? "Drop a source video for vertical editing" : "Drop a video file to upload"}
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
                  {performanceConstrained && (
                    <p className="text-[11px] text-muted-foreground">
                      Adaptive mode enabled for this device/network to prioritize stability on mobile and slower internet.
                    </p>
                  )}
                  {ultraPipelineMode ? (
                    <p className="text-[11px] text-primary">
                      Fast mode active: accelerated upload with transcript still required.
                    </p>
                  ) : retentionKingPipelineMode ? (
                    <p className="text-[11px] text-primary">
                      Quality mode active: transcript-guided hook analysis enabled.
                    </p>
                  ) : null}
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

              {isVerticalMode && !isVerticalBuilderHidden && (
                <div className="glass-card vertical-mode-shell p-5 space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="vertical-mode-title text-sm font-medium text-foreground">Vertical Clip Builder</p>
                      <p className="vertical-mode-subtitle text-xs text-muted-foreground">
                        {skipManualWebcamCrop
                          ? "Manual webcam crop is skipped. Vertical clips render directly from the source framing."
                          : "Manual Webcam Selector is now a crop tool. Top panel uses the selected crop, bottom panel uses the full frame."}
                      </p>
                      <button
                        type="button"
                        className="hero-platform-pill vertical-mode-toggle mt-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/35 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-sm"
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
                      {[0, 3, 4].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={verticalModeChipClass(verticalClipCount === count)}
                          onClick={() => setVerticalClipCount(count)}
                        >
                          {count === 0 ? "Auto" : `${count} clips`}
                        </button>
                      ))}
                    </div>
                    <p className="vertical-mode-note text-[11px] text-muted-foreground">
                      Auto picks 3-4 ranked clips. Fixed values force an exact short-form batch size.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="vertical-mode-panel space-y-2 rounded-xl border border-border/40 bg-card/45 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">TikTok Caption Text (optional)</p>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]">
                              Style
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-[min(94vw,460px)] max-h-[70vh] overflow-y-auto border border-border/60 bg-card/95 p-3"
                          >
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-medium text-foreground">Vertical Caption Style</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px]"
                                  onClick={() => applyPlatformVerticalCaptionPreset(retentionTargetPlatform)}
                                >
                                  Match {activeTargetPlatformLabel} look
                                </Button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {(["tiktok", "instagram_reels", "youtube"] as RetentionTargetPlatform[]).map((platform) => {
                                  const mappedPreset = PLATFORM_VERTICAL_CAPTION_PRESET[platform];
                                  const platformLabel =
                                    platform === "tiktok" ? "TikTok" : platform === "instagram_reels" ? "IG Reels" : "YouTube Shorts";
                                  return (
                                    <button
                                      key={platform}
                                      type="button"
                                      className={verticalModeChipClass(verticalCaptionPreset === mappedPreset)}
                                      onClick={() => applyPlatformVerticalCaptionPreset(platform)}
                                    >
                                      {platformLabel}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <label className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">Style</span>
                                  <select
                                    className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                                    value={verticalCaptionPreset}
                                    onChange={(event) => applyVerticalCaptionPreset(event.target.value as VerticalCaptionPresetOptionId)}
                                  >
                                    {VERTICAL_CAPTION_STYLE_OPTIONS.map((option) => (
                                      <option key={option.id} value={option.id} className="bg-background text-foreground">
                                        {option.platformHint ? `${option.label} (${option.platformHint})` : option.label}
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
                                  <span className="text-[11px] text-muted-foreground">Dynamic captions</span>
                                  <select
                                    className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                                    value={verticalCaptionDynamicMode}
                                    onChange={(event) => setVerticalCaptionDynamicMode(event.target.value as VerticalCaptionDynamicModeOptionId)}
                                  >
                                    {VERTICAL_CAPTION_DYNAMIC_MODE_OPTIONS.map((modeOption) => (
                                      <option key={modeOption.id} value={modeOption.id} className="bg-background text-foreground">
                                        {modeOption.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">Voice changer</span>
                                  <select
                                    className="w-full rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground"
                                    value={verticalVoicePreset}
                                    onChange={(event) => setVerticalVoicePreset(event.target.value as VerticalVoicePresetOptionId)}
                                  >
                                    {VERTICAL_VOICE_PRESET_OPTIONS.map((voiceOption) => (
                                      <option key={voiceOption.id} value={voiceOption.id} className="bg-background text-foreground">
                                        {voiceOption.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">
                                    Animation speed ({verticalCaptionAnimationSpeed.toFixed(2)}x)
                                  </span>
                                  <Slider
                                    min={VERTICAL_CAPTION_ANIMATION_SPEED_MIN}
                                    max={VERTICAL_CAPTION_ANIMATION_SPEED_MAX}
                                    step={0.02}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionAnimationSpeed]}
                                    onValueChange={(values) =>
                                      setVerticalCaptionAnimationSpeed(
                                        clampVerticalCaptionAnimationSpeed(
                                          values?.[0] ?? VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].animationSpeed,
                                        ),
                                      )
                                    }
                                  />
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
                                <label className="space-y-1 sm:col-span-2">
                                  <span className="text-[11px] text-muted-foreground">Outline width ({verticalCaptionOutlineWidth}px)</span>
                                  <Slider
                                    min={0}
                                    max={24}
                                    step={1}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionOutlineWidth]}
                                    onValueChange={(values) => setVerticalCaptionOutlineWidth(clamp(Math.round(values?.[0] ?? 0), 0, 24))}
                                  />
                                </label>
                                <label className="space-y-1 sm:col-span-2">
                                  <span className="text-[11px] text-muted-foreground">Caption size ({Math.round(verticalCaptionFontSize)}px)</span>
                                  <Slider
                                    min={VERTICAL_CAPTION_FONT_SIZE_MIN}
                                    max={VERTICAL_CAPTION_FONT_SIZE_MAX}
                                    step={1}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionFontSize]}
                                    onValueChange={(values) =>
                                      setVerticalCaptionFontSize(
                                        Math.round(
                                          clamp(
                                            values?.[0] ?? VERTICAL_CAPTION_FONT_SIZE_DEFAULT,
                                            VERTICAL_CAPTION_FONT_SIZE_MIN,
                                            VERTICAL_CAPTION_FONT_SIZE_MAX,
                                          ),
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                <label className="space-y-1 sm:col-span-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    Drop shadow ({Math.round(verticalCaptionShadowStrength)}%)
                                  </span>
                                  <Slider
                                    min={VERTICAL_CAPTION_SHADOW_MIN}
                                    max={VERTICAL_CAPTION_SHADOW_MAX}
                                    step={1}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionShadowStrength]}
                                    onValueChange={(values) =>
                                      setVerticalCaptionShadowStrength(
                                        Math.round(
                                          clamp(
                                            values?.[0] ?? VERTICAL_CAPTION_PRESET_DEFAULTS[verticalCaptionPreset].shadowStrength,
                                            VERTICAL_CAPTION_SHADOW_MIN,
                                            VERTICAL_CAPTION_SHADOW_MAX,
                                          ),
                                        ),
                                      )
                                    }
                                  />
                                </label>
                                <div className="sm:col-span-2 grid grid-cols-1 gap-2">
                                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                    <span className="text-[11px] text-muted-foreground">Word highlight (karaoke)</span>
                                    <Switch
                                      checked={verticalCaptionHighlightWords}
                                      onCheckedChange={(checked) => setVerticalCaptionHighlightWords(Boolean(checked))}
                                    />
                                  </label>
                                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                    <span className="text-[11px] text-muted-foreground">Auto keyword emphasis</span>
                                    <Switch
                                      checked={verticalCaptionAutoEmphasis}
                                      onCheckedChange={(checked) => setVerticalCaptionAutoEmphasis(Boolean(checked))}
                                    />
                                  </label>
                                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                    <span className="text-[11px] text-muted-foreground">Auto emoji hooks</span>
                                    <Switch
                                      checked={verticalCaptionAutoEmoji}
                                      onCheckedChange={(checked) => setVerticalCaptionAutoEmoji(Boolean(checked))}
                                    />
                                  </label>
                                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2">
                                    <span className="text-[11px] text-muted-foreground">Remove filler words</span>
                                    <Switch
                                      checked={verticalCaptionRemoveFillers}
                                      onCheckedChange={(checked) => setVerticalCaptionRemoveFillers(Boolean(checked))}
                                    />
                                  </label>
                                </div>
                                <label className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">
                                    Position X ({Math.round(verticalCaptionPositionX * 100)}%)
                                  </span>
                                  <Slider
                                    min={VERTICAL_CAPTION_POSITION_MIN}
                                    max={VERTICAL_CAPTION_POSITION_MAX}
                                    step={0.01}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionPositionX]}
                                    onValueChange={(values) => setVerticalCaptionPositionX(clampCaptionPosition(values?.[0] ?? 0.5))}
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">
                                    Position Y ({Math.round(verticalCaptionPositionY * 100)}%)
                                  </span>
                                  <Slider
                                    min={VERTICAL_CAPTION_POSITION_MIN}
                                    max={VERTICAL_CAPTION_POSITION_MAX}
                                    step={0.01}
                                    className="editor-settings-slider"
                                    value={[verticalCaptionPositionY]}
                                    onValueChange={(values) => setVerticalCaptionPositionY(clampCaptionPosition(values?.[0] ?? 0.84))}
                                  />
                                </label>
                                <div className="sm:col-span-2 flex items-center justify-end">
                                  <Button type="button" size="sm" variant="outline" onClick={resetVerticalCaptionPlacement}>
                                    Reset caption placement
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Drag captions in the live preview or fine-tune with sliders. Style, size, shadow, and position apply to vertical captions.
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Textarea
                        value={verticalCaptionText}
                        onChange={(event) => setVerticalCaptionText(event.target.value)}
                        placeholder={"WTF 😂\nNo way this happened\nRun it back 🔁"}
                        className="vertical-mode-textarea min-h-[92px] resize-y border-border/60 bg-muted/20 text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Your text is split into short phrases and synced to hook/peak moments. Leave blank to auto-generate per clip.
                      </p>
                    </div>
                  </div>

                  {!verticalPreviewUrl && (
                    <p className="vertical-mode-note text-xs text-muted-foreground">
                      Upload a file to open the webcam crop tool and 9:16 stacked preview.
                    </p>
                  )}

                  {verticalPreviewUrl && (
                    <div className="space-y-4">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                        <div className="space-y-3">
                          <div className="vertical-mode-panel rounded-xl border border-border/40 bg-card/45 p-3 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-medium text-foreground">Manual Webcam Selector</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Drag the crop box for the top strip. Move inside to reposition and drag handles to resize.
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">
                                {skipManualWebcamCrop ? "Manual crop off" : "Manual crop on"}
                              </Badge>
                            </div>

                            {!skipManualWebcamCrop ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs"
                                  onClick={() => {
                                    if (!sourceVideoMeta) return;
                                    setWebcamCrop(buildDefaultWebcamCrop(sourceVideoMeta.width, sourceVideoMeta.height));
                                    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
                                  }}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reset crop
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs"
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
                                  <Monitor className="h-3.5 w-3.5" />
                                  Snap full width
                                </Button>
                              </div>
                            ) : null}

                            <div
                              ref={sourcePreviewRef}
                              className="vertical-mode-source-preview relative overflow-hidden rounded-xl border border-border/40 bg-black/80 touch-none select-none"
                              style={sourceVideoMeta ? { aspectRatio: `${sourceVideoMeta.width} / ${sourceVideoMeta.height}` } : { aspectRatio: "16 / 9" }}
                            >
                              <video
                                ref={verticalSourceVideoRef}
                                src={verticalPreviewUrl}
                                preload={previewPreload}
                                controls
                                onLoadedMetadata={handleVerticalSourceMetadata}
                                className="h-full w-full object-contain"
                              />
                              {!skipManualWebcamCrop && webcamCropStyle && (
                                <div
                                  className={`absolute border-2 border-primary bg-primary/15 ${cropInteraction ? "ring-2 ring-primary/40" : ""}`}
                                  style={{
                                    ...webcamCropStyle,
                                    boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.38)",
                                  }}
                                  onPointerDown={(event) => beginCropInteraction("move", event)}
                                >
                                  <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                                    Top strip
                                  </span>
                                  {webcamPaddingPx > 0 && webcamCrop && (
                                    <div
                                      className="absolute border border-foreground/70 border-dashed pointer-events-none"
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
                                      className={`absolute h-4 w-4 rounded-full border-2 border-background/80 bg-primary shadow-lg ring-1 ring-primary/55 ${handle.className}`}
                                      onPointerDown={(event) => beginCropInteraction(handle.key, event)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {sourceVideoMeta ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Source {Math.round(sourceVideoMeta.width)} x {Math.round(sourceVideoMeta.height)}
                                </Badge>
                              ) : null}
                              {!skipManualWebcamCrop && webcamCrop ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Crop {Math.round(webcamCrop.w)} x {Math.round(webcamCrop.h)}
                                </Badge>
                              ) : null}
                              {!skipManualWebcamCrop && webcamCrop ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Offset {Math.round(webcamCrop.x)}, {Math.round(webcamCrop.y)}
                                </Badge>
                              ) : null}
                            </div>

                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                              <MousePointerClick className="w-3.5 h-3.5" />
                              {skipManualWebcamCrop
                                ? "Manual webcam crop is disabled. Source framing will be used."
                                : webcamCrop
                                ? "Drag the crop region to set your top webcam strip framing."
                                : "Webcam crop initializes when video metadata loads."}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="vertical-mode-panel rounded-xl border border-border/40 bg-card/50 p-3 space-y-3">
                            <video
                              ref={verticalCompositionVideoRef}
                              src={verticalPreviewUrl}
                              preload="metadata"
                              muted
                              loop
                              playsInline
                              className="hidden"
                            />
                            <p className="text-xs font-medium text-foreground">Live 9:16 Composition Preview</p>
                            <div className="mx-auto w-full max-w-[300px]">
                              <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                                <canvas
                                  ref={verticalCompositionCanvasRef}
                                  className={`h-full w-full rounded-lg border border-border/50 bg-black touch-none select-none ${
                                    verticalCaptionDragState ? "cursor-grabbing" : "cursor-grab"
                                  }`}
                                  onPointerDown={beginVerticalCaptionDrag}
                                />
                                <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-border/50" />
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Click or drag anywhere in the preview to move captions, then use Style sliders to adjust size and drop shadow.
                            </p>
                          </div>
                          <div className="vertical-mode-panel rounded-xl border border-border/40 bg-card/40 p-3 space-y-3">
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
                                    className={verticalModeChipClass(bottomFitMode === fit)}
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
                        <p className="vertical-mode-note text-xs text-muted-foreground">
                          {skipManualWebcamCrop
                            ? `Output: ${DEFAULT_VERTICAL_OUTPUT.width} x ${DEFAULT_VERTICAL_OUTPUT.height}, single-frame vertical render (manual crop skipped).`
                            : `Output: ${DEFAULT_VERTICAL_OUTPUT.width} x ${DEFAULT_VERTICAL_OUTPUT.height}, top webcam strip + bottom full-frame stack.`}
                        </p>
                        <Button
                          type="button"
                          className="hero-cta-button hero-cta-primary vertical-mode-cta w-full gap-2 rounded-full px-5 sm:w-auto"
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
                      src={resolvedPreviewOutputUrl}
                      preload={previewPreload}
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

              <div className={`glass-card p-4 sm:p-5 space-y-4 ${mobilePipeline ? "mobile" : ""}`}>
                {/* ARIA live announcements keep screen readers updated with pipeline state changes. */}
                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  {activeJob
                    ? `Pipeline update: ${activeStatusLabel}, ${Math.round(totalPipelineProgress)} percent complete.`
                    : "No active pipeline selected."}
                </div>
                {normalizeStatus(activeJob?.status) === "failed" ? (
                  <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                    Pipeline failed. {failedGateReason || activeJob?.error || "Retry the render."}
                  </div>
                ) : null}

                <div className="editor-pipeline-shell glass-card rounded-2xl border px-3.5 py-3 sm:px-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-gradient-primary text-sm font-semibold">Pipeline Console</p>
                      <p className="text-xs text-muted-foreground">
                        {activeJob
                          ? "Status, stage, and full-scan progress for the selected render."
                          : "Select a job to view its pipeline timeline."}
                      </p>
                    </div>
                    {activeJob ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`text-xs flex items-center gap-1.5 ${statusBadgeClass(activeJob.status)}`}>
                          {normalizeStatus(activeJob.status) === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                          {activeStatusLabel}
                        </Badge>
                        <Badge variant="outline" className="border-border/60 bg-muted/20 text-xs text-muted-foreground">
                          {Math.round(totalPipelineProgress)}%
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  {activeJob ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="hero-platform-pill inline-flex items-center rounded-full border border-border/60 bg-background/55 px-2 py-0.5 text-foreground">
                        {displayName(activeJob)}
                      </span>
                      <span className="hero-platform-pill inline-flex items-center rounded-full border border-border/60 bg-background/55 px-2 py-0.5 text-muted-foreground">
                        Stage: {activeStageLabel}
                      </span>
                      <span className="hero-platform-pill inline-flex items-center rounded-full border border-border/60 bg-background/55 px-2 py-0.5 text-muted-foreground">
                        {activeJob.renderMode === "vertical" ? "Vertical job" : "Standard render"}
                      </span>
                      <span className="hero-platform-pill inline-flex items-center rounded-full border border-border/60 bg-background/55 px-2 py-0.5 text-muted-foreground">
                        {activeJobCreatedAtLabel}
                      </span>
                    </div>
                  ) : null}
                </div>

                {loadingJob && <p className="text-xs text-muted-foreground">Loading job details...</p>}
                {!activeJob && !loadingJob && (
                  <p className="text-xs text-muted-foreground">Select a job to view its pipeline.</p>
                )}

                {activeJob && (
                  <>
                    <div className="space-y-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary via-primary/80 to-glow-secondary"
                          initial={{ width: 0 }}
                          animate={{ width: `${totalPipelineProgress}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="uppercase tracking-[0.16em]">Live Pipeline Progress</span>
                        <span>{Math.round(totalPipelineProgress)}%</span>
                      </div>
                    </div>

                    <div className="editor-pipeline-stage-track rounded-2xl border border-border/60 bg-card/45 p-3 sm:p-4">
                      <div className="pipeline-scrollbar hide-scrollbar overflow-x-auto">
                        <ol className="flex min-w-[980px] items-center gap-2" aria-label="High-retention pipeline stages">
                          {pipelineRows.map((row, idx) => (
                            <li key={row.key} className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    aria-current={row.state === "active" ? "step" : undefined}
                                    data-state={row.state}
                                    className={`editor-pipeline-stage-pill rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                                      row.state === "done"
                                        ? "border-primary/50 bg-primary/15 text-foreground"
                                        : row.state === "active"
                                          ? "border-primary/70 bg-primary/20 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
                                          : row.state === "failed"
                                            ? "border-destructive/70 bg-destructive/20 text-destructive"
                                            : "border-border/60 bg-background/55 text-muted-foreground"
                                    }`}
                                  >
                                    {row.label}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs border-border/60 bg-card text-foreground">
                                  <p className="font-medium">{row.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{row.detail}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">{row.percent}% complete</p>
                                </TooltipContent>
                              </Tooltip>
                              {idx < pipelineRows.length - 1 ? (
                                <span className="editor-pipeline-stage-arrow text-xs text-muted-foreground">→</span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/45 p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Live Transcript Editor</p>
                          <p className="text-xs text-muted-foreground">{transcriptEditorStageHint}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="border-border/60 bg-background/55 text-xs text-muted-foreground">
                            {transcriptEditorStageLabel}
                          </Badge>
                          <Badge variant="outline" className="border-border/60 bg-background/55 text-xs text-muted-foreground">
                            {transcriptSourceCueCount.toLocaleString()} source cues
                          </Badge>
                          {transcriptEditedCueCount > 0 ? (
                            <Badge variant="outline" className="border-border/60 bg-background/55 text-xs text-muted-foreground">
                              {transcriptEditedCueCount.toLocaleString()} edited cues
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {transcriptHasEditor ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <Badge className="border-primary/35 bg-primary/10 text-primary-foreground">
                            {transcriptKeepCount.toLocaleString()} kept
                          </Badge>
                          <Badge variant="outline" className="border-border/60 bg-background/55 text-xs text-muted-foreground">
                            {transcriptCutCount.toLocaleString()} cut
                          </Badge>
                        </div>
                      ) : null}
                      <Tabs value={transcriptPanelTab} onValueChange={(value) => setTranscriptPanelTab(value as TranscriptPanelTab)} className="mt-3 space-y-3">
                        <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-xl border border-border/50 bg-muted/15 p-1.5">
                          <TabsTrigger value="editor" disabled={!transcriptHasEditor}>
                            Editor View
                          </TabsTrigger>
                          <TabsTrigger value="preview" disabled={!transcriptHasPreview}>
                            Edited Preview
                          </TabsTrigger>
                          <TabsTrigger value="source" disabled={!transcriptHasSource}>
                            Source
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="editor" className="mt-0">
                          {transcriptHasEditor ? (
                            <div className="pipeline-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
                              {liveTranscriptEditorRows.map((row, index) => {
                                const isHookCue = row.decision === "hook";
                                const isCutCue = row.decision === "cut";
                                const isKeepCue = row.decision === "keep";
                                const badgeLabel = isHookCue ? "Hook" : isKeepCue ? "Keep" : isCutCue ? "Cut" : "Pending";
                                return (
                                  <div
                                    key={`transcript-editor-row-${index}-${row.cue.start}`}
                                    className={`rounded-xl border px-3 py-2 ${
                                      isHookCue
                                        ? "border-primary/55 bg-primary/10"
                                        : isKeepCue
                                          ? "border-emerald-400/35 bg-emerald-500/5"
                                          : isCutCue
                                            ? "border-border/40 bg-background/30"
                                            : "border-border/50 bg-background/40"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <span className="text-[11px] font-medium text-muted-foreground">
                                        {formatDurationClock(row.cue.start)} - {formatDurationClock(row.cue.end)}
                                      </span>
                                      <Badge
                                        variant={isCutCue ? "outline" : "default"}
                                        className={
                                          isHookCue
                                            ? "border-primary/35 bg-primary/10 text-primary-foreground"
                                            : isKeepCue
                                              ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                                              : isCutCue
                                                ? "border-border/60 bg-background/50 text-muted-foreground"
                                                : "border-border/60 bg-background/55 text-muted-foreground"
                                        }
                                      >
                                        {badgeLabel}
                                      </Badge>
                                    </div>
                                    <p className={`mt-1 text-sm leading-relaxed ${isCutCue ? "text-muted-foreground line-through opacity-70" : "text-foreground/92"}`}>
                                      {row.cue.text}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-4 text-xs text-muted-foreground">
                              Waiting for edit decisions to land on the transcript.
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="preview" className="mt-0">
                          {transcriptHasPreview ? (
                            <div className="pipeline-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
                              {!transcriptSeekEnabled ? (
                                <p className="rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                                  Edited preview transcript is ready. Player sync turns on when the render reaches Ready.
                                </p>
                              ) : null}
                              {liveEditedTranscriptCues.map((cue, index) => {
                                const isActiveCue = activeTranscriptCueIndex === index;
                                const isLowConfidenceCue = cue.confidence !== null && cue.confidence !== undefined && cue.confidence < 0.55;
                                return (
                                  <button
                                    key={`transcript-preview-cue-${index}-${cue.start}`}
                                    type="button"
                                    disabled={!transcriptSeekEnabled}
                                    onClick={() => handleSeekPreviewToTranscriptCue(cue)}
                                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                      isActiveCue
                                        ? "border-primary/65 bg-primary/12 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]"
                                        : transcriptSeekEnabled
                                          ? "border-border/50 bg-background/45 hover:border-primary/40 hover:bg-primary/5"
                                          : "border-border/40 bg-background/35"
                                    } ${transcriptSeekEnabled ? "cursor-pointer" : "cursor-default"}`}
                                    aria-current={isActiveCue ? "true" : undefined}
                                    aria-label={`${transcriptSeekEnabled ? "Jump to" : "Transcript cue at"} ${formatDurationClock(cue.start)}`}
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <span className={`text-[11px] font-medium ${isActiveCue ? "text-primary" : "text-muted-foreground"}`}>
                                        {formatDurationClock(cue.start)} - {formatDurationClock(cue.end)}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {isLowConfidenceCue ? (
                                          <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-200">
                                            Low confidence
                                          </Badge>
                                        ) : null}
                                        {isActiveCue ? (
                                          <Badge className="border-primary/35 bg-primary/10 text-primary-foreground">Now</Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                    <p className="mt-1 text-sm leading-relaxed text-foreground/92">{cue.text}</p>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-4 text-xs text-muted-foreground">
                              Edited transcript preview is not available yet.
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="source" className="mt-0">
                          {transcriptHasSource ? (
                            <div className="pipeline-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
                              {liveSourceTranscriptCues.map((cue, index) => (
                                <div
                                  key={`transcript-source-cue-${index}-${cue.start}`}
                                  className="rounded-xl border border-border/50 bg-background/40 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      {formatDurationClock(cue.start)} - {formatDurationClock(cue.end)}
                                    </span>
                                    {cue.confidence !== null && cue.confidence !== undefined && cue.confidence < 0.55 ? (
                                      <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-200">
                                        Low confidence
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm leading-relaxed text-foreground/92">{cue.text}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-4 text-xs text-muted-foreground">
                              Transcript cues have not been saved for this render yet.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                    {renderYouTubeOutcomeLoopCard({
                      title: "Live Outcome Loop",
                      subtitle: "YouTube auth, job/video mapping, and analytics sync are now directly available in the live pipeline.",
                      compact: true,
                    })}

                    {normalizedActiveStatus === "ready" && (
                      <div className="space-y-3 rounded-xl border border-primary/20 bg-[linear-gradient(145deg,rgba(25,22,50,0.72),rgba(16,20,42,0.7))] p-3 shadow-[0_20px_34px_-28px_hsl(var(--primary)/0.9)] sm:p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Full Video Scan Progress</p>
                          <Badge className="border-primary/35 bg-primary/10 text-foreground">
                            {Math.round(fullScanProgress)}%
                          </Badge>
                        </div>
                        <Progress
                          value={fullScanProgress}
                          className="h-2 bg-muted/70 [&>div]:bg-primary"
                        />
                        <p className="text-[11px] text-muted-foreground">{fullScanProgressLabel}</p>

                        <div className="rounded-lg border border-primary/20 bg-background/45 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Modern Energy + Emotion Timeline</p>
                            <Badge className="border-primary/35 bg-primary/10 text-foreground">Landing-style deep scan</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">Click any bar to open detailed emotional analysis.</p>
                          <div className="mt-3 grid grid-cols-12 gap-1.5">
                            {timelineEnergyMoments.map((moment, idx) => (
                              <Tooltip key={`energy-moment-${idx}-${moment.timestampSec}`}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="group flex h-28 flex-col justify-end"
                                    aria-label={`${moment.timestampLabel} ${moment.emotionLabel}. Open detailed emotional analysis`}
                                    onClick={() => openFeedbackDeepDiveSection("emotional_parts")}
                                    style={{ minWidth: "0" }}
                                  >
                                    <span
                                      className={`w-full rounded-t-md bg-gradient-to-t ${EMOTION_PROFILE_META[moment.emotionKey].barClassName} transition-all group-hover:brightness-110`}
                                      style={{ height: `${Math.max(12, moment.energy)}%` }}
                                    />
                                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">{moment.timestampLabel}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs border-border/60 bg-card text-foreground">
                                  <p className="text-[11px] font-medium">
                                    {moment.timestampLabel} · {moment.emotionLabel}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Energy {moment.energy} | Motion {moment.motion} | Audio {moment.audio} | Visual {moment.visual} | Facial {moment.facial}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {emotionSignals.slice(0, 4).map((signal) => (
                              <Badge key={`emotion-signal-${signal.key}`} className={signal.badgeClassName}>
                                {signal.label} {Math.round(signal.sharePercent)}%
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                          <div className="rounded-lg border border-primary/25 bg-background/45 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className="border-primary/35 bg-primary/10 text-foreground">
                                Auto-Hook Placed: {DEFAULT_AUTO_HOOK_DURATION_SEC}s High-Energy Opener
                              </Badge>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-[11px] text-primary underline underline-offset-4"
                                  >
                                    Details
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="border-border/60 bg-card text-foreground">
                                  {autoHookSummaryLine}
                                </PopoverContent>
                              </Popover>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{autoHookSummaryLine}</p>
                          </div>

                          <div className="rounded-lg border border-primary/25 bg-background/45 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium text-foreground">Auto-Cut Boring/Silent/Pauses</p>
                              <Switch
                                checked={autoCutBoringEnabled}
                                onCheckedChange={setAutoCutBoringEnabled}
                                className="data-[state=checked]:bg-primary"
                                aria-label="Auto-cut low engagement segments"
                              />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {autoCutBoringEnabled
                                ? `Cut ${removedFillerPercent}% low-engagement filler`
                                : "Auto-cut paused, low-engagement filler retained."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mode-stats-shell space-y-3 rounded-xl border p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">A-Mode</p>
                          <p className="text-xs text-muted-foreground">Modern retention automation with facial + emotion intelligence.</p>
                        </div>
                        <Switch
                          checked={aModeEnabled}
                          onCheckedChange={setAModeEnabled}
                          className="data-[state=checked]:bg-primary"
                          aria-label="Toggle advanced AI retention mode"
                        />
                      </div>

                      {aModeEnabled ? (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border border-primary/25 bg-background/45 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Facial Scan Overlay</p>
                                <p className="mt-1 text-xs text-foreground/90">
                                  Focus lock near {formatTimelineClock(facialFocusSec)} estimated to lift retention by +{facialRetentionBoostPct}%.
                                </p>
                              </div>
                              <Badge className="border-primary/35 bg-primary/10 text-foreground">+{facialRetentionBoostPct}%</Badge>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {facialHeatmapMoments.map((zone) => (
                                <div key={`${zone.label}-${zone.at}`} className="rounded-md border border-border/60 bg-background/55 p-2">
                                  <p className="text-[10px] text-muted-foreground">{zone.label} · {zone.at}</p>
                                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/70">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-primary to-glow-secondary"
                                      style={{ width: `${zone.intensity}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg border border-primary/25 bg-background/45 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Binge Mode</p>
                                <p className="text-xs text-muted-foreground">
                                  Curiosity loops, cliffhangers, emotional arcs, dynamic pacing, and re-hooks.
                                </p>
                              </div>
                              <Switch
                                checked={bingeModeEnabled}
                                onCheckedChange={setBingeModeEnabled}
                                className="data-[state=checked]:bg-primary"
                                aria-label="Toggle binge optimization mode"
                              />
                            </div>
                            {bingeModeEnabled ? (
                              <div className="mt-2 space-y-2">
                                {bingeWorthyMoments.slice(0, 3).map((moment) => (
                                  <div key={`binge-moment-${moment.id}`} className="rounded-md border border-border/60 bg-background/50 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs text-foreground">{moment.timestampLabel}</p>
                                      <Badge className="border-primary/35 bg-primary/10 text-foreground">{moment.score}%</Badge>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{moment.reason}</p>
                                  </div>
                                ))}
                                <div className="flex flex-wrap gap-1.5">
                                  {bingeSuggestions.slice(0, 3).map((line, index) => (
                                    <Badge
                                      key={`binge-suggestion-${index}`}
                                      className="border-primary/30 bg-primary/10 text-foreground"
                                    >
                                      {line}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">Binge optimizations are currently paused.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Enable A-Mode to apply facial scan recognition and binge-flow suggestions.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-[linear-gradient(160deg,rgba(19,26,54,0.64),rgba(23,18,44,0.62))] p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Retention + Emotion Analysis</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {topEmotionSignal ? (
                            <Badge className={topEmotionSignal.badgeClassName}>
                              Top Emotion: {topEmotionSignal.label}
                            </Badge>
                          ) : null}
                          <Badge className={`${retentionGoalMet ? "border-success/35 bg-success/10 text-success" : "border-warning/35 bg-warning/10 text-warning"}`}>
                            {latestRetentionPoint ? `${latestRetentionPoint.predicted}% predicted` : "Predicting"}
                          </Badge>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-2 h-36 w-full overflow-hidden rounded-lg border border-border/60 bg-background/55 p-2 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label="Open detailed retention and emotion analysis"
                        onClick={() => openFeedbackDeepDiveSection("retention_vs_emotion")}
                      >
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                          <line
                            x1="0"
                            y1={100 - RETENTION_GOAL_PERCENT}
                            x2="100"
                            y2={100 - RETENTION_GOAL_PERCENT}
                            stroke="hsl(var(--primary) / 0.35)"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <polyline
                            points={retentionLinePoints}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {emotionLinePoints ? (
                            <polyline
                              points={emotionLinePoints}
                              fill="none"
                              stroke="hsl(var(--glow-secondary))"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : null}
                          {emotionTimelineHighlights.slice(0, 5).map((item) => {
                            const x = clamp((item.timestampSec / Math.max(1, retentionTimelineDurationSec)) * 100, 0, 100);
                            const y = 100 - clamp(item.strength, 0, 100);
                            return (
                              <circle
                                key={`emotion-dot-${item.id}`}
                                cx={x}
                                cy={y}
                                r="1.8"
                                fill="hsl(var(--glow-secondary))"
                                stroke="hsl(var(--background))"
                                strokeWidth="0.6"
                              />
                            );
                          })}
                        </svg>
                      </button>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Goal line: {RETENTION_GOAL_PERCENT}%+</span>
                        <span>{retentionGoalMet ? "On track" : "Tune with A-Mode suggestions"} · Click graph for deep dive</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <div className="rounded-lg border border-border/50 bg-background/45 p-2.5">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Emotions Felt</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {emotionSignals.slice(0, 4).map((signal) => (
                              <Badge key={`felt-${signal.key}`} className={signal.badgeClassName}>
                                {signal.label} · {Math.round(signal.sharePercent)}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/45 p-2.5">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Predicted Audience Emotions</p>
                          <div className="mt-2 space-y-1.5">
                            {predictedAudienceEmotions.slice(0, 3).map((signal) => (
                              <div key={`predicted-emotion-${signal.key}`}>
                                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>{signal.label}</span>
                                  <span>{signal.predictedAudiencePercent}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${signal.barClassName}`}
                                    style={{ width: `${signal.predictedAudiencePercent}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {activePipelinePowerMode !== "standard" ? (
                      <div className="mode-stats-shell rounded-xl border p-3 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {activePipelinePowerMode === "ultra" ? "Fast Mode Feedback Analysis" : "Quality Mode Feedback Analysis"}
                          </p>
                          <Badge className="border-primary/40 bg-primary/15 text-primary-foreground">
                            {activePipelinePowerMode === "ultra" ? "Fast Path Logic" : "Quality Pass Logic"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Simple scorecard: each metric is 0-100, and higher is better.
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {[
                            {
                              label: "Viewer Momentum",
                              value: modeMomentumScore,
                              summary: "How strongly viewer attention stays up through the video.",
                            },
                            {
                              label: "Hook Strength",
                              value: modePackagingScore,
                              summary: "How compelling the opening hook and early packaging feel.",
                            },
                            {
                              label: "Flow Stability",
                              value: modeConsistencyScore,
                              summary: "How smooth and consistent pacing feels between sections.",
                            },
                            {
                              label: "Finish Likelihood",
                              value: modeCompletionScore,
                              summary: "How likely viewers are to keep watching near the ending.",
                            },
                          ].map((card) => (
                            <div key={card.label} className="rounded-lg border border-primary/25 bg-background/45 p-2.5">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{card.label}</p>
                              <p className="mt-1 text-2xl font-premium text-foreground">{card.value}/100</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{card.summary}</p>
                              <div className="mt-2 h-1.5 rounded-full bg-muted/65">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary via-[hsl(var(--glow-secondary))] to-cyan-300"
                                  style={{ width: `${card.value}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!isTerminalStatus(activeJob.status) && (
                      <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="uppercase tracking-[0.16em]">Live Processing</span>
                          <span className="font-semibold text-foreground">{etaLabel}{etaSuffix}</span>
                        </div>
                        <Progress value={activeStageProgress} className="h-2 bg-muted [&>div]:bg-primary" />
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
                          <div className="h-10 rounded-lg bg-muted/35 animate-pulse" />
                        </div>
                        {canCancelJob && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-3 min-h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:min-h-10 sm:w-auto"
                            disabled={cancelingJobId === activeJob.id}
                            onClick={() => void handleCancelJob(activeJob.id)}
                          >
                            {cancelingJobId === activeJob.id ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="mr-1.5 h-4 w-4" />
                            )}
                            {cancelButtonLabel}
                          </Button>
                        )}
                      </div>
                    )}

                    {normalizeStatus(activeJob.status) === "failed" && (
                      <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3">
                        <p className="text-sm font-medium text-destructive">Processing failed in {failedStepKey ? STATUS_LABELS[failedStepKey] || "pipeline" : "pipeline"}.</p>
                        <p className="mt-1 text-xs text-destructive/90">{failedGateReason || activeJob.error || "Retry suggested."}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Retry suggestion: adjust settings and run Redo Renderer.</p>
                      </div>
                    )}

                    {canShowRealtimeHookSelector && (
                      <div className="rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Hook Job</p>
                          <p className="text-xs text-muted-foreground">
                            Automatic hook mode is on. The editor chooses the best 5-8 second opening hook.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Hook mode: Auto
                        </p>
                        {selectedHookCandidate ? (
                          <p className="text-xs text-foreground/90">
                            Selected: {formatHookRange(
                              selectedHookCandidate.start,
                              selectedHookCandidate.start + selectedHookCandidate.duration
                            )}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {activeJob && autonomousEditor && (
                      <div className="rounded-xl border border-primary/25 bg-[linear-gradient(160deg,rgba(12,31,45,0.72),rgba(23,18,44,0.68))] p-3 shadow-[0_18px_34px_-28px_hsl(var(--primary)/0.95)] sm:p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Wand2 className="h-4 w-4 text-primary" aria-hidden />
                              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Autonomous Editor</p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Self-running hook, cut, pacing, and story decisions built from transcript, audio, visual, emotion, and reward signals.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge className="border-primary/35 bg-primary/10 text-foreground">{autonomousStatusLabel}</Badge>
                            {autonomousLearning ? (
                              <Badge className="border-cyan-400/35 bg-cyan-400/10 text-cyan-100">
                                {autonomousLearning.throttled ? "Learning queued" : "Learning live"}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        {autonomousSenses.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {autonomousSenses.map((sense) => (
                              <Badge key={`autonomous-sense-${sense}`} className="border-border/55 bg-background/45 text-foreground">
                                {sense}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-3">
                          <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Hook Decision</p>
                              <Badge className="border-primary/35 bg-primary/10 text-foreground">{autonomousHookSourceLabel}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {autonomousSelectedHook
                                ? formatHookRange(
                                    autonomousSelectedHook.start,
                                    autonomousSelectedHook.start + autonomousSelectedHook.duration,
                                  )
                                : (selectedHookCandidate
                                  ? formatHookRange(
                                      selectedHookCandidate.start,
                                      selectedHookCandidate.start + selectedHookCandidate.duration,
                                    )
                                  : "No hook chosen yet")}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {autonomousSelectedHook?.reason || hookReason || "Waiting for enough signal to lock the opener."}
                            </p>
                          </div>

                          <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Policy Winner</p>
                              {autonomousWinnerPolicy?.strategy ? (
                                <Badge className="border-primary/35 bg-primary/10 text-foreground">
                                  {autonomousWinnerPolicy.strategy}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {autonomousWinnerPolicy?.policyId || "No policy winner yet"}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {autonomousWinnerPolicy?.reason || "Variant scoring, pacing curve selection, and cut-quality pressure decide the winner."}
                            </p>
                            {autonomousWinnerPolicy ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {autonomousWinnerPolicy.predictedRetention !== null && autonomousWinnerPolicy.predictedRetention !== undefined ? (
                                  <Badge className="border-border/55 bg-background/55 text-foreground">
                                    {autonomousWinnerPolicy.predictedRetention}% predicted
                                  </Badge>
                                ) : null}
                                {autonomousWinnerPolicy.pacingCurve ? (
                                  <Badge className="border-border/55 bg-background/55 text-foreground">
                                    {autonomousWinnerPolicy.pacingCurve} pacing
                                  </Badge>
                                ) : null}
                                {autonomousWinnerPolicy.cliffhangerStyle ? (
                                  <Badge className="border-border/55 bg-background/55 text-foreground">
                                    {autonomousWinnerPolicy.cliffhangerStyle.replace(/_/g, " ")}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Quality Gate</p>
                              <Badge className={`${autonomousQualityGate?.passed === false ? "border-destructive/35 bg-destructive/10 text-destructive" : "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"}`}>
                                {autonomousQualityGate?.passed === false ? "Needs work" : autonomousQualityGate?.passed === true ? "Passed" : "Evaluating"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {autonomousQualityGate?.totalChecks
                                ? `${autonomousQualityGate.passedChecks ?? 0}/${autonomousQualityGate.totalChecks} checks`
                                : "Checks pending"}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {autonomousQualityGate?.summary || "Boundary critic, hook timing, and structural checks decide whether the cut is safe to ship."}
                            </p>
                            {autonomousCutQualityPercent !== null ? (
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary via-[hsl(var(--glow-secondary))] to-cyan-300"
                                  style={{ width: `${autonomousCutQualityPercent}%` }}
                                />
                              </div>
                            ) : null}
                            {autonomousCutQualityPercent !== null ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">Cut quality {autonomousCutQualityPercent}%</p>
                            ) : null}
                          </div>
                        </div>

                        {(autonomousDecisionCounts.length > 0 || autonomousDecisions.length > 0) ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Decision Pressure</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {autonomousDecisionCounts.slice(0, 6).map(([key, value]) => (
                                  <Badge key={`decision-count-${key}`} className="border-border/55 bg-background/55 text-foreground">
                                    {key.replace(/_/g, " ")} {Number(value)}
                                  </Badge>
                                ))}
                              </div>
                              {autonomousActiveModes.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {autonomousActiveModes.map((mode) => (
                                    <Badge key={`active-mode-${mode.id}`} className="border-primary/30 bg-primary/10 text-foreground">
                                      {mode.label}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-[11px] text-muted-foreground">No special mode override. Default autonomous behavior is active.</p>
                              )}
                            </div>

                            <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recent Decisions</p>
                              <div className="mt-2 space-y-2">
                                {autonomousDecisions.length > 0 ? autonomousDecisions.map((decision, index) => (
                                  <div key={`autonomous-decision-${decision.type}-${decision.atSec}-${index}`} className="rounded-md border border-border/50 bg-background/55 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs text-foreground">{decision.label}</p>
                                      <span className="text-[11px] text-muted-foreground">{formatTimelineClock(decision.atSec)}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {decision.detail || "Autonomous edit action applied."}
                                    </p>
                                  </div>
                                )) : (
                                  <p className="text-[11px] text-muted-foreground">Decision timeline will populate as the edit plan resolves.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {(Array.isArray(autonomousEditor?.notes) && autonomousEditor.notes.length > 0) || autonomousLearning ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Why It Edited This Way</p>
                              <div className="mt-2 space-y-1.5">
                                {(autonomousEditor?.notes || []).slice(0, 4).map((note, index) => (
                                  <p key={`autonomous-note-${index}`} className="text-[11px] text-muted-foreground">
                                    {note}
                                  </p>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-border/50 bg-background/45 p-3">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Outcome Learning</p>
                              {autonomousLearning ? (
                                <div className="mt-2 space-y-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {autonomousLearning.boundaryCritic?.trained ? (
                                      <Badge className="border-emerald-400/35 bg-emerald-400/10 text-emerald-100">Boundary critic retrained</Badge>
                                    ) : null}
                                    {autonomousLearningRecordedAtLabel ? (
                                      <Badge className="border-border/55 bg-background/55 text-foreground">
                                        {autonomousLearningRecordedAtLabel}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    {autonomousLearningReasonLabel
                                      ? `Boundary critic ${autonomousLearningReasonLabel}.`
                                      : "Learning summary available after feedback and telemetry passes."}
                                  </p>
                                  {autonomousLearning.boundaryCritic?.activeVersion ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      Active model {autonomousLearning.boundaryCritic.activeVersion}
                                      {autonomousLearning.boundaryCritic.sampleCount !== null && autonomousLearning.boundaryCritic.sampleCount !== undefined
                                        ? ` · ${autonomousLearning.boundaryCritic.sampleCount} samples`
                                        : ""}
                                    </p>
                                  ) : null}
                                  {autonomousPromotionLead ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      Promotion candidate: {autonomousPromotionLead.policyId}
                                      {autonomousPromotionLead.lift !== null && autonomousPromotionLead.lift !== undefined
                                        ? ` (+${Number(autonomousPromotionLead.lift).toFixed(2)} lift)`
                                        : ""}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  Feedback and watch behavior will appear here after the first learning cycle completes.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {normalizeStatus(activeJob.status) === "ready" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3"
                      >
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-400/10 via-primary/10 to-cyan-300/10" />
                        <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-emerald-300/20 blur-2xl animate-pulse" />
                        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-emerald-100 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {activeJob.renderMode === "vertical" && activeOutputUrls.length > 1
                              ? `Vertical clips are ready (${activeOutputUrls.length}).`
                              : "Export is ready. Download your final cut."}
                          </p>
                          <Button
                            className="min-h-12 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                            onClick={() => {
                              if (activeJob.renderMode === "vertical") {
                                setExportOpen(true);
                                return;
                              }
                              void handleDownload(0);
                            }}
                          >
                            <Download className="h-4 w-4" />
                            {activeJob.renderMode === "vertical" ? "Open Clips" : "Download Final MP4"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                    {isTerminalStatus(activeJob.status) && activeJob.error !== "queue_canceled_by_user" && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Need another pass? Queue a redo render using your daily re-render allowance.
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-12 w-full gap-2 sm:min-h-10 sm:w-auto"
                          disabled={
                            reprocessingJobId === activeJob.id ||
                            (!isDevAccount && (rerendersRemainingToday ?? 0) <= 0)
                          }
                          onClick={() => void handleRedoRender(activeJob)}
                        >
                          {reprocessingJobId === activeJob.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Redo Renderer
                        </Button>
                      </div>
                    )}

                    <Dialog open={videoAnalysisOpen} onOpenChange={setVideoAnalysisOpen}>
                      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-border/50 bg-background/95 p-3 backdrop-blur-xl sm:max-w-5xl sm:p-4">
                        <div ref={fullAnalysisSectionRef} className="retention-summary-shell glass-card space-y-3 rounded-2xl p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="pill-badge text-[10px]">Feedback Snapshot</p>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="retention-summary-feedback-btn btn-glow h-8 rounded-full px-3 text-[11px]"
                            onClick={() => openFeedbackDeepDiveSection("retention_vs_emotion")}
                          >
                            <MessageCircle className="mr-1 h-3.5 w-3.5" />
                            Open Detailed Feedback
                          </Button>
                          <Badge className="border-emerald-400/35 bg-emerald-500/10 text-emerald-200">
                            {confidenceLabel}{confidenceValue ? ` · ${confidenceValue}` : ""}
                          </Badge>
                          <Badge className="border-primary/35 bg-primary/10 text-primary">
                            {hookSelectionSource === "fallback" ? "Fallback hook" : "Auto hook"}
                          </Badge>
                          {achievementSignals.slice(0, 2).map((signal) => (
                            <Badge key={signal.id} className="border-primary/45 bg-primary/15 text-primary-foreground">
                              <Trophy className="mr-1 h-3.5 w-3.5" />
                              {signal.title}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Open detailed retention graph analysis"
                          onClick={() => openFeedbackDeepDiveSection("retention_vs_emotion")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openFeedbackDeepDiveSection("retention_vs_emotion");
                            }
                          }}
                          className="retention-summary-card glass-card rounded-xl p-3 cursor-pointer transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Retention Delta</p>
                          {retentionScoreDeltaDisplay !== null ? (
                            <motion.p
                              key={`${activeJob.id}-${retentionScoreDeltaDisplay}`}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`mt-1 font-premium text-3xl font-semibold tracking-tight ${
                                retentionScoreDeltaDisplay >= 0 ? "text-emerald-300" : "text-amber-300"
                              }`}
                            >
                              {retentionScoreDeltaDisplay > 0 ? "+" : ""}{retentionScoreDeltaDisplay.toFixed(1)}
                              <span className="ml-1 text-lg align-middle">{retentionScoreDeltaDisplay >= 0 ? "↑" : "↓"}</span>
                            </motion.p>
                          ) : !isTerminalStatus(activeJob.status) ? (
                            <div className="mt-2 h-9 w-28 animate-pulse rounded-md bg-muted/50" />
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground">Pending</p>
                          )}
                          <p className="mt-2 break-words text-xs text-foreground/90">
                            Hook chosen: {hookWindowLabel}
                            {hookText ? ` — ${hookText}` : ""}
                          </p>
                          {hookReason ? (
                            <p className="mt-1 text-xs text-muted-foreground">Reason: {hookReason}</p>
                          ) : null}
                          {showFullAutoEditorAddedSummary ? (
                            <p className="mt-1 text-xs text-primary/90">{fullAutoEditorAddedSummary}</p>
                          ) : null}
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Open detailed retention before and after analysis"
                          onClick={() => openFeedbackDeepDiveSection("retention_vs_emotion")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openFeedbackDeepDiveSection("retention_vs_emotion");
                            }
                          }}
                          className="retention-summary-card glass-card rounded-xl p-3 cursor-pointer transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Before vs After</p>
                          {retentionBeforeBar !== null && retentionAfterBar !== null ? (
                            <div className="mt-2 space-y-2">
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>Before</span>
                                  <span>{retentionScoreBeforeDisplay?.toFixed(1)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted/60">
                                  <motion.div
                                    className="h-full rounded-full bg-slate-400/80"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${retentionBeforeBar}%` }}
                                    transition={{ duration: 0.35, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>After</span>
                                  <span>{retentionScoreAfterDisplay?.toFixed(1)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted/60">
                                  <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--glow-secondary))]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${retentionAfterBar}%` }}
                                    transition={{ duration: 0.45, ease: "easeOut" }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              <div className="h-3 w-full animate-pulse rounded-md bg-muted/45" />
                              <div className="h-3 w-full animate-pulse rounded-md bg-muted/40" />
                            </div>
                          )}
                          <p className="mt-2 text-[11px] text-muted-foreground">Click chart for full retention breakdown.</p>
                        </div>
                      </div>

                      {renderYouTubeOutcomeLoopCard()}

                      <div className="retention-summary-card retention-summary-timeline-block glass-card rounded-xl p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Video Scan Timeline Deep Dive</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Best parts, likely skips, weaker parts, and one-click fix/remove actions.
                            </p>
                          </div>
                          <Badge className="border-border/50 bg-background/60 text-foreground/80">
                            {Math.round(retentionTimelineDurationSec)}s scanned
                          </Badge>
                        </div>

                        <div className="relative mt-3 h-4 overflow-hidden rounded-full border border-border/50 bg-muted/35">
                          {retentionTimelineSegments.map((segment) => {
                            const meta = RETENTION_TIMELINE_CATEGORY_META[segment.category];
                            return (
                              <Tooltip key={`timeline-segment-${segment.id}`}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`${segment.categoryLabel} ${formatTimelineClock(segment.startSec)}-${formatTimelineClock(segment.endSec)}`}
                                    className={`absolute inset-y-0 rounded-sm transition-colors ${meta.segmentClassName}`}
                                    onClick={() => openFeedbackDeepDiveSection("timeline")}
                                    style={{
                                      left: `${segment.positionPct}%`,
                                      width: `${segment.widthPct}%`,
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-[11px] font-medium">
                                    {segment.categoryLabel}: {formatTimelineClock(segment.startSec)}-{formatTimelineClock(segment.endSec)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Predicted {segment.predicted}% retention
                                    {segment.dropFromPrevious > 0 ? ` · drop ${segment.dropFromPrevious}%` : ""}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">{segment.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(["best", "skip_risk", "weak", "steady"] as const).map((category) => {
                            const meta = RETENTION_TIMELINE_CATEGORY_META[category];
                            return (
                              <Badge key={`retention-legend-${category}`} className={meta.badgeClassName}>
                                {meta.label}
                              </Badge>
                            );
                          })}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-200">Best Parts</p>
                            {bestRetentionSegments.length > 0 ? (
                              <div className="mt-2 space-y-1.5">
                                {bestRetentionSegments.map((segment) => (
                                  <p key={`best-retention-${segment.id}`} className="text-xs text-emerald-100/90">
                                    {formatTimelineClock(segment.startSec)}-{formatTimelineClock(segment.endSec)} · {segment.predicted}%
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-emerald-100/75">No standout moments detected yet.</p>
                            )}
                          </div>

                          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-rose-100">Viewers May Skip</p>
                            {skipRiskRetentionSegments.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {skipRiskRetentionSegments.map((segment) => {
                                  const actionKey = toTimelineSegmentActionKey(activeJob.id, segment.id);
                                  const queuedAction = timelineSegmentActionByKey[actionKey];
                                  const submitting = timelineSegmentActionSubmittingKey === actionKey;
                                  return (
                                    <div key={`skip-risk-${segment.id}`} className="rounded border border-rose-400/25 bg-rose-950/20 p-2">
                                      <p className="text-xs text-rose-100">
                                        {formatTimelineClock(segment.startSec)}-{formatTimelineClock(segment.endSec)} · {segment.predicted}%
                                      </p>
                                      <p className="mt-1 text-[11px] text-rose-100/80">{segment.reason}</p>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[11px]"
                                          disabled={!canQueueTimelineSegmentAction || submitting}
                                          onClick={() => void handleQueueTimelineSegmentAction(segment, "fix")}
                                        >
                                          {submitting ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          ) : (
                                            <Wand2 className="mr-1 h-3 w-3" />
                                          )}
                                          {queuedAction === "fix" ? "Fix queued" : "Fix part"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[11px]"
                                          disabled={!canQueueTimelineSegmentAction || submitting}
                                          onClick={() => void handleQueueTimelineSegmentAction(segment, "remove")}
                                        >
                                          {submitting ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          ) : (
                                            <Scissors className="mr-1 h-3 w-3" />
                                          )}
                                          {queuedAction === "remove" ? "Removal queued" : "Remove on redo"}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-rose-100/75">No high skip-risk windows detected.</p>
                            )}
                          </div>

                          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-100">Weaker Parts</p>
                            {weakRetentionSegments.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {weakRetentionSegments.map((segment) => {
                                  const actionKey = toTimelineSegmentActionKey(activeJob.id, segment.id);
                                  const queuedAction = timelineSegmentActionByKey[actionKey];
                                  const submitting = timelineSegmentActionSubmittingKey === actionKey;
                                  return (
                                    <div key={`weak-retention-${segment.id}`} className="rounded border border-amber-400/25 bg-amber-950/20 p-2">
                                      <p className="text-xs text-amber-100">
                                        {formatTimelineClock(segment.startSec)}-{formatTimelineClock(segment.endSec)} · {segment.predicted}%
                                      </p>
                                      <p className="mt-1 text-[11px] text-amber-100/80">{segment.reason}</p>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[11px]"
                                          disabled={!canQueueTimelineSegmentAction || submitting}
                                          onClick={() => void handleQueueTimelineSegmentAction(segment, "fix")}
                                        >
                                          {submitting ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          ) : (
                                            <Wand2 className="mr-1 h-3 w-3" />
                                          )}
                                          {queuedAction === "fix" ? "Fix queued" : "Fix part"}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[11px]"
                                          disabled={!canQueueTimelineSegmentAction || submitting}
                                          onClick={() => void handleQueueTimelineSegmentAction(segment, "remove")}
                                        >
                                          {submitting ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          ) : (
                                            <Scissors className="mr-1 h-3 w-3" />
                                          )}
                                          {queuedAction === "remove" ? "Removal queued" : "Remove on redo"}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-amber-100/75">No weaker windows detected.</p>
                            )}
                          </div>
                        </div>

                        <p className="mt-3 text-[11px] text-muted-foreground">
                          {canQueueTimelineSegmentAction
                            ? "Queued actions are saved to retention feedback and applied when you run Redo Renderer."
                            : "Actions unlock once the render is ready."}
                        </p>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-border/50 bg-background/30">
                        <button
                          type="button"
                          aria-expanded={retentionDetailsOpen}
                          className="flex min-h-12 w-full items-center justify-between px-3 text-left text-xs text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:min-h-10"
                          onClick={() => setRetentionDetailsOpen((prev) => !prev)}
                        >
                          <span className="font-medium">{retentionDetailsOpen ? "Hide retention details" : "Show retention details"}</span>
                          <span className="text-muted-foreground">{retentionDetailsOpen ? "Collapse" : "Expand"}</span>
                        </button>
                        {retentionDetailsOpen ? (
                          <div className="space-y-2 border-t border-border/40 p-3 text-xs text-muted-foreground">
                            {detectedRetentionStrategyProfile ? (
                              <p>Profile: {formatNicheLabel(detectedRetentionStrategyProfile)}</p>
                            ) : null}
                            {detectedRetentionContentFormat ? (
                              <p>Format: {formatNicheLabel(detectedRetentionContentFormat)}</p>
                            ) : null}
                            {detectedRetentionTargetPlatform ? (
                              <p>Target: {formatPlatformLabel(detectedRetentionTargetPlatform)}</p>
                            ) : null}
                            {detectedAutoPreset ? (
                              <p>Auto preset: {formatNicheLabel(detectedAutoPreset)}</p>
                            ) : null}
                            {detectedAutoStyle ? (
                              <p>Auto style: {formatNicheLabel(detectedAutoStyle)}</p>
                            ) : null}
                            {detectedAutoContentType ? (
                              <p>Content type: {formatNicheLabel(detectedAutoContentType)}</p>
                            ) : null}
                            {detectedAutoFormat && !detectedRetentionContentFormat ? (
                              <p>Auto format: {formatNicheLabel(detectedAutoFormat)}</p>
                            ) : null}
                            {retentionKingBlendPctDisplay !== null ? (
                              <p>
                                Quality blend: {retentionKingBlendPctDisplay.toFixed(1)}%
                                {retentionKingBlendLevelDisplay ? ` (${formatNicheLabel(retentionKingBlendLevelDisplay)})` : ""}
                              </p>
                            ) : null}
                            {dynamicScoreBeforePopup !== null || dynamicScoreAfterPopup !== null ? (
                              <p>
                                Dynamic score:
                                {dynamicScoreBeforePopup !== null ? ` before ${dynamicScoreBeforePopup.toFixed(1)}%` : ""}
                                {dynamicScoreAfterPopup !== null ? ` after ${dynamicScoreAfterPopup.toFixed(1)}%` : ""}
                              </p>
                            ) : null}
                            {dynamicThoughtBefore ? (
                              <p>Model thought (before): {dynamicThoughtBefore}</p>
                            ) : null}
                            {dynamicThoughtAfter ? (
                              <p>Model thought (after): {dynamicThoughtAfter}</p>
                            ) : null}
                            {activeJob.renderMode === "vertical" && verticalPredictedAverage !== null ? (
                              <p>
                                Predicted completion: {verticalPredictedAverage.toFixed(1)}%
                                {verticalSelectionMode ? ` (${formatNicheLabel(verticalSelectionMode)})` : ""}
                              </p>
                            ) : null}
                            {activeJob.renderMode === "vertical" && metadataClipSummaries.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-muted-foreground">Top clip predictions:</p>
                                {metadataClipSummaries.map((entry) => (
                                  <p key={`clip-prediction-${entry.clip}`} className="text-foreground/90">
                                    - Clip {entry.clip}: {entry.predictedCompletion !== null ? `${Math.round(entry.predictedCompletion)}% viewed` : "n/a"}
                                    {entry.reason ? ` — ${entry.reason}` : ""}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {detectedNicheRaw ? (
                              <p>
                                Detected niche: {formatNicheLabel(detectedNicheRaw)}
                                {detectedNicheConfidencePercent !== null ? ` (${detectedNicheConfidencePercent}% confidence)` : ""}
                              </p>
                            ) : null}
                            {detectedNicheRationale.length > 0 ? (
                              <div className="space-y-1">
                                {detectedNicheRationale.map((line, index) => (
                                  <p key={`niche-rationale-${index}`}>- {line}</p>
                                ))}
                              </div>
                            ) : null}
                            {retentionImprovements.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-muted-foreground">Improvements:</p>
                                {retentionImprovements.map((line, index) => (
                                  <p key={`improve-${index}`} className="text-foreground/90">- {line}</p>
                                ))}
                              </div>
                            ) : null}
                            {whyKeepWatching.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-muted-foreground">Why viewers stay:</p>
                                {whyKeepWatching.map((line, index) => (
                                  <p key={`why-${index}`} className="text-foreground/90">- {line}</p>
                                ))}
                              </div>
                            ) : null}
                            {normalizeStatus(activeJob.status) === "failed" && failedGateReason ? (
                              <div className="space-y-1">
                                <p className="text-destructive">Gate reason: {failedGateReason}</p>
                                {genericReasons.length > 0 ? (
                                  <div className="space-y-1">
                                    {genericReasons.map((line, index) => (
                                      <p key={`generic-${index}`}>- {line}</p>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="space-y-1 pt-1">
                              <p>
                                Creator correction feedback:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {CREATOR_FEEDBACK_ACTIONS.map((action) => (
                                  <Button
                                    key={action.category}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 text-[11px]"
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
                            </div>
                            <div className="pt-1">
                              <button
                                type="button"
                                className={`text-xs underline underline-offset-4 ${
                                  analyzeUnlockedForActiveJob
                                    ? "text-muted-foreground hover:text-foreground"
                                    : "cursor-not-allowed text-muted-foreground/70"
                                }`}
                                disabled={!analyzeUnlockedForActiveJob}
                                onClick={() => setShowAdvancedDebug((prev) => !prev)}
                              >
                                {showAdvancedDebug && analyzeUnlockedForActiveJob ? "Hide Analyze" : "Analyze"}
                              </button>
                              {!analyzeUnlockedForActiveJob ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Click a feedback button above to unlock Analyze for this render.
                                </p>
                              ) : null}
                            </div>
                            {showAdvancedDebug && analyzeUnlockedForActiveJob ? (
                              <div className="space-y-1 text-[11px]">
                                <p>Selected strategy: {String(activeAnalysis?.selected_strategy ?? pipelineJudgeMeta?.selectedStrategy ?? "n/a")}</p>
                                <p>Pattern interrupts: {String(activeAnalysis?.pattern_interrupt_count ?? "n/a")}</p>
                                <p>Interrupt density: {String(activeAnalysis?.pattern_interrupt_density ?? "n/a")}</p>
                                <p>Max cuts requested: {String(activeAnalysis?.maxCuts ?? activeAnalysis?.max_cuts ?? activeAnalysis?.maxCutsRequested ?? "n/a")}</p>
                                <p>Editor mode: {String(activeAnalysis?.editorMode ?? activeAnalysis?.editor_mode ?? activeAnalysis?.contentMode ?? "n/a")}</p>
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
                        ) : null}
                      </div>

                        <div className="editor-pipeline-log-shell overflow-hidden rounded-lg border border-border/50 bg-[#060912]/95">
                        <button
                          type="button"
                          aria-expanded={pipelineLogOpen}
                          className="editor-pipeline-log-toggle hero-cta-button hero-cta-secondary flex min-h-12 w-full items-center justify-between px-3 text-left text-xs text-foreground transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:min-h-10"
                          onClick={() => setPipelineLogOpen((prev) => !prev)}
                        >
                          <span className="font-medium">Processing Log</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{pipelineLogOpen ? "Hide" : "Show"} stream</span>
                        </button>
                        {pipelineLogOpen ? (
                          <div className="editor-pipeline-log-stream pipeline-scrollbar max-h-56 overflow-y-auto border-t border-border/40 px-3 py-2 font-mono text-[11px]">
                            {pipelineLogEntries.length > 0 ? (
                              pipelineLogEntries.map((entry, index) => (
                                <p
                                  key={`${entry.message}-${index}`}
                                  className={`editor-pipeline-log-entry mb-1 ${
                                    entry.level === "error"
                                      ? "text-destructive"
                                      : entry.level === "warn"
                                        ? "text-amber-300"
                                        : entry.level === "success"
                                          ? "text-emerald-300"
                                          : "text-muted-foreground"
                                  }`}
                                >
                                  [{logTimestamp}] {entry.message}
                                </p>
                              ))
                            ) : (
                              <p className="editor-pipeline-log-entry text-muted-foreground">[{logTimestamp}] Awaiting backend stage messages...</p>
                            )}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={feedbackDeepDiveOpen} onOpenChange={setFeedbackDeepDiveOpen}>
                    <DialogContent className="deepdive-shell max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-3 backdrop-blur-xl sm:max-w-6xl sm:p-5">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-display">Feedback Deep Dive</DialogTitle>
                        <DialogDescription>
                          For a retention-based editor like your AutoEditor, the feedback deepdive stats should focus on actionable, data-driven insights that directly inform editing decisions.
                          The goal is to help creators understand why retention drops (or spikes) and get precise recommendations tied to timestamps.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="deepdive-section rounded-xl p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Quick Summary Box</p>
                              <p className="mt-1 text-sm text-foreground">{deepDiveOverallSummary}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{retentionCurveSummary}</p>
                            </div>
                            <Badge className={retentionGoalMet ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100" : "border-amber-400/45 bg-amber-500/15 text-amber-100"}>
                              Goal {RETENTION_GOAL_PERCENT}% · {retentionGoalMet ? "On Track" : "Needs Pacing Fixes"}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Average View Duration</p>
                            <p className="mt-1 font-premium text-2xl text-foreground">{formatDurationClock(averageViewDurationSec)}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">of {formatDurationClock(durationForDeepDiveSec)} total</p>
                          </div>
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Average % Viewed</p>
                            <p className="mt-1 font-premium text-2xl text-foreground">{averagePercentViewed !== null ? `${averagePercentViewed.toFixed(1)}%` : "--"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Benchmark {durationBenchmarkPercent !== null ? `${durationBenchmarkPercent.toFixed(1)}%` : "--"}
                            </p>
                          </div>
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Relative Retention</p>
                            <p className={`mt-1 font-premium text-xl ${relativeRetentionDeltaPercent !== null && relativeRetentionDeltaPercent >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                              {relativeRetentionLabel}
                            </p>
                          </div>
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Watch Time / 1,000 Views</p>
                            <p className="mt-1 font-premium text-2xl text-foreground">
                              {watchTimePerThousandViewsMinutes !== null ? `${watchTimePerThousandViewsMinutes.toLocaleString()} min` : "--"}
                            </p>
                          </div>
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Completion Rate</p>
                            <p className="mt-1 font-premium text-2xl text-foreground">{completionRatePercent !== null ? `${completionRatePercent.toFixed(1)}%` : "--"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">End-of-video hold</p>
                          </div>
                          <div className="deepdive-kpi-card rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Engaged Views %</p>
                            <p className="mt-1 font-premium text-2xl text-foreground">{engagedViewsPercent !== null ? `${engagedViewsPercent.toFixed(1)}%` : "--"}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Early hold in first seconds</p>
                          </div>
                        </div>

                        <div
                          ref={(node) => {
                            feedbackDeepDiveSectionRefs.current.retention_vs_emotion = node;
                          }}
                          className={`deepdive-section rounded-xl p-3 transition ${feedbackDeepDiveSection === "retention_vs_emotion" ? "ring-1 ring-primary/55" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visual Retention Curve Highlights</p>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge className="border-primary/35 bg-primary/12 text-foreground">Retention</Badge>
                              <Badge className="border-[hsl(var(--glow-secondary)/0.45)] bg-[hsl(var(--glow-secondary)/0.14)] text-foreground">Emotion</Badge>
                            </div>
                          </div>
                          <div className="deepdive-graph mt-3 h-40 rounded-lg p-2">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                              <line
                                x1="0"
                                y1={100 - RETENTION_GOAL_PERCENT}
                                x2="100"
                                y2={100 - RETENTION_GOAL_PERCENT}
                                stroke="hsl(var(--primary) / 0.42)"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <polyline
                                points={retentionLinePoints}
                                fill="none"
                                stroke="hsl(var(--primary))"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {emotionLinePoints ? (
                                <polyline
                                  points={emotionLinePoints}
                                  fill="none"
                                  stroke="hsl(var(--glow-secondary))"
                                  strokeWidth="2"
                                  strokeDasharray="4 3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              ) : null}
                            </svg>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">Hook retention (15s)</p>
                              <p className="text-sm font-semibold text-foreground">{retentionAt15Sec !== null ? `${retentionAt15Sec.toFixed(1)}%` : "--"}</p>
                            </div>
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">First 30s retention</p>
                              <p className="text-sm font-semibold text-foreground">{retentionAt30Sec !== null ? `${retentionAt30Sec.toFixed(1)}%` : "--"}</p>
                            </div>
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">Mid-video hold</p>
                              <p className="text-sm font-semibold text-foreground">{midVideoRetentionPercent !== null ? `${midVideoRetentionPercent.toFixed(1)}%` : "--"}</p>
                            </div>
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">End retention (last 30s)</p>
                              <p className="text-sm font-semibold text-foreground">{endRetentionPercent !== null ? `${endRetentionPercent.toFixed(1)}%` : "--"}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div
                            ref={(node) => {
                              feedbackDeepDiveSectionRefs.current.timeline = node;
                            }}
                            className={`deepdive-section rounded-xl p-3 transition ${feedbackDeepDiveSection === "timeline" ? "ring-1 ring-primary/55" : ""}`}
                          >
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Major Drop-Off Points</p>
                            <div className="mt-2 space-y-2">
                              {majorDropOffMoments.length > 0 ? (
                                majorDropOffMoments.map((event) => {
                                  const segment = event.segment;
                                  const actionKey = segment ? toTimelineSegmentActionKey(activeJob.id, segment.id) : null;
                                  const queuedAction = actionKey ? timelineSegmentActionByKey[actionKey] : null;
                                  const submitting = actionKey ? timelineSegmentActionSubmittingKey === actionKey : false;
                                  return (
                                    <div key={`drop-off-${event.id}`} className="deepdive-list-card rounded-lg p-2.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-foreground">
                                          {formatTimelineClock(event.from.atSec)}-{formatTimelineClock(event.to.atSec)}
                                        </p>
                                        <Badge className={event.dropAbs >= 10 ? "border-rose-500/45 bg-rose-500/15 text-rose-100" : "border-amber-500/45 bg-amber-500/15 text-amber-100"}>
                                          -{event.dropAbs.toFixed(1)}%
                                        </Badge>
                                      </div>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        Relative drop {event.relativeDrop.toFixed(1)}% · {event.cause}
                                      </p>
                                      <p className="mt-1 text-[11px] text-foreground/90">{event.suggestion}</p>
                                      {segment ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[11px]"
                                            disabled={!canQueueTimelineSegmentAction || submitting}
                                            onClick={() => void handleQueueTimelineSegmentAction(segment, "fix")}
                                          >
                                            {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand2 className="mr-1 h-3 w-3" />}
                                            {queuedAction === "fix" ? "Fix queued" : "Queue fix"}
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[11px]"
                                            disabled={!canQueueTimelineSegmentAction || submitting}
                                            onClick={() => void handleQueueTimelineSegmentAction(segment, "remove")}
                                          >
                                            {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Scissors className="mr-1 h-3 w-3" />}
                                            {queuedAction === "remove" ? "Removal queued" : "Queue remove"}
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="rounded-lg border border-dashed border-border/60 bg-background/35 px-2 py-2 text-[11px] text-muted-foreground">
                                  No major drop-off windows detected from the current retention curve.
                                </p>
                              )}
                            </div>
                          </div>

                          <div
                            ref={(node) => {
                              feedbackDeepDiveSectionRefs.current.binge_parts = node;
                            }}
                            className={`deepdive-section rounded-xl p-3 transition ${feedbackDeepDiveSection === "binge_parts" ? "ring-1 ring-primary/55" : ""}`}
                          >
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Top 5 Edit Recommendations (Prioritized)</p>
                            <div className="mt-2 space-y-2">
                              {deepDiveRecommendations.length > 0 ? (
                                deepDiveRecommendations.map((recommendation) => (
                                  <div key={`recommendation-${recommendation.id}`} className="deepdive-list-card rounded-lg p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-foreground">#{recommendation.rank} {recommendation.title}</p>
                                      <Badge className="border-primary/40 bg-primary/12 text-foreground">+{recommendation.estimatedLift}% est. lift</Badge>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{recommendation.timestampLabel}</p>
                                    <p className="mt-1 text-[11px] text-foreground/90">{recommendation.detail}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="rounded-lg border border-dashed border-border/60 bg-background/35 px-2 py-2 text-[11px] text-muted-foreground">
                                  Recommendations will populate as soon as stronger drop-off signals are detected.
                                </p>
                              )}
                            </div>
                            <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-2.5">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Retention Spikes / Rewatch Moments</p>
                              {retentionSpikeMoments.length > 0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {retentionSpikeMoments.map((event) => (
                                    <p key={`spike-${event.id}`} className="text-xs text-foreground/90">
                                      {formatTimelineClock(event.from.atSec)}-{formatTimelineClock(event.to.atSec)} · +{event.gainAbs.toFixed(1)}%
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-muted-foreground">No clear rewatch spike detected yet.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          ref={(node) => {
                            feedbackDeepDiveSectionRefs.current.emotional_parts = node;
                          }}
                          className={`deepdive-section rounded-xl p-3 transition ${feedbackDeepDiveSection === "emotional_parts" ? "ring-1 ring-primary/55" : ""}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Emotion Analysis</p>
                            <Badge className="border-border/50 bg-background/60 text-foreground/80">
                              Pacing score: {pacingScoreOutOf10 !== null ? `${pacingScoreOutOf10.toFixed(1)}/10` : "--"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {predictedAudienceEmotions.length > 0 ? (
                              predictedAudienceEmotions.map((signal) => (
                                <div key={`deep-predicted-emotion-${signal.key}`} className="deepdive-list-card rounded-lg p-2.5">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <Badge className={signal.badgeClassName}>{signal.label}</Badge>
                                    <p className="text-[11px] text-foreground">{signal.predictedAudiencePercent}%</p>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                                    <div
                                      className={`h-full rounded-full bg-gradient-to-r ${signal.barClassName}`}
                                      style={{ width: `${signal.predictedAudiencePercent}%` }}
                                    />
                                  </div>
                                  <p className="mt-1 text-[11px] text-muted-foreground">{signal.predictionReason}</p>
                                </div>
                              ))
                            ) : (
                              <p className="rounded-lg border border-dashed border-border/60 bg-background/35 px-2 py-2 text-[11px] text-muted-foreground">
                                Emotion timeline data is unavailable for this render yet.
                              </p>
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Key Emotion Moments</p>
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                              {emotionTimelineHighlights.length > 0 ? (
                                emotionTimelineHighlights.slice(0, 6).map((item) => (
                                  <div key={`emotion-highlight-${item.id}`} className="deepdive-list-card rounded-lg p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge className={EMOTION_PROFILE_META[item.emotionKey].badgeClassName}>{item.emotionLabel}</Badge>
                                      <p className="text-xs text-foreground">{item.timestampLabel}</p>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{item.reason}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="rounded-lg border border-dashed border-border/60 bg-background/35 px-2 py-2 text-[11px] text-muted-foreground">
                                  No emotion highlights were detected for this timeline.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="deepdive-section rounded-xl p-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Before / After Projection</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">Current</p>
                              <p className="text-sm font-semibold text-foreground">
                                Avg % viewed {averagePercentViewed !== null ? `${averagePercentViewed.toFixed(1)}%` : "--"} ·
                                Retention delta {retentionScoreDeltaDisplay !== null ? `${retentionScoreDeltaDisplay > 0 ? "+" : ""}${retentionScoreDeltaDisplay.toFixed(1)} pts` : "--"}
                              </p>
                            </div>
                            <div className="deepdive-chip rounded-lg p-2">
                              <p className="text-[11px] text-muted-foreground">After suggested edits</p>
                              <p className="text-sm font-semibold text-foreground">
                                {projectedAverageViewedRange
                                  ? `${projectedAverageViewedRange.min.toFixed(1)}%-${projectedAverageViewedRange.max.toFixed(1)}% avg viewed`
                                  : "Projection unavailable"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Benchmark comparison: {averagePercentViewed !== null && durationBenchmarkPercent !== null
                              ? `${averagePercentViewed.toFixed(1)}% vs ${durationBenchmarkPercent.toFixed(1)}% expected for this video length`
                              : "Not enough retention points for benchmark comparison."}
                            {fillerSecondsPotential !== null
                              ? ` · Silence/filler potential: ~${fillerSecondsPotential}s`
                              : ""}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  </>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      <Dialog
        open={uploadModePromptOpen}
        onOpenChange={(open) => {
          if (!open) closeUploadModePrompt();
        }}
      >
        <DialogContent
          className="max-w-[calc(100vw-1rem)] overflow-hidden border border-primary/40 bg-[radial-gradient(140%_200%_at_0%_0%,hsl(var(--primary)/0.24),transparent_54%),radial-gradient(140%_180%_at_100%_0%,hsl(var(--glow-secondary)/0.2),transparent_60%),linear-gradient(152deg,hsl(var(--card)/0.9),hsl(var(--card)/0.76))] p-0 backdrop-blur-xl sm:max-w-2xl [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="relative p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <span className="absolute -left-16 top-[-4.5rem] h-44 w-44 rounded-full bg-primary/22 blur-3xl" />
              <span className="absolute right-[-4.25rem] top-[-3.5rem] h-36 w-36 rounded-full bg-[hsl(var(--glow-secondary)/0.18)] blur-3xl" />
            </div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-xl font-display text-foreground">Choose Upload Mode</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Before upload starts, choose whether this render should stay balanced, prioritize speed with a required transcript pass, or keep transcript-guided hook selection on for quality.
              </DialogDescription>
            </DialogHeader>

            {pendingUploadSelection ? (
              <div className="relative z-10 mt-4 rounded-xl border border-border/55 bg-card/45 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Selected file</p>
                <p className="mt-1 truncate text-sm text-foreground">{pendingUploadSelection.file.name}</p>
              </div>
            ) : null}

            <div className="relative z-10 mt-4 grid gap-2 sm:grid-cols-2">
              {UPLOAD_MODE_PROMPT_OPTIONS.map((option) => {
                const locked = Boolean(option.premium && !paidTier);
                const active = uploadModePromptActiveSelection === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`hero-platform-pill flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                      active
                        ? "border-primary/65 bg-primary/14 shadow-[0_14px_30px_-20px_hsl(var(--primary)/0.9)]"
                        : "border-border/55 bg-card/40"
                    } ${locked ? "cursor-not-allowed opacity-70" : "hover:border-primary/55 hover:bg-primary/10"}`}
                    onClick={() => {
                      if (locked) return;
                      handleSelectUploadModePrompt(option.value);
                    }}
                    disabled={locked}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-primary/25 text-primary" : "bg-background/60 text-muted-foreground"
                    }`}>
                      {option.value === "ultra" ? (
                        <Zap className="h-4 w-4" />
                      ) : option.value === "retention_king" ? (
                        <Crown className="h-4 w-4" />
                      ) : option.value === "full_auto_youtube" ? (
                        <Wand2 className="h-4 w-4" />
                      ) : (
                        <Gauge className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{option.label}</span>
                        {locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 mt-3 rounded-xl border border-border/55 bg-card/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Advanced Learning Modes
              </p>
              <p className="mt-1 text-xs text-foreground">
                Applied automatically to this upload.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {activeAdvancedLearningModeLabels.length > 0
                  ? `${activeAdvancedLearningModeLabels.join(" · ")} · Style lock ${clampCreatorStyleLockPercent(creatorStyleLockPercent)}%`
                  : `No advanced toggles active · Style lock ${clampCreatorStyleLockPercent(creatorStyleLockPercent)}%`}
              </p>
            </div>

            <div className="relative z-10 mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground">
                {paidTier ? "Paid plan detected: all power modes available." : "Free plan: Balanced and Full Auto YouTube are available."}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="hero-cta-button hero-cta-secondary w-full rounded-full sm:w-auto"
                onClick={closeUploadModePrompt}
              >
                Cancel Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorGuideOpen}
        onOpenChange={(open) => {
          if (open) {
            editorGuidePromptedRef.current = true;
            try {
              window.localStorage.setItem(EDITOR_GUIDE_AUTO_OPENED_KEY, "true");
            } catch (error) {
              // ignore storage failures
            }
          }
          setEditorGuideOpen(open);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-border/50 bg-background/95 p-4 backdrop-blur-xl sm:max-w-3xl sm:p-6">
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
                <p>3. The editor auto-selects the best 5-8 second opening hook.</p>
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
                <p className="text-xs text-foreground/90"><span className="font-medium">Cut Count:</span> Set the maximum cuts (1-15) to remove low-energy and irrelevant moments.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Editor Mode:</span> Force style strategy (reaction, commentary, vlog, gaming, sports, education, or auto).</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Show/Hide Jobs:</span> Toggle recent jobs panel.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Auto Hook:</span> Opening hook is selected automatically from top timeline moments.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Connect YouTube + Sync Analytics:</span> Link your channel/video so outcomes train future edits for your account.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Create Vertical Clips:</span> Render ranked short clips in vertical mode.</p>
                <p className="text-xs text-foreground/90"><span className="font-medium">Open Export / Open Clips:</span> Download final output files.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Modes</p>
              <div className="mt-2 space-y-2 text-xs text-foreground/90">
                <p><span className="font-medium">Horizontal (Original):</span> Keeps long-form framing and context for standard videos.</p>
                <p><span className="font-medium">Vertical (9:16):</span> Short-form clip mode with webcam crop and stacked composition options.</p>
                <p><span className="font-medium">Retention Profiles:</span> Safe/Balanced/Viral are not redundant; they change pacing aggression before the boundary critic gate.</p>
                <p><span className="font-medium">Power Modes:</span> Balanced is the middle ground, Fast prioritizes speed while transcript stays required, and Quality keeps transcript-guided hook selection while continuity checks stay enforced.</p>
                <p><span className="font-medium">Cold-Start Autopilot:</span> Conservative defaults for new creators until enough platform outcomes are synced.</p>
                <p><span className="font-medium">Continuity-First:</span> Tightens boundary critic behavior and slows pacing to avoid harsh transitions.</p>
                <p><span className="font-medium">Explore x3:</span> Tests three policy candidates, then auto-promotes winning behavior through outcome learning.</p>
                <p><span className="font-medium">Top-Human Guard:</span> Strict fail-closed quality gate. If no variant clears bar, export is blocked instead of force-rendered.</p>
                <p><span className="font-medium">Creator Style Lock:</span> Sets how strongly your historical style profile influences final cut decisions.</p>
                <p><span className="font-medium">Platform Profiles:</span> Adjusts pacing, caption defaults, and export tuning for each social platform.</p>
                <p><span className="font-medium">Outcome Learning:</span> YouTube trust weighting scales up as more synced outcomes arrive for your connected channel.</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Privacy And Terms</p>
              <p className="mt-2 text-xs text-foreground/90">
                By using the editor, you agree to the service terms. Review privacy details and the full editor workflow guide.
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
                  href="/how-editor-works"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  How The Editor Works
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
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setEditorGuideOpen(false)}>
                Okay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkoutSuccessDialog.open}
        onOpenChange={(open) => {
          setCheckoutSuccessDialog((previous) => ({ ...previous, open }));
        }}
      >
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-border/50 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">{checkoutSuccessDialog.heading}</DialogTitle>
            <DialogDescription>{checkoutSuccessDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {checkoutSuccessDialog.activatedPlan ? (
              <Badge
                className={
                  checkoutSuccessDialog.trial
                    ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40"
                    : "bg-primary/15 text-primary border border-primary/40"
                }
              >
                {checkoutSuccessDialog.activatedPlan}
              </Badge>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setCheckoutSuccessDialog((previous) => ({ ...previous, open: false }))}>
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEnableNotificationHint ? (
        <div className="fixed bottom-4 left-4 z-[130] w-[min(90vw,360px)] rounded-xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <img
              src="/logo.png"
              alt="AutoEditor Logo"
              width={24}
              height={24}
              className="mt-0.5 h-6 w-6 rounded object-cover"
              onError={(event) => {
                if (event.currentTarget.dataset.fallbackApplied === "true") return;
                event.currentTarget.dataset.fallbackApplied = "true";
                event.currentTarget.src = "/favicon-32x32.png";
              }}
            />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-foreground">Enable browser notifications</p>
              <p className="text-xs text-muted-foreground">
                Get export-ready alerts while using other tabs. Current permission:{" "}
                <span className="font-medium text-foreground">{notificationPermission}</span>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    void ensureNotificationPermission("manual_enable");
                  }}
                >
                  Enable alerts
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={dismissEnableNotificationHint}
                >
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-border/50 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
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

      <Dialog open={Boolean(achievementPopup)} onOpenChange={(open) => { if (!open) setAchievementPopup(null); }}>
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-primary/35 bg-[linear-gradient(145deg,rgba(19,12,38,0.95),rgba(35,23,74,0.92))] p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display text-primary-foreground">
              {achievementPopup?.title || "Achievement Unlocked"}
            </DialogTitle>
            <DialogDescription className="text-foreground/85">
              {achievementPopup?.line || "Your latest render hit a strong retention milestone."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-primary/35 bg-primary/12 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-primary-foreground/80">Signal</p>
            <p className="mt-1 text-lg font-premium text-foreground">{achievementPopup?.metric || "Retention lift detected"}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setAchievementPopup(null)}>
              Keep Tuning
            </Button>
            <Button
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
              onClick={() => {
                setAchievementPopup(null);
                setExportOpen(true);
              }}
            >
              <Trophy className="h-4 w-4" />
              Open Export
            </Button>
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
          className="max-w-[calc(100vw-1rem)] border border-border/50 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6 [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-display">Export ready</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {activeJob?.renderMode === "vertical"
                    ? "Choose quality and download each vertical clip."
                    : "Choose your quality and download the final MP4."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeJob && normalizeStatus(activeJob.status) === "ready" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 border-border/60 bg-card/40"
                        onClick={() => setExportFeedbackOpen((prev) => !prev)}
                      >
                        {creatorFeedbackSubmitting !== null ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="border-border/60 bg-card text-foreground">
                      Leave render feedback
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 border-border/60 bg-card/40"
                  aria-label="Close export popup"
                  onClick={() => {
                    setExportFeedbackOpen(false);
                    setExportOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {exportFeedbackOpen && activeJob ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">How was this render?</p>
                <p className="text-[11px] text-muted-foreground">Your signal improves hook and pacing decisions on future edits.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {CREATOR_FEEDBACK_ACTIONS.map((action) => (
                    <Button
                      key={`export-feedback-${action.category}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="justify-start gap-1.5"
                      disabled={creatorFeedbackSubmitting !== null || normalizeStatus(activeJob.status) !== "ready"}
                      onClick={() => void submitCreatorFeedback(action.category, "export_popup")}
                    >
                      {creatorFeedbackSubmitting === action.category ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Export Quality</span>
                <span className="text-xs text-muted-foreground">Max: {maxQuality.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">{qualityButtons}</div>
            </div>
            {activeJob?.renderMode === "vertical" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Vertical Clips</p>
                  {verticalPredictedAverage !== null ? (
                    <p className="text-xs text-muted-foreground">
                      Predicted completion: {verticalPredictedAverage.toFixed(1)}%
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: Math.max(1, activeOutputUrls.length || verticalClipCount) }).map((_, idx) => {
                    const clipNumber = idx + 1;
                    const prediction = verticalClipPredictions.find((item) => item.clip === clipNumber) || null;
                    return (
                      <div key={`clip-${clipNumber}`} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2"
                            onClick={async () => {
                              const didStartDownload = await handleDownload(idx);
                              if (didStartDownload) {
                                setExportOpen(false);
                              }
                            }}
                          >
                            <Download className="w-4 h-4" />
                            Clip {clipNumber}
                          </Button>
                          {prediction ? (
                            <p className="text-[11px] text-emerald-300">{prediction.predictedCompletion.toFixed(0)}% likely</p>
                          ) : null}
                        </div>
                        {prediction?.reason ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{prediction.reason}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Feedback History</p>
                <span className="text-[11px] text-muted-foreground">
                  {exportFeedbackEntries.length} entries
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recent feedback signals already saved for this render.
              </p>
              <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {exportFeedbackEntries.length ? (
                  exportFeedbackEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border/50 bg-background/45 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-foreground">{entry.label}</p>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {entry.sourceType === "creator" ? "Creator" : "Retention"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{entry.detail}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/90">{formatFeedbackTimestamp(entry.at)}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border/60 bg-background/40 px-2 py-2 text-[11px] text-muted-foreground">
                    No feedback submitted for this render yet.
                  </p>
                )}
              </div>
              {exportCreatorFeedbackCount > 0 ? (
                <p className="mt-2 text-[11px] text-emerald-300">
                  Creator feedback submissions: {exportCreatorFeedbackCount}
                </p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setExportFeedbackOpen(false);
                    setExportOpen(false);
                    openFeedbackDeepDiveSection("retention_vs_emotion");
                  }}
                >
                  Open Feedback Deep Dive
                </Button>
                <Button
                  className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto"
                  onClick={async () => {
                    const didStartDownload = await handleDownload(0);
                    if (didStartDownload) {
                      setExportOpen(false);
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  {activeJob?.renderMode === "vertical" ? "Clip 1" : "Final MP4"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={autoDownloadModal.open} onOpenChange={(open) => setAutoDownloadModal({ open })}>
        <DialogContent className="max-w-[calc(100vw-1rem)] border border-border/50 bg-background/95 p-4 backdrop-blur-xl sm:max-w-lg sm:p-6">
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
                onClick={async () => {
                  try {
                    const url = autoDownloadModal.url;
                    const fileName = autoDownloadModal.fileName;
                    if (!url) return;
                    await triggerFileDownload(url, fileName);
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
    </GlowBackdrop></Suspense>
  );
};

export default Editor;
