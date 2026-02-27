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
        "fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-[var(--ae-border)] bg-[color:color-mix(in_srgb,var(--ae-shell)_86%,black_20%)] px-3 py-5 backdrop-blur-2xl lg:flex",
        className,
      )}
    >
      <div className="mb-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.4)] premium-duotone-action text-sm font-bold text-white"
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
                    ? "border-[rgba(212,175,55,0.45)] bg-[linear-gradient(130deg,rgba(212,175,55,0.3),rgba(192,132,252,0.2))] text-white shadow-[0_6px_26px_rgba(212,175,55,0.2)]"
                    : "border-white/10 bg-black/30 text-slate-400 hover:border-[rgba(212,175,55,0.36)] hover:text-slate-100",
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
          className="h-11 w-11 rounded-full border border-[rgba(212,175,55,0.52)] premium-duotone-action text-xs font-semibold text-white"
          aria-label="User avatar"
        >
          U
        </button>
      </div>
    </aside>
  );
}
