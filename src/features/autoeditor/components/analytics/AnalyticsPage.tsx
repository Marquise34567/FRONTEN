import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Clapperboard,
  Loader2,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import RetentionGraphCard, { type RetentionGraphPoint } from "@/components/premium/RetentionGraphCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, apiFetch, resolveApiMediaUrl } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { fetchJobByIdApi, fetchRecentJobsApi } from "@/features/autoeditor/lib/jobApi";
import { simulateWeakPartFix, useUniqueJobData } from "@/features/autoeditor/hooks/useUniqueJobData";
import type { RenderJobResult, RenderJobSummary } from "@/features/autoeditor/types";

type TrendsResponse = {
  topics: Array<{ title: string }>;
};

const toGraphPoints = (job: RenderJobResult | null): RetentionGraphPoint[] => {
  if (!job?.retention?.points?.length) return [];
  return job.retention.points.map((point) => ({
    id: point.id,
    timestamp: point.timestamp,
    watchedPercent: point.watchedPct,
    type:
      point.type === "best" || point.type === "hook" || point.type === "emotional_peak"
        ? "peak"
        : point.type === "worst"
          ? "drop"
          : point.type === "skip_zone"
            ? "skip"
            : "neutral",
    label: point.label,
    note: point.description,
  }));
};

