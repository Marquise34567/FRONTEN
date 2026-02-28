import { useEffect } from "react";
import { API_URL } from "@/lib/api";

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

const buildRealtimeSocketUrl = (token: string) => {
  const params = new URLSearchParams({ token });
  if (API_URL) {
    try {
      const parsed = new URL(API_URL);
      const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${parsed.host}/ws?${params.toString()}`;
    } catch {
      // fall through to current origin
    }
  }
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?${params.toString()}`;
};

export const useRealtimePresence = (accessToken?: string | null) => {
  useEffect(() => {
    const token = String(accessToken || "").trim();
    if (!token) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimer === null) return;
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return;
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
      const socketUrl = buildRealtimeSocketUrl(token);
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
