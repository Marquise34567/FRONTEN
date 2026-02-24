import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useAuth } from "@/providers/AuthProvider";
import { CheckCircle2, Sparkles } from "lucide-react";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";

const REDIRECT_SECONDS = 6;
const RECENT_EDITOR_FEATURES = [
  "Retention score now explains what the editor improved",
  "Hook candidate selection before re-rendering",
  "Auto-detected video niche with confidence + rationale",
];

const toPlanTier = (value?: string | null): PlanTier => {
  if (!value) return "free";
  const normalized = String(value).toLowerCase();
  if (PLAN_TIERS.includes(normalized as PlanTier)) return normalized as PlanTier;
  return "free";
};

const BillingSuccess = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken } = useAuth();
  const { data: me, isLoading: loadingMe } = useMe();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  useEffect(() => {
    if (!accessToken) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          navigate("/editor", { replace: true });
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [accessToken, navigate]);

  const querySource = searchParams.get("source");
  const queryTrialState = searchParams.get("trial");
  const queryTier = toPlanTier(searchParams.get("tier"));
  const trialInfo = me?.subscription?.trial;
  const trialActive = Boolean(trialInfo?.active);
  const trialFlow =
    querySource === "trial" || queryTrialState === "started" || queryTrialState === "active" || trialActive;
  const resolvedTier = toPlanTier(
    trialActive ? trialInfo?.trialTier : (me?.subscription?.tier as string | undefined) || queryTier,
  );
  const unlockedFeatures = PLAN_CONFIG[resolvedTier]?.features ?? PLAN_CONFIG.free.features;
  const trialEndsAt = trialInfo?.endsAt || searchParams.get("endsAt");
  const trialEndsLabel = useMemo(() => {
    if (!trialEndsAt) return null;
    const parsed = new Date(trialEndsAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  }, [trialEndsAt]);

  const heading = trialFlow
    ? queryTrialState === "active"
      ? "Free trial active"
      : "Free trial started"
    : "Payment successful";

  const subheading = trialFlow
    ? "Your trial is unlocked and you can use premium editor tools now."
    : "Your subscription is active and premium tools are now unlocked.";

  if (!accessToken) {
    return (
      <GlowBackdrop>
        <Navbar />
        <main className="responsive-main min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
          <div className="glass-card p-8 max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold font-display text-foreground">Session required</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to finish setup and continue to the editor.
            </p>
            <Link to="/login">
              <Button className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                Sign in
              </Button>
            </Link>
          </div>
        </main>
      </GlowBackdrop>
    );
  }

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen flex items-center justify-center px-4 pt-24 pb-12">
        <motion.div
          className="glass-card p-8 max-w-2xl w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">{heading}</h1>
                <p className="text-sm text-muted-foreground">{subheading}</p>
              </div>
            </div>
            {trialFlow ? (
              <Badge className="bg-emerald-500/15 text-emerald-200 border border-emerald-400/40">Free Trial</Badge>
            ) : (
              <Badge className="bg-primary/15 text-primary border border-primary/40">Subscribed</Badge>
            )}
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 mb-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Unlocked in your plan</p>
            <p className="text-sm text-foreground mb-2">
              Tier: <span className="font-semibold">{PLAN_CONFIG[resolvedTier].name}</span>
            </p>
            {trialEndsLabel ? (
              <p className="text-xs text-muted-foreground mb-2">Trial ends: {trialEndsLabel}</p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unlockedFeatures.map((feature) => (
                <p key={feature} className="text-xs text-foreground/90">
                  - {feature}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Recently added editor features
            </p>
            <div className="space-y-1.5">
              {RECENT_EDITOR_FEATURES.map((feature) => (
                <p key={feature} className="text-xs text-foreground/90">
                  - {feature}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => navigate("/editor", { replace: true })}
              className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
            >
              Continue to Editor
            </Button>
            <p className="text-xs text-muted-foreground">
              Redirecting in {loadingMe ? "..." : secondsLeft}s
            </p>
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default BillingSuccess;
