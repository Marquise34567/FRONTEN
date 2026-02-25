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
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, apiFetch } from "@/lib/api";
import { useMe } from "@/hooks/use-me";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Activity, DollarSign, Users, Layers, Timer, Globe2, Ban, Mail, Send } from "lucide-react";

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
    count: number;
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

const ControlPanel = () => {
  const { accessToken } = useAuth();
  const { data: me } = useMe();
  const devEnabled = Boolean(me?.flags?.dev);
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

  const canLoad = Boolean(accessToken && devEnabled);

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

  useEffect(() => {
    if (!canLoad || !accessToken) return;
    const streamPath = `/api/admin/stream?token=${encodeURIComponent(accessToken)}`;
    const streamUrl = API_URL ? `${API_URL}${streamPath}` : streamPath;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener("realtime", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as LiveRealtimePayload;
        setLive(payload);
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
      setStreamError("Live stream disconnected. Retrying...");
    };

    return () => {
      eventSource.close();
    };
  }, [accessToken, canLoad]);

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
        subscriptionsQuery.refetch(),
        siteLiveQuery.refetch(),
        healthQuery.refetch(),
        securityQuery.refetch(),
        ipBansQuery.refetch(),
        weeklyReportsQuery.refetch(),
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

  const summary = overviewQuery.data?.summary;
  const graphs = overviewQuery.data?.graphs;
  const effectiveActiveUsers = live?.activeUsers ?? summary?.activeUsers ?? realtimeUsersQuery.data?.activeUsers ?? 0;
  const effectiveJobsInQueue = live?.jobsInQueue ?? summary?.jobsInQueue ?? 0;
  const effectiveJobsFailed = live?.jobsFailed24h ?? summary?.jobsFailed24h ?? 0;
  const effectiveImpressions5m =
    live?.websiteImpressions5m ?? siteLiveQuery.data?.impressionsLast5m ?? summary?.websiteImpressions5m ?? 0;
  const effectiveImpressions24h =
    live?.websiteImpressions24h ?? siteLiveQuery.data?.impressionsLast24h ?? summary?.websiteImpressions24h ?? 0;

  const topIssues = feedbackQuery.data?.topIssues ?? [];
  const topIssueData = useMemo(() => topIssues.slice(0, 6), [topIssues]);

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_120%_at_50%_0%,hsl(var(--primary)/0.22),transparent_55%),linear-gradient(180deg,hsl(232_24%_8%)_0%,hsl(228_22%_6%)_100%)] text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-primary/80">Developer Control Panel</p>
          <h1 className="font-premium text-3xl text-foreground md:text-4xl">System Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Hidden internal panel for live ops, failures, subscriptions, payments, and editor optimization insights.
          </p>
          {streamError ? <p className="text-xs text-amber-300">{streamError}</p> : null}
          {liveErrorEntry ? <p className="text-xs text-rose-300">New error: {liveErrorEntry}</p> : null}
          {actionError ? <p className="text-xs text-rose-300">{actionError}</p> : null}
          {actionSuccess ? <p className="text-xs text-emerald-300">{actionSuccess}</p> : null}
        </div>

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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphs?.activeUsers ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} />
                  <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Job Success vs Failure</CardTitle></CardHeader>
            <CardContent className="h-64">
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
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Avg Render Time</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphs?.renderTimeAvg ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="t" tickFormatter={chartTick} stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} labelFormatter={(label) => formatShortTime(String(label))} formatter={(value) => [`${Number(value).toFixed(1)}s`, "Avg Render"]} />
                  <Line type="monotone" dataKey="v" stroke="hsl(42 96% 62%)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
            <CardContent className="h-64">
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
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Website Impressions Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
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
              <div><p className="mb-1 font-semibold">Common render failure reasons</p><ul className="space-y-1 text-muted-foreground">{(insightsQuery.data?.aggregates.commonFailureReasons ?? []).slice(0, 5).map((item) => (<li key={item.reason} className="flex items-center justify-between"><span className="truncate pr-2">{item.reason}</span><span>{item.count}</span></li>))}</ul></div>
              <div><p className="mb-1 font-semibold">Most requested features</p><ul className="space-y-1 text-muted-foreground">{(insightsQuery.data?.mostRequestedFeatures ?? []).slice(0, 5).map((item) => (<li key={item.feature} className="flex items-center justify-between"><span>{item.feature}</span><span>{item.count}</span></li>))}</ul></div>
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
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {(feedbackQuery.data?.items ?? []).slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/50 bg-card/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2"><p className="truncate font-medium">{item.category}</p><Badge variant="outline" className={`border ${sentimentColor(item.sentiment)}`}>{item.sentiment}</Badge></div>
                    <p className="text-muted-foreground">{item.note || "No notes"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatShortTime(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader><CardTitle className="text-sm">Top Issues Frequency</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIssueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="issue" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                <button disabled={actionLoading} onClick={handleSendWeeklyNow} className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary">
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Send Test Now
                </button>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Provider: {weeklyReportsQuery.data?.provider.provider || "unknown"} • {weeklyReportsQuery.data?.provider.configured ? "configured" : "not configured"}
                </p>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default ControlPanel;
