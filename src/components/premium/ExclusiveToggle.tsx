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
        "border-white/24 bg-[#0b0f14]/90",
        "data-[state=checked]:border-[rgba(52,240,208,0.62)]",
        "data-[state=checked]:bg-[linear-gradient(128deg,#2fe4c8_0%,#2ab0ff_62%,#b477ff_100%)]",
        className,
      )}
      {...props}
    />
  );

  if (!label && !description) return control;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/14 bg-[rgba(255,255,255,0.03)] px-3 py-2.5",
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

