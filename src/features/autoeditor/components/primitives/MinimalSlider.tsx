import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type MinimalSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
};

export default function MinimalSlider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  leftLabel,
  rightLabel,
  className,
}: MinimalSliderProps) {
  const normalizedValue = Math.max(min, Math.min(max, value));

  return (
    <div className={cn("space-y-2", className)}>
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-slate-400">
          <span>{leftLabel}</span>
          <span className="inline-flex items-center gap-2">
            <span
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-medium tracking-[0.12em] text-slate-300"
              aria-label={`Current value ${normalizedValue}`}
            >
              {normalizedValue}
            </span>
            {rightLabel}
          </span>
        </div>
      )}
      <div className="ae-slider-shell rounded-2xl border border-white/10 bg-[#111623]/68 px-3 py-3">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[normalizedValue]}
          onValueChange={(values) => onValueChange(Math.round(Number(values[0] ?? normalizedValue)))}
          className="editor-settings-slider"
        />
      </div>
    </div>
  );
}
