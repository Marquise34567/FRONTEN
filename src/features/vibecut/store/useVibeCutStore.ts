import { create } from "zustand";
import type {
  AudioOption,
  AutoDetection,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  PacingPreset,
  QuickControlKey,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VibeChip,
  ZoomEffect,
} from "@/features/vibecut/types";

const buildSegmentId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `segment_${Math.random().toString(36).slice(2, 10)}`;
};

export type VibeCutStoreState = {
  isAnalyzingUpload: boolean;
  isRendering: boolean;
  renderJobId: string | null;
  renderProgress: number;
  errorMessage: string | null;

  videoId: string | null;
  videoUrl: string | null;
  fileName: string;
  duration: number;

  autoDetection: AutoDetection | null;
  mode: RenderMode | null;
  modeConfirmed: boolean;
  revealedSectionCount: number;

  quickControls: Record<QuickControlKey, boolean>;
  scrubberTime: number;
  manualSegments: Segment[];

  formatPreset: FormatPreset;
  vibeChip: VibeChip;
  stylePreset: StylePreset;
  pacing: PacingPreset;
  autoDetectBestMoments: boolean;

  captionMode: CaptionMode;
  captionStyle: CaptionStylePreset;
  captionFont: string;
  zoomEffect: ZoomEffect;
  audioOption: AudioOption;

  suggestedSubMode: SuggestedSubMode;

  recentJobs: RenderJobSummary[];
  recentJobsVisible: boolean;
  lastRecentJobsInteractionAt: number;

  retentionExpanded: boolean;
  retentionReady: boolean;
  successModalOpen: boolean;
  selectedThumbnailId: string | null;
  selectedRetentionPointId: string | null;
  latestResult: RenderJobResult | null;

  setUploadAnalyzing: (value: boolean) => void;
  setRenderState: (payload: { rendering: boolean; jobId?: string | null; progress?: number }) => void;
  setErrorMessage: (message: string | null) => void;
  setUploadAnalysis: (payload: UploadAnalysisResponse) => void;
  setMode: (mode: RenderMode, confirmed?: boolean) => void;
  setModeConfirmed: (value: boolean) => void;
  setRevealedSectionCount: (value: number) => void;
  toggleQuickControl: (key: QuickControlKey) => void;
  setScrubberTime: (value: number) => void;
  addSegmentAtScrubber: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, patch: Partial<Segment>) => void;

  setFormatPreset: (value: FormatPreset) => void;
  setVibeChip: (value: VibeChip) => void;
  setStylePreset: (value: StylePreset) => void;
  setPacing: (value: PacingPreset) => void;
  setAutoDetectBestMoments: (value: boolean) => void;
  setCaptionMode: (value: CaptionMode) => void;
  setCaptionStyle: (value: CaptionStylePreset) => void;
  setCaptionFont: (value: string) => void;
  setZoomEffect: (value: ZoomEffect) => void;
  setAudioOption: (value: AudioOption) => void;
  setSuggestedSubMode: (value: SuggestedSubMode) => void;

  setRecentJobs: (jobs: RenderJobSummary[]) => void;
  setRecentJobsVisible: (value: boolean) => void;
  markRecentJobsInteraction: () => void;

  setLatestResult: (result: RenderJobResult | null) => void;
  setSuccessModalOpen: (value: boolean) => void;
  setRetentionExpanded: (value: boolean) => void;
  setSelectedThumbnailId: (value: string | null) => void;
  setSelectedRetentionPointId: (value: string | null) => void;

  resetAll: () => void;
};

const defaultQuickControls: Record<QuickControlKey, boolean> = {
  autoEdit: true,
  highlightReel: true,
  speedRamp: false,
  musicSync: true,
};

const initialState = {
  isAnalyzingUpload: false,
  isRendering: false,
  renderJobId: null,
  renderProgress: 0,
  errorMessage: null,
  videoId: null,
  videoUrl: null,
  fileName: "",
  duration: 0,
  autoDetection: null,
  mode: null,
  modeConfirmed: false,
  revealedSectionCount: 0,
  quickControls: defaultQuickControls,
  scrubberTime: 0,
  manualSegments: [] as Segment[],
  formatPreset: "tiktok" as FormatPreset,
  vibeChip: "energetic" as VibeChip,
  stylePreset: "clean" as StylePreset,
  pacing: "balanced" as PacingPreset,
  autoDetectBestMoments: true,
  captionMode: "ai" as CaptionMode,
  captionStyle: "impact" as CaptionStylePreset,
  captionFont: "Bebas Neue",
  zoomEffect: "punch_zoom" as ZoomEffect,
  audioOption: "auto_sync_tracks" as AudioOption,
  suggestedSubMode: "highlight_mode" as SuggestedSubMode,
  recentJobs: [] as RenderJobSummary[],
  recentJobsVisible: false,
  lastRecentJobsInteractionAt: 0,
  retentionExpanded: false,
  retentionReady: false,
  successModalOpen: false,
  selectedThumbnailId: null,
  selectedRetentionPointId: null,
  latestResult: null as RenderJobResult | null,
};

