import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RetentionHeatCell, RetentionPoint } from "@/features/vibecut/types";

const POINT_COLORS: Record<RetentionPoint["type"], string> = {
  best: "#22c55e",
  worst: "#ef4444",
  skip_zone: "#f59e0b",
  hook: "#3b82f6",
  emotional_peak: "#a855f7",
};

type RetentionGraphInteractiveProps = {
  points: RetentionPoint[];
  heatmap: RetentionHeatCell[];
  selectedPointId: string | null;
  onSelectPoint: (point: RetentionPoint) => void;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function RetentionGraphInteractive({
  points,
  heatmap,
  selectedPointId,
  onSelectPoint,
  className,
}: RetentionGraphInteractiveProps) {
  const width = 680;
  const height = 280;
  const padding = { left: 28, right: 20, top: 16, bottom: 32 };
  const maxTime = Math.max(1, ...points.map((point) => point.timestamp));

  const positioned = points
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => {
      const x =
        padding.left +
        clamp(point.timestamp / maxTime, 0, 1) * (width - padding.left - padding.right);
      const y =
        padding.top +
        (1 - clamp(point.watchedPct / 100, 0, 1)) * (height - padding.top - padding.bottom);
      return { ...point, x, y };
    });

  const polylinePoints = positioned.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
          <defs>
            <linearGradient id="retention-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((tick) => {
            const y =
              padding.top +
              (1 - tick / 100) * (height - padding.top - padding.bottom);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeDasharray="3 4"
                />
                <text x={2} y={y + 4} fill="rgba(148,163,184,0.8)" fontSize="10">
                  {tick}%
                </text>
              </g>
            );
          })}

          <motion.polyline
            points={polylinePoints}
            fill="none"
            stroke="url(#retention-line-gradient)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />

          {positioned.map((point) => {
            const isSelected = point.id === selectedPointId;
            return (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 8 : 5}
                  fill={POINT_COLORS[point.type]}
                  stroke={isSelected ? "#f8fafc" : "rgba(248,250,252,0.5)"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  onClick={() => onSelectPoint(point)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-12 gap-1 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
        {heatmap.map((cell, index) => (
          <div
            key={`${cell.timestamp}-${index}`}
            className="h-2 rounded-sm"
            title={`${cell.timestamp.toFixed(1)}s`}
            style={{ background: `rgba(34,211,238,${clamp(cell.intensity, 0.08, 1)})` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Best / peak engagement
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Worst / biggest drop
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Skip zones
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Hook moments
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-purple-500" /> Emotional peaks
        </span>
      </div>
    </div>
  );
}
