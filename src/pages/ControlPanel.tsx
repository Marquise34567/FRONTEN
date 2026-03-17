import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Cpu,
  DollarSign,
  Flame,
  Globe2,
  Landmark,
  Layers,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Wrench
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import { useAdminRealtimeStream } from "./control-panel/useAdminRealtimeStream"
import { CommandCenterResponse, EmptyStateNote, chartTick, formatCompactNumber, formatMoney, formatShortTime } from "./control-panel/shared"

type OverviewResponse = {
  summary: {
    activeUsers: number
    jobsInQueue: number
    jobsFailed24h: number
    revenue7d: number
    activeSubscriptions: number
    avgRenderTime: number
    successRate: number
    usersTotal?: number
    websiteImpressions5m?: number
    websiteImpressions24h?: number
  }
  userMilestone?: {
    threshold: number
    rewardMonths: number
    rewardTier: string
    triggeredAt: string | null
    endsAt: string | null
    active: boolean
    activeUsers: number
    progressPct: number
    remaining: number
  }
  graphs?: {
    activeUsers?: Array<{ t: string; v: number }>
  }
  updatedAt: string
}

type LauncherItem = {
  title: string
  path: string
  description: string
  tag: string
  Icon: typeof Sparkles
  accent: string
}

const PAGE_LAUNCHER: LauncherItem[] = [
  {
    title: "Analytics",
    path: "/dev/control-panel/analytics",
    description: "All-time users, account counts, and engagement depth telemetry.",
    tag: "Metrics",
    Icon: BarChart3,
    accent: "from-sky-300/38 via-sky-300/8 to-transparent"
  },
  {
    title: "Emotion Engine",
    path: "/dev/control-panel/emotion",
    description: "Tune emotional pacing and detection thresholds in realtime.",
    tag: "Realtime",
    Icon: Flame,
    accent: "from-fuchsia-300/36 via-fuchsia-300/8 to-transparent"
  },
  {
    title: "Audience Intel",
    path: "/dev/control-panel/audience",
    description: "Track live users, geo concentration, and whale upgrade candidates.",
    tag: "Users",
    Icon: Globe2,
    accent: "from-emerald-300/34 via-emerald-300/8 to-transparent"
  },
  {
    title: "Growth Intel",
    path: "/dev/control-panel/growth",
    description: "Monitor funnel velocity and conversion pressure across product flows.",
    tag: "Funnel",
    Icon: TrendingUp,
    accent: "from-lime-300/34 via-lime-300/8 to-transparent"
  },
  {
    title: "Infrastructure",
    path: "/dev/control-panel/infrastructure",
    description: "Queue pressure, worker health, storage usage, and scaling posture.",
    tag: "Runtime",
    Icon: Cpu,
    accent: "from-indigo-300/34 via-indigo-300/8 to-transparent"
  },
  {
    title: "Security",
    path: "/dev/control-panel/security",
    description: "Threat feed, rate-limit posture, abuse signatures, and bans.",
    tag: "Risk",
    Icon: ShieldAlert,
    accent: "from-amber-300/34 via-amber-300/8 to-transparent"
  },
  {
    title: "Algorithm",
    path: "/dev/control-panel/algorithm",
    description: "Control cut logic, scorecards, and experiment toggles.",
    tag: "Model",
    Icon: Bot,
    accent: "from-violet-300/34 via-violet-300/8 to-transparent"
  },
  {
    title: "The Bank",
    path: "/dev/control-panel/bank",
    description: "Revenue telemetry, payment status, and operational take-out actions.",
    tag: "Finance",
    Icon: Landmark,
    accent: "from-yellow-300/38 via-yellow-300/8 to-transparent"
  },
  {
    title: "Ops Tools",
    path: "/dev/control-panel/ops",
    description: "Weekly reporting, founder tooling, and operator controls.",
    tag: "Operations",
    Icon: Wrench,
    accent: "from-rose-300/34 via-rose-300/8 to-transparent"
  }
]

