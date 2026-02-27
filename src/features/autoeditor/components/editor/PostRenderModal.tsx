import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RetentionLineGraph from "@/features/autoeditor/components/editor/RetentionLineGraph";
import type { InsightTooltip, RenderJobResult, RetentionPoint } from "@/features/autoeditor/types";

const tooltipFromPoint = (point: RetentionPoint): InsightTooltip => {
  if (point.type === "best") {
    return {
      title: "Peak Engagement",
      description: "Strong watch-through at this segment.",
      timestamp: point.timestamp,
    };
  }
  if (point.type === "worst") {
    return {
      title: "Drop-off",
      description: "Compression or context tweak recommended.",
      timestamp: point.timestamp,
    };
  }
  if (point.type === "skip_zone") {
    return {
      title: "Skip Zone",
      description: "Try a stronger transition or visual cue.",
      timestamp: point.timestamp,
    };
  }
  return {
    title: "Retention Signal",
    description: "Retention event selected.",
    timestamp: point.timestamp,
  };
};

type PostRenderModalProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  result: RenderJobResult | null;
  selectedPointId: string | null;
  onSelectedPointIdChange: (value: string | null) => void;
  selectedThumbnailId: string | null;
  onSelectedThumbnailIdChange: (value: string | null) => void;
};

export default function PostRenderModal({
  open,
  onOpenChange,
  result,
  selectedPointId,
  onSelectedPointIdChange,
  selectedThumbnailId,
  onSelectedThumbnailIdChange,
}: PostRenderModalProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [tooltip, setTooltip] = useState<InsightTooltip | null>(null);

  const thumbnails = useMemo(() => result?.thumbnails?.slice(0, 6) || [], [result]);

  useEffect(() => {
    if (!tooltip) return;
    const timer = window.setTimeout(() => setTooltip(null), 3000);
    return () => window.clearTimeout(timer);
  }, [tooltip]);

  if (!result) return null;

  const handleSelectPoint = (point: RetentionPoint) => {
    onSelectedPointIdChange(point.id);
    setTooltip(tooltipFromPoint(point));
    if (previewRef.current) {
      previewRef.current.currentTime = Math.max(0, point.timestamp);
      void previewRef.current.play().catch(() => null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ae-modal-content h-[95vh] w-[97vw] max-w-none overflow-hidden border-white/10 bg-[#0f1117]/94 p-0 text-slate-100 shadow-[0_38px_110px_-40px_rgba(2,6,23,0.98)] backdrop-blur-xl">
        <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[60%_40%]">
          <section className="overflow-y-auto border-b border-white/10 p-4 lg:border-b-0 lg:border-r lg:border-white/10 lg:p-5">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-50">Render Complete</DialogTitle>
              <DialogDescription className="text-slate-400">
                Review retention graph, select thumbnail directions, and finalize the publish cut.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <RetentionLineGraph
                points={result.retention.points}
                heatmap={result.retention.heatmap}
                selectedPointId={selectedPointId}
                onPointSelect={handleSelectPoint}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {thumbnails.map((thumbnail, index) => {
                const selected = selectedThumbnailId === thumbnail.id;
                return (
                  <motion.button
                    key={thumbnail.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 240, damping: 22 }}
                    onClick={() => onSelectedThumbnailIdChange(thumbnail.id)}
                    className={`overflow-hidden rounded-xl border p-1 text-left transition ${
                      selected
                        ? "border-blue-300/45 bg-blue-500/12 shadow-[0_14px_30px_-22px_rgba(96,165,250,0.8)]"
                        : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
                    }`}
                  >
                    <img src={thumbnail.url} alt={thumbnail.label} className="aspect-video w-full rounded-lg object-cover" />
                    <p className="mt-1 px-1 text-xs text-slate-300">Option {index + 1}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <aside className="overflow-y-auto bg-black/15 p-4 lg:p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Looping Preview</p>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_26px_64px_-36px_rgba(2,6,23,0.96)]">
              <video
                ref={previewRef}
                src={result.outputVideoUrl}
                controls
                autoPlay
                loop
                className="aspect-[9/16] w-full object-cover"
              />
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-sm font-medium text-slate-100">Selected thumbnail</p>
              <p className="mt-1 text-xs text-slate-400">
                {thumbnails.find((thumb) => thumb.id === selectedThumbnailId)?.label || "Pick one of the six options."}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-sm font-medium text-slate-100">Processing summary</p>
              <p className="mt-1 text-xs text-slate-400">{result.retention.summary}</p>
              <p className="mt-2 text-[11px] text-slate-500">{result.ffmpegCommands.length} FFmpeg commands recorded</p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full rounded-xl border-white/15 bg-white/[0.08] text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.14]"
              onClick={() => onOpenChange(false)}
            >
              Close Review
            </Button>
          </aside>
        </div>

        <AnimatePresence>
          {tooltip ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pointer-events-none fixed bottom-6 left-1/2 z-[80] w-[min(90vw,420px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 shadow-[0_28px_56px_-34px_rgba(2,6,23,0.98)] backdrop-blur-lg"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-slate-300">{tooltip.title}</p>
              <p className="mt-1 text-sm text-slate-100">{tooltip.description}</p>
              <p className="mt-1 text-xs text-slate-400">Seeked to {tooltip.timestamp.toFixed(1)}s</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
