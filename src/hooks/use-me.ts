import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export type MeResponse = {
  user: { id: string; email: string; createdAt: string };
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  flags?: {
    dev?: boolean;
  };
  usage: { month: string; rendersUsed: number; minutesUsed: number };
  usageByMode?: {
    month: string;
    standardRendersUsed: number;
    verticalRendersUsed: number;
  } | null;
  usageDaily?: { day: string; rendersUsed: number; rendersLimit: number } | null;
  limits: {
    maxRendersPerMonth: number | null;
    maxRendersPerDay?: number | null;
    maxVerticalRendersPerMonth?: number | null;
    maxMinutesPerMonth: number | null;
    exportQuality: string;
    watermark: boolean;
    priority: boolean;
  };
};

type UseMeOptions = {
  refetchInterval?: number | false;
};

export const useMe = (options?: UseMeOptions) => {
  const { accessToken, user } = useAuth();
  return useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => apiFetch<MeResponse>("/api/me", { token: accessToken || "" }),
    enabled: !!accessToken,
    refetchInterval: options?.refetchInterval,
  });
};
