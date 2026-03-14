import { useEffect, useState } from "react"
import { API_URL, getRuntimeOriginBase, shouldIncludeApiBase } from "@/lib/api"
import { getControlPanelPassword } from "@/lib/controlPanelAuth"
import type { AdminRealtimePayload } from "./shared"

type RealtimeState = {
  payload: AdminRealtimePayload | null
  connected: boolean
  streamError: string | null
}

const clampInterval = (value: number) => {
  if (!Number.isFinite(value)) return 4000
  return Math.max(2000, Math.min(Math.round(value), 15000))
}

export const useAdminRealtimeStream = (accessToken?: string | null, intervalMs = 4000): RealtimeState => {
  const [payload, setPayload] = useState<AdminRealtimePayload | null>(null)
  const [connected, setConnected] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) {
      setPayload(null)
      setConnected(false)
      setStreamError(null)
      return
    }

    let cancelled = false
    const streamInterval = clampInterval(intervalMs)
    const streamPath = `/api/admin/stream?token=${encodeURIComponent(accessToken)}&password=${encodeURIComponent(
      getControlPanelPassword()
    )}&intervalMs=${streamInterval}`
    const runtimeOriginBase = getRuntimeOriginBase()
    const canUseApiBase = shouldIncludeApiBase(API_URL || "", runtimeOriginBase)
    const streamBase = canUseApiBase && API_URL ? API_URL : (runtimeOriginBase || "")
    const source = new EventSource(`${streamBase}${streamPath}`)

    source.addEventListener("ready", () => {
      if (cancelled) return
      setConnected(true)
      setStreamError(null)
    })

    source.addEventListener("realtime", (event) => {
      if (cancelled) return
      try {
        const nextPayload = JSON.parse((event as MessageEvent).data || "{}") as AdminRealtimePayload
        setPayload(nextPayload)
        setConnected(true)
        setStreamError(null)
      } catch {
        // ignore malformed realtime payloads
      }
    })

    source.addEventListener("stream_warning", (event) => {
      if (cancelled) return
      try {
        const warning = JSON.parse((event as MessageEvent).data || "{}") as { message?: string }
        setStreamError(warning?.message || "Live stream warning")
      } catch {
        setStreamError("Live stream warning")
      }
    })

    source.onerror = () => {
      if (cancelled) return
      setConnected(false)
      setStreamError("Live stream disconnected. Retrying automatically...")
    }

    return () => {
      cancelled = true
      source.close()
    }
  }, [accessToken, intervalMs])

  return { payload, connected, streamError }
}
