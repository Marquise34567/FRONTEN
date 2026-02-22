import { Check, Star, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PricingCardsProps = {
  currentTier?: string;
  isAuthenticated: boolean;
  loading?: boolean;
  onCheckout: (tier: PlanTier) => void;
  onPortal: () => void;
  actionTier?: PlanTier | null;
  actionKind?: "subscribe" | null;
  billingInterval?: "monthly" | "annual";
  founderSlotsRemaining?: number;
};

const PricingCards = ({
  currentTier,
  isAuthenticated,
  loading,
  onCheckout,
  onPortal,
  actionTier,
  actionKind,
  billingInterval = "monthly",
  founderSlotsRemaining = 0,
}: PricingCardsProps) => {
  const currentPlan = currentTier && PLAN_TIERS.includes(currentTier as PlanTier) ? (currentTier as PlanTier) : "free";
  const currentIndex = PLAN_TIERS.indexOf(currentPlan);
  const founderSlots = Math.max(0, founderSlotsRemaining ?? 0);
  const showFounderForLayout = founderSlots > 0;
  const displayTiers: PlanTier[] = showFounderForLayout
    ? ["founder", ...PLAN_TIERS.filter((tier) => tier !== "founder")]
    : PLAN_TIERS.filter((tier) => tier !== "founder");
  const visibleTiers = displayTiers;

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", showFounderForLayout ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
      {visibleTiers.map((tier) => {
        const plan = PLAN_CONFIG[tier];
        const isPopular = plan.badge === "popular";
        const isFounder = plan.badge === "founder";
        const isCurrent = isAuthenticated && currentPlan === tier;
        const tierIndex = PLAN_TIERS.indexOf(tier);
        const isUpgrade = isAuthenticated && tierIndex > currentIndex;
        const isDowngrade = isAuthenticated && tierIndex < currentIndex;
        const showCurrent = isAuthenticated && isCurrent;
        const showUpgrade = isAuthenticated && isUpgrade;
        const showManage = isAuthenticated && isDowngrade && tier !== "free";
        const showSubscribe = !isAuthenticated && tier !== "free";
        const showSignup = !isAuthenticated && tier === "free";
        const isAnnual = billingInterval === "annual";
        const isLifetime = plan.lifetime;
        const annualLabel = plan.priceMonthly === 0 ? plan.priceLabel : `$${plan.priceMonthly * 12}`;
        const priceLabel = isLifetime ? plan.priceLabel : isAnnual ? annualLabel : plan.priceLabel;
        const cadenceLabel = isLifetime || tier === "free" ? "" : isAnnual ? "/year" : "/month";
        const billingNote = isLifetime
          ? tier === "founder"
            ? "1-time purchase"
            : "One-time payment"
          : tier === "free"
          ? "Free forever"
          : isAnnual
          ? "Billed annually"
          : "Billed monthly";
        const renderLimitLabel = `${plan.maxRendersPerMonth} renders / month`;

        return (
          <div
            key={tier}
            className={cn(
              "relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c111f] to-[#11172a] p-6 shadow-[0_20px_60px_rgba(5,8,20,0.45)]",
              "flex flex-col min-h-[420px]",
              isPopular && "ring-1 ring-primary/40 shadow-[0_25px_80px_rgba(56,189,248,0.18)]",
              isFounder && "ring-1 ring-amber-400/50 shadow-[0_25px_80px_rgba(251,191,36,0.18)]"
            )}
          >
            {(isPopular || isFounder) && (
              <div className="absolute -top-3 right-6">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide uppercase",
                    isFounder ? "bg-amber-400/90 text-amber-950" : "bg-primary/90 text-primary-foreground"
                  )}
                >
                      {isFounder ? (
                        <Star className="w-3 h-3" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      {isFounder ? "Founder" : "Popular"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-4">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center",
                  isFounder ? "bg-amber-400/15" : isPopular ? "bg-primary/20" : "bg-white/5"
                )}
              >
                {isFounder ? (
                  <Star className="w-4 h-4 text-amber-400" />
                ) : isPopular ? (
                  <Zap className="w-4 h-4 text-primary" />
                ) : (
                  <Check className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold font-display text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
            </div>
            {isFounder && (
              <div className="mb-4">
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Limited to first 100 users
                </span>
              </div>
            )}
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-display text-foreground">{priceLabel}</span>
                {cadenceLabel ? <span className="text-sm text-muted-foreground">{cadenceLabel}</span> : null}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{billingNote}</p>
              <p className="text-xs text-muted-foreground mt-2">{renderLimitLabel}</p>
            </div>
            <ul className="space-y-3 text-sm text-foreground mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center">
                    <Check className="w-3 h-3 text-success" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              {showSignup && (
                <Link to="/signup">
                  <Button className="w-full rounded-lg bg-foreground text-background hover:bg-foreground/90">Sign up</Button>
                </Link>
              )}
              {showCurrent && (
                <Button variant="secondary" className="w-full rounded-lg" disabled>
                  Current plan
                </Button>
              )}
              {showUpgrade && (
                <Button
                  onClick={() => onCheckout(tier)}
                  disabled={loading && actionTier === tier && actionKind === "subscribe"}
                  className={cn(
                    "w-full rounded-lg",
                    isPopular || isFounder
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-white/10 hover:bg-white/20 text-foreground"
                  )}
                >
                  {loading && actionTier === tier && actionKind === "subscribe" ? "Redirecting..." : "Upgrade"}
                </Button>
              )}
              {showManage && (
                <Button onClick={onPortal} className="w-full rounded-lg bg-foreground text-background hover:bg-foreground/90">
                  Manage
                </Button>
              )}
              {showSubscribe && (
                <Link to="/signup">
                  <Button
                    className={cn(
                      "w-full rounded-lg",
                      isPopular || isFounder
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : "bg-white/10 hover:bg-white/20 text-foreground"
                    )}
                  >
                    Subscribe
                  </Button>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PricingCards;
