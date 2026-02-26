import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactPlayer from "react-player";
import { ResizableBox, type ResizeCallbackData } from "react-resizable";
import {
  Pause,
  Play,
  Plus,
  Scissors,
  Settings2,
  Sparkles,
  Wand2,
  X,
  Zap,
  Move,
  Upload,
  Trash2,
  Check,
  CircleHelp,
} from "lucide-react";

import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

import "./vertical-clip-builder.css";

type VerticalFitMode = "cover" | "contain";
type VerticalLayoutMode = "stacked" | "single";
type MarkerAction = "cut" | "remove" | "effect";
type MarkerEffect =
  | "none"
  | "crash_zoom"
  | "smooth_zoom"
  | "swoosh_transition"
  | "glitch_flash"
  | "bass_hit"
  | "whoosh_sfx";
type WebcamCrop = { x: number; y: number; w: number; h: number };
type FaceAnchor = { time: number; x: number; y: number; w: number; h: number };

type TimelineMarker = {
  id: string;
  time: number;
  label: string;
  action: MarkerAction;
  effectType: MarkerEffect;
  removeSeconds: number;
  aiSuggestion: string | null;
};

type VerticalBuilderSettings = {
  autoCropWebcam: boolean;
  clipCount: number;
  topHeightPct: number;
  paddingPx: number;
  bottomFit: VerticalFitMode;
  previewZoom: number;
  previewPanX: number;
  previewPanY: number;
  captionsText: string;
};

type VerticalRenderPayload = {
  mode: "vertical";
  verticalClipCount: number;
  verticalMode: {
    enabled: true;
    output: { width: number; height: number };
    layout: VerticalLayoutMode;
    webcamCrop: WebcamCrop | null;
    topHeightPx: number | null;
    bottomFit: VerticalFitMode;
    paddingPx: number;
  };
  timelineActions: Array<{
    time: number;
    label: string;
    action: MarkerAction;
    effectType: MarkerEffect;
    removeSeconds: number;
  }>;
};

type VerticalClipBuilderProps = {
  videoUrl: string | null;
  accessToken?: string | null;
  className?: string;
  faceAnchors?: FaceAnchor[];
  renderEndpoint?: string;
  onRequestUpload?: () => void;
  onCreateClips?: (payload: VerticalRenderPayload) => Promise<void> | void;
};

type VerticalClipBuilderStore = {
  settings: VerticalBuilderSettings;
  setSettings: React.Dispatch<React.SetStateAction<VerticalBuilderSettings>>;
  markers: TimelineMarker[];
  setMarkers: React.Dispatch<React.SetStateAction<TimelineMarker[]>>;
};

const DEFAULT_OUTPUT = { width: 1080, height: 1920 } as const;
const MIN_CROP_SIZE_PX = 48;
const STORE_KEY = "vertical_clip_builder_store_v1";

const CLIP_COUNT_OPTIONS = [0, 8, 10, 12, 15, 20] as const;

const MARKER_ACTION_LABELS: Record<MarkerAction, string> = {
  cut: "Cut here",
  remove: "Remove segment",
  effect: "Add effect",
};

const MARKER_EFFECT_LABELS: Record<MarkerEffect, string> = {
  none: "No effect",
  crash_zoom: "Crash Zoom",
  smooth_zoom: "Smooth Zoom",
  swoosh_transition: "Swoosh Transition",
  glitch_flash: "Glitch Flash",
  bass_hit: "Bass Hit SFX",
  whoosh_sfx: "Whoosh SFX",
};

const DEFAULT_SETTINGS: VerticalBuilderSettings = {
  autoCropWebcam: true,
  clipCount: 0,
  topHeightPct: 40,
  paddingPx: 0,
  bottomFit: "cover",
  previewZoom: 1,
  previewPanX: 0,
  previewPanY: 0,
  captionsText: "",
};

const VerticalClipBuilderContext = createContext<VerticalClipBuilderStore | null>(null);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

const buildDefaultCrop = (sourceWidth: number, sourceHeight: number): WebcamCrop => {
  const y = Math.round(sourceHeight * 0.05);
  const h = Math.round(sourceHeight * 0.42);
  return {
    x: 0,
    y,
    w: sourceWidth,
    h: clamp(h, MIN_CROP_SIZE_PX, sourceHeight - y),
  };
};

const normalizeCrop = (value: WebcamCrop, source: { width: number; height: number }): WebcamCrop => {
  const minSize = Math.min(
    Math.max(MIN_CROP_SIZE_PX, Math.round(Math.min(source.width, source.height) * 0.04)),
    Math.min(source.width, source.height),
  );
  let x = Number.isFinite(value.x) ? value.x : 0;
  let y = Number.isFinite(value.y) ? value.y : 0;
  let w = Number.isFinite(value.w) ? value.w : minSize;
  let h = Number.isFinite(value.h) ? value.h : minSize;

  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }

  x = clamp(x, 0, source.width - minSize);
  y = clamp(y, 0, source.height - minSize);
  w = clamp(w, minSize, source.width - x);
  h = clamp(h, minSize, source.height - y);

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
};

