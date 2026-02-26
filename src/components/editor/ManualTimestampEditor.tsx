import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Pause, Play, Sparkles, Trash2, X } from "lucide-react";

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

type ManualTimestampEditorProps = {
  markers: ManualTimestampMarker[];
  suggestions: ManualTimestampSuggestion[];
  durationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  autoAssist: boolean;
  aiSuggestLoading: boolean;
  retentionDelta: number | null;
  removeRatio: number;
  microHookSuggestions: Array<{ start: number; end: number }>;
  warning: string | null;
  editedUrl: string;
  originalUrl: string;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
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

const colorClassByType: Record<ManualMarkerType, string> = {
  keep: "bg-emerald-500/70 border-emerald-300/80",
  remove: "bg-rose-500/70 border-rose-300/80",
  hook: "bg-violet-500/70 border-violet-300/80",
};

const labelByType: Record<ManualMarkerType, string> = {
  keep: "Keep",
  remove: "Remove",
  hook: "Hook",
};

const ManualTimestampEditor = ({
  markers,
  suggestions,
  durationSec,
  currentTimeSec,
  isPlaying,
  autoAssist,
  aiSuggestLoading,
  retentionDelta,
  removeRatio,
  microHookSuggestions,
  warning,
  editedUrl,
  originalUrl,
  onTogglePlay,
  onSeek,
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
  const [zoom, setZoom] = useState(1.5);
  const [previewMode, setPreviewMode] = useState<"edited" | "split">("edited");
  const [dragState, setDragState] = useState<{ id: string; boundary: DragBoundary } | null>(null);
  const timelineInnerRef = useRef<HTMLDivElement | null>(null);
  const splitOriginalVideoRef = useRef<HTMLVideoElement | null>(null);
  const splitEditedVideoRef = useRef<HTMLVideoElement | null>(null);

  const sortedMarkers = useMemo(
    () => [...markers].sort((a, b) => a.start - b.start || a.end - b.end),
    [markers],
  );

  useEffect(() => {
    if (previewMode !== "split") return;
    const targets = [splitOriginalVideoRef.current, splitEditedVideoRef.current].filter(Boolean) as HTMLVideoElement[];
    for (const video of targets) {
      try {
        if (Number.isFinite(currentTimeSec) && Math.abs(video.currentTime - currentTimeSec) > 0.08) {
          video.currentTime = currentTimeSec;
        }
      } catch (_error) {
        // ignore sync drift in preview-only videos.
      }
      if (isPlaying) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    }
  }, [currentTimeSec, isPlaying, previewMode]);

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

  const createMarker = (type: ManualMarkerType) => {
    if (durationSec <= 0) return;
    if (!pendingMarker || pendingMarker.type !== type) {
      setPendingMarker({ type, start: currentTimeSec });
      return;
    }
    const start = clamp(Math.min(pendingMarker.start, currentTimeSec), 0, durationSec);
    const end = clamp(Math.max(pendingMarker.start, currentTimeSec), start + 0.05, durationSec);
    const marker: ManualTimestampMarker = {
      id: `${type}_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      type,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      source: "user",
    };
    onMarkersChange([...markers, marker]);
    setPendingMarker(null);
  };

  const removeMarker = (id: string) => {
    onMarkersChange(markers.filter((marker) => marker.id !== id));
  };

  const timelineCursorPercent = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0;
  const timelineWidthPercent = clamp(Math.round(zoom * 100), 100, 800);

  return (
    <div className="space-y-3 rounded-xl border border-violet-300/30 bg-violet-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-100">Manual Timestamp Editor</p>
          <p className="text-xs text-slate-300">Two-tap markers: first tap sets start, second tap sets end.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-violet-300/35 bg-black/20 px-2 py-1">
          <span className="text-xs text-slate-300">Auto Assist</span>
          <Switch checked={autoAssist} onCheckedChange={onAutoAssistChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onTogglePlay} className="gap-1">
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saveDisabled} className="gap-1">
          <Check className={`h-3.5 w-3.5 ${saving ? "animate-pulse" : ""}`} />
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => createMarker("keep")}>
          Set Cut Here
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => createMarker("remove")}>
          Mark to Remove
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => createMarker("hook")}>
          Set Hook Here
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRequestAiSuggest} disabled={aiSuggestLoading}>
          <Sparkles className={`mr-1 h-3.5 w-3.5 ${aiSuggestLoading ? "animate-spin" : ""}`} />
          AI Suggest
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClearAll}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Clear All
        </Button>
        <span className={`text-xs ${hasUnsavedChanges ? "text-amber-300" : "text-emerald-300"}`}>
          {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      {pendingMarker ? (
        <div className="rounded-lg border border-violet-300/40 bg-black/25 px-2 py-1 text-xs text-violet-100">
          {labelByType[pendingMarker.type]} start set at {formatTimelineTime(pendingMarker.start)}. Press the same button again to place end.
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span>{formatTimelineTime(currentTimeSec)}</span>
          <span>{formatTimelineTime(durationSec)}</span>
        </div>
        <Slider
          min={0}
          max={Math.max(durationSec, 0.001)}
          step={1 / 30}
          value={[Math.min(currentTimeSec, durationSec || 0)]}
          onValueChange={(value) => onSeek(clamp(Number(value?.[0] ?? 0), 0, durationSec))}
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Timeline zoom</span>
          <span>{zoom.toFixed(1)}x</span>
        </div>
        <Slider min={1} max={8} step={0.1} value={[zoom]} onValueChange={(value) => setZoom(clamp(Number(value?.[0] ?? 1), 1, 8))} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/30">
        <div
          ref={timelineInnerRef}
          className="relative h-20 min-w-full cursor-pointer"
          style={{ width: `${timelineWidthPercent}%` }}
          onClick={(event) => {
            if (durationSec <= 0 || !timelineInnerRef.current) return;
            const rect = timelineInnerRef.current.getBoundingClientRect();
            const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
            onSeek(Number((ratio * durationSec).toFixed(3)));
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
          {sortedMarkers.map((marker) => {
            const left = durationSec > 0 ? (marker.start / durationSec) * 100 : 0;
            const width = durationSec > 0 ? ((marker.end - marker.start) / durationSec) * 100 : 0;
            return (
              <div
                key={marker.id}
                className={`absolute top-5 h-10 rounded border ${colorClassByType[marker.type]}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.3)}%` }}
              >
                <button
                  type="button"
                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/60"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDragState({ id: marker.id, boundary: "start" });
                  }}
                />
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/60"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDragState({ id: marker.id, boundary: "end" });
                  }}
                />
              </div>
            );
          })}
          <div
            className="absolute top-2 bottom-2 w-0.5 bg-cyan-300"
            style={{ left: `${timelineCursorPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedMarkers.map((marker) => (
          <Badge key={marker.id} className="flex items-center gap-1 border-white/20 bg-black/25 text-slate-100">
            <span>{labelByType[marker.type]}</span>
            <span>{formatTimelineTime(marker.start)}-{formatTimelineTime(marker.end)}</span>
            <button type="button" onClick={() => removeMarker(marker.id)} className="rounded-full p-0.5 hover:bg-white/20">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {suggestions.length > 0 ? (
        <div className="rounded-lg border border-violet-300/30 bg-black/20 p-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-violet-100">AI Suggestions</p>
            <Button type="button" size="sm" variant="ghost" onClick={onApplyAllSuggestions}>
              Apply All
            </Button>
          </div>
          <div className="space-y-1.5">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/25 px-2 py-1 text-xs">
                <div className="min-w-0 flex-1 text-slate-200">
                  <span className="font-semibold">{suggestion.type.toUpperCase()}</span>{" "}
                  {formatTimelineTime(suggestion.start)}-{formatTimelineTime(suggestion.end)} - {suggestion.rationale}
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onAcceptSuggestion(suggestion.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRejectSuggestion(suggestion.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-slate-200">
          <p>Projected retention delta: {retentionDelta === null ? "n/a" : `${retentionDelta >= 0 ? "+" : ""}${retentionDelta.toFixed(1)} pts`}</p>
          <p>Removal ratio: {(removeRatio * 100).toFixed(1)}%</p>
          {warning ? <p className="mt-1 text-amber-300">{warning}</p> : null}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-slate-200">
          <p>Micro-hook hints: {microHookSuggestions.length}</p>
          {microHookSuggestions.slice(0, 3).map((range, index) => (
            <p key={`micro-hook-${index}`}>{formatTimelineTime(range.start)}-{formatTimelineTime(range.end)}</p>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-2">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <Button type="button" size="sm" variant={previewMode === "edited" ? "default" : "outline"} onClick={() => setPreviewMode("edited")}>
            Edited
          </Button>
          <Button type="button" size="sm" variant={previewMode === "split" ? "default" : "outline"} onClick={() => setPreviewMode("split")}>
            Side-by-side
          </Button>
        </div>
        {previewMode === "split" && originalUrl ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <video ref={splitOriginalVideoRef} src={originalUrl} muted className="aspect-video w-full rounded bg-black object-contain" />
            <video ref={splitEditedVideoRef} src={editedUrl} muted className="aspect-video w-full rounded bg-black object-contain" />
          </div>
        ) : (
          <video ref={splitEditedVideoRef} src={editedUrl} muted className="aspect-video w-full rounded bg-black object-contain" />
        )}
      </div>
    </div>
  );
};

export default ManualTimestampEditor;
