import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RetentionLineGraph from "@/features/autoeditor/components/editor/RetentionLineGraph";
import {
  GOOD_RETENTION_THRESHOLD,
  buildRetentionAdvice,
  getRetentionScore,
  isGoodRetention,
} from "@/features/autoeditor/lib/retentionQuality";
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
  onRerender: () => void;
  onOpenInsightsGraph: () => void;
};

export default function PostRenderModal({
  open,
  onOpenChange,
  result,
  selectedPointId,
  onSelectedPointIdChange,
  selectedThumbnailId,
  onSelectedThumbnailIdChange,
  onRerender,
  onOpenInsightsGraph,
}: PostRenderModalProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [tooltip, setTooltip] = useState<InsightTooltip | null>(null);
  const [processingLogExpanded, setProcessingLogExpanded] = useState(false);

  const thumbnails = useMemo(() => result?.thumbnails?.slice(0, 6) || [], [result]);
  const retentionScore = useMemo(() => getRetentionScore(result), [result]);
  const goodRetention = useMemo(() => isGoodRetention(retentionScore), [retentionScore]);
  const advice = useMemo(() => buildRetentionAdvice(result), [result]);

  useEffect(() => {
    if (!tooltip) return;
    const timer = window.setTimeout(() => setTooltip(null), 3000);
    return () => window.clearTimeout(timer);
  }, [tooltip]);

  useEffect(() => {
    setProcessingLogExpanded(false);
  }, [open, result?.jobId]);

  if (!result || result.status !== "completed") return null;

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

            {goodRetention ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-4 overflow-hidden rounded-2xl border border-emerald-300/35 bg-emerald-500/10 p-3"
              >
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.24),transparent_52%),radial-gradient(circle_at_80%_70%,rgba(110,231,183,0.18),transparent_50%)]"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-100">
                      <Sparkles className="h-4 w-4" />
                      Amazing retention: {retentionScore.toFixed(1)} / 100
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/95">
                      50+ is strong. This cut is ready for export.
                    </p>
                  </div>
                  <Button asChild className="rounded-xl bg-emerald-500/80 text-white hover:bg-emerald-400">
                    <a href={result.outputVideoUrl} target="_blank" rel="noreferrer">
                      Continue to Export
                    </a>
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="mb-4 rounded-2xl border border-amber-300/35 bg-amber-500/10 p-3">
                <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Retention {retentionScore.toFixed(1)} / 100 is below the {GOOD_RETENTION_THRESHOLD} target.
                </p>
                <p className="mt-1 text-xs text-amber-100/90">
                  You can re-render now, continue export, or inspect the graph for targeted improvements.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-50/95">
                  {advice.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    className="rounded-xl bg-amber-500 text-slate-900 hover:bg-amber-400"
                    onClick={onRerender}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Re-render
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/15 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14]"
                    onClick={onOpenInsightsGraph}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Open Insights Graph
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl border-white/15 bg-white/[0.08] text-slate-100 hover:bg-white/[0.14]">
                    <a href={result.outputVideoUrl} target="_blank" rel="noreferrer">
                      Continue Export
                    </a>
                  </Button>
                </div>
              </div>
            )}

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
              <Button
                type="button"
                variant="outline"
                onClick={() => setProcessingLogExpanded((value) => !value)}
                className="mt-2 w-full rounded-xl border-white/15 bg-white/[0.06] text-slate-100 hover:bg-white/[0.12]"
              >
                {processingLogExpanded ? (
                  <span className="inline-flex items-center gap-1">
                    <ChevronUp className="h-4 w-4" />
                    Hide Processing Log
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ChevronDown className="h-4 w-4" />
                    Show Processing Log
                  </span>
                )}
              </Button>

              <AnimatePresence initial={false}>
                {processingLogExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {result.ffmpegCommands.length > 0 ? (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/45 p-2 font-mono text-[11px] text-slate-300">
                        {result.ffmpegCommands.map((command, index) => (
                          <p key={`${index}-${command.slice(0, 30)}`} className="break-all py-1">
                            <span className="mr-2 text-slate-500">{String(index + 1).padStart(2, "0")}.</span>
                            {command}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No processing commands were logged for this render.</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
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
