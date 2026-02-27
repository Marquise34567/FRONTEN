import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, Loader2, RefreshCcw, Upload } from "lucide-react";

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
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [fileInputKey, setFileInputKey] = useState(0);

  const {
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
    modeConfirmed,
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
    setModeConfirmed,
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
    if (!modeConfirmed) {
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
  }, [modeConfirmed, mode, setRevealedSectionCount]);

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

  const handleModeSelect = (nextMode: RenderMode) => {
    setMode(nextMode, true);
    setModeConfirmed(true);
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

  return (
    <div className="autoeditor-root min-h-screen bg-[#0f1117] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_65%_at_10%_0%,rgba(59,130,246,0.14),transparent_68%),radial-gradient(58%_46%_at_95%_0%,rgba(148,163,184,0.1),transparent_74%),radial-gradient(90%_70%_at_50%_110%,rgba(15,23,42,0.52),transparent_75%)]" />

      <main className="relative mx-auto w-full max-w-[1300px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AutoEditor</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">AI Video Editor</h1>
            <p className="text-sm text-slate-400">Premium creator workflow tuned for clarity, pacing, and retention.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecentDrawerOpen(true)}
              className="rounded-xl border-white/15 bg-white/[0.08] text-slate-100 transition-all hover:-translate-y-0.5 hover:bg-white/[0.14]"
            >
              <History className="h-4 w-4" />
              Recent Jobs
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={resetEverything}
              className="rounded-xl text-slate-300 hover:bg-white/[0.08]"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </header>

        <CleanCard className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Upload</p>
              <p className="mt-1 text-sm text-slate-300">Drop source footage to start AutoEditor analysis.</p>
            </div>
            <Input
              key={fileInputKey}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska"
              onChange={handleUploadChange}
              className="max-w-[360px] border-white/10 bg-black/35 text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500 file:px-3.5 file:py-1.5 file:text-xs file:font-medium file:text-slate-100"
            />
          </div>

          <AnimatePresence mode="wait">
            {isAnalyzingUpload ? (
              <motion.div
                key="upload-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 grid gap-3 sm:grid-cols-3"
              >
                <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
                <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
                <Skeleton className="ae-skeleton h-20 rounded-xl bg-white/5" />
              </motion.div>
            ) : videoId ? (
              <motion.div
                key="upload-ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-3"
              >
                <p className="text-sm text-slate-200">
                  <span className="font-medium text-slate-50">{fileName || "Uploaded clip"}</span>
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
              onModeChange={handleModeSelect}
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

            {!modeConfirmed ? (
              <ModeSelector
                mode={mode}
                modeConfirmed={modeConfirmed}
                autoModeEnabled={autoModeEnabled}
                onSelectMode={handleModeSelect}
              />
            ) : null}

            {modeConfirmed ? (
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

                <CleanCard>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Ready to render</p>
                      <p className="text-xs text-slate-400">
                        Adaptive pipeline applies per-video orientation, vibe, pacing, captions, and audio profile.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleStartRender}
                      disabled={!renderPayload || isRendering}
                      className="min-w-[190px] rounded-xl bg-blue-500 text-slate-100 shadow-[0_16px_36px_-24px_rgba(96,165,250,0.86)] transition-all hover:-translate-y-0.5 hover:bg-blue-400"
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
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Pipeline progress</span>
                        <span>{Math.round(renderProgress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#1b2233]">
                        <div className="h-full bg-gradient-to-r from-slate-400 via-blue-400 to-slate-300" style={{ width: `${renderProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Whisper + OpenCV + Claude retention scoring in progress.</p>
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
      />
    </div>
  );
}
