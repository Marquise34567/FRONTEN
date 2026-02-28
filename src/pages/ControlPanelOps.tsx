import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Mail, Rocket, Send, Sparkles, Wand2 } from "lucide-react"
import Navbar from "@/components/Navbar"
import ControlPanelPageNav from "@/components/control-panel/ControlPanelPageNav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"

type WeeklyReportsResponse = {
  provider: {
    configured: boolean
    provider: string
  }
  subscriptions: Array<{
    id: string
    email: string
    enabled: boolean
    createdBy: string | null
    lastSentAt: string | null
    nextSendAt: string | null
    lastError: string | null
  }>
  updatedAt: string
}

type SelfImproveResponse = {
  analyzedRenders: number
  completedRenders: number
  failedRenders: number
  lowQualityCount: number
  averageUploadToRenderSeconds: number
  topFailures: Array<{ reason: string; count: number }>
  complaintTags: Array<{ tag: string; count: number }>
  suggestions: Array<{ priority: number; title: string; expectedImpact: string; difficulty: string }>
  generatedAt: string
}

const formatShortTime = (iso?: string) => {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

const EmptyStateNote = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed border-border/55 bg-card/25 px-3 py-2 text-[11px] text-muted-foreground">
    {text}
  </div>
)

const ControlPanelOps = () => {
  const { accessToken } = useAuth()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [weeklyReportEmail, setWeeklyReportEmail] = useState("marquiseedwards00@gmail.com")
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true)

  const [selfImproveCount, setSelfImproveCount] = useState("1000")
  const [selfImproveResult, setSelfImproveResult] = useState<SelfImproveResponse | null>(null)

  const [lifetimeEmail, setLifetimeEmail] = useState("")
  const [lifetimeUserId, setLifetimeUserId] = useState("")
  const [founderJobId, setFounderJobId] = useState("")
  const [refundEventId, setRefundEventId] = useState("")
  const [webhookType, setWebhookType] = useState("invoice.paid")
  const [webhookAmountCents, setWebhookAmountCents] = useState("9900")
  const [testUserPlanTier, setTestUserPlanTier] = useState("free")
  const [grantSubscriptionEmail, setGrantSubscriptionEmail] = useState("")
  const [grantSubscriptionUserId, setGrantSubscriptionUserId] = useState("")
  const [grantSubscriptionPlanTier, setGrantSubscriptionPlanTier] = useState("starter")
  const [grantSubscriptionDurationDays, setGrantSubscriptionDurationDays] = useState("30")
  const [grantSubscriptionReason, setGrantSubscriptionReason] = useState("manual_control_panel_grant")

  const canLoad = Boolean(accessToken)
  const weeklyReportsQuery = useQuery({
    queryKey: ["control-panel-ops-weekly-reports"],
    queryFn: () => apiFetch<WeeklyReportsResponse>("/api/admin/reports/weekly", { token: accessToken || "" }),
    enabled: canLoad,
    refetchInterval: 30000
  })

  const runOpsAction = async (path: string, init: RequestInit, successMessage: string, refetchWeekly = false) => {
    if (!accessToken) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await apiFetch(path, { ...init, token: accessToken })
      setActionSuccess(successMessage)
      if (refetchWeekly) {
        await weeklyReportsQuery.refetch()
      }
    } catch (error: any) {
      setActionError(error?.message || "Action failed.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveWeeklyReport = async () => {
    await runOpsAction(
      "/api/admin/reports/weekly",
      {
        method: "POST",
        body: JSON.stringify({
          email: weeklyReportEmail,
          enabled: weeklyReportEnabled
        })
      },
      "Weekly report schedule saved.",
      true
    )
  }

  const handleSendWeeklyNow = async () => {
    if (!weeklyReportsQuery.data?.provider.configured) {
      setActionSuccess(null)
      setActionError("Configure WEEKLY_REPORT_WEBHOOK_URL or RESEND_API_KEY before sending weekly reports.")
      return
    }
    await runOpsAction(
      "/api/admin/reports/weekly/send-now",
      {
        method: "POST",
        body: JSON.stringify({
          email: weeklyReportEmail
        })
      },
      "Weekly report sent.",
      true
    )
  }

  const handleRunSelfImprovement = async () => {
    if (!accessToken) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const result = await apiFetch<SelfImproveResponse>("/api/admin/ai-self-improvement", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          count: Number(selfImproveCount || 1000)
        })
      })
      setSelfImproveResult(result)
      setActionSuccess(`AI analyzed ${result.analyzedRenders} renders and generated upgrade recommendations.`)
    } catch (error: any) {
      setActionError(error?.message || "AI self-improvement analysis failed.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleGrantLifetime = async () => {
    await runOpsAction(
      "/api/admin/founder-tools/grant-lifetime",
      {
        method: "POST",
        body: JSON.stringify({
          email: lifetimeEmail || undefined,
          userId: lifetimeUserId || undefined
        })
      },
      "Lifetime founder access granted."
    )
  }

  const handleFounderReprocess = async () => {
    if (!founderJobId.trim()) {
      setActionError("Job ID is required.")
      return
    }
    await runOpsAction(
      "/api/admin/founder-tools/reprocess-job",
      {
        method: "POST",
        body: JSON.stringify({
          jobId: founderJobId.trim()
        })
      },
      "Job reprocess queued."
    )
  }

  const handleFounderKillJob = async () => {
    if (!founderJobId.trim()) {
      setActionError("Job ID is required.")
      return
    }
    await runOpsAction(
      "/api/admin/founder-tools/kill-job",
      {
        method: "POST",
        body: JSON.stringify({
          jobId: founderJobId.trim()
        })
      },
      "Stuck job terminated."
    )
  }

  const handleFounderRefund = async () => {
    if (!refundEventId.trim()) {
      setActionError("Stripe event ID is required.")
      return
    }
    await runOpsAction(
      "/api/admin/founder-tools/refund-payment",
      {
        method: "POST",
        body: JSON.stringify({
          eventId: refundEventId.trim()
        })
      },
      "Refund request sent to Stripe."
    )
  }

  const handleSimulateWebhook = async () => {
    await runOpsAction(
      "/api/admin/founder-tools/simulate-webhook",
      {
        method: "POST",
        body: JSON.stringify({
          type: webhookType,
          amountCents: Number(webhookAmountCents || 0)
        })
      },
      "Webhook event simulated."
    )
  }

  const handleGenerateTestUser = async () => {
    await runOpsAction(
      "/api/admin/founder-tools/generate-test-user",
      {
        method: "POST",
        body: JSON.stringify({
          planTier: testUserPlanTier
        })
      },
      "Internal test user created."
    )
  }

  const handleGrantSubscription = async () => {
    if (!grantSubscriptionEmail.trim() && !grantSubscriptionUserId.trim()) {
      setActionError("Provide an email or user ID to grant a subscription.")
      setActionSuccess(null)
      return
    }
    const durationDaysRaw = Number.parseInt(grantSubscriptionDurationDays || "30", 10)
    const durationDays = Number.isFinite(durationDaysRaw)
      ? Math.min(3650, Math.max(1, durationDaysRaw))
      : 30
    await runOpsAction(
      "/api/admin/subscriptions/grant",
      {
        method: "POST",
        body: JSON.stringify({
          email: grantSubscriptionEmail || undefined,
          userId: grantSubscriptionUserId || undefined,
          planTier: grantSubscriptionPlanTier,
          durationDays,
          reason: grantSubscriptionReason || undefined
        })
      },
      `Granted ${grantSubscriptionPlanTier} for ${durationDays} day(s).`
    )
  }

  const weeklyProviderConfigured = Boolean(weeklyReportsQuery.data?.provider.configured)
  const weeklyProviderName = weeklyReportsQuery.data?.provider.provider || "unknown"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,hsl(var(--primary)/0.22),transparent_55%),linear-gradient(180deg,hsl(232_24%_8%)_0%,hsl(228_22%_6%)_100%)] text-foreground">
      <Navbar />
      <main className="editor-landing-skin responsive-main control-panel-main relative mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-8">
        <ControlPanelPageNav
          title="Ops Tools"
          subtitle="Automation controls, weekly reporting, and founder-only operational actions."
        />

        {!canLoad ? (
          <div className="mt-4">
            <EmptyStateNote text="Sign in to use control-panel ops tools." />
          </div>
        ) : null}

        <div className="mb-6 mt-4 flex flex-col gap-2">
          {actionError ? <p className="text-xs text-rose-300">{actionError}</p> : null}
          {actionSuccess ? <p className="text-xs text-emerald-300">{actionSuccess}</p> : null}
        </div>

        <section className="mt-8">
          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Weekly Statistics Email Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={weeklyReportEmail}
                  onChange={(e) => setWeeklyReportEmail(e.target.value)}
                  placeholder="Report email"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2"
                />
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={weeklyReportEnabled}
                    onChange={(e) => setWeeklyReportEnabled(e.target.checked)}
                  />
                  Weekly enabled
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={actionLoading}
                  onClick={handleSaveWeeklyReport}
                  className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-xs"
                >
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
          <Card className="glass-card border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Self-Improvement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">Analyze recent renders and generate upgrade recommendations automatically.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={selfImproveCount}
                  onChange={(e) => setSelfImproveCount(e.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <button
                  disabled={actionLoading}
                  onClick={handleRunSelfImprovement}
                  className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-60"
                >
                  <Wand2 className="mr-2 h-3.5 w-3.5" />
                  Analyze last renders
                </button>
              </div>
              <div className="rounded-md border border-border/50 bg-card/40 p-2">
                {(selfImproveResult?.suggestions ?? []).slice(0, 5).map((item) => (
                  <p key={`${item.title}-${item.priority}`} className="mb-1 line-clamp-2">
                    {item.priority}. {item.title}
                  </p>
                ))}
                {!(selfImproveResult?.suggestions ?? []).length ? (
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

          <Card className="glass-card border-cyan-300/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 text-cyan-200" />
                Subscription Grant Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground">Grant starter/creator/studio/founder access to any user directly from ops.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={grantSubscriptionEmail}
                  onChange={(e) => setGrantSubscriptionEmail(e.target.value)}
                  placeholder="Target email"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <input
                  value={grantSubscriptionUserId}
                  onChange={(e) => setGrantSubscriptionUserId(e.target.value)}
                  placeholder="or user ID"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <select
                  value={grantSubscriptionPlanTier}
                  onChange={(e) => setGrantSubscriptionPlanTier(e.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                >
                  <option value="starter">starter</option>
                  <option value="creator">creator</option>
                  <option value="studio">studio</option>
                  <option value="founder">founder</option>
                </select>
                <input
                  value={grantSubscriptionDurationDays}
                  onChange={(e) => setGrantSubscriptionDurationDays(e.target.value)}
                  placeholder="Duration days"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <input
                  value={grantSubscriptionReason}
                  onChange={(e) => setGrantSubscriptionReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2"
                />
              </div>
              <button
                disabled={actionLoading}
                onClick={handleGrantSubscription}
                className="h-9 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 text-cyan-100 disabled:opacity-60"
              >
                Grant Subscription
              </button>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 text-amber-300" />
                Founder Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={lifetimeEmail}
                  onChange={(e) => setLifetimeEmail(e.target.value)}
                  placeholder="Grant lifetime email"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <input
                  value={lifetimeUserId}
                  onChange={(e) => setLifetimeUserId(e.target.value)}
                  placeholder="or user ID"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <button
                  disabled={actionLoading}
                  onClick={handleGrantLifetime}
                  className="h-9 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-emerald-200"
                >
                  Grant Lifetime
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={founderJobId}
                  onChange={(e) => setFounderJobId(e.target.value)}
                  placeholder="Job ID for reprocess/kill"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2"
                />
                <button
                  disabled={actionLoading}
                  onClick={handleFounderReprocess}
                  className="h-9 rounded-md border border-primary/40 bg-primary/10 px-2 text-primary"
                >
                  Force Reprocess Job
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleFounderKillJob}
                  className="h-9 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 text-rose-200"
                >
                  Kill Stuck Job
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={refundEventId}
                  onChange={(e) => setRefundEventId(e.target.value)}
                  placeholder="Stripe event ID for refund"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2"
                />
                <button
                  disabled={actionLoading}
                  onClick={handleFounderRefund}
                  className="h-9 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-amber-200 sm:col-span-2"
                >
                  Refund Stripe Payment
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={webhookType}
                  onChange={(e) => setWebhookType(e.target.value)}
                  placeholder="Webhook type"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs sm:col-span-2"
                />
                <input
                  value={webhookAmountCents}
                  onChange={(e) => setWebhookAmountCents(e.target.value)}
                  placeholder="Amount cents"
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                />
                <button
                  disabled={actionLoading}
                  onClick={handleSimulateWebhook}
                  className="h-9 rounded-md border border-border/60 px-2 text-xs sm:col-span-2"
                >
                  Simulate Webhook
                </button>
                <select
                  value={testUserPlanTier}
                  onChange={(e) => setTestUserPlanTier(e.target.value)}
                  className="h-9 rounded-md border border-border/60 bg-card/50 px-2 text-xs"
                >
                  <option value="free">free</option>
                  <option value="starter">starter</option>
                  <option value="creator">creator</option>
                  <option value="studio">studio</option>
                  <option value="founder">founder</option>
                </select>
                <button
                  disabled={actionLoading}
                  onClick={handleGenerateTestUser}
                  className="h-9 rounded-md border border-border/60 px-2 text-xs sm:col-span-3"
                >
                  Generate Internal Test User
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}

export default ControlPanelOps
