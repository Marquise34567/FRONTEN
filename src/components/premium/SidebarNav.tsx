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
        "fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-[var(--ae-border)] bg-[color:color-mix(in_srgb,var(--ae-shell)_86%,black_20%)] px-3 py-5 backdrop-blur-2xl lg:flex",
        className,
      )}
    >
      <div className="mb-6 flex justify-center">
        <Link
          to="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/30 bg-[linear-gradient(135deg,rgba(52,240,208,0.24),rgba(93,91,255,0.28))] text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(52,240,208,0.24)]"
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
                    ? "border-cyan-200/40 bg-[linear-gradient(130deg,rgba(52,240,208,0.28),rgba(180,119,255,0.24))] text-cyan-50 shadow-[0_6px_26px_rgba(52,240,208,0.24)]"
                    : "border-white/10 bg-black/30 text-slate-400 hover:border-cyan-200/35 hover:text-cyan-50 hover:shadow-[0_0_16px_rgba(52,240,208,0.22)]",
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
          className="h-11 w-11 rounded-full border border-cyan-200/40 bg-[linear-gradient(135deg,rgba(52,240,208,0.28),rgba(180,119,255,0.22))] text-xs font-semibold text-cyan-50 shadow-[0_0_20px_rgba(52,240,208,0.22)]"
          aria-label="User avatar"
        >
          U
        </button>
      </div>
    </aside>
  );
}