const createMarker = (time: number): TimelineMarker => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  time,
  label: "Cut here",
  action: "cut",
  effectType: "none",
  removeSeconds: 10,
  aiSuggestion: null,
});

const useIsMobile = () => {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return mobile;
};

const loadStore = () => {
  if (typeof window === "undefined") {
    return { settings: DEFAULT_SETTINGS, markers: [] as TimelineMarker[] };
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { settings: DEFAULT_SETTINGS, markers: [] as TimelineMarker[] };
    const parsed = JSON.parse(raw) as { settings?: Partial<VerticalBuilderSettings>; markers?: TimelineMarker[] };
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
      },
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, markers: [] as TimelineMarker[] };
  }
};

export const VerticalClipBuilderProvider = ({ children }: { children: ReactNode }) => {
  const boot = useMemo(() => loadStore(), []);
  const [settings, setSettings] = useState<VerticalBuilderSettings>(boot.settings);
  const [markers, setMarkers] = useState<TimelineMarker[]>(boot.markers);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        settings,
        markers,
      }),
    );
  }, [settings, markers]);

  return (
    <VerticalClipBuilderContext.Provider value={{ settings, setSettings, markers, setMarkers }}>
      {children}
    </VerticalClipBuilderContext.Provider>
  );
};

const useVerticalBuilderStore = () => {
  const context = useContext(VerticalClipBuilderContext);
  if (!context) {
    throw new Error("VerticalClipBuilder must be used inside VerticalClipBuilderProvider.");
  }
  return context;
};

const suggestMarker = (time: number, duration: number) => {
  const pct = duration > 0 ? clamp01(time / duration) : 0;
  if (pct < 0.12) {
    return {
      label: "Hook boost",
      action: "effect" as const,
      effectType: "crash_zoom" as const,
      suggestion: "Add a crash zoom here to amplify the hook.",
    };
  }
  if (pct > 0.75) {
    return {
      label: "Transition to CTA",
      action: "effect" as const,
      effectType: "swoosh_transition" as const,
      suggestion: "Use a swoosh transition to move into the closing CTA.",
    };
  }
  return {
    label: "Tighten pacing",
    action: "cut" as const,
    effectType: "none" as const,
    suggestion: "Trim this segment to improve pacing density.",
  };
};

