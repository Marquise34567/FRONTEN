import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { RetentionHeatCell, RetentionPoint } from "@/features/vibecut/types";

const pointColor: Record<RetentionPoint["type"], string> = {
  best: "#22c55e",
  worst: "#ef4444",
  skip_zone: "#f59e0b",
  hook: "#94a3b8",
  emotional_peak: "#8b5cf6",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type RetentionLineGraphProps = {
  points: RetentionPoint[];
  heatmap: RetentionHeatCell[];
  selectedPointId: string | null;
  onPointSelect: (point: RetentionPoint) => void;
  className?: string;
};

export default function RetentionLineGraph({
  points,
  heatmap,
  selectedPointId,
  onPointSelect,
  className,
}: RetentionLineGraphProps) {
  const width = 780;
  const height = 290;
  const padding = { top: 20, right: 22, bottom: 34, left: 34 };
  const safePoints = points.length ? points : [];
  const maxTime = Math.max(1, ...safePoints.map((point) => point.timestamp));

  const positioned = safePoints
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

  const polyline = positioned.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[290px] w-full">
          <defs>
            <linearGradient id="autoeditor-retention-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="45%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="autoeditor-heat" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(139,92,246,0.16)" />
              <stop offset="100%" stopColor="rgba(15,17,23,0)" />
            </linearGradient>
          </defs>

          {[0, 20, 40, 60, 80, 100].map((tick) => {
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
                  strokeDasharray="4 6"
                />
                <text x={6} y={y + 3} fill="rgba(148,163,184,0.84)" fontSize="10">
                  {tick}%
                </text>
              </g>
            );
          })}

          {positioned.length > 1 ? (
            <polygon
              points={`${padding.left},${height - padding.bottom} ${polyline} ${width - padding.right},${height - padding.bottom}`}
              fill="url(#autoeditor-heat)"
            />
          ) : null}

          <motion.polyline
            points={polyline}
            fill="none"
            stroke="url(#autoeditor-retention-line)"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.68, ease: "easeOut" }}
          />

          {positioned.map((point) => {
            const selected = selectedPointId === point.id;
            return (
              <g key={point.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={selected ? 7.2 : 4.8}
                  fill={pointColor[point.type]}
                  stroke={selected ? "rgba(241,245,249,0.95)" : "rgba(226,232,240,0.55)"}
                  strokeWidth={selected ? 2.2 : 1.6}
                  onClick={() => onPointSelect(point)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {heatmap.length > 0 ? (
        <div className="grid grid-cols-12 gap-1 rounded-xl border border-white/10 bg-black/30 p-2">
          {heatmap.map((cell, index) => (
            <div
              key={`${cell.timestamp}-${index}`}
              title={`${cell.timestamp.toFixed(1)}s`}
              className="h-2 rounded-sm"
              style={{
                backgroundColor: `rgba(148,163,184,${clamp(cell.intensity, 0.1, 1)})`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Peak
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Drop-off
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Skip zone
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Emotional peak
        </span>
      </div>
    </div>
  );
}
