import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import RetentionLineGraph from "@/features/autoeditor/components/editor/RetentionLineGraph";
import type { InsightTooltip, RenderJobResult, RetentionPoint } from "@/features/autoeditor/types";

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

  const selectedPoint = useMemo(() => {
    if (!result?.retention.points.length) return null;
    return result.retention.points.find((point) => point.id === selectedPointId) || result.retention.points[0];
  }, [result, selectedPointId]);

  useEffect(() => {
    if (!tooltip) return;
    const timer = window.setTimeout(() => setTooltip(null), 3200);
    return () => window.clearTimeout(timer);
  }, [tooltip]);

  if (!result) return null;

  const handlePointSelect = (point: RetentionPoint) => {
    onSelectedPointIdChange(point.id);
    setTooltip(pointInsight(point));
    if (previewRef.current) {
      previewRef.current.currentTime = Math.max(0, point.timestamp);
      void previewRef.current.play().catch(() => null);
    }
  };

  return (
    <CleanCard className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <p className="text-sm font-medium text-slate-100">Retention Details</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => onExpandedChange(!expanded)}
          className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
        >
          {expanded ? "Hide Retention Insights" : "View Retention Insights"}
        </Button>
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
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] lg:p-5">
              <div>
                <RetentionLineGraph
                  points={result.retention.points}
                  heatmap={result.retention.heatmap}
                  selectedPointId={selectedPointId}
                  onPointSelect={handlePointSelect}
                />
                <p className="mt-3 text-sm text-slate-300">{result.retention.summary}</p>
              </div>

              <aside className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-400">Preview</p>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  <video
                    ref={previewRef}
                    src={result.outputVideoUrl}
                    controls
                    loop
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-sm font-medium text-slate-100">{selectedPoint?.label || "Insight"}</p>
                  <p className="mt-1 text-xs text-slate-400">{selectedPoint?.description || "Select a graph point for context."}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {result.ffmpegCommands.length} FFmpeg command{result.ffmpegCommands.length === 1 ? "" : "s"} logged
                </p>
              </aside>
            </div>
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
            className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/70 px-4 py-3 backdrop-blur-lg"
          >
            <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-slate-300">
              <PlayCircle className="h-3.5 w-3.5" />
              {tooltip.title}
            </p>
            <p className="mt-1 text-sm text-slate-100">{tooltip.description}</p>
            <p className="mt-1 text-xs text-slate-400">Seeked preview to {tooltip.timestamp.toFixed(1)}s</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </CleanCard>
  );
}
