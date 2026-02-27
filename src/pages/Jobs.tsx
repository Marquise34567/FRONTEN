import { Clock3, Film, Loader2 } from "lucide-react";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";

const jobs = [
  { id: "job_2084", title: "Episode 14 - Hook Recut", status: "processing", eta: "02:14", mode: "Vertical" },
  { id: "job_2081", title: "Podcast Clip Batch", status: "ready", eta: "Done", mode: "Horizontal" },
  { id: "job_2079", title: "Reels Comp - Product Launch", status: "queued", eta: "05:42", mode: "Vertical" },
];

export default function Jobs() {
  return (
    <AppShell title="AutoEditor Jobs" showSidebar>
      <div className="space-y-4">
        <PremiumCard className="p-5">
          <h1 className="text-2xl font-semibold text-slate-100">Render Jobs</h1>
          <p className="mt-1 text-sm text-slate-400">Track retention optimization pipelines and export status in one place.</p>
        </PremiumCard>

        <div className="space-y-3">
          {jobs.map((job) => (
            <PremiumCard key={job.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{job.id} • {job.mode}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-1 ${
                      job.status === "ready"
                        ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                        : job.status === "processing"
                          ? "border-purple-300/40 bg-purple-500/10 text-purple-200"
                          : "border-amber-300/40 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {job.status}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-slate-300">
                    <Clock3 className="h-3.5 w-3.5" />
                    {job.eta}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/55">
                <div
                  className={`h-full bg-gradient-to-r ${
                    job.status === "ready"
                      ? "from-emerald-500 to-emerald-300"
                      : job.status === "processing"
                        ? "from-purple-500 to-fuchsia-400"
                        : "from-amber-500 to-amber-300"
                  }`}
                  style={{ width: job.status === "ready" ? "100%" : job.status === "processing" ? "62%" : "22%" }}
                />
              </div>
            </PremiumCard>
          ))}
        </div>

        <PremiumCard className="flex items-center gap-3 p-4 text-sm text-slate-300">
          <Film className="h-4 w-4 text-purple-300" />
          Pipeline stages: analyze → hook optimize → cut pacing → caption pass → export
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-purple-300" />
        </PremiumCard>
      </div>
    </AppShell>
  );
}
