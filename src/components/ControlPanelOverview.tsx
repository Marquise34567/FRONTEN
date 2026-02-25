import {
  CalendarDays,
  Globe,
  MousePointerClick,
  Eye,
  TrendingUp,
  Trophy,
  Plus,
  Grid2x2,
  LineChart,
  Map,
  Ellipsis,
} from "lucide-react";

type ControlPanelOverviewProps = {
  domain: string;
  periodLabel?: string;
  typeLabel?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  trendPoints: number[];
  usersTracked?: number;
  eventVolume?: number;
  topSelections?: {
    retentionProfiles?: Array<{ name: string; count: number; share?: number }>;
    targetPlatforms?: Array<{ name: string; count: number; share?: number }>;
    captionStyles?: Array<{ name: string; count: number; share?: number }>;
  };
  feedback?: Array<{ name: string; count: number; share?: number }>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));

const formatDecimal = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toFixed(digits) : "0.0";

const buildLinePath = (points: number[]) => {
  if (points.length < 2) return "";
  const max = Math.max(1, ...points);
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 48 - (clamp(value, 0, max) / max) * 42;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const buildAreaPath = (points: number[]) => {
  const line = buildLinePath(points);
  if (!line) return "";
  return `${line} L 100 50 L 0 50 Z`;
};

const buildTickLabels = (length: number) => {
  const safeLength = Math.max(1, length);
  const indices = [0, Math.floor((safeLength - 1) * 0.35), Math.floor((safeLength - 1) * 0.65), safeLength - 1];
  const unique = Array.from(new Set(indices));
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (safeLength - 1));
  return unique.map((index) => {
    const labelDate = new Date(start);
    labelDate.setDate(start.getDate() + index);
    return {
      index,
      label: `${labelDate.getMonth() + 1}/${labelDate.getDate()}`,
    };
  });
};

const metricCards = [
  {
    id: "clicks",
    label: "Clicks",
    colorClass: "text-blue-400",
    borderClass: "border-blue-500/80",
    icon: MousePointerClick,
  },
  {
    id: "impressions",
    label: "Impressions",
    colorClass: "text-fuchsia-400",
    borderClass: "border-white/15",
    icon: Eye,
  },
  {
    id: "ctr",
    label: "CTR",
    colorClass: "text-emerald-400",
    borderClass: "border-white/15",
    icon: TrendingUp,
  },
  {
    id: "position",
    label: "Position",
    colorClass: "text-amber-400",
    borderClass: "border-white/15",
    icon: Trophy,
  },
] as const;

const ControlPanelOverview = ({
  domain,
  periodLabel = "3 Months",
  typeLabel = "Web",
  clicks,
  impressions,
  ctr,
  position,
  trendPoints,
  usersTracked = 0,
  eventVolume = 0,
  topSelections,
  feedback = [],
}: ControlPanelOverviewProps) => {
  const safeTrend = trendPoints.length >= 2 ? trendPoints : [0, 0, 1, 0, 2, 1, 0];
  const linePath = buildLinePath(safeTrend);
  const areaPath = buildAreaPath(safeTrend);
  const tickLabels = buildTickLabels(safeTrend.length);

  const metrics: Record<(typeof metricCards)[number]["id"], string> = {
    clicks: formatCompact(clicks),
    impressions: formatCompact(impressions),
    ctr: `${formatDecimal(ctr)}%`,
    position: formatDecimal(position),
  };
  const topRetention = topSelections?.retentionProfiles ?? [];
  const topPlatforms = topSelections?.targetPlatforms ?? [];
  const topCaptions = topSelections?.captionStyles ?? [];

  return (
    <section className="mb-6 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-2xl font-semibold tracking-tight text-white">Control Panel</p>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/90 text-base font-semibold text-white">
          F
        </div>
      </div>
      <p className="mb-3 text-xs text-white/55">
        Tracking {formatCompact(usersTracked)} users • {formatCompact(eventVolume)} events
      </p>

      <div className="mb-3 flex items-center gap-2 text-xl text-white">
        <span className="truncate">{domain}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 border-y border-white/10 py-3 text-white">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white/90"
        >
          <CalendarDays className="h-4 w-4" />
          <span>Date: {periodLabel}</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white/90"
        >
          <Globe className="h-4 w-4" />
          <span>Type: {typeLabel}</span>
        </button>
      </div>

      <button
        type="button"
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#0a0a0a] px-3 py-2 text-sm text-white/90"
      >
        <Plus className="h-4 w-4" />
        <span>Add Filter</span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className={`rounded-3xl border ${card.borderClass} bg-black/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}
            >
              <Icon className={`mb-5 h-6 w-6 ${card.colorClass}`} />
              <p className="text-5xl font-semibold tracking-tight text-white">{metrics[card.id]}</p>
              <p className="mt-2 text-lg text-white/55">{card.label}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="text-4xl font-semibold tracking-tight text-white">Trend</h3>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-base text-blue-300"
          >
            Clicks
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/35 bg-blue-500/10 px-4 py-2 text-base text-blue-300"
          >
            Daily
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-[#050607] p-2">
          <svg viewBox="0 0 100 54" className="h-56 w-full">
            {[0, 12.5, 25, 37.5, 50].map((y) => (
              <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
            ))}
            {tickLabels.map((tick) => {
              const x = safeTrend.length === 1 ? 0 : (tick.index / (safeTrend.length - 1)) * 100;
              return <line key={`v-${tick.index}`} x1={x} y1="0" x2={x} y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />;
            })}
            {areaPath ? <path d={areaPath} fill="rgba(37, 99, 235, 0.28)" /> : null}
            {linePath ? (
              <path d={linePath} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
          </svg>
          <div className="grid grid-cols-4 text-center text-xs text-white/45">
            {tickLabels.map((tick) => (
              <span key={`label-${tick.index}`}>{tick.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-[#060708] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/55">Most Chosen Edits</p>
          <div className="mt-2 space-y-2 text-sm text-white/90">
            <p>
              Modes: {topRetention.slice(0, 3).map((item) => `${item.name} (${item.count})`).join(" • ") || "No data yet"}
            </p>
            <p>
              Platforms: {topPlatforms.slice(0, 3).map((item) => `${item.name} (${item.count})`).join(" • ") || "No data yet"}
            </p>
            <p>
              Captions: {topCaptions.slice(0, 3).map((item) => `${item.name} (${item.count})`).join(" • ") || "No data yet"}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#060708] p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/55">Feedback Signals</p>
          <p className="mt-2 text-sm text-white/90">
            {feedback.slice(0, 4).map((item) => `${item.name} (${item.count})`).join(" • ") || "No feedback tracked yet"}
          </p>
        </div>
      </div>

      <nav className="mt-6 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-[#060708] px-2 py-3 text-center">
        <button type="button" className="inline-flex flex-col items-center gap-1 text-white/55">
          <Grid2x2 className="h-5 w-5" />
          <span className="text-xs">Overview</span>
        </button>
        <button type="button" className="inline-flex flex-col items-center gap-1 text-blue-400">
          <LineChart className="h-5 w-5" />
          <span className="text-xs">Performance</span>
        </button>
        <button type="button" className="inline-flex flex-col items-center gap-1 text-white/55">
          <Map className="h-5 w-5" />
          <span className="text-xs">Sitemaps</span>
        </button>
        <button type="button" className="inline-flex flex-col items-center gap-1 text-white/55">
          <Ellipsis className="h-5 w-5" />
          <span className="text-xs">More</span>
        </button>
      </nav>
    </section>
  );
};

export default ControlPanelOverview;
