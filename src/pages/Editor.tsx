import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  History,
  Loader2,
  RefreshCcw,
  ScissorsLineDashed,
  Sparkles,
  Upload,
  Wand2,
  Workflow,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import ExclusiveToggle from "@/components/premium/ExclusiveToggle";
import MetallicProgress from "@/components/premium/MetallicProgress";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import AccentPillToggle from "@/components/premium/AccentPillToggle";
import SettingsCardGroup from "@/components/premium/SettingsCardGroup";
import SliderWithPurpleThumb from "@/components/premium/SliderWithPurpleThumb";
import VIPBadge from "@/components/premium/VIPBadge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, ApiError, apiFetch, resolveApiMediaUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AutoModeBanner from "@/features/autoeditor/components/editor/AutoModeBanner";
import ManualTimestampModal from "@/features/autoeditor/components/editor/ManualTimestampModal";
import RecentJobsDrawer from "@/features/autoeditor/components/editor/RecentJobsDrawer";
import RetentionInsights from "@/features/autoeditor/components/editor/RetentionInsights";
import PostRenderModal from "@/features/autoeditor/components/editor/PostRenderModal";
import StaggeredSettingsSections from "@/features/autoeditor/components/editor/StaggeredSettingsSections";
import VerticalModeToolkit from "@/features/autoeditor/components/editor/VerticalModeToolkit";
import { DEFAULT_PACING_VALUE, QUICK_CONTROL_CONFIG, RECENT_DRAWER_CONFIG, SECTION_REVEAL_ORDER } from "@/features/autoeditor/data/options";
import { getRetentionScore } from "@/features/autoeditor/lib/retentionQuality";
import { useAutoEditorStore } from "@/features/autoeditor/store/useAutoEditorStore";
import type {
  AutoEditorRenderPayload,
  RetentionStrategyMode,
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

  const rawBody = await response.text().catch(() => "");
  let data: any = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { message: rawBody.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      (response.status ? `Upload analysis failed (HTTP ${response.status}).` : "Upload analysis failed.");
    throw new ApiError(message, response.status, data?.error, data);
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
  { value: "vertical", label: "Vertical", subtitle: "9:16 Studio" },
];

const RETENTION_STRATEGY_OPTIONS: Array<{ value: RetentionStrategyMode; label: string; subtitle: string }> = [
  { value: "balanced", label: "Balanced AI", subtitle: "stable quality" },
  { value: "ruthless", label: "Ruthless Retention", subtitle: "max watch-through" },
];

const RENDER_POLL_INTERVAL_FOREGROUND_MS = 2500;
const RENDER_POLL_INTERVAL_BACKGROUND_MS = 6000;

const PIPELINE_STAGES = [
  { key: "upload", label: "Upload", minProgress: 0, detail: "Source accepted and queued." },
  { key: "analyze", label: "Analyze", minProgress: 12, detail: "Scene and retention profiling running." },
  { key: "hook", label: "Hook", minProgress: 26, detail: "Hook candidate ranking and selection." },
  { key: "cut", label: "Cut", minProgress: 42, detail: "Timeline trims and pacing edits applied." },
  { key: "caption", label: "Caption", minProgress: 58, detail: "Caption and audio pass in progress." },
  { key: "render", label: "Render", minProgress: 76, detail: "Final encode and quality checks." },
  { key: "ready", label: "Ready", minProgress: 100, detail: "Export package is complete." },
] as const;

const UPLOAD_STATUS_STEPS = [
  {
    id: "uploading",
    title: "Uploading video",
    detail: "Sending footage into the processing pipeline.",
  },
  {
    id: "analyzing",
    title: "Getting analyzed",
    detail: "Scanning scenes, motion, and retention signals.",
  },
  {
    id: "applying",
    title: "Edits being applied",
    detail: "Applying smart mode and pacing defaults.",
  },
] as const;

type UploadStatusStep = (typeof UPLOAD_STATUS_STEPS)[number]["id"];
type UploadStatusState = UploadStatusStep | "idle" | "failed";

const UPLOAD_STATUS_INDEX: Record<UploadStatusState, number> = {
  idle: -1,
  uploading: 0,
  analyzing: 1,
  applying: 2,
  failed: 2,
};

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const toProgressPercent = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const modeLabel = (value: RenderMode | null | undefined) => (value === "vertical" ? "Vertical" : "Horizontal");

const statusLabel = (status: string) => {
  if (status === "completed") return "Completed";
  if (status === "processing") return "Processing";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  return "Unknown";
};

const statusBadgeClass = (status: string) => {
  if (status === "completed") return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  if (status === "processing") return "border-[rgba(212,175,55,0.46)] bg-[rgba(212,175,55,0.16)] text-[#f6da8a]";
  if (status === "failed") return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  return "border-purple-300/45 bg-purple-500/15 text-purple-100";
};

const getPipelineStageIndex = (status: string, progress: number) => {
  const normalizedProgress = toProgressPercent(progress);
  if (status === "completed") return PIPELINE_STAGES.length - 1;
  const maxInFlightIndex = PIPELINE_STAGES.length - 2;
  let stageIndex = 0;
  for (let index = 0; index < PIPELINE_STAGES.length; index += 1) {
    if (normalizedProgress >= PIPELINE_STAGES[index].minProgress) {
      stageIndex = index;
    }
  }
  if (status === "failed") return Math.min(stageIndex, maxInFlightIndex);
  if (status === "queued") return 0;
  return Math.min(stageIndex, maxInFlightIndex);
};

const normalizeRenderJobUrls = (job: RenderJobResult): RenderJobResult => {
  const normalizedClipUrls = Array.isArray(job.clipUrls)
    ? job.clipUrls.map((url) => resolveApiMediaUrl(url)).filter(Boolean)
    : [];
  const normalizedOutputVideoUrl = resolveApiMediaUrl(job.outputVideoUrl || normalizedClipUrls[0] || "");

  return {
    ...job,
    outputVideoUrl: normalizedOutputVideoUrl,
    clipUrls: normalizedClipUrls,
    thumbnails: Array.isArray(job.thumbnails)
      ? job.thumbnails.map((thumbnail) => ({
          ...thumbnail,
          url: resolveApiMediaUrl(thumbnail.url),
        }))
      : [],
  };
};

type EditorProps = {
  verticalModeExperience?: boolean;
};

export default function Editor({ verticalModeExperience = false }: EditorProps) {
  const { accessToken } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");
  const { toast } = useToast();
  const [fileInputKey, setFileInputKey] = useState(0);
  const [activePipelineJobId, setActivePipelineJobId] = useState<string | null>(null);
  const [jobResultCache, setJobResultCache] = useState<Record<string, RenderJobResult>>({});
  const [jobActionPendingId, setJobActionPendingId] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatusState>("idle");
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const uploadStatusTimeoutRef = useRef<number | null>(null);
  const recentDrawerTimeoutRef = useRef<number | null>(null);
  const handledRequestedJobIdRef = useRef<string | null>(null);

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
    retentionStrategyMode,
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
    verticalWebcamEnabled,
    verticalWebcamLayout,
    captionOutlineEnabled,
    captionDropShadowEnabled,
    audioOption,
    audioDuckingEnabled,
    audioCleanupEnabled,
    audioMasteringEnabled,
    suggestedSubMode,
    recentJobs,
    recentDrawerOpen,
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
    setVerticalWebcamEnabled,
    setVerticalWebcamLayout,
    setCaptionOutlineEnabled,
    setCaptionDropShadowEnabled,
    setAudioOption,
    setAudioDuckingEnabled,
    setAudioCleanupEnabled,
    setAudioMasteringEnabled,
    setSuggestedSubMode,
    setRetentionStrategyMode,
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

  const clearUploadStatusTimer = useCallback(() => {
    if (uploadStatusTimeoutRef.current !== null) {
      window.clearTimeout(uploadStatusTimeoutRef.current);
      uploadStatusTimeoutRef.current = null;
    }
  }, []);

  const clearRecentDrawerTimer = useCallback(() => {
    if (recentDrawerTimeoutRef.current !== null) {
      window.clearTimeout(recentDrawerTimeoutRef.current);
      recentDrawerTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearUploadStatusTimer(), [clearUploadStatusTimer]);
  useEffect(() => () => clearRecentDrawerTimer(), [clearRecentDrawerTimer]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const uploadInputId = `editor-upload-input-${fileInputKey}`;
  const uploadStatusIndex = UPLOAD_STATUS_INDEX[uploadStatus];
  const uploadStatusProgress = useMemo(() => {
    if (uploadStatus === "uploading") return 24;
    if (uploadStatus === "analyzing") return 58;
    if (uploadStatus === "applying") return 90;
    if (uploadStatus === "failed") return 100;
    return 0;
  }, [uploadStatus]);

  const currentUploadStatusText = useMemo(() => {
    if (uploadStatus === "uploading") return `Uploading ${uploadingFileName || "video"}...`;
    if (uploadStatus === "analyzing") return "Video is being analyzed...";
    if (uploadStatus === "applying") return "Applying edit defaults...";
    if (uploadStatus === "failed") return "Upload process failed.";
    return "";
  }, [uploadStatus, uploadingFileName]);

  const applyRetentionStrategyPreset = useCallback(
    (nextStrategy: RetentionStrategyMode, targetMode: RenderMode | null | undefined) => {
      const resolvedMode = targetMode || mode || "horizontal";
      const isRuthless = nextStrategy === "ruthless";
      const nextSubMode = isRuthless
        ? resolvedMode === "vertical"
          ? "highlight_mode"
          : "story_mode"
        : resolvedMode === "vertical"
          ? "highlight_mode"
          : "standard_mode";
      const nextPacingValue = isRuthless ? (resolvedMode === "vertical" ? 86 : 82) : DEFAULT_PACING_VALUE[resolvedMode];

      if (retentionStrategyMode !== nextStrategy) {
        setRetentionStrategyMode(nextStrategy);
      }
      if (!autoDetectBestMoments) {
        setAutoDetectBestMoments(true);
      }
      if (suggestedSubMode !== nextSubMode) {
        setSuggestedSubMode(nextSubMode);
      }
      if (pacingValue !== nextPacingValue) {
        setPacingValue(nextPacingValue);
      }

      const desiredQuickControls = {
        autoEdit: true,
        highlightReel: true,
        speedRamp: isRuthless,
        musicSync: true,
      } as const;

      (Object.keys(desiredQuickControls) as Array<keyof typeof desiredQuickControls>).forEach((key) => {
        if (quickControls[key] !== desiredQuickControls[key]) {
          toggleQuickControl(key);
        }
      });

      if (isRuthless && captionMode !== "ai") {
        setCaptionMode("ai");
      }
      if (isRuthless && audioOption !== "auto_sync_tracks") {
        setAudioOption("auto_sync_tracks");
      }
    },
    [
      audioOption,
      autoDetectBestMoments,
      captionMode,
      mode,
      pacingValue,
      quickControls,
      retentionStrategyMode,
      setAudioOption,
      setAutoDetectBestMoments,
      setCaptionMode,
      setPacingValue,
      setRetentionStrategyMode,
      setSuggestedSubMode,
      suggestedSubMode,
      toggleQuickControl,
    ],
  );

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
      captionEffect,
      zoomEffect: getZoomEffect(quickControls.speedRamp, mode),
      audioOption,
      suggestedSubMode,
      verticalWebcamEnabled: mode === "vertical" ? verticalWebcamEnabled : false,
      verticalWebcamLayout,
      captionOutlineEnabled,
      captionDropShadowEnabled,
    };
  }, [
    audioOption,
    autoDetectBestMoments,
    captionDropShadowEnabled,
    captionEffect,
    captionFont,
    captionMode,
    captionOutlineEnabled,
    captionStyle,
    captionsEnabled,
    formatPreset,
    manualSegments,
    mode,
    pacingValue,
    quickControls,
    stylePreset,
    suggestedSubMode,
    verticalWebcamEnabled,
    verticalWebcamLayout,
    videoId,
    vibeChip,
  ]);

  const routeWithCurrentQuery = useCallback(
    (basePath: string) => {
      const query = searchParams.toString();
      return query ? `${basePath}?${query}` : basePath;
    },
    [searchParams],
  );

  const syncEditorRouteForMode = useCallback(
    (nextMode: RenderMode) => {
      const target = nextMode === "vertical" ? "/editor/vertical" : "/editor";
      if (location.pathname === target) return;
      navigate(routeWithCurrentQuery(target), { replace: true });
    },
    [location.pathname, navigate, routeWithCurrentQuery],
  );

  useEffect(() => {
    if (!videoId || !mode) return;
    if (verticalModeExperience && mode !== "vertical") return;
    syncEditorRouteForMode(mode);
  }, [mode, syncEditorRouteForMode, verticalModeExperience, videoId]);

  useEffect(() => {
    if (!verticalModeExperience || !videoId || mode === "vertical") return;
    setMode("vertical", true);
    setSuggestedSubMode("highlight_mode");
  }, [mode, setMode, setSuggestedSubMode, verticalModeExperience, videoId]);

  const fetchDetailedJob = useCallback(
    async (jobId: string) => {
      if (!accessToken) {
        throw new ApiError("Sign in required.", 401, "unauthorized");
      }
      const result = await fetchJobByIdApi(accessToken, jobId);
      const normalized = normalizeRenderJobUrls(result);
      setJobResultCache((prev) => ({ ...prev, [jobId]: normalized }));
      return normalized;
    },
    [accessToken],
  );

  const triggerExportDownload = useCallback((url: string) => {
    const safeUrl = resolveApiMediaUrl(url);
    if (!safeUrl) return;
    const anchor = document.createElement("a");
    anchor.href = safeUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const handleOpenJob = useCallback(
    async (jobId: string) => {
      setActivePipelineJobId(jobId);
      setJobActionPendingId(jobId);
      try {
        const detail = jobResultCache[jobId] || (await fetchDetailedJob(jobId));
        if (detail.status === "completed") {
          setLatestResult(detail);
          setSuccessModalOpen(true);
          setRetentionExpanded(false);
          toast({ title: "Loaded render", description: "Opened the selected completed job." });
          return;
        }
        const isStillRunning = detail.status === "queued" || detail.status === "processing";
        setRenderState({
          rendering: isStillRunning,
          jobId: detail.jobId,
          progress: toProgressPercent(detail.progress),
        });
        toast({
          title: "Job synced",
          description: isStillRunning
            ? `${statusLabel(detail.status)} • ${toProgressPercent(detail.progress)}%`
            : "Job status refreshed.",
        });
      } catch (error: any) {
        const message = error instanceof ApiError ? error.message : "Could not open this job.";
        setErrorMessage(message);
      } finally {
        setJobActionPendingId((current) => (current === jobId ? null : current));
      }
    },
    [
      fetchDetailedJob,
      jobResultCache,
      setErrorMessage,
      setLatestResult,
      setRenderState,
      setRetentionExpanded,
      setSuccessModalOpen,
      toast,
    ],
  );

  const handleExportJob = useCallback(
    async (jobId: string) => {
      setActivePipelineJobId(jobId);
      setJobActionPendingId(jobId);
      try {
        const detail = jobResultCache[jobId] || (await fetchDetailedJob(jobId));
        if (detail.status !== "completed") {
          toast({ title: "Export not ready", description: "This job is still processing." });
          return;
        }
        const exportUrl = resolveApiMediaUrl(detail.outputVideoUrl || detail.clipUrls?.[0] || "");
        if (!exportUrl) {
          setErrorMessage("No export file was found for this job.");
          return;
        }
        triggerExportDownload(exportUrl);
      } catch (error: any) {
        const message = error instanceof ApiError ? error.message : "Could not export this job.";
        setErrorMessage(message);
      } finally {
        setJobActionPendingId((current) => (current === jobId ? null : current));
      }
    },
    [fetchDetailedJob, jobResultCache, setErrorMessage, toast, triggerExportDownload],
  );

  const activePipelineJob = useMemo(() => {
    const preferredJobId = activePipelineJobId || renderJobId || latestResult?.jobId || recentJobs[0]?.id || null;
    if (!preferredJobId) return null;

    const recent = recentJobs.find((job) => job.id === preferredJobId);
    const cached = jobResultCache[preferredJobId];
    const isActiveLiveJob = renderJobId === preferredJobId && isRendering;
    const status = cached?.status || recent?.status || (isActiveLiveJob ? "processing" : "queued");
    const progress = isActiveLiveJob
      ? renderProgress
      : cached?.progress ?? recent?.progress ?? (status === "completed" ? 100 : 0);

    return {
      id: preferredJobId,
      status,
      progress: toProgressPercent(progress),
      fileName: recent?.fileName || fileName || "Render Job",
      mode: (recent?.mode || cached?.mode || mode || "horizontal") as RenderMode,
      createdAt: recent?.createdAt || null,
    };
  }, [
    activePipelineJobId,
    fileName,
    isRendering,
    jobResultCache,
    latestResult?.jobId,
    mode,
    recentJobs,
    renderJobId,
    renderProgress,
  ]);

  const activePipelineStageIndex = useMemo(() => {
    if (!activePipelineJob) return 0;
    return getPipelineStageIndex(activePipelineJob.status, activePipelineJob.progress);
  }, [activePipelineJob]);

  const activePipelineStage = useMemo(() => {
    return PIPELINE_STAGES[activePipelineStageIndex] || PIPELINE_STAGES[0];
  }, [activePipelineStageIndex]);

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
    if (!requestedJobId) {
      handledRequestedJobIdRef.current = null;
      return;
    }
    if (!accessToken) return;
    if (handledRequestedJobIdRef.current === requestedJobId) return;
    handledRequestedJobIdRef.current = requestedJobId;

    setActivePipelineJobId(requestedJobId);
    setJobActionPendingId(requestedJobId);
    void (async () => {
      try {
        const detail = jobResultCache[requestedJobId] || (await fetchDetailedJob(requestedJobId));
        if (detail.status === "completed") {
          setLatestResult(detail);
          setSuccessModalOpen(true);
          setRetentionExpanded(false);
        } else {
          const isStillRunning = detail.status === "queued" || detail.status === "processing";
          setRenderState({
            rendering: isStillRunning,
            jobId: detail.jobId,
            progress: toProgressPercent(detail.progress),
          });
        }
      } catch (error: any) {
        const message = error instanceof ApiError ? error.message : "Could not load requested job.";
        setErrorMessage(message);
      } finally {
        setJobActionPendingId((current) => (current === requestedJobId ? null : current));
      }
    })();
  }, [
    accessToken,
    fetchDetailedJob,
    jobResultCache,
    requestedJobId,
    setErrorMessage,
    setLatestResult,
    setRenderState,
    setRetentionExpanded,
    setSuccessModalOpen,
  ]);

  useEffect(() => {
    if (renderJobId) {
      setActivePipelineJobId(renderJobId);
      return;
    }

    if (latestResult?.jobId && !activePipelineJobId) {
      setActivePipelineJobId(latestResult.jobId);
      return;
    }

    if (!activePipelineJobId && recentJobs[0]?.id) {
      setActivePipelineJobId(recentJobs[0].id);
      return;
    }

    if (
      activePipelineJobId &&
      activePipelineJobId !== latestResult?.jobId &&
      !recentJobs.some((job) => job.id === activePipelineJobId)
    ) {
      setActivePipelineJobId(recentJobs[0]?.id || null);
    }
  }, [activePipelineJobId, latestResult?.jobId, recentJobs, renderJobId]);

  useEffect(() => {
    const shouldRevealEditorSettings =
      flowStep === "mode_selection" || flowStep === "settings" || flowStep === "rendering" || flowStep === "post_render";
    if (!shouldRevealEditorSettings) {
      if (revealedSectionCount !== 0) {
        setRevealedSectionCount(0);
      }
      return;
    }
    if (shouldReduceMotion || isRendering) {
      const fullyRevealedCount = SECTION_REVEAL_ORDER.length;
      if (revealedSectionCount !== fullyRevealedCount) {
        setRevealedSectionCount(fullyRevealedCount);
      }
      return;
    }
    const timers: number[] = [];
    SECTION_REVEAL_ORDER.forEach((_, index) => {
      const timer = window.setTimeout(() => setRevealedSectionCount(index + 1), 110 + index * 140);
      timers.push(timer);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [flowStep, isRendering, revealedSectionCount, setRevealedSectionCount, shouldReduceMotion]);

  useEffect(() => {
    if (!recentDrawerOpen) {
      clearRecentDrawerTimer();
      return;
    }

    const bumpRecentDrawerInactivity = () => {
      markRecentInteraction();
      clearRecentDrawerTimer();
      recentDrawerTimeoutRef.current = window.setTimeout(() => {
        setRecentDrawerOpen(false);
      }, RECENT_DRAWER_CONFIG.timeoutMs);
    };

    bumpRecentDrawerInactivity();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
    events.forEach((name) => window.addEventListener(name, bumpRecentDrawerInactivity, { passive: true }));

    return () => {
      events.forEach((name) => window.removeEventListener(name, bumpRecentDrawerInactivity));
      clearRecentDrawerTimer();
    };
  }, [clearRecentDrawerTimer, markRecentInteraction, recentDrawerOpen, setRecentDrawerOpen]);

  useEffect(() => {
    if (!accessToken || !renderJobId || !isRendering) return;

    let cancelled = false;
    let inFlight = false;
    let pollTimer: number | null = null;

    const scheduleNextPoll = () => {
      if (cancelled) return;
      const delayMs = isPageVisible ? RENDER_POLL_INTERVAL_FOREGROUND_MS : RENDER_POLL_INTERVAL_BACKGROUND_MS;
      pollTimer = window.setTimeout(() => void tick(), delayMs);
    };

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      let keepPolling = true;
      try {
        const job = normalizeRenderJobUrls(await fetchJobByIdApi(accessToken, renderJobId));
        if (cancelled) return;
        setJobResultCache((prev) => ({ ...prev, [job.jobId]: job }));
        const progress = toProgressPercent(job.progress);
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
          keepPolling = false;
        }

        if (job.status === "failed") {
          setRenderState({ rendering: false, progress: 0, jobId: null });
          setErrorMessage(job.errorMessage || "Render failed. Please retry with adjusted settings.");
          keepPolling = false;
        }
      } catch {
        // ignore
      } finally {
        inFlight = false;
        if (keepPolling) {
          scheduleNextPoll();
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [
    accessToken,
    fetchRecentJobs,
    isPageVisible,
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

    clearUploadStatusTimer();
    setUploadingFileName(file.name || "video");
    setUploadStatus("uploading");
    uploadStatusTimeoutRef.current = window.setTimeout(() => {
      setUploadStatus((current) => (current === "uploading" ? "analyzing" : current));
      uploadStatusTimeoutRef.current = null;
    }, 900);
    setUploadAnalyzing(true);
    setErrorMessage(null);
    setSuccessModalOpen(false);
    setRetentionExpanded(false);
    setLatestResult(null);
    clearRecentDrawerTimer();
    setRecentDrawerOpen(false);
    setActivePipelineJobId(null);
    setJobResultCache({});

    try {
      const payload = await uploadAnalyze({ file, token: accessToken });
      const forceStandardSubMode =
        Number(payload.metadata?.duration || 0) >= 180 &&
        Number(payload.metadata?.width || 0) > Number(payload.metadata?.height || 0) * 1.08;
      clearUploadStatusTimer();
      setUploadStatus("analyzing");
      await wait(260);
      setUploadStatus("applying");
      setUploadAnalysis(payload);
      setSuggestedSubMode(
        forceStandardSubMode
          ? "standard_mode"
          : payload.autoDetection.editorProfile?.suggestedSubMode ||
              payload.autoDetection.suggestedSubMode ||
              (payload.autoDetection.finalMode === "vertical" ? "highlight_mode" : "standard_mode"),
      );
      await wait(520);
      toast({ title: "Auto-detection ready", description: payload.autoDetection.bannerMessage });
      void fetchRecentJobs();
    } catch (error: any) {
      clearUploadStatusTimer();
      setUploadStatus("failed");
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error && error.message
            ? error.message
            : "Upload analysis failed.";
      setErrorMessage(message);
      await wait(320);
    } finally {
      clearUploadStatusTimer();
      setUploadAnalyzing(false);
      setUploadStatus("idle");
      setUploadingFileName("");
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
    setActivePipelineJobId(null);
    setJobResultCache({});

    try {
      const response = await apiFetch<{ jobId: string; status: string; progress: number }>("/api/vibecut/render", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify(renderPayload),
      });
      setRenderState({ rendering: true, progress: response.progress || 10, jobId: response.jobId });
      setActivePipelineJobId(response.jobId);
      toast({ title: "Render started", description: "Retention-first pipeline is running." });
      void fetchRecentJobs();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Could not start render.";
      setRenderState({ rendering: false, progress: 0, jobId: null });
      setErrorMessage(message);
    }
  };

  const handleAutoModeToggle = (value: boolean) => {
    setAutoModeEnabled(value);
    if (value && autoDetection?.finalMode) {
      const forceHorizontalMode =
        Number(duration || 0) >= 180 && autoDetection.metadataMode === "horizontal";
      const resolvedMode = forceHorizontalMode ? "horizontal" : autoDetection.finalMode;
      setMode(resolvedMode, false);
      if (retentionStrategyMode === "ruthless") {
        applyRetentionStrategyPreset("ruthless", resolvedMode);
      } else {
        setSuggestedSubMode(
          forceHorizontalMode
            ? "standard_mode"
            : autoDetection.editorProfile?.suggestedSubMode || autoDetection.suggestedSubMode,
        );
      }
    }
  };

  const handleModeSelect = (nextMode: RenderMode) => {
    setMode(nextMode, true);
    applyRetentionStrategyPreset(retentionStrategyMode, nextMode);
    syncEditorRouteForMode(nextMode);
  };

  const handleRetentionStrategySelect = (nextStrategy: RetentionStrategyMode) => {
    applyRetentionStrategyPreset(nextStrategy, mode || autoDetection?.finalMode || "horizontal");
  };

  const resetEverything = () => {
    clearUploadStatusTimer();
    clearRecentDrawerTimer();
    setUploadStatus("idle");
    setRecentDrawerOpen(false);
    setActivePipelineJobId(null);
    setJobResultCache({});
    setJobActionPendingId(null);
    setUploadingFileName("");
    resetSession();
    setFileInputKey((value) => value + 1);
  };

  const hasCompletedResult = Boolean(latestResult && latestResult.status === "completed" && !isRendering);
  const showExpandedSettings =
    flowStep === "mode_selection" || flowStep === "settings" || flowStep === "rendering" || flowStep === "post_render";

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">Retention Target</p>
        <p className="mt-2 text-sm text-slate-300">
          Goal: <span className="font-semibold text-[#f6da8a]">70%+ predicted average retention</span>.
        </p>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-xs text-slate-300">
          All AI edits prioritize hook strength, drop-risk recovery, dynamic pacing, and emotional arc.
        </div>
      </PremiumCard>
      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-[var(--gold-accent)]">
          <Workflow className="h-3.5 w-3.5" />
          Pipeline Watch
        </p>
        {activePipelineJob ? (
          <>
            <p className="mt-2 text-sm text-slate-200">{activePipelineJob.fileName || "Render job"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {modeLabel(activePipelineJob.mode)} • {statusLabel(activePipelineJob.status)}
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3">
              <p className="text-xs text-slate-300">{activePipelineStage.detail}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                <span>{activePipelineStage.label}</span>
                <span>{activePipelineJob.progress}%</span>
              </div>
              <MetallicProgress value={activePipelineJob.progress} className="mt-2 h-2" />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-300">Start a render to see live pipeline stage tracking here.</p>
        )}
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Studio" rightRail={rightRail} showSidebar>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-100">Retention-First Editor</h1>
                <VIPBadge label="Elite Studio" />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Optimize every cut, caption, and effect for maximum watch-through.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {recentJobs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setRecentDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm text-slate-200 hover:border-[rgba(212,175,55,0.36)]"
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

        <SettingsCardGroup
          title="Editor Pipeline + Jobs"
          description="Track each pipeline stage and jump between different renders without leaving this page."
          badgeLabel="Premium Only"
        >
          <div className="relative overflow-hidden rounded-[26px] border border-[rgba(212,175,55,0.28)] bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.2),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(192,132,252,0.16),transparent_56%),linear-gradient(140deg,rgba(8,11,19,0.97),rgba(6,8,14,0.93))] p-4">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.24)] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 left-0 h-28 w-1/2 bg-gradient-to-r from-[rgba(192,132,252,0.2)] to-transparent" />

            <div className="relative flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--gold-accent)]">Pipeline Deck</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-100">
                  {activePipelineJob?.fileName || "No active job selected"}
                </p>
                <p className="mt-1 text-xs text-slate-300/85">
                  {activePipelineJob
                    ? `${modeLabel(activePipelineJob.mode)} • ${
                        activePipelineJob.createdAt ? new Date(activePipelineJob.createdAt).toLocaleString() : "Live pipeline"
                      }`
                    : "Run a render to populate pipeline stages and export actions."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[rgba(212,175,55,0.32)] bg-[rgba(212,175,55,0.12)] px-2.5 py-1 text-[11px] text-[#f6da8a]">
                  Stage: {activePipelineStage.label}
                </span>
                {activePipelineJob ? (
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] ${statusBadgeClass(activePipelineJob.status)}`}
                  >
                    {statusLabel(activePipelineJob.status)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                7-stage processing
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Live progress sync
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Multi-job focus
              </span>
            </div>

            <div className="relative mt-3 grid gap-2 md:grid-cols-7">
              {PIPELINE_STAGES.map((stage, index) => {
                const done = activePipelineJob ? index < activePipelineStageIndex : false;
                const active = activePipelineJob ? index === activePipelineStageIndex : index === 0;
                return (
                  <div
                    key={stage.key}
                    className={`rounded-2xl border px-2.5 py-2.5 transition ${
                      done
                        ? "border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.16)] text-[#f6da8a]"
                        : active
                          ? "border-[rgba(212,175,55,0.45)] bg-gradient-to-r from-[rgba(212,175,55,0.2)] to-[rgba(192,132,252,0.16)] text-[#f6da8a]"
                          : "border-white/10 bg-white/[0.04] text-slate-400"
                    }`}
                  >
                    <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em]">
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <span
                          className={`h-2.5 w-2.5 rounded-full border ${
                            active ? "border-[rgba(212,175,55,0.85)] bg-[rgba(212,175,55,0.72)]" : "border-white/35 bg-transparent"
                          }`}
                        />
                      )}
                      {stage.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {activePipelineJob ? (
              <div className="mt-3 rounded-2xl border border-[rgba(212,175,55,0.34)] bg-gradient-to-r from-[rgba(212,175,55,0.14)] via-[rgba(192,132,252,0.1)] to-slate-900/60 px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-200">
                  <span>{activePipelineStage.detail}</span>
                  <span>{toProgressPercent(activePipelineJob.progress)}%</span>
                </div>
                <MetallicProgress value={toProgressPercent(activePipelineJob.progress)} className="h-2" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            {recentJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[rgba(212,175,55,0.3)] bg-gradient-to-br from-[rgba(212,175,55,0.12)] to-[rgba(192,132,252,0.08)] px-4 py-6 text-sm text-slate-300">
                No jobs yet. Upload and render a clip to start tracking.
              </div>
            ) : (
              recentJobs.slice(0, 6).map((job) => {
                const isSelected = activePipelineJob?.id === job.id;
                const isBusy = jobActionPendingId === job.id;
                return (
                  <article
                    key={job.id}
                    className={`rounded-2xl border px-3 py-3 transition ${
                      isSelected
                        ? "border-[rgba(212,175,55,0.4)] bg-[linear-gradient(145deg,rgba(212,175,55,0.18),rgba(192,132,252,0.16))]"
                        : "border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] hover:border-[rgba(212,175,55,0.35)] hover:bg-[linear-gradient(155deg,rgba(212,175,55,0.12),rgba(255,255,255,0.03))]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{job.fileName || "Untitled render"}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock3 className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleString()} • {modeLabel(job.mode)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[11px] ${statusBadgeClass(job.status)}`}>
                          {statusLabel(job.status)}
                        </span>
                        <span className="text-xs text-slate-300">{toProgressPercent(job.progress)}%</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePipelineJobId(job.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-[rgba(212,175,55,0.4)] bg-gradient-to-r from-[rgba(212,175,55,0.22)] to-[rgba(192,132,252,0.2)] px-3 py-1.5 text-xs text-[#f6da8a] hover:border-[rgba(212,175,55,0.65)]"
                      >
                        <Workflow className="h-3.5 w-3.5" />
                        Focus Pipeline
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleOpenJob(job.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-slate-200 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        {job.status === "completed" ? "Open Result" : "Track Job"}
                      </button>
                      {job.status === "completed" ? (
                        <button
                          type="button"
                          onClick={() => void handleExportJob(job.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:border-emerald-300/50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          Export
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </SettingsCardGroup>

        <SettingsCardGroup title="Upload Video" description="Upload your source clip to start AI analysis and profile setup." badgeLabel="Exclusive Feature">
          <div className="relative overflow-hidden rounded-[26px] border border-[rgba(212,175,55,0.26)] bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_48%),linear-gradient(140deg,rgba(11,15,26,0.96),rgba(7,10,18,0.92))] p-4">
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.22)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-1/2 bg-gradient-to-r from-[rgba(192,132,252,0.12)] to-transparent" />

            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--gold-accent)]">Upload Gateway</p>
                <p className="mt-1 text-sm font-medium text-slate-100">Drop in footage and prep your timeline instantly.</p>
                <p className="mt-1 text-xs text-slate-300/85">Supports MP4, MOV, MKV with metadata scan and retention profiling.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={uploadInputId}
                  key={fileInputKey}
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-matroska"
                  onChange={handleUploadChange}
                  disabled={isAnalyzingUpload}
                  className="sr-only"
                />
                <label
                  htmlFor={uploadInputId}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                    isAnalyzingUpload
                      ? "cursor-not-allowed border-white/15 bg-white/5 text-slate-400"
                      : "cursor-pointer border-[rgba(212,175,55,0.45)] bg-gradient-to-r from-[rgba(212,175,55,0.3)] to-[rgba(192,132,252,0.25)] text-white hover:border-[rgba(212,175,55,0.72)] hover:brightness-110"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {isAnalyzingUpload ? "Processing..." : "Choose Video"}
                </label>
              </div>
            </div>

            <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Metadata extract
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Scene analysis
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Smart edit profile
              </span>
            </div>
          </div>

          {isAnalyzingUpload ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
              className="mt-3 rounded-2xl border border-[rgba(212,175,55,0.34)] bg-gradient-to-b from-[rgba(212,175,55,0.12)] to-slate-900/45 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-100">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--gold-accent)]" />
                  {currentUploadStatusText}
                </p>
                <span className="text-xs font-medium text-[#f6da8a]">{Math.round(uploadStatusProgress)}%</span>
              </div>

              <MetallicProgress value={uploadStatusProgress} className="mt-3 h-2" />

              <div className="mt-3 space-y-2">
                {UPLOAD_STATUS_STEPS.map((step, index) => {
                  const isComplete = index < uploadStatusIndex;
                  const isActive = index === uploadStatusIndex;
                  const textClass = isComplete ? "text-emerald-200" : isActive ? "text-slate-100" : "text-slate-400";

                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 transition ${
                        isComplete
                          ? "border-emerald-300/30 bg-emerald-500/10"
                          : isActive
                            ? "border-[rgba(212,175,55,0.34)] bg-[rgba(212,175,55,0.12)]"
                            : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                      ) : isActive ? (
                        <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[var(--gold-accent)]" />
                      ) : (
                        <span className="mt-1 h-2.5 w-2.5 rounded-full border border-white/35 bg-transparent" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${textClass}`}>{step.title}</p>
                        <p className="text-xs text-slate-400">{step.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : null}

          {videoId ? (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {fileName || "Uploaded clip"} {duration ? `• ${Math.round(duration)}s` : ""}
              </span>
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
            {verticalModeExperience ? (
              <SettingsCardGroup
                title="Vertical Mode Studio"
                description="Dedicated short-form workspace with webcam layering, subtitle controls, and TikTok/Reels-ready styling."
              >
                <VerticalModeToolkit
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
                  webcamEnabled={verticalWebcamEnabled}
                  onWebcamEnabledChange={setVerticalWebcamEnabled}
                  webcamLayout={verticalWebcamLayout}
                  onWebcamLayoutChange={setVerticalWebcamLayout}
                  captionOutlineEnabled={captionOutlineEnabled}
                  onCaptionOutlineEnabledChange={setCaptionOutlineEnabled}
                  captionDropShadowEnabled={captionDropShadowEnabled}
                  onCaptionDropShadowEnabledChange={setCaptionDropShadowEnabled}
                />
              </SettingsCardGroup>
            ) : null}

            <SettingsCardGroup
              title="Quick Tools"
              description="Apply high-level editing tools before detailed tuning."
              rightSlot={
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(212,175,55,0.36)] bg-[rgba(212,175,55,0.14)] px-2 py-1 text-[11px] text-[#f6da8a]">
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
                          ? "border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.16)] text-slate-100"
                          : "border-white/10 bg-black/35 text-slate-300 hover:border-[rgba(212,175,55,0.35)]"
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

            <SettingsCardGroup
              title="Retention Script Mode"
              description="Choose how aggressive the ruthless retention script should be when scoring hooks and pacing decisions."
            >
              <AccentPillToggle
                value={retentionStrategyMode}
                onChange={(value) => handleRetentionStrategySelect(value)}
                options={RETENTION_STRATEGY_OPTIONS}
                className="mx-auto"
              />
              <p className="mt-2 text-center text-xs text-slate-300">
                {retentionStrategyMode === "ruthless"
                  ? "Ruthless mode locks high-impact cuts, stronger opener bias, and aggressive pacing."
                  : "Balanced mode keeps retention optimizations while preserving smoother narrative flow."}
              </p>
            </SettingsCardGroup>

            {showExpandedSettings ? (
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeInOut" }}
                className="space-y-4"
              >
                <SettingsCardGroup
                  title="Editor Settings"
                  description="Tune format, style, pacing, captions, and audio behavior."
                  className="p-4"
                >
                  <StaggeredSettingsSections
                    disableMotion={Boolean(shouldReduceMotion)}
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

                <SettingsCardGroup title="Render" description="Start the render pipeline with your selected settings." badgeLabel="VIP Render Queue">
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
                        <ExclusiveToggle checked={autoDetectBestMoments} onCheckedChange={setAutoDetectBestMoments} />
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
                      <MetallicProgress value={renderProgress} className="h-2" />
                      <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--gold-accent)]" />
                        Edits are being applied to your timeline.
                      </p>
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
