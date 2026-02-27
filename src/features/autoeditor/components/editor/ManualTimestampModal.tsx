import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Film, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const safeDuration = Math.max(0, duration || 0);

  useEffect(() => {
    if (!open) return;
    const sync = (node: HTMLVideoElement | null) => {
      if (!node) return;
      node.currentTime = Math.max(0, Math.min(safeDuration || 0, scrubberTime));
    };

    sync(beforeRef.current);
    sync(afterRef.current);
  }, [open, scrubberTime, safeDuration]);

  const scrubberPct = useMemo(() => {
    if (!safeDuration) return 0;
    return Math.max(0, Math.min(100, (scrubberTime / safeDuration) * 100));
  }, [safeDuration, scrubberTime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[96vh] w-[98vw] max-w-none overflow-hidden border-white/10 bg-[#0f1117]/95 p-0 backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-white/10 px-5 py-4">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-100">
              Manual Timestamp Editor
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Immersive split review for before/after pacing. Add exact cut windows and scrub with frame-level precision.
            </DialogDescription>
          </DialogHeader>

          <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Before</p>
                <Film className="h-4 w-4 text-slate-500" />
              </div>
              <div className="relative h-[calc(100%-38px)]">
                {videoUrl ? (
                  <video ref={beforeRef} src={videoUrl} muted controls className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Upload video to preview</div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">After</p>
                <Scissors className="h-4 w-4 text-blue-300" />
              </div>
              <div className="relative h-[calc(100%-38px)]">
                {videoUrl ? (
                  <>
                    <video ref={afterRef} src={videoUrl} muted controls className="h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-slate-300/5" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">No processed preview yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#111521]/85 px-4 py-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>Scrub: {formatTime(scrubberTime)}</span>
              <span>Duration: {formatTime(safeDuration)}</span>
            </div>
            <div className="relative mb-3 rounded-xl border border-white/10 bg-black/35 px-3 py-3">
              <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-slate-600/70" />
              {segments.map((segment) => {
                if (!safeDuration) return null;
                const left = `${(segment.start / safeDuration) * 100}%`;
                const width = `${((segment.end - segment.start) / safeDuration) * 100}%`;
                return (
                  <motion.div
                    key={segment.id}
                    layout
                    className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-blue-400/45"
                    style={{ left, width }}
                  />
                );
              })}
              <div
                className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/60 bg-blue-300/90 shadow-[0_0_18px_rgba(96,165,250,0.5)]"
                style={{ left: `calc(${scrubberPct}% + 0.75rem)` }}
              />
              <input
                type="range"
                min={0}
                max={safeDuration || 1}
                step={0.05}
                value={Math.max(0, Math.min(scrubberTime, safeDuration || 1))}
                onChange={(event) => onScrub(Number(event.currentTarget.value))}
                className="relative z-20 h-6 w-full cursor-pointer appearance-none bg-transparent"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-2">
                {segments.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-500">No segments yet. Scrub and add a timestamp window.</p>
                ) : (
                  segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      className="grid grid-cols-[40px_1fr_1fr_72px] items-center gap-2 rounded-lg border border-white/10 bg-[#121827]/75 px-2 py-2"
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
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 border border-white/10 text-xs text-rose-200 hover:bg-rose-500/10"
                        onClick={() => onRemoveSegment(segment.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Actions</p>
                <Button
                  type="button"
                  onClick={onAddSegment}
                  className="w-full bg-blue-500 text-slate-100 hover:bg-blue-400"
                >
                  Add Segment at Scrubber
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                >
                  Apply Timestamps
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