const ControlPanel = () => {
  const { accessToken } = useAuth()
  const navigate = useNavigate()

  const canLoad = Boolean(accessToken)
  const realtime = useAdminRealtimeStream(accessToken, 4000)
  const live = realtime.payload

  const overviewQuery = useQuery({
    queryKey: ["admin-overview-slim"],
    queryFn: () => apiFetch<OverviewResponse>("/api/admin/overview", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const commandCenterQuery = useQuery({
    queryKey: ["admin-command-center-slim"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 25000
  })

  const summary = overviewQuery.data?.summary
  const streamError = realtime.streamError

  const effectiveActiveUsers = live?.activeUsers ?? summary?.activeUsers ?? 0
  const effectiveQueue = live?.jobsInQueue ?? summary?.jobsInQueue ?? 0
  const effectiveFailed = live?.jobsFailed24h ?? summary?.jobsFailed24h ?? 0
  const effectiveImpressions5m = live?.websiteImpressions5m ?? summary?.websiteImpressions5m ?? 0
  const effectiveImpressions24h = live?.websiteImpressions24h ?? summary?.websiteImpressions24h ?? 0
  const activeUsersSeries = overviewQuery.data?.graphs?.activeUsers || []
  const allTimeUsers = summary?.usersTotal ?? 0
  const milestone = overviewQuery.data?.userMilestone
  const milestoneThreshold = milestone?.threshold ?? 500
  const milestoneProgress = milestone?.progressPct ?? (milestoneThreshold > 0 ? Math.min(100, Math.round((effectiveActiveUsers / milestoneThreshold) * 100)) : 0)
  const milestoneRemaining = milestone?.remaining ?? Math.max(0, milestoneThreshold - effectiveActiveUsers)
  const milestoneActive = milestone?.active ?? false
  const milestoneEndsAt = milestone?.endsAt ? formatShortTime(milestone.endsAt) : null
  const milestoneTriggeredAt = milestone?.triggeredAt ? formatShortTime(milestone.triggeredAt) : null
  const rewardMonths = milestone?.rewardMonths ?? 1
  const rewardTier = milestone?.rewardTier ?? "creator"
  const rewardLabel = `${rewardMonths} month${rewardMonths === 1 ? "" : "s"} ${rewardTier}`
  const activeSeriesValues = activeUsersSeries.map((point) => Math.max(0, Number(point?.v || 0)))
  const activeUsersPeak = activeSeriesValues.length ? Math.max(...activeSeriesValues) : effectiveActiveUsers
  const activeSeriesTail = activeSeriesValues.slice(-2)
  const activeDelta = activeSeriesTail.length === 2 ? activeSeriesTail[1] - activeSeriesTail[0] : 0
  const activeDeltaLabel = activeDelta === 0 ? "flat" : activeDelta > 0 ? `+${activeDelta}` : `${activeDelta}`
  const activeDeltaTone = activeDelta > 0 ? "text-emerald-200" : activeDelta < 0 ? "text-rose-200" : "text-muted-foreground"

  const healthStatus = useMemo(() => {
    const securityScore = commandCenterQuery.data?.securityAbuse?.suspiciousActivityScore ?? 0
    if (effectiveQueue > 35 || securityScore >= 80) {
      return { label: "Watch Closely", tone: "border-amber-300/40 bg-amber-300/16 text-amber-100" }
    }
    if (effectiveFailed > 10) {
      return { label: "Degraded", tone: "border-rose-300/40 bg-rose-300/16 text-rose-100" }
    }
    return { label: "Stable", tone: "border-emerald-300/40 bg-emerald-300/16 text-emerald-100" }
  }, [commandCenterQuery.data?.securityAbuse?.suspiciousActivityScore, effectiveFailed, effectiveQueue])

  const commandSnapshotItems = [
    { label: "Realtime Active Users", value: formatCompactNumber(effectiveActiveUsers), Icon: Users, iconTone: "text-sky-200" },
    { label: "Queue Depth", value: formatCompactNumber(effectiveQueue), Icon: Layers, iconTone: "text-cyan-200" },
    { label: "Failed Jobs (24h)", value: formatCompactNumber(effectiveFailed), Icon: AlertTriangle, iconTone: "text-rose-200" },
    { label: "Revenue (7d)", value: formatMoney(summary?.revenue7d || 0), Icon: DollarSign, iconTone: "text-emerald-200" },
    { label: "Active Subscriptions", value: formatCompactNumber(summary?.activeSubscriptions || 0), Icon: Activity, iconTone: "text-violet-200" },
    { label: "Avg Render Time", value: `${(summary?.avgRenderTime || 0).toFixed(1)}s`, Icon: Timer, iconTone: "text-amber-200" }
  ]

  const pulseItems = [
    { label: "Impressions (5m)", value: formatCompactNumber(effectiveImpressions5m), Icon: Globe2 },
    { label: "Impressions (24h)", value: formatCompactNumber(effectiveImpressions24h), Icon: Globe2 },
    { label: "Connected Clients", value: formatCompactNumber(live?.connectedRealtimeClients || 0), Icon: Activity },
    { label: "Success Rate", value: `${((summary?.successRate || 0) * 100).toFixed(1)}%`, Icon: TrendingUp }
  ]

  const quickActions = PAGE_LAUNCHER.slice(0, 3)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(130%_120%_at_84%_-16%,hsl(202_96%_60%/0.18),transparent_43%),radial-gradient(135%_120%_at_10%_18%,hsl(154_86%_52%/0.12),transparent_43%),linear-gradient(180deg,hsl(223_34%_8%)_0%,hsl(229_37%_4%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[16%] h-80 w-80 rounded-full bg-sky-300/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.34, 0.2] }}
          transition={{ duration: 8.6, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[8%] top-[30%] h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl"
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.16, 0.28, 0.16] }}
          transition={{ duration: 9.2, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Overview"
          subtitle="Landing-style mission control for revenue, growth, reliability, and creator operations."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load control panel overview telemetry." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <Card className="control-panel-feature-card glass-card-hover border-border/60">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill-badge text-[10px]">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Command Snapshot
                </span>
                <Badge className={healthStatus.tone}>{healthStatus.label}</Badge>
              </div>

              <h3 className="mt-3 max-w-3xl text-2xl font-semibold font-display leading-tight text-foreground sm:text-[1.8rem]">
                Run your creator infrastructure with the same high-energy visual language as your landing experience.
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Every major signal is mapped into fast decisions: queue pressure, revenue velocity, conversion momentum,
                and reliability risk.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {commandSnapshotItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * index, duration: 0.24 }}
                    className="rounded-xl border border-border/60 bg-card/48 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <item.Icon className={`h-4 w-4 ${item.iconTone}`} />
                    </div>
                    <p className="text-xl font-semibold text-foreground">{item.value}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {quickActions.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="hero-cta-button hero-cta-secondary inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-foreground"
                  >
                    <item.Icon className="h-4 w-4 text-primary" />
                    {item.title}
                    <ArrowRight className="hero-cta-arrow h-4 w-4" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="control-panel-feature-card glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-emerald-200" />
                Live Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-xl border border-border/55 bg-card/40 p-2">
                Stream:{" "}
                {streamError ? (
                  <span className="text-amber-200">warning</span>
                ) : realtime.connected ? (
                  <span className="text-emerald-200">connected</span>
                ) : (
                  <span className="text-muted-foreground">connecting</span>
                )}
              </p>

              {pulseItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-border/55 bg-card/40 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <item.Icon className="h-3.5 w-3.5 text-primary" />
                    {item.label}
                  </span>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}

              <div className="rounded-xl border border-border/55 bg-card/35 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Overview updated: {formatShortTime(overviewQuery.data?.updatedAt)}</p>
                <p className="text-[11px] text-muted-foreground">Command generated: {formatShortTime(commandCenterQuery.data?.generatedAt)}</p>
              </div>

              {streamError ? <p className="text-[11px] text-amber-200">{streamError}</p> : null}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="control-panel-feature-card glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-sky-200" />
                User Counter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Concurrent (Live)</p>
                  <p className="text-2xl font-semibold text-foreground">{formatCompactNumber(effectiveActiveUsers)}</p>
                  <p className={`text-[11px] ${activeDeltaTone}`}>Momentum {activeDeltaLabel}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">All-Time Users</p>
                  <p className="text-2xl font-semibold text-foreground">{formatCompactNumber(allTimeUsers)}</p>
                  <p className="text-[11px] text-muted-foreground">Total accounts on record</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Peak (24h)</p>
                  <p className="text-2xl font-semibold text-foreground">{formatCompactNumber(activeUsersPeak)}</p>
                  <p className="text-[11px] text-muted-foreground">Highest concurrent in series</p>
                </div>
              </div>

              <div className="h-48 rounded-xl border border-border/55 bg-card/35 p-2">
                {activeUsersSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeUsersSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="v" stroke="hsl(197 92% 58%)" fill="hsl(197 92% 58% / 0.35)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No concurrent user samples yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Last sync: {formatShortTime(overviewQuery.data?.updatedAt)} • Active window: 60s snapshots
              </p>
            </CardContent>
          </Card>

          <Card className="control-panel-feature-card glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-emerald-200" />
                Creator Unlock Milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={milestoneActive ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100" : "border-border/50 bg-card/40 text-muted-foreground"}>
                  {milestoneActive ? "Unlock Live" : milestoneTriggeredAt ? "Unlocked" : "Pending"}
                </Badge>
                {milestoneEndsAt ? (
                  <span className="text-[11px] text-muted-foreground">Ends {milestoneEndsAt}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Target {milestoneThreshold} concurrent</span>
                )}
              </div>

              <div>
                <p className="text-3xl font-semibold text-foreground">
                  {formatCompactNumber(effectiveActiveUsers)} / {formatCompactNumber(milestoneThreshold)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {milestoneActive
                    ? `Reward active since ${milestoneTriggeredAt || "now"}`
                    : `${formatCompactNumber(milestoneRemaining)} users to unlock ${rewardLabel} for everyone`}
                </p>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-sky-300 to-indigo-300 transition-all"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>

              <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-50">
                <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">Reward Payload</p>
                <p className="mt-1 font-semibold">{rewardLabel} access for every account</p>
                <p className="text-[11px] text-emerald-100/80">Auto-applied when concurrent users hit the target.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active Users", value: formatCompactNumber(effectiveActiveUsers), icon: Users, tone: "text-sky-300", note: "Realtime sessions in app" },
            { label: "Queue", value: formatCompactNumber(effectiveQueue), icon: Layers, tone: "text-cyan-300", note: "Jobs waiting to process" },
            { label: "Failures", value: formatCompactNumber(effectiveFailed), icon: AlertTriangle, tone: "text-rose-300", note: "Last 24h failed jobs" },
            { label: "Revenue", value: formatMoney(summary?.revenue7d || 0), icon: DollarSign, tone: "text-emerald-300", note: "Trailing 7-day capture" },
            { label: "Impressions 5m", value: formatCompactNumber(effectiveImpressions5m), icon: Globe2, tone: "text-violet-300", note: "Live traffic pulses" },
            { label: "Impressions 24h", value: formatCompactNumber(effectiveImpressions24h), icon: Globe2, tone: "text-indigo-300", note: "Rolling daily exposure" },
            { label: "Subscriptions", value: formatCompactNumber(summary?.activeSubscriptions || 0), icon: Activity, tone: "text-fuchsia-300", note: "Active paying users" },
            { label: "Avg Render", value: `${(summary?.avgRenderTime || 0).toFixed(1)}s`, icon: Timer, tone: "text-amber-300", note: "Pipeline speed average" }
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.025 * index, duration: 0.24 }}
            >
              <Card className="control-panel-kpi-card glass-card-hover border-border/60">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <span className="control-panel-kpi-icon">
                      <item.icon className={`h-4 w-4 ${item.tone}`} />
                    </span>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">{item.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        <section className="mt-4">
          <Card className="control-panel-feature-card glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Launch A Control Module
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PAGE_LAUNCHER.map((item, index) => (
                <motion.button
                  key={item.path}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index, duration: 0.25 }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => navigate(item.path)}
                  className="control-panel-launcher-card group relative overflow-hidden rounded-2xl border border-border/60 bg-card/46 p-4 text-left transition hover:border-primary/35"
                >
                  <span className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r ${item.accent}`} />
                  <div className="mb-3 flex items-center justify-between">
                    <span className="control-panel-launcher-icon inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/55 bg-card/65">
                      <item.Icon className="h-5 w-5 text-primary" />
                    </span>
                    <Badge className="border-primary/30 bg-primary/12 text-primary">{item.tag}</Badge>
                  </div>
                  <p className="text-base font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open module
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </div>
                </motion.button>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanel
