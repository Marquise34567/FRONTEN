import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { API_URL, apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

type LiveStatsTransport = "websocket" | "sse" | "polling" | "disconnected";
type LiveStatsTransportPreference = "auto" | "websocket" | "sse" | "polling";

type LiveStatsAccess = {
  tier: string;
  isPaid: boolean;
  isDev: boolean;
  advanced: boolean;
};

type LiveStatsPulse = {
  t: string;
  activeUsers: number;
  rendersToday: number;
  upgradedToday: number;
  cpuPct: number;
  ramPct: number;
};

type LiveStatsSnapshot = {
  generatedAt: string;
  activeUsers: number;
  activeUsersSeries: Array<{ t: string; v: number }>;
  rendersToday: {
    count: number;
    minutesUsed: number;
    byTier: Array<{ tier: string; renders: number; minutes: number }>;
  };
  trendingNiches: Array<{
    label: string;
    changePct: number;
    direction: "up" | "down";
    volume: number;
  }>;
  subscriptionMetrics: {
    totalSubs: number;
    churnRatePct: number;
    mrr: number;
    byTier: Array<{ tier: string; count: number }>;
  };
  serverLoad: {
    cpuPct: number;
    ramPct: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  recentJobs: Array<{
    id: string;
    user: string;
    status: string;
    durationSec: number;
    createdAt: string;
  }>;
  upgradeSignals: {
    upgradedToday: number;
    activeEditors: number;
  };
  debug: {
    wsClients: number;
    activeWindowMs: number;
    dbOk: boolean;
  };
};

type LiveStatsResponse = {
  access: LiveStatsAccess;
  snapshot: LiveStatsSnapshot;
  pulse: LiveStatsPulse;
  teaser: {
    locked: boolean;
    message: string | null;
    upgradeCta: string | null;
  };
};

type LiveStatsContextValue = {
  access: LiveStatsAccess | null;
  snapshot: LiveStatsSnapshot | null;
  pulse: LiveStatsPulse | null;
  teaserLocked: boolean;
  teaserMessage: string | null;
  upgradeCta: string | null;
  loading: boolean;
  connected: boolean;
  transport: LiveStatsTransport;
  transportPreference: LiveStatsTransportPreference;
  canControlTransport: boolean;
  setTransportPreference: (next: LiveStatsTransportPreference) => void;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
};

const LiveStatsContext = createContext<LiveStatsContextValue | undefined>(undefined);
const DEV_TRANSPORT_STORAGE_KEY = "ae_live_transport_preference";

const normalizeTransportPreference = (value: unknown): LiveStatsTransportPreference => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "websocket") return "websocket";
  if (normalized === "sse") return "sse";
  if (normalized === "polling") return "polling";
  return "auto";
};

const parseEventData = <T,>(event: MessageEvent): T | null => {
  try {
    const parsed = JSON.parse(String(event.data || "{}")) as T;
    return parsed;
  } catch {
    return null;
  }
};

const resolveSseUrl = (token: string) => {
  const base = API_URL || "";
  return `${base}/api/live-stats?stream=1&intervalMs=4000&token=${encodeURIComponent(token)}`;
};

