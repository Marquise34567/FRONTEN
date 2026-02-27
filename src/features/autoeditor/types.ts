import type {
  AudioOption,
  AutoDetection,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  RetentionPoint,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VibeChip,
  ZoomEffect,
} from "@/features/vibecut/types";

export type {
  AudioOption,
  AutoDetection,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  RetentionPoint,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VibeChip,
  ZoomEffect,
};

export type QuickControlKey = "autoEdit" | "highlightReel" | "speedRamp" | "musicSync";

export type EditorSectionKey = "format" | "vibe" | "cuts" | "captions" | "audio";

export type EditorFlowStep =
  | "upload"
  | "uploading"
  | "mode_selection"
  | "settings"
  | "rendering"
  | "post_render";

export type CaptionEffect = "clean_fade" | "kinetic_pop" | "underline_sweep" | "none";

export type PacingBand = "slow" | "balanced" | "fast";

export type AutoEditorRenderPayload = {
  videoId: string;
  mode: RenderMode;
  quickControls: Record<QuickControlKey, boolean>;
  manualSegments: Segment[];
  formatPreset: FormatPreset;
  vibeChip: VibeChip;
  stylePreset: StylePreset;
  pacing: string;
  autoDetectBestMoments: boolean;
  captionMode: CaptionMode;
  captionStyle: CaptionStylePreset;
  captionFont: string;
  zoomEffect: ZoomEffect;
  audioOption: AudioOption;
  suggestedSubMode: SuggestedSubMode;
};

export type InsightTooltip = {
  title: string;
  description: string;
  timestamp: number;
};

export type RecentDrawerInactivityConfig = {
  timeoutMs: number;
  checkIntervalMs: number;
};
