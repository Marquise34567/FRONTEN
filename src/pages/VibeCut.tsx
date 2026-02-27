import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  AudioLines,
  Clapperboard,
  Film,
  Flame,
  Loader2,
  Music2,
  Radar,
  Sparkles,
  Timer,
  WandSparkles,
} from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import ManualTimestampEditorLite from "@/features/vibecut/components/ManualTimestampEditorLite";
import RetentionGraphInteractive from "@/features/vibecut/components/RetentionGraphInteractive";
import { useVibeCutStore } from "@/features/vibecut/store/useVibeCutStore";
import type {
  AudioOption,
  CaptionMode,
  CaptionStylePreset,
  FormatPreset,
  PacingPreset,
  QuickControlKey,
  RenderJobResult,
  RenderJobSummary,
  RenderMode,
  RenderRequestPayload,
  RetentionPoint,
  StylePreset,
  SuggestedSubMode,
  UploadAnalysisResponse,
  VibeChip,
  ZoomEffect,
} from "@/features/vibecut/types";

const QUICK_CONTROL_CONFIG: Array<{ key: QuickControlKey; title: string; description: string; icon: typeof Sparkles }> = [
  {
    key: "autoEdit",
    title: "Auto-Edit",
    description: "Smart pacing and transitions",
    icon: Sparkles,
  },
  {
    key: "highlightReel",
    title: "Highlight Reel",
    description: "Find peak moments fast",
    icon: Flame,
  },
  {
    key: "speedRamp",
    title: "Speed Ramp",
    description: "Dynamic speed effects",
    icon: Timer,
  },
  {
    key: "musicSync",
    title: "Music Sync",
    description: "Beat-aware cut timing",
    icon: Music2,
  },
];

const FORMAT_OPTIONS: Array<{ value: FormatPreset; label: string }> = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "custom", label: "Custom" },
];

const VIBE_CHIPS: Array<{ value: VibeChip; label: string }> = [
  { value: "energetic", label: "Energetic" },
  { value: "chill", label: "Chill" },
  { value: "luxury", label: "Luxury" },
  { value: "funny", label: "Funny" },
  { value: "motivational", label: "Motivational" },
  { value: "aesthetic", label: "Aesthetic" },
  { value: "dark", label: "Dark" },
  { value: "cinematic", label: "Cinematic" },
];

const STYLE_PRESETS: Array<{ value: StylePreset; label: string }> = [
  { value: "clean", label: "Clean" },
  { value: "bold", label: "Bold" },
  { value: "vintage", label: "Vintage" },
  { value: "glitch", label: "Glitch" },
  { value: "neon", label: "Neon" },
  { value: "minimal", label: "Minimal" },
  { value: "meme", label: "Meme" },
];

const PACING_LEVELS: Array<{ value: PacingPreset; label: string }> = [
  { value: "aggressive", label: "Aggressive" },
  { value: "balanced", label: "Balanced" },
  { value: "chill", label: "Chill" },
  { value: "cinematic", label: "Cinematic" },
];

const CAPTION_STYLES: Array<{ value: CaptionStylePreset; label: string }> = [
  { value: "impact", label: "Impact" },
  { value: "subtle", label: "Subtle" },
  { value: "pop", label: "Pop" },
  { value: "meme", label: "Meme" },
  { value: "scroll", label: "Scroll" },
  { value: "neon_glow", label: "Neon Glow" },
  { value: "vintage_typewriter", label: "Vintage Typewriter" },
];

const FONT_LIBRARY = [
  "Arial Black",
  "Bebas Neue",
  "Montserrat",
  "Pacifico",
  "Comic Neue",
  "Impact",
  "Anton",
  "Poppins",
  "Roboto Condensed",
  "Oswald",
  "Manrope",
  "DM Sans",
  "Playfair Display",
  "Cinzel",
  "Fira Sans",
  "Nunito",
];

const ZOOM_EFFECTS: Array<{ value: ZoomEffect; label: string }> = [
  { value: "punch_zoom", label: "Punch Zoom" },
  { value: "slow_push_in", label: "Slow Push-in" },
  { value: "ken_burns", label: "Ken Burns" },
  { value: "beat_zoom", label: "Beat Zoom" },
];

