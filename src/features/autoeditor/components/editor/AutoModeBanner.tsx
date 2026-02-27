import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import type { AutoDetection, RenderMode } from "@/features/autoeditor/types";
import SubtleToggle from "@/features/autoeditor/components/primitives/SubtleToggle";

type AutoModeBannerProps = {
  autoDetection: AutoDetection;
  mode: RenderMode | null;
  autoModeEnabled: boolean;
  onAutoModeToggle: (value: boolean) => void;
  onModeChange: (value: RenderMode) => void;
};

const modeText = (value: RenderMode | null) => (value === "vertical" ? "Vertical" : "Horizontal");

const optimizationCopy = (value: RenderMode | null) =>
  value === "vertical" ? "Optimized for Shorts/Reels" : "Optimized for YouTube/Landscape";

export default function AutoModeBanner({
  autoDetection,
  mode,
  autoModeEnabled,
  onAutoModeToggle,
  onModeChange,
}: AutoModeBannerProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(26,31,46,0.76)_0%,rgba(15,17,23,0.72)_100%)] p-3.5 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.86),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium tracking-tight text-slate-100">
            <Sparkles className="h-4 w-4 text-blue-200" />
            Auto-Detected: {modeText(mode)} • {optimizationCopy(mode)} • Edit?
          </p>
          <p className="mt-1 text-xs text-slate-400">{autoDetection.bannerMessage || autoDetection.reason}</p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1">
          <button
            type="button"
            onClick={() => onModeChange("horizontal")}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              mode === "horizontal"
                ? "border-blue-300/40 bg-blue-400/18 text-blue-100 shadow-[0_10px_24px_-20px_rgba(96,165,250,0.9)]"
                : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5"
            }`}
          >
            Horizontal 16:9
          </button>
          <button
            type="button"
            onClick={() => onModeChange("vertical")}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              mode === "vertical"
                ? "border-blue-300/40 bg-blue-400/18 text-blue-100 shadow-[0_10px_24px_-20px_rgba(96,165,250,0.9)]"
                : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5"
            }`}
          >
            Vertical 9:16
          </button>
        </div>
      </div>

      <SubtleToggle
        className="mt-3"
        checked={autoModeEnabled}
        onCheckedChange={onAutoModeToggle}
        label="Auto-confirm mode"
        description="Keep detected mode locked until you switch to manual editing."
      />
    </motion.section>
  );
}
