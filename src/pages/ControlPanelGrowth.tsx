import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { motion } from "framer-motion"
import { Gauge, Rocket, TrendingUp, UserPlus, Users } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import { chartTick, CommandCenterResponse, EmptyStateNote, formatCompactNumber, formatShortTime } from "./control-panel/shared"

const pct = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`

const ControlPanelGrowth = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)

  const commandCenterQuery = useQuery({
    queryKey: ["control-panel-growth-command-center"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const growth = commandCenterQuery.data?.growth
  const conversionIntel = commandCenterQuery.data?.conversionIntelligence
  const feedbackIntel = commandCenterQuery.data?.feedbackIntelligence
  const generatedAt = commandCenterQuery.data?.generatedAt

  const funnelSeries = useMemo(
    () =>
      growth
        ? [
            { step: "Visitor", value: growth.funnel.visitor },
            { step: "Signup", value: growth.funnel.signup },
            { step: "Upload", value: growth.funnel.upload },
            { step: "Render", value: growth.funnel.render },
            { step: "Download", value: growth.funnel.download },
            { step: "Subscribe", value: growth.funnel.subscribe }
          ]
        : [],
    [growth]
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_22%_5%,hsl(155_84%_52%/0.16),transparent_42%),radial-gradient(135%_110%_at_82%_16%,hsl(194_98%_60%/0.14),transparent_42%),linear-gradient(180deg,hsl(171_34%_9%)_0%,hsl(216_35%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[20%] h-64 w-64 rounded-full bg-emerald-300/12 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[10%] top-[34%] h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl"
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <main className="control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Growth Intelligence"
          subtitle="Funnel movement, conversion efficiency, and feature demand pressure."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load growth telemetry." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-6">
          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-emerald-200" />
                Share Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pct(growth?.viralMetrics.shareRatePct || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 text-cyan-200" />
                Download Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pct(growth?.viralMetrics.downloadRatePct || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-sky-200" />
                Return in 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pct(growth?.viralMetrics.returnIn24hPct || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-amber-200" />
                Videos / User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{(growth?.viralMetrics.averageVideosPerUser || 0).toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-lime-200" />
                Upload Completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pct(conversionIntel?.uploadCompletionPct || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-fuchsia-200" />
                Trial to Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{pct(conversionIntel?.trialToPaidConversionPct || 0)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Growth Funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-64 rounded-md border border-border/50 bg-card/35 p-2">
                {funnelSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="step" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(160 76% 45%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No funnel data available yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Generated: {formatShortTime(generatedAt)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Onboarding Drop-Off</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="h-64 rounded-md border border-border/50 bg-card/35 p-2">
                {(conversionIntel?.onboardingDropOff || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(conversionIntel?.onboardingDropOff || []).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="step" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(198 92% 60%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No onboarding drop-off events yet." />
                  </div>
                )}
              </div>
              <div className="max-h-32 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(conversionIntel?.onboardingDropOff || []).slice(0, 8).map((step) => (
                  <p key={step.step} className="mb-1">
                    {step.step}: {formatCompactNumber(step.count)} • drop {(step.dropOffPct || 0).toFixed(1)}%
                  </p>
                ))}
                {!(conversionIntel?.onboardingDropOff || []).length ? <EmptyStateNote text="No drop-off details yet." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Top Requested Features</CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 space-y-2 overflow-auto text-xs">
              {(feedbackIntel?.topRequestedFeatures || []).slice(0, 12).map((feature) => (
                <div key={feature.feature} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="line-clamp-1 font-medium">{feature.feature}</p>
                  <p className="text-muted-foreground">Requests: {formatCompactNumber(feature.count)}</p>
                </div>
              ))}
              {!(feedbackIntel?.topRequestedFeatures || []).length ? <EmptyStateNote text="No requested-feature events yet." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Feedback Clusters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border/50 bg-card/35 p-2 text-muted-foreground">
                {feedbackIntel?.supportSummary || "No support summary available."}
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/35 px-2 py-1.5">
                <span>Sentiment Score</span>
                <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-100">
                  {(feedbackIntel?.sentimentScore || 0).toFixed(2)}
                </Badge>
              </div>
              <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(feedbackIntel?.clusters || []).slice(0, 10).map((cluster) => (
                  <p key={cluster.cluster} className="mb-1">
                    {cluster.cluster} • {formatCompactNumber(cluster.count)} • {cluster.sentimentTag}
                  </p>
                ))}
                {!(feedbackIntel?.clusters || []).length ? <EmptyStateNote text="No clustered feedback yet." /> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Demand Heat + Founder Urgency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="h-36 rounded-md border border-border/50 bg-card/35 p-2">
                {(conversionIntel?.founderPlanUrgencyGraph || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={conversionIntel?.founderPlanUrgencyGraph || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="remaining" stroke="hsl(42 98% 62%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="sold" stroke="hsl(199 96% 59%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No founder urgency trend yet." />
                  </div>
                )}
              </div>

              <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(feedbackIntel?.featureDemandHeatmap || []).slice(0, 10).map((item) => (
                  <p key={item.label} className="mb-1">
                    {item.label} • {formatCompactNumber(item.count)}
                  </p>
                ))}
                {!(feedbackIntel?.featureDemandHeatmap || []).length ? <EmptyStateNote text="No feature-demand heatmap yet." /> : null}
              </div>

              <div className="max-h-20 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(conversionIntel?.pageHeatmapAnalytics || []).slice(0, 8).map((page) => (
                  <p key={page.page} className="mb-1">
                    {page.page} • {formatCompactNumber(page.count)}
                  </p>
                ))}
                {!(conversionIntel?.pageHeatmapAnalytics || []).length ? <EmptyStateNote text="No page heatmap analytics yet." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelGrowth
