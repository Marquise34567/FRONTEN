import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Crown, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "annual";

type PricingCardDefinition = {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPrice: number;
  oneTimePrice?: number;
  minuteAllowance: string;
  usageMeta: string;
  features: string[];
  highlighted?: boolean;
  badge?: "popular" | "scale" | "founder";
  annualEligible?: boolean;
};

type PricingCardsProps = {
  currentTier?: string;
  isAuthenticated: boolean;
  loading?: boolean;
  onCheckout: (tier: PlanTier) => void;
  onPortal: () => void;
  actionTier?: PlanTier | null;
  actionKind?: "subscribe" | null;
  billingInterval?: BillingInterval;
  founderSlotsRemaining?: number;
};

const PRICING_PLANS: Record<PlanTier, PricingCardDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    description: "Start editing today with core tools.",
    monthlyPrice: 0,
    minuteAllowance: "Up to 50 minutes of video per month",
    usageMeta: "3 renders/day • 720p exports",
    features: [
      "720p exports",
      "Watermark included",
      "Standard queue",
      "3 renders/day",
      "Basic subtitle presets",
      "Personal use",
    ],
    annualEligible: false,
  },
  starter: {
    tier: "starter",
    name: "Starter",
    description: "For solo creators posting consistently.",
    monthlyPrice: 9,
    minuteAllowance: "Up to 60 minutes of video per month",
    usageMeta: "20 renders/month • 1080p exports",
    features: [
      "1080p exports",
      "No watermark",
      "20 renders/month",
      "Standard queue",
      "Creator subtitle presets",
      "Email support",
    ],
    annualEligible: true,
  },
  creator: {
    tier: "creator",
    name: "Creator",
    description: "Best for fast-growing creator businesses.",
    monthlyPrice: 29,
    minuteAllowance: "Up to 300 minutes of video per month",
    usageMeta: "100 renders/month • 4K exports",
    features: [
      "4K exports",
      "No watermark",
      "100 renders/month",
      "Priority queue",
      "All presets",
      "Advanced effects",
      "Repurpose-ready workflows",
    ],
    highlighted: true,
    badge: "popular",
    annualEligible: true,
  },
  studio: {
    tier: "studio",
    name: "Studio",
    description: "For teams and agencies shipping at volume.",
    monthlyPrice: 99,
    minuteAllowance: "Unlimited minutes of video per month",
    usageMeta: "5000 renders/month • 4K exports",
    features: [
      "4K exports",
      "Priority queue",
      "All features unlocked",
      "Unlimited team members",
      "5000 renders/month",
      "Shared workflow controls",
      "Priority support",
    ],
    highlighted: true,
    badge: "scale",
    annualEligible: true,
  },
  founder: {
    tier: "founder",
    name: "Founder",
    description: "One-time lifetime access for early adopters.",
    monthlyPrice: 0,
    oneTimePrice: 149,
    minuteAllowance: "Up to 500 minutes of video per month forever",
    usageMeta: "Lifetime license • One-time payment",
    features: [
      "One-time payment",
      "500 minutes/month forever",
      "4K exports",
      "Priority queue",
      "All premium features",
      "Founder lifetime badge",
      "No recurring subscription",
    ],
    badge: "founder",
    annualEligible: false,
  },
};

const annualPriceForMonthly = (monthlyPrice: number) => Math.round(monthlyPrice * 12 * 0.8);

const resolveDisplayOrder = (showFounder: boolean): PlanTier[] =>
  showFounder ? ["free", "starter", "creator", "studio", "founder"] : ["free", "starter", "creator", "studio"];

type PlanCtaLabelArgs = {
  isCurrent: boolean;
  isSubscribed: boolean;
  isFounder: boolean;
  plan: PlanTier;
};

export const getPlanCtaLabel = ({ isCurrent, isSubscribed, isFounder, plan }: PlanCtaLabelArgs) => {
  if (plan === "founder" && isFounder) return "You have Founder";
  if (isCurrent) return "Current Plan";
  if (plan === "founder") return "Get Founder Access";
  if (isSubscribed) return "Switch Plan";
  if (plan !== "free") return "Subscribe";
  return "Get Started";
};

