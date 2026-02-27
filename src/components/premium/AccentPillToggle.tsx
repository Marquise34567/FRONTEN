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
    <div className={cn("inline-flex rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(8,8,12,0.72)] p-1", className)}>
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
                className="absolute inset-0 rounded-full border border-[rgba(212,175,55,0.52)] bg-[linear-gradient(120deg,rgba(212,175,55,0.82),rgba(192,132,252,0.78))] shadow-[0_0_22px_rgba(212,175,55,0.28)]"
                transition={{ type: "spring", stiffness: 180, damping: 22 }}
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
