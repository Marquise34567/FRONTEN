import { motion } from "framer-motion";
import { ScissorsLineDashed, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QUICK_CONTROL_CONFIG } from "@/features/autoeditor/data/options";
import CleanCard from "@/features/autoeditor/components/primitives/CleanCard";
import ElegantTooltip from "@/features/autoeditor/components/primitives/ElegantTooltip";
import type { QuickControlKey, RenderMode } from "@/features/autoeditor/types";

type InitialSettingsPanelProps = {
  mode: RenderMode | null;
  quickControls: Record<QuickControlKey, boolean>;
  onToggleQuickControl: (key: QuickControlKey) => void;
  onOpenManualTimestamp: () => void;
};

export default function InitialSettingsPanel({
  mode,
  quickControls,
  onToggleQuickControl,
  onOpenManualTimestamp,
}: InitialSettingsPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="mx-auto w-full max-w-4xl"
    >
      <CleanCard className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Initial Editor Settings</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Quick Controls</h2>
          </div>
          {mode === "vertical" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
              <WandSparkles className="h-3.5 w-3.5" />
              Highlight Mode default: 3 best moments, 15-30s, first-3s hook
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/35 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:grid-cols-4">
          {QUICK_CONTROL_CONFIG.map((control) => {
            const active = quickControls[control.key];
            return (
              <ElegantTooltip key={control.key} content={control.description}>
                <button
                  type="button"
                  onClick={() => onToggleQuickControl(control.key)}
                  className={`group rounded-xl border px-3 py-3 text-left transition-all duration-300 ${
                    active
                      ? "border-blue-300/35 bg-blue-500/16 text-slate-100 shadow-[0_16px_36px_-24px_rgba(96,165,250,0.68)]"
                      : "border-transparent bg-black/25 text-slate-300 hover:border-white/15 hover:bg-black/45"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <control.icon className={`h-4 w-4 ${active ? "text-blue-200" : "text-slate-500"}`} />
                    <span
                      className={`h-0.5 w-8 rounded-full transition ${
                        active ? "bg-blue-300/80" : "bg-transparent group-hover:bg-white/20"
                      }`}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium tracking-tight">{control.title}</p>
                </button>
              </ElegantTooltip>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Manual control available for frame-accurate segment timing.</p>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenManualTimestamp}
            className="rounded-xl border-white/15 bg-white/[0.08] px-5 text-slate-100 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.82)] transition-all hover:-translate-y-0.5 hover:bg-white/[0.14]"
          >
            <ScissorsLineDashed className="h-4 w-4" />
            Manual Timestamp Editor
          </Button>
        </div>
      </CleanCard>
    </motion.section>
  );
}
