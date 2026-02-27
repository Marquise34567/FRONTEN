import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Film, Plus, Scissors, Sparkles, Target, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Segment } from "@/features/autoeditor/types";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  const ms = Math.floor((safe % 1) * 10)
    .toString()
    .padStart(1, "0");
  return `${mins}:${secs}.${ms}`;
};

type ManualTimestampModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  duration: number;
  scrubberTime: number;
  segments: Segment[];
  onScrub: (value: number) => void;
  onAddSegment: () => void;
  onRemoveSegment: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
};

type SegmentTool = "keep" | "remove" | "hook";

const SEGMENT_TOOL_OPTIONS: Array<{
  value: SegmentTool;
  label: string;
  description: string;
  icon: typeof Film;
}> = [
  { value: "keep", label: "Keep", description: "Preserve this moment in final cut", icon: Film },
  { value: "remove", label: "Remove", description: "Trim distraction or low-retention span", icon: Scissors },
  { value: "hook", label: "Hook", description: "Force a sharp opener segment", icon: Sparkles },
];

const TOOL_BADGE_CLASS: Record<SegmentTool, string> = {
  keep: "border-emerald-300/35 bg-emerald-400/14 text-emerald-100",
  remove: "border-rose-300/35 bg-rose-400/14 text-rose-100",
  hook: "border-amber-300/35 bg-amber-400/14 text-amber-100",
};

const TOOL_BAR_CLASS: Record<SegmentTool, string> = {
  keep: "bg-emerald-300/70",
  remove: "bg-rose-300/70",
  hook: "bg-amber-300/70",
};

const TOOL_CYCLE: SegmentTool[] = ["keep", "hook", "remove"];

