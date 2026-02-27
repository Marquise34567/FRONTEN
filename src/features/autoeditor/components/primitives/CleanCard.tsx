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
        "group relative overflow-hidden rounded-2xl border border-white/10",
        "bg-[linear-gradient(180deg,rgba(26,31,46,0.78)_0%,rgba(15,17,23,0.78)_100%)] backdrop-blur-[10px]",
        "shadow-[0_24px_58px_-34px_rgba(2,6,23,0.94),0_8px_18px_-14px_rgba(15,23,42,0.86),inset_0_1px_0_rgba(255,255,255,0.05)]",
        padded && "p-4 sm:p-5",
        hoverable &&
          "transition-all duration-300 ease-out hover:scale-[1.02] hover:border-white/15 hover:shadow-[0_30px_64px_-40px_rgba(96,165,250,0.46)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/10 via-white/0 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-6 h-40 w-40 rounded-full bg-blue-300/8 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
