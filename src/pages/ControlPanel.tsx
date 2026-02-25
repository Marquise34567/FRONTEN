import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "@/components/Navbar";
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav";
import LiveUsersGlobe, { type LiveGeoHeatmapPoint } from "@/components/control-panel/LiveUsersGlobe";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch } from "@/lib/api";
import { getControlPanelPassword } from "@/lib/controlPanelAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Activity, DollarSign, Users, Layers, Timer, Globe2, Ban, Mail, Send, Crown, Cpu, HardDrive, Sparkles, ShieldAlert, Rocket, Wand2, RefreshCw } from "lucide-react";

type OverviewResponse = {
  summary: {
    activeUsers: number;
    jobsInQueue: number;
    jobsFailed24h: number;
    revenue7d: number;
    activeSubscriptions: number;
    avgRenderTime: number;
    successRate: number;
    usersTotal?: number;
    websiteImpressions24h?: number;
    websiteImpressions5m?: number;
  };
  graphs: {
    activeUsers: Array<{ t: string; v: number }>;
    websiteImpressions?: Array<{ t: string; v: number }>;
    jobSuccessVsFailure: Array<{ t: string; success: number; failure: number }>;
    jobFailureRate: Array<{ t: string; v: number }>;
    renderTimeAvg: Array<{ t: string; v: number }>;
    revenue: Array<{ t: string; v: number }>;
  };
  updatedAt: string;
};

type ErrorsResponse = {
  items: Array<{
    id: string;
    severity: string;
    message: string;
    endpoint: string | null;
    route: string | null;
    stackSnippet: string | null;
    userId?: string | null;
    jobId?: string | null;
    planTier?: string;
    browser?: string | null;
    videoSizeMb?: number | null;
    retryable?: boolean;
    count: number;
    createdAt?: string;
    lastSeen: string;
  }>;
};

type RealtimeUsersResponse = {
  activeUsers: number;
  sessions: Array<{
    sessionId: string;
    userId: string;
    email: string | null;
    connectedAt: string;
    lastSeen: string;
    ip: string | null;
  }>;
  updatedAt: string;
};

type PaymentsResponse = {
  revenueTotal: number;
  recentPayments: Array<{
    eventId: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    userId?: string | null;
  }>;
  refundsOrChargebacks: Array<{
    eventId: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  revenueByDay: Array<{ t: string; v: number }>;
};

type SubscriptionsResponse = {
  distribution: {
    free: number;
    starter: number;
    pro: number;
    founder: number;
  };
  activeSubscriptions: number;
  churnCount: number;
  trend: Array<{ t: string; v: number }>;
  upcomingRenewals: Array<{
    userId: string | null;
    planTier: string;
    currentPeriodEnd: string | null;
  }>;
};

type InsightsResponse = {
  aggregates: {
    commonFailureReasons: Array<{ reason: string; count: number }>;
    slowestPipelineSteps: Array<{ step: string; avgSeconds: number; samples: number }>;
    averageUploadToRenderSeconds: number;
    abandonmentPoints: number;
    qualityComplaintsCount: number;
  };
  topDropOffPoints: Array<{ label: string; count: number }>;
  mostRequestedFeatures: Array<{ feature: string; count: number }>;
  suggestedPipelineUpgrades: Array<{
    title: string;
    expectedImpact: string;
    difficulty: string;
    priority: number;
  }>;
};

type FeedbackResponse = {
  sentimentCounts: Record<string, number>;
  topIssues: Array<{ issue: string; count: number }>;
  items: Array<{
    id: string;
    source: string;
    category: string;
    sentiment: "positive" | "negative" | "bug" | "request";
    note: string | null;
    createdAt: string;
    jobId: string | null;
  }>;
};

type LiveRealtimePayload = {
  activeUsers: number;
  jobsInQueue: number;
  jobsFailed24h: number;
  websiteImpressions5m?: number;
  websiteImpressions24h?: number;
  t: string;
};

type SiteLiveResponse = {
  activeUsers: number;
  impressionsLast5m: number;
  impressionsLast60m: number;
  impressionsLast24h: number;
  series: Array<{ t: string; v: number }>;
  updatedAt: string;
};

type LiveGeoResponse = {
  activeUsers: number;
  geoHeatmap: LiveGeoHeatmapPoint[];
  updatedAt: string;
};

type HealthStatusResponse = {
  status: "healthy" | "degraded";
  checkedAt: string;
  backend: {
    ok: boolean;
    db: string;
    uptimeSeconds: number;
    startedAt: string;
    queueDepth: number;
    nodeVersion: string;
    platform: string;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
  frontend: {
    ok: boolean;
    statusCode: number | null;
    latencyMs: number;
    url: string | null;
    error?: string;
  };
  storage: {
    provider: string;
    ok: boolean;
    details?: Record<string, unknown> | null;
  };
};

type SecurityResponse = {
  score: number;
  riskLevel: "low" | "medium" | "high";
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  generatedAt: string;
};

type IpBansResponse = {
  items: Array<{
    ip: string;
    reason: string | null;
    createdBy: string | null;
    active: boolean;
    expiresAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  updatedAt: string;
};

type WeeklyReportsResponse = {
  provider: {
    configured: boolean;
    provider: string;
  };
  subscriptions: Array<{
    id: string;
    email: string;
    enabled: boolean;
    createdBy: string | null;
    lastSentAt: string | null;
    nextSendAt: string | null;
    lastError: string | null;
  }>;
  updatedAt: string;
};

type FeatureLabControls = {
  hookLogicMode: "stable" | "experimental";
  subtitleEngineMode: "v1" | "v2";
  maxUploadSizeMb: number;
  aiIntensity: number;
  watermarkOverride: "auto" | "force_on" | "force_off";
  retentionAlgorithmMode: "adaptive_v3" | "emotional_focus" | "safe_mode";
  zoomIntensityLevel: "low" | "medium" | "high";
  emotionalDetectionThreshold: number;
  retentionModelVariant: "v1" | "v2";
  updatedAt: string;
  updatedBy?: string | null;
};

type CommandCenterResponse = {
  generatedAt: string;
  systemHealth: {
    cpuUsagePct: number;
    memoryUsage: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      systemUsedPct: number;
    };
    renderQueueLength: number;
    failedJobs: Array<{ reason: string; count: number }>;
    workerStatus: {
      online: boolean;
      uptimeSeconds: number;
      status: string;
    };
    r2StorageUsage: {
      provider: string;
      bytes: number;
      gb: number;
      objects: number;
      estimated: boolean;
      note?: string;
      error?: string;
    };
    stripeWebhookStatus: {
      ok: boolean;
      lastEventAt: string | null;
      events24h: number;
    };
  };
  liveUsers: {
    usersOnSite: number;
    usersRendering: number;
    usersExporting: number;
    averageSessionMinutes: number;
    map: Array<{
      country: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      sessions: number;
      users: number;
    }>;
  };
  revenue: {
    mrr: number;
    arrProjection: number;
    churnRatePct: number;
    ltv: number;
    cacEstimate: number;
    activeSubscriptionsByTier: Record<string, number>;
    founderPlanRemainingSlots: number;
    stripeBreakdown: {
      failedPayments: number;
      upcomingRenewals: number;
      refunds: number;
      revenueByPlan: Record<string, number>;
    };
  };
  editorPerformance: {
    renderIntelligence: {
      averageRenderTimeSec: number;
      averageFileSizeMb: number;
      averageRetentionScore: number;
    };
    featureUsage: {
      subtitlesPct: number;
      hookDetectionPct: number;
      autoZoomPct: number;
      verticalModePct: number;
    };
    aiQuality: {
      averageUserRating: number;
      feedbackHeatmap: Array<{ label: string; count: number }>;
      dropOffPredictionAccuracyPct: number;
      hookSuccessRatePct: number;
    };
  };
  errors: {
    backendErrors: number;
    frontendJsErrors: number;
    failedUploads24h: number;
    failedWebhooks24h: number;
    authFailures24h: number;
    apiLatencySpikes: Array<{ endpoint: string; samples: number; avgMs: number; p95Ms: number }>;
    items: Array<{
      id: string;
      severity: string;
      message: string;
      stackSnippet: string | null;
      route: string | null;
      endpoint: string | null;
      userId: string | null;
      jobId: string | null;
      count: number;
      createdAt: string;
      lastSeen: string;
      planTier: string;
      browser: string | null;
      videoSizeMb: number | null;
      retryable: boolean;
    }>;
  };
  growth: {
    viralMetrics: {
      shareRatePct: number;
      downloadRatePct: number;
      returnIn24hPct: number;
      averageVideosPerUser: number;
    };
    funnel: {
      visitor: number;
      signup: number;
      upload: number;
      render: number;
      download: number;
      subscribe: number;
    };
  };
  securityAbuse: {
    suspiciousActivityScore: number;
    massiveUploadUsers: Array<{ userId: string; count: number }>;
    multipleAccountsFromSameIp: Array<{ ip: string; accounts: number }>;
    tokenAbuseSignals: Array<{ ip: string; count: number }>;
    stripeFraudFlags: Array<{ eventId: string; type: string; createdAt: string }>;
    abnormalUsagePatterns: Array<{ userId: string; jobs: number }>;
  };
  featureLab: {
    controls: FeatureLabControls;
  };
  aiBrain: {
    topPerformingHooksThisWeek: Array<{ text: string; uses: number; avgScore: number }>;
    emotionallyEffectiveCuts: Array<{ pattern: string; count: number; avgScore: number }>;
    bestEmotionalPacingPattern: string;
    videoScoreDistributionCurve: Array<{ label: string; count: number }>;
    autoSuggestions: string[];
  };
  founderEgo: {
    totalMinutesProcessed: number;
    totalVideosExported: number;
    estimatedTimeSavedHours: number;
    totalGbProcessed: number;
    mostViralGeneratedClip: {
      jobId: string;
      score: number;
      hook: string | null;
    } | null;
  };
  aiIntelligenceDashboard?: {
    retentionPredictionEngine: {
      avgPredictedRetentionScorePerRender: number;
      hookStrengthScore: number;
      emotionalIntensityGraph: Array<{ t: string; v: number }>;
      boringSegmentHeatmap: Array<{ segment: string; v: number }>;
      strongHooksPct: number;
      avgFirst8SecEngagementScore: number;
      dropOffRiskPredictionPct: number;
    };
    retentionBrainMap: Array<{
      t: string;
      hook: number;
      emotionalSpike: number;
      patternInterrupt: number;
      zoomBurst: number;
      captionImpact: number;
      predictedAttention: number;
    }>;
  };
  revenueCommandCenter?: {
    mrr: number;
    arrProjection: number;
    founderPlanSalesCount: number;
    founderPlanAutoRemoveAt: number;
    founderPlanRemainingSlots: number;
    founderPlanSoldOut: boolean;
    churnRatePct: number;
    upgradeConversionRatePct: number;
    failedPaymentAlerts: number;
    stripeWebhookLogs: Array<{
      eventId: string;
      type: string;
      status: string;
      amount: number;
      currency: string;
      createdAt: string;
    }>;
    revenueVsRenderUsage: Array<{ t: string; revenue: number; renders: number }>;
  };
  renderInfrastructureMonitor?: {
    activeJobsInQueue: number;
    avgProcessingTimeSec: number;
    failedRenders: Array<{ reason: string; count: number }>;
    workerHealth: { online: boolean; status: string; uptimeSeconds: number };
    r2UploadStatus: { ok: boolean; provider: string; failedUploads24h: number; note: string };
    storageUsage: { gb: number; pct: number; objects: number; estimated: boolean };
    costPerRenderEstimateUsd: number;
    cpuUtilizationPct: number;
    gpuUtilizationPct: number;
    processingTimeSpikeAlert: {
      active: boolean;
      severity: "normal" | "elevated" | "critical";
      ratio: number;
      currentSec: number;
      baselineSec: number;
    };
  };
  liveErrorTerminal?: {
    backendLogCount24h: number;
    frontendErrorCount24h: number;
    api401Count24h: number;
    api500Count24h: number;
    mostCommonErrorTypes: Array<{ type: string; count: number }>;
    groupedErrors: Array<{ type: string; count: number; severity: string; lastSeen: string }>;
    fixSuggestion: string;
  };
  userIntelligencePanel?: {
    activeUsers: number;
    geoHeatmap: Array<{
      country: string | null;
      city: string | null;
      latitude?: number | null;
      longitude?: number | null;
      sessions: number;
      users: number;
    }>;
    planBreakdown: Record<string, number>;
    topUsersByRenders: Array<{
      userId: string;
      email: string | null;
      renders: number;
      planTier: string;
      usagePct: number;
    }>;
    suspiciousActivityFlag: boolean;
    abuseDetection: Array<{ userId: string; jobs: number }>;
    averageWatchLengthSec: number;
    whaleDetector: Array<{
      userId: string;
      email: string | null;
      planTier: string;
      usagePct: number;
      upgradeLikelihood: number;
    }>;
  };
  experimentLab?: {
    controls: FeatureLabControls;
    variantPerformance: Array<{
      variant: string;
      predictedRetention: number;
      paidConversionPct: number;
    }>;
  };
  editorQualityAnalyzer?: {
    renders: Array<{
      jobId: string;
      userId: string;
      createdAt: string;
      hookScore: number;
      pacingScore: number;
      storyCoherenceScore: number;
      emotionalSpikeMoments: number[];
      viralityProbability: number;
      qualityScore: number;
      isPremiumQuality: boolean;
    }>;
    lowQualityCount: number;
  };
  feedbackIntelligence?: {
    clusters: Array<{ cluster: string; count: number; sentimentTag: string }>;
    topRequestedFeatures: Array<{ feature: string; count: number }>;
    sentimentScore: number;
    supportSummary: string;
    featureDemandHeatmap: Array<{ label: string; count: number }>;
  };
  costControlPanel?: {
    costPerUserUsd: number;
    costPerRenderUsd: number;
    storageCostTrend: Array<{ t: string; v: number }>;
    infrastructureBurnRateUsdMonthly: number;
    profitMarginPct: number;
    runwayMonths: number;
  };
  securityPanel?: {
    adminAccessLogs: Array<{
      id: string;
      actor: string | null;
      action: string | null;
      reason: string | null;
      createdAt: string;
    }>;
    suspiciousLoginAttempts: number;
    apiAbuseMonitor: Array<{ ip: string; count: number }>;
    rateLimitMonitor: {
      alerts: Array<{ label: string; count: number }>;
      status429Count24h: number;
    };
    tokenExpirationTracking: {
      nearingTimeoutSessions: number;
      staleSessions: number;
    };
    r2KeyUsageLog: {
      provider: string;
      configured: boolean;
      lastCheckAt: string;
    };
    webhookVerificationStatus: {
      configured: boolean;
      healthy: boolean;
      lastEventAt: string | null;
    };
  };
  conversionIntelligence?: {
    onboardingDropOff: Array<{ step: string; count: number; dropOffPct: number }>;
    uploadCompletionPct: number;
    trialToPaidConversionPct: number;
    founderPlanUrgencyGraph: Array<{ t: string; remaining: number; sold: number }>;
    pageHeatmapAnalytics: Array<{ page: string; count: number }>;
  };
  futureScalingPanel?: {
    multiRegionDeployEnabled: boolean;
    cdnHealth: { configured: boolean; url: string | null; ok: boolean };
    cacheHitRatePct: number;
    queueScalingThresholds: { scaleUpAt: number; scaleDownAt: number };
    autoScaleWorkerTriggers: { active: boolean; suggestedWorkers: number };
  };
  aiSelfImprovementPanel?: {
    supported: boolean;
    defaultAnalyzeCount: number;
    quickSuggestions: string[];
  };
};

const DEFAULT_FEATURE_CONTROLS: FeatureLabControls = {
  hookLogicMode: "stable",
  subtitleEngineMode: "v1",
  maxUploadSizeMb: 2048,
  aiIntensity: 1,
  watermarkOverride: "auto",
  retentionAlgorithmMode: "adaptive_v3",
  zoomIntensityLevel: "medium",
  emotionalDetectionThreshold: 0.55,
  retentionModelVariant: "v1",
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

const formatShortTime = (iso?: string) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );

const formatPercent = (value: number) => `${(Number.isFinite(value) ? value * 100 : 0).toFixed(1)}%`;

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0
  );

const sentimentColor = (sentiment: string) => {
  if (sentiment === "positive") return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
  if (sentiment === "bug") return "bg-rose-500/20 text-rose-200 border-rose-500/40";
  if (sentiment === "request") return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-slate-500/20 text-slate-200 border-slate-500/40";
};

const chartTick = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const EmptyStateNote = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed border-border/55 bg-card/25 px-3 py-2 text-[11px] text-muted-foreground">
    {text}
  </div>
);

