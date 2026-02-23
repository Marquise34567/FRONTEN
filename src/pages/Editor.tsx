import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Plus, Play, Download, Lock, Loader2 } from "lucide-react";
import * as tus from "tus-js-client";
import { useAuth } from "@/providers/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_CONFIG, QUALITY_ORDER, clampQualityForTier, normalizeQuality, type ExportQuality, type PlanTier } from "@shared/planConfig";

const MB = 1024 * 1024;
const LARGE_UPLOAD_THRESHOLD = 200 * MB;
// Supabase resumable endpoint removed; server-side proxy/presign used instead

const chunkSizeForFile = (size: number) => {
  if (size >= 2 * 1024 * MB) return 24 * MB;
  if (size >= 1024 * MB) return 16 * MB;
  if (size >= 512 * MB) return 12 * MB;
  return 8 * MB;
};

type JobStatus =
  | "queued"
  | "uploading"
  | "analyzing"
  | "hooking"
  | "cutting"
  | "pacing"
  | "story"
  | "subtitling"
  | "audio"
  | "retention"
  | "rendering"
  | "completed"
  | "failed"
  | "ready";

interface JobSummary {
  id: string;
  status: JobStatus;
  createdAt: string;
  inputPath?: string;
  progress?: number;
  requestedQuality?: string | null;
  watermark?: boolean;
}

interface JobDetail extends JobSummary {
  outputUrl?: string | null;
  finalQuality?: string | null;
  retentionScore?: number | null;
  analysis?: any;
  optimizationNotes?: string[] | null;
  error?: string | null;
}

const PIPELINE_STEPS = [
  { key: "queued", label: "Queued" },
  { key: "uploading", label: "Uploading" },
  { key: "analyzing", label: "Analyzing" },
  { key: "hooking", label: "Hook" },
  { key: "cutting", label: "Cuts" },
  { key: "pacing", label: "Pacing" },
  { key: "story", label: "Story" },
  { key: "subtitling", label: "Subtitles" },
  { key: "rendering", label: "Rendering" },
  { key: "ready", label: "Ready" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading",
  analyzing: "Analyzing",
  hooking: "Hook",
  cutting: "Cuts",
  pacing: "Pacing",
  story: "Story",
  subtitling: "Subtitles",
  audio: "Audio",
  retention: "Retention",
  rendering: "Rendering",
  completed: "Ready",
  ready: "Ready",
  failed: "Failed",
};

const normalizeStatus = (status?: JobStatus | string | null) => {
  if (!status) return "queued";
  if (status === "completed") return "ready";
  return status;
};

const isTerminalStatus = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === "ready" || normalized === "failed";
};

const stepKeyForStatus = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "audio" || normalized === "retention") return "rendering";
  return normalized;
};

const statusBadgeClass = (status?: JobStatus | string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "ready") return "bg-success/10 text-success border-success/30";
  if (normalized === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
  if (normalized === "uploading") return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted/40 text-muted-foreground border-border/60";
};

const displayName = (job: JobSummary) => job.inputPath?.split("/").pop() || "Untitled";

