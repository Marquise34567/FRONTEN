import { PLAN_TIERS, type PlanTier } from "../shared/planConfig";

export const DIRECTOR_NOTES_REQUIRED_PLAN: PlanTier = "creator";
export const DIRECTOR_NOTES_MAX_LENGTH = 600;

export const hasPlanTierAccess = (tier: PlanTier, requiredPlan: PlanTier) => (
  PLAN_TIERS.indexOf(tier) >= PLAN_TIERS.indexOf(requiredPlan)
);

export const normalizeDirectorNotesPrompt = (value: string) => {
  const normalized = String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  return normalized.slice(0, DIRECTOR_NOTES_MAX_LENGTH);
};

export const appendDirectorNotesTemplate = (currentValue: string, template: string) => {
  const base = normalizeDirectorNotesPrompt(currentValue);
  const addition = normalizeDirectorNotesPrompt(template);
  if (!addition) return base;
  if (!base) return addition;
  return normalizeDirectorNotesPrompt(`${base}\n${addition}`);
};
