import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { motion } from "framer-motion"
import { Cpu, Database, HardDrive, Radar, Server, ShieldCheck } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import {
  chartTick,
  CommandCenterResponse,
  EmptyStateNote,
  formatMoney,
  formatShortTime,
  HealthStatusResponse
} from "./control-panel/shared"
import { useAdminRealtimeStream } from "./control-panel/useAdminRealtimeStream"

const ControlPanelInfrastructure = () => {
  const { accessToken } = useAuth()
  const canLoad = Boolean(accessToken)
  const realtime = useAdminRealtimeStream(accessToken, 4000)

  const commandCenterQuery = useQuery({
    queryKey: ["control-panel-infrastructure-command-center"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000
  })

  const healthQuery = useQuery({
    queryKey: ["control-panel-infrastructure-health-status"],
    queryFn: () => apiFetch<HealthStatusResponse>("/api/admin/health-status", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 25000
  })

  const renderInfra = commandCenterQuery.data?.renderInfrastructureMonitor
  const systemHealth = commandCenterQuery.data?.systemHealth
  const costControl = commandCenterQuery.data?.costControlPanel
  const scaling = commandCenterQuery.data?.futureScalingPanel
  const queueRuntime = renderInfra?.queueRuntime
  const priorityRows = queueRuntime?.priorityDistribution || []
  const priorityMax = priorityRows.reduce((max, row) => Math.max(max, row.count), 1)
  const health = healthQuery.data
  const gpuWorker = renderInfra?.gpuWorker
  const gpuStatus = gpuWorker?.status ?? "disabled"
  const gpuStatusLabel = gpuStatus === "enabled" ? "enabled" : gpuStatus === "partial" ? "needs config" : "disabled"
  const gpuStatusTone =
    gpuStatus === "enabled"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : gpuStatus === "partial"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
      : "border-border/50 bg-card/35 text-muted-foreground"
  const gpuMode = gpuWorker?.transferMode === "urls" ? "urls" : "shared"
  const gpuModeLabel = gpuMode === "urls" ? "signed URLs" : "shared dir"
  const gpuIssueLabels: Record<string, string> = {
    missing_url: "GPU_WORKER_URL not set",
    missing_shared_dir: "GPU_WORKER_SHARED_DIR not set"
  }
  const gpuIssueText = (gpuWorker?.issues || [])
    .map((issue) => gpuIssueLabels[issue] || issue)
    .join(" • ")
  const gpuConfigItems = gpuWorker
    ? [
        { label: "Worker URL", value: gpuWorker.url || "not set" },
        { label: "Transfer Mode", value: gpuModeLabel },
        {
          label: gpuMode === "urls" ? "URL Temp Dir" : "Shared Dir",
          value: gpuMode === "urls" ? gpuWorker.urlTmpDir || "not set" : gpuWorker.sharedDir || "not set"
        },
        gpuMode === "urls"
          ? { label: "URL Expires", value: `${gpuWorker.urlExpiresSec}s` }
          : { label: "Remote Shared Dir", value: gpuWorker.sharedDirRemote || "not set" }
      ]
    : []
  const gpuTuningItems = gpuWorker
    ? [
        { label: "Utilization", value: `${(renderInfra?.gpuUtilizationPct || 0).toFixed(1)}%` },
        { label: "Parallel Segments", value: String(gpuWorker.parallelSegments) },
        { label: "Timeout", value: `${Math.round(gpuWorker.timeoutMs / 1000)}s` },
        { label: "Poll Interval", value: `${gpuWorker.pollIntervalMs}ms` },
        { label: "Fallback", value: gpuWorker.fallbackEnabled ? "enabled" : "disabled" },
        { label: "Force", value: gpuWorker.forceEnabled ? "enabled" : "disabled" },
        { label: "Keep Shared", value: gpuWorker.keepShared ? "enabled" : "disabled" }
      ]
    : []

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_80%_-10%,hsl(36_100%_55%/0.13),transparent_42%),radial-gradient(120%_120%_at_16%_14%,hsl(201_95%_58%/0.14),transparent_46%),linear-gradient(180deg,hsl(210_30%_9%)_0%,hsl(223_34%_5%)_100%)]">
      <Navbar />

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-[7%] top-[20%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute right-[7%] top-[38%] h-64 w-64 rounded-full bg-amber-300/10 blur-3xl"
          animate={{ scale: [1.06, 1, 1.06], opacity: [0.16, 0.27, 0.16] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-[1450px] px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Infrastructure Monitor"
          subtitle="Render queue health, worker load, storage posture, and scaling readiness."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to load infrastructure telemetry." />
          </div>
        ) : null}
        {canLoad ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Stream: {realtime.streamError ? "warning" : realtime.connected ? "connected" : "connecting"}{" "}
            {realtime.payload?.t ? `• ${formatShortTime(realtime.payload.t)}` : ""}
          </p>
        ) : null}

        <section className="mt-4 grid gap-4 xl:grid-cols-4">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Server className="h-4 w-4 text-sky-200" />
                Queue Depth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{realtime.payload?.jobsInQueue || renderInfra?.activeJobsInQueue || systemHealth?.renderQueueLength || 0}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Radar className="h-4 w-4 text-cyan-200" />
                Avg Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{(renderInfra?.avgProcessingTimeSec || 0).toFixed(1)}s</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-emerald-200" />
                CPU / GPU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {(renderInfra?.cpuUtilizationPct || systemHealth?.cpuUsagePct || 0).toFixed(1)}% / {(renderInfra?.gpuUtilizationPct || 0).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-amber-200" />
                Cost / Render
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatMoney(renderInfra?.costPerRenderEstimateUsd || costControl?.costPerRenderUsd || 0)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-emerald-200" />
                GPU Offload
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {!gpuWorker ? (
                <EmptyStateNote text="GPU worker telemetry is not available yet." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-2">
                    <p className={`rounded-md border p-2 ${gpuStatusTone}`}>GPU worker: {gpuStatusLabel}</p>
                    {gpuIssueText ? (
                      <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-[11px] text-amber-100">
                        {gpuIssueText}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      {gpuConfigItems.map((item) => (
                        <div key={`gpu-config-${item.label}`} className="rounded-md border border-border/50 bg-card/40 p-2">
                          <p className="text-muted-foreground">{item.label}</p>
                          <p className="text-[12px] font-semibold text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {gpuTuningItems.map((item) => (
                      <div key={`gpu-tune-${item.label}`} className="rounded-md border border-border/50 bg-card/40 p-2">
                        <p className="text-muted-foreground">{item.label}</p>
                        <p className="text-[12px] font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Queue Runtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Effective concurrency</p>
                  <p className="text-xl font-semibold">{queueRuntime?.maxPipelines || 0}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Worker replicas</p>
                  <p className="text-xl font-semibold">{queueRuntime?.workerReplicas || 1}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Target concurrency</p>
                  <p className="text-sm font-semibold">{queueRuntime?.targetConcurrency ?? "auto"}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">JOB_CONCURRENCY override</p>
                  <p className="text-sm font-semibold">{queueRuntime?.jobConcurrencyOverride ?? "none"}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Queue depth snapshot: {queueRuntime?.queueDepth ?? renderInfra?.activeJobsInQueue ?? systemHealth?.renderQueueLength ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {priorityRows.length ? (
                <div className="space-y-3">
                  {priorityRows.map((row) => {
                    const widthPct = priorityMax > 0 ? Math.max(4, Math.round((row.count / priorityMax) * 100)) : 0
                    return (
                      <div key={`queue-priority-${row.label}`} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="uppercase tracking-[0.18em]">{row.label}</span>
                          <span className="text-foreground">{row.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/35">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyStateNote text="No queued jobs right now." />
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Failed Render Reasons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-64 rounded-md border border-border/50 bg-card/35 p-2">
                {(renderInfra?.failedRenders || systemHealth?.failedJobs || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(renderInfra?.failedRenders || systemHealth?.failedJobs || []).slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="reason" stroke="hsl(var(--muted-foreground))" interval={0} angle={-15} height={62} textAnchor="end" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(13 90% 60%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No failed-render groups yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Generated: {formatShortTime(commandCenterQuery.data?.generatedAt)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Storage + Cost Trajectory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">R2 Usage</p>
                  <p className="text-xl font-semibold">
                    {(renderInfra?.storageUsage.gb || systemHealth?.r2StorageUsage.gb || 0).toFixed(2)} GB
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {renderInfra?.storageUsage.objects || systemHealth?.r2StorageUsage.objects || 0} objects
                  </p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="text-muted-foreground">Storage Utilization</p>
                  <p className="text-xl font-semibold">{(renderInfra?.storageUsage.pct || 0).toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(renderInfra?.storageUsage.estimated || systemHealth?.r2StorageUsage.estimated) ? "estimated" : "direct"}
                  </p>
                </div>
              </div>

              <div className="h-40 rounded-md border border-border/50 bg-card/35 p-2">
                {(costControl?.storageCostTrend || []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={costControl?.storageCostTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="v" stroke="hsl(205 92% 60%)" fill="hsl(205 92% 60% / 0.3)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No storage-cost trend data yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cost / User {formatMoney(costControl?.costPerUserUsd || 0)} • Burn Rate {formatMoney(costControl?.infrastructureBurnRateUsdMonthly || 0)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Health Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className={`rounded-md border p-2 ${health?.status === "healthy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-rose-500/30 bg-rose-500/10 text-rose-100"}`}>
                Overall: {health?.status || "unknown"}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Backend: {health?.backend.ok ? "ok" : "degraded"} • queue {health?.backend.queueDepth || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Frontend: {health?.frontend.ok ? "ok" : "degraded"} • latency {(health?.frontend.latencyMs || 0).toFixed(1)}ms
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Storage: {health?.storage.provider || "unknown"} • {health?.storage.ok ? "ok" : "degraded"}
              </p>
              <p className="text-[11px] text-muted-foreground">Checked: {formatShortTime(health?.checkedAt)}</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Scaling Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Multi-region deploy: {scaling?.multiRegionDeployEnabled ? "enabled" : "disabled"}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                CDN health: {scaling?.cdnHealth.ok ? "healthy" : "not configured"}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Cache hit rate: {(scaling?.cacheHitRatePct || 0).toFixed(1)}%
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Queue thresholds: up {scaling?.queueScalingThresholds.scaleUpAt || 0}, down {scaling?.queueScalingThresholds.scaleDownAt || 0}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Worker trigger: {scaling?.autoScaleWorkerTriggers.active ? `active (${scaling?.autoScaleWorkerTriggers.suggestedWorkers} workers)` : "idle"}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <HardDrive className="h-4 w-4 text-sky-200" />
                Worker + Webhook Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Worker: {systemHealth?.workerStatus.online ? "online" : "offline"} • {systemHealth?.workerStatus.status || "unknown"}
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Uptime: {(((systemHealth?.workerStatus.uptimeSeconds || 0) / 60) / 60).toFixed(1)}h
              </p>
              <p className="rounded-md border border-border/50 bg-card/35 p-2">
                Stripe webhook: {systemHealth?.stripeWebhookStatus.ok ? "healthy" : "degraded"} • events 24h {systemHealth?.stripeWebhookStatus.events24h || 0}
              </p>
              <p className={`rounded-md border p-2 ${renderInfra?.processingTimeSpikeAlert.active ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"}`}>
                Spike alert: {renderInfra?.processingTimeSpikeAlert.active ? renderInfra?.processingTimeSpikeAlert.severity : "normal"}
              </p>
              <Badge className="border-sky-300/30 bg-sky-400/15 text-sky-100">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Runtime monitored
              </Badge>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelInfrastructure
