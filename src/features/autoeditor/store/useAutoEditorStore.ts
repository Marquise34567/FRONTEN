import { create } from "zustand";

import {
  DEFAULT_PACING_VALUE,
  DEFAULT_QUICK_CONTROLS,
} from "@/features/autoeditor/data/options";
import type {
  AudioOption,
  AutoDetection,
  CaptionEffect,
  CaptionMode,
  CaptionStylePreset,
  EditorFlowStep,
  FormatPreset,
  QuickControlKey,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  Segment,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VerticalWebcamLayout,
  VibeChip,
} from "@/features/autoeditor/types";

const buildSegmentId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `segment_${Math.random().toString(36).slice(2, 10)}`;
};

type AutoEditorState = {
  flowStep: EditorFlowStep;
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
  autoModeEnabled: boolean;
  mode: RenderMode | null;
  modeConfirmed: boolean;
  revealedSectionCount: number;

  quickControls: Record<QuickControlKey, boolean>;

  manualTimestampModalOpen: boolean;
  scrubberTime: number;
  manualSegments: Segment[];

  formatPreset: FormatPreset;
  vibeChip: VibeChip;
  stylePreset: StylePreset;
  pacingValue: number;
  autoDetectBestMoments: boolean;

  captionsEnabled: boolean;
  captionMode: CaptionMode;
  captionStyle: CaptionStylePreset;
  captionFont: string;
  captionEffect: CaptionEffect;
  verticalWebcamEnabled: boolean;
  verticalWebcamLayout: VerticalWebcamLayout;
  captionOutlineEnabled: boolean;
  captionDropShadowEnabled: boolean;

  audioOption: AudioOption;
  audioDuckingEnabled: boolean;
  audioCleanupEnabled: boolean;
  audioMasteringEnabled: boolean;

  suggestedSubMode: SuggestedSubMode;

  recentJobs: RenderJobSummary[];
  recentDrawerOpen: boolean;
  lastRecentInteractionAt: number;

  retentionExpanded: boolean;
  successModalOpen: boolean;
  latestResult: RenderJobResult | null;
  selectedRetentionPointId: string | null;
  selectedThumbnailId: string | null;

  setUploadAnalyzing: (value: boolean) => void;
  transitionFlow: (next: EditorFlowStep) => void;
  setRenderState: (input: { rendering: boolean; jobId?: string | null; progress?: number }) => void;
  setErrorMessage: (message: string | null) => void;
  setUploadAnalysis: (payload: UploadAnalysisResponse) => void;

  setAutoModeEnabled: (value: boolean) => void;
  setMode: (mode: RenderMode, confirmed?: boolean) => void;
  setModeConfirmed: (value: boolean) => void;
  setRevealedSectionCount: (value: number) => void;

  toggleQuickControl: (key: QuickControlKey) => void;

  setManualTimestampModalOpen: (value: boolean) => void;
  setScrubberTime: (value: number) => void;
  addSegmentAtScrubber: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, patch: Partial<Segment>) => void;

  setFormatPreset: (value: FormatPreset) => void;
  setVibeChip: (value: VibeChip) => void;
  setStylePreset: (value: StylePreset) => void;
  setPacingValue: (value: number) => void;
  setAutoDetectBestMoments: (value: boolean) => void;

  setCaptionsEnabled: (value: boolean) => void;
  setCaptionMode: (value: CaptionMode) => void;
  setCaptionStyle: (value: CaptionStylePreset) => void;
  setCaptionFont: (value: string) => void;
  setCaptionEffect: (value: CaptionEffect) => void;
  setVerticalWebcamEnabled: (value: boolean) => void;
  setVerticalWebcamLayout: (value: VerticalWebcamLayout) => void;
  setCaptionOutlineEnabled: (value: boolean) => void;
  setCaptionDropShadowEnabled: (value: boolean) => void;

  setAudioOption: (value: AudioOption) => void;
  setAudioDuckingEnabled: (value: boolean) => void;
  setAudioCleanupEnabled: (value: boolean) => void;
  setAudioMasteringEnabled: (value: boolean) => void;

  setSuggestedSubMode: (value: SuggestedSubMode) => void;

  setRecentJobs: (jobs: RenderJobSummary[]) => void;
  setRecentDrawerOpen: (value: boolean) => void;
  markRecentInteraction: () => void;

  setRetentionExpanded: (value: boolean) => void;
  setSuccessModalOpen: (value: boolean) => void;
  setLatestResult: (value: RenderJobResult | null) => void;
  setSelectedRetentionPointId: (value: string | null) => void;
  setSelectedThumbnailId: (value: string | null) => void;

  resetSession: () => void;
};

const initialState = {
  flowStep: "upload" as EditorFlowStep,
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
  autoModeEnabled: true,
  mode: null,
  modeConfirmed: false,
  revealedSectionCount: 0,

  quickControls: { ...DEFAULT_QUICK_CONTROLS },

  manualTimestampModalOpen: false,
  scrubberTime: 0,
  manualSegments: [] as Segment[],

  formatPreset: "tiktok" as FormatPreset,
  vibeChip: "luxury" as VibeChip,
  stylePreset: "clean" as StylePreset,
  pacingValue: DEFAULT_PACING_VALUE.horizontal,
  autoDetectBestMoments: true,

  captionsEnabled: true,
  captionMode: "ai" as CaptionMode,
  captionStyle: "impact_clean" as CaptionStylePreset,
  captionFont: "Inter",
  captionEffect: "clean_fade" as CaptionEffect,
  verticalWebcamEnabled: true,
  verticalWebcamLayout: "top_banner" as VerticalWebcamLayout,
  captionOutlineEnabled: true,
  captionDropShadowEnabled: true,

  audioOption: "auto_sync_tracks" as AudioOption,
  audioDuckingEnabled: true,
  audioCleanupEnabled: true,
  audioMasteringEnabled: true,

  suggestedSubMode: "highlight_mode" as SuggestedSubMode,

  recentJobs: [] as RenderJobSummary[],
  recentDrawerOpen: false,
  lastRecentInteractionAt: 0,

  retentionExpanded: false,
  successModalOpen: false,
  latestResult: null as RenderJobResult | null,
  selectedRetentionPointId: null,
  selectedThumbnailId: null,
};

const normalizePacingValue = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const FLOW_TRANSITIONS: Record<EditorFlowStep, EditorFlowStep[]> = {
  upload: ["uploading"],
  uploading: ["upload", "mode_selection"],
  mode_selection: ["upload", "uploading", "settings"],
  settings: ["upload", "uploading", "mode_selection", "rendering", "post_render"],
  rendering: ["upload", "uploading", "settings", "post_render"],
  post_render: ["upload", "uploading", "settings"],
};

const canTransitionFlow = (from: EditorFlowStep, to: EditorFlowStep) => {
  if (from === to) return true;
  return FLOW_TRANSITIONS[from]?.includes(to) ?? false;
};

const resolveEditorFlow = (state: {
  videoId: string | null;
  modeConfirmed: boolean;
  isAnalyzingUpload: boolean;
  isRendering: boolean;
  latestResult: RenderJobResult | null;
}): EditorFlowStep => {
  if (state.isAnalyzingUpload) return "uploading";
  if (state.isRendering) return "rendering";
  if (!state.videoId) return "upload";
  if (state.latestResult?.status === "completed") return "post_render";
  if (state.modeConfirmed) return "settings";
  return "mode_selection";
};

export const useAutoEditorStore = create<AutoEditorState>((set, get) => ({
  ...initialState,

  transitionFlow: (next) =>
    set((state) => {
      if (!canTransitionFlow(state.flowStep, next)) return state;
      return { flowStep: next };
    }),
  setUploadAnalyzing: (value) =>
    set((state) => ({
      isAnalyzingUpload: value,
      flowStep: value ? "uploading" : resolveEditorFlow({ ...state, isAnalyzingUpload: false }),
    })),
  setRenderState: ({ rendering, jobId, progress }) =>
    set((state) => ({
      isRendering: rendering,
      renderJobId: jobId === undefined ? state.renderJobId : jobId,
      renderProgress: progress === undefined ? state.renderProgress : normalizePacingValue(progress),
      flowStep: resolveEditorFlow({ ...state, isRendering: rendering }),
    })),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setUploadAnalysis: (payload) => {
    const metadataDetectedMode: RenderMode =
      Number(payload.metadata?.width || 0) > Number(payload.metadata?.height || 0) ? "horizontal" : "vertical";
    const longFormLandscapeLock =
      Number(payload.metadata?.duration || 0) >= 180 &&
      Number(payload.metadata?.width || 0) > Number(payload.metadata?.height || 0) * 1.08;
    const detectedMode = longFormLandscapeLock
      ? "horizontal"
      : payload.autoDetection?.finalMode || metadataDetectedMode;
    const isVertical = detectedMode === "vertical";
    const profile = payload.autoDetection.editorProfile;
    const inferredPacing =
      profile?.pacingPreset === "aggressive"
        ? 80
        : profile?.pacingPreset === "chill"
          ? 34
          : profile?.pacingPreset === "cinematic"
            ? 38
            : undefined;
    const resolvedQuickControls = {
      ...DEFAULT_QUICK_CONTROLS,
      ...(profile?.quickControls || {}),
      highlightReel: typeof profile?.quickControls?.highlightReel === "boolean" ? profile.quickControls.highlightReel : isVertical,
    };

    set({
      videoId: payload.videoId,
      videoUrl: payload.videoUrl,
      fileName: payload.fileName,
      duration: payload.metadata.duration,
      autoDetection: payload.autoDetection,
      autoModeEnabled: true,
      mode: detectedMode,
      modeConfirmed: true,
      revealedSectionCount: 0,
      quickControls: resolvedQuickControls,
      manualTimestampModalOpen: false,
      scrubberTime: 0,
      manualSegments: [],
      formatPreset: profile?.formatPreset || (isVertical ? "tiktok" : "youtube"),
      vibeChip: profile?.vibeChip || (isVertical ? "energetic" : "cinematic"),
      stylePreset: profile?.stylePreset || (isVertical ? "bold" : "clean"),
      pacingValue: profile?.pacingValue ?? inferredPacing ?? (isVertical ? DEFAULT_PACING_VALUE.vertical : DEFAULT_PACING_VALUE.horizontal),
      autoDetectBestMoments:
        typeof profile?.autoDetectBestMoments === "boolean"
          ? profile.autoDetectBestMoments
          : isVertical,
      captionsEnabled: profile ? profile.captionMode !== "manual" : true,
      captionMode: profile?.captionMode || "ai",
      captionStyle: profile?.captionStyle || (isVertical ? "impact_clean" : "subtle"),
      captionFont: profile?.captionFont || "Inter",
      captionEffect: profile?.captionEffect || (isVertical ? "kinetic_pop" : "clean_fade"),
      verticalWebcamEnabled: isVertical,
      verticalWebcamLayout: "top_banner",
      captionOutlineEnabled: true,
      captionDropShadowEnabled: isVertical,
      audioOption: profile?.audioOption || "auto_sync_tracks",
      suggestedSubMode: longFormLandscapeLock
        ? "standard_mode"
        : profile?.suggestedSubMode || payload.autoDetection.suggestedSubMode || (isVertical ? "highlight_mode" : "standard_mode"),
      retentionExpanded: false,
      successModalOpen: false,
      latestResult: null,
      selectedRetentionPointId: null,
      selectedThumbnailId: null,
      renderJobId: null,
      renderProgress: 0,
      errorMessage: null,
      isRendering: false,
      isAnalyzingUpload: false,
      flowStep: "settings",
    });
  },

  setAutoModeEnabled: (value) =>
    set((state) => ({
      autoModeEnabled: value,
      mode: value ? state.autoDetection?.finalMode || state.mode : state.mode,
    })),
  setMode: (mode, confirmed = false) =>
    set((state) => {
      const nextModeConfirmed = confirmed ? true : state.modeConfirmed;
      return {
        mode,
        modeConfirmed: nextModeConfirmed,
        formatPreset:
          mode === "vertical"
            ? state.formatPreset === "youtube" ? "tiktok" : state.formatPreset
            : state.formatPreset === "tiktok" ? "youtube" : state.formatPreset,
        flowStep: nextModeConfirmed ? "settings" : "mode_selection",
      };
    }),
  setModeConfirmed: (value) =>
    set((state) => ({
      modeConfirmed: value,
      flowStep: value ? "settings" : resolveEditorFlow({ ...state, modeConfirmed: false }),
    })),
  setRevealedSectionCount: (value) => set({ revealedSectionCount: Math.max(0, Math.min(5, value)) }),

  toggleQuickControl: (key) =>
    set((state) => ({
      quickControls: {
        ...state.quickControls,
        [key]: !state.quickControls[key],
      },
    })),

  setManualTimestampModalOpen: (value) => set({ manualTimestampModalOpen: value }),
  setScrubberTime: (value) =>
    set((state) => ({
      scrubberTime: Math.max(0, Math.min(state.duration || 0, Number(value) || 0)),
    })),
  addSegmentAtScrubber: () =>
    set((state) => {
      const duration = Math.max(0, state.duration || 0);
      const start = Math.max(0, Math.min(duration, state.scrubberTime));
      const end = Math.max(start + 0.4, Math.min(duration, start + 7));
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
        const safeStart = Math.max(0, start);
        const safeEnd = Math.max(safeStart + 0.4, Math.min(state.duration || end, end));
        return {
          ...segment,
          ...patch,
          start: safeStart,
          end: safeEnd,
        };
      }),
    })),

  setFormatPreset: (value) => set({ formatPreset: value }),
  setVibeChip: (value) => set({ vibeChip: value }),
  setStylePreset: (value) => set({ stylePreset: value }),
  setPacingValue: (value) => set({ pacingValue: normalizePacingValue(value) }),
  setAutoDetectBestMoments: (value) => set({ autoDetectBestMoments: value }),

  setCaptionsEnabled: (value) => set({ captionsEnabled: value }),
  setCaptionMode: (value) => set({ captionMode: value }),
  setCaptionStyle: (value) => set({ captionStyle: value }),
  setCaptionFont: (value) => set({ captionFont: value }),
  setCaptionEffect: (value) => set({ captionEffect: value }),
  setVerticalWebcamEnabled: (value) => set({ verticalWebcamEnabled: value }),
  setVerticalWebcamLayout: (value) => set({ verticalWebcamLayout: value }),
  setCaptionOutlineEnabled: (value) => set({ captionOutlineEnabled: value }),
  setCaptionDropShadowEnabled: (value) => set({ captionDropShadowEnabled: value }),

  setAudioOption: (value) => set({ audioOption: value }),
  setAudioDuckingEnabled: (value) => set({ audioDuckingEnabled: value }),
  setAudioCleanupEnabled: (value) => set({ audioCleanupEnabled: value }),
  setAudioMasteringEnabled: (value) => set({ audioMasteringEnabled: value }),

  setSuggestedSubMode: (value) => set({ suggestedSubMode: value }),

  setRecentJobs: (jobs) => set({ recentJobs: jobs.slice(0, 10) }),
  setRecentDrawerOpen: (value) =>
    set((state) => ({
      recentDrawerOpen: value,
      lastRecentInteractionAt: value ? Date.now() : state.lastRecentInteractionAt,
    })),
  markRecentInteraction: () => set({ lastRecentInteractionAt: Date.now() }),

  setRetentionExpanded: (value) => set({ retentionExpanded: value }),
  setSuccessModalOpen: (value) => set({ successModalOpen: value }),
  setLatestResult: (value) =>
    set((state) => ({
      latestResult: value,
      selectedRetentionPointId: value?.retention.points?.[0]?.id || null,
      selectedThumbnailId: value?.thumbnails?.[0]?.id || null,
      flowStep: resolveEditorFlow({ ...state, latestResult: value }),
    })),
  setSelectedRetentionPointId: (value) => set({ selectedRetentionPointId: value }),
  setSelectedThumbnailId: (value) => set({ selectedThumbnailId: value }),

  resetSession: () => {
    set({
      ...initialState,
      autoModeEnabled: get().autoModeEnabled,
    });
  },
}));
