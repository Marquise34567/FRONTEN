import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { motion } from "framer-motion"
import { AlertTriangle, Ban, ShieldAlert, ShieldCheck, Siren, Users } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import {
  CommandCenterResponse,
  EmptyStateNote,
  formatCompactNumber,
  formatShortTime,
  IpBansResponse,
  SecurityResponse
} from "./control-panel/shared"

const riskBadgeClass: Record<SecurityResponse["riskLevel"], string> = {
  low: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  medium: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  high: "border-rose-400/40 bg-rose-500/10 text-rose-100"
}

const ControlPanelSecurity = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)

  const commandCenterQuery = useQuery({
    queryKey: ["control-panel-security-command-center"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const securityQuery = useQuery({
    queryKey: ["control-panel-security-score"],
    queryFn: () => apiFetch<SecurityResponse>("/api/admin/security", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 25000
  })

  const ipBansQuery = useQuery({
    queryKey: ["control-panel-security-ip-bans"],
    queryFn: () => apiFetch<IpBansResponse>("/api/admin/ip-bans", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000
  })

  const securityPanel = commandCenterQuery.data?.securityPanel
  const abuse = commandCenterQuery.data?.securityAbuse
  const liveTerminal = commandCenterQuery.data?.liveErrorTerminal

  const activeBans = (ipBansQuery.data?.items || []).filter((item) => item.active)
  const tokenAbuseBars = (abuse?.tokenAbuseSignals || []).slice(0, 8)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_14%_8%,hsl(359_95%_60%/0.15),transparent_42%),radial-gradient(130%_120%_at_84%_18%,hsl(33_100%_55%/0.12),transparent_42%),linear-gradient(180deg,hsl(223_34%_9%)_0%,hsl(232_42%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[10%] top-[18%] h-64 w-64 rounded-full bg-rose-400/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[10%] top-[36%] h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
          animate={{ scale: [1.06, 1, 1.06], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Security Command"
          subtitle="Risk score, abuse signals, ban controls, and live error exposure."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load security telemetry." />
          </div>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-4">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-rose-200" />
                Security Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{(securityQuery.data?.score || 0).toFixed(0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Siren className="h-4 w-4 text-amber-200" />
                Risk Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={riskBadgeClass[securityQuery.data?.riskLevel || "low"]}>
                {(securityQuery.data?.riskLevel || "low").toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-200" />
                Suspicious Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatCompactNumber(abuse?.suspiciousActivityScore || 0)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Ban className="h-4 w-4 text-rose-200" />
                Active Bans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{activeBans.length}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Security Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(securityQuery.data?.checks || []).slice(0, 10).map((check) => (
                <div
                  key={check.key}
                  className={`rounded-md border p-2 ${
                    check.ok ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100" : "border-rose-500/35 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  <p className="font-medium">{check.label}</p>
                  <p className="text-[11px] opacity-90">{check.detail}</p>
                </div>
              ))}
              {!(securityQuery.data?.checks || []).length ? <EmptyStateNote text="No security checks returned." /> : null}
              <p className="text-[11px] text-muted-foreground">Generated: {formatShortTime(securityQuery.data?.generatedAt)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Token Abuse Monitor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="h-64 rounded-md border border-border/50 bg-card/35 p-2">
                {tokenAbuseBars.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tokenAbuseBars}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="ip" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(355 90% 62%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No token abuse rows detected." />
                  </div>
                )}
              </div>
              <div className="max-h-28 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(abuse?.multipleAccountsFromSameIp || []).slice(0, 8).map((row) => (
                  <p key={row.ip} className="mb-1">
                    {row.ip} • {row.accounts} accounts
                  </p>
                ))}
                {!(abuse?.multipleAccountsFromSameIp || []).length ? <EmptyStateNote text="No multi-account IP overlaps." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Rate Limits + Session Expiry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                429 responses (24h): {securityPanel?.rateLimitMonitor.status429Count24h || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Nearing timeout sessions: {securityPanel?.tokenExpirationTracking.nearingTimeoutSessions || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Stale sessions: {securityPanel?.tokenExpirationTracking.staleSessions || 0}
              </p>
              <p className={`rounded-md border p-2 ${securityPanel?.webhookVerificationStatus.healthy ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100" : "border-rose-500/35 bg-rose-500/10 text-rose-100"}`}>
                Webhook verification: {securityPanel?.webhookVerificationStatus.healthy ? "healthy" : "degraded"}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Key provider: {securityPanel?.r2KeyUsageLog.provider || "unknown"} • configured {securityPanel?.r2KeyUsageLog.configured ? "yes" : "no"}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-sky-200" />
                Admin Access + API Abuse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="max-h-36 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(securityPanel?.adminAccessLogs || []).slice(0, 8).map((log) => (
                  <p key={log.id} className="mb-1 line-clamp-1">
                    {log.action || "action"} • {log.actor || "unknown"} • {formatShortTime(log.createdAt)}
                  </p>
                ))}
                {!(securityPanel?.adminAccessLogs || []).length ? <EmptyStateNote text="No admin access logs available." /> : null}
              </div>
              <div className="max-h-28 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(securityPanel?.apiAbuseMonitor || []).slice(0, 8).map((row) => (
                  <p key={row.ip} className="mb-1">
                    {row.ip} • {row.count}
                  </p>
                ))}
                {!(securityPanel?.apiAbuseMonitor || []).length ? <EmptyStateNote text="No API abuse rows detected." /> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Live Error Threat Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Backend logs 24h: {liveTerminal?.backendLogCount24h || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Frontend errors 24h: {liveTerminal?.frontendErrorCount24h || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                API 401 / 500: {liveTerminal?.api401Count24h || 0} / {liveTerminal?.api500Count24h || 0}
              </p>
              <div className="max-h-24 overflow-auto rounded-md border border-border/50 bg-card/35 p-2">
                {(liveTerminal?.groupedErrors || []).slice(0, 7).map((item, idx) => (
                  <p key={`${item.type}-${idx}`} className="mb-1 line-clamp-1">
                    {item.severity.toUpperCase()} • {item.type} ({item.count})
                  </p>
                ))}
                {!(liveTerminal?.groupedErrors || []).length ? <EmptyStateNote text="No grouped errors in feed." /> : null}
              </div>
              <p className="rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-amber-100">
                AI fix suggestion: {liveTerminal?.fixSuggestion || "No immediate fix suggestion."}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Active IP Bans
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-44 space-y-2 overflow-auto text-xs">
              {activeBans.map((item) => (
                <div key={`${item.ip}-${item.createdAt || item.updatedAt || "na"}`} className="rounded-md border border-border/50 bg-card/35 p-2">
                  <p className="font-medium">{item.ip}</p>
                  <p className="text-muted-foreground">
                    Reason: {item.reason || "none"} • Expires: {formatShortTime(item.expiresAt)}
                  </p>
                </div>
              ))}
              {!activeBans.length ? <EmptyStateNote text="No active IP bans currently." /> : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelSecurity
