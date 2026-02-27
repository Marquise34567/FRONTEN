import type { ReactNode } from "react";

import PremiumCard from "@/components/premium/PremiumCard";
import { cn } from "@/lib/utils";

type SettingsCardGroupProps = {
  title: string;
  description?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SettingsCardGroup({
  title,
  description,
  rightSlot,
  children,
  className,
}: SettingsCardGroupProps) {
  return (
    <PremiumCard className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
        {rightSlot}
      </div>
      {children}
    </PremiumCard>
  );
}
