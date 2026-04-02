import { Captions, Clock3, Film, Sparkles, Zap } from "lucide-react";
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
  accelerationLabel: string;
  captionLabel: string;
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
    <article className={`vertical-opus-min-stat-card is-${accent}`}>
      <div className="vertical-opus-min-stat-icon" aria-hidden>
        {icon}
      </div>
      <div>
        <p className="vertical-opus-min-stat-label">{label}</p>
        <p className="vertical-opus-min-stat-value">{value}</p>
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
  accelerationLabel,
  captionLabel,
  onOpenExtras,
  children,
  rightRail,
}: VerticalModeMinimalLayoutProps) {
  const roundedProgress = Number.isFinite(progressPercent)
    ? Math.max(0, Math.min(100, Math.round(progressPercent)))
    : 0;

  return (
    <section className="vertical-opus-min-shell">
      <VerticalMinimalSidebar clipCounterLabel={clipCounterLabel} />
      <div className="vertical-opus-min-body">
        <VerticalMinimalTopbar
          statusLabel={statusLabel}
          presetLabel={presetLabel}
          clipCounterLabel={clipCounterLabel}
          progressLabel={`${roundedProgress}%`}
          accelerationLabel={accelerationLabel}
          onOpenExtras={onOpenExtras}
        />
        <section className="vertical-opus-min-hero">
          <div className="vertical-opus-min-hero-copy">
            <p className="vertical-opus-min-kicker">Minimal Vertical Editor</p>
            <h1 className="vertical-opus-min-title">Best moments in, ready-to-post clips out.</h1>
            <p className="vertical-opus-min-description">
              OpusClip-style flow: rank highest-retention moments, auto-compose 9:16, and publish fast.
            </p>
            <div className="vertical-opus-min-tag-row">
              <span className="vertical-opus-min-tag">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {statusLabel}
              </span>
              <span className="vertical-opus-min-tag">
                <Film className="h-3.5 w-3.5" aria-hidden />
                {activeStageLabel}
              </span>
              <span className="vertical-opus-min-tag">
                <Captions className="h-3.5 w-3.5" aria-hidden />
                {captionLabel}
              </span>
            </div>
          </div>
          <div className="vertical-opus-min-progress-card">
            <div className="vertical-opus-min-progress-head">
              <div>
                <p>Retention Engine</p>
                <strong>{accelerationLabel}</strong>
              </div>
              <span>{roundedProgress}%</span>
            </div>
            <div className="vertical-opus-min-progress-body">
              <div className="vertical-opus-min-progress-track" aria-hidden>
                <span style={{ width: `${roundedProgress}%` }} />
              </div>
              <div className="vertical-opus-min-progress-meta">
                <span>{activeStageLabel}</span>
                <strong>{etaLabel}</strong>
              </div>
            </div>
            <div className="vertical-opus-min-metric-grid">
              <article className="vertical-opus-min-metric-card">
                <span>Preset</span>
                <strong>{presetLabel}</strong>
              </article>
              <article className="vertical-opus-min-metric-card">
                <span>Clips</span>
                <strong>{clipCounterLabel}</strong>
              </article>
              <article className="vertical-opus-min-metric-card">
                <span>Captions</span>
                <strong>{captionLabel}</strong>
              </article>
              <article className="vertical-opus-min-metric-card">
                <span>ETA</span>
                <strong>{etaLabel}</strong>
              </article>
            </div>
          </div>
        </section>
        <div className="vertical-opus-min-stat-grid">
          <QuickStatCard
            label="Selection"
            value="Best moments only"
            icon={<Film className="h-4 w-4" />}
            accent="primary"
          />
          <QuickStatCard
            label="Webcam"
            value="Top strip locked"
            icon={<Zap className="h-4 w-4" />}
            accent="success"
          />
          <QuickStatCard
            label="Animated Text"
            value={captionLabel}
            icon={<Captions className="h-4 w-4" />}
            accent="success"
          />
          <QuickStatCard
            label="ETA"
            value={etaLabel}
            icon={<Clock3 className="h-4 w-4" />}
            accent="muted"
          />
        </div>
        <div className="vertical-opus-min-layout-grid">
          <div className="vertical-opus-min-main">{children}</div>
          {rightRail ? <aside className="vertical-opus-min-rail">{rightRail}</aside> : null}
        </div>
      </div>
    </section>
  );
}
