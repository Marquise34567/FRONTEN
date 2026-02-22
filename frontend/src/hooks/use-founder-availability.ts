import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type FounderAvailability = {
  maxPurchases: number;
  purchasedCount: number;
  remaining: number;
  soldOut: boolean;
};

export const useFounderAvailability = () => {
  return useQuery({
    queryKey: ["founder-availability"],
    queryFn: () => apiFetch<FounderAvailability>("/api/public/founder"),
    staleTime: 60_000,
  });
};
