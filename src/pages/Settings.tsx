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
import { CreditCard, Download, FolderOpen, Shield, Sparkles } from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";
import LockedOverlay from "@/components/LockedOverlay";
import { useMe } from "@/hooks/use-me";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { useAuth } from "@/providers/AuthProvider";
import { ApiError, apiFetch } from "@/lib/api";
import {
  clearRecordingFolderHandle,
  loadRecordingFolderHandle,
  saveRecordingFolderHandle,
  supportsRecordingFolderAccess,
} from "@/lib/recordingFolder";
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

const AUTO_DOWNLOAD_ENABLED_KEY = "editor_auto_download_enabled_v1";
const AUTO_DOWNLOAD_VERTICAL_MODE_KEY = "editor_auto_download_vertical_mode_v1";
const AUTO_DOWNLOAD_LONGFORM_ONLY_KEY = "editor_auto_download_longform_only_v1";
const AUTO_IMPORT_ENABLED_KEY = "editor_auto_import_enabled_v1";

const readLocalStorageFlag = (key: string, fallback = false) => {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
};

const writeLocalStorageFlag = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value ? "true" : "false");
};

const Settings = () => {
  const { accessToken } = useAuth();
  const { data } = useMe();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  
  const { toast } = useToast();
  const { plan: currentPlan, features, subtitlePresets } = useSubscription();
  const { data: founderAvailability } = useFounderAvailability();
  const founderSlotsRemaining = founderAvailability?.remaining ?? 0;
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
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState(
    () => readLocalStorageFlag(AUTO_DOWNLOAD_ENABLED_KEY, false),
  );
  const [autoDownloadVerticalMode, setAutoDownloadVerticalMode] = useState<"all" | "top">(
    () => (readLocalStorageFlag(AUTO_DOWNLOAD_VERTICAL_MODE_KEY, true) ? "all" : "top"),
  );
  const [autoDownloadLongFormOnly, setAutoDownloadLongFormOnly] = useState(
    () => readLocalStorageFlag(AUTO_DOWNLOAD_LONGFORM_ONLY_KEY, false),
  );
  const [autoImportEnabled, setAutoImportEnabled] = useState(
    () => readLocalStorageFlag(AUTO_IMPORT_ENABLED_KEY, false),
  );
  const [recordingFolderHandle, setRecordingFolderHandle] = useState<any>(null);
  const [recordingFolderStatus, setRecordingFolderStatus] = useState<"idle" | "picking" | "error">("idle");

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
  }, [settingsQuery.data]);

  useEffect(() => {
    writeLocalStorageFlag(AUTO_DOWNLOAD_ENABLED_KEY, autoDownloadEnabled);
  }, [autoDownloadEnabled]);

  useEffect(() => {
    writeLocalStorageFlag(AUTO_DOWNLOAD_VERTICAL_MODE_KEY, autoDownloadVerticalMode === "all");
  }, [autoDownloadVerticalMode]);

  useEffect(() => {
    writeLocalStorageFlag(AUTO_DOWNLOAD_LONGFORM_ONLY_KEY, autoDownloadLongFormOnly);
  }, [autoDownloadLongFormOnly]);

  useEffect(() => {
    writeLocalStorageFlag(AUTO_IMPORT_ENABLED_KEY, autoImportEnabled);
  }, [autoImportEnabled]);

  useEffect(() => {
    let cancelled = false;
    const loadFolder = async () => {
      const handle = await loadRecordingFolderHandle();
      if (cancelled || !handle) return;
      setRecordingFolderHandle(handle);
    };
    void loadFolder();
    return () => {
      cancelled = true;
    };
  }, []);

  const openUpgrade = (plan: PlanTier) => {
    setRequiredPlan(plan);
    setUpgradeOpen(true);
  };

  const handleCheckout = async (tier: PlanTier) => {
    if (!accessToken) return;
    try {
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

  const handlePickRecordingFolder = async () => {
    if (!supportsRecordingFolderAccess()) {
      toast({
        title: "Folder access not supported",
        description: "Use Chrome or Edge to connect a recording folder.",
      });
      return;
    }
    setRecordingFolderStatus("picking");
    try {
      const handle = await (window as any).showDirectoryPicker({
        id: "auto-editor-recording-folder",
        mode: "read",
      });
      if (!handle) {
        setRecordingFolderStatus("idle");
        return;
      }
      if (typeof handle.requestPermission === "function") {
        const permission = await handle.requestPermission({ mode: "read" });
        if (permission && permission !== "granted") {
          setRecordingFolderStatus("error");
          toast({
            title: "Permission required",
            description: "Allow folder access to watch for new recordings.",
          });
          return;
        }
      }
      void saveRecordingFolderHandle(handle);
      setRecordingFolderHandle(handle);
      setAutoImportEnabled(true);
      setRecordingFolderStatus("idle");
      toast({
        title: "Recording folder linked",
        description: `Watching ${handle.name || "your folder"} for new videos.`,
      });
    } catch (err: any) {
      setRecordingFolderStatus("error");
      toast({
        title: "Folder access failed",
        description: err?.message || "Couldn't access that folder.",
      });
    }
  };

  const handleDisconnectRecordingFolder = () => {
    setRecordingFolderHandle(null);
    setAutoImportEnabled(false);
    setRecordingFolderStatus("idle");
    void clearRecordingFolderHandle();
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
  const supportsAutoImport = supportsRecordingFolderAccess();
  const recordingFolderName = recordingFolderHandle?.name || "folder";
  const autoImportStatusLabel = recordingFolderStatus === "picking"
    ? "Waiting for folder selection..."
    : recordingFolderStatus === "error"
      ? "Access denied. Reconnect the folder."
      : !supportsAutoImport
        ? "Folder access requires Chrome or Edge."
        : recordingFolderHandle
          ? autoImportEnabled
            ? `Watching ${recordingFolderName}`
            : `Connected to ${recordingFolderName}`
          : autoImportEnabled
            ? "Pick a folder to enable auto-import."
            : "No recording folder connected.";

  return (
    <Suspense fallback={<Fragment />}><GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold font-display text-foreground mb-6">Settings</h1>

          <div className="glass-card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Current Plan</h2>
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {isFounderPlan ? "Founder (Lifetime)" : tier}
              </Badge>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
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
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => handleCheckout("starter")} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-2">
                <CreditCard className="w-4 h-4" /> Upgrade
              </Button>
              <Button onClick={handlePortal} variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg">
                Billing
              </Button>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setBillingInterval("monthly")}
                  className={`px-3 py-1 font-semibold rounded-full transition ${
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
                  className={`px-3 py-1 font-semibold rounded-full transition ${
                    billingInterval === "annual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{dailyLimited ? "Daily Usage" : "Monthly Usage"}</h2>
            </div>
            {isFounderPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="glass-card p-3">
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
                <div className="glass-card p-3">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="glass-card p-3">
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
                <div className="glass-card p-3">
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

          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Download className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Workflow</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Auto-download exports</h3>
                    <p className="text-xs text-muted-foreground">Save finished renders automatically.</p>
                  </div>
                  <Switch
                    checked={autoDownloadEnabled}
                    onCheckedChange={setAutoDownloadEnabled}
                    aria-label="Toggle auto download"
                  />
                </div>
                {autoDownloadEnabled ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Vertical clips</span>
                    <button
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                        autoDownloadVerticalMode === "all"
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setAutoDownloadVerticalMode("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                        autoDownloadVerticalMode === "top"
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setAutoDownloadVerticalMode("top")}
                    >
                      Top only
                    </button>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={autoDownloadLongFormOnly}
                        onCheckedChange={setAutoDownloadLongFormOnly}
                        aria-label="Toggle long-form only"
                      />
                      <span>Long-form only</span>
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Auto-import recordings</h3>
                    <p className="text-xs text-muted-foreground">Watch a folder and pull in new videos.</p>
                  </div>
                  <Switch
                    checked={autoImportEnabled}
                    onCheckedChange={setAutoImportEnabled}
                    disabled={!supportsAutoImport}
                    aria-label="Toggle auto-import"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2"
                    onClick={handlePickRecordingFolder}
                    disabled={!supportsAutoImport || recordingFolderStatus === "picking"}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {recordingFolderHandle ? "Change folder" : "Choose folder"}
                  </Button>
                  {recordingFolderHandle ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={handleDisconnectRecordingFolder}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                  <span>{autoImportStatusLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Editor Features</h2>
            </div>

            {settingsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading editor settings...</p>
            )}

            {!settingsQuery.isLoading && (
              <div className="space-y-4">
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

          <div className="glass-card p-4">
            <h2 className="font-semibold text-foreground mb-3">Account</h2>
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
