import {
  BrainCircuit,
  Bot,
  Clapperboard,
  Flame,
  Film,
  Gauge,
  Instagram,
  MessageSquareText,
  Music2,
  PlayCircle,
  Rabbit,
  Scissors,
  Sparkles,
  Timer,
  TrendingUp,
  Volume2,
  Wand2,
  Waves,
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
    title: "AI Story Cut Engine",
    description: "Auto mode: 5s smart cuts + 5-8s opening hook.",
    icon: BrainCircuit,
  },
  {
    key: "highlightReel",
    title: "Hook Finder + Highlights",
    description: "Pulls best moments and trims weak sections.",
    icon: Flame,
  },
  {
    key: "speedRamp",
    title: "Beat-Aware Speed Ramps",
    description: "Adds tempo shifts around impact beats.",
    icon: Timer,
  },
  {
    key: "musicSync",
    title: "Rhythm Cut Alignment",
    description: "Aligns cut points with music rhythm and energy.",
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
  { value: "tiktok", label: "TikTok (9:16 Viral)", icon: Flame },
  { value: "instagram_reels", label: "Instagram Reels (9:16)", icon: Instagram },
  { value: "youtube_shorts", label: "YouTube Shorts (9:16)", icon: Youtube },
  { value: "youtube", label: "YouTube Long-form (16:9)", icon: Clapperboard },
  { value: "custom", label: "Custom Delivery", icon: Bot },
];

export const VIBE_CHIPS: Array<{ value: VibeChip; label: string; icon: LucideIcon }> = [
  { value: "energetic", label: "Energetic Momentum", icon: Zap },
  { value: "chill", label: "Calm Conversational", icon: Waves },
  { value: "luxury", label: "Premium Polished", icon: Sparkles },
  { value: "cinematic", label: "Cinematic Story", icon: Film },
  { value: "aesthetic", label: "Aesthetic Clean", icon: Wand2 },
  { value: "motivational", label: "Motivational Drive", icon: TrendingUp },
  { value: "funny", label: "Comedy Reaction", icon: PlayCircle },
  { value: "dark", label: "Dark Intense", icon: Gauge },
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
  { value: "impact", label: "Impact Headlines" },
  { value: "impact_clean", label: "Impact Clean (No Lightning)" },
  { value: "subtle", label: "Subtle Narrative" },
  { value: "pop", label: "Kinetic Pop Captions" },
  { value: "scroll", label: "Story Scroll Captions" },
  { value: "vintage_typewriter", label: "Vintage Typewriter" },
  { value: "meme", label: "Meme Punchlines" },
  { value: "neon_glow", label: "Neon Glow Emphasis" },
  { value: "tiktok_bold", label: "TikTok Bold Blocks" },
  { value: "tiktok_minimal", label: "TikTok Minimal Clean" },
  { value: "reels_modern", label: "Reels Modern" },
  { value: "shorts_highlight", label: "Shorts Highlighter" },
  { value: "punch_outline", label: "Punch Outline" },
  { value: "soft_shadow", label: "Soft Shadow" },
  { value: "retro_arcade", label: "Retro Arcade" },
  { value: "cinematic_serif", label: "Cinematic Serif" },
  { value: "clean_box", label: "Clean Caption Box" },
  { value: "lower_third", label: "Lower Third" },
  { value: "headline_bar", label: "Headline Bar" },
  { value: "karaoke_glow", label: "Karaoke Glow" },
  { value: "comic_burst", label: "Comic Burst" },
  { value: "documentary_plain", label: "Documentary Plain" },
  { value: "luxury_gold", label: "Luxury Gold" },
  { value: "mono_caps", label: "Monospace Caps" },
  { value: "gradient_pop", label: "Gradient Pop" },
  { value: "type_subtle", label: "Type Subtle" },
  { value: "high_contrast", label: "High Contrast" },
  { value: "bubble_outline", label: "Bubble Outline" },
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
  "Anton",
  "Montserrat",
  "Oswald",
  "Archivo Black",
  "Barlow Condensed",
  "Rubik",
  "Raleway",
  "Nunito Sans",
  "Figtree",
  "Urbanist",
  "Plus Jakarta Sans",
  "IBM Plex Sans",
  "Work Sans",
  "Exo 2",
  "Teko",
  "Bangers",
  "Impact",
  "Franklin Gothic Medium",
  "Trebuchet MS",
  "Avenir Next",
];

export const CAPTION_EFFECT_OPTIONS: Array<{ value: CaptionEffect; label: string }> = [
  { value: "clean_fade", label: "Clean Fade In/Out" },
  { value: "kinetic_pop", label: "Kinetic Pop Burst" },
  { value: "underline_sweep", label: "Underline Sweep Accent" },
  { value: "drop_shadow_bold", label: "Bold Drop Shadow" },
  { value: "drop_shadow_soft", label: "Soft Drop Shadow" },
  { value: "thick_outline", label: "Thick Outline" },
  { value: "thin_outline", label: "Thin Outline" },
  { value: "outline_shadow_combo", label: "Outline + Shadow Combo" },
  { value: "typewriter_reveal", label: "Typewriter Reveal" },
  { value: "bounce_in", label: "Bounce In" },
  { value: "none", label: "No Animation" },
];

export const AUDIO_OPTIONS: Array<{ value: AudioOption; label: string; description: string; icon: LucideIcon }> = [
  {
    value: "auto_sync_tracks",
    label: "Beat-Synced Music Bed",
    description: "AI aligns cuts to beat map and emotional shifts.",
    icon: Music2,
  },
  {
    value: "voiceover_ai",
    label: "Voiceover Clarity Assist",
    description: "Auto-level voice and clean room-noise floor.",
    icon: MessageSquareText,
  },
  {
    value: "sfx_library",
    label: "Cinematic SFX Layer",
    description: "Subtle risers and impact one-shots.",
    icon: Volume2,
  },
  {
    value: "mute",
    label: "Mute Source Audio",
    description: "Keep visual edit and replace audio externally.",
    icon: Scissors,
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
