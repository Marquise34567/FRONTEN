import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_CONFIG, PLAN_TIERS, type PlanTier } from "@shared/planConfig";
import { cn } from "@/lib/utils";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  onUpgrade: () => void;
};

const UpgradeModal = ({ open, onOpenChange, currentPlan, requiredPlan, onUpgrade }: UpgradeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-background/95 backdrop-blur-xl border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Unlock premium features</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Compare plans and upgrade instantly. Your current plan is highlighted.
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          {PLAN_TIERS.map((tier) => {
            const plan = PLAN_CONFIG[tier];
            const isCurrent = tier === currentPlan;
            const isTarget = tier === requiredPlan;
            return (
              <div
                key={tier}
                className={cn(
                  "rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c111f] to-[#11172a] p-4",
                  isTarget && "ring-2 ring-primary/50",
                  isCurrent && "border-primary/40"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">
                  {plan.priceLabel}
                  {plan.priceMonthly > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            );
          })}
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
