import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

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
  peak: "fill-emerald-400 stroke-emerald-200",
  drop: "fill-rose-400 stroke-rose-200",
  skip: "fill-amber-400 stroke-amber-200",
  neutral: "fill-slate-300 stroke-slate-200",
};

export default function RetentionGraphCard({
  points,
  title = "Retention Graph",
  selectedPointId,
  onSelectPoint,
  className,
}: RetentionGraphCardProps) {
  const chartPoints = useMemo(
    () =>
      points
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((point) => ({
          ...point,
          timeLabel: `${Math.round(point.timestamp)}s`,
        })),
    [points],
  );

  return (
    <PremiumCard className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
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
      <div className="h-[300px] rounded-2xl border border-white/10 bg-[#08080f]/80 p-2">
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
                background: "rgba(8,8,15,0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                color: "#f8fafc",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${Math.round(value)}%`, "Retention"]}
              labelFormatter={(label) => `Timestamp: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="watchedPercent"
              stroke="#c084fc"
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
                    {active ? <circle r={11} className="fill-purple-400/20" /> : null}
                  </g>
                );
              }}
              activeDot={{ r: 8, fill: "#d946ef", stroke: "#f5d0fe", strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </PremiumCard>
  );
}
