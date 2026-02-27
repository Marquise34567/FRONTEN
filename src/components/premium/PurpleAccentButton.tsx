import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PurpleAccentButtonProps = ButtonProps & {
  icon?: ReactNode;
};

export default function PurpleAccentButton({ className, icon, children, ...props }: PurpleAccentButtonProps) {
  const isAsChild = Boolean(props.asChild);
  return (
    <Button
      className={cn(
        "rounded-2xl border border-purple-300/30 bg-gradient-to-r from-[var(--accent-purple)] via-[#a855f7] to-[var(--accent-pink)] text-white shadow-[0_0_20px_rgba(192,132,252,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110",
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
