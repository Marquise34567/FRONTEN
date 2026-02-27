import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";

type VIPBadgeProps = {
  label?: string;
  className?: string;
};

export default function VIPBadge({ label = "Exclusive Feature", className }: VIPBadgeProps) {
  return (
    <span className={cn("vip-badge", className)}>
      <Crown className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
