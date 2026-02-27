import type { ComponentPropsWithoutRef } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ExclusiveToggleProps = ComponentPropsWithoutRef<typeof Switch> & {
  label?: string;
  description?: string;
  className?: string;
  wrapperClassName?: string;
};

export default function ExclusiveToggle({
  label,
  description,
  className,
  wrapperClassName,
  ...props
}: ExclusiveToggleProps) {
  const control = (
    <Switch
      className={cn(
        "border-[rgba(255,255,255,0.24)] bg-[#0b0b11]/90",
        "data-[state=checked]:border-[rgba(212,175,55,0.62)]",
        "data-[state=checked]:bg-[linear-gradient(128deg,#f6da8a_0%,#d4af37_32%,#c084fc_72%,#a855f7_100%)]",
        className,
      )}
      {...props}
    />
  );

  if (!label && !description) return control;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(12,12,19,0.72)] px-3 py-2.5",
        wrapperClassName,
      )}
    >
      <div>
        {label ? <p className="text-sm font-medium text-[var(--ae-text-primary)]">{label}</p> : null}
        {description ? <p className="text-xs text-[var(--ae-text-secondary)]">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}
