import type { ReactNode } from "react";

import PremiumCard from "@/components/premium/PremiumCard";
import VIPBadge from "@/components/premium/VIPBadge";
import { cn } from "@/lib/utils";

type SettingsCardGroupProps = {
  title: string;
  description?: string;
  rightSlot?: ReactNode;
  badgeLabel?: string;
  children: ReactNode;
  className?: string;
};

export default function SettingsCardGroup({
  title,
  description,
  rightSlot,
  badgeLabel,
  children,
  className,
}: SettingsCardGroupProps) {
  return (
    <PremiumCard className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            {badgeLabel ? <VIPBadge label={badgeLabel} /> : null}
          </div>
          {description ? <p className="mt-1 text-sm text-slate-300">{description}</p> : null}
        </div>
        {rightSlot}
      </div>
      {children}
    </PremiumCard>
  );
}
