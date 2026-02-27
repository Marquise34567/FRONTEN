import {
  Bot,
  Clapperboard,
  Flame,
  Gauge,
  Instagram,
  Music2,
  Rabbit,
  Scissors,
  Sparkles,
  Timer,
  Youtube,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type {
  AudioOption,
  CaptionEffect,
  CaptionStylePreset,
  EditorSectionKey,
  FormatPreset,
  PacingBand,
  QuickControlKey,
  RenderMode,
  StylePreset,
  VibeChip,
} from "@/features/autoeditor/types";

export const QUICK_CONTROL_CONFIG: Array<{
  key: QuickControlKey;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "autoEdit",
    title: "Auto-Edit",
    description: "Smart pacing baseline",
    icon: Sparkles,
  },
  {
    key: "highlightReel",
    title: "Highlight Reel",
    description: "Pull high-retention moments",
    icon: Flame,
  },
  {
    key: "speedRamp",
    title: "Speed Ramp",
    description: "Subtle speed dynamics",
    icon: Timer,
  },
  {
    key: "musicSync",
    title: "Music Sync",
    description: "Beat-aware cut sync",
    icon: Music2,
  },
];

export const MODE_OPTIONS: Array<{
  value: RenderMode;
  label: string;
  ratio: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "horizontal",
    label: "Horizontal",
    ratio: "16:9",
    description: "Narrative long-form flow",
    icon: Clapperboard,
  },
  {
    value: "vertical",
    label: "Vertical",
    ratio: "9:16",
    description: "Short-form highlights",
    icon: Rabbit,
  },
];

export const PLATFORM_OPTIONS: Array<{
  value: FormatPreset;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "tiktok", label: "TikTok", icon: Flame },
  { value: "instagram_reels", label: "IG Reels", icon: Instagram },
  { value: "youtube_shorts", label: "YouTube Shorts", icon: Youtube },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "custom", label: "Custom", icon: Bot },
];

export const VIBE_CHIPS: Array<{ value: VibeChip; label: string }> = [
  { value: "energetic", label: "Energetic" },
  { value: "chill", label: "Chill" },
  { value: "luxury", label: "Luxury" },
  { value: "cinematic", label: "Cinematic" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "motivational", label: "Motivational" },
  { value: "funny", label: "Funny" },
  { value: "dark", label: "Dark" },
];

export const STYLE_PRESETS: Array<{ value: StylePreset; label: string; preview: string }> = [
  {
    value: "clean",
    label: "Clean",
    preview: "from-slate-700/70 via-slate-500/50 to-slate-400/30",
  },
  {
    value: "minimal",
    label: "Minimal",
    preview: "from-slate-900/90 via-slate-700/70 to-slate-500/40",
  },
  {
    value: "bold",
    label: "Bold",
    preview: "from-blue-700/70 via-blue-500/60 to-slate-400/30",
  },
  {
    value: "vintage",
    label: "Vintage",
    preview: "from-amber-700/55 via-slate-600/45 to-slate-400/35",
  },
  {
    value: "meme",
    label: "Meme",
    preview: "from-rose-700/60 via-orange-500/55 to-yellow-400/40",
  },
  {
    value: "glitch",
    label: "Glitch",
    preview: "from-indigo-700/70 via-slate-500/55 to-cyan-400/45",
  },
  {
    value: "neon",
    label: "Neon",
    preview: "from-sky-700/70 via-blue-500/55 to-violet-500/45",
  },
];

export const PACING_BANDS: Array<{ value: PacingBand; label: string; icon: LucideIcon }> = [
  { value: "slow", label: "Cinematic", icon: Gauge },
  { value: "balanced", label: "Balanced", icon: Scissors },
  { value: "fast", label: "Punchy", icon: Zap },
];

export const CAPTION_STYLE_OPTIONS: Array<{ value: CaptionStylePreset; label: string }> = [
  { value: "impact", label: "Impact" },
  { value: "subtle", label: "Subtle" },
  { value: "pop", label: "Pop" },
  { value: "scroll", label: "Scroll" },
  { value: "vintage_typewriter", label: "Typewriter" },
  { value: "meme", label: "Meme" },
  { value: "neon_glow", label: "Glow" },
];

export const CAPTION_FONT_OPTIONS = [
  "Inter",
  "Geist",
  "SF Pro Display",
  "Manrope",
  "Space Grotesk",
  "Poppins",
  "Bebas Neue",
  "DM Sans",
  "Sora",
  "Outfit",
];

export const CAPTION_EFFECT_OPTIONS: Array<{ value: CaptionEffect; label: string }> = [
  { value: "clean_fade", label: "Clean Fade" },
  { value: "kinetic_pop", label: "Kinetic Pop" },
  { value: "underline_sweep", label: "Underline Sweep" },
  { value: "none", label: "None" },
];

export const AUDIO_OPTIONS: Array<{ value: AudioOption; label: string; description: string }> = [
  {
    value: "auto_sync_tracks",
    label: "Auto Sync Track",
    description: "AI aligns cuts to beat map and emotional shifts.",
  },
  {
    value: "voiceover_ai",
    label: "Voiceover Assist",
    description: "Auto-level voice and clean room-noise floor.",
  },
  {
    value: "sfx_library",
    label: "SFX Layer",
    description: "Subtle risers and impact one-shots.",
  },
  {
    value: "mute",
    label: "Mute Source",
    description: "Keep visual edit and replace audio externally.",
  },
];

export const SECTION_REVEAL_ORDER: EditorSectionKey[] = ["format", "vibe", "cuts", "captions", "audio"];

export const RECENT_DRAWER_CONFIG = {
  timeoutMs: 10_000,
  checkIntervalMs: 850,
} as const;

export const DEFAULT_QUICK_CONTROLS: Record<QuickControlKey, boolean> = {
  autoEdit: true,
  highlightReel: true,
  speedRamp: false,
  musicSync: true,
};

export const DEFAULT_PACING_VALUE = {
  horizontal: 56,
  vertical: 74,
} as const;