const ControlPanel = () => {
  const { accessToken } = useAuth();
  const [errorRange, setErrorRange] = useState("24h");
  const [paymentRange, setPaymentRange] = useState("7d");
  const [insightRange, setInsightRange] = useState("30d");
  const [feedbackRange, setFeedbackRange] = useState("30d");
  const [severity, setSeverity] = useState("all");
  const [live, setLive] = useState<LiveRealtimePayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveErrorEntry, setLiveErrorEntry] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [grantEmail, setGrantEmail] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTier, setGrantTier] = useState("studio");
  const [grantDurationDays, setGrantDurationDays] = useState("30");
  const [grantReason, setGrantReason] = useState("");

  const [cancelSubEmail, setCancelSubEmail] = useState("");
  const [cancelSubUserId, setCancelSubUserId] = useState("");
  const [cancelSubImmediate, setCancelSubImmediate] = useState(true);
  const [cancelSubReason, setCancelSubReason] = useState("");

  const [cancelJobId, setCancelJobId] = useState("");
  const [cancelJobReason, setCancelJobReason] = useState("");

  const [banIp, setBanIp] = useState("");
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDurationHours, setBanDurationHours] = useState("24");

  const [weeklyReportEmail, setWeeklyReportEmail] = useState("marquiseedwards00@gmail.com");
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [featureDraft, setFeatureDraft] = useState<FeatureLabControls | null>(null);
  const [selfImproveCount, setSelfImproveCount] = useState("1000");
  const [selfImproveResult, setSelfImproveResult] = useState<{
    analyzedRenders: number;
    completedRenders: number;
    failedRenders: number;
    lowQualityCount: number;
    averageUploadToRenderSeconds: number;
    topFailures: Array<{ reason: string; count: number }>;
    complaintTags: Array<{ tag: string; count: number }>;
    suggestions: Array<{ priority: number; title: string; expectedImpact: string; difficulty: string }>;
    generatedAt: string;
  } | null>(null);

  const [lifetimeEmail, setLifetimeEmail] = useState("");
  const [lifetimeUserId, setLifetimeUserId] = useState("");
  const [founderJobId, setFounderJobId] = useState("");
  const [refundEventId, setRefundEventId] = useState("");
  const [webhookType, setWebhookType] = useState("invoice.paid");
  const [webhookAmountCents, setWebhookAmountCents] = useState("9900");
  const [testUserPlanTier, setTestUserPlanTier] = useState("free");

  const canLoad = Boolean(accessToken);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiFetch<OverviewResponse>("/api/admin/overview", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000,
  });

  const errorsQuery = useQuery({
    queryKey: ["admin-errors", errorRange, severity],
    queryFn: () =>
      apiFetch<ErrorsResponse>(
        `/api/admin/errors?range=${encodeURIComponent(errorRange)}${
          severity !== "all" ? `&severity=${encodeURIComponent(severity)}` : ""
        }`,
        { token: accessToken || "" }
      ),
    enabled: canLoad,
    refetchInterval: 20000,
  });

  const realtimeUsersQuery = useQuery({
    queryKey: ["admin-realtime-users"],
    queryFn: () => apiFetch<RealtimeUsersResponse>("/api/admin/realtime-users", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 15000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", paymentRange],
    queryFn: () =>
      apiFetch<PaymentsResponse>(`/api/admin/payments?range=${encodeURIComponent(paymentRange)}`, {
        token: accessToken || "",
      }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => apiFetch<SubscriptionsResponse>("/api/admin/subscriptions?range=30d", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const insightsQuery = useQuery({
    queryKey: ["admin-insights", insightRange],
    queryFn: () =>
      apiFetch<InsightsResponse>(`/api/admin/editor-insights?range=${encodeURIComponent(insightRange)}`, {
        token: accessToken || "",
      }),
    enabled: canLoad,
    refetchInterval: 45000,
  });

  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback", feedbackRange],
    queryFn: () =>
      apiFetch<FeedbackResponse>(`/api/admin/feedback?range=${encodeURIComponent(feedbackRange)}`, {
        token: accessToken || "",
      }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const siteLiveQuery = useQuery({
    queryKey: ["admin-site-live"],
    queryFn: () => apiFetch<SiteLiveResponse>("/api/admin/site-live", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 10000,
  });

  const liveGeoQuery = useQuery({
    queryKey: ["admin-live-geo"],
    queryFn: () => apiFetch<LiveGeoResponse>("/api/admin/live-geo", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  const healthQuery = useQuery({
    queryKey: ["admin-health-status"],
    queryFn: () => apiFetch<HealthStatusResponse>("/api/admin/health-status", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const securityQuery = useQuery({
    queryKey: ["admin-security"],
    queryFn: () => apiFetch<SecurityResponse>("/api/admin/security", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 45000,
  });

  const ipBansQuery = useQuery({
    queryKey: ["admin-ip-bans"],
    queryFn: () => apiFetch<IpBansResponse>("/api/admin/ip-bans", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const weeklyReportsQuery = useQuery({
    queryKey: ["admin-weekly-reports"],
    queryFn: () => apiFetch<WeeklyReportsResponse>("/api/admin/reports/weekly", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000,
  });

  const commandCenterQuery = useQuery({
    queryKey: ["admin-command-center"],
    queryFn: () => apiFetch<CommandCenterResponse>("/api/admin/command-center", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 15000,
  });

  const featureLabQuery = useQuery({
    queryKey: ["admin-feature-lab"],
    queryFn: () => apiFetch<{ controls: FeatureLabControls; updatedAt: string }>("/api/admin/feature-lab", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!canLoad || !accessToken) return;
    const streamPath = `/api/admin/stream?token=${encodeURIComponent(accessToken)}&password=${encodeURIComponent(getControlPanelPassword())}`;
    const streamUrl = API_URL ? `${API_URL}${streamPath}` : streamPath;
    const eventSource = new EventSource(streamUrl);
    let closed = false;
    let disconnectNoticeTimer: number | null = null;

    const clearDisconnectNotice = () => {
      if (disconnectNoticeTimer !== null) {
        window.clearTimeout(disconnectNoticeTimer);
        disconnectNoticeTimer = null;
      }
    };

    eventSource.onopen = () => {
      if (closed) return;
      clearDisconnectNotice();
      setStreamError(null);
    };

    eventSource.addEventListener("realtime", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as LiveRealtimePayload;
        setLive(payload);
        clearDisconnectNotice();
        setStreamError(null);
      } catch {
        // no-op
      }
    });

    eventSource.addEventListener("new_error", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          severity: string;
          message: string;
          endpoint?: string | null;
        };
        setLiveErrorEntry(`${payload.severity.toUpperCase()}: ${payload.message}${payload.endpoint ? ` @ ${payload.endpoint}` : ""}`);
      } catch {
        // no-op
      }
    });

    eventSource.onerror = () => {
      if (closed || disconnectNoticeTimer !== null) return;
      disconnectNoticeTimer = window.setTimeout(() => {
        disconnectNoticeTimer = null;
        if (closed) return;
        setStreamError("Live stream disconnected. Retrying...");
      }, 2000);
    };

    return () => {
      closed = true;
      clearDisconnectNotice();
      eventSource.close();
    };
  }, [accessToken, canLoad]);

  useEffect(() => {
    if (featureLabQuery.data?.controls) {
      setFeatureDraft(featureLabQuery.data.controls);
    }
  }, [featureLabQuery.data?.controls]);

  const runAdminAction = async (path: string, init: RequestInit, successMessage: string) => {
    if (!accessToken) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch(path, { ...init, token: accessToken });
      setActionSuccess(successMessage);
      await Promise.all([
        overviewQuery.refetch(),
        errorsQuery.refetch(),
        paymentsQuery.refetch(),
        subscriptionsQuery.refetch(),
        insightsQuery.refetch(),
        feedbackQuery.refetch(),
        siteLiveQuery.refetch(),
        liveGeoQuery.refetch(),
        healthQuery.refetch(),
        securityQuery.refetch(),
        ipBansQuery.refetch(),
        weeklyReportsQuery.refetch(),
        commandCenterQuery.refetch(),
        featureLabQuery.refetch(),
      ]);
    } catch (error: any) {
      setActionError(error?.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantSubscription = async () => {
    await runAdminAction(
      "/api/admin/subscriptions/grant",
      {
        method: "POST",
        body: JSON.stringify({
          email: grantEmail || undefined,
          userId: grantUserId || undefined,
          tier: grantTier,
          durationDays: Number(grantDurationDays || 30),
          reason: grantReason || undefined,
        }),
      },
      "Subscription granted."
    );
  };

  const handleCancelSubscription = async () => {
    await runAdminAction(
      "/api/admin/subscriptions/cancel",
      {
        method: "POST",
        body: JSON.stringify({
          email: cancelSubEmail || undefined,
          userId: cancelSubUserId || undefined,
          immediate: cancelSubImmediate,
          reason: cancelSubReason || undefined,
        }),
      },
      cancelSubImmediate ? "Subscription canceled immediately." : "Subscription set to cancel at period end."
    );
  };

  const handleCancelJob = async () => {
    if (!cancelJobId.trim()) {
      setActionError("Job ID is required.");
      return;
    }
    await runAdminAction(
      `/api/admin/jobs/${encodeURIComponent(cancelJobId.trim())}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({
          reason: cancelJobReason || undefined,
        }),
      },
      "Job canceled."
    );
  };

  const handleBanIp = async () => {
    await runAdminAction(
      "/api/admin/ip-bans",
      {
        method: "POST",
        body: JSON.stringify({
          ip: banIp || undefined,
          userId: banUserId || undefined,
          durationHours: Number(banDurationHours || 0),
          reason: banReason || undefined,
        }),
      },
      "IP ban added."
    );
  };

  const handleUnbanIp = async (ip: string) => {
    await runAdminAction(
      `/api/admin/ip-bans/${encodeURIComponent(ip)}`,
      {
        method: "DELETE",
      },
      `IP ${ip} unbanned.`
    );
  };

  const handleSaveWeeklyReport = async () => {
    await runAdminAction(
      "/api/admin/reports/weekly",
      {
        method: "POST",
        body: JSON.stringify({
          email: weeklyReportEmail,
          enabled: weeklyReportEnabled,
        }),
      },
      "Weekly report schedule saved."
    );
  };

  const handleSendWeeklyNow = async () => {
    if (!weeklyReportsQuery.data?.provider.configured) {
      setActionSuccess(null);
      setActionError("Configure WEEKLY_REPORT_WEBHOOK_URL or RESEND_API_KEY before sending weekly reports.");
      return;
    }
    await runAdminAction(
      "/api/admin/reports/weekly/send-now",
      {
        method: "POST",
        body: JSON.stringify({
          email: weeklyReportEmail,
        }),
      },
      "Weekly report sent."
    );
  };

  const handleFixErrorNow = async (errorId: string) => {
    if (!errorId) return;
    await runAdminAction(
      `/api/admin/errors/${encodeURIComponent(errorId)}/fix-now`,
      {
        method: "POST",
      },
      "Fix action queued for the selected error."
    );
  };

  const handleSaveFeatureLab = async () => {
    const payload = featureDraft || featureLabQuery.data?.controls || commandCenterQuery.data?.featureLab.controls || DEFAULT_FEATURE_CONTROLS;
    await runAdminAction(
      "/api/admin/feature-lab",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "Feature Lab controls updated."
    );
  };

  const handleRunSelfImprovement = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await apiFetch<{
        analyzedRenders: number;
        completedRenders: number;
        failedRenders: number;
        lowQualityCount: number;
        averageUploadToRenderSeconds: number;
        topFailures: Array<{ reason: string; count: number }>;
        complaintTags: Array<{ tag: string; count: number }>;
        suggestions: Array<{ priority: number; title: string; expectedImpact: string; difficulty: string }>;
        generatedAt: string;
      }>("/api/admin/ai-self-improvement", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          count: Number(selfImproveCount || 1000),
        }),
      });
      setSelfImproveResult(result);
      setActionSuccess(`AI analyzed ${result.analyzedRenders} renders and generated upgrade recommendations.`);
      await commandCenterQuery.refetch();
    } catch (error: any) {
      setActionError(error?.message || "AI self-improvement analysis failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantLifetime = async () => {
    await runAdminAction(
      "/api/admin/founder-tools/grant-lifetime",
      {
        method: "POST",
        body: JSON.stringify({
          email: lifetimeEmail || undefined,
          userId: lifetimeUserId || undefined,
        }),
      },
      "Lifetime founder access granted."
    );
  };

  const handleFounderReprocess = async () => {
    if (!founderJobId.trim()) {
      setActionError("Job ID is required.");
      return;
    }
    await runAdminAction(
      "/api/admin/founder-tools/reprocess-job",
      {
        method: "POST",
        body: JSON.stringify({
          jobId: founderJobId.trim(),
        }),
      },
      "Job reprocess queued."
    );
  };

  const handleFounderKillJob = async () => {
    if (!founderJobId.trim()) {
      setActionError("Job ID is required.");
      return;
    }
    await runAdminAction(
      "/api/admin/founder-tools/kill-job",
      {
        method: "POST",
        body: JSON.stringify({
          jobId: founderJobId.trim(),
        }),
      },
      "Stuck job terminated."
    );
  };

  const handleFounderRefund = async () => {
    if (!refundEventId.trim()) {
      setActionError("Stripe event ID is required.");
      return;
    }
    await runAdminAction(
      "/api/admin/founder-tools/refund-payment",
      {
        method: "POST",
        body: JSON.stringify({
          eventId: refundEventId.trim(),
        }),
      },
      "Refund request sent to Stripe."
    );
  };

  const handleSimulateWebhook = async () => {
    await runAdminAction(
      "/api/admin/founder-tools/simulate-webhook",
      {
        method: "POST",
        body: JSON.stringify({
          type: webhookType,
          amountCents: Number(webhookAmountCents || 0),
        }),
      },
      "Webhook event simulated."
    );
  };

  const handleGenerateTestUser = async () => {
    await runAdminAction(
      "/api/admin/founder-tools/generate-test-user",
      {
        method: "POST",
        body: JSON.stringify({
          planTier: testUserPlanTier,
        }),
      },
      "Internal test user created."
    );
  };

  const handleCopyUpgradePrompt = async (target: "codex" | "copilot") => {
    const empire = commandCenterQuery.data;
    const prompt = [
      `You are ${target === "codex" ? "Codex" : "GitHub Copilot"} helping implement growth upgrades for AutoEditor Pro.`,
      "Priority metrics snapshot:",
      `- MRR: ${formatMoney(empire?.revenue.mrr ?? 0)}`,
      `- Churn: ${(empire?.revenue.churnRatePct ?? 0).toFixed(1)}%`,
      `- Hook success rate: ${(empire?.editorPerformance.aiQuality.hookSuccessRatePct ?? 0).toFixed(1)}%`,
      `- Drop-off prediction accuracy: ${(empire?.editorPerformance.aiQuality.dropOffPredictionAccuracyPct ?? 0).toFixed(1)}%`,
      `- Top failure reason: ${empire?.systemHealth.failedJobs?.[0]?.reason || "unknown"}`,
      "Tasks:",
      "1) Reduce top failure reason with deterministic fallback",
      "2) Improve hook success and early retention",
      "3) Improve funnel from upload->render->download->subscribe",
      "4) Add tests for every backend and frontend change",
      "Return concrete file-level patch instructions.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(prompt);
      setActionSuccess(`${target.toUpperCase()} upgrade prompt copied to clipboard.`);
      setActionError(null);
    } catch {
      setActionSuccess(null);
      setActionError("Clipboard write failed. See browser console for prompt text.");
      console.log(prompt);
    }
  };

  const summary = overviewQuery.data?.summary;
  const graphs = overviewQuery.data?.graphs;
  const effectiveActiveUsers = live?.activeUsers ?? summary?.activeUsers ?? realtimeUsersQuery.data?.activeUsers ?? 0;
  const effectiveJobsInQueue = live?.jobsInQueue ?? summary?.jobsInQueue ?? 0;
  const effectiveJobsFailed = live?.jobsFailed24h ?? summary?.jobsFailed24h ?? 0;
  const effectiveImpressions5m =
    live?.websiteImpressions5m ?? siteLiveQuery.data?.impressionsLast5m ?? summary?.websiteImpressions5m ?? 0;
  const effectiveImpressions24h =
    live?.websiteImpressions24h ?? siteLiveQuery.data?.impressionsLast24h ?? summary?.websiteImpressions24h ?? 0;
  const weeklyProviderConfigured = Boolean(weeklyReportsQuery.data?.provider.configured);
  const weeklyProviderName = weeklyReportsQuery.data?.provider.provider || "unknown";
  const empire = commandCenterQuery.data;
  const featureState = featureDraft ?? featureLabQuery.data?.controls ?? empire?.featureLab.controls ?? DEFAULT_FEATURE_CONTROLS;
  const retentionEngine = empire?.aiIntelligenceDashboard?.retentionPredictionEngine;
  const retentionBrainMap = empire?.aiIntelligenceDashboard?.retentionBrainMap ?? [];
  const revenueCenter = empire?.revenueCommandCenter;
  const renderInfra = empire?.renderInfrastructureMonitor;
  const liveTerminal = empire?.liveErrorTerminal;
  const userIntel = empire?.userIntelligencePanel;
  const liveGeoRows = liveGeoQuery.data?.geoHeatmap ?? userIntel?.geoHeatmap ?? [];
  const liveGeoUpdatedAt = liveGeoQuery.data?.updatedAt ?? empire?.generatedAt ?? null;
  const liveGeoActiveUsers = liveGeoQuery.data?.activeUsers ?? userIntel?.activeUsers ?? effectiveActiveUsers;
  const experimentIntel = empire?.experimentLab;
  const qualityAnalyzer = empire?.editorQualityAnalyzer;
  const feedbackIntel = empire?.feedbackIntelligence;
  const costControl = empire?.costControlPanel;
  const securityPanel = empire?.securityPanel;
  const conversionIntel = empire?.conversionIntelligence;
  const scalingPanel = empire?.futureScalingPanel;
  const countryRollup = useMemo(() => {
    const grouped = new Map<string, { country: string; sessions: number; users: number }>();
    for (const row of liveGeoRows) {
      const country = String(row.country || "Unknown").trim() || "Unknown";
      const existing = grouped.get(country) || { country, sessions: 0, users: 0 };
      existing.sessions += Math.max(0, Number(row.sessions || 0));
      existing.users += Math.max(0, Number(row.users || 0));
      grouped.set(country, existing);
    }
    return Array.from(grouped.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [liveGeoRows]);

  const topIssues = feedbackQuery.data?.topIssues ?? [];
  const topIssueData = useMemo(() => topIssues.slice(0, 6), [topIssues]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,hsl(var(--primary)/0.22),transparent_55%),linear-gradient(180deg,hsl(232_24%_8%)_0%,hsl(228_22%_6%)_100%)] text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl animate-panel-float" />
        <div className="absolute right-0 top-52 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl animate-panel-float-delayed" />
      </div>
      <Navbar />
      <main className="control-panel-main relative mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="System Operations Dashboard"
          subtitle="Hidden internal panel for live ops, failures, subscriptions, payments, and editor optimization insights."
        />

        <div className="mb-6 flex flex-col gap-2">
          {streamError ? <p className="text-xs text-amber-300">{streamError}</p> : null}
          {liveErrorEntry ? <p className="text-xs text-rose-300">New error: {liveErrorEntry}</p> : null}
          {actionError ? <p className="text-xs text-rose-300">{actionError}</p> : null}
          {actionSuccess ? <p className="text-xs text-emerald-300">{actionSuccess}</p> : null}
        </div>

        <section className="mb-8 grid gap-4 xl:grid-cols-4">
          <Card className="glass-card border-primary/40 bg-[radial-gradient(120%_120%_at_0%_0%,hsl(var(--primary)/0.24),transparent_60%)] xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-5 w-5 text-amber-300" />
                Founder Command Center
                <Badge variant="outline" className="border-amber-400/40 text-amber-200">
                  Founder Badge
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">MRR</p>
                  <p className="text-xl font-semibold">{formatMoney(empire?.revenue.mrr ?? 0)}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">ARR</p>
                  <p className="text-xl font-semibold">{formatMoney(empire?.revenue.arrProjection ?? 0)}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Churn</p>
                  <p className="text-xl font-semibold">{(empire?.revenue.churnRatePct ?? 0).toFixed(1)}%</p>
                </div>
                <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3">
                  <p className="text-amber-200">Founder Slots Left</p>
                  <p className="text-2xl font-bold text-amber-100">{empire?.revenue.founderPlanRemainingSlots ?? 0}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Updated: {formatShortTime(empire?.generatedAt)} • Stripe webhook: {empire?.systemHealth.stripeWebhookStatus.ok ? "healthy" : "degraded"}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Live System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span className="inline-flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-sky-300" />CPU</span>
                <span className="font-semibold">{(empire?.systemHealth.cpuUsagePct ?? 0).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span className="inline-flex items-center gap-2"><HardDrive className="h-3.5 w-3.5 text-violet-300" />Memory</span>
                <span className="font-semibold">{(empire?.systemHealth.memoryUsage.systemUsedPct ?? 0).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>Render Queue</span>
                <span className="font-semibold">{empire?.systemHealth.renderQueueLength ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>R2 Usage</span>
                <span className="font-semibold">{(empire?.systemHealth.r2StorageUsage.gb ?? 0).toFixed(2)} GB</span>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <p className="text-muted-foreground">Top failure</p>
                <p className="line-clamp-1 font-medium">{empire?.systemHealth.failedJobs?.[0]?.reason || "No failures"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Live Active Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>On Site</span>
                <span className="font-semibold">{empire?.liveUsers.usersOnSite ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>Rendering</span>
                <span className="font-semibold">{empire?.liveUsers.usersRendering ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>Exporting</span>
                <span className="font-semibold">{empire?.liveUsers.usersExporting ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <span>Avg Session</span>
                <span className="font-semibold">{(empire?.liveUsers.averageSessionMinutes ?? 0).toFixed(1)}m</span>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <p className="text-muted-foreground">Live map hotspots</p>
                <p className="line-clamp-2">
                  {(empire?.liveUsers.map ?? [])
                    .slice(0, 3)
                    .map((item) => `${item.city || "Unknown"}, ${item.country || "Unknown"} (${item.sessions})`)
                    .join(" • ") || "No geo traffic yet"}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Error Command Board</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-5">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Backend</p><p className="text-lg font-semibold">{empire?.errors.backendErrors ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Frontend JS</p><p className="text-lg font-semibold">{empire?.errors.frontendJsErrors ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Failed Uploads</p><p className="text-lg font-semibold">{empire?.errors.failedUploads24h ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">401/403</p><p className="text-lg font-semibold">{empire?.errors.authFailures24h ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Webhook Fails</p><p className="text-lg font-semibold">{empire?.errors.failedWebhooks24h ?? 0}</p></div>
              </div>
              <div className="max-h-80 overflow-auto rounded-md border border-border/50">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-card/50 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Severity</th>
                      <th className="px-2 py-2">Message</th>
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Video</th>
                      <th className="px-2 py-2">Browser</th>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(empire?.errors.items ?? []).slice(0, 20).map((item) => (
                      <tr key={`empire-error-${item.id}`} className="border-t border-border/40 align-top">
                        <td className="px-2 py-2"><Badge variant="outline" className="text-[10px] uppercase">{item.severity}</Badge></td>
                        <td className="px-2 py-2 max-w-[260px]">
                          <p className="line-clamp-2">{item.message}</p>
                          {item.stackSnippet ? <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{item.stackSnippet}</p> : null}
                        </td>
                        <td className="px-2 py-2">{item.userId || "-"}</td>
                        <td className="px-2 py-2">{item.planTier || "free"}</td>
                        <td className="px-2 py-2">{item.videoSizeMb ? `${item.videoSizeMb.toFixed(1)} MB` : "-"}</td>
                        <td className="px-2 py-2">{item.browser || "-"}</td>
                        <td className="px-2 py-2">{formatShortTime(item.lastSeen)}</td>
                        <td className="px-2 py-2">
                          <button
                            disabled={actionLoading || !item.retryable}
                            onClick={() => handleFixErrorNow(item.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Fix Now
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!(empire?.errors.items ?? []).length ? (
                      <tr>
                        <td colSpan={8} className="border-t border-border/40 py-4 text-center text-muted-foreground">
                          No command-board errors in this time window.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="mb-1 text-muted-foreground">API latency spikes</p>
                <p className="line-clamp-2">
                  {(empire?.errors.apiLatencySpikes ?? [])
                    .slice(0, 3)
                    .map((row) => `${row.endpoint} (p95 ${row.p95Ms}ms)`)
                    .join(" • ") || "No major spikes in the last 24h"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Growth + Security Weapons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 text-muted-foreground">Viral Metrics</p>
                <p>Share rate: {(empire?.growth.viralMetrics.shareRatePct ?? 0).toFixed(1)}%</p>
                <p>Download rate: {(empire?.growth.viralMetrics.downloadRatePct ?? 0).toFixed(1)}%</p>
                <p>Return in 24h: {(empire?.growth.viralMetrics.returnIn24hPct ?? 0).toFixed(1)}%</p>
                <p>Avg videos/user: {(empire?.growth.viralMetrics.averageVideosPerUser ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 text-muted-foreground">Funnel</p>
                <p>Visitor: {formatCompactNumber(empire?.growth.funnel.visitor ?? 0)}</p>
                <p>Signup: {formatCompactNumber(empire?.growth.funnel.signup ?? 0)}</p>
                <p>Upload: {formatCompactNumber(empire?.growth.funnel.upload ?? 0)}</p>
                <p>Render: {formatCompactNumber(empire?.growth.funnel.render ?? 0)}</p>
                <p>Download: {formatCompactNumber(empire?.growth.funnel.download ?? 0)}</p>
                <p>Subscribe: {formatCompactNumber(empire?.growth.funnel.subscribe ?? 0)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-1 flex items-center gap-2 font-medium"><ShieldAlert className="h-3.5 w-3.5 text-rose-300" /> Suspicious Activity</p>
                <p className="text-2xl font-bold">{(empire?.securityAbuse.suspiciousActivityScore ?? 0).toFixed(1)}</p>
                <p className="text-[11px] text-muted-foreground">
                  Massive uploads: {(empire?.securityAbuse.massiveUploadUsers ?? []).length} • Multi-account IPs: {(empire?.securityAbuse.multipleAccountsFromSameIp ?? []).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Feature Experiment Lab</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-muted-foreground">Hook Logic</span>
                  <select
                    value={featureState.hookLogicMode}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), hookLogicMode: e.target.value as FeatureLabControls["hookLogicMode"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="stable">stable</option>
                    <option value="experimental">experimental</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Subtitle Engine</span>
                  <select
                    value={featureState.subtitleEngineMode}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), subtitleEngineMode: e.target.value as FeatureLabControls["subtitleEngineMode"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="v1">v1</option>
                    <option value="v2">v2</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Retention Algorithm</span>
                  <select
                    value={featureState.retentionAlgorithmMode}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), retentionAlgorithmMode: e.target.value as FeatureLabControls["retentionAlgorithmMode"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="adaptive_v3">adaptive_v3</option>
                    <option value="emotional_focus">emotional_focus</option>
                    <option value="safe_mode">safe_mode</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Watermark Override</span>
                  <select
                    value={featureState.watermarkOverride}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), watermarkOverride: e.target.value as FeatureLabControls["watermarkOverride"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="auto">auto</option>
                    <option value="force_on">force_on</option>
                    <option value="force_off">force_off</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Max Upload (MB)</span>
                  <input
                    type="number"
                    value={featureState.maxUploadSizeMb ?? 2048}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), maxUploadSizeMb: Number(e.target.value || 0) }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">AI Intensity</span>
                  <input
                    type="number"
                    min={0.4}
                    max={2}
                    step={0.05}
                    value={featureState.aiIntensity ?? 1}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), aiIntensity: Number(e.target.value || 1) }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Zoom Intensity</span>
                  <select
                    value={featureState.zoomIntensityLevel}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), zoomIntensityLevel: e.target.value as FeatureLabControls["zoomIntensityLevel"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Emotional Threshold</span>
                  <input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={featureState.emotionalDetectionThreshold ?? 0.55}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), emotionalDetectionThreshold: Number(e.target.value || 0.55) }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground">Retention Model</span>
                  <select
                    value={featureState.retentionModelVariant}
                    onChange={(e) => setFeatureDraft((prev) => ({ ...(prev || featureState || DEFAULT_FEATURE_CONTROLS), retentionModelVariant: e.target.value as FeatureLabControls["retentionModelVariant"] }))}
                    className="h-9 w-full rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                  >
                    <option value="v1">v1</option>
                    <option value="v2">v2</option>
                  </select>
                </label>
              </div>
              <button
                disabled={actionLoading}
                onClick={handleSaveFeatureLab}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-60"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Save Live Experiments
              </button>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">AI Brain + Founder Ego Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-1 text-muted-foreground">Top hooks this week</p>
                <p className="line-clamp-2">
                  {(empire?.aiBrain.topPerformingHooksThisWeek ?? [])
                    .slice(0, 2)
                    .map((item) => `${item.text} (${item.avgScore})`)
                    .join(" • ") || "No hook data yet"}
                </p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Best pacing pattern</p>
                <p className="font-semibold">{empire?.aiBrain.bestEmotionalPacingPattern || "n/a"}</p>
                <p className="mt-1 text-muted-foreground line-clamp-2">
                  {(empire?.aiBrain.autoSuggestions ?? []).slice(0, 2).join(" • ") || "No suggestions yet"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Minutes processed</p><p className="text-lg font-semibold">{formatCompactNumber(empire?.founderEgo.totalMinutesProcessed ?? 0)}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Videos exported</p><p className="text-lg font-semibold">{formatCompactNumber(empire?.founderEgo.totalVideosExported ?? 0)}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Time saved</p><p className="text-lg font-semibold">{(empire?.founderEgo.estimatedTimeSavedHours ?? 0).toFixed(1)}h</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">GB processed</p><p className="text-lg font-semibold">{(empire?.founderEgo.totalGbProcessed ?? 0).toFixed(2)}</p></div>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Most viral clip</p>
                <p className="line-clamp-2">
                  {empire?.founderEgo.mostViralGeneratedClip
                    ? `${empire.founderEgo.mostViralGeneratedClip.jobId} • score ${empire.founderEgo.mostViralGeneratedClip.score}`
                    : "No viral clip recorded"}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Upgrade Weapons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Fire implementation prompts directly to Codex/Copilot with the latest command-center context.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={actionLoading}
                  onClick={() => handleCopyUpgradePrompt("codex")}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Copy Codex Prompt
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleCopyUpgradePrompt("copilot")}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-sky-400/40 bg-sky-500/10 px-3 text-xs text-sky-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Copy Copilot Prompt
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Revenue Breakdown by Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Object.entries(empire?.revenue.stripeBreakdown.revenueByPlan ?? {}).map(([tier, value]) => (
                <div key={`rev-by-plan-${tier}`} className="flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2">
                  <span className="uppercase tracking-wide text-muted-foreground">{tier}</span>
                  <span className="font-semibold">{formatMoney(Number(value || 0))}</span>
                </div>
              ))}
              <div className="rounded-md border border-border/50 bg-card/40 px-3 py-2">
                <p>Failed payments: {empire?.revenue.stripeBreakdown.failedPayments ?? 0}</p>
                <p>Upcoming renewals: {empire?.revenue.stripeBreakdown.upcomingRenewals ?? 0}</p>
                <p>Refunds: {empire?.revenue.stripeBreakdown.refunds ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{effectiveActiveUsers}</p>
              <Users className="h-5 w-5 text-primary/80" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Impressions (5m)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatCompactNumber(effectiveImpressions5m)}</p>
              <Globe2 className="h-5 w-5 text-sky-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Impressions (24h)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatCompactNumber(effectiveImpressions24h)}</p>
              <Globe2 className="h-5 w-5 text-violet-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Jobs in Queue</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{effectiveJobsInQueue}</p>
              <Layers className="h-5 w-5 text-sky-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Jobs Failed (24h)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{effectiveJobsFailed}</p>
              <AlertTriangle className="h-5 w-5 text-rose-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Revenue (7d)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatMoney(summary?.revenue7d || 0)}</p>
              <DollarSign className="h-5 w-5 text-emerald-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Active Subs</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{summary?.activeSubscriptions ?? 0}</p>
              <Activity className="h-5 w-5 text-violet-300" />
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Avg Render</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-2xl font-bold">{(summary?.avgRenderTime ?? 0).toFixed(1)}s</p>
              <Timer className="h-5 w-5 text-amber-200" />
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Active Users Over Time</CardTitle></CardHeader>
            <CardContent className="h-64">
              {(graphs?.activeUsers ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphs?.activeUsers ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} />
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No active-user trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Job Success vs Failure</CardTitle></CardHeader>
            <CardContent className="h-64">
              {(graphs?.jobSuccessVsFailure ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphs?.jobSuccessVsFailure ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} />
                    <Bar dataKey="success" fill="hsl(160 70% 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failure" fill="hsl(347 75% 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No success/failure breakdown yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Avg Render Time</CardTitle></CardHeader>
            <CardContent className="h-64">
              {(graphs?.renderTimeAvg ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphs?.renderTimeAvg ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} formatter={(value) => [`${Number(value).toFixed(1)}s`, "Avg Render"]} />
                    <Line type="monotone" dataKey="v" stroke="hsl(42 96% 62%)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No render-time trend yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
            <CardContent className="h-64">
              {(paymentsQuery.data?.revenueByDay ?? graphs?.revenue ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={paymentsQuery.data?.revenueByDay ?? graphs?.revenue ?? []}>
                    <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(152 70% 45%)" stopOpacity={0.7} /><stop offset="100%" stopColor="hsl(152 70% 45%)" stopOpacity={0.05} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} formatter={(value) => [formatMoney(Number(value)), "Revenue"]} />
                    <Area dataKey="v" stroke="hsl(152 70% 45%)" fill="url(#revenueFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No revenue trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Website Impressions Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {(siteLiveQuery.data?.series ?? graphs?.websiteImpressions ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={siteLiveQuery.data?.series ?? graphs?.websiteImpressions ?? []}>
                    <defs>
                      <linearGradient id="impressionFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(200 95% 55%)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(200 95% 55%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      labelFormatter={(label) => formatShortTime(String(label))}
                      formatter={(value) => [String(value), "Impressions"]}
                    />
                    <Area dataKey="v" stroke="hsl(200 95% 55%)" fill="url(#impressionFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No website-impression trend data yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Current Website Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Active Users</p>
                  <p className="text-xl font-semibold">{siteLiveQuery.data?.activeUsers ?? effectiveActiveUsers}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Impressions (5m)</p>
                  <p className="text-xl font-semibold">{siteLiveQuery.data?.impressionsLast5m ?? effectiveImpressions5m}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Impressions (60m)</p>
                  <p className="text-xl font-semibold">{siteLiveQuery.data?.impressionsLast60m ?? 0}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Impressions (24h)</p>
                  <p className="text-xl font-semibold">{siteLiveQuery.data?.impressionsLast24h ?? effectiveImpressions24h}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Updated: {formatShortTime(siteLiveQuery.data?.updatedAt)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60 xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Errors Panel</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <select value={errorRange} onChange={(e) => setErrorRange(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option></select>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"><option value="all">All Severities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-muted-foreground"><tr><th className="pb-2 pr-3">Severity</th><th className="pb-2 pr-3">Message</th><th className="pb-2 pr-3">Endpoint</th><th className="pb-2 pr-3">Count</th><th className="pb-2">Last Seen</th></tr></thead>
                <tbody>
                  {(errorsQuery.data?.items ?? []).slice(0, 15).map((item) => (
                    <tr key={item.id} className="border-t border-border/40 align-top">
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px] uppercase">{item.severity}</Badge></td>
                      <td className="py-2 pr-3 max-w-[340px]"><p className="line-clamp-2">{item.message}</p>{item.stackSnippet ? <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{item.stackSnippet}</p> : null}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{item.endpoint || item.route || "-"}</td>
                      <td className="py-2 pr-3">{item.count}</td>
                      <td className="py-2">{formatShortTime(item.lastSeen)}</td>
                    </tr>
                  ))}
                  {!(errorsQuery.data?.items ?? []).length ? (
                    <tr>
                      <td colSpan={5} className="border-t border-border/40 py-4 text-center text-muted-foreground">
                        No errors in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Live Users</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Active now: <span className="font-semibold text-foreground">{realtimeUsersQuery.data?.activeUsers ?? effectiveActiveUsers}</span></p>
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {(realtimeUsersQuery.data?.sessions ?? []).slice(0, 20).map((session) => (
                  <div key={session.sessionId} className="rounded-lg border border-border/50 bg-card/40 p-2 text-xs">
                    <p className="truncate font-medium">{session.email || session.userId}</p>
                    <p className="text-muted-foreground">Last seen: {formatShortTime(session.lastSeen)}</p>
                    <p className="text-muted-foreground">Connected: {formatShortTime(session.connectedAt)}</p>
                    <p className="text-muted-foreground">IP: {session.ip || "-"}</p>
                  </div>
                ))}
                {!(realtimeUsersQuery.data?.sessions ?? []).length ? <EmptyStateNote text="No live sessions right now." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Payments</CardTitle>
              <select value={paymentRange} onChange={(e) => setPaymentRange(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"><option value="7d">7d</option><option value="30d">30d</option></select>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border/50 bg-card/40 p-3 text-xs"><p className="text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">{formatMoney(paymentsQuery.data?.revenueTotal ?? 0)}</p></div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="pb-2 pr-2">Type</th><th className="pb-2 pr-2">Amount</th><th className="pb-2">Created</th></tr></thead>
                  <tbody>
                    {(paymentsQuery.data?.recentPayments ?? []).slice(0, 12).map((payment) => (
                      <tr key={payment.eventId} className="border-t border-border/40"><td className="py-2 pr-2">{payment.type}</td><td className="py-2 pr-2">{formatMoney(payment.amount)}</td><td className="py-2">{formatShortTime(payment.createdAt)}</td></tr>
                    ))}
                    {!(paymentsQuery.data?.recentPayments ?? []).length ? (
                      <tr>
                        <td colSpan={3} className="border-t border-border/40 py-4 text-center text-muted-foreground">
                          No recent payments for this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {(paymentsQuery.data?.refundsOrChargebacks ?? []).length > 0 ? <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">Refund/chargeback flags: {(paymentsQuery.data?.refundsOrChargebacks ?? []).length}</div> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Subscriptions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Free</p><p className="text-xl font-semibold">{subscriptionsQuery.data?.distribution.free ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Starter</p><p className="text-xl font-semibold">{subscriptionsQuery.data?.distribution.starter ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Pro</p><p className="text-xl font-semibold">{subscriptionsQuery.data?.distribution.pro ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Founder</p><p className="text-xl font-semibold">{subscriptionsQuery.data?.distribution.founder ?? 0}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">Churn ({paymentRange}): <span className="font-semibold text-foreground">{subscriptionsQuery.data?.churnCount ?? 0}</span></p>
              <div className="max-h-48 overflow-auto rounded-md border border-border/50">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="px-2 py-2">Plan</th><th className="px-2 py-2">Renewal</th></tr></thead>
                  <tbody>
                    {(subscriptionsQuery.data?.upcomingRenewals ?? []).slice(0, 12).map((sub, index) => (
                      <tr key={`${sub.userId || "anon"}-${index}`} className="border-t border-border/40"><td className="px-2 py-2">{sub.planTier}</td><td className="px-2 py-2">{sub.currentPeriodEnd ? formatShortTime(sub.currentPeriodEnd) : "-"}</td></tr>
                    ))}
                    {!(subscriptionsQuery.data?.upcomingRenewals ?? []).length ? (
                      <tr>
                        <td colSpan={2} className="border-t border-border/40 py-4 text-center text-muted-foreground">
                          No upcoming renewals detected.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="h-28 rounded-md border border-border/50 bg-card/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={subscriptionsQuery.data?.trend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      formatter={(value) => [String(value), "Active Subs"]}
                      labelFormatter={(label) => formatShortTime(String(label))}
                    />
                    <Line type="monotone" dataKey="v" stroke="hsl(266 78% 67%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Editor Improvement Insights</CardTitle>
              <select value={insightRange} onChange={(e) => setInsightRange(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"><option value="30d">30d</option><option value="7d">7d</option><option value="90d">90d</option></select>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Avg Upload → Render</p><p className="text-lg font-semibold">{(insightsQuery.data?.aggregates.averageUploadToRenderSeconds ?? 0).toFixed(1)}s</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Abandonment Points</p><p className="text-lg font-semibold">{insightsQuery.data?.aggregates.abandonmentPoints ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Quality Complaints</p><p className="text-lg font-semibold">{insightsQuery.data?.aggregates.qualityComplaintsCount ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Success Rate</p><p className="text-lg font-semibold">{formatPercent(summary?.successRate ?? 0)}</p></div>
              </div>
              <div><p className="mb-1 font-semibold">Top drop-off points</p><ul className="space-y-1 text-muted-foreground">{(insightsQuery.data?.topDropOffPoints ?? []).slice(0, 5).map((item) => (<li key={item.label} className="flex items-center justify-between"><span>{item.label}</span><span>{item.count}</span></li>))}</ul></div>
              {!(insightsQuery.data?.topDropOffPoints ?? []).length ? <EmptyStateNote text="No drop-off points collected yet." /> : null}
              <div><p className="mb-1 font-semibold">Common render failure reasons</p><ul className="space-y-1 text-muted-foreground">{(insightsQuery.data?.aggregates.commonFailureReasons ?? []).slice(0, 5).map((item) => (<li key={item.reason} className="flex items-center justify-between"><span className="truncate pr-2">{item.reason}</span><span>{item.count}</span></li>))}</ul></div>
              {!(insightsQuery.data?.aggregates.commonFailureReasons ?? []).length ? <EmptyStateNote text="No recurring failure reasons found." /> : null}
              <div><p className="mb-1 font-semibold">Most requested features</p><ul className="space-y-1 text-muted-foreground">{(insightsQuery.data?.mostRequestedFeatures ?? []).slice(0, 5).map((item) => (<li key={item.feature} className="flex items-center justify-between"><span>{item.feature}</span><span>{item.count}</span></li>))}</ul></div>
              {!(insightsQuery.data?.mostRequestedFeatures ?? []).length ? <EmptyStateNote text="No feature requests in this window." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Suggested Pipeline Upgrades (AI)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(insightsQuery.data?.suggestedPipelineUpgrades ?? []).slice(0, 5).map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="font-semibold">{item.priority || index + 1}. {item.title}</p>
                  <p className="mt-1 text-muted-foreground">{item.expectedImpact}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-primary/80">Difficulty: {item.difficulty}</p>
                </div>
              ))}
              {!(insightsQuery.data?.suggestedPipelineUpgrades ?? []).length ? (
                <EmptyStateNote text="No AI upgrade suggestions right now." />
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm">Feedback Panel</CardTitle>
              <select value={feedbackRange} onChange={(e) => setFeedbackRange(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"><option value="30d">30d</option><option value="7d">7d</option><option value="90d">90d</option></select>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex flex-wrap gap-2">{Object.entries(feedbackQuery.data?.sentimentCounts ?? {}).map(([key, count]) => (<Badge key={key} variant="outline" className={`border ${sentimentColor(key)}`}>{key}: {count}</Badge>))}</div>
              {!Object.keys(feedbackQuery.data?.sentimentCounts ?? {}).length ? <EmptyStateNote text="No sentiment signals yet." /> : null}
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {(feedbackQuery.data?.items ?? []).slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/50 bg-card/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2"><p className="truncate font-medium">{item.category}</p><Badge variant="outline" className={`border ${sentimentColor(item.sentiment)}`}>{item.sentiment}</Badge></div>
                    <p className="text-muted-foreground">{item.note || "No notes"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatShortTime(item.createdAt)}</p>
                  </div>
                ))}
                {!(feedbackQuery.data?.items ?? []).length ? <EmptyStateNote text="No feedback submitted yet." /> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Top Issues Frequency</CardTitle></CardHeader>
            <CardContent className="h-80">
              {topIssueData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topIssueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                    <XAxis dataKey="issue" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyStateNote text="No issue-frequency data yet." />
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Admin Subscription Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 font-semibold">Grant Subscription</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="User email (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="User ID (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <select value={grantTier} onChange={(e) => setGrantTier(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs">
                    <option value="starter">starter</option>
                    <option value="creator">creator</option>
                    <option value="studio">studio</option>
                    <option value="founder">founder</option>
                  </select>
                  <input value={grantDurationDays} onChange={(e) => setGrantDurationDays(e.target.value)} placeholder="Duration days" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="Reason (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                </div>
                <button disabled={actionLoading} onClick={handleGrantSubscription} className="mt-3 inline-flex h-9 items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs text-emerald-200 disabled:opacity-60">
                  Grant Subscription
                </button>
              </div>

              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 font-semibold">Cancel Subscription</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={cancelSubEmail} onChange={(e) => setCancelSubEmail(e.target.value)} placeholder="User email (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <input value={cancelSubUserId} onChange={(e) => setCancelSubUserId(e.target.value)} placeholder="User ID (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input type="checkbox" checked={cancelSubImmediate} onChange={(e) => setCancelSubImmediate(e.target.checked)} />
                    Cancel immediately
                  </label>
                  <input value={cancelSubReason} onChange={(e) => setCancelSubReason(e.target.value)} placeholder="Reason (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                </div>
                <button disabled={actionLoading} onClick={handleCancelSubscription} className="mt-3 inline-flex h-9 items-center rounded-md border border-rose-500/40 bg-rose-500/10 px-3 text-xs text-rose-200 disabled:opacity-60">
                  Cancel Subscription
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Job + IP Enforcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 font-semibold">Cancel Any Job</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={cancelJobId} onChange={(e) => setCancelJobId(e.target.value)} placeholder="Job ID" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                  <input value={cancelJobReason} onChange={(e) => setCancelJobReason(e.target.value)} placeholder="Reason (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                </div>
                <button disabled={actionLoading} onClick={handleCancelJob} className="mt-3 inline-flex h-9 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs text-amber-200 disabled:opacity-60">
                  Cancel Job
                </button>
              </div>

              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 font-semibold">Ban User IP</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={banIp} onChange={(e) => setBanIp(e.target.value)} placeholder="IP address (optional if user ID set)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                  <input value={banUserId} onChange={(e) => setBanUserId(e.target.value)} placeholder="User ID (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                  <input value={banDurationHours} onChange={(e) => setBanDurationHours(e.target.value)} placeholder="Duration hours (0 = permanent)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                  <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason (optional)" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                </div>
                <button disabled={actionLoading} onClick={handleBanIp} className="mt-3 inline-flex h-9 items-center rounded-md border border-rose-500/40 bg-rose-500/10 px-3 text-xs text-rose-200 disabled:opacity-60">
                  <Ban className="mr-2 h-3.5 w-3.5" />
                  Ban IP
                </button>
              </div>

              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="mb-2 font-semibold">Active IP Bans</p>
                <div className="max-h-40 space-y-2 overflow-auto pr-1">
                  {(ipBansQuery.data?.items ?? []).map((item) => (
                    <div key={item.ip} className="flex items-center justify-between rounded-md border border-border/50 bg-card/50 px-2 py-2">
                      <div>
                        <p className="font-medium">{item.ip}</p>
                        <p className="text-[11px] text-muted-foreground">{item.reason || "No reason"} {item.expiresAt ? `• Expires ${formatShortTime(item.expiresAt)}` : "• Permanent"}</p>
                      </div>
                      <button onClick={() => handleUnbanIp(item.ip)} className="h-8 rounded-md border border-border/60 px-2 text-[11px] text-foreground/90">Unban</button>
                    </div>
                  ))}
                  {!(ipBansQuery.data?.items ?? []).length ? <EmptyStateNote text="No active IP bans." /> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Backend, Frontend, and Storage Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Backend</p>
                  <p className={`mt-1 text-lg font-semibold ${healthQuery.data?.backend.ok ? "text-emerald-300" : "text-rose-300"}`}>
                    {healthQuery.data?.backend.ok ? "Healthy" : "Issue"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Queue: {healthQuery.data?.backend.queueDepth ?? 0}</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Frontend</p>
                  <p className={`mt-1 text-lg font-semibold ${healthQuery.data?.frontend.ok ? "text-emerald-300" : "text-rose-300"}`}>
                    {healthQuery.data?.frontend.ok ? "Healthy" : "Issue"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Latency: {healthQuery.data?.frontend.latencyMs ?? 0}ms</p>
                </div>
                <div className="rounded-md border border-border/50 bg-card/40 p-3">
                  <p className="text-muted-foreground">Storage</p>
                  <p className={`mt-1 text-lg font-semibold ${healthQuery.data?.storage.ok ? "text-emerald-300" : "text-rose-300"}`}>
                    {healthQuery.data?.storage.ok ? "Healthy" : "Issue"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Provider: {healthQuery.data?.storage.provider || "-"}</p>
                </div>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-[11px] text-muted-foreground">Last checked: {formatShortTime(healthQuery.data?.checkedAt)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Node: {healthQuery.data?.backend.nodeVersion || "-"} • {healthQuery.data?.backend.platform || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Security Posture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-muted-foreground">Security Score</p>
                <p className="text-3xl font-bold">{(securityQuery.data?.score ?? 0).toFixed(1)}</p>
                <p className="uppercase tracking-wide text-primary/80">{securityQuery.data?.riskLevel || "unknown"} risk</p>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {(securityQuery.data?.checks ?? []).map((check) => (
                  <div key={check.key} className="rounded-md border border-border/50 bg-card/40 p-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{check.label}</p>
                      <Badge variant="outline" className={check.ok ? "text-emerald-200 border-emerald-500/40" : "text-rose-200 border-rose-500/40"}>
                        {check.ok ? "OK" : "Fix"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
                {!(securityQuery.data?.checks ?? []).length ? <EmptyStateNote text="No security checks available yet." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Weekly Statistics Email Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={weeklyReportEmail} onChange={(e) => setWeeklyReportEmail(e.target.value)} placeholder="Report email" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={weeklyReportEnabled} onChange={(e) => setWeeklyReportEnabled(e.target.checked)} />
                  Weekly enabled
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={actionLoading} onClick={handleSaveWeeklyReport} className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-xs">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  Save Schedule
                </button>
                <button
                  disabled={actionLoading || !weeklyProviderConfigured}
                  onClick={handleSendWeeklyNow}
                  className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Send Test Now
                </button>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Provider: {weeklyProviderName} • {weeklyProviderConfigured ? "configured" : "not configured"}
                </p>
                {!weeklyProviderConfigured ? (
                  <p className="mt-1 text-[11px] text-amber-300">
                    Configure WEEKLY_REPORT_WEBHOOK_URL or RESEND_API_KEY to enable weekly report emails.
                  </p>
                ) : null}
                <div className="mt-2 max-h-40 space-y-2 overflow-auto pr-1">
                  {(weeklyReportsQuery.data?.subscriptions ?? []).map((subscription) => (
                    <div key={subscription.id} className="rounded-md border border-border/50 bg-card/50 p-2">
                      <p className="font-medium">{subscription.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {subscription.enabled ? "Enabled" : "Disabled"} • Next: {formatShortTime(subscription.nextSendAt || undefined)} • Last sent: {formatShortTime(subscription.lastSentAt || undefined)}
                      </p>
                      {subscription.lastError ? <p className="text-[11px] text-rose-300">Last error: {subscription.lastError}</p> : null}
                    </div>
                  ))}
                  {!(weeklyReportsQuery.data?.subscriptions ?? []).length ? (
                    <EmptyStateNote text="No weekly report subscribers yet." />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-primary/30 animate-panel-float">
            <CardHeader>
              <CardTitle className="text-sm">AI Intelligence Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Avg Predicted Retention</p>
                <p className="text-xl font-semibold">{(retentionEngine?.avgPredictedRetentionScorePerRender ?? 0).toFixed(1)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Hook Strength (0-100)</p>
                <p className="text-xl font-semibold">{(retentionEngine?.hookStrengthScore ?? 0).toFixed(1)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Strong Hooks Coverage</p>
                <p className="text-xl font-semibold">{(retentionEngine?.strongHooksPct ?? 0).toFixed(1)}%</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Avg First 8s Engagement</p>
                <p className="text-xl font-semibold">{(retentionEngine?.avgFirst8SecEngagementScore ?? 0).toFixed(1)}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Drop-off Risk</p>
                <p className="text-xl font-semibold text-rose-200">{(retentionEngine?.dropOffRiskPredictionPct ?? 0).toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 xl:col-span-2 animate-panel-float-delayed">
            <CardHeader>
              <CardTitle className="text-sm">Emotional Intensity + Boring Segment Heatmap</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              <div className="h-52 rounded-md border border-border/50 bg-card/40 p-2">
                {(retentionEngine?.emotionalIntensityGraph ?? []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionEngine?.emotionalIntensityGraph ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="v" stroke="hsl(352 87% 64%)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No emotional intensity graph yet." />
                  </div>
                )}
              </div>
              <div className="h-52 rounded-md border border-border/50 bg-card/40 p-2">
                {(retentionEngine?.boringSegmentHeatmap ?? []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={retentionEngine?.boringSegmentHeatmap ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                      <XAxis dataKey="segment" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="v" fill="hsl(34 94% 62%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No boring-segment heatmap data yet." />
                  </div>
                )}
              </div>
              <div className="h-44 rounded-md border border-border/50 bg-card/40 p-2 lg:col-span-2">
                {retentionBrainMap.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionBrainMap}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="predictedAttention" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="hook" stroke="hsl(184 80% 58%)" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="captionImpact" stroke="hsl(120 70% 48%)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No retention brain-map points yet." />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60 animate-panel-float">
            <CardHeader>
              <CardTitle className="text-sm">Revenue Command Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">MRR</p><p className="text-xl font-semibold">{formatMoney(revenueCenter?.mrr ?? 0)}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">ARR</p><p className="text-xl font-semibold">{formatMoney(revenueCenter?.arrProjection ?? 0)}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Churn</p><p className="text-xl font-semibold">{(revenueCenter?.churnRatePct ?? 0).toFixed(1)}%</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Upgrade Conversion</p><p className="text-xl font-semibold">{(revenueCenter?.upgradeConversionRatePct ?? 0).toFixed(1)}%</p></div>
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2"><p className="text-amber-200">Founder Sales</p><p className="text-xl font-semibold text-amber-100">{revenueCenter?.founderPlanSalesCount ?? 0} / {revenueCenter?.founderPlanAutoRemoveAt ?? 100}</p></div>
                <div className={`rounded-md border p-2 ${revenueCenter?.founderPlanSoldOut ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}>
                  <p>{revenueCenter?.founderPlanSoldOut ? "Founder Plan Sold Out" : "Founder Plan Available"}</p>
                  <p className="text-[11px]">Remaining: {revenueCenter?.founderPlanRemainingSlots ?? 0}</p>
                </div>
              </div>
              <div className="h-44 rounded-md border border-border/50 bg-card/40 p-2">
                {(revenueCenter?.revenueVsRenderUsage ?? []).length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueCenter?.revenueVsRenderUsage ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                      <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(152 74% 45%)" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="renders" stroke="hsl(204 90% 60%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyStateNote text="No revenue-vs-render trend data yet." />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Failed payment alerts: {revenueCenter?.failedPaymentAlerts ?? 0} • Webhook logs: {(revenueCenter?.stripeWebhookLogs ?? []).length}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 animate-panel-float-delayed">
            <CardHeader>
              <CardTitle className="text-sm">Render Infrastructure Monitor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Queue</p><p className="text-xl font-semibold">{renderInfra?.activeJobsInQueue ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Avg Processing</p><p className="text-xl font-semibold">{(renderInfra?.avgProcessingTimeSec ?? 0).toFixed(1)}s</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">CPU / GPU</p><p className="text-xl font-semibold">{(renderInfra?.cpuUtilizationPct ?? 0).toFixed(1)}% / {(renderInfra?.gpuUtilizationPct ?? 0).toFixed(1)}%</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Cost / Render</p><p className="text-xl font-semibold">{formatMoney(renderInfra?.costPerRenderEstimateUsd ?? 0)}</p></div>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                <p className="text-muted-foreground">Storage Usage</p>
                <div className="mt-2 h-2 rounded-full bg-background/60">
                  <div className="h-2 rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, renderInfra?.storageUsage.pct ?? 0))}%` }} />
                </div>
                <p className="mt-1 text-[11px]">{(renderInfra?.storageUsage.gb ?? 0).toFixed(2)} GB • {(renderInfra?.storageUsage.pct ?? 0).toFixed(1)}%</p>
              </div>
              <div className={`rounded-md border p-2 ${renderInfra?.processingTimeSpikeAlert.active ? "border-rose-500/40 bg-rose-500/10 text-rose-200 animate-alert-glow" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
                <p className="font-semibold">
                  {renderInfra?.processingTimeSpikeAlert.active ? "Red Alert: Processing Time Spike" : "Processing Time Stable"}
                </p>
                <p className="text-[11px]">
                  Current {renderInfra?.processingTimeSpikeAlert.currentSec?.toFixed(1) ?? "0.0"}s vs baseline {renderInfra?.processingTimeSpikeAlert.baselineSec?.toFixed(1) ?? "0.0"}s
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Live Error Terminal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Backend Logs</p><p className="text-xl font-semibold">{liveTerminal?.backendLogCount24h ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Frontend Errors</p><p className="text-xl font-semibold">{liveTerminal?.frontendErrorCount24h ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">API 401</p><p className="text-xl font-semibold">{liveTerminal?.api401Count24h ?? 0}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">API 500</p><p className="text-xl font-semibold">{liveTerminal?.api500Count24h ?? 0}</p></div>
              </div>
              <div className="max-h-40 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                {(liveTerminal?.groupedErrors ?? []).slice(0, 8).map((item, idx) => (
                  <p key={`${item.type}-${idx}`} className="mb-1 line-clamp-1">{item.severity.toUpperCase()} • {item.type} ({item.count})</p>
                ))}
                {!(liveTerminal?.groupedErrors ?? []).length ? <EmptyStateNote text="No grouped live errors." /> : null}
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
                <p className="text-[11px] uppercase tracking-wide">AI Fix Suggestion</p>
                <p>{liveTerminal?.fixSuggestion || "No suggestions right now."}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60 animate-panel-float-delayed">
            <CardHeader>
              <CardTitle className="text-sm">User Intelligence Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Active Users</p><p className="text-xl font-semibold">{liveGeoActiveUsers}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Avg Watch Length</p><p className="text-xl font-semibold">{(userIntel?.averageWatchLengthSec ?? 0).toFixed(1)}s</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Suspicious Activity</p><p className={`text-xl font-semibold ${userIntel?.suspiciousActivityFlag ? "text-rose-200" : "text-emerald-200"}`}>{userIntel?.suspiciousActivityFlag ? "Flagged" : "Normal"}</p></div>
                <div className="rounded-md border border-border/50 bg-card/40 p-2"><p className="text-muted-foreground">Whales Close to Upgrade</p><p className="text-xl font-semibold">{(userIntel?.whaleDetector ?? []).length}</p></div>
              </div>
              <LiveUsersGlobe points={liveGeoRows} activeUsers={liveGeoActiveUsers} updatedAt={liveGeoUpdatedAt} />
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="max-h-36 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Top Render Users</p>
                  {(userIntel?.topUsersByRenders ?? []).slice(0, 6).map((row) => (
                    <p key={row.userId} className="mb-1 line-clamp-1">{row.email || row.userId} • {row.renders} renders • {row.planTier}</p>
                  ))}
                  {!(userIntel?.topUsersByRenders ?? []).length ? <EmptyStateNote text="No top render users yet." /> : null}
                </div>
                <div className="max-h-36 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Top Countries</p>
                  {countryRollup.map((row) => (
                    <p key={row.country} className="mb-1">
                      {row.country} • {row.sessions} sessions • {row.users} users
                    </p>
                  ))}
                  {!countryRollup.length ? <EmptyStateNote text="No geo heatmap records yet." /> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Experiment Lab A/B</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(experimentIntel?.variantPerformance ?? []).map((variant) => (
                <div key={variant.variant} className="rounded-md border border-border/50 bg-card/40 p-2">
                  <p className="font-semibold">{variant.variant}</p>
                  <p className="text-muted-foreground">Predicted retention: {variant.predictedRetention.toFixed(1)}</p>
                  <p className="text-muted-foreground">Paid conversion: {variant.paidConversionPct.toFixed(2)}%</p>
                </div>
              ))}
              {!(experimentIntel?.variantPerformance ?? []).length ? <EmptyStateNote text="No experiment variants have reported data." /> : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Editor Quality Analyzer</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="text-muted-foreground">Low quality renders (&lt; 70): <span className="font-semibold text-rose-200">{qualityAnalyzer?.lowQualityCount ?? 0}</span></p>
              <div className="max-h-44 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                {(qualityAnalyzer?.renders ?? []).slice(0, 8).map((row) => (
                  <div key={row.jobId} className="mb-2 rounded border border-border/40 p-2">
                    <p className="line-clamp-1 font-medium">{row.jobId}</p>
                    <p className="text-muted-foreground">Hook {row.hookScore.toFixed(1)} • Pacing {row.pacingScore.toFixed(1)} • Story {row.storyCoherenceScore.toFixed(1)}</p>
                    <p className={row.isPremiumQuality ? "text-emerald-200" : "text-rose-200"}>
                      Quality {row.qualityScore.toFixed(1)} {row.isPremiumQuality ? "Premium" : "Not Premium Quality"}
                    </p>
                  </div>
                ))}
                {!(qualityAnalyzer?.renders ?? []).length ? <EmptyStateNote text="No quality-analyzer renders available." /> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Feedback Intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="rounded-md border border-border/50 bg-card/40 p-2 text-muted-foreground">{feedbackIntel?.supportSummary || "No support summary yet."}</p>
              <p>Sentiment score: <span className="font-semibold">{(feedbackIntel?.sentimentScore ?? 0).toFixed(2)}</span></p>
              <div className="max-h-36 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                {(feedbackIntel?.clusters ?? []).slice(0, 8).map((cluster) => (
                  <p key={cluster.cluster} className="mb-1">{cluster.cluster} • {cluster.count} • {cluster.sentimentTag}</p>
                ))}
                {!(feedbackIntel?.clusters ?? []).length ? <EmptyStateNote text="No feedback clusters available." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-3">
          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Cost Control Panel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p>Cost / User: <span className="font-semibold">{formatMoney(costControl?.costPerUserUsd ?? 0)}</span></p>
              <p>Cost / Render: <span className="font-semibold">{formatMoney(costControl?.costPerRenderUsd ?? 0)}</span></p>
              <p>Burn Rate: <span className="font-semibold">{formatMoney(costControl?.infrastructureBurnRateUsdMonthly ?? 0)}</span></p>
              <p>Profit Margin: <span className="font-semibold">{(costControl?.profitMarginPct ?? 0).toFixed(1)}%</span></p>
              <p className={`${(costControl?.runwayMonths ?? 0) < 12 ? "text-rose-200" : "text-emerald-200"}`}>
                At current growth runway: {(costControl?.runwayMonths ?? 0).toFixed(1)} months
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Security Panel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p>Suspicious login attempts: <span className="font-semibold">{securityPanel?.suspiciousLoginAttempts ?? 0}</span></p>
              <p>Rate limit 429 (24h): <span className="font-semibold">{securityPanel?.rateLimitMonitor.status429Count24h ?? 0}</span></p>
              <p>Token near expiry sessions: <span className="font-semibold">{securityPanel?.tokenExpirationTracking.nearingTimeoutSessions ?? 0}</span></p>
              <p>R2 key configured: <span className="font-semibold">{securityPanel?.r2KeyUsageLog.configured ? "yes" : "no"}</span></p>
              <p>Webhook verification: <span className={`font-semibold ${securityPanel?.webhookVerificationStatus.healthy ? "text-emerald-200" : "text-rose-200"}`}>{securityPanel?.webhookVerificationStatus.healthy ? "healthy" : "degraded"}</span></p>
              <div className="max-h-28 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                {(securityPanel?.adminAccessLogs ?? []).slice(0, 5).map((log) => (
                  <p key={log.id} className="mb-1 line-clamp-1">{log.action} • {log.actor || "unknown"} • {formatShortTime(log.createdAt)}</p>
                ))}
                {!(securityPanel?.adminAccessLogs ?? []).length ? <EmptyStateNote text="No admin access logs available." /> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Conversion + Scaling Intel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p>Upload completion: <span className="font-semibold">{(conversionIntel?.uploadCompletionPct ?? 0).toFixed(1)}%</span></p>
              <p>Trial to paid: <span className="font-semibold">{(conversionIntel?.trialToPaidConversionPct ?? 0).toFixed(1)}%</span></p>
              <p>CDN health: <span className={`font-semibold ${scalingPanel?.cdnHealth.ok ? "text-emerald-200" : "text-rose-200"}`}>{scalingPanel?.cdnHealth.ok ? "healthy" : "not configured"}</span></p>
              <p>Cache hit rate: <span className="font-semibold">{(scalingPanel?.cacheHitRatePct ?? 0).toFixed(1)}%</span></p>
              <p>Queue scaling trigger: <span className="font-semibold">{scalingPanel?.autoScaleWorkerTriggers.active ? `active (${scalingPanel?.autoScaleWorkerTriggers.suggestedWorkers} workers)` : "idle"}</span></p>
              <div className="max-h-28 overflow-auto rounded-md border border-border/50 bg-card/40 p-2">
                {(conversionIntel?.onboardingDropOff ?? []).map((step) => (
                  <p key={step.step} className="mb-1">{step.step}: {formatCompactNumber(step.count)} {step.dropOffPct > 0 ? `• drop ${step.dropOffPct.toFixed(1)}%` : ""}</p>
                ))}
                {!(conversionIntel?.onboardingDropOff ?? []).length ? <EmptyStateNote text="No onboarding drop-off events yet." /> : null}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-primary/30">
            <CardHeader><CardTitle className="text-sm">AI Self-Improvement Panel</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">Analyze the last renders and generate pipeline upgrades automatically.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={selfImproveCount} onChange={(e) => setSelfImproveCount(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                <button disabled={actionLoading} onClick={handleRunSelfImprovement} className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-60">
                  Analyze last renders
                </button>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                {(selfImproveResult?.suggestions ?? empire?.aiSelfImprovementPanel?.quickSuggestions?.map((title, index) => ({ priority: index + 1, title, expectedImpact: "", difficulty: "medium" })) ?? []).slice(0, 5).map((item) => (
                  <p key={`${item.title}-${item.priority}`} className="mb-1 line-clamp-2">{item.priority}. {item.title}</p>
                ))}
                {!(selfImproveResult?.suggestions ?? empire?.aiSelfImprovementPanel?.quickSuggestions ?? []).length ? (
                  <EmptyStateNote text="No self-improvement suggestions yet." />
                ) : null}
              </div>
              {selfImproveResult ? (
                <p className="text-muted-foreground">
                  Last run: {formatShortTime(selfImproveResult.generatedAt)} • Failed: {selfImproveResult.failedRenders} • Low quality: {selfImproveResult.lowQualityCount}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Hidden Founder Tools</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={lifetimeEmail} onChange={(e) => setLifetimeEmail(e.target.value)} placeholder="Grant lifetime email" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                <input value={lifetimeUserId} onChange={(e) => setLifetimeUserId(e.target.value)} placeholder="or user ID" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                <button disabled={actionLoading} onClick={handleGrantLifetime} className="h-9 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-emerald-200">Grant Lifetime</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={founderJobId} onChange={(e) => setFounderJobId(e.target.value)} placeholder="Job ID for reprocess/kill" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                <button disabled={actionLoading} onClick={handleFounderReprocess} className="h-9 rounded-md border border-primary/40 bg-primary/10 px-2 text-primary">Force Reprocess Job</button>
                <button disabled={actionLoading} onClick={handleFounderKillJob} className="h-9 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 text-rose-200">Kill Stuck Job</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={refundEventId} onChange={(e) => setRefundEventId(e.target.value)} placeholder="Stripe event ID for refund" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                <button disabled={actionLoading} onClick={handleFounderRefund} className="h-9 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-amber-200 sm:col-span-2">Refund Stripe Payment</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={webhookType} onChange={(e) => setWebhookType(e.target.value)} placeholder="Webhook type" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2" />
                <input value={webhookAmountCents} onChange={(e) => setWebhookAmountCents(e.target.value)} placeholder="Amount cents" className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs" />
                <button disabled={actionLoading} onClick={handleSimulateWebhook} className="h-9 rounded-md border border-border/60 px-2 text-xs sm:col-span-2">Simulate Webhook</button>
                <select value={testUserPlanTier} onChange={(e) => setTestUserPlanTier(e.target.value)} className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs">
                  <option value="free">free</option>
                  <option value="starter">starter</option>
                  <option value="creator">creator</option>
                  <option value="studio">studio</option>
                  <option value="founder">founder</option>
                </select>
                <button disabled={actionLoading} onClick={handleGenerateTestUser} className="h-9 rounded-md border border-border/60 px-2 text-xs sm:col-span-3">Generate Internal Test User</button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default ControlPanel;
