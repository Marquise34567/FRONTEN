import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  onUpgrade: () => void;
  founderSlotsRemaining?: number;
};

const COOL_FEATURE_KEYWORDS = [
  "4k",
  "priority",
  "advanced effects",
  "future features",
  "all subtitle",
  "all presets",
  "lifetime",
  "founder badge",
  "locked price forever",
  "karaoke",
  "full zoom",
];

const isCoolFeature = (feature: string) => {
  const normalized = feature.toLowerCase();
  return COOL_FEATURE_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const subtitleAccessLabel = (tier: PlanTier) => {
  const allowed = PLAN_CONFIG[tier].allowedSubtitlePresets;
  if (allowed === "ALL") return "All styles";
  if (!allowed.length) return "Locked";
  if (allowed.length === 1) return "1 style";
  return `${allowed.length} styles`;
};

const exportLabel = (tier: PlanTier) => {
  const quality = PLAN_CONFIG[tier].exportQuality;
  if (quality === "4k") return "4K";
  return quality.toUpperCase();
};

const UpgradeModal = ({
  open,
  onOpenChange,
  currentPlan,
  requiredPlan,
  onUpgrade,
  founderSlotsRemaining = 0,
}: UpgradeModalProps) => {
  const showFounder = (founderSlotsRemaining ?? 0) > 0;
  const displayTiers: PlanTier[] = showFounder
    ? ["founder", ...PLAN_TIERS.filter((tier) => tier !== "founder")]
    : PLAN_TIERS.filter((tier) => tier !== "founder");
  const visibleTiers = displayTiers;
  const currentPlanIndex = PLAN_TIERS.indexOf(currentPlan);
  const activePlan = PLAN_CONFIG[currentPlan] ?? PLAN_CONFIG.free;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-background/95 backdrop-blur-xl border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Unlock premium features</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Compare plans and upgrade instantly. Your current plan is highlighted.
          </p>
        </DialogHeader>
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", showFounder ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
          {visibleTiers.map((tier) => {
            const plan = PLAN_CONFIG[tier];
            const isCurrent = tier === currentPlan;
            const isTarget = tier === requiredPlan;
            const tierIndex = PLAN_TIERS.indexOf(tier);
            const unlockedByCurrentPlan = tierIndex <= currentPlanIndex;
            const isLifetime = plan.lifetime;
            const detailRows = [
              { label: "Export", value: exportLabel(tier) },
              { label: "Renders", value: `${plan.maxRendersPerMonth}/mo` },
              { label: "Subtitles", value: subtitleAccessLabel(tier) },
              { label: "Queue", value: plan.priority ? "Priority" : "Standard" },
              { label: "Watermark", value: plan.watermark ? "On" : "Off" },
            ];
            return (
              <div
                key={tier}
                className={cn(
                  "rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c111f] to-[#11172a] p-4",
                  isTarget && "ring-2 ring-primary/50",
                  isCurrent && "subscription-active-card border-primary/40"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">{plan.description}</p>
                <div className="text-2xl font-bold text-foreground mb-2">
                  {plan.priceLabel}
                  {!isLifetime && plan.priceMonthly > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
                </div>
                <div className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
                  <div className="grid grid-cols-1 gap-1.5">
                    {detailRows.map((row) => (
                      <div key={`${tier}-${row.label}`} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                        unlockedByCurrentPlan
                          ? "border-emerald-400/20 bg-emerald-400/5 text-foreground"
                          : "border-white/10 bg-white/5 text-muted-foreground",
                        unlockedByCurrentPlan && isCoolFeature(feature) && "cool-feature-glow"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded-full",
                          unlockedByCurrentPlan ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-muted-foreground"
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Unlocked on your {activePlan.name} plan</p>
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {activePlan.features.map((feature, index) => (
              <li
                key={`${feature}-${index}`}
                className={cn("unlocked-feature-pill", isCoolFeature(feature) && "cool-feature-glow")}
              >
                <Check className="h-3.5 w-3.5 shrink-0 unlocked-feature-icon" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={onUpgrade} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Upgrade Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
