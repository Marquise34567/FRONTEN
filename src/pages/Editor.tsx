import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  Loader2,
  RefreshCcw,
  ScissorsLineDashed,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import AccentPillToggle from "@/components/premium/AccentPillToggle";
import SettingsCardGroup from "@/components/premium/SettingsCardGroup";
import SliderWithPurpleThumb from "@/components/premium/SliderWithPurpleThumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AutoModeBanner from "@/features/autoeditor/components/editor/AutoModeBanner";
import ManualTimestampModal from "@/features/autoeditor/components/editor/ManualTimestampModal";
import RecentJobsDrawer from "@/features/autoeditor/components/editor/RecentJobsDrawer";
import RetentionInsights from "@/features/autoeditor/components/editor/RetentionInsights";
import PostRenderModal from "@/features/autoeditor/components/editor/PostRenderModal";
import StaggeredSettingsSections from "@/features/autoeditor/components/editor/StaggeredSettingsSections";
import { QUICK_CONTROL_CONFIG, RECENT_DRAWER_CONFIG, SECTION_REVEAL_ORDER } from "@/features/autoeditor/data/options";
import { getRetentionScore } from "@/features/autoeditor/lib/retentionQuality";
import { useAutoEditorStore } from "@/features/autoeditor/store/useAutoEditorStore";
import type {
  AutoEditorRenderPayload,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  UploadAnalysisResponse,
  ZoomEffect,
} from "@/features/autoeditor/types";

