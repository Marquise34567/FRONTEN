import { motion } from "framer-motion";
import { Clock3, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import PricingCards from "@/components/PricingCards";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/AuthProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { useMe } from "@/hooks/use-me";
import { ApiError, apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@shared/planConfig";
import { useLiveStats } from "@/providers/LiveStatsProvider";

const TRIAL_WINDOW_MS = 72 * 60 * 60 * 1000;

const formatCountdown = (msRemaining: number) => {
  const safe = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const Pricing = () => {
  const { t } = useTranslation("common");
  const { accessToken, user } = useAuth();
  const { plan: currentPlan } = useSubscription();
  const { data: me } = useMe();
  const { snapshot, pulse } = useLiveStats();
  const { data: founderAvailability } = useFounderAvailability();
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [useStarterTrial, setUseStarterTrial] = useState(false);
  const { toast } = useToast();
  const founderSlotsRemaining = founderAvailability?.remaining ?? 0;
  const upgradesToday = pulse?.upgradedToday ?? snapshot?.upgradeSignals?.upgradedToday ?? 0;
  const trialInfo = me?.subscription?.trial;
  const trialActive = Boolean(trialInfo?.active);
  const trialUsed = Boolean(!trialActive && (trialInfo?.startedAt || trialInfo?.endsAt || trialInfo?.trialTier));
  const trialCountdownTargetMs = useMemo(() => {
    const parsedEnd = trialInfo?.endsAt ? new Date(trialInfo.endsAt).getTime() : Number.NaN;
    if (Number.isFinite(parsedEnd)) return parsedEnd;
    return Date.now() + TRIAL_WINDOW_MS;
  }, [trialInfo?.endsAt]);
  const [trialCountdown, setTrialCountdown] = useState(formatCountdown(TRIAL_WINDOW_MS));

  useEffect(() => {
    if (trialActive) {
      setUseStarterTrial(true);
      return;
    }
    setUseStarterTrial(!trialUsed);
  }, [trialActive, trialUsed]);

  useEffect(() => {
    const tick = () => setTrialCountdown(formatCountdown(trialCountdownTargetMs - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [trialCountdownTargetMs]);

  const handleCheckout = async (tier: PlanTier) => {
    if (!accessToken) return;
    try {
      setAction({ tier, kind: "subscribe" });
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval: billingInterval, trial: tier === "starter" && useStarterTrial && !trialUsed }),
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

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.section
          className="mx-auto mb-6 max-w-6xl rounded-3xl border border-purple-900/40 bg-[linear-gradient(145deg,#0F0F1A_0%,#12121F_100%)] px-4 py-8 shadow-[0_28px_100px_-50px_rgba(168,85,247,0.7)] md:px-8"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              {t("pricing.title", { defaultValue: "Premium plans for serious creators" })}
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              {t("pricing.subtitle", { defaultValue: "Choose the editing capacity your channel needs and scale whenever you want." })}
            </p>
          </div>

          <div className="premium-trial-banner mx-auto mt-6 flex max-w-4xl flex-col items-start gap-3 rounded-2xl border border-purple-300/35 bg-gradient-to-r from-[#7E22CE]/40 via-[#A855F7]/30 to-[#C084FC]/25 px-4 py-3 text-purple-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-100" />
              <span className="text-sm font-semibold">{t("pricing.trialBanner", { defaultValue: "3-day free trial for Starter and above" })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span className="rounded-full border border-purple-200/40 bg-black/20 px-3 py-1 font-mono text-sm tracking-wide">
                {trialCountdown}
              </span>
              <Badge className="border border-purple-100/35 bg-white/15 text-purple-50">
                {trialUsed
                  ? t("pricing.trialUsedBadge", { defaultValue: "Trial used" })
                  : trialActive
                    ? t("pricing.trialLiveBadge", { defaultValue: "Trial live" })
                    : t("pricing.trialNewBadge", { defaultValue: "Trial ready" })}
              </Badge>
              <Badge className="border border-cyan-100/35 bg-cyan-400/15 text-cyan-50">
                {upgradesToday} users upgraded today
              </Badge>
            </div>
          </div>

          <div className="mx-auto mt-5 flex max-w-xl flex-col items-center gap-2">
            <div className="inline-flex w-full max-w-md rounded-full border border-purple-400/35 bg-black/30 p-1.5">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={cn(
                  "h-11 flex-1 rounded-full text-sm font-semibold transition",
                  billingInterval === "monthly" ? "bg-white text-[#11111f]" : "text-purple-100/85 hover:text-white",
                )}
              >
                {t("pricing.monthly", { defaultValue: "Monthly" })}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("annual")}
                className={cn(
                  "h-11 flex-1 rounded-full text-sm font-semibold transition",
                  billingInterval === "annual" ? "bg-gradient-to-r from-[#A855F7] to-[#C084FC] text-white" : "text-purple-100/85 hover:text-white",
                )}
              >
                {t("pricing.annual", { defaultValue: "Annual" })}
              </button>
            </div>
            <span className="text-xs text-purple-100/90">{t("pricing.saveTwenty", { defaultValue: "Save 20% with annual billing" })}</span>
          </div>
        </motion.section>

        <div className="mx-auto max-w-7xl">
          <PricingCards
            currentTier={currentPlan}
            isAuthenticated={!!user}
            loading={action !== null}
            onCheckout={handleCheckout}
            onPortal={handlePortal}
            actionTier={action?.tier ?? null}
            actionKind={action?.kind ?? null}
            billingInterval={billingInterval}
            founderSlotsRemaining={founderSlotsRemaining}
          />
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Pricing;
