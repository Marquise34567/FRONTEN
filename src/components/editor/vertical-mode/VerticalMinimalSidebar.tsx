import { Captions, Clapperboard, LayoutGrid, Scissors, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type VerticalSidebarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const SIDEBAR_ITEMS: VerticalSidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "clips", label: "Clip Gallery", icon: Clapperboard },
  { id: "render", label: "Render Queue", icon: Scissors },
  { id: "captions", label: "Caption Lab", icon: Captions },
];

type VerticalMinimalSidebarProps = {
  activeId?: string;
};

export function VerticalMinimalSidebar({ activeId = "clips" }: VerticalMinimalSidebarProps) {
  return (
    <aside className="vertical-minimal-sidebar">
      <div className="vertical-minimal-sidebar-brand">
        <span className="vertical-minimal-sidebar-brand-glyph" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="vertical-minimal-sidebar-brand-text">Vertical</span>
      </div>
      <nav className="vertical-minimal-sidebar-nav" aria-label="Vertical mode navigation">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`vertical-minimal-sidebar-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

