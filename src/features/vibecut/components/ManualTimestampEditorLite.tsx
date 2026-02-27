import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Segment } from "@/features/vibecut/types";

type ManualTimestampEditorLiteProps = {
  duration: number;
  scrubberTime: number;
  segments: Segment[];
  onScrub: (value: number) => void;
  onAddSegment: () => void;
  onRemoveSegment: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  className?: string;
};

const formatSeconds = (value: number) => {
  const safe = Math.max(0, value || 0);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  const millis = Math.floor((safe % 1) * 10)
    .toString()
    .padStart(1, "0");
  return `${minutes}:${seconds}.${millis}`;
};

export default function ManualTimestampEditorLite({
  duration,
  scrubberTime,
  segments,
  onScrub,
  onAddSegment,
  onRemoveSegment,
  onUpdateSegment,
  className,
}: ManualTimestampEditorLiteProps) {
  const safeDuration = Math.max(0, duration || 0);

  return (
    <section className={cn("rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 md:p-5", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Manual Timestamp Editor</h3>
        <span className="text-xs text-slate-400">Timeline scrubber + segment controls</span>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Current: {formatSeconds(scrubberTime)}</span>
          <span>Duration: {formatSeconds(safeDuration)}</span>
        </div>
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700/70 accent-cyan-400"
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={Math.max(0, Math.min(scrubberTime, safeDuration || 1))}
          onChange={(event) => onScrub(Number(event.currentTarget.value))}
        />
        <div className="flex gap-2">
          <Button className="h-10 flex-1 bg-cyan-500 text-slate-900 hover:bg-cyan-400" onClick={onAddSegment} type="button">
            Add Segment
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {segments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 px-3 py-5 text-center text-xs text-slate-500">
            No manual segments yet. Scrub and tap Add Segment.
          </p>
        ) : (
          segments.map((segment, index) => (
            <div
              key={segment.id}
              className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/70 px-2 py-2"
            >
              <span className="text-[11px] font-medium text-slate-400">#{index + 1}</span>
              <Input
                type="number"
                className="h-9 border-slate-700 bg-slate-950/70 text-xs"
                min={0}
                max={safeDuration || undefined}
                step={0.1}
                value={Number(segment.start.toFixed(1))}
                onChange={(event) => onUpdateSegment(segment.id, { start: Number(event.currentTarget.value) })}
              />
              <Input
                type="number"
                className="h-9 border-slate-700 bg-slate-950/70 text-xs"
                min={0}
                max={safeDuration || undefined}
                step={0.1}
                value={Number(segment.end.toFixed(1))}
                onChange={(event) => onUpdateSegment(segment.id, { end: Number(event.currentTarget.value) })}
              />
              <Button
                variant="ghost"
                className="h-9 px-2 text-xs text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
                onClick={() => onRemoveSegment(segment.id)}
                type="button"
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
