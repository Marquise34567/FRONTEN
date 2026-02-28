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

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const base = API_URL || "";
  const { token, headers, ...rest } = options;
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    credentials: "include",
  });

  const text = await res.text().catch(() => "");
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `HTTP ${res.status}`,
      res.status,
      data?.error,
      data,
    );
  }
  return data as T;
}
