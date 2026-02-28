import { useMemo, useState } from "react";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_TIERS, type PlanTier } from "@shared/planConfig";

const parsePlanTier = (value: string, fallback: PlanTier): PlanTier => {
  const normalized = String(value || "").trim().toLowerCase();
  return PLAN_TIERS.includes(normalized as PlanTier) ? (normalized as PlanTier) : fallback;
};

const DevUpgradeModalPreview = () => {
  const [open, setOpen] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>("free");
  const [requiredPlan, setRequiredPlan] = useState<PlanTier>("starter");
  const [founderSlotsRemaining, setFounderSlotsRemaining] = useState(0);
  const [upgradeCount, setUpgradeCount] = useState(0);

  const helperText = useMemo(() => {
    if (currentPlan === requiredPlan) return "Current and required plan are equal (upgrade CTA still visible for styling).";
    return `Previewing upgrade from ${currentPlan} to ${requiredPlan}.`;
  }, [currentPlan, requiredPlan]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,28,53,0.7),transparent_50%),linear-gradient(180deg,#070a14,#0d1327_60%,#0a0f1d)] text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
        <div className="rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Dev Route</Badge>
            <code>/dev/upgrade-modal</code>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{helperText}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/25 p-4 backdrop-blur md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Current plan</span>
            <select
              className="h-10 w-full rounded-md border border-white/15 bg-background/70 px-3 text-sm"
              value={currentPlan}
              onChange={(event) => setCurrentPlan(parsePlanTier(event.target.value, "free"))}
            >
              {PLAN_TIERS.map((tier) => (
                <option key={`current-${tier}`} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Required plan</span>
            <select
              className="h-10 w-full rounded-md border border-white/15 bg-background/70 px-3 text-sm"
              value={requiredPlan}
              onChange={(event) => setRequiredPlan(parsePlanTier(event.target.value, "starter"))}
            >
              {PLAN_TIERS.map((tier) => (
                <option key={`required-${tier}`} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Founder slots</span>
            <input
              type="number"
              min={0}
              step={1}
              className="h-10 w-full rounded-md border border-white/15 bg-background/70 px-3 text-sm"
              value={founderSlotsRemaining}
              onChange={(event) => {
                const next = Number(event.target.value);
                setFounderSlotsRemaining(Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0);
              }}
            />
          </label>

          <div className="flex items-end gap-2">
            <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
              Open Modal
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(true);
                setUpgradeCount(0);
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-muted-foreground backdrop-blur">
          <p>Upgrade button clicks in preview: {upgradeCount}</p>
        </div>
      </div>

      <UpgradeModal
        open={open}
        onOpenChange={setOpen}
        currentPlan={currentPlan}
        requiredPlan={requiredPlan}
        founderSlotsRemaining={founderSlotsRemaining}
        onUpgrade={() => setUpgradeCount((count) => count + 1)}
      />
    </div>
  );
};

export default DevUpgradeModalPreview;
