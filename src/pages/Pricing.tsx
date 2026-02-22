import { motion } from "framer-motion";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import PricingCards from "@/components/PricingCards";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@shared/planConfig";

const Pricing = () => {
  const { accessToken, user } = useAuth();
  const { data } = useMe();
  const [actionTier, setActionTier] = useState<PlanTier | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const { toast } = useToast();

  const handleCheckout = async (tier: PlanTier) => {
    if (!accessToken) return;
    try {
      setActionTier(tier);
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval: billingInterval }),
        token: accessToken,
      });
      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err?.message || "Please try again." });
    } finally {
      setActionTier(null);
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

        <div className="max-w-6xl mx-auto">
          <PricingCards
            currentTier={data?.subscription?.tier}
            isAuthenticated={!!user}
            loading={actionTier !== null}
            onCheckout={handleCheckout}
            onPortal={handlePortal}
            actionTier={actionTier}
            billingInterval={billingInterval}
          />
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default Pricing;
