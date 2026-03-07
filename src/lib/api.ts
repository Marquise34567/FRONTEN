// In dev we prefer using a Vite proxy instead of hardcoding a backend URL.
// `VITE_API_URL` may be set for deployed environments, but leave blank in dev
// so fetches use relative paths (e.g. `/api/...`).
const rawApiUrl = import.meta.env.VITE_API_URL || "";
const forceAbsoluteDevApi = String(import.meta.env.VITE_FORCE_API_URL || "").trim().toLowerCase() === "true";
const normalizeApiUrl = (value: string) => {
  if (!value) return "";
  let trimmed = value.trim();
  if (!trimmed) return "";
  // If someone pasted "VITE_API_URL=..." into the value, strip the key.
  trimmed = trimmed.replace(/^\s*vite_api_url\s*=\s*/i, "");
  // Fix common "https//" typo.
  trimmed = trimmed.replace(/^https\/\//i, "https://").replace(/^http\/\//i, "http://");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
};
const isLoopbackHostname = (hostname: string) => (
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1"
);
const resolveApiUrl = (value: string) => {
  const normalized = normalizeApiUrl(value).replace(/\/$/, "");
  if (!normalized) return "";
  if (import.meta.env.DEV && !forceAbsoluteDevApi) {
    try {
      const parsed = new URL(normalized);
      if (isLoopbackHostname(parsed.hostname)) {
        return "";
      }
    } catch (error) {
      return normalized;
    }
  }
  return normalized;
};
export const API_URL = resolveApiUrl(rawApiUrl);
const PUBLIC_API_PREFIXES = ["/api/public/"];
const PUBLIC_API_EXACT = new Set(["/api/health", "/api/ping"]);
const isControlPanelPath = (path: string) =>
  path.startsWith("/api/admin") || path.startsWith("/api/dev/algorithm");
let authExpiredNotifiedAt = 0;
let authBlockedUntilFreshToken = false;
let lastSeenAccessToken: string | null = null;

const isPublicApiPath = (path: string) =>
  PUBLIC_API_EXACT.has(path) || PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

import { supabase } from "@/integrations/supabase/client";
import { getControlPanelPassword } from "./controlPanelAuth";

const emitAuthExpired = () => {
  const now = Date.now();
  if (now - authExpiredNotifiedAt > 750) {
    authExpiredNotifiedAt = now;
    try {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    } catch (e) {}
  }
};

const getSessionAccessToken = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch (e) {
    return null;
  }
};

const refreshAccessToken = async () => {
  try {
    if (!supabase?.auth || typeof supabase.auth.refreshSession !== "function") return null;
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    const refreshed = data?.session?.access_token ?? null;
    if (refreshed) {
      lastSeenAccessToken = refreshed;
      authBlockedUntilFreshToken = false;
    }
    return refreshed;
  } catch (e) {
    return null;
  }
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  // Allow empty API_URL so requests can be relative (proxied by Vite in dev).
  const base = API_URL || "";
  let { token, headers, cache, ...rest } = options;
  // If no token provided, try to fetch from Supabase session
  if (!token) {
    token = (await getSessionAccessToken()) ?? undefined;
  }
  const isPublicPath = isPublicApiPath(path);
  if (token && token !== lastSeenAccessToken) {
    lastSeenAccessToken = token;
    authBlockedUntilFreshToken = false;
  }
  if (!isPublicPath && authBlockedUntilFreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) token = refreshed;
  }
  if (!isPublicPath && !token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed;
    } else {
      emitAuthExpired();
      throw new ApiError("Not authenticated", 401, "unauthorized");
    }
  }
  const url = `${base}${path}`;
  const resolvedCache = cache ?? (isPublicPath ? "default" : "no-store");
  const controlPanelPassword = isControlPanelPath(path) ? getControlPanelPassword() : "";

  const performRequest = async (resolvedToken?: string, isRetry = false): Promise<T> => {
    const requestHeaders = new Headers(headers || {});
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
    if (controlPanelPassword) {
      requestHeaders.set("x-dev-password", controlPanelPassword);
    }
    if (resolvedToken) {
      requestHeaders.set("Authorization", `Bearer ${resolvedToken}`);
    }
    const res = await fetch(url, {
      ...rest,
      cache: resolvedCache,
      headers: requestHeaders,
      // Include credentials (cookies) for cookie-based auth flows in local dev
      credentials: "include",
    });

    const text = await res.text().catch(() => "");
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = { raw: text };
    }

    if (!res.ok) {
      const message = data?.message || data?.error || `HTTP ${res.status}`;
      const errorCode = String(data?.error || "").toLowerCase();
      const passwordFailure = errorCode === "invalid_password" || errorCode === "password_required";
      if (res.status === 401 && !isPublicPath && !passwordFailure) {
        if (!isRetry) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return performRequest(refreshed, true);
        }
        authBlockedUntilFreshToken = true;
        emitAuthExpired();
      }
      throw new ApiError(message, res.status, data?.error, data);
    }
    if (!isPublicPath) authBlockedUntilFreshToken = false;
    return data as T;
  };

  return performRequest(token, false);
}
