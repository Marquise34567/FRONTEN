import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { motion } from "framer-motion"
import { Eye, Globe2, ShieldAlert, Timer, Users } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import LiveUsersGlobe from "@/components/control-panel/LiveUsersGlobe"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import {
  chartTick,
  CommandCenterResponse,
  EmptyStateNote,
  formatCompactNumber,
  formatShortTime,
  LiveGeoResponse,
  SiteLiveResponse
} from "./control-panel/shared"
import { useAdminRealtimeStream } from "./control-panel/useAdminRealtimeStream"

const PLAN_COLORS = [
  "hsl(206 100% 62%)",
  "hsl(162 78% 45%)",
  "hsl(42 98% 62%)",
  "hsl(332 84% 66%)",
  "hsl(268 78% 68%)"
]

const ControlPanelAudience = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)
  const realtime = useAdminRealtimeStream(accessToken, 4000)

  const commandCenterQuery = useQuery({
    queryKey: ["control-panel-audience-command-center"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const siteLiveQuery = useQuery({
    queryKey: ["control-panel-audience-site-live"],
    queryFn: () => apiFetch<SiteLiveResponse>("/api/admin/site-live", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 12000
  })

  const liveGeoQuery = useQuery({
    queryKey: ["control-panel-audience-live-geo"],
    queryFn: () => apiFetch<LiveGeoResponse>("/api/admin/live-geo", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const liveUsers = commandCenterQuery.data?.liveUsers
  const audienceIntel = commandCenterQuery.data?.userIntelligencePanel
  const siteLive = siteLiveQuery.data
  const realtimeLiveUsers = realtime.payload?.liveUsers

  const globePoints = liveGeoQuery.data?.geoHeatmap || audienceIntel?.geoHeatmap || []
  const activeUsers =
    realtime.payload?.activeUsers ??
    liveGeoQuery.data?.activeUsers ??
    siteLive?.activeUsers ??
    audienceIntel?.activeUsers ??
    0
  const renderingUsers = realtimeLiveUsers?.usersRendering ?? liveUsers?.usersRendering ?? 0
  const exportingUsers = realtimeLiveUsers?.usersExporting ?? liveUsers?.usersExporting ?? 0
  const averageSessionMinutes = realtimeLiveUsers?.averageSessionMinutes ?? liveUsers?.averageSessionMinutes ?? 0
  const impressionsLast5m = realtime.payload?.websiteImpressions5m ?? siteLive?.impressionsLast5m ?? 0

  const countryRollup = useMemo(() => {
    const byCountry = new Map<string, { country: string; sessions: number; users: number }>()
    globePoints.forEach((row) => {
      const key = (row.country || "Unknown").trim() || "Unknown"
      const current = byCountry.get(key) || { country: key, sessions: 0, users: 0 }
      current.sessions += Math.max(0, Number(row.sessions || 0))
      current.users += Math.max(0, Number(row.users || 0))
      byCountry.set(key, current)
    })
    return Array.from(byCountry.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8)
  }, [globePoints])

  const planPie = useMemo(() => {
    return Object.entries(audienceIntel?.planBreakdown || {})
      .map(([plan, count], index) => ({
        name: plan,
        value: Math.max(0, Number(count || 0)),
        fill: PLAN_COLORS[index % PLAN_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
  }, [audienceIntel?.planBreakdown])

  const hasPlanMix = planPie.some((item) => item.value > 0)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_100%_at_14%_6%,hsl(201_98%_62%/0.18),transparent_45%),radial-gradient(130%_110%_at_90%_14%,hsl(177_82%_48%/0.14),transparent_42%),linear-gradient(180deg,hsl(219_34%_9%)_0%,hsl(225_36%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[10%] top-[18%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.34, 0.2] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[8%] top-[34%] h-64 w-64 rounded-full bg-cyan-400/12 blur-3xl"
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.18, 0.3, 0.18] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Audience Intel"
          subtitle="Live user behavior, watch quality, geo concentration, and demand by plan."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load audience telemetry." />
          </div>
        ) : null}
        {canLoad ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Stream: {realtime.streamError ? "warning" : realtime.connected ? "connected" : "connecting"}{" "}
            {realtime.payload?.t ? `• ${formatShortTime(realtime.payload.t)}` : ""}
          </p>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-5">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-sky-200" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(activeUsers)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-cyan-200" />
                Rendering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(renderingUsers)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-indigo-200" />
                Exporting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(exportingUsers)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4 text-emerald-200" />
                Avg Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{averageSessionMinutes.toFixed(1)}m</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-amber-200" />
                Impressions (5m)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(impressionsLast5m)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe2 className="h-4 w-4 text-sky-200" />
                Live Geo Concentration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <LiveUsersGlobe
                points={globePoints}
                activeUsers={activeUsers}
                updatedAt={liveGeoQuery.data?.updatedAt || siteLive?.updatedAt || null}
              />
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Website Activity Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Impressions 60m</p>
                  <p className="text-xl font-semibold">{formatCompactNumber(siteLive?.impressionsLast60m || 0)}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Impressions 24h</p>
                  <p className="text-xl font-semibold">{formatCompactNumber(siteLive?.impressionsLast24h || 0)}</p>
                </div>
              </div>

              <div className="h-56 rounded-md border border-border/50 bg-card/35 p-2">
                {(siteLive?.series || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={siteLive?.series || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="v" stroke="hsl(197 92% 58%)" fill="hsl(197 92% 58% / 0.35)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No website activity points yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Last sync: {formatShortTime(siteLive?.updatedAt)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Top Render Users</CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 space-y-2 overflow-auto text-xs">
              {(audienceIntel?.topUsersByRenders || []).slice(0, 10).map((user) => (
                <div key={user.userId} className="rounded-md border border-border/40 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium">{user.email || user.userId}</p>
                  <p className="text-muted-foreground">
                    {user.planTier} • {formatCompactNumber(user.renders)} renders • {(user.usagePct * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
              {!(audienceIntel?.topUsersByRenders || []).length ? <EmptyStateNote text="No active render users found." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Plan Mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-56 rounded-md border border-border/50 bg-card/35 p-2">
                {hasPlanMix ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planPie} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84}>
                        {planPie.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No plan breakdown telemetry yet." />
                  </div>
                )}
              </div>
              <div className="grid gap-2 text-xs">
                {planPie.slice(0, 5).map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-md border border-border/40 bg-card/35 px-2 py-1.5">
                    <span className="capitalize">{entry.name}</span>
                    <span className="font-semibold">{formatCompactNumber(entry.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Audience Risk + Geo Leaders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Avg Watch Length</p>
                  <p className="text-xl font-semibold">{(audienceIntel?.averageWatchLengthSec || 0).toFixed(1)}s</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Suspicious Flag</p>
                  <p className={`text-xl font-semibold ${audienceIntel?.suspiciousActivityFlag ? "text-rose-200" : "text-emerald-200"}`}>
                    {audienceIntel?.suspiciousActivityFlag ? "Flagged" : "Normal"}
                  </p>
                </div>
              </div>
              <div className="max-h-44 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {countryRollup.map((row) => (
                  <p key={row.country} className="mb-1">
                    {row.country} • {formatCompactNumber(row.sessions)} sessions • {formatCompactNumber(row.users)} users
                  </p>
                ))}
                {!countryRollup.length ? <EmptyStateNote text="No geo concentration records yet." /> : null}
              </div>
              <div className="rounded-md border border-sky-400/35 bg-sky-400/10 p-2 text-sky-100">
                <Badge className="mb-2 border-sky-200/40 bg-sky-200/20 text-[10px] uppercase">Whale Detector</Badge>
                <p>Users close to upgrade: {formatCompactNumber((audienceIntel?.whaleDetector || []).length)}</p>
                <p>Abuse candidates: {formatCompactNumber((audienceIntel?.abuseDetection || []).length)}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelAudience
