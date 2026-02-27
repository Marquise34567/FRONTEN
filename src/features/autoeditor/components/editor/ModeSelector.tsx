import { motion } from "framer-motion";

import { MODE_OPTIONS } from "@/features/autoeditor/data/options";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import type { RenderMode } from "@/features/autoeditor/types";

type ModeSelectorProps = {
  mode: RenderMode | null;
  autoModeEnabled: boolean;
  onSelectMode: (mode: RenderMode) => void;
};

export default function ModeSelector({ mode, autoModeEnabled, onSelectMode }: ModeSelectorProps) {
  return (
    <section className="mx-auto w-full max-w-[960px]">
      <CleanCard>
        <div className="mb-4 text-center">
          <p className="ae-kicker">Mode Selection</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#f8efe3]">Choose Edit Layout</h3>
            <p className="mt-1 text-sm text-[#baafb1]">
              {autoModeEnabled
                ? "Detected mode is preselected. Confirm AI/Horizontal/Vertical to unlock Format & Platform."
                : "Pick AI, Horizontal, or Vertical to reveal the editing pipeline."}
            </p>
          </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 230, damping: 22 }}
                onClick={() => onSelectMode(option.value)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-[#e6cfa9]/45 bg-[#d4b483]/16 shadow-[0_18px_40px_-28px_rgba(212,180,131,0.64)]"
                    : "border-white/15 bg-black/24 hover:border-white/25 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <option.icon className={`h-5 w-5 ${active ? "text-[#f4d7a6]" : "text-[#a29a9e]"}`} />
                  <span className="rounded-full border border-white/15 bg-black/25 px-2.5 py-0.5 text-xs text-[#d6cbce]">
                    {option.ratio}
                  </span>
                </div>
                <p className="mt-3 text-lg font-medium tracking-tight text-[#f5eee1]">{option.label}</p>
                <p className="text-sm text-[#b8adb0]">{option.description}</p>
              </motion.button>
            );
          })}
        </div>
      </CleanCard>
    </section>
  );
}
