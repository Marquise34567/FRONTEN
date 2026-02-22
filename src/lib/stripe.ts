import type { PlanTier } from "@shared/planConfig";

type BillingInterval = "monthly" | "annual";

const env = import.meta.env;

export const getPriceIdForTier = (tier: PlanTier, interval: BillingInterval = "monthly") => {
  const map: Record<BillingInterval, Record<Exclude<PlanTier, "free">, string | undefined>> = {
    monthly: {
      starter: env.VITE_STRIPE_PRICE_ID_STARTER,
      creator: env.VITE_STRIPE_PRICE_ID_CREATOR,
      studio: env.VITE_STRIPE_PRICE_ID_STUDIO,
    },
    annual: {
      starter: env.VITE_STRIPE_PRICE_ID_STARTER_ANNUAL,
      creator: env.VITE_STRIPE_PRICE_ID_CREATOR_ANNUAL,
      studio: env.VITE_STRIPE_PRICE_ID_STUDIO_ANNUAL,
    },
  };
  if (tier === "free") return "";
  return map[interval]?.[tier] ?? "";
};
