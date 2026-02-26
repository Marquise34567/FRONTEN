import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Check, Pause, Play, Sparkles, Trash2, X } from "lucide-react";

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
  const removalPercent = clamp(removeRatio * 100, 0, 100);
  const retentionLabel =
    retentionDelta === null ? "n/a" : `${retentionDelta >= 0 ? "+" : ""}${retentionDelta.toFixed(1)} pts`;
  const markedPercent = durationSec > 0 ? clamp((markedDuration / durationSec) * 100, 0, 100) : 0;

  return (
    <section className="manual-editor-shell space-y-4 rounded-2xl border border-cyan-200/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="manual-editor-eyebrow text-[11px] uppercase tracking-[0.18em] text-cyan-200/85">
            Premium Timeline
          </p>
          <p className="text-base font-semibold text-slate-100 sm:text-lg">Manual Timestamp Editor</p>
          <p className="text-xs text-slate-300">Two-tap markers: first tap sets start, second tap sets end.</p>
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

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Playhead</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{formatTimelineTime(currentTimeSec)}</p>
          <p className="text-[11px] text-slate-400">Total {formatTimelineTime(durationSec)}</p>
        </div>
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Markers</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{sortedMarkers.length}</p>
          <p className="text-[11px] text-slate-400">
            {markerCounts.keep} keep • {markerCounts.remove} remove • {markerCounts.hook} hook
          </p>
        </div>
        <div className="manual-editor-stat rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Coverage</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{markedPercent.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-400">{formatTimelineTime(markedDuration)} tagged</p>
        </div>
      </div>

      <div className="manual-editor-toolbar rounded-xl border border-white/10 bg-black/25 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onTogglePlay} className="gap-1.5">
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? "Pause" : "Play"}
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
            Save
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

        <Separator className="my-3 bg-white/10" />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => createMarker("keep")}
            className={cn(pendingMarker?.type === "keep" && "border-emerald-300/55 bg-emerald-500/15 text-emerald-100")}
          >
            Keep Segment
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => createMarker("remove")}
            className={cn(pendingMarker?.type === "remove" && "border-rose-300/55 bg-rose-500/15 text-rose-100")}
          >
            Remove Segment
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => createMarker("hook")}
            className={cn(pendingMarker?.type === "hook" && "border-cyan-300/55 bg-cyan-500/15 text-cyan-100")}
          >
            Hook Segment
          </Button>
        </div>
      </div>

      {pendingMarker ? (
        <div className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-100">
          {labelByType[pendingMarker.type]} start set at {formatTimelineTime(pendingMarker.start)}. Press the same button
          again to place the end.
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/25 p-3">
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
          className="manual-editor-slider mt-2"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Timeline zoom</span>
          <span>{zoom.toFixed(1)}x</span>
        </div>
        <Slider
          min={1}
          max={8}
          step={0.1}
          value={[zoom]}
          onValueChange={(value) => setZoom(clamp(Number(value?.[0] ?? 1), 1, 8))}
          className="manual-editor-slider mt-1.5"
        />

        <div className="manual-editor-timeline-scroll mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/35">
          <div
            ref={timelineInnerRef}
            className="manual-editor-timeline-inner relative h-24 min-w-full cursor-pointer"
            style={{ width: `${timelineWidthPercent}%` }}
            onClick={(event) => {
              if (durationSec <= 0 || !timelineInnerRef.current) return;
              const rect = timelineInnerRef.current.getBoundingClientRect();
              const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
              onSeek(Number((ratio * durationSec).toFixed(3)));
            }}
          >
            <div className="manual-editor-timeline-track absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full" />
            {sortedMarkers.map((marker) => {
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
            })}
            <div className="manual-editor-cursor absolute top-2 bottom-2 w-0.5" style={{ left: `${timelineCursorPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-100">Markers</p>
            <Badge className="border-white/15 bg-white/5 text-slate-100">{sortedMarkers.length}</Badge>
          </div>
          {sortedMarkers.length > 0 ? (
            <ScrollArea className="max-h-44 pr-2">
              <div className="space-y-2">
                {sortedMarkers.map((marker) => (
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
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-slate-400">No markers yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-100">AI Suggestions</p>
            <Button type="button" size="sm" variant="ghost" onClick={onApplyAllSuggestions} disabled={suggestions.length === 0}>
              Apply All
            </Button>
          </div>
          {suggestions.length > 0 ? (
            <ScrollArea className="max-h-44 pr-2">
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
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
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-slate-400">No AI suggestions yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
            <Gauge className="h-4 w-4 text-cyan-200" />
            Quality Signals
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-slate-200">
            <p>Projected retention delta: {retentionLabel}</p>
            <p className="mt-1">Micro-hook hints: {microHookSuggestions.length}</p>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <div className="flex items-center justify-between text-xs text-slate-200">
              <span>Removal ratio</span>
              <span>{removalPercent.toFixed(1)}%</span>
            </div>
            <Progress value={removalPercent} className="manual-editor-progress mt-2 h-2 bg-white/10" />
          </div>
          {warning ? (
            <p className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/12 px-2.5 py-2 text-xs text-amber-100">
              {warning}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value === "split" ? "split" : "edited")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-100">Realtime Preview</p>
              <TabsList className="manual-editor-tabs-list h-8 p-0.5">
                <TabsTrigger value="edited" className="manual-editor-tabs-trigger h-7 px-3 text-xs">
                  Edited
                </TabsTrigger>
                <TabsTrigger value="split" className="manual-editor-tabs-trigger h-7 px-3 text-xs">
                  Side-by-side
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="edited" className="mt-0">
              <video
                ref={splitEditedVideoRef}
                src={editedUrl}
                muted
                className="manual-editor-video aspect-video w-full rounded-lg bg-black object-contain"
                aria-label="Realtime edited preview"
              />
            </TabsContent>
            <TabsContent value="split" className="mt-0">
              {originalUrl ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <video
                    ref={splitEditedVideoRef}
                    src={editedUrl}
                    muted
                    className="manual-editor-video aspect-video w-full rounded-lg bg-black object-contain"
                    aria-label="Realtime edited preview"
                  />
                  <video
                    ref={splitOriginalVideoRef}
                    src={originalUrl}
                    muted
                    className="manual-editor-video aspect-video w-full rounded-lg bg-black object-contain"
                    aria-label="Original preview"
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400">Original preview unavailable.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
};

export default ManualTimestampEditor;