export default function AnalyticsPage() {
  const { accessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedJobId = searchParams.get("jobId");

  const [jobs, setJobs] = useState<RenderJobSummary[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, RenderJobResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [fixSimulationEnabled, setFixSimulationEnabled] = useState(false);
  const [trendTopics, setTrendTopics] = useState<string[]>([]);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const loadDetail = useCallback(
    async (jobId: string) => {
      if (!accessToken) throw new ApiError("Sign in required.", 401, "unauthorized");
      if (detailsById[jobId]) return detailsById[jobId];
      setLoadingJobId(jobId);
      try {
        const detail = await fetchJobByIdApi(accessToken, jobId);
        setDetailsById((prev) => ({ ...prev, [jobId]: detail }));
        return detail;
      } finally {
        setLoadingJobId((current) => (current === jobId ? null : current));
      }
    },
    [accessToken, detailsById],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const rows = await fetchRecentJobsApi(accessToken);
        if (cancelled) return;
        setJobs(rows);
        const first =
          (requestedJobId && rows.find((job) => job.id === requestedJobId)?.id) ||
          rows.find((job) => job.status === "completed")?.id ||
          rows[0]?.id ||
          null;
        setSelectedJobId(first);
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : "Could not load analytics jobs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, requestedJobId]);

  useEffect(() => {
    if (!selectedJobId || detailsById[selectedJobId]) return;
    void loadDetail(selectedJobId);
  }, [detailsById, loadDetail, selectedJobId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await apiFetch<TrendsResponse>("/api/public/title-trends");
        if (!cancelled) setTrendTopics(response.topics.map((topic) => topic.title).slice(0, 6));
      } catch {
        if (!cancelled) setTrendTopics([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFixSimulationEnabled(false);
    setSelectedPointId(null);
  }, [selectedJobId]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);
  const selectedResult = selectedJobId ? detailsById[selectedJobId] || null : null;
  const simulatedResult = useMemo(() => simulateWeakPartFix(selectedResult), [selectedResult]);
  const activeResult = fixSimulationEnabled ? simulatedResult : selectedResult;
  const graphPoints = useMemo(() => toGraphPoints(activeResult), [activeResult]);

  const {
    predictedAverageRetention,
    metadataStats,
    editInsights,
    hookExplanation,
    titleOptions,
    summary,
  } = useUniqueJobData({
    result: activeResult,
    fileName: selectedJob?.fileName || "Untitled",
    trendTopics,
  });

  useEffect(() => {
    if (!graphPoints.length) return;
    if (selectedPointId && graphPoints.some((point) => point.id === selectedPointId)) return;
    setSelectedPointId(graphPoints[0].id);
  }, [graphPoints, selectedPointId]);

  const selectedPoint = useMemo(
    () => graphPoints.find((point) => point.id === selectedPointId) || null,
    [graphPoints, selectedPointId],
  );

  const rightRail = (
    <>
      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-purple-200">
          <Target className="h-3.5 w-3.5" />
          Predicted Retention
        </p>
        <p className="mt-2 text-3xl font-semibold text-emerald-300">{predictedAverageRetention.toFixed(1)}%</p>
        <p className="mt-1 text-xs text-slate-400">Target: 70%+ average retention</p>
        <p className="mt-2 text-xs text-slate-300">{summary}</p>
      </PremiumCard>

      <PremiumCard className="p-4">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.13em] text-purple-200">
          <Sparkles className="h-3.5 w-3.5" />
          Hook Explanation
        </p>
        <p className="mt-2 text-sm text-slate-100">
          Why This Hook? {hookExplanation.reason}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Winner {hookExplanation.winnerScore}% vs Runner-Up {hookExplanation.runnerUpScore}%
        </p>
      </PremiumCard>

      <PremiumCard className="space-y-2 p-4">
        <PurpleAccentButton className="w-full justify-center" onClick={() => setFixSimulationEnabled(true)} icon={<Wand2 className="h-4 w-4" />}>
          Fix Weak Parts
        </PurpleAccentButton>
        <button
          type="button"
          onClick={() => setFixSimulationEnabled(false)}
          className="w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-2 text-sm text-slate-200 hover:border-white/25"
        >
          Reset Simulation
        </button>
        <button
          type="button"
          onClick={() => setDeepDiveOpen(true)}
          className="w-full rounded-2xl border border-purple-300/25 bg-purple-500/10 px-4 py-2 text-sm text-purple-100 hover:border-purple-300/45"
        >
          Deep Dive
        </button>
      </PremiumCard>
    </>
  );

  return (
    <AppShell title="AutoEditor Analytics" showSidebar rightRail={rightRail}>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Retention Details</h1>
              <p className="mt-1 text-sm text-slate-400">
                Interactive graph, unique per-video insights, and re-edit simulation focused on watch-time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : null}
              <select
                value={selectedJobId || ""}
                onChange={(event) => setSelectedJobId(event.target.value || null)}
                className="min-w-[250px] rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100"
              >
                {!jobs.length ? <option value="">No jobs</option> : null}
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.fileName || "Untitled"} • {job.status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errorMessage ? <p className="mt-2 text-sm text-rose-300">{errorMessage}</p> : null}
        </PremiumCard>

        <PremiumCard className="p-5">
          {graphPoints.length ? (
            <RetentionGraphCard
              points={graphPoints}
              selectedPointId={selectedPointId}
              onSelectPoint={(point) => {
                setSelectedPointId(point.id);
                if (previewVideoRef.current) {
                  previewVideoRef.current.currentTime = point.timestamp;
                  void previewVideoRef.current.play().catch(() => null);
                }
              }}
              title="Interactive Retention Graph"
            />
          ) : (
            <p className="text-sm text-slate-300">Select a completed render to load retention analytics.</p>
          )}
        </PremiumCard>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">Frame Thumbnail Carousel</h2>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {(activeResult?.thumbnails || []).length ? (
                activeResult!.thumbnails.map((thumbnail, index) => {
                  const matchingPoint = graphPoints[Math.min(index, graphPoints.length - 1)];
                  return (
                    <motion.button
                      key={thumbnail.id}
                      type="button"
                      whileHover={{ rotateY: 4, rotateX: -2, scale: 1.03 }}
                      transition={{ type: "spring", stiffness: 220, damping: 18 }}
                      onClick={() => matchingPoint && setSelectedPointId(matchingPoint.id)}
                      onMouseEnter={() => {
                        if (!matchingPoint || !previewVideoRef.current) return;
                        previewVideoRef.current.currentTime = matchingPoint.timestamp;
                      }}
                      className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                    >
                      <img
                        src={resolveApiMediaUrl(thumbnail.url)}
                        alt={thumbnail.label}
                        className="h-24 w-44 object-cover"
                      />
                      <div className="px-2 py-1.5 text-left">
                        <p className="text-xs text-slate-200">{thumbnail.label}</p>
                        <p className="text-[11px] text-purple-200">Retention option</p>
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-3 py-5 text-sm text-slate-400">
                  Thumbnail data is not available for this job yet.
                </div>
              )}
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-purple-200" />
              <h2 className="text-base font-semibold text-slate-100">Preview</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={previewVideoRef}
                src={resolveApiMediaUrl(activeResult?.outputVideoUrl || "") || "/editor-help-sample.mp4"}
                controls
                preload="metadata"
                className="aspect-video w-full object-contain bg-black"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Selected point: {selectedPoint ? `${selectedPoint.timestamp.toFixed(1)}s` : "n/a"}
            </p>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <PremiumCard className="p-4 xl:col-span-2">
            <h2 className="text-base font-semibold text-slate-100">Edit Insights</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {editInsights.map((insight) => (
                <div key={insight.id} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                  <p className="text-sm font-medium text-slate-100">{insight.headline}</p>
                  <p className="mt-1 text-xs text-slate-400">{insight.detail}</p>
                  <p className="mt-1 text-[11px] text-purple-200">
                    {insight.timestamp.toFixed(1)}s • {insight.predictedRetention}%
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">Video Metadata</h2>
            <div className="mt-3 space-y-2">
              {metadataStats.map((stat) => (
                <div key={stat.id} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
                  <p className="text-sm font-semibold text-slate-100">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.detail}</p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">Why This Hook?</h2>
            <p className="mt-2 text-sm text-slate-200">{hookExplanation.reason}</p>
            <p className="mt-1 text-xs text-slate-400">{hookExplanation.transcriptSignal}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-purple-300/30 bg-purple-500/10 px-2.5 py-2">
                <p className="text-[11px] uppercase tracking-[0.11em] text-purple-200">{hookExplanation.winnerLabel}</p>
                <p className="text-lg font-semibold text-slate-100">{hookExplanation.winnerScore}%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
                <p className="text-[11px] uppercase tracking-[0.11em] text-slate-300">{hookExplanation.runnerUpLabel}</p>
                <p className="text-lg font-semibold text-slate-100">{hookExplanation.runnerUpScore}%</p>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard className="p-4">
            <h2 className="text-base font-semibold text-slate-100">AI Title Generator</h2>
            <p className="mt-1 text-xs text-slate-400">Moved to analytics and generated uniquely per video.</p>
            <div className="mt-3 space-y-2">
              {titleOptions.map((option) => (
                <div key={option.id} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-sm text-slate-100">{option.title}</p>
                  <p className="text-xs text-slate-400">{option.explanation}</p>
                  <p className="text-[11px] text-purple-200">Confidence {option.confidence}%</p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>

      <Dialog open={deepDiveOpen} onOpenChange={setDeepDiveOpen}>
        <DialogContent className="max-w-6xl border-white/10 bg-[#05060c] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl">Retention Deep Dive</DialogTitle>
          </DialogHeader>
          <RetentionGraphCard
            points={graphPoints}
            selectedPointId={selectedPointId}
            onSelectPoint={(point) => setSelectedPointId(point.id)}
            title="Zoom / Pan / 3D Graph"
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
