import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Activity, AlertTriangle, ArrowRight, DollarSign, Globe2, Layers, Sparkles, Timer, Users } from "lucide-react"
import { useNavigate } from "react-router-dom"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { API_URL, apiFetch } from "@/lib/api"
import { getControlPanelPassword } from "@/lib/controlPanelAuth"
import { CommandCenterResponse, EmptyStateNote, formatCompactNumber, formatMoney, formatShortTime } from "./control-panel/shared"

type OverviewResponse = {
  summary: {
    activeUsers: number
    jobsInQueue: number
    jobsFailed24h: number
    revenue7d: number
    activeSubscriptions: number
    avgRenderTime: number
    successRate: number
    websiteImpressions5m?: number
    websiteImpressions24h?: number
  }
  updatedAt: string
}

type LiveRealtimePayload = {
  activeUsers: number
  jobsInQueue: number
  jobsFailed24h: number
  websiteImpressions5m?: number
  websiteImpressions24h?: number
  t: string
}

const PAGE_LAUNCHER = [
  {
    title: "Emotion Engine",
    path: "/dev/control-panel/emotion",
    description: "Tune emotional intensity and detection thresholds in realtime.",
    tag: "Realtime"
  },
  {
    title: "Audience Intel",
    path: "/dev/control-panel/audience",
    description: "Live users, geo heatmaps, watch behavior, and whale detection.",
    tag: "Users"
  },
  {
    title: "Growth Intel",
    path: "/dev/control-panel/growth",
    description: "Funnel velocity, onboarding drop-offs, and feature demand signals.",
    tag: "Funnel"
  },
  {
    title: "Infrastructure",
    path: "/dev/control-panel/infrastructure",
    description: "Queue pressure, worker health, storage usage, and scaling controls.",
    tag: "Runtime"
  },
  {
    title: "Security",
    path: "/dev/control-panel/security",
    description: "Threat feed, rate-limit posture, abuse signatures, and bans.",
    tag: "Risk"
  },
  {
    title: "Algorithm",
    path: "/dev/control-panel/algorithm",
    description: "Core cut logic controls, scorecards, and experiment controls.",
    tag: "Model"
  },
  {
    title: "The Bank",
    path: "/dev/control-panel/bank",
    description: "Revenue telemetry, payment status, and take-out operations.",
    tag: "Finance"
  },
  {
    title: "Ops Tools",
    path: "/dev/control-panel/ops",
    description: "Weekly reports, founder tooling, and admin operation actions.",
    tag: "Operations"
  }
] as const

