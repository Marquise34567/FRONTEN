import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { motion } from "framer-motion"
import { Banknote, Landmark, ShieldCheck, TrendingUp, Vault } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"

type PaymentsResponse = {
  revenueTotal: number
  recentPayments: Array<{
    eventId: string
    amount: number
    currency: string
    status: string
    createdAt: string
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

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  )

const shortDate = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "--"
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const EmptyStateTile = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed border-slate-700/80 bg-slate-900/45 px-3 py-2 text-center text-[11px] text-slate-400">
    {text}
  </div>
)

const ControlPanelBank = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)

  const paymentsQuery = useQuery({
    queryKey: ["control-panel-bank-payments"],
    queryFn: () => apiFetch<PaymentsResponse>("/api/admin/payments?range=30d", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000
  })

  const subscriptionsQuery = useQuery({
    queryKey: ["control-panel-bank-subscriptions"],
    queryFn: () => apiFetch<SubscriptionsResponse>("/api/admin/subscriptions?range=30d", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000
  })

  const planDistribution = subscriptionsQuery.data?.distribution
  const planPie = useMemo(
    () => [
      { name: "Free", value: planDistribution?.free || 0, fill: "hsl(215 22% 68%)" },
      { name: "Starter", value: planDistribution?.starter || 0, fill: "hsl(196 86% 54%)" },
      { name: "Pro", value: planDistribution?.pro || 0, fill: "hsl(170 72% 46%)" },
      { name: "Founder", value: planDistribution?.founder || 0, fill: "hsl(43 96% 56%)" }
    ],
    [planDistribution]
  )
  const revenueSeries = paymentsQuery.data?.revenueByDay || []
  const subscriptionTrend = subscriptionsQuery.data?.trend || []
  const hasPlanMixData = planPie.some((item) => item.value > 0)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(130%_120%_at_75%_-20%,hsl(45_96%_56%/0.16),transparent_40%),radial-gradient(140%_120%_at_20%_110%,hsl(162_72%_45%/0.18),transparent_44%),linear-gradient(180deg,hsl(195_28%_8%)_0%,hsl(207_30%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[8%] top-[12%] h-64 w-64 rounded-full bg-amber-300/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[10%] top-[38%] h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl"
          animate={{ scale: [1.05, 1, 1.05], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
      </div>

      <main className="control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="The Bank"
          subtitle="Monetized command layer for revenue, subscriptions, and financial performance signals."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateTile text="Sign in to load bank telemetry and finance panels." />
          </div>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mt-4 grid gap-4 xl:grid-cols-4"
        >
          <Card className="glass-card border-amber-300/25 bg-slate-950/60 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-100">
                <Landmark className="h-5 w-5 text-amber-300" />
                Monet Vault
                <Badge className="border-amber-300/30 bg-amber-400/15 text-amber-100">Finance Ops</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Revenue 30d</p>
                <p className="text-2xl font-semibold text-slate-100">{money(paymentsQuery.data?.revenueTotal || 0)}</p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Active Subs</p>
                <p className="text-2xl font-semibold text-slate-100">{subscriptionsQuery.data?.activeSubscriptions || 0}</p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Refunds/Chargebacks</p>
                <p className="text-2xl font-semibold text-slate-100">{paymentsQuery.data?.refundsOrChargebacks.length || 0}</p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Churn Count</p>
                <p className="text-2xl font-semibold text-slate-100">{subscriptionsQuery.data?.churnCount || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-600/70 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                <Vault className="h-4 w-4 text-cyan-300" />
                Vault Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Recent successful payments: {paymentsQuery.data?.recentPayments.length || 0}
              </p>
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Last payment event: {paymentsQuery.data?.recentPayments[0]?.eventId || "none"}
              </p>
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Security posture: protected by signed webhook + server auth.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-600/70 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Revenue Safety
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Refund ratio:{" "}
                {(() => {
                  const refunds = paymentsQuery.data?.refundsOrChargebacks.length || 0
                  const payments = paymentsQuery.data?.recentPayments.length || 0
                  if (!payments) return "0%"
                  return `${((refunds / payments) * 100).toFixed(1)}%`
                })()}
              </p>
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Churn indicator: {subscriptionsQuery.data?.churnCount || 0} recent churn events.
              </p>
              <p className="rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-slate-300">
                Financial signal quality: {canLoad ? "live" : "offline"}
              </p>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className="mt-4 grid gap-4 xl:grid-cols-3"
        >
          <Card className="glass-card border-slate-600/70 bg-slate-950/60 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                <TrendingUp className="h-4 w-4 text-sky-300" />
                Revenue Curve
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {revenueSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries}>
                    <CartesianGrid stroke="hsl(216 18% 24% / 0.55)" vertical={false} />
                    <XAxis dataKey="t" tickFormatter={shortDate} stroke="hsl(215 17% 67%)" />
                    <YAxis stroke="hsl(215 17% 67%)" />
                    <Tooltip
                      contentStyle={{ background: "rgba(2, 6, 23, 0.92)", border: "1px solid rgba(148, 163, 184, 0.35)" }}
                      labelFormatter={(label) => shortDate(String(label))}
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="hsl(193 90% 57%)"
                      fill="url(#revenueFill)"
                      strokeWidth={2.5}
                    />
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(193 90% 57% / 0.42)" />
                        <stop offset="100%" stopColor="hsl(193 90% 57% / 0.03)" />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateTile text="No revenue trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-600/70 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                <Banknote className="h-4 w-4 text-amber-300" />
                Plan Mix
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {hasPlanMixData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} />
                    <Tooltip
                      contentStyle={{ background: "rgba(2, 6, 23, 0.92)", border: "1px solid rgba(148, 163, 184, 0.35)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateTile text="No plan-mix data yet." />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
          className="mt-4 grid gap-4 xl:grid-cols-2"
        >
          <Card className="glass-card border-slate-600/70 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-sm text-slate-100">Subscription Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {subscriptionTrend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subscriptionTrend}>
                    <CartesianGrid stroke="hsl(216 18% 24% / 0.55)" vertical={false} />
                    <XAxis dataKey="t" tickFormatter={shortDate} stroke="hsl(215 17% 67%)" />
                    <YAxis stroke="hsl(215 17% 67%)" />
                    <Tooltip
                      contentStyle={{ background: "rgba(2, 6, 23, 0.92)", border: "1px solid rgba(148, 163, 184, 0.35)" }}
                      labelFormatter={(label) => shortDate(String(label))}
                    />
                    <Bar dataKey="v" fill="hsl(169 74% 43%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateTile text="No subscription trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-slate-600/70 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="text-sm text-slate-100">Recent Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(paymentsQuery.data?.recentPayments || []).slice(0, 8).map((payment) => (
                <div key={payment.eventId} className="rounded-md border border-slate-700/80 bg-slate-900/70 p-2">
                  <p className="line-clamp-1 text-slate-200">{payment.eventId}</p>
                  <p className="text-slate-400">
                    {money(payment.amount / 100)} {String(payment.currency || "usd").toUpperCase()} • {payment.status}
                  </p>
                </div>
              ))}
              {!paymentsQuery.data?.recentPayments.length ? (
                <EmptyStateTile text="No recent payment records yet." />
              ) : null}
            </CardContent>
          </Card>
        </motion.section>
      </main>
    </div>
  )
}

export default ControlPanelBank
