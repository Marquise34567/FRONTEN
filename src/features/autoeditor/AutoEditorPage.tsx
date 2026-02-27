import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, RefreshCcw, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/providers/AuthProvider";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  RECENT_DRAWER_CONFIG,
  SECTION_REVEAL_ORDER,
} from "@/features/autoeditor/data/options";
import AutoModeBanner from "@/features/autoeditor/components/editor/AutoModeBanner";
import InitialSettingsPanel from "@/features/autoeditor/components/editor/InitialSettingsPanel";
import ManualTimestampModal from "@/features/autoeditor/components/editor/ManualTimestampModal";
import ModeSelector from "@/features/autoeditor/components/editor/ModeSelector";
import ModernizedOriginalEditor from "@/features/autoeditor/components/editor/ModernizedOriginalEditor";
import PostRenderModal from "@/features/autoeditor/components/editor/PostRenderModal";
import RecentJobsDrawer from "@/features/autoeditor/components/editor/RecentJobsDrawer";
import RetentionInsights from "@/features/autoeditor/components/editor/RetentionInsights";
import StaggeredSettingsSections from "@/features/autoeditor/components/editor/StaggeredSettingsSections";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import { useAutoEditorStore } from "@/features/autoeditor/store/useAutoEditorStore";
import type {
  AutoEditorRenderPayload,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  UploadAnalysisResponse,
  ZoomEffect,
} from "@/features/autoeditor/types";
import "@/features/autoeditor/autoeditor.css";

const uploadAnalyze = async ({ file, token }: { file: File; token: string | null }): Promise<UploadAnalysisResponse> => {
  const formData = new FormData();
  formData.append("video", file);

  const response = await fetch(`${API_URL || ""}/api/vibecut/upload/analyze`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.message || "Upload analysis failed", response.status, data?.error, data);
  }
  return data as UploadAnalysisResponse;
};

const fetchRecentJobsApi = async (token: string): Promise<RenderJobSummary[]> => {
  try {
    const withJobsPath = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut/jobs", { token });
    if (Array.isArray(withJobsPath.jobs)) return withJobsPath.jobs;
  } catch {
    // fallback below
  }

  const fallback = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut", { token });
  return Array.isArray(fallback.jobs) ? fallback.jobs : [];
};

const fetchJobByIdApi = async (token: string, jobId: string): Promise<RenderJobResult> => {
  try {
    return await apiFetch<RenderJobResult>(`/api/vibecut/jobs/${jobId}`, { token });
  } catch {
    return await apiFetch<RenderJobResult>(`/api/vibecut/${jobId}`, { token });
  }
};

const mapPacingPreset = (value: number) => {
  if (value >= 72) return "aggressive";
  if (value <= 30) return "chill";
  if (value <= 45) return "cinematic";
  return "balanced";
};

const getZoomEffect = (speedRampEnabled: boolean, mode: RenderMode): ZoomEffect => {
  if (speedRampEnabled) return "beat_zoom";
  return mode === "vertical" ? "punch_zoom" : "slow_push_in";
};

export default function AutoEditorPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");

  const {
    flowStep,
    isAnalyzingUpload,
    isRendering,
    renderJobId,
    renderProgress,
    errorMessage,

    videoId,
    videoUrl,
    fileName,
    duration,

    autoDetection,
    autoModeEnabled,
    mode,
    revealedSectionCount,

    quickControls,

    manualTimestampModalOpen,
    scrubberTime,
    manualSegments,

    formatPreset,
    vibeChip,
    stylePreset,
    pacingValue,
    autoDetectBestMoments,

    captionsEnabled,
    captionMode,
    captionStyle,
    captionFont,
    captionEffect,

    audioOption,
    audioDuckingEnabled,
    audioCleanupEnabled,
    audioMasteringEnabled,

    suggestedSubMode,
    recentJobs,
    recentDrawerOpen,
    lastRecentInteractionAt,

    retentionExpanded,
    successModalOpen,
    latestResult,
    selectedRetentionPointId,
    selectedThumbnailId,

    setUploadAnalyzing,
    setRenderState,
    setErrorMessage,
    setUploadAnalysis,

    setAutoModeEnabled,
    setMode,
    setRevealedSectionCount,

    toggleQuickControl,

    setManualTimestampModalOpen,
    setScrubberTime,
    addSegmentAtScrubber,
    removeSegment,
    updateSegment,

    setFormatPreset,
    setVibeChip,
    setStylePreset,
    setPacingValue,
    setAutoDetectBestMoments,

    setCaptionsEnabled,
    setCaptionMode,
    setCaptionStyle,
    setCaptionFont,
    setCaptionEffect,

    setAudioOption,
    setAudioDuckingEnabled,
    setAudioCleanupEnabled,
    setAudioMasteringEnabled,

    setSuggestedSubMode,

    setRecentJobs,
    setRecentDrawerOpen,
    markRecentInteraction,

    setRetentionExpanded,
    setSuccessModalOpen,
    setLatestResult,
    setSelectedRetentionPointId,
    setSelectedThumbnailId,

    resetSession,
  } = useAutoEditorStore();

  const renderPayload = useMemo<AutoEditorRenderPayload | null>(() => {
    if (!videoId || !mode) return null;

    return {
      videoId,
      mode,
      quickControls,
      manualSegments,
      formatPreset,
      vibeChip,
      stylePreset,
      pacing: mapPacingPreset(pacingValue),
      autoDetectBestMoments,
      captionMode: captionsEnabled ? captionMode : "manual",
      captionStyle,
      captionFont,
      zoomEffect: getZoomEffect(quickControls.speedRamp, mode),
      audioOption,
      suggestedSubMode,
    };
  }, [
    autoDetectBestMoments,
    audioOption,
    captionFont,
    captionMode,
    captionStyle,
    captionsEnabled,
    formatPreset,
    manualSegments,
    mode,
    pacingValue,
    quickControls,
    stylePreset,
    vibeChip,
    videoId,
    suggestedSubMode,
  ]);

  const selectedMode = mode || "horizontal";

  const fetchRecentJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const jobs = await fetchRecentJobsApi(accessToken);
      setRecentJobs(jobs);
    } catch (error) {
      console.warn("recent jobs fetch failed", error);
    }
  }, [accessToken, setRecentJobs]);

  useEffect(() => {
    void fetchRecentJobs();
  }, [fetchRecentJobs]);

  useEffect(() => {
    if (flowStep !== "settings" && flowStep !== "rendering" && flowStep !== "post_render") {
      setRevealedSectionCount(0);
      return;
    }

    const timers: number[] = [];
    SECTION_REVEAL_ORDER.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setRevealedSectionCount(index + 1);
      }, 120 + index * 140);
      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [flowStep, mode, setRevealedSectionCount]);

  useEffect(() => {
    if (!recentDrawerOpen) return;

    const onInteraction = () => {
      markRecentInteraction();
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "touchstart", "scroll", "keydown"];
    events.forEach((name) => window.addEventListener(name, onInteraction, { passive: true }));

    const interval = window.setInterval(() => {
      if (Date.now() - lastRecentInteractionAt > RECENT_DRAWER_CONFIG.timeoutMs) {
        setRecentDrawerOpen(false);
      }
    }, RECENT_DRAWER_CONFIG.checkIntervalMs);

    return () => {
      events.forEach((name) => window.removeEventListener(name, onInteraction));
      window.clearInterval(interval);
    };
  }, [recentDrawerOpen, lastRecentInteractionAt, markRecentInteraction, setRecentDrawerOpen]);

  useEffect(() => {
    if (!accessToken || !renderJobId || !isRendering) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const job = await fetchJobByIdApi(accessToken, renderJobId);
        if (cancelled) return;

        const progress = Number.isFinite(Number(job.progress)) ? Number(job.progress) : 0;
        const stillRunning = job.status === "queued" || job.status === "processing";

        setRenderState({
          rendering: stillRunning,
          jobId: job.jobId,
          progress,
        });

        if (job.status === "completed") {
          setRenderState({ rendering: false, jobId: job.jobId, progress: 100 });
          setLatestResult(job);
          setRetentionExpanded(false);
          setSuccessModalOpen(true);
          toast({
            title: "Render complete",
            description:
              selectedMode === "vertical"
                ? "Vertical highlight pipeline finished with retention insights."
                : "Horizontal pipeline finished with retention insights.",
          });
          void fetchRecentJobs();
        }

        if (job.status === "failed") {
          setRenderState({ rendering: false, jobId: null, progress: 0 });
          setErrorMessage(job.errorMessage || "Render failed. Please retry with adjusted settings.");
          toast({
            title: "Render failed",
            description: job.errorMessage || "AutoEditor could not complete this job.",
            variant: "destructive",
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("render job poll failed", error);
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 1800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    accessToken,
    fetchRecentJobs,
    isRendering,
    renderJobId,
    selectedMode,
    setErrorMessage,
    setLatestResult,
    setRenderState,
    setRetentionExpanded,
    setSuccessModalOpen,
    toast,
  ]);

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setUploadingFileName(file.name || "video");
    setUploadAnalyzing(true);
    setErrorMessage(null);
    setSuccessModalOpen(false);
    setRetentionExpanded(false);
    setLatestResult(null);
    setRecentDrawerOpen(false);

    try {
      const payload = await uploadAnalyze({ file, token: accessToken });
      setUploadAnalysis(payload);
      setSuggestedSubMode(
        payload.autoDetection.editorProfile?.suggestedSubMode ||
          payload.autoDetection.suggestedSubMode ||
          (payload.autoDetection.finalMode === "vertical" ? "highlight_mode" : "standard_mode"),
      );
      toast({ title: "Auto-detection ready", description: payload.autoDetection.bannerMessage });
      void fetchRecentJobs();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Upload analysis failed.";
      setErrorMessage(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploadAnalyzing(false);
      setFileInputKey((value) => value + 1);
    }
  };

  const handleStartRender = async () => {
    if (!renderPayload || !accessToken) {
      setErrorMessage("Upload a video and confirm mode first.");
      return;
    }

    setRenderState({ rendering: true, progress: 8, jobId: null });
    setErrorMessage(null);
    setRetentionExpanded(false);
    setSuccessModalOpen(false);
    setLatestResult(null);

    try {
      const response = await apiFetch<{ jobId: string; status: string; progress: number }>("/api/vibecut/render", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(renderPayload),
      });
      setRenderState({ rendering: true, progress: response.progress || 10, jobId: response.jobId });
      toast({ title: "Render started", description: "AutoEditor is processing your timeline now." });
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Could not start render.";
      setRenderState({ rendering: false, progress: 0, jobId: null });
      setErrorMessage(message);
      toast({ title: "Render error", description: message, variant: "destructive" });
    }
  };

  const handleRerenderFromModal = () => {
    setSuccessModalOpen(false);
    void handleStartRender();
  };

  const handleOpenInsightsFromModal = () => {
    setSuccessModalOpen(false);
    setRetentionExpanded(true);
    window.setTimeout(() => {
      document.getElementById("retention-insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const handleOpenFeedbackFromModal = () => {
    if (!latestResult?.jobId) return;
    setSuccessModalOpen(false);
    navigate(`/analytics?jobId=${encodeURIComponent(latestResult.jobId)}&source=vibecut`);
  };

  const handleModeSelect = (nextMode: RenderMode) => {
    setMode(nextMode, true);
  };

  const handleAutoModeToggle = (value: boolean) => {
    setAutoModeEnabled(value);
    if (value && autoDetection?.finalMode) {
      setMode(autoDetection.finalMode, false);
      setSuggestedSubMode(autoDetection.editorProfile?.suggestedSubMode || autoDetection.suggestedSubMode);
    }
  };

  const resetEverything = () => {
    setRecentDrawerOpen(false);
    resetSession();
    setFileInputKey((value) => value + 1);
  };

  const hasCompletedResult = Boolean(latestResult && latestResult.status === "completed" && !isRendering);
  const showModeSelector = flowStep === "mode_selection";
  const showExpandedSettings = flowStep === "settings" || flowStep === "rendering" || flowStep === "post_render";

  return (
    <div className="autoeditor-root min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_65%_at_8%_0%,rgba(212,180,131,0.16),transparent_68%),radial-gradient(62%_48%_at_98%_-2%,rgba(142,168,201,0.18),transparent_74%),radial-gradient(90%_70%_at_50%_110%,rgba(9,10,13,0.72),transparent_80%)]" />

      <main className="relative mx-auto w-full max-w-[1380px] px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ae-kicker">AutoEditor Studio</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#fbf2e6] sm:text-4xl">Modern Creator Editor</h1>
            <p className="mt-1 text-sm text-[#beb2b5]">Premium workflow for narrative clarity, retention, and polished export output.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="ae-chip ae-chip-accent">AI Assist</span>
              <span className="ae-chip">Adaptive Cuts</span>
              <span className="ae-chip">Retention Insights</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {recentJobs.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRecentDrawerOpen(true)}
                className="rounded-xl border-white/20 bg-white/[0.08] text-[#f7efe3] transition-all hover:-translate-y-0.5 hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
              >
                <History className="h-4 w-4" />
                Recent Jobs
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={resetEverything}
              className="rounded-xl text-[#d5cbce] hover:bg-white/[0.1]"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </header>

        <CleanCard className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ae-kicker">Upload</p>
              <p className="mt-1 text-sm text-[#d6cbce]">Drop source footage to start analysis and auto-profile generation.</p>
            </div>
            <Input
              key={fileInputKey}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska"
              onChange={handleUploadChange}
              className="max-w-[380px] border-white/20 bg-black/35 text-[#f2eadf] file:mr-3 file:rounded-lg file:border-0 file:bg-[#d4b483] file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-[#221a15]"
            />
          </div>

          <AnimatePresence mode="wait">
            {isAnalyzingUpload ? (
              <motion.div
                key="upload-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 space-y-3"
              >
                <div className="rounded-xl border border-[#d4b483]/35 bg-[#d4b483]/12 px-3 py-2">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-[#fff4e7]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#f6d8ac]" />
                    Uploading {uploadingFileName}...
                  </p>
                  <p className="mt-1 text-xs text-[#d8c7b8]">Auto mode detection will start as soon as upload completes.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
                  <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
                  <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
                </div>
              </motion.div>
            ) : videoId ? (
              <motion.div
                key="upload-ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 rounded-xl border border-white/15 bg-black/26 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                <p className="text-sm text-[#eadfd1]">
                  <span className="font-medium text-[#fff5e8]">{fileName || "Uploaded clip"}</span>
                  {duration ? ` • ${Math.round(duration)}s` : ""}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {errorMessage ? <p className="mt-3 text-sm text-rose-300">{errorMessage}</p> : null}
        </CleanCard>

        {autoDetection ? (
          <div className="mb-5">
            <AutoModeBanner
              autoDetection={autoDetection}
              mode={mode}
              autoModeEnabled={autoModeEnabled}
              onAutoModeToggle={handleAutoModeToggle}
            />
          </div>
        ) : null}

        {videoId ? (
          <div className="space-y-5">
            <InitialSettingsPanel
              mode={mode}
              quickControls={quickControls}
              onToggleQuickControl={toggleQuickControl}
              onOpenManualTimestamp={() => setManualTimestampModalOpen(true)}
            />

            {showModeSelector ? (
              <ModeSelector
                mode={mode}
                autoModeEnabled={autoModeEnabled}
                onSelectMode={handleModeSelect}
              />
            ) : null}

            {showExpandedSettings ? (
              <>
                <StaggeredSettingsSections
                  revealedSectionCount={revealedSectionCount}
                  formatPreset={formatPreset}
                  onFormatPresetChange={setFormatPreset}
                  vibeChip={vibeChip}
                  onVibeChipChange={setVibeChip}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
                  pacingValue={pacingValue}
                  onPacingValueChange={setPacingValue}
                  autoDetectBestMoments={autoDetectBestMoments}
                  onAutoDetectBestMomentsChange={setAutoDetectBestMoments}
                  captionsEnabled={captionsEnabled}
                  onCaptionsEnabledChange={setCaptionsEnabled}
                  captionMode={captionMode}
                  onCaptionModeChange={setCaptionMode}
                  captionStyle={captionStyle}
                  onCaptionStyleChange={setCaptionStyle}
                  captionFont={captionFont}
                  onCaptionFontChange={setCaptionFont}
                  captionEffect={captionEffect}
                  onCaptionEffectChange={setCaptionEffect}
                  audioOption={audioOption}
                  onAudioOptionChange={setAudioOption}
                  audioDuckingEnabled={audioDuckingEnabled}
                  onAudioDuckingEnabledChange={setAudioDuckingEnabled}
                  audioCleanupEnabled={audioCleanupEnabled}
                  onAudioCleanupEnabledChange={setAudioCleanupEnabled}
                  audioMasteringEnabled={audioMasteringEnabled}
                  onAudioMasteringEnabledChange={setAudioMasteringEnabled}
                />

                <ModernizedOriginalEditor
                  mode={mode}
                  quickControls={quickControls}
                  onToggleQuickControl={toggleQuickControl}
                  formatPreset={formatPreset}
                  onFormatPresetChange={setFormatPreset}
                  vibeChip={vibeChip}
                  onVibeChipChange={setVibeChip}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
                  pacingValue={pacingValue}
                  onPacingValueChange={setPacingValue}
                  autoDetectBestMoments={autoDetectBestMoments}
                  onAutoDetectBestMomentsChange={setAutoDetectBestMoments}
                  captionsEnabled={captionsEnabled}
                  onCaptionsEnabledChange={setCaptionsEnabled}
                  captionMode={captionMode}
                  onCaptionModeChange={setCaptionMode}
                  captionStyle={captionStyle}
                  onCaptionStyleChange={setCaptionStyle}
                  captionFont={captionFont}
                  onCaptionFontChange={setCaptionFont}
                  captionEffect={captionEffect}
                  onCaptionEffectChange={setCaptionEffect}
                  audioOption={audioOption}
                  onAudioOptionChange={setAudioOption}
                  audioDuckingEnabled={audioDuckingEnabled}
                  onAudioDuckingEnabledChange={setAudioDuckingEnabled}
                  audioCleanupEnabled={audioCleanupEnabled}
                  onAudioCleanupEnabledChange={setAudioCleanupEnabled}
                  audioMasteringEnabled={audioMasteringEnabled}
                  onAudioMasteringEnabledChange={setAudioMasteringEnabled}
                />

                <CleanCard>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#fbf2e6]">Ready to render</p>
                      <p className="text-xs text-[#bcaeb2]">
                        Adaptive pipeline applies per-video orientation, vibe, pacing, captions, and audio profile.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleStartRender}
                      disabled={!renderPayload || isRendering}
                      className="ae-gold-pulse min-w-[200px] rounded-xl bg-[#d4b483] text-[#1f1812] shadow-[0_18px_38px_-24px_rgba(212,180,131,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#e4c89d]"
                    >
                      {isRendering ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Rendering
                        </span>
                      ) : (
                        "Render AutoEditor"
                      )}
                    </Button>
                  </div>

                  {isRendering ? (
                    <div className="mt-4 rounded-xl border border-white/15 bg-black/30 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-[#b9acb0]">
                        <span>Pipeline progress</span>
                        <span>{Math.round(renderProgress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#1c1b1d]">
                        <div className="h-full bg-gradient-to-r from-[#e8d7bc] via-[#d4b483] to-[#90aacd]" style={{ width: `${renderProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-[#9f9497]">Whisper + OpenCV + Claude retention scoring in progress.</p>
                    </div>
                  ) : null}
                </CleanCard>
              </>
            ) : null}

            {hasCompletedResult ? (
              <RetentionInsights
                result={latestResult}
                expanded={retentionExpanded}
                onExpandedChange={setRetentionExpanded}
                selectedPointId={selectedRetentionPointId}
                onSelectedPointIdChange={setSelectedRetentionPointId}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      <ManualTimestampModal
        open={manualTimestampModalOpen}
        onOpenChange={setManualTimestampModalOpen}
        videoUrl={videoUrl}
        duration={duration}
        scrubberTime={scrubberTime}
        segments={manualSegments}
        onScrub={setScrubberTime}
        onAddSegment={addSegmentAtScrubber}
        onRemoveSegment={removeSegment}
        onUpdateSegment={updateSegment}
      />

      <RecentJobsDrawer
        open={recentDrawerOpen}
        onOpenChange={setRecentDrawerOpen}
        jobs={recentJobs}
        inactivitySeconds={Math.round(RECENT_DRAWER_CONFIG.timeoutMs / 1000)}
        onInteract={markRecentInteraction}
      />

      <PostRenderModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        result={latestResult}
        selectedPointId={selectedRetentionPointId}
        onSelectedPointIdChange={setSelectedRetentionPointId}
        selectedThumbnailId={selectedThumbnailId}
        onSelectedThumbnailIdChange={setSelectedThumbnailId}
        onRerender={handleRerenderFromModal}
        onOpenInsightsGraph={handleOpenInsightsFromModal}
        onOpenFeedback={handleOpenFeedbackFromModal}
      />
    </div>
  );
}
