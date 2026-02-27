import type { RenderJobResult, RetentionPoint } from "@/features/autoeditor/types";

export const GOOD_RETENTION_THRESHOLD = 70;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toSafePointScore = (point: RetentionPoint) =>
  Number.isFinite(Number(point.watchedPct)) ? Number(point.watchedPct) : 0;

export const getRetentionScore = (result: RenderJobResult | null) => {
  const points = result?.retention?.points || [];
  if (!points.length) return 0;
  const average = points.reduce((sum, point) => sum + toSafePointScore(point), 0) / points.length;
  return Number(clamp(average, 0, 100).toFixed(1));
};

export const isGoodRetention = (score: number) => score >= GOOD_RETENTION_THRESHOLD;

const formatTimestamp = (value: number) => `${Math.max(0, Number(value) || 0).toFixed(1)}s`;

export const buildRetentionAdvice = (result: RenderJobResult | null) => {
  const points = result?.retention?.points || [];
  if (!points.length) {
    return [
      "Add a stronger first 2 seconds with a clear payoff.",
      "Tighten pacing in the middle to avoid slow sections.",
      "Use the insights graph to target low-retention timestamps.",
    ];
  }

  const advice: string[] = [];
  const earlyHook = points.find((point) => point.timestamp <= 3.2);
  const skipZones = points.filter((point) => point.type === "skip_zone");
  const lowestPoint = points.slice().sort((a, b) => a.watchedPct - b.watchedPct)[0];
  const peakMoments = points.filter((point) => point.type === "best" || point.type === "emotional_peak");

  if (!earlyHook || earlyHook.watchedPct < 50) {
    advice.push("Strengthen the first 2-3 seconds with a punchier hook and quicker context.");
  }
  if (skipZones.length > 0) {
    const skipMoments = skipZones
      .slice(0, 2)
      .map((point) => formatTimestamp(point.timestamp))
      .join(" and ");
    advice.push(`Trim or rewrite slow beats around ${skipMoments}.`);
  }
  if (lowestPoint && lowestPoint.watchedPct < GOOD_RETENTION_THRESHOLD) {
    advice.push(
      `Rework the drop near ${formatTimestamp(lowestPoint.timestamp)} with a faster cut, caption cue, or visual change.`,
    );
  }
  if (peakMoments.length > 0) {
    advice.push("Move your strongest emotional or payoff moment earlier to improve watch-through.");
  }

  if (!advice.length) {
    advice.push("Retention is close to target. Try one faster pacing step and re-render.");
  }

  return advice.slice(0, 3);
};
