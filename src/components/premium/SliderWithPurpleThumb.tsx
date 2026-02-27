import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type SliderWithPurpleThumbProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  helper?: string;
  className?: string;
};

export default function SliderWithPurpleThumb({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  helper,
  className,
}: SliderWithPurpleThumbProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {(label || helper) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-200">{label}</span>
          <span className="text-slate-400">{helper}</span>
        </div>
      )}
      <div className="rounded-2xl border border-white/10 bg-black/50 px-3 py-3">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(values) => onChange(Number(values?.[0] ?? value))}
          className="editor-settings-slider"
        />
      </div>
    </div>
  );
}
