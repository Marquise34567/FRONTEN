import { Check, Star, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PricingCardsProps = {
  currentTier?: string;
  isAuthenticated: boolean;
  loading?: boolean;
  onCheckout: (tier: PlanTier, options?: { trial?: boolean }) => void;
  onPortal: () => void;
  actionTier?: PlanTier | null;
  actionKind?: "subscribe" | "trial" | null;
  billingInterval?: "monthly" | "annual";
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
}: PricingCardsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {PLAN_TIERS.map((tier) => {
        const plan = PLAN_CONFIG[tier];
        const isPopular = plan.badge === "popular";
        const isCurrent = currentTier === tier;
        const showManage = isAuthenticated && isCurrent && tier !== "free";
        const showCurrent = isAuthenticated && isCurrent && tier === "free";
        const showSubscribe = !showManage && !showCurrent && tier !== "free" && isAuthenticated;
        const showLogin = !isAuthenticated && tier !== "free";
        const showSignup = tier === "free" && !isAuthenticated;
        const isAnnual = billingInterval === "annual";
        const annualLabel = plan.priceMonthly === 0 ? plan.priceLabel : `$${plan.priceMonthly * 12}`;
        const priceLabel = isAnnual ? annualLabel : plan.priceLabel;
        const cadenceLabel = tier === "free" ? "" : isAnnual ? "/year" : "/month";
        const billingNote = tier === "free" ? "Free forever" : isAnnual ? "Billed annually" : "Billed monthly";
        return (
          <div
            key={tier}
            className={cn(
              "relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c111f] to-[#11172a] p-6 shadow-[0_20px_60px_rgba(5,8,20,0.45)]",
              "flex flex-col min-h-[420px]",
              isPopular && "ring-1 ring-primary/40 shadow-[0_25px_80px_rgba(56,189,248,0.18)]"
            )}
          >
            {isPopular && (
              <div className="absolute -top-3 right-6">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 text-primary-foreground px-3 py-1 text-[10px] font-semibold tracking-wide uppercase">
                  <Zap className="w-3 h-3" /> Popular
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mb-4">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", isPopular ? "bg-primary/20" : "bg-white/5")}>
                {isPopular ? <Star className="w-4 h-4 text-primary" /> : <Check className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold font-display text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-display text-foreground">{priceLabel}</span>
                {cadenceLabel ? <span className="text-sm text-muted-foreground">{cadenceLabel}</span> : null}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{billingNote}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {plan.maxRendersPerMonth === null ? "Unlimited renders" : `${plan.maxRendersPerMonth} renders / month`}
              </p>
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
              {showManage && (
                <Button onClick={onPortal} className="w-full rounded-lg bg-foreground text-background hover:bg-foreground/90">
                  Manage
                </Button>
              )}
              {showSubscribe && (
                <div className="grid gap-2">
                  {tier === "starter" && (
                    <Button
                      onClick={() => onCheckout(tier, { trial: true })}
                      disabled={loading && actionTier === tier && actionKind === "trial"}
                      className="w-full rounded-lg bg-white/10 hover:bg-white/20 text-foreground"
                    >
                      {loading && actionTier === tier && actionKind === "trial" ? "Redirecting..." : "Start free trial"}
                    </Button>
                  )}
                  <Button
                    onClick={() => onCheckout(tier)}
                    disabled={loading && actionTier === tier && actionKind === "subscribe"}
                    className={cn(
                      "w-full rounded-lg",
                      isPopular ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-white/10 hover:bg-white/20 text-foreground"
                    )}
                  >
                    {loading && actionTier === tier && actionKind === "subscribe" ? "Redirecting..." : isCurrent ? "Manage" : "Subscribe"}
                  </Button>
                </div>
              )}
              {showLogin && (
                <Link to="/login">
                  <Button className="w-full rounded-lg bg-white/10 hover:bg-white/20 text-foreground">Log in to subscribe</Button>
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
