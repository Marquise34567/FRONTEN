import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bot,
  Clock3,
  Crown,
  DollarSign,
  Gauge,
  PlaySquare,
  RefreshCw,
  Rocket,
  Server,
  ShieldAlert,
  Sparkles,
  Users
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import LiveUsersGlobe from "@/components/control-panel/LiveUsersGlobe"
import { API_URL, apiFetch } from "@/lib/api"
import { getControlPanelPassword } from "@/lib/controlPanelAuth"
import { useAuth } from "@/providers/AuthProvider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  chartTick,
  CommandCenterResponse,
  controlPanelLiveQueryOptions,
  EmptyStateNote,
  formatCompactNumber,
  formatMoney,
  formatShortTime,
  HealthStatusResponse,
  LiveGeoResponse,
  SiteLiveResponse
} from "./control-panel/shared"

type PaymentsResponse = {
  revenueTotal: number
  recentPayments: Array<{
    eventId: string
    amount: number
    currency: string
    status: string
    createdAt: string
    userId?: string | null
  }>
  refundsOrChargebacks: Array<{
    eventId: string
    amount: number
    currency: string
    status: string
    createdAt: string
  }>
  revenueByDay: Array<{ t: string; v: number }>
}

type FeedbackResponse = {
  total: number
  sentimentCounts?: Record<string, number>
  topIssues: Array<{ issue: string; count: number }>
  items: Array<{
    id: string
    category: string
    sentiment: "positive" | "negative" | "bug" | "request"
    source: string
    note: string | null
    createdAt: string
    jobId: string | null
  }>
  updatedAt: string
}

type ErrorItem = {
  id: string
  severity: string
  message: string
  endpoint: string | null
  route: string | null
  count: number
  lastSeen: string
}

type ErrorsResponse = {
  total: number
  items: ErrorItem[]
}

type RealtimeUsersResponse = {
  activeUsers: number
  sessions: Array<{
    sessionId: string
    userId: string
    email: string | null
    connectedAt: string
    lastSeen: string
    ip: string | null
  }>
  updatedAt: string
}

type SubscriptionsResponse = {
  distribution: {
    free: number
    starter: number
    pro: number
    founder: number
  }
  activeSubscriptions: number
  churnCount: number
  trend: Array<{ t: string; v: number }>
}

type IpBansResponse = {
  items: Array<{
    ip: string
    reason: string | null
    createdBy: string | null
    active: boolean
    expiresAt: string | null
    createdAt: string | null
  }>
  updatedAt: string
}

type AutomationPromptsResponse = {
  items: Array<{
    id: string
    title: string
    promptPreview: string
    targetPath: string | null
    inboxPath: string
    createdAt: string
    createdBy: string | null
  }>
  updatedAt: string
}

type StreamRealtimeEvent = {
  activeUsers: number
  jobsInQueue: number
  jobsFailed24h: number
  websiteImpressions5m: number
  websiteImpressions24h: number
  t: string
}

type StreamErrorEvent = {
  id: string
  severity: string
  message: string
  endpoint: string | null
  route: string | null
  count: number
  lastSeen: string
}

