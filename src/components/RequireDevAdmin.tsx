import { FormEvent, ReactNode, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, LockKeyhole, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/providers/AuthProvider"
import { ApiError, apiFetch } from "@/lib/api"
import {
  clearControlPanelPassword,
  getControlPanelPassword,
  setControlPanelPassword
} from "@/lib/controlPanelAuth"

type VerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: "invalid_password" | "unauthorized" | "request_failed"
      message: string
    }

const RequireDevAdmin = ({ children }: { children: ReactNode }) => {
  const { accessToken } = useAuth()
  const [password, setPassword] = useState(getControlPanelPassword())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verifyPassword = async (candidate: string): Promise<VerifyResult> => {
    if (!accessToken) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "You must be signed in to access the control panel."
      }
    }
    try {
      await apiFetch("/api/admin/auth-check", {
        token: accessToken,
        headers: {
          "x-dev-password": candidate
        }
      })
      return { ok: true }
    } catch (cause) {
      if (cause instanceof ApiError) {
        const code = String(cause.code || "").toLowerCase()
        if (code === "invalid_password" || code === "password_required") {
          return {
            ok: false,
            reason: "invalid_password",
            message: "Invalid control panel password."
          }
        }
        if (code === "unauthorized") {
          return {
            ok: false,
            reason: "unauthorized",
            message: "Session expired. Sign in again and retry."
          }
        }
        return {
          ok: false,
          reason: "request_failed",
          message: cause.message || "Unable to verify control panel access right now."
        }
      }
      return {
        ok: false,
        reason: "request_failed",
        message: "Unable to verify control panel access right now."
      }
    }
  }

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      if (!accessToken) {
        if (!cancelled) {
          setIsLoading(false)
          setIsAuthorized(false)
        }
        return
      }
      setIsLoading(true)
      setError(null)
      const candidate = getControlPanelPassword()
      setPassword(candidate)
      const result = await verifyPassword(candidate)
      if (cancelled) return
      if (result.ok) {
        setControlPanelPassword(candidate)
        setIsAuthorized(true)
        setError(null)
      } else {
        if (result.reason === "invalid_password") {
          clearControlPanelPassword()
          setError("Saved control panel password is invalid. Enter it again.")
        } else {
          setError(result.message)
        }
        setIsAuthorized(false)
      }
      setIsLoading(false)
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) {
      setError("You must be signed in.")
      return
    }
    const candidate = password.trim()
    if (!candidate) {
      setError("Password is required.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    const result = await verifyPassword(candidate)
    if (!result.ok) {
      if (result.reason === "invalid_password") {
        clearControlPanelPassword()
      }
      setIsAuthorized(false)
      setError(result.message)
      setIsSubmitting(false)
      return
    }

    setControlPanelPassword(candidate)
    setIsAuthorized(true)
    setError(null)
    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(120%_120%_at_20%_-20%,hsl(var(--primary)/0.25),transparent_52%),linear-gradient(180deg,hsl(228_28%_10%)_0%,hsl(224_28%_7%)_100%)] text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-2 backdrop-blur">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Loading control panel access...
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(140%_120%_at_0%_0%,hsl(var(--primary)/0.32),transparent_54%),radial-gradient(130%_130%_at_100%_100%,hsl(196_92%_54%/0.2),transparent_48%),linear-gradient(180deg,hsl(230_27%_8%)_0%,hsl(223_31%_5%)_100%)] px-4">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-[8%] top-[14%] h-40 w-40 rounded-full bg-primary/20 blur-3xl"
            animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.08, 1] }}
            transition={{ duration: 7, repeat: Infinity }}
          />
          <motion.div
            className="absolute right-[10%] top-[38%] h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl"
            animate={{ opacity: [0.2, 0.42, 0.2], scale: [1.04, 1, 1.04] }}
            transition={{ duration: 8.5, repeat: Infinity }}
          />
        </div>
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative mx-auto mt-[16vh] w-full max-w-sm rounded-2xl border border-primary/30 bg-[radial-gradient(140%_130%_at_0%_0%,hsl(var(--primary)/0.24),transparent_60%),linear-gradient(170deg,hsl(228_24%_13%/0.92)_0%,hsl(226_32%_8%/0.94)_100%)] p-6 shadow-[0_20px_60px_-22px_hsl(var(--primary)/0.45)] backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Control Panel Access</p>
              <p className="text-[11px] text-muted-foreground">Enter password to unlock internal tools.</p>
            </div>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-lg border border-primary/25 bg-background/40 px-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/25"
            placeholder="Enter password"
          />
          {error ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Password check now targets a dedicated auth endpoint for accurate errors.
            </p>
          )}
          <Button type="submit" className="btn-glow mt-4 h-10 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Unlock Control Panel"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            If this fails with session error, sign out and sign back in.
          </p>
        </motion.form>
      </div>
    )
  }

  return <>{children}</>
}

export default RequireDevAdmin
