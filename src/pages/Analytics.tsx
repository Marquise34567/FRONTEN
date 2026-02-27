import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquareText, Play, TrendingDown, TrendingUp, Wand2 } from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import PreviewPopup from "@/components/premium/PreviewPopup";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const demoPoints: RetentionGraphPoint[] = [
  { id: "p1", timestamp: 2.1, watchedPercent: 93, type: "peak", label: "Primary hook", note: "Strong first 3s" },
  { id: "p2", timestamp: 7.4, watchedPercent: 78, type: "drop", label: "Context dip", note: "Pacing slowdown" },
  { id: "p3", timestamp: 11.2, watchedPercent: 85, type: "peak", label: "Micro-hook", note: "Title tease" },
  { id: "p4", timestamp: 15.7, watchedPercent: 64, type: "skip", label: "Skip risk", note: "Transition lag" },
  { id: "p5", timestamp: 20.3, watchedPercent: 72, type: "neutral", label: "Recovery", note: "Momentum returns" },
  { id: "p6", timestamp: 25.9, watchedPercent: 82, type: "peak", label: "Retention bump", note: "Question loop" },
];

const thumbnails = [
  "Hook frame",
  "Reaction frame",
  "Reveal frame",
  "Drop-risk frame",
  "Recovery frame",
  "Outro frame",
];

export default function Analytics() {
  const [selectedPoint, setSelectedPoint] = useState<RetentionGraphPoint>(demoPoints[0]);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [previewPopupOpen, setPreviewPopupOpen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const keyInsights = useMemo(
    () => [
      "Add a teaser overlay at ~6.5s to prevent early drop.",
      "Tighten transition between 14-16s and inject caption emphasis.",
      "Replicate the 25s micro-hook pattern in the first 12s.",
    ],
    [],
  );

  const handleSelectPoint = (point: RetentionGraphPoint) => {
    setSelectedPoint(point);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = point.timestamp;
      void previewVideoRef.current.play().catch(() => null);
    }
    setPreviewPopupOpen(true);
    window.setTimeout(() => setPreviewPopupOpen(false), 1800);
  };

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="text-xs uppercase tracking-[0.13em] text-purple-200">Insights Summary</p>
        <p className="mt-2 text-sm text-slate-300">
          Predicted average retention: <span className="font-semibold text-emerald-300">74.2%</span> (target: &gt;70%).
        </p>
        <div className="mt-3 space-y-2">
          {keyInsights.map((line) => (
            <div key={line} className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-200">
              {line}
            </div>
          ))}
        </div>
      </PremiumCard>
      <PremiumCard className="space-y-2 p-4">
        <PurpleAccentButton className="w-full justify-center" icon={<Wand2 className="h-4 w-4" />}>
          Fix Weak Parts
        </PurpleAccentButton>
        <PurpleAccentButton className="w-full justify-center" icon={<TrendingUp className="h-4 w-4" />}>
          Boost Hook Density
        </PurpleAccentButton>
        <button
          type="button"
          onClick={() => setDeepDiveOpen(true)}
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-slate-200 hover:border-purple-300/35 hover:text-white"
        >
          Open Deep Dive
        </button>
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Analytics" rightRail={rightRail}>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Retention Details</h1>
              <p className="text-sm text-slate-400">Every marker shows estimated watch-through impact and correction opportunities.</p>
            </div>
            <button
              type="button"
              onClick={() => setDeepDiveOpen(true)}
              className="rounded-2xl border border-purple-300/30 bg-purple-500/15 px-4 py-2 text-sm text-purple-100 hover:bg-purple-500/20"
            >
              Deep Dive
            </button>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-3 rounded-2xl border border-white/10 bg-black/40 p-1">
              <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-purple-500/25">
                Overview
              </TabsTrigger>
              <TabsTrigger value="deep" className="rounded-xl data-[state=active]:bg-purple-500/25">
                Deep Dive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <RetentionGraphCard points={demoPoints} selectedPointId={selectedPoint.id} onSelectPoint={handleSelectPoint} />
            </TabsContent>

            <TabsContent value="deep" className="space-y-4">
              <RetentionGraphCard
                points={demoPoints.map((point) => ({ ...point, watchedPercent: Math.max(45, point.watchedPercent - 4) }))}
                title="Drop-Risk Weighted View"
                selectedPointId={selectedPoint.id}
                onSelectPoint={handleSelectPoint}
              />
            </TabsContent>
          </Tabs>
        </PremiumCard>

        <PremiumCard className="p-5">
          <h2 className="text-base font-semibold text-slate-100">Frame Thumbnails</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {thumbnails.map((thumb, index) => (
              <motion.button
                key={thumb}
                type="button"
                whileHover={{ scale: 1.02 }}
                onClick={() => handleSelectPoint(demoPoints[Math.min(index, demoPoints.length - 1)])}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 text-left"
              >
                <div className="aspect-video bg-[linear-gradient(160deg,#20102f,#0d0f17)]" />
                <div className="px-3 py-2">
                  <p className="text-sm text-slate-100">{thumb}</p>
                  <p className="text-xs text-slate-400">Tap to sync preview</p>
                </div>
              </motion.button>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-purple-300" />
            <h2 className="text-base font-semibold text-slate-100">Realtime Preview</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video
              ref={previewVideoRef}
              src="/editor-help-sample.mp4"
              controls
              preload="metadata"
              className="aspect-video w-full object-contain bg-black"
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Peak segments: 3
              </div>
            </div>
            <div className="rounded-2xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              <div className="flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                Drop segments: 2
              </div>
            </div>
            <div className="rounded-2xl border border-purple-300/35 bg-purple-500/15 px-3 py-2 text-sm text-purple-100">
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                Selected: {selectedPoint.timestamp.toFixed(1)}s
              </div>
            </div>
          </div>
        </PremiumCard>
      </div>

      <Dialog open={deepDiveOpen} onOpenChange={setDeepDiveOpen}>
        <DialogContent className="max-w-5xl border-white/10 bg-[#05060c] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl">Retention Deep Dive</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <RetentionGraphCard
              points={demoPoints}
              title="Zoomable Timeline Graph"
              selectedPointId={selectedPoint.id}
              onSelectPoint={handleSelectPoint}
              className="h-full"
            />
            <div className="space-y-3">
              {demoPoints.map((point) => (
                <button
                  key={`insight-${point.id}`}
                  type="button"
                  onClick={() => handleSelectPoint(point)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                    point.id === selectedPoint.id
                      ? "border-purple-300/45 bg-purple-500/15 text-slate-100"
                      : "border-white/10 bg-black/40 text-slate-300 hover:border-white/20"
                  }`}
                >
                  <p className="font-medium">{point.label}</p>
                  <p className="text-xs text-slate-400">{point.timestamp.toFixed(1)}s • {point.note}</p>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PreviewPopup
        open={previewPopupOpen}
        label={selectedPoint.label}
        timestamp={selectedPoint.timestamp}
        note={selectedPoint.note}
      />
    </AppShell>
  );
}
