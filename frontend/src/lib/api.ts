const DEV_FALLBACK = "http://localhost:4000";
const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEV_FALLBACK : "");
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
export const API_URL = normalizeApiUrl(rawApiUrl).replace(/\/$/, "");

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

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "API URL not configured. Set VITE_API_URL in your deployment environment.",
      0,
      "missing_api_url",
    );
  }
  let { token, headers, ...rest } = options;
  // If no token provided, try to fetch from Supabase session
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token ?? undefined;
    } catch (e) {
      token = undefined;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `HTTP ${res.status}`
    // If unauthorized, dispatch a global event so UI can stop polling and prompt login
    if (res.status === 401) {
      try {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      } catch (e) {}
    }
    throw new ApiError(message, res.status, data?.error, data)
  }
  return data as T;
}
