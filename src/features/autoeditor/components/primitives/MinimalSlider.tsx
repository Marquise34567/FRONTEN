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
  return (
    <div className={cn("space-y-2", className)}>
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-slate-400">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
      <div className="ae-slider-shell rounded-xl border border-white/10 bg-[#111623]/70 px-3 py-3">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onValueChange(Math.round(Number(values[0] ?? value)))}
          className="editor-settings-slider"
        />
      </div>
    </div>
  );
}
