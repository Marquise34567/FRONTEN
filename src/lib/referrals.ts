export const PENDING_REFERRAL_CODE_KEY = "aep_pending_referral_code";

export const normalizeReferralCode = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const parseReferralCode = (value: unknown): string | null => {
  const normalized = normalizeReferralCode(value);
  if (!normalized) return null;
  if (normalized.length < 6 || normalized.length > 16) return null;
  return normalized;
};
