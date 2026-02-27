import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/premium/AppShell";
import PremiumCard from "@/components/premium/PremiumCard";
import PurpleAccentButton from "@/components/premium/PurpleAccentButton";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@/shared/planConfig";

type Tier = {
  id: PlanTier;
  name: string;
  price: string;
  subtitle: string;
  features: string[];
  popular?: boolean;
};

const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    subtitle: "Try retention-first editing basics",
    features: ["3 renders / month", "Basic retention graph", "Manual trim + export"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    subtitle: "For consistent publishing",
    features: ["60 renders / month", "Hook + drop-risk optimization", "Caption + pacing automation"],
  },
  {
    id: "creator",
    name: "Creator",
    price: "$79",
    subtitle: "Scale multi-channel output",
    popular: true,
    features: ["300 renders / month", "Deep dive retention analytics", "Priority render queue + presets"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$199",
    subtitle: "Studio-level throughput",
    features: ["Unlimited renders", "Advanced experimentation controls", "Team collaboration + API access"],
  },
];

const faqs = [
  {
    q: "How does retention optimization work?",
    a: "AutoEditor predicts drop-offs, inserts micro-hooks, and tunes pacing/captions/effects to maximize watch-through.",
  },
  {
    q: "Can I export vertical and horizontal from one upload?",
    a: "Yes. The pipeline supports multi-format output with platform-specific pacing defaults.",
  },
  {
    q: "Do I keep manual control?",
    a: "Yes. You can override AI decisions with manual timestamp editing and custom section controls.",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const comparisonRows = useMemo(
    () => [
      ["Retention scoring", "Basic", "Advanced", "Deep dive", "Deep dive + lab"],
      ["Renders/month", "3", "60", "300", "Unlimited"],
      ["Realtime analytics", "No", "Basic", "Yes", "Yes + API"],
      ["Priority queue", "No", "No", "Yes", "Highest"],
    ],
    [],
  );

  const handleCheckout = async (tier: PlanTier) => {
    if (tier === "free") {
      navigate("/signup");
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
        body: JSON.stringify({ tier, interval: "monthly", trial: tier === "starter" }),
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
        <PremiumCard className="p-8 md:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-5xl">
            Premium Plans For 2026 Creator Teams
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Every tier includes retention-first editing logic. Upgrade for deeper analytics, more renders, and faster
            iteration loops.
          </p>
        </PremiumCard>

        <section className="grid gap-4 xl:grid-cols-4">
          {tiers.map((tier) => (
            <PremiumCard
              key={tier.id}
              className={`relative flex h-full flex-col p-5 ${tier.popular ? "border-purple-300/45 shadow-[0_0_30px_rgba(168,85,247,0.28)]" : ""}`}
            >
              {tier.popular ? (
                <span className="absolute right-4 top-4 rounded-full border border-purple-300/35 bg-purple-500/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-purple-100">
                  Popular
                </span>
              ) : null}
              <p className="text-sm uppercase tracking-[0.14em] text-purple-200">{tier.name}</p>
              <p className="mt-3 text-4xl font-semibold text-slate-100">
                {tier.price}
                <span className="text-sm text-slate-400">/mo</span>
              </p>
              <p className="mt-2 text-sm text-slate-400">{tier.subtitle}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <PurpleAccentButton
                className="mt-4 w-full"
                onClick={() => handleCheckout(tier.id)}
                disabled={loadingTier !== null}
              >
                {loadingTier === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {tier.id === "free" ? "Start Free" : "Choose Plan"}
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
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-black/40 text-slate-300">
                  <tr>
                    <th className="px-5 py-3 text-left">Feature</th>
                    <th className="px-5 py-3 text-left">Free</th>
                    <th className="px-5 py-3 text-left">Starter</th>
                    <th className="px-5 py-3 text-left">Pro</th>
                    <th className="px-5 py-3 text-left">Scale</th>
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
            <h2 className="text-lg font-semibold text-slate-100">FAQ</h2>
            <div className="mt-4 space-y-3">
              {faqs.map((item) => (
                <div key={item.q} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                  <p className="text-sm font-medium text-slate-100">{item.q}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.a}</p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>
    </AppShell>
  );
}
