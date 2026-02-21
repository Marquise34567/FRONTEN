import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Plus, Clock, CheckCircle2, Loader2, FileVideo, Sparkles } from "lucide-react";

interface Job {
  id: string;
  name: string;
  status: "uploading" | "analyzing" | "planning" | "rendering" | "completed" | "failed";
  progress: number;
  niche?: string;
  createdAt: string;
}

const mockJobs: Job[] = [
  { id: "1", name: "gaming-highlights.mp4", status: "completed", progress: 100, niche: "gaming", createdAt: "2 hours ago" },
  { id: "2", name: "podcast-ep42.mp4", status: "analyzing", progress: 45, niche: "podcast", createdAt: "10 min ago" },
  { id: "3", name: "fitness-routine.mp4", status: "completed", progress: 100, niche: "fitness", createdAt: "1 day ago" },
];

const statusConfig = {
  uploading: { icon: Upload, label: "Uploading", color: "text-warning" },
  analyzing: { icon: Loader2, label: "Analyzing", color: "text-primary", spin: true },
  planning: { icon: Sparkles, label: "Planning", color: "text-primary", spin: true },
  rendering: { icon: Loader2, label: "Rendering", color: "text-primary", spin: true },
  completed: { icon: CheckCircle2, label: "Completed", color: "text-success" },
  failed: { icon: Clock, label: "Failed", color: "text-destructive" },
};

const Dashboard = () => {
  const [isDragging, setIsDragging] = useState(false);

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
            <Button className="rounded-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>

          {/* Upload Zone */}
          <div
            className={`glass-card p-12 mb-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
              isDragging ? "border-primary/60 bg-primary/5" : "border-border/40 hover:border-primary/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={() => setIsDragging(false)}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="font-medium text-foreground">Drop your video here or click to upload</p>
              <p className="text-sm text-muted-foreground">MP4, MOV, AVI up to 2GB</p>
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold font-display text-foreground mb-4">Recent Jobs</h2>
            {mockJobs.map((job, i) => {
              const status = statusConfig[job.status];
              const Icon = status.icon;
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  <Link to={`/app/job/${job.id}`}>
                    <div className="glass-card-hover p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <FileVideo className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">{job.name}</span>
                          {job.niche && <span className="pill-badge text-[10px] py-0">{job.niche}</span>}
                        </div>
                        {job.status !== "completed" && job.status !== "failed" && (
                          <Progress value={job.progress} className="h-1.5 bg-muted [&>div]:bg-primary" />
                        )}
                        {(job.status === "completed" || job.status === "failed") && (
                          <p className="text-xs text-muted-foreground">{job.createdAt}</p>
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
