import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

type TopHeaderProps = {
  title?: string;
  className?: string;
  rightSlot?: ReactNode;
};

export default function TopHeader({ title = "AutoEditor", className, rightSlot }: TopHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#07080d]/85 px-4 backdrop-blur-md lg:pl-28 lg:pr-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="text-lg font-semibold tracking-tight text-slate-100">
          {title}
        </Link>
        <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-slate-400 sm:flex sm:min-w-[300px]">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects, clips, analytics..."
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {rightSlot}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/35 text-slate-300 hover:border-white/20 hover:text-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-purple-300/45 bg-gradient-to-br from-[#c084fc] to-[#a855f7] text-xs font-semibold text-white"
          aria-label="Profile"
        >
          AE
        </button>
      </div>
    </header>
  );
}
