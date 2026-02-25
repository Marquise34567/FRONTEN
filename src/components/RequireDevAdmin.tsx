import { FormEvent, ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/providers/AuthProvider"
import { apiFetch } from "@/lib/api"
import {
  clearControlPanelPassword,
  getControlPanelPassword,
  setControlPanelPassword
} from "@/lib/controlPanelAuth"

const RequireDevAdmin = ({ children }: { children: ReactNode }) => {
  const { accessToken } = useAuth()
  const [password, setPassword] = useState(getControlPanelPassword())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verifyPassword = async (candidate: string) => {
    if (!accessToken) return false
    try {
      await apiFetch("/api/admin/health-status", {
        token: accessToken,
        headers: {
          "x-dev-password": candidate
        }
      })
      return true
    } catch {
      return false
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
      const valid = await verifyPassword(candidate)
      if (cancelled) return
      if (valid) {
        setControlPanelPassword(candidate)
        setIsAuthorized(true)
      } else {
        clearControlPanelPassword()
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

    const valid = await verifyPassword(candidate)
    if (!valid) {
      clearControlPanelPassword()
      setIsAuthorized(false)
      setError("Invalid control panel password.")
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
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading control panel access...
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-border/70 bg-card/70 p-5 shadow-lg backdrop-blur"
        >
          <p className="text-sm font-semibold text-foreground">Control Panel Password</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter password to unlock control panel tools.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-3 h-10 w-full rounded-md border border-border/70 bg-background/60 px-3 text-sm text-foreground"
            placeholder="Enter password"
          />
          {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
          <Button type="submit" className="mt-3 w-full" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Unlock Control Panel"}
          </Button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}

export default RequireDevAdmin
