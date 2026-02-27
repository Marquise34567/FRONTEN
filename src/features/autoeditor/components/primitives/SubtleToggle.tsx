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
        "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1f2e]/45 px-3 py-2.5",
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium text-slate-100">{label}</p>
        {description ? <p className="text-xs text-slate-400">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </motion.div>
  );
}
