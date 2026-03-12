import { motion } from "framer-motion";
import { Fragment, lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
const GlowBackdrop = lazy(() => import("@/components/GlowBackdrop"));
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Copy, CreditCard, Shield, Sparkles, Users } from "lucide-react";
const PricingCards = lazy(() => import("@/components/PricingCards"));
import UpgradeModal from "@/components/UpgradeModal";
import LockedOverlay from "@/components/LockedOverlay";
import { useMe } from "@/hooks/use-me";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { useAuth } from "@/providers/AuthProvider";
import { ApiError, apiFetch } from "@/lib/api";
import { registerExportNotificationServiceWorker } from "@/lib/register-export-notification-sw";
import { useToast } from "@/hooks/use-toast";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import {
  MRBEAST_ANIMATION_OPTIONS,
  MRBEAST_FONT_OPTIONS,
  parseSubtitleStyleConfig,
  serializeSubtitleStyleConfig,
  type SubtitleStyleConfig,
} from "@shared/subtitlePresets";

type EditorSettings = {
  subtitleStyle: string;
  autoZoomMax: number;
  smartZoom: boolean;
  jumpCuts: boolean;
  transitions: boolean;
  soundFx: boolean;
  musicDuck: boolean;
  emotionalBoost: boolean;
  onlyCuts: boolean;
};

type SettingsResponse = {
  settings: EditorSettings;
  capabilities?: {
    captions?: {
      available: boolean;
      reason?: string | null;
      provider?: string | null;
      mode?: string | null;
    };
  };
  dailyEngagement?: DailyEngagementStatus;
};

type DailyEngagementStatus = {
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  nextSendAt?: string | null;
  lastSentAt?: string | null;
  provider?: {
    emailConfigured?: boolean;
    emailProvider?: string;
    webPushConfigured?: boolean;
    webPushPublicKey?: string | null;
  };
};

const vapidKeyToUint8Array = (vapidPublicKey: string) => {
  const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
  const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
};

const tierIndex = (tier: PlanTier) => PLAN_TIERS.indexOf(tier);

const getRequiredPlanForAutoZoom = (value: number): PlanTier => {
  if (value <= 1.1) return "free";
  if (value <= 1.12) return "starter";
  if (value <= 1.15) return "creator";
  return "studio";
};

const getRequiredPlanForPreset = (presetId: string): PlanTier => {
  const resolvedPreset = parseSubtitleStyleConfig(presetId).preset;
  for (const tier of PLAN_TIERS) {
    const allowed = PLAN_CONFIG[tier].allowedSubtitlePresets;
    if (allowed === "ALL" || allowed.includes(resolvedPreset)) return tier;
  }
  return "studio";
};

