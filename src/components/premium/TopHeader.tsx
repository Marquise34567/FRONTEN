import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/components/premium/ThemeSwitcher";

type TopHeaderProps = {
  title?: string;
  withSidebar?: boolean;
  className?: string;
  rightSlot?: ReactNode;
};

export default function TopHeader({ title = "AutoEditor", withSidebar = false, className, rightSlot }: TopHeaderProps) {
  const { t } = useTranslation("common");

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--ae-border)] bg-[color:var(--ae-shell)] px-4 backdrop-blur-xl",
        withSidebar ? "lg:pl-28 lg:pr-6" : "lg:px-6",
        className,
      )}
    >
      <div className="flex min-w-[180px] items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--ae-text-primary)]">
          <span>{title}</span>
          <span className="pill-badge border-purple-300/20 bg-purple-500/12 px-2 py-0.5 text-[10px]">
            <svg className="sparkle mr-1 inline-block h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 2l1.902 4.26L18.5 8l-4.598 1.74L12 14l-1.902-4.26L6.5 8l4.598-1.74L12 2z" fill="currentColor" />
            </svg>
            {t("brand.beta")}
          </span>
        </Link>
      </div>

      <div className="mx-4 hidden min-w-[220px] max-w-[520px] flex-1 items-center rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 lg:flex">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search projects, clips, insights..."
          className="w-full bg-transparent pl-2 text-sm text-[var(--ae-text-primary)] outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="flex items-center gap-2">
        {rightSlot}
        <ThemeSwitcher />
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/35 text-slate-300 hover:border-white/20 hover:text-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          className="h-10 w-10 rounded-full border border-purple-300/45 bg-gradient-to-br from-[#c084fc] to-[#a855f7] text-xs font-semibold text-white shadow-[0_0_22px_rgba(168,85,247,0.42)]"
          aria-label="User profile"
        >
          AE
        </button>
      </div>
    </header>
  );
}
