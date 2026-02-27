import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CircleCheckBig, Clock3, Film, Loader2, Sparkles } from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import GoldAccentButton from "@/components/premium/GoldAccentButton";
import MetallicProgress from "@/components/premium/MetallicProgress";
import PremiumCard from "@/components/premium/PremiumCard";
import VIPBadge from "@/components/premium/VIPBadge";

const jobs = [
  { id: "job_2084", title: "Episode 14 - Hook Recut", status: "processing", eta: "02:14", mode: "Vertical", progress: 62 },
  { id: "job_2081", title: "Podcast Clip Batch", status: "ready", eta: "Done", mode: "Horizontal", progress: 100 },
  { id: "job_2079", title: "Reels Comp - Product Launch", status: "queued", eta: "05:42", mode: "Vertical", progress: 22 },
];

const PIPELINE_STEPS = ["Analyze", "Hook", "Pacing", "Captions", "Render", "Ready"];

const statusStyles: Record<string, string> = {
  ready: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
  processing: "border-[rgba(52,240,208,0.45)] bg-[rgba(52,240,208,0.12)] text-[#95fff2]",
  queued: "border-purple-300/35 bg-purple-500/10 text-purple-100",
};

export default function Jobs() {
  const [expandedJobId, setExpandedJobId] = useState<string>(jobs[0].id);
  const activeJob = useMemo(() => jobs.find((job) => job.id === expandedJobId) || jobs[0], [expandedJobId]);

  return (
    <AppShell title="AutoEditor Jobs" showSidebar>
      <div className="space-y-5">
        <PremiumCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold-accent)]">Pipeline Console</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">Elite Render Jobs</h1>
              <p className="mt-2 text-sm text-slate-300">Track retention optimization pipelines and export status in one place.</p>
            </div>
            <VIPBadge label="Premium Only" />
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold-accent)]">Active Focus</p>
              <p className="mt-1 text-sm text-slate-100">{activeJob.title}</p>
            </div>
            <GoldAccentButton size="sm" icon={<Sparkles className="h-4 w-4" />}>
              Focus Pipeline
            </GoldAccentButton>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-6">
            {PIPELINE_STEPS.map((step, index) => {
              const threshold = (index / (PIPELINE_STEPS.length - 1)) * 100;
              const done = activeJob.progress >= threshold;
              return (
                <div key={step} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[rgba(7,7,12,0.72)] px-2.5 py-2">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                      done
                        ? "border-[rgba(52,240,208,0.48)] bg-[rgba(52,240,208,0.14)] text-[#95fff2]"
                        : "border-white/20 text-slate-400"
                    }`}
                  >
                    {done ? <CircleCheckBig className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="text-xs text-slate-300">{step}</span>
                </div>
              );
            })}
          </div>
        </PremiumCard>

        <div className="space-y-3">
          {jobs.map((job) => {
            const open = expandedJobId === job.id;
            return (
              <PremiumCard key={job.id} className="p-4">
                <button
                  type="button"
                  onClick={() => setExpandedJobId(open ? "" : job.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{job.id} • {job.mode}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-1 ${statusStyles[job.status] || statusStyles.queued}`}>
                      {job.status}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-slate-300">
                      <Clock3 className="h-3.5 w-3.5" />
                      {job.eta}
                    </span>
                    {open ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                  </div>
                </button>

                <MetallicProgress value={job.progress} className="mt-3" />

                {open ? (
                  <div className="mt-3 grid gap-3 rounded-2xl border border-[rgba(52,240,208,0.22)] bg-[rgba(7,7,12,0.72)] p-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Pipeline</p>
                      <p className="mt-1 text-sm text-slate-100">{job.status === "ready" ? "Export Ready" : "In Progress"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">ETA</p>
                      <p className="mt-1 text-sm text-slate-100">{job.eta}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Completion</p>
                      <p className="mt-1 text-sm text-slate-100">{job.progress}%</p>
                    </div>
                  </div>
                ) : null}
              </PremiumCard>
            );
          })}
        </div>

        <PremiumCard className="flex items-center gap-3 p-4 text-sm text-slate-300">
          <Film className="h-4 w-4 text-[var(--gold-accent)]" />
          Pipeline stages: analyze → hook optimize → cut pacing → caption pass → export
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-[var(--gold-accent)]" />
        </PremiumCard>
      </div>
    </AppShell>
  );
}

