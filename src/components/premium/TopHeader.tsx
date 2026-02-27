import type { ReactNode } from "react";
import { Bell, Crown, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/components/premium/ThemeSwitcher";
import VIPBadge from "@/components/premium/VIPBadge";

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
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--ae-border)] bg-[color:color-mix(in_srgb,var(--ae-shell)_88%,black_22%)] px-4 backdrop-blur-2xl",
        withSidebar ? "lg:pl-28 lg:pr-6" : "lg:px-6",
        className,
      )}
    >
      <div className="flex min-w-[180px] items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--ae-text-primary)]">
          <span>{title}</span>
          <VIPBadge label="Elite Suite" className="hidden sm:inline-flex" />
          <span className="pill-badge border-purple-300/20 bg-purple-500/12 px-2 py-0.5 text-[10px] sm:hidden">{t("brand.beta")}</span>
        </Link>
      </div>

      <div className="mx-4 hidden min-w-[220px] max-w-[560px] flex-1 items-center rounded-2xl border border-[rgba(212,175,55,0.24)] bg-[linear-gradient(120deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] px-3 py-2.5 lg:flex">
        <Search className="h-4 w-4 text-[var(--gold-accent)]" />
        <input
          type="search"
          placeholder="Search projects, clips, elite insights..."
          className="w-full bg-transparent pl-2 text-sm text-[var(--ae-text-primary)] outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="flex items-center gap-2">
        {rightSlot}
        <ThemeSwitcher />
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(10,10,16,0.75)] text-slate-300 hover:border-[rgba(212,175,55,0.45)] hover:text-[#fff7e5]"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(212,175,55,0.48)] premium-duotone-action text-xs font-semibold text-white"
          aria-label="User profile"
        >
          <Crown className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
