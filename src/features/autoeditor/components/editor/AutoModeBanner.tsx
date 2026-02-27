import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import type { AutoDetection, RenderMode } from "@/features/autoeditor/types";
import SubtleToggle from "@/features/autoeditor/components/primitives/SubtleToggle";

type AutoModeBannerProps = {
  autoDetection: AutoDetection;
  mode: RenderMode | null;
  autoModeEnabled: boolean;
  onAutoModeToggle: (value: boolean) => void;
};

const modeText = (value: RenderMode | null) =>
  value === "ai" ? "AI Director" : value === "vertical" ? "Vertical" : "Horizontal";

const optimizationCopy = (value: RenderMode | null) =>
  value === "ai"
    ? "Auto hook + cut decisions"
    : value === "vertical"
      ? "High retention potential"
      : "Long-form narrative potential";

export default function AutoModeBanner({
  autoDetection,
  mode,
  autoModeEnabled,
  onAutoModeToggle,
}: AutoModeBannerProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="rounded-3xl border border-[rgba(52,240,208,0.3)] bg-[linear-gradient(150deg,rgba(52,240,208,0.14)_0%,rgba(12,14,24,0.9)_48%,rgba(8,10,18,0.92)_100%)] p-3.5 shadow-[0_28px_56px_-38px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium tracking-tight text-slate-100">
            <Sparkles className="h-4 w-4 text-[var(--gold-accent)]" />
            Auto-detected: {modeText(mode)} • {optimizationCopy(mode)}
          </p>
          <p className="mt-1 text-xs text-slate-300">{autoDetection.bannerMessage || autoDetection.reason}</p>
        </div>

        <span className="rounded-full border border-[rgba(52,240,208,0.4)] bg-[rgba(52,240,208,0.14)] px-3 py-1 text-xs text-[#95fff2]">
          Edit?
        </span>
      </div>

      {autoDetection.coolStats?.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {autoDetection.coolStats.slice(0, 3).map((stat) => (
            <div key={stat.id} className="rounded-2xl border border-[rgba(52,240,208,0.22)] bg-black/35 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      <SubtleToggle
        className="mt-3"
        checked={autoModeEnabled}
        onCheckedChange={onAutoModeToggle}
        label="Auto-apply detected mode"
        description="Detected orientation is applied on upload; you can still switch mode manually anytime."
      />
    </motion.section>
  );
}

