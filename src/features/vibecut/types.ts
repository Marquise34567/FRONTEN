export type RenderMode = "horizontal" | "vertical";

export type QuickControlKey = "autoEdit" | "highlightReel" | "speedRamp" | "musicSync";

export type FormatPreset = "youtube" | "tiktok" | "instagram_reels" | "youtube_shorts" | "custom";

export type VibeChip =
  | "energetic"
  | "chill"
  | "luxury"
  | "funny"
  | "motivational"
  | "aesthetic"
  | "dark"
  | "cinematic";

export type StylePreset = "clean" | "bold" | "vintage" | "glitch" | "neon" | "minimal" | "meme";

export type PacingPreset = "aggressive" | "balanced" | "chill" | "cinematic";

export type CaptionMode = "ai" | "manual";

export type CaptionStylePreset =
  | "impact"
  | "impact_clean"
  | "subtle"
  | "pop"
  | "meme"
  | "scroll"
  | "neon_glow"
  | "vintage_typewriter"
  | "tiktok_bold"
  | "tiktok_minimal"
  | "reels_modern"
  | "shorts_highlight"
  | "punch_outline"
  | "soft_shadow"
  | "retro_arcade"
  | "cinematic_serif"
  | "clean_box"
  | "lower_third"
  | "headline_bar"
  | "karaoke_glow"
  | "comic_burst"
  | "documentary_plain"
  | "luxury_gold"
  | "mono_caps"
  | "gradient_pop"
  | "type_subtle"
  | "high_contrast"
  | "bubble_outline";

export type CaptionEffect =
  | "clean_fade"
  | "kinetic_pop"
  | "underline_sweep"
  | "drop_shadow_bold"
  | "drop_shadow_soft"
  | "thick_outline"
  | "thin_outline"
  | "outline_shadow_combo"
  | "typewriter_reveal"
  | "bounce_in"
  | "none";

export type VerticalWebcamLayout = "top_banner" | "top_right_pip" | "bottom_right_pip";

export type ZoomEffect = "punch_zoom" | "slow_push_in" | "ken_burns" | "beat_zoom";

export type AudioOption = "auto_sync_tracks" | "mute" | "voiceover_ai" | "sfx_library";

export type SuggestedSubMode = "highlight_mode" | "story_mode" | "standard_mode";

export type Segment = {
  id: string;
  start: number;
  end: number;
};

export type VideoMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  duration: number;
  fps: number;
};

export type FrameScanSummary = {
  sampledFrames: number;
  sampleStride: number;
  portraitSignal: number;
  landscapeSignal: number;
  centeredFaceVerticalSignal: number;
  horizontalMotionSignal: number;
  highMotionShortClipSignal: number;
};

export type AutoDetection = {
  metadataMode: RenderMode;
  frameScanMode: RenderMode;
  finalMode: RenderMode;
  ambiguous: boolean;
  confidence: number;
  reason: string;
  suggestedSubMode: SuggestedSubMode;
  suggestedSubModes: SuggestedSubMode[];
  bannerMessage: string;
  frameScan: FrameScanSummary;
  editorProfile?: AutoDetectedEditorProfile;
  coolStats?: VideoInsightStat[];
};

export type AutoDetectedEditorProfile = {
  formatPreset: FormatPreset;
  vibeChip: VibeChip;
  stylePreset: StylePreset;
  pacingPreset: PacingPreset;
  pacingValue: number;
  autoDetectBestMoments: boolean;
  captionMode: CaptionMode;
  captionStyle: CaptionStylePreset;
  captionFont: string;
  captionEffect: CaptionEffect;
  audioOption: AudioOption;
  quickControls: Record<QuickControlKey, boolean>;
  suggestedSubMode: SuggestedSubMode;
  confidence: number;
  rationale: string[];
};

export type UploadAnalysisResponse = {
  videoId: string;
  videoUrl: string;
  fileName: string;
  metadata: VideoMetadata;
  autoDetection: AutoDetection;
};

export type RetentionPointType = "best" | "worst" | "skip_zone" | "hook" | "emotional_peak";

export type RetentionPoint = {
  id: string;
  timestamp: number;
  watchedPct: number;
  type: RetentionPointType;
  label: string;
  description: string;
};

export type RetentionHeatCell = {
  timestamp: number;
  intensity: number;
};

export type ThumbnailOption = {
  id: string;
  url: string;
  label: string;
};

export type VideoInsightStat = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "watch" | "neutral";
};

export type RenderEditInsight = {
  id: string;
  kind: "good" | "bad" | "choice";
  headline: string;
  detail: string;
  timestamp: number;
  predictedRetention: number;
};

export type RenderHookExplanation = {
  winnerLabel: string;
  winnerScore: number;
  runnerUpLabel: string;
  runnerUpScore: number;
  reason: string;
  transcriptSignal: string;
};

export type RenderTitleOption = {
  id: string;
  title: string;
  explanation: string;
  confidence: number;
};

export type RenderInsightsPayload = {
  predictedAverageRetention: number;
  predictionConfidence?: number;
  targetAverageRetention: number;
  iterationCount: number;
  metadataStats: VideoInsightStat[];
  editInsights: RenderEditInsight[];
  hookExplanation: RenderHookExplanation;
  titleOptions: RenderTitleOption[];
  ruthlessAudit?: {
    selectedOpener: {
      start: number;
      end: number;
      reason: string;
    } | null;
    hookComparison: Array<{
      start: number;
      end: number;
      predictedRetentionLift: number;
      reason: string;
    }>;
    cutsAndSpeed: Array<{
      start: number;
      end: number;
      action: "trim" | "speed_up" | "transition_boost";
      intensity: number;
      speedMultiplier?: number;
      reason: string;
    }>;
    weakSegments: Array<{
      start: number;
      end: number;
      predictedRetention: number;
      reason: string;
      fix?: string;
    }>;
    strongSegments: Array<{
      start: number;
      end: number;
      predictedRetention: number;
      reason: string;
    }>;
    prediction: {
      score: number;
      confidence: number;
    };
  };
};

export type RenderJobStatus = "queued" | "processing" | "completed" | "failed";

export type RenderJobSummary = {
  id: string;
  status: RenderJobStatus;
  mode: RenderMode;
  createdAt: string;
  progress: number;
  fileName: string;
};

export type RenderJobResult = {
  jobId: string;
  status: RenderJobStatus;
  progress: number;
  mode: RenderMode;
  outputVideoUrl: string;
  clipUrls: string[];
  ffmpegCommands: string[];
  thumbnails: ThumbnailOption[];
  retention: {
    points: RetentionPoint[];
    heatmap: RetentionHeatCell[];
    summary: string;
    insights?: RenderInsightsPayload;
  };
};

export type RenderRequestPayload = {
  videoId: string;
  mode: RenderMode;
  quickControls: Record<QuickControlKey, boolean>;
  manualSegments: Segment[];
  formatPreset: FormatPreset;
  vibeChip: VibeChip;
  stylePreset: StylePreset;
  pacing: PacingPreset;
  autoDetectBestMoments: boolean;
  captionMode: CaptionMode;
  captionStyle: CaptionStylePreset;
  captionFont: string;
  captionEffect: CaptionEffect;
  zoomEffect: ZoomEffect;
  audioOption: AudioOption;
  suggestedSubMode: SuggestedSubMode;
  verticalWebcamEnabled?: boolean;
  verticalWebcamLayout?: VerticalWebcamLayout;
  captionOutlineEnabled?: boolean;
  captionDropShadowEnabled?: boolean;
};
