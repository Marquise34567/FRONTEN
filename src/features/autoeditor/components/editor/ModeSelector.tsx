import { motion } from "framer-motion";

import { MODE_OPTIONS } from "@/features/autoeditor/data/options";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import type { RenderMode } from "@/features/autoeditor/types";

type ModeSelectorProps = {
  mode: RenderMode | null;
  modeConfirmed: boolean;
  autoModeEnabled: boolean;
  onSelectMode: (mode: RenderMode) => void;
};

export default function ModeSelector({ mode, modeConfirmed, autoModeEnabled, onSelectMode }: ModeSelectorProps) {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <CleanCard>
        <div className="mb-3 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mode Selection</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Choose Edit Layout</h3>
          <p className="mt-1 text-sm text-slate-400">
            {autoModeEnabled
              ? "Auto-confirm is enabled. You can still override mode below."
              : modeConfirmed
              ? "Manual mode selected. Settings are now unlocked."
              : "Pick a mode to reveal the editing pipeline."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 250, damping: 20 }}
                onClick={() => onSelectMode(option.value)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-blue-300/40 bg-blue-500/12 shadow-[0_20px_40px_-28px_rgba(59,130,246,0.75)]"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/35"
                }`}
              >
                <div className="flex items-center justify-between">
                  <option.icon className={`h-5 w-5 ${active ? "text-blue-200" : "text-slate-400"}`} />
                  <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-xs text-slate-300">
                    {option.ratio}
                  </span>
                </div>
                <p className="mt-3 text-lg font-medium tracking-tight text-slate-100">{option.label}</p>
                <p className="text-sm text-slate-400">{option.description}</p>
              </motion.button>
            );
          })}
        </div>
      </CleanCard>
    </section>
  );
}
