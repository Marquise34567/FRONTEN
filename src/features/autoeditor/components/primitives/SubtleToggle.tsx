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
        "flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[rgba(9,9,14,0.72)] px-3.5 py-3",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium tracking-tight text-[#f5efe5]">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-[#b8aeb0]">{description}</p> : null}
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] transition",
            checked
              ? "border-[rgba(212,175,55,0.48)] bg-[rgba(212,175,55,0.14)] text-[#fff4e4]"
              : "border-white/15 bg-white/5 text-[#b9b1b2]",
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
