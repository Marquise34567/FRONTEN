import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CleanCardProps = HTMLAttributes<HTMLDivElement> & {
  hoverable?: boolean;
  padded?: boolean;
};

export default function CleanCard({ className, hoverable = false, padded = true, ...props }: CleanCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md",
        "shadow-[0_20px_50px_-30px_rgba(15,23,42,0.75),inset_0_1px_0_rgba(255,255,255,0.05)]",
        padded && "p-4 sm:p-5",
        hoverable &&
          "transition-all duration-300 ease-out hover:scale-[1.02] hover:border-white/15 hover:shadow-[0_26px_58px_-36px_rgba(59,130,246,0.4)]",
        className,
      )}
      {...props}
    />
  );
}
