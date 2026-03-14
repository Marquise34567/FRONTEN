// In dev we prefer using a Vite proxy instead of hardcoding a backend URL.
// `VITE_API_URL` may be set for deployed environments, but leave blank in dev
// so fetches use relative paths (e.g. `/api/...`).
const rawApiUrl = import.meta.env.VITE_API_URL || "";
const forceAbsoluteDevApi = String(import.meta.env.VITE_FORCE_API_URL || "").trim().toLowerCase() === "true";
const TRUE_PATTERN = /^(1|true|yes|on)$/i;
const FALSE_PATTERN = /^(0|false|no|off)$/i;
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
const readCrossOriginFallbackFlag = () => {
  const raw = String(import.meta.env.VITE_ALLOW_CROSS_ORIGIN_API_FALLBACK || "").trim();
  if (!raw) return import.meta.env.DEV;
  if (FALSE_PATTERN.test(raw)) return false;
  return TRUE_PATTERN.test(raw);
};
const ALLOW_CROSS_ORIGIN_API_FALLBACK = readCrossOriginFallbackFlag();
const normalizeOriginBase = (value: string) => {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed;
  }
};
const isSameOriginBase = (left: string, right: string) => {
  if (!left || !right) return false;
  return normalizeOriginBase(left) === normalizeOriginBase(right);
};
export const getRuntimeOriginBase = () => (
  typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : ""
);
export const shouldIncludeApiBase = (apiBase: string, runtimeOriginBase: string) => {
  if (!apiBase) return false;
  if (!runtimeOriginBase) return true;
  if (isSameOriginBase(apiBase, runtimeOriginBase)) return true;
  return ALLOW_CROSS_ORIGIN_API_FALLBACK;
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
export const getApiBaseCandidates = (options: { includeEmpty?: boolean } = {}) => {
  const includeEmpty = options.includeEmpty !== false;
  const runtimeOriginBase = getRuntimeOriginBase();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const normalized = String(candidate || "").trim().replace(/\/$/, "");
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };
  if (runtimeOriginBase) add(runtimeOriginBase);
  if (shouldIncludeApiBase(API_URL || "", runtimeOriginBase)) add(API_URL);
  if (includeEmpty && !out.length) out.push("");
  return out;
};
const PUBLIC_API_PREFIXES = ["/api/public/"];
const PUBLIC_API_EXACT = new Set(["/api/health", "/api/ping"]);
const isControlPanelPath = (path: string) =>
  path.startsWith("/api/admin") || path.startsWith("/api/dev/algorithm");
let authExpiredNotifiedAt = 0;
let authBlockedUntilFreshToken = false;
let lastSeenAccessToken: string | null = null;
const RETRYABLE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const FAILOVER_HTTP_STATUSES = new Set([404, 502, 503, 504]);
const DEFAULT_API_TIMEOUT_MS = 20000;
const DEFAULT_API_RETRY_DELAY_MS = 450;
const DEFAULT_IDEMPOTENT_RETRIES = 1;

const isPublicApiPath = (path: string) =>
  PUBLIC_API_EXACT.has(path) || PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));

type ApiFetchOptions = RequestInit & {
  token?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }
  return false;
};

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
  options: ApiFetchOptions = {},
): Promise<T> {
  // Allow empty API_URL so requests can be relative (proxied by Vite in dev).
  const apiBaseCandidates = getApiBaseCandidates();
  const buildRequestUrl = (baseCandidate: string) => {
    const normalizedPath = String(path || "");
    if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
    return `${baseCandidate}${normalizedPath}`;
  };
  let { token, headers, cache, timeoutMs, retries, retryDelayMs, signal, ...rest } = options;
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
  const resolvedCache = cache ?? (isPublicPath ? "default" : "no-store");
  const controlPanelPassword = isControlPanelPath(path) ? getControlPanelPassword() : "";
  const requestMethod = String(rest.method || "GET").toUpperCase();
  const canRetryMethod = RETRYABLE_HTTP_METHODS.has(requestMethod);
  const maxRetries = Number.isFinite(Number(retries))
    ? Math.max(0, Math.min(3, Number(retries)))
    : canRetryMethod
      ? DEFAULT_IDEMPOTENT_RETRIES
      : 0;
  const resolvedTimeoutMs = Number.isFinite(Number(timeoutMs))
    ? Math.max(2000, Number(timeoutMs))
    : DEFAULT_API_TIMEOUT_MS;
  const resolvedRetryDelayMs = Number.isFinite(Number(retryDelayMs))
    ? Math.max(150, Number(retryDelayMs))
    : DEFAULT_API_RETRY_DELAY_MS;
  const retryDelayForAttempt = (attempt: number) =>
    Math.min(4000, Math.round(resolvedRetryDelayMs * Math.pow(2, attempt)));

  const performRequest = async (
    resolvedToken?: string,
    isRetry = false,
    attempt = 0,
    baseIndex = 0,
  ): Promise<T> => {
    const activeBase = apiBaseCandidates[Math.max(0, Math.min(apiBaseCandidates.length - 1, baseIndex))] || "";
    const url = buildRequestUrl(activeBase);
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
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let releaseSignalForwarder: (() => void) | null = null;
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        const forwardAbort = () => controller.abort();
        signal.addEventListener("abort", forwardAbort, { once: true });
        releaseSignalForwarder = () => signal.removeEventListener("abort", forwardAbort);
      }
    }
    if (resolvedTimeoutMs > 0) {
      timeoutHandle = setTimeout(() => controller.abort(), resolvedTimeoutMs);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        cache: resolvedCache,
        headers: requestHeaders,
        signal: controller.signal,
        // Include credentials (cookies) for cookie-based auth flows in local dev
        credentials: "include",
      });
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (releaseSignalForwarder) releaseSignalForwarder();
      const canFailoverBase =
        baseIndex + 1 < apiBaseCandidates.length &&
        !signal?.aborted &&
        isRetryableNetworkError(error);
      if (canFailoverBase) {
        return performRequest(resolvedToken, isRetry, attempt, baseIndex + 1);
      }
      const canRetry =
        attempt < maxRetries &&
        canRetryMethod &&
        !signal?.aborted &&
        isRetryableNetworkError(error);
      if (canRetry) {
        await wait(retryDelayForAttempt(attempt));
        return performRequest(resolvedToken, isRetry, attempt + 1, baseIndex);
      }
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (releaseSignalForwarder) releaseSignalForwarder();
    }

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
          if (refreshed) return performRequest(refreshed, true, attempt, baseIndex);
        }
        authBlockedUntilFreshToken = true;
        emitAuthExpired();
      }
      const canFailoverHttpError =
        baseIndex + 1 < apiBaseCandidates.length &&
        FAILOVER_HTTP_STATUSES.has(res.status);
      if (canFailoverHttpError) {
        return performRequest(resolvedToken, isRetry, attempt, baseIndex + 1);
      }
      const canRetryHttpError =
        attempt < maxRetries &&
        canRetryMethod &&
        RETRYABLE_HTTP_STATUSES.has(res.status);
      if (canRetryHttpError) {
        await wait(retryDelayForAttempt(attempt));
        return performRequest(resolvedToken, isRetry, attempt + 1, baseIndex);
      }
      throw new ApiError(message, res.status, data?.error, data);
    }
    if (!isPublicPath) authBlockedUntilFreshToken = false;
    return data as T;
  };

  return performRequest(token, false, 0, 0);
}
