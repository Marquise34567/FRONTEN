import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Crown,
  Flame,
  Lock,
  RefreshCcw,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "@/components/Navbar";
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav";
import { useLiveStats } from "@/providers/LiveStatsProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DrillMetricKey =
  | "activeUsers"
  | "rendersToday"
  | "trendingNiches"
  | "subscription"
  | "serverLoad"
  | "recentJobs";

const PIE_COLORS = ["#2AD07B", "#6BE9A4", "#53D8E5", "#2EA2F4", "#F9C461"];
const CHART_GRID_COLOR = "rgba(125, 148, 139, 0.2)";
const CHART_AXIS_COLOR = "#9EB7AC";
const CHART_TOOLTIP_STYLE = {
  background: "#081119",
  border: "1px solid rgba(110, 231, 183, 0.35)",
  borderRadius: "0.75rem",
};
const CHART_LINE_COLOR = "#4AE59D";
const CHART_BAR_COLOR = "#2EC97A";

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0
  );

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );

const pct = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

const timeTick = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

const statusTone = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "text-emerald-300";
  if (normalized === "failed") return "text-rose-300";
  if (normalized === "rendering" || normalized === "queued") return "text-amber-300";
  return "text-sky-300";
};

const LockedOverlay = ({ onUpgrade }: { onUpgrade: () => void }) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl border border-emerald-200/25 bg-[#060d15]/78 p-4 backdrop-blur-md">
    <div className="max-w-xs text-center">
      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-200/40 bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-50">
        <Lock className="h-3.5 w-3.5" />
        Premium Insight
      </div>
      <p className="mb-3 text-sm text-slate-100">Upgrade for Real-Time Insights, deep drill-downs, and full metric history.</p>
      <Button size="sm" onClick={onUpgrade}>
        Upgrade
      </Button>
    </div>
  </div>
);

const GatedCard = ({
  locked,
  onUpgrade,
  children,
  className,
}: {
  locked: boolean;
  onUpgrade: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("relative", className)}>
    <div className={cn(locked ? "select-none blur-[2px] saturate-50" : "")}>{children}</div>
    {locked ? <LockedOverlay onUpgrade={onUpgrade} /> : null}
  </div>
);

