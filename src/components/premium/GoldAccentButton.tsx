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
        "premium-duotone-action rounded-2xl border border-[rgba(212,175,55,0.42)] text-[#fff8ea]",
        "hover:-translate-y-0.5 hover:brightness-110",
        "focus-visible:ring-[rgba(212,175,55,0.55)]",
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