type RestartResponse = {
  ok: boolean
  requested: boolean
  executed: boolean
  requestedAt: string
  message: string
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const shortDate = (iso?: string | null) => {
  if (!iso) return "--"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "--"
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const statusTone = (severity: string) => {
  const normalized = String(severity || "").toLowerCase()
  if (normalized === "critical" || normalized === "high") return "text-rose-200 border-rose-400/30 bg-rose-500/10"
  if (normalized === "medium") return "text-amber-200 border-amber-400/30 bg-amber-500/10"
  return "text-sky-100 border-sky-400/30 bg-sky-500/10"
}

const isHighSeverity = (severity: string) => {
  const normalized = String(severity || "").toLowerCase()
  return normalized === "critical" || normalized === "high"
}

const ControlPanelBlacksite = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)
  const [streamState, setStreamState] = useState<"connecting" | "live" | "offline">("connecting")
  const [streamPulse, setStreamPulse] = useState<StreamRealtimeEvent | null>(null)
  const [streamErrors, setStreamErrors] = useState<StreamErrorEvent[]>([])

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const [banUserId, setBanUserId] = useState("")
  const [banIp, setBanIp] = useState("")
  const [banReason, setBanReason] = useState("")
  const [banDurationHours, setBanDurationHours] = useState("24")

  const [grantUserId, setGrantUserId] = useState("")
  const [grantEmail, setGrantEmail] = useState("")
  const [grantTier, setGrantTier] = useState("creator")
  const [grantDurationDays, setGrantDurationDays] = useState("30")

  const [cancelUserId, setCancelUserId] = useState("")
  const [cancelEmail, setCancelEmail] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [cancelImmediate, setCancelImmediate] = useState(true)

  const [restartReason, setRestartReason] = useState("manual_operator_restart")

  const [promptTitle, setPromptTitle] = useState("Ship premium animation upgrade")
  const [promptBody, setPromptBody] = useState("")
  const [promptTargetPath, setPromptTargetPath] = useState("frontend/src/pages/generated/operator-prompt.ts")
  const [promptCreateTargetFile, setPromptCreateTargetFile] = useState(true)
  const [promptOverwriteTargetFile, setPromptOverwriteTargetFile] = useState(false)

  const commandCenterQuery = useQuery({
    queryKey: ["admin-command-center", "blacksite"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(15000)
  })

  const siteLiveQuery = useQuery({
    queryKey: ["admin-site-live", "blacksite"],
    queryFn: () => apiFetch<SiteLiveResponse>("/api/admin/site-live", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(7000)
  })

  const liveGeoQuery = useQuery({
    queryKey: ["admin-live-geo", "blacksite"],
    queryFn: () => apiFetch<LiveGeoResponse>("/api/admin/live-geo", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(12000)
  })

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", "90d", "blacksite"],
    queryFn: () => apiFetch<PaymentsResponse>("/api/admin/payments?range=90d", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(30000)
  })

  const subscriptionsQuery = useQuery({
    queryKey: ["admin-subscriptions", "30d", "blacksite"],
    queryFn: () => apiFetch<SubscriptionsResponse>("/api/admin/subscriptions?range=30d", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(30000)
  })

  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback", "30d", "blacksite"],
    queryFn: () => apiFetch<FeedbackResponse>("/api/admin/feedback?range=30d", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(18000)
  })

  const errorsQuery = useQuery({
    queryKey: ["admin-errors", "24h", "blacksite"],
    queryFn: () => apiFetch<ErrorsResponse>("/api/admin/errors?range=24h", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(13000)
  })

  const healthQuery = useQuery({
    queryKey: ["admin-health-status", "blacksite"],
    queryFn: () => apiFetch<HealthStatusResponse>("/api/admin/health-status", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(15000)
  })

  const realtimeUsersQuery = useQuery({
    queryKey: ["admin-realtime-users", "blacksite"],
    queryFn: () => apiFetch<RealtimeUsersResponse>("/api/admin/realtime-users", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(8000)
  })

  const ipBansQuery = useQuery({
    queryKey: ["admin-ip-bans", "blacksite"],
    queryFn: () => apiFetch<IpBansResponse>("/api/admin/ip-bans", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(20000)
  })

  const promptsQuery = useQuery({
    queryKey: ["admin-automation-prompts", "blacksite"],
    queryFn: () => apiFetch<AutomationPromptsResponse>("/api/admin/automation/prompts", { token: accessToken || "" }),
    enabled: canLoad,
    ...controlPanelLiveQueryOptions(20000)
  })

  useEffect(() => {
    if (!accessToken) return
    const params = new URLSearchParams({
      token: accessToken,
      password: getControlPanelPassword()
    })
    const stream = new EventSource(`${API_URL || ""}/api/admin/stream?${params.toString()}`, { withCredentials: true })

    const parseEvent = <T,>(event: MessageEvent<string>) => {
      try {
        return JSON.parse(event.data) as T
      } catch {
        return null
      }
    }

    setStreamState("connecting")

    const readyListener: EventListener = () => setStreamState("live")
    const realtimeListener: EventListener = (event) => {
      const parsed = parseEvent<StreamRealtimeEvent>(event as MessageEvent<string>)
      if (!parsed) return
      setStreamPulse(parsed)
      setStreamState("live")
    }
    const newErrorListener: EventListener = (event) => {
      const parsed = parseEvent<StreamErrorEvent>(event as MessageEvent<string>)
      if (!parsed) return
      setStreamErrors((current) => [parsed, ...current].slice(0, 20))
    }

    stream.addEventListener("ready", readyListener)
    stream.addEventListener("realtime", realtimeListener)
    stream.addEventListener("new_error", newErrorListener)
    stream.onerror = () => setStreamState("offline")

    return () => {
      stream.removeEventListener("ready", readyListener)
      stream.removeEventListener("realtime", realtimeListener)
      stream.removeEventListener("new_error", newErrorListener)
      stream.close()
    }
  }, [accessToken])

  const runAction = async (actionKey: string, task: () => Promise<void>) => {
    setBusyAction(actionKey)
    setActionError(null)
    setActionSuccess(null)
    try {
      await task()
    } catch (error: any) {
      setActionError(error?.message || "Action failed.")
    } finally {
      setBusyAction((current) => (current === actionKey ? null : current))
    }
  }

  const handleBan = async () => {
    if (!accessToken) return
    if (!banUserId.trim() && !banIp.trim()) {
      setActionError("Enter a user ID or IP to ban.")
      setActionSuccess(null)
      return
    }
    await runAction("ban", async () => {
      await apiFetch("/api/admin/ip-bans", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          userId: banUserId.trim() || undefined,
          ip: banIp.trim() || undefined,
          reason: banReason.trim() || undefined,
          durationHours: Math.max(0, Math.floor(toNumber(banDurationHours, 0)))
        })
      })
      setActionSuccess("Ban rule created.")
      setBanIp("")
      setBanUserId("")
      await ipBansQuery.refetch()
    })
  }

  const handleUnban = async (ip: string) => {
    if (!accessToken) return
    await runAction(`unban-${ip}`, async () => {
      await apiFetch(`/api/admin/ip-bans/${encodeURIComponent(ip)}`, { method: "DELETE", token: accessToken })
      setActionSuccess(`Removed ban for ${ip}.`)
      await ipBansQuery.refetch()
    })
  }

  const handleGrantSubscription = async () => {
    if (!accessToken) return
    if (!grantUserId.trim() && !grantEmail.trim()) {
      setActionError("Enter user ID or email for subscription grant.")
      setActionSuccess(null)
      return
    }
    await runAction("grant-subscription", async () => {
      await apiFetch("/api/admin/subscriptions/grant", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          userId: grantUserId.trim() || undefined,
          email: grantEmail.trim() || undefined,
          planTier: grantTier,
          durationDays: Math.max(1, Math.floor(toNumber(grantDurationDays, 30)))
        })
      })
      setActionSuccess("Subscription grant applied.")
      setGrantUserId("")
      setGrantEmail("")
      await subscriptionsQuery.refetch()
    })
  }

  const handleCancelSubscription = async () => {
    if (!accessToken) return
    if (!cancelUserId.trim() && !cancelEmail.trim()) {
      setActionError("Enter user ID or email to cancel subscription.")
      setActionSuccess(null)
      return
    }
    await runAction("cancel-subscription", async () => {
      await apiFetch("/api/admin/subscriptions/cancel", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          userId: cancelUserId.trim() || undefined,
          email: cancelEmail.trim() || undefined,
          immediate: cancelImmediate,
          reason: cancelReason.trim() || undefined
        })
      })
      setActionSuccess("Subscription cancellation applied.")
      setCancelUserId("")
      setCancelEmail("")
      await subscriptionsQuery.refetch()
    })
  }

  const handleRestartServer = async () => {
    if (!accessToken) return
    await runAction("restart-server", async () => {
      const response = await apiFetch<RestartResponse>("/api/admin/server/restart", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          reason: restartReason.trim() || "manual_operator_restart"
        })
      })
      setActionSuccess(response.message || "Restart request submitted.")
    })
  }

  const handleCreatePrompt = async () => {
    if (!accessToken) return
    if (!promptBody.trim()) {
      setActionError("Prompt text is required.")
      setActionSuccess(null)
      return
    }
    await runAction("create-prompt", async () => {
      const result = await apiFetch<{ createdTargetPath?: string | null }>("/api/admin/automation/prompts", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          title: promptTitle,
          prompt: promptBody,
          targetPath: promptTargetPath.trim() || undefined,
          createTargetFile: promptCreateTargetFile,
          overwriteTargetFile: promptOverwriteTargetFile
        })
      })
      setActionSuccess(
        result?.createdTargetPath
          ? `Prompt saved and file generated at ${result.createdTargetPath}.`
          : "Prompt saved to automation inbox."
      )
      await promptsQuery.refetch()
    })
  }

  const queueDepth = streamPulse?.jobsInQueue ?? commandCenterQuery.data?.systemHealth.renderQueueLength ?? 0
  const activeCustomers = streamPulse?.activeUsers ?? realtimeUsersQuery.data?.activeUsers ?? siteLiveQuery.data?.activeUsers ?? 0
  const activeSessions = realtimeUsersQuery.data?.sessions.length || 0

  const highSeverityIssues = useMemo(() => {
    const apiIssues = (errorsQuery.data?.items || []).filter((item) => isHighSeverity(item.severity)).length
    const streamIssues = streamErrors.filter((item) => isHighSeverity(item.severity)).length
    return apiIssues + streamIssues
  }, [errorsQuery.data?.items, streamErrors])

  const predictedRevenue30d = useMemo(() => {
    const series = paymentsQuery.data?.revenueByDay || []
    if (!series.length) return 0
    const sorted = [...series].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
    const first = new Date(sorted[0].t).getTime()
    const last = new Date(sorted[sorted.length - 1].t).getTime()
    const spanDays = Math.max(1, Math.round((last - first) / (24 * 60 * 60 * 1000)) + 1)
    const total = sorted.reduce((sum, point) => sum + toNumber(point.v, 0), 0)
    return Number(((total / spanDays) * 30).toFixed(2))
  }, [paymentsQuery.data?.revenueByDay])

  const strategyCards = useMemo(() => {
    const command = commandCenterQuery.data
    const rows: Array<{ title: string; detail: string }> = []
    if (command?.liveErrorTerminal?.fixSuggestion) {
      rows.push({
        title: "Server issue suggestion",
        detail: command.liveErrorTerminal.fixSuggestion
      })
    }
    ;(command?.feedbackIntelligence?.topRequestedFeatures || []).slice(0, 2).forEach((feature) => {
      rows.push({
        title: `User demand: ${feature.feature}`,
        detail: `${feature.count} requests in recent feedback clusters.`
      })
    })
    ;(command?.conversionIntelligence?.onboardingDropOff || []).slice(0, 2).forEach((step) => {
      rows.push({
        title: `Conversion risk: ${step.step}`,
        detail: `${step.dropOffPct.toFixed(1)}% drop-off. Focus this step first.`
      })
    })
    if (command?.futureScalingPanel?.autoScaleWorkerTriggers?.active) {
      rows.push({
        title: "Scale prediction",
        detail: `Auto-scale trigger is active, suggested workers: ${command.futureScalingPanel.autoScaleWorkerTriggers.suggestedWorkers}.`
      })
    }
    if (!rows.length) {
      rows.push({
        title: "Awaiting stronger signal",
        detail: "Run more renders and collect more feedback for higher-confidence predictions."
      })
    }
    return rows.slice(0, 6)
  }, [commandCenterQuery.data])

  const mergedErrorFeed = useMemo(() => {
    const fromApi = (errorsQuery.data?.items || []).map((item) => ({
      id: item.id,
      severity: item.severity,
      message: item.message,
      source: item.endpoint || item.route || "api",
      lastSeen: item.lastSeen
    }))
    const fromStream = streamErrors.map((item) => ({
      id: item.id,
      severity: item.severity,
      message: item.message,
      source: item.endpoint || item.route || "stream",
      lastSeen: item.lastSeen
    }))
    return [...fromStream, ...fromApi]
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(0, 10)
  }, [errorsQuery.data?.items, streamErrors])

  return (
    <div className="control-panel-viewport relative min-h-screen overflow-hidden text-foreground">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[7%] top-[12%] h-72 w-72 rounded-full bg-cyan-300/14 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.24, 0.44, 0.24] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[9%] top-[38%] h-80 w-80 rounded-full bg-amber-300/12 blur-3xl"
          animate={{ scale: [1.04, 1, 1.04], opacity: [0.2, 0.36, 0.2] }}
          transition={{ duration: 11, repeat: Infinity }}
        />
      </div>

      <main className="control-panel-main relative mx-auto w-full max-w-[1500px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Operator Deck"
          subtitle="Secret command center with real-time telemetry, monetization intelligence, and direct admin control."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load operator deck telemetry." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-5">
          <Card className="glass-card border-cyan-300/25 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-200" />
                  Realtime Customers
                </span>
                <Badge className={streamState === "live" ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" : streamState === "connecting" ? "border-amber-300/40 bg-amber-500/15 text-amber-100" : "border-rose-300/40 bg-rose-500/15 text-rose-100"}>
                  {streamState}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(activeCustomers)}</p>
              <p className="text-xs text-slate-300">{activeSessions} live sessions tracked</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-sky-300/20 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-sky-200" />
                Queue Pressure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(queueDepth)}</p>
              <p className="text-xs text-slate-300">jobs in queue now</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-emerald-300/25 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-emerald-200" />
                Money Made (90d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatMoney(paymentsQuery.data?.revenueTotal || 0)}</p>
              <p className="text-xs text-slate-300">predicted next 30d: {formatMoney(predictedRevenue30d)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-rose-300/25 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-rose-200" />
                Server Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{highSeverityIssues}</p>
              <p className="text-xs text-slate-300">
                status: {healthQuery.data?.status || "unknown"} | failed 24h {streamPulse?.jobsFailed24h ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-violet-300/25 bg-slate-950/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-violet-200" />
                Feedback Pulse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(feedbackQuery.data?.total || 0)}</p>
              <p className="text-xs text-slate-300">{(feedbackQuery.data?.topIssues || []).slice(0, 1).map((row) => row.issue).join("") || "No strong issue clusters yet"}</p>
            </CardContent>
          </Card>
        </section>

        {actionError || actionSuccess ? (
          <section className="mt-4">
            {actionError ? (
              <p className="rounded-md border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{actionError}</p>
            ) : null}
            {actionSuccess ? (
              <p className="rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{actionSuccess}</p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-12">
          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="text-sm">Live Impressions (Last Hour)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {(siteLiveQuery.data?.series || []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteLiveQuery.data?.series || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="v" fill="hsl(196 92% 58%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No live impression series yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="text-sm">Revenue Trajectory</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {(paymentsQuery.data?.revenueByDay || []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={paymentsQuery.data?.revenueByDay || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                    <XAxis dataKey="t" tickFormatter={shortDate} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      labelFormatter={(label) => shortDate(String(label))}
                    />
                    <Area type="monotone" dataKey="v" stroke="hsl(152 68% 48%)" fill="hsl(152 68% 48% / 0.28)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No revenue trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Prediction + Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/60 bg-card/35 p-2">
                Runway: {toNumber(commandCenterQuery.data?.costControlPanel?.runwayMonths, 0).toFixed(1)} months | Profit margin: {toNumber(commandCenterQuery.data?.costControlPanel?.profitMarginPct, 0).toFixed(1)}%
              </p>
              <p className="rounded-md border border-border/60 bg-card/35 p-2">
                Trial to paid conversion: {toNumber(commandCenterQuery.data?.conversionIntelligence?.trialToPaidConversionPct, 0).toFixed(1)}%
              </p>
              <div className="space-y-2">
                {strategyCards.map((row, index) => (
                  <div key={`${row.title}-${index}`} className="rounded-md border border-border/60 bg-card/35 p-2">
                    <p className="font-medium text-slate-100">{row.title}</p>
                    <p className="text-slate-300">{row.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-12">
          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-7">
            <CardHeader>
              <CardTitle className="text-sm">Realtime Customers Map</CardTitle>
            </CardHeader>
            <CardContent>
              <LiveUsersGlobe
                points={liveGeoQuery.data?.geoHeatmap || []}
                activeUsers={liveGeoQuery.data?.activeUsers || activeCustomers}
                updatedAt={liveGeoQuery.data?.updatedAt || null}
              />
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-5">
            <CardHeader>
              <CardTitle className="text-sm">Realtime Customer Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(realtimeUsersQuery.data?.sessions || []).slice(0, 10).map((session) => (
                <div key={session.sessionId} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium text-slate-100">{session.email || session.userId}</p>
                  <p className="text-slate-300">ip {session.ip || "unknown"} | last seen {formatShortTime(session.lastSeen)}</p>
                </div>
              ))}
              {!realtimeUsersQuery.data?.sessions.length ? (
                <EmptyStateNote text="No live customer sessions right now." />
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-12">
          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-rose-300" />
                Server Issues Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className={`rounded-md border p-2 ${healthQuery.data?.status === "healthy" ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-rose-400/35 bg-rose-500/10 text-rose-100"}`}>
                Health: {healthQuery.data?.status || "unknown"}
              </p>
              {mergedErrorFeed.map((item) => (
                <div key={`${item.id}-${item.lastSeen}`} className={`rounded-md border p-2 ${statusTone(item.severity)}`}>
                  <p className="line-clamp-2 font-medium">{item.message}</p>
                  <p className="text-[11px] opacity-85">
                    {item.source} | {formatShortTime(item.lastSeen)}
                  </p>
                </div>
              ))}
              {!mergedErrorFeed.length ? <EmptyStateNote text="No active server issue feed." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-violet-300" />
                User Feedback Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(feedbackQuery.data?.topIssues || []).slice(0, 7).map((issue) => (
                <div key={issue.issue} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="font-medium text-slate-100">{issue.issue}</p>
                  <p className="text-slate-300">{issue.count} mentions</p>
                </div>
              ))}
              {!feedbackQuery.data?.topIssues.length ? <EmptyStateNote text="No feedback issues yet." /> : null}

              <div className="mt-2 space-y-2">
                {(feedbackQuery.data?.items || []).slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/50 bg-card/35 p-2">
                    <p className="line-clamp-1 font-medium text-slate-100">
                      {item.category} | {item.sentiment}
                    </p>
                    <p className="line-clamp-2 text-slate-300">{item.note || "No note provided."}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Crown className="h-4 w-4 text-amber-300" />
                Subscription Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <p className="rounded-md border border-border/50 bg-card/35 p-2">Free: {subscriptionsQuery.data?.distribution.free || 0}</p>
                <p className="rounded-md border border-border/50 bg-card/35 p-2">Starter: {subscriptionsQuery.data?.distribution.starter || 0}</p>
                <p className="rounded-md border border-border/50 bg-card/35 p-2">Pro: {subscriptionsQuery.data?.distribution.pro || 0}</p>
                <p className="rounded-md border border-border/50 bg-card/35 p-2">Founder: {subscriptionsQuery.data?.distribution.founder || 0}</p>
              </div>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Active subs: {subscriptionsQuery.data?.activeSubscriptions || 0} | Churn: {subscriptionsQuery.data?.churnCount || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Last sync: {formatShortTime(subscriptionsQuery.dataUpdatedAt ? new Date(subscriptionsQuery.dataUpdatedAt).toISOString() : null)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-12">
          <Card className="glass-card border-rose-300/25 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Ban className="h-4 w-4 text-rose-300" />
                Ban by ID / IP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <input
                value={banUserId}
                onChange={(event) => setBanUserId(event.target.value)}
                placeholder="User ID (optional)"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <input
                value={banIp}
                onChange={(event) => setBanIp(event.target.value)}
                placeholder="IP (optional)"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <input
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                placeholder="Reason"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <input
                value={banDurationHours}
                onChange={(event) => setBanDurationHours(event.target.value)}
                placeholder="Duration hours (0 = permanent)"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <Button
                size="sm"
                loading={busyAction === "ban"}
                loadingText="Applying..."
                onClick={handleBan}
                className="w-full border border-rose-300/35 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
              >
                Create Ban
              </Button>
              <div className="max-h-40 space-y-2 overflow-auto pr-1">
                {(ipBansQuery.data?.items || []).slice(0, 6).map((item) => (
                  <div key={item.ip} className="rounded-md border border-border/50 bg-card/35 p-2">
                    <p className="font-medium">{item.ip}</p>
                    <p className="text-[11px] text-muted-foreground">exp {formatShortTime(item.expiresAt)}</p>
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-sky-200 underline"
                      onClick={() => void handleUnban(item.ip)}
                    >
                      remove ban
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-amber-300/25 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BadgeCheck className="h-4 w-4 text-amber-300" />
                Give Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <input
                value={grantUserId}
                onChange={(event) => setGrantUserId(event.target.value)}
                placeholder="User ID"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <input
                value={grantEmail}
                onChange={(event) => setGrantEmail(event.target.value)}
                placeholder="Email"
                className="h-9 w-full rounded-md border border-border/60 bg-card/35 px-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={grantTier}
                  onChange={(event) => setGrantTier(event.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-card/35 px-2"
                >
                  <option value="starter">starter</option>
                  <option value="creator">creator</option>
                  <option value="studio">studio</option>
                  <option value="founder">founder</option>
                </select>
                <input
                  value={grantDurationDays}
                  onChange={(event) => setGrantDurationDays(event.target.value)}
                  placeholder="Duration days"
                  className="h-9 rounded-md border border-border/60 bg-card/35 px-2"
                />
              </div>
              <Button
                size="sm"
                loading={busyAction === "grant-subscription"}
                loadingText="Granting..."
                onClick={handleGrantSubscription}
                className="w-full border border-amber-300/35 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
              >
                Grant Subscription
              </Button>

              <div className="rounded-md border border-border/50 bg-card/35 p-2">
                <p className="mb-1 font-medium">Cancel Subscription</p>
                <input
                  value={cancelUserId}
                  onChange={(event) => setCancelUserId(event.target.value)}
                  placeholder="User ID"
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <input
                  value={cancelEmail}
                  onChange={(event) => setCancelEmail(event.target.value)}
                  placeholder="Email"
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <input
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Cancel reason"
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <label className="mb-2 inline-flex items-center gap-2 text-[11px] text-slate-300">
                  <input type="checkbox" checked={cancelImmediate} onChange={(event) => setCancelImmediate(event.target.checked)} />
                  Cancel immediately
                </label>
                <Button
                  size="sm"
                  loading={busyAction === "cancel-subscription"}
                  loadingText="Applying..."
                  onClick={handleCancelSubscription}
                  className="w-full border border-rose-300/35 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                >
                  Cancel Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-sky-300/25 bg-slate-950/60 xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Server className="h-4 w-4 text-sky-300" />
                Restart + VS Code Prompt Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="rounded-md border border-border/50 bg-card/35 p-2">
                <p className="mb-1 font-medium">Restart server</p>
                <input
                  value={restartReason}
                  onChange={(event) => setRestartReason(event.target.value)}
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <Button
                  size="sm"
                  loading={busyAction === "restart-server"}
                  loadingText="Requesting..."
                  onClick={handleRestartServer}
                  className="w-full border border-sky-300/35 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
                >
                  Restart Server
                </Button>
              </div>

              <div className="rounded-md border border-border/50 bg-card/35 p-2">
                <p className="mb-1 font-medium">Send prompt into VS Code</p>
                <input
                  value={promptTitle}
                  onChange={(event) => setPromptTitle(event.target.value)}
                  placeholder="Prompt title"
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <textarea
                  value={promptBody}
                  onChange={(event) => setPromptBody(event.target.value)}
                  placeholder="Describe what should be auto-created..."
                  className="mb-2 min-h-[92px] w-full rounded-md border border-border/60 bg-card/30 px-2 py-2"
                />
                <input
                  value={promptTargetPath}
                  onChange={(event) => setPromptTargetPath(event.target.value)}
                  placeholder="Target file path (project-relative)"
                  className="mb-2 h-9 w-full rounded-md border border-border/60 bg-card/30 px-2"
                />
                <label className="mb-1 inline-flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={promptCreateTargetFile}
                    onChange={(event) => setPromptCreateTargetFile(event.target.checked)}
                  />
                  Create target file
                </label>
                <label className="mb-2 inline-flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={promptOverwriteTargetFile}
                    onChange={(event) => setPromptOverwriteTargetFile(event.target.checked)}
                  />
                  Overwrite existing file
                </label>
                <Button
                  size="sm"
                  loading={busyAction === "create-prompt"}
                  loadingText="Saving..."
                  onClick={handleCreatePrompt}
                  className="w-full border border-violet-300/35 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
                >
                  Save Prompt + Auto Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-12">
          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-cyan-300" />
                AI Suggestions + Algorithm Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                System CPU: {toNumber(commandCenterQuery.data?.systemHealth.cpuUsagePct, 0).toFixed(1)}% | Memory used: {toNumber(commandCenterQuery.data?.systemHealth.memoryUsage.systemUsedPct, 0).toFixed(1)}%
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Worker: {commandCenterQuery.data?.systemHealth.workerStatus.status || "unknown"} | uptime {(
                  toNumber(commandCenterQuery.data?.systemHealth.workerStatus.uptimeSeconds, 0) /
                  3600
                ).toFixed(1)}
                h
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Live users rendering/exporting: {toNumber(commandCenterQuery.data?.liveUsers.usersRendering, 0)} / {toNumber(commandCenterQuery.data?.liveUsers.usersExporting, 0)}
              </p>

              <div className="h-44 rounded-md border border-border/50 bg-card/30 p-2">
                {(subscriptionsQuery.data?.trend || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={subscriptionsQuery.data?.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                      <XAxis dataKey="t" tickFormatter={shortDate} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="v" stroke="hsl(274 96% 70%)" fill="hsl(274 96% 70% / 0.26)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="Subscription trend data pending." />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 bg-slate-950/60 xl:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <PlaySquare className="h-4 w-4 text-violet-300" />
                Prompt Inbox (recent)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(promptsQuery.data?.items || []).slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium text-slate-100">{item.title}</p>
                  <p className="line-clamp-2 text-slate-300">{item.promptPreview}</p>
                  <p className="text-[11px] text-slate-400">
                    {item.targetPath || item.inboxPath} | {formatShortTime(item.createdAt)}
                  </p>
                </div>
              ))}
              {!promptsQuery.data?.items.length ? (
                <EmptyStateNote text="No automation prompts created yet." />
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4">
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            <div className="flex flex-wrap items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span>Operator deck is in high-control mode.</span>
              <Clock3 className="h-4 w-4" />
              <span>Live refresh cadence: 7s-30s polling + realtime stream.</span>
              <RefreshCw className="h-4 w-4 animate-live-gear-spin" />
              <span>Last stream tick: {formatShortTime(streamPulse?.t || null)}</span>
              <AlertTriangle className="h-4 w-4" />
              <span>Use restart and ban controls carefully, actions are audited.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelBlacksite
