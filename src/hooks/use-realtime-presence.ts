import { useEffect } from "react";
import { API_URL } from "@/lib/api";

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

const buildRealtimeSocketUrls = (token: string) => {
  const params = new URLSearchParams({ token });
  const out: string[] = [];
  const seen = new Set<string>();
  const addFromBase = (baseUrl: string) => {
    const normalized = String(baseUrl || "").trim();
    if (!normalized) return;
    try {
      const parsed = new URL(normalized);
      const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${parsed.host}/ws?${params.toString()}`;
      if (seen.has(socketUrl)) return;
      seen.add(socketUrl);
      out.push(socketUrl);
    } catch {
      // ignore malformed base URL
    }
  };
  if (API_URL) {
    addFromBase(API_URL);
  }
  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalDevHost = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocalDevHost) {
      addFromBase(`${window.location.protocol}//${window.location.host}`);
    }
  }
  return out;
};

export const useRealtimePresence = (accessToken?: string | null) => {
  useEffect(() => {
    const token = String(accessToken || "").trim();
    if (!token) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    let socketUrlCursor = 0;
    const socketUrls = buildRealtimeSocketUrls(token);
    if (!socketUrls.length) return;

    const clearReconnectTimer = () => {
      if (reconnectTimer === null) return;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        BASE_RECONNECT_DELAY_MS * 2 ** Math.min(reconnectAttempts, 5)
      );
      reconnectAttempts += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closed) return;
      const socketUrl = socketUrls[socketUrlCursor % socketUrls.length];
      socketUrlCursor += 1;
      if (!socketUrl) return;
      try {
        socket = new WebSocket(socketUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        reconnectAttempts = 0;
        clearReconnectTimer();
      };

      // Messages are currently consumed on dedicated pages via SSE.
      socket.onmessage = () => {};

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      clearReconnectTimer();
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [accessToken]);
};
