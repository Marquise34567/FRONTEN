import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
  subtitle?: string;
};

type AccentPillToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: ToggleOption<T>[];
  className?: string;
};

export default function AccentPillToggle<T extends string>({
  value,
  onChange,
  options,
  className,
}: AccentPillToggleProps<T>) {
  return (
    <div className={cn("inline-flex rounded-full border border-white/10 bg-black/50 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative overflow-hidden rounded-full px-4 py-2 text-sm transition-colors",
              active ? "text-white" : "text-slate-300 hover:text-slate-100",
            )}
          >
            {active ? (
              <motion.span
                layoutId="accent-pill"
                className="absolute inset-0 rounded-full border border-purple-300/40 bg-gradient-to-r from-[#a855f7]/80 to-[#d946ef]/80 shadow-[0_0_22px_rgba(217,70,239,0.35)]"
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
            {option.subtitle ? <span className="relative z-10 ml-1 text-xs text-slate-200/70">{option.subtitle}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