const Editor = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [qualityByJob, setQualityByJob] = useState<Record<string, ExportQuality>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const pipelineStartRef = useRef<Record<string, number>>({});
  const [etaTick, setEtaTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  const { data: me, refetch: refetchMe } = useMe({ refetchInterval: hasActiveJobs ? 2500 : false });
  const rawTier = (me?.subscription?.tier as string | undefined) || "free";
  const tier: PlanTier = PLAN_CONFIG[rawTier as PlanTier] ? (rawTier as PlanTier) : "free";
  const maxQuality = (PLAN_CONFIG[tier] ?? PLAN_CONFIG.free).exportQuality;
  const tierLabel = tier === "free" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const isDevAccount = Boolean(me?.flags?.dev);
  const rendersUsed = me?.usage?.rendersUsed ?? 0;
  const maxRendersPerMonth = me?.limits?.maxRendersPerMonth ?? null;
  const rendersRemaining = useMemo(() => {
    if (maxRendersPerMonth === null || maxRendersPerMonth === undefined) return null;
    return Math.max(0, maxRendersPerMonth - rendersUsed);
  }, [maxRendersPerMonth, rendersUsed]);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<{ jobs?: JobSummary[] }>("/api/jobs", { token: accessToken });
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err) {
      toast({ title: "Failed to load jobs", description: "Please refresh and try again." });
    } finally {
      setLoadingJobs(false);
    }
  }, [accessToken, toast]);

  const fetchJob = useCallback(
    async (jobId: string) => {
      if (!accessToken || !jobId) return;
      setLoadingJob(true);
      try {
        const data = await apiFetch<{ job: JobDetail }>(`/api/jobs/${jobId}`, { token: accessToken });
        setActiveJob(data.job);
        setJobs((prev) => {
          const index = prev.findIndex((job) => job.id === jobId);
          if (index === -1) return [data.job, ...prev];
          const next = [...prev];
          next[index] = { ...next[index], ...data.job };
          return next;
        });
      } catch (err) {
        toast({ title: "Failed to load job", description: "Please refresh and try again." });
        setActiveJob(null);
      } finally {
        setLoadingJob(false);
      }
    },
    [accessToken, toast],
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const timer = setInterval(() => setEtaTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set("jobId", jobs[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [jobs, searchParams, selectedJobId, setSearchParams]);

  useEffect(() => {
    if (!selectedJobId) {
      setActiveJob(null);
      return;
    }
    fetchJob(selectedJobId);
    setExportOpen(false);
  }, [selectedJobId, fetchJob]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [hasActiveJobs, fetchJobs]);

  useEffect(() => {
    if (!activeJob || !selectedJobId) return;
    if (isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => {
      fetchJob(selectedJobId);
    }, 2500);
    return () => clearInterval(timer);
  }, [activeJob, selectedJobId, fetchJob]);

  useEffect(() => {
    const prev = prevJobStatusRef.current;
    let completed = false;
    const next = new Map<string, JobStatus>();
    for (const job of jobs) {
      next.set(job.id, job.status);
      const prevStatus = prev.get(job.id);
      if (prevStatus && !isTerminalStatus(prevStatus) && normalizeStatus(job.status) === "ready") {
        completed = true;
      }
    }
    prevJobStatusRef.current = next;
    if (completed) refetchMe();
  }, [jobs, refetchMe]);

  useEffect(() => {
    if (!activeJob) return;
    if (normalizeStatus(activeJob.status) !== "ready") return;
    const key = `export_popup_shown_${activeJob.id}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "true");
    setExportOpen(true);
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    if (!activeJob) return;
    setQualityByJob((prev) => {
      if (prev[activeJob.id]) return prev;
      const requested = normalizeQuality(activeJob.requestedQuality || activeJob.finalQuality || maxQuality);
      const clamped = clampQualityForTier(requested, tier);
      return { ...prev, [activeJob.id]: clamped };
    });
  }, [activeJob, maxQuality, tier]);

  const selectedQuality = useMemo(() => {
    if (!activeJob) return clampQualityForTier(maxQuality, tier);
    return (
      qualityByJob[activeJob.id] ??
      clampQualityForTier(normalizeQuality(activeJob.requestedQuality || activeJob.finalQuality || maxQuality), tier)
    );
  }, [activeJob, maxQuality, qualityByJob, tier]);

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
              onClick={() => {
                if (locked || !activeJob) return;
                setQualityByJob((prev) => ({ ...prev, [activeJob.id]: quality }));
              }}
            >
              <span className="flex items-center gap-1">
                {quality}
                {locked && <Lock className="w-3 h-3" />}
              </span>
            </button>
          </TooltipTrigger>
          {locked && <TooltipContent>Upgrade to unlock {quality.toUpperCase()}</TooltipContent>}
        </Tooltip>
      );
    });
  }, [activeJob, maxQuality, selectedQuality]);

  const uploadWithProgress = (url: string, file: File, onProgress: (value: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.send(file);
    });
  };

  const uploadResumable = ({
    file,
    bucket,
    inputPath,
    token,
    onProgress,
  }: {
    file: File;
    bucket: string;
    inputPath: string;
    token: string;
    onProgress: (value: number) => void;
  }) => {
    return new Promise<void>((resolve, reject) => {
      if (!RESUMABLE_ENDPOINT || !SUPABASE_PUBLISHABLE_KEY) {
        reject(new Error("Resumable upload is not configured."));
        return;
      }

      const upload = new tus.Upload(file, {
        endpoint: RESUMABLE_ENDPOINT,
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        chunkSize: chunkSizeForFile(file.size),
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucket,
          objectName: inputPath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        headers: {
          authorization: `Bearer ${token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "x-upsert": "true",
        },
        onError: (error) => reject(error),
        onProgress: (bytesUploaded, bytesTotal) => {
          if (!bytesTotal) return;
          const percent = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgress(Math.min(100, Math.max(0, percent)));
        },
        onSuccess: () => {
          onProgress(100);
          resolve();
        },
      });

      upload
        .findPreviousUploads()
        .then((previousUploads) => {
          if (previousUploads.length > 0) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        })
        .catch(() => {
          upload.start();
        });
    });
  };

  const handleFile = async (file: File) => {
    if (!accessToken) return;
    if (maxRendersPerMonth !== null && maxRendersPerMonth !== undefined && (rendersRemaining ?? 0) <= 0) {
      toast({
        title: "Render limit reached",
        description: `You've used all ${maxRendersPerMonth} renders for this month.`,
      });
      return;
    }
    setUploadProgress(0);
    try {
      const create = await apiFetch<{ job: JobDetail; uploadUrl?: string | null; inputPath: string; bucket: string }>(
        "/api/jobs/create",
        {
          method: "POST",
          body: JSON.stringify({ filename: file.name }),
          token: accessToken,
        },
      );

      setUploadingJobId(create.job.id);
      pipelineStartRef.current[create.job.id] = Date.now();
      setJobs((prev) => [{ ...create.job, status: "uploading", progress: 5 }, ...(Array.isArray(prev) ? prev : [])]);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("jobId", create.job.id);
      setSearchParams(nextParams, { replace: false });

      const useResumable = file.size >= LARGE_UPLOAD_THRESHOLD;
      if (useResumable) {
        try {
          await uploadResumable({
            file,
            bucket: create.bucket,
            inputPath: create.inputPath,
            token: accessToken,
            onProgress: setUploadProgress,
          });
        } catch (err) {
          console.warn("Resumable upload failed, falling back.", err);
          if (create.uploadUrl) {
            await uploadWithProgress(create.uploadUrl, file, setUploadProgress);
          } else {
            const proxyResp = await fetch(`/api/uploads/proxy?jobId=${create.job.id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.type || 'application/octet-stream' },
              body: file,
            });
            if (!proxyResp.ok) throw new Error('Proxy upload failed');
            setUploadProgress(100);
          }
        }
      } else if (create.uploadUrl) {
        try {
          await uploadWithProgress(create.uploadUrl, file, setUploadProgress);
        } catch (err) {
          const proxyResp = await fetch(`/api/uploads/proxy?jobId=${create.job.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          });
          if (!proxyResp.ok) throw new Error('Proxy upload failed');
          setUploadProgress(100);
        }
      } else {
        const proxyResp = await fetch(`/api/uploads/proxy?jobId=${create.job.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!proxyResp.ok) throw new Error('Proxy upload failed');
        setUploadProgress(100);
      }

      await apiFetch(`/api/jobs/${create.job.id}/complete-upload`, {
        method: "POST",
        body: JSON.stringify({ inputPath: create.inputPath }),
        token: accessToken,
      });

      toast({ title: "Upload complete", description: "Your job is now processing." });
      setUploadingJobId(null);
      setUploadProgress(0);
      fetchJobs();
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError && err.code === "RENDER_LIMIT_REACHED") {
        const remaining = typeof err.data?.rendersRemaining === "number" ? err.data.rendersRemaining : rendersRemaining;
        const maxRenders = err.data?.maxRendersPerMonth ?? maxRendersPerMonth;
        const detail =
          typeof remaining === "number"
            ? `You have ${remaining} render${remaining === 1 ? "" : "s"} left this month.`
            : maxRenders
              ? `You've used all ${maxRenders} renders for this month.`
              : "You've reached your monthly render limit.";
        toast({ title: "Render limit reached", description: detail });
      } else {
        toast({ title: "Upload failed", description: err?.message || "Please try again." });
      }
      setUploadingJobId(null);
      setUploadProgress(0);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSelectJob = (jobId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("jobId", jobId);
    setSearchParams(next, { replace: false });
  };

  const handleDownload = async () => {
    if (!accessToken || !activeJob) return;
    try {
      if (activeJob.outputUrl) {
        window.open(activeJob.outputUrl, "_blank");
        return;
      }
      const data = await apiFetch<{ url: string }>(`/api/jobs/${activeJob.id}/output-url`, { token: accessToken });
      setActiveJob((prev) => (prev ? { ...prev, outputUrl: data.url } : prev));
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again." });
    }
  };

  const normalizedActiveStatus = activeJob ? normalizeStatus(activeJob.status) : null;
  const activeStatusLabel = activeJob ? STATUS_LABELS[normalizeStatus(activeJob.status)] || "Queued" : "Queued";
  const activeStepKey = activeJob ? stepKeyForStatus(activeJob.status) : null;
  const currentStepIndex = activeStepKey
    ? PIPELINE_STEPS.findIndex((step) => step.key === activeStepKey)
    : -1;
  const showVideo = Boolean(activeJob && normalizedActiveStatus === "ready" && activeJob.outputUrl);

  const etaSeconds = useMemo(() => {
    if (!activeJob) return null;
    const normalized = normalizeStatus(activeJob.status);
    if (normalized === "ready" || normalized === "failed") return null;
    const startAt = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const elapsed = Math.max(1, (Date.now() - startAt) / 1000);
    const jobProgress = typeof activeJob.progress === "number" ? activeJob.progress : 0;
    const uploadContribution = Math.min(10, Math.max(1, Math.round(uploadProgress * 0.1)));
    const effectiveProgress =
      normalized === "uploading"
        ? uploadContribution
        : jobProgress > 0
          ? Math.max(uploadContribution, jobProgress)
          : uploadContribution;
    const boundedProgress = Math.max(1, Math.min(99, effectiveProgress));
    if (boundedProgress < 2) return null;
    const remaining = (elapsed * (100 - boundedProgress)) / boundedProgress;
    return Math.max(0, Math.round(remaining));
  }, [activeJob, etaTick, uploadProgress]);

  const formatEta = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return "Finalizing...";
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const remSecs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    if (mins > 0) return `${mins}m ${remSecs}s`;
    return `${remSecs}s`;
  };

  const etaLabel = etaSeconds !== null ? formatEta(etaSeconds) : "Estimating...";
  const etaSuffix = etaSeconds !== null && etaSeconds > 0 ? " remaining" : "";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-premium text-foreground">Creator Studio</h1>
              <p className="text-muted-foreground mt-1">Ship edits faster with live preview and real-time feedback</p>
            </div>
            <div className="flex items-center gap-3">
              {me && (
                <>
                  {isDevAccount && (
                    <Badge className="bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-orange-500/20 text-amber-200 border border-amber-400/40 uppercase tracking-[0.25em] text-[10px] px-3 py-1">
                      Dev
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {tierLabel} plan
                  </Badge>
                  <Badge variant="secondary" className="bg-muted/40 text-muted-foreground border-border/60">
                    {maxRendersPerMonth === null || maxRendersPerMonth === undefined
                      ? "Unlimited renders"
                      : `${rendersRemaining ?? 0} renders left`}
                  </Badge>
                </>
              )}
              <Button onClick={handlePickFile} className="rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mkv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              if (e.target) e.target.value = "";
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <aside className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Recent Jobs</h2>
                <Badge variant="secondary" className="bg-muted/40 text-muted-foreground">
                  {jobs.length}
                </Badge>
              </div>
              {loadingJobs && <p className="text-xs text-muted-foreground">Loading jobs...</p>}
              {!loadingJobs && jobs.length === 0 && (
                <p className="text-xs text-muted-foreground">No jobs yet. Upload a video to get started.</p>
              )}
              <div className="space-y-2">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleSelectJob(job.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition ${
                      normalizeStatus(job.status) === "ready"
                        ? "border-success/40 bg-success/10"
                        : selectedJobId === job.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{displayName(job)}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(job.status)}`}>
                        {STATUS_LABELS[normalizeStatus(job.status)] || "Queued"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-6">
              <div
                className={`glass-card p-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
                  isDragging ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/30"
                }`}
                onClick={handlePickFile}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">Drop your video here or click to upload</p>
                  <p className="text-sm text-muted-foreground">MP4, MOV, MKV, AVI up to 2GB</p>
                  {uploadingJobId && (
                    <div className="w-full max-w-sm mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2 bg-muted [&>div]:bg-primary" />
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="aspect-video bg-muted/30 flex items-center justify-center relative">
                  {showVideo ? (
                    <video src={activeJob?.outputUrl || ""} controls className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      <div className="relative z-10 flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                          {activeJob && !isTerminalStatus(activeJob.status) ? (
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                          ) : (
                            <Play className="w-6 h-6 text-primary ml-0.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {activeJob
                            ? normalizedActiveStatus === "ready"
                              ? "Ready to export"
                              : normalizedActiveStatus === "failed"
                                ? "Job failed"
                                : "Processing your edit..."
                            : "Select a job to preview"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pipeline</p>
                    <p className="text-xs text-muted-foreground">Live status updates while your job runs</p>
                  </div>
                  {activeJob && (
                    <Badge variant="outline" className={`text-xs ${statusBadgeClass(activeJob.status)}`}>
                      {activeStatusLabel}
                    </Badge>
                  )}
                </div>

                {loadingJob && <p className="text-xs text-muted-foreground">Loading job details...</p>}
                {!activeJob && !loadingJob && (
                  <p className="text-xs text-muted-foreground">Select a job from the left to view its pipeline.</p>
                )}

                {activeJob && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {PIPELINE_STEPS.map((step, idx) => {
                        const active = currentStepIndex !== -1 && idx <= currentStepIndex && activeJob.status !== "failed";
                        return (
                          <Badge
                            key={step.key}
                            variant="secondary"
                            className={`border ${
                              active
                                ? "border-primary/30 text-primary bg-primary/10"
                                : "border-border/50 text-muted-foreground bg-muted/30"
                            }`}
                          >
                            {step.label}
                          </Badge>
                        );
                      })}
                      {normalizeStatus(activeJob.status) === "failed" && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>

                    {!isTerminalStatus(activeJob.status) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{activeStatusLabel}</span>
                          <span className="text-xs text-muted-foreground">{activeJob.progress ?? 0}%</span>
                        </div>
                        <Progress value={activeJob.progress ?? 0} className="h-2 bg-muted [&>div]:bg-primary" />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="uppercase tracking-[0.2em] text-muted-foreground/80">Estimated time</span>
                          <span className="font-premium text-[12px] text-foreground">
                            {etaLabel}
                            {etaSuffix}
                          </span>
                        </div>
                      </div>
                    )}

                    {normalizeStatus(activeJob.status) === "ready" && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Export is ready. Download your final cut.</p>
                        <Button size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
                          <Download className="w-4 h-4" /> Open Export
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Export ready</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose your quality and download the final MP4.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Export Quality</span>
                <span className="text-xs text-muted-foreground">Max: {maxQuality.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">{qualityButtons}</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setExportOpen(false)}>
                Close
              </Button>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleDownload}>
                <Download className="w-4 h-4" /> Final MP4
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </GlowBackdrop>
  );
};

export default Editor;
