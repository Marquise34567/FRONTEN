import { motion } from "framer-motion";
import { ArrowRight, Check, Clock3, Film, Sparkles, Star, Zap } from "lucide-react";
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

const PLAN_PERSONA: Record<PlanTier, string> = {
  free: "testing Auto-Editor with lightweight weekly uploads",
  starter: "solo creators posting consistently",
  creator: "full-time channels scaling output",
  studio: "agencies and teams shipping at volume",
  founder: "early builders locking lifetime value",
};

const gridVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const featureVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25 },
  },
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
    <motion.div
      className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", showFounderForLayout ? "xl:grid-cols-5" : "xl:grid-cols-4")}
      variants={gridVariants}
      initial="hidden"
      animate="show"
    >
      {visibleTiers.map((tier, index) => {
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
        const resolutionLabel = plan.exportQuality === "4k" ? "4K exports" : `${plan.exportQuality} exports`;
        const rerenderLabel = `${plan.maxRerendersPerDay} rerenders/day`;
        const queueLabel = plan.priority ? "Priority queue" : "Standard queue";
        const minuteCapLabel =
          plan.maxMinutesPerMonth === null ? "No minute cap" : `${plan.maxMinutesPerMonth} min / month`;
        const billingNote = isLifetime
          ? tier === "founder"
            ? "1-time purchase"
            : "One-time payment"
          : tier === "free"
          ? "Free forever"
          : isAnnual
          ? "Billed annually"
          : "Billed monthly";
        const renderLimitLabel = tier === "free"
          ? "10 renders / month"
          : `${plan.maxRendersPerMonth} renders / month`;

        return (
          <motion.article
            key={tier}
            variants={cardVariants}
            custom={index}
            whileHover={{ y: -8, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={cn(
              "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0b1020] via-[#10162b] to-[#121a30] p-4 shadow-[0_12px_36px_rgba(5,8,20,0.38)] backdrop-blur-sm",
              isPopular && "ring-1 ring-primary/45 shadow-[0_25px_80px_rgba(56,189,248,0.18)]",
              isFounder && "ring-1 ring-amber-400/55 shadow-[0_25px_80px_rgba(251,191,36,0.2)]"
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                isFounder
                  ? "bg-[radial-gradient(circle_at_88%_8%,rgba(251,191,36,0.28),transparent_48%)]"
                  : isPopular
                  ? "bg-[radial-gradient(circle_at_88%_8%,rgba(124,58,237,0.3),transparent_48%)]"
                  : "bg-[radial-gradient(circle_at_88%_8%,rgba(148,163,184,0.16),transparent_48%)]"
              )}
            />
            <div className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            {(isPopular || isFounder) && (
              <div className="absolute -top-3 right-6 z-20">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide uppercase",
                    isFounder ? "bg-amber-400/90 text-amber-950 animate-pulse" : "bg-primary/90 text-primary-foreground"
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
            <div className="relative z-10 mb-4 flex items-center gap-2">
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
              <div className="relative z-10 mb-4 space-y-2">
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Limited to first 100 users
                </span>
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                    {founderSlots} lifetime slots remaining
                  </p>
                </div>
              </div>
            )}
            <div className="relative z-10 mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-display text-foreground">{priceLabel}</span>
                {cadenceLabel ? <span className="text-sm text-muted-foreground">{cadenceLabel}</span> : null}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{billingNote}</p>
              <p className="text-xs text-muted-foreground mt-1">{renderLimitLabel}</p>
            </div>
            <div className="relative z-10 mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-foreground/90">
                <Sparkles className="w-3 h-3 text-primary" />
                {resolutionLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-foreground/90">
                <Clock3 className="w-3 h-3 text-sky-300" />
                {rerenderLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-foreground/90">
                <Film className="w-3 h-3 text-emerald-300" />
                {queueLabel}
              </span>
            </div>
            <p className="relative z-10 mb-4 text-xs leading-relaxed text-muted-foreground">
              Best for {PLAN_PERSONA[tier]}. {minuteCapLabel}.
            </p>
            <motion.ul className="mb-5 space-y-2 text-sm text-foreground" variants={gridVariants}>
              {plan.features.map((feature) => (
                <motion.li key={feature} className="flex items-center gap-2" variants={featureVariants}>
                  <span className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center">
                    <Check className="w-3 h-3 text-success" />
                  </span>
                  <span className="text-[13px]">{feature}</span>
                </motion.li>
              ))}
            </motion.ul>
            <div className="relative z-10 mt-auto">
              {showSignup && (
                <Link to="/signup">
                  <Button className="w-full gap-1 rounded-lg bg-foreground text-background hover:bg-foreground/90">
                    Sign up
                    <ArrowRight className="w-4 h-4" />
                  </Button>
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
                    "w-full gap-1 rounded-lg",
                    isPopular || isFounder
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-white/10 hover:bg-white/20 text-foreground"
                  )}
                >
                  {loading && actionTier === tier && actionKind === "subscribe" ? "Redirecting..." : "Upgrade"}
                  {loading && actionTier === tier && actionKind === "subscribe" ? null : <ArrowRight className="w-4 h-4" />}
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
                      "w-full gap-1 rounded-lg",
                      isPopular || isFounder
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : "bg-white/10 hover:bg-white/20 text-foreground"
                    )}
                  >
                    Subscribe
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </motion.article>
        );
      })}
    </motion.div>
  );
};

export default PricingCards;
