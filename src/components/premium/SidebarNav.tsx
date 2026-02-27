import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Clapperboard,
  FileVideo2,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";

type SidebarNavProps = {
  className?: string;
};

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Editor", icon: Clapperboard, to: "/editor" },
  { label: "Analytics", icon: BarChart3, to: "/analytics" },
  { label: "Jobs", icon: FileVideo2, to: "/jobs" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

export default function SidebarNav({ className }: SidebarNavProps) {
  const location = useLocation();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-[var(--ae-border)] bg-[color:var(--ae-shell)] px-3 py-5 backdrop-blur-xl lg:flex",
        className,
      )}
    >
      <div className="mb-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/50 to-fuchsia-500/35 text-sm font-bold text-white"
        >
          AE
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2">
        <PurpleAccentButton size="icon" className="h-11 w-11 rounded-2xl" asChild>
          <Link to="/editor" aria-label="New Project">
            <Plus className="h-4 w-4" />
          </Link>
        </PurpleAccentButton>

        <div className="mt-3 flex w-full flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all",
                  active
                    ? "border-purple-300/45 bg-gradient-to-b from-purple-500/35 to-fuchsia-500/25 text-white shadow-[0_0_20px_rgba(168,85,247,0.38)]"
                    : "border-white/10 bg-black/30 text-slate-400 hover:border-white/25 hover:text-slate-100",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="h-11 w-11 rounded-full border border-purple-300/45 bg-gradient-to-br from-[#c084fc] to-[#a855f7] text-xs font-semibold text-white shadow-[0_0_25px_rgba(168,85,247,0.45)]"
          aria-label="User avatar"
        >
          U
        </button>
      </div>
    </aside>
  );
}
