const TRUE_PATTERN = /^(1|true|yes|on)$/i
const FALSE_PATTERN = /^(0|false|no|off)$/i

const normalize = (value: unknown) => String(value ?? "").trim()

const isLoopbackHost = (value: string) => {
  const host = normalize(value).toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

export const isLocalhostLoopbackRuntime = () => {
  if (typeof window === "undefined") return false
  return isLoopbackHost(window.location.hostname)
}

const normalizeApiUrl = (value: unknown) => {
  const raw = normalize(value)
  if (!raw) return ""
  let next = raw.replace(/^\s*vite_api_url\s*=\s*/i, "")
  next = next.replace(/^https\/\//i, "https://").replace(/^http\/\//i, "http://")
  if (!next) return ""
  if (next.startsWith("http://") || next.startsWith("https://")) return next
  return `https://${next}`
}

const readApiHostname = () => {
  if (typeof import.meta === "undefined") return ""
  const env = (import.meta as any).env || {}
  const apiUrl = normalizeApiUrl(env.VITE_API_URL)
  if (!apiUrl) return ""
  try {
    return new URL(apiUrl).hostname
  } catch {
    return ""
  }
}

const readBypassFlag = () => {
  if (typeof import.meta === "undefined") return ""
  const env = (import.meta as any).env || {}
  return normalize(env.VITE_LOCALHOST_AUTH_BYPASS ?? env.VITE_DEV_BYPASS_AUTH)
}

const readBypassToken = () => {
  if (typeof import.meta === "undefined") return ""
  const env = (import.meta as any).env || {}
  return normalize(env.VITE_LOCALHOST_BYPASS_TOKEN ?? env.VITE_DEV_BYPASS_TOKEN)
}

export const isLocalhostAuthBypassEnabled = () => {
  if (!isLocalhostLoopbackRuntime()) return false
  const raw = readBypassFlag()
  if (!raw) {
    // Safe default: if localhost is pointed at a remote API, require real auth.
    const apiHost = readApiHostname()
    if (apiHost && !isLoopbackHost(apiHost)) return false
    return true
  }
  if (FALSE_PATTERN.test(raw)) return false
  return TRUE_PATTERN.test(raw)
}

export const getLocalhostBypassToken = () => readBypassToken() || "localhost-dev-token"

export const getLocalhostBypassUser = () => ({
  id: "localhost-dev-user",
  email: "localhost-dev@autoeditor.local",
})
