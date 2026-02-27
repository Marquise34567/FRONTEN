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
        "rounded-2xl border border-purple-300/30 bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white shadow-lg shadow-fuchsia-900/30 transition-all hover:-translate-y-0.5 hover:from-[#9333ea] hover:to-[#c026d3]",
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
