import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Gauge, Maximize2, MousePointer2, Pause, Play, Scissors, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";

import "./manual-timestamp-editor.css";

export type ManualMarkerType = "keep" | "remove" | "hook";
export type ManualMarkerSource = "user" | "ai";

export type ManualTimestampMarker = {
  id: string;
  type: ManualMarkerType;
  start: number;
  end: number;
  source: ManualMarkerSource;
  rationale?: string;
};

export type ManualTimestampSuggestion = {
  id: string;
  type: "hook" | "remove" | "cut";
  start: number;
  end: number;
  rationale: string;
  source: "ai";
};

type DragBoundary = "start" | "end";
type RetentionAreaLevel = "best" | "weak" | "low";
type TimelineInteractionMode = "select" | "seek";

type ManualTimestampEditorProps = {
  markers: ManualTimestampMarker[];
  suggestions: ManualTimestampSuggestion[];
  durationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  playbackRate: number;
  autoAssist: boolean;
  aiSuggestLoading: boolean;
  manualRetentionDelta: number | null;
  aiRetentionDelta: number | null;
  removeRatio: number;
  microHookSuggestions: Array<{ start: number; end: number }>;
  warning: string | null;
  beforeEditUrl?: string;
  editedUrl: string;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onPlaybackRateChange: (next: number) => void;
  onAutoAssistChange: (next: boolean) => void;
  onRequestAiSuggest: () => void;
  onClearAll: () => void;
  onMarkersChange: (markers: ManualTimestampMarker[]) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onApplyAllSuggestions: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatTimelineTime = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(2).padStart(5, "0")}`;
};

const rangeClassByType: Record<ManualMarkerType, string> = {
  keep: "manual-editor-range--keep",
  remove: "manual-editor-range--remove",
  hook: "manual-editor-range--hook",
};

const markerBadgeClassByType: Record<ManualMarkerType, string> = {
  keep: "border-emerald-300/45 bg-emerald-500/14 text-emerald-100",
  remove: "border-rose-300/45 bg-rose-500/14 text-rose-100",
  hook: "border-cyan-300/45 bg-cyan-500/14 text-cyan-100",
};

const suggestionBadgeClassByType: Record<ManualTimestampSuggestion["type"], string> = {
  cut: "border-emerald-300/45 bg-emerald-500/12 text-emerald-100",
  remove: "border-rose-300/45 bg-rose-500/12 text-rose-100",
  hook: "border-cyan-300/45 bg-cyan-500/12 text-cyan-100",
};

const labelByType: Record<ManualMarkerType, string> = {
  keep: "Keep",
  remove: "Remove",
  hook: "Hook",
};

const toolHintByType: Record<ManualMarkerType, string> = {
  keep: "Mark the moments that must stay in the final edit.",
  remove: "Mark low-energy moments that should be cut.",
  hook: "Mark the opener window that should lead the video.",
};

type RetentionArea = {
  id: string;
  start: number;
  end: number;
  score: number;
  level: RetentionAreaLevel;
  reason: string;
};

const retentionAreaBadgeClassByLevel: Record<RetentionAreaLevel, string> = {
  best: "border-emerald-300/40 bg-emerald-500/14 text-emerald-100",
  weak: "border-amber-300/45 bg-amber-500/12 text-amber-100",
  low: "border-rose-300/45 bg-rose-500/12 text-rose-100",
};

const overlapDuration = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const formatRange = (start: number, end: number) => `${formatTimelineTime(start)}-${formatTimelineTime(end)}`;

const isTextEntryTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
};

const PLAYBACK_RATE_OPTIONS = [1, 1.25, 1.5, 2] as const;
const FRAME_STEP_SECONDS = 1 / 30;
const TIMELINE_ZOOM_MIN = 1;
const TIMELINE_ZOOM_MAX = 20;
const TIMELINE_ZOOM_STEP = 0.1;
const TIMELINE_ZOOM_DEFAULT = 1.5;

const ManualTimestampEditor = ({
  markers,
  suggestions,
  durationSec,
  currentTimeSec,
  isPlaying,
  playbackRate,
  autoAssist,
  aiSuggestLoading,
  manualRetentionDelta,
  aiRetentionDelta,
  removeRatio,
  microHookSuggestions,
  warning,
  beforeEditUrl = "",
  editedUrl,
  onTogglePlay,
  onSeek,
  onPlaybackRateChange,
  onAutoAssistChange,
  onRequestAiSuggest,
  onClearAll,
  onMarkersChange,
  onAcceptSuggestion,
  onRejectSuggestion,
  onApplyAllSuggestions,
  onSave,
  saveDisabled,
  saving,
  hasUnsavedChanges,
}: ManualTimestampEditorProps) => {
  const [pendingMarker, setPendingMarker] = useState<{ type: ManualMarkerType; start: number } | null>(null);
  const [activeTool, setActiveTool] = useState<ManualMarkerType>("remove");
  const [timelineMode, setTimelineMode] = useState<TimelineInteractionMode>("select");
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [liveMonitorMuted, setLiveMonitorMuted] = useState(true);
  const [beforeMonitorReady, setBeforeMonitorReady] = useState(false);
  const [beforeMonitorErrored, setBeforeMonitorErrored] = useState(false);
  const [liveMonitorReady, setLiveMonitorReady] = useState(false);
  const [liveMonitorErrored, setLiveMonitorErrored] = useState(false);
  const [dragState, setDragState] = useState<{ id: string; boundary: DragBoundary } | null>(null);
  const timelineInnerRef = useRef<HTMLDivElement | null>(null);
  const beforeMonitorVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveMonitorVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveMonitorFrameRef = useRef<HTMLDivElement | null>(null);
  const scrubDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrubSeekRef = useRef<number | null>(null);

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.start - b.start || a.end - b.end),
    [markers],
  );

  const markerCounts = useMemo(
    () =>
      sortedMarkers.reduce(
        (acc, marker) => {
          acc[marker.type] += 1;
          return acc;
        },
        { keep: 0, remove: 0, hook: 0 } as Record<ManualMarkerType, number>,
      ),
    [sortedMarkers],
  );

  const markedDuration = useMemo(
    () => sortedMarkers.reduce((total, marker) => total + Math.max(0, marker.end - marker.start), 0),
    [sortedMarkers],
  );

  useEffect(() => {
    const syncVideo = (video: HTMLVideoElement | null, muted: boolean) => {
      if (!video) return;
      try {
        if (Number.isFinite(currentTimeSec) && Math.abs(video.currentTime - currentTimeSec) > 0.05) {
          video.currentTime = currentTimeSec;
        }
      } catch (_error) {
        // ignore drift updates for preview-only monitor.
      }
      if (Math.abs(video.playbackRate - playbackRate) > 0.001) {
        video.playbackRate = playbackRate;
      }
      if (video.muted !== muted) {
        video.muted = muted;
      }
      if (isPlaying) {
        void video.play().catch(() => undefined);
        return;
      }
      video.pause();
    };

    syncVideo(beforeMonitorVideoRef.current, true);
    syncVideo(liveMonitorVideoRef.current, liveMonitorMuted);
  }, [beforeMonitorReady, currentTimeSec, isPlaying, liveMonitorMuted, liveMonitorReady, playbackRate]);

  useEffect(() => {
    setBeforeMonitorReady(false);
    setBeforeMonitorErrored(false);
    setLiveMonitorReady(false);
    setLiveMonitorErrored(false);
  }, [beforeEditUrl, editedUrl]);

  useEffect(() => () => {
    if (scrubDebounceTimerRef.current) {
      clearTimeout(scrubDebounceTimerRef.current);
      scrubDebounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const onMove = (event: PointerEvent) => {
      if (!timelineInnerRef.current || durationSec <= 0) return;
      const rect = timelineInnerRef.current.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const nextTime = Number((ratio * durationSec).toFixed(3));
      onMarkersChange(markers.map((marker) => {
        if (marker.id !== dragState.id) return marker;
        if (dragState.boundary === "start") {
          const start = clamp(nextTime, 0, marker.end - 0.05);
          return { ...marker, start: Number(start.toFixed(3)) };
        }
        const end = clamp(nextTime, marker.start + 0.05, durationSec);
        return { ...marker, end: Number(end.toFixed(3)) };
      }));
    };
    const onEnd = () => setDragState(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [dragState, durationSec, markers, onMarkersChange]);

  const flushScrubSeek = useCallback((explicitSeconds?: number) => {
    const nextRaw = typeof explicitSeconds === "number" ? explicitSeconds : pendingScrubSeekRef.current;
    if (nextRaw === null || nextRaw === undefined || !Number.isFinite(nextRaw)) return;
    const next = clamp(Number(nextRaw), 0, durationSec);
    pendingScrubSeekRef.current = null;
    onSeek(Number(next.toFixed(3)));
  }, [durationSec, onSeek]);

  const scheduleScrubSeek = useCallback((seconds: number) => {
    pendingScrubSeekRef.current = clamp(Number(seconds), 0, durationSec);
    if (scrubDebounceTimerRef.current) return;
    scrubDebounceTimerRef.current = setTimeout(() => {
      scrubDebounceTimerRef.current = null;
      flushScrubSeek();
    }, 18);
  }, [durationSec, flushScrubSeek]);

  const handleMonitorPaneSeek = useCallback((clientX: number, pane: HTMLDivElement | null) => {
    if (!pane || durationSec <= 0) return;
    const rect = pane.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const targetTime = Number((ratio * durationSec).toFixed(3));
    flushScrubSeek(targetTime);
  }, [durationSec, flushScrubSeek]);

  const addMarker = useCallback((type: ManualMarkerType, startTime: number, endTime: number) => {
    if (durationSec <= 0) return;
    const safeMaxStart = Math.max(0, durationSec - 0.05);
    const start = clamp(Math.min(startTime, endTime), 0, safeMaxStart);
    const end = clamp(Math.max(startTime, endTime, start + 0.05), start + 0.05, durationSec);
    const marker: ManualTimestampMarker = {
      id: `${type}_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      type,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      source: "user",
    };
    onMarkersChange([...markers, marker]);
  }, [durationSec, markers, onMarkersChange]);

  const createMarker = useCallback((type: ManualMarkerType, anchorTime: number) => {
    if (durationSec <= 0) return;
    const clampedAnchor = clamp(anchorTime, 0, durationSec);
    if (!pendingMarker || pendingMarker.type !== type) {
      setPendingMarker({ type, start: clampedAnchor });
      return;
    }
    addMarker(type, pendingMarker.start, clampedAnchor);
    setPendingMarker(null);
  }, [addMarker, durationSec, pendingMarker]);

  const clearPendingMarker = useCallback(() => {
    setPendingMarker(null);
  }, []);

  const setActiveToolAndSelect = useCallback((tool: ManualMarkerType) => {
    setActiveTool(tool);
    setTimelineMode("select");
  }, []);

  const activateSelectorMode = useCallback(() => {
    setTimelineMode("select");
  }, []);

  const activateSeekMode = useCallback(() => {
    setTimelineMode("seek");
    clearPendingMarker();
  }, [clearPendingMarker]);

  const removeMarker = useCallback((id: string) => {
    onMarkersChange(markers.filter((marker) => marker.id !== id));
  }, [markers, onMarkersChange]);

  const handleLiveMonitorMuteToggle = useCallback(() => {
    setLiveMonitorMuted((prev) => !prev);
  }, []);

  const handleLiveMonitorPopOut = useCallback(async () => {
    const video = liveMonitorVideoRef.current;
    if (!video) return;
    try {
      const anyDoc = document as Document & {
        pictureInPictureElement?: Element | null;
        pictureInPictureEnabled?: boolean;
        exitPictureInPicture?: () => Promise<void>;
      };
      const pipVideo = video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> };
      if (anyDoc.pictureInPictureElement === video && typeof anyDoc.exitPictureInPicture === "function") {
        await anyDoc.exitPictureInPicture();
        return;
      }
      if (anyDoc.pictureInPictureEnabled && typeof pipVideo.requestPictureInPicture === "function") {
        await pipVideo.requestPictureInPicture();
        return;
      }
    } catch (_error) {
      // fall through to fullscreen mode.
    }
    const frame = liveMonitorFrameRef.current;
    if (!frame) return;
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await frame.requestFullscreen?.().catch(() => undefined);
  }, []);

  const handleStepFrame = useCallback((direction: -1 | 1) => {
    const next = clamp(currentTimeSec + direction * FRAME_STEP_SECONDS, 0, durationSec);
    flushScrubSeek(next);
  }, [currentTimeSec, durationSec, flushScrubSeek]);

  const handleMonitorPaneKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleStepFrame(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleStepFrame(1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTogglePlay();
    }
  }, [handleStepFrame, onTogglePlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTextEntryTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isSaveChord = (event.ctrlKey || event.metaKey) && key === "s";

      if (isSaveChord) {
        event.preventDefault();
        if (!saveDisabled && !saving) onSave();
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.repeat && (event.code === "Space" || key === "p" || key === "k" || key === "c" || key === "h")) {
        return;
      }

      if (event.code === "Space" || key === "p") {
        event.preventDefault();
        onTogglePlay();
        return;
      }

      if (key === "k" || key === "1") {
        event.preventDefault();
        setActiveToolAndSelect("keep");
        return;
      }

      if (key === "c" || key === "2") {
        event.preventDefault();
        setActiveToolAndSelect("remove");
        return;
      }

      if (key === "h" || key === "3") {
        event.preventDefault();
        setActiveToolAndSelect("hook");
        return;
      }

      if (key === "m") {
        event.preventDefault();
        createMarker(activeTool, currentTimeSec);
        return;
      }

      if (key === "v") {
        event.preventDefault();
        activateSelectorMode();
        return;
      }

      if (key === "b") {
        event.preventDefault();
        activateSeekMode();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearPendingMarker();
        return;
      }

      if (event.key === "ArrowLeft" || key === "[") {
        event.preventDefault();
        handleStepFrame(-1);
        return;
      }

      if (event.key === "ArrowRight" || key === "]") {
        event.preventDefault();
        handleStepFrame(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTool,
    activateSeekMode,
    activateSelectorMode,
    clearPendingMarker,
    createMarker,
    currentTimeSec,
    handleStepFrame,
    onSave,
    onTogglePlay,
    saveDisabled,
    saving,
    setActiveToolAndSelect,
  ]);

  const timelineCursorPercent = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0;
  const timelineWidthPercent = clamp(
    Math.round(zoom * 100),
    Math.round(TIMELINE_ZOOM_MIN * 100),
    Math.round(TIMELINE_ZOOM_MAX * 100),
  );
  const removalPercent = clamp(removeRatio * 100, 0, 100);
  const manualRetentionLabel =
    manualRetentionDelta === null ? "n/a" : `${manualRetentionDelta >= 0 ? "+" : ""}${manualRetentionDelta.toFixed(1)} pts`;
  const aiRetentionLabel =
    aiRetentionDelta === null ? "n/a" : `${aiRetentionDelta >= 0 ? "+" : ""}${aiRetentionDelta.toFixed(1)} pts`;
  const retentionDeltaGap =
    manualRetentionDelta !== null && aiRetentionDelta !== null
      ? Number((manualRetentionDelta - aiRetentionDelta).toFixed(1))
      : null;
  const markedPercent = durationSec > 0 ? clamp((markedDuration / durationSec) * 100, 0, 100) : 0;
  const primaryHookMarker =
    sortedMarkers.find((marker) => marker.type === "hook" && marker.source === "user")
    || sortedMarkers.find((marker) => marker.type === "hook")
    || null;

  const retentionSnapshot = useMemo(() => {
    if (durationSec <= 0) {
      return {
        score: 0,
        baseline: 0,
        deltaFromBaseline: 0,
        hookMessage: "Set a hook in the first 8 seconds to stabilize early retention.",
        areaMap: [] as RetentionArea[],
        bestAreas: [] as RetentionArea[],
        weakAreas: [] as RetentionArea[],
        lowAreas: [] as RetentionArea[],
      };
    }

    const bucketCount = clamp(Math.round(durationSec / 5), 6, 16);
    const bucketSpan = durationSec / bucketCount;
    const areaMap: RetentionArea[] = [];

    for (let index = 0; index < bucketCount; index += 1) {
      const start = Number((index * bucketSpan).toFixed(3));
      const end = Number((index === bucketCount - 1 ? durationSec : start + bucketSpan).toFixed(3));
      const span = Math.max(0.1, end - start);
      const progress = start / Math.max(durationSec, 0.001);
      let score = 72 - progress * 20;

      let keepInfluence = 0;
      let removeInfluence = 0;
      let hookInfluence = 0;
      let microInfluence = 0;

      for (const marker of sortedMarkers) {
        const overlap = overlapDuration(start, end, marker.start, marker.end);
        if (overlap <= 0) continue;
        const ratio = overlap / span;
        if (marker.type === "keep") keepInfluence += 18 * ratio;
        if (marker.type === "remove") removeInfluence -= 22 * ratio;
        if (marker.type === "hook") hookInfluence += 24 * ratio;
      }

      for (const suggestion of microHookSuggestions) {
        const overlap = overlapDuration(start, end, suggestion.start, suggestion.end);
        if (overlap <= 0) continue;
        microInfluence += (overlap / span) * 10;
      }

      score += keepInfluence + removeInfluence + hookInfluence + microInfluence;

      if (primaryHookMarker) {
        const hookCenter = (primaryHookMarker.start + primaryHookMarker.end) / 2;
        const areaCenter = start + span / 2;
        const distance = Math.abs(areaCenter - hookCenter);
        if (distance <= 6) score += 4;
        else if (distance <= 12) score += 1.5;
      }

      score = clamp(score, 8, 99);

      let level: RetentionAreaLevel = "weak";
      if (score >= 74) level = "best";
      else if (score < 46) level = "low";

      let reason = "Neutral pacing pressure.";
      if (removeInfluence <= -10) reason = "Heavy remove windows can trigger drop-off.";
      else if (hookInfluence >= 9) reason = "Hook pressure is strongest in this stretch.";
      else if (keepInfluence >= 8) reason = "Keep segment anchors watch-time here.";
      else if (microInfluence >= 5) reason = "Micro-hook support adds recovery.";
      else if (progress > 0.72) reason = "Late-section drift; tighten cut density.";

      areaMap.push({
        id: `retention_area_${index}`,
        start,
        end,
        score: Number(score.toFixed(1)),
        level,
        reason,
      });
    }

    const averageAreaScore = areaMap.reduce((total, area) => total + area.score, 0) / Math.max(1, areaMap.length);
    const removalBalanceBonus = 12 - Math.abs(removalPercent - 18) * 0.35;
    const markerDensityBonus = clamp(sortedMarkers.length * 1.6, 0, 12);

    let hookBonus = -8;
    let hookMessage = "Set a hook marker. It will be pinned to 0:00 in the edited opener.";
    if (primaryHookMarker) {
      const hookLength = Math.max(0.05, primaryHookMarker.end - primaryHookMarker.start);
      hookBonus = hookLength >= 3 && hookLength <= 8 ? 10 : 8;
      hookMessage =
        hookLength >= 3 && hookLength <= 8
          ? "Hook marker selected: this range is pinned to the opening (0:00)."
          : "Hook marker selected and pinned to 0:00. Try a 3-8 second span for best hold.";
    }

    const estimateBias = aiRetentionDelta === null ? 0 : aiRetentionDelta * 3.2;
    const baseline = clamp(60 + estimateBias, 0, 100);
    const score = clamp(
      averageAreaScore * 0.72 + baseline * 0.28 + removalBalanceBonus + markerDensityBonus + hookBonus - 10,
      0,
      100,
    );
    const deltaFromBaseline = Number((score - baseline).toFixed(1));

    const sortedByScoreDesc = [...areaMap].sort((a, b) => b.score - a.score);
    const sortedByScoreAsc = [...areaMap].sort((a, b) => a.score - b.score);
    const bestAreas = sortedByScoreDesc.slice(0, 3);
    const lowAreas = sortedByScoreAsc.filter((area) => area.score < 46).slice(0, 3);
    let weakAreas = sortedByScoreAsc.filter((area) => area.score >= 46 && area.score < 66).slice(0, 3);
    if (weakAreas.length === 0) weakAreas = sortedByScoreAsc.slice(0, 3);

    return {
      score: Number(score.toFixed(1)),
      baseline: Number(baseline.toFixed(1)),
      deltaFromBaseline,
      hookMessage,
      areaMap,
      bestAreas,
      weakAreas,
      lowAreas,
    };
  }, [aiRetentionDelta, durationSec, microHookSuggestions, primaryHookMarker, removalPercent, sortedMarkers]);

  const recommendedHook = useMemo(() => {
    if (durationSec <= 0) return null;
    const maxEarlyStart = Math.min(12, durationSec);
    const minimumSpan = Math.min(0.6, Math.max(durationSec, 0.05));
    const maxStart = Math.max(0, durationSec - minimumSpan);

    const normalizeRange = (startRaw: number, endRaw: number) => {
      const start = clamp(startRaw, 0, maxStart);
      const end = clamp(Math.max(endRaw, start + minimumSpan), start + minimumSpan, durationSec);
      return {
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
      };
    };

    const earlyMicroHook = [...microHookSuggestions]
      .map((segment) => normalizeRange(segment.start, segment.end))
      .filter((segment) => segment.start <= maxEarlyStart)
      .sort((a, b) => a.start - b.start)[0];

    if (earlyMicroHook) {
      return {
        ...earlyMicroHook,
        source: "micro" as const,
        reason: "AI micro-hook signal is strong here and lands early.",
      };
    }

    const earlyBestArea = retentionSnapshot.bestAreas
      .filter((area) => area.start <= maxEarlyStart)
      .sort((a, b) => b.score - a.score)[0];

    if (earlyBestArea) {
      const centered = normalizeRange(
        earlyBestArea.start,
        Math.min(earlyBestArea.end, earlyBestArea.start + 5.5),
      );
      return {
        ...centered,
        source: "retention" as const,
        reason: earlyBestArea.reason,
      };
    }

    return {
      ...normalizeRange(0, Math.min(durationSec, 4.5)),
      source: "fallback" as const,
      reason: "Use a concise opener in the first 5 seconds to create immediate context.",
    };
  }, [durationSec, microHookSuggestions, retentionSnapshot.bestAreas]);

  const isRecommendedHookActive = useMemo(() => {
    if (!recommendedHook || !primaryHookMarker) return false;
    return (
      Math.abs(primaryHookMarker.start - recommendedHook.start) <= 0.15
      && Math.abs(primaryHookMarker.end - recommendedHook.end) <= 0.15
    );
  }, [primaryHookMarker, recommendedHook]);

  const applyRecommendedHook = useCallback(() => {
    if (!recommendedHook) return;
    const filtered = markers.filter((marker) => marker.type !== "hook");
    const nextHook: ManualTimestampMarker = {
      id: `hook_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      type: "hook",
      start: recommendedHook.start,
      end: recommendedHook.end,
      source: "user",
      rationale: recommendedHook.reason,
    };
    onMarkersChange([...filtered, nextHook]);
    setActiveTool("hook");
    setTimelineMode("select");
    setPendingMarker(null);
    flushScrubSeek(recommendedHook.start);
  }, [flushScrubSeek, markers, onMarkersChange, recommendedHook]);

  const handleTimelineRailClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (durationSec <= 0 || !timelineInnerRef.current) return;
    const rect = timelineInnerRef.current.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const targetTime = Number((ratio * durationSec).toFixed(3));
    if (timelineMode === "seek") {
      flushScrubSeek(targetTime);
      return;
    }
    createMarker(activeTool, targetTime);
  }, [activeTool, createMarker, durationSec, flushScrubSeek, timelineMode]);

  const timelineMarkerNodes = useMemo(
    () =>
      sortedMarkers.map((marker) => {
        const left = durationSec > 0 ? (marker.start / durationSec) * 100 : 0;
        const width = durationSec > 0 ? ((marker.end - marker.start) / durationSec) * 100 : 0;
        return (
          <div
            key={marker.id}
            className={cn("manual-editor-range absolute top-6 h-12 rounded-md border", rangeClassByType[marker.type])}
            style={{ left: `${left}%`, width: `${Math.max(width, 0.35)}%` }}
          >
            <button
              type="button"
              className="manual-editor-range-handle manual-editor-range-handle--start"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragState({ id: marker.id, boundary: "start" });
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              className="manual-editor-range-handle manual-editor-range-handle--end"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragState({ id: marker.id, boundary: "end" });
              }}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        );
      }),
    [durationSec, sortedMarkers],
  );

  const markerListNodes = useMemo(
    () =>
      sortedMarkers.map((marker) => (
        <div key={marker.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    markerBadgeClassByType[marker.type],
                  )}
                >
                  {labelByType[marker.type]}
                </Badge>
                <span className="truncate text-xs text-slate-200">
                  {formatTimelineTime(marker.start)}-{formatTimelineTime(marker.end)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => removeMarker(marker.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )),
    [removeMarker, sortedMarkers],
  );

  const suggestionListNodes = useMemo(
    () =>
      suggestions.map((suggestion) => (
        <div key={suggestion.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                suggestionBadgeClassByType[suggestion.type],
              )}
            >
              {suggestion.type}
            </Badge>
            <span className="text-[11px] text-slate-300">
              {formatTimelineTime(suggestion.start)}-{formatTimelineTime(suggestion.end)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-200">{suggestion.rationale}</p>
          <div className="mt-2 flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onAcceptSuggestion(suggestion.id)}
            >
              <Check className="h-3.5 w-3.5 text-emerald-200" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => onRejectSuggestion(suggestion.id)}
            >
              <X className="h-3.5 w-3.5 text-rose-200" />
            </Button>
          </div>
        </div>
      )),
    [onAcceptSuggestion, onRejectSuggestion, suggestions],
  );

  const beforeMonitorSrc = beforeEditUrl;
  const liveMonitorSrc = editedUrl;

  return (
    <section className="manual-editor-shell space-y-3 rounded-2xl border border-cyan-200/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="manual-editor-eyebrow text-[11px] uppercase tracking-[0.18em] text-cyan-200/85">
            Premium Timeline
          </p>
          <p className="text-base font-semibold text-slate-100 sm:text-lg">Manual Timestamp Editor</p>
          <p className="text-xs text-slate-300">Choose Keep/Remove/Hook, then click the timeline to set start and end.</p>
          <p className="mt-1 text-[11px] text-slate-400">Shortcuts: K keep, C cut, H hook, Space/P play-pause, M mark</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              hasUnsavedChanges
                ? "border-amber-300/40 bg-amber-500/12 text-amber-100"
                : "border-emerald-300/40 bg-emerald-500/12 text-emerald-100",
            )}
          >
            {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
          </Badge>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
            <span className="text-xs text-slate-300">Auto Assist</span>
            <Switch checked={autoAssist} onCheckedChange={onAutoAssistChange} />
          </div>
        </div>
      </div>

      <div className="manual-editor-top-grid grid gap-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,520px)_minmax(0,1.2fr)]">
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Playhead</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{formatTimelineTime(currentTimeSec)}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total {formatTimelineTime(durationSec)}</span>
            <span>{playbackRate.toFixed(playbackRate % 1 === 0 ? 0 : 2)}x</span>
          </div>
        </div>

        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Split Monitor</p>
            <span className="text-[10px] text-slate-400">Tap pane to seek • Enter/Space play</span>
          </div>
          <div
            ref={liveMonitorFrameRef}
            className="manual-editor-live-monitor group relative overflow-hidden rounded-xl border border-cyan-300/30 bg-[#03050c]"
          >
            <div className="manual-editor-split-monitor-grid">
              <div
                className="manual-editor-split-pane relative overflow-hidden bg-black/70"
                role="button"
                tabIndex={0}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  handleMonitorPaneSeek(event.clientX, event.currentTarget);
                }}
                onKeyDown={handleMonitorPaneKeyDown}
                title="Click to seek timeline. Arrow keys step frames. Enter/Space toggles play."
                aria-label="Before edit monitor pane"
              >
                <div className="manual-editor-split-label">Before Edit</div>
                {beforeMonitorSrc ? (
                  <video
                    ref={beforeMonitorVideoRef}
                    src={beforeMonitorSrc}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedData={() => {
                      setBeforeMonitorReady(true);
                      setBeforeMonitorErrored(false);
                    }}
                    onError={() => {
                      setBeforeMonitorReady(false);
                      setBeforeMonitorErrored(true);
                    }}
                    className="manual-editor-video h-full w-full bg-black object-contain"
                    aria-label="Before edit monitor"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">
                    Original source unavailable.
                  </div>
                )}
                {beforeMonitorSrc && !beforeMonitorReady && !beforeMonitorErrored ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/80" />
                  </div>
                ) : null}
                {beforeMonitorErrored ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/65 px-3 text-center text-[11px] text-rose-100">
                    Before preview unavailable
                  </div>
                ) : null}
              </div>
              <div
                className="manual-editor-split-pane relative overflow-hidden bg-black/70"
                role="button"
                tabIndex={0}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  handleMonitorPaneSeek(event.clientX, event.currentTarget);
                }}
                onKeyDown={handleMonitorPaneKeyDown}
                title="Click to seek timeline. Arrow keys step frames. Enter/Space toggles play."
                aria-label="Realtime edit monitor pane"
              >
                <div className="manual-editor-split-label">Realtime Edit</div>
                {liveMonitorSrc ? (
                  <video
                    ref={liveMonitorVideoRef}
                    src={liveMonitorSrc}
                    muted={liveMonitorMuted}
                    playsInline
                    preload="metadata"
                    onLoadedData={() => {
                      setLiveMonitorReady(true);
                      setLiveMonitorErrored(false);
                    }}
                    onError={() => {
                      setLiveMonitorReady(false);
                      setLiveMonitorErrored(true);
                    }}
                    className="manual-editor-video h-full w-full bg-black object-contain"
                    aria-label="Live timeline monitor"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">
                    Manual output unavailable. Save and render to preview.
                  </div>
                )}
                {liveMonitorSrc && !liveMonitorReady && !liveMonitorErrored ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/80" />
                  </div>
                ) : null}
                {liveMonitorErrored ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/65 px-3 text-center text-[11px] text-rose-100">
                    Realtime preview unavailable
                  </div>
                ) : null}
              </div>
            </div>
            <div className="manual-editor-live-monitor-overlay pointer-events-none absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent p-2 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  className="manual-editor-monitor-btn"
                  onClick={() => handleStepFrame(-1)}
                  aria-label="Step back one frame"
                  title="Step back ([ / Left)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="manual-editor-monitor-btn"
                  onClick={onTogglePlay}
                  aria-label={isPlaying ? "Pause preview" : "Play preview"}
                  title={isPlaying ? "Pause (Space/P)" : "Play (Space/P)"}
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="manual-editor-monitor-btn"
                  onClick={() => handleStepFrame(1)}
                  aria-label="Step forward one frame"
                  title="Step forward (] / Right)"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  className="manual-editor-monitor-btn"
                  onClick={handleLiveMonitorMuteToggle}
                  aria-label={liveMonitorMuted ? "Unmute preview" : "Mute preview"}
                  title={liveMonitorMuted ? "Unmute" : "Mute"}
                >
                  {liveMonitorMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  className="manual-editor-monitor-btn"
                  onClick={() => {
                    void handleLiveMonitorPopOut();
                  }}
                  aria-label="Expand preview"
                  title="Expand / Pop-out"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="manual-editor-toolbar rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onTogglePlay} className="gap-1.5">
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Pause (Space/P)" : "Play (Space/P)"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saveDisabled}
                loading={saving}
                loadingText="Saving edit"
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Save (Ctrl/Cmd+S)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRequestAiSuggest}
                loading={aiSuggestLoading}
                loadingText="Generating"
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Suggest
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClearAll} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Speed</span>
              {PLAYBACK_RATE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onPlaybackRateChange(option)}
                  className={cn(
                    "manual-editor-rate-chip inline-flex h-7 min-w-[42px] items-center justify-center rounded-md border px-2 text-[11px] font-medium",
                    Math.abs(playbackRate - option) < 0.001
                      ? "manual-editor-rate-chip--active border-cyan-300/60 bg-cyan-500/18 text-cyan-100"
                      : "border-white/15 bg-white/[0.03] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-100",
                  )}
                >
                  {option}x
                </button>
              ))}
            </div>
          </div>

          <Separator className="my-3 bg-white/10" />

          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setActiveToolAndSelect("keep");
                }}
                className={cn(
                  "manual-editor-action-chip rounded-lg border px-3 py-2 text-left text-xs text-slate-200",
                  activeTool === "keep" && "border-emerald-300/55 bg-emerald-500/15 text-emerald-100",
                )}
              >
                <p className="font-semibold">Keep Tool</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Select parts to preserve (K / 1)</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveToolAndSelect("remove");
                }}
                className={cn(
                  "manual-editor-action-chip rounded-lg border px-3 py-2 text-left text-xs text-slate-200",
                  activeTool === "remove" && "border-rose-300/55 bg-rose-500/15 text-rose-100",
                )}
              >
                <p className="font-semibold">Cut Tool</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Select parts to remove (C / 2)</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveToolAndSelect("hook");
                }}
                className={cn(
                  "manual-editor-action-chip rounded-lg border px-3 py-2 text-left text-xs text-slate-200",
                  activeTool === "hook" && "border-cyan-300/55 bg-cyan-500/15 text-cyan-100",
                )}
              >
                <p className="font-semibold">Hook Tool</p>
                <p className="mt-0.5 text-[10px] text-slate-400">Select the opening hook window (H / 3)</p>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => createMarker(activeTool, currentTimeSec)}
              >
                <Scissors className="h-3.5 w-3.5" />
                {pendingMarker?.type === activeTool ? "Set End @ Playhead (M)" : "Set Start @ Playhead (M)"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timelineMode === "select" ? "secondary" : "ghost"}
                className="h-8 gap-1.5"
                onClick={activateSelectorMode}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Selector Mode (V)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timelineMode === "seek" ? "secondary" : "ghost"}
                className="h-8"
                onClick={activateSeekMode}
              >
                Seek Mode (B)
              </Button>
              {pendingMarker ? (
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearPendingMarker}>
                  Cancel Start (Esc)
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400">
              Active tool: <span className="text-slate-200">{labelByType[activeTool]}</span>. {toolHintByType[activeTool]}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Markers</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{sortedMarkers.length}</p>
          <p className="text-[11px] text-slate-400">
            {markerCounts.keep} keep • {markerCounts.remove} remove • {markerCounts.hook} hook
          </p>
        </div>
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Coverage</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{markedPercent.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-400">{formatTimelineTime(markedDuration)} tagged</p>
        </div>
      </div>

      {pendingMarker ? (
        <div className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-100">
          {labelByType[pendingMarker.type]} start set at {formatTimelineTime(pendingMarker.start)}. Click another point on
          the timeline (or set end at playhead) to finish this range.
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <span>{formatTimelineTime(currentTimeSec)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatTimelineTime(durationSec)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
              {timelineMode === "select" ? "Selector mode" : "Seek mode"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-100">
              Tool: {labelByType[activeTool]}
            </span>
            <span className="rounded-full border border-emerald-300/40 bg-emerald-500/12 px-2 py-0.5 text-[10px] text-emerald-100">Keep</span>
            <span className="rounded-full border border-rose-300/40 bg-rose-500/12 px-2 py-0.5 text-[10px] text-rose-100">Remove</span>
            <span className="rounded-full border border-cyan-300/40 bg-cyan-500/12 px-2 py-0.5 text-[10px] text-cyan-100">Hook</span>
          </div>
        </div>
        <Slider
          min={0}
          max={Math.max(durationSec, 0.001)}
          step={1 / 30}
          value={[Math.min(currentTimeSec, durationSec || 0)]}
          onValueChange={(value) => scheduleScrubSeek(clamp(Number(value?.[0] ?? 0), 0, durationSec))}
          onValueCommit={(value) => flushScrubSeek(clamp(Number(value?.[0] ?? 0), 0, durationSec))}
          className="manual-editor-slider mt-1.5"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Timeline zoom</span>
          <span>{zoom.toFixed(1)}x</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => setZoom(TIMELINE_ZOOM_MIN)}
            disabled={Math.abs(zoom - TIMELINE_ZOOM_MIN) < 0.001}
          >
            All Out
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => setZoom(TIMELINE_ZOOM_MAX)}
            disabled={Math.abs(zoom - TIMELINE_ZOOM_MAX) < 0.001}
          >
            All In
          </Button>
        </div>
        <Slider
          min={TIMELINE_ZOOM_MIN}
          max={TIMELINE_ZOOM_MAX}
          step={TIMELINE_ZOOM_STEP}
          value={[zoom]}
          onValueChange={(value) =>
            setZoom(clamp(Number(value?.[0] ?? TIMELINE_ZOOM_DEFAULT), TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX))
          }
          className="manual-editor-slider mt-1.5"
        />

        <div className="manual-editor-timeline-scroll mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/35">
          <div
            ref={timelineInnerRef}
            className={cn(
              "manual-editor-timeline-inner relative h-24 min-w-full",
              timelineMode === "select" ? "cursor-crosshair" : "cursor-pointer",
            )}
            style={{ width: `${timelineWidthPercent}%` }}
            onClick={handleTimelineRailClick}
          >
            <div className="manual-editor-timeline-track absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full" />
            {timelineMarkerNodes}
            <div className="manual-editor-cursor absolute top-2 bottom-2 w-0.5" style={{ left: `${timelineCursorPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-100">Markers</p>
            <Badge className="border-white/15 bg-white/5 text-slate-100">{sortedMarkers.length}</Badge>
          </div>
          {sortedMarkers.length > 0 ? (
            <ScrollArea className="max-h-40 pr-2">
              <div className="space-y-2">{markerListNodes}</div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-slate-400">No markers yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-100">AI Suggestions</p>
            <Button type="button" size="sm" variant="ghost" onClick={onApplyAllSuggestions} disabled={suggestions.length === 0}>
              Apply All
            </Button>
          </div>
          {suggestions.length > 0 ? (
            <ScrollArea className="max-h-40 pr-2">
              <div className="space-y-2">{suggestionListNodes}</div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-slate-400">No AI suggestions yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <Gauge className="h-4 w-4 text-cyan-200" />
              Quality Signals
            </div>
            <Badge
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                retentionSnapshot.deltaFromBaseline >= 0
                  ? "border-emerald-300/45 bg-emerald-500/12 text-emerald-100"
                  : "border-rose-300/45 bg-rose-500/12 text-rose-100",
              )}
            >
              Live vs baseline {retentionSnapshot.deltaFromBaseline >= 0 ? "+" : ""}
              {retentionSnapshot.deltaFromBaseline.toFixed(1)}
            </Badge>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Hook recommendation</p>
              <Badge
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px]",
                  isRecommendedHookActive
                    ? "border-emerald-300/40 bg-emerald-500/12 text-emerald-100"
                    : "border-cyan-300/40 bg-cyan-500/12 text-cyan-100",
                )}
              >
                {isRecommendedHookActive ? "Applied" : "Suggested"}
              </Badge>
            </div>
            {recommendedHook ? (
              <>
                <p className="text-sm font-semibold text-slate-100">{formatRange(recommendedHook.start, recommendedHook.end)}</p>
                <p className="mt-1 text-[11px] text-slate-300">{recommendedHook.reason}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => flushScrubSeek(recommendedHook.start)}
                  >
                    Jump to range
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={isRecommendedHookActive}
                    onClick={applyRecommendedHook}
                  >
                    Use as hook
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-400">Load preview to generate a hook recommendation.</p>
            )}
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Live retention score</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-2xl font-semibold text-slate-100">
                {retentionSnapshot.score.toFixed(1)}
                <span className="ml-1 text-xs font-medium text-slate-400">/100</span>
              </p>
              <p className="text-[11px] text-slate-400">Baseline {retentionSnapshot.baseline.toFixed(1)}</p>
            </div>
            <Progress value={retentionSnapshot.score} className="manual-editor-progress mt-2 h-2 bg-white/10" />
            <p className="mt-2 text-xs text-slate-200">Manual retention delta: {manualRetentionLabel}</p>
            <p className="mt-1 text-xs text-slate-300">AI retention delta: {aiRetentionLabel}</p>
            {retentionDeltaGap !== null ? (
              <p className="mt-1 text-xs text-slate-300">
                Manual vs AI delta: {retentionDeltaGap >= 0 ? "+" : ""}{retentionDeltaGap.toFixed(1)} pts
              </p>
            ) : null}
            <p className="mt-1 text-xs text-cyan-100/90">{retentionSnapshot.hookMessage}</p>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
            <div className="flex items-center justify-between text-xs text-slate-200">
              <span>Removal ratio</span>
              <span>{removalPercent.toFixed(1)}%</span>
            </div>
            <Progress value={removalPercent} className="manual-editor-progress mt-2 h-2 bg-white/10" />
            <p className="mt-1 text-[11px] text-slate-400">Micro-hook hints: {microHookSuggestions.length}</p>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Retention map</p>
            {retentionSnapshot.areaMap.length > 0 ? (
              <div className="manual-editor-retention-strip mt-1.5">
                {retentionSnapshot.areaMap.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => onSeek(area.start)}
                    className={cn("manual-editor-retention-chip", `manual-editor-retention-chip--${area.level}`)}
                    style={{ width: `${100 / retentionSnapshot.areaMap.length}%` }}
                    aria-label={`Jump to ${formatRange(area.start, area.end)}`}
                    title={`${formatRange(area.start, area.end)} • ${area.score.toFixed(1)}`}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">Add markers to build the retention heatmap.</p>
            )}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/[0.06] p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-200">Best parts</p>
              {retentionSnapshot.bestAreas.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {retentionSnapshot.bestAreas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => onSeek(area.start)}
                      className={cn(
                        "manual-editor-retention-row w-full rounded-md border px-2 py-1.5 text-left",
                        retentionAreaBadgeClassByLevel.best,
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{formatRange(area.start, area.end)}</span>
                        <span>{area.score.toFixed(0)}</span>
                      </div>
                      <p className="mt-1 text-[10px] opacity-80">{area.reason}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-emerald-100/70">Add hook/keep markers to find highlights.</p>
              )}
            </div>
            <div className="rounded-lg border border-amber-300/20 bg-amber-500/[0.06] p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-amber-100">Weak parts</p>
              {retentionSnapshot.weakAreas.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {retentionSnapshot.weakAreas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => onSeek(area.start)}
                      className={cn(
                        "manual-editor-retention-row w-full rounded-md border px-2 py-1.5 text-left",
                        retentionAreaBadgeClassByLevel.weak,
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{formatRange(area.start, area.end)}</span>
                        <span>{area.score.toFixed(0)}</span>
                      </div>
                      <p className="mt-1 text-[10px] opacity-80">{area.reason}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-amber-100/70">No weak zones detected.</p>
              )}
            </div>
            <div className="rounded-lg border border-rose-300/20 bg-rose-500/[0.06] p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-rose-100">Low retention</p>
              {retentionSnapshot.lowAreas.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {retentionSnapshot.lowAreas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => onSeek(area.start)}
                      className={cn(
                        "manual-editor-retention-row w-full rounded-md border px-2 py-1.5 text-left",
                        retentionAreaBadgeClassByLevel.low,
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{formatRange(area.start, area.end)}</span>
                        <span>{area.score.toFixed(0)}</span>
                      </div>
                      <p className="mt-1 text-[10px] opacity-80">{area.reason}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-rose-100/70">No low-retention zones flagged.</p>
              )}
            </div>
          </div>
          {warning ? (
            <p className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/12 px-2 py-1.5 text-xs text-amber-100">
              {warning}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ManualTimestampEditor;
