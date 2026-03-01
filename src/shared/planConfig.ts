export type PlanTier = "free" | "starter" | "creator" | "studio" | "founder";
export type ExportQuality = "720p" | "1080p" | "4k";

export const PLAN_TIERS: PlanTier[] = ["free", "starter", "creator", "studio", "founder"];
export const QUALITY_ORDER: ExportQuality[] = ["720p", "1080p", "4k"];

export type PlanConfig = {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  description: string;
  maxRendersPerMonth: number;
  maxMinutesPerMonth: number | null;
  exportQuality: ExportQuality;
  watermark: boolean;
  priority: boolean;
  allowedSubtitlePresets: string[] | "ALL";
  autoZoomMax: number;
  advancedEffects: boolean;
  lifetime: boolean;
  includesFutureFeatures: boolean;
  badge?: "popular" | "founder" | null;
  features: string[];
};

export const PLAN_CONFIG: Record<PlanTier, PlanConfig> = {
  founder: {
    tier: "founder",
    name: "Founder",
    priceMonthly: 149,
    priceLabel: "$149",
    description: "Lifetime access for early builders who want the full stack unlocked.",
    maxRendersPerMonth: 500,
    maxMinutesPerMonth: null,
    exportQuality: "4k",
    watermark: false,
    priority: true,
    allowedSubtitlePresets: "ALL",
    autoZoomMax: 1.15,
    advancedEffects: true,
    lifetime: true,
    includesFutureFeatures: true,
    badge: "founder",
    features: [
      "One-time payment, lifetime plan access",
      "Up to 500 renders every month",
      "4K export quality",
      "All subtitle presets unlocked",
      "Auto zoom control up to 1.15x",
      "Priority processing queue",
      "Advanced effects unlocked",
      "Founder badge and early supporter status",
      "Future feature drops included",
      "Founder price locked forever",
    ],
  },
  free: {
    tier: "free",
    name: "Free",
    priceMonthly: 0,
    priceLabel: "$0",
    description: "Best for testing AutoEditor before upgrading.",
    maxRendersPerMonth: 12,
    maxMinutesPerMonth: null,
    exportQuality: "720p",
    watermark: true,
    priority: false,
    allowedSubtitlePresets: ["basic_clean"],
    autoZoomMax: 1.1,
    advancedEffects: false,
    lifetime: false,
    includesFutureFeatures: false,
    badge: null,
    features: [
      "Up to 12 renders per month",
      "Exports up to 720p resolution",
      "Watermark on final exports",
      "Standard queue speed",
      "1 subtitle preset (Basic Clean)",
      "Auto zoom up to 1.10x",
    ],
  },
  starter: {
    tier: "starter",
    name: "Starter",
    priceMonthly: 9,
    priceLabel: "$9",
    description: "For solo creators publishing consistently each week.",
    maxRendersPerMonth: 20,
    maxMinutesPerMonth: null,
    exportQuality: "1080p",
    watermark: false,
    priority: false,
    allowedSubtitlePresets: ["basic_clean", "bold_pop", "caption_box"],
    autoZoomMax: 1.12,
    advancedEffects: false,
    lifetime: false,
    includesFutureFeatures: false,
    badge: null,
    features: [
      "Up to 20 renders per month",
      "Exports up to 1080p Full HD",
      "No watermark on exports",
      "3 subtitle presets included",
      "Auto zoom up to 1.12x",
      "Standard queue speed",
    ],
  },
  creator: {
    tier: "creator",
    name: "Creator",
    priceMonthly: 29,
    priceLabel: "$29",
    description: "For high-volume creators who need better output headroom.",
    maxRendersPerMonth: 100,
    maxMinutesPerMonth: null,
    exportQuality: "4k",
    watermark: false,
    priority: false,
    allowedSubtitlePresets: "ALL",
    autoZoomMax: 1.15,
    advancedEffects: false,
    lifetime: false,
    includesFutureFeatures: false,
    badge: "popular",
    features: [
      "Up to 100 renders per month",
      "Exports up to 4K resolution",
      "No watermark on exports",
      "All subtitle presets unlocked",
      "Karaoke subtitle highlight support",
      "Auto zoom up to 1.15x",
      "Best for weekly multi-platform publishing",
    ],
  },
  studio: {
    tier: "studio",
    name: "Studio",
    priceMonthly: 99,
    priceLabel: "$99",
    description: "For teams and studios that need speed, scale, and advanced controls.",
    maxRendersPerMonth: 5000,
    maxMinutesPerMonth: null,
    exportQuality: "4k",
    watermark: false,
    priority: true,
    allowedSubtitlePresets: "ALL",
    autoZoomMax: 1.15,
    advancedEffects: true,
    lifetime: false,
    includesFutureFeatures: false,
    badge: null,
    features: [
      "Up to 5,000 renders per month",
      "Exports up to 4K resolution",
      "Priority processing queue",
      "All subtitle presets unlocked",
      "Auto zoom control up to 1.15x",
      "Advanced effects (Emotional Boost + Aggressive Mode)",
      "Built for agency and studio throughput",
    ],
  },
};

export const isPaidTier = (tier: PlanTier) => tier !== "free";

export const normalizeQuality = (value?: string): ExportQuality => {
  const raw = (value || "").toLowerCase();
  if (raw.includes("4k") || raw.includes("2160") || raw.includes("uhd") || raw.includes("high"))
    return "4k";
  if (raw.includes("1080") || raw.includes("full") || raw.includes("medium")) return "1080p";
  if (raw.includes("720") || raw.includes("hd") || raw.includes("low")) return "720p";
  return "720p";
};

export const clampQualityForTier = (quality: ExportQuality, tier: PlanTier): ExportQuality => {
  const maxQuality = PLAN_CONFIG[tier]?.exportQuality || "720p";
  const qualityIndex = QUALITY_ORDER.indexOf(quality);
  const maxIndex = QUALITY_ORDER.indexOf(maxQuality);
  if (qualityIndex === -1) return maxQuality;
  return qualityIndex <= maxIndex ? quality : maxQuality;
};

export const qualityToHeight = (quality: ExportQuality) => {
  if (quality === "4k") return 2160;
  if (quality === "1080p") return 1080;
  return 720;
};

export type PlanFeatures = {
  resolution: "720p" | "1080p" | "4K";
  watermark: boolean;
  subtitleAccess: "all" | "limited" | "none";
  subtitles: {
    enabled: boolean;
    allowedPresets: string[] | "ALL";
  };
  autoZoomMax: number;
  queuePriority: "standard" | "priority";
  rendersPerMonth: number;
  lifetime: boolean;
  includesFutureFeatures: boolean;
};

export const getPlanFeatures = (plan: PlanConfig): PlanFeatures => {
  const resolution = plan.exportQuality === "4k" ? "4K" : plan.exportQuality;
  const allowedPresets = plan.allowedSubtitlePresets;
  const subtitlesEnabled = allowedPresets === "ALL" ? true : allowedPresets.length > 0;
  const subtitleAccess = allowedPresets === "ALL" ? "all" : subtitlesEnabled ? "limited" : "none";
  return {
    resolution,
    watermark: plan.watermark,
    subtitleAccess,
    subtitles: {
      enabled: subtitlesEnabled,
      allowedPresets,
    },
    autoZoomMax: plan.autoZoomMax,
    queuePriority: plan.priority ? "priority" : "standard",
    rendersPerMonth: plan.maxRendersPerMonth,
    lifetime: plan.lifetime,
    includesFutureFeatures: plan.includesFutureFeatures,
  };
};

export const getMonthKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};
