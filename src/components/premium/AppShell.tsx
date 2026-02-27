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
    <div className={cn("min-h-screen bg-[#030309] text-slate-100", className)}>
      {showSidebar ? <SidebarNav /> : null}
      <TopHeader title={title} withSidebar={showSidebar} />

      <main className={cn("px-4 pb-8 pt-6", showSidebar ? "lg:pl-28 lg:pr-6" : "lg:px-6")}>
        <div
          className={cn(
            "grid gap-4",
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
