import { Clock3 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RenderJobSummary } from "@/features/autoeditor/types";

type RecentJobsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: RenderJobSummary[];
  inactivitySeconds: number;
  onInteract: () => void;
};

const modeLabel = (mode: string) => (mode === "vertical" ? "Vertical" : "Horizontal");

export default function RecentJobsDrawer({
  open,
  onOpenChange,
  jobs,
  inactivitySeconds,
  onInteract,
}: RecentJobsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] border-l border-white/10 bg-[#0f1117]/90 p-0 text-slate-100 backdrop-blur-xl"
        onMouseMove={onInteract}
        onKeyDown={onInteract}
      >
        <SheetHeader className="border-b border-white/10 px-4 py-4 text-left">
          <SheetTitle className="text-lg tracking-tight text-slate-50">Recent Jobs</SheetTitle>
          <SheetDescription className="text-slate-400">
            Auto-closes after {inactivitySeconds}s inactivity.
          </SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-92px)] overflow-y-auto px-4 py-4">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-slate-500">
              No recent renders yet.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-100">{job.fileName || "Untitled"}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                      {modeLabel(job.mode)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(job.createdAt).toLocaleString()}
                    </span>
                    <span>{Math.round(job.progress)}%</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
