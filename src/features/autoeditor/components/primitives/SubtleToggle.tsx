import { motion } from "framer-motion";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SubtleToggleProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  description?: string;
  className?: string;
};

export default function SubtleToggle({
  checked,
  onCheckedChange,
  label,
  description,
  className,
}: SubtleToggleProps) {
  return (
    <motion.div
      layout
      initial={false}
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-3.5 py-3",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium tracking-tight text-slate-100">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] transition",
            checked
              ? "border-blue-300/35 bg-blue-400/15 text-blue-100"
              : "border-white/10 bg-white/5 text-slate-400",
          )}
        >
          {checked ? "On" : "Off"}
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </motion.div>
  );
}