const resolveWsUrl = (token: string) => {
  if (!API_URL) return null;
  try {
    const parsed = new URL(API_URL);
    const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${parsed.host}/ws?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
};

const applyPulse = (current: LiveStatsResponse | null, pulse: LiveStatsPulse): LiveStatsResponse | null => {
  if (!current) return current;
  return {
    ...current,
    pulse,
    snapshot: {
      ...current.snapshot,
      activeUsers: pulse.activeUsers,
      rendersToday: {
        ...current.snapshot.rendersToday,
        count: pulse.rendersToday,
      },
      serverLoad: {
        ...current.snapshot.serverLoad,
        cpuPct: pulse.cpuPct,
        ramPct: pulse.ramPct,
      },
      upgradeSignals: {
        ...current.snapshot.upgradeSignals,
        upgradedToday: pulse.upgradedToday,
      },
      generatedAt: pulse.t,
    },
  };
};

export const LiveStatsProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken } = useAuth();
  const [state, setState] = useState<LiveStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<LiveStatsTransport>("disconnected");
  const [transportPreference, setTransportPreferenceState] = useState<LiveStatsTransportPreference>("auto");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canControlTransport = Boolean(state?.access?.isDev);
  const effectiveTransportPreference: LiveStatsTransportPreference = canControlTransport ? transportPreference : "auto";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DEV_TRANSPORT_STORAGE_KEY);
    setTransportPreferenceState(normalizeTransportPreference(stored));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !canControlTransport) return;
    if (transportPreference === "auto") {
      window.localStorage.removeItem(DEV_TRANSPORT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DEV_TRANSPORT_STORAGE_KEY, transportPreference);
  }, [canControlTransport, transportPreference]);

  const setTransportPreference = useCallback(
    (next: LiveStatsTransportPreference) => {
      if (!canControlTransport) return;
      setTransportPreferenceState(normalizeTransportPreference(next));
    },
    [canControlTransport]
  );

  const hydrate = useCallback((payload: LiveStatsResponse | null) => {
    if (!payload) return;
    setState(payload);
    setLastUpdated(payload.snapshot?.generatedAt || payload.pulse?.t || new Date().toISOString());
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const payload = await apiFetch<LiveStatsResponse>("/api/live-stats", {
        token: accessToken,
      });
      hydrate(payload);
      if (transport === "disconnected" || transport === "polling") {
        setTransport("polling");
        setConnected(true);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, hydrate, transport]);

  useEffect(() => {
    if (!accessToken) {
      setState(null);
      setConnected(false);
      setTransport("disconnected");
      setLastUpdated(null);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [accessToken, refresh]);

  useEffect(() => {
    if (!accessToken) return;
    if (effectiveTransportPreference === "polling") {
      setTransport("polling");
      setConnected(false);
      return;
    }
    const wsUrl = resolveWsUrl(accessToken);
    let cancelled = false;
    let socket: WebSocket | null = null;
    let source: EventSource | null = null;

    const closeAll = () => {
      try {
        socket?.close();
      } catch {
        // ignore
      }
      try {
        source?.close();
      } catch {
        // ignore
      }
      socket = null;
      source = null;
    };

    const connectSse = () => {
      if (cancelled) return;
      try {
        source = new EventSource(resolveSseUrl(accessToken));
      } catch {
        setConnected(false);
        setTransport("polling");
        return;
      }

      setTransport("sse");
      source.addEventListener("ready", () => {
        if (cancelled) return;
        setConnected(true);
      });
      source.addEventListener("stats", (event) => {
        if (cancelled) return;
        const payload = parseEventData<LiveStatsResponse>(event as MessageEvent);
        if (!payload) return;
        hydrate(payload);
        setConnected(true);
      });
      source.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        setTransport("polling");
      };
    };

    const connectWs = () => {
      if (!wsUrl || cancelled) {
        if (effectiveTransportPreference === "websocket") {
          setConnected(false);
          setTransport("polling");
          return;
        }
        connectSse();
        return;
      }
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        if (effectiveTransportPreference === "websocket") {
          setConnected(false);
          setTransport("polling");
          return;
        }
        connectSse();
        return;
      }
      setTransport("websocket");
      socket.onopen = () => {
        if (cancelled) return;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        if (cancelled) return;
        let parsed: any = null;
        try {
          parsed = JSON.parse(String(event.data || "{}"));
        } catch {
          parsed = null;
        }
        if (!parsed) return;
        if (parsed.type === "live:stats" && parsed.payload) {
          setState((current) => applyPulse(current, parsed.payload as LiveStatsPulse));
          setLastUpdated((parsed.payload as LiveStatsPulse).t || new Date().toISOString());
          setConnected(true);
        }
      };
      socket.onerror = () => {
        if (cancelled) return;
        setConnected(false);
      };
      socket.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        if (effectiveTransportPreference === "websocket") {
          setTransport("polling");
          return;
        }
        connectSse();
      };
    };

    if (effectiveTransportPreference === "sse") {
      connectSse();
    } else {
      connectWs();
    }
    return () => {
      cancelled = true;
      closeAll();
      setConnected(false);
    };
  }, [accessToken, effectiveTransportPreference, hydrate]);

  useEffect(() => {
    if (!accessToken) return;
    const maybeSupabase = supabase as {
      channel?: (name: string) => any;
      removeChannel?: (channel: any) => void;
    };
    if (typeof maybeSupabase.channel !== "function") return;

    const queueRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        void refresh();
      }, 1200);
    };

    const channel = maybeSupabase
      .channel(`live-stats-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_analytics_events" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, queueRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (typeof maybeSupabase.removeChannel === "function") {
        maybeSupabase.removeChannel(channel);
      }
    };
  }, [accessToken, refresh]);

  const value = useMemo<LiveStatsContextValue>(
    () => ({
      access: state?.access || null,
      snapshot: state?.snapshot || null,
      pulse: state?.pulse || null,
      teaserLocked: Boolean(state?.teaser?.locked),
      teaserMessage: state?.teaser?.message || null,
      upgradeCta: state?.teaser?.upgradeCta || null,
      loading,
      connected,
      transport,
      transportPreference,
      canControlTransport,
      setTransportPreference,
      lastUpdated,
      refresh,
    }),
    [state, loading, connected, transport, transportPreference, canControlTransport, setTransportPreference, lastUpdated, refresh]
  );

  return <LiveStatsContext.Provider value={value}>{children}</LiveStatsContext.Provider>;
};

export const useLiveStats = () => {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) throw new Error("useLiveStats must be used within LiveStatsProvider");
  return ctx;
};
