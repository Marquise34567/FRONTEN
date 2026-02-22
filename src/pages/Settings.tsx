import { motion } from "framer-motion";
import { useState } from "react";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, Sparkles } from "lucide-react";
import PricingCards from "@/components/PricingCards";
import { useMe } from "@/hooks/use-me";
import { useAuth } from "@/providers/AuthProvider";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@shared/planConfig";

const Settings = () => {
  const { accessToken } = useAuth();
  const { data } = useMe();
  const [action, setAction] = useState<{ tier: PlanTier; kind: "subscribe" | "trial" } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const { toast } = useToast();

  const handleCheckout = async (tier: PlanTier, options?: { trial?: boolean }) => {
    if (!accessToken) return;
    try {
      const kind = options?.trial ? "trial" : "subscribe";
      setAction({ tier, kind });
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval: billingInterval, trial: !!options?.trial }),
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

  const tier = data?.subscription?.tier || "free";
  const usage = data?.usage;
  const limits = data?.limits;

  return (
    <GlowBackdrop>
      <Navbar />
      <main className="min-h-screen px-4 pt-24 pb-12 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold font-display text-foreground mb-8">Settings</h1>

          {/* Plan */}
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
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{tier}</Badge>
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

          {/* Usage */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Monthly Usage</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="glass-card p-4">
                <p className="text-muted-foreground mb-1">Renders Used</p>
                <p className="text-2xl font-bold font-display text-foreground">
                  {usage?.rendersUsed ?? 0}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {limits?.maxRendersPerMonth ?? "Unlimited"}
                  </span>
                </p>
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
          </div>

          {/* Account */}
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
            <PricingCards
              currentTier={tier}
              isAuthenticated={true}
              loading={action !== null}
              onCheckout={handleCheckout}
              onPortal={handlePortal}
              actionTier={action?.tier ?? null}
              actionKind={action?.kind ?? null}
              billingInterval={billingInterval}
            />
          </div>
        </motion.div>
      </main>
    </GlowBackdrop>
  );
};

export default Settings;
