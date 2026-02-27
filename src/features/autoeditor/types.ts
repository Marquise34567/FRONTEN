import type {
  AudioOption,
  AutoDetection,
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  RenderJobResult,
  RenderJobSummary,
  RenderEditInsight,
  RenderHookExplanation,
  RenderInsightsPayload,
  RenderTitleOption,
  RenderMode,
  RetentionPoint,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VerticalWebcamLayout,
  VideoInsightStat,
  VibeChip,
  ZoomEffect,
} from "@/features/vibecut/types";

export type {
  AudioOption,
  AutoDetection,
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  RenderJobResult,
  RenderJobSummary,
  RenderEditInsight,
  RenderHookExplanation,
  RenderInsightsPayload,
  RenderTitleOption,
  RenderMode,
  RetentionPoint,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VerticalWebcamLayout,
  VideoInsightStat,
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
  captionEffect: CaptionEffect;
  zoomEffect: ZoomEffect;
  audioOption: AudioOption;
  suggestedSubMode: SuggestedSubMode;
  verticalWebcamEnabled: boolean;
  verticalWebcamLayout: VerticalWebcamLayout;
  captionOutlineEnabled: boolean;
  captionDropShadowEnabled: boolean;
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
