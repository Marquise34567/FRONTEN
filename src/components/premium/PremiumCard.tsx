import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PremiumCardProps = HTMLAttributes<HTMLDivElement> & {
  blur?: "none" | "sm" | "md";
};

export default function PremiumCard({ className, blur = "sm", children, ...props }: PremiumCardProps) {
  const blurClass = blur === "none" ? "" : blur === "md" ? "backdrop-blur-md" : "backdrop-blur-sm";
  return (
    <div
      className={cn(
        "rounded-3xl border border-[var(--ae-border)] bg-[color:var(--ae-surface)] p-4 shadow-[0_24px_54px_-32px_rgba(0,0,0,0.9)]",
        blurClass,
        "supports-[backdrop-filter:blur(0)]:backdrop-blur-[var(--glass-blur)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
