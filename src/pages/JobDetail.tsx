import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  Download,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Lock,
  BarChart3,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { useToast } from "@/hooks/use-toast";
import { PLAN_CONFIG, QUALITY_ORDER, clampQualityForTier, normalizeQuality, type ExportQuality } from "@shared/planConfig";

interface Job {
  id: string;
  status: "queued" | "uploading" | "analyzing" | "hooking" | "cutting" | "pacing" | "story" | "subtitling" | "audio" | "retention" | "rendering" | "completed" | "failed";
  progress: number;
  inputPath: string;
  outputPath?: string | null;
  requestedQuality?: string | null;
  finalQuality?: string | null;
  watermarkApplied?: boolean;
  retentionScore?: number | null;
  optimizationNotes?: string[] | null;
  analysis?: {
    hook_start_time?: number | null;
    hook_end_time?: number | null;
    hook_score?: number | null;
    removed_segments?: Array<{ start: number; end: number }>;
  } | null;
  createdAt: string;
  error?: string | null;
}

const JobDetail = () => {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const { data: me } = useMe();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>("720p");

  const rawTier = (me?.subscription?.tier as string) || "free";
  const tier = (PLAN_CONFIG as Record<string, typeof PLAN_CONFIG.free>)[rawTier] ? (rawTier as keyof typeof PLAN_CONFIG) : "free";
  const plan = PLAN_CONFIG[tier];
  const maxQuality = plan.exportQuality;

  const fetchJob = async () => {
    if (!accessToken || !id) return;
    const data = await apiFetch<{ job: Job }>(`/api/jobs/${id}`, { token: accessToken });
    setJob(data.job);
    setLoading(false);
    const requested = normalizeQuality(data.job.requestedQuality || data.job.finalQuality || maxQuality);
    setSelectedQuality(clampQualityForTier(requested, tier));
  };

  useEffect(() => {
    fetchJob();
  }, [id, accessToken]);

  useEffect(() => {
    if (!accessToken || !id || !API_URL) return;
    const wsUrl = API_URL.replace(/^http/, "ws") + `/ws?token=${accessToken}`;
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type !== "job:update") return;
        const update = message.payload?.job as Job | undefined;
        if (!update || update.id !== id) return;
        setJob((prev) => (prev ? { ...prev, ...update } : update));
      } catch (err) {
        // ignore
      }
    };
    return () => {
      socket.close();
    };
  }, [accessToken, id]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.status === "failed") return;
    const timer = setInterval(() => {
      fetchJob();
    }, 2500);
    return () => clearInterval(timer);
  }, [job, accessToken]);

  const handleQualityChange = (quality: ExportQuality) => {
    const clamped = clampQualityForTier(quality, tier);
    if (clamped !== quality) {
      setUpgradeOpen(true);
      setSelectedQuality(clamped);
      return;
    }
    setSelectedQuality(quality);
  };

  const handleDownload = async () => {
    if (!accessToken || !id) return;
    try {
      const data = await apiFetch<{ url: string }>(`/api/jobs/${id}/output-url`, { token: accessToken });
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again." });
    }
  };

  const jobName = job?.inputPath?.split("/").pop() || "Untitled";
  const statusLabel = job?.status ? job.status : "queued";
  const isProcessing = job && ["queued", "uploading", "analyzing", "hooking", "cutting", "pacing", "story", "subtitling", "audio", "retention", "rendering"].includes(job.status);
  const hookStart = job?.analysis?.hook_start_time;
  const hookEnd = job?.analysis?.hook_end_time;
  const hookScore = job?.analysis?.hook_score;
  const removedCount = job?.analysis?.removed_segments?.length ?? 0;
  const pipelineSteps = [
    { key: "queued", label: "Queued" },
    { key: "uploading", label: "Uploading" },
    { key: "analyzing", label: "Analyzing" },
    { key: "hooking", label: "Hook" },
    { key: "cutting", label: "Cuts" },
    { key: "pacing", label: "Pacing" },
    { key: "story", label: "Story" },
    { key: "subtitling", label: "Subtitles" },
    { key: "audio", label: "Audio" },
    { key: "retention", label: "Retention" },
    { key: "rendering", label: "Rendering" },
    { key: "completed", label: "Ready" },
  ] as const;
  const currentStepIndex = job ? pipelineSteps.findIndex((step) => step.key === job.status) : -1;

  const qualityButtons = useMemo(() => {
    return QUALITY_ORDER.map((quality) => {
      const locked = QUALITY_ORDER.indexOf(quality) > QUALITY_ORDER.indexOf(maxQuality);
      return (
        <Tooltip key={quality}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                selectedQuality === quality
                  ? "border-primary text-primary"
                  : "border-border/50 text-muted-foreground"
              } ${locked ? "cursor-not-allowed opacity-60" : "hover:border-primary/50"}`}
              onClick={() => (!locked ? handleQualityChange(quality) : setUpgradeOpen(true))}
            >
              <span className="flex items-center gap-1">
                {quality}
                {locked && <Lock className="w-3 h-3" />}
              </span>
            </button>
          </TooltipTrigger>
          {locked && (
            <TooltipContent>Upgrade to unlock {quality.toUpperCase()}</TooltipContent>
          )}
        </Tooltip>
      );
    });
  }, [selectedQuality, maxQuality, tier]);

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-display text-foreground">{jobName}</h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{tier}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Job #{id}</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={fetchJob}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading job...</p>}

          {job && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="glass-card overflow-hidden">
                  <div className="aspect-video bg-muted/30 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                    <Button size="lg" variant="ghost" className="relative z-10 w-16 h-16 rounded-full bg-primary/20 hover:bg-primary/30 text-primary">
                      <Play className="w-8 h-8 ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="glass-card p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Export Quality</span>
                      <span className="text-xs text-muted-foreground">Max: {maxQuality.toUpperCase()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">{qualityButtons}</div>
                  </div>

                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{statusLabel}</span>
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2 bg-muted [&>div]:bg-primary" />
                    </div>
                  )}

                  {job && (
                    <div className="flex flex-wrap gap-2">
                      {pipelineSteps.map((step, idx) => {
                        const active = currentStepIndex !== -1 && idx <= currentStepIndex && job.status !== "failed";
                        return (
                          <Badge
                            key={step.key}
                            variant="secondary"
                            className={`border ${active ? "border-primary/30 text-primary bg-primary/10" : "border-border/50 text-muted-foreground bg-muted/30"}`}
                          >
                            {step.label}
                          </Badge>
                        );
                      })}
                      {job.status === "failed" && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg p-3">
                    Rendering starts automatically after the hook, cuts, pacing, and polish steps finish.
                  </div>

                  {job.status === "completed" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" className="gap-2 rounded-lg" onClick={handleDownload}>
                        <Download className="w-3.5 h-3.5" /> Final MP4
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold font-display text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Job Details
                </h3>
                <div className="glass-card p-4 text-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-foreground capitalize">{statusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Retention Score</span>
                    <span className="text-foreground flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-primary" />
                      {job?.retentionScore ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Requested Quality</span>
                    <span className="text-foreground">{selectedQuality.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Watermark</span>
                    <span className="text-foreground">{plan.watermark ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hook Window</span>
                    <span className="text-foreground">
                      {hookStart != null && hookEnd != null ? `${hookStart.toFixed(1)}s - ${hookEnd.toFixed(1)}s` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Hook Score</span>
                    <span className="text-foreground">
                      {hookScore != null ? hookScore.toFixed(2) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Boring Cuts</span>
                    <span className="text-foreground">{removedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {job?.optimizationNotes && job.optimizationNotes.length > 0 && (
                  <div className="glass-card p-4 text-sm space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Optimization Notes</h4>
                    {job.optimizationNotes.map((note, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <AlertDialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upgrade to unlock higher quality</AlertDialogTitle>
            <AlertDialogDescription>
              Your current plan allows up to {maxQuality.toUpperCase()} exports. Upgrade to unlock 4K.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link to="/pricing">View pricing</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GlowBackdrop>
  );
};

export default JobDetail;
