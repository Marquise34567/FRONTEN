import type { ReactNode } from "react";

import SidebarNav from "@/components/premium/SidebarNav";
import TopHeader from "@/components/premium/TopHeader";
import { cn } from "@/lib/utils";

type AppShellProps = {
  title?: string;
  children: ReactNode;
  rightRail?: ReactNode;
  showSidebar?: boolean;
  className?: string;
  contentClassName?: string;
};

export default function AppShell({
  title,
  children,
  rightRail,
  showSidebar = false,
  className,
  contentClassName,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-[var(--ae-bg)] text-[var(--ae-text-primary)] transition-colors duration-500", className)}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--ae-bg-overlay)] starfield-bg" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,transparent_28%,transparent_72%,rgba(255,255,255,0.04)_100%)]" />
      {showSidebar ? <SidebarNav /> : null}
      <TopHeader title={title} withSidebar={showSidebar} />

      <main className={cn("px-4 pb-10 pt-8", showSidebar ? "lg:pl-28 lg:pr-6" : "lg:px-6")}>
        <div
          className={cn(
            "grid gap-5",
            rightRail ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1",
            contentClassName,
          )}
        >
          <section>{children}</section>
          {rightRail ? <aside className="space-y-4">{rightRail}</aside> : null}
        </div>
      </main>
    </div>
  );
}
