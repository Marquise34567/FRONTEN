import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Lock, Sparkles, TrendingUp, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import "./retention-graph-modal.css";

export type RetentionGraphCategory = "best" | "weak" | "keep" | "skip";

type InternalCategory = RetentionGraphCategory | "normal";

type RetentionPoint = {
  second: number;
  time: string;
  score: number;
  reason: string;
  category: InternalCategory;
};

type RetentionInsight = {
  id: string;
  category: RetentionGraphCategory;
  second: number;
  score: number;
  tip: string;
};

export type RetentionCurvePointInput = {
  second: number;
  score: number;
  reason?: string | null;
  category?: RetentionGraphCategory | string | null;
};

type RetentionGraphModalProps = {
  canAccessPremium: boolean;
  className?: string;
  curve?: RetentionCurvePointInput[] | null;
  durationSec?: number | null;
  beforeScore?: number | null;
  afterScore?: number | null;
  deltaScore?: number | null;
  hookStartSec?: number | null;
  hookEndSec?: number | null;
  hookText?: string | null;
  hookReason?: string | null;
  keepWatchingReasons?: string[];
  weakReasons?: string[];
  improvementTips?: string[];
  trendSignals?: string[];
  onUpgrade: () => void;
  onFixWeakPartsNow?: () => void | Promise<void>;
  onBoostBestMoments?: () => void | Promise<void>;
  onApplyAllSuggestions?: () => void | Promise<void>;
  onSeeTrendAlignment?: () => void | Promise<void>;
};

const CATEGORY_META: Record<RetentionGraphCategory, { label: string; color: string }> = {
  best: { label: "Best Parts", color: "#34D399" },
  weak: { label: "Weak Parts", color: "#F87171" },
  keep: { label: "Keep Watching", color: "#38BDF8" },
  skip: { label: "Skip Risk", color: "#FACC15" },
};

const HIGHLIGHT_ORDER: RetentionGraphCategory[] = ["best", "weak", "keep", "skip"];
const LINE_START = "#A855F7";
const LINE_END = "#C084FC";
const MIN_VISIBLE_POINTS = 10;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatTimeLabel = (seconds: number) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const parseCategory = (value: unknown): InternalCategory => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["best", "peak", "high"].includes(normalized)) return "best";
  if (["weak", "dip", "drop"].includes(normalized)) return "weak";
  if (["keep", "hold", "sticky"].includes(normalized)) return "keep";
  if (["skip", "warning", "risk"].includes(normalized)) return "skip";
  return "normal";
};

const defaultReason = (category: InternalCategory) => {
  if (category === "best") return "Punchline or hook timing keeps viewers locked in.";
  if (category === "weak") return "Pacing softens and watch-through drops.";
  if (category === "keep") return "Story continuation sustains curiosity.";
  if (category === "skip") return "Low-energy stretch raises skip risk.";
  return "Engagement stays steady.";
};

