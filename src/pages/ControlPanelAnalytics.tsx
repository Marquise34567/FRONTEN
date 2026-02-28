import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { Activity, BarChart3, Clock3, Gauge, Users, UserSquare2 } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import { AdminAnalyticsResponse, EmptyStateNote, formatCompactNumber, formatShortTime } from "./control-panel/shared"
import { useAdminRealtimeStream } from "./control-panel/useAdminRealtimeStream"

const formatSecondsLabel = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0)
  if (safe < 60) return `${safe.toFixed(1)}s`
  const minutes = Math.floor(safe / 60)
  const remainingSeconds = Math.round(safe % 60)
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const minutesRemainder = minutes % 60
  return `${hours}h ${minutesRemainder}m`
}

const formatMinutesLabel = (minutes: number) => {
  const safe = Math.max(0, Number(minutes) || 0)
  if (safe < 1) return `${Math.round(safe * 60)}s`
  return `${safe.toFixed(2)}m`
}

const formatPercent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`

const ControlPanelAnalytics = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)
  const realtime = useAdminRealtimeStream(accessToken, 4000)

  const analyticsQuery = useQuery({
    queryKey: ["control-panel-analytics-all-time"],
    queryFn: () => apiFetch<AdminAnalyticsResponse>("/api/admin/analytics", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 25000
  })

  const analytics = analyticsQuery.data

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(130%_120%_at_14%_5%,hsl(194_96%_61%/0.15),transparent_42%),radial-gradient(125%_110%_at_86%_18%,hsl(157_88%_52%/0.13),transparent_45%),linear-gradient(180deg,hsl(220_36%_8%)_0%,hsl(226_38%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 8.6, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[9%] top-[34%] h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.18, 0.3, 0.18] }}
          transition={{ duration: 9.4, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Analytics"
          subtitle="All-time users/accounts, session depth, and page stay-time analytics."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load analytics telemetry." />
          </div>
        ) : null}
        {canLoad ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Live stream: {realtime.streamError ? "warning" : realtime.connected ? "connected" : "connecting"}{" "}
            {analytics?.generatedAt ? `• analytics generated ${formatShortTime(analytics.generatedAt)}` : ""}
          </p>
        ) : null}

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-cyan-200" />
                All-Time Tracked Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimeTrackedUsers || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserSquare2 className="h-4 w-4 text-emerald-200" />
                Account Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimeAccounts || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-sky-200" />
                All-Time Render Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimeRenderUsers || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All-Time Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimeSessions || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All-Time Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimeEvents || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All-Time Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCompactNumber(analytics?.totals.allTimePageViews || 0)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 text-amber-200" />
                Avg Session Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatMinutesLabel(analytics?.engagement.avgSessionMinutes || 0)}</p>
              <p className="text-[11px] text-muted-foreground">Median {formatMinutesLabel(analytics?.engagement.medianSessionMinutes || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-violet-200" />
                Avg Time On Page
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatSecondsLabel(analytics?.engagement.avgTimeOnPageSeconds || 0)}</p>
              <p className="text-[11px] text-muted-foreground">Median {formatSecondsLabel(analytics?.engagement.medianTimeOnPageSeconds || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pages / Session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{(analytics?.engagement.avgPagesPerSession || 0).toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">
                Events / Session {(analytics?.engagement.avgEventsPerSession || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Bounce Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatPercent(analytics?.engagement.bounceRatePct || 0)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-cyan-200" />
                Top Pages By Views
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(analytics?.topPagesByViews || []).slice(0, 12).map((row) => (
                <div key={`views-${row.pagePath}`} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium">{row.pagePath}</p>
                  <p className="text-muted-foreground">
                    Views {formatCompactNumber(row.views)} • Users {formatCompactNumber(row.uniqueUsers)} • Avg stay {formatSecondsLabel(row.avgTimeSeconds)}
                  </p>
                </div>
              ))}
              {!(analytics?.topPagesByViews || []).length ? <EmptyStateNote text="No page-view analytics captured yet." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Top Pages By Time Stayed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(analytics?.topPagesByTime || []).slice(0, 12).map((row) => (
                <div key={`time-${row.pagePath}`} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium">{row.pagePath}</p>
                  <p className="text-muted-foreground">
                    Avg stay {formatSecondsLabel(row.avgTimeSeconds)} • Total stay {formatMinutesLabel(row.totalTimeMinutes)} • Views {formatCompactNumber(row.views)}
                  </p>
                </div>
              ))}
              {!(analytics?.topPagesByTime || []).length ? <EmptyStateNote text="No page-duration analytics captured yet." /> : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelAnalytics
