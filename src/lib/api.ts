const DEV_FALLBACK = "http://localhost:4000";
const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? DEV_FALLBACK : "");
export const API_URL = rawApiUrl.replace(/\/$/, "");

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
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || "Request failed",
      res.status,
      data?.error,
      data,
    );
  }
  return data as T;
}
