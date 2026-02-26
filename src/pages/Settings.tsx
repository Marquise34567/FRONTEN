import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Flame, Gauge, Shield, Sparkles, WandSparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PricingCards from "@/components/PricingCards";
import UpgradeModal from "@/components/UpgradeModal";
import LockedOverlay from "@/components/LockedOverlay";
import { useMe } from "@/hooks/use-me";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { useAuth } from "@/providers/AuthProvider";
import { ApiError, apiFetch } from "@/lib/api";
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

const SUBTITLE_PRESET_ICONS: Record<string, LucideIcon> = {
  basic_clean: Gauge,
  bold_pop: Sparkles,
  mrbeast_animated: Flame,
  outline_heavy: Shield,
  caption_box: CreditCard,
  neon_glow: Zap,
  karaoke_highlight: WandSparkles,
};

const Settings = () => {
  const { accessToken } = useAuth();
  const { data } = useMe();
  const [entitlements, setEntitlements] = useState<any | null>(null);
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [useStarterTrial, setUseStarterTrial] = useState(false);
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

  const settingsQuery = useQuery({
    queryKey: ["editor-settings", data?.user?.id],
    queryFn: () => apiFetch<SettingsResponse>("/api/settings", { token: accessToken || "" }),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setEditorSettings(settingsQuery.data.settings);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch('/api/billing/entitlements', { token: accessToken })
      .then((d) => setEntitlements(d))
      .catch(() => setEntitlements(null));
  }, [accessToken]);

  useEffect(() => {
    if (trialActive) setUseStarterTrial(true);
    if (trialUsed) setUseStarterTrial(false);
  }, [trialActive, trialUsed]);

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
        body: JSON.stringify({ tier, interval: billingInterval, trial: tier === "starter" && useStarterTrial }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.code;
      if (code === "trial_already_used") {
        setUseStarterTrial(false);
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
          trial: requiredPlan === "starter" && useStarterTrial,
        }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.code;
      if (code === "trial_already_used") {
        setUseStarterTrial(false);
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
  const onlyCutsEnabled = resolvedSettings.onlyCuts;
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
      const result = await apiFetch<SettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(editorSettings),
        token: accessToken,
      });
      setEditorSettings(result.settings);
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
  const maxRendersPerMonth =
    limits?.maxRendersPerMonth ?? (tier === "free" ? null : plan.maxRendersPerMonth);
  const maxRendersPerDay = limits?.maxRendersPerDay ?? null;
  const dailyLimited = tier === "free" && maxRendersPerDay !== null && maxRendersPerDay !== undefined;
  const rendersUsed = usage?.rendersUsed ?? 0;
  const rendersUsedToday = usageDaily?.rendersUsed ?? 0;
  const rendersRemaining = maxRendersPerMonth ? Math.max(0, maxRendersPerMonth - rendersUsed) : 0;
  const rendersRemainingToday =
    maxRendersPerDay !== null && maxRendersPerDay !== undefined
      ? Math.max(0, maxRendersPerDay - rendersUsedToday)
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
  const captionEngineStateLabel =
    captionCapability && captionCapability.available === false
      ? "Offline"
      : captionCapability?.provider
      ? `${captionCapability.provider}${captionCapability.mode ? ` · ${captionCapability.mode}` : ""}`
      : "Ready";

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main mx-auto min-h-screen max-w-6xl px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-6 overflow-hidden rounded-[1.6rem] border border-white/15 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.22),transparent_48%),linear-gradient(145deg,rgba(10,12,24,0.92),rgba(18,20,34,0.9))] p-6 shadow-[0_28px_80px_-48px_rgba(99,102,241,0.9)]">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Creator Settings
                </div>
                <h1 className="text-3xl font-bold font-display text-foreground">Settings</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Tune your render defaults, caption style system, and effect behavior for fast, consistent output quality.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 md:min-w-[440px]">
                <div className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5">
                  <p className="uppercase tracking-[0.14em] text-slate-400">Plan</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{isFounderPlan ? "Founder Lifetime" : tier.toUpperCase()}</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5">
                  <p className="uppercase tracking-[0.14em] text-slate-400">Subtitle Styles</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{subtitleBadge}</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5">
                  <p className="uppercase tracking-[0.14em] text-slate-400">Caption Engine</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">{captionEngineStateLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_60px_-44px_rgba(148,163,184,0.9)] backdrop-blur-xl">
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
            <div className="flex items-center gap-3">
              <Button onClick={() => handleCheckout("starter")} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-2">
                <CreditCard className="w-4 h-4" /> Upgrade plan
              </Button>
              <Button onClick={handlePortal} variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg">
                Manage Billing
              </Button>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_60px_-44px_rgba(148,163,184,0.9)] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-slate-300" />
              <h2 className="font-semibold text-foreground">{dailyLimited ? "Daily Usage" : "Monthly Usage"}</h2>
            </div>
            {isFounderPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

          <div className="mb-6 rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_60px_-44px_rgba(148,163,184,0.9)] backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4">
              <Gauge className="w-5 h-5 text-primary" />
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
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Only Cuts Mode</h3>
                      <p className="text-xs text-muted-foreground">
                        Remove boring sections only. No hook move, pacing, zoom, transitions, jump cuts, or effects.
                      </p>
                    </div>
                    <Switch
                      checked={resolvedSettings.onlyCuts}
                      onCheckedChange={(checked) => {
                        mergeSettings({ onlyCuts: checked });
                      }}
                    />
                  </div>
                  {onlyCutsEnabled && (
                    <p className="text-[11px] text-muted-foreground">
                      Other enhancements are ignored while Only Cuts is enabled.
                    </p>
                  )}
                </div>
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
                      const PresetIcon = SUBTITLE_PRESET_ICONS[preset.id] || Sparkles;
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
                            <span className="inline-flex items-center gap-2 text-sm text-foreground">
                              <PresetIcon className="h-3.5 w-3.5 text-primary/80" />
                              {preset.label}
                            </span>
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
                            <span>Font Size</span>
                            <span>{subtitleStyleConfig.fontSize}px</span>
                          </div>
                          <Slider
                            min={32}
                            max={220}
                            step={2}
                            value={[subtitleStyleConfig.fontSize]}
                            onValueChange={(values) =>
                              updateMrBeastSubtitleStyle({ fontSize: Number(values?.[0] ?? subtitleStyleConfig.fontSize) })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Outline Width</span>
                            <span>{subtitleStyleConfig.outlineWidth}px</span>
                          </div>
                          <Slider
                            min={1}
                            max={24}
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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

                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
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
                  className="relative rounded-xl border border-white/12 bg-white/[0.04] p-4"
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

          <div className="rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_60px_-44px_rgba(148,163,184,0.9)] backdrop-blur-xl">
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
              {trialUsed ? (
                <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border border-border/60">
                    Trial used
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Starter free trial has already been used on this account.
                  </span>
                </div>
              ) : (
                <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <Switch
                    checked={trialActive ? true : useStarterTrial}
                    onCheckedChange={setUseStarterTrial}
                    disabled={trialActive}
                  />
                  <span className="text-xs text-muted-foreground">
                    {trialActive
                      ? `Free trial active (${Math.max(1, trialDaysRemaining)}d left${trialEndsLabel ? `, ends ${trialEndsLabel}` : ""})`
                      : "Use 3-day free trial (full unlock) when choosing Starter"}
                  </span>
                </label>
              )}
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
    </GlowBackdrop>
  );
};

export default Settings;
