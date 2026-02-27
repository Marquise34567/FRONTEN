import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { ZoomIn, MoveHorizontal } from "lucide-react";

import PremiumCard from "@/components/premium/PremiumCard";
import { cn } from "@/lib/utils";

export type RetentionGraphPoint = {
  id: string;
  timestamp: number;
  watchedPercent: number;
  type: "peak" | "drop" | "skip" | "neutral";
  label: string;
  note?: string;
};

type RetentionGraphCardProps = {
  points: RetentionGraphPoint[];
  title?: string;
  selectedPointId?: string | null;
  onSelectPoint?: (point: RetentionGraphPoint) => void;
  className?: string;
};

const dotClassByType: Record<RetentionGraphPoint["type"], string> = {
  peak: "fill-[#d4af37] stroke-[#f6da8a]",
  drop: "fill-rose-400 stroke-rose-200",
  skip: "fill-amber-400 stroke-amber-200",
  neutral: "fill-slate-300 stroke-slate-100",
};

export default function RetentionGraphCard({
  points,
  title = "Retention Graph",
  selectedPointId,
  onSelectPoint,
  className,
}: RetentionGraphCardProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const sortedPoints = useMemo(() => points.slice().sort((a, b) => a.timestamp - b.timestamp), [points]);
  const maxStart = Math.max(0, sortedPoints.length - Math.max(3, Math.floor(sortedPoints.length / zoom)));
  const startIndex = Math.min(maxStart, Math.round(pan * maxStart));
  const visibleCount = Math.max(3, Math.floor(sortedPoints.length / zoom));
  const visiblePoints = useMemo(
    () => sortedPoints.slice(startIndex, startIndex + visibleCount),
    [sortedPoints, startIndex, visibleCount],
  );
  const chartPoints = useMemo(
    () =>
      visiblePoints.map((point) => ({
        ...point,
        timeLabel: `${Math.round(point.timestamp)}s`,
      })),
    [visiblePoints],
  );

  return (
    <PremiumCard className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
            Peak
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            Drop
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Skip Risk
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
        <span className="inline-flex items-center gap-1 text-xs text-slate-300">
          <ZoomIn className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
          Zoom
        </span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.1}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-[120px]"
        />
        <span className="inline-flex items-center gap-1 text-xs text-slate-300">
          <MoveHorizontal className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
          Pan
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={pan}
          onChange={(event) => setPan(Number(event.target.value))}
          className="w-[120px]"
          disabled={maxStart <= 0}
        />
      </div>
      <motion.div
        className="h-[300px] rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[linear-gradient(140deg,rgba(8,8,14,0.94),rgba(10,10,18,0.88))] p-2"
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - box.left) / box.width - 0.5) * 8;
          const y = ((event.clientY - box.top) / box.height - 0.5) * -8;
          setTilt({ x, y });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        animate={{ rotateX: tilt.y, rotateY: tilt.x }}
        transition={{ type: "spring", stiffness: 180, damping: 20, mass: 0.45 }}
        style={{ transformStyle: "preserve-3d", perspective: 1100 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="timeLabel" stroke="rgba(241,245,249,0.6)" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              domain={[0, 100]}
              stroke="rgba(241,245,249,0.6)"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(9,9,15,0.95)",
                border: "1px solid rgba(212,175,55,0.24)",
                borderRadius: 16,
                color: "#fef5de",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${Math.round(value)}%`, "Retention"]}
              labelFormatter={(label) => `Timestamp: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="watchedPercent"
              stroke="#d4af37"
              strokeWidth={2.5}
              dot={(props) => {
                const payload = props?.payload as RetentionGraphPoint | undefined;
                if (!payload) return null;
                const active = payload.id === selectedPointId;
                const dotClass = dotClassByType[payload.type];
                return (
                  <g
                    className="cursor-pointer"
                    onClick={() => onSelectPoint?.(payload)}
                    transform={`translate(${props.cx},${props.cy})`}
                  >
                    <circle
                      r={active ? 8 : 6}
                      className={cn("stroke-[1.5]", dotClass)}
                      fillOpacity={active ? 0.9 : 0.75}
                    />
                    {active ? <circle r={11} className="fill-[#d4af37]/20" /> : null}
                  </g>
                );
              }}
              activeDot={{ r: 8, fill: "#d4af37", stroke: "#fff7de", strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </PremiumCard>
  );
}