const ControlPanel = () => {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const [live, setLive] = useState<LiveRealtimePayload | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)

  const canLoad = Boolean(accessToken)

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

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const streamPath = `/api/admin/stream?token=${encodeURIComponent(accessToken)}&password=${encodeURIComponent(getControlPanelPassword())}`
    const source = new EventSource(`${API_URL || ""}${streamPath}`)

    source.addEventListener("realtime", (event) => {
      if (cancelled) return
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}") as LiveRealtimePayload
        setLive(payload)
        setStreamError(null)
      } catch {
        // ignore malformed realtime payloads
      }
    })

    source.addEventListener("stream_warning", (event) => {
      if (cancelled) return
      try {
        const payload = JSON.parse((event as MessageEvent).data || "{}") as { message?: string }
        setStreamError(payload?.message || "Live stream warning")
      } catch {
        setStreamError("Live stream warning")
      }
    })

    source.onerror = () => {
      if (cancelled) return
      setStreamError("Live stream disconnected. Retrying automatically...")
    }

    return () => {
      cancelled = true
      source.close()
    }
  }, [accessToken])

  const summary = overviewQuery.data?.summary

  const effectiveActiveUsers = live?.activeUsers ?? summary?.activeUsers ?? 0
  const effectiveQueue = live?.jobsInQueue ?? summary?.jobsInQueue ?? 0
  const effectiveFailed = live?.jobsFailed24h ?? summary?.jobsFailed24h ?? 0
  const effectiveImpressions5m = live?.websiteImpressions5m ?? summary?.websiteImpressions5m ?? 0
  const effectiveImpressions24h = live?.websiteImpressions24h ?? summary?.websiteImpressions24h ?? 0

  const healthStatus = useMemo(() => {
    const securityScore = commandCenterQuery.data?.securityAbuse?.suspiciousActivityScore ?? 0
    const queue = effectiveQueue
    if (queue > 35 || securityScore >= 80) return { label: "Watch Closely", className: "border-amber-400/40 bg-amber-500/10 text-amber-100" }
    if (effectiveFailed > 10) return { label: "Degraded", className: "border-rose-400/40 bg-rose-500/10 text-rose-100" }
    return { label: "Stable", className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" }
  }, [commandCenterQuery.data?.securityAbuse?.suspiciousActivityScore, effectiveFailed, effectiveQueue])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(125%_110%_at_84%_-14%,hsl(204_95%_58%/0.18),transparent_42%),radial-gradient(130%_120%_at_18%_16%,hsl(161_82%_50%/0.14),transparent_44%),linear-gradient(180deg,hsl(221_35%_9%)_0%,hsl(228_38%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[10%] top-[32%] h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
          animate={{ scale: [1.06, 1, 1.06], opacity: [0.18, 0.3, 0.18] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
      </div>

      <main className="control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Overview"
          subtitle="High-level command snapshot. Deep metrics were moved to dedicated pages."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load control panel overview telemetry." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-sky-200" />
                Command Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Realtime Active Users</p>
                <p className="text-2xl font-semibold">{formatCompactNumber(effectiveActiveUsers)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Queue Depth</p>
                <p className="text-2xl font-semibold">{formatCompactNumber(effectiveQueue)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Failed Jobs (24h)</p>
                <p className="text-2xl font-semibold">{formatCompactNumber(effectiveFailed)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Revenue (7d)</p>
                <p className="text-2xl font-semibold">{formatMoney(summary?.revenue7d || 0)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Active Subs</p>
                <p className="text-2xl font-semibold">{formatCompactNumber(summary?.activeSubscriptions || 0)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Avg Render Time</p>
                <p className="text-2xl font-semibold">{(summary?.avgRenderTime || 0).toFixed(1)}s</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-emerald-200" />
                Live Pulse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Badge className={healthStatus.className}>{healthStatus.label}</Badge>
              <p className="rounded-md border border-border/50 bg-card/40 p-2">
                Stream: {streamError ? <span className="text-amber-200">warning</span> : <span className="text-emerald-200">connected</span>}
              </p>
              <p className="rounded-md border border-border/50 bg-card/40 p-2">Impressions (5m): {formatCompactNumber(effectiveImpressions5m)}</p>
              <p className="rounded-md border border-border/50 bg-card/40 p-2">Impressions (24h): {formatCompactNumber(effectiveImpressions24h)}</p>
              <p className="rounded-md border border-border/50 bg-card/40 p-2">Success rate: {((summary?.successRate || 0) * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground">Overview updated: {formatShortTime(overviewQuery.data?.updatedAt)}</p>
              <p className="text-[11px] text-muted-foreground">Command generated: {formatShortTime(commandCenterQuery.data?.generatedAt)}</p>
              {streamError ? <p className="text-amber-200">{streamError}</p> : null}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active Users", value: formatCompactNumber(effectiveActiveUsers), icon: Users, color: "text-sky-300" },
            { label: "Queue", value: formatCompactNumber(effectiveQueue), icon: Layers, color: "text-cyan-300" },
            { label: "Failures", value: formatCompactNumber(effectiveFailed), icon: AlertTriangle, color: "text-rose-300" },
            { label: "Revenue", value: formatMoney(summary?.revenue7d || 0), icon: DollarSign, color: "text-emerald-300" },
            { label: "Impressions 5m", value: formatCompactNumber(effectiveImpressions5m), icon: Globe2, color: "text-violet-300" },
            { label: "Impressions 24h", value: formatCompactNumber(effectiveImpressions24h), icon: Globe2, color: "text-indigo-300" },
            { label: "Subs", value: formatCompactNumber(summary?.activeSubscriptions || 0), icon: Activity, color: "text-fuchsia-300" },
            { label: "Avg Render", value: `${(summary?.avgRenderTime || 0).toFixed(1)}s`, icon: Timer, color: "text-amber-300" }
          ].map((item) => (
            <Card key={item.label} className="glass-card border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{item.value}</p>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-4">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Page Launcher</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {PAGE_LAUNCHER.map((item, index) => (
                <motion.button
                  key={item.path}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index, duration: 0.24 }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => navigate(item.path)}
                  className="rounded-xl border border-border/60 bg-card/45 p-3 text-left transition hover:border-primary/40"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <Badge className="border-primary/30 bg-primary/10 text-primary">{item.tag}</Badge>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">{item.description}</p>
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
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