const findNearestIndex = (points: RetentionPoint[], second: number) => {
  if (!points.length) return -1;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.abs(point.second - second);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const buildPoints = (params: {
  curve?: RetentionCurvePointInput[] | null;
  durationSec?: number | null;
  beforeScore?: number | null;
  afterScore?: number | null;
  deltaScore?: number | null;
  hookStartSec?: number | null;
  hookEndSec?: number | null;
  hookText?: string | null;
  hookReason?: string | null;
  keepWatchingReasons?: string[];
  weakReasons?: string[];
  improvementTips?: string[];
}): RetentionPoint[] => {
  const normalizedCurve = Array.isArray(params.curve)
    ? params.curve
        .map((item) => {
          const second = Number(item?.second);
          const rawScore = Number(item?.score);
          if (!Number.isFinite(second) || !Number.isFinite(rawScore)) return null;
          const score = Math.abs(rawScore) <= 1 ? rawScore * 100 : rawScore;
          const category = parseCategory(item?.category);
          return {
            second: clamp(Number(second.toFixed(2)), 0, 24 * 60 * 60),
            time: formatTimeLabel(second),
            score: clamp(Number(score.toFixed(1)), 0, 100),
            category,
            reason: typeof item?.reason === "string" && item.reason.trim().length > 0 ? item.reason.trim() : defaultReason(category),
          } as RetentionPoint;
        })
        .filter((item: RetentionPoint | null): item is RetentionPoint => Boolean(item))
        .sort((a, b) => a.second - b.second)
    : [];

  if (normalizedCurve.length >= 8) {
    const withHighlights = [...normalizedCurve];
    const hasHighlights = withHighlights.some((point) => point.category !== "normal");
    if (hasHighlights) return withHighlights;

    const rankedHigh = [...withHighlights]
      .map((point, index) => ({ point, index }))
      .sort((a, b) => b.point.score - a.point.score);
    const rankedLow = [...withHighlights]
      .map((point, index) => ({ point, index }))
      .sort((a, b) => a.point.score - b.point.score);
    const picks: Array<{ category: RetentionGraphCategory; index: number; reason: string }> = [
      {
        category: "best",
        index: rankedHigh[0]?.index ?? 0,
        reason: hookText || hookReason || keepWatchingReasons?.[0] || defaultReason("best"),
      },
      {
        category: "weak",
        index: rankedLow[0]?.index ?? Math.max(0, withHighlights.length - 1),
        reason: weakReasons?.[0] || defaultReason("weak"),
      },
      {
        category: "keep",
        index: rankedHigh[Math.max(1, Math.floor(rankedHigh.length * 0.35))]?.index ?? Math.floor(withHighlights.length * 0.3),
        reason: keepWatchingReasons?.[0] || defaultReason("keep"),
      },
      {
        category: "skip",
        index: rankedLow[Math.max(1, Math.floor(rankedLow.length * 0.35))]?.index ?? Math.floor(withHighlights.length * 0.7),
        reason: improvementTips?.[0] || defaultReason("skip"),
      },
    ];
    picks.forEach((pick) => {
      if (!Number.isFinite(pick.index)) return;
      const index = clamp(Math.round(pick.index), 0, withHighlights.length - 1);
      withHighlights[index] = {
        ...withHighlights[index],
        category: pick.category,
        reason: String(pick.reason || defaultReason(pick.category)).trim(),
      };
    });
    return withHighlights;
  }

  const duration = clamp(Number(params.durationSec) || 120, 45, 3600);
  const total = clamp(Math.round(duration / 4), 24, 84);
  const beforeAnchor = Number.isFinite(Number(params.beforeScore)) ? clamp(Number(params.beforeScore), 35, 99) : 96;
  const afterAnchor = Number.isFinite(Number(params.afterScore)) ? clamp(Number(params.afterScore), 25, 96) : 68;
  const deltaAnchor = Number.isFinite(Number(params.deltaScore)) ? clamp(Number(params.deltaScore), -20, 20) : afterAnchor - beforeAnchor;

  const points: RetentionPoint[] = Array.from({ length: total }, (_, index) => {
    const progress = total <= 1 ? 0 : index / (total - 1);
    const drift = beforeAnchor - progress * Math.max(12, beforeAnchor - afterAnchor + 12);
    const wave = Math.sin(progress * 8.2) * 4.6 + Math.sin(progress * 17.3) * 2.2;
    const hookBoost = progress < 0.12 ? 11 * (1 - progress / 0.12) : 0;
    const deltaBoost = deltaAnchor * 0.28 * (1 - progress * 0.65);
    const score = clamp(Number((drift + wave + hookBoost + deltaBoost).toFixed(1)), 9, 100);
    const second = Number((progress * duration).toFixed(2));
    return { second, time: formatTimeLabel(second), score, reason: defaultReason("normal"), category: "normal" };
  });

  const keepReason = params.keepWatchingReasons?.find((line) => line?.trim())?.trim();
  const weakReason = params.weakReasons?.find((line) => line?.trim())?.trim();
  const improveReason = params.improvementTips?.find((line) => line?.trim())?.trim();

  const marks: Array<{ ratio: number; category: RetentionGraphCategory; offset: number; reason: string }> = [
    {
      ratio: Number.isFinite(Number(params.hookStartSec))
        ? clamp(
            (Number(params.hookStartSec) + (Number.isFinite(Number(params.hookEndSec)) ? Number(params.hookEndSec) : Number(params.hookStartSec))) / 2 / duration,
            0,
            1,
          )
        : 0.08,
      category: "best",
      offset: 9,
      reason: (params.hookText || params.hookReason || keepReason || "Hook lands fast and sets curiosity early.").trim(),
    },
    { ratio: 0.28, category: "keep", offset: 5, reason: (keepReason || "Story progression keeps attention stable.").trim() },
    { ratio: 0.5, category: "weak", offset: -13, reason: (weakReason || "Mid-section drifts and retention drops.").trim() },
    { ratio: 0.68, category: "skip", offset: -8, reason: (improveReason || "Pacing slows and skip risk spikes.").trim() },
    { ratio: 0.84, category: "best", offset: 6, reason: (improveReason || keepReason || "Late payoff recaptures interest.").trim() },
  ];

  marks.forEach((mark) => {
    const index = findNearestIndex(points, mark.ratio * duration);
    if (index < 0) return;
    points[index] = {
      ...points[index],
      score: clamp(Number((points[index].score + mark.offset).toFixed(1)), 7, 100),
      category: mark.category,
      reason: mark.reason,
    };
  });

  return points;
};

const buildInsights = (
  points: RetentionPoint[],
  keepWatchingReasons?: string[],
  weakReasons?: string[],
  improvementTips?: string[],
): RetentionInsight[] => {
  const picked: RetentionInsight[] = [];
  HIGHLIGHT_ORDER.forEach((category, index) => {
    const first = points.find((point) => point.category === category);
    if (first) {
      picked.push({
        id: `${category}-${Math.round(first.second * 10)}-${index}`,
        category,
        second: first.second,
        score: first.score,
        tip: first.reason,
      });
      return;
    }
    const fallback =
      category === "keep" ? keepWatchingReasons?.[0] : category === "weak" ? weakReasons?.[0] : improvementTips?.[0];
    picked.push({
      id: `${category}-fallback-${index}`,
      category,
      second: 0,
      score: 0,
      tip: fallback || defaultReason(category),
    });
  });
  return picked.slice(0, 6);
};

const RetentionGraphModal = ({
  canAccessPremium,
  className,
  curve,
  durationSec,
  beforeScore,
  afterScore,
  deltaScore,
  hookStartSec,
  hookEndSec,
  hookText,
  hookReason,
  keepWatchingReasons,
  weakReasons,
  improvementTips,
  trendSignals,
  onUpgrade,
  onFixWeakPartsNow,
  onBoostBestMoments,
  onApplyAllSuggestions,
  onSeeTrendAlignment,
}: RetentionGraphModalProps) => {
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const chartIdRef = useRef(`retention-${Math.random().toString(36).slice(2, 10)}`);
  const dragRef = useRef<{ x: number; width: number; start: number; end: number } | null>(null);
  const pinchRef = useRef<{ distance: number; width: number; left: number; start: number; end: number } | null>(null);

  const points = useMemo(
    () =>
      buildPoints({
        curve,
        durationSec,
        beforeScore,
        afterScore,
        deltaScore,
        hookStartSec,
        hookEndSec,
        hookText,
        hookReason,
        keepWatchingReasons,
        weakReasons,
        improvementTips,
      }),
    [
      curve,
      durationSec,
      beforeScore,
      afterScore,
      deltaScore,
      hookStartSec,
      hookEndSec,
      hookText,
      hookReason,
      keepWatchingReasons,
      weakReasons,
      improvementTips,
    ],
  );

  const insights = useMemo(
    () => buildInsights(points, keepWatchingReasons, weakReasons, improvementTips),
    [points, keepWatchingReasons, weakReasons, improvementTips],
  );
  const visibleInsights = useMemo(
    () => (canAccessPremium ? insights : insights.slice(0, 2)),
    [canAccessPremium, insights],
  );
  const selectedInsight = useMemo(
    () => visibleInsights.find((item) => item.id === selectedInsightId) || visibleInsights[0] || null,
    [selectedInsightId, visibleInsights],
  );

  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.max(0, points.length - 1) });
  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(0, points.length - 1) });
  }, [points.length, open]);
  useEffect(() => {
    setSelectedInsightId((current) => {
      if (!visibleInsights.length) return null;
      if (current && visibleInsights.some((item) => item.id === current)) return current;
      return visibleInsights[0].id;
    });
  }, [visibleInsights]);

  const applyRange = useCallback((startIndex: number, endIndex: number) => {
    const max = Math.max(0, points.length - 1);
    let start = clamp(Math.min(startIndex, endIndex), 0, max);
    let end = clamp(Math.max(startIndex, endIndex), 0, max);
    const minSpan = Math.min(MIN_VISIBLE_POINTS, points.length);
    while (end - start + 1 < minSpan && (start > 0 || end < max)) {
      if (start > 0) start -= 1;
      if (end - start + 1 >= minSpan) break;
      if (end < max) end += 1;
    }
    setRange({ startIndex: start, endIndex: end });
  }, [points.length]);

  const handleWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!canAccessPremium || points.length <= MIN_VISIBLE_POINTS) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const span = range.endIndex - range.startIndex + 1;
    const delta = event.deltaY > 0 ? 1 : -1;
    const nextSpan = clamp(
      Math.round(span + delta * Math.max(2, span * 0.18)),
      Math.min(MIN_VISIBLE_POINTS, points.length),
      points.length,
    );
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const anchor = Math.round(range.startIndex + ratio * (span - 1));
    const start = clamp(Math.round(anchor - ratio * (nextSpan - 1)), 0, Math.max(0, points.length - nextSpan));
    applyRange(start, start + nextSpan - 1);
  }, [applyRange, canAccessPremium, points.length, range.endIndex, range.startIndex]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!canAccessPremium || points.length <= MIN_VISIBLE_POINTS) return;
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      x: event.clientX,
      width: Math.max(1, rect.width),
      start: range.startIndex,
      end: range.endIndex,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [canAccessPremium, points.length, range.endIndex, range.startIndex]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!canAccessPremium || !dragRef.current) return;
    const drag = dragRef.current;
    const span = drag.end - drag.start + 1;
    const deltaPx = event.clientX - drag.x;
    const deltaIndex = Math.round((-deltaPx / drag.width) * Math.max(1, span));
    applyRange(drag.start + deltaIndex, drag.end + deltaIndex);
  }, [applyRange, canAccessPremium]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!canAccessPremium || points.length <= MIN_VISIBLE_POINTS) return;
    if (event.touches.length !== 2) {
      pinchRef.current = null;
      return;
    }
    const left = event.touches[0];
    const right = event.touches[1];
    const rect = event.currentTarget.getBoundingClientRect();
    pinchRef.current = {
      distance: Math.max(8, Math.abs(left.clientX - right.clientX)),
      width: Math.max(1, rect.width),
      left: rect.left,
      start: range.startIndex,
      end: range.endIndex,
    };
  }, [canAccessPremium, points.length, range.endIndex, range.startIndex]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!canAccessPremium || !pinchRef.current || event.touches.length !== 2) return;
    event.preventDefault();
    const pinch = pinchRef.current;
    const left = event.touches[0];
    const right = event.touches[1];
    const distance = Math.max(8, Math.abs(left.clientX - right.clientX));
    const midpoint = (left.clientX + right.clientX) / 2;
    const midpointRatio = clamp((midpoint - pinch.left) / pinch.width, 0, 1);
    const span = pinch.end - pinch.start + 1;
    const zoomRatio = distance / pinch.distance;
    const nextSpan = clamp(
      Math.round(span / zoomRatio),
      Math.min(MIN_VISIBLE_POINTS, points.length),
      points.length,
    );
    const center = Math.round(pinch.start + midpointRatio * (span - 1));
    const start = clamp(center - Math.floor(nextSpan / 2), 0, Math.max(0, points.length - nextSpan));
    applyRange(start, start + nextSpan - 1);
  }, [applyRange, canAccessPremium, points.length]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  const runAction = useCallback(async (action: string, fn?: (() => void | Promise<void>) | null) => {
    if (!fn) return;
    setBusyAction(action);
    try {
      await Promise.resolve(fn());
    } finally {
      setBusyAction(null);
    }
  }, []);
  const handleInsightSelect = useCallback((insight: RetentionInsight) => {
    setSelectedInsightId(insight.id);
    if (!canAccessPremium || points.length === 0) return;
    const targetIndex = findNearestIndex(points, insight.second);
    if (targetIndex < 0) return;

    const minSpan = Math.max(1, Math.min(MIN_VISIBLE_POINTS, points.length));
    const currentSpan = clamp(range.endIndex - range.startIndex + 1, minSpan, points.length);
    const start = clamp(targetIndex - Math.floor(currentSpan / 2), 0, Math.max(0, points.length - currentSpan));
    applyRange(start, start + currentSpan - 1);
  }, [applyRange, canAccessPremium, points, range.endIndex, range.startIndex]);

  const renderDot = useCallback((props: any) => {
    const point = props?.payload as RetentionPoint | undefined;
    if (!point || point.category === "normal" || typeof props?.cx !== "number" || typeof props?.cy !== "number") return null;
    const color = CATEGORY_META[point.category].color;
    return (
      <g className={`retention-marker retention-marker--${point.category}`} transform={`translate(${props.cx},${props.cy})`}>
        <circle r={4.5} fill={color} stroke="#F8FAFC" strokeWidth={1.2} />
        <circle className="retention-marker-ring" r={8} fill="none" stroke={color} strokeWidth={1.3} />
      </g>
    );
  }, []);

  const renderActiveDot = useCallback((props: any) => {
    if (typeof props?.cx !== "number" || typeof props?.cy !== "number") return null;
    const point = props?.payload as RetentionPoint | undefined;
    const key = point?.category && point.category !== "normal" ? point.category : "keep";
    const color = CATEGORY_META[key].color;
    return (
      <motion.g
        transform={`translate(${props.cx},${props.cy})`}
        initial={{ scale: 0.75, opacity: 0.8 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <circle r={9.5} fill={`${color}33`} stroke={color} strokeWidth={1.4} />
        <circle r={5.5} fill={color} stroke="#F8FAFC" strokeWidth={1.2} />
      </motion.g>
    );
  }, []);

  const deltaValue = Number.isFinite(Number(deltaScore)) ? Number(deltaScore) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        onClick={() => setOpen(true)}
        className="retention-preview-trigger group relative w-full overflow-hidden rounded-2xl border border-purple-400/35 bg-[radial-gradient(circle_at_12%_10%,rgba(168,85,247,0.22),transparent_45%),radial-gradient(circle_at_92%_88%,rgba(56,189,248,0.18),transparent_42%),linear-gradient(145deg,#101126,#0C0D1D)] p-3 text-left shadow-[0_16px_55px_-30px_rgba(168,85,247,0.82)]"
      >
        <div className="retention-preview-sheen pointer-events-none" />
        <div className="relative z-[1] flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-purple-200/80">Retention Summary Thumbnail</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {canAccessPremium ? "Tap for full deep-dive analytics" : "Teaser unlocked - upgrade for full analytics"}
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-400/12 px-2 py-1 text-[10px] text-cyan-100">ETA +5-10s proxy render</span>
        </div>

        <div className="relative mt-3 h-28 overflow-hidden rounded-xl border border-purple-400/25 bg-[#12121F]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 8, left: -22, bottom: 8 }}>
              <defs>
                <linearGradient id={`${chartIdRef.current}-preview-gradient`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={LINE_START} />
                  <stop offset="100%" stopColor={LINE_END} />
                </linearGradient>
                <filter id={`${chartIdRef.current}-preview-glow`} x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <Line type="monotone" dataKey="score" stroke={`url(#${chartIdRef.current}-preview-gradient)`} strokeWidth={2.8} dot={false} isAnimationActive animationDuration={1000} animationEasing="ease-out" filter={`url(#${chartIdRef.current}-preview-glow)`} />
            </LineChart>
          </ResponsiveContainer>

          {!canAccessPremium ? (
            <div className="retention-lock-overlay absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-purple-300/40 bg-black/55 px-3 py-2 text-center backdrop-blur-md">
                <p className="text-xs font-semibold text-purple-100">Upgrade for Analytics</p>
                <p className="text-[11px] text-slate-300">Interactive graph + AI actions</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative z-[1] mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {Number.isFinite(Number(beforeScore)) ? <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-slate-300">Before {Number(beforeScore).toFixed(1)}%</span> : null}
          {Number.isFinite(Number(afterScore)) ? <span className="rounded-full border border-purple-300/25 bg-purple-500/10 px-2 py-1 text-purple-100">After {Number(afterScore).toFixed(1)}%</span> : null}
          {deltaValue !== null ? (
            <span className={cn("rounded-full border px-2 py-1", deltaValue >= 0 ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200" : "border-amber-300/35 bg-amber-500/10 text-amber-200")}>
              Delta {deltaValue > 0 ? "+" : ""}{deltaValue.toFixed(1)}
            </span>
          ) : null}
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto border border-purple-300/30 bg-black/60 p-0 backdrop-blur-2xl sm:max-w-6xl">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="relative overflow-hidden rounded-[inherit] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.2),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.17),transparent_40%),linear-gradient(145deg,rgba(8,10,24,0.96),rgba(8,12,30,0.96))] p-4 sm:p-6">
            <DialogHeader className="relative z-[1] space-y-2">
              <DialogTitle className="bg-gradient-to-r from-[#A855F7] via-purple-300 to-cyan-300 bg-clip-text text-2xl font-semibold text-transparent sm:text-3xl">Retention Deep Dive 🔥</DialogTitle>
              <p className="text-sm text-slate-300">{canAccessPremium ? "Interactive retention analytics with zoom/pan, AI highlights, and one-click optimization actions." : "Premium unlock required for full interactivity, AI actions, and trend alignment controls."}</p>
            </DialogHeader>

            <div className="relative z-[1] mt-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <div className="rounded-2xl border border-purple-300/25 bg-[#12121F]/95 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-purple-200/80">Interactive Retention Timeline</p>
                  <span className="rounded-full border border-purple-300/30 bg-purple-500/10 px-2 py-1 text-[10px] text-purple-100">{canAccessPremium ? "Zoom / pan / pinch enabled" : "Teaser view"}</span>
                </div>

                <div
                  className="retention-touch-surface relative h-[290px] rounded-xl border border-white/10 bg-[#12121F] p-1 sm:h-[360px]"
                  onWheel={handleWheelZoom}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 12, right: 18, left: 6, bottom: canAccessPremium ? 42 : 14 }}>
                      <defs>
                        <linearGradient id={`${chartIdRef.current}-line-gradient`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={LINE_START} />
                          <stop offset="100%" stopColor={LINE_END} />
                        </linearGradient>
                        <filter id={`${chartIdRef.current}-line-glow`} x="-60%" y="-60%" width="220%" height="220%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="time" minTickGap={26} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,0.25)" }} tickLine={{ stroke: "rgba(148,163,184,0.2)" }} />
                      <YAxis domain={[0, 100]} width={40} tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,0.25)" }} tickLine={{ stroke: "rgba(148,163,184,0.2)" }} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip
                        cursor={{ stroke: "rgba(192,132,252,0.45)", strokeWidth: 1.2 }}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const current = payload[0]?.payload as RetentionPoint;
                          if (!current) return null;
                          const meta = current.category === "normal" ? null : CATEGORY_META[current.category];
                          return (
                            <motion.div key={`${current.second}-${current.score}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.14, ease: "easeOut" }} className="max-w-[260px] rounded-lg border border-purple-300/40 bg-[#0F1123]/95 p-3 shadow-[0_12px_35px_-20px_rgba(168,85,247,0.9)]">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-purple-200/85">{meta ? meta.label : "Retention"}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-100">{current.time} - {current.score.toFixed(1)}%</p>
                              <p className="mt-1 text-xs text-slate-300">{current.reason}</p>
                            </motion.div>
                          );
                        }}
                      />
                      <Line type="monotone" dataKey="score" stroke={`url(#${chartIdRef.current}-line-gradient)`} strokeWidth={3.2} dot={renderDot} activeDot={renderActiveDot} isAnimationActive animationDuration={1000} animationEasing="ease-out" filter={`url(#${chartIdRef.current}-line-glow)`} />
                      {canAccessPremium ? (
                        <Brush dataKey="time" startIndex={range.startIndex} endIndex={range.endIndex} height={20} travellerWidth={10} stroke={LINE_START} fill="rgba(15,17,35,0.85)" onChange={(next) => {
                          if (!next) return;
                          const startIndex = Number(next.startIndex);
                          const endIndex = Number(next.endIndex);
                          if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) return;
                          applyRange(startIndex, endIndex);
                        }} />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                  {!canAccessPremium ? <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/45 backdrop-blur-[2px]"><div className="max-w-xs rounded-xl border border-purple-300/35 bg-[#0D1022]/90 p-3 text-center"><Lock className="mx-auto h-4 w-4 text-purple-200" /><p className="mt-1 text-sm font-semibold text-purple-100">Upgrade for Full Interactivity</p><p className="mt-1 text-xs text-slate-300">Unlock pinch-zoom, pan, AI actions, and full retention reasons.</p></div></div> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {HIGHLIGHT_ORDER.map((category) => (
                    <span key={category} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_META[category].color }} />
                      {CATEGORY_META[category].label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.18em] text-purple-200/80">Insights Panel</p>
                  {selectedInsight ? (
                    <div className="mt-2 rounded-xl border border-purple-300/25 bg-black/35 p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Preview Focus</p>
                      <p className="mt-1 text-sm font-medium text-slate-100">
                        {CATEGORY_META[selectedInsight.category].label} at {formatTimeLabel(selectedInsight.second)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {selectedInsight.score > 0 ? `${selectedInsight.score.toFixed(1)}% retention estimate` : "No score yet"}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {visibleInsights.map((insight, index) => {
                      const meta = CATEGORY_META[insight.category];
                      const isSelected = selectedInsight?.id === insight.id;
                      return (
                        <motion.button
                          key={insight.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => handleInsightSelect(insight)}
                          className={cn(
                            "rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/50",
                            isSelected ? "ring-1 ring-white/35" : "hover:border-white/35",
                          )}
                          style={{
                            borderColor: isSelected ? `${meta.color}CC` : `${meta.color}66`,
                            background: isSelected
                              ? "linear-gradient(145deg,rgba(20,23,44,0.95),rgba(10,12,24,0.9))"
                              : "linear-gradient(145deg,rgba(14,16,34,0.86),rgba(10,12,24,0.84))",
                            boxShadow: isSelected ? `inset 0 0 0 1px ${meta.color}55` : undefined,
                          }}
                          aria-pressed={isSelected}
                        >
                          <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>{meta.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">{formatTimeLabel(insight.second)} - {insight.score > 0 ? `${insight.score.toFixed(1)}%` : "n/a"}</p>
                          <p className="mt-1 text-xs text-slate-300">{insight.tip}</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {isSelected ? "Preview target selected" : "Click to preview this timestamp"}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">Trend Signals</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-300">
                    {(trendSignals || []).slice(0, 3).map((line, index) => <p key={`trend-${index}`}>- {line}</p>)}
                    {(trendSignals || []).length === 0 ? <p>- Cross-check pacing profile against current niche trend snapshots.</p> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[1] mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {canAccessPremium ? (
                <>
                  <Button type="button" disabled={busyAction !== null} className="retention-action-btn h-12 rounded-xl border border-purple-300/45 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-sm text-white hover:brightness-110" onClick={() => void runAction("fix", onFixWeakPartsNow)}>{busyAction === "fix" ? "Applying..." : "Fix Weak Parts Now"}</Button>
                  <Button type="button" disabled={busyAction !== null} className="retention-action-btn h-12 rounded-xl border border-purple-300/45 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-sm text-white hover:brightness-110" onClick={() => void runAction("boost", onBoostBestMoments)}>{busyAction === "boost" ? "Boosting..." : "Boost Best Moments"}</Button>
                  <Button type="button" disabled={busyAction !== null} className="retention-action-btn h-12 rounded-xl border border-purple-300/45 bg-gradient-to-r from-[#7E22CE] to-[#A855F7] text-sm text-white hover:brightness-110" onClick={() => void runAction("apply", onApplyAllSuggestions)}>{busyAction === "apply" ? "Rendering..." : "Apply All Suggestions"}</Button>
                  <Button type="button" disabled={busyAction !== null} className="retention-action-btn h-12 rounded-xl border border-cyan-300/45 bg-gradient-to-r from-[#0891B2] to-[#22D3EE] text-sm text-white hover:brightness-110" onClick={() => void runAction("trend", onSeeTrendAlignment)}>{busyAction === "trend" ? "Loading..." : "See Trend Alignment"}</Button>
                  <Button type="button" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10" onClick={() => setOpen(false)}>Close</Button>
                </>
              ) : (
                <>
                  <Button type="button" className="retention-action-btn col-span-full h-12 rounded-xl border border-purple-300/45 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-sm text-white hover:brightness-110 sm:col-span-3" onClick={onUpgrade}>Upgrade for Analytics</Button>
                  <Button type="button" variant="outline" className="h-12 rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 sm:col-span-2" onClick={() => setOpen(false)}>Close</Button>
                </>
              )}
            </div>

            <div className="relative z-[1] mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1"><Sparkles className="h-3 w-3 text-purple-200" />Low-res proxy graph rendered first</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1"><TrendingUp className="h-3 w-3 text-cyan-200" />High-fidelity pass ETA +5-10s</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1"><AlertTriangle className="h-3 w-3 text-amber-200" />Hover points to inspect why retention shifts</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1"><Zap className="h-3 w-3 text-violet-200" />Neon AI action controls</span>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetentionGraphModal;