const PricingCards = ({
  currentTier,
  isAuthenticated,
  loading = false,
  onCheckout,
  onPortal,
  actionTier,
  actionKind,
  billingInterval = "monthly",
  founderSlotsRemaining = 0,
}: PricingCardsProps) => {
  const prefersReducedMotion = useReducedMotion();
  const { t } = useTranslation("common");
  const currentPlan = currentTier && PLAN_TIERS.includes(currentTier as PlanTier) ? (currentTier as PlanTier) : "free";
  const hasActiveSubscription = isAuthenticated && currentPlan !== "free" && currentPlan !== "founder";
  const hasFounderAccess = isAuthenticated && currentPlan === "founder";
  const founderSlots = Math.max(0, founderSlotsRemaining);
  const showFounderCard = founderSlots > 0 || currentPlan === "founder";
  const planOrder = resolveDisplayOrder(showFounderCard);
  const isAnnual = billingInterval === "annual";
  const founderAvailabilityCopy =
    founderSlots > 0
      ? `Limited founder slots available • ${founderSlots} slots left`
      : "Limited founder slots available";

  return (
    // Mobile-first: one full-width card per row under md, then progressive columns.
    <div className={cn("grid grid-cols-1 gap-4 md:gap-5", showFounderCard ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4")}>
      {planOrder.map((tier, index) => {
        const plan = PRICING_PLANS[tier];
        const isCurrent = isAuthenticated && currentPlan === tier;
        const ctaLabel = getPlanCtaLabel({
          isCurrent,
          isSubscribed: hasActiveSubscription && currentPlan !== tier,
          isFounder: hasFounderAccess,
          plan: tier,
        });
        const annualEligible = plan.annualEligible !== false && !plan.oneTimePrice && tier !== "free";
        const monthlyEquivalent = annualEligible ? Math.round((annualPriceForMonthly(plan.monthlyPrice) / 12) * 100) / 100 : null;
        const displayPrice = plan.oneTimePrice
          ? `$${plan.oneTimePrice}`
          : annualEligible && isAnnual
            ? `$${annualPriceForMonthly(plan.monthlyPrice)}`
            : `$${plan.monthlyPrice}`;
        const cadence = plan.oneTimePrice
          ? t("pricing.card.oneTime", { defaultValue: "one-time" })
          : tier === "free"
            ? t("pricing.card.forever", { defaultValue: "forever" })
            : isAnnual
              ? "/year"
              : "/month";
        const isBusy = Boolean(loading && actionTier === tier && actionKind === "subscribe");
        const isDisabled = isCurrent || (tier === "founder" && hasFounderAccess) || isBusy;
        const isPrimaryCta = ctaLabel === "Subscribe" || ctaLabel === "Switch Plan" || ctaLabel === "Get Founder Access";
        const showArrow = !isDisabled && ctaLabel !== "Get Started";
        const buttonLabel = isBusy ? t("pricing.card.redirecting", { defaultValue: "Redirecting..." }) : ctaLabel;
        const ctaClassName = cn(
          "h-11 w-full rounded-xl font-semibold",
          isDisabled
            ? "border border-purple-300/20 bg-white/10 text-white"
            : isPrimaryCta
              ? "bg-gradient-to-r from-[#A855F7] to-[#C084FC] text-white hover:brightness-110"
              : "border border-purple-300/25 bg-white/10 text-white hover:bg-white/15",
        );

        const renderButton = () => (
          <Button
            type="button"
            onClick={() => {
              if (isDisabled || !isAuthenticated) return;
              if (tier === "free") {
                if (ctaLabel === "Switch Plan") onPortal();
                return;
              }
              onCheckout(tier);
            }}
            disabled={isDisabled}
            className={ctaClassName}
          >
            {ctaLabel === "Get Started" ? <Sparkles className="mr-1 h-4 w-4 text-purple-200" /> : null}
            {buttonLabel}
            {showArrow ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
          </Button>
        );

        return (
          <motion.article
            key={tier}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.44, ease: [0.4, 0, 0.2, 1], delay: index * 0.06 }}
            className={cn(
              "pricing-neon-glow group relative flex h-full flex-col overflow-hidden rounded-2xl border border-purple-800/30 bg-[linear-gradient(160deg,rgba(17,17,30,0.88),rgba(22,22,39,0.82))] p-5 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.42)] transform-gpu [backface-visibility:hidden] [contain:paint]",
              plan.highlighted && "border-purple-500/45 ring-1 ring-purple-500/30",
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(192,132,252,0.2),transparent_42%),radial-gradient(circle_at_92%_0%,rgba(168,85,247,0.18),transparent_38%)] opacity-80" />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              {plan.badge === "popular" ? (
                <span className="inline-flex items-center rounded-full border border-purple-300/40 bg-purple-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-100">
                  {t("pricing.card.mostPopular", { defaultValue: "Most Popular" })}
                </span>
              ) : null}
              {plan.badge === "scale" ? (
                <span className="inline-flex items-center rounded-full border border-violet-300/35 bg-violet-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">
                  <Zap className="mr-1 h-3 w-3" />
                  {t("pricing.card.studioPick", { defaultValue: "Studio" })}
                </span>
              ) : null}
              {plan.badge === "founder" ? (
                <span className="inline-flex items-center rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  <Crown className="mr-1 h-3 w-3" />
                  {t("pricing.card.founderBadge", { defaultValue: "Founder" })}
                </span>
              ) : null}
            </div>

            <p className="relative z-10 mt-1 text-sm text-slate-300/90">{plan.description}</p>

            <div className="relative z-10 mt-4">
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold leading-none text-white">{displayPrice}</span>
                <span className="pb-1 text-sm text-slate-300">{cadence}</span>
              </div>
              {annualEligible && isAnnual ? (
                <p className="mt-1 text-xs text-purple-200/90">
                  {t("pricing.card.equivalent", { defaultValue: "Equivalent to" })} ${monthlyEquivalent?.toFixed(2)}/mo
                </p>
              ) : null}
              {plan.badge === "founder" ? (
                <p className="mt-1 text-xs text-amber-200/90">
                  {founderAvailabilityCopy}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-300/85">{plan.usageMeta}</p>
              )}
              <p className="mt-3 text-sm font-semibold text-purple-200">{plan.minuteAllowance}</p>
            </div>

            <ul className="relative z-10 mt-4 space-y-2">
              {plan.features.slice(0, 8).map((feature) => (
                <li key={`${tier}-${feature}`} className="flex items-start gap-2 text-sm text-slate-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="relative z-10 mt-5">
              {/* Mobile-first: CTA stays full-width for easier tap targets. */}
              {!isAuthenticated && !isDisabled ? <Link to="/signup">{renderButton()}</Link> : renderButton()}
            </div>
          </motion.article>
        );
      })}
    </div>
  );
};

export default PricingCards;
