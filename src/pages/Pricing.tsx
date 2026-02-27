import { useMemo, useState } from "react";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import { Switch } from "@/components/ui/switch";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useFounderAvailability } from "@/hooks/use-founder-availability";
import type { PlanTier } from "@/shared/planConfig";

type BillingInterval = "monthly" | "annual";

type Tier = {
  id: PlanTier;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  oneTimePrice?: number;
  features: string[];
  popular?: boolean;
  premium?: boolean;
};

const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    subtitle: "Try retention-first editing",
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["10 renders / month", "Basic retention graph", "Manual trim + export"],
  },
  {
    id: "starter",
    name: "Starter",
    subtitle: "For consistent weekly publishing",
    monthlyPrice: 9,
    annualPrice: 86,
    features: ["20 renders / month", "1080p exports", "Caption + pacing automation", "Standard queue"],
  },
  {
    id: "creator",
    name: "Creator",
    subtitle: "Scale multi-channel output",
    monthlyPrice: 29,
    annualPrice: 278,
    popular: true,
    features: ["100 renders / month", "4K exports", "Deep retention analytics", "Priority queue"],
  },
  {
    id: "studio",
    name: "Studio",
    subtitle: "For teams and production workflows",
    monthlyPrice: 99,
    annualPrice: 948,
    features: ["5000 renders / month", "Advanced experimentation controls", "Team workflows", "Priority support"],
  },
  {
    id: "founder",
    name: "Founder",
    subtitle: "One-time lifetime access for early adopters",
    monthlyPrice: 0,
    annualPrice: 0,
    oneTimePrice: 149,
    premium: true,
    features: [
      "One-time payment",
      "500 minutes / month forever",
      "4K exports + priority queue",
      "All future premium features",
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const { data: founderAvailability } = useFounderAvailability();
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [starterTrialEnabled, setStarterTrialEnabled] = useState(true);

  const founderSlotsRemaining = Math.max(0, Number(founderAvailability?.remaining || 0));
  const founderSoldOut = Boolean(founderAvailability?.soldOut);

  const comparisonRows = useMemo(
    () => [
      ["Retention scoring", "Basic", "Advanced", "Deep dive", "Deep dive + lab", "Deep dive + future"],
      ["Renders/month", "10", "20", "100", "5000", "5000+"],
      ["Queue priority", "Standard", "Standard", "Priority", "Priority", "Priority"],
      ["Billing model", "Free", "Recurring", "Recurring", "Recurring", "One-time lifetime"],
    ],
    [],
  );

  const getDisplayPrice = (tier: Tier) => {
    if (tier.oneTimePrice) return `$${tier.oneTimePrice}`;
    if (billingInterval === "annual") return `$${tier.annualPrice}`;
    return `$${tier.monthlyPrice}`;
  };

  const getCadence = (tier: Tier) => {
    if (tier.oneTimePrice) return "one-time";
    if (tier.id === "free") return "forever";
    return billingInterval === "annual" ? "/year" : "/month";
  };

  const handleCheckout = async (tier: PlanTier) => {
    if (tier === "free") {
      navigate("/signup");
      return;
    }
    if (tier === "founder" && founderSoldOut) {
      toast({ title: "Founder plan sold out", description: "Founder access is currently unavailable." });
      return;
    }
    if (!accessToken) {
      navigate("/signup");
      return;
    }
    try {
      setLoadingTier(tier);
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          tier,
          interval: billingInterval,
          trial: tier === "starter" ? starterTrialEnabled : false,
        }),
      });
      window.location.href = result.url;
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : "Checkout unavailable right now.";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <AppShell title="AutoEditor Pricing">
      <div className="space-y-4">
        <PremiumCard className="overflow-hidden p-8 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(34,211,238,0.16),transparent_55%),radial-gradient(90%_120%_at_100%_0%,rgba(217,70,239,0.2),transparent_58%)]" />
          <div className="relative">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-5xl">
              Premium Plans Built For 2026 Creator Teams
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Every tier includes retention-first editing logic. Upgrade for deeper analytics, faster iteration loops, and
              premium output controls.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-white/15 bg-black/35 p-1">
                <button
                  type="button"
                  onClick={() => setBillingInterval("monthly")}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    billingInterval === "monthly" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("annual")}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    billingInterval === "annual" ? "bg-cyan-400/20 text-cyan-100" : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  Annual
                </button>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">
                <span>Starter free trial</span>
                <Switch checked={starterTrialEnabled} onCheckedChange={setStarterTrialEnabled} />
              </div>
              {founderSlotsRemaining > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                  <Crown className="h-3.5 w-3.5" />
                  Founder slots left: {founderSlotsRemaining}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100">
                  Founder plan sold out
                </div>
              )}
            </div>
          </div>
        </PremiumCard>

        <section className="grid gap-4 xl:grid-cols-5">
          {tiers.map((tier) => (
            <PremiumCard
              key={tier.id}
              className={`relative flex h-full flex-col p-5 ${
                tier.popular
                  ? "border-cyan-300/45 shadow-[0_0_35px_rgba(34,211,238,0.22)]"
                  : tier.premium
                    ? "border-amber-300/40 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(245,158,11,0.2),transparent_58%),linear-gradient(180deg,rgba(20,13,5,0.88),rgba(10,8,5,0.92))]"
                    : ""
              }`}
            >
              {tier.popular ? (
                <span className="absolute right-4 top-4 rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
                  Popular
                </span>
              ) : null}
              {tier.premium ? (
                <span className="absolute right-4 top-4 rounded-full border border-amber-300/35 bg-amber-400/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                  Founder
                </span>
              ) : null}

              <p className={`text-sm uppercase tracking-[0.14em] ${tier.premium ? "text-amber-200" : "text-purple-200"}`}>
                {tier.name}
              </p>
              <p className="mt-3 text-4xl font-semibold text-slate-100">
                {getDisplayPrice(tier)}
                <span className="text-sm text-slate-400"> {getCadence(tier)}</span>
              </p>
              <p className="mt-2 text-sm text-slate-300">{tier.subtitle}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <PurpleAccentButton
                className={`mt-4 w-full ${tier.premium ? "from-amber-500 to-yellow-400 text-black hover:opacity-95" : ""}`}
                onClick={() => handleCheckout(tier.id)}
                disabled={loadingTier !== null || (tier.id === "founder" && founderSoldOut)}
              >
                {loadingTier === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {tier.id === "free" ? "Start Free" : tier.id === "founder" ? "Claim Founder Access" : "Choose Plan"}
              </PurpleAccentButton>
            </PremiumCard>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <PremiumCard className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-100">Plan Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-black/40 text-slate-300">
                  <tr>
                    <th className="px-5 py-3 text-left">Feature</th>
                    <th className="px-5 py-3 text-left">Free</th>
                    <th className="px-5 py-3 text-left">Starter</th>
                    <th className="px-5 py-3 text-left">Creator</th>
                    <th className="px-5 py-3 text-left">Studio</th>
                    <th className="px-5 py-3 text-left">Founder</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row[0]} className="border-t border-white/10">
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className="px-5 py-3 text-slate-200">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <h2 className="text-lg font-semibold text-slate-100">Why teams choose premium</h2>
            <div className="mt-4 space-y-3">
              {[
                "Retention predictions tied to every completed job.",
                "Faster render queue for Creator/Studio/Founder tiers.",
                "Founder plan locks in pricing and future feature access.",
                "Starter trial toggle lets you test premium before billing.",
              ].map((line) => (
                <div key={line} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                  <p className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    {line}
                  </p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>
    </AppShell>
  );
}
