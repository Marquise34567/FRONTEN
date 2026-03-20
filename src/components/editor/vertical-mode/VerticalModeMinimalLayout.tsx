import { Clock3, Film, GaugeCircle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { VerticalMinimalSidebar } from "./VerticalMinimalSidebar";
import { VerticalMinimalTopbar } from "./VerticalMinimalTopbar";

type VerticalModeMinimalLayoutProps = {
  statusLabel: string;
  progressPercent: number;
  activeStageLabel: string;
  etaLabel: string;
  clipCounterLabel: string;
  presetLabel: string;
  onOpenExtras: () => void;
  children: ReactNode;
  rightRail?: ReactNode;
};

type QuickStatCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: "primary" | "success" | "muted";
};

function QuickStatCard({ label, value, icon, accent = "primary" }: QuickStatCardProps) {
  return (
    <article className={`vertical-minimal-quick-card is-${accent}`}>
      <div className="vertical-minimal-quick-icon" aria-hidden>
        {icon}
      </div>
      <div>
        <p className="vertical-minimal-quick-label">{label}</p>
        <p className="vertical-minimal-quick-value">{value}</p>
      </div>
    </article>
  );
}

export function VerticalModeMinimalLayout({
  statusLabel,
  progressPercent,
  activeStageLabel,
  etaLabel,
  clipCounterLabel,
  presetLabel,
  onOpenExtras,
  children,
  rightRail,
}: VerticalModeMinimalLayoutProps) {
  const roundedProgress = Number.isFinite(progressPercent)
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : 0;

  return (
    <section className="vertical-minimal-shell">
      <VerticalMinimalSidebar />
      <div className="vertical-minimal-body">
        <VerticalMinimalTopbar
          statusLabel={statusLabel}
          presetLabel={presetLabel}
          clipCounterLabel={clipCounterLabel}
          progressLabel={`${roundedProgress}%`}
          onOpenExtras={onOpenExtras}
        />
        <div className="vertical-minimal-quick-grid">
          <QuickStatCard
            label="Vertical Studio"
            value={statusLabel}
            icon={<Sparkles className="h-4 w-4" />}
            accent="primary"
          />
          <QuickStatCard
            label="Current Stage"
            value={activeStageLabel}
            icon={<Film className="h-4 w-4" />}
            accent="muted"
          />
          <QuickStatCard
            label="Estimated Time"
            value={etaLabel}
            icon={<Clock3 className="h-4 w-4" />}
            accent="muted"
          />
          <QuickStatCard
            label="Render Progress"
            value={`${roundedProgress}%`}
            icon={<GaugeCircle className="h-4 w-4" />}
            accent="success"
          />
        </div>
        <div className="vertical-minimal-layout-grid">
          <div className="vertical-minimal-main">{children}</div>
          {rightRail ? <aside className="vertical-minimal-rail">{rightRail}</aside> : null}
        </div>
      </div>
    </section>
  );
}

