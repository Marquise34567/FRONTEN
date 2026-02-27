import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoldAccentButtonProps = ButtonProps & {
  icon?: ReactNode;
};

export default function GoldAccentButton({ className, icon, children, ...props }: GoldAccentButtonProps) {
  const isAsChild = Boolean(props.asChild);

  return (
    <Button
      className={cn(
        "premium-duotone-action rounded-full border border-[rgba(52,240,208,0.42)] text-[#eafffb]",
        "hover:-translate-y-0.5 hover:brightness-105",
        "focus-visible:ring-[rgba(52,240,208,0.55)]",
        className,
      )}
      {...props}
    >
      {isAsChild ? children : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}