export default function ManualTimestampModal({
  open,
  onOpenChange,
  videoUrl,
  duration,
  scrubberTime,
  segments,
  onScrub,
  onAddSegment,
  onRemoveSegment,
  onUpdateSegment,
}: ManualTimestampModalProps) {
  const beforeRef = useRef<HTMLVideoElement | null>(null);
  const afterRef = useRef<HTMLVideoElement | null>(null);
  const pendingToolRef = useRef<SegmentTool | null>(null);
  const previousSegmentIdsRef = useRef<string[]>([]);
  const safeDuration = Math.max(0, duration || 0);
  const [activeTool, setActiveTool] = useState<SegmentTool>("keep");
  const [segmentToolById, setSegmentToolById] = useState<Record<string, SegmentTool>>({});

  useEffect(() => {
    if (!open) return;
    const sync = (node: HTMLVideoElement | null) => {
      if (!node) return;
      node.currentTime = Math.max(0, Math.min(safeDuration || 0, scrubberTime));
    };

    sync(beforeRef.current);
    sync(afterRef.current);
  }, [open, scrubberTime, safeDuration]);

  useEffect(() => {
    const previousIds = previousSegmentIdsRef.current;
    const currentIds = segments.map((segment) => segment.id);
    const addedIds = currentIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !currentIds.includes(id));
    const pendingTool = pendingToolRef.current;

    if (addedIds.length && pendingTool) {
      setSegmentToolById((state) => {
        const next = { ...state };
        addedIds.forEach((id) => {
          next[id] = pendingTool;
        });
        return next;
      });

      if (pendingTool === "hook" || pendingTool === "remove") {
        const nextLength = pendingTool === "hook" ? 3 : 2.2;
        addedIds.forEach((id) => {
          const segment = segments.find((item) => item.id === id);
          if (!segment) return;
          onUpdateSegment(id, {
            end: Math.min(safeDuration || segment.end, segment.start + nextLength),
          });
        });
      }
    }

    if (removedIds.length) {
      setSegmentToolById((state) => {
        let changed = false;
        const next = { ...state };
        removedIds.forEach((id) => {
          if (id in next) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : state;
      });
    }

    previousSegmentIdsRef.current = currentIds;
    pendingToolRef.current = null;
  }, [onUpdateSegment, safeDuration, segments]);

  const scrubberPct = useMemo(() => {
    if (!safeDuration) return 0;
    return Math.max(0, Math.min(100, (scrubberTime / safeDuration) * 100));
  }, [safeDuration, scrubberTime]);

  const activeToolMeta = useMemo(
    () => SEGMENT_TOOL_OPTIONS.find((tool) => tool.value === activeTool) || SEGMENT_TOOL_OPTIONS[0],
    [activeTool],
  );

  const timelineTicks = useMemo(() => Array.from({ length: 11 }, (_, index) => index / 10), []);

  const resolveSegmentTool = (id: string): SegmentTool => segmentToolById[id] || "keep";

  const cycleSegmentTool = (id: string) => {
    setSegmentToolById((state) => {
      const current = state[id] || "keep";
      const next = TOOL_CYCLE[(TOOL_CYCLE.indexOf(current) + 1) % TOOL_CYCLE.length];
      return { ...state, [id]: next };
    });
  };

  const handleAddSegment = () => {
    pendingToolRef.current = activeTool;
    onAddSegment();
  };

  const handleRemoveSegment = (id: string) => {
    setSegmentToolById((state) => {
      if (!(id in state)) return state;
      const next = { ...state };
      delete next[id];
      return next;
    });
    onRemoveSegment(id);
  };

  const getPreviewAspectClass = safeDuration ? "aspect-video" : "aspect-[16/10]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ae-modal-content h-[96vh] w-[98vw] max-w-none overflow-hidden border-white/10 bg-[#0f1117]/96 p-0 text-slate-100 shadow-[0_40px_110px_-42px_rgba(2,6,23,0.98)] backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-white/10 bg-black/20 px-5 py-4 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight text-slate-100">
                  Manual Timestamp Editor
                </DialogTitle>
                <DialogDescription className="mt-1 text-slate-400">
                  Frame-accurate split review. Build precise keep/remove/hook segments with timeline-grade controls.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                  {segments.length} segments
                </span>
                <span className="rounded-full border border-blue-300/35 bg-blue-500/14 px-3 py-1 text-xs text-blue-100">
                  {formatTime(scrubberTime)} / {formatTime(safeDuration)}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="grid min-h-0 gap-4 overflow-hidden">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Before</p>
                    <Film className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className={cn("relative", getPreviewAspectClass)}>
                    {videoUrl ? (
                      <video ref={beforeRef} src={videoUrl} muted controls className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Upload video to preview
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">After</p>
                    <Scissors className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className={cn("relative", getPreviewAspectClass)}>
                    {videoUrl ? (
                      <>
                        <video ref={afterRef} src={videoUrl} muted controls className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-500/12 via-transparent to-slate-300/5" />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        No processed preview yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Timeline Toolbar</p>
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1">
                    {SEGMENT_TOOL_OPTIONS.map((tool) => {
                      const selected = activeTool === tool.value;
                      return (
                        <button
                          key={tool.value}
                          type="button"
                          onClick={() => setActiveTool(tool.value)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition",
                            selected
                              ? TOOL_BADGE_CLASS[tool.value]
                              : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.06]",
                          )}
                        >
                          <tool.icon className="h-3.5 w-3.5" />
                          {tool.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-400">{activeToolMeta.description}</p>

                <div className="relative mt-3">
                  <div className="pointer-events-none absolute inset-x-0 top-3 h-[0.6rem] rounded-full border border-white/10 bg-black/55" />
                  {timelineTicks.map((tick) => (
                    <div
                      key={tick}
                      className="pointer-events-none absolute top-[0.32rem] h-[0.35rem] w-px bg-white/20"
                      style={{ left: `${tick * 100}%` }}
                    />
                  ))}
                  {segments.map((segment) => {
                    if (!safeDuration) return null;
                    const left = (segment.start / safeDuration) * 100;
                    const width = ((segment.end - segment.start) / safeDuration) * 100;
                    const tool = resolveSegmentTool(segment.id);
                    return (
                      <motion.div
                        key={segment.id}
                        layout
                        className={cn(
                          "pointer-events-none absolute top-[0.17rem] h-[0.9rem] rounded-full",
                          TOOL_BAR_CLASS[tool],
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(1, width)}%`,
                        }}
                      />
                    );
                  })}
                  <div
                    className="pointer-events-none absolute top-0 h-6 w-6 rounded-full border border-white/70 bg-blue-200/95 shadow-[0_14px_30px_-18px_rgba(96,165,250,0.98),0_0_0_5px_rgba(96,165,250,0.18)]"
                    style={{ left: `calc(${scrubberPct}% - 0.7rem)` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={safeDuration || 1}
                    step={0.04}
                    value={Math.max(0, Math.min(scrubberTime, safeDuration || 1))}
                    onChange={(event) => onScrub(Number(event.currentTarget.value))}
                    className="ae-modal-scrubber relative z-20 h-8 w-full cursor-pointer appearance-none bg-transparent"
                  />
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>00:00.0</span>
                  <span>{formatTime(safeDuration)}</span>
                </div>
              </div>

              <div className="grid max-h-[32vh] gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {segments.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-slate-500">
                    No segments yet. Scrub timeline and add your first timestamp window.
                  </p>
                ) : (
                  segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      className="grid grid-cols-[44px_1fr_1fr_98px_76px] items-center gap-2 rounded-xl border border-white/10 bg-[#121827]/80 px-2.5 py-2"
                    >
                      <span className="text-xs text-slate-400">#{index + 1}</span>
                      <Input
                        type="number"
                        min={0}
                        max={safeDuration || undefined}
                        step={0.1}
                        value={Number(segment.start.toFixed(1))}
                        onChange={(event) => onUpdateSegment(segment.id, { start: Number(event.currentTarget.value) })}
                        className="h-8 border-white/10 bg-black/35 text-xs text-slate-100"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={safeDuration || undefined}
                        step={0.1}
                        value={Number(segment.end.toFixed(1))}
                        onChange={(event) => onUpdateSegment(segment.id, { end: Number(event.currentTarget.value) })}
                        className="h-8 border-white/10 bg-black/35 text-xs text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => cycleSegmentTool(segment.id)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition",
                          TOOL_BADGE_CLASS[resolveSegmentTool(segment.id)],
                        )}
                        title="Cycle segment role"
                      >
                        {resolveSegmentTool(segment.id)}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 border border-white/10 text-xs text-rose-200 hover:bg-rose-500/12"
                        onClick={() => handleRemoveSegment(segment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Trim
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <aside className="min-h-0 rounded-2xl border border-white/10 bg-black/35 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Actions</p>
              <div className="mt-3 space-y-2">
                <Button
                  type="button"
                  onClick={handleAddSegment}
                  className="w-full rounded-xl bg-blue-500 text-slate-100 shadow-[0_16px_32px_-22px_rgba(96,165,250,0.88)] transition-all hover:-translate-y-0.5 hover:bg-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  Add {activeToolMeta.label} Segment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl border-white/15 bg-white/[0.08] text-slate-100 transition-all hover:-translate-y-0.5 hover:bg-white/[0.14]"
                >
                  <Target className="h-4 w-4" />
                  Apply Timestamps
                </Button>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Current Focus</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{activeToolMeta.label} Mode</p>
                <p className="mt-1 text-xs text-slate-400">{activeToolMeta.description}</p>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Precision</p>
                <p className="mt-1 text-sm text-slate-200">Scrubber: {formatTime(scrubberTime)}</p>
                <p className="mt-1 text-xs text-slate-400">Use decimal inputs for frame-near cut alignment.</p>
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