const AUDIO_OPTIONS: Array<{ value: AudioOption; label: string }> = [
  { value: "auto_sync_tracks", label: "Auto-Sync Trending Tracks" },
  { value: "mute", label: "Mute" },
  { value: "voiceover_ai", label: "Voiceover AI" },
  { value: "sfx_library", label: "SFX Library" },
];

const SUB_MODE_LABELS: Record<SuggestedSubMode, string> = {
  highlight_mode: "Highlight Mode",
  story_mode: "Story Mode",
  standard_mode: "Standard Mode",
};

const uploadAnalyze = async ({
  file,
  token,
}: {
  file: File;
  token: string | null;
}): Promise<UploadAnalysisResponse> => {
  const form = new FormData();
  form.append("video", file);
  const response = await fetch(`${API_URL || ""}/api/vibecut/upload/analyze`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.message || "Upload analysis failed", response.status, payload?.error, payload);
  }
  return payload as UploadAnalysisResponse;
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderSectionMotionProps = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0, height: "auto" },
  exit: { opacity: 0, y: -8, height: 0 },
  transition: { duration: 0.22, ease: "easeOut" },
};

export default function VibeCutPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const [fileInputKey, setFileInputKey] = useState(0);
  const [graphTooltip, setGraphTooltip] = useState<RetentionPoint | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

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
    mode,
    modeConfirmed,
    revealedSectionCount,
    quickControls,
    scrubberTime,
    manualSegments,
    formatPreset,
    vibeChip,
    stylePreset,
    pacing,
    autoDetectBestMoments,
    captionMode,
    captionStyle,
    captionFont,
    zoomEffect,
    audioOption,
    suggestedSubMode,
    recentJobs,
    recentJobsVisible,
    lastRecentJobsInteractionAt,
    retentionExpanded,
    retentionReady,
    successModalOpen,
    selectedThumbnailId,
    selectedRetentionPointId,
    latestResult,
    setUploadAnalyzing,
    setRenderState,
    setErrorMessage,
    setUploadAnalysis,
    setMode,
    setModeConfirmed,
    setRevealedSectionCount,
    toggleQuickControl,
    setScrubberTime,
    addSegmentAtScrubber,
    removeSegment,
    updateSegment,
    setFormatPreset,
    setVibeChip,
    setStylePreset,
    setPacing,
    setAutoDetectBestMoments,
    setCaptionMode,
    setCaptionStyle,
    setCaptionFont,
    setZoomEffect,
    setAudioOption,
    setSuggestedSubMode,
    setRecentJobs,
    setRecentJobsVisible,
    markRecentJobsInteraction,
    setLatestResult,
    setSuccessModalOpen,
    setRetentionExpanded,
    setSelectedThumbnailId,
    setSelectedRetentionPointId,
    resetAll,
  } = useVibeCutStore();

  const selectedPacingIndex = Math.max(
    0,
    PACING_LEVELS.findIndex((item) => item.value === pacing),
  );

  const selectedThumbnail = useMemo(() => {
    if (!latestResult?.thumbnails?.length) return null;
    return (
      latestResult.thumbnails.find((thumbnail) => thumbnail.id === selectedThumbnailId) ||
      latestResult.thumbnails[0]
    );
  }, [latestResult, selectedThumbnailId]);

  const selectedRetentionPoint = useMemo(() => {
    if (!latestResult?.retention.points?.length) return null;
    return (
      latestResult.retention.points.find((point) => point.id === selectedRetentionPointId) ||
      latestResult.retention.points[0]
    );
  }, [latestResult, selectedRetentionPointId]);

  const modeLabel = mode === "vertical" ? "Vertical" : mode === "horizontal" ? "Horizontal" : "Unset";
  const shouldShowManualModeStep = Boolean(videoId && (!autoDetection || autoDetection.confidence < 0.35));

  const renderPayload = useMemo<RenderRequestPayload | null>(() => {
    if (!videoId || !mode) return null;
    return {
      videoId,
      mode,
      quickControls,
      manualSegments,
      formatPreset,
      vibeChip,
      stylePreset,
      pacing,
      autoDetectBestMoments,
      captionMode,
      captionStyle,
      captionFont,
      zoomEffect,
      audioOption,
      suggestedSubMode,
    };
  }, [
    autoDetectBestMoments,
    audioOption,
    captionFont,
    captionMode,
    captionStyle,
    formatPreset,
    manualSegments,
    mode,
    pacing,
    quickControls,
    stylePreset,
    suggestedSubMode,
    vibeChip,
    videoId,
    zoomEffect,
  ]);

  const fetchRecentJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await apiFetch<{ jobs: RenderJobSummary[] }>("/api/vibecut/jobs", {
        token: accessToken,
      });
      setRecentJobs(response.jobs || []);
    } catch (error) {
      console.warn("vibecut jobs fetch failed", error);
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
    [1, 2, 3, 4, 5].forEach((count, index) => {
      const timer = window.setTimeout(() => {
        setRevealedSectionCount(count);
      }, 120 + index * 150);
      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [modeConfirmed, mode, setRevealedSectionCount]);

  useEffect(() => {
    if (!recentJobsVisible) return;

    const onInteraction = () => {
      markRecentJobsInteraction();
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, onInteraction, { passive: true });
    });

    const interval = window.setInterval(() => {
      if (Date.now() - lastRecentJobsInteractionAt > 10_000) {
        setRecentJobsVisible(false);
      }
    }, 800);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onInteraction);
      });
      window.clearInterval(interval);
    };
  }, [recentJobsVisible, markRecentJobsInteraction, lastRecentJobsInteractionAt, setRecentJobsVisible]);

  useEffect(() => {
    if (!graphTooltip) return;
    const timeout = window.setTimeout(() => setGraphTooltip(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [graphTooltip]);

  useEffect(() => {
    if (!renderJobId || !isRendering || !accessToken) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const job = await apiFetch<RenderJobResult>(`/api/vibecut/jobs/${renderJobId}`, {
          token: accessToken,
        });
        if (cancelled) return;

        const progress = Number.isFinite(Number(job.progress)) ? Number(job.progress) : 0;
        setRenderState({ rendering: job.status === "processing" || job.status === "queued", progress, jobId: job.jobId });

        if (job.status === "completed") {
          setRenderState({ rendering: false, progress: 100, jobId: job.jobId });
          setLatestResult(job);
          setSuccessModalOpen(true);
          setRetentionExpanded(false);
          void fetchRecentJobs();
          toast({
            title: "Render complete",
            description: `${modeLabel} pipeline finished with AI retention scoring.`,
          });
        }

        if (job.status === "failed") {
          setRenderState({ rendering: false, progress: 0, jobId: null });
          setErrorMessage("Render failed. Please retry with shorter segments.");
          toast({ title: "Render failed", description: "VibeCut could not finish this job.", variant: "destructive" });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("vibecut poll failed", error);
      }
    };

    void tick();
    const pollTimer = window.setInterval(() => {
      void tick();
    }, 1800);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
    };
  }, [
    accessToken,
    fetchRecentJobs,
    isRendering,
    modeLabel,
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

    setUploadAnalyzing(true);
    setErrorMessage(null);
    setLatestResult(null);
    setModeConfirmed(false);
    setSuccessModalOpen(false);

    try {
      const payload = await uploadAnalyze({ file, token: accessToken });
      setUploadAnalysis(payload);
      toast({
        title: "Auto detection ready",
        description: payload.autoDetection.bannerMessage,
      });
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

    setErrorMessage(null);
    setRenderState({ rendering: true, progress: 8, jobId: null });
    setRetentionExpanded(false);
    setSuccessModalOpen(false);

    try {
      const response = await apiFetch<{ jobId: string; status: string; progress: number }>("/api/vibecut/render", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(renderPayload),
      });
      setRenderState({ rendering: true, progress: response.progress ?? 12, jobId: response.jobId });
      toast({ title: "Render started", description: "VibeCut pipelines are processing your video now." });
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Render failed to start.";
      setRenderState({ rendering: false, progress: 0, jobId: null });
      setErrorMessage(message);
      toast({ title: "Render error", description: message, variant: "destructive" });
    }
  };

  const handleRetentionPointClick = (point: RetentionPoint) => {
    setSelectedRetentionPointId(point.id);
    setGraphTooltip(point);

    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = Math.max(0, point.timestamp);
      void previewVideoRef.current.play().catch(() => null);
    }
  };

  const resetSession = () => {
    resetAll();
    setFileInputKey((value) => value + 1);
    setGraphTooltip(null);
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(80%_60%_at_10%_5%,rgba(14,165,233,0.2),transparent_60%),radial-gradient(70%_60%_at_85%_0%,rgba(16,185,129,0.13),transparent_55%),radial-gradient(90%_65%_at_50%_120%,rgba(148,163,184,0.12),transparent_65%)]" />

      <main className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="mb-2 border-cyan-400/30 bg-cyan-500/15 text-cyan-200">VibeCut</Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Premium Auto Video Editor</h1>
            <p className="text-sm text-slate-400">Mobile-first flow. Vertical and horizontal pipelines with retention intelligence.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
              onClick={() => setRecentJobsVisible(!recentJobsVisible)}
            >
              {recentJobsVisible ? "Hide Recent Jobs" : "Show Recent Jobs"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800/80"
              onClick={resetSession}
            >
              Reset
            </Button>
          </div>
        </header>

        <AnimatePresence>
          {recentJobsVisible ? (
            <motion.aside
              {...renderSectionMotionProps}
              className="mb-5 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4"
              onMouseMove={() => markRecentJobsInteraction()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Recent Jobs</h2>
                <span className="text-xs text-slate-500">Auto-hides after 10s inactivity</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentJobs.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-500">No recent jobs yet.</p>
                ) : (
                  recentJobs.map((job) => (
                    <div key={job.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <p className="text-xs text-slate-400">{new Date(job.createdAt).toLocaleString()}</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">{job.fileName}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge className="border-slate-700 bg-slate-800 text-slate-200">{toTitleCase(job.mode)}</Badge>
                        <span className="text-xs text-cyan-300">{job.progress}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <section className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Upload Video</h2>
            {videoId ? <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Ready</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              key={fileInputKey}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska"
              onChange={handleUploadChange}
              className="max-w-lg border-slate-700 bg-slate-900/80 text-sm"
            />
            {isAnalyzingUpload ? (
              <div className="flex items-center gap-2 text-sm text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running ffprobe + OpenCV scan
              </div>
            ) : null}
          </div>

          {isAnalyzingUpload ? (
            <div className="mt-4 grid gap-2">
              <Skeleton className="h-12 w-full bg-slate-800" />
              <Skeleton className="h-24 w-full bg-slate-800" />
            </div>
          ) : null}

          {videoUrl ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
                <video src={videoUrl} controls className="h-full w-full" />
              </div>

              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                <p className="font-medium text-slate-100">{fileName}</p>
                <p className="text-slate-400">Mode: {modeLabel}</p>
                <p className="text-slate-400">Duration: {Math.round(duration || 0)}s</p>
                {autoDetection ? (
                  <>
                    <p className="text-slate-400">Confidence: {Math.round(autoDetection.confidence * 100)}%</p>
                    <p className="text-slate-400">Default sub-mode: {SUB_MODE_LABELS[suggestedSubMode]}</p>
                    <p className="text-slate-400">
                      Frame suggestions: {autoDetection.suggestedSubModes.map((value) => SUB_MODE_LABELS[value]).join(" • ")}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {autoDetection ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2"
            >
              <p className="text-sm text-cyan-100">{autoDetection.bannerMessage}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-cyan-200">Horizontal</span>
                <Switch
                  checked={mode === "vertical"}
                  onCheckedChange={(checked) => {
                    setMode(checked ? "vertical" : "horizontal", true);
                    setModeConfirmed(true);
                  }}
                />
                <span className="text-xs text-cyan-200">Vertical</span>
              </div>
            </motion.div>
          ) : null}
        </section>

        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</div>
        ) : null}

        {videoId ? (
          <section className="space-y-4">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">Quick Controls</h2>
                <Badge className="border-slate-700 bg-slate-900 text-slate-200">First step after upload</Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {QUICK_CONTROL_CONFIG.map((control) => {
                  const active = quickControls[control.key];
                  const Icon = control.icon;
                  return (
                    <button
                      key={control.key}
                      type="button"
                      onClick={() => toggleQuickControl(control.key)}
                      className={cn(
                        "group rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? "border-cyan-400/50 bg-cyan-400/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-600",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Icon className={cn("h-4 w-4", active ? "text-cyan-200" : "text-slate-400")} />
                        <span className={cn("text-[11px]", active ? "text-cyan-100" : "text-slate-500")}>{active ? "On" : "Off"}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-100">{control.title}</p>
                      <p className="text-xs text-slate-400">{control.description}</p>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            <ManualTimestampEditorLite
              duration={duration}
              scrubberTime={scrubberTime}
              segments={manualSegments}
              onScrub={setScrubberTime}
              onAddSegment={addSegmentAtScrubber}
              onRemoveSegment={removeSegment}
              onUpdateSegment={updateSegment}
            />

            {shouldShowManualModeStep ? (
              <motion.section
                {...renderSectionMotionProps}
                className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-5"
              >
                <h2 className="mb-3 text-center text-base font-semibold text-slate-100">Choose Mode</h2>
                <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
                  {([
                    { value: "horizontal", label: "HORIZONTAL (16:9)", icon: Film },
                    { value: "vertical", label: "VERTICAL (9:16)", icon: Clapperboard },
                  ] as Array<{ value: RenderMode; label: string; icon: typeof Film }>).map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={cn(
                          "rounded-xl border px-3 py-4 transition",
                          active ? "border-cyan-400/50 bg-cyan-400/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-600",
                        )}
                        onClick={() => {
                          setMode(item.value, true);
                          setModeConfirmed(true);
                        }}
                      >
                        <Icon className={cn("mx-auto mb-2 h-5 w-5", active ? "text-cyan-100" : "text-slate-400")} />
                        <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            ) : null}

            <AnimatePresence>
              {modeConfirmed && revealedSectionCount >= 1 ? (
                <motion.section
                  key="format"
                  {...renderSectionMotionProps}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">A. Format & Platform</h3>
                  <div className="flex flex-wrap gap-2">
                    {FORMAT_OPTIONS.map((option) => {
                      const active = formatPreset === option.value;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="outline"
                          className={cn(
                            "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800",
                            active && "border-cyan-400/50 bg-cyan-400/10 text-cyan-100",
                          )}
                          onClick={() => setFormatPreset(option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </motion.section>
              ) : null}

              {modeConfirmed && revealedSectionCount >= 2 ? (
                <motion.section
                  key="vibe"
                  {...renderSectionMotionProps}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">B. Vibe & Style</h3>
                  <p className="mb-2 text-xs text-slate-400">Vibe chips</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {VIBE_CHIPS.map((chip) => {
                      const active = vibeChip === chip.value;
                      return (
                        <button
                          key={chip.value}
                          type="button"
                          onClick={() => setVibeChip(chip.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            active
                              ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                              : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                          )}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mb-2 text-xs text-slate-400">Style presets</p>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_PRESETS.map((preset) => {
                      const active = stylePreset === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setStylePreset(preset.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            active
                              ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-100"
                              : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              ) : null}

              {modeConfirmed && revealedSectionCount >= 3 ? (
                <motion.section
                  key="cuts"
                  {...renderSectionMotionProps}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">C. Cuts & Pacing</h3>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{PACING_LEVELS[selectedPacingIndex]?.label || "Balanced"}</span>
                    <span>Slider control</span>
                  </div>
                  <Slider
                    value={[selectedPacingIndex]}
                    min={0}
                    max={PACING_LEVELS.length - 1}
                    step={1}
                    onValueChange={(values) => {
                      const nextIndex = Math.max(0, Math.min(PACING_LEVELS.length - 1, Number(values[0] ?? 1)));
                      setPacing(PACING_LEVELS[nextIndex].value);
                    }}
                  />
                  <div className="mt-2 grid grid-cols-4 text-[11px] text-slate-500">
                    {PACING_LEVELS.map((level) => (
                      <span key={level.value} className="text-center">
                        {level.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">Auto-detect best moments</p>
                      <p className="text-xs text-slate-400">Uses retention + action bursts to prioritize cuts</p>
                    </div>
                    <Switch checked={autoDetectBestMoments} onCheckedChange={setAutoDetectBestMoments} />
                  </div>
                </motion.section>
              ) : null}

              {modeConfirmed && revealedSectionCount >= 4 ? (
                <motion.section
                  key="captions"
                  {...renderSectionMotionProps}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">D. Captions</h3>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {([
                      { value: "ai", label: "AI Captions" },
                      { value: "manual", label: "Manual Captions" },
                    ] as Array<{ value: CaptionMode; label: string }>).map((item) => {
                      const active = captionMode === item.value;
                      return (
                        <Button
                          key={item.value}
                          type="button"
                          variant="outline"
                          className={cn(
                            "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800",
                            active && "border-cyan-400/50 bg-cyan-400/10 text-cyan-100",
                          )}
                          onClick={() => setCaptionMode(item.value)}
                        >
                          {item.label}
                        </Button>
                      );
                    })}
                  </div>

                  <p className="mb-2 text-xs text-slate-400">Caption styles</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {CAPTION_STYLES.map((style) => {
                      const active = captionStyle === style.value;
                      return (
                        <button
                          key={style.value}
                          type="button"
                          onClick={() => setCaptionStyle(style.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            active
                              ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                              : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                          )}
                        >
                          {style.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs text-slate-400">Font library (15+)</p>
                      <Select value={captionFont} onValueChange={setCaptionFont}>
                        <SelectTrigger className="border-slate-700 bg-slate-900/80 text-slate-200">
                          <SelectValue placeholder="Select font" />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_LIBRARY.map((font) => (
                            <SelectItem key={font} value={font}>
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="mb-2 text-xs text-slate-400">Zoom effects</p>
                      <div className="flex flex-wrap gap-2">
                        {ZOOM_EFFECTS.map((effect) => {
                          const active = zoomEffect === effect.value;
                          return (
                            <button
                              key={effect.value}
                              type="button"
                              onClick={() => setZoomEffect(effect.value)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition",
                                active
                                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                                  : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                              )}
                            >
                              {effect.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.section>
              ) : null}

              {modeConfirmed && revealedSectionCount >= 5 ? (
                <motion.section
                  key="audio"
                  {...renderSectionMotionProps}
                  className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-slate-100">E. Audio</h3>
                  <div className="flex flex-wrap gap-2">
                    {AUDIO_OPTIONS.map((option) => {
                      const active = audioOption === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAudioOption(option.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            active
                              ? "border-violet-400/50 bg-violet-500/10 text-violet-100"
                              : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            <section className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Ready to render</p>
                  <p className="text-xs text-slate-400">
                    {mode === "vertical"
                      ? "Vertical mode uses dedicated Highlight pipeline (exactly 3 moments, 15-30s each)."
                      : "Horizontal mode uses long-form pacing pipeline."}
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={!renderPayload || isRendering}
                  onClick={handleStartRender}
                  className="min-w-[180px] bg-cyan-400 text-slate-900 hover:bg-cyan-300"
                >
                  {isRendering ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Rendering
                    </span>
                  ) : (
                    "Render with VibeCut"
                  )}
                </Button>
              </div>

              {isRendering ? (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Pipeline progress</span>
                    <span>{Math.round(renderProgress)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400" style={{ width: `${renderProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Whisper + OpenCV + Claude retention modeling in progress...</p>
                </div>
              ) : null}
            </section>

            {retentionReady ? (
              <section className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">Retention Details</h3>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                    onClick={() => setRetentionExpanded(!retentionExpanded)}
                  >
                    {retentionExpanded ? "Collapse Retention Analysis" : "Expand Retention Analysis"}
                  </Button>
                </div>

                <AnimatePresence>
                  {retentionExpanded && latestResult ? (
                    <motion.div {...renderSectionMotionProps} className="mt-4 space-y-3">
                      <RetentionGraphInteractive
                        points={latestResult.retention.points}
                        heatmap={latestResult.retention.heatmap}
                        selectedPointId={selectedRetentionPointId}
                        onSelectPoint={handleRetentionPointClick}
                      />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {latestResult.thumbnails.map((thumbnail, index) => {
                          const active = thumbnail.id === selectedThumbnail?.id;
                          return (
                            <button
                              key={thumbnail.id}
                              type="button"
                              onClick={() => setSelectedThumbnailId(thumbnail.id)}
                              className={cn(
                                "overflow-hidden rounded-xl border p-1 transition",
                                active ? "border-cyan-400/60 bg-cyan-400/10" : "border-slate-800 bg-slate-900/80",
                              )}
                            >
                              <img src={thumbnail.url} alt={thumbnail.label} className="aspect-video w-full rounded-md object-cover" />
                              <p className="mt-1 text-[11px] text-slate-300">Option {index + 1}</p>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            ) : null}
          </section>
        ) : null}
      </main>

      <AnimatePresence>
        {successModalOpen && latestResult ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          >
            <div className="grid h-full w-full grid-cols-1 overflow-y-auto lg:grid-cols-[60%_40%]">
              <div className="relative p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Badge className="mb-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-200">Render Complete</Badge>
                    <h2 className="text-xl font-semibold text-slate-50">Retention Analysis + Thumbnail Picks</h2>
                    <p className="text-sm text-slate-400">Click any graph point to seek preview instantly.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    onClick={() => setSuccessModalOpen(false)}
                  >
                    Close
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 sm:p-4">
                  <RetentionGraphInteractive
                    points={latestResult.retention.points}
                    heatmap={latestResult.retention.heatmap}
                    selectedPointId={selectedRetentionPointId}
                    onSelectPoint={handleRetentionPointClick}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {latestResult.thumbnails.map((thumbnail, index) => {
                    const active = thumbnail.id === selectedThumbnail?.id;
                    return (
                      <button
                        key={thumbnail.id}
                        type="button"
                        onClick={() => setSelectedThumbnailId(thumbnail.id)}
                        className={cn(
                          "overflow-hidden rounded-xl border p-1 text-left transition",
                          active ? "border-cyan-400/60 bg-cyan-400/10" : "border-slate-800 bg-slate-900/80 hover:border-slate-600",
                        )}
                      >
                        <img src={thumbnail.url} alt={thumbnail.label} className="aspect-video w-full rounded-md object-cover" />
                        <div className="mt-1 flex items-center justify-between px-1">
                          <span className="text-[11px] text-slate-300">Option {index + 1}</span>
                          <ArrowUpRight className="h-3 w-3 text-slate-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {graphTooltip ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-none fixed bottom-6 left-1/2 z-[60] w-[min(90vw,480px)] -translate-x-1/2 rounded-xl border border-cyan-400/35 bg-slate-950/95 px-4 py-3 shadow-[0_0_35px_rgba(34,211,238,0.25)]"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{graphTooltip.label}</p>
                    <p className="mt-1 text-sm text-slate-100">{graphTooltip.description}</p>
                    <p className="mt-1 text-xs text-slate-400">Jumped to {graphTooltip.timestamp.toFixed(1)}s in preview.</p>
                  </motion.div>
                ) : null}
              </div>

              <aside className="relative border-t border-slate-800 bg-slate-950/95 p-4 sm:p-6 lg:border-l lg:border-t-0">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Live Preview</p>
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
                  <video
                    ref={previewVideoRef}
                    src={latestResult.outputVideoUrl}
                    autoPlay
                    loop
                    controls
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>

                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-sm font-medium text-slate-100">{selectedRetentionPoint?.label || "Retention insight"}</p>
                  <p className="text-xs text-slate-400">{selectedRetentionPoint?.description || latestResult.retention.summary}</p>
                </div>

                <div className="mt-3 space-y-2 text-xs text-slate-400">
                  <p className="inline-flex items-center gap-2">
                    <Radar className="h-3.5 w-3.5 text-cyan-300" /> Whisper audio peaks + OpenCV visual energy + Claude sentiment model
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <WandSparkles className="h-3.5 w-3.5 text-violet-300" /> {mode === "vertical" ? "Vertical Highlight Mode extracted exactly 3 moments." : "Horizontal pacing profile tuned for long-form retention."}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <AudioLines className="h-3.5 w-3.5 text-emerald-300" /> {latestResult.ffmpegCommands.length} FFmpeg command{latestResult.ffmpegCommands.length === 1 ? "" : "s"} executed
                  </p>
                </div>
              </aside>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
