import type { LiveGeoHeatmapPoint } from "@/components/control-panel/LiveUsersGlobe"

export type SiteLiveResponse = {
  activeUsers: number
  impressionsLast5m: number
  impressionsLast60m: number
  impressionsLast24h: number
  series: Array<{ t: string; v: number }>
  updatedAt: string
}

export type LiveGeoResponse = {
  activeUsers: number
  geoHeatmap: LiveGeoHeatmapPoint[]
  updatedAt: string
}

export type AdminRealtimeLiveUsers = {
  usersOnSite: number
  usersRendering: number
  usersExporting: number
  averageSessionMinutes: number
}

export type AdminRealtimePayload = {
  activeUsers: number
  connectedRealtimeClients?: number
  jobsInQueue: number
  jobsFailed24h: number
  websiteImpressions5m?: number
  websiteImpressions24h?: number
  liveUsers?: AdminRealtimeLiveUsers
  t: string
}

export type SecurityResponse = {
  score: number
  riskLevel: "low" | "medium" | "high"
  checks: Array<{
    key: string
    label: string
    ok: boolean
    detail: string
  }>
  generatedAt: string
}

export type IpBansResponse = {
  items: Array<{
    ip: string
    reason: string | null
    createdBy: string | null
    active: boolean
    expiresAt: string | null
    createdAt: string | null
    updatedAt: string | null
  }>
  updatedAt: string
}

export type HealthStatusResponse = {
  status: "healthy" | "degraded"
  checkedAt: string
  backend: {
    ok: boolean
    db: string
    uptimeSeconds: number
    queueDepth: number
    memory: {
      rss: number
      heapUsed: number
      heapTotal: number
    }
  }
  frontend: {
    ok: boolean
    statusCode: number | null
    latencyMs: number
    url: string | null
    error?: string
  }
  storage: {
    provider: string
    ok: boolean
    details?: Record<string, unknown> | null
  }
}

export type CommandCenterResponse = {
  generatedAt: string
  systemHealth: {
    cpuUsagePct: number
    renderQueueLength: number
    failedJobs: Array<{ reason: string; count: number }>
    memoryUsage: {
      rssMb: number
      heapUsedMb: number
      heapTotalMb: number
      systemUsedPct: number
    }
    workerStatus: {
      online: boolean
      uptimeSeconds: number
      status: string
    }
    r2StorageUsage: {
      provider: string
      gb: number
      objects: number
      estimated: boolean
    }
    stripeWebhookStatus: {
      ok: boolean
      lastEventAt: string | null
      events24h: number
    }
  }
  liveUsers: {
    usersOnSite: number
    usersRendering: number
    usersExporting: number
    averageSessionMinutes: number
  }
  growth: {
    viralMetrics: {
      shareRatePct: number
      downloadRatePct: number
      returnIn24hPct: number
      averageVideosPerUser: number
    }
    funnel: {
      visitor: number
      signup: number
      upload: number
      render: number
      download: number
      subscribe: number
    }
  }
  securityAbuse: {
    suspiciousActivityScore: number
    massiveUploadUsers: Array<{ userId: string; count: number }>
    multipleAccountsFromSameIp: Array<{ ip: string; accounts: number }>
    tokenAbuseSignals: Array<{ ip: string; count: number }>
    stripeFraudFlags: Array<{ eventId: string; type: string; createdAt: string }>
    abnormalUsagePatterns: Array<{ userId: string; jobs: number }>
  }
  renderInfrastructureMonitor?: {
    activeJobsInQueue: number
    avgProcessingTimeSec: number
    failedRenders: Array<{ reason: string; count: number }>
    workerHealth: { online: boolean; status: string; uptimeSeconds: number }
    r2UploadStatus: { ok: boolean; provider: string; failedUploads24h: number; note: string }
    storageUsage: { gb: number; pct: number; objects: number; estimated: boolean }
    costPerRenderEstimateUsd: number
    cpuUtilizationPct: number
    gpuUtilizationPct: number
    processingTimeSpikeAlert: {
      active: boolean
      severity: "normal" | "elevated" | "critical"
      ratio: number
      currentSec: number
      baselineSec: number
    }
  }
  liveErrorTerminal?: {
    backendLogCount24h: number
    frontendErrorCount24h: number
    api401Count24h: number
    api500Count24h: number
    mostCommonErrorTypes: Array<{ type: string; count: number }>
    groupedErrors: Array<{ type: string; count: number; severity: string; lastSeen: string }>
    fixSuggestion: string
  }
  userIntelligencePanel?: {
    activeUsers: number
    geoHeatmap: LiveGeoHeatmapPoint[]
    planBreakdown: Record<string, number>
    topUsersByRenders: Array<{
      userId: string
      email: string | null
      renders: number
      planTier: string
      usagePct: number
    }>
    suspiciousActivityFlag: boolean
    abuseDetection: Array<{ userId: string; jobs: number }>
    averageWatchLengthSec: number
    whaleDetector: Array<{
      userId: string
      email: string | null
      planTier: string
      usagePct: number
      upgradeLikelihood: number
    }>
  }
  feedbackIntelligence?: {
    clusters: Array<{ cluster: string; count: number; sentimentTag: string }>
    topRequestedFeatures: Array<{ feature: string; count: number }>
    sentimentScore: number
    supportSummary: string
    featureDemandHeatmap: Array<{ label: string; count: number }>
  }
  costControlPanel?: {
    costPerUserUsd: number
    costPerRenderUsd: number
    storageCostTrend: Array<{ t: string; v: number }>
    infrastructureBurnRateUsdMonthly: number
    profitMarginPct: number
    runwayMonths: number
  }
  securityPanel?: {
    adminAccessLogs: Array<{
      id: string
      actor: string | null
      action: string | null
      reason: string | null
      createdAt: string
    }>
    suspiciousLoginAttempts: number
    apiAbuseMonitor: Array<{ ip: string; count: number }>
    rateLimitMonitor: {
      alerts: Array<{ label: string; count: number }>
      status429Count24h: number
    }
    tokenExpirationTracking: {
      nearingTimeoutSessions: number
      staleSessions: number
    }
    r2KeyUsageLog: {
      provider: string
      configured: boolean
      lastCheckAt: string
    }
    webhookVerificationStatus: {
      configured: boolean
      healthy: boolean
      lastEventAt: string | null
    }
  }
  conversionIntelligence?: {
    onboardingDropOff: Array<{ step: string; count: number; dropOffPct: number }>
    uploadCompletionPct: number
    trialToPaidConversionPct: number
    founderPlanUrgencyGraph: Array<{ t: string; remaining: number; sold: number }>
    pageHeatmapAnalytics: Array<{ page: string; count: number }>
  }
  futureScalingPanel?: {
    multiRegionDeployEnabled: boolean
    cdnHealth: { configured: boolean; url: string | null; ok: boolean }
    cacheHitRatePct: number
    queueScalingThresholds: { scaleUpAt: number; scaleDownAt: number }
    autoScaleWorkerTriggers: { active: boolean; suggestedWorkers: number }
  }
}

export const formatShortTime = (iso?: string | null) => {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  )

export const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0
  )

export const chartTick = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export const EmptyStateNote = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed border-border/55 bg-card/25 px-3 py-2 text-[11px] text-muted-foreground">
    {text}
  </div>
)
