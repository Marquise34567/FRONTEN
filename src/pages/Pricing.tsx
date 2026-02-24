import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import PricingCards from "@/components/PricingCards";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/AuthProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@shared/planConfig";
import { ZoomIn } from "lucide-react";

const Pricing = () => {
  const { accessToken, user } = useAuth();
  const { plan: currentPlan } = useSubscription();
  const { data: founderAvailability } = useFounderAvailability();
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [useStarterTrial, setUseStarterTrial] = useState(false);
  const { toast } = useToast();
  const founderSlotsRemaining = founderAvailability?.remaining ?? 0;

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
      <main className="min-h-screen px-4 pt-24 pb-20">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold font-display text-foreground mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground">Pick a plan that matches your output volume and upgrade anytime.</p>
        </motion.div>

        <motion.div
          className="max-w-2xl mx-auto mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
        >
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-8 w-8 rounded-xl bg-emerald-400/15 flex items-center justify-center shrink-0">
                <ZoomIn className="w-4 h-4 text-emerald-300" />
              </span>
              <p className="text-sm text-emerald-100 truncate">Zoom-In Smart Reframing</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-400/15 text-emerald-200 border border-emerald-300/30">
              Coming soon
            </Badge>
          </div>
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-10">
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
        <div className="flex items-center justify-center mb-10">
          <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <Switch checked={useStarterTrial} onCheckedChange={setUseStarterTrial} />
            <span className="text-xs text-muted-foreground">Use free trial when choosing Starter</span>
          </label>
        </div>

        <div className="max-w-6xl mx-auto">
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
