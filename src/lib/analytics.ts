import { apiFetch } from "./api";

const ANALYTICS_SESSION_KEY = "ae.analytics.session";

const createSessionId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `sess_${time}_${random}`;
};

export const getAnalyticsSessionId = () => {
  if (typeof window === "undefined") return createSessionId();
  try {
    const existing = window.localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) return existing;
    const next = createSessionId();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return createSessionId();
  }
};

export type TrackAnalyticsEventPayload = {
  eventName: string;
  category?: "interaction" | "page_view" | "feedback" | "system";
  sessionId?: string;
  pagePath?: string;
  jobId?: string;
  retentionProfile?: string;
  targetPlatform?: string;
  captionStyle?: string;
  metadata?: Record<string, unknown>;
};

export type ControlPanelSummary = {
  ok: boolean;
  rangeDays: number;
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  trend: Array<{ date: string; value: number }>;
  topSelections: {
    retentionProfiles: Array<{ name: string; count: number; share: number }>;
    targetPlatforms: Array<{ name: string; count: number; share: number }>;
    captionStyles: Array<{ name: string; count: number; share: number }>;
  };
  feedback: Array<{ name: string; count: number; share: number }>;
  totals: {
    usersTracked: number;
    events: number;
  };
  generatedAt: string;
};

export const trackAnalyticsEvent = async (
  payload: TrackAnalyticsEventPayload,
  token?: string,
) => {
  if (!payload?.eventName) return;
  try {
    await apiFetch<{ ok: boolean; eventId: string }>("/api/analytics/track", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Analytics should never block user actions.
    console.warn("analytics track failed", error);
  }
};

export const fetchControlPanelSummary = async (
  options: { days?: number; token?: string } = {},
) => {
  const days = Number(options.days ?? 90);
  return apiFetch<ControlPanelSummary>(`/api/analytics/control-panel?days=${encodeURIComponent(String(days))}`, {
    token: options.token,
  });
};
