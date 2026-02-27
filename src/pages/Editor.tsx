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
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/use-me";
import { PLAN_CONFIG, QUALITY_ORDER, clampQualityForTier, normalizeQuality, type ExportQuality, type PlanTier } from "@shared/planConfig";

const MB = 1024 * 1024;
const LARGE_UPLOAD_THRESHOLD = 64 * MB;
// Supabase storage removed — use R2 via backend pre-signed multipart URLs only
const FILE_INPUT_ACCEPT = ".mp4,.mkv,video/mp4,video/x-matroska";
const isAllowedUploadFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".mp4") || lowerName.endsWith(".mkv");
};

const chunkSizeForFile = (size: number) => {
  if (size >= 2 * 1024 * MB) return 32 * MB;
  if (size >= 1024 * MB) return 24 * MB;
  if (size >= 512 * MB) return 16 * MB;
  if (size >= 256 * MB) return 12 * MB;
  return 8 * MB;
};

const uploadParallelismForFile = (size: number) => {
  if (size >= 1024 * MB) return 4;
  if (size >= 512 * MB) return 3;
  if (size >= 256 * MB) return 2;
  return 1;
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

const STAGE_ETA_BASE_SECONDS: Record<string, number> = {
  queued: 35,
  uploading: 60,
  analyzing: 45,
  hooking: 30,
  cutting: 40,
  pacing: 35,
  story: 45,
  subtitling: 60,
  audio: 35,
  retention: 30,
  rendering: 120,
};

const computeStageEtaBaseline = ({
  status,
  fileSizeBytes,
  quality,
}: {
  status: string;
  fileSizeBytes?: number | null;
  quality?: ExportQuality | null;
}) => {
  const fileMB = fileSizeBytes ? Math.max(1, fileSizeBytes / MB) : 256;
  const qualityMultiplier = quality === "4k" ? 1.45 : quality === "1080p" ? 1.2 : 1;
  const base = STAGE_ETA_BASE_SECONDS[status] ?? 75;

  if (status === "uploading") {
    return Math.max(12, Math.round(fileMB / 8 + 12));
  }
  if (status === "rendering") {
    return Math.max(20, Math.round(base + fileMB * 0.18 * qualityMultiplier));
  }
  const variable = Math.round(Math.sqrt(fileMB) * 4 * qualityMultiplier);
  return Math.max(10, base + variable);
};

const normalizeStatus = (status?: JobStatus | string | null) => {
  if (!status) return "queued";
  const raw = String(status).toLowerCase();
  if (raw === "completed" || raw === "ready") return "ready";
  if (raw === "processing") return "rendering";
  return raw as JobStatus;
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
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytesUploaded, setUploadBytesUploaded] = useState<number | null>(null);
  const [uploadBytesTotal, setUploadBytesTotal] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [qualityByJob, setQualityByJob] = useState<Record<string, ExportQuality>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevJobStatusRef = useRef<Map<string, JobStatus>>(new Map());
  const pipelineStartRef = useRef<Record<string, number>>({});
  const uploadStartRef = useRef<Record<string, number>>({});
  const jobFileSizeRef = useRef<Record<string, number>>({});
  const statusStartRef = useRef<Record<string, { status: string; startedAt: number }>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const [etaTick, setEtaTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, signOut } = useAuth();
  const { toast } = useToast();

  const selectedJobId = searchParams.get("jobId");
  const hasActiveJobs = jobs.some((job) => !isTerminalStatus(job.status));
  const { data: me, refetch: refetchMe } = useMe({ refetchInterval: hasActiveJobs ? 2500 : false });
  const [entitlements, setEntitlements] = useState<{ autoDownloadAllowed?: boolean } | null>(null);
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState<boolean | null>(null);
  const [autoDownloadModal, setAutoDownloadModal] = useState<{ open: boolean; url?: string; fileName?: string; jobId?: string }>({ open: false });
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

  const [authError, setAuthError] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }
    try {
      const data = await apiFetch<{ jobs?: JobSummary[] }>("/api/jobs", { token: accessToken });
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        toast({ title: "Session expired", description: "Please sign in again.", action: undefined });
        try {
          await signOut();
        } catch (e) {
          // ignore
        }
      } else {
        toast({ title: "Failed to load jobs", description: "Please refresh and try again." });
      }
    } finally {
      setLoadingJobs(false);
    }
  }, [accessToken, toast, signOut]);

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
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true)
          toast({ title: "Session expired", description: "Please sign in again." })
          try { await signOut() } catch (e) {}
        } else {
          toast({ title: "Failed to load job", description: "Please refresh and try again." });
        }
        setActiveJob(null);
      } finally {
        setLoadingJob(false);
      }
    },
    [accessToken, toast, signOut],
  );

  useEffect(() => {
    if (!accessToken) {
      setJobs([]);
      setActiveJob(null);
      setLoadingJobs(false);
      return;
    }
    if (authError) return;
    setLoadingJobs(true);
    fetchJobs();
  }, [accessToken, authError, fetchJobs]);

  useEffect(() => {
    if (accessToken) setAuthError(false);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      const local = typeof window !== "undefined" ? window.localStorage.getItem("autoDownloadEnabled") : null;
      setAutoDownloadEnabled(local === "true");
      return;
    }
    apiFetch('/api/billing/entitlements', { token: accessToken })
      .then((d) => setEntitlements(d?.entitlements ? d.entitlements : null))
      .catch(async (err) => {
        setEntitlements(null);
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try { await signOut() } catch (e) {}
        }
      });
    apiFetch('/api/settings', { token: accessToken })
      .then((d) => setAutoDownloadEnabled(Boolean(d?.settings?.autoDownload)))
      .catch(async (err) => {
        setAutoDownloadEnabled(null);
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          try { await signOut() } catch (e) {}
        }
      });
  }, [accessToken, signOut]);

  useEffect(() => {
    const timer = setInterval(() => setEtaTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeJob) return;
    const id = activeJob.id;
    const normalized = normalizeStatus(activeJob.status);
    const prev = statusStartRef.current[id];
    if (!prev || prev.status !== normalized) {
      statusStartRef.current[id] = { status: normalized, startedAt: Date.now() };
    }
  }, [activeJob?.id, activeJob?.status]);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set("jobId", jobs[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [jobs, searchParams, selectedJobId, setSearchParams]);

  useEffect(() => {
    if (!selectedJobId || !accessToken || authError) {
      setActiveJob(null);
      return;
    }
    fetchJob(selectedJobId);
    setExportOpen(false);
  }, [selectedJobId, accessToken, authError, fetchJob]);

  useEffect(() => {
    if (!accessToken || !hasActiveJobs || authError) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [accessToken, hasActiveJobs, fetchJobs, authError]);

  useEffect(() => {
    if (!accessToken || authError || !activeJob || !selectedJobId) return;
    if (isTerminalStatus(activeJob.status)) return;
    const timer = setInterval(() => {
      fetchJob(selectedJobId);
    }, 2500);
    return () => clearInterval(timer);
  }, [accessToken, authError, activeJob, selectedJobId, fetchJob]);

  useEffect(() => {
    const prev = prevJobStatusRef.current;
    const next = new Map<string, JobStatus>();
    const transitioned: string[] = [];
    for (const job of jobs) {
      next.set(job.id, job.status);
      const prevStatus = prev.get(job.id);
      const prevNorm = normalizeStatus(prevStatus);
      const newNorm = normalizeStatus(job.status);
      if (prevStatus && !isTerminalStatus(prevStatus) && newNorm === "ready") {
        transitioned.push(job.id);
      }
    }
    prevJobStatusRef.current = next;
    if (transitioned.length > 0) {
      refetchMe();
      for (const id of transitioned) {
        ;(async () => {
          try {
            // ensure entitlements/settings are loaded
            if (entitlements === null && accessToken) {
              const d = await apiFetch('/api/billing/entitlements', { token: accessToken });
              setEntitlements(d?.entitlements ?? null);
            }
            if (autoDownloadEnabled === null) {
              if (accessToken) {
                const s = await apiFetch('/api/settings', { token: accessToken });
                setAutoDownloadEnabled(Boolean(s?.settings?.autoDownload));
              } else {
                const local = typeof window !== 'undefined' ? window.localStorage.getItem('autoDownloadEnabled') : null;
                setAutoDownloadEnabled(local === 'true');
              }
            }
            // decide whether to auto-download
            const allowed = entitlements?.autoDownloadAllowed ?? false;
            const enabled = autoDownloadEnabled ?? false;
            const downloadedKey = `auto_downloaded_${id}`;
            if (!allowed || !enabled) return;
            if (typeof window !== 'undefined' && window.localStorage.getItem(downloadedKey)) return;

            // fetch job detail to get URL or fileName
            const j = jobs.find((x) => x.id === id);
            let fileName: string | undefined;
            let url: string | undefined;
            if (j && (j as any).outputUrl) {
              url = (j as any).outputUrl;
              fileName = (j as any).fileName ?? undefined;
            } else {
              try {
                const resp = await apiFetch<{ job?: any }>(`/api/jobs/${id}`, { token: accessToken });
                url = resp?.job?.outputUrl ?? undefined;
                fileName = resp?.job?.fileName ?? undefined;
              } catch (e) {
                // fallback to download-url endpoint
              }
            }
            if (!url) {
              try {
                const out = await apiFetch<{ url: string }>(`/api/jobs/${id}/download-url`, { method: 'POST', token: accessToken });
                url = out.url;
              } catch (e) {
                return;
              }
            }

            // attempt programmatic download
            const a = document.createElement('a');
            a.href = url as string;
            if (fileName) a.download = fileName;
            a.target = '_blank';
            a.style.display = 'none';
            document.body.appendChild(a);
            try {
              a.click();
              // assume success; if browser blocked, user can tap in modal
              // set a short timeout to mark as downloaded optimistically
              setTimeout(() => {
                try {
                  window.localStorage.setItem(downloadedKey, 'true');
                } catch (e) {}
              }, 1200);
            } catch (e) {
              // show modal fallback
              setAutoDownloadModal({ open: true, url, fileName, jobId: id });
            } finally {
              document.body.removeChild(a);
            }
          } catch (e) {
            // ignore
          }
        })();
      }
    }
  }, [jobs, refetchMe, entitlements, autoDownloadEnabled, accessToken]);

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
    return () => {
      try {
        if (typeof highlightTimeoutRef.current === "number") window.clearTimeout(highlightTimeoutRef.current as any);
      } catch (e) {}
    };
  }, []);

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

  const uploadWithProgress = (
    url: string,
    file: File,
    onProgress: (value: number) => void,
    onProgressBytes?: (loaded: number, total: number) => void,
  ) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
        if (onProgressBytes) onProgressBytes(event.loaded, event.total);
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

  // Resumable upload logic removed — we use backend-presigned multipart upload to R2

  const handleFile = async (file: File) => {
    if (!isAllowedUploadFile(file)) {
      toast({ title: "Unsupported file type", description: "Please upload an MP4 or MKV file." });
      return;
    }
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
      statusStartRef.current[create.job.id] = { status: "uploading", startedAt: Date.now() };
      setJobs((prev) => [{ ...create.job, status: "uploading", progress: 5 }, ...(Array.isArray(prev) ? prev : [])]);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("jobId", create.job.id);
      setSearchParams(nextParams, { replace: false });

      // Attempt R2 multipart first (preferred for large files)
      const tryR2Multipart = async () => {
        try {
          const r2create = await apiFetch<{
            uploadId: string
            key: string
            partSize: number
            presignedParts: { partNumber: number; url: string }[]
          }>(`/api/uploads/create`, {
            method: 'POST',
            body: JSON.stringify({ jobId: create.job.id, filename: file.name, contentType: file.type, sizeBytes: file.size }),
            token: accessToken,
          })

          const { uploadId, key, partSize, presignedParts } = r2create
          if (!uploadId || !key || !Array.isArray(presignedParts) || presignedParts.length === 0) throw new Error('invalid_r2_create')

          const total = file.size
          const actualPartSize = partSize || 10 * MB
          const parts: { ETag: string; PartNumber: number }[] = []
          let uploaded = 0
          jobFileSizeRef.current[create.job.id] = total
          uploadStartRef.current[create.job.id] = Date.now()

          // presignedParts should be ordered by partNumber; iterate and upload corresponding slices
          for (const p of presignedParts) {
            const partNumber = p.partNumber
            const start = (partNumber - 1) * actualPartSize
            const end = Math.min(total, start + actualPartSize)
            const chunk = file.slice(start, end)
            const resp = await fetch(p.url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: chunk })
            if (!resp.ok) throw new Error(`upload_part_failed_${partNumber}`)
            const etag = resp.headers.get('ETag') || resp.headers.get('etag')
            if (!etag) {
              throw new Error(
                'missing_etag_header: configure R2 CORS ExposeHeaders to include ETag for multipart uploads'
              )
            }
            parts.push({ ETag: etag, PartNumber: partNumber })
            uploaded += chunk.size
            setUploadBytesUploaded(uploaded)
            setUploadBytesTotal(total)
            setUploadProgress(Math.round((uploaded / total) * 100))
          }

          // Complete multipart upload on backend
          await apiFetch('/api/uploads/complete', {
            method: 'POST',
            body: JSON.stringify({ jobId: create.job.id, key, uploadId, parts }),
            token: accessToken,
          })

          setUploadProgress(100)
          setUploadingJobId(null)
          setUploadBytesUploaded(null)
          setUploadBytesTotal(null)
          fetchJobs()
          toast({ title: 'Upload complete', description: 'Your job is now processing.' })
          return true
        } catch (err) {
          console.warn('R2 multipart upload failed', err)
          // best-effort abort if we have uploadId
          try {
            const maybe = err as any
            if (maybe?.uploadId && maybe?.key) {
              await apiFetch('/api/uploads/abort', { method: 'POST', body: JSON.stringify({ key: maybe.key, uploadId: maybe.uploadId }), token: accessToken })
            }
          } catch (e) {}
          return false
        }
      }

      // Always try R2 multipart first
      const usedR2 = await tryR2Multipart()
      if (usedR2) return

      const uploadViaProxy = async () => {
        const proxyPath = `/api/uploads/proxy?jobId=${encodeURIComponent(create.job.id)}`
        const proxyUrl = API_URL ? `${API_URL}${proxyPath}` : proxyPath
        const proxyResp = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        })
        if (!proxyResp.ok) throw new Error('Proxy upload failed')
        setUploadProgress(100)
      }

      // Fallback: if server provided a single PUT uploadUrl, use it. Otherwise use proxy upload.
      if (create.uploadUrl) {
        jobFileSizeRef.current[create.job.id] = file.size
        uploadStartRef.current[create.job.id] = Date.now()
        try {
          await uploadWithProgress(create.uploadUrl, file, setUploadProgress, (loaded, total) => {
            setUploadBytesUploaded(loaded)
            setUploadBytesTotal(total)
            setUploadProgress(Math.round((loaded / total) * 100))
          })
        } catch (err) {
          console.warn('Direct upload failed, falling back to proxy', err)
          await uploadViaProxy()
          toast({ title: 'Upload complete', description: 'Your job is now processing.' })
          setUploadingJobId(null)
          setUploadProgress(0)
          setUploadBytesUploaded(null)
          setUploadBytesTotal(null)
          fetchJobs()
          return
        }

        // Notify backend of completion for single-PUT flow
        await apiFetch(`/api/jobs/${create.job.id}/complete-upload`, {
          method: 'POST',
          body: JSON.stringify({ key: create.inputPath }),
          token: accessToken,
        })

        toast({ title: 'Upload complete', description: 'Your job is now processing.' })
        setUploadingJobId(null)
        setUploadProgress(0)
        setUploadBytesUploaded(null)
        setUploadBytesTotal(null)
        fetchJobs()
        return
      }

      // No direct upload URL available; proxy upload will update job and enqueue processing server-side.
      await uploadViaProxy()
      toast({ title: "Upload complete", description: "Your job is now processing." })
      try {
        if (typeof highlightTimeoutRef.current === "number") window.clearTimeout(highlightTimeoutRef.current as any)
      } catch (e) {}
      setHighlightedJobId(create.job.id)
      highlightTimeoutRef.current = window.setTimeout(() => setHighlightedJobId(null), 4000)
      setUploadingJobId(null)
      setUploadProgress(0)
      setUploadBytesUploaded(null)
      setUploadBytesTotal(null)
      fetchJobs()
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
      setUploadBytesUploaded(null);
      setUploadBytesTotal(null);
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
    const fileSize = jobFileSizeRef.current[activeJob.id] ?? uploadBytesTotal ?? null;
    const targetQuality = normalizeQuality(activeJob.finalQuality || activeJob.requestedQuality || "720p");
    const stageMarker = statusStartRef.current[activeJob.id];
    const stageStartedAt =
      stageMarker && stageMarker.status === normalized
        ? stageMarker.startedAt
        : pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const stageElapsed = Math.max(0, (Date.now() - stageStartedAt) / 1000);

    // If we're uploading, compute ETA from raw upload bytes/speed plus a small post-upload buffer
    if (normalized === "uploading") {
      const uploaded = uploadBytesUploaded;
      const total = uploadBytesTotal;
      const startAt = uploadStartRef.current[activeJob.id] ?? pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
      if (uploaded && total && uploaded > 0) {
        const elapsedUpload = Math.max(0.5, (Date.now() - startAt) / 1000);
        const speed = uploaded / elapsedUpload; // bytes/sec
        if (speed > 0) {
          const remainingBytes = Math.max(0, total - uploaded);
          const uploadETA = Math.round(remainingBytes / speed);
          // estimate post-upload processing: conservative heuristic based on file size
          const uploadSize = jobFileSizeRef.current[activeJob.id] ?? total;
          const fileMB = Math.max(1, uploadSize / (1024 * 1024));
          const processingEstimate = Math.round(fileMB * 0.2); // ~0.2s per MB as a conservative baseline
          return Math.max(0, uploadETA + processingEstimate);
        }
      }
      // fallback: estimate from upload percent progress if byte counts aren't available
      // Use the actual upload percent (0-100) rather than an unnecessarily scaled value.
      const startAtFallback = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
      const elapsed = Math.max(1, (Date.now() - startAtFallback) / 1000);
      const boundedProgress = Math.max(1, Math.min(99, uploadProgress ?? 0));
      const remaining = (elapsed * (100 - boundedProgress)) / boundedProgress;
      return Math.max(0, Math.round(remaining));
    }

    // Otherwise, estimate remaining processing time from job progress and elapsed pipeline time.
    const startAt = pipelineStartRef.current[activeJob.id] ?? new Date(activeJob.createdAt).getTime();
    const elapsed = Math.max(1, (Date.now() - startAt) / 1000);
    const jobProgress = typeof activeJob.progress === "number" ? activeJob.progress : 0;
    if (jobProgress > 0) {
      const remaining = Math.round((elapsed * (100 - jobProgress)) / jobProgress);
      return Math.max(0, remaining);
    }
    const baseline = computeStageEtaBaseline({ status: normalized, fileSizeBytes: fileSize, quality: targetQuality });
    return Math.max(1, Math.round(baseline - stageElapsed));
  }, [activeJob, etaTick, uploadProgress, uploadBytesUploaded, uploadBytesTotal]);

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

  const etaLabel = formatEta(etaSeconds);
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
            accept={FILE_INPUT_ACCEPT}
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
                      highlightedJobId === job.id
                        ? "ring-2 ring-primary/40 bg-primary/10 border-primary/40"
                        : normalizeStatus(job.status) === "ready"
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
                  <p className="text-sm text-muted-foreground">MP4 or MKV up to 2GB</p>
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
                          <span className="font-premium text-sm text-foreground font-semibold tracking-tight">
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
      <Dialog open={autoDownloadModal.open} onOpenChange={(open) => setAutoDownloadModal({ open })}>
        <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Tap to download</DialogTitle>
            <p className="text-sm text-muted-foreground">Your render finished — tap the button below to download.</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">If the download doesn't start automatically, press the button below.</div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setAutoDownloadModal({ open: false })}>Cancel</Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => {
                  try {
                    const url = autoDownloadModal.url;
                    const fileName = autoDownloadModal.fileName;
                    if (!url) return;
                    const a = document.createElement('a');
                    a.href = url;
                    if (fileName) a.download = fileName;
                    a.target = '_blank';
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (autoDownloadModal.jobId) window.localStorage.setItem(`auto_downloaded_${autoDownloadModal.jobId}`, 'true');
                  } catch (e) {
                    // ignore
                  }
                  setAutoDownloadModal({ open: false });
                }}
              >
                <Download className="w-4 h-4" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </GlowBackdrop>
  );
};

export default Editor;