const ControlPanel = () => {
  const navigate = useNavigate();
  const {
    snapshot,
    pulse,
    access,
    teaserLocked,
    teaserMessage,
    connected,
    transport,
    transportPreference,
    canControlTransport,
    setTransportPreference,
    lastUpdated,
    refresh,
    loading,
  } = useLiveStats();
  const [drillMetric, setDrillMetric] = useState<DrillMetricKey | null>(null);
  const [showRecentJobs, setShowRecentJobs] = useState(false);

  const lockedAdvanced = Boolean(teaserLocked && !access?.isDev);

  const activeUsers = pulse?.activeUsers ?? snapshot?.activeUsers ?? 0;
  const rendersToday = pulse?.rendersToday ?? snapshot?.rendersToday?.count ?? 0;
  const renderMinutes = snapshot?.rendersToday?.minutesUsed ?? 0;
  const upgradedToday = pulse?.upgradedToday ?? snapshot?.upgradeSignals?.upgradedToday ?? 0;
  const totalSubs = snapshot?.subscriptionMetrics?.totalSubs ?? 0;
  const mrr = snapshot?.subscriptionMetrics?.mrr ?? 0;
  const churn = snapshot?.subscriptionMetrics?.churnRatePct ?? 0;
  const cpu = pulse?.cpuPct ?? snapshot?.serverLoad?.cpuPct ?? 0;
  const ram = pulse?.ramPct ?? snapshot?.serverLoad?.ramPct ?? 0;
  const serverGauge = Math.max(0, Math.min(100, (cpu + ram) / 2));

  const tierBars = snapshot?.rendersToday?.byTier || [];
  const subsPie = snapshot?.subscriptionMetrics?.byTier || [];
  const trending = snapshot?.trendingNiches || [];
  const jobs = snapshot?.recentJobs || [];
  const activeSeries = snapshot?.activeUsersSeries || [];

  const topTrend = trending[0];
  const liveStatusLabel = connected ? `LIVE ${transport.toUpperCase()}` : "RECONNECTING";
  const lastSyncLabel = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--";
  const transportOptions = [
    { value: "auto", label: "Auto" },
    { value: "websocket", label: "WebSocket" },
    { value: "sse", label: "SSE" },
    { value: "polling", label: "Polling" },
  ] as const;

  const metricCards = useMemo(
    () => [
      {
        key: "activeUsers" as const,
        icon: Users,
        title: "Active Users",
        value: compact(activeUsers),
        sub: `${compact(upgradedToday)} upgrades today`,
        tone: "from-emerald-400/25 to-teal-300/5",
        tip: "Real-time active users from websocket + SSE fallback.",
        progress: Math.min(100, (activeUsers / 800) * 100),
      },
      {
        key: "rendersToday" as const,
        icon: BarChart3,
        title: "Renders Today",
        value: compact(rendersToday),
        sub: `${renderMinutes.toFixed(1)} mins used`,
        tone: "from-cyan-400/25 to-blue-300/5",
        tip: "Completed renders and consumed minutes for today.",
        progress: Math.min(100, (rendersToday / 450) * 100),
      },
      {
        key: "trendingNiches" as const,
        icon: Flame,
        title: "Trending Niches",
        value: topTrend ? topTrend.label : "No trend yet",
        sub: topTrend ? `${topTrend.changePct > 0 ? "+" : ""}${topTrend.changePct.toFixed(1)}% shift` : "Collecting signal",
        tone: "from-amber-300/25 to-orange-300/5",
        tip: "Top moving content niches from recent render behavior.",
        progress: topTrend ? Math.min(100, Math.abs(topTrend.changePct)) : 0,
      },
      {
        key: "subscription" as const,
        icon: Crown,
        title: "Subscription Metrics",
        value: compact(totalSubs),
        sub: `${money(mrr)} MRR • ${pct(churn)} churn`,
        tone: "from-lime-400/25 to-emerald-300/5",
        tip: "Total subscriptions, churn rate, and monthly recurring revenue.",
        progress: Math.min(100, (totalSubs / 1000) * 100),
      },
      {
        key: "serverLoad" as const,
        icon: Server,
        title: "Server Load",
        value: `${serverGauge.toFixed(0)}%`,
        sub: `CPU ${pct(cpu)} • RAM ${pct(ram)}`,
        tone: "from-sky-400/25 to-cyan-300/5",
        tip: "Runtime pressure from CPU and memory utilization.",
        progress: serverGauge,
      },
      {
        key: "recentJobs" as const,
        icon: Activity,
        title: "Recent Jobs",
        value: showRecentJobs ? compact(jobs.length) : "Hidden",
        sub: showRecentJobs ? (jobs[0] ? `Latest: ${jobs[0].status}` : "No recent jobs") : "Toggle Jobs to reveal",
        tone: "from-slate-300/20 to-slate-100/5",
        tip: showRecentJobs ? "Latest render jobs with status and duration." : "Jobs telemetry is hidden by default.",
        progress: showRecentJobs ? Math.min(100, (jobs.length / 12) * 100) : 0,
      },
    ],
    [
      activeUsers,
      churn,
      cpu,
      jobs,
      mrr,
      ram,
      renderMinutes,
      rendersToday,
      serverGauge,
      showRecentJobs,
      topTrend,
      totalSubs,
      upgradedToday,
    ]
  );

  const drillTitle = {
    activeUsers: "Active Users Drill-Down",
    rendersToday: "Renders Today Drill-Down",
    trendingNiches: "Trending Niches Drill-Down",
    subscription: "Subscription Metrics Drill-Down",
    serverLoad: "Server Load Drill-Down",
    recentJobs: "Recent Jobs Drill-Down",
  }[drillMetric || "activeUsers"];

  const renderDrillDownContent = () => {
    if (!drillMetric) return null;
    if (drillMetric === "activeUsers") {
      return (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="t" tickFormatter={timeTick} stroke={CHART_AXIS_COLOR} />
              <YAxis stroke={CHART_AXIS_COLOR} />
              <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Line dataKey="v" stroke={CHART_LINE_COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (drillMetric === "rendersToday") {
      return (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tierBars}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="tier" stroke={CHART_AXIS_COLOR} />
              <YAxis stroke={CHART_AXIS_COLOR} />
              <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="renders" fill={CHART_BAR_COLOR} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (drillMetric === "trendingNiches") {
      return (
        <div className="space-y-2">
          {trending.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-700/70 bg-slate-900/45 px-3 py-2 text-sm">
              <span>{item.label}</span>
              <span className={item.direction === "up" ? "text-emerald-300" : "text-rose-300"}>
                {item.changePct > 0 ? "+" : ""}
                {item.changePct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (drillMetric === "subscription") {
      return (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={subsPie} dataKey="count" nameKey="tier" innerRadius={66} outerRadius={94}>
                {subsPie.map((row, index) => (
                  <Cell key={`${row.tier}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (drillMetric === "serverLoad") {
      return (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-slate-400">CPU</p>
            <Progress value={cpu} className="h-2 bg-slate-800" />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">RAM</p>
            <Progress value={ram} className="h-2 bg-slate-800" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">RSS {snapshot?.serverLoad?.rssMb ?? 0} MB</div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">Heap {snapshot?.serverLoad?.heapUsedMb ?? 0} MB</div>
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">Total {snapshot?.serverLoad?.heapTotalMb ?? 0} MB</div>
          </div>
        </div>
      );
    }
    if (!showRecentJobs) {
      return (
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-4 text-sm text-slate-200">
          <p className="font-semibold text-slate-100">Recent jobs are hidden by default.</p>
          <p className="mt-1 text-xs text-slate-400">Enable the Jobs toggle to reveal live job telemetry.</p>
          <Button
            type="button"
            size="sm"
            className="mt-3 border border-emerald-200/30 bg-emerald-400/16 text-emerald-50 hover:bg-emerald-400/24"
            onClick={() => setShowRecentJobs(true)}
          >
            Show Recent Jobs
          </Button>
        </div>
      );
    }
    return (
      <div className="max-h-80 overflow-auto rounded-lg border border-slate-700/70 bg-slate-900/45">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
                <TableCell>{job.user}</TableCell>
                <TableCell className={statusTone(job.status)}>{job.status}</TableCell>
                <TableCell>{job.durationSec.toFixed(1)}s</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="control-panel-viewport relative min-h-screen overflow-hidden text-foreground">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[10%] h-80 w-80 rounded-full bg-emerald-400/16 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.36, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[10%] top-[25%] h-72 w-72 rounded-full bg-cyan-300/12 blur-3xl"
          animate={{ scale: [1.08, 1, 1.08], opacity: [0.16, 0.3, 0.16] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
      </div>

      <main className="control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Real-Time Control Panel"
          subtitle="Live operational intelligence across users, renders, subscriptions, and infrastructure."
        />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border px-3 py-1 text-xs", connected ? "border-emerald-200/45 bg-emerald-400/15 text-emerald-50" : "border-amber-200/40 bg-amber-400/15 text-amber-50")}>
                {liveStatusLabel}
              </Badge>
              <Badge className="border-cyan-200/35 bg-cyan-300/12 px-3 py-1 text-cyan-50">Synced {lastSyncLabel}</Badge>
              {access?.isDev ? <Badge className="border-teal-200/35 bg-teal-300/12 px-3 py-1 text-teal-50">DEV UNLOCK</Badge> : null}
              <div
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1",
                  showRecentJobs
                    ? "border-emerald-200/45 bg-emerald-400/15 text-emerald-50"
                    : "border-slate-200/20 bg-slate-200/10 text-slate-100",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Jobs</span>
                <Switch
                  checked={showRecentJobs}
                  onCheckedChange={setShowRecentJobs}
                  aria-label={showRecentJobs ? "Hide recent jobs" : "Show recent jobs"}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => refresh()}
                loadingText="Syncing"
                successToast="Live stats refreshed"
                errorToast="Refresh failed"
                className="border border-emerald-200/30 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/24"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </motion.section>

        {lockedAdvanced ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.04 }}
            className="mt-4 rounded-2xl border border-emerald-200/30 bg-emerald-400/12 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-50">{teaserMessage || "Premium analytics locked on Free."}</p>
                <p className="text-xs text-emerald-50/85">Unlock subscription intelligence, server diagnostics, and unblurred job telemetry.</p>
              </div>
              <Button onClick={() => navigate("/pricing")} className="sm:w-auto">
                Upgrade for Real-Time Insights
              </Button>
            </div>
          </motion.section>
        ) : null}

        <section className="mt-4 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((card, index) => (
            <motion.button
              key={card.key}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02 * index, duration: 0.24 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setDrillMetric(card.key)}
              className="self-start text-left"
            >
              <Card className={cn("glass-card border-border/50 bg-gradient-to-br", card.tone)}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <card.icon className="h-4 w-4 text-emerald-200" />
                      {card.title}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs border-emerald-200/30 bg-[#0b151f] text-slate-100">{card.tip}</TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold text-slate-100">{card.value}</p>
                  <p className="text-xs text-slate-300">{card.sub}</p>
                  <Progress value={card.progress} className="h-1.5 bg-slate-800" />
                </CardContent>
              </Card>
            </motion.button>
          ))}
        </section>

        <section className="control-panel-chart-swipe mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-12">
          <Card className="glass-card min-w-[86vw] snap-start border-border/50 md:min-w-0 xl:col-span-7">
            <CardHeader>
              <CardTitle className="text-sm">Active Users (Last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="t" tickFormatter={timeTick} stroke={CHART_AXIS_COLOR} />
                  <YAxis stroke={CHART_AXIS_COLOR} />
                  <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Line dataKey="v" stroke={CHART_LINE_COLOR} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card min-w-[86vw] snap-start border-border/50 md:min-w-0 xl:col-span-5">
            <CardHeader>
              <CardTitle className="text-sm">Renders by Tier</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="tier" stroke={CHART_AXIS_COLOR} />
                  <YAxis stroke={CHART_AXIS_COLOR} />
                  <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="renders" fill={CHART_BAR_COLOR} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Trending Niches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {trending.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setDrillMetric("trendingNiches")}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-600/60 bg-slate-900/45 px-3 py-2 text-sm transition hover:border-emerald-200/35"
                >
                  <span className="text-left text-slate-100">{item.label}</span>
                  <span className={cn("inline-flex items-center gap-1 font-semibold", item.direction === "up" ? "text-emerald-300" : "text-rose-300")}>
                    {item.direction === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {item.changePct > 0 ? "+" : ""}
                    {item.changePct.toFixed(1)}%
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <GatedCard locked={lockedAdvanced} onUpgrade={() => navigate("/pricing")}>
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-sm">Subscription Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">
                    <p className="text-slate-400">Subs</p>
                    <p className="text-base font-semibold">{compact(totalSubs)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">
                    <p className="text-slate-400">Churn</p>
                    <p className="text-base font-semibold">{pct(churn)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/45 p-2">
                    <p className="text-slate-400">MRR</p>
                    <p className="text-base font-semibold">{money(mrr)}</p>
                  </div>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subsPie} dataKey="count" nameKey="tier" innerRadius={46} outerRadius={66}>
                        {subsPie.map((row, index) => (
                          <Cell key={`${row.tier}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </GatedCard>

          <GatedCard locked={lockedAdvanced} onUpgrade={() => navigate("/pricing")}>
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-sm">Server Load</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="mx-auto h-40 w-40 rounded-full p-3" style={{ background: `conic-gradient(#2ec97a 0% ${serverGauge}%, #1a2434 ${serverGauge}% 100%)` }}>
                  <div className="flex h-full w-full items-center justify-center rounded-full border border-slate-700/70 bg-[#101225] text-xl font-semibold text-slate-100">
                    {serverGauge.toFixed(0)}%
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="mb-1 text-xs text-slate-400">CPU</p>
                    <Progress value={cpu} className="h-1.5 bg-slate-800" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-400">RAM</p>
                    <Progress value={ram} className="h-1.5 bg-slate-800" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </GatedCard>
        </section>

        <section className="mt-4">
          <GatedCard locked={lockedAdvanced} onUpgrade={() => navigate("/pricing")}>
            {showRecentJobs ? (
              <Card className="glass-card border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Recent Jobs</CardTitle>
                  <Badge className="border-emerald-200/35 bg-emerald-400/14 text-emerald-50">{loading ? "Syncing..." : "Live table"}</Badge>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id} className="cursor-pointer" onClick={() => navigate(`/app/job/${job.id}`)}>
                          <TableCell className="font-mono text-xs">{job.id.slice(0, 10)}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{job.user}</TableCell>
                          <TableCell className={statusTone(job.status)}>{job.status}</TableCell>
                          <TableCell>{job.durationSec.toFixed(1)}s</TableCell>
                          <TableCell>{new Date(job.createdAt).toLocaleTimeString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Recent Jobs</CardTitle>
                  <Badge className="border-slate-200/20 bg-slate-200/10 text-slate-200">Hidden by default</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-300">Jobs are hidden until you turn on the Jobs toggle above.</p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-fit border border-emerald-200/30 bg-emerald-400/16 text-emerald-50 hover:bg-emerald-400/24"
                    onClick={() => setShowRecentJobs(true)}
                  >
                    Show Recent Jobs
                  </Button>
                </CardContent>
              </Card>
            )}
          </GatedCard>
        </section>

        {access?.isDev ? (
          <section className="mt-4 grid items-start gap-4 md:grid-cols-3">
            <Card className="glass-card border-emerald-200/35 bg-emerald-400/12">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.2em] text-emerald-50">Debug</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-emerald-50">
                <p>WS clients: {snapshot?.debug?.wsClients ?? 0}</p>
                <p>DB telemetry: {snapshot?.debug?.dbOk ? "ok" : "fallback"}</p>
                <p>Transport: {transport}</p>
                <p>Mode: {transportPreference}</p>
                {canControlTransport ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {transportOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={transportPreference === option.value ? "secondary" : "ghost"}
                        className={cn(
                          "h-7 px-2 text-[10px]",
                          transportPreference === option.value
                            ? "border border-emerald-200/55 bg-emerald-400/25 text-emerald-50"
                            : "border border-emerald-200/30 text-emerald-100 hover:bg-emerald-400/14"
                        )}
                        onClick={() => setTransportPreference(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            <Card className="glass-card border-cyan-200/30 bg-cyan-300/12">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.2em] text-cyan-50">Runtime</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-cyan-50">
                <p>CPU: {pct(cpu)}</p>
                <p>RAM: {pct(ram)}</p>
                <p>Last sync: {lastSyncLabel}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-amber-200/35 bg-amber-300/12">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-[0.2em] text-amber-50">Business</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-amber-50">
                <p>MRR: {money(mrr)}</p>
                <p>Churn: {pct(churn)}</p>
                <p>Upgrades today: {compact(upgradedToday)}</p>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </main>

      <Dialog open={Boolean(drillMetric)} onOpenChange={(open) => setDrillMetric(open ? drillMetric : null)}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100vw-1rem)] overflow-auto border border-emerald-200/30 bg-[#081019]/95 p-4 text-slate-100 backdrop-blur-xl sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{drillTitle}</DialogTitle>
            <DialogDescription className="text-slate-300">
              Click-through metric analytics with live updates from websocket/SSE feeds.
            </DialogDescription>
          </DialogHeader>
          {renderDrillDownContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ControlPanel;
