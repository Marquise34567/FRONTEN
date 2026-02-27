import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Layers3,
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
  { label: "Projects", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Templates", icon: Layers3, to: "/settings" },
  { label: "Analytics", icon: BarChart3, to: "/analytics" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

export default function SidebarNav({ className }: SidebarNavProps) {
  const location = useLocation();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-white/10 bg-black/90 px-3 py-5 backdrop-blur-xl lg:flex",
        className,
      )}
    >
      <div className="mb-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/18 bg-white/[0.04] text-sm font-bold text-white"
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
                  "group inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all",
                  active
                    ? "border-cyan-200/40 bg-[rgba(47,228,200,0.16)] text-cyan-50 shadow-[0_0_18px_rgba(47,228,200,0.18)]"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-cyan-200/35 hover:text-cyan-50",
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
          className="h-11 w-11 rounded-full border border-white/18 bg-white/[0.04] text-xs font-semibold text-cyan-50"
          aria-label="User avatar"
        >
          U
        </button>
      </div>
    </aside>
  );
}

