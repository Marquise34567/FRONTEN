import { motion } from "framer-motion";
import { Fragment, lazy, Suspense } from "react";
const GlowBackdrop = lazy(() => import("@/components/GlowBackdrop"));
import Navbar from "@/components/Navbar";
const PricingCards = lazy(() => import("@/components/PricingCards"));
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { ApiError, apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@shared/planConfig";
import { ArrowRight, ZoomIn } from "lucide-react";

const Pricing = () => {
  const { accessToken, user } = useAuth();
  const { plan: currentPlan } = useSubscription();
  const { data: founderAvailability } = useFounderAvailability();
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" | "trial" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const { toast } = useToast();
  const founderSlotsRemaining = founderAvailability?.remaining ?? 0;

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
      toast({ title: "Checkout failed", description: err?.message || "Please try again." });
    } finally {
      setAction(null);
    }
  };

  const handleStartFreeTrial = async () => {
    if (!accessToken) {
      window.location.href = "/signup";
      return;
    }
    try {
      setAction({ tier: "starter", kind: "trial" });
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier: "starter", trial: true, interval: billingInterval }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      const code = err instanceof ApiError ? err.code : err?.code;
      if (code === "trial_checkout_not_configured" || code === "missing_price_config") {
        toast({ title: "Free trial unavailable", description: "Trial checkout is not configured yet." });
        return;
      }
      if (code === "trial_already_active") {
        toast({ title: "Free trial already active", description: "Your trial is already active on this account." });
        return;
      }
      if (code === "trial_already_used") {
        toast({ title: "Free trial already used", description: "Upgrade to continue with premium access." });
        return;
      }
      toast({ title: "Free trial checkout failed", description: err?.message || "Please try again." });
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
    <Suspense fallback={<Fragment />}><GlowBackdrop>
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pt-16 pb-20 sm:pt-20">
        <Suspense fallback={<Fragment />}>
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="mb-4 text-3xl font-bold font-display text-foreground sm:text-4xl">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground">Pick a plan that matches your output volume and upgrade anytime.</p>
        </motion.div>
        </Suspense>

        <motion.div
          className="max-w-2xl mx-auto mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-8 w-8 rounded-xl bg-emerald-400/15 flex items-center justify-center shrink-0">
                <ZoomIn className="w-4 h-4 text-emerald-300" />
              </span>
              <p className="text-sm text-emerald-100">Zoom-In Smart Reframing</p>
            </div>
            <Badge variant="secondary" className="w-fit bg-emerald-400/15 text-emerald-200 border border-emerald-300/30">
              Coming soon
            </Badge>
          </div>
        </motion.div>

        <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <span className="text-center text-xs text-muted-foreground">Switch to annual billing</span>
        </div>
        <div className="flex flex-col items-center gap-2 mb-6">
          <Button
            type="button"
            onClick={handleStartFreeTrial}
            disabled={action?.kind === "trial"}
            className="w-full rounded-full px-6 sm:w-auto"
          >
            {action?.kind === "trial" ? "Redirecting to checkout..." : "Start Free Trial"}
            {action?.kind === "trial" ? null : <ArrowRight className="w-4 h-4" />}
          </Button>
          <p className="text-xs text-muted-foreground">Try premium tools first, then choose any subscription.</p>
        </div>
        <div className="max-w-6xl mx-auto mb-2">
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
    </GlowBackdrop></Suspense>
  );
};

export default Pricing;
