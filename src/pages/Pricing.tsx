import { useMemo, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import GoldAccentButton from "@/components/premium/GoldAccentButton";
import PremiumCard from "@/components/premium/PremiumCard";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import type { PlanTier } from "@/shared/planConfig";

type BillingInterval = "monthly" | "annual";

type PricingPlan = {
  id: "free" | "pro" | "enterprise";
  title: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  mappedTier: PlanTier;
  featured?: boolean;
  tone: "neutral" | "teal" | "violet";
  features: string[];
  scans: string;
  exports: string;
};

const plans: PricingPlan[] = [
  {
    id: "free",
    title: "Free",
    subtitle: "Starter clips and basic hook scoring",
    monthlyPrice: 0,
    annualPrice: 0,
    mappedTier: "free",
    tone: "neutral",
    scans: "20 retention scans / month",
    exports: "720p exports",
    features: [
      "Credits: 20 clips/month",
      "Hook AI (basic)",
      "Caption automation",
      "Single-platform export",
      "Community support",
    ],
  },
  {
    id: "pro",
    title: "Pro",
    subtitle: "Best for creators scaling short-form output",
    monthlyPrice: 19,
    annualPrice: 15,
    mappedTier: "creator",
    featured: true,
    tone: "teal",
    scans: "200 retention scans / month",
    exports: "4K multi-platform exports",
    features: [
      "Credits: 500 clips/month",
      "Advanced Hook AI + pacing controls",
      "Studio audio enhancement",
      "Animated caption styles + keyword highlighter",
      "TikTok / Reels / Shorts / YouTube exports",
    ],
  },
  {
    id: "enterprise",
    title: "Enterprise",
    subtitle: "Custom automation for teams and agencies",
    monthlyPrice: 49,
    annualPrice: 39,
    mappedTier: "studio",
    tone: "violet",
    scans: "Unlimited retention scans",
    exports: "Priority queue + team workspaces",
    features: [
      "Unlimited processing credits",
      "Custom hook/pacing models",
      "Shared brand templates",
      "SLA support + onboarding",
      "Advanced reporting API",
    ],
  },
];

const comparisonRows = [
  ["Retention scans", "20/mo", "200/mo", "Unlimited"],
  ["Hook AI", "Basic", "Advanced", "Custom"],
  ["Studio Audio", "-", "Included", "Included + presets"],
  ["Exports", "Single platform", "Multi-platform", "Multi-platform + team queues"],
  ["Analytics depth", "Core", "Retention + virality", "Cross-team attribution"],
];

export default function Pricing() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [loadingTier, setLoadingTier] = useState<PricingPlan["id"] | null>(null);

  const intervalSuffix = billingInterval === "annual" ? "/mo billed yearly" : "/mo";

  const planCopy = useMemo(
    () => ({
      monthly: "Switch to yearly for ~20% savings.",
      annual: "Annual active: Save tag unlocked.",
    }),
    [],
  );

  const handleCheckout = async (plan: PricingPlan) => {
    if (plan.mappedTier === "free") {
      navigate("/signup");
      return;
    }

    if (!accessToken) {
      navigate("/signup");
      return;
    }

    try {
      setLoadingTier(plan.id);
      const result = await apiFetch<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          tier: plan.mappedTier,
          interval: billingInterval === "annual" ? "annual" : "monthly",
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
    <div className="min-h-screen bg-[var(--ae-bg)] text-[var(--ae-text-primary)]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span>AutoEditor</span>
            <span className="rounded-full border border-cyan-200/30 bg-cyan-400/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
              BETA
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-200/45 md:inline-flex"
            >
              Sign In
            </Link>
            <GoldAccentButton asChild size="sm">
              <Link to="/signup">Sign Up</Link>
            </GoldAccentButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] space-y-5 px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <PremiumCard className="relative overflow-hidden p-7 md:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(47,228,200,0.2),transparent_54%),radial-gradient(90%_120%_at_100%_0%,rgba(180,119,255,0.2),transparent_56%)]" />
          <div className="relative">
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Premium Pricing For Retention-First AI Editing
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Credits, hook AI, studio audio, and high-retention export pipelines in one dark premium workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-cyan-200/25 bg-black/35 p-1">
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
                  Yearly
                </button>
              </div>
              <span className="rounded-full border border-emerald-300/35 bg-emerald-500/12 px-3 py-1 text-xs text-emerald-100">
                Annual Save Tag: 20%
              </span>
              <span className="text-xs text-slate-400">{planCopy[billingInterval]}</span>
            </div>
          </div>
        </PremiumCard>

        <section className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = billingInterval === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const cardTone =
              plan.tone === "teal"
                ? "border-cyan-200/45 shadow-[0_0_24px_rgba(47,228,200,0.16)]"
                : plan.tone === "violet"
                  ? "border-violet-300/30"
                  : "border-white/10";

            return (
              <PremiumCard key={plan.id} className={`relative flex h-full flex-col p-5 ${cardTone}`}>
                {plan.featured ? (
                  <span className="absolute right-4 top-4 rounded-full border border-cyan-200/40 bg-cyan-400/16 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100">
                    Most Popular
                  </span>
                ) : null}
                {plan.id === "pro" ? (
                  <span className="absolute left-4 top-4 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-100">
                    BETA Access
                  </span>
                ) : null}

                <p className="mt-6 text-sm uppercase tracking-[0.14em] text-cyan-100">{plan.title}</p>
                <p className="mt-3 text-4xl font-semibold text-white">
                  ${price}
                  <span className="text-sm text-slate-400"> {intervalSuffix}</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">{plan.subtitle}</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
                  <p>{plan.scans}</p>
                  <p className="mt-1">{plan.exports}</p>
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 text-cyan-300" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <GoldAccentButton className="mt-4 w-full" onClick={() => handleCheckout(plan)} disabled={loadingTier !== null}>
                  {loadingTier === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {plan.id === "free" ? "Start Free" : plan.id === "pro" ? "Choose Pro" : "Contact Enterprise"}
                </GoldAccentButton>
              </PremiumCard>
            );
          })}
        </section>

        <PremiumCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">Plan Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-black/35 text-slate-300">
                <tr>
                  <th className="px-5 py-3 text-left">Metric</th>
                  <th className="px-5 py-3 text-left">Free</th>
                  <th className="px-5 py-3 text-left">Pro</th>
                  <th className="px-5 py-3 text-left">Enterprise</th>
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
      </main>
    </div>
  );
}