const Settings = () => {
  const { accessToken } = useAuth();
  const { data } = useMe();
  const [entitlements, setEntitlements] = useState<any | null>(null);
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  
  const { toast } = useToast();
  const { plan: currentPlan, features, subtitlePresets } = useSubscription();
  const { data: founderAvailability } = useFounderAvailability();
  const founderSlotsRemaining = founderAvailability?.remaining ?? 0;
  const trialInfo = data?.subscription?.trial;
  const trialActive = Boolean(trialInfo?.active);
  const trialUsed = Boolean(!trialActive && (trialInfo?.startedAt || trialInfo?.endsAt || trialInfo?.trialTier));
  const trialDaysRemaining = Number(trialInfo?.daysRemaining ?? 0);
  const trialEndsLabel = trialInfo?.endsAt ? new Date(trialInfo.endsAt).toLocaleString() : null;
  const allowedSubtitlePresets = features.subtitles.allowedPresets;
  const subtitlesEnabled = features.subtitles.enabled;
  const isPresetAllowed = (presetId: string) => {
    const resolvedPreset = parseSubtitleStyleConfig(presetId).preset;
    return subtitlesEnabled && (allowedSubtitlePresets === "ALL" || allowedSubtitlePresets.includes(resolvedPreset));
  };
  const subtitleBadge =
    allowedSubtitlePresets === "ALL"
      ? "All styles"
      : subtitlesEnabled
      ? `${allowedSubtitlePresets.length} styles`
      : "Locked";
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [requiredPlan, setRequiredPlan] = useState<PlanTier>("starter");
  const [editorSettings, setEditorSettings] = useState<EditorSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dailyEngagement, setDailyEngagement] = useState<DailyEngagementStatus | null>(null);
  const [savingDailyEmail, setSavingDailyEmail] = useState(false);
  const [savingDailyPush, setSavingDailyPush] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["editor-settings", data?.user?.id],
    queryFn: () => apiFetch<SettingsResponse>("/api/settings", { token: accessToken || "" }),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setEditorSettings({
        ...settingsQuery.data.settings,
        onlyCuts: false,
      });
    }
    if (settingsQuery.data?.dailyEngagement) {
      setDailyEngagement(settingsQuery.data.dailyEngagement);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch('/api/billing/entitlements', { token: accessToken })
      .then((d) => setEntitlements(d))
      .catch(() => setEntitlements(null));
  }, [accessToken]);

  

  const openUpgrade = (plan: PlanTier) => {
    setRequiredPlan(plan);
    setUpgradeOpen(true);
  };

  const handleCheckout = async (tier: PlanTier) => {
    if (!accessToken) return;
    try {
      setAction({ tier, kind: "subscribe" });
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval: billingInterval }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.code;
      if (code === "trial_already_used") {
        toast({ title: "Free trial already used", description: "Upgrade to continue with premium access." });
        return;
      }
      toast({ title: "Checkout failed", description: err?.message || "Please try again." });
    } finally {
      setAction(null);
    }
  };

  const handlePortal = async () => {
    if (!accessToken) return;
    try {
      const result = await apiFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: "Unable to open portal", description: err?.message || "Please try again." });
    }
  };

  const handleUpgrade = async () => {
    if (!accessToken) return;
    try {
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          tier: requiredPlan,
          interval: billingInterval,
        }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.code;
      if (code === "trial_already_used") {
        toast({ title: "Free trial already used", description: "Upgrade to continue with premium access." });
        return;
      }
      toast({ title: "Upgrade failed", description: err?.message || "Please try again." });
    }
  };

  const defaultSettings: EditorSettings = {
    subtitleStyle: "basic_clean",
    autoZoomMax: features.autoZoomMax,
    smartZoom: true,
    jumpCuts: true,
    transitions: true,
    soundFx: true,
    musicDuck: true,
    emotionalBoost: false,
    onlyCuts: false,
  };
  const resolvedSettings = editorSettings ?? defaultSettings;
  const onlyCutsEnabled = false;
  const captionCapability = settingsQuery.data?.capabilities?.captions;

  const mergeSettings = (updates: Partial<EditorSettings>) => {
    setEditorSettings((prev) => ({
      ...(prev ?? defaultSettings),
      ...updates,
    }));
  };

  const handleSaveSettings = async () => {
    if (!accessToken || !editorSettings) return;
    if (!isPresetAllowed(editorSettings.subtitleStyle)) {
      const required = getRequiredPlanForPreset(editorSettings.subtitleStyle);
      openUpgrade(required);
      toast({ title: "Upgrade required", description: `Upgrade to ${required} to unlock this subtitle style.` });
      return;
    }
    try {
      setSavingSettings(true);
      const payload = {
        ...editorSettings,
        onlyCuts: false,
      };
      const result = await apiFetch<SettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
        token: accessToken,
      });
      setEditorSettings({
        ...result.settings,
        onlyCuts: false,
      });
      toast({ title: "Settings saved", description: "Your editor preferences have been updated." });
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "PLAN_LIMIT_EXCEEDED") {
        const required = (err.data?.requiredPlan as PlanTier) || "creator";
        openUpgrade(required);
        toast({ title: "Upgrade required", description: err?.message || "Upgrade to unlock this feature." });
        return;
      }
      if (err instanceof ApiError && err.code === "CAPTION_ENGINE_UNAVAILABLE") {
        toast({
          title: "Caption engine unavailable",
          description: err?.data?.capabilities?.captions?.reason || err?.message || "Caption engine is unavailable on backend.",
        });
        return;
      }
      toast({ title: "Save failed", description: err?.message || "Please try again." });
    } finally {
      setSavingSettings(false);
    }
  };

  const rawTier = data?.subscription?.tier as PlanTier | undefined;
  const tier = rawTier && PLAN_TIERS.includes(rawTier) ? rawTier : "free";
  const plan = PLAN_CONFIG[tier] ?? PLAN_CONFIG.free;
  const subtitleStyleConfig = parseSubtitleStyleConfig(resolvedSettings.subtitleStyle);
  const activeSubtitlePreset = subtitleStyleConfig.preset;
  const updateMrBeastSubtitleStyle = (updates: Partial<SubtitleStyleConfig>) => {
    const nextSerialized = serializeSubtitleStyleConfig({
      ...subtitleStyleConfig,
      preset: "mrbeast_animated",
      ...updates,
    });
    mergeSettings({ subtitleStyle: nextSerialized });
  };
  const usage = data?.usage;
  const usageDaily = data?.usageDaily;
  const limits = data?.limits;
  const referral = data?.referral;
  const referralCode = referral?.referralCode ?? data?.user?.referralCode ?? null;
  const referralLink =
    referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`
      : null;
  const copyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({ title: "Referral code copied", description: "Share it with friends." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the code manually." });
    }
  };

  const handleDailyEmailPreference = async (emailEnabled: boolean) => {
    if (!accessToken || !dailyEngagement) return;
    try {
      setSavingDailyEmail(true);
      const result = await apiFetch<{ dailyEngagement: DailyEngagementStatus }>(
        "/api/settings/engagement/preferences",
        {
          method: "POST",
          body: JSON.stringify({
            emailEnabled,
            enabled: emailEnabled || dailyEngagement.pushEnabled,
          }),
          token: accessToken,
        },
      );
      setDailyEngagement(result.dailyEngagement);
      toast({
        title: "Daily email preference saved",
        description: emailEnabled
          ? "You will receive one creator tip per day by email."
          : "Daily email nudges are off.",
      });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Could not save daily email preference." });
    } finally {
      setSavingDailyEmail(false);
    }
  };

  const handleEnableDailyPush = async () => {
    if (!accessToken || !dailyEngagement) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({
        title: "Push not supported",
        description: "This browser does not support push notifications.",
      });
      return;
    }

    const providerConfigured = Boolean(dailyEngagement.provider?.webPushConfigured);
    if (!providerConfigured) {
      toast({
        title: "Push provider not configured",
        description: "WEB_PUSH_VAPID_* values are missing on backend.",
      });
      return;
    }
    const publicKey = String(
      dailyEngagement.provider?.webPushPublicKey || import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "",
    ).trim();
    if (!publicKey) {
      toast({
        title: "Push key missing",
        description: "Missing public VAPID key.",
      });
      return;
    }

    try {
      setSavingDailyPush(true);
      if (typeof Notification === "undefined") {
        toast({
          title: "Notifications unavailable",
          description: "This browser cannot request notification permission.",
        });
        return;
      }
      let permission = Notification.permission;
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        toast({
          title: "Permission not granted",
          description: "Allow notifications in browser settings to enable push reminders.",
        });
        return;
      }

      let registration = await registerExportNotificationServiceWorker();
      if (!registration) {
        registration = await navigator.serviceWorker.ready;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToUint8Array(publicKey),
        });
      }

      const payload = subscription.toJSON();
      const endpoint = String(subscription.endpoint || "").trim();
      const p256dh = String(payload.keys?.p256dh || "").trim();
      const auth = String(payload.keys?.auth || "").trim();
      if (!endpoint || !p256dh || !auth) {
        throw new Error("invalid_push_subscription");
      }

      const result = await apiFetch<{ dailyEngagement: DailyEngagementStatus }>(
        "/api/settings/engagement/push-subscription",
        {
          method: "POST",
          body: JSON.stringify({ endpoint, p256dh, auth }),
          token: accessToken,
        },
      );
      setDailyEngagement(result.dailyEngagement);
      toast({
        title: "Daily push reminders enabled",
        description: "You will get one daily creator nudge in your browser.",
      });
    } catch (err: any) {
      toast({
        title: "Push setup failed",
        description: err?.message || "Could not enable push reminders.",
      });
    } finally {
      setSavingDailyPush(false);
    }
  };

  const handleDisableDailyPush = async () => {
    if (!accessToken) return;
    try {
      setSavingDailyPush(true);
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe().catch(() => undefined);
          }
        }
      }

      const result = await apiFetch<{ dailyEngagement: DailyEngagementStatus }>(
        "/api/settings/engagement/push-subscription",
        {
          method: "DELETE",
          token: accessToken,
        },
      );
      setDailyEngagement(result.dailyEngagement);
      toast({
        title: "Daily push reminders disabled",
        description: "Browser push nudges are off.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not disable push reminders.",
      });
    } finally {
      setSavingDailyPush(false);
    }
  };
  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast({ title: "Referral link copied", description: "Invite your friends with this link." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually." });
    }
  };
  const isDevAccount = Boolean(data?.flags?.dev);
  const tierLabel = tier === "free" ? "Free" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const maxRendersPerMonth =
    limits?.maxRendersPerMonth ?? (tier === "free" ? null : plan.maxRendersPerMonth);
  const maxRendersPerDay = limits?.maxRendersPerDay ?? null;
  const maxRerendersPerDay = limits?.maxRerendersPerDay ?? plan.maxRerendersPerDay;
  const dailyLimited = tier === "free" && maxRendersPerDay !== null && maxRendersPerDay !== undefined;
  const rendersUsed = usage?.rendersUsed ?? 0;
  const rendersUsedToday = usageDaily?.rendersUsed ?? 0;
  const rerendersUsedToday = data?.rerenderUsageDaily?.rerendersUsed ?? 0;
  const rendersRemaining = maxRendersPerMonth ? Math.max(0, maxRendersPerMonth - rendersUsed) : 0;
  const rendersRemainingToday =
    maxRendersPerDay !== null && maxRendersPerDay !== undefined
      ? Math.max(0, maxRendersPerDay - rendersUsedToday)
      : null;
  const rerendersRemainingToday =
    maxRerendersPerDay !== null && maxRerendersPerDay !== undefined
      ? Math.max(0, maxRerendersPerDay - rerendersUsedToday)
      : null;
  const rendersUsagePercent = dailyLimited
    ? maxRendersPerDay > 0
      ? Math.min(100, (rendersUsedToday / maxRendersPerDay) * 100)
      : 0
    : maxRendersPerMonth && maxRendersPerMonth > 0
      ? Math.min(100, (rendersUsed / maxRendersPerMonth) * 100)
      : 0;
  const isFounderPlan = tier === "founder";
  const currentTierIndex = tierIndex(currentPlan || "free");
  const advancedLocked = !features.advancedEffects;
  const pushSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const dailyProvider = dailyEngagement?.provider;
  const dailyEmailConfigured = Boolean(dailyProvider?.emailConfigured);
  const dailyPushConfigured = Boolean(dailyProvider?.webPushConfigured);
  const dailyEmailProviderLabel = String(dailyProvider?.emailProvider || "none");
  const nextDailySendLabel = dailyEngagement?.nextSendAt
    ? new Date(dailyEngagement.nextSendAt).toLocaleString()
    : "Not scheduled";
  const lastDailySendLabel = dailyEngagement?.lastSentAt
    ? new Date(dailyEngagement.lastSentAt).toLocaleString()
    : "Not sent yet";

  return (
    <Suspense fallback={<Fragment />}><GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold font-display text-foreground mb-8">Settings</h1>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Current Plan</h2>
                  <p className="text-sm text-muted-foreground">Manage your subscription</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {isFounderPlan ? "Founder (Lifetime)" : tier}
              </Badge>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {isDevAccount && (
                <Badge className="bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-orange-500/20 border border-amber-400/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-200">
                  Dev
                </Badge>
              )}
              <Badge variant="secondary" className="border-border/60 bg-muted/40 text-muted-foreground">
                {tierLabel} plan
              </Badge>
              <Badge variant="secondary" className="border-border/60 bg-muted/40 text-muted-foreground">
                {isDevAccount
                  ? "Unlimited renders"
                  : `${rendersRemaining ?? 0} renders left`}
              </Badge>
              <Badge variant="secondary" className="border-border/60 bg-muted/40 text-muted-foreground">
                {isDevAccount
                  ? "Unlimited re-renders"
                  : `${rerendersRemainingToday ?? 0} re-renders left today`}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => handleCheckout("starter")} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-2">
                <CreditCard className="w-4 h-4" /> Upgrade plan
              </Button>
              <Button onClick={handlePortal} variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg">
                Manage Billing
              </Button>
            </div>
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{dailyLimited ? "Daily Usage" : "Monthly Usage"}</h2>
            </div>
            {isFounderPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="glass-card p-4">
                  <p className="text-muted-foreground mb-1">Plan</p>
                  <p className="text-lg font-semibold text-foreground">Founder (Lifetime)</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Monthly Limit</span>
                      <span>{maxRendersPerMonth} renders</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Usage</span>
                      <span>
                        {rendersUsed} / {maxRendersPerMonth} this month
                      </span>
                    </div>
                    <Progress value={rendersUsagePercent} className="mt-2" />
                  </div>
                </div>
                <div className="glass-card p-4">
                  <p className="text-muted-foreground mb-1">Minutes Used</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {usage?.minutesUsed ?? 0}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {limits?.maxMinutesPerMonth ?? "Unlimited"}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="glass-card p-4">
                  <p className="text-muted-foreground mb-1">Renders Remaining</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {dailyLimited ? (rendersRemainingToday ?? 0) : rendersRemaining}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {dailyLimited ? maxRendersPerDay : maxRendersPerMonth}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dailyLimited
                      ? `Used ${rendersUsedToday} / ${maxRendersPerDay} today`
                      : `Used ${rendersUsed} / ${maxRendersPerMonth} this month`}
                  </p>
                  <Progress value={rendersUsagePercent} className="mt-2" />
                </div>
                <div className="glass-card p-4">
                  <p className="text-muted-foreground mb-1">Minutes Used</p>
                  <p className="text-2xl font-bold font-display text-foreground">
                    {usage?.minutesUsed ?? 0}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {limits?.maxMinutesPerMonth ?? "Unlimited"}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Editor Features</h2>
                <p className="text-sm text-muted-foreground">Customize subtitles, auto zoom, and effects.</p>
              </div>
            </div>

            {settingsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading editor settings...</p>
            )}

            {!settingsQuery.isLoading && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Subtitle Presets</h3>
                      <p className="text-xs text-muted-foreground">Pick a caption style for exports.</p>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {subtitleBadge}
                </Badge>
              </div>
                  {captionCapability && captionCapability.available === false && (
                    <p className="mb-3 text-[11px] text-amber-300/90">
                      Caption engine unavailable: {captionCapability.reason || "No caption engine is configured on backend."}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {subtitlePresets.map((preset) => {
                      const required = getRequiredPlanForPreset(preset.id);
                      const locked = !isPresetAllowed(preset.id);
                      const active = activeSubtitlePreset === preset.id;
                      const card = (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (locked) {
                              openUpgrade(required);
                              return;
                            }
                            if (preset.id === "mrbeast_animated") {
                              mergeSettings({
                                subtitleStyle: serializeSubtitleStyleConfig({
                                  ...subtitleStyleConfig,
                                  preset: "mrbeast_animated",
                                }),
                              });
                              return;
                            }
                            mergeSettings({ subtitleStyle: preset.id });
                          }}
                          className={`relative rounded-xl border px-3 py-3 text-left text-xs font-medium transition ${
                            active ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 bg-white/5 text-muted-foreground"
                          } ${locked ? "cursor-not-allowed opacity-70" : "hover:border-primary/40"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">{preset.label}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{preset.description}</p>
                          {locked && <LockedOverlay label={`Upgrade to ${required}`} />}
                        </button>
                      );

                      if (locked) {
                        return (
                          <Tooltip key={preset.id}>
                            <TooltipTrigger asChild>{card}</TooltipTrigger>
                            <TooltipContent>Upgrade to {required} to unlock</TooltipContent>
                          </Tooltip>
                        );
                      }

                      return (
                        <div key={preset.id}>
                          {card}
                        </div>
                      );
                    })}
                  </div>
                  {activeSubtitlePreset === "mrbeast_animated" && isPresetAllowed("mrbeast_animated") && (
                    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Animated Caption Styling</p>
                          <p className="text-xs text-muted-foreground">
                            Paid-only animated captions with custom font, colors, and outline.
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          Paid
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Font</span>
                          <select
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground"
                            value={subtitleStyleConfig.fontId}
                            onChange={(event) => updateMrBeastSubtitleStyle({ fontId: event.target.value as SubtitleStyleConfig["fontId"] })}
                          >
                            {MRBEAST_FONT_OPTIONS.map((fontOption) => (
                              <option key={fontOption.id} value={fontOption.id} className="bg-background text-foreground">
                                {fontOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Animation</span>
                          <select
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground"
                            value={subtitleStyleConfig.animation}
                            onChange={(event) =>
                              updateMrBeastSubtitleStyle({ animation: event.target.value as SubtitleStyleConfig["animation"] })
                            }
                          >
                            {MRBEAST_ANIMATION_OPTIONS.map((animationOption) => (
                              <option key={animationOption.id} value={animationOption.id} className="bg-background text-foreground">
                                {animationOption.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Text Color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.textColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ textColor: event.target.value })}
                            className="h-10 w-full rounded-md border border-white/10 bg-white/5 p-1"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Accent Color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.accentColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ accentColor: event.target.value })}
                            className="h-10 w-full rounded-md border border-white/10 bg-white/5 p-1"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted-foreground">Outline Color</span>
                          <input
                            type="color"
                            value={`#${subtitleStyleConfig.outlineColor}`}
                            onChange={(event) => updateMrBeastSubtitleStyle({ outlineColor: event.target.value })}
                            className="h-10 w-full rounded-md border border-white/10 bg-white/5 p-1"
                          />
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Outline Width</span>
                            <span>{subtitleStyleConfig.outlineWidth}px</span>
                          </div>
                          <Slider
                            min={1}
                            max={12}
                            step={1}
                            value={[subtitleStyleConfig.outlineWidth]}
                            onValueChange={(values) =>
                              updateMrBeastSubtitleStyle({ outlineWidth: Number(values?.[0] ?? subtitleStyleConfig.outlineWidth) })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Auto Zoom Max</h3>
                      <p className="text-xs text-muted-foreground">Control how aggressive the zoom can be.</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{resolvedSettings.autoZoomMax.toFixed(2)}x</span>
                  </div>
                  <Slider
                    min={1}
                    max={1.15}
                    step={0.01}
                    disabled={onlyCutsEnabled}
                    value={[resolvedSettings.autoZoomMax]}
                    onValueChange={(values) => {
                      if (onlyCutsEnabled) return;
                      const next = Number(values?.[0] ?? features.autoZoomMax);
                      const required = getRequiredPlanForAutoZoom(next);
                      if (tierIndex(required) > currentTierIndex) {
                        openUpgrade(required);
                        mergeSettings({ autoZoomMax: features.autoZoomMax });
                        return;
                      }
                      mergeSettings({ autoZoomMax: next });
                    }}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>Plan max: {features.autoZoomMax.toFixed(2)}x</span>
                    {onlyCutsEnabled && <span>Disabled in Only Cuts</span>}
                    {features.autoZoomMax < 1.15 && (
                      <button type="button" className="text-primary" onClick={() => openUpgrade("studio")}>
                        Unlock 1.15x
                      </button>
                    )}
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Transitions</h3>
                      <p className="text-xs text-muted-foreground">
                        Blend neighboring clips with smooth transition fades.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.transitions}
                      disabled={onlyCutsEnabled}
                      onCheckedChange={(checked) => {
                        if (onlyCutsEnabled) return;
                        mergeSettings({ transitions: checked });
                      }}
                    />
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Jump Cuts</h3>
                      <p className="text-xs text-muted-foreground">
                        Use tighter, high-energy cut boundaries on active moments.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.jumpCuts}
                      disabled={onlyCutsEnabled}
                      onCheckedChange={(checked) => {
                        if (onlyCutsEnabled) return;
                        mergeSettings({ jumpCuts: checked });
                      }}
                    />
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Smart Face Zoom</h3>
                      <p className="text-xs text-muted-foreground">
                        Track faces and keep subjects centered during zoom moments.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.smartZoom}
                      disabled={onlyCutsEnabled}
                      onCheckedChange={(checked) => {
                        if (onlyCutsEnabled) return;
                        mergeSettings({ smartZoom: checked });
                      }}
                    />
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Dynamic Sound FX</h3>
                      <p className="text-xs text-muted-foreground">
                        Add punch/whoosh accents on energetic cuts.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.soundFx}
                      disabled={onlyCutsEnabled}
                      onCheckedChange={(checked) => {
                        if (onlyCutsEnabled) return;
                        mergeSettings({ soundFx: checked });
                      }}
                    />
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Music Ducking</h3>
                      <p className="text-xs text-muted-foreground">
                        Lower music bed under low-energy speech to keep voice clear.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.musicDuck}
                      disabled={onlyCutsEnabled}
                      onCheckedChange={(checked) => {
                        if (onlyCutsEnabled) return;
                        mergeSettings({ musicDuck: checked });
                      }}
                    />
                  </div>
                </div>

                <div
                  className="relative glass-card p-4"
                  onClick={() => {
                    if (advancedLocked) openUpgrade("studio");
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Advanced Effects</h3>
                      <p className="text-xs text-muted-foreground">Premium enhancement tools for Studio users.</p>
                    </div>
                    {!features.advancedEffects && (
                      <Badge variant="secondary" className="bg-white/10 text-muted-foreground">
                        Studio
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Emotional Boost</span>
                      <Switch
                        checked={resolvedSettings.emotionalBoost}
                        disabled={advancedLocked || onlyCutsEnabled}
                        onCheckedChange={(checked) => {
                          if (advancedLocked) {
                            openUpgrade("studio");
                            return;
                          }
                          if (onlyCutsEnabled) return;
                          mergeSettings({ emotionalBoost: checked });
                        }}
                      />
                    </div>
                  </div>
                  {advancedLocked && <LockedOverlay label="Studio" />}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings || !editorSettings}
                    className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {savingSettings ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Daily Creator Nudges</h2>
                <p className="text-sm text-muted-foreground">
                  Get one daily fun fact + editing tip by email and optional browser push.
                </p>
              </div>
            </div>

            {!dailyEngagement ? (
              <p className="text-sm text-muted-foreground">Loading daily engagement preferences...</p>
            ) : (
              <div className="space-y-4">
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Daily email nudges</h3>
                      <p className="text-xs text-muted-foreground">
                        Send one short creator insight to {data?.user?.email ?? "your email"} every day.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(dailyEngagement.emailEnabled)}
                      disabled={savingDailyEmail || (!dailyEmailConfigured && !dailyEngagement.emailEnabled)}
                      onCheckedChange={(checked) => {
                        void handleDailyEmailPreference(checked);
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Email provider: {dailyEmailProviderLabel}
                  </p>
                  {!dailyEmailConfigured ? (
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      Configure DAILY_ENGAGEMENT_WEBHOOK_URL or RESEND_API_KEY to enable daily email nudges.
                    </p>
                  ) : null}
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Daily browser push reminders</h3>
                      <p className="text-xs text-muted-foreground">
                        Deliver the same daily nudge as a browser notification.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(dailyEngagement.pushEnabled)}
                      disabled={savingDailyPush || !pushSupported || (!dailyPushConfigured && !dailyEngagement.pushEnabled)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          void handleEnableDailyPush();
                          return;
                        }
                        void handleDisableDailyPush();
                      }}
                    />
                  </div>
                  {!pushSupported ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Push reminders require Service Worker + Push support in your browser.
                    </p>
                  ) : null}
                  {!dailyPushConfigured ? (
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      Configure WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, and WEB_PUSH_VAPID_PRIVATE_KEY.
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                  <div className="glass-card p-3">
                    <p className="text-muted-foreground">Next daily send</p>
                    <p className="text-foreground mt-1">{nextDailySendLabel}</p>
                  </div>
                  <div className="glass-card p-3">
                    <p className="text-muted-foreground">Last delivered</p>
                    <p className="text-foreground mt-1">{lastDailySendLabel}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div id="referrals" className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Referral Program</h2>
                <p className="text-sm text-muted-foreground">Refer 3 users and earn 1 free month.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs text-muted-foreground">Your referral code</p>
                <p className="text-xl font-bold font-display text-foreground tracking-[0.12em]">
                  {referralCode ?? "Generating..."}
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="rounded-lg" onClick={copyReferralCode} disabled={!referralCode}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button type="button" variant="outline" className="rounded-lg" onClick={copyReferralLink} disabled={!referralLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
                {referralLink ? (
                  <p className="text-[11px] text-muted-foreground break-all">{referralLink}</p>
                ) : null}
              </div>
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs text-muted-foreground">Progress to next free month</p>
                <p className="text-lg font-semibold text-foreground">
                  {referral?.progressInCurrentCycle ?? 0} / {referral?.referralsPerReward ?? 3} referrals
                </p>
                <Progress
                  value={
                    ((referral?.progressInCurrentCycle ?? 0) / Math.max(1, referral?.referralsPerReward ?? 3)) * 100
                  }
                />
                <div className="text-sm text-muted-foreground">
                  <p>Total referred users: {referral?.referredUsersCount ?? 0}</p>
                  <p>Free months earned: {referral?.rewardsEarnedMonths ?? 0}</p>
                  <p>{referral?.referralsToNextReward ?? 3} referrals left for your next free month.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-semibold text-foreground mb-4">Account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-foreground">{data?.user?.email ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member since</span>
                <span className="text-foreground">
                  {data?.user?.createdAt ? new Date(data.user.createdAt).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold font-display text-foreground mb-4">Change Plan</h2>
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setBillingInterval("monthly")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                    billingInterval === "monthly"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("annual")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${
                    billingInterval === "annual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual
                </button>
              </div>
              <span className="text-xs text-muted-foreground">Switch to annual billing</span>
            </div>
            <div className="mb-6">
              {trialActive ? (
                <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border border-border/60">
                    Trial active
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {`Free trial active (${Math.max(1, trialDaysRemaining)}d left${trialEndsLabel ? `, ends ${trialEndsLabel}` : ""})`}
                  </span>
                </div>
              ) : trialUsed ? (
                <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border border-border/60">
                    Trial used
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Starter free trial has already been used on this account.
                  </span>
                </div>
              ) : null}
            </div>
            <PricingCards
              currentTier={currentPlan}
              isAuthenticated={true}
              loading={action !== null}
              onCheckout={handleCheckout}
              onPortal={handlePortal}
              actionTier={action?.tier ?? null}
              actionKind={action?.kind ?? null}
              billingInterval={billingInterval}
              founderSlotsRemaining={founderSlotsRemaining}
            />
          </div>
        </motion.div>
      </main>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlan}
        requiredPlan={requiredPlan}
        onUpgrade={handleUpgrade}
        founderSlotsRemaining={founderSlotsRemaining}
      />
    </GlowBackdrop></Suspense>
  );
};

export default Settings;
