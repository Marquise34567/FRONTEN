import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import type { ExportQuality, PlanTier } from "@shared/planConfig";

export type SubscriptionFeatures = {
  resolution: "720p" | "1080p" | "4K";
  maxResolution: ExportQuality;
  rendersPerMonth: number;
  maxRendersPerMonth: number;
  watermark: boolean;
  queuePriority: "priority" | "standard";
  priorityQueue: boolean;
  subtitleAccess: "all" | "limited" | "none";
  subtitles: {
    enabled: boolean;
    allowedPresets: string[] | "ALL";
  };
  autoZoomMax: number;
  advancedEffects: boolean;
  lifetime: boolean;
  includesFutureFeatures: boolean;
};

export type SubtitlePresetDefinition = {
  id: string;
  label: string;
  description: string;
};

export type SubscriptionResponse = {
  plan: PlanTier | string;
  status: string;
  currentPeriodEnd: string | null;
  features: SubscriptionFeatures;
  subtitlePresets?: SubtitlePresetDefinition[];
};

const defaultFeatures: SubscriptionFeatures = {
  resolution: "720p",
  maxResolution: "720p",
  rendersPerMonth: 10,
  maxRendersPerMonth: 10,
  watermark: true,
  queuePriority: "standard",
  priorityQueue: false,
  subtitleAccess: "limited",
  subtitles: {
    enabled: true,
    allowedPresets: ["basic_clean"],
  },
  autoZoomMax: 1.1,
  advancedEffects: false,
  lifetime: false,
  includesFutureFeatures: false,
};

export const useSubscription = () => {
  const { accessToken, user } = useAuth();
  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: () => apiFetch<SubscriptionResponse>("/api/me/subscription", { token: accessToken || "" }),
    enabled: !!accessToken,
    refetchInterval: 15000,
  });

  const rawPlan = query.data?.plan;
  const safePlan = rawPlan && ["free", "starter", "creator", "studio", "founder"].includes(rawPlan)
    ? (rawPlan as PlanTier)
    : "free";

  return {
    plan: safePlan,
    features: query.data?.features ?? defaultFeatures,
    status: query.data?.status ?? "free",
    subtitlePresets: query.data?.subtitlePresets ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
};
