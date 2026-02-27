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
        "rounded-3xl border border-white/10 bg-black/60 p-4 shadow-2xl shadow-black/35",
        blurClass,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
