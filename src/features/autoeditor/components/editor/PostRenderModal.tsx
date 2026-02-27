import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";

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
import { resolveApiMediaUrl } from "@/lib/api";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const resolveFallbackAspectRatio = (mode: RenderJobResult["mode"] | null | undefined) =>
  mode === "horizontal" ? 16 / 9 : 9 / 16;

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

const EXPORT_RESOLUTION_OPTIONS = [
  { label: "720p", detail: "Faster uploads" },
  { label: "1080p", detail: "Balanced quality", recommended: true },
  { label: "4K", detail: "Maximum detail" },
] as const;

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
  onOpenFeedback: () => void;
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
  onOpenFeedback,
}: PostRenderModalProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [tooltip, setTooltip] = useState<InsightTooltip | null>(null);
  const [processingLogExpanded, setProcessingLogExpanded] = useState(false);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(resolveFallbackAspectRatio(result?.mode));

  const thumbnails = useMemo(
    () =>
      (result?.thumbnails?.slice(0, 6) || []).map((thumbnail) => ({
        ...thumbnail,
        url: resolveApiMediaUrl(thumbnail.url),
      })),
    [result?.thumbnails],
  );
  const outputVideoUrl = useMemo(() => resolveApiMediaUrl(result?.outputVideoUrl), [result?.outputVideoUrl]);
  const retentionScore = useMemo(() => getRetentionScore(result), [result]);
  const goodRetention = useMemo(() => isGoodRetention(retentionScore), [retentionScore]);
  const advice = useMemo(() => buildRetentionAdvice(result), [result]);
  const floatingPreviewThumbnail = useMemo(
    () => thumbnails.find((thumbnail) => thumbnail.id === selectedThumbnailId) || thumbnails[0] || null,
    [thumbnails, selectedThumbnailId],
  );

  useEffect(() => {
    if (!tooltip) return;
    const timer = window.setTimeout(() => setTooltip(null), 3000);
    return () => window.clearTimeout(timer);
  }, [tooltip]);

  useEffect(() => {
    setProcessingLogExpanded(false);
  }, [open, result?.jobId]);

  useEffect(() => {
    setPreviewAspectRatio(resolveFallbackAspectRatio(result?.mode));
  }, [result?.jobId, result?.mode]);

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
      <DialogContent className="ae-modal-content h-[95vh] w-[97vw] max-w-none overflow-hidden border-white/15 bg-[#13151d]/94 p-0 text-[#f6eee2] shadow-[0_42px_112px_-42px_rgba(0,0,0,0.96)] backdrop-blur-xl">
        <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[60%_40%]">
          <section className="overflow-y-auto border-b border-white/15 p-4 lg:border-b-0 lg:border-r lg:border-white/15 lg:p-5">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-[#fcf3e7]">Render Complete</DialogTitle>
              <DialogDescription className="text-[#bcaeb2]">
                Review retention graph, select thumbnail directions, and finalize the publish cut.
              </DialogDescription>
            </DialogHeader>

            {goodRetention ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="export-ready-card relative mb-4 overflow-hidden rounded-2xl border border-emerald-300/38 bg-emerald-500/12 p-3"
              >
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.24),transparent_52%),radial-gradient(circle_at_80%_70%,rgba(110,231,183,0.18),transparent_50%)]"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative z-[2]">
                  <div className="flex flex-wrap items-center justify-between gap-2 md:pr-28">
                    <div>
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-50">
                        <CheckCircle2 className="h-4 w-4" />
                        Video ready to export
                      </p>
                      <p className="mt-1 text-xs text-emerald-200/95">
                        Amazing retention: {retentionScore.toFixed(1)} / 100. Export package is complete.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1] hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
                        onClick={onOpenInsightsGraph}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Deep Dive
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-emerald-200/35 bg-emerald-500/12 text-emerald-50 hover:border-emerald-200/55 hover:bg-emerald-500/22"
                        onClick={onOpenFeedback}
                      >
                        <MessageSquareText className="h-4 w-4" />
                        Feedback
                      </Button>
                      {outputVideoUrl ? (
                        <Button asChild className="rounded-xl bg-emerald-500/80 text-white hover:bg-emerald-400">
                          <a href={outputVideoUrl} target="_blank" rel="noreferrer" download>
                            Continue to Export
                          </a>
                        </Button>
                      ) : (
                        <Button disabled className="rounded-xl bg-emerald-500/50 text-white">
                          Export unavailable
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {EXPORT_RESOLUTION_OPTIONS.map((option) => (
                      <div
                        key={option.label}
                        className={`rounded-xl border px-2.5 py-2 text-xs ${
                          option.recommended
                            ? "border-emerald-200/45 bg-emerald-400/14 text-emerald-50"
                            : "border-emerald-200/25 bg-emerald-500/10 text-emerald-100"
                        }`}
                      >
                        <p className="font-semibold">
                          {option.label}
                          {option.recommended ? " Recommended" : ""}
                        </p>
                        <p className="text-[11px] text-emerald-100/85">{option.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-emerald-100/88">
                    Choose your resolution and export now for TikTok, Reels, Shorts, or YouTube.
                  </p>
                </div>

                <div className="export-ready-float pointer-events-none absolute -right-2 top-3 hidden w-28 overflow-hidden rounded-xl border border-emerald-200/35 bg-[#0a1712]/75 shadow-[0_18px_36px_-20px_rgba(6,95,70,0.95)] backdrop-blur-sm md:block">
                  {floatingPreviewThumbnail ? (
                    <img
                      src={floatingPreviewThumbnail.url}
                      alt={`${floatingPreviewThumbnail.label} preview`}
                      className="w-full object-cover"
                      style={{ aspectRatio: previewAspectRatio }}
                    />
                  ) : (
                    <div
                      className="flex w-full items-center justify-center bg-emerald-500/10 text-[11px] text-emerald-100/85"
                      style={{ aspectRatio: previewAspectRatio }}
                    >
                      Preview
                    </div>
                  )}
                  <p className="border-t border-emerald-200/20 px-2 py-1 text-center text-[10px] uppercase tracking-[0.11em] text-emerald-100/85">
                    Floating preview
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="mb-4 rounded-2xl border border-amber-300/40 bg-amber-500/12 p-3">
                <p className="inline-flex items-center gap-1 text-sm font-semibold text-amber-50">
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
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Button
                    type="button"
                    className="rounded-xl bg-amber-500 text-[#231a10] hover:bg-amber-400"
                    onClick={onRerender}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Re-render
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1] hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
                    onClick={onOpenInsightsGraph}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Open Insights Graph
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1] hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
                    onClick={onOpenFeedback}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    Feedback
                  </Button>
                  {outputVideoUrl ? (
                    <Button asChild variant="outline" className="rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1] hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12">
                      <a href={outputVideoUrl} target="_blank" rel="noreferrer" download>
                        Continue Export
                      </a>
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1]">
                      Export unavailable
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/15 bg-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
                        ? "border-[#e6cfa9]/45 bg-[#d4b483]/15 shadow-[0_14px_30px_-22px_rgba(212,180,131,0.78)]"
                        : "border-white/15 bg-black/25 hover:border-white/25 hover:bg-black/35"
                    }`}
                  >
                    <img src={thumbnail.url} alt={thumbnail.label} className="aspect-video w-full rounded-lg object-cover" />
                    <p className="mt-1 px-1 text-xs text-[#d7cccf]">Option {index + 1}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <aside className="overflow-y-auto bg-black/15 p-4 lg:p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#bcaeb2]">Preview</p>
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_26px_64px_-36px_rgba(0,0,0,0.96)]">
              <video
                ref={previewRef}
                src={outputVideoUrl}
                controls
                autoPlay
                onLoadedMetadata={() => {
                  const video = previewRef.current;
                  if (!video || !video.videoWidth || !video.videoHeight) return;
                  const detected = clamp(video.videoWidth / video.videoHeight, 0.45, 2.35);
                  setPreviewAspectRatio(detected);
                }}
                className="w-full object-cover"
                style={{ aspectRatio: previewAspectRatio }}
              />
            </div>

            <div className="mt-3 rounded-xl border border-white/15 bg-black/35 p-3">
              <p className="text-sm font-medium text-[#f8efe2]">Selected thumbnail</p>
              <p className="mt-1 text-xs text-[#bcaeb2]">
                {thumbnails.find((thumb) => thumb.id === selectedThumbnailId)?.label || "Pick one of the six options."}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-white/15 bg-black/35 p-3">
              <p className="text-sm font-medium text-[#f8efe2]">Processing summary</p>
              <p className="mt-1 text-xs text-[#bcaeb2]">{result.retention.summary}</p>
              <p className="mt-2 text-[11px] text-[#9f9497]">{result.ffmpegCommands.length} FFmpeg commands recorded</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProcessingLogExpanded((value) => !value)}
                className="mt-2 w-full rounded-xl border-white/20 bg-white/[0.06] text-[#f6ede1] hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
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
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/15 bg-black/45 p-2 font-mono text-[11px] text-[#ddd3d6]">
                        {result.ffmpegCommands.map((command, index) => (
                          <p key={`${index}-${command.slice(0, 30)}`} className="break-all py-1">
                            <span className="mr-2 text-[#9f9497]">{String(index + 1).padStart(2, "0")}.</span>
                            {command}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[#9f9497]">No processing commands were logged for this render.</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full rounded-xl border-white/20 bg-white/[0.08] text-[#f6ede1] transition hover:-translate-y-0.5 hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
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
              className="pointer-events-none fixed bottom-6 left-1/2 z-[80] w-[min(90vw,420px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/72 px-4 py-3 shadow-[0_28px_56px_-34px_rgba(0,0,0,0.96)] backdrop-blur-lg"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-[#d8ced1]">{tooltip.title}</p>
              <p className="mt-1 text-sm text-[#f9f1e5]">{tooltip.description}</p>
              <p className="mt-1 text-xs text-[#bcaeb2]">Seeked to {tooltip.timestamp.toFixed(1)}s</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
