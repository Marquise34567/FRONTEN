import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PremiumCardProps = HTMLAttributes<HTMLDivElement> & {
  blur?: "none" | "sm" | "md";
};

export default function PremiumCard({ className, blur = "sm", children, ...props }: PremiumCardProps) {
  const blurClass = blur === "none" ? "" : blur === "md" ? "backdrop-blur-[24px]" : "backdrop-blur-[18px]";
  return (
    <div
      className={cn(
        "exclusive-glass exclusive-shadow rounded-3xl p-4",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:content-[''] before:[background:radial-gradient(120%_90%_at_0%_0%,rgba(212,175,55,0.1),transparent_56%)]",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] after:[background:linear-gradient(115deg,transparent_16%,rgba(255,255,255,0.08)_48%,transparent_84%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100",
        "relative overflow-hidden",
        blurClass,
        "supports-[backdrop-filter:blur(0)]:backdrop-blur-[var(--glass-blur)] hover:brightness-110",
        className,
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