export const useVibeCutStore = create<VibeCutStoreState>((set, get) => ({
  ...initialState,

  setUploadAnalyzing: (value) => set({ isAnalyzingUpload: value }),
  setRenderState: ({ rendering, jobId, progress }) =>
    set({
      isRendering: rendering,
      renderJobId: jobId !== undefined ? jobId : get().renderJobId,
      renderProgress: progress !== undefined ? progress : get().renderProgress,
    }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setUploadAnalysis: (payload) => {
    const recommendedMode = payload.autoDetection.finalMode;
    const defaultSubMode: SuggestedSubMode = recommendedMode === "vertical" ? "highlight_mode" : "standard_mode";
    set({
      videoId: payload.videoId,
      videoUrl: payload.videoUrl,
      fileName: payload.fileName,
      duration: payload.metadata.duration,
      autoDetection: payload.autoDetection,
      mode: recommendedMode,
      modeConfirmed: true,
      revealedSectionCount: 0,
      suggestedSubMode: defaultSubMode,
      formatPreset: recommendedMode === "vertical" ? "tiktok" : "youtube",
      quickControls: {
        ...defaultQuickControls,
        highlightReel: recommendedMode === "vertical",
      },
      manualSegments: [],
      scrubberTime: 0,
      retentionExpanded: false,
      retentionReady: false,
      successModalOpen: false,
      selectedThumbnailId: null,
      selectedRetentionPointId: null,
      latestResult: null,
      renderJobId: null,
      renderProgress: 0,
      errorMessage: null,
    });
  },
  setMode: (mode, confirmed = true) =>
    set((state) => ({
      mode,
      modeConfirmed: confirmed,
      suggestedSubMode: mode === "vertical" ? "highlight_mode" : "standard_mode",
      formatPreset:
        mode === "vertical"
          ? state.formatPreset === "youtube" ? "tiktok" : state.formatPreset
          : state.formatPreset === "tiktok" ? "youtube" : state.formatPreset,
    })),
  setModeConfirmed: (value) => set({ modeConfirmed: value }),
  setRevealedSectionCount: (value) => set({ revealedSectionCount: value }),
  toggleQuickControl: (key) =>
    set((state) => ({
      quickControls: {
        ...state.quickControls,
        [key]: !state.quickControls[key],
      },
    })),
  setScrubberTime: (value) =>
    set((state) => ({
      scrubberTime: Math.max(0, Math.min(state.duration || 0, Number(value) || 0)),
    })),
  addSegmentAtScrubber: () =>
    set((state) => {
      const start = Math.max(0, Math.min(state.scrubberTime, Math.max(0, state.duration - 1)));
      const end = Math.min(state.duration, start + 6);
      return {
        manualSegments: [...state.manualSegments, { id: buildSegmentId(), start, end }],
      };
    }),
  removeSegment: (id) =>
    set((state) => ({ manualSegments: state.manualSegments.filter((segment) => segment.id !== id) })),
  updateSegment: (id, patch) =>
    set((state) => ({
      manualSegments: state.manualSegments.map((segment) => {
        if (segment.id !== id) return segment;
        const start = patch.start ?? segment.start;
        const end = patch.end ?? segment.end;
        const minEnd = start + 0.3;
        return {
          ...segment,
          ...patch,
          start: Math.max(0, start),
          end: Math.max(minEnd, Math.min(end, state.duration || end)),
        };
      }),
    })),

  setFormatPreset: (value) => set({ formatPreset: value }),
  setVibeChip: (value) => set({ vibeChip: value }),
  setStylePreset: (value) => set({ stylePreset: value }),
  setPacing: (value) => set({ pacing: value }),
  setAutoDetectBestMoments: (value) => set({ autoDetectBestMoments: value }),
  setCaptionMode: (value) => set({ captionMode: value }),
  setCaptionStyle: (value) => set({ captionStyle: value }),
  setCaptionFont: (value) => set({ captionFont: value }),
  setZoomEffect: (value) => set({ zoomEffect: value }),
  setAudioOption: (value) => set({ audioOption: value }),
  setSuggestedSubMode: (value) => set({ suggestedSubMode: value }),

  setRecentJobs: (jobs) => set({ recentJobs: jobs.slice(0, 8) }),
  setRecentJobsVisible: (value) =>
    set({
      recentJobsVisible: value,
      lastRecentJobsInteractionAt: value ? Date.now() : get().lastRecentJobsInteractionAt,
    }),
  markRecentJobsInteraction: () => set({ lastRecentJobsInteractionAt: Date.now() }),

  setLatestResult: (result) =>
    set({
      latestResult: result,
      retentionReady: Boolean(result),
      selectedThumbnailId: result?.thumbnails?.[0]?.id || null,
      selectedRetentionPointId: result?.retention.points?.[0]?.id || null,
    }),
  setSuccessModalOpen: (value) => set({ successModalOpen: value }),
  setRetentionExpanded: (value) => set({ retentionExpanded: value }),
  setSelectedThumbnailId: (value) => set({ selectedThumbnailId: value }),
  setSelectedRetentionPointId: (value) => set({ selectedRetentionPointId: value }),

  resetAll: () => set({ ...initialState }),
}));