const VerticalClipBuilderInner = ({
  videoUrl,
  accessToken,
  className,
  faceAnchors = [],
  renderEndpoint,
  onRequestUpload,
  onCreateClips,
}: VerticalClipBuilderProps) => {
  const { settings, setSettings, markers, setMarkers } = useVerticalBuilderStore();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const [sourceMeta, setSourceMeta] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<WebcamCrop | null>(null);
  const [cropMoving, setCropMoving] = useState<{
    startClientX: number;
    startClientY: number;
    startCrop: WebcamCrop;
  } | null>(null);

  const [panDragging, setPanDragging] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  const sourcePlayerRef = useRef<ReactPlayer>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const timelineRailRef = useRef<HTMLDivElement | null>(null);
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setStageSize({ width, height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sourceMeta) return;
    setCrop((prev) => (prev ? normalizeCrop(prev, sourceMeta) : buildDefaultCrop(sourceMeta.width, sourceMeta.height)));
  }, [sourceMeta]);

  const getInternalVideo = useCallback(() => {
    return (sourcePlayerRef.current?.getInternalPlayer() as HTMLVideoElement | null) || null;
  }, []);

  const syncSourceMeta = useCallback(() => {
    const video = getInternalVideo();
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setSourceMeta({ width: video.videoWidth, height: video.videoHeight });
  }, [getInternalVideo]);

  const activeFaceAnchor = useMemo(() => {
    if (!faceAnchors.length || !duration) return null;
    const sorted = [...faceAnchors].sort((a, b) => a.time - b.time);
    let selected = sorted[0];
    for (const anchor of sorted) {
      if (anchor.time <= currentTime) selected = anchor;
      if (anchor.time > currentTime) break;
    }
    return selected;
  }, [currentTime, duration, faceAnchors]);

  const applySmartCrop = useCallback(() => {
    if (!sourceMeta) return;
    const base = activeFaceAnchor
      ? {
          x: activeFaceAnchor.x - activeFaceAnchor.w * 0.18,
          y: activeFaceAnchor.y - activeFaceAnchor.h * 0.35,
          w: activeFaceAnchor.w * 1.36,
          h: Math.max(activeFaceAnchor.h * 1.9, sourceMeta.height * 0.34),
        }
      : buildDefaultCrop(sourceMeta.width, sourceMeta.height);

    setCrop(normalizeCrop(base, sourceMeta));
  }, [activeFaceAnchor, sourceMeta]);

  useEffect(() => {
    if (!settings.autoCropWebcam) return;
    applySmartCrop();
  }, [settings.autoCropWebcam, currentTime, applySmartCrop]);

  const snapCrop = useCallback(
    (candidate: WebcamCrop) => {
      if (!sourceMeta) return candidate;
      const threshold = Math.max(14, Math.round(Math.min(sourceMeta.width, sourceMeta.height) * 0.02));
      const next = { ...candidate };

      if (Math.abs(next.x) <= threshold) next.x = 0;
      if (Math.abs(next.y) <= threshold) next.y = 0;
      if (Math.abs(sourceMeta.width - (next.x + next.w)) <= threshold) next.x = sourceMeta.width - next.w;
      if (Math.abs(sourceMeta.height - (next.y + next.h)) <= threshold) next.y = sourceMeta.height - next.h;

      if (activeFaceAnchor) {
        const centerX = next.x + next.w / 2;
        const centerY = next.y + next.h / 2;
        const anchorCenterX = activeFaceAnchor.x + activeFaceAnchor.w / 2;
        const anchorCenterY = activeFaceAnchor.y + activeFaceAnchor.h / 2;
        if (Math.abs(centerX - anchorCenterX) <= threshold * 1.4) {
          next.x = anchorCenterX - next.w / 2;
        }
        if (Math.abs(centerY - anchorCenterY) <= threshold * 1.4) {
          next.y = anchorCenterY - next.h / 2;
        }
      }

      return normalizeCrop(next, sourceMeta);
    },
    [activeFaceAnchor, sourceMeta],
  );

  const cropDisplayRect = useMemo(() => {
    if (!crop || !sourceMeta || !stageSize.width || !stageSize.height) return null;
    return {
      left: (crop.x / sourceMeta.width) * stageSize.width,
      top: (crop.y / sourceMeta.height) * stageSize.height,
      width: (crop.w / sourceMeta.width) * stageSize.width,
      height: (crop.h / sourceMeta.height) * stageSize.height,
    };
  }, [crop, sourceMeta, stageSize.height, stageSize.width]);

  const displayRectToCrop = useCallback(
    (next: { left: number; top: number; width: number; height: number }) => {
      if (!sourceMeta || !stageSize.width || !stageSize.height) return null;
      const converted = {
        x: (next.left / stageSize.width) * sourceMeta.width,
        y: (next.top / stageSize.height) * sourceMeta.height,
        w: (next.width / stageSize.width) * sourceMeta.width,
        h: (next.height / stageSize.height) * sourceMeta.height,
      };
      return normalizeCrop(converted, sourceMeta);
    },
    [sourceMeta, stageSize.height, stageSize.width],
  );

  useEffect(() => {
    if (!cropMoving || settings.autoCropWebcam || !sourceMeta || !stageSize.width || !stageSize.height) return;

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - cropMoving.startClientX;
      const dy = event.clientY - cropMoving.startClientY;
      const pxPerClientX = sourceMeta.width / stageSize.width;
      const pxPerClientY = sourceMeta.height / stageSize.height;
      const next = normalizeCrop(
        {
          x: cropMoving.startCrop.x + dx * pxPerClientX,
          y: cropMoving.startCrop.y + dy * pxPerClientY,
          w: cropMoving.startCrop.w,
          h: cropMoving.startCrop.h,
        },
        sourceMeta,
      );
      setCrop(snapCrop(next));
    };

    const onEnd = () => setCropMoving(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [cropMoving, settings.autoCropWebcam, snapCrop, sourceMeta, stageSize.height, stageSize.width]);

  const handleResizeCrop = useCallback(
    (_event: unknown, data: ResizeCallbackData) => {
      if (!cropDisplayRect) return;
      const handle = String(data.handle || "se");

      const nextWidth = data.size.width;
      const nextHeight = data.size.height;

      let nextLeft = cropDisplayRect.left;
      let nextTop = cropDisplayRect.top;

      if (handle.includes("w")) {
        nextLeft = cropDisplayRect.left + (cropDisplayRect.width - nextWidth);
      }
      if (handle.includes("n")) {
        nextTop = cropDisplayRect.top + (cropDisplayRect.height - nextHeight);
      }

      const converted = displayRectToCrop({
        left: nextLeft,
        top: nextTop,
        width: nextWidth,
        height: nextHeight,
      });

      if (converted) {
        setCrop(snapCrop(converted));
      }
    },
    [cropDisplayRect, displayRectToCrop, snapCrop],
  );

  const seekTo = useCallback((time: number) => {
    const next = clamp(time, 0, duration || 0);
    setCurrentTime(next);
    sourcePlayerRef.current?.seekTo(next, "seconds");
  }, [duration]);

  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => a.time - b.time);
  }, [markers]);

  const addMarkerAt = useCallback(
    (time: number) => {
      const marker = createMarker(clamp(time, 0, duration || 0));
      setMarkers((prev) => [...prev, marker]);
      setSelectedMarkerId(marker.id);
      setShowTimeline(true);
    },
    [duration, setMarkers],
  );

  const updateMarker = useCallback((markerId: string, patch: Partial<TimelineMarker>) => {
    setMarkers((prev) => prev.map((marker) => (marker.id === markerId ? { ...marker, ...patch } : marker)));
  }, [setMarkers]);

  const removeMarker = useCallback((markerId: string) => {
    setMarkers((prev) => prev.filter((marker) => marker.id !== markerId));
    setSelectedMarkerId((prev) => (prev === markerId ? null : prev));
  }, [setMarkers]);

  const handleTimelineRailClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!duration || !timelineRailRef.current) return;
      const rect = timelineRailRef.current.getBoundingClientRect();
      const ratio = clamp01((event.clientX - rect.left) / rect.width);
      const target = ratio * duration;
      addMarkerAt(target);
      seekTo(target);
    },
    [addMarkerAt, duration, seekTo],
  );

  const applyAutoSuggestion = useCallback(
    (markerId?: string) => {
      if (!duration) return;
      const targetMarker = markerId ? markers.find((entry) => entry.id === markerId) : null;
      const targetTime = targetMarker?.time ?? currentTime;
      const suggestion = suggestMarker(targetTime, duration);

      if (targetMarker) {
        updateMarker(targetMarker.id, {
          label: suggestion.label,
          action: suggestion.action,
          effectType: suggestion.effectType,
          aiSuggestion: suggestion.suggestion,
        });
        return;
      }

      const marker = createMarker(targetTime);
      const nextMarker: TimelineMarker = {
        ...marker,
        label: suggestion.label,
        action: suggestion.action,
        effectType: suggestion.effectType,
        aiSuggestion: suggestion.suggestion,
      };
      setMarkers((prev) => [...prev, nextMarker]);
      setSelectedMarkerId(nextMarker.id);
      setShowTimeline(true);
    },
    [currentTime, duration, markers, setMarkers, updateMarker],
  );

  const payload = useMemo<VerticalRenderPayload | null>(() => {
    if (!sourceMeta) return null;
    const topHeightPx = Math.round(DEFAULT_OUTPUT.height * clamp01(settings.topHeightPct / 100));
    return {
      mode: "vertical",
      verticalClipCount: settings.clipCount,
      verticalMode: {
        enabled: true,
        output: { ...DEFAULT_OUTPUT },
        layout: settings.autoCropWebcam ? "single" : "stacked",
        webcamCrop: settings.autoCropWebcam ? null : crop,
        topHeightPx: settings.autoCropWebcam ? null : clamp(topHeightPx, 220, DEFAULT_OUTPUT.height - 220),
        bottomFit: settings.bottomFit,
        paddingPx: Math.round(settings.paddingPx),
      },
      timelineActions: sortedMarkers.map((entry) => ({
        time: Number(entry.time.toFixed(3)),
        label: entry.label,
        action: entry.action,
        effectType: entry.effectType,
        removeSeconds: Math.max(0, Number(entry.removeSeconds || 0)),
      })),
    };
  }, [crop, settings.autoCropWebcam, settings.bottomFit, settings.clipCount, settings.paddingPx, settings.topHeightPct, sortedMarkers, sourceMeta]);

  const saveToBackend = useCallback(async () => {
    if (!payload) {
      toast({ title: "No preview loaded", description: "Upload a video so crop + timeline settings can be saved." });
      return;
    }

    const endpoint = renderEndpoint || `${API_URL}/api/render`;
    setSaving(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status})`);
      }

      toast({
        title: "Settings saved",
        description: `Exported ${payload.timelineActions.length} timeline marker${payload.timelineActions.length === 1 ? "" : "s"} to backend JSON.`,
      });

      if (onCreateClips) {
        await onCreateClips(payload);
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save render settings.",
      });
    } finally {
      setSaving(false);
    }
  }, [accessToken, onCreateClips, payload, renderEndpoint, toast]);

  useEffect(() => {
    const canvas = compositionCanvasRef.current;
    const video = getInternalVideo();
    if (!canvas || !video || !sourceMeta) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasWidth = 540;
    const canvasHeight = Math.round((DEFAULT_OUTPUT.height / DEFAULT_OUTPUT.width) * canvasWidth);
    const topHeight = Math.round(canvasHeight * clamp01(settings.topHeightPct / 100));
    const bottomHeight = canvasHeight - topHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const drawVideoRegion = (
      src: WebcamCrop,
      dst: { x: number; y: number; w: number; h: number },
      fit: VerticalFitMode,
      zoomCrop = false,
    ) => {
      if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;

      let region = { ...src };
      if (zoomCrop) {
        const zoom = clamp(settings.previewZoom, 1, 2.5);
        const panLimitX = (region.w - region.w / zoom) / 2;
        const panLimitY = (region.h - region.h / zoom) / 2;
        const centerX = region.x + region.w / 2 + settings.previewPanX * panLimitX;
        const centerY = region.y + region.h / 2 + settings.previewPanY * panLimitY;
        region = {
          x: centerX - region.w / (2 * zoom),
          y: centerY - region.h / (2 * zoom),
          w: region.w / zoom,
          h: region.h / zoom,
        };
      }

      const srcAspect = region.w / region.h;
      const dstAspect = dst.w / dst.h;

      if (fit === "contain") {
        let drawWidth = dst.w;
        let drawHeight = dst.h;
        let drawX = dst.x;
        let drawY = dst.y;

        if (srcAspect > dstAspect) {
          drawHeight = dst.w / srcAspect;
          drawY += (dst.h - drawHeight) / 2;
        } else {
          drawWidth = dst.h * srcAspect;
          drawX += (dst.w - drawWidth) / 2;
        }

        ctx.fillStyle = "#08080f";
        ctx.fillRect(dst.x, dst.y, dst.w, dst.h);
        ctx.drawImage(video, region.x, region.y, region.w, region.h, drawX, drawY, drawWidth, drawHeight);
        return;
      }

      let sx = region.x;
      let sy = region.y;
      let sw = region.w;
      let sh = region.h;

      if (srcAspect > dstAspect) {
        const narrowed = sh * dstAspect;
        sx += (sw - narrowed) / 2;
        sw = narrowed;
      } else {
        const trimmed = sw / dstAspect;
        sy += (sh - trimmed) / 2;
        sh = trimmed;
      }

      ctx.drawImage(video, sx, sy, sw, sh, dst.x, dst.y, dst.w, dst.h);
    };

    const drawCaption = () => {
      const caption = String(settings.captionsText || "").trim();
      if (!caption) return;

      const lines = caption
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2);

      if (!lines.length) return;

      ctx.font = "700 30px Arial";
      const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const boxWidth = Math.min(canvasWidth * 0.9, textWidth + 44);
      const boxHeight = lines.length * 36 + 20;
      const boxX = (canvasWidth - boxWidth) / 2;
      const boxY = canvasHeight - boxHeight - 24;

      ctx.fillStyle = "rgba(15, 15, 28, 0.82)";
      ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f8f5ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((line, idx) => {
        ctx.fillText(line, canvasWidth / 2, boxY + 18 + idx * 36);
      });
    };

    let raf = 0;

    const render = () => {
      if (video.readyState >= 2) {
        ctx.fillStyle = "#05050d";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (settings.autoCropWebcam || !crop) {
          drawVideoRegion(
            { x: 0, y: 0, w: sourceMeta.width, h: sourceMeta.height },
            { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
            settings.bottomFit,
            false,
          );
        } else {
          drawVideoRegion(crop, { x: 0, y: 0, w: canvasWidth, h: topHeight }, "cover", true);
          drawVideoRegion(
            { x: 0, y: 0, w: sourceMeta.width, h: sourceMeta.height },
            { x: 0, y: topHeight, w: canvasWidth, h: bottomHeight },
            settings.bottomFit,
            false,
          );

          ctx.strokeStyle = "rgba(168,85,247,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, topHeight + 0.5);
          ctx.lineTo(canvasWidth, topHeight + 0.5);
          ctx.stroke();
        }

        drawCaption();
      }
      raf = window.requestAnimationFrame(render);
    };

    render();
    return () => window.cancelAnimationFrame(raf);
  }, [crop, getInternalVideo, settings.autoCropWebcam, settings.bottomFit, settings.captionsText, settings.previewPanX, settings.previewPanY, settings.previewZoom, settings.topHeightPct, sourceMeta]);

  const timelineNeedles = useMemo(() => {
    if (!duration) return [] as Array<TimelineMarker & { leftPct: number }>;
    return sortedMarkers.map((marker) => ({
      ...marker,
      leftPct: clamp01(marker.time / duration) * 100,
    }));
  }, [duration, sortedMarkers]);

  const settingsPanel = (
    <div className="space-y-4">
      <div className="vcb-glass rounded-2xl border border-violet-400/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-100">Webcam Auto Selector</p>
            <p className="mt-1 text-xs text-violet-100/70">Auto mode tracks detected faces and keeps the top stack centered.</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="rounded-full p-1 text-violet-200/80 hover:text-violet-100">
                  <CircleHelp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px] border-violet-400/40 bg-[#13132A] text-xs text-violet-100">
                AI detects &amp; crops faces for perfect stacking.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-violet-400/25 bg-violet-500/10 px-3">
          <span className="text-sm text-violet-50">Auto Crop Webcam</span>
          <Switch
            checked={settings.autoCropWebcam}
            onCheckedChange={(next) => {
              setSettings((prev) => ({ ...prev, autoCropWebcam: next }));
              if (next) applySmartCrop();
            }}
            className="data-[state=checked]:bg-violet-500"
          />
        </div>
      </div>

      <div className="vcb-glass rounded-2xl border border-violet-400/20 p-4">
        <p className="text-sm font-semibold text-violet-100">Composition Controls</p>
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-violet-100/70">
              <span>Top panel height</span>
              <span>{Math.round(settings.topHeightPct)}%</span>
            </div>
            <Slider
              value={[settings.topHeightPct]}
              min={20}
              max={70}
              step={1}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, topHeightPct: clamp(value[0] ?? 40, 20, 70) }))}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-violet-100/70">
              <span>Padding</span>
              <span>{Math.round(settings.paddingPx)}px</span>
            </div>
            <Slider
              value={[settings.paddingPx]}
              min={0}
              max={80}
              step={1}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, paddingPx: clamp(value[0] ?? 0, 0, 80) }))}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-violet-100/70">
              <span>Top zoom</span>
              <span>{settings.previewZoom.toFixed(2)}x</span>
            </div>
            <Slider
              value={[settings.previewZoom]}
              min={1}
              max={2.5}
              step={0.01}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, previewZoom: clamp(value[0] ?? 1, 1, 2.5) }))}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-violet-100/70">
              <span>Pan X</span>
              <span>{settings.previewPanX.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.previewPanX]}
              min={-1}
              max={1}
              step={0.01}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, previewPanX: clamp(value[0] ?? 0, -1, 1) }))}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-violet-100/70">
              <span>Pan Y</span>
              <span>{settings.previewPanY.toFixed(2)}</span>
            </div>
            <Slider
              value={[settings.previewPanY]}
              min={-1}
              max={1}
              step={0.01}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, previewPanY: clamp(value[0] ?? 0, -1, 1) }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={settings.bottomFit === "cover" ? "default" : "outline"}
              className="min-h-12"
              onClick={() => setSettings((prev) => ({ ...prev, bottomFit: "cover" }))}
            >
              Cover
            </Button>
            <Button
              type="button"
              variant={settings.bottomFit === "contain" ? "default" : "outline"}
              className="min-h-12"
              onClick={() => setSettings((prev) => ({ ...prev, bottomFit: "contain" }))}
            >
              Contain
            </Button>
          </div>
        </div>
      </div>

      <div className="vcb-glass rounded-2xl border border-violet-400/20 p-4">
        <p className="text-sm font-semibold text-violet-100">Caption Seed (optional)</p>
        <Input
          value={settings.captionsText}
          onChange={(event) => setSettings((prev) => ({ ...prev, captionsText: event.target.value.slice(0, 160) }))}
          placeholder="No way this happened..."
          className="mt-3 min-h-12 border-violet-400/20 bg-white/[0.03] text-violet-50"
        />
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#0F0F1A] to-[#12121F] p-4 md:p-6",
          "shadow-[0_24px_80px_rgba(8,8,20,0.6)]",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.14),transparent_48%)]" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-violet-200/70">Vertical Clip Builder</p>
              <h3 className="text-xl font-semibold text-violet-50">AI Stacked 9:16 Composer</h3>
            </div>

            <motion.button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="vcb-gear min-h-12 rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 text-sm text-violet-50 transition-all duration-200 ease-in-out hover:border-violet-300 hover:bg-violet-500/25"
              animate={{ boxShadow: ["0 0 0 rgba(168,85,247,0)", "0 0 24px rgba(168,85,247,0.45)", "0 0 0 rgba(168,85,247,0)"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </span>
            </motion.button>
          </div>

          {!videoUrl ? (
            <div className="vcb-glass rounded-2xl border border-dashed border-violet-400/35 p-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-violet-300/35 bg-violet-500/15">
                <Upload className="h-6 w-6 text-violet-200" />
              </div>
              <p className="text-sm text-violet-100">Upload a source video to unlock smart crop + timeline actions.</p>
              <Button className="mt-4 min-h-12 bg-violet-600 text-white hover:bg-violet-500" onClick={onRequestUpload}>
                Select Video
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="vcb-glass rounded-2xl border border-violet-400/25 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-100">{settings.autoCropWebcam ? "Auto Crop" : "Manual Crop"}</Badge>
                      {!settings.autoCropWebcam ? (
                        <Badge className="border-violet-400/30 bg-violet-500/10 text-violet-100">Drag + Resize to refine</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-violet-100/80">
                      <Move className="h-3.5 w-3.5" />
                      Zoom/pan the top panel directly on preview
                    </div>
                  </div>

                  <div
                    ref={stageRef}
                    className="relative overflow-hidden rounded-xl border border-violet-400/25 bg-black/60"
                    style={sourceMeta ? { aspectRatio: `${sourceMeta.width} / ${sourceMeta.height}` } : { aspectRatio: "16 / 9" }}
                  >
                    <ReactPlayer
                      ref={sourcePlayerRef}
                      url={videoUrl}
                      width="100%"
                      height="100%"
                      playing={playing}
                      controls={false}
                      muted={false}
                      onReady={syncSourceMeta}
                      onDuration={(seconds) => setDuration(seconds || 0)}
                      onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds || 0)}
                      onPause={() => setPlaying(false)}
                      onPlay={() => setPlaying(true)}
                      config={{ file: { attributes: { playsInline: true } } }}
                    />

                    {!settings.autoCropWebcam && cropDisplayRect ? (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute" style={{ left: cropDisplayRect.left, top: cropDisplayRect.top }}>
                          <ResizableBox
                            className="vcb-resizable pointer-events-auto"
                            width={cropDisplayRect.width}
                            height={cropDisplayRect.height}
                            minConstraints={[48, 48]}
                            maxConstraints={[stageSize.width, stageSize.height]}
                            resizeHandles={["se", "sw", "ne", "nw", "n", "s", "e", "w"]}
                            onResize={handleResizeCrop}
                            onResizeStop={handleResizeCrop}
                            handle={(axis, ref) => (
                              <span
                                ref={ref}
                                className={`vcb-handle react-resizable-handle react-resizable-handle-${axis}`}
                              />
                            )}
                          >
                            <div
                              className="vcb-crop-box relative h-full w-full"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!crop) return;
                                setCropMoving({
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  startCrop: crop,
                                });
                              }}
                            >
                              <div className="pointer-events-none absolute inset-0 border-2 border-violet-300" />
                              <div className="pointer-events-none absolute inset-1 border border-white/70 border-dashed" />
                              <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-[10px] text-violet-100">
                                Manual webcam crop
                              </div>
                            </div>
                          </ResizableBox>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 border-violet-400/35 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                      onClick={() => setPlaying((prev) => !prev)}
                    >
                      {playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 border-violet-400/35 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                      onClick={() => {
                        if (!sourceMeta) return;
                        setCrop(buildDefaultCrop(sourceMeta.width, sourceMeta.height));
                      }}
                    >
                      Reset Crop
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 border-violet-400/35 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                      onClick={() => applyAutoSuggestion()}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      Auto Suggest
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div
                    className="vcb-glass rounded-2xl border border-violet-400/25 p-3"
                    onWheel={(event) => {
                      event.preventDefault();
                      const delta = event.deltaY > 0 ? -0.05 : 0.05;
                      setSettings((prev) => ({ ...prev, previewZoom: clamp(prev.previewZoom + delta, 1, 2.5) }));
                    }}
                    onPointerDown={(event) => {
                      setPanDragging({
                        startX: event.clientX,
                        startY: event.clientY,
                        startPanX: settings.previewPanX,
                        startPanY: settings.previewPanY,
                      });
                    }}
                    onPointerMove={(event) => {
                      if (!panDragging) return;
                      const dx = (event.clientX - panDragging.startX) / 220;
                      const dy = (event.clientY - panDragging.startY) / 220;
                      setSettings((prev) => ({
                        ...prev,
                        previewPanX: clamp(panDragging.startPanX + dx, -1, 1),
                        previewPanY: clamp(panDragging.startPanY + dy, -1, 1),
                      }));
                    }}
                    onPointerUp={() => setPanDragging(null)}
                    onPointerLeave={() => setPanDragging(null)}
                  >
                    <p className="text-sm font-medium text-violet-100">Live Stacked 9:16 Preview</p>
                    <p className="mt-1 text-xs text-violet-100/70">Wheel = zoom. Drag = pan top panel.</p>
                    <div className="mx-auto mt-3 w-full max-w-[320px]">
                      <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
                        <canvas ref={compositionCanvasRef} className="h-full w-full rounded-xl border border-violet-400/20 bg-black" />
                        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-violet-300/20" />
                      </div>
                    </div>
                  </div>

                  <div className="vcb-glass rounded-2xl border border-violet-400/25 p-3">
                    <p className="text-sm font-medium text-violet-100">Clip Count</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {CLIP_COUNT_OPTIONS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={cn(
                            "min-h-12 rounded-xl border px-3 text-sm transition-all duration-200 ease-in-out",
                            settings.clipCount === count
                              ? "border-violet-300 bg-violet-500/25 text-violet-50 shadow-[0_0_20px_rgba(168,85,247,0.35)]"
                              : "border-violet-400/20 bg-white/[0.02] text-violet-100/85 hover:border-violet-300 hover:bg-violet-500/15",
                          )}
                          onClick={() => setSettings((prev) => ({ ...prev, clipCount: count }))}
                        >
                          {count === 0 ? "Auto" : count}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="vcb-glass rounded-2xl border border-violet-400/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-violet-100">Timeline Actions</p>
                    <Badge className="border-violet-400/30 bg-violet-500/15 text-violet-100">{markers.length} markers</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 border-violet-400/30 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                    onClick={() => setShowTimeline((prev) => !prev)}
                  >
                    {showTimeline ? (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Hide markers
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add timeline markers
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="min-h-12 min-w-12 border-violet-400/35 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                      onClick={() => setPlaying((prev) => !prev)}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <input
                      className="vcb-range h-12 w-full"
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.01}
                      value={currentTime}
                      onChange={(event) => seekTo(Number(event.target.value))}
                    />
                    <span className="w-16 text-right text-xs text-violet-100/70">{currentTime.toFixed(1)}s</span>
                  </div>

                  <div
                    ref={timelineRailRef}
                    className="relative mt-3 h-10 cursor-pointer rounded-xl border border-violet-400/20 bg-white/[0.03]"
                    onClick={handleTimelineRailClick}
                  >
                    <div className="absolute left-0 top-0 h-full rounded-xl bg-violet-500/20" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />

                    {timelineNeedles.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        className={cn(
                          "vcb-marker absolute top-1/2 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 text-[10px]",
                          selectedMarkerId === marker.id
                            ? "border-violet-200 bg-violet-500 text-white"
                            : "border-violet-300/45 bg-[#1B1730] text-violet-100",
                        )}
                        style={{ left: `${marker.leftPct}%` }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedMarkerId(marker.id);
                          seekTo(marker.time);
                        }}
                      >
                        {marker.action === "effect" ? <Sparkles className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {showTimeline ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="mt-4 space-y-3"
                    >
                      {sortedMarkers.length === 0 ? (
                        <p className="rounded-xl border border-violet-400/20 bg-white/[0.03] p-3 text-xs text-violet-100/70">
                          Click the timeline rail to add a marker. Use Auto Suggest for AI-proposed edits.
                        </p>
                      ) : null}

                      {sortedMarkers.map((marker) => (
                        <div key={marker.id} className="rounded-xl border border-violet-400/20 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-violet-100">{marker.time.toFixed(2)}s</p>
                              <p className="text-[11px] text-violet-100/65">{MARKER_ACTION_LABELS[marker.action]}</p>
                            </div>
                            <button
                              type="button"
                              className="rounded-md p-2 text-violet-100/75 hover:bg-violet-500/20 hover:text-violet-50"
                              onClick={() => removeMarker(marker.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            <Input
                              value={marker.label}
                              onChange={(event) => updateMarker(marker.id, { label: event.target.value.slice(0, 70) })}
                              className="min-h-12 border-violet-400/20 bg-[#121229] text-violet-50"
                              placeholder="Marker label"
                            />

                            <Select
                              value={marker.action}
                              onValueChange={(value) =>
                                updateMarker(marker.id, {
                                  action: value as MarkerAction,
                                  label: MARKER_ACTION_LABELS[value as MarkerAction],
                                })
                              }
                            >
                              <SelectTrigger className="min-h-12 border-violet-400/20 bg-[#121229] text-violet-50">
                                <SelectValue placeholder="Action" />
                              </SelectTrigger>
                              <SelectContent className="border-violet-400/20 bg-[#121229] text-violet-50">
                                <SelectItem value="cut">Cut</SelectItem>
                                <SelectItem value="remove">Remove</SelectItem>
                                <SelectItem value="effect">Add Effect</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={marker.effectType}
                              onValueChange={(value) => updateMarker(marker.id, { effectType: value as MarkerEffect })}
                            >
                              <SelectTrigger className="min-h-12 border-violet-400/20 bg-[#121229] text-violet-50">
                                <SelectValue placeholder="Effect" />
                              </SelectTrigger>
                              <SelectContent className="border-violet-400/20 bg-[#121229] text-violet-50">
                                {Object.entries(MARKER_EFFECT_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {marker.action === "remove" ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs text-violet-100/70">Remove</span>
                              <Input
                                type="number"
                                min={1}
                                max={60}
                                value={marker.removeSeconds}
                                onChange={(event) =>
                                  updateMarker(marker.id, {
                                    removeSeconds: clamp(Number(event.target.value || 0), 1, 60),
                                  })
                                }
                                className="min-h-12 w-24 border-violet-400/20 bg-[#121229] text-violet-50"
                              />
                              <span className="text-xs text-violet-100/70">seconds</span>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-12 border-violet-400/35 bg-white/[0.03] text-violet-100 hover:bg-violet-500/15"
                              onClick={() => applyAutoSuggestion(marker.id)}
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              AI Assist
                            </Button>
                            {marker.aiSuggestion ? (
                              <p className="text-xs text-violet-100/75">{marker.aiSuggestion}</p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-violet-100/75">
                  Save exports crop coordinates + timeline action markers as JSON for backend processing.
                </p>
                <Button
                  type="button"
                  className="min-h-12 gap-2 bg-violet-600 text-white hover:bg-violet-500"
                  onClick={() => void saveToBackend()}
                  disabled={saving}
                >
                  {saving ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save + Send to /api/render"}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Mobile adaptation: this swaps the right-side settings panel for a bottom drawer on small screens. */}
        {isMobile ? (
          <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DrawerContent className="max-h-[86vh] overflow-y-auto border-violet-400/30 bg-gradient-to-b from-[#121227] to-[#0d0d18] p-0">
              <DrawerHeader className="border-b border-violet-400/20">
                <DrawerTitle className="text-violet-50">Builder Settings</DrawerTitle>
                <DrawerDescription className="text-violet-100/70">
                  Fine-tune crop behavior, top panel motion, and preview dynamics.
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4">{settingsPanel}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetContent
              side="right"
              className="w-[420px] border-violet-400/30 bg-gradient-to-b from-[#121227] to-[#0d0d18] p-5 data-[state=open]:duration-300 data-[state=closed]:duration-300"
            >
              <SheetHeader>
                <SheetTitle className="text-violet-50">Builder Settings</SheetTitle>
                <SheetDescription className="text-violet-100/70">
                  Fine-tune crop behavior, top panel motion, and preview dynamics.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">{settingsPanel}</div>
            </SheetContent>
          </Sheet>
        )}
      </section>
    </TooltipProvider>
  );
};

export const VerticalClipBuilder = (props: VerticalClipBuilderProps) => {
  return (
    <VerticalClipBuilderProvider>
      <VerticalClipBuilderInner {...props} />
    </VerticalClipBuilderProvider>
  );
};

export type {
  VerticalClipBuilderProps,
  VerticalRenderPayload,
  VerticalBuilderSettings,
  TimelineMarker,
  MarkerAction,
  MarkerEffect,
  FaceAnchor,
};
