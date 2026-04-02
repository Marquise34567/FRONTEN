import { Captions, Clapperboard, Download, LayoutGrid, Sparkles, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type VerticalSidebarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const SIDEBAR_ITEMS: VerticalSidebarItem[] = [
  { id: "studio", label: "Workspace", icon: LayoutGrid },
  { id: "clips", label: "Moments", icon: Clapperboard },
  { id: "captions", label: "Captions", icon: Captions },
  { id: "export", label: "Exports", icon: Download },
];

type VerticalMinimalSidebarProps = {
  activeId?: string;
  clipCounterLabel?: string;
};

export function VerticalMinimalSidebar({
  activeId = "studio",
  clipCounterLabel = "8 clips",
}: VerticalMinimalSidebarProps) {
  return (
    <aside className="vertical-opus-min-sidebar">
      <div className="vertical-opus-min-sidebar-brand">
        <span className="vertical-opus-min-sidebar-brand-glyph" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="vertical-opus-min-sidebar-brand-copy">
          <span className="vertical-opus-min-sidebar-brand-kicker">AutoEditor</span>
          <span className="vertical-opus-min-sidebar-brand-text">Clip Studio</span>
        </div>
      </div>
      <nav className="vertical-opus-min-sidebar-nav" aria-label="Vertical mode navigation">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`vertical-opus-min-sidebar-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="vertical-opus-min-sidebar-footer">
        <div className="vertical-opus-min-sidebar-footer-icon" aria-hidden>
          <Wand2 className="h-4 w-4" />
        </div>
        <div>
          <p className="vertical-opus-min-sidebar-footer-label">Queue</p>
          <p className="vertical-opus-min-sidebar-footer-value">{clipCounterLabel}</p>
        </div>
      </div>
    </aside>
  );
}
