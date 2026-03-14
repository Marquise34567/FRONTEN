import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
const GlowBackdrop = lazy(() => import("@/components/GlowBackdrop"));
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";

const isRecoveryFlow = () => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const type = params.get("type");
  const accessToken = params.get("access_token");
  return type === "recovery" || Boolean(accessToken);
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const RESET_EMAIL_COOLDOWN_MS = 60_000;
const RESET_EMAIL_COOLDOWN_STORAGE_KEY = "ae_reset_email_cooldown_until";

const readCooldownUntil = () => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(RESET_EMAIL_COOLDOWN_STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeCooldownUntil = (value: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RESET_EMAIL_COOLDOWN_STORAGE_KEY, String(value));
};

const parseCooldownMsFromMessage = (message: string) => {
  const match = message.match(/(\d+)\s*(second|minute|sec|min)/i);
  if (!match) return RESET_EMAIL_COOLDOWN_MS;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return RESET_EMAIL_COOLDOWN_MS;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("min")) return value * 60_000;
  return value * 1000;
};

const isRateLimitError = (error: { message?: string; status?: number; code?: string } | null) => {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  return error.status === 429 || message.includes("rate") || message.includes("too many") || code.includes("rate");
};

const formatCooldown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
};

const ResetPassword = () => {
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(readCooldownUntil());
  const [cooldownTick, setCooldownTick] = useState(Date.now());
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isRecoveryFlow()) {
      setMode("update");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setMode("update");
        setStatusMessage("You're signed in. Set a new password below.");
      }
    });
  }, []);

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => setCooldownTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && cooldownUntil <= cooldownTick) {
      setCooldownUntil(0);
      writeCooldownUntil(0);
    }
  }, [cooldownUntil, cooldownTick]);

  const cooldownRemainingMs = Math.max(0, cooldownUntil - cooldownTick);

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;
    if (cooldownRemainingMs > 0) {
      const message = `Please wait ${formatCooldown(cooldownRemainingMs)} before requesting another reset email.`;
      setErrorMessage(message);
      toast({ title: "Please wait", description: message });
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const redirectBase = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${redirectBase}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      let message = error.message || "Unable to send reset email.";
      if (isRateLimitError(error)) {
        const cooldownMs = parseCooldownMsFromMessage(message);
        const until = Date.now() + cooldownMs;
        writeCooldownUntil(until);
        setCooldownUntil(until);
        message = `Email limit reached. Try again in ${formatCooldown(cooldownMs)} or use the most recent reset link.`;
      }
      setErrorMessage(message);
      toast({ title: "Reset failed", description: message });
      return;
    }
    const nextCooldownUntil = Date.now() + RESET_EMAIL_COOLDOWN_MS;
    writeCooldownUntil(nextCooldownUntil);
    setCooldownUntil(nextCooldownUntil);
    const message = "Check your inbox for a password reset link.";
    setStatusMessage(message);
    toast({ title: "Reset email sent", description: message });
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      const message = "Passwords do not match.";
      setErrorMessage(message);
      toast({ title: "Update failed", description: message });
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (error) {
      const message = error.message || "Unable to update password.";
      setErrorMessage(message);
      toast({ title: "Update failed", description: message });
      return;
    }
    const message = "Password updated. Please sign in.";
    setStatusMessage(message);
    toast({ title: "Password updated", description: message });
    navigate("/login", { replace: true });
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GlowBackdrop>
        <SeoHead
          title="Reset Password | AutoEditor"
          description="Reset your AutoEditor password to regain access to your creator workspace."
          path="/reset-password"
          noindex
        />
        <Navbar />
        <main className="responsive-main flex items-center justify-center min-h-screen px-4 pt-24">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="glass-card p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold font-display text-foreground mb-2">
                  {mode === "update" ? "Set a new password" : "Reset your password"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === "update"
                    ? "Choose a new password to secure your account."
                    : "We’ll email you a secure reset link."}
                </p>
              </div>

              {mode === "update" ? (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm text-muted-foreground">
                      New password
                    </Label>
                    <Input
                      id="new-password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Enter a new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      className="bg-muted/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                      Confirm password
                    </Label>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      className="bg-muted/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {submitting ? "Updating..." : "Update password"}
                  </Button>
                  {statusMessage ? <p className="text-sm text-foreground text-center">{statusMessage}</p> : null}
                  {errorMessage ? <p className="text-sm text-destructive text-center">{errorMessage}</p> : null}
                </form>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm text-muted-foreground">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="bg-muted/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting || cooldownRemainingMs > 0}
                    className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {submitting
                      ? "Sending..."
                      : cooldownRemainingMs > 0
                        ? `Try again in ${formatCooldown(cooldownRemainingMs)}`
                        : "Send reset email"}
                  </Button>
                  {statusMessage ? <p className="text-sm text-foreground text-center">{statusMessage}</p> : null}
                  {errorMessage ? <p className="text-sm text-destructive text-center">{errorMessage}</p> : null}
                </form>
              )}

              <p className="text-xs text-muted-foreground text-center mt-6">
                Remembered your password?{" "}
                <Link to="/login" className="text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      </GlowBackdrop>
    </Suspense>
  );
};

export default ResetPassword;
