import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ManualTimestampEditor, {
  type ManualTimestampMarker,
  type ManualTimestampSuggestion,
} from "@/components/editor/ManualTimestampEditor";
import RetentionGraphModal, { type RetentionCurvePointInput } from "@/components/editor/RetentionGraphModal";
import {
  Upload,
  Plus,
  Play,
  Download,
  Lock,
  Loader2,
  CheckCircle2,
  ZoomIn,
  ScissorsSquare,
  Scissors,
  MousePointerClick,
  Pencil,
  X,
  XCircle,
  Map as MapIcon,
  RotateCcw,
  SlidersHorizontal,
  Bot,
  Sparkles,
  MessageSquareText,
  Camera,
  Gamepad2,
  Trophy,
  GraduationCap,
  Mic,
  Monitor,
  Smartphone,
  Youtube,
  Flame,
  CircleOff,
  Gauge,
  Rabbit,
  Zap,
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { getAnalyticsSessionId, trackAnalyticsEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import { useLiveStats } from "@/providers/LiveStatsProvider";
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

const MAX_VERTICAL_CAPTION_WORDS = 5;
const normalizeVerticalCaptionHex = (value: string, fallback = "#FFFFFF") => {
  const normalized = String(value || "").trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(normalized)) return `#${normalized}`;
  return normalizeVerticalCaptionHex(fallback, "#FFFFFF");
};
const normalizeVerticalCaptionPhrase = (value: string) => {
  const compact = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 84);
  if (!compact) return "";
  return compact
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_VERTICAL_CAPTION_WORDS)
    .join(" ");
};
const normalizeVerticalCaptionTextForJob = (value: string) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeVerticalCaptionPhrase(line))
    .filter(Boolean)
    .slice(0, 18)
    .join("\n")
    .slice(0, 1800);

