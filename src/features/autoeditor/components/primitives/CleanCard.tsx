import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CleanCardProps = HTMLAttributes<HTMLDivElement> & {
  hoverable?: boolean;
  padded?: boolean;
};

export default function CleanCard({
  className,
  hoverable = false,
  padded = true,
  children,
  ...props
}: CleanCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.4rem] border border-[rgba(255,255,255,0.14)]",
        "exclusive-glass backdrop-blur-[20px]",
        "shadow-[0_34px_64px_-44px_rgba(0,0,0,0.9),0_14px_24px_-18px_rgba(0,0,0,0.74),inset_0_1px_0_rgba(255,255,255,0.1)]",
        padded && "p-4 sm:p-5",
        hoverable &&
          "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[rgba(52,240,208,0.45)] hover:shadow-[0_42px_72px_-48px_rgba(52,240,208,0.35)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/20 via-white/0 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 right-6 h-44 w-44 rounded-full bg-[#d4b483]/12 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

