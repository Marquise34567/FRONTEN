const TRUE_PATTERN = /^(1|true|yes|on)$/i
const FALSE_PATTERN = /^(0|false|no|off)$/i

const normalize = (value: unknown) => String(value ?? "").trim()

const isLoopbackHost = (value: string) => {
  const host = normalize(value).toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

const readBypassFlag = () => {
  if (typeof import.meta === "undefined") return ""
  const env = (import.meta as any).env || {}
  return normalize(env.VITE_LOCALHOST_AUTH_BYPASS ?? env.VITE_DEV_BYPASS_AUTH)
}

export const isLocalhostAuthBypassEnabled = () => {
  if (typeof window === "undefined") return false
  if (!isLoopbackHost(window.location.hostname)) return false
  const raw = readBypassFlag()
  if (!raw) return true
  if (FALSE_PATTERN.test(raw)) return false
  return TRUE_PATTERN.test(raw)
}

export const getLocalhostBypassToken = () => "localhost-dev-token"

export const getLocalhostBypassUser = () => ({
  id: "localhost-dev-user",
  email: "localhost-dev@autoeditor.local",
})