const normalizeVerticalCaptionEditorText = (value: string) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeVerticalCaptionPhrase(line))
    .slice(0, 18)
    .join("\n");

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const verticalTextColorFromSlider = (value: number) => {
  const normalized = clamp(Math.round(Number(value) || 0), 0, 100);
  const green = Math.round(clamp(132 + normalized * 1.23, 0, 255));
  const blue = Math.round(clamp(10 + normalized * 0.52, 0, 255));
  return `#${[255, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
};
const verticalTextColorSliderFromHex = (value: string) => {
  const normalized = normalizeVerticalCaptionHex(value, "#FFE500").replace("#", "");
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  return clamp(Math.round((green - 132) / 1.23), 0, 100);
};
const MAX_CUTS_MIN = 1;
const MAX_CUTS_MAX = 15;
const DEFAULT_MAX_CUTS = 8;
const DEFAULT_VERTICAL_OUTPUT = { width: 1080, height: 1920 } as const;
const VERTICAL_CAPTION_FONT_SIZE_MIN = 32;
const VERTICAL_CAPTION_FONT_SIZE_MAX = 220;
const VERTICAL_CAPTION_FONT_SIZE_DEFAULT = 128;
const VERTICAL_CAPTION_OUTLINE_WIDTH_MIN = 0;
const VERTICAL_CAPTION_OUTLINE_WIDTH_MAX = 24;
const VERTICAL_CAPTION_SHADOW_BLUR_MIN = 0;
const VERTICAL_CAPTION_SHADOW_BLUR_MAX = 42;
const DEFAULT_WEBCAM_TOP_HEIGHT_PCT = 40;
const DEFAULT_WEBCAM_PADDING_PX = 0;
const MIN_WEBCAM_CROP_SIZE_PX = 48;
const RETENTION_FEEDBACK_INTERVAL_MS = 15000;
const WATCH_FEEDBACK_PROGRESS_STEP = 0.08;
const MIN_WATCH_FEEDBACK_PROGRESS = 0.08;
const HOOK_PREVIEW_RETRY_DELAY_MS = 3000;
const EDITOR_GUIDE_AUTO_OPENED_KEY = "editor_help_auto_opened_v1";
const HELP_DEMO_ROTATE_MS = 2600;
const HELP_DEMO_SAMPLE_VIDEO_SRC = "/editor-help-sample.mp4";
const DEFAULT_VERTICAL_CAPTION_PRESET: VerticalCaptionPreset = "mrbeast_animated";
const clampVerticalCaptionFontSize = (value: number) =>
  clamp(Math.round(Number(value) || VERTICAL_CAPTION_FONT_SIZE_DEFAULT), VERTICAL_CAPTION_FONT_SIZE_MIN, VERTICAL_CAPTION_FONT_SIZE_MAX);
const clampVerticalCaptionOutlineWidth = (value: number) =>
  clamp(
    Math.round(Number(value) || 0),
    VERTICAL_CAPTION_OUTLINE_WIDTH_MIN,
    VERTICAL_CAPTION_OUTLINE_WIDTH_MAX,
  );
const clampVerticalCaptionShadowBlur = (value: number) =>
  clamp(
    Math.round(Number(value) || 0),
    VERTICAL_CAPTION_SHADOW_BLUR_MIN,
    VERTICAL_CAPTION_SHADOW_BLUR_MAX,
  );
const clampVerticalCaptionPosition = (value: number) => clamp(Number(value) || 0, 0.02, 0.98);

type VerticalFitMode = "cover" | "contain";
type VerticalSelectionMode = "best_moments" | "story_arc" | "hook_storm" | "loop_builder";
type VerticalZoomProfile = "none" | "smooth" | "punch" | "kinetic";
type VerticalCaptionPreset =
  | "basic_clean"
  | "mrbeast_animated"
  | "neon_glow"
  | "bold_clean_box"
  | "rage_mode"
  | "ice_pop"
  | "retro_wave"
  | "glitch_pop"
  | "cinema_punch";
type VerticalCaptionAnimationMode = "none" | "pop" | "slide" | "bounce" | "glitch";
type VerticalEditorCardId = "preview" | "captions";
type VerticalCaptionStyleDefaults = {
  fontId: SubtitleStyleConfig["fontId"];
  textColor: string;
  accentColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  boxEnabled: boolean;
  boxColor: string;
  animation: VerticalCaptionAnimationMode;
  forceUppercase: boolean;
};
type VerticalCaptionsPayload = {
  enabled: boolean;
  autoGenerate: boolean;
  preset: VerticalCaptionPreset;
  fontSize: number;
  text: string;
  fontId: SubtitleStyleConfig["fontId"];
  textColor: string;
  accentColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  boxEnabled: boolean;
  boxColor: string;
  animationEnabled: boolean;
  animation: VerticalCaptionAnimationMode;
  positionX: number;
  positionY: number;
};
type RenderModeSelection = "horizontal" | "vertical";
type RetentionStrategyProfile = "safe" | "balanced" | "viral";
type RetentionAggressionLevel = "low" | "medium" | "high" | "viral";
type RetentionTargetPlatform = "tiktok" | "instagram_reels" | "youtube";
type EditorModeSelection = "auto" | "reaction" | "commentary" | "savage-roast" | "vlog" | "gaming" | "sports" | "education" | "podcast";
type HookSelectionMode = "manual" | "auto";
type LongFormPreset = "auto" | "balanced" | "aggressive" | "ultra";
type ViralModeSelection = "none" | "youtube" | "tiktok";
type EnhanceModeSelection = "off" | "transitions" | "swoosh" | "zooms" | "all" | "auto";
type EffectPreviewSelection = Exclude<EnhanceModeSelection, "off">;
type EditorSettingsSection = "format" | "vibe" | "cuts" | "captions";
type HelpDemoStep = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  renderMode: RenderModeSelection;
  retentionProfile: RetentionStrategyProfile;
  platform: RetentionTargetPlatform;
  editorMode: EditorModeSelection;
  viralMode: ViralModeSelection;
  enhanceMode: EnhanceModeSelection;
  maxCuts: number;
  captionsOn: boolean;
};
type OutcomeAutomationPlatform = RetentionTargetPlatform | "auto";
type OutcomeAutomationEditorMode = Exclude<EditorModeSelection, "auto"> | null;
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
const STRATEGY_TO_AGGRESSION: Record<RetentionStrategyProfile, RetentionAggressionLevel> = {
  safe: "low",
  balanced: "medium",
  viral: "viral",
};
const RENDER_MODE_OPTIONS: Array<{ value: RenderModeSelection; label: string; icon: LucideIcon }> = [
  { value: "horizontal", label: "Horizontal", icon: Monitor },
  { value: "vertical", label: "Vertical", icon: Smartphone },
];
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
const RETENTION_PROFILE_SEQUENCE: RetentionStrategyProfile[] = ["safe", "balanced", "viral"];
const EDITOR_SETTINGS_SECTIONS: Array<{ key: EditorSettingsSection; label: string }> = [
  { key: "format", label: "Format & Platform" },
  { key: "vibe", label: "Vibe & Style" },
  { key: "cuts", label: "Cuts & Pacing" },
  { key: "captions", label: "Captions & Audio" },
];
const EDITOR_MODE_OPTIONS: Array<{ value: EditorModeSelection; label: string; description: string; icon: LucideIcon }> = [
  { value: "auto", label: "Auto", description: "Let the model infer style from your content.", icon: Bot },
  { value: "reaction", label: "Reaction", description: "Higher-energy pacing tuned for reactions.", icon: Sparkles },
  { value: "commentary", label: "Commentary", description: "Speech-first pacing with cleaner flow.", icon: MessageSquareText },
  { value: "savage-roast", label: "Savage Roast", description: "Chaotic roast commentary with aggressive reaction timing.", icon: Flame },
  { value: "vlog", label: "Vlog", description: "Conversational lifestyle pacing.", icon: Camera },
  { value: "gaming", label: "Gaming", description: "Fast action-driven pacing for gameplay footage.", icon: Gamepad2 },
  { value: "sports", label: "Sports", description: "High-intensity pacing for highlights and plays.", icon: Trophy },
  { value: "education", label: "Education", description: "Clarity-first pacing for tutorials and explainers.", icon: GraduationCap },
  { value: "podcast", label: "Podcast", description: "Multi-speaker cleanup with breathing room and chapter-friendly pacing.", icon: Mic },
];
const LONG_FORM_PRESET_OPTIONS: Array<{ value: LongFormPreset; label: string; description: string; icon: LucideIcon }> = [
  { value: "auto", label: "Auto", description: "Auto-tunes long-form pacing profile by runtime and retention settings.", icon: Bot },
  { value: "balanced", label: "Balanced", description: "10-18 cuts/min, lighter compression, 0.28s silence target.", icon: Gauge },
  { value: "aggressive", label: "Aggressive", description: "18-28 cuts/min, tighter pacing, 0.18s silence target.", icon: Rabbit },
  { value: "ultra", label: "Ultra", description: "28-40 cuts/min, maximum tightening, 0.12s silence target.", icon: Zap },
];
const LONG_FORM_PRESET_DEFAULTS: Record<LongFormPreset, { aggression: number; clarityVsSpeed: number; tangentKiller: boolean }> = {
  auto: { aggression: 62, clarityVsSpeed: 58, tangentKiller: true },
  balanced: { aggression: 45, clarityVsSpeed: 68, tangentKiller: false },
  aggressive: { aggression: 72, clarityVsSpeed: 52, tangentKiller: true },
  ultra: { aggression: 92, clarityVsSpeed: 36, tangentKiller: true },
};
const VIRAL_MODE_OPTIONS: Array<{ value: ViralModeSelection; label: string; description: string; icon: LucideIcon }> = [
  {
    value: "youtube",
    label: "YouTube Viral",
    description: "Retention + storytelling polish with smoother pacing and cinematic effect blend.",
    icon: Youtube,
  },
  {
    value: "tiktok",
    label: "TikTok Viral",
    description: "Instant dopamine profile with aggressive pacing, snap zooms, and punchier FX.",
    icon: Flame,
  },
  {
    value: "none",
    label: "None",
    description: "Keep manual control over pacing and effect toggles.",
    icon: CircleOff,
  },
];
const ENHANCE_MODE_OPTIONS: Array<{ value: EnhanceModeSelection; label: string; icon: LucideIcon }> = [
  { value: "off", label: "Off", icon: CircleOff },
  { value: "transitions", label: "Transitions", icon: Scissors },
  { value: "swoosh", label: "Swoosh SFX", icon: Volume2 },
  { value: "zooms", label: "Zooms", icon: ZoomIn },
  { value: "all", label: "All Effects", icon: Sparkles },
  { value: "auto", label: "Auto", icon: Bot },
];
const HELP_DEMO_STEPS: HelpDemoStep[] = [
  {
    key: "default-safe",
    title: "Long-form default",
    description: "Horizontal + Safe keeps context and smooth pacing for standard uploads.",
    icon: Monitor,
    renderMode: "horizontal",
    retentionProfile: "safe",
    platform: "youtube",
    editorMode: "auto",
    viralMode: "none",
    enhanceMode: "off",
    maxCuts: 6,
    captionsOn: false,
  },
  {
    key: "vertical-viral",
    title: "Short-form punch",
    description: "Vertical + Viral + TikTok ramps speed, denser cuts, and stronger visual effects.",
    icon: Flame,
    renderMode: "vertical",
    retentionProfile: "viral",
    platform: "tiktok",
    editorMode: "gaming",
    viralMode: "tiktok",
    enhanceMode: "all",
    maxCuts: 13,
    captionsOn: true,
  },
  {
    key: "commentary-flow",
    title: "Commentary flow",
    description: "Balanced pacing on YouTube protects narrative while still trimming dead space.",
    icon: MessageSquareText,
    renderMode: "horizontal",
    retentionProfile: "balanced",
    platform: "youtube",
    editorMode: "commentary",
    viralMode: "youtube",
    enhanceMode: "transitions",
    maxCuts: 9,
    captionsOn: true,
  },
  {
    key: "savage-roast-bursts",
    title: "Savage roast bursts",
    description: "Aggressive reaction cadence for roast, prank, and high-drama moments.",
    icon: Flame,
    renderMode: "vertical",
    retentionProfile: "viral",
    platform: "tiktok",
    editorMode: "savage-roast",
    viralMode: "tiktok",
    enhanceMode: "all",
    maxCuts: 12,
    captionsOn: true,
  },
  {
    key: "education-clarity",
    title: "Educational clarity",
    description: "Safe profile + education mode prioritizes readability and lower overcut risk.",
    icon: GraduationCap,
    renderMode: "horizontal",
    retentionProfile: "safe",
    platform: "youtube",
    editorMode: "education",
    viralMode: "none",
    enhanceMode: "off",
    maxCuts: 5,
    captionsOn: true,
  },
  {
    key: "reels-mix",
    title: "Reels middle-ground",
    description: "Balanced IG Reels setup gives quick pacing without full TikTok intensity.",
    icon: Smartphone,
    renderMode: "vertical",
    retentionProfile: "balanced",
    platform: "instagram_reels",
    editorMode: "vlog",
    viralMode: "youtube",
    enhanceMode: "zooms",
    maxCuts: 10,
    captionsOn: true,
  },
  {
    key: "podcast-focus",
    title: "Podcast focus",
    description: "Podcast mode tunes cleanup around speakers, breathing room, and subtitle clarity.",
    icon: Mic,
    renderMode: "horizontal",
    retentionProfile: "balanced",
    platform: "youtube",
    editorMode: "podcast",
    viralMode: "none",
    enhanceMode: "swoosh",
    maxCuts: 8,
    captionsOn: true,
  },
];
const deriveEnhanceModeFromEffectToggles = (
  transitionsEnabled: boolean,
  smartZoomEnabled: boolean,
  soundFxEnabled: boolean,
): EnhanceModeSelection => {
  if (transitionsEnabled && smartZoomEnabled && soundFxEnabled) return "all";
  if (!transitionsEnabled && !smartZoomEnabled && !soundFxEnabled) return "off";
  if (transitionsEnabled && !smartZoomEnabled && !soundFxEnabled) return "transitions";
  if (!transitionsEnabled && smartZoomEnabled && !soundFxEnabled) return "zooms";
  if (!transitionsEnabled && !smartZoomEnabled && soundFxEnabled) return "swoosh";
  return "auto";
};
const previewEffectTypeFromEnhanceMode = (enhanceMode: EnhanceModeSelection): EffectPreviewSelection | null => {
  if (enhanceMode === "off") return null;
  return enhanceMode;
};
const deriveVerticalModeEffects = ({
  selectionMode,
  zoomProfile,
  zoomIntensity,
}: {
  selectionMode: VerticalSelectionMode;
  zoomProfile: VerticalZoomProfile;
  zoomIntensity: number;
}) => {
  const intensity = clamp(Number(zoomIntensity) || 0, 0, 100) / 100;
  const smartZoom = zoomProfile !== "none";
  const transitions = selectionMode !== "story_arc";
  const soundFx = selectionMode === "hook_storm" || selectionMode === "loop_builder";
  const baseZoom = zoomProfile === "none"
    ? 1.04
    : zoomProfile === "smooth"
      ? 1.08
      : zoomProfile === "punch"
        ? 1.12
        : 1.16;
  const autoZoomMax = Number((baseZoom + intensity * 0.12).toFixed(3));
  return {
    smartZoom,
    transitions,
    soundFx,
    autoZoomMax,
  };
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
const VERTICAL_CAPTION_PRESET_OPTIONS: Array<{
  id: VerticalCaptionPreset;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "mrbeast_animated", label: "VIRAL BEAST", description: "High-energy punch text for shorts and clips.", icon: Flame },
  { id: "rage_mode", label: "RAGE MODE", description: "Aggressive red/yellow style.", icon: Rabbit },
  { id: "neon_glow", label: "NEON GLOW", description: "Cyan/magenta nightglow glow.", icon: Zap },
  { id: "ice_pop", label: "ICE COP", description: "Cool high-contrast blue style.", icon: Trophy },
  { id: "bold_clean_box", label: "SOLID BOX", description: "Strong boxed callout with hard contrast.", icon: Camera },
  { id: "basic_clean", label: "BASIC CLEAN", description: "Readable clean captions for sober edits.", icon: Gauge },
];
const VERTICAL_CLIP_SELECTOR_OPTIONS: Array<{
  value: number;
  label: string;
  status?: "ready" | "failed";
}> = [
  { value: 0, label: "Auto", status: "ready" },
  { value: 8, label: "8 clips", status: "ready" },
  { value: 10, label: "10 clips" },
  { value: 12, label: "12 clips" },
  { value: 15, label: "15 clips", status: "failed" },
  { value: 20, label: "20 clips" },
];
const DEFAULT_VERTICAL_SELECTION_MODE: VerticalSelectionMode = "best_moments";
const DEFAULT_VERTICAL_ZOOM_PROFILE: VerticalZoomProfile = "smooth";
const DEFAULT_VERTICAL_ZOOM_INTENSITY = 62;
const DEFAULT_VERTICAL_EDITOR_CARD_ORDER: VerticalEditorCardId[] = ["preview", "captions"];
const DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE: Record<VerticalSelectionMode, number> = {
  best_moments: 3,
  story_arc: 2,
  hook_storm: 5,
  loop_builder: 4,
};
const VERTICAL_SELECTION_MODE_OPTIONS: Array<{
  id: VerticalSelectionMode;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "best_moments",
    label: "Best Moments",
    description: "Editor picks highest-retention peaks. Default output: 3 clips.",
    icon: Sparkles,
  },
  {
    id: "story_arc",
    label: "Story Arc",
    description: "Longer clips with smoother pacing and clearer context.",
    icon: Gauge,
  },
  {
    id: "hook_storm",
    label: "Hook Storm",
    description: "Aggressive hook-heavy picks tuned for TikTok velocity.",
    icon: Flame,
  },
  {
    id: "loop_builder",
    label: "Loop Builder",
    description: "Moments optimized for replay loops and strong endings.",
    icon: Play,
  },
];
const VERTICAL_ZOOM_PROFILE_OPTIONS: Array<{
  id: VerticalZoomProfile;
  label: string;
  description: string;
}> = [
  { id: "none", label: "None", description: "Disable smart zoom for static framing." },
  { id: "smooth", label: "Smooth", description: "Gentle zoom motion for Reels and Shorts." },
  { id: "punch", label: "Punch", description: "Sharper zoom pops for high-energy beats." },
  { id: "kinetic", label: "Kinetic", description: "Strongest zoom profile for viral intensity." },
];
const VERTICAL_CAPTION_ANIMATION_OPTIONS: Array<{
  id: VerticalCaptionAnimationMode;
  label: string;
  description: string;
}> = [
  { id: "none", label: "None", description: "No animation. Static caption style." },
  { id: "pop", label: "Pop", description: "Quick scale-in punch animation." },
  { id: "slide", label: "Slide", description: "Slides into place from the side." },
  { id: "bounce", label: "Bounce", description: "Punchy bounce settle animation." },
  { id: "glitch", label: "Glitch", description: "Jittery glitch flicker entry." },
];
const VERTICAL_CAPTION_STYLE_DEFAULTS: Record<VerticalCaptionPreset, VerticalCaptionStyleDefaults> = {
  basic_clean: {
    fontId: "sans_bold",
    textColor: "#F8FAFC",
    accentColor: "#F8FAFC",
    outlineColor: "#0F172A",
    outlineWidth: 3,
    shadowEnabled: false,
    shadowColor: "#020617",
    shadowBlur: 0,
    boxEnabled: true,
    boxColor: "#020617",
    animation: "none",
    forceUppercase: false,
  },
  mrbeast_animated: {
    fontId: "impact",
    textColor: "#FFE500",
    accentColor: "#FFF173",
    outlineColor: "#050505",
    outlineWidth: 18,
    shadowEnabled: true,
    shadowColor: "#050505",
    shadowBlur: 8,
    boxEnabled: false,
    boxColor: "#000000",
    animation: "pop",
    forceUppercase: true,
  },
  neon_glow: {
    fontId: "condensed",
    textColor: "#2DF6FF",
    accentColor: "#FF4FD8",
    outlineColor: "#071E28",
    outlineWidth: 6,
    shadowEnabled: true,
    shadowColor: "#2DF6FF",
    shadowBlur: 26,
    boxEnabled: false,
    boxColor: "#0A0F1E",
    animation: "slide",
    forceUppercase: true,
  },
  bold_clean_box: {
    fontId: "sans_bold",
    textColor: "#FFFFFF",
    accentColor: "#FFE047",
    outlineColor: "#000000",
    outlineWidth: 6,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowBlur: 10,
    boxEnabled: true,
    boxColor: "#111827",
    animation: "none",
    forceUppercase: false,
  },
  rage_mode: {
    fontId: "impact",
    textColor: "#FF4D4D",
    accentColor: "#FFD74A",
    outlineColor: "#1A0202",
    outlineWidth: 14,
    shadowEnabled: true,
    shadowColor: "#120000",
    shadowBlur: 18,
    boxEnabled: false,
    boxColor: "#240202",
    animation: "bounce",
    forceUppercase: true,
  },
  ice_pop: {
    fontId: "condensed",
    textColor: "#DDF6FF",
    accentColor: "#49DEFF",
    outlineColor: "#041426",
    outlineWidth: 10,
    shadowEnabled: true,
    shadowColor: "#49DEFF",
    shadowBlur: 18,
    boxEnabled: false,
    boxColor: "#041426",
    animation: "pop",
    forceUppercase: true,
  },
  retro_wave: {
    fontId: "display_black",
    textColor: "#FFE8FF",
    accentColor: "#5CF6FF",
    outlineColor: "#25003A",
    outlineWidth: 9,
    shadowEnabled: true,
    shadowColor: "#6D28D9",
    shadowBlur: 16,
    boxEnabled: false,
    boxColor: "#240046",
    animation: "slide",
    forceUppercase: true,
  },
  glitch_pop: {
    fontId: "mono_bold",
    textColor: "#F8FAFC",
    accentColor: "#67E8F9",
    outlineColor: "#111827",
    outlineWidth: 8,
    shadowEnabled: true,
    shadowColor: "#111827",
    shadowBlur: 12,
    boxEnabled: false,
    boxColor: "#020617",
    animation: "glitch",
    forceUppercase: true,
  },
  cinema_punch: {
    fontId: "serif_bold",
    textColor: "#FFF8E8",
    accentColor: "#FFD166",
    outlineColor: "#1A1203",
    outlineWidth: 7,
    shadowEnabled: true,
    shadowColor: "#1A1203",
    shadowBlur: 8,
    boxEnabled: true,
    boxColor: "#1F172A",
    animation: "none",
    forceUppercase: false,
  },
};
const VERTICAL_CAPTION_PREVIEW_FALLBACKS: Record<VerticalCaptionPreset, string> = {
  basic_clean: "Clean hook moment",
  mrbeast_animated: "THIS PART GOES CRAZY",
  neon_glow: "NEON MOMENT HITS HARD",
  bold_clean_box: "Watch this next part",
  rage_mode: "NO WAY THIS JUST HAPPENED",
  ice_pop: "COLD MOMENT RIGHT HERE",
  retro_wave: "RETRO WAVE ENERGY",
  glitch_pop: "SYSTEM JUST SPIKED",
  cinema_punch: "Watch this turn",
};
const resolveVerticalCaptionCanvasFont = (fontId: SubtitleStyleConfig["fontId"]) => {
  if (fontId === "sans_bold") return '"Arial Black", Arial, sans-serif';
  if (fontId === "condensed") return '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
  if (fontId === "serif_bold") return '"Georgia", "Times New Roman", serif';
  if (fontId === "display_black") return '"Arial Black", Impact, "Segoe UI Black", sans-serif';
  if (fontId === "mono_bold") return '"Space Mono", "Courier New", monospace';
  return 'Impact, "Arial Black", sans-serif';
};
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
  selectionMode?: VerticalSelectionMode;
  zoomProfile?: VerticalZoomProfile;
  zoomIntensity?: number;
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

type ManualTimestampConfigPayload = {
  enabled: boolean;
  autoAssist: boolean;
  markers: ManualTimestampMarker[];
  suggestions: ManualTimestampSuggestion[];
  requested: boolean;
  retentionDeltaEstimate: number | null;
  updatedAt: string;
};

type ManualOverrideStructuredPlan = {
  manualMode: "ON";
  hook: string;
  userCuts: string[];
  removals: string[];
  retentionImpact: string;
  aiSuggestions: string[];
};
type ManualPreviewSegment = { start: number; end: number };
type ManualPreviewPlan = {
  segments: ManualPreviewSegment[];
  keepRanges: ManualPreviewSegment[];
  removeRanges: ManualPreviewSegment[];
  hookRange: ManualPreviewSegment | null;
};

type VerticalClipPrediction = {
  clip: number;
  start: number;
  end: number;
  duration: number;
  predictedCompletion: number;
  reason: string;
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
const LIVE_SETTINGS_SYNC_STATUSES = new Set([
  "pacing",
  "story",
  "subtitling",
  "audio",
  "retention",
  "rendering",
]);
const AI_PREVIEW_READY_STATUSES = new Set([
  "story",
  "subtitling",
  "audio",
  "retention",
  "rendering",
  "ready",
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

const parseManualOverrideStructuredPlan = (value: any): ManualOverrideStructuredPlan | null => {
  if (!value || typeof value !== "object") return null;
  const manualModeRaw = String(value.manualMode ?? value.manual_mode ?? "").trim().toUpperCase();
  const hook = typeof value.hook === "string" ? value.hook.trim() : "";
  const userCuts = Array.isArray(value.userCuts ?? value.user_cuts)
    ? (value.userCuts ?? value.user_cuts)
        .filter((entry: unknown) => typeof entry === "string")
        .map((entry: string) => entry.trim())
        .filter(Boolean)
    : [];
  const removals = Array.isArray(value.removals)
    ? value.removals
        .filter((entry: unknown) => typeof entry === "string")
        .map((entry: string) => entry.trim())
        .filter(Boolean)
    : [];
  const retentionImpact = typeof value.retentionImpact === "string"
    ? value.retentionImpact.trim()
    : typeof value.retention_impact === "string"
      ? value.retention_impact.trim()
      : "";
  const aiSuggestions = Array.isArray(value.aiSuggestions ?? value.ai_suggestions)
    ? (value.aiSuggestions ?? value.ai_suggestions)
        .filter((entry: unknown) => typeof entry === "string")
        .map((entry: string) => entry.trim())
        .filter(Boolean)
    : [];
  if (manualModeRaw !== "ON" && !hook && userCuts.length === 0 && removals.length === 0 && !retentionImpact && aiSuggestions.length === 0) {
    return null;
  }
  return {
    manualMode: "ON",
    hook: hook || "none",
    userCuts,
    removals,
    retentionImpact: retentionImpact || "n/a",
    aiSuggestions,
  };
};

const parseManualRetentionImpactPoints = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = value.match(/[-+]?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeManualTimeRange = (value: any): { start: number; end: number } | null => {
  const start = Number(value?.start ?? value?.from ?? value?.t0);
  const end = Number(value?.end ?? value?.to ?? value?.t1);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    start: Number(Math.max(0, start).toFixed(3)),
    end: Number(Math.max(start + 0.05, end).toFixed(3)),
  };
};

const normalizeManualTimestampMarker = (marker: any, index: number): ManualTimestampMarker | null => {
  if (!marker || typeof marker !== "object") return null;
  const typeRaw = String(marker.type || marker.markerType || marker.kind || "").trim().toLowerCase();
  if (typeRaw !== "keep" && typeRaw !== "remove" && typeRaw !== "hook") return null;
  const start = Number(marker.start ?? marker.from ?? marker.t0);
  const end = Number(marker.end ?? marker.to ?? marker.t1);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const sourceRaw = String(marker.source || "").trim().toLowerCase();
  const source: "user" | "ai" = sourceRaw === "ai" ? "ai" : "user";
  const safeStart = Number(Math.max(0, start).toFixed(3));
  const safeEnd = Number(Math.max(safeStart + 0.05, end).toFixed(3));
  const id = typeof marker.id === "string" && marker.id.trim()
    ? marker.id.trim()
    : `${typeRaw}_${index}_${Math.round(safeStart * 1000)}_${Math.round(safeEnd * 1000)}`;
  const rationale = typeof marker.rationale === "string" ? marker.rationale.trim().slice(0, 280) : "";
  return {
    id,
    type: typeRaw as ManualTimestampMarker["type"],
    start: safeStart,
    end: safeEnd,
    source,
    ...(rationale ? { rationale } : {}),
  };
};

const normalizeManualTimestampSuggestion = (value: any, index: number): ManualTimestampSuggestion | null => {
  if (!value || typeof value !== "object") return null;
  const typeRaw = String(value.type || value.suggestionType || value.kind || "").trim().toLowerCase();
  const normalizedType = typeRaw === "keep" ? "cut" : typeRaw;
  if (normalizedType !== "hook" && normalizedType !== "remove" && normalizedType !== "cut") return null;
  const start = Number(value.start ?? value.from ?? value.t0);
  const end = Number(value.end ?? value.to ?? value.t1);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const safeStart = Number(Math.max(0, start).toFixed(3));
  const safeEnd = Number(Math.max(safeStart + 0.05, end).toFixed(3));
  const rationale = typeof value.rationale === "string" && value.rationale.trim()
    ? value.rationale.trim().slice(0, 280)
    : "AI suggestion";
  const id = typeof value.id === "string" && value.id.trim()
    ? value.id.trim()
    : `suggest_${normalizedType}_${index}_${Math.round(safeStart * 1000)}_${Math.round(safeEnd * 1000)}`;
  return {
    id,
    type: normalizedType as ManualTimestampSuggestion["type"],
    start: safeStart,
    end: safeEnd,
    rationale,
    source: "ai",
  };
};

const parseManualTimestampConfigFromAnalysis = (analysis: any): ManualTimestampConfigPayload | null => {
  const nested = analysis?.manualTimestamp ?? analysis?.manual_timestamp ?? null;
  const source = nested && typeof nested === "object" ? nested : analysis;
  const hasSignal = nested
    || source?.manualTimestampEditor !== undefined
    || source?.manual_timestamp_editor !== undefined
    || source?.manualMarkers !== undefined
    || source?.manual_markers !== undefined;
  if (!hasSignal) return null;
  const markersRaw = Array.isArray(source?.markers)
    ? source.markers
    : Array.isArray(source?.manualMarkers)
      ? source.manualMarkers
      : Array.isArray(source?.manual_markers)
        ? source.manual_markers
        : [];
  const suggestionsRaw = Array.isArray(source?.suggestions)
    ? source.suggestions
    : Array.isArray(source?.manualSuggestions)
      ? source.manualSuggestions
      : Array.isArray(source?.manual_suggestions)
        ? source.manual_suggestions
        : [];
  const markers = markersRaw
    .map((marker: any, index: number) => normalizeManualTimestampMarker(marker, index))
    .filter((marker: ManualTimestampMarker | null): marker is ManualTimestampMarker => Boolean(marker));
  const suggestions = suggestionsRaw
    .map((item: any, index: number) => normalizeManualTimestampSuggestion(item, index))
    .filter((item: ManualTimestampSuggestion | null): item is ManualTimestampSuggestion => Boolean(item));
  const enabledRaw =
    source?.enabled ??
    source?.manualMode ??
    source?.manual_mode ??
    source?.manualTimestampEditor ??
    source?.manual_timestamp_editor ??
    source?.manualTimestampEnabled ??
    source?.manual_timestamp_enabled;
  const enabled = typeof enabledRaw === "boolean" ? enabledRaw : markers.length > 0;
  const autoAssistRaw =
    source?.autoAssist ??
    source?.auto_assist ??
    source?.manualAutoAssist ??
    source?.manual_auto_assist ??
    source?.aiAssist ??
    source?.ai_assist;
  const autoAssist = typeof autoAssistRaw === "boolean" ? autoAssistRaw : false;
  const retentionDeltaRaw =
    source?.retentionDeltaEstimate ??
    source?.manualRetentionDeltaEstimate ??
    source?.manual_retention_delta_estimate ??
    null;
  const retentionDeltaEstimate = Number.isFinite(Number(retentionDeltaRaw))
    ? Number(retentionDeltaRaw)
    : null;
  const requestedRaw = source?.requested ?? source?.aiSuggestRequested ?? source?.ai_suggest_requested;
  const requested = typeof requestedRaw === "boolean" ? requestedRaw : suggestions.length > 0;
  const updatedAtRaw =
    source?.updatedAt ??
    source?.manualUpdatedAt ??
    source?.manual_updated_at ??
    null;
  const updatedAt = typeof updatedAtRaw === "string" && updatedAtRaw.trim()
    ? updatedAtRaw.trim()
    : new Date().toISOString();
  return {
    enabled,
    autoAssist,
    markers,
    suggestions,
    requested,
    retentionDeltaEstimate,
    updatedAt,
  };
};

const buildMicroHookSuggestions = (durationSec: number) => {
  const suggestions: Array<{ start: number; end: number }> = [];
  if (!Number.isFinite(durationSec) || durationSec < 180) return suggestions;
  for (let anchor = 150; anchor < durationSec - 20 && suggestions.length < 10; anchor += 150) {
    const start = Number(anchor.toFixed(3));
    const end = Number(Math.min(durationSec, anchor + 3).toFixed(3));
    if (end > start + 0.2) suggestions.push({ start, end });
  }
  return suggestions;
};

const computeManualRemovalRatio = (markers: ManualTimestampMarker[], durationSec: number) => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const explicitKeeps = markers.filter((marker) => marker.type === "keep");
  const removals = markers.filter((marker) => marker.type === "remove");
  const baseRanges = explicitKeeps.length > 0
    ? explicitKeeps.map((range) => ({ start: range.start, end: range.end }))
    : [{ start: 0, end: durationSec }];
  const merged = [...baseRanges].sort((a, b) => a.start - b.start).reduce<Array<{ start: number; end: number }>>((acc, range) => {
    const current = {
      start: clamp(range.start, 0, durationSec),
      end: clamp(range.end, 0, durationSec),
    };
    if (current.end <= current.start) return acc;
    const prev = acc[acc.length - 1];
    if (!prev || current.start > prev.end) {
      acc.push(current);
    } else {
      prev.end = Math.max(prev.end, current.end);
    }
    return acc;
  }, []);
  let keepDuration = merged.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
  if (removals.length > 0) {
    const removeDuration = removals.reduce((sum, range) => sum + Math.max(0, range.end - range.start), 0);
    keepDuration = Math.max(0, keepDuration - removeDuration);
  }
  const removed = Math.max(0, durationSec - keepDuration);
  return clamp01(removed / Math.max(0.1, durationSec));
};

const computeManualRetentionDelta = ({
  markers,
  durationSec,
  autoAssist,
}: {
  markers: ManualTimestampMarker[];
  durationSec: number;
  autoAssist: boolean;
}) => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  const manualHook = markers.find((marker) => marker.type === "hook" && marker.source === "user")
    || markers.find((marker) => marker.type === "hook")
    || null;
  const removeRatio = computeManualRemovalRatio(markers, durationSec);
  const keepSegments = markers.filter((marker) => marker.type === "keep");
  const longestKeep = keepSegments.reduce((max, marker) => Math.max(max, marker.end - marker.start), 0);
  let score = 0;
  if (manualHook && manualHook.start <= 0.35) score += 8;
  else if (manualHook) score += 4;
  else if (autoAssist) score += 3;
  else score -= 2;
  score += Math.min(6, keepSegments.length * 0.7);
  if (removeRatio > 0.4) score -= Math.min(15, 4 + (removeRatio - 0.4) * 42);
  if (longestKeep > 45) score -= Math.min(10, (longestKeep - 45) / 9);
  return Number(clamp(score, -25, 25).toFixed(2));
};

const normalizeManualPreviewRange = (
  range: { start: number; end: number },
  durationSec: number,
): ManualPreviewSegment | null => {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  const start = Number(clamp(Number(range.start || 0), 0, Math.max(0, durationSec - 0.05)).toFixed(3));
  const end = Number(clamp(Number(range.end || 0), start + 0.05, Math.max(start + 0.05, durationSec)).toFixed(3));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.05) return null;
  return { start, end };
};

const mergeManualPreviewRanges = (ranges: ManualPreviewSegment[]): ManualPreviewSegment[] => {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  return sorted.reduce<ManualPreviewSegment[]>((acc, range) => {
    const prev = acc[acc.length - 1];
    if (!prev || range.start > prev.end) {
      acc.push({ start: range.start, end: range.end });
      return acc;
    }
    prev.end = Math.max(prev.end, range.end);
    return acc;
  }, []);
};

const subtractManualPreviewRangeFromSegments = (
  segments: ManualPreviewSegment[],
  cut: ManualPreviewSegment,
): ManualPreviewSegment[] => {
  const out: ManualPreviewSegment[] = [];
  for (const segment of segments) {
    if (cut.end <= segment.start || cut.start >= segment.end) {
      out.push(segment);
      continue;
    }
    if (cut.start > segment.start + 0.001) {
      out.push({
        start: Number(segment.start.toFixed(3)),
        end: Number(Math.min(segment.end, cut.start).toFixed(3)),
      });
    }
    if (cut.end < segment.end - 0.001) {
      out.push({
        start: Number(Math.max(segment.start, cut.end).toFixed(3)),
        end: Number(segment.end.toFixed(3)),
      });
    }
  }
  return out.filter((segment) => segment.end - segment.start >= 0.05);
};

const subtractManualPreviewRangesFromSegments = (
  segments: ManualPreviewSegment[],
  cuts: ManualPreviewSegment[],
): ManualPreviewSegment[] => {
  let next = [...segments];
  for (const cut of cuts) {
    next = subtractManualPreviewRangeFromSegments(next, cut);
    if (!next.length) return [];
  }
  return next;
};

const buildManualPreviewPlan = ({
  enabled,
  markers,
  durationSec,
}: {
  enabled: boolean;
  markers: ManualTimestampMarker[];
  durationSec: number;
}): ManualPreviewPlan | null => {
  if (!enabled || !Number.isFinite(durationSec) || durationSec <= 0.1) return null;
  const keepRanges = mergeManualPreviewRanges(
    markers
      .filter((marker) => marker.type === "keep")
      .map((marker) => normalizeManualPreviewRange({ start: marker.start, end: marker.end }, durationSec))
      .filter((range: ManualPreviewSegment | null): range is ManualPreviewSegment => Boolean(range)),
  );
  const removeRanges = mergeManualPreviewRanges(
    markers
      .filter((marker) => marker.type === "remove")
      .map((marker) => normalizeManualPreviewRange({ start: marker.start, end: marker.end }, durationSec))
      .filter((range: ManualPreviewSegment | null): range is ManualPreviewSegment => Boolean(range)),
  );
  const baseKeepRanges = keepRanges.length
    ? keepRanges
    : [{ start: 0, end: Number(durationSec.toFixed(3)) }];
  let effectiveSegments = baseKeepRanges.map((range) => ({ start: range.start, end: range.end }));
  if (removeRanges.length > 0) {
    effectiveSegments = subtractManualPreviewRangesFromSegments(effectiveSegments, removeRanges);
  }
  if (!effectiveSegments.length) {
    const fallbackEnd = Number(clamp(durationSec * 0.35, 0.6, durationSec).toFixed(3));
    effectiveSegments = [{ start: 0, end: fallbackEnd }];
  }
  const hookMarker = markers.find((marker) => marker.type === "hook" && marker.source === "user")
    || markers.find((marker) => marker.type === "hook")
    || null;
  const hookRange = hookMarker
    ? normalizeManualPreviewRange({ start: hookMarker.start, end: hookMarker.end }, durationSec)
    : null;
  const segments = hookRange
    ? [
        { start: hookRange.start, end: hookRange.end },
        ...subtractManualPreviewRangeFromSegments(
          effectiveSegments.map((segment) => ({ ...segment })),
          hookRange,
        ),
      ]
    : effectiveSegments.map((segment) => ({ ...segment }));
  return {
    segments: segments.filter((segment) => segment.end - segment.start >= 0.05),
    keepRanges: baseKeepRanges,
    removeRanges,
    hookRange,
  };
};

const findManualPreviewSegmentIndex = (segments: ManualPreviewSegment[], sourceTime: number) => {
  const safeTime = Number(sourceTime || 0);
  return segments.findIndex((segment) => (
    safeTime >= segment.start - 0.025 && safeTime <= segment.end - 0.01
  ));
};

const snapToManualPreviewTime = (segments: ManualPreviewSegment[], sourceTime: number) => {
  if (!segments.length) return Number(Math.max(0, sourceTime).toFixed(3));
  const safeTime = Number(Math.max(0, sourceTime).toFixed(3));
  const insideIndex = findManualPreviewSegmentIndex(segments, safeTime);
  if (insideIndex >= 0) {
    const inside = segments[insideIndex];
    return Number(clamp(safeTime, inside.start, inside.end).toFixed(3));
  }
  if (safeTime <= segments[0].start) return Number(segments[0].start.toFixed(3));
  for (let index = 0; index < segments.length - 1; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    if (safeTime > current.end && safeTime < next.start) {
      return Number(next.start.toFixed(3));
    }
  }
  const last = segments[segments.length - 1];
  return Number(last.end.toFixed(3));
};

const buildManualConfigSignature = ({
  enabled,
  autoAssist,
  markers,
  suggestions,
}: {
  enabled: boolean;
  autoAssist: boolean;
  markers: ManualTimestampMarker[];
  suggestions: ManualTimestampSuggestion[];
}) => {
  const markerSignature = [...markers]
    .map((marker) => ({
      type: marker.type,
      start: Number(marker.start.toFixed(3)),
      end: Number(marker.end.toFixed(3)),
      source: marker.source,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  const suggestionSignature = [...suggestions]
    .map((suggestion) => ({
      type: suggestion.type,
      start: Number(suggestion.start.toFixed(3)),
      end: Number(suggestion.end.toFixed(3)),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
  return JSON.stringify({
    enabled: Boolean(enabled),
    autoAssist: Boolean(autoAssist),
    markers: markerSignature,
    suggestions: suggestionSignature,
  });
};

const buildAiManualSuggestionsFromAnalysis = (analysis: any, durationSec: number): ManualTimestampSuggestion[] => {
  const suggestions: ManualTimestampSuggestion[] = [];
  const pushUnique = (candidate: ManualTimestampSuggestion) => {
    const duplicate = suggestions.some((existing) => (
      existing.type === candidate.type &&
      Math.abs(existing.start - candidate.start) < 0.08 &&
      Math.abs(existing.end - candidate.end) < 0.08
    ));
    if (!duplicate) suggestions.push(candidate);
  };
  const hookCandidates = normalizeHookCandidates(
    analysis?.hook_variants ||
    analysis?.hook_candidates ||
    analysis?.editPlan?.hookCandidates ||
    analysis?.editPlan?.hookVariants,
  );
  const firstHook = hookCandidates[0] || null;
  if (firstHook) {
    pushUnique({
      id: `ai_hook_${Math.round(firstHook.start * 1000)}`,
      type: "hook",
      start: Number(firstHook.start.toFixed(3)),
      end: Number((firstHook.start + firstHook.duration).toFixed(3)),
      rationale: firstHook.reason || "Top-ranked hook candidate.",
      source: "ai",
    });
  }
  const removeRangesRaw = Array.isArray(analysis?.boredom_ranges)
    ? analysis.boredom_ranges
    : Array.isArray(analysis?.removed_segments)
      ? analysis.removed_segments
      : [];
  removeRangesRaw.slice(0, 4).forEach((range: any, index: number) => {
    const start = Number(range?.start);
    const end = Number(range?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    pushUnique({
      id: `ai_remove_${index}_${Math.round(start * 1000)}`,
      type: "remove",
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      rationale: "Low-energy/dead-air window.",
      source: "ai",
    });
  });
  const segmentRangesRaw = Array.isArray(analysis?.editPlan?.segments)
    ? analysis.editPlan.segments
    : Array.isArray(analysis?.metadata_summary?.segments)
      ? analysis.metadata_summary.segments
      : [];
  segmentRangesRaw.slice(0, 4).forEach((segment: any, index: number) => {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    pushUnique({
      id: `ai_cut_${index}_${Math.round(start * 1000)}`,
      type: "cut",
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      rationale: "Scene-change/energy segment to keep.",
      source: "ai",
    });
  });
  if (durationSec >= 180) {
    buildMicroHookSuggestions(durationSec).slice(0, 3).forEach((range, index) => {
      pushUnique({
        id: `ai_micro_hook_${index}_${Math.round(range.start * 1000)}`,
        type: "hook",
        start: range.start,
        end: range.end,
        rationale: "Micro-hook insert for long-form retention.",
        source: "ai",
      });
    });
  }
  return suggestions.slice(0, 10);
};

const mapSuggestionToManualMarker = (suggestion: ManualTimestampSuggestion): ManualTimestampMarker => ({
  id: `marker_${suggestion.id}_${Date.now()}`,
  type: suggestion.type === "cut" ? "keep" : suggestion.type,
  start: Number(suggestion.start.toFixed(3)),
  end: Number(suggestion.end.toFixed(3)),
  source: "ai",
  rationale: suggestion.rationale,
});

const normalizeOutcomeAutomationEditorMode = (value: unknown): EditorModeSelection => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined") return "auto";
  return EDITOR_MODE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as EditorModeSelection)
    : "auto";
};

const mapEditorModeForBackend = (value: EditorModeSelection): EditorModeSelection => value;

const normalizeHookSelectionMode = (value: unknown): HookSelectionMode => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "undefined") return "auto";
  if (normalized === "auto" || normalized === "automatic" || normalized === "editor") return "auto";
  if (normalized === "manual" || normalized === "user" || normalized === "user_selected") return "manual";
  return "auto";
};

const resolveSelectedHookFromAnalysis = (analysis: any): HookCandidate | null => {
  const source = analysis && typeof analysis === "object" ? analysis : {};
  const hookStartSec = Number(source?.hook_start_time ?? source?.hook?.start ?? NaN);
  const hookEndSec = Number(
    source?.hook_end_time ??
    (Number.isFinite(hookStartSec) ? hookStartSec + Number(source?.hook?.duration ?? 0) : NaN),
  );
  const hookText = typeof source?.hook_text === "string" ? source.hook_text : "";
  const hookReason = typeof source?.hook_reason === "string" ? source.hook_reason : "";
  if (Number.isFinite(hookStartSec) && Number.isFinite(hookEndSec) && hookEndSec > hookStartSec) {
    return {
      start: hookStartSec,
      duration: Math.max(0.1, hookEndSec - hookStartSec),
      score: Number.isFinite(Number(source?.hook_score)) ? Number(source?.hook_score) : 0,
      auditScore: Number.isFinite(Number(source?.hook_audit_score))
        ? Number(source?.hook_audit_score)
        : Number.isFinite(Number(source?.hook_score))
          ? Number(source?.hook_score)
          : 0,
      auditPassed: Boolean(source?.hook_audit_passed ?? true),
      text: hookText,
      reason: hookReason,
      synthetic: Boolean(source?.hook_synthetic),
    };
  }

  const selectedFromPipeline = normalizeHookCandidates(
    source?.pipelineSteps?.HOOK_SELECT_AND_AUDIT?.meta?.selectedHook
      ? [source.pipelineSteps.HOOK_SELECT_AND_AUDIT.meta.selectedHook]
      : [],
  )[0] ?? null;
  if (selectedFromPipeline) return selectedFromPipeline;

  const fallbackPool: unknown[] = [];
  if (source?.preferred_hook) fallbackPool.push(source.preferred_hook);
  if (Array.isArray(source?.hook_variants)) fallbackPool.push(...source.hook_variants);
  if (Array.isArray(source?.hook_candidates)) fallbackPool.push(...source.hook_candidates);
  if (Array.isArray(source?.editPlan?.hookVariants)) fallbackPool.push(...source.editPlan.hookVariants);
  if (Array.isArray(source?.editPlan?.hookCandidates)) fallbackPool.push(...source.editPlan.hookCandidates);
  return normalizeHookCandidates(fallbackPool)[0] ?? null;
};

const getRequiredPlanForSubtitlePreset = (presetId: SubtitlePresetId): PlanTier => {
  for (const tier of PLAN_TIERS) {
    const allowed = PLAN_CONFIG[tier]?.allowedSubtitlePresets ?? PLAN_CONFIG.free.allowedSubtitlePresets;
    if (allowed === "ALL" || allowed.includes(presetId)) return tier;
  }
  return "studio";
};

const toPlanTier = (value?: string | null): PlanTier | null => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  return PLAN_CONFIG[normalized as PlanTier] ? (normalized as PlanTier) : null;
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
    smartZoom?: boolean;
    transitions?: boolean;
    soundFx?: boolean;
  };
  capabilities?: {
    captions?: CaptionCapability;
  };
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
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const { snapshot: liveSnapshot, pulse: livePulse } = useLiveStats();
  const getRenderModeLabel = (mode: RenderModeSelection) =>
    mode === "vertical" ? t("editor.mode.vertical") : t("editor.mode.horizontal");
  const getEditorModeLabel = (mode: EditorModeSelection, fallback: string) =>
    t(`editor.contentType.${mode}.label`, { defaultValue: fallback });
  const getEditorModeDescription = (mode: EditorModeSelection, fallback: string) =>
    t(`editor.contentType.${mode}.description`, { defaultValue: fallback });
  const modeParam = searchParams.get("mode");
  const successParam = String(searchParams.get("success") || "").toLowerCase();
  const successTierParam = toPlanTier(searchParams.get("tier"));
  const isVerticalMode = modeParam === "vertical";
  const defaultVerticalCaptionStyle = VERTICAL_CAPTION_STYLE_DEFAULTS[DEFAULT_VERTICAL_CAPTION_PRESET];
  const [verticalSelectionMode, setVerticalSelectionMode] = useState<VerticalSelectionMode>(DEFAULT_VERTICAL_SELECTION_MODE);
  const [verticalClipCount, setVerticalClipCount] = useState(DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE[DEFAULT_VERTICAL_SELECTION_MODE]);
  const [verticalClipCountTouched, setVerticalClipCountTouched] = useState(false);
  const [verticalZoomProfile, setVerticalZoomProfile] = useState<VerticalZoomProfile>(DEFAULT_VERTICAL_ZOOM_PROFILE);
  const [verticalZoomIntensity, setVerticalZoomIntensity] = useState(DEFAULT_VERTICAL_ZOOM_INTENSITY);
  const [verticalCardReorderEnabled, setVerticalCardReorderEnabled] = useState(false);
  const [verticalEditorCardOrder, setVerticalEditorCardOrder] = useState<VerticalEditorCardId[]>(DEFAULT_VERTICAL_EDITOR_CARD_ORDER);
  const [verticalCaptionEnabled, setVerticalCaptionEnabled] = useState(true);
  const [verticalCaptionAutoGenerate, setVerticalCaptionAutoGenerate] = useState(true);
  const [verticalCaptionPreset, setVerticalCaptionPreset] = useState<VerticalCaptionPreset>(DEFAULT_VERTICAL_CAPTION_PRESET);
  const activeVerticalCaptionPresetStyle = VERTICAL_CAPTION_STYLE_DEFAULTS[verticalCaptionPreset];
  const [verticalCaptionFontSize, setVerticalCaptionFontSize] = useState(VERTICAL_CAPTION_FONT_SIZE_DEFAULT);
  const [verticalCaptionFontId, setVerticalCaptionFontId] = useState<SubtitleStyleConfig["fontId"]>(defaultVerticalCaptionStyle.fontId);
  const [verticalCaptionTextColor, setVerticalCaptionTextColor] = useState(defaultVerticalCaptionStyle.textColor);
  const [verticalCaptionAccentColor, setVerticalCaptionAccentColor] = useState(defaultVerticalCaptionStyle.accentColor);
  const [verticalCaptionOutlineColor, setVerticalCaptionOutlineColor] = useState(defaultVerticalCaptionStyle.outlineColor);
  const [verticalCaptionOutlineWidth, setVerticalCaptionOutlineWidth] = useState(defaultVerticalCaptionStyle.outlineWidth);
  const [verticalCaptionShadowEnabled, setVerticalCaptionShadowEnabled] = useState(defaultVerticalCaptionStyle.shadowEnabled);
  const [verticalCaptionShadowColor, setVerticalCaptionShadowColor] = useState(defaultVerticalCaptionStyle.shadowColor);
  const [verticalCaptionShadowBlur, setVerticalCaptionShadowBlur] = useState(defaultVerticalCaptionStyle.shadowBlur);
  const [verticalCaptionBoxEnabled, setVerticalCaptionBoxEnabled] = useState(defaultVerticalCaptionStyle.boxEnabled);
  const [verticalCaptionBoxColor, setVerticalCaptionBoxColor] = useState(defaultVerticalCaptionStyle.boxColor);
  const [verticalCaptionAnimationMode, setVerticalCaptionAnimationMode] = useState<VerticalCaptionAnimationMode>(
    defaultVerticalCaptionStyle.animation,
  );
  const [verticalCaptionPositionX, setVerticalCaptionPositionX] = useState(0.5);
  const [verticalCaptionPositionY, setVerticalCaptionPositionY] = useState(0.84);
  const [verticalCaptionText, setVerticalCaptionText] = useState("");
  const [verticalCaptionInlineEditorOpen, setVerticalCaptionInlineEditorOpen] = useState(false);
  const [verticalCaptionInlineDraft, setVerticalCaptionInlineDraft] = useState("");
  const [pendingVerticalFile, setPendingVerticalFile] = useState<File | null>(null);
  const [verticalPreviewUrl, setVerticalPreviewUrl] = useState<string | null>(null);
  const [skipManualWebcamCrop, setSkipManualWebcamCrop] = useState(false);
  const [onlyHookAndCut, setOnlyHookAndCut] = useState(false);
  const [maxCutsRequested, setMaxCutsRequested] = useState(DEFAULT_MAX_CUTS);
  const [editorMode, setEditorMode] = useState<EditorModeSelection>("auto");
  const [defaultHookSelectionMode, setDefaultHookSelectionMode] = useState<HookSelectionMode>("auto");
  const [longFormPreset, setLongFormPreset] = useState<LongFormPreset>("auto");
  const [longFormAggression, setLongFormAggression] = useState(45);
  const [longFormClarityVsSpeed, setLongFormClarityVsSpeed] = useState(68);
  const [tangentKiller, setTangentKiller] = useState(false);
  const [outcomeAutomationProfile, setOutcomeAutomationProfile] = useState<OutcomeAutomationProfile | null>(null);
  const [hideJobsPanel, setHideJobsPanel] = useState(true);
  const [hideEditorControlsPanel, setHideEditorControlsPanel] = useState(false);
  const [editorModeConfirmed, setEditorModeConfirmed] = useState(false);
  const [editorSettingsSection, setEditorSettingsSection] = useState<EditorSettingsSection>("format");
  const [webcamCrop, setWebcamCrop] = useState<WebcamCrop | null>(null);
  const [sourceVideoMeta, setSourceVideoMeta] = useState<{ width: number; height: number } | null>(null);
  const [webcamTopHeightPct, setWebcamTopHeightPct] = useState(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
  const [webcamPaddingPx, setWebcamPaddingPx] = useState(DEFAULT_WEBCAM_PADDING_PX);
  const [bottomFitMode, setBottomFitMode] = useState<VerticalFitMode>("cover");
  const [cropInteraction, setCropInteraction] = useState<CropInteraction | null>(null);
  const [captionDragInteraction, setCaptionDragInteraction] = useState<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [retentionStrategyProfile, setRetentionStrategyProfile] = useState<RetentionStrategyProfile>("balanced");
  const [retentionTargetPlatform, setRetentionTargetPlatform] = useState<RetentionTargetPlatform>(
    isVerticalMode ? "tiktok" : "youtube",
  );
  const [subtitleStyleDraft, setSubtitleStyleDraft] = useState<string>("basic_clean");
  const [subtitleStyleDirty, setSubtitleStyleDirty] = useState(false);
  const [autoCaptionsEnabled, setAutoCaptionsEnabled] = useState(true);
  const [smartZoomEnabled, setSmartZoomEnabled] = useState(true);
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [viralMode, setViralMode] = useState<ViralModeSelection>("none");
  const [enhanceMode, setEnhanceMode] = useState<EnhanceModeSelection>("all");
  const [showEffectPreview, setShowEffectPreview] = useState(false);
  const [effectPreviewUrl, setEffectPreviewUrl] = useState("");
  const [effectPreviewLoading, setEffectPreviewLoading] = useState(false);
  const [effectPreviewError, setEffectPreviewError] = useState("");
  const [currentEffectPreview, setCurrentEffectPreview] = useState<EffectPreviewSelection>("all");
  const [effectPreviewRefreshNonce, setEffectPreviewRefreshNonce] = useState(0);
  const [captionCapability, setCaptionCapability] = useState<CaptionCapability>({ available: true });
  const [savingSubtitleStyle, setSavingSubtitleStyle] = useState(false);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);
  const [creatorFeedbackSubmitting, setCreatorFeedbackSubmitting] = useState<CreatorFeedbackCategory | null>(null);
  const [mobilePipeline, setMobilePipeline] = useState(false);
  const [pipelineLogOpen, setPipelineLogOpen] = useState(false);
  const [retentionDetailsOpen, setRetentionDetailsOpen] = useState(false);
  const [applyingHookJobId, setApplyingHookJobId] = useState<string | null>(null);
  const [hookSelectorOpen, setHookSelectorOpen] = useState(false);
  const [editorGuideOpen, setEditorGuideOpen] = useState(false);
  const [helpDemoStepIndex, setHelpDemoStepIndex] = useState(0);
  const [helpDemoPlaying, setHelpDemoPlaying] = useState(true);
  const [hookPromptedByJob, setHookPromptedByJob] = useState<Record<string, boolean>>({});
  const [selectedHookByJob, setSelectedHookByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookSelectionModeByJob, setHookSelectionModeByJob] = useState<Record<string, HookSelectionMode>>({});
  const [hookPreviewCandidateByJob, setHookPreviewCandidateByJob] = useState<Record<string, HookCandidate | null>>({});
  const [hookPreviewUrlByJob, setHookPreviewUrlByJob] = useState<Record<string, string>>({});
  const [hookPreviewErrorByJob, setHookPreviewErrorByJob] = useState<Record<string, string>>({});
  const [hookPreviewLoadingJobId, setHookPreviewLoadingJobId] = useState<string | null>(null);
  const [hookPreviewRefreshNonceByJob, setHookPreviewRefreshNonceByJob] = useState<Record<string, number>>({});
  const [proxyPreviewUrlByJob, setProxyPreviewUrlByJob] = useState<Record<string, string>>({});
  const [proxyPreviewRefreshNonceByJob, setProxyPreviewRefreshNonceByJob] = useState<Record<string, number>>({});
  const [manualMode, setManualMode] = useState(false);
  const [manualAutoAssist, setManualAutoAssist] = useState(false);
  const [manualMarkersByJob, setManualMarkersByJob] = useState<Record<string, ManualTimestampMarker[]>>({});
  const [manualSuggestionsByJob, setManualSuggestionsByJob] = useState<Record<string, ManualTimestampSuggestion[]>>({});
  const [manualSavedSignatureByJob, setManualSavedSignatureByJob] = useState<Record<string, string>>({});
  const [manualAiSuggestLoadingJobId, setManualAiSuggestLoadingJobId] = useState<string | null>(null);
  const [manualTimestampEditorOpen, setManualTimestampEditorOpen] = useState(false);
  const [inputPreviewUrlByJob, setInputPreviewUrlByJob] = useState<Record<string, string>>({});
  const [previewDurationByJob, setPreviewDurationByJob] = useState<Record<string, number>>({});
  const [previewCurrentTimeByJob, setPreviewCurrentTimeByJob] = useState<Record<string, number>>({});
  const [previewPlayingByJob, setPreviewPlayingByJob] = useState<Record<string, boolean>>({});
  const [manualPlaybackRateByJob, setManualPlaybackRateByJob] = useState<Record<string, number>>({});
  const menuTouchedRef = useRef<{ strategy: boolean; targetPlatform: boolean; editorMode: boolean }>({
    strategy: false,
    targetPlatform: false,
    editorMode: false,
  });
  const sourcePreviewRef = useRef<HTMLDivElement | null>(null);
  const verticalSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionVideoRef = useRef<HTMLVideoElement | null>(null);
  const verticalCompositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const verticalCompositionFrameRef = useRef<HTMLDivElement | null>(null);
  const verticalCaptionInlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const helpDemoVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hookPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackTelemetryRef = useRef<Record<string, PreviewPlaybackTelemetry>>({});
  const retentionFeedbackDispatchRef = useRef<Record<string, { at: number; signature: string }>>({});
  const retentionFeedbackInFlightRef = useRef<Record<string, boolean>>({});
  const downloadFeedbackSentRef = useRef<Record<string, boolean>>({});
  const manualHydratedSignatureByJobRef = useRef<Record<string, string>>({});
  const liveSettingsSyncSignatureByJobRef = useRef<Record<string, string>>({});
  const liveSettingsSyncInFlightRef = useRef<Record<string, boolean>>({});
  const pageViewTrackedRef = useRef(false);
  const editorGuidePromptedRef = useRef(false);
  const successToastShownRef = useRef(false);
  const minutesWarningToastRef = useRef<string | null>(null);
  const analyticsSessionId = useMemo(() => getAnalyticsSessionId(), []);

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  const { data: me, refetch: refetchMe } = useMe({ refetchInterval: hasActiveJobs ? 2500 : false });
  const [entitlements, setEntitlements] = useState<{ autoDownloadAllowed?: boolean } | null>(null);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean | null>(null);
  const [autoDownloadModal, setAutoDownloadModal] = useState<{ open: boolean; url?: string; fileName?: string; jobId?: string }>({ open: false });
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const [reprocessingJobId, setReprocessingJobId] = useState<string | null>(null);
  const [trialUpgradeOpen, setTrialUpgradeOpen] = useState(false);
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const paidTier = isPaidTier(tier) || Boolean(me?.flags?.dev);
  const activeEditorsNow = livePulse?.activeUsers ?? liveSnapshot?.activeUsers ?? 0;
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
  const isDevAccount = Boolean(me?.flags?.dev);
  const qualityTier: PlanTier = isDevAccount ? "studio" : (trialActive ? trialUnlockTier : tier);
  const maxQuality = (PLAN_CONFIG[qualityTier] ?? PLAN_CONFIG.free).exportQuality;
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
  const activeHelpDemoStep = HELP_DEMO_STEPS[helpDemoStepIndex] ?? HELP_DEMO_STEPS[0];
  const helpDemoProgress = useMemo(
    () => Math.round(((helpDemoStepIndex + 1) / HELP_DEMO_STEPS.length) * 100),
    [helpDemoStepIndex],
  );
  const tierLabel = isDevAccount ? "Dev" : tier === "free" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const rendersUsed = me?.usage?.rendersUsed ?? 0;
  const maxRendersPerMonth = me?.limits?.maxRendersPerMonth ?? null;
  const rendersRemaining = useMemo(() => {
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return null;
    return Math.max(0, maxRendersPerMonth - rendersUsed);
  }, [maxRendersPerMonth, rendersUsed]);
  const maxRerendersPerDay = me?.limits?.maxRerendersPerDay ?? PLAN_CONFIG[tier].maxRerendersPerDay;
  const rerendersUsedToday = me?.rerenderUsageDaily?.rerendersUsed ?? 0;
  const freeMinutesWarning = me?.usageWarnings?.freeMinutes ?? null;
  const rerendersRemainingToday = useMemo(() => {
    if (maxRerendersPerDay === null || maxRerendersPerDay === undefined) return null;
    return Math.max(0, maxRerendersPerDay - rerendersUsedToday);
  }, [maxRerendersPerDay, rerendersUsedToday]);
  const hasReachedRenderLimitForMode = useCallback((_mode: RenderModeSelection) => {
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
      const result = await apiFetch<EditorSettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ subtitleStyle: nextStyle, autoCaptions: autoCaptionsEnabled }),
        token: accessToken,
      });
      const runtimeCaptions = result?.capabilities?.captions;
      if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
        setCaptionCapability(runtimeCaptions);
      }
      const persisted = normalizeSubtitleStyleFromSettings(result?.settings?.subtitleStyle ?? nextStyle);
      const persistedAutoCaptions =
        typeof result?.settings?.autoCaptions === "boolean"
          ? result.settings.autoCaptions
          : autoCaptionsEnabled;
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
    if (successParam !== "true" || successToastShownRef.current) return;
    const unlockedTier = successTierParam ?? toPlanTier(me?.subscription?.tier as string | undefined) ?? tier;
    const plan = PLAN_CONFIG[unlockedTier] ?? PLAN_CONFIG.free;
    const minutesLabel = plan.maxMinutesPerMonth === null ? "Unlimited" : String(plan.maxMinutesPerMonth);
    const qualityLabel =
      plan.exportQuality === "4k" ? "4K exports" : plan.exportQuality === "1080p" ? "1080p exports" : "720p exports";
    successToastShownRef.current = true;
    toast({
      title: `Congrats! You've unlocked ${plan.name} — enjoy ${minutesLabel} minutes/mo + ${qualityLabel}!`,
      description: "Premium features are now active.",
    });
    void refetchMe();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("success");
      next.delete("tier");
      next.delete("session_id");
      next.delete("source");
      next.delete("trial");
      next.delete("endsAt");
      return next;
    }, { replace: true });
  }, [successParam, successTierParam, me?.subscription?.tier, tier, toast, refetchMe, setSearchParams]);

  useEffect(() => {
    if (isDevAccount || !freeMinutesWarning?.reached) return;
    const warningKey = `${freeMinutesWarning.used}:${freeMinutesWarning.blocked ? "blocked" : "warn"}`;
    if (minutesWarningToastRef.current === warningKey) return;
    minutesWarningToastRef.current = warningKey;
    if (freeMinutesWarning.blocked) {
      toast({
        title: "Monthly minutes limit reached",
        description: "Upgrade for more minutes.",
      });
      return;
    }
    toast({
      title: "Approaching monthly minutes limit",
      description: `${freeMinutesWarning.used}/${freeMinutesWarning.limit} minutes used. Free users are blocked at ${freeMinutesWarning.limit}.`,
    });
  }, [isDevAccount, freeMinutesWarning, toast]);

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

  useEffect(() => {
    if (!editorGuideOpen) {
      setHelpDemoPlaying(true);
      return;
    }
    setHelpDemoStepIndex(0);
    setHelpDemoPlaying(true);
  }, [editorGuideOpen]);

  useEffect(() => {
    if (!editorGuideOpen || !helpDemoPlaying || HELP_DEMO_STEPS.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setHelpDemoStepIndex((prev) => (prev + 1) % HELP_DEMO_STEPS.length);
    }, HELP_DEMO_ROTATE_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [editorGuideOpen, helpDemoPlaying]);

  useEffect(() => {
    if (!editorGuideOpen) return;
    const videoEl = helpDemoVideoRef.current;
    if (!videoEl) return;
    if (helpDemoPlaying) {
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // ignore autoplay blocks; user can still scrub the walkthrough.
        });
      }
      return;
    }
    videoEl.pause();
  }, [editorGuideOpen, helpDemoPlaying, helpDemoStepIndex]);

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
      if (!paidTier && !isDevAccount) {
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
    [accessToken, activeJob?.id, activeSubtitlePreset, fetchJob, isDevAccount, paidTier, toast, trackEditorEvent, retentionStrategyProfile, retentionTargetPlatform],
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
        setAutoCaptionsEnabled(Boolean(d?.settings?.autoCaptions));
        const nextSmartZoom = typeof d?.settings?.smartZoom === "boolean" ? Boolean(d.settings.smartZoom) : true;
        const nextTransitions = typeof d?.settings?.transitions === "boolean" ? Boolean(d.settings.transitions) : true;
        const nextSoundFx = typeof d?.settings?.soundFx === "boolean" ? Boolean(d.settings.soundFx) : true;
        setSmartZoomEnabled(nextSmartZoom);
        setTransitionsEnabled(nextTransitions);
        setSoundFxEnabled(nextSoundFx);
        setEnhanceMode(deriveEnhanceModeFromEffectToggles(nextTransitions, nextSmartZoom, nextSoundFx));
        const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(d?.settings?.subtitleStyle);
        setSubtitleStyleDraft(resolvedSubtitleStyle);
        setSubtitleStyleDirty(false);
        const runtimeCaptions = d?.capabilities?.captions;
        if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
          setCaptionCapability(runtimeCaptions);
          if (!runtimeCaptions.available && !isVerticalMode) {
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
  }, [accessToken, isVerticalMode, signOut]);

  useEffect(() => {
    const timer = setInterval(() => setEtaTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pointerQuery = window.matchMedia("(pointer: coarse)");
    // Mobile signal follows product spec: width <= 767 OR coarse pointer.
    const syncMobileSignal = () => {
      const isMobile =
        window.innerWidth <= 767 ||
        pointerQuery.matches;
      setMobilePipeline(isMobile);
      document.documentElement.classList.toggle("mobile", isMobile);
    };
    syncMobileSignal();
    window.addEventListener("resize", syncMobileSignal, { passive: true });
    window.addEventListener("orientationchange", syncMobileSignal, { passive: true });
    if (typeof pointerQuery.addEventListener === "function") {
      pointerQuery.addEventListener("change", syncMobileSignal);
    } else if (typeof pointerQuery.addListener === "function") {
      pointerQuery.addListener(syncMobileSignal);
    }
    return () => {
      window.removeEventListener("resize", syncMobileSignal);
      window.removeEventListener("orientationchange", syncMobileSignal);
      if (typeof pointerQuery.removeEventListener === "function") {
        pointerQuery.removeEventListener("change", syncMobileSignal);
      } else if (typeof pointerQuery.removeListener === "function") {
        pointerQuery.removeListener(syncMobileSignal);
      }
    };
  }, []);

  useEffect(() => {
    if (mobilePipeline) {
      setPipelineLogOpen(false);
      return;
    }
    setPipelineLogOpen(true);
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
    if (!selectedJobId && jobs.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("jobId", jobs[0].id);
        return next;
      }, { replace: true });
    }
  }, [jobs, selectedJobId, setSearchParams]);

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
    if (!activeJob?.id) return;
    const jobId = activeJob.id;
    const parsed = parseManualTimestampConfigFromAnalysis(activeJob.analysis || {});
    if (!parsed) {
      setManualMode(false);
      setManualAutoAssist(false);
      setManualSavedSignatureByJob((prev) => (
        Object.prototype.hasOwnProperty.call(prev, jobId)
          ? prev
          : {
              ...prev,
              [jobId]: buildManualConfigSignature({
                enabled: false,
                autoAssist: false,
                markers: [],
                suggestions: [],
              }),
            }
      ));
      setPreviewPlayingByJob((prev) => (prev[jobId] ? { ...prev, [jobId]: false } : prev));
      return;
    }

    const signature = `${parsed.updatedAt}|${parsed.enabled ? 1 : 0}|${parsed.markers.length}|${parsed.suggestions.length}|${parsed.autoAssist ? 1 : 0}`;
    if (manualHydratedSignatureByJobRef.current[jobId] !== signature) {
      setManualMarkersByJob((prev) => ({ ...prev, [jobId]: parsed.markers }));
      setManualSuggestionsByJob((prev) => ({ ...prev, [jobId]: parsed.suggestions }));
      setPreviewDurationByJob((prev) => {
        if (prev[jobId]) return prev;
        const fallbackDuration = Number((activeJob as any)?.inputDurationSeconds || 0);
        if (!Number.isFinite(fallbackDuration) || fallbackDuration <= 0) return prev;
        return { ...prev, [jobId]: Number(fallbackDuration.toFixed(3)) };
      });
      setPreviewCurrentTimeByJob((prev) => (Object.prototype.hasOwnProperty.call(prev, jobId) ? prev : { ...prev, [jobId]: 0 }));
      manualHydratedSignatureByJobRef.current[jobId] = signature;
      setManualSavedSignatureByJob((prev) => ({
        ...prev,
        [jobId]: buildManualConfigSignature({
          enabled: parsed.enabled,
          autoAssist: parsed.autoAssist,
          markers: parsed.markers,
          suggestions: parsed.suggestions,
        }),
      }));
    }
    setManualMode(parsed.enabled);
    setManualAutoAssist(parsed.autoAssist);
  }, [activeJob?.id]);

  useEffect(() => {
    if (!activeJob?.id) return;
    const jobId = activeJob.id;
    if (!manualMode) return;
    setHookSelectionModeByJob((prev) => (prev[jobId] === "manual" ? prev : { ...prev, [jobId]: "manual" }));
  }, [activeJob?.id, manualMode]);

  useEffect(() => {
    if (!isVerticalMode) return;
    if (!manualMode && !manualAutoAssist) return;
    setManualMode(false);
    setManualAutoAssist(false);
  }, [isVerticalMode, manualAutoAssist, manualMode]);

  useEffect(() => {
    if (manualMode && !isVerticalMode) return;
    setManualTimestampEditorOpen(false);
  }, [isVerticalMode, manualMode]);

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
                const s = await apiFetch<EditorSettingsResponse>('/api/settings', { token: accessToken });
                setAutoDownloadEnabled(Boolean(s?.settings?.autoDownload));
                setAutoCaptionsEnabled(Boolean(s?.settings?.autoCaptions));
                const nextSmartZoom = typeof s?.settings?.smartZoom === "boolean" ? Boolean(s.settings.smartZoom) : true;
                const nextTransitions = typeof s?.settings?.transitions === "boolean" ? Boolean(s.settings.transitions) : true;
                const nextSoundFx = typeof s?.settings?.soundFx === "boolean" ? Boolean(s.settings.soundFx) : true;
                setSmartZoomEnabled(nextSmartZoom);
                setTransitionsEnabled(nextTransitions);
                setSoundFxEnabled(nextSoundFx);
                setEnhanceMode(deriveEnhanceModeFromEffectToggles(nextTransitions, nextSmartZoom, nextSoundFx));
                const resolvedSubtitleStyle = normalizeSubtitleStyleFromSettings(s?.settings?.subtitleStyle);
                setSubtitleStyleDraft(resolvedSubtitleStyle);
                setSubtitleStyleDirty(false);
                const runtimeCaptions = s?.capabilities?.captions;
                if (runtimeCaptions && typeof runtimeCaptions.available === "boolean") {
                  setCaptionCapability(runtimeCaptions);
                  if (!runtimeCaptions.available && !isVerticalMode) {
                    setAutoCaptionsEnabled(false);
                  }
                }
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
  }, [jobs, refetchMe, entitlements, autoDownloadEnabled, accessToken, isVerticalMode, submitDownloadFeedback]);

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

  const verticalCaptionsForJob = useMemo<VerticalCaptionsPayload>(() => ({
    enabled: verticalCaptionEnabled,
    autoGenerate: verticalCaptionAutoGenerate,
    preset: verticalCaptionPreset,
    fontSize: clampVerticalCaptionFontSize(verticalCaptionFontSize),
    text: normalizeVerticalCaptionTextForJob(verticalCaptionText),
    fontId: verticalCaptionFontId,
    textColor: normalizeVerticalCaptionHex(verticalCaptionTextColor, activeVerticalCaptionPresetStyle.textColor),
    accentColor: normalizeVerticalCaptionHex(verticalCaptionAccentColor, activeVerticalCaptionPresetStyle.accentColor),
    outlineColor: normalizeVerticalCaptionHex(verticalCaptionOutlineColor, activeVerticalCaptionPresetStyle.outlineColor),
    outlineWidth: clampVerticalCaptionOutlineWidth(verticalCaptionOutlineWidth),
    shadowEnabled: verticalCaptionShadowEnabled,
    shadowColor: normalizeVerticalCaptionHex(verticalCaptionShadowColor, activeVerticalCaptionPresetStyle.shadowColor),
    shadowBlur: clampVerticalCaptionShadowBlur(verticalCaptionShadowBlur),
    boxEnabled: verticalCaptionBoxEnabled,
    boxColor: normalizeVerticalCaptionHex(verticalCaptionBoxColor, activeVerticalCaptionPresetStyle.boxColor),
    animationEnabled: verticalCaptionAnimationMode !== "none",
    animation: verticalCaptionAnimationMode,
    positionX: Number(clampVerticalCaptionPosition(verticalCaptionPositionX).toFixed(4)),
    positionY: Number(clampVerticalCaptionPosition(verticalCaptionPositionY).toFixed(4)),
  }), [
    verticalCaptionEnabled,
    verticalCaptionAutoGenerate,
    verticalCaptionPreset,
    verticalCaptionFontSize,
    verticalCaptionText,
    verticalCaptionFontId,
    verticalCaptionTextColor,
    verticalCaptionAccentColor,
    verticalCaptionOutlineColor,
    verticalCaptionOutlineWidth,
    verticalCaptionShadowEnabled,
    verticalCaptionShadowColor,
    verticalCaptionShadowBlur,
    verticalCaptionBoxEnabled,
    verticalCaptionBoxColor,
    verticalCaptionAnimationMode,
    verticalCaptionPositionX,
    verticalCaptionPositionY,
    activeVerticalCaptionPresetStyle,
  ]);

  // Resumable upload logic removed — we use backend-presigned multipart upload to R2

  const handleFile = async (
    file: File,
    renderOptions?: {
      mode?: "horizontal" | "vertical";
      verticalClipCount?: number;
      verticalMode?: VerticalModePayload | null;
      verticalEffects?: {
        smartZoom: boolean;
        transitions: boolean;
        soundFx: boolean;
        autoZoomMax: number;
      } | null;
    },
  ) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4, M4V, or MKV file." });
      return false;
    }
    if (!accessToken) return false;
    const requestedMode = renderOptions?.mode === "vertical" ? "vertical" : "horizontal";
    const verticalEffects = requestedMode === "vertical" ? (renderOptions?.verticalEffects || null) : null;
    const smartZoomForJob = verticalEffects ? verticalEffects.smartZoom : smartZoomEnabled;
    const transitionsForJob = verticalEffects ? verticalEffects.transitions : transitionsEnabled;
    const soundFxForJob = verticalEffects ? verticalEffects.soundFx : soundFxEnabled;
    const autoZoomMaxForJob = verticalEffects ? verticalEffects.autoZoomMax : undefined;
    const effectiveRetentionStrategyProfile: RetentionStrategyProfile = retentionStrategyProfile;
    const effectiveRetentionAggressionLevel = STRATEGY_TO_AGGRESSION[effectiveRetentionStrategyProfile];
    const editorModeForJob = mapEditorModeForBackend(editorMode);
    const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
    const captionsEnabledForJob = autoCaptionsEnabled;
    const verticalCaptionTextForJob = verticalCaptionsForJob.text;
    const subtitlesPayload = {
      enabled: captionsEnabledForJob,
      preset: subtitlePresetForJob,
      style: subtitleStyleForJob,
    };
    const manualTimestampPayload = buildManualTimestampPayload(null);
    const effectiveHookSelectionMode = manualTimestampPayload?.enabled ? "manual" : defaultHookSelectionMode;
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
              maxCuts: maxCutsRequested,
              editorMode: editorModeForJob,
              hookSelectionMode: effectiveHookSelectionMode,
              longFormPreset,
              longFormAggression,
              longFormClarityVsSpeed,
              tangentKiller,
              smartZoom: smartZoomForJob,
              transitions: transitionsForJob,
              soundFx: soundFxForJob,
              ...(autoZoomMaxForJob ? { autoZoomMax: autoZoomMaxForJob } : {}),
              viralMode,
              enhanceMode,
              autoCaptions: captionsEnabledForJob,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              ...(manualTimestampPayload
                ? {
                    manualTimestamp: manualTimestampPayload,
                    manualTimestampEditor: manualTimestampPayload.enabled,
                  }
                : {}),
              verticalClipCount: renderOptions?.verticalClipCount,
              verticalMode: renderOptions?.verticalMode ?? null,
              verticalCaptionText: verticalCaptionTextForJob,
              verticalCaptions: verticalCaptionsForJob,
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
              maxCuts: maxCutsRequested,
              editorMode: editorModeForJob,
              hookSelectionMode: effectiveHookSelectionMode,
              longFormPreset,
              longFormAggression,
              longFormClarityVsSpeed,
              tangentKiller,
              smartZoom: smartZoomForJob,
              transitions: transitionsForJob,
              soundFx: soundFxForJob,
              viralMode,
              enhanceMode,
              autoCaptions: captionsEnabledForJob,
              subtitleStyle: subtitleStyleForJob,
              subtitles: subtitlesPayload,
              ...(manualTimestampPayload
                ? {
                    manualTimestamp: manualTimestampPayload,
                    manualTimestampEditor: manualTimestampPayload.enabled,
                  }
                : {}),
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

      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set("jobId", create.job.id);
        return nextParams;
      }, { replace: false });

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
            autoCaptions: captionsEnabledForJob,
            subtitleStyle: subtitleStyleForJob,
            subtitles: subtitlesPayload,
            maxCuts: maxCutsRequested,
            editorMode: editorModeForJob,
            hookSelectionMode: effectiveHookSelectionMode,
            longFormPreset,
            longFormAggression,
            longFormClarityVsSpeed,
            tangentKiller,
            smartZoom: smartZoomEnabled,
            transitions: transitionsEnabled,
            soundFx: soundFxEnabled,
            viralMode,
            enhanceMode,
            ...(manualTimestampPayload
              ? {
                  manualTimestamp: manualTimestampPayload,
                  manualTimestampEditor: manualTimestampPayload.enabled,
                }
              : {}),
            ...(requestedMode === "vertical"
              ? { verticalCaptionText: verticalCaptionTextForJob, verticalCaptions: verticalCaptionsForJob }
              : {}),
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
    setVerticalSelectionMode(DEFAULT_VERTICAL_SELECTION_MODE);
    setVerticalClipCount(DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE[DEFAULT_VERTICAL_SELECTION_MODE]);
    setVerticalClipCountTouched(false);
    setVerticalZoomProfile(DEFAULT_VERTICAL_ZOOM_PROFILE);
    setVerticalZoomIntensity(DEFAULT_VERTICAL_ZOOM_INTENSITY);
    setVerticalCardReorderEnabled(false);
    setVerticalEditorCardOrder(DEFAULT_VERTICAL_EDITOR_CARD_ORDER);
    setSkipManualWebcamCrop(false);
    setPendingVerticalFile(null);
    setWebcamCrop(null);
    setSourceVideoMeta(null);
    setWebcamTopHeightPct(DEFAULT_WEBCAM_TOP_HEIGHT_PCT);
    setWebcamPaddingPx(DEFAULT_WEBCAM_PADDING_PX);
    setBottomFitMode("cover");
    setCropInteraction(null);
    setCaptionDragInteraction(null);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isVerticalMode]);

  useEffect(() => {
    if (!isVerticalMode) return;
    setVerticalCaptionFontId("impact");
  }, [isVerticalMode]);

  useEffect(() => {
    if (!isVerticalMode) return;
    if (verticalClipCountTouched) return;
    setVerticalClipCount(DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE[verticalSelectionMode]);
  }, [isVerticalMode, verticalSelectionMode, verticalClipCountTouched]);

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

  const setRenderMode = useCallback((mode: RenderModeSelection) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode === "vertical") next.set("mode", "vertical");
      else next.delete("mode");
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const handleSelectRenderMode = useCallback((mode: RenderModeSelection) => {
    trackEditorEvent("render_mode_selected", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: { mode },
    });
    setRenderMode(mode);
    setEditorModeConfirmed(true);
    setEditorSettingsSection("format");
  }, [
    activeSubtitlePreset,
    retentionStrategyProfile,
    retentionTargetPlatform,
    setRenderMode,
    trackEditorEvent,
  ]);

  const applyVerticalCaptionPreset = useCallback((preset: VerticalCaptionPreset) => {
    const defaults = VERTICAL_CAPTION_STYLE_DEFAULTS[preset];
    setVerticalCaptionPreset(preset);
    setVerticalCaptionFontId(defaults.fontId);
    setVerticalCaptionTextColor(defaults.textColor);
    setVerticalCaptionAccentColor(defaults.accentColor);
    setVerticalCaptionOutlineColor(defaults.outlineColor);
    setVerticalCaptionOutlineWidth(clampVerticalCaptionOutlineWidth(defaults.outlineWidth));
    setVerticalCaptionShadowEnabled(defaults.shadowEnabled);
    setVerticalCaptionShadowColor(defaults.shadowColor);
    setVerticalCaptionShadowBlur(clampVerticalCaptionShadowBlur(defaults.shadowBlur));
    setVerticalCaptionBoxEnabled(defaults.boxEnabled);
    setVerticalCaptionBoxColor(defaults.boxColor);
    setVerticalCaptionAnimationMode(defaults.animation);
  }, []);

  const moveVerticalEditorCard = useCallback((cardId: VerticalEditorCardId, direction: "up" | "down") => {
    setVerticalEditorCardOrder((prev) => {
      const currentIndex = prev.indexOf(cardId);
      if (currentIndex === -1) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

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
    setCaptionDragInteraction(null);
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

  const beginCaptionDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!verticalCaptionEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    setCaptionDragInteraction({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: verticalCaptionPositionX,
      startY: verticalCaptionPositionY,
    });
  }, [verticalCaptionEnabled, verticalCaptionPositionX, verticalCaptionPositionY]);

  const openCaptionInlineEditor = useCallback(() => {
    if (!verticalCaptionEnabled || !verticalPreviewUrl) return;
    const fallbackPreviewCaption = verticalCaptionAutoGenerate
      ? (VERTICAL_CAPTION_PREVIEW_FALLBACKS[verticalCaptionPreset] || "")
      : "";
    const seed = String(verticalCaptionText || "").trim().length > 0
      ? verticalCaptionText
      : fallbackPreviewCaption;
    setCaptionDragInteraction(null);
    setVerticalCaptionInlineDraft(normalizeVerticalCaptionEditorText(seed));
    setVerticalCaptionInlineEditorOpen(true);
  }, [verticalCaptionAutoGenerate, verticalCaptionEnabled, verticalCaptionPreset, verticalCaptionText, verticalPreviewUrl]);

  const closeCaptionInlineEditor = useCallback(() => {
    setVerticalCaptionInlineEditorOpen(false);
    setVerticalCaptionInlineDraft("");
  }, []);

  const applyCaptionInlineEditor = useCallback(() => {
    const normalized = normalizeVerticalCaptionEditorText(verticalCaptionInlineDraft);
    setVerticalCaptionText(normalized);
    if (normalized.trim().length > 0) {
      setVerticalCaptionAutoGenerate(false);
    }
    setVerticalCaptionInlineEditorOpen(false);
  }, [verticalCaptionInlineDraft]);

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

  useEffect(() => {
    if (!captionDragInteraction) return;
    const onMove = (event: PointerEvent) => {
      const rect = verticalCompositionFrameRef.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      const dx = (event.clientX - captionDragInteraction.startClientX) / rect.width;
      const dy = (event.clientY - captionDragInteraction.startClientY) / rect.height;
      setVerticalCaptionPositionX(clampVerticalCaptionPosition(captionDragInteraction.startX + dx));
      setVerticalCaptionPositionY(clampVerticalCaptionPosition(captionDragInteraction.startY + dy));
    };
    const onEnd = () => setCaptionDragInteraction(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [captionDragInteraction]);

  useEffect(() => {
    if (!verticalCaptionInlineEditorOpen) return;
    const raf = window.requestAnimationFrame(() => {
      verticalCaptionInlineTextareaRef.current?.focus();
      verticalCaptionInlineTextareaRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [verticalCaptionInlineEditorOpen]);

  useEffect(() => {
    if (verticalCaptionEnabled && verticalPreviewUrl) return;
    setVerticalCaptionInlineEditorOpen(false);
    setVerticalCaptionInlineDraft("");
  }, [verticalCaptionEnabled, verticalPreviewUrl]);

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
  const verticalCaptionPreviewText = useMemo(() => {
    if (!verticalCaptionEnabled) return "";
    const customPreviewCaption = normalizeVerticalCaptionTextForJob(verticalCaptionText)
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) || "";
    if (customPreviewCaption) return customPreviewCaption;
    if (!verticalCaptionAutoGenerate) return "";
    return VERTICAL_CAPTION_PREVIEW_FALLBACKS[verticalCaptionPreset] || "";
  }, [
    verticalCaptionEnabled,
    verticalCaptionAutoGenerate,
    verticalCaptionPreset,
    verticalCaptionText,
  ]);
  const previewCardIndex = verticalEditorCardOrder.indexOf("preview");
  const captionsCardIndex = verticalEditorCardOrder.indexOf("captions");
  const previewCardOrder = previewCardIndex === -1 ? 0 : previewCardIndex;
  const captionsCardOrder = captionsCardIndex === -1 ? 1 : captionsCardIndex;

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
    const previewCaptionText = verticalCaptionPreviewText;
    const previewTextColor = normalizeVerticalCaptionHex(verticalCaptionTextColor, activeVerticalCaptionPresetStyle.textColor);
    const previewAccentColor = normalizeVerticalCaptionHex(verticalCaptionAccentColor, activeVerticalCaptionPresetStyle.accentColor);
    const previewOutlineColor = normalizeVerticalCaptionHex(verticalCaptionOutlineColor, activeVerticalCaptionPresetStyle.outlineColor);
    const previewShadowColor = normalizeVerticalCaptionHex(verticalCaptionShadowColor, activeVerticalCaptionPresetStyle.shadowColor);
    const previewBoxColor = normalizeVerticalCaptionHex(verticalCaptionBoxColor, activeVerticalCaptionPresetStyle.boxColor);
    const shouldUppercase = activeVerticalCaptionPresetStyle.forceUppercase;
    const resolvedOutlineWidth = clampVerticalCaptionOutlineWidth(verticalCaptionOutlineWidth);
    const resolvedShadowBlur = clampVerticalCaptionShadowBlur(verticalCaptionShadowBlur);
    const resolvedPosX = clampVerticalCaptionPosition(verticalCaptionPositionX);
    const resolvedPosY = clampVerticalCaptionPosition(verticalCaptionPositionY);
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

    const drawPreviewCaption = () => {
      if (!previewCaptionText) return;
      const maxWidth = canvasWidth * 0.84;
      const words = previewCaptionText
        .slice(0, 96)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, MAX_VERTICAL_CAPTION_WORDS);
      const lines: string[] = [];
      let current = "";
      const scaledFontSize = clamp(
        Math.round((clampVerticalCaptionFontSize(verticalCaptionFontSize) / DEFAULT_VERTICAL_OUTPUT.width) * canvasWidth),
        24,
        94,
      );
      const baseFont = `${shouldUppercase ? "900" : "800"} ${scaledFontSize}px ${resolveVerticalCaptionCanvasFont(verticalCaptionFontId)}`;
      ctx.font = baseFont;
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !current) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = word;
        if (lines.length >= 2) break;
      }
      if (current && lines.length < 2) lines.push(current);
      if (!lines.length) return;
      const lineHeight = Math.round(scaledFontSize * 1.22);
      const renderedLines = lines.map((line) => (shouldUppercase ? line.toUpperCase() : line));
      const textWidth = Math.max(...renderedLines.map((line) => ctx.measureText(line).width));
      const textBlockHeight = lines.length * lineHeight;
      const centerX = clamp(
        resolvedPosX * canvasWidth,
        textWidth / 2 + 20,
        canvasWidth - textWidth / 2 - 20,
      );
      const centerY = clamp(
        resolvedPosY * canvasHeight,
        textBlockHeight / 2 + 20,
        canvasHeight - textBlockHeight / 2 - 20,
      );
      const captionTop = centerY - textBlockHeight / 2;
      const animationMode = verticalCaptionAnimationMode;
      const animationActive = animationMode !== "none";
      const animationClock = window.performance.now();
      const popScale = clamp(0.92 + 0.12 * Math.sin(animationClock / 180), 0.86, 1.06);
      const bounceScale = clamp(0.88 + 0.18 * Math.abs(Math.sin(animationClock / 130)), 0.86, 1.1);
      const slideOffset = Math.round(16 * Math.sin(animationClock / 220));
      const glitchOffsetX = Math.round(4 * Math.sin(animationClock / 45));
      const glitchOffsetY = Math.round(2 * Math.cos(animationClock / 58));

      ctx.save();
      if (animationActive) {
        ctx.translate(centerX, centerY);
        if (animationMode === "pop") {
          ctx.scale(popScale, popScale);
        } else if (animationMode === "bounce") {
          ctx.scale(bounceScale, bounceScale);
          ctx.translate(0, -3 * Math.abs(Math.sin(animationClock / 120)));
        } else if (animationMode === "slide") {
          ctx.translate(slideOffset, 0);
        } else if (animationMode === "glitch") {
          ctx.translate(glitchOffsetX, glitchOffsetY);
          ctx.globalAlpha = clamp(0.84 + 0.16 * Math.sin(animationClock / 90), 0.72, 1);
        }
        ctx.translate(-centerX, -centerY);
      }

      if (verticalCaptionBoxEnabled) {
        const boxPaddingX = 20;
        const boxPaddingY = 12;
        const boxWidth = Math.min(canvasWidth - 24, textWidth + boxPaddingX * 2);
        const boxHeight = textBlockHeight + boxPaddingY * 2;
        const boxX = clamp(centerX - boxWidth / 2, 12, canvasWidth - boxWidth - 12);
        const boxY = clamp(captionTop - boxPaddingY + 2, 10, canvasHeight - boxHeight - 10);
        ctx.fillStyle = previewBoxColor;
        ctx.strokeStyle = previewOutlineColor;
        ctx.lineWidth = Math.max(1, Math.round(Math.max(2, resolvedOutlineWidth) * 0.35));
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
        ctx.fill();
        ctx.stroke();
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fillGradient = ctx.createLinearGradient(centerX, captionTop, centerX, captionTop + textBlockHeight);
      fillGradient.addColorStop(0, previewAccentColor);
      fillGradient.addColorStop(1, previewTextColor);
      ctx.fillStyle = fillGradient;
      if (verticalCaptionShadowEnabled && resolvedShadowBlur > 0) {
        ctx.shadowColor = previewShadowColor;
        ctx.shadowBlur = Math.max(2, Math.round(resolvedShadowBlur * 0.9));
      }
      if (resolvedOutlineWidth > 0) {
        ctx.strokeStyle = previewOutlineColor;
        ctx.lineWidth = Math.max(1, Math.round((scaledFontSize / 56) * resolvedOutlineWidth));
      }
      renderedLines.forEach((line, index) => {
        const textY = captionTop + lineHeight * (index + 0.5);
        if (resolvedOutlineWidth > 0) {
          ctx.strokeText(line, centerX, textY);
        }
        ctx.fillText(line, centerX, textY);
      });
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.restore();
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
        drawPreviewCaption();
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
    verticalCaptionPreviewText,
    activeVerticalCaptionPresetStyle,
    verticalCaptionFontSize,
    verticalCaptionFontId,
    verticalCaptionTextColor,
    verticalCaptionAccentColor,
    verticalCaptionOutlineColor,
    verticalCaptionOutlineWidth,
    verticalCaptionShadowEnabled,
    verticalCaptionShadowColor,
    verticalCaptionShadowBlur,
    verticalCaptionBoxEnabled,
    verticalCaptionBoxColor,
    verticalCaptionAnimationMode,
    verticalCaptionPositionX,
    verticalCaptionPositionY,
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
    const requestedVerticalClipCount = verticalClipCountTouched ? verticalClipCount : 0;
    const verticalEffects = deriveVerticalModeEffects({
      selectionMode: verticalSelectionMode,
      zoomProfile: verticalZoomProfile,
      zoomIntensity: verticalZoomIntensity,
    });
    const ok = await handleFile(pendingVerticalFile, {
      mode: "vertical",
      verticalClipCount: requestedVerticalClipCount,
      verticalEffects,
      verticalMode: {
        enabled: true,
        output: { ...DEFAULT_VERTICAL_OUTPUT },
        layout: verticalLayout,
        selectionMode: verticalSelectionMode,
        zoomProfile: verticalZoomProfile,
        zoomIntensity: Number((clamp(verticalZoomIntensity, 0, 100) / 100).toFixed(3)),
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
    setCaptionDragInteraction(null);
    setVerticalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handlePickFile = () => {
    setEditorModeConfirmed(false);
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
    setEditorModeConfirmed(false);
    if (isVerticalMode) {
      prepareVerticalFile(file);
      return;
    }
    void handleFile(file);
  };

  const handleSelectJob = (jobId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("jobId", jobId);
      return next;
    }, { replace: false });
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

  const buildManualTimestampPayload = useCallback((jobId?: string | null): ManualTimestampConfigPayload | null => {
    if (isVerticalMode) return null;
    const key = jobId && jobId.trim().length > 0 ? jobId : null;
    const markers = key ? (manualMarkersByJob[key] || []) : [];
    const suggestions = key ? (manualSuggestionsByJob[key] || []) : [];
    const fallbackDurationSec = key && activeJob?.id === key
      ? Number((activeJob as any)?.inputDurationSeconds || (activeJob.analysis as any)?.input_duration_seconds || 0)
      : 0;
    const durationSec = key ? Number(previewDurationByJob[key] || fallbackDurationSec || 0) : 0;
    const retentionDeltaEstimate =
      Number.isFinite(durationSec) && durationSec > 0
        ? computeManualRetentionDelta({
            markers,
            durationSec,
            autoAssist: manualAutoAssist,
          })
        : null;
    if (!manualMode && markers.length === 0 && suggestions.length === 0) return null;
    return {
      enabled: manualMode,
      autoAssist: manualAutoAssist,
      markers,
      suggestions,
      requested: suggestions.length > 0,
      retentionDeltaEstimate,
      updatedAt: new Date().toISOString(),
    };
  }, [activeJob, isVerticalMode, manualAutoAssist, manualMarkersByJob, manualMode, manualSuggestionsByJob, previewDurationByJob]);

  const buildLiveRenderSettingsPayload = useCallback((job: JobDetail) => {
    const editorModeForJob = mapEditorModeForBackend(editorMode);
    const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
    const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
    const preferredHook = selectedHookByJob[job.id] || resolveSelectedHookFromAnalysis(job.analysis || {}) || null;
    const hookSelectionModeForJob =
      hookSelectionModeByJob[job.id] ??
      normalizeHookSelectionMode(
        (job.analysis as any)?.hook_selection_mode ??
        (job.analysis as any)?.hookSelectionMode ??
        (job.analysis as any)?.hook_mode ??
        (job.analysis as any)?.hookMode,
      );
    const manualTimestampPayload = buildManualTimestampPayload(job.id);
    const payload: Record<string, unknown> = {
      retentionAggressionLevel: STRATEGY_TO_AGGRESSION[retentionStrategyProfile],
      retentionStrategyProfile,
      retentionTargetPlatform,
      platformProfile: retentionTargetPlatform,
      onlyHookAndCut,
      maxCuts: maxCutsRequested,
      editorMode: editorModeForJob,
      hookSelectionMode: hookSelectionModeForJob,
      longFormPreset,
      longFormAggression,
      longFormClarityVsSpeed,
      tangentKiller,
      smartZoom: smartZoomEnabled,
      transitions: transitionsEnabled,
      soundFx: soundFxEnabled,
      autoCaptions: autoCaptionsEnabled,
      subtitleStyle: subtitleStyleForJob,
      subtitles: {
        enabled: autoCaptionsEnabled,
        preset: subtitlePresetForJob,
        style: subtitleStyleForJob,
      },
      ...(manualTimestampPayload
        ? {
            manualTimestamp: manualTimestampPayload,
            manualTimestampEditor: manualTimestampPayload.enabled,
          }
        : {}),
    };
    if (manualTimestampPayload?.enabled) {
      payload.hookSelectionMode = "manual";
    }
    if (preferredHook && hookSelectionModeForJob !== "auto") {
      payload.preferredHook = {
        start: preferredHook.start,
        duration: preferredHook.duration,
      };
    }
    if (job.renderMode === "vertical") {
      const verticalEffects = deriveVerticalModeEffects({
        selectionMode: verticalSelectionMode,
        zoomProfile: verticalZoomProfile,
        zoomIntensity: verticalZoomIntensity,
      });
      payload.smartZoom = verticalEffects.smartZoom;
      payload.transitions = verticalEffects.transitions;
      payload.soundFx = verticalEffects.soundFx;
      payload.autoZoomMax = verticalEffects.autoZoomMax;
      payload.verticalClipCount = verticalClipCountTouched ? verticalClipCount : 0;
      payload.verticalMode = {
        enabled: true,
        selectionMode: verticalSelectionMode,
        zoomProfile: verticalZoomProfile,
        zoomIntensity: Number((clamp(verticalZoomIntensity, 0, 100) / 100).toFixed(3)),
      };
      payload.verticalCaptionText = verticalCaptionsForJob.text;
      payload.verticalCaptions = verticalCaptionsForJob;
    }
    return payload;
  }, [
    autoCaptionsEnabled,
    buildManualTimestampPayload,
    editorMode,
    hookSelectionModeByJob,
    longFormAggression,
    longFormClarityVsSpeed,
    longFormPreset,
    maxCutsRequested,
    onlyHookAndCut,
    retentionStrategyProfile,
    retentionTargetPlatform,
    selectedHookByJob,
    smartZoomEnabled,
    soundFxEnabled,
    subtitleStyleDraft,
    tangentKiller,
    transitionsEnabled,
    verticalCaptionsForJob,
    verticalClipCount,
    verticalClipCountTouched,
    verticalSelectionMode,
    verticalZoomIntensity,
    verticalZoomProfile,
  ]);

  useEffect(() => {
    if (!accessToken || !activeJob?.id) return;
    const status = normalizeStatus(activeJob.status);
    if (!LIVE_SETTINGS_SYNC_STATUSES.has(status)) return;
    const payload = buildLiveRenderSettingsPayload(activeJob);
    const signature = JSON.stringify(payload);
    const jobId = activeJob.id;
    if (liveSettingsSyncSignatureByJobRef.current[jobId] === signature) return;
    const timer = setTimeout(() => {
      if (liveSettingsSyncInFlightRef.current[jobId]) return;
      liveSettingsSyncInFlightRef.current[jobId] = true;
      void apiFetch(`/api/jobs/${jobId}/live-settings`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify(payload),
      })
        .then(() => {
          liveSettingsSyncSignatureByJobRef.current[jobId] = signature;
        })
        .catch((err: any) => {
          if (err instanceof ApiError && (err.status === 404 || err.status === 409 || err.status === 403)) {
            return;
          }
          console.warn("live settings sync failed", err);
        })
        .finally(() => {
          liveSettingsSyncInFlightRef.current[jobId] = false;
        });
    }, 650);
    return () => clearTimeout(timer);
  }, [accessToken, activeJob, buildLiveRenderSettingsPayload]);

  const handleRedoRender = useCallback(
    async (job: JobDetail) => {
      if (!accessToken || !job?.id) return false;
      if (!isDevAccount && rerendersRemainingToday !== null && (rerendersRemainingToday ?? 0) <= 0) {
        toast({
          title: "Daily re-render limit reached",
          description: "You reached your re-render limit for today.",
        });
        return false;
      }
      setReprocessingJobId(job.id);
      try {
        const effectiveRetentionStrategyProfile: RetentionStrategyProfile = retentionStrategyProfile;
        const editorModeForJob = mapEditorModeForBackend(editorMode);
        const requestedMode = job.renderMode === "vertical" ? "vertical" : "horizontal";
        const subtitleStyleForJob = normalizeSubtitleStyleFromSettings(subtitleStyleDraft);
        const subtitlePresetForJob = parseSubtitleStyleConfig(subtitleStyleForJob).preset;
        const captionsEnabledForJob = autoCaptionsEnabled;
        const selectedQuality = normalizeQuality(qualityByJob[job.id] || job.requestedQuality || "720p");
        const preferredHook = selectedHookByJob[job.id] || resolveSelectedHookFromAnalysis(job.analysis || {}) || null;
        const useFastModeRetry = /ffmpeg_failed_signal_sigkill/i.test(String(job.error || ""));
        const hookSelectionModeForJob =
          hookSelectionModeByJob[job.id] ??
          normalizeHookSelectionMode(
            (job.analysis as any)?.hook_selection_mode ??
            (job.analysis as any)?.hookSelectionMode ??
            (job.analysis as any)?.hook_mode ??
            (job.analysis as any)?.hookMode,
          );
        const manualTimestampPayload = buildManualTimestampPayload(job.id);
        const persistedManualSignature = buildManualConfigSignature({
          enabled: Boolean(manualTimestampPayload?.enabled),
          autoAssist: Boolean(manualTimestampPayload?.autoAssist),
          markers: manualTimestampPayload?.markers || [],
          suggestions: manualTimestampPayload?.suggestions || [],
        });
        const payload: Record<string, unknown> = {
          requestedQuality: selectedQuality,
          retentionAggressionLevel: STRATEGY_TO_AGGRESSION[effectiveRetentionStrategyProfile],
          retentionStrategyProfile: effectiveRetentionStrategyProfile,
          retentionTargetPlatform,
          platformProfile: retentionTargetPlatform,
          onlyHookAndCut,
          maxCuts: maxCutsRequested,
          editorMode: editorModeForJob,
          hookSelectionMode: hookSelectionModeForJob,
          longFormPreset,
          longFormAggression,
          longFormClarityVsSpeed,
          tangentKiller,
          smartZoom: smartZoomEnabled,
          transitions: transitionsEnabled,
          soundFx: soundFxEnabled,
          viralMode,
          enhanceMode,
          autoCaptions: captionsEnabledForJob,
          subtitleStyle: subtitleStyleForJob,
          subtitles: {
            enabled: captionsEnabledForJob,
            preset: subtitlePresetForJob,
            style: subtitleStyleForJob,
          },
          ...(useFastModeRetry ? { fastMode: true } : {}),
          ...(manualTimestampPayload
            ? {
                manualTimestamp: manualTimestampPayload,
                manualTimestampEditor: manualTimestampPayload.enabled,
              }
            : {}),
        };
        if (manualTimestampPayload?.enabled) {
          payload.hookSelectionMode = "manual";
        }
        if (requestedMode === "vertical") {
          const verticalEffects = deriveVerticalModeEffects({
            selectionMode: verticalSelectionMode,
            zoomProfile: verticalZoomProfile,
            zoomIntensity: verticalZoomIntensity,
          });
          payload.smartZoom = verticalEffects.smartZoom;
          payload.transitions = verticalEffects.transitions;
          payload.soundFx = verticalEffects.soundFx;
          payload.autoZoomMax = verticalEffects.autoZoomMax;
          payload.verticalClipCount = verticalClipCountTouched ? verticalClipCount : 0;
          payload.verticalMode = {
            enabled: true,
            selectionMode: verticalSelectionMode,
            zoomProfile: verticalZoomProfile,
            zoomIntensity: Number((clamp(verticalZoomIntensity, 0, 100) / 100).toFixed(3)),
          };
          payload.verticalCaptionText = verticalCaptionsForJob.text;
          payload.verticalCaptions = verticalCaptionsForJob;
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
        setManualSavedSignatureByJob((prev) => ({
          ...prev,
          [job.id]: persistedManualSignature,
        }));
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
        return true;
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
        return false;
      } finally {
        setReprocessingJobId((current) => (current === job.id ? null : current));
      }
    },
    [
      accessToken,
      autoCaptionsEnabled,
      editorMode,
      fetchJob,
      fetchJobs,
      maxRendersPerMonth,
      maxRerendersPerDay,
      rerendersRemainingToday,
      maxCutsRequested,
      longFormPreset,
      longFormAggression,
      longFormClarityVsSpeed,
      onlyHookAndCut,
      qualityByJob,
      refetchMe,
      retentionStrategyProfile,
      retentionTargetPlatform,
      tangentKiller,
      hookSelectionModeByJob,
      buildManualTimestampPayload,
      selectedHookByJob,
      subtitleStyleDraft,
      smartZoomEnabled,
      transitionsEnabled,
      soundFxEnabled,
      viralMode,
      enhanceMode,
      verticalCaptionsForJob,
      verticalSelectionMode,
      verticalClipCount,
      verticalClipCountTouched,
      verticalZoomProfile,
      verticalZoomIntensity,
      isDevAccount,
      toast,
    ],
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
  const effectiveVerticalClipCount = verticalClipCountTouched ? verticalClipCount : 20;
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
  const metadataSelectionMode = typeof metadataSummary?.selectionMode === "string"
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
  const selectedHookFromAnalysis = resolveSelectedHookFromAnalysis(activeAnalysis);
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
  const retentionCurvePreview = useMemo<RetentionCurvePointInput[]>(() => {
    const curveSource =
      activeAnalysis?.visuals?.retentionCurve ??
      activeAnalysis?.visuals?.retention_curve ??
      metadataRetention?.retentionCurve ??
      metadataRetention?.retention_curve ??
      metadataRetention?.curve ??
      activeAnalysis?.retentionCurve ??
      activeAnalysis?.retention_curve ??
      activeAnalysis?.retention_feedback?.retentionCurve ??
      activeAnalysis?.retention_feedback?.retention_curve;

    if (!Array.isArray(curveSource)) return [];
    return curveSource
      .map((entry: any) => {
        const second = Number(entry?.second ?? entry?.timeSec ?? entry?.time_sec ?? entry?.t ?? entry?.x);
        const scoreRaw = Number(entry?.score ?? entry?.retention ?? entry?.value ?? entry?.y);
        if (!Number.isFinite(second) || !Number.isFinite(scoreRaw)) return null;
        const normalizedScore = Math.abs(scoreRaw) <= 1.0001 ? scoreRaw * 100 : scoreRaw;
        const reason = typeof entry?.reason === "string"
          ? entry.reason.trim()
          : typeof entry?.label === "string"
            ? entry.label.trim()
            : "";
        const categoryRaw = String(entry?.category ?? entry?.type ?? entry?.kind ?? "").trim().toLowerCase();
        const category =
          categoryRaw === "best" || categoryRaw === "peak" || categoryRaw === "high"
            ? "best"
            : categoryRaw === "weak" || categoryRaw === "dip" || categoryRaw === "drop"
              ? "weak"
              : categoryRaw === "keep" || categoryRaw === "hold" || categoryRaw === "sticky"
                ? "keep"
                : categoryRaw === "skip" || categoryRaw === "warning" || categoryRaw === "risk"
                  ? "skip"
                  : undefined;
        return {
          second: clamp(Number(second.toFixed(2)), 0, 24 * 60 * 60),
          score: clamp(Number(normalizedScore.toFixed(2)), 0, 100),
          reason: reason.length > 0 ? reason : undefined,
          category,
        } satisfies RetentionCurvePointInput;
      })
      .filter((entry: RetentionCurvePointInput | null): entry is RetentionCurvePointInput => Boolean(entry))
      .sort((left, right) => left.second - right.second);
  }, [activeAnalysis, metadataRetention]);
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
  const failureMessage = failedGateReason || activeJob?.error || "";
  const isPacingToRenderingTransitionFailure = /invalid transition from pacing to rendering/i.test(failureMessage);
  const activeStepKey = activeJob ? stepKeyForStatus(activeJob.status) : null;
  const currentStepIndex = activeStepKey
    ? PIPELINE_STEPS.findIndex((step) => step.key === activeStepKey)
    : -1;
  const failedStepKey =
    normalizedActiveStatus === "failed"
      ? activeJob?.error && activeJob.error.startsWith("FAILED_HOOK:")
        ? "hooking"
        : activeJob?.error && activeJob.error.startsWith("FAILED_QUALITY_GATE:")
          ? "story"
          : "rendering"
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
  const retentionTrendSignals = useMemo(() => {
    const lines: string[] = [];
    if (detectedNicheRaw) {
      lines.push(`Detected niche: ${formatNicheLabel(detectedNicheRaw)}`);
    }
    if (detectedRetentionTargetPlatform) {
      lines.push(`Target platform: ${formatPlatformLabel(detectedRetentionTargetPlatform)}`);
    }
    if (detectedRetentionStrategyProfile) {
      lines.push(`Strategy profile: ${formatNicheLabel(detectedRetentionStrategyProfile)}`);
    }
    detectedNicheRationale.slice(0, 2).forEach((line) => {
      if (line && line.trim().length > 0) lines.push(line.trim());
    });
    retentionImprovements.slice(0, 2).forEach((line) => {
      if (line && line.trim().length > 0) lines.push(line.trim());
    });
    return lines.slice(0, 6);
  }, [
    detectedNicheRaw,
    detectedRetentionTargetPlatform,
    detectedRetentionStrategyProfile,
    detectedNicheRationale,
    retentionImprovements,
  ]);
  const stepMicroCopy: Record<string, string> = {
    queued: "Queued in worker lane",
    uploading:
      uploadBytesUploaded !== null && uploadBytesTotal !== null && uploadBytesTotal > 0
        ? `${(uploadBytesUploaded / MB).toFixed(1)} / ${(uploadBytesTotal / MB).toFixed(1)} MB uploaded`
        : `Upload progress ${Math.round(totalPipelineProgress)}%`,
    analyzing:
      analyzedFrames !== null && totalFrames !== null
        ? `Analyzing ${Math.round(analyzedFrames)}/${Math.round(totalFrames)} frames`
        : "Scene breakdown and transcript sync",
    hooking:
      highEnergyPeaks !== null
        ? `Detected ${Math.round(highEnergyPeaks)} high-energy peaks`
        : selectedHookCandidate
          ? `Hook candidate ${formatHookRange(selectedHookCandidate.start, selectedHookCandidate.start + selectedHookCandidate.duration)}`
          : "Scoring opening hook candidates",
    cutting:
      cutsApplied !== null
        ? `Applied ${Math.round(cutsApplied)} cuts`
        : "Removing low-energy and dead-air segments",
    pacing: "Balancing cut rhythm and retention pacing",
    zoom: "Generating smart zoom keyframes",
    story: "Scoring narrative continuity and escalation",
    subtitling:
      autoCaptionsEnabled
        ? subtitleLines !== null
          ? `Generated ${Math.round(subtitleLines)} subtitle lines`
          : "Generating timed subtitles"
        : "Subtitles disabled",
    rendering:
      activeJob?.renderMode === "vertical"
        ? `Rendering ${Math.max(1, activeOutputUrls.length || effectiveVerticalClipCount || 1)} vertical clip(s)`
        : "Encoding final MP4 output",
    ready:
      activeJob?.renderMode === "vertical"
        ? `${Math.max(1, activeOutputUrls.length || effectiveVerticalClipCount || 1)} clip(s) ready`
        : "Export package is ready",
  };
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
  const activeManualMarkers = activeJob ? (manualMarkersByJob[activeJob.id] || []) : [];
  const activeManualSuggestions = activeJob ? (manualSuggestionsByJob[activeJob.id] || []) : [];
  const activeManualDurationSec = activeJob
    ? Number(
        previewDurationByJob[activeJob.id] ||
        (activeJob as any)?.inputDurationSeconds ||
        activeAnalysis?.input_duration_seconds ||
        0,
      )
    : 0;
  const activeManualCurrentTimeSec = activeJob
    ? Number(previewCurrentTimeByJob[activeJob.id] || 0)
    : 0;
  const activeManualPlaying = activeJob
    ? Boolean(previewPlayingByJob[activeJob.id])
    : false;
  const activeManualPlaybackRate = activeJob
    ? Number(manualPlaybackRateByJob[activeJob.id] || 1)
    : 1;
  const activeInputPreviewUrl = activeJob ? (inputPreviewUrlByJob[activeJob.id] || "") : "";
  const activeManualDraftSignature = activeJob
    ? buildManualConfigSignature({
        enabled: manualMode,
        autoAssist: manualAutoAssist,
        markers: activeManualMarkers,
        suggestions: activeManualSuggestions,
      })
    : "";
  const activeManualSavedSignature = activeJob ? (manualSavedSignatureByJob[activeJob.id] || "") : "";
  const manualHasUnsavedChanges = Boolean(activeJob && manualMode && activeManualDraftSignature !== activeManualSavedSignature);
  const manualRemovalRatio = activeManualDurationSec > 0
    ? computeManualRemovalRatio(activeManualMarkers, activeManualDurationSec)
    : 0;
  const manualRetentionDeltaEstimate = activeManualDurationSec > 0
    ? computeManualRetentionDelta({
        markers: activeManualMarkers,
        durationSec: activeManualDurationSec,
        autoAssist: manualAutoAssist,
      })
    : null;
  const manualOverridePlan = parseManualOverrideStructuredPlan(
    activeAnalysis?.manual_override_plan ??
    activeAnalysis?.manualOverridePlan ??
    activeAnalysis?.manual?.overridePlan,
  );
  const analysisManualWarnings: string[] = Array.isArray(
    activeAnalysis?.manual_warnings ?? activeAnalysis?.manualWarnings,
  )
    ? (activeAnalysis?.manual_warnings ?? activeAnalysis?.manualWarnings)
        .filter((item: unknown) => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
    : [];
  const analysisManualMicroHooks: Array<{ start: number; end: number }> = Array.isArray(
    activeAnalysis?.manual_micro_hook_suggestions ?? activeAnalysis?.manualMicroHookSuggestions,
  )
    ? (activeAnalysis?.manual_micro_hook_suggestions ?? activeAnalysis?.manualMicroHookSuggestions)
        .map((entry: any) => normalizeManualTimeRange(entry))
        .filter((entry: { start: number; end: number } | null): entry is { start: number; end: number } => Boolean(entry))
    : [];
  const manualMicroHookSuggestions = analysisManualMicroHooks.length > 0
    ? analysisManualMicroHooks
    : buildMicroHookSuggestions(activeManualDurationSec);
  const manualWarnings = (() => {
    const merged = [...analysisManualWarnings];
    if (manualRemovalRatio > 0.4 && !merged.some((line) => line.toLowerCase().includes("40%"))) {
      merged.push("Warning: removing >40% may hurt retention.");
    }
    if (
      activeManualDurationSec >= 180 &&
      manualMicroHookSuggestions.length > 0 &&
      !merged.some((line) => line.toLowerCase().includes("micro-hook"))
    ) {
      merged.push("Suggestion: add micro-hooks every 2-3 minutes for long-form retention.");
    }
    return merged;
  })();
  const manualStructuredPlanRetentionPoints = parseManualRetentionImpactPoints(manualOverridePlan?.retentionImpact);
  const manualRetentionDisplay = manualStructuredPlanRetentionPoints ?? manualRetentionDeltaEstimate;
  const aiRetentionDisplay = retentionScoreDeltaDisplay;
  const manualVsAiRetentionDelta =
    manualRetentionDisplay !== null && aiRetentionDisplay !== null
      ? Number((manualRetentionDisplay - aiRetentionDisplay).toFixed(1))
      : null;
  const activeManualHookMarker =
    activeManualMarkers.find((marker) => marker.type === "hook" && marker.source === "user")
    || activeManualMarkers.find((marker) => marker.type === "hook")
    || null;
  const selectedHookSourceRangeLabel = selectedHookCandidate
    ? formatHookRange(selectedHookCandidate.start, selectedHookCandidate.start + selectedHookCandidate.duration)
    : Number.isFinite(hookStartSec) && Number.isFinite(hookEndSec)
      ? formatHookRange(hookStartSec, hookEndSec)
      : null;
  const pinnedHookSourceRangeLabel =
    manualMode && activeManualHookMarker
      ? formatHookRange(activeManualHookMarker.start, activeManualHookMarker.end)
      : selectedHookSourceRangeLabel;
  const hookPinnedToOpening = Boolean(pinnedHookSourceRangeLabel);
  const manualLivePreviewPlan = buildManualPreviewPlan({
    enabled: manualMode,
    markers: activeManualMarkers,
    durationSec: activeManualDurationSec,
  });
  const manualLivePreviewSegments = manualLivePreviewPlan?.segments || [];
  const previewOutputUrl = activeOutputUrls.find((url) => typeof url === "string" && url.length > 0) || "";
  const activeProxyPreviewUrl = activeJob ? (proxyPreviewUrlByJob[activeJob.id] || "") : "";
  const canShowAiProgressPreview = Boolean(
    activeJob && AI_PREVIEW_READY_STATUSES.has(normalizedActiveStatus || ""),
  );
  const previewFallbackUrl = activeProxyPreviewUrl || activeInputPreviewUrl || "";
  const manualLivePreviewEnabled = false;
  const previewVideoUrl = previewOutputUrl || (canShowAiProgressPreview ? previewFallbackUrl : "");
  const previewUsesProxy = Boolean(activeProxyPreviewUrl && previewVideoUrl === activeProxyPreviewUrl);
  const activeProxyPreviewRefreshNonce = activeJob ? (proxyPreviewRefreshNonceByJob[activeJob.id] || 0) : 0;
  const canApplyHookRealtime = Boolean(
    activeJob && REALTIME_HOOK_MUTABLE_STATUSES.has(normalizeStatus(activeJob.status)),
  );
  const canShowRealtimeHookSelector = Boolean(
    activeJob &&
      activeJob.renderMode !== "vertical" &&
      !manualMode &&
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
  const selectedEffectPreviewType = previewEffectTypeFromEnhanceMode(enhanceMode);

  useEffect(() => {
    if (!showEffectPreview) return;
    if (!accessToken) return;
    if (!activeJob?.id) {
      setEffectPreviewLoading(false);
      setEffectPreviewUrl("");
      setEffectPreviewError("Select a job to generate an effect preview.");
      return;
    }
    if (onlyHookAndCut) {
      setEffectPreviewLoading(false);
      setEffectPreviewUrl("");
      setEffectPreviewError("Disable Only Hook & Cut to preview transitions, swoosh, and zoom effects.");
      return;
    }
    if (!selectedEffectPreviewType) {
      setEffectPreviewLoading(false);
      setEffectPreviewUrl("");
      setEffectPreviewError("Enable an effect mode to preview.");
      return;
    }

    let canceled = false;
    const timer = setTimeout(() => {
      setEffectPreviewLoading(true);
      setCurrentEffectPreview(selectedEffectPreviewType);
      setEffectPreviewError("");
      void apiFetch<{
        previewUrl?: string;
        effectType?: string;
      }>(`/api/jobs/${activeJob.id}/effect-preview`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          effectType: selectedEffectPreviewType,
          viralMode,
          previewDuration: viralMode === "tiktok" ? 10 : 12,
        }),
      })
        .then((response) => {
          if (canceled) return;
          const nextUrl = typeof response?.previewUrl === "string" ? response.previewUrl : "";
          if (!nextUrl) {
            setEffectPreviewUrl("");
            setEffectPreviewError("Preview render finished without a playable URL.");
            return;
          }
          setEffectPreviewUrl(nextUrl);
          setEffectPreviewError("");
        })
        .catch((err: any) => {
          if (canceled) return;
          setEffectPreviewUrl("");
          setEffectPreviewError(err?.message || "Preview unavailable right now.");
        })
        .finally(() => {
          if (canceled) return;
          setEffectPreviewLoading(false);
        });
    }, 150);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [
    accessToken,
    activeJob?.id,
    effectPreviewRefreshNonce,
    onlyHookAndCut,
    selectedEffectPreviewType,
    showEffectPreview,
    viralMode,
  ]);

  useEffect(() => {
    if (!onlyHookAndCut) return;
    setShowEffectPreview(false);
  }, [onlyHookAndCut]);

  useEffect(() => {
    if (!activeJob?.id || !canShowRealtimeHookSelector || activeHookSelectionMode !== "manual") return;
    if (hookPromptedByJob[activeJob.id]) return;
    setHookPromptedByJob((prev) => ({ ...prev, [activeJob.id]: true }));
    setHookSelectorOpen(true);
  }, [activeHookSelectionMode, activeJob?.id, canShowRealtimeHookSelector, hookPromptedByJob]);
  useEffect(() => {
    if (!manualMode) return;
    if (!hookSelectorOpen) return;
    setHookSelectorOpen(false);
  }, [hookSelectorOpen, manualMode]);
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
    if (!activeJob?.id || !accessToken) return;
    if (!canShowAiProgressPreview) return;
    if (previewOutputUrl) return;
    const jobId = activeJob.id;
    if (proxyPreviewUrlByJob[jobId]) return;
    let canceled = false;
    void apiFetch<{ url?: string }>(`/api/jobs/${jobId}/proxy-url`, {
      method: "POST",
      token: accessToken,
    })
      .then((response) => {
        if (canceled) return;
        const nextUrl = typeof response?.url === "string" ? response.url.trim() : "";
        if (!nextUrl) return;
        setProxyPreviewUrlByJob((prev) => ({ ...prev, [jobId]: nextUrl }));
      })
      .catch((error: any) => {
        if (canceled) return;
        if (!(error instanceof ApiError && error.status === 404)) {
          console.warn("proxy preview url failed", error);
        }
      });
    return () => {
      canceled = true;
    };
  }, [
    accessToken,
    activeJob?.id,
    activeProxyPreviewRefreshNonce,
    canShowAiProgressPreview,
    previewOutputUrl,
    proxyPreviewUrlByJob,
  ]);
  useEffect(() => {
    if (!activeJob?.id || !accessToken) return;
    const jobId = activeJob.id;
    if (inputPreviewUrlByJob[jobId]) return;
    let canceled = false;
    void apiFetch<{ url?: string }>(`/api/jobs/${jobId}/input-url`, {
      method: "POST",
      token: accessToken,
    })
      .then((response) => {
        if (canceled) return;
        const nextUrl = typeof response?.url === "string" ? response.url.trim() : "";
        if (!nextUrl) return;
        setInputPreviewUrlByJob((prev) => ({ ...prev, [jobId]: nextUrl }));
      })
      .catch((error: any) => {
        if (canceled) return;
        if (!(error instanceof ApiError && error.status === 404)) {
          console.warn("manual input preview url failed", error);
        }
      });
    return () => {
      canceled = true;
    };
  }, [accessToken, activeJob?.id, inputPreviewUrlByJob]);
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
  const handleManualSaveAndRender = useCallback(async () => {
    if (!activeJob) return;
    if (!isTerminalStatus(activeJob.status)) {
      toast({
        title: "Render still in progress",
        description: "Wait until the current run finishes, then press Save.",
      });
      return;
    }
    await handleRedoRender(activeJob);
  }, [activeJob, handleRedoRender, toast]);
  const handleManualMarkersChange = useCallback((nextMarkers: ManualTimestampMarker[]) => {
    if (!activeJob?.id) return;
    const sanitized = nextMarkers
      .map((marker, index) => normalizeManualTimestampMarker(marker, index))
      .filter((marker: ManualTimestampMarker | null): marker is ManualTimestampMarker => Boolean(marker));
    setManualMarkersByJob((prev) => ({ ...prev, [activeJob.id]: sanitized }));
  }, [activeJob?.id]);
  const handleManualClearAll = useCallback(() => {
    if (!activeJob?.id) return;
    setManualMarkersByJob((prev) => ({ ...prev, [activeJob.id]: [] }));
    setManualSuggestionsByJob((prev) => ({ ...prev, [activeJob.id]: [] }));
  }, [activeJob?.id]);
  const handleManualAcceptSuggestion = useCallback((suggestionId: string) => {
    if (!activeJob?.id) return;
    const suggestion = (manualSuggestionsByJob[activeJob.id] || []).find((item) => item.id === suggestionId);
    if (!suggestion) return;
    setManualMarkersByJob((prev) => ({
      ...prev,
      [activeJob.id]: [...(prev[activeJob.id] || []), mapSuggestionToManualMarker(suggestion)],
    }));
    setManualSuggestionsByJob((prev) => ({
      ...prev,
      [activeJob.id]: (prev[activeJob.id] || []).filter((item) => item.id !== suggestionId),
    }));
  }, [activeJob?.id, manualSuggestionsByJob]);
  const handleManualRejectSuggestion = useCallback((suggestionId: string) => {
    if (!activeJob?.id) return;
    setManualSuggestionsByJob((prev) => ({
      ...prev,
      [activeJob.id]: (prev[activeJob.id] || []).filter((item) => item.id !== suggestionId),
    }));
  }, [activeJob?.id]);
  const handleManualApplyAllSuggestions = useCallback(() => {
    if (!activeJob?.id) return;
    const suggestions = manualSuggestionsByJob[activeJob.id] || [];
    if (!suggestions.length) return;
    const markers = suggestions.map((suggestion) => mapSuggestionToManualMarker(suggestion));
    setManualMarkersByJob((prev) => ({
      ...prev,
      [activeJob.id]: [...(prev[activeJob.id] || []), ...markers],
    }));
    setManualSuggestionsByJob((prev) => ({ ...prev, [activeJob.id]: [] }));
  }, [activeJob?.id, manualSuggestionsByJob]);
  const handleManualAiSuggest = useCallback(async () => {
    if (!activeJob?.id) return;
    const durationSec = Number(previewDurationByJob[activeJob.id] || activeJob.inputDurationSeconds || 0);
    const suggestions = buildAiManualSuggestionsFromAnalysis(activeJob.analysis || {}, durationSec);
    if (suggestions.length > 0) {
      setManualSuggestionsByJob((prev) => ({ ...prev, [activeJob.id]: suggestions }));
      setManualAutoAssist(true);
      return;
    }
    if (!accessToken) return;
    setManualAiSuggestLoadingJobId(activeJob.id);
    try {
      await apiFetch(`/api/jobs/${activeJob.id}/analyze`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          fastMode: true,
          manualTimestampEditor: true,
        }),
      });
      const refreshed = await fetchJob(activeJob.id);
      const refreshedDuration = Number(previewDurationByJob[activeJob.id] || refreshed?.inputDurationSeconds || 0);
      const nextSuggestions = buildAiManualSuggestionsFromAnalysis(refreshed.analysis || {}, refreshedDuration);
      setManualSuggestionsByJob((prev) => ({ ...prev, [activeJob.id]: nextSuggestions }));
      setManualAutoAssist(true);
      if (nextSuggestions.length === 0) {
        toast({
          title: "No AI suggestions found",
          description: "Try placing a few markers manually, then rerun AI Suggest.",
        });
      }
    } catch (err: any) {
      toast({
        title: "AI suggest failed",
        description: err?.message || "Please try again.",
      });
    } finally {
      setManualAiSuggestLoadingJobId((current) => (current === activeJob.id ? null : current));
    }
  }, [accessToken, activeJob, fetchJob, previewDurationByJob, toast]);
  const handleRetentionFixWeakPartsNow = useCallback(async () => {
    if (!activeJob?.id) return;
    setManualMode(true);
    setManualAutoAssist(true);
    setSmartZoomEnabled(true);
    setTransitionsEnabled(true);
    setSoundFxEnabled(true);
    await handleManualAiSuggest();
    handleManualApplyAllSuggestions();
    toast({
      title: "Weak parts optimized",
      description: "Low-retention zones were marked for removal and zoom/SFX boosts were enabled.",
    });
  }, [
    activeJob?.id,
    handleManualAiSuggest,
    handleManualApplyAllSuggestions,
    toast,
  ]);
  const handleRetentionBoostBestMoments = useCallback(() => {
    if (!activeJob?.id) return;
    setAutoCaptionsEnabled(true);
    setSmartZoomEnabled(true);
    setTransitionsEnabled(true);
    setSoundFxEnabled(true);
    setViralMode((prev) => (prev === "none" ? "tiktok" : prev));
    toast({
      title: "Best moments boosted",
      description: "Snap zoom, captions, and audio lift are primed for your highest-retention beats.",
    });
  }, [activeJob?.id, toast]);
  const handleRetentionApplyAllSuggestions = useCallback(async () => {
    if (!activeJob?.id) return;
    await handleRetentionFixWeakPartsNow();
    handleRetentionBoostBestMoments();
    if (isTerminalStatus(activeJob.status)) {
      await handleRedoRender(activeJob);
      return;
    }
    toast({
      title: "Suggestions staged",
      description: "Current render is still running. Re-render after it completes to apply every optimization.",
    });
  }, [activeJob, handleRetentionBoostBestMoments, handleRetentionFixWeakPartsNow, handleRedoRender, toast]);
  const handleRetentionTrendAlignment = useCallback(() => {
    const strategyLabel = formatNicheLabel(
      (typeof detectedRetentionStrategyProfile === "string" && detectedRetentionStrategyProfile) || retentionStrategyProfile
    );
    const platformLabel = formatPlatformLabel(
      (typeof detectedRetentionTargetPlatform === "string" && detectedRetentionTargetPlatform) || retentionTargetPlatform
    );
    const nicheLabel = detectedNicheRaw ? formatNicheLabel(detectedNicheRaw) : "General";
    toast({
      title: "Trend alignment opened",
      description: `${strategyLabel} pacing on ${platformLabel}; niche signal ${nicheLabel}.`,
    });
  }, [
    detectedNicheRaw,
    detectedRetentionStrategyProfile,
    detectedRetentionTargetPlatform,
    retentionStrategyProfile,
    retentionTargetPlatform,
    toast,
  ]);
  const handleRetentionAnalyticsUpgrade = useCallback(() => {
    navigate("/pricing");
  }, [navigate]);
  const handlePreviewLoadedMetadata = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const preferredRate = Number(manualPlaybackRateByJob[activeJob.id] || 1);
    if (Number.isFinite(preferredRate) && preferredRate > 0 && Math.abs(video.playbackRate - preferredRate) > 0.001) {
      video.playbackRate = preferredRate;
    }
    let currentTime = clamp(Number(video.currentTime || 0), 0, duration);
    if (manualLivePreviewEnabled && manualLivePreviewSegments.length > 0) {
      const snapped = snapToManualPreviewTime(manualLivePreviewSegments, currentTime);
      if (Math.abs(snapped - currentTime) > 0.02) {
        video.currentTime = snapped;
      }
      currentTime = snapped;
    }
    setPreviewDurationByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
    setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(currentTime.toFixed(3)) }));
    setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: !video.paused }));
    if (!manualLivePreviewEnabled) {
      ensurePlaybackTelemetry(activeJob.id, duration, Number(video.currentTime || 0));
    }
  }, [activeJob, ensurePlaybackTelemetry, manualLivePreviewEnabled, manualLivePreviewSegments, manualPlaybackRateByJob]);

  const handlePreviewTimeUpdate = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (manualLivePreviewEnabled && manualLivePreviewSegments.length > 0) {
      let currentTime = clamp(Number(video.currentTime || 0), 0, duration);
      const segmentIndex = findManualPreviewSegmentIndex(manualLivePreviewSegments, currentTime);
      if (segmentIndex < 0) {
        const snapped = snapToManualPreviewTime(manualLivePreviewSegments, currentTime);
        if (Math.abs(snapped - currentTime) > 0.015) {
          video.currentTime = snapped;
        }
        currentTime = snapped;
      } else {
        const segment = manualLivePreviewSegments[segmentIndex];
        if (currentTime >= segment.end - 0.02) {
          const next = manualLivePreviewSegments[segmentIndex + 1];
          if (next) {
            const overshoot = Math.max(0, currentTime - segment.end);
            const nextTime = clamp(next.start + overshoot, next.start, next.end);
            if (Math.abs(nextTime - currentTime) > 0.015) {
              video.currentTime = nextTime;
            }
            currentTime = Number(nextTime.toFixed(3));
          } else {
            const endTime = Number(segment.end.toFixed(3));
            if (Math.abs(endTime - currentTime) > 0.015) {
              video.currentTime = endTime;
            }
            video.pause();
            currentTime = endTime;
            setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
          }
        }
      }
      setPreviewDurationByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
      setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(currentTime.toFixed(3)) }));
      return;
    }

    const telemetry = ensurePlaybackTelemetry(activeJob.id, duration);
    const currentTime = clamp(Number(video.currentTime || 0), 0, duration);
    setPreviewDurationByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
    setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(currentTime.toFixed(3)) }));
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
  }, [activeJob, ensurePlaybackTelemetry, manualLivePreviewEnabled, manualLivePreviewSegments, submitPreviewFeedback]);

  const handlePreviewPlay = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    const duration = Number(video.duration);
    if (Number.isFinite(duration) && duration > 0) {
      let currentTime = clamp(Number(video.currentTime || 0), 0, duration);
      if (manualLivePreviewEnabled && manualLivePreviewSegments.length > 0) {
        const lastSegment = manualLivePreviewSegments[manualLivePreviewSegments.length - 1];
        if (currentTime >= lastSegment.end - 0.03) {
          currentTime = Number(manualLivePreviewSegments[0].start.toFixed(3));
        } else {
          currentTime = snapToManualPreviewTime(manualLivePreviewSegments, currentTime);
        }
        if (Math.abs(currentTime - Number(video.currentTime || 0)) > 0.02) {
          video.currentTime = currentTime;
        }
      }
      setPreviewDurationByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
      setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(currentTime.toFixed(3)) }));
    }
    setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: true }));
  }, [activeJob, manualLivePreviewEnabled, manualLivePreviewSegments]);

  const handlePreviewPause = useCallback(() => {
    if (!activeJob) return;
    setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
    if (manualLivePreviewEnabled) return;
    const telemetry = playbackTelemetryRef.current[activeJob.id];
    if (!telemetry) return;
    submitPreviewFeedback(activeJob, telemetry, "pause", false);
  }, [activeJob, manualLivePreviewEnabled, submitPreviewFeedback]);

  const handlePreviewEnded = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    if (!activeJob || !video) return;
    if (manualLivePreviewEnabled && manualLivePreviewSegments.length > 0) {
      const lastSegment = manualLivePreviewSegments[manualLivePreviewSegments.length - 1];
      const endTime = Number(lastSegment.end.toFixed(3));
      setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: endTime }));
      setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
      return;
    }
    const duration = Number(video.duration);
    const telemetry = ensurePlaybackTelemetry(activeJob.id, duration, duration);
    if (Number.isFinite(duration) && duration > 0) {
      telemetry.maxTimeSec = Math.max(telemetry.maxTimeSec, duration);
      telemetry.maxProgress = Math.max(telemetry.maxProgress, 1);
      telemetry.watchedSeconds = Math.max(telemetry.watchedSeconds, duration);
      telemetry.lastDispatchProgress = 1;
      setPreviewDurationByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
      setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(duration.toFixed(3)) }));
    }
    setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
    submitPreviewFeedback(activeJob, telemetry, "ended", true);
  }, [activeJob, ensurePlaybackTelemetry, manualLivePreviewEnabled, manualLivePreviewSegments, submitPreviewFeedback]);

  const handlePreviewVideoError = useCallback((event: any) => {
    const video = event?.currentTarget as HTMLVideoElement | null;
    const details = {
      jobId: activeJob?.id ?? null,
      outputUrl: previewVideoUrl || null,
      networkState: video?.networkState ?? null,
      readyState: video?.readyState ?? null,
      errorCode: video?.error?.code ?? null,
      errorMessage: video?.error?.message ?? null,
    };
    if (activeJob?.id) {
      setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
      if (previewUsesProxy) {
        setProxyPreviewUrlByJob((prev) => ({ ...prev, [activeJob.id]: "" }));
        setProxyPreviewRefreshNonceByJob((prev) => ({
          ...prev,
          [activeJob.id]: (prev[activeJob.id] || 0) + 1,
        }));
      }
    }
    console.error("Preview video failed to load", details);
    if (previewUsesProxy) return;
    toast({
      title: "Preview failed",
      description: "Could not load the edited video. Check network/output URL.",
    });
  }, [activeJob?.id, previewUsesProxy, previewVideoUrl, toast]);

  const handleManualPreviewSeek = useCallback((seconds: number) => {
    if (!activeJob?.id) return;
    const requested = Number(Math.max(0, seconds).toFixed(3));
    const safeSeconds = manualLivePreviewEnabled && manualLivePreviewSegments.length > 0
      ? snapToManualPreviewTime(manualLivePreviewSegments, requested)
      : requested;
    setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: safeSeconds }));
    const video = previewVideoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = clamp(safeSeconds, 0, Number(video.duration));
    }
  }, [activeJob?.id, manualLivePreviewEnabled, manualLivePreviewSegments]);

  const handleManualTogglePlay = useCallback(() => {
    if (!activeJob?.id) return;
    const video = previewVideoRef.current;
    if (video) {
      if (video.paused) {
        if (manualLivePreviewEnabled && manualLivePreviewSegments.length > 0) {
          const current = Number(video.currentTime || 0);
          const lastSegment = manualLivePreviewSegments[manualLivePreviewSegments.length - 1];
          const seekTime = current >= lastSegment.end - 0.03
            ? manualLivePreviewSegments[0].start
            : snapToManualPreviewTime(manualLivePreviewSegments, current);
          if (Math.abs(seekTime - current) > 0.015) {
            video.currentTime = seekTime;
          }
          setPreviewCurrentTimeByJob((prev) => ({ ...prev, [activeJob.id]: Number(seekTime.toFixed(3)) }));
        }
        setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: true }));
        void video.play().catch(() => {
          setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
        });
        return;
      }
      video.pause();
      setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: false }));
      return;
    }
    setPreviewPlayingByJob((prev) => ({ ...prev, [activeJob.id]: !prev[activeJob.id] }));
  }, [activeJob?.id, manualLivePreviewEnabled, manualLivePreviewSegments]);

  const handleManualPlaybackRateChange = useCallback((nextRate: number) => {
    if (!activeJob?.id) return;
    const allowedRates = [1, 1.25, 1.5, 2];
    const normalizedRate = allowedRates.includes(nextRate) ? nextRate : 1;
    setManualPlaybackRateByJob((prev) => ({ ...prev, [activeJob.id]: normalizedRate }));
    const video = previewVideoRef.current;
    if (!video) return;
    if (Math.abs(video.playbackRate - normalizedRate) > 0.001) {
      video.playbackRate = normalizedRate;
    }
  }, [activeJob?.id]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (!Number.isFinite(activeManualPlaybackRate) || activeManualPlaybackRate <= 0) return;
    if (Math.abs(video.playbackRate - activeManualPlaybackRate) > 0.001) {
      video.playbackRate = activeManualPlaybackRate;
    }
  }, [activeManualPlaybackRate, previewVideoUrl]);

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
  const activePlatformRecommendation =
    PLATFORM_RECOMMENDATION_MAP[retentionTargetPlatform] ?? PLATFORM_RECOMMENDATION_MAP.youtube;
  const retentionSliderValue = Math.max(0, RETENTION_PROFILE_SEQUENCE.indexOf(retentionStrategyProfile));
  const captionEngineOffline = captionCapability.available === false;
  const captionsToggleDisabled = !subtitlesEnabled || (captionEngineOffline && !isVerticalMode);
  const rerenderLimitReached =
    !isDevAccount && rerendersRemainingToday !== null && rerendersRemainingToday !== undefined && rerendersRemainingToday <= 0;
  const mobileApplyAndRenderDisabled =
    !editorModeConfirmed || Boolean(uploadingJobId) || (isVerticalMode && Boolean(pendingVerticalFile) && !verticalSelectionReady);
  const mobileApplyAndRenderLabel = !editorModeConfirmed
    ? "Select Horizontal or Vertical"
    : isVerticalMode
      ? pendingVerticalFile
        ? "Apply & Render"
        : "Pick Clip & Render"
      : "Apply & Render";

  const applyPlatformRecommendation = () => {
    const suggestedCuts = clamp(activePlatformRecommendation.suggestedCuts, MAX_CUTS_MIN, MAX_CUTS_MAX);
    menuTouchedRef.current.strategy = true;
    setRetentionStrategyProfile(activePlatformRecommendation.profile);
    setMaxCutsRequested(suggestedCuts);
    toast({
      title: "Suggestion applied",
      description: `${activePlatformRecommendation.label}`,
    });
    trackEditorEvent("platform_recommendation_applied", {
      retentionProfile: activePlatformRecommendation.profile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        suggestedCuts,
      },
    });
  };

  const runApplyAndRender = () => {
    if (!editorModeConfirmed) {
      toast({ title: "Select format", description: "Choose Horizontal or Vertical first to unlock editor settings." });
      return;
    }
    if (isVerticalMode && pendingVerticalFile) {
      void startVerticalRender();
      return;
    }
    handlePickFile();
  };

  const sectionPillClass = (active: boolean) =>
    `editor-settings-pill min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all md:min-h-[46px] ${
      active
        ? "border-violet-300/70 bg-violet-500/20 text-violet-100 shadow-[0_0_20px_rgba(168,85,247,0.34)]"
        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-violet-300/40 hover:text-white hover:shadow-[0_0_16px_rgba(192,132,252,0.18)]"
    }`;

  const helpDemoPillClass = (active: boolean) =>
    `inline-flex min-h-9 items-center justify-center rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-violet-300/60 bg-violet-500/25 text-violet-100"
        : "border-white/10 bg-white/[0.02] text-slate-400"
    }`;

  const refreshEffectPreview = useCallback(() => {
    setEffectPreviewUrl("");
    setEffectPreviewError("");
    setShowEffectPreview(true);
    setEffectPreviewRefreshNonce((prev) => prev + 1);
  }, []);

  const setEffectToggles = useCallback((next: { transitions: boolean; smartZoom: boolean; soundFx: boolean }) => {
    setTransitionsEnabled(next.transitions);
    setSmartZoomEnabled(next.smartZoom);
    setSoundFxEnabled(next.soundFx);
    setEnhanceMode(deriveEnhanceModeFromEffectToggles(next.transitions, next.smartZoom, next.soundFx));
  }, []);

  const applyEnhanceModeSelection = useCallback((nextMode: EnhanceModeSelection) => {
    if (nextMode === "off") {
      setEffectToggles({ transitions: false, smartZoom: false, soundFx: false });
    } else if (nextMode === "transitions") {
      setEffectToggles({ transitions: true, smartZoom: false, soundFx: false });
    } else if (nextMode === "swoosh") {
      setEffectToggles({ transitions: false, smartZoom: false, soundFx: true });
    } else if (nextMode === "zooms") {
      setEffectToggles({ transitions: false, smartZoom: true, soundFx: false });
    } else if (nextMode === "all") {
      setEffectToggles({ transitions: true, smartZoom: true, soundFx: true });
    } else if (nextMode === "auto") {
      if (viralMode === "youtube" || viralMode === "tiktok") {
        setEffectToggles({ transitions: true, smartZoom: true, soundFx: true });
      }
      setEnhanceMode("auto");
    }
    refreshEffectPreview();
    trackEditorEvent("enhance_mode_selected", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        enhanceMode: nextMode,
        viralMode,
      },
    });
  }, [
    activeSubtitlePreset,
    refreshEffectPreview,
    retentionStrategyProfile,
    retentionTargetPlatform,
    setEffectToggles,
    trackEditorEvent,
    viralMode,
  ]);

  const applyViralModeSelection = useCallback((nextMode: ViralModeSelection) => {
    setViralMode(nextMode);
    if (nextMode === "youtube") {
      setRetentionTargetPlatform("youtube");
      setRetentionStrategyProfile((prev) => (prev === "viral" ? "balanced" : prev));
      setEffectToggles({ transitions: true, smartZoom: true, soundFx: true });
      setEnhanceMode("auto");
    } else if (nextMode === "tiktok") {
      setRetentionTargetPlatform("tiktok");
      setRetentionStrategyProfile("viral");
      setMaxCutsRequested((prev) => clamp(Math.max(prev, 10), MAX_CUTS_MIN, MAX_CUTS_MAX));
      setEffectToggles({ transitions: true, smartZoom: true, soundFx: true });
      setEnhanceMode("auto");
    }
    refreshEffectPreview();
    trackEditorEvent("viral_mode_selected", {
      retentionProfile: retentionStrategyProfile,
      targetPlatform: retentionTargetPlatform,
      captionStyle: activeSubtitlePreset,
      metadata: {
        viralMode: nextMode,
      },
    });
  }, [
    activeSubtitlePreset,
    refreshEffectPreview,
    retentionStrategyProfile,
    retentionTargetPlatform,
    setEffectToggles,
    trackEditorEvent,
  ]);

  const handleManualModeSwitch = useCallback((next: boolean) => {
    setManualMode(next);
    setManualTimestampEditorOpen(next);
    if (!next) {
      setManualAutoAssist(false);
    }
  }, []);

  const renderSettingsSection = (section: EditorSettingsSection) => {
    if (section === "format") {
      return (
        <div className="space-y-4">
          {isVerticalMode ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-200">Vertical Pipeline Mode</p>
                <span className="rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-100">
                  {VERTICAL_SELECTION_MODE_OPTIONS.find((item) => item.id === verticalSelectionMode)?.label || "Best Moments"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {VERTICAL_SELECTION_MODE_OPTIONS.map((mode) => (
                  <button
                    key={`settings-vertical-mode-${mode.id}`}
                    type="button"
                    className={sectionPillClass(verticalSelectionMode === mode.id)}
                    onClick={() => {
                      setVerticalSelectionMode(mode.id);
                      setVerticalClipCountTouched(false);
                      setVerticalClipCount(DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE[mode.id]);
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Best Moments is default and exports 3 clips unless you override the count.
              </p>
            </div>
          ) : null}
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
                    {platform.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{PLATFORM_HELP_TEXT[platform.value]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-500/15 via-fuchsia-400/10 to-transparent px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-violet-100">{activePlatformRecommendation.label}</span>
              <Button
                type="button"
                size="sm"
                className="min-h-12 rounded-xl bg-violet-500/85 px-4 text-white hover:bg-violet-400 md:min-h-10"
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
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-200">Vibe</span>
              <span className="rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-100">
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
                    >
                      {profile.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{RETENTION_PROFILE_HINTS[profile.value]}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="mb-3 text-sm text-slate-200">Content Type</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {EDITOR_MODE_OPTIONS.map((mode) => (
                <Tooltip key={mode.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`${sectionPillClass(editorMode === mode.value)} flex items-center gap-2`}
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
                    >
                      <mode.icon className="h-4 w-4 shrink-0" />
                      <span>{getEditorModeLabel(mode.value, mode.label)}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{getEditorModeDescription(mode.value, mode.description)}</TooltipContent>
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
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-200">Cut Count</span>
              <span className="rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-100">
                {maxCutsRequested} cuts
              </span>
            </div>
            <Slider
              min={MAX_CUTS_MIN}
              max={MAX_CUTS_MAX}
              step={1}
              value={[maxCutsRequested]}
              className="editor-settings-slider"
              disabled={manualMode}
              onValueChange={(values) => {
                const candidate = Number(values?.[0] ?? maxCutsRequested);
                if (!Number.isFinite(candidate)) return;
                setMaxCutsRequested(clamp(Math.round(candidate), MAX_CUTS_MIN, MAX_CUTS_MAX));
              }}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>{MAX_CUTS_MIN}</span>
              <span>{MAX_CUTS_MAX}</span>
            </div>
            {manualMode ? (
              <p className="mt-2 text-[11px] text-violet-200/90">
                Auto-cuts are disabled while Manual Timestamp Editor is active.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-200">Effects</span>
              <span className="rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-100">
                {isVerticalMode ? "Vertical Short-Form Pipeline" : "Horizontal Long-Form Pipeline"}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Viral Mode</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {VIRAL_MODE_OPTIONS.map((mode) => (
                    <Tooltip key={mode.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`${sectionPillClass(viralMode === mode.value)} flex items-center gap-2`}
                          onClick={() => applyViralModeSelection(mode.value)}
                        >
                          <mode.icon className="h-4 w-4 shrink-0" />
                          <span>{mode.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{mode.description}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Enhance Effects</p>
                  <span className="rounded-full border border-violet-300/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
                    {enhanceMode === "auto" ? "Auto mix" : ENHANCE_MODE_OPTIONS.find((mode) => mode.value === enhanceMode)?.label || "Custom"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {ENHANCE_MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      className={`${sectionPillClass(enhanceMode === mode.value)} flex items-center gap-2 ${onlyHookAndCut && mode.value !== "off" ? "cursor-not-allowed opacity-60" : ""}`}
                      disabled={onlyHookAndCut && mode.value !== "off"}
                      onClick={() => applyEnhanceModeSelection(mode.value)}
                    >
                      <mode.icon className="h-4 w-4 shrink-0" />
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className={`${sectionPillClass(transitionsEnabled)} ${onlyHookAndCut ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={onlyHookAndCut}
                  onClick={() => {
                    const nextTransitions = !transitionsEnabled;
                    setEffectToggles({
                      transitions: nextTransitions,
                      smartZoom: smartZoomEnabled,
                      soundFx: soundFxEnabled,
                    });
                    refreshEffectPreview();
                  }}
                >
                  Transitions {transitionsEnabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  className={`${sectionPillClass(smartZoomEnabled)} ${onlyHookAndCut ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={onlyHookAndCut}
                  onClick={() => {
                    const nextSmartZoom = !smartZoomEnabled;
                    setEffectToggles({
                      transitions: transitionsEnabled,
                      smartZoom: nextSmartZoom,
                      soundFx: soundFxEnabled,
                    });
                    refreshEffectPreview();
                  }}
                >
                  Smart Zoom {smartZoomEnabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  className={`${sectionPillClass(soundFxEnabled)} ${onlyHookAndCut ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={onlyHookAndCut}
                  onClick={() => {
                    const nextSoundFx = !soundFxEnabled;
                    setEffectToggles({
                      transitions: transitionsEnabled,
                      smartZoom: smartZoomEnabled,
                      soundFx: nextSoundFx,
                    });
                    refreshEffectPreview();
                  }}
                >
                  Sound FX {soundFxEnabled ? "On" : "Off"}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-xs text-slate-300">Real-time preview clip</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10 px-3 text-xs md:min-h-9"
                    onClick={() => {
                      if (showEffectPreview) {
                        setShowEffectPreview(false);
                        return;
                      }
                      refreshEffectPreview();
                    }}
                  >
                    {showEffectPreview ? "Hide" : "Show"}
                  </Button>
                  {showEffectPreview && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10 px-3 text-xs md:min-h-9"
                      disabled={effectPreviewLoading}
                      onClick={refreshEffectPreview}
                    >
                      Refresh
                    </Button>
                  )}
                </div>
              </div>

              {showEffectPreview && (
                <div className="overflow-hidden rounded-xl border border-violet-400/30 bg-black/35">
                  <div className="flex items-center justify-between px-3 py-2">
                    <p className="text-sm font-medium text-violet-100">Live Preview</p>
                    <span className="text-xs text-slate-300">
                      {currentEffectPreview === "all"
                        ? "All effects"
                        : currentEffectPreview === "auto"
                          ? "Auto mix"
                          : currentEffectPreview === "swoosh"
                            ? "Swoosh SFX"
                            : currentEffectPreview === "zooms"
                              ? "Zooms"
                              : "Transitions"}
                    </span>
                  </div>
                  <div className="relative aspect-video bg-black">
                    {effectPreviewLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
                      </div>
                    ) : effectPreviewUrl ? (
                      <video
                        src={effectPreviewUrl}
                        autoPlay
                        loop
                        muted
                        controls
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-slate-400">
                        {effectPreviewError || "Preview will appear after your next effect selection."}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2 text-xs text-slate-400">
                    {effectPreviewError
                      ? effectPreviewError
                      : `Showing ${currentEffectPreview} on a high-energy segment (${viralMode === "none" ? "manual mode" : viralMode === "tiktok" ? "TikTok viral profile" : "YouTube viral profile"}).`}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {onlyHookAndCut
                ? "Effects are disabled while Only Hook & Cut is enabled."
                : "These toggles are applied to all new renders and re-renders."}
            </p>
          </div>

          <Accordion type="single" collapsible className="rounded-xl border border-white/10 bg-white/[0.02] px-3">
            <AccordionItem value="more-options" className="border-0">
              <AccordionTrigger className="py-3 text-sm text-slate-200 hover:no-underline">
                More Options
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">Long-Form Efficiency</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {LONG_FORM_PRESET_OPTIONS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={`${sectionPillClass(longFormPreset === preset.value)} flex items-center gap-2`}
                          onClick={() => {
                            const defaults = LONG_FORM_PRESET_DEFAULTS[preset.value];
                            setLongFormPreset(preset.value);
                            setLongFormAggression(defaults.aggression);
                            setLongFormClarityVsSpeed(defaults.clarityVsSpeed);
                            setTangentKiller(defaults.tangentKiller);
                          }}
                        >
                          <preset.icon className="h-4 w-4 shrink-0" />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
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
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
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
                    >
                      Tangent Killer {tangentKiller ? "On" : "Off"}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`${sectionPillClass(defaultHookSelectionMode === "auto")} flex items-center gap-2 ${manualMode ? "cursor-not-allowed opacity-60" : ""}`}
                        disabled={manualMode}
                        onClick={() => setDefaultHookSelectionMode("auto")}
                      >
                        <Bot className="h-4 w-4 shrink-0" />
                        <span>Hook Auto</span>
                      </button>
                      <button
                        type="button"
                        className={`${sectionPillClass(defaultHookSelectionMode === "manual")} flex items-center gap-2 ${manualMode ? "cursor-not-allowed opacity-60" : ""}`}
                        disabled={manualMode}
                        onClick={() => setDefaultHookSelectionMode("manual")}
                      >
                        <MousePointerClick className="h-4 w-4 shrink-0" />
                        <span>Hook Manual</span>
                      </button>
                    </div>
                  </div>
                  {manualMode ? (
                    <p className="text-[11px] text-violet-200/90">
                      Hook selection is locked to manual markers while Manual Timestamp Editor is ON.
                    </p>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-200">Captions</p>
              <p className="text-xs text-slate-400">
                {autoCaptionsEnabled ? "Enabled" : "Disabled"} · {activeSubtitlePresetMeta?.label ?? formatNicheLabel(activeSubtitlePreset)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                className={`min-h-12 rounded-xl px-5 md:min-h-10 ${
                  autoCaptionsEnabled
                    ? "bg-violet-500/85 text-white hover:bg-violet-400"
                    : "border border-white/15 bg-white/[0.03] text-slate-200 hover:border-violet-300/40 hover:bg-violet-400/10"
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
                  className="min-h-12 rounded-xl bg-gradient-to-r from-rose-500/90 to-violet-500/90 text-white hover:from-rose-400 hover:to-violet-400 md:min-h-10"
                  onClick={() => navigate("/settings")}
                >
                  Setup Captions
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Accordion type="single" collapsible className="rounded-xl border border-white/10 bg-white/[0.02] px-3">
          <AccordionItem value="caption-options" className="border-0">
            <AccordionTrigger className="py-3 text-sm text-slate-200 hover:no-underline">
              More Options
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
                            ? "border-violet-300/70 bg-violet-500/20 text-violet-100 shadow-[0_0_16px_rgba(168,85,247,0.28)]"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-violet-300/40 hover:text-white"
                        } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
                        onClick={() => selectSubtitlePreset(preset.id)}
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
                      <span className="text-[11px] text-slate-400">Font</span>
                      <select
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-100"
                        value={subtitleStyleConfig.fontId}
                        onChange={(event) =>
                          updateMrBeastSubtitleStyle({ fontId: event.target.value as SubtitleStyleConfig["fontId"] })
                        }
                      >
                        {MRBEAST_FONT_OPTIONS.map((fontOption) => (
                          <option key={fontOption.id} value={fontOption.id} className="bg-[#12121f] text-white">
                            {fontOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400">Animation</span>
                      <select
                        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-slate-100"
                        value={subtitleStyleConfig.animation}
                        onChange={(event) =>
                          updateMrBeastSubtitleStyle({ animation: event.target.value as SubtitleStyleConfig["animation"] })
                        }
                      >
                        {MRBEAST_ANIMATION_OPTIONS.map((animationOption) => (
                          <option key={animationOption.id} value={animationOption.id} className="bg-[#12121f] text-white">
                            {animationOption.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-slate-400">Outline ({subtitleStyleConfig.outlineWidth}px)</span>
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
                  <Button
                    type="button"
                    className="min-h-12 rounded-xl bg-violet-500/85 text-white hover:bg-violet-400 md:min-h-10"
                    onClick={() => void saveSubtitleStyle()}
                    disabled={!subtitleStyleDirty || savingSubtitleStyle}
                  >
                    {savingSubtitleStyle ? "Saving..." : subtitleStyleDirty ? "Save Captions" : "Captions Saved"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main mx-auto min-h-screen max-w-6xl overflow-x-clip px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-6">
            <div className="w-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              {me && (
                <>
                  <Badge className="border-cyan-300/40 bg-cyan-500/15 text-cyan-100">
                    {activeEditorsNow} active editors now
                  </Badge>
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
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {isDevAccount
                      ? "Unlimited re-renders"
                      : rerendersRemainingToday === null
                        ? "Unlimited re-renders"
                        : `${rerendersRemainingToday} re-renders left today`}
                  </Badge>
                </>
              )}
                <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <div
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 ${
                      onlyHookAndCut
                        ? "border-violet-300/45 bg-violet-500/18 text-violet-100 shadow-[0_10px_28px_-22px_rgba(168,85,247,0.85)]"
                        : "border-border/60 bg-background/35 text-muted-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left text-xs font-medium transition hover:text-foreground"
                      onClick={() => setOnlyHookAndCut((prev) => !prev)}
                      aria-label={onlyHookAndCut ? t("editor.onlyHookCut.disable") : t("editor.onlyHookCut.enable")}
                      title={onlyHookAndCut ? t("editor.onlyHookCut.on") : t("editor.onlyHookCut.off")}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      {onlyHookAndCut ? t("editor.onlyHookCut.on") : t("editor.onlyHookCut.off")}
                    </button>
                    <Switch
                      checked={onlyHookAndCut}
                      onCheckedChange={setOnlyHookAndCut}
                      aria-label={onlyHookAndCut ? t("editor.onlyHookCut.disable") : t("editor.onlyHookCut.enable")}
                    />
                  </div>
                  <div
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 ${
                      hideJobsPanel
                        ? "border-border/60 bg-background/35 text-muted-foreground"
                        : "border-cyan-300/45 bg-cyan-500/14 text-cyan-100 shadow-[0_10px_28px_-22px_rgba(56,189,248,0.82)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium transition hover:text-foreground"
                      onClick={() => setHideJobsPanel((prev) => !prev)}
                      aria-label={hideJobsPanel ? t("editor.jobs.show") : t("editor.jobs.hide")}
                    >
                      {hideJobsPanel ? t("editor.jobs.show") : t("editor.jobs.hide")}
                    </button>
                    <Switch
                      checked={!hideJobsPanel}
                      onCheckedChange={(checked) => setHideJobsPanel(!checked)}
                      aria-label={hideJobsPanel ? t("editor.jobs.show") : t("editor.jobs.hide")}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="rounded-full border-border/60 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      editorGuidePromptedRef.current = true;
                      setEditorGuideOpen(true);
                    }}
                    aria-label={t("editor.help.open")}
                    title={t("editor.help.title")}
                  >
                    <MapIcon className="h-4 w-4" />
                  </Button>
                  <Button onClick={handlePickFile} className="w-full rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto">
                    <Plus className="w-4 h-4" /> {t("editor.newProject")}
                  </Button>
                </div>
              </div>
              <div className="editor-settings-shell w-full rounded-[1.35rem] border border-violet-400/20 bg-[linear-gradient(145deg,#0F0F1A_0%,#12121F_100%)] p-3.5 shadow-[0_16px_55px_-34px_rgba(168,85,247,0.65)] md:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-violet-100/95">{t("editor.settings.title")}</p>
                    {hideEditorControlsPanel ? <span className="text-xs text-slate-400">{t("editor.settings.collapsed")}</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideEditorControlsPanel((prev) => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-slate-300 transition hover:border-violet-300/40 hover:text-violet-100"
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
                    <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                      {t("editor.settings.hidden")}
                    </div>
                  ) : (
                    <div className={`space-y-3 ${mobilePipeline ? "pb-20" : ""}`}>
                      {captionEngineOffline ? (
                        <div className="rounded-xl border border-rose-300/30 bg-gradient-to-r from-rose-500/25 via-violet-500/15 to-transparent px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium text-rose-100">Captions Offline - Set OpenAI Key to Unlock</p>
                            <Button
                              type="button"
                              className="min-h-12 rounded-xl bg-gradient-to-r from-rose-500/90 to-violet-500/90 text-white hover:from-rose-400 hover:to-violet-400 md:min-h-10"
                              onClick={() => navigate("/settings")}
                            >
                              Fix Now
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {!isVerticalMode ? (
                        <div className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-3 backdrop-blur-xl">
                          <div className="flex items-center space-x-3">
                            <Switch id="manual-timestamp" checked={manualMode} onCheckedChange={handleManualModeSwitch} />
                            <label htmlFor="manual-timestamp" className="text-lg font-medium text-violet-100">
                              Manual Timestamp Editor (override auto cuts & hook)
                            </label>
                          </div>
                          <p className="mt-2 text-xs text-slate-300">
                            {manualMode
                              ? "Manual mode ON: your markers control hook/cuts/removals, override automatic pacing choices, and typically add 10-30% ETA for iteration."
                              : "Manual mode OFF: full Auto mode is active and the editor controls hook/cuts automatically."}
                          </p>
                          {manualMode ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setManualTimestampEditorOpen(true)}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Open Manual Timestamp Editor
                              </Button>
                              <span className="text-[11px] text-violet-200/85">Opens as popup</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quick Controls</p>
                          <Badge className="border-violet-300/35 bg-violet-500/15 text-violet-100">Recommended</Badge>
                        </div>
                        <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${editorModeConfirmed ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
                          {!editorModeConfirmed ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-400">Format</p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                {RENDER_MODE_OPTIONS.map((mode) => {
                                  const isActive = mode.value === "vertical" ? isVerticalMode : !isVerticalMode;
                                  return (
                                    <button
                                      key={mode.value}
                                      type="button"
                                      className={`${sectionPillClass(isActive)} flex min-h-11 items-center gap-1.5 px-2 py-2 text-xs leading-tight md:text-sm`}
                                      onClick={() => handleSelectRenderMode(mode.value)}
                                    >
                                      <mode.icon className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                                      <span className="min-w-0 whitespace-normal break-words">{getRenderModeLabel(mode.value)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400">Vibe</p>
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
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400">Cuts</p>
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
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400">Captions</p>
                            <Button
                              type="button"
                              className={`w-full min-h-12 rounded-xl md:min-h-[46px] ${
                                autoCaptionsEnabled
                                  ? "bg-violet-500/85 text-white hover:bg-violet-400"
                                  : "border border-white/15 bg-white/[0.03] text-slate-200 hover:border-violet-300/40 hover:bg-violet-400/10"
                              }`}
                              onClick={() => {
                                if (captionsToggleDisabled) return;
                                const nextState = !autoCaptionsEnabled;
                                setAutoCaptionsEnabled(nextState);
                                setSubtitleStyleDirty(true);
                              }}
                              disabled={captionsToggleDisabled}
                            >
                              {autoCaptionsEnabled ? "Captions On" : "Captions Off"}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="rounded-full border border-violet-300/35 bg-violet-500/15 px-2.5 py-1 text-xs text-violet-100">
                            {activePlatformRecommendation.label}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-12 rounded-xl bg-violet-500/85 px-4 text-white hover:bg-violet-400 md:min-h-10"
                            onClick={applyPlatformRecommendation}
                          >
                            Apply Suggestion
                          </Button>
                        </div>
                      </div>

                      {editorModeConfirmed ? (
                        <>
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
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
                                  <AccordionItem key={item.key} value={item.key} className="rounded-xl border border-white/10 bg-white/[0.02] px-3">
                                    <AccordionTrigger className="py-3 text-sm text-slate-100 hover:no-underline">
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
                                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 md:grid-cols-4">
                                  {EDITOR_SETTINGS_SECTIONS.map((item) => (
                                    <TabsTrigger
                                      key={item.key}
                                      value={item.key}
                                      className="editor-settings-tab min-h-12 rounded-lg border border-transparent text-xs text-slate-300 data-[state=active]:border-violet-300/60 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-100 data-[state=active]:shadow-[0_0_18px_rgba(168,85,247,0.3)]"
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
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                              Outcome automation: {outcomeAutomationProfile.enabled
                                ? `${outcomeAutomationProfile.sampleSize} outcomes, ${outcomeAutomationConfidencePercent}% confidence${Math.abs(outcomeAutomationExpectedLiftPoints) >= 0.1 ? `, expected ${outcomeAutomationExpectedLiftPoints >= 0 ? "+" : ""}${outcomeAutomationExpectedLiftPoints.toFixed(1)} pts` : ""}.`
                                : outcomeAutomationProfile.reasons?.[0] || "Collecting watch-time outcomes to calibrate menu defaults."}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
                          Select Horizontal or Vertical in Quick Controls to unlock Format & Platform and the rest of editor settings.
                        </div>
                      )}

                      {/* Mobile adaptation: persistent bottom CTA for one-thumb apply-and-render flow. */}
                      {mobilePipeline ? (
                        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                          <div className="pointer-events-auto rounded-2xl border border-violet-300/35 bg-[linear-gradient(145deg,rgba(15,15,26,0.96),rgba(18,18,31,0.92))] p-2 shadow-[0_-10px_30px_-14px_rgba(168,85,247,0.55)] backdrop-blur-xl">
                            <Button
                              type="button"
                              className="min-h-12 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-400 text-white hover:from-violet-400 hover:to-fuchsia-300"
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setEditorModeConfirmed(false);
                if (isVerticalMode) {
                  prepareVerticalFile(file);
                } else {
                  void handleFile(file);
                }
              }
              if (e.target) e.target.value = "";
            }}
          />

          <div className={`grid grid-cols-1 gap-6 ${hideJobsPanel || isVerticalMode ? "lg:grid-cols-1" : "lg:grid-cols-[280px_1fr]"}`}>
            {!hideJobsPanel && !isVerticalMode ? (
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
              {isVerticalMode && (
                <div className="glass-card border border-emerald-400/35 bg-gradient-to-r from-emerald-950/55 via-slate-950/70 to-slate-950/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Clips Selector</p>
                      <p className="text-xs text-emerald-100/80">
                        Auto uses duration-based batch scaling up to 20 exports. Fixed buttons force exact clip count.
                      </p>
                    </div>
                    <p className="text-[11px] text-emerald-200/75">Vertical Clip Builder</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {VERTICAL_CLIP_SELECTOR_OPTIONS.map((option) => {
                      const autoSelected = !verticalClipCountTouched || verticalClipCount === 0;
                      const selected = option.value === 0
                        ? autoSelected
                        : verticalClipCountTouched && verticalClipCount === option.value;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            if (option.value === 0) {
                              setVerticalClipCountTouched(false);
                              setVerticalClipCount(DEFAULT_VERTICAL_CLIP_COUNT_BY_MODE[verticalSelectionMode]);
                              return;
                            }
                            setVerticalClipCountTouched(true);
                            setVerticalClipCount(option.value);
                          }}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                            selected
                              ? "border-emerald-300/75 bg-emerald-400/20 text-emerald-100 shadow-[0_0_0_1px_rgba(74,222,128,0.35)]"
                              : "border-emerald-200/20 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-white"
                          }`}
                        >
                          <span>{option.label}</span>
                          {option.status ? (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                option.status === "ready"
                                  ? "bg-emerald-500/25 text-emerald-200"
                                  : "bg-red-500/20 text-red-200"
                              }`}
                            >
                              {option.status === "ready" ? "Ready" : "Failed"}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

              <div className={isVerticalMode ? "space-y-6" : ""}>
                {isVerticalMode && (
                  <div className="glass-card border border-emerald-400/25 bg-gradient-to-b from-slate-950/90 via-slate-900/75 to-slate-950/90 p-5 space-y-5 flex flex-col">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-emerald-100">Vertical Clip Builder</p>
                      <p className="text-xs text-emerald-100/75">
                        {skipManualWebcamCrop
                          ? "Manual webcam crop is skipped. Vertical clips render directly from source framing."
                          : "Manual webcam selector is enabled. Drag, resize, and fine-tune the top crop while previewing live output."}
                      </p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
                        onClick={() => {
                          setCropInteraction(null);
                          setSkipManualWebcamCrop((prev) => !prev);
                        }}
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            skipManualWebcamCrop ? "bg-emerald-300" : "bg-violet-300"
                          }`}
                        />
                        {skipManualWebcamCrop ? "Using source framing" : "Use manual webcam crop"}
                      </button>
                      <label className="inline-flex items-center gap-2 rounded-full border border-violet-300/35 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-100">
                        <span>Reorder cards</span>
                        <Switch checked={verticalCardReorderEnabled} onCheckedChange={setVerticalCardReorderEnabled} />
                      </label>
                    </div>

                  <div className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start ${verticalPreviewUrl ? "order-2" : ""}`}>
                    <div className="w-full" style={{ order: previewCardOrder }}>
                      <video
                        ref={verticalCompositionVideoRef}
                        src={verticalPreviewUrl || undefined}
                        muted
                        loop
                        playsInline
                        className="hidden"
                      />
                      <div className="rounded-2xl border border-emerald-300/30 bg-black/85 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium uppercase tracking-[0.13em] text-emerald-200">Live Preview</p>
                          {verticalCardReorderEnabled ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => moveVerticalEditorCard("preview", "up")}
                                disabled={previewCardOrder <= 0}
                              >
                                Up
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => moveVerticalEditorCard("preview", "down")}
                                disabled={previewCardOrder >= 1}
                              >
                                Down
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <div className="mx-auto w-full max-w-[420px]">
                          <div ref={verticalCompositionFrameRef} className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                            <canvas
                              ref={verticalCompositionCanvasRef}
                              className="h-full w-full rounded-xl border border-emerald-300/30 bg-black"
                            />
                            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-emerald-200/10" />
                            {verticalCaptionEnabled && verticalCaptionPreviewText && verticalPreviewUrl ? (
                              <div
                                className="absolute z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
                                style={{
                                  left: `${Math.round(clampVerticalCaptionPosition(verticalCaptionPositionX) * 100)}%`,
                                  top: `${Math.round(clampVerticalCaptionPosition(verticalCaptionPositionY) * 100)}%`,
                                }}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200/70 bg-slate-900/85 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100 shadow-[0_8px_18px_rgba(0,0,0,0.5)] hover:bg-slate-800/90"
                                  onClick={openCaptionInlineEditor}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Caption
                                </button>
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1 rounded-full border border-cyan-200/70 bg-slate-900/85 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100 shadow-[0_8px_18px_rgba(0,0,0,0.5)] ${captionDragInteraction ? "cursor-grabbing" : "cursor-grab"} hover:bg-slate-800/90`}
                                  onPointerDown={beginCaptionDrag}
                                  aria-label="Drag caption position"
                                  title="Drag caption position"
                                >
                                  <MousePointerClick className="h-3 w-3" />
                                  Move
                                </button>
                              </div>
                            ) : null}
                            {verticalCaptionInlineEditorOpen && verticalCaptionEnabled && verticalPreviewUrl ? (
                              <div
                                className="absolute z-30 w-[min(92vw,280px)] -translate-x-1/2 translate-y-3"
                                style={{
                                  left: `${Math.round(clampVerticalCaptionPosition(verticalCaptionPositionX) * 100)}%`,
                                  top: `${Math.round(clampVerticalCaptionPosition(verticalCaptionPositionY) * 100)}%`,
                                }}
                              >
                                <div className="rounded-xl border border-cyan-200/60 bg-slate-950/95 p-2 shadow-[0_14px_30px_rgba(0,0,0,0.55)]">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-100/80">Edit caption</p>
                                  <textarea
                                    ref={verticalCaptionInlineTextareaRef}
                                    value={verticalCaptionInlineDraft}
                                    onChange={(event) => setVerticalCaptionInlineDraft(normalizeVerticalCaptionEditorText(event.target.value))}
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        closeCaptionInlineEditor();
                                        return;
                                      }
                                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                        event.preventDefault();
                                        applyCaptionInlineEditor();
                                      }
                                    }}
                                    rows={4}
                                    placeholder={"WTF 😂\nNO WAY HAPPENED\nRUN IT BACK"}
                                    className="mt-1 min-h-[84px] w-full resize-y rounded-lg border border-cyan-300/35 bg-slate-900/85 px-2 py-1.5 text-xs text-cyan-50 outline-none focus:border-cyan-200/80"
                                  />
                                  <div className="mt-2 flex items-center justify-end gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={closeCaptionInlineEditor}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={applyCaptionInlineEditor}
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {!verticalPreviewUrl ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black px-6 text-center text-sm text-slate-300">
                                Upload a video to activate live preview.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-emerald-300/25 bg-slate-950/75 p-4" style={{ order: captionsCardOrder }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-100">Vertical Captions</p>
                        <p className="text-[11px] text-emerald-100/70">
                          Local transcript-driven overlays with viral style presets.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${verticalCaptionEnabled ? "text-emerald-300" : "text-muted-foreground"}`}>
                          {verticalCaptionEnabled ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={verticalCaptionEnabled}
                          onCheckedChange={setVerticalCaptionEnabled}
                        />
                      </div>
                    </div>
                    {verticalCardReorderEnabled ? (
                      <div className="-mt-1 flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => moveVerticalEditorCard("captions", "up")}
                          disabled={captionsCardOrder <= 0}
                        >
                          Up
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => moveVerticalEditorCard("captions", "down")}
                          disabled={captionsCardOrder >= 1}
                        >
                          Down
                        </Button>
                      </div>
                    ) : null}

                    {verticalCaptionEnabled ? (
                      <>
                        <div className="grid gap-2">
                          {VERTICAL_CAPTION_PRESET_OPTIONS.map((preset) => {
                            const Icon = preset.icon;
                            const selected = verticalCaptionPreset === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                className={`rounded-lg border p-3 text-left transition ${
                                  selected
                                    ? "border-emerald-300/65 bg-emerald-500/15 text-emerald-50 shadow-[0_0_0_1px_rgba(74,222,128,0.35)]"
                                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-300/35 hover:text-white"
                                }`}
                                onClick={() => applyVerticalCaptionPreset(preset.id)}
                              >
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                                  <Icon className="h-3.5 w-3.5" />
                                  {preset.label}
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed">{preset.description}</p>
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid gap-3">
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-100/70">Font</span>
                            <select
                              className="w-full rounded-lg border border-emerald-200/20 bg-slate-900/70 px-2.5 py-2 text-xs text-emerald-100"
                              value={verticalCaptionFontId}
                              onChange={(event) => setVerticalCaptionFontId(event.target.value as SubtitleStyleConfig["fontId"])}
                            >
                              {MRBEAST_FONT_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-100/70">Text color</span>
                            <div className="space-y-2 rounded-lg border border-yellow-300/35 bg-yellow-400/5 px-3 py-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={verticalTextColorSliderFromHex(
                                  normalizeVerticalCaptionHex(verticalCaptionTextColor, activeVerticalCaptionPresetStyle.textColor),
                                )}
                                onChange={(event) =>
                                  setVerticalCaptionTextColor(verticalTextColorFromSlider(event.currentTarget.valueAsNumber))
                                }
                                className="w-full accent-yellow-400"
                              />
                              <div className="flex items-center justify-between text-[10px] text-yellow-200/85">
                                <span>Yellow slider</span>
                                <span>{normalizeVerticalCaptionHex(verticalCaptionTextColor, activeVerticalCaptionPresetStyle.textColor)}</span>
                              </div>
                            </div>
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-100/70">Accent color</span>
                            <input
                              type="color"
                              value={normalizeVerticalCaptionHex(verticalCaptionAccentColor, activeVerticalCaptionPresetStyle.accentColor)}
                              onChange={(event) =>
                                setVerticalCaptionAccentColor(
                                  normalizeVerticalCaptionHex(event.target.value, activeVerticalCaptionPresetStyle.accentColor),
                                )
                              }
                              className="h-9 w-full cursor-pointer rounded-lg border border-emerald-200/20 bg-slate-900/70 p-1"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-100/70">Outline color</span>
                            <input
                              type="color"
                              value={normalizeVerticalCaptionHex(verticalCaptionOutlineColor, activeVerticalCaptionPresetStyle.outlineColor)}
                              onChange={(event) =>
                                setVerticalCaptionOutlineColor(
                                  normalizeVerticalCaptionHex(event.target.value, activeVerticalCaptionPresetStyle.outlineColor),
                                )
                              }
                              className="h-9 w-full cursor-pointer rounded-lg border border-emerald-200/20 bg-slate-900/70 p-1"
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Font size</span>
                              <span>{clampVerticalCaptionFontSize(verticalCaptionFontSize)} pt</span>
                            </div>
                            <Slider
                              value={[clampVerticalCaptionFontSize(verticalCaptionFontSize)]}
                              min={VERTICAL_CAPTION_FONT_SIZE_MIN}
                              max={VERTICAL_CAPTION_FONT_SIZE_MAX}
                              step={2}
                              onValueChange={(value) =>
                                setVerticalCaptionFontSize(
                                  clampVerticalCaptionFontSize(value?.[0] ?? VERTICAL_CAPTION_FONT_SIZE_DEFAULT),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Outline</span>
                              <span>{clampVerticalCaptionOutlineWidth(verticalCaptionOutlineWidth)} px</span>
                            </div>
                            <Slider
                              value={[clampVerticalCaptionOutlineWidth(verticalCaptionOutlineWidth)]}
                              min={VERTICAL_CAPTION_OUTLINE_WIDTH_MIN}
                              max={VERTICAL_CAPTION_OUTLINE_WIDTH_MAX}
                              step={1}
                              onValueChange={(value) =>
                                setVerticalCaptionOutlineWidth(
                                  clampVerticalCaptionOutlineWidth(value?.[0] ?? activeVerticalCaptionPresetStyle.outlineWidth),
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                            <span className="text-muted-foreground">Drop shadow</span>
                            <Switch
                              checked={verticalCaptionShadowEnabled}
                              onCheckedChange={setVerticalCaptionShadowEnabled}
                            />
                          </label>
                          <label className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                            <span className="text-muted-foreground">Solid caption box</span>
                            <Switch
                              checked={verticalCaptionBoxEnabled}
                              onCheckedChange={setVerticalCaptionBoxEnabled}
                            />
                          </label>
                        </div>

                        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Caption animation</span>
                            <span className="text-[11px] text-muted-foreground">
                              {VERTICAL_CAPTION_ANIMATION_OPTIONS.find((option) => option.id === verticalCaptionAnimationMode)?.label || "Pop"}
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {VERTICAL_CAPTION_ANIMATION_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={`rounded-md border px-2.5 py-2 text-left text-[11px] transition ${
                                  verticalCaptionAnimationMode === option.id
                                    ? "border-emerald-300/65 bg-emerald-500/15 text-emerald-100"
                                    : "border-border/60 text-muted-foreground hover:border-emerald-300/35 hover:text-foreground"
                                }`}
                                onClick={() => setVerticalCaptionAnimationMode(option.id)}
                              >
                                <p className="font-medium uppercase tracking-[0.08em]">{option.label}</p>
                                <p className="mt-1 leading-relaxed text-[10px] opacity-80">{option.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {verticalCaptionShadowEnabled ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Shadow color</span>
                              <input
                                type="color"
                                value={normalizeVerticalCaptionHex(verticalCaptionShadowColor, activeVerticalCaptionPresetStyle.shadowColor)}
                                onChange={(event) =>
                                  setVerticalCaptionShadowColor(
                                    normalizeVerticalCaptionHex(event.target.value, activeVerticalCaptionPresetStyle.shadowColor),
                                  )
                                }
                                className="h-9 w-full cursor-pointer rounded-lg border border-border/60 bg-muted/20 p-1"
                              />
                            </label>
                            <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Shadow blur</span>
                                <span>{clampVerticalCaptionShadowBlur(verticalCaptionShadowBlur)} px</span>
                              </div>
                              <Slider
                                value={[clampVerticalCaptionShadowBlur(verticalCaptionShadowBlur)]}
                                min={VERTICAL_CAPTION_SHADOW_BLUR_MIN}
                                max={VERTICAL_CAPTION_SHADOW_BLUR_MAX}
                                step={1}
                                onValueChange={(value) =>
                                  setVerticalCaptionShadowBlur(
                                    clampVerticalCaptionShadowBlur(value?.[0] ?? activeVerticalCaptionPresetStyle.shadowBlur),
                                  )
                                }
                              />
                            </div>
                          </div>
                        ) : null}

                        {verticalCaptionBoxEnabled ? (
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Solid box color</span>
                            <input
                              type="color"
                              value={normalizeVerticalCaptionHex(verticalCaptionBoxColor, activeVerticalCaptionPresetStyle.boxColor)}
                              onChange={(event) =>
                                setVerticalCaptionBoxColor(
                                  normalizeVerticalCaptionHex(event.target.value, activeVerticalCaptionPresetStyle.boxColor),
                                )
                              }
                              className="h-9 w-full cursor-pointer rounded-lg border border-border/60 bg-muted/20 p-1"
                            />
                          </label>
                        ) : null}

                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Caption position X</span>
                            <span>{Math.round(clampVerticalCaptionPosition(verticalCaptionPositionX) * 100)}%</span>
                          </div>
                          <Slider
                            value={[Math.round(clampVerticalCaptionPosition(verticalCaptionPositionX) * 100)]}
                            min={2}
                            max={98}
                            step={1}
                            onValueChange={(value) => setVerticalCaptionPositionX(clampVerticalCaptionPosition((value?.[0] ?? 50) / 100))}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Caption position Y</span>
                            <span>{Math.round(clampVerticalCaptionPosition(verticalCaptionPositionY) * 100)}%</span>
                          </div>
                          <Slider
                            value={[Math.round(clampVerticalCaptionPosition(verticalCaptionPositionY) * 100)]}
                            min={2}
                            max={98}
                            step={1}
                            onValueChange={(value) => setVerticalCaptionPositionY(clampVerticalCaptionPosition((value?.[0] ?? 84) / 100))}
                          />
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">
                              Click CAPTION in the preview to edit text, or drag MOVE to reposition it.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => {
                                setVerticalCaptionPositionX(0.5);
                                setVerticalCaptionPositionY(0.84);
                              }}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>

                        <label className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">Editor auto-generate captions from transcript</span>
                          <Switch
                            checked={verticalCaptionAutoGenerate}
                            onCheckedChange={setVerticalCaptionAutoGenerate}
                          />
                        </label>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Custom caption phrases (optional)</p>
                          <Textarea
                            value={verticalCaptionText}
                            onChange={(event) => setVerticalCaptionText(normalizeVerticalCaptionEditorText(event.target.value))}
                            placeholder={"WTF 😂\nNO WAY HAPPENED\nRUN IT BACK"}
                            className="min-h-[92px] resize-y border-border/60 bg-muted/20 text-sm"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            One phrase per line, maximum 5 words each. Leave blank to use transcript-driven generation.
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Captions are disabled for this vertical render. Enable to apply preset styling.
                      </p>
                    )}
                    </div>
                  </div>

                  {!verticalPreviewUrl && (
                    <p className="text-xs text-muted-foreground">
                      Upload a file to open the webcam crop tool and 9:16 stacked preview.
                    </p>
                  )}

                  {verticalPreviewUrl && (
                    <div className="order-1 space-y-4">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                          {!skipManualWebcamCrop ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 border-white/20 bg-white/[0.04] text-xs hover:border-primary/40 hover:bg-primary/10"
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
                                className="h-8 border-white/20 bg-white/[0.04] text-xs hover:border-primary/40 hover:bg-primary/10"
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
                            className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-[0_24px_45px_rgba(0,0,0,0.45)] touch-none select-none"
                            style={sourceVideoMeta ? { aspectRatio: `${sourceVideoMeta.width} / ${sourceVideoMeta.height}` } : { aspectRatio: "16 / 9" }}
                          >
                            <video
                              ref={verticalSourceVideoRef}
                              src={verticalPreviewUrl}
                              controls
                              onLoadedMetadata={handleVerticalSourceMetadata}
                              className="h-full w-full object-contain"
                            />
                            {!skipManualWebcamCrop ? (
                              <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/80">
                                Manual Webcam Selector
                              </div>
                            ) : null}
                            {!skipManualWebcamCrop && webcamCropStyle && (
                              <div
                                className={`absolute border-2 border-cyan-300/95 bg-cyan-500/8 shadow-[0_0_0_1px_rgba(103,232,249,0.45)] ${cropInteraction ? "ring-2 ring-cyan-300/55" : ""}`}
                                style={{
                                  ...webcamCropStyle,
                                  boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.58)",
                                }}
                                onPointerDown={(event) => beginCropInteraction("move", event)}
                              >
                                {webcamPaddingPx > 0 && webcamCrop && (
                                  <div
                                    className="absolute border border-cyan-200/80 border-dashed pointer-events-none"
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
                                    className={`absolute h-3.5 w-3.5 rounded-full border border-white/90 bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)] ${handle.className}`}
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
                          disabled={!verticalSelectionReady || !!uploadingJobId || !!cropInteraction || !!captionDragInteraction}
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

                <video
                  ref={previewVideoRef}
                  src={previewVideoUrl || undefined}
                  preload="metadata"
                  playsInline
                  muted
                  onLoadedMetadata={handlePreviewLoadedMetadata}
                  onTimeUpdate={handlePreviewTimeUpdate}
                  onPlay={handlePreviewPlay}
                  onPause={handlePreviewPause}
                  onEnded={handlePreviewEnded}
                  onError={handlePreviewVideoError}
                  className="hidden"
                />
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

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pipeline</p>
                    <p className="text-xs text-muted-foreground">Live status updates while your job runs</p>
                  </div>
                  {activeJob && (
                    <Badge variant="outline" className={`text-xs flex items-center gap-1.5 ${statusBadgeClass(activeJob.status)}`}>
                      {normalizeStatus(activeJob.status) === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
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
                    <div className="space-y-1.5">
                      <div className="relative h-2 overflow-hidden rounded-full bg-[#1E1E2E]">
                        <motion.div
                          className="relative h-full rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600 shadow-[0_0_14px_rgba(168,85,247,0.45)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${totalPipelineProgress}%` }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-purple-300/30 to-transparent animate-pulse-slow" />
                        </motion.div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="uppercase tracking-[0.16em]">Job Progress</span>
                        <span>{Math.round(totalPipelineProgress)}%</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-card/50 p-3 sm:p-4">
                      {/* Mobile-first adaptation: vertical timeline on touch/mobile, horizontal rail on larger screens. */}
                      {mobilePipeline ? (
                        <ol className="space-y-3" aria-label="Pipeline stages">
                          {pipelineRows.map((row, idx) => (
                            <li key={row.key} className="relative">
                              {idx < pipelineRows.length - 1 ? (
                                <span
                                  aria-hidden="true"
                                  className={`absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-px ${
                                    row.connectorState === "done"
                                      ? "bg-emerald-400"
                                      : row.connectorState === "active"
                                        ? "bg-gradient-to-b from-primary via-violet-300 to-primary animate-pulse"
                                        : "border-l border-dashed border-border/80"
                                  }`}
                                />
                              ) : null}
                              <div className="flex items-start gap-3">
                                <div
                                  aria-current={row.state === "active" ? "step" : undefined}
                                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                    row.state === "done"
                                      ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                                      : row.state === "active"
                                        ? "border-primary/80 bg-primary/25 text-primary shadow-[0_0_20px_rgba(122,96,255,0.45)] animate-pulse"
                                        : row.state === "failed"
                                          ? "border-destructive/80 bg-destructive/20 text-destructive"
                                          : "border-border/70 bg-muted/30 text-muted-foreground"
                                  }`}
                                >
                                  {row.state === "done" ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : row.state === "active" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : row.state === "failed" ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : row.key === "zoom" ? (
                                    <ZoomIn className="h-4 w-4" />
                                  ) : (
                                    idx + 1
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 pb-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className={`text-sm font-medium ${row.state === "failed" ? "text-destructive" : "text-foreground"}`}>
                                      {row.label}
                                    </p>
                                    <Badge
                                      variant="secondary"
                                      className={`h-5 px-1.5 text-[10px] ${
                                        row.state === "done"
                                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                          : row.state === "active"
                                            ? "border-primary/40 bg-primary/15 text-primary"
                                            : row.state === "failed"
                                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                                              : "border-border/60 bg-muted/30 text-muted-foreground"
                                      }`}
                                    >
                                      {row.percent}%
                                    </Badge>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                                  {row.state === "failed" ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="mt-1 inline-flex items-center text-[11px] text-destructive underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/70"
                                        >
                                          Why this failed
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs border-destructive/40 bg-destructive/15 text-destructive">
                                        {failedGateReason || activeJob.error || "Pipeline failed in this step."}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="pipeline-scrollbar overflow-x-auto">
                          <ol className="flex min-w-[980px] items-start" aria-label="Pipeline stages">
                            {pipelineRows.map((row, idx) => (
                              <li key={row.key} className="relative flex-1 px-1">
                                <div className="flex items-center">
                                  <div
                                    aria-current={row.state === "active" ? "step" : undefined}
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                      row.state === "done"
                                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                                        : row.state === "active"
                                          ? "border-primary/80 bg-primary/25 text-primary shadow-[0_0_20px_rgba(122,96,255,0.45)] animate-pulse"
                                          : row.state === "failed"
                                            ? "border-destructive/80 bg-destructive/20 text-destructive"
                                            : "border-border/70 bg-muted/30 text-muted-foreground"
                                    }`}
                                  >
                                    {row.state === "done" ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : row.state === "active" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : row.state === "failed" ? (
                                      <XCircle className="h-4 w-4" />
                                    ) : row.key === "zoom" ? (
                                      <ZoomIn className="h-4 w-4" />
                                    ) : (
                                      idx + 1
                                    )}
                                  </div>
                                  {idx < pipelineRows.length - 1 ? (
                                    <div className="ml-2 mr-1 flex-1">
                                      {row.connectorState === "done" ? (
                                        <div className="h-1 rounded-full bg-emerald-400" />
                                      ) : row.connectorState === "active" ? (
                                        <div className="h-1 rounded-full bg-gradient-to-r from-primary via-violet-300 to-primary animate-pulse" />
                                      ) : (
                                        <div className="h-1 border-t border-dashed border-border/80" />
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="pt-2 pr-3">
                                  <p className={`text-[11px] font-medium ${row.state === "failed" ? "text-destructive" : "text-foreground"}`}>
                                    {row.label}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{row.detail}</p>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">{row.percent}%</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>

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
                      isPacingToRenderingTransitionFailure ? (
                        <div className="rounded-xl border border-red-600 bg-red-950/80 p-5">
                          <h3 className="text-lg font-bold text-red-300">Rendering Failed</h3>
                          <p className="mt-2 text-red-200">
                            Invalid transition from Pacing to Rendering - likely because Subtitles or Story was skipped/disabled.
                          </p>
                          <p className="mt-3 font-medium text-red-100">Try this to fix:</p>
                          <ul className="mt-1 list-disc space-y-1 pl-6 text-red-100">
                            <li>Enable Captions/Subtitles in Settings</li>
                            <li>Turn Enhance Effects OFF or to Basic</li>
                            <li>Lower Cut Count aggressiveness</li>
                          </ul>
                          <Button
                            className="mt-4 min-h-11 w-full gap-2 bg-purple-600 text-white hover:bg-purple-700 sm:w-auto"
                            disabled={reprocessingJobId === activeJob.id || rerenderLimitReached}
                            onClick={() => void handleRedoRender(activeJob)}
                          >
                            {reprocessingJobId === activeJob.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            Redo Renderer (with suggested fixes)
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3">
                          <p className="text-sm font-medium text-destructive">Processing failed in {failedStepKey ? STATUS_LABELS[failedStepKey] || "pipeline" : "pipeline"}.</p>
                          <p className="mt-1 text-xs text-destructive/90">{failureMessage || "Retry suggested."}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Retry suggestion: adjust settings and run Redo Renderer.</p>
                        </div>
                      )
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
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <Button
                              className="min-h-12 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                              onClick={() => setExportOpen(true)}
                            >
                              <Download className="h-4 w-4" />
                              {activeJob.renderMode === "vertical" ? "Open Clips" : "Open Export"}
                            </Button>
                            {paidTier ? (
                              <Button
                                variant="outline"
                                className="min-h-12 w-full gap-2 border-emerald-300/45 bg-emerald-500/5 text-emerald-100 hover:bg-emerald-500/15 sm:w-auto"
                                onClick={() =>
                                  navigate(`/feedback?jobId=${encodeURIComponent(activeJob.id)}&source=classic`)
                                }
                              >
                                <MessageSquareText className="h-4 w-4" />
                                Feedback
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {isTerminalStatus(activeJob.status) && activeJob.error !== "queue_canceled_by_user" && !isPacingToRenderingTransitionFailure && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Need another pass? Queue a redo render using your daily re-render allowance.
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-12 w-full gap-2 sm:min-h-10 sm:w-auto"
                          disabled={
                            reprocessingJobId === activeJob.id ||
                            rerenderLimitReached
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

                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Retention Summary</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Moved to Analytics page for a cleaner editor workspace.
                          </p>
                        </div>
                        <Button
                          type="button"
                          className="min-h-12 w-full gap-2 sm:min-h-10 sm:w-auto"
                          onClick={() => {
                            if (!paidTier && !isDevAccount) {
                              handleRetentionAnalyticsUpgrade();
                              return;
                            }
                            navigate(`/analytics?jobId=${encodeURIComponent(activeJob.id)}`);
                          }}
                        >
                          {paidTier || isDevAccount ? "Open Analytics" : "Upgrade for Analytics"}
                        </Button>
                      </div>
                    </div>

                      <div className="overflow-hidden rounded-lg border border-border/50 bg-[#060912]/95">
                        <button
                          type="button"
                          aria-expanded={pipelineLogOpen}
                          className="flex min-h-12 w-full items-center justify-between px-3 text-left text-xs text-foreground transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:min-h-10"
                          onClick={() => setPipelineLogOpen((prev) => !prev)}
                        >
                          <span className="font-medium">Processing Log</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{pipelineLogOpen ? "Hide" : "Show"} stream</span>
                        </button>
                        {pipelineLogOpen ? (
                          <div className="pipeline-scrollbar max-h-56 overflow-y-auto border-t border-border/40 px-3 py-2 font-mono text-[11px]">
                            {pipelineLogEntries.length > 0 ? (
                              pipelineLogEntries.map((entry, index) => (
                                <p
                                  key={`${entry.message}-${index}`}
                                  className={`mb-1 ${
                                    entry.level === "error"
                                      ? "text-destructive"
                                      : entry.level === "warn"
                                        ? "text-amber-300"
                                        : entry.level === "success"
                                          ? "text-emerald-300"
                                          : "text-slate-300"
                                  }`}
                                >
                                  [{logTimestamp}] {entry.message}
                                </p>
                              ))
                            ) : (
                              <p className="text-slate-400">[{logTimestamp}] Awaiting backend stage messages...</p>
                            )}
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

      <Dialog open={manualTimestampEditorOpen} onOpenChange={setManualTimestampEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-5xl sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Manual Timestamp Editor</DialogTitle>
            <DialogDescription>
              Fine-tune hook, keep, and remove windows in a dedicated timeline workspace.
            </DialogDescription>
          </DialogHeader>
          {manualMode && activeJob && !isVerticalMode ? (
            <ManualTimestampEditor
              markers={activeManualMarkers}
              suggestions={activeManualSuggestions}
              durationSec={activeManualDurationSec}
              currentTimeSec={activeManualCurrentTimeSec}
              isPlaying={activeManualPlaying}
              playbackRate={activeManualPlaybackRate}
              autoAssist={manualAutoAssist}
              aiSuggestLoading={manualAiSuggestLoadingJobId === activeJob.id}
              manualRetentionDelta={manualRetentionDisplay}
              aiRetentionDelta={aiRetentionDisplay}
              removeRatio={manualRemovalRatio}
              microHookSuggestions={manualMicroHookSuggestions}
              warning={manualWarnings[0] || null}
              beforeEditUrl={activeInputPreviewUrl}
              editedUrl={previewOutputUrl}
              onTogglePlay={handleManualTogglePlay}
              onSeek={handleManualPreviewSeek}
              onPlaybackRateChange={handleManualPlaybackRateChange}
              onAutoAssistChange={setManualAutoAssist}
              onRequestAiSuggest={() => void handleManualAiSuggest()}
              onClearAll={handleManualClearAll}
              onMarkersChange={handleManualMarkersChange}
              onAcceptSuggestion={handleManualAcceptSuggestion}
              onRejectSuggestion={handleManualRejectSuggestion}
              onApplyAllSuggestions={handleManualApplyAllSuggestions}
              onSave={() => void handleManualSaveAndRender()}
              saveDisabled={
                reprocessingJobId === activeJob.id ||
                !manualHasUnsavedChanges ||
                !isTerminalStatus(activeJob.status)
              }
              saving={reprocessingJobId === activeJob.id}
              hasUnsavedChanges={manualHasUnsavedChanges}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-slate-300">
              Enable Manual Timestamp mode on a horizontal job to edit timestamp ranges.
            </div>
          )}
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
        <DialogContent className="max-h-[85vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-white/10 bg-background/95 p-4 backdrop-blur-xl sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">{t("editor.help.title")}</DialogTitle>
            <DialogDescription>{t("editor.help.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("editor.help.interactiveDemo")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHelpDemoPlaying(false);
                      setHelpDemoStepIndex((prev) => (prev - 1 + HELP_DEMO_STEPS.length) % HELP_DEMO_STEPS.length);
                    }}
                  >
                    {t("editor.help.previous")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setHelpDemoPlaying((prev) => !prev)}
                  >
                    {helpDemoPlaying ? t("editor.help.pauseTour") : t("editor.help.resumeTour")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHelpDemoPlaying(false);
                      setHelpDemoStepIndex((prev) => (prev + 1) % HELP_DEMO_STEPS.length);
                    }}
                  >
                    {t("editor.help.next")}
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.45fr_1fr]">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#05070f]/95">
                  <div className="relative aspect-video bg-black">
                    <video
                      ref={helpDemoVideoRef}
                      src={HELP_DEMO_SAMPLE_VIDEO_SRC}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(168,85,247,0.30),transparent_52%),radial-gradient(circle_at_84%_80%,rgba(56,189,248,0.20),transparent_50%)]" />
                    <motion.div
                      key={activeHelpDemoStep.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.26, ease: "easeOut" }}
                      className="absolute inset-x-3 bottom-3 rounded-lg border border-white/20 bg-black/55 p-3 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2">
                        <activeHelpDemoStep.icon className="h-4 w-4 text-violet-200" />
                        <p className="text-sm font-semibold text-white">
                          {t(`editor.help.step.${activeHelpDemoStep.key}.title`, { defaultValue: activeHelpDemoStep.title })}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-200/90">
                        {t(`editor.help.step.${activeHelpDemoStep.key}.description`, { defaultValue: activeHelpDemoStep.description })}
                      </p>
                    </motion.div>
                  </div>
                  <div className="border-t border-white/10 px-3 py-2">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>{t("editor.help.step")} {helpDemoStepIndex + 1} / {HELP_DEMO_STEPS.length}</span>
                      <span>{activeHelpDemoStep.renderMode === "vertical" ? t("editor.help.verticalSample") : t("editor.help.horizontalSample")}</span>
                    </div>
                    <Progress value={helpDemoProgress} className="h-1.5 bg-white/10" />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#090c17]/90 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t("editor.help.settingsSnapshot")}</p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="mb-1 text-[11px] text-slate-400">{t("editor.help.renderMode")}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {RENDER_MODE_OPTIONS.map((mode) => (
                          <span key={`help-render-${mode.value}`} className={helpDemoPillClass(activeHelpDemoStep.renderMode === mode.value)}>
                            {getRenderModeLabel(mode.value)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-slate-400">{t("editor.help.retentionProfile")}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {RETENTION_PROFILE_OPTIONS.map((profile) => (
                          <span
                            key={`help-retention-${profile.value}`}
                            className={helpDemoPillClass(activeHelpDemoStep.retentionProfile === profile.value)}
                          >
                            {profile.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-slate-400">{t("editor.help.platform")}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {PLATFORM_OPTIONS.map((platform) => (
                          <span
                            key={`help-platform-${platform.value}`}
                            className={helpDemoPillClass(activeHelpDemoStep.platform === platform.value)}
                          >
                            {platform.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                        <p className="text-[11px] text-slate-400">{t("editor.help.editorMode")}</p>
                        <p className="mt-1 text-xs font-medium text-white">
                          {getEditorModeLabel(
                            activeHelpDemoStep.editorMode,
                            EDITOR_MODE_OPTIONS.find((mode) => mode.value === activeHelpDemoStep.editorMode)?.label || "Auto",
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                        <p className="text-[11px] text-slate-400">{t("editor.help.effects")}</p>
                        <p className="mt-1 text-xs font-medium text-white">
                          {ENHANCE_MODE_OPTIONS.find((mode) => mode.value === activeHelpDemoStep.enhanceMode)?.label || "Auto"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                        <p className="text-[11px] text-slate-400">{t("editor.help.viralMode")}</p>
                        <p className="mt-1 text-xs font-medium text-white">
                          {VIRAL_MODE_OPTIONS.find((mode) => mode.value === activeHelpDemoStep.viralMode)?.label || "None"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2">
                        <p className="text-[11px] text-slate-400">{t("editor.help.captionsAndCuts")}</p>
                        <p className="mt-1 text-xs font-medium text-white">
                          {activeHelpDemoStep.captionsOn ? t("editor.help.captionsOn") : t("editor.help.captionsOff")} - {activeHelpDemoStep.maxCuts} {t("editor.help.maxCuts")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("editor.help.modesTour")}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {HELP_DEMO_STEPS.map((step, index) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => {
                      setHelpDemoPlaying(false);
                      setHelpDemoStepIndex(index);
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      helpDemoStepIndex === index
                        ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                        : "border-white/10 bg-black/20 text-slate-300 hover:border-violet-300/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <step.icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {t(`editor.help.step.${step.key}.title`, { defaultValue: step.title })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-300/90">
                      {t(`editor.help.step.${step.key}.description`, { defaultValue: step.description })}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href="https://www.autoeditor.app/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {t("editor.help.privacyPolicy")}
                </a>
                <a
                  href="https://www.autoeditor.app/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {t("editor.help.termsOfService")}
                </a>
              </div>
              <Button type="button" size="sm" onClick={() => setEditorGuideOpen(false)}>
                {t("editor.help.closeDemo")}
              </Button>
            </div>
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
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/90">Manual Output Preview</p>
              {previewOutputUrl ? (
                <div className={`${activeJob?.renderMode === "vertical" ? "mx-auto aspect-[9/16] max-w-[260px]" : "aspect-video"} overflow-hidden rounded-xl border border-border/50 bg-black`}>
                  <video
                    src={previewOutputUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={handlePreviewLoadedMetadata}
                    onTimeUpdate={handlePreviewTimeUpdate}
                    onPlay={handlePreviewPlay}
                    onPause={handlePreviewPause}
                    onEnded={handlePreviewEnded}
                    onError={handlePreviewVideoError}
                    className={`h-full w-full ${activeJob?.renderMode === "vertical" ? "object-contain bg-black" : "object-cover"}`}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Final preview will appear here after rendering completes.
                </div>
              )}
            </div>
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
                  {Array.from({ length: Math.max(1, activeOutputUrls.length || effectiveVerticalClipCount) }).map((_, idx) => {
                    const clipNumber = idx + 1;
                    const prediction = verticalClipPredictions.find((item) => item.clip === clipNumber) || null;
                    return (
                      <div key={`clip-${clipNumber}`} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2"
                            onClick={() => handleDownload(idx)}
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

