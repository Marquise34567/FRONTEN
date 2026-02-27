import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import RetentionLineGraph from "@/features/autoeditor/components/editor/RetentionLineGraph";
import {
  buildRetentionAdvice,
  getRetentionScore,
  isGoodRetention,
} from "@/features/autoeditor/lib/retentionQuality";
import type { InsightTooltip, RenderJobResult, RetentionPoint } from "@/features/autoeditor/types";
import { resolveApiMediaUrl } from "@/lib/api";

const pointInsight = (point: RetentionPoint): InsightTooltip => {
  switch (point.type) {
    case "best":
      return {
        title: "Peak Engagement",
        description: "Viewers hooked here.",
        timestamp: point.timestamp,
      };
    case "worst":
      return {
        title: "Drop-off",
        description: "Consider tighter pacing.",
        timestamp: point.timestamp,
      };
    case "skip_zone":
      return {
        title: "Skip Zone",
        description: "Test a stronger hook or faster transition.",
        timestamp: point.timestamp,
      };
    case "emotional_peak":
      return {
        title: "Emotional Peak",
        description: "Strong narrative beat. Preserve this segment.",
        timestamp: point.timestamp,
      };
    case "hook":
    default:
      return {
        title: "Hook Moment",
        description: "High early retention signal.",
        timestamp: point.timestamp,
      };
  }
};

type RetentionInsightsProps = {
  result: RenderJobResult | null;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  selectedPointId: string | null;
  onSelectedPointIdChange: (value: string | null) => void;
};

export default function RetentionInsights({
  result,
  expanded,
  onExpandedChange,
  selectedPointId,
  onSelectedPointIdChange,
}: RetentionInsightsProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [tooltip, setTooltip] = useState<InsightTooltip | null>(null);
  const [processingLogExpanded, setProcessingLogExpanded] = useState(false);

  const selectedPoint = useMemo(() => {
    if (!result?.retention.points.length) return null;
    return result.retention.points.find((point) => point.id === selectedPointId) || result.retention.points[0];
  }, [result, selectedPointId]);
  const outputVideoUrl = useMemo(
    () => resolveApiMediaUrl(result?.outputVideoUrl || result?.clipUrls?.[0] || ""),
    [result?.clipUrls, result?.outputVideoUrl],
  );
  const retentionScore = useMemo(() => getRetentionScore(result), [result]);
  const goodRetention = useMemo(() => isGoodRetention(retentionScore), [retentionScore]);
  const advice = useMemo(() => buildRetentionAdvice(result), [result]);

  useEffect(() => {
    if (!tooltip) return;
    const timer = window.setTimeout(() => setTooltip(null), 3200);
    return () => window.clearTimeout(timer);
  }, [tooltip]);

  useEffect(() => {
    setProcessingLogExpanded(false);
  }, [result?.jobId]);

  if (!result || result.status !== "completed") return null;

  const handlePointSelect = (point: RetentionPoint) => {
    onSelectedPointIdChange(point.id);
    setTooltip(pointInsight(point));
    if (previewRef.current) {
      previewRef.current.currentTime = Math.max(0, point.timestamp);
      void previewRef.current.play().catch(() => null);
    }
  };

  return (
    <CleanCard id="retention-insights" className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium tracking-tight text-[#f9f1e4]">Retention Details</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              goodRetention
                ? "border-emerald-300/45 bg-emerald-500/16 text-emerald-100"
                : "border-amber-300/45 bg-amber-500/16 text-amber-100"
            }`}
          >
            Score {retentionScore.toFixed(1)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!expanded) onExpandedChange(true);
              setProcessingLogExpanded((value) => !value);
            }}
            className="rounded-xl border-white/20 bg-white/[0.06] text-[#f4ebe0] transition hover:-translate-y-0.5 hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
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
          <Button
            type="button"
            variant="outline"
            onClick={() => onExpandedChange(!expanded)}
            className="rounded-xl border-white/20 bg-white/[0.08] text-[#f4ebe0] transition hover:-translate-y-0.5 hover:border-[#e6cfa9]/45 hover:bg-[#d4b483]/12"
          >
            {expanded ? "Collapse Retention Insights" : "Expand Retention Insights"}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="retention-expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] lg:p-5">
              <div>
                <RetentionLineGraph
                  points={result.retention.points}
                  heatmap={result.retention.heatmap}
                  selectedPointId={selectedPointId}
                  onPointSelect={handlePointSelect}
                />
                {goodRetention ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mt-3 overflow-hidden rounded-xl border border-emerald-300/35 bg-emerald-500/12 p-3"
                  >
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      animate={{ opacity: [0.15, 0.35, 0.15] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <p className="relative text-sm font-medium text-emerald-50">
                      Amazing retention: {retentionScore.toFixed(1)} / 100
                    </p>
                    <p className="relative mt-1 text-xs text-emerald-100/90">
                      50+ is strong. This cut is in a healthy watch-through zone.
                    </p>
                  </motion.div>
                ) : (
                  <div className="mt-3 rounded-xl border border-amber-300/35 bg-amber-500/12 p-3">
                    <p className="text-sm font-medium text-amber-50">
                      Retention is {retentionScore.toFixed(1)} / 100, below the 50 target.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-50/95">
                      {advice.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-sm text-[#d1c6ca]">{result.retention.summary}</p>
              </div>

              <aside className="rounded-2xl border border-white/15 bg-black/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[#bcafb2]">Preview</p>
                <div className="overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_22px_50px_-34px_rgba(0,0,0,0.95)]">
                  <video
                    ref={previewRef}
                    src={outputVideoUrl}
                    controls
                    loop
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
                <div className="mt-2 rounded-xl border border-white/15 bg-black/30 p-3">
                  <p className="text-sm font-medium text-[#f8efe3]">{selectedPoint?.label || "Insight"}</p>
                  <p className="mt-1 text-xs text-[#bcaeb2]">{selectedPoint?.description || "Select a graph point for context."}</p>
                </div>
                <p className="mt-2 text-xs text-[#9f9497]">
                  {result.ffmpegCommands.length} FFmpeg command{result.ffmpegCommands.length === 1 ? "" : "s"} logged
                </p>
              </aside>
            </div>

            <AnimatePresence initial={false}>
              {processingLogExpanded ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden border-t border-white/15"
                >
                  <div className="p-4 sm:px-5">
                    <div className="rounded-2xl border border-white/15 bg-black/35 p-3">
                      <p className="text-xs uppercase tracking-[0.13em] text-[#bcaeb2]">Processing Log</p>
                      {result.ffmpegCommands.length > 0 ? (
                        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-white/15 bg-black/45 p-2 font-mono text-[11px] text-[#ddd3d6]">
                          {result.ffmpegCommands.map((command, index) => (
                            <p key={`${index}-${command.slice(0, 32)}`} className="break-all py-1">
                              <span className="mr-2 text-[#9f9497]">{String(index + 1).padStart(2, "0")}.</span>
                              {command}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[#9f9497]">No processing commands were logged for this render.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {tooltip ? (
          <motion.div
            key="retention-tip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-black/72 px-4 py-3 shadow-[0_28px_56px_-34px_rgba(0,0,0,0.96)] backdrop-blur-lg"
          >
            <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-[#d8ced1]">
              <PlayCircle className="h-3.5 w-3.5" />
              {tooltip.title}
            </p>
            <p className="mt-1 text-sm text-[#f9f1e5]">{tooltip.description}</p>
            <p className="mt-1 text-xs text-[#bcaeb2]">Seeked preview to {tooltip.timestamp.toFixed(1)}s</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </CleanCard>
  );
}
