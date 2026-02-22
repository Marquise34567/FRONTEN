import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Plus, Clock, CheckCircle2, Loader2, FileVideo, Sparkles } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Job {
  id: string;
  status: "queued" | "uploading" | "analyzing" | "rendering" | "completed" | "failed";
  progress: number;
  inputPath: string;
  outputPath?: string | null;
  createdAt: string;
  error?: string | null;
}

const statusConfig = {
  queued: { icon: Clock, label: "Queued", color: "text-muted-foreground" },
  uploading: { icon: Upload, label: "Uploading", color: "text-warning" },
  analyzing: { icon: Loader2, label: "Analyzing", color: "text-primary", spin: true },
  rendering: { icon: Sparkles, label: "Rendering", color: "text-primary", spin: true },
  completed: { icon: CheckCircle2, label: "Completed", color: "text-success" },
  failed: { icon: Clock, label: "Failed", color: "text-destructive" },
} as const;

const Dashboard = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const fetchJobs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<{ jobs: Job[] }>("/api/jobs", { token: accessToken });
      setJobs(data.jobs);
    } catch (err) {
      toast({ title: "Failed to load jobs", description: "Please refresh and try again." });
    } finally {
      setLoadingJobs(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const active = jobs.some((job) => ["queued", "uploading", "analyzing", "rendering"].includes(job.status));
    if (!active) return;
    const timer = setInterval(() => {
      fetchJobs();
    }, 2500);
    return () => clearInterval(timer);
  }, [jobs, fetchJobs]);

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

  const handleFile = async (file: File) => {
    if (!accessToken) return;
    setUploadProgress(0);
    try {
      const create = await apiFetch<{ job: Job; uploadUrl?: string | null; inputPath: string; bucket: string }>("/api/jobs/create", {
        method: "POST",
        body: JSON.stringify({ filename: file.name }),
        token: accessToken,
      });

      setUploadingJobId(create.job.id);
      setJobs((prev) => [{ ...create.job, status: "uploading", progress: 5 }, ...prev]);

      if (create.uploadUrl) {
        try {
          await uploadWithProgress(create.uploadUrl, file, setUploadProgress);
        } catch (err) {
          const { error } = await supabase.storage.from(create.bucket).upload(create.inputPath, file, { upsert: true });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.storage.from(create.bucket).upload(create.inputPath, file, { upsert: true });
        if (error) throw error;
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
      toast({ title: "Upload failed", description: err?.message || "Please try again." });
      setUploadingJobId(null);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const displayName = (job: Job) => job.inputPath?.split("/").pop() || "Untitled";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-display text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Upload videos and manage your editing jobs</p>
            </div>
            <Button onClick={handlePickFile} className="rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              if (e.target) e.target.value = "";
            }}
          />

          {/* Upload Zone */}
          <div
            className={`glass-card p-12 mb-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
              isDragging ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/30"
            }`}
            onClick={handlePickFile}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="font-medium text-foreground">Drop your video here or click to upload</p>
              <p className="text-sm text-muted-foreground">MP4, MOV, AVI up to 2GB</p>
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

          {/* Jobs List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold font-display text-foreground mb-4">Recent Jobs</h2>
            {loadingJobs && <p className="text-sm text-muted-foreground">Loading jobs...</p>}
            {!loadingJobs && jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet. Upload a video to get started.</p>}
            {jobs.map((job, i) => {
              const status = statusConfig[job.status];
              const Icon = status.icon;
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <Link to={`/app/job/${job.id}`}>
                    <div className="glass-card-hover p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <FileVideo className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">{displayName(job)}</span>
                        </div>
                        {job.status !== "completed" && job.status !== "failed" && (
                          <Progress value={job.progress} className="h-1.5 bg-muted [&>div]:bg-primary" />
                        )}
                        {(job.status === "completed" || job.status === "failed") && (
                          <p className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                        <Icon className={`w-3.5 h-3.5 ${(status as any).spin ? "animate-spin" : ""}`} />
                        {status.label}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Dashboard;
