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

const modeText = (value: RenderMode | null) => (value === "vertical" ? "Vertical" : "Horizontal");

const optimizationCopy = (value: RenderMode | null) =>
  value === "vertical" ? "Optimized for Shorts/Reels" : "Optimized for YouTube/Landscape";

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
      className="rounded-2xl border border-white/15 bg-[linear-gradient(150deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_48%,rgba(255,255,255,0.03)_100%)] p-3.5 shadow-[0_28px_56px_-38px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium tracking-tight text-[#f8efe0]">
            <Sparkles className="h-4 w-4 text-[#e4c48f]" />
            Auto-detected: {modeText(mode)} • {optimizationCopy(mode)}
          </p>
          <p className="mt-1 text-xs text-[#bcaeb0]">{autoDetection.bannerMessage || autoDetection.reason}</p>
        </div>

        <span className="rounded-full border border-white/15 bg-[#111319]/80 px-3 py-1 text-xs text-[#cec4c8]">
          Edit mode: {modeText(mode)}
        </span>
      </div>

      <SubtleToggle
        className="mt-3"
        checked={autoModeEnabled}
        onCheckedChange={onAutoModeToggle}
        label="Auto-apply detected mode"
        description="Preselect detected orientation while keeping manual confirmation in your control."
      />
    </motion.section>
  );
}
