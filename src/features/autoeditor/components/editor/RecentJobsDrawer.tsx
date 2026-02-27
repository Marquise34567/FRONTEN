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
        className="w-[420px] border-l border-white/15 bg-[#13151d]/92 p-0 text-[#f4ecdf] shadow-[0_38px_92px_-38px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        onMouseMove={onInteract}
        onKeyDown={onInteract}
      >
        <SheetHeader className="border-b border-white/15 bg-black/25 px-4 py-4 text-left">
          <SheetTitle className="text-lg tracking-tight text-[#fbf3e7]">Recent Jobs</SheetTitle>
          <SheetDescription className="text-[#c1b4b7]">
            Auto-closes after {inactivitySeconds}s inactivity.
          </SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100vh-92px)] overflow-y-auto px-4 py-4">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-black/28 px-4 py-8 text-center text-sm text-[#a89da0]">
              No recent renders yet.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-2xl border border-white/15 bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-[#e6cfa9]/35 hover:bg-black/45"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#fbf2e5]">{job.fileName || "Untitled"}</p>
                    <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-[#d2c8cb]">
                      {modeLabel(job.mode)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#b8adb0]">
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