const uploadAnalyze = async ({ file, token }: { file: File; token: string | null }): Promise<UploadAnalysisResponse> => {
  const formData = new FormData();
  formData.append("video", file);

  const response = await fetch(`${API_URL || ""}/api/vibecut/upload/analyze`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
    // fallback path below
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

const MODE_OPTIONS: Array<{ value: RenderMode; label: string; subtitle: string }> = [
  { value: "horizontal", label: "Horizontal", subtitle: "16:9" },
  { value: "vertical", label: "Vertical", subtitle: "9:16" },
];

export default function Editor() {
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
    audioOption,
    autoDetectBestMoments,
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
    suggestedSubMode,
    videoId,
    vibeChip,
  ]);

  const fetchRecentJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const jobs = await fetchRecentJobsApi(accessToken);
      setRecentJobs(jobs);
    } catch {
      // ignore
    }
  }, [accessToken, setRecentJobs]);

  useEffect(() => {
    void fetchRecentJobs();
  }, [fetchRecentJobs]);

  useEffect(() => {
    const shouldRevealEditorSettings =
      flowStep === "mode_selection" || flowStep === "settings" || flowStep === "rendering" || flowStep === "post_render";
    if (!shouldRevealEditorSettings) {
      setRevealedSectionCount(0);
      return;
    }
    const timers: number[] = [];
    SECTION_REVEAL_ORDER.forEach((_, index) => {
      const timer = window.setTimeout(() => setRevealedSectionCount(index + 1), 110 + index * 140);
      timers.push(timer);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [flowStep, setRevealedSectionCount]);

  useEffect(() => {
    if (!recentDrawerOpen) return;
    const onInteraction = () => markRecentInteraction();
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
        setRenderState({ rendering: stillRunning, jobId: job.jobId, progress });

        if (job.status === "completed") {
          setRenderState({ rendering: false, jobId: job.jobId, progress: 100 });
          setLatestResult(job);
          setRetentionExpanded(false);
          setSuccessModalOpen(true);
          const score = getRetentionScore(job);
          toast({
            title: "Render complete",
            description:
              score >= 70
                ? `Predicted retention ${score.toFixed(1)}% • above target.`
                : `Predicted retention ${score.toFixed(1)}% • below 70%, optimize and re-render.`,
          });
          void fetchRecentJobs();
        }

        if (job.status === "failed") {
          setRenderState({ rendering: false, progress: 0, jobId: null });
          setErrorMessage(job.errorMessage || "Render failed. Please retry with adjusted settings.");
        }
      } catch {
        // ignore
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    accessToken,
    fetchRecentJobs,
    isRendering,
    renderJobId,
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
    } finally {
      setUploadAnalyzing(false);
      setFileInputKey((value) => value + 1);
    }
  };

  const handleStartRender = async () => {
    if (!renderPayload || !accessToken) {
      setErrorMessage("Upload a video before rendering.");
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
      toast({ title: "Render started", description: "Retention-first pipeline is running." });
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Could not start render.";
      setRenderState({ rendering: false, progress: 0, jobId: null });
      setErrorMessage(message);
    }
  };

  const handleAutoModeToggle = (value: boolean) => {
    setAutoModeEnabled(value);
    if (value && autoDetection?.finalMode) {
      setMode(autoDetection.finalMode, false);
      setSuggestedSubMode(autoDetection.editorProfile?.suggestedSubMode || autoDetection.suggestedSubMode);
    }
  };

  const handleModeSelect = (nextMode: RenderMode) => {
    setMode(nextMode, true);
    if (nextMode === "vertical") {
      setSuggestedSubMode("highlight_mode");
    }
  };

  const resetEverything = () => {
    setRecentDrawerOpen(false);
    resetSession();
    setFileInputKey((value) => value + 1);
  };

  const hasCompletedResult = Boolean(latestResult && latestResult.status === "completed" && !isRendering);
  const showExpandedSettings =
    flowStep === "mode_selection" || flowStep === "settings" || flowStep === "rendering" || flowStep === "post_render";

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-purple-200">Retention Target</p>
        <p className="mt-2 text-sm text-slate-300">
          Goal: <span className="font-semibold text-emerald-300">70%+ predicted average retention</span>.
        </p>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-xs text-slate-300">
          All AI edits prioritize hook strength, drop-risk recovery, dynamic pacing, and emotional arc.
        </div>
      </PremiumCard>
      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-purple-200">Vertical Default Pipeline</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          <li>• Highlight Mode</li>
          <li>• 3 best clips (15-30s)</li>
          <li>• Mandatory 3s hook</li>
          <li>• Retention-optimized zoom cadence</li>
        </ul>
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Studio" rightRail={rightRail}>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Retention-First Editor</h1>
              <p className="mt-1 text-sm text-slate-400">
                Optimize every cut, caption, and effect for maximum watch-through.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {recentJobs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setRecentDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm text-slate-200 hover:border-purple-300/35"
                >
                  <History className="h-4 w-4" />
                  Recent Jobs
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetEverything}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm text-slate-200 hover:border-white/20"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </PremiumCard>

        <SettingsCardGroup title="Upload Video" description="Upload your source clip to start AI analysis and profile setup.">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              key={fileInputKey}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska"
              onChange={handleUploadChange}
              className="max-w-[430px] border-white/15 bg-black/40 text-slate-100 file:mr-3 file:rounded-xl file:border-0 file:bg-purple-500/85 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-slate-300">
              <Upload className="h-3.5 w-3.5 text-purple-300" />
              Metadata + OpenCV scan + retention profile
            </span>
          </div>

          {isAnalyzingUpload ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-purple-300/30 bg-purple-500/12 px-3 py-2">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-200" />
                  Uploading {uploadingFileName}...
                </p>
                <p className="mt-1 text-xs text-slate-300">Auto mode detection will start as soon as upload completes.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
                <Skeleton className="h-16 rounded-2xl bg-white/5" />
              </div>
            </div>
          ) : null}

          {videoId ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-200">
              {fileName || "Uploaded clip"} {duration ? `• ${Math.round(duration)}s` : ""}
            </div>
          ) : null}

          {errorMessage ? <p className="mt-2 text-sm text-rose-300">{errorMessage}</p> : null}
        </SettingsCardGroup>

        {autoDetection ? (
          <AutoModeBanner
            autoDetection={autoDetection}
            mode={mode}
            autoModeEnabled={autoModeEnabled}
            onAutoModeToggle={handleAutoModeToggle}
          />
        ) : null}

        {videoId ? (
          <>
            <SettingsCardGroup
              title="Quick Tools"
              description="Apply high-level editing tools before detailed tuning."
              rightSlot={
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-300/35 bg-purple-500/15 px-2 py-1 text-[11px] text-purple-100">
                  <Sparkles className="h-3 w-3" />
                  Retention priority
                </span>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {QUICK_CONTROL_CONFIG.map((control) => {
                  const active = quickControls[control.key];
                  return (
                    <button
                      key={control.key}
                      type="button"
                      onClick={() => toggleQuickControl(control.key)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-purple-300/45 bg-purple-500/15 text-slate-100"
                          : "border-white/10 bg-black/35 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <control.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{control.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{control.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                <div>
                  <p className="text-sm text-slate-200">Manual Timestamp Editor</p>
                  <p className="text-xs text-slate-400">Override AI cuts/hook with frame-accurate segments.</p>
                </div>
                <PurpleAccentButton onClick={() => setManualTimestampModalOpen(true)} icon={<ScissorsLineDashed className="h-4 w-4" />}>
                  Open Editor
                </PurpleAccentButton>
              </div>
            </SettingsCardGroup>

            <SettingsCardGroup title="Editor Mode" description="Choose horizontal or vertical output layout.">
              <AccentPillToggle
                value={mode || "horizontal"}
                onChange={(value) => handleModeSelect(value)}
                options={MODE_OPTIONS}
                className="mx-auto"
              />
            </SettingsCardGroup>

            {showExpandedSettings ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                className="space-y-4"
              >
                <SettingsCardGroup
                  title="Editor Settings"
                  description="Tune format, style, pacing, captions, and audio behavior."
                  className="p-4"
                >
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
                </SettingsCardGroup>

                <SettingsCardGroup title="Render" description="Start the render pipeline with your selected settings.">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-200">Target predicted retention: 70%+</p>
                      <SliderWithPurpleThumb
                        value={pacingValue}
                        onChange={setPacingValue}
                        label="Pacing aggressiveness"
                        helper={`${Math.round(pacingValue)}%`}
                        className="min-w-[280px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300">
                        Auto-detect best moments
                        <Switch checked={autoDetectBestMoments} onCheckedChange={setAutoDetectBestMoments} />
                      </div>
                      <PurpleAccentButton
                        onClick={handleStartRender}
                        disabled={!renderPayload || isRendering}
                        icon={isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      >
                        {isRendering ? "Rendering..." : "Render (Retention-First)"}
                      </PurpleAccentButton>
                    </div>
                  </div>
                  {isRendering ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                        <span>Pipeline progress</span>
                        <span>{Math.round(renderProgress)}%</span>
                      </div>
                      <Progress value={renderProgress} className="h-2 bg-white/10" />
                    </div>
                  ) : null}
                </SettingsCardGroup>
              </motion.div>
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
          </>
        ) : null}
      </div>

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
        onRerender={() => {
          setSuccessModalOpen(false);
          void handleStartRender();
        }}
        onOpenInsightsGraph={() => {
          setSuccessModalOpen(false);
          setRetentionExpanded(true);
        }}
        onOpenFeedback={() => {
          setSuccessModalOpen(false);
          window.location.href = `/analytics?jobId=${encodeURIComponent(latestResult?.jobId || "")}&source=vibecut`;
        }}
      />
    </AppShell>
  );
}
